// THE TALK PRESS'S OWN CHECKS (2026-10-14): scripts/canary-talk.mjs, the
// two scenarios that carry them (`acc-mixed`, `acc-mixed-talk`), and where
// the press reads the switch. The owner: *"Prepare verification of
// PROGRESS_TALK itself: model-written first-person updates during work,
// correct task attribution and ordering, persistence after reconnect,
// explanations and final replies grounded in each task's evidence … don't
// assume its live state from an unset-secret fallback."* Each check has a
// passing control beside the failure it must catch.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { talkSwitchVerdict, mergeSeen, firstPerson, ungrounded, talkChecks } from "../scripts/canary-talk.mjs";
import { UI_SCENARIOS, BALANCE_OPT_IN } from "../scripts/canary-ui.mjs";
import { requestBatchVerdict } from "../scripts/canary-requests.mjs";
import { BUILD_CHECK_NO_IMAGES, BUILD_BALANCE_OPT_IN } from "../scripts/canary-build.mjs";

const ON = { progressReplies: true, progressTalk: true, jobProgressReplies: true, jobProgressTalk: true };
const OFF = { progressReplies: true, progressTalk: false, jobProgressReplies: true, jobProgressTalk: false };
const rt = (json, status = 200) => ({ status, json });
const CLEAN = { compiled: true, published: true, browser: { ran: true, pages: 1, findings: [] } };
const FLAGGED = { compiled: true, published: true, browser: { ran: true, pages: 1, findings: [{ kind: "blank", route: "/bulk-orders" }] } };
const UNPUBLISHED = { compiled: true, published: false, browser: { ran: false } };

const A = "aaaaaaaa11112222333344445555";
const B = "bbbbbbbb11112222333344445555";
const lineA1 = { job: A, n: 1, ms: 100, text: "I'm writing the Bulk Orders page now." };
const lineA2 = { job: A, n: 2, ms: 900, text: "I've put the page up.", explain: "I published it and a browser opened the page; nothing was flagged." };
const lineB1 = { job: B, n: 1, ms: 200, text: "I'm changing the Olive & Rosemary's price." };
const part = (n, ids, progress) => ({ n, ids, jobs: ids, status: "done", progress });
const viewOf = (parts) => ({ key: "k1", status: "done", parts });
const answer = (job, res) => ({ final: true, path: `/api/site/edit/${job}`, ms: 1000, res });
const reply = (text, checks) => ({ replySource: "model", reply: text, checks });

/** A press that went right: two jobs, each speaking on its own part, every line kept. */
function good({ finalParts, early, network, talkSwitch } = {}) {
  const parts = finalParts || [part(0, [A], [lineA1, lineA2]), part(1, [B], [lineB1])];
  let seen = mergeSeen(null, viewOf(early || [part(0, [A], [lineA1]), part(1, [B], [lineB1])]), 300);
  seen = mergeSeen(seen, viewOf(parts), 1200);
  const steps = [{ n: 1, sent: true, request: { key: "k1", final: viewOf(parts), seen }, network: network || [answer(A, reply("I added the Bulk Orders page and published it.", CLEAN)), answer(B, reply("I changed the price to £5.90.", CLEAN))] }];
  return talkChecks({ steps, talkSwitch: talkSwitch === undefined ? talkSwitchVerdict(rt(ON), true) : talkSwitch });
}
const failed = (checks) => checks.filter((c) => !c.ok).map((c) => c.name);
const failsOn = (checks, frag) => {
  const f = checks.filter((c) => !c.ok);
  assert.equal(f.length, 1, `exactly one check fails: ${JSON.stringify(f)}`);
  assert.match(f[0].name, frag);
  assert.ok(f[0].why, "a failure names what was found");
  return f[0];
};

test("CONTROL — a press that went right passes every talk check, and there are eight of them", () => {
  const c = good();
  assert.equal(c.length, 8);
  assert.deepEqual(failed(c), []);
});

// ── THE SWITCH ────────────────────────────────────────────────────────────

test("the switch: all four read true is on; any one false is not on", () => {
  assert.equal(talkSwitchVerdict(rt(ON), true).ok, true);
  for (const k of Object.keys(ON)) {
    const v = talkSwitchVerdict(rt({ ...ON, [k]: false }), true);
    assert.equal(v.ok, false, k);
    assert.ok(!v.unverified, `${k} false is a reading, not cannot-tell`);
    assert.match(v.why, new RegExp(k));
  }
});

test("the switch: a field the route does not report is cannot-tell — never taken as off or on", () => {
  for (const k of Object.keys(ON)) {
    const { [k]: _gone, ...rest } = ON;
    for (const want of [true, false]) {
      const v = talkSwitchVerdict(rt(rest), want);
      assert.equal(v.ok, false, `${k} missing, want ${want}`);
      assert.equal(v.unverified, true);
      assert.match(v.why, /never taken as a reading/);
    }
    // A STRING IS NOT A BOOLEAN: "on" is the secret's spelling, not the route's answer.
    assert.equal(talkSwitchVerdict(rt({ ...ON, [k]: "on" }), true).unverified, true);
  }
  for (const r of [null, rt(null), rt(ON, 401), rt(ON, 503)]) {
    const v = talkSwitchVerdict(r, true);
    assert.equal(v.ok, false); assert.equal(v.unverified, true);
  }
});

test("the restore: talk false in the Worker and the job is off; either still true is not", () => {
  assert.equal(talkSwitchVerdict(rt(OFF), false).ok, true);
  assert.equal(talkSwitchVerdict(rt({ ...OFF, progressReplies: false, jobProgressReplies: false }), false).ok, true, "replies off too is still talk off");
  assert.match(talkSwitchVerdict(rt({ ...OFF, progressTalk: true }), false).why, /still on: progressTalk/);
  assert.match(talkSwitchVerdict(rt({ ...OFF, jobProgressTalk: true }), false).why, /still on: jobProgressTalk/);
});

test("talkChecks: no switch reading, or a failed one, fails the first check with its reason", () => {
  failsOn(good({ talkSwitch: null }), /PROGRESS_TALK read on/);
  const f = failsOn(good({ talkSwitch: talkSwitchVerdict(rt({ ...ON, jobProgressTalk: false }), true) }), /PROGRESS_TALK read on/);
  assert.match(f.why, /jobProgressTalk false/);
});

// ── THE LINES ─────────────────────────────────────────────────────────────

test("a part with no lines fails; a press that sent nothing fails", () => {
  failsOn(good({ finalParts: [part(0, [A], [lineA1, lineA2]), part(1, [B], [])], early: [part(0, [A], [lineA1])] }), /every part has model-written progress lines/);
  const none = talkChecks({ steps: [{ n: 1, sent: false }], talkSwitch: talkSwitchVerdict(rt(ON), true) });
  assert.deepEqual(failed(none), ["a message was sent and its request read"]);
});

test("first person: 'I' and 'we' pass; the builder spoken of in the third person fails", () => {
  for (const t of ["I'm writing it.", "I've checked the page.", "Now I'll publish.", "We're nearly there.", "Putting my changes live."]) assert.ok(firstPerson(t), t);
  for (const t of ["The builder is writing the page.", "Writing the Bulk Orders page.", "Iceland's bakers ordered bread."]) assert.equal(firstPerson(t), false, t);
  const third = { ...lineB1, text: "The builder is changing the price." };
  failsOn(good({ finalParts: [part(0, [A], [lineA1, lineA2]), part(1, [B], [third])], early: [part(0, [A], [lineA1]), part(1, [B], [third])] }), /first person/);
});

test("attribution: a job's line on another part, or on a part that did not file it, fails", () => {
  // job A's second line drawn on part 1 as well
  const crossed = [part(0, [A], [lineA1, lineA2]), part(1, [B], [lineB1, lineA2])];
  // (the same line drawn on a second part is also a change between reads)
  assert.ok(failed(good({ finalParts: crossed })).some((n) => /own part only/.test(n)));
  // job B's line on a part whose ids name only A
  const foreign = [part(0, [A], [lineA1, lineA2, lineB1])];
  const c = good({ finalParts: foreign, early: [part(0, [A], [lineA1, lineB1])] });
  assert.ok(failed(c).some((n) => /own part only/.test(n)), JSON.stringify(failed(c)));
});

test("ordering: a job's lines numbered out of order, or later-numbered but earlier in time, fail", () => {
  failsOn(good({ finalParts: [part(0, [A], [lineA2, lineA1]), part(1, [B], [lineB1])] }), /in order/);
  failsOn(good({ finalParts: [part(0, [A], [lineA1, { ...lineA2, ms: 50 }]), part(1, [B], [lineB1])] }), /in order/);
  // NUMBERING ALONE: same time, numbers reversed (the time check cannot see it)
  failsOn(good({ finalParts: [part(0, [A], [{ ...lineA2, ms: 100 }, lineA1]), part(1, [B], [lineB1])] }), /in order/);
  // CONTROL: two jobs interleaved in time is not disorder
  assert.deepEqual(failed(good({ finalParts: [part(0, [A], [lineA1, { ...lineA2, ms: 150 }]), part(1, [B], [lineB1])] })), []);
});

// ── PERSISTENCE ACROSS THE RECONNECT ─────────────────────────────────────

test("mergeSeen keeps each line as first seen and records any later difference", () => {
  let s = mergeSeen(null, viewOf([part(0, [A], [lineA1])]), 10);
  assert.equal(s.reads, 1);
  assert.equal(s.lines[`${A}#1`].text, lineA1.text);
  s = mergeSeen(s, viewOf([part(0, [A], [lineA1])]), 20);
  assert.deepEqual(s.changed, [], "the same line again is not a change");
  s = mergeSeen(s, viewOf([part(0, [A], [{ ...lineA1, text: "I wrote it." }])]), 30);
  assert.equal(s.lines[`${A}#1`].text, lineA1.text, "the first sighting is kept");
  assert.equal(s.changed.length, 1);
  assert.equal(s.changed[0].now.text, "I wrote it.");
});

test("persistence: a line seen during the work and gone at the end fails", () => {
  const early = [part(0, [A], [lineA1, { job: A, n: 2, ms: 400, text: "I'm checking it in a browser." }]), part(1, [B], [lineB1])];
  const finalParts = [part(0, [A], [lineA1]), part(1, [B], [lineB1])];
  const f = failsOn(good({ early, finalParts }), /kept, unchanged, after the reconnect/);
  assert.match(f.why, /gone/);
});

test("persistence: a line reworded between reads fails, even if the end is self-consistent", () => {
  const early = [part(0, [A], [{ ...lineA1, text: "I'm drafting the page." }]), part(1, [B], [lineB1])];
  const f = failsOn(good({ early }), /kept, unchanged/);
  assert.match(f.why, /changed between reads/);
});

test("persistence: a line reworded and then put back is still a change — the last read alone cannot see it", () => {
  let seen = mergeSeen(null, viewOf([part(0, [A], [lineA1]), part(1, [B], [lineB1])]), 300);
  seen = mergeSeen(seen, viewOf([part(0, [A], [{ ...lineA1, text: "I'm drafting it." }]), part(1, [B], [lineB1])]), 600);
  const parts = [part(0, [A], [lineA1, lineA2]), part(1, [B], [lineB1])];
  seen = mergeSeen(seen, viewOf(parts), 1200);
  const steps = [{ n: 1, sent: true, request: { key: "k1", final: viewOf(parts), seen }, network: [answer(A, reply("I added the Bulk Orders page and published it.", CLEAN)), answer(B, reply("I changed the price to £5.90.", CLEAN))] }];
  const f = failsOn(talkChecks({ steps, talkSwitch: talkSwitchVerdict(rt(ON), true) }), /kept, unchanged/);
  assert.match(f.why, /changed between reads/);
  assert.doesNotMatch(f.why, /altered/);
});

test("persistence: no line seen during the work is not a pass", () => {
  const steps = [{ n: 1, sent: true, request: { key: "k1", final: viewOf([part(0, [A], [lineA1, lineA2]), part(1, [B], [lineB1])]), seen: { lines: {}, changed: [] } }, network: [answer(A, reply("I added it and published it.", CLEAN)), answer(B, reply("I changed it.", CLEAN))] }];
  const f = failsOn(talkChecks({ steps, talkSwitch: talkSwitchVerdict(rt(ON), true) }), /kept, unchanged/);
  assert.match(f.why, /no line was seen/);
});

// ── GROUNDED IN EACH JOB'S OWN EVIDENCE ─────────────────────────────────

test("ungrounded: each claim held to the checks; no claim needs none", () => {
  assert.equal(ungrounded("I changed the price.", null), "");
  assert.equal(ungrounded("I published it and a browser opened the page; nothing was flagged.", CLEAN), "");
  assert.match(ungrounded("It's live now.", UNPUBLISHED), /not published/);
  assert.match(ungrounded("A browser opened the page.", UNPUBLISHED), /none ran/);
  assert.match(ungrounded("Nothing was flagged.", FLAGGED), /not clean/);
  assert.match(ungrounded("It's live now.", { published: true }), /no readable checks/);
});

test("an explanation that claims more than its own job's checks fails — another job's evidence does not rescue it", () => {
  // A's explanation says it is live and clean; A's own checks say unpublished; B's are clean
  const network = [answer(A, reply("I added the page.", UNPUBLISHED)), answer(B, reply("I changed the price.", CLEAN))];
  const f = failsOn(good({ network }), /every explanation claims only/);
  assert.match(f.why, new RegExp(A.slice(0, 8)));
});

test("a final reply that is not the model's, or claims what its checks do not hold, fails", () => {
  const composed = [answer(A, { replySource: "composed", reply: "Done.", checks: CLEAN }), answer(B, reply("I changed the price.", CLEAN))];
  assert.match(failsOn(good({ network: composed }), /final reply is model-written/).why, /no model-written final reply/);
  const missing = [answer(A, reply("I added the page and published it.", CLEAN))];
  assert.match(failsOn(good({ network: missing }), /final reply is model-written/).why, new RegExp(B.slice(0, 8)));
  const overclaim = [answer(A, reply("I added the page and published it.", CLEAN)), answer(B, reply("I changed the price and nothing was flagged.", FLAGGED))];
  assert.match(failsOn(good({ network: overclaim }), /final reply is model-written/).why, /not clean/);
});

// ── THE SCENARIOS AND THE WIRING ────────────────────────────────────────

test("acc-mixed now carries the reconnect and the progress checks; acc-mixed-talk is the same press with talk", () => {
  const a = UI_SCENARIOS["acc-mixed"], t = UI_SCENARIOS["acc-mixed-talk"];
  assert.equal(a.steps.length, 1);
  assert.equal(a.steps[0].away, "fresh");
  assert.equal(a.expect.progress, true);
  assert.ok(a.covers.includes("progress-each-part") && a.covers.includes("closed-tab"));
  assert.equal(a.expect.talk, undefined, "acc-mixed does not need the talk switch");
  assert.equal(t.expect.talk, true);
  const { expect: ea, ...ra } = a, { expect: et, ...rt_ } = t;
  assert.deepEqual(rt_, ra, "everything but the talk expectation is acc-mixed's");
  const { talk: _t, ...etRest } = et;
  assert.deepEqual(etRest, { ...ea });
  assert.equal(t.images, "none");
});

test("the paid opt-ins stay closed: no scenario and no Build mode can spend until the owner names it", () => {
  assert.deepEqual([...BALANCE_OPT_IN], []);
  assert.deepEqual([...BUILD_BALANCE_OPT_IN], []);
});

test("the image-free Build check names a fresh slug, never run 117's site", () => {
  assert.equal(BUILD_CHECK_NO_IMAGES.slug, "saltmarsh-cheese-lewes");
  const wf = readFileSync(new URL("../.github/workflows/build-as-owner.yml", import.meta.url), "utf8");
  assert.ok(!wf.includes("saltmarsh-cheese-counter"), "the form names the slug the press uses");
  assert.ok(wf.includes("saltmarsh-cheese-lewes"));
});

test("requestBatchVerdict adds the talk checks only for a press that asks", () => {
  const base = { before: null, after: null, served: {}, beforeServed: {}, steps: [] };
  const withTalk = requestBatchVerdict({ ...base, spec: { expect: { talk: true } }, talkSwitch: null });
  assert.ok(withTalk.checks.some((c) => /PROGRESS_TALK read on/.test(c.name) && !c.ok));
  const without = requestBatchVerdict({ ...base, spec: { expect: {} } });
  assert.ok(!without.checks.some((c) => /PROGRESS_TALK/.test(c.name)));
});

test("the press reads the switch before the rehearsal stop and records each view's lines", () => {
  const src = readFileSync(new URL("../scripts/canary-ui.mjs", import.meta.url), "utf8");
  const read = src.indexOf("rec.talkSwitch = talkSwitchVerdict(rt, true)");
  const rehearsal = src.indexOf("ui-step-${n}-rehearsal");
  assert.ok(read > 0 && rehearsal > 0, "both landmarks exist");
  assert.ok(read < rehearsal, "the switch is read before a rehearsal stops, so a free press reports it");
  const gate = src.slice(src.lastIndexOf("\n", read - 400), read + 200);
  assert.match(gate, /scenario\.expect\.talk === true/);
  assert.match(src.slice(read, read + 200), /if \(!rec\.talkSwitch\.ok\) \{ stop\(/);
  const nv = src.indexOf("const noteView = (r, view) => {");
  assert.ok(nv > 0);
  assert.match(src.slice(nv, nv + 600), /r\.request\.seen = mergeSeen\(r\.request\.seen, view/);
  const ec = readFileSync(new URL("../scripts/edit-canary.mjs", import.meta.url), "utf8");
  assert.match(ec, /talkSwitch: ui\.talkSwitch \|\| null/);
});
