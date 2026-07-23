// Batch 206 — CANNED RESPONSES. A staff-only library of reusable reply templates keyed by slug. Entirely
// admin-scoped. Covers upsert, read one, list, update, delete, validation, authz (members fully blocked).
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 206");
const slug = "b206";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2 member
const put = (tok, key, body) => c.post(`/api/db/${slug}/canned/${key}`, body, tok === null ? {} : { token: tok });
const read = (tok, key) => c.get(`/api/db/${slug}/canned/${key}`, { token: tok });
const del = (tok, key) => c.del(`/api/db/${slug}/canned/${key}`, { token: tok });
const list = (tok) => c.get(`/api/db/${slug}/canned`, { token: tok });

// --- Upsert + read (admin) ---
t.eq((await put(A, "greeting", { title: "Hello", body: "Thanks for reaching out!" })).json.slug, "greeting", "admin creates a canned response");
t.eq((await read(A, "greeting")).json.canned.body, "Thanks for reaching out!", "admin reads it");

// --- Update ---
await put(A, "greeting", { title: "Hi", body: "Thanks for contacting us!" });
t.eq((await read(A, "greeting")).json.canned.body, "Thanks for contacting us!", "re-posting updates the body");
t.eq((await read(A, "greeting")).json.canned.title, "Hi", "…and the title");

// --- List ---
await put(A, "closing", { body: "Let us know if there's anything else." });
t.eq((await list(A)).json.canned.length, 2, "admin lists all canned responses");

// --- Delete ---
t.eq((await del(A, "closing")).json.deleted, true, "admin deletes one");
t.eq((await read(A, "closing")).status, 404, "…it's gone");
t.eq((await del(A, "closing")).status, 404, "deleting a missing one → 404");

// --- Validation + authz (members fully blocked) ---
t.eq((await put(A, "empty", { title: "x" })).status, 400, "missing body → 400");
t.eq((await read(A, "nope")).status, 404, "unknown slug → 404");
t.eq((await put(B, "hax", { body: "x" })).status, 403, "a member can't write → 403");
t.eq((await read(B, "greeting")).status, 403, "a member can't read → 403");
t.eq((await list(B)).status, 403, "a member can't list → 403");
t.eq((await del(B, "greeting")).status, 403, "a member can't delete → 403");
t.eq((await list(null)).status, 401, "signed-out → 401");

t.done(); h.restore();
