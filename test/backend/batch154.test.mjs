// Batch 154 — teams / organizations / workspaces: create a team (creator = owner), add members
// with roles (owner/admin/member), role-gated management, ownership transfer, leave, delete, and
// GDPR-erase cleanup of memberships.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 154");
const slug = "b154";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3
const D = (await c.signup(slug, "d@x.dev", "Str0ng-pass-9")).json.token; // id4
const create = (tok, name) => c.post(`/api/db/${slug}/teams`, { name }, { token: tok });
const add = (tok, tid, user, role) => c.post(`/api/db/${slug}/teams/${tid}/members`, role ? { user, role } : { user }, { token: tok });
const setRole = (tok, tid, uid, role) => c.patch(`/api/db/${slug}/teams/${tid}/members/${uid}`, { role }, { token: tok });
const remove = (tok, tid, uid) => c.del(`/api/db/${slug}/teams/${tid}/members/${uid}`, { token: tok });
const leave = (tok, tid) => c.post(`/api/db/${slug}/teams/${tid}/leave`, {}, { token: tok });
const teams = (tok) => c.get(`/api/db/${slug}/teams`, { token: tok }).then((r) => r.json.teams);
const members = (tok, tid) => c.get(`/api/db/${slug}/teams/${tid}/members`, { token: tok }).then((r) => r.json.members);

// A creates a team → becomes owner.
let cr = await create(A, "Acme");
t.eq(cr.status, 200, "create team → 200");
t.eq(cr.json.role, "owner", "creator is the owner");
const tid = cr.json.id;
let myTeams = await teams(A);
t.eq(myTeams.length, 1, "A belongs to 1 team");
t.eq(myTeams[0].members, 1, "team starts with 1 member");

// A (owner) adds B as member and C as admin.
t.eq((await add(A, tid, 2)).json.role, "member", "owner adds B as member");
t.eq((await add(A, tid, 3, "admin")).json.role, "admin", "owner adds C as admin");

// Permission gates on adding.
t.eq((await add(B, tid, 4)).status, 403, "a plain member can't add anyone");
t.eq((await add(C, tid, 4, "admin")).status, 403, "an admin can't grant admin (owner-only)");
t.eq((await add(C, tid, 4)).status, 200, "an admin CAN add a plain member");

// Dedup + unknown user.
t.eq((await add(A, tid, 2)).status, 409, "adding an existing member → 409");
t.eq((await add(A, tid, 999)).status, 404, "adding a non-existent user → 404");

// Member list is ordered owner → admin → members.
let ms = await members(A, tid);
t.eq(ms.length, 4, "4 members");
t.eq(ms[0].user_id, 1, "owner listed first");
t.eq(ms[0].role, "owner", "…as owner");
t.eq(ms[1].role, "admin", "admin listed next");

// Visibility: a non-member can't see the team.
const E = (await c.signup(slug, "e@x.dev", "Str0ng-pass-9")).json.token; // id5, not a member
t.eq((await c.get(`/api/db/${slug}/teams/${tid}`, { token: E })).status, 403, "a non-member is denied");
t.eq((await c.get(`/api/db/${slug}/teams/${tid}`, { token: D })).status, 200, "a member can view the team");

// Role changes are owner-only.
t.eq((await setRole(C, tid, 2, "admin")).status, 403, "an admin can't change roles");
t.eq((await setRole(A, tid, 2, "admin")).status, 200, "the owner promotes B to admin");

// Transfer ownership A → C.
let tr = await setRole(A, tid, 3, "owner");
t.eq(tr.json.role, "owner", "C is now owner");
t.eq((await teams(C)).find((x) => x.id === tid).role, "owner", "C sees themselves as owner");
t.eq((await teams(A)).find((x) => x.id === tid).role, "admin", "A was demoted to admin on transfer");

// Removal rules: admin can't remove another admin or the owner; owner can.
t.eq((await remove(A, tid, 2)).status, 403, "an admin can't remove another admin");
t.eq((await remove(A, tid, 3)).status, 409, "nobody can remove the owner");
t.eq((await remove(C, tid, 2)).json.removed, 2, "the owner removes admin B");

// Leave: owner blocked, others fine.
t.eq((await leave(C, tid)).status, 409, "the owner can't just leave");
t.eq((await leave(A, tid)).status, 200, "an admin can leave");

// Delete: owner-only.
t.eq((await c.del(`/api/db/${slug}/teams/${tid}`, { token: D })).status, 403, "a member can't delete the team");
t.eq((await c.del(`/api/db/${slug}/teams/${tid}`, { token: C })).json.deleted, tid, "the owner deletes the team");
t.eq((await c.get(`/api/db/${slug}/teams/${tid}`, { token: C })).status, 404, "the team is gone");

// GDPR: deleting your account removes your team memberships.
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const tid2 = (await create(A, "Beta")).json.id;
await add(A, tid2, 2); // B joins Beta
t.eq(h.getDb(uuid).prepare("SELECT COUNT(*) n FROM _team_members WHERE user_id=2").all()[0].n, 1, "B has 1 membership before erase");
await c.del(`/api/db/${slug}/auth/account`, { token: B, body: { password: "Str0ng-pass-9" } });
t.eq(h.getDb(uuid).prepare("SELECT COUNT(*) n FROM _team_members WHERE user_id=2").all()[0].n, 0, "erase wiped B's team membership");
t.ok(!(await members(A, tid2)).some((m) => m.user_id === 2), "B no longer appears in the team");

// Guards.
t.eq((await c.post(`/api/db/${slug}/teams`, { name: "x" })).status, 401, "signed-out create → 401");
t.eq((await create(A, "")).status, 400, "empty name → 400");
t.eq((await c.get(`/api/db/${slug}/teams/99999`, { token: A })).status, 404, "unknown team → 404");

t.done(); h.restore();
