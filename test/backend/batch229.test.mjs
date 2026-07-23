// Batch 229 — SERVICE CATALOG. A bookable/sellable service list (name × duration × price × category).
// Covers create + price cents, public list (active-only) vs admin all, category filter, get one, patch,
// active toggle hides from public, delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 229");
const slug = "b229";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const create = (tok, body) => c.post(`/api/db/${slug}/services`, body, tok === null ? {} : { token: tok });
const list = (tok, q) => c.get(`/api/db/${slug}/services${q || ""}`, tok ? { token: tok } : {}).then((r) => r.json);
const getS = (id) => c.get(`/api/db/${slug}/services/${id}`).then((r) => r.json);
const patch = (tok, id, body) => c.patch(`/api/db/${slug}/services/${id}`, body, { token: tok });
const del = (tok, id) => c.del(`/api/db/${slug}/services/${id}`, { token: tok });

// --- Create (price in cents) ---
const s1 = (await create(A, { name: "Haircut", duration: 30, price: 45.5, category: "hair" })).json.id;
const s2 = (await create(A, { name: "Color", duration: 90, price: 120, category: "hair" })).json.id;
await create(A, { name: "Massage", duration: 60, price: 80, category: "spa" });
t.ok(s1 && s2, "created services");

// --- Get one ---
let g = (await getS(s1)).service;
t.eq(g.name, "Haircut", "reads the service");
t.eq(g.price, 45.5, "…price back in dollars");
t.eq(g.price_c, 4550, "…and cents");
t.eq(g.duration_min, 30, "…duration in minutes");

// --- Public list = active only ---
t.eq((await list(null)).services.length, 3, "public sees 3 active services");
t.eq((await list(null, "?category=hair")).services.length, 2, "category filter → 2 hair services");

// --- Patch: deactivate hides from public ---
await patch(A, s2, { active: false });
t.eq((await list(null)).services.length, 2, "deactivated service hidden from public list");
t.eq((await list(A, "?all=1")).services.length, 3, "…admin ?all=1 still sees it");

// --- Patch price + name ---
t.eq((await patch(A, s1, { price: 50, name: "Premium Haircut" })).json.id, s1, "admin edits price + name");
g = (await getS(s1)).service;
t.eq(g.price, 50, "…price updated");
t.eq(g.name, "Premium Haircut", "…name updated");

// --- Delete ---
t.eq((await del(A, s1)).json.deleted, true, "admin deletes a service");
t.eq((await getS(s1)).ok ?? false, false, "…it's gone");

// --- Validation + authz ---
t.eq((await create(A, {})).status, 400, "missing name → 400");
t.eq((await create(A, { name: "x", duration: -5 })).status, 400, "negative duration → 400");
t.eq((await getS(999999)).ok ?? false, false, "a missing service → not ok");
t.eq((await create(B, { name: "x" })).status, 403, "a member can't create → 403");
t.eq((await patch(B, s2, { price: 1 })).status, 403, "a member can't patch → 403");
t.eq((await del(B, s2)).status, 403, "a member can't delete → 403");
t.eq((await create(null, { name: "x" })).status, 401, "signed-out create → 401");

t.done(); h.restore();
