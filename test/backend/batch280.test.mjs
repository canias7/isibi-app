// Batch 280 — UTM CAMPAIGN LINKS. An admin registers a tracked outbound link; the returned URL carries the
// utm_* params, each hit bumps a counter, and a report rolls clicks up by campaign. Covers create (explicit +
// auto slug), the tracking URL, public click increment, report, list, delete, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 280");
const slug = "b280";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const create = (tok, body) => c.post(`/api/db/${slug}/utm`, body, tok === null ? {} : { token: tok });
const click = (s) => c.post(`/api/db/${slug}/utm/${s}/click`, {});
const report = (tok) => c.get(`/api/db/${slug}/utm/report`, { token: tok });
const list = (tok) => c.get(`/api/db/${slug}/utm`, { token: tok });
const del = (tok, s) => c.del(`/api/db/${slug}/utm/${s}`, { token: tok });

// --- Create with explicit slug + utm params ---
let r = (await create(A, { target: "https://example.com/page", campaign: "launch", source: "fb", medium: "cpc", slug: "launch-fb" })).json;
t.eq(r.slug, "launch-fb", "admin creates a tracked link with an explicit slug");
t.ok(/utm_campaign=launch/.test(r.url), "…the tracking URL carries utm_campaign");
t.ok(/utm_source=fb/.test(r.url) && /utm_medium=cpc/.test(r.url), "…and utm_source + utm_medium");

// --- Auto slug ---
let r2 = (await create(A, { target: "https://example.com/x", campaign: "spring", source: "ig", medium: "social" })).json;
t.ok(r2.slug && r2.slug.startsWith("spring-"), "a missing slug is auto-generated from the campaign");

// --- Public click increments ---
t.eq((await click("launch-fb")).json.clicks, 1, "a click bumps the counter to 1");
t.eq((await click("launch-fb")).json.target, "https://example.com/page", "…and returns the target to redirect to");
await click("launch-fb");
t.eq((await click(r2.slug)).json.clicks, 1, "the second link tracks independently");

// --- Report ---
let rep = (await report(A)).json;
t.eq(rep.total_clicks, 4, "the report totals all clicks");
t.ok(rep.groups.find((g) => g.campaign === "launch").clicks === 3, "…rolled up by campaign (launch = 3)");

// --- List ---
t.eq((await list(A)).json.links.length, 2, "admin lists both links");

// --- Delete ---
t.eq((await del(A, r2.slug)).json.deleted, true, "admin deletes a link");
t.eq((await list(A)).json.links.length, 1, "…one link remains");

// --- Validation + authz ---
t.eq((await create(A, { target: "not-a-url" })).status, 400, "a bad target → 400");
t.eq((await create(A, {})).status, 400, "a missing target → 400");
t.eq((await create(A, { target: "https://x.dev", slug: "launch-fb" })).status, 409, "a duplicate slug → 409");
t.eq((await create(B, { target: "https://x.dev" })).status, 403, "a member can't create → 403");
t.eq((await report(B)).status, 403, "a member can't read the report → 403");
t.eq((await click("no-such-link")).status, 404, "clicking a missing link → 404");
t.eq((await c.post(`/api/db/${slug}/utm`, { target: "https://x.dev" })).status, 401, "signed-out create → 401");

t.done(); h.restore();
