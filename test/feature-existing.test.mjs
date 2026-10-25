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
import { addonOnExisting, routeOnExisting } from "../builder/addon-existing.mjs";
import { readHandOver, HAND_REASONS, handOverLine } from "../builder/hand-over.mjs";
import { LIVE_ASK_TOOL } from "../builder/site-ask.mjs";

const site = { pages: ["/", "/lessons", "/cafe"], tables: ["lessons", "lesson_bookings", "closed_days"] };
const addon = (writes, reads = []) => ({ intent: "addon", targets: [{ change: 0, writes, reads }], decision: { source: "model", reasons: [] } });

test("creating something beside an existing page is a feature on that page", () => {
  for (const extra of ["new-component:LessonBooking", "new-data:bookings", "new-function:seats_left", "new-api:calendar", "new-job:reminders"]) {
    assert.deepEqual(addonOnExisting(addon(["page:/lessons", extra]), site), { act: "feature", page: "/lessons" }, extra);
  }
  // The live request's shape: a form beside the page, existing tables written.
  assert.deepEqual(addonOnExisting(addon(["page:/lessons", "new-component:LessonBooking", "data:lesson_bookings", "data:closed_days"]), site), { act: "feature", page: "/lessons" });
  // A table the site does not have, written beside the page.
  assert.deepEqual(addonOnExisting(addon(["page:/lessons", "data:waitlist"]), site), { act: "feature", page: "/lessons" });
});

test("content only on an existing page is still the page step's", () => {
  assert.deepEqual(addonOnExisting(addon(["page:/lessons"]), site), { act: "edit", page: "/lessons" });
  assert.deepEqual(addonOnExisting(addon(["page:/lessons", "data:lesson_bookings"]), site), { act: "edit", page: "/lessons" });
  // A new page is not a feature on an existing one.
  assert.deepEqual(addonOnExisting(addon(["new-page:/surf", "new-data:bookings"]), site), { act: "page-asked", page: "" });
  // No page written: the add-on runs as before.
  assert.equal(addonOnExisting(addon(["new-data:bookings"]), site), null);
});

test("a feature stays an add-on, with a hand-over naming the page, read back by the add-on step", () => {
  const out = routeOnExisting(addon(["page:/lessons", "new-component:LessonBooking"]), site, { reason: "addon-existing" });
  assert.equal(out.intent, "addon");
  assert.deepEqual(out.handOver, { from: "route", reason: "feature-on-page", field: "component", page: "/lessons" });
  assert.ok(Object.hasOwn(HAND_REASONS, "feature-on-page"));
  const read = readHandOver(out.handOver, { pages: site.pages });
  assert.deepEqual(read, out.handOver);
  assert.match(handOverLine(read), /The page: \/lessons\./);
  // Never over a hand-over it already has.
  const had = { ...addon(["page:/lessons", "new-component:X"]), handOver: { from: "page", reason: "addon" } };
  assert.equal(routeOnExisting(had, site), had);
});

test("the router is told to name what a feature creates beside an existing page", () => {
  const d = JSON.stringify(LIVE_ASK_TOOL);
  assert.ok(d.includes("WHAT EACH CHANGE TOUCHES"), "targets description present");
  assert.match(d, /added to a page that already exists also names what it creates beside/);
  assert.match(d, /page:\/path alone means only that page's content changes/);
});

test("the add-on step never hands a feature back to the page step, and a lone entry becomes the component", () => {
  const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = (s, from = 0) => { const i = W.indexOf(s, from); assert.ok(i >= 0, "landmark missing: " + s); return i; };
  const onPage = at("const aOnPage = ");
  const feat = at('const aFeature = !!(aHand && aHand.reason === "feature-on-page" && aOnPage);', onPage);
  const noAdd = at('if (!aPicked.kinds.length) return (aOnPage && !aFeature) ? aToPage("no-add") : aFailure("no-add");', feat);
  const lone = at('if (aFeature && aPicked.kinds.length === 1 && aPicked.kinds[0] === "row") {', noAdd);
  const rowPath = at('if (aPicked.kinds.length === 1 && aPicked.kinds[0] === "row") {', lone + 10);
  assert.match(W.slice(lone, rowPath), /aPicked\.kinds = \["component"\];/);
});
