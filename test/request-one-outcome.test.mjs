// ONE OUTCOME PER MESSAGE (2026-11-01, northline-climbing, the owner's live
// report). Right after a three-change message the chat said "I couldn't work
// out what to do with that just now, so nothing on your site changed. Send it
// again in a moment." and then the request flow's card said all three parts
// were going ahead. The server had taken the message on as a request (the
// routing answer carried `request`), but `siteRoute` checked the answer as a
// one-step decision first (`routeActionable`) and, finding a shape it does not
// act on, said the failure line and put the message back in the box; the
// request then ran anyway and its card turned up. A message the request flow
// takes is followed as that request, and the failure line is never said too.
//
// `siteRoute`, `routeActionable` and `siteRequestOf` are cut out of
// public/chat.js and RUN; `fetch` is the only network seam. Every routing
// answer is SUPPLIED: this proves what the browser does with an answer, never
// what a real router answers.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const CHAT = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
function cut(head) {
  const open = CHAT.indexOf("\n" + head);
  assert.ok(open > 0, head + " is gone from chat.js");
  const shut = CHAT.indexOf("\n}\n", open);
  assert.ok(shut > open, head + " has no end");
  return CHAT.slice(open, shut + 3);
}
function cutLine(head) {
  const open = CHAT.indexOf("\n" + head);
  assert.ok(open > 0, head + " is gone from chat.js");
  return CHAT.slice(open, CHAT.indexOf("\n", open + 1) + 1);
}
const SRC = [cutLine("const ROUTE_EDIT_LAYERS ="), cut("function routeActionable("), cut("function siteRequestOf("), cut("function siteRoute(")].join("\n");
const FAIL_LINE = "I couldn’t work out what to do with that just now, so nothing on your site changed. Send it again in a moment.";
const KEY = "k".repeat(24);
const REQ = { key: "r".repeat(24), state: "running", ended: false, parts: [0, 1, 2].map((n) => ({ n, words: "change " + n, status: "queued", jobs: [] })) };

async function drive(body, status = 200) {
  const said = [], started = [], held = [], fetched = [];
  const site = { id: "s1", slug: "northline-climbing", name: "Northline", url: "https://northline-climbing.gofarther.app", pages: [{ path: "/" }], msgs: [] };
  const ctx = {
    console, setTimeout, Promise, JSON, Date, Math, Number, String, Array, Object, Map, Set,
    fetch: async (u) => { fetched.push(String(u)); return new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": "application/json" } }); },
    apiFetch: (u, o) => ctx.fetch(u, o),
    siteById: () => site, sitePages: (s) => s.pages, sitesSave() {}, renderSites() {}, siteOpenId: "x",
    siteTablesOrder: { clock: 0 }, siteTablesRead: () => false, browserTimeZone: () => "Europe/London", buildPicker: "grok",
    siteHoldUnsent: (...a) => held.push(a), siteAskClear() {}, siteBusyEnd() {}, siteBuildStop() {}, siteAskSet() {},
    siteRequestStart: (origin, d, imgs, key) => started.push({ origin, request: d.request, key }),
    reactSend() { throw new Error("a rewrite was started"); },
    siteEdit() { throw new Error("an edit was posted"); }, siteAddon() { throw new Error("an addition was posted"); },
    liveQuestion: (d) => (d && d.question && typeof d.question.id === "string" && typeof d.question.text === "string" ? d.question : null),
    routeQuestion: () => null,
    EditPoll: { modelReply: (d) => (d && typeof d.reply === "string" ? d.reply : null), heldList: (v) => (v == null ? [] : Array.isArray(v) ? v : null), contextOf: (v) => (v == null ? [] : v), contextWire: (v) => v, newIdemKey: () => "n".repeat(24) },
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  const finish = (t) => said.push(t);
  ctx.siteRoute(site, "Make the header dark, add a members page and email me new bookings", "s1", false, [], finish, false, undefined, KEY, false);
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0));
  return { said, started, held, fetched };
}

// SHAPES THE PAGE DOES NOT ACT ON AS A ONE-STEP DECISION, each carrying the
// request the server took on.
const CASES = [
  ["an `ask` answer with no words", { ok: true, intent: "ask", answer: "", cost: 2, request: REQ, reply: "The three changes will move forward side by side." }],
  ["a question the page cannot draw", { ok: true, intent: "clarify", question: { text: "Which page?" }, cost: 2, request: REQ }],
  ["an edit naming a step the page does not know", { ok: true, intent: "edit", layer: "agent", cost: 2, request: REQ }],
];

for (const [name, body] of CASES) {
  test("ONE OUTCOME: " + name + ", carrying the request the server took on, is followed as that request, never said to have failed", async () => {
    const r = await drive(body);
    assert.equal(r.fetched.length, 1, "the routing call was made");
    assert.equal(r.started.length, 1, "the request was not followed: " + JSON.stringify(r.said));
    assert.equal(r.started[0].request.key, REQ.key);
    assert.equal(r.started[0].key, KEY, "followed under the message's own key");
    assert.ok(!r.said.includes(FAIL_LINE), "the failure line was said beside the request");
    assert.equal(r.said.length, 0);
    assert.equal(r.held.length, 0, "the message was put back in the box to send again");
  });
}

// CONTROLS: the stop still stands where nothing was taken on.
test("CONTROL: the same shape with no request is still a stop, said once, the message held", async () => {
  const r = await drive({ ok: true, intent: "ask", answer: "", cost: 2 });
  assert.deepEqual(r.said, [FAIL_LINE]);
  assert.equal(r.started.length, 0);
  assert.equal(r.held.length, 1);
});
test("CONTROL: the router's own failure (`failed: true`) is a stop even beside a request-shaped field", async () => {
  const r = await drive({ ok: true, intent: "addon", failed: true, request: REQ });
  assert.deepEqual(r.said, [FAIL_LINE]);
  assert.equal(r.started.length, 0);
});
test("CONTROL: a non-2xx answer is a stop even beside a request-shaped field", async () => {
  const r = await drive({ ok: true, intent: "ask", answer: "", request: REQ }, 503);
  assert.deepEqual(r.said, [FAIL_LINE]);
  assert.equal(r.started.length, 0);
});
test("CONTROL: an actionable edit carrying a request is followed as before", async () => {
  const r = await drive({ ok: true, intent: "edit", layer: "look", cost: 2, request: REQ });
  assert.equal(r.started.length, 1);
  assert.equal(r.said.length, 0);
});
