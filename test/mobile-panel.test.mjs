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
//        → `setMobileOpen()`                (the ONE writer, since 2026-09-09)
//             ↑ `#stMobile`.onclick         (the top bar's toggle)
//             ↑ `#stMobileTab`.onclick      (the edge tab — opens only)
//
// The edge tab arrived 2026-09-09 (owner: "it gotta show it like a hidden
// sidebar tho, not like a button opens it") and is the reason there is a setter
// at all: two controls doing the same thing by two copies of the same lines is
// the recorded "two lists of the same thing", and the copy that would go stale
// is the tab's — the one a customer meets first.
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
  // The argument list grew a second entry (the phone) on 2026-09-08; the
  // property is the unconditional call on its own line, so the arguments are
  // matched as a group rather than pinned.
  const call = BARE.match(/^\s*siteMobilePanel\(([^)]*)\) \+$/m);
  assert.ok(call, "the panel is no longer rendered on its own line in the workspace body");
  assert.match(call[1], /siteMobileOs/, "the panel is not handed which phone to draw");
  assert.ok(!/siteMobileOpen\s*\?\s*siteMobilePanel/.test(BARE),
    "the panel is rendered conditionally — the toggle now needs a re-render, which reloads the preview");

  // ONE CALL SITE, COUNTED. The composer being perfect while its one call is
  // cut is how the card icons shipped with no icons on any card.
  const calls = [...BARE.matchAll(/siteMobilePanel\(/g)].length;
  assert.equal(calls, 2, "expected the definition plus exactly one call site, found " + calls);
});

/** The real `siteMobilePanel`, cut out and evaluated — never retyped. */
function realPanel() {
  // RE-ANCHORED 2026-09-08: the panel takes the phone as a second argument now
  // (`hasSite, os`), so this cut named a signature that had moved. The property
  // is that the real function is evaluated rather than retyped, which is why the
  // name is matched without its parameter list.
  const at = BARE.indexOf("function siteMobilePanel(");
  assert.ok(at >= 0, "siteMobilePanel is gone");
  const src = span(BARE.slice(at), "function siteMobilePanel(", "\n}", "siteMobilePanel") + "\n}";
  // It closes over MOBILE_OSES, so that comes with it — a free identifier
  // resolves when the line RUNS, and a bare scope is what proves it is carried.
  const list = BARE.match(/^const MOBILE_OSES = \[[^\]]+\];$/m);
  assert.ok(list, "MOBILE_OSES is gone");
  // AND SINCE 2026-09-09 IT ALSO CLOSES OVER `MOBILE_LABELS` — the words live in
  // one place because they are on the switch AND under each frame once the panel
  // is dragged wide enough to show both phones. Taken out of the FILE, for the
  // reason below: this is the FOURTH closed-over name this one function has
  // gained, and every one of them was invisible until the scope was built bare.
  const labels = BARE.match(/^const MOBILE_LABELS = \{[^}]+\};$/m);
  assert.ok(labels, "MOBILE_LABELS is gone — the switch and the captions have no shared list");
  // AND SINCE 2026-09-08 IT ALSO CLOSES OVER `brandMark`, which reaches
  // `BRAND_MARKS`. Both come out of the FILE, never stubbed: a stub answering
  // `''` would leave every assertion about which mark lands on which segment
  // blind, which is the "a less-capable fake hides bugs" trap pointed at the one
  // thing this change adds.
  // Built in a bare scope on purpose: a free identifier resolves when the line
  // RUNS, not when the file loads, so reading this function could never prove it
  // works. That trap has cost this repository four separate misses in one
  // session, one of which reached main.
  return new Function(list[0] + "\n" + labels[0] + "\n" + marksSrc() + "\n" + src + "; return siteMobilePanel;")();
}

/** The real mark table and its real emitter, cut out of the file. */
function marksSrc() {
  const table = span(BARE, "const BRAND_MARKS = {", "\n};", "BRAND_MARKS") + "\n};";
  const fn = span(BARE, "function brandMark(name, size) {", "\n}", "brandMark") + "\n}";
  return table + "\n" + fn;
}
function realMark() {
  return new Function(marksSrc() + "; return { mark: brandMark, table: BRAND_MARKS };")();
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

test("nothing in the panel promises an app, and that is the decision", () => {
  const panel = realPanel();
  // RE-ANCHORED 2026-09-08, and which spelling moved matters. This asserted the
  // panel had NO button at all, which was true when the panel held one sentence
  // and became false when the owner asked for the phone switch. The property was
  // never "no buttons" — it is that nothing here promises a thing that does not
  // exist (owner, asked directly: "no button, just the sentence"), because that
  // is the open dead-control finding this repo has met five times.
  //
  // So: the EMPTY STATE — where a "Build the mobile app" button would go — has no
  // control, and every button in the panel is a phone segment, which changes what
  // you are looking at and is therefore real.
  for (const html of [panel(true, "ios"), panel(false, "android")]) {
    const empty = span(html, '<div class="st-mob-empty">', "</div>", "the empty state");
    assert.ok(!/<button|onclick|href=/.test(empty), "the empty state grew a control for a feature that does not exist");
    // EVERY `<button`, not just the ones carrying a class. The first version of
    // this matched `<button …class="…">` and so could not see
    // `<button>Build the mobile app</button>` at all — a classless control is
    // still a control, and that one is precisely what was ruled out.
    const opens = [...html.matchAll(/<button([^>]*)>/g)].map((m) => m[1]);
    assert.ok(opens.length > 0, "no buttons at all — this reader sees nothing");
    for (const attrs of opens) {
      assert.match(attrs, /class="[^"]*st-mob-osbtn/,
        "a button in the panel is not a phone segment: <button" + attrs + ">");
    }
  }
  // THE OBSERVER IS ALIVE: it really is reading the panel's markup, so the
  // absences above are absences in the product and not in this reader.
  assert.match(panel(true, "ios"), /class="st-mob-empty"/, "the panel's empty state is gone — this reader sees nothing");
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
  // RE-ANCHORED 2026-09-09: this pinned `class="st-icon' + (siteMobileOpen …`
  // verbatim, and the class list gained `st-mob-btn` — the name the stylesheet
  // hides the button on off Preview. The property was never the list, it is that
  // the lit state is written INSIDE the class attribute, so the window runs from
  // the attribute to the id and the rest of the list is not pinned.
  const cls = span(btn, 'class="', '" id="stMobile"', "the toggle's class attribute");
  assert.match(cls, /\(siteMobileOpen \? ' on' : ''\)/,
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

/**
 * The end landmark of the block that holds the setter and both wire-ups.
 *
 * It is the NEXT STATEMENT, not either wire-up's own text, deliberately: a
 * window that ends on the line under test collapses the moment that line is
 * edited, so every mutant aimed at the tab would die by breaking the window
 * rather than by failing the property it was aimed at — and a sweep whose
 * mutants all kill for the same incidental reason proves nothing about the
 * assertions underneath.
 */
const WIRE_END = "view.querySelectorAll('.st-mob-osbtn')";
// RE-ANCHORED 2026-09-09: the tab is a DRAG HANDLE now, so it is wired on
// pointer events rather than `onclick` — a click is simply a press that did not
// move. The property is unchanged: the tab reaches the shared setter.
const TAB_WIRE = "mobTab.onpointerdown";

/**
 * The real setter and BOTH controls, cut out and driven against a fake document.
 *
 * RE-ANCHORED 2026-09-09, not appeased. The top bar's handler used to hold the
 * whole body inline and this window ran to its own `\n  };`. The body moved into
 * `setMobileOpen` when the edge tab arrived and needed the identical code — the
 * property asserted below (press it, the class moves, the button lights and
 * renames itself) is exactly what it always was; only where the lines live
 * moved. The window now spans the setter and both wire-ups, so a control that
 * stopped being wired is still caught.
 */
function driveMobile(startOpen, which, dragTo, startW) {
  const src = span(BARE, "const setMobileOpen = (open) => {", WIRE_END,
                   "the mobile setter and its two controls");
  const ws = { cls: new Set(startOpen ? ["st-ws", "st-mob-open"] : ["st-ws"]), css: {} };
  ws.classList = { toggle: (c, on) => (on ? ws.cls.add(c) : ws.cls.delete(c)) };
  ws.style = { setProperty: (k, v) => { ws.css[k] = v; } };
  const btn = { cls: new Set(startOpen ? ["on"] : []), title: "" };
  btn.classList = { toggle: (c, on) => (on ? btn.cls.add(c) : btn.cls.delete(c)) };
  const tab = {};
  // A row 1000 wide holding a 450 rail, so the measured ceiling is a real
  // number rather than a constant this file typed — the ceiling is "until the
  // chatbox", which is a place on screen.
  const box = (w) => ({ getBoundingClientRect: () => ({ width: w }) });
  const panel = Object.assign(box(startOpen ? 393 : 0), {});
  const rail = Object.assign(box(450), { offsetParent: {} });
  const body = box(1000);
  const doc = { getElementById: (id) => (id === "stMobile" ? btn : id === "stMobileTab" ? tab : null) };
  const view = { querySelector: (sel) => ({ ".st-ws": ws, ".st-mob": panel, ".st-rail": rail, ".st-body": body }[sel] || null) };
  // `if (false)` leaves a call exactly where a source read looks for it — the
  // recorded trap — so the handlers are RUN rather than read. The tab is
  // pointer-driven since it became a drag handle, so a click on it is a press
  // that did not move: down, then up, at the same place.
  const press = which === "tab"
    ? "mobTab.onpointerdown({ clientX: 900, pointerId: 1, preventDefault() {} });"
      + (dragTo == null ? "" : "mobTab.onpointermove({ clientX: " + dragTo + " });")
      + "mobTab.onpointerup();"
    : "mobTog.onclick();";
  const run = new Function("document", "view", "siteMobileOpen", "siteMobileW", "MOBILE_MIN_W",
    src + "; " + press + " return siteMobileOpen;");
  const after = run(doc, view, startOpen, startW === undefined ? null : startW, 300);
  return { open: after, wsHas: ws.cls.has("st-mob-open"), lit: btn.cls.has("on"),
           title: btn.title, width: ws.css["--mob-w"] || null };
}

/** The room this harness's fake row leaves: 1000 wide, a 450 rail, one gap. */
const FAKE_ROOM = 1000 - 450 - 26;

test("pressing the toggle opens the column, lights the button and renames itself", () => {
  const opened = driveMobile(false, "btn");
  assert.equal(opened.open, true, "the flag did not flip");
  assert.equal(opened.wsHas, true, "the workspace did not gain the open class — the column stays hidden");
  assert.equal(opened.lit, true, "the button did not light");
  assert.equal(opened.title, "Hide the mobile app", "the tooltip still offers to show an open panel");

  const closed = driveMobile(true, "btn");
  assert.equal(closed.open, false, "the flag did not flip back");
  assert.equal(closed.wsHas, false, "the column stayed open");
  assert.equal(closed.lit, false, "the button stayed lit over a closed panel");
  assert.equal(closed.title, "Show the mobile app", "the tooltip still offers to hide a closed panel");
});

test("the toggle changes a class and never re-renders", () => {
  const fn = span(BARE, "const setMobileOpen = (open) => {", WIRE_END, "the setter and its controls");
  // The reason the class exists at all: a re-render reloads the preview iframe
  // and eats a half-typed message. Both are driven live in the scratchpad; what
  // this holds is that neither control can start doing it.
  assert.ok(!/renderSites\(\)/.test(fn), "opening the panel re-renders the workspace, which reloads the preview");
});

// ── THE EDGE TAB ────────────────────────────────────────────────────────────
//
// (2026-09-09, owner: "it gotta show it like a hidden sidebar tho, not like a
// button opens it".) Before this the panel was reachable only through an
// unlabelled icon in the top bar — invisible to anybody who had not been told.
// The tab is the closed panel's own edge, so the feature is on screen.

test("the closed panel has a visible edge, and it is a real named button", () => {
  const line = BARE.split("\n").find((l) => l.includes('id="stMobileTab"'));
  assert.ok(line, "the edge tab is gone — the panel is invisible again until you find the top bar's icon");
  assert.match(line, /<button type="button"/, "the tab is not a button, so it is not reachable by keyboard");
  assert.match(line, /title="Show the mobile app"/, "the tab lost its tooltip");
  assert.match(line, /aria-label="Show the mobile app"/, "the tab lost its accessible name");
  assert.match(line, /ic\('chevronleft', 13\)/, "the tab's glyph moved");
});

test("the tab is the panel's sibling in the row, not a stray in the top bar", () => {
  // Derived from where the panel itself is rendered: the tab must sit between
  // `siteMobilePanel(...)` and the close of `.st-body`, which is what makes the
  // stylesheet's `right: 0` land on that row's edge rather than the page's.
  const tail = span(BARE, "siteMobilePanel(hasSite, siteMobileOs)", "\n    '</div>';", "the end of .st-body");
  assert.ok(tail.includes('id="stMobileTab"'),
    "the tab left .st-body, so it no longer positions against the row it belongs to");
});

test("the chevron is its own glyph, because `back` carries a shaft", () => {
  const icons = span(BARE, "const ST_ICONS = {", "\n};", "the icon set");
  const chev = icons.match(/chevronleft: '([^']+)'/);
  assert.ok(chev, "chevronleft is gone from the icon set — the tab draws nothing");
  const back = icons.match(/\n  back: '([^']+)'/);
  assert.ok(back, "the back glyph is gone, so this comparison proves nothing");
  assert.notEqual(chev[1], back[1], "the tab reuses `back`, whose shaft reads as a strikethrough at 18px");
  assert.ok(!/M19 12H5/.test(chev[1]), "the chevron grew the shaft this entry exists to avoid");
});

test("ONE setter drives both controls, so they cannot disagree", () => {
  assert.match(BARE, /const setMobileOpen = \(open\) => \{/, "the shared setter is gone");
  // The class is written in exactly one place. A second copy is the recorded
  // "two lists of the same thing", and the copy that went stale would be the
  // tab's — the control a customer finds first and nobody is testing.
  const writes = [...BARE.matchAll(/classList\.toggle\('st-mob-open'/g)].length;
  assert.equal(writes, 1, "the open class is written in " + writes + " places, not one");
  assert.match(BARE, /if \(mobTog\) mobTog\.onclick = \(\) => setMobileOpen\(!siteMobileOpen\);/,
    "the top bar button stopped going through the setter");
  const wire = span(BARE, "const setMobileOpen = (open) => {", WIRE_END, "the setter and its controls");
  assert.ok(wire.includes(TAB_WIRE), "the edge tab stopped going through the setter");
});

test("pressing the tab opens the panel AND lights the top bar's button", () => {
  const r = driveMobile(false, "tab");
  assert.equal(r.open, true, "the tab did not open the panel");
  assert.equal(r.wsHas, true, "the workspace did not gain the open class");
  assert.equal(r.lit, true, "the tab opened the panel and left the top bar's button unlit — the two disagree");
  assert.equal(r.title, "Hide the mobile app", "the top bar's tooltip still offers to show an open panel");
});

test("a press that does not move opens a shut panel and shuts an open one", () => {
  // INVERTED 2026-09-09, and the reason is a layer below it moving — the
  // recorded "a rule true because of a layer below it expires when that layer
  // moves". This asserted that the tab could only OPEN, which was right while
  // the stylesheet hid it behind the open panel: a closing branch was one
  // nothing could reach, and an unreachable branch is one nobody guards. The
  // tab is a DRAG HANDLE now and stays on screen while the panel is open, so
  // the branch is reachable and the tab must close.
  assert.equal(driveMobile(false, "tab").open, true, "a press on the shut tab did not open the panel");
  assert.equal(driveMobile(true, "tab").open, false, "a press on the open tab did not shut the panel");
});

test("a press that DOES move resizes instead of shutting", () => {
  // The same gesture, with the pointer moved: the panel must stay open and take
  // a width. Without this the drag would end in `end()`'s click branch and shut
  // the panel the moment you let go of it.
  const r = driveMobile(true, "tab", 600);
  assert.equal(r.open, true, "dragging the tab shut the panel when the pointer was released");
  assert.ok(r.width, "the drag set no width");
  assert.ok(parseInt(r.width, 10) > 300, "the drag did not widen the panel: " + r.width);
  // THE CEILING IS MEASURED. A 1000-wide row holding a 450 rail leaves ~537,
  // so a drag past it is clamped rather than running under the chat.
  const far = driveMobile(true, "tab", -5000);
  assert.ok(parseInt(far.width, 10) <= 550,
    "the panel dragged past the chat rail: " + far.width);
});

test("the tab wears the panel's own edge, and goes when the panel arrives", () => {
  // RE-ANCHORED 2026-09-09: this took the FIRST `.st-mob-tab {` in the sheet,
  // and the Preview-only gate above it now opens with one. The property is the
  // tab's OWN base rule, so it is anchored on the selector standing alone at the
  // start of a line — a compound selector cannot satisfy it.
  const rule = span(CSS_BARE, "\n.st-mob-tab {", "}", "the tab's own rule");
  assert.match(rule, /position: absolute/, "the tab is no longer positioned against the row");
  assert.match(rule, /right: 0/, "the tab left the right edge");
  assert.match(rule, /border-right: none/, "the tab regained its right border and reads as a floating button");
  assert.match(rule, /border-radius: 10px 0 0 10px/, "the tab is rounded on all four corners, so it stops reading as an edge");
  assert.match(rule, /background: var\(--panel-2\)/, "the tab stopped taking the panel's ground");
  assert.match(CSS_BARE, /\.st-body \{[^}]*position: relative/,
    "`.st-body` is not a containing block, so the tab positions against the page instead of the row");

  // THE DIRECTION IS THE PROPERTY. Hidden when OPEN; a rule hiding it when
  // CLOSED is the defect this whole change exists to fix, and it would still
  // match a looser "there is a display:none somewhere" check.
  // RE-ANCHORED 2026-09-09: the tab used to be hidden once the panel opened,
  // which was right while it only opened. It SIZES now, and a handle you cannot
  // reach once the panel is open is a handle for one gesture. So it stays — and
  // rides the panel's left edge by reading the same `--mob-w` the panel's own
  // basis reads, which is what makes it track a drag with nothing in JavaScript
  // moving it.
  // RE-ANCHORED 2026-09-09: this forbade `display: none` on the tab ANYWHERE,
  // which was right while the only reason to hide it was the panel being open.
  // There is a second reason now — the whole feature is the preview's — and a
  // blanket ban cannot tell the two apart. The property is unchanged and is
  // narrowed to the spelling that carries it: the OPEN panel may not hide it.
  assert.ok(!/\.st-ws\.st-mob-open[^{]*\.st-mob-tab\s*\{[^}]*display:\s*none/.test(CSS_BARE),
    "the tab is hidden once the panel opens — it is the drag handle now and must stay reachable");
  assert.ok(!/\n\.st-mob-tab\s*\{[^}]*display:\s*none/.test(CSS_BARE),
    "the tab's own base rule hides it, so it never appears at all");
  // RE-ANCHORED 2026-09-09: this pinned `right: calc(var(--mob-w` — the `calc`
  // was there to add the flex gap that used to sit between the stage and the
  // panel. The panel OVERLAYS the stage now, so there is no gap and the offset
  // is the width alone. The property was never the arithmetic: it is that the
  // open tab's offset reads the SAME dragged value the panel's width reads, so
  // the two track each other with nothing in JavaScript moving the tab.
  const openTab = span(CSS_BARE, "\n.st-ws.st-mob-open .st-mob-tab {", "}", "the open tab's offset");
  assert.match(openTab, /right: var\(--mob-w/,
    "the open tab does not follow the panel's edge, so a drag would leave it behind");
  // AND IT SITS FLUSH, which is the half the overlay added — measured 0px.
  // RE-AIMED at the way a gap can actually come back: a `calc` wrapper is
  // already caught by the match above (it is not `right: var(`), so a check for
  // one is a wall behind a wall and this repo's own inert-mutant trap. What
  // survives that match is a SECOND declaration shifting the tab beside the
  // offset, which is exactly how the .8rem would be restored by anyone who saw
  // the offset was already right.
  for (const shift of ["margin-right", "margin-left", "translate", "transform"]) {
    assert.ok(!new RegExp(shift + ":").test(openTab),
      "the open tab is shifted off the panel's edge by `" + shift + "`, so it no longer sits on it");
  }
  assert.match(openTab, /cursor: ew-resize/,
    "the open tab does not say it resizes — the pointer is the only hint before you try");
  // INVERTED 2026-09-09, and the inversion is the point. This required the open
  // tab to take its right border back and square up, on the argument that an
  // open panel makes it "a seam between two panels rather than an edge on one".
  // That was true while a .8rem flex gap separated the two; against an overlay
  // the tab is FLUSH, so squaring up draws its own right border directly against
  // the panel's left one — 2px of double line where there is a single edge. The
  // recorded "a rule true because of a layer below it expires when that layer
  // moves", so the rule goes rather than being adjusted: open and closed are one
  // look now, the panel's own edge protruding left, which is what the tab has
  // always been. The base rule's dropped border is asserted above, and it is the
  // thing this must not undo.
  assert.ok(!/\.st-mob-open \.st-mob-tab \{[^}]*border-right: 1px/.test(CSS_BARE),
    "the open tab squares up against the panel it is flush with, drawing a double border on one edge");
  assert.ok(!/\.st-mob-open \.st-mob-tab \{[^}]*border-radius: 10px;/.test(CSS_BARE),
    "the open tab rounds all four corners again, so it stops reading as the panel's own edge");
});

// ── THE WHOLE COLUMN IS THE PREVIEW'S ───────────────────────────────────────
//
// (2026-09-09, owner: "so i wanna to tell to only show it in the preview , so
// wahtevr you did , i dont think it was the right thing".) It showed on Code and
// More alike — a phone frame beside a file tree, which is a column about
// nothing. All THREE controls go together: the panel, the edge tab that opens
// and resizes it, and the top bar's toggle. A door to a room that is not there
// is the dead control this app has now found five times in its own chrome.

/** The real `stStageView`, cut out and evaluated — never retyped. */
function realStageView() {
  const src = span(BARE, "const stStageView = (view, hasData) =>", ";\n", "stStageView") + ";";
  return new Function(src + " return stStageView;")();
}

/** The class the MARKUP writes for "the preview is showing" — derived, never typed. */
function pvClass() {
  const m = BARE.match(/\(stageView === 'preview' \? ' ([a-z-]+)' : ''\)/);
  assert.ok(m, "the workspace root no longer says whether the preview is what the stage is showing");
  return m[1];
}

test("the gate reads what the stage is SHOWING, not what was asked for", () => {
  const stageView = realStageView();
  assert.equal(stageView("preview", true), "preview");
  assert.equal(stageView("code", true), "code");
  assert.equal(stageView("code", false), "code", "Code is offered whether or not the site has a database");
  assert.equal(stageView("more", true), "more");
  assert.equal(stageView("data", true), "data");

  // THE CASE THE FUNCTION EXISTS FOR, and the reason the gate is not
  // `siteView === 'preview'`. `siteView` is module scope and outlives the site
  // it was set on; the Data tab is only drawn for a site that HAS a database. So
  // a site without one can arrive carrying 'data' — and the stage's own chain
  // falls through to the preview. Read as 'data', the phone would be hidden
  // beside a preview, which is exactly what the owner asked against.
  assert.equal(stageView("data", false), "preview",
    "a site with no database that was asked for Data reads as Data, while the stage shows it the preview");

  // Anything unknown is the preview, because the chain's last arm is. And the
  // comparisons are strict: `String(['code'])` is `'code'`, the recorded
  // coercion trap, on the value that decides which pane a customer is looking at.
  for (const junk of ["", null, undefined, "nonsense", ["code"], ["data"], {}, 0])
    assert.equal(stageView(junk, true), "preview",
      "an unknown view is not read as the preview: " + JSON.stringify(junk));
});

test("the stage and the phone ask ONE question, so they cannot disagree", () => {
  const call = BARE.match(/const stageView = stStageView\(siteView, ([^)]*\)?[^)]*)\);/);
  assert.ok(call, "the render no longer resolves which view the stage is showing");
  assert.match(call[1], /site\.backend/,
    "the data arm is decided without asking whether the site has a database, so the fall-through case is invented rather than read");

  // AND THE STAGE ITSELF ASKS IT. Written twice — a chain here and a gate on the
  // root — the two would differ in exactly the fall-through case above, which is
  // the one nobody would think to test. Landmark to landmark, both ends asserted
  // by `span`.
  const stage = span(BARE, "'<div class=\"st-stage\"", 'id="stFixBar"', "the stage's own chain");
  for (const v of ["code", "data", "more"])
    assert.match(stage, new RegExp("stageView === '" + v + "'"),
      "the stage's " + v + " arm no longer reads the resolved view");
  const own = [...stage.matchAll(/siteView ===/g)].length;
  assert.equal(own, 0,
    "the stage kept " + own + " comparison(s) of its own against `siteView` — it can now disagree with the phone's gate");
});

test("the preview's class rides the workspace root, beside the panel's own state", () => {
  const cls = pvClass();
  // ON THE SAME ELEMENT AS THE OPEN CLASS AND THE STORED WIDTH — three facts
  // about one panel, one tag — and found by asking which expression writes the
  // open class rather than by naming the element. To the `>` that closes the
  // opening tag, so a class written on some other node cannot satisfy it.
  const at = BARE.indexOf("(siteMobileOpen ? ' " + openClass() + "' : '')");
  assert.ok(at >= 0, "the open class is no longer written into the workspace root");
  const tag = span(BARE.slice(at), "(siteMobileOpen ?", "'>' +", "the workspace root's attributes");
  assert.match(tag, new RegExp("' " + cls + "'"),
    "the preview class is on some other element than the one carrying the panel's state, so the CSS cannot reach the panel from it");
});

test("off Preview the column, its tab and its button all go", () => {
  const cls = pvClass();
  // EVERY RULE DERIVED from the class the markup writes: a rename in one file
  // and not the other would leave the gate keying on a class nothing writes, and
  // nothing would fail — the panel would simply be gone everywhere.
  const hides = (sel, how) =>
    new RegExp("\\.st-ws:not\\(\\." + cls + "\\) " + sel + " \\{[^}]*" + how);
  assert.match(CSS_BARE, hides("\\.st-mob", "display:\\s*none"),
    "the column still shows off Preview — the defect this change exists to fix");
  assert.match(CSS_BARE, hides("\\.st-mob-tab", "display:\\s*none"),
    "the edge tab still shows off Preview, so it opens a column that is not there");
  assert.match(CSS_BARE, hides("\\.st-mob-btn", "visibility:\\s*hidden"),
    "the top bar's toggle still shows off Preview, so it toggles a column that is not there");

  // THE DIRECTION IS THE PROPERTY, as it is for the open class. `:not(...)`
  // hides, so Preview is where they live; inverted, they would show on every
  // view BUT Preview, and a looser "there is a display:none somewhere" check
  // would pass on it happily.
  for (const sel of ["\\.st-mob", "\\.st-mob-tab", "\\.st-mob-btn"])
    assert.ok(!new RegExp("\\.st-ws\\." + cls + " " + sel + " \\{[^}]*(display:\\s*none|visibility:\\s*hidden)").test(CSS_BARE),
      "the gate is inverted — " + sel.replace(/\\/g, "") + " is hidden ON Preview and shown everywhere else");
});

test("the button keeps its space when it goes, or the view tabs move", () => {
  const cls = pvClass();
  // TWO MECHANISMS, AND THE SPLIT IS NOT COSMETIC. The panel and the tab are in
  // `.st-body` and giving their space back to the pane is the point. The button
  // is in the top bar, whose two side groups split the width between them — so a
  // button that LEFT the flow would move the centred view tabs every time you
  // changed view. Measured: `.st-vtabs` left edge 611px on Preview, Code and
  // More alike with `visibility`.
  assert.ok(!new RegExp("\\.st-ws:not\\(\\." + cls + "\\) \\.st-mob-btn \\{[^}]*display:\\s*none").test(CSS_BARE),
    "the toggle leaves the flow off Preview, so the centred view tabs move on every view change");
  // The precedent it follows, asserted ALIVE so the reason above is not a claim
  // about a rule that has been deleted.
  assert.match(CSS_BARE, /\.st-tb-pv-off \{ visibility: hidden; \}/,
    "`.st-tb-pv-off` is gone — the reason above names it, so re-anchor on whatever replaced it");
});

test("the class the stylesheet hides the button on is the class the markup writes", () => {
  // DERIVED FROM THE SHEET and checked against the markup, which is the
  // direction that catches the drift: the rule keys on a name, and if the button
  // stops carrying it the button simply never hides and nothing fails.
  const m = CSS_BARE.match(/\.st-ws:not\(\.[a-z-]+\) \.([a-z-]+) \{[^}]*visibility:\s*hidden/);
  assert.ok(m, "the stylesheet no longer hides the toggle off Preview");
  const btn = BARE.split("\n").find((l) => l.includes('id="stMobile"'));
  assert.ok(btn, "the toggle is gone from the top bar");
  const cls = span(btn, 'class="', '" id="stMobile"', "the toggle's class attribute");
  assert.ok(cls.includes(m[1]),
    "the stylesheet hides `." + m[1] + "` and the toggle does not carry it, so it shows on every view");
  // AND NOT BY ID. The sheet keys on classes throughout; an id rule here would
  // be the only one in the file, and the id belongs to the handler.
  assert.ok(!/#stMobile/.test(CSS_BARE),
    "the stylesheet reaches for the toggle by id — the id is the handler's, the class is the sheet's");
});

test("a trip through Code leaves the panel exactly as it was", () => {
  // The gate is CSS on a class, so nothing clears the open flag or the stored
  // width — which is the property that makes coming back to Preview show what
  // you left. Driven in the scratchpad (open, dragged to 643px, Code, More,
  // Preview: still open, still 643px); asserted here by counting the writers,
  // with each named so the observer is proved alive.
  const opens = [...BARE.matchAll(/siteMobileOpen = /g)].map((m) =>
    BARE.slice(BARE.lastIndexOf("\n", m.index) + 1, m.index + 20).trim());
  assert.equal(opens.length, 2,
    "expected the declaration and `setMobileOpen` to be the only writers of the open flag, found: " + JSON.stringify(opens));
  assert.match(opens[0], /^let siteMobileOpen = /, "the first writer is no longer the declaration");
  const widths = [...BARE.matchAll(/siteMobileW = /g)].length;
  assert.equal(widths, 2,
    "expected the declaration and `setMobileW` to be the only writers of the stored width, found " + widths);

  // AND THE PANEL IS STILL UNCONDITIONALLY RENDERED. Gating the markup on the
  // view instead would work — a view switch re-renders anyway — but it would
  // also make the TOGGLE need a re-render the day somebody folded the two, and
  // that reloads the preview iframe and eats a half-typed message.
  assert.ok(!/stageView[^\n]*\?\s*siteMobilePanel/.test(BARE),
    "the panel is rendered only on the preview — the CSS is the gate, so the markup stays unconditional");
});

// ── DRAGGED WIDE, AND TWO PHONES AT ONCE ────────────────────────────────────
//
// (2026-09-09, owner: "that tab can be dragaable and open until the chatbox in
// the left … it can show the two layouts one next to each other".)

test("both phones are always in the markup, so widening never re-renders", () => {
  const panel = realPanel();
  const html = panel(true, oses()[0]);
  for (const os of oses()) {
    assert.match(html, new RegExp('st-mob-one" data-os="' + os + '"'),
      "the panel does not carry a box for " + os);
  }
  // If only the selected phone were rendered, showing both would need a
  // re-render — which reloads the preview and eats a half-typed message, the
  // two properties this whole panel is built around.
  const boxes = [...html.matchAll(/class="st-mob-one"/g)].length;
  assert.equal(boxes, oses().length, "expected one box per phone, found " + boxes);
  assert.match(html, /class="st-mob" data-os="/,
    "the selection left the panel, so the stylesheet cannot pick which one shows");
});

test("CSS decides how many phones show, and the direction is the property", () => {
  // Narrow: the switch's pick, and only it. Wide: both. The widening rule must
  // be at least as specific as the narrow one AND come after it, or the second
  // phone never appears however far you drag — the specificity is the feature.
  const narrow = /\.st-mob\[data-os="ios"\] \.st-mob-one\[data-os="ios"\],\n\.st-mob\[data-os="android"\] \.st-mob-one\[data-os="android"\] \{ display: grid; \}/;
  assert.match(CSS_BARE, narrow, "the narrow rule no longer shows the selected phone");
  const q = span(CSS_BARE, "@container (min-width:", "\n}", "the widening query");
  assert.match(q, /\.st-mob\[data-os\] \.st-mob-one\[data-os\] \{ display: grid; \}/,
    "the widening rule is gone or too loose to beat the narrow one");
  assert.ok(CSS_BARE.indexOf("@container (min-width:") > CSS_BARE.search(narrow),
    "the widening rule sits BEFORE the narrow one, so it loses and the second phone never shows");
});

test("the threshold is above a single phone's widest default", () => {
  // Two phones must be something you DRAG to, never something that happens to
  // you at a particular window size — so the query cannot fire while the panel
  // is still at its undragged clamp.
  const at = CSS_BARE.match(/@container \(min-width: (\d+)px\)/);
  assert.ok(at, "the container query is gone — the panel can never show two phones");
  const col = span(CSS_BARE, "\n.st-mob {", "}", "the column");
  const max = col.match(/clamp\(\d+px, [^,]+, (\d+)px\)/);
  assert.ok(max, "the column's clamp is gone, so there is nothing to pitch the threshold above");
  assert.ok(+at[1] > +max[1],
    "the threshold (" + at[1] + "px) is not above the undragged maximum (" + max[1] + "px)");
});

test("the switch goes when both phones show, and the captions arrive", () => {
  const q = span(CSS_BARE, "@container (min-width:", "\n}", "the widening query");
  // A switch that decides nothing while both are on screen is the dead control
  // this repo keeps finding; it goes rather than sitting there inert.
  assert.match(q, /\.st-mob-os \{ display: none; \}/,
    "the switch stays while both phones show, deciding nothing");
  assert.match(q, /\.st-mob-cap \{ display: inline-flex; \}/,
    "the captions never arrive, so neither phone is named once the switch has gone");
  assert.match(CSS_BARE, /\.st-mob-cap \{ display: none;/,
    "the caption shows with ONE phone too — the switch already says which, so that is the same fact twice");
});

test("the words are one list, on the switch and under each frame", () => {
  const panel = realPanel();
  const html = panel(true, oses()[0]);
  const labels = BARE.match(/^const MOBILE_LABELS = \{([^}]+)\};$/m);
  assert.ok(labels, "MOBILE_LABELS is gone");
  for (const os of oses()) {
    const word = labels[1].match(new RegExp(os + ": '([^']+)'"));
    assert.ok(word, "no word for " + os);
    // Twice: once on the segment, once in the caption. Two spellings of
    // "iPhone" is two lists of the same thing on the smallest possible subject,
    // and the caption is the copy that would go stale — it only appears after
    // somebody has dragged the panel open.
    const uses = [...html.matchAll(new RegExp(">" + word[1] + "<", "g"))].length;
    assert.equal(uses, 2, "expected " + word[1] + " on the segment and the caption, found " + uses);
  }
  assert.ok(!/'iPhone'|'Android'/.test(span(BARE, "function siteMobilePanel(", "\n}", "the panel")),
    "the panel spells a phone's name itself instead of reading the one list");
});

test("the frame is height-led inside its box, or the ratio computes nothing", () => {
  // MEASURED: flexed first, and the frame came out 227x742 — ratio 0.31 against
  // the iPhone's 0.46 — because a flex column resolves an item's width from its
  // CONTENT before stretching the height, leaving `aspect-ratio` nothing
  // definite to work from. A `1fr` grid row is a definite height.
  const box = span(CSS_BARE, "\n.st-mob-one {", "}", "the phone's box");
  assert.match(box, /grid-template-rows: 1fr auto/,
    "the phone's box is not a grid with a definite row — the frame's aspect ratio has nothing to compute from");
  assert.match(CSS_BARE, /\.st-mob-one \.st-mob-device \{ height: 100%/,
    "the frame is no longer height-led inside its box");
});

test("the width is ONE property, and everything reads it", () => {
  // The panel's basis, the tab's offset and the query all read `--mob-w`, which
  // is what lets a drag move the layout with nothing re-rendered. Written twice
  // they would drift, and the tab would be left behind by the panel it sizes.
  const col = span(CSS_BARE, "\n.st-mob {", "}", "the column");
  assert.match(col, /var\(--mob-w/, "the panel's width no longer reads the dragged property");
  // RE-ANCHORED 2026-09-09: the offset lost its `calc` when the panel became an
  // overlay and the flex gap it added went with it. The property here is only
  // that the tab reads the SAME value; the tab's own case above owns the shape.
  assert.match(CSS_BARE, /\.st-ws\.st-mob-open \.st-mob-tab \{ right: var\(--mob-w/,
    "the tab does not read the dragged property, so it will not follow the panel");
  const writes = [...BARE.matchAll(/setProperty\('--mob-w'/g)].length;
  assert.equal(writes, 1, "expected exactly one writer of --mob-w, found " + writes);
  assert.match(col, /container-type: inline-size/,
    "the panel is not a query container, so the one-phone/two-phone rule can never fire");
});

// ── THE WIDTH SURVIVES A RE-RENDER ──────────────────────────────────────────
//
// (2026-09-09, found by driving the Code tab.) `setMobileW` writes `--mob-w` as
// an INLINE property on `.st-ws`, and the render replaces that element — which
// the workspace does on every builder reply, the same fact `siteMobileOpen` is
// module scope for. So the open class rode the re-render and the width did not:
// drag the panel wide, send a message, and it snapped back to the clamp.
// MEASURED at 1004px → 393px across a view switch, not reasoned.
//
// The fix is that both halves of the state land in ONE expression, so the next
// person to touch either one is looking at the other.

test("the render re-applies the dragged width, on the same element as the open class", () => {
  // DERIVED from the open class rather than typed: whatever element carries the
  // state must carry both halves of it, and the guard finds that element by
  // asking which expression writes the class.
  const cls = openClass();
  const at = BARE.indexOf("(siteMobileOpen ? ' " + cls + "' : '')");
  assert.ok(at >= 0, "the open class is no longer written into the workspace root");
  // TO THE `>` THAT CLOSES THE OPENING TAG, which is the element's own
  // attributes and no further — so a `--mob-w` written on some other node
  // cannot satisfy this. Not a line: the attribute list wraps, and a window
  // that ended at the newline read the tag as finished one attribute early.
  const tag = span(BARE.slice(at), "(siteMobileOpen ?", "'>' +", "the workspace root's attributes");
  assert.match(tag, /--mob-w:/,
    "the workspace root does not carry the stored width, so a re-render drops the drag");
  // A NON-NUMBER MUST NEVER REACH A STYLE ATTRIBUTE. `Math.round(undefined)` is
  // NaN, which would bake `--mob-w:NaNpx`.
  const cond = "Number.isFinite(siteMobileW)";
  const guarded = tag.indexOf(cond);
  assert.ok(guarded >= 0, "the stored width reaches the style attribute unchecked");
  // AND THE VALUE EMITTED IS THE STORED ONE, read AFTER the condition. A sweep
  // caught this: `--mob-w:420px` baked as a literal survived a check that only
  // asked whether `siteMobileW` appeared in the tag, because the CONDITION
  // names it. The recorded "an assertion satisfied by a string one attribute
  // over" — so the condition is skipped past and the emitted half read alone.
  assert.match(tag.slice(guarded + cond.length), /siteMobileW/,
    "the width baked into the markup is a literal, not the value the drag stored");
});

test("a stored width is re-clamped on render, because the room can have changed", () => {
  // The markup bakes whatever was last stored; the room it was clamped against
  // can have shrunk since (the window resized, the chat rail shown). Driven with
  // a stored width far past this fake row's room.
  const wide = driveMobile(true, "btn", null, 900);
  assert.equal(wide.width, FAKE_ROOM + "px",
    "a stored width wider than the room was not narrowed to it on render, so the panel overflows the row");

  // ...and a width that still fits is left exactly as it is.
  const fits = driveMobile(true, "btn", null, 400);
  assert.equal(fits.width, "400px", "a width that fits was moved anyway");

  // The no-op case, which is every undragged panel: nothing stored, nothing
  // written, and the stylesheet's clamp is what sizes the column.
  const none = driveMobile(true, "btn");
  assert.equal(none.width, null,
    "an undragged panel had a width written for it, so the clamp is no longer the default");
});

test("the width writer refuses anything that is not a number", () => {
  // `String(["a"])` is `"a"` and `Math.round(undefined)` is NaN — the recorded
  // coercion trap, on the one value that reaches a style attribute.
  const set = span(BARE, "const setMobileW = (px) => {", "\n  };", "the width writer");
  assert.match(set, /Number\.isFinite/,
    "the width writer stores whatever it is handed, including NaN");
  const guard = set.indexOf("Number.isFinite");
  const store = set.indexOf("siteMobileW =");
  assert.ok(guard >= 0 && store > guard,
    "the refusal does not precede the store, so a NaN is written before it is checked");
});

test("the drag is bounded, measured, and never scrolls the page instead", () => {
  const wire = span(BARE, "const mobRoom = () =>", "\n  };", "the ceiling");
  assert.match(wire, /\.st-rail/, "the ceiling no longer measures the chat rail — 'until the chatbox' is a place, not a number");
  assert.match(wire, /getBoundingClientRect/, "the ceiling is a constant now, wrong at every window size but one");
  assert.match(wire, /MOBILE_MIN_W/, "the ceiling can fall below the floor");
  const set = span(BARE, "const setMobileW = (px) =>", "\n  };", "the width writer");
  assert.match(set, /Math\.max\(MOBILE_MIN_W, Math\.min\(mobRoom\(\)/,
    "the width is not clamped between the floor and the measured ceiling");
  assert.match(CSS_BARE, /\.st-mob-tab \{[^}]*touch-action: none/,
    "a drag on a touch screen scrolls the page instead of resizing");
});

// ── THE PHONE SWITCH ────────────────────────────────────────────────────────

/** The names, out of the file — never a list typed in here. */
function oses() {
  const m = BARE.match(/^const MOBILE_OSES = \[([^\]]+)\];$/m);
  assert.ok(m, "MOBILE_OSES is gone — the two phones have no single list");
  const names = [...m[1].matchAll(/'([a-z]+)'/g)].map((x) => x[1]);
  assert.equal(names.length, 2, "expected exactly two phones, found " + names.join(", "));
  return names;
}

test("the panel opens on a phone that exists", () => {
  // ADDED AFTER A SWEEP SURVIVOR that is very nearly inert and worth guarding
  // anyway: `siteMobileOs = 'ipad'` still DRAWS correctly, because the panel
  // falls back — so nothing a person could see changes. What breaks is the
  // invariant, and the next reader that trusts the variable without the fallback
  // is the one that pays. It costs one line to hold.
  const m = BARE.match(/^let siteMobileOs = '([a-z]+)';$/m);
  assert.ok(m, "siteMobileOs is not a module-scope `let` with a phone in it");
  assert.ok(oses().includes(m[1]), "the panel opens on “" + m[1] + "”, which is not one of the phones");
});

test("the panel draws one segment per phone, with exactly one lit", () => {
  const panel = realPanel();
  const names = oses();
  for (const want of names) {
    const html = panel(true, want);
    for (const n of names) assert.match(html, new RegExp('data-os="' + n + '"'), "the " + n + " segment is gone");
    // EXACTLY ONE, and it is the one asked for. Two lit, or none, is a control
    // that cannot say which phone you are looking at.
    const lit = [...html.matchAll(/class="st-mob-osbtn on" data-os="([a-z]+)"/g)].map((x) => x[1]);
    assert.deepEqual(lit, [want], "lit segments for " + want + ": " + lit.join(", "));
  }
  assert.match(panel(true, "ios"), />iPhone</, "the Apple label moved");
  assert.match(panel(true, "ios"), />Android</, "the Android label moved");
});

test("the phone reaches the frame, and an unknown name never does", () => {
  const panel = realPanel();
  const [first] = oses();
  for (const want of oses()) {
    assert.match(panel(true, want), new RegExp('st-mob-device" data-os="' + want + '"'),
      "the frame is not drawn as " + want);
  }
  // `data-os="undefined"` matches no rule in the stylesheet, so the frame would
  // silently lose its shape — the coercion trap, on the value that decides it.
  for (const junk of [undefined, null, "", "ipad", ["ios"], 7, {}]) {
    const html = panel(true, junk);
    assert.match(html, new RegExp('st-mob-device" data-os="' + first + '"'),
      "a phone of " + JSON.stringify(junk) + " did not fall back to " + first);
    assert.ok(!/data-os="(undefined|null|\[|7|object)/.test(html), "a junk phone reached the markup: " + JSON.stringify(junk));
  }
});

/** The real writer and the real click handler, cut out and driven together. */
function driveOs(start) {
  const src = [
    BARE.match(/^const MOBILE_OSES = \[[^\]]+\];$/m)[0],
    "let siteMobileOs = " + JSON.stringify(start) + ";",
    span(BARE, "function setMobileOs(os) {", "\n}", "setMobileOs") + "\n}",
    span(BARE, "  view.querySelectorAll('.st-mob-osbtn')", "\n  });", "the phone handler") + "\n  });",
  ].join("\n");
  const btns = oses().map((os) => {
    const b = { dataset: { os }, cls: new Set(os === start ? ["on"] : []), onclick: null };
    b.classList = { toggle: (c, on) => (on ? b.cls.add(c) : b.cls.delete(c)) };
    return b;
  });
  // RE-ANCHORED 2026-09-09: both phones are in the markup now and the
  // stylesheet decides how many show, so the switch moves the PANEL's `data-os`
  // — which picks which one when there is room for one. The frames keep their
  // own, because that is what shapes each of them.
  const dev = { dataset: { os: start } };
  const view = {
    querySelector: (s) => (s === ".st-mob" ? dev : null),
    querySelectorAll: (s) => (s === ".st-mob-osbtn" ? btns : []),
  };
  const run = new Function("view", src + "; return { btns: view.querySelectorAll('.st-mob-osbtn'), os: () => siteMobileOs };");
  const out = run(view);
  return {
    press: (os) => { out.btns.find((b) => b.dataset.os === os).onclick(); },
    state: () => ({ os: out.os(), frame: dev.dataset.os, lit: btns.filter((b) => b.cls.has("on")).map((b) => b.dataset.os) }),
  };
}

test("pressing a segment moves the frame and the lit half, and nothing else", () => {
  const [a, b] = oses();
  const d = driveOs(a);
  assert.deepEqual(d.state(), { os: a, frame: a, lit: [a] }, "the harness did not start on " + a);

  d.press(b);
  assert.deepEqual(d.state(), { os: b, frame: b, lit: [b] }, "pressing " + b + " did not move the frame and the lit half together");

  // Pressing the segment already on is a no-op, not a repaint.
  d.press(b);
  assert.deepEqual(d.state(), { os: b, frame: b, lit: [b] }, "a second press changed something");

  d.press(a);
  assert.deepEqual(d.state(), { os: a, frame: a, lit: [a] }, "it does not go back");
});

test("the writer refuses a phone that is not one of the two", () => {
  const src = [
    BARE.match(/^const MOBILE_OSES = \[[^\]]+\];$/m)[0],
    "let siteMobileOs = 'ios';",
    span(BARE, "function setMobileOs(os) {", "\n}", "setMobileOs") + "\n}",
  ].join("\n");
  const api = new Function(src + "; return { set: setMobileOs, os: () => siteMobileOs };")();
  for (const junk of [undefined, null, "", "ipad", "IOS", ["android"], 3, {}]) {
    assert.equal(api.set(junk), false, "a phone of " + JSON.stringify(junk) + " was accepted");
    assert.equal(api.os(), "ios", "a refused phone still moved the state: " + JSON.stringify(junk));
  }
  assert.equal(api.set("ios"), false, "the phone already on answered as a change");
  assert.equal(api.set("android"), true, "a real phone was refused");
  assert.equal(api.os(), "android", "a real phone did not move the state");
});

test("the switch changes something a person can see, and the two are not one phone", () => {
  // THE ASSERTION THIS WHOLE FEATURE RESTS ON. A switch whose halves look
  // identical is a dead control wearing a coat — this repository has found that
  // five times in its own chrome — and the first cut of this change WAS one:
  // the two ratios were shipped under a width-led frame where `max-height`
  // binds, so both phones measured 369x742. Read both blocks and require them
  // to differ, rather than pinning either one's numbers.
  const per = {};
  for (const os of oses()) {
    // THE BODY, NOT THE BLOCK. `span` returns its opening landmark too, and the
    // first draft compared the two whole blocks — which begin with their own
    // selectors and so can NEVER be equal. A sweep mutant that gave Android the
    // iPhone's camera survived that vacuous comparison; the fix is to strip the
    // landmark, which is why the two are cut here rather than inline.
    const boxAt = '.st-mob-device[data-os="' + os + '"] {';
    const markAt = '.st-mob-device[data-os="' + os + '"]::before {';
    per[os] = {
      box: span(CSS_BARE, boxAt, "}", os + "'s frame").slice(boxAt.length),
      mark: span(CSS_BARE, markAt, "}", os + "'s camera").slice(markAt.length),
    };
  }
  const [a, b] = oses();
  const num = (s, prop) => {
    const m = s.match(new RegExp(prop + ":\\s*([^;]+)"));
    assert.ok(m, "the " + prop + " is gone from a phone's block");
    return m[1].trim();
  };
  // THE RATIO IS READ OFF THE SHARED TOKEN BLOCK NOW — re-anchored 2026-09-09,
  // not appeased. It used to sit in each device block beside the radius, and the
  // start screen's card tile started drawing these same two phones, so it moved
  // into `[data-os="…"] { --os-ratio }` which BOTH components read: a phone's
  // ratio is scale-free, so a second copy would be two lists of the same thing.
  // THE PROPERTY IS EXACTLY WHAT IT WAS — the two phones are not one shape — and
  // it is asserted from wherever the number lives.
  const CSS_ALL = CSS_BARE;
  const tok = {};
  for (const m of CSS_ALL.matchAll(/^\[data-os="([a-z]+)"\] \{\s*--os-ratio:\s*([^;}]+)/gm)) {
    tok[m[1]] = m[2].trim();
  }
  assert.deepEqual(Object.keys(tok).sort(), oses().slice().sort(),
    "the shared ratio block does not declare exactly the phones the module lists: " + JSON.stringify(tok));
  assert.notEqual(tok[a], tok[b],
    "both phones are the same shape — the switch changes nothing");
  // AND THE DEVICE READS IT rather than spelling one, or the token is inert and
  // both phones fall back to the base shape.
  // ANCHORED AT THE START OF A LINE. `.st-mob-device {` also ends
  // `.st-mob-one .st-mob-device {` eighteen lines above the real rule, so a bare
  // find reads a DESCENDANT rule and reports the device as having no ratio —
  // the recorded ambiguous-landmark trap, which this repository already hit in
  // this exact selector on 2026-09-09.
  const devStarts = [...CSS_ALL.matchAll(/^\.st-mob-device \{/gm)];
  assert.equal(devStarts.length, 1, "expected one `.st-mob-device {` rule, found " + devStarts.length);
  const devBody = CSS_ALL.slice(devStarts[0].index, CSS_ALL.indexOf("}", devStarts[0].index));
  assert.match(devBody, /aspect-ratio:\s*var\(--os-ratio\s*,/,
    "the panel's phone no longer reads the shared ratio");
  for (const os of oses()) {
    assert.ok(!/aspect-ratio/.test(per[os].box),
      "the " + os + " device block spells its own ratio again — that is the second copy this moved to remove");
  }
  assert.notEqual(num(per[a].box, "border-radius"), num(per[b].box, "border-radius"),
    "both phones have the same corners");
  assert.notEqual(per[a].mark.trim(), per[b].mark.trim(),
    "both phones wear the same camera — the Dynamic Island and the punch-hole are the tell");

  // AND THE LIT SEGMENT LOOKS LIT. A sweep took the active colours off and every
  // markup assertion stayed green — two identical-looking halves with one of them
  // meaning "you are here". The recorded `.st-card-act:disabled { opacity }`
  // finding, one control over.
  const off = span(CSS_BARE, "\n.st-mob-osbtn {", "}", "the segment");
  const on = span(CSS_BARE, ".st-mob-osbtn.on {", "}", "the lit segment");
  assert.match(on, /background:\s*var\(--split\)/, "the lit segment has no fill of its own");
  assert.match(on, /color:\s*var\(--on-accent\)/, "the lit segment does not take the ink that reads on that fill");
  assert.ok(!/background:\s*var\(--split\)/.test(off), "the unlit segment is filled too — both halves look lit");

  // AND THE RATIOS ARE REALLY APPLIED, which is the correction: width-led with a
  // height cap made them inert. Measured 342x742 and 334x742 at 1512x950 with
  // the frame height-led; the exact numbers live in the entry, the property here
  // is that the height leads and the width is only walled.
  const base = span(CSS_BARE, "\n.st-mob-device {", "}", "the frame");
  assert.match(base, /height:\s*100%/, "the frame is not sized from its height — the ratios go inert again");
  assert.match(base, /width:\s*auto/, "the width does not follow the ratio");
  assert.match(base, /max-width:\s*100%/, "nothing walls the width in a very tall window");
  assert.ok(!/max-height:\s*100%/.test(base), "the height cap is back, which is what made the two phones identical");
});

test("the marks are their own set, because `ic` would draw them as outlines", () => {
  // `ic()` stamps `fill="none" stroke="currentColor"` on the <svg>, which is the
  // whole of what makes ST_ICONS one coherent line set — and would draw the apple
  // as an outline and the robot's head as a horseshoe. The property is that the
  // two emitters really do the opposite thing, with BOTH read so the assertion
  // cannot pass by one of them having been deleted.
  const icLine = BARE.match(/^function ic\(name, size\) \{.*$/m);
  assert.ok(icLine, "ic() is gone — the observer for this comparison is dead");
  assert.match(icLine[0], /fill="none"/, "ic no longer draws line icons, so this comparison says nothing");
  assert.match(icLine[0], /stroke="currentColor"/, "ic no longer strokes");

  const wrapper = span(BARE, "function brandMark(name, size) {", "\n}", "brandMark");
  assert.ok(!/fill="none"/.test(wrapper), "the mark wrapper paints like a line icon — the apple would be an outline");
  assert.ok(!/stroke="currentColor"/.test(wrapper), "the mark wrapper strokes, so the marks are no longer solid");

  // The paint is on the paths instead, which is what lets one <svg> hold a filled
  // head and a stroked pair of antennae.
  const { table } = realMark();
  for (const [name, inner] of Object.entries(table)) {
    assert.match(inner, /<path[^>]*\sfill="currentColor"/, name + " has no filled path — it is not a solid mark");
    assert.ok(!/fill="(?!currentColor|none)[^"]/.test(inner) && !/stroke="(?!currentColor)[^"]/.test(inner),
      name + " paints with a literal colour, so it cannot flip with the segment's ink");
  }

  // AND THE TWO ARE TOLD APART BY THEIR SHAPE, which is what catches a swap.
  // Every check that compares a segment against the table is satisfied by the
  // pair being exchanged — the iPhone would wear the robot and nothing would
  // fail — so this names the one structural difference: the apple is a single
  // solid shape, the robot is a filled head plus stroked antennae. Deliberately
  // by key name, because it is about these two drawings and not about the list.
  const paths = (s) => [...s.matchAll(/<path\b/g)].length;
  assert.equal(paths(table.ios), 1, "the apple is not one solid shape — is it the robot's drawing?");
  assert.equal(paths(table.android), 2, "the robot is not a filled head plus stroked antennae");
  assert.match(table.android, /<path fill="none" stroke="currentColor"/, "the robot's antennae are not stroked");
  assert.ok(!/stroke=/.test(table.ios), "the apple carries a stroked path, which is the robot's shape — the two look swapped");

  // WHAT THIS CANNOT SEE, said rather than implied: whether either mark is
  // legible at the 13px it is drawn at. That is a rendering question and the
  // answer is a screenshot — the entry records the sizes it was judged at.
});

test("every phone has a mark, and a name that is not one draws nothing", () => {
  // TWO LISTS OF THE SAME THING: the phones live in MOBILE_OSES and again as keys
  // here. A third phone added to the array with no mark beside it is a segment
  // with an empty square where its logo should be, and nothing fails.
  const { mark, table } = realMark();
  assert.deepEqual(Object.keys(table).sort(), oses().sort(),
    "BRAND_MARKS and MOBILE_OSES disagree about which phones exist");

  for (const os of oses()) {
    const svg = mark(os, 13);
    assert.match(svg, /^<svg /, "the mark for " + os + " is not an svg");
    assert.match(svg, /width="13" height="13"/, "the mark for " + os + " ignored the size it was asked for");
    assert.match(svg, /viewBox="0 0 24 24"/, "the mark for " + os + " left the icon box, so it will not line up");
    assert.match(svg, /<path/, "the mark for " + os + " draws nothing");
    // Decoration beside a word, never the button's own name — the label is what
    // a screen reader reads, which is why the owner's "names PLUS their logo"
    // keeps working for somebody who cannot see either.
    assert.match(svg, /aria-hidden="true"/, "the mark for " + os + " is announced as content");
  }

  // `Object.hasOwn`, never truthiness: `BRAND_MARKS["constructor"]` is a function
  // and `|| ''` would stringify it into the page. The recorded trap, on a table
  // whose lookup takes a name.
  for (const junk of ["constructor", "toString", "__proto__", "ipad", "", "IOS"]) {
    const svg = mark(junk, 13);
    assert.ok(!/<path/.test(svg), "“" + junk + "” drew something: " + svg.slice(0, 90));
    assert.ok(!/function|\[native code\]|Object/.test(svg), "“" + junk + "” stringified into the markup: " + svg.slice(0, 90));
  }
});

test("each segment wears its OWN mark, beside its own word", () => {
  // THE WIRING ASSERTION. Both marks can be perfect and both can land on one
  // button, or the pair can be swapped, and every check above stays green. Drive
  // the real panel and match the mark that arrives against the one the table
  // holds for that phone.
  const panel = realPanel();
  const { table } = realMark();
  const names = oses();

  // The path data identifies the mark; take a distinctive slice of each so the
  // comparison is not satisfied by the shared `<path fill=` prefix.
  const tell = {};
  for (const os of names) {
    const d = table[os].match(/\sd="([^"]{40,})"/);
    assert.ok(d, "cannot find a path to identify " + os + " by");
    tell[os] = d[1].slice(0, 40);
  }
  assert.notEqual(tell[names[0]], tell[names[1]], "the two marks are the same drawing");

  for (const lit of names) {
    const html = panel(true, lit);
    for (const os of names) {
      // The button cut out from ITS OWN TAGS, so a mark sitting anywhere else in
      // the panel cannot satisfy this. Landmarks, never a byte offset: the first
      // draft sliced back a fixed 200 bytes and the lit button opens at ~197, so
      // `slice` went negative and counted from the END of the string — this
      // repository's own recorded window trap, met inside the guard written to
      // catch a wiring bug.
      // The switch group FIRST, because `data-os` is on the panel itself since
      // both phones are rendered — so the first match in the document is the
      // panel's and `lastIndexOf("<button", …)` then finds nothing at all.
      const group = span(html, '<div class="st-mob-os"', "</div>", "the switch group");
      const at = group.indexOf('data-os="' + os + '"') + html.indexOf(group);
      assert.ok(at >= 0, "nothing in the panel is drawn as " + os);
      const open = html.lastIndexOf("<button", at);
      const close = html.indexOf("</button>", at);
      assert.ok(open >= 0 && close > open, "the " + os + " segment is not inside a button");
      const btn = html.slice(open, close);
      assert.match(btn, /st-mob-osbtn/, "the first " + os + " element is not the segment — this is reading the frame");
      assert.ok(btn.includes(tell[os]), "the " + os + " segment does not carry the " + os + " mark");
      const other = names.find((n) => n !== os);
      assert.ok(!btn.includes(tell[other]), "the " + os + " segment carries the " + other + " mark");
    }
    // AND THE WORDS STAY. The owner asked for "the names plus their logo", so a
    // mark that replaced its label would be the wrong change, not a smaller one.
    assert.match(html, /<\/svg>iPhone</, "the iPhone label went when the mark arrived");
    assert.match(html, /<\/svg>Android</, "the Android label went when the mark arrived");
  }
});

test("the robot's eyes are holes, and the marks sit in a row with the words", () => {
  // WHAT MAKES THE EYES HOLES IS THE WINDING, not the fill rule: each eye's arcs
  // carry sweep 0 where the dome carries sweep 1, so they cancel. Measured —
  // rendering the android under `evenodd` and `nonzero` gives identical pixels,
  // so the attribute is INERT and this does not pretend to guard it. Flip an
  // eye's sweep and it fills in: a robot with one eye, which no other assertion
  // here would notice.
  const { table } = realMark();
  const body = table.android.match(/<path[^>]*\sfill="currentColor"[^>]*\sd="([^"]+)"/);
  assert.ok(body, "the android's filled path is gone");
  // PER SUBPATH, so this says "each eye winds against the dome" rather than
  // depending on the order every arc happens to appear in. Note the second arc of
  // each circle repeats the `a` implicitly, so matching a leading `a` finds three
  // arcs where there are five — the reading is `rx ry rotation large sweep`.
  const subs = body[1].split("M").filter(Boolean);
  assert.equal(subs.length, 3, "expected the dome and two eyes, found " + subs.length + " subpaths");
  const sweeps = (s) => [...s.matchAll(/[\d.]+ [\d.]+ 0 [01] ([01])/g)].map((m) => m[1]);
  const dome = sweeps(subs[0]);
  assert.equal(dome.length, 1, "the dome is not one arc any more");
  assert.equal(dome[0], "1", "the dome no longer winds clockwise");
  for (const [i, eye] of subs.slice(1).entries()) {
    const w = sweeps(eye);
    assert.equal(w.length, 2, "eye " + (i + 1) + " is not two arcs: " + eye);
    assert.ok(w.every((s) => s !== dome[0]),
      "eye " + (i + 1) + " winds the same way as the dome, so it fills in instead of being a hole: " + w.join(""));
  }

  // AND THE MARK SITS BESIDE THE WORD RATHER THAN ABOVE IT. A button is not a
  // flex container by default, so without this the svg — which `.st-svg` sets to
  // `display: block` — takes its own line and the pill grows to two rows.
  const seg = span(CSS_BARE, "\n.st-mob-osbtn {", "}", "the segment");
  assert.match(seg, /display:\s*inline-flex/, "the segment is not a row, so the mark drops under the word");
  assert.match(seg, /align-items:\s*center/, "the mark and the word do not share a centre line");
  assert.match(seg, /gap:\s*[.\d]+rem/, "there is no space between the mark and the word");
  // Measured: at the column's 300px floor the header holds 248px of content, so
  // nothing is squeezed today. The wall is for the day a longer label arrives —
  // a squeezed logo is the one thing here that stops reading as a logo.
  assert.match(CSS_BARE, /\.st-mob-osbtn \.st-svg \{[^}]*flex:\s*none/,
    "the mark can be squeezed by its own row");
});

test("the stylesheet knows every phone the code does", () => {
  // Two lists of the same thing: the names live in MOBILE_OSES and again as
  // attribute selectors. A third phone added to the array with no rule beside it
  // is a segment that draws an unstyled frame, and nothing fails.
  for (const os of oses()) {
    assert.match(CSS_BARE, new RegExp('\\.st-mob-device\\[data-os="' + os + '"\\] \\{'),
      "the stylesheet has no frame for " + os);
  }
  const styled = [...CSS_BARE.matchAll(/\.st-mob-device\[data-os="([a-z]+)"\] \{/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(styled)].sort(), oses().sort(),
    "the stylesheet and MOBILE_OSES disagree about which phones exist");
});

// ── THE FRAME ───────────────────────────────────────────────────────────────

test("the phone is bounded on both axes, so it can never overflow its column", () => {
  const dev = span(CSS_BARE, "\n.st-mob-device {", "}", "the phone frame");
  // RE-ANCHORED 2026-09-08 and INVERTED, which is the honest record: this pinned
  // `width: 100%` with `max-height: 100%` and FORBADE `height: 100%`, because a
  // height-led frame had overflowed the column sideways when it had no width
  // wall. Adding the second phone made that shape's cost visible — the cap binds
  // in an ordinary window, so both phones measured 369x742 and neither ratio did
  // anything at all. The property was always "it fits and it is phone-shaped";
  // the sizing that delivers it moved, and the two-phones case above is what now
  // requires the shapes to DIFFER. Measured after the change: 342x742 and
  // 334x742 at 1512x950, and inside the column at 1280x800, 1512x1400 and
  // 1100x700 as well.
  assert.match(dev, /height:\s*100%/, "the frame is no longer sized from its height");
  assert.match(dev, /width:\s*auto/, "the width no longer follows the ratio");
  assert.match(dev, /max-width:\s*100%/, "nothing walls the width — a very tall window would push it out sideways");
  assert.ok(!/max-height:\s*100%/.test(dev), "the height cap is back, and it is what made both phones the same box");
  // RE-ANCHORED 2026-09-09: the base ratio is the FALLBACK of the shared
  // `--os-ratio` now, because the start screen's tile draws these same phones
  // and one scale-free number may not be written twice. The property is
  // unchanged — with no phone chosen the frame is still handset-shaped.
  assert.match(dev, /aspect-ratio:\s*var\(--os-ratio,\s*390\s*\/\s*844\)/,
    "the base frame is no longer phone-shaped, or stopped reading the shared ratio");
  assert.match(dev, /position:\s*relative/, "the camera mark has nothing to position against");

  // The bezel takes the palette's own darkest lead, never a literal: this app is
  // one theme drawn in pencil on paper and a hex here would sit outside it.
  assert.match(dev, /border:\s*9px solid var\(--graphite\)/, "the bezel is not drawn in the palette's own ink");
});

test("the column is bounded so it cannot cover the preview on a narrow window", () => {
  const col = span(CSS_BARE, "\n.st-mob {", "}", "the column");
  // RE-ANCHORED 2026-09-09: the width is a custom property now so a drag can
  // move it, and the clamp is its FALLBACK. The property is unchanged and is
  // what this asserts — a panel nobody has dragged is still bounded, so at
  // 1200px it does not leave the preview ~300px between a 450px rail and it.
  // RE-ANCHORED AGAIN 2026-09-09, and the REASON moved further than the
  // spelling. `flex: 0 0 …` became `width: …` when the panel stopped being an
  // item in the row, so an undragged panel can no longer SQUEEZE the preview at
  // all — that is what the overlay bought. The bound still earns its place for
  // the other half: it decides how much of the preview the panel COVERS, and an
  // unbounded default at 1200px would open over most of the site. The case is
  // renamed to say which of the two it now guards.
  assert.match(col, /width:\s*var\(--mob-w, clamp\(300px, 26vw, 420px\)\)/,
    "the column has a fixed width again, or lost the clamp it falls back to");
  assert.ok(!/(^|;)\s*flex:/.test(col),
    "the column is a flex item again, so every pixel it gains comes off the preview");
});

// ── IT FLOATS OVER THE PREVIEW, IT DOES NOT TAKE ITS SPACE ──────────────────
//
// (2026-09-09, owner, on a screenshot of the panel dragged wide with the site's
// own text crushed to one word a line: "when the thing moves that moves is has
// to be like an overlaying thing, so the stuff in the site shouldnt shrink".)
// The panel was `flex: 0 0 var(--mob-w)` in `.st-body`, so every pixel it
// gained came off `.st-stage` (`flex: 1`) and the site being previewed
// re-laid-out under the drag — at full drag the stage reached ZERO. Measured
// after: the stage and the iframe hold 1017px and 1015px through the entire
// drag, and the panel's left edge lands in exactly the same place it did.

/** A token's value, read out of `:root` — never a copy of it typed here. */
function token(name) {
  const m = CSS_BARE.match(new RegExp("--" + name + ":\\s*([^;]+);"));
  assert.ok(m, "the palette no longer declares --" + name + ", so this guard observes nothing");
  return m[1].trim();
}
const translucent = (v) => /rgba\([^)]*,\s*(0?\.\d+|0)\s*\)/.test(v);

test("the panel is positioned over the stage, and the stage never learns it opened", () => {
  const col = span(CSS_BARE, "\n.st-mob {", "}", "the column");
  assert.match(col, /position: absolute/, "the panel is back in the flow, so it takes the preview's space");
  // Anchored on THREE edges, because the width is the one property a drag may
  // move: pinned top and bottom it is as tall as the row whatever it is doing,
  // and pinned right it grows leftwards over the stage rather than off-screen.
  for (const edge of ["right", "top", "bottom"]) {
    assert.match(col, new RegExp(edge + ": 0"), "the panel is not pinned to the row's " + edge + " edge");
  }
  // Its containing block. `.st-body` was already made one for the tab, so this
  // is a dependency rather than an addition — and the panel would position
  // against the PAGE if it went, which is a phone frame over the whole app.
  assert.match(CSS_BARE, /\.st-body \{[^}]*position: relative/,
    "`.st-body` is not a containing block, so the panel positions against the page instead of the row");
  // The shadow is what SAYS it is above the stage rather than cut into it, and
  // it is biased left because that is the only edge it floats over. Without it
  // the panel reads as a hole in the preview.
  assert.match(col, /box-shadow: -\d+px 0 /,
    "the panel casts no shadow leftward, so nothing says it is above the preview rather than cut into it");

  // THE STAGE MUST NOT KNOW. The whole ask is that the site keeps the width it
  // had when the panel was shut, so a rule that narrowed the stage for an open
  // panel — the obvious "fix" if this is ever revisited — puts the shrinking
  // back by another route. Asserted BESIDE the stage's own rule, so the check
  // cannot pass by the stage having been deleted.
  assert.match(CSS_BARE, /\.st-stage \{[^}]*flex: 1/, "the stage no longer takes the row's spare width");
  assert.ok(!/\.st-mob-open[^{]*\.st-stage\s*\{/.test(CSS_BARE),
    "a rule resizes the stage when the panel opens, so the site shrinks under the drag after all");

  // WHAT IT HAS TO COVER, and what has to stay above it — both DERIVED from
  // the rules they belong to, because the numbers are only meaningful against
  // each other. `.st-fixbar` is the "Fix with AI" bar, absolute INSIDE the
  // stage and therefore in this same stacking context: below the panel it
  // would show through a phone frame at a wide drag. The tab is the other way
  // round — it sits flush on the panel's left edge, where the panel's own
  // shadow is painted, so a handle below the panel is a handle in shadow.
  const zOf = (sel) => {
    const m = span(CSS_BARE, "\n" + sel + " {", "}", sel).match(/z-index:\s*(-?\d+)/);
    assert.ok(m, sel + " no longer sets a z-index, so the order below is decided by nothing");
    return Number(m[1]);
  };
  assert.ok(zOf(".st-mob") >= zOf(".st-fixbar"),
    "the panel sits below the Fix with AI bar, which then shows through it");
  assert.ok(zOf(".st-mob-tab") > zOf(".st-mob"),
    "the drag handle sits below the panel it is flush against, so the panel's shadow falls over it");
});

test("the panel's ground is opaque, or the site shows through it", () => {
  // FOUND BY LOOKING, not by reading: the first render of this overlay showed
  // the preview's own address bar straight through the panel's heading.
  // `--panel-2` is a SMUDGE — a tint meant to be laid on the app's paper — and
  // as an item in the row it never had anything but paper behind it, so nobody
  // could tell it was translucent. The moment it floats, what is behind it is
  // the customer's live website.
  const tint = token("panel-2");
  assert.ok(translucent(tint),
    "--panel-2 is opaque now, so this guard is observing nothing — check what the panel's ground rests on");
  const col = span(CSS_BARE, "\n.st-mob {", "}", "the column");
  const bg = (col.match(/background:\s*([^;]+);/) || [])[1] || "";
  assert.match(bg, /--panel-2/, "the panel stopped wearing the app's own tint");
  // The opaque half, DERIVED: some token in the background must itself be
  // opaque, judged by that token's own declaration rather than by its name.
  const solid = [...bg.matchAll(/var\(--([a-z0-9-]+)/g)]
    .map((m) => m[1]).filter((n) => !translucent(token(n)));
  assert.ok(solid.length > 0,
    "every layer of the panel's ground is translucent, so the previewed site shows through it: " + bg);
});
