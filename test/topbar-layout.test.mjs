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

// ── the builder / effort drop-ups ────────────────────────────────────────────
//
// Both rendered 130px wide and see-through. `.model-menu` sets `min-width: 250px`
// and a translucent panel; `.model-menu.drop-up` narrows that to 130px, and every
// other drop-up then re-widens itself and paints itself solid. `.build-menu`
// never did, so its descriptions wrapped one or two words per line and the chat
// showed through the panel.

// `.drop-up` IS NO LONGER PART OF THE SELECTOR FOR EVERY VARIANT (2026-09-07).
// The builder chip is now drawn on the start screen too, where it opens DOWNWARD,
// so `.build-menu`'s width and solid panel moved from `.model-menu.drop-up
// .build-menu` to `.model-menu.build-menu` — the same box in both directions.
// This reader pinned the three-class spelling, so it answered "the rule is gone"
// for a rule that is there and governs one more menu than before. It takes either
// spelling now; the property it exists for — that a menu carrying descriptions is
// wide enough and not see-through — has not moved.
const menuRule = (name) => {
  const src = fs.readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
  const m = src.match(new RegExp("\\.model-menu(?:\\.drop-up)?\\." + name + "\\s*\\{[^}]*\\}"));
  return m && m[0];
};

test("every drop-up that narrows itself also widens itself back", () => {
  // DERIVED, not a list: `.drop-up` sets min-width 130px, which is too narrow for
  // any menu carrying descriptions, so each one must override it. Naming them by
  // hand is how `.build-menu` was missed in the first place.
  const src = fs.readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
  const base = src.match(/\.model-menu\.drop-up\s*\{[^}]*\}/);
  assert.ok(base, "the drop-up rule was renamed");
  assert.match(base[0], /min-width:\s*130px/, "the premise changed — re-derive this guard");

  // KEYED BY THE VARIANT'S NAME, NOT BY ITS SELECTOR. `.build-menu` sheds
  // `.drop-up` from its width rule on 2026-09-07 (it is drawn on the start screen
  // too now, opening downward), and a scan that only saw three-class selectors
  // would have stopped watching the very menu it was written for — the hole
  // reopening exactly where the original bug was. Both spellings are collected
  // and merged per name, so a variant is judged on everything that styles it.
  const named = new Map();
  for (const [, name, body] of src.matchAll(/\.model-menu(?:\.drop-up)?\.([a-z-]+)\s*\{([^}]*)\}/g)) {
    named.set(name, (named.get(name) || "") + body);
  }
  assert.ok(named.has("build-menu"), "the builder menu left this scan — it is the one it was written for");
  assert.ok(named.size >= 3, "the drop-up variants have moved");
  let checked = 0;
  for (const [name, body] of named) {
    // STATE RULES ARE NOT VARIANTS. `.open` sets `animation-name` and nothing
    // else — it says when the menu shows, not how wide it is. A rule that styles
    // no part of the box is out of scope here; flagging it was this check's own
    // first false positive.
    if (!/min-width|width|background|left|right|top|bottom|padding/.test(body)) continue;
    checked++;
    // A variant that only repositions inherits the width from a sibling rule and
    // is fine; one that is a menu in its own right must set it.
    if (/min-width|left|right/.test(body)) continue;
    assert.fail("." + name + " overrides neither width nor position — it will be 130px wide");
  }
  assert.ok(checked >= 3, "the scan stopped seeing the real variants — it now proves nothing");
});

test("the builder menu is wide enough and opaque", () => {
  const r = menuRule("build-menu");
  assert.ok(r, "the build-menu rule is gone — it will inherit 130px and the blur");
  const w = Number((r.match(/min-width:\s*(\d+)px/) || [])[1]);
  assert.ok(w >= 250, "too narrow at " + w + "px — the descriptions wrap to a word a line");
  // Solid, like the other three drop-ups: these open OVER the composer and have
  // to read against the attach row behind them.
  assert.match(r, /background:\s*#ffffff/, "the chat shows through the menu");
  // AND IT WINS BY SOURCE ORDER, which is the whole reason two classes are enough.
  // `.model-menu.drop-up` sets min-width 130px and is also two classes, so weight
  // cannot separate them — only position can. Moving this rule above that one
  // would silently give the composer's menu its 130px back, with every assertion
  // above still passing.
  const src = fs.readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
  const narrow = src.indexOf(".model-menu.drop-up {");
  const wide = src.indexOf(r);
  assert.ok(narrow > 0 && wide > 0, "one of the two rules was renamed — re-derive this");
  assert.ok(wide > narrow, "the builder menu's width rule now sits ABOVE the 130px it overrides, so it loses");
});

test("the rightmost chip's menu opens leftwards", () => {
  // `.drop-up` pins menus to `left: 0`. The effort chip sits near the end of the
  // composer row, so that ran the panel 72px past the rail's right edge —
  // measured against the real 450px .st-rail.
  const r = menuRule("build-menu-end");
  assert.ok(r, "the end-anchored rule is gone — the effort menu spills out of the rail");
  assert.match(r, /right:\s*0/);
  assert.match(r, /left:\s*auto/, "left must be released or right:0 does nothing");
  // And it is actually applied to the effort menu, not just defined.
  const src = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  const i = src.indexOf('id="stEffMenu"');
  assert.ok(i > 0, "the effort menu was renamed");
  assert.match(src.slice(i - 300, i), /build-menu-end/, "the effort menu does not use the rule");
  // The builder chip is the LEFT one and must not take it, or its menu runs off
  // the other edge.
  const j = src.indexOf('id="stBuildMenu"');
  assert.ok(!/build-menu-end/.test(src.slice(j - 300, j)), "the left chip's menu is anchored right");
});

test("the history rail has no disabled tab", () => {
  // Bookmarks was rendered `disabled` and had never done anything — removed
  // 2026-08-08, owner's call. Pinned because a deliberate removal and an
  // oversight look identical a year later, the same reason `toast` is pinned in
  // the component-kit tests. This asserts the SHAPE rather than the word, so a
  // second dead placeholder under any name fails too.
  const src = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  const i = src.indexOf('class="st-hist-tabs"');
  assert.ok(i > 0, "the history rail was restructured — rescope this guard");
  const strip = src.slice(i, src.indexOf("</div>' +", i));
  assert.ok(!/disabled/.test(strip), "a tab that cannot be pressed is back in the history rail: " + strip);
  // The icon went with it — one caller, so it was dead the moment the button
  // was. Checked as CODE, not as text: the comment above the strip explains the
  // removal and says the word, and a bare /bookmark/i over the file failed on
  // its own documentation.
  assert.ok(!/^\s*bookmark:/m.test(src), "the bookmark icon is back in the icon map");
  assert.ok(!/ic\(\s*['"]bookmark['"]/.test(src), "something renders the bookmark icon again");
});

// ── a build that could not run says WHY ──────────────────────────────────────

test("the server's own message reaches the customer", () => {
  // MEASURED LIVE 2026-08-08 on a real account. The model provider was returning
  // 400 invalid_request_error because its balance was empty; the route correctly
  // answered `billing: true` with "this is on us, not your brief" — and the
  // client printed "busy, try again", so the customer sent the same message four
  // times. Every 503 field the route works to produce was discarded.
  const src = chat();
  const m = src.match(/function buildDownMsg\(d\)\s*\{[\s\S]*?\n\}/);
  assert.ok(m, "buildDownMsg is gone — the 503 message is canned again");
  const fn = m[0];
  assert.match(fn, /d\.msg/, "the server's sentence is not read");
  assert.match(fn, /d\.billing/, "nothing distinguishes a transient failure from a permanent one");

  // ONE send path uses it, and one is now the whole answer. This asserted TWO,
  // because the legacy static engine had its own copy — and that engine's POST
  // went to `/api/site`, deleted 2026-07-27, so the branch could not reach a 503
  // or anything else. It is a plain "this project needs rebuilding" message now
  // and makes no request at all, so there is no second 503 to keep in step.
  assert.equal((src.match(/finish\(buildDownMsg\(d\)\)/g) || []).length, 1,
    "the React send path no longer cans its own 503 message");
  // And the canned sentence is no longer written at a call site.
  const calls = src.split("function buildDownMsg(d)")[0] + src.split(/\n\}/).slice(-1)[0];
  assert.ok(!/builder’s busy right now/.test(src.replace(fn, "")),
    "the hardcoded busy line is still somewhere outside the helper");
});

test("a permanent failure never tells them to try again", () => {
  // The whole point. `billing` is the one failure no retry fixes — the route's
  // own comment says so — and "give it a few seconds, then send again" is a
  // straightforwardly false instruction there.
  const src = chat();
  const fn = src.match(/function buildDownMsg\(d\)\s*\{[\s\S]*?\n\}/)[0];
  // Derive the behaviour rather than restate it: run the real function.
  const run = new Function(fn + "; return buildDownMsg;")();
  const billing = run({ billing: true, msg: "The site builder is temporarily unavailable — this is on us, not your brief." });
  assert.ok(!/send again|try again/i.test(billing), "it still tells them to retry: " + billing);
  assert.match(billing, /this is on us/, "the server's sentence was dropped");
  assert.match(billing, /weren’t charged/, "it no longer says they weren't charged");

  const busy = run({ code: 429 });
  assert.match(busy, /send again/, "a genuinely transient failure should still invite a retry");

  // A 503 with no body at all must still say something sane rather than
  // "undefined" — this branch fires on a network-shaped failure too.
  for (const empty of [null, undefined, {}]) {
    const out = run(empty);
    assert.ok(out && !/undefined|null/.test(out), "empty response produced: " + out);
  }
});

// ── the builder no longer claims to be building before it is ─────────────────

test("a fresh send starts in `thinking`, not `generating`", () => {
  // `siteBuildStart` runs the instant a message is sent — before the router has
  // said whether it is even a build. Starting at `generating` is what made "hey"
  // paint "Writing the code / Generating images / Compiling React" for a build
  // that never happened.
  const src = chat();
  const m = src.match(/function siteBuildStart\([\s\S]*?\n\}/);
  assert.ok(m, "siteBuildStart was renamed");
  assert.match(m[0], /rphase: 'thinking'/, "a send still opens on a build phase");
  assert.ok(!/rphase: 'generating'/.test(m[0]), "it still initialises to generating");
});

test("the thinking state renders NO step rows, and can still be repainted", () => {
  // Two properties in one line of markup, and the second is the one that would
  // fail silently: `paintReactLive` swaps `.st-steps-live`, so without that class
  // the move from thinking to the real steps never repaints — invisible in the
  // markup, total at runtime.
  const src = chat();
  const m = src.match(/if \(sb\.rphase === 'thinking'\) return '[^']*'/);
  assert.ok(m, "the thinking branch is gone — the step rows paint immediately again");
  assert.match(m[0], /st-steps-live/, "the thinking panel cannot be repainted into the steps");
  assert.match(m[0], /st-think/, "it renders no thinking indicator");
  assert.ok(!/st-step-lbl|Writing the code/.test(m[0]), "the thinking state names a build step");
  // It must come BEFORE the phase-index maths, or `order.indexOf('thinking')` is
  // -1, clamps to 0, and lands on 'generating' — the exact bug, restored.
  const fn = src.slice(src.indexOf("function reactLiveStepsHTML"));
  assert.ok(fn.indexOf("rphase === 'thinking'") < fn.indexOf("const order ="),
    "the thinking check runs after the phase index and will be bypassed");
});

test("the steps appear the moment it IS a build, from ONE place", () => {
  // Set in `reactSend` rather than in `siteRoute`, because an attachment skips
  // the router and comes straight here. Two places is how one entry point gets
  // left stuck on `thinking` forever.
  const src = chat();
  const i = src.indexOf("function reactSend(");
  assert.ok(i > 0, "reactSend is gone — rescope this guard");
  // LANDMARK TO LANDMARK, both ends asserted. This was `i + 700` and the promotion
  // sat at byte ~690 of it: the comment above the line grew by six lines for the
  // build-progress change and pushed it out of view. A byte window over this
  // repository's source is outrun by its next comment, every time.
  const end = src.indexOf("const endpoint =", i);
  assert.ok(end > i, "reactSend no longer picks an endpoint — rescope this guard");
  const head = src.slice(i, end);
  // RE-ANCHORED 2026-09-07. It pinned the word `'generating'`, which was the
  // DEFECT, not the property: the build POST holds the socket through the design,
  // the provisioning, the schema and the look, so promoting straight to "writing
  // the code" put a claim on the screen for the first minutes of every build that
  // nothing had begun to do. The property is that a build leaves `thinking` from
  // exactly one place, promotes to the FIRST phase and repaints.
  assert.match(head, /siteBuild\.rphase = ST_PHASE_ORDER\[0\]/, "a build never leaves the thinking state");
  assert.match(head, /paintReactLive\(\)/, "the phase changes but nothing repaints");
  assert.equal((src.match(/siteBuild\.rphase = ST_PHASE_ORDER\[0\]/g) || []).length, 1,
    "more than one place promotes out of thinking — they will disagree");
  assert.ok(!/rphase = 'generating'/.test(src),
    "the promotion straight to 'writing the code' is back, over a design call");
});

test("the thinking dot survives reduced motion", () => {
  // Motion is the entire signal, so with it off the dot must not freeze
  // mid-fade at 35% opacity — it has to stay legible.
  const src = css();
  assert.match(src, /\.st-think i \{[^}]*animation:\s*stbreathe/, "the breathing animation is gone");
  const rm = src.match(/@media \(prefers-reduced-motion: reduce\) \{\s*\.st-think i \{[^}]*\}/);
  assert.ok(rm, "no reduced-motion fallback for the thinking dot");
  assert.match(rm[0], /animation:\s*none/);
  assert.match(rm[0], /opacity:\s*1/, "it would freeze mid-fade and read as nothing");
});
