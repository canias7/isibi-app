// A site answers its own visitors' reads (2026-10-27): the upload's two public
// addresses, the platform's fall-through, and the template's own read handler.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { uploadSiteWorker, SITE_PLAIN, RESERVED_NAMES, siteSecretAllowed } from "../builder/site-dispatch.mjs";

async function metaOf(vars, secrets = null) {
  let form;
  await uploadSiteWorker({ accountId: "a", namespace: "n", name: "site-x", code: "x", bucket: "gfs-x", apiToken: "t", vars, secrets },
    { fetch: async (_u, init) => { form = init.body; return new Response(JSON.stringify({ success: true }), { status: 200 }); } });
  return JSON.parse(await form.get("metadata").text());
}

test("the upload gives a script only the named public addresses, never anything else", async () => {
  assert.deepEqual(Object.keys(SITE_PLAIN), ["DATA_API_BASE", "AUTH_BASE", "OWN_BUCKET", "NOTIFY", "OWNER_EMAIL", "SITE_TABLES", "SITE_SPEC"]);
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

// 2026-10-28: the site's own Worker. The platform no longer asks "first" and
// falls back: every visitor call is the site's, and a site whose script cannot
// answer (no script, or no `own` mark) is told to republish, nothing done here.
test("the platform passes a visitor's call to the site, and without the mark says republish", () => {
  const sa = between("async function siteAnswers(", "\n}\n");
  assert.match(sa, /const own = await ownDataRead\(env, request, slug\);\s*if \(own\) return own;/);
  assert.match(sa, /status: 503/);
  assert.match(sa, /published again/);
  const f = between("async function ownDataRead(", "\n}\n");
  assert.match(f, /x-site-data"\) === "own" \? res : null/);
  assert.match(f, /siteLimits\(env\)/);
  assert.match(f, /delete\(PREVIEW_HEADER\)/);
  assert.match(f, /catch \{ return null; \}/);
  const v = between("async function siteReadVars(", "\n}\n");
  assert.match(v, /env\.SITE_OWN_DATA !== "1"\) return null/);
  assert.match(between("async function uploadScriptOnce(", "\n}\n"), /const given = await siteReadVars\(env, slug\)/);
  // Reads, writes, sign-in, reports and uploads: one route, to the site.
  // (Connections, hooks, checkout and the anti-spam check left with the
  // prebuilt features, 2026-10-29.)
  const route = between("A VISITOR'S CALL TO A SITE IS THE SITE'S", "return siteAnswers(env, request, vslug);");
  for (const part of ["data\\/", "auth\\/", "error", "uploads"]) assert.ok(route.includes(part), part);
  const pattern = route.match(/const vm = url\.pathname\.match\([^\n]*\);/);
  assert.ok(pattern, "landmark: the route's pattern");
  for (const gone of ["|api\\/", "hook\\/", "checkout", "turnstile"]) assert.ok(!pattern[0].includes(gone), gone + " is still routed");
});

// The behaviour of that route, run: the site's own answer passes through;
// none (or an unmarked one) is the 503, and nothing else is consulted.
test("siteAnswers, run: the site's marked answer, else 503 republish", async () => {
  const body = between("async function siteAnswers(", "\n}\n") + "\n}\n" + between("async function ownDataRead(", "\n}\n") + "\n}\n";
  const mk = new Function("scriptNameFor", "siteLimits", "PREVIEW_HEADER", "SITE_JOB_HEADER", body + "return siteAnswers;");
  const run = (answer) => mk((s) => "site-" + s, () => ({}), "x-preview", "x-job")(
    { SITE_WORKERS: { get: () => ({ fetch: async () => answer }) } }, new Request("https://a.gofarther.app/api/db/a/data/menu"), "a");
  const own = new Response("[]", { headers: { "x-site-data": "own" } });
  assert.equal(await run(own), own);
  const r = await run(new Response("[]"));
  assert.equal(r.status, 503);
  assert.match((await r.json()).error, /published again/);
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


// ── the site saves its own rows and runs what follows (2026-10-27) ──────────

test("a site is given its own login and its owner's own keys as secrets, and never a platform key", async () => {
  const m = await metaOf(
    { DATA_API_BASE: "https://d.x/rest", AUTH_BASE: "https://a.x", OWN_BUCKET: "1", NOTIFY: "1", OWNER_EMAIL: "owner@example.com", SITE_TABLES: '[{"name":"bookings"}]' },
    { APP_CONN: "postgresql://x_app:p@ep.neon.tech/db", RESEND_KEY: "re_1", EMAIL_FROM: "a@b.c", TWILIO_SID: "AC1", WEBHOOK_URL: "https://h.x",
      SUPABASE_SERVICE_KEY: "no", SITE_SECRETS_KEY: "no", CLOUDFLARE_API_TOKEN: "no", NEON_API_KEY: "no", GATEWAY_SIGNING_KEY: "no", MULTI: "a\nb" },
    ["TWILIO_SID"]);
  const by = Object.fromEntries(m.bindings.map((b) => [b.name, b.type]));
  assert.deepEqual(by, {
    SITES: "r2_bucket", DATA_API_BASE: "plain_text", AUTH_BASE: "plain_text", OWN_BUCKET: "plain_text", NOTIFY: "plain_text",
    OWNER_EMAIL: "plain_text", SITE_TABLES: "plain_text",
    APP_CONN: "secret_text", RESEND_KEY: "secret_text", EMAIL_FROM: "secret_text", TWILIO_SID: "secret_text", WEBHOOK_URL: "secret_text",
  });
  for (const k of ["SUPABASE_SERVICE_KEY", "SITE_SECRETS_KEY", "CLOUDFLARE_API_TOKEN", "NEON_API_KEY", "GATEWAY_SIGNING_KEY", "EMAIL"]) assert.equal(siteSecretAllowed(k), false, k);
  assert.ok(siteSecretAllowed("APP_CONN") && siteSecretAllowed("MY_WEATHER_KEY"));
  for (const k of ["SITES", "PLATFORM", "SITE_TABLES", "lower", "1X"]) assert.equal(siteSecretAllowed(k), false, k);
  assert.ok(RESERVED_NAMES.has("XAI_API_KEY"));
  // A plain value that is not what its name says is dropped.
  const bad = await metaOf({ OWNER_EMAIL: "not an email", NOTIFY: "yes", OWN_BUCKET: "1x", SITE_TABLES: "{}" });
  assert.deepEqual(bad.bindings.map((b) => b.name), ["SITES"]);
});

test("the platform unlocks the site's own keys at publish and gives them to that site; no note route is left", () => {
  const v = between("async function siteReadVars(", "\n}\n");
  for (const re of [/SELECT name, cipher FROM _secrets/, /siteAppConn\(env, slug\)/, /ownerEmail\(env, owner\.uid\)/, /SITE_TABLES: JSON\.stringify\(spec\.tables\)/]) assert.match(v, re);
  // The spam check's flag, the follow-ups' spec and the owner-notify switch went with the prebuilt features (2026-10-29).
  assert.doesNotMatch(v, /TURNSTILE_PLATFORM_FLAG|SITE_SPEC: JSON\.stringify|siteNotifyOn\(/);
  assert.doesNotMatch(v, /SITE_SECRETS_KEY|SUPABASE_SERVICE_KEY|gatewaySecretOf/);
  assert.match(between("async function uploadScriptOnce(", "\n}\n"), /if \(preview\) return \{ bucket, vars, secrets: null \};[\s\S]*return \{ bucket, vars, secrets \};/);
  assert.doesNotMatch(W, /\/api\/site-effect/);
});

// The template's own save and follow-ups, run for real: transpiled into the
// template folder so the copied modules resolve.
import path from "node:path";
import { loadTemplate } from "./fixtures/template-ts.mjs";

// 2026-10-29: the prebuilt follow-ups were deleted; what follows a write is the
// model's own server code, fired by lib/site-row-hooks.ts.
test("the server saves rows only with its own bucket and its form settings, and fires the site's own hooks", () => {
  const src = fs.readFileSync(new URL("../builder/lovable/template/src/server.ts", import.meta.url), "utf8");
  assert.match(src, /!env\.SITE_TABLES \|\| env\.OWN_BUCKET !== "1" \|\| !env\.SITES\) return null/);
  assert.match(src, /rowHooks\(env as unknown as FnEnv, ctx/);
  assert.doesNotMatch(src, /runSiteEffects\(/);
  assert.doesNotMatch(src, /EFFECT_KEY|site-effect\b(?!s)/);
});

// ── logins (2026-10-27) ─────────────────────────────────────────────────────
test("the site signs its visitors in with its own auth server, and keeps the session cookie to its own API paths", async () => {
  // The handler alone is what is run here, with this test's slug (loading the
  // whole server.ts would bind the template's own placeholder slug).
  const { ownAuth } = await (async () => {
    const src = fs.readFileSync(new URL("../builder/lovable/template/src/server.ts", import.meta.url), "utf8");
    const a = src.indexOf("export async function ownAuth"), b = src.indexOf("\n}\n", a) + 3;
    const cookie = fs.readFileSync(new URL("../site-cookie.mjs", import.meta.url), "utf8");
    const lim = fs.readFileSync(new URL("../builder/lovable/template/src/lib/site-limit.ts", import.meta.url), "utf8").replace(/^export /gm, "");
    const body = cookie + "\n" + lim + "\nconst SITE_SLUG = 'ember-cart';\n" + src.slice(a, b);
    const js = ts.transpileModule(body, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    return import("data:text/javascript," + encodeURIComponent(js + "\n// a" + ++loads));
  })();
  const seen = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (u, init = {}) => {
    seen.push([String(u), init.method, new Headers(init.headers).get("cookie")]);
    return new Response('{"user":{"id":"u1"}}', { status: 200, headers: { "content-type": "application/json", "set-cookie": "session=abc; Domain=auth.example; Path=/; HttpOnly; Secure", "set-auth-jwt": "eyJ.jwt.x" } });
  };
  try {
    const env = { AUTH_BASE: "https://auth.example", SITE_TABLES: "[]" };
    const url = new URL("https://ember-cart.gofarther.app/api/db/ember-cart/auth/sign-in/email");
    const r = await ownAuth(new Request(url, { method: "POST", headers: { "content-type": "application/json", cookie: "old=1" }, body: '{"email":"a@b.c","password":"x"}' }), env, url);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("x-site-data"), "own");
    assert.deepEqual(seen.at(-1), ["https://auth.example/sign-in/email", "POST", "old=1"]);
    assert.equal(r.headers.get("set-cookie"), "session=abc; HttpOnly; Secure; Path=/api/db/ember-cart/");
    assert.equal(r.headers.get("set-auth-jwt"), "eyJ.jwt.x");
    const other = new URL("https://ember-cart.gofarther.app/api/db/other/auth/sign-in/email");
    assert.equal(await ownAuth(new Request(other, { method: "POST", body: "{}" }), env, other), null);
    assert.equal(await ownAuth(new Request(url, { method: "POST", body: "{}" }), { AUTH_BASE: "https://auth.example" }, url), null, "not a site of the new kind");
  } finally { globalThis.fetch = real; }
});

test("a visitor's sign-in is the site's too (2026-10-28: the site's own Worker)", () => {
  const route = between("A VISITOR'S CALL TO A SITE IS THE SITE'S", "return siteAnswers(env, request, vslug);");
  assert.ok(route.includes("auth\\/"));
  assert.doesNotMatch(W, /return proxySiteService\(env, request, url, slug, apath, "auth"\);/);
});

// ── files: the owner's uploads, hosted media and visitors' uploads (2026-10-27) ──
function r2() {
  const m = new Map();
  const meta = (k) => { const v = m.get(k); return v && { size: v.bytes.length, etag: v.etag, httpEtag: '"' + v.etag + '"', uploaded: new Date(0), httpMetadata: { contentType: v.ct }, customMetadata: v.cm || {} }; };
  return {
    m,
    async head(k) { return m.has(k) ? meta(k) : null; },
    async get(k, o) {
      if (!m.has(k)) return null;
      let b = m.get(k).bytes;
      if (o && o.range) b = b.slice(o.range.offset, o.range.offset + o.range.length);
      return { ...meta(k), body: new Blob([b]).stream() };
    },
    async put(k, v, o = {}) { const bytes = typeof v === "string" ? new TextEncoder().encode(v) : new Uint8Array(v); m.set(k, { bytes, etag: "e" + bytes.length, ct: o.httpMetadata && o.httpMetadata.contentType, cm: o.customMetadata }); },
    async list({ prefix }) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key, ...meta(key) })), truncated: false }; },
  };
}

test("the site serves its owner's media with byte ranges and its visitors' files, only on its own path", async () => {
  const { serveUpload } = await loadTemplate("lib/site-files.ts");
  const B = r2();
  await B.put("uploads/ember-cart/clip.mp4", new Uint8Array(100), { httpMetadata: { contentType: "video/mp4" } });
  await B.put("vuploads/ember-cart/abc.png", new Uint8Array(10), { httpMetadata: { contentType: "image/png" } });
  const env = { SITES: B, OWN_BUCKET: "1" };
  const at = (p, h) => { const u = new URL("https://ember-cart.gofarther.app" + p); return [new Request(u, { headers: h }), env, u, "ember-cart"]; };
  const full = await serveUpload(...at("/u/ember-cart/clip.mp4"));
  assert.equal(full.status, 200);
  assert.equal(full.headers.get("x-site-data"), "own");
  assert.equal((await full.arrayBuffer()).byteLength, 100);
  const part = await serveUpload(...at("/u/ember-cart/clip.mp4", { range: "bytes=10-19" }));
  assert.equal(part.status, 206);
  assert.equal((await part.arrayBuffer()).byteLength, 10);
  assert.equal((await serveUpload(...at("/u/ember-cart/abc.png"))).status, 200, "a visitor's file");
  assert.equal((await serveUpload(...at("/u/ember-cart/missing.png"))).status, 404);
  assert.equal(await serveUpload(...at("/u/other-site/clip.mp4")), null, "another site's path is not this site's to answer");
  assert.equal(await serveUpload(new Request("https://x/u/ember-cart/clip.mp4"), { SITES: B }, new URL("https://x/u/ember-cart/clip.mp4"), "ember-cart"), null, "not on its own bucket");
});

test("a visitor's image goes into the site's own bucket under vuploads/, checked by the platform's own rules", async () => {
  const { visitorUpload } = await loadTemplate("lib/site-files.ts");
  const B = r2();
  const tables = [{ name: "applications", access: "collect", columns: [{ name: "photo", type: "image" }] }, { name: "menu", access: "display" }];
  const env = { SITES: B, OWN_BUCKET: "1", SITE_TABLES: JSON.stringify(tables) };
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]);
  const post = (t, body = png) => { const u = new URL("https://ember-cart.gofarther.app/api/db/ember-cart/uploads?table=" + t); return [new Request(u, { method: "POST", body }), env, u, "ember-cart"]; };
  const ok = await visitorUpload(...post("applications"));
  const j = await ok.json();
  assert.equal(ok.status, 201, JSON.stringify(j));
  assert.match(j.url, /^\/u\/ember-cart\/[0-9a-f]+\.png$/);
  assert.deepEqual([...B.m.keys()].map((k) => k.split("/").slice(0, 2).join("/")), ["vuploads/ember-cart"]);
  assert.equal((await visitorUpload(...post("menu"))).status, 403, "a table that takes no files");
  assert.equal((await visitorUpload(...post("applications", new Uint8Array([1, 2, 3])))).status, 415, "not an image");
});

test("on the site's own address its files are the site's, after the host tie; the app's address keeps the builder's (2026-10-28)", () => {
  const files = W.slice(W.indexOf("// THE SITE SERVES ITS OWN FILES"), W.indexOf("// THE SITE SERVES ITS OWN FILES") + 800);
  assert.match(files, /um && uploadHost !== "\*" && uploadHost === um\[1\]\.toLowerCase\(\)\) return siteAnswers\(env, request, uploadHost\)/);
  // A visitor's upload goes through the one visitor route.
  assert.match(between("A VISITOR'S CALL TO A SITE IS THE SITE'S", "return siteAnswers(env, request, vslug)"), /uploads/);
});

// ── payments: checkout and Stripe's message, with the owner's own Stripe (2026-10-27) ──
async function stripeSig(secret, raw, t = Math.floor(Date.now() / 1000)) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(t + "." + raw));
  return "t=" + t + ",v1=" + [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

test("the site serves its own robots, sitemap and redirects, with its own origin", async () => {
  const { siteSeoFile, siteRedirect, absolutized } = await loadTemplate("lib/site-addresses.ts");
  const store = {
    "builds/x/v1/client/robots.txt": "User-agent: *\nSitemap: https://__SITE_ORIGIN__/sitemap.xml\n",
    "sitemeta/x.json": JSON.stringify({ routesCsv: "/,/menu", redirectsCsv: "/gallery=/" }),
  };
  const env = { SITES: { get: async (k) => (k in store ? { text: async () => store[k] } : null) } };
  const r = await siteSeoFile(new Request("https://x.gofarther.app/robots.txt"), env, new URL("https://x.gofarther.app/robots.txt"), ["builds/x/v1/client", null]);
  assert.equal(r.headers.get("x-site-data"), "own");
  assert.match(await r.text(), /Sitemap: https:\/\/x\.gofarther\.app\/sitemap\.xml/);
  // The workspace address keeps the platform's mount.
  assert.equal(await siteSeoFile(new Request("https://gofarther.dev/robots.txt"), env, new URL("https://gofarther.dev/robots.txt"), ["builds/x/v1/client"]), null);
  const m = await siteRedirect(env, new URL("https://shop.example.com/gallery?ref=a"), "x");
  assert.equal(m.status, 301);
  assert.equal(m.headers.get("location"), "https://shop.example.com/?ref=a");
  assert.equal(m.headers.get("x-site-data"), "own");
  assert.equal(await siteRedirect(env, new URL("https://x.gofarther.app/nope"), "x"), null);
  assert.equal(await siteRedirect(env, new URL("https://x.gofarther.app/gallery.js"), "x"), null);
  store["sitemeta/x.json"] = '{"held":"absent"}';
  assert.equal(await siteRedirect(env, new URL("https://x.gofarther.app/gallery"), "x"), null);
  const a = await absolutized(new Response('<script src="./assets/a.js"></script>', { headers: { "content-type": "text/html" } }), new URL("https://x.gofarther.app/shop/item"), "x");
  assert.equal(await a.text(), '<script src="/assets/a.js"></script>');
  assert.equal(a.headers.get("x-site-data"), "own");
});

test("the platform passes a site's own answer through untouched, and lets it serve robots on its own hosts", () => {
  assert.match(W, /res\.headers\.get\("x-site-data"\) === "own"\) return res;/);
  assert.match(W, /\(rest !== "robots\.txt" && rest !== "sitemap\.xml"\) \|\| !isAppHostname\(url\.hostname\)/);
  const S = fs.readFileSync(new URL("../builder/lovable/template/src/server.ts", import.meta.url), "utf8");
  assert.match(S, /page\.status === 404 && !previewing/);
  assert.match(S, /return absolutized\(page, url, SITE_SLUG\)/);
});

test("the site stores its own error reports and counts its own visits, in its own database", async () => {
  const { siteError, countVisit } = await loadTemplate("lib/site-telemetry.ts");
  const sent = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (u, init) => { sent.push({ u: String(u), body: JSON.parse(init.body), conn: init.headers["Neon-Connection-String"] }); return Response.json({ rows: [] }); };
  try {
    const env = { APP_CONN: "postgresql://x_app:p@ep-1.neon.tech/x" };
    const url = new URL("https://x.gofarther.app/api/db/x/error");
    const r = await siteError(new Request(url, { method: "POST", body: JSON.stringify({ message: "boom", source: "evil", route: "/book" }) }), env, url, "x");
    assert.equal(r.status, 204);
    assert.equal(r.headers.get("x-site-data"), "own");
    assert.match(sent[0].body.query, /^INSERT INTO _errors/);
    assert.deepEqual(sent[0].body.params.slice(1), [null, "/book", "onerror"]);
    assert.equal(sent[0].conn, env.APP_CONN);
    assert.equal(await siteError(new Request(url, { method: "POST" }), {}, url, "x"), null);
    const waits = [];
    const ctx = { waitUntil: (p) => waits.push(p) };
    const page = (ct = "text/html") => new Response("<p>", { headers: { "content-type": ct } });
    const pu = new URL("https://x.gofarther.app/menu");
    countVisit(new Request(pu, { headers: { "CF-Connecting-IP": "1.2.3.4" } }), env, page(), pu, "x", ctx);
    countVisit(new Request(pu, { headers: { "User-Agent": "Googlebot" } }), env, page(), pu, "x", ctx);
    countVisit(new Request(pu), env, page("text/css"), pu, "x", ctx);
    countVisit(new Request(pu), env, new Response("", { status: 404, headers: { "content-type": "text/html" } }), pu, "x", ctx);
    await Promise.all(waits);
    const visits = sent.filter((s) => /_hits/.test(s.body.query));
    assert.equal(visits.length, 1);
    assert.equal(visits[0].body.params[1], "/menu");
    assert.match(visits[0].body.params[0], /^[0-9a-f]{32}$/);
  } finally { globalThis.fetch = realFetch; }
});

test("reports go to the site, the platform makes the two tables, and the stats read the site's own visits (2026-10-28)", () => {
  assert.match(between("A VISITOR'S CALL TO A SITE IS THE SITE'S", "return siteAnswers(env, request, vslug)"), /\|error\|/);
  assert.match(between("async function siteReadVars(", "\n}\n"), /for \(const q of \[ERRORS_TABLE_SQL, HITS_TABLE_SQL\]\)/);
  assert.match(W, /try \{ return await readOwnHits\(conn\); \}/);
  assert.match(between("async function readOwnHits(", "\n}\n"), /FROM _hits/);
});

function fakeBucket() {
  const m = new Map();
  let n = 0;
  return {
    m,
    get: async (k) => (m.has(k) ? { etag: m.get(k).etag, text: async () => m.get(k).v } : null),
    put: async (k, v, o = {}) => {
      const cur = m.get(k);
      if (o.onlyIf && o.onlyIf.etagDoesNotMatch === "*" && cur) return null;
      if (o.onlyIf && o.onlyIf.etagMatches && (!cur || cur.etag !== o.onlyIf.etagMatches)) return null;
      const etag = "e" + ++n;
      m.set(k, { v: String(v), etag, uploaded: new Date() });
      return { etag };
    },
    delete: async (k) => { m.delete(k); },
    list: async ({ prefix }) => ({ objects: [...m.keys()].filter((k) => k.startsWith(prefix)).sort().map((key) => ({ key, uploaded: m.get(key).uploaded })), truncated: false }),
  };
}

// 2026-10-29: the prebuilt jobs went; the platform keeps only the clock that
// wakes each site's own `tick` and `cron:` hooks (lib/site-row-hooks.ts).
test("the platform keeps only the clock: no job registry, no jobs table, no run-now", () => {
  assert.equal((W.match(/fwd\.headers\.delete\(SITE_JOB_HEADER\)/g) || []).length, 3);
  assert.match(W, /fwd\.headers\.set\(PREVIEW_HEADER, "1"\); fwd\.headers\.delete\(SITE_JOB_HEADER\)/);
  for (const gone of ["runScheduledSiteJobs", "function jobDeps", "runJobAnywhere", "recordJobOutcome", "runJob(", "async function persistSiteJobs(", "FROM _jobs", "UPDATE _jobs SET enabled", '/__gf/job", { method: "POST"']) assert.ok(!W.includes(gone), gone);
  assert.match(W, /ctx\.waitUntil\(runSiteTicks\(env\)/);
  assert.match(W, /\/__gf\/tick", \{ method: "POST"/);
});
test("a key the owner saves or removes reaches the site's script at once, and a platform name never does", async () => {
  const { setSiteSecret } = await import("../builder/site-dispatch.mjs");
  const seen = [];
  const fetch = async (u, init) => { seen.push({ u, method: init.method, body: init.body }); return new Response("{}", { status: 200 }); };
  const c = { accountId: "a", namespace: "n", name: "site-x", apiToken: "t" };
  assert.equal((await setSiteSecret({ ...c, secret: "RESEND_KEY", text: "re_1" }, { fetch })).ok, true);
  assert.equal(seen[0].method, "PUT");
  assert.match(seen[0].u, /\/dispatch\/namespaces\/n\/scripts\/site-x\/secrets$/);
  assert.deepEqual(JSON.parse(seen[0].body), { name: "RESEND_KEY", text: "re_1", type: "secret_text" });
  await setSiteSecret({ ...c, secret: "RESEND_KEY", text: null }, { fetch });
  assert.equal(seen[1].method, "DELETE");
  assert.match(seen[1].u, /\/secrets\/RESEND_KEY$/);
  assert.equal((await setSiteSecret({ ...c, secret: "SUPABASE_SERVICE_KEY", text: "x" }, { fetch })).ok, false);
  assert.equal(seen.length, 2);
  assert.match(W, /if \(d && d\.ok\) ctx\.waitUntil\(pushSiteSecret\(env, sslug, sk\[2\], null\)\)/);
});

test("an owner's key goes to their site's Worker; we keep only its name and hint, and republishing keeps it", async () => {
  const { saveSiteKey, WORKER_HELD } = await import("../site-secrets.mjs");
  const rows = [];
  const deps = { list: async () => rows, put: async (_s, name, cipher, hint) => rows.push({ name, cipher, hint }) };
  const pushed = [];
  const ok = await saveSiteKey(deps, { slug: "x", name: "resend key", value: " re_abcdef1234 ", push: async (n, v) => { pushed.push([n, v]); return 1; } });
  assert.deepEqual(ok, { ok: true, name: "RESEND_KEY", replaced: false });
  assert.deepEqual(pushed, [["RESEND_KEY", "re_abcdef1234"]]);
  assert.equal(rows[0].cipher, WORKER_HELD, "no ciphertext, no value");
  assert.equal(rows[0].hint.last4, "1234");
  const none = await saveSiteKey({ list: async () => [], put: async () => assert.fail("stored without a script") }, { slug: "x", name: "K", value: "v", push: async () => 0 });
  assert.equal(none.status, 409);
  const refused = await saveSiteKey({ list: async () => [], put: async () => assert.fail("stored a platform name") }, { slug: "x", name: "SUPABASE_SERVICE_KEY", value: "v", push: async () => "refused" });
  assert.equal(refused.ok, false);
  const m = await metaOf({});
  assert.deepEqual(m.keep_bindings, ["secret_text"]);
  const S = fs.readFileSync(new URL("../site-secrets.mjs", import.meta.url), "utf8");
  const save = S.slice(S.indexOf("export async function saveSiteKey"));
  assert.doesNotMatch(save, /encryptSecret/);
});

test("the platform no longer encrypts a new key, and forgets an old one once the script holds it", () => {
  assert.doesNotMatch(W, /addSecret\(/);
  assert.match(W, /saveSiteKey\(vault, \{ slug: sslug, name: sb\.name, value: sb\.value, push: \(n, v\) => pushSiteSecret\(env, sslug, n, v\) \}\)/);
  assert.match(between("async function siteReadVars(", "\n}\n"), /r\.cipher === WORKER_HELD\) continue;/);
  assert.match(W, /if \(r\.ok && !preview && legacyKeys\.length\) await forgetLegacyKeys\(env, slug, legacyKeys\);/);
});
