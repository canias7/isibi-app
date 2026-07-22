// Batch 76 — auto-numbering / sequences (human-readable record numbers, atomic + authoritative)
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 76");
const slug = "b76";
await c.ensure(slug);
await c.schema(slug, { tables: {
  invoices: { access: "admin", sequence: { field: "number", prefix: "INV-", pad: 5, start: 1000 },
    columns: [{ name: "amount", type: "integer" }, { name: "client", type: "text" }] },
  tickets: { access: "user", sequence: { field: "ref" }, // defaults: no prefix, pad 0, start 1
    columns: [{ name: "subject", type: "text" }] },
} });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const USER = (await c.signup(slug, "user@x.dev", "Str0ng-pass-9")).json.token;

// sequential, prefixed, zero-padded numbers, starting at `start`
await c.post(`/api/db/${slug}/rows/invoices`, { amount: 100, client: "Acme" }, { token: ADMIN });
await c.post(`/api/db/${slug}/rows/invoices`, { amount: 200, client: "Globex" }, { token: ADMIN });
await c.post(`/api/db/${slug}/rows/invoices`, { amount: 300, client: "Initech" }, { token: ADMIN });
let rows = (await c.get(`/api/db/${slug}/rows/invoices?sort=id&order=asc`, { token: ADMIN })).json.rows;
t.eq(rows.map((r) => r.number), ["INV-01000", "INV-01001", "INV-01002"], "sequential prefixed padded numbers from start=1000");

// the number is AUTHORITATIVE — a client-supplied value is ignored (field isn't app-writable)
let spoof = await c.post(`/api/db/${slug}/rows/invoices`, { amount: 400, client: "X", number: "INV-99999" }, { token: ADMIN });
t.ok(spoof.json.ok, "insert with a spoofed number succeeds");
let last = (await c.get(`/api/db/${slug}/rows/invoices?sort=-id&limit=1`, { token: ADMIN })).json.rows[0];
t.eq(last.number, "INV-01003", "spoofed number ignored → got the real next number");

// queryable + sortable
t.eq((await c.get(`/api/db/${slug}/rows/invoices?where=number:eq:INV-01001`, { token: ADMIN })).json.rows.length, 1, "number is queryable via ?where");
let desc = (await c.get(`/api/db/${slug}/rows/invoices?sort=-number&limit=1`, { token: ADMIN })).json.rows[0];
t.eq(desc.number, "INV-01003", "number is sortable (desc → highest)");

// PATCH cannot change the number (not in the writable set); other fields still update
await c.patch(`/api/db/${slug}/rows/invoices/1`, { amount: 999, number: "INV-00001" }, { token: ADMIN });
let one = (await c.get(`/api/db/${slug}/rows/invoices/1`, { token: ADMIN })).json.row;
t.eq(one.amount, 999, "editable field updated");
t.eq(one.number, "INV-01000", "number is immutable via PATCH");

// a second table has its OWN independent counter, with default format (no prefix, no pad, start 1)
await c.post(`/api/db/${slug}/rows/tickets`, { subject: "Login broken" }, { token: USER });
await c.post(`/api/db/${slug}/rows/tickets`, { subject: "Slow page" }, { token: USER });
let tk = (await c.get(`/api/db/${slug}/rows/tickets?sort=id&order=asc`, { token: USER })).json.rows;
t.eq(tk.map((r) => r.ref), ["1", "2"], "second table numbers independently from 1 (default format)");

// batch insert numbers each row in sequence too
await c.post(`/api/db/${slug}/rows/invoices`, { rows: [{ amount: 1 }, { amount: 2 }] }, { token: ADMIN });
let all = (await c.get(`/api/db/${slug}/rows/invoices?sort=id&order=asc`, { token: ADMIN })).json.rows;
t.eq(all.length, 6, "6 invoices total (4 single + 2 batch)");
t.eq(all[4].number, "INV-01004", "batch row 1 numbered");
t.eq(all[5].number, "INV-01005", "batch row 2 numbered");
// all numbers are unique and gap-free
const nums = all.map((r) => r.number);
t.eq(new Set(nums).size, 6, "all numbers unique");
t.eq(nums, ["INV-01000", "INV-01001", "INV-01002", "INV-01003", "INV-01004", "INV-01005"], "gap-free sequence");

t.done(); h.restore();
