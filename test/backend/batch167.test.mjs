// Batch 167 — ADVERSARIAL: per-row sharing / collaboration. A 'view' collaborator can read but NOT
// edit; an 'edit' collaborator can edit but NOT delete (owner-only); only the owner manages the share
// list; revoke instantly cuts access; you can't share a row you don't own.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 167");
const slug = "b167";
await c.ensure(slug);
await c.schema(slug, { tables: { docs: { access: "user", columns: [{ name: "title", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 owner
const V = (await c.signup(slug, "v@x.dev", "Str0ng-pass-9")).json.token; // id2 viewer
const E = (await c.signup(slug, "e@x.dev", "Str0ng-pass-9")).json.token; // id3 editor
const N = (await c.signup(slug, "n@x.dev", "Str0ng-pass-9")).json.token; // id4 nobody
// A owns a doc.
await c.post(`/api/db/${slug}/rows/docs`, { title: "plan" }, { token: A });
const id = (await c.get(`/api/db/${slug}/rows/docs`, { token: A })).json.rows[0].id;
const getById = (tok) => c.get(`/api/db/${slug}/rows/docs/${id}`, { token: tok });
const sharedList = (tok) => c.get(`/api/db/${slug}/rows/docs?shared=1`, { token: tok }).then((r) => r.json.rows.map((x) => x.id));

// Before sharing, others can't see it.
t.eq((await getById(V)).status, 404, "before sharing, V can't read A's row");

// A shares view→V, edit→E.
t.eq((await c.post(`/api/db/${slug}/rows/docs/${id}/share`, { user: 2, perm: "view" }, { token: A })).status, 200, "share view with V");
t.eq((await c.post(`/api/db/${slug}/rows/docs/${id}/share`, { user: 3, perm: "edit" }, { token: A })).status, 200, "share edit with E");

// Both can READ it now (by id + in their 'shared with me' list).
t.eq((await getById(V)).status, 200, "V (view) can read the shared row");
t.eq((await getById(E)).status, 200, "E (edit) can read the shared row");
t.ok((await sharedList(V)).includes(id), "the row appears in V's shared-with-me list");

// --- View collaborator CANNOT edit or delete ---
t.eq((await c.patch(`/api/db/${slug}/rows/docs/${id}`, { title: "hacked" }, { token: V })).status, 404, "a view collaborator can't PATCH");
t.eq((await c.del(`/api/db/${slug}/rows/docs/${id}`, { token: V })).status, 404, "a view collaborator can't DELETE");

// --- Edit collaborator CAN edit, but CANNOT delete (delete stays owner-only) ---
t.eq((await c.patch(`/api/db/${slug}/rows/docs/${id}`, { title: "E-edited" }, { token: E })).status, 200, "an edit collaborator can PATCH");
t.eq((await c.get(`/api/db/${slug}/rows/docs/${id}`, { token: A })).json.row.title, "E-edited", "…and the edit took effect");
t.eq((await c.del(`/api/db/${slug}/rows/docs/${id}`, { token: E })).status, 404, "an edit collaborator still can't DELETE (owner-only)");

// --- Only the OWNER manages the share list ---
t.eq((await c.get(`/api/db/${slug}/rows/docs/${id}/share`, { token: E })).status, 404, "a collaborator can't list the shares");
t.eq((await c.post(`/api/db/${slug}/rows/docs/${id}/share`, { user: 4, perm: "edit" }, { token: E })).status, 404, "a collaborator can't add new shares");
t.eq((await c.get(`/api/db/${slug}/rows/docs/${id}/share`, { token: A })).json.shares.length, 2, "the owner sees both shares");

// --- Nobody (unshared) still sees nothing ---
t.eq((await getById(N)).status, 404, "an unshared member can't read the row");

// --- Revoke instantly cuts access ---
await c.del(`/api/db/${slug}/rows/docs/${id}/share/3`, { token: A }); // revoke E's edit
t.eq((await getById(E)).status, 404, "after revoke, E can't read the row");
t.eq((await c.patch(`/api/db/${slug}/rows/docs/${id}`, { title: "x" }, { token: E })).status, 404, "…and can't edit it");

// --- You can't share a row you don't own ---
t.eq((await c.post(`/api/db/${slug}/rows/docs/${id}/share`, { user: 4, perm: "view" }, { token: V })).status, 404, "V (not the owner) can't share A's row");

t.done(); h.restore();
