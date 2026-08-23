// ONE PAGE'S OWN COLOURS.
//
// WHAT WAS WRONG. The look was site-wide — one `site_look` row, one
// `site_tokens` row, one stylesheet — so "make the booking page calmer" was
// unreachable at ANY price: not by typing, and not by paying for a rebuild
// either, because there was no scope to write it into.
//
// MEASURED THROUGH THE REAL CONTAINER AND A REAL BROWSER before the lane was
// wired: the scoped block lands in the stylesheet, `/` keeps the theme's colour
// (`oklch(0.975 0.004 90)`), `/book` gets the override (`rgb(16, 20, 24)`), and
// the stamp follows CLIENT-SIDE navigation — which a fresh load cannot show.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pageTokensCss, routeSelectorOk, pageScopeFor, MAX_PAGE_TOKENS, validForWrite } from "../builder/site-tokens.mjs";
import { ASK_TOOL } from "../builder/site-ask.mjs";

const R = (f) => fs.readFileSync(path.join(import.meta.dirname, "..", f), "utf8");
const worker = R("worker.js");
const root = R("builder/lovable/template/src/routes/__root.tsx");
const container = R("builder/build-server.mjs");
const client = R("public/chat.js");

// ── THE CSS ─────────────────────────────────────────────────────────────────

test("a page's colours are emitted under its own scope", () => {
  const css = pageTokensCss({ "/book": { background: "#101418" }, "/": { primary: "#8b1a1a" } });
  assert.match(css, /body\[data-page="\/book"\] \{[^}]*--background: #101418;/);
  assert.match(css, /body\[data-page="\/"\] \{[^}]*--primary: #8b1a1a;/);
});

test("`body[…]` rather than `[…]`, so specificity settles it as well as ordering", () => {
  // A bare attribute selector is (0,1,0) — exactly `:root`'s — so it would depend
  // on this block being appended last. True today, one refactor from not being.
  const css = pageTokensCss({ "/book": { background: "#101418" } });
  assert.ok(!/^\[data-page/m.test(css), "the scope is a bare attribute selector and only wins by ordering");
  assert.match(css, /body\[data-page=/);
});

test("a path that cannot go in a selector is REFUSED, never escaped", () => {
  // The value lands inside an attribute selector, where a quote closes the rule.
  // There is no correct escape for arbitrary text there, so the set of shapes a
  // route can take is listed instead — the rule `isColor` lives under.
  for (const bad of ['/a"] { --background: red } body[x="', "/a{b}", "/A", "/a b", "book", "//evil", 7, null, "/" + "x".repeat(90)]) {
    assert.equal(routeSelectorOk(bad), false, JSON.stringify(bad) + " was accepted");
    assert.equal(pageTokensCss({ [String(bad)]: { background: "#fff" } }), "", "it reached the stylesheet: " + bad);
  }
  assert.equal(routeSelectorOk("/"), true);
  assert.equal(routeSelectorOk("/book"), true);
  assert.equal(routeSelectorOk("/our-work/2026"), true);
});

test("nothing to say writes nothing at all", () => {
  // A build that never asked for one must produce a byte-identical stylesheet to
  // the build before this existed.
  for (const empty of [null, undefined, {}, [], "x", { "/book": {} }, { "/book": null }]) {
    assert.equal(pageTokensCss(empty), "", JSON.stringify(empty));
  }
});

test("only writable tokens reach the page, and the count is bounded", () => {
  const css = pageTokensCss({ "/book": { background: "#101418", nonsense: "#fff" } });
  assert.ok(!/nonsense/.test(css), "an unknown token was written into a page scope");
  const many = Object.fromEntries(
    Array.from({ length: MAX_PAGE_TOKENS + 6 }, (_, i) => ["/p" + i, { background: "#101418" }]));
  const blocks = (pageTokensCss(many).match(/body\[data-page=/g) || []).length;
  assert.equal(blocks, MAX_PAGE_TOKENS, "the per-page cap does not bind");
});

// ── THE STAMP ───────────────────────────────────────────────────────────────

test("the page is stamped where every page can be reached", () => {
  // `<body>` and not the frame: 16 of 318 exemplars do not use `SiteChrome`, so
  // a stamp there is a scope those pages never enter.
  // THE PROPERTY, NOT THE EXPRESSION. This pinned `data-page={usePagePath()}`
  // exactly and went red on a correct change: the root reads the active
  // LANGUAGE off the same pathname now, so the value arrives through one local
  // instead of a second call. What this is for is that the stamp is on `<body>`
  // and comes from the router, which the next assertion holds.
  assert.match(root, /<body[^>]*\bdata-page=\{[^}]+\}/, "the page is not stamped on <body>");
  assert.match(root, /usePagePath\(\)/, "nothing derives the stamp from the router's own pathname any more");
  // THE SAME READING `head()` USES. `location.pathname` carries the basepath on
  // the workspace mount and not on the site's own domain, so the selector would
  // match on neither.
  assert.match(root, /useMatches\(\)/, "the stamp is not read off the router's matches");
  assert.ok(!/location\.pathname/.test(root.slice(root.indexOf("function usePagePath"))),
    "the stamp reads location.pathname, which carries the basepath on one mount and not the other");
});

test("a trailing slash is the same page, and home stays /", () => {
  // Driven through the real function's logic rather than restated: `/book/` and
  // `/book` must not be two selectors, and stripping must not turn "/" into "".
  const body = /function usePagePath\(\) \{([\s\S]*?)\n\}/.exec(root);
  assert.ok(body, "usePagePath is no longer declared the way this scan expects");
  const strip = (p) => p.replace(/\/+$/, "") || "/";
  assert.match(body[1], /replace\(\/\\\/\+\$\/, ""\) \|\| "\/"/,
    "a trailing slash is not stripped, or the home page becomes an empty selector");
  assert.equal(strip("/book/"), "/book");
  assert.equal(strip("/"), "/");
});

// ── THE CONTAINER ───────────────────────────────────────────────────────────

test("the container writes it AFTER the site's own colours", () => {
  // Same later-wins mechanism `writeTokens` runs on, one scope down.
  const a = container.indexOf("const tokensUsed = writeTokens(");
  const b = container.indexOf("writePageTokens(payload.pageTokens)");
  assert.ok(a > 0 && b > a, "the per-page colours are written before the site's, so the site's win");
  assert.match(container, /pageTokens: pageTokensUsed/, "the container never reports whether it applied them");
});

test("the container fails soft, like both writes above it", () => {
  // A site whose pages compiled must not be lost because one page's colour could
  // not be written.
  const fn = /function writePageTokens\([\s\S]*?\n\}/.exec(container);
  assert.ok(fn, "writePageTokens is no longer declared the way this scan expects");
  assert.equal((fn[0].match(/catch/g) || []).length, 2, "a failure in the emit or the read is not caught");
  assert.ok(!/throw/.test(fn[0]), "a failed page colour can take the whole build down");
});

// ── THE WIRING ──────────────────────────────────────────────────────────────

test("BOTH publish paths read the stored map and send it", () => {
  // The thirteen recorded wiring deaths, and this one has a specific shape: a
  // path that does not send the stored value sends nothing, and nothing means
  // every page is back on the site's colours — silently, on an edit the customer
  // asked for something else entirely. The `site_logo` failure exactly.
  assert.equal((worker.match(/'site_page_tokens'/g) || []).length >= 3, true,
    "not every path that reads the look asks for the per-page map");
  // A FLOOR, NOT AN EXACT COUNT. `assert.equal(sends, 2)` went red the day the
  // BUILD route started sending its own merged map — a third payload, and the
  // fix for the field being dead there. An exact count reads as precision and is
  // a bet that the set never grows for a good reason; what has to hold is that
  // no payload sends the map RAW (skipping the per-page `withContrast`).
  const sends = (worker.match(/pageTokens: pageTokensFor\(/g) || []).length;
  assert.ok(sends >= 3, "found " + sends + " container payloads carrying it — the spine, the shell and the build all must");
  const raw = (worker.match(/pageTokens: (?!pageTokensFor\()/g) || []).length;
  assert.equal(raw, 0, raw + " payload(s) send the per-page map raw — no derived ink on a dark page");
});

test("`withContrast` runs PER PAGE", () => {
  // A page moved onto a dark ground needs ITS OWN readable text colour. Derived
  // once for the site, every line of body copy on that page stays in the light
  // theme's dark grey — a real bug when the site-wide patch shipped, and this is
  // the same failure one scope down.
  const fn = /function pageTokensFor\(stored\) \{[\s\S]*?\n\}/.exec(worker);
  assert.ok(fn, "pageTokensFor is no longer declared the way this scan expects");
  assert.match(fn[0], /withContrast\(tokens\)/, "the per-page colours skip withContrast");
  assert.match(fn[0], /routeSelectorOk\(path\)/, "an unusable path is not refused before it reaches the container");
  // UNDEFINED RATHER THAN {}, so a build that never asked for one sends the
  // request it sent before this existed.
  assert.match(fn[0], /Object\.keys\(out\)\.length \? out : undefined/);
});

test("a named page's colours never touch the SITE's", () => {
  // …and vice versa. Absent means the whole site, which is what every colour
  // change ever made relies on.
  assert.match(worker, /const nextTokens = forPage \? \(priorTokens \|\| \{\}\) : mergeTokens\(priorTokens/,
    "a page colour is merged into the site's map as well");
  assert.match(worker, /if \(forPage\) \{[\s\S]{0,400}mergeTokens\(nextPageTokens\[forPage\]/,
    "a page's colours are replaced rather than accumulated, so an earlier one is lost");
});

test("a page the site does not have is ignored", () => {
  // A selector for a page nobody can reach is a change reported as applied that
  // no visitor sees, and the customer's colours would sit in `_meta` forever.
  // DRIVEN, NOT READ. This matched `eRoutes.includes(askedPage)` — one lane's
  // spelling of a rule BOTH lanes need — and went red the day the reading was
  // shared. `pageScopeFor` is a plain function, so the rule can be exercised
  // rather than described.
  assert.equal(pageScopeFor({ tokensPage: "/ghost" }, ["/", "/book"]), "",
    "a path the site does not have is stored anyway");
  assert.equal(pageScopeFor({ tokensPage: "/book" }, ["/", "/book"]), "/book",
    "a page the site really has is refused");
  // …and the shapes that are not a scope at all.
  // THE DANGEROUS PATH IS IN THE ROUTE LIST, which is the only case the selector
  // check can be the one refusing. The first draft passed a path that was ALSO
  // absent from the list, so `includes` caught it and dropping `routeSelectorOk`
  // changed no answer — a test green for the wrong reason. The value lands inside
  // an attribute selector, so a quote closes the rule and everything after it is
  // live CSS on a customer's site.
  assert.equal(pageScopeFor({ tokensPage: '/x"]{color:red}' }, ['/x"]{color:red}', "/"]), "",
    "a path that would close the CSS selector is accepted when the site has one");
  assert.equal(pageScopeFor({ tokensPage: '/x"]{color:red}' }, ["/"]), "",
    "a path that would close the CSS selector is accepted");
  assert.equal(pageScopeFor({}, ["/"]), "", "an unanswered field reads as a page");
  assert.equal(pageScopeFor({ tokensPage: ["/book"] }, ["/book"]), "",
    "a non-string is coerced into a page name");
});

test("it counts as a change, and is stored even when it goes back to nothing", () => {
  // Without the first, a page colour escalates to a ~27-credit rebuild that
  // cannot scope a colour either. Without the second, putting the last override
  // back is skipped and the site keeps what it was just told to drop.
  const cond = /if \(([^)]*!pageTokensMoved[^)]*)\) \{/.exec(worker);
  assert.ok(cond, "a page-colour-only edit is not counted as a change");
  assert.match(worker, /if \(pageTokensMoved\) \{\s*\n\s*await sqlQuery\(edb, "INSERT INTO _meta \(k,v\) VALUES \('site_page_tokens'/,
    "the per-page map is not written when it moved");
});

test("a failed compile rolls it back with the rest", () => {
  // Written to `_meta` before the recompile, so a failed compile leaves the
  // override waiting for the customer's next unrelated edit to apply it
  // silently, under a version label naming a typo they were fixing.
  assert.match(worker, /\["site_page_tokens", priorPageTokens\]/,
    "a failed look compile leaves the page override stored");
});

// ── REACHABILITY ────────────────────────────────────────────────────────────

test("the designer can name a page, and is told absent means the whole site", () => {
  const f = ASK_TOOL.input_schema.properties;
  assert.ok(f, "the router tool changed shape");
  const look = f.layer.description;
  const from = look.indexOf('"look" —');
  assert.ok(from > 0, "the layer description no longer opens the look clause the way this scan expects");
  const next = /\n"[a-z]+" —/.exec(look.slice(from + 9));
  const seg = look.slice(from, next ? from + 9 + next.index : undefined);
  assert.ok(seg.length > 200, "the look clause window collapsed to nothing");
  // NOT `/one page/i` — FOUND BY MUTATION. That matched the clause's own
  // parenthetical exclusion, which says the OPPOSITE of what is being asserted.
  // A phrase that appears in both the claim and its exclusion discriminates
  // nothing.
  //
  // AND NOT THE EXACT SENTENCE EITHER. The first fix pinned "colour can be for
  // one page" and went red the moment the clause honestly grew to cover a
  // typeface — a test about word order, which is this repo's most repeated
  // own-goal. What is asserted is the PROPERTY: both scopable things are named
  // as belonging here, and the one that is NOT scopable is named as not.
  assert.match(seg, /for one page/i, "the router never points a per-page look change at this lane");
  for (const what of [/colour/i, /typeface/i]) {
    assert.match(seg, what, "the per-page clause does not name " + what + " as something a page can have");
  }
  // CORNERS ARE THE MEASURED LIMIT and the clause has to say so, or the model
  // sends a page-scoped radius that rounds the cards and leaves every chip on
  // the site's value — the kit derives `--radius-sm` at `:root`, so a page scope
  // reaches the direct uses and not the derived ones. Driven in a real browser.
  assert.match(seg, /corners/i, "the clause does not refuse the one thing that cannot be scoped");
  // AND WORKED EXAMPLES, because the announcement alone is a sentence the model
  // has to generalise from — the examples are what it actually matches against.
  assert.match(seg, /booking page darker|page should feel calmer/i,
    "the per-page clause has no example of a colour");
  assert.match(seg, /handwritten|serif on the about page/i,
    "the per-page clause has no example of a typeface");
});

test("A PAGE IS SCOPED IN THE STYLESHEET, and the site-wide case is still the default", () => {
  // ── INVERTED (2026-08-23): `tokensPage` WENT AND THE CAPABILITY WIDENED ────
  //
  // The field named a route and scoped a colour or a typeface to it. What
  // replaced it is a selector: `<body>` carries the current route as
  // `data-page`, so a model writing raw CSS scopes ANYTHING to a page — which
  // the field could not (it refused corners and spacing by name, because those
  // were derived from the site's values at `:root`).
  //
  // THE PROPERTY THIS TEST HELD IS UNCHANGED AND STILL MATTERS: a page scope
  // must be the NARROW case. The field's own risk was defaulting to a page and
  // silently narrowing every site-wide colour change ever made; the selector's
  // is the same one — a model that reaches for `body[data-page]` by habit gives
  // a customer a change on one page when they asked for the site. So the tool
  // says the scope is available and says it is for ONE page rather than the way
  // to write a stylesheet.
  const at = worker.indexOf("      css: {");
  assert.ok(at > 0, "the css field is gone from design_schema");
  const block = worker.slice(at, worker.indexOf("\n      },", at));
  assert.match(block, /body\[data-page/, "the designer cannot scope a page at all, so nothing can ever ask for one");
  assert.match(block, /ONE PAGE/i, "the scope is offered without saying it is the narrow case");
  // AND THE FIELD REALLY IS GONE, asserted as an absence — restored beside `css`
  // it would give a page two ways to be scoped with nothing deciding between
  // them, and whichever the container applied last would win.
  const code = worker.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(code, /\n\s{6}tokensPage: \{/, "`tokensPage` is back beside `css`");
});

test("the customer is told WHICH page", () => {
  // Without it a scoped change and a site-wide one read identically — and the
  // customer goes and looks at the home page, sees nothing, and concludes it
  // failed. Both ends, because either alone passes while the wire is cut.
  assert.match(worker, /tokensPage: forPage,/, "the response never says which page");
  assert.match(client, /e\.tokensPage/, "the client never reads which page");
  assert.match(client, /' on ' \+ e\.tokensPage/, "the page is read and not said");
});

test("validForWrite is what bounds a page's tokens, shared with the site's", () => {
  // Two readings of "which colours may be written" is two things that can
  // disagree, and the direction they disagree in is a property the page emits
  // that nothing reads.
  const t = validForWrite({ background: "#101418", nonsense: "x" });
  assert.deepEqual(Object.keys(t), ["background"]);
});

// ── THE BUILD ROUTE ─────────────────────────────────────────────────────────
//
// `tokensPage` was read at exactly two places and BOTH were the look edit lane,
// so on the build route the field was dead — and dead in the direction that
// still changes the site. `mergeTokens(priorTokens, designed.tokens)` takes the
// colours regardless, so a brief asking for a warmer MENU page got a warmer
// WHOLE SITE: the field's own description warns about that mistake pointed the
// other way, and this one was ours rather than the model's. Nothing stored it
// either, so it never came right later the way a deferred value would.

test("THE BUILD ROUTE ASKS WHICH PAGE, AND ASKS THE SAME FUNCTION THE EDIT LANE DOES", () => {
  // ONE READING, DERIVED. Two lanes answering "which page is this for"
  // differently is the bug itself, not a tidiness question: `""` means the site,
  // so a lane that reads a named page as no-page is a lane that applies a page
  // request to every page. Asserted as a count over the whole file, so a third
  // lane cannot quietly hand-roll a third answer.
  const rolled = [...worker.matchAll(/\.tokensPage\b/g)];
  assert.ok(rolled.length <= 1,
    "tokensPage is read in " + rolled.length + " places — every lane must ask pageScopeFor, " +
    "or two of them will disagree about whether a page was named");
  const scopes = [...worker.matchAll(/pageScopeFor\(designed, ([^)]*)\)/g)].map((m) => m[1]);
  assert.equal(scopes.length, 2, "expected the build route and the look edit lane to ask, found " + scopes.length);
  // THE ROUTE LISTS DIFFER ON PURPOSE and that is the whole reason the list is a
  // parameter: on a build the page SOURCE does not exist yet, so the only
  // authority on which pages the site has is the plan the designer just wrote.
  assert.ok(scopes.some((s) => /pages/.test(s)),
    "no lane resolves against a page list at all: " + JSON.stringify(scopes));
  assert.ok(scopes.some((s) => /eRoutes/.test(s)),
    "the look edit lane stopped resolving against the stored source: " + JSON.stringify(scopes));
});

test("A PAGE COLOUR ON A BUILD DOES NOT REPAINT THE WHOLE SITE", () => {
  // The bug itself. Without the gate the site's map takes the answer and every
  // page changes — reported as a success, on the one route where the customer
  // has no earlier version to compare against.
  assert.match(worker, /const siteTokens = forPage \? \(priorTokens \|\| \{\}\) : mergeTokens\(priorTokens/,
    "a page colour is merged into the SITE's map on a build");
  // …and the page's map accumulates, so a later build naming one colour keeps
  // the ones it did not mention.
  const at = worker.indexOf("const nextPageTokens");
  assert.ok(at > 0, "the build route computes no per-page map");
  assert.match(worker.slice(at, at + 500), /mergeTokens\(nextPageTokens\[forPage\]/,
    "a page's colours are replaced rather than accumulated, so an earlier one is lost");
});

test("A PAGE TYPEFACE ON A BUILD DOES NOT RE-FONT THE WHOLE SITE", () => {
  // `designed.fonts` reaching `mergeLook` sets the SITE's typeface, so "the menu
  // page should be handwritten" would re-set every heading on every page.
  // Stripped from the INPUT, so `look`, the trace and the `site_look` write are
  // all correct from one expression rather than three that can disagree.
  assert.match(worker, /forPage && designed && designed\.fonts\s*\n?\s*\?\s*mergeLook\(priorLook, \{ \.\.\.designed, fonts: undefined \}/,
    "a page typeface on a build re-fonts the whole site");
});

test("THE BUILD STORES BOTH PER-PAGE MAPS, AND CARRIES THEM TO THE CONTAINER", () => {
  // The wiring layer, where this repo has recorded a dozen features that were
  // correct everywhere else. Computing the map and handing the container the
  // STORED one is exactly what was wrong before: `pageTokens: priorPageTokens`
  // read as plumbing and was the reason the whole field was dead.
  // PER WRITE, NEVER ONE REGEX ACROSS BOTH LANES. The first draft was
  // `VALUES ('site_page_tokens', ?)[\s\S]{0,200}JSON.stringify(next` — and there
  // are TWO such writes, the build route's and the look edit lane's, whose value
  // sits on the following line. So a mutation making the BUILD store the prior
  // map (a write that changes nothing, and the whole feature dead again) was
  // satisfied by the OTHER lane's write 1,500 lines away. Vacuous by scope, this
  // repo's most-recorded test failure, found by mutation and not by reading.
  for (const key of ["site_page_tokens", "site_page_fonts"]) {
    const writes = [...worker.matchAll(new RegExp("VALUES \\('" + key + "', \\?\\)[^;]*?;", "g"))];
    assert.equal(writes.length, 2,
      "expected the build route and the look edit lane to write " + key + ", found " + writes.length);
    for (const wm of writes) assert.match(wm[0], /JSON\.stringify\(next/,
      "a " + key + " write at " + wm.index + " stores the PRIOR map — it changes nothing, and the " +
      "page override is lost the moment the build ends: " + wm[0].replace(/\s+/g, " ").slice(0, 160));
  }
  // AND THE BUILD'S WRITES ARE GATED ON MOVEMENT, NOT DEAD. A mutant replacing
  // the gate with `if (false)` survived the sweep: the statement still exists
  // for the source-read above, the merged map still reaches the container (so
  // the page renders right ON THIS BUILD), and the row is never written — so the
  // override vanishes on the customer's next edit, which reads the store. The
  // condition is what does the work, so the condition is what is held: each gate
  // must be a real next-vs-prior comparison.
  const gates = [...worker.matchAll(/if \(JSON\.stringify\(next(PageTokens|PageFonts)\) !== JSON\.stringify\(prior\1 \|\| \{\}\)\) \{/g)];
  assert.equal(gates.length, 2,
    "the build's per-page writes are not gated on the map having moved — either dead (`if (false)`: " +
    "the override renders once and is lost) or unconditional (every build rewrites two rows that did not change)");
  // LANDMARKS, NOT A BYTE COUNT. This was `indexOf("plan: normalizePlan(") -
  // 3500`, and it lasted ONE HOUR: the langs threading added two lines above
  // the plan and pushed `pageTokens:` out of the window, turning this red on a
  // correct change. The call block starts at the fonts line and ends at the
  // plan line, whatever sits between.
  // …AND THE END ANCHOR MUST BE THE CODE FORM, NOT A PHRASE PROSE ALSO USES.
  // `indexOf("plan: normalizePlan(")` found the COMMENT explaining the look
  // literal's bug — which spells the code it describes — 260 lines above the
  // call, so callTo < callFrom and the floor fired on correct code. Prose
  // describing a thing contains that thing's spelling; the full call spelling
  // appears only in the call.
  const callFrom = worker.indexOf("fonts: look.fonts,");
  const callTo = worker.indexOf("plan: normalizePlan(Object.fromEntries(");
  assert.ok(callFrom > 0 && callTo > callFrom, "the build call block moved — re-anchor this test");
  const call = worker.slice(callFrom, callTo);
  // THROUGH `pageTokensFor`, NOT RAW — my own first draft sent the bare map, and
  // that function derives the readable ink PER PAGE (`withContrast`): raw, a
  // page moved onto a dark ground keeps the light theme's dark grey body copy,
  // the exact bug the function was written for.
  assert.match(call, /pageTokens: pageTokensFor\(nextPageTokens\)/,
    "the build hands the container the STORED page colours, or the raw map with no derived ink");
  assert.match(call, /pageFonts: nextPageFonts/, "the build hands the container the STORED page fonts, not the merged ones");
});

test("a build that names no page is byte-identical to before", () => {
  // The safety property. Every site ever built answered no `tokensPage`, so the
  // fix must be a no-op for all of them — asserted through the real function
  // rather than by reading the branch, since what matters is the value the
  // branches key on.
  assert.equal(pageScopeFor({ tokens: { background: "#fff" } }, ["/", "/book"]), "",
    "a colour change with no page named reads as page-scoped, so the site would stop changing");
});
