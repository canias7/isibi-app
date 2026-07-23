// Batch 399 — SEAT MAP (the 100th round-2 primitive). Reserve individual seats from a named layout; claiming a
// taken seat fails atomically; a group reserve is all-or-nothing. Owner/admin release; public occupancy; admin
// clear. Covers reserve, conflict, group all-or-nothing, release authz, occupancy, per-seat status, clear.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 399");
const slug = "b399";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // member
const reserve = (tok, map, body) => c.post(`/api/db/${slug}/seat-map/${map}/reserve`, body, { token: tok });
const release = (tok, map, seat) => c.post(`/api/db/${slug}/seat-map/${map}/release`, { seat }, { token: tok });

// --- Reserve a single seat ---
let r = (await reserve(B, "showA", { seat: "A1", holder: "Bob" })).json;
t.eq(r.reserved.join(","), "A1", "B reserves A1");

// --- A taken seat conflicts ---
r = await reserve(C, "showA", { seat: "A1" });
t.eq(r.status, 409, "C can't take A1 (already reserved) → 409");

// --- Group reserve (all free) ---
r = (await reserve(C, "showA", { seats: ["A2", "A3", "A4"] })).json;
t.eq(r.reserved.length, 3, "C reserves a block of 3");

// --- Group all-or-nothing: one taken → whole thing rolls back ---
r = await reserve(B, "showA", { seats: ["A5", "A3", "A6"] }); // A3 is taken by C
t.eq(r.status, 409, "a group with any taken seat → 409");
t.eq(r.json.conflicts.join(","), "A3", "…names the conflict");
// A5/A6 must NOT have been left claimed.
t.eq((await c.get(`/api/db/${slug}/seat-map/showA/A5`).then((x) => x.json)).reserved, false, "A5 rolled back (not left claimed)");

// --- Occupancy (public) ---
r = (await c.get(`/api/db/${slug}/seat-map/showA`).then((x) => x.json));
t.eq(r.count, 4, "4 seats occupied (A1-A4)");
t.ok(r.occupied.some((s) => s.seat === "A1" && s.holder === "Bob"), "holder label shown");

// --- Per-seat status ---
t.eq((await c.get(`/api/db/${slug}/seat-map/showA/A1`).then((x) => x.json)).reserved, true, "A1 is reserved");
t.eq((await c.get(`/api/db/${slug}/seat-map/showA/Z9`).then((x) => x.json)).reserved, false, "an empty seat reads free");

// --- Release: only the owner (or admin) ---
t.eq((await release(C, "showA", "A1")).status, 403, "C can't release B's seat → 403");
t.eq((await release(B, "showA", "A1")).json.released, "A1", "B releases their own seat");
t.eq((await c.get(`/api/db/${slug}/seat-map/showA/A1`).then((x) => x.json)).reserved, false, "…and it's free again");
// Admin can release anyone's.
t.eq((await release(A, "showA", "A2")).json.released, "A2", "admin releases C's seat");

// --- Now A1 is free, C can take it ---
t.eq((await reserve(C, "showA", { seat: "A1" })).json.reserved.join(","), "A1", "C takes the freed A1");

// --- Clear the map (admin) ---
t.ok((await c.del(`/api/db/${slug}/seat-map/showA`, { token: A }).then((x) => x.json)).removed >= 1, "admin clears the map");
t.eq((await c.get(`/api/db/${slug}/seat-map/showA`).then((x) => x.json)).count, 0, "…map is empty");

// --- Validation + authz ---
t.eq((await c.post(`/api/db/${slug}/seat-map/showA/reserve`, { seat: "A1" })).status, 401, "signed-out reserve → 401");
t.eq((await reserve(B, "showA", {})).status, 400, "no seat → 400");
t.eq((await c.del(`/api/db/${slug}/seat-map/showA`, { token: B })).status, 403, "a member can't clear → 403");

t.done(); h.restore();
