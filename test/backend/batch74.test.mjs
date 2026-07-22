// Batch 74 — activity notes (log note/call/email/… against any record, visibility-gated,
// author profiles, kind filter, own-note delete). CRM activity log.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 74");
const slug = "b74";
await c.ensure(slug);
await c.schema(slug, { tables: {
  leads: { access: "user", teamRead: true, columns: [{ name: "name", type: "text" }] },
  wall: { access: "feed", columns: [{ name: "text", type: "text" }] },
  intake: { access: "collect", columns: [{ name: "email", type: "text", format: "email" }] },
} });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token; // id1 admin
const REPA = (await c.signup(slug, "repa@x.dev", "Str0ng-pass-9")).json.token;   // id2
const REPB = (await c.signup(slug, "repb@x.dev", "Str0ng-pass-9")).json.token;   // id3
const MGR = (await c.signup(slug, "mgr@x.dev", "Str0ng-pass-9")).json.token;     // id4
// repA reports to the manager (id4) → teamRead lets the manager see repA's rows
await c.call("POST", "/api/site/backend/member", { token: h.OWNER_TOKEN, body: { slug, id: 2, action: "set_manager", manager_id: 4 } });

// repA owns lead #1
await c.post(`/api/db/${slug}/rows/leads`, { name: "Big Co" }, { token: REPA }); // id 1

// owner logs a note
let n1 = await c.post(`/api/db/${slug}/rows/leads/1/notes`, { body: "Left a voicemail", kind: "call" }, { token: REPA });
t.ok(n1.json.ok && n1.json.note.id > 0, "owner logs a call note (returns id)");
t.eq(n1.json.note.kind, "call", "kind recorded");
// an unrelated rep CANNOT see/log on someone else's lead
t.eq((await c.post(`/api/db/${slug}/rows/leads/1/notes`, { body: "sneaky" }, { token: REPB })).status, 404, "non-owner rep can't log a note (404)");
t.eq((await c.get(`/api/db/${slug}/rows/leads/1/notes`, { token: REPB })).status, 404, "non-owner rep can't read notes (404)");
// the manager (teamRead) CAN
let n2 = await c.post(`/api/db/${slug}/rows/leads/1/notes`, { body: "Nice lead, push it", kind: "meeting" }, { token: MGR });
t.ok(n2.json.ok, "manager (teamRead) can log a note");
// admin can too
await c.post(`/api/db/${slug}/rows/leads/1/notes`, { body: "flagged", kind: "note" }, { token: ADMIN });

// list newest-first with authors
let list = (await c.get(`/api/db/${slug}/rows/leads/1/notes`, { token: REPA })).json;
t.eq(list.notes.length, 3, "3 notes visible to the owner");
t.eq(list.notes[0].body, "flagged", "newest note first");
t.eq(list.notes[0].author_id, 1, "author id stamped");
t.ok(list.notes[2].body === "Left a voicemail", "oldest note last");

// kind filter
t.eq((await c.get(`/api/db/${slug}/rows/leads/1/notes?kind=call`, { token: REPA })).json.notes.length, 1, "?kind=call → 1");
t.eq((await c.get(`/api/db/${slug}/rows/leads/1/notes?kind=meeting`, { token: REPA })).json.notes.length, 1, "?kind=meeting → 1");

// invalid kind falls back to 'note'
let bad = await c.post(`/api/db/${slug}/rows/leads/1/notes`, { body: "x", kind: "telepathy" }, { token: REPA });
t.eq(bad.json.note.kind, "note", "invalid kind → defaults to note");
// empty body rejected
t.eq((await c.post(`/api/db/${slug}/rows/leads/1/notes`, { body: "  " }, { token: REPA })).status, 400, "empty note body → 400");

// delete: repB can't delete repA's note; author can; admin can delete anyone's
const callNoteId = n1.json.note.id;
t.eq((await c.del(`/api/db/${slug}/rows/leads/1/notes/${callNoteId}`, { token: REPB })).status, 404, "outsider can't even address the note (404, can't see lead)");
const mgrNoteId = n2.json.note.id;
t.eq((await c.del(`/api/db/${slug}/rows/leads/1/notes/${mgrNoteId}`, { token: REPA })).status, 403, "can't delete someone else's note (403)");
t.ok((await c.del(`/api/db/${slug}/rows/leads/1/notes/${callNoteId}`, { token: REPA })).json.deleted === 1, "author deletes own note");
t.ok((await c.del(`/api/db/${slug}/rows/leads/1/notes/${mgrNoteId}`, { token: ADMIN })).json.deleted === 1, "admin deletes any note");
t.eq((await c.get(`/api/db/${slug}/rows/leads/1/notes`, { token: REPA })).json.notes.length, 2, "2 notes remain after deletes");

// feed table (public read) → any member can note
await c.post(`/api/db/${slug}/rows/wall`, { text: "hi" }, { token: REPA }); // id 1
t.ok((await c.post(`/api/db/${slug}/rows/wall/1/notes`, { body: "public annotation" }, { token: REPB })).json.ok, "any member can note a public-read row");

// collect (write-only) table → no notes
await c.post(`/api/db/${slug}/rows/intake`, { email: "a@b.com" }, {}); // anonymous collect insert
t.eq((await c.post(`/api/db/${slug}/rows/intake/1/notes`, { body: "x" }, { token: ADMIN })).status, 400, "no notes on a write-only collect table");

// signed-out can't note
t.eq((await c.post(`/api/db/${slug}/rows/leads/1/notes`, { body: "x" }, {})).status, 401, "signed-out → 401");

t.done(); h.restore();
