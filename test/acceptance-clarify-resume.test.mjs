// CLARIFY AND RESUME, CONSOLIDATED (2026-10-13, prepared, not pressed).
//
// The owner, after run 150: *"prepare one consolidated, image-free
// clarification/resume test covering independent work continuing while
// another part genuinely needs an answer, dependency-bound work waiting,
// answering only resuming the waiting part, successful work surviving
// reload/reconnection, and no duplicate execution or charges. Keep this
// universal across task types … Reuse existing offline coverage and add only
// tests needed for uncovered risks."*
//
// The product behaviour is shown offline by C2, E2, I4, CC 3 and, all on one
// request with jobs and money counted, CR 1–2 (test/request-flow.test.mjs).
// AND THE TIMING (2026-10-13, Codex's review of 4d60a2a3): a snapshot of
// statuses at the question passed an independent job that ran from 100 to 200
// with the question asked at 400. CRS 7–12 hold the press to the order of its
// own timed reads: work after the question first read waiting, before the
// answer, which the press holds back until it is seen or nothing can move.
//
// What is new here is the PRESS: `acc-clarify-resume` and the verdict that
// judges a live run of it from its own record (`clarifyResumeVerdict`) —
// pass only on the full shape, not exercised on any other, never on wording.
import { test } from "node:test";
import assert from "node:assert/strict";
import { UI_SCENARIOS, ACCEPTANCE_CAP, BALANCE_OPT_IN, readBalanceOptIn, runUi, waitedWork, waitHold } from "../scripts/canary-ui.mjs";
import { clarifyResumeVerdict, requestBatchVerdict, COVERAGE } from "../scripts/canary-requests.mjs";
import { heldApp, ORIGIN, SLUG, UID } from "./fixtures/canary-held-app.mjs";

const SC = UI_SCENARIOS["acc-clarify-resume"];
const K = "c0ffee00c0ffee00c0ffee00c0ffee00";
const W = ["Add a link to our online shop in the footer", "change the Classes page heading", "add one line on the Order page"];

// ── THE SCENARIO ────────────────────────────────────────────────────────────

test("CRS 1 — the scenario: one image-free message of three kinds on the bakery, ending on the question; the answer sent with the tab closed and followed in a fresh session; the clarify verdict and the router's shape asked for; bound by the acceptance cap; the balance box closed to it", () => {
  assert.ok(SC, "no acc-clarify-resume");
  assert.equal(SC.site, "fold-lane-bakery");
  assert.equal(SC.request, true);
  assert.equal(SC.images, "none");
  assert.equal(SC.cap, ACCEPTANCE_CAP);
  assert.equal(SC.fundsFirst, true);
  assert.ok(Number.isInteger(SC.budget) && SC.budget >= 19 && SC.budget <= ACCEPTANCE_CAP);
  assert.equal(SC.steps.length, 2);
  assert.equal(SC.steps[0].until, "question", "the first message must end on the question");
  assert.equal(SC.steps[1].away, "fresh", "the answer must be sent with the tab closed and followed in a fresh session");
  assert.equal(SC.expect.clarify, true);
  assert.equal(SC.expect.shape, true);
  assert.deepEqual(SC.expect.headings.map((h) => h.route), ["/classes"]);
  assert.equal(SC.expect.social.network, "website");
  assert.ok(SC.steps[1].say.includes(SC.expect.social.host + SC.expect.social.path), "the answer does not give the address the check expects");
  assert.ok(!SC.steps[0].say.includes(SC.expect.social.host), "the first message gives the address: nothing would need asking");
  // THE ASKING PART COMES FIRST (2026-10-13): one write at a time, in the
  // message's order, so the heading's write can come after the question.
  assert.ok(SC.steps[0].say.indexOf("online shop") < SC.steps[0].say.indexOf("heading"), "the heading comes before the shop link: its write would run before the question");
  assert.doesNotMatch(SC.steps[0].say, /\b(a|an|some) (photo|photograph|picture|image)s?\b|\bform\b|\btable\b/i);
  for (const c of SC.covers) assert.ok(Object.hasOwn(COVERAGE, c), `it covers ${c}, which no reader knows`);
  // FRESH ON THE BAKERY: no other scenario asks for a shop link or this heading.
  for (const [k, sc] of Object.entries(UI_SCENARIOS)) {
    if (k === "acc-clarify-resume") continue;
    for (const st of sc.steps || []) assert.ok(!/online shop|How a Saturday class/i.test(st.say || ""), `${k} already asked for this`);
  }
  assert.ok(!BALANCE_OPT_IN.includes("acc-clarify-resume"), "the balance box was opened without the owner's word");
  assert.equal(readBalanceOptIn("808", { ui: "acc-clarify-resume" }).ok, false);
});

// ── THE VERDICT ─────────────────────────────────────────────────────────────

// One read of the trail, as the press writes it (`noteView`): when, each
// part's status, each part's job count.
const read = (ms, st, jobs) => ({ ms, parts: st.map((x, n) => [n, x]), jobs: jobs.map((x, n) => [n, x]) });
// THE LINK (part 0) ASKS FIRST; THE HEADING (part 1) RUNS WHILE IT WAITS.
const DURING = [
  read(100, ["started", "ready", "blocked"], [1, 0, 0]),
  read(400, ["waiting", "ready", "blocked"], [1, 0, 0]),
  read(500, ["waiting", "started", "blocked"], [1, 1, 0]),
  read(700, ["waiting", "done", "blocked"], [1, 1, 0]),
];
// CODEX'S SEQUENCE: the heading's job from 100 to 200, the link's from 300,
// asking at 400.
const SEQUENTIAL = [
  read(100, ["ready", "started", "blocked"], [0, 1, 0]),
  read(200, ["ready", "done", "blocked"], [0, 1, 0]),
  read(300, ["started", "done", "blocked"], [1, 1, 0]),
  read(400, ["waiting", "done", "blocked"], [1, 1, 0]),
];

/** The press's own record of the two messages, as the UI driver saves it. */
function record({ atQ, after, trail = DURING, question = { by: "step", part: 0, key: K }, dependsOn = [{ change: 2, after: [0] }] } = {}) {
  const route = { method: "POST", path: "/api/site/route", status: 200, res: { intent: "edit", layer: "nav", alsoAsked: W.slice(1), dependsOn, request: { key: K, parts: W.map((w, n) => ({ n, words: w })) } } };
  const s1 = { n: 1, sent: true, network: [route], request: { key: K, final: { key: K, parts: atQ }, ...(trail ? { trail } : {}) }, ...(question ? { question } : {}) };
  const s2 = { n: 2, sent: true, network: [{ method: "POST", path: "/api/site/route", status: 200, res: { resumed: { key: K, part: 0 } } }], request: { key: K, final: { key: K, ended: true, parts: after } } };
  return [s1, s2];
}
const AT_Q = [{ n: 0, status: "waiting", ids: ["r0"] }, { n: 1, status: "done", ids: ["j1"] }, { n: 2, status: "blocked", ids: [] }];
const AFTER = [{ n: 0, status: "done", ids: ["r0", "j0"] }, { n: 1, status: "done", ids: ["j1"] }, { n: 2, status: "done", ids: ["j2"] }];

test("CRS 2 — PASS: the link waits, the heading works after it was first read waiting and is done by the answer, the line is held on the link with no job; after the answer every part is done, the heading has exactly its old job, the link gained a job, the line ran only now", () => {
  const v = clarifyResumeVerdict(record({ atQ: AT_Q, after: AFTER }));
  assert.equal(v.state, "pass", JSON.stringify(v));
  assert.deepEqual({ asking: v.asking, independent: v.independent, held: v.held }, { asking: 0, independent: [1], held: [2] });
  assert.deepEqual(v.waitFrom, { ms: 400, after: 100 });
  assert.deepEqual(v.during, [{ part: 1, how: "running", ms: 500 }]);
});

test("CRS 3 — NOT EXERCISED, each by its stage: no question; the asking part not waiting; nothing finished first; nothing held on the asking part (no relation, or held on another part) — never a pass", () => {
  const cases = [
    ["question", record({ atQ: AT_Q, after: AFTER, question: null })],
    ["question", record({ atQ: AT_Q.map((p) => (p.n === 0 ? { ...p, status: "done" } : p)), after: AFTER })],
    ["independent", record({ atQ: AT_Q.map((p) => (p.n === 1 ? { ...p, status: "queued", ids: [] } : p)), after: AFTER })],
    ["dependency", record({ atQ: AT_Q, after: AFTER, dependsOn: [] })],
    ["dependency", record({ atQ: AT_Q, after: AFTER, dependsOn: [{ change: 2, after: [1] }] })],
    ["dependency", record({ atQ: AT_Q.map((p) => (p.n === 2 ? { ...p, status: "done", ids: ["j2"] } : p)), after: AFTER })],
  ];
  for (const [stage, steps] of cases) {
    const v = clarifyResumeVerdict(steps);
    assert.equal(v.state, "not-exercised", JSON.stringify(v));
    assert.equal(v.stage, stage, JSON.stringify(v));
    assert.equal(v.ok, false);
  }
});

test("CRS 4 — FAIL, whatever the timing: the held part ran before the answer; a finished part ran again after it; the asking part was never resumed; the held part never ran; a part not done at the end", () => {
  for (const trail of [DURING, SEQUENTIAL]) {
    const fails = [
      record({ trail, atQ: AT_Q.map((p) => (p.n === 2 ? { ...p, ids: ["r2"] } : p)), after: AFTER }),
      record({ trail, atQ: AT_Q, after: AFTER.map((p) => (p.n === 1 ? { ...p, ids: ["j1", "j1b"] } : p)) }),
      record({ trail, atQ: AT_Q, after: AFTER.map((p) => (p.n === 0 ? { ...p, ids: ["r0"] } : p)) }),
      record({ trail, atQ: AT_Q, after: AFTER.map((p) => (p.n === 2 ? { ...p, ids: [] } : p)) }),
      record({ trail, atQ: AT_Q, after: AFTER.map((p) => (p.n === 2 ? { ...p, status: "failed" } : p)) }),
    ];
    for (const steps of fails) {
      const v = clarifyResumeVerdict(steps);
      assert.equal(v.state, "fail", JSON.stringify(v));
    }
  }
});

test("CRS 5 — UNVERIFIED: a view that was never read, at the question or after the answer, is neither a pass nor a fail", () => {
  const [s1, s2] = record({ atQ: AT_Q, after: AFTER });
  assert.equal(clarifyResumeVerdict([{ ...s1, request: { key: K } }, s2]).state, "unverified");
  assert.equal(clarifyResumeVerdict([s1, { ...s2, request: { key: K } }]).state, "unverified");
});

test("CRS 6 — WIRED INTO THE PRESS'S VERDICT: a pass is a passing check; a run of another shape, or the right shape at the wrong time, is a failing NOT EXERCISED check and a not-verified line, never repeated; scenarios that do not ask for it are untouched", () => {
  const base = { before: null, after: null, served: {}, tables: {}, slug: "fold-lane-bakery" };
  const pass = requestBatchVerdict({ ...base, spec: SC, steps: record({ atQ: AT_Q, after: AFTER }) });
  const c = pass.checks.find((x) => /^clarify:/.test(x.name));
  assert.ok(c && c.ok, JSON.stringify(c));
  assert.equal(pass.clarify.state, "pass");
  for (const [stage, steps] of [["dependency", record({ atQ: AT_Q, after: AFTER, dependsOn: [] })], ["timing", record({ atQ: AT_Q, after: AFTER, trail: SEQUENTIAL })]]) {
    const other = requestBatchVerdict({ ...base, spec: SC, steps });
    const n = other.checks.find((x) => /^clarify:/.test(x.name));
    assert.ok(n && n.ok === false && n.why.includes(`NOT EXERCISED (${stage})`) && /not retried/.test(n.why), JSON.stringify(n));
    assert.ok(other.unverified.some((u) => u.includes(`clarify and resume: not exercised (${stage}) — no automatic repeat`)), JSON.stringify(other.unverified));
  }
  const unv = requestBatchVerdict({ ...base, spec: SC, steps: record({ atQ: AT_Q, after: AFTER, trail: null }) });
  const u = unv.checks.find((x) => /^clarify:/.test(x.name));
  assert.ok(u && u.ok === false && /^UNVERIFIED \(timing\)/.test(u.why), JSON.stringify(u));
  const untouched = requestBatchVerdict({ ...base, spec: UI_SCENARIOS["lv-parallel"], steps: record({ atQ: AT_Q, after: AFTER }) });
  assert.ok(!untouched.checks.some((x) => /^clarify:/.test(x.name)));
  assert.equal(untouched.clarify, undefined);
});

// ── THE TIMING (Codex's review of 4d60a2a3) ──────────────────────────────────

test("CRS 7 — NEGATIVE CONTROL, CODEX'S SEQUENCE: the independent job from 100 to 200, the asking job from 300, asking at 400 — the snapshot at the question is done/waiting/blocked, every other check holds, and it is NOT EXERCISED (timing), never a pass; so is work that may have ended before the wait began", () => {
  const v = clarifyResumeVerdict(record({ atQ: AT_Q, after: AFTER, trail: SEQUENTIAL }));
  assert.equal(v.state, "not-exercised", JSON.stringify(v));
  assert.equal(v.stage, "timing");
  assert.match(v.why, /work finished before the question does not count/);
  assert.deepEqual(v.waitFrom, { ms: 400, after: 300 });
  assert.deepEqual(v.during, []);
  // The same snapshot passed before this correction: the control is alive.
  assert.equal(clarifyResumeVerdict(record({ atQ: AT_Q, after: AFTER })).state, "pass");
  const others = [
    // the first read already shows the question waiting and the heading done
    [read(400, ["waiting", "done", "blocked"], [1, 1, 0])],
    // the heading finished between 300 and 400, and so did the wait's start: cannot be put after it
    [read(300, ["started", "started", "blocked"], [1, 1, 0]), read(400, ["waiting", "done", "blocked"], [1, 1, 0])],
    // work by the held part counts for nothing (it is a failure elsewhere, not independent work)
    [read(400, ["waiting", "done", "blocked"], [1, 1, 0]), read(500, ["waiting", "done", "blocked"], [1, 1, 0])],
    // the heading ran and finished only while the asking part was not waiting (it asked, ran again, and asked again)
    [read(400, ["waiting", "ready", "blocked"], [1, 0, 0]), read(500, ["started", "started", "blocked"], [2, 1, 0]), read(600, ["waiting", "done", "blocked"], [2, 1, 0])],
  ];
  for (const trail of others) {
    const w = clarifyResumeVerdict(record({ atQ: AT_Q, after: AFTER, trail }));
    assert.equal(w.state, "not-exercised", JSON.stringify({ trail, w }));
    assert.equal(w.stage, "timing");
  }
});

test("CRS 8 — NEGATIVE CONTROL, MISSING TIMING: no trail, an empty one, the asking part never read waiting, a read with no time, reads out of order, a read after the wait with no statuses — UNVERIFIED (timing), never a pass and never NOT EXERCISED", () => {
  const cases = [
    null,
    [],
    DURING.map((e, k) => (k === 2 ? { ms: e.ms } : e)),
    DURING.filter((e) => e.parts[0][1] !== "waiting"),
    DURING.map((e, k) => (k === 2 ? { ...e, ms: undefined } : e)),
    [DURING[0], DURING[1], DURING[3], DURING[2]],
  ];
  for (const trail of cases) {
    const v = clarifyResumeVerdict(record({ atQ: AT_Q, after: AFTER, trail }));
    assert.equal(v.state, "unverified", JSON.stringify({ trail, v }));
    assert.equal(v.stage, "timing");
    assert.equal(v.ok, false);
  }
});

test("CRS 9 — POSITIVE CONTROL, WORK WHILE IT WAITED: running (queued or started) or finishing after the asking part was first read waiting, by a part done by the answer, each passes; work seen only by a part not done by the answer does not", () => {
  const shapes = [
    ["running", DURING],
    ["running", [read(400, ["waiting", "ready", "blocked"], [1, 0, 0]), read(500, ["waiting", "queued", "blocked"], [1, 1, 0]), read(900, ["waiting", "done", "blocked"], [1, 1, 0])]],
    ["finished", [read(400, ["waiting", "ready", "blocked"], [1, 0, 0]), read(600, ["waiting", "done", "blocked"], [1, 1, 0])]],
  ];
  for (const [how, trail] of shapes) {
    const v = clarifyResumeVerdict(record({ atQ: AT_Q, after: AFTER, trail }));
    assert.equal(v.state, "pass", JSON.stringify({ how, v }));
    assert.equal(v.during[0].how, how);
    assert.deepEqual(v.independent, [1]);
  }
  // A FOURTH PART, still running at the question's end, worked while it
  // waited — but it was not done by the answer, so nothing it did is reused.
  const four = [read(400, ["waiting", "done", "blocked", "started"], [1, 1, 0, 1]), read(500, ["waiting", "done", "blocked", "started"], [1, 1, 0, 1])];
  const atQ4 = [...AT_Q, { n: 3, status: "failed", ids: ["j3"] }];
  const v4 = clarifyResumeVerdict(record({ atQ: atQ4, after: [...AFTER, { n: 3, status: "done", ids: ["j3"] }], trail: four }));
  assert.equal(v4.state, "not-exercised", JSON.stringify(v4));
  assert.match(v4.why, /by no part finished before the answer/);
});

test("CRS 10 — waitedWork and waitHold, directly: the wait's start is bracketed by the reads around it; the answer is released when work was seen, or when nothing else can move, and held while another part is recovering or unverified", () => {
  assert.deepEqual(waitedWork(DURING, 0).from, { ms: 400, after: 100 });
  assert.equal(waitedWork(DURING, 0).state, "seen");
  assert.equal(waitedWork(SEQUENTIAL, 0).state, "none");
  assert.equal(waitedWork(DURING, 0, { held: [1] }).state, "none", "a held part's work counted as independent");
  assert.equal(waitedWork(DURING, null).state, "unknown");
  const v = (st) => ({ parts: st.map((status, n) => ({ n, status })) });
  assert.equal(waitHold(v(["waiting", "started", "blocked"]), DURING, 0).release, "observed");
  assert.equal(waitHold(v(["waiting", "done", "blocked"]), SEQUENTIAL, 0).release, "settled");
  assert.equal(waitHold(v(["waiting", "recovering", "blocked"]), SEQUENTIAL, 0).release, null);
  assert.equal(waitHold(v(["waiting", "unverified", "blocked"]), SEQUENTIAL, 0).release, null);
  assert.equal(waitHold(v(["waiting", "done", "blocked"]), null, 0).release, "settled", "a missing trail held the answer forever (the verdict says unverified)");
});

// ── THE PRESS, END TO END, OFFLINE (the real driver against the held app) ────

const RK = "rqclar" + "0".repeat(18) + "1";
const part = (n, words, status, over = {}) => ({ n, words, status, ids: [], jobs: [], charged: 0, ...over });
const view = (parts, over = {}) => ({ key: RK, state: over.ended ? "done" : "running", ended: false, stop: false, at: 1, updatedAt: 2, parts, ...over });
const QN = { id: "q1", text: "What is your online shop's address?", options: [] };
const LINK = (st, over = {}) => part(0, W[0], st, { ids: ["r0"], ...(st === "waiting" ? { jobs: ["r0"], question: QN } : {}), ...over });
const HEAD = (st, ids = []) => part(1, W[1], st, { ids, ...(st === "done" ? { jobs: ids } : {}) });
const LINE = (st, ids = []) => part(2, W[2], st, { ids, ...(st === "done" ? { jobs: ids } : {}) });
const ANSWERED = [
  view([LINK("done", { ids: ["r0", "j0"], jobs: ["j0"] }), HEAD("done", ["j1"]), LINE("started", ["j2"])]),
  view([LINK("done", { ids: ["r0", "j0"], jobs: ["j0"] }), HEAD("done", ["j1"]), LINE("done", ["j2"])], { ended: true }),
];
const OK = (reply) => [{ ok: true, msg: "✅", reply, replySource: "model" }];
const SESSION = { access_token: "a", refresh_token: "r", expires_at: 2_000_000_000, user: { id: UID } };
async function press(views) {
  const h = heldApp({
    send: () => ({ request: { key: RK, views }, route: { intent: "addon", layer: "nav", alsoAsked: W.slice(1), dependsOn: [{ change: 2, after: [0] }] } }),
    answerViews: ANSWERED,
    answers: { r0: [{ ok: false, clarify: QN }], j0: OK("Your footer links to your shop."), j1: OK("The Classes heading now reads “How a Saturday class works”."), j2: OK("The Order page says you can order online.") },
  });
  const rec = await runUi({
    base: ORIGIN, session: SESSION, slug: SLUG, scenario: SC, spend: true, balanceNow: async () => 100, evid: "", launch: h.launch, log: () => {},
    openMs: 300, attachMs: 50, startMs: 100, stepMs: 1_500, stepCapMs: 1_500, pollMs: 1, settleMs: 0, viewEveryMs: 0, awayEveryMs: 1, replyFloorMs: 0,
    requestsNow: async () => { const r = await h.requestsNow(); return { ...r, json: { ...r.json, jobs: [] } }; },
    freshSession: async () => ({ ...SESSION, access_token: "fresh" }), freshAwayMs: 5, stopNow: h.stopNow,
    runtimeNow: async () => ({ status: 200, json: { ok: true, imagePurchases: false } }),
  });
  return { h, rec };
}

test("CRS 11 — END TO END: the heading runs while the link's question waits; the press reads it, releases the answer as observed, and the verdict passes from the trail it wrote; Codex's sequence through the same driver is released as settled and judged NOT EXERCISED (timing)", async () => {
  const during = await press([
    view([LINK("started"), HEAD("ready"), LINE("blocked")]),
    view([LINK("waiting"), HEAD("started", ["j1"]), LINE("blocked")], { state: "waiting" }),
    view([LINK("waiting"), HEAD("done", ["j1"]), LINE("blocked")], { state: "waiting" }),
  ]);
  assert.equal(during.rec.stopped, null, JSON.stringify(during.rec.stopped));
  assert.equal(during.rec.sent, 2);
  const [s1] = during.rec.steps;
  assert.equal(s1.question.part, 0);
  assert.equal(s1.request.release, "observed");
  assert.ok(s1.request.trail.every((e) => Array.isArray(e.jobs) && Number.isFinite(e.ms)), JSON.stringify(s1.request.trail));
  // EACH READ KEEPS EACH PART'S JOB COUNT, for a reader of which job ran when.
  assert.deepEqual(s1.request.trail[s1.request.trail.length - 1].jobs, [[0, 1], [1, 1], [2, 0]]);
  const v = clarifyResumeVerdict(during.rec.steps);
  assert.equal(v.state, "pass", JSON.stringify(v));
  assert.deepEqual(v.independent, [1]);

  const seq = await press([
    view([LINK("ready", { ids: [] }), HEAD("started", ["j1"]), LINE("blocked")]),
    view([LINK("ready", { ids: [] }), HEAD("done", ["j1"]), LINE("blocked")]),
    view([LINK("started"), HEAD("done", ["j1"]), LINE("blocked")]),
    view([LINK("waiting"), HEAD("done", ["j1"]), LINE("blocked")], { state: "waiting" }),
  ]);
  assert.equal(seq.rec.stopped, null, JSON.stringify(seq.rec.stopped));
  assert.equal(seq.rec.steps[0].request.release, "settled");
  const w = clarifyResumeVerdict(seq.rec.steps);
  assert.equal(w.state, "not-exercised", JSON.stringify(w));
  assert.equal(w.stage, "timing");
});

test("CRS 12 — THE ANSWER IS HELD: with the question shown while the heading is still recovering, the press keeps reading and sends the answer only after the heading finishes in a later read (released as observed); a heading that never moves is answered when the window ends (released as window), and the verdict does not pass", async () => {
  const held = await press([
    view([LINK("waiting"), HEAD("recovering", ["j1"]), LINE("blocked")], { state: "waiting" }),
    view([LINK("waiting"), HEAD("recovering", ["j1"]), LINE("blocked")], { state: "waiting" }),
    view([LINK("waiting"), HEAD("done", ["j1"]), LINE("blocked")], { state: "waiting" }),
  ]);
  assert.equal(held.rec.stopped, null, JSON.stringify(held.rec.stopped));
  const s1 = held.rec.steps[0];
  assert.equal(s1.request.release, "observed");
  assert.equal(s1.request.final.parts[1].status, "done", "the answer went while the heading was still recovering");
  assert.equal(clarifyResumeVerdict(held.rec.steps).state, "pass");

  const stuck = await press([
    view([LINK("waiting"), HEAD("recovering", ["j1"]), LINE("blocked")], { state: "waiting" }),
  ]);
  const t1 = stuck.rec.steps[0];
  assert.equal(t1.request.release, "window");
  assert.equal(stuck.rec.sent, 2, "the window's end did not release the answer");
  const v = clarifyResumeVerdict(stuck.rec.steps);
  assert.notEqual(v.state, "pass", JSON.stringify(v));
});
