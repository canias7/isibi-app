// Batch 285 — CONFIG VALIDATION. A stateless validator for a single config object against a typed schema
// (type/required/default/enum/min/max), returning per-key errors AND a normalized object with defaults applied
// and values coerced. Covers valid, defaults, coercion, required, type, enum, numeric bounds, string length,
// unknown key, validation, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 285");
const slug = "b285";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token;
const run = (tok, body) => c.post(`/api/db/${slug}/config-validate`, body, tok === null ? {} : { token: tok });

const schema = {
  title: { type: "string", required: true, min: 3, max: 40 },
  theme: { type: "string", enum: ["light", "dark"], default: "light" },
  perPage: { type: "integer", min: 1, max: 100, default: 20 },
  ratio: { type: "number" },
  public: { type: "boolean", default: false },
};

// --- Valid config: defaults applied + values coerced ---
let r = (await run(A, { schema, config: { title: "Hello", perPage: "50", public: "true" } })).json;
t.eq(r.valid, true, "a valid config passes");
t.eq(r.normalized.theme, "light", "…a default is applied for a missing key");
t.eq(r.normalized.perPage, 50, "…an integer string is coerced to a number");
t.eq(r.normalized.public, true, "…a boolean string is coerced");
t.eq(r.normalized.title, "Hello", "…provided values pass through");

// --- Missing required ---
r = (await run(A, { schema, config: { theme: "dark" } })).json;
t.eq(r.valid, false, "a missing required key fails");
t.ok(r.errors.some((e) => e.key === "title" && /required/.test(e.message)), "…flagged as required");

// --- Wrong type ---
r = (await run(A, { schema, config: { title: "Hi there", perPage: "lots" } })).json;
t.ok(r.errors.some((e) => e.key === "perPage" && /integer/.test(e.message)), "a non-integer is flagged");

// --- Enum violation ---
r = (await run(A, { schema, config: { title: "Hi there", theme: "neon" } })).json;
t.ok(r.errors.some((e) => e.key === "theme" && /one of/.test(e.message)), "an out-of-enum value is flagged");

// --- Numeric bounds ---
r = (await run(A, { schema, config: { title: "Hi there", perPage: 500 } })).json;
t.ok(r.errors.some((e) => e.key === "perPage" && /max/.test(e.message)), "over-max integer is flagged");

// --- String length ---
r = (await run(A, { schema, config: { title: "ab" } })).json;
t.ok(r.errors.some((e) => e.key === "title" && /min length/.test(e.message)), "too-short string is flagged");

// --- Unknown key ---
r = (await run(A, { schema, config: { title: "Hi there", bogus: 1 } })).json;
t.ok(r.errors.some((e) => e.key === "bogus" && /unknown/.test(e.message)), "an unknown key is flagged");

// --- Validation + authz ---
t.eq((await run(A, { config: {} })).status, 400, "a missing schema → 400");
t.eq((await run(A, { schema: {}, config: {} })).status, 400, "an empty schema → 400");
t.eq((await c.post(`/api/db/${slug}/config-validate`, { schema, config: {} })).status, 401, "signed-out → 401");

t.done(); h.restore();
