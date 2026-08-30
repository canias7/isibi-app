// The pipeline's corner — where the vertical pipe of model names turns into the
// horizontal run across the foot of the landing page.
//
// The corner is the ONE place on this page where two different drawing systems
// have to meet at a shared coordinate: the straight lengths are CSS boxes
// (borders + a tint), and the turn is an SVG arc, because a box cannot bend.
// Nothing in the browser objects when they disagree. A wall two pixels out, a
// radius that stopped matching the bore, a band that starts past the end of the
// elbow's tails — every one of those renders a pipe that visibly comes apart at
// the join, and every one is invisible to a source read that only checks the
// pieces exist.
//
// So these tests do not check that the elbow is "still there". They re-derive
// the elbow's numbers FROM the stylesheet that draws the two straights, and
// assert the SVG agrees. Move the pipe's box and the drawing is wrong until
// the path is re-derived with it — which is the point.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const HTML = fs.readFileSync(path.join(import.meta.dirname, "..", "public", "index.html"), "utf8");
const CSS = fs.readFileSync(path.join(import.meta.dirname, "..", "public", "styles.css"), "utf8");
const CHAT_RAW = fs.readFileSync(path.join(import.meta.dirname, "..", "public", "chat.js"), "utf8");

// Prose in this repo argues about the things it forbids — the comment above
// this pipe explains why there is no bottom cap and therefore says "cap", and
// the stylesheet's comment quotes the very declarations it is describing. Blank
// every comment before scanning, length-preserved so offsets still line up.
const decomment = (s, ...pairs) => {
  let out = s;
  for (const [open, close] of pairs) {
    out = out.replace(new RegExp(open + "[\\s\\S]*?" + close, "g"),
      (m) => m.replace(/[^\n]/g, " "));
  }
  return out;
};
const CSS_CODE = decomment(CSS, ["/\\*", "\\*/"]);
const HTML_CODE = decomment(HTML, ["<!--", "-->"]);
// JavaScript has two comment forms and this file's comments argue about the
// very markup they sit above, so both are blanked before anything is scanned.
const CHAT = decomment(CHAT_RAW, ["/\\*", "\\*/"]).replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));

// A rule's body, from its selector to the brace that closes it. Landmark to
// landmark: a byte window would be outrun by the next comment.
function rule(sel) {
  const i = CSS_CODE.indexOf(sel + "{");
  assert.ok(i >= 0, "missing rule: " + sel);
  const j = CSS_CODE.indexOf("}", i);
  assert.ok(j > i, "unterminated rule: " + sel);
  return CSS_CODE.slice(i + sel.length + 1, j);
}
const px = (body, prop) => {
  // `0` is written without a unit, the way every stylesheet writes it, so the
  // unit is optional — but only for zero, or this quietly reads a unitless
  // number off some other property as if it were pixels.
  const m = new RegExp("(?:^|;|\\s)" + prop + "\\s*:\\s*(-?[\\d.]+)(px)?").exec(body);
  assert.ok(m, "missing " + prop + " in: " + body.replace(/\s+/g, " ").trim().slice(0, 90));
  assert.ok(m[2] || parseFloat(m[1]) === 0, prop + " must be in px: " + m[0].trim());
  return parseFloat(m[1]);
};

// ---- what the CSS says the two straight lengths are ----
const VERT = rule(".mkt-crt .gf-pipe-list::before");
const RUN = rule(".mkt-crt .gf-run-pipe");
// A border is drawn centred on nothing — it fills inward from the box edge — so
// a wall's CENTRELINE, which is what an SVG stroke follows, sits half a border
// in. This is the conversion the whole join rests on.
const vLeft = px(VERT, "left"), vWidth = px(VERT, "width"), vBorder = px(VERT, "border-left");
const rTop = px(RUN, "top"), rHeight = px(RUN, "height"), rBorder = px(RUN, "border-top");
const WALL_X = [vLeft + vBorder / 2, vLeft + vWidth - vBorder / 2];
const WALL_Y = [rTop + rBorder / 2, rTop + rHeight - rBorder / 2];
const BORE = WALL_X[1] - WALL_X[0];

// ---- what the SVG says the corner is ----
// M<x> 0 V<y> A<r> <r> 0 0 0 <ex> <ey> H<tail>
const ELBOW = (() => {
  const i = HTML_CODE.indexOf('class="gf-run-elbow"');
  assert.ok(i >= 0, "the elbow SVG must exist — every check below is about it");
  const j = HTML_CODE.indexOf("</svg>", i);
  assert.ok(j > i, "the elbow SVG must be closed");
  return HTML_CODE.slice(i, j);
})();
// Only the STROKED group is a wall. The elbow also carries a filled path that
// shades the bend, and it opens with the same M/V/A because it traces the same
// outer wall on its way round — scanning the whole SVG counts that shading as a
// third wall and every derivation below then compares the wrong pair.
const WALLS = (() => {
  const i = ELBOW.indexOf('<g fill="none"');
  assert.ok(i >= 0, "the elbow's walls must be a stroked group");
  const j = ELBOW.indexOf("</g>", i);
  assert.ok(j > i, "the elbow's stroked group must be closed");
  return ELBOW.slice(i, j);
})();
const ARC = /M([\d.]+) 0 V([\d.]+) A([\d.]+) [\d.]+ 0 0 0 ([\d.]+) ([\d.]+) H([\d.]+)/g;
const turns = [...WALLS.matchAll(ARC)].map((m) => ({
  x: +m[1], vy: +m[2], r: +m[3], ex: +m[4], ey: +m[5], tail: +m[6],
}));

test("the elbow draws exactly the two walls the pipe has", () => {
  // A negative or a comparison over an empty list proves nothing: [].every is
  // true and a missing arc would sail through every assertion below it.
  assert.equal(turns.length, 2,
    "the corner is two walls turning — found " + turns.length + " stroked arcs");
});

test("each wall is a true quarter turn", () => {
  // The arc leaves a vertical line and arrives on a horizontal one, so its
  // centre is forced twice over: R to the side of where it left, and R above
  // where it lands. If those two disagree the "arc" is an ellipse segment
  // wearing a circle's radius, and the wall kinks at both ends of the bend.
  for (const t of turns) {
    assert.ok(Math.abs((t.x + t.r) - t.ex) < 1e-6,
      "wall at x=" + t.x + " with r=" + t.r + " must land its turn at x=" + (t.x + t.r) + ", not " + t.ex);
    assert.ok(Math.abs((t.ey - t.r) - t.vy) < 1e-6,
      "wall at x=" + t.x + " must begin its turn at y=" + (t.ey - t.r) + ", not " + t.vy);
  }
});

test("the two walls turn about ONE centre, a bore apart", () => {
  const [outer, inner] = turns[0].r >= turns[1].r ? turns : [turns[1], turns[0]];
  assert.ok(Math.abs((outer.x + outer.r) - (inner.x + inner.r)) < 1e-6, "centres differ in x");
  assert.ok(Math.abs(outer.vy - inner.vy) < 1e-6, "centres differ in y");
  // Concentric alone still lets the pipe swell or pinch round the bend; the
  // radii must differ by the bore for the walls to stay parallel through it.
  assert.ok(Math.abs((outer.r - inner.r) - BORE) < 1e-6,
    "radii differ by " + (outer.r - inner.r).toFixed(3) + " but the bore is " + BORE.toFixed(3));
});

test("the corner starts on the vertical pipe's own walls", () => {
  // Derived from the stylesheet, not typed here: change left/width/border on
  // .gf-pipe-list::before and this is what says the elbow no longer meets it.
  assert.deepEqual(turns.map((t) => t.x).sort((a, b) => a - b), WALL_X,
    "the elbow's stubs must sit on the pipe's wall centrelines " + WALL_X.join(" and "));
});

test("the corner ends on the horizontal run's own walls", () => {
  assert.deepEqual(turns.map((t) => t.ey).sort((a, b) => a - b), WALL_Y,
    "the elbow's tails must sit on the run band's wall centrelines " + WALL_Y.join(" and "));
});

test("the shading round the bend traces the walls it shades", () => {
  // The corner is shaded by a filled path that runs out along the outer wall
  // and back along the inner one — a SECOND copy of the same geometry, and two
  // copies drift. Re-derive the walls and leave this behind and the graphite
  // slides off the pipe, which nothing else here would notice: it is a fill,
  // so it kinks no line and breaks no join.
  const fill = /<path fill="url\(#pencilTint\)"[^>]*\bd="([^"]+)"/.exec(ELBOW);
  assert.ok(fill, "the bend must be shaded — the straights are, and a bare corner is the tell");
  const d = fill[1];
  for (const t of turns) {
    assert.ok(d.includes("M" + t.x + " 0") || d.includes(t.x + " " + t.vy),
      "the shading must start on the wall at x=" + t.x + ": " + d);
    assert.ok(new RegExp("A" + t.r + " " + t.r + "\\b").test(d),
      "the shading must turn on the wall's own radius " + t.r + ": " + d);
    assert.ok(d.includes(String(t.ey)),
      "the shading must reach the wall's landing at y=" + t.ey + ": " + d);
  }
});

test("the straight run starts under the elbow's tails, past the roughen throw", () => {
  // Both halves are pushed through feDisplacementMap, which moves the line by
  // up to `scale` px in either direction. Butting them end to end therefore
  // opens a visible gap on some renders and not others. The overlap has to
  // beat the throw, so read the throw out of the filter rather than trusting a
  // number that was true when it was written.
  const f = /<filter id="pencilRough"[\s\S]*?scale="([\d.]+)"/.exec(HTML_CODE);
  assert.ok(f, "#pencilRough must exist — it is what makes these lines wobble");
  const throwPx = parseFloat(f[1]);
  const tail = Math.min(...turns.map((t) => t.tail));
  const overlap = tail - px(RUN, "left");
  assert.ok(overlap >= throwPx * 2,
    "the band starts " + overlap + "px inside the elbow's tails; the filter throws " +
    throwPx + "px, so the join can open");
});

test("the pipe's bottom is open, because the run leaves through it", () => {
  // The pipe used to be capped at both ends. It now turns at the bottom, and a
  // cap there would read as welded shut with a pipe coming out of it anyway —
  // and the walls have to reach the last pixel or the elbow starts in mid-air.
  assert.equal(px(VERT, "bottom"), 0,
    "the walls must run to the list's bottom edge; the elbow's stubs start there");
  const cap = rule(".mkt-crt .gf-pipe-list::after");
  assert.match(cap, /border-top\s*:/, "the top of the pipe is still an end and still capped");
  assert.equal(/border-bottom\s*:/.test(cap), false,
    "the bottom is a turn, not an end — a cap across it welds the pipe shut");
});

test("every station on the run is a valve AND a name", () => {
  // The stations moved out of index.html and into RUN_AGENTS on 2026-08-30, so
  // this scans the RENDERER, not the markup. Anchoring it on the old <li>s
  // reported the run as empty the moment it became data — a guard going red for
  // the change rather than for a bug.
  const i = CHAT.indexOf("const RUN_AGENTS = [");
  assert.ok(i >= 0, "RUN_AGENTS must exist — the run's stations come from it");
  const j = CHAT.indexOf("\n];", i);
  assert.ok(j > i, "RUN_AGENTS must be closed");
  const agents = eval(CHAT.slice(CHAT.indexOf("[", i), j + 2));
  assert.ok(agents.length >= 1, "a run with no stations is a bare pipe");
  for (const a of agents) {
    assert.ok(a.name && a.name.trim().length > 0, "every station needs a name");
    assert.equal(typeof (a.note ?? ""), "string", "a note, when present, is text");
  }
  const r = CHAT.slice(CHAT.indexOf("function initRunAgents"));
  const body = r.slice(0, r.indexOf("\n}"));
  assert.match(body, /RUN_AGENTS\.map\(/, "the stations must be rendered from the list, not restated");
  assert.match(body, /gf-run-step/, "each entry must render a station");
  assert.match(body, /RUN_VALVE/, "each station must carry a valve");
  assert.match(body, /a\.name/, "each station must print its name");
});

test("the run's valve is the pipe's valve, transposed", () => {
  // The two are one drawing or they are two drawings that happen to be near
  // each other. Same handwheel, same flange pair, box swapped — asserted as the
  // transpose so a redrawn vertical valve cannot silently orphan this one.
  const vb = /viewBox="0 0 (\d+) (\d+)"/.exec(CHAT.slice(CHAT.indexOf('class="gf-pipe-valve"')));
  assert.ok(vb, "the vertical step's valve must declare a viewBox");
  const run = /viewBox="0 0 (\d+) (\d+)"/.exec(CHAT.slice(CHAT.indexOf("const RUN_VALVE")));
  assert.ok(run, "the run's valve must declare a viewBox");
  assert.deepEqual([run[1], run[2]], [vb[2], vb[1]],
    "the run's valve must be the vertical one's box turned on its side");
});

test("every landing list the script fills is a list the page has", () => {
  // THE WIRING LAYER, which is this repo's most repeated own-goal: the module
  // is perfect and one hop is cut. Rename #gfRun in index.html and
  // initRunAgents finds nothing, returns, and the pipe renders as a bare length
  // of pipe with no valves — no error, no log, and from outside it looks
  // exactly like a list somebody emptied on purpose. A mutation sweep found
  // this gap by renaming the id and watching every other guard stay green.
  //
  // Derived from the CONSUMER rather than listing today's hosts: any id the
  // landing's scripts reach for must be an id the landing declares. The gf-
  // prefix is the landing's own namespace, so this grows by itself.
  const wanted = [...new Set([...CHAT.matchAll(/getElementById\('(gf[A-Za-z]*)'\)/g)].map((m) => m[1]))];
  assert.ok(wanted.length >= 3,
    "expected the landing's render hosts, found " + wanted.length + " — has the namespace changed?");
  for (const id of wanted) {
    assert.ok(HTML_CODE.includes('id="' + id + '"'),
      "chat.js fills #" + id + " but index.html has no such element — the render is dead");
  }
});

test("the run crosses the page, not the aside", () => {
  // The aside is a third of the width. Nested inside it the run would be a
  // third of a run, which is exactly what it looked like the first time and
  // exactly what no screenshot of the corner alone would show.
  const aside = HTML_CODE.indexOf('class="gf-pipe"');
  const closes = HTML_CODE.indexOf("</aside>", aside);
  const run = HTML_CODE.indexOf('class="gf-run"');
  const sec = HTML_CODE.indexOf('class="gf-reel-sec"');
  assert.ok(sec >= 0 && aside > sec && closes > aside && run > 0, "landmarks must all exist");
  assert.ok(run > closes, "the run must be a sibling of the row, not a child of the aside");
  assert.ok(run < HTML_CODE.indexOf("</section>", sec), "the run belongs to the reel section");
});
