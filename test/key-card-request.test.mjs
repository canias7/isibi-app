// THE KEY BOX FOR A PART OF A REQUEST, HOWEVER IT ENDS (2026-11-01,
// northline-climbing). The site agent asked for RESEND_API_KEY and its part
// then paused for credits; the request kept nothing of the ask and the page
// never drew the box. A part keeps the keys its step's answer names
// (`needKeys`, names only) on every ending, the request's view shows them, and
// the page offers the card from any reading of a request.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { planParts, newRequest, nextStep, noteJobId, requestView, partNeedKeys } from "../builder/request.mjs";

const NEED = [{ name: "RESEND_API_KEY", service: "Resend", why: "Sends the booking emails" }];
const MESSAGE = "Make the header dark, and add a members page";

function filed(message, routed) {
  const planned = planParts(message, routed);
  assert.equal(planned.ok, true, JSON.stringify(planned));
  const rec = newRequest({ key: "rqkeys00000000001", uid: "u1", slug: "northline-climbing", message, picker: "sonnet", tz: "Europe/London", accepted: routed, parts: planned.parts });
  const first = nextStep(rec, {}, Date.now());
  assert.ok(first.file, "the request filed no job");
  return noteJobId(first.record, first.file.key, "a".repeat(32));
}
const ended = (status, body, state = "failed") => ({ ok: true, state, billing: "refunded", needs_review: false, result: { status, body: JSON.stringify(body) } });
const view = (rec) => JSON.parse(JSON.stringify(requestView(rec)));

test("a part PAUSED FOR CREDITS keeps the keys its step asked for, and the view shows them, names only", () => {
  const rec = filed(MESSAGE, { intent: "edit", layer: "look", alsoAsked: ["add a members page"] });
  const after = nextStep(rec, { ["a".repeat(32)]: ended(402, { ok: false, error: "unbilled", detail: "insufficient", layer: "agent", cost: 0, unchanged: true, needKeys: [{ ...NEED[0], value: "re_live_123" }] }) }, Date.now()).record;
  assert.equal(after.parts[0].status, "credits", JSON.stringify(after.parts.map((p) => p.status)));
  const v = view(after);
  assert.deepEqual(v.parts[0].needKeys, NEED);
  assert.ok(!JSON.stringify(v).includes("re_live_123"), "a value rode into the view");
});

test("a part that FAILED, and one STOPPED, keep the keys too; a part whose answer asked for none has no field (control)", () => {
  const one = filed("Email me new bookings", { intent: "edit", layer: "page" });
  const failed = nextStep(one, { ["a".repeat(32)]: ended(200, { ok: false, error: "agent-stopped", layer: "agent", cost: 0, needKeys: NEED }) }, Date.now()).record;
  assert.ok(["failed", "partial"].includes(failed.parts[0].status), failed.parts[0].status);
  assert.deepEqual(view(failed).parts[0].needKeys, NEED);
  const stopped = nextStep(one, { ["a".repeat(32)]: ended(410, { ok: false, error: "stopped", cancelled: true, layer: "agent", cost: 0, needKeys: NEED }, "cancelled") }, Date.now()).record;
  assert.equal(stopped.parts[0].status, "cancelled");
  assert.deepEqual(view(stopped).parts[0].needKeys, NEED);
  const plain = nextStep(one, { ["a".repeat(32)]: ended(200, { ok: false, error: "agent-stopped", layer: "agent", cost: 0 }) }, Date.now()).record;
  assert.equal(view(plain).parts[0].needKeys, undefined);
});

test("partNeedKeys reads names that look like key names only, at most 8, no other field", () => {
  assert.deepEqual(partNeedKeys({ needKeys: [{ name: "lower" }, { name: "A" }, "X_KEY", { name: "GOOD_KEY", value: "v", hint: "h" }, { name: "GOOD_KEY" }] }), [{ name: "GOOD_KEY" }]);
  assert.equal(partNeedKeys({ needKeys: Array.from({ length: 12 }, (_, i) => ({ name: "KEY_" + i })) }).length, 8);
  assert.deepEqual(partNeedKeys(null), []);
});

// ── THE PAGE: any reading of a request offers the card ────────────────────
const CHAT = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
function cut(head) {
  const open = CHAT.indexOf("\n" + head);
  assert.ok(open > 0, head + " is gone from chat.js");
  return CHAT.slice(open, CHAT.indexOf("\n}\n", open) + 3);
}
function load() {
  const offered = [];
  const ctx = { siteKeyCards: new Map(), siteKeyCardOffer: (id, list) => { offered.push(list.map((k) => k.name)); const c = ctx.siteKeyCards.get(id) || { keys: [] }; for (const k of list) c.keys.push(k); ctx.siteKeyCards.set(id, c); } };
  vm.createContext(ctx);
  vm.runInContext(cut("function siteReqKeyCard(").replace("function siteReqKeyCard(", "var siteReqKeyCard = function ("), ctx);
  return { ctx, offered };
}

test("the page offers the card from a request's reading: a paused part's keys and the site's asked keys, each once", () => {
  const { ctx, offered } = load();
  const reading = { ok: true, needKeys: [{ name: "RESEND_API_KEY" }], request: { key: "r", parts: [{ n: 0, status: "credits", needKeys: NEED }, { n: 1, status: "done" }] } };
  ctx.siteReqKeyCard("s1", reading);
  assert.deepEqual(JSON.parse(JSON.stringify(offered)), [["RESEND_API_KEY"]], "offered other than once");
  ctx.siteReqKeyCard("s1", reading);
  assert.equal(offered.length, 1, "a later poll offered the same key again");
  ctx.siteReqKeyCard("s1", { ok: true, requests: [{ key: "r2", parts: [{ n: 0, status: "failed", needKeys: [{ name: "STRIPE_SECRET_KEY" }] }] }] });
  assert.deepEqual(JSON.parse(JSON.stringify(offered[1])), ["STRIPE_SECRET_KEY"], "the list reading's failed part was not offered");
  ctx.siteReqKeyCard("s1", { ok: true, request: { key: "r3", parts: [{ n: 0, status: "done" }] } });
  assert.equal(offered.length, 2, "a reading with no keys offered a card");
});

test("both request readers call it: the one request's poll and the site's list", () => {
  const follow = cut("function siteRequestFollow(");
  const check = cut("function siteRequestsCheck(");
  assert.ok(/siteReqKeyCard\(origin, b\)/.test(follow), "the request poll does not offer the card");
  assert.ok(/siteReqKeyCard\(origin, b\)/.test(check), "the list read does not offer the card");
});
