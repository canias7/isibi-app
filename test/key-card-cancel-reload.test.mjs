// Cancel on the key box is remembered across a reload (owner, 2026-11-04: "i
// refreshed the page and the box to put the keys appeared again even after i
// pressed cancel"). The closed names were kept only in the page's memory.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const chat = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
const cut = (head) => { const at = chat.indexOf(head); assert.ok(at >= 0, head); return chat.slice(at, chat.indexOf("\n}\n", at) + 2); };
const line = (head) => { const at = chat.indexOf(head); assert.ok(at >= 0, head); return chat.slice(at, chat.indexOf("\n", at) + 1); };

const NEED = [{ name: "STRIPE_SECRET_KEY", service: "Stripe" }, { name: "STRIPE_WEBHOOK_SECRET", service: "Stripe" }];

// One page load: its own memory, the project as the browser saved it.
const disk = new Map(); // the browser's localStorage, shared by every page load
function page(stored) {
  const drawn = [];
  let saves = 0;
  const ctx = vm.createContext({
    localStorage: { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => disk.set(k, String(v)) },
    KeyCard: { needKeys: (l) => (Array.isArray(l) ? l : []) },
    siteById: (id) => (id === stored.id ? stored : null),
    sitesSave: () => { saves++; },
    siteKeyCardDraw: (id) => drawn.push(id), siteKeyCardAttach: () => {}, siteKeyCardRead: () => {},
  });
  const helper = chat.slice(chat.indexOf("const KeyNamesClosed = (() => {"), chat.indexOf("})();", chat.indexOf("const KeyNamesClosed = (() => {")) + 6);
  vm.runInContext(helper + line("const siteKeyCards = new Map();") + line("const siteKeyCardsClosed = new Map();") +
    ["function siteKeyCardsClosedFor(", "function siteKeySlug(", "function siteKeyCardOffer(", "function siteKeyCardClose("].map(cut).join("\n"), ctx);
  return { ctx, drawn, saves: () => saves };
}

test("Cancel, reload, the same keys asked again: the box stays closed", () => {
  const site = { id: "s1", slug: "market-lane" };
  const a = page(site);
  a.ctx.siteKeyCardOffer("s1", NEED);
  assert.equal(a.drawn.length, 1, "the observer is alive: the box opened");
  a.ctx.siteKeyCardClose("s1");
  assert.equal(a.saves(), 0, "the card wrote the project's saved copy");
  assert.deepEqual(JSON.parse(disk.get("gf.keysClosed.s1")), ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"], "Cancel kept no names");
  const reloaded = JSON.parse(JSON.stringify(site)); // what localStorage gives back
  const b = page(reloaded);
  b.ctx.siteKeyCardOffer("s1", NEED);
  assert.equal(b.drawn.length, 0, "the box opened again after a reload");
});

test("a new key still opens it after a Cancel and a reload (control)", () => {
  disk.clear();
  const site = { id: "s1", slug: "market-lane" };
  const a = page(site);
  a.ctx.siteKeyCardOffer("s1", NEED);
  a.ctx.siteKeyCardClose("s1");
  const b = page(JSON.parse(JSON.stringify(site)));
  b.ctx.siteKeyCardOffer("s1", [...NEED, { name: "RESEND_API_KEY", service: "Resend" }]);
  assert.equal(b.drawn.length, 1, "a key never closed did not open the box");
});

test("only key names are kept: a value-shaped string never reaches storage", () => {
  disk.clear();
  const site = { id: "s1", slug: "market-lane" };
  const a = page(site);
  vm.runInContext("KeyNamesClosed", a.ctx).write("s1", ["STRIPE_SECRET_KEY", "sk_live_abc123", "", 7]);
  assert.deepEqual(JSON.parse(disk.get("gf.keysClosed.s1")), ["STRIPE_SECRET_KEY"]);
});
