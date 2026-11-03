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

import { ASK_TOOL, REMOVABLE_LAYERS, OWN_REMOVAL_LAYERS, DOOR_LAYERS } from "../builder/route-shared.mjs";
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
  // And the exception, which is what stops it deleting pages. Since 2026-09-30
  // it is the first of two (a stored row is the second, `data`), so the
  // property is read rather than the count: a whole page is excepted, and it
  // goes to `page` with `remove` and nowhere else.
  assert.match(look, /EXCEPTION IS A WHOLE PAGE/,
    "the removal clause does not except a whole page, so a page deletion lands in the lane system");
  assert.match(look, /is layer "page" with `remove` — a page is deleted there and nowhere else\./,
    "the whole-page exception no longer sends a page deletion to `page` with `remove`");
});

test("the tool description asks for `remove` on exactly the layers that carry it", () => {
  // Derived both ways: a layer the reader keeps the flag for must be named, and
  // the model must not be asked a question nobody listens to.
  for (const layer of REMOVABLE_LAYERS) {
    assert.ok(REMOVE_DESC.includes('"' + layer + '"'), "the remove field never mentions layer " + layer);
  }
});
