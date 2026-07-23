// Batch 254 — EVENT LOG / STREAM. An append-only stream of typed events; readers tail it with an `after`
// cursor. Covers append, cursor-based tail (only-new after cursor), type filter, JSON data round-trip, limit,
// validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 254");
const slug = "b254";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const append = (tok, type, data) => c.post(`/api/db/${slug}/eventlog`, { type, data }, { token: tok }).then((r) => r.json);
const tail = (tok, q) => c.get(`/api/db/${slug}/eventlog${q || ""}`, { token: tok }).then((r) => r.json);

// --- Append events ---
const e1 = (await append(B, "login", { ip: "1.2.3.4" })).id;
await append(B, "click", { btn: "buy" });
await append(A, "login", { ip: "5.6.7.8" });
t.ok(e1, "a member appends an event");

// --- Tail from the start ---
let r = await tail(A);
t.eq(r.events.length, 3, "tail returns all 3 events");
t.eq(r.events[0].type, "login", "…oldest first");
t.ok(r.events[0].data.ip === "1.2.3.4", "…JSON data round-trips");
t.eq(r.cursor, r.events[2].id, "…cursor is the last id");

// --- Cursor: only new events after it ---
const cur = r.cursor;
await append(B, "logout", {});
let r2 = await tail(A, `?after=${cur}`);
t.eq(r2.events.length, 1, "tailing after the cursor returns only the new event");
t.eq(r2.events[0].type, "logout", "…the logout");

// --- No new events → empty, cursor unchanged ---
let r3 = await tail(A, `?after=${r2.cursor}`);
t.eq(r3.events.length, 0, "no new events → empty");
t.eq(r3.cursor, r2.cursor, "…cursor holds steady");

// --- Type filter ---
t.eq((await tail(A, "?type=login")).events.length, 2, "type filter → 2 logins");

// --- Limit ---
t.eq((await tail(A, "?limit=2")).events.length, 2, "limit caps the batch");

// --- Validation + authz ---
t.eq((await c.post(`/api/db/${slug}/eventlog`, { data: {} }, { token: B })).status, 400, "missing type → 400");
t.eq((await c.post(`/api/db/${slug}/eventlog`, { type: "x" })).status, 401, "signed-out append → 401");
t.eq((await tail(B)).status ?? 403, 403, "a member can't tail the stream → 403");
t.eq((await c.get(`/api/db/${slug}/eventlog`, { token: B })).status, 403, "…confirmed 403");
t.eq((await c.get(`/api/db/${slug}/eventlog`)).status, 401, "signed-out tail → 401");

t.done(); h.restore();
