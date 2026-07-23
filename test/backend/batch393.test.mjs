// Batch 393 — ISBN. Stateless ISBN-10/13 validator + cross-conversion. Hyphens/spaces ignored. Covers valid
// 10/13, the X check digit, cross-conversion, bad check, validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 393");
const slug = "b393";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const isbn = (v) => c.post(`/api/db/${slug}/isbn`, { isbn: v }).then((r) => r.json);

// --- Valid ISBN-13 (with hyphens) ---
let r = await isbn("978-0-13-468599-1");
t.eq(r.valid, true, "a valid ISBN-13");
t.eq(r.type, "isbn13", "…detected as isbn13");
t.eq(r.isbn13, "9780134685991", "…normalized");
t.eq(r.isbn10, "0134685997", "…converted to ISBN-10");

// --- Valid ISBN-10 ---
r = await isbn("0-306-40615-2");
t.eq(r.valid, true, "a valid ISBN-10");
t.eq(r.type, "isbn10", "…detected as isbn10");
t.eq(r.isbn13, "9780306406157", "…converted to ISBN-13");

// --- X check digit ---
t.eq((await isbn("097522980X")).valid, true, "an ISBN-10 ending in X validates");

// --- Bad check digit ---
t.eq((await isbn("9780134685990")).valid, false, "a wrong ISBN-13 check digit → invalid");
t.eq((await isbn("0306406153")).valid, false, "a wrong ISBN-10 check digit → invalid");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/isbn`, {})).status, 400, "no isbn → 400");
t.eq((await c.post(`/api/db/${slug}/isbn`, { isbn: "12345" })).status, 400, "wrong length → 400");
t.eq((await c.post(`/api/db/${slug}/isbn`, { isbn: "97801346859AB" })).status, 400, "non-digit ISBN-13 → 400");

t.done(); h.restore();
