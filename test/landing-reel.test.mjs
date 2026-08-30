// The showcase strip's VIDEO pane — a marquee of clip cards, one card per clip
// (owner 2026-08-29: "instead of one big video, there gonna be like a bunch of
// smaller rectangles just moving, like the one in app, and each rectangle would
// have its own video").
//
// The whole pane rests on one arithmetic fact that nothing in a browser will
// complain about when it stops being true: the drift keyframe travels HALF the
// track, so the wrap is seamless only while the track is two IDENTICAL passes
// of the same cards. Add a card to one pass and the strip visibly jumps once
// every loop — a defect that looks like a rendering glitch rather than like a
// list somebody edited.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const CHAT = fs.readFileSync(path.join(ROOT, "public", "chat.js"), "utf8");
const HTML = fs.readFileSync(path.join(ROOT, "public", "index.html"), "utf8");
const CSS = fs.readFileSync(path.join(ROOT, "public", "styles.css"), "utf8");

const clipsSrc = (() => {
  const i = CHAT.indexOf("const REEL_CLIPS = [");
  assert.ok(i > 0, "REEL_CLIPS must exist — every check below is about it");
  const j = CHAT.indexOf("\n];", i);
  assert.ok(j > i, "REEL_CLIPS must be closed");
  return CHAT.slice(i, j + 3);
})();
// The real array, not a re-typed copy of it: a hand-written fixture here would
// be a second list of the same thing and would agree with the first only until
// somebody edited one.
const CLIPS = eval(clipsSrc.slice(clipsSrc.indexOf("["), clipsSrc.lastIndexOf("]") + 1));

const renderer = (() => {
  const i = CHAT.indexOf("function initReelClips");
  assert.ok(i > 0, "initReelClips must exist");
  const j = CHAT.indexOf("\nfunction initReel(", i);
  assert.ok(j > i, "initReelClips must be followed by initReel");
  return CHAT.slice(i, j);
})();

test("the track is two passes of the SAME cards, built from one rendering", () => {
  // Not "there are two loops" — that a hand-written second list would satisfy
  // too. The property is that both passes come from mapping the SAME array, so
  // there is no second list to drift.
  const maps = renderer.match(/REEL_CLIPS\.map\(/g) || [];
  assert.equal(maps.length, 2, "expected exactly two passes over REEL_CLIPS, found " + maps.length);
  assert.equal(/\[\s*\{[^]*?\}\s*\]/.test(renderer), false,
    "the renderer must not carry a clip list of its own");
  // The duplicate pass is the same clips again and must not be read out twice.
  assert.match(renderer, /aria-hidden="true"/, "the second pass must be hidden from assistive tech");
});

test("the video pane rides the same marquee as the app pane", () => {
  // It is a .gf-reel-track or it does not move: the drift animation is declared
  // on that class and on nothing else.
  const pane = /<div class="([^"]*)"[^>]*data-mode="video"[^>]*>/.exec(HTML);
  assert.ok(pane, "the video pane must exist and declare data-mode");
  assert.match(pane[1], /\bgf-reel-track\b/, "the video pane must be a .gf-reel-track");
  assert.match(CSS, /\.gf-reel-track\{[^}]*animation:gf-reel-drift/,
    "the drift animation must be on .gf-reel-track");
});

test("every clip shape has a rule, and every rule has a clip", () => {
  // Two lists of the same thing, derived in both directions. A shape with no
  // rule falls through to no aspect-ratio at all and collapses; a rule for a
  // shape nothing uses is styling nobody can reach.
  const used = new Set(CLIPS.map((c) => c.shape));
  assert.ok(used.size >= 2, "a strip of one shape is not a mix; found " + [...used].join(","));
  const styled = new Set([...CSS.matchAll(/\.gf-clip\.gf-([a-z]+)\s+\.gf-reel-body/g)].map((m) => m[1]));
  for (const s of used) assert.ok(styled.has(s), "clip shape '" + s + "' has no CSS rule");
  for (const s of styled) assert.ok(used.has(s), "CSS styles shape '" + s + "' but no clip uses it");
});

test("every card is the same height; only the width follows the shape", () => {
  // This is what makes a mixed row line up instead of reading as a pile — the
  // same law the app strip is built on. Height on the card, aspect on the body,
  // and NO per-shape width to keep in step with anything.
  const card = CSS.slice(CSS.indexOf(".mkt-crt .gf-clip{"), CSS.indexOf(".mkt-crt .gf-clip .gf-reel-body{"));
  assert.match(card, /height:/, ".gf-clip must set a height");
  assert.match(card, /width:auto/, ".gf-clip's width must come from the shape, not be declared");
  for (const s of [...CSS.matchAll(/\.gf-clip\.gf-[a-z]+\s+\.gf-reel-body\{([^}]*)\}/g)]) {
    assert.match(s[1], /aspect-ratio:/, "a shape rule must set an aspect-ratio: " + s[1]);
    assert.equal(/width:/.test(s[1]), false, "a shape must not set its own width: " + s[1]);
  }
});

test("every clip points at a file that is actually there", () => {
  // A missing src is a card that renders as a black rectangle and throws
  // nothing — indistinguishable from footage that is simply dark.
  for (const c of CLIPS) {
    for (const f of [c.src, c.poster]) {
      assert.match(f, /^\/[\w./-]+$/, "a clip path must be a plain site-absolute path: " + f);
      assert.ok(fs.existsSync(path.join(ROOT, "public", f.replace(/^\//, ""))),
        "public" + f + " does not exist");
    }
    assert.ok(c.alt && c.alt.trim().length > 0, "every clip needs an aria-label");
  }
});

test("no clip is fetched before its tab is opened", () => {
  // Twelve videos eagerly loading would cost every visitor the bandwidth of a
  // pane most of them never open. They carry data-src and are woken by the
  // switch; preload="none" keeps the browser from second-guessing that.
  assert.match(renderer, /data-src="/, "clips must be lazy — data-src, not src");
  assert.equal(/<video[^>]*\ssrc="/.test(renderer), false, "a clip must not ship a live src");
  assert.match(renderer, /preload="none"/, "clips must not preload");
  const reel = CHAT.slice(CHAT.indexOf("function initReel("));
  assert.match(reel, /wake\(document\.getElementById\('gfClips'\)\)/,
    "opening the video tab must wake the clips");
});

test("switching away pauses EVERY clip, not just the first", () => {
  // The pane held one video until 2026-08-29 and the handle was singular. Left
  // that way, eleven of twelve would keep decoding behind the app tab.
  const reel = CHAT.slice(CHAT.indexOf("function initReel("));
  assert.match(reel, /querySelectorAll\('\.gf-reel-vid'\)/, "the pane has many videos, not one");
  assert.match(reel, /vids\.forEach/, "play/pause must run over all of them");
});
