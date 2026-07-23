// Multi-agent generation orchestrator (upgrade #1).
//
// Instead of one Sonnet call streaming the whole app top-to-bottom (which truncates on big apps and is slow),
// this runs a CONTRACT-FIRST fan-out: the deterministic planner fixes a shared contract (routes, tables, design
// tokens, shared component names) up front, then design / backend / shell / per-page agents each generate their
// own small slice IN PARALLEL against that fixed contract — so no agent can invent a name another agent doesn't
// expect ("five agents produce incompatible code" is the failure this prevents). Slices are disjoint files, so
// integration is a plain merge. Each slice is small → no truncation; slices run concurrently → wall-clock is the
// slowest slice, not the sum.
//
// Model routing is per-agent via model-router (Auto = Opus for planning/hard, Sonnet for the generative bulk).
// WORKER-SAFE: pure + injected generate, so it's $0-testable end-to-end with a mock. The real parallel model calls
// live in the injected deps.generate; this module owns the decomposition, the contract, routing, and the merge.
import { planApp } from "./app-planner.mjs";
import { pickStyleFamily, getStyleFamily } from "./design-system.mjs";
import { pickModel } from "./model-router.mjs";
import { parseGeneratedFiles, REACT_RULES } from "./react-gen.mjs";

// buildContract(spec, familyId) — the single source of truth every agent generates against.
export function buildContract(spec, familyId) {
  const fam = getStyleFamily(familyId) || {};
  const tokens = fam.tokens || {};
  const pages = (spec.pages || []).map((p) => ({ name: p.name, path: p.path, purpose: p.purpose, capabilities: p.capabilities || [] }));
  const shared = ["Nav"];
  if (pages.length > 2) shared.push("Footer");
  return {
    name: spec.name || "",
    intent: spec.intent || "",
    pages,
    tables: spec.tables || [],
    capabilities: spec.capabilities || [],
    roles: spec.roles || [],
    design: { familyId, name: fam.name || "", mood: fam.mood || "", tokens },
    sharedComponents: shared,
  };
}

// contractText(contract) — the compact block injected into every agent prompt so they all agree.
export function contractText(c) {
  const t = c.design.tokens || {};
  const palette = ["bg", "surface", "text", "muted", "accent", "border"].map((k) => t[k]).filter(Boolean).join(" ");
  return [
    "SHARED CONTRACT — every file you generate MUST match this exactly (routes, table names, palette, component names are FIXED):",
    "App: " + c.name + (c.intent ? " — " + c.intent : ""),
    "Routes (all pages, HashRouter): " + c.pages.map((p) => p.path).join(", "),
    "Data tables (backend): " + (c.tables.length ? c.tables.join(", ") : "(none)"),
    "Design family: " + c.design.name + " (" + c.design.mood + ")",
    "Palette: " + palette,
    "Fonts: " + [t.fontDisplay, t.fontBody].filter(Boolean).join(" / "),
    "Shared components (defined by the shell, imported by pages): " + c.sharedComponents.join(", "),
  ].join("\n");
}

// agentPlan(contract) — the parallel agent tasks. All follow REACT_RULES (shared conventions); each is scoped to a
// disjoint set of files. design + backend + shell + one-per-page all run concurrently against the fixed contract.
export function agentPlan(contract) {
  const ctx = contractText(contract);
  const tasks = [];

  // Design slice — tokens → tailwind + global CSS.
  tasks.push({
    key: "design", role: "design", files: ["tailwind.config.js", "src/index.css"],
    system: REACT_RULES,
    user: ctx + "\n\nYOUR SLICE: output ONLY `tailwind.config.js` (extend theme colors + fontFamily from the palette/fonts above, loading the Google Fonts) and `src/index.css` (the three @tailwind lines plus any @layer base). Nothing else.",
  });

  // Backend slice — schema for the contract's tables.
  if ((contract.tables || []).length) {
    tasks.push({
      key: "backend", role: "backend", files: ["isibi.schema.json"],
      system: REACT_RULES,
      user: ctx + "\n\nYOUR SLICE: output ONLY `isibi.schema.json` declaring every table listed above, with sensible columns/types/constraints per the BACKEND protocol. Nothing else.",
    });
  }

  // Shell slice — entry + router + shared components.
  tasks.push({
    key: "shell", role: "frontend", files: ["index.html", "src/main.jsx", "src/App.jsx", ...contract.sharedComponents.map((n) => "src/components/" + n + ".jsx")],
    system: REACT_RULES,
    user: ctx + "\n\nYOUR SLICE: output ONLY the app SHELL — `index.html`, `src/main.jsx` (mounts <App/> in <HashRouter>), `src/App.jsx` (a <Route> for EVERY route above, importing each page from `src/pages/<Name>.jsx`), and the shared components " + contract.sharedComponents.join(", ") + " under `src/components/` (e.g. Nav links to every route). Do NOT output any `src/pages/*` file. Use the exact routes + component names above.",
  });

  // One agent per page — the bulk, parallelized.
  for (const p of contract.pages) {
    tasks.push({
      key: "page:" + p.name, role: "frontend", files: ["src/pages/" + p.name + ".jsx"],
      system: REACT_RULES,
      user: ctx + "\n\nYOUR SLICE: output ONLY `src/pages/" + p.name + ".jsx` — the page at route `" + p.path + "` (" + (p.purpose || "") + ")" + (p.capabilities.length ? ", using capabilities: " + p.capabilities.join(", ") : "") + ". Import shared components (" + contract.sharedComponents.join(", ") + ") from `src/components/`. Wire any forms/data to the backend tables above via `/api/db/<slug>/…`. Match the palette + fonts exactly. Nothing else.",
    });
  }
  return tasks;
}

// mergeAgentOutputs(results) — combine the disjoint slice file sets. results: [{task, files:{path:src}}]. Slices are
// disjoint by design; if two agents emit the same path, the first wins and the collision is reported.
export function mergeAgentOutputs(results) {
  const files = {}, conflicts = [];
  for (const r of results) {
    for (const [path, src] of Object.entries(r.files || {})) {
      if (path in files) { conflicts.push({ path, from: r.task.key }); continue; }
      files[path] = src;
    }
  }
  return { files, conflicts };
}

// runMultiAgent(intent, deps, opts) — plan → contract → parallel agents → merge.
//   deps.generate({ role, key, model, system, user }) -> { text, usedIn, usedOut }   (the injected model call)
//   opts.picker: "auto" | "sonnet" | "opus"  (chatbox picker; routes each agent's model)
//   → { ok, files, contract, agents:[{key,role,model,paths,usedIn,usedOut}], tokens, parallelism, conflicts, error? }
export async function runMultiAgent(intent, deps = {}, opts = {}) {
  const out = { ok: false, files: {}, contract: null, agents: [], tokens: { in: 0, out: 0 }, parallelism: 0, conflicts: [] };
  try {
    const plan = planApp(intent);
    if (!plan.ok) { out.error = "plan failed: " + (plan.error || "unknown"); return out; }
    const familyId = pickStyleFamily(plan.spec.design_hints);
    const contract = buildContract(plan.spec, familyId);
    out.contract = contract;
    const tasks = agentPlan(contract);
    out.parallelism = tasks.length;

    // Resolve each agent's model up front (inspectable), then fan out — PARALLEL.
    for (const t of tasks) t.model = pickModel(t.role, { picker: opts.picker });
    const results = await Promise.all(tasks.map(async (task) => {
      const g = await deps.generate({ role: task.role, key: task.key, model: task.model, system: task.system, user: task.user });
      const files = parseGeneratedFiles((g && g.text) || "");
      out.tokens.in += (g && g.usedIn) || 0; out.tokens.out += (g && g.usedOut) || 0;
      out.agents.push({ key: task.key, role: task.role, model: task.model, paths: Object.keys(files), usedIn: (g && g.usedIn) || 0, usedOut: (g && g.usedOut) || 0 });
      return { task, files };
    }));

    const merged = mergeAgentOutputs(results);
    out.files = merged.files; out.conflicts = merged.conflicts;
    // The shell must have produced the app entry + router.
    out.ok = !!(out.files["index.html"] && out.files["src/App.jsx"]);
    if (!out.ok) out.error = "shell slice incomplete (missing index.html or src/App.jsx)";
  } catch (e) { out.error = String(e && e.message || e).slice(0, 200); }
  return out;
}
