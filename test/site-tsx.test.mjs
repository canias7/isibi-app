// COMPONENTS THE KIT HAS NOT GOT — the design step declares them, the page step
// writes them, the container puts them somewhere they are neither published as a
// route nor left in the next customer's build (owner, 2026-08-29: "what if
// customer wants something that we dont have in our library, make a step for
// that, a tsx step that generates stuff, put it as optional, and its gotta be
// after the components step").
//
// THIS FILE IS MOSTLY ONE TEST: THE CHAIN. `three` shipped the same day with a
// correct field, a correct lane, its own guards and a green suite, and was dead
// because ONE hop was missing. Every individual piece of this feature can be
// right while the feature does nothing, and only an end-to-end assertion says
// so — which is why the hop count here is derived from the producers rather than
// listed as today's call sites.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { routeOf } from "../builder/site-addon.mjs";
import { TSX_FIELD, TSX_ITEM, MAX_TSX } from "../builder/site-plan.mjs";
import { EDIT_FIELDS, mergeLook, currentStateNote } from "../builder/site-edit.mjs";
import { LANE_FIELDS, DISPATCHED_LANES, laneLayer } from "../builder/site-lanes.mjs";
import { validatePages, tsxDirective, briefWithLayout, SITE_PAGES_TOOL } from "../builder/page-gen.mjs";
import { readSchemaTool } from "./integration/schema-tool.mjs";

const PAGE = 'import { createFileRoute } from "@tanstack/react-router";\nexport const Route = createFileRoute("/")({ component: P });\nfunction P(){ return null }';

const worker = readFileSync("worker.js", "utf8");
const server = readFileSync("builder/build-server.mjs", "utf8");
const vite = readFileSync("builder/lovable/template/vite.config.ts", "utf8");

/** Prose here argues about the very names being scanned for. Blank it, length-preserving. */
const bare = (s) => s.split("\n").map((l) => (/^\s*(?:\/\/|\*|\/\*)/.test(l) ? " ".repeat(l.length) : l)).join("\n");

/* ── the design half ────────────────────────────────────────────────────── */

test("the design step asks what the kit could not do, and it is OPTIONAL", async () => {
  const { tool } = await readSchemaTool();
  const p = tool.input_schema.properties;
  assert.ok(p.tsx, "the design step no longer asks for components the kit has not got");
  assert.equal(p.tsx.type, "array");
  // OPTIONAL IS THE OWNER'S CALL ("put it as optional") and it is also what keeps
  // this from being a quota: a compelled field is one a model must answer, and a
  // model that must answer invents a component for a site that needed none.
  assert.ok(!tool.input_schema.required.includes("tsx"),
    "declaring missing components is now compelled, so every build will invent one");
});

test("it is answered IMMEDIATELY after the component manifest", async () => {
  // The owner's placement, and the reason it matters: property order is
  // generation order, so this is answered by a model that has JUST searched the
  // kit and come up short. Earlier, it is a wish list written before the search.
  const { tool } = await readSchemaTool();
  const order = Object.keys(tool.input_schema.properties);
  const c = order.indexOf("components");
  const t = order.indexOf("tsx");
  assert.ok(c >= 0, "`components` is gone, so 'after the components step' asserts nothing");
  assert.ok(t >= 0, "`tsx` is not on the tool at all");
  assert.equal(t, c + 1, "`tsx` is no longer directly after `components` — something was inserted between them");
});

test("an entry carries the three things the page writer needs to call it", () => {
  assert.deepEqual(Object.keys(TSX_ITEM.properties).sort(), ["does", "name", "props"]);
  assert.deepEqual([...TSX_ITEM.required].sort(), ["does", "name", "props"],
    "a component may now be declared without one of its three, and `props` missing is a page that cannot call it");
  // A CEILING, NEVER A FLOOR — a floor is a quota and a model fills a quota.
  assert.ok(TSX_FIELD.description.includes(String(MAX_TSX)), "the cap is not stated to the model");
  assert.doesNotMatch(TSX_FIELD.description, /\bat least\b|\bminimum\b/i, "the field states a floor");
  // AND THE EXPENSIVE MISTAKE IS NAMED. The kit is 2,112 components under names
  // that are often not the obvious ones; a duplicate is paid for, written, and
  // worse than the component it duplicates.
  assert.match(TSX_FIELD.description, /SEARCH FIRST/, "nothing tells the model to look in the kit before declaring a gap");
});

/* ── the chain: declared → stored → sent → instructed → returned → written ── */

test("THE CHAIN, END TO END — every hop between declaring a component and writing one", async () => {
  // ── 1. the design step can produce it
  const { tool } = await readSchemaTool();
  assert.ok(tool.input_schema.properties.tsx, "hop 1: the design step cannot declare a component");

  // ── 2. the merge carries it, so it is STORED rather than discarded
  //      (this is the exact hop `three` was missing)
  assert.ok(EDIT_FIELDS.includes("tsx"), "hop 2: `tsx` is not on EDIT_FIELDS, so mergeLook drops every declaration");
  const declared = [{ name: "seat-map", does: "the room, seat by seat", props: "rows: Seat[]" }];
  assert.deepEqual(mergeLook(null, { tsx: declared }, null, {}).tsx, declared,
    "hop 2: a declaration the designer made does not survive the merge");

  // ── 3. the worker hands the stored list to the page-generation call
  const w = bare(worker);
  assert.match(w, /tsx: Array\.isArray\(look\.tsx\) \? look\.tsx : undefined/,
    "hop 3: the stored declarations never leave the look — the page writer is never told");
  // ANCHORED ON THE PROPERTY, NOT THE ARGUMENT LIST (re-anchored 2026-08-29,
  // hours after being written). This pinned the exact call `briefWithLayout({
  // brief, plan, tsx, images: imgBrief })` and went red the moment two honest
  // arguments joined it — reporting that the page directive had stopped being
  // given `tsx`, which nobody had done. Written as a guard against the wiring
  // trap and immediately committing this repo's OTHER most-repeated one; the
  // lesson is that "assert the property, not the spelling" applies hardest to
  // the guards you write for yourself.
  //
  // The property: the page directive is built by a call that is handed `tsx`.
  const callAt = w.indexOf("briefWithLayout({");
  assert.ok(callAt > 0, "hop 3: nothing builds the page directive at all");
  const call = w.slice(callAt, w.indexOf(")", callAt));
  assert.match(call, /\btsx\b/,
    "hop 3: the payload carries `tsx` and the page directive is built without it");

  // ── 4. `buildAndPublishPages` actually destructures it
  //      (a key passed and not destructured is a ReferenceError, and there is a
  //      standing guard for exactly that in test/build-params.test.mjs)
  const sig = w.slice(w.indexOf("async function buildAndPublishPages"), w.indexOf("async function buildAndPublishPages") + 600);
  assert.match(sig, /\btsx\b/, "hop 4: buildAndPublishPages is passed `tsx` and never takes it");

  // ── 5. the directive turns a declaration into an instruction
  const directive = tsxDirective(declared);
  assert.ok(directive, "hop 5: declarations produce no instruction, so the page writer is told nothing");
  assert.match(directive, /seat-map/, "hop 5: the component's name never reaches the writer");
  assert.match(directive, /rows: Seat\[\]/, "hop 5: the props never reach the writer, so the page cannot call it");
  // THE IMPORT PATH IS STATED, NOT INFERRED. These do not live where kit
  // components live, and a model that guesses `@/components/ui/<name>` writes a
  // page that does not compile.
  assert.match(directive, /@\/routes\/-parts\/seat-map/, "hop 5: the writer is not told where to import it from");
  // …and it is actually in the brief the model receives.
  const brief = briefWithLayout({ brief: "a theatre", tsx: declared });
  assert.match(brief, /seat-map/, "hop 5: the directive exists and is never joined into the brief");

  // ── 6. the tool gives the writer somewhere to put it
  assert.ok(SITE_PAGES_TOOL.input_schema.properties.parts,
    "hop 6: the writer is asked for components and the tool has nowhere to return them");

  // ── 7. the answer is read back out, apart from the pages
  const v = validatePages({ pages: [{ path: "index.tsx", source: PAGE }],
    parts: [{ name: "seat-map", source: "export default function S(){return null}" }] });
  assert.deepEqual(v.parts, [{ name: "seat-map", source: "export default function S(){return null}" }],
    "hop 7: the components the model wrote are not read off the tool answer");
  assert.equal(v.pages.length, 1, "hop 7: a component leaked into the page list");

  // ── 8. they reach the container, and 9. they are stored for every later publish
  assert.match(w, /parts: \(builtParts && builtParts\.length\) \? builtParts : undefined/,
    "hop 8: the build never sends the components to the container");
  assert.match(w, /await saveSiteParts\(env, slug, partsBuilt\)/,
    "hop 9: the components are never stored, so the next cheap edit publishes without them");
  // The spine now PREFERS the parts an edit hands it and reads the stored
  // list back only when handed none (2026-09-02, the tsx lane's fix - see
  // edit-parts.test.mjs for that half), so this is pinned to the read-back
  // and not to it being the whole expression.
  assert.match(w, /const siteParts = [^;\n]*await loadSiteParts\(env, slug\)/,
    "hop 9: the publish spine never reads them back");
  assert.match(w, /parts: siteParts \|\| undefined/,
    "hop 9: the spine reads the components and does not send them — the first typo fix breaks the site");
});

/* ── where the files land, which is two independent requirements ─────────── */

test("a component is NOT published as a route, and the prefix is ours rather than borrowed", () => {
  // `-` is the only thing standing between a half-written component and a public
  // URL. @tanstack/router-generator defaults `routeFileIgnorePrefix` to "-", and
  // a default in somebody else's package is a rule that can move on a patch bump
  // with nothing here to notice — this repo's "a rule true because of a layer
  // below it" trap. Pinned in our own config, an upstream rename is a build
  // failure instead of a leak.
  assert.match(vite, /routeFileIgnorePrefix:\s*"-"/,
    "the ignore prefix is no longer pinned, so components could be published as pages on an upstream change");
});

test("…and it lands where the container actually wipes between builds", () => {
  const s = bare(server);
  // THE CONTAINER IS LONG-LIVED AND SHARED. `resetRoutes` restores `src/routes`
  // and nothing else, so a component written anywhere else is in every later
  // customer's site — the leak this container's own comments already name.
  assert.match(s, /function safePart\(/, "there is no dedicated path builder for a component");
  assert.match(s, /path\.join\("-parts", n \+ "\.tsx"\)/,
    "components no longer land under `-parts`, so they are either published as routes or left outside the reset");
  const reset = s.slice(s.indexOf("function resetRoutes()"), s.indexOf("function resetRoutes()") + 400);
  assert.ok(reset.length > 100, "resetRoutes is gone — this check would scan nothing");
  assert.match(reset, /rmSync\(ROUTES/, "resetRoutes no longer wipes the routes directory, so `-parts` survives into the next build");
});

test("…and the render check does not open it as a page: `routePaths()` honours the router's ignore prefix", () => {
  // Every addon reply on fretwork-1 from run 22 to run 36 (2026-09-04) told the
  // customer "3 pages threw an error" — the three `-parts/` components, which
  // `routePaths()` offered to the render check as routes and which answered
  // the 404 the router rightly gives them. DRIVEN, not read: the walk is
  // lifted out of the build server and run over a fake tree, because the
  // property is what the list CONTAINS, and a `startsWith("-")` in the source
  // says nothing about where in the loop it sits.
  const at = server.indexOf("function routePaths() {");
  const end = server.indexOf("\n}\n", at);
  assert.ok(at > 0 && end > at, "routePaths is gone or moved — this test drives nothing");
  const make = new Function("fs", "path", "routeOf", "ROUTES", server.slice(at, end + 2) + "\nreturn routePaths;");
  const tree = {
    "/r": ["-parts", "-draft.tsx", "$id.tsx", "__root.tsx", "es", "gear.tsx", "index.tsx"],
    "/r/-parts": ["chord-diagram.tsx", "day-space-lookup.tsx", "run-tally.tsx"],
    "/r/es": ["gear.tsx", "index.tsx"],
  };
  const fakeFs = {
    readdirSync: (d) => { if (!Object.hasOwn(tree, d)) throw new Error("ENOENT " + d); return tree[d]; },
    statSync: (p) => ({ isDirectory: () => Object.hasOwn(tree, p) }),
  };
  const routes = make(fakeFs, path, routeOf, "/r")();
  assert.deepEqual([...routes].sort(), ["/", "/es", "/es/gear", "/gear"],
    "the routes the check opens are not the router's: " + JSON.stringify(routes));
  // The property, stated on its own: nothing the router ignores is opened —
  // not a directory of components, not a stray `-` file — and nothing the
  // router serves is skipped.
  assert.ok(!routes.some((r) => /parts|draft/.test(r)), "a `-`-prefixed name is offered as a route: " + JSON.stringify(routes));
  assert.ok(routes.includes("/es/gear"), "a nested real route is dropped with the ignored ones");
  // And the walk still refuses what it always refused — a dynamic segment and
  // the root layout — so this is an addition to the filter, not a rewrite.
  assert.ok(!routes.some((r) => r.includes("$")), "a $ route is offered");
});

test("a name is validated, never a path — there is no traversal surface at all", () => {
  const s = bare(server);
  const fn = s.slice(s.indexOf("function safePart("), s.indexOf("function resetRoutes()"));
  assert.ok(fn.length > 50, "safePart is gone or moved — this window scans nothing");
  // A NAME IN, A PATH OUT. `safeRoute` next door takes a path and has to defend
  // against `..`; this takes a bare kebab-case name and cannot express one.
  assert.match(fn, /\^\[a-z\]\[a-z0-9\]\*\(\?:-\[a-z0-9\]\+\)\*\$/,
    "safePart no longer restricts the name to kebab-case, which is what makes a path impossible to smuggle in");
});

test("a badly-named or empty component is a stated problem, not a silent skip", () => {
  // The `pages` lesson: dropped quietly, a component that never arrives shows up
  // as a page importing a module that is not there, and `tsc` blames the PAGE.
  const v = validatePages({
    pages: [{ path: "index.tsx", source: PAGE }],
    parts: [
      { name: "../escape", source: "x" },
      { name: "fine", source: "   " },
      { name: "twice", source: "a" },
      { name: "twice", source: "b" },
    ],
  });
  assert.deepEqual(v.parts.map((p) => p.name), ["twice"], "a refused component was kept, or a good one dropped");
  assert.equal(v.parts[0].source, "a", "the duplicate replaced the first rather than being ignored");
  // COUNTED OVER THE COMPONENT PROBLEMS ONLY. The page half of this fixture is
  // deliberately valid, but a page problem appearing here later must not be able
  // to satisfy this count — that would let a silently-skipped component pass.
  const partProblems = v.problems.filter((x) => /component|usable component name/.test(x));
  assert.equal(partProblems.length, 3, "a refused component was skipped without saying so: " + JSON.stringify(v.problems));
  for (const [needle, why] of [["not a usable component name", "a bad name"], ["no code in it", "an empty component"], ["written twice", "a duplicate"]]) {
    assert.ok(partProblems.some((p) => p.includes(needle)), why + " is refused with nothing said about it");
  }
});

/* ── the edit half ──────────────────────────────────────────────────────── */

test("the lane dispatches to the page rung — a component is source, not a stored value", () => {
  assert.ok(LANE_FIELDS.includes("tsx"), "there is no `tsx` lane, so a hand-written component can never be changed");
  assert.ok(DISPATCHED_LANES.includes("tsx"), "the `tsx` lane no longer dispatches");
  assert.equal(laneLayer("tsx"), "page", "changing a hand-written component no longer reaches the rung that rewrites code");
});

test("the designer is shown the components the site already has", () => {
  // THE SHARPEST CASE ON THAT NOTE. The pages IMPORT these by name, so a designer
  // that re-answers `tsx` without one does not merely churn: the component stops
  // being written and the page importing it stops compiling.
  const note = currentStateNote({ tsx: [{ name: "seat-map", does: "the room, seat by seat", props: "rows: Seat[]" }] });
  assert.ok(note, "a site with hand-written components gets no current-state note");
  assert.match(note, /seat-map/, "the designer is never told which components the site had written for it");
  assert.match(note, /import these by name/, "the note does not say why losing one matters");
});
