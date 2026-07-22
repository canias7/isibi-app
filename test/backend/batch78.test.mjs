// Batch 78 — duplicate check ("does this contact already exist?" lookup, OR across keys,
// case-insensitive, exclude-self for edits, read-visibility scoped)
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 78");
const slug = "b78";
await c.ensure(slug);
await c.schema(slug, { tables: {
  contacts: { access: "admin", columns: [{ name: "name", type: "text" }, { name: "email", type: "text" }, { name: "phone", type: "text" }] },
  myleads: { access: "user", columns: [{ name: "email", type: "text" }] },
  intake: { access: "collect", columns: [{ name: "email", type: "text", format: "email" }] },
} });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token; // id1
const UA = (await c.signup(slug, "ua@x.dev", "Str0ng-pass-9")).json.token; // id2
const UB = (await c.signup(slug, "ub@x.dev", "Str0ng-pass-9")).json.token; // id3

// seed contacts
await c.post(`/api/db/${slug}/rows/contacts`, { name: "Jane Doe", email: "jane@acme.com", phone: "555-1000" }, { token: ADMIN }); // id1
await c.post(`/api/db/${slug}/rows/contacts`, { name: "John Roe", email: "john@acme.com", phone: "555-2000" }, { token: ADMIN }); // id2

// exact-ish match by email (case-insensitive + trimmed)
let d1 = (await c.get(`/api/db/${slug}/rows/contacts/duplicates?email=%20JANE@ACME.COM%20`)).json;
t.ok(d1.ok && d1.count === 1, "email match found (case-insensitive, trimmed)");
t.eq(d1.matches[0].id, 1, "matched the right contact");
t.eq(d1.on, ["email"], "reports which keys were checked");

// match by phone
t.eq((await c.get(`/api/db/${slug}/rows/contacts/duplicates?phone=555-2000`)).json.matches[0].id, 2, "phone match found");

// OR across keys — a match on EITHER email or phone counts
let dor = (await c.get(`/api/db/${slug}/rows/contacts/duplicates?email=jane@acme.com&phone=555-2000`)).json;
t.eq(dor.count, 2, "OR across keys → both contacts matched");
t.eq(dor.on.sort(), ["email", "phone"], "both keys reported");

// no match → empty
t.eq((await c.get(`/api/db/${slug}/rows/contacts/duplicates?email=nobody@nowhere.com`)).json.count, 0, "no duplicate → empty");

// exclude self (checking during an edit of contact #1 shouldn't flag itself)
t.eq((await c.get(`/api/db/${slug}/rows/contacts/duplicates?email=jane@acme.com&exclude=1`)).json.count, 0, "exclude=<id> skips the row being edited");

// unknown columns are ignored; a check with ONLY unknown cols → 400
t.eq((await c.get(`/api/db/${slug}/rows/contacts/duplicates?bogus=1&email=jane@acme.com`)).json.on, ["email"], "unknown column ignored");
t.eq((await c.get(`/api/db/${slug}/rows/contacts/duplicates?bogus=1`)).status, 400, "no valid key → 400");

// POST/other methods rejected
t.eq((await c.post(`/api/db/${slug}/rows/contacts/duplicates?email=x`, {})).status, 405, "read-only (POST → 405)");

// collect (write-only) table → no lookups
t.eq((await c.get(`/api/db/${slug}/rows/intake/duplicates?email=a@b.com`, { token: ADMIN })).status, 403, "no dupe lookup on a collect table");

// user table → scoped to the caller's OWN rows (no cross-user leak)
await c.post(`/api/db/${slug}/rows/myleads`, { email: "shared@x.com" }, { token: UA }); // owned by UA
t.eq((await c.get(`/api/db/${slug}/rows/myleads/duplicates?email=shared@x.com`, { token: UA })).json.count, 1, "owner sees their own duplicate");
t.eq((await c.get(`/api/db/${slug}/rows/myleads/duplicates?email=shared@x.com`, { token: UB })).json.count, 0, "another user does NOT see someone else's row (no leak)");
t.eq((await c.get(`/api/db/${slug}/rows/myleads/duplicates?email=shared@x.com`, {})).status, 401, "user-table lookup requires sign-in");

t.done(); h.restore();
