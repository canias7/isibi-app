// Batch 165 — ADVERSARIAL: effective-dated (as-of) temporal correctness at the boundaries + same-date
// upsert + typed values, and uniqueness constraints (uniqueCI is case-insensitive & global; unique is
// case-sensitive), including the 409 duplicate contract.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 165");
const slug = "b165";
await c.ensure(slug);
await c.schema(slug, { tables: {
  handles: { access: "user", uniqueCI: ["handle"], columns: [{ name: "handle", type: "text" }] },
  codes: { access: "admin", unique: ["code"], columns: [{ name: "code", type: "text" }] },
} });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token; // id1
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id2
const B = (await c.signup(slug, "b@x.dev", "Str0ng-pass-9")).json.token; // id3
const rec = (body, tok) => c.post(`/api/db/${slug}/effective`, body, { token: tok || ADMIN });
const asOf = (subject, attribute, date) => c.get(`/api/db/${slug}/effective?subject=${subject}&attribute=${attribute}${date ? "&as_of=" + date : ""}`, { token: ADMIN }).then((r) => r.json);

// Salary history with a change exactly at 2026-01-01.
await rec({ subject: "al", attribute: "salary", effective_date: "2025-01-01", value: 50000 });
await rec({ subject: "al", attribute: "salary", effective_date: "2026-01-01", value: 60000 });

// --- Boundary: the day BEFORE a change must still return the OLD value ---
t.eq((await asOf("al", "salary", "2025-12-31")).value, 50000, "the day before a change → the previous value");
t.eq((await asOf("al", "salary", "2026-01-01")).value, 60000, "on the change date → the new value (inclusive)");
t.eq((await asOf("al", "salary", "2026-01-02")).value, 60000, "the day after → the new value");

// --- Same-date upsert: re-recording the same subject+attr+date REPLACES, not duplicates ---
await rec({ subject: "al", attribute: "salary", effective_date: "2026-01-01", value: 65000 });
t.eq((await asOf("al", "salary", "2026-06-01")).value, 65000, "same-date re-record replaces the value");
const hist = (await asOf("al", "salary")).history || (await asOf("al", "salary")).records || [];
t.ok(Array.isArray(hist) && hist.filter((x) => (x.effective_date || "").startsWith("2026-01-01")).length === 1, "…and does NOT create a duplicate history row for that date");

// --- Attribute isolation: another attribute doesn't bleed in ---
await rec({ subject: "al", attribute: "title", effective_date: "2025-06-01", value: "Engineer" });
t.eq((await asOf("al", "salary", "2025-07-01")).value, 50000, "the 'title' change doesn't affect 'salary'");
t.eq((await asOf("al", "title", "2025-07-01")).value, "Engineer", "'title' resolves independently");

// --- Typed values round-trip (object) ---
await rec({ subject: "al", attribute: "comp", effective_date: "2026-01-01", value: { base: 60000, bonus: 5000 } });
t.eq((await asOf("al", "comp", "2026-02-01")).value.bonus, 5000, "an object value round-trips through as-of");

// --- Before any record → null ---
t.eq((await asOf("al", "salary", "2020-01-01")).value, null, "before any record → null");

// --- Non-admin can't write effective-dated records ---
t.eq((await rec({ subject: "al", attribute: "salary", effective_date: "2027-01-01", value: 1 }, A)).status, 403, "a non-admin can't record → 403");

// ── uniqueCI: case-insensitive, GLOBAL across members ──────────────────────────────────
t.eq((await c.post(`/api/db/${slug}/rows/handles`, { handle: "Alice" }, { token: A })).status, 200, "A claims 'Alice'");
let dup = await c.post(`/api/db/${slug}/rows/handles`, { handle: "alice" }, { token: B });
t.eq(dup.status, 409, "B claiming 'alice' collides case-insensitively → 409");
t.eq(dup.json.code, "duplicate", "…with code:duplicate");
// A totally different handle is fine.
t.eq((await c.post(`/api/db/${slug}/rows/handles`, { handle: "Bob" }, { token: B })).status, 200, "a distinct handle is accepted");

// ── unique (case-SENSITIVE): exact dup blocked, different case allowed ──────────────────
t.eq((await c.post(`/api/db/${slug}/rows/codes`, { code: "ABC" }, { token: ADMIN })).status, 200, "code ABC created");
t.eq((await c.post(`/api/db/${slug}/rows/codes`, { code: "ABC" }, { token: ADMIN })).status, 409, "exact duplicate ABC → 409");
t.eq((await c.post(`/api/db/${slug}/rows/codes`, { code: "abc" }, { token: ADMIN })).status, 200, "different case 'abc' is allowed (case-sensitive unique)");

t.done(); h.restore();
