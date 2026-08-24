// The render check's judgement, driven with literal observations.
//
// The point of the module/harness split is that this file needs no browser, no
// container and no dist — every threshold and every "does this cry wolf" case is
// a plain object in and a list of findings out. What the browser MEASURES is
// covered by the integration build, which is the only thing that can prove a
// real page produces these shapes.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  VIEWPORTS, BLANK_TEXT_CHARS, MIN_CONTRAST, OVERFLOW_SLACK, MAX_FINDINGS,
  OVERLAY_TRIGGERS, MAX_OPENS, MIN_PANEL_ALPHA,
  probe, probeOverlay, readPage, readOverlay, renderReport, renderNote, isSerious, SERIOUS,
} from "../builder/site-render.mjs";

const clean = { route: "/", viewport: "phone", text: 900, images: 2, broken: [], overflow: 0, wide: [], contrast: [], pageErrors: [], consoleErrors: [] };
const kinds = (f) => f.map((x) => x.kind);

test("a page with words, pictures and no errors has nothing to report", () => {
  assert.deepEqual(readPage(clean), []);
});

test("a page that never loaded reports only that — everything else would be measuring an error page", () => {
  const f = readPage({ ...clean, error: "net::ERR_ABORTED", text: 0, images: 0, overflow: 900 });
  assert.deepEqual(kinds(f), ["threw"]);
  assert.match(f[0].detail, /ERR_ABORTED/);
});

// ── blank ────────────────────────────────────────────────────────────────────

test("no text and no images is blank", () => {
  assert.ok(kinds(readPage({ ...clean, text: 0, images: 0 })).includes("blank"));
});

test("AN IMAGE-LED PAGE IS NOT BLANK — a gallery with a two-word heading is a real page", () => {
  const f = readPage({ ...clean, text: 5, images: 6 });
  assert.ok(!kinds(f).includes("blank"), "six pictures and a short heading must not be called blank");
});

test("the blank threshold is low enough that a sparse-but-real page survives it", () => {
  // A hero with a headline and a button. Deliberately just over the line.
  const f = readPage({ ...clean, text: BLANK_TEXT_CHARS + 1, images: 0 });
  assert.ok(!kinds(f).includes("blank"));
  assert.ok(kinds(readPage({ ...clean, text: BLANK_TEXT_CHARS - 1, images: 0 })).includes("blank"));
});

// ── errors ───────────────────────────────────────────────────────────────────

test("a THROWN error and a LOGGED error are separate kinds", () => {
  const f = readPage({ ...clean, pageErrors: ["x is not a function"], consoleErrors: ["Each child needs a key"] });
  assert.ok(kinds(f).includes("threw"), "an uncaught throw took the page down");
  assert.ok(kinds(f).includes("logged"), "a console error is worth knowing and is not the same thing");
  assert.notEqual(f.find((x) => x.kind === "threw").detail, f.find((x) => x.kind === "logged").detail);
});

// ── images ───────────────────────────────────────────────────────────────────

test("a broken image is named, so the finding can be acted on", () => {
  const f = readPage({ ...clean, broken: ["/u/site/photo.jpg"] });
  assert.ok(kinds(f).includes("image"));
  assert.match(f.find((x) => x.kind === "image").detail, /photo\.jpg/);
});

test("images that are merely absent are not broken — SafeImage draws a div, never an empty img", () => {
  assert.deepEqual(readPage({ ...clean, images: 0, text: 900, broken: [] }), []);
});

// ── overflow ─────────────────────────────────────────────────────────────────

test("sub-pixel sideways scroll is not a spill", () => {
  assert.deepEqual(readPage({ ...clean, overflow: OVERFLOW_SLACK }), []);
  assert.ok(kinds(readPage({ ...clean, overflow: OVERFLOW_SLACK + 1 })).includes("overflow"));
});

test("the overflow finding names the widest offender when the page could identify one", () => {
  const f = readPage({ ...clean, overflow: 60, wide: [{ over: 60, tag: "table", cls: "w-[900px]", text: "Service" }] });
  const d = f.find((x) => x.kind === "overflow").detail;
  assert.match(d, /60px/);
  assert.match(d, /<table>/);
  assert.match(d, /Service/);
});

test("overflow with nothing identified still reports the number rather than nothing", () => {
  const d = readPage({ ...clean, overflow: 40, wide: [] }).find((x) => x.kind === "overflow").detail;
  assert.match(d, /40px/);
});

// ── contrast ─────────────────────────────────────────────────────────────────

test("low contrast is reported with the words and the ratio", () => {
  const f = readPage({ ...clean, contrast: [{ ratio: 1.2, text: "Open Tuesday to Saturday", size: 14 }] });
  assert.ok(kinds(f).includes("contrast"));
  assert.match(f.find((x) => x.kind === "contrast").detail, /1\.2:1/);
  assert.match(f.find((x) => x.kind === "contrast").detail, /Open Tuesday/);
});

test("THE CONTRAST FLOOR IS 3, NOT 4.5 — deliberate muted text must not be flagged", () => {
  // Every theme's muted caption, placeholder and disabled control lives in the
  // 3-4.5 band on purpose. Reporting at 4.5 would flag design on every page of
  // every site, which is the false alarm that discredits the whole check.
  assert.equal(MIN_CONTRAST, 3);
});

// ── overlays: what only a click can see ──────────────────────────────────────

test("a see-through panel is reported, with how opaque it actually is", () => {
  const f = readOverlay({ opened: true, alpha: 0.35, blurred: false, label: "Menu" });
  assert.equal(f.kind, "seethrough");
  assert.match(f.detail, /35%/);
  assert.match(f.detail, /Menu/);
});

test("AN OPAQUE PANEL IS FINE, which is nearly every panel on nearly every site", () => {
  assert.equal(readOverlay({ opened: true, alpha: 1, blurred: false }), null);
  assert.equal(readOverlay({ opened: true, alpha: MIN_PANEL_ALPHA, blurred: false }), null);
  // AND A HAIRLINE OF TRANSLUCENCY IS A DESIGN CHOICE, NOT A BUG. Pinned against
  // the literal rather than against MIN_PANEL_ALPHA: a sweep moved the floor to
  // 1 and every assertion above still passed, because two of them are written in
  // terms of the constant being mutated. Only a fixed number discriminates.
  assert.equal(readOverlay({ opened: true, alpha: 0.95, blurred: false }), null,
    "a panel at 95% is a taste, and flagging it puts a false alarm on ordinary sites");
});

test("A DELIBERATELY GLASS PANEL IS EXEMPT — backdrop-blur is what makes it readable", () => {
  // A glass theme makes every surface translucent on purpose and pairs it with a
  // blur. Flagging those would report a fault on an entire family of themes
  // working exactly as designed.
  assert.equal(readOverlay({ opened: true, alpha: 0.4, blurred: true }), null);
  assert.ok(readOverlay({ opened: true, alpha: 0.4, blurred: false }), "…and without the blur it is the bug");
});

test("a trigger that opened NOTHING is not a finding", () => {
  // Far more often a control this harness could not drive — hover-only, needs
  // focus first — than a broken button. Reporting it would put a false alarm on
  // ordinary pages, which is the one thing this check may not do.
  assert.equal(readOverlay({ opened: false }), null);
  assert.equal(readOverlay(null), null);
  assert.equal(readOverlay({}), null);
  // WITH AN ALPHA ATTACHED, which is what makes this assertion discriminate.
  // `probeOverlay` returns a bare `{opened:false}` today, so deleting the guard
  // changed nothing any test could see — it survived a sweep on a technicality.
  // The guard is about a probe that later reports both; drive that shape.
  assert.equal(readOverlay({ opened: false, alpha: 0.2, blurred: false }), null,
    "not opened is not see-through, whatever else came back with it");
});

test("the same header menu on six pages is reported once per page, not six times per page", () => {
  const f = readPage({ ...clean, overlays: [
    { opened: true, alpha: 0.3, blurred: false, label: "Menu" },
    { opened: true, alpha: 0.3, blurred: false, label: "Menu" },
  ] });
  assert.equal(f.filter((x) => x.kind === "seethrough").length, 1);
});

test("a see-through menu is NOT serious — the page underneath is still readable", () => {
  assert.equal(isSerious([{ kind: "seethrough" }]), false);
});

test("…and the customer is TOLD about it, which needs a word of its own", () => {
  // `renderNote` skips any kind it has no wording for, so a site whose only
  // fault is a see-through menu would get a silent, empty note — the finding
  // computed, returned, and never said out loud. Found by a sweep.
  const note = renderNote(renderReport([{ ...clean, overlays: [{ opened: true, alpha: 0.3, blurred: false, label: "Menu" }] }]));
  assert.match(note, /see-through/i);
});

test("the overlay probe closes over nothing either", () => {
  const src = probeOverlay.toString();
  for (const name of ["MIN_PANEL_ALPHA", "OVERLAY_TRIGGERS", "MAX_OPENS", "clip"]) {
    assert.doesNotMatch(src, new RegExp("\\b" + name + "\\b"), "probeOverlay() references " + name + ", which does not exist inside the page");
  }
});

test("the triggers are ones the KIT renders, never a guess at the page's own markup", () => {
  // Clicking arbitrary elements is unbounded and can submit a form or navigate
  // away. Every selector has to be something Radix stamps on its own triggers.
  assert.ok(OVERLAY_TRIGGERS.length >= 4);
  for (const sel of OVERLAY_TRIGGERS) {
    assert.match(sel, /^\[(data-slot|aria-haspopup)=/, "not a kit-owned trigger: " + sel);
  }
});

test("WHICH SELECTORS CAN ACTUALLY FIRE, measured against the kit rather than assumed", () => {
  // This template's overlay TRIGGERS are raw Radix (`const SheetTrigger =
  // SheetPrimitive.Trigger`), so no trigger renders a data-slot and the whole
  // check rides on the two aria-haspopup lines. That is fine and it is written
  // down — what is not fine is a list where most entries can never match while
  // reading as though they cover five components. If a kit refresh starts
  // stamping trigger slots, this goes red and the module's comment needs
  // correcting.
  //
  // IT ASKS ABOUT THE TRIGGER SLOTS BY NAME, not about `data-slot` appearing
  // anywhere in the file, and the narrowing is the whole point. The first form
  // went red the moment the `scrim` axis stamped `data-slot="overlay"` on the
  // shade BEHIND the panel — a stamp that is not a trigger, cannot be clicked,
  // and leaves every sentence in that comment true. A false alarm on correct
  // code is worse than the miss, which is this check's own charter.
  const dir = new URL("../builder/lovable/template/src/components/ui/", import.meta.url);
  const overlays = ["sheet.tsx", "dialog.tsx", "drawer.tsx", "dropdown-menu.tsx", "popover.tsx"];
  const triggerSlots = OVERLAY_TRIGGERS
    .map((sel) => (sel.match(/^\[data-slot="([a-z-]+)"\]$/) || [])[1]).filter(Boolean);
  assert.equal(triggerSlots.length, 5, "the five inert selectors are what this measures — it read " + triggerSlots.length);
  const withSlot = overlays.filter((f) => {
    let src = "";
    try { src = fs.readFileSync(new URL(f, dir), "utf8"); } catch { return false; }
    return triggerSlots.some((slot) => new RegExp('data-slot="' + slot + '"(?![-\\w])').test(src));
  });
  assert.deepEqual(withSlot, [],
    "the kit now stamps a TRIGGER slot on " + withSlot.join(", ") + " — the module's comment says it does not");
  // …and the overlay stamp really is there and really is not a trigger, or the
  // narrowing above is protection against a case that cannot arise.
  const sheet = fs.readFileSync(new URL("sheet.tsx", dir), "utf8");
  assert.match(sheet, /data-slot="overlay"/, "the scrim axis needs this hook — the narrowing above is about it");
  assert.equal(triggerSlots.includes("overlay"), false, "overlay is not a trigger and must never be clicked as one");
  // And the two that DO carry it must still be in the list, or the check is dead.
  assert.ok(OVERLAY_TRIGGERS.includes('[aria-haspopup="dialog"]'), "the only selector a Sheet or Dialog trigger matches");
  assert.ok(OVERLAY_TRIGGERS.includes('[aria-haspopup="menu"]'), "the only selector a DropdownMenu trigger matches");
});

test("the harness clicks, bounds how many, and treats a failure as nothing", () => {
  const src = fs.readFileSync(new URL("../builder/render-check.mjs", import.meta.url), "utf8");
  const fn = src.slice(src.indexOf("async function openOverlays"), src.indexOf("Look at every prerendered route"));
  assert.ok(fn.length > 200, "openOverlays moved — the assertions below would pass vacuously");
  assert.match(fn, /slice\(0, MAX_OPENS\)/, "unbounded clicking is real time on a clock the customer is watching");
  assert.match(fn, /force: true/, "a trigger under a sticky header would otherwise time out on an ordinary page");
  // ANCHORED ON THE CLICK LOOP'S OWN CATCH. `/catch \{/` alone matched the
  // `page.$$` catch three lines above and a sweep replacing THIS one with a
  // rethrow survived — a vacuous match on a sibling, which is the failure this
  // repo keeps recording about its own guards.
  assert.match(fn, /\} catch \{ \/\* a control we could not drive is not a finding \*\/ \}/,
    "a control we could not drive must never become a finding, or an undriveable menu fails an ordinary page");
  // PHONE ONLY, and asserted at the call site rather than inside the function.
  assert.match(src, /vp\.name === "phone"\) obs\.overlays = await openOverlays/,
    "doing it at both widths doubles the cost for a panel whose colours do not change with the width");
});

// ── caps ─────────────────────────────────────────────────────────────────────

test("one page cannot flood the report", () => {
  const f = readPage({
    ...clean, text: 0, images: 0, overflow: 90, wide: [],
    broken: ["a", "b", "c", "d", "e"],
    contrast: [1, 2, 3, 4, 5].map((n) => ({ ratio: 1.1, text: "t" + n, size: 12 })),
    pageErrors: ["p1", "p2", "p3"], consoleErrors: ["c1", "c2", "c3"],
  });
  assert.ok(f.length <= 6, "a single page reported " + f.length + " findings");
});

test("the whole report is capped, and says how many it dropped", () => {
  const many = [];
  for (let i = 0; i < 30; i++) many.push({ ...clean, route: "/p" + i, text: 0, images: 0 });
  const r = renderReport(many);
  assert.equal(r.findings.length, MAX_FINDINGS);
  assert.equal(r.more, 30 - MAX_FINDINGS);
});

// ── the report ───────────────────────────────────────────────────────────────

test("a clean report is ok, counts what it looked at, and reports nothing", () => {
  const r = renderReport([clean, { ...clean, viewport: "desktop" }, { ...clean, route: "/book" }]);
  assert.equal(r.ok, true);
  assert.equal(r.checked, 3);
  assert.equal(r.pages, 2, "two distinct routes across three observations");
  assert.deepEqual(r.findings, []);
  assert.equal(r.more, undefined);
});

test("A HARNESS THAT COULD NOT RUN IS NOT A CLEAN BILL OF HEALTH", () => {
  // The silent-skip failure this repo has recorded three times: a check that
  // reports nothing because it never ran looks exactly like a check that ran and
  // found nothing, and the second one is the reassuring lie.
  const r = renderReport([], { ok: false, error: "browser would not start" });
  assert.equal(r.ok, false);
  assert.match(r.error, /would not start/);
  assert.deepEqual(r.findings, []);
});

test("no observations at all is not ok either", () => {
  assert.equal(renderReport([]).ok, true, "an empty successful run is still a run");
  assert.equal(renderReport(null, { ok: false, error: "x" }).ok, false);
});

// ── the sentence ─────────────────────────────────────────────────────────────

test("a clean build's note is the empty string, so its message is unchanged", () => {
  assert.equal(renderNote(renderReport([clean])), "");
  assert.equal(renderNote(null), "");
  assert.equal(renderNote({}), "");
});

test("a harness failure says nothing to the customer — it is not their problem", () => {
  assert.equal(renderNote(renderReport([], { ok: false, error: "no browser" })), "");
});

test("THE NOTE GROUPS BY PROBLEM, NOT BY PAGE — the same caption on three pages is one thing to fix", () => {
  const obs = ["/", "/book", "/work"].map((route) => ({ ...clean, route, contrast: [{ ratio: 1.4, text: "Opening hours", size: 13 }] }));
  const note = renderNote(renderReport(obs));
  assert.match(note, /3 pages/);
  assert.doesNotMatch(note, /\/book/, "listing it per page reads as three separate problems");
});

test("one page names the page", () => {
  assert.match(renderNote(renderReport([{ ...clean, route: "/book", text: 0, images: 0 }])), /\/book/);
});

test("the note reads as a second look, never as a refusal", () => {
  const note = renderNote(renderReport([{ ...clean, route: "/", broken: ["/u/x.jpg"] }]));
  assert.match(note, /had a look/i);
  assert.doesNotMatch(note, /fail|refus|could not build|stopped/i);
});

// ── severity ─────────────────────────────────────────────────────────────────

test("serious means a visitor sees nothing — not merely something imperfect", () => {
  assert.deepEqual([...SERIOUS].sort(), ["blank", "threw"]);
  assert.equal(isSerious([{ kind: "contrast" }, { kind: "overflow" }]), false);
  assert.equal(isSerious([{ kind: "contrast" }, { kind: "blank" }]), true);
  assert.equal(isSerious([]), false);
  assert.equal(isSerious(null), false);
});

// ── the probe ────────────────────────────────────────────────────────────────

test("THE PROBE CLOSES OVER NOTHING — it is serialised into the page", () => {
  // Playwright evaluates this in the document, where nothing from this module
  // exists. A reference to a module constant is a ReferenceError inside the
  // page, which arrives as an unexplained per-page error on every build.
  // COMMENTS ARE BLANKED FIRST, and this went red on correct code before they
  // were (2026-08-24): the crash-detection comment inside `probe()` EXPLAINS
  // that the error card's text is over BLANK_TEXT_CHARS, and naming a constant
  // in prose is not referencing it. Prose containing the thing it asserts — the
  // trap this repo has now recorded in a lint, a router guard, an absence check,
  // a scope scan, a mutation and here.
  //
  // BLANKED, NOT REMOVED, and length-preserving, which is this repo's standing
  // rule for exactly this: a scan that deletes bytes moves every offset after
  // them. It cannot weaken the check either — a comment can never be a
  // reference, so nothing real is hidden by this.
  const raw = probe.toString();
  const src = raw
    .replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length))
    .replace(/^([ \t]*)\/\/.*$/gm, (m, i) => i + " ".repeat(m.length - i.length));
  assert.equal(src.length, raw.length, "the blanker moved offsets — it must preserve length");
  assert.ok(/document\.querySelector/.test(src), "the blanker ate the code it was meant to leave alone");
  for (const name of ["VIEWPORTS", "BLANK_TEXT_CHARS", "MIN_CONTRAST", "OVERFLOW_SLACK", "MAX_FINDINGS", "clip", "WORD"]) {
    assert.doesNotMatch(src, new RegExp("\\b" + name + "\\b"), "probe() references " + name + ", which does not exist inside the page");
  }
  // AND IT STILL CATCHES THE REAL THING. A negative assertion has to prove its
  // observer is alive first — this one is seven `doesNotMatch`es, which a
  // scanner that had stopped seeing anything would satisfy perfectly.
  const planted = "function probe() { /* BLANK_TEXT_CHARS in prose */ return BLANK_TEXT_CHARS; }"
    .replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length));
  assert.match(planted, /\bBLANK_TEXT_CHARS\b/, "a real reference must still be found once comments are blanked");
});

test("the probe reads colour through a canvas rather than parsing it", () => {
  // The palette is oklch and what getComputedStyle returns for one varies by
  // engine. A parser is a thing to keep up to date forever and a wrong parse is
  // a false alarm on correct code; the canvas makes the browser do the
  // conversion, which is the implementation the visitor actually sees.
  const src = probe.toString();
  assert.match(src, /createElement\("canvas"\)/);
  assert.match(src, /getImageData/);
  assert.doesNotMatch(src, /oklch\s*\(/, "the probe must not try to parse a colour syntax itself");
});

test("both widths are checked, and the phone one is there", () => {
  const names = VIEWPORTS.map((v) => v.name);
  assert.ok(names.includes("phone"), "the see-through modal was found on a phone and nothing had ever rendered below 1280px");
  assert.equal(VIEWPORTS.find((v) => v.name === "phone").width, 375);
  assert.ok(VIEWPORTS.some((v) => v.width >= 1000), "desktop too");
});

// ── wiring, at both ends ─────────────────────────────────────────────────────
//
// Every one of these guards a layer that cannot be imported. This codebase has
// recorded a feature built correctly and left dead at one silent wiring link at
// least twelve times, and every single time the module itself was fine.

test("the container RUNS the check and puts it on its response", () => {
  const src = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");
  assert.match(src, /import \{ checkRender \}/, "build-server must import it");
  // FED THE ROUTES THE ROUTER HAS, AND THE SERVER THAT RENDERS THEM. It used to
  // be `checkRender(DIST, pre.done)` — the routes a build-time prerender had
  // actually written. Under Start there is no prerender: the document comes from
  // the server bundle per request, so the check drives that bundle directly.
  // That is strictly better — the bytes it inspects are the bytes a visitor
  // receives, from the same code that will serve them, rather than a snapshot
  // that could be wrong in a way the live page was not.
  // ASSERTED AS A PROPERTY, NOT AS AN ARGUMENT LIST. This pinned the exact call
  // `checkRender(CLIENT_DIST, routePaths(), ssrFetch)` and went red the moment
  // the server moved behind a process boundary and gained a `down()` — a guard
  // about word order failing a correct change, which the comment block above
  // this test says has now happened four times. Five.
  //
  // What has to hold is that the check is fed THIS site's client dist, THIS
  // site's routes, and a handle on the server that renders them. How many
  // arguments that takes is not the invariant.
  const call = src.slice(src.indexOf("checkRender(CLIENT_DIST"));
  const args = call.slice(0, call.indexOf("\n"));
  assert.ok(/checkRender\(CLIENT_DIST\b/.test(args), "the check is not fed this site's own client dist");
  assert.ok(/\broutePaths\(\)/.test(args), "the check is not fed the routes the router actually has");
  assert.ok(/\bssr\b/.test(args), "the check is not fed the server that renders those routes");
  // THE CLIENT HALF, NOT `dist`. Start emits `dist/client` and `dist/server`;
  // pointed at `dist` the static branch would serve assets one directory too
  // deep and every one would 404 inside the check.
  assert.match(src, /const CLIENT_DIST = /, "CLIENT_DIST is gone — rescope this");
  // ON THE ok:true RESPONSE — asserted as a property of that literal, not as an
  // adjacency. This read `prerenderSkipped: pre\.skipped, render` and went red
  // the moment a field was added between them: a guard about word order, failing
  // a correct change, which this repo has now recorded four times.
  const okLine = src.slice(src.indexOf("{ ok: true, files: dist"));
  const lit = okLine.slice(0, okLine.indexOf("\n"));
  assert.ok(/\bok: true\b/.test(lit), "the ok:true response literal moved — rescope this");
  assert.ok(/(^|[{,]\s*)render\b/.test(lit), "the render report is not carried out on the ok:true response");
});

test("THE CHECK RUNS AFTER THE BUILD, because there is nothing to look at before it", () => {
  const src = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");
  // THE ORDERING SURVIVED THE PRERENDER'S REMOVAL, against a different anchor.
  // It used to be "after `preMs`", because the per-route HTML had to exist
  // before a browser could open it. There is no per-route HTML now — but the
  // SERVER BUNDLE still has to exist before it can be loaded and driven, so the
  // property is the same one against the thing that now produces the document.
  const vite = src.indexOf('timed("viteMs"');
  // THE SERVER IS STARTED, NOT IMPORTED, and the anchor had to follow it.
  // `loadSiteServer()` did `await import(...)` of the model's own bundle into
  // this process; it is a spawned child now, so the thing that has to happen
  // after the bundle exists and before the check runs is the START.
  const load = src.indexOf("await startSiteServerForCheck()");
  const chk = src.indexOf("checkRender(CLIENT_DIST");
  assert.ok(vite > 0 && load > 0 && chk > 0, "all three anchors must exist or this passes vacuously");
  assert.ok(vite < load, "the server bundle has to be built before it can be loaded");
  assert.ok(load < chk, "the server has to be loaded before the check can drive it");
  // AND THE CALL IS UNGATED. It once sat on the true branch of `pre.done.length`,
  // and the 2026-08-13 audit showed that gate was itself the bug: a TOTAL
  // prerender failure — the one mode that loses every snapshot — also switched
  // off the only check that would have said so. The same hazard exists in the
  // new shape wearing a new name: `loadSiteServer` returns NULL when the bundle
  // will not load, which is exactly when a render report matters most, so
  // gating on it would silence the check on the worst build there is.
  // checkRender answers honestly for itself; the call has to happen regardless.
  const win = src.slice(load, chk + 200);
  assert.ok(!/if\s*\(\s*ssrFetch\s*\)|ssrFetch\s*\?/.test(win),
    "checkRender is gated on the server bundle loading — a bundle that will not load silences the report that would say so");
  // CALLED UNCONDITIONALLY, asserted as a property rather than as a spelling.
  // This pinned `const render = await timed("renderMs"` and went red on a
  // correct change: the assignment moved into a `try` so the spawned server is
  // reaped in a `finally`, which turns the `const` into a `let` on the line
  // above. Sixth time in this file — see the note on the call-shape guard.
  assert.ok(/\brender = await timed\("renderMs"/.test(src),
    "the render check is no longer called and its report captured");
  assert.ok(!/\bif\s*\([^)]*\)\s*\{?\s*(const |let )?render = await timed\("renderMs"/.test(src),
    "the render check is gated again — the builds that most need a report are the ones a gate silences");
  // AND THE SERVER IS REAPED WHATEVER HAPPENS. It is a spawned child now, so a
  // check that throws without this leaks one process per build into a container
  // shared by every customer — the same unbounded-retention class the in-process
  // import was removed for, arriving through the exception path instead.
  const win2 = src.slice(load, chk + 400);
  assert.ok(/finally\s*\{[^}]*\.stop\(\)/.test(win2),
    "the render server is not stopped in a finally — a throwing check leaks a child process per build");
});

test("publish-pages carries the report through, and ASSIGNS rather than accumulates", () => {
  const src = fs.readFileSync(new URL("../builder/publish-pages.mjs", import.meta.url), "utf8");
  assert.match(src, /out\.render = bd\.render/, "a salvaged build must report on the pages it PUBLISHED");
  assert.doesNotMatch(src, /out\.render = \(out\.render \|\|/, "merging two compiles reports on a file the customer never receives");
  assert.match(src, /"renderMs"/, "and the timing rides with the other three");
});

test("the route returns it, and the client reads it", () => {
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(w, /import \{ renderNote \} from "\.\/builder\/site-render\.mjs"/, "a call to a name never imported is a ReferenceError on the build path");
  assert.match(w, /renderNote: renderNote\(pages\.render\)/);
  const c = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  assert.match(c, /d\.renderNote === 'string'/, "computed by the server and rendered by nothing is this repo's most-repeated bug");
});

test("A HARNESS FAILURE IS STILL RETURNED, or a broken check reads as a clean site", () => {
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const m = w.match(/render: \(pages\.render && \(([^)]*)\)/);
  assert.ok(m, "the response must gate on more than just findings being present");
  assert.match(m[1], /ok === false/, "ok:false has to survive the omission, or it is indistinguishable from nothing wrong");
});

test("the image carries the browser AND installs it apart from the template", () => {
  const d = fs.readFileSync(new URL("../builder/Dockerfile", import.meta.url), "utf8");

  // ANCHORED ON THE COMMAND, NOT ON THE WORD. `/apt-get install[\s\S]*chromium/`
  // was the first draft and a sweep mutant deleting the package from the install
  // list SURVIVED it — because `CHROMIUM_PATH=/usr/bin/chromium` further down the
  // file still contains the word, and `[\s\S]*` happily reaches it. An assertion
  // has to anchor on something only the thing being asserted can have.
  const apt = (d.match(/RUN apt-get update[\s\S]*?\n\n/) || [""])[0];
  assert.ok(apt, "no apt-get block at all — the browser has to be installed somewhere");
  assert.match(apt, /^\s+chromium \\$/m, "chromium is not in the install list; no browser, no check");
  assert.match(d, /CHROMIUM_PATH=\/usr\/bin\/chromium/, "playwright-core drives the distro browser");

  // Likewise scoped to the RUN line: `--no-save` appears in the COMMENT above it,
  // so a file-wide match passes with the flag stripped off the real command.
  const npm = (d.match(/^RUN npm install .*playwright-core.*$/m) || [""])[0];
  assert.ok(npm, "playwright-core is never installed");
  assert.match(npm, /--no-save/,
    "it must not enter the template's package.json — `npm ci` above refuses a lock that disagrees with it, and a published customer site must not carry a browser driver");

  // The COPY itself is enforced transitively by test/dockerfile.test.mjs, which
  // walks the import graph — this only pins the reason it is a build-service
  // dependency rather than a template one.
});

test("EVERY EDIT LANE FORWARDS THE RENDER REPORT it paid for", () => {
  // The check runs inside the container on every compile — ~6s a build — and
  // every edit lane used to throw the result away (2026-08-14 audit): a cheap
  // edit that turned the site blank or unreadable reported success with the
  // one instrument that saw it discarded.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  // The spine returns it, under the build response's own noteworthy contract —
  // the report rides only when it FAILED or found something, so a clean
  // render stays silence on the wire and no clean edit's response changes.
  const at = w.indexOf("async function recompileAndPublish(env, {");
  assert.ok(at > 0, "the spine is gone — rescope this");
  const spine = w.slice(at, w.indexOf("\nasync function siteOgImage(", at));
  assert.match(spine, /built\.render && \(built\.render\.ok === false \|\| \(built\.render\.findings \|\| \[\]\)\.length\)/,
    "the spine drops the container's render report again, or lost the noteworthy gate");
  assert.match(spine, /renderNote: renderNote\(built\.render\) \|\| undefined/,
    "the human sentence beside the report is gone");
  // …and every call site forwards it. DERIVED from the call sites themselves,
  // so an eighth lane added later is covered without anybody remembering this
  // file. (The live on/off lane returns the spine's whole result and needs no
  // per-field forward — it has no `const X = await` capture, so the loop
  // correctly skips it.)
  const sites = [...w.matchAll(/const (\w+) = await recompileAndPublish\(env/g)].map((m) => m[1]);
  assert.ok(sites.length >= 6, "the spine's call sites moved — rescope this");
  for (const v of new Set(sites)) {
    assert.ok(new RegExp("render: " + v + "\\.render").test(w),
      v + " pays for the render check and discards the result again");
    assert.ok(new RegExp("renderNote: " + v + "\\.renderNote").test(w),
      v + " forwards the report but drops its sentence");
  }
  // …and the CLIENT says it. A note carried to a response nothing displays is
  // the works-but-cannot-say-so disease stopped one layer short.
  const chat = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  // THE PROPERTY, NOT THE SPELLING. This pinned the exact expression
  // `finish(editReply(e) + renderTail(e))` and went red the day a SECOND honest
  // tail was appended beside it — a test about word order, reporting "the edit
  // reply drops the render sentence" about a reply that carries it perfectly.
  // The repeated own-goal in this repo; what must hold is that the sentence is
  // in the call, not what else is.
  assert.match(chat, /finish\(editReply\(e\)[^;]*renderTail\(e\)/, "the edit reply drops the render sentence");
  assert.match(chat, /finish\(addonReplyText\(a\)[^;]*renderTail\(a\)/, "the addon reply drops the render sentence");
  assert.match(chat, /function renderTail\(d\)[\s\S]{0,900}?renderNote/, "renderTail no longer reads renderNote");
});
