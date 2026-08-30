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
  // Two spellings carry the mark: the HTML documents wrap it in <g id="gfMark">,
  // while logo.svg and favicon.svg wrap it in a plain stroked group (favicon's
  // also carries a transform and a literal colour, because it sits on a plate).
  // Anchor on the id when there is one and on the stroked group otherwise —
  // matching one exact opening tag reported favicon.svg as having no mark at all.
  const at = src.indexOf('id="gfMark"');
  const from = at >= 0 ? src.lastIndexOf("<g", at) : (() => {
    const g = [...src.matchAll(/<g\b[^>]*fill="none"[^>]*>/g)];
    assert.equal(g.length, 1, label + " should hold exactly one stroked mark group, saw " + g.length);
    return g[0].index;
  })();
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
  // Every carrier in the tree, found rather than listed: the two HTML documents
  // that inline the defs, and favicon.svg, which is a third copy of the same
  // drawing on its own plate.
  // A carrier is any page or asset that draws this exact artwork — probed with
  // the mark's own first path, taken from the canonical file rather than typed
  // here, so a file that starts carrying the mark is covered the day it does.
  const probe = /d="([^"]+)"/.exec(CANON)[1];
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

test("the favicon carries its own ground, and the mark does not", () => {
  // A tab strip follows the OS, not the site, and the mark is one colour — so
  // on a dark strip it was black on near-black and simply vanished (rendered,
  // not guessed). The fix is a plate: an opaque ground under the drawing, which
  // reads on any strip with nothing to get wrong at 16px.
  const fav = read("favicon.svg");
  assert.match(fav, /<rect[^>]*fill="#(fff|ffffff)"/i,
    "favicon.svg needs an opaque plate or it disappears on a dark tab strip");
  assert.match(fav, /stroke="#[0-9a-f]{6}"/i,
    "on its own plate the mark must state a colour; currentColor would follow the renderer");

  // And the exact opposite for logo.svg, for a reason that is easy to undo by
  // accident: the in-app avatar MASKS it, and a mask reads alpha. Give this file
  // a background and the avatar stops being a logo and becomes a filled square.
  assert.equal(/<rect|<style|prefers-color-scheme/.test(CANON), false,
    "public/logo.svg must stay a bare transparent mark — the avatar masks it, and a mask " +
    "takes alpha, so any opaque background here renders as a solid block");
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
