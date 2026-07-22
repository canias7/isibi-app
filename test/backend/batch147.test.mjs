// Batch 147 — outbound webhooks: register external subscriber URLs, fire events, deliver a
// signed JSON payload to each matching hook, log the attempt. Admin-only; https + SSRF guard.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 147");
const slug = "b147";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "t", type: "text" }] } } });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token; // id1
const MEMBER = (await c.signup(slug, "m@x.dev", "Str0ng-pass-9")).json.token;    // id2
const reg = (body, tok) => c.post(`/api/db/${slug}/webhooks`, body, { token: tok || ADMIN });
const emit = (body, tok) => c.post(`/api/db/${slug}/webhooks/emit`, body, { token: tok || ADMIN });

// Register a specific-events hook (signed) and a wildcard hook (unsigned).
let h1 = await reg({ url: "https://example.com/hook1", events: ["order.created", "signup"], secret: "sh" });
t.eq(h1.status, 200, "register specific hook → 200");
t.eq(h1.json.signed, true, "hook with a secret is signed");
let h2 = await reg({ url: "https://example.com/hook2" }); // events default "*", no secret
t.eq(h2.json.events, "*", "no events → wildcard");
t.eq(h2.json.signed, false, "no secret → unsigned");

// List never leaks the secret.
let list = (await c.get(`/api/db/${slug}/webhooks`, { token: ADMIN })).json;
t.eq(list.webhooks.length, 2, "two hooks registered");
t.ok(!("secret" in list.webhooks[0]), "secret is never returned in the list");
t.ok(list.webhooks.find((w) => w.id === h1.json.id).signed, "signed flag surfaced");

// Emit an event both hooks match (specific lists it + wildcard). Harness returns 200 → delivered.
let e1 = (await emit({ event: "order.created", data: { id: 5, total: 99 } })).json;
t.eq(e1.matched, 2, "order.created matches the specific + wildcard hooks");
t.eq(e1.delivered, 2, "both deliveries succeed (2xx)");
t.ok(e1.results.every((r) => r.ok && r.status === 200), "each result is ok/200");

// An event only the wildcard matches.
let e2 = (await emit({ event: "refund" })).json;
t.eq(e2.matched, 1, "refund matches only the wildcard hook");

// signup matches both again.
t.eq((await emit({ event: "signup" })).json.matched, 2, "signup matches the specific + wildcard");

// Delivery log accumulates and filters by hook.
let del = (await c.get(`/api/db/${slug}/webhooks/deliveries`, { token: ADMIN })).json;
t.eq(del.deliveries.length, 5, "5 deliveries logged (2 + 1 + 2)");
t.ok(del.deliveries.every((d) => d.ok === 1), "all logged deliveries succeeded");
let delH2 = (await c.get(`/api/db/${slug}/webhooks/deliveries?hook=${h2.json.id}`, { token: ADMIN })).json;
t.eq(delH2.deliveries.length, 3, "wildcard hook got all 3 events");
t.ok(delH2.deliveries.every((d) => d.hook_id === h2.json.id), "hook filter works");

// Delete one hook → future emits stop matching it.
t.eq((await c.del(`/api/db/${slug}/webhooks/${h1.json.id}`, { token: ADMIN })).json.removed, true, "hook deleted");
t.eq((await c.get(`/api/db/${slug}/webhooks`, { token: ADMIN })).json.webhooks.length, 1, "one hook left");
t.eq((await emit({ event: "order.created" })).json.matched, 1, "after delete, only the wildcard matches");

// SSRF / validation guards on registration.
t.eq((await reg({ url: "http://example.com/x" })).status, 400, "non-https url → 400");
t.eq((await reg({ url: "https://localhost/x" })).status, 400, "localhost host → 400 (SSRF guard)");
t.eq((await reg({ url: "https://192.168.1.10/x" })).status, 400, "private IP host → 400 (SSRF guard)");
t.eq((await reg({ url: "not a url" })).status, 400, "garbage url → 400");

// Auth guards.
t.eq((await reg({ url: "https://example.com/z" }, MEMBER)).status, 403, "non-admin register → 403");
t.eq((await emit({ event: "x" }, MEMBER)).status, 403, "non-admin emit → 403");
t.eq((await c.post(`/api/db/${slug}/webhooks/emit`, { event: "x" })).status, 401, "signed-out → 401");
t.eq((await emit({})).status, 400, "emit without an event → 400");

t.done(); h.restore();
