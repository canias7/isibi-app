// TAKING SOMETHING OFF THE SITE — the removal verb's own guards.
//
// Owner, 2026-09-06: *"delete should be in the edit path , they can delete
// literally anything"*, then the scope: *"i mean things in the site , like a
// component etc etc etc , not database or or whatver , code in the site yes"*.
//
// What these hold is the SHAPE, never the wording: every `remove` sentence in
// the lane table is the owner's to rewrite, exactly as every `hint` and `edit`
// string there already is. So nothing below asserts a phrase — it asserts that
// a lane which can be removed says so, that a lane which cannot says WHY, and
// that the picker can express the difference.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LANE_FIELDS, REMOVABLE_LANES, NOT_REMOVABLE, VERB_LANES,
  laneRemoval, removalRefusal, readRemoves, pickTool,
} from "../builder/site-lanes.mjs";

const reply = (input) => ({ content: [{ type: "tool_use", input }] });

const SRC = readFileSync(new URL("../builder/site-lanes.mjs", import.meta.url), "utf8");

/**
 * The module with every whole-line comment blanked, LENGTH PRESERVED.
 *
 * This file's own prose names `remove:` a dozen times while explaining it, and
 * a scan that reads those as table entries answers nonsense — the recorded
 * "prose contains the thing it forbids" trap, which has fired inside the guard
 * written for it more than once.
 */
const BARE = SRC.split("\n").map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? " ".repeat(l.length) : l)).join("\n");

/** Which lanes really carry a `remove:` key in the table, read off the source. */
function lanesWithRemoveKey() {
  const start = BARE.indexOf("\nconst LANES = {");
  const end = BARE.indexOf("\nexport const LANE_FIELDS", start);
  assert.ok(start > 0 && end > start, "could not find the LANES table — re-anchor this guard");
  const table = BARE.slice(start, end);
  const out = [];
  for (const f of LANE_FIELDS) {
    const at = table.indexOf("\n  " + f + ": {");
    if (at < 0) continue;
    // To the next lane opener, never a fixed byte window: this repo puts its
    // reasoning in comments and any byte count is outrun by the next one.
    const rest = table.slice(at + 1);
    const nextAt = rest.search(/\n {2}[a-z]+: [{"]/);
    const block = nextAt < 0 ? rest : rest.slice(0, nextAt);
    if (/\n\s+remove:\s*"/.test(block)) out.push(f);
  }
  return out;
}

test("every lane is removable, refused by name, or governed by its own verb — a total, disjoint partition", () => {
  // THE OBSERVER IS ALIVE. A partition over an empty set passes every check
  // below it, which is this repository's own recorded trap; the floor is what
  // makes the rest of this case mean anything.
  assert.ok(LANE_FIELDS.length >= 20, "lane set collapsed: " + LANE_FIELDS.length);
  assert.ok(REMOVABLE_LANES.length >= 10, "nothing is removable: " + REMOVABLE_LANES.length);

  const refused = Object.keys(NOT_REMOVABLE);
  for (const f of LANE_FIELDS) {
    const inRemovable = REMOVABLE_LANES.includes(f);
    const inRefused = refused.includes(f);
    const isVerb = VERB_LANES.includes(f);
    assert.equal(
      [inRemovable, inRefused, isVerb].filter(Boolean).length, 1,
      "`" + f + "` must be exactly one of removable / refused-by-name / verb-governed");
  }
  for (const f of refused) assert.ok(LANE_FIELDS.includes(f), "NOT_REMOVABLE names a lane that does not exist: " + f);
});

test("the removable list is DERIVED from each lane's own rule, so it cannot drift from the prompt", () => {
  // The property, not the spelling: whatever the set is, membership and the
  // sentence are the same fact. A lane added to the list by hand without a rule
  // would be removable in the code and silent in the tool — the wiring trap,
  // which on this module has already cost `three` a day.
  // READ OFF THE SOURCE, not off the same object the export derives from —
  // otherwise this compares a value with itself and passes for a hand-written
  // list, which is the one thing it exists to catch.
  const declared = lanesWithRemoveKey();
  assert.ok(declared.length >= 10, "the source scan found almost nothing — re-anchor it: " + declared.length);
  assert.deepEqual(
    [...REMOVABLE_LANES].sort(), [...declared].sort(),
    "the removable set and the lanes that declare a rule have drifted");
  for (const f of LANE_FIELDS) {
    assert.equal(!!laneRemoval(f), declared.includes(f), "laneRemoval disagrees with the table for " + f);
  }
  for (const f of REMOVABLE_LANES) {
    assert.equal(typeof laneRemoval(f), "string");
    assert.ok(laneRemoval(f).trim().length > 20, "`" + f + "` has a rule too short to say anything");
  }
});

test("the backend is not removable from here, and it is REFUSED BY NAME rather than dropped", () => {
  // The owner's own scope line. A silent drop is how "delete the bookings
  // table" comes back "✅ Done" having done nothing.
  assert.ok(!REMOVABLE_LANES.includes("backend"));
  const why = removalRefusal("backend");
  assert.equal(typeof why, "string");
  assert.ok(why.length > 20, "the refusal must say something a customer can act on");
  assert.equal(laneRemoval("backend"), null);
});

test("`pages` keeps its own three-way verb and is never removable here — two lists of the same thing", () => {
  assert.ok(VERB_LANES.includes("pages"));
  assert.ok(!REMOVABLE_LANES.includes("pages"), "pages would be answerable through both doors");
  assert.equal(removalRefusal("pages"), null, "pages IS removable — through its verb — so it must not carry a refusal");
});

test("readRemoves: only what was picked, only what can go, and a non-string is refused rather than coerced", () => {
  // `String(["css"])` is `"css"` — shipped here as a real bug three times, and
  // it matters more on this path than anywhere else: the coerced value names a
  // lane and takes it off.
  assert.deepEqual(readRemoves(reply({ fields: ["qr"], removes: [["qr"]] }), ["qr"]).remove, []);
  assert.deepEqual(readRemoves(reply({ fields: ["qr"], removes: [null, 7, {}] }), ["qr"]).remove, []);

  // A removal of a lane nobody picked is not part of this message.
  assert.deepEqual(readRemoves(reply({ fields: ["css"], removes: ["three"] }), ["css"]).remove, []);

  // The ordinary change: silent.
  const plain = readRemoves(reply({ fields: ["css"] }), ["css"]);
  assert.deepEqual(plain, { remove: [], refused: [], pages: false });

  // The ordinary removal.
  assert.deepEqual(readRemoves(reply({ fields: ["qr"], removes: ["qr"] }), ["qr"]).remove, ["qr"]);
});

test("readRemoves answers in the CALLER's order, so the answer does not depend on how the model listed them", () => {
  const picked = ["three", "qr"];
  const a = readRemoves(reply({ fields: picked, removes: ["qr", "three"] }), picked).remove;
  const b = readRemoves(reply({ fields: picked, removes: ["three", "qr"] }), picked).remove;
  assert.deepEqual(a, picked);
  assert.deepEqual(b, picked);
});

test("readRemoves names a refusal once, and derives a `pages` removal into the verb it belongs to", () => {
  const r = readRemoves(reply({ fields: ["backend"], removes: ["backend", "backend"] }), ["backend"]);
  assert.equal(r.refused.length, 1, "a refusal repeated by the model is still one sentence");
  assert.equal(r.refused[0].field, "backend");
  assert.equal(r.refused[0].why, removalRefusal("backend"), "the sentence is the lane's own, never a second copy");
  assert.deepEqual(r.remove, []);

  // Both spellings of one act. Refusing the second-most-natural one is a wall
  // in front of a customer who was perfectly clear.
  const p = readRemoves(reply({ fields: ["pages"], removes: ["pages"] }), ["pages"]);
  assert.equal(p.pages, true);
  assert.deepEqual(p.remove, [], "pages must never travel as an ordinary removal");
});

test("THE PICKER CARRIES IT — the reader is worth nothing if the model is never asked", () => {
  const t = pickTool();
  const p = t.input_schema.properties;
  assert.ok(p.removes, "the picker has no `removes` property: every removal would read as a change");
  assert.equal(p.removes.type, "array");

  // THE ENUM IS DELIBERATELY WIDE. Narrowing it to the removable lanes reads
  // like tightening a wall and would take the honest refusal away: "delete the
  // bookings table" could no longer be understood, so it would come back as an
  // ordinary change and the reply would describe a removal that never happened.
  assert.deepEqual(
    p.removes.items.enum, LANE_FIELDS,
    "the enum must stay every lane — see the comment beside it before narrowing this");

  // And the description teaches exactly the removable ones, derived.
  for (const f of REMOVABLE_LANES) {
    assert.ok(p.removes.description.includes("\n  " + f + " — "), "the picker does not teach " + f);
  }
  for (const f of Object.keys(NOT_REMOVABLE)) {
    assert.ok(!p.removes.description.includes("\n  " + f + " — "), "the picker offers a lane it cannot remove: " + f);
  }
});

/* ------------------------------------------------------------------ the wiring */

test("pickLanes CARRIES the removal — the reader is dead if the picker's answer drops it", async () => {
  const { pickLanes } = await import("../builder/site-lanes.mjs");
  const send = async () => ({
    content: [{ type: "tool_use", input: { fields: ["qr", "three"], removes: ["three"] } }],
    usage: { input_tokens: 1, output_tokens: 1 },
  });
  const got = await pickLanes({ send }, { message: "take the 3D thing off" });
  assert.deepEqual(got.fields, ["qr", "three"]);
  assert.ok(got.removes, "pickLanes dropped `removes`: every removal would read as a change");
  assert.deepEqual(got.removes.remove, ["three"]);

  // And a picker that names nothing to remove still answers the shape, so no
  // caller has to guard for its absence.
  const plain = await pickLanes({ send: async () => ({ content: [{ type: "tool_use", input: { fields: ["css"] } }] }) },
    { message: "make it blue" });
  assert.deepEqual(plain.removes, { remove: [], refused: [], pages: false });
});

test("mergeLook clears exactly what it is told, keeps each field's shape, and refuses a coerced name", async () => {
  const { mergeLook } = await import("../builder/site-edit.mjs");
  const prior = { brand: "Fretwork", theme: "noir", three: { scene: "guitar" }, qr: [{ name: "qr" }], langs: ["es"] };

  const kept = mergeLook(prior, {}, {}, { instructed: true });
  assert.deepEqual(kept.three, prior.three, "the control: nothing clears without being named");

  const gone = mergeLook(prior, {}, {}, { instructed: true, clear: ["three", "qr"] });
  assert.equal(gone.three, null, "a scalar clears to null");
  assert.deepEqual(gone.qr, [], "a list clears to an empty list, keeping its shape");
  assert.equal(gone.brand, "Fretwork", "clearing one field must not touch another");
  assert.equal(gone.theme, "noir");

  // `String(["three"])` is `"three"` — a coerced name would strip a field.
  const junk = mergeLook(prior, {}, {}, { instructed: true, clear: [["three"], "nope", null, 42] });
  assert.deepEqual(junk.three, prior.three, "a non-string name was coerced into a field to strip");

  // NOT GATED ON `instructed`, deliberately — see the comment beside it. The
  // gate hedges against inferring a removal from a model's empty answer; this
  // is a fact the route was told, and gating it would make a removal quietly
  // do nothing on the path that shows the model no current state.
  const unin = mergeLook(prior, {}, {}, { instructed: false, clear: ["three"] });
  assert.equal(unin.three, null, "an explicit clear must not depend on `instructed`");
});

test("a removal naming a lane the picker did NOT choose is dropped, end to end through pickLanes", async () => {
  const { pickLanes } = await import("../builder/site-lanes.mjs");
  // THE HOLE THIS CLOSES: `readRemoves` is handed the PICKED lanes, not the
  // offered ones. Driving the reader directly with an explicit `picked` cannot
  // tell the two apart — inside `pickLanes` the offered set is every lane, so
  // handing it those would let a model take off something it never chose to
  // change. Found by a sweep: two mutants survived until this case existed.
  const send = async () => ({
    content: [{ type: "tool_use", input: { fields: ["css"], removes: ["three", "qr"] } }],
  });
  const got = await pickLanes({ send }, { message: "make it blue" });
  assert.deepEqual(got.fields, ["css"]);
  assert.deepEqual(got.removes.remove, [],
    "a lane named only under `removes` was taken off the site without being picked");

  // And the honest case still works through the same door.
  const both = await pickLanes(
    { send: async () => ({ content: [{ type: "tool_use", input: { fields: ["three"], removes: ["three"] } }] }) },
    { message: "take the 3d thing off" });
  assert.deepEqual(both.removes.remove, ["three"]);
});

test("a lane nobody picked cannot be REFUSED either — the refusal list has no second wall under it", () => {
  // `remove` is filtered by the picked set twice: once entering, once leaving.
  // `refused` is filtered once. So a check dropped at the top shows up here and
  // nowhere else, as a 422 telling a customer they cannot delete a database
  // they never mentioned. Found by the one mutant that survived the sweep.
  const r = readRemoves(reply({ fields: ["css"], removes: ["backend"] }), ["css"]);
  assert.deepEqual(r.refused, [], "a lane the picker never chose was refused, on a message that never asked");
  assert.deepEqual(r.remove, []);
});
