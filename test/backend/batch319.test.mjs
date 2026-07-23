// Batch 319 — PASSWORD STRENGTH. Stateless 0–4 meter with a label + suggestions. Covers weak/common/strong,
// character-class scoring, sequences, suggestions, validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 319");
const slug = "b319";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const pw = (password) => c.post(`/api/db/${slug}/password-strength`, { password }).then((r) => r.json);

// --- Common / weak → 0 ---
t.eq((await pw("password")).score, 0, "a common password scores 0");
t.eq((await pw("password")).label, "very weak", "…labelled very weak");
t.eq((await pw("abc")).score, 0, "a too-short password scores 0");
t.eq((await pw("aaaaaaaa")).score, 0, "repeated characters score 0");

// --- A short mixed one is fair-ish, not strong ---
let r = await pw("Ab1!xy");
t.ok(r.score >= 1 && r.score <= 2, "a 6-char 4-class password is low-mid");

// --- A long multi-class one is strong ---
r = await pw("Tr0ub4dour&3xtra");
t.ok(r.score >= 3, "a long multi-class password scores high");
t.eq(r.classes, 4, "…all four character classes present");

// --- Suggestions guide the user ---
r = await pw("alllowercase");
t.ok(r.suggestions.some((s) => /number/.test(s)), "suggests adding a number");
t.ok(r.suggestions.some((s) => /upper/.test(s)), "suggests mixing case");

// --- Sequence penalty ---
t.ok((await pw("Abcd1234!x")).score <= (await pw("Kj9#mQ2!vL")).score + 1, "sequences don't help the score");

// --- Checks reported ---
r = await pw("MyP@ssw1234");
t.eq(r.checks.symbol, true, "reports the symbol check");
t.eq(r.checks.digit, true, "reports the digit check");
t.eq(r.length, 11, "reports the length");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/password-strength`, {})).status, 400, "a missing password → 400");

t.done(); h.restore();
