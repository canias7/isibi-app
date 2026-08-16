// A published site served by a Worker, rendered per request.
//
// WHY THESE RUN WITH NO INFRASTRUCTURE. The runtime is a `fetch` handler and
// the packaging is a pure function, so both are drivable with a fake R2 and a
// stub `render` — which is the point of splitting them this way. The one thing
// no unit test can prove is that the SSR bundle really renders inside the
// Workers runtime; that needs a real upload and is a separate, live check.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { siteConfigModule, canServeAsWorker, scriptNameFor } from "../builder/site-worker.mjs";

const SHELL = '<!doctype html><html><head><title>t</title></head><body><div id="root"></div><script src="/a.js"></script></body></html>';

/* ------------------------------------------------------- the config module */

test("the shell survives being put in a JavaScript string", () => {
  // A whole HTML document goes into a string literal, and a real one carries
  // backticks, `${`, both quote kinds and newlines. Hand-quoting that is how a
  // build starts emitting a script that does not parse — so the assertion is
  // that it round-trips, driven through a real evaluation rather than matched.
  const nasty = '<div id="root"></div><script>const a = `x${1}` + "y" + \'z\';\n</script>';
  const src = siteConfigModule({ shell: nasty, slug: "s", routes: ["/"] });
  const got = JSON.parse(src.match(/export const SHELL = (.*);/)[1]);
  assert.equal(got, nasty);
});

test("an absent route list and an empty one are the same thing", () => {
  // Both mean "no opinion" to the runtime, which then renders everything —
  // the state every site published before the manifest existed is in. A third
  // answer here is one the runtime would have to interpret.
  const a = siteConfigModule({ shell: SHELL, slug: "s" });
  const b = siteConfigModule({ shell: SHELL, slug: "s", routes: [] });
  const c = siteConfigModule({ shell: SHELL, slug: "s", routes: null });
  assert.equal(a, b);
  assert.equal(b, c);
  assert.match(a, /export const ROUTES = \[\];/);
});

test("a non-string in the route list is dropped, not stringified", () => {
  // `String(["/a"])` is "/a" and `String(null)` is "null" — a coerced entry is
  // a route nobody declared, and `isKnownRoute` would then 404 a real page or
  // 200 a fake one depending on which way the coercion fell.
  const src = siteConfigModule({ shell: SHELL, slug: "s", routes: ["/", null, 7, ["/x"], "/book"] });
  assert.deepEqual(JSON.parse(src.match(/export const ROUTES = (.*);/)[1]), ["/", "/book"]);
});

/* --------------------------------------------------------- the refusal */

test("a build with nothing to serve or nothing to render is refused", () => {
  // REFUSED RATHER THAN UPLOADED BROKEN: the caller keeps publishing static
  // files when this says no, so the customer's site is what it would have been.
  assert.equal(canServeAsWorker({ shell: "", ssr: "x" }).ok, false);
  assert.equal(canServeAsWorker({ shell: SHELL, ssr: "" }).ok, false);
  assert.equal(canServeAsWorker({ shell: "<html><body></body></html>", ssr: "x" }).ok, false);
  assert.equal(canServeAsWorker({ shell: SHELL, ssr: "x" }).ok, true);
});

test("every refusal says which of the three it was", () => {
  // One sentence for three causes is the shape this repo keeps paying for —
  // an operator asking why a site fell back to static gets the reason here or
  // reproduces the build by hand.
  const seen = new Set([
    canServeAsWorker({ shell: "", ssr: "x" }).why,
    canServeAsWorker({ shell: SHELL, ssr: "" }).why,
    canServeAsWorker({ shell: "<html><body></body></html>", ssr: "x" }).why,
  ]);
  assert.equal(seen.size, 3, [...seen].join(" | "));
  for (const w of seen) assert.ok(w.length > 10, w);
});

/* ------------------------------------------------------------ the name */

test("the script name is derived from the slug and prefixed", () => {
  assert.equal(scriptNameFor("forno"), "site-forno");
  assert.equal(scriptNameFor("sharp-fade"), "site-sharp-fade");
  // A slug that cleans to nothing gets NO name rather than the bare prefix,
  // which would be one script every such site uploaded over.
  assert.equal(scriptNameFor(""), "");
  assert.equal(scriptNameFor("!!!"), "");
  assert.equal(scriptNameFor(null), "");
});

test("the name cannot be steered outside the slug's own alphabet", () => {
  // The name addresses an upload. A slug is already filtered to [a-z0-9-] on
  // the way in, so this changes nothing today — it is here because the value
  // decides which script gets overwritten, and a guarantee held only by a
  // filter in another file is one edit from being held by nothing.
  assert.equal(scriptNameFor("../other"), "site-other");
  assert.equal(scriptNameFor("A B/C"), "site-abc");
});

/* ----------------------------------------------------------- the runtime */

// The entry imports `./entry-server.js` and `./site-config.js`, neither of
// which exists outside a packaged site — so the module is loaded with both
// stubbed. Driving the REAL handler rather than a copy of its logic is the
// whole point: the decisions being asserted are the ones a visitor hits.
async function loadEntry({ shell = SHELL, slug = "s", routes = [], render } = {}) {
  const src = fs.readFileSync(new URL("../builder/site-worker/entry.js", import.meta.url), "utf8");
  const cfg = "data:text/javascript," + encodeURIComponent(siteConfigModule({ shell, slug, routes }));
  const ssr = "data:text/javascript," + encodeURIComponent(
    "export const render = " + String(render || (async () => "<h1>page</h1>")) + ";");
  const patched = src
    .replace('from "./entry-server"', 'from "' + ssr + '"')
    .replace('from "./site-config.js"', 'from "' + cfg + '"');
  return import("data:text/javascript," + encodeURIComponent(patched));
}

const req = (path) => new Request("https://x.gofarther.app" + path);

test("a page is rendered into the shell", async () => {
  const mod = await loadEntry({ routes: ["/"] });
  const res = await mod.default.fetch(req("/"), {});
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.match(html, /<div id="root"><h1>page<\/h1><\/div>/);
  // AND THE REST OF THE SHELL SURVIVES. Injecting into the wrong place is a
  // page that renders and never loads its bundle.
  assert.match(html, /<script src="\/a\.js">/);
  assert.match(html, /<title>t<\/title>/);
});

test("A RENDER FAILURE IS NEVER AN OUTAGE — it falls back to the shell", async () => {
  // The rule the prerender had at build time, moved to request time, where it
  // matters far more: a failed prerender cost a snapshot, a failed render is a
  // visitor looking at the site. The fallback is exactly what every site
  // served before this existed — the empty div plus the bundle.
  const mod = await loadEntry({ routes: ["/"], render: async () => { throw new Error("boom"); } });
  const res = await mod.default.fetch(req("/"), {});
  const html = await res.text();
  assert.equal(res.status, 200, "a render failure must not become a 5xx");
  assert.match(html, /<div id="root"><\/div>/);
  assert.match(html, /<script src="\/a\.js">/, "the bundle must still be there — the page still works");
});

test("a shell with no root element is served untouched rather than guessed at", async () => {
  const mod = await loadEntry({ shell: "<html><body>bare</body></html>", routes: ["/"] });
  const res = await mod.default.fetch(req("/"), {});
  assert.equal(await res.text(), "<html><body>bare</body></html>");
  assert.equal(res.status, 200);
});

test("an unknown path is a 404 STATUS with the page still in it", async () => {
  // The router draws its own not-found either way, so the body is unchanged.
  // What changes is that a crawler is told the address is not real — serving
  // 200 for every typo is the soft-404 that made deleted pages look alive.
  const mod = await loadEntry({ routes: ["/", "/book"] });
  assert.equal((await mod.default.fetch(req("/book"), {})).status, 200);
  const res = await mod.default.fetch(req("/nope"), {});
  assert.equal(res.status, 404);
  assert.match(await res.text(), /<h1>page<\/h1>/, "still a rendered page, just an honest status");
});

test("a site with no route list 404s nothing", async () => {
  // The safe direction. Being wrong here means a REAL page 404s, which is
  // worse than a 200 on a missing one — and every site published before the
  // manifest existed has no list.
  const mod = await loadEntry({ routes: [] });
  assert.equal((await mod.default.fetch(req("/anything"), {})).status, 200);
});

test("a trailing slash is the same route", async () => {
  const mod = await loadEntry({ routes: ["/book"] });
  assert.equal((await mod.default.fetch(req("/book/"), {})).status, 200);
});

test("an asset comes from R2 and is never rendered", async () => {
  // THE COST DECISION. Putting a bundle or a stylesheet through compute is
  // paying per request for what a CDN does free, on the files requested most.
  let asked = "";
  const mod = await loadEntry({ slug: "forno", routes: ["/"] });
  const env = { SITES: { get: async (k) => { asked = k; return { body: "BUNDLE", writeHttpMetadata: (h) => h.set("content-type", "application/javascript") }; } } };
  const res = await mod.default.fetch(req("/assets/main-abc123.js"), env);
  assert.equal(asked, "sites/forno/assets/main-abc123.js");
  assert.equal(await res.text(), "BUNDLE");
  assert.match(res.headers.get("cache-control") || "", /immutable/);
});

test("a missing asset is a 404, not the app shell", async () => {
  // The fallback is extensionless-only. Serving the document for a missing
  // script is how a 404 becomes a page that loads and then does nothing.
  const mod = await loadEntry({ routes: ["/"] });
  const res = await mod.default.fetch(req("/assets/gone.js"), { SITES: { get: async () => null } });
  assert.equal(res.status, 404);
  assert.doesNotMatch(await res.text(), /<div id="root">/);
});

test("the DOCUMENT is not cached like an asset", async () => {
  // It is produced per request precisely so it changes when the owner edits
  // their site. Caching it the way the immutable bundles are cached would undo
  // the entire reason for moving rendering here.
  const mod = await loadEntry({ routes: ["/"] });
  const res = await mod.default.fetch(req("/"), {});
  const cc = res.headers.get("cache-control") || "";
  assert.doesNotMatch(cc, /immutable/);
  assert.match(cc, /max-age=0|no-cache|must-revalidate/);
});

test("the asset rule matches the platform's own SPA fallback", async () => {
  // The two must agree. A path classified as a page here and an asset there is
  // a page that renders on one mount and 404s on the other — which is exactly
  // the class of bug the /u/ prefix caused when two readers disagreed.
  const mod = await loadEntry();
  for (const p of ["/", "/book", "/about/team", "/services/50-off"]) {
    assert.equal(mod.isAsset(p), false, p + " is a page");
  }
  for (const p of ["/a.js", "/assets/x.css", "/favicon.ico", "/sitemap.xml"]) {
    assert.equal(mod.isAsset(p), true, p + " is an asset");
  }
});
