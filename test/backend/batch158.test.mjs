// Batch 158 — ADVERSARIAL: team-scoped data security + mass-assignment. Probes for privilege
// escalation and cross-team leakage on a teamScope table (the primitive that touched the core
// CRUD path), plus forged owner_id/team_id via the request body.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 158");
const slug = "b158";
await c.ensure(slug);
await c.schema(slug, { tables: { docs: { access: "user", teamScope: true, trash: true, columns: [{ name: "title", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const X = (await c.signup(slug, "x@x.dev", "Str0ng-pass-9")).json.token; // id3
const mk = (tok, body) => c.post(`/api/db/${slug}/rows/docs`, body, { token: tok });
const rows = (tok) => c.get(`/api/db/${slug}/rows/docs`, { token: tok }).then((r) => r.json.rows);

// Team 1 = {A, B}. Team 2 = {A, X}. B and X share no team.
const t1 = (await c.post(`/api/db/${slug}/teams`, { name: "T1" }, { token: A })).json.id;
await c.post(`/api/db/${slug}/teams/${t1}/members`, { user: 2 }, { token: A }); // B
const t2 = (await c.post(`/api/db/${slug}/teams`, { name: "T2" }, { token: A })).json.id;
await c.post(`/api/db/${slug}/teams/${t2}/members`, { user: 3 }, { token: A }); // X

// A creates a doc in team 1.
const d1 = await mk(A, { title: "secret", team_id: t1 });
const d1Id = (await rows(A)).find((r) => r.title === "secret").id;

// --- Cross-team leakage ---
t.ok((await rows(B)).some((r) => r.title === "secret"), "B (same team) can see it"); // sanity
t.ok(!(await rows(X)).some((r) => r.title === "secret"), "X (other team) can't see team-1 rows in a list");
t.eq((await c.get(`/api/db/${slug}/rows/docs/${d1Id}`, { token: X })).status, 404, "X can't fetch a team-1 row by id");

// --- Forged team_id: can't stamp a row into a team you don't belong to ---
t.eq((await mk(B, { title: "into-t2", team_id: t2 })).status, 403, "B can't create a row in team 2 (not a member)");
// B legitimately creates in team 1.
await mk(B, { title: "b-doc", team_id: t1 });

// --- Mass-assignment: owner_id / team_id in the body must NOT be honored blindly ---
// Forge owner_id to A while creating as B → owner must remain B (server-stamped), and the forged
// value must not let B write into A's ownership.
await mk(B, { title: "forge-owner", team_id: t1, owner_id: 1 });
const forged = (await rows(A)).find((r) => r.title === "forge-owner");
t.eq(forged.owner_id, 2, "owner_id from the body is IGNORED — the creator (B=2) owns it, not the forged A=1");

// --- team_id is immutable via PATCH: a member can't move a row to another team ---
// B owns "b-doc"; try to move it into team 2 (where B isn't a member) and to a bogus team.
const bDocId = (await rows(B)).find((r) => r.title === "b-doc").id;
await c.patch(`/api/db/${slug}/rows/docs/${bDocId}`, { title: "b-doc2", team_id: t2 }, { token: B });
const moved = (await rows(B)).find((r) => r.id === bDocId);
t.eq(moved.team_id, t1, "PATCH can't change team_id — the row stays in team 1");
t.eq(moved.title, "b-doc2", "…but the real column DID update (so the PATCH itself worked)");

// --- Author-only writes: a teammate can read but not edit/delete another's row ---
t.eq((await c.patch(`/api/db/${slug}/rows/docs/${d1Id}`, { title: "x" }, { token: B })).status, 404, "B can't edit A's row");
t.eq((await c.del(`/api/db/${slug}/rows/docs/${d1Id}`, { token: B })).status, 404, "B can't delete A's row");

// --- Removing a member instantly revokes their read access ---
t.ok((await rows(B)).some((r) => r.title === "secret"), "B sees the team row before removal");
await c.del(`/api/db/${slug}/teams/${t1}/members/2`, { token: A }); // remove B from team 1
t.ok(!(await rows(B)).some((r) => r.title === "secret"), "after removal, B loses access to team-1 rows");
t.eq((await c.get(`/api/db/${slug}/rows/docs/${d1Id}`, { token: B })).status, 404, "removed member can't fetch the row by id either");

// --- A user in no team sees nothing (not everything) ---
const LONE = (await c.signup(slug, "lone@x.dev", "Str0ng-pass-9")).json.token; // id4, no team
t.eq((await rows(LONE)).length, 0, "a member in no team sees zero rows (fails closed, not open)");
t.eq((await mk(LONE, { title: "z", team_id: t1 })).status, 403, "…and can't post into a team they're not in");

// --- Trash still works under teamScope (soft-deleted rows hidden from the shared read) ---
const aDoc2 = await mk(A, { title: "trashme", team_id: t2 });
const trashId = (await rows(A)).find((r) => r.title === "trashme").id;
await c.del(`/api/db/${slug}/rows/docs/${trashId}`, { token: A }); // soft delete (trash table)
t.ok(!(await rows(X)).some((r) => r.title === "trashme"), "a soft-deleted team row is hidden from teammates");

t.done(); h.restore();
