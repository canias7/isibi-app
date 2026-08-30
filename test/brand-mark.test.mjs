// The brand mark, and the rule that there is only one of it.
//
// The logo used to be /logo.png in four places and a CSS background in a fifth.
// It is now vector everywhere: public/logo.svg is the canonical file, and any
// document that needs the mark inline carries a copy of that same geometry as
// <defs><g id="gfMark">.
//
// Copies are the whole risk. Chrome refuses <use href> across documents — the
// same reason the pencil filters are inline — so confirm.html cannot reference
// index.html's defs and genuinely needs its own. Two copies of a drawing drift
// silently: nothing errors, the two pages just stop showing the same logo, and
// the only way to notice is to open both and look. So every copy is asserted
// against public/logo.svg, which is the one file a designer would edit.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const PUB = path.join(ROOT, "public");
const read = (f) => fs.readFileSync(path.join(PUB, f), "utf8");

// The geometry, as the drawing primitives inside the mark's own group.
//
// The close has to be found by DEPTH, not by searching for the next (or last)
// </g>. The mark is three nested groups, and index.html carries dozens of other
// inline icons: a flat scan for the closing tag either stops inside the mark or
// — as the first version of this did — runs to the end of the file and compares
// the logo against every icon in the app. The shapes are normalised for
// whitespace, so re-indenting a file is not a failure; the drawing is the
// property.
const geometryOf = (src, label) => {
  const at = src.indexOf('id="gfMark"');
  const from = at >= 0 ? src.lastIndexOf("<g", at) : src.indexOf('<g fill="none" stroke="currentColor"');
  assert.ok(from >= 0, label + " must contain the mark");
  let i = src.indexOf(">", from) + 1, depth = 1, end = -1;
  while (i < src.length && depth > 0) {
    const openTag = src.indexOf("<g", i), closeTag = src.indexOf("</g>", i);
    assert.ok(closeTag >= 0, label + "'s mark group is never closed");
    if (openTag >= 0 && openTag < closeTag) { depth++; i = openTag + 2; continue; }
    depth--; end = closeTag; i = closeTag + 4;
  }
  assert.equal(depth, 0, label + "'s mark group is unbalanced");
  const inner = src.slice(src.indexOf(">", from) + 1, end);
  const shapes = [...inner.matchAll(/<(path|circle|g)\b([^>]*)>/g)]
    .map((m) => m[1] + " " + m[2].replace(/\s+/g, " ").trim());
  assert.equal(shapes.length, 12,
    label + " should carry the mark's twelve primitives (3 groups, 3 arcs, 3 circles, 3 stems), saw " + shapes.length);
  return shapes.join("|");
};

const CANON = read("logo.svg");

test("public/logo.svg is a real, standalone SVG document", () => {
  assert.match(CANON, /^<svg\b/, "it must be an SVG document, not a fragment");
  assert.match(CANON, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/,
    "a standalone SVG needs its namespace or a browser will not render it as an image");
  assert.match(CANON, /viewBox="/, "without a viewBox it cannot scale, which is the point of using SVG");
  assert.equal(/<script|onload=|href="http/i.test(CANON), false,
    "the mark is artwork; it must carry no script and fetch nothing");
});

test("every inline copy of the mark is the same drawing as logo.svg", () => {
  const canon = geometryOf(CANON, "public/logo.svg");
  // Derived from the tree, not a list typed here: a new page that inlines the
  // mark is covered the day it is added.
  const pages = fs.readdirSync(PUB).filter((f) => f.endsWith(".html"));
  const carriers = pages.filter((f) => read(f).includes('id="gfMark"'));
  assert.ok(carriers.length >= 2,
    "expected index.html and confirm.html to inline the mark, found " + carriers.join(", "));
  for (const f of carriers) {
    assert.equal(geometryOf(read(f), f), canon,
      f + " draws a different mark from public/logo.svg — one of them has been edited alone");
  }
});

test("a page that draws the mark also declares it", () => {
  // THE WIRING LAYER. <use href="#gfMark"> against a document with no such id
  // paints nothing, throws nothing, and logs nothing — the logo is simply gone
  // and every other check still passes.
  for (const f of fs.readdirSync(PUB).filter((x) => x.endsWith(".html"))) {
    const src = read(f);
    if (!src.includes('href="#gfMark"')) continue;
    assert.ok(src.includes('id="gfMark"'),
      f + ' uses #gfMark but never defines it — its logo renders as nothing');
  }
});

test("the mark's defs do not live inside the landing block", () => {
  // They did. The app shell's three marks — auth card, sidebar, sites topbar —
  // are all outside #marketing and referenced in. It works (a <use> resolves
  // into a display:none subtree, measured 403x411), but it made the signed-in
  // app's logo depend on the marketing markup still being there, which is not a
  // dependency anybody deleting a landing section would think to look for.
  const src = read("index.html");
  const defs = src.indexOf('id="gfMark"');
  const landing = src.indexOf('<div id="marketing"');
  assert.ok(defs > 0 && landing > 0, "both landmarks must exist for this comparison to mean anything");
  assert.ok(defs < landing,
    "the mark must be declared before the landing block, so deleting the landing cannot take the app's logo with it");
});

test("no page reaches for a raster copy of the logo any more", () => {
  // The point of the change. Checked over the app's own files only — the demo
  // sites under public/mkt/ are customers' pages and carry their own art.
  const files = [
    ...fs.readdirSync(PUB).filter((f) => /\.(html|css|js|webmanifest)$/.test(f)).map((f) => ["public/" + f, read(f)]),
  ];
  assert.ok(files.length >= 6, "expected the app's pages and stylesheets, found " + files.length);
  for (const [name, src] of files) {
    for (const raster of ["logo.png", "logo.jpg", "logo-tile.png"]) {
      assert.equal(src.includes(raster), false, name + " still points at " + raster);
    }
  }
});

test("the SVG favicon is offered first, and the raster ones still follow", () => {
  // An SVG favicon is the scalable one, but Safari and older browsers ignore
  // it — dropping the .ico would take the tab icon away from them entirely.
  for (const f of fs.readdirSync(PUB).filter((x) => x.endsWith(".html"))) {
    const src = read(f);
    if (!src.includes('rel="icon"')) continue;
    assert.match(src, /type="image\/svg\+xml" href="\/logo\.svg"/, f + " should offer the SVG icon");
    assert.ok(src.indexOf("/logo.svg") < src.indexOf("favicon.ico"),
      f + " must list the SVG icon before the .ico, or the .ico wins");
    assert.ok(src.includes("favicon.ico"), f + " must keep a raster fallback");
  }
});
