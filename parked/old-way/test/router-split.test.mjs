// PARKED (2026-11-03, park-old-way): the old-way half of test/router-split.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// ── AN ADDON ANSWER EDITS NOTHING (2026-10-26) ───────────────────────────────
//
// The owner's combined test on driftwood-and-daughters-5: six requests in one
// message were answered "addon" with nothing held back, and five were
// dropped. The live held-back rule now puts the addon case first and says an
// addon answer holds every change to what the site has and every addition on
// another target; the quoting retry keeps the same holds. These guard the
// wording and, with supplied router answers, that such an answer becomes one
// part per request.
import test from "node:test";
import assert from "node:assert/strict";
import { LIVE_ASK_TOOL, HELD_UNREAD_REASON } from "../builder/site-ask.mjs";
import { planParts } from "../../../builder/request.mjs";

const LIVE = LIVE_ASK_TOOL.input_schema.properties;
const ALSO = LIVE.alsoAsked.description;
const LAYER = LIVE.layer.description;

const MSG = "A few more things for Driftwood & Daughters. Make the cafe opening hours 8am to 4pm. " +
  "Change the email address on the site to bookings@driftwoodanddaughters.co.uk. " +
  "On the Hire page, let people request a board or wetsuit online. " +
  "Add a flat white at £3.20 and a vegan banana bread at £3.80 to the cafe menu. " +
  "Add our phone number 01736 555 210 to the footer if it isn't there already.";

test("the quoting retry keeps the same holds and never says hold nothing back", () => {
  assert.doesNotMatch(HELD_UNREAD_REASON, /hold nothing back/);
  assert.match(HELD_UNREAD_REASON, /holding back the same parts, each copied exactly/);
});

// ── THE CODE'S OWN SPLIT (2026-10-26, fix 2) ─────────────────────────────────
import { addonSplit } from "../../../builder/request.mjs";

const P6 = "A few more things for Driftwood & Daughters. Make the cafe opening hours 8am to 4pm. " +
  "Change the email address on the site to bookings@driftwoodanddaughters.co.uk. " +
  "On the Hire page, let people request a board or wetsuit online. " +
  "Add a flat white at £3.20 and a vegan banana bread at £3.80 to the cafe menu. " +
  "Make sure only I can see hire requests, and add spam protection to the hire form. " +
  "Add our phone number 01736 555 210 to the footer if it isn't there already.";
const P6_ANSWER = {
  intent: "addon", alsoAsked: [],
  handOver: { from: "route", reason: "feature-on-page", field: "component", page: "/hire" },
  targets: [{ change: 0, writes: ["page:/hire", "new-component:HireRequestForm", "new-data:hire_requests", "page:/cafe", "data:cafe_menu", "footer"], reads: [] }],
};
