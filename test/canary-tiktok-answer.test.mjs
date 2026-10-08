// THE GUARDED CONTINUATION (2026-10-08; corrected the same day on Codex's
// review of b3d2a409).
//
// Run 107's second request waits on its TikTok step's question. The first
// version sent the answer whenever exactly one question was waiting on the
// site, which Codex reproduced sending it to an unrelated request asking "What
// should the company be called?". The owner: *"require caller-supplied expected
// request, part and question identities, confirm they are still waiting and
// answerable immediately before sending, and verify the same identities
// afterward; one question existing is insufficient. Keep the reusable
// mechanism generic, with run-107 identifiers confined to the test scenario's
// data. Add no-send controls for an unrelated sole question, a replaced
// question on the same part, expiration, cancellation and changed state before
// sending."*
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  UI_SCENARIOS, readUiScenario, stepBoundMs, pathNeedMs, pressLimitMs, UI_REPLY_FLOOR_MS, UI_ANSWER_MARGIN_MS, UI_QUESTION_LIFE_MS,
  answerExpectation, waitingCheck, pageAskCheck, answerResumedVerdict, requestKeyOf, requestWall,
} from "../scripts/canary-ui.mjs";
import { requestStepChecks } from "../scripts/canary-requests.mjs";
import { rqApp, drive, SLUG, view, part } from "./fixtures/canary-rq-app.mjs";

const LT = UI_SCENARIOS["lv-tiktok-answer"];
// THE IDENTITIES, read from the scenario's own data (the one place they live).
const X = LT.steps[0].answer;
const KEY = X.key, Q = X.question, QID = X.id;
const ASKED = Date.parse(X.askedAt);
const SOON = ASKED + 60 * 60_000; // an hour after the question was asked: answerable
const OTHER = "c0mpanyname" + "0".repeat(21);
const theRequest = (over = {}, partOver = {}) => ({
  key: KEY, ended: false, stop: false, state: "waiting", ...over,
  parts: [
    { n: 0, words: "Change the Order page heading", status: "done", route: "text" },
    { n: 1, words: "add a link to our TikTok in the footer", status: "waiting", question: { id: QID, text: Q }, ...partOver },
  ],
});
const unrelated = { key: OTHER, ended: false, parts: [{ n: 0, words: "name the company", status: "waiting", question: { id: "q-company", text: "What should the company be called?" } }] };
const list = (...requests) => ({ status: 200, json: { requests } });
const LIVE_ASK = { id: QID, text: Q, key: KEY, part: 1 };

test("GUARD 1 — the scenario: one message, the answer word for word, to a question named by request, part, words, id and when it was asked; inside its budget, cap, walls and time", () => {
  assert.ok(LT, "no lv-tiktok-answer scenario");
  assert.equal(LT.site, SLUG);
  assert.equal(LT.steps.length, 1, "it repeats completed work");
  assert.equal(LT.steps[0].say, "It's tiktok.com/@harbourloaf");
  const x = answerExpectation(X);
  assert.ok(x, "the scenario's expectation does not read");
  assert.deepEqual(x, { key: KEY, part: 1, question: Q, id: QID, askedAt: ASKED });
  assert.equal(LT.budget, 6);
  assert.equal(LT.cap, 15);
  assert.equal(LT.fundsFirst, true);
  assert.deepEqual({ ...LT.expect.social }, { network: "tiktok", host: "tiktok.com", path: "/@harbourloaf" });
  assert.equal(LT.expect.headings, undefined);
  assert.ok(stepBoundMs(LT.steps[0]) >= pathNeedMs(LT.steps[0].path));
  assert.ok(stepBoundMs(LT.steps[0]) + UI_REPLY_FLOOR_MS <= pressLimitMs(LT));
  assert.equal(readUiScenario("lv-tiktok-answer", SLUG).ok, true);
  // THE WALL READS EVERY PART, DONE ONES TOO: the finished heading (text) must pass.
  assert.equal(requestWall({ ...theRequest(), parts: theRequest().parts.map((p) => ({ ...p, route: p.route || "nav" })) }, LT, LT.steps[0]), null);
  // GENERIC: the mechanism names no request of its own; the identities live only in the scenario.
  const src = fs.readFileSync(new URL("../scripts/canary-ui.mjs", import.meta.url), "utf8");
  assert.equal(src.split(KEY).length - 1, 1, "the request key appears outside the scenario's data");
  assert.equal(src.split(QID).length - 1, 1, "the question id appears outside the scenario's data");
  // AN INCOMPLETE EXPECTATION IS NONE.
  for (const bad of [true, {}, { key: KEY, part: 1 }, { key: KEY, question: Q }, { part: 1, question: Q }, { key: "short", part: 1, question: Q }, { key: KEY, part: 1, question: Q, askedAt: "yesterday" }]) {
    assert.equal(answerExpectation(bad), null, JSON.stringify(bad));
  }
});

test("GUARD 2 — the named question still waiting and answerable passes; every other request on the site is ignored", () => {
  const x = answerExpectation(X);
  assert.deepEqual(waitingCheck(list(unrelated, theRequest()), x, { now: SOON }), { why: "", waiting: { key: KEY, part: 1, text: Q, id: QID, jobs: [] } });
});

test("GUARD 3 — the no-send cases off the list: an unrelated sole question, a replaced question on the same part, expiry, cancellation, an answered part, an unread list", () => {
  const x = answerExpectation(X);
  const why = (l, now = SOON) => waitingCheck(l, x, { now }).why;
  // CODEX'S REPRODUCTION: the only question on the site is another request's.
  assert.match(why(list(unrelated)), /request 475d4ff7\w+ is not on the site's requests list/);
  // THE SAME PART, ASKED AGAIN OR REPLACED: other words, or the same words under another id.
  assert.match(why(list(theRequest({}, { question: { id: QID, text: "Which TikTok account should the footer use?" } }))), /now asks "Which TikTok account/);
  assert.match(why(list(theRequest({}, { question: { id: "a-new-id", text: Q } }))), /not the named a00872db\w+ \(asked again or replaced\)/);
  // EXPIRY: the part expired, or the question's day ends inside the margin.
  assert.match(why(list(theRequest({}, { status: "expired", question: undefined }))), /is "expired", not waiting/);
  assert.match(why(list(theRequest()), ASKED + UI_QUESTION_LIFE_MS - UI_ANSWER_MARGIN_MS + 1), /expires at 2026-10-08T23:59:18.000Z, less than 10 minutes from now/);
  assert.equal(why(list(theRequest()), ASKED + UI_QUESTION_LIFE_MS - UI_ANSWER_MARGIN_MS - 1), "");
  // CANCELLATION: the request stopped, ended, or the part cancelled.
  assert.match(why(list(theRequest({ stop: true }))), /was stopped/);
  assert.match(why(list(theRequest({ ended: true, state: "stopped" }))), /has ended \(stopped\)/);
  assert.match(why(list(theRequest({}, { status: "cancelled" }))), /is "cancelled"/);
  // ANSWERED ALREADY, QUEUED, OR NOTHING TO READ.
  assert.match(why(list(theRequest({}, { status: "started", question: undefined }))), /is "started"/);
  assert.match(why(list(theRequest({}, { question: { id: QID, text: Q, queued: true } }))), /queued behind another/);
  assert.match(why({ status: 500 }), /did not answer \(500\)/);
  assert.match(why(list({ ...theRequest(), parts: [theRequest().parts[0]] })), /has no part 1/);
  assert.match(waitingCheck(list(theRequest()), null).why, /names no expected request/);
});

test("GUARD 4 — the page's own live question must be the named one, or the message would answer something else", () => {
  const x = answerExpectation(X);
  assert.equal(pageAskCheck({ ask: LIVE_ASK, askCard: true }, x), "");
  assert.equal(pageAskCheck({ ask: { id: QID, text: Q, key: "", part: null }, askCard: true }, x), "", "the page need not note the request");
  assert.match(pageAskCheck({ ask: null, askCard: false }, x), /shows no live question/);
  assert.match(pageAskCheck({ ask: { id: "q-company", text: "What should the company be called?", key: OTHER, part: 0 }, askCard: true }, x), /not the named one/);
  assert.match(pageAskCheck({ ask: { ...LIVE_ASK, key: OTHER }, askCard: true }, x), /belongs to request c0mpanyname/);
  assert.match(pageAskCheck({ ask: { ...LIVE_ASK, part: 0 }, askCard: true }, x), /part 0's, not part 1's/);
});

test("GUARD 5 — afterwards, the same identities: the routing resumed the named part, and that part moved on to done", () => {
  const net = (res) => [{ method: "POST", path: "/api/site/route", req: { message: LT.steps[0].say }, res }];
  const answering = { key: KEY, part: 1, text: Q, id: QID };
  const done = { key: KEY, parts: [{ n: 0, status: "done" }, { n: 1, status: "done" }] };
  const step = (res, final) => ({ n: 1, sent: true, say: LT.steps[0].say, answering, network: net(res), request: { key: KEY, final } });
  const named = (c) => c.find((x) => /answered the question that was waiting/.test(x.name));
  const after = (c) => c.find((x) => /afterwards, part 1 of request/.test(x.name));
  let c = requestStepChecks(step({ ok: true, resumed: { key: KEY, part: 1 } }, done), LT);
  assert.ok(named(c).ok && after(c).ok, JSON.stringify(c.filter((x) => !x.ok)));
  c = requestStepChecks(step({ ok: true, resumed: { key: OTHER, part: 0 } }, done), LT);
  assert.ok(!named(c).ok);
  c = requestStepChecks(step({ ok: true, resumed: { key: KEY, part: 1 } }, { key: KEY, parts: [{ n: 1, status: "waiting", question: { id: QID, text: Q } }] }), LT);
  assert.match(after(c).why, /still waits on the named question/);
  c = requestStepChecks(step({ ok: true, resumed: { key: KEY, part: 1 } }, { key: OTHER, parts: [] }), LT);
  assert.match(after(c).why, /the request read afterwards is c0mpanyname/);
  // ANOTHER REQUEST WHOSE OWN PART 1 IS DONE is still not the named one.
  c = requestStepChecks(step({ ok: true, resumed: { key: KEY, part: 1 } }, { key: OTHER, parts: [{ n: 1, status: "done" }] }), LT);
  assert.equal(after(c).ok, false, "another request's done part passed as the named one");
  c = requestStepChecks(step({ ok: true, resumed: { key: KEY, part: 1 } }, { key: KEY, parts: [{ n: 1, status: "failed" }] }), LT);
  assert.match(after(c).why, /it is "failed"/);
  assert.equal(requestKeyOf(net({ resumed: { key: KEY, part: 1 } })), KEY);
  assert.match(answerResumedVerdict({ network: net({}) }).why, /no waiting question was recorded/);
});

test("GUARD 6 — through the real runUi, nothing is sent: an unrelated sole question, a replaced question, expiry, cancellation, a page whose live question is another, and a change between the first check and the send", async () => {
  const run = (requestsNow, { liveAsk = LIVE_ASK, spend = true, now } = {}) => {
    const realNow = Date.now;
    if (now) Date.now = () => now;
    return drive(rqApp({ liveAsk, send: () => ({ request: { key: KEY, views: [view(KEY, [part(1, "x", "done", { jobs: ["j1"] })], { ended: true })] } }) }), LT, { spend, balanceNow: async () => 15, requestsNow })
      .finally(() => { Date.now = realNow; });
  };
  const fixed = (l) => async () => l;
  const cases = [
    ["an unrelated sole question", fixed(list(unrelated)), {}, /not on the site's requests list/],
    ["a replaced question on the same part", fixed(list(theRequest({}, { question: { id: "a-new-id", text: Q } }))), {}, /asked again or replaced/],
    ["the part expired", fixed(list(theRequest({}, { status: "expired", question: undefined }))), {}, /is "expired"/],
    ["the request cancelled", fixed(list(theRequest({ stop: true }))), {}, /was stopped/],
    ["the page's live question is another request's", fixed(list(theRequest())), { liveAsk: { id: "q-company", text: "What should the company be called?", key: OTHER, part: 0 } }, /not the named one/],
    ["the page shows no live question", fixed(list(theRequest())), { liveAsk: null }, /shows no live question/],
  ];
  for (const [what, rn, over, why] of cases) {
    const rec = await run(rn, over);
    assert.equal(rec.sent, 0, what + ": a message was sent");
    assert.match(rec.stopped.msg, why, what + ": " + rec.stopped.msg);
    assert.match(rec.stopped.msg, /nothing is sent/);
  }
  // CHANGED BETWEEN THE FIRST CHECK AND THE SEND: answered elsewhere, cancelled, expired, asked again.
  for (const [what, second, why] of [
    ["answered elsewhere", list(theRequest({}, { status: "started", question: undefined })), /is "started"/],
    ["cancelled", list(theRequest({ stop: true })), /was stopped/],
    ["expired", list(theRequest({}, { status: "expired", question: undefined })), /is "expired"/],
    ["asked again", list(theRequest({}, { question: { id: "a-newer-id", text: Q } })), /asked again or replaced/],
  ]) {
    let reads = 0;
    const rec = await run(async () => (++reads === 1 ? list(theRequest()) : second));
    assert.equal(rec.sent, 0, what + ": sent although it changed before sending");
    assert.match(rec.stopped.msg, /the named question changed before sending/, what);
    assert.match(rec.stopped.msg, why, what + ": " + rec.stopped.msg);
    assert.ok(reads >= 2, what + ": it was not checked again before sending");
  }
  // THE CLOSE TO EXPIRY CASE, through the press: inside the margin, nothing is sent.
  const late = await run(fixed(list(theRequest())), { now: ASKED + UI_QUESTION_LIFE_MS - 60_000 });
  assert.equal(late.sent, 0);
  assert.match(late.stopped.msg, /expires at/);
});

test("GUARD 7 — with everything as named, the answer goes, checked twice before the send; a free press checks once and sends nothing", async () => {
  let reads = 0;
  const h = rqApp({ liveAsk: LIVE_ASK, send: () => ({ request: { key: KEY, views: [view(KEY, [part(1, "x", "done", { jobs: ["j1"] })], { ended: true })] } }) });
  const realNow = Date.now;
  Date.now = () => SOON;
  let rec;
  try { rec = await drive(h, LT, { balanceNow: async () => 15, requestsNow: async () => { reads++; return list(unrelated, theRequest()); } }); } finally { Date.now = realNow; }
  assert.equal(rec.sent, 1, "the answer was not sent: " + JSON.stringify(rec.stopped));
  assert.deepEqual(rec.steps[0].answering, { key: KEY, part: 1, text: Q, id: QID, jobs: [] });
  assert.deepEqual(rec.steps[0].answerChecks.map((c) => c.when), ["first", "before-send"]);
  assert.ok(reads >= 2);
  // THE FREE PRESS (spend no): the first check, the question printed, nothing typed into a send.
  Date.now = () => SOON;
  let free;
  try { free = await drive(rqApp({ liveAsk: LIVE_ASK }), LT, { spend: false, balanceNow: async () => 15, requestsNow: async () => list(theRequest()) }); } finally { Date.now = realNow; }
  assert.equal(free.sent, 0);
  assert.match(free.stopped.msg, /spend is not yes/);
  assert.deepEqual(free.steps[0].answerChecks.map((c) => c.when), ["first"]);
});

test("GUARD 8 — the workflow's form names it", () => {
  const flow = fs.readFileSync(new URL("../.github/workflows/edit-canary.yml", import.meta.url), "utf8");
  assert.match(flow, /lv-tiktok-answer \(the continuation of run 107 on fold-lane-bakery/);
});
