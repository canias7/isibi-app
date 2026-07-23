// Batch 352 — HUMANIZE. Stateless formatter for bytes / duration / number / ordinal / relative time.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 352");
const slug = "b352";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const hu = (value, type) => c.post(`/api/db/${slug}/humanize`, { value, type }).then((r) => r.json);

// --- Bytes (1024-based) ---
t.eq((await hu(1536, "bytes")).humanized, "1.5 KB", "1536 bytes → 1.5 KB");
t.eq((await hu(1073741824, "bytes")).humanized, "1 GB", "1 GiB → 1 GB");
t.eq((await hu(500, "bytes")).humanized, "500 B", "under 1 KB stays bytes");

// --- Duration ---
t.eq((await hu(90, "duration")).humanized, "1m 30s", "90s → 1m 30s");
t.eq((await hu(3661, "duration")).humanized, "1h 1m 1s", "3661s → 1h 1m 1s");
t.eq((await hu(0, "duration")).humanized, "0s", "0s → 0s");

// --- Number ---
t.eq((await hu(1500, "number")).humanized, "1.5K", "1500 → 1.5K");
t.eq((await hu(2300000, "number")).humanized, "2.3M", "2.3M");
t.eq((await hu(999, "number")).humanized, "999", "under 1000 unchanged");

// --- Ordinal ---
t.eq((await hu(1, "ordinal")).humanized, "1st", "1 → 1st");
t.eq((await hu(2, "ordinal")).humanized, "2nd", "2 → 2nd");
t.eq((await hu(11, "ordinal")).humanized, "11th", "11 → 11th (teens special)");
t.eq((await hu(23, "ordinal")).humanized, "23rd", "23 → 23rd");

// --- Relative ---
t.eq((await hu(new Date(Date.now() - 3 * 86400000).toISOString(), "relative")).humanized, "3 days ago", "3 days ago");
t.ok(/in 2 hours/.test((await hu(new Date(Date.now() + 2 * 3600000 + 1000).toISOString(), "relative")).humanized), "future → 'in ...'");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/humanize`, { value: "x", type: "bytes" })).status, 400, "a non-numeric bytes → 400");
t.eq((await c.post(`/api/db/${slug}/humanize`, { value: 1, type: "bogus" })).status, 400, "an unknown type → 400");

t.done(); h.restore();
