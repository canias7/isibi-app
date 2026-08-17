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
import { test } from "node:test";
import assert from "node:assert/strict";
import { hit } from "./fixtures/worker-harness.mjs";
import { SITE_ORIGIN_TOKEN, routesContent, redirectsContent } from "../site-seo.mjs";
import { injectMeta } from "../site-meta.mjs";

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
function dispatch(seen) {
  return {
    get: () => ({
      fetch: async (req) => {
        const p = new URL(req.url).pathname;
        seen.push(p);
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
  const seen = [];
  const r = await hit("/menu", { env: env(seen), origin: SITE });
  assert.equal(r.status, 200, r.text.slice(0, 200));
  assert.ok(!/="\.\//.test(r.text), "a relative reference survived: " + r.text.slice(0, 300));
  assert.match(r.text, /src="\/assets\/index-BZW04i8N\.js"/, "the site zone serves at the root");
  assert.match(r.text, /Wick Lane/, "…and it is still the rendered page, not the shell");
});

test("…and the prefix follows the MOUNT, not the code", async () => {
  // The same bytes serve at three addresses. A prefix baked anywhere is wrong
  // on two of them, and on a custom domain it puts OUR path in the owner's page.
  // A CUSTOM DOMAIN IS NOT DRIVEN HERE, deliberately: resolving one to a slug
  // is a Supabase lookup, which an empty env cannot do, and supplying a fake
  // for it would be testing the fake. `mountRootFor` is asserted against that
  // case directly in `site-domains.test.mjs`.
  const seen = [];
  // The workspace serves the site under a path, and the prefix has to come with it or
  // the bundle 404s on the one mount the builder's own preview uses.
  const ws = await hit(`/s/${WSLUG}/menu`, { env: env(seen) });
  assert.equal(ws.status, 200, ws.text.slice(0, 200));
  assert.match(ws.text, new RegExp('src="/s/' + WSLUG + '/assets/index-BZW04i8N\\.js"'));
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
  assert.ok(!seen.includes("/sitemap.xml"), "it was dispatched: " + seen.join(", "));
});

// ── an address the site does not have ────────────────────────────────────────

test("a RENAMED page still redirects, rather than becoming a hard 404", async () => {
  // The redirect map lives in `index.html`'s head and the static path has read
  // it since the SEO tier shipped. Dispatching in front of it turned every
  // renamed or deleted page into a 404 — so an owner renaming a page broke
  // every link already indexed and every share already sent, silently.
  const seen = [];
  const r = await hit("/coffee", { env: env(seen), origin: SITE });
  assert.equal(r.status, 301, r.text.slice(0, 200));
  // Absolute, and on the site's OWN address — a redirect that bounced a
  // visitor onto the platform's hostname would undo the whole `.dev`/`.app`
  // split, and on a custom domain it would take somebody off the domain they
  // paid for at the moment they clicked a link to it.
  assert.equal(r.headers.get("location"), `${SITE}/menu`);
  // A 301 with no freshness is cached by browsers effectively forever, so a
  // page that comes back is unreachable to exactly the visitors it came back for.
  assert.match(r.headers.get("cache-control") || "", /max-age=\d+/);
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
