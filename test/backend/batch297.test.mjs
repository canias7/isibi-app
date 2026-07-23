// Batch 297 — FLAG ATTRIBUTE AUDIENCES. Target a feature flag by arbitrary user attributes (plan=pro,
// country=US). Rules {attr:[allowed]} live on the flag; match tests a supplied attribute bag against them AND
// the flag's enabled state. Kept off the /flags catch-all path. Covers set, get, match pass/fail, disabled
// flag, missing flag, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 297");
const slug = "b297";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
// Create flags via the existing /flags route.
await c.post(`/api/db/${slug}/flags`, { key: "beta", enabled: true }, { token: A });
await c.post(`/api/db/${slug}/flags`, { key: "off", enabled: false }, { token: A });
const setAud = (tok, key, body) => c.post(`/api/db/${slug}/flag-audiences/${key}`, body, tok === null ? {} : { token: tok });
const getAud = (tok, key) => c.get(`/api/db/${slug}/flag-audiences/${key}`, { token: tok });
const match = (key, attrs) => c.post(`/api/db/${slug}/flag-audiences/${key}/match`, { attrs }).then((r) => r.json);

// --- Set rules ---
let r = (await setAud(A, "beta", { attrs: { plan: ["pro", "max"], country: ["US"] } })).json;
t.eq(Object.keys(r.attrs).length, 2, "admin sets two attribute rules");
t.ok(r.attrs.plan.includes("pro"), "…values normalized");

// --- Get rules ---
t.eq((await getAud(A, "beta")).json.attrs.country[0], "us", "rules read back (lowercased)");

// --- Match: all rules satisfied + flag enabled ---
t.eq((await match("beta", { plan: "pro", country: "US" })).matched, true, "a matching attribute bag → matched");
// --- Match: one rule fails ---
let m = await match("beta", { plan: "free", country: "US" });
t.eq(m.matched, false, "a non-member plan → not matched");
t.ok(m.failed_on.includes("plan"), "…and reports which attribute failed");
// --- Match: missing attribute value ---
t.eq((await match("beta", { country: "US" })).matched, false, "a missing attribute → not matched");

// --- Disabled flag never matches even with the right attributes ---
await setAud(A, "off", { attrs: { plan: ["pro"] } });
let d = await match("off", { plan: "pro" });
t.eq(d.enabled, false, "the flag is disabled");
t.eq(d.matched, false, "…so match is false regardless of attributes");

// --- No rules → matches whenever enabled ---
await c.post(`/api/db/${slug}/flags`, { key: "openflag", enabled: true }, { token: A });
t.eq((await match("openflag", { anything: "x" })).matched, true, "a flag with no rules matches when enabled");

// --- Validation + authz ---
t.eq((await match("nope", { plan: "pro" })).error ? 404 : 200, 404, "match on a missing flag → 404");
t.eq((await c.post(`/api/db/${slug}/flag-audiences/nope/match`, { attrs: {} })).status, 404, "…confirmed 404");
t.eq((await setAud(A, "ghost", { attrs: { plan: ["pro"] } })).status, 404, "setting rules on a missing flag → 404");
t.eq((await setAud(B, "beta", { attrs: { plan: ["pro"] } })).status, 403, "a member can't set rules → 403");
t.eq((await getAud(B, "beta")).status, 403, "a member can't read rules → 403");
t.eq((await setAud(null, "beta", { attrs: {} })).status, 401, "signed-out set → 401");

t.done(); h.restore();
