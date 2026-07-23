// Batch 383 — SLOT CHECK. Stateless appointment-availability test: a proposed slot vs busy intervals, with an
// optional buffer applied on both sides. Reports available + the conflicts. Covers overlap, adjacency, buffer,
// validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 383");
const slug = "b383";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const sc = (body) => c.post(`/api/db/${slug}/slot-check`, body).then((r) => r.json);

const busy = [
  { start: "2026-02-01T09:00:00Z", end: "2026-02-01T10:00:00Z" },
  { start: "2026-02-01T14:00:00Z", end: "2026-02-01T15:00:00Z" },
];

// --- Free slot ---
let r = await sc({ proposed: { start: "2026-02-01T11:00:00Z", end: "2026-02-01T12:00:00Z" }, busy });
t.eq(r.available, true, "a slot in a gap is available");
t.eq(r.conflicts.length, 0, "…no conflicts");

// --- Overlapping slot ---
r = await sc({ proposed: { start: "2026-02-01T09:30:00Z", end: "2026-02-01T10:30:00Z" }, busy });
t.eq(r.available, false, "an overlapping slot is not available");
t.eq(r.conflicts.length, 1, "…one conflict");

// --- Adjacent slot (touching, no buffer) is fine ---
r = await sc({ proposed: { start: "2026-02-01T10:00:00Z", end: "2026-02-01T11:00:00Z" }, busy });
t.eq(r.available, true, "a slot starting exactly when a busy one ends is fine");

// --- Buffer pushes adjacency into a conflict ---
r = await sc({ proposed: { start: "2026-02-01T10:00:00Z", end: "2026-02-01T11:00:00Z" }, busy, buffer_minutes: 15 });
t.eq(r.available, false, "a 15-min buffer makes the adjacent slot conflict");
t.eq(r.conflicts.length, 1, "…the 9-10 busy block");

// --- No busy intervals ---
t.eq((await sc({ proposed: { start: "2026-02-01T01:00:00Z", end: "2026-02-01T02:00:00Z" }, busy: [] })).available, true, "no busy intervals → always available");

// --- Multiple conflicts ---
r = await sc({ proposed: { start: "2026-02-01T08:00:00Z", end: "2026-02-01T16:00:00Z" }, busy });
t.eq(r.conflicts.length, 2, "a wide slot conflicts with both busy blocks");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/slot-check`, { proposed: { start: "2026-02-01T10:00:00Z", end: "2026-02-01T09:00:00Z" }, busy: [] })).status, 400, "end before start → 400");
t.eq((await c.post(`/api/db/${slug}/slot-check`, { proposed: { start: "2026-02-01T09:00:00Z", end: "2026-02-01T10:00:00Z" }, busy: "x" })).status, 400, "busy not an array → 400");
t.eq((await c.post(`/api/db/${slug}/slot-check`, { proposed: { start: "2026-02-01T09:00:00Z", end: "2026-02-01T10:00:00Z" }, busy: [], buffer_minutes: -1 })).status, 400, "a negative buffer → 400");

t.done(); h.restore();
