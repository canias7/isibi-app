// Batch 180 — REMINDERS (per-member scheduled notes). Create, list (default / due / upcoming / done),
// mark-done, edit, delete — every path scoped to the owner (another member's reminder is a 404, never
// leaked or mutable). Plus remind_at validation and the auth guards.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 180");
const slug = "b180";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const C = (await c.signup(slug, "c@x.dev", "Str0ng-pass-9")).json.token; // id3
const past = new Date(Date.now() - 3600e3).toISOString();
const future = new Date(Date.now() + 3600e3).toISOString();
const future2 = new Date(Date.now() + 7200e3).toISOString();
const create = (tok, body) => c.post(`/api/db/${slug}/reminders`, body, tok === null ? {} : { token: tok });
const list = (tok, qs) => c.get(`/api/db/${slug}/reminders${qs || ""}`, { token: tok }).then((r) => r.json.reminders);
const due = (tok) => c.get(`/api/db/${slug}/reminders/due`, { token: tok }).then((r) => r.json.reminders);
const done = (tok, id) => c.post(`/api/db/${slug}/reminders/${id}/done`, {}, { token: tok });
const patch = (tok, id, body) => c.patch(`/api/db/${slug}/reminders/${id}`, body, { token: tok });
const del = (tok, id) => c.del(`/api/db/${slug}/reminders/${id}`, { token: tok });

// --- Create three ---
const id1 = (await create(B, { remind_at: future, note: "call mom" })).json.id;
const id2 = (await create(B, { remind_at: past, note: "overdue task" })).json.id;
const id3 = (await create(B, { remind_at: future2, note: "later", subject: "work" })).json.id;
t.ok(id1 && id2 && id3, "three reminders created with ids");

// --- List (default: not-done, soonest first) ---
t.eq((await list(B)).map((r) => r.id), [id2, id1, id3], "default list is not-done, ordered by remind_at ASC");

// --- Due = not-done AND already past ---
t.eq((await due(B)).map((r) => r.id), [id2], "only the overdue one is 'due'");
// --- Upcoming = not-done AND future ---
t.eq((await list(B, "?upcoming=1")).map((r) => r.id).sort((a, b) => a - b), [id1, id3].sort((a, b) => a - b), "upcoming = the two future reminders");

// --- Mark done ---
t.eq((await done(B, id2)).json.done, true, "mark id2 done");
t.eq((await list(B)).map((r) => r.id), [id1, id3], "done reminder drops out of the default list");
t.eq((await due(B)).length, 0, "…and out of /due");
t.eq((await list(B, "?done=1")).map((r) => r.id), [id2], "?done=1 shows completed ones");

// --- Edit (PATCH) ---
t.eq((await patch(B, id1, { remind_at: past, note: "call mom NOW" })).json.updated, true, "PATCH reschedules id1 into the past");
t.eq((await due(B)).map((r) => r.id), [id1], "…so id1 is now due");
t.eq((await list(B)).find((r) => r.id === id1).note, "call mom NOW", "…and the note was updated");

// --- Delete ---
t.eq((await del(B, id3)).json.deleted, true, "delete id3");
t.ok(!(await list(B)).some((r) => r.id === id3), "id3 is gone from the list");

// --- Privacy / IDOR: C's reminder is untouchable + invisible to B ---
const cId = (await create(C, { remind_at: future, note: "C private" })).json.id;
t.eq((await del(B, cId)).status, 404, "B can't delete C's reminder → 404");
t.eq((await done(B, cId)).status, 404, "B can't complete C's reminder → 404");
t.eq((await patch(B, cId, { note: "hax" })).status, 404, "B can't edit C's reminder → 404");
t.ok(!(await list(B)).some((r) => r.id === cId), "C's reminder never appears in B's list");
t.eq((await list(C)).find((r) => r.id === cId).note, "C private", "…and C's reminder is intact");

// --- Validation + guards ---
t.eq((await create(B, { note: "no time" })).status, 400, "missing remind_at → 400");
t.eq((await create(B, { remind_at: "not-a-date", note: "x" })).status, 400, "bad remind_at → 400");
t.eq((await create(B, { remind_at: future })).status, 400, "missing note → 400");
t.eq((await patch(B, id1, {})).status, 400, "empty PATCH → 400");
t.eq((await patch(B, id1, { remind_at: "nope" })).status, 400, "PATCH bad remind_at → 400");
t.eq((await del(B, 999999)).status, 404, "delete a non-existent reminder → 404");
t.eq((await create(null, { remind_at: future, note: "x" })).status, 401, "signed-out create → 401");
t.eq((await c.get(`/api/db/${slug}/reminders`)).status, 401, "signed-out list → 401");

t.done(); h.restore();
