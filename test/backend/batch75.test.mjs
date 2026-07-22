// Batch 75 — unified activity timeline (merges notes + approvals + audit into one
// reverse-chronological feed, with actors, type filter, and cross-format timestamp sort)
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 75");
const slug = "b75";
await c.ensure(slug);
await c.schema(slug, { tables: {
  deals: {
    access: "admin", audit: true, writeRoles: ["rep", "manager"],
    approval: { approvers: ["manager"] },
    columns: [{ name: "title", type: "text" }, { name: "amount", type: "integer" }],
  },
  leads: { access: "user", columns: [{ name: "name", type: "text" }] }, // no audit/approval
  intake: { access: "collect", columns: [{ name: "email", type: "text", format: "email" }] },
} });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token; // id1
const REP = (await c.signup(slug, "rep@x.dev", "Str0ng-pass-9")).json.token;     // id2
const MGR = (await c.signup(slug, "mgr@x.dev", "Str0ng-pass-9")).json.token;     // id3
const OUT = (await c.signup(slug, "out@x.dev", "Str0ng-pass-9")).json.token;     // id4
await c.call("POST", "/api/site/backend/member", { token: h.OWNER_TOKEN, body: { slug, id: 2, action: "set_role", role: "rep" } });
await c.call("POST", "/api/site/backend/member", { token: h.OWNER_TOKEN, body: { slug, id: 3, action: "set_role", role: "manager" } });

// build a deal with a life of events: create → submit → approve → a logged note
await c.post(`/api/db/${slug}/rows/deals`, { title: "Enterprise", amount: 50000 }, { token: ADMIN }); // audit:insert
await c.post(`/api/db/${slug}/rows/deals/1/submit`, { note: "ready" }, { token: REP });                // approval:submit (+audit:update)
await c.post(`/api/db/${slug}/rows/deals/1/approve`, { note: "signed" }, { token: MGR });              // approval:approve (+audit:update)
await c.post(`/api/db/${slug}/rows/deals/1/notes`, { body: "Kickoff scheduled", kind: "meeting" }, { token: ADMIN }); // note

// full merged timeline
let tl = (await c.get(`/api/db/${slug}/rows/deals/1/timeline`, { token: ADMIN })).json;
t.ok(tl.ok, "timeline ok");
const types = tl.events.map((e) => e.type);
t.ok(types.includes("note") && types.includes("approval") && types.includes("audit"), "feed merges all three sources");
t.eq(tl.events[0].type, "note", "most recent event first (the note)");
t.eq(tl.events[0].body, "Kickoff scheduled", "note body present");
// events are sorted newest → oldest by real timestamp (across the mixed ISO/SQLite formats)
const ok = tl.events.every((e, i) => i === 0 || tl.events[i - 1].at >= e.at);
t.ok(ok, "events are in non-increasing time order after normalization");
// every at is normalized to ISO (…T…Z), not the raw SQLite space format
t.ok(tl.events.every((e) => /T.*Z$/.test(e.at)), "all timestamps normalized to ISO");
// approval events carry action + actor
const appr = tl.events.filter((e) => e.type === "approval");
t.eq(appr.length, 2, "two approval events (submit + approve)");
t.ok(appr.some((e) => e.action === "approve" && e.actor_id === 3), "approve event by the manager");
t.ok(appr.some((e) => e.action === "submit" && e.actor_id === 2), "submit event by the rep");
// note actor profile attached
t.ok(tl.events.find((e) => e.type === "note").actor_id === 1, "note actor is admin");

// ?types filter
t.ok((await c.get(`/api/db/${slug}/rows/deals/1/timeline?types=note`, { token: ADMIN })).json.events.every((e) => e.type === "note"), "?types=note → only notes");
let appOnly = (await c.get(`/api/db/${slug}/rows/deals/1/timeline?types=approval`, { token: ADMIN })).json;
t.eq(appOnly.events.length, 2, "?types=approval → 2");
let audOnly = (await c.get(`/api/db/${slug}/rows/deals/1/timeline?types=audit`, { token: ADMIN })).json;
t.ok(audOnly.events.length >= 1 && audOnly.events.every((e) => e.type === "audit"), "?types=audit → audit only");
t.ok(audOnly.events.some((e) => e.action === "insert"), "audit includes the create");

// a plain table (no audit/approval) → timeline is just its notes
await c.post(`/api/db/${slug}/rows/leads`, { name: "Small Co" }, { token: REP }); // owner=rep, id 1
await c.post(`/api/db/${slug}/rows/leads/1/notes`, { body: "cold call", kind: "call" }, { token: REP });
let lt = (await c.get(`/api/db/${slug}/rows/leads/1/timeline`, { token: REP })).json;
t.eq(lt.events.length, 1, "plain table timeline = its 1 note");
t.eq(lt.events[0].type, "note", "only a note event");

// visibility gate: an outsider can't read a user-row's timeline
t.eq((await c.get(`/api/db/${slug}/rows/leads/1/timeline`, { token: OUT })).status, 404, "outsider blocked from a private record's timeline");
// collect table → no timeline
await c.post(`/api/db/${slug}/rows/intake`, { email: "a@b.com" }, {});
t.eq((await c.get(`/api/db/${slug}/rows/intake/1/timeline`, { token: ADMIN })).status, 400, "no timeline on a collect table");
// signed-out → 401
t.eq((await c.get(`/api/db/${slug}/rows/deals/1/timeline`, {})).status, 401, "signed-out → 401");

t.done(); h.restore();
