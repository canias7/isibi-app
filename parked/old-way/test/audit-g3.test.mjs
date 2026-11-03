// PARKED (2026-11-03, park-old-way): the old-way half of test/audit-g3.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// Audit group g3 (2026-10-22): A06-5 (page writers see the draft's held
// tables); A04-3 went with the scheduled jobs. S6-2 and A01-5 were already fixed (reply-held-draft, site-placeholder).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
/** The source between two landmarks, both asserted present first. */
function between(a, b, from = 0) {
  const i = src.indexOf(a, from);
  assert.ok(i >= 0, "landmark missing: " + a);
  const k = src.indexOf(b, i + a.length);
  assert.ok(k > i, "landmark missing: " + b);
  return src.slice(i, k);
}

test("A06-5: the Edit page rung overlays the draft's held changes on its schema before the writer", () => {
  const rung = between('if (!eSpec) return explain("page/spec-unreadable", {}, { backend: "spec-missing" });', "const eModels = modelsFor(");
  assert.match(rung, /eView = await draftView\(env, ownerSlug\)/);
  assert.match(rung, /eSpec = specOverlay\(eSpec, eView\.ops\)/);
  assert.match(rung, /backend: "draft"/, "an unreadable draft stops");
});
