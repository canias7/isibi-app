// Batch 184 — EVENT REGISTRATION with a hard CAPACITY. Registering past the cap auto-waitlists (a
// single atomic INSERT decides, so the cap is never exceeded); cancelling a seat atomically promotes
// the front of the waitlist. Covers the seat/waitlist split, promotion chain, positions, idempotency,
// admin create/roster, and validation/auth guards.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 184");
const slug = "b184";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3
const D = (await c.signup(slug, "d@x.dev", "Str0ng-pass-9")).json.token; // id4
const E = (await c.signup(slug, "e@x.dev", "Str0ng-pass-9")).json.token; // id5
const F = (await c.signup(slug, "f@x.dev", "Str0ng-pass-9")).json.token; // id6
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const idOf = (em) => h.getDb(uuid).prepare("SELECT id FROM _users WHERE email=?").all(em)[0].id;
const dId = idOf("d@x.dev"), eId = idOf("e@x.dev");
const create = (tok, body) => c.post(`/api/db/${slug}/events/party`, body, tok === null ? {} : { token: tok });
const info = (tok) => c.get(`/api/db/${slug}/events/party`, tok === null ? {} : { token: tok }).then((r) => r.json);
const reg = (tok, ev) => c.post(`/api/db/${slug}/events/${ev || "party"}/register`, {}, tok === null ? {} : { token: tok });
const me = (tok) => c.get(`/api/db/${slug}/events/party/me`, { token: tok });
const cancel = (tok) => c.post(`/api/db/${slug}/events/party/cancel`, {}, { token: tok });
const roster = (tok) => c.get(`/api/db/${slug}/events/party/roster`, { token: tok });

// --- Create + fill to capacity ---
t.eq((await create(A, { title: "Party", capacity: 2 })).json.capacity, 2, "admin creates a capacity-2 event");
t.eq(await info(null).then((i) => [i.registered, i.spots_left]), [0, 2], "starts empty, 2 spots (public read)");
t.eq((await reg(B)).json.status, "registered", "B gets a seat");
t.eq((await reg(C)).json.status, "registered", "C gets the last seat");
t.eq((await reg(D)).json.status, "waitlisted", "D is full → waitlisted");
t.eq((await reg(E)).json.status, "waitlisted", "E waitlisted too");
t.eq(await info(null).then((i) => [i.registered, i.waitlisted, i.spots_left]), [2, 2, 0], "2 registered, 2 waitlisted, 0 spots (cap never exceeded)");
t.eq((await me(D)).json.waitlist_position, 1, "D is #1 on the waitlist");
t.eq((await me(E)).json.waitlist_position, 2, "E is #2");
t.eq((await reg(B)).json, { ok: true, registered: false, status: "registered", seq: 1 }, "re-register is idempotent (no dup, no reshuffle)");

// --- Cancel promotes the waitlist front ---
t.eq((await cancel(B)).json.promoted, dId, "B cancels → D (front of waitlist) is promoted");
t.eq((await me(D)).json.status, "registered", "…D now holds a seat");
t.eq((await me(E)).json.waitlist_position, 1, "…E moves up to #1");
t.eq(await info(null).then((i) => [i.registered, i.waitlisted]), [2, 1], "still 2 registered (C, D), 1 waitlisted (E)");
t.eq((await cancel(C)).json.promoted, eId, "C cancels → E promoted");
t.eq(await info(null).then((i) => [i.registered, i.waitlisted]), [2, 0], "2 registered (D, E), waitlist empty");

// --- Cancel with no waitlist frees a real spot ---
t.eq((await cancel(D)).json.promoted, null, "D cancels, nobody to promote");
t.eq(await info(null).then((i) => i.spots_left), 1, "…a spot opens up");
t.eq((await reg(F)).json.status, "registered", "F takes the freed seat");

// --- me / cancel when not registered ---
t.eq((await cancel(F)).json.cancelled, true, "F cancels");
t.eq((await cancel(F)).status, 404, "cancel again → 404");
t.eq((await me(F)).status, 404, "me when not registered → 404");
t.eq((await reg(B, "ghost")).status, 404, "register for a non-existent event → 404");

// --- Roster (admin) ---
t.ok((await roster(A)).json.roster.length >= 1, "admin sees the roster");
t.eq((await roster(B)).status, 403, "a non-admin can't read the roster → 403");

// --- Validation + guards ---
t.eq((await create(A, { capacity: 0 })).status, 400, "capacity 0 → 400");
t.eq((await create(A, { title: "x" })).status, 400, "missing capacity → 400");
t.eq((await create(B, { capacity: 5 })).status, 403, "a non-admin can't create an event → 403");
t.eq((await reg(null)).status, 401, "signed-out register → 401");
t.eq((await create(null, { capacity: 5 })).status, 401, "signed-out create → 401");

t.done(); h.restore();
