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
  probe, readPage, renderReport, renderNote, isSerious, SERIOUS,
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
  const src = probe.toString();
  for (const name of ["VIEWPORTS", "BLANK_TEXT_CHARS", "MIN_CONTRAST", "OVERFLOW_SLACK", "MAX_FINDINGS", "clip", "WORD"]) {
    assert.doesNotMatch(src, new RegExp("\\b" + name + "\\b"), "probe() references " + name + ", which does not exist inside the page");
  }
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
  assert.match(src, /checkRender\(DIST, pre\.done\)/, "fed the routes prerender actually wrote");
  assert.match(src, /prerenderSkipped: pre\.skipped, render/, "and carried out on the ok:true response");
});

test("THE CHECK RUNS AFTER THE PRERENDER, because there is nothing to look at before it", () => {
  const src = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");
  const pre = src.indexOf("timed(\"preMs\"");
  const chk = src.indexOf("checkRender(DIST");
  assert.ok(pre > 0 && chk > 0, "both anchors must exist or this passes vacuously");
  assert.ok(pre < chk, "the per-route HTML has to exist before a browser can open it");
  // AND THE GUARD IS NOT INVERTED. A sweep mutant flipped it to `!pre.done.length`
  // — the check then runs only when there is nothing to look at, and every
  // successful build reports no render at all. The integration run catches that
  // (a good build must come back `render.ok === true`), and it is worth one cheap
  // line here too, because the wiring layer is the one that keeps going quiet.
  assert.match(src, /const render = pre\.done\.length\s*\n?\s*\?\s*await timed\("renderMs"/,
    "checkRender must sit on the TRUE branch of `pre.done.length`");
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
