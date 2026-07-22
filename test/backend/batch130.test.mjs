// Batch 130 — reorder rules + replenishment: items at/below their reorder point → suggested order qty
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 130");
const slug = "b130";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "t", type: "text" }] } } });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const USER = (await c.signup(slug, "user@x.dev", "Str0ng-pass-9")).json.token;
const move = (body) => c.post(`/api/db/${slug}/stock/moves`, body, { token: ADMIN });
const rule = (body, tok) => c.post(`/api/db/${slug}/stock/reorder-rules`, body, { token: tok || ADMIN });
const replenish = (q) => c.get(`/api/db/${slug}/stock/replenishment${q || ""}`, { token: ADMIN });

// Stock levels.
await move({ item: "widget", qty: 5 });    // low
await move({ item: "gadget", qty: 100 });  // healthy
await move({ item: "bolt", qty: 8 });      // low, has a target

// Reorder rules.
t.eq((await rule({ item: "widget", reorder_point: 10, reorder_qty: 50, supplier: "Acme" })).status, 200, "rule with fixed qty");
await rule({ item: "gadget", reorder_point: 10, reorder_qty: 50 });
await rule({ item: "bolt", reorder_point: 20, target: 100 });   // top up to target

let rep = (await replenish()).json.suggestions;
const byItem = Object.fromEntries(rep.map((s) => [s.item, s]));
// widget: available 5 <= point 10 → fixed reorder_qty 50
t.ok(byItem.widget, "widget needs reordering");
t.eq(byItem.widget.suggested_order, 50, "widget: fixed reorder_qty 50");
t.eq(byItem.widget.supplier, "Acme", "supplier carried through");
// bolt: available 8 <= point 20, target 100 → order 92 to reach target
t.eq(byItem.bolt.suggested_order, 92, "bolt: top up to target (100 − 8)");
// gadget: available 100 > point 10 → NOT suggested
t.ok(!byItem.gadget, "healthy item not suggested");

// Receiving stock clears the suggestion.
await move({ item: "widget", qty: 20 }); // now 25 > point 10
t.ok(!(await replenish()).json.suggestions.some((s) => s.item === "widget"), "reordered item drops off the list");

// Reservations count against available (so a reserved-down item still triggers).
await c.post(`/api/db/${slug}/stock/reserve`, { item: "gadget", qty: 95 }, { token: ADMIN }); // 100 on hand → 5 available
t.ok((await replenish()).json.suggestions.some((s) => s.item === "gadget"), "reserving down available triggers a reorder");

// Default suggestion (no qty, no target) = bring back up to the point.
await move({ item: "nut", qty: 2 });
await rule({ item: "nut", reorder_point: 10 });
t.eq((await replenish()).json.suggestions.find((s) => s.item === "nut").suggested_order, 8, "no qty/target → order up to the point (10 − 2)");

// List + delete rules.
t.ok((await c.get(`/api/db/${slug}/stock/reorder-rules`, { token: ADMIN })).json.rules.length >= 4, "rules listed");
t.eq((await c.del(`/api/db/${slug}/stock/reorder-rules/nut`, { token: ADMIN })).status, 200, "delete a rule");
t.ok(!(await replenish()).json.suggestions.some((s) => s.item === "nut"), "deleted rule no longer suggests");

// Guards.
t.eq((await rule({ reorder_point: 5 })).status, 400, "missing item → 400");
t.eq((await rule({ item: "x" })).status, 400, "missing reorder_point → 400");
t.eq((await rule({ item: "x", reorder_point: 5 }, USER)).status, 403, "non-admin → 403");
t.eq((await c.get(`/api/db/${slug}/stock/replenishment`)).status, 401, "signed-out → 401");

t.done(); h.restore();
