// chunked-build.mjs — the EXECUTOR for the cap-sized build plan. Runs the plan from build-plan.mjs step by step so
// every step finishes under the cap and nothing truncates:
//   step 1 (SHELL)   — REACT_RULES, "build ONLY the shell": scaffolding + shared component library + Home + SignIn,
//                      routing only Home/SignIn for now. The big fixed overhead, paid ONCE.
//   steps 2..N       — REACT_REVISE_RULES, "ADD these pages onto the existing app": emit the new src/pages/*.jsx +
//                      the updated App.jsx (new routes) + updated Nav (new links). Each edit only OUTPUTS its own
//                      pages, so it stays tiny — the components already exist.
// After the shell, we MEASURE the real overhead and re-bin the remaining pages against the true remaining budget —
// estimate to plan, measure to correct. Files are merged as we go (later steps overwrite App.jsx/Nav in full).
//
// Pure + injectable: pass deps.generate(system, user) -> {text, usedIn, usedInCached, usedOut}. No network here,
// so it unit-tests at $0 with a mock generate.

import { buildPlan } from "./build-plan.mjs";
import { pageCost } from "./build-plan.mjs";
import { parseGeneratedFiles, REACT_RULES, REACT_REVISE_RULES } from "./react-gen.mjs";
import { getCapability } from "./capability-registry.mjs";

const pascal = (s) => String(s || "").replace(/(^|[-_ ])([a-z])/g, (_, __, c) => c.toUpperCase()).replace(/[-_ ]/g, "");

// A compact view of the existing app for an edit: App.jsx + Nav + api + auth in full (the wiring the new pages must
// match), plus a manifest of every component/page file already present (so the model imports the real names). Full
// component source is omitted to keep input bounded; the manifest + the reused files carry enough to slot pages in.
function existingContext(files) {
  const keep = ["src/App.jsx", "src/lib/api.js"];
  const navKey = Object.keys(files).find((p) => /components\/Nav\.jsx$/i.test(p));
  const authKey = Object.keys(files).find((p) => /(Auth|auth)Context\.jsx$/.test(p) || /lib\/auth/.test(p));
  if (navKey) keep.push(navKey);
  if (authKey) keep.push(authKey);
  const shown = keep.filter((k) => files[k]).map((k) => "===FILE: " + k + "===\n" + files[k]).join("\n\n");
  const manifest = Object.keys(files).filter((p) => /^src\/components\//.test(p)).map((p) => p).join(", ");
  return "EXISTING FILES you must match (import from these, do not rewrite them):\n\n" + shown +
    "\n\nAVAILABLE SHARED COMPONENTS (import from these paths, reuse — do not recreate): " + manifest;
}

function shellPrompt(brief, spec) {
  const featurePages = (spec.capabilities || []).map((id) => pascal(id));
  return "Build ONLY THE SHELL of this React app — NOT the feature pages. This is step 1 of a multi-step build; the " +
    "feature pages are added in later steps.\n\nApp brief: " + brief + "\n\n" +
    "Create ONLY these: index.html; src/main.jsx; src/App.jsx that routes ONLY Home at \"/\" and SignIn at \"/signin\" " +
    "FOR NOW (later steps add more <Route>s); src/index.css; src/lib/api.js (the fetch helper for the per-site " +
    "backend); an auth context and a toast/notification context; the FULL SHARED UI COMPONENT LIBRARY under " +
    "src/components/ (Button, Card, Input, Select, Textarea, Modal, Badge, Table, EmptyState, Skeleton, Avatar, and " +
    "a Nav) — everything the feature pages will reuse, designed so they slot in cleanly; a polished Home landing page " +
    "(src/pages/Home.jsx); and a SignIn page (src/pages/SignIn.jsx). " +
    "The feature pages that WILL be added later (do NOT create their files now): " + featurePages.join(", ") + ". " +
    "Make the shell a COMPLETE, COMPILABLE base on its own. If this app needs a backend, emit isibi.schema.json now.";
}

function capDesc(capId) {
  const c = getCapability(capId);
  if (!c) return "- " + pascal(capId) + " page (src/pages/" + pascal(capId) + ".jsx)";
  return "- " + pascal(capId) + " page (src/pages/" + pascal(capId) + ".jsx): " + (c.summary || c.title) +
    "\n  Endpoints: " + (c.routes || []).map((r) => r.method + " " + r.path).join("; ");
}

function pagesPrompt(brief, capIds, files, label) {
  return "ADD " + (label || "these feature page(s)") + " to the EXISTING app below. Reuse the shared components in " +
    "src/components/ and the api helper in src/lib/api.js. Match the existing design exactly.\n\nApp brief: " + brief +
    "\n\nPages to add:\n" + capIds.map(capDesc).join("\n") + "\n\n" +
    "Emit ONLY: the new src/pages/*.jsx file(s); the updated src/App.jsx (ADD the new <Route>s, KEEP every existing " +
    "route); and the updated Nav component (ADD links to the new pages, KEEP existing links). Do NOT rewrite the " +
    "shared components or any other page.\n\n" + existingContext(files);
}

// rebinRemaining — after the shell's real size is known, re-pack the not-yet-built feature caps into groups that fit
// the TRUE remaining budget (cap*SAFETY per step — each edit only outputs its own pages, so the shell size doesn't
// reduce a later step's budget; this mainly recovers when the estimate was off, keeping groups ≤ budget).
function rebinRemaining(capIds, budget) {
  const groups = [];
  let g = [], t = 0;
  for (const id of capIds) {
    const c = pageCost(id);
    if (g.length && t + c > budget) { groups.push(g); g = []; t = 0; }
    g.push(id); t += c;
  }
  if (g.length) groups.push(g);
  return groups;
}

// runChunkedBuild(brief, spec, cap, deps, opts) → { ok, files, plan, steps:[{step,kind,out,files}], tokens }
export async function runChunkedBuild(brief, spec, cap, deps, opts = {}) {
  if (!deps || typeof deps.generate !== "function") return { ok: false, error: "deps.generate required" };
  const plan = buildPlan(spec, cap, opts);
  if (!plan.ok) return { ok: false, error: plan.error || "plan failed" };
  const budget = plan.budget;
  let files = {};
  let totIn = 0, totInCached = 0, totOut = 0;
  const steps = [];
  const record = (kind, g, f) => {
    totIn += g.usedIn || 0; totInCached += g.usedInCached || 0; totOut += g.usedOut || 0;
    const rec = { step: steps.length + 1, kind, out: g.usedOut || 0, files: Object.keys(f) };
    steps.push(rec); if (opts.onStep) opts.onStep(rec);
  };

  // Step 1 — the shell.
  {
    const g = await deps.generate(opts.shellRules || REACT_RULES, shellPrompt(brief, spec));
    const f = parseGeneratedFiles(g.text || "");
    for (const [p, v] of Object.entries(f)) files[p] = v;
    record("shell", g, f);
  }

  // Steps 2..N — feature pages, re-binned against the true budget, added as edits onto the shell.
  const featCaps = (spec.capabilities || []).slice();
  for (const group of rebinRemaining(featCaps, budget)) {
    const g = await deps.generate(opts.editRules || REACT_REVISE_RULES, pagesPrompt(brief, group, files, "these feature pages: " + group.map(pascal).join(", ")));
    const f = parseGeneratedFiles(g.text || "");
    for (const [p, v] of Object.entries(f)) files[p] = v;
    record("pages", g, f);
  }

  // Admin console (its own edit) when the app has an admin role.
  if ((spec.roles || []).includes("admin")) {
    const g = await deps.generate(opts.editRules || REACT_REVISE_RULES, pagesPrompt(brief, [], files, "an Admin console page (src/pages/Admin.jsx) that manages the app's data (list/create/edit/delete across the admin-only endpoints)"));
    const f = parseGeneratedFiles(g.text || "");
    for (const [p, v] of Object.entries(f)) files[p] = v;
    record("admin", g, f);
  }

  const ok = !!(files["index.html"] && files["src/App.jsx"] && files["src/main.jsx"]);
  return { ok, files, plan, steps, tokens: { in: totIn, inCached: totInCached, out: totOut } };
}
