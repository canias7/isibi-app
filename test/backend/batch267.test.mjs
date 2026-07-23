// Batch 267 — CHANGELOG / RELEASE NOTES. An admin publishes versioned entries; the public reads the
// published ones newest-first. Covers create, public list (published only, newest first), draft hiding,
// admin all-list, patch (publish flip), delete, limit, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 267");
const slug = "b267";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const add = (tok, body) => c.post(`/api/db/${slug}/changelog`, body, tok === null ? {} : { token: tok });
const list = (q) => c.get(`/api/db/${slug}/changelog${q || ""}`).then((r) => r.json);
const all = (tok) => c.get(`/api/db/${slug}/changelog/all`, { token: tok }).then((r) => r.json);
const patch = (tok, id, body) => c.patch(`/api/db/${slug}/changelog/${id}`, body, { token: tok });
const del = (tok, id) => c.del(`/api/db/${slug}/changelog/${id}`, { token: tok });

// --- Create entries with explicit release dates ---
const e1 = (await add(A, { version: "1.0.0", title: "First release", body: "Hello world", kind: "feature", released: "2026-01-01" })).json.id;
await add(A, { version: "1.1.0", title: "New feature", released: "2026-02-01" });
const draft = (await add(A, { version: "1.2.0", title: "Upcoming", published: false, released: "2026-03-01" })).json.id;
t.ok(e1 && draft, "admin adds changelog entries");

// --- Public list = published only, newest first ---
let l = (await list()).entries;
t.eq(l.length, 2, "public sees 2 published entries (draft hidden)");
t.eq(l[0].version, "1.1.0", "…newest release first");
t.eq(l[0].title, "New feature", "…with the title");

// --- Admin all = includes the draft ---
t.eq((await all(A)).entries.length, 3, "admin sees all 3 incl. the draft");
t.ok((await all(A)).entries.some((x) => x.id === draft && x.published === false), "…the draft shows published:false");

// --- Publish the draft ---
t.eq((await patch(A, draft, { published: true })).json.id, draft, "admin publishes the draft");
t.eq((await list()).entries.length, 3, "…now 3 public entries");
t.eq((await list()).entries[0].version, "1.2.0", "…and 1.2.0 (Mar) is newest");

// --- Edit ---
await patch(A, e1, { title: "Initial release", body: "Updated notes" });
t.ok((await all(A)).entries.find((x) => x.id === e1).title === "Initial release", "admin edits an entry");

// --- Limit ---
t.eq((await list("?limit=1")).entries.length, 1, "limit caps the list");

// --- Delete ---
t.eq((await del(A, draft)).json.deleted, true, "admin deletes an entry");
t.eq((await list()).entries.length, 2, "…back to 2 public");

// --- Validation + authz ---
t.eq((await add(A, { version: "9" })).status, 400, "missing title → 400");
t.eq((await add(B, { title: "hax" })).status, 403, "a member can't add → 403");
t.eq((await all(B)).status ?? 403, 403, "a member can't read drafts → 403");
t.eq((await c.get(`/api/db/${slug}/changelog/all`, { token: B })).status, 403, "…confirmed 403");
t.eq((await patch(B, e1, { title: "x" })).status, 403, "a member can't edit → 403");
t.eq((await del(A, 999999)).status, 404, "deleting a missing entry → 404");
t.eq((await add(null, { title: "x" })).status, 401, "signed-out add → 401");

t.done(); h.restore();
