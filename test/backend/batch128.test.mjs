// Batch 128 — effective-dated records: value as-of a date, history, snapshot across subjects
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 128");
const slug = "b128";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "t", type: "text" }] } } });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token;
const USER = (await c.signup(slug, "user@x.dev", "Str0ng-pass-9")).json.token;
const rec = (body, tok) => c.post(`/api/db/${slug}/effective`, body, { token: tok || ADMIN });
const asOf = (subject, attribute, date) => c.get(`/api/db/${slug}/effective?subject=${subject}&attribute=${attribute}${date ? "&as_of=" + date : ""}`, { token: ADMIN });

// Alice's salary history.
await rec({ subject: "alice", attribute: "salary", effective_date: "2025-01-01", value: 50000 });
await rec({ subject: "alice", attribute: "salary", effective_date: "2026-01-01", value: 60000 });
await rec({ subject: "alice", attribute: "salary", effective_date: "2026-07-01", value: 70000 });

// "As of" picks the latest change on or before the date.
t.eq((await asOf("alice", "salary", "2025-06-01")).json.value, 50000, "mid-2025 → 50000");
t.eq((await asOf("alice", "salary", "2026-01-01")).json.value, 60000, "on the change date → 60000 (inclusive)");
t.eq((await asOf("alice", "salary", "2026-03-15")).json.value, 60000, "between changes → 60000");
t.eq((await asOf("alice", "salary", "2026-08-01")).json.value, 70000, "after latest → 70000");
t.eq((await asOf("alice", "salary", "2024-01-01")).json.value, null, "before any record → null");
t.eq((await asOf("alice", "salary", "2026-01-01")).json.effective_date, "2026-01-01", "returns which record applied");

// Full history (no as_of).
let hist = (await asOf("alice", "salary")).json;
t.eq(hist.history.length, 3, "full history has 3 entries");
t.eq(hist.history[0].effective_date, "2026-07-01", "history newest-first");

// JSON values round-trip (position record as an object).
await rec({ subject: "alice", attribute: "position", effective_date: "2026-01-01", value: { title: "Engineer", level: 3 } });
t.eq((await asOf("alice", "position", "2026-06-01")).json.value.title, "Engineer", "object value round-trips");

// Upsert: same subject+attribute+date replaces.
await rec({ subject: "alice", attribute: "salary", effective_date: "2026-07-01", value: 72000 });
t.eq((await asOf("alice", "salary", "2026-08-01")).json.value, 72000, "same-date record upserts (no duplicate)");
t.eq((await asOf("alice", "salary")).json.history.length, 3, "history still 3 (upsert didn't add)");

// Snapshot across subjects: everyone's salary as of a date.
await rec({ subject: "bob", attribute: "salary", effective_date: "2026-01-01", value: 55000 });
await rec({ subject: "bob", attribute: "salary", effective_date: "2026-06-01", value: 58000 });
let snap = (await c.get(`/api/db/${slug}/effective/snapshot?attribute=salary&as_of=2026-06-15`, { token: ADMIN })).json;
const byS = Object.fromEntries(snap.values.map((v) => [v.subject, v.value]));
t.eq(byS.alice, 60000, "snapshot: alice as of 2026-06-15 → 60000 (the July raise isn't effective yet)");
t.eq(byS.bob, 58000, "snapshot: bob → 58000");
// snapshot earlier date sees earlier values, and excludes subjects with no record yet
let snap0 = (await c.get(`/api/db/${slug}/effective/snapshot?attribute=salary&as_of=2025-06-01`, { token: ADMIN })).json;
t.eq(snap0.values.length, 1, "only alice had a salary by mid-2025");

// Delete one dated entry.
const hid = (await asOf("alice", "salary")).json.history.find((x) => x.effective_date === "2025-01-01").id;
t.eq((await c.del(`/api/db/${slug}/effective/${hid}`, { token: ADMIN })).status, 200, "delete a dated entry");
t.eq((await asOf("alice", "salary", "2025-06-01")).json.value, null, "after delete, mid-2025 has no record");

// Validation + authz.
t.eq((await rec({ attribute: "x", effective_date: "2026-01-01", value: 1 })).status, 400, "missing subject → 400");
t.eq((await rec({ subject: "a", attribute: "x", effective_date: "bad", value: 1 })).status, 400, "bad date → 400");
t.eq((await rec({ subject: "a", attribute: "x", effective_date: "2026-01-01" })).status, 400, "missing value → 400");
t.eq((await rec({ subject: "a", attribute: "x", effective_date: "2026-01-01", value: 1 }, USER)).status, 403, "non-admin → 403");
t.eq((await c.get(`/api/db/${slug}/effective?subject=a&attribute=x`)).status, 401, "signed-out → 401");

t.done(); h.restore();
