// Batch 339 — CONTACT FREQUENCY CAP. Limit messages to a recipient per window; the cap is supplied per call.
// Covers consume decrementing remaining then denying, per-recipient/channel isolation, check, purge, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 339");
const slug = "b339";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const consume = (tok, body) => c.post(`/api/db/${slug}/frequency-cap/consume`, body, tok === null ? {} : { token: tok }).then((r) => r.json);
const check = (tok, q) => c.get(`/api/db/${slug}/frequency-cap/check${q}`, { token: tok }).then((r) => r.json);
const purge = (tok, body) => c.post(`/api/db/${slug}/frequency-cap/purge`, body || {}, { token: tok });

// --- Consume up to the cap (max 2, big window so it stays in one bucket) ---
const W = 3600;
let r = await consume(B, { recipient: "fan@x.dev", max: 2, window_sec: W });
t.eq(r.allowed, true, "first message allowed");
t.eq(r.remaining, 1, "…1 remaining");
r = await consume(B, { recipient: "fan@x.dev", max: 2, window_sec: W });
t.eq(r.allowed, true, "second allowed (at the cap)");
t.eq(r.remaining, 0, "…0 remaining");
r = await consume(B, { recipient: "fan@x.dev", max: 2, window_sec: W });
t.eq(r.allowed, false, "third denied (over the cap)");

// --- A different recipient is independent ---
t.eq((await consume(B, { recipient: "other@x.dev", max: 2, window_sec: W })).allowed, true, "a different recipient has its own budget");

// --- A different channel is independent ---
t.eq((await consume(B, { recipient: "fan@x.dev", channel: "sms", max: 2, window_sec: W })).allowed, true, "a different channel is separate");

// --- Check without consuming ---
t.eq((await check(B, "?recipient=fan@x.dev&window_sec=" + W)).count, 3, "check reports the current count");
t.eq((await check(B, "?recipient=never@x.dev&window_sec=" + W)).count, 0, "…0 for an unseen recipient");

// --- Purge (admin) ---
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
h.getDb(uuid).prepare("UPDATE _freq_hits SET window_start=? WHERE key LIKE ?").run(1000, "fan@x.dev|default%");
t.ok((await purge(A, { older_than_sec: 0 })).json.purged >= 1, "admin purges old buckets");

// --- Validation + authz ---
t.eq((await c.post(`/api/db/${slug}/frequency-cap/consume`, { recipient: "x", max: 0, window_sec: 60 }, { token: B })).status, 400, "max < 1 → 400");
t.eq((await c.post(`/api/db/${slug}/frequency-cap/consume`, { max: 2, window_sec: 60 }, { token: B })).status, 400, "a missing recipient → 400");
t.eq((await purge(B)).status, 403, "a member can't purge → 403");
t.eq((await c.post(`/api/db/${slug}/frequency-cap/consume`, { recipient: "x", max: 2, window_sec: 60 })).status, 401, "signed-out → 401");

t.done(); h.restore();
