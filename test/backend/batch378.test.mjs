// Batch 378 — TERRITORY RULES. Named territories with match rules; a match call routes an input to the
// highest-priority territory whose rules all fit (postal is prefix-matched; empty rules = catch-all). Covers
// upsert, match precedence, prefix rules, catch-all, no-match, read/list/delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 378");
const slug = "b378";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const put = (tok, body) => c.post(`/api/db/${slug}/territory`, body, { token: tok });
const match = (tok, input) => c.post(`/api/db/${slug}/territory/match`, input, { token: tok }).then((r) => r.json);

// --- Define territories ---
await put(A, { key: "west", name: "West US", owner: "alice", priority: 10, rules: { country: ["US"], postal_prefix: ["9"] } });
await put(A, { key: "us-saas", name: "US SaaS", owner: "bob", priority: 20, rules: { country: ["US"], industry: ["saas"] } });
await put(A, { key: "catch-all", name: "Everyone else", owner: "carol", priority: 0, rules: {} });

// --- Match precedence: highest priority wins among fits ---
let m = await match(A, { country: "US", postal: "94107", industry: "saas" });
t.eq(m.matched, true, "an input matches");
t.eq(m.territory.key, "us-saas", "the higher-priority territory wins");

// --- Postal prefix match ---
m = await match(A, { country: "US", postal: "90210" });
t.eq(m.territory.key, "west", "postal 9xxxx routes to West");

// --- Falls through to catch-all ---
m = await match(A, { country: "CA", postal: "12345" });
t.eq(m.territory.key, "catch-all", "no specific fit → the empty-rules catch-all");

// --- No catch-all → no match ---
await c.del(`/api/db/${slug}/territory/catch-all`, { token: A });
t.eq((await match(A, { country: "JP" })).matched, false, "with no catch-all, an unfit input → no match");

// --- Read + list ---
t.eq((await c.get(`/api/db/${slug}/territory/west`, { token: A }).then((r) => r.json)).territory.rules.country[0], "US", "read one returns parsed rules");
t.ok((await c.get(`/api/db/${slug}/territory`, { token: A }).then((r) => r.json)).territories.length >= 2, "list returns territories");

// --- Upsert replaces rules ---
await put(A, { key: "west", priority: 5, rules: { country: ["US"], postal_prefix: ["8"] } });
t.eq((await match(A, { country: "US", postal: "90210" })).matched, false, "after re-scoping West to 8xxxx, 9xxxx no longer matches");

// --- Delete ---
t.eq((await c.del(`/api/db/${slug}/territory/west`, { token: A })).json.deleted, true, "admin deletes a territory");
t.eq((await c.get(`/api/db/${slug}/territory/west`, { token: A })).status, 404, "…and it's gone");

// --- Validation + authz ---
t.eq((await put(A, { key: "bad key!", rules: {} })).status, 400, "an invalid key → 400");
t.eq((await put(A, { key: "x", rules: "nope" })).status, 400, "rules not an object → 400");
t.eq((await put(B, { key: "x", rules: {} })).status, 403, "a member can't define → 403");
t.eq((await c.post(`/api/db/${slug}/territory`, { key: "x", rules: {} })).status, 401, "signed-out → 401");
t.eq((await c.post(`/api/db/${slug}/territory/match`, { country: "US" }, { token: B })).status, 403, "a member can't match → 403");

t.done(); h.restore();
