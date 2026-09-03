// The edit path's hand-written components, and the QR it now places.
//
// Two lane-sweep findings (2026-09-01): the `tsx` lane's new component was
// written by the model and never sent to the container, and the `qr` lane's
// code was served and shown nowhere. Both are wiring: a value computed and not
// forwarded. The reads here are anchored on order and on the chain, not on
// spellings — the recorded rule for guards over worker.js.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mergeParts } from "../builder/page-gen.mjs";

const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");

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
const CODE = blankComments(W);
const at = (src, needle, what) => { const i = src.indexOf(needle); assert.ok(i >= 0, `${what}: landmark "${needle}" is gone`); return i; };

// ── mergeParts ────────────────────────────────────────────────────────────
test("mergeParts lays fresh components over stored ones by name, keeping order", () => {
  const had = [{ name: "a", source: "1" }, { name: "b", source: "2" }];
  assert.deepEqual(mergeParts(had, [{ name: "b", source: "3" }, { name: "c", source: "4" }]),
    [{ name: "a", source: "1" }, { name: "b", source: "3" }, { name: "c", source: "4" }]);
  assert.equal(mergeParts(had, []), had, "nothing new hands back the stored list itself, so a caller can skip the save");
  assert.deepEqual(mergeParts(null, [{ name: "x", source: "s" }]), [{ name: "x", source: "s" }]);
  assert.deepEqual(mergeParts(undefined, undefined), []);
  // A malformed entry on either side is dropped, never merged as a hole.
  assert.deepEqual(mergeParts([{ name: "a" }, null, { name: "b", source: "2" }], [{ source: "no name" }, { name: "c", source: "3" }]),
    [{ name: "b", source: "2" }, { name: "c", source: "3" }]);
});

// ── THE PAGE RUNG CARRIES WHAT THE MODEL WROTE ────────────────────────────
test("the page rung merges the edit's parts over the stored ones and hands them to the publish", () => {
  const rung = CODE.slice(at(CODE, 'if (eLayer === "page") {', "page rung"), at(CODE, "for (const step of steps) {", "page rung end"));
  // The stored list is read ONCE (`pStored`), for the no-change decision and
  // the merge alike — the spelling moved from an inline load on 2026-09-02
  // when the decision learned to read parts.
  const loaded = rung.indexOf("const pStored = (pValid.parts && pValid.parts.length) ? await loadSiteParts(env, ownerSlug) : null;");
  const merged = rung.indexOf("mergeParts(pStored, pValid.parts)");
  assert.ok(loaded > 0 && merged > loaded, "the page rung does not merge the model's parts over the stored ones");
  const handed = rung.indexOf("parts: pParts || undefined");
  assert.ok(handed > merged, "the merged parts are not handed to the publish step");
  // GATED ON THERE BEING ANY: an edit that wrote none must not re-store the
  // stored list, and must not send `[]`, which the spine would read as "no
  // parts" and strip the site's existing components.
  const gate = rung.slice(rung.lastIndexOf("const pParts", merged), merged);
  assert.match(gate, /pValid\.parts\.length/, "the merge is not gated on the edit having written any parts");
});

test("a changed component is a change, even when the page came back byte-identical", () => {
  // Run 12's tsx lane (2026-09-02): the model rewrote the chord-diagram PART
  // and handed the page back unchanged, and the rung escalated no-change —
  // the edit was sitting in `parts` the whole time.
  const rung = CODE.slice(at(CODE, 'if (eLayer === "page") {', "page rung"), at(CODE, "for (const step of steps) {", "page rung end"));
  const moved = rung.indexOf("const partMoved = !!pStored && pValid.parts.some(");
  const decide = rung.indexOf('return escalate(wrote ? "no-change" : "no-page-back"');
  assert.ok(moved > 0 && decide > moved, "the no-change decision is made before the parts are compared");
  const cond = rung.slice(rung.lastIndexOf("if (", decide), decide);
  assert.match(cond, /wrote\.source === target\.source && !partMoved/, "an unchanged page with a changed part still reads as no-change");
  assert.match(cond, /!wrote \|\|/, "a page that did not come back at all must still be no-page-back");
  // The comparison is by name against the STORED source: a new part, or one
  // whose source differs, is a move; an identical re-send is not.
  const cmp = rung.slice(moved, rung.indexOf("});", moved));
  assert.match(cmp, /return !s \|\| s\.source !== pt\.source;/, "the part comparison is not by stored source");
});

test("the page rung tells the model what the site already has: its components, marks and scene", () => {
  const rung = CODE.slice(at(CODE, 'if (eLayer === "page") {', "page rung"), at(CODE, "for (const step of steps) {", "page rung end"));
  const call = rung.slice(rung.indexOf("briefWithLayout({"), rung.indexOf("}), eSpec"));
  for (const f of ["tsx", "gif", "qr", "three"]) assert.match(call, new RegExp(`\\b${f}: eLook2\\.${f}\\b`), `the page rung's brief does not carry the stored ${f}`);
  assert.match(call, /images: 0/, "the stated zero for photographs is gone");
});

// ── THE SPINE SENDS AND THEN STORES THEM ──────────────────────────────────
test("the spine prefers the parts it was handed and stores them only after the source, on a real publish", () => {
  const spine = CODE.slice(at(CODE, "async function recompileAndPublish", "spine"), at(CODE, "async function siteRedirectFor", "spine end"));
  assert.match(spine, /parts = null \}\)/, "the spine no longer takes parts");
  const prefer = spine.indexOf("Array.isArray(parts) ? parts : await loadSiteParts(env, slug)");
  assert.ok(prefer > 0, "the spine does not prefer the parts it was handed");
  const source = spine.indexOf("await saveSiteSource(env, slug, pages)");
  const save = spine.indexOf("if (Array.isArray(parts)) await saveSiteParts(env, slug, parts)");
  assert.ok(source > 0 && save > source, "the parts are stored before the source, or not at all");
  // AFTER THE GATE, like every other write: a stolen lease must not store a
  // component list for a publish that never happened.
  assert.ok(save > spine.indexOf("edit_may_publish"), "the parts are stored before the publish gate");
});

test("a rung's parts survive a later rung's publish in the same message, and reach the one spine call", () => {
  // Two asks run two rungs and ONE publish; `publishStep` collects and the
  // spine runs below the loop. `renamed` already accumulates across rungs -
  // the parts must too, or "add a component and change the button" hands the
  // spine the nav rung's args and the build's stored parts.
  const ps = CODE.slice(at(CODE, "const publishStep = async (e, args) => {", "publishStep"), at(CODE, "return { ok: true, deferred: true };", "publishStep end"));
  const carry = ps.indexOf("pendingPublish.parts");
  const set = ps.indexOf("pendingPublish = {");
  assert.ok(carry > 0, "publishStep does not carry an earlier rung's parts forward");
  assert.ok(set > carry, "the carried parts are read after the pending publish is replaced");
  assert.match(ps.slice(set), /\bparts\b/, "the carried parts are not put on the pending publish");
  // A later list wins: the args' own parts are preferred over the carried.
  assert.match(ps.slice(carry - 80, carry), /args\.parts\) \? args\.parts :/, "an earlier rung's parts override the later rung's");
  // AND THE ONE PUBLISH BELOW THE LOOP SPREADS IT, so the spine receives them:
  // the first spine call after the final-publish landmark spreads `pendingPublish`.
  const fin = at(CODE, "let finalPub = null;", "final publish");
  const call = CODE.indexOf("publishSpine(", fin);
  assert.ok(call > fin, "no spine call below the loop");
  assert.ok(CODE.startsWith("publishSpine(env, { ...pendingPublish", call), "the final publish does not spread the pending publish, so parts never reach the spine");
});

// ── THE QR IS PLACED ──────────────────────────────────────────────────────
test("the look branch adds a page step to place the QR codes no page shows, named, with its own ask", () => {
  // RE-ANCHORED 2026-09-03, when one code became a list: the step used to be
  // gated on the page lacking `SITE_QR` and carried one fixed ask
  // (`QR_PLACE_ASK`); now `qrUnplaced` names the codes no page shows and
  // `qrPlaceAsk(names)` asks for exactly those. The property is the same —
  // a stored code no page shows gets a page step of its own, and the ask
  // names the binding rather than inviting a drawing.
  const look = CODE.slice(at(CODE, "const acting = pickedFields.filter", "look dispatch"), at(CODE, 'if (pickedFields.includes("pages"))', "pages verb"));
  const step = look.indexOf('steps.push({ layer: "page", page: fallbackPage, fields: ["qr"], instruction: qrPlaceAsk(unplaced) })');
  assert.ok(step > 0, "no QR placement step, or it no longer asks for the unplaced codes by name");
  const gate = look.slice(look.lastIndexOf('if (pickedFields.includes("qr")', step), step);
  assert.ok(gate.length > 0 && gate.length < 600, "the step is not gated on the qr lane having been picked");
  assert.match(gate, /const unplaced = qrUnplaced\(qrList\(wallLook && wallLook\.qr\), eSrc\)/,
    "the unplaced codes are not derived from the stored list against every page");
  assert.match(gate, /if \(unplaced\.length\)/, "the step must fire only when some code is on no page");
  // The ask names the binding exactly, as marksDirective does, names the
  // component that takes children, and never asks for a code to be drawn.
  const fn = at(CODE, "function qrPlaceAsk(names) {", "ask");
  const ask = CODE.slice(fn, CODE.indexOf("\n}\n", fn));
  assert.match(ask, /SITE_QRS\./); assert.match(ask, /@\/site-brand/); assert.match(ask, /@\/components\/ui\/figure/);
  assert.match(ask, /120px/, "nothing tells the rung a code printed too small does not scan");
  assert.ok(!/draw|generate a qr|make a qr/i.test(ask), "the ask must not invite the model to draw its own code");
  assert.match(ask, /Change nothing else on the page/, "the ask does not bound the rung to the placement");
});

test("a step's own ask replaces the customer's sentence for that step only", () => {
  const loop = CODE.slice(at(CODE, "for (const step of steps) {", "steps loop"), at(CODE, "let finalPub = null;", "publish") );
  const set = loop.indexOf("eInstruction = step.instruction || eMessage;");
  const run = loop.indexOf("await runLayer(step.layer, step.page, step.fields)");
  const restore = loop.indexOf("eInstruction = eMessage;");
  assert.ok(set > 0 && run > set && restore > run, "the step's ask must be set before the rung runs and restored after");
  assert.match(CODE, /let eInstruction = String\(\(eb && eb\.instruction\)/, "eInstruction must be assignable");
  assert.match(CODE, /const eMessage = eInstruction;/, "the customer's sentence is not kept");
});
