// chunked-build.mjs — the EXECUTOR for the cap-sized build plan. Runs the plan from build-plan.mjs step by step so
// every step finishes under the cap and nothing truncates:
//   step 1 (SHELL)   — REACT_RULES, "build ONLY the shell": scaffolding + shared component library + Home + SignIn,
//                      routing only Home/SignIn for now. The big fixed overhead, paid ONCE.
//   steps 2..N       — REACT_REVISE_RULES, "ADD these pages onto the existing app": emit the new src/pages/*.tsx +
//                      the updated App.tsx (new routes) + updated Nav (new links). Each edit only OUTPUTS its own
//                      pages, so it stays tiny — the components already exist.
// After the shell, we MEASURE the real overhead and re-bin the remaining pages against the true remaining budget —
// estimate to plan, measure to correct. Files are merged as we go (later steps overwrite App.tsx/Nav in full).
//
// Pure + injectable: pass deps.generate(system, user) -> {text, usedIn, usedInCached, usedOut}. No network here,
// so it unit-tests at $0 with a mock generate.

import { buildPlan } from "./build-plan.mjs";
import { scaffoldRouting, scaffoldTheme } from "./scaffold.mjs";
import { getStyleFamily, pickStyleFamily } from "./design-system.mjs";
import { parseGeneratedFiles, REACT_RULES, REACT_REVISE_RULES, COMPONENT_INVENTORY } from "./react-gen.mjs";
import { getCapability } from "./capability-registry.mjs";

const pascal = (s) => String(s || "").replace(/(^|[-_ ])([a-z])/g, (_, __, c) => c.toUpperCase()).replace(/[-_ ]/g, "");

// A compact view of the existing app for an edit: App.tsx + Nav + api + auth in full (the wiring the new pages must
// match), plus a manifest of every component/page file already present (so the model imports the real names). Full
// component source is omitted to keep input bounded; the manifest + the reused files carry enough to slot pages in.
function existingContext(files) {
  const keep = ["src/App.tsx", "src/lib/api.js"];
  const navKey = Object.keys(files).find((p) => /components\/Nav\.[jt]sx$/i.test(p));
  const authKey = Object.keys(files).find((p) => /(Auth|auth)Context\.[jt]sx$/.test(p) || /lib\/auth/.test(p));
  if (navKey) keep.push(navKey);
  if (authKey) keep.push(authKey);
  const shown = keep.filter((k) => files[k]).map((k) => "===FILE: " + k + "===\n" + files[k]).join("\n\n");
  // The kit lives in the TEMPLATE, not in `files`, so listing only `files` keys would advertise an EMPTY library
  // and the page step would rebuild a card/table/hero it already has. Ship the real inventory, plus anything the
  // shell step invented on top of it.
  const extra = Object.keys(files).filter((p) => /^src\/components\//.test(p));
  return "EXISTING FILES you must match (import from these, do not rewrite them):\n\n" + shown +
    "\n\nAVAILABLE SHARED COMPONENTS in src/components/ (import these, reuse — NEVER recreate one):\n" + COMPONENT_INVENTORY +
    (extra.length ? "\nAlso built for this app: " + extra.join(", ") : "");
}

function shellPrompt(brief, spec) {
  const featurePages = (spec.capabilities || []).map((id) => pascal(id));
  return "Build the OPENING of this React app — NOT the feature pages. This is step 1 of a multi-step build; the " +
    "feature pages are added in later steps.\n\nApp brief: " + brief + "\n\n" +
    "The scaffold (component library, lib/api, lib/auth, lib/toast, main.tsx, index.css, tailwind tokens) ALREADY " +
    "EXISTS — import from it, never recreate it. Routing is generated for you, so do NOT emit src/App.tsx.\n\n" +
    "Emit ONLY these files: `index.html` (real <title>, <meta name=description>, and the Google Fonts <link> for the " +
    "display/body faces); `src/pages/Home.tsx` — a polished, specific landing page for THIS product, built from the " +
    "existing components and design tokens; `src/pages/SignIn.tsx` — sign in / sign up using `useAuth()`; and " +
    "`isibi.schema.json` if the app needs a backend. " +
    "The feature pages added in later steps (do NOT create them now): " + featurePages.join(", ") + ". " +
    "Because the chrome already exists, spend the whole budget on making Home genuinely good.";
}

function capDesc(capId) {
  const c = getCapability(capId);
  if (!c) return "- " + pascal(capId) + " page (src/pages/" + pascal(capId) + ".tsx)";
  return "- " + pascal(capId) + " page (src/pages/" + pascal(capId) + ".tsx): " + (c.summary || c.title) +
    "\n  Endpoints: " + (c.routes || []).map((r) => r.method + " " + r.path).join("; ");
}

function pagesPrompt(brief, capIds, files, label) {
  return "ADD " + (label || "these feature page(s)") + " to the EXISTING app below. Reuse the shared components in " +
    "src/components/ and the api helper in src/lib/api.js. Match the existing design exactly.\n\nApp brief: " + brief +
    "\n\nPages to add:\n" + capIds.map(capDesc).join("\n") + "\n\n" +
    "Emit ONLY the new `src/pages/*.tsx` file(s) — nothing else. Routing and the nav link are generated for you the " +
    "moment the page file exists, so do NOT emit src/App.tsx, src/routes.js, or Nav.tsx, and do NOT rewrite the " +
    "shared components or any other page. Your entire budget goes into the page(s) themselves.\n\n" + existingContext(files);
}

// runChunkedBuild(brief, spec, cap, deps, opts) → { ok, files, plan, steps:[{step,kind,budget,out,files}], tokens }
// Runs the plan from buildPlan: each step is a generate call whose max_tokens is that step's budget slice, so the
// SUM of all steps' output stays within the cap. deps.generate(system, user, maxTokens) — the third arg is the
// step's budget. Dropped pages (over the total budget) are simply never built.
export async function runChunkedBuild(brief, spec, cap, deps, opts = {}) {
  if (!deps || typeof deps.generate !== "function") return { ok: false, error: "deps.generate required" };
  const plan = buildPlan(spec, cap, opts);
  if (!plan.ok) return { ok: false, error: plan.error || "plan failed" };
  let files = {};
  let totIn = 0, totInCached = 0, totOut = 0;
  const steps = [];
  const record = (kind, budget, g, f) => {
    totIn += g.usedIn || 0; totInCached += g.usedInCached || 0; totOut += g.usedOut || 0;
    const rec = { step: steps.length + 1, kind, budget, out: g.usedOut || 0, files: Object.keys(f) };
    steps.push(rec); if (opts.onStep) opts.onStep(rec);
  };

  for (const step of plan.steps) {
    if (step.reserve) continue; // reserved pipeline steps (schema-fix/lint-repair/fix-loop/vision) run in the real pipeline, not here
    let system, user;
    if (step.kind === "shell") { system = opts.shellRules || REACT_RULES; user = shellPrompt(brief, spec); }
    else if (step.kind === "admin") { system = opts.editRules || REACT_REVISE_RULES; user = pagesPrompt(brief, [], files, "an Admin console page (src/pages/Admin.tsx) that manages the app's data (list/create/edit/delete across the admin-only endpoints)"); }
    else { system = opts.editRules || REACT_REVISE_RULES; user = pagesPrompt(brief, step.pages, files, "these feature pages: " + step.pages.map(pascal).join(", ")); }
    const g = await deps.generate(system, user, step.budget);
    const f = parseGeneratedFiles(g.text || "");
    // Routing is owned by CODE: drop any router the model emitted anyway, then regenerate it from the pages that
    // now exist. Doing this after EVERY step keeps the app runnable mid-build and costs nothing.
    delete f["src/App.tsx"]; delete f["src/routes.ts"];
    delete f["src/App.jsx"]; delete f["src/routes.js"]; // a model may still reach for the old names
    for (const [p, v] of Object.entries(f)) files[p] = v;
    files = scaffoldRouting(files).files;
    record(step.kind, step.budget, g, f);
  }

  // Per-app PALETTE, generated in code ($0): the shared components read semantic token NAMES, so swapping the
  // token VALUES re-skins the whole app — different canvas, accent, neutrals, fonts, radius — without touching a
  // single component. Keeps every generated app from looking identical.
  const famId = opts.family || pickStyleFamily((spec && spec.design_hints) || {});
  const fam = getStyleFamily(famId);
  if (fam) files = scaffoldTheme(files, fam.tokens);

  // main.jsx / index.css / the component library come from the TEMPLATE, so they are not in `files` — the build is
  // valid when the model supplied the page content and the scaffold wired the router.
  const ok = !!(files["index.html"] && files["src/App.tsx"] && files["src/pages/Home.tsx"]);
  return { ok, files, plan, steps, tokens: { in: totIn, inCached: totInCached, out: totOut } };
}
