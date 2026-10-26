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
import { planParts } from "../builder/request.mjs";

const LIVE = LIVE_ASK_TOOL.input_schema.properties;
const ALSO = LIVE.alsoAsked.description;
const LAYER = LIVE.layer.description;

const MSG = "A few more things for Driftwood & Daughters. Make the cafe opening hours 8am to 4pm. " +
  "Change the email address on the site to bookings@driftwoodanddaughters.co.uk. " +
  "On the Hire page, let people request a board or wetsuit online. " +
  "Add a flat white at £3.20 and a vegan banana bread at £3.80 to the cafe menu. " +
  "Add our phone number 01736 555 210 to the footer if it isn't there already.";

test("the addon case comes first and holds every edit and every other target", () => {
  const addon = ALSO.indexOf('WHEN YOUR ANSWER IS "addon"');
  const edit = ALSO.indexOf("WHEN YOUR ANSWER IS AN EDIT");
  assert.ok(addon >= 0 && edit > addon, "the addon case is missing or after the edit case");
  const addonPart = ALSO.slice(addon, edit);
  assert.match(addonPart, /edits nothing/);
  assert.match(addonPart, /EVERY change to something the site already has/);
  assert.match(addonPart, /EVERY addition to a different target/);
  assert.match(addonPart, /only when they go on the same target/);
  // THE OLD BIAS AGAINST HOLDING IS GONE from the live field.
  assert.doesNotMatch(ALSO, /ALMOST ALWAYS LEAVE THIS OUT/);
  assert.doesNotMatch(ALSO, /When in doubt, say nothing/);
  // The look-door rule for edits is kept, and pointed at.
  assert.match(ALSO.slice(edit), /the closing rule of `layer` says which answer/);
  assert.match(LAYER.split("\n").pop(), /changes on different pages are one "look" answer/);
});

test("the quoting retry keeps the same holds and never says hold nothing back", () => {
  assert.doesNotMatch(HELD_UNREAD_REASON, /hold nothing back/);
  assert.match(HELD_UNREAD_REASON, /holding back the same parts, each copied exactly/);
});

test("an addon answer that holds what the rule says becomes one part per request", () => {
  const held = [
    "Make the cafe opening hours 8am to 4pm.",
    "Change the email address on the site to bookings@driftwoodanddaughters.co.uk.",
    "Add a flat white at £3.20 and a vegan banana bread at £3.80 to the cafe menu.",
    "Add our phone number 01736 555 210 to the footer if it isn't there already.",
  ];
  const plan = planParts(MSG, { intent: "addon", alsoAsked: held });
  assert.equal(plan.ok !== false, true, JSON.stringify(plan));
  const parts = plan.parts;
  assert.equal(parts.length, 5);
  assert.deepEqual(parts.slice(1).map((p) => p.words), held);
  // CONTROL: the same answer holding nothing is one part — the run that dropped five.
  const one = planParts(MSG, { intent: "addon", alsoAsked: [] });
  assert.equal(one.parts.length, 1);
});
