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

/** The real `siteAppTile`, evaluated out of chat.js — it cannot be imported. */
function loadAppTile() {
  const chat = read("../public/chat.js");
  const at = chat.indexOf("function siteAppTile(");
  assert.ok(at > 0, "siteAppTile is gone from chat.js");
  const end = chat.indexOf("\n}", at);
  assert.ok(end > at, "siteAppTile has no end");
  return new Function(chat.slice(at, end + 2) + "\nreturn siteAppTile;")();
}

// ── THE TILE ITSELF ─────────────────────────────────────────────────────────

test("DRIVEN: the tile says what it is and that it does not exist yet", () => {
  const html = loadAppTile()();
  assert.match(html, /Mobile app/, "it does not name itself");
  assert.match(html, /not built yet/, "it does not say the thing that makes it honest");
  // Both halves of the sentence, each on its own element, so a sweep that blanks
  // one cannot be satisfied by the other — the recorded "an assertion satisfied
  // by a string one attribute over", which is this screen's own 2026-09-07 find.
  assert.match(html, /class="st-app-t"[^>]*>Mobile app</);
  assert.match(html, /class="st-app-s"[^>]*>not built yet</);
});

test("DRIVEN: the tile is INERT — drawn, and not a control", () => {
  // A disabled button says "this works and we would rather you did not"; this
  // says "we have not built this yet". The icon it replaced was a disabled
  // button and was kept under exactly this rule since 2026-09-07: no handler,
  // because what it will DO is not designed and a branch would be a guess
  // written down as code.
  const html = loadAppTile()();
  assert.ok(!/<button/.test(html), "the tile became a button");
  assert.ok(!/<a[ >]/.test(html), "the tile became a link");
  assert.ok(!/data-act=/.test(html), "the tile took a card action");
  assert.ok(!/on[a-z]+=/.test(html), "the tile has an inline handler");
  assert.ok(!/disabled/.test(html), "a disabled control is a different sentence from an absent one");
  // THE OBSERVER IS AWAKE: the same read finds the elements it is reading —
  // asserted by SHAPE (one screen, two lines of words) rather than by a total,
  // so it says what it is looking at rather than counting to a number.
  assert.equal((html.match(/class="st-app-phone"/g) || []).length, 1, "there is no phone to be inert");
  assert.equal((html.match(/<span/g) || []).length, 2, "the tile's two lines are gone");
});

test("DRIVEN: the tile takes no site, and says the same thing for every one", () => {
  // NO site has a mobile app, so there is nothing per-site to say and a
  // parameter nothing reads is a guess written as code. Driven with arguments
  // anyway, since the failure this forbids is somebody wiring one in silently.
  const tile = loadAppTile();
  assert.equal(tile.length, 0, "it grew a parameter — is it read, or is it a guess?");
  const plain = tile();
  for (const site of [{ id: "s1", backend: true, url: "https://x/" }, null, undefined, {}]) {
    assert.equal(tile(site), plain, "the tile answered differently for a site it must ignore");
  }
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
  assert.equal((cell.match(/siteAppTile\(\)/g) || []).length, 1,
    "the grid cell must call siteAppTile exactly once");
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
  const tile = cell.indexOf("siteAppTile()");
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
  const html = loadAppTile()();
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
  const html = loadAppTile()();
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
  const m = /aspect-ratio:\s*([\d.]+)\s*(?:\/\s*([\d.]+))?/.exec(decl);
  assert.ok(m, what + " has no aspect-ratio");
  return m[2] ? Number(m[1]) / Number(m[2]) : Number(m[1]);
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
  const phone = ratio(rule(css, ".st-app-phone"), "the phone");
  const want = (1 / thumb) * phone;

  const pair = rule(css, ".st-pair");
  const cols = /grid-template-columns:\s*([^;]+)/.exec(pair);
  assert.ok(cols, "the pair has no columns");
  const m = /1fr\s+([\d.]+)fr/.exec(cols[1]);
  assert.ok(m, "the pair's columns are not `1fr <n>fr`: " + cols[1].trim());
  assert.ok(Math.abs(Number(m[1]) - want) < 0.001,
    "the phone column is " + m[1] + " where the two ratios give " + want.toFixed(4)
    + " — the phone no longer stands as tall as the thumbnail");

  // AND THE PHONE IS SIZED FROM THE COLUMN, never from a fixed width: a px
  // width looks right at the size it was drawn at and breaks at the two
  // breakpoints, where the card widens to 382 and then 480.
  assert.match(rule(css, ".st-app-phone"), /width:\s*100%/,
    "the phone must take the column's width, so its height follows the card's");
});

test("the handset is the same shape as the workspace panel's, not a near-miss", () => {
  // Two phones drawn by one app should be one shape. Asserted by identity
  // against the panel's own base device rather than by both spelling a number.
  const css = read("../public/styles.css");
  assert.equal(ratio(rule(css, ".st-app-phone"), "the card's phone"),
    ratio(rule(css, ".st-mob-device"), "the workspace panel's phone"),
    "the two phones this app draws are different shapes");
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
    + "\n" + cut("siteWires") + "\n" + cut("siteDbIcon")
    + "\nreturn { db: siteDbIcon, wires: siteWires, SITE_X, APP_X, DB_X };")();
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
  assert.ok(db({ id: "s1", react: true, backend: true }).includes(svg),
    "the icon does not draw the wires");
  // The declaration matches a bare `siteWires()` too, so it is excluded by name
  // — counting it would let the one real call be deleted and still read as 1.
  const chat = blankComments(read("../public/chat.js"));
  assert.equal((chat.match(/(?<!function )siteWires\(\)/g) || []).length, 1,
    "siteWires is called somewhere other than the icon, or nowhere at all");
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
