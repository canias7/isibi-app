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
import { ADD_DESIGN_RULE, addDirective, foldAdds, pageComponents, siteNote, addRequest } from "../builder/site-add.mjs";
import { FIRST_QUOTES, SECOND_QUOTES, gridBand, stackedBand, FIRST_BAND, SECOND_BAND_AS_SERVED, page } from "./fixtures/testimonial-bands.mjs";

const addSrc = fs.readFileSync(new URL("../builder/site-add.mjs", import.meta.url), "utf8");
const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

// ── the served page, run 36 (2026-09-04): the two bands as fretwork-1 serves them ──
//
// `test/fixtures/testimonial-bands.mjs` — one copy, shared with the harness's
// own guard (test/addon-sweep.test.mjs), which says where it was read from.

// ── hop 1: the rule, on both models ─────────────────────────────────────────

test("the rule says a second one is built the way the first is, and rides both hops", () => {
  assert.match(ADD_DESIGN_RULE, /AND A SECOND ONE IS BUILT THE WAY THE FIRST IS BUILT/, "the design rule does not say a second one copies the first");
  assert.match(ADD_DESIGN_RULE, /the same component — the kit part it calls, or the part written for this site — called the same way/, "the rule does not name the component as what is copied");
  assert.match(ADD_DESIGN_RULE, /three across stays three across, a grid stays a grid/, "the rule does not say the layout is copied");
  assert.match(ADD_DESIGN_RULE, /Only the words are new/, "the rule does not say what may differ");
  assert.match(ADD_DESIGN_RULE, /the one that was there first is the one to copy/, "the rule does not say which one is copied when there are two");
  // The designers' system carries the whole rule (every kind's call), and the
  // page writer's directive heads with it — one string, two hops.
  const req = addRequest({ kind: "component", message: "Add a testimonials section", site: { name: "X", pages: ["/"] }, model: "m" });
  assert.ok(req.system[0].text.includes(ADD_DESIGN_RULE), "the component designer is not told the rule");
  const f = foldAdds([{ kind: "component", value: [{ page: "/", where: "after the first testimonials band", does: "three more quotes", components: ["TestimonialGrid"] }] }], { pages: [{ path: "index.tsx" }] }, { pages: ["/"] });
  assert.ok(f.directive.includes(ADD_DESIGN_RULE), "the page writer's directive does not carry the rule");
  // The component kind's own wording says it too, at the hint and at `keep`.
  assert.match(addSrc, /that is a SECOND one, added after the first, which stays exactly as it is — and built from the SAME component the first is built from, laid out the same way\./,
    "the component hint does not say a second one is built from the same component");
  assert.match(addSrc, /as a second one, " \+\n\s*"BUILT FROM THE SAME COMPONENT the first is built from — the note below says what each page is built " \+\n\s*"from; name that one, never another that shows the same kind of thing\. "/,
    "the component rule's keep does not tell the designer to name the first one's component");
});

test("the page writer's directive for a component says how the second one is built", () => {
  const d = addDirective("component", { page: "/", where: "after the first band", does: "three more quotes", components: ["TestimonialGrid"] }, { pages: ["/"] });
  assert.match(d, /this is a SECOND one: put it after the existing one, and the existing one comes back byte-identical — its words, its props, its place\. AND BUILD THE NEW ONE THE WAY THE FIRST ONE IS BUILT: the same component \(the kit part it calls, or the site's own part\), called the same way, inside the same wrapper with the same layout classes/,
    "the directive does not tell the writer to copy the first one's build");
  assert.match(d, /a grid three across stays a grid three across; only the words are new\. Not a different component that shows the same kind of thing\./);
});

// ── hop 2: the fact — what each page is built from ─────────────────────────

test("pageComponents reads what each page is built from off its imports: the kit by file, the site's own parts apart, keyed by route", () => {
  const home = `import { createFileRoute } from "@tanstack/react-router";
import { SiteChrome } from "@/components/ui/site-chrome";
import { TestimonialGrid, type Testimonial } from "@/components/ui/testimonial-grid";
import { AvailabilityCalendar as Calendar, Button } from "@/components/ui/availability-calendar";
import { ChordDiagram } from "@/routes/-parts/chord-diagram";
import { useRows } from "@/lib/rows";
export const Route = createFileRoute("/")({ component: Home });
function Home() { return null; }`;
  const prices = `import { createFileRoute } from "@tanstack/react-router";\nimport { PriceList } from "@/components/ui/price-list";\nexport const Route = createFileRoute("/prices")({ component: P });\nfunction P() { return null; }`;
  const got = pageComponents([{ path: "index.tsx", source: home }, { path: "prices.tsx", source: prices }, { path: "src/routes/gear.tsx", source: "export const Route = 1;" }]);
  assert.deepEqual(got["/"], { kit: ["SiteChrome", "TestimonialGrid", "Testimonial", "AvailabilityCalendar", "Button"], parts: ["ChordDiagram"] });
  assert.deepEqual(got["/prices"], { kit: ["PriceList"], parts: [] });
  assert.equal(got["/gear"], undefined, "a page importing nothing lists as nothing, never as a guess");
  // An alias is read as the KIT's name — that is what the designer names — and
  // `@/lib/*` is not a component.
  assert.ok(!got["/"].kit.includes("Calendar") && !got["/"].kit.includes("useRows"));
  // Junk in, nothing out; the stored path shape (bare or prefixed) both read.
  assert.deepEqual(pageComponents(null), {});
  assert.deepEqual(pageComponents([null, {}, { path: "x.tsx" }, { path: 3, source: "" }]), {});
});

test("the note tells the component designer what each page is built from, and the route hands it the fact", () => {
  const note = siteNote({ name: "Crookes", pages: ["/", "/prices"], labels: { "/": "Book a guitar lesson" },
    builtFrom: { "/": { kit: ["SiteChrome", "TestimonialGrid", "AvailabilityCalendar"], parts: ["ChordDiagram"] }, "/prices": { kit: ["PriceList"], parts: [] } } });
  assert.match(note, /^\/ is built from: SiteChrome, TestimonialGrid, AvailabilityCalendar; and its own parts ChordDiagram\. A second one of something it already has is built from the same component as the first\.$/m, note);
  assert.match(note, /^\/prices is built from: PriceList\. A second one/m, note);
  // A site described without it reads exactly as before — the line is added, never a placeholder.
  assert.doesNotMatch(siteNote({ name: "Crookes", pages: ["/"] }), /is built from/);
  assert.doesNotMatch(siteNote({ name: "Crookes", pages: ["/"], builtFrom: { "/": { kit: [], parts: [] } } }), /is built from/);
  // THE HOP: the addon route reads it off the stored source it already holds.
  assert.match(worker, /builtFrom: pageComponents\(aSrc\),/, "the route does not hand the designer what each page is built from");
  assert.match(worker, /import \{[^}]*\bpageComponents\b[^}]*\} from "\.\/builder\/site-add\.mjs"/, "pageComponents is not imported from its module");
});

// ── hop 3: the harness reads the served page ────────────────────────────────

test("the harness reads a section's STRUCTURE, never its words: a grid of three and a grid of four read the same, a grid and a stack do not", async () => {
  const { skeletonOf, sameSkeleton, sectionsOf, newSections, builtLike, TESTIMONIALS_LIKE, CASES, strip } = await import("../scripts/addon-sweep.mjs");
  // Run 36 as served: the second band is NOT built the way the first is.
  assert.equal(sameSkeleton(FIRST_BAND, SECOND_BAND_AS_SERVED), false, "run 36's stacked band reads as a copy of the grid");
  assert.match(skeletonOf(FIRST_BAND), /div\[testimonial-grid\]\{gap-4 grid lg:grid-cols-3 sm:grid-cols-2\}\(div\[card\]/, skeletonOf(FIRST_BAND));
  assert.match(skeletonOf(SECOND_BAND_AS_SERVED), /div\{max-w-6xl space-y-6\}\(div\[card\]/, skeletonOf(SECOND_BAND_AS_SERVED));
  // A second grid with FOUR different quotes is the same design: items collapse, words are not read.
  const four = gridBand([...SECOND_QUOTES, ["A fourth, longer quote about lessons that were worth every penny of it.", "AB", "Alex B."]]);
  assert.equal(sameSkeleton(FIRST_BAND, four), true, "a copy with more items and other words reads as a different design");
  assert.equal(skeletonOf(FIRST_BAND), skeletonOf(gridBand([FIRST_QUOTES[0]])), "one card and three read differently");
  // An icon's paths are not a layout; a stray comment is not a tag.
  assert.equal(sameSkeleton(FIRST_BAND, FIRST_BAND.replace("<span class=\"flex h-full", "<svg><path d=\"M0 0h1\"/><circle r=\"1\"/></svg><span class=\"flex h-full")), false, "an added icon changes nothing?");
  assert.equal(skeletonOf("<div><!-- x --><p>a</p></div>"), "div(p)");
  assert.equal(skeletonOf(""), "");
  assert.equal(sameSkeleton("", ""), false, "nothing is not built like nothing");
  // Sections are read outermost-first, a nested one kept inside its parent.
  assert.equal(sectionsOf(page(FIRST_BAND, SECOND_BAND_AS_SERVED)).length, 3);
  assert.equal(sectionsOf("<section><section>in</section></section><section>b</section>").length, 2);
  // What the page gained, by its words.
  const before = { html: page(FIRST_BAND) };
  assert.deepEqual(newSections(before.html, page(FIRST_BAND, SECOND_BAND_AS_SERVED)).map((s) => s.length), [SECOND_BAND_AS_SERVED.length]);
  assert.deepEqual(newSections(before.html, before.html), []);
  // The verdict: run 36 fails, a real copy passes, the first of its kind is said, nothing new is a failure.
  const served = builtLike(before, { html: page(FIRST_BAND, SECOND_BAND_AS_SERVED) }, TESTIMONIALS_LIKE);
  assert.equal(served.ok, false, "run 36's band passes as a copy of the first");
  assert.match(served.note, /BUILT DIFFERENTLY from the band it should copy — new “I had never held a guitar/, served.note);
  assert.match(served.note, /where the first is section\(div\{max-w-6xl\}\(div\[testimonial-grid\]/, served.note);
  const copied = builtLike(before, { html: page(FIRST_BAND, four) }, TESTIMONIALS_LIKE);
  assert.equal(copied.ok, true, copied.note);
  assert.equal(copied.note, "built the way the first one is");
  const first = builtLike({ html: page() }, { html: page(gridBand(SECOND_QUOTES)) }, TESTIMONIALS_LIKE);
  assert.equal(first.ok, true, "the first band of its kind is failed for copying nothing");
  assert.equal(builtLike({ html: page() }, { html: page(stackedBand(SECOND_QUOTES)) }, TESTIMONIALS_LIKE).note, "first of its kind on the page, nothing to copy");
  assert.equal(builtLike(before, { html: before.html }, TESTIMONIALS_LIKE).ok, false, "a page that gained nothing passes");
  assert.equal(builtLike(null, null, TESTIMONIALS_LIKE).ok, false);
  // FOUND BY FOUR SURVIVORS of the first sweep — each a property the lines
  // above describe and did not drive (the recorded "a guard proves the branch
  // it drives" shape):
  // — an icon's INSIDE is not a layout: two bands whose icons differ only in
  //   their paths read the same, which is what the `<svg>` leaf buys;
  const iconA = FIRST_BAND.replace("<span class=\"flex h-full", "<svg><path d=\"M0 0h1\"/></svg><span class=\"flex h-full");
  const iconB = FIRST_BAND.replace("<span class=\"flex h-full", "<svg><path d=\"M1 1h2\"/><circle r=\"1\"/></svg><span class=\"flex h-full");
  assert.equal(sameSkeleton(iconA, iconB), true, "two icons with different paths read as two designs");
  // — the section copied is the FIRST of its kind, never the new one: a
  //   second TestimonialGrid two across carries the same slot and is not a
  //   copy of one three across (a reader that took the LAST like section
  //   would take the new band as its own model and pass everything);
  const twoAcross = gridBand(SECOND_QUOTES).replace("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", "grid gap-4 md:grid-cols-2");
  assert.notEqual(twoAcross, gridBand(SECOND_QUOTES), "the fixture's class string moved");
  const narrower = builtLike(before, { html: page(FIRST_BAND, twoAcross) }, TESTIMONIALS_LIKE);
  assert.equal(narrower.ok, false, "a grid two across passes as a copy of a grid three across");
  assert.match(narrower.note, /where the first is section\(div\{max-w-6xl\}\(div\[testimonial-grid\]\{gap-4 grid lg:grid-cols-3 sm:grid-cols-2\}/, "the band copied was not the first: " + narrower.note);
  // — EVERY new section is judged, not the first alone: a copy followed by a
  //   stack in one addition fails on the stack;
  const twoNew = builtLike(before, { html: page(FIRST_BAND, four, SECOND_BAND_AS_SERVED) }, TESTIMONIALS_LIKE);
  assert.equal(twoNew.ok, false, "a second new band built differently passes behind a first that copies");
  assert.match(twoNew.note, /is section\(div\{max-w-6xl space-y-6\}/, "the stack is not the band named: " + twoNew.note);
  // — and the first of its kind is an OK, not only a sentence.
  assert.equal(builtLike({ html: page() }, { html: page(stackedBand(SECOND_QUOTES)) }, TESTIMONIALS_LIKE).ok, true, "the first band of its kind, not the kit's grid, is failed for copying nothing");
  // AND THE COMPONENT CASE READS IT: the words landed, nothing lost, the build
  // moved, the home page changed — and the band was built like the first, or
  // the run is red with the structure named.
  const c = CASES.find((x) => x.name === "component");
  // `text` is read off `html` by the harness's own reader, never typed beside it.
  const b = { build: "b1", html: before.html, text: strip(before.html) };
  const stacked = { build: "b2", html: page(FIRST_BAND, SECOND_BAND_AS_SERVED), text: strip(page(FIRST_BAND, SECOND_BAND_AS_SERVED)) };
  const reply = { ok: true, changed: ["index.tsx"], added: [] };
  const v = c.check(b, stacked, reply, {});
  assert.equal(v.ok, false, "run 36's page passes the component case");
  assert.match(v.note, /everything it said is still there; BUILT DIFFERENTLY/, v.note);
  const grid = { build: "b2", html: page(FIRST_BAND, four), text: strip(page(FIRST_BAND, four)) };
  const w = c.check(b, grid, reply, {});
  assert.equal(w.ok, true, w.note);
  assert.match(w.note, /built the way the first one is$/, w.note);
});
