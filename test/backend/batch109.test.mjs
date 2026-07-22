// Batch 109 — dry-run validation: POST /rows/<t>/validate checks field rules WITHOUT writing
import { installHarness, makeClient, makeTally } from "./harness.mjs";
const worker = (await import("../../worker.js")).default;
const h = installHarness(); const c = makeClient(worker, h);
const t = makeTally("Batch 109");
const slug = "b109";
await c.ensure(slug);
await c.schema(slug, { tables: {
  signups: { access: "collect", columns: [
    { name: "email", type: "text", required: true, format: "email" },
    { name: "age", type: "integer", min: 18, max: 120 },
    { name: "plan", type: "text", enum: ["free", "pro"] },
    { name: "code", type: "text", immutable: true },
  ] },
} });
const ADMIN = (await c.signup(slug, "admin@x.dev", "Str0ng-pass-9")).json.token; // first signup → admin
const val = (body, q) => c.post(`/api/db/${slug}/rows/signups/validate${q || ""}`, body);

// A clean row passes.
let ok = await val({ email: "a@b.com", age: 30, plan: "pro" });
t.eq(ok.status, 200, "validate → 200");
t.ok(ok.json.ok && ok.json.valid === true && ok.json.error === null, "valid row: valid:true, no error");

// Each rule fails with a message, and nothing is written.
t.ok(!(await val({ age: 30 })).json.valid, "missing required email → invalid");
t.ok(/email/i.test((await val({ email: "not-an-email" })).json.error || ""), "bad email format → message names email");
t.ok(!(await val({ email: "a@b.com", age: 5 })).json.valid, "age below min → invalid");
t.ok(!(await val({ email: "a@b.com", age: 200 })).json.valid, "age above max → invalid");
t.ok(!(await val({ email: "a@b.com", plan: "enterprise" })).json.valid, "value outside enum → invalid");

// Nothing was persisted by any of the above validate calls (checked via the admin full-site export).
let dump = (await c.get(`/api/db/${slug}/export`, { token: ADMIN })).json || {};
t.eq((dump.tables && dump.tables.signups || []).length, 0, "validate never inserted a row");

// Partial (edit) mode: required fields may be absent, but immutables are still rejected.
t.ok((await val({ age: 25 }, "?partial=1")).json.valid, "partial: missing required is OK on an edit");
t.ok(!(await val({ code: "X" }, "?partial=1")).json.valid, "partial: touching an immutable field → invalid");
t.ok((await val({ email: "a@b.com", code: "X" })).json.valid, "create: setting the immutable field IS allowed");

// GET not allowed.
t.eq((await c.get(`/api/db/${slug}/rows/signups/validate`)).status, 405, "validate is POST-only");

t.done(); h.restore();
