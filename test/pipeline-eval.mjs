// PIPELINE_V2 evaluation harness — the "enable it in a controlled run, test 20–30 diverse prompts, then measure"
// step. For each prompt it runs plan → focused prompt → generate → lint (→ optional build → optional vision) and
// scores exactly the questions that matter: did it pick capabilities, do the backend routes exist, does it lint
// clean (structure/forms/imports), does it compile, does it look professional, did repair help, what did it cost.
//
// The orchestration is pure + injectable (generate/build/critiqueOne), so it is unit-testable at $0 (mock
// generate). Run for real with a live Anthropic generate via runEvalCLI() (needs ANTHROPIC_API_KEY) — that spends
// credits (one full generation per prompt).
import { planApp } from "../builder/app-planner.mjs";
import { pickStyleFamily } from "../builder/design-system.mjs";
import { composeBuildPrompt } from "../builder/pipeline.mjs";
import { lintGeneratedApp } from "../builder/app-linter.mjs";
import { parseGeneratedFiles, REACT_RULES, REACT_REVISE_RULES } from "../builder/react-gen.mjs";

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

// evaluatePrompt — run one prompt through the pipeline and score it.
//   deps: { generate(system, user) -> {files, usedIn, usedOut}, build?(files) -> {ok,error}, critiqueOne?(shot),
//           render?(files) -> shots, revise?(system,user) -> {...} }
export async function evaluatePrompt(prompt, deps = {}) {
  const r = { prompt, ok: false, capabilities: [], family: null, generated: false, lint: null, build: null, vision: null, repaired: null, tokens: { in: 0, out: 0 } };
  try {
    const plan = planApp(prompt);
    if (!plan.ok) { r.error = "plan failed"; return r; }
    r.capabilities = plan.spec.capabilities;
    r.family = pickStyleFamily(plan.spec.design_hints);
    const user = composeBuildPrompt(plan.spec, r.family, { baseRules: "Build this as a polished React app. Output ONLY the file blocks." });

    const g = await deps.generate(REACT_RULES, user);
    r.tokens.in += g.usedIn || 0; r.tokens.out += g.usedOut || 0;
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
      r.tokens.in += rv.usedIn || 0; r.tokens.out += rv.usedOut || 0;
      const rf = parseGeneratedFiles(rv.text || "");
      for (const [p, v] of Object.entries(rf)) if (p !== "isibi.schema.json") files[p] = v;
      const lint2 = lintGeneratedApp(files);
      r.repaired = { before: lint.errors.length, after: lint2.errors.length, fixed: lint.errors.length > 0 && lint2.errors.length === 0 };
      lint = lint2; r.lint.ok = lint.ok;
    }

    // Optional: compile.
    if (deps.build) { const b = await deps.build(files); r.build = { ok: !!b.ok, error: b.error ? String(b.error).slice(0, 200) : null }; }

    // Optional: vision (render + critique).
    if (deps.render && deps.critiqueOne) {
      const shots = await deps.render(files);
      const crits = []; for (const s of shots) crits.push(await deps.critiqueOne(s));
      r.vision = { minScore: crits.length ? Math.min(...crits.map((c) => c.score)) : null, issues: crits.reduce((n, c) => n + (c.issues ? c.issues.length : 0), 0) };
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
  const inRate = opts.inRate || 3 / 1e6, outRate = opts.outRate || 15 / 1e6;
  const cost = results.reduce((s, r) => s + r.tokens.in * inRate + r.tokens.out * outRate, 0);
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

// makeAnthropicGenerate — a real generate(system, user) that calls the Anthropic Messages API. Needs a key.
export function makeAnthropicGenerate(apiKey, model = "claude-sonnet-5", fetchImpl = fetch) {
  return async (system, user) => {
    const r = await fetchImpl("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: 16000, system, messages: [{ role: "user", content: user }] }),
    });
    if (!r.ok) throw new Error("anthropic " + r.status + ": " + (await r.text()).slice(0, 200));
    const j = await r.json();
    const text = (j.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
    return { text, usedIn: j.usage ? j.usage.input_tokens : 0, usedOut: j.usage ? j.usage.output_tokens : 0 };
  };
}

// CLI entry — run the live eval when executed directly with ANTHROPIC_API_KEY.
export async function runEvalCLI() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { console.error("ANTHROPIC_API_KEY not set — this runs live and spends credits; set it in CI."); process.exit(2); }
  const limit = parseInt(process.env.EVAL_LIMIT || "0", 10);
  const prompts = limit > 0 ? PROMPTS.slice(0, limit) : PROMPTS;
  const model = process.env.EVAL_MODEL || "claude-sonnet-5";
  const generate = makeAnthropicGenerate(key, model);
  const deps = { generate };
  if (process.env.EVAL_REPAIR === "1") deps.revise = generate;
  console.error(`Running ${prompts.length} prompts through PIPELINE_V2 (model ${model})…`);
  const out = await runEval(prompts, deps);
  console.log(formatScorecard(out));
  console.error("\nJSON:\n" + JSON.stringify(out.summary));
}

if (import.meta.url === `file://${process.argv[1]}`) runEvalCLI();
