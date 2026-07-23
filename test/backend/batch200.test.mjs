// Batch 200 — REDIRECTS MANAGER. An admin maps an old path → a new URL (301/302/307/308); the app
// resolves a path at runtime and the hit is counted. Covers create/update, public resolve + hit count,
// path normalization, code validation, list, delete, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 200");
const slug = "b200";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2 member
const create = (tok, body) => c.post(`/api/db/${slug}/redirects`, body, tok === null ? {} : { token: tok });
const resolve = (from) => c.get(`/api/db/${slug}/redirects/resolve?from=${encodeURIComponent(from)}`);
const list = (tok) => c.get(`/api/db/${slug}/redirects`, { token: tok });
const del = (tok, id) => c.del(`/api/db/${slug}/redirects/${id}`, { token: tok });

// --- Create (admin) ---
let r = (await create(A, { from: "/old", to: "https://ex.dev/new" })).json;
t.eq(r.ok, true, "admin creates a redirect");
t.eq(r.from, "/old", "…from is stored with a leading slash");
t.eq(r.code, 301, "…default code is 301");
const id = r.id;

// --- Path normalization (missing leading slash) ---
t.eq((await create(A, { from: "bare", to: "/x", code: 302 })).json.from, "/bare", "a from without a leading slash gets one");

// --- Resolve (public) + hit count ---
let rr = (await resolve("/old")).json;
t.eq(rr.to, "https://ex.dev/new", "resolve returns the target");
t.eq(rr.code, 301, "…with the code");
await resolve("/old"); await resolve("/old");
const rows = (await list(A)).json.redirects;
t.eq(rows.find((x) => x.from_path === "/old").hits, 3, "hits counted across 3 resolves");
t.eq((await resolve("/missing")).status, 404, "unknown path → 404");

// --- Update (same from_path upserts) ---
t.eq((await create(A, { from: "/old", to: "https://ex.dev/newer", code: 308 })).json.id, id, "re-creating the same path updates in place (same id)");
t.eq((await resolve("/old")).json.to, "https://ex.dev/newer", "…resolve reflects the new target");
t.eq((await resolve("/old")).json.code, 308, "…and the new code");

// --- Code validation (bogus → 301) ---
t.eq((await create(A, { from: "/z", to: "/y", code: 999 })).json.code, 301, "an invalid code falls back to 301");

// --- List + delete (admin) ---
t.ok((await list(A)).json.redirects.length >= 3, "list returns all rules");
t.eq((await del(A, id)).json.deleted, true, "admin deletes a rule");
t.eq((await resolve("/old")).status, 404, "…resolve now 404s");
t.eq((await del(A, 999999)).status, 404, "deleting a missing id → 404");

// --- Validation + authz ---
t.eq((await create(A, { to: "/x" })).status, 400, "missing from → 400");
t.eq((await create(A, { from: "/x" })).status, 400, "missing to → 400");
t.eq((await create(B, { from: "/x", to: "/y" })).status, 403, "a member can't create → 403");
t.eq((await list(B)).status, 403, "a member can't list → 403");
t.eq((await del(B, 1)).status, 403, "a member can't delete → 403");
t.eq((await resolve("")).status, 400, "resolve with no from → 400");
t.eq((await create(null, { from: "/x", to: "/y" })).status, 401, "signed-out create → 401");

t.done(); h.restore();
