// THE PROGRESS LIVE CHECK, PREPARED (2026-10-06): the owner, after Codex
// confirmed the progress corrections on 7abe6c3d: *"…prepare one release plus
// one combined live Edit/Add-on verification using the existing canary and a
// demo site. Choose fresh changes that exercise both routes automatically,
// capture actual first-person progress before completion, verify the
// published results and final replies, and check recovery after closing the
// originating tab and reopening on a fresh browser session. Record the real
// model wording, attempts, tokens, latency and platform narration cost,
// confirming narration adds no customer charge."*
//
// Free and offline: the press is driven through the stand-in app in request
// mode (test/fixtures/canary-rq-app.mjs), the narration's usage is read from
// supplied log events, and nothing reaches a network.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import util from "node:util";
import os from "node:os";
import path from "node:path";
import {
  UI_SCENARIOS, readUiScenario, stepBoundMs, UI_STEP_MAX_MS, UI_PRESS_MAX_MS, UI_FIRST_LINE_MS, UI_FRESH_AWAY_MS,
  blocksPost, capRefusal, progressOnRefusal, progressSnapshot, keepSnapshot, liveOnItsPart, narrationChargeVerdict, ownMoneyVerdict, describeUi,
} from "../scripts/canary-ui.mjs";
import { progressChecks, requestBatchVerdict, replyChecks, coverageOf, COVERAGE } from "../scripts/canary-requests.mjs";
import { rqApp, part, view, drive, SLUG } from "./fixtures/canary-rq-app.mjs";
import * as NU from "../scripts/narration-usage.mjs";

const ROOT = new URL("../", import.meta.url).pathname;
const failed = (checks) => checks.filter((c) => !c.ok).map((c) => `${c.name} — ${c.why}`);
const LP = UI_SCENARIOS["lv-progress"];
const WORDS = "Add an FAQ page with a link in the menu, answering what customers ask us most: how long a sourdough loaf keeps, how best to store it, and when we're open. And change the Classes page heading 'Spend a Saturday morning with the starter' to 'Spend a Saturday morning at the bench'.";
const PLAN = fs.readFileSync(ROOT + "docs/investigations/progress-release-plan.md", "utf8");

// ── THE SCENARIO ─────────────────────────────────────────────────────────────

test("lv-progress: on the bakery, in request mode, the plan's one message word for word — an FAQ page and the Classes heading — its tab closed once progress shows and read in a fresh browser session, inside its budget, its hard cap, its walls and its time", () => {
  assert.ok(LP, "no lv-progress scenario");
  assert.equal(LP.site, "fold-lane-bakery");
  assert.equal(LP.request, true);
  assert.equal(LP.addon, true, "the add-on part cannot run");
  assert.deepEqual([...LP.layers], ["text", "look", "nav", "page"]);
  assert.ok(!LP.layers.includes("rules") && !LP.layers.includes("data") && !LP.layers.includes("picture") && LP.adds !== true);
  assert.equal(LP.budget, 28);
  assert.equal(LP.fundsFirst, true, "the press can start short");
  assert.equal(LP.cap, 32, "the press names no hard cap");
  assert.ok(LP.cap >= LP.budget, "the cap is below the budget, so no balance passes both");
  assert.equal(LP.steps.length, 1);
  assert.equal(LP.steps[0].say, WORDS);
  assert.equal(LP.steps[0].away, "fresh", "the message is not read in a fresh browser session");
  assert.ok(stepBoundMs(LP.steps[0]) <= UI_STEP_MAX_MS && LP.steps.reduce((t, x) => t + stepBoundMs(x), 0) <= UI_PRESS_MAX_MS);
  // THE TWO WAITS FIT INSIDE THE MESSAGE'S OWN BOUND, with room for the work.
  assert.ok(UI_FIRST_LINE_MS + UI_FRESH_AWAY_MS < stepBoundMs(LP.steps[0]) / 2);
  assert.deepEqual(JSON.parse(JSON.stringify(LP.expect.headings)), [{ route: "/classes", from: "Spend a Saturday morning with the starter", to: "Spend a Saturday morning at the bench" }]);
  assert.deepEqual([...LP.expect.pages[0].about], ["keep", "store"]);
  // NO WORDS FOR THE LINK: the message names none (run 105; `labelFits`).
  assert.deepEqual({ ...LP.expect.menu }, { page: 0 });
  assert.equal(LP.expect.progress, true);
  assert.equal(LP.expect.tables, undefined, "the FAQ page is expected to add a table");
  assert.equal(readUiScenario("lv-progress", SLUG).ok, true);
  assert.equal(readUiScenario("lv-progress", "fretwork-1").ok, false);
  assert.equal(blocksPost("POST", "/api/site/react-revise", LP), true);
  for (const c of LP.covers) assert.ok(Object.hasOwn(COVERAGE, c), `it covers ${c}, which no reader knows`);
  // THE PLAN CARRIES THE MESSAGE WORD FOR WORD, and names the scenario.
  assert.ok(PLAN.includes(WORDS), "the release plan does not carry the message");
  assert.ok(PLAN.includes("`lv-progress`"), "the release plan does not name the scenario");
  assert.ok(PLAN.includes(`**The budget, ${LP.budget}**`) && PLAN.includes(`**The hard cap, ${LP.cap}**`), "the plan's budget or cap is not the scenario's");
  assert.ok(PLAN.includes(`raise the balance from 9 to exactly ${LP.cap}`), "the plan does not say what to raise the balance to");
  // FRESH ON THE BAKERY: no earlier scenario touched this heading or asked for this page.
  for (const [k, sc] of Object.entries(UI_SCENARIOS)) {
    if (k === "lv-progress") continue;
    for (const st of sc.steps || []) assert.ok(!/Spend a Saturday morning|FAQ/.test(st.say || ""), `${k} already asked for this`);
  }
});

// ── THE FREE REFUSALS ────────────────────────────────────────────────────────

test("THE HARD CAP: a press that names one sends nothing while the balance is above it; at or below it, or with none named, nothing is refused; an unreadable balance or a cap that is not a number refuses", () => {
  assert.equal(capRefusal({ now: 30, cap: 30 }), "");
  assert.equal(capRefusal({ now: 25, cap: 30 }), "");
  assert.equal(capRefusal({ now: 999, cap: undefined }), "", "a press with no cap is refused");
  assert.match(capRefusal({ now: 31, cap: 30 }), /above this press's hard cap of 30/);
  assert.match(capRefusal({ now: Number.NaN, cap: 30 }), /could not be read/);
  assert.match(capRefusal({ now: 10, cap: "30" }), /not a number/);
  assert.match(capRefusal({ now: 10, cap: 0 }), /not a number/);
});

test("PROGRESS ON: read for free off the requests list — it carries `jobs` only with progress on; without it, or with no answer, nothing is sent", () => {
  assert.equal(progressOnRefusal({ status: 200, json: { ok: true, requests: [], jobs: [] } }), "");
  assert.match(progressOnRefusal({ status: 200, json: { ok: true, requests: [] } }), /progress is off/);
  assert.match(progressOnRefusal({ status: 503, json: { error: "x" } }), /did not answer \(503\)/);
  assert.match(progressOnRefusal(null), /did not answer \(no answer\)/);
});

test("THE PRESS'S PREFLIGHT, IN ORDER: with progress off, or the balance above the cap or below the budget, the message is typed and NOT sent — no routing call, nothing charged", async () => {
  const views = [view("lvprog" + "0".repeat(17) + "1", [part(0, "Add an FAQ page …", "started", { route: "addon", ids: ["f1"] })], { ended: true })];
  const send = () => ({ request: { key: views[0].key, views }, route: { intent: "addon" } });
  const off = rqApp({ progress: true, fresh: true, send });
  const rec1 = await drive(off, LP, { requestsNow: async () => ({ status: 200, json: { ok: true, requests: [] } }), freshSession: async () => null, balanceNow: async () => 30 });
  assert.equal(rec1.sent, 0);
  assert.match(rec1.stopped.msg, /progress is off.*nothing is sent/);
  assert.equal(rec1.steps[0].progressOn, false, "a Worker that does not narrate was recorded as narrating");
  const high = rqApp({ progress: true, fresh: true, send });
  const rec2 = await drive(high, LP, { balanceNow: async () => 33, freshSession: async () => null });
  assert.equal(rec2.sent, 0);
  assert.match(rec2.stopped.msg, /above this press's hard cap of 32/);
  const low = rqApp({ progress: true, fresh: true, send });
  const rec3 = await drive(low, LP, { balanceNow: async () => 27, freshSession: async () => null });
  assert.equal(rec3.sent, 0);
  assert.match(rec3.stopped.msg, /does not cover this press's budget of 28/);
  for (const h of [off, high, low]) assert.ok(!h.calls.some((c) => /click #stSend/.test(c)), "the message was sent");
});

// ── WHAT THE CUSTOMER WAS SHOWN ──────────────────────────────────────────────

const KEY = "lvprog" + "0".repeat(17) + "2";
const SAID0 = { planned: "I'll add an FAQ page.", doing: "I'm adding your FAQ page now.", waiting: "I need an answer before I add the FAQ page.", unconfirmed: "I tried to add the FAQ page, but can't tell yet whether it went through.", done: "I've added your FAQ page.", partial: "I've added part of the FAQ page.", notdone: "I couldn't add the FAQ page." };
const SAID1 = { planned: "I'll change the Classes heading.", doing: "I'm changing the Classes heading now.", waiting: "I need an answer before I change the heading.", unconfirmed: "I changed the heading but can't tell yet whether it went through.", done: "I've changed the Classes heading.", partial: "I've changed part of the heading.", notdone: "I couldn't change the heading." };
const L = (n, text, ms) => ({ n, ms, text });
const L1 = "I've worked out the FAQ page you asked for, and I'm designing it now.";
const L2 = "I've written the FAQ page's questions and answers, and I'm putting it on your site.";
const L3 = "I'm changing the Classes heading to 'Spend a Saturday morning at the bench'.";
// THE FIRST LOOKS SEE THE PART RUNNING WITH NO LINE YET (each look moves the
// stand-in's request on, as the page's own polling does), then the lines come.
const NO_LINE = view(KEY, [part(0, "Add an FAQ page …", "started", { route: "addon", ids: ["f1"], said: SAID0 }), part(1, "change the Classes page heading …", "ready", { said: SAID1 })]);
const LP_VIEWS = [
  NO_LINE, NO_LINE,
  view(KEY, [part(0, "Add an FAQ page …", "started", { route: "addon", ids: ["f1"], said: SAID0 }), part(1, "change the Classes page heading …", "ready", { said: SAID1 })]),
  view(KEY, [part(0, "Add an FAQ page …", "started", { route: "addon", ids: ["f1"], said: SAID0, progress: [L(0, L1, 4000)] }), part(1, "change the Classes page heading …", "ready", { said: SAID1 })]),
  view(KEY, [part(0, "Add an FAQ page …", "started", { route: "addon", ids: ["f1"], said: SAID0, progress: [L(0, L1, 4000), L(1, L2, 90000)] }), part(1, "change the Classes page heading …", "ready", { said: SAID1 })]),
  view(KEY, [part(0, "Add an FAQ page …", "done", { route: "addon", ids: ["f1"], jobs: ["f1"], said: SAID0, progress: [L(0, L1, 4000), L(1, L2, 90000)] }), part(1, "change the Classes page heading …", "started", { route: "text", ids: ["c1"], said: SAID1, progress: [L(0, L3, 3000)] })]),
  view(KEY, [part(0, "Add an FAQ page …", "done", { route: "addon", ids: ["f1"], jobs: ["f1"], said: SAID0, progress: [L(0, L1, 4000), L(1, L2, 90000)] }), part(1, "change the Classes page heading …", "done", { route: "text", ids: ["c1"], jobs: ["c1"], said: SAID1, progress: [L(0, L3, 3000)] })], { ended: true }),
];
const FRESH = { access_token: "fresh-token", refresh_token: "fresh-r", expires_at: 2_000_000_000, user: { id: "22175f41-6fbf-49d7-b039-a65078a0141c" } };
const lpApp = (over = {}) => rqApp({
  progress: true, fresh: true,
  replies: { f1: { ok: true, msg: "✅ Done.", reply: "I've added your FAQ page, with a link in the menu.", replySource: "model" }, c1: { ok: true, msg: "✅ Done.", reply: "The Classes page heading now reads \"Spend a Saturday morning at the bench\".", replySource: "model" } },
  send: () => ({ request: { key: KEY, views: LP_VIEWS }, route: { intent: "addon" } }),
  ...over,
});
const listed = (h) => async () => { const r = await h.requestsNow(); return { ...r, json: { ...r.json, jobs: [] } }; };
const lpDrive = (h, over = {}, scenario = LP) => drive(h, scenario, { requestsNow: listed(h), freshSession: async () => FRESH, balanceNow: async () => 30, firstLineMs: 2_000, freshAwayMs: 5, stepMs: 4_000, stepCapMs: 4_000, ...over });

test("END TO END: the first line is read in the tab that sent the message while the request still runs; that tab is closed; the list alone is read; a fresh browser session, signed in afresh, finds the request on the server, shows every earlier line again, and follows it to its end, each part named by the model's own line for its state — and every check passes", async () => {
  const h = lpApp();
  const rec = await lpDrive(h);
  assert.equal(rec.stopped, null, JSON.stringify(rec.stopped));
  assert.equal(rec.sent, 1);
  const s = rec.steps[0];
  assert.equal(s.mode, "fresh");
  assert.equal(s.progressOn, true);
  const f = s.fresh;
  // THE FIRST LINE, IN THE SENDING TAB, BEFORE THE END.
  assert.equal(f.first.part, 0);
  assert.equal(f.first.line, L1);
  assert.equal(f.closedRunning, true);
  assert.equal(h.tabs[0].closed, true, "the sending tab was not closed");
  // WITH NO PAGE OPEN, THE LIST ALONE.
  assert.ok(f.away.reads > 0 && f.away.calls.length === 0);
  // THE FRESH SESSION: a second context, planted with the second session, and nothing of the first's.
  assert.equal(h.contexts.length, 2, "no second context was opened");
  assert.equal(JSON.parse(h.contexts[1].inits[0].value).access_token, "fresh-token", "the fresh context was planted with the first session");
  assert.equal(JSON.parse(h.contexts[0].inits[0].value).access_token, "a");
  assert.notEqual(h.contexts[1].keep, h.contexts[0].keep);
  assert.equal(f.reopened.found, true);
  assert.equal(f.reopened.closed, true);
  assert.equal(f.reopened.newSession, true);
  assert.equal(f.reopened.sameAccount, true);
  // WHAT EACH SAW, KEPT AS IT CHANGED.
  assert.ok(f.before.length >= 2 && f.after.length >= 1);
  assert.deepEqual(failed(progressChecks({ steps: rec.steps })), []);
  assert.equal(progressChecks({ steps: rec.steps }).length, 8);
  assert.deepEqual(failed(replyChecks(rec.steps)), []);
  // THE PRESS'S VERDICT CARRIES THEM, for a scenario that asks; another does not get them.
  const v = requestBatchVerdict({ spec: LP, steps: rec.steps, before: { render: {} }, after: { render: {} }, served: {}, tables: {} });
  assert.ok(v.checks.some((c) => /fresh browser session, signed in afresh/.test(c.name)), "the progress checks are not in the press's verdict");
  const other = requestBatchVerdict({ spec: UI_SCENARIOS["lv-release"], steps: rec.steps, before: { render: {} }, after: { render: {} }, served: {}, tables: {} });
  assert.ok(!other.checks.some((c) => /fresh browser session/.test(c.name)), "a scenario that does not ask was judged on progress");
  // COVERAGE: both parts showed a line.
  const cov = coverageOf({ spec: LP, steps: rec.steps }).find((c) => c.name === "progress-each-part");
  assert.equal(cov.covered, true, cov.why);
  // A PART THAT NEVER SHOWED A LINE IS NOT COVERED, and says which.
  const one = JSON.parse(JSON.stringify(rec.steps));
  for (const x of [...one[0].fresh.before, ...one[0].fresh.after]) for (const p of x.parts) if (p.n === 1) p.lines = [];
  const half = coverageOf({ spec: LP, steps: one }).find((c) => c.name === "progress-each-part");
  assert.equal(half.covered, false);
  assert.match(half.why, /part 1: 0 line\(s\)/);
  // THE ACCOUNT WRITES THE WORDS OUT WHOLE.
  const told = describeUi(rec);
  assert.match(told, /first line on screen \d+ s after the send, part 0 \(started\): "I've worked out the FAQ page/);
  for (const w of [L1, L2, L3, SAID0.doing, SAID0.done, SAID1.done]) assert.ok(told.includes(w), `the account leaves out: ${w}`);
});

test("NO LINE BEFORE THE END: a request that ends before any line is shown fails the first two checks by name — the rest are still read", async () => {
  const quiet = LP_VIEWS.map((v) => ({ ...v, parts: v.parts.map((p) => ({ ...p, progress: [] })) }));
  const h = lpApp({ send: () => ({ request: { key: KEY, views: [quiet[quiet.length - 1]] }, route: { intent: "addon" } }) });
  const rec = await lpDrive(h);
  const bad = failed(progressChecks({ steps: rec.steps }));
  assert.ok(bad.some((b) => /^a progress line was on screen in the tab that sent the message, live on its own running part, while the request still ran — the request had ended/.test(b)), JSON.stringify(bad));
  assert.ok(bad.some((b) => /^the tab that sent it was then closed, the request still running/.test(b)), JSON.stringify(bad));
  assert.ok(bad.some((b) => /^the fresh session showed every progress line the sending tab had shown — the sending tab showed no line/.test(b)));
  assert.ok(!bad.some((b) => /signed in afresh/.test(b)), "recovery was not still read");
  // AND LINES FIRST SEEN ON AN ENDED CARD ARE NOT PROGRESS BEFORE COMPLETION.
  const h2 = lpApp({ send: () => ({ request: { key: KEY, views: [LP_VIEWS[LP_VIEWS.length - 1]] }, route: { intent: "addon" } }) });
  const rec2 = await lpDrive(h2);
  assert.equal(rec2.steps[0].fresh.first, null, "a line read off the ended card counted as shown before the end");
  assert.equal(rec2.steps[0].fresh.away.ended, true, "the list showed the request ended with no page open, and that was not recorded");
  // …AND A READING OF THE ENDED REQUEST IS NEVER "BEFORE THE END", even one
  // whose part still reads as running with a line live (a page out of step).
  const lagging = view(KEY, [part(0, "Add an FAQ page …", "started", { route: "addon", ids: ["f1"], said: SAID0, progress: [L(0, L1, 4000)] })], { ended: true });
  const h3 = lpApp({ send: () => ({ request: { key: KEY, views: [lagging] }, route: { intent: "addon" } }) });
  const rec3 = await lpDrive(h3);
  assert.ok(rec3.steps[0].fresh.before.some((x) => x.ended && x.parts.some((p) => p.live === L1)), "the ended reading with a live line was never on screen, so this case shows nothing");
  assert.equal(rec3.steps[0].fresh.first, null, "a line read off the ended request was taken as shown before the end");
  assert.ok(failed(progressChecks({ steps: rec2.steps })).some((b) => /while the request still ran — the request had ended before any line was shown live/.test(b)));
});

// CODEX'S REPRODUCTION (2026-10-06): the add-on part is already done when the
// sending tab first looks, its lines kept on its card, and the heading part
// is still queued; that part then runs with no line of its own. No progress
// line is ever live on a running part in the sending tab. The old driver took
// the done part's kept line as the first line, and all eight checks passed.
const DONE0 = part(0, "Add an FAQ page …", "done", { route: "addon", ids: ["f1"], jobs: ["f1"], said: SAID0, progress: [L(0, L1, 4000), L(1, L2, 90000)] });
const P1 = (status, over = {}) => part(1, "change the Classes page heading …", status, { said: SAID1, ...over });
const RETAINED = [
  view(KEY, [DONE0, P1("ready")]), view(KEY, [DONE0, P1("ready")]), view(KEY, [DONE0, P1("ready")]),
  // THE HEADING PART RUNS LONG ENOUGH for the fresh session to see it running
  // and named by its doing line: on the old driver, every check then passed.
  ...Array(10).fill(view(KEY, [DONE0, P1("started", { route: "text", ids: ["c1"] })])),
  view(KEY, [DONE0, P1("done", { route: "text", ids: ["c1"], jobs: ["c1"] })], { ended: true }),
];

test("A KEPT LINE IS NOT PROGRESS (Codex's false positive, a failing control): a done part's lines while another part is queued are never taken as the first line — only a line live on its own running part is — and the press fails its first check by name", async () => {
  const h = lpApp({ send: () => ({ request: { key: KEY, views: RETAINED }, route: { intent: "addon" } }) });
  const rec = await lpDrive(h);
  const f = rec.steps[0].fresh;
  assert.equal(f.first, null, `a kept line was taken as the first progress line: ${JSON.stringify(f.first)}`);
  // THE SENDING TAB SAW THE KEPT LINES, AND NO LIVE ONE: the control is real.
  assert.ok(f.before.some((x) => x.parts.some((p) => p.n === 0 && p.status === "done" && p.lines.length === 2)), "the kept lines were never on screen, so this case shows nothing");
  assert.ok(!f.before.some((x) => x.parts.some((p) => p.live)), "a line was live after all");
  const bad = failed(progressChecks({ steps: rec.steps }));
  assert.ok(bad.some((b) => /^a progress line was on screen in the tab that sent the message, live on its own running part, while the request still ran — /.test(b)), JSON.stringify(bad));
  // AND A LINE THAT IS LIVE ON ITS RUNNING PART, LATER, IS THE FIRST ONE.
  // ITS PART HAS TWO LINES BY THEN: the first line is the live one, not the oldest.
  const LIT = P1("started", { route: "text", ids: ["c1"], progress: [L(0, "I've found the heading on the Classes page.", 2000), L(1, L3, 3000)] });
  const later = [...RETAINED.slice(0, 3), ...Array(10).fill(view(KEY, [DONE0, LIT])), RETAINED[RETAINED.length - 1]];
  const h2 = lpApp({ send: () => ({ request: { key: KEY, views: later }, route: { intent: "addon" } }) });
  const rec2 = await lpDrive(h2);
  assert.deepEqual({ part: rec2.steps[0].fresh.first.part, status: rec2.steps[0].fresh.first.status, line: rec2.steps[0].fresh.first.line }, { part: 1, status: "started", line: L3 });
  assert.ok(!failed(progressChecks({ steps: rec2.steps })).some((b) => /^a progress line was on screen/.test(b)));
});

test("WITH NO PAGE OPEN, A READ OF THE REQUEST'S OWN ROUTE is caught and fails its check by name", async () => {
  const h = lpApp({ readWhileAway: true });
  const rec = await lpDrive(h, { freshAwayMs: 50 });
  assert.ok(rec.steps[0].fresh.away.calls.length >= 1, "the read was not recorded");
  assert.ok(failed(progressChecks({ steps: rec.steps })).some((b) => /its own route was read \d+ time\(s\) with no page open/.test(b)));
});

test("REOPENED WHILE IT RUNS: the fresh session opens on a request still running, shows its card and lines live, and is followed to the real end — never taken as ended at first sight", async () => {
  // THE STAND-IN MOVES ONE VIEW ON PER LOOK, and opening a workspace takes
  // several: so this request runs longer after its second line than the end
  // to end case's, enough for the fresh session to open on it still running.
  const long = [...LP_VIEWS.slice(0, 5), ...Array(10).fill(LP_VIEWS[4]), ...LP_VIEWS.slice(5)];
  const h = lpApp({ send: () => ({ request: { key: KEY, views: long }, route: { intent: "addon" } }) });
  const rec = await lpDrive(h, { freshAwayMs: 0 });
  const f = rec.steps[0].fresh;
  assert.equal(f.away.ended, false, "the request ended before the fresh session opened, so this case shows nothing");
  assert.equal(f.after[0].ended, false, "the fresh session's first reading was not of a running request");
  assert.equal(f.after[f.after.length - 1].ended, true);
  assert.deepEqual(failed(progressChecks({ steps: rec.steps })), []);
});

test("A LATER MESSAGE GOES FROM THE FRESH SESSION'S TAB: once that session has shown the request ended, its tab is marked as the run's and the next message is sent from it — never from the closed one", async () => {
  const KEY2 = "lvprog" + "0".repeat(17) + "3";
  const twoSteps = { ...LP, steps: Object.freeze([LP.steps[0], Object.freeze({ say: "And change the Visit page heading to 'Come and see us'.", ms: 60_000 })]) };
  const v2 = [view(KEY2, [part(0, "change the Visit page heading …", "done", { route: "text", ids: ["h1"], jobs: ["h1"] })], { ended: true })];
  const h = lpApp({
    send: (i) => (i === 0 ? { request: { key: KEY, views: LP_VIEWS }, route: { intent: "addon" } } : { request: { key: KEY2, views: v2 }, route: { intent: "edit" } }),
    replies: { f1: { ok: true, msg: "✅ Done.", reply: "I've added your FAQ page.", replySource: "model" }, c1: { ok: true, msg: "✅ Done.", reply: "The heading is changed.", replySource: "model" }, h1: { ok: true, msg: "✅ Done.", reply: "The Visit heading is changed.", replySource: "model" } },
  });
  const rec = await lpDrive(h, {}, twoSteps);
  assert.equal(rec.stopped, null, JSON.stringify(rec.stopped));
  assert.equal(rec.sent, 2);
  assert.ok(h.calls.includes("tab 2 click #stSend"), "the second message did not go from the fresh session's tab");
  assert.equal(h.calls.filter((c) => c === "tab 1 click #stSend").length, 1, "the closed tab sent again");
  assert.equal(rec.tabs.length, 2);
  assert.equal(rec.tab.mark, h.tabs[1].mark);
  assert.equal(rec.steps[1].sameTab, true);
});

test("THE FRESH SESSION THAT FINDS NOTHING: a page that never draws the request fails by name; one that could not sign in fails before it opens", async () => {
  const h = lpApp({ discover: false });
  const rec = await lpDrive(h);
  const bad = failed(progressChecks({ steps: rec.steps }));
  assert.ok(bad.some((b) => /signed in afresh as the same account, found the request on the server and drew its card — the fresh session never drew the request's card/.test(b)), JSON.stringify(bad));
  const h2 = lpApp();
  const rec2 = await lpDrive(h2, { freshSession: async () => null });
  assert.match(rec2.stopped ? rec2.stopped.msg : rec2.steps[0].why || "", /could not sign in|second session/);
  assert.equal(h2.contexts.length, 1, "a context was opened without a session");
  // A SIGN-IN THAT ANSWERS WITH NO TOKEN IS NO SESSION: nothing is opened with it.
  const h4 = lpApp();
  const rec4 = await lpDrive(h4, { freshSession: async () => ({ user: FRESH.user }) });
  assert.equal(rec4.steps[0].fresh.reopened.why, "a second session could not be opened");
  assert.equal(h4.contexts.length, 1, "a context was opened with a session that has no token");
  // A FRESH SESSION OF ANOTHER ACCOUNT is not this account's recovery, whatever it shows.
  const h5 = lpApp();
  const rec5 = await lpDrive(h5, { freshSession: async () => ({ ...FRESH, user: { id: "0d1f7e0e-0000-4000-8000-000000000000" } }) });
  assert.equal(rec5.steps[0].fresh.reopened.sameAccount, false);
  assert.ok(failed(progressChecks({ steps: rec5.steps })).some((b) => /signed in afresh as the same account.* — it was signed in as another account$/.test(b)));
  // AND A FRESH SESSION THAT IS THE FIRST TAB'S OWN IS NOT A FRESH SESSION.
  const h3 = lpApp();
  const rec3 = await lpDrive(h3, { freshSession: async () => ({ access_token: "a", user: { id: "22175f41-6fbf-49d7-b039-a65078a0141c" } }) });
  assert.ok(failed(progressChecks({ steps: rec3.steps })).some((b) => /its session was the first tab's/.test(b)));
});

// ── THE CHECKS, ONE AT A TIME ────────────────────────────────────────────────

const snap = (ms, ended, parts, closed = false) => ({ ms, ended, closed, parts });
// AS THE PAGE DRAWS IT: the newest line live only on a running part.
const P = (n, status, words, lines = [], said = null) => ({ n, status, words, label: status, lines, live: status === "started" && lines.length ? lines[lines.length - 1] : "", said });
const goodFresh = () => ({
  first: { ms: 5000, part: 0, status: "started", line: L1 }, closed: true, closedRunning: true, closedMs: 6000,
  before: [snap(1000, false, [P(0, "started", SAID0.doing, [], SAID0)]), snap(5000, false, [P(0, "started", SAID0.doing, [L1], SAID0)])],
  away: { reads: 2, calls: [], list: [{ ms: 1, status: 200, found: true }], ended: false },
  reopened: { ok: true, found: true, closed: true, why: "", newSession: true, sameAccount: true },
  after: [snap(9000, false, [P(0, "started", SAID0.doing, [L1, L2], SAID0)]), snap(20000, true, [P(0, "done", SAID0.done, [L1, L2], SAID0)], true)],
});
const stepOf = (fresh) => [{ n: 1, sent: true, mode: "fresh", fresh, network: [] }];

test("progressChecks, case by case: the good record passes all eight; each fault fails its own check by name and no other", () => {
  assert.deepEqual(failed(progressChecks({ steps: stepOf(goodFresh()) })), []);
  const only = (mutate, re) => {
    const f = goodFresh();
    mutate(f);
    const bad = failed(progressChecks({ steps: stepOf(f) }));
    assert.equal(bad.length, 1, `${re}: ${JSON.stringify(bad)}`);
    assert.match(bad[0], re);
  };
  only((f) => { f.first = null; }, /^a progress line was on screen/);
  // CODEX'S FALSE POSITIVE, AS THE OLD DRIVER RECORDED IT: the line taken was a
  // done part's kept line while the other part was queued — never live on a
  // running part. Only the first check fails, by name.
  only((f) => {
    f.first = { ms: 5000, part: 0, status: "done", line: L1 };
    f.before = [1000, 5000].map((ms) => snap(ms, false, [P(0, "done", SAID0.done, [L1], SAID0), P(1, "ready", SAID1.planned, [], SAID1)]));
  }, /^a progress line was on screen in the tab that sent the message, live on its own running part, while the request still ran — the line taken \(part 0, done\) was never live on its own running part/);
  // A FIRST LINE THE SNAPSHOTS NEVER SHOW LIVE is not taken on its word.
  only((f) => { f.first = { ...f.first, line: "A line no snapshot shows." }; }, /never live on its own running part/);
  // …nor one shown live only in a reading of the ended request, or live on another part.
  only((f) => { f.before = f.before.map((x) => ({ ...x, ended: true })); }, /never live on its own running part/);
  only((f) => { f.first = { ...f.first, part: 1 }; }, /the line taken \(part 1, started\) was never live on its own running part/);
  only((f) => { f.closedRunning = false; }, /^the tab that sent it was then closed, the request still running — the request had already ended/);
  only((f) => { f.away.calls = [{ ms: 1, method: "GET", path: "/api/site/request/x/y" }]; }, /its own route was read 1 time/);
  only((f) => { f.away.list = [{ ms: 1, status: 200, found: false }]; }, /the list never named the request/);
  only((f) => { f.reopened.newSession = false; }, /its session was the first tab's/);
  only((f) => { f.reopened.sameAccount = false; }, /another account/);
  only((f) => { f.after = f.after.map((x) => ({ ...x, parts: x.parts.map((p) => ({ ...p, lines: p.lines.filter((l) => l !== L1) })) })); }, /not shown again: "I've worked out/);
  only((f) => { f.reopened.closed = false; f.reopened.why = "the fresh session never showed the request closed"; }, /followed the request to its end.*never showed the request closed/);
  only((f) => { for (const x of [...f.before, ...f.after]) for (const p of x.parts) if (p.status === "started") p.words = "Add an FAQ page …"; }, /no running part was shown with the model's doing line/);
  // THE DOING LINE ON A PART THAT IS NOT RUNNING is not a running part named by
  // it — and with no part shown running, no line was live on one either.
  {
    const f = goodFresh();
    for (const x of [...f.before, ...f.after]) for (const p of x.parts) if (p.status === "started") p.status = "ready";
    const bad = failed(progressChecks({ steps: stepOf(f) }));
    assert.equal(bad.length, 2, JSON.stringify(bad));
    assert.match(bad[0], /^a progress line was on screen.*never live on its own running part/);
    assert.match(bad[1], /no running part was shown with the model's doing line/);
  }
  only((f) => { const last = f.after[f.after.length - 1]; last.parts[0].words = "Add an FAQ page …"; }, /at its end every part was done.*part 0 done shown as "Add an FAQ page …"/);
  only((f) => { const last = f.after[f.after.length - 1]; last.parts[0].status = "partial"; last.parts[0].words = SAID0.partial; }, /part 0 partial shown as/);
  // NOT READ IN A FRESH SESSION AT ALL: one failure that says so.
  const none = failed(progressChecks({ steps: [{ n: 1, sent: true, mode: "", network: [] }] }));
  assert.equal(none.length, 1);
  assert.match(none[0], /read in a fresh browser session — it was not followed that way/);
  assert.match(failed(progressChecks({ steps: [] }))[0], /— no message was sent$/);
});

test("progressSnapshot reads a card as drawn — words, label, lines, live, the lines for every state — or null; keepSnapshot keeps a reading only when it changed", () => {
  const s = {
    requests: { [KEY]: { closed: true } },
    cards: { [KEY]: { ended: true, parts: [{ n: 0, status: "done", words: SAID0.done, label: "Done", lines: [L1, "", 7], live: "", said: SAID0 }] } },
  };
  const got = progressSnapshot(s, KEY);
  assert.deepEqual(got, { ended: true, closed: true, parts: [{ n: 0, status: "done", words: SAID0.done, label: "Done", lines: [L1], live: "", said: SAID0 }] });
  assert.equal(progressSnapshot(s, "another"), null);
  assert.equal(progressSnapshot({ requests: {} }, KEY), null);
  assert.equal(progressSnapshot(null, KEY), null);
  const list = [];
  assert.equal(keepSnapshot(list, got, 10), true);
  assert.equal(keepSnapshot(list, JSON.parse(JSON.stringify(got)), 20), false, "an unchanged reading was kept again");
  assert.equal(keepSnapshot(list, { ...got, ended: false }, 30), true);
  assert.equal(keepSnapshot(list, null, 40), false);
  assert.deepEqual(list.map((x) => x.ms), [10, 30]);
  // LIVE ON ITS OWN RUNNING PART, and nothing else counts: not a done part's
  // line, even one a page marked live; not a running part with none live; not
  // a live line that is none of the part's own.
  assert.equal(liveOnItsPart({ status: "started", live: L2, lines: [L1, L2] }), true);
  assert.equal(liveOnItsPart({ status: "done", live: L2, lines: [L1, L2] }), false, "a done part's line was taken as live");
  assert.equal(liveOnItsPart({ status: "ready", live: L2, lines: [L2] }), false);
  assert.equal(liveOnItsPart({ status: "started", live: "", lines: [L1] }), false);
  assert.equal(liveOnItsPart({ status: "started", live: L3, lines: [L1, L2] }), false, "a live line none of the part's own was taken");
  assert.equal(liveOnItsPart(null), false);
  // AN EMPTY LINE IS NOT VISIBLE, so never live — even in a record that kept one.
  assert.equal(liveOnItsPart({ status: "started", live: "", lines: [""] }), false, "an empty line was taken as live");
});

// ── NARRATION ADDS NO CHARGE ─────────────────────────────────────────────────

test("NARRATION ADDS NO CHARGE: passes only when the balance moved by exactly the press's own charges and the ledger holds no other row while it ran; any other row, an unrecorded move, or an unread ledger is not a pass", () => {
  const jobs = [{ job: "f1", row: { billing: "finalized", cost: 12 }, ledgerRead: { ok: true }, ledger: [{ ref: "f1#1", delta: -12 }] }];
  const calls = [{ cost: 2, ref: KEY }];
  const routeRows = { ok: true, rows: [{ ref: KEY, delta: -2 }] };
  const base = { start: 30, calls, routeRows, jobs };
  const mine = { ok: true, rows: [{ id: 1, ref: KEY, delta: -2 }, { id: 2, ref: "f1#1", delta: -12 }] };
  const own = ownMoneyVerdict({ ...base, end: 16, window: mine });
  assert.equal(own.ok, true, own.why);
  assert.deepEqual(narrationChargeVerdict(own), { ok: true, why: "" });
  // A CHARGE UNDER A REF OF ITS OWN: a row the press did not make.
  const other = ownMoneyVerdict({ ...base, end: 15, window: { ok: true, rows: [...mine.rows, { id: 3, ref: "narration:abc", delta: -1 }] } });
  assert.match(narrationChargeVerdict(other).why, /1 row\(s\) under other refs.*narration:abc -1/);
  // A CHARGE UNDER A JOB'S OWN REF: the job reader reads every row whose ref
  // names the job (`ref=like.*<job>*`), so the job's ledger takes more than its
  // row's cost, and the press's own charges do not add up.
  const extra = { ref: "progress:f1", delta: -1 };
  const underJob = ownMoneyVerdict({ ...base, jobs: [{ ...jobs[0], ledger: [...jobs[0].ledger, extra] }], end: 15, window: { ok: true, rows: [...mine.rows, { id: 3, ...extra }] } });
  assert.match(narrationChargeVerdict(underJob).why, /job f1: its row says 12; the ledger took 13/);
  const unrecorded = ownMoneyVerdict({ ...base, end: 15, window: mine });
  assert.match(narrationChargeVerdict(unrecorded).why, /moved 1 more than this press's own charges, recorded under no ref/);
  const unread = ownMoneyVerdict({ ...base, end: 16, window: null });
  assert.match(narrationChargeVerdict(unread).why, /could not be read/);
  assert.equal(narrationChargeVerdict({ ok: false, why: "x" }).ok, false);
  assert.equal(narrationChargeVerdict(null).ok, false);
});

// ── THE NARRATION'S USAGE, READ BACK FROM THE WORKER'S LOG ─────────────────

const W = (job, extra = "milestones 2 facts 3 attempts 1 tokens 812/64 ms 2310") => `progress: ${job} written model grok-4.6 ${extra}`;

test("THE LOG LINES ARE THE WORKER'S OWN: the line writer's and the task writer's log calls print exactly what the reader parses", () => {
  const src = fs.readFileSync(ROOT + "worker.js", "utf8");
  assert.ok(src.includes(`console.log("progress:", job, out.ok ? "written" : "not written (" + out.why + ")", "model", model, "milestones", batch.marks.length, "facts", batch.facts.length, "attempts", out.attempts, "tokens", tokens.in + "/" + tokens.out, "ms", Date.now() - t0);`), "the line writer's log line changed");
  assert.ok(src.includes(`console.log("progress: tasks", job, out.ok ? "written" : "not written (" + out.why + ")", "model", model, "tasks", tasks.length, "attempts", out.attempts, "tokens", tokens.in + "/" + tokens.out, "ms", Date.now() - t0);`), "the task writer's log line changed");
  // console.log joins its arguments with one space, which is what the reader reads.
  const line = ["progress:", "f1", "written", "model", "grok-4.6", "milestones", 2, "facts", 3, "attempts", 1, "tokens", "812/64", "ms", 2310].join(" ");
  assert.deepEqual(NU.parseCall(line), { kind: "line", id: "f1", ok: true, why: "", model: "grok-4.6", milestones: 2, facts: 3, tasks: null, attempts: 1, in: 812, out: 64, ms: 2310 });
  const tasks = ["progress: tasks", "abc", "not written (cut)", "model", "grok-4.6", "tasks", 2, "attempts", 2, "tokens", "420/233", "ms", 3021].join(" ");
  assert.deepEqual(NU.parseCall(tasks), { kind: "tasks", id: "abc", ok: false, why: "cut", model: "grok-4.6", milestones: null, facts: null, tasks: 2, attempts: 2, in: 420, out: 233, ms: 3021 });
  assert.equal(NU.parseCall("progress: f1 milestone refused — closed"), null);
  assert.equal(NU.parseCall("reply: edit fell back (send) facts 3 attempts 1 tokens 0/0 ms 12000"), null);
  // AND THE LINES THAT SAY A DELIVERY OR A WRITER GAVE UP.
  assert.ok(src.includes(`console.log("progress:", id, what, "not delivered after", i + 1, "tries");`));
  assert.ok(src.includes(`console.log("progress:", job, "given up after", PROGRESS_TRIES, "tries");`));
  // WHAT THE RECORDER NAMES, as its own calls pass it: "opening", and
  // "milestone " and the milestone's number — words, more than one token.
  assert.ok(src.includes(`opened = await deliver({ op: "begin", run, ...opening }, "opening");`), "the recorder's opening is not named \"opening\"");
  assert.ok(src.includes(`deliver({ op: "mark", run, stage, facts, seq: n }, "milestone " + n)`), "the recorder's milestone is not named \"milestone <n>\"");
  // FORMATTED AS console.log FORMATS THOSE ARGUMENTS (the real recorder's own
  // output is read in progress-gaps' RECORDER 7).
  const said = (...args) => util.format(...args);
  assert.equal(said("progress:", "f1", "milestone " + 0, "not delivered after", 7 + 1, "tries"), "progress: f1 milestone 0 not delivered after 8 tries");
  assert.deepEqual(NU.parseEvent(said("progress:", "f1", "milestone " + 0, "not delivered after", 7 + 1, "tries")), { what: "not delivered", id: "f1", step: "milestone 0", tries: 8 });
  assert.deepEqual(NU.parseEvent(said("progress:", "f1", "opening", "not delivered after", 2, "tries")), { what: "not delivered", id: "f1", step: "opening", tries: 2 });
  assert.deepEqual(NU.parseEvent("progress: f1 given up after 3 tries"), { what: "given up", id: "f1", tries: 3 });
  assert.deepEqual(NU.parseEvent("progress: f1 milestone refused — not-open"), { what: "refused", id: "f1", why: "not-open" });
});

test("THE PRESS'S IDS: each job's own, and each request's narration record under the Worker's own id for it", () => {
  const src = fs.readFileSync(ROOT + "worker.js", "utf8");
  assert.ok(src.includes('return (await sha256hex("request-tasks:" + slug + "/" + key)).slice(0, 32);'), "the Worker's request narration id changed");
  const id = NU.requestTasksId("fold-lane-bakery", KEY);
  assert.match(id, /^[0-9a-f]{32}$/);
  assert.deepEqual([...NU.pressIds({ slug: "fold-lane-bakery", requests: [KEY], jobs: ["f1", "c1", ""] })].sort(), ["c1", "f1", id].sort());
});

test("USAGE: the press's own calls only, priced at the platform's own rates as a floor, with attempts, tokens and times summed; another id's lines are counted, never read further", () => {
  const src = fs.readFileSync(ROOT + "builder/publish-pages.mjs", "utf8");
  assert.ok(src.includes(`const CREDIT_USD = ${NU.CREDIT_USD};`), "the credit's dollar value is not the platform's own");
  const ids = NU.pressIds({ slug: "fold-lane-bakery", requests: [KEY], jobs: ["f1"] });
  const rid = NU.requestTasksId("fold-lane-bakery", KEY);
  const events = [
    { timestamp: 3, $metadata: { message: W("f1", "milestones 1 facts 2 attempts 2 tokens 1000/100 ms 4000") } },
    { timestamp: 1, $metadata: { message: `progress: tasks ${rid} written model grok-4.6 tasks 2 attempts 1 tokens 500/250 ms 3000` } },
    { timestamp: 2, $metadata: { message: W("zz") } },
    { timestamp: 4, $metadata: { message: "progress: f1 milestone 2 not delivered after 8 tries" } },
    { timestamp: 5, $metadata: { message: "progress: zz given up after 3 tries" } },
    { timestamp: 6, $metadata: { message: "request sweep: nothing" } },
  ];
  const u = NU.usageOf(events, ids);
  assert.deepEqual(u.calls.map((c) => c.kind), ["tasks", "line"], "the calls are not in time order");
  assert.equal(u.otherIds, 2);
  assert.deepEqual(u.events.map((e) => e.what), ["not delivered"]);
  assert.equal(u.totals.calls, 2);
  assert.equal(u.totals.attempts, 3);
  assert.equal(u.totals.in, 1500);
  assert.equal(u.totals.out, 350);
  assert.equal(u.totals.ms, 7000);
  assert.equal(u.totals.msMedian, 3000);
  assert.equal(u.totals.msMost, 4000);
  // OF THREE CALLS, THE MIDDLE ONE: not the fastest, not the slowest.
  const three = NU.usageOf([1000, 5000, 3000].map((ms, i) => ({ timestamp: i, $metadata: { message: W("f1", `milestones 1 facts 1 attempts 1 tokens 10/10 ms ${ms}`) } })), new Set(["f1"]));
  assert.equal(three.totals.msMedian, 3000, "the median is not the middle call's time");
  assert.equal(three.totals.msMost, 5000);
  // grok-4.6: $2 per million fresh in, $6 per million out.
  const usd = 1500 * 2e-6 + 350 * 6e-6;
  assert.ok(Math.abs(u.totals.usd - usd) < 1e-12, `${u.totals.usd} vs ${usd}`);
  assert.ok(Math.abs(u.totals.credits - usd / 0.008) < 1e-9);
  const told = NU.describeUsage(u);
  assert.match(told, /NARRATION USAGE: 2 call\(s\), 2 written/);
  assert.match(told, /a floor/);
  assert.match(told, /NOT DELIVERED/);
});

test("A LOG EVENT'S MESSAGE is read wherever its shape keeps it: the field, an array of words, or a string deeper in the event", () => {
  assert.equal(NU.messageOf({ $metadata: { message: W("f1") } }), W("f1"));
  assert.equal(NU.messageOf({ $metadata: { message: ["progress:", "f1", "written"] } }), "progress: f1 written");
  assert.equal(NU.messageOf({ source: { args: [W("f1")] } }), W("f1"));
  assert.equal(NU.messageOf({ $metadata: { message: "other" } }), "");
  assert.equal(NU.messageOf(null), "");
});

test("THE QUERY is the free one container-logs makes — dry, the needle, the window — and a refusal, an empty token or a body that is not JSON is said, never read as nothing logged", async () => {
  const b = NU.queryBody({ from: 1, to: 2 });
  assert.equal(b.dry, true);
  assert.equal(b.view, "events");
  assert.deepEqual(b.timeframe, { from: 1, to: 2 });
  assert.deepEqual(b.parameters.filters, [{ key: "$metadata.message", operation: "includes", value: "progress:", type: "string" }]);
  assert.match((await NU.queryLogs({ token: "", account: "a", from: 1, to: 2 })).why, /no Cloudflare token/);
  const fake = (status, body) => async () => ({ ok: status === 200, status, text: async () => body });
  assert.match((await NU.queryLogs({ token: "t", account: "a", from: 1, to: 2, fetchImpl: fake(403, "Authentication error") })).why, /Workers Observability › Read/);
  assert.match((await NU.queryLogs({ token: "t", account: "a", from: 1, to: 2, fetchImpl: fake(200, "<html>") })).why, /not JSON/);
  const ok = await NU.queryLogs({ token: "t", account: "a", from: 1, to: 2, fetchImpl: fake(200, JSON.stringify({ result: { events: { events: [{ $metadata: { message: W("f1") } }] } } })) });
  assert.equal(ok.ok, true);
  assert.equal(ok.events.length, 1);
});

test("THE STEP: with no press to read it says only whether the logs are readable; with the press's ids it reads until two reads agree and writes narration.json — usage measured only from calls read, never a verified zero, and the query's success kept apart from it; it never fails the run", async () => {
  // THE SYSTEM'S OWN TEMPORARY DIRECTORY, as every other test makes one: a
  // path that exists in one machine only fails on every other (CI, first).
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "narration-"));
  try {
    const logs = [];
    const env = { CANARY_EVIDENCE_DIR: dir, CLOUDFLARE_API_TOKEN: "t", CLOUDFLARE_ACCOUNT_ID: "a" };
    const fake = (events) => async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ result: { events: { events } } }) });
    const saved = () => JSON.parse(fs.readFileSync(`${dir}/narration.json`, "utf8"));
    const probe = await NU.main({ env, fetchImpl: fake([]), log: (l) => logs.push(l), wait: async () => {} });
    assert.deepEqual([probe.probe, probe.readable], [true, true]);
    assert.match(logs.pop(), /^NARRATION LOGS READABLE: .*measures no usage/);
    const noToken = await NU.main({ env: { CANARY_EVIDENCE_DIR: dir }, log: (l) => logs.push(l), wait: async () => {} });
    assert.equal(noToken.readable, false);
    assert.match(logs.pop(), /^NARRATION LOGS NOT READABLE: no Cloudflare token/);
    // WITH THE PRESS'S IDS: the lines arrive over two reads, then hold.
    fs.writeFileSync(`${dir}/narration-ids.json`, JSON.stringify({ slug: "fold-lane-bakery", from: "2026-10-06T20:00:00.000Z", to: "2026-10-06T20:20:00.000Z", requests: [KEY], jobs: ["f1"] }));
    const at = { now: () => Date.parse("2026-10-06T21:00:00Z"), log: (l) => logs.push(l), wait: async () => {} };
    const batches = [[{ timestamp: 1, $metadata: { message: W("f1") } }], [{ timestamp: 1, $metadata: { message: W("f1") } }, { timestamp: 2, $metadata: { message: W("f1") } }]];
    let n = 0;
    const growing = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ result: { events: { events: batches[Math.min(n++, 1)] } } }) });
    const read = await NU.main({ env, fetchImpl: growing, reads: 5, ...at });
    assert.deepEqual([read.queried, read.measured], [true, true]);
    const got = saved();
    assert.deepEqual([got.measured, got.query.ok], [true, true]);
    assert.equal(got.query.reads, 3, "it did not read until two reads agreed");
    assert.equal(got.totals.calls, 2);
    assert.ok(got.totals.usd > 0);
    assert.deepEqual(got.query.window, { from: "2026-10-06T19:58:00.000Z", to: "2026-10-06T20:30:00.000Z" });
    assert.match(logs.pop(), /^NARRATION USAGE: 2 call\(s\)/);
    // THE QUERY ANSWERED, AND NO CALL OF THE PRESS'S IDS WAS IN IT — nothing at
    // all, another id's calls, or the press's delivery lines alone: the usage
    // is NOT MEASURED. No cost is written, zero or otherwise, and the query's
    // success is said apart from it.
    const quiet = [
      [],
      [{ timestamp: 1, $metadata: { message: W("zz") } }],
      [{ timestamp: 1, $metadata: { message: "progress: f1 milestone 0 not delivered after 8 tries" } }],
    ];
    for (const events of quiet) {
      const r = await NU.main({ env, fetchImpl: fake(events), reads: 3, ...at });
      assert.deepEqual([r.queried, r.measured], [true, false], JSON.stringify(events));
      const out = saved();
      assert.deepEqual([out.measured, out.query.ok], [false, true]);
      assert.equal(out.totals, undefined, "a cost was written for usage that was not measured");
      assert.ok(!Object.hasOwn(out, "usd") && !JSON.stringify(out).includes('"usd"'), "a dollar figure was written for usage that was not measured");
      assert.match(out.why, /no narration call under the press's ids: .*not a verified zero/);
      const line = logs.pop();
      assert.match(line, /^NARRATION USAGE UNAVAILABLE: .*not a verified zero/);
      assert.doesNotMatch(line, /\$/, "the log printed a cost for usage that was not measured");
    }
    assert.deepEqual(saved().events.map((e) => [e.what, e.step]), [["not delivered", "milestone 0"]], "the press's delivery lines were not kept beside the unmeasured usage");
    // DESCRIBED WITH NO CALL, THE ACCOUNT SAYS SO: no total, no cost.
    assert.match(NU.describeUsage({ calls: [], events: [], totals: { calls: 0, usd: 0 } }), /^NARRATION USAGE UNAVAILABLE: .*not a verified zero$/);
    // A REFUSED READ IS SAID, WITH WHERE ELSE TO READ IT; nothing was measured.
    const refused = await NU.main({ env, fetchImpl: async () => ({ ok: false, status: 403, text: async () => "Authentication error" }), ...at });
    assert.deepEqual([refused.queried, refused.measured], [false, false]);
    assert.match(logs.pop(), /^NARRATION USAGE NOT READ: .*dashboard/);
    assert.deepEqual([saved().measured, saved().query.ok, saved().totals], [false, false, undefined]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ── THE WIRING ───────────────────────────────────────────────────────────────

const FLOW = fs.readFileSync(ROOT + ".github/workflows/edit-canary.yml", "utf8");
const CANARY = fs.readFileSync(ROOT + "scripts/edit-canary.mjs", "utf8");

test("THE WORKFLOW: the usage step runs after the press and before the evidence is kept, always, with the Cloudflare token — which the press itself is never handed", () => {
  // EACH STEP'S OWN LINES, ITS COMMENTS BLANKED: a step's chunk runs on to the
  // next step's name, so it holds that step's comment — which says
  // `if: always()` in prose, and passed for this step's own key before.
  const code = (b) => b.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");
  const steps = FLOW.split(/\n      - name: /).slice(1).map((b) => ({ name: b.slice(0, b.indexOf("\n")), body: code(b) }));
  const at = (re) => steps.findIndex((x) => re.test(x.name));
  const press = at(/^canary$/), usage = at(/^narration usage \(free, read-only\)$/), keep = at(/^keep the evidence$/);
  assert.ok(press >= 0 && usage > press && keep > usage, `the steps are out of order: ${steps.map((x) => x.name).join(" | ")}`);
  const u = steps[usage].body;
  assert.match(u, /^        if: always\(\)\s*$/m, "the usage step does not run when the press fails");
  assert.match(u, /CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/);
  assert.match(u, /CLOUDFLARE_ACCOUNT_ID: \$\{\{ secrets\.CLOUDFLARE_ACCOUNT_ID \}\}/);
  assert.match(u, /run: node scripts\/narration-usage\.mjs/);
  assert.doesNotMatch(steps[press].body, /CLOUDFLARE/, "the press is handed the Cloudflare token");
  assert.match(FLOW, /lv-progress \(the progress live check on fold-lane-bakery/, "the form does not name the scenario");
  assert.ok(FLOW.includes(`sends nothing unless the balance is between ${LP.budget} and ${LP.cap}`), "the form's budget and cap are not the scenario's");
  // AND THE NOTE ABOVE THE BOX SAYS THE SAME FIGURES (it said 25 and 30 after they were set to 28 and 32).
  assert.ok(FLOW.includes(`# (${LP.budget}) and its hard cap (${LP.cap}). The changes stay.`), "the workflow's note on the press names another budget or cap");
  assert.doesNotMatch(FLOW, /lv-progress[\s\S]{0,1200}\(25\) and its hard cap \(30\)/, "the stale figures are still there");
});

test("THE CANARY: one sign-in, used for the run and handed to the driver for the fresh session; the narration check and the ids file only for a press that judges progress, after the money", () => {
  assert.equal(CANARY.split("auth/v1/admin/generate_link").length - 1, 1, "a second way to sign in");
  assert.match(CANARY, /async function signIn\(\) \{/);
  assert.match(CANARY, /const session = \(await signIn\(\)\) \|\| \{\};/);
  assert.match(CANARY, /stopNow: requestsIo\.stop, freshSession: signIn \}\);/, "the driver is not handed the second sign-in");
  const money = CANARY.indexOf("const money = ownMoneyVerdict({ start: bal.start, end: bal.end, calls, routeRows, jobs: jobRecords, window });");
  const gate = CANARY.indexOf("if (UI_ASK.scenario.expect && UI_ASK.scenario.expect.progress === true) {", money);
  const nc = CANARY.indexOf("const nc = narrationChargeVerdict(money);", gate);
  const ids = CANARY.indexOf("writeFileSync(`${EVID}/narration-ids.json`", gate);
  assert.ok(money > 0 && gate > money && nc > gate && ids > nc, "the narration check or the ids file is out of place");
  assert.match(CANARY.slice(nc, ids), /check\("narration added no charge[^"]*", nc\.ok, nc\.why\);/, "the check does not pass and fail on the verdict");
  // THE PRESS READS NO LOG ITSELF: the usage is the next step's.
  assert.doesNotMatch(CANARY, /telemetry\/query|CLOUDFLARE_API_TOKEN/);
});
