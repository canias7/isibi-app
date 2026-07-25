// Model router — the "Auto" brain behind the chatbox picker (Auto / Sonnet 5 / Opus 5).
//
// Encodes the routing table locked with the owner: Opus is the ARCHITECT + EMERGENCY expert (planning, hard
// integration, repeated difficult repair); Sonnet does all the generative bulk (design, frontend, backend, tests,
// normal repair, vision review); the deterministic checks (lint / compile / route-check / schema-check) use NO
// model at all — they're pure $0 code we already have. Haiku is intentionally NOT used: on the small outputs it
// would cover (tests, small repairs) its cost/latency edge is marginal, and repair is load-bearing (the eval showed
// 46% of apps only compile because of it), so reliability wins — owner's call.
//
// WORKER-SAFE: pure, no node:module. The picker is a plain function so it's trivially $0-testable.

// Opus 5 (2026-07-24): drop-in replacement for Opus 4.8 — same $5/$25 pricing, 1M context, 128k max output, same
// adaptive-thinking API shape; better agentic coding + a May-2026 knowledge cutoff (vs Jan 2026). 4.8 is now legacy.
export const MODELS = { opus: "claude-opus-5", sonnet: "claude-sonnet-5" };

// role → default tier under "Auto".
export const ROLE_ROUTES = {
  planner: "opus",            // architecture / spec reasoning
  architecture: "opus",       // premium architecture review (opt-in, hard builds)
  design: "sonnet",           // design tokens / global styles
  frontend: "sonnet",         // pages + components (the bulk)
  backend: "sonnet",          // schema + API wiring
  database: "sonnet",
  integration: "sonnet",      // stitch the slices together
  tests: "sonnet",            // ← switched from Haiku (owner's call): reliability over marginal savings
  vision: "sonnet",           // screenshot / design review (vision-capable)
  repair: "sonnet",           // normal + small repair
  "repair-hard": "opus",      // repeated / difficult repair — escalate to the expert
  "integration-hard": "opus", // difficult integration — escalate to the expert
};

// Steps that use NO model — deterministic $0 code we already run. Listed for documentation/coherence, never routed.
export const NO_MODEL = ["lint", "compile", "route-check", "schema-check"];

export const PICKERS = ["auto", "sonnet", "opus"];

// pickModel(role, opts) — the model id for a step.
//   opts.picker: "auto" (default) | "sonnet" | "opus" — the chatbox picker. sonnet/opus PIN every role to that model;
//                auto uses ROLE_ROUTES.
//   opts.hard:   escalate this step to Opus under Auto (repeated difficult repair, difficult integration). Ignored
//                when the picker pins a model.
export function pickModel(role, opts = {}) {
  const picker = String(opts.picker || "auto").toLowerCase();
  if (picker === "opus") return MODELS.opus;
  if (picker === "sonnet") return MODELS.sonnet;
  // auto:
  if (opts.hard) return MODELS.opus;
  const tier = ROLE_ROUTES[role] || "sonnet"; // unknown roles default to Sonnet (the safe generative default)
  return MODELS[tier] || MODELS.sonnet;
}

// escalateRole(role) — the "hard" variant of a role, if one exists (repair → repair-hard). Used to bump a step to
// Opus after repeated failure without the caller hardcoding model ids.
export function escalateRole(role) {
  return ROLE_ROUTES[role + "-hard"] ? role + "-hard" : role;
}

// routeTable() — the table as data (for a settings/debug view or docs). [{role, model, picker:'auto'}]
export function routeTable() {
  return Object.keys(ROLE_ROUTES).map((role) => ({ role, tier: ROLE_ROUTES[role], model: MODELS[ROLE_ROUTES[role]] }));
}

// isNoModel(step) — true when a step is deterministic code, not a model call.
export function isNoModel(step) { return NO_MODEL.includes(step); }
