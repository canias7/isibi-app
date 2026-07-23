// Batch 279 — BULK IMPORT VALIDATION PREVIEW. A stateless dry-run: given a field spec and candidate rows,
// report per-row errors (missing required, wrong type, unknown column) with nothing written. Covers valid
// rows, required, each type (number/integer/boolean/email/date), unknown fields, empty spec, authz.
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 279");
const slug = "b279";
await c.ensure(slug);
await c.schema(slug, { tables: { note: { access: "admin", columns: [{ name: "x", type: "text" }] } } });
const A = (await c.signup(slug, "a@x.dev", "Str0ng-pass-9")).json.token; // id1
const preview = (tok, body) => c.post(`/api/db/${slug}/import-preview`, body, tok === null ? {} : { token: tok });

const fields = [
  { name: "email", type: "email", required: true },
  { name: "age", type: "integer", required: true },
  { name: "score", type: "number" },
  { name: "active", type: "boolean" },
  { name: "joined", type: "date" },
];

// --- A clean valid row + a batch with assorted errors ---
const rows = [
  { email: "ok@x.dev", age: 30, score: 9.5, active: true, joined: "2026-01-01" }, // 0 valid
  { age: 30 },                                                                     // 1 missing required email
  { email: "not-an-email", age: 5 },                                               // 2 bad email
  { email: "ok@x.dev", age: 3.5 },                                                 // 3 age not integer
  { email: "ok@x.dev", age: 1, score: "abc" },                                     // 4 score not number
  { email: "ok@x.dev", age: 1, active: "maybe" },                                  // 5 bad boolean
  { email: "ok@x.dev", age: 1, joined: "not-a-date" },                             // 6 bad date
  { email: "ok@x.dev", age: 1, extra: "x" },                                       // 7 unknown field
];
const r = (await preview(A, { fields, rows })).json;
t.eq(r.total, 8, "8 rows previewed");
t.eq(r.valid, 1, "1 valid");
t.eq(r.invalid, 7, "7 invalid");
t.ok(r.results[0].ok, "row 0 is clean");
t.eq(r.results[1].errors[0].field, "email", "row 1 flags the missing required email");
t.eq(r.results[1].errors[0].message, "required", "…as 'required'");
t.ok(/email/.test(r.results[2].errors[0].message), "row 2 flags a bad email type");
t.ok(/integer/.test(r.results[3].errors[0].message), "row 3 flags a non-integer age");
t.ok(/number/.test(r.results[4].errors[0].message), "row 4 flags a non-number score");
t.ok(/boolean/.test(r.results[5].errors[0].message), "row 5 flags a bad boolean");
t.ok(/date/.test(r.results[6].errors[0].message), "row 6 flags a bad date");
t.ok(r.results[7].errors.some((e) => /unknown/.test(e.message)), "row 7 flags an unknown field");

// --- Booleans accept string/number forms ---
const r2 = (await preview(A, { fields: [{ name: "flag", type: "boolean" }], rows: [{ flag: "true" }, { flag: 1 }, { flag: "0" }, { flag: false }] })).json;
t.eq(r2.valid, 4, "true/1/0/false all pass boolean");

// --- Empty rows → nothing to validate but a valid spec ---
t.eq((await preview(A, { fields, rows: [] })).json.total, 0, "an empty row set → total 0");

// --- Validation + authz ---
t.eq((await preview(A, { fields: [], rows })).status, 400, "no fields → 400");
t.eq((await preview(A, { fields: [{ type: "string" }], rows })).status, 400, "a field with no valid name → 400");
t.eq((await preview(null, { fields, rows })).status, 401, "signed-out → 401");

t.done(); h.restore();
