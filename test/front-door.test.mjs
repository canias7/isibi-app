// The front door (front/worker.mjs) and the same limits for every site
// (worker.js `siteLimits`), 2026-10-27.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import front, { isPlatformHeader, SERVED_BY } from "../front/worker.mjs";
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

test("the front door holds one binding, the platform, and is not deployed or routed", () => {
  const cfg = fs.readFileSync(new URL("../front/wrangler.jsonc", import.meta.url), "utf8").replace(/^\s*\/\/.*$/gm, "");
  const j = JSON.parse(cfg);
  assert.deepEqual(j.services, [{ binding: "PLATFORM", service: "isibi-app" }]);
  for (const k of ["r2_buckets", "kv_namespaces", "d1_databases", "dispatch_namespaces", "vars", "routes", "route"]) assert.equal(j[k], undefined, k);
  const main = JSON.parse(fs.readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8").replace(/^\s*\/\/.*$/gm, "").replace(/,(\s*[}\]])/g, "$1"));
  assert.equal(j.compatibility_date, main.compatibility_date);
  for (const f of fs.readdirSync(new URL("../.github/workflows/", import.meta.url))) {
    assert.doesNotMatch(fs.readFileSync(new URL("../.github/workflows/" + f, import.meta.url), "utf8"), /front\/wrangler|gofarther-front/, f);
  }
});

// ── the limits ───────────────────────────────────────────────────────────────
const W = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

test("every visitor dispatch carries the limits; probes and confirmations do not", () => {
  const gets = W.split("\n").filter((l) => l.includes("env.SITE_WORKERS.get("));
  assert.ok(gets.length >= 8);
  const limited = gets.filter((g) => g.includes("siteLimits(env)"));
  assert.equal(limited.length, 2);
  assert.ok(limited.some((g) => g.includes("previewScriptName(pv.slug)")));
  assert.ok(limited.some((g) => g.includes("get(name, {}, siteLimits(env))")));
  for (const g of gets.filter((g) => !g.includes("siteLimits"))) assert.match(g, /stubFor/, g);
});

test("the limits default to the owner's numbers and take only positive whole overrides", async () => {
  const src = W.slice(W.indexOf("export const SITE_CPU_MS"), W.indexOf("async function sealedBucketFor("));
  const mod = await import("data:text/javascript," + encodeURIComponent(src));
  assert.deepEqual(mod.siteLimits({}), { limits: { cpuMs: 300, subRequests: 50 } });
  assert.deepEqual(mod.siteLimits({ SITE_CPU_MS: "500", SITE_SUBREQUESTS: "80" }), { limits: { cpuMs: 500, subRequests: 80 } });
  for (const bad of ["0", "-5", "1.5", "lots", ""]) assert.deepEqual(mod.siteLimits({ SITE_CPU_MS: bad }).limits.cpuMs, 300, bad);
});
