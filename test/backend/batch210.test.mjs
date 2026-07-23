// Batch 210 — COUNTDOWN / LAUNCH TIMERS. An admin sets a named target datetime; the app reads seconds
// remaining to drive a launch/sale countdown. Covers upsert, remaining/expired computation, update, list,
// delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 210");
const slug = "b210";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2 member
const put = (tok, key, body) => c.post(`/api/db/${slug}/countdowns/${key}`, body, tok === null ? {} : { token: tok });
const read = (key) => c.get(`/api/db/${slug}/countdowns/${key}`).then((r) => r.json);
const list = () => c.get(`/api/db/${slug}/countdowns`).then((r) => r.json);
const del = (tok, key) => c.del(`/api/db/${slug}/countdowns/${key}`, { token: tok });
const future = new Date(Date.now() + 3600 * 1000).toISOString(); // +1h
const past = new Date(Date.now() - 3600 * 1000).toISOString(); // -1h

// --- Upsert (admin) + remaining ---
let r = (await put(A, "launch", { title: "Big Launch", target: future })).json;
t.eq(r.expired, false, "a future target is not expired");
t.ok(r.remaining > 3500 && r.remaining <= 3600, "remaining is ~1h in seconds");
t.eq(r.title, "Big Launch", "…title echoed");

// --- Read (public) ---
t.eq((await read("launch")).expired, false, "public reads the countdown");
t.ok((await read("launch")).remaining > 0, "…with remaining seconds");

// --- An expired (past) target ---
await put(A, "sale", { target: past });
r = await read("sale");
t.eq(r.expired, true, "a past target is expired");
t.eq(r.remaining, 0, "…remaining floors at 0");

// --- Update (same key upserts) ---
await put(A, "launch", { title: "Bigger Launch", target: future });
t.eq((await read("launch")).title, "Bigger Launch", "re-posting updates the countdown");

// --- List (public) ---
t.eq((await list()).countdowns.length, 2, "list returns both countdowns");
t.ok((await list()).countdowns.every((x) => typeof x.remaining === "number"), "…each with a remaining field");

// --- Delete (admin) ---
t.eq((await del(A, "sale")).json.deleted, true, "admin deletes a countdown");
t.eq((await read("sale")).status ?? (await read("sale")).ok, false, "…it's gone");
t.eq((await del(A, "sale")).status, 404, "deleting a missing one → 404");

// --- Validation + authz ---
t.eq((await put(A, "bad", { target: "not-a-date" })).status, 400, "an invalid target → 400");
t.eq((await put(A, "bad", {})).status, 400, "a missing target → 400");
t.eq((await read("nope")).ok ?? false, false, "an unknown countdown → not ok");
t.eq((await put(B, "hax", { target: future })).status, 403, "a member can't set a countdown → 403");
t.eq((await del(B, "launch")).status, 403, "a member can't delete → 403");
t.eq((await put(null, "x", { target: future })).status, 401, "signed-out set → 401");

t.done(); h.restore();
