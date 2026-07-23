// Batch 370 — ROLLING UNIQUES. Exact distinct-value counter per stream. Member records (deduped); anyone reads
// the distinct count, optionally windowed by `since`; admin resets. Covers dedup, isolation, window, reset, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 370");
const slug = "b370";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const rec = (tok, stream, value) => c.post(`/api/db/${slug}/rolling-uniques/${stream}`, { value }, { token: tok });
const read = (stream, qs = "") => c.get(`/api/db/${slug}/rolling-uniques/${stream}${qs}`).then((r) => r.json);

// --- Record + dedup ---
let r = (await rec(B, "visitors", "user-1")).json;
t.eq(r.added, true, "a new value is added");
t.eq(r.distinct, 1, "…distinct = 1");
t.eq((await rec(B, "visitors", "user-1")).json.added, false, "the same value again is not added");
t.eq((await rec(B, "visitors", "user-1")).json.distinct, 1, "…distinct stays 1");
await rec(B, "visitors", "user-2");
t.eq((await rec(B, "visitors", "user-3")).json.distinct, 3, "distinct climbs with new values");

// --- Read (public) ---
t.eq((await read("visitors")).distinct, 3, "public read returns the distinct count");

// --- Stream isolation ---
await rec(B, "devices", "d-1");
t.eq((await read("devices")).distinct, 1, "another stream is independent");

// --- Window: values before a cutoff excluded. White-box: age one row. ---
h.getDb(uuid).prepare("UPDATE _uniques SET seen_at=? WHERE stream=? AND value=?").run("2000-01-01T00:00:00.000Z", "visitors", "user-1");
t.eq((await read("visitors", "?since=2020-01-01")).distinct, 2, "the window excludes an old value");
t.eq((await read("visitors")).distinct, 3, "…full count still 3");

// --- Reset (admin) ---
t.eq((await c.del(`/api/db/${slug}/rolling-uniques/visitors`, { token: A })).json.reset, true, "admin resets a stream");
t.eq((await read("visitors")).distinct, 0, "…and it's empty");

// --- Validation + authz ---
t.eq((await c.post(`/api/db/${slug}/rolling-uniques/visitors`, { value: "x" })).status, 401, "signed-out record → 401");
t.eq((await rec(B, "visitors", "")).status, 400, "an empty value → 400");
t.eq((await c.del(`/api/db/${slug}/rolling-uniques/devices`, { token: B })).status, 403, "a member can't reset → 403");
t.eq((await read("visitors", "?since=not-a-date")).ok, false, "a bad since → error");

t.done(); h.restore();
