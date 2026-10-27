// A site answers its own visitors' reads (2026-10-27): the upload's two public
// addresses, the platform's fall-through, and the template's own read handler.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { uploadSiteWorker, SITE_PLAIN, SITE_SECRET_NAMES, siteSecretAllowed } from "../builder/site-dispatch.mjs";

async function metaOf(vars, secrets = null, smsNames = []) {
  let form;
  await uploadSiteWorker({ accountId: "a", namespace: "n", name: "site-x", code: "x", bucket: "gfs-x", apiToken: "t", vars, secrets, smsNames },
    { fetch: async (_u, init) => { form = init.body; return new Response(JSON.stringify({ success: true }), { status: 200 }); } });
  return JSON.parse(await form.get("metadata").text());
}

test("the upload gives a script only the named public addresses, never anything else", async () => {
  assert.deepEqual(Object.keys(SITE_PLAIN), ["DATA_API_BASE", "AUTH_BASE", "OWN_BUCKET", "NOTIFY", "OWNER_EMAIL", "SITE_TABLES"]);
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
  assert.ok(SITE_SECRET_NAMES.includes("APP_CONN"));
  // A plain value that is not what its name says is dropped.
  const bad = await metaOf({ OWNER_EMAIL: "not an email", NOTIFY: "yes", OWN_BUCKET: "1x", SITE_TABLES: "{}" });
  assert.deepEqual(bad.bindings.map((b) => b.name), ["SITES"]);
});

test("the platform unlocks the site's own keys at publish and gives them to that site; no note route is left", () => {
  const v = between("async function siteReadVars(", "\n}\n");
  for (const re of [/siteMailSecrets\(env, db, slug\)\(\)/, /siteSmsSecrets\(env, db, slug\)\(\)/, /_webhookSecrets\(slug, env, db\)/, /siteAppConn\(env, slug\)/, /ownerEmail\(env, owner\.uid\)/, /siteNotifyOn\(env, slug\)/, /SITE_TABLES: JSON\.stringify\(spec\.tables\)/]) assert.match(v, re);
  assert.doesNotMatch(v, /SITE_SECRETS_KEY|SUPABASE_SERVICE_KEY|gatewaySecretOf/);
  assert.match(between("async function uploadScriptOnce(", "\n}\n"), /secrets: given \? given\.secrets : null, smsNames: SMS_SECRET_NAMES/);
  assert.doesNotMatch(W, /\/api\/site-effect/);
});

// The template's own save and follow-ups, run for real: transpiled into the
// template folder so the copied modules resolve.
import path from "node:path";
async function loadTemplate(rel) {
  const dir = new URL("../builder/lovable/template/src/", import.meta.url);
  const src = fs.readFileSync(new URL(rel, dir), "utf8");
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
    .replace(/from "(\.\/[^"]+?)(?<!\.mjs)"/g, 'from "$1.mjs"');
  const out = new URL(rel.replace(/\.ts$/, `.__test${++loads}.mjs`), dir);
  fs.writeFileSync(out, js);
  try { return await import(out.href); } finally { fs.rmSync(out); }
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
