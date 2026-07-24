// build-plan.mjs — turns a FULL app spec + a per-step output cap into an ordered BUILD PLAN: a sequence of steps
// each guaranteed to fit under the cap, so every step FINISHES and nothing truncates. The app is never shrunk —
// a bigger app just becomes more steps.
//
// Step 1 is the SHELL: scaffolding (index.html, config, main, API client, auth/toast context, router) + the shared
// component library + Home + SignIn. That's the big fixed overhead (~16k tokens observed) — and it's built ONCE.
// Steps 2..N are PAGE GROUPS: feature pages bin-packed so each group's output stays under the cap. These run as
// EDITS onto the shell, so each only OUTPUTS its own pages (the components already exist) — cheap, lots of headroom.
// A final REPAIR budget is reserved per step (schema-fix / fix-loop / vision each get their own capped call at run
// time; they're not pages, so they're noted, not packed).
//
// The per-page cost is ESTIMATED from each capability's real route count (a 6-route CRUD page is heavy, a 2-route
// read page is light). It's only a planning estimate — at run time the executor MEASURES actual tokens after the
// shell step and re-bins the remaining pages, so the plan self-corrects. Estimate to plan, measure to correct.

import { getCapability } from "./capability-registry.mjs";

// Token model, calibrated to observed builds (JSX ≈ 3.2 chars/token):
export const SHELL_TOKENS = 16000; // scaffolding + ~15 shared components + Home + SignIn + nav/router, built once
export const BASE_PAGE = 1800;     // a feature page's floor: layout, header, empty/loading states
export const PER_ROUTE = 700;      // each endpoint the page drives ≈ a fetch + the UI (form/row/action) around it
export const SAFETY = 0.85;        // leave headroom so estimate error doesn't push a step over the real cap

// pageCost — estimated output tokens to write one feature page, from its capability's route surface.
export function pageCost(capId, capFn = getCapability) {
  const c = capFn(capId);
  const routes = (c && Array.isArray(c.routes) && c.routes.length) || 3;
  return BASE_PAGE + routes * PER_ROUTE;
}

// buildPlan(spec, cap, opts) → { ok, cap, budget, steps, stepCount, warnings }
//   steps: ordered [{ kind:'shell'|'pages'|'admin', ... , tokens }]. Every step's tokens ≤ budget (= cap*SAFETY),
//   except a shell that's inherently bigger than the cap (flagged as a warning — the cap is too small to build).
export function buildPlan(spec, cap, opts = {}) {
  const capFn = opts.capFn || getCapability;
  const shellTokens = opts.shellTokens || SHELL_TOKENS;
  if (!spec || !Array.isArray(spec.capabilities)) return { ok: false, error: "invalid spec" };
  const budget = Math.floor(cap * SAFETY);
  const warnings = [];
  const steps = [];

  // Step 1 — the shell (built once). If it alone exceeds the budget, the cap can't build a real app; flag it but
  // still emit the step (the executor will stream it and take whatever fits, same as today's single-shot floor).
  if (shellTokens > budget) warnings.push(`shell (~${shellTokens} tok) exceeds the per-step budget (${budget}); raise the cap`);
  steps.push({ kind: "shell", tokens: shellTokens, includes: ["scaffolding", "components", "Home", "SignIn", "nav", "router"] });

  // Steps 2..N — bin-pack feature pages into groups, each group's OUTPUT ≤ budget. (Edits onto the shell only emit
  // their own pages, so a group's cost is just the sum of its pages — no shell re-payment.)
  const admin = (spec.roles || []).includes("admin");
  const feats = spec.capabilities.map((id) => ({ id, tokens: pageCost(id, capFn) }));
  let group = [], groupTokens = 0;
  const flush = () => { if (group.length) { steps.push({ kind: "pages", pages: group.map((g) => g.id), tokens: groupTokens }); group = []; groupTokens = 0; } };
  for (const f of feats) {
    // A single page heavier than the whole budget still gets its own step (best effort); note it.
    if (f.tokens > budget) warnings.push(`page "${f.id}" (~${f.tokens} tok) is heavier than one step's budget (${budget})`);
    if (group.length && groupTokens + f.tokens > budget) flush();
    group.push(f); groupTokens += f.tokens;
  }
  flush();

  // Admin console (if any admin role) — its own edit step; it's often heavy (observed ~3k+).
  if (admin) steps.push({ kind: "admin", pages: ["Admin"], tokens: BASE_PAGE + 4 * PER_ROUTE });

  return { ok: true, cap, budget, steps, stepCount: steps.length, warnings };
}

// planSummary — one-line-per-step human view of a plan (for logs / the live build UI).
export function planSummary(plan) {
  if (!plan || !plan.ok) return "(no plan)";
  return plan.steps.map((s, i) => {
    const what = s.kind === "shell" ? "shell (scaffold + components + Home + SignIn)" : s.kind === "admin" ? "Admin console" : "pages: " + s.pages.join(", ");
    return `  step ${i + 1} — ${what}  (~${s.tokens} tok ≤ ${plan.budget})`;
  }).join("\n");
}
