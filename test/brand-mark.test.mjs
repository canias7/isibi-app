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

// The geometry: the leaning GF, as the one transform that places the letters
// and every stroke drawn under it (the wide letter pass and the thin inline).
//
// The mark is a tile with the letters taken out of it. The documents that use
// it as currentColor art (logo.svg, index.html, confirm.html) cut the letters
// with a <mask id="gfCut">, so whatever colour the app paints shows through
// the letters correctly; favicon.svg paints the same letters solid on its own
// tile, because a tab strip is not ours to colour. The drawing is the same in
// all of them, and that is what is compared: the placing transform, then each
// pass's stroke width and paths, whitespace normalised.
const geometryOf = (src, label) => {
  const groups = [...src.matchAll(/<g\b[^>]*transform="([^"]*skewX[^"]*)"[^>]*>/g)];
  assert.equal(groups.length, 1, label + " should place the letters exactly once, saw " + groups.length);
  const from = groups[0].index;
  let i = src.indexOf(">", from) + 1, depth = 1, end = -1;
  while (i < src.length && depth > 0) {
    const openTag = src.indexOf("<g", i), closeTag = src.indexOf("</g>", i);
    assert.ok(closeTag >= 0, label + "'s letter group is never closed");
    if (openTag >= 0 && openTag < closeTag) { depth++; i = openTag + 2; continue; }
    depth--; end = closeTag; i = closeTag + 4;
  }
  assert.equal(depth, 0, label + "'s letter group is unbalanced");
  const inner = src.slice(src.indexOf(">", from) + 1, end);
  const passes = [...inner.matchAll(/<g\b[^>]*stroke-width="([^"]+)"[^>]*>([\s\S]*?)<\/g>/g)]
    .map((m) => m[1] + ":" + [...m[2].matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map((d) => d[1].replace(/\s+/g, " ").trim()).join("|"));
  assert.equal(passes.length, 2, label + " should draw the letters in two passes (the letter and its inline), saw " + passes.length);
  for (const pass of passes) assert.equal(pass.split("|").length, 4, label + " should draw the G, the F's stem and top, its middle bar and the arrow: " + pass);
  return groups[0][1].replace(/\s+/g, " ").trim() + "#" + passes.join("#");
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
  // Every carrier in the tree, found rather than listed: the two HTML documents
  // that inline the defs, and favicon.svg, which is a third copy of the same
  // drawing on its own plate.
  // A carrier is any page or asset that draws this exact artwork — probed with
  // the mark's own first path, taken from the canonical file rather than typed
  // here, so a file that starts carrying the mark is covered the day it does.
  const probe = /<path\b[^>]*\bd="([^"]+)"/.exec(CANON)[1];
  const carriers = fs.readdirSync(PUB)
    .filter((f) => /\.(html|svg)$/.test(f) && f !== "logo.svg")
    .filter((f) => read(f).includes(probe));
  assert.ok(carriers.length >= 3,
    "expected index.html, confirm.html and favicon.svg to carry the mark, found " + carriers.join(", "));
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

test("the favicon carries its own ground, and logo.svg is transparent around its tile", () => {
  // A tab strip follows the OS, not the site. The favicon therefore paints
  // everything itself: an opaque tile and solid letters in stated colours. Cut
  // letters (logo.svg's mask) would show the strip through them and vanish on a
  // dark one.
  const fav = read("favicon.svg");
  assert.match(fav, /<rect[^>]*fill="#[0-9a-f]{6}"/i,
    "favicon.svg needs an opaque tile in a stated colour or it disappears on a dark tab strip");
  assert.match(fav, /stroke="#[0-9a-f]{6}"/i,
    "on its own tile the letters must state a colour; currentColor would follow the renderer");
  assert.equal(/currentColor|mask=/.test(fav), false,
    "favicon.svg must not depend on the page's colour or cut its letters out");

  // logo.svg is the opposite, for a reason that is easy to undo by accident:
  // the in-app avatar MASKS it, and a mask reads alpha. Its one painted shape is
  // the rounded tile in currentColor, with the letters cut by the mask; outside
  // the tile the file must stay transparent, or the avatar becomes a square.
  const outsideMask = CANON.replace(/<mask\b[\s\S]*?<\/mask>/g, "");
  const rects = [...outsideMask.matchAll(/<rect\b[^>]*>/g)].map((m) => m[0]);
  assert.equal(rects.length, 1, "logo.svg should paint exactly one shape, its tile, saw " + rects.length);
  assert.match(rects[0], /rx="\d/, "the tile must keep its rounded corners, which are transparent");
  assert.match(rects[0], /fill="currentColor"/, "the tile takes the app's own ink");
  assert.match(rects[0], /mask="url\(#gfCut\)"/, "the letters must be cut out of the tile, not painted on it");
  assert.equal(/<style|prefers-color-scheme/.test(CANON), false,
    "public/logo.svg must not restyle itself — the avatar masks it and the app colours it");
});

test("each document that cuts the letters declares its cut", () => {
  // THE WIRING LAYER again: mask="url(#gfCut)" against a document with no such
  // mask paints the tile with no letters at all, and nothing errors.
  for (const f of ["logo.svg", ...fs.readdirSync(PUB).filter((x) => x.endsWith(".html"))]) {
    const src = read(f);
    if (!src.includes("url(#gfCut)")) continue;
    assert.equal((src.match(/<mask id="gfCut"/g) || []).length, 1, f + " uses #gfCut and must declare it exactly once");
  }
});

test("nothing paints logo.svg as an image onto a fixed-colour surface", () => {
  // The trap the media query above opens. This app is light-only by design, but
  // an <img>/background-image of logo.svg obeys the BROWSER's scheme — so the
  // agent avatar would have gone pale-on-white the moment a viewer's browser
  // was in dark mode. A mask takes only the artwork's alpha, which is identical
  // in both schemes, and currentColor supplies the app's own ink.
  const css = read("styles.css");
  const uses = [...css.matchAll(/[^;{}]*\/logo\.svg[^;{}]*/g)].map((m) => m[0]);
  assert.ok(uses.length > 0, "styles.css should use the mark somewhere, or this check is vacuous");
  for (const u of uses) {
    assert.match(u, /mask\s*:/,
      "logo.svg must be a mask here, not painted as an image — it carries its own light/dark " +
      "colours now and this surface does not change with the browser: " + u.trim());
  }
});

test("the SVG favicon is offered first, and the raster ones still follow", () => {
  // An SVG favicon is the scalable one, but Safari and older browsers ignore
  // it — dropping the .ico would take the tab icon away from them entirely.
  for (const f of fs.readdirSync(PUB).filter((x) => x.endsWith(".html"))) {
    const src = read(f);
    if (!src.includes('rel="icon"')) continue;
    assert.match(src, /type="image\/svg\+xml" href="\/favicon\.svg"/, f + " should offer the SVG icon");
    assert.ok(src.indexOf("/favicon.svg") < src.indexOf("favicon.ico"),
      f + " must list the SVG icon before the .ico, or the .ico wins");
    assert.ok(src.includes("favicon.ico"), f + " must keep a raster fallback");
  }
});
