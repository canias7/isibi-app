// Batch 176 — SAVED SEARCHES (per-member). A member saves a named {table, query} and re-RUNs it,
// getting rows UNDER THEIR OWN read scope. The headline case is the ADVERSARIAL one the review flagged:
// a saved search must NOT re-surface a row the caller can't read directly — scheduled/unpublished,
// trashed, or another member's private rows. Plus own-scoping, write-only refusal, privacy, guards.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 176");
const slug = "b176";
await c.ensure(slug);
await c.schema(slug, { tables: {
  posts: { access: "feed", scheduled: true, trash: true, columns: [{ name: "title", type: "text" }, { name: "status", type: "text" }] },
  mine: { access: "user", trash: true, columns: [{ name: "label", type: "text" }, { name: "n", type: "integer" }] },
  board: { access: "collect", columns: [{ name: "msg", type: "text" }] },
} });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const save = (tok, body) => c.post(`/api/db/${slug}/searches`, body, tok === null ? {} : { token: tok });
const run = (tok, name, qs) => c.get(`/api/db/${slug}/searches/${name}/run${qs || ""}`, tok === null ? {} : { token: tok });
const getS = (tok, name) => c.get(`/api/db/${slug}/searches/${name}`, { token: tok });
const listS = (tok, qs) => c.get(`/api/db/${slug}/searches${qs || ""}`, { token: tok });
const delS = (tok, name) => c.del(`/api/db/${slug}/searches/${name}`, { token: tok });
const addPost = (tok, b) => c.post(`/api/db/${slug}/rows/posts`, b, { token: tok });
const addMine = (tok, b) => c.post(`/api/db/${slug}/rows/mine`, b, { token: tok });
const future = new Date(Date.now() + 864e5).toISOString();

// Seed a public feed: two live open posts, one done, one FUTURE (scheduled) open draft.
await addPost(A, { title: "Open1", status: "open" });
await addPost(A, { title: "Open2", status: "open" });
await addPost(A, { title: "Done1", status: "done" });
await addPost(A, { title: "Secret Draft", status: "open", publish_at: future }); // not yet published

// --- SAVE (object form) + RUN over a public feed ---
t.eq((await save(A, { name: "open-posts", table: "posts", query: { where: "status:eq:open" } })).json.query, "where=status%3Aeq%3Aopen", "object query is serialized to a query string");
let r = (await run(A, "open-posts")).json;
t.eq(r.total, 2, "runs to the 2 LIVE open posts");
t.ok(!r.rows.some((x) => x.title === "Secret Draft"), "LEAK GUARD: the scheduled/future post is NOT returned by the saved search");
// sanity: the normal list read hides it too (same visibility)
t.ok(!((await c.get(`/api/db/${slug}/rows/posts?where=status:eq:open`, { token: B })).json.rows.some((x) => x.title === "Secret Draft")), "…and the normal list read hides it too (consistent)");

// --- Private per member: B can't see A's search ---
t.eq((await run(B, "open-posts")).status, 404, "another member's search is invisible (RUN → 404)");
t.eq((await getS(B, "open-posts")).status, 404, "…and GET → 404");
// B saves their OWN same-named search — a separate row (PK user_id,name)
await save(B, { name: "open-posts", table: "posts", query: "where=status:eq:open" });
t.eq((await run(B, "open-posts")).json.total, 2, "B's own same-named search runs independently");

// --- User table: RUN returns ONLY the caller's own rows ---
await addMine(B, { label: "b1", n: 1 });
await addMine(B, { label: "b2", n: 2 });
await addMine(A, { label: "a1", n: 9 });
await save(B, { name: "all-mine", table: "mine", query: "" });
let rm = (await run(B, "all-mine")).json;
t.eq(rm.total, 2, "B's saved search over a user table → only B's 2 rows");
t.ok(!rm.rows.some((x) => x.label === "a1"), "…never another member's (a1) row");

// --- Trash exclusion ---
const delId = (await c.get(`/api/db/${slug}/rows/mine`, { token: B })).json.rows.find((x) => x.label === "b1").id;
await c.del(`/api/db/${slug}/rows/mine/${delId}`, { token: B }); // soft delete
t.eq((await run(B, "all-mine")).json.total, 1, "a soft-deleted row drops out of the saved search");

// --- Write-only collect table → 403 at RUN (saving is still allowed) ---
t.eq((await save(A, { name: "board-q", table: "board", query: "" })).status, 200, "saving a search over a write-only table is allowed");
t.eq((await run(A, "board-q")).status, 403, "…but RUNNing it is refused (write-only, nothing to read)");

// --- limit override at run time (total still reflects the full match) ---
let lim = (await run(A, "open-posts", "?limit=1")).json;
t.eq([lim.rows.length, lim.total], [1, 2], "?limit=1 caps rows to 1 but total stays 2");

// --- RUN is GET-only; DELETE /<name>/run must not delete the search ---
t.eq((await c.del(`/api/db/${slug}/searches/all-mine/run`, { token: B })).status, 405, "DELETE /searches/<name>/run → 405 (run is GET-only)");
t.eq((await run(B, "all-mine")).status, 200, "…and the search still exists (wasn't deleted)");

// --- List (mine) + filter by table ---
t.ok((await listS(A)).json.searches.some((s) => s.name === "open-posts"), "list shows my searches");
t.eq((await listS(A, "?table=board")).json.searches.map((s) => s.name), ["board-q"], "?table= filters my searches to one table");

// --- Delete mine ---
t.eq((await delS(A, "open-posts")).json.deleted, true, "delete my search");
t.eq((await run(A, "open-posts")).status, 404, "…then RUN → 404");
t.eq((await delS(A, "open-posts")).status, 404, "deleting a gone search → 404");

// --- Guards ---
t.eq((await run(null, "all-mine")).status, 401, "signed-out run → 401");
t.eq((await save(null, { name: "x", table: "posts" })).status, 401, "signed-out save → 401");
t.eq((await save(A, { table: "posts", query: "" })).status, 400, "save without a name → 400");
t.eq((await save(A, { name: "y", table: "ghost", query: "" })).status, 404, "save over an unknown table → 404");
t.eq((await save(A, { name: "z", query: "" })).status, 400, "save without a table → 400");
t.eq((await run(A, "nope")).status, 404, "run an unknown search → 404");

t.done(); h.restore();
