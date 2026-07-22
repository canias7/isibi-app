// Batch 164 — ADVERSARIAL: workflow & temporal guards. Booking double-book vs back-to-back,
// timeclock double clock-in, leave no-overdraw boundary, and state-machine transition enforcement
// (illegal moves blocked, "*" wildcard, unknown target).
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 164");
const slug = "b164";
await c.ensure(slug);
await c.schema(slug, { tables: {
  tickets: { access: "feed", transitions: { status: { open: ["ack", "closed"], ack: ["closed"], "*": ["escalated"] } },
             columns: [{ name: "title", type: "text" }, { name: "status", type: "text" }] },
} });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token; // id1
const U = (await c.signup(slug, "u@x.dev", "Str0ng-pass-9")).json.token;         // id2

// ── Bookings: no double-book, back-to-back OK, cancel frees the slot ──────────────────
const book = (body) => c.post(`/api/db/${slug}/bookings`, body, { token: U });
let b1 = await book({ resource: "room-1", start: "2026-03-01T09:00:00Z", end: "2026-03-01T10:00:00Z" });
t.eq(b1.status, 200, "first booking → 200");
// An OVERLAPPING booking on the same resource is impossible.
t.eq((await book({ resource: "room-1", start: "2026-03-01T09:30:00Z", end: "2026-03-01T10:30:00Z" })).status, 409, "overlapping booking → 409 conflict");
// A booking fully containing the first → also 409.
t.eq((await book({ resource: "room-1", start: "2026-03-01T08:00:00Z", end: "2026-03-01T11:00:00Z" })).status, 409, "an enclosing window also conflicts");
// Back-to-back (end == next start) is allowed.
t.eq((await book({ resource: "room-1", start: "2026-03-01T10:00:00Z", end: "2026-03-01T11:00:00Z" })).status, 200, "back-to-back (end==start) is allowed");
// A different resource never conflicts.
t.eq((await book({ resource: "room-2", start: "2026-03-01T09:30:00Z", end: "2026-03-01T10:30:00Z" })).status, 200, "a different resource doesn't conflict");
// Cancel the first slot → the freed window can be re-booked.
await c.post(`/api/db/${slug}/bookings/${b1.json.booking.id}/cancel`, {}, { token: U });
t.eq((await book({ resource: "room-1", start: "2026-03-01T09:00:00Z", end: "2026-03-01T09:45:00Z" })).status, 200, "after cancel, the slot is re-bookable");

// ── Timeclock: no double clock-in ────────────────────────────────────────────────────
t.eq((await c.post(`/api/db/${slug}/timeclock/in`, {}, { token: U })).status, 200, "clock in → 200");
t.eq((await c.post(`/api/db/${slug}/timeclock/in`, {}, { token: U })).status, 409, "a second clock-in without clocking out → 409");
let out = await c.post(`/api/db/${slug}/timeclock/out`, {}, { token: U });
t.eq(out.status, 200, "clock out → 200");
t.ok(out.json.minutes >= 0, "clock-out reports worked minutes");
// After clocking out, clocking in again is fine.
t.eq((await c.post(`/api/db/${slug}/timeclock/in`, {}, { token: U })).status, 200, "can clock in again after clocking out");

// ── Leave: no-overdraw boundary ──────────────────────────────────────────────────────
const leave = (body) => c.post(`/api/db/${slug}/leave`, body, { token: ADMIN });
await leave({ employee: "bob", days: 10, kind: "accrual" }); // balance 10
t.eq((await leave({ employee: "bob", days: -10 })).status, 200, "taking EXACTLY the balance is allowed");
t.eq((await c.get(`/api/db/${slug}/leave/balance?employee=bob`, { token: ADMIN })).json.balance, 0, "balance is exactly 0");
t.eq((await leave({ employee: "bob", days: -0.5 })).status, 409, "taking beyond the balance (overdraw) → 409");
// allowNegative permits an intentional negative balance.
t.eq((await leave({ employee: "bob", days: -5, allowNegative: true })).status, 200, "allowNegative permits going negative");
t.eq((await c.get(`/api/db/${slug}/leave/balance?employee=bob`, { token: ADMIN })).json.balance, -5, "balance is -5 with allowNegative");

// ── State machine: transitions enforced ──────────────────────────────────────────────
const mk = await c.post(`/api/db/${slug}/rows/tickets`, { title: "T", status: "open" }, { token: U });
const id = mk.json.id || (await c.get(`/api/db/${slug}/rows/tickets`, { token: U })).json.rows.find((r) => r.title === "T").id;
const setStatus = (status) => c.patch(`/api/db/${slug}/rows/tickets/${id}`, { status }, { token: U });
// Illegal jump open → closed is actually legal here; test an illegal one: ack has no path back to open.
t.ok((await setStatus("ack")).json.ok, "open → ack (legal)");
let bad = await setStatus("open");
t.ok(bad.status === 409 && bad.json.code === "transition", "ack → open is BLOCKED (no such path) → 409 transition");
// The "*" wildcard allows escalated from ANY state.
t.ok((await setStatus("escalated")).json.ok, "any state → escalated via the '*' wildcard");
// An undeclared target value is refused.
t.ok((await setStatus("bogus-state")).status === 409, "a transition to an undeclared state is refused");

t.done(); h.restore();
