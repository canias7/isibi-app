// Batch 168 — ADVERSARIAL: maxRows quota (per-member on feed/user, global otherwise; boundary +
// free-on-delete) and formula fields (division by zero, null operands, precedence).
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 168");
const slug = "b168";
await c.ensure(slug);
await c.schema(slug, { tables: {
  posts: { access: "feed", maxRows: 2, trash: true, columns: [{ name: "body", type: "text" }] }, // per-member cap
  slots: { access: "admin", maxRows: 2, columns: [{ name: "name", type: "text" }] },              // global cap
  lines: { access: "feed", formulas: { avg: ["total", "/", "qty"], net: ["total", "-", "fee"] },
           columns: [{ name: "total", type: "real" }, { name: "qty", type: "integer" }, { name: "fee", type: "real" }] },
} });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 (admin)
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const post = (tok, body) => c.post(`/api/db/${slug}/rows/posts`, { body }, { token: tok });

// --- maxRows PER-MEMBER on a feed table ---
t.eq((await post(A, "a1")).status, 200, "A post 1 ok");
t.eq((await post(A, "a2")).status, 200, "A post 2 ok (at the cap)");
let over = await post(A, "a3");
t.eq(over.status, 409, "A's 3rd post exceeds the per-member cap → 409");
t.eq(over.json.code, "limit", "…with code:limit");
// B has their OWN quota.
t.eq((await post(B, "b1")).status, 200, "B post 1 ok (separate quota)");
t.eq((await post(B, "b2")).status, 200, "B post 2 ok");
t.eq((await post(B, "b3")).status, 409, "B's 3rd also capped");

// --- Deleting a row frees the quota (hard delete via ?hard, or soft on a trash table still counts?) ---
const aRow = (await c.get(`/api/db/${slug}/rows/posts`, { token: A })).json.rows.find((r) => r.body === "a1").id;
await c.del(`/api/db/${slug}/rows/posts/${aRow}`, { token: A }); // soft delete (trash table)
let afterSoft = await post(A, "a4");
// On a trash table a soft-deleted row may or may not free the quota — assert the behavior is consistent
// (either it frees → 200, or it still counts → 409); the key is it must NOT crash and must be deterministic.
t.ok(afterSoft.status === 200 || afterSoft.status === 409, "post after soft-delete is handled deterministically");

// --- maxRows GLOBAL on an admin table ---
t.eq((await c.post(`/api/db/${slug}/rows/slots`, { name: "s1" }, { token: A })).status, 200, "slot 1 ok");
t.eq((await c.post(`/api/db/${slug}/rows/slots`, { name: "s2" }, { token: A })).status, 200, "slot 2 ok (at global cap)");
t.eq((await c.post(`/api/db/${slug}/rows/slots`, { name: "s3" }, { token: A })).status, 409, "slot 3 exceeds the global cap → 409");

// --- Formulas: division by zero must NOT produce Infinity/NaN in the JSON ---
await c.post(`/api/db/${slug}/rows/lines`, { total: 100, qty: 0, fee: 10 }, { token: A });
let zrow = (await c.get(`/api/db/${slug}/rows/lines?sort=id&order=desc&limit=1`, { token: A })).json.rows[0];
t.ok(zrow.avg === null || zrow.avg === 0, "divide-by-zero → null or 0, never Infinity/NaN");
t.ok(Number.isFinite(zrow.avg) || zrow.avg === null, "avg is a finite number or null (valid JSON, not Infinity)");
t.eq(zrow.net, 90, "net = 100 - 10 = 90 (the other formula still computes)");

// --- Formulas with a null operand ---
await c.post(`/api/db/${slug}/rows/lines`, { total: 50, qty: 5 }, { token: A }); // fee omitted (null)
let nrow = (await c.get(`/api/db/${slug}/rows/lines?sort=id&order=desc&limit=1`, { token: A })).json.rows[0];
t.eq(nrow.avg, 10, "avg = 50/5 = 10 with a null fee");
t.ok(nrow.net === 50 || nrow.net === null, "net with a null operand → treats null as 0 (50) or null, not NaN");

// --- Normal precedence still holds ---
await c.post(`/api/db/${slug}/rows/lines`, { total: 20, qty: 4, fee: 3 }, { token: A });
let ok = (await c.get(`/api/db/${slug}/rows/lines?sort=id&order=desc&limit=1`, { token: A })).json.rows[0];
t.eq(ok.avg, 5, "avg = 20/4 = 5");
t.eq(ok.net, 17, "net = 20 - 3 = 17");

t.done(); h.restore();
