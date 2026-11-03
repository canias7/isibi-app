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

// ── THE SPINE SENDS AND THEN STORES THEM ──────────────────────────────────
test("the spine prefers the parts it was handed and stores them only after the source, on a real publish", () => {
  const spine = CODE.slice(at(CODE, "async function recompileAndPublish", "spine"), at(CODE, "async function siteOgImage", "spine end"));
  // RE-ANCHORED 2026-09-04: `parts` stopped being the LAST parameter when the
  // repair round's `repair = null` joined the signature. The property is that
  // the spine takes `parts`, defaulting to none — not where it sits.
  assert.match(spine.slice(0, spine.indexOf("\n")), /\bparts = null\b/, "the spine no longer takes parts");
  const prefer = spine.indexOf("Array.isArray(parts) ? parts : await loadSiteParts(env, slug)");
  assert.ok(prefer > 0, "the spine does not prefer the parts it was handed");
  // EACH ANSWER KEPT (2026-10-08, H5): the marker waits on all of them.
  const source = spine.indexOf("source: await saveSiteSource(env, slug, pages, fence)");
  // RE-ANCHORED 2026-10-24: a part the compile repair fixed is saved too (`partsToSave`).
  const save = spine.indexOf("if (Array.isArray(partsToSave)) saved.parts = await saveSiteParts(env, slug, partsToSave, fence)");
  assert.ok(source > 0 && save > source, "the parts are stored before the source, or not at all");
  // AFTER THE GATE, like every other write: a stolen lease must not store a
  // component list for a publish that never happened.
  assert.ok(save > spine.indexOf("edit_may_publish"), "the parts are stored before the publish gate");
});
