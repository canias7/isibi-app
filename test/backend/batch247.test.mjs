// Batch 247 — GOAL / CONVERSION TRACKING. A named goal counts visits and conversions; the rate is derived.
// Covers hit (visit vs converted), rate math, auto-create on first hit, get one, list, admin name/delete,
// validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 247");
const slug = "b247";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const hit = (goal, converted) => c.post(`/api/db/${slug}/conversions/${goal}/hit`, { converted }).then((r) => r.json);
const get = (goal) => c.get(`/api/db/${slug}/conversions/${goal}`).then((r) => r.json);
const list = () => c.get(`/api/db/${slug}/conversions`).then((r) => r.json);
const setName = (tok, goal, name) => c.post(`/api/db/${slug}/conversions/${goal}`, { name }, { token: tok });
const del = (tok, goal) => c.del(`/api/db/${slug}/conversions/${goal}`, { token: tok });

// --- Hit: visits + conversions ---
t.eq((await hit("signup", false)).visits, 1, "a non-converting visit → visits 1");
await hit("signup", false); // visit
await hit("signup", true);  // conversion
let g = await get("signup");
t.eq(g.visits, 3, "3 visits");
t.eq(g.conversions, 1, "1 conversion");
t.eq(g.rate, 33.33, "rate = 1/3 = 33.33%");

// --- Another conversion moves the rate ---
await hit("signup", true);
g = await get("signup");
t.eq(g.rate, 50, "2/4 = 50%");

// --- Unknown goal reads zeros ---
t.eq((await get("never")).visits, 0, "an untouched goal → 0 visits");
t.eq((await get("never")).rate, 0, "…rate 0");

// --- Multiple goals + list ---
await hit("checkout", true);
let l = (await list()).goals;
t.ok(l.some((x) => x.goal === "signup") && l.some((x) => x.goal === "checkout"), "list has both goals");

// --- Admin sets a display name ---
t.eq((await setName(A, "signup", "Sign Ups")).json.goal, "signup", "admin names a goal");
t.eq((await get("signup")).name, "Sign Ups", "…name reads back (counts preserved)");
t.eq((await get("signup")).visits, 4, "…visits untouched by naming");

// --- Delete ---
t.eq((await del(A, "checkout")).json.deleted, true, "admin deletes a goal");
t.eq((await get("checkout")).visits, 0, "…reset to 0");

// --- Authz ---
t.eq((await setName(B, "signup", "x")).status, 403, "a member can't set a name → 403");
t.eq((await del(B, "signup")).status, 403, "a member can't delete → 403");
t.eq((await del(A, "nope")).status, 404, "deleting a missing goal → 404");

t.done(); h.restore();
