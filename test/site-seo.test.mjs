// The search-engine surface: sitemap, robots, the route manifest, redirects,
// and the honest 404 (site-seo.mjs + the Worker's publish and serve wiring).
//
// The serving half is driven through the REAL router with a fake R2 binding —
// the worker harness — because the twelve recorded wiring deaths all lived in
// exactly the layer a module test cannot see. The module half is driven as a
// ROUND TRIP through the real producer chain (routesContent → metaTags →
// injectMeta → parseSiteManifest), the routeOf lesson: two hand-written
// fixtures agree with each other and with neither end.
import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";

import {
  SITE_ORIGIN_TOKEN, MAX_REDIRECTS,
  siteRoutes, sitemapXml, robotsTxt, substituteOrigin,
  routesContent, redirectsContent, parseSiteManifest, mergeRedirects, decideFallback,
} from "../site-seo.mjs";
import { metaTags, injectMeta } from "../site-meta.mjs";
import { hit } from "./fixtures/worker-harness.mjs";

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

// ── The route list ──────────────────────────────────────────────────────────

test("siteRoutes maps stored page paths the way the container does", () => {
  const man = siteRoutes([
    { path: "index.tsx" }, { path: "book.tsx" }, { path: "menu/index.tsx" },
    { path: "src/routes/work.tsx" },              // the OTHER spelling — both must map
    { path: "book.tsx" },                          // duplicate collapses
    { path: "junk" }, null,                        // not pages
  ]);
  assert.deepEqual(man.routes, ["/", "/book", "/menu", "/work"]);
  assert.equal(man.dynamic, false);
});

test("a $ route marks the site dynamic and is never listed", () => {
  // A dynamic segment's concrete addresses are unknowable at publish, so the
  // manifest must not pretend to know the route space — routesContent answers
  // empty and the fallback fails open to 200, today's behaviour.
  const man = siteRoutes([{ path: "index.tsx" }, { path: "book/$id.tsx" }]);
  assert.equal(man.dynamic, true);
  assert.ok(!man.routes.some((r) => r.includes("$")), "a $ pattern leaked into the concrete list");
  assert.equal(routesContent(man), "", "a dynamic site must publish NO route list");
});

// ── Sitemap + robots ────────────────────────────────────────────────────────

test("the sitemap lists every concrete route on the origin token", () => {
  const xml = sitemapXml(["/", "/book"], "2026-08-14");
  assert.match(xml, new RegExp("<loc>" + SITE_ORIGIN_TOKEN.replace(/[/.]/g, "\\$&") + "/</loc>"));
  assert.match(xml, new RegExp("<loc>" + SITE_ORIGIN_TOKEN.replace(/[/.]/g, "\\$&") + "/book</loc>"));
  assert.match(xml, /<lastmod>2026-08-14<\/lastmod>/);
  assert.match(xml, /^<\?xml version="1\.0"/);
});

test("the sitemap refuses a route that could break the XML, and a junk lastmod", () => {
  const xml = sitemapXml(["/ok", "/bad<route>", "/also&bad"], "yesterday");
  assert.match(xml, /\/ok</);
  assert.ok(!xml.includes("bad"), "a route outside the safe class reached the XML");
  assert.ok(!xml.includes("<lastmod>"), "an unparseable lastmod was printed anyway");
});

test("robots.txt declares the sitemap — the line the template's file never had", () => {
  const txt = robotsTxt();
  assert.match(txt, /User-agent: \*/);
  assert.match(txt, new RegExp("Sitemap: " + SITE_ORIGIN_TOKEN.replace(/[/.]/g, "\\$&") + "/sitemap\\.xml"));
});

test("substituteOrigin replaces every token and strips a trailing slash from the base", () => {
  const xml = sitemapXml(["/", "/book"], "2026-08-14");
  const out = substituteOrigin(xml, "https://x.gofarther.app/");
  assert.ok(!out.includes(SITE_ORIGIN_TOKEN), "a token survived substitution");
  assert.match(out, /<loc>https:\/\/x\.gofarther\.app\/<\/loc>/);
  assert.match(out, /<loc>https:\/\/x\.gofarther\.app\/book<\/loc>/);
  // An empty base is a no-op rather than emptying the URLs.
  assert.equal(substituteOrigin(xml, ""), xml);
});

// ── The manifest round trip ─────────────────────────────────────────────────

test("the manifest survives the REAL publish chain: encode → metaTags → injectMeta → parse", () => {
  // Producer into consumer, never two fixtures: routesContent/redirectsContent
  // write it, site-meta carries it, parseSiteManifest reads it back. If any
  // link re-spells the format, this is the test that knows.
  const man = siteRoutes([{ path: "index.tsx" }, { path: "book.tsx" }]);
  const redirects = { "/gallery": "/", "/old-menu": "/book" };
  const html = injectMeta(
    "<html><head><title>Shop</title></head><body></body></html>",
    { brand: "Sharp Fade", slug: "sharp-fade", routesCsv: routesContent(man), redirectsCsv: redirectsContent(redirects) },
  );
  const back = parseSiteManifest(html);
  assert.ok(back, "the manifest did not survive the head");
  assert.deepEqual(back.routes, ["/", "/book"]);
  assert.deepEqual(back.redirects, redirects);
});

test("a page with NO manifest parses as null — never as an empty route list", () => {
  // Every site published before this existed has no manifest, and the caller
  // must read that as "no opinion". An empty list would 404 every page of
  // every old site on the day this deployed.
  assert.equal(parseSiteManifest("<html><head><title>x</title></head></html>"), null);
  assert.equal(parseSiteManifest(""), null);
  assert.equal(parseSiteManifest(null), null);
});

test("redirectsContent refuses junk and caps the map", () => {
  const big = {};
  for (let i = 0; i < MAX_REDIRECTS + 20; i++) big["/r" + i] = "/";
  assert.equal(redirectsContent(big).split(",").length, MAX_REDIRECTS);
  assert.equal(redirectsContent({ "bad": "/", "/ok": "nope", '/x"y': "/" }), "", "a non-path pair was encoded");
});

test("parseSiteManifest drops a self-redirect and a non-path pair", () => {
  const html = '<meta name="site-redirects" content="/a=/a,/b=/,junk,=x,/c">';
  const back = parseSiteManifest(html);
  assert.deepEqual(back.redirects, { "/b": "/" });
});

// ── The redirect merge ──────────────────────────────────────────────────────

test("a route that disappeared redirects home; one that came back serves itself", () => {
  const prev = { routes: ["/", "/book", "/gallery"], redirects: { "/old": "/book" } };
  const out = mergeRedirects(prev, ["/", "/book"]);
  assert.equal(out["/gallery"], "/", "the deleted page left no redirect");
  assert.equal(out["/old"], "/book", "an accumulated redirect was dropped");
  // Now /gallery is re-added: its redirect must go, or the page never serves.
  const back = mergeRedirects({ routes: ["/", "/book"], redirects: out }, ["/", "/book", "/gallery"]);
  assert.ok(!("/gallery" in back), "a re-added page still redirects away from itself");
});

test("a kept redirect whose target has gone re-points at home — never a chain", () => {
  const prev = { routes: ["/", "/menu"], redirects: { "/old": "/menu" } };
  const out = mergeRedirects(prev, ["/"]);
  assert.equal(out["/old"], "/", "a redirect chains into a second redirect");
  assert.equal(out["/menu"], "/", "the newly-gone route got no redirect");
});

test("AT THE CAP IT IS THE OLDEST REDIRECT THAT GOES, NEVER THE NEWEST", () => {
  // The cap keeps the FIRST MAX_REDIRECTS pairs, so which end mergeRedirects
  // writes first decides which end survives. Written carried-over-first, the
  // pair dropped on a site at the cap is the page deleted JUST NOW — the one
  // whose address is in Google's index today — while a redirect from a year ago
  // is kept forever, and it is unrecoverable because a dropped pair never
  // reaches the manifest.
  const oldRedirects = {};
  for (let i = 0; i < MAX_REDIRECTS; i++) oldRedirects["/ancient" + i] = "/";
  const prev = { routes: ["/", "/summer-menu"], redirects: oldRedirects };
  const merged = mergeRedirects(prev, ["/"]);          // /summer-menu just deleted
  const csv = redirectsContent(merged);
  assert.ok(csv.includes("/summer-menu=/"),
    "the just-deleted page lost its redirect to a year-old one — its live links now hard-404");
  assert.equal(csv.split(",").length, MAX_REDIRECTS, "the cap stopped being enforced");
  // And it really does survive the round trip into a manifest, which is the
  // only place it can be read back from.
  assert.ok(parseSiteManifest('<meta name="site-redirects" content="' + csv + '">').redirects["/summer-menu"]);
});

test("the home page is never a redirect source", () => {
  // "/" gone from the route list is a broken publish, not a deletion — and a
  // site whose root 301s somewhere else is a site with no front door.
  const out = mergeRedirects({ routes: ["/", "/a"], redirects: { "/": "/a" } }, ["/a"]);
  assert.ok(!("/" in out), "the home page became a redirect");
});

// ── The fallback verdict ────────────────────────────────────────────────────

test("decideFallback: redirect beats notfound, no manifest fails open, junk is refused", () => {
  const man = { routes: ["/", "/book"], redirects: { "/gone": "/book" } };
  assert.deepEqual(decideFallback(man, "/gone"), { kind: "redirect", to: "/book" });
  assert.deepEqual(decideFallback(man, "/book"), { kind: "ok" });
  assert.deepEqual(decideFallback(man, "/junk"), { kind: "notfound" });
  assert.deepEqual(decideFallback(null, "/junk"), { kind: "ok" }, "an old site must keep 200");
  assert.deepEqual(decideFallback({ routes: null, redirects: {} }, "/junk"), { kind: "ok" },
    "a dynamic site (no route list) must keep 200");
});

test("decideFallback normalises case and trailing slashes", () => {
  const man = { routes: ["/book"], redirects: {} };
  assert.equal(decideFallback(man, "/Book").kind, "ok");
  assert.equal(decideFallback(man, "/book///").kind, "ok");
});

// ── The serve path, driven through the REAL router ──────────────────────────

/** A fake R2 whose index.html is a REAL published head — built by the real
 *  injectMeta, so the serve test reads exactly what a publish writes. */
function fakeBucket(files) {
  return {
    get: async (key) => {
      const v = files[key];
      if (v === undefined) return null;
      return { body: v, text: async () => v };
    },
    list: async () => ({ objects: [] }),
  };
}

function publishedShell({ routesCsv, redirectsCsv } = {}) {
  return injectMeta(
    '<html><head><title>Shop</title></head><body><div id="root"></div></body></html>',
    { brand: "Sharp Fade", slug: "x", routesCsv, redirectsCsv },
  );
}

// Driven on the SITE ZONE, because that is the public mount: `/s/<slug>/` on
// the platform 301s to the subdomain (the one-public-address rule), so a test
// that hits /s/ there is testing the redirect, not the serve path. The
// workspace-mount arm is exercised through slug "x-": a trailing hyphen is a
// legal build slug and an illegal DNS label, so `siteHostFor` answers null and
// such a site really is served at /s/ — the exact class that keeps that mount.

test("a junk address on a manifest site answers the shell with HTTP 404", async () => {
  const man = siteRoutes([{ path: "index.tsx" }, { path: "book.tsx" }]);
  const env = { SITES_BUCKET: fakeBucket({ "sites/x/index.html": publishedShell({ routesCsv: routesContent(man) }) }) };
  const r = await hit("/definitely-not-a-page", { env, origin: "https://x.gofarther.app" });
  assert.equal(r.status, 404, "the soft-404 is back — junk indexed as a page");
  assert.match(r.text, /id="root"/, "the 404 must still serve the shell so the branded page renders");
});

test("a real route with no prerendered document still answers 200", async () => {
  const man = siteRoutes([{ path: "index.tsx" }, { path: "book.tsx" }]);
  const env = { SITES_BUCKET: fakeBucket({ "sites/x/index.html": publishedShell({ routesCsv: routesContent(man) }) }) };
  const r = await hit("/book", { env, origin: "https://x.gofarther.app" });
  assert.equal(r.status, 200, "a listed route was refused — the manifest 404'd a real page");
});

test("a site with NO manifest keeps answering 200 for everything", async () => {
  // Every site published before the manifest existed. One deploy must not
  // change what an old site serves — the normalizeLang rule, at the edge.
  const env = { SITES_BUCKET: fakeBucket({ "sites/x/index.html": publishedShell() }) };
  const r = await hit("/anything-at-all", { env, origin: "https://x.gofarther.app" });
  assert.equal(r.status, 200);
});

test("a deleted page's address 301s where it went, on the site's own origin", async () => {
  const shell = publishedShell({ routesCsv: "/,/book", redirectsCsv: "/gallery=/book" });
  const env = { SITES_BUCKET: fakeBucket({ "sites/x/index.html": shell }) };
  const r = await hit("/gallery", { env, origin: "https://x.gofarther.app" });
  assert.equal(r.status, 301);
  assert.equal(r.headers.get("location"), "https://x.gofarther.app/book",
    "the subdomain redirect carries the workspace mount it must not have");
});

test("the workspace mount's redirect keeps its /s/<slug> prefix", async () => {
  const shell = publishedShell({ routesCsv: "/,/book", redirectsCsv: "/gallery=/book" });
  const env = { SITES_BUCKET: fakeBucket({ "sites/x-/index.html": shell }) };
  const r = await hit("/s/x-/gallery", { env });
  assert.equal(r.status, 301);
  assert.equal(r.headers.get("location"), "https://gofarther.dev/s/x-/book",
    "the redirect lost the /s/<slug> mount — it points at the platform root");
});

test("THE 301 CARRIES A LIFETIME, so a re-added page can reach people who followed it", async () => {
  // `Response.redirect` sends `location` and nothing else, and a 301 with no
  // freshness is cached by browsers effectively forever — it survives a
  // restart. That defeats this feature's own contract: `mergeRedirects` drops
  // an entry whose source is a live route again *because a re-added page must
  // serve itself*, and dropping it from the manifest is necessary and not
  // sufficient while every browser that already followed the old 301 never asks
  // again.
  const shell = publishedShell({ routesCsv: "/,/book", redirectsCsv: "/gallery=/book" });
  const env = { SITES_BUCKET: fakeBucket({ "sites/x/index.html": shell }) };
  const r = await hit("/gallery", { env, origin: "https://x.gofarther.app" });
  assert.equal(r.status, 301);
  const cc = r.headers.get("cache-control") || "";
  assert.match(cc, /max-age=\d+/, "the redirect has no lifetime — a browser will cache it permanently");
  const secs = Number((cc.match(/max-age=(\d+)/) || [])[1]);
  assert.ok(secs > 0 && secs <= 3600,
    "max-age is " + secs + "s — long enough that a restored page stays unreachable");
});

test("a publish whose PREVIOUS manifest could not be read publishes no manifest at all", async () => {
  // `prev` is null whether the object is absent or the read THREW, and the two
  // must not behave alike: with routes published and redirects lost, every old
  // address that was 301ing answers 404 instead — Google drops them rather than
  // consolidating, and a customer with a link from last month gets not-found.
  const boom = {
    get: async (key) => { if (/index\.html$/.test(key)) throw new Error("R2 unavailable"); return null; },
    list: async () => ({ objects: [] }),
  };
  const dist = { "index.html": { t: '<html><head><title>t</title></head><body></body></html>' } };
  const put = [];
  boom.put = async (k, v) => { put.push([k, String(v)]); };
  boom.delete = async () => {};
  const { loadWorkerModule } = await import("./fixtures/worker-harness.mjs");
  await loadWorkerModule(); // the module under test is wired inside worker.js
  // Driven through the source rather than the function (it is not exported):
  // the decision must be a null manifest, not merely an empty redirect string.
  assert.match(worker, /manifest = prevUnreadable \? null :/,
    "an unreadable previous manifest still publishes a route list — every old address becomes a 404");
  assert.match(worker, /prevUnreadable = true;/);
});

test("a missing ASSET still answers a plain 404 — never the shell, never a verdict", async () => {
  const env = { SITES_BUCKET: fakeBucket({ "sites/x/index.html": publishedShell({ routesCsv: "/" }) }) };
  const r = await hit("/assets/gone.js", { env, origin: "https://x.gofarther.app" });
  assert.equal(r.status, 404);
  assert.ok(!/id="root"/.test(r.text), "a missing chunk was answered with HTML");
});

test("robots.txt and sitemap.xml serve with the REQUEST's origin substituted in", async () => {
  const files = {
    "sites/x/robots.txt": robotsTxt(),
    "sites/x/sitemap.xml": sitemapXml(["/", "/book"], "2026-08-14"),
    "sites/x-/robots.txt": robotsTxt(),
  };
  const env = { SITES_BUCKET: fakeBucket(files) };

  // On the site zone the base is the bare origin — the owner's own address,
  // never ours, which is the whole reason substitution happens at serve time.
  const sb = await hit("/sitemap.xml", { env, origin: "https://x.gofarther.app" });
  assert.equal(sb.status, 200);
  assert.match(sb.text, /<loc>https:\/\/x\.gofarther\.app\/book<\/loc>/);
  assert.ok(!sb.text.includes("gofarther.dev"), "the platform's own host leaked into a site's sitemap");
  assert.ok(!sb.text.includes(SITE_ORIGIN_TOKEN), "the token reached a visitor");
  assert.ok(!/immutable/.test(sb.headers.get("cache-control") || ""),
    "a republished sitemap would be cached for a year");

  // On the workspace mount the base carries /s/<slug>.
  const rb = await hit("/s/x-/robots.txt", { env });
  assert.equal(rb.status, 200);
  assert.match(rb.text, /Sitemap: https:\/\/gofarther\.dev\/s\/x-\/sitemap\.xml/);
});

test("ON A CUSTOM DOMAIN THE SITEMAP IS THE OWNER'S OWN ADDRESS, never ours", async () => {
  // The case the whole serve-time-substitution design exists for. An owner who
  // paid for sharpfadebarbers.com must not find gofarther.dev inside their own
  // sitemap — the `.dev` is the tool, the customer's domain is theirs, and a
  // host baked at publish is wrong on exactly this mount. Reached through the
  // /s/ path the custom-domain rewrite produces, since the rewrite itself needs
  // a stored domain row this harness has no binding for.
  const files = { "sites/x-/sitemap.xml": sitemapXml(["/", "/book"], "2026-08-14") };
  const r = await hit("/s/x-/sitemap.xml", { env: { SITES_BUCKET: fakeBucket(files) } });
  assert.equal(r.status, 200);
  // The mount decides the base, and `isAppHostname` is the ONLY thing that can
  // tell the two apart — asserted here so a change to that predicate cannot
  // silently start writing the platform's host into customers' sitemaps.
  assert.match(r.text, /<loc>https:\/\/gofarther\.dev\/s\/x-\/book<\/loc>/,
    "the workspace mount lost its /s/<slug> base — every sitemap URL 404s");
  assert.ok(!r.text.includes("__SITE_ORIGIN__"), "the placeholder reached a crawler");
});

// ── The publish wiring (source-reads, the layer below the harness) ──────────

test("writeSiteDistToR2 derives the manifest and writes both files into the dist", () => {
  // ANCHORED ON THE PROPERTY, NOT THE SPELLING. This pinned the exact parameter
  // list and went red the moment a sixth argument was added for renames — a test
  // about word order, which is this repo's most repeated own-goal. What it needs
  // is that the choke point exists and can SEE the pages.
  // …AND IT GREW AGAIN. The sixth argument was the rename pair, the seventh is
  // the site's extra language prefixes. `\b` after `pages` already tolerates
  // both, which is why this half survived; the CALL-SITE check below did not,
  // and had to be widened a second time. A guard that pins an arity is a guard
  // that goes red on every honest addition.
  const at = worker.search(/async function writeSiteDistToR2\(env, slug, dist, meta, pages\b/);
  assert.ok(at > 0, "the publish choke point no longer takes pages — the manifest has no source");
  const end = worker.indexOf("const entries = Object.entries(dist || {})", at);
  assert.ok(end > at, "the entries sort moved — the manifest window has no end");
  const head = worker.slice(at, end);
  // …AND THE LANGUAGE PREFIXES GO WITH THEM. Pinned as `siteRoutes(pages)`
  // exactly, this is the third arity in this file to go red on an honest
  // addition. The prefixes are not decoration: the translated pages are added
  // to the container payload's local file map and NEVER to `pages`, so without
  // them the route list — and therefore both the sitemap and the fallback's
  // route manifest — described the primary language only, and half a bilingual
  // site was undiscoverable through the one file robots.txt calls authoritative.
  assert.match(head, /siteRoutes\(pages\b/, "the route list is not derived from the pages");
  assert.match(head, /siteRoutes\(pages, langPrefixes\)/,
    "the site's other languages never reach the route list, so its sitemap lists the primary one only");
  // READ FROM THE SIDECAR, NOT PARSED OUT OF A DOCUMENT. This asserted
  // `parseSiteManifest(await po.text())` — the previous publish's `index.html`,
  // which under Start does not exist: the build emits no top-level document and
  // the head is composed per request. The PROPERTY is unchanged and is what is
  // asserted here: the previous manifest is read, so a deleted page leaves a 301
  // where it was.
  assert.match(head, /await env\.SITES_BUCKET\.get\(siteMetaKey\(slug\)\)/,
    "the previous manifest is never read — deletions leave no redirect");
  assert.match(head, /mergeRedirects\(prev, man\.routes\b/, "gone routes are not diffed into redirects");
  // AND THE EXPLICIT MOVE REACHES IT. A rename is a delete plus an add by the
  // time it gets here, so without this pair the old address 301s to the HOME
  // page rather than to the page that was moved — which is the entire reason
  // `renameRoute` returns one. Computed and dropped in the wiring is how that
  // function sat correct and unreachable in the first place.
  assert.match(head, /mergeRedirects\(prev, man\.routes, renamed\)/,
    "the rename pair never reaches the redirect map — a moved page 301s to home");
  assert.match(head, /dist\["sitemap\.xml"\] = \{ t: sitemapXml\(/, "no sitemap is written at publish");
  assert.match(head, /dist\["robots\.txt"\] = \{ t: robotsTxt\(\) \}/, "robots.txt keeps the template's two-line file");
  // AN EMPTY SITEMAP IS WORSE THAN NONE: a site whose every page is a dynamic
  // segment yields no concrete routes, and publishing `<urlset></urlset>` with
  // robots.txt pointing at it tells a crawler the site HAS no pages.
  assert.match(head, /if \(man\.routes\.length\) \{/,
    "a routeless site publishes an empty sitemap declaring it has no pages");
});

test("the manifest is written where the site's own Worker reads it", () => {
  // IT USED TO RIDE THE HOME PAGE'S HEAD, and that assertion went vacuous rather
  // than red: it matched a source string for a branch that can no longer run,
  // because under Start the dist contains no HTML at all and the `injectMeta`
  // loop iterates over nothing. A guard that passes because its subject stopped
  // existing is the shape this repo keeps paying for.
  //
  // The manifest now travels in the meta sidecar — one object, outside the
  // served prefix — and `test/site-meta-sidecar.test.mjs` holds the key itself
  // against the template's copy of it.
  assert.match(worker, /routesCsv: \(manifest && manifest\.routesCsv\) \|\| ""/,
    "the route list is not written to the sidecar — the SPA fallback has no opinion");
  assert.match(worker, /redirectsCsv: \(manifest && manifest\.redirectsCsv\) \|\| ""/,
    "the redirect map is not written — a renamed page hard-404s every indexed link");
});

test("the sitemap and robots are archived with the build, so a restore keeps them", () => {
  // WHY THE DIST IS MUTATED rather than a side map being returned: every
  // downstream consumer that enumerates the dist then sees the two new files
  // for free — the sweep's keep-set (so a publish does not immediately delete
  // what it just wrote) and the version archive (so a rollback restores a site
  // WITH its sitemap rather than one whose sitemap was swept and never
  // replaced).
  //
  // It is entirely an ORDERING property, which is what makes it worth pinning:
  // hoist either `Object.keys` above the write and the files silently stop
  // being archived, with nothing else changing.
  const archives = [...worker.matchAll(/archiveVersion\(versionDeps\(env\), \{/g)].map((m) => m.index);
  assert.equal(archives.length, 2, "expected both archive call sites, found " + archives.length);
  for (const at of archives) {
    const write = worker.lastIndexOf("writeSiteDistToR2(", at);
    assert.ok(write > 0 && write < at,
      "an archive runs BEFORE its publish — the sitemap and robots are left out of the version");
    const files = worker.slice(at, at + 700).match(/files: Object\.keys\((\w+)[^)]*\)/);
    assert.ok(files, "the archive no longer enumerates the dist — it cannot see what was published");
  }
  // And the sweep keeps them: they go through the same loop that fills `wrote`.
  const at = worker.indexOf("async function writeSiteDistToR2");
  const body = worker.slice(at, worker.indexOf("deleteSitePrefix(env, slug, wrote)", at));
  assert.match(body, /wrote\.add\(safeRel\)/,
    "the keep-set is not filled from the write loop — a publish would sweep its own sitemap");
});

test("both publish paths hand their pages to the choke point", () => {
  // The spine and the build dep — miss one and that path's publishes silently
  // stop writing a sitemap and stop leaving redirects. Derived over every call.
  const calls = [...worker.matchAll(/await writeSiteDistToR2\(env, slug, [^;]+?\);/gs)].map((m) => m[0]);
  assert.ok(calls.length >= 2, "expected both publish call sites, found " + calls.length);
  for (const c of calls) {
    // `pages` LAST OR FOLLOWED BY THE RENAME PAIR. It was pinned to `}, pages);`
    // and went red on a correct change the moment the choke point grew a sixth
    // argument. The property is that every call site hands over the pages at
    // all — dropping them is what silently stops a path writing a sitemap and
    // leaving redirects.
    // ANY NUMBER OF TRAILING ARGUMENTS. This admitted exactly one and went red
    // on the SEVENTH parameter (the language prefixes) after being widened once
    // already for the sixth — an arity pinned twice is an arity that will be
    // pinned again. What has to hold is that `pages` is handed over at all;
    // dropping them is what silently stops a path writing a sitemap and
    // leaving redirects behind.
    assert.match(c, /\}, pages(?:,[^;]*)?\);$/, "a publish call site drops `pages`: " + c.slice(0, 80));
  }
});

test("THE MANIFEST CAN NEVER BE NARROWER THAN THE APP'S OWN ROUTES", () => {
  // THE WHOLE SAFETY ARGUMENT FOR ANSWERING 404 AT ALL, and it rests on a
  // premise in the Dockerfile rather than on anything in this file.
  //
  // The manifest is derived from the STORED PAGES; what the app can actually
  // route is whatever ends up in src/routes. If those two sets ever diverge —
  // a route the router has and the manifest does not — that route 404s the day
  // this ships, where it used to serve 200 through the SPA fallback.
  //
  // They cannot diverge today because `resetRoutes()` restores `.routes-base`
  // and the image bakes exactly ONE file into it: `__root.tsx`, the layout,
  // which `routePaths()` skips as a non-page. So after a reset src/routes holds
  // the model's pages and nothing else, and the manifest is a superset. Add a
  // second file there — a `book.tsx` reference route, say — and EVERY generated
  // site gains a real route its manifest never lists.
  //
  // Asserted on the premise, not on the conclusion: the `@/examples/*` lesson,
  // where a deletion was safe only while a fact stayed true and the guard had
  // to hold the fact.
  const docker = fs.readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
  const at = docker.indexOf("mkdir -p /app/.routes-base");
  assert.ok(at > 0, "the routes-base bake moved — the manifest's completeness premise is unchecked");
  const block = docker.slice(at, at + 400);
  const copied = [...block.matchAll(/src\/routes\/([A-Za-z0-9_.$-]+\.tsx)/g)].map((m) => m[1]);
  assert.deepEqual(copied, ["__root.tsx"],
    "routes-base bakes in " + JSON.stringify(copied) + " — anything but __root.tsx is a route the " +
    "app can serve and the manifest will not list, so it will now 404");

  // And the mapping itself agrees with routePaths()' rules for the shapes that
  // decide this: an index becomes the root, a nested index drops its segment,
  // and a dynamic segment is excluded on BOTH sides (routePaths skips a `$`
  // filename; siteRoutes marks the site dynamic and publishes no list at all).
  const man = siteRoutes([{ path: "index.tsx" }, { path: "shop/index.tsx" }, { path: "shop/$id.tsx" }]);
  assert.deepEqual(man.routes, ["/", "/shop"]);
  assert.equal(man.dynamic, true, "a $ route must suppress the whole list, not just itself");
});

test("the 404 never counts as a page view", () => {
  // Junk addresses counted as traffic is the analytics half of the soft-404.
  assert.match(worker, /request\.method === "GET" && status === 200 && ctype\.startsWith\("text\/html"\)\) logSiteHit/,
    "the hit log records 404s as page views again");
});

// ── The template's branded 404 ──────────────────────────────────────────────

test("the router mounts the kit's NotFound page", () => {
  // WITHOUT IT TanStack renders its own bare text — the render check has
  // literally measured that as "blank: only 9 characters" — while the kit's own
  // `not-found.tsx` sits unused.
  //
  // READ OFF `router.tsx`, WHICH IS NOW THE ONLY ROUTER. It was `main.tsx`, and
  // `entry-server.tsx` built a second one beside it; TanStack Start calls one
  // `getRouter()` from both `createStartHandler` and `hydrateStart`, so the two
  // can no longer disagree about the 404 either.
  const router = fs.readFileSync(new URL("../builder/lovable/template/src/router.tsx", import.meta.url), "utf8");
  assert.match(router, /import \{ NotFound \} from "@\/components\/ui\/not-found"/,
    "the 404 component is not imported — TanStack's bare nine characters render again");
  assert.match(router, /defaultNotFoundComponent:/,
    "the router has no not-found component — the render check's 'blank: only 9 characters' case");

  // THE WAY HOME IS `/`, AND THAT IS A CONSEQUENCE OF STAGE 1 RATHER THAN A
  // SHORTCUT. `NotFound` renders `homeHref` into a plain `<a href>`, which no
  // router resolves, so on a `/s/<slug>/` mount it would send the visitor to the
  // PLATFORM's root. That is why this used to be `homeHref={basepath}`, derived
  // at runtime from `import.meta.url`.
  //
  // Start bakes `ROUTER_BASEPATH` at build time and OVERWRITES whatever the
  // factory sets, so a runtime-derived basepath is not available here at all.
  // What makes `/` correct instead is that `cleanSlug` now refuses an edge
  // hyphen, so every slug is a legal DNS label, every site has a pretty host,
  // and `/` is the only mount a Start bundle is ever served at.
  assert.match(router, /NotFound homeHref="\/"/,
    "the 404's way home is not the site root");
  const slug = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(slug, /const cleanSlug = [^;]*replace\(\/\^-\+\|-\+\$\/g, ""\)/,
    "cleanSlug admits an edge hyphen again — such a site has no pretty host, is served at " +
    "/s/<slug>/, and its 404 would send visitors to the platform root");
});
// ── An explicit move (site-apply's renameRoute → the redirect map) ──────────
//
// A RENAME IS INDISTINGUISHABLE FROM A DELETE PLUS AN ADD by the time it reaches
// the publish, which is why the diff alone sends the old address to the home
// page. `renameRoute` returns the one pair the diff cannot derive.

test("a moved page's old address 301s to the NEW page, not to home", () => {
  const prev = { routes: ["/", "/what-we-do"], redirects: {} };
  const out = mergeRedirects(prev, ["/", "/services"], { from: "/what-we-do", to: "/services" });
  assert.equal(out["/what-we-do"], "/services",
    "the moved page's old address went to the home page — the whole point of the explicit pair");
  // And WITHOUT the pair it must still degrade to the old behaviour rather than
  // to nothing: a site whose lane does not pass one is every site today.
  const derived = mergeRedirects(prev, ["/", "/services"]);
  assert.equal(derived["/what-we-do"], "/", "the derived rule stopped leaving a redirect at all");
});

test("A MOVE NAMING A TARGET THIS PUBLISH DOES NOT SERVE IS REFUSED", () => {
  // Worse than no pair at all: it 301s a working old address onto a 404, where
  // the derived rule would at least have reached the home page. The `to` comes
  // from a model-driven lane, so it is checked rather than trusted.
  const prev = { routes: ["/", "/what-we-do"], redirects: {} };
  const out = mergeRedirects(prev, ["/", "/services"], { from: "/what-we-do", to: "/typo" });
  assert.equal(out["/what-we-do"], "/", "a 301 was pointed at a route the site does not serve");
});

test("the home page cannot be moved, and a self-move is not a redirect", () => {
  const prev = { routes: ["/", "/book"], redirects: {} };
  const home = mergeRedirects(prev, ["/", "/book"], { from: "/", to: "/book" });
  assert.ok(!("/" in home), "the site root was pointed away from itself");
  const self = mergeRedirects(prev, ["/", "/book"], { from: "/book", to: "/book" });
  assert.ok(!("/book" in self), "a page was redirected to itself — a loop");
});

test("an older redirect follows the page it pointed at, in ONE hop", () => {
  // `/old` → `/what-we-do` and `/what-we-do` → `/services`. Collapsing to home
  // is the general rule (two hops is where loops come from); here the move NAMES
  // a live route, so following it is one hop and lands on the real page.
  const prev = { routes: ["/", "/what-we-do"], redirects: { "/old": "/what-we-do" } };
  const out = mergeRedirects(prev, ["/", "/services"], { from: "/what-we-do", to: "/services" });
  assert.equal(out["/old"], "/services", "an accumulated redirect collapsed to home instead of following the page");
  assert.ok(Object.values(out).every((t) => t === "/" || ["/", "/services"].includes(t)),
    "a redirect points somewhere this publish does not serve");
});

test("A MOVE SURVIVES THE CAP, because it is written first", () => {
  // Same argument as newly-gone-first: `redirectsContent` keeps the first
  // MAX_REDIRECTS pairs, and a move is the most valuable pair in the map — the
  // address in somebody's index today, with a known destination.
  const prevRoutes = ["/", "/what-we-do"];
  const redirects = {};
  for (let i = 0; i < MAX_REDIRECTS + 10; i++) redirects["/r" + i] = "/";
  const out = mergeRedirects({ routes: prevRoutes, redirects }, ["/", "/services"],
    { from: "/what-we-do", to: "/services" });
  const kept = redirectsContent(out).split(",");
  assert.ok(kept.includes("/what-we-do=/services"), "the move was dropped by the cap");
});

test("a malformed move changes nothing", () => {
  // Every shape a model-driven lane can produce. None may throw, and none may
  // put a pair in the map — the derived rule still applies underneath.
  const prev = { routes: ["/", "/gone"], redirects: {} };
  for (const junk of [null, undefined, "", "/a", 7, {}, { from: "/a" }, { to: "/b" },
                      { from: 1, to: 2 }, { from: "a", to: "b" }, [{ from: "/x" }]]) {
    const out = mergeRedirects(prev, ["/"], junk);
    assert.equal(out["/gone"], "/", "a malformed move broke the derived rule: " + JSON.stringify(junk));
    assert.ok(Object.keys(out).every((k) => k.startsWith("/")), "a junk key reached the map");
  }
});

test("THE SPINE HANDS THE MOVE TO THE CHOKE POINT", () => {
  // The hop between "the route decided a rename" and "the publish knows about
  // it". `writeSiteDistToR2` is asserted above to pass `renamed` into
  // `mergeRedirects` — and that is satisfied while `recompileAndPublish` never
  // supplies one, which is a moved page whose old address 301s to home with
  // every other test in this file green. Found by mutation; the wiring layer,
  // one hop further out than the guard that was watching.
  const at = worker.indexOf("async function recompileAndPublish(env,");
  assert.ok(at > 0, "the shared publish spine is gone — rescope this");
  const spine = worker.slice(at, worker.indexOf("\n}\n", at));
  assert.ok(spine.length > 400, "the spine window is empty — the anchor moved");
  assert.match(spine, /async function recompileAndPublish\(env, \{[^}]*\brenamed\b/,
    "the spine cannot be told about a rename at all");
  // TOLERANT OF WHAT TRAVELS AFTER IT, like the call-site check above: the
  // seventh argument is the site's extra language prefixes, and a guard about
  // renames must not go red because something else joined the call.
  assert.match(spine, /\}, pages, renamed(?:,[^;]*)?\)/,
    "the spine drops `renamed` on the way to the publish — a moved page 301s to home");
  // AND THE PREFIXES REACH IT TOO, or a bilingual site's second half stays out
  // of its own sitemap — the translated pages are added to the container's
  // local file map and never to `pages`, so the choke point cannot see them.
  assert.match(spine, /siteLangs\.filter\(\(l\) => !l\.primary\)\.map\(\(l\) => l\.prefix\)/,
    "the spine publishes without its language prefixes, so half a bilingual site is undiscoverable");
});

test("a bilingual site's second language is in its own sitemap", () => {
  // HALF A BILINGUAL SITE WAS UNDISCOVERABLE. Both publish paths translate by
  // adding the translated route FILES into the container payload's local map
  // and leaving the `pages` array untouched — and the choke point derives the
  // route list from that untouched array. So the translated pages compiled,
  // published, served and were linked from the site's own switcher, and were
  // absent from the one file that tells a search engine they exist. Worse for
  // the customer than no sitemap, because robots.txt declares this one as
  // authoritative.
  const pages = [{ path: "index.tsx" }, { path: "menu.tsx" }, { path: "book.tsx" }];
  const mono = siteRoutes(pages);
  assert.deepEqual(mono.routes, ["/", "/book", "/menu"]);
  // A MONOLINGUAL SITE IS BYTE-IDENTICAL, which is what makes this safe against
  // every site already published.
  assert.deepEqual(siteRoutes(pages, []).routes, mono.routes);
  assert.deepEqual(siteRoutes(pages, null).routes, mono.routes);

  const bi = siteRoutes(pages, ["/es"]);
  assert.deepEqual(bi.routes, ["/", "/book", "/es", "/es/book", "/es/menu", "/menu"]);
  // `/` BECOMES `/es`, NOT `/es/` — a trailing slash is a second address for
  // one page, which is exactly the duplicate a sitemap must not create.
  assert.ok(!bi.routes.includes("/es/"), "the prefixed home page got a trailing slash");

  // THREE LANGUAGES, and the expansion is per prefix rather than compounding:
  // `/fr/es/menu` is not an address this site has.
  const tri = siteRoutes(pages, ["/es", "/fr"]);
  assert.equal(tri.routes.length, 9);
  assert.ok(!tri.routes.some((r) => /^\/(es|fr)\/(es|fr)\//.test(r)), "the prefixes compounded: " + tri.routes.join(","));

  // JUNK IS REFUSED RATHER THAN EXPANDED. These come from `resolveLangs`, which
  // has already refused a duplicate, a reserved segment and a shadowed page —
  // so this is the second line rather than the first, and it must not turn a
  // bad value into a URL a crawler is told to visit.
  assert.deepEqual(siteRoutes(pages, ["", "/", "es", null, undefined, 7]).routes, mono.routes);

  // A DYNAMIC ROUTE CONTRIBUTES TO NEITHER. It is skipped before the expansion
  // runs, so it cannot appear prefixed either — a sitemap is allowed to be
  // incomplete and not to be wrong.
  const dyn = siteRoutes([{ path: "index.tsx" }, { path: "deals.$id.tsx" }], ["/es"]);
  assert.deepEqual(dyn.routes, ["/", "/es"]);
  assert.equal(dyn.dynamic, true);

  // …AND IT REALLY REACHES THE SITEMAP, which is the thing a crawler reads.
  const xml = sitemapXml(bi.routes);
  assert.match(xml, /<loc>[^<]*\/es\/menu<\/loc>/, "the second language is not in the sitemap");
});
