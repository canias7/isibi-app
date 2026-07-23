// Batch 305 — HEALTH-CHECK REGISTRY. Named checks report up/degraded/down; a public read rolls them into one
// overall status (down beats degraded beats up). Covers upsert, roll-up precedence, empty, delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 305");
const slug = "b305";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const set = (tok, body) => c.post(`/api/db/${slug}/health-checks`, body, tok === null ? {} : { token: tok });
const get = () => c.get(`/api/db/${slug}/health-checks`).then((r) => r.json);
const del = (tok, name) => c.del(`/api/db/${slug}/health-checks/${name}`, { token: tok });

// --- Empty → unknown ---
t.eq((await get()).overall, "unknown", "no checks → overall unknown");

// --- All up ---
await set(A, { name: "db", status: "up" });
await set(A, { name: "cache", status: "up", message: "warm" });
t.eq((await get()).overall, "up", "all up → overall up");
t.eq((await get()).checks.length, 2, "…two checks listed");

// --- Degraded beats up ---
await set(A, { name: "cache", status: "degraded" });
t.eq((await get()).overall, "degraded", "a degraded check → overall degraded");

// --- Down beats degraded ---
await set(A, { name: "db", status: "down", message: "conn refused" });
t.eq((await get()).overall, "down", "a down check → overall down");
t.ok((await get()).checks.find((c) => c.name === "db").message === "conn refused", "…message stored");

// --- Upsert in place (recover) ---
await set(A, { name: "db", status: "up" });
await set(A, { name: "cache", status: "up" });
t.eq((await get()).overall, "up", "recovering all checks → overall up");

// --- Delete ---
t.eq((await del(A, "cache")).json.deleted, true, "admin deletes a check");
t.eq((await get()).checks.length, 1, "…one remains");

// --- Validation + authz ---
t.eq((await set(A, { name: "x", status: "bogus" })).status, 400, "a bad status → 400");
t.eq((await set(A, { status: "up" })).status, 400, "a missing name → 400");
t.eq((await del(A, "nope")).status, 404, "deleting a missing check → 404");
t.eq((await set(B, { name: "x", status: "up" })).status, 403, "a member can't set → 403");
t.eq((await c.post(`/api/db/${slug}/health-checks`, { name: "x", status: "up" })).status, 401, "signed-out → 401");

t.done(); h.restore();
