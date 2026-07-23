// Batch 295 — WEBHOOK DEAD-LETTER + RETRY. Inspect failed deliveries and re-fire one. The hook URL points at a
// blocked host so safeFetch returns null deterministically (no real network). Covers dead-letter list, hook
// filter, retry (re-fires + logs), missing delivery, gone hook, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 295");
const slug = "b295";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // admin
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // member
const uuid = h.backends.find((b) => b.slug === slug).d1_uuid;
const db = h.getDb(uuid);
// Ensure the webhook tables exist (the existing list route does this).
await c.get(`/api/db/${slug}/webhooks`, { token: A });
db.prepare("CREATE TABLE IF NOT EXISTS _webhooks (id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT NOT NULL, events TEXT, secret TEXT, active INTEGER DEFAULT 1, created_at TEXT)").run();
db.prepare("CREATE TABLE IF NOT EXISTS _webhook_deliveries (id INTEGER PRIMARY KEY AUTOINCREMENT, hook_id INTEGER, event TEXT, ok INTEGER, status INTEGER, error TEXT, at TEXT)").run();
// A hook whose URL is a blocked host → safeFetch returns null (no network).
db.prepare("INSERT INTO _webhooks (url, events, secret, active, created_at) VALUES (?,?,?,1,?)").run("http://127.0.0.1/hook", "*", "sek", new Date().toISOString());
const hookId = db.prepare("SELECT id FROM _webhooks WHERE url=?").all("http://127.0.0.1/hook")[0].id;
const now = new Date().toISOString();
db.prepare("INSERT INTO _webhook_deliveries (hook_id, event, ok, status, error, at) VALUES (?,?,?,?,?,?)").run(hookId, "orders.created", 0, 500, "HTTP 500", now);
db.prepare("INSERT INTO _webhook_deliveries (hook_id, event, ok, status, error, at) VALUES (?,?,?,?,?,?)").run(hookId, "orders.created", 0, 0, "blocked", now);
db.prepare("INSERT INTO _webhook_deliveries (hook_id, event, ok, status, error, at) VALUES (?,?,?,?,?,?)").run(hookId, "orders.updated", 1, 200, null, now);
const failedId = db.prepare("SELECT id FROM _webhook_deliveries WHERE ok=0 ORDER BY id ASC").all()[0].id;

const dead = (tok, q) => c.get(`/api/db/${slug}/webhooks/dead-letter${q || ""}`, { token: tok });
const retry = (tok, id, body) => c.post(`/api/db/${slug}/webhooks/deliveries/${id}/retry`, body || {}, { token: tok });

// --- Dead-letter list ---
t.eq((await dead(A)).json.failed.length, 2, "dead-letter lists only the failed deliveries");
t.eq((await dead(A, "?hook=" + hookId)).json.failed.length, 2, "…filterable by hook");
t.eq((await dead(A, "?hook=999")).json.failed.length, 0, "…an unknown hook → none");

// --- Retry (hook is blocked → delivered false, and a new failed row is logged) ---
let r = (await retry(A, failedId, { data: { order: 1 } })).json;
t.eq(r.retried, failedId, "retry targets the delivery");
t.eq(r.delivered, false, "…delivery fails (blocked host)");
t.eq((await dead(A)).json.failed.length, 3, "…and a new failed delivery is recorded");

// --- Missing delivery + gone hook ---
t.eq((await retry(A, 999999)).status, 404, "retrying a missing delivery → 404");
db.prepare("INSERT INTO _webhook_deliveries (hook_id, event, ok, status, error, at) VALUES (?,?,?,?,?,?)").run(4242, "x.y", 0, 0, "err", now);
const orphan = db.prepare("SELECT id FROM _webhook_deliveries WHERE hook_id=4242").all()[0].id;
t.eq((await retry(A, orphan)).status, 409, "retrying a delivery whose hook is gone → 409");

// --- Authz ---
t.eq((await dead(B)).status, 403, "a member can't read dead-letter → 403");
t.eq((await retry(B, failedId)).status, 403, "a member can't retry → 403");
t.eq((await c.get(`/api/db/${slug}/webhooks/dead-letter`)).status, 401, "signed-out → 401");

t.done(); h.restore();
