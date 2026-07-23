// Batch 263 — ESCALATION RULES. An admin defines rules (after N minutes, escalate to a target); an evaluate
// call returns the applicable rule for an elapsed time (the highest threshold passed). Covers create, list,
// evaluate (tiers, next_at, none-yet), delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 263");
const slug = "b263";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const create = (tok, body) => c.post(`/api/db/${slug}/escalation-rules`, body, tok === null ? {} : { token: tok });
const list = (tok) => c.get(`/api/db/${slug}/escalation-rules`, { token: tok }).then((r) => r.json);
const evaluate = (tok, mins) => c.get(`/api/db/${slug}/escalation-rules/evaluate?elapsed_mins=${mins}`, { token: tok }).then((r) => r.json);
const del = (tok, id) => c.del(`/api/db/${slug}/escalation-rules/${id}`, { token: tok });

// --- Create a tiered ladder ---
const r1 = (await create(A, { name: "L1", after_mins: 30, target: "tier1@x.io" })).json.id;
const r2 = (await create(A, { name: "L2", after_mins: 120, target: "manager@x.io" })).json.id;
await create(A, { name: "L3", after_mins: 480, target: "director@x.io" });
t.ok(r1 && r2, "admin creates escalation rules");

// --- List (sorted by after_mins) ---
let l = (await list(A)).rules;
t.eq(l.length, 3, "3 rules");
t.eq(l[0].after_mins, 30, "…sorted ascending");

// --- Evaluate at various elapsed times ---
let e = await evaluate(B, 10);
t.eq(e.escalate, false, "at 10 min → no rule fires yet");
t.eq(e.next_at_mins, 30, "…next escalation at 30 min");
e = await evaluate(B, 45);
t.eq(e.escalate, true, "at 45 min → the 30-min rule fires");
t.eq(e.escalate_to, "tier1@x.io", "…escalate to tier1");
t.eq(e.next_at_mins, 120, "…next at 120 min");
e = await evaluate(B, 200);
t.eq(e.escalate_to, "manager@x.io", "at 200 min → the 120-min rule (highest passed)");
e = await evaluate(B, 1000);
t.eq(e.escalate_to, "director@x.io", "at 1000 min → the 480-min rule");
t.eq(e.next_at_mins, null, "…no further escalation");

// --- Delete ---
t.eq((await del(A, r1)).json.deleted, true, "admin deletes the 30-min rule");
t.eq((await evaluate(B, 45)).escalate, false, "with the 30-min rule gone, 45 min escalates to nothing");
t.eq((await evaluate(B, 130)).escalate_to, "manager@x.io", "…but 130 min still hits the 120-min rule");

// --- Validation + authz ---
t.eq((await create(A, { target: "x@x.io" })).status, 400, "missing after_mins → 400");
t.eq((await create(A, { after_mins: 10 })).status, 400, "missing target → 400");
t.eq((await c.get(`/api/db/${slug}/escalation-rules/evaluate`, { token: B })).status, 400, "missing elapsed_mins → 400");
t.eq((await create(B, { after_mins: 10, target: "x" })).status, 403, "a member can't create → 403");
t.eq((await list(B)).status ?? 403, 403, "a member can't list → 403");
t.eq((await c.get(`/api/db/${slug}/escalation-rules`, { token: B })).status, 403, "…confirmed 403");
t.eq((await del(B, r2)).status, 403, "a member can't delete → 403");
t.eq((await c.get(`/api/db/${slug}/escalation-rules/evaluate?elapsed_mins=10`)).status, 401, "signed-out evaluate → 401");

t.done(); h.restore();
