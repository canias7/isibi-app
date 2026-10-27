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
  assert.deepEqual(SITE_VARS, ["DATA_API_BASE", "AUTH_BASE", "EFFECT_URL", "OWN_BUCKET", "EFFECT_KEY"]);
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
  assert.match(r, /env\.SITE_OWN_DATA === "1"/);
  const f = between("async function ownDataRead(", "\n}\n");
  assert.match(f, /x-site-data"\) === "own" \? res : null/);
  assert.match(f, /siteLimits\(env\)/);
  assert.match(f, /delete\(PREVIEW_HEADER\)/);
  assert.match(f, /catch \{ return null; \}/);
  const v = between("async function siteReadVars(", "\n}\n");
  assert.match(v, /env\.SITE_OWN_DATA !== "1"\) return null/);
  assert.match(between("async function uploadScriptOnce(", "\n}\n"), /const vars = await siteReadVars\(env, slug\)/);
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

// ── phase A: the site saves its own visitors' rows ──────────────────────────
import { effectKeyFor, signEffect, readEffect, EFFECT_SIG_HEADER, EFFECT_PATH } from "../builder/site-effect.mjs";

test("the upload gives a site its own note key as a secret, the link back, and the own-bucket flag", async () => {
  const key = await effectKeyFor("root-secret", "ember-cart");
  assert.match(key, /^[0-9a-f]{64}$/);
  assert.notEqual(key, await effectKeyFor("root-secret", "other-site"));
  assert.equal(await effectKeyFor("", "ember-cart"), "");
  const m = await metaOf({ DATA_API_BASE: "https://d.x/rest", AUTH_BASE: "https://a.x", EFFECT_URL: "https://gofarther.dev/api/site-effect", EFFECT_KEY: key, OWN_BUCKET: "1" });
  const by = Object.fromEntries(m.bindings.map((b) => [b.name, b]));
  assert.equal(by.EFFECT_KEY.type, "secret_text");
  assert.equal(by.OWN_BUCKET.type, "plain_text");
  assert.deepEqual(by.PLATFORM, { type: "service", name: "PLATFORM", service: "isibi-app" });
  // No key, no link back; a malformed key or flag is dropped.
  const n = await metaOf({ EFFECT_KEY: "nothex", OWN_BUCKET: "yes" });
  assert.deepEqual(n.bindings.map((b) => b.name), ["SITES"]);
});

test("a note is accepted only for the site whose key signed it, fresh, and well shaped", async () => {
  const now = 1_800_000_000_000;
  const note = (o = {}) => JSON.stringify({ slug: "ember-cart", method: "POST", path: "bookings", sent: '{"a":1}', body: "", at: now, ...o });
  const sign = async (slug, text) => signEffect(await effectKeyFor("root", slug), text);
  const ok = await readEffect("root", note(), await sign("ember-cart", note()), now);
  assert.equal(ok.ok, true);
  assert.deepEqual([ok.note.slug, ok.note.action, ok.note.table], ["ember-cart", "created", "bookings"]);
  // Signed by another site's key: refused.
  assert.equal((await readEffect("root", note(), await sign("other-site", note()), now)).status, 401);
  // Tampered after signing, stale, or a wrong root: refused.
  const t = note();
  assert.equal((await readEffect("root", note({ slug: "other-site" }), await sign("ember-cart", t), now)).status, 401);
  assert.equal((await readEffect("root", note({ at: now - 10 * 60_000 }), await sign("ember-cart", note({ at: now - 10 * 60_000 })), now)).why, "stale");
  assert.equal((await readEffect("other-root", t, await sign("ember-cart", t), now)).status, 401);
  // Shape.
  for (const bad of [{ method: "GET" }, { path: "../x" }, { slug: "Bad Slug!" }]) {
    const text = note(bad);
    assert.equal((await readEffect("root", text, await sign(String(bad.slug || "ember-cart").toLowerCase(), text), now)).ok, false, JSON.stringify(bad));
  }
  assert.equal((await readEffect("root", "x".repeat(70000), "", now)).status, 413);
});

test("the platform's note route proves the site, then runs the shared follow-ups; the proxy uses the same", () => {
  const route = between("if (url.pathname === EFFECT_PATH && request.method === \"POST\")", "return Response.json({ ok: true }, { status: 202 });");
  assert.match(route, /readEffect\(root\.secret, text, request\.headers\.get\(EFFECT_SIG_HEADER\)\)/);
  assert.match(route, /siteRowConn\(env, n\.slug\)/);
  assert.match(route, /applyRowEffects\(env, ctx, \{ slug: n\.slug/);
  const proxy = between("async function proxySiteService(", "\n}\n");
  assert.match(proxy, /await applyRowEffects\(env, ctx, \{ slug, db, method: request\.method/);
  assert.equal(EFFECT_SIG_HEADER, "x-gf-effect-sig");
  assert.equal(EFFECT_PATH, "/api/site-effect");
});

async function loadWrite() {
  const src = fs.readFileSync(new URL("../builder/lovable/template/src/server.ts", import.meta.url), "utf8");
  const a = src.indexOf("let anonTok"), b = src.indexOf("\nexport async function ownDataRead");
  const body = "const SITE_SLUG = 'ember-cart';\n" + src.slice(a, b);
  const js = ts.transpileModule(body, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import("data:text/javascript," + encodeURIComponent(js + "\n// w" + ++loads));
}
function memBucket() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, v); } };
}

test("a form submission is saved by the site, answered once per key, and a signed note follows", async () => {
  const { ownDataWrite } = await loadWrite();
  const key = await effectKeyFor("root", "ember-cart");
  const notes = [], saves = [];
  const env2 = { ...env, EFFECT_KEY: key, OWN_BUCKET: "1", SITES: memBucket(),
    PLATFORM: { fetch: async (r) => { notes.push([await r.text(), r.headers.get("x-gf-effect-sig")]); return new Response("", { status: 202 }); } } };
  const real = globalThis.fetch;
  globalThis.fetch = async (u, init = {}) => {
    if (String(u).endsWith("/token/anonymous")) return new Response(JSON.stringify({ token: "eyJabc.def.ghi" }));
    saves.push([String(u), init.method, init.body]);
    return new Response("", { status: 201, headers: { "content-type": "application/json" } });
  };
  try {
    const url = new URL("https://ember-cart.gofarther.app/api/db/ember-cart/data/bookings");
    const mk = () => new Request(url, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": "k".repeat(20) }, body: JSON.stringify({ name: "Ana", "cf-turnstile-response": "tok" }) });
    const r1 = await ownDataWrite(mk(), env2, url);
    assert.equal(r1.status, 201);
    assert.equal(r1.headers.get("x-site-data"), "own");
    assert.deepEqual(saves, [["https://db.example/rest/bookings", "POST", '{"name":"Ana"}']], "saved once, spam token dropped");
    // The note: signed with the site's own key, and the platform accepts it.
    assert.equal(notes.length, 1);
    const [text, sig] = notes[0];
    const read = await readEffect("root", text, sig);
    assert.equal(read.ok, true);
    assert.deepEqual([read.note.slug, read.note.action, read.note.sent], ["ember-cart", "created", '{"name":"Ana"}']);
    // The same press again: replayed, not saved twice, no second note.
    const r2 = await ownDataWrite(mk(), env2, url);
    assert.equal(r2.status, 201);
    assert.equal(r2.headers.get("x-idempotent-replay"), "1");
    assert.equal(saves.length, 1);
    assert.equal(notes.length, 1);
  } finally { globalThis.fetch = real; }
});

test("without its own key or its own bucket, or for a read, the site leaves the write to the platform", async () => {
  const { ownDataWrite } = await loadWrite();
  const url = new URL("https://ember-cart.gofarther.app/api/db/ember-cart/data/bookings");
  const post = () => new Request(url, { method: "POST", body: "{}" });
  const base = { ...env, EFFECT_KEY: "k", OWN_BUCKET: "1", SITES: memBucket() };
  assert.equal(await ownDataWrite(post(), { ...base, EFFECT_KEY: undefined }, url), null);
  assert.equal(await ownDataWrite(post(), { ...base, OWN_BUCKET: undefined }, url), null);
  assert.equal(await ownDataWrite(post(), { ...base, SITES: undefined }, url), null);
  assert.equal(await ownDataWrite(new Request(url), base, url), null);
  const other = new URL("https://ember-cart.gofarther.app/api/db/other-site/data/bookings");
  assert.equal(await ownDataWrite(new Request(other, { method: "POST", body: "{}" }), base, other), null);
});
