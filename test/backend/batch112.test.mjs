// Batch 112 — stock ledger: movements, on-hand/reserved/available, no-negative guard, reservations, transfers
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 112");
const slug = "b112";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "t", type: "text" }] } } });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const USER = (await c.signup(slug, "user@x.dev", "Str0ng-pass-9")).json.token;
const move = (body, tok) => c.post(`/api/db/${slug}/stock/moves`, body, { token: tok || ADMIN });
const level = (item, loc) => c.get(`/api/db/${slug}/stock/level?item=${item}${loc ? "&location=" + loc : ""}`, { token: ADMIN });
const reserve = (body) => c.post(`/api/db/${slug}/stock/reserve`, body, { token: ADMIN });

// Receipt raises on-hand.
let r = await move({ item: "widget", qty: 100, ref: "PO-1" });
t.eq(r.status, 200, "receipt → 200");
t.eq(r.json.level.on_hand, 100, "on_hand = 100 after receipt");
t.eq(r.json.move.kind, "receipt", "positive qty defaults to receipt kind");

// Issue lowers it.
await move({ item: "widget", qty: -30, ref: "SO-1" });
t.eq((await level("widget")).json.on_hand, 70, "on_hand = 70 after issuing 30");
t.eq((await level("widget")).json.available, 70, "available = on_hand with no reservations");

// No-negative guard: can't issue more than on-hand.
let over = await move({ item: "widget", qty: -1000 });
t.eq(over.status, 409, "over-issue → 409");
t.ok(/insufficient/i.test(over.json.error || ""), "409 says insufficient stock");
t.eq((await level("widget")).json.on_hand, 70, "on_hand unchanged after the refused issue");

// allowNegative bypasses the guard.
t.eq((await move({ item: "backorderable", qty: -5, allowNegative: true })).status, 200, "allowNegative permits going negative");
t.eq((await level("backorderable")).json.on_hand, -5, "negative on_hand recorded when allowed");

// Fractional quantities are exact (milli-unit storage).
await move({ item: "flour", qty: 2.5 });
await move({ item: "flour", qty: 1.25 });
t.eq((await level("flour")).json.on_hand, 3.75, "fractional on_hand exact");

// Reservations reduce availability but not on-hand.
let rv = await reserve({ item: "widget", qty: 50, ref: "SO-2" });
t.eq(rv.status, 200, "reserve → 200");
const RID = rv.json.reservation.id;
t.eq((await level("widget")).json.on_hand, 70, "on_hand unchanged by reservation");
t.eq((await level("widget")).json.reserved, 50, "reserved = 50");
t.eq((await level("widget")).json.available, 20, "available = 70 − 50");

// Can't reserve beyond availability.
t.eq((await reserve({ item: "widget", qty: 25 })).status, 409, "over-reserve (25 > 20 avail) → 409");
t.eq((await reserve({ item: "widget", qty: 20 })).status, 200, "reserving exactly the remaining 20 is fine");
t.eq((await level("widget")).json.available, 0, "available now 0");

// Release frees the reservation back to availability.
let rel = await c.post(`/api/db/${slug}/stock/reservations/${RID}/release`, {}, { token: ADMIN });
t.eq(rel.status, 200, "release → 200");
t.eq((await level("widget")).json.available, 50, "available back up by the released 50");
t.eq((await c.post(`/api/db/${slug}/stock/reservations/${RID}/release`, {}, { token: ADMIN })).status, 409, "releasing an already-closed reservation → 409");

// Fulfill: issue the reserved qty and close it. Reserve 10, fulfill → on_hand drops, reservation closed.
let rv2 = await reserve({ item: "widget", qty: 10, ref: "SO-9" });
let ful = await c.post(`/api/db/${slug}/stock/reservations/${rv2.json.reservation.id}/fulfill`, {}, { token: ADMIN });
t.eq(ful.status, 200, "fulfill → 200");
t.eq(ful.json.status, "fulfilled", "reservation marked fulfilled");
t.eq((await level("widget")).json.on_hand, 60, "on_hand dropped by the fulfilled 10 (70 → 60)");

// Transfer moves stock between locations atomically-guarded.
await move({ item: "bolt", qty: 40, location: "wh1" });
let tr = await c.post(`/api/db/${slug}/stock/transfer`, { item: "bolt", from: "wh1", to: "wh2", qty: 15 }, { token: ADMIN });
t.eq(tr.status, 200, "transfer → 200");
t.eq((await level("bolt", "wh1")).json.on_hand, 25, "source location down 15");
t.eq((await level("bolt", "wh2")).json.on_hand, 15, "dest location up 15");
// aggregate across locations
t.eq((await level("bolt")).json.on_hand, 40, "aggregate on_hand across locations unchanged by transfer");
// can't transfer more than the source holds
t.eq((await c.post(`/api/db/${slug}/stock/transfer`, { item: "bolt", from: "wh1", to: "wh2", qty: 999 }, { token: ADMIN })).status, 409, "over-transfer → 409");
t.eq((await c.post(`/api/db/${slug}/stock/transfer`, { item: "bolt", from: "wh1", to: "wh1", qty: 1 }, { token: ADMIN })).status, 400, "same-location transfer → 400");

// levels list + low-stock filter.
let levels = (await c.get(`/api/db/${slug}/stock/levels?below=10`, { token: ADMIN })).json;
t.ok(levels.levels.some((l) => l.item === "backorderable") && levels.levels.every((l) => l.available < 10), "below= filters to low-stock rows");

// Authz.
t.eq((await move({ item: "x", qty: 1 }, USER)).status, 403, "non-admin → 403");
t.eq((await c.post(`/api/db/${slug}/stock/moves`, { item: "x", qty: 1 })).status, 401, "signed-out → 401");
// validation
t.eq((await move({ qty: 5 })).status, 400, "missing item → 400");
t.eq((await move({ item: "x", qty: 0 })).status, 400, "zero qty → 400");

t.done(); h.restore();
