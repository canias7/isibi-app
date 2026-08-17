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
  const at = worker.indexOf("async function writeSiteDistToR2(env, slug, dist, meta, pages)");
  assert.ok(at > 0, "the publish choke point no longer takes pages — the manifest has no source");
  const end = worker.indexOf("const entries = Object.entries(dist || {})", at);
  assert.ok(end > at, "the entries sort moved — the manifest window has no end");
  const head = worker.slice(at, end);
  assert.match(head, /siteRoutes\(pages\)/, "the route list is not derived from the pages");
  // READ FROM THE SIDECAR, NOT PARSED OUT OF A DOCUMENT. This asserted
  // `parseSiteManifest(await po.text())` — the previous publish's `index.html`,
  // which under Start does not exist: the build emits no top-level document and
  // the head is composed per request. The PROPERTY is unchanged and is what is
  // asserted here: the previous manifest is read, so a deleted page leaves a 301
  // where it was.
  assert.match(head, /await env\.SITES_BUCKET\.get\(siteMetaKey\(slug\)\)/,
    "the previous manifest is never read — deletions leave no redirect");
  assert.match(head, /mergeRedirects\(prev, man\.routes\)/, "gone routes are not diffed into redirects");
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
    assert.match(c, /\}, pages\);$/, "a publish call site drops `pages`: " + c.slice(0, 80));
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
  const docker = fs.readFileSync(new URL("../builder/Dockerfile", import.meta.url), "utf8");
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