// Batch 375 — CONTACT ENRICHMENT. A key/value field store per contact, kept out of the main record. Admin
// upserts fields, reads one contact, finds contacts by a field value, deletes a field or the whole contact.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 375");
const slug = "b375";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const put = (tok, body) => c.post(`/api/db/${slug}/contact-enrichment`, body, { token: tok });
const read = (tok, contact) => c.get(`/api/db/${slug}/contact-enrichment/${contact}`, { token: tok });

// --- Upsert fields ---
let r = (await put(A, { contact: "lead-1", fields: { industry: "saas", size: "50" } })).json;
t.eq(r.fields.industry, "saas", "fields stored");
t.eq(r.fields.size, "50", "…both fields");

// --- Merge more fields (upsert, not replace) ---
r = (await put(A, { contact: "lead-1", fields: { size: "75", source: "webinar" } })).json;
t.eq(r.fields.industry, "saas", "existing field preserved");
t.eq(r.fields.size, "75", "…an overlapping field is updated");
t.eq(r.fields.source, "webinar", "…and a new one added");

// --- Read one ---
t.eq((await read(A, "lead-1")).json.fields.source, "webinar", "read returns all fields");
t.eq((await read(A, "nobody")).status, 404, "an unknown contact → 404");

// --- Find by field value (segmentation) ---
await put(A, { contact: "lead-2", fields: { industry: "saas" } });
await put(A, { contact: "lead-3", fields: { industry: "retail" } });
let m = (await c.get(`/api/db/${slug}/contact-enrichment?field=industry&value=saas`, { token: A }).then((x) => x.json)).matches;
t.eq(m.length, 2, "two contacts match industry=saas");
t.eq((await c.get(`/api/db/${slug}/contact-enrichment?field=industry`, { token: A }).then((x) => x.json)).matches.length, 3, "field-only match returns all with that field");

// --- Delete one field ---
t.eq((await c.del(`/api/db/${slug}/contact-enrichment/lead-1?field=source`, { token: A })).json.deleted, true, "delete one field");
t.eq((await read(A, "lead-1")).json.fields.source, undefined, "…the field is gone");
t.ok((await read(A, "lead-1")).json.fields.industry, "…others remain");

// --- Delete whole contact ---
t.eq((await c.del(`/api/db/${slug}/contact-enrichment/lead-1`, { token: A })).json.deleted, true, "delete the whole contact");
t.eq((await read(A, "lead-1")).status, 404, "…and it's gone");
t.eq((await c.del(`/api/db/${slug}/contact-enrichment/ghost`, { token: A })).status, 404, "deleting nothing → 404");

// --- Validation + authz ---
t.eq((await put(A, { contact: "bad contact!", fields: { a: "b" } })).status, 400, "an invalid contact → 400");
t.eq((await put(A, { contact: "x", fields: "nope" })).status, 400, "fields not an object → 400");
t.eq((await put(A, { contact: "x", fields: {} })).status, 400, "no valid fields → 400");
t.eq((await put(B, { contact: "x", fields: { a: "b" } })).status, 403, "a member can't write → 403");
t.eq((await c.post(`/api/db/${slug}/contact-enrichment`, { contact: "x", fields: { a: "b" } })).status, 401, "signed-out → 401");

t.done(); h.restore();
