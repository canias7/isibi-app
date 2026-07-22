// Batch 140 — direct messages: 1:1 threads, unread counts, read receipts, participant-only access
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 140");
const slug = "b140";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "t", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2
const D = (await c.signup(slug, "d@x.dev", "Str0ng-pass-9")).json.token; // id3
const send = (to, body, tok) => c.post(`/api/db/${slug}/dm`, { to, body }, { token: tok });
const thread = (other, tok, q) => c.get(`/api/db/${slug}/dm/${other}${q || ""}`, { token: tok });
const unread = (tok) => c.get(`/api/db/${slug}/dm/unread`, { token: tok }).then((r) => r.json.unread);

// A messages B; both directions land in the SAME thread.
t.eq((await send(2, "hi B", A)).status, 200, "A → B → 200");
await send(1, "hey A", B); // B → A (id1)
let ab = (await thread(2, A)).json.messages; // A's view of the thread with B
t.eq(ab.length, 2, "both messages in one thread");
t.eq(ab[0].body, "hey A", "newest first");
t.eq(ab[0].mine, false, "B's message is not mine (from A's view)");
t.eq(ab.find((m) => m.body === "hi B").mine, true, "A's own message flagged mine");
// B sees the same thread from their side.
let ba = (await thread(1, B)).json.messages;
t.eq(ba.length, 2, "B sees the same 2 messages");
t.eq(ba.find((m) => m.body === "hey A").mine, true, "B's own message flagged mine from B's view");

// Unread counts (messages TO you, not yet read).
t.eq(await unread(A), 1, "A has 1 unread (B's 'hey A')");
t.eq(await unread(B), 1, "B has 1 unread (A's 'hi B')");
// Reading the thread with markRead clears A's unread from B.
await thread(2, A, "?markRead=1");
t.eq(await unread(A), 0, "A's unread cleared after reading");
t.eq(await unread(B), 1, "B still has their unread");
// The explicit read endpoint works too.
await c.post(`/api/db/${slug}/dm/1/read`, {}, { token: B });
t.eq(await unread(B), 0, "B's unread cleared via /read");

// Threads list: last message + per-thread unread.
await send(2, "another", A); // A → B again (B now has 1 unread)
let th = (await c.get(`/api/db/${slug}/dm/threads`, { token: B })).json.threads;
t.ok(th.length === 1 && th[0].with === 1, "B has one conversation, with A");
t.eq(th[0].last.body, "another", "thread shows the last message");
t.eq(th[0].unread, 1, "thread unread count");

// A second conversation is separate.
await send(3, "hi D", A); // A → D
t.eq((await c.get(`/api/db/${slug}/dm/threads`, { token: A })).json.threads.length, 2, "A has 2 conversations");
// D's thread with A is isolated from B's.
t.ok(!(await thread(3, A)).json.messages.some((m) => m.body === "another"), "D's thread doesn't leak B's messages");

// Participant-only: D reading A↔B returns an empty thread (D isn't in it).
t.eq((await thread(2, D)).json.messages.length, 0, "a non-participant sees no messages");

// Guards.
t.eq((await send(1, "self", A)).status, 400, "can't message yourself → 400");
t.eq((await send(999, "ghost", A)).status, 404, "unknown recipient → 404");
t.eq((await send(2, "", A)).status, 400, "empty body → 400");
t.eq((await c.post(`/api/db/${slug}/dm`, { to: 2, body: "x" })).status, 401, "signed-out → 401");

t.done(); h.restore();
