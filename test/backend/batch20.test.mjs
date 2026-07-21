// Batch 20 — ordered lists / manual positions (auto-append + /move reorder)
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness();
const c = makeClient(worker, h);
const t = makeTally("Batch 20");

const slug = "b20";
await c.ensure(slug);
await c.schema(slug, {
  tables: {
    tasks: { access: "feed", ordered: true, columns: { title: "text" } },
    plain: { access: "feed", columns: { title: "text" } },
  },
});
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token;
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token;

const idsByTitle = async (tok) => {
  const rows = (await c.get(`/api/db/${slug}/rows/tasks?sort=position&order=asc&limit=200`, { token: tok })).json.rows;
  return rows;
};
const order = (rows, owner) => rows.filter((r) => r.owner_id === owner).map((r) => r.title);

// insert A,B,C for owner A (owner_id 1)
for (const ti of ["A", "B", "C"]) await c.post(`/api/db/${slug}/rows/tasks`, { title: ti }, { token: A });
let rows = await idsByTitle(A);
t.eq(order(rows, 1), ["A", "B", "C"], "auto-position -> insertion order A,B,C");
t.eq(rows.filter((r) => r.owner_id === 1).map((r) => r.position), [1, 2, 3], "positions 1,2,3");

// append: insert D -> goes to end (position 4)
await c.post(`/api/db/${slug}/rows/tasks`, { title: "D" }, { token: A });
rows = await idsByTitle(A);
const map = {}; for (const r of rows) if (r.owner_id === 1) map[r.title] = r.id; // built AFTER all 4 inserts
t.eq(order(rows, 1), ["A", "B", "C", "D"], "new insert appends to end");

// move C before A -> [C,A,B,D]
let mv = await c.post(`/api/db/${slug}/rows/tasks/${map.C}/move`, { before: map.A }, { token: A });
t.ok(mv.json && mv.json.ok, "move C before A ok");
rows = await idsByTitle(A);
t.eq(order(rows, 1), ["C", "A", "B", "D"], "C moved before A");

// move C after B -> [A,B,C,D]
await c.post(`/api/db/${slug}/rows/tasks/${map.C}/move`, { after: map.B }, { token: A });
rows = await idsByTitle(A);
t.eq(order(rows, 1), ["A", "B", "C", "D"], "C moved after B (midpoint of B..D)");

// move A after B (midpoint B..C) -> [B,A,C,D]
await c.post(`/api/db/${slug}/rows/tasks/${map.A}/move`, { after: map.B }, { token: A });
rows = await idsByTitle(A);
t.eq(order(rows, 1), ["B", "A", "C", "D"], "A moved after B via midpoint");

// move D with to:0 -> D first
await c.post(`/api/db/${slug}/rows/tasks/${map.D}/move`, { to: 0 }, { token: A });
rows = await idsByTitle(A);
t.eq(order(rows, 1), ["D", "B", "A", "C"], "D moved to:0 -> first");

// per-owner scope: B's first task is position 1 (independent of A's rows)
await c.post(`/api/db/${slug}/rows/tasks`, { title: "Bx" }, { token: B });
rows = await idsByTitle(B);
const bRow = rows.find((r) => r.owner_id === 2 && r.title === "Bx");
t.ok(bRow && bRow.position === 1, "B's first task position=1 (per-owner scope, got " + (bRow && bRow.position) + ")");

// B cannot move A's row (not in B's scope) -> 404
const cross = await c.post(`/api/db/${slug}/rows/tasks/${map.A}/move`, { to: 0 }, { token: B });
t.ok(cross.status === 404, "B moving A's row -> 404 (scoped)");

// non-ordered table -> 400
await c.post(`/api/db/${slug}/rows/plain`, { title: "z" }, { token: A });
const pl = (await c.get(`/api/db/${slug}/rows/plain`, { token: A })).json.rows[0];
const nm = await c.post(`/api/db/${slug}/rows/plain/${pl.id}/move`, { to: 1 }, { token: A });
t.ok(nm.status === 400 && /ordered/.test(nm.json.error), "move on non-ordered table -> 400");

t.done();
h.restore();
