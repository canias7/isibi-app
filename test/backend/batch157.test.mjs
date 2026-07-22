// Batch 157 — team-scoped data (`teamScope:true` user table): rows are SHARED across a team for
// READS (every member sees the team's rows), stamped with a team_id on insert (membership required),
// while writes stay author-scoped (only the author edits/deletes a row). Isolated per team.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 157");
const slug = "b157";
await c.ensure(slug);
await c.schema(slug, { tables: { tasks: { access: "user", teamScope: true, columns: [{ name: "title", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3 (never joins)
const mk = (tok, title, team_id) => c.post(`/api/db/${slug}/rows/tasks`, team_id !== undefined ? { title, team_id } : { title }, { token: tok });
const list = (tok) => c.get(`/api/db/${slug}/rows/tasks`, { token: tok }).then((r) => r.json.rows.map((x) => x.title));

// A owns a team and adds B; C stays out.
const tid = (await c.post(`/api/db/${slug}/teams`, { name: "Squad" }, { token: A })).json.id;
await c.post(`/api/db/${slug}/teams/${tid}/members`, { user: 2 }, { token: A });

// A and B each create a task in the team.
let ta = await mk(A, "A-task", tid);
t.eq(ta.status, 200, "A creates a team task → 200");
const taId = (await list(A)).length; // (used just to ensure it's there)
await mk(B, "B-task", tid);

// SHARED READS: every team member sees ALL the team's rows.
t.eq((await list(A)).sort().join(","), "A-task,B-task", "A sees both team tasks");
t.eq((await list(B)).sort().join(","), "A-task,B-task", "B sees both team tasks (shared read)");

// A non-member sees nothing and can't post to the team.
t.eq((await list(C)).length, 0, "C (not in the team) sees no tasks");
t.eq((await mk(C, "C-task", tid)).status, 403, "C can't create in a team they're not in");

// team_id is required + validated.
t.eq((await mk(A, "orphan")).status, 400, "missing team_id → 400");
t.eq((await mk(A, "wrong", 99999)).status, 403, "a team you don't belong to → 403");

// Single-row read follows the same sharing.
const aTaskId = (await c.get(`/api/db/${slug}/rows/tasks`, { token: A })).json.rows.find((r) => r.title === "A-task").id;
t.eq((await c.get(`/api/db/${slug}/rows/tasks/${aTaskId}`, { token: B })).status, 200, "B can read A's task by id");
t.eq((await c.get(`/api/db/${slug}/rows/tasks/${aTaskId}`, { token: C })).status, 404, "C can't read A's task");
t.eq((await c.get(`/api/db/${slug}/rows/tasks/${aTaskId}`, { token: A })).json.row.team_id, tid, "the row carries its team_id");

// WRITES stay author-scoped: a teammate can read but not edit/delete another's row.
t.eq((await c.patch(`/api/db/${slug}/rows/tasks/${aTaskId}`, { title: "hacked" }, { token: B })).status, 404, "B can't edit A's task");
t.eq((await c.patch(`/api/db/${slug}/rows/tasks/${aTaskId}`, { title: "A-edited" }, { token: A })).status, 200, "A edits their own task");
const bTaskId = (await c.get(`/api/db/${slug}/rows/tasks`, { token: B })).json.rows.find((r) => r.title === "B-task").id;
t.eq((await c.del(`/api/db/${slug}/rows/tasks/${bTaskId}`, { token: A })).status, 404, "A can't delete B's task");
t.eq((await c.del(`/api/db/${slug}/rows/tasks/${bTaskId}`, { token: B })).status, 200, "B deletes their own task");
t.eq((await list(A)).join(","), "A-edited", "one task remains after B's delete");

// Team isolation: a second team's rows don't leak into the first.
const tid2 = (await c.post(`/api/db/${slug}/teams`, { name: "Other" }, { token: A })).json.id;
await mk(A, "team2-task", tid2);
t.ok((await list(A)).includes("team2-task"), "A (in both teams) sees the team-2 task");
t.ok(!(await list(B)).includes("team2-task"), "B (not in team 2) does NOT see the team-2 task");
t.eq((await list(B)).join(","), "A-edited", "B still only sees their team's row");

// Batch insert is refused on a team-scoped table.
t.eq((await c.post(`/api/db/${slug}/rows/tasks`, { rows: [{ title: "x", team_id: tid }] }, { token: A })).status, 400, "batch insert → 400 on teamScope");

// Guards.
t.eq((await c.post(`/api/db/${slug}/rows/tasks`, { title: "x", team_id: tid })).status, 401, "signed-out → 401");

t.done(); h.restore();
