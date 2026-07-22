// Batch 87 — /merge keeps the loser's satellites: folding a duplicate moves its notes,
// attachments, and tags onto the survivor (deduping composite-key ones) instead of losing them.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 87");
const slug = "b87";
await c.ensure(slug);
await c.schema(slug, { tables: {
  accounts: { access: "admin", columns: [{ name: "name", type: "text" }, { name: "phone", type: "text" }] },
  contacts: { access: "admin", columns: [{ name: "name", type: "text" }, { name: "account_id", type: "integer", ref: "accounts" }] },
} });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const b64 = (s) => Buffer.from(s).toString("base64");

await c.post(`/api/db/${slug}/rows/accounts`, { name: "Acme Inc", phone: "555-1000" }, { token: ADMIN }); // 1 survivor
await c.post(`/api/db/${slug}/rows/accounts`, { name: "ACME", website: "" }, { token: ADMIN }); // 2 loser
await c.post(`/api/db/${slug}/rows/contacts`, { name: "Jane", account_id: 2 }, { token: ADMIN }); // child of loser

// survivor's satellites
await c.post(`/api/db/${slug}/rows/accounts/1/notes`, { body: "survivor note" }, { token: ADMIN });
const sAtt = (await c.post(`/api/db/${slug}/rows/accounts/1/attach`, { filename: "s.txt", data: b64("SURV") }, { token: ADMIN })).json.attachment;
await c.post(`/api/db/${slug}/rows/accounts/1/tags`, { tag: "vip" }, { token: ADMIN });

// loser's satellites (tag 'vip' duplicates the survivor; 'hot' is unique)
await c.post(`/api/db/${slug}/rows/accounts/2/notes`, { body: "loser note" }, { token: ADMIN });
const lAtt = (await c.post(`/api/db/${slug}/rows/accounts/2/attach`, { filename: "l.txt", data: b64("LOSE") }, { token: ADMIN })).json.attachment;
await c.post(`/api/db/${slug}/rows/accounts/2/tags`, { tag: "vip" }, { token: ADMIN });
await c.post(`/api/db/${slug}/rows/accounts/2/tags`, { tag: "hot" }, { token: ADMIN });

// merge 2 → 1
let m = await c.post(`/api/db/${slug}/rows/accounts/1/merge`, { from: 2, fillBlanks: true }, { token: ADMIN });
t.ok(m.json.ok && m.json.into === 1 && m.json.from === 2, "merge ok (2 → 1)");
t.eq(m.json.repointed.contacts, 1, "child contact repointed to survivor");
t.ok(!(await c.get(`/api/db/${slug}/rows/accounts/2`, { token: ADMIN })).json.row, "loser account gone");

// survivor now carries BOTH notes
const notes = (await c.get(`/api/db/${slug}/rows/accounts/1/notes`, { token: ADMIN })).json.notes.map((n) => n.body).sort();
t.eq(notes, ["loser note", "survivor note"], "both notes now on the survivor");

// both attachments, both fetchable + intact
const att = (await c.get(`/api/db/${slug}/rows/accounts/1/attach`, { token: ADMIN })).json.attachments;
t.eq(att.length, 2, "both attachments now on the survivor");
t.eq((await c.get(sAtt.url, { token: ADMIN })).text, "SURV", "survivor's file intact");
t.eq((await c.get(lAtt.url, { token: ADMIN })).text, "LOSE", "loser's file preserved + fetchable on the survivor");

// tags merged + deduped (vip once, plus hot)
const tags = (await c.get(`/api/db/${slug}/rows/accounts/1/tags`, { token: ADMIN })).json.tags.sort();
t.eq(tags, ["hot", "vip"], "tags merged and deduped (vip not doubled)");

// loser side is empty
t.eq((await c.get(`/api/db/${slug}/rows/accounts/2/notes`, { token: ADMIN })).json.notes.length, 0, "no notes left on the loser id");
t.eq((await c.get(`/api/db/${slug}/rows/accounts/2/attach`, { token: ADMIN })).json.attachments.length, 0, "no attachments left on the loser id");

t.done(); h.restore();
