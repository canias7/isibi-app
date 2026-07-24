// build-plan.mjs — splits ONE shared output budget (the cap) across the build's steps so the SUM of all steps ≤ cap.
// The cap is the TOTAL output for the whole build, not a per-step limit: each step gets a SLICE of the budget, and
// the slices add up to the cap. Same total output as a single-shot, but split into small steps that each finish
// reliably (no truncation, no empty-output flake) instead of one fragile giant call.
//
// step 1 (SHELL) — scaffolding + shared component library + Home + SignIn. The big fixed overhead; it gets first
//   claim on the budget (capped so pages still get room).
// steps 2..N (PAGES) — feature pages, added as edits onto the shell. Packed into the REMAINING budget; pages that
//   don't fit are DROPPED (the app is bounded to what the total budget affords — raise the cap for a bigger app).
// last (ADMIN) — the admin console, if the app has an admin role.
//
// Each step carries `budget` = its max_tokens for that call. Σ step.budget ≤ cap.

import { getCapability } from "./capability-registry.mjs";

export const SHELL_TOKENS = 16000; // scaffolding + ~15 shared components + Home + SignIn + nav/router
export const BASE_PAGE = 1800;     // a feature page's floor
export const PER_ROUTE = 700;      // each endpoint the page drives
export const STEP_MAX = 9000;      // soft ceiling per step (keeps each call small + reliable, well under any wall)
export const SHELL_FRACTION = 0.6; // shell may claim at most this share of the total budget

export function pageCost(capId, capFn = getCapability) {
  const c = capFn(capId);
  const routes = (c && Array.isArray(c.routes) && c.routes.length) || 3;
  return BASE_PAGE + routes * PER_ROUTE;
}

// buildPlan(spec, cap, opts) → { ok, cap, total, steps, stepCount, included, dropped, warnings }
//   cap = TOTAL output budget for the whole build. steps each carry `budget` (their max_tokens); Σ budget ≤ cap.
export function buildPlan(spec, cap, opts = {}) {
  const capFn = opts.capFn || getCapability;
  const shellEst = opts.shellTokens || SHELL_TOKENS;
  const stepMax = opts.stepMax || STEP_MAX;
  if (!spec || !Array.isArray(spec.capabilities)) return { ok: false, error: "invalid spec" };
  const warnings = [];

  // Shell gets first claim, but capped to a share of the total so feature pages have room.
  const shellBudget = Math.min(shellEst, Math.max(1, Math.floor(cap * SHELL_FRACTION)));
  if (shellBudget < shellEst) warnings.push(`shell squeezed to ${shellBudget} tok of its ~${shellEst} need — the total cap (${cap}) is tight, so the shell itself may be thin`);
  const steps = [{ kind: "shell", budget: shellBudget, includes: ["scaffolding", "components", "Home", "SignIn", "nav", "router"] }];

  // Reserve for the admin console (if any), then pack feature pages into whatever budget remains.
  const admin = (spec.roles || []).includes("admin");
  const adminCost = admin ? Math.min(stepMax, BASE_PAGE + 4 * PER_ROUTE) : 0;
  let pageBudget = cap - shellBudget - adminCost;
  const included = [], dropped = [];
  for (const id of spec.capabilities) {
    const cost = pageCost(id, capFn);
    if (pageBudget - cost < 0) { dropped.push(id); continue; }
    pageBudget -= cost; included.push({ id, cost });
  }

  // Group the included pages so each step's budget ≤ stepMax (small, reliable calls).
  let group = [], gt = 0;
  const flush = () => { if (group.length) { steps.push({ kind: "pages", pages: group.map((g) => g.id), budget: gt }); group = []; gt = 0; } };
  for (const p of included) { if (group.length && gt + p.cost > stepMax) flush(); group.push(p); gt += p.cost; }
  flush();

  if (admin) steps.push({ kind: "admin", pages: ["Admin"], budget: adminCost });

  const total = steps.reduce((s, x) => s + x.budget, 0);
  if (dropped.length) warnings.push(`${dropped.length} page(s) dropped to keep the whole build ≤ ${cap} total: ${dropped.join(", ")} — raise the cap to include them`);
  return { ok: true, cap, total, budget: cap, steps, stepCount: steps.length, included: included.map((x) => x.id), dropped, warnings };
}

// planSummary — human view: each step's slice + the running total, showing Σ ≤ cap.
export function planSummary(plan) {
  if (!plan || !plan.ok) return "(no plan)";
  let run = 0;
  const lines = plan.steps.map((s, i) => {
    run += s.budget;
    const what = s.kind === "shell" ? "shell (scaffold + components + Home + SignIn)" : s.kind === "admin" ? "Admin console" : "pages: " + s.pages.join(", ");
    return `  step ${i + 1} — ${what}  [budget ${s.budget}, running ${run}]`;
  });
  return lines.join("\n") + `\n  Σ = ${plan.total} ≤ cap ${plan.cap}` + (plan.dropped.length ? `  (dropped: ${plan.dropped.join(", ")})` : "");
}
