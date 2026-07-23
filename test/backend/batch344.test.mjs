// Batch 344 — MASK. Stateless PII masker for email / phone / card / generic keep-last-N. Covers each type,
// keep count, custom char, validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 344");
const slug = "b344";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const mask = (body) => c.post(`/api/db/${slug}/mask`, body).then((r) => r.json);

// --- Email keeps the first char + domain ---
let r = await mask({ value: "jane.doe@example.com", type: "email" });
t.ok(r.masked.startsWith("j") && r.masked.endsWith("@example.com"), "email keeps first char + domain");
t.ok(!r.masked.includes("ane.doe"), "…hides the rest of the local part");

// --- Card keeps last 4 digits ---
r = await mask({ value: "4111 1111 1111 1234", type: "card" });
t.ok(r.masked.endsWith("1234"), "card keeps the last 4 digits");
t.ok(!/\d{5}/.test(r.masked), "…and hides the rest");

// --- Phone keeps last 4 ---
r = await mask({ value: "+1 (555) 867-5309", type: "phone" });
t.ok(r.masked.endsWith("5309"), "phone keeps the last 4");

// --- Generic keep-last-N ---
r = await mask({ value: "SECRET-TOKEN-ABCD", type: "generic", keep: 4 });
t.ok(r.masked.endsWith("ABCD"), "generic keeps the last N");
t.eq(r.masked.length, "SECRET-TOKEN-ABCD".length, "…same length");

// --- keep 0 masks everything ---
r = await mask({ value: "hidden", type: "generic", keep: 0 });
t.ok(!/[a-z]/i.test(r.masked), "keep 0 hides everything");

// --- Custom mask char ---
r = await mask({ value: "12345678", type: "generic", keep: 2, char: "*" });
t.ok(r.masked.startsWith("*") && r.masked.endsWith("78"), "honors a custom mask char");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/mask`, {})).status, 400, "a missing value → 400");

t.done(); h.restore();
