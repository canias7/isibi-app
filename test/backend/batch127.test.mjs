// Batch 127 — scheduling/bookings: atomic no-double-book, availability slots, ownership
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 127");
const slug = "b127";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "t", type: "text" }] } } });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id2
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id3
const book = (body, tok) => c.post(`/api/db/${slug}/bookings`, body, { token: tok || A });

// Book a slot.
let r = await book({ resource: "room-1", start: "2026-03-01T09:00:00Z", end: "2026-03-01T10:00:00Z", party: "Standup" });
t.eq(r.status, 200, "book → 200");
t.eq(r.json.booking.status, "booked", "status booked");
const BK = r.json.booking.id;

// Overlapping bookings on the same resource are refused (atomic no-double-book).
t.eq((await book({ resource: "room-1", start: "2026-03-01T09:30:00Z", end: "2026-03-01T10:30:00Z" })).status, 409, "overlap → 409");
t.eq((await book({ resource: "room-1", start: "2026-03-01T09:30:00Z", end: "2026-03-01T10:30:00Z" })).json.code, "conflict", "409 code conflict");
// Exactly-adjacent (end == next start) is allowed (half-open intervals).
t.eq((await book({ resource: "room-1", start: "2026-03-01T10:00:00Z", end: "2026-03-01T11:00:00Z" })).status, 200, "back-to-back slot allowed");
// A fully-enclosing booking also conflicts.
t.eq((await book({ resource: "room-1", start: "2026-03-01T08:00:00Z", end: "2026-03-01T12:00:00Z" })).status, 409, "enclosing overlap → 409");
// A different resource at the same time is fine.
t.eq((await book({ resource: "room-2", start: "2026-03-01T09:00:00Z", end: "2026-03-01T10:00:00Z" })).status, 200, "other resource same time → ok");

// Cancelling frees the slot so it can be re-booked.
t.eq((await c.post(`/api/db/${slug}/bookings/${BK}/cancel`, {}, { token: A })).json.status, "cancelled", "cancel → cancelled");
t.eq((await book({ resource: "room-1", start: "2026-03-01T09:00:00Z", end: "2026-03-01T10:00:00Z" })).status, 200, "re-book the freed slot");

// Availability: 09:00–12:00 in 60-min slots on room-2 (09:00 is booked) → 10:00 & 11:00 free.
let av = (await c.get(`/api/db/${slug}/bookings/availability?resource=room-2&from=2026-03-01T09:00:00Z&to=2026-03-01T12:00:00Z&slot=60`, { token: A })).json;
t.eq(av.slots.map((s) => s.start), ["2026-03-01T10:00:00.000Z", "2026-03-01T11:00:00.000Z"], "free slots exclude the booked hour");

// Ownership: a member sees only their own bookings; admin sees all.
await book({ resource: "room-3", start: "2026-03-02T09:00:00Z", end: "2026-03-02T10:00:00Z" }, B); // B's booking
const aList = (await c.get(`/api/db/${slug}/bookings`, { token: A })).json.bookings;
t.ok(aList.every((b) => b.owner_id === 2), "A sees only their own bookings");
const adminList = (await c.get(`/api/db/${slug}/bookings`, { token: ADMIN })).json.bookings;
t.ok(adminList.some((b) => b.owner_id === 3) && adminList.some((b) => b.owner_id === 2), "admin sees everyone's");
// A can't cancel B's booking.
const bBooking = (await c.get(`/api/db/${slug}/bookings`, { token: B })).json.bookings.find((x) => x.resource === "room-3");
t.eq((await c.post(`/api/db/${slug}/bookings/${bBooking.id}/cancel`, {}, { token: A })).status, 403, "can't cancel another member's booking");
// but admin can.
t.eq((await c.post(`/api/db/${slug}/bookings/${bBooking.id}/cancel`, {}, { token: ADMIN })).status, 200, "admin can cancel any booking");

// Validation + authz.
t.eq((await book({ resource: "x", start: "nope", end: "2026-03-01T10:00:00Z" })).status, 400, "bad datetime → 400");
t.eq((await book({ resource: "x", start: "2026-03-01T10:00:00Z", end: "2026-03-01T09:00:00Z" })).status, 400, "end before start → 400");
t.eq((await book({ start: "2026-03-01T09:00:00Z", end: "2026-03-01T10:00:00Z" })).status, 400, "missing resource → 400");
t.eq((await c.post(`/api/db/${slug}/bookings`, { resource: "x", start: "2026-03-01T09:00:00Z", end: "2026-03-01T10:00:00Z" })).status, 401, "signed-out → 401");
t.eq((await c.get(`/api/db/${slug}/bookings/availability?resource=r`, { token: A })).status, 400, "availability needs from/to");

t.done(); h.restore();
