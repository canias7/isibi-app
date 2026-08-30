// A KIT FILE MAY NOT NAME A ROUTE WITH A LITERAL `<Link to="…">`.
//
// THE BUILD THIS EXISTS TO STOP — run 82, `ashgrove-1`, 2026-08-30, 18 credits:
//
//     src/lib/error-page.tsx(44,14): error TS2741: Property 'search' is missing
//     in type '{ children: string; to: "/" }' but required in type
//     'MakeRequiredSearchParams<RouterCore<Route<Register, any, "/", "/", …
//
// The model generated an `index.tsx` that declared `validateSearch` with
// REQUIRED fields — a configurator putting its timber and finish in the URL. In
// TanStack Router a route's search contract is part of its TYPE, so that
// retyped `/` for the whole app, and `<Link to="/">` sitting in a kit file
// written months earlier stopped compiling. `tsc --noEmit` refused, the build
// died at typecheck, salvage rightly declined to stub a file the build did not
// write, and the site kept its placeholder while the customer was charged.
//
// ── LITERAL vs WIDENED IS THE WHOLE PROPERTY ───────────────────────────────
//
// `<Link to={to}>` where `to` is a plain `string` does NOT have this problem,
// and the distinction is not a matter of taste — it is what TanStack's types do.
// A literal binds to that one route's generated type, so a change to the route's
// search contract retypes the link. A widened `string` does not resolve to any
// particular route and takes no contract with it.
//
// MEASURED, not assumed: `site-header.tsx`'s `SiteLink` renders `<Link to={to}>`
// with `to: string`, every base route imports it through `SiteChrome`, and
// `tsconfig`'s `exclude` drops files from the INITIAL list while still following
// imports into them — so it was in run 82's program and did NOT error, while
// `error-page.tsx` two files away did. The `SEARCHY_INDEX` fixture in
// test/integration/site-build.mjs declares exactly that contract and passes.
//
// So this guard bans the literal and leaves the widened form alone. Banning both
// would flag `SiteLink`, which is correct code doing a job an anchor cannot do
// (it tells an internal path from an external one), and this repo holds a check
// that flags correct code to be worse than no check at all.
//
// ── AND WHY A PLAIN ANCHOR IS THE RIGHT REPLACEMENT ────────────────────────
//
// `site-header.tsx` argues at length that `<a href="/book">` is wrong because
// the same bundle is served at `/s/<slug>/` on gofarther.dev. THAT REASONING IS
// STALE — the layer under it moved. `cleanSlug` now refuses an edge hyphen, so
// every slug is a legal DNS label, every site has a pretty host, `/s/<slug>/`
// 301s to it, and `/` is the only mount a Start bundle is ever served at. That
// conclusion is already asserted in test/site-seo.test.mjs, and `not-found.tsx`
// has relied on it with a plain `<a href>` since before this file existed.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const SRC = new URL("../builder/lovable/template/src/", import.meta.url).pathname;

// A LITERAL ROUTE TARGET ON A ROUTER `Link`. `to` must be followed by a QUOTE,
// which is what separates `to="/"` from `to={to}` — the whole property above.
const LITERAL_TO = /<\s*Link\b[^>]*?\bto\s*=\s*["']/g;

/**
 * Blank comments, preserving length, before any scan.
 *
 * REQUIRED HERE, NOT DEFENSIVE. This repo puts its reasoning in comments, and
 * all four fixes for this very bug spell `<Link to="/">` inside the comment
 * explaining why it is gone — so an unblanked scan reports every fix as the
 * defect it fixed. Length-preserving so reported line numbers still point at
 * the real place.
 *
 * STRINGS ARE TRACKED FOR `"` AND BACKTICK BUT DELIBERATELY NOT `'`.
 *
 * Tracking `'` is what a JavaScript tokeniser would do and it is WRONG on TSX,
 * because JSX text is not JavaScript: `<h1>This page didn't load</h1>` in
 * error-page.tsx opens an apostrophe that never closes, swallowing the next
 * forty lines — including the comment that spells the forbidden link, which
 * then survives into the scan. That was this guard's first draft, and it
 * false-alarmed on the three files it had just been written to certify.
 *
 * Dropping `'` costs almost nothing HERE and is measured rather than assumed:
 * the template has 5 single-quoted string literals against 7,780 double-quoted
 * ones. Double quotes and backticks are still tracked because `/*` appears
 * inside a string 38 times, and an untracked one would open a block comment
 * that runs to the next `*​/` and hides real code.
 */
function blankComments(src) {
  let out = "";
  let i = 0;
  let state = "code";
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (state === "code") {
      if (c === "/" && d === "/") { state = "line"; out += "  "; i += 2; continue; }
      if (c === "/" && d === "*") { state = "block"; out += "  "; i += 2; continue; }
      if (c === '"' || c === "`") { state = c; out += c; i++; continue; }
      out += c; i++; continue;
    }
    if (state === "line") {
      if (c === "\n") { state = "code"; out += c; i++; continue; }
      out += " "; i++; continue;
    }
    if (state === "block") {
      if (c === "*" && d === "/") { state = "code"; out += "  "; i += 2; continue; }
      out += c === "\n" ? "\n" : " "; i++; continue;
    }
    if (c === "\\") { out += "  "; i += 2; continue; }
    if (c === state) { state = "code"; out += c; i++; continue; }
    if (c === "\n") { out += c; i++; continue; }
    out += c; i++;
  }
  return out;
}

function walk(dir, hit = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    // `-parts/` IS THE MODEL'S OWN SPACE — components written for one site,
    // wiped by `resetRoutes` between builds and never checked in. Nothing there
    // is a kit file, and locally it holds whatever the last build left behind,
    // so scanning it would make this guard's answer depend on which build ran
    // last.
    //
    // THIS EXCLUSION IS UNTESTED, AND SAYING SO IS THE POINT. A sweep mutated
    // it away and nothing went red — inert, because the directory does not
    // exist in a checkout at all (3,412 files read either way). It is only ever
    // populated inside a container mid-build, which no unit test stands in. So
    // it is a stated intention rather than a proven behaviour; if it ever needs
    // to be proven, the fixture has to create the directory first.
    if (statSync(full).isDirectory()) { if (name !== "-parts") walk(full, hit); continue; }
    if (/\.tsx?$/.test(name)) hit.push(full);
  }
  return hit;
}

test("no checked-in template file names a route with a literal `<Link to=\"…\">`", () => {
  const files = walk(SRC);
  // THE OBSERVER IS ALIVE. An empty walk would report perfect compliance while
  // reading nothing — this repo's vacuous-assertion trap. The kit alone is over
  // two thousand components, so the floor sits well below the real number and
  // far above anything a broken walk could produce.
  assert.ok(files.length > 500,
    "only " + files.length + " template sources found — this walk has drifted and proves nothing");

  const offenders = [];
  for (const f of files) {
    const src = blankComments(readFileSync(f, "utf8"));
    for (const m of src.matchAll(LITERAL_TO)) {
      offenders.push(path.relative(SRC, f) + ":" + src.slice(0, m.index).split("\n").length);
    }
  }

  assert.deepEqual(offenders, [],
    "these template files name a route with a LITERAL `<Link to=\"…\">`:\n  " + offenders.join("\n  ") +
    "\nA kit file cannot know the search contract of the route it names — the model's generated page decides " +
    "that, and a page declaring required search params retypes the route and breaks this link with TS2741 at " +
    "the build's typecheck stage, in a file the model never saw. Use `<a href=\"…\">` (correct: `/` is the only " +
    "mount a Start bundle is served at) or `SiteLink`, whose `to` is a widened string and carries no contract.");
});

test("the scan can still SEE a literal link — a positive control", () => {
  // THE ABSENCE ABOVE PROVES NOTHING WITHOUT THIS. A regex that matched nothing,
  // a blanker that blanked everything, or a walk that read the wrong files would
  // all produce the same empty list. So the same pipeline is run over source
  // that definitely contains one, in each shape the kit really writes.
  const seen = (src) => [...blankComments(src).matchAll(LITERAL_TO)].length;

  assert.equal(seen('<Link to="/">home</Link>'), 1, "a plain literal link is invisible to the scan");
  assert.equal(seen('<Link\n  to="/book"\n  className="underline"\n>go</Link>'), 1,
    "a literal link broken across lines is invisible — which is how every one in this kit was written");
  assert.equal(seen("<Link to='/book'>go</Link>"), 1, "a single-quoted literal link is invisible");

  // AND THE WIDENED FORM IS NOT FLAGGED, which is the other half of the property
  // and the reason the first draft of this guard was wrong.
  assert.equal(seen("<Link to={to} className={className}>{children}</Link>"), 0,
    "`SiteLink`'s widened `to` is being flagged — that is correct code this check would teach the next session away from");
  assert.equal(seen("<Link to={`/p/${id}`}>go</Link>"), 0, "a template-literal target is not a bare literal");
});

test("the comment blanker hides prose without eating code", () => {
  // THE CHECK ON THE CHECKER, because the blanker is the half that fails
  // silently in both directions: too eager and the first test is unfalsifiable,
  // too shy and it flags the very fixes it exists to certify. Both asserted
  // against the exact shapes these files contain.
  const line = blankComments('// see `<Link to="/">` for why\nconst x = 1;\n');
  assert.equal([...line.matchAll(LITERAL_TO)].length, 0, "a link named in a `//` comment is still visible");
  assert.match(line, /const x = 1;/, "the blanker ate real code after a line comment");

  const jsx = blankComments('{/* not this `<Link to="/a">` */}\n<Link to="/b">go</Link>\n');
  assert.equal([...jsx.matchAll(LITERAL_TO)].length, 1, "a JSX block comment hid the real link or kept the quoted one");
  assert.match(jsx, /to="\/b"/, "the surviving match is not the code one");

  // THE APOSTROPHE, which is the bug this blanker was rewritten for. JSX text is
  // not JavaScript, and `didn't` is real text in error-page.tsx.
  const apos = blankComments('<h1>This page didn\'t load</h1>\n{/* `<Link to="/">` is gone */}\n<a href="/">home</a>\n');
  assert.equal([...apos.matchAll(LITERAL_TO)].length, 0,
    "an apostrophe in JSX text opened a string state that swallowed the comment below it — the first draft's false alarm");
  assert.match(apos, /<a href="\/">home<\/a>/, "the apostrophe state ate the code after the comment");

  // AND `//` INSIDE A STRING must not comment out the rest of the line.
  const str = blankComments('const s = "https://x.example";\nconst y = 2;\n');
  assert.match(str, /const y = 2;/, "a `//` inside a string swallowed the rest of the file");
  assert.match(str, /https:\/\/x\.example/, "a tracked string literal was blanked as if it were a comment");
});

test("the three files fixed for run 82 still offer their way home", () => {
  // WHAT THE ABSENCE ABOVE CANNOT SAY. Deleting all three links would satisfy it
  // exactly as well as fixing them. What is actually wanted is that these pages
  // still offer the route back they were written to offer — now by anchor.
  for (const [rel, href] of [
    ["routes/manage.tsx", "/book"],
    ["routes/book.tsx", "/"],
    ["lib/error-page.tsx", "/"],
  ]) {
    const src = blankComments(readFileSync(SRC + rel, "utf8"));
    assert.match(src, new RegExp('<a\\s+href="' + href.replace(/\//g, "\\/") + '"'),
      rel + ' no longer offers its `<a href="' + href + '">` — the way home the run-82 fix preserved is gone');
  }
});
