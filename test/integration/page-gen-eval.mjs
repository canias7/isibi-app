// How often does the page generator produce something that COMPILES?
//
// The production audit kept landing on the placeholder with a different
// TypeScript error each run — account.tsx one time, manage.tsx the next. One
// sample per deploy cannot tell a systematic mismatch from noise, and each one
// costs a Neon project, an R2 publish and fifteen minutes.
//
// This is the same generation call with everything else stripped away: no
// database, no container image, no publish, no isibi account. A fixed schema
// goes in, N samples come back, each is validated, linted, compiled, and — when
// it fails — repaired ONCE exactly as production does. The distinct errors are
// then counted by shape, which turns "it varies" into a ranked list of what
// actually breaks.
//
// It issues the request through `pagesRequest`, the same function worker.js
// uses, so this cannot quietly drift into tuning a different prompt.
//
// Needs ANTHROPIC_API_KEY and the template's node_modules. Costs one generation
// call per sample, plus one more for each sample that needs a repair.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pagesRequest, validatePages, lintPages } from "../../builder/page-gen.mjs";
import { normalizeSchema } from "../../site-schema.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const TEMPLATE = path.join(ROOT, "builder", "lovable", "template");
const PORT = 8127;
const SAMPLES = Math.max(1, Math.min(Number(process.env.EVAL_SAMPLES) || 3, 10));
const KEY = process.env.ANTHROPIC_API_KEY || "";

if (!KEY) { console.error("ANTHROPIC_API_KEY is required"); process.exit(1); }
if (!fs.existsSync(path.join(TEMPLATE, "node_modules"))) {
  console.error("the template's dependencies are not installed — run `npm ci` in " + TEMPLATE);
  process.exit(1);
}

// The same shape the auth audit builds, so a fix here is a fix there. Chosen to
// exercise the parts that have actually broken: a member table (an account
// page), a collect table with a claim (a manage page), a publicView, a mask.
const BRIEF = "A yoga studio: a class timetable, a booking form, a members area where somebody keeps their own notes, and an account page.";
const BRAND = "Aurora Yoga";
const SPEC = normalizeSchema({
  tables: [
    { name: "teachers", access: "display", columns: ["name", "bio", "phone"], mask: [{ column: "phone", roles: ["staff"], keep: 4 }] },
    {
      name: "bookings", access: "collect",
      columns: ["class_name", "customer_name", "customer_email", "slot_date", "slot_time"],
      unique: [{ columns: ["slot_date", "slot_time"] }],
      publicView: { columns: ["slot_date", "slot_time"] },
    },
    { name: "my_notes", access: "user", columns: ["title", "body"] },
    { name: "announcements", access: "admin", columns: ["title", "body"], writeRoles: ["admin"] },
  ],
});

/** `fix` is {pages, problems} — the same repair shape publish-pages.mjs sends. */
async function generate(fix) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(pagesRequest({ brief: BRIEF, spec: SPEC, brand: BRAND, fix })),
    signal: AbortSignal.timeout(240000),
  });
  if (!r.ok) throw new Error("anthropic " + r.status + " " + (await r.text().catch(() => "")).slice(0, 200));
  const j = await r.json();
  if (j.stop_reason === "max_tokens") return { input: null, truncated: true };
  const use = (Array.isArray(j.content) ? j.content : []).find((b) => b && b.type === "tool_use");
  return { input: (use && use.input) || null };
}

// ── the build service, set up the way the container image is ──────────────────
let server = null, sandbox = null;

function makeSandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pagegen-"));
  fs.cpSync(TEMPLATE, dir, {
    recursive: true,
    filter: (src) => !/[/\\](node_modules|dist|\.git)$/.test(src),
  });
  // Borrowed by symlink: the image bakes node_modules as a layer, and copying it
  // per run would cost more than the model call.
  fs.symlinkSync(path.join(TEMPLATE, "node_modules"), path.join(dir, "node_modules"), "dir");
  fs.mkdirSync(path.join(dir, ".routes-base"), { recursive: true });
  fs.copyFileSync(path.join(dir, "src/routes/__root.tsx"), path.join(dir, ".routes-base/__root.tsx"));
  fs.copyFileSync(path.join(dir, "index.html"), path.join(dir, ".index-base.html"));
  // The template's own index.tsx is the REFERENCE page, written against a barber
  // shop. Leaving it in would compile somebody else's site alongside the sample.
  fs.rmSync(path.join(dir, "src/routes/index.tsx"), { force: true });
  return dir;
}

async function startServer() {
  sandbox = makeSandbox();
  server = spawn("node", [path.join(ROOT, "builder", "build-server.mjs")], {
    env: { ...process.env, APP_DIR: sandbox, PORT: String(PORT), NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stderr.on("data", (d) => process.env.EVAL_VERBOSE && process.stderr.write("  [build] " + d));
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`http://127.0.0.1:${PORT}/health`)).ok) return true; }
    catch { await new Promise((r) => setTimeout(r, 300)); }
  }
  return false;
}

/** Takes the pages ARRAY and sends what worker.js sends: {path: source}. */
async function compile(pages) {
  const files = {};
  for (const p of pages) files[p.path] = p.source;
  const r = await fetch(`http://127.0.0.1:${PORT}/build`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ files }),
  });
  return r.json();
}

// Grouped by SHAPE, not text: same file, same code, identifiers stripped. Two
// samples failing the same way in different files are ONE problem, and counting
// them apart is what makes a systematic mismatch look like noise.
const shapeOf = (line) => String(line)
  .replace(/^.*?\(\d+,\d+\):\s*/, "")   // drop path and line:col, keep the error
  .replace(/'[^']*'/g, "'X'")           // the types vary; the shape does not
  .trim().slice(0, 170);

const results = [];
const errorCounts = new Map();
const lintCounts = new Map();

try {
  if (!(await startServer())) { console.error("the build service did not come up"); process.exit(1); }
  console.log(`sampling the page generator ${SAMPLES}×, fixed schema, no database\n`);

  for (let n = 1; n <= SAMPLES; n++) {
    const row = { n, stage: "?", files: [], problems: [], errors: [], repaired: false };
    try {
      const gen = await generate();
      if (gen.truncated) { row.stage = "truncated"; console.log(`  ${n}. TRUNCATED at max_tokens`); results.push(row); continue; }
      let v = validatePages(gen.input);
      if (!v.pages.length) { row.stage = "no-pages"; row.problems = v.problems; console.log(`  ${n}. NO PAGES  ${v.problems.join(" | ") || "(nothing usable)"}`); results.push(row); continue; }

      let problems = v.problems.concat(lintPages(v.pages, SPEC));
      let built = await compile(v.pages);

      // One repair, on a compile failure OR a lint problem — exactly the rule
      // publish-pages.mjs follows, so this measures what production measures.
      if (!built.ok || problems.length) {
        const why = (built.ok ? [] : [String(built.error || "").split("\n").filter((l) => /error TS/.test(l)).slice(0, 8).join("\n")]).concat(problems);
        let retry = null;
        try { retry = await generate({ pages: v.pages, problems: why }); } catch { /* the first attempt stands */ }
        if (retry && retry.input) {
          const v2 = validatePages(retry.input);
          if (v2.pages.length) {
            const p2 = v2.problems.concat(lintPages(v2.pages, SPEC));
            const b2 = await compile(v2.pages);
            if (b2.ok && (!built.ok || p2.length < problems.length)) { v = v2; problems = p2; built = b2; row.repaired = true; }
          }
        }
      }

      row.files = v.pages.map((p) => p.path);
      row.problems = problems;
      if (built.ok) {
        row.stage = "ok";
        console.log(`  ${n}. OK${row.repaired ? " (after repair)" : "          "}  ${row.files.length} files${problems.length ? `, ${problems.length} lint problem(s)` : ""}`);
      } else {
        row.stage = built.stage || "compile";
        row.errors = String(built.error || "").split("\n").filter((l) => /error TS/.test(l));
        for (const e of row.errors) errorCounts.set(shapeOf(e), (errorCounts.get(shapeOf(e)) || 0) + 1);
        console.log(`  ${n}. FAILED ${row.stage}`);
        for (const e of row.errors.slice(0, 5)) console.log(`       ${e}`);
      }
      for (const p of problems.slice(0, 5)) {
        lintCounts.set(p.slice(0, 120), (lintCounts.get(p.slice(0, 120)) || 0) + 1);
        console.log(`       lint: ${p}`);
      }
    } catch (e) {
      row.stage = "threw"; row.problems = [(e && e.message) || String(e)];
      console.log(`  ${n}. THREW  ${row.problems[0]}`);
    }
    results.push(row);
  }
} finally {
  if (server) server.kill();
  if (sandbox) { try { fs.rmSync(sandbox, { recursive: true, force: true }); } catch { /* a temp dir */ } }
}

const compiled = results.filter((r) => r.stage === "ok");
const firstTry = compiled.filter((r) => !r.repaired).length;
const clean = compiled.filter((r) => !r.problems.length).length;

console.log(`\n${compiled.length}/${results.length} compiled (${firstTry} first try) · ${clean} with no lint problems`);
if (errorCounts.size) {
  console.log("\ndistinct compile errors, most frequent first:");
  for (const [shape, count] of [...errorCounts].sort((a, b) => b[1] - a[1])) console.log(`  ${String(count).padStart(2)}×  ${shape}`);
}
if (lintCounts.size) {
  console.log("\ndistinct lint problems:");
  for (const [p, count] of [...lintCounts].sort((a, b) => b[1] - a[1])) console.log(`  ${String(count).padStart(2)}×  ${p}`);
}

try {
  const out = path.join(ROOT, "docs", "auth-audit");
  fs.mkdirSync(out, { recursive: true });
  const lines = [
    "# Page generator — compile rate", "",
    `**${compiled.length}/${results.length} compiled** (${firstTry} first try, ${clean} with no lint problems).`, "",
    "One fixed schema, no database and no publish — this measures the GENERATOR, not the build path around it.",
    "A single failure is variance; a column of the same error is a mismatch worth fixing.", "",
  ];
  if (errorCounts.size) {
    lines.push("## Distinct compile errors", "");
    for (const [shape, count] of [...errorCounts].sort((a, b) => b[1] - a[1])) lines.push(`- **${count}×** \`${shape}\``);
    lines.push("");
  }
  if (lintCounts.size) {
    lines.push("## Distinct lint problems", "");
    for (const [p, count] of [...lintCounts].sort((a, b) => b[1] - a[1])) lines.push(`- **${count}×** ${p}`);
    lines.push("");
  }
  lines.push("## Samples", "");
  for (const r of results) {
    lines.push(`- **${r.n}. ${r.stage}${r.repaired ? " (after repair)" : ""}** — ${r.files.length ? r.files.join(", ") : "(no files)"}`);
    for (const e of r.errors.slice(0, 4)) lines.push(`  - \`${e}\``);
    for (const p of r.problems.slice(0, 4)) lines.push(`  - lint: ${p}`);
  }
  fs.writeFileSync(path.join(out, "PAGE-GEN.md"), lines.join("\n"));
} catch (e) { console.error("report write failed:", e && e.message); }

// One sample failing is variance and must not fail the job. NONE compiling is
// the signal worth acting on, and is what the placeholder problem looks like.
process.exit(compiled.length === 0 ? 1 : 0);
