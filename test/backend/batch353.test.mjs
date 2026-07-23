// Batch 353 — ID GENERATE. Stateless uuid / ulid / short / nano id generator with batch + prefix.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 353");
const slug = "b353";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token;
const gen = (tok, body) => c.post(`/api/db/${slug}/id-generate`, body, tok === null ? {} : { token: tok });

// --- UUID ---
let r = (await gen(A, { type: "uuid" })).json;
t.eq(r.ids.length, 1, "one id by default");
t.ok(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(r.ids[0]), "…a valid uuid v4 shape");

// --- Batch + uniqueness ---
r = (await gen(A, { type: "uuid", count: 10 })).json;
t.eq(r.ids.length, 10, "batch of 10");
t.eq(new Set(r.ids).size, 10, "…all unique");

// --- ULID: 26 chars, time-sortable (later ≥ earlier) ---
const a = (await gen(A, { type: "ulid" })).json.ids[0];
const b = (await gen(A, { type: "ulid" })).json.ids[0];
t.eq(a.length, 26, "ulid is 26 chars");
t.ok(b >= a, "…later ulids sort after earlier ones");

// --- Short id with size ---
r = (await gen(A, { type: "short", size: 8 })).json;
t.eq(r.ids[0].length, 8, "short id honors size");
t.ok(/^[0-9A-Za-z]+$/.test(r.ids[0]), "…base62 charset");

// --- Nano is url-safe ---
r = (await gen(A, { type: "nano", size: 21 })).json;
t.ok(/^[0-9A-Za-z_-]{21}$/.test(r.ids[0]), "nano id is url-safe");

// --- Prefix ---
r = (await gen(A, { type: "uuid", prefix: "usr_" })).json;
t.ok(r.ids[0].startsWith("usr_"), "prefix is prepended");

// --- Validation + authz ---
t.eq((await gen(A, { type: "bogus" })).status, 400, "an unknown type → 400");
t.eq((await c.post(`/api/db/${slug}/id-generate`, { type: "uuid" })).status, 401, "signed-out → 401");

t.done(); h.restore();
