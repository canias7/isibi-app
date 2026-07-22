// Batch 148 — webhook AUTO-FIRE: a table that opts in (webhooks:true) fires <table>.created/
// updated/deleted to subscribers automatically on row writes; a table without the flag doesn't;
// a table opted into only some actions fires only those. Uses h.drain() to await the async fire.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 148");
const slug = "b148";
await c.ensure(slug);
await c.schema(slug, { tables: {
  orders: { access: "user", webhooks: true, columns: [{ name: "amount", type: "number" }] },       // all actions
  tasks:  { access: "user", webhooks: ["created"], columns: [{ name: "title", type: "text" }] },     // create only
  notes:  { access: "user", columns: [{ name: "body", type: "text" }] },                             // no webhooks
} });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token; // id1
const M = (await c.signup(slug, "m@x.dev", "Str0ng-pass-9")).json.token;         // id2

// Register a wildcard subscriber, then invalidate is automatic.
await c.post(`/api/db/${slug}/webhooks`, { url: "https://example.com/hook", secret: "s" }, { token: ADMIN });
const events = async () => {
  await h.drain();
  return (await c.get(`/api/db/${slug}/webhooks/deliveries?limit=200`, { token: ADMIN })).json.deliveries.map((d) => d.event);
};

// Create → update → delete an order; each fires automatically.
const oid = (await c.post(`/api/db/${slug}/rows/orders`, { amount: 50 }, { token: M })).json; // {ok:true}
await h.drain();
let ev1 = await events();
t.ok(ev1.includes("orders.created"), "row insert auto-fired orders.created");

// Find the created order's id via the member's list (to update/delete it).
const rowId = (await c.get(`/api/db/${slug}/rows/orders`, { token: M })).json.rows[0].id;
await c.patch(`/api/db/${slug}/rows/orders/${rowId}`, { amount: 75 }, { token: M });
let ev2 = await events();
t.ok(ev2.includes("orders.updated"), "row update auto-fired orders.updated");

await c.del(`/api/db/${slug}/rows/orders/${rowId}`, { token: M });
let ev3 = await events();
t.ok(ev3.includes("orders.deleted"), "row delete auto-fired orders.deleted");
t.eq(ev3.filter((e) => e.startsWith("orders.")).length, 3, "exactly 3 order events (created/updated/deleted)");

// A table with NO webhooks flag fires nothing.
await c.post(`/api/db/${slug}/rows/notes`, { body: "hi" }, { token: M });
let ev4 = await events();
t.ok(!ev4.some((e) => e.startsWith("notes.")), "a table without the webhooks flag never fires");

// A table opted into ONLY 'created' fires on create but not update/delete.
await c.post(`/api/db/${slug}/rows/tasks`, { title: "a" }, { token: M });
const taskId = (await c.get(`/api/db/${slug}/rows/tasks`, { token: M })).json.rows[0].id;
await c.patch(`/api/db/${slug}/rows/tasks/${taskId}`, { title: "b" }, { token: M });
await c.del(`/api/db/${slug}/rows/tasks/${taskId}`, { token: M });
let ev5 = await events();
t.eq(ev5.filter((e) => e === "tasks.created").length, 1, "tasks fired created once");
t.ok(!ev5.includes("tasks.updated") && !ev5.includes("tasks.deleted"), "tasks did NOT fire update/delete (opted out)");

// Every delivery landed on the subscriber (harness returns 200) and is signed-capable.
const dels = (await c.get(`/api/db/${slug}/webhooks/deliveries?limit=200`, { token: ADMIN })).json.deliveries;
t.ok(dels.length >= 4 && dels.every((d) => d.ok === 1), "all auto-fired deliveries succeeded");

// With the subscriber removed, a new write fires nothing (the 'any hooks?' cache invalidates on delete).
const hookId = (await c.get(`/api/db/${slug}/webhooks`, { token: ADMIN })).json.webhooks[0].id;
await c.del(`/api/db/${slug}/webhooks/${hookId}`, { token: ADMIN });
const before = (await c.get(`/api/db/${slug}/webhooks/deliveries?limit=200`, { token: ADMIN })).json.deliveries.length;
await c.post(`/api/db/${slug}/rows/orders`, { amount: 9 }, { token: M });
await h.drain();
const after = (await c.get(`/api/db/${slug}/webhooks/deliveries?limit=200`, { token: ADMIN })).json.deliveries.length;
t.eq(after, before, "no subscribers → no deliveries logged");

t.done(); h.restore();
