// Smart repair routing tests — pure classification, $0.
import { makeTally } from "./harness.mjs";
import { classifyFailures, repairPlan } from "../../builder/repair-router.mjs";

const t = makeTally("Repair router");

// --- compile error wins over everything (must compile first) ---
let p = repairPlan({ buildError: "Failed to resolve import './Missing.jsx'", lint: { errors: [{ rule: "fake-button", msg: "dead button", file: "src/pages/Home.jsx" }] } });
t.eq(p.kind, "compile", "a build error is the top priority");
t.eq(p.rulesKey, "fix", "…routed to the fix contract");
t.ok(/Failed to resolve/.test(p.instruction), "…instruction carries the build error");
t.ok(p.all.includes("compile") && p.all.includes("design"), "…all failure kinds reported");

// --- a fake API route routes to wiring with the offending call named ---
p = repairPlan({ lint: { errors: [{ rule: "api-route", msg: "calls /api/db/foo but no table 'foo'", file: "src/pages/List.jsx" }] } });
t.eq(p.kind, "route", "a nonexistent route is a route failure");
t.eq(p.rulesKey, "wiring", "…routed to the wiring contract");
t.ok(/List\.jsx/.test(p.instruction), "…instruction names the file");
t.ok(p.focusFiles.includes("src/pages/List.jsx"), "…focus files surfaced");

// --- missing schema → schema contract ---
t.eq(repairPlan({ schemaMissing: true }).rulesKey, "schema", "missing schema → schema repair");

// --- unwired form (a warning) → wiring ---
p = repairPlan({ lint: { errors: [], warnings: [{ rule: "form", msg: "form has no submit handler", file: "src/pages/Contact.jsx" }] } });
t.eq(p.kind, "wiring", "an unwired form is a wiring failure");
t.eq(p.rulesKey, "wiring", "…wiring contract");

// --- structural error (missing required file) → fix, and beats a route error ---
p = repairPlan({ lint: { errors: [{ rule: "required-file", msg: "missing src/App.jsx" }, { rule: "api-route", msg: "bad call", file: "x.jsx" }] } });
t.eq(p.kind, "structure", "structural break outranks a route error");
t.eq(p.rulesKey, "fix", "…routed to fix");

// --- dead link → design repair ---
p = repairPlan({ lint: { errors: [{ rule: "dead-link", msg: "href='#' goes nowhere", file: "src/components/Nav.jsx" }] } });
t.eq(p.kind, "design", "a dead link is a design/UX failure");
t.eq(p.rulesKey, "revise", "…routed to revise");

// --- low vision score → vision repair with issues, but only if nothing more fundamental is wrong ---
p = repairPlan({ vision: { minScore: 40, issues: [{ severity: "critical", area: "header", message: "invisible text", fix: "raise contrast" }] } });
t.eq(p.kind, "vision", "a low score with no other errors → vision repair");
t.eq(p.rulesKey, "revise", "…revise contract");
t.ok(/40\/100/.test(p.instruction) && /invisible text/.test(p.instruction), "…instruction has score + issue");

// --- a low vision score is NOT chosen while a compile error exists ---
t.eq(repairPlan({ buildError: "boom", vision: { minScore: 10, issues: [] } }).kind, "compile", "compile beats vision");

// --- a good score above threshold isn't a failure ---
t.eq(repairPlan({ vision: { minScore: 85, issues: [] } }).kind, "none", "a healthy app → nothing to repair");
t.eq(repairPlan({}).kind, "none", "empty context → none");

// --- classifyFailures surfaces every present kind ---
const kinds = classifyFailures({ buildError: "x", lint: { errors: [{ rule: "api-route", msg: "m", file: "f" }], warnings: [{ rule: "form", msg: "m", file: "g" }] }, vision: { minScore: 10, issues: [] } }).map((f) => f.kind);
t.ok(kinds.includes("compile") && kinds.includes("route") && kinds.includes("wiring") && kinds.includes("vision"), "classify lists all failure kinds present");

t.done();
