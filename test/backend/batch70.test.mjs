// Batch 70 — record merge (dedup: repoint children + remove the duplicate)
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 70");
const slug = "b70";
await c.ensure(slug);
await c.schema(slug, { tables: {
  accounts: { access: "admin", columns: [{ name: "name", type: "text" }, { name: "phone", type: "text" }, { name: "website", type: "text" }] },
  contacts: { access: "admin", columns: [{ name: "name", type: "text" }, { name: "account_id", type: "integer", ref: "accounts" }] },
  deals: { access: "admin", columns: [{ name: "title", type: "text" }, { name: "account_id", type: "integer", ref: "accounts" }] },
} });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const USER = (await c.signup(slug, "u@x.dev", "Str0ng-pass-9")).json.token;
// two duplicate accounts: keep #1 (has name+phone), loser #2 (has website)
await c.post(`/api/db/${slug}/rows/accounts`, { name: "Acme Inc", phone: "555-1000" }, { token: ADMIN }); // id 1 (survivor)
await c.post(`/api/db/${slug}/rows/accounts`, { name: "ACME", website: "acme.com" }, { token: ADMIN });     // id 2 (loser)
// children pointing at the LOSER (id 2)
await c.post(`/api/db/${slug}/rows/contacts`, { name: "Jane", account_id: 2 }, { token: ADMIN });
await c.post(`/api/db/${slug}/rows/deals`, { title: "Big Deal", account_id: 2 }, { token: ADMIN });
await c.post(`/api/db/${slug}/rows/deals`, { title: "Small Deal", account_id: 1 }, { token: ADMIN });

// non-admin cannot merge
t.eq((await c.post(`/api/db/${slug}/rows/accounts/1/merge`, { from: 2 }, { token: USER })).status, 403, "non-admin cannot merge");
// merge loser(2) into survivor(1) with fillBlanks (survivor gets website from loser)
let m = await c.post(`/api/db/${slug}/rows/accounts/1/merge`, { from: 2, fillBlanks: true }, { token: ADMIN });
t.ok(m.json.ok && m.json.into === 1 && m.json.from === 2, "merge ok (2 → 1)");
t.eq(m.json.repointed.contacts, 1, "1 contact repointed");
t.eq(m.json.repointed.deals, 1, "1 deal repointed (only the loser's)");
// loser gone
t.eq((await c.get(`/api/db/${slug}/rows/accounts`)).json.rows.length, 1, "only 1 account remains");
// survivor kept name+phone, gained website (fillBlanks)
const surv = (await c.get(`/api/db/${slug}/rows/accounts/1`)).json.row;
t.eq(surv.name, "Acme Inc", "survivor kept its own name");
t.eq(surv.website, "acme.com", "survivor filled blank website from loser");
// all children now point at survivor (id 1): 1 contact + 2 deals
t.eq((await c.get(`/api/db/${slug}/rows/contacts?where=account_id:eq:1`)).json.rows.length, 1, "contact now on survivor");
t.eq((await c.get(`/api/db/${slug}/rows/deals?where=account_id:eq:1`)).json.rows.length, 2, "both deals now on survivor");
// bad merge args
t.eq((await c.post(`/api/db/${slug}/rows/accounts/1/merge`, { from: 1 }, { token: ADMIN })).status, 400, "can't merge into self");
t.eq((await c.post(`/api/db/${slug}/rows/accounts/1/merge`, { from: 999 }, { token: ADMIN })).status, 404, "missing 'from' → 404");
t.done(); h.restore();
