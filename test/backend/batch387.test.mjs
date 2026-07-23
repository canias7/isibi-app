// Batch 387 — CHECKLISTS. Reusable checklist template (ordered items) + per-member completion. Admin defines;
// a member checks/unchecks items and reads progress; per-user isolation. Covers define, auto-ids, check/uncheck,
// progress/complete, template/list, delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 387");
const slug = "b387";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // member
const def = (tok, body) => c.post(`/api/db/${slug}/checklist`, body, { token: tok });
const check = (tok, key, item) => c.post(`/api/db/${slug}/checklist/${key}/check`, { item }, { token: tok });
const me = (tok, key) => c.get(`/api/db/${slug}/checklist/${key}/me`, { token: tok }).then((r) => r.json);

// --- Define (auto-assigned ids) ---
let r = (await def(A, { key: "onboard", title: "New hire", items: ["Sign forms", "Get laptop", { id: "badge", label: "Photo badge" }] })).json;
t.eq(r.items.length, 3, "3 items stored");
t.eq(r.items[0].id, "1", "string items get sequential ids");
t.eq(r.items[2].id, "badge", "an explicit id is kept");

// --- Member progress starts empty ---
let p = await me(B, "onboard");
t.eq(p.total, 3, "3 total items");
t.eq(p.remaining, 3, "…all remaining");
t.eq(p.complete, false, "…not complete");

// --- Check items ---
p = (await check(B, "onboard", "1")).json;
t.eq(p.done.length, 1, "one item checked");
t.eq(p.pct, 33.3, "…33.3% done");
await check(B, "onboard", "2");
p = (await check(B, "onboard", "badge")).json;
t.eq(p.complete, true, "checking all items completes the checklist");
t.eq(p.remaining, 0, "…nothing remaining");

// --- Checking twice is idempotent ---
t.eq((await check(B, "onboard", "1")).json.done.length, 3, "re-checking an item doesn't duplicate");

// --- Uncheck ---
p = (await c.post(`/api/db/${slug}/checklist/onboard/uncheck`, { item: "1" }, { token: B })).json;
t.eq(p.done.length, 2, "uncheck removes an item");
t.eq(p.complete, false, "…no longer complete");

// --- Per-user isolation ---
t.eq((await me(C, "onboard")).done.length, 0, "another member's progress is independent");

// --- Template + list (public) ---
t.eq((await c.get(`/api/db/${slug}/checklist/onboard`).then((x) => x.json)).checklist.items.length, 3, "public reads the template");
t.ok((await c.get(`/api/db/${slug}/checklist`).then((x) => x.json)).checklists.length >= 1, "list shows templates");

// --- Delete ---
t.eq((await c.del(`/api/db/${slug}/checklist/onboard`, { token: A })).json.deleted, true, "admin deletes a checklist");
t.eq((await me(B, "onboard")).ok, false, "…and it's gone");

// --- Validation + authz ---
t.eq((await def(A, { key: "x", items: [] })).status, 400, "empty items → 400");
t.eq((await def(A, { key: "x", items: [{ label: "a", id: "d" }, { label: "b", id: "d" }] })).status, 400, "duplicate item id → 400");
t.eq((await def(B, { key: "x", items: ["a"] })).status, 403, "a member can't define → 403");
await def(A, { key: "safety", items: ["helmet"] });
t.eq((await check(B, "safety", "nope")).status, 400, "checking an unknown item → 400");
t.eq((await c.post(`/api/db/${slug}/checklist/safety/check`, { item: "1" })).status, 401, "signed-out check → 401");

t.done(); h.restore();
