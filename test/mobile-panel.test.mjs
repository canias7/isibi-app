// THE MOBILE APP COLUMN (2026-09-08, owner: "i want to make a column in the
// right hand side" → "Is for mobile app" → "in a sidebar not free like that" →
// "something you open and close, not just something there").
//
// A third column on the right of the workspace, closed by default and opened
// from the top bar. Nothing can build a mobile app yet, so what it holds today
// is one true sentence and no control.
//
// THE CHAIN IS DERIVED FROM THE VALUE'S ROUTE, NOT FROM THE HOPS THAT WERE ON
// MY MIND. That is this repository's most expensive recorded lesson, most
// recently the Code tab: making it real took three hops — draw the tab, render
// the host, fetch into it — and the guard asserted the tab twice, asserted the
// loader, drove both handlers, and never read the branch that renders the host,
// which kept its old gate and was false on every real site. It shipped dead and
// the OWNER found it. So here the route is written out and every link asserted:
//
//     siteMobileOpen (module state, survives a re-render)
//        → the class on `.st-ws`            (the markup writes it)
//        → `.st-ws:not(.st-mob-open)`       (the stylesheet consumes it)
//        → `siteMobilePanel()`              (the room, rendered unconditionally)
//        → `#stMobile`.onclick              (the only writer)
//
// And the class name itself is TWO LISTS OF THE SAME THING — chat.js writes it,
// styles.css keys on it — so it is derived from the markup and checked against
// the stylesheet rather than typed twice in here.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const CHAT = fs.readFileSync(path.join(here, "../public/chat.js"), "utf8");
const CSS = fs.readFileSync(path.join(here, "../public/styles.css"), "utf8");

/**
 * Whole-line comments blanked, LENGTH PRESERVED so offsets still line up.
 *
 * This change's comments name `st-mob-open`, `siteMobileOpen`, `stMobile`, the
 * phone glyph and "No mobile app yet" repeatedly while explaining each — the
 * recorded "prose contains the thing it forbids", which without this would let
 * every presence check below pass by matching an explanation rather than code.
 */
const BARE = CHAT.split("\n")
  .map((l) => (/^\s*\/\//.test(l) ? " ".repeat(l.length) : l))
  .join("\n");
const CSS_BARE = CSS.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));

/** A window landmark to landmark, with BOTH ends asserted. */
function span(src, start, end, what) {
  const at = src.indexOf(start);
  assert.ok(at >= 0, "the opening landmark for " + what + " is gone: " + start);
  const to = src.indexOf(end, at + start.length);
  assert.ok(to > at, "the closing landmark for " + what + " is gone: " + end);
  return src.slice(at, to);
}

// ── THE STATE ───────────────────────────────────────────────────────────────

test("the open/closed state is module scope, so a reply cannot shut the panel", () => {
  // The workspace re-renders on every builder reply. A flag kept inside the
  // render would reset each time — which is exactly why `siteRailHidden`, the
  // control this one is modelled on, lives out here.
  assert.match(BARE, /^let siteMobileOpen = false;$/m,
    "siteMobileOpen is not a module-scope `let` initialised closed");
  const at = BARE.indexOf("let siteMobileOpen");
  const rail = BARE.indexOf("let siteRailHidden");
  assert.ok(rail > 0, "siteRailHidden is gone — re-anchor this comparison");
  assert.ok(Math.abs(at - rail) < 1200,
    "the two panel flags have drifted apart; they are one pattern and belong together");
});

// ── THE CLASS: ONE NAME, THREE READERS ──────────────────────────────────────

/** The class the MARKUP writes — the one name everything else is checked against. */
function openClass() {
  const m = BARE.match(/\(siteMobileOpen \? ' ([a-z-]+)' : ''\)/);
  assert.ok(m, "the workspace root no longer carries a class for the open state");
  return m[1];
}

test("the class the markup writes is the class the stylesheet hides on", () => {
  const cls = openClass();
  // DERIVED, never typed twice: a rename in one file and not the other leaves
  // the toggle flipping a class nothing styles, and nothing fails.
  const rule = new RegExp("\\.st-ws:not\\(\\." + cls + "\\) \\.st-mob \\{[^}]*display:\\s*none");
  assert.match(CSS_BARE, rule,
    "the stylesheet does not hide the column on `:not(." + cls + ")` — the toggle and the CSS have drifted");

  // THE DIRECTION IS THE FEATURE. `:not(...)` hides, so closed is the default
  // and the class opens it. Inverted, the panel would be open on every
  // workspace and the toggle would close it — the opposite of what was asked.
  assert.ok(!new RegExp("\\.st-ws\\." + cls + " \\.st-mob \\{[^}]*display:\\s*none").test(CSS_BARE),
    "the open class HIDES the column — the rule is inverted and the panel is open by default");
});

test("the class is written by the markup and by the toggle, and nowhere else", () => {
  const cls = openClass();
  const uses = [...BARE.matchAll(new RegExp("'" + cls + "'|' " + cls + "'", "g"))].length;
  assert.equal(uses, 2,
    "expected exactly two writers of `" + cls + "` (the markup and the toggle), found " + uses);
});

// ── THE ROOM ────────────────────────────────────────────────────────────────

test("the panel is rendered ALWAYS and hidden by CSS, which is what makes the toggle cheap", () => {
  // If this became `siteMobileOpen ? siteMobilePanel(...) : ''` the toggle would
  // have to re-render the workspace, and the two properties the class exists for
  // — the preview iframe never reloading, a half-typed message surviving — would
  // die silently. Both are driven in the scratchpad; this is what keeps them.
  const call = BARE.match(/^\s*siteMobilePanel\((\w+)\) \+$/m);
  assert.ok(call, "the panel is no longer rendered on its own line in the workspace body");
  assert.ok(!/siteMobileOpen\s*\?\s*siteMobilePanel/.test(BARE),
    "the panel is rendered conditionally — the toggle now needs a re-render, which reloads the preview");

  // ONE CALL SITE, COUNTED. The composer being perfect while its one call is
  // cut is how the card icons shipped with no icons on any card.
  const calls = [...BARE.matchAll(/siteMobilePanel\(/g)].length;
  assert.equal(calls, 2, "expected the definition plus exactly one call site, found " + calls);
});

/** The real `siteMobilePanel`, cut out and evaluated — never retyped. */
function realPanel() {
  const src = span(BARE, "function siteMobilePanel(hasSite) {", "\n}", "siteMobilePanel") + "\n}";
  // Built in a bare scope on purpose: a free identifier resolves when the line
  // RUNS, not when the file loads, so reading this function could never prove it
  // works. That trap has cost this repository four separate misses in one
  // session, one of which reached main.
  return new Function(src + "; return siteMobilePanel;")();
}

test("the panel says something true on a built site and on a project with nothing", () => {
  const panel = realPanel();
  const built = panel(true);
  const fresh = panel(false);

  assert.match(built, /No mobile app yet/, "the built-site panel lost its heading");
  assert.match(built, /Ask in the chat and I’ll build one from this site\./,
    "the built-site sentence moved");

  // AND THE OTHER SENTENCE IS NOT THE SAME ONE. A project that has never built
  // has no site to make an app from, so "one from this site" would be a promise
  // about a thing that does not exist.
  assert.notEqual(built, fresh, "both states draw the same panel — one of the two sentences is false");
  assert.match(fresh, /Build your website first, then ask me for the app\./,
    "the not-yet-built sentence moved");
  assert.ok(!/from this site/.test(fresh),
    "a project with nothing built is promised an app built from a site it does not have");
});

test("there is no control in the panel, and that is the decision", () => {
  const panel = realPanel();
  // Owner's call, asked directly: "no button, just the sentence". Nothing can
  // build a mobile app yet, so a button here would be this repo's open
  // dead-control finding in its own chrome for the fifth time — after
  // `stMembers`, the Security panel's Run scan, the effort dial and Publish.
  for (const html of [panel(true), panel(false)]) {
    assert.ok(!/<button/.test(html), "the panel grew a button for a feature that does not exist");
    assert.ok(!/onclick|data-act|href=/.test(html), "the panel grew a control");
  }
  // THE OBSERVER IS ALIVE: it really is reading the panel's markup, so the
  // absences above are absences in the product and not in this reader.
  assert.match(panel(true), /class="st-mob-empty"/, "the panel's empty state is gone — this reader sees nothing");
});

// ── THE DOOR ────────────────────────────────────────────────────────────────

test("the toggle is drawn on every workspace, built or not", () => {
  assert.match(BARE, /id="stMobile"/, "the mobile app toggle is gone from the top bar");
  // NOT gated on having built. Hiding a control is how a customer never learns
  // it is there — the rule the site cards' three icons settled. What differs by
  // state is the sentence inside, which is true either way.
  const bar = span(BARE, "'<div class=\"st-tb-right\">'", "id=\"stShare\"", "the top bar's right group");
  assert.ok(bar.includes('id="stMobile"'), "the toggle left the top bar's right group");
  assert.ok(!/isReact[^\n]*id="stMobile"|id="stMobile"[^\n]*isReact/.test(BARE),
    "the toggle is gated on the site having built — the Code tab's own defect, one bar over");
});

test("the state reaches the button's own markup, not only the click handler", () => {
  // ADDED AFTER A SWEEP SURVIVOR, and the gap is worth naming: every assertion
  // about the lit button read the HANDLER, which lights it on click. The markup
  // redraws that button on every builder reply, so with `(siteMobileOpen ? ' on'
  // : '')` cut, the panel would be open and its control unlit from the next
  // reply onward — and no case here could see it. A guard proves the branch it
  // drives, so the branch is driven from both ends now.
  const btn = BARE.split("\n").find((l) => l.includes('id="stMobile"'));
  assert.ok(btn, "the toggle is gone from the top bar");
  assert.match(btn, /class="st-icon' \+ \(siteMobileOpen \? ' on' : ''\)/,
    "the toggle's lit state is not drawn from the flag — it would go dark on the next re-render");
  assert.match(btn, /siteMobileOpen \? 'Hide the mobile app' : 'Show the mobile app'/,
    "the tooltip is not drawn from the flag — it would go stale on the next re-render");
});

test("the toggle's glyph is not the phone-WIDTH button's", () => {
  // `phone` is already `.st-dev[data-dev="phone"]`, two positions along the same
  // bar. Two phone icons in one row meaning different things is a control
  // nobody can read, so this draws a panel with a divider on the right — the
  // mirror of the chat rail's toggle, whose divider is at x=9.
  assert.match(BARE, /id="stMobile"[^\n]*ic\('sidebar', 17\)/,
    "the mobile toggle no longer draws the `sidebar` glyph");
  const icons = span(BARE, "const ST_ICONS = {", "\n};", "the icon table");
  const sidebar = icons.match(/^\s*sidebar: '(.+)',$/m);
  const phone = icons.match(/^\s*phone: '(.+)',$/m);
  assert.ok(sidebar, "the `sidebar` glyph is gone from ST_ICONS");
  assert.ok(phone, "the `phone` glyph is gone — re-anchor this comparison");
  assert.notEqual(sidebar[1], phone[1], "the mobile toggle and the phone-width button draw the same glyph");
  assert.match(sidebar[1], /M15 4v16/, "the divider moved off the right — this reads as the chat rail's toggle");
});

/** The real toggle handler, cut out and driven against a fake document. */
function driveToggle(startOpen) {
  const src = span(BARE, "const mobTog = document.getElementById('stMobile');", "\n  };", "the toggle handler") + "\n  };";
  const ws = { cls: new Set(startOpen ? ["st-ws", "st-mob-open"] : ["st-ws"]) };
  ws.classList = { toggle: (c, on) => (on ? ws.cls.add(c) : ws.cls.delete(c)) };
  const btn = { cls: new Set(startOpen ? ["on"] : []), title: "" };
  btn.classList = { toggle: (c, on) => (on ? btn.cls.add(c) : btn.cls.delete(c)) };
  const scope = {
    document: { getElementById: (id) => (id === "stMobile" ? btn : null) },
    view: { querySelector: (s) => (s === ".st-ws" ? ws : null) },
    siteMobileOpen: startOpen,
  };
  // `if (false)` leaves a call exactly where a source read looks for it — the
  // recorded trap — so the handler is RUN rather than read.
  const run = new Function("document", "view", "siteMobileOpen", src + "; mobTog.onclick(); return siteMobileOpen;");
  const after = run(scope.document, scope.view, scope.siteMobileOpen);
  return { open: after, wsHas: ws.cls.has("st-mob-open"), lit: btn.cls.has("on"), title: btn.title };
}

test("pressing the toggle opens the column, lights the button and renames itself", () => {
  const opened = driveToggle(false);
  assert.equal(opened.open, true, "the flag did not flip");
  assert.equal(opened.wsHas, true, "the workspace did not gain the open class — the column stays hidden");
  assert.equal(opened.lit, true, "the button did not light");
  assert.equal(opened.title, "Hide the mobile app", "the tooltip still offers to show an open panel");

  const closed = driveToggle(true);
  assert.equal(closed.open, false, "the flag did not flip back");
  assert.equal(closed.wsHas, false, "the column stayed open");
  assert.equal(closed.lit, false, "the button stayed lit over a closed panel");
  assert.equal(closed.title, "Show the mobile app", "the tooltip still offers to hide a closed panel");
});

test("the toggle changes a class and never re-renders", () => {
  const fn = span(BARE, "const mobTog = document.getElementById('stMobile');", "\n  };", "the toggle handler");
  // The reason the class exists at all: a re-render reloads the preview iframe
  // and eats a half-typed message. Both are driven live in the scratchpad; what
  // this holds is that the handler cannot start doing it.
  assert.ok(!/renderSites\(\)/.test(fn), "the toggle re-renders the workspace, which reloads the preview");
});

// ── THE FRAME ───────────────────────────────────────────────────────────────

test("the phone is bounded on both axes, so it can never overflow its column", () => {
  const dev = span(CSS_BARE, ".st-mob-device {", "}", "the phone frame");
  // `height: 100%` computed WIDER than the column and overflowed it sideways —
  // measured while mocking this up. Width leads, height is capped.
  assert.match(dev, /width:\s*100%/, "the phone no longer takes its width from the column");
  assert.match(dev, /max-height:\s*100%/, "the phone can now grow past the bottom of its column");
  assert.ok(!/[^-]height:\s*100%/.test(dev), "the phone is sized from a height again — that overflowed sideways");
  assert.match(dev, /aspect-ratio:\s*390\s*\/\s*844/, "the frame is no longer phone-shaped");

  // The bezel takes the palette's own darkest lead, never a literal: this app is
  // one theme drawn in pencil on paper and a hex here would sit outside it.
  assert.match(dev, /border:\s*9px solid var\(--graphite\)/, "the bezel is not drawn in the palette's own ink");
});

test("the column is bounded so it cannot squeeze the preview on a narrow window", () => {
  const col = span(CSS_BARE, "\n.st-mob {", "}", "the column");
  assert.match(col, /flex:\s*0 0 clamp\(/,
    "the column has a fixed width again — at 1200px that leaves the preview ~300px between a 450px rail and it");
});
