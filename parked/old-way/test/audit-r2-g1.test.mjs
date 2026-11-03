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
import { askRequest, ASK_MAX_TOKENS, RESOLVED_TOKENS } from "../builder/site-ask.mjs";
import { echoTokens } from "../../../builder/input-budget.mjs";
import { newRequest, planParts, jobBody, requestMaking } from "../../../builder/request.mjs";

const W = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
const said = (facts) => facts.map((f) => f.text || f.line || JSON.stringify(f)).join("\n");

// ── A14-6 ───────────────────────────────────────────────────────────────────
const HELD = { published: false, held: true, revision: 4, said: "x" }; // worker.js heldDraft's shape
const dataStep = { layer: "data", page: "/prices" };

// ── A36-2 ───────────────────────────────────────────────────────────────────
const sqlFor = (cols, meta) => async (q) => {
  if (q === RECOVER_QUERIES.columns) return cols;
  if (meta === null) throw new Error('relation "_meta" does not exist');
  return [{ v: JSON.stringify(meta) }];
};
const COLS = [{ t: "bookings", c: "id" }, { t: "bookings", c: "when" }, { t: "loaves", c: "id" }, { t: "loaves", c: "name" }];

// ── A36-3 ───────────────────────────────────────────────────────────────────
test("A36-3 a go-ahead on a long plan has room to restate it and copy its held parts", () => {
  const plan = Array.from({ length: 6 }, (_, i) => (i + 1) + ". " + "Improve the section with clearer words and a better photograph ".repeat(8)).join("\n").slice(0, 3200);
  const history = routerHistory([{ role: "user", text: "what should I improve first?" }, { role: "assistant", text: plan }]);
  assert.ok(history.turns.some((t) => t.text.length > 2500), "the router's window cut the plan before the test");
  const req = askRequest({ message: "go ahead with all of it", site: {}, hasSite: true, live: true, history });
  const need = ASK_MAX_TOKENS + echoTokens("go ahead with all of it") + RESOLVED_TOKENS + 2 * echoTokens(...history.turns.map((t) => t.text));
  assert.ok(req.max_tokens >= need, "the ceiling " + req.max_tokens + " leaves no room to restate a " + plan.length + "-character plan (" + need + ")");
  assert.equal(askRequest({ message: "hi", site: {} }).max_tokens, ASK_MAX_TOKENS, "control: no conversation, no growth");
});
