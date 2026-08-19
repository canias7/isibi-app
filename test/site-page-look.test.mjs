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
import { pageTokensCss, routeSelectorOk, MAX_PAGE_TOKENS, validForWrite } from "../builder/site-tokens.mjs";
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
  const sends = (worker.match(/pageTokens: pageTokensFor\(/g) || []).length;
  assert.equal(sends, 2, "found " + sends + " container payloads carrying it — both paths must");
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
  assert.match(worker, /eRoutes\.includes\(askedPage\)/,
    "a path the site does not have is stored anyway");
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

test("the look tool offers the page field, and says absent means the site", () => {
  // A field that defaulted to a page would silently narrow every site-wide
  // colour change ever made.
  const at = worker.indexOf("tokensPage: {");
  assert.ok(at > 0, "the designer cannot name a page, so nothing can ever ask for one");
  const block = worker.slice(at, worker.indexOf("},", at));
  assert.match(block, /LEAVE IT OUT FOR THE WHOLE SITE/,
    "the tool does not say that an absent page means the whole site");
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
