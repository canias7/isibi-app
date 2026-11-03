// PARKED (2026-11-03, park-old-way): the old-way half of test/copy-design.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// A SECOND ONE COPIES THE FIRST'S DESIGN (owner, 2026-09-04: "new components
// should copy existing design").
//
// Run 36 added a second testimonials band under the first: the words landed,
// every sentence the page had stayed, the wall passed it — and the new band
// was stacked full-width cards under a first band of three across. Two
// designs of one thing on one page. Three hops, each read here: the rule on
// both models (the designers' system and the page writer's directive), the
// FACT the component designer needs (what each page is built from, off the
// stored source), and the harness's own reading of the served page — the
// structure of the new section against the structure of the one it copies.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { ADD_DESIGN_RULE, addDirective, foldAdds, pageComponents, siteNote, addRequest } from "../../../builder/site-add.mjs";
import { FIRST_QUOTES, SECOND_QUOTES, gridBand, stackedBand, FIRST_BAND, SECOND_BAND_AS_SERVED, page } from "../../../test/fixtures/testimonial-bands.mjs";

const addSrc = fs.readFileSync(new URL("../../../builder/site-add.mjs", import.meta.url), "utf8");
const worker = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");

test("the note tells the component designer what each page is built from, and the route hands it the fact", () => {
  const note = siteNote({ name: "Crookes", pages: ["/", "/prices"], labels: { "/": "Book a guitar lesson" },
    builtFrom: { "/": { kit: ["SiteChrome", "TestimonialGrid", "AvailabilityCalendar"], parts: ["ChordDiagram"] }, "/prices": { kit: ["PriceList"], parts: [] } } });
  assert.match(note, /^\/ is built from: SiteChrome, TestimonialGrid, AvailabilityCalendar; and its own parts ChordDiagram\. A second one of something it already has is built from the same component as the first\.$/m, note);
  assert.match(note, /^\/prices is built from: PriceList\. A second one/m, note);
  // A site described without it reads exactly as before — the line is added, never a placeholder.
  assert.doesNotMatch(siteNote({ name: "Crookes", pages: ["/"] }), /is built from/);
  assert.doesNotMatch(siteNote({ name: "Crookes", pages: ["/"], builtFrom: { "/": { kit: [], parts: [] } } }), /is built from/);
  // THE HOP: the addon route reads it off the stored source it already holds.
  // RE-ANCHORED 2026-10-11: `aView` — the site's pages, or a prepared part's
  // declared scope of them (the parallel-work goal).
  assert.match(worker, /builtFrom: pageComponents\(aView\),/, "the route does not hand the designer what each page is built from");
  assert.match(worker, /import \{[^}]*\bpageComponents\b[^}]*\} from "\.\/builder\/site-add\.mjs"/, "pageComponents is not imported from its module");
});
