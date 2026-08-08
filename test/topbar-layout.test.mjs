// The workspace top bar's view tabs must not move when the view changes.
//
// They did, at every width: the page picker and the reload button sat inside
// `.st-tb-mid`, which is centred by its TOTAL width, and both exist only in the
// Preview view. Switching to Code or More slid the tabs 66px right — 8px more on
// a multi-page site, the picker being wider than the word "Homepage".
//
// EVERY CHECK HERE IS ON THE SOURCE, and that is a real limitation worth
// stating: these assert the two mechanisms that hold the layout, not the layout
// itself. Position was verified by rendering the real stylesheet in a browser at
// 1024-1920px, which is also the only thing that caught the three failed
// attempts — each of which measured a clean 0px spread while visibly breaking
// something else (the page name running under the device toggles, the picker
// overlapping the reload button, "Homepage" reduced to "H").
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const chat = () => fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
const css = () => fs.readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");

test("the preview controls live in the right-hand group, not in the centre", () => {
  // `.st-tb-mid` is centred by its total width, so anything view-dependent
  // inside it moves the tabs. It may hold the tabs and nothing else.
  const src = chat();
  const a = src.indexOf('<div class="st-tb-mid">');
  const b = src.indexOf('<div class="st-tb-right">', a);
  assert.ok(a > 0 && b > a, "the top bar was restructured — rescope this guard");
  const mid = src.slice(a, b);
  assert.match(mid, /st-vtabs/, "the tabs are no longer in the middle group");
  for (const moving of ["st-tb-pv", "stReload", "st-pagepick", "st-tb-page"]) {
    assert.ok(!mid.includes(moving), moving + " is back inside the centred group and will move the tabs");
  }
});

test("...and they are RENDERED in every view, only hidden", () => {
  // The second half, and the one that is easy to lose. The two side groups split
  // the bar between them, so a block that disappears still moves the centre —
  // just from the other side. Reserving the space is what makes the width
  // identical in every view.
  const src = chat();
  const i = src.indexOf('<div class="st-tb-pv');
  assert.ok(i > 0, "the preview-controls wrapper is gone");
  // Not behind a conditional that can drop it entirely. The class is toggled;
  // the element is not.
  const decl = src.slice(i - 200, i + 300);
  assert.match(decl, /st-tb-pv-off/, "the off state is no longer a class — the block is being removed again");
  assert.ok(!/siteView === 'preview'\s*\?\s*'<div class="st-tb-pv/.test(src),
    "the wrapper is conditional again, which moves the tabs from the other side");
});

test("the off state hides it WITHOUT reclaiming its space", () => {
  // `display: none` would reintroduce the exact bug this fixes, and would look
  // correct in every source check above.
  const src = css();
  const m = src.match(/\.st-tb-pv-off\s*\{[^}]*\}/);
  assert.ok(m, "the off rule is gone, so the block is visible in every view");
  assert.match(m[0], /visibility:\s*hidden/, "hidden the wrong way");
  assert.ok(!/display:\s*none/.test(m[0]), "display:none reclaims the space and the tabs move again");
});

test("the block parks at the left edge of the right-hand group", () => {
  // That group begins exactly where the centred tabs end, so `margin-right: auto`
  // is what keeps the picker reading as though it sits beside the tabs — where
  // it has always appeared — while everything else stays flush right.
  const src = css();
  const m = src.match(/^\.st-tb-pv\s*\{[^}]*\}/m);
  assert.ok(m, "the .st-tb-pv rule is gone");
  assert.match(m[0], /margin-right:\s*auto/, "it will sit against the Share button instead of beside the tabs");
});

test("the end buttons never wrap", () => {
  // Reserving the picker's space makes the non-Preview views tighter than they
  // were, and "Live ↗" broke onto a second line at 1180px — which grows the
  // whole toolbar. Caught by looking at a render; every position measurement
  // read 0px throughout.
  const src = css();
  const m = src.match(/\.st-share,\s*\.st-publish\s*\{[^}]*\}/);
  assert.ok(m, "the nowrap rule is gone");
  assert.match(m[0], /white-space:\s*nowrap/);
});
