// view-build.mjs — build ONE app through the chunked pipeline at a given total cap, compile it, and write the
// generated source + the built dist to viewout/<cap>/ so we can render and SEE it. Runs live (needs
// ANTHROPIC_API_KEY + the build service on BUILD_URL). Thinking is off (baked into makeAnthropicGenerate), and the
// per-step budgets come from the whole-pipeline plan. Env: VIEW_CAP, VIEW_PROMPT, BUILD_URL.
import fs from "node:fs";
import path from "node:path";
import { planApp } from "../builder/app-planner.mjs";
import { runChunkedBuild } from "../builder/chunked-build.mjs";
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

const gen = makeAnthropicGenerate(key, "claude-sonnet-5", fetch, cap, true); // streaming; thinking-off is baked in
const spec = planApp(prompt, { capabilityLimit: 10 }).spec;
console.error(`[VIEW] "${prompt}" @ cap ${cap}`);
const cb = await runChunkedBuild(prompt, spec, cap, {
  generate: gen,
  onStep: (s) => console.error(`  step ${s.step} [${s.kind}] out=${s.out} files=${s.files.length}`),
});

fs.mkdirSync(outDir, { recursive: true });
writeAll(path.join(outDir, "project"), cb.files);

let compiled = false, error = null, distFiles = [];
try {
  const build = makeContainerBuild(buildUrl);
  const b = await build(cb.files);
  compiled = !!b.ok; error = b.error || null;
  if (b.ok && b.files) { writeAll(path.join(outDir, "dist"), b.files); distFiles = Object.keys(b.files); }
} catch (e) { error = String(e && e.message || e).slice(0, 300); }

const meta = { cap, prompt, compiled, error, tokens: cb.tokens, steps: cb.steps, files: Object.keys(cb.files), distFiles };
fs.writeFileSync(path.join(outDir, "meta.json"), JSON.stringify(meta, null, 2));
console.error(`[VIEW] cap ${cap}: compiled=${compiled}${error ? " error=" + String(error).slice(0, 200) : ""} files=${Object.keys(cb.files).length} dist=${distFiles.length}`);
