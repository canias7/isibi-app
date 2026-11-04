// Cancel on the key box is kept ON THE SERVER (owner, 2026-11-04: "i refreshed
// the page and the box … appeared again even after i pressed cancel", then "it
// should be server … nothing should be only browser"). The closed key NAMES ride
// the project's chat record: written by chatPush, cleaned by the server's
// readChatPut, read back by chatAdopt on any device.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const chat = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
const worker = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const cutIn = (src, head) => { const at = src.indexOf(head); assert.ok(at >= 0, head); return src.slice(at, src.indexOf("\n}\n", at) + 2); };
const cut = (head) => cutIn(chat, head);
const line = (head) => { const at = chat.indexOf(head); assert.ok(at >= 0, head); return chat.slice(at, chat.indexOf("\n", at) + 1); };
const helperSrc = () => { const a = chat.indexOf("const KeyNamesClosed = (() => {"); assert.ok(a > 0); return chat.slice(a, chat.indexOf("})();", a) + 6); };

// THE SERVER'S OWN CLEANER, as it runs.
const srv = vm.createContext({ CHAT_MAX_MSGS: 400 });
vm.runInContext(cutIn(worker, "function keyNamesOnly(") + cutIn(worker, "function readChatPut("), srv);

const NEED = [{ name: "STRIPE_SECRET_KEY", service: "Stripe" }, { name: "STRIPE_WEBHOOK_SECRET", service: "Stripe" }];

// One device's page: its memory, and its copy of the project.
function device(site) {
  const drawn = [];
  const ctx = vm.createContext({
    KeyCard: { needKeys: (l) => (Array.isArray(l) ? l : []) },
    siteById: (id) => (id === site.id ? site : null),
    sitesSave: () => {},
    siteKeyCardDraw: (id) => drawn.push(id), siteKeyCardAttach: () => {}, siteKeyCardRead: () => {},
  });
  vm.runInContext(helperSrc() + line("const siteKeyCards = new Map();") + line("const siteKeyCardsClosed = new Map();") +
    ["function siteKeyCardsClosedFor(", "function siteKeySlug(", "function siteKeyCardOffer(", "function siteKeyCardClose(", "function chatAdopt("].map(cut).join("\n"), ctx);
  return { ctx, drawn };
}
// The body chatPush really sends, evaluated from its own expression.
function pushBody(s) {
  const n = chat.indexOf("async function chatPush(");
  const m = /const body = (\{ baseRev: Number\(s\.chatRev\)[^\n]*\});\n/.exec(chat.slice(n));
  assert.ok(m, "chatPush's body expression");
  return new Function("s", "return " + m[1])(s);
}

test("Cancel on one device: the server keeps the names, and another device's box stays closed", () => {
  const laptop = { id: "s1", slug: "market-lane", msgs: [] };
  const a = device(laptop);
  a.ctx.siteKeyCardOffer("s1", NEED);
  assert.equal(a.drawn.length, 1, "the observer is alive: the box opened");
  a.ctx.siteKeyCardClose("s1");
  const stored = srv.readChatPut(JSON.parse(JSON.stringify(pushBody(laptop))));
  assert.deepEqual([...stored.keysClosed], ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"], "the server kept no names");
  const phone = { id: "s1", slug: "market-lane", msgs: [] };
  const b = device(phone);
  b.ctx.chatAdopt(phone, { ...stored, rev: 2 });
  b.ctx.siteKeyCardOffer("s1", NEED);
  assert.equal(b.drawn.length, 0, "the box opened again on another device / after a reload");
});

test("a new key still opens it (control)", () => {
  const phone = { id: "s1", slug: "market-lane", msgs: [], keysClosed: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] };
  const b = device(phone);
  b.ctx.siteKeyCardOffer("s1", [...NEED, { name: "RESEND_API_KEY", service: "Resend" }]);
  assert.equal(b.drawn.length, 1, "a key never closed did not open the box");
});

test("only key names are kept, in the page and on the server: a value never is", () => {
  const s = { id: "s1", slug: "x", msgs: [] };
  const d = device(s);
  vm.runInContext("KeyNamesClosed", d.ctx).write("s1", ["STRIPE_SECRET_KEY", "sk_live_abc123", "", 7]);
  assert.deepEqual([...s.keysClosed], ["STRIPE_SECRET_KEY"]);
  const put = srv.readChatPut({ baseRev: 0, msgs: [], keysClosed: ["OK_NAME", "sk_live_abc123", { a: 1 }] });
  assert.deepEqual([...put.keysClosed], ["OK_NAME"]);
});

test("nothing of the key box is kept in the browser's own storage", () => {
  assert.ok(!/localStorage|sessionStorage/.test(helperSrc().replace(/\/\/[^\n]*/g, "")), "the closed names went to browser storage");
});
