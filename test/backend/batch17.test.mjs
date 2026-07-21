// Batch 17 — immutable (write-once) fields + computed default tokens (@now/@today/@uuid)
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness();
const c = makeClient(worker, h);
const t = makeTally("Batch 17");

const slug = "b17";
await c.ensure(slug);
const sc = await c.schema(slug, {
  tables: {
    items: {
      access: "feed",
      columns: [
        { name: "sku", type: "text", immutable: true },
        { name: "name", type: "text" },
        { name: "serial", type: "integer", immutable: true },
        { name: "qty", type: "integer" },
        { name: "token", type: "text", default: "@uuid" },
        { name: "stamp", type: "text", default: "@now" },
        { name: "day", type: "text", default: "@today" },
        { name: "status", type: "text", default: "open" }, // plain literal default still works
      ],
    },
  },
});
t.ok(sc.json && sc.json.ok, "schema applied");
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token;

// --- computed defaults fill when omitted ---
await c.post(`/api/db/${slug}/rows/items`, { sku: "ABC", name: "Widget", serial: 1, qty: 5 }, { token: A });
let row = (await c.get(`/api/db/${slug}/rows/items`)).json.rows[0];
const id = row.id;
t.ok(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(row.token), "@uuid default -> uuid-shaped (" + row.token + ")");
t.ok(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(row.stamp), "@now default -> datetime (" + row.stamp + ")");
t.ok(/^\d{4}-\d{2}-\d{2}$/.test(row.day), "@today default -> date (" + row.day + ")");
t.ok(row.status === "open", "literal default 'open' still works");

// --- provided value overrides a computed default ---
await c.post(`/api/db/${slug}/rows/items`, { sku: "XYZ", name: "Custom", token: "my-own-token" }, { token: A });
const row2 = (await c.get(`/api/db/${slug}/rows/items?where=sku:eq:XYZ`)).json.rows[0];
t.ok(row2.token === "my-own-token", "provided token overrides @uuid default");

// --- immutable rejects edits ---
t.ok((await c.patch(`/api/db/${slug}/rows/items/${id}`, { name: "Renamed" }, { token: A })).json.ok, "PATCH mutable field ok");
const badSku = await c.patch(`/api/db/${slug}/rows/items/${id}`, { sku: "NEW" }, { token: A });
t.ok(badSku.status === 400 && /can't be changed/.test(badSku.json.error), "PATCH immutable sku -> 400");
// mixed body (mutable + immutable) is still rejected wholesale
const mixed = await c.patch(`/api/db/${slug}/rows/items/${id}`, { name: "x", sku: "NEW" }, { token: A });
t.ok(mixed.status === 400, "PATCH mixed w/ immutable -> 400");
row = (await c.get(`/api/db/${slug}/rows/items/${id}`)).json.row;
t.ok(row.sku === "ABC" && row.name === "Renamed", "sku unchanged, prior name edit stuck");

// --- bulk PATCH can't change immutable ---
const bulkBad = await c.patch(`/api/db/${slug}/rows/items?where=sku:eq:ABC`, { sku: "Z" }, { token: A });
t.ok(bulkBad.status === 400, "bulk PATCH immutable -> 400");

// --- incr can't change immutable numeric, but can change a mutable one ---
const incBad = await c.post(`/api/db/${slug}/rows/items/${id}/incr`, { col: "serial", by: 1 }, { token: A });
t.ok(incBad.status === 400 && /can't be changed/.test(incBad.json.error), "incr immutable serial -> 400");
const incOk = await c.post(`/api/db/${slug}/rows/items/${id}/incr`, { col: "qty", by: 3 }, { token: A });
t.ok(incOk.json && incOk.json.value === 8, "incr mutable qty -> 8");

t.done();
h.restore();
