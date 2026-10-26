// A QUESTION'S ANSWERS: PICK, THEN CONTINUE (the owner's option E, 2026-10-14).
//
// Chosen from five rendered options. The card's own functions, cut out of
// public/chat.js and driven: a pick is the page's state, keyed by the
// question it belongs to; Continue takes it once; "Something else…" clears it
// and hands the answer to the composer; and the card draws each answer whole,
// escaped, with Continue disabled until something is picked. The flows that
// click and press through the real handlers are in live-clarify-browser,
// input-handoffs, request-reply-placement and site-entry-inventory.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { PICTOGRAPH } from "./fixtures/pictograph.mjs";

const chat = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
const cut = (head) => {
  const at = chat.indexOf(head);
  assert.ok(at >= 0, head + " is gone from chat.js");
  return chat.slice(at, chat.indexOf("\n}\n", at) + 2);
};
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function card() {
  let focused = 0;
  const ctx = vm.createContext({ esc, sitePicked: null, sitePickOwnKey: "", document: { querySelectorAll: () => [], getElementById: (id) => (id === "stRevise" ? { focus: () => { focused++; } } : null) } });
  for (const n of ["sitePickKeyLive", "sitePickKeyFirst", "sitePickHTML", "sitePickPaint", "sitePick", "sitePickOwn", "sitePickTake"]) vm.runInContext(cut("function " + n + "("), ctx);
  return { ctx, focused: () => focused };
}

test("DRAWN — every answer a row to pick, whole and escaped, one Something else row, Continue disabled until a pick, the way out beside it; no key hint and no emoji", () => {
  const { ctx } = card();
  const html = ctx.sitePickHTML("live", "live:q1", ['Every "loaf"', "Only <today's> bake"], '<button data-ask-cancel="1">Cancel this request</button>');
  assert.match(html, /role="radiogroup"/);
  assert.match(html, /aria-checked="false" data-ask-pick="Every &quot;loaf&quot;"[^]*<span>Every &quot;loaf&quot;<\/span>/);
  assert.match(html, /data-ask-pick="Only &lt;today's&gt; bake"/);
  assert.equal((html.match(/data-ask-own="1"/g) || []).length, 1);
  assert.match(html, /data-ask-go="1" data-pick-key="live:q1" disabled>Continue</);
  assert.match(html, /Continue<\/button><button data-ask-cancel="1">Cancel this request/);
  assert.doesNotMatch(html, /<kbd>/);
  assert.doesNotMatch(html, PICTOGRAPH);
  const first = ctx.sitePickHTML("first", "first:2", ["Bakery"], '<button data-skip="1">Skip</button>');
  assert.match(first, /data-pick="Bakery"[^]*data-pick-own="1"[^]*data-pick-go="1"/);
  assert.doesNotMatch(first, /data-ask-/, "a first build's card carries a live question's attributes");
});

test("PICKED — the pick is drawn as checked and Continue is enabled; a pick for another question is not", () => {
  const { ctx } = card();
  ctx.sitePick("live:q1", "Only today's bake");
  const html = ctx.sitePickHTML("live", "live:q1", ["Every loaf", "Only today's bake"], "");
  assert.match(html, /st-pick-opt on" role="radio" aria-checked="true" data-ask-pick="Only today's bake"/);
  assert.match(html, /data-ask-pick="Every loaf"[^>]*/);
  assert.doesNotMatch(html, /data-ask-go="1" data-pick-key="live:q1" disabled/, "Continue stayed disabled after a pick");
  const other = ctx.sitePickHTML("live", "live:q2", ["Every loaf", "Only today's bake"], "");
  assert.doesNotMatch(other, /aria-checked="true"/, "another question was drawn with this one's pick");
  assert.match(other, /disabled>Continue/);
});

test("CONTINUE — takes the pick once and only for its own question; nothing picked sends nothing", () => {
  const { ctx } = card();
  assert.equal(ctx.sitePickTake("live:q1"), null, "Continue sent with nothing picked");
  ctx.sitePick("live:q1", "Every loaf");
  assert.equal(ctx.sitePickTake("live:q2"), null, "a pick was sent as another question's answer");
  assert.equal(ctx.sitePickTake("live:q1"), "Every loaf");
  assert.equal(ctx.sitePickTake("live:q1"), null, "the pick was sent twice");
  for (const bad of ["", null, undefined, 3]) {
    ctx.sitePick("live:q1", bad);
    assert.equal(ctx.sitePickTake("live:q1"), null, "an empty pick was kept: " + String(bad));
  }
});

test("SOMETHING ELSE — clears the pick and puts the cursor in the composer for a typed answer", () => {
  const { ctx, focused } = card();
  ctx.sitePick("live:q1", "Every loaf");
  ctx.sitePickOwn();
  assert.equal(ctx.sitePickTake("live:q1"), null, "a pick survived Something else");
  assert.equal(focused(), 1, "the composer was not handed the answer");
});

test("KEYS — the question's key comes from the site's state, the same one the card is drawn with", () => {
  const { ctx } = card();
  assert.equal(ctx.sitePickKeyLive({ ask: { id: "q9" } }), "live:q9");
  assert.equal(ctx.sitePickKeyLive({}), "");
  assert.equal(ctx.sitePickKeyFirst({ msgs: [{ r: "u" }, { r: "a", q: "x" }, { r: "a", t: "hi" }, { r: "a", q: "y" }] }), "first:3");
  assert.equal(ctx.sitePickKeyFirst({ msgs: [{ r: "u" }] }), "");
});

// "SOMETHING ELSE…" SHOWS IT WAS CHOSEN (2026-10-26, live test 11): the row was
// clicked and nothing changed, so the answer typed below looked unconnected.
test("SOMETHING ELSE — chosen, it is drawn checked with a line saying where the answer goes; a real pick clears it", () => {
  const { ctx, focused } = card();
  const before = ctx.sitePickHTML("live", "live:q1", ["Every loaf"], "");
  assert.match(before, /st-pick-own" role="radio" aria-checked="false" data-ask-own="1" data-pick-key="live:q1"/);
  assert.match(before, /<p class="st-pick-hint" data-pick-hint="live:q1" hidden>Type your answer in the box below and press send\.<\/p>/);
  ctx.sitePickOwn("live:q1");
  assert.equal(focused(), 1, "the box below was not focused");
  const on = ctx.sitePickHTML("live", "live:q1", ["Every loaf"], "");
  assert.match(on, /st-pick-own on" role="radio" aria-checked="true"/);
  assert.match(on, /data-pick-hint="live:q1">Type your answer/, "the hint is still hidden");
  assert.match(on, /disabled>Continue/, "Continue is not for a typed answer");
  assert.doesNotMatch(ctx.sitePickHTML("live", "live:q2", ["x"], ""), /aria-checked="true"/, "another question shows this one's choice");
  ctx.sitePick("live:q1", "Every loaf");
  const picked = ctx.sitePickHTML("live", "live:q1", ["Every loaf"], "");
  assert.match(picked, /st-pick-own" role="radio" aria-checked="false"/, "a real pick left Something else checked");
  assert.match(picked, /data-pick-hint="live:q1" hidden>/);
});
