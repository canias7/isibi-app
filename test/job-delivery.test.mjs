// STUBBED DELIVERY: the scheduled-job runner driven end to end with no clock,
// no database and no network (owner, 2026-09-16: "Start with actual stubbed
// delivery: drive the real runner with a fixed clock, known due and not-due
// records, synthetic recipients, and a sender stub that records the payload").
//
// WHY THIS EXISTS RATHER THAN A LIVE RUN WITH NO KEY. The first plan called a
// live run on a site with no provider key "stubbed delivery". It is not: with no
// key `runJob` returns BEFORE the sender is reached, so nothing about the
// recipient, the date, the message body or the stamp is exercised at all. The
// only thing that run proves is the refusal. This file drives the parts that
// run stops short of — and the refusal is its own case at the end, so the two
// are demonstrated apart rather than one standing in for the other.
//
// EVERY RECIPIENT HERE IS SYNTHETIC. `example.com` and the UK 07700 900xxx
// range are both reserved for exactly this; no address or number in this file
// can reach a person, and none is copied from a customer's row.
//
// THE CLOCK IS A CONSTANT. `dueJobs` and `lastDueAt` take `now` as an argument
// precisely so the boundary is testable — a schedule whose off-by-one only
// shows at a real clock edge is the bug that never gets caught.
import { test } from "node:test";
import assert from "node:assert/strict";
import { runJob, dueJobs, shapeMessages, jobOutcome, lastDueAt, MAX_MESSAGES_PER_RUN } from "../site-jobs.mjs";

// 2026-09-17T08:00:00Z — a Thursday morning, chosen so the London zone is on
// BST (+01:00) and a clock-time job's zone is load-bearing rather than a no-op.
const NOW = Date.UTC(2026, 8, 17, 8, 0, 0);
const iso = (ms) => new Date(ms).toISOString();
const MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR;

/** The write path's own address rule, in the shape `runJob` is handed it. */
const recipient = (m, k) => {
  const v = String((m && m[k]) || "").trim();
  return /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(v) ? v : null;
};
const phone = (v) => {
  const d = String(v == null ? "" : v).replace(/[^\d+]/g, "");
  if (/^0\d{10}$/.test(d)) return "+44" + d.slice(1);
  return /^\+\d{10,15}$/.test(d) ? d : null;
};

/**
 * A runner with every seam recorded. `sent` is the payload the provider WOULD
 * have been handed — the last hop this test can see, and the reason the claim
 * it supports is about what was handed over and never about delivery.
 */
function harness({ rows, emailKey = { provider: "resend", key: "k-email", from: "workshop@example.com" }, smsKey = null, stampWon = true, sendOk = () => true } = {}) {
  const seen = { stamped: [], called: [], email: [], sms: [], recorded: [] };
  const deps = {
    stamp: async (r) => { seen.stamped.push(r.name); return { won: stampWon }; },
    callFn: async (fn) => { seen.called.push(fn); return rows; },
    recipient, phone,
    credentials: async () => emailKey,
    smsCredentials: async () => smsKey,
    send: async (p) => { seen.email.push(p); return { ok: sendOk(p) }; },
    sendSms: async (p) => { seen.sms.push(p); return { ok: sendOk(p) }; },
  };
  return { deps, seen };
}

const JOB = { name: "remind_tomorrow", spec: { fn: "bookings_due_tomorrow", at: "09:00", tz: "Europe/London" }, schedule_minutes: 1440 };

test("the runner hands the provider the right recipient, date and body", async () => {
  // WHAT A REMINDER FUNCTION REALLY RETURNS: one message per due row, with the
  // date the reminder is ABOUT in the body. Two rows due, so the count is not
  // satisfied by a loop that runs once.
  const { deps, seen } = harness({ rows: [
    { channel: "email", to: "alex@example.com", subject: "Your bike is due in tomorrow", body: "Hi Alex — your Ridgeback is booked in for 2026-09-18." },
    { channel: "email", to: "sam@example.com", subject: "Your bike is due in tomorrow", body: "Hi Sam — your Brompton is booked in for 2026-09-18." },
  ] });
  const out = await runJob(deps, JOB);

  assert.deepEqual(seen.stamped, ["remind_tomorrow"], "the claim must be staked before anything is sent");
  assert.deepEqual(seen.called, ["bookings_due_tomorrow"], "the job must call the function its spec names, and only that one");
  assert.equal(seen.email.length, 2, "one message per due row");
  assert.equal(seen.sms.length, 0, "an email-only job must not touch the SMS sender");

  // THE RECIPIENT IS THE ROW'S, not the owner's and not the credential's `from`.
  assert.deepEqual(seen.email.map((e) => e.to), ["alex@example.com", "sam@example.com"]);
  assert.equal(seen.email[0].from, "workshop@example.com", "the sender address comes from the site's own key");
  // THE DATE THE REMINDER IS ABOUT SURVIVES THE PIPELINE. It rides in the body,
  // and a shaping step that dropped or truncated it would be invisible in a
  // count of messages — which is what makes this assertion worth its line.
  assert.match(seen.email[0].html, /2026-09-18/);
  assert.match(seen.email[0].subject, /due in tomorrow/);
  assert.equal(seen.email[1].html, "Hi Sam — your Brompton is booked in for 2026-09-18.", "the body must arrive byte for byte");

  assert.equal(out.ok, true);
  assert.equal(out.sent, 2);
  assert.equal(out.failed, 0);
  assert.equal(out.unsent, 0);
  assert.equal(out.dropped, 0);
  // THE LAST-RESULT SENTENCE IS WHAT THE OWNER'S PANEL SHOWS. It is composed
  // from the counts, so a run that sent two must not read as a run that did
  // nothing — this module's own most-recorded defect, one field over.
  assert.match(jobOutcome(out), /2/, `the panel line must say what was sent, got ${JSON.stringify(jobOutcome(out))}`);
});

test("a message missing an address, a subject or a body is dropped and counted", async () => {
  // NOT SENT AND NOT SILENT. Each of these is a plausible thing for a generated
  // SQL function to return, and each must be visible to the owner as a number
  // rather than as a customer who never got their reminder.
  const { deps, seen } = harness({ rows: [
    { to: "ok@example.com", subject: "Due tomorrow", body: "Your bike is booked in for 2026-09-18." },
    { to: "", subject: "Due tomorrow", body: "No address." },
    { to: "nosubject@example.com", subject: "", body: "No subject." },
    { to: "nobody@example.com", subject: "Due tomorrow", body: "" },
    { to: "alex@example.com, evil@example.net", subject: "Due tomorrow", body: "Header injection." },
  ] });
  const out = await runJob(deps, JOB);
  assert.equal(seen.email.length, 1, "only the complete message may be handed over");
  assert.equal(seen.email[0].to, "ok@example.com");
  assert.equal(out.sent, 1);
  assert.equal(out.dropped, 4, "every dropped message must be counted");
  // THE COMMA CASE IS THE ONE THAT MATTERS: two addresses in one field is header
  // injection whoever wrote it, and the recipient rule is the wall.
  assert.equal(seen.email.filter((e) => String(e.to).includes(",")).length, 0);
});

test("a text goes to the SMS sender with the number parsed, and carries no subject", async () => {
  const { deps, seen } = harness({
    rows: [
      { channel: "sms", to: "07700 900123", subject: "ignored", body: "Your bike is due in tomorrow, 18 Sept." },
      { channel: "email", to: "alex@example.com", subject: "Due tomorrow", body: "Booked in for 2026-09-18." },
    ],
    smsKey: { provider: "twilio", key: "k-sms", from: "WORKSHOP" },
  });
  const out = await runJob(deps, JOB);
  assert.equal(seen.sms.length, 1);
  assert.equal(seen.sms[0].to, "+447700900123", "the number must reach the provider in the form it accepts");
  assert.equal(seen.sms[0].body, "Your bike is due in tomorrow, 18 Sept.");
  assert.equal(Object.hasOwn(seen.sms[0], "subject"), false, "a text has no subject, and carrying one puts it in the body on some providers");
  assert.equal(seen.email.length, 1, "the email beside it still goes");
  assert.equal(out.sent, 2);
});

test("a channel with no key HOLDS its messages and says which key is missing", async () => {
  // THE MISSING-KEY CASE, DEMONSTRATED SEPARATELY (owner's instruction). This is
  // what a live run on a site with no key would show — and all it would show,
  // which is why it cannot stand in for the cases above.
  //
  // First: email wanted, no email key. The sender is never reached.
  const noEmail = harness({ rows: [{ to: "alex@example.com", subject: "Due tomorrow", body: "Booked in." }], emailKey: null });
  const a = await runJob(noEmail.deps, JOB);
  assert.equal(noEmail.seen.email.length, 0, "with no key the sender must never be called");
  assert.equal(a.ok, true, "a missing key is not a failure — nothing is broken and nothing was lost");
  assert.equal(a.sent, 0);
  assert.equal(a.reason, "no email provider key in Secrets", "the reason must name the channel, so the owner knows which key to paste");
  assert.equal(noEmail.seen.stamped.length, 1, "the run still claimed its slot");

  // Second: a job that sends BOTH, with only the email key pasted. The emails go
  // and the texts WAIT — `unsent`, never `failed`, or a half-configured site
  // looks broken on every run.
  const half = harness({
    rows: [
      { channel: "email", to: "alex@example.com", subject: "Due tomorrow", body: "Booked in." },
      { channel: "sms", to: "07700 900123", body: "Due tomorrow." },
    ],
    smsKey: null,
  });
  const b = await runJob(half.deps, JOB);
  assert.equal(half.seen.email.length, 1, "the channel that HAS a key still sends");
  assert.equal(half.seen.sms.length, 0);
  assert.equal(b.sent, 1);
  assert.equal(b.failed, 0, "a message waiting on a credential is not a failure");
  assert.equal(b.unsent, 1);
  assert.match(jobOutcome(b), /waiting on a provider key in Secrets/, "the owner must be told the texts are held");
});

test("a provider that refuses is a failure, and is told apart from one that is held", async () => {
  const { deps, seen } = harness({
    rows: [
      { to: "good@example.com", subject: "Due tomorrow", body: "Booked in." },
      { to: "bounce@example.com", subject: "Due tomorrow", body: "Booked in." },
    ],
    sendOk: (p) => p.to !== "bounce@example.com",
  });
  const out = await runJob(deps, JOB);
  assert.equal(seen.email.length, 2, "both were handed over — the refusal is the provider's");
  assert.equal(out.sent, 1);
  assert.equal(out.failed, 1);
  assert.equal(out.unsent, 0, "a refused send is not a held one: one needs looking at, the other needs a key");
});

test("a housekeeping run reports what it did and sends nothing", async () => {
  const { deps, seen } = harness({ rows: { did: "cleared 12 bookings older than 90 days" } });
  const out = await runJob(deps, JOB);
  assert.equal(seen.email.length, 0);
  assert.equal(seen.sms.length, 0);
  assert.equal(out.sent, 0);
  assert.equal(out.did, "cleared 12 bookings older than 90 days", "the function's OWN words, never a number read as rows");
  assert.match(jobOutcome(out), /cleared 12 bookings older than 90 days/);
});

test("nothing due is a clean run, not a broken one", async () => {
  // THE ORDINARY MORNING. A reminder job runs every day and most days has an
  // empty list, so this outcome must read as success — an empty list reported as
  // an error is an owner's panel crying wolf 360 days a year.
  const { deps, seen } = harness({ rows: [] });
  const out = await runJob(deps, JOB);
  assert.equal(seen.email.length, 0);
  assert.equal(out.ok, true);
  assert.equal(out.sent, 0);
  assert.equal(out.reason, undefined, "an empty list is not a reason to explain");
  // AND A FUNCTION THAT RETURNED NOTHING AT ALL IS DIFFERENT FROM ONE THAT
  // RETURNED AN EMPTY LIST — one is broken, the other is a quiet Tuesday.
  const broken = harness({ rows: null });
  const c = await runJob(broken.deps, JOB);
  assert.equal(c.sent, 0);
  assert.match(String(c.reason), /nothing/, "a function that returned nothing must not read as nothing being due");
});

test("the run is claimed before it sends, and a lost claim sends nothing", async () => {
  // THE DOUBLE-SEND WALL. Overlapping cron ticks can both read a job as due; the
  // claim is what stops both mailing the whole batch. `{won:false}` is another
  // tick having got there first OR the claim failing to record — and either way
  // nothing may go out.
  const { deps, seen } = harness({ rows: [{ to: "alex@example.com", subject: "Due tomorrow", body: "Booked in." }], stampWon: false });
  const out = await runJob(deps, JOB);
  assert.equal(seen.email.length, 0, "a run that did not win its claim must send nothing");
  assert.equal(seen.called.length, 0, "and must not even call the function");
  assert.equal(out.skipped, true);
  assert.match(jobOutcome(out), /already/i);
});

test("a hundred is the cap, and the hundred-and-first is REPORTED", async () => {
  const rows = Array.from({ length: MAX_MESSAGES_PER_RUN + 3 }, (_, i) => ({ to: `c${i}@example.com`, subject: "Due tomorrow", body: "Booked in for 2026-09-18." }));
  const { deps, seen } = harness({ rows });
  const out = await runJob(deps, JOB);
  assert.equal(seen.email.length, MAX_MESSAGES_PER_RUN);
  assert.equal(out.overflow, 3, "a job silently capped looks like a job that worked, and the hundred-and-first customer turns up without a reminder");
});

// ── WHICH JOBS A TICK PICKS, ON A FIXED CLOCK ────────────────────────────────
//
// SEPARATE FROM EVERYTHING ABOVE, and separate from the live "Run now" press
// (owner: "Separate persisted schedule/timezone, Run now execution, and
// automatic cron selection. Passing one does not prove the other two"). Run now
// passes `force: true`, which skips the dueness clause entirely — so it proves
// the runner works and says NOTHING about whether a tick would have chosen the
// job. This is where that half is decided.
test("a daily 09:00 job is picked after its time and not before, in its own zone", async () => {
  const row = (last, updated, tz = "Europe/London") => ({
    name: "remind_tomorrow", enabled: true, schedule_minutes: 1440,
    spec: { fn: "bookings_due_tomorrow", at: "09:00", tz },
    last_run: last, updated_at: updated,
  });
  const registered = iso(NOW - 3 * DAY);
  // London is BST (+01:00) on this date, so 09:00 local is 08:00Z — which is NOW
  // exactly. `lastDueAt` is the piece that decides it, and both zones are read
  // so the arithmetic is visible rather than implied by a verdict.
  assert.equal(lastDueAt("09:00", "Europe/London", NOW), NOW, "09:00 London on this date is 08:00Z");
  // NOW is 08:00Z, so 09:00 UTC today is still an hour ahead and the latest
  // occurrence is YESTERDAY'S 09:00Z — which is `NOW - DAY + HOUR`, not
  // `NOW - DAY`. Worth spelling out: the off-by-an-hour is the whole subject of
  // this case, and writing the expectation the lazy way produced it once here.
  assert.equal(lastDueAt("09:00", "UTC", NOW), NOW - DAY + HOUR, "09:00 UTC has not come round yet at 08:00Z, so the latest occurrence is yesterday's 09:00Z");

  // RAN AT YESTERDAY'S OCCURRENCE. A minute before this morning's it must not
  // fire; at it, it must.
  const ranYesterday = iso(NOW - DAY);
  assert.equal(dueJobs([row(ranYesterday, registered)], NOW - MIN).length, 0, "a minute before its time it must not fire");
  assert.equal(dueJobs([row(ranYesterday, registered)], NOW).length, 1, "at its time it must");

  // AND THE ZONE IS LOAD-BEARING, isolated by a case where the two zones
  // DISAGREE. Registered at 08:30Z today — after London's 08:00Z occurrence and
  // before UTC's 09:00Z one — and read at 09:30Z:
  //   London: this morning's occurrence is behind the registration → not due.
  //   UTC:    it is ahead of it                                    → due.
  // Anything less than a disagreeing pair leaves "the zone is read at all"
  // unproven, which is what the first draft of this case got wrong.
  const addedBetween = iso(NOW + 30 * MIN);
  const readAt = NOW + 90 * MIN;
  assert.equal(dueJobs([row(null, addedBetween, "Europe/London")], readAt).length, 0, "added after this morning's London occurrence: it waits for tomorrow");
  assert.equal(dueJobs([row(null, addedBetween, "UTC")], readAt).length, 1, "the same row in UTC is due — the zone really decides");

  // ALREADY RUN THIS MORNING: not due again until tomorrow.
  assert.equal(dueJobs([row(iso(NOW + MIN), registered)], NOW + 2 * MIN).length, 0);
  // REGISTERED AFTER THIS MORNING'S OCCURRENCE and never run: it waits rather
  // than firing on the next tick — a daily 09:00 added at three in the afternoon
  // must not go off immediately.
  assert.equal(dueJobs([row(null, iso(NOW + HOUR))], NOW + 2 * HOUR).length, 0);
  // DISABLED: never, whatever the clock says.
  assert.equal(dueJobs([{ ...row(ranYesterday, registered), enabled: false }], NOW).length, 0);
});

test("a due job and a not-due job are told apart in one tick, stalest first", async () => {
  const mk = (name, mins, last) => ({ name, enabled: true, schedule_minutes: mins, spec: { fn: "f" }, last_run: last, updated_at: iso(NOW - 30 * DAY) });
  const picked = dueJobs([
    mk("ran_a_minute_ago", 60, iso(NOW - MIN)),          // not due: hourly, ran a minute ago
    mk("ran_two_hours_ago", 60, iso(NOW - 2 * HOUR)),    // due
    mk("never_run", 60, null),                            // due, and the stalest there is
    mk("ran_a_day_ago", 60, iso(NOW - DAY)),             // due
  ], NOW);
  assert.deepEqual(picked.map((r) => r.name), ["never_run", "ran_a_day_ago", "ran_two_hours_ago"],
    "the not-due job must be left out, and the rest ordered by how long each has waited");
});
