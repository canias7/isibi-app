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

import { ASK_TOOL, EDIT_LAYERS, REMOVABLE_LAYERS, OWN_REMOVAL_LAYERS, DOOR_LAYERS, readEdit } from "../builder/site-ask.mjs";
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
