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

import { ASK_TOOL, EDIT_LAYERS, REMOVABLE_LAYERS, OWN_REMOVAL_LAYERS, DOOR_LAYERS, readEdit } from "../builder/site-ask.mjs";
import { REMOVABLE_LANES, OWN_LANES, laneLayer } from "../builder/site-lanes.mjs";

const WORKER = fs.readFileSync(path.join(import.meta.dirname, "../worker.js"), "utf8");
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
// THE CENSUS. This is the case the owner asked for, stated as a property.

test("every removable lane has a route into the lane door", () => {
  assert.ok(REMOVABLE_LANES.length >= 15, "the removable set shrank — re-read why before touching this");
  const unreachable = [];
  for (const field of REMOVABLE_LANES) {
    const to = laneLayer(field);
    // An OWN lane is edited inside the door itself, so `look` — the layer the
    // router already answers for the site's design — is its way in.
    if (!to) {
      assert.ok(OWN_LANES.includes(field), field + " dispatches nowhere and is not an own lane either");
      continue;
    }
    // A lane that dispatches is reachable when EITHER the router's own removal
    // flag survives on its destination (the door opens from there), OR the
    // destination is one the removal clause sends to `look` instead.
    const byFlag = DOOR_LAYERS.includes(to);
    const byClause = to === "page";
    if (!byFlag && !byClause) unreachable.push(field + " → " + to);
  }
  assert.deepEqual(unreachable, [],
    "these removable lanes have no way into the lane door: " + unreachable.join(", "));
});

test("the flag survives on the door layers, and only a real boolean is one", () => {
  assert.ok(DOOR_LAYERS.length > 0, "no layer opens the door, so the widening did nothing");
  for (const layer of DOOR_LAYERS) {
    assert.ok(EDIT_LAYERS.includes(layer), layer + " is not an edit layer at all");
    assert.equal(readEdit({ layer, remove: true }, ["/"]).remove, true, layer + " lost the removal flag");
    assert.equal(readEdit({ layer }, ["/"]).remove, undefined, layer + " invented a removal nobody asked for");
    // `String(["a"])` is `"a"` and this verb takes things away, so nothing
    // merely truthy counts — the rule `readEdit` already keeps, re-asserted on
    // the layers that are new to it.
    for (const bad of ["true", 1, {}, [], "yes"]) {
      assert.equal(readEdit({ layer, remove: bad }, ["/"]).remove, undefined,
        layer + " accepted " + JSON.stringify(bad) + " as a removal");
    }
  }
});

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

test("a layer with no removal path still carries no flag", () => {
  // The original rule, and it still holds for the layers left out: a flag
  // nothing acts on reads at the route as a capability with no code behind it.
  // `data` is the one that matters — its own rung deletes rows, and routing a
  // row deletion into the lane picker would find no lane and climb.
  const left = EDIT_LAYERS.filter((l) => !REMOVABLE_LAYERS.includes(l));
  assert.ok(left.length >= 1, "every layer is removable now, so this case observes nothing");
  assert.ok(left.includes("data"), "`data` must keep answering its own row deletions");
  for (const layer of left) {
    assert.equal(readEdit({ layer, remove: true }, ["/"]).remove, undefined,
      layer + " carries a flag no lane reads");
    // `look` is in this set and opens the door by its OWN NAME, which is the
    // thing it has always done — so the claim here is about the FLAG, not about
    // the door. Asserting `look` shut was the guard over-reaching on its first
    // run, and it would have read the whole feature as broken.
    if (layer === "look") continue;
    assert.equal(door(layer, true).eLooking, false, layer + " opened the door on a flag it never receives");
  }
  assert.ok(left.includes("look"), "`look` left this set, so the exemption above now covers nothing");
});

// ─────────────────────────────────────────────────────────────────────────────
// THE FALL-THROUGH. A door this route opened must never climb to the revise.

test("a removal-opened door falls back to the router's own layer, never to the revise", () => {
  const at = WORKER.indexOf("const eLooking = ");
  const block = blank(WORKER.slice(at, WORKER.indexOf("const runLayer = async (", at)));
  assert.ok(block.length > 2000, "the look block could not be windowed");
  // The picker's own empty answer.
  assert.match(block, /if \(!picked\.fields\.length && !eRemovalDoor\) return escalate\("no-lane"\)/,
    "a picker with nothing to say still climbs on a door this route opened");
  // And the bottom of the block, where an empty step list would otherwise climb.
  const tail = block.slice(block.indexOf("if (!steps.length) {"));
  assert.ok(tail.length > 100, "the no-steps branch is gone");
  assert.match(tail, /if \(eRemovalDoor\) steps\.push\(\{ layer: eLayer, page: ePage, fields: \[\] \}\)/,
    "an empty step list does not put the router's own step back");
  // BOTH of them, or the fall-through is half wired — which is the shape this
  // whole change exists because of.
  // Its own declaration plus the two climbs, and nothing else. Comments are
  // blanked above, or this counts the paragraphs that explain it.
  assert.equal((block.match(/eRemovalDoor/g) || []).length, 3,
    "`eRemovalDoor` is read somewhere other than the two climbs it was written for");
});

// ─────────────────────────────────────────────────────────────────────────────
// WHAT THE ROUTER IS TOLD.

test("the layer description sends a removal to look, and excepts a whole page", () => {
  const look = LAYER_DESC.slice(LAYER_DESC.indexOf('"look"'), LAYER_DESC.indexOf('"rules"'));
  assert.ok(look.length > 400, "the look clause could not be sliced out");
  assert.match(look, /TAKING SOMETHING OFF THE SITE IS THIS LAYER/,
    "the router is never told a removal is worked out on `look`");
  // The four that can arrive no other way must be recognisable in it.
  assert.match(look, /3D/i, "the removal clause names no 3D scene, which reaches `look` no other way");
  assert.match(look, /QR/i, "the removal clause names no QR code");
  // And the exception, which is what stops it deleting pages.
  assert.match(look, /THE ONE EXCEPTION IS A WHOLE PAGE/,
    "the removal clause does not except a whole page, so a page deletion lands in the lane system");
});

test("a whole page is still deleted by the flag, and that paragraph is untouched", () => {
  // The property, not the spelling: `page` + `remove` deletes, and the field
  // still says so at the strength three measured runs bought.
  assert.match(REMOVE_DESC, /ONLY WHEN THEY PLAINLY MEAN DELETE THE WHOLE PAGE/,
    "the page paragraph was widened — 'take the 3D scene off' would now delete the page it sits on");
  assert.match(REMOVE_DESC, /WITHOUT THIS FIELD THE PAGE STAYS/,
    "the closing rule that made a page deletion land at all is gone");
  const on = readEdit({ layer: "page", page: "/gallery", remove: true }, ["/", "/gallery"]);
  assert.equal(on.layer, "page");
  assert.equal(on.remove, true, "a whole-page deletion no longer carries its flag");
});

test("the tool description asks for `remove` on exactly the layers that carry it", () => {
  // Derived both ways: a layer the reader keeps the flag for must be named, and
  // the model must not be asked a question nobody listens to.
  for (const layer of REMOVABLE_LAYERS) {
    assert.ok(REMOVE_DESC.includes('"' + layer + '"'), "the remove field never mentions layer " + layer);
  }
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
