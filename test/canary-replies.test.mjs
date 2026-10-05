// THE UI CANARY WAITS FOR THE CURRENT REQUEST'S REPLIES (2026-10-05).
//
// The owner, after run 97 judged a reply 8 s after its job ended, while it was
// still being written: *"Fix the canary's pending-reply handling now, keeping
// this change to scripts and tests … track the current request's job IDs and
// wait within a bounded deadline for their replies to settle and actually
// appear on screen before judging them. Cover normal completion,
// clarification steps, and the closed-tab/reopen path … Distinguish pending,
// model-written, failed and timed-out replies, and ensure unrelated
// historical replies cannot satisfy or block the current request's verdict.
// Add focused regression tests for delayed success, failure, timeout, reload
// and historical replies arriving during a new request."*
//
// The driver (`runUi`) runs here against a stand-in that holds and settles
// replies the way the page does since deploy 2183
// (`test/fixtures/canary-held-app.mjs`); the verdict is the real one
// (`replyChecks`), and the reply readers are the real ones
// (`scripts/canary-replies.mjs`). Nothing here touches a product file.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { runUi, describeUi, UI_SCENARIOS, stepBoundMs, UI_PRESS_MAX_MS, UI_REPLY_FLOOR_MS } from "../scripts/canary-ui.mjs";
import { replyChecks, repliesOf, requestStepChecks } from "../scripts/canary-requests.mjs";
import {
  replyStateOf, expectedTextOf, questionOf, jobAnswers, replyJobsOf, trackHeld, repliesNow, timedOut, watchedReplies, replyFailure, REPLY_STATES, keyOf,
} from "../scripts/canary-replies.mjs";
import { heldApp, ORIGIN, SLUG, UID, HOLD_LINE } from "./fixtures/canary-held-app.mjs";

const ROOT = new URL("../", import.meta.url).pathname;
const require = createRequire(import.meta.url);
const EditPoll = require("../public/edit-poll.js");
const failed = (checks) => checks.filter((c) => !c.ok).map((c) => `${c.name} — ${c.why}`);
const KEY = (n) => "rqreply" + "0".repeat(16) + n;
const part = (n, words, status, over = {}) => ({ n, words, status, ids: [], jobs: [], charged: 0, ...over });
const view = (key, parts, over = {}) => ({ key, state: over.ended ? "done" : "running", ended: false, stop: false, at: 1, updatedAt: 2, parts, ...over });
const SESSION = { access_token: "a", refresh_token: "r", expires_at: 2_000_000_000, user: { id: UID } };
const drive = (h, scenario, over = {}) => runUi({
  base: ORIGIN, session: SESSION, slug: SLUG, scenario, spend: true, balanceNow: async () => 100, evid: "", launch: h.launch, log: () => {},
  openMs: 300, attachMs: 50, startMs: 100, stepMs: 3_000, stepCapMs: 3_000, pollMs: 1, settleMs: 0, viewEveryMs: 0, awayEveryMs: 1, replyFloorMs: 0,
  requestsNow: h.requestsNow, stopNow: h.stopNow, ...over,
});

// THE ANSWERS A JOB'S POLL HANDS BACK, as the server writes them.
const PENDING = (outcome = "done") => ({ ok: true, layer: "nav", msg: "✅ Added “Classes” to the menu on 3 pages (the other 2 already had it), beside the items each had.", cost: 1, replyState: "pending", replyOutcome: outcome });
const WRITTEN = (reply) => ({ ok: true, layer: "nav", msg: "✅ Added “Classes” to the menu on 3 pages (the other 2 already had it), beside the items each had.", cost: 1, reply, replySource: "model" });
const FAILED = () => ({ ok: true, layer: "nav", msg: "✅ Added “Classes” to the menu on 3 pages (the other 2 already had it), beside the items each had.", cost: 1, replyState: "failed" });
const MENU_REPLY = "I've put Classes in the menu on the Order, Visit and Gallery pages, beside the links each already had. The home and Classes pages had it already.";
const pendingThen = (n, last) => [...Array.from({ length: n }, () => PENDING()), last];
// THE LOOK AT WHICH THE RELOAD CASE RELOADS: after the request has closed (the
// close comes a couple of looks after the send), with the reply still held.
const RELOAD_LOOK = 9;

// ── ONE MESSAGE, ONE PART (rq-menu-link) ─────────────────────────────────────

const MENU = UI_SCENARIOS["rq-menu-link"];
const menuViews = (key = KEY(1)) => [
  view(key, [part(0, MENU.steps[0].say, "started", { route: "nav", ids: ["m1"] })]),
  view(key, [part(0, MENU.steps[0].say, "done", { route: "nav", addition: true, ids: ["m1"], jobs: ["m1"] })], { ended: true }),
];
const menuApp = (over = {}) => heldApp({ send: () => ({ request: { key: KEY(1), views: menuViews() }, route: { intent: "addon", layer: "none" } }), ...over });

test("DELAYED SUCCESS: the request closes while its reply is still being written; the canary waits on that job until the model's reply is written and drawn in the place the page held, and judges it the model's own", async () => {
  const h = menuApp({ answers: { m1: pendingThen(6, WRITTEN(MENU_REPLY)) } });
  const rec = await drive(h, MENU);
  assert.equal(rec.stopped, null, JSON.stringify(rec.stopped));
  const s = rec.steps[0];
  // THE PAGE CLOSED THE REQUEST FIRST, with the reply's place held — run 97's moment.
  const closed = h.calls.indexOf(`closed ${KEY(1)}`);
  const settled = h.calls.indexOf("settled m1");
  assert.ok(closed > 0 && settled > closed, `the request did not close before its reply was written: ${JSON.stringify(h.calls)}`);
  const w = s.replyWatch;
  assert.equal(w.timedOut, false);
  assert.deepEqual(w.jobs.map((j) => [j.job, j.part, j.state, j.shown, j.holding]), [["m1", 0, "model", true, false]]);
  assert.ok(Number.isFinite(w.jobs[0].pendingMs) && Number.isFinite(w.jobs[0].settledMs) && w.jobs[0].settledMs >= w.jobs[0].pendingMs, JSON.stringify(w.jobs[0]));
  // THE REPLY ON SCREEN IS THE MODEL'S, never the waiting line.
  assert.deepEqual(s.replies, [MENU_REPLY]);
  assert.ok(!s.reply.includes(HOLD_LINE));
  assert.deepEqual(failed(replyChecks(rec.steps)), []);
  assert.deepEqual(repliesOf(s).map((r) => [r.source, r.shown]), [["model", true]]);
  assert.match(describeUi(rec), /replies, watched \d+ s after the request: m1 model, on screen \(pending at \d+ s, settled at \d+ s\)/);
});

test("FAILURE: a reply the server gives up on is settled into the page's own sentence; the wait ends there, and the verdict says it failed — not composed, not timed out", async () => {
  const h = menuApp({ answers: { m1: pendingThen(3, FAILED()) } });
  const rec = await drive(h, MENU);
  const w = rec.steps[0].replyWatch;
  assert.equal(w.timedOut, false, "the wait ran to its end for a reply that had already failed");
  assert.deepEqual(w.jobs.map((j) => [j.state, j.holding]), [["failed", false]]);
  const f = failed(replyChecks(rec.steps));
  assert.equal(f.length, 1, f.join("\n"));
  assert.match(f[0], /part 0's reply is the model's own, and on screen — failed: the reply was not written \(the server gave up\), and the page showed its own sentence instead: "✅ Added “Classes”/);
  // THE PAGE'S OWN SENTENCE IS WHAT IS ON SCREEN.
  assert.deepEqual(rec.steps[0].replies, [FAILED().msg]);
});

test("TIMEOUT: a reply still being written when the message's time runs out is TIMED OUT — the waiting line is not taken for a reply, and nothing on screen answers the message", async () => {
  const h = menuApp({ answers: { m1: [PENDING()] } });
  const rec = await drive(h, MENU, { stepMs: 400, stepCapMs: 400 });
  const s = rec.steps[0];
  assert.equal(s.completed, true, "the request itself ended");
  const w = s.replyWatch;
  assert.equal(w.timedOut, true);
  assert.deepEqual(w.jobs.map((j) => [j.state, j.holding, j.shown]), [["timeout", true, false]]);
  assert.match(failed(replyChecks(rec.steps)).join("\n"), /timed out: the reply was still being written when the message's time ran out/);
  assert.deepEqual(s.replies, [], "the waiting line was counted as a reply");
  assert.equal(s.reply, "");
  assert.match(describeUi(rec), /THE TIME RAN OUT: m1 timeout, still held on screen/);
  // BOUNDED: the message's own bound, from its send (the floor is 0 here).
  assert.ok(Date.now() - s.sentAt < 400 + 2_000, "the wait outran its bound");
});

test("the wait's deadline is the message's own bound, and never less than the floor after the request ended: a request that ends near its bound still gives its reply the floor", async () => {
  // THE REQUEST ENDS AT 0.4 s OF A 1 s BOUND; ITS REPLY IS WRITTEN AT 1.6 s.
  const mk = () => menuApp({ endAfterMs: 400, timed: { m1: { afterMs: 1_600, pending: PENDING(), res: WRITTEN(MENU_REPLY) } } });
  const bare = await drive(mk(), MENU, { stepMs: 1_000, stepCapMs: 1_000, replyFloorMs: 0 });
  assert.equal(bare.steps[0].completed, true, "the request did not end inside its bound");
  assert.equal(bare.steps[0].replyWatch.timedOut, true, "with no floor the wait outran the message's bound");
  assert.deepEqual(bare.steps[0].replyWatch.jobs.map((j) => j.state), ["timeout"]);
  const floored = await drive(mk(), MENU, { stepMs: 1_000, stepCapMs: 1_000, replyFloorMs: 3_000 });
  assert.equal(floored.steps[0].replyWatch.timedOut, false, JSON.stringify(floored.steps[0].replyWatch.jobs));
  assert.deepEqual(floored.steps[0].replyWatch.jobs.map((j) => [j.state, j.shown]), [["model", true]]);
  // AND THE FLOOR IS A FLOOR, NOT A WAIT: a reply written at once ends the wait at once.
  const quick = await drive(menuApp({ answers: { m1: [WRITTEN(MENU_REPLY)] } }), MENU, { replyFloorMs: 60_000 });
  assert.ok(quick.steps[0].replyWatch.ms < 5_000, `the floor was waited out: ${quick.steps[0].replyWatch.ms} ms`);
});

test("RELOAD: a page reloaded while a reply is held keeps the held message (it is stored); the canary finds it again in the new page life and judges the reply once it settles — the reload itself still on the record", async () => {
  const app = heldApp({ send: () => ({ request: { key: KEY(1), views: menuViews() } }), answers: { m1: pendingThen(12, WRITTEN(MENU_REPLY)) }, reloadAtLook: RELOAD_LOOK });
  const rec = await drive(app, MENU);
  const closed = app.calls.indexOf(`closed ${KEY(1)}`);
  const reloaded = app.calls.indexOf("tab 1 reloaded");
  const settled = app.calls.indexOf("settled m1");
  // THE RELOAD COMES IN THE WAIT: after the request closed, before its reply settled.
  assert.ok(closed > 0 && closed < reloaded && reloaded < settled, JSON.stringify(app.calls));
  const s = rec.steps[0];
  assert.deepEqual(s.replyWatch.jobs.map((j) => [j.state, j.shown, j.at]), [["model", true, 2]]);
  assert.deepEqual(failed(replyChecks(rec.steps)), []);
  // THE RELOAD IS STILL TOLD: the reply was not read in the tab the run opened.
  assert.equal(s.sameTab, false);
});

// ── A MESSAGE THAT ENDS ON A STEP'S QUESTION, AND ITS ANSWER (rq-3-facebook) ─

const R3 = UI_SCENARIOS["rq-3-facebook"];
const R3_VIEWS = [
  view(KEY(3), [part(0, "change the heading …", "started", { route: "text", ids: ["j1"] }), part(1, "add a link to our Facebook page in the footer", "ready")]),
  view(KEY(3), [part(0, "change the heading …", "done", { route: "text", ids: ["j1"], jobs: ["j1"] }), part(1, "add a link to our Facebook page in the footer", "started", { route: "addon", ids: ["j2"] })]),
  view(KEY(3), [part(0, "change the heading …", "done", { route: "text", ids: ["j1"], jobs: ["j1"] }),
    part(1, "add a link to our Facebook page in the footer", "waiting", { route: "addon", ids: ["j2"], jobs: ["j2"], question: { id: "q1", text: "What is the address of your Facebook page?", options: [] } })], { state: "waiting" }),
];
const R3_ANSWERED = [
  view(KEY(3), [part(0, "change the heading …", "done", { route: "text", ids: ["j1"], jobs: ["j1"] }), part(1, "add a link to our Facebook page in the footer", "started", { route: "nav", addition: true, ids: ["j2", "j3"], jobs: ["j2"] })]),
  view(KEY(3), [part(0, "change the heading …", "done", { route: "text", ids: ["j1"], jobs: ["j1"] }), part(1, "add a link to our Facebook page in the footer", "done", { route: "nav", addition: true, ids: ["j2", "j3", "j4"], jobs: ["j2", "j4"] })], { ended: true }),
];
const HEADING = "The Visit page's heading now reads “Our shop on the street”.";
const FOOTER = "Your footer now links to your Facebook page, beside Instagram.";
const QUESTION = { ok: false, clarify: { id: "q1", text: "What is the address of your Facebook page?" } };

test("A STEP'S QUESTION: the heading's reply, still being written when the question is drawn, is waited for before the answer is sent; the question's words are on screen; the answer's own reply is then waited for in its turn", async () => {
  const h = heldApp({
    send: () => ({ request: { key: KEY(3), views: R3_VIEWS }, route: { intent: "edit", layer: "text", alsoAsked: "add a link to our Facebook page in the footer" } }),
    answerViews: R3_ANSWERED,
    answers: { j1: pendingThen(5, { ok: true, msg: "✅ Changed.", reply: HEADING, replySource: "model" }), j2: [QUESTION], j4: pendingThen(4, { ok: true, msg: "✅ Added.", reply: FOOTER, replySource: "model" }) },
  });
  const rec = await drive(h, R3);
  assert.equal(rec.stopped, null, JSON.stringify(rec.stopped));
  assert.equal(rec.sent, 2);
  // THE HEADING'S REPLY WAS WRITTEN AND SETTLED BEFORE THE ANSWER WENT.
  const settledJ1 = h.calls.indexOf("settled j1");
  const answer = h.calls.indexOf("sent 2 (the answer)");
  assert.ok(settledJ1 > 0 && answer > settledJ1, `the answer was sent before the heading's reply settled: ${JSON.stringify(h.calls)}`);
  const [s1, s2] = rec.steps;
  assert.equal(s1.question.part, 1);
  assert.deepEqual(s1.replyWatch.jobs.map((j) => [j.job, j.state]), [["j1", "model"], ["j2", "question"]]);
  assert.equal(s1.replyWatch.jobs[1].asked, true);
  // THE ANSWER'S OWN JOBS ONLY: j2 was judged with the first message.
  assert.deepEqual(s2.replyWatch.jobs.map((j) => [j.job, j.state, j.shown]), [["j4", "model", true]]);
  assert.deepEqual(failed(replyChecks(rec.steps)), []);
  assert.deepEqual(failed(requestStepChecks(s1, R3)), []);
  assert.deepEqual(failed(requestStepChecks(s2, R3)), []);
  assert.equal(replyChecks(rec.steps).length, 3, "a job was judged twice, or one was missed");
});

test("a question whose reply is still being written is drawn under the waiting line at once: its words count as on screen, and the reply before it is waited for and judged as any other", async () => {
  const asks = { ok: false, clarify: { id: "q1", text: "What is the address of your Facebook page?" } };
  const h = heldApp({
    send: () => ({ request: { key: KEY(3), views: R3_VIEWS } }), answerViews: R3_ANSWERED,
    answers: {
      j1: [{ ok: true, msg: "✅ Changed.", reply: HEADING, replySource: "model" }],
      j2: pendingThen(3, { ...asks, reply: "I can add the Facebook link once I know its address.", replySource: "model" }).map((a, i) => (i < 3 ? { ...asks, replyState: "pending", replyOutcome: "asked" } : a)),
      j4: [{ ok: true, msg: "✅ Added.", reply: FOOTER, replySource: "model" }],
    },
  });
  const rec = await drive(h, R3);
  assert.equal(rec.stopped, null, JSON.stringify(rec.stopped));
  const j2 = rec.steps[0].replyWatch.jobs.find((j) => j.job === "j2");
  assert.equal(j2.state, "model");
  assert.equal(j2.asked, true);
  assert.equal(j2.shown, true);
  // ITS QUESTION AND ITS REPLY ARE EACH A ROW, and both pass.
  assert.deepEqual(repliesOf(rec.steps[0]).filter((r) => r.job === "j2").map((r) => [r.source, r.shown]), [["question", true], ["model", true]]);
  assert.deepEqual(failed(replyChecks(rec.steps)), []);
});

// ── THE CLOSED TAB, THEN THE TAB OPENED AFTERWARDS (rq-5-away) ───────────────

const R5 = UI_SCENARIOS["rq-5-away"];
const R5_VIEWS = [
  view(KEY(5), [part(0, "Add a line to the Order page …", "queued", { route: "addon", ids: ["k1"] }), part(1, "change the Gallery page heading …", "ready")]),
  view(KEY(5), [part(0, "Add a line to the Order page …", "done", { route: "addon", ids: ["k1"], jobs: ["k1"] }), part(1, "change the Gallery page heading …", "started", { route: "text", ids: ["k2"] })]),
  view(KEY(5), [part(0, "Add a line to the Order page …", "done", { route: "addon", ids: ["k1"], jobs: ["k1"] }), part(1, "change the Gallery page heading …", "done", { route: "text", ids: ["k2"], jobs: ["k2"] })], { ended: true }),
];

test("THE CLOSED TAB: the tab opened afterwards finds a reply still being written, holds its place and closes the request; the canary waits in that tab until the reply is written and drawn", async () => {
  const h = heldApp({
    send: () => ({ request: { key: KEY(5), views: R5_VIEWS }, route: { intent: "addon", layer: "" } }), followAfter: 2,
    answers: { k1: [{ ok: true, msg: "✅ Added.", reply: "The Order page now says orders close at 8pm the night before.", replySource: "model" }], k2: pendingThen(5, { ok: true, msg: "✅ Changed.", reply: "The Gallery heading now reads “Photographs from the bakery”.", replySource: "model" }) },
  });
  const rec = await drive(h, R5);
  assert.equal(rec.stopped, null, JSON.stringify(rec.stopped));
  const s = rec.steps[0];
  assert.equal(s.away.reopened.closed, true);
  // CLOSED IN THE SECOND TAB with k2 still held; settled there afterwards.
  const closed = h.calls.indexOf(`closed ${KEY(5)}`);
  const settled = h.calls.indexOf("settled k2");
  assert.ok(h.calls.indexOf("tab 2 goto /projects") < closed && closed < settled, JSON.stringify(h.calls));
  assert.ok(h.calls.slice(settled).every((c) => !c.startsWith("tab 1 ")), "the first tab was read after it closed");
  assert.deepEqual(s.replyWatch.jobs.map((j) => [j.job, j.state, j.shown]), [["k1", "model", true], ["k2", "model", true]]);
  assert.deepEqual(failed(requestStepChecks(s, R5)), []);
  assert.deepEqual(failed(replyChecks(rec.steps)), []);
  assert.deepEqual(s.away.calls, [], "something read the request's own route while the tab was closed");
});

// ── OTHER REQUESTS' REPLIES, ARRIVING DURING THE NEW ONE ─────────────────────

const OLD = KEY(9);
test("HISTORY CANNOT BLOCK: another request's reply that is never written, and its other replies drawn after the new message, do not hold the wait up — it ends when this request's own reply is written", async () => {
  const history = [{ key: OLD, atLook: 2, jobs: ["h1", "h2"], own: "⚠️ I changed the site description, and a link to the new Classes page was not put in the menu." }];
  const h = menuApp({ history, answers: { m1: pendingThen(4, WRITTEN(MENU_REPLY)), h1: [PENDING()], h2: [{ ok: true, msg: "✅ Updated the look — the description." }] } });
  const rec = await drive(h, MENU, { stepMs: 20_000, stepCapMs: 20_000 });
  const s = rec.steps[0];
  const w = s.replyWatch;
  assert.equal(w.timedOut, false, "another request's held reply held the wait up");
  assert.ok(w.ms < 5_000, `the wait took ${w.ms} ms`);
  assert.ok(h.calls.includes(`history ${OLD} drawn`), JSON.stringify(h.calls));
  assert.ok(!h.calls.includes("settled h1"), "the historical reply was written after all");
  assert.deepEqual(w.jobs.map((j) => j.job), ["m1"], "another request's job was waited on");
  assert.deepEqual(failed(replyChecks(rec.steps)), []);
  assert.deepEqual(s.replies, [MENU_REPLY]);
  // THE OTHER REQUEST'S REPLIES, DRAWN AFTER THE MESSAGE: kept apart, and
  // judged by the live check alone (`liveChecks`, 2026-10-05).
  assert.deepEqual(s.otherReplies, ["✅ Updated the look — the description.", "⚠️ I changed the site description, and a link to the new Classes page was not put in the menu."]);
  assert.match(describeUi(rec), /also drawn after the message, not this request's \(judged by the live check alone\): 2/);
});

test("HISTORY CANNOT SATISFY: with this request's reply never written, another request's replies drawn after the message — one in the very words it would have had — answer nothing: the reply times out and the message has no reply on screen", async () => {
  const history = [{ key: OLD, atLook: 2, jobs: ["h1", "h2"] }];
  const h = menuApp({ history, answers: { m1: [PENDING()], h1: [WRITTEN(MENU_REPLY)], h2: [{ ok: true, msg: "✅ Done — added /classes, updated /." }] } });
  const rec = await drive(h, MENU, { stepMs: 500, stepCapMs: 500 });
  const s = rec.steps[0];
  assert.deepEqual(s.replyWatch.jobs.map((j) => [j.state, j.shown]), [["timeout", false]]);
  assert.match(failed(replyChecks(rec.steps)).join("\n"), /timed out/);
  // "MESSAGE 1 GOT A REPLY ON SCREEN" READS THIS REQUEST'S REPLIES ONLY (edit-canary's check).
  assert.equal(s.reply, "", "another request's reply was taken for this message's");
  assert.deepEqual(s.otherReplies, [MENU_REPLY, "✅ Done — added /classes, updated /."]);
});

test("HISTORY CANNOT STAND IN BY ITS WORDS: a reply written at once but never drawn is not on screen, though another request's reply in the very same words is", async () => {
  const history = [{ key: OLD, atLook: 2, jobs: ["h1"] }];
  const h = menuApp({ history, answers: { m1: [WRITTEN(MENU_REPLY)], h1: [WRITTEN(MENU_REPLY)] }, drop: ["m1"] });
  const rec = await drive(h, MENU, { stepMs: 500, stepCapMs: 500 });
  const s = rec.steps[0];
  assert.deepEqual(s.replyWatch.jobs.map((j) => [j.state, j.shown]), [["model", false]]);
  assert.match(failed(replyChecks(rec.steps)).join("\n"), /the model's reply was written but is not on screen/);
  // AND WITH BOTH DRAWN, BOTH ARE THERE: the same words twice, once each.
  const both = menuApp({ history: [{ key: OLD, atLook: 2, jobs: ["h1"] }], answers: { m1: [WRITTEN(MENU_REPLY)], h1: [WRITTEN(MENU_REPLY)] } });
  const ok = await drive(both, MENU, { stepMs: 2_000, stepCapMs: 2_000 });
  assert.deepEqual(failed(replyChecks(ok.steps)), []);
});

test("HISTORY HELD IN THE SAME PLACE CANNOT STAND IN: a reply held by another job is never read as this job's, though it settles into the very words this one will have", async () => {
  const s = {
    origin: 1,
    messages: [
      { who: "u", text: "Put the Classes page in the menu on every page." },
      { who: "a", text: MENU_REPLY, held: "", holding: false },
      { who: "a", text: HOLD_LINE, held: "m1", holding: true },
    ],
    requests: {},
  };
  // h1 HELD AT 1 EARLIER AND NOW SETTLED; m1 STILL HELD AT 2.
  const slots = trackHeld(trackHeld(null, { ...s, messages: [s.messages[0], { ...s.messages[1], text: HOLD_LINE, held: "h1", holding: true }, s.messages[2]] }), s);
  const network = [
    { method: "GET", path: "/api/site/edit/h1", final: true, status: 200, res: WRITTEN(MENU_REPLY), ms: 5 },
    { method: "GET", path: "/api/site/edit/m1", final: true, status: 200, res: PENDING(), ms: 6 },
  ];
  const now = repliesNow({ jobs: [{ job: "m1", part: 0 }], network, s, slots, key: KEY(1) });
  assert.deepEqual(now.jobs.map((j) => [j.state, j.holding, j.shown, j.settled]), [["pending", true, false, false]]);
  assert.equal(now.settled, false);
  assert.deepEqual(timedOut(now).jobs.map((j) => j.state), ["timeout"]);
});

test("A HELD REPLY IS KNOWN BY ITS OWN PLACE: settled into words another job's answer also carries, it is on screen though that other answer was never drawn", async () => {
  const history = [{ key: OLD, atLook: 2, jobs: ["h1"] }];
  const h = menuApp({ history, answers: { m1: pendingThen(4, WRITTEN(MENU_REPLY)), h1: [WRITTEN(MENU_REPLY)] }, drop: ["h1"] });
  const rec = await drive(h, MENU);
  assert.ok(h.calls.some((c) => c.startsWith("tab 1 poll h1")), "the other job was never read");
  assert.deepEqual(rec.steps[0].replyWatch.jobs.map((j) => [j.state, j.shown, j.at]), [["model", true, 2]]);
  assert.deepEqual(failed(replyChecks(rec.steps)), []);
});

test("THE REQUEST'S OWN REPLY, written in the background, is judged with the parts' once the page has shown it; one that failed is told as failed", async () => {
  const own = "Classes is now in every menu; the starter page has no menu, so it has none.";
  const h = menuApp({ answers: { m1: [WRITTEN(MENU_REPLY)] }, requestReply: { text: own, source: "model", for: "end", pendingLooks: 12 } });
  const rec = await drive(h, MENU);
  const w = rec.steps[0].replyWatch;
  assert.equal(w.timedOut, false);
  assert.deepEqual({ state: w.request.state, shown: w.request.shown, for: w.request.for }, { state: "model", shown: true, for: "end" });
  assert.deepEqual(rec.steps[0].replies, [MENU_REPLY, own]);
  const rows = replyChecks(rec.steps);
  assert.deepEqual(rows.map((c) => [c.name, c.ok]), [["message 1: part 0's reply is the model's own, and on screen", true], ["message 1: the request's own reply (end) is the model's own, and on screen", true]]);
  const bad = menuApp({ answers: { m1: [WRITTEN(MENU_REPLY)] }, requestReply: { state: "failed", for: "end" } });
  const off = await drive(bad, MENU);
  assert.equal(off.steps[0].replyWatch.request.state, "failed");
  assert.match(failed(replyChecks(off.steps)).join("\n"), /the request's own reply \(end\) is the model's own, and on screen — failed: the reply was not written/);
});

test("a reply the page itself stopped waiting for — settled into its own sentence while the server still said pending — ends the wait as timed out", () => {
  const s = { origin: 1, messages: [{ who: "a", text: FAILED().msg, held: "", holding: false }], requests: {} };
  const slots = { tab: 1, at: { m1: 0 } };
  const network = [{ method: "GET", path: "/api/site/edit/m1", final: true, status: 200, res: PENDING(), ms: 3 }];
  const now = repliesNow({ jobs: [{ job: "m1", part: 0 }], network, s, slots, key: KEY(1) });
  assert.deepEqual(now.jobs.map((j) => [j.state, j.settled, j.holding]), [["timeout", true, false]]);
  assert.equal(now.settled, true, "the wait would run on for a reply the page no longer waits for");
  assert.match(failed(replyChecks([{ n: 1, sent: true, replyWatch: { jobs: now.jobs, request: null, attributed: now.attributed } }])).join("\n"), /timed out/);
});

test("a written reply is waited for until it is DRAWN, not only answered: the canary has the answer in its record a moment before the page redraws the message", async () => {
  const h = menuApp({ answers: { m1: pendingThen(3, WRITTEN(MENU_REPLY)) }, drawLag: 6 });
  const rec = await drive(h, MENU);
  const w = rec.steps[0].replyWatch;
  assert.equal(w.timedOut, false);
  assert.deepEqual(w.jobs.map((j) => [j.state, j.shown, j.holding]), [["model", true, false]]);
  assert.deepEqual(failed(replyChecks(rec.steps)), []);
});

test("a place kept for a job, now holding ANOTHER job's reply, is not that job's place: the job is found by its own words instead", () => {
  const s = { origin: 1, messages: [{ who: "u", text: "x" }, { who: "a", text: HOLD_LINE, held: "h1", holding: true }, { who: "a", text: MENU_REPLY }], requests: {} };
  const network = [{ method: "GET", path: "/api/site/edit/m1", final: true, status: 200, res: WRITTEN(MENU_REPLY), ms: 4 }];
  const now = repliesNow({ jobs: [{ job: "m1", part: 0 }], network, s, slots: { tab: 1, at: { m1: 1, h1: 1 } }, key: KEY(1) });
  assert.deepEqual(now.jobs.map((j) => [j.state, j.holding, j.shown, j.at, j.settled]), [["model", false, true, 2, true]]);
});

test("a question beside a written reply, asked in the same words by another request, needs a message of its own too", () => {
  const theirs = { ok: false, clarify: { id: "old", text: QUESTION.clarify.text }, reply: "I can add it once I know the address.", replySource: "model" };
  const net = [
    { method: "GET", path: "/api/site/edit/j2", final: true, res: QUESTION, ms: 1 },
    { method: "GET", path: "/api/site/edit/h2", final: true, res: theirs, ms: 2 },
  ];
  const asked = (msgs) => repliesNow({ jobs: [{ job: "j2", part: 1 }], network: net, s: { origin: 1, messages: msgs, requests: {} } }).jobs[0].asked;
  assert.equal(asked([{ who: "a", text: QUESTION.clarify.text }]), false, "the other request's question stood in for this one");
  assert.equal(asked([{ who: "a", text: QUESTION.clarify.text }, { who: "a", text: `${theirs.reply}\n${QUESTION.clarify.text}` }]), true);
});

// ── THE READERS, ONE BY ONE ──────────────────────────────────────────────────

test("a reply's state is read off its own answer: the model's words, still being written, failed, a question with none owed, composed, a hand-over, unread", () => {
  assert.deepEqual(REPLY_STATES, ["model", "pending", "failed", "question", "composed", "none", "unread", "timeout"]);
  assert.equal(replyStateOf(WRITTEN("Done.")), "model");
  assert.equal(replyStateOf(PENDING()), "pending");
  assert.equal(replyStateOf(FAILED()), "failed");
  assert.equal(replyStateOf(QUESTION), "question");
  assert.equal(replyStateOf({ ok: true, msg: "✅ Done." }), "composed");
  assert.equal(replyStateOf({ ok: false, escalate: true, layer: "nav", replyState: "pending" }), "none", "a hand-over's reply was waited for");
  assert.equal(replyStateOf(null), "unread");
  // READ AS THE PAGE READS IT: a blank reply, or one not marked the model's, is not the model's.
  assert.equal(replyStateOf({ ok: true, msg: "x", reply: "   ", replySource: "model" }), "composed");
  assert.equal(replyStateOf({ ok: true, msg: "x", reply: "words", replySource: "fixed" }), "composed");
  assert.equal(replyStateOf({ ok: true, reply: "x".repeat(4001), replySource: "model" }), "composed");
  // WHAT IT MUST SAY ON SCREEN.
  assert.equal(expectedTextOf(WRITTEN("The words.")), "The words.");
  assert.equal(expectedTextOf(PENDING()), "", "a pending reply's words were guessed");
  assert.equal(expectedTextOf(FAILED()), FAILED().msg);
  assert.equal(expectedTextOf(QUESTION), QUESTION.clarify.text);
  assert.equal(questionOf({ ...QUESTION, replyState: "pending" }), QUESTION.clarify.text);
  assert.equal(keyOf("  “Quoted”   words  "), '"quoted" words');
});

test("the jobs a message is judged on are its request's own reply-bearing jobs, never a hand-over's or a routing job's, and never one an earlier message was judged on", () => {
  const v = view(KEY(1), [part(0, "a", "done", { ids: ["r0", "j1", "x1"], jobs: ["j1"] }), part(1, "b", "done", { ids: ["j2", "j3"], jobs: ["j2", "j3"] })], { ended: true });
  assert.deepEqual(replyJobsOf(v), [{ job: "j1", part: 0 }, { job: "j2", part: 1 }, { job: "j3", part: 1 }]);
  assert.deepEqual(replyJobsOf(v, new Set(["j2"])), [{ job: "j1", part: 0 }, { job: "j3", part: 1 }]);
  assert.deepEqual(replyJobsOf(null), []);
  // EACH JOB'S ANSWERS: the last one counts; when it was first pending, first settled.
  const a = jobAnswers([
    { method: "GET", path: "/api/site/edit/j1", final: true, res: PENDING(), ms: 10 },
    { method: "GET", path: "/api/site/edit/j1", status: 200, ms: 11 },
    { method: "GET", path: "/api/site/edit/j1", final: true, res: PENDING(), ms: 12 },
    { method: "GET", path: "/api/site/edit/j1", final: true, res: WRITTEN("w"), ms: 20 },
    { method: "GET", path: "/api/site/request/x/y", final: true, res: WRITTEN("not a job"), ms: 21 },
  ]);
  assert.deepEqual([...a.keys()], ["j1"]);
  assert.deepEqual({ state: a.get("j1").state, polls: a.get("j1").polls, pendingMs: a.get("j1").pendingMs, settledMs: a.get("j1").settledMs }, { state: "model", polls: 3, pendingMs: 10, settledMs: 20 });
});

test("held places are kept from read to read of one page, and read again from scratch in a new page life", () => {
  const read = (origin, held) => ({ origin, messages: [{ who: "u", text: "x" }, { who: "a", text: HOLD_LINE, held, holding: true }] });
  let slots = trackHeld(null, read(1, "j1"));
  assert.deepEqual(slots, { tab: 1, at: { j1: 1 } });
  // SETTLED: the place is kept, though the mark is gone.
  slots = trackHeld(slots, { origin: 1, messages: [{ who: "u", text: "x" }, { who: "a", text: "written", held: "", holding: false }] });
  assert.deepEqual(slots.at, { j1: 1 });
  // A NEW PAGE LIFE: nothing kept from the old one.
  slots = trackHeld(slots, { origin: 2, messages: [{ who: "a", text: "written", held: "" }] });
  assert.deepEqual(slots, { tab: 2, at: {} });
});

test("A PLACE FOUND AGAIN BY ITS JOB'S MARK (2026-10-05): the page may put an earlier request's messages above a held reply; where the page marks each reply with its job, the place moves with it, and a place now marked with another job is never read as this one's", () => {
  const read1 = { origin: 1, messages: [{ who: "u", text: "x" }, { who: "a", text: HOLD_LINE, held: "j1", holding: true, job: "j1" }] };
  let slots = trackHeld(null, read1);
  assert.deepEqual(slots.at, { j1: 1 });
  // AN EARLIER REQUEST PUT ABOVE IT, AND THE REPLY SETTLED: found at 3 by its mark.
  const read2 = { origin: 1, messages: [{ who: "a", text: "", card: true }, { who: "a", text: "Changed the description.", job: "h1" }, { who: "u", text: "x" }, { who: "a", text: MENU_REPLY, held: "", holding: false, job: "j1" }] };
  slots = trackHeld(slots, read2);
  assert.deepEqual(slots.at, { j1: 3 });
  const network = [{ method: "GET", path: "/api/site/edit/j1", final: true, status: 200, res: WRITTEN(MENU_REPLY), ms: 9 }];
  const now = repliesNow({ jobs: [{ job: "j1", part: 0 }], network, s: read2, slots, key: KEY(1) });
  assert.deepEqual(now.jobs.map((j) => [j.state, j.at, j.shown, j.settled]), [["model", 3, true, true]]);
  // A PAGE THAT MARKS NOTHING (deploy 2183's): the place stays where it was first seen.
  const bare = (m) => { const { job: _drop, ...rest } = m; return rest; };
  assert.deepEqual(trackHeld(trackHeld(null, { ...read1, messages: read1.messages.map(bare) }), { ...read2, messages: read2.messages.map(bare) }).at, { j1: 1 });
  // AND A KEPT PLACE NOW MARKED WITH ANOTHER JOB is not this one's: the reply is looked for by its words instead.
  const moved = { origin: 1, messages: [{ who: "u", text: "x" }, { who: "a", text: "Changed the description.", job: "h1" }] };
  const other = repliesNow({ jobs: [{ job: "j1", part: 0 }], network, s: moved, slots: { tab: 1, at: { j1: 1 } }, key: KEY(1) });
  assert.deepEqual(other.jobs.map((j) => [j.at, j.shown]), [[null, false]]);
});

test("on screen as many times as needed: two jobs whose answers carry the same words need two messages carrying them; a question asked in the same words by another request likewise", () => {
  const net = [
    { method: "GET", path: "/api/site/edit/j1", final: true, res: WRITTEN("Same words."), ms: 1 },
    { method: "GET", path: "/api/site/edit/h1", final: true, res: WRITTEN("Same words."), ms: 2 },
  ];
  const one = { origin: 1, messages: [{ who: "a", text: "Same words." }], requests: {} };
  assert.equal(repliesNow({ jobs: [{ job: "j1", part: 0 }], network: net, s: one }).jobs[0].shown, false);
  const two = { origin: 1, messages: [{ who: "a", text: "Same words." }, { who: "a", text: "Same words." }], requests: {} };
  assert.equal(repliesNow({ jobs: [{ job: "j1", part: 0 }], network: net, s: two }).jobs[0].shown, true);
  // A CARD, A USER'S MESSAGE OR A HELD LINE NEVER COUNTS.
  const cards = { origin: 1, messages: [{ who: "a", card: true, text: "Same words." }, { who: "u", text: "Same words." }, { who: "a", text: "Same words.", holding: true }, { who: "a", text: "Same words." }], requests: {} };
  assert.equal(repliesNow({ jobs: [{ job: "j1", part: 0 }], network: net, s: cards }).jobs[0].shown, false);
  // THE QUESTION.
  const q = [
    { method: "GET", path: "/api/site/edit/j2", final: true, res: QUESTION, ms: 1 },
    { method: "GET", path: "/api/site/edit/h2", final: true, res: { ok: false, clarify: { id: "old", text: QUESTION.clarify.text } }, ms: 2 },
  ];
  const asked = (n) => repliesNow({ jobs: [{ job: "j2", part: 1 }], network: q, s: { origin: 1, messages: Array.from({ length: n }, () => ({ who: "a", text: QUESTION.clarify.text })), requests: {} } }).jobs[0];
  assert.equal(asked(1).asked, false);
  assert.equal(asked(1).settled, false);
  assert.equal(asked(2).asked, true);
});

test("the request's own reply counts once the page says it showed this request's reply and its words are on screen; one still pending holds the wait, one that failed does not", () => {
  const s = (replied) => ({ origin: 1, messages: [{ who: "a", text: "Both changes are live." }], requests: { [KEY(1)]: { replied, replies: replied ? ["end"] : [] } } });
  const own = { text: "Both changes are live.", source: "model", for: "end" };
  assert.equal(repliesNow({ jobs: [], s: s(true), key: KEY(1), request: own }).request.shown, true);
  // THE WORDS ALONE, PUT THERE BY ANOTHER REQUEST, DO NOT COUNT.
  assert.equal(repliesNow({ jobs: [], s: s(false), key: KEY(1), request: own }).request.shown, false);
  assert.equal(repliesNow({ jobs: [], s: s(false), key: KEY(1), request: { state: "pending", for: "end" } }).settled, false);
  assert.equal(repliesNow({ jobs: [], s: s(false), key: KEY(1), request: { state: "failed", for: "end" } }).settled, true);
  assert.deepEqual(watchedReplies(timedOut(repliesNow({ jobs: [], s: s(false), key: KEY(1), request: { state: "pending", for: "end" } }))).map((r) => [r.part, r.source]), [["request", "timeout"]]);
});

test("each state fails in its own words; only the model's own reply, on screen, passes", () => {
  assert.equal(replyFailure({ source: "model", shown: true }), "");
  assert.match(replyFailure({ source: "model", shown: false }), /written but is not on screen/);
  assert.match(replyFailure({ source: "timeout" }), /^timed out: the reply was still being written when the message's time ran out$/);
  assert.match(replyFailure({ source: "pending" }), /^timed out: the reply was still being written when it was judged$/);
  assert.match(replyFailure({ source: "failed", text: "x" }), /^failed: the reply was not written \(the server gave up\)/);
  assert.match(replyFailure({ source: "composed", text: "x" }), /^composed: no model reply on it/);
  assert.match(replyFailure({ source: "unread" }), /^unread: the page never read this job's answer$/);
  const reasons = ["model", "timeout", "pending", "failed", "composed", "unread", "none"].map((source) => replyFailure({ source, shown: false, text: "t" }));
  assert.equal(new Set(reasons).size, reasons.length, "two states fail in the same words");
});

test("RUN 97'S OWN SHAPE, judged again: a reply whose last answer was still pending is said to have been judged before it was written — never 'composed' — and a request's message whose replies were never watched fails on that", () => {
  const job = "f666481af2ef5410b14e00b9ad0da43d";
  const step = {
    n: 1, sent: true, replies: ["Done — writing up what changed…"],
    network: [
      { method: "GET", path: `/api/site/edit/${job}`, final: true, status: 200, res: { ...PENDING(), links: [{ label: "Classes", href: "/classes" }] }, ms: 203119 },
      { method: "GET", path: `/api/site/edit/${job}`, final: true, status: 200, res: PENDING(), ms: 204363 },
    ],
    request: { key: "d4afde4bee534c1aa9335bcbadc9e460", final: { key: "d4afde4bee534c1aa9335bcbadc9e460", ended: true, parts: [{ n: 0, status: "done", ids: ["1eac152bbd7a7f7e437632fd5fddf800", job], jobs: [job] }] } },
  };
  const f = failed(replyChecks([step]));
  assert.ok(f.some((x) => /part 0's reply is the model's own, and on screen — timed out: the reply was still being written when it was judged/.test(x)), f.join("\n"));
  assert.ok(!f.some((x) => /composed/.test(x)), "a pending reply was called composed");
  const unwatched = failed(replyChecks([{ ...step, completed: true }]));
  assert.ok(unwatched.some((x) => /message 1's replies were watched to their end — the request ended, and its replies were judged without waiting for them/.test(x)), unwatched.join("\n"));
});

// ── THE PAGE'S OWN READER AND THE WIRING ─────────────────────────────────────

const MOD = fs.readFileSync(ROOT + "scripts/canary-ui.mjs", "utf8");
const cutFn = (head) => {
  const open = MOD.indexOf("\n" + head);
  assert.ok(open > 0, head + " is gone");
  const shut = MOD.indexOf("\n}\n", open);
  assert.ok(shut > open, head + " has no end");
  return MOD.slice(open, shut + 3);
};

test("the reader inside the app reads each message's held job off the page's own thread — only while the drawn and kept counts agree — the waiting line off the drawing, the page's life, and whether it showed a request's own reply", () => {
  const el = (cls, text, extra = {}) => ({ classList: { contains: (c) => cls.includes(c) }, querySelector: (sel) => (sel === ".st-req" ? (extra.card ? {} : null) : sel === ".st-think" ? (extra.think ? {} : null) : null), innerText: text, textContent: text });
  const kept = [
    { r: "u", t: "Put the Classes page in the menu on every page." },
    { r: "a", t: "", request: KEY(1) },
    { r: "a", t: HOLD_LINE, held: { job: "m1", at: 5, else: "✅ Added." }, job: "m1" },
  ];
  const run = (drawn, site) => {
    const ctx = vm.createContext({
      document: { getElementById: (id) => ({ stRevise: { value: "", disabled: false }, stSend: { disabled: false }, stPlus: {} })[id] || null, querySelectorAll: (sel) => (sel === "#stThread .st-msg" ? drawn : []), querySelector: () => null },
      window: { EditPoll }, EditPoll, getComputedStyle: () => ({ display: "none" }), performance: { timeOrigin: 1234.5 },
      Auth: { isSignedIn: () => true, userId: () => UID }, siteDraft: () => ({ imgs: [] }), siteAttachFor: "s1", siteBusy: false,
      siteById: (id) => (id === "s1" ? site : null), siteOpenId: "s1",
    });
    vm.runInContext(cutFn("function readComposerInPage() {"), ctx);
    return JSON.parse(JSON.stringify(vm.runInContext("readComposerInPage()", ctx)));
  };
  const drawn = [el(["st-msg", "u"], kept[0].t), el(["st-msg"], "Queued", { card: true }), el(["st-msg"], HOLD_LINE, { think: true })];
  const site = { msgs: kept, requests: { [KEY(1)]: { closed: true, view: { ended: true }, shown: ["m1"], replied: true, replies: ["end"] } } };
  const s = run(drawn, site);
  assert.deepEqual(s.messages.map((m) => [m.who, m.card, m.holding, m.held]), [["u", false, false, ""], ["a", true, false, ""], ["a", false, true, "m1"]]);
  // AND EACH REPLY'S JOB MARK, where the page writes one (2026-10-05), paired the same way.
  assert.deepEqual(s.messages.map((m) => m.job), ["", "", "m1"]);
  assert.equal(s.origin, 1234.5);
  assert.deepEqual(s.requests[KEY(1)], { closed: true, ended: true, shown: ["m1"], replied: true, replies: ["end"] });
  // THE BUSY ROW, LAST, DOES NOT SHIFT THE COUNT.
  const busy = run([...drawn, el(["st-msg", "st-busy"], "Working")], site);
  assert.deepEqual(busy.messages.map((m) => m.held), ["", "", "m1", ""]);
  // COUNTS THAT DISAGREE: no message is given a job.
  const off = run(drawn.slice(0, 2), site);
  assert.deepEqual(off.messages.map((m) => m.held), ["", ""]);
  assert.deepEqual(off.messages.map((m) => m.job), ["", ""]);
  // MORE DRAWN THAN KEPT (a drawing behind the thread): pairing them by
  // place would hand the held job to the wrong message, so none is given.
  const lag = run([...drawn.slice(0, 2), el(["st-msg"], "a message the thread no longer keeps")], { ...site, msgs: [kept[0], kept[2]] });
  assert.deepEqual(lag.messages.map((m) => m.held), ["", "", ""]);
  // A HELD MARK THE PAGE'S OWN READER REFUSES is no job.
  const bad = run(drawn, { ...site, msgs: [kept[0], kept[1], { r: "a", t: HOLD_LINE, held: { job: 7 } }] });
  assert.deepEqual(bad.messages.map((m) => m.held), ["", "", ""]);
});

test("the reader of a request inside the app hands back, with no reply on it yet, whether one is being written or failed — and which reply it is", async () => {
  const run = async (body) => {
    const ctx = vm.createContext({ apiFetch: async () => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }) });
    vm.runInContext(cutFn("async function requestViewInPage({ slug, key }) {"), ctx);
    return JSON.parse(JSON.stringify(await vm.runInContext(`requestViewInPage({ slug: "${SLUG}", key: "${KEY(1)}" })`, ctx)));
  };
  const pending = await run({ ok: true, request: { key: KEY(1), ended: true, parts: [] }, replyState: "pending", replyFor: "end" });
  assert.deepEqual({ reply: pending.reply, replyState: pending.replyState, replyFor: pending.replyFor }, { reply: null, replyState: "pending", replyFor: "end" });
  const written = await run({ ok: true, request: { key: KEY(1), ended: true, parts: [] }, reply: "Both are live.", replySource: "model", replyFor: "end" });
  assert.deepEqual(written.reply, { text: "Both are live.", source: "model", for: "end" });
  assert.equal(written.replyState, "");
  assert.equal((await run({ ok: true, request: { key: KEY(1), ended: true, parts: [] }, replyState: "weird" })).replyState, "", "a state the canary does not know was passed on");
});

test("THE WIRING: every message the server took on waits for its own replies before anything is judged or sent next, by the message's own bound with the floor after the request ended; and a request press's bounds and floors fit the press", () => {
  const loop = MOD.slice(MOD.indexOf("const done = r.mode === \"away\""), MOD.indexOf("// USABLE, NOT MERELY DRAWN"));
  assert.ok(loop.length > 200, "the message loop is gone");
  const watch = loop.indexOf("await watchReplies(page, r,");
  assert.ok(watch > 0, "the replies are not watched");
  assert.ok(watch < loop.indexOf("await sleep(settleMs)") && watch < loop.indexOf("r.replies ="), "the replies are read before they are watched");
  assert.ok(loop.includes("if (done.ok && r.request && r.request.key) {"), "the watch is not for every message the server took on");
  assert.ok(loop.includes("end: Math.max(sentAt + r.boundMs, Date.now() + replyFloorMs)"), "the deadline is not the message's bound with the floor");
  // THE WATCH WAITS ON THE CURRENT REQUEST'S JOBS, read through the readers.
  const body = MOD.slice(MOD.indexOf("const watchReplies = async"), MOD.indexOf("const browser = await launch();"));
  for (const want of ["replyJobsOf(view, earlier)", "trackHeld(slots, s)", "repliesNow({", "timedOut(now)", "if (now.settled) break;", "requestViewInPage"]) assert.ok(body.includes(want), `the watch does not use ${want}`);
  assert.equal(UI_REPLY_FLOOR_MS, 60_000);
  for (const [name, s] of Object.entries(UI_SCENARIOS).filter(([, x]) => x.request === true)) {
    const total = s.steps.reduce((t, x) => t + stepBoundMs(x) + UI_REPLY_FLOOR_MS, 0);
    assert.ok(total <= UI_PRESS_MAX_MS, `${name}'s messages and their reply floors may run ${total / 60000} minutes`);
  }
  // THE VERDICT READS THE WATCH.
  const req = fs.readFileSync(ROOT + "scripts/canary-requests.mjs", "utf8");
  assert.ok(req.includes("if (step && step.replyWatch) return watchedReplies(step.replyWatch, seen);"), "the verdict does not read the watched replies");
});
