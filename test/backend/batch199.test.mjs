// Batch 199 — NAMED COUNTERS. Members atomically increment named integer counters; anyone reads them;
// an admin sets/deletes. Covers increment (default +1 and by), public read/list, admin set/delete, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 199");
const slug = "b199";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2 member
const incr = (tok, name, body) => c.post(`/api/db/${slug}/counters/${name}/incr`, body || {}, tok === null ? {} : { token: tok });
const getOne = (name) => c.get(`/api/db/${slug}/counters/${name}`);
const setOne = (tok, name, body) => c.post(`/api/db/${slug}/counters/${name}`, body, { token: tok });
const del = (tok, name) => c.del(`/api/db/${slug}/counters/${name}`, { token: tok });
const list = () => c.get(`/api/db/${slug}/counters`);

// --- Increment (member) ---
t.eq((await incr(B, "hits")).json.n, 1, "first incr → 1");
t.eq((await incr(B, "hits")).json.n, 2, "second incr → 2");
t.eq((await incr(B, "hits", { by: 5 })).json.n, 7, "incr by 5 → 7");
t.eq((await incr(B, "hits", { by: -3 })).json.n, 4, "incr by -3 → 4");

// --- Read (public) ---
t.eq((await getOne("hits")).json.n, 4, "public read → 4");
t.eq((await getOne("nope")).json.n, 0, "unknown counter reads 0");

// --- Set (admin) ---
t.eq((await setOne(A, "hits", { value: 100 })).json.n, 100, "admin sets to 100");
t.eq((await getOne("hits")).json.n, 100, "…read reflects the set value");
t.eq((await incr(B, "hits")).json.n, 101, "…and incr continues from it");

// --- List (public) ---
await incr(B, "views");
const l = (await list()).json.counters;
t.ok(Array.isArray(l) && l.some((x) => x.name === "hits") && l.some((x) => x.name === "views"), "list returns all counters");

// --- Delete (admin) ---
t.eq((await del(A, "views")).json.deleted, true, "admin deletes a counter");
t.eq((await getOne("views")).json.n, 0, "…deleted counter reads 0 again");

// --- Validation + authz ---
t.eq((await incr(B, "hits", { by: 2000000 })).status, 400, "out-of-range by → 400");
t.eq((await incr(null, "hits")).status, 401, "signed-out incr → 401");
t.eq((await setOne(B, "hits", { value: 1 })).status, 403, "a member can't set → 403");
t.eq((await del(B, "hits")).status, 403, "a member can't delete → 403");
t.eq((await setOne(A, "hits", { value: 1.5 })).json.n, 1, "float value is floored");

t.done(); h.restore();
