// Generation pipeline (the wiring layer) — composes all the meta-layers into one flow so a build goes through
// plan → design → capability-scoped prompt → generate → LINT-gate (auto-fix) → build → VISION repair, instead of
// dumping the whole 236 KB rule prompt and hoping. Every side-effecting step (generate/revise/build/render/
// critique) is INJECTED, so the orchestration is deterministic + testable offline; the real steps (the Claude
// calls, the container build, the Playwright render) are supplied by worker.js / build-server.mjs where the keys
// and browser live. Gated behind a flag so default behavior is untouched until the owner turns it on.
import { planApp, specToPrompt } from "./app-planner.mjs";
import { capabilityPrompt } from "./capability-registry.mjs";
import { pickStyleFamily, designBrief, tokensToTailwindTheme } from "./design-system.mjs";
import { lintGeneratedApp } from "./app-linter.mjs";
import { visualRepairLoop, critiquesToInstruction } from "./vision-critique.mjs";

// composeBuildPrompt(spec, familyId, opts) — the focused generation prompt: the base React rules + the app plan +
// the design brief + ONLY the capability slice this app needs (not the whole catalog).
export function composeBuildPrompt(spec, familyId, opts = {}) {
  const parts = [];
  if (opts.baseRules) parts.push(opts.baseRules);
  parts.push("=== APP PLAN ===\n" + specToPrompt(spec));
  parts.push("=== DESIGN SYSTEM ===\n" + designBrief(familyId) + "\nTailwind theme.extend to emit:\n" + tokensToTailwindTheme(familyId));
  parts.push("=== BACKEND CAPABILITIES (call ONLY these endpoints) ===\n" + capabilityPrompt(spec.capabilities));
  return parts.join("\n\n");
}

// runPipeline(opts) — orchestrate a build. Injected effects:
//   generate(prompt) → files                     the first-pass generation (a Claude call in prod)
//   revise(files, instruction) → files           a revise pass (a Claude call with the revise rules)
//   build?(files) → { ok, error? }               compile the app (the build container); optional
//   render?(files) → [{route, pngBase64}]        screenshot the built app (Playwright); optional
//   critiqueOne?(shot) → critique                vision critique of one shot (optional; enables the vision loop)
//   opts: { intent, baseRules, flags{ lint=true, build, vision }, lintRounds=2, visionRounds=2, visionThreshold=75 }
// Returns { ok, stage, spec, family, prompt, files, lint, build, vision }.
export async function runPipeline(opts) {
  const flags = opts.flags || {};
  const out = { ok: false, stage: "plan", spec: null, family: null, prompt: null, files: null, lint: null, build: null, vision: null };

  // 1) PLAN
  const planned = planApp(opts.intent, { capabilityLimit: opts.capabilityLimit });
  if (!planned.ok) { out.error = "planning failed: " + (planned.error || (planned.errors || []).join("; ")); return out; }
  out.spec = planned.spec;

  // 2) DESIGN
  out.family = pickStyleFamily(planned.spec.design_hints);

  // 3) PROMPT (plan + design + only the needed capabilities)
  out.prompt = composeBuildPrompt(planned.spec, out.family, { baseRules: opts.baseRules });

  // 4) GENERATE
  out.stage = "generate";
  let files = await opts.generate(out.prompt);
  if (!files || (typeof files === "object" && !Object.keys(files).length)) { out.error = "generation produced nothing"; return out; }

  // 5) LINT GATE (auto-fix loop) — errors get a targeted revise; warnings are advisory.
  if (flags.lint !== false) {
    out.stage = "lint";
    const rounds = opts.lintRounds != null ? opts.lintRounds : 2;
    for (let i = 0; i < rounds; i++) {
      const res = lintGeneratedApp(files);
      out.lint = res;
      if (res.ok) break;
      if (i === rounds - 1 || !opts.revise) break; // out of rounds / no revise available
      const instruction = "Fix these structural errors without changing the plan:\n- " + res.errors.map((e) => `[${e.rule}] ${e.msg}`).join("\n- ");
      files = await opts.revise(files, instruction);
    }
    if (out.lint && !out.lint.ok) { out.files = files; out.error = "lint gate failed: " + out.lint.errors.map((e) => e.rule).join(", "); return out; }
  }

  // 6) BUILD (compile) — if a builder is supplied, a compile error triggers one revise.
  if (flags.build && opts.build) {
    out.stage = "build";
    let b = await opts.build(files);
    if (!b.ok && opts.revise) { files = await opts.revise(files, "The app failed to compile:\n" + (b.error || "") + "\nFix the build error."); b = await opts.build(files); }
    out.build = b;
    if (!b.ok) { out.files = files; out.error = "build failed: " + (b.error || "").slice(0, 300); return out; }
  }

  // 7) VISION repair — render → critique → revise, to a round cap.
  if (flags.vision && opts.render && opts.critiqueOne && opts.revise) {
    out.stage = "vision";
    const vres = await visualRepairLoop({
      files, render: opts.render, critiqueOne: opts.critiqueOne,
      generate: (f, instruction) => opts.revise(f, instruction),
      threshold: opts.visionThreshold != null ? opts.visionThreshold : 75,
      maxRounds: opts.visionRounds != null ? opts.visionRounds : 2,
    });
    out.vision = { passed: vres.passed, rounds: vres.rounds.map((r) => ({ minScore: r.minScore })) };
    files = vres.files;
  }

  out.stage = "done";
  out.files = files;
  out.ok = true;
  return out;
}
