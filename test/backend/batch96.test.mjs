// Batch 96 — consent / policy-acceptance tracking
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 96");
const slug = "b96";
await c.ensure(slug);
await c.schema(slug, { tables: { x: { access: "user", columns: [{ name: "a", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2

// record acceptances
t.ok((await c.post(`/api/db/${slug}/auth/consent`, { doc: "tos", version: "2026-01" }, { token: A })).json.ok, "accept ToS v1");
t.ok((await c.post(`/api/db/${slug}/auth/consent`, { doc: "privacy", version: "2026-01" }, { token: A })).json.ok, "accept privacy");
// re-accept ToS at a newer version → GET returns the LATEST per doc
await c.post(`/api/db/${slug}/auth/consent`, { doc: "tos", version: "2026-07" }, { token: A });

let g = (await c.get(`/api/db/${slug}/auth/consent`, { token: A })).json;
t.ok(g.ok, "get consents ok");
const byDoc = {}; for (const r of g.consents) byDoc[r.doc] = r.version;
t.eq(byDoc.tos, "2026-07", "latest ToS version returned (not the old one)");
t.eq(byDoc.privacy, "2026-01", "privacy version returned");
t.eq(g.consents.length, 2, "one row per doc (latest)");

// another user's consents are separate
t.eq((await c.get(`/api/db/${slug}/auth/consent`, { token: B })).json.consents.length, 0, "user B has no consents yet");
await c.post(`/api/db/${slug}/auth/consent`, { doc: "tos", version: "2026-07" }, { token: B });
t.eq((await c.get(`/api/db/${slug}/auth/consent`, { token: B })).json.consents.length, 1, "B's own consent recorded");

// guards
t.eq((await c.post(`/api/db/${slug}/auth/consent`, {}, { token: A })).status, 400, "doc required → 400");
t.eq((await c.post(`/api/db/${slug}/auth/consent`, { doc: "tos" }, {})).status, 401, "signed-out → 401");

t.done(); h.restore();
