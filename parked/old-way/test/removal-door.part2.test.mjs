// PARKED (2026-11-03, park-old-way): the old-way half of test/removal-door.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// EVERY LANE THAT CAN BE TAKEN OFF HAS A WAY IN (2026-09-08, owner: "IT SHOULD
// BE ABLE TO DELETE THE 15").
//
// ── THE DEFECT ──────────────────────────────────────────────────────────────
//
// `REMOVABLE_LANES` is fifteen. The removal verb — `pick_lanes` answering
// `removes`, the refusal sentences, the dispatch steps, and `mergeLook`'s
// `clear` — lives entirely inside ONE condition in `worker.js`:
//
//     const eLooking = eLayer === "look"        ← the whole door
//
// So a removal reached it only when the intent router answered `look`. Seven of
// the fifteen are look-layer subjects and were safe; the other eight are lanes
// that DISPATCH, and the router names their destination directly — "take the
// photo off" answers `picture`, "drop the button" answers `nav`, "take the 3D
// scene off" answers `page`. The door never opened, the target rung did its
// best with the customer's words, and the STORED field stayed set, so the
// site's design record disagreed with its pages and the next revise could bring
// the thing back.
//
// ── WHY THIS GUARD IS DERIVED AND NOT A LIST ────────────────────────────────
//
// The recorded trap this change exists because of is "a hop nobody listed is a
// hop nobody guards": the Code tab's guard asserted the two hops its author had
// in mind and missed the third. A list of the eight would be that mistake
// again, so the census below walks `REMOVABLE_LANES` itself and requires each
// one to have a route in. A sixteenth removable lane cannot arrive unreachable.
//
// ── AND `page` IS THE ONE THAT MUST NOT BE WIDENED ─────────────────────────
//
// Four removable lanes dispatch to `page`, which makes it look like the layer
// that most needs the flag. `remove` on `page` means DELETE THE WHOLE PAGE —
// measured three times, and the field spends a paragraph making that
// unmissable. Widen it and "take the 3D scene off the home page" deletes the
// home page. Those four arrive by the LAYER answer instead, which is why the
// clause is asserted here and the flag's page paragraph is pinned verbatim.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { ASK_TOOL, REMOVABLE_LAYERS, OWN_REMOVAL_LAYERS, DOOR_LAYERS } from "../../../builder/route-shared.mjs";
import { REMOVABLE_LANES, OWN_LANES, laneLayer } from "../../../builder/site-lanes.mjs";

const WORKER = fs.readFileSync(path.join(import.meta.dirname, "../../../worker.js"), "utf8");
const LAYER_DESC = ASK_TOOL.input_schema.properties.layer.description;
const REMOVE_DESC = ASK_TOOL.input_schema.properties.remove.description;

/**
 * Whole-line comments blanked, length preserved.
 *
 * This file counts an identifier in a block, and the block's own comments
 * EXPLAIN that identifier — the recorded "prose contains the thing it forbids",
 * met on this guard's first run, where the count read 4 against a code that
 * uses it twice. Blank before any scan that counts.
 */
function blank(src) {
  return src.split("\n").map((l) => (/^\s*\/\//.test(l) ? " ".repeat(l.length) : l)).join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// THE DOOR ITSELF, DRIVEN. Read, the condition looks obviously right; this
// session's whole defect was a condition a read had certified, so both `const`
// lines are evaluated out of the file with their inputs handed in.

function door(eLayer, eRemove) {
  const at = WORKER.indexOf("const eLooking = ");
  assert.ok(at > 0, "the lane door is gone from worker.js");
  const end = WORKER.indexOf("\n", WORKER.indexOf("const eRemovalDoor = ", at));
  assert.ok(end > at, "`eRemovalDoor` no longer sits with the door it describes");
  const src = WORKER.slice(at, end);
  // eslint-disable-next-line no-new-func
  const f = new Function("eLayer", "eRemove", "DOOR_LAYERS",
    src + "\nreturn { eLooking, eRemovalDoor };");
  return f(eLayer, eRemove, DOOR_LAYERS);
}

test("the door opens for look, and for a removal on any layer that is not its own", () => {
  assert.deepEqual(door("look", false), { eLooking: true, eRemovalDoor: false },
    "an ordinary look edit no longer opens the door");
  assert.deepEqual(door("look", true), { eLooking: true, eRemovalDoor: false },
    "a removal already on `look` must not read as a door this route opened");
  for (const layer of DOOR_LAYERS) {
    assert.equal(door(layer, true).eLooking, true, "a removal on " + layer + " does not open the door");
    assert.equal(door(layer, true).eRemovalDoor, true, layer + " is not marked as a door this route opened");
    assert.equal(door(layer, false).eLooking, false, "an ordinary " + layer + " edit was pulled into the door");
  }
});

test("the two layers that answer a removal themselves are never re-routed", () => {
  // A page deletion and a mark removal are both cheap, both measured, and both
  // reach their rung directly. Re-routing either would buy a picker call to
  // arrive where it already was — and for `page` it would be worse than that,
  // which is the next case.
  assert.deepEqual(OWN_REMOVAL_LAYERS, ["page", "logo"]);
  for (const layer of OWN_REMOVAL_LAYERS) {
    assert.equal(door(layer, true).eLooking, false, layer + " answers the flag itself and must not be re-routed");
    assert.equal(door(layer, false).eLooking, false, layer + " opened the door with no removal at all");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// THE FALL-THROUGH. A door this route opened must never climb to the revise.

test("a removal-opened door falls back to the router's own layer, never to the revise", () => {
  const at = WORKER.indexOf("const eLooking = ");
  const block = blank(WORKER.slice(at, WORKER.indexOf("const runLayer = async (", at)));
  assert.ok(block.length > 2000, "the look block could not be windowed");
  // The picker's own empty answer.
  // RE-ANCHORED 2026-09-23: on a door the ROUTER opened the empty picker is
  // now EXPLAINED rather than escalated (`picker/no-lane`), and on a door this
  // route opened it still falls through — the property this case is about.
  assert.match(block, /if \(!picked\.fields\.length && !eRemovalDoor\) return explain\("picker\/no-lane"\)/,
    "a picker with nothing to say still climbs on a door this route opened");
  // RE-ANCHORED 2026-09-28 (run 47, and the owner's two holds the same day):
  // the router's own step is no longer put back only when the step list comes
  // out EMPTY — that is what let a picker naming `behavior` displace the menu
  // rung. It is put among the dispatched steps whatever the picker named, where
  // its own lane would run (`doorDispatch`), exactly ONCE — the picker's work
  // never carries that lane — and it is still the router's own layer and page
  // with the router's verbs on it (a verb rides on the step it was decided for;
  // `test/edit-page-verb.test.mjs`), naming its lane only when the picker did.
  const loopAt = block.indexOf("const doorOwn = eRemovalDoor ? doorLane(eLayer) : null;");
  assert.ok(loopAt >= 0, "the door no longer asks which lane is the router's own");
  // RE-ANCHORED 2026-09-29: the loop now runs each change on its own scope
  // and withholds a scope that fails its check, so it grew — 611 characters
  // before scopes, 1,436 with them, 1,793 with the withholding (comments
  // blanked to spaces, length kept). The ceiling only has to catch a window
  // whose end landmark is gone, which runs to the end of the block — 12,283
  // measured — so 2,500 still catches it, and the landmark is asserted first.
  // RE-ANCHORED 2026-10-11 (the generality round): each scoped non-page step
  // now records the pages its own ops name (`on`), 2,521 measured; 3,500
  // still catches a lost end landmark (12,000+).
  const loopEnd = block.indexOf("steps.push(...mergePageSteps(dispatched));", loopAt);
  assert.ok(loopEnd > loopAt, "the dispatch loop's end landmark is gone");
  const loop = block.slice(loopAt, loopEnd);
  assert.ok(loop.length > 100 && loop.length < 3500, "the dispatch loop could not be windowed");
  assert.match(loop, /for \(const f of doorDispatch\(pickedFields, doorOwn\)\) \{/,
    "the lanes that become steps are not the picker's with the router's own among them");
  assert.match(loop, /if \(f === doorOwn\) \{\s*dispatched\.push\(\{ layer: eLayer, page: ePage, fields: \(picked\.routed \|\| \[\]\)\.includes\(f\) \? \[f\] : \[\], remove: eRemove, rename: eRename \}\);/,
    "the router's own step is not the one put in where its lane would run");
  // And the bottom of the block no longer has a door branch at all: a door the
  // router opened reaches it with its own step already in the plan, so an
  // empty list there is the look door's, and it is explained.
  // RE-ANCHORED 2026-09-29: a message whose every scoped change was withheld
  // is not one nobody could place, so the branch reads `!withheld.length` too.
  const tailAt = block.indexOf("if (!steps.length && !withheld.length) {");
  assert.ok(tailAt >= 0, "the no-steps branch is gone");
  const tail = block.slice(tailAt);
  assert.ok(tail.length > 100, "the no-steps branch is gone");
  assert.doesNotMatch(tail.slice(0, 400), /eRemovalDoor/, "the empty-plan branch still special-cases the door");
  // THE CENSUS IS BY LANDMARK: every read must be one of the seven named here —
  // the declaration, the routed change handed to the picker, the record of its
  // two lists, the empty-answer climb, the dispatch, (2026-10-02, the audit's
  // W15) the addition wall, where the router's own step is always other work so
  // the door never hands the whole message on, and (2026-10-03, the mixed-work
  // fixes) the empty answer whose every part the picker named as another
  // step's, which a door the router opened falls through exactly as the climb
  // does — and each must be there. A read nobody listed still fails. Comments
  // are blanked above, or this counts the paragraphs that explain it.
  const named = [
    "const eRemovalDoor = eLooking && eLayer !== \"look\";",
    "routed: eRemovalDoor ? { layer: eLayer, remove: eRemove, page: ePage } : null,",
    "if (eRemovalDoor) editTrace.mark(\"door:answer\", \"ok\", { layer: eLayer, routed: picked.routed || [], additional: picked.fields });",
    "if (!picked.fields.length && !eRemovalDoor) return explain(\"picker/no-lane\")",
    "if (!picked.fields.length && !eRemovalDoor && Array.isArray(picked.elsewhere) && picked.elsewhere.length) {",
    "if (!others.length && !eRemovalDoor) {",
    "const doorOwn = eRemovalDoor ? doorLane(eLayer) : null;",
  ];
  const spans = named.map((n) => {
    const i = block.indexOf(n);
    assert.ok(i >= 0, "a named read of `eRemovalDoor` is gone: " + JSON.stringify(n));
    assert.equal(block.indexOf(n, i + 1), -1, "a named read occurs twice: " + JSON.stringify(n));
    return [i, i + n.length];
  });
  const reads = [...block.matchAll(/eRemovalDoor/g)].map((m) => m.index);
  assert.equal(reads.length, named.length, "`eRemovalDoor` is read somewhere other than the seven places named here");
  for (const at of reads) {
    assert.ok(spans.some(([a, b]) => at >= a && at < b),
      "`eRemovalDoor` is read at offset " + at + ", which is none of the seven named reads");
  }
  // THE ROUTED CHANGE IS HANDED TO THE PICKER, inside its own call — so what it
  // answers is the door's question — and its two lists are recorded after its
  // failure is handled and before anything below reads them. No count of lanes
  // is read anywhere in between: the rule is the picker's explicit answer.
  const call = block.slice(block.indexOf("const picked = await pickLanes("), block.indexOf("editTrace.mark(\"pick_lanes\", picked.failed"));
  assert.ok(call.includes(named[1]), "the routed change is not handed to the picker's own call");
  assert.ok(block.indexOf("if (picked.failed) return modelDown(") < spans[2][0] && spans[2][0] < spans[3][0],
    "the door's record is not between the picker's answer and the first thing that reads it");
  assert.doesNotMatch(block.slice(spans[2][0], spans[3][0]), /\.length\s*(===|<|>|<=|>=)\s*\d/,
    "the door's answer is read by a count again");
});

test("the door reads the shared constant rather than spelling the pair again", () => {
  // Two lists of the same thing, on the one pair whose drift would either
  // delete a page through the lane system or strand a mark removal.
  assert.match(WORKER, /import \{[^}]*DOOR_LAYERS[^}]*\} from "\.\/builder\/site-ask\.mjs"/,
    "worker.js does not import the constant, so the list is written out twice");
  assert.deepEqual(DOOR_LAYERS, REMOVABLE_LAYERS.filter((l) => !OWN_REMOVAL_LAYERS.includes(l)),
    "the door list stopped being the difference of the two it is derived from");
  const at = WORKER.indexOf("const eLooking = ");
  const line = WORKER.slice(at, WORKER.indexOf("\n", at));
  assert.match(line, /DOOR_LAYERS\.includes\(eLayer\)/, "the door spells its own list of layers");
  assert.doesNotMatch(line, /"page"|'page'|"logo"|'logo'|"picture"|"nav"/,
    "the door names a layer literally instead of asking the list");
});
