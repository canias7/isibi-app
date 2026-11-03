// PARKED (2026-11-03, park-old-way): the old-way half of test/edit-lanes.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// TWO SEPARATE PATHS, AND THIS IS WHAT HOLDS THEM APART.
//
// Owner, 2026-08-29: "it should be 2 separated path tho, idk why you are mixing
// the build with the edit path" — and, on what the edit path is: "customer says
// edit this, and booom you go edit it".
//
// The `look` lane called `designSiteSchema` with `SITE_SCHEMA_TOOL` and
// `SITE_SCHEMA_SYSTEM`: the build's function, the build's tool, the build's
// system text. So a colour change on a live site ran the site DESIGNER — 84.8k
// of instructions for inventing a business from nothing — and the two framings
// then fought, which is why `EDIT_RULE` had to NAME the build's `css` wording
// and overrule it in prose.
//
// WHAT IS ASSERTED HERE IS THE SEPARATION, and it needs two opposite halves:
//   * the edit path borrows NOTHING from the build path's tool or wording, and
//   * the two paths still cover the same seventeen fields.
// The first alone lets a field quietly lose its lane; the second alone is
// satisfied by the coupling that was just removed.
//
// DRIVEN, NOT READ. `readSchemaTool` evaluates the real design tool out of
// worker.js with every dependency resolved, and `site-lanes.mjs` is imported and
// called — so these measure what ships rather than a source pattern.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { readSchemaTool } from "./integration/schema-tool.mjs";
import { PLAN_KEYS } from "../../../builder/site-plan.mjs";
import { EDIT_FIELDS } from "../../../builder/site-edit.mjs";
import { EDIT_LAYERS } from "../../../builder/route-shared.mjs";
import { modelsFor } from "../../../builder/build-models.mjs";
import { QUESTION_FIELD } from "../../../builder/clarify.mjs";
// The storage caps themselves, so the per-field token ceiling can be asserted
// to BE the refusals rather than a plausible second set of numbers.
import { MAX_WORDMARK, MAX_FAVICON } from "../../../builder/site-favicon.mjs";
import { MAX_CSS } from "../../../builder/site-freecss.mjs";
import {
  LANE_FIELDS, OWN_LANES, DISPATCHED_LANES, VERB_LANES, ESCALATE_LANES, UNBUILT_LANES,
  laneEscalate, laneVerbs, verbLayer, readPageVerb, PAGE_VERBS,
  laneLayer, laneUnbuilt, laneRule, composeRule, RULE_PARTS, editTool, pickTool, readLanes, readLaneAnswer, editRequest, pickRequest,
  laneMaxTokens, tokensForChars, LANE_EDIT_MAX_TOKENS, LANE_MIN_TOKENS, FIELD_STORE_CAP,
  readElsewhere, pickLanes,
} from "../../../builder/site-lanes.mjs";

const LANES_SRC = fs.readFileSync(new URL("../../../builder/site-lanes.mjs", import.meta.url), "utf8");

/** Comments quote the build's names and the wording they forbid — blank them, length-preserving. */
const bare = (src) => src.replace(/^\s*(?:\/\/|\*|\/\*)[^\n]*$/gm, (m) => " ".repeat(m.length));

// THE WEB PAIR IS THE ONLY EXCLUSION, and it is the owner's: `needsWeb` and
// `webQueries` decide whether writing a site's COPY needs a search, which is a
// property of a build and nothing a customer asks to change afterwards.
const WEB = ["needsWeb", "webQueries"];
// `logo` (audit A26-4, the owner's choice 2026-10-23) names an ATTACHMENT, not a
// part of the look: the build stores that file and sets the image `wordmark`
// from it, and a later change to the logo is the logo rung's, with the file
// attached. It has no lane on purpose, so it is excluded by name here.
const ATTACHMENT_ONLY = ["logo"];
// `devices` (2026-10-24, device-scope-build) is a FIRST BUILD's screen-size
// wishes, told to that build's writers and never stored on the look: a later
// per-size change is an edit with the router's own `devices`, so no lane.
const BUILD_ONLY = ["devices"];

// EVERY NAME THE WORKER USES FROM THIS MODULE IS ACTUALLY IMPORTED (2026-09-08,
// found by the merge's own sweep).
//
// A named import dropped from the list is NOT a link error: the identifier just
// becomes free, and a free identifier resolves when its line RUNS. So
// `worker.js` loads, every source guard finds its landmarks, the suite is
// green, and the first customer down that path gets a ReferenceError — the
// recorded free-identifier trap, which has now cost this repository four
// separate misses.
//
// The merge of the removal verb onto the one-mark work is exactly how a name
// goes missing: both sides edited that one import line, so a resolution that
// took one side whole would silently drop the other's two names. DERIVED from
// the uses rather than listed here, because a list in a guard is the second
// copy that drifts.
test("every site-lanes name worker.js uses is on its import line", () => {
  const w = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  const line = w.match(/^import \{([^}]*)\} from "\.\/builder\/site-lanes\.mjs";$/m);
  assert.ok(line, "the site-lanes import line moved — re-derive this guard");
  const imported = new Set(line[1].split(",").map((n) => n.trim().split(/\s+as\s+/).pop()).filter(Boolean));
  assert.ok(imported.size >= 10, "only " + imported.size + " names parsed — the reader is broken");

  // THE OBSERVER IS PROVED ALIVE by naming what this module exports and then
  // asking which of those the Worker uses: a scan that found nothing would pass
  // an empty check, which is the recorded "a negative assertion must prove its
  // observer is alive".
  const mod = fs.readFileSync(new URL("../../../builder/site-lanes.mjs", import.meta.url), "utf8");
  const exported = [...mod.matchAll(/^export (?:const|function|async function|class) (\w+)/gm)].map((m) => m[1]);
  assert.ok(exported.length >= 10, "only " + exported.length + " exports found — the reader is broken");

  // Comments blanked length-preserving: this file's prose names these symbols
  // while explaining them, the recorded "prose contains the thing it forbids".
  const bare = w.split("\n").map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? " ".repeat(l.length) : l)).join("\n");
  const used = exported.filter((n) => new RegExp("(?<![\\w.\"'])" + n + "(?![\\w\"'])").test(bare));
  assert.ok(used.length >= 5, "only " + used.length + " of this module's names appear in worker.js — the scan is broken");

  const missing = used.filter((n) => !imported.has(n));
  assert.deepEqual(missing, [],
    "worker.js uses these and does not import them, so the line throws when it runs: " + missing.join(", "));
});
