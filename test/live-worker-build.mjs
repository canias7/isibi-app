// live-worker-build.mjs — one REAL build through the exact sequence worker.js now runs.
//
// Everything in this session was verified statically: code paths, merge semantics, scaffold output,
// token arithmetic. That is real evidence, but it is not the same as watching a site come out the
// other end. This runs the live path end to end — a real model, the real chunked build, the real
// vite compile, the real runtime smoke check — and reports what actually happened.
//
// It deliberately DUPLICATES the worker's ordering rather than importing it: worker.js is a
// Cloudflare module with the whole app in it and cannot be imported here. builder/worker-generate
// .test.mjs is what pins the two together; this proves the sequence produces a working app.
//
// Needs ANTHROPIC_API_KEY and a build service at BUILD_URL. SPENDS CREDITS — one schema call plus a
// chunked generation (~4 calls).

import { planApp } from "../builder/app-planner.mjs";
import { matchStarter, getStarter, starterFiles } from "../builder/starters.mjs";
import { runChunkedBuild } from "../builder/chunked-build.mjs";
import { scaffoldRouting, scaffoldTheme, scaffoldDbTypes, scaffoldAgentsMd } from "../builder/scaffold.mjs";
import { pickStyleFamily, getStyleFamily } from "../builder/design-system.mjs";
import { parseGeneratedFiles, SCHEMA_FIRST_RULES } from "../builder/react-gen.mjs";

const KEY = process.env.ANTHROPIC_API_KEY;
const BUILD_URL = process.env.BUILD_URL || "http://127.0.0.1:8080";
const MODEL = process.env.LIVE_MODEL || "claude-sonnet-5";
const MAX_OUT = Number(process.env.LIVE_MAX_OUT || 22000); // the worker's "high" effort ceiling
const BRIEF = process.env.LIVE_BRIEF || "a booking site for a barbershop where customers pick a barber and a time, with member sign in";
if (!KEY) { console.error("ANTHROPIC_API_KEY is required"); process.exit(1); }

let inTok = 0, outTok = 0, calls = 0;
async function generate(system, user, maxTokens) {
  calls++;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    // thinking disabled and a per-call ceiling, exactly as the worker sends it.
    body: JSON.stringify({
      model: MODEL, max_tokens: Math.max(1024, Math.min(MAX_OUT, maxTokens || MAX_OUT)),
      thinking: { type: "disabled" }, system, messages: [{ role: "user", content: user }],
    }),
    signal: AbortSignal.timeout(300000),
  });
  if (!r.ok) throw new Error(`gen ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  const text = (j.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
  const u = j.usage || {};
  inTok += (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0);
  outTok += u.output_tokens || 0;
  // A truncated reply is the failure this whole exercise is about — say so rather than letting it
  // look like a step that simply produced nothing.
  if (j.stop_reason === "max_tokens") console.log(`    ! step ${calls} hit max_tokens (${u.output_tokens} out) — TRUNCATED`);
  return { text, usedIn: (u.input_tokens || 0), usedOut: u.output_tokens || 0 };
}

const t0 = Date.now();
console.log(`\nbrief: ${BRIEF}\nmodel: ${MODEL} · per-build ceiling ${MAX_OUT} out\n`);

// ── the worker's sequence ─────────────────────────────────────────────────────
const plan = planApp(BRIEF);
console.log(`plan            ${plan.ok ? plan.spec.capabilities.join(", ") : "FAILED"}`);
if (!plan.ok) { console.error("planApp failed — the worker would fall back to single-shot"); process.exit(1); }

const match = matchStarter(BRIEF);
const starterId = match ? match.id : null;
const seed = starterId ? starterFiles(starterId) : {};
console.log(`starter         ${starterId || "none — building from scratch"}`);

let preSchema = seed["isibi.schema.json"] || null;
if (!preSchema && (plan.spec.tables || []).length) {
  const sg = await generate(SCHEMA_FIRST_RULES,
    "Design the database for this app. No pages exist yet — you are deciding the data model they will be built against.\n\n" +
    `App brief: ${BRIEF}\n\nPages that will be built: ${(plan.spec.pages || []).map((p) => p.title || p.name || p.id).join(", ")}\n` +
    `Features that will be built: ${(plan.spec.capabilities || []).join(", ")}\nTables the planner expects: ${plan.spec.tables.join(", ")}\n`, 3200);
  preSchema = parseGeneratedFiles(sg.text || "")["isibi.schema.json"] || null;
}
console.log(`schema          ${preSchema ? `${(JSON.parse(preSchema).tables || []).map((t) => `${t.name} (${t.access})`).join(", ")}` : "none"}`);

const cb = await runChunkedBuild(BRIEF, plan.spec, MAX_OUT, { generate }, {
  starter: starterId ? getStarter(starterId) : undefined,
  schema: preSchema || undefined,
  reserveSchema: 0, reserveWiring: 0, reserveLint: 0, reserveRepair: 0,
  onStep: (s) => console.log(`  step ${s.step}  ${String(s.kind).padEnd(8)} ${String(s.budget).padStart(5)} budget · ${String(s.out).padStart(5)} out · ${s.files.join(", ") || "(no files)"}`),
});
let files = cb.files || {};
if (!cb.ok) console.log("chunked build came up short — the worker would fall back to single-shot");

if (starterId && !files["src/App.tsx"]) files = { ...seed, ...files };
if (!files["src/App.jsx"]) {
  const navOrder = (getStarter(starterId) || {}).navOrder || [];
  files = scaffoldRouting(files, navOrder.length ? { navOrder } : {}).files;
  const tokens = (getStyleFamily(pickStyleFamily(plan.spec.design_hints)) || {}).tokens;
  if (tokens) files = scaffoldTheme(files, tokens);
  files = scaffoldDbTypes(files);
  files = scaffoldAgentsMd(files, { name: plan.spec.name || "" });
}
const legacyShell = Boolean(files["src/App.jsx"]);
const complete = Boolean(files["index.html"]) && (legacyShell
  ? Boolean(files["src/main.jsx"])
  : Boolean(files["src/pages/Home.tsx"] && files["src/App.tsx"]));

// ── the real build ────────────────────────────────────────────────────────────
const br = await fetch(`${BUILD_URL}/build`, {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ files }),
});
const bd = await br.json().catch(() => ({ ok: false, error: "build service returned no JSON" }));
const seconds = Math.round((Date.now() - t0) / 1000);

// ── the scorecard ─────────────────────────────────────────────────────────────
const pages = Object.keys(files).filter((f) => /^src\/pages\/.+\.tsx$/.test(f));
const row = (k, v) => console.log(`  ${k.padEnd(30)}${v}`);
console.log("\n" + "=".repeat(70));
row("completeness check", complete ? "passed" : "FAILED — the old bug is back");
row("built ok", bd.ok ? "yes" : `NO — ${String(bd.error || "").split("\n")[0].slice(0, 34)}`);
row("pages", `${pages.length} — ${pages.map((p) => p.replace("src/pages/", "").replace(".tsx", "")).join(", ")}`);
row("router generated", files["src/App.tsx"] ? "yes" : "no");
row("row types generated", /export interface Tables \{[^}]*\w/.test(files["src/lib/db-types.ts"] || "") ? "yes" : "empty");
row("model calls", calls);
row("output tokens", `${outTok} / ${MAX_OUT} ceiling`);
row("typecheck", bd.typecheckRan ? `${(bd.typeErrors || []).length} error(s)` : "did not run");
row("runtime smoke check", bd.smokeRan ? ((bd.runtimeErrors || []).length ? `${bd.runtimeErrors.length} ERROR(S)` : "passed") : `skipped — ${bd.smokeReason || "?"}`);
row("wall clock", `${seconds}s`);
row("est. cost", `$${((inTok / 1e6) * 3 + (outTok / 1e6) * 15).toFixed(3)}`);
console.log("=".repeat(70));
for (const e of (bd.runtimeErrors || [])) console.log(`  runtime — ${e}`);
for (const e of (bd.typeErrors || []).slice(0, 8)) console.log(`  type    — ${e}`);
if (!bd.ok) console.log(`\nbuild error:\n${String(bd.error || "").slice(0, 1500)}`);

process.exit(complete && bd.ok ? 0 : 1);
