// full-pipeline.mjs — runs the WHOLE build pipeline (all ~17 stages) against ONE total output budget. Every stage
// that spends output tokens draws from a shared LEDGER, so Σ of every model call ≤ cap. Stages that cost nothing
// (gates, compile, images, publish, provision) still appear in the trace so the run is auditable end to end.
//
// The six token-spending stages, in pipeline order:
//   generate      (chunked: shell + page groups + admin)   ← the bulk
//   schema-fix    SCHEMA_REPAIR_RULES   — backend wired but isibi.schema.json missing
//   wiring-repair WIRING_REPAIR_RULES   — backend calls missing the site slug
//   lint-repair   REACT_REVISE_RULES    — hard structural lint errors
//   fix-loop      REACT_FIX_RULES       — compile failed (up to opts.fixAttempts)
//   vision-polish REACT_REVISE_RULES    — rendered design score below threshold
//
// The LEDGER is the point: each call's max_tokens = min(its reserve, whatever budget is actually left). When the
// budget runs dry, later stages are SKIPPED rather than silently overspending — so the cap is a real ceiling for
// the whole build, not just for generation.
//
// Pure + injectable: deps.generate(system, user, maxTokens), deps.build(files), optional deps.render/critiqueOne.

import { planApp } from "./app-planner.mjs";
import { pickStyleFamily } from "./design-system.mjs";
import { buildPlan } from "./build-plan.mjs";
import { scaffoldDbTypes } from "./scaffold.mjs";
import { matchStarter, getStarter, starterFiles } from "./starters.mjs";
import { applyBundle } from "./capability-bundles.mjs";
import { runChunkedBuild } from "./chunked-build.mjs";
import { lintGeneratedApp } from "./app-linter.mjs";
import { parseGeneratedFiles, SCHEMA_FIRST_RULES, SCHEMA_REPAIR_RULES, WIRING_REPAIR_RULES, REACT_FIX_RULES, REACT_REVISE_RULES } from "./react-gen.mjs";
import { buildCritiquePrompt } from "./vision-critique.mjs";

const dumpFiles = (files, limit = 90000) =>
  Object.entries(files).map(([p, s]) => "===FILE: " + p + "===\n" + s).join("\n\n").slice(0, limit);

// usesBackend — does the app call the per-site API? (drives the schema-fix stage, mirroring worker.js)
//
// `useResource('bookings')` / `useRecord('bookings', id)` are now the normal way a page reads a table, and they
// build the `/rows/<table>` path INSIDE the hook — so a detector that only looks for that literal in page source
// sees nothing and skips schema-fix, shipping an app that talks to a database it never declared.
const usesBackend = (files) =>
  Object.values(files).some((src) => /\/auth\/(signup|login)\b/.test(String(src))
    || /\/rows\/[a-z_][a-z0-9_]*/i.test(String(src))
    || /\buse(Resource|Record)\s*\(/.test(String(src)));

export async function runFullPipeline(brief, cap, deps, opts = {}) {
  if (!deps || typeof deps.generate !== "function") return { ok: false, error: "deps.generate required" };
  const trace = [];
  const t = (stage, info) => { const rec = { n: trace.length + 1, stage, ...info }; trace.push(rec); if (opts.onStage) opts.onStage(rec); return rec; };

  // ── The ledger: one shared budget for the entire build.
  let spent = 0;
  const remaining = () => Math.max(0, cap - spent);
  const charge = (n) => { spent += n || 0; };
  // call(stage, system, user, reserve) — spend at most min(reserve, remaining). Skips (and records) when dry.
  const call = async (stage, system, user, reserve) => {
    const budget = Math.min(reserve, remaining());
    if (budget < 400) { t(stage, { skipped: "budget exhausted", budget: 0, out: 0, remaining: remaining() }); return null; }
    const g = await deps.generate(system, user, budget);
    charge(g.usedOut || 0);
    const files = parseGeneratedFiles(g.text || "");
    t(stage, { budget, out: g.usedOut || 0, files: Object.keys(files), remaining: remaining() });
    return { g, files };
  };
  const graft = (files, incoming, { keepSchema = false } = {}) => {
    for (const [p, v] of Object.entries(incoming)) { if (!keepSchema && p === "isibi.schema.json") continue; files[p] = v; }
  };

  // ── 1-4. Pre-flight gates (no tokens; recorded so the trace covers the real pipeline).
  t("auth", { cost: 0, note: "verified (harness: bypassed)" });
  t("config-check", { cost: 0 });
  t("parse-request", { cost: 0, brief: String(brief).slice(0, 60) });
  t("credit-gate", { cost: 0, cap });

  // ── 5. Plan (deterministic, ~free).
  const plan = planApp(brief, opts.capabilityLimit != null ? { capabilityLimit: opts.capabilityLimit } : {});
  if (!plan.ok) return { ok: false, error: "plan failed", trace };
  // BUNDLES were built for this and then never wired in: the planner's raw keyword scoring picked `credit-limit`
  // and `deposit-holds` for a barbershop while `hours`, `waitlist` and `reminders` went unbuilt. applyBundle puts
  // the curated core for the matched app type FIRST, so the essentials are built and the planner's long tail
  // falls off the end of the budget instead of the middle. It only ever ADDS — no planner pick is discarded.
  const bundled = applyBundle(brief, plan.spec.capabilities);
  if (bundled.bundle) {
    plan.spec.capabilities = bundled.capabilities;
    t("bundle", { cost: 0, matched: bundled.bundle.id, added: bundled.added });
  } else {
    t("bundle", { cost: 0, skipped: "no bundle matched this brief" });
  }

  const family = pickStyleFamily(plan.spec.design_hints);
  // A whole-app STARTER, if one fits the brief. opts.starter forces a specific id; opts.starter === false turns
  // starters off entirely (used by the A/B harness to measure what they are worth).
  const starter = opts.starter === false ? null
    : opts.starter ? getStarter(opts.starter)
    : (() => { const m = matchStarter(brief); return m ? getStarter(m.id) : null; })();
  const bp = buildPlan(plan.spec, cap, { vision: !!(deps.render && deps.critiqueOne), starter });
  t("starter", { cost: 0, matched: starter ? starter.id : null, pages: starter ? starter.pages : [], covered: bp.covered });
  t("plan", { cost: 0, capabilities: plan.spec.capabilities, pages: plan.spec.pages.length, family, genBudget: bp.genBudget, reserves: bp.reserves, dropped: bp.dropped });

  // ── 5b. SCHEMA, before a single page is written.
  //
  // This used to happen at step 8, as a repair: generate everything, notice the app calls a
  // database it never declared, then reverse-engineer the tables out of the JSX. That order is why
  // schema-fix existed at all. Deciding the model first is what the Lovable clone does, and it
  // changes what the page steps are working from — `src/lib/db-types.ts` is generated ($0) before
  // the pages, so a page reads `data[0].customer_name` with no annotation and a column typo is a
  // compile error instead of a runtime undefined.
  //
  // A STARTER already ships a schema designed alongside its pages, so there is nothing to decide.
  const seeded = starter ? starterFiles(starter.id) : {};
  let preSchema = seeded["isibi.schema.json"] || null;
  if (preSchema) {
    t("schema", { cost: 0, skipped: `the ${starter.id} starter ships its own schema` });
  } else if (!(plan.spec.tables || []).length) {
    // The planner derives tables from the selected capabilities' registry entries, so an empty list
    // means a brochure site — nothing to persist, and a schema would provision tables no page reads.
    t("schema", { cost: 0, skipped: "the plan declares no tables — nothing to persist" });
  } else {
    const r = await call("schema", SCHEMA_FIRST_RULES,
      "Design the database for this app. No pages exist yet — you are deciding the data model they will be built against.\n\n" +
      "App brief: " + brief + "\n\n" +
      "Pages that will be built: " + (plan.spec.pages || []).map((p) => p.title || p.id).join(", ") + "\n" +
      "Features that will be built: " + (plan.spec.capabilities || []).join(", ") + "\n" +
      ((plan.spec.tables || []).length ? "Tables the planner expects: " + plan.spec.tables.join(", ") + "\n" : ""),
      bp.reserves.schema);
    preSchema = (r && r.files["isibi.schema.json"]) || null;
    if (!preSchema && r) t("schema:empty", { cost: 0, warn: "the schema stage returned no schema file — the step-8 repair remains the fallback" });
  }

  // ── 6. Generate (chunked: shell + page groups + admin), inside the plan's generation budget.
  const cb = await runChunkedBuild(brief, plan.spec, bp.genBudget + bp.reserveTotal, {
    generate: async (system, user, maxTokens) => {
      const budget = Math.min(maxTokens, remaining());
      const g = await deps.generate(system, user, budget);
      charge(g.usedOut || 0);
      return g;
    },
  }, {
    vision: !!(deps.render && deps.critiqueOne),
    starter,
    // Decided above, so the shell step no longer writes it and every page step is handed the real
    // table list rather than inventing field names it will be patched for later.
    schema: preSchema,
    // onStep belongs in OPTS (runChunkedBuild reads it from opts, not deps) — this is what puts each generation
    // sub-step (shell / page groups / admin) into the pipeline trace.
    onStep: (s) => t("generate:" + s.kind, { budget: s.budget, out: s.out, files: s.files, remaining: remaining() }),
  });
  let files = cb.files || {};
  if (!Object.keys(files).length) return { ok: false, error: "generation produced no files", trace, spent };

  // ── 7. Validate (deterministic).
  // main.jsx / index.css / components come from the TEMPLATE (0 tokens), so they're absent from `files` by design.
  const haveCore = !!(files["index.html"] && files["src/App.tsx"] && files["src/pages/Home.tsx"]);
  t("validate", { cost: 0, ok: haveCore, fileCount: Object.keys(files).length });

  // ── 8. Schema-fix — the app calls the backend but never declared its tables.
  if (usesBackend(files) && !files["isibi.schema.json"]) {
    const r = await call("schema-fix", SCHEMA_REPAIR_RULES,
      "This project calls the per-site backend API (/auth and/or /rows/<table>) but is MISSING its isibi.schema.json, so NO database is created and every backend call fails on the live site. Emit ONLY the isibi.schema.json file block declaring the tables it uses.\n\nProject files:\n\n" + dumpFiles(files),
      bp.reserves.schema);
    if (r && r.files["isibi.schema.json"]) {
      files["isibi.schema.json"] = r.files["isibi.schema.json"];
      // The schema arrived AFTER generation, so the row types have to be regenerated against it — otherwise the
      // app ships with an empty `Tables` and every row silently falls back to `any`.
      files = scaffoldDbTypes(files);
    }
  } else {
    // Now the ordinary outcome rather than the lucky one: stage 5b decided the model, so there is
    // nothing to reverse-engineer. The repair stays wired for the cases 5b skips or comes up empty.
    t("schema-fix", { cost: 0, skipped: files["isibi.schema.json"]
      ? (preSchema ? "schema was decided before the pages — nothing to repair" : "schema already declared")
      : "no backend calls" });
  }

  // ── 9. Charge credits (accounting, no tokens).
  t("charge-credits", { cost: 0, tokensSoFar: spent });

  // ── 10. Wiring-repair — backend calls that forgot the site slug.
  const badWiring = Object.values(files).some((s) => /fetch\(\s*[`'"]\/api\/db\/(?!<|\$\{)/.test(String(s)));
  if (badWiring) {
    const r = await call("wiring-repair", WIRING_REPAIR_RULES, "Fix every backend URL so it includes the site slug.\n\nProject files:\n\n" + dumpFiles(files), bp.reserves.wiring);
    if (r) graft(files, r.files);
  } else {
    t("wiring-repair", { cost: 0, skipped: "backend URLs already carry the slug" });
  }

  // ── 11. Lint gate (+ one repair pass when it finds hard errors).
  let lint = lintGeneratedApp(files);
  t("lint-gate", { cost: 0, ok: lint.ok, errors: lint.errors.map((e) => e.rule), warnings: lint.warnings.map((w) => w.rule) });
  if (!lint.ok) {
    const r = await call("lint-repair", REACT_REVISE_RULES,
      "A static check found these structural problems — fix them, returning ONLY the corrected file(s), and do NOT change the app's data model or routes:\n- " +
      lint.errors.map((e) => "[" + e.rule + "] " + e.msg).join("\n- ") + "\n\nProject files:\n\n" + dumpFiles(files),
      bp.reserves.lint);
    if (r) { graft(files, r.files); lint = lintGeneratedApp(files); t("lint-recheck", { cost: 0, ok: lint.ok, errors: lint.errors.map((e) => e.rule) }); }
  } else {
    t("lint-repair", { cost: 0, skipped: "lint clean" });
  }

  // ── 12. Images (fal — no output tokens; not exercised here).
  t("images", { cost: 0, skipped: "no image generation in this harness" });

  // ── 13. Compile, and ── 14. the fix-loop (each attempt draws from the repair reserve).
  let dist = null, compiled = false, lastError = null;
  const attempts = opts.fixAttempts != null ? opts.fixAttempts : 2;
  for (let attempt = 0; attempt <= attempts; attempt++) {
    const b = await deps.build(files);
    compiled = !!b.ok; lastError = b.error || null;
    t(attempt === 0 ? "compile" : "compile-recheck", { cost: 0, attempt, ok: compiled, error: compiled ? null : String(lastError || "").slice(0, 200) });
    if (compiled) { dist = b.files || null; break; }
    if (attempt === attempts) break;
    const share = Math.ceil(bp.reserves.repair / Math.max(1, attempts)); // split the repair reserve across attempts
    const r = await call("fix-loop", REACT_FIX_RULES,
      "The Vite build FAILED with this error:\n\n" + String(lastError || "").slice(0, 4000) + "\n\nProject files:\n\n" + dumpFiles(files),
      share);
    if (!r) break;
    graft(files, r.files);
  }

  // ── 15. Vision repair (optional; render + critique, one polish pass).
  if (compiled && deps.render && deps.critiqueOne) {
    try {
      const routes = ["/"].concat((plan.spec.pages || []).filter((p) => p.path !== "/" && p.path !== "/signin").slice(0, 2).map((p) => p.path));
      const shots = (await deps.render(dist || files, { routes })) || [];
      const crits = []; for (const s of shots) crits.push(await deps.critiqueOne(s, { prompt: buildCritiquePrompt({ goal: brief, family }) }));
      const minScore = crits.length ? Math.min(...crits.map((c) => c.score || 0)) : null;
      t("vision-review", { cost: 0, shots: shots.length, minScore });
      if (minScore != null && minScore < (opts.visionThreshold || 75)) {
        const instruction = crits.flatMap((c) => (c.issues || []).map((i) => "- " + (i.fix || i.issue))).join("\n");
        const r = await call("vision-polish", REACT_REVISE_RULES, "Improve the visual design. Address these issues:\n" + instruction + "\n\nProject files:\n\n" + dumpFiles(files), bp.reserves.vision);
        if (r) { graft(files, r.files); const rb = await deps.build(files); if (rb.ok && rb.files) { dist = rb.files; } t("compile-after-polish", { cost: 0, ok: !!rb.ok }); }
      }
    } catch (e) { t("vision-review", { cost: 0, error: String(e && e.message || e).slice(0, 160) }); }
  } else {
    t("vision-review", { cost: 0, skipped: compiled ? "vision not wired" : "build failed — nothing to render" });
  }

  // ── 16-17. Publish + provision (infra; no output tokens).
  t("publish", { cost: 0, skipped: compiled ? "harness does not publish" : "build failed" });
  t("provision-db", { cost: 0, skipped: files["isibi.schema.json"] ? "would provision declared tables" : "no schema" });
  t("done", { cost: 0, compiled, spent, cap, withinCap: spent <= cap });

  return { ok: compiled, compiled, files, dist, plan: bp, spec: plan.spec, starter: starter ? starter.id : null, lint, error: compiled ? null : lastError, spent, cap, withinCap: spent <= cap, trace };
}

// traceTable — a readable per-stage ledger: what each stage was allowed, what it actually spent, running total.
export function traceTable(res) {
  if (!res || !res.trace) return "(no trace)";
  const L = ["| # | stage | budget | spent | running | note |", "| --- | --- | --- | --- | --- | --- |"];
  let run = 0;
  for (const r of res.trace) {
    run += r.out || 0;
    const note = r.skipped ? "skipped: " + r.skipped
      : r.error ? "error: " + String(r.error).slice(0, 60)
      : r.ok === false ? "failed"
      : Array.isArray(r.files) ? r.files.length + " file(s)"
      : r.fileCount != null ? r.fileCount + " files total"
      : r.ok === true ? "ok" : "";
    L.push(`| ${r.n} | ${r.stage} | ${r.budget || "—"} | ${r.out || 0} | ${run} | ${note} |`);
  }
  L.push(`\n**total spent ${res.spent} / cap ${res.cap} — ${res.withinCap ? "within cap ✅" : "OVER CAP ❌"} · compiled: ${res.compiled ? "✅" : "❌"}**`);
  return L.join("\n");
}
