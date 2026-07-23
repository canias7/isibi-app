// Batch 347 — CURRENCY FORMAT. Stateless Intl money formatter. Covers USD, EUR locale, zero-decimal JPY,
// symbol extraction, validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 347");
const slug = "b347";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const cf = (body) => c.post(`/api/db/${slug}/currency-format`, body).then((r) => r.json);

// --- USD en-US ---
let r = await cf({ amount: 1234.5, currency: "USD" });
t.eq(r.formatted, "$1,234.50", "USD en-US → $1,234.50");
t.eq(r.symbol, "$", "…symbol $");

// --- EUR de-DE ---
r = await cf({ amount: 1234.5, currency: "EUR", locale: "de-DE" });
t.ok(r.formatted.includes("€"), "EUR formats with the € symbol");
t.ok(r.formatted.includes("1.234"), "…de-DE uses a dot thousands separator");

// --- JPY has no minor units ---
r = await cf({ amount: 1234.5, currency: "JPY" });
t.ok(!r.formatted.includes(".5"), "JPY has no decimal places");
t.ok(/¥|JP¥/.test(r.formatted), "…and a yen symbol");

// --- Negative amount ---
r = await cf({ amount: -50, currency: "USD" });
t.ok(r.formatted.includes("50"), "negative amounts format");

// --- Defaults to USD ---
t.eq((await cf({ amount: 5 })).currency, "USD", "defaults to USD");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/currency-format`, { amount: "x", currency: "USD" })).status, 400, "a non-numeric amount → 400");
t.eq((await c.post(`/api/db/${slug}/currency-format`, { amount: 5, currency: "US" })).status, 400, "a malformed currency code → 400");

t.done(); h.restore();
