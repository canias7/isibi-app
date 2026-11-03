// PARKED (2026-11-03, park-old-way): the old-way half of test/model-limits.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// What each model will accept, and the census that keeps the table honest.
//
// The table itself has no product consumer yet — that is the owner's call, know
// the number before spending it — so the whole value of this file is that it
// makes the table LOAD-BEARING on day one. Two properties do that:
//
//   1. a CENSUS derived from BUILD_MODELS in both directions, so a picker added
//      next month naming a fourth model fails by existing, and a model that
//      leaves the platform cannot leave a stale row behind;
//   2. the one assertion with teeth today — every ceiling this platform really
//      sends must fit inside the SMALLEST output limit any picker can reach.
//
// Without (1) the table is a note in a comment. Without (2) it is a fact nobody
// has ever compared against anything.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  BUILD_MODELS,
  DEFAULT_PICKER,
  MODEL_LIMITS,
  contextWindow,
  maxOutputTokens,
  modelsFor,
} from "../../../builder/build-models.mjs";
import { LIST_ANSWER_MAX_TOKENS, MAX_INPUT_CHARS, echoTokens } from "../../../builder/input-budget.mjs";
import { LANE_PICK_MAX_TOKENS } from "../../../builder/site-lanes.mjs";
import { ASK_MAX_TOKENS, RESOLVED_TOKENS } from "../builder/site-ask.mjs";
import { ROUTER_LAST_REPLY_CHARS } from "../../../builder/site-converse.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

// LINE COMMENTS FIRST, THEN BLOCK OPENERS AT THE START OF A LINE — the recorded
// order. Blanking blocks first turns any `//` containing `/*` into a false block
// that runs to the next real `*/`, which swallowed 71,729 characters of chat.js
// the last time it was done the naive way. Length-preserving, so every offset
// still means what it meant.
function blankComments(src) {
  let s = src.replace(/^([ \t]*)\/\/.*$/gm, (m, indent) => indent + " ".repeat(m.length - indent.length));
  s = s.replace(/^([ \t]*)\/\*[\s\S]*?\*\//gm, (m) => m.replace(/[^\n]/g, " "));
  return s;
}

// The files that could send a model request: the builder's modules, the Worker,
// and the root modules beside it. Derived from the tree rather than named, so a
// module added next month is scanned without anybody remembering to list it.
function shipSet() {
  const out = [];
  for (const f of fs.readdirSync(path.join(ROOT, "builder"))) {
    if (f.endsWith(".mjs")) out.push("builder/" + f);
  }
  for (const f of fs.readdirSync(ROOT)) {
    if (f.endsWith(".mjs")) out.push(f);
  }
  out.push("worker.js");
  return out.filter((p) => fs.existsSync(path.join(ROOT, p)));
}

// ── THE CENSUS ──────────────────────────────────────────────────────────────

// Every model id any picker can reach, derived from the real table. Never typed:
// a hand-written list here would be a second copy of BUILD_MODELS with nothing
// between the two, which is this repository's most repeated drift.
function modelsInUse() {
  const ids = new Set();
  for (const picker of Object.keys(BUILD_MODELS)) {
    for (const slot of Object.keys(BUILD_MODELS[picker])) {
      ids.add(BUILD_MODELS[picker][slot]);
    }
  }
  return ids;
}

// ── THE ONE WITH TEETH: WHAT WE SEND MUST FIT ───────────────────────────────

// Every `max_tokens:` this platform really sends, derived from the source rather
// than from a list. Two shapes resolve statically — a bare number, and a named
// constant this repository exports — and anything computed is NAMED rather than
// dropped, because a ceiling that silently leaves the scan is exactly how this
// check would go quiet.
function sentCeilings() {
  const numeric = [];
  const named = new Map();
  const dynamic = new Set();
  const consts = new Map();
  let scanned = 0;

  for (const rel of shipSet()) {
    const raw = fs.readFileSync(path.join(ROOT, rel), "utf8");
    const src = blankComments(raw);
    scanned += 1;

    // `export const` AND a bare module-private `const`. The first draft required
    // the export and missed `SITE_SCHEMA_MAX_TOKENS`, which worker.js declares
    // privately and sends on the design call — a whole class of ceiling the
    // check would have claimed to cover and did not.
    for (const m of src.matchAll(/^(?:export )?const ([A-Z][A-Z0-9_]*) *= *(\d+)\s*;/gm)) {
      consts.set(m[1], Number(m[2]));
    }
    for (const m of src.matchAll(/max_tokens: *([^,\n}]+)/g)) {
      const expr = m[1].trim();
      if (/^\d+$/.test(expr)) numeric.push({ file: rel, value: Number(expr) });
      else if (/^[A-Z][A-Z0-9_]*$/.test(expr)) named.set(expr, rel);
      else dynamic.add(expr);
    }
  }
  return { numeric, named, dynamic, consts, scanned };
}

test("a computed ceiling is named, so a new one cannot slip past the check unseen", () => {
  const { dynamic } = sentCeilings();

  // These three cannot be resolved by reading, and each is bounded somewhere
  // the check above already reaches — verified rather than assumed:
  //   laneMaxTokens(field)  Math.min'd with LANE_EDIT_MAX_TOKENS by its own
  //                         module, so it can only ever REDUCE a checked number.
  //   maxTokens             the container's own parameter, fed from the Worker
  //                         by `maxTokens: SITE_SCHEMA_MAX_TOKENS`, which the
  //                         resolvable half checks.
  //   r.max_tokens          a caller's request echoed back on the xAI boundary.
  // AND TWO MORE (2026-10-03, the size policy): the router's and the lane
  // picker's ceilings grow by the customer's words they may copy back
  // (`echoTokens`). Each is its checked constant plus a term bounded by the
  // longest message a route takes (`MAX_INPUT_CHARS`, refused past it), and
  // test/input-budget.test.mjs asserts both sums at that bound fit this same
  // floor.
  // Listed by name so a new computed ceiling fails here rather than quietly
  // reducing what the assertion above covers.
  // AND FIVE MORE (2026-10-03, the mixed-work fixes): with no count of changes
  // left on the picture, row, rules and menu steps, each step's ceiling grows
  // with what it is shown and is held to `LIST_ANSWER_MAX_TOKENS` by its own
  // `Math.min` (asserted below to fit the floor); the lane picker copies every
  // change's words and every part no lane makes, so its copy room is doubled —
  // still bounded by the longest message a route takes.
  const known = new Set([
    "laneMaxTokens(field)", "maxTokens", "r.max_tokens",
    // …AND THE CONVERSATION'S WRITTEN-OUT REQUEST (2026-10-14): `RESOLVED_TOKENS`
    // more, only on a call shown a conversation, asserted below at the longest
    // message to fit the floor.
    "(live ? ASK_MAX_TOKENS + echoTokens(text",
    "LANE_PICK_MAX_TOKENS + 2 * echoTokens(String(message || \"\"))",
    "pictureMaxTokens(slots)", "dataMaxTokens(tables)", "rulesMaxTokens(tables)", "navMaxTokens(digest)",
  ]);
  const floor = Math.min(...[...modelsInUse()].map((id) => maxOutputTokens(id)));
  assert.ok(LIST_ANSWER_MAX_TOKENS <= floor, "a step's list ceiling (" + LIST_ANSWER_MAX_TOKENS + ") is above the smallest output limit (" + floor + ")");
  assert.ok(LANE_PICK_MAX_TOKENS + 2 * echoTokens("x".repeat(MAX_INPUT_CHARS)) <= floor, "the picker's ceiling at the longest message is above the floor");
  // …PLUS TWICE THE LONGEST SHOWN TURN (2026-10-23, audit A36-3): the router is shown its last reply up to ROUTER_LAST_REPLY_CHARS.
  assert.ok(ASK_MAX_TOKENS + echoTokens("x".repeat(MAX_INPUT_CHARS), "x".repeat(MAX_INPUT_CHARS)) + RESOLVED_TOKENS + 2 * echoTokens("x".repeat(ROUTER_LAST_REPLY_CHARS)) <= floor, "the router's ceiling with a conversation, at the longest message, is above the floor");
  for (const expr of dynamic) {
    assert.ok(
      known.has(expr),
      "a computed max_tokens appeared that this check cannot resolve: " + expr +
        " — either resolve it here or state where it is bounded",
    );
  }
  // Alive: if the scan stopped finding the computed sites, this case would pass
  // over anything.
  assert.ok(dynamic.size >= 2, "found " + dynamic.size + " computed max_tokens sites; the reader has stopped matching");
});
