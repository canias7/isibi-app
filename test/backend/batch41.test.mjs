import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h); const t = makeTally("Batch 41");
const slug = "b41";
await c.ensure(slug);
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token;
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token;
// save two views for A (spec is arbitrary JSON)
t.ok((await c.post(`/api/db/${slug}/views/cheap`, { spec: { where: "price:lt:50", sort: "-created_at" } }, { token: A })).json.ok, "save view 'cheap'");
await c.post(`/api/db/${slug}/views/mine`, { spec: { tag: "fav" } }, { token: A });
// list (A) -> 2, sorted by name
let r = await c.get(`/api/db/${slug}/views`, { token: A });
t.eq(r.json.views.map(v=>v.name), ["cheap","mine"], "A lists own views by name");
t.eq(r.json.views[0].spec, { where: "price:lt:50", sort: "-created_at" }, "view spec round-trips as JSON");
// get one
t.eq((await c.get(`/api/db/${slug}/views/mine`, { token: A })).json.spec, { tag: "fav" }, "get one view");
// private: B sees none
t.eq((await c.get(`/api/db/${slug}/views`, { token: B })).json.views, [], "B sees no views (private)");
// update
await c.post(`/api/db/${slug}/views/cheap`, { spec: { where: "price:lt:20" } }, { token: A });
t.eq((await c.get(`/api/db/${slug}/views/cheap`, { token: A })).json.spec, { where: "price:lt:20" }, "update view spec");
// delete
t.ok((await c.del(`/api/db/${slug}/views/cheap`, { token: A })).json.deleted, "delete view");
t.ok((await c.get(`/api/db/${slug}/views/cheap`, { token: A })).json.spec === null, "deleted view -> null");
t.eq((await c.get(`/api/db/${slug}/views`, { token: A })).json.views.map(v=>v.name), ["mine"], "list after delete");
// auth required
t.ok((await c.get(`/api/db/${slug}/views`)).status === 401, "views need auth -> 401");
t.done(); h.restore();
