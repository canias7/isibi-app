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
// What is new here is the PRESS: `acc-clarify-resume` and the verdict that
// judges a live run of it from its own record (`clarifyResumeVerdict`) —
// pass only on the full shape, not exercised on any other, never on wording.
import { test } from "node:test";
import assert from "node:assert/strict";
import { UI_SCENARIOS, ACCEPTANCE_CAP, BALANCE_OPT_IN, readBalanceOptIn } from "../scripts/canary-ui.mjs";
import { clarifyResumeVerdict, requestBatchVerdict, COVERAGE } from "../scripts/canary-requests.mjs";

const SC = UI_SCENARIOS["acc-clarify-resume"];
const K = "c0ffee00c0ffee00c0ffee00c0ffee00";
const W = ["Change the heading", "add a link to our online shop in the footer", "add one line on the Order page"];

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

/** The press's own record of the two messages, as the UI driver saves it. */
function record({ atQ, after, question = { by: "step", part: 1, key: K }, dependsOn = [{ change: 2, after: [1] }] } = {}) {
  const route = { method: "POST", path: "/api/site/route", status: 200, res: { intent: "edit", layer: "text", alsoAsked: W.slice(1), dependsOn, request: { key: K, parts: W.map((w, n) => ({ n, words: w })) } } };
  const s1 = { n: 1, sent: true, network: [route], request: { key: K, final: { key: K, parts: atQ } }, ...(question ? { question } : {}) };
  const s2 = { n: 2, sent: true, network: [{ method: "POST", path: "/api/site/route", status: 200, res: { resumed: { key: K, part: 1 } } }], request: { key: K, final: { key: K, ended: true, parts: after } } };
  return [s1, s2];
}
const AT_Q = [{ n: 0, status: "done", ids: ["j0"] }, { n: 1, status: "waiting", ids: ["r1", "j1"] }, { n: 2, status: "blocked", ids: [] }];
const AFTER = [{ n: 0, status: "done", ids: ["j0"] }, { n: 1, status: "done", ids: ["r1", "j1", "j1b"] }, { n: 2, status: "done", ids: ["r2", "j2"] }];

test("CRS 2 — PASS: at the question the heading is done, the link waits and the line is held on it with no job; after the answer every part is done, the heading has exactly its old job, the link gained a job, the line ran only now", () => {
  const v = clarifyResumeVerdict(record({ atQ: AT_Q, after: AFTER }));
  assert.equal(v.state, "pass", JSON.stringify(v));
  assert.deepEqual({ asking: v.asking, independent: v.independent, held: v.held }, { asking: 1, independent: [0], held: [2] });
});

test("CRS 3 — NOT EXERCISED, each by its stage: no question; the asking part not waiting; nothing finished first; nothing held on the asking part (no relation, or held on another part) — never a pass", () => {
  const cases = [
    ["question", record({ atQ: AT_Q, after: AFTER, question: null })],
    ["question", record({ atQ: AT_Q.map((p) => (p.n === 1 ? { ...p, status: "done" } : p)), after: AFTER })],
    ["independent", record({ atQ: AT_Q.map((p) => (p.n === 0 ? { ...p, status: "queued", ids: [] } : p)), after: AFTER })],
    ["dependency", record({ atQ: AT_Q, after: AFTER, dependsOn: [] })],
    ["dependency", record({ atQ: AT_Q, after: AFTER, dependsOn: [{ change: 2, after: [0] }] })],
    ["dependency", record({ atQ: AT_Q.map((p) => (p.n === 2 ? { ...p, status: "done", ids: ["j2"] } : p)), after: AFTER })],
  ];
  for (const [stage, steps] of cases) {
    const v = clarifyResumeVerdict(steps);
    assert.equal(v.state, "not-exercised", JSON.stringify(v));
    assert.equal(v.stage, stage, JSON.stringify(v));
    assert.equal(v.ok, false);
  }
});

test("CRS 4 — FAIL: the held part ran before the answer; a finished part ran again after it; the asking part was never resumed; the held part never ran; a part not done at the end", () => {
  const fails = [
    record({ atQ: AT_Q.map((p) => (p.n === 2 ? { ...p, ids: ["r2"] } : p)), after: AFTER }),
    record({ atQ: AT_Q, after: AFTER.map((p) => (p.n === 0 ? { ...p, ids: ["j0", "j0b"] } : p)) }),
    record({ atQ: AT_Q, after: AFTER.map((p) => (p.n === 1 ? { ...p, ids: ["r1", "j1"] } : p)) }),
    record({ atQ: AT_Q, after: AFTER.map((p) => (p.n === 2 ? { ...p, ids: [] } : p)) }),
    record({ atQ: AT_Q, after: AFTER.map((p) => (p.n === 2 ? { ...p, status: "failed" } : p)) }),
  ];
  for (const steps of fails) {
    const v = clarifyResumeVerdict(steps);
    assert.equal(v.state, "fail", JSON.stringify(v));
  }
});

test("CRS 5 — UNVERIFIED: a view that was never read, at the question or after the answer, is neither a pass nor a fail", () => {
  const [s1, s2] = record({ atQ: AT_Q, after: AFTER });
  assert.equal(clarifyResumeVerdict([{ ...s1, request: { key: K } }, s2]).state, "unverified");
  assert.equal(clarifyResumeVerdict([s1, { ...s2, request: { key: K } }]).state, "unverified");
});

test("CRS 6 — WIRED INTO THE PRESS'S VERDICT: a pass is a passing check; a run of another shape is a failing NOT EXERCISED check and a not-verified line, never repeated; scenarios that do not ask for it are untouched", () => {
  const base = { before: null, after: null, served: {}, tables: {}, slug: "fold-lane-bakery" };
  const pass = requestBatchVerdict({ ...base, spec: SC, steps: record({ atQ: AT_Q, after: AFTER }) });
  const c = pass.checks.find((x) => /^clarify:/.test(x.name));
  assert.ok(c && c.ok, JSON.stringify(c));
  assert.equal(pass.clarify.state, "pass");
  const other = requestBatchVerdict({ ...base, spec: SC, steps: record({ atQ: AT_Q, after: AFTER, dependsOn: [] }) });
  const n = other.checks.find((x) => /^clarify:/.test(x.name));
  assert.ok(n && n.ok === false && /NOT EXERCISED \(dependency\)/.test(n.why) && /not retried/.test(n.why), JSON.stringify(n));
  assert.ok(other.unverified.some((u) => /clarify and resume: not exercised \(dependency\) — no automatic repeat/.test(u)));
  const untouched = requestBatchVerdict({ ...base, spec: UI_SCENARIOS["lv-parallel"], steps: record({ atQ: AT_Q, after: AFTER }) });
  assert.ok(!untouched.checks.some((x) => /^clarify:/.test(x.name)));
  assert.equal(untouched.clarify, undefined);
});
