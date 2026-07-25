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
import { scaffoldRouting, scaffoldTheme, scaffoldDbTypes, scaffoldAgentsMd } from "./scaffold.mjs";
import { getStyleFamily, pickStyleFamily } from "./design-system.mjs";
import { parseGeneratedFiles, REACT_RULES, REACT_REVISE_RULES, COMPONENT_INVENTORY } from "./react-gen.mjs";
import { getCapability } from "./capability-registry.mjs";
import { recipeFor, recipeForPage, recipeForName, renderRecipe } from "./page-recipes.mjs";
import { starterFiles, starterBrief, getStarter } from "./starters.mjs";

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
  // A starter can ship its own lib module (a cart, a domain helper) and its own pages. A later page step that
  // does not know they exist re-implements them, which is the exact duplication starters are meant to remove.
  const libs = Object.keys(files).filter((p) => /^src\/lib\//.test(p) && !keep.includes(p));
  const pages = Object.keys(files).filter((p) => /^src\/pages\//.test(p));
  return "EXISTING FILES you must match (import from these, do not rewrite them):\n\n" + shown +
    "\n\nAVAILABLE SHARED COMPONENTS in src/components/ (import these, reuse — NEVER recreate one):\n" + COMPONENT_INVENTORY +
    (extra.length ? "\nAlso built for this app: " + extra.join(", ") : "") +
    (libs.length ? "\nApp-specific helpers already written — import them, do not reimplement: " + libs.join(", ") : "") +
    (pages.length ? "\nPages that already exist (do NOT rewrite them): " + pages.join(", ") : "");
}

function shellPrompt(brief, spec, schema) {
  const featurePages = (spec.capabilities || []).map((id) => pascal(id));
  return "Build the OPENING of this React app — NOT the feature pages. This is step 1 of a multi-step build; the " +
    "feature pages are added in later steps.\n\nApp brief: " + brief + "\n\n" +
    "The scaffold (component library, lib/api, lib/auth, lib/toast, main.tsx, index.css, tailwind tokens) ALREADY " +
    "EXISTS — import from it, never recreate it. Routing is generated for you, so do NOT emit src/App.tsx.\n\n" +
    "Emit ONLY these files: `index.html` (real <title>, <meta name=description>, and the Google Fonts <link> for the " +
    "display/body faces); `src/pages/Home.tsx` — a polished, specific landing page for THIS product, built from the " +
    "existing components and design tokens; `src/pages/SignIn.tsx` — sign in / sign up using `useAuth()`" +
    (schema
      // The model would otherwise spend part of its budget re-deriving a data model that is already
      // decided, and land on different column names than the pages will be built against.
      ? ".\n\nTHE DATABASE IS ALREADY DECIDED — do NOT emit isibi.schema.json:\n" + String(schema).slice(0, 2000) + "\n"
      : "; and `isibi.schema.json` if the app needs a backend.\n") + "\n" +
    "Home.tsx:\n" + renderRecipe(recipeForPage("Home")) + "\n\nSignIn.tsx:\n" + renderRecipe(recipeForPage("SignIn")) + "\n\n" +
    "The feature pages added in later steps (do NOT create them now): " + featurePages.join(", ") + ". " +
    "Because the chrome already exists, spend the whole budget on making Home genuinely good.";
}

// The ADAPT step, used instead of the shell step when a whole-app starter matched. The starter is ALREADY in
// `files` — routed, themed and compiling — so this call is an edit, not a build. It gets the pages it may need to
// change in full (Home carries all the copy; the schema carries the data model) and a manifest of the rest, and
// it is told in as many words to emit only what actually changed.
function adaptPrompt(brief, spec, starterId, files) {
  const show = ["src/pages/Home.tsx", "isibi.schema.json"].filter((p) => files[p]);
  const dump = show.map((p) => "===FILE: " + p + "===\n" + files[p]).join("\n\n");
  const others = Object.keys(files).filter((p) => /^src\/pages\//.test(p) && !show.includes(p));
  const featurePages = (spec.capabilities || []).map((id) => pascal(id));
  return "Adapt this WORKING app to the brief below.\n\nApp brief: " + brief + "\n\n" + starterBrief(starterId) + "\n\n" +
    "Emit `index.html` (real <title> and <meta name=description> for THIS business, plus the Google Fonts <link>), " +
    "a rewritten `src/pages/Home.tsx` whose copy is specific to this business, and `isibi.schema.json` ONLY if the " +
    "brief needs a column or table the starter's model does not already have. Do NOT emit src/App.tsx or " +
    "src/routes.ts — routing is generated for you.\n\n" +
    "Photography: use `@@IMG:<prompt>@@` STATIC-LITERAL tokens, rewritten to describe THIS business.\n\n" +
    (featurePages.length ? "Extra pages are added in later steps (do NOT create them now): " + featurePages.join(", ") + ".\n\n" : "") +
    "THE APP AS IT STANDS:\n\n" + dump +
    (others.length ? "\n\nAlso present and already correct — do not re-emit these: " + others.join(", ") : "");
}

function capDesc(capId) {
  const c = getCapability(capId);
  // A brief can ask for something with no registry entry ("invoices"), and those were getting no shape at all —
  // exactly the case recipes exist to fix. Fall back to matching on the page's own name.
  if (!c) {
    const guess = renderRecipe(recipeForName(pascal(capId)));
    return "- " + pascal(capId) + " page (src/pages/" + pascal(capId) + ".tsx)" + (guess ? "\n" + guess : "");
  }
  // The SHAPE block is the instruction booklet: without it the model re-derives what a list page looks like on
  // every build, and lands somewhere slightly different each time. The recipe is chosen from the capability's
  // own route shape, so it stays right as capabilities are added.
  const shape = renderRecipe(recipeFor(c));
  return "- " + pascal(capId) + " page (src/pages/" + pascal(capId) + ".tsx): " + (c.summary || c.title) +
    "\n  Endpoints: " + (c.routes || []).map((r) => r.method + " " + r.path).join("; ") +
    (shape ? "\n" + shape : "");
}

function pagesPrompt(brief, capIds, files, label) {
  // The schema is decided before any page is written, so a page step can be told the exact table and
  // column names instead of guessing them — which is what made the schema-fix repair necessary.
  const schema = files["isibi.schema.json"];
  return "ADD " + (label || "these feature page(s)") + " to the EXISTING app below. Reuse the shared components in " +
    "src/components/ and read/write table data with `useResource` from src/lib/useResource.ts. Match the existing " +
    "design exactly.\n\nApp brief: " + brief +
    (schema ? "\n\nTHE DATABASE, already created and typed in src/lib/db-types.ts. Use these exact table and column " +
      "names — `useResource('<table>')` returns rows typed from this, so a name that is not here is a compile " +
      "error:\n" + String(schema).slice(0, 2500) : "") +
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
  // A matched STARTER is seeded before any generation: a complete, routed, compiling app for $0. Everything the
  // model does after this is an edit on top of something that already works, which is the whole point.
  const starterId = plan.starter || (opts.starter && opts.starter.id) || null;
  // A starter declares its own nav sequence: these pages form a JOURNEY (shop → cart → orders) and the
  // alphabetical default put the checkout before the shop.
  const navOrder = (starterId && (getStarter(starterId) || {}).navOrder) || [];
  let files = starterId ? starterFiles(starterId) : {};
  if (starterId) files = scaffoldRouting(files, { navOrder }).files;
  // The SCHEMA is decided before generation now (full-pipeline stage 5b), so it is seeded here and
  // the row types are generated from it BEFORE any page is written — that is the whole point of the
  // reorder. It runs again at the end, because a starter adapt step may still extend the model.
  if (opts.schema && !files["isibi.schema.json"]) files["isibi.schema.json"] = opts.schema;
  if (files["isibi.schema.json"]) files = scaffoldDbTypes(files);
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
    if (step.kind === "shell") { system = opts.shellRules || REACT_RULES; user = shellPrompt(brief, spec, files["isibi.schema.json"]); }
    else if (step.kind === "adapt") { system = opts.editRules || REACT_REVISE_RULES; user = adaptPrompt(brief, spec, starterId, files); }
    else if (step.kind === "admin") { system = opts.editRules || REACT_REVISE_RULES; user = pagesPrompt(brief, [], files, "an Admin console page (src/pages/Admin.tsx) that manages the app's data (list/create/edit/delete across the admin-only endpoints)\n" + renderRecipe(recipeForPage("Admin"))); }
    else { system = opts.editRules || REACT_REVISE_RULES; user = pagesPrompt(brief, step.pages, files, "these feature pages: " + step.pages.map(pascal).join(", ")); }
    const g = await deps.generate(system, user, step.budget);
    const f = parseGeneratedFiles(g.text || "");
    // Routing is owned by CODE: drop any router the model emitted anyway, then regenerate it from the pages that
    // now exist. Doing this after EVERY step keeps the app runnable mid-build and costs nothing.
    delete f["src/App.tsx"]; delete f["src/routes.ts"];
    delete f["src/App.jsx"]; delete f["src/routes.js"]; // a model may still reach for the old names
    for (const [p, v] of Object.entries(f)) files[p] = v;
    files = scaffoldRouting(files, { navOrder }).files;
    record(step.kind, step.budget, g, f);
  }

  // Per-app PALETTE, generated in code ($0): the shared components read semantic token NAMES, so swapping the
  // token VALUES re-skins the whole app — different canvas, accent, neutrals, fonts, radius — without touching a
  // single component. Keeps every generated app from looking identical.
  const famId = opts.family || pickStyleFamily((spec && spec.design_hints) || {});
  const fam = getStyleFamily(famId);
  if (fam) files = scaffoldTheme(files, fam.tokens);

  // Row TYPES from the app's own schema ($0). `useResource('bookings')` returns a typed Booking with no
  // annotation, a column typo becomes a compile error, and an enum column only accepts its declared values.
  // Runs LAST so it sees whatever schema the build actually ended up with, including a late schema-fix.
  files = scaffoldDbTypes(files);

  // The rules, travelling with the code. Without this, a customer who downloads the repo hands their own coding
  // agent 258 unfamiliar components and no idea which files are generated.
  files = scaffoldAgentsMd(files, { name: (spec && spec.name) || "" });

  // main.jsx / index.css / the component library come from the TEMPLATE, so they are not in `files` — the build is
  // valid when the model supplied the page content and the scaffold wired the router.
  const ok = !!(files["index.html"] && files["src/App.tsx"] && files["src/pages/Home.tsx"]);
  return { ok, files, plan, steps, tokens: { in: totIn, inCached: totInCached, out: totOut } };
}
