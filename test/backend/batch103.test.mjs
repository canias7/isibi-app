// Batch 103 — record clone: POST /rows/<t>/<id>/clone duplicates a row (with overrides)
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 103");
const slug = "b103";
await c.ensure(slug);
await c.schema(slug, { tables: {
  invoices: { access: "admin", sequence: { field: "number", prefix: "INV-", pad: 4 },
    columns: [{ name: "client", type: "text" }, { name: "amount", type: "integer" }, { name: "meta", type: "json" }, { name: "code", type: "text", unique: true }] },
  projects: { access: "user", columns: [{ name: "title", type: "text" }] },
} });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id2
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id3

await c.post(`/api/db/${slug}/rows/invoices`, { client: "Acme", amount: 500, meta: { tier: "gold" }, code: "C1" }, { token: ADMIN }); // id1, number INV-0001

// clone with an override for the unique code
let cl = await c.post(`/api/db/${slug}/rows/invoices/1/clone`, { overrides: { code: "C2" } }, { token: ADMIN });
t.ok(cl.json.ok && cl.json.id === 2 && cl.json.from === 1, "clone returns the new id");
const two = (await c.get(`/api/db/${slug}/rows/invoices/2`, { token: ADMIN })).json.row;
t.eq(two.client, "Acme", "copied client");
t.eq(two.amount, 500, "copied amount");
t.eq(two.meta.tier, "gold", "copied + parsed json column");
t.eq(two.code, "C2", "override applied to unique field");
t.eq(two.number, "INV-0002", "auto-number regenerated (not copied)");

// cloning without overriding a unique field → 409
t.eq((await c.post(`/api/db/${slug}/rows/invoices/1/clone`, {}, { token: ADMIN })).status, 409, "duplicate unique code → 409");

// user table: owner clones their own row; the clone is owned by the caller
await c.post(`/api/db/${slug}/rows/projects`, { title: "Roadmap" }, { token: A }); // id1 owned by A
let pc = await c.post(`/api/db/${slug}/rows/projects/1/clone`, { overrides: { title: "Roadmap copy" } }, { token: A });
t.ok(pc.json.ok, "owner clones their project");
const pcopy = (await c.get(`/api/db/${slug}/rows/projects/${pc.json.id}`, { token: A })).json.row;
t.eq(pcopy.owner_id, 2, "clone owned by the caller");
t.eq(pcopy.title, "Roadmap copy", "override applied");

// another user can't clone someone else's private row
t.eq((await c.post(`/api/db/${slug}/rows/projects/1/clone`, {}, { token: B })).status, 404, "non-owner can't clone a private row");

// guards
t.eq((await c.post(`/api/db/${slug}/rows/invoices/999/clone`, {}, { token: ADMIN })).status, 404, "missing source → 404");
t.eq((await c.post(`/api/db/${slug}/rows/invoices/1/clone`, {})).status, 401, "signed-out → 401");
t.eq((await c.get(`/api/db/${slug}/rows/invoices/1/clone`, { token: ADMIN })).status, 405, "clone is POST-only");

t.done(); h.restore();
