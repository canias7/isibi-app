// Batch 335 — ADDRESS FORMAT. Stateless postal-address formatter into a country-appropriate multi-line layout.
// Covers US (City, REGION POSTAL), GB (city / POSTAL), default, line2, empty parts, validation.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 335");
const slug = "b335";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
await c.signup(slug, "a@x.dev", "Str0ng-pass-9");
const af = (body) => c.post(`/api/db/${slug}/address-format`, body).then((r) => r.json);

// --- US format ---
let r = await af({ line1: "123 Main St", city: "Springfield", region: "IL", postal: "62704", country: "US" });
t.ok(r.lines.includes("Springfield, IL 62704"), "US puts City, REGION POSTAL on one line");
t.ok(r.formatted.startsWith("123 Main St\n"), "…street on the first line");
t.ok(r.formatted.endsWith("US"), "…country last");

// --- line2 included ---
r = await af({ line1: "1 Infinite Loop", line2: "Suite 5", city: "Cupertino", region: "CA", postal: "95014", country: "US" });
t.ok(r.lines.includes("Suite 5"), "line2 is kept");
t.eq(r.lines[1], "Suite 5", "…right after line1");

// --- GB format ---
r = await af({ line1: "10 Downing St", city: "London", postal: "sw1a 2aa", country: "GB" });
t.ok(r.lines.includes("London"), "GB keeps the city on its own line");
t.ok(r.lines.includes("SW1A 2AA"), "…and upper-cases the postcode");

// --- Default (unknown country) ---
r = await af({ line1: "Rue de X 5", city: "Paris", postal: "75001", country: "France" });
t.ok(r.formatted.includes("Paris") && r.formatted.includes("75001"), "default joins city/region/postal");
t.ok(r.formatted.endsWith("France"), "…country last");

// --- No country ---
r = await af({ line1: "PO Box 1", city: "Nowhere" });
t.ok(r.lines.length >= 2, "works without a country");

// --- Validation ---
t.eq((await c.post(`/api/db/${slug}/address-format`, { region: "CA" })).status, 400, "neither line1 nor city → 400");

t.done(); h.restore();
