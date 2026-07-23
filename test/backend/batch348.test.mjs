// Batch 348 — LUHN. Stateless Luhn (mod-10) validator + check digit. Covers valid/invalid card numbers,
// formatting tolerance, the classic 7992739871→3 check digit, validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 348");
const slug = "b348";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const luhn = (number) => c.post(`/api/db/${slug}/luhn`, { number }).then((r) => r.json);

// --- Valid test card ---
let r = await luhn("4111111111111111");
t.eq(r.valid, true, "a valid Visa test number passes");
t.eq(r.length, 16, "…16 digits");

// --- One-digit corruption fails ---
t.eq((await luhn("4111111111111112")).valid, false, "a corrupted number fails");

// --- Formatting is tolerated ---
t.eq((await luhn("4111 1111 1111 1111")).valid, true, "spaces are ignored");
t.eq((await luhn("4111-1111-1111-1111")).valid, true, "dashes are ignored");

// --- Classic check-digit example: 7992739871 → 3 (full 79927398713 valid) ---
t.eq((await luhn("7992739871")).check_digit, 3, "computes the classic check digit 3");
t.eq((await luhn("79927398713")).valid, true, "…and the completed number validates");

// --- Another known valid card (Mastercard test) ---
t.eq((await luhn("5555555555554444")).valid, true, "a Mastercard test number passes");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/luhn`, { number: "" })).status, 400, "an empty number → 400");
t.eq((await c.post(`/api/db/${slug}/luhn`, { number: "abcd" })).status, 400, "no digits → 400");

t.done(); h.restore();
