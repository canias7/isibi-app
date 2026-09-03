// Can the owner tell what their scheduled work actually did?
//
// `runJob` has always computed an honest four-way outcome and every caller threw
// it into a Cloudflare log, which is not a surface a small business has. So from
// the owner's side "sent 14 reminders", "the SQL is broken", "you never pasted a
// mail key" and "nothing was due" were ONE SILENCE — and for a reminder that is
// the worst failure shape there is, because the customer does not know they were
// meant to get one either. The only symptom is a no-show months later that looks
// like ordinary business.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { jobOutcome, MAX_MESSAGES_PER_RUN } from "../site-jobs.mjs";

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const chat = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");

test("THE FOUR OUTCOMES DO NOT READ ALIKE — the whole requirement", () => {
  const cases = {
    nothingDue: { ok: true, sent: 0, dropped: 0 },
    fnBroken: { ok: true, sent: 0, reason: "returned nothing" },
    noKey: { ok: true, sent: 0, reason: "no provider key in Secrets" },
    sent: { ok: true, sent: 12 },
    threw: { ok: false, reason: "threw", error: "relation bookings does not exist" },
    // A lost overlap claim. The runner never stores this one (the winner's
    // outcome is the record), but if it is ever shown it must read as the
    // system working — not as a failure, and not as a quiet Tuesday.
    skipped: { ok: true, skipped: true },
  };
  const said = Object.fromEntries(Object.entries(cases).map(([k, v]) => [k, jobOutcome(v)]));
  const all = Object.values(said);
  assert.equal(new Set(all).size, all.length, "two outcomes produce the same sentence: " + all.join(" | "));
  for (const [k, v] of Object.entries(said)) assert.ok(v && v.length > 8, k + " said almost nothing: " + v);
  assert.equal(/Failed|Couldn’t run|Nothing to send/.test(said.skipped), false,
    "a lost claim reads as a failure or a quiet day: " + said.skipped);
});

test("a broken function is NOT reported as a quiet Tuesday", () => {
  // The distinction that matters most. `returned nothing` means the model's SQL
  // gave back null or a shape that is not a list — broken on every run — while
  // an empty list is a genuine "nobody is due today".
  const quiet = jobOutcome({ ok: true, sent: 0, dropped: 0 });
  const broken = jobOutcome({ ok: true, sent: 0, reason: "returned nothing" });
  assert.match(quiet, /Nothing to send/);
  assert.match(broken, /didn’t return a list/);
  assert.notEqual(quiet, broken);
  // …and both spellings of broken say the same thing, since the customer does
  // not care whether it was null or an object.
  assert.equal(broken, jobOutcome({ ok: true, sent: 0, reason: "returned not a list" }));
});

test("A RUN THAT FAILED READS AS A FAILURE, not as nearly-working", () => {
  // FOUND BY MUTATION, and distinctness alone could not see it. With the
  // `ok === false` branch dead, a job that CRASHED falls through to the success
  // path and comes out as "Ready to send, but threw." — a different sentence
  // from every other outcome, so the "all five differ" check stayed green, and
  // it reads like the mail-key case: one small thing away from working. It is
  // not; the SQL is broken and nothing will ever be sent.
  for (const out of [
    { ok: false, reason: "threw", error: "relation bookings does not exist" },
    { ok: false, reason: "no function" },
  ]) {
    const s2 = jobOutcome(out);
    assert.match(s2, /^(Failed|Couldn’t run)/, "a failure does not announce itself: " + s2);
    assert.equal(/Ready to send|Nothing to send/.test(s2), false,
      "a failure reads as a working job: " + s2);
  }
  // And the reason survives, or the owner is told it broke and not how.
  assert.match(jobOutcome({ ok: false, reason: "threw", error: "relation bookings does not exist" }),
    /relation bookings does not exist/);
});

test("the mail-key gate says what to DO about it", () => {
  // A site whose owner has pasted no provider key runs the job and sends
  // nothing, by design. Reported as "nothing to send" that is indistinguishable
  // from working.
  const s = jobOutcome({ ok: true, sent: 0, reason: "no provider key in Secrets" });
  assert.match(s, /Secrets/, "the sentence does not point at the thing to fix");
  assert.match(s, /Ready to send/, "it reads as nothing being due rather than as a missing key");
});

test("a capped or partly-failed run says so", () => {
  // Reported, never silent: a job quietly capped looks like a job that worked,
  // and the hundred-and-first customer is the one with no reminder.
  const over = jobOutcome({ ok: true, sent: MAX_MESSAGES_PER_RUN, overflow: 40 });
  assert.match(over, new RegExp("40 more"), over);
  assert.match(over, new RegExp(String(MAX_MESSAGES_PER_RUN) + "-per-run"), over);
  assert.match(jobOutcome({ ok: true, sent: 9, failed: 3 }), /3 messages failed/);
  assert.match(jobOutcome({ ok: true, sent: 0, dropped: 2 }), /missing an address/);
});

test("NO RECIPIENT EVER REACHES THE SENTENCE", () => {
  // It is stored in a platform table beside every other site's. Counts and
  // reasons carry what the owner needs; a customer's address in a second place
  // is a worse problem than the one being solved. Same discipline as the audit
  // log's allow-list.
  const hostile = {
    ok: true, sent: 1, to: "mrs.patel@example.com", subject: "Tomorrow at 2",
    messages: [{ to: "mrs.patel@example.com" }], reason: "no provider key in Secrets",
  };
  const s = jobOutcome(hostile);
  for (const secret of ["patel", "example.com", "Tomorrow at 2"])
    assert.ok(!s.toLowerCase().includes(secret.toLowerCase()), "leaked: " + secret + " in " + s);
});

test("junk in cannot throw — this runs on a cron", () => {
  for (const bad of [null, undefined, 7, "sent", [], {}])
    assert.equal(typeof jobOutcome(bad), "string", "threw or answered oddly on " + JSON.stringify(bad));
});

test("IT IS RECORDED WHERE THE OWNER CAN REACH IT, after the run", () => {
  // The stamp goes FIRST and must keep going first — stamped afterwards, a job
  // that dies mid-send is due again on the next tick and mails everyone it
  // already reached. Losing this note costs a line of history; moving the stamp
  // costs somebody four copies of the same reminder.
  const at = worker.indexOf("async function runScheduledSiteJobs");
  assert.ok(at > 0, "the cron moved — retarget this");
  const block = worker.slice(at, worker.indexOf("\n}", worker.indexOf("jobOutcome(out)", at)));
  const stamp = block.indexOf("last_run");
  const note = block.indexOf("last_result");
  assert.ok(stamp > 0 && note > 0, "one of the two writes is gone");
  assert.ok(stamp < note, "the outcome is written before the stamp — that ordering re-sends reminders");
  assert.match(block, /jobOutcome\(out\)/, "the outcome is computed and discarded again");
});

// The jb handler, landmark-bounded — never a byte count. Both of these windows
// were `at + 1800` and went red the day the handler grew a POST branch: the
// gate had not moved, the declarations in front of it had (this file's
// recurring own-goal, recorded against api-auth twice already).
const jbBlock = () => {
  const at = worker.indexOf('} else if (jb) {');
  assert.ok(at > 0, "no handler");
  // To the NEXT branch, whichever it is — this was pinned to `nt` and went red
  // the day the backups branch landed between them: a landmark that names its
  // neighbour is a fact about ordering, the renumbering trap one shape over.
  const end = worker.indexOf("} else if (", at + 1);
  assert.ok(end > at, "no branch after the jb handler — rescope this");
  return worker.slice(at, end);
};

test("THE OWNER'S ROUTE EXISTS, IS DISPATCHED, AND IS OWNER-GATED", () => {
  // Three separate places, because this repo has shipped an owner route that
  // was matched and never dispatched (`dm2`, custom domains — unreachable end
  // to end while looking perfectly gated).
  assert.match(worker, /const jb = url\.pathname\.match\(/, "no matcher");
  // MEMBERSHIP, not position — these pinned `jb` as the LAST entry and went
  // red when the backups matcher joined the list after it. A pin on where a
  // name sits in a list is a fact about ordering, the renumbering trap.
  assert.match(worker, /\|\| jb\b[^)\n]*\) \{/, "the matcher is not in the dispatch condition");
  assert.match(worker, /\|\| jb\b[^)\n]*\)\[1\]\.toLowerCase\(\)/, "ownerSlug does not include it");
  const h = jbBlock();
  assert.match(h, /assertOwner\(ownerDeps, jslug, ou\.id\)/, "the handler does not check ownership");
  assert.match(h, /method !== "GET"/, "an unrecognised method must be refused, not read as the list");
  assert.match(h, /status: 503/, "an unreadable list answers as an empty one");
});

test("AN UNREADABLE LIST IS NOT AN EMPTY ONE, at both ends", () => {
  // "No scheduled jobs" reads as the feature not existing and the owner stops
  // looking — the one wrong answer here that costs something.
  const h = jbBlock();
  assert.match(h, /if \(!q\.ok\) return Response\.json\(\{ error: "unavailable" \}/);
  assert.match(h, /if \(!Array\.isArray\(jrows\)\)/, "a non-array body reads as zero jobs");
  const c = chat.indexOf("async function siteFunctions(site)");
  assert.ok(c > 0, "the panel is gone");
  // LANDMARK TO LANDMARK, not a byte count (the recorded trap; this was
  // `c + 6400` and went red on 2026-09-03 when the Run now button's handler
  // landed above the toggle's).
  const panel = chat.slice(c, chat.indexOf("async function siteFiles(", c));
  assert.match(panel, /if \(!r\.ok\)/, "the client treats a failed load as an empty schedule");
  assert.match(panel, /Hasn\\u2019t run yet|Hasn’t run yet/,
    "a job that has never run is given an invented outcome");
});

test("THE OFF SWITCH: POST {name, enabled} exists, refuses junk, and cannot lie", () => {
  // The audit's finding was not that the toggle was missing a nicety — it was
  // that NO path in the product could stop a scheduled job: _meta.jobs is a
  // union-merge nothing removes an entry from, the rules lane's CLEARABLE is
  // exactly confirm/sms, and nothing anywhere wrote enabled:false. The runner
  // has filtered `enabled=is.true` all along; this is the write that flag was
  // waiting for.
  const h = jbBlock();
  // A REAL BOOLEAN, nothing merely truthy — `enabled: "false"` would switch a
  // job ON while the owner was switching it off (the normalizeRole lesson, on
  // the field that sends mail).
  assert.match(h, /typeof \(jbody && jbody\.enabled\) !== "boolean"/, "enabled is accepted truthy");
  // Owner-scoped AND schedule-scoped: slug alone crosses tenants the day a
  // freed slug is re-claimed, and a row with no schedule is not a job.
  assert.match(h, /site_functions\?owner_id=eq\.[^`]*&name=eq\.[^`]*&schedule_minutes=not\.is\.null/,
    "the toggle's filter lost a scope");
  // Zero rows matched must be a 404, not an ok — a toggle that reports success
  // while switching nothing is this file's most-recorded failure, on the one
  // control whose whole point is stopping mail.
  assert.match(h, /Prefer: "return=representation"/, "the PATCH cannot see whether it matched anything");
  assert.match(h, /if \(!Array\.isArray\(wr\) \|\| !wr\.length\) return Response\.json\(\{ error: "no such job" \}, \{ status: 404 \}\)/,
    "a name matching nothing reports success");

  // And the client half: the badge IS the button, it posts the OPPOSITE of the
  // server's last answer, and it repaints by reloading rather than optimism.
  const c = chat.indexOf("async function siteFunctions(site)");
  // LANDMARK TO LANDMARK, not a byte count (the recorded trap; this was
  // `c + 6400` and went red on 2026-09-03 when the Run now button's handler
  // landed above the toggle's).
  const panel = chat.slice(c, chat.indexOf("async function siteFiles(", c));
  assert.match(panel, /fn-tgl/, "the switch is gone from the panel");
  assert.match(panel, /method: 'POST'[^}]*\/jobs'|\/jobs',\s*\{ method: 'POST'/, "nothing posts to the jobs route");
  assert.match(panel, /JSON\.stringify\(\{ name: b\.dataset\.job, enabled: next \}\)/, "the toggle does not send name+enabled");
  // The OPPOSITE of the server's last answer. A spelling pin, deliberately:
  // an inversion here is pure semantics a derived read cannot hold, and the
  // render harness that drives the click is not in `npm test`.
  assert.match(panel, /const next = b\.dataset\.on !== '1';/, "the toggle sends the state it already has");
  assert.match(panel, /if \(!r\.ok\)[^\n]*sbToast/, "a refused toggle is silent");
  // The RELOAD after a successful toggle — anchored on `return; }` so the
  // panel's own initial `load();` (inside this same window) cannot satisfy it.
  assert.match(panel, /return; \}\s*\n\s*load\(\);/, "the panel does not repaint from the server's answer");
  // And the two states carry the dataset the handler reads.
  assert.match(panel, /fn-tgl fn-off" data-job="[^"]*" data-on=""/, "the paused state lost its dataset");
  assert.match(panel, /fn-tgl" data-job="[^"]*" data-on="1"/, "the running state lost its dataset");
});

test("THE PANEL IS REACHABLE — the card is not forced Off", () => {
  // `versions` sat in DEAD_PANELS for four days after its route shipped, live on
  // the server and unreachable in the product. The comment above that list says
  // to flip a name out the moment its route exists; this is that.
  assert.equal(/functions:\s*'/.test(chat), false, "the jobs card is still in DEAD_PANELS");
  assert.match(chat, /'Scheduled jobs'/, "the card was not renamed off the deleted verb runner");
  assert.match(chat, /'\/api\/site\/' \+ encodeURIComponent\(slug\) \+ '\/jobs'/, "the panel calls the wrong route");
  // And nothing describes the eight-verb runner any more.
  const c = chat.indexOf("async function siteFunctions(site)");
  const panel = chat.slice(c, c + 4200);
  for (const gone of ["spec.steps", "stepLabel", "fn-hook-url"])
    assert.equal(panel.includes(gone), false, panel.slice(0, 0) + gone + " is a relic of the deleted runner");
});
