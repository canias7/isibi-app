// Batch 215 — DEAL PIPELINE (kanban). Sales deals move across stages; a board view groups them by stage
// with totals. Covers create, stage normalization, board grouping + totals, flat list + filters, move stage
// (drag), win/lost closes, delete, authz (admin-only).
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 215");
const slug = "b215";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2 member
const create = (tok, body) => c.post(`/api/db/${slug}/deals`, body, tok === null ? {} : { token: tok });
const board = (tok) => c.get(`/api/db/${slug}/deals/board`, { token: tok }).then((r) => r.json);
const list = (tok, q) => c.get(`/api/db/${slug}/deals${q || ""}`, { token: tok }).then((r) => r.json);
const getD = (tok, id) => c.get(`/api/db/${slug}/deals/${id}`, { token: tok }).then((r) => r.json);
const patch = (tok, id, body) => c.patch(`/api/db/${slug}/deals/${id}`, body, { token: tok });
const del = (tok, id) => c.del(`/api/db/${slug}/deals/${id}`, { token: tok });

// --- Create (stage normalized) ---
const d1 = (await create(A, { title: "Acme deal", stage: "Qualified", amount: 5000, contact: "Jane" })).json;
t.eq(d1.stage, "qualified", "stage is normalized to a slug");
const d2 = (await create(A, { title: "Beta deal", stage: "qualified", amount: 3000 })).json.id;
const d3 = (await create(A, { title: "Gamma deal", amount: 1000 })).json.id; // default stage 'lead'

// --- Board grouping + totals ---
let bd = (await board(A)).stages;
const qual = bd.find((s) => s.stage === "qualified");
t.eq(qual.count, 2, "qualified stage has 2 deals");
t.eq(qual.total, 8000, "…total $8000");
t.ok(bd.find((s) => s.stage === "lead"), "lead stage exists");

// --- Flat list + stage filter ---
t.eq((await list(A)).deals.length, 3, "flat list has all 3");
t.eq((await list(A, "?stage=qualified")).deals.length, 2, "stage filter → 2");

// --- Move stage (kanban drag) ---
t.eq((await patch(A, d1.id, { stage: "Proposal", position: 1 })).json.id, d1.id, "move a deal to a new stage");
t.eq((await getD(A, d1.id)).deal.stage, "proposal", "…stage updated");
t.eq((await board(A)).stages.find((s) => s.stage === "qualified").count, 1, "qualified now has 1");

// --- Win closes it (drops off the open board) ---
await patch(A, d2, { status: "won" });
t.ok((await getD(A, d2)).deal.closed_at, "winning stamps closed_at");
t.ok(!(await board(A)).stages.some((s) => s.deals.some((d) => d.id === d2)), "a won deal leaves the open board");
t.eq((await list(A, "?status=won")).deals.length, 1, "…but shows in the won filter");

// --- Amount edit ---
t.eq((await patch(A, d3, { amount: 2500 })).json.id, d3, "edit amount");
t.eq((await getD(A, d3)).deal.amount_c, 250000, "…stored in cents");

// --- Delete ---
t.eq((await del(A, d3)).json.deleted, true, "admin deletes a deal");
t.eq((await getD(A, d3)).ok ?? false, false, "…gone");

// --- Validation + authz ---
t.eq((await create(A, {})).status, 400, "missing title → 400");
t.eq((await patch(A, d1.id, { status: "bogus" })).status, 400, "a bad status → 400");
t.eq((await create(B, { title: "x" })).status, 403, "a member can't create → 403");
t.eq((await c.get(`/api/db/${slug}/deals/board`, { token: B })).status, 403, "a member can't read the board → 403");
t.eq((await del(B, d1.id)).status, 403, "a member can't delete → 403");
t.eq((await create(null, { title: "x" })).status, 401, "signed-out create → 401");

t.done(); h.restore();
