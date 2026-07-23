// Batch 278 — SLUG / HANDLE RESERVATION. A member atomically claims a unique handle inside a namespace; no
// two people can hold the same one. Covers reserve, idempotent re-reserve by owner, conflict 409, check
// (public availability), mine, admin list, release (owner + admin), namespaces, normalization, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 278");
const slug = "b278";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3
const reserve = (tok, body) => c.post(`/api/db/${slug}/handles/reserve`, body, tok === null ? {} : { token: tok });
const check = (tok, q) => c.get(`/api/db/${slug}/handles/check${q}`, tok ? { token: tok } : {}).then((r) => r.json);
const mine = (tok) => c.get(`/api/db/${slug}/handles/mine`, { token: tok }).then((r) => r.json);
const listAll = (tok) => c.get(`/api/db/${slug}/handles`, { token: tok });
const release = (tok, handle, ns) => c.del(`/api/db/${slug}/handles/${handle}${ns ? "?ns=" + ns : ""}`, { token: tok });

// --- Reserve ---
t.eq((await reserve(B, { handle: "cooluser" })).json.reserved, true, "B claims 'cooluser'");
// Normalization: mixed case resolves to the same handle.
t.eq((await reserve(B, { handle: "CoolUser" })).json.already, true, "…re-claiming (any case) by the owner is idempotent");

// --- Conflict ---
let r = await reserve(C, { handle: "cooluser" });
t.eq(r.status, 409, "C can't take B's handle → 409");
t.ok(r.json.taken, "…flagged taken");

// --- Check (public) ---
t.eq((await check(null, "?handle=cooluser")).available, false, "public check: taken handle unavailable");
t.eq((await check(null, "?handle=freeone")).available, true, "…a free handle is available");
t.eq((await check(B, "?handle=cooluser")).owner_is_me, true, "…owner sees owner_is_me");
t.eq((await check(C, "?handle=cooluser")).owner_is_me, false, "…a non-owner does not");

// --- Namespaces are independent ---
t.eq((await reserve(C, { handle: "cooluser", ns: "teams" })).json.reserved, true, "C claims the same name in another namespace");
t.eq((await check(null, "?handle=cooluser&ns=teams")).available, false, "…taken in that namespace");
t.eq((await check(null, "?handle=cooluser&ns=other")).available, true, "…still free in a third");

// --- Mine ---
t.eq((await mine(B)).handles.length, 1, "B lists their 1 handle");
t.eq((await mine(C)).handles.length, 1, "C lists their handle (the teams one)");

// --- Admin list ---
t.ok((await listAll(A)).json.handles.length >= 2, "admin sees all handles");

// --- Release (owner) ---
t.eq((await release(B, "cooluser")).json.released, true, "B releases their handle");
t.eq((await check(null, "?handle=cooluser")).available, true, "…now available again");
// A different user can grab the freed handle.
t.eq((await reserve(C, { handle: "cooluser" })).json.reserved, true, "C now claims the freed handle");

// --- Release (admin can release anyone's) ---
t.eq((await release(A, "cooluser")).json.released, true, "admin releases C's handle");

// --- Validation + authz ---
t.eq((await reserve(B, { handle: "bad handle!" })).status, 400, "an invalid handle → 400");
t.eq((await reserve(B, {})).status, 400, "a missing handle → 400");
t.eq((await reserve(null, { handle: "x1" })).status, 401, "signed-out reserve → 401");
t.eq((await release(B, "cooluser", "teams")).status, 403, "a non-owner member can't release → 403");
t.eq((await release(A, "nope-nothere")).status, 404, "releasing a missing handle → 404");
t.eq((await listAll(B)).status, 403, "a member can't list all → 403");

t.done(); h.restore();
