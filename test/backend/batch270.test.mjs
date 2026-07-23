// Batch 270 — PETITIONS. A signature drive toward a goal; a member signs once. Reading is public. Covers
// create, sign (once, dedup), public view (count/progress/mine/recent), list, goal-less progress null,
// delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 270");
const slug = "b270";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const toks = [A];
for (const e of ["b", "c", "d"]) toks.push((await c.signup(slug, `${e}@x.dev`, "Str0ng-pass-9")).json.token);
const create = (tok, ps, body) => c.post(`/api/db/${slug}/petitions/${ps}`, body, tok === null ? {} : { token: tok });
const sign = (tok, ps, body) => c.post(`/api/db/${slug}/petitions/${ps}/sign`, body || {}, { token: tok }).then((r) => r.json);
const view = (tok, ps) => c.get(`/api/db/${slug}/petitions/${ps}`, tok ? { token: tok } : {}).then((r) => r.json);
const list = () => c.get(`/api/db/${slug}/petitions`).then((r) => r.json);
const del = (tok, ps) => c.del(`/api/db/${slug}/petitions/${ps}`, { token: tok });

// --- Create with a goal ---
t.eq((await create(A, "save-park", { title: "Save the Park", description: "Keep it green", goal: 4 })).json.slug, "save-park", "admin creates a petition");

// --- Sign (member) ---
t.eq((await sign(toks[1], "save-park", { name: "Bob", comment: "Love this park" })).signatures, 1, "first signature → 1");
t.eq((await sign(toks[1], "save-park")).already, true, "signing again is idempotent");
await sign(toks[2], "save-park", { name: "Carol" });

// --- Public view ---
let v = await view(null, "save-park");
t.eq(v.signatures, 2, "2 signatures");
t.eq(v.goal, 4, "goal of 4");
t.eq(v.progress, 50, "progress 2/4 = 50%");
t.eq(v.recent.length, 2, "…recent signers with names/comments");
t.eq(v.recent[0].name, "Carol", "…newest first");
t.eq((await view(toks[1], "save-park")).mine, true, "a signer sees mine:true");
t.eq((await view(null, "save-park")).mine, false, "signed-out mine:false");

// --- Reach the goal ---
await sign(toks[3], "save-park");
await sign(A, "save-park");
t.eq((await view(null, "save-park")).signatures, 4, "4 signatures");
t.eq((await view(null, "save-park")).progress, 100, "…progress caps at 100");

// --- Goal-less petition → progress null ---
await create(A, "open-letter", { title: "Open Letter" });
t.eq((await view(null, "open-letter")).progress, null, "a goal-less petition → progress null");

// --- List ---
t.eq((await list()).petitions.length, 2, "list has both petitions");
t.eq((await list()).petitions.find((x) => x.slug === "save-park").signatures, 4, "…with counts");

// --- Delete ---
t.eq((await del(A, "open-letter")).json.deleted, true, "admin deletes a petition");
t.eq((await view(null, "open-letter")).status ?? 404, 404, "…gone");

// --- Validation + authz ---
t.eq((await create(A, "x", {})).status, 400, "missing title → 400");
t.eq((await sign(toks[1], "nope").then((j) => j.ok ?? false)), false, "signing a missing petition fails");
t.eq((await c.post(`/api/db/${slug}/petitions/save-park/sign`, {})).status, 401, "signed-out sign → 401");
t.eq((await create(toks[1], "hax", { title: "x" })).status, 403, "a member can't create → 403");
t.eq((await del(toks[1], "save-park")).status, 403, "a member can't delete → 403");

t.done(); h.restore();
