// Batch 35 — email-verification enforcement ("requireVerified":true gates writes)
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness();
const c = makeClient(worker, h);
const t = makeTally("Batch 35");

const slug = "b35";
await c.ensure(slug);
await c.schema(slug, {
  tables: {
    gated: { access: "feed", requireVerified: true, columns: { title: "text" } },
    open: { access: "feed", columns: { title: "text" } },
  },
});
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // verified=0
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // verified=0

// helper: mark a user verified directly in the site DB (simulates clicking the email link)
const setVerified = (id) => { const uuid = h.backends.find((b) => b.slug === slug).d1_uuid; h.getDb(uuid).prepare("UPDATE _users SET verified=1 WHERE id=?").run(id); };

// unverified A cannot write to the gated table
let r = await c.post(`/api/db/${slug}/rows/gated`, { title: "x" }, { token: A });
t.ok(r.status === 403 && r.json.code === "unverified", "unverified write to gated -> 403 unverified");
// but CAN read the gated table
t.ok((await c.get(`/api/db/${slug}/rows/gated`)).json.ok, "reads on gated table unaffected");
// and CAN write to a non-gated table
t.ok((await c.post(`/api/db/${slug}/rows/open`, { title: "ok" }, { token: A })).json.ok, "unverified write to non-gated table ok");

// verify B -> B can write to gated
setVerified(2);
t.ok((await c.post(`/api/db/${slug}/rows/gated`, { title: "byB" }, { token: B })).json.ok, "verified member can write to gated");

// verify A -> A can now write, and PATCH/DELETE also gated
setVerified(1);
r = await c.post(`/api/db/${slug}/rows/gated`, { title: "byA" }, { token: A });
t.ok(r.json.ok, "A after verifying can write");
const id = (await c.get(`/api/db/${slug}/rows/gated?where=title:eq:byA`)).json.rows[0].id;
t.ok((await c.patch(`/api/db/${slug}/rows/gated/${id}`, { title: "edited" }, { token: A })).json.ok, "verified PATCH ok");

// a table without the flag never gates (control) already covered by 'open'
t.done();
h.restore();
