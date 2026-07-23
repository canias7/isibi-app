// Batch 359 — TEMPORARY BAN LIST. Admin bans an arbitrary key until a time (or permanently); a public check
// reports banned + seconds remaining; expired bans read as not-banned. Covers ban, check, permanent, expiry,
// re-ban (upsert), lift, list, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 359");
const slug = "b359";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const ban = (tok, body) => c.post(`/api/db/${slug}/bans`, body, { token: tok });
const check = (key) => c.get(`/api/db/${slug}/bans/${key}`).then((r) => r.json);

// --- Ban + check ---
let r = (await ban(A, { key: "abuser-42", seconds: 3600, reason: "spam" })).json;
t.eq(r.permanent, false, "a timed ban is not permanent");
t.ok(r.until, "…has an until time");
let ck = await check("abuser-42");
t.eq(ck.banned, true, "the key is banned");
t.ok(ck.remaining > 3500 && ck.remaining <= 3600, "…with seconds remaining");
t.eq(ck.reason, "spam", "…and the reason");

// --- Unknown key ---
t.eq((await check("nobody")).banned, false, "an unbanned key reads not-banned");

// --- Permanent ban ---
t.eq((await ban(A, { key: "forever" })).json.permanent, true, "no seconds → permanent");
r = await check("forever");
t.eq(r.banned, true, "…and it's banned");
t.eq(r.remaining, null, "…with no expiry");

// --- Expiry: a ban with a past `until` reads not-banned. White-box: set until to the past. ---
await ban(A, { key: "expired", seconds: 60 });
h.getDb(uuid).prepare("UPDATE _bans SET until=? WHERE key=?").run("2000-01-01T00:00:00.000Z", "expired");
r = await check("expired");
t.eq(r.banned, false, "an expired ban reads not-banned");
t.eq(r.reason, null, "…and hides the reason");

// --- Re-ban is an upsert ---
await ban(A, { key: "abuser-42", seconds: 10, reason: "reduced" });
t.eq((await check("abuser-42")).reason, "reduced", "re-banning updates in place (upsert)");

// --- List active ---
let list = (await c.get(`/api/db/${slug}/bans`, { token: A }).then((x) => x.json)).bans;
t.ok(list.some((b) => b.key === "forever"), "active list includes the permanent ban");
t.ok(!list.some((b) => b.key === "expired"), "…and excludes the expired one");

// --- Lift ---
t.eq((await c.del(`/api/db/${slug}/bans/forever`, { token: A })).json.lifted, true, "admin lifts a ban");
t.eq((await check("forever")).banned, false, "…and it's gone");
t.eq((await c.del(`/api/db/${slug}/bans/ghost`, { token: A })).status, 404, "lifting an unknown ban → 404");

// --- Validation + authz ---
t.eq((await ban(A, { key: "bad key!" })).status, 400, "an invalid key → 400");
t.eq((await ban(A, { key: "x", seconds: 0 })).status, 400, "seconds < 1 → 400");
t.eq((await ban(B, { key: "y", seconds: 60 })).status, 403, "a member can't ban → 403");
t.eq((await c.post(`/api/db/${slug}/bans`, { key: "z" })).status, 401, "signed-out → 401");
t.eq((await c.get(`/api/db/${slug}/bans`, { token: B })).status, 403, "a member can't list → 403");

t.done(); h.restore();
