// Batch 227 — IP ALLOW/DENY LIST. An admin maintains allow/deny rules; a check tells whether an IP is
// permitted (deny always blocks; any allow rule flips it to allowlist mode). Covers add, check semantics
// (default-allow, explicit deny, allowlist mode), update, list, delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 227");
const slug = "b227";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const add = (tok, body) => c.post(`/api/db/${slug}/ip-rules`, body, tok === null ? {} : { token: tok });
const check = (ip) => c.get(`/api/db/${slug}/ip-rules/check?ip=${encodeURIComponent(ip)}`).then((r) => r.json);
const list = (tok) => c.get(`/api/db/${slug}/ip-rules`, { token: tok }).then((r) => r.json);
const del = (tok, ip) => c.del(`/api/db/${slug}/ip-rules/${ip}`, { token: tok });

// --- Default: no rules → everyone allowed ---
t.eq((await check("1.2.3.4")).allowed, true, "with no rules, any IP is allowed");
t.eq((await check("1.2.3.4")).reason, "default", "…reason 'default'");

// --- Explicit deny blocks ---
t.eq((await add(A, { ip: "9.9.9.9", action: "deny", note: "abuse" })).json.action, "deny", "admin adds a deny rule");
t.eq((await check("9.9.9.9")).allowed, false, "the denied IP is blocked");
t.eq((await check("1.2.3.4")).allowed, true, "…others still allowed (no allow rules yet)");

// --- Adding an allow rule flips to allowlist mode ---
await add(A, { ip: "1.2.3.4", action: "allow" });
t.eq((await check("1.2.3.4")).allowed, true, "the allowlisted IP passes");
t.eq((await check("5.5.5.5")).allowed, false, "a non-listed IP is now blocked (allowlist mode)");
t.eq((await check("5.5.5.5")).reason, "not on the allowlist", "…with the allowlist reason");
t.eq((await check("9.9.9.9")).allowed, false, "…and an explicit deny still wins");

// --- Update a rule in place ---
await add(A, { ip: "9.9.9.9", action: "allow" });
t.eq((await check("9.9.9.9")).allowed, true, "flipping the rule to allow unblocks it");

// --- List + delete ---
t.eq((await list(A)).rules.length, 2, "admin lists the rules");
t.eq((await del(A, "1.2.3.4")).json.deleted, true, "admin deletes a rule");
// only 9.9.9.9 (allow) remains → still allowlist mode
t.eq((await check("2.2.2.2")).allowed, false, "still allowlist mode with one allow rule left");
t.eq((await del(A, "9.9.9.9")).json.deleted, true, "delete the last allow rule");
t.eq((await check("2.2.2.2")).allowed, true, "…back to default-allow with no rules");

// --- Validation + authz ---
t.eq((await add(A, { ip: "1.1.1.1" })).status, 400, "missing action → 400");
t.eq((await add(A, { action: "deny" })).status, 400, "missing ip → 400");
t.eq((await add(A, { ip: "1.1.1.1", action: "maybe" })).status, 400, "a bad action → 400");
t.eq((await add(B, { ip: "1.1.1.1", action: "deny" })).status, 403, "a member can't add rules → 403");
t.eq((await c.get(`/api/db/${slug}/ip-rules`, { token: B })).status, 403, "a member can't list rules → 403");
t.eq((await del(B, "1.1.1.1")).status, 403, "a member can't delete → 403");

t.done(); h.restore();
