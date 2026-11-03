// PARKED (2026-11-03, park-old-way): the old-way half of test/addon-existing.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// An add-on about what the site already has, a lone entry with a required
// column left out, and a question asked after the request was paid for
// (2026-10-24, addon-existing). Traced live at main 7956740c4: parts about
// `page:/shop`, `page:/cafe` and `data:lessons` were routed `addon`, found
// nothing new (or wrote a partial `lessons` row, Postgres 23502), and ended
// with routing charged; a part could still be answered with `clarify`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { addonOnExisting, routeOnExisting, rowUnmet, sitePages, siteTables } from "../../../builder/addon-existing.mjs";
// A NAMESPACE, so a missing export fails its own cases, not the whole file.
import * as SA from "../../../builder/site-add.mjs";
const { rowBrief, cleanAdd, addRefusal } = SA;
const rowRequired = (...a) => SA.rowRequired(...a);
import { addonFailure } from "../../../builder/site-addon.mjs";
import { readRun, handOff } from "../../../builder/request.mjs";
import { readHandOver, HAND_REASONS } from "../../../builder/hand-over.mjs";
import { ROUTE_REASONS, wordsIn } from "../../../builder/route-shared.mjs";

const site = { pages: ["/", "/shop", { path: "/cafe" }, "/lessons-info"], tables: ["lessons", { name: "Products" }] };
const addon = (writes, reads = []) => ({ intent: "addon", targets: [{ change: 0, writes, reads }], decision: { source: "model", reasons: [] } });

// ── THE WIRING, in worker.js: landmarks read in order ────────────────────────
const W = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
const at = (s, from = 0) => { const i = W.indexOf(s, from); assert.ok(i >= 0, "landmark missing: " + s); return i; };

test("the router's answer is read against the site before anything uses it", () => {
  // (2026-11-02, agent-only: no routing call unless GF_OLD_LANES=1; the answer is read the same way either way.)
  const route = at("let routed = agentTakes() ? agentRouted({ waiting: rWaiting }) : await rRoute(rDigest);");
  const conv = at("routed = routeOnExisting(routed, rDigest.site, { reason: \"addon-existing\" });", route);
  const prep = at("if (rJob && rJob.prepare === true) {", route);
  const asking = at("const asking = routed.intent === \"clarify\" && rLive;", route);
  assert.ok(conv < prep && prep < asking);
  // A PART'S QUESTION IS KEPT (owner, 2026-10-26, any step may ask): nothing
  // turns a part's clarify, or an answer's follow-up, into a choice.
  assert.ok(!W.includes("partClarifyChoice"));
  assert.ok(!W.includes("routed.failed !== true && (rPart || (rWaiting && rWaiting.requestKey"));
});

test("the add-on step hands nothing-new to the page step, and a page request never takes the lone-entry path", () => {
  const pick = at("const aPicked = await pickAdds(");
  const noAdd = at("if (!aPicked.kinds.length) return (aOnPage && !aFeature) ? aToPage(\"no-add\") : aFailure(\"no-add\");", pick);
  const asked = at("if (aPageAsked && aPicked.kinds.length === 1 && aPicked.kinds[0] === \"row\") {", noAdd);
  const rowPath = at("if (aPicked.kinds.length === 1 && aPicked.kinds[0] === \"row\") {", asked);
  assert.ok(noAdd < asked && asked < rowPath);
  assert.match(W.slice(asked, rowPath), /if \(aOnPage\) return aToPage\("page-asked"\);[\s\S]*aPicked\.kinds = \["page"\];/);
  assert.match(W.slice(at("const aToPage = "), noAdd), /aFailure\("existing", \{ layer: "page", page: aOnPage \}\)/);
  // The required columns reach the designer and the cleaner.
  const row = W.slice(rowPath, rowPath + 2500);
  assert.match(row, /rowBrief\(aRowLists, aRowRequired\)/);
  assert.match(row, /rowRequired: aRowRequired \}/);
});

test("the row path tells what its entries do not do before it charges or writes", () => {
  const lone = at("if (aPicked.kinds.length === 1 && aPicked.kinds[0] === \"row\") {");
  const clean = at("const rowClean = cleanAdd(\"row\", rowRan.value", lone);
  const unmet = at("const rowUnmetOut = rowUnmet(rowRan.requirements, aInstruction, wordsIn);", clean);
  const carry = at("for (const w of rowUnmetOut.carry) if (!aHeldOut.parts.includes(w)) aHeldOut.parts.push(w);", unmet);
  const bill = at("const rowBill = pageCredits(...aDesignUsage);", carry);
  assert.ok(clean < unmet && unmet < carry && carry < bill);
  assert.ok(SA.REQUIREMENT_ADDS.includes("row"));
});
