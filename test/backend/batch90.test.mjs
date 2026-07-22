// Batch 90 — attachment storage usage: GET /api/db/<slug>/storage → count + bytes, site-wide
// and per table (admin-gated dashboard).
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 90");
const slug = "b90";
await c.ensure(slug);
await c.schema(slug, { tables: {
  deals: { access: "admin", columns: [{ name: "title", type: "text" }] },
  tickets: { access: "admin", columns: [{ name: "subject", type: "text" }] },
} });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token; // id1
const USER = (await c.signup(slug, "u@x.dev", "Str0ng-pass-9")).json.token; // id2
const b64 = (s) => Buffer.from(s).toString("base64");

await c.post(`/api/db/${slug}/rows/deals`, { title: "D" }, { token: ADMIN });
await c.post(`/api/db/${slug}/rows/tickets`, { subject: "T" }, { token: ADMIN });
// deals: 4 + 3 = 7 bytes over 2 files; tickets: 6 bytes over 1 file
await c.post(`/api/db/${slug}/rows/deals/1/attach`, { filename: "a", data: b64("ABCD") }, { token: ADMIN });
const del2 = (await c.post(`/api/db/${slug}/rows/deals/1/attach`, { filename: "b", data: b64("XYZ") }, { token: ADMIN })).json.attachment;
await c.post(`/api/db/${slug}/rows/tickets/1/attach`, { filename: "c", data: b64("HELLO!") }, { token: ADMIN });

// admin sees site-wide + per-table usage
let s = (await c.get(`/api/db/${slug}/storage`, { token: ADMIN })).json;
t.ok(s.ok, "storage ok");
t.eq(s.attachments.count, 3, "3 files total");
t.eq(s.attachments.bytes, 13, "13 bytes total (4+3+6)");
const byT = {}; for (const r of s.by_table) byT[r.table] = r;
t.eq(byT.deals.count, 2, "deals: 2 files");
t.eq(byT.deals.bytes, 7, "deals: 7 bytes");
t.eq(byT.tickets.bytes, 6, "tickets: 6 bytes");
t.eq(s.by_table[0].table, "deals", "sorted by bytes desc (deals first)");

// deleting a file updates the totals
await c.del(`/api/db/${slug}/rows/deals/1/attach/${del2.id}`, { token: ADMIN });
let s2 = (await c.get(`/api/db/${slug}/storage`, { token: ADMIN })).json;
t.eq(s2.attachments.count, 2, "count drops to 2 after delete");
t.eq(s2.attachments.bytes, 10, "bytes drop to 10 (13 - 3)");

// gated: non-admin 403, signed-out 401
t.eq((await c.get(`/api/db/${slug}/storage`, { token: USER })).status, 403, "non-admin → 403");
t.eq((await c.get(`/api/db/${slug}/storage`)).status, 401, "signed-out → 401");

// a fresh site with no attachments → zeros
await c.ensure("b90b");
await c.schema("b90b", { tables: { x: { access: "admin", columns: [{ name: "a", type: "text" }] } } });
const A2 = (await c.signup("b90b", "admin@x.dev", "Str0ng-pass-9")).json.token;
let empty = (await c.get(`/api/db/b90b/storage`, { token: A2 })).json;
t.ok(empty.ok && empty.attachments.count === 0 && empty.attachments.bytes === 0, "empty site → zero usage");

t.done(); h.restore();
