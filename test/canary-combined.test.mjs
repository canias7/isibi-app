// THE COMBINED RELEASE CHECK, PREPARED (2026-10-07): the owner, after Codex
// passed the provisioning recovery on 092ff48a: *"…prepare the concrete
// release and combined Edit/Add-on verification plan: exact commits and
// predicted image, one container build if required, the smallest useful set
// of live scenarios covering mixed requests, dependency order, clarification,
// model-written progress, closed-tab completion, final results and charges,
// with the expected credit budget and stop conditions. Keep deliberate
// provisioning failures in offline tests."*
//
// Free and offline: the press is driven through the stand-in app in request
// mode (test/fixtures/canary-rq-app.mjs), and nothing reaches a network.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  UI_SCENARIOS, readUiScenario, stepBoundMs, UI_STEP_MAX_MS, UI_PRESS_MAX_MS, UI_REPLY_FLOOR_MS, UI_FIRST_LINE_MS, UI_FRESH_AWAY_MS, blocksPost,
} from "../scripts/canary-ui.mjs";
import { progressChecks, requestBatchVerdict, replyChecks, coverageOf, COVERAGE } from "../scripts/canary-requests.mjs";
import { rqApp, part, view, drive, SLUG } from "./fixtures/canary-rq-app.mjs";

const ROOT = new URL("../", import.meta.url).pathname;
const failed = (checks) => checks.filter((c) => !c.ok).map((c) => `${c.name} — ${c.why}`);
const LC = UI_SCENARIOS["lv-combined"];
const M1 = "Put a link to the new Allergens page in the menu, and add an Allergens page saying all our loaves are baked in one kitchen that also handles nuts, seeds and dairy, so we can't promise any loaf is free of them, and that anyone with an allergy should ask us at the counter.";
const M2 = "Change the Order page heading 'Pick a loaf and a collection slot' to 'Choose your loaf and a collection time', and add a link to our TikTok in the footer.";
const M3 = "It's tiktok.com/@harbourloaf";
const PLAN = fs.readFileSync(ROOT + "docs/investigations/combined-release-plan.md", "utf8");
const FLOW = fs.readFileSync(ROOT + ".github/workflows/edit-canary.yml", "utf8");

// ── THE SCENARIO ─────────────────────────────────────────────────────────────

test("lv-combined: on the bakery, in request mode, three messages word for word — the menu link before the page it needs, read in a fresh browser session; the heading and a footer link that ends on the step's question; the answer — inside its budget, its hard cap, its walls and its time", () => {
  assert.ok(LC, "no lv-combined scenario");
  assert.equal(LC.site, "fold-lane-bakery");
  assert.equal(LC.request, true);
  assert.equal(LC.addon, true, "the add-on part cannot run");
  assert.deepEqual([...LC.layers], ["text", "look", "nav", "page"]);
  for (const no of ["data", "rules", "picture", "logo"]) assert.ok(!LC.layers.includes(no), `the ${no} layer is open`);
  assert.notEqual(LC.adds, true);
  assert.equal(LC.budget, 38);
  assert.equal(LC.fundsFirst, true, "the press can start short");
  assert.equal(LC.cap, 40, "the press names no hard cap");
  assert.ok(LC.cap >= LC.budget, "the cap is below the budget, so no balance passes both");
  assert.deepEqual(LC.steps.map((s) => s.say), [M1, M2, M3]);
  assert.equal(LC.steps[0].away, "fresh", "message 1 is not read in a fresh browser session");
  assert.equal(LC.steps[0].until, undefined);
  assert.equal(LC.steps[1].until, "question", "message 2 does not end on its question");
  assert.equal(LC.steps[1].away, undefined);
  assert.equal(LC.steps[2].until, undefined);
  assert.equal(LC.steps[2].away, undefined);
  // INSIDE ITS TIME: each message's bound, and all three with their reply floors, inside one press.
  for (const st of LC.steps) assert.ok(stepBoundMs(st) <= UI_STEP_MAX_MS);
  assert.ok(LC.steps.reduce((t, x) => t + stepBoundMs(x) + UI_REPLY_FLOOR_MS, 0) <= UI_PRESS_MAX_MS);
  // THE TWO WAITS FIT INSIDE MESSAGE 1'S OWN BOUND, with room for the work.
  assert.ok(UI_FIRST_LINE_MS + UI_FRESH_AWAY_MS < stepBoundMs(LC.steps[0]) / 2);
  // WHAT MUST LAND.
  assert.deepEqual(JSON.parse(JSON.stringify(LC.expect.headings)), [{ route: "/order", from: "Pick a loaf and a collection slot", to: "Choose your loaf and a collection time" }]);
  assert.deepEqual([...LC.expect.pages[0].about], ["kitchen", "dairy"]);
  for (const w of LC.expect.pages[0].about) assert.ok(M1.includes(w), `the page is looked for by "${w}", which message 1 never asks for`);
  assert.deepEqual({ ...LC.expect.menu }, { page: 0 }, "the link's words are asked for, and the message names none");
  assert.deepEqual({ ...LC.expect.social }, { network: "tiktok", host: "tiktok.com", path: "/@harbourloaf" });
  assert.ok(M3.includes(LC.expect.social.host + LC.expect.social.path), "the footer link is checked against an address the answer does not give");
  assert.equal(LC.expect.progress, true);
  assert.equal(LC.expect.tables, undefined, "the page is expected to add a table");
  assert.equal(LC.expect.form, undefined, "the page is expected to carry a form");
  for (const c of LC.covers) assert.ok(Object.hasOwn(COVERAGE, c), `it covers ${c}, which no reader knows`);
  assert.deepEqual([...LC.covers], ["edit-and-addon", "several-parts", "waits-for-prerequisite", "progress-each-part", "step-question", "answer-resumes"]);
  assert.equal(readUiScenario("lv-combined", SLUG).ok, true);
  assert.equal(readUiScenario("lv-combined", "fretwork-1").ok, false);
  assert.equal(blocksPost("POST", "/api/site/react-revise", LC), true, "the wall lets a rewrite through");
});

test("FRESH ON THE BAKERY: no other scenario asked for the Allergens page, a TikTok link or the Order heading", () => {
  for (const [k, sc] of Object.entries(UI_SCENARIOS)) {
    if (k === "lv-combined") continue;
    for (const st of sc.steps || []) assert.ok(!/Allergen|TikTok|tiktok|Pick a loaf and a collection slot/.test(st.say || ""), `${k} already asked for this`);
  }
});

test("THE PLAN carries the three messages word for word, names the scenario, its budget, its hard cap and what to raise the balance to; THE FORM names it with the same figures", () => {
  for (const m of [M1, M2, M3]) assert.ok(PLAN.includes(m), `the release plan does not carry: ${m.slice(0, 60)}…`);
  assert.ok(PLAN.includes("`lv-combined`"), "the release plan does not name the scenario");
  assert.ok(PLAN.includes(`**The budget, ${LC.budget}**`) && PLAN.includes(`**The hard cap, ${LC.cap}**`), "the plan's budget or cap is not the scenario's");
  assert.ok(PLAN.includes(`raise the balance from 10 to exactly ${LC.cap}`), "the plan does not say what to raise the balance to");
  assert.match(FLOW, /lv-combined \(the combined release check on fold-lane-bakery/, "the form does not name the scenario");
  assert.ok(FLOW.includes(`sends nothing unless the balance is between ${LC.budget} and ${LC.cap}`), "the form's budget and cap are not the scenario's");
  assert.ok(FLOW.includes(`# budget (${LC.budget}) and its hard cap (${LC.cap}). The changes stay.`), "the workflow's note on the press names another budget or cap");
});

// ── THE PRESS, DRIVEN THROUGH THE STAND-IN APP ───────────────────────────────

const KA = "lvcomb" + "0".repeat(17) + "1";
const KB = "lvcomb" + "0".repeat(17) + "2";
const L = (n, text, ms) => ({ n, ms, text });
const LINK = "Put a link to the new Allergens page in the menu";
const PAGE = "add an Allergens page saying all our loaves are baked in one kitchen …";
const HEAD = "Change the Order page heading …";
const TIK = "add a link to our TikTok in the footer";
const SAY = (thing) => ({ planned: `I'll ${thing}.`, doing: `I'm going to ${thing} now.`, waiting: `I need an answer before I ${thing}.`, unconfirmed: `I tried to ${thing}, but can't tell yet whether it went through.`, done: `I've done it: ${thing}.`, partial: `I've done part of it: ${thing}.`, notdone: `I couldn't ${thing}.` });
const S_LINK = SAY("put the Allergens page in the menu"), S_PAGE = SAY("add your Allergens page"), S_HEAD = SAY("change the Order heading"), S_TIK = SAY("add your TikTok to the footer");
const L1 = "I've worked out the Allergens page you asked for, and I'm writing it now.";
const L2 = "I've written the Allergens page, and I'm putting it on your site.";
const L3 = "I'm putting the Allergens page in every menu.";
// MESSAGE 1: the link waits, blocked, while the page is made; then it runs.
const LINK_BLOCKED = part(0, LINK, "blocked", { said: S_LINK });
const PAGE_AT = (status, progress, over = {}) => part(1, PAGE, status, { route: "addon", ids: ["a1"], said: S_PAGE, progress, ...over });
const A_VIEWS = [
  view(KA, [LINK_BLOCKED, PAGE_AT("started", [])]),
  view(KA, [LINK_BLOCKED, PAGE_AT("started", [])]),
  view(KA, [LINK_BLOCKED, PAGE_AT("started", [L(0, L1, 4000)])]),
  view(KA, [LINK_BLOCKED, PAGE_AT("started", [L(0, L1, 4000), L(1, L2, 90000)])]),
  view(KA, [part(0, LINK, "started", { route: "nav", ids: ["n1"], said: S_LINK, progress: [L(0, L3, 2000)] }), PAGE_AT("done", [L(0, L1, 4000), L(1, L2, 90000)], { jobs: ["a1"] })]),
  view(KA, [part(0, LINK, "done", { route: "nav", ids: ["n1"], jobs: ["n1"], said: S_LINK, progress: [L(0, L3, 2000)] }), PAGE_AT("done", [L(0, L1, 4000), L(1, L2, 90000)], { jobs: ["a1"] })], { ended: true }),
];
// THE ROUTER'S ORDER, as R1's was: the link (change 0) after the page (change 1).
const A_ROUTE = { intent: "edit", layer: "nav", alsoAsked: [PAGE], dependsOn: [{ change: 0, after: [1] }] };
// MESSAGE 2: the heading done, then the link's step asks for the address.
const Q = { id: "q-tiktok-1", text: "What's the address of your TikTok?" };
const HEAD_DONE = part(0, HEAD, "done", { route: "text", ids: ["h1"], jobs: ["h1"], said: S_HEAD });
const B_VIEWS = [
  view(KB, [part(0, HEAD, "started", { route: "text", ids: ["h1"], said: S_HEAD }), part(1, TIK, "ready", { said: S_TIK })]),
  view(KB, [HEAD_DONE, part(1, TIK, "started", { route: "addon", ids: ["t1"], said: S_TIK })]),
  view(KB, [HEAD_DONE, part(1, TIK, "waiting", { route: "addon", ids: ["t1"], jobs: ["t1"], said: S_TIK, question: { ...Q } })]),
];
// MESSAGE 3, THE ANSWER: the part resumed, the link added, the request ended.
const ANSWER_VIEWS = [
  view(KB, [HEAD_DONE, part(1, TIK, "started", { route: "addon", ids: ["t1", "t2"], jobs: ["t1"], said: S_TIK })]),
  view(KB, [HEAD_DONE, part(1, TIK, "done", { route: "addon", ids: ["t1", "t2"], jobs: ["t1", "t2"], said: S_TIK })], { ended: true }),
];
const REPLIES = {
  a1: { ok: true, msg: "✅ Done.", reply: "I've added your Allergens page.", replySource: "model" },
  n1: { ok: true, msg: "✅ Done.", reply: "The Allergens page is in every menu now.", replySource: "model" },
  h1: { ok: true, msg: "✅ Done.", reply: "The Order page heading now reads \"Choose your loaf and a collection time\".", replySource: "model" },
  t1: { ok: true, msg: "Question", reply: Q.text, replySource: "model", clarify: { ...Q } },
  t2: { ok: true, msg: "✅ Done.", reply: "Your TikTok is in every footer now.", replySource: "model" },
};
const FRESH = { access_token: "fresh-token", refresh_token: "fresh-r", expires_at: 2_000_000_000, user: { id: "22175f41-6fbf-49d7-b039-a65078a0141c" } };
const plans = (over = {}) => (n) => (n === 0
  ? { request: { key: KA, views: over.a || A_VIEWS }, route: A_ROUTE }
  : { request: { key: KB, views: over.b || B_VIEWS }, route: { intent: "edit", layer: "text", alsoAsked: [TIK] } });
const lcApp = (over = {}) => rqApp({ progress: true, fresh: true, replies: REPLIES, answerViews: ANSWER_VIEWS, send: plans(over), ...over.app });
const listed = (h) => async () => { const r = await h.requestsNow(); return { ...r, json: { ...r.json, jobs: [] } }; };
const lcDrive = (h, over = {}) => drive(h, LC, { requestsNow: listed(h), freshSession: async () => FRESH, balanceNow: async () => 40, firstLineMs: 2_000, freshAwayMs: 5, stepMs: 4_000, stepCapMs: 4_000, ...over });

test("END TO END: message 1 is followed to its end in a fresh browser session after a live line, the link waiting for the page; message 2 goes from that tab and ends on the step's question with nothing else running; message 3 answers it and the request ends — every request check, every progress check and every reply passes, and each coverage the press is for is covered", async () => {
  const h = lcApp();
  const rec = await lcDrive(h);
  assert.equal(rec.stopped, null, JSON.stringify(rec.stopped));
  assert.equal(rec.sent, 3);
  assert.deepEqual(rec.steps.map((s) => s.mode), ["fresh", "question", ""]);
  // MESSAGE 1, IN A FRESH BROWSER SESSION.
  const f = rec.steps[0].fresh;
  assert.equal(f.first.part, 1);
  assert.equal(f.first.line, L1);
  assert.equal(f.closedRunning, true);
  assert.equal(h.tabs[0].closed, true, "the sending tab was not closed");
  assert.equal(h.contexts.length, 2, "no second context was opened");
  // MESSAGES 2 AND 3 GO FROM THE TAB THE FRESH SESSION OPENED.
  assert.equal(rec.steps[1].tabAtSend.origin, rec.steps[2].tabAtSend.origin);
  assert.notEqual(rec.steps[1].tabAtSend.origin, h.tabs[0].origin, "message 2 went from the closed first tab");
  // MESSAGE 2'S QUESTION, AND MESSAGE 3 RESUMING IT.
  assert.deepEqual({ by: rec.steps[1].question.by, key: rec.steps[1].question.key, part: rec.steps[1].question.part, id: rec.steps[1].question.id }, { by: "step", key: KB, part: 1, id: Q.id });
  // EACH MESSAGE'S OWN JOBS, PART BY PART (the link is part 0), NONE COUNTED TWICE.
  assert.deepEqual(rec.steps.map((s) => s.jobs), [["n1", "a1"], ["h1", "t1"], ["t2"]]);
  const v = requestBatchVerdict({ spec: LC, steps: rec.steps, before: { render: {} }, after: { render: {} }, served: {}, tables: {} });
  const own = v.checks.filter((c) => /^message \d/.test(c.name));
  assert.ok(own.length >= 14, `only ${own.length} message checks were made`);
  assert.deepEqual(failed(own), []);
  assert.ok(own.some((c) => c.name === "message 1: no part started before a part it needs had finished"), "the order was not judged, or judged vacuously");
  assert.ok(own.some((c) => /^message 2 ended on one part waiting with a step's question/.test(c.name)));
  assert.deepEqual(failed(progressChecks({ steps: rec.steps })), []);
  assert.equal(progressChecks({ steps: rec.steps }).length, 8);
  assert.ok(v.checks.some((c) => /fresh browser session, signed in afresh/.test(c.name)), "the progress checks are not in the press's verdict");
  assert.deepEqual(failed(replyChecks(rec.steps)), []);
  const cov = coverageOf({ spec: LC, steps: rec.steps });
  assert.deepEqual(cov.filter((c) => !c.covered).map((c) => `${c.name}: ${c.why}`), []);
  assert.equal(cov.length, 6);
});

test("A LINK THAT RAN BEFORE ITS PAGE WAS DONE fails message 1's order check by name, and the coverage says why", async () => {
  const early = A_VIEWS.map((x, i) => (i === 2 ? view(KA, [part(0, LINK, "started", { route: "nav", ids: ["n1"], said: S_LINK }), PAGE_AT("started", [L(0, L1, 4000)])]) : x));
  const rec = await lcDrive(lcApp({ a: early }));
  const v = requestBatchVerdict({ spec: LC, steps: rec.steps, before: { render: {} }, after: { render: {} }, served: {}, tables: {} });
  const order = v.checks.find((c) => c.name === "message 1: no part started before a part it needs had finished");
  assert.ok(order && !order.ok, "the order check passed a link that ran before its page");
  assert.match(order.why, /part 0 was started while part 1, which it needs, was started/);
  const cov = coverageOf({ spec: LC, steps: rec.steps }).find((c) => c.name === "waits-for-prerequisite");
  assert.equal(cov.covered, false);
});

// ── THE STOP CONDITIONS ──────────────────────────────────────────────────────

test("NO QUESTION: message 2's request ends without asking, so the answer is NOT sent and the press says why", async () => {
  const asked = [B_VIEWS[0], view(KB, [HEAD_DONE, part(1, TIK, "done", { route: "addon", ids: ["t1"], jobs: ["t1"], said: S_TIK })], { ended: true })];
  const h = lcApp({ b: asked, app: { replies: { ...REPLIES, t1: { ok: true, msg: "✅ Done.", reply: "Your TikTok is in the footer.", replySource: "model" } } } });
  const rec = await lcDrive(h);
  assert.equal(rec.sent, 2);
  assert.match(rec.stopped.msg, /message 2 ended without the question message 3 answers — message 3 is NOT sent/);
  const v = requestBatchVerdict({ spec: LC, steps: rec.steps, before: { render: {} }, after: { render: {} }, served: {}, tables: {} });
  assert.ok(failed(v.checks).some((b) => /^message 3 was sent — it was not sent/.test(b)), JSON.stringify(failed(v.checks)));
});

test("PROGRESS OFF, OR A BALANCE OUTSIDE 38 TO 40: the first message is typed and NOT sent — no routing call, nothing charged", async () => {
  const off = lcApp();
  const rec1 = await lcDrive(off, { requestsNow: async () => ({ status: 200, json: { ok: true, requests: [] } }) });
  assert.equal(rec1.sent, 0);
  assert.match(rec1.stopped.msg, /progress is off.*nothing is sent/);
  const high = lcApp();
  const rec2 = await lcDrive(high, { balanceNow: async () => 41 });
  assert.equal(rec2.sent, 0);
  assert.match(rec2.stopped.msg, /above this press's hard cap of 40/);
  const low = lcApp();
  const rec3 = await lcDrive(low, { balanceNow: async () => 37 });
  assert.equal(rec3.sent, 0);
  assert.match(rec3.stopped.msg, /does not cover this press's budget of 38/);
  for (const h of [off, high, low]) assert.ok(!h.calls.some((c) => c === "tab 1 click #stSend"), "a message was sent");
  // AT EITHER END OF THE RANGE, IT IS SENT.
  for (const at of [38, 40]) assert.equal((await lcDrive(lcApp(), { balanceNow: async () => at })).sent, 3, `a balance of ${at} was refused`);
});

test("THE BUDGET, BEFORE EACH LATER MESSAGE: once the press has spent its 38, nothing more is sent", async () => {
  const seq = [40, 40, 2];
  const h = lcApp();
  const rec = await lcDrive(h, { balanceNow: async () => (seq.length > 1 ? seq.shift() : seq[0]) });
  assert.equal(rec.sent, 1);
  assert.match(rec.stopped.msg, /^the scenario has spent 38 of its 38-credit budget — nothing more is sent/);
});

test("MESSAGE 1 NEVER ENDS: its outcome is unknown, and messages 2 and 3 are NOT sent", async () => {
  const stuck = A_VIEWS.slice(0, 4);
  const h = lcApp({ a: stuck });
  const rec = await lcDrive(h, { stepMs: 300, stepCapMs: 300, firstLineMs: 100 });
  assert.equal(rec.sent, 1);
  assert.match(rec.stopped.msg, /nothing more is sent/);
  assert.equal(rec.steps.length, 1);
});
