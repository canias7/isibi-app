// Batch 198 — A/B EXPERIMENTS. Admin defines weighted variants; a member is assigned deterministically
// (sticky), exposure + conversion are recorded, admin reads results. Replicates the assignment hash so the
// sticky pick is a deterministic assertion. Covers assign/convert/results, disabled control, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 198");
const slug = "b198";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3
const D = (await c.signup(slug, "d@x.dev", "Str0ng-pass-9")).json.token; // id4
const E = (await c.signup(slug, "e@x.dev", "Str0ng-pass-9")).json.token; // id5
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const idOf = (em) => h.getDb(uuid).prepare("SELECT id FROM _users WHERE email=?").all(em)[0].id;
const define = (tok, key, body) => c.post(`/api/db/${slug}/experiments/${key}`, body, tok === null ? {} : { token: tok });
const assign = (tok, key) => c.get(`/api/db/${slug}/experiments/${key}/assign`, { token: tok }).then((r) => r.json);
const convert = (tok, key) => c.post(`/api/db/${slug}/experiments/${key}/convert`, {}, { token: tok });
const results = (tok, key) => c.get(`/api/db/${slug}/experiments/${key}/results`, { token: tok });
const config = (tok, key) => c.get(`/api/db/${slug}/experiments/${key}`, { token: tok });
const del = (tok, key) => c.del(`/api/db/${slug}/experiments/${key}`, { token: tok });
// replicate the worker's deterministic weighted pick
const pick = (key, userId, variants) => { const s = key + ":" + userId; let hsh = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { hsh ^= s.charCodeAt(i); hsh = Math.imul(hsh, 16777619) >>> 0; } const total = variants.reduce((a, v) => a + v.weight, 0); let point = (hsh % 100000) / 100000 * total, acc = 0, chosen = variants[0].name; for (const v of variants) { acc += v.weight; if (point < acc) { chosen = v.name; break; } } return chosen; };
const VARS = [{ name: "blue", weight: 1 }, { name: "green", weight: 1 }];

// --- Define ---
t.eq((await define(A, "cta", { variants: ["blue", "green"] })).json.variants.length, 2, "define with 2 variants");

// --- Deterministic + sticky assignment ---
const predB = pick("cta", idOf("b@x.dev"), VARS);
t.eq((await assign(B, "cta")).variant, predB, "B's variant matches the replicated hash pick");
t.eq((await assign(B, "cta")).variant, predB, "…and is sticky across calls");
await assign(C, "cta"); await assign(D, "cta");
t.ok(["blue", "green"].includes((await assign(C, "cta")).variant), "C gets one of the variants");

// --- Convert ---
t.eq((await convert(B, "cta")).json.converted, true, "B converts");
t.eq((await convert(B, "cta")).json.already, true, "…converting again is idempotent");
await convert(C, "cta");
t.eq((await convert(E, "cta")).status, 404, "converting without an assignment → 404");

// --- Results (admin) ---
let r = (await results(A, "cta")).json;
t.eq(r.results.reduce((s, v) => s + v.exposures, 0), 3, "3 exposures total (B, C, D)");
t.eq(r.results.reduce((s, v) => s + v.conversions, 0), 2, "2 conversions total (B, C)");
t.ok(r.results.every((v) => v.rate >= 0 && v.rate <= 100), "each variant has a conversion rate");

// --- Disabled → everyone gets the control (first variant), not recorded ---
await define(A, "off", { variants: ["a", "b"], enabled: false });
t.eq((await assign(B, "off")), { ok: true, variant: "a", key: "off", disabled: true }, "a disabled experiment returns the control variant");
t.eq((await results(A, "off")).json.results.length, 0, "…with no recorded exposures");

// --- Config + authz ---
t.eq((await config(A, "cta")).json.enabled, true, "admin reads the config");
t.eq((await config(B, "cta")).status, 403, "a member can't read the config → 403");
t.eq((await results(B, "cta")).status, 403, "a member can't read results → 403");

// --- Delete ---
t.eq((await del(A, "cta")).json.deleted, true, "admin deletes the experiment");
t.eq((await assign(B, "cta")).ok ?? false, false, "…assign now 404s");

// --- Validation + guards ---
t.eq((await define(A, "bad", { variants: [] })).status, 400, "no variants → 400");
t.eq((await define(A, "bad", { variants: ["x", "x"] })).status, 400, "duplicate variant names → 400");
t.eq((await define(B, "hax", { variants: ["a"] })).status, 403, "a non-admin can't define → 403");
t.eq((await c.get(`/api/db/${slug}/experiments/cta/assign`)).status, 401, "signed-out assign → 401");

t.done(); h.restore();
