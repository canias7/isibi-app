// PARKED (2026-11-03, park-old-way): the old-way half of test/audit-r2-g1.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// AUDIT ROUND 2, GROUP 1 (2026-10-23): A14-6, A36-2, A36-3, A36-4, A36-5, S5-3.
// Each case is fed by its real producer where there is one: the held draft a
// row step answers with (`heldDraft` in worker.js), the schema state
// `readSchemaState` returns, the router's window (`routerHistory`) and a
// request record from `newRequest` and `planParts`.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { editPublishFacts, editStepFacts, editAppliedFacts, addonSchemaFacts, startFacts } from "../../../builder/site-progress.mjs";
import { converseTables, siteContextBlock, routerHistory } from "../../../builder/site-converse.mjs";
import { readSchemaState, RECOVER_QUERIES } from "../../../site-schema-recover.mjs";

import { echoTokens } from "../../../builder/input-budget.mjs";
import { newRequest, planParts, jobBody, requestMaking } from "../../../builder/request.mjs";

const W = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
const said = (facts) => facts.map((f) => f.text || f.line || JSON.stringify(f)).join("\n");

// ── A14-6 ───────────────────────────────────────────────────────────────────
const HELD = { published: false, held: true, revision: 4, said: "x" }; // worker.js heldDraft's shape
const dataStep = { layer: "data", page: "/prices" };

test("A14-6 an add-on's held schema is said as held, and its publish as a draft save; the plan ends at the draft", () => {
  const h = said(addonSchemaFacts({ tables: ["bookings"], jobs: ["weekly"] }, { publishing: true, held: true, draft: true }));
  assert.doesNotMatch(h, /Created in the site's database|Publishing the site/);
  assert.match(h, /Held in their draft/);
  assert.match(h, /Saving the additions to their draft/);
  assert.doesNotMatch(h, /Set to run on a timer/);
  // A SITE NOT LIVE YET: the schema is made, the timers are still held (`backendWriter`).
  const n = said(addonSchemaFacts({ tables: ["bookings"], jobs: ["weekly"] }, { heldJobs: true }));
  assert.match(n, /Created in the site's database/);
  assert.match(n, /Held in their draft until they press Publish, to be set to run on a timer/);
  assert.match(said(addonSchemaFacts({ tables: ["bookings"] }, { publishing: true })), /Created in the site's database: the table .bookings.[\s\S]*Publishing the site/, "control");
  for (const op of ["edit", "addon", "build"]) {
    assert.doesNotMatch(said(startFacts({ op, draft: true })), /and it is published|built and published/, op);
    assert.match(said(startFacts({ op, draft: true })), /saved (to|as) their draft/, op); // the plan ends at the draft; the Publish clause is said once, by the save (progress-voice-2)
    assert.match(said(startFacts({ op })), /published/, op + " control");
  }
  // WIRED: every start and the add-on's schema milestone are handed the switch.
  assert.equal((W.match(/startFacts\(\{[^}]*draft: draftFirst\(env\)/g) || []).length, 4, "a start milestone is not told about draft-first");
  assert.match(W, /addonSchemaFacts\([^;]*held: aWriter\.holding, heldJobs: aWriter\.on, draft: aWriter\.on/);
});

// ── A36-2 ───────────────────────────────────────────────────────────────────
const sqlFor = (cols, meta) => async (q) => {
  if (q === RECOVER_QUERIES.columns) return cols;
  if (meta === null) throw new Error('relation "_meta" does not exist');
  return [{ v: JSON.stringify(meta) }];
};
const COLS = [{ t: "bookings", c: "id" }, { t: "bookings", c: "when" }, { t: "loaves", c: "id" }, { t: "loaves", c: "name" }];
