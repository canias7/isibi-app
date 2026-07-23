// Batch 392 — APPROVAL QUORUM. N-of-M sign-off. Admin opens a request; members approve once each; reaching the
// needed count flips it to 'approved'. Covers open, approve dedup, quorum reached, revoke, locked-after-approved,
// read (member vs admin), list, delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 392");
const slug = "b392";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // member
const D = (await c.signup(slug, "d@x.dev", "Str0ng-pass-9")).json.token; // member
const open = (tok, body) => c.post(`/api/db/${slug}/approval-quorum`, body, { token: tok });
const approve = (tok, key) => c.post(`/api/db/${slug}/approval-quorum/${key}/approve`, {}, { token: tok });
const read = (tok, key) => c.get(`/api/db/${slug}/approval-quorum/${key}`, { token: tok }).then((r) => r.json);

// --- Open (needs 2) ---
let r = (await open(A, { key: "release-42", needed: 2, title: "Ship v4.2" })).json;
t.eq(r.needed, 2, "needs 2 approvers");
t.eq(r.status, "open", "…starts open");

// --- Approve (dedup) ---
r = (await approve(B, "release-42")).json;
t.eq(r.count, 1, "first approval → count 1");
t.eq(r.status, "open", "…still open");
t.eq(r.mine, true, "…marked mine");
t.eq((await approve(B, "release-42")).json.count, 1, "approving twice doesn't double-count");

// --- Quorum reached ---
r = (await approve(C, "release-42")).json;
t.eq(r.count, 2, "second distinct approver → count 2");
t.eq(r.status, "approved", "…quorum reached → approved");

// --- Locked after approval ---
t.eq((await approve(D, "release-42")).status, 409, "approving an already-approved request → 409");

// --- Revoke keeps it open ---
await open(A, { key: "budget", needed: 3 });
await approve(B, "budget");
await approve(C, "budget");
r = (await c.post(`/api/db/${slug}/approval-quorum/budget/revoke`, {}, { token: B })).json;
t.eq(r.count, 1, "revoke removes an approval");
t.eq(r.status, "open", "…still open");

// --- Member read: count + mine, no approver list ---
r = await read(C, "budget");
t.eq(r.count, 1, "member sees the count");
t.eq(r.mine, true, "…and that they approved");
t.eq(r.approvers, undefined, "…but not the approver ids");

// --- Admin read: full approver list ---
r = await read(A, "budget");
t.ok(Array.isArray(r.approvers), "admin sees the approver ids");

// --- List (admin) ---
t.ok((await c.get(`/api/db/${slug}/approval-quorum`, { token: A }).then((x) => x.json)).requests.length >= 2, "admin lists requests");
t.eq((await c.get(`/api/db/${slug}/approval-quorum`, { token: B })).status, 403, "a member can't list → 403");

// --- Delete ---
t.eq((await c.del(`/api/db/${slug}/approval-quorum/budget`, { token: A })).json.deleted, true, "admin deletes a request");
t.eq((await read(A, "budget")).ok, false, "…and it's gone");

// --- Validation + authz ---
t.eq((await open(A, { key: "x", needed: 0 })).status, 400, "needed < 1 → 400");
t.eq((await open(A, { key: "release-42", needed: 2 })).status, 409, "a duplicate key → 409");
t.eq((await approve(B, "ghost")).status, 404, "approving a missing request → 404");
t.eq((await open(B, { key: "z", needed: 1 })).status, 403, "a member can't open → 403");
t.eq((await c.post(`/api/db/${slug}/approval-quorum/release-42/approve`, {})).status, 401, "signed-out approve → 401");

t.done(); h.restore();
