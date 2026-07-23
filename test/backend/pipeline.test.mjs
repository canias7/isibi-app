// Pipeline orchestration tests — plan → design → prompt → generate → lint-gate(auto-fix) → build → vision repair.
// The linter is REAL; the side-effecting steps (generate/revise/build/render/critique) are mocked, so the whole
// flow is exercised deterministically offline.
import { makeTally } from "./harness.mjs";
import { runPipeline, composeBuildPrompt } from "../../builder/pipeline.mjs";
import { capabilityPrompt, CAPABILITIES } from "../../builder/capability-registry.mjs";
import { planApp } from "../../builder/app-planner.mjs";

const t = makeTally("Pipeline");

// A valid generated app (files map). Optionally point one API call at a bogus endpoint to trip the lint gate.
function app({ badRoute = false } = {}) {
  return {
    "index.html": '<!doctype html><html><head><title>Board</title><meta name="description" content="x"></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>',
    "src/index.css": "@tailwind base;@tailwind components;@tailwind utilities;",
    "src/main.jsx": "import { createRoot } from 'react-dom/client'\nimport { HashRouter } from 'react-router-dom'\nimport App from './App.jsx'\ncreateRoot(document.getElementById('root')).render(<HashRouter><App/></HashRouter>)",
    "src/App.jsx": "import { Routes, Route } from 'react-router-dom'\nimport Home from './pages/Home.jsx'\nexport default function App(){return <Routes><Route path='/' element={<Home/>}/></Routes>}",
    "src/pages/Home.jsx": "const API='/api/db/'+(location.pathname.split('/')[2]||'')\nexport default function Home(){ async function go(){ await fetch(API+'/" + (badRoute ? "made-up-endpoint" : "rows/tasks") + "') } return <button onClick={go}>go</button> }",
  };
}

// --- composeBuildPrompt is focused (plan + design + ONLY the needed capabilities) ---
const plan = planApp("a loyalty punch card app with member sign in").spec;
const prompt = composeBuildPrompt(plan, "studio-dark", { baseRules: "BASE_RULES_HERE" });
t.ok(/=== APP PLAN ===/.test(prompt) && /=== DESIGN SYSTEM ===/.test(prompt) && /=== BACKEND CAPABILITIES/.test(prompt), "prompt has plan + design + capabilities sections");
t.ok(/BASE_RULES_HERE/.test(prompt), "…includes the base rules");
t.ok(/punch-cards/.test(prompt), "…names the selected capability");
const fullCatalog = capabilityPrompt(CAPABILITIES.map((c) => c.id));
t.ok(prompt.length < fullCatalog.length / 3, `focused prompt is far smaller than the full catalog (${prompt.length} vs ${fullCatalog.length})`);

// --- Happy path: clean generate → lint ok → build ok → vision passes ---
let genCalls = 0, reviseCalls = 0;
let r = await runPipeline({
  intent: "a task board with member sign in",
  baseRules: "RULES",
  flags: { lint: true, build: true, vision: true },
  generate: async () => { genCalls++; return app(); },
  revise: async (f) => { reviseCalls++; return f; },
  build: async () => ({ ok: true }),
  render: async () => [{ route: "/", pngBase64: "x" }],
  critiqueOne: async () => ({ score: 92, issues: [] }),
});
t.eq(r.ok, true, "happy path succeeds");
t.eq(r.stage, "done", "…reaches the done stage");
t.eq(r.lint.ok, true, "…lint passed");
t.eq(r.build.ok, true, "…build passed");
t.eq(r.vision.passed, true, "…vision passed");
t.eq(reviseCalls, 0, "…no revise needed");

// --- Lint gate auto-fix: first gen has a fake API route → revise fixes it ---
genCalls = 0; reviseCalls = 0;
r = await runPipeline({
  intent: "a task board",
  flags: { lint: true },
  generate: async () => { genCalls++; return app({ badRoute: true }); },   // trips api-route
  revise: async () => { reviseCalls++; return app(); },                    // fixes it
});
t.eq(r.ok, true, "a bad route is caught and auto-fixed");
t.eq(reviseCalls, 1, "…revised once");
t.eq(r.lint.ok, true, "…lint passes after the fix");

// --- Lint gate fails when the revise can't fix it ---
r = await runPipeline({
  intent: "a task board",
  flags: { lint: true }, lintRounds: 2,
  generate: async () => app({ badRoute: true }),
  revise: async () => app({ badRoute: true }),   // never fixes
});
t.eq(r.ok, false, "an unfixable lint error fails the pipeline");
t.eq(r.stage, "lint", "…at the lint stage");
t.ok(/api-route/.test(r.error), "…reporting the failing rule");

// --- Build failure then recovery ---
let builds = 0;
r = await runPipeline({
  intent: "a task board",
  flags: { lint: true, build: true },
  generate: async () => app(),
  revise: async (f) => f,
  build: async () => (++builds === 1 ? { ok: false, error: "Unexpected token" } : { ok: true }),
});
t.eq(r.ok, true, "a compile error is revised and recovers");
t.eq(r.build.ok, true, "…build ok on retry");

// --- Vision repair: low score → revise → high score ---
let vround = 0;
r = await runPipeline({
  intent: "a task board",
  flags: { lint: true, vision: true }, visionRounds: 2, visionThreshold: 75,
  generate: async () => app(),
  revise: async (f) => f,
  render: async () => [{ route: "/", pngBase64: "x" }],
  critiqueOne: async () => (vround++ === 0 ? { score: 35, issues: [{ severity: "major", area: "layout", message: "cramped" }] } : { score: 85, issues: [] }),
});
t.eq(r.ok, true, "vision repair recovers a weak-looking app");
t.eq(r.vision.passed, true, "…vision passes after a repair");
t.eq(r.vision.rounds.length, 2, "…two vision rounds recorded");

// --- Planning failure short-circuits ---
r = await runPipeline({ intent: "", generate: async () => app() });
t.eq(r.ok, false, "an empty intent fails at planning");
t.eq(r.stage, "plan", "…at the plan stage");

// --- Generation producing nothing ---
r = await runPipeline({ intent: "a task board", generate: async () => ({}) });
t.eq(r.ok, false, "empty generation output fails");

t.done();
