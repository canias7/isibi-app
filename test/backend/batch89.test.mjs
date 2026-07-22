// Batch 89 — cascade-delete also sweeps CHILD rows' satellites: deleting a parent removes its
// cascade children AND their notes/attachments(+R2), so nothing (and no file) is orphaned.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 89");
const slug = "b89";
await c.ensure(slug);
await c.schema(slug, { tables: {
  accounts: { access: "admin", columns: [{ name: "name", type: "text" }] }, // no trash → hard delete
  contacts: { access: "admin", columns: [{ name: "name", type: "text" }, { name: "account_id", type: "integer", ref: "accounts" }] }, // cascade (default)
} });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const b64 = (s) => Buffer.from(s).toString("base64");
const bucketSize = () => h.env.SITES_BUCKET._map.size;

await c.post(`/api/db/${slug}/rows/accounts`, { name: "Acme" }, { token: ADMIN }); // account 1
await c.post(`/api/db/${slug}/rows/contacts`, { name: "Jane", account_id: 1 }, { token: ADMIN }); // contact 1 (child)
await c.post(`/api/db/${slug}/rows/contacts`, { name: "John", account_id: 1 }, { token: ADMIN }); // contact 2 (child)

// satellites on the parent AND on a child
await c.post(`/api/db/${slug}/rows/accounts/1/notes`, { body: "acct note" }, { token: ADMIN });
const acctAtt = (await c.post(`/api/db/${slug}/rows/accounts/1/attach`, { filename: "a.txt", data: b64("ACCT") }, { token: ADMIN })).json.attachment;
await c.post(`/api/db/${slug}/rows/contacts/1/notes`, { body: "contact note" }, { token: ADMIN });
const cContactAtt = (await c.post(`/api/db/${slug}/rows/contacts/1/attach`, { filename: "c.txt", data: b64("CONTACT") }, { token: ADMIN })).json.attachment;

t.eq(bucketSize(), 2, "2 files stored (parent + child)");
t.eq((await c.get(`/api/db/${slug}/rows/contacts/1/notes`, { token: ADMIN })).json.notes.length, 1, "child contact has its note before delete");

// delete the PARENT (hard) → cascades to children + sweeps everyone's satellites
await c.del(`/api/db/${slug}/rows/accounts/1`, { token: ADMIN });
t.ok(!(await c.get(`/api/db/${slug}/rows/accounts/1`, { token: ADMIN })).json.row, "parent account gone");
t.eq((await c.get(`/api/db/${slug}/rows/contacts`, { token: ADMIN })).json.rows.length, 0, "both child contacts cascade-deleted");

// child's satellites swept too (the new behavior)
t.eq((await c.get(`/api/db/${slug}/rows/contacts/1/notes`, { token: ADMIN })).json.notes.length, 0, "child contact's note purged");
t.eq((await c.get(`/api/db/${slug}/rows/contacts/1/attach`, { token: ADMIN })).json.attachments.length, 0, "child contact's attachment row purged");
t.eq((await c.get(cContactAtt.url, { token: ADMIN })).status, 404, "child contact's file no longer fetchable");
// parent's own satellites swept as well
t.eq((await c.get(acctAtt.url, { token: ADMIN })).status, 404, "parent's file gone too");
// and both R2 objects are gone
t.eq(bucketSize(), 0, "both files removed from R2 (parent + child)");

t.done(); h.restore();
