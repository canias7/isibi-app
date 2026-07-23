// Batch 283 — CONTACTS (CRM). Admin-managed address book with dedupe-on-email and merge. Covers capture,
// dedupe (repeat email fills gaps, no duplicate), list + search, get, patch, merge (folds one into another and
// fills survivor gaps + hides the loser), delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 283");
const slug = "b283";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2 member
const create = (tok, body) => c.post(`/api/db/${slug}/contacts`, body, tok === null ? {} : { token: tok });
const list = (tok, q) => c.get(`/api/db/${slug}/contacts${q || ""}`, { token: tok }).then((r) => r.json);
const get = (tok, id) => c.get(`/api/db/${slug}/contacts/${id}`, { token: tok });
const patch = (tok, id, body) => c.patch(`/api/db/${slug}/contacts/${id}`, body, { token: tok });
const merge = (tok, body) => c.post(`/api/db/${slug}/contacts/merge`, body, { token: tok });
const del = (tok, id) => c.del(`/api/db/${slug}/contacts/${id}`, { token: tok });

// --- Capture ---
const id1 = (await create(A, { email: "Jane@Example.com", name: "Jane Doe", company: "Acme" })).json.id;
t.ok(id1, "admin captures a contact");

// --- Dedupe on email (case-insensitive), fills gaps only ---
let r = (await create(A, { email: "jane@example.com", phone: "555-1234" })).json;
t.eq(r.deduped, true, "the same email dedupes onto the existing row");
t.eq(r.id, id1, "…same id");
let g = (await get(A, id1)).json.contact;
t.eq(g.phone, "555-1234", "…the missing phone was filled");
t.eq(g.name, "Jane Doe", "…the existing name was NOT overwritten");

// --- A different email is a new contact ---
const id2 = (await create(A, { email: "bob@example.com", name: "Bob" })).json.id;
t.ok(id2 && id2 !== id1, "a new email creates a new contact");

// --- List + search ---
t.eq((await list(A)).contacts.length, 2, "two contacts listed");
t.eq((await list(A, "?q=acme")).contacts.length, 1, "search by company finds one");

// --- Patch ---
t.eq((await patch(A, id2, { company: "Globex" })).json.contact.company, "Globex", "admin edits a contact");

// --- Merge (fold id2 into id1) ---
let m = (await merge(A, { from: id2, into: id1 })).json;
t.eq(m.from, id2, "merge reports the folded id");
t.eq(m.merged.company, "Acme", "…survivor keeps its own non-empty field");
// id1 had no... it had company Acme; loser had Globex — survivor keeps Acme (gap-fill only)
t.eq((await get(A, id2)).json.contact.merged_into, id1, "the loser now points at the survivor");
t.eq((await list(A)).contacts.length, 1, "…and drops out of the default list");
t.eq((await list(A, "?all=1")).contacts.length, 2, "…but shows with all=1");

// --- Merge gap-fill: survivor picks up the loser's missing field ---
const id3 = (await create(A, { email: "carol@x.dev" })).json.id; // no name
const id4 = (await create(A, { email: "carol2@x.dev", name: "Carol", phone: "999" })).json.id;
await merge(A, { from: id4, into: id3 });
t.eq((await get(A, id3)).json.contact.name, "Carol", "the survivor gap-fills name from the loser");

// --- Delete ---
t.eq((await del(A, id1)).json.deleted, true, "admin deletes a contact");

// --- Validation + authz ---
t.eq((await create(A, {})).status, 400, "an empty contact → 400");
t.eq((await merge(A, { from: id3, into: id3 })).status, 400, "merging into itself → 400");
t.eq((await merge(A, { from: 999999, into: id3 })).status, 404, "merging a missing contact → 404");
t.eq((await create(B, { email: "x@y.dev" })).status, 403, "a member can't manage contacts → 403");
t.eq((await c.get(`/api/db/${slug}/contacts`)).status, 401, "signed-out → 401");

t.done(); h.restore();
