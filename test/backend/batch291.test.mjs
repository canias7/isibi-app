// Batch 291 — TICKET MERGE / LINK. Additive to /tickets: fold a duplicate ticket into another (messages move,
// status → 'merged') or link two tickets as related. Covers merge (message migration + guards), link, links
// listing (owner + admin), invalid transitions, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 291");
const slug = "b291";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // requester
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // other member
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const open = (tok, subject) => c.post(`/api/db/${slug}/tickets`, { subject, body: "hello" }, { token: tok }).then((r) => r.json.id);
const reply = (tok, id, body) => c.post(`/api/db/${slug}/tickets/${id}/messages`, { body }, { token: tok });
const merge = (tok, id, into) => c.post(`/api/db/${slug}/tickets/${id}/merge`, { into }, { token: tok });
const link = (tok, id, other, relation) => c.post(`/api/db/${slug}/tickets/${id}/link`, { other, relation }, { token: tok });
const links = (tok, id) => c.get(`/api/db/${slug}/tickets/${id}/links`, { token: tok });
const msgCount = (id) => h.getDb(uuid).prepare("SELECT COUNT(*) AS n FROM _ticket_messages WHERE ticket_id=?").all(id)[0].n;

// --- Open tickets ---
const t1 = await open(B, "Broken login");
const t2 = await open(B, "Cannot sign in"); // duplicate of t1
const t3 = await open(B, "Related issue");
await reply(B, t2, "extra detail on t2");
const beforeT1 = msgCount(t1), beforeT2 = msgCount(t2);
t.ok(t1 && t2 && t3, "three tickets opened");

// --- Merge t2 into t1 ---
let m = (await merge(A, t2, t1)).json;
t.eq(m.merged, t2, "admin merges the duplicate");
t.eq(m.into, t1, "…into the survivor");
t.eq(msgCount(t1), beforeT1 + beforeT2, "t2's messages moved to t1");
t.eq(msgCount(t2), 0, "…and left t2");
t.eq(h.getDb(uuid).prepare("SELECT status FROM _tickets WHERE id=?").all(t2)[0].status, "merged", "t2 is now 'merged'");

// --- Link t1 and t3 ---
let l = (await link(A, t1, t3, "related")).json;
t.ok(l.linked.includes(t1) && l.linked.includes(t3), "admin links two tickets");
t.eq(l.relation, "related", "…with a relation");

// --- Links listing ---
let ll = (await links(A, t1)).json.links;
t.ok(ll.find((x) => x.other === t3), "the link shows on t1");
// requester can read their own ticket's links
t.eq((await links(B, t1)).json.links.length, 1, "the requester reads their ticket's links");
t.eq((await links(C, t1)).status, 403, "another member can't → 403");

// --- Invalid transitions + validation ---
t.eq((await merge(A, t2, t1)).status, 409, "re-merging an already-merged ticket → 409");
t.eq((await merge(A, t3, t3)).status, 400, "merging into itself → 400");
t.eq((await merge(A, t3, 999999)).status, 404, "merging into a missing ticket → 404");
t.eq((await merge(A, 999999, t1)).status, 404, "merging a missing source → 404");
t.eq((await link(A, t1, 999999)).status, 404, "linking to a missing ticket → 404");

// --- Authz ---
t.eq((await merge(B, t3, t1)).status, 403, "a member can't merge → 403");
t.eq((await link(B, t3, t1)).status, 403, "a member can't link → 403");
t.eq((await c.post(`/api/db/${slug}/tickets/${t1}/merge`, { into: t3 })).status, 401, "signed-out merge → 401");

t.done(); h.restore();
