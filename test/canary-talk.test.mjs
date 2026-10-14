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
import { talkSwitchVerdict, mergeSeen, firstPerson, ungrounded, talkChecks, talkVerdict, claimsIn, groundingOf } from "../scripts/canary-talk.mjs";
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
  const f = failsOn(good({ network }), /claims nothing its own job's checks contradict/);
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

test("the paid opt-ins admit exactly the two approved runs, and nothing else (open for one run each, 2026-10-14)", () => {
  assert.deepEqual([...BALANCE_OPT_IN], ["acc-mixed-talk"]);
  assert.deepEqual([...BUILD_BALANCE_OPT_IN], ["check-no-images"]);
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

// ── NEGATION, INTENT, UNCERTAINTY AND COMPLETION (2026-10-14, after the
// owner reproduced three false rejections: a truthful "not yet", "could not"
// or "I'll … next" was read as a claim of the thing done). Varied natural
// wording, none of it a fixed phrase the model must use.

const NOT_YET = { compiled: true, published: false, browser: { ran: false } };

test("TRUTHFUL LIMITATIONS pass against evidence that says unpublished and no browser check — the owner's three, and more wordings", () => {
  for (const t of [
    "I haven’t published this yet.",
    "The browser check could not run.",
    "I’ll run the browser check next.",
    "Nothing's live yet — I'm still putting the page together.",
    "The page isn't published, and the browser check didn't get to run.",
    "I wasn't able to run the browser check this time.",
    "Once it's ready I'll publish it and open the pages in a browser.",
    "Next up: publishing, then the automated check.",
    "If the build passes, I'll put it live.",
    "I'm going to publish once the check is done.",
    "No browser check ran, so I can't say how the page loads.",
    "Publishing failed, so the site still shows the old version.",
    "I couldn't confirm there were no problems.",
    "I haven't been able to publish or check it in a browser yet.",
    "We're yet to publish.",
  ]) assert.equal(ungrounded(t, NOT_YET), "", t);
});

test("HEDGED wording is not a completion claim: it is neither held as true nor failed", () => {
  for (const t of ["It should go live in a minute or two.", "I think the browser check will be fine.", "It may already be published — I'm checking.", "Whether the browser check ran, I can't tell yet."]) {
    assert.equal(ungrounded(t, NOT_YET), "", t);
    assert.ok(claimsIn(t).length > 0 && claimsIn(t).every((c) => c.mode !== "affirmed"), `${t}: ${JSON.stringify(claimsIn(t))}`);
  }
});

test("each mention is given the mode its own clause says it in", () => {
  const modes = (t) => claimsIn(t).map((c) => `${c.topic}:${c.mode}`);
  assert.deepEqual(modes("I haven't published it."), ["published:negated"]);
  assert.deepEqual(modes("I'll publish it next."), ["published:intended"]);
  assert.deepEqual(modes("It should be live soon."), ["published:intended"]);
  assert.deepEqual(modes("It might be live."), ["published:hedged"]);
  assert.deepEqual(modes("It's live."), ["published:affirmed"]);
  // a later clause without its own subject carries on the clause before it…
  assert.deepEqual(modes("I'll publish it and open the pages in a browser."), ["published:intended", "browser:intended"]);
  // …and one with its own subject reads its own grammar
  assert.deepEqual(modes("I'll publish it soon, and the browser check found no problems."), ["published:intended", "browser:affirmed", "clean:affirmed"]);
  // "nothing was flagged" is affirmative though it holds a negative word
  assert.deepEqual(modes("Nothing was flagged."), ["clean:affirmed"]);
});

test("UNSUPPORTED AFFIRMATIVE CLAIMS are still rejected, in varied wording", () => {
  for (const t of ["It's live now.", "I've published the Bulk Orders page.", "The page went live a moment ago.", "A browser opened the page and nothing was flagged.", "Everything looks good and it's live.", "Done — it's published."]) {
    assert.notEqual(ungrounded(t, NOT_YET), "", t);
  }
});

test("MIXED sentences: a truthful limitation does not excuse a false success beside it", () => {
  for (const t of [
    "I haven't changed the menu yet, but the page is live.",
    "The menu link isn't there yet; the browser check found no problems.",
    "Not finished with the price, though I've published the page.",
    "I couldn't add the link, but everything else is published and the browser check came back clean.",
    "It isn't perfect yet: it's live, though.",
  ]) assert.notEqual(ungrounded(t, NOT_YET), "", t);
  // the false half is what is named
  assert.match(ungrounded("I haven't run the browser check, but it's live.", NOT_YET), /not published/);
  assert.match(ungrounded("I haven't published it, but the browser check found no problems.", NOT_YET), /none ran/);
});

test("affirmed claims the evidence holds pass; a clean claim against findings fails, an honest report of them passes", () => {
  const CLEAN_K = { compiled: true, published: true, browser: { ran: true, pages: 2, findings: [] } };
  const FOUND = { compiled: true, published: true, browser: { ran: true, pages: 1, findings: [{ kind: "blank", route: "/bulk-orders" }] } };
  assert.equal(ungrounded("It's live, and the automated check found no problems.", CLEAN_K), "");
  assert.equal(ungrounded("I put it live and opened both pages in a browser.", CLEAN_K), "");
  assert.match(ungrounded("It's live and the browser check found nothing wrong.", FOUND), /not clean/);
  assert.equal(ungrounded("It's live; the browser check flagged a page that shows nothing.", FOUND), "");
});

test("DURING THE WORK, eventual success is not proof: a completion claim the final checks hold is unverified in time, never passed or failed on it", () => {
  const FINAL = { compiled: true, published: true, browser: { ran: true, pages: 1, findings: [] } };
  const g = groundingOf("I've published it and the browser check found no problems.", FINAL, { during: true });
  assert.deepEqual(g.bad, []);
  assert.deepEqual(g.timing, ["published", "the browser check", "a clean result"]);
  // the same words as a final reply are simply held
  assert.deepEqual(groundingOf("I've published it and the browser check found no problems.", FINAL).timing, []);
  // a limitation said during the work is not contradicted by the final success
  assert.deepEqual(groundingOf("I haven't published it yet; I'll run the browser check next.", FINAL, { during: true }), { bad: [], timing: [] });
  // and a claim the final checks contradict fails during the work too
  assert.notDeepEqual(groundingOf("It's live now.", NOT_YET, { during: true }).bad, []);
});

test("the talk press reports a progress line's completion claim as UNVERIFIED IN TIME, and passes a truthful limitation in a line", () => {
  const early = { job: A, n: 1, ms: 100, text: "I've published the page already." };
  const honest = { job: B, n: 1, ms: 200, text: "I haven't changed the price yet; I'll publish once it's done." };
  const parts = [part(0, [A], [early]), part(1, [B], [honest])];
  const seen = mergeSeen(null, viewOf(parts), 300);
  const steps = [{ n: 1, sent: true, request: { key: "k1", final: viewOf(parts), seen }, network: [answer(A, reply("I added the Bulk Orders page and published it.", CLEAN)), answer(B, reply("I changed the price to £5.90.", CLEAN))] }];
  const v = talkVerdict({ steps, talkSwitch: talkSwitchVerdict(rt(ON), true) });
  assert.deepEqual(v.checks.filter((c) => !c.ok).map((c) => c.name), []);
  assert.equal(v.unverified.length, 1);
  assert.match(v.unverified[0], new RegExp(`job ${A.slice(0, 8)} line 1 said published as done while the work ran`));
  assert.match(v.unverified[0], /unverified/);
  // a progress line claiming what the final checks deny fails the press
  const lie = [part(0, [A], [{ ...early }]), part(1, [B], [honest])];
  const steps2 = [{ ...steps[0], request: { key: "k1", final: viewOf(lie), seen: mergeSeen(null, viewOf(lie), 300) }, network: [answer(A, reply("I added the page, but it isn't published.", UNPUBLISHED)), answer(B, reply("I changed the price to £5.90.", CLEAN))] }];
  const f = talkVerdict({ steps: steps2, talkSwitch: talkSwitchVerdict(rt(ON), true) }).checks.filter((c) => !c.ok);
  assert.deepEqual(f.map((c) => c.name), ["message 1: every progress line and explanation claims nothing its own job's checks contradict"]);
});

test("requestBatchVerdict carries the talk press's unverified timing into the press's own unverified list", () => {
  const early = { job: A, n: 1, ms: 100, text: "I've published the page already." };
  const parts = [part(0, [A], [early])];
  const steps = [{ n: 1, sent: true, request: { key: "k1", final: viewOf(parts), seen: mergeSeen(null, viewOf(parts), 300) }, network: [answer(A, reply("I added the page and published it.", CLEAN))] }];
  const v = requestBatchVerdict({ before: null, after: null, served: {}, beforeServed: {}, steps, spec: { expect: { talk: true } }, talkSwitch: talkSwitchVerdict(rt(ON), true) });
  assert.ok(v.unverified.some((u) => /said published as done while the work ran/.test(u)), JSON.stringify(v.unverified));
});
