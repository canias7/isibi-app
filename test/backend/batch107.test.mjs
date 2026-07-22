// Batch 107 — full-site export: GET /api/db/<slug>/export → every table's rows in one JSON bundle (admin)
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 107");
const slug = "b107";
await c.ensure(slug);
await c.schema(slug, { tables: {
  posts: { access: "feed", columns: [{ name: "title", type: "text" }] },              // public read, member writes own
  docs: { access: "admin", columns: [{ name: "body", type: "text" }] },               // admin writes
  notes: { access: "user", columns: [{ name: "text", type: "text" }] },               // per-member private
  settings: { access: "admin", columns: [{ name: "meta", type: "json" }] },           // json column → must round-trip parsed
} });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9", { display_name: "Boss" })).json.token;
const USER = (await c.signup(slug, "user@x.dev", "Str0ng-pass-9")).json.token;

await c.post(`/api/db/${slug}/rows/posts`, { title: "P1" }, { token: ADMIN });
await c.post(`/api/db/${slug}/rows/posts`, { title: "P2" }, { token: USER });
await c.post(`/api/db/${slug}/rows/docs`, { body: "D1" }, { token: ADMIN });
await c.post(`/api/db/${slug}/rows/notes`, { text: "N1" }, { token: USER });
await c.post(`/api/db/${slug}/rows/settings`, { meta: { tier: "gold", n: 3 } }, { token: ADMIN });

// Admin gets the whole dataset in one call.
let ex = await c.get(`/api/db/${slug}/export`, { token: ADMIN });
t.eq(ex.status, 200, "admin export → 200");
t.ok(ex.json.ok && typeof ex.json.exported_at === "string", "bundle carries ok + exported_at");
t.ok(ex.json.tables && ex.json.tables.posts && ex.json.tables.docs && ex.json.tables.notes && ex.json.tables.settings, "every declared table is present");
t.eq(ex.json.tables.posts.length, 2, "both posts exported (across owners)");
t.eq(ex.json.tables.docs.map((r) => r.body), ["D1"], "admin-table rows included");
t.eq(ex.json.tables.notes.map((r) => r.text), ["N1"], "user-table rows included (admin sees all)");
// json column comes back parsed, not a string.
t.eq(ex.json.tables.settings[0].meta.tier, "gold", "json column round-trips parsed");

// Members are listed with SAFE columns only — never a password hash.
t.ok(Array.isArray(ex.json.users) && ex.json.users.length === 2, "members enumerated");
const admU = ex.json.users.find((u) => u.email === "admin@x.dev");
t.ok(admU && admU.role === "admin" && admU.verified === false, "member row: email+role+verified");
const leak = ex.json.users.some((u) => "password" in u || "password_hash" in u || "pass_hash" in u);
t.ok(!leak, "no password/hash leaked in the member list");
t.ok(!JSON.stringify(ex.json.tables._users || {}).includes("hash"), "no _users hash column smuggled via tables");

// limit param caps rows per table.
let lim = await c.get(`/api/db/${slug}/export?limit=1`, { token: ADMIN });
t.eq(lim.json.tables.posts.length, 1, "?limit=1 caps rows per table");

// Guards.
t.eq((await c.get(`/api/db/${slug}/export`, { token: USER })).status, 403, "non-admin member → 403");
t.eq((await c.get(`/api/db/${slug}/export`)).status, 401, "signed-out → 401");
t.eq((await c.post(`/api/db/${slug}/export`, {}, { token: ADMIN })).status, 404, "export is GET-only (POST falls through)");

t.done(); h.restore();
