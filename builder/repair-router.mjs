// Smart repair routing — upgrade #8.
//
// Today a failed generation gets one generic fix/revise pass. But a compile error, an undeclared backend table, a
// dead button, and a weak visual design each want a DIFFERENT repair prompt. This module classifies the failure(s)
// and routes each to the right existing contract — REACT_FIX_RULES (compile/structure), SCHEMA_REPAIR_RULES
// (missing tables), WIRING_REPAIR_RULES (forms/routes), or REACT_REVISE_RULES (design/vision) — with a FOCUSED
// instruction naming exactly what's wrong. Targeted repair is faster and lands more often than one catch-all pass.
//
// The module returns a small `rulesKey` (not the big rule strings) so it stays decoupled + $0-testable; the Worker
// maps rulesKey → the imported rules constant it already has. WORKER-SAFE: pure, no node:module.

// kind → which repair contract to use.
const RULES = { compile: "fix", structure: "fix", schema: "schema", route: "wiring", wiring: "wiring", design: "revise", vision: "revise" };
// Fix the most fundamental thing first: a non-compiling app must compile before its design matters.
const PRIORITY = ["compile", "structure", "schema", "route", "wiring", "design", "vision"];

const STRUCTURAL = new Set(["required-file", "index-html", "index-css", "router", "import", "external"]);
const DESIGN = new Set(["fake-button", "dead-link"]);
const WIRING_WARN = new Set(["form", "upload"]);

// classifyFailures(ctx) — every actionable failure present, as {kind, items?, detail?, score?}.
//   ctx: { buildError?, lint?:{errors:[{rule,msg,file}], warnings:[...]}, vision?:{minScore, issues:[...]},
//          schemaMissing?, threshold? }
export function classifyFailures(ctx = {}) {
  const found = [];
  if (ctx.buildError) found.push({ kind: "compile", detail: String(ctx.buildError).slice(0, 3000) });

  const errs = (ctx.lint && Array.isArray(ctx.lint.errors) ? ctx.lint.errors : []);
  const warns = (ctx.lint && Array.isArray(ctx.lint.warnings) ? ctx.lint.warnings : []);
  const structural = errs.filter((e) => STRUCTURAL.has(e.rule));
  const routes = errs.filter((e) => e.rule === "api-route");
  const design = errs.filter((e) => DESIGN.has(e.rule));
  const otherErrs = errs.filter((e) => !STRUCTURAL.has(e.rule) && e.rule !== "api-route" && !DESIGN.has(e.rule));
  const wiring = [...warns.filter((w) => WIRING_WARN.has(w.rule)), ...otherErrs];

  if (ctx.schemaMissing) found.push({ kind: "schema", items: [] });
  if (structural.length) found.push({ kind: "structure", items: structural });
  if (routes.length) found.push({ kind: "route", items: routes });
  if (wiring.length) found.push({ kind: "wiring", items: wiring });
  if (design.length) found.push({ kind: "design", items: design });

  const vis = ctx.vision;
  if (vis && typeof vis.minScore === "number" && vis.minScore < (ctx.threshold || 60)) found.push({ kind: "vision", items: Array.isArray(vis.issues) ? vis.issues : [], score: vis.minScore });
  return found;
}

function itemLines(items) {
  return (items || []).map((i) => "- " + (i.rule ? "[" + i.rule + "] " : "") + (i.msg || i.message || "") + (i.file ? " (" + i.file + ")" : "")).join("\n");
}

// buildInstruction(top, ctx) — the focused repair message for the chosen failure kind.
function buildInstruction(top, ctx) {
  switch (top.kind) {
    case "compile":
      return "The Vite build FAILED with this error:\n\n" + top.detail + "\n\nFix the ROOT CAUSE and return only the corrected file(s).";
    case "structure":
      return "The generated app has structural problems that break it:\n" + itemLines(top.items) + "\n\nReturn the corrected file(s), keeping the design and content intact.";
    case "schema":
      return "The app calls its backend but never declared `isibi.schema.json`, so every /auth and /rows call 404s. Emit the schema declaring every table the app uses.";
    case "route":
      return "These API calls reference backend routes/tables that don't exist — either declare the table in `isibi.schema.json` or correct the call:\n" + itemLines(top.items) + "\n\nReturn only the file(s) needed to make every call resolve.";
    case "wiring":
      return "These forms/actions aren't wired to a backend write (or are otherwise unwired). Wire each to `/api/db/<slug>/…` and declare its table:\n" + itemLines(top.items) + "\n\nReturn only the changed file(s).";
    case "design":
      return "These controls are DEAD (fake buttons / broken links) — every button and link must do something real (a Router <Link>, an in-page action, or a handler):\n" + itemLines(top.items) + "\n\nReturn only the changed file(s).";
    case "vision":
      return "The rendered design scored " + top.score + "/100. Fix the highest-severity visual issues (keep the structure + content):\n" +
        (top.items || []).slice(0, 8).map((i) => "- [" + (i.severity || "minor") + "] " + (i.area || "general") + ": " + (i.message || "") + (i.fix ? " → " + i.fix : "")).join("\n") + "\n\nReturn only the file(s) you need to change.";
    default:
      return "";
  }
}

// repairPlan(ctx) — the single next repair to run: { kind, rulesKey, instruction, focusFiles, all }.
// kind 'none' when nothing is actionable. Callers map rulesKey → their rules constant
// (fix→REACT_FIX_RULES, schema→SCHEMA_REPAIR_RULES, wiring→WIRING_REPAIR_RULES, revise→REACT_REVISE_RULES).
export function repairPlan(ctx = {}) {
  const found = classifyFailures(ctx);
  if (!found.length) return { kind: "none", rulesKey: null, instruction: "", focusFiles: [], all: [] };
  found.sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind));
  const top = found[0];
  return {
    kind: top.kind,
    rulesKey: RULES[top.kind] || "revise",
    instruction: buildInstruction(top, ctx),
    focusFiles: [...new Set((top.items || []).map((i) => i.file).filter(Boolean))],
    all: found.map((f) => f.kind),
  };
}
