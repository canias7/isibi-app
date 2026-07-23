// PIPELINE_V2 eval-harness tests — the orchestration + scoring are exercised with a MOCK generate (no key, $0).
// The live run (makeAnthropicGenerate) is checked via an injected fetch. This proves the scorecard is correct
// before any real credits are spent.
import { makeTally } from "./harness.mjs";
import { evaluatePrompt, runEval, formatScorecard, makeAnthropicGenerate, makeContainerBuild, makeContainerRender, makeVisionCritique, PROMPTS } from "../../test/pipeline-eval.mjs";

const t = makeTally("Pipeline eval");

// A valid app (optionally with a fake API route to fail the route check).
function appText({ badRoute = false } = {}) {
  const call = badRoute ? "made-up-endpoint" : "rows/tasks";
  return `===FILE: index.html===
<!doctype html><html><head><title>App</title><meta name="description" content="x"></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>
===FILE: src/index.css===
@tailwind base;@tailwind components;@tailwind utilities;
===FILE: src/main.jsx===
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
createRoot(document.getElementById('root')).render(<HashRouter><App/></HashRouter>)
===FILE: src/App.jsx===
import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
export default function App(){return <Routes><Route path='/' element={<Home/>}/></Routes>}
===FILE: src/pages/Home.jsx===
const API='/api/db/'+(location.pathname.split('/')[2]||'')
export default function Home(){ async function go(){ await fetch(API+'/${call}') } return <button onClick={go}>go</button> }
`;
}

// --- evaluatePrompt: a clean generation scores well ---
let r = await evaluatePrompt("a task board", { generate: async () => ({ text: appText(), usedIn: 1000, usedOut: 2000 }) });
t.eq(r.generated, true, "a valid app is detected as generated");
t.eq(r.routesValid, true, "…its API route resolves to a real capability");
t.eq(r.lint.ok, true, "…lint clean");
t.ok(r.capabilities.length > 0, "…and it planned capabilities");
t.eq(r.tokens.in, 1000, "…tokens recorded");

// --- A fake API route is caught (routes not valid) ---
r = await evaluatePrompt("a task board", { generate: async () => ({ text: appText({ badRoute: true }), usedIn: 1, usedOut: 1 }) });
t.eq(r.routesValid, false, "a call to a nonexistent endpoint fails the route check");
t.eq(r.lint.ok, false, "…and lint is not clean");

// --- Repair: a revise that fixes the fake route ---
let calls = 0;
r = await evaluatePrompt("a task board", {
  generate: async () => ({ text: appText({ badRoute: true }), usedIn: 1, usedOut: 1 }),
  revise: async () => { calls++; return { text: appText(), usedIn: 1, usedOut: 1 }; },
});
t.ok(r.repaired && r.repaired.fixed, "the lint-gate repair fixes the fake route");
t.eq(calls, 1, "…one revise call");

// --- runEval aggregates across prompts ---
let flip = 0;
const out = await runEval([
  "a loyalty punch card app for a coffee shop with member sign in",
  "event ticketing with seat reservation",
  "a sales CRM with quotas commission and forecasting",
  "a booking app for a hair salon with member sign in and an admin calendar",
], { generate: async () => ({ text: appText({ badRoute: flip++ % 2 === 1 }), usedIn: 500, usedOut: 500 }) });
t.eq(out.results.length, 4, "evaluates every prompt");
t.eq(out.summary.generated_pct, 100, "all generated");
t.eq(out.summary.routes_valid_pct, 50, "half have valid routes (every other one is broken)");
t.eq(out.summary.avg_tokens_in, 500, "average input tokens aggregated");

// --- Build + vision metrics when those deps are supplied; the built dist flows into render ---
let renderGot = null, critiqueGot = null;
const out2 = await runEval(["a booking app for a hair salon with member sign in and an admin calendar"], {
  generate: async () => ({ text: appText(), usedIn: 1, usedOut: 1 }),
  build: async () => ({ ok: true, files: { "index.html": { t: "<html>built</html>" } } }),
  render: async (target, opts) => { renderGot = { target, opts }; return [{ pngBase64: "p" }]; },
  critiqueOne: async (shot, opts) => { critiqueGot = opts; return { score: 82, issues: [] }; },
});
t.eq(out2.summary.compiled_pct, 100, "compile metric surfaces when a builder is supplied");
t.eq(out2.summary.avg_design_score, 82, "design score surfaces when vision is supplied");
t.eq(renderGot.target["index.html"].t, "<html>built</html>", "render receives the BUILT dist, not the source");
t.ok(renderGot.opts.routes.includes("/"), "…and the routes to screenshot (home included)");
t.ok(/senior product designer/.test(critiqueGot.prompt), "critiqueOne gets the vision critique prompt");

// --- The three live-dep factories build the right requests ---
let bCap = null;
const bFetch = async (url, init) => { bCap = { url, init }; return { ok: true, json: async () => ({ ok: true, files: { "index.html": { t: "x" } } }) }; };
const bres = await makeContainerBuild("http://build:8080/", bFetch)({ "src/App.jsx": "x" });
t.eq(bCap.url, "http://build:8080/build", "container build POSTs /build");
t.eq(JSON.parse(bCap.init.body).files["src/App.jsx"], "x", "…with the source files");
t.eq(bres.files["index.html"].t, "x", "…and returns the dist");

let rCap = null;
const rFetch = async (url, init) => { rCap = { url, init }; return { ok: true, json: async () => ({ ok: true, shots: [{ route: "/", pngBase64: "z" }] }) }; };
const shots = await makeContainerRender("http://build:8080", rFetch)({ "index.html": { t: "x" } }, { routes: ["/", "/admin"] });
t.eq(rCap.url, "http://build:8080/critique", "container render POSTs /critique");
t.eq(JSON.parse(rCap.init.body).routes[1], "/admin", "…with the routes");
t.eq(shots[0].pngBase64, "z", "…and returns the shots");

let vCap = null;
const vFetch = async (url, init) => { vCap = { url, init }; return { ok: true, json: async () => ({ content: [{ type: "text", text: '{"score":90,"issues":[]}' }] }) }; };
const crit = await makeVisionCritique("sk-v", "claude-sonnet-5", vFetch)({ pngBase64: "img" }, { prompt: "judge this" });
t.eq(vCap.url, "https://api.anthropic.com/v1/messages", "vision critique calls the messages API");
const vbody = JSON.parse(vCap.init.body);
t.eq(vbody.messages[0].content[0].source.data, "img", "…with the screenshot");
t.eq(vbody.messages[0].content[1].text, "judge this", "…and the critique prompt");
t.eq(crit.score, 90, "…and parses the score");

// --- Scorecard renders ---
const card = formatScorecard(out);
t.ok(/PIPELINE_V2 evaluation/.test(card) && /est\. total cost/.test(card), "scorecard has a header + cost line");
t.ok(/Per-prompt/.test(card), "…and a per-prompt table");

// --- makeAnthropicGenerate builds the right request ---
let captured = null;
const fakeFetch = async (url, init) => { captured = { url, init }; return { ok: true, json: async () => ({ content: [{ type: "text", text: "hi" }], usage: { input_tokens: 7, cache_read_input_tokens: 40, output_tokens: 9 } }) }; };
const gen = makeAnthropicGenerate("sk-x", "claude-sonnet-5", fakeFetch);
const g = await gen("SYSTEM", "USER");
t.eq(captured.url, "https://api.anthropic.com/v1/messages", "calls the messages API");
t.eq(captured.init.headers["x-api-key"], "sk-x", "…with the key");
const body = JSON.parse(captured.init.body);
t.eq(body.system[0].text, "SYSTEM", "…system prompt passed as a content block");
t.eq(body.system[0].cache_control.type, "ephemeral", "…and marked for prompt caching (cheap input on repeat calls)");
t.eq(body.messages[0].content, "USER", "…user prompt passed");
t.eq(g.usedIn, 7, "…and it reports fresh input tokens");
t.eq(g.usedInCached, 40, "…and cache-read tokens separately (priced ~1/10 in the scorecard)");

// --- The prompt set is diverse + sizable ---
t.ok(PROMPTS.length >= 20, `the prompt set has 20+ archetypes (${PROMPTS.length})`);
t.eq(new Set(PROMPTS).size, PROMPTS.length, "…all distinct");

t.done();
