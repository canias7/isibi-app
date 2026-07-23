// Batch 222 — PER-USER DASHBOARD TILES. Each member stores their own dashboard layout (a JSON blob).
// Covers save + read round-trip, per-user isolation, update, reset, arbitrary JSON shape, size cap,
// validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 222");
const slug = "b222";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const save = (tok, tiles) => c.post(`/api/db/${slug}/dashboard`, { tiles }, tok === null ? {} : { token: tok });
const read = (tok) => c.get(`/api/db/${slug}/dashboard`, { token: tok }).then((r) => r.json);
const reset = (tok) => c.del(`/api/db/${slug}/dashboard`, { token: tok }).then((r) => r.json);

// --- Save + read round-trip ---
t.eq((await read(A)).tiles, null, "no layout saved yet → null");
const layout = [{ id: "sales", x: 0, y: 0, w: 2 }, { id: "traffic", x: 2, y: 0, w: 1 }];
t.eq((await save(A, layout)).json.saved, true, "member saves a layout");
t.eq((await read(A)).tiles.length, 2, "…reads back 2 tiles");
t.eq((await read(A)).tiles[0].id, "sales", "…with the tile shape preserved");

// --- Per-user isolation ---
await save(B, [{ id: "only-b" }]);
t.eq((await read(B)).tiles[0].id, "only-b", "B has their own layout");
t.eq((await read(A)).tiles.length, 2, "…A's is untouched");

// --- Update ---
await save(A, [{ id: "sales" }]);
t.eq((await read(A)).tiles.length, 1, "saving again replaces the layout");

// --- Arbitrary JSON shape (object, not array) ---
await save(A, { theme: "dark", cols: 3 });
t.eq((await read(A)).tiles.theme, "dark", "an object layout works too");

// --- Reset ---
t.eq((await reset(A)).reset, true, "member resets their dashboard");
t.eq((await read(A)).tiles, null, "…back to null");

// --- Validation + authz ---
t.eq((await c.post(`/api/db/${slug}/dashboard`, {}, { token: A })).status, 400, "missing tiles → 400");
const big = "x".repeat(200000);
t.eq((await save(A, big)).status, 400, "an oversized layout → 400");
t.eq((await c.get(`/api/db/${slug}/dashboard`)).status, 401, "signed-out read → 401");
t.eq((await save(null, [{ id: "x" }])).status, 401, "signed-out save → 401");
t.eq((await c.del(`/api/db/${slug}/dashboard`)).status, 401, "signed-out reset → 401");

t.done(); h.restore();
