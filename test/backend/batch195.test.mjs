// Batch 195 — RECENTLY-VIEWED. A per-member ring of the rows they last looked at; re-viewing bumps a row
// to the top. Covers record + newest-first order, the re-view bump, table filter, limit, clear one/all,
// per-member isolation, validation, guards.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 195");
const slug = "b195";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id1
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id2
const view = (tok, table, row) => c.post(`/api/db/${slug}/recent`, { table, row }, tok === null ? {} : { token: tok });
const recent = (tok, qs) => c.get(`/api/db/${slug}/recent${qs || ""}`, { token: tok }).then((r) => r.json.recent);
const clear = (tok, qs) => c.del(`/api/db/${slug}/recent${qs || ""}`, { token: tok });

// --- Record + newest-first ---
await view(B, "products", 5);
await view(B, "products", 7);
await view(B, "docs", 2);
let r = await recent(B);
t.eq(r.map((x) => `${x.ref_table}/${x.ref_id}`), ["docs/2", "products/7", "products/5"], "newest-first order");

// --- Re-viewing bumps to the top (no duplicate) ---
await view(B, "products", 5);
r = await recent(B);
t.eq([r.length, `${r[0].ref_table}/${r[0].ref_id}`], [3, "products/5"], "re-view bumps products/5 to the top, still 3 rows");

// --- Table filter + limit ---
t.eq((await recent(B, "?table=products")).map((x) => x.ref_id).sort((a, b) => a - b), [5, 7], "?table=products → only product views");
t.eq((await recent(B, "?limit=1")).length, 1, "?limit caps the result");

// --- Clear one, then all ---
await clear(B, "?table=products&row=5");
t.ok(!(await recent(B)).some((x) => x.ref_table === "products" && x.ref_id === 5), "clearing one removes just it");
await clear(B);
t.eq((await recent(B)).length, 0, "clearing all empties the ring");

// --- Per-member isolation ---
await view(C, "products", 99);
t.eq((await recent(C)).length, 1, "C has their own recent");
t.eq((await recent(B)).length, 0, "…B's is still empty");

// --- Validation + guards ---
t.eq((await view(B, "", 5)).status, 400, "missing table → 400");
t.eq((await view(B, "products")).status, 400, "missing row → 400");
t.eq((await view(null, "products", 5)).status, 401, "signed-out record → 401");

t.done(); h.restore();
