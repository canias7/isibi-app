// PIPELINE_V2 evaluation harness — the "enable it in a controlled run, test 20–30 diverse prompts, then measure"
// step. For each prompt it runs plan → focused prompt → generate → lint (→ optional build → optional vision) and
// scores exactly the questions that matter: did it pick capabilities, do the backend routes exist, does it lint
// clean (structure/forms/imports), does it compile, does it look professional, did repair help, what did it cost.
//
// The orchestration is pure + injectable (generate/build/critiqueOne), so it is unit-testable at $0 (mock
// generate). Run for real with a live Anthropic generate via runEvalCLI() (needs ANTHROPIC_API_KEY) — that spends
// credits (one full generation per prompt).
import { planApp } from "../builder/app-planner.mjs";
import { getCapability } from "../builder/capability-registry.mjs";
import { pickStyleFamily } from "../builder/design-system.mjs";
import { composeBuildPrompt } from "../builder/pipeline.mjs";
import { lintGeneratedApp } from "../builder/app-linter.mjs";
import { parseGeneratedFiles, REACT_RULES, REACT_REVISE_RULES } from "../builder/react-gen.mjs";
import { buildCritiquePrompt, requestCritique } from "../builder/vision-critique.mjs";

// evalRoutes — the routes to screenshot for a design score: the home page (the design signal) plus up to two
// inner pages, skipping bare auth screens. HashRouter, so all serve index.html and the render targets url#route.
function evalRoutes(spec) {
  const inner = (spec.pages || []).filter((p) => p.path !== "/" && p.path !== "/signin").slice(0, 2).map((p) => p.path);
  return ["/", ...inner];
}

// ── The diverse prompt set (ChatGPT's list + more; ~25 different app archetypes). ──
export const PROMPTS = [
  "a booking app for a hair salon with member sign in and an admin calendar",
  "an e-commerce store for handmade candles with a cart and checkout",
  "a CRM to track sales leads, deals, and follow-ups for a small team",
  "a restaurant ordering site with a menu, cart, and order tracking",
  "a social platform where members post updates, follow each other, and comment",
  "a property management dashboard for tracking units, tenants, and rent",
  "a church website with events, a sermon library, and a donation page",
  "a marketplace where sellers list items and buyers browse and message",
  "an internal ops dashboard with KPIs, charts, and a task list",
  "a subscription SaaS landing + a member dashboard with usage metrics",
  "an event ticketing site with seat selection and QR check-in",
  "a fitness studio site with class schedules and member bookings",
  "a real-estate listings site with search, filters, and saved favorites",
  "a job board where companies post jobs and candidates apply",
  "a recipe sharing community with ratings and saved cookbooks",
  "an invoicing tool for freelancers with clients, invoices, and payments",
  "a customer help desk with tickets, replies, and a knowledge base",
  "an inventory tracker with stock levels, low-stock alerts, and suppliers",
  "a nonprofit donation platform with campaigns and donor tracking",
  "a podcast website with episodes, show notes, and a subscribe form",
  "a freelancer portfolio with projects, testimonials, and a contact form",
  "an online course platform with lessons, progress, and quizzes",
  "an appointment scheduler for a dental clinic with reminders",
  "a coffee-shop loyalty program with punch cards and rewards",
  "a community forum with categories, threads, and member profiles",
];

// capsForBudget — cap-aware planning: given the output-token budget, how many feature capabilities (≈ pages) can
// the app include and still FINISH under the cap instead of truncating? Conservative on purpose — finishing a small
// complete app beats a big truncated one. Model from the dumps: ~14k tokens of fixed overhead (shell + shared
// components + Home/SignIn/Admin + config), then ~4k per feature page. So 25k → 2 feature pages (~5 total), which
// matches the course app that compiled at ~22k. Always at least 1 so it's still a real app.
export function capsForBudget(maxOut) {
  const OVERHEAD = 14000, PER_CAP = 4000;
  return Math.max(1, Math.floor((maxOut - OVERHEAD) / PER_CAP));
}

// capsForBudgetAdaptive — TRUE per-app sizing. Instead of a flat per-page cost, it estimates EACH candidate
// capability's page weight from its real feature surface (route count ≈ how much UI + fetch logic the page needs:
// a 6-route CRUD+board page is heavy; a 2-route read page is light), then packs capabilities in relevance order
// until the output budget is spent. So a heavy app gets fewer pages, a light app more — it "depends on the app."
// Still an ESTIMATE (the perfectly-accurate version measures tokens WHILE generating — the chunked loop); this is
// the best pre-generation guess. Conservative constants so it under-packs and finishes rather than truncates.
export function capsForBudgetAdaptive(intent, maxOut, planFn = planApp, capFn = getCapability) {
  const full = planFn(intent, { capabilityLimit: 24 });
  if (!full.ok || !full.spec) return 1;
  // Calibrated to ground truth: the course app compiled at 22,396 output tokens = shell + 2 heavy pages (5- and
  // 6-route). Back-solving with OVERHEAD 11000 → a ~5.5-route page ≈ 5700 tokens, i.e. BASE ~1800 + ~700/route.
  // Slightly conservative (over-estimates a touch) so it under-packs and FINISHES rather than truncating.
  const OVERHEAD = 11000; // shell + shared components + Home/SignIn/Admin baseline + config, in tokens
  const BASE_PAGE = 1800;  // a page's floor: layout, header, empty/loading states
  const PER_ROUTE = 700;   // each endpoint the page drives ≈ a fetch + the UI (form/row/action) around it
  let budget = maxOut - OVERHEAD, n = 0;
  for (const id of full.spec.capabilities) {
    const c = capFn(id);
    const routes = (c && Array.isArray(c.routes) && c.routes.length) || 3;
    const cost = BASE_PAGE + routes * PER_ROUTE;
    if (budget - cost < 0) break;
    budget -= cost; n++;
  }
  return Math.max(1, n);
}

// evaluatePrompt — run one prompt through the pipeline and score it.
//   deps: { generate(system, user) -> {files, usedIn, usedOut}, build?(files) -> {ok,error}, critiqueOne?(shot),
//           render?(files) -> shots, revise?(system,user) -> {...} }
export async function evaluatePrompt(prompt, deps = {}) {
  const r = { prompt, ok: false, capabilities: [], family: null, generated: false, lint: null, build: null, vision: null, repaired: null, tokens: { in: 0, inCached: 0, out: 0 } };
  try {
    // Cap-aware scope so the build fits under the token cap and finishes instead of truncating. deps.capAware turns
    // on TRUE per-app sizing (capsForBudgetAdaptive weighs each app's own pages); deps.capabilityLimit is a manual
    // override. Either way the trimmed spec is a COMPLETE, self-contained app (planApp keeps pages/caps consistent).
    let capLimit = deps.capabilityLimit;
    if (deps.capAware) capLimit = capsForBudgetAdaptive(prompt, deps.maxOut || 25000);
    const plan = planApp(prompt, capLimit != null ? { capabilityLimit: capLimit } : {});
    if (!plan.ok) { r.error = "plan failed"; return r; }
    r.pageCount = plan.spec.pages.length;
    r.capLimit = capLimit != null ? capLimit : null;
    r.capabilities = plan.spec.capabilities;
    r.family = pickStyleFamily(plan.spec.design_hints);
    const user = composeBuildPrompt(plan.spec, r.family, { baseRules: "Build this as a polished React app. Output ONLY the file blocks." });

    const g = await deps.generate(REACT_RULES, user);
    r.tokens.in += g.usedIn || 0; r.tokens.inCached += g.usedInCached || 0; r.tokens.out += g.usedOut || 0;
    let files = parseGeneratedFiles(g.text || "");
    r.generated = !!(files["index.html"] && files["src/App.jsx"]);

    let lint = lintGeneratedApp(files);
    r.lint = { ok: lint.ok, errors: lint.errors.map((e) => e.rule), warnings: lint.warnings.map((w) => w.rule) };
    r.routesValid = !lint.errors.some((e) => e.rule === "api-route");
    r.formsWired = !lint.warnings.some((w) => w.rule === "form");

    // Optional: one lint-gate repair when there are hard errors.
    if (!lint.ok && deps.revise) {
      const instr = "Fix these structural errors, returning ONLY corrected files:\n- " + lint.errors.map((e) => `[${e.rule}] ${e.msg}`).join("\n- ");
      const rv = await deps.revise(REACT_REVISE_RULES, instr + "\n\n" + Object.entries(files).map(([p, s]) => "===FILE: " + p + "===\n" + s).join("\n\n").slice(0, 90000));
      r.tokens.in += rv.usedIn || 0; r.tokens.inCached += rv.usedInCached || 0; r.tokens.out += rv.usedOut || 0;
      const rf = parseGeneratedFiles(rv.text || "");
      for (const [p, v] of Object.entries(rf)) if (p !== "isibi.schema.json") files[p] = v;
      const lint2 = lintGeneratedApp(files);
      r.repaired = { before: lint.errors.length, after: lint2.errors.length, fixed: lint.errors.length > 0 && lint2.errors.length === 0 };
      lint = lint2; r.lint.ok = lint.ok;
    }

    // Optional: compile. Capture the built dist so vision renders the REAL built output (exactly like production).
    let dist = null;
    if (deps.build) { const b = await deps.build(files); r.build = { ok: !!b.ok, error: b.error ? String(b.error).slice(0, 200) : null }; if (b.ok && b.files) dist = b.files; }

    // Optional: vision (render + critique) — screenshots the built dist (falls back to source if no build ran),
    // then asks the vision model to score the RENDERED page (layout/contrast/polish — things source can't show).
    if (deps.render && deps.critiqueOne) {
      const routes = evalRoutes(plan.spec);
      const critiquePrompt = buildCritiquePrompt({ goal: prompt, family: r.family });
      const shots = (await deps.render(dist || files, { routes })) || [];
      const crits = []; for (const s of shots) crits.push(await deps.critiqueOne(s, { prompt: critiquePrompt }));
      r.vision = { minScore: crits.length ? Math.min(...crits.map((c) => c.score)) : null, avgScore: crits.length ? Math.round(crits.reduce((s, c) => s + (c.score || 0), 0) / crits.length) : null, issues: crits.reduce((n, c) => n + (c.issues ? c.issues.length : 0), 0), routes: routes.length, shots: shots.length };
    }

    r.ok = r.generated && r.lint.ok && (!r.build || r.build.ok);
  } catch (e) { r.error = String(e && e.message || e).slice(0, 200); }
  return r;
}

// runEval — evaluate every prompt and aggregate.
export async function runEval(prompts, deps = {}) {
  const results = [];
  for (const p of prompts) results.push(await evaluatePrompt(p, deps));
  const n = results.length || 1;
  const pct = (f) => Math.round((results.filter(f).length / n) * 100);
  const withVision = results.filter((r) => r.vision && r.vision.minScore != null);
  const withBuild = results.filter((r) => r.build);
  const repairs = results.filter((r) => r.repaired);
  const summary = {
    prompts: results.length,
    chose_capabilities_pct: pct((r) => r.capabilities.length > 0),
    generated_pct: pct((r) => r.generated),
    routes_valid_pct: pct((r) => r.routesValid),
    forms_wired_pct: pct((r) => r.formsWired),
    lint_clean_pct: pct((r) => r.lint && r.lint.ok),
    compiled_pct: withBuild.length ? Math.round((withBuild.filter((r) => r.build.ok).length / withBuild.length) * 100) : null,
    avg_design_score: withVision.length ? Math.round(withVision.reduce((s, r) => s + r.vision.minScore, 0) / withVision.length) : null,
    repair_success_pct: repairs.length ? Math.round((repairs.filter((r) => r.repaired.fixed).length / repairs.length) * 100) : null,
    avg_tokens_in: Math.round(results.reduce((s, r) => s + r.tokens.in, 0) / n),
    avg_tokens_cached: Math.round(results.reduce((s, r) => s + (r.tokens.inCached || 0), 0) / n),
    avg_tokens_out: Math.round(results.reduce((s, r) => s + r.tokens.out, 0) / n),
  };
  return { results, summary };
}

// formatScorecard — a readable markdown report.
export function formatScorecard({ results, summary }, opts = {}) {
  const L = [];
  L.push("# PIPELINE_V2 evaluation\n");
  L.push("| metric | value |\n| --- | --- |");
  L.push(`| prompts | ${summary.prompts} |`);
  L.push(`| chose capabilities | ${summary.chose_capabilities_pct}% |`);
  L.push(`| generated a valid app | ${summary.generated_pct}% |`);
  L.push(`| backend routes all real | ${summary.routes_valid_pct}% |`);
  L.push(`| forms wired to a write | ${summary.forms_wired_pct}% |`);
  L.push(`| lint clean | ${summary.lint_clean_pct}% |`);
  if (summary.compiled_pct != null) L.push(`| compiled | ${summary.compiled_pct}% |`);
  if (summary.avg_design_score != null) L.push(`| avg design score | ${summary.avg_design_score}/100 |`);
  if (summary.repair_success_pct != null) L.push(`| repair success | ${summary.repair_success_pct}% |`);
  // Sonnet-5 rates: fresh input $3/M, cache-read input $0.30/M (~1/10), output $15/M.
  const inRate = opts.inRate || 3 / 1e6, cacheRate = opts.cacheRate || 0.3 / 1e6, outRate = opts.outRate || 15 / 1e6;
  const cost = results.reduce((s, r) => s + r.tokens.in * inRate + (r.tokens.inCached || 0) * cacheRate + r.tokens.out * outRate, 0);
  L.push(`| est. total cost | $${cost.toFixed(2)} (${results.length} generations) |`);
  L.push("\n## Per-prompt\n");
  L.push("| prompt | caps | gen | routes | lint | " + (summary.compiled_pct != null ? "build | " : "") + (summary.avg_design_score != null ? "design | " : "") + "|");
  L.push("| --- | --- | --- | --- | --- | " + (summary.compiled_pct != null ? "--- | " : "") + (summary.avg_design_score != null ? "--- | " : "") + "");
  for (const r of results) {
    const yn = (b) => (b ? "✅" : "❌");
    L.push(`| ${r.prompt.slice(0, 40)} | ${r.capabilities.slice(0, 3).join(",") || "—"} | ${yn(r.generated)} | ${yn(r.routesValid)} | ${yn(r.lint && r.lint.ok)} | ` + (summary.compiled_pct != null ? `${r.build ? yn(r.build.ok) : "—"} | ` : "") + (summary.avg_design_score != null ? `${r.vision && r.vision.minScore != null ? r.vision.minScore : "—"} | ` : "") + "|");
  }
  return L.join("\n");
}

// formatCompare — a side-by-side A/B of two (or more) runs at different max_tokens caps. The headline question
// is completeness: with NO timeout, does a bigger cap actually reduce truncation (→ more apps generate + compile)?
export function formatCompare(runs, opts = {}) {
  // runs: [{ label, out }] where out = { results, summary }.
  const inRate = opts.inRate || 3 / 1e6, cacheRate = opts.cacheRate || 0.3 / 1e6, outRate = opts.outRate || 15 / 1e6;
  const costOf = (results) => results.reduce((s, r) => s + r.tokens.in * inRate + (r.tokens.inCached || 0) * cacheRate + r.tokens.out * outRate, 0);
  const rows = [
    ["generated a valid app", (s) => s.generated_pct + "%"],
    ["backend routes all real", (s) => s.routes_valid_pct + "%"],
    ["forms wired to a write", (s) => s.forms_wired_pct + "%"],
    ["lint clean", (s) => s.lint_clean_pct + "%"],
    ["compiled", (s) => (s.compiled_pct != null ? s.compiled_pct + "%" : "—")],
    ["avg design score", (s) => (s.avg_design_score != null ? s.avg_design_score + "/100" : "—")],
    ["avg tokens out", (s) => String(s.avg_tokens_out)],
  ];
  const L = [];
  L.push("# max_tokens A/B — no timeout (non-streaming)\n");
  L.push("| metric | " + runs.map((r) => r.label).join(" | ") + " |");
  L.push("| --- | " + runs.map(() => "---").join(" | ") + " |");
  for (const [name, fn] of rows) L.push(`| ${name} | ` + runs.map((r) => fn(r.out.summary)).join(" | ") + " |");
  L.push(`| est. cost | ` + runs.map((r) => "$" + costOf(r.out.results).toFixed(2)).join(" | ") + " |");
  return L.join("\n");
}

// makeAnthropicGenerate — a real generate(system, user) that calls the Anthropic Messages API. Needs a key.
// The system prompt (the ~100k-token BACKEND_RULES) is marked cache_control:ephemeral, exactly like production —
// so after the first prompt every subsequent call is a cache HIT (~10x cheaper input, 5-min TTL, sequential calls
// land inside it). max_tokens 16000 mirrors production (worker.js GB_MAX_OUT/RB_MAX_OUT) so completeness numbers
// are the real thing. usedIn counts fresh input tokens only (cache reads are billed at ~1/10 and reported apart),
// so the est. cost reflects post-cache spend.
export function makeAnthropicGenerate(apiKey, model = "claude-sonnet-5", fetchImpl = fetch, maxOut = 32000, stream = false) {
  return async (system, user) => {
    const body = {
      model, max_tokens: maxOut, stream,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
    };
    // Streaming path: needed for slower/bigger generations (e.g. Opus) — non-streaming has a hard ~10-min ceiling,
    // so a long single-shot would be killed and look like a model failure. Streaming keeps the connection alive.
    // 15-min AbortSignal is a safety net, not the effective cap (deltas keep flowing well under it).
    if (stream) {
      const r = await fetchImpl("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify(body), signal: AbortSignal.timeout(900000),
      });
      if (!r.ok) throw new Error("anthropic " + r.status + ": " + (await r.text()).slice(0, 200));
      const reader = r.body.getReader(); const dec = new TextDecoder();
      let buf = "", text = "", usedIn = 0, usedInCached = 0, usedOut = 0, stopReason = null; const blockTypes = [];
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
          if (!line.startsWith("data:")) continue;
          const js = line.slice(5).trim(); if (!js || js === "[DONE]") continue;
          let ev; try { ev = JSON.parse(js); } catch { continue; }
          if (ev.type === "content_block_delta" && ev.delta && ev.delta.type === "text_delta") text += ev.delta.text;
          else if (ev.type === "content_block_start" && ev.content_block) blockTypes.push(ev.content_block.type);
          else if (ev.type === "message_start" && ev.message && ev.message.usage) { usedIn = (ev.message.usage.input_tokens || 0) + (ev.message.usage.cache_creation_input_tokens || 0); usedInCached = ev.message.usage.cache_read_input_tokens || 0; }
          else if (ev.type === "message_delta") { if (ev.usage) usedOut = ev.usage.output_tokens || usedOut; if (ev.delta && ev.delta.stop_reason) stopReason = ev.delta.stop_reason; }
        }
      }
      // DIAG: same as the non-stream path — on empty text, show stop_reason + which block types actually arrived.
      if (!text) console.error(`[DIAG stream] stop_reason=${stopReason} out=${usedOut} blocks=[${blockTypes.join(",")}]`);
      return { text, usedIn, usedInCached, usedOut };
    }
    const r = await fetchImpl("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error("anthropic " + r.status + ": " + (await r.text()).slice(0, 200));
    const j = await r.json();
    const text = (j.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
    const u = j.usage || {};
    // DIAG: when text comes back empty despite spending output tokens, show WHY — stop_reason + the content block
    // types (text vs thinking vs tool_use) + a raw peek. Tells us if the budget went to thinking, a refusal, or a
    // parse miss, instead of guessing.
    if (!text) console.error(`[DIAG non-stream] stop_reason=${j.stop_reason} out=${u.output_tokens} blocks=[${(j.content || []).map((c) => c.type).join(",")}] first=${JSON.stringify((j.content || [])[0] || null).slice(0, 240)}`);
    // Fresh (uncached) input + the cheap cache-read tokens, kept apart so the scorecard can price them differently.
    return { text, usedIn: (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0), usedInCached: u.cache_read_input_tokens || 0, usedOut: u.output_tokens || 0 };
  };
}

// makeContainerBuild(baseUrl) — a build(files) that POSTs the generated source to the build-server /build endpoint
// (real `vite build`); returns { ok, error, files: dist }. Exactly the call the Worker makes in production.
export function makeContainerBuild(baseUrl, fetchImpl = fetch) {
  return async (files) => {
    try {
      const r = await fetchImpl(baseUrl.replace(/\/$/, "") + "/build", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ files }) });
      const j = await r.json();
      return { ok: !!j.ok, error: j.error || null, files: j.files || null };
    } catch (e) { return { ok: false, error: String(e && e.message || e).slice(0, 300), files: null }; }
  };
}

// makeContainerRender(baseUrl) — a render(dist, {routes}) that POSTs the built dist to /critique and returns the
// screenshots [{route, pngBase64}]. Needs the build server to have Playwright/Chromium (best-effort in the image).
export function makeContainerRender(baseUrl, fetchImpl = fetch) {
  return async (dist, { routes } = {}) => {
    try {
      const r = await fetchImpl(baseUrl.replace(/\/$/, "") + "/critique", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ dist, routes: routes || ["/"] }) });
      const j = await r.json();
      return j.ok && Array.isArray(j.shots) ? j.shots : [];
    } catch { return []; }
  };
}

// makeVisionCritique(apiKey) — a critiqueOne(shot, {prompt}) that runs the vision model on one screenshot.
export function makeVisionCritique(apiKey, model = "claude-sonnet-5", fetchImpl = fetch) {
  return async (shot, { prompt } = {}) => requestCritique({ apiKey, model, pngBase64: shot.pngBase64, prompt, fetchImpl });
}

// CLI entry — run the live eval when executed directly with ANTHROPIC_API_KEY.
//   EVAL_LIMIT (0=all)  EVAL_MODEL  EVAL_REPAIR=1  EVAL_BUILD=1 (compile via BUILD_URL)  EVAL_VISION=1 (render+score)
//   BUILD_URL (default http://127.0.0.1:8080) — the build-server the workflow starts.
export async function runEvalCLI() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { console.error("ANTHROPIC_API_KEY not set — this runs live and spends credits; set it in CI."); process.exit(2); }
  const limit = parseInt(process.env.EVAL_LIMIT || "0", 10);
  // EVAL_ONLY: comma-separated 0-based indices to hand-pick specific prompts (overrides EVAL_LIMIT). Lets a small
  // run target the heavy, discriminating apps instead of just the first N. EVAL_LIMIT still takes the first N.
  const only = (process.env.EVAL_ONLY || "").split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isInteger(n) && n >= 0 && n < PROMPTS.length);
  const prompts = only.length ? only.map((i) => PROMPTS[i]) : (limit > 0 ? PROMPTS.slice(0, limit) : PROMPTS);
  const model = process.env.EVAL_MODEL || "claude-sonnet-5";
  const buildUrl = process.env.BUILD_URL || "http://127.0.0.1:8080";
  const stream = process.env.EVAL_STREAM === "1";
  // EVAL_DUMP: wrap generate to print, per prompt, the raw output shape — parsed file names+sizes, a truncation
  // heuristic (unclosed final block / missing App.jsx), and token usage — so we SEE whether a failure is truncation
  // vs finished-but-broken vs a parser miss, instead of trusting the pass/fail flags alone.
  const dump = process.env.EVAL_DUMP === "1";
  let dumpN = 0;
  const withDump = (gen, maxOut) => async (system, user) => {
    const g = await gen(system, user);
    if (dump) {
      const files = parseGeneratedFiles(g.text || "");
      const names = Object.keys(files);
      const sizes = names.map((n) => `${n}(${files[n].length}c)`).join(", ") || "NONE";
      const raw = (g.text || "").trim();
      // Real signals, reported separately so we can tell the failure modes apart:
      //  hitCap  → output pinned at the token ceiling = truncated at the cap
      //  hasApp  → the essential src/App.jsx block parsed out
      //  tailOpen→ the response ends mid-expression (also a truncation tell, independent of the cap)
      const hitCap = g.usedOut >= Math.floor(maxOut * 0.98);
      const hasApp = names.includes("src/App.jsx");
      const tailOpen = /[{([,=+\-*/<>&|:]$/.test(raw);
      const label = (prompts[dumpN] || "?").slice(0, 46);
      console.error(`\n[DUMP ${dumpN + 1}] "${label}"\n  out=${g.usedOut}/${maxOut}${hitCap ? " HIT-CAP" : ""} in=${g.usedIn} cached=${g.usedInCached} | hasApp=${hasApp} tailOpen=${tailOpen} | files=[${sizes}]\n  tail: …${raw.slice(-140).replace(/\n/g, "⏎")}`);
      dumpN++;
    }
    return g;
  };
  // Build a deps bundle at a given max_tokens cap. generate/revise both honor the cap; build/vision are shared.
  const depsFor = (maxOut) => {
    const generate = withDump(makeAnthropicGenerate(key, model, fetch, maxOut, stream), maxOut);
    const deps = { generate };
    // EVAL_CAP_AWARE: the planner reads the output budget and plans only as many pages as will FINISH under it
    // (via capsForBudget). EVAL_MAX_CAPS is the manual override. Either way, the trimmed spec is a COMPLETE app —
    // fewer pages, but self-contained (the planner keeps pages/capabilities consistent), so it finishes, not truncates.
    if (process.env.EVAL_CAP_AWARE === "1") {
      deps.capAware = true; deps.maxOut = maxOut; // true per-app sizing, computed per prompt in evaluatePrompt
      console.error(`[CAP-AWARE] maxOut=${maxOut} → adaptive per-app page sizing (weighs each app's own pages)`);
    } else if (process.env.EVAL_MAX_CAPS) {
      deps.capabilityLimit = parseInt(process.env.EVAL_MAX_CAPS, 10);
    }
    if (process.env.EVAL_REPAIR === "1") deps.revise = generate;
    if (process.env.EVAL_BUILD === "1") deps.build = makeContainerBuild(buildUrl);
    if (process.env.EVAL_VISION === "1") {
      if (process.env.EVAL_BUILD !== "1") deps.build = makeContainerBuild(buildUrl);
      deps.render = makeContainerRender(buildUrl);
      deps.critiqueOne = makeVisionCritique(key, model);
    }
    return deps;
  };
  const extras = [process.env.EVAL_REPAIR === "1" && "repair", process.env.EVAL_BUILD === "1" && "build", process.env.EVAL_VISION === "1" && "vision"].filter(Boolean).join("+") || "none";

  // A/B compare mode: run the SAME prompts at two caps (default 16000 vs 32000), NO timeout, and print a side-by-side.
  // The question it answers: with the timeout removed, does more room actually reduce truncation (more gen/compile)?
  if (process.env.EVAL_COMPARE === "1") {
    const caps = (process.env.EVAL_CAPS || "16000,32000").split(",").map((s) => parseInt(s.trim(), 10)).filter(Boolean);
    const runs = [];
    for (const cap of caps) {
      console.error(`\n=== Running ${prompts.length} prompts @ max_tokens ${cap} (model ${model}; extras: ${extras}) ===`);
      const out = await runEval(prompts, depsFor(cap));
      runs.push({ label: `${(cap / 1000)}k`, out });
      console.log(`\n<!-- scorecard @ ${cap} -->\n` + formatScorecard(out));
    }
    console.log("\n" + formatCompare(runs));
    console.error("\nJSON:\n" + JSON.stringify(runs.map((r) => ({ cap: r.label, ...r.out.summary }))));
    return;
  }

  const maxOut = parseInt(process.env.EVAL_MAX_OUT || "32000", 10);
  console.error(`Running ${prompts.length} prompts through PIPELINE_V2 (model ${model}; max_tokens ${maxOut}; extras: ${extras})…`);
  const out = await runEval(prompts, depsFor(maxOut));
  console.log(formatScorecard(out));
  console.error("\nJSON:\n" + JSON.stringify(out.summary));
}

if (import.meta.url === `file://${process.argv[1]}`) runEvalCLI();
