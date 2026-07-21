// Batch 27 — integrity II: maxRows quota + case-insensitive unique
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness();
const c = makeClient(worker, h);
const t = makeTally("Batch 27");

const slug = "b27";
await c.ensure(slug);
await c.schema(slug, {
  tables: {
    // global cap of 3 rows
    slots: { access: "collect", maxRows: 3, columns: { name: "text" } },
    // per-owner cap of 2 rows (feed)
    todos: { access: "feed", maxRows: 2, columns: { title: "text" } },
    // case-insensitive unique handle
    users2: { access: "collect", uniqueCI: ["handle"], columns: [{ name: "handle", type: "text" }] },
  },
});
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id 1
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id 2

// --- global maxRows: 3 allowed, 4th rejected 409 ---
for (let i = 0; i < 3; i++) t.ok((await c.post(`/api/db/${slug}/rows/slots`, { name: "s" + i })).json.ok, "slot " + i + " inserted");
const over = await c.post(`/api/db/${slug}/rows/slots`, { name: "s3" });
t.ok(over.status === 409 && over.json.code === "limit", "4th insert -> 409 limit");
// count stays at 3 (owner read)
// (via collect we can't read; assert the error is terminal above)

// --- per-owner maxRows: each owner gets their own 2 ---
t.ok((await c.post(`/api/db/${slug}/rows/todos`, { title: "a1" }, { token: A })).json.ok, "A todo 1");
t.ok((await c.post(`/api/db/${slug}/rows/todos`, { title: "a2" }, { token: A })).json.ok, "A todo 2");
t.ok((await c.post(`/api/db/${slug}/rows/todos`, { title: "a3" }, { token: A })).status === 409, "A todo 3 -> 409 (own cap)");
// B still has their own quota
t.ok((await c.post(`/api/db/${slug}/rows/todos`, { title: "b1" }, { token: B })).json.ok, "B todo 1 (separate quota)");
t.ok((await c.post(`/api/db/${slug}/rows/todos`, { title: "b2" }, { token: B })).json.ok, "B todo 2");
t.ok((await c.post(`/api/db/${slug}/rows/todos`, { title: "b3" }, { token: B })).status === 409, "B todo 3 -> 409");

// --- case-insensitive unique ---
t.ok((await c.post(`/api/db/${slug}/rows/users2`, { handle: "Alice" })).json.ok, "handle Alice ok");
const dup = await c.post(`/api/db/${slug}/rows/users2`, { handle: "alice" });
t.ok(dup.status === 409 && dup.json.code === "duplicate", "handle 'alice' collides with 'Alice' -> 409 duplicate");
const dup2 = await c.post(`/api/db/${slug}/rows/users2`, { handle: "ALICE" });
t.ok(dup2.status === 409, "handle 'ALICE' also collides");
t.ok((await c.post(`/api/db/${slug}/rows/users2`, { handle: "bob" })).json.ok, "different handle 'bob' ok");

t.done();
h.restore();
