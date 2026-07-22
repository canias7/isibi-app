// Batch 142 — GDPR erase completeness: deleting your own account now also wipes the
// personal-data side-tables that later features added (DMs, block edges, login history,
// presence, consents, saved views, authored notes) — not just the older social rows.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 142");
const slug = "b142";
await c.ensure(slug);
await c.schema(slug, { tables: { posts: { access: "feed", columns: [{ name: "body", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id2

const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const count = (sql, ...p) => { try { return h.getDb(uuid).prepare(sql).all(...p)[0].n; } catch { return -1; } };

// A and B exchange DMs; A blocks B; A signs in a couple times (login history); A saves a view + a consent.
await c.post(`/api/db/${slug}/dm`, { to: 2, body: "hi B" }, { token: A });   // A → B
await c.post(`/api/db/${slug}/dm`, { to: 1, body: "hey A" }, { token: B });   // B → A
await c.post(`/api/db/${slug}/block/2`, { on: true }, { token: A });          // A blocks B
await c.login(slug, "a@x.dev", "Str0ng-pass-9");                              // extra login row for A
await c.post(`/api/db/${slug}/presence`, {}, { token: A });                   // presence heartbeat
await c.post(`/api/db/${slug}/views/myfilter`, { spec: { q: "x" } }, { token: A });
await c.post(`/api/db/${slug}/auth/consent`, { doc: "tos", version: "1" }, { token: A });

// Sanity: A's data is present before the erase.
t.ok(count("SELECT COUNT(*) n FROM _dm_messages WHERE sender_id=1 OR recipient_id=1") >= 2, "A has DM rows before erase");
t.eq(count("SELECT COUNT(*) n FROM _blocks WHERE blocker_id=1"), 1, "A has a block edge before erase");
t.ok(count("SELECT COUNT(*) n FROM _logins WHERE user_id=1") >= 1, "A has login history before erase");
t.eq(count("SELECT COUNT(*) n FROM _views WHERE user_id=1"), 1, "A has a saved view before erase");
t.eq(count("SELECT COUNT(*) n FROM _consents WHERE user_id=1"), 1, "A has a consent before erase");
t.eq(count("SELECT COUNT(*) n FROM _presence WHERE user_id=1"), 1, "A has a presence row before erase");

// B's thread with A shows both messages before the erase.
t.eq((await c.get(`/api/db/${slug}/dm/1`, { token: B })).json.messages.length, 2, "B sees 2 messages with A before erase");

// A erases their account.
let r = await c.del(`/api/db/${slug}/auth/account`, { token: A, body: { password: "Str0ng-pass-9" } });
t.eq(r.json.deleted, true, "A's account deleted");

// Every personal-data side-table for A is now empty.
t.eq(count("SELECT COUNT(*) n FROM _dm_messages WHERE sender_id=1 OR recipient_id=1"), 0, "A's DMs wiped (both directions)");
t.eq(count("SELECT COUNT(*) n FROM _blocks WHERE blocker_id=1 OR blocked_id=1"), 0, "A's block edges wiped");
t.eq(count("SELECT COUNT(*) n FROM _logins WHERE user_id=1"), 0, "A's login history wiped");
t.eq(count("SELECT COUNT(*) n FROM _presence WHERE user_id=1"), 0, "A's presence wiped");
t.eq(count("SELECT COUNT(*) n FROM _views WHERE user_id=1"), 0, "A's saved views wiped");
t.eq(count("SELECT COUNT(*) n FROM _consents WHERE user_id=1"), 0, "A's consents wiped");
t.eq(count("SELECT COUNT(*) n FROM _users WHERE id=1"), 0, "A's user row gone");

// Black-box: B's conversation with A is now empty (A's messages to B are erased too).
t.eq((await c.get(`/api/db/${slug}/dm/1`, { token: B })).json.messages.length, 0, "B's thread with A is empty after A's erase");

// B is untouched — their own account still works.
t.eq((await c.get(`/api/db/${slug}/auth/me`, { token: B })).status, 200, "B's account is unaffected");

t.done(); h.restore();
