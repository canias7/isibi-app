// Batch 250 — RESOURCE / ROOM DOUBLE-BOOK CALENDAR. Book a resource for a window; overlapping bookings for
// the same resource are rejected atomically. Covers book, overlap → 409, adjacent (touching) allowed, free
// check, per-resource isolation, list window, cancel (owner/admin), validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 250");
const slug = "b250";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3
const book = (tok, res, starts, ends, note) => c.post(`/api/db/${slug}/rooms/${res}/book`, { starts, ends, note }, tok === null ? {} : { token: tok });
const free = (res, starts, ends) => c.get(`/api/db/${slug}/rooms/${res}/free?starts=${encodeURIComponent(starts)}&ends=${encodeURIComponent(ends)}`).then((r) => r.json);
const list = (res, q) => c.get(`/api/db/${slug}/rooms/${res}${q || ""}`).then((r) => r.json);
const cancel = (tok, res, id) => c.del(`/api/db/${slug}/rooms/${res}/book/${id}`, { token: tok });

// --- Book a room ---
let r = (await book(B, "room-a", "2026-06-01T10:00:00Z", "2026-06-01T11:00:00Z")).json;
t.ok(r.id, "B books room-a 10–11");
const id1 = r.id;

// --- Overlap → 409 ---
t.eq((await book(C, "room-a", "2026-06-01T10:30:00Z", "2026-06-01T11:30:00Z")).status, 409, "an overlapping booking is rejected");
t.eq((await book(C, "room-a", "2026-06-01T09:30:00Z", "2026-06-01T10:15:00Z")).status, 409, "…partial overlap at the start too");

// --- Adjacent (touching, not overlapping) is allowed ---
t.ok((await book(C, "room-a", "2026-06-01T11:00:00Z", "2026-06-01T12:00:00Z")).json.id, "a booking starting exactly when another ends is allowed");

// --- Free check ---
t.eq((await free("room-a", "2026-06-01T10:30:00Z", "2026-06-01T10:45:00Z")).free, false, "a busy window reads free:false");
t.eq((await free("room-a", "2026-06-01T14:00:00Z", "2026-06-01T15:00:00Z")).free, true, "a clear window reads free:true");

// --- Per-resource isolation ---
t.ok((await book(B, "room-b", "2026-06-01T10:00:00Z", "2026-06-01T11:00:00Z")).json.id, "the same time on a different resource is fine");

// --- List window ---
t.eq((await list("room-a")).bookings.length, 2, "room-a has 2 bookings");
t.eq((await list("room-a", "?from=2026-06-01T11:30:00Z&to=2026-06-01T13:00:00Z")).bookings.length, 1, "window filter → the 11–12 booking");

// --- Cancel (owner) frees the slot ---
t.eq((await cancel(B, "room-a", id1)).json.cancelled, true, "the owner cancels their booking");
t.eq((await free("room-a", "2026-06-01T10:00:00Z", "2026-06-01T11:00:00Z")).free, true, "…the slot is free again");

// --- Cancel authz: non-owner non-admin can't; admin can ---
const id2 = (await book(C, "room-c", "2026-06-01T10:00:00Z", "2026-06-01T11:00:00Z")).json.id;
t.eq((await cancel(B, "room-c", id2)).status, 403, "a non-owner non-admin can't cancel → 403");
t.eq((await cancel(A, "room-c", id2)).json.cancelled, true, "an admin can cancel anyone's booking");

// --- Validation + authz ---
t.eq((await book(B, "room-a", "2026-06-01T11:00:00Z", "2026-06-01T10:00:00Z")).status, 400, "ends before starts → 400");
t.eq((await book(B, "room-a", "bad", "date")).status, 400, "bad dates → 400");
t.eq((await book(null, "room-a", "2026-06-01T15:00:00Z", "2026-06-01T16:00:00Z")).status, 401, "signed-out book → 401");
t.eq((await cancel(B, "room-a", 999999)).status, 404, "cancelling a missing booking → 404");

t.done(); h.restore();
