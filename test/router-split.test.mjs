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

// ── THE CODE'S OWN SPLIT (2026-10-26, fix 2) ─────────────────────────────────
import { addonSplit } from "../builder/request.mjs";

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

test("an addon answer holding nothing but writing several places is split by the code", () => {
  const plan = planParts(P6, P6_ANSWER);
  assert.equal(plan.ok, true, JSON.stringify(plan));
  const words = plan.parts.map((p) => p.words);
  assert.deepEqual(words.slice(1), [
    "Make the cafe opening hours 8am to 4pm.",
    "Add a flat white at £3.20 and a vegan banana bread at £3.80 to the cafe menu.",
    "Add our phone number 01736 555 210 to the footer if it isn't there already.",
  ]);
  assert.ok(plan.parts.slice(1).every((p) => p.source === "split" && p.phase === "route"));
  // The hire form and its own privacy stay with the answer; the step takes the rest out.
  assert.match(plan.parts[0].words, /Hire page/);
  assert.match(plan.parts[0].words, /only I can see hire requests/);
  assert.equal(plan.parts[0].held.length, 3);
  // An item naming no place stays with the answer, and is said.
  assert.deepEqual(addonSplit(P6, P6_ANSWER).unmatched, [
    "A few more things for Driftwood & Daughters.",
    "Change the email address on the site to bookings@driftwoodanddaughters.co.uk.",
  ]);
});

test("controls: one place, an edit answer, or the router's own holds are never re-split", () => {
  const onePlace = { ...P6_ANSWER, targets: [{ change: 0, writes: ["page:/hire", "new-component:HireRequestForm"], reads: [] }] };
  assert.equal(planParts(P6, onePlace).parts.length, 1);
  // TEST 8's mix: a look answer over two places is one part, as proven live (run 66).
  const T8 = "Take Gallery out of the menu. Then, on the Visit page only, put the \"Order a collection so we hold a loaf\" band above \"Come to the bakery\".";
  const look = { intent: "edit", layer: "look", alsoAsked: [], targets: [{ change: 0, writes: ["menu", "page:/visit"], reads: [] }] };
  assert.equal(planParts(T8, look).parts.length, 1);
  // The router held one back itself: its holds stand, the code adds none.
  const routerHeld = { ...P6_ANSWER, alsoAsked: ["Make the cafe opening hours 8am to 4pm."] };
  assert.equal(planParts(P6, routerHeld).parts.length, 2);
  // No targets named: nothing to split by.
  assert.equal(planParts(P6, { ...P6_ANSWER, targets: [] }).parts.length, 1);
});

test("the answer's own place: the hand-over's page first, and what it creates is its own", () => {
  // The hand-over names /hire even when another page is listed first.
  const cafeFirst = { ...P6_ANSWER, targets: [{ change: 0, writes: ["page:/cafe", "page:/hire", "new-component:HireRequestForm", "data:cafe_menu", "footer"], reads: [] }] };
  assert.match(planParts(P6, cafeFirst).parts[0].words, /Hire page/);
  // A request about what the answer creates stays with it, even beside another page's word.
  const MSG2 = "Add a booking form to the Lessons page. Only I can see booking requests. Change the Booking page title.";
  const ans = { intent: "addon", alsoAsked: [], handOver: { page: "/lessons" },
    targets: [{ change: 0, writes: ["page:/lessons", "new-data:booking_requests", "page:/bookings"], reads: [] }] };
  assert.deepEqual(addonSplit(MSG2, ans).held, ["Change the Booking page title."]);
});

test("an edit answer is never split by the code, whatever it writes", () => {
  const T8 = "Take Gallery out of the menu. Then, on the Visit page only, put the band above \"Come to the bakery\".";
  for (const intent of ["edit", undefined, "clarify"]) {
    const a = { intent, layer: "look", alsoAsked: [], targets: [{ change: 0, writes: ["menu", "page:/visit"], reads: [] }] };
    assert.deepEqual(addonSplit(T8, a).held, []);
  }
});
