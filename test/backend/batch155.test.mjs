// Batch 155 — team invites by email: owner/admin invite people by email, the invitee sees + accepts/
// declines their pending invites, permission gates, revoke, and GDPR-erase cleanup.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 155");
const slug = "b155";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3
const D = (await c.signup(slug, "d@x.dev", "Str0ng-pass-9")).json.token; // id4
const invite = (tok, tid, email, role) => c.post(`/api/db/${slug}/teams/${tid}/invites`, role ? { email, role } : { email }, { token: tok });
const teamInvites = (tok, tid) => c.get(`/api/db/${slug}/teams/${tid}/invites`, { token: tok }).then((r) => r.json.invites);
const mine = (tok) => c.get(`/api/db/${slug}/teams/invites/mine`, { token: tok }).then((r) => r.json.invites);
const accept = (tok, id) => c.post(`/api/db/${slug}/teams/invites/${id}/accept`, {}, { token: tok });
const decline = (tok, id) => c.post(`/api/db/${slug}/teams/invites/${id}/decline`, {}, { token: tok });
const setRole = (tok, tid, uid, role) => c.patch(`/api/db/${slug}/teams/${tid}/members/${uid}`, { role }, { token: tok });

const tid = (await c.post(`/api/db/${slug}/teams`, { name: "Acme" }, { token: A })).json.id;

// A (owner) invites B (member) and C (admin).
let i1 = await invite(A, tid, "b@x.dev");
t.eq(i1.status, 200, "invite B → 200");
t.eq(i1.json.status, "pending", "invite is pending");
let iC = await invite(A, tid, "c@x.dev", "admin");
t.eq(iC.json.role, "admin", "owner can invite an admin");

// Duplicate invite is a no-op (returns the existing).
t.eq((await invite(A, tid, "b@x.dev")).json.already, true, "re-inviting the same email → already");
// A bad email is rejected.
t.eq((await invite(A, tid, "not-an-email")).status, 400, "bad email → 400");

// Manager sees the team's pending invites.
t.eq((await teamInvites(A, tid)).length, 2, "2 pending invites on the team");

// B sees the invite addressed to them.
let mB = await mine(B);
t.eq(mB.length, 1, "B has 1 pending invite");
t.eq(mB[0].team_name, "Acme", "invite carries the team name");
t.eq(mB[0].role, "member", "…as member");

// Someone else can't accept B's invite.
t.eq((await accept(C, i1.json.id)).status, 403, "a different user can't accept B's invite");

// B accepts → joins the team.
let ac = await accept(B, i1.json.id);
t.eq(ac.json.joined, tid, "B joined the team");
t.eq(ac.json.role, "member", "…as the invited role");
t.ok((await c.get(`/api/db/${slug}/teams`, { token: B })).json.teams.some((x) => x.id === tid), "B now belongs to the team");
t.eq((await mine(B)).length, 0, "the invite left B's pending list");
t.eq((await teamInvites(A, tid)).length, 1, "team pending drops to 1 (C's)");

// Re-inviting a current member is refused.
t.eq((await invite(A, tid, "b@x.dev")).status, 409, "inviting a current member → 409");

// C declines their admin invite → not joined.
t.eq((await decline(C, iC.json.id)).json.declined, iC.json.id, "C declines");
t.ok(!(await c.get(`/api/db/${slug}/teams`, { token: C })).json.teams.some((x) => x.id === tid), "C did not join");
t.eq((await teamInvites(A, tid)).length, 0, "no pending invites left");
t.eq((await accept(C, iC.json.id)).status, 404, "a declined invite can't be accepted");

// Permission: a plain member can't invite.
t.eq((await invite(B, tid, "z@x.dev")).status, 403, "a member can't invite");
// Promote B to admin; an admin can invite members but not admins.
await setRole(A, tid, 2, "admin");
t.eq((await invite(B, tid, "newadmin@x.dev", "admin")).status, 403, "an admin can't invite an admin");
let mInv = await invite(B, tid, "newmember@x.dev");
t.eq(mInv.status, 200, "an admin can invite a member");

// Revoke a pending invite.
t.eq((await c.del(`/api/db/${slug}/teams/${tid}/invites/${mInv.json.id}`, { token: A })).json.revoked, true, "owner revokes an invite");
t.eq((await teamInvites(A, tid)).length, 0, "revoked invite is gone from pending");

// GDPR: deleting an account clears invites addressed to that email.
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
await invite(A, tid, "d@x.dev");
t.eq(h.getDb(uuid).prepare("SELECT COUNT(*) n FROM _team_invites WHERE lower(email)='d@x.dev' AND status='pending'").all()[0].n, 1, "D has a pending invite before erase");
await c.del(`/api/db/${slug}/auth/account`, { token: D, body: { password: "Str0ng-pass-9" } });
t.eq(h.getDb(uuid).prepare("SELECT COUNT(*) n FROM _team_invites WHERE lower(email)='d@x.dev'").all()[0].n, 0, "erase wiped invites addressed to D");

// Guards.
t.eq((await c.get(`/api/db/${slug}/teams/invites/mine`)).status, 401, "signed-out → 401");
t.eq((await accept(B, 99999)).status, 404, "unknown invite → 404");

t.done(); h.restore();
