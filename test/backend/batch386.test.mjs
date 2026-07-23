// Batch 386 — PASSWORD POLICY. A site-configurable password rule set (singleton) + a check. Admin sets rules;
// the current policy is public; a check validates a candidate password. Covers defaults, set, check pass/fail,
// each rule, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 386");
const slug = "b386";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const set = (tok, body) => c.post(`/api/db/${slug}/password-policy`, body, { token: tok });
const check = (pw) => c.post(`/api/db/${slug}/password-policy/check`, { password: pw }).then((r) => r.json);

// --- Default policy (public GET) ---
let r = (await c.get(`/api/db/${slug}/password-policy`).then((x) => x.json)).policy;
t.eq(r.min_length, 8, "default min_length 8");
t.eq(r.min_classes, 2, "default min_classes 2");
t.eq(r.disallow_common, 1, "default disallows common passwords");

// --- Check against defaults ---
t.eq((await check("abc")).valid, false, "too short fails");
t.ok((await check("abc")).failures.some((f) => /8 characters/.test(f)), "…with a length failure");
t.eq((await check("password")).valid, false, "a common password fails (disallow_common)");
t.eq((await check("abcdefghij")).valid, false, "one character class fails min_classes 2");
t.eq((await check("abcdef12")).valid, true, "8 chars + 2 classes passes the default");

// --- Tighten the policy ---
r = (await set(A, { min_length: 12, require_upper: true, require_digit: true, require_symbol: true, min_classes: 3 })).json;
t.eq(r.policy.min_length, 12, "min_length raised to 12");
t.eq(r.policy.require_symbol, 1, "symbol required");

// --- Re-check against the tighter policy ---
t.eq((await check("abcdef12")).valid, false, "the old password now fails the tighter policy");
let fails = (await check("abcdef12")).failures;
t.ok(fails.some((f) => /12 characters/.test(f)), "…flags length");
t.ok(fails.some((f) => /upper-case/.test(f)), "…flags missing upper-case");
t.ok(fails.some((f) => /symbol/.test(f)), "…flags missing symbol");
t.eq((await check("Abcdefghij9!")).valid, true, "a compliant password passes");

// --- Partial update preserves other fields ---
r = (await set(A, { min_length: 10 })).json;
t.eq(r.policy.min_length, 10, "min_length updated");
t.eq(r.policy.require_symbol, 1, "…symbol requirement preserved from before");

// --- Validation + authz ---
t.eq((await set(A, { min_length: 0 })).status, 400, "min_length < 1 → 400");
t.eq((await set(A, { min_classes: 9 })).status, 400, "min_classes > 4 → 400");
t.eq((await set(B, { min_length: 10 })).status, 403, "a member can't set the policy → 403");
t.eq((await c.post(`/api/db/${slug}/password-policy`, { min_length: 10 })).status, 401, "signed-out set → 401");
t.eq((await c.post(`/api/db/${slug}/password-policy/check`, {})).status, 400, "check with no password → 400");

t.done(); h.restore();
