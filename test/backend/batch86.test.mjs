// Batch 86 — hard-delete cascade: a row's satellite data (notes, attachments+R2, …) is swept
// when the row is permanently deleted, so nothing (and no R2 object) is orphaned.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 86");
const slug = "b86";
await c.ensure(slug);
await c.schema(slug, { tables: {
  deals: { access: "admin", columns: [{ name: "name", type: "text" }] }, // no trash → DELETE is hard
} });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const b64 = (s) => Buffer.from(s).toString("base64");
const bucketSize = () => h.env.SITES_BUCKET._map.size;

// four deals; each gets a note + an attachment
for (const nm of ["keep-A", "del-B", "del-B", "keep-C"]) await c.post(`/api/db/${slug}/rows/deals`, { name: nm }, { token: ADMIN });
const atts = {};
for (const id of [1, 2, 3, 4]) {
  await c.post(`/api/db/${slug}/rows/deals/${id}/notes`, { body: "note for " + id, kind: "note" }, { token: ADMIN });
  atts[id] = (await c.post(`/api/db/${slug}/rows/deals/${id}/attach`, { filename: "f" + id + ".txt", data: b64("file " + id) }, { token: ADMIN })).json.attachment;
}
t.eq(bucketSize(), 4, "4 files stored in R2 up front");
t.eq((await c.get(`/api/db/${slug}/rows/deals/1/notes`, { token: ADMIN })).json.notes.length, 1, "deal 1 has its note before delete");

// single HARD delete of deal 1 → its note + attachment (and R2 bytes) swept
await c.del(`/api/db/${slug}/rows/deals/1`, { token: ADMIN });
t.ok(!(await c.get(`/api/db/${slug}/rows/deals/1`, { token: ADMIN })).json.row, "deal 1 row is gone");
t.eq((await c.get(`/api/db/${slug}/rows/deals/1/notes`, { token: ADMIN })).json.notes.length, 0, "deal 1's note purged");
t.eq((await c.get(`/api/db/${slug}/rows/deals/1/attach`, { token: ADMIN })).json.attachments.length, 0, "deal 1's attachment row purged");
t.eq((await c.get(atts[1].url, { token: ADMIN })).status, 404, "deal 1's attachment file no longer fetchable");
t.eq(bucketSize(), 3, "R2 object for deal 1 removed (4 → 3)");

// BULK hard delete of the two 'del-B' deals (ids 2,3) → their satellites swept too
let bulk = await c.del(`/api/db/${slug}/rows/deals?where=name:eq:del-B`, { token: ADMIN });
t.eq(bulk.json.deleted, 2, "bulk deleted the 2 del-B deals");
t.eq((await c.get(`/api/db/${slug}/rows/deals/2/notes`, { token: ADMIN })).json.notes.length, 0, "deal 2's note purged (bulk)");
t.eq((await c.get(`/api/db/${slug}/rows/deals/3/attach`, { token: ADMIN })).json.attachments.length, 0, "deal 3's attachment purged (bulk)");
t.eq(bucketSize(), 1, "only deal 4's file remains in R2 (3 → 1)");

// the surviving deal keeps everything
t.eq((await c.get(`/api/db/${slug}/rows/deals/4/notes`, { token: ADMIN })).json.notes.length, 1, "deal 4's note survives");
t.eq((await c.get(`/api/db/${slug}/rows/deals/4/attach`, { token: ADMIN })).json.attachments.length, 1, "deal 4's attachment survives");
t.eq((await c.get(atts[4].url, { token: ADMIN })).text, "file 4", "deal 4's file still fetchable + intact");

t.done(); h.restore();
