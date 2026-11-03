// PARKED (2026-11-03, park-old-way): the old-way half of test/feature-existing.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// A feature added to a page the site already has (2026-10-25, feature-existing).
// Live on driftwood-and-daughters-5 after b12dba52c: "each lesson bookable
// online with date, time and number of people, max 8 per group lesson, and a
// switch so I can mark a day closed" on the existing Lessons page went to the
// page step (addon-existing), which changed the page's words and built no
// booking. The router's own targets decide: a change that creates something
// beside an existing page (a component, a table, a function, a connection, a
// schedule) stays on the add-on step with that page as its target; content
// only (`page:/x`, existing tables) is still the page step's.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { addonOnExisting, routeOnExisting } from "../../../builder/addon-existing.mjs";
import { readHandOver, HAND_REASONS, handOverLine } from "../../../builder/hand-over.mjs";
import { LIVE_ASK_TOOL } from "../../../builder/route-shared.mjs";

const site = { pages: ["/", "/lessons", "/cafe"], tables: ["lessons", "lesson_bookings", "closed_days"] };
const addon = (writes, reads = []) => ({ intent: "addon", targets: [{ change: 0, writes, reads }], decision: { source: "model", reasons: [] } });

test("the add-on step never hands a feature back to the page step, and a lone entry becomes the component", () => {
  const W = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  const at = (s, from = 0) => { const i = W.indexOf(s, from); assert.ok(i >= 0, "landmark missing: " + s); return i; };
  const onPage = at("const aOnPage = ");
  const feat = at('const aFeature = !!(aHand && aHand.reason === "feature-on-page" && aOnPage);', onPage);
  const noAdd = at('if (!aPicked.kinds.length) return (aOnPage && !aFeature) ? aToPage("no-add") : aFailure("no-add");', feat);
  const lone = at('if (aFeature && aPicked.kinds.length === 1 && aPicked.kinds[0] === "row") {', noAdd);
  const rowPath = at('if (aPicked.kinds.length === 1 && aPicked.kinds[0] === "row") {', lone + 10);
  assert.match(W.slice(lone, rowPath), /aPicked\.kinds = \["component"\];/);
});
