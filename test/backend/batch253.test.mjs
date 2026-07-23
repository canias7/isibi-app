// Batch 253 — RECYCLE BIN. An admin stashes a JSON snapshot of a deleted record, then restores or purges it.
// Restore returns the snapshot AND removes it from the bin. Covers stash, list (+ entity filter), restore
// (returns data + removes), purge one, purge-before, snapshot round-trip, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 253");
const slug = "b253";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const stash = (tok, body) => c.post(`/api/db/${slug}/recycle-bin`, body, tok === null ? {} : { token: tok });
const list = (tok, q) => c.get(`/api/db/${slug}/recycle-bin${q || ""}`, { token: tok }).then((r) => r.json);
const restore = (tok, id) => c.post(`/api/db/${slug}/recycle-bin/${id}/restore`, {}, { token: tok }).then((r) => r.json);
const purge = (tok, id) => c.del(`/api/db/${slug}/recycle-bin/${id}`, { token: tok });
const purgeBefore = (tok, before) => c.del(`/api/db/${slug}/recycle-bin?before=${encodeURIComponent(before)}`, { token: tok }).then((r) => r.json);

// --- Stash snapshots ---
const snap = { id: 42, title: "Deleted post", tags: ["a", "b"] };
const r1 = (await stash(A, { entity: "post", ref: "42", data: snap })).json.id;
await stash(A, { entity: "comment", ref: "7", data: { text: "oops" } });
t.ok(r1, "admin stashes a deleted record");

// --- List + entity filter ---
t.eq((await list(A)).items.length, 2, "the bin has 2 items");
t.eq((await list(A, "?entity=post")).items.length, 1, "entity filter → 1 post");
t.ok(Array.isArray((await list(A, "?entity=post")).items[0].data.tags), "…the JSON snapshot round-trips");

// --- Restore returns the snapshot + removes it ---
let res = (await restore(A, r1)).restored;
t.eq(res.entity, "post", "restore returns the entity");
t.eq(res.data.title, "Deleted post", "…and the full snapshot to re-insert");
t.eq((await list(A)).items.length, 1, "…and removes it from the bin");
t.eq((await c.post(`/api/db/${slug}/recycle-bin/${r1}/restore`, {}, { token: A })).status, 404, "…restoring again → 404");

// --- Purge one ---
const r3 = (await stash(A, { entity: "x", data: { n: 1 } })).json.id;
t.eq((await purge(A, r3)).json.purged, true, "admin purges one item");
t.eq((await purge(A, r3)).status, 404, "…purging again → 404");

// --- Purge before a date ---
await stash(A, { entity: "old", data: { n: 1 } });
t.eq((await purgeBefore(A, new Date(Date.now() + 86400000).toISOString())).purged >= 1, true, "purge-before removes older items");
t.eq((await list(A)).items.length, 0, "…bin is empty");

// --- Validation + authz ---
t.eq((await stash(A, { data: { x: 1 } })).status, 400, "missing entity → 400");
t.eq((await stash(A, { entity: "x" })).status, 400, "missing data → 400");
t.eq((await c.del(`/api/db/${slug}/recycle-bin`, { token: A })).status, 400, "purge with no ?before → 400");
t.eq((await stash(B, { entity: "x", data: {} })).status, 403, "a member can't stash → 403");
t.eq((await list(B)).status ?? 403, 403, "a member can't list the bin → 403");
t.eq((await c.get(`/api/db/${slug}/recycle-bin`, { token: B })).status, 403, "…confirmed 403");
t.eq((await stash(null, { entity: "x", data: {} })).status, 401, "signed-out stash → 401");

t.done(); h.restore();
