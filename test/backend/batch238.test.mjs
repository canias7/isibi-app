// Batch 238 — CAPACITY TIME-SLOTS (class sizes). A fixed-capacity session members book a seat in; the cap
// can't be exceeded. Covers create, book (seats_left), full → 409, idempotent double-book, cancel frees a
// seat, detail + mine, list availability, patch capacity, delete, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 238");
const slug = "b238";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3
const D = (await c.signup(slug, "d@x.dev", "Str0ng-pass-9")).json.token; // id4
const create = (tok, body) => c.post(`/api/db/${slug}/slots`, body, tok === null ? {} : { token: tok });
const book = (tok, id) => c.post(`/api/db/${slug}/slots/${id}/book`, {}, { token: tok });
const cancel = (tok, id) => c.del(`/api/db/${slug}/slots/${id}/book`, { token: tok }).then((r) => r.json);
const detail = (tok, id) => c.get(`/api/db/${slug}/slots/${id}`, tok ? { token: tok } : {}).then((r) => r.json);
const list = () => c.get(`/api/db/${slug}/slots`).then((r) => r.json);
const patch = (tok, id, body) => c.patch(`/api/db/${slug}/slots/${id}`, body, { token: tok });
const del = (tok, id) => c.del(`/api/db/${slug}/slots/${id}`, { token: tok });

// --- Create a 2-seat class ---
const id = (await create(A, { label: "Yoga", capacity: 2, starts: "2026-06-01T10:00:00Z" })).json.id;
t.ok(id, "admin creates a slot");

// --- Book up to capacity ---
t.eq((await book(B, id)).json.seats_left, 1, "B books → 1 seat left");
t.eq((await book(C, id)).json.seats_left, 0, "C books → full");

// --- Full → 409 ---
t.eq((await book(D, id)).status, 409, "D can't book a full slot → 409");

// --- Idempotent double-book ---
t.eq((await book(B, id)).json.already, true, "B re-booking → already (no double seat)");

// --- Detail + mine ---
let d = (await detail(B, id)).slot;
t.eq(d.booked, 2, "2 booked");
t.eq(d.available, 0, "0 available");
t.eq(d.mine, true, "B sees mine:true");
t.eq((await detail(D, id)).slot.mine, false, "D sees mine:false");

// --- Cancel frees a seat ---
t.eq((await cancel(C, id)).cancelled, true, "C cancels");
t.eq((await detail(null, id)).slot.available, 1, "…1 seat freed");
t.eq((await book(D, id)).json.seats_left, 0, "…D can now book the freed seat");

// --- List availability ---
let l = await list();
t.eq(l.slots[0].capacity, 2, "list shows capacity");
t.eq(l.slots[0].full, true, "…and the full flag");

// --- Patch capacity ---
t.eq((await patch(A, id, { capacity: 3 })).json.id, id, "admin raises capacity to 3");
t.eq((await detail(null, id)).slot.available, 1, "…now 1 available again");

// --- Delete ---
t.eq((await del(A, id)).json.deleted, true, "admin deletes the slot");
t.eq((await detail(null, id)).ok ?? false, false, "…gone");

// --- Validation + authz ---
t.eq((await create(A, {})).status, 400, "missing capacity → 400");
t.eq((await create(A, { capacity: 0 })).status, 400, "zero capacity → 400");
t.eq((await create(B, { capacity: 5 })).status, 403, "a member can't create → 403");
const id2 = (await create(A, { label: "Spin", capacity: 5 })).json.id;
t.eq((await c.post(`/api/db/${slug}/slots/${id2}/book`, {})).status, 401, "signed-out book → 401");
t.eq((await patch(B, id2, { capacity: 2 })).status, 403, "a member can't patch → 403");
t.eq((await del(B, id2)).status, 403, "a member can't delete → 403");

t.done(); h.restore();
