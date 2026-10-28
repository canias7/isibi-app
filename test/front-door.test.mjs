// The front door (front/worker.mjs) and the same limits for every site
// (worker.js `siteLimits`), 2026-10-27.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import front, { isPlatformHeader, SERVED_BY, APP_HOSTS } from "../front/worker.mjs";
import { PREVIEW_HEADER } from "../site-draft.mjs";

test("a visitor's platform headers never reach the platform; everything else does", async () => {
  let seen;
  const env = { PLATFORM: { fetch: async (r) => { seen = r; return new Response("hi", { status: 201, headers: { "x-site-build": "b1" } }); } } };
  const res = await front.fetch(new Request("https://bakery.gofarther.app/menu?x=1", {
    method: "POST", body: "a=1",
    headers: { "x-gf-job": "forged", "X-GF-Owner": "forged", [PREVIEW_HEADER]: "1", cookie: "c=1", "content-type": "text/plain" },
  }), env);
  assert.equal(seen.url, "https://bakery.gofarther.app/menu?x=1");
  assert.equal(seen.method, "POST");
  assert.equal(await seen.text(), "a=1");
  assert.equal(seen.headers.get("cookie"), "c=1");
  for (const k of ["x-gf-job", "x-gf-owner", PREVIEW_HEADER]) assert.equal(seen.headers.get(k), null, k);
  assert.equal(res.status, 201);
  assert.equal(await res.text(), "hi");
  assert.equal(res.headers.get("x-site-build"), "b1");
  assert.equal(res.headers.get("x-served-by"), SERVED_BY);
});

test("the header filter: the preview header is the one the platform's draft route sends", () => {
  assert.equal(PREVIEW_HEADER, "x-site-preview");
  assert.ok(isPlatformHeader(PREVIEW_HEADER) && isPlatformHeader("X-Gf-Anything"));
  assert.ok(!isPlatformHeader("x-forwarded-for") && !isPlatformHeader("gf-x"));
});

test("no platform, or a platform that throws, is an honest 503/502 marked as the front door", async () => {
  const a = await front.fetch(new Request("https://x.gofarther.app/"), {});
  assert.equal(a.status, 503);
  assert.equal(a.headers.get("retry-after"), "30");
  const b = await front.fetch(new Request("https://x.gofarther.app/"), { PLATFORM: { fetch: async () => { throw new Error("down"); } } });
  assert.equal(b.status, 502);
  for (const r of [a, b]) assert.equal(r.headers.get("x-served-by"), SERVED_BY);
});

test("the front door holds two bindings, the platform and the sites' namespace, and every site address on gofarther.app", () => {
  const cfg = fs.readFileSync(new URL("../front/wrangler.jsonc", import.meta.url), "utf8").replace(/^\s*\/\/.*$/gm, "");
  const j = JSON.parse(cfg);
  assert.deepEqual(j.services, [{ binding: "PLATFORM", service: "isibi-app" }]);
  // 2026-10-28: and each site's own Worker, called directly. Still no bucket,
  // no KV, no database and no secret: it cannot read a site's files or data.
  assert.deepEqual(j.dispatch_namespaces, [{ binding: "SITES", namespace: "gofarther-sites" }]);
  for (const k of ["r2_buckets", "kv_namespaces", "d1_databases", "vars", "route"]) assert.equal(j[k], undefined, k);
  assert.deepEqual(j.routes, [{ pattern: "*.gofarther.app/*", zone_name: "gofarther.app" }, { pattern: "*/*", zone_name: "gofarther.dev" }]);
  const main = JSON.parse(fs.readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8").replace(/^\s*\/\/.*$/gm, "").replace(/,(\s*[}\]])/g, "$1"));
  assert.equal(j.compatibility_date, main.compatibility_date);
  // Deployed after the platform's own deploy and its gate, never before.
  const dep = fs.readFileSync(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");
  const at = dep.indexOf("deploy --config front/wrangler.jsonc");
  assert.ok(at > dep.indexOf("- name: Deploy with Wrangler") && at > dep.indexOf("deploy-gate.mjs clear"));
});

// ── the limits ───────────────────────────────────────────────────────────────
const W = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

test("every visitor dispatch carries the limits; probes and confirmations do not", () => {
  const gets = W.split("\n").filter((l) => l.includes("env.SITE_WORKERS.get("));
  assert.ok(gets.length >= 8);
  const limited = gets.filter((g) => g.includes("siteLimits(env)"));
  // Three since 2026-10-27: the site's own data reads (`ownDataRead`) too.
  assert.equal(limited.length, 3);
  // And the clock's two calls (a job, a wake), with more outside calls.
  const clock = gets.filter((g) => g.includes("{ limits: { ...lim.limits, subRequests: SITE_JOB_SUBREQUESTS } }"));
  assert.equal(clock.length, 2);
  assert.ok(limited.some((g) => g.includes("get(name, {}, siteLimits(env)).fetch(fwd)")));
  assert.ok(limited.some((g) => g.includes("previewScriptName(pv.slug)")));
  assert.ok(limited.some((g) => g.includes("get(name, {}, siteLimits(env))")));
  for (const g of gets.filter((g) => !g.includes("siteLimits") && !g.includes("SITE_JOB_SUBREQUESTS"))) assert.match(g, /stubFor/, g);
});

test("the limits default to the owner's numbers and take only positive whole overrides", async () => {
  const src = W.slice(W.indexOf("export const SITE_CPU_MS"), W.indexOf("async function sealedBucketFor("));
  const mod = await import("data:text/javascript," + encodeURIComponent(src));
  assert.deepEqual(mod.siteLimits({}), { limits: { cpuMs: 300, subRequests: 50 } });
  assert.deepEqual(mod.siteLimits({ SITE_CPU_MS: "500", SITE_SUBREQUESTS: "80" }), { limits: { cpuMs: 500, subRequests: 80 } });
  for (const bad of ["0", "-5", "1.5", "lots", ""]) assert.deepEqual(mod.siteLimits({ SITE_CPU_MS: bad }).limits.cpuMs, 300, bad);
});

test("the platform keeps its own gofarther.app route as the fallback", () => {
  assert.match(fs.readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"), /\{ "pattern": "\*\/\*", "zone_name": "gofarther\.app" \}/);
});

test("the platform no longer holds gofarther.dev's catch-all; the app keeps its exact routes", () => {
  const w = fs.readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  assert.doesNotMatch(w, /"pattern": "\*\/\*", "zone_name": "gofarther\.dev"/);
  assert.match(w, /"pattern": "gofarther\.dev", "custom_domain": true/);
  assert.match(w, /"pattern": "www\.gofarther\.dev", "custom_domain": true/);
});

test("the app's own hosts reach the platform with every header, x-gf-* included", async () => {
  for (const host of ["gofarther.dev", "www.gofarther.dev", "GoFarther.dev"]) {
    let seen;
    const env = { PLATFORM: { fetch: async (r) => { seen = r; return new Response("ok"); } } };
    await front.fetch(new Request(`https://${host}/api/job/abc`, { method: "PUT", body: "x", headers: { "x-gf-if-match": "etag1", "x-gf-job": "id.secret", authorization: "Bearer t" } }), env);
    assert.equal(seen.headers.get("x-gf-if-match"), "etag1", host);
    assert.equal(seen.headers.get("x-gf-job"), "id.secret", host);
    assert.equal(seen.headers.get("authorization"), "Bearer t", host);
  }
  assert.deepEqual([...APP_HOSTS].sort(), ["gofarther.dev", "www.gofarther.dev"]);
  // And a customer domain is still cleaned.
  let seen;
  await front.fetch(new Request("https://test.isibi.ai/", { headers: { "x-gf-if-match": "e" } }), { PLATFORM: { fetch: async (r) => { seen = r; return new Response("ok"); } } });
  assert.equal(seen.headers.get("x-gf-if-match"), null);
});

test("the job gateway's address is an app host the front door leaves alone", () => {
  const W = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(W, /gateway: \{ url: "https:\/\/" \+ APP_ZONE \+ "\/api\/job\/"/);
  assert.ok(APP_HOSTS.has("gofarther.dev"));
});

// ── the front door calls each site's own Worker (2026-10-28) ────────────────
test("a site's visit goes straight to that site's Worker; the app, previews and unknown addresses to the platform", async () => {
  const { handle } = await import("../front/worker.mjs");
  const plat = [], sites = [];
  const routes = {
    "ember-cart.gofarther.app": { slug: "ember-cart" },
    "test.isibi.ai": { slug: "ember-cart" },
    "old-name.gofarther.app": { redirect: "new-name.gofarther.app" },
    "gone.gofarther.app": { gone: true },
    "fresh.gofarther.app": { slug: "fresh" },
  };
  const env = {
    PLATFORM: { fetch: async (req) => {
      const u = new URL(req.url);
      if (u.pathname === "/__gf/route") { plat.push("route:" + u.searchParams.get("host")); return Response.json(routes[u.searchParams.get("host")] || { to: "platform" }); }
      plat.push(u.host + u.pathname); return new Response("platform");
    } },
    SITES: { get: (name, _a, opts) => ({ fetch: async (req) => {
      if (name === "site-fresh") throw new Error("Worker not found.");
      sites.push([name, new URL(req.url).host, req.headers.get("x-gf-replay"), opts && opts.limits]);
      return new Response("<p>site</p>", { headers: { "content-type": "text/html", "x-frame-options": "DENY" } });
    } }) },
  };
  const store = new Map();
  const cache = { match: async (k) => (store.has(k.url) ? new Response(store.get(k.url)) : undefined), put: async (k, r) => { store.set(k.url, await r.text()); } };
  const go = (u, h = {}) => handle(new Request(u, { headers: h }), env, { cache });

  const a = await go("https://ember-cart.gofarther.app/menu", { "x-gf-replay": "forged" });
  assert.equal(await a.text(), "<p>site</p>");
  assert.deepEqual(sites[0].slice(0, 3), ["site-ember-cart", "ember-cart.gofarther.app", null], "the site was not called directly, or a platform header got through");
  assert.deepEqual(sites[0][3], { cpuMs: 300, subRequests: 50 }, "the site's limits were not applied");
  assert.match(a.headers.get("content-security-policy"), /frame-ancestors 'self' https:\/\/gofarther\.dev/);
  assert.equal(a.headers.get("x-frame-options"), null);
  assert.ok(!plat.includes("ember-cart.gofarther.app/menu"), "the visit went through the platform");
  // The answer is kept: a second visit asks nothing of the platform.
  await go("https://ember-cart.gofarther.app/about");
  assert.equal(plat.filter((p) => p === "route:ember-cart.gofarther.app").length, 1, "the route was asked twice");
  // A custom domain, the same way.
  await go("https://test.isibi.ai/");
  assert.equal(sites.at(-1)[0], "site-ember-cart");
  // A renamed site and a dropped name.
  const r = await go("https://old-name.gofarther.app/menu?x=1");
  assert.equal(r.status, 301);
  assert.equal(r.headers.get("location"), "https://new-name.gofarther.app/menu?x=1");
  assert.equal((await go("https://gone.gofarther.app/")).status, 404);
  // No script yet (building, coming soon) → the platform.
  assert.equal(await (await go("https://fresh.gofarther.app/")).text(), "platform");
  // The app and an unknown address → the platform, untouched.
  assert.equal(await (await go("https://gofarther.dev/api/sites")).text(), "platform");
  assert.equal(await (await go("https://ember-cart--draft-abc.gofarther.app/")).text(), "platform");
});

test("the platform answers what an address is, and nothing of the site's", () => {
  const at = W.indexOf('url.pathname === "/__gf/route"');
  assert.ok(at > 0, "the route lookup is gone");
  assert.match(W.slice(at, at + 400), /isAppHostname\(url\.hostname\)/, "the lookup answers on a site's own address");
  const fn = W.slice(W.indexOf("async function routeForHost("), W.indexOf("async function siteForHostname("));
  assert.match(fn, /if \(previewOf\(label\)\) return \{ to: "platform" \};/, "a draft preview is sent to a site's live Worker");
  assert.match(fn, /resolveAlias\(label, seen, now\)/);
  assert.match(fn, /siteForHostname\(env, host\)/);
});
