// PARKED (2026-11-03, park-old-way): the old-way half of test/site-delete.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
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
} from "../../../builder/site-lanes.mjs";

const reply = (input) => ({ content: [{ type: "tool_use", input }] });

const SRC = readFileSync(new URL("../../../builder/site-lanes.mjs", import.meta.url), "utf8");

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

test("cannotRemoveMsg says what did NOT happen, and joins each lane's own reason", () => {
  const src = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  const at = src.indexOf("function cannotRemoveMsg(");
  assert.ok(at > 0, "cannotRemoveMsg is gone — re-anchor this guard");
  const body = src.slice(at, src.indexOf("\nfunction ", at + 10));
  const cannotRemoveMsg = new Function("return " + body.slice(0, body.lastIndexOf("}") + 1))();

  const one = cannotRemoveMsg([{ field: "backend", why: removalRefusal("backend") }]);
  assert.ok(one.includes(removalRefusal("backend")), "the lane's own reason is not in the sentence");
  assert.match(one, /didn't change anything/i, "the sentence must say nothing happened");

  const two = cannotRemoveMsg([
    { field: "backend", why: removalRefusal("backend") },
    { field: "lang", why: removalRefusal("lang") },
  ]);
  assert.ok(two.includes(removalRefusal("lang")), "a second reason was dropped");
  assert.ok(two.includes("; and "), "two reasons must read as a list");

  // Never an empty claim: junk in still says nothing was changed.
  assert.match(cannotRemoveMsg([]), /Nothing was changed/i);
  assert.match(cannotRemoveMsg(null), /Nothing was changed/i);
});

test("THE ROUTE'S HOPS, IN ORDER — a removal is read above both walls and never reaches a model", () => {
  const src = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  const picker = src.indexOf("pickedFields = picked.fields;");
  const plan = src.indexOf("const acting = pickedFields.filter", picker);
  assert.ok(picker > 0 && plan > picker, "the picker's landmarks moved — re-anchor");
  const branch = src.slice(picker, plan);

  // Read above the addon wall, because that wall asks a question that inverts
  // for a removal: "the site does not have this" answered by offering to make it.
  const read = branch.indexOf("eRemoves = picked.removes");
  const wall = branch.indexOf("for (const f of ADD_ONLY_FIELDS)");
  assert.ok(read > 0, "the route never reads the removals");
  assert.ok(wall > read, "the removals are read AFTER the addon wall, which would offer to build what was asked to go");

  // The refusal returns before anything is planned, and costs nothing.
  const refuse = branch.indexOf("eRemoves.refused.length");
  assert.ok(refuse > read && refuse < wall, "the refusal is not between the read and the wall");
  assert.match(branch.slice(refuse, refuse + 500), /cost: 0/, "a refused removal must not be charged");

  // The wall lets a removal past rather than escalating it to the step that ADDS.
  assert.match(branch.slice(wall), /eRemoves\.remove\.includes\(f\)/,
    "the addon wall does not know about removals: 'take the scene off' would be answered by offering to build one");

  // And the lane loop skips the model call entirely.
  const loop = src.indexOf("for (const field of pickedFields) {", plan);
  assert.ok(loop > 0, "the lane loop moved");
  const runAt = src.indexOf("await runLane(", loop);
  const skip = src.indexOf("eRemoves.remove.includes(field)", loop);
  assert.ok(skip > 0 && skip < runAt, "a removal still reaches runLane — it would be charged for writing nothing");

  // The merge is told the names.
  //
  // RE-ANCHORED 2026-09-08, merging this onto the one-mark work, and the
  // spelling that moved is the OPTIONS OBJECT rather than the rule: that call
  // now carries a third option (`asked: true`, which says the customer named
  // every field on this path so a lane's answer may replace an uploaded mark),
  // so a pattern pinning the object's exact two-key shape reported "the merge
  // is not handed the removals" about a call that hands them over. The property
  // was never the object's arity — it is that THIS call is handed
  // `eRemoves.remove`. Matched inside the call now, with the call itself
  // asserted first so a deleted hop cannot pass as a satisfied absence.
  const merge = src.slice(plan).match(/mergeLook\(priorLook, designed, \{\}, \{([^}]*)\}\)/);
  assert.ok(merge, "the lane path's merge call is gone");
  assert.match(merge[1], /\bclear: eRemoves\.remove\b/,
    "the merge is not handed the removals, so a cleared field would merge back to its stored value");
});

test("the route folds a `pages` removal into the page verb, and never over one the picker answered", () => {
  const src = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  const picker = src.indexOf("pickedFields = picked.fields;");
  const plan = src.indexOf("const acting = pickedFields.filter", picker);
  const branch = src.slice(picker, plan);

  const fold = branch.indexOf("eRemoves.pages");
  assert.ok(fold > 0, "a `pages` removal is read nowhere: the ask would vanish between the two spellings");
  // The assignment the condition guards, found by NAME rather than by slicing
  // to a brace at a guessed indentation — which is what this did on its first
  // draft, and the block's closing brace sits fourteen spaces in.
  const set = branch.indexOf("picked.page = {", fold);
  assert.ok(set > fold, "the fold reads `pages` but never sets the verb");
  const stmt = branch.slice(fold, branch.indexOf(";", set) + 1);
  assert.match(stmt, /verb: "remove"/, "the fold does not set the removal verb");
  // FENCED. `add` and `move` are that lane's other two capabilities and neither
  // is a removal, so a verb the picker really answered must win.
  assert.match(branch.slice(fold, set), /!\(picked\.page && picked\.page\.verb\)/,
    "the fold would overwrite a verb the picker answered — 'move the gallery' could become 'delete the gallery'");
});

test("DRIVEN: the removal branches answer with a real HTTP status, not one buried in the body", () => {
  // `eAnswer` REPLACED TWO CALLS TO `editAnswer`, WHICH NEVER EXISTED HERE
  // (2026-09-12). Both sat in this work's own branches — a picker that refused a
  // lane, and "your site doesn't have a 3D scene to take off" — and `editAnswer`
  // is a `public/chat.js` function with a different signature and no return
  // value, so both would have thrown `ReferenceError`. Found by pointing the
  // free-identifier walker at worker.js for the first time; the removal verb has
  // not run live, which is the only reason no customer met it.
  //
  // THREE PROPERTIES, because a helper written to fix a crash is easy to get
  // half right: the refusal is a 422 and the nothing-to-do is a 200, `status`
  // comes OFF the body (a stray one in the JSON is a second copy of the HTTP
  // status that can disagree with it), and both call sites really use it.
  const src = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  const at = src.indexOf("const eAnswer = (");
  assert.ok(at > 0, "eAnswer is gone from the edit route");
  const eAnswer = new Function("return " + src.slice(at + "const eAnswer = ".length, src.indexOf(";\n", at)))();

  const refused = eAnswer({ ok: false, status: 422, error: "not-removable", msg: "no", cost: 0 });
  assert.equal(refused.status, 422, "a refused removal does not answer 422");
  const absent = eAnswer({ ok: true, status: 200, moved: [], cost: 0, msg: "nothing to take off" });
  assert.equal(absent.status, 200);
  // A body with no status of its own still answers 200 rather than undefined.
  assert.equal(eAnswer({ ok: true }).status, 200, "the default status is not 200");

  return Promise.all([refused.json(), absent.json()]).then(([a, b]) => {
    assert.ok(!("status" in a) && !("status" in b), "the HTTP status is copied into the body as well");
    assert.equal(a.error, "not-removable");
    assert.equal(b.msg, "nothing to take off");
    // BOTH REMOVAL CALL SITES — a helper with one caller means one branch is
    // still reaching for a name that is not there.
    //
    // ⚠ A FLOOR, NOT AN EXACT COUNT (corrected 2026-09-21). This asserted
    // `=== 2`, which was a census of the call sites that existed the day it
    // was written and NOT the property it describes. The `rules` rung's
    // backend fix added two honest callers — a 503 for an unreadable database
    // and one for an unreadable schema — and this went red reporting the
    // removal branches as broken by a change that never touched them. This
    // repo's recorded "a hand-typed constant in a check is a second copy of
    // something" trap, and its quietest form: the number was RIGHT when typed.
    //
    // THE PROPERTY IS THE TWO REMOVAL BRANCHES, so they are named by what
    // makes them those branches rather than by how many there happen to be.
    const calls = (src.match(/return eAnswer\(\{/g) || []).length;
    assert.ok(calls >= 2, "fewer than two branches answer through eAnswer: " + calls);
    for (const mark of ["not-removable", "moved: []"]) {
      assert.ok(src.includes(mark), "a removal branch's own marker is gone from worker.js: " + mark);
    }
    assert.ok(!/\beditAnswer\(/.test(src), "worker.js is calling the browser's editAnswer again");
  });
});
