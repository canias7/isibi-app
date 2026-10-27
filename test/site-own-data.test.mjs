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
  assert.match(between("async function uploadScriptOnce(", "\n}\n"), /const given = await siteReadVars\(env, slug\)/);
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
  for (const re of [/SELECT name, cipher FROM _secrets/, /TURNSTILE_PLATFORM_FLAG/, /SITE_SPEC: JSON\.stringify/, /siteAppConn\(env, slug\)/, /ownerEmail\(env, owner\.uid\)/, /siteNotifyOn\(env, slug\)/, /SITE_TABLES: JSON\.stringify\(spec\.tables\)/]) assert.match(v, re);
  assert.doesNotMatch(v, /SITE_SECRETS_KEY|SUPABASE_SERVICE_KEY|gatewaySecretOf/);
  assert.match(between("async function uploadScriptOnce(", "\n}\n"), /secrets: given \? given\.secrets : null \}/);
  assert.doesNotMatch(W, /\/api\/site-effect/);
});

// The template's own save and follow-ups, run for real: transpiled into the
// template folder so the copied modules resolve.
import path from "node:path";
async function loadTemplate(rel) {
  // The file and every local TypeScript module it imports, transpiled beside
  // the originals (so the copied .mjs modules resolve), then removed.
  const dir = new URL("../builder/lovable/template/src/", import.meta.url);
  const made = [];
  const tag = ++loads;
  const emit = (r) => {
    const src = fs.readFileSync(new URL(r, dir), "utf8");
    let js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    js = js.replace(/from "(\.\/[^"]+?)"/g, (m, spec) => {
      if (spec.endsWith(".mjs")) return m;
      const tsRel = new URL(spec + ".ts", new URL(r, dir)).href.slice(dir.href.length);
      if (fs.existsSync(new URL(tsRel, dir))) { emit(tsRel); return `from "${spec}.__t${tag}.mjs"`; }
      return `from "${spec}.mjs"`;
    });
    const out = new URL(r.replace(/\.ts$/, `.__t${tag}.mjs`), dir);
    if (!made.includes(out.href)) { fs.writeFileSync(out, js); made.push(out.href); }
    return out;
  };
  const top = emit(rel);
  try { return await import(top.href); } finally { for (const f of made) fs.rmSync(new URL(f)); }
}

test("after a booking, the site emails its owner, confirms to the visitor and fires the webhook, with its own keys", async () => {
  const { runSiteEffects, toPg } = await loadTemplate("lib/site-effects.ts");
  assert.equal(toPg("SELECT ? , '?' , ?"), "SELECT $1 , '?' , $2");
  const calls = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (u, init = {}) => {
    const url = String(u);
    calls.push([url, init.method || "GET", init.headers && (init.headers.Authorization || init.headers.authorization || init.headers["Neon-Connection-String"] || "")]);
    if (url.endsWith("/sql")) return new Response(JSON.stringify({ rows: [{ id: 7, name: "Ana", email: "ana@example.com" }] }));
    return new Response("{}", { status: 200 });
  };
  const store = new Map();
  const bucket = { get: async (k) => (store.has(k) ? { text: async () => store.get(k) } : null), put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); } };
  const tables = [{ name: "bookings", access: "collect", notify: true, confirm: { to: "email", subject: "Thanks {name}", body: "See you soon" }, webhooks: ["created"] }];
  const env = { APP_CONN: "postgresql://x_app:p@ep-1.neon.tech/db", OWNER_EMAIL: "owner@example.com", NOTIFY: "1", SITE_TABLES: JSON.stringify(tables), SITES: bucket,
    RESEND_KEY: "re_owner", EMAIL_FROM: "hello@site.com", WEBHOOK_URL: "https://hooks.example/x", WEBHOOK_SECRET: "whs" };
  const waits = [];
  try {
    const fired = await runSiteEffects(env, { waitUntil: (p) => waits.push(p) }, { slug: "ember-cart", method: "POST", path: "bookings", search: "", sent: '{"name":"Ana","email":"ana@example.com"}', body: "" });
    await Promise.all(waits);
    assert.deepEqual(fired.sort(), ["confirm", "notify", "sms", "webhook"]);
    const mail = calls.filter(([u]) => u === "https://api.resend.com/emails");
    assert.ok(mail.length >= 1, "an email went out through the owner's own Resend key");
    assert.ok(mail.every(([, , auth]) => auth === "Bearer re_owner"));
    assert.ok(calls.some(([u]) => u === "https://hooks.example/x"), "the webhook fired");
    assert.ok(calls.every(([u]) => !/gofarther\.dev|supabase/.test(u)), "nothing went to the platform");
    // The cooldown is the site's own: a second booking within five minutes does not email the owner again.
    const before = calls.filter(([u]) => u.includes("resend")).length;
    waits.length = 0;
    await runSiteEffects(env, { waitUntil: (p) => waits.push(p) }, { slug: "ember-cart", method: "POST", path: "bookings", search: "", sent: '{"name":"Bo"}', body: "" });
    await Promise.all(waits);
    assert.ok(store.has("effects/notify/ember-cart"));
    assert.ok(calls.filter(([u]) => u.includes("resend")).length - before <= 1, "at most the confirmation, not a second owner email");
  } finally { globalThis.fetch = real; }
});

test("a table with no settings, or a read, runs nothing", async () => {
  const { runSiteEffects } = await loadTemplate("lib/site-effects.ts");
  const env = { SITE_TABLES: "[]" };
  assert.deepEqual(await runSiteEffects(env, undefined, { slug: "s", method: "POST", path: "bookings", search: "", sent: "{}", body: "" }), []);
  assert.deepEqual(await runSiteEffects({ SITE_TABLES: '[{"name":"bookings","notify":true}]' }, undefined, { slug: "s", method: "GET", path: "bookings", search: "", sent: "", body: "" }), []);
});

test("the server saves rows only with its own bucket and its form settings, and runs the follow-ups itself", () => {
  const src = fs.readFileSync(new URL("../builder/lovable/template/src/server.ts", import.meta.url), "utf8");
  assert.match(src, /!env\.SITE_TABLES \|\| env\.OWN_BUCKET !== "1" \|\| !env\.SITES\) return null/);
  assert.match(src, /runSiteEffects\(env as unknown as EffectEnv, ctx/);
  assert.doesNotMatch(src, /EFFECT_KEY|site-effect\b(?!s)/);
});

// ── logins (2026-10-27) ─────────────────────────────────────────────────────
test("the site signs its visitors in with its own auth server, and keeps the session cookie to its own API paths", async () => {
  const { ownAuth } = await loadTemplate("server.ts").catch(async () => {
    // server.ts imports Start; the handler alone is what is run here.
    const src = fs.readFileSync(new URL("../builder/lovable/template/src/server.ts", import.meta.url), "utf8");
    const a = src.indexOf("export async function ownAuth"), b = src.indexOf("\n}\n", a) + 3;
    const cookie = fs.readFileSync(new URL("../site-cookie.mjs", import.meta.url), "utf8");
    const body = cookie + "\nconst SITE_SLUG = 'ember-cart';\n" + src.slice(a, b);
    const js = ts.transpileModule(body, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    return import("data:text/javascript," + encodeURIComponent(js + "\n// a" + ++loads));
  });
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

test("the platform asks the site first for logins too, with the switch on", () => {
  const at = W.indexOf('return proxySiteService(env, request, url, slug, apath, "auth");');
  const before = W.slice(at - 400, at);
  assert.match(before, /env\.SITE_OWN_DATA === "1" && env\.SITE_WORKERS[\s\S]*ownDataRead\(env, request, slug\)/);
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

test("the platform asks the site first for its files and its visitors' uploads, after the host tie", () => {
  const files = W.slice(W.indexOf("// THE SITE SERVES ITS OWN FILES"), W.indexOf("// THE SITE SERVES ITS OWN FILES") + 500);
  assert.match(files, /uploadHost === "\*" \|\| uploadHost === um\[1\]\.toLowerCase\(\)/);
  assert.match(files, /ownDataRead\(env, request, um\[1\]\.toLowerCase\(\)\)/);
  assert.match(W, /THE SITE TAKES ITS OWN VISITORS' FILES[\s\S]{0,200}ownDataRead\(env, request, vslug\)/);
});

// ── payments: checkout and Stripe's message, with the owner's own Stripe (2026-10-27) ──
async function stripeSig(secret, raw, t = Math.floor(Date.now() / 1000)) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(t + "." + raw));
  return "t=" + t + ",v1=" + [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

test("checkout prices from the site's own rows, writes the order as the site, and opens Stripe with the owner's key", async () => {
  const { siteCheckout } = await loadTemplate("lib/site-pay.ts");
  const sql = [], stripe = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (u, init = {}) => {
    const url = String(u);
    if (url.endsWith("/sql")) {
      const q = JSON.parse(init.body).query;
      sql.push(q);
      if (/^SELECT id/.test(q)) return new Response(JSON.stringify({ rows: [{ id: 1, name: "Flat white", price: 3.5 }] }));
      if (/^INSERT/.test(q)) return new Response(JSON.stringify({ rows: [{ id: 42 }] }));
      return new Response(JSON.stringify({ rows: [] }));
    }
    if (url === "https://api.stripe.com/v1/checkout/sessions") {
      stripe.push(init.headers.Authorization);
      return new Response(JSON.stringify({ id: "cs_1", url: "https://checkout.stripe.com/c/cs_1" }));
    }
    return new Response("{}", { status: 404 });
  };
  try {
    const tables = [{ name: "orders", columns: ["email"], payment: { from: "menu", name: "name", price: "price", currency: "gbp" } }, { name: "menu", access: "display" }];
    const env = { APP_CONN: "postgresql://x_app:p@ep-1.neon.tech/db", SITE_TABLES: JSON.stringify(tables), STRIPE_SECRET_KEY: "sk_owner" };
    const url = new URL("https://ember-cart.gofarther.app/api/db/ember-cart/checkout");
    const r = await siteCheckout(new Request(url, { method: "POST", body: JSON.stringify({ table: "orders", items: [{ id: 1, qty: 2 }], fields: { email: "a@b.c" } }) }), env, url, "ember-cart");
    const j = await r.json();
    assert.equal(r.status, 200, JSON.stringify(j));
    assert.deepEqual([j.url, j.orderId], ["https://checkout.stripe.com/c/cs_1", 42]);
    assert.deepEqual(stripe, ["Bearer sk_owner"]);
    assert.ok(sql.some((q) => /^INSERT INTO "orders"/.test(q)));
    assert.equal(r.headers.get("x-site-data"), "own");
    // Without the owner's key: refused, never another key.
    const r2 = await siteCheckout(new Request(url, { method: "POST", body: JSON.stringify({ table: "orders", items: [{ id: 1, qty: 1 }] }) }), { ...env, STRIPE_SECRET_KEY: undefined }, url, "ember-cart");
    assert.equal(r2.status, 503);
  } finally { globalThis.fetch = real; }
});

test("Stripe's paid message is checked against the owner's secret, then the order is flipped by the site", async () => {
  const { stripeSiteWebhook } = await loadTemplate("lib/site-pay.ts");
  const sql = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (u, init = {}) => {
    if (String(u).endsWith("/sql")) { sql.push(JSON.parse(init.body)); return new Response(JSON.stringify({ rows: [{ id: 42, payment_status: "paid" }] })); }
    return new Response("{}");
  };
  try {
    const tables = [{ name: "orders", payment: { from: "menu", name: "name", price: "price" } }];
    const env = { APP_CONN: "postgresql://x_app:p@ep-1.neon.tech/db", SITE_TABLES: JSON.stringify(tables), STRIPE_WEBHOOK_SECRET: "whsec_owner" };
    const event = { type: "checkout.session.completed", data: { object: { id: "cs_1", payment_status: "paid", client_reference_id: "ember-cart:orders:42", metadata: { slug: "ember-cart", table: "orders", order_id: "42" } } } };
    const raw = JSON.stringify(event);
    const url = new URL("https://gofarther.dev/api/stripe/site/ember-cart");
    const forged = await stripeSiteWebhook(new Request(url, { method: "POST", headers: { "Stripe-Signature": await stripeSig("not-the-owners", raw) }, body: raw }), env, url, "ember-cart");
    assert.equal(forged.status, 400);
    assert.equal(sql.length, 0, "nothing written on a bad signature");
    const ok = await stripeSiteWebhook(new Request(url, { method: "POST", headers: { "Stripe-Signature": await stripeSig("whsec_owner", raw) }, body: raw }), env, url, "ember-cart");
    assert.equal(ok.status, 200, await ok.clone().text());
    const flip = sql.find((q) => /SET payment_status='paid'/.test(q.query));
    assert.ok(flip, "the order was flipped: " + JSON.stringify(sql));
  } finally { globalThis.fetch = real; }
});

test("the platform asks the site first for checkout and for its Stripe messages", () => {
  assert.match(W, /THE SITE TAKES ITS OWN PAYMENTS[\s\S]{0,200}ownDataRead\(env, request, cm\[1\]\.toLowerCase\(\)\)/);
  assert.match(W, /THE SITE HEARS ITS OWN STRIPE MESSAGES[\s\S]{0,200}ownDataRead\(env, request, wslug\)/);
  const v = W.slice(W.indexOf("async function siteReadVars("), W.indexOf("async function siteReadVars(") + 4000);
  assert.match(v, /SELECT name, cipher FROM _secrets/); // every key the site holds, Stripe's included
});

test("the site's own connections and hooks are answered by its Worker first", () => {
  const C = fs.readFileSync(new URL("../builder/lovable/template/src/lib/site-connect.ts", import.meta.url), "utf8");
  for (const re of [/apiFor\(specOf\(env\)/, /missingRequired\(api, params\)/, /callApi\(/, /handleInbound\(/, /"x-site-data": "own"/, /hit\("api\|"/, /hit\("inbound\|"/]) assert.match(C, re);
  assert.doesNotMatch(C, /SUPABASE|SITE_SECRETS_KEY|gofarther/);
  const S = fs.readFileSync(new URL("../builder/lovable/template/src/server.ts", import.meta.url), "utf8");
  assert.match(S, /siteApi\(request[^)]*\)\)[\s|]*\(await siteHook\(/);
  for (const head of ["const aname = am2[2]", "const hname = hm[2]"]) {
    const at = W.indexOf(head);
    assert.ok(at > 0, head);
    assert.match(W.slice(at - 400, at), /SITE_OWN_DATA === "1"\) \{ const mine = await ownDataRead\(env, request, slug\)/);
  }
});

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

test("the platform asks the site first for reports, makes the two tables, and adds the site's own visits", () => {
  const at = W.indexOf("const slug = erm[1].toLowerCase();");
  assert.match(W.slice(at, at + 300), /SITE_OWN_DATA === "1"\) \{ const mine = await ownDataRead\(env, request, slug\)/);
  assert.match(between("async function siteReadVars(", "\n}\n"), /for \(const q of \[ERRORS_TABLE_SQL, HITS_TABLE_SQL\]\)/);
  assert.match(W, /return addHits\(older, mine\);/);
  const addHits = new Function("return " + between("function addHits(a, b) {", "\n}\n") + "\n}")();
  assert.deepEqual(addHits({ views: 2, visitors: 1, views7: 1, visitors7: 1, series: [{ day: "2026-10-26", views: 1 }] },
    { views: 3, visitors: 2, views7: 3, visitors7: 2, series: [{ day: "2026-10-26", views: 2 }, { day: "2026-10-27", views: 1 }] }),
    { views: 5, visitors: 3, views7: 4, visitors7: 3, series: [{ day: "2026-10-26", views: 3 }, { day: "2026-10-27", views: 1 }] });
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

test("a failed webhook is kept in the site's own bucket and retried on the platform's wake, with the owner's own secret", async () => {
  const { queueFailed, drainOwnQueue, siteTick } = await loadTemplate("lib/site-webhook-retry.ts");
  const B = fakeBucket();
  const env = { SITES: B, WEBHOOK_URL: "https://hooks.example.com/in", WEBHOOK_SECRET: "s" };
  assert.equal(await queueFailed(env, { slug: "x", table: "orders", action: "created", out: { sent: false, status: 404, body: "{}", eventId: "e1" } }), null, "a 4xx is not retried");
  assert.equal(await queueFailed(env, { slug: "x", table: "orders", action: "created", out: { sent: false, status: 503, body: '{"a":1}', eventId: "e1", attempts: 3 } }), "queued for retry");
  const row = JSON.parse(B.m.get("webhooks/q/e1.json").v);
  assert.equal(row.status, "pending");
  // Due now.
  B.m.get("webhooks/q/e1.json").v = JSON.stringify({ ...row, next_attempt_at: new Date(Date.now() - 1000).toISOString() });
  const realFetch = globalThis.fetch;
  const posts = [];
  globalThis.fetch = async (u, init) => { posts.push({ u: String(u), init }); return new Response("ok", { status: 200 }); };
  try {
    const out = await drainOwnQueue(env, "x");
    assert.equal(out.delivered, 1, JSON.stringify(out));
    assert.equal(posts[0].u, "https://hooks.example.com/in");
    assert.equal(posts[0].init.body, '{"a":1}', "the exact bytes first sent");
    assert.match(posts[0].init.headers["x-gofarther-signature"], /^v1=/);
    assert.equal(B.m.has("webhooks/q/e1.json"), false);
    // Only the platform's wake reaches it.
    const tu = new URL("https://x.gofarther.app/__gf/tick");
    assert.equal(await siteTick(new Request(tu, { method: "POST" }), env, tu, "x", "x-gf-site-job"), null);
    const t = await siteTick(new Request(tu, { method: "POST", headers: { "x-gf-site-job": "1" } }), env, tu, "x", "x-gf-site-job");
    assert.equal(t.headers.get("x-site-data"), "own");
  } finally { globalThis.fetch = realFetch; }
});

test("a scheduled job runs in the site, with its own function and its owner's own mail key, only when the platform asks", async () => {
  const { siteJob } = await loadTemplate("lib/site-jobs-run.ts");
  const realFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (u, init) => {
    calls.push({ u: String(u), body: init && init.body });
    if (String(u).endsWith("/sql")) return Response.json({ rows: [{ out: JSON.stringify([{ to: "a@b.co", subject: "Hi", body: "x" }]) }] });
    return Response.json({ id: "m1" });
  };
  try {
    const env = { APP_CONN: "postgresql://x_app:p@ep-1.neon.tech/x", RESEND_KEY: "re_k", EMAIL_FROM: "shop@x.co", SITE_SPEC: JSON.stringify({ jobs: [{ name: "remind", fn: "job_remind" }] }) };
    const u = new URL("https://x.gofarther.app/__gf/job");
    const body = JSON.stringify({ name: "remind", spec: { fn: "job_remind" } });
    assert.equal(await siteJob(new Request(u, { method: "POST", body }), env, u), null, "a visitor cannot run it");
    const r = await siteJob(new Request(u, { method: "POST", body, headers: { "x-gf-site-job": "1" } }), env, u);
    assert.equal(r.headers.get("x-site-data"), "own");
    const out = await r.json();
    assert.equal(out.sent, 1, JSON.stringify(out));
    assert.match(JSON.parse(calls[0].body).query, /SELECT "job_remind"\(\) AS out/);
    assert.match(calls[1].u, /resend/);
    const gone = await siteJob(new Request(u, { method: "POST", body: JSON.stringify({ name: "old", spec: { fn: "job_old" } }), headers: { "x-gf-site-job": "1" } }), env, u);
    assert.match((await gone.json()).reason, /no longer part of the site/);
  } finally { globalThis.fetch = realFetch; }
});

test("the platform keeps the clock and the claim, strips its job header from everything it forwards, and wakes sites", () => {
  assert.equal((W.match(/fwd\.headers\.delete\(SITE_JOB_HEADER\)/g) || []).length, 3);
  assert.match(W, /fwd\.headers\.set\(PREVIEW_HEADER, "1"\); fwd\.headers\.delete\(SITE_JOB_HEADER\)/);
  const run = between("async function runJobAnywhere(env, row) {", "\n}\n");
  assert.ok(run.indexOf("deps.stamp(row)") < run.indexOf("siteRunJob(env, row)"), "claimed before the site is asked");
  assert.match(run, /mine \|\| runJob\(\{ \.\.\.deps, stamp: async \(\) => \(\{ won: true \}\) \}, row\)/);
  assert.doesNotMatch(W, /await runJob\(jobDeps\(env, (row|jrow)\), (row|jrow)\);/);
  assert.match(W, /ctx\.waitUntil\(runSiteTicks\(env\)/);
  assert.match(between("async function siteReadVars(", "\n}\n"), /jobs: spec\.jobs \|\| \[\]/);
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
  const post = W.slice(W.indexOf("const r = await addSecret(vault, env"), W.indexOf("const d = await deleteSecret(vault"));
  assert.match(post, /pushSiteSecret\(env, sslug, r\.name, cv\.value\)/);
  assert.match(W, /if \(d && d\.ok\) ctx\.waitUntil\(pushSiteSecret\(env, sslug, sk\[2\], null\)\)/);
});
