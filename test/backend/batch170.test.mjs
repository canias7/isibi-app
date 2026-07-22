// Batch 170 — column PROFILE / "describe this table": one call → per-column non-null/nulls/distinct/
// min/max (+ avg/sum for numeric), over the visible rows, respecting read scope + trash.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 170");
const slug = "b170";
await c.ensure(slug);
await c.schema(slug, { tables: {
  people: { access: "admin", columns: [{ name: "name", type: "text" }, { name: "age", type: "integer" }, { name: "city", type: "text" }] },
  mine: { access: "user", trash: true, columns: [{ name: "label", type: "text" }, { name: "amount", type: "real" }] },
} });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token; // id1
const U = (await c.signup(slug, "u@x.dev", "Str0ng-pass-9")).json.token;         // id2
const add = (t2, body, tok) => c.post(`/api/db/${slug}/rows/${t2}`, body, { token: tok || ADMIN });
const profile = (t2, tok) => c.get(`/api/db/${slug}/rows/${t2}/profile`, { token: tok || ADMIN }).then((r) => r.json);
const colOf = (p, name) => p.columns.find((x) => x.name === name);

// Seed people: 3 rows, one with a null city + a repeated city.
await add("people", { name: "Al", age: 30, city: "SF" });
await add("people", { name: "Bo", age: 40, city: "SF" });     // city SF repeats
await add("people", { name: "Cy", age: 50 });                  // city null

let p = await profile("people");
t.eq(p.total, 3, "total rows = 3");
// age (numeric) → min/max/avg/sum + distinct.
const age = colOf(p, "age");
t.eq(age.type, "number", "age typed numeric");
t.eq(age.non_null, 3, "age non-null = 3");
t.eq(age.nulls, 0, "age nulls = 0");
t.eq(age.distinct, 3, "age distinct = 3");
t.eq(age.min, 30, "age min = 30");
t.eq(age.max, 50, "age max = 50");
t.eq(age.avg, 40, "age avg = 40");
t.eq(age.sum, 120, "age sum = 120");
// city (text) → 1 null, 2 non-null, 1 distinct (both SF), no avg/sum.
const city = colOf(p, "city");
t.eq(city.type, "text", "city typed text");
t.eq(city.non_null, 2, "city non-null = 2");
t.eq(city.nulls, 1, "city nulls = 1 (Cy has no city)");
t.eq(city.distinct, 1, "city distinct = 1 (both SF)");
t.eq(city.min, "SF", "city min = SF");
t.ok(!("avg" in city), "text column has no avg");

// --- user-table profile is OWNER-scoped: each member profiles only their own rows ---
await add("mine", { label: "a", amount: 10 }, U);
await add("mine", { label: "b", amount: 20 }, U);
await add("mine", { label: "z", amount: 999 }, ADMIN); // admin's own row (different owner)
let pu = await profile("mine", U);
t.eq(pu.total, 2, "U profiles only their 2 rows (not admin's)");
t.eq(colOf(pu, "amount").sum, 30, "U's amount sum = 30 (their rows only, not 999)");

// --- trash respected: a soft-deleted row drops out of the profile ---
const delId = (await c.get(`/api/db/${slug}/rows/mine`, { token: U })).json.rows.find((r) => r.label === "a").id;
await c.del(`/api/db/${slug}/rows/mine/${delId}`, { token: U }); // soft delete
let pu2 = await profile("mine", U);
t.eq(pu2.total, 1, "after soft-delete, U profiles 1 row");
t.eq(colOf(pu2, "amount").sum, 20, "…and the sum reflects only the live row");

// --- empty table → total 0, columns present with zeros ---
await c.schema(slug, { tables: { empty: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
let pe = await profile("empty");
t.eq(pe.total, 0, "empty table → total 0");
t.eq(colOf(pe, "x").distinct, 0, "empty column distinct = 0 (no crash)");

// Guards.
t.eq((await c.get(`/api/db/${slug}/rows/mine/profile`)).status, 401, "user-table profile signed-out → 401");
t.eq((await c.post(`/api/db/${slug}/rows/people/profile`, {}, { token: ADMIN })).status, 405, "POST → 405 (read-only)");

t.done(); h.restore();
