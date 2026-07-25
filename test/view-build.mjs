// view-build.mjs — build ONE app through the chunked pipeline at a given total cap, compile it, and write the
// generated source + the built dist to viewout/<cap>/ so we can render and SEE it. Runs live (needs
// ANTHROPIC_API_KEY + the build service on BUILD_URL). Thinking is off (baked into makeAnthropicGenerate), and the
// per-step budgets come from the whole-pipeline plan. Env: VIEW_CAP, VIEW_PROMPT, BUILD_URL.
import fs from "node:fs";
import path from "node:path";
import { runFullPipeline, traceTable } from "../builder/full-pipeline.mjs";
import { makeAnthropicGenerate, makeContainerBuild } from "./pipeline-eval.mjs";

const key = process.env.ANTHROPIC_API_KEY;
if (!key) { console.error("ANTHROPIC_API_KEY not set"); process.exit(2); }
const cap = parseInt(process.env.VIEW_CAP || "25000", 10);
const prompt = process.env.VIEW_PROMPT || "a CRM to track sales leads, deals, and follow-ups for a small team";
const buildUrl = process.env.BUILD_URL || "http://127.0.0.1:8080";
const outDir = path.join("viewout", String(cap));

const writeAll = (base, files) => {
  for (const [p, v] of Object.entries(files)) {
    const fp = path.join(base, p);
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, typeof v === "string" ? v : String(v));
  }
};

// FULL pipeline: all ~17 stages against the one cap (generate + schema-fix + wiring + lint-repair + fix-loop +
// vision), each drawing from the shared ledger. Streaming; thinking-off is baked into makeAnthropicGenerate.
const gen = makeAnthropicGenerate(key, "claude-sonnet-5", fetch, cap, true);
console.error(`[VIEW] "${prompt}" @ cap ${cap} — FULL pipeline`);
const res = await runFullPipeline(prompt, cap, {
  generate: gen,
  build: makeContainerBuild(buildUrl),
}, {
  fixAttempts: 2,
  onStage: (s) => console.error(`  ${String(s.n).padStart(2)} ${s.stage.padEnd(20)} budget=${s.budget || "-"} out=${s.out || 0}${s.skipped ? " (skipped: " + s.skipped + ")" : ""}${s.error ? " ERR " + String(s.error).slice(0, 80) : ""}`),
});

fs.mkdirSync(outDir, { recursive: true });
writeAll(path.join(outDir, "project"), res.files || {});
if (res.dist) writeAll(path.join(outDir, "dist"), res.dist);

const meta = {
  cap, prompt, compiled: res.compiled, withinCap: res.withinCap, spent: res.spent,
  error: res.error ? String(res.error).slice(0, 600) : null,
  plan: res.plan ? { genBudget: res.plan.genBudget, reserves: res.plan.reserves, dropped: res.plan.dropped } : null,
  trace: res.trace, files: Object.keys(res.files || {}), distFiles: Object.keys(res.dist || {}),
};
fs.writeFileSync(path.join(outDir, "meta.json"), JSON.stringify(meta, null, 2));
fs.writeFileSync(path.join(outDir, "trace.md"), traceTable(res));
console.error("\n" + traceTable(res) + "\n");
console.error(`[VIEW] cap ${cap}: compiled=${res.compiled} spent=${res.spent}/${cap} files=${Object.keys(res.files || {}).length}`);
