// ONE PAGE'S OWN TYPEFACE.
//
// The look lane could change the site's fonts and the router said so in as many
// words: *"a request to change one page's TYPEFACE or corners is not this"*. So
// "the menu page should be in something handwritten" escalated to a ~27-credit
// page rewrite that could not do it either — the container writes one font pair
// for the whole site.
//
// WHY IT IS POSSIBLE AT ALL WAS MEASURED FIRST, in a real browser, before a line
// of this was written. The template applies fonts as plain `var()` reads —
// `body { font-family: var(--font-sans) }` and `h1,h2,h3,h4 { font-family:
// var(--font-heading) }` — so overriding those two on `body[data-page="/menu"]`
// reaches both: `PageSans` on the body, `PageHead` on the heading.
//
// AND WHY CORNERS ARE NOT IN IT, from the same measurement. The kit derives
// `--radius-sm`/`--radius-xl` with `calc(var(--radius) ± Npx)` AT `:root`, and a
// custom property is computed where it is DECLARED — so a page-scoped `--radius`
// moved the cards to 24px and left every chip at 6px and every panel at 18px. A
// page rounded in some places and not others reads as a badly-made site, which
// is worse than the honest limit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolvePageFonts, resolvePair, fontCss, fontImports, MAX_PAGE_FONTS } from "../builder/site-fonts.mjs";

const ROOT = new URL("..", import.meta.url);
const read = (p) => readFileSync(fileURLToPath(new URL(p, ROOT)), "utf8");

test("a page's pair is resolved like the site's, and a bad address is refused", () => {
  const { pages } = resolvePageFonts({ "/menu": { heading: "lobster", body: "geist" } });
  assert.equal(pages.length, 1);
  assert.equal(pages[0].route, "/menu");
  assert.ok(pages[0].pair.heading && pages[0].pair.body, "the pair was not resolved");
  // THE ROUTE LANDS INSIDE AN ATTRIBUTE SELECTOR, where a quote closes the rule
  // and there is no correct escape for arbitrary text. Refused rather than
  // escaped — the rule `isColor` already lives under.
  for (const bad of ['/x"y', "/x{y}", "menu", "", "/x<script>", "/x'y"]) {
    const r = resolvePageFonts({ [bad]: { heading: "geist" } });
    assert.deepEqual(r.pages, [], JSON.stringify(bad) + " reached a selector");
    assert.ok(r.notes.length, JSON.stringify(bad) + " was refused in silence");
  }
});

test("the number of extra typefaces is capped, and the cap is said out loud", () => {
  // Every extra pair is up to two more woff2 files a VISITOR downloads, on a
  // platform whose customers' customers are mostly on phones.
  const many = {};
  for (let i = 0; i < MAX_PAGE_FONTS + 3; i++) many["/p" + i] = { heading: "geist" };
  const r = resolvePageFonts(many);
  assert.equal(r.pages.length, MAX_PAGE_FONTS);
  assert.ok(r.notes.some((n) => /can have their own typeface/i.test(n)), "the cap is silent");
  assert.ok(MAX_PAGE_FONTS >= 1 && MAX_PAGE_FONTS <= 4, "the cap stopped being a cap");
});

test("the scoped rule beats :root on SPECIFICITY, not on source order", () => {
  // `body[data-page="/x"]` is (0,1,1) against `:root`'s (0,1,0). That is what
  // makes it safe to write after Tailwind's own emission — a second `:root` was
  // NOT safe there: the minifier proved it dead and the build shipped the
  // default font while reporting the chosen one.
  const site = resolvePair({ heading: "geist", body: "geist" });
  const { pages } = resolvePageFonts({ "/menu": { heading: "lobster", body: "geist" } });
  const css = fontCss(site, {}, pages);
  assert.match(css.scoped, /^body\[data-page="\/menu"\]\{/, css.scoped.slice(0, 80));
  assert.match(css.scoped, /--font-sans:/);
  assert.match(css.scoped, /--font-heading:/);
  // The @theme half is unchanged — the site's own fonts still go in there, and
  // a scoped rule may not.
  assert.ok(!css.vars.includes("data-page"), "a scoped rule leaked into @theme, which may not contain one");
  // NOTHING AT ALL when no page has its own, so a site that does not use this
  // produces a byte-identical stylesheet to before it existed.
  assert.equal(fontCss(site, {}, []).scoped, "");
  assert.equal(fontCss(site, {}).scoped, "");
});

test("a page's own family gets an @font-face of its own", () => {
  // A PAGE FAMILY THE SITE DOES NOT HAVE, which is the whole point. The dedup
  // test below used one family for BOTH scopes, so a mutation dropping the page
  // loop entirely still declared it via the site's pair and SURVIVED — an
  // assertion satisfied by the wrong half of the thing it was checking.
  const site = resolvePair({ heading: "geist", body: "geist" });
  const { pages } = resolvePageFonts({ "/menu": { heading: "lobster", body: "geist" } });
  const files = {};
  for (const p of [site, ...pages.map((x) => x.pair)]) {
    for (const slot of ["heading", "body"]) if (p[slot].source === "fetch") files[p[slot].id] = "/fonts/" + p[slot].id + ".woff2";
  }
  const pageIds = pages.flatMap((x) => ["heading", "body"].map((k) => x.pair[k]).filter((f) => f.source === "fetch").map((f) => f.id));
  assert.ok(pageIds.length, "the page's typeface is not a fetched one, so this proves nothing");
  const css = fontCss(site, files, pages);
  for (const id of pageIds) {
    assert.ok(css.faces.includes(files[id]), "the page's family has no @font-face: " + id);
  }
  // …and with the page dropped there is none, so the assertion above is really
  // about the page rather than about the site's own pair.
  assert.ok(!fontCss(site, files, []).faces.includes(files[pageIds[0]]),
    "the site's own pair already declares it — this cannot discriminate");
});

test("a family is declared ONCE however many scopes ask for it", () => {
  // Two @font-face rules for one family is a second download in some browsers
  // and dead bytes in the rest.
  const site = resolvePair({ heading: "lobster", body: "geist" });
  const { pages } = resolvePageFonts({ "/menu": { heading: "lobster", body: "lobster" } });
  const files = {};
  for (const p of [site, ...pages.map((x) => x.pair)]) {
    for (const slot of ["heading", "body"]) if (p[slot].source === "fetch") files[p[slot].id] = "/fonts/" + p[slot].id + ".woff2";
  }
  const css = fontCss(site, files, pages);
  const faces = css.faces.match(/@font-face\{/g) || [];
  const ids = new Set(Object.keys(files));
  assert.equal(faces.length, ids.size, "a family was declared " + faces.length + " times for " + ids.size + " files");
});

test("an INSTALLED page font is still bundled", () => {
  // A page whose typeface is one of the shortlist's npm packages and that
  // nothing imports renders the fallback while the build reports the font it
  // asked for — the exact failure shape site-fonts.mjs is written around.
  const site = resolvePair({ heading: "geist", body: "geist" });
  const { pages } = resolvePageFonts({ "/menu": { heading: "playfair-display", body: "geist" } });
  const withPages = fontImports(site, pages);
  const without = fontImports(site);
  assert.ok(withPages.length > without.length, "the page's package is imported by nothing: " + JSON.stringify(withPages));
  // Deduped: two scopes on one family is one import.
  assert.equal(new Set(withPages).size, withPages.length);
});

// ───────────────────────────────────────────────── and the chain that reaches it

test("the container resolves the page pairs and writes them after @theme", () => {
  const b = read("builder/build-server.mjs");
  assert.match(b, /resolvePageFonts\(pageFonts \|\| \{\}\)/, "the container never resolves a page pair");
  // ANCHORED ON THE ARGUMENT, NOT THE ARITY. These pinned the exact three- and
  // two-argument calls and went red the moment a FOURTH honest argument joined
  // them — the families the site's own stylesheet names, which since 2026-08-23
  // is where nearly every typeface arrives. A test about how many things ride
  // beside the one under test, failing a correct change: this repo's most
  // repeated own-goal. What has to hold is that the page scopes are what the
  // call is given, whatever else goes with them.
  assert.match(b, /fontCss\(pair, written, pageScopes\b/, "the page scopes never reach the CSS");
  assert.match(b, /fontImports\(pair, pageScopes\b/, "a page's installed font is bundled by nothing");
  assert.match(b, /decls\.scoped/, "the scoped rules are computed and never written");
  // OUTSIDE `@theme`, which may not contain a scoped rule — asserted by the
  // scoped half being appended to the themed string rather than inserted into
  // the block the way `decls.vars` is.
  const i = b.indexOf("const themed = base.replace(");
  assert.ok(i > 0);
  const win = b.slice(i, b.indexOf("\n  }", i));
  assert.ok(win.indexOf("themed +") > 0 && win.indexOf("decls.scoped") > win.indexOf("themed +"),
    "the scoped rules are not appended after the @theme block");
  assert.match(b, /writeFonts\(payload\.fonts, payload\.fontFiles, payload\.pageFonts\b/, "the payload's page fonts are ignored");
});

test("A PAGE IS SCOPED IN THE STYLESHEET NOW — the field is gone and the hook is stated", () => {
  // ── INVERTED, AND THE CAPABILITY IS WIDER RATHER THAN LOST ─────────────────
  //
  // `tokensPage` named a route and scoped a colour or a typeface to it. It went
  // with the other four look fields on 2026-08-23, and what replaced it is not
  // an absence: `<body>` carries the current route as `data-page`, stamped from
  // the router's own matches, so a model writing raw CSS can scope ANYTHING to a
  // page. The old field refused corners and spacing outright — they were derived
  // from the site's values and could not be scoped — and a `body[data-page]`
  // rule has no such limit.
  //
  // THE HOOK HAS TO BE STATED OR THE CAPABILITY IS UNREACHABLE. `data-page` is a
  // stamp of ours on an element nothing else in the tool mentions; a model not
  // told about it cannot know a page is addressable, and "make the booking page
  // calmer" becomes impossible at any price. That is the `publicView` failure
  // exactly — a capability conditioned on a fact the model was never given — and
  // it has cost this platform a whole build twice.
  const w = read("worker.js");
  const code = w.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(code, /\n\s{6}tokensPage: \{/,
    "`tokensPage` is back beside `css`, so a page can be scoped two ways and nothing decides between them");
  const at = w.indexOf("      css: {");
  assert.ok(at > 0, "the css field is gone from design_schema");
  const block = w.slice(at, w.indexOf("\n      },", at));
  assert.match(block, /data-page/, "the model is never told a page can be addressed at all");
  assert.match(block, /body\[data-page/, "the hook is mentioned without the selector that uses it");
  assert.match(block, /is the home page/, "nothing says how to name the home page");

  // AND THE STAMP IS REALLY THERE, at the other end. The rule above is a claim
  // about the template, so a model told to write `body[data-page="/book"]`
  // against a body that carries no such attribute is being taught a selector
  // that matches nothing — silently, on every site.
  const root = read("builder/lovable/template/src/routes/__root.tsx");
  assert.match(root, /data-page/, "the template no longer stamps the route on <body>, so every page-scoped rule is dead");
});
