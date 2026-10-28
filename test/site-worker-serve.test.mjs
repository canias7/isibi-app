// What the PLATFORM does with a site script's answer — driven through the real
// router, not read.
//
// WHY THIS FILE EXISTS. Putting each site behind its own Worker moved the serve
// path, and three things the static path had always done did not move with it:
// it rewrote relative asset references to absolute, it substituted the real
// origin into `robots.txt` and `sitemap.xml`, and it answered a renamed or
// deleted address with a 301. Dispatching in front of all of that silently
// dropped all three.
//
// Every one of those is invisible to the site's own bundle tests — the script is
// perfectly correct in isolation — and invisible to a source-read, which is what
// guarded this layer for the twelve features that shipped dead. So: real router,
// fake bindings, and assertions on what a visitor would actually receive.
//
// 2026-10-28: the site's own Worker does its own absolutizing, redirects and
// robots/sitemap on its hosts, marking its answer `x-site-data: own`; the
// platform returns a script's answer as it came (marked or not). The rewrite
// and redirect cases drive the template's `lib/site-addresses.ts` for real.
import { test } from "node:test";
import assert from "node:assert/strict";
import { hit } from "./fixtures/worker-harness.mjs";
import { SITE_ORIGIN_TOKEN, routesContent, redirectsContent } from "../site-seo.mjs";
import { injectMeta } from "../site-meta.mjs";
import { loadTemplate } from "./fixtures/template-ts.mjs";

// DRIVEN ON THE SITE ZONE, because that is the public mount: `/s/<slug>/` on
// the platform 301s to the subdomain (the one-public-address rule), so a test
// that hits /s/ there is testing the redirect and not the serve path. The
// workspace-mount arm goes through a slug with a TRAILING HYPHEN — a legal
// build slug and an illegal DNS label, so `siteHostFor` answers null and such a
// site really is served at /s/. That is the one class of site that keeps the
// mount alive, and the mount the builder's own preview frame uses.
const SLUG = "fold-coffee";
const WSLUG = "fold-coffee-";
const SITE = `https://${SLUG}.gofarther.app`;

// The document a container really produces: vite `base: "./"`, so every asset
// reference is relative. Measured against a real build rather than invented.
const DOC = '<!doctype html><html lang="en"><head>'
  + '<link rel="icon" href="./favicon.svg" type="image/svg+xml" />'
  + '<script type="module" crossorigin src="./assets/index-BZW04i8N.js"></script>'
  + '<link rel="stylesheet" crossorigin href="./assets/index-BGXVLV5r.css">'
  + "</head><body><div id=\"root\">Wick Lane</div></body></html>";

// `index.html` additionally carries the manifest the publish path writes into
// its head — the route list and the redirect map.
//
// PRODUCED BY THE REAL PUBLISH CHAIN, not hand-written, and the first draft
// proved why: it spelled the tags `isibi:routes`/`isibi:redirects` and the
// reader looks for `site-routes`/`site-redirects`, so the manifest parsed to
// null and every redirect assertion failed against correct code. Two fixtures
// that agree with each other and with neither end — the `routeOf` lesson.
const SHELL = injectMeta(DOC, {
  brand: "Fold Coffee",
  slug: SLUG,
  routesCsv: routesContent({ routes: ["/", "/menu"] }),
  redirectsCsv: redirectsContent({ "/coffee": "/menu" }),
});

const SITEMAP = '<?xml version="1.0"?><urlset><url><loc>' + SITE_ORIGIN_TOKEN + '/menu</loc></url></urlset>';

/** An R2 stand-in holding exactly what a published site holds. */
function bucket(extra = {}) {
  const objs = {};
  for (const s of [SLUG, WSLUG]) {
    objs[`sites/${s}/index.html`] = SHELL;
    objs[`sites/${s}/menu.html`] = DOC;
    objs[`sites/${s}/sitemap.xml`] = SITEMAP;
    objs[`sites/${s}/assets/app.js`] = "console.log(1)";
    // Present in the bucket AND refused by the script — see the withheld test.
    objs[`sites/${s}/assets/withheld.js`] = "console.log(2)";
  }
  Object.assign(objs, extra);
  return {
    get: async (k) => (k in objs
      ? { text: async () => objs[k], body: objs[k], writeHttpMetadata() {}, httpMetadata: {} }
      : null),
  };
}

/**
 * A stand-in for the site's own script, answering the way the real entry does:
 * the route's own document rendered into, 404 for an address it does not have,
 * and assets straight off the bucket.
 *
 * `seen` records what it was ASKED for, which is how the "these two files never
 * reach it" assertion is made about behaviour rather than about a code path.
 */
function dispatch(seen, opt = {}) {
  return {
    get: () => ({
      fetch: async (req) => {
        const p = new URL(req.url).pathname;
        seen.push(p);
        // A current script marks its answer its own (2026-10-28).
        if (opt.answer) return opt.answer;
        if (opt.mark) return new Response(opt.body, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "x-site-data": "own" } });
        if (/\.[a-z0-9]{1,8}$/i.test(p.split("/").pop() || "")) {
          // A SCRIPT IS ENTITLED TO REFUSE AN ASSET THE BUCKET STILL HAS, and it
          // may do so with an HTML body — a custom not-found page is the obvious
          // reason. `/assets/withheld.js` is in the bucket and refused here, so a
          // platform that went looking behind the script's back would serve it.
          if (p === "/assets/withheld.js") {
            return new Response("<p>gone</p>", { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
          }
          return p === "/assets/app.js"
            ? new Response("console.log(1)", { headers: { "content-type": "application/javascript" } })
            : new Response("Not found", { status: 404 });
        }
        if (p === "/" || p === "/menu") {
          return new Response(DOC, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
        }
        return new Response(SHELL, { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
      },
    }),
  };
}

const env = (seen) => ({ SITE_WORKERS: dispatch(seen), SITES_BUCKET: bucket() });

// ── the asset references ──────────────────────────────────────────────────────

test("a script's page comes back with ABSOLUTE asset references", async () => {
  // THE BUG THIS IS FOR: vite writes `./assets/…`, which a browser resolves
  // against the DIRECTORY of the URL it was served at. At the mount root that
  // happens to be right; at `/menu/` it asks for `/menu/assets/…` and the page
  // is blank. The static path has always rewritten these and the script served
  // its document verbatim.
  //
  // (2026-10-28: the site's own Worker.) The platform no longer rewrites a
  // script's page: the site absolutizes its own (`absolutized`, marking the
  // answer `x-site-data: own`), and the platform returns any script's answer as
  // it came. Both halves are driven: the template's rewrite for real, and the
  // platform passing the marked and the unmarked page through unchanged.
  const { absolutized } = await loadTemplate("lib/site-addresses.ts");
  const a = await absolutized(new Response(DOC, { headers: { "content-type": "text/html; charset=utf-8" } }), new URL(SITE + "/menu"), SLUG);
  const text = await a.text();
  assert.ok(!/="\.\//.test(text), "a relative reference survived: " + text.slice(0, 300));
  assert.match(text, /src="\/assets\/index-BZW04i8N\.js"/, "the site zone serves at the root");
  assert.match(text, /Wick Lane/, "…and it is still the rendered page, not the shell");
  assert.equal(a.headers.get("x-site-data"), "own");

  // The platform: a marked page is untouched, byte for byte.
  const marked = { SITE_WORKERS: dispatch([], { mark: true, body: text }), SITES_BUCKET: bucket() };
  const m = await hit("/menu", { env: marked, origin: SITE });
  assert.equal(m.status, 200);
  assert.equal(m.text, text);
  // An unmarked (older) script's page is returned as it answered: no rescue.
  const seen = [];
  const r = await hit("/menu", { env: env(seen), origin: SITE });
  assert.equal(r.status, 200, r.text.slice(0, 200));
  assert.equal(r.text, DOC, "the platform rewrote an unmarked script's page");
});

test("…and the prefix follows the MOUNT, not the code", async () => {
  // The same bytes serve at three addresses. A prefix baked anywhere is wrong
  // on two of them, and on a custom domain it puts OUR path in the owner's page.
  // (2026-10-28: the site's own Worker.) The site absolutizes for the address
  // it was served at: the workspace mount keeps `/s/<slug>/`, which the
  // builder's own preview uses; a custom domain is the root.
  const { absolutized } = await loadTemplate("lib/site-addresses.ts");
  const html = { headers: { "content-type": "text/html; charset=utf-8" } };
  const ws = await absolutized(new Response(DOC, html), new URL(`https://gofarther.dev/s/${WSLUG}/menu`), WSLUG);
  assert.match(await ws.text(), new RegExp('src="/s/' + WSLUG + '/assets/index-BZW04i8N\\.js"'));
  const dom = await absolutized(new Response(DOC, html), new URL("https://shop.example.com/menu"), SLUG);
  assert.match(await dom.text(), /src="\/assets\/index-BZW04i8N\.js"/);
  // The platform's workspace mount passes an unmarked script's page as it came.
  const seen = [];
  const r = await hit(`/s/${WSLUG}/menu`, { env: env(seen) });
  assert.equal(r.status, 200, r.text.slice(0, 200));
  assert.equal(r.text, DOC);
});

test("an asset from the script is passed through untouched", async () => {
  // Only the document is rewritten. Buffering and re-emitting every chunk and
  // stylesheet would put compute in front of the files requested most, and a
  // regex over a JavaScript bundle can only ever damage it.
  const seen = [];
  const r = await hit("/assets/app.js", { env: env(seen), origin: SITE });
  assert.equal(r.status, 200);
  assert.equal(r.text, "console.log(1)");
  assert.match(r.headers.get("content-type") || "", /javascript/);
});

// ── the two files that must not be dispatched ────────────────────────────────

test("sitemap.xml never reaches the script, and carries a REAL origin", async () => {
  // The script's own asset branch would serve it straight off R2 — token and
  // all — so every URL in a customer's sitemap would be unusable to a crawler.
  // Only this side knows which of three addresses the request arrived on.
  const seen = [];
  const r = await hit(`/s/${WSLUG}/sitemap.xml`, { env: env(seen) });
  assert.equal(r.status, 200);
  assert.ok(!r.text.includes(SITE_ORIGIN_TOKEN), "the placeholder shipped: " + r.text.slice(0, 200));
  assert.match(r.text, new RegExp("<loc>https://gofarther\\.dev/s/" + WSLUG + "/menu</loc>"));
  assert.ok(!seen.includes("/sitemap.xml"), "it was dispatched: " + seen.join(", "));
});

test("…and the substituted origin follows the mount too", async () => {
  const seen = [];
  const r = await hit("/sitemap.xml", { env: env(seen), origin: `https://${SLUG}.gofarther.app` });
  assert.match(r.text, /<loc>https:\/\/fold-coffee\.gofarther\.app\/menu<\/loc>/);
  // On the site's own host the script is asked first (2026-10-27); a script
  // that does not mark its answer its own is not believed for these two files.
  assert.ok(seen.includes("/sitemap.xml"), "the site was not asked: " + seen.join(", "));
});

// ── an address the site does not have ────────────────────────────────────────

test("a RENAMED page still redirects, rather than becoming a hard 404", async () => {
  // Dispatching in front of the redirect map once turned every renamed or
  // deleted page into a 404 — so an owner renaming a page broke every link
  // already indexed and every share already sent, silently.
  //
  // (2026-10-28: the site's own Worker.) The site answers its own redirects
  // from its own sidecar (`siteRedirect`), marked `x-site-data: own`; the
  // platform no longer adds one to a script's answer. The platform half: a
  // marked 301 is returned untouched, and an unmarked script's 404 is returned
  // as it answered (an older script is not rescued).
  const sent = new Response(null, { status: 301, headers: { "x-site-data": "own", location: `${SITE}/menu`, "cache-control": "public, max-age=600" } });
  const marked = { SITE_WORKERS: dispatch([], { mark: true, answer: sent }), SITES_BUCKET: bucket() };
  const m = await hit("/coffee", { env: marked, origin: SITE });
  assert.equal(m.status, 301);
  assert.equal(m.headers.get("location"), `${SITE}/menu`);
  const seen = [];
  const r = await hit("/coffee", { env: env(seen), origin: SITE });
  assert.equal(r.status, 404, "the platform invented a redirect for an unmarked script");
  assert.equal(r.headers.get("location"), null);
});

test("…and it STILL redirects on a Start site, which publishes no index.html", async () => {
  // THE MANIFEST MOVED AND THE READER DID NOT, once: Start publishes no HTML,
  // so a reader of `index.html`'s head found nothing and every renamed page on
  // every site built since Start became a hard 404.
  //
  // (2026-10-28: the site's own Worker.) The reader is the site's own
  // `siteRedirect`, over the SIDECAR the publish really writes
  // (`sitemeta/<slug>.json`), built through `redirectsContent`.
  const { siteRedirect } = await loadTemplate("lib/site-addresses.ts");
  const objs = {
    [`sitemeta/${SLUG}.json`]: JSON.stringify({
      routesCsv: routesContent({ routes: ["/", "/menu"] }),
      redirectsCsv: redirectsContent({ "/coffee": "/menu" }),
    }),
  };
  const start = { SITES: { get: async (k) => (k in objs ? { text: async () => objs[k] } : null) } };
  const r = await siteRedirect(start, new URL(SITE + "/coffee"), SLUG);
  assert.ok(r, "a Start site's renamed page did not redirect");
  assert.equal(r.status, 301);
  // Absolute, and on the site's OWN address.
  assert.equal(r.headers.get("location"), `${SITE}/menu`);
  // A 301 with no freshness is cached by browsers effectively forever.
  assert.match(r.headers.get("cache-control") || "", /max-age=\d+/);
  assert.equal(r.headers.get("x-site-data"), "own");
  // An address in no map is no redirect.
  assert.equal(await siteRedirect(start, new URL(SITE + "/nowhere"), SLUG), null);
});

test("…and an unknown address on a Start site keeps the script's own branded 404", async () => {
  // The `notfound` verdict asks for exactly what the script already produced —
  // the branded page with a 404 status — so the redirect is the whole job here
  // and everything else must be left alone. Without this, "the redirect fires"
  // and "every unknown address now 301s somewhere" look identical.
  const seen = [];
  const start = {
    SITE_WORKERS: dispatch(seen),
    SITES_BUCKET: (() => {
      const objs = {
        [`sitemeta/${SLUG}.json`]: JSON.stringify({
          routesCsv: routesContent({ routes: ["/", "/menu"] }),
          redirectsCsv: redirectsContent({ "/coffee": "/menu" }),
        }),
      };
      return { get: async (k) => (k in objs ? { text: async () => objs[k], body: objs[k], writeHttpMetadata() {}, httpMetadata: {} } : null) };
    })(),
  };
  const r = await hit("/nowhere", { env: start, origin: SITE });
  assert.equal(r.status, 404, "an address in no map must not become a redirect");
  assert.equal(r.headers.get("location"), null, "nothing to redirect to, so no location");
});

test("…and a site with no sidecar at all is served exactly as it was", async () => {
  // EVERY SITE PUBLISHED BEFORE THE SIDECAR EXISTED, and the safe direction:
  // an unreadable or absent manifest is NO OPINION, never "no such page". The
  // caller's fallback is the answer it already had.
  const seen = [];
  const bare = {
    SITE_WORKERS: dispatch(seen),
    SITES_BUCKET: { get: async () => null },
  };
  const r = await hit("/coffee", { env: bare, origin: SITE });
  assert.equal(r.status, 404, "no manifest must not invent a redirect");
  assert.equal(r.headers.get("location"), null);
});

test("…and a corrupt sidecar cannot take the site down", async () => {
  // It is parsed on the serve path of every unknown address, so a throw here is
  // a 500 on a page that should have been a 404.
  const seen = [];
  // ONLY THE SIDECAR IS CORRUPT. A bucket answering every key with the same
  // junk hands `index.html` to the SPA fallback as well, which serves it 200 —
  // so the test would fail for a reason that has nothing to do with the parse.
  const broken = {
    SITE_WORKERS: dispatch(seen),
    SITES_BUCKET: {
      get: async (k) => (k === `sitemeta/${SLUG}.json`
        ? { text: async () => "{not json", writeHttpMetadata() {}, httpMetadata: {} }
        : null),
    },
  };
  const r = await hit("/coffee", { env: broken, origin: SITE });
  assert.equal(r.status, 404, "a corrupt sidecar answered " + r.status);
});

test("…and an address that never existed is a 404 with a page in it", async () => {
  const seen = [];
  const r = await hit("/nowhere", { env: env(seen), origin: SITE });
  assert.equal(r.status, 404);
  assert.match(r.text, /<div id="root">/, "the branded 404 needs a shell to render into");
});

test("a MISSING asset stays a 404 and is never handed HTML", async () => {
  // The fallthrough is extensionless-only for the reason the SPA fallback
  // already is: a browser expecting a module and given HTML fails later,
  // somewhere else, with an error nobody can read back to a deleted file.
  const seen = [];
  const r = await hit("/assets/gone.js", { env: env(seen), origin: SITE });
  assert.equal(r.status, 404);
  assert.ok(!/<div id="root">/.test(r.text), "a missing chunk was answered with a page: " + r.text.slice(0, 120));
});

test("…and a script refusing an asset is BELIEVED, not second-guessed", async () => {
  // The fallthrough is extensionless-only, and this is the case that decides it.
  // `/assets/withheld.js` IS in the bucket and the script refuses it with an
  // HTML body. Without the extension gate the platform falls through to the
  // static path and serves the file the script just declined to — two sources of
  // truth for what a site serves, with the one that is not the site winning.
  const seen = [];
  const r = await hit("/assets/withheld.js", { env: env(seen), origin: SITE });
  assert.equal(r.status, 404, "the platform served an asset its own site refused");
  assert.ok(!/console\.log/.test(r.text), "…and served the bucket's copy: " + r.text.slice(0, 120));
});

// ── the property the whole tier rests on ─────────────────────────────────────

test("a site with NO script is served exactly as before", async () => {
  // Every site that existed before this tier has no script, and the dispatch
  // sits in front of the R2 read rather than replacing it precisely so that
  // stays true. Get it wrong and one deploy 404s every published site at once.
  const noScript = { SITE_WORKERS: { get: () => { throw new Error("Worker not found"); } }, SITES_BUCKET: bucket() };
  const r = await hit("/menu", { env: noScript, origin: SITE });
  assert.equal(r.status, 200);
  assert.match(r.text, /src="\/assets\/index-BZW04i8N\.js"/,
    "the static path rewrites these too — that is where the rule came from");
});
