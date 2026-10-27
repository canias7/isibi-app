// A site answers its own visitors' reads (2026-10-27): the upload's two public
// addresses, the platform's fall-through, and the template's own read handler.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { uploadSiteWorker, SITE_VARS } from "../builder/site-dispatch.mjs";

async function metaOf(vars) {
  let form;
  await uploadSiteWorker({ accountId: "a", namespace: "n", name: "site-x", code: "x", bucket: "gfs-x", apiToken: "t", vars },
    { fetch: async (_u, init) => { form = init.body; return new Response(JSON.stringify({ success: true }), { status: 200 }); } });
  return JSON.parse(await form.get("metadata").text());
}

test("the upload gives a script only the named public addresses, never anything else", async () => {
  assert.deepEqual(SITE_VARS, ["DATA_API_BASE", "AUTH_BASE"]);
  const m = await metaOf({ DATA_API_BASE: "https://ep-1.data.neon.tech/rest", AUTH_BASE: "https://ep-1.auth.neon.tech/auth", SECRET_KEY: "https://x", DATABASE_URL: "postgres://u:p@h/db" });
  assert.deepEqual(m.bindings, [
    { type: "r2_bucket", name: "SITES", bucket_name: "gfs-x" },
    { type: "plain_text", name: "DATA_API_BASE", text: "https://ep-1.data.neon.tech/rest" },
    { type: "plain_text", name: "AUTH_BASE", text: "https://ep-1.auth.neon.tech/auth" },
  ]);
  for (const bad of ["http://plain", "https://has space", "", 42, null]) {
    assert.equal((await metaOf({ DATA_API_BASE: bad })).bindings.length, 1, String(bad));
  }
  assert.equal((await metaOf(null)).bindings.length, 1);
});

const W = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const between = (a, b) => { const i = W.indexOf(a), j = W.indexOf(b, i + 1); assert.ok(i >= 0 && j > i, a); return W.slice(i, j); };

test("the platform asks the site only for reads, only with the switch on, and falls back without the mark", () => {
  const r = between("// A READ THE SITE ANSWERS ITSELF", 'return proxySiteService(env, request, url, slug, dpath, "data", ctx);');
  assert.match(r, /request\.method === "GET" \|\| request\.method === "HEAD"/);
  assert.match(r, /env\.SITE_OWN_DATA === "1"/);
  const f = between("async function ownDataRead(", "\n}\n");
  assert.match(f, /x-site-data"\) === "own" \? res : null/);
  assert.match(f, /siteLimits\(env\)/);
  assert.match(f, /delete\(PREVIEW_HEADER\)/);
  assert.match(f, /catch \{ return null; \}/);
  const v = between("async function siteReadVars(", "\n}\n");
  assert.match(v, /env\.SITE_OWN_DATA !== "1"\) return null/);
  assert.match(between("async function uploadScriptOnce(", "\n}\n"), /vars: await siteReadVars\(env, slug\)/);
  // The rate limit runs first, as before.
  const route = W.slice(W.indexOf('const dm = url.pathname.match(/^\\/api\\/db\\/'), W.indexOf("// A READ THE SITE ANSWERS ITSELF"));
  assert.match(route, /_dataLimiter\.hit/);
});

// ── the template's own handler, run for real ─────────────────────────────────
let loads = 0;
async function loadHandler() {
  const src = fs.readFileSync(new URL("../builder/lovable/template/src/server.ts", import.meta.url), "utf8");
  const a = src.indexOf("let anonTok"), b = src.indexOf("\n}\n", src.indexOf("export async function ownDataRead")) + 3;
  const body = "const SITE_SLUG = 'ember-cart';\n" + src.slice(a, b);
  const js = ts.transpileModule(body, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  // A fresh module per call: the token cache lives at module scope.
  return import("data:text/javascript," + encodeURIComponent(js + "\n// " + ++loads));
}
const env = { DATA_API_BASE: "https://db.example/rest", AUTH_BASE: "https://auth.example" };

test("a read goes to the site's own Data API, as an anonymous visitor, marked own", async () => {
  const { ownDataRead } = await loadHandler();
  const seen = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (u, init = {}) => {
    seen.push([String(u), init.headers && new Headers(init.headers).get("authorization")]);
    if (String(u).endsWith("/token/anonymous")) return new Response(JSON.stringify({ token: "eyJabc.def.ghi" }));
    return new Response('[{"id":1}]', { status: 200, headers: { "content-type": "application/json", "content-range": "0-0/1" } });
  };
  try {
    const url = new URL("https://ember-cart.gofarther.app/api/db/ember-cart/data/menu?select=*");
    const r = await ownDataRead(new Request(url), env, url);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("x-site-data"), "own");
    assert.equal(r.headers.get("content-range"), "0-0/1");
    assert.equal(await r.text(), '[{"id":1}]');
    assert.deepEqual(seen.at(-1), ["https://db.example/rest/menu?select=*", "Bearer eyJabc.def.ghi"]);
    // A signed-in visitor's own token is used, not the anonymous one.
    const r2 = await ownDataRead(new Request(url, { headers: { authorization: "Bearer mine" } }), env, url);
    assert.equal(r2.status, 200);
    assert.deepEqual(seen.at(-1), ["https://db.example/rest/menu?select=*", "Bearer mine"]);
  } finally { globalThis.fetch = real; }
});

test("not a read, another site, no addresses, or no token: the handler steps aside", async () => {
  const { ownDataRead } = await loadHandler();
  const real = globalThis.fetch;
  globalThis.fetch = async (u) => String(u).endsWith("/token/anonymous") ? new Response("nope", { status: 500 }) : new Response("[]");
  try {
    const at = (p) => new URL("https://ember-cart.gofarther.app" + p);
    const u = at("/api/db/ember-cart/data/menu");
    assert.equal(await ownDataRead(new Request(u, { method: "POST", body: "{}" }), env, u), null);
    const other = at("/api/db/other-site/data/menu");
    assert.equal(await ownDataRead(new Request(other), env, other), null);
    assert.equal(await ownDataRead(new Request(u), {}, u), null);
    const bad = at("/api/db/ember-cart/data/../x");
    assert.equal(await ownDataRead(new Request(bad), env, bad), null);
    assert.equal(await ownDataRead(new Request(u), env, u), null, "no anonymous token: fall back, never a bare request");
  } finally { globalThis.fetch = real; }
});

test("the handler runs before everything else in the site's fetch, and the foundation copy matches", () => {
  const src = fs.readFileSync(new URL("../builder/lovable/template/src/server.ts", import.meta.url), "utf8");
  const f = src.slice(src.indexOf("const site = {"));
  assert.ok(f.indexOf("ownDataRead(request, env, url)") < f.indexOf("isAsset(url.pathname)"));
  assert.ok(fs.readFileSync(new URL("../builder/foundation-files.mjs", import.meta.url), "utf8").includes("ownDataRead(request, env, url)"));
});
