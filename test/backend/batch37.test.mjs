// Batch 37 — Audit log ("audit":true -> _audit trail via triggers; admin reads)
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness();
const c = makeClient(worker, h);
const t = makeTally("Batch 37");

const slug = "b37";
await c.ensure(slug);
await c.schema(slug, {
  tables: {
    docs: { access: "feed", audit: true, columns: { title: "text" } },
    quiet: { access: "feed", columns: { title: "text" } }, // not audited
  },
});
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token; // id 1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id 2

// insert, update, delete a doc (owner B) + a quiet row (not audited)
await c.post(`/api/db/${slug}/rows/docs`, { title: "d1" }, { token: B });
const id = (await c.get(`/api/db/${slug}/rows/docs`)).json.rows[0].id;
await c.patch(`/api/db/${slug}/rows/docs/${id}`, { title: "d1-edited" }, { token: B });
await c.post(`/api/db/${slug}/rows/quiet`, { title: "q" }, { token: B }); // should NOT be audited
await c.del(`/api/db/${slug}/rows/docs/${id}`, { token: B });

// admin reads the trail
let r = await c.get(`/api/db/${slug}/audit`, { token: ADMIN });
const actions = r.json.audit.map((a) => a.action);
t.ok(actions.includes("insert") && actions.includes("update") && actions.includes("delete"), "audit has insert+update+delete");
t.ok(r.json.audit.every((a) => a.row_table === "docs"), "only audited table 'docs' appears (quiet excluded)");
t.ok(r.json.audit.every((a) => a.actor_id === 2), "actor_id captured from owner_id (=2, B)");
// ordered newest-first -> delete is first
t.ok(r.json.audit[0].action === "delete", "newest-first (delete on top)");

// filter by action
r = await c.get(`/api/db/${slug}/audit?action=update`, { token: ADMIN });
t.ok(r.json.audit.length === 1 && r.json.audit[0].action === "update", "?action=update filters");
// filter by table (none for quiet)
r = await c.get(`/api/db/${slug}/audit?table=quiet`, { token: ADMIN });
t.ok(r.json.audit.length === 0, "?table=quiet -> empty (not audited)");
r = await c.get(`/api/db/${slug}/audit?table=docs`, { token: ADMIN });
t.ok(r.json.audit.length === 3, "?table=docs -> 3 events");

// non-admin / anon can't read the trail
t.ok((await c.get(`/api/db/${slug}/audit`, { token: B })).status === 403, "non-admin audit -> 403");
t.ok((await c.get(`/api/db/${slug}/audit`)).status === 401, "anon audit -> 401");

t.done();
h.restore();
