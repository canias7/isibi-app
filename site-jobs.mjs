// Scheduled work for a published site.
//
// THE GAP THIS FILLS, AND WHY IT IS A CAPABILITY RATHER THAN A FEATURE. The
// model can already express "who needs reminding tomorrow" — it is a SELECT.
// What it cannot do is arrange for that query to run tomorrow at nine, or put
// the result on a wire. Every other missing integration (SMS reminders, a
// nightly digest, chasing unpaid invoices, flagging bookings nobody confirmed)
// is that same pair, and building them one at a time is how you end up with the
// eight-verb runner again.
//
// So the split is the one payments and confirmations already use:
//
//   MODEL     a schedule, and an internal SQL function returning the messages.
//             Which rows, on what condition, worded how, joined to whatever —
//             all of it per site, written at build time.
//   PLATFORM  the clock and the wire. Only that, and only because the model has
//             neither: nothing in a database or a static page can run itself on
//             a timer, and Postgres has no HTTP client.
//
// It is deliberately NOT the deleted `runSiteFunction`, whose spec was a
// sequence of eight named steps. A job names ONE function and sends what it
// returns. There is nothing here to extend when somebody wants a different kind
// of scheduled work — they write different SQL.

// The floor is 15 minutes. Anything finer is a promise the 2-minute cron cannot
// keep across many sites, and a site asking for "every minute" would quietly get
// something else.
export const MIN_EVERY_MINUTES = 15;
export const MAX_EVERY_MINUTES = 60 * 24 * 31;
// Per tick, per site. A job that suddenly matches ten thousand rows is a bill on
// the owner's provider and a stall for every other site's job; it is capped, and
// `shapeMessages` reports the overflow rather than dropping it silently.
export const MAX_MESSAGES_PER_RUN = 100;
// Sites drained per tick. Bounds one slow site's effect on the rest, the same
// reason `neon_teardown` batches at 5.
export const MAX_JOBS_PER_TICK = 25;

const MAX_SUBJECT = 200;
const MAX_BODY = 4000;

/**
 * Validate one declared job. Null for anything unresolvable — a job that half
 * exists is worse than none, because the owner is told their reminders are set
 * up and no reminder is ever sent.
 *
 * The `fn` cross-reference (does it exist, is it internal?) is NOT checked here.
 * Only `normalizeSchema` sees the function list, so it is resolved there, the
 * same way `confirm.fn` is.
 */
export function normalizeJob(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const name = String(raw.name || "").toLowerCase();
  if (!/^[a-z][a-z0-9_]{0,40}$/.test(name)) return null;
  const fn = String(raw.fn || raw.function || "").toLowerCase();
  if (!/^[a-z][a-z0-9_]{0,40}$/.test(fn) || fn.startsWith("_")) return null;

  const n = parseInt(raw.everyMinutes != null ? raw.everyMinutes : (raw.every != null ? raw.every : raw.minutes), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  // CLAMPED, not refused. A model asking for every 5 minutes wants "often", and
  // refusing the whole job over the number loses the reminder entirely — but it
  // must not be told it got what it asked for, so the stored value is the real
  // one and it is the real one that runs.
  const everyMinutes = Math.min(MAX_EVERY_MINUTES, Math.max(MIN_EVERY_MINUTES, n));
  return { name, fn, everyMinutes };
}

/**
 * Which of these rows are due.
 *
 * `now` is passed in rather than read, so the boundary is testable — a schedule
 * whose off-by-one only shows up at a real clock edge is exactly the bug that
 * never gets caught.
 *
 * The 30-second grace mirrors the existing cron: a 15-minute job driven by a
 * 2-minute tick would otherwise skip a slot whenever the ticks land badly, and
 * an hourly digest that silently becomes two-hourly is very hard to notice.
 */
export function dueJobs(rows, now) {
  const t = Number(now);
  // How long this job has been waiting, for the ordering below. A job that has
  // never run, or whose stamp cannot be read, has waited longest — the same
  // rows the dueness filter treats as "run, do not strand".
  const waited = (r) => {
    if (!r || !r.last_run) return Infinity;
    const last = Date.parse(r.last_run);
    if (!Number.isFinite(last)) return Infinity;
    return t - last;
  };
  return (Array.isArray(rows) ? rows : []).filter((r) => {
    if (!r || r.enabled === false) return false;
    const mins = parseInt(r.schedule_minutes, 10);
    if (!(mins > 0)) return false;
    if (!r.last_run) return true;                    // never run — due immediately
    const last = Date.parse(r.last_run);
    if (!Number.isFinite(last)) return true;         // unreadable stamp: run, do not strand
    // A last_run in the FUTURE (a clock skew, a hand-edited row) would otherwise
    // park the job until real time caught up, which for a monthly job is weeks.
    if (last > t) return true;
    return (t - last) >= (mins * 60000 - 30000);
  })
    // STALEST FIRST, AND THE CAP IS WHY THIS MATTERS. The filter can return more
    // than `MAX_JOBS_PER_TICK` and the slice below takes a fixed number — so in
    // READ ORDER the same first 25 win every tick and everything behind them
    // starves permanently, however long it has been waiting. Nothing announces
    // that: each tick reports a healthy run, and the jobs nobody sees simply
    // never fire.
    //
    // Sorting by how long each has waited makes the rotation fall out on its
    // own: a job that runs has its stamp refreshed and goes to the back, so over
    // a few ticks everything due gets a turn. It also puts a never-run job — a
    // site that has just been built — at the front, which is where it belongs.
    //
    // Held HERE rather than left to the caller's query string, because this is
    // the module that decides which jobs run and a property the caller happens
    // to supply is one a later edit drops silently.
    .sort((a, b) => waited(b) - waited(a))
    .slice(0, MAX_JOBS_PER_TICK);
}

/**
 * Validate what the model's function returned.
 *
 * Computed is not trusted. These messages are model-written SQL output that
 * nobody reads before it becomes mail on the owner's account, so each one is
 * checked exactly as a form field would be — and the address goes through the
 * SAME `recipient` the write path uses, because "a@b.com, evil@x.com" is header
 * injection whoever produced it.
 */
export function shapeMessages(out, recipientFn, phoneFn) {
  const raw = typeof out === "string" ? safeJson(out) : out;
  const list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.messages) ? raw.messages : null);
  if (!list) return { messages: [], dropped: 0, overflow: 0, bad: raw == null ? "nothing" : "not a list" };

  const messages = [];
  let dropped = 0;
  for (const m of list.slice(0, MAX_MESSAGES_PER_RUN)) {
    // WHICH CHANNEL, DECLARED RATHER THAN INFERRED. The tempting shortcut is
    // "no subject means text it" — and that turns a function that forgot a
    // subject into a text message to somebody's phone, at the owner's expense,
    // instead of a dropped message they can see in the panel. An unrecognised
    // channel is email, because email is the one that costs nothing per send.
    const channel = String((m && m.channel) || "email").toLowerCase() === "sms" ? "sms" : "email";
    const body = String((m && m.body) == null ? "" : m.body).slice(0, MAX_BODY);

    if (channel === "sms") {
      // THE NUMBER GOES THROUGH THE SAME PARSER THE WRITE PATH USES. A job's
      // recipients come out of model-written SQL, so "07700 900000" and
      // "+44 7700 900000" both turn up — and only one of them can be sent to.
      // Without `phoneFn` the caller has not wired SMS at all, and a message
      // asking for it is dropped rather than quietly emailed to a phone number.
      const to = phoneFn && m && typeof m === "object" ? phoneFn(m.to) : null;
      if (!to || !body.trim()) { dropped++; continue; }
      // No subject: a text has none, and carrying one would put it on the wire
      // as part of the body on some providers.
      messages.push({ channel, to, body });
      continue;
    }

    const to = m && typeof m === "object" ? recipientFn(m, "to") : null;
    const subject = String((m && m.subject) == null ? "" : m.subject).slice(0, MAX_SUBJECT);
    if (!to || !subject || !body) { dropped++; continue; }
    messages.push({ channel, to, subject, html: body });
  }
  // Overflow is REPORTED, never silent. A job quietly capped at 100 looks like a
  // job that worked, and the hundred-and-first customer is the one who turns up
  // without a reminder.
  return { messages, dropped, overflow: Math.max(0, list.length - MAX_MESSAGES_PER_RUN), bad: null };
}

function safeJson(s) { try { return JSON.parse(s); } catch { return null; } }

/**
 * ONE PLAIN SENTENCE FOR WHAT A RUN ACTUALLY DID.
 *
 * WHY THIS EXISTS. `runJob` already computes an honest, four-way outcome — and
 * every caller threw it into a `console.log` the site owner cannot read. So from
 * the owner's side a reminder that never arrives is indistinguishable from a
 * reminder that was never due, and the only symptom is a customer who does not
 * turn up, months later, looking like ordinary business. That is the worst
 * failure shape a scheduled job can have, and it is this repo's most-recorded
 * one: a feature that works and cannot be seen working.
 *
 * THE FOUR OUTCOMES MUST NOT READ ALIKE. That is the whole requirement:
 *
 *   nothing was due          — the ordinary run, and NOT news
 *   the function is broken   — returned null, or a shape that is not a list
 *   rows came back, no key   — the owner has not pasted a mail key yet
 *   it sent, or it threw     — the two that need a number and a reason
 *
 * NO RECIPIENT EVER APPEARS HERE. This is a platform table beside every other
 * site's, and the messages are a customer's own name and address; counts and
 * reasons carry everything the owner needs and nothing they should not have in
 * two places. Same discipline as the audit log's allow-list.
 */
export function jobOutcome(out) {
  if (!out || typeof out !== "object") return "Didn\u2019t run.";
  if (out.ok === false) {
    if (out.reason === "threw") return "Failed \u2014 " + String(out.error || "no reason given").slice(0, 160);
    return "Couldn\u2019t run \u2014 " + String(out.reason || "no reason given").slice(0, 160);
  }
  // An overlapping tick losing the claim is the SYSTEM WORKING, not news — but
  // if it is ever shown it must not read like a failure or like a quiet
  // Tuesday. The runner skips the last_result write for this outcome entirely.
  if (out.skipped) return "Skipped \u2014 another run had already picked this up.";
  const sent = Number(out.sent) || 0;
  const bits = [];
  if (sent) bits.push("Sent " + sent + (sent === 1 ? " message." : " messages."));
  // A FUNCTION THAT RETURNED NULL IS NOT "NOTHING TO DO", and collapsing the two
  // is exactly the confusion this function exists to end: one is a quiet Tuesday
  // and the other is model-written SQL that is broken on every run.
  else if (out.reason && /^returned /.test(String(out.reason))) {
    bits.push("The function didn\u2019t return a list of messages \u2014 nothing could be sent.");
  } else if (out.reason) bits.push("Ready to send, but " + String(out.reason).slice(0, 120) + ".");
  else bits.push("Nothing to send this time.");

  if (out.failed) bits.push(out.failed + (out.failed === 1 ? " message failed to send." : " messages failed to send."));
  // NOT A FAILURE, AND NOT SILENCE EITHER. These are texts on a site with no
  // SMS key pasted yet (or the reverse) — nothing broke, and the owner still
  // needs to know some of what the job produced is waiting on them.
  if (out.unsent) {
    bits.push(out.unsent + (out.unsent === 1 ? " message is" : " messages are")
      + " waiting on a provider key in Secrets.");
  }
  // Reported, never silent — a job quietly capped is a job that looks like it
  // worked, and the hundred-and-first customer is the one with no reminder.
  if (out.overflow) bits.push(out.overflow + " more were over the " + MAX_MESSAGES_PER_RUN + "-per-run cap and were not sent.");
  if (out.dropped) bits.push(out.dropped + (out.dropped === 1 ? " was missing an address, subject or body." : " were missing an address, subject or body."));
  return bits.join(" ");
}

/**
 * Run one site's due job. Injected deps, so every decision is testable with no
 * clock, no database and no network.
 *
 * NEVER THROWS. A job is background work; a failing one must not stop the tick
 * for every other site, so it reports a reason and the caller logs it.
 *
 * `stamp` runs FIRST, before any sending, and that ordering is the important
 * one: stamped afterwards, a job that dies mid-send is due again on the next
 * tick and mails everyone it already reached. Losing a run is recoverable —
 * sending a reminder four times is not.
 */
export async function runJob(deps, row) {
  const name = row && row.name;
  try {
    const spec = row && row.spec && typeof row.spec === "object" ? row.spec : null;
    const fn = spec && typeof spec.fn === "string" ? spec.fn : null;
    if (!fn || !/^[a-z][a-z0-9_]{0,40}$/.test(fn)) return { ok: false, name, reason: "no function" };

    // THE STAMP IS A CLAIM NOW, not a fire-and-forget write (2026-08-13 audit).
    // Cloudflare cron ticks OVERLAP when a tick outlasts its 2-minute interval
    // — 25 jobs of up to 100 sequential provider sends can take many minutes —
    // so two ticks could both read a job as due and both mail its whole batch:
    // the exact double-send the stamp-first ordering exists to prevent, open
    // through a different door. And the old write was never checked, so an
    // HTTP-level failure (Supabase read-only, where reads keep working) let
    // the send proceed unstamped and re-mail everyone every tick until writes
    // recovered. `{won:false}` means another tick claimed this run OR the
    // claim could not be recorded — either way nothing may be sent. Strictly
    // `=== false`: a dep that cannot say (older fakes) behaves as before.
    const claimed = await deps.stamp(row);
    if (claimed && claimed.won === false) return { ok: true, name, skipped: true };

    const raw = await deps.callFn(fn);
    // A NULL-SHAPED ANSWER WITH A NAMED CAUSE. `callFn` used to return bare
    // null for three different situations — database unreachable, job no
    // longer declared, unusable function name — and all three wore the
    // broken-SQL sentence, against this module's own four-outcomes bar. The
    // caller names the cause now; the sentence carries it.
    if (raw && typeof raw === "object" && typeof raw.jobsSkip === "string") {
      return { ok: true, name, sent: 0, reason: String(raw.jobsSkip).slice(0, 120) };
    }
    const shaped = shapeMessages(raw, deps.recipient, deps.phone);
    if (shaped.bad) return { ok: true, name, sent: 0, reason: "returned " + shaped.bad };
    if (!shaped.messages.length) return { ok: true, name, sent: 0, dropped: shaped.dropped };

    // EACH CHANNEL'S KEY IS RESOLVED ONCE, AND ONLY IF THAT CHANNEL IS USED.
    // A hundred reminders must not be a hundred decryptions — and a job that
    // sends no texts must not read the SMS vault at all, or every email-only
    // site on the platform pays a decrypt per tick for a feature it never
    // declared.
    const wants = (c) => shaped.messages.some((m) => m.channel === c);
    const creds = wants("email") ? await deps.credentials() : null;
    const smsCreds = wants("sms") && deps.smsCredentials ? await deps.smsCredentials() : null;

    // NAMED PER CHANNEL, because "no provider key in Secrets" said of a job that
    // sends both is a sentence the owner cannot act on: they have pasted one key
    // and are missing the other, and the panel would tell them to paste the one
    // they already have.
    if (wants("email") && !creds && !wants("sms")) return { ok: true, name, sent: 0, reason: "no email provider key in Secrets" };
    if (wants("sms") && !smsCreds && !wants("email")) return { ok: true, name, sent: 0, reason: "no SMS provider key in Secrets" };
    if (!creds && !smsCreds) return { ok: true, name, sent: 0, reason: "no provider key in Secrets" };

    // `unsent`, NOT `skipped`. `skipped: true` already means "another tick had
    // claimed this run" — a BOOLEAN — and `jobOutcome` branches on it before it
    // reads anything else. A COUNT in the same field is truthy, so a run that
    // sent an email and could not send a text reported "Skipped — another run
    // had already picked this up", which is a flat lie about a run that did
    // work; and `runScheduledSiteJobs` skips the `last_result` write on that
    // same flag, so the owner's panel kept the PREVIOUS run's line for ever.
    // Two bugs out of one overloaded name.
    let sent = 0, failed = 0, unsent = 0;
    for (const m of shaped.messages) {
      const use = m.channel === "sms" ? smsCreds : creds;
      // A MESSAGE WHOSE CHANNEL HAS NO KEY IS NOT A FAILURE. Counting it as one
      // makes a half-configured site look broken every run, when what is true is
      // that the emails went and the texts are waiting on a credential.
      if (!use) { unsent++; continue; }
      const r = m.channel === "sms"
        ? await deps.sendSms({ ...use, to: m.to, body: m.body })
        : await deps.send({ ...use, to: m.to, subject: m.subject, html: m.html });
      if (r && r.ok) sent++; else failed++;
    }
    return { ok: true, name, sent, failed, dropped: shaped.dropped, overflow: shaped.overflow, unsent };
  } catch (e) {
    return { ok: false, name, reason: "threw", error: String((e && e.message) || e).slice(0, 200) };
  }
}
