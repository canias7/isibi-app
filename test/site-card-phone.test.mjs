// THE MOBILE APP SITS BESIDE THE SITE, AND IS THE SITE SQUARE'S HEIGHT.
//
// Owner, 2026-09-09: "instead of 4 , just 3 horizontally , so one square with
// the site , and one wiht the mobile app" → "no i mean the square and next to
// it the phone , not inside" → "leave the square the size it is currently ,
// just add the phone thing next to it" → "the phone same height as the square".
//
// Three properties carry the whole change and each has its own failure:
//
//   1. THE PHONE IS BESIDE THE CARD, NOT INSIDE IT. Two corrections were spent
//      getting there, so the sibling relationship is asserted rather than
//      assumed — a pane nested in the card satisfies "there is a phone" and is
//      the thing that was ruled out twice.
//   2. THE CARD IS UNTOUCHED. Its width at three across is what it measured at
//      four, and that is bought by the pair's column arithmetic, not by luck.
//   3. THE PHONE'S HEIGHT IS THE THUMBNAIL'S, DERIVED. The column is the product
//      of two aspect ratios; this file recomputes it from both rather than
//      pinning the number, so moving either ratio fails here instead of drifting
//      into a phone that no longer lines up with anything.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(here, p), "utf8");

/** Comments blanked, length preserved — this file's prose names what it forbids. */
function blankComments(src) {
  return src.split("\n").map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? " ".repeat(l.length) : l)).join("\n");
}

/**
 * One CSS rule body, by selector, with both ends asserted.
 *
 * ANCHORED AT THE START OF A LINE, and that is not tidiness. The first draft
 * used a bare `indexOf(selector + " {")` and read `.st-mob-one .st-mob-device {`
 * — a DESCENDANT rule eighteen lines above the real one — because the selector
 * it wanted is a suffix of that one. It then reported the workspace panel as
 * having no aspect-ratio, which is the ambiguous-landmark trap wearing a
 * plausible failure message. A selector that starts two rules is refused
 * outright rather than resolved by guessing which was meant.
 */
function rule(css, selector) {
  const starts = [...css.matchAll(new RegExp("^" + selector.replace(/[.[\]]/g, "\\$&") + " \\{", "gm"))];
  assert.equal(starts.length, 1,
    "expected exactly one rule starting `" + selector + " {`, found " + starts.length);
  const at = starts[0].index;
  const end = css.indexOf("}", at);
  assert.ok(end > at, selector + " has no closing brace");
  return css.slice(at + selector.length, end);
}

/**
 * The real `siteAppTile`, evaluated out of chat.js — it cannot be imported.
 *
 * EVERY FREE NAME IS CARRIED OUT OF THE FILE, NEVER STUBBED. The tile draws the
 * phone switch now, so it closes over `MOBILE_OSES`, `MOBILE_LABELS`,
 * `BRAND_MARKS` and `brandMark` — all four the workspace panel's own, which is
 * the point of the change — and a scope built without them throws
 * `ReferenceError` for a function that is perfectly correct. That is this
 * repository's recorded free-identifier trap, and it fired here the moment the
 * switch went in, exactly as `loadDb`'s comment below predicted in writing.
 *
 * Stubs would be worse than the throw: a `brandMark` answering `''` would leave
 * every "which mark is on which segment" assertion in this file blind, and a
 * two-name `MOBILE_OSES` invented here rather than read would stop being the
 * product's list the day somebody adds a third phone.
 */
function loadAppTile() {
  const chat = read("../public/chat.js");
  const cut = (fn) => {
    const at = chat.indexOf("function " + fn + "(");
    assert.ok(at > 0, fn + " is gone from chat.js");
    const end = chat.indexOf("\n}", at);
    assert.ok(end > at, fn + " has no end");
    return chat.slice(at, end + 2);
  };
  const line = (decl) => {
    const at = chat.indexOf(decl);
    assert.ok(at > 0, decl + " is gone from chat.js");
    return chat.slice(at, chat.indexOf("\n", at));
  };
  const mAt = chat.indexOf("const BRAND_MARKS = {");
  const mEnd = chat.indexOf("\n};", mAt);
  assert.ok(mAt > 0 && mEnd > mAt, "the brand-mark table moved — re-anchor this");
  return new Function(
    line("const MOBILE_OSES = ") + "\n" + line("const MOBILE_LABELS = ") + "\n"
    + chat.slice(mAt, mEnd + 3) + "\n" + cut("esc") + "\n" + cut("brandMark") + "\n"
    + line("const siteCardOs = ") + "\n" + cut("cardOs") + "\n" + cut("setCardOs") + "\n"
    + cut("siteAppTile")
    + "\nreturn { tile: siteAppTile, oses: MOBILE_OSES, labels: MOBILE_LABELS, mark: brandMark,"
    + " cardOs, setCardOs };")();
}
/** The tile for one card, on the phone it opens on — what most cases below want. */
function appTile() { const l = loadAppTile(); return (os) => l.tile("s1", os === undefined ? l.oses[0] : os); }

// ── THE TILE ITSELF ─────────────────────────────────────────────────────────

test("DRIVEN: the tile says what it is and that it does not exist yet", () => {
  const html = appTile()();
  assert.match(html, /Mobile app/, "it does not name itself");
  assert.match(html, /not built yet/, "it does not say the thing that makes it honest");
  // Both halves of the sentence, each on its own element, so a sweep that blanks
  // one cannot be satisfied by the other — the recorded "an assertion satisfied
  // by a string one attribute over", which is this screen's own 2026-09-07 find.
  assert.match(html, /class="st-app-t"[^>]*>Mobile app</);
  assert.match(html, /class="st-app-s"[^>]*>not built yet</);
});

test("DRIVEN: the PHONE is inert, and the only controls are the switch's two", () => {
  // RE-ANCHORED 2026-09-09, NOT APPEASED, and which spelling moved matters. This
  // read "the tile is INERT — drawn, and not a control" and forbade every
  // `<button>` in it, which was right while the whole tile was a picture. The
  // owner then asked for a switch ("a swictch to swtitch from apple to
  // andorid"), so buttons that DO something are now correct here.
  //
  // THE PROPERTY IT ALWAYS HELD SURVIVES WHOLE: the mobile app itself is not
  // built, so nothing on this tile may offer to open, build or preview one. What
  // is forbidden is a control that PROMISES the app — the "Build the mobile app"
  // button the owner ruled out when the workspace panel shipped — and a disabled
  // one, which says "this works and we would rather you did not" where the true
  // sentence is "we have not built this yet". The switch says neither: it
  // reshapes a drawing, and it really does it.
  const l = loadAppTile();
  const html = l.tile("s1", l.oses[0]);
  assert.ok(!/<a[ >]/.test(html), "the tile became a link");
  assert.ok(!/data-act=/.test(html), "the tile took a card action");
  assert.ok(!/data-sid=/.test(html), "the tile names a site — its controls are not the card's");
  assert.ok(!/on[a-z]+=/.test(html), "the tile has an inline handler");
  assert.ok(!/disabled/.test(html), "a disabled control is a different sentence from an absent one");
  // THE PHONE ITSELF is still a div: it is the picture, not a control, and a
  // click on it has nothing designed to do.
  assert.match(html, /<div class="st-app-phone"/, "the phone stopped being a plain drawing");
  // EXACTLY THE SWITCH, AND NOTHING ELSE. Counted against the product's own
  // list, so a third phone moves this number and a "Build the app" button fails
  // it — which is the control this has forbidden since the tile shipped.
  const buttons = html.match(/<button/g) || [];
  assert.equal(buttons.length, l.oses.length,
    "the tile has " + buttons.length + " buttons and " + l.oses.length + " phones — "
    + "every button here must be a phone segment");
  for (const b of html.match(/<button[^>]*>/g) || []) {
    assert.match(b, /class="st-app-osbtn/, "a button on the tile that is not a phone segment");
  }
  // THE OBSERVER IS AWAKE: the same read finds the elements it is reading —
  // asserted by SHAPE (one screen, two lines of words) rather than by a total.
  assert.equal((html.match(/class="st-app-phone"/g) || []).length, 1, "there is no phone to be inert");
  assert.equal((html.match(/<span/g) || []).length, 2, "the tile's two lines are gone");
});

test("DRIVEN: the tile takes its card's ID and the phone, and no site CONTENT", () => {
  // RE-ANCHORED 2026-09-09, and HALF OF IT INVERTED, not appeased. This required
  // the tile to take no site at all, on the reasoning that no site has a mobile
  // app so there is nothing per-site to say. The owner then asked for the switch
  // to move only the card it was tapped on ("MAKE SURE IT ONLY SWITCHED THE ONE
  // I TAPPED , NBOT ALL OF THEM") — which gave every card something per-site to
  // say, so the tile has to know which card it is. The recorded "a rule true
  // because of a layer below it expires when that layer moves".
  //
  // THE OTHER HALF STANDS AND IS WHAT THIS NOW PROVES: it takes the ID, never
  // the SITE. Nothing about the site's content — its name, its address, whether
  // it has a database — may change what this tile draws, because none of that is
  // about a mobile app.
  const l = loadAppTile();
  assert.equal(l.tile.length, 2,
    "the tile takes " + l.tile.length + " things; it may take exactly the card and the phone");

  // TWO CARDS, SAME PHONE, SAME TILE apart from the id they name. Driven with
  // real site shapes, because the failure this forbids is somebody quietly
  // wiring a whole site in and drawing from it.
  const a = l.tile("s1", l.oses[0]);
  const b = l.tile("s2", l.oses[0]);
  assert.equal(a.replace(/s1/g, "ID"), b.replace(/s2/g, "ID"),
    "two cards on the same phone drew different tiles — something other than the id got in");
  assert.ok(a.includes('data-app="s1"'), "the tile does not name its card, so a press cannot find it");

  // A HOSTILE ID IS ESCAPED, since it lands in an attribute.
  assert.ok(!l.tile('"><script>x</script>', l.oses[0]).includes("<script>"),
    "a site id goes into the markup unescaped");

  // THE PHONE IS REFUSED RATHER THAN COERCED: `String(["ios"])` is "ios", the
  // recorded trap, on the value that decides what a customer is looking at.
  const base = l.tile("s1", l.oses[0]);
  for (const junk of [null, undefined, {}, "nope", ["ios"], 0]) {
    assert.equal(l.tile("s1", junk), base, "something that is not a phone reached the markup");
  }

  // EVERY PHONE THE PRODUCT HAS really draws, and they really differ — derived
  // from the list rather than naming the two, so a third phone is covered.
  const seen = new Set();
  for (const os of l.oses) {
    const html = l.tile("s1", os);
    assert.match(html, new RegExp('class="st-app-phone" data-os="' + os + '"'),
      "the phone is not told it is a " + os);
    seen.add(html);
  }
  assert.equal(seen.size, l.oses.length, "two phones drew the same tile — the switch changes nothing");
});

test("DRIVEN: each card's phone is remembered on its own, and defaults to the first", () => {
  // THE STORE BEHIND "only the one I tapped". A `Map`, not an object: the keys
  // are site ids off the wire and `({})["constructor"]` is a function — the
  // recorded `X["constructor"]` trap, on a lookup that decides what is drawn.
  const l = loadAppTile();
  const [a, b] = l.oses;
  assert.equal(l.cardOs("s1"), a, "a card nobody has touched does not open on the first phone");
  assert.equal(l.cardOs("constructor"), a, "an inherited key answered as a stored phone");

  assert.equal(l.setCardOs("s1", b), true, "storing a new phone did not report a change");
  assert.equal(l.cardOs("s1"), b, "the card did not remember");
  assert.equal(l.cardOs("s2"), a, "storing one card's phone moved another card's");

  assert.equal(l.setCardOs("s1", b), false, "a second press of the phone already on reported a change");
  assert.equal(l.setCardOs("s1", "nope"), false, "a phone that is not one of ours was stored");
  // DRIVEN WITH THE NON-DEFAULT PHONE, and a sweep is why: with the other one
  // `cardOs("") === os` is already true, so a store with its id wall REMOVED
  // still answers false and the mutant survives. Only this input can see the wall.
  assert.equal(l.setCardOs("", b), false, "a card with no id was stored");
  assert.equal(l.cardOs(""), a, "an unnamed tile got an entry of its own");
  assert.equal(l.setCardOs(undefined, b), false, "a tile with no id attribute at all was stored");
  assert.equal(l.cardOs("s1"), b, "a refused write moved the card anyway");
});

// ── THE HOP EVERY OTHER GUARD MISSES ────────────────────────────────────────

test("the card markup actually draws it, exactly once", () => {
  // THE WIRING TRAP, and this screen has already been bitten by it: on
  // 2026-09-07 a sweep cut `cardActs(s)` out of this same markup and every
  // assertion about the icons stayed green with the icons off every card.
  // A function is not a feature until something calls it.
  const c = blankComments(read("../public/chat.js"));
  const at = c.indexOf("'<div class=\"st-pair\">'");
  assert.ok(at > 0, "the pair wrapper is gone from the card markup");
  const to = c.indexOf(".join('')", at);
  assert.ok(to > at, "the map's join is gone — re-anchor this window");
  const cell = c.slice(at, to);
  assert.equal((cell.match(/siteAppTile\(/g) || []).length, 1,
    "the grid cell must call siteAppTile exactly once");
  // AND IT IS HANDED THE SHARED CHOICE, not a literal: a hardcoded phone would
  // draw every card on one and the switch would light but change nothing on the
  // next render.
  assert.match(cell, /siteAppTile\(s\.id, cardOs\(s\.id\)\)/,
    "the tile is not handed its own card's id and that card's own remembered phone — "
    + "a literal or a shared variable here is the switch moving every card at once");
});

test("the phone is BESIDE the card, not inside it — the correction, asserted", () => {
  // Owner: "no i mean the square and next to it the phone , not inside". A pane
  // nested in the card satisfies "there is a phone somewhere" and is the exact
  // shape that was ruled out, so the sibling relationship is what is read here.
  const c = blankComments(read("../public/chat.js"));
  const at = c.indexOf("'<div class=\"st-pair\">'");
  const to = c.indexOf(".join('')", at);
  assert.ok(at > 0 && to > at, "the grid cell's landmarks moved — re-anchor this");
  const cell = c.slice(at, to);
  const card = cell.indexOf('<div class="st-card"');
  const tile = cell.indexOf("siteAppTile(");
  assert.ok(card > 0 && tile > card, "the card or the tile moved — re-anchor this");
  // And the pair really opens before the card, so the card is inside the pair.
  assert.ok(cell.indexOf("st-pair") < card, "the card is not inside the pair");

  // THE CARD MUST BE CLOSED BEFORE THE TILE IS CALLED, counted rather than
  // inferred from position. A SWEEP FOUND THIS: the first draft asserted the
  // tile came after the DELETE button — which lives inside the card — so moving
  // the call one line up, inside the card, satisfied it perfectly. That is the
  // nested pane the owner ruled out, passing a guard written to forbid it.
  const between = cell.slice(card, tile);
  const opens = (between.match(/<div/g) || []).length;
  const closes = (between.match(/<\/div>/g) || []).length;
  assert.equal(closes, opens,
    "the card is still open where siteAppTile is called (" + opens + " divs opened, "
    + closes + " closed) — the phone is INSIDE the card, not beside it");
  assert.ok(opens >= 4, "the card's own markup is gone — re-anchor this");

  // The count above ignores what the functions CALLED in that window emit, so
  // it rests on `cardActs` being balanced. Asserted rather than assumed: an
  // unbalanced one would make the arithmetic above quietly wrong in either
  // direction, which is a guard that reports the wrong answer confidently.
  const ca = c.indexOf("function cardActs(");
  assert.ok(ca > 0, "cardActs is gone — re-anchor this");
  const body = c.slice(ca, c.indexOf("\n}", ca));
  assert.equal((body.match(/<\/div>/g) || []).length, (body.match(/<div/g) || []).length,
    "cardActs no longer closes what it opens, so the balance above cannot be trusted");
});

// ── THE NAMES, DERIVED BOTH WAYS ────────────────────────────────────────────

test("every class the tile writes is a class the stylesheet styles, and back", () => {
  const html = appTile()();
  const css = read("../public/styles.css");
  const written = [...html.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/));
  assert.ok(written.length >= 3, "the tile writes no classes — re-anchor this");
  for (const cls of written) {
    assert.ok(new RegExp("\\." + cls + "[\\s,:{]").test(css), "nothing styles ." + cls);
  }
  // AND BACK: a rule keyed on a class the markup does not write is a rule that
  // does nothing, which is how a renamed element silently loses its look.
  const styled = [...css.matchAll(/\.(st-app[a-z-]*)/g)].map((m) => m[1]);
  assert.ok(styled.length >= 3, "the stylesheet has no rules for the tile — re-anchor this");
  for (const cls of new Set(styled)) {
    assert.ok(written.includes(cls), "the stylesheet styles ." + cls + ", which nothing writes");
  }
});

test("the tile's classes do not collide with the workspace's mobile panel", () => {
  // A REAL FIND, 2026-09-09, and it is why these are `st-app*` and not `st-mob*`.
  // The first cut named the wrapper `.st-mob` — which is already the workspace's
  // mobile-app COLUMN, an overlay pinned `position: absolute` on three edges —
  // so the card's phone inherited it and rendered 842px tall. Caught by
  // measuring the rendered box, not by reading the CSS, because a collision
  // between two files' class names is invisible to both of them.
  const html = appTile()();
  const written = [...html.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/));
  for (const cls of written) {
    assert.ok(!/^st-mob/.test(cls),
      "." + cls + " is in the workspace mobile panel's namespace — it will inherit its rules");
  }
  // THE OBSERVER IS AWAKE: that namespace is real and still in use.
  assert.match(read("../public/styles.css"), /\.st-mob-device\s*\{/,
    "the workspace panel is gone — this check is now guarding nothing");
});

// ── THE GEOMETRY, RECOMPUTED RATHER THAN PINNED ─────────────────────────────

/** `a / b`, `a/b` or a bare decimal, as a number. */
function ratio(decl, what) {
  const m = /aspect-ratio:\s*(?:var\(--os-ratio,\s*)?([\d.]+)\s*(?:\/\s*([\d.]+))?/.exec(decl);
  assert.ok(m, what + " has no aspect-ratio");
  return m[2] ? Number(m[1]) / Number(m[2]) : Number(m[1]);
}
/** Every phone's ratio, off the shared token block both components read. */
function osRatios(css) {
  const out = {};
  for (const m of css.matchAll(/^\[data-os="([a-z]+)"\] \{\s*--os-ratio:\s*([\d.]+)\s*\/\s*([\d.]+)/gm)) {
    out[m[1]] = Number(m[2]) / Number(m[3]);
  }
  assert.ok(Object.keys(out).length >= 2,
    "the shared `[data-os]` ratio block is gone — re-anchor this; found " + JSON.stringify(out));
  return out;
}

test("the phone column IS the two ratios multiplied — derived, not pinned", () => {
  // The claim the whole design rests on: the phone's height equals the site
  // thumbnail's, at every width. That is true only while
  //     column = (thumbnail's h/w) x (handset's w/h)
  // so both ratios are read out of their own rules and the column recomputed.
  // Pinning `.2888` instead would let either ratio move and leave a phone that
  // silently no longer lines up with anything.
  const css = read("../public/styles.css");
  const thumb = ratio(rule(css, ".st-card-prev"), "the site thumbnail");
  // READ OFF THE SCREEN BOX, NOT THE PHONE — re-anchored 2026-09-09 with the
  // owner's "THE SITE SQUARE THING MOVES , WHEN I TAP TO SWICTH". The phone's own
  // ratio changes with the switch; the BOX it sits in is what the column was
  // derived for, and is what must never move.
  const phone = ratio(rule(css, ".st-app-screen"), "the phone's box");
  const want = (1 / thumb) * phone;

  const pair = rule(css, ".st-pair");
  const cols = /grid-template-columns:\s*([^;]+)/.exec(pair);
  assert.ok(cols, "the pair has no columns");
  const m = /1fr\s+([\d.]+)fr/.exec(cols[1]);
  assert.ok(m, "the pair's columns are not `1fr <n>fr`: " + cols[1].trim());
  assert.ok(Math.abs(Number(m[1]) - want) < 0.001,
    "the phone column is " + m[1] + " where the two ratios give " + want.toFixed(4)
    + " — the phone no longer stands as tall as the thumbnail");

  // AND THE BOX IS SIZED FROM THE COLUMN, never from a fixed width: a px width
  // looks right at the size it was drawn at and breaks at the two breakpoints,
  // where the card widens to 382 and then 480.
  //
  // ANCHORED AT THE START OF THE DECLARATION, and that is not tidiness: this
  // read `/width:\s*100%/` against the PHONE's rule, and when the phone became
  // `width: auto; max-width: 100%` the check went on passing — satisfied by
  // `max-width`, four characters over. The recorded "an assertion satisfied by a
  // string one attribute over", in a guard written three hours earlier.
  assert.match(rule(css, ".st-app-screen"), /(?:^|[;{]|\s)width:\s*100%/,
    "the phone's box must take the column's width, so its height follows the card's");

  // AND EVERY REAL PHONE STAYS NEAR THAT COLUMN (added 2026-09-09 with the
  // switch). The column above is derived from the FALLBACK ratio, which is the
  // shape the tile had before a phone could be picked; the switch now puts a
  // real iPhone or a real Android in that column instead, and neither is exactly
  // 390/844. The alignment the owner asked for — "the phone same height as the
  // square" — survives because both are close to it, and that is a fact about
  // today's two phones rather than a guarantee: MEASURED at three across, the
  // thumbnail is 161.2px, the iPhone 161.5 and the Android 165.5. So a phone
  // whose proportions are far from the column fails HERE, loudly, instead of
  // shipping as a handset that towers over the card it sits beside.
  for (const [os, r] of Object.entries(osRatios(css))) {
    const tall = (1 / r) / (1 / phone);       // its height against the column's
    assert.ok(tall > 0.9 && tall < 1.1,
      "the " + os + " phone stands " + Math.round(tall * 100) + "% of the column's height — "
      + "it no longer lines up with the card, so the column must be re-derived");
  }
});

test("both phones this app draws read ONE ratio, rather than spelling their own", () => {
  // RE-ANCHORED 2026-09-09, NOT APPEASED. This compared the card phone's own
  // `aspect-ratio` number with the workspace device's and required them equal —
  // right while each spelled a literal. The switch made that a real hazard
  // rather than a tidiness point: two components draw these phones now, and a
  // phone's ratio is the one fact about it that is SCALE-FREE, so two copies
  // would be two lists of the same thing and a drift would put a different
  // iPhone on a card from the one in the panel.
  //
  // So the property is stronger than it was: not "the two numbers agree" but
  // "there is only one number". Both must READ the shared token.
  const css = read("../public/styles.css");
  for (const sel of [".st-app-phone", ".st-mob-device"]) {
    assert.match(rule(css, sel), /aspect-ratio:\s*var\(--os-ratio\s*,/,
      sel + " spells its own ratio instead of reading the shared one");
  }
  // The two fallbacks are still one shape, which is what an element with no
  // phone chosen draws.
  assert.equal(ratio(rule(css, ".st-app-phone"), "the card's phone"),
    ratio(rule(css, ".st-mob-device"), "the workspace panel's phone"),
    "the two phones fall back to different shapes");
  // AND THE TOKEN REALLY RESOLVES: a `var()` naming a property nothing declares
  // silently leaves both on the fallback, so the switch would light and change
  // nothing. Every phone the product lists must declare one.
  const declared = osRatios(css);
  const l = loadAppTile();
  for (const os of l.oses) {
    assert.ok(declared[os] !== undefined,
      "`" + os + "` is a phone the tile draws and the stylesheet gives it no --os-ratio");
  }
});

test("the phone's ground is the card's own token, read rather than restated", () => {
  const css = read("../public/styles.css");
  const card = /background:\s*var\((--[a-z0-9-]+)\)/.exec(rule(css, ".st-card"));
  assert.ok(card, "the card's ground is no longer a single token — re-anchor this");
  assert.match(rule(css, ".st-app-phone"), new RegExp("background:\\s*var\\(" + card[1] + "\\)"),
    "the phone paints its own grey — a palette change would drift the two apart");
});

test("the phone stays level with the thumbnail while the card stretches", () => {
  // `.st-pair` stretches both children to the row's tallest card, so without
  // this the phone would centre itself in a cell taller than it is and drop
  // below the thumbnail's top edge on every row with a two-line site name.
  assert.match(rule(read("../public/styles.css"), ".st-app"), /align-content:\s*start/,
    "the phone is not pinned to the top of its column");
});

// ── THE GRID ────────────────────────────────────────────────────────────────

test("the card is still the width it was — the owner's instruction, as arithmetic", () => {
  // "leave the square the size it is currently , just add the phone thing next
  // to it". At four across on the 1080px page a card measured 258, and it must
  // measure 258 at three PAIRS across. That is bought by the pair's gap taking
  // the remainder, so the gap is not a spacing choice — it is what holds the
  // card still, and a guard that does not say so lets somebody round it.
  //
  // Everything but the 258 is read out of the stylesheet; the 258 is the
  // measurement the instruction refers to, and the live render agrees with it.
  const css = read("../public/styles.css");
  const page = /max-width:\s*(\d+)px/.exec(rule(css, ".st-page"));
  assert.ok(page, "the page's cap is gone — re-anchor this");
  // READ AS `column-gap` BY NAME. The width arithmetic wants the gap between
  // COLUMNS, and since 2026-09-09 the grid sets the two axes apart — `row-gap`
  // is more than three times it. A loose `/gap:/` matches `column-gap:` AND
  // `row-gap:` and takes whichever comes first, so it would be right only while
  // nobody reorders the declaration, and wrong silently after.
  const gridGap = /column-gap:\s*([\d.]+)rem/.exec(rule(css, ".st-grid"));
  const pairRule = rule(css, ".st-pair");
  // BY NAME here too. The pair gained a row when the database moved above it, so
  // it sets both axes, and `row-gap:` contains `gap:` — a loose match would take
  // whichever came first.
  const pairGap = /column-gap:\s*([\d.]+)rem/.exec(pairRule);
  const col = /1fr\s+([\d.]+)fr/.exec(pairRule);
  assert.ok(gridGap && pairGap && col, "the grid's or the pair's spacing moved — re-anchor this");

  const pair = (Number(page[1]) - 2 * Number(gridGap[1]) * 16) / 3;
  const card = (pair - Number(pairGap[1]) * 16) / (1 + Number(col[1]));
  assert.ok(Math.abs(card - 258) < 1,
    "a card comes out " + card.toFixed(1) + "px where it measured 258 before the phone "
    + "was added beside it — the square changed size");
});

test("a row is set apart from the next one — more than a pair is from its neighbour", () => {
  // Owner, 2026-09-09: "leave more space between every3" -> "i mean like floor
  // one to floor 2". At a single `gap` the rows sat 16px apart, the same as the
  // columns, so a row ran into the one below it and six columns read as six
  // columns rather than three pairs.
  //
  // DERIVED, not pinned: the row gap must simply be MORE than the column gap.
  // A number here would go stale the first time either is tuned, and the
  // property is the separation, not the millimetre.
  const grid = rule(read("../public/styles.css"), ".st-grid");
  const rowGap = /row-gap:\s*([\d.]+)rem/.exec(grid);
  const colGap = /column-gap:\s*([\d.]+)rem/.exec(grid);
  assert.ok(rowGap && colGap,
    "the grid sets one `gap` for both axes again, so a row sits as close to the "
    + "next one as a pair does to its neighbour");
  assert.ok(Number(rowGap[1]) > Number(colGap[1]) * 2,
    "the rows are " + rowGap[1] + "rem apart against " + colGap[1] + "rem between "
    + "columns — not enough to read as separate floors");
  // AND THE SHORTHAND IS FORBIDDEN, because `row-gap:` contains `gap:`: a
  // `gap: <row> <column>` here would be read by the card-width check above as a
  // column gap of the ROW's value, and the card would be computed wrong without
  // anything failing.
  assert.ok(!/[;{]\s*gap:/.test(grid), "the grid uses the two-axis `gap` shorthand");
});

test("three pairs across, and two breakpoints under it", () => {
  const css = read("../public/styles.css");
  assert.match(rule(css, ".st-grid"), /grid-template-columns:\s*repeat\(3,\s*1fr\)/,
    "the grid is not three across");
  // The breakpoints are what stop three pairs putting a card under 200px on a
  // laptop. Read as a pair and asserted to DESCEND, so an inverted or reordered
  // set — which would give one column on a big screen — cannot pass.
  const bps = [...css.matchAll(/@media \(max-width: (\d+)px\) \{ \.st-grid \{ grid-template-columns: ([^;]+); \} \}/g)]
    .map((m) => ({ at: Number(m[1]), cols: m[2] }));
  assert.equal(bps.length, 2, "the grid's breakpoints moved — re-anchor this");
  assert.ok(bps[0].at > bps[1].at, "the breakpoints are out of order, so the wider one never applies");
  assert.match(bps[0].cols, /repeat\(2,\s*1fr\)/, "two across on a laptop");
  assert.match(bps[1].cols, /^1fr$/, "one across on a phone");
});

// ── THE DATABASE, ABOVE THE PAIR ────────────────────────────────────────────
//
// Owner, 2026-09-09: "the database thing on top of the card but in the middle …
// the width of the site and the mobile app together is 100, the site is 70 and
// the mobile app 30, the database has to be 50 … outside the square but in the
// middle on top of each of them" → "just the icon" → "without the box".

/**
 * The real `siteDbIcon` and `siteWires`, evaluated out of chat.js — neither can
 * be imported. EVERY FREE NAME IS CARRIED OUT OF THE FILE, never stubbed: the
 * icon closes over the wires, and the wires close over the three x positions,
 * so a scope built without them throws `ReferenceError` and a scope built with
 * stubs would leave every "which wire lands where" assertion blind. That is
 * this repo's recorded free-identifier trap, met inside the guard written for
 * the change that introduced the closure.
 */
function loadDb() {
  const chat = read("../public/chat.js");
  const cut = (fn) => {
    const at = chat.indexOf("function " + fn + "(");
    assert.ok(at > 0, fn + " is gone from chat.js");
    const end = chat.indexOf("\n}", at);
    assert.ok(end > at, fn + " has no end");
    return chat.slice(at, end + 2);
  };
  const line = (decl) => {
    const at = chat.indexOf(decl);
    assert.ok(at > 0, decl + " is gone from chat.js");
    const end = chat.indexOf("\n", at);
    return chat.slice(at, end);
  };
  const iAt = chat.indexOf("const ST_ICONS = {");
  const iEnd = chat.indexOf("\n};", iAt);
  assert.ok(iAt > 0 && iEnd > iAt, "the icon table moved — re-anchor this");
  return new Function(chat.slice(iAt, iEnd + 3) + "\n" + cut("esc") + "\n" + cut("ic")
    + "\n" + line("const SITE_X =") + "\n" + line("const DB_X =")
    + "\n" + cut("wireLive") + "\n" + cut("siteWires") + "\n" + cut("siteDbIcon")
    + "\nreturn { db: siteDbIcon, wires: siteWires, wireLive, SITE_X, APP_X, DB_X };")();
}
function loadDbIcon() { return loadDb().db; }

test("DRIVEN: the database control is just the icon, and keeps both its states", () => {
  const db = loadDbIcon();
  const on = db({ id: "s1", react: true, backend: true, url: "https://x/" });
  const off = db({ id: "s2", react: true, backend: false, url: "https://x/" });

  // JUST THE ICON. The owner was shown a pill and a labelled bar and picked the
  // bare glyph, so a label creeping back in is a change to be made deliberately.
  assert.ok(!/<span/.test(on), "the control grew a label again");
  assert.ok(/class="st-svg"/.test(on) && /stroke-width="1\.85"/.test(on),
    "drawn through the app's own icon helper, not pasted");
  assert.equal((on.match(/<button/g) || []).length, 1, "one control, not several");

  // BOTH STATES, and the disabled one SAYS WHICH KIND OF OFF IT IS — a first
  // build provisions no database, so that is the ordinary card and hiding the
  // control is how a customer never learns to ask for it.
  assert.ok(!/ disabled/.test(on), "a site with a database must offer a live control");
  assert.ok(/ disabled/.test(off), "a site with none must not");
  assert.match(/title="([^"]*)"/.exec(off)[1], /No database yet/,
    "the TOOLTIP says what to do about it");
  assert.match(/aria-label="([^"]*)"/.exec(off)[1], /no database yet/i,
    "and so does the name a screen reader announces");
  // A hostile id is escaped into the attribute rather than concatenated raw.
  assert.ok(!db({ id: 'x" onclick="steal()', react: true, backend: true }).includes('onclick="steal()'));
});

test("the database is drawn ABOVE the pair, exactly once", () => {
  // THE WIRING TRAP AGAIN: cutting this one call leaves `siteDbIcon` perfect and
  // the control off every card. And its POSITION is the owner's instruction —
  // "on top of" — so it is asserted to come before the card opens, not merely to
  // exist somewhere in the cell.
  const c = blankComments(read("../public/chat.js"));
  const at = c.indexOf("'<div class=\"st-pair\">'");
  const to = c.indexOf(".join('')", at);
  assert.ok(at > 0 && to > at, "the grid cell's landmarks moved — re-anchor this");
  const cell = c.slice(at, to);
  assert.equal((cell.match(/siteDbIcon\(s\)/g) || []).length, 1,
    "the grid cell must call siteDbIcon exactly once");
  assert.ok(cell.indexOf("siteDbIcon(s)") < cell.indexOf('<div class="st-card"'),
    "the database is drawn after the card — it must come first, so it sits on top");
  // OUTSIDE THE SQUARE: it is a child of the pair, never of the card.
  const card = cell.indexOf('<div class="st-card"');
  assert.ok(cell.indexOf("siteDbIcon(s)") < card, "the database is inside the card");
});

test("it is half the pair, and its centre is the middle of the two THINGS", () => {
  // The owner's own arithmetic: site + phone = 100, database = 50. THE WIDTH IS
  // UNCHANGED and the PLACEMENT MOVED, which is the spelling that moved here:
  // this used to pin `grid-column: 1 / -1; justify-self: center` on the button
  // itself, and both of those are now the wrapper's — the button hangs off
  // `--db-x` instead (owner, 2026-09-09: "the database thing more to the right
  // so its in the middle, no matter if its not 50 in the middle"). The middle of
  // a pair whose halves are 74% and 21% is not the middle of the two things, and
  // the wires are what made that visible.
  const css = read("../public/styles.css");
  const wrap = rule(css, ".st-dbwrap");
  assert.match(wrap, /grid-column:\s*1\s*\/\s*-1/,
    "the wrapper sits in one column, so `--db-x` measures that column and not the pair");
  const db = rule(css, ".st-db");
  assert.match(db, /width:\s*50%/, "it is not half the pair's width");
  // THE CENTRE IS DERIVED, NOT TYPED: half of the 50% width is 25%, so a left
  // edge a quarter of the pair before `--db-x` puts the box's own centre on it.
  // Read as arithmetic rather than as a string, so the day either number moves
  // the other has to move with it.
  const w = /width:\s*([\d.]+)%/.exec(db);
  const m = /margin-left:\s*calc\(var\(--db-x\)\s*-\s*([\d.]+)%\)/.exec(db);
  assert.ok(m, "the control is not placed on --db-x, so the wires leave from nowhere");
  assert.equal(Number(m[1]), Number(w[1]) / 2,
    "the offset is not half the width, so the icon's centre is not --db-x");
  assert.ok(!/justify-self/.test(db),
    "a justify-self here fights the margin and puts the icon back near the middle");
  // NO BOX — the owner looked at a pill and chose the bare glyph.
  assert.match(db, /border:\s*0/, "the box came back");
  assert.match(db, /background:\s*none/, "the ground came back");
});

test("DRIVEN: two wires, one to the site and one to the app, from the icon's own centre", () => {
  // Owner, 2026-09-09: "TWO WIRES COMING FROM THE DATABASE, ONE THAT GOES TO THE
  // SITE AND ONE TO THE APP" → three treatments rendered → "C".
  const { wires, db, SITE_X, APP_X, DB_X } = loadDb();
  const svg = wires();

  // TWO, and they are DECORATION rather than a second control — the button
  // beside them is the thing you press, and a wire that took focus or a click
  // would be this repo's own dead-control finding drawn as a picture.
  const paths = svg.match(/<path /g) || [];
  assert.equal(paths.length, 2, "there are " + paths.length + " wires, not two");
  assert.match(svg, /aria-hidden="true"/, "the wires are announced as content");
  assert.match(svg, /focusable="false"/, "the wires can be tabbed to");
  assert.ok(!/<button|data-act|data-sid/.test(svg), "a wire grew a handle");

  // ONE VIEWBOX, STRETCHED. `preserveAspectRatio="none"` is what lets the same
  // two paths serve a pair of any width; the stylesheet's non-scaling-stroke is
  // what stops that stretch from smearing them, and is asserted below.
  assert.match(svg, /viewBox="0 0 100 36"/, "the wire box is not the pair's own 100 units");
  assert.match(svg, /preserveAspectRatio="none"/,
    "without this the wires keep their own ratio and stop reaching either target");

  // EACH WIRE LEAVES THE ICON AND LANDS ON ITS OWN THING, derived from the same
  // three numbers the placement uses — never re-typed here, because a guard that
  // spells the coordinates cannot tell a moved wire from a moved icon.
  const ds = [...svg.matchAll(/<path d="([^"]+)"/g)].map((x) => x[1]);
  for (const d of ds) {
    assert.ok(d.startsWith("M" + DB_X + " "),
      "a wire starts somewhere other than the icon: " + d.slice(0, 24));
  }
  assert.ok(ds.some((d) => d.endsWith(SITE_X + " 35")), "no wire lands on the site");
  assert.ok(ds.some((d) => d.endsWith(APP_X + " 35")), "no wire lands on the app");

  // AND THE ICON SITS BETWEEN THEM BY ARITHMETIC. This is the owner's "in the
  // middle": equal runs left and right, which is only true at the midpoint. A
  // pinned 63.3 would pass while either landing moved underneath it.
  assert.equal(DB_X, +(((SITE_X + APP_X) / 2).toFixed(2)),
    "the database is not midway between the two, so one wire runs further than the other");
  assert.equal(+(DB_X - SITE_X).toFixed(2), +(APP_X - DB_X).toFixed(2),
    "the two wires do not run the same distance");

  // THE CALL SITE, COUNTED. Cutting it leaves `siteWires` perfect and every
  // assertion above green, with no wire on any card — the wiring trap, which
  // this same screen has already shipped once with `cardActs`.
  // RE-ANCHORED for the green wire: the icon draws `siteWires(wireLive(hasDb))`
  // now, so its output for a database-less site is what `wires()` answers and
  // this reads that site rather than a live one. The property is unchanged —
  // the icon really draws the wires — and the live half is driven in its own
  // case below, where the marker it adds is the subject.
  assert.ok(db({ id: "s2", react: true, backend: false }).includes(svg),
    "the icon does not draw the wires");
  // The declaration matches the call too, so it is excluded by name — counting
  // it would let the one real call be deleted and still read as 1. It takes an
  // argument now, so the shape is `siteWires(`, not `siteWires()`.
  const chat = blankComments(read("../public/chat.js"));
  assert.equal((chat.match(/(?<!function )siteWires\(/g) || []).length, 1,
    "siteWires is called somewhere other than the icon, or nowhere at all");
});

test("DRIVEN: the wire to the site is green exactly when the database is", () => {
  // Owner, 2026-09-09: "IF THE PROJECT HAS A DATABASE, THE WIRE TURNS GREEN TO
  // THE SITE BOX OR THE MOBILE APP ONE, DEPENDING ON WHICH ONE IS IT" — four
  // treatments rendered, "A", then "G4" of five greens.
  const { wires, db, wireLive, SITE_X, APP_X } = loadDb();
  const marked = (svg) => [...svg.matchAll(/<path([^>]*?) d="([^"]+)"/g)]
    .map((m) => ({ live: /class="live"/.test(m[1]), to: m[2].slice(m[2].lastIndexOf(" C") + 2) }));

  // THE RULE, DRIVEN OVER EVERY SHAPE. `site` follows the database; `app` is
  // false for all of them, because nothing on this platform can own a mobile
  // app — and it is asserted rather than assumed so that turning it on is a
  // change somebody makes on purpose.
  for (const v of [true, 1, "yes", {}]) {
    assert.deepEqual(wireLive(v), { site: true, app: false }, "a database does not light the site wire");
  }
  for (const v of [false, 0, "", null, undefined, NaN]) {
    assert.deepEqual(wireLive(v), { site: false, app: false }, "no database still lights the site wire");
  }

  // AND THE MARKER LANDS ON THE RIGHT PATH. A guard that only counted markers
  // would pass with the two swapped, which is the claim nothing can back: an
  // app wire green on a site with no app.
  const on = marked(wires({ site: true, app: false }));
  assert.equal(on.filter((p) => p.live).length, 1, "a live database marks " + on.filter((p) => p.live).length + " wires");
  assert.ok(on.find((p) => p.live).to.endsWith(SITE_X + " 35"), "the green wire does not land on the site");
  assert.ok(!on.find((p) => p.to.endsWith(APP_X + " 35")).live, "the app's wire is green");

  // AN IDLE PAIR IS UNMARKED, so a site with no database draws exactly what it
  // drew before this existed — the base rule paints it, and nothing else.
  assert.ok(!marked(wires({ site: false, app: false })).some((p) => p.live), "an idle wire is marked live");
  assert.ok(!marked(wires()).some((p) => p.live), "a wire with nothing to say defaults to live");

  // ONE EXPRESSION FOR THE CONTROL AND THE WIRE. The button's live state and
  // the wire's are the same fact, so they are read from one `hasDb` — two tests
  // would disagree on a card the first time either moved, and the disagreement
  // is drawn: a dark glyph over a green wire, or the reverse.
  for (const [site, want] of [
    [{ id: "a", react: true, backend: true }, true],
    [{ id: "b", react: true, backend: false }, false],
    [{ id: "c", react: false, backend: true }, false],   // Data unreachable: no claim to make
  ]) {
    const html = db(site);
    assert.equal(/class="live"/.test(html), want,
      "the wire and the button disagree about " + site.id);
    assert.equal(!/ disabled/.test(html), want,
      "the button and the wire disagree about " + site.id);
  }
});

test("green is a token, and only a marked wire takes it", () => {
  const css = read("../public/styles.css");

  // DECLARED, not a literal at the use site. The palette carries no other
  // green, so this is the one place the value lives and the one place to tune
  // it — and `landing-models`' token scan requires every `var()` to resolve.
  const decl = /--wire-live:\s*(#[0-9a-fA-F]{3,8}|[a-z][\w(),.\s%/-]*);/.exec(css);
  assert.ok(decl, "--wire-live is not declared, so the live wire resolves to nothing");
  const live = rule(css, ".st-wires .live");
  assert.match(live, /stroke:\s*var\(--wire-live\)/,
    "the live wire paints a literal instead of the token");

  // AND THE IDLE WIRE IS UNTOUCHED. `currentColor` on the base rule is what
  // makes this change invisible on a site with no database; a green that
  // replaced it there would say every site has one.
  assert.match(rule(css, ".st-wires"), /stroke:\s*currentColor/,
    "the wires no longer inherit the icon's ink, so an idle wire is not graphite");

  // THE SELECTOR MUST OUT-WEIGH THE INHERIT AND STAY SCOPED. `.st-wires .live`
  // is (0,2,0); a bare `.live` would paint anything anywhere that class lands.
  assert.ok(/(^|\})\s*\.st-wires\s+\.live\s*\{/.test(css.replace(/\/\*[\s\S]*?\*\//g, "")),
    "the live rule is not scoped to the wires");
  assert.ok(!/(^|\})\s*\.live\s*\{/.test(css.replace(/\/\*[\s\S]*?\*\//g, "")),
    "there is a bare .live rule, which paints every element that class reaches");

  // The class the markup writes IS the class the sheet paints. Two spellings
  // here is the drift that leaves a database wired and the wire grey.
  const { wires } = loadDb();
  const cls = /<path class="([^"]+)"/.exec(wires({ site: true, app: false }));
  assert.ok(cls, "the live wire carries no class at all");
  assert.ok(rule(css, ".st-wires ." + cls[1]).length > 0,
    "the markup marks the wire `" + cls[1] + "` and the stylesheet paints something else");
});

test("the wires hang off the icon and fill exactly the gap it was raised by", () => {
  const css = read("../public/styles.css");
  const wrap = rule(css, ".st-dbwrap");
  const w = rule(css, ".st-wires");

  // THE WRAPPER IS THE POSITIONING CONTEXT, and that is the whole reason it
  // exists: `top: 100%` needs an element whose bottom edge IS the icon's, which
  // is the one way to place the wires without typing the icon's height in.
  assert.match(wrap, /position:\s*relative/, "the wires have nothing to hang off");
  assert.match(w, /position:\s*absolute/, "the wires take space and push the card down");
  assert.match(w, /top:\s*100%/, "the wires do not start at the icon's bottom edge");
  assert.match(w, /left:\s*0/, "the wires are not aligned with the pair");
  assert.match(w, /width:\s*100%/, "the wires do not span the pair, so neither lands");
  assert.match(w, /pointer-events:\s*none/, "the wires swallow clicks meant for the card");

  // ONE NUMBER, TWO READERS. The gap above the card and the height of the wire
  // box are the same distance said twice, so they are the same custom property:
  // a row gap larger than the wires leaves them short of the card, smaller and
  // they run over it, and neither failure shows up in any markup check.
  const pair = rule(css, ".st-pair");
  assert.match(pair, /row-gap:\s*var\(--db-drop\)/, "the gap is no longer the wires' own");
  assert.match(w, /height:\s*var\(--db-drop\)/, "the wires no longer fill the gap");
  assert.match(pair, /--db-drop:\s*[\d.]+rem/, "--db-drop is not declared on the pair");

  // AND THE STRETCH MUST NOT SMEAR THE LINE. Without non-scaling-stroke the
  // viewBox's horizontal squash thickens the wires, so they stop matching the
  // glyph they leave from — a difference nothing but a screenshot would show.
  assert.match(css, /^\.st-wires path \{[^}]*vector-effect:\s*non-scaling-stroke/m,
    "the wires scale their own stroke, so they no longer read as the icon's pen");
  // The pen: `ic()` draws at stroke-width 1.85 in a 24-unit box, rendered at 17.
  const sw = /stroke-width:\s*([\d.]+)/.exec(w);
  assert.ok(sw && Math.abs(Number(sw[1]) - 1.85 * 17 / 24) < 0.05,
    "the wires are not the same weight as the glyph: " + (sw && sw[1]));
});

test("the browser and the stylesheet agree where the database sits", () => {
  // TWO LISTS OF THE SAME THING, avoided by asserting them equal: `--db-x`
  // places the icon and `DB_X` starts the wires, and nothing else ties them
  // together. Let them drift and the wires leave from a point the icon is not
  // at — which reads as a drawing mistake and is really two files disagreeing.
  const { DB_X } = loadDb();
  const pair = rule(read("../public/styles.css"), ".st-pair");
  const x = /--db-x:\s*([\d.]+)%/.exec(pair);
  assert.ok(x, "--db-x is not declared, so the icon is placed by something else");
  assert.equal(Number(x[1]), DB_X,
    "the stylesheet puts the icon at " + x[1] + "% and the wires leave from " + DB_X + "%");
});

test("the database's lines are dark in BOTH states, on the owner's own call", () => {
  // THIS CASE IS INVERTED FROM WHAT IT ASSERTED FOR ONE DAY, AND THE DECISION
  // THAT MOVED IS THE OWNER'S, NOT THE SPELLING. It used to require
  // `.st-db:disabled { opacity: .38 }` — a sweep had found that every markup
  // assertion stayed green with the dimming gone, so a control with nothing
  // behind it would read exactly like a live one. That is still this repo's
  // convention and it is still right for every other control on this screen.
  // The owner overruled it for this one icon in as many words (2026-09-09:
  // "ALSO PUT IT DARK THE LINES , NO MATTER IF ITSD ON IR OFF"), so the guard
  // asserts the instruction instead of the convention, and asserts the
  // convention beside it so this reads as a deliberate exception rather than a
  // drift somebody can quietly widen.
  const css = read("../public/styles.css");

  // THE INK IS THE DARKEST LEAD, and asserting the TOKEN is what makes this a
  // statement about darkness rather than about a spelling: `--text` is
  // `--graphite`, and `--muted` is the greyer one this used to fade to.
  // IT IS READ THROUGH THE INHERITANCE, because the wires arrived and moved it:
  // the wrapper sets the colour for the icon and the wires together, so they are
  // one pen and cannot be darkened apart. Following `inherit` is what keeps this
  // a statement about what the customer sees rather than about which rule says it.
  const base = rule(css, ".st-db");
  const own = /color:\s*([^;]+)/.exec(base);
  assert.ok(own, "the database icon sets no colour, so it inherits whatever is around it");
  const from = own[1].trim() === "inherit" ? rule(css, ".st-dbwrap") : base;
  const ink = /color:\s*var\((--[\w-]+)\)/.exec(from);
  assert.ok(ink, "nothing declares the ink the icon inherits");
  assert.equal(ink[1], "--text",
    "the database's lines must be the darkest lead, not " + ink[1]);
  assert.match(css, /^\s*--text:\s*var\(--graphite\)/m,
    "--text is no longer the graphite lead — re-anchor what 'dark' means here");

  // AND NOTHING DIMS IT WHEN IT IS OFF. Read as an absence with its own
  // observer: the disabled rule must exist (it still sets the cursor), and it
  // must carry no opacity below 1.
  const off = rule(css, ".st-db:disabled");
  assert.ok(off && /cursor:/.test(off),
    "the disabled rule is gone, so this assertion is observing nothing");
  const op = /opacity:\s*([\d.]+)/.exec(off);
  assert.ok(!op || Number(op[1]) >= 1,
    "the owner asked for dark lines whether it is on or off; this dims to " + (op && op[1]));

  // THE CONVENTION IS ALIVE ONE RULE OVER. If this ever goes red, the repo has
  // stopped dimming disabled controls generally and the exception above is no
  // longer an exception — which is a decision somebody has to make on purpose.
  const act = rule(css, ".st-card-act:disabled");
  const actOp = /opacity:\s*([\d.]+)/.exec(act);
  assert.ok(actOp && Number(actOp[1]) < 0.7,
    "the card's own disabled controls no longer dim, so this is no longer an exception");
});

test("the pair keeps a row for it, and the card still stretches", () => {
  const pair = rule(read("../public/styles.css"), ".st-pair");
  const rows = /grid-template-rows:\s*([^;]+)/.exec(pair);
  assert.ok(rows, "the pair has no row track for the database");
  // ROW 2 IS `1fr`, DELIBERATELY: `auto auto` leaves a short card floating in a
  // grid row sized by a taller neighbour, which is what `align-items: stretch`
  // was doing for free while the pair had one row.
  assert.match(rows[1].trim(), /^auto\s+1fr$/,
    "row 2 must absorb the pair's spare height, or a short card stops stretching");
  // AND THE DATABASE SITS CLEAR OF THE CARD. The owner has asked for that
  // distance twice ("a bit more higher up", then "a BIT HIGHER"), and this row
  // gap is the ONLY thing that can give it: row 1 starts at the pair's own top
  // edge, so the icon is already as high as it can go and "higher" can only mean
  // more air below it. The AMOUNT is deliberately not pinned — the same reason
  // the grid's own row gap is not, since the owner tunes it and a tuning must
  // never be a test edit — so this asserts the property that survives every
  // tuning: there IS a gap. Delete the declaration and the icon sits flush on
  // the card, which no other assertion here would notice.
  // IT IS READ THROUGH `--db-drop` NOW, which is the spelling that moved: the
  // wires fill this same distance, so the gap and their height are one custom
  // property rather than two numbers that can disagree.
  assert.match(pair, /row-gap:\s*var\(--db-drop\)/,
    "the pair declares no row gap, so the database sits flush on the card");
  const rowGap = /--db-drop:\s*([\d.]+)rem/.exec(pair);
  assert.ok(rowGap && Number(rowGap[1]) > 0,
    "--db-drop is not a real distance, so there is no gap and no room for the wires");
});

test("the database control is WIRED wherever it sits", () => {
  // It is no longer a `.st-card-act`, so a class selector would have left it
  // drawn and dead — this screen's own recorded wiring trap. The handler reads
  // `b.dataset.sid`, so selecting on that attribute is what makes the hop
  // survive the control moving.
  const c = blankComments(read("../public/chat.js"));
  assert.ok(c.includes("view.querySelectorAll('[data-sid]')"),
    "the card controls are selected by something other than the attribute the "
    + "handler reads — a control that moves out of the card is drawn and never wired");
  // And the control really carries it, or the selector above matches nothing.
  assert.match(loadDbIcon()({ id: "s1", react: true, backend: true }), /data-sid="s1"/);
  assert.match(loadDbIcon()({ id: "s1", react: true, backend: true }), /data-act="data"/);
});

// ── WHAT CAME OFF WITH IT ───────────────────────────────────────────────────

test("the card's phone ICON is gone, and its two acts are not", () => {
  // The tile beside the card said the same words the disabled icon did — the
  // sentence twice on one card, three times counting its aria-label. Asserted
  // BESIDE the acts that stay, so a `cardActs` deleted outright fails here
  // rather than passing as a satisfied absence.
  const c = blankComments(read("../public/chat.js"));
  assert.ok(!c.includes('data-act="phone"'), "the mobile-app icon is back on the card");
  for (const act of ["data", "live"]) {
    assert.ok(c.includes('data-act="' + act + '"'), "the card draws no actions at all — re-anchor this");
  }
  // AND THE GLYPH STAYS IN THE TABLE. The workspace's own device switch draws
  // it; deleting an icon because one of its callers went quiet is how a feature
  // becomes expensive to put back.
  assert.match(c, /\n\s*phone:/, "the phone glyph left ST_ICONS with its last card caller");
});

// ── THE APPLE / ANDROID SWITCH ──────────────────────────────────────────────
//
// Owner, 2026-09-09, on a screenshot of the pair: "NOW HERE WHERE THE PHONE
// THING IS , I WANT LIKE A SWICTH TO SWTITH FROM APPLE TO ANDORID , JUST AS A
// PERVIEW THING" → three placements rendered → "A".
//
// The thing this whole group exists to stop is the one this repository has now
// found six times in its own chrome: a control that is drawn, hoverable,
// correctly labelled, and changes nothing. So it is asserted at three separate
// layers — the markup draws it, the stylesheet makes the two states differ, and
// the handler is DRIVEN — because any one of the three alone has passed while
// the feature was dead.

test("DRIVEN: every phone gets its own segment, its own mark and its own name", () => {
  const l = loadAppTile();
  for (const os of l.oses) {
    const html = l.tile("s1", os);
    const segs = html.match(/<button[^>]*class="st-app-osbtn[^"]*"[^>]*>[\s\S]*?<\/button>/g) || [];
    assert.equal(segs.length, l.oses.length, "the switch does not draw one segment per phone");

    for (const v of l.oses) {
      const seg = segs.find((s) => s.includes('data-os="' + v + '"'));
      assert.ok(seg, "no segment for " + v);
      // THE MARK IS THE PANEL'S OWN, asked with the value that keys the segment,
      // so a mark cannot land on the wrong platform. Compared against
      // `brandMark`'s real output rather than a shape typed in here.
      assert.ok(seg.includes(l.mark(v, 13)),
        "the " + v + " segment does not carry the " + v + " mark");
      // THE NAME COMES FROM `MOBILE_LABELS`, the panel's list, so the two
      // switches this app draws cannot end up calling the same phone two things.
      assert.ok(seg.includes('title="' + l.labels[v] + '"'), "the " + v + " segment has no tooltip");
      assert.ok(seg.includes("aria-label=\"Preview as " + l.labels[v] + '"'),
        "the " + v + " segment has no accessible name — the mark alone says nothing to a screen reader");
      // EXACTLY ONE IS LIT, and it is the one the tile was asked for. `on` is
      // the class, `aria-pressed` the fact; both, because a sighted customer
      // reads one and a screen reader the other.
      const lit = v === os;
      assert.equal(/class="st-app-osbtn on"/.test(seg), lit, "the lit segment is wrong for " + os);
      assert.equal(seg.includes('aria-pressed="' + (lit ? "true" : "false") + '"'), true,
        "aria-pressed disagrees with the lit class on " + v);
    }
    assert.equal((html.match(/st-app-osbtn on/g) || []).length, 1,
      "exactly one segment is lit at a time");
  }
});

test("DRIVEN: a swapped pair of drawings would pass every other check here", () => {
  // THE ONE STRUCTURAL DIFFERENCE, and the reason this case exists: every
  // assertion above derives what it expects FROM the table, so exchanging the
  // apple and the robot satisfies all of them — the iPhone segment would wear
  // the robot and nothing would fail. The workspace panel's own guard records
  // this exact hole. The apple is a single solid path; the robot is a filled
  // head PLUS a stroked pair of antennae.
  const l = loadAppTile();
  const html = l.tile("s1", l.oses[0]);
  const seg = (v) => (html.match(/<button[^>]*data-os="[^"]*"[^>]*>[\s\S]*?<\/button>/g) || [])
    .find((s) => s.includes('data-os="' + v + '"'));
  const paths = (s) => (s.match(/<path/g) || []).length;
  assert.ok(paths(seg("android")) > paths(seg("ios")),
    "the two marks no longer differ in structure — a swap of the drawings would go unnoticed");
});

test("the switch's two phones really look different ON A CARD, not only in the panel", () => {
  // THE PANEL'S OWN GUARD PROVES THE PANEL, and that is not this. The tile draws
  // at 74.5px where the device mock draws at ~340, so it carries its own corner
  // and camera rules — and a switch whose halves look identical at 74px is a
  // dead control however different they are at 340.
  const css = read("../public/styles.css");
  const l = loadAppTile();
  const per = {};
  for (const os of l.oses) {
    per[os] = {
      box: rule(css, '.st-app-phone[data-os="' + os + '"]'),
      cam: rule(css, '.st-app-phone[data-os="' + os + '"]:before'),
    };
  }
  const [a, b] = l.oses;
  const num = (s, prop) => {
    const m = s.match(new RegExp(prop + ":\\s*([^;]+)"));
    assert.ok(m, "the " + prop + " is gone from a phone's own rule");
    return m[1].trim();
  };
  assert.notEqual(num(per[a].box, "border-radius"), num(per[b].box, "border-radius"),
    "both phones have the same corners on a card");
  assert.notEqual(per[a].cam.trim(), per[b].cam.trim(),
    "both phones wear the same camera on a card — the pill and the punch-hole are the tell at this size");

  // THE CORNERS ARE A PERCENTAGE PAIR, not px, or the switch is right at one
  // column count and wrong at the other two — measured 74.5 / 110.5 / 138.8.
  for (const os of l.oses) {
    assert.match(num(per[os].box, "border-radius"), /^[\d.]+%\s*\/\s*[\d.]+%$/,
      "the " + os + " corner is not a percentage pair, so it cannot scale with the column");
  }

  // AND THE TILE AND THE PANEL AGREE WHICH PHONE IS THE ROUNDER, derived from
  // each rather than pinned. They are two sets of numbers by necessity — one is
  // px at 340, one is a percentage at 74 — so what stops them describing
  // different phones is that they order the same way.
  const pct = (os) => Number(/^([\d.]+)%/.exec(num(per[os].box, "border-radius"))[1]);
  const px = (os) => Number(/^([\d.]+)px/.exec(
    num(rule(css, '.st-mob-device[data-os="' + os + '"]'), "border-radius"))[1]);
  assert.equal(pct(a) > pct(b), px(a) > px(b),
    "the card and the panel disagree about which of these two phones is the rounder one");
});

test("a lit segment LOOKS lit, and a dimming rule is not enough", () => {
  // THE `.st-card-act:disabled { opacity }` FINDING, one control over and for
  // the third time on this screen: state that lives only in the markup is
  // invisible to every markup assertion, and a sweep has twice taken the paint
  // off with all of them staying green.
  const css = read("../public/styles.css");
  const base = rule(css, ".st-app-osbtn");
  const on = rule(css, ".st-app-osbtn.on");
  assert.match(base, /color:/, "the segment has no ink of its own to differ from");
  assert.ok(/background:/.test(on) && /color:/.test(on),
    "the lit segment paints neither a ground nor an ink — the two halves look the same");
  assert.notEqual(/background:\s*([^;]+)/.exec(on)[1].trim(), "none",
    "the lit segment's ground is `none`, which is what the unlit one has");
  // AND IT IS REACHABLE BY KEYBOARD, since it is a real button and the mark
  // carries no text of its own to show focus on.
  assert.ok(css.includes(".st-app-osbtn:focus-visible"), "the segment has no visible focus state");
});

/**
 * The REAL switch handler, cut out of `renderSites` and driven against a fake
 * document — because `if (false)` leaves a call exactly where a source read
 * looks for it, and this repository has shipped a control that read as wired and
 * was not.
 *
 * THE FAKE HAS REAL TILES, and that is the whole point of this harness now: each
 * button knows its tile through `closest`, and each tile answers
 * `querySelectorAll` with ITS OWN children. A fake where every lookup returned
 * everything would pass a handler that repaints the whole screen, which is the
 * defect the owner found — so the scoping has to be observable here.
 *
 * `setCardOs` and `cardOs` are carried in whole rather than stubbed: they are the
 * product's own store, and a stub would make "one card's press leaves the others
 * alone" a statement about the harness.
 */
function driveSwitch(tiles = 3) {
  const chat = read("../public/chat.js");
  const bare = blankComments(chat);
  const at = bare.indexOf("  view.querySelectorAll('.st-app-osbtn')");
  assert.ok(at > 0, "the phone switch is never wired up in renderSites");
  const to = bare.indexOf("\n  });", at);
  assert.ok(to > at, "the switch handler has no end — re-anchor this");
  const sw = bare.slice(at, to) + "\n  });";

  const l = loadAppTile();
  const oses = l.oses;
  const all = [];
  const made = [];
  for (let i = 0; i < tiles; i++) {
    const id = "s" + i;
    const phone = { dataset: { os: oses[0] } };
    const btns = oses.map((os) => {
      const b = { dataset: { os }, cls: new Set(os === oses[0] ? ["on"] : []), attrs: {}, onclick: null };
      b.classList = { toggle: (c, on) => (on ? b.cls.add(c) : b.cls.delete(c)) };
      b.setAttribute = (k, v) => { b.attrs[k] = v; };
      return b;
    });
    const tile = {
      dataset: { app: id },
      querySelector: (q) => (q === ".st-app-phone" ? phone : null),
      querySelectorAll: (q) => (q === ".st-app-osbtn" ? btns : []),
    };
    for (const b of btns) b.closest = (q) => (q === ".st-app" ? tile : null);
    made.push({ id, phone, btns });
    all.push(...btns);
  }
  // A RE-RENDER IS OBSERVED, not forbidden by reading: `renderSites` is defined
  // here so that if the handler calls it we SEE the call.
  let rendered = false;
  const view = { querySelectorAll: (q) => (q === ".st-app-osbtn" ? all : []) };
  const setAt = chat.indexOf("function setCardOs(id, os) {");
  const cardAt = chat.indexOf("function cardOs(id) {");
  assert.ok(setAt > 0 && cardAt > 0, "the per-card store is gone — re-anchor this");
  new Function("view", "onRender", [
    chat.match(/^const MOBILE_OSES = \[[^\]]+\];$/m)[0],
    chat.match(/^const siteCardOs = .*$/m)[0],
    chat.slice(cardAt, chat.indexOf("\n}", cardAt)) + "\n}",
    chat.slice(setAt, chat.indexOf("\n}", setAt)) + "\n}",
    "function renderSites() { onRender(); }",
    sw,
    "return 0;",
  ].join("\n"))(view, () => { rendered = true; });
  return {
    oses,
    press: (tile, os, ev) => made[tile].btns[oses.indexOf(os)].onclick(ev || { stopPropagation() {} }),
    state: () => made.map((t) => ({
      phone: t.phone.dataset.os,
      lit: t.btns.filter((b) => b.cls.has("on")).map((b) => b.dataset.os),
      pressed: t.btns.map((b) => b.attrs["aria-pressed"]),
    })),
    rendered: () => rendered,
  };
}

test("DRIVEN: a press moves ONLY the card it was tapped on", () => {
  // THE OWNER'S CORRECTION, and the case that exists because of it: "MAKE SURE IT
  // ONLY SWITCHED THE ONE I TAPPED , NBOT ALL OF THEM". This shipped for one
  // afternoon reading and writing the workspace panel's `siteMobileOs`, so a
  // press on any card moved every phone on the screen. This case is that
  // behaviour, inverted.
  const d = driveSwitch(3);
  const [a, b] = d.oses;
  assert.deepEqual(d.state().map((t) => t.phone), [a, a, a], "the harness did not start with three tiles on " + a);

  d.press(1, b);
  const s1 = d.state();
  assert.deepEqual(s1.map((t) => t.phone), [a, b, a],
    "pressing the middle card moved the others — this is the defect the owner found");
  assert.deepEqual(s1.map((t) => t.lit), [[a], [b], [a]], "the lit segment moved on a card nobody pressed");
  assert.deepEqual(s1[1].pressed, ["false", "true"], "aria-pressed did not follow the lit class");
  assert.deepEqual(s1[0].pressed, [undefined, undefined],
    "an untouched card's segments were rewritten — the repaint is not scoped to the tile");

  // THE OTHER CARDS STAY MOVABLE ON THEIR OWN, so the scoping is not an accident
  // of nothing else being reachable.
  d.press(2, b);
  assert.deepEqual(d.state().map((t) => t.phone), [a, b, b], "a second card could not be moved");
  d.press(1, a);
  assert.deepEqual(d.state().map((t) => t.phone), [a, a, b], "a card could not be moved back on its own");

  // A SECOND PRESS OF THE ONE ALREADY ON is a no-op, not a repaint.
  d.press(1, a);
  assert.deepEqual(d.state().map((t) => t.phone), [a, a, b], "a second press changed something");

  // AND NOTHING RE-RENDERS. `renderSites()` rebuilds a grid in which every card
  // carries an <iframe> of that site — 51 on the owner's account — so a switch
  // that re-rendered would reload every thumbnail to change a corner radius.
  assert.equal(d.rendered(), false, "the switch re-rendered the whole grid");
});

test("DRIVEN: a segment click is not also a click on the card behind it", () => {
  // The card is a `role="button"` that opens the workspace, and the switch sits
  // inside the pair beside it. DRIVEN with an event that RECORDS whether it was
  // stopped, so `if (false) e.stopPropagation()` fails here where a source scan
  // would pass — the recorded trap, and the reason this is a case of its own.
  const d = driveSwitch(1);
  let stopped = false;
  d.press(0, d.oses[1], { stopPropagation() { stopped = true; } });
  assert.equal(stopped, true, "a press on the switch also opens the site behind it");
});

test("the card's phone has ONE writer, and it is not the workspace panel's", () => {
  // RE-ANCHORED 2026-09-09, NOT APPEASED, and the property INVERTED with the
  // owner's correction. This required the card to write `siteMobileOs`, the
  // panel's own variable, on the reasoning that one answer to "which phone am I
  // looking at" beat fifty. The owner asked for fifty ("only the one I tapped"),
  // so the two are separate now — and what must still be true is that each has
  // exactly ONE writer, or a card and its own repaint can disagree.
  const c = blankComments(read("../public/chat.js"));
  const writes = [...c.matchAll(/^.*\bsiteCardOs\b.*$/gm)].map((m) => m[0].trim());
  const setters = writes.filter((w) => /siteCardOs\.set\(/.test(w));
  assert.equal(setters.length, 1,
    "expected `setCardOs` to be the only thing that stores a card's phone, found: " + JSON.stringify(setters));
  assert.match(c, /^const siteCardOs = new Map\(\);$/m,
    "the per-card store is not a Map — an object would let an inherited key answer as a stored phone");

  // AND THE CARD'S SWITCH GOES THROUGH IT rather than assigning its own.
  const at = c.indexOf("  view.querySelectorAll('.st-app-osbtn')");
  const body = c.slice(at, c.indexOf("\n  });", at));
  assert.match(body, /setCardOs\(tile\.dataset\.app, b\.dataset\.os\)/,
    "the card's switch does not store the phone against the card it was pressed on");
  assert.match(body, /if \(!tile \|\| !setCardOs\(/, "it repaints even when nothing changed, or with no tile");
  // THE SCOPING, read where it is decided: the repaint must reach the TILE and
  // never the document, or every card moves again.
  assert.match(body, /b\.closest\('\.st-app'\)/, "the handler does not find the tile it was pressed in");
  assert.ok(!/view\.querySelectorAll\('\.st-app-phone'\)/.test(body),
    "the handler repaints every phone on the screen — the defect the owner found");
  // AND THE PANEL'S OWN CHOICE IS NOT TOUCHED, so the two switches stay separate.
  assert.ok(!/siteMobileOs/.test(body),
    "the card's switch writes the workspace panel's phone — they are two different questions now");
});

test("the switch changes the phone and NOTHING ELSE ON THE ROW", () => {
  // THE OWNER FOUND THIS ONE LIVE: "THE SITE SQUARE THING MOVES , WHEN I TAP TO
  // SWICTH". The two phones are different SHAPES, so a phone that took the
  // column's width directly came out 4px taller on Android — and the pair's
  // second row is `1fr` with stretched items, so that grew the tile, the card,
  // and every other card in the same grid row. MEASURED before the fix: 3.9px at
  // 1512, 5.8 at 1100, 7.4 at 700, with the NEIGHBOURING card moving too.
  //
  // AND THE GUARDS ABOVE ALL PASSED THROUGH IT, which is the finding. They prove
  // the switch changes something visible — a corner, a camera, a ratio — and not
  // one of them proved it changes ONLY that. A control whose side effect is the
  // layout around it is a different failure from a control that does nothing,
  // and this file had no reader for it.
  const css = read("../public/styles.css");
  const box = rule(css, ".st-app-screen");
  const phone = rule(css, ".st-app-phone");

  // THE BOX'S SHAPE IS A LITERAL. A `var(--os-ratio)` here puts the movement
  // straight back, and it is the single edit that would.
  const boxRatio = /aspect-ratio:\s*([^;]+)/.exec(box);
  assert.ok(boxRatio, "the phone's box has no aspect-ratio, so the row's height follows the phone");
  assert.ok(!/var\(/.test(boxRatio[1]),
    "the phone's box takes its shape from the switch (" + boxRatio[1].trim() + ") — "
    + "tapping it would resize the tile, the card, and every card in that grid row");

  // AND THE PHONE IS HEIGHT-LED INSIDE IT, so a taller phone comes out NARROWER
  // rather than taller. `width: auto` is the half that matters: with a width the
  // phone would drive its own height off its ratio again.
  assert.match(phone, /(?:^|[;{]|\s)height:\s*100%/, "the phone is not sized from its box's height");
  assert.match(phone, /(?:^|[;{]|\s)width:\s*auto/,
    "the phone sets its own width, so its ratio decides its height and the row moves again");
  assert.match(phone, /max-width:\s*100%/, "the phone may overflow its box sideways");
  // The phone's ratio DOES vary — that is the switch — asserted here beside the
  // box's fixed one so the pair reads as the deliberate split it is.
  assert.match(phone, /aspect-ratio:\s*var\(--os-ratio\s*,/,
    "the phone stopped reading the shared ratio, so the switch changes no shape at all");

  // THE BOX IS THE PHONE'S OWN FALLBACK SHAPE, so a card with no phone chosen
  // draws exactly what it drew before the switch existed, and the phone fills its
  // box rather than sitting in it with a gap. (That the box's shape puts the
  // phone at the thumbnail's HEIGHT is the column-derivation case's job, two
  // above; the thumbnail is landscape and the phone portrait, so the two ratios
  // are not equal and asserting that here would flag correct code.)
  const fallback = /aspect-ratio:\s*var\(--os-ratio,\s*([^)]+)\)/.exec(phone);
  assert.ok(fallback, "the phone has no fallback shape to compare the box against");
  assert.equal(boxRatio[1].trim(), fallback[1].trim(),
    "the box (" + boxRatio[1].trim() + ") and the phone's fallback (" + fallback[1].trim()
    + ") are different shapes, so an unswitched card draws a phone that does not fill its box");

  // AND THE PHONE IS CENTRED IN THAT BOX — which this change is what MADE
  // load-bearing, and a sweep is what said so. The phone changes WIDTH on every
  // press now (that is the whole mechanism above: a taller phone comes out
  // narrower), so without a centring rule it sits against the box's left edge
  // and JUMPS SIDEWAYS each time — the owner's own complaint, one axis over.
  // Nothing here guarded it and the mutant that removed it survived the first
  // pass. The `display: flex` is asserted beside it because `justify-content`
  // governs nothing without it, so the pair is the property rather than either
  // half alone.
  assert.match(box, /display:\s*flex/,
    "the phone's box is not a flex container, so its centring rule governs nothing");
  assert.match(box, /justify-content:\s*center/,
    "the phone is not centred in its box — it changes width on every press, so it "
    + "would jump to the left edge each time you switched");

  // AND THE PAIR STILL STRETCHES ITS ROW, which is what makes the box's fixed
  // shape load-bearing rather than incidental: with `align-items: start` the
  // cards would not follow the tile and none of this would matter. Asserted so
  // the reason above cannot quietly stop being true.
  assert.match(rule(css, ".st-pair"), /align-items:\s*stretch/,
    "the pair no longer stretches — re-read whether the box still needs a fixed shape");

  // AND THE BOX IS REALLY DRAWN, WITH THE PHONE INSIDE IT — DRIVEN, because
  // everything above this line is a statement about the STYLESHEET, and a rule
  // for an element nobody writes styles nothing at all. Deleting the wrapper
  // from the markup leaves every assertion here green and puts the movement
  // straight back: this repository's recorded wiring trap, on the one change
  // whose whole subject is a defect the guards read past. Nesting is asserted
  // rather than presence, since a box BESIDE the phone sizes nothing.
  const l = loadAppTile();
  for (const os of l.oses) {
    const html = l.tile("s1", os);
    assert.match(html, /<div class="st-app-screen"><div class="st-app-phone" data-os="/,
      "the phone is not inside its box on " + os + " — the rules above style an element nobody draws");
    assert.equal((html.match(/st-app-screen/g) || []).length, 1, "one box per tile");
  }
});

test("THE TILE CANNOT PAINT OUTSIDE ITS OWN COLUMN, whatever the phone computes to", () => {
  // WHY THIS EXISTS (2026-09-12, owner on one of two Macs: "on my desktop looks
  // fine, but in my laptop is kinda mess up" — six grey slabs over the whole
  // start screen, the cards underneath them correct).
  //
  // The phone is `height: 100%`, and a percentage height resolves only against a
  // parent whose height is DEFINITE. `.st-app-screen`'s height is definite by
  // `aspect-ratio`, which is correct CSS and is exactly the corner engines have
  // disagreed about. Where it does not resolve, the phone sizes against a taller
  // ancestor, `width: auto` follows its ratio, and `max-width` does not always
  // clamp a width the ratio produced — so one 102px tile becomes ~506 x a whole
  // window. MEASURED off the owner's own screenshot: slabs ~520px wide and the
  // full window tall, and 0.46 (the 393/852 handset) x the window height is 506.
  // Six of those at a 518px pitch overlap almost edge to edge, and `--panel-2`
  // is 10% ink, so they stack into bands. Every detail of the picture closes.
  //
  // THE PROPERTY IS CONTAINMENT, NOT THE TWO DECLARATIONS. What must be true is
  // that the tile is bounded on BOTH axes and clips — never that it spells
  // `max-height` or `overflow: hidden` in particular — so this reads the rules
  // for a bound on each axis and for a clip, and any spelling that achieves them
  // passes.
  const css = read("../public/styles.css");
  const box = rule(css, ".st-app-screen");
  const phone = rule(css, ".st-app-phone");

  // THE CLIP. `visible` is the default and the thing that let the slabs out, so
  // it is the one value refused rather than a list of the ones allowed.
  const ov = /(?:^|[;{]\s*)overflow:\s*([^;]+)/.exec(box);
  assert.ok(ov, "the phone's box no longer clips — a tile that mis-sizes paints over the grid");
  assert.ok(!/\bvisible\b/.test(ov[1]),
    "the phone's box is `overflow: " + ov[1].trim() + "`, which does not contain a mis-sized phone");

  // BOUNDED ON BOTH AXES. Width alone was what shipped, and the height is the
  // axis the owner's browser ran away on.
  for (const axis of ["max-width", "max-height"]) {
    const m = new RegExp("(?:^|[;{]\\s*)" + axis + ":\\s*([^;]+)").exec(phone);
    assert.ok(m, "the phone has no " + axis + ", so it can outgrow its box on that axis");
    assert.equal(m[1].trim(), "100%",
      "the phone's " + axis + " is `" + m[1].trim() + "` rather than its box");
  }

  // AND THE DESIGN IS UNCHANGED: still height-led inside the box, which is what
  // makes a taller phone NARROWER rather than taller and keeps the card still.
  // A fix that quietly turned the tile width-led would pass every check above
  // and move every card on the screen.
  // THE LOOKBEHIND IS LOAD-BEARING: a bare `height:` search is satisfied by the
  // `max-height` two declarations along, so the check would pass over a phone
  // that had stopped being height-led at all.
  assert.match(phone, /(?<![-\w])height:\s*100%/,
    "the phone stopped being height-led, which is what kept the cards still");
  assert.match(phone, /(?<![-\w])width:\s*auto/,
    "the phone's width stopped following its ratio");
});
