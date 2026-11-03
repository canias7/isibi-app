// ADDING IS THE ADDON STEP.
//
// Owner, 2026-09-02: "add will always go in addon … but tsx does exist tho,
// is literally everything on the page, it could be changing a component, is
// changing tsx". The edit step changes what the site has; the addon step adds
// what it does not; the page's own code always exists, so a change to a
// component is an edit. Four hops carry that, and each is asserted here on the
// property rather than the spelling, comments blanked before any scan.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

/** Length-preserving comment blanking, string-aware. See wall-probe.test.mjs. */
function blankComments(src) {
  let out = ""; let i = 0; let inBlock = false; let quote = "";
  while (i < src.length) {
    const c = src[i]; const nx = src[i + 1];
    if (inBlock) { if (c === "*" && nx === "/") { out += "  "; i += 2; inBlock = false; continue; } out += c === "\n" ? "\n" : " "; i++; continue; }
    if (quote) { out += c; if (c === "\\") { out += nx === undefined ? "" : nx; i += 2; continue; } if (c === quote) quote = ""; i++; continue; }
    if (c === '"' || c === "'" || c === "`") { quote = c; out += c; i++; continue; }
    if (c === "/" && nx === "*") { out += "  "; i += 2; inBlock = true; continue; }
    if (c === "/" && nx === "/") { while (i < src.length && src[i] !== "\n") { out += " "; i++; } continue; }
    out += c; i++;
  }
  return out;
}
const W = blankComments(read("../worker.js"));
const at = (src, needle, what) => { const i = src.indexOf(needle); assert.ok(i >= 0, `${what}: landmark "${needle}" is gone`); return i; };
/** The fields the edit path may not create, read off the list itself. */
const fieldsOf = (src) => {
  const decl = src.slice(at(src, "const ADD_ONLY_FIELDS = [", "list"), src.indexOf("];", at(src, "const ADD_ONLY_FIELDS = [", "list")));
  return [...decl.matchAll(/"([a-z]+)"/g)].map((m) => m[1]);
};

// ── 2. THE CLIENT HOPS TO THE ADDON RUNG ────────────────────────────────────
test("the browser runs the addon route on that answer, with the same sentence", () => {
  const chat = blankComments(read("../public/chat.js"));
  const fn = chat.slice(at(chat, "function escalatedEdit(e, o) {", "escalatedEdit"), at(chat, "function watchEditJob", "next"));
  const addon = fn.indexOf("if (act === 'addon') {");
  const hop = fn.indexOf("if (act === 'hop') {");
  assert.ok(addon > 0 && hop > addon, "the addon answer is not handled before the hop");
  // THE ASK'S CONTEXT AND NONE OF THE EDIT'S VERBS (2026-10-02, the
  // whole-router audit's W1): the add-on is handed `EditPoll.handOver`'s shape,
  // never the edit's answer whole. What that shape carries is driven in
  // `handover-operations.test.mjs`; this holds the sentence and the fallback.
  // AND THE ESCALATE ITSELF RIDES AS `why` (2026-10-02, the audit's W24): its
  // reason, field and `deferred` reach the add-on as the hand-over.
  // AND THE ESCALATE'S PAGE, the addition's scope (the look step names it).
  // AND THE MESSAGE'S FILES (2026-10-02), which a question the add-on asks keeps for the answer.
  assert.match(fn.slice(addon, hop), /siteAddon\(o\.site, o\.instruction, o\.origin, o\.finish, o\.fallback, EditPoll\.handOver\(o\.d, \{ layer: 'addon', page: e\.page \}, why\), o\.imgs\)/, "the addon is not run with the customer's own sentence and fallback");
  assert.match(fn, /const why = \{ from: o\.d && o\.d\.layer, reply: e \};/, "the hand-over is not told which step it left and what that step answered");
  // The decision lives in the module a test can drive, not in chat.js — so it
  // is DRIVEN, not read (2026-10-02). It was pinned by its spelling, and the
  // spelling moved when an edit the add-on step itself handed over gained its
  // bound (`fromAddon` answers "stop", `edit-poll.test.mjs`); the property is
  // unchanged: a server-named addon layer is the addon hop, and a lost ask is
  // decided before it.
  const P = createRequire(import.meta.url)("../public/edit-poll.js");
  assert.equal(P.escalateAction({ escalate: true, layer: "addon" }, { layer: "text", hasAsk: true }), "addon", "the poll module does not answer addon for a server-named addon layer");
  assert.equal(P.escalateAction({ escalate: true, layer: "addon" }, { layer: "text", hasAsk: true, handedOff: true }), "addon", "a handed-off edit does not reach the addon hop");
  assert.equal(P.escalateAction({ escalate: true, layer: "addon" }, { layer: "text", hasAsk: false }), "lost", "a lost ask must be decided before the addon hop");
});
