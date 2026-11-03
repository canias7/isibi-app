// PARKED (2026-11-03, park-old-way): the old-way half of test/build-models.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// The Builder picker, and the chain that makes it do anything.
//
// This control shipped, sat in the composer with a tooltip promising a choice,
// and was read ZERO times: `body.picker` appeared nowhere in worker.js and both
// build calls hardcoded `claude-sonnet-5`. That is the failure this repo keeps
// recording — a feature dead at one layer while every other layer is fine — and
// it has been dead at five layers at once before now.
//
// So the tests here run in two halves. The first is ordinary unit testing of the
// allow-list. The second is a REACHABILITY CHAIN, derived from the source at
// both ends, because any one broken link puts the control straight back to being
// decoration and nothing else in the suite would notice.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { BUILD_MODELS, DEFAULT_PICKER, modelsFor } from "../../../builder/build-models.mjs";
import { MODEL_RATES, buildFloor, MIN_CREDITS, SCHEMA_PROFILE, SEED_PROFILE, pageCredits } from "../../../builder/publish-pages.mjs";
import { pagesRequest, usageOf } from "../../../builder/page-gen.mjs";
import { buildPathFn } from "../../../test/fixtures/build-path.mjs";

// What `use_credits` grants an account on first touch — the Postgres RPC's
// number, restated because this file cannot reach the database. If it moves
// there and not here, the guard below silently starts checking the wrong
// budget, which is why it is named rather than inlined.
const FREE_GRANT = 20;

const ROOT = new URL("../../../", import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, ROOT), "utf8");
// Comments are BLANKED, never removed, so offsets stay valid against the real
// text — the mistake this codebase made three separate times in one session.
const code = (src) => src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));

const worker = read("worker.js");
const workerCode = code(worker);
const chat = read("public/chat.js");

const nextResearchFn = (from) => {
  const m = /\n(?:export )?(?:async )?function [A-Za-z]/.exec(workerCode.slice(from + 1));
  return m ? from + 1 + m.index : workerCode.length;
};

// ─────────────────────────────────────────────────────────────────────────────
// THE JOURNEY, NOT THE STEP. `buildFloor <= FREE_GRANT` models the build in
// isolation, and a real first build is not in isolation: the customer types a
// brief, that goes through `/api/site/route` first, and a routing call rounds up
// to the 1-credit floor however cheap the model is. So the balance the build
// actually meets is the grant MINUS that.
//
// It is the difference between passing and failing right now. Measured
// 2026-08-13 with the re-taken SCHEMA_PROFILE: the floor is exactly 20 against a
// grant of exactly 20 — green with zero headroom — while a real new customer
// arrives at the gate with 19 and is refused.
const ROUTING_CREDITS = 1;

// THE COLD-BUILD SHORTFALL PIN WAS DELETED 2026-08-22, BY ITS OWN INSTRUCTION.
//
// It recorded, as a fact rather than a requirement, that a cold first build did
// not fit inside the free grant — and said what to do when that stopped being
// true: "Delete this pin and tighten the guard above to include ROUTING_CREDITS."
// Flipping DEFAULT_PICKER to grok closed it (23 -> 17 against a grant of 20), so
// the guard above now counts routing and asserts it FITS, with a headroom floor
// so the margin cannot erode back to nothing quietly.
//
// Recorded rather than silently removed: "we decided against it" and "we forgot"
// look identical in a diff a year later.

test("NO SMALL CALL PINS ITS OWN MODEL — the edit path follows the picker", () => {
  // THE REGRESSION THIS EXISTS FOR (run 93, 2026-08-31). Every classifier and
  // cheap rung on the platform carried a hardcoded `claude-haiku-4-5`, so a
  // customer who had picked Grok still had Anthropic in their path. Anthropic
  // refused on billing and the whole cheap ladder went down — the router, the
  // lane picker, and all eight rungs — while builds carried on fine because
  // generation was already on the picked model. A `css` edit answered 503 in
  // 5.3 seconds having spent nothing, and the lane under test never ran.
  //
  // Nothing asserted that, and nothing would have: each module's constant read
  // perfectly sensibly on its own, and the coupling was only visible by looking
  // at all eight at once. That is what this does.
  // A CENSUS, NOT A LIST — re-anchored 2026-09-09, and the list is what moved.
  //
  // This named eight modules by hand, which is the recorded "two lists of the
  // same thing": the producer grows and the scanner does not. MEASURED when the
  // band split added a twelfth caller — ELEVEN builder modules call `modelsFor`
  // and this named eight, so `page-gen`, `site-add` and `page-bands` were never
  // scanned at all. None of the three pins an id today, so nothing was broken;
  // what was broken is that nothing was watching, and it fails in the
  // safe-looking direction because a module nobody scans produces no red run.
  //
  // The subject set is derived from the signal itself now: a module that asks
  // `modelsFor` for a model is a module that must not carry one. A caller added
  // next month is scanned by existing.
  //
  // `build-models` IS THE TABLE and is the one exemption — the three ids live
  // there by design, and it is named rather than pattern-matched so that
  // exempting a second module is a decision somebody makes on purpose.
  const MODULES = fs.readdirSync(new URL("../../../builder/", import.meta.url))
    .filter((f) => f.endsWith(".mjs"))
    .map((f) => f.slice(0, -4))
    .filter((n) => n !== "build-models" && /\bmodelsFor\b/.test(code(read("builder/" + n + ".mjs"))));
  // A MODEL ID AS A STRING LITERAL. Deliberately both families — pinning Grok
  // here would be the same mistake wearing the other provider's name, and the
  // point is that these follow the picker rather than that they avoid Anthropic.
  const PINNED = /["'](?:claude-[a-z0-9.-]+|grok-[0-9][a-z0-9.-]*)["']/g;

  const offenders = [];
  let scanned = 0;
  for (const name of MODULES) {
    const src = read("builder/" + name + ".mjs");
    // BLANK THE COMMENTS FIRST. Every one of these modules now carries a note
    // explaining that the model is no longer `claude-haiku-4-5` — so an
    // unblanked scan reports the fix as the defect it fixed, which is this
    // repo's most-recorded own-goal.
    const body = code(src);
    scanned++;
    for (const m of body.matchAll(PINNED)) {
      offenders.push(name + ": " + m[0] + " at line " + body.slice(0, m.index).split("\n").length);
    }
  }
  // THE OBSERVER IS ALIVE, and the floor is what a DERIVED set needs that a
  // hand-written one did not: a derivation that answers nothing scans nothing
  // and passes, which is this repo's "a negative assertion must prove its
  // observer is alive" pointed at the list itself. Eleven today; the floor is
  // the eight this case named before, so the census can only ever grow.
  assert.ok(MODULES.length >= 8, "the census found only " + MODULES.length + " callers — the derivation has broken");
  for (const was of ["site-ask", "site-lanes", "site-apply", "site-nav", "site-picture", "site-rules", "site-tweak", "site-seed"])
    assert.ok(MODULES.includes(was), was + " dropped out of the census — it was scanned by name before this was derived");
  assert.ok(MODULES.includes("page-bands"), "the band request is not scanned — it picks a model like every rung here");
  assert.equal(scanned, MODULES.length);
  for (const name of MODULES) {
    assert.ok(read("builder/" + name + ".mjs").length > 1000, name + " read as almost nothing — this scan proves nothing");
  }

  assert.deepEqual(offenders, [],
    "these modules pin a model instead of taking the picker's:\n  " + offenders.join("\n  ") +
    "\nEvery small call resolves through `modelsFor(picker).quick`, so one provider having a bad day " +
    "cannot take down a customer who chose the other. See BUILD_MODELS.");

  // AND THE SCAN CAN SEE ONE — without this, a regex that matched nothing and a
  // blanker that blanked everything both look like compliance.
  assert.equal([...code('const M = "claude-haiku-4-5";').matchAll(PINNED)].length, 1,
    "the scan cannot see a pinned Anthropic model");
  assert.equal([...code('const M = "grok-4.6";').matchAll(PINNED)].length, 1,
    "the scan cannot see a pinned xAI model");
  assert.equal([...code('// it was "claude-haiku-4-5" until run 93').matchAll(PINNED)].length, 0,
    "a model named in a comment is being read as a pin — every one of these modules has such a comment");
});
