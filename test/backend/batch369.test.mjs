// Batch 369 — ACCOUNT HIERARCHY. Parent/child tree of org nodes. Admin upserts; reads give ancestors+children,
// the descendant subtree, or the whole forest. Cycles refused; delete reparents children. Covers all of that.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 369");
const slug = "b369";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const node = (tok, body) => c.post(`/api/db/${slug}/account-hierarchy`, body, { token: tok });

// --- Build a tree: root → div-a → team-1, team-2; root → div-b ---
t.eq((await node(A, { key: "root", name: "HQ" })).json.node.key, "root", "create a root");
await node(A, { key: "div-a", name: "Division A", parent: "root" });
await node(A, { key: "div-b", name: "Division B", parent: "root" });
await node(A, { key: "team-1", parent: "div-a" });
await node(A, { key: "team-2", parent: "div-a" });

// --- Node detail: ancestors + children ---
let d = (await c.get(`/api/db/${slug}/account-hierarchy/team-1`).then((r) => r.json));
t.eq(d.node.parent, "div-a", "team-1's parent is div-a");
t.eq(d.ancestors.map((a) => a.key).join(","), "div-a,root", "…ancestors walk up to the root");
d = (await c.get(`/api/db/${slug}/account-hierarchy/div-a`).then((r) => r.json));
t.eq(d.children.length, 2, "div-a has 2 children");

// --- Descendants (flattened subtree) ---
let desc = (await c.get(`/api/db/${slug}/account-hierarchy/root/descendants`).then((r) => r.json)).descendants;
t.eq(desc.length, 4, "root has 4 descendants (div-a, div-b, team-1, team-2)");

// --- Forest (nested) ---
let forest = (await c.get(`/api/db/${slug}/account-hierarchy`).then((r) => r.json)).tree;
t.eq(forest.length, 1, "one root in the forest");
t.eq(forest[0].children.length, 2, "…with two divisions");

// --- Cycle refused ---
t.eq((await node(A, { key: "root", parent: "team-1" })).status, 400, "making root a child of its own descendant → 400 (cycle)");
t.eq((await node(A, { key: "div-a", parent: "div-a" })).status, 400, "self-parent → 400");
t.eq((await node(A, { key: "x", parent: "ghost" })).status, 400, "a missing parent → 400");

// --- Reparent on move (upsert) ---
await node(A, { key: "team-1", parent: "div-b" });
t.eq((await c.get(`/api/db/${slug}/account-hierarchy/team-1`).then((r) => r.json)).node.parent, "div-b", "moving a node updates its parent");

// --- Delete reparents children ---
// team-1 now under div-b; delete div-b → team-1 should move up to root.
t.eq((await c.del(`/api/db/${slug}/account-hierarchy/div-b`, { token: A })).json.reparented_to, "root", "deleting div-b reparents its children to root");
t.eq((await c.get(`/api/db/${slug}/account-hierarchy/team-1`).then((r) => r.json)).node.parent, "root", "…team-1 now hangs off root");

// --- Validation + authz ---
t.eq((await c.get(`/api/db/${slug}/account-hierarchy/nope`)).status, 404, "unknown node → 404");
t.eq((await node(B, { key: "z" })).status, 403, "a member can't define nodes → 403");
t.eq((await c.post(`/api/db/${slug}/account-hierarchy`, { key: "z" })).status, 401, "signed-out → 401");
t.eq((await node(A, { key: "bad key!" })).status, 400, "an invalid key → 400");

t.done(); h.restore();
