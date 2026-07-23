// Batch 193 — SAVED ADDRESSES / ADDRESS BOOK. A member keeps multiple postal addresses with exactly one
// default. Covers first-address-is-default, explicit default, atomic set-default, delete-promotes-a-new-
// default, per-owner IDOR, validation, guards.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 193");
const slug = "b193";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id1
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id2
const create = (tok, body) => c.post(`/api/db/${slug}/addresses`, body, tok === null ? {} : { token: tok });
const list = (tok) => c.get(`/api/db/${slug}/addresses`, { token: tok }).then((r) => r.json.addresses);
const one = (tok, id) => c.get(`/api/db/${slug}/addresses/${id}`, { token: tok });
const patch = (tok, id, body) => c.patch(`/api/db/${slug}/addresses/${id}`, body, { token: tok });
const del = (tok, id) => c.del(`/api/db/${slug}/addresses/${id}`, { token: tok });
const setDefault = (tok, id) => c.post(`/api/db/${slug}/addresses/${id}/default`, {}, { token: tok });
const defaults = (tok) => list(tok).then((a) => a.filter((x) => x.is_default).length);

// --- First address is auto-default ---
const a1 = (await create(B, { label: "Home", line1: "1 Main St", city: "SF" })).json;
t.eq([a1.is_default], [true], "the first address is the default");
const a2 = (await create(B, { line1: "2 Oak Ave", city: "LA" })).json.id;
t.eq((await list(B))[0].id, a1.id, "default sorts first");
t.eq(await defaults(B), 1, "exactly one default");

// --- Explicit default on create ---
const a3 = (await create(B, { line1: "3 Pine", default: true })).json.id;
t.eq((await one(B, a3)).json.address.is_default, true, "created with default:true → it's the default");
t.eq(await defaults(B), 1, "…still exactly one default");

// --- Atomic set-default ---
t.eq((await setDefault(B, a1.id)).json.is_default, true, "set a1 as default");
t.eq((await one(B, a1.id)).json.address.is_default, true, "a1 is now default");
t.eq((await one(B, a3)).json.address.is_default, false, "…and a3 no longer is");
t.eq(await defaults(B), 1, "invariant holds: one default");

// --- Edit ---
t.eq((await patch(B, a2, { city: "Oakland" })).json.updated, true, "patch a2");
t.eq((await one(B, a2)).json.address.city, "Oakland", "…city updated");

// --- IDOR: C can't touch B's addresses ---
t.eq((await one(C, a1.id)).status, 404, "C can't read B's address → 404");
t.eq((await patch(C, a1.id, { city: "x" })).status, 404, "C can't edit B's → 404");
t.eq((await del(C, a1.id)).status, 404, "C can't delete B's → 404");
t.eq((await setDefault(C, a1.id)).status, 404, "C can't set B's default → 404");
t.eq((await list(C)).length, 0, "C's own book is empty");

// --- Deleting the default promotes another ---
t.eq((await del(B, a1.id)).json.deleted, true, "delete the default address");
t.eq(await defaults(B), 1, "…a new default is promoted (still exactly one)");

// --- Validation + guards ---
t.eq((await create(B, { city: "SF" })).status, 400, "missing line1 → 400");
t.eq((await create(null, { line1: "x" })).status, 401, "signed-out create → 401");

t.done(); h.restore();
