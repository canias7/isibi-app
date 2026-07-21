// Batch 59 — API keys (app-to-app access) + per-app rate-limit config
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness();
const c = makeClient(worker, h);
const t = makeTally("Batch 59");

// ---------- Part A: API keys ----------
const slug = "b59";
await c.ensure(slug);
await c.schema(slug, {
  tables: {
    posts: { access: "feed", columns: [{ name: "title", type: "text" }] },   // public read, member writes own
    docs: { access: "admin", columns: [{ name: "body", type: "text" }] },     // public read, admin writes
  },
});
// First signup becomes admin.
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const USER = (await c.signup(slug, "user@x.dev", "Str0ng-pass-9")).json.token;

// Mint a key as admin.
let mint = await c.post(`/api/db/${slug}/apikeys`, { label: "backup server" }, { token: ADMIN });
t.ok(mint.status === 200 && mint.json.ok, "mint apikey ok");
const KEY = mint.json.key;
t.ok(/^sk_[a-f0-9]{48}$/.test(KEY || ""), "key is sk_<48 hex>");
const KID = mint.json.id;
t.ok(KID > 0, "mint returns an id");

// List keys — never leaks the secret/hash.
let list = await c.get(`/api/db/${slug}/apikeys`, { token: ADMIN });
t.ok(list.json.ok && list.json.keys.length === 1, "list shows the one key");
const shown = list.json.keys[0];
t.ok(shown.prefix && shown.prefix.startsWith("sk_") && !("key_hash" in shown) && !("key" in shown), "list hides the secret, shows a prefix");

// Use the key to WRITE to a feed table (no Bearer token, just X-API-Key).
let w = await c.post(`/api/db/${slug}/rows/posts`, { title: "via key" }, { headers: { "X-API-Key": KEY } });
t.ok(w.status === 200 && w.json.ok, "API key can write a feed row");
// Row is attributed to the admin the key is bound to.
let rows = (await c.get(`/api/db/${slug}/rows/posts?authors=1`)).json.rows;
t.ok(rows.length === 1, "the feed row exists");

// Key inherits admin role → can write an admin-only table.
let wd = await c.post(`/api/db/${slug}/rows/docs`, { body: "cms entry" }, { headers: { "X-API-Key": KEY } });
t.ok(wd.status === 200 && wd.json.ok, "API key (admin-bound) can write an admin table");

// A plain member (non-admin) can't write the admin table.
let wu = await c.post(`/api/db/${slug}/rows/docs`, { body: "nope" }, { token: USER });
t.ok(wu.status === 403, "non-admin member blocked from admin table");

// A plain member can't mint keys.
let badMint = await c.post(`/api/db/${slug}/apikeys`, { label: "x" }, { token: USER });
t.ok(badMint.status === 403, "non-admin cannot mint keys");

// A garbage key doesn't authenticate → feed write requires a login → 401.
let bogus = await c.post(`/api/db/${slug}/rows/posts`, { title: "x" }, { headers: { "X-API-Key": "sk_deadbeef" } });
t.ok(bogus.status === 401, "malformed key does not authenticate");

// Revoke the key, then it stops working.
let rev = await c.del(`/api/db/${slug}/apikeys/${KID}`, { token: ADMIN });
t.ok(rev.json.ok && rev.json.revoked, "revoke ok");
let afterRev = await c.post(`/api/db/${slug}/rows/posts`, { title: "y" }, { headers: { "X-API-Key": KEY } });
t.ok(afterRev.status === 401, "revoked key no longer authenticates");

// ---------- Part B: per-app rate-limit config ----------
const slug2 = "b59rl";
await c.ensure(slug2);
await c.schema(slug2, {
  rateLimits: { read: 2, write: 1 },
  tables: {
    notes: { access: "collect", columns: [{ name: "msg", type: "text" }] },   // anyone inserts
    wall: { access: "feed", columns: [{ name: "txt", type: "text" }] },        // anyone reads
  },
});
// Write cap = 1 per minute (per IP, whole app).
let pw1 = await c.post(`/api/db/${slug2}/rows/notes`, { msg: "a" });
t.ok(pw1.status === 200, "1st write within cap");
let pw2 = await c.post(`/api/db/${slug2}/rows/notes`, { msg: "b" });
t.ok(pw2.status === 429, "2nd write over the write cap → 429");

// Read cap = 2 per minute (separate bucket from writes).
let r1 = await c.get(`/api/db/${slug2}/rows/wall`);
let r2 = await c.get(`/api/db/${slug2}/rows/wall`);
let r3 = await c.get(`/api/db/${slug2}/rows/wall`);
t.ok(r1.status === 200 && r2.status === 200, "first 2 reads within cap");
t.ok(r3.status === 429, "3rd read over the read cap → 429");

// A fresh app with no config keeps the generous defaults (300/60): several quick writes pass.
const slug3 = "b59def";
await c.ensure(slug3);
await c.schema(slug3, { tables: { logs: { access: "collect", columns: [{ name: "m", type: "text" }] } } });
let okAll = true;
for (let i = 0; i < 5; i++) { const rr = await c.post(`/api/db/${slug3}/rows/logs`, { m: "x" + i }); if (rr.status !== 200) okAll = false; }
t.ok(okAll, "no rate config → default caps let normal traffic through");

t.done();
h.restore();
