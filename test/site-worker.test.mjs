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
import { siteConfigModule, canServeAsWorker, shellIsUsable, scriptNameFor } from "../builder/site-worker.mjs";

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

test("A NON-STRING SHELL IS REFUSED, NOT COERCED — the bug that shipped", () => {
  // MEASURED, not hypothetical. The call site passed `dist["index.html"]`, and
  // `collectDist` returns every text file as `{t: "…"}` — so `String(shell)`
  // produced the literal fifteen characters `[object Object]`. A valid string,
  // so the config module generated, vite bundled it, the size check passed, and
  // EVERY PAGE OF THE SITE served those fifteen characters as its whole
  // document. Found by executing a real bundle; nothing that reads the file
  // could see it.
  assert.throws(() => siteConfigModule({ shell: { t: SHELL }, slug: "s" }), /`shell` must be a string/);
  assert.throws(() => siteConfigModule({ shell: SHELL, slug: ["s"] }), /`slug` must be a string/);
  // …and the shape the bug wore is never a usable shell, checked through the
  // predicate the packager actually gates on.
  assert.equal(shellIsUsable({ t: SHELL }).ok, false);
  assert.equal(shellIsUsable(String({ t: SHELL })).ok, false, "'[object Object]' must never read as a document");
});

test("absent stays absent — undefined and null are still the empty shell", () => {
  // The refusal is about a WRONG SHAPE, not about a missing value: a caller with
  // nothing to give must keep behaving as it did, or a build with no index.html
  // starts throwing out of a step whose whole contract is to be best-effort.
  assert.match(siteConfigModule({ shell: undefined, slug: null }), /export const SHELL = "";/);
  assert.match(siteConfigModule({}), /export const SLUG = "";/);
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

/* ------------------------------------------------- the packaging contract */
//
// These read the SOURCE, because `build-server.mjs` starts a server on import
// and the vite config is data rather than behaviour — and because the only
// thing that currently proves any of it is a ~20-minute integration run
// against a real container. A property whose sole guard takes twenty minutes
// is one that regresses between runs.

test("THE WORKER BUILD ASKS FOR THE `workerd` CONDITION", () => {
  // WITHOUT IT EVERY SITE RENDERS NOTHING, silently. `ssr.target: "webworker"`
  // alone puts `browser` in the condition set, `@tanstack/router-core` then
  // resolves `./isServer` to its CLIENT variant, `RouterCore.update` believes
  // it is in a browser, and `createRouter` throws `window is not defined`. The
  // entry catches a render failure and serves the bare shell, so the site
  // answers 200 with an empty root div and none of its own words — a working
  // status code over exactly the blank page this whole tier exists to end.
  //
  // Both libraries that decide it ship the answer under this one name:
  // router-core maps `workerd` to its server build, react-dom maps it to
  // `server.edge.js`. Neither pure choice works alone — webworker conditions
  // break the router, node conditions pull `node:stream` into react-dom.
  const cfg = fs.readFileSync(new URL("../builder/site-worker/vite.worker.config.mjs", import.meta.url), "utf8");
  const m = cfg.match(/conditions:\s*\[([^\]]*)\]/);
  assert.ok(m, "the worker build no longer names its resolve conditions at all");
  const list = m[1].split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
  assert.ok(list.includes("workerd"),
    "`workerd` is gone from the condition set — every generated site would render nothing: " + list.join(" "));
  // `react-server` selects react-dom's RSC build, which is not what this
  // renders, and it is the FIRST key in that package's map — so its presence
  // would win over `workerd` and change what gets bundled.
  assert.ok(!list.includes("react-server"),
    "`react-server` outranks `workerd` in react-dom's export map and selects the RSC build");
});

test("THE SHELL IS GONE, and so is what it could get wrong", () => {
  // These two guards protected the `[object Object]` failure: the caller passed
  // `dist["index.html"]`, which `collectDist` returns as `{t: "…"}`, `String()`
  // turned it into fifteen literal characters, and every page of the site served
  // those as its whole document — past a typecheck, a bundle, a size check, and
  // an assertion that matched the entry file's own copy of the string it was
  // looking for. It was found by EXECUTING a bundle.
  //
  // Under Start there is no shell to hand over at all: the document is rendered
  // per request from `__root.tsx`, and the site's Worker IS Start's server
  // build. So the guard is replaced by its PREMISE rather than deleted — the
  // `@/examples/*` lint precedent, where a rule whose justification evaporated
  // with the feature was removed and the absence asserted instead, because
  // restoring the feature without the rule brings the silent failure straight
  // back.
  const src = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");
  // Comments blanked first: the note explaining that the splicing is gone NAMES
  // it, so a bare scan finds the word it was written to forbid and fails against
  // a correct file. Recorded three times in this repo already.
  const code = src.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!/packageWorker\s*\(/.test(code), "the shell packager is back without its shell guard");
  assert.ok(!/dist\["index\.html"\]/.test(code), "the build reads a shell out of the dist again");
});

test("a worker is REFUSED without a slug, rather than packaged with an empty one", () => {
  // `packageWorker`'s own first rule, which had to be restored when it went. The
  // slug is baked into `site-brand.ts` and the server entry builds every R2 key
  // from it, so a script without one answers 404 to every stylesheet, every
  // bundle and its own meta — a page that renders and then looks broken, which
  // is worse than the static path it would have replaced.
  //
  // VERIFIED BY EXECUTION, not by reading: a bundle built with an empty slug
  // served `sites//assets/…`, every asset 404'd, and the share tags were
  // silently absent while the document still returned 200.
  const src = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");
  assert.match(src, /payload\.worker && !brandUsed\.slug/,
    "a worker can be packaged for a site with no slug — every asset on it would 404");
  assert.match(src, /payload\.worker && brandUsed\.slug\) worker = readSiteWorker\(\)/,
    "the script is read without the slug having been checked");
});

test("a render failure is logged with its STACK", () => {
  // `window is not defined` names no module, and the bundle is one file of
  // ~950,000 characters — the message alone cost a separate diagnostic harness
  // to answer what one line states. It goes to our own console, never to the
  // response.
  const entry = fs.readFileSync(new URL("../builder/site-worker/entry.js", import.meta.url), "utf8");
  const at = entry.indexOf("render failed:");
  assert.ok(at > 0, "the render failure is no longer logged at all");
  assert.match(entry.slice(at, at + 120), /e\.stack/,
    "the render failure logs only its message, which names no module in a bundled file");
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

/* --------------------------------------- the shell comes from R2 */

/** An R2 stub holding exactly the named objects. */
const bucket = (files, seen = []) => ({
  seen,
  get: async (k) => { seen.push(k); return files[k] === undefined ? null : { async text() { return files[k]; } }; },
});

const PUBLISHED = '<!doctype html><html><head><title>Forno</title>'
  + '<meta property="og:title" content="Forno"><meta name="description" content="Wood-fired, Bristol">'
  + '</head><body><div id="root"></div><script src="/a.js"></script></body></html>';

test("THE PUBLISHED DOCUMENT IS THE SHELL, not the one baked at build time", async () => {
  // The bug this exists for: `injectMeta` adds the description and the Open
  // Graph tags at PUBLISH time, after the container produced the bundle — so a
  // baked shell is always the version from before those tags existed, and every
  // site lost its link preview. Measured live: three failures and a real page
  // whose whole head was `<title>Forno</title>`.
  const mod = await loadEntry({ routes: ["/"] });
  const res = await mod.default.fetch(req("/"), { SITES: bucket({ "sites/s/index.html": PUBLISHED }) });
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.match(html, /og:title/, "the published meta must reach the visitor");
  assert.match(html, /<h1>page<\/h1>/, "…and the fresh render still goes into it");
});

test("…per ROUTE, so a page's own preview is not the home page's", async () => {
  // Every route is prerendered to its own document with its OWN meta. Serving
  // `index.html` for all of them puts the home card on every address — the bug
  // the per-page injection was written to fix, reintroduced one layer down.
  const seen = [];
  const mod = await loadEntry({ routes: ["/", "/book"] });
  const res = await mod.default.fetch(req("/book"), {
    SITES: bucket({ "sites/s/book.html": PUBLISHED.replace("Forno", "Book a table"), "sites/s/index.html": PUBLISHED }, seen),
  });
  assert.match(await res.text(), /Book a table/, "the route's own document is what was read");
  assert.equal(seen[0], "sites/s/book.html", "and it was asked for first");
});

test("…falling back to index.html when a route has no document of its own", async () => {
  // A prerender is best-effort and a route can legitimately have no snapshot.
  const mod = await loadEntry({ routes: ["/", "/book"] });
  const res = await mod.default.fetch(req("/book"), { SITES: bucket({ "sites/s/index.html": PUBLISHED }) });
  assert.equal(res.status, 200);
  assert.match(await res.text(), /og:title/);
});

test("NOTHING PUBLISHED IS A 404 — the files get the final say", async () => {
  // The safety net for the failure that produced this change: a delete removes
  // the files and then the script, and when the REMOVAL fails a baked shell
  // keeps serving a site whose every trace was erased. Measured live — 21
  // objects gone, the address still answering 200 fifteen minutes later.
  const mod = await loadEntry({ routes: ["/"] });
  const res = await mod.default.fetch(req("/"), { SITES: bucket({}) });
  assert.equal(res.status, 404);
});

test("…but an R2 THROW keeps the site up on the baked shell", async () => {
  // A blip must not take a live site down. Degraded to no preview, still
  // serving — the opposite call from a miss, and the distinction is the whole
  // design.
  const mod = await loadEntry({ routes: ["/"] });
  const boom = { get: async () => { throw new Error("R2 unavailable"); } };
  const res = await mod.default.fetch(req("/"), { SITES: boom });
  assert.equal(res.status, 200);
  assert.match(await res.text(), /<h1>page<\/h1>/, "the render still lands in the baked shell");
});

test("…and so does a script with no bucket binding at all", async () => {
  // "Cannot tell" is not "gone". The first draft of this conflated them and
  // 404'd every page of every site whose env had no SITES — caught by the
  // existing runtime tests, all of which drive exactly that shape.
  const mod = await loadEntry({ routes: ["/"] });
  const res = await mod.default.fetch(req("/"), {});
  assert.equal(res.status, 200);
});
