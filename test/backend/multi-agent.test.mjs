// Multi-agent orchestrator tests — the whole fan-out runs against a MOCK generate ($0). Proves contract-first
// decomposition, parallel agents, per-agent model routing, and the disjoint-slice merge.
import { makeTally } from "./harness.mjs";
import { buildContract, contractText, agentPlan, mergeAgentOutputs, runMultiAgent } from "../../builder/multi-agent.mjs";
import { planApp } from "../../builder/app-planner.mjs";
import { pickStyleFamily } from "../../builder/design-system.mjs";
import { MODELS } from "../../builder/model-router.mjs";

const t = makeTally("Multi-agent");
const INTENT = "a booking app for a hair salon with member sign in and an admin calendar";

// A mock generate that returns the right file slice for each agent key (no model spent).
function makeGen(record) {
  const F = (path, body) => "===FILE: " + path + "===\n" + body + "\n";
  return async (task) => {
    if (record) record.push({ role: task.role, key: task.key, model: task.model });
    let text = "";
    if (task.key === "design") text = F("tailwind.config.js", "export default { theme: {} }") + F("src/index.css", "@tailwind base;@tailwind components;@tailwind utilities;");
    else if (task.key === "backend") text = F("isibi.schema.json", '{"tables":[{"name":"appointments","access":"user","columns":[]}]}');
    else if (task.key === "shell") text = F("index.html", "<!doctype html><div id=root></div>") + F("src/main.jsx", "mount") + F("src/App.jsx", "routes") + F("src/components/Nav.jsx", "nav");
    else if (task.key.startsWith("page:")) { const name = task.key.slice(5); text = F("src/pages/" + name + ".jsx", "export default function " + name + "(){return null}"); }
    return { text, usedIn: 100, usedOut: 500 };
  };
}

// --- buildContract assembles the shared spec ---
const plan = planApp(INTENT);
const contract = buildContract(plan.spec, pickStyleFamily(plan.spec.design_hints));
t.ok(contract.pages.length >= 2, "contract has the planned pages");
t.ok(contract.pages.some((p) => p.path === "/"), "…including home");
t.ok(contract.design.tokens && contract.design.tokens.accent, "…design tokens (palette) present");
t.ok(contract.sharedComponents.includes("Nav"), "…Nav is a shared component");

// --- contractText carries the fixed routes/palette/components every agent must match ---
const ctx = contractText(contract);
t.ok(/Routes .*\//.test(ctx) && /Shared components/.test(ctx) && /Palette/.test(ctx), "contract text has routes + palette + components");

// --- agentPlan produces design + backend + shell + one-per-page, scoped to disjoint files ---
const tasks = agentPlan(contract);
t.ok(tasks.some((x) => x.key === "design") && tasks.some((x) => x.key === "shell"), "has design + shell agents");
t.ok(tasks.some((x) => x.key === "backend"), "has a backend agent (tables exist)");
const pageTasks = tasks.filter((x) => x.key.startsWith("page:"));
t.eq(pageTasks.length, contract.pages.length, "one agent per page (the bulk, parallelized)");
t.ok(tasks.find((x) => x.key === "shell").files.includes("src/App.jsx"), "shell owns App.jsx");
t.ok(!tasks.find((x) => x.key === "shell").files.some((f) => f.startsWith("src/pages/")), "…shell does NOT own any page file (disjoint)");

// --- runMultiAgent (auto): fans out, routes models, merges into a full app ---
let calls = [];
let out = await runMultiAgent(INTENT, { generate: makeGen(calls) }, { picker: "auto" });
t.eq(out.ok, true, "produces a complete app");
t.ok(out.files["index.html"] && out.files["src/App.jsx"], "…shell files present");
t.ok(out.files["tailwind.config.js"] && out.files["isibi.schema.json"], "…design + backend slices merged in");
t.ok(Object.keys(out.files).some((f) => f.startsWith("src/pages/")), "…page slices merged in");
t.eq(out.parallelism, tasks.length, "ran one agent per task in parallel");
t.eq(out.conflicts.length, 0, "slices are disjoint (no merge conflicts)");

// --- model routing under Auto: frontend/design/backend → Sonnet ---
t.ok(calls.every((c) => c.model === MODELS.sonnet), "Auto routes every generative agent to Sonnet");
t.ok(out.agents.find((a) => a.key === "shell").model === MODELS.sonnet, "…shell agent reports its model");

// --- picker=opus pins every agent to Opus ---
calls = [];
out = await runMultiAgent(INTENT, { generate: makeGen(calls) }, { picker: "opus" });
t.ok(calls.every((c) => c.model === MODELS.opus), "picker=opus pins every agent to Opus");
t.eq(out.ok, true, "…and still produces a complete app");

// --- token accounting sums across agents ---
t.ok(out.tokens.out === calls.length * 500 && out.tokens.in === calls.length * 100, "tokens summed across all agents");

// --- mergeAgentOutputs flags a real collision ---
const m = mergeAgentOutputs([
  { task: { key: "a" }, files: { "x.js": "1", "y.js": "2" } },
  { task: { key: "b" }, files: { "x.js": "DUP" } },
]);
t.eq(m.conflicts.length, 1, "a duplicate path is a conflict");
t.eq(m.files["x.js"], "1", "…first writer wins");

// --- a missing shell fails cleanly ---
const bad = await runMultiAgent(INTENT, { generate: async (task) => (task.key.startsWith("page:") ? { text: "===FILE: src/pages/X.jsx===\nx", usedIn: 1, usedOut: 1 } : { text: "", usedIn: 1, usedOut: 1 }) }, { picker: "auto" });
t.eq(bad.ok, false, "no shell → not ok");
t.ok(/shell/.test(bad.error), "…with an explanatory error");

// --- an unplannable intent fails cleanly ---
const np = await runMultiAgent("zzz qqq", { generate: makeGen() });
t.eq(np.ok, false, "unplannable intent → not ok");

t.done();
