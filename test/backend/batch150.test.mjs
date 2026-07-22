// Batch 150 — bulk update/delete by filter: apply one change to every matching row in a single
// statement. Admin-only; a filter is required; affected rows are capped; delete soft-deletes on
// a trash table and hard-deletes otherwise.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 150");
const slug = "b150";
await c.ensure(slug);
await c.schema(slug, { tables: {
  items: { access: "admin", trash: true, columns: [{ name: "status", type: "text" }] }, // trash → soft delete
  flags: { access: "admin", columns: [{ name: "state", type: "text" }] },               // no trash → hard delete
} });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token; // id1
const MEMBER = (await c.signup(slug, "m@x.dev", "Str0ng-pass-9")).json.token;    // id2
const addItem = (s) => c.post(`/api/db/${slug}/rows/items`, { status: s }, { token: ADMIN });
const bulk = (table, body, tok) => c.post(`/api/db/${slug}/rows/${table}/bulk`, body, { token: tok || ADMIN });
const items = async () => (await c.get(`/api/db/${slug}/rows/items?limit=200`, { token: ADMIN })).json.rows;

// Seed 3 draft + 2 done.
for (const s of ["draft", "draft", "draft", "done", "done"]) await addItem(s);

// Bulk update: draft → archived.
let u = await bulk("items", { op: "update", where: ["status:eq:draft"], set: { status: "archived" } });
t.eq(u.json.affected, 3, "bulk update touched the 3 draft rows");
let rows = await items();
t.eq(rows.filter((r) => r.status === "archived").length, 3, "3 rows are now archived");
t.eq(rows.filter((r) => r.status === "draft").length, 0, "no draft rows remain");
t.eq(rows.filter((r) => r.status === "done").length, 2, "done rows untouched");

// Bulk delete on a TRASH table → soft delete (rows leave the default list but the op reports soft).
let d = await bulk("items", { op: "delete", where: ["status:eq:done"] });
t.eq(d.json.affected, 2, "bulk delete matched the 2 done rows");
t.eq(d.json.soft, true, "delete on a trash table is soft");
t.eq((await items()).filter((r) => r.status === "done").length, 0, "soft-deleted rows gone from the default list");
t.eq((await items()).length, 3, "3 archived rows still live");

// Bulk delete on a NON-trash table → hard delete.
for (const s of ["off", "off", "off", "on", "on"]) await c.post(`/api/db/${slug}/rows/flags`, { state: s }, { token: ADMIN });
let df = await bulk("flags", { op: "delete", where: ["state:eq:off"] });
t.eq(df.json.affected, 3, "hard delete removed 3 off rows");
t.eq(df.json.soft, false, "delete on a non-trash table is hard");
t.eq((await c.get(`/api/db/${slug}/rows/flags`, { token: ADMIN })).json.rows.length, 2, "2 flags left");

// limit caps the number of affected rows.
for (const s of ["x", "x", "x", "x"]) await c.post(`/api/db/${slug}/rows/flags`, { state: s }, { token: ADMIN });
let lim = await bulk("flags", { op: "update", where: ["state:eq:x"], set: { state: "y" }, limit: 2 });
t.eq(lim.json.affected, 2, "limit capped the update to 2 rows");
t.eq((await c.get(`/api/db/${slug}/rows/flags?where=state:eq:x`, { token: ADMIN })).json.rows.length, 2, "2 x rows remain uncapped");

// all:true affects everything (explicit opt-in for a whole-table op).
let all = await bulk("items", { op: "update", all: true, set: { status: "reset" } });
t.eq(all.json.affected, 3, "all:true updated all 3 live rows");

// Guards.
t.eq((await bulk("items", { op: "update", set: { status: "z" } })).status, 400, "no where + no all:true → 400");
t.eq((await bulk("items", { op: "update", where: ["status:eq:reset"] })).status, 400, "update without set → 400");
t.eq((await bulk("items", { op: "delete", where: ["status:eq:reset"], all: false }) && await bulk("items", { op: "frobnicate", where: ["status:eq:x"] })).status, 400, "invalid op → 400");
t.eq((await bulk("nope", { op: "delete", all: true })).status, 404, "unknown table → 404");
t.eq((await bulk("items", { op: "update", where: ["status:eq:reset"], set: { status: "z" } }, MEMBER)).status, 403, "non-admin → 403");
t.eq((await c.post(`/api/db/${slug}/rows/items/bulk`, { op: "delete", all: true })).status, 401, "signed-out → 401");
// A `set` with only unknown columns is rejected.
t.eq((await bulk("items", { op: "update", where: ["status:eq:reset"], set: { bogus: 1 } })).status, 400, "set with no valid column → 400");

t.done(); h.restore();
