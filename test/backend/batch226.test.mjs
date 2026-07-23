// Batch 226 — SLUG / HANDLE RESERVATION. Atomically claim a unique name within a namespace, first-come-
// first-served. Covers availability, claim, taken → 409, idempotent self-claim, namespace isolation, mine,
// release (owner + admin), authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 226");
const slug = "b226";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3
const avail = (ns, name) => c.get(`/api/db/${slug}/reserve/${ns}/${name}`).then((r) => r.json);
const claim = (tok, ns, name) => c.post(`/api/db/${slug}/reserve/${ns}`, { name }, tok === null ? {} : { token: tok });
const mine = (tok, ns) => c.get(`/api/db/${slug}/reserve/${ns}/mine`, { token: tok }).then((r) => r.json);
const release = (tok, ns, name) => c.del(`/api/db/${slug}/reserve/${ns}/${name}`, { token: tok });

// --- Availability + claim ---
t.eq((await avail("handles", "cooluser")).available, true, "a fresh name is available");
t.eq((await claim(B, "handles", "cooluser")).json.reserved, true, "B claims it");
t.eq((await avail("handles", "cooluser")).available, false, "…now unavailable");

// --- Taken → 409 for someone else ---
t.eq((await claim(C, "handles", "cooluser")).status, 409, "C can't claim a taken name → 409");

// --- Case-insensitive (stored lowercased) ---
t.eq((await claim(C, "handles", "CoolUser")).status, 409, "…case-insensitively taken too");

// --- Idempotent self-claim ---
t.eq((await claim(B, "handles", "cooluser")).json.mine, true, "B re-claiming their own name → mine:true (no 409)");

// --- Namespace isolation ---
t.eq((await claim(C, "events", "cooluser")).json.reserved, true, "the same name in another namespace is free");

// --- Mine ---
t.eq((await mine(B, "handles")).reservations.length, 1, "B lists their reservations in the namespace");
t.eq((await mine(C, "handles")).reservations.length, 0, "…C has none there");

// --- Release (owner) ---
t.eq((await release(B, "handles", "cooluser")).json.released, true, "the owner releases their name");
t.eq((await avail("handles", "cooluser")).available, true, "…it's available again");

// --- Release (admin can release anyone's) ---
await claim(C, "handles", "adminwipe");
t.eq((await release(A, "handles", "adminwipe")).json.released, true, "an admin can release someone else's name");

// --- Validation + authz ---
t.eq((await claim(B, "handles", "")).status, 400, "empty name → 400");
t.eq((await claim(null, "handles", "x")).status, 401, "signed-out claim → 401");
t.eq((await c.get(`/api/db/${slug}/reserve/handles/mine`)).status, 401, "signed-out mine → 401");
t.eq((await release(C, "events", "cooluser")).json.released, true, "C releases their own events name ok");
await claim(B, "handles", "protected");
t.eq((await release(C, "handles", "protected")).status, 403, "a non-owner non-admin can't release → 403");
t.eq((await release(B, "handles", "notreserved")).status, 404, "releasing a free name → 404");

t.done(); h.restore();
