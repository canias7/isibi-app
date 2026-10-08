// THE CONTINUATION OF RUN 107 (2026-10-08, prepared, not pressed).
//
// Run 107's second request waits on its TikTok step's question. The owner:
// *"Prepare a narrowly scoped continuation of the existing waiting TikTok
// request, checking whether it is still resumable and estimating its cost, so
// we can finish clarification verification without repeating completed
// work."* One message — the answer — sent only when exactly one question is
// waiting on the site, and judged on whether it resumed exactly that part.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  UI_SCENARIOS, readUiScenario, stepBoundMs, pathNeedMs, pressLimitMs, UI_REPLY_FLOOR_MS,
  waitingRefusal, answerResumedVerdict, requestKeyOf, requestWall,
} from "../scripts/canary-ui.mjs";
import { requestStepChecks } from "../scripts/canary-requests.mjs";
import { rqApp, drive, SLUG, view, part } from "./fixtures/canary-rq-app.mjs";

const LT = UI_SCENARIOS["lv-tiktok-answer"];
const KEY = "475d4ff79c7887bb18d546fcecf15edf";
const Q = "What’s the full address of your TikTok profile?";
const waitingList = (extra = []) => ({ status: 200, json: { requests: [
  { key: "66a6a192da0e75125140035f611cf38f", ended: true, parts: [{ n: 0, status: "done" }, { n: 1, status: "done" }] },
  { key: KEY, ended: false, parts: [
    { n: 0, words: "Change the Order page heading", status: "done", route: "text" },
    { n: 1, words: "add a link to our TikTok in the footer", status: "waiting", question: { id: "a00872db7f0459d0fd270d6029e611ae", text: Q } },
  ] },
  ...extra,
] } });

test("TIKTOK 1 — the scenario: the bakery, one message, the answer word for word, only to a waiting question, inside its budget, its cap, its walls and its time", () => {
  assert.ok(LT, "no lv-tiktok-answer scenario");
  assert.equal(LT.site, SLUG);
  assert.equal(LT.request, true);
  assert.equal(LT.steps.length, 1, "it repeats completed work");
  assert.equal(LT.steps[0].say, "It's tiktok.com/@harbourloaf");
  assert.equal(LT.steps[0].answer, true, "it sends without checking a question is waiting");
  assert.equal(LT.budget, 6);
  assert.equal(LT.fundsFirst, true);
  assert.equal(LT.cap, 15, "the cap is not the balance it starts from");
  assert.deepEqual({ ...LT.expect.social }, { network: "tiktok", host: "tiktok.com", path: "/@harbourloaf" });
  assert.ok(LT.steps[0].say.includes(LT.expect.social.host + LT.expect.social.path));
  assert.equal(LT.expect.headings, undefined, "it checks the heading again");
  assert.equal(LT.expect.pages, undefined, "it checks the Allergens page again");
  assert.ok(stepBoundMs(LT.steps[0]) >= pathNeedMs(LT.steps[0].path));
  assert.ok(stepBoundMs(LT.steps[0]) + UI_REPLY_FLOOR_MS <= pressLimitMs(LT));
  assert.equal(readUiScenario("lv-tiktok-answer", SLUG).ok, true);
  assert.equal(readUiScenario("lv-tiktok-answer", "fretwork-1").ok, false);
  // THE WALL READS EVERY PART, DONE ONES TOO: the request's finished heading
  // part (text) must pass, or the wall would Stop the request it answers.
  const v = waitingList().json.requests[1];
  assert.equal(requestWall({ ...v, parts: v.parts.map((p) => ({ ...p, route: p.route || "nav" })) }, LT, LT.steps[0]), null);
  assert.notEqual(requestWall({ ...v, parts: [{ n: 0, status: "done", route: "look" }] }, LT, LT.steps[0]), null, "the wall lets anything through");
});

test("TIKTOK 2 — exactly one waiting question, read for free; none, two, or an unread list sends nothing", () => {
  const one = waitingRefusal(waitingList());
  assert.equal(one.why, "");
  assert.deepEqual(one.waiting, { key: KEY, part: 1, text: Q, words: "add a link to our TikTok in the footer" });
  assert.match(waitingRefusal({ status: 200, json: { requests: [] } }).why, /no question is waiting/);
  const two = waitingList([{ key: "x".repeat(32), ended: false, parts: [{ n: 0, status: "waiting", question: { text: "Which page?" } }] }]);
  assert.match(waitingRefusal(two).why, /2 questions are waiting/);
  assert.match(waitingRefusal({ status: 500 }).why, /did not answer \(500\)/);
  assert.match(waitingRefusal(null).why, /did not answer/);
  // A QUESTION QUEUED BEHIND ANOTHER IS NOT ASKED YET.
  const queued = { status: 200, json: { requests: [{ key: KEY, parts: [{ n: 1, status: "waiting", question: { text: Q, queued: true } }] }] } };
  assert.match(waitingRefusal(queued).why, /no question is waiting/);
});

test("TIKTOK 3 — the answer is judged on the part it resumed, and its request is followed by the resumed key", () => {
  const net = (res) => [{ method: "POST", path: "/api/site/route", req: { message: LT.steps[0].say }, res }];
  const answering = { key: KEY, part: 1, text: Q };
  assert.deepEqual(answerResumedVerdict({ answering, network: net({ ok: true, resumed: { key: KEY, part: 1 } }) }), { ok: true, why: "" });
  assert.match(answerResumedVerdict({ answering, network: net({ ok: true, resumed: { key: KEY, part: 0 } }) }).why, /not part 1/);
  assert.match(answerResumedVerdict({ answering, network: net({ ok: true, intent: "edit" }) }).why, /names no resumed part \(it answered "edit"\)/);
  assert.match(answerResumedVerdict({ network: net({}) }).why, /no waiting question was recorded/);
  // THE KEY: a message that opened a request names it; an answer names the one it resumed.
  assert.equal(requestKeyOf(net({ request: { key: KEY } })), KEY);
  assert.equal(requestKeyOf(net({ resumed: { key: KEY, part: 1 } })), KEY);
  assert.equal(requestKeyOf(net({ resumed: { key: "short", part: 1 } })), "");
  // THE VERIFIER CARRIES THE CHECK for a continuation's step, and only for one.
  const step = { n: 1, sent: true, say: LT.steps[0].say, answering, network: net({ ok: true, resumed: { key: KEY, part: 1 } }) };
  const c = requestStepChecks(step, LT).find((x) => /answered the question that was waiting/.test(x.name));
  assert.ok(c && c.ok, JSON.stringify(c));
  const bad = requestStepChecks({ ...step, network: net({ ok: true, resumed: { key: KEY, part: 0 } }) }, LT).find((x) => /answered the question that was waiting/.test(x.name));
  assert.ok(bad && !bad.ok);
  const { answering: _, ...plain } = step;
  assert.ok(!requestStepChecks(plain, LT).some((x) => /answered the question that was waiting/.test(x.name)));
});

test("TIKTOK 4 — through the real runUi: with no question waiting, or two, nothing is sent; with exactly one, the answer goes, the question recorded beside it", async () => {
  for (const [list, why] of [[{ status: 200, json: { requests: [] } }, /no question is waiting/], [waitingList([{ key: "y".repeat(32), parts: [{ n: 0, status: "waiting", question: { text: "Which?" } }] }]), /2 questions are waiting/]]) {
    const h = rqApp({});
    const rec = await drive(h, LT, { balanceNow: async () => 15, requestsNow: async () => list });
    assert.equal(rec.sent, 0, "a message was sent with no single question waiting");
    assert.match(rec.stopped.msg, why);
    assert.match(rec.stopped.msg, /nothing is sent/);
  }
  // THE STAND-IN'S SERVER, for the answer itself: the request it resumes, ended.
  const sendPlan = () => ({ request: { key: KEY, views: [view(KEY, [part(0, "Change the Order page heading", "done", { route: "text", jobs: ["j0"] }), part(1, "add a link to our TikTok in the footer", "done", { route: "nav", jobs: ["j1"] })], { ended: true })] } });
  const h = rqApp({ send: sendPlan });
  const rec = await drive(h, LT, { balanceNow: async () => 15, requestsNow: async () => waitingList() });
  assert.equal(rec.sent, 1, "the answer was not sent: " + JSON.stringify(rec.stopped));
  assert.deepEqual(rec.steps[0].answering, { key: KEY, part: 1, text: Q, words: "add a link to our TikTok in the footer" });
  // AND THE CAP: a balance topped up past 15 in between sends nothing.
  const capped = await drive(rqApp({ send: sendPlan }), LT, { balanceNow: async () => 16, requestsNow: async () => waitingList() });
  assert.equal(capped.sent, 0);
});

test("TIKTOK 5 — the workflow's form names it", () => {
  const flow = fs.readFileSync(new URL("../.github/workflows/edit-canary.yml", import.meta.url), "utf8");
  assert.match(flow, /lv-tiktok-answer \(the continuation of run 107 on fold-lane-bakery/);
});

test("TIKTOK 6 — a free press (spend no) says whether the question is still waiting, and sends nothing either way", async () => {
  const yes = await drive(rqApp({}), LT, { spend: false, balanceNow: async () => 15, requestsNow: async () => waitingList() });
  assert.equal(yes.sent, 0);
  assert.deepEqual(yes.steps[0].answering && yes.steps[0].answering.key, KEY, "the waiting question was not found in the free press");
  assert.match(yes.stopped.msg, /spend is not yes/);
  const no = await drive(rqApp({}), LT, { spend: false, balanceNow: async () => 15, requestsNow: async () => ({ status: 200, json: { requests: [] } }) });
  assert.equal(no.sent, 0);
  assert.match(no.stopped.msg, /no question is waiting/);
});
