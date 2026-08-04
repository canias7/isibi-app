// How often does the page generator produce something that COMPILES?
//
// The production audit kept landing on the placeholder with a different
// TypeScript error each run — account.tsx one time, manage.tsx the next. One
// sample per deploy cannot tell a systematic mismatch from noise, and each one
// costs a Neon project, an R2 publish and fifteen minutes.
//
// This is the same generation call with everything else stripped away: no
// database, no container image, no publish, no isibi account. A fixed schema
// goes in, N samples come back, each is validated, linted and compiled. The
// distinct errors are then counted by shape, which turns "it varies" into a
// ranked list of what actually breaks.
//
// ONE CALL A SAMPLE, because production makes one call a build — the repair
// pass was removed 2026-08-04. This harness mirrors the pipeline rather than
// improving on it: a repair here would report a compile rate the platform does
// not deliver, which is worse than not measuring. FIRST TRY IS THE ONLY RATE
// NOW, and a failure column is a bill for the kit or the rules to settle once.
//
// It issues the request through `pagesRequest`, the same function worker.js
// uses, so this cannot quietly drift into tuning a different prompt.
//
// Needs ANTHROPIC_API_KEY and the template's node_modules. Costs exactly one
// generation call per sample.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pagesRequest, briefWithLayout, validatePages, lintPages } from "../../builder/page-gen.mjs";
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
// THE THREE AXES A REAL BUILD CARRIES, and this harness carried none of them
// until 2026-08-04. A yoga studio is a `salon` (its `kinds` name yoga outright);
// the theme and the fonts are what the designer picks alongside the schema.
//
// Sending the bare brief made every number here describe a prompt the platform
// does not send — 447 characters where production sends 1,508 — and every
// rendered sample the bare template rather than a themed site. A harness that
// measures a different pipeline is worse than no harness.
const FAMILY = "salon";
const THEME = "herbarium";
const FONTS = { heading: "fraunces", body: "inter" };
const BRAND = "Aurora Yoga";
const RAW_BRIEF = "A yoga studio: a class timetable, a booking form, a members area where somebody keeps their own notes, and an account page.";
// Composed through the SAME function worker.js calls, so the directive cannot
// be here in a form production does not send.
const BRIEF = briefWithLayout({ brief: RAW_BRIEF, family: FAMILY });
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

/**
 * ONE RETRY, AND ONLY ON A TRANSPORT THROW. A run of this costs real money and
 * fifteen minutes of somebody's attention, and the first run after the credits
 * landed died three-for-three on `fetch failed` in 250ms each — the request
 * never completed, so it measured nothing and reported it as though the
 * generator had produced nothing.
 *
 * The distinction is what makes the retry safe: a REJECTED fetch means no
 * response was received, and at a quarter of a second no tokens had been
 * generated to pay for. An HTTP error is never retried here — a 400 or a 529 is
 * an answer, and re-asking would spend again for the same answer.
 *
 * The honest caveat: a connection that dies LATE could have generated tokens we
 * are then billed for twice. Bounded at one retry for that reason, rather than
 * looping.
 */
async function postWithRetry(body) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body,
      });
    } catch (e) {
      if (attempt >= 1) throw e;
      console.log(`     transport failure, retrying once: ${(e && e.message) || e}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

/** `fix` is {pages, problems} — the same repair shape publish-pages.mjs sends. */
async function generate(fix) {
  // No timeout, matching production — a harness that gives up sooner than the
  // thing it measures reports a failure the real path would not have had.
  const r = await postWithRetry(JSON.stringify(pagesRequest({ brief: BRIEF, spec: SPEC, brand: BRAND, family: FAMILY })));
  if (!r.ok) throw new Error("anthropic " + r.status + " " + (await r.text().catch(() => "")).slice(0, 200));
  const j = await r.json();
  // USAGE IS THE POINT OF HALF OF THIS FILE NOW AND IT WAS BEING THROWN AWAY.
  // Output is ~96% of what a build costs, so "does it compile" was measuring the
  // cheaper half. `cache_read` and `cache_creation` are read as well because the
  // Anthropic API reports them SEPARATELY from `input_tokens` — the same fact
  // that makes worker.js under-count what a build really costs.
  const u = j.usage || {};
  const usage = {
    out: u.output_tokens || 0,
    in: u.input_tokens || 0,
    cacheRead: u.cache_read_input_tokens || 0,
    cacheWrite: u.cache_creation_input_tokens || 0,
  };
  if (j.stop_reason === "max_tokens") return { input: null, truncated: true, usage };
  const use = (Array.isArray(j.content) ? j.content : []).find((b) => b && b.type === "tool_use");
  return { input: (use && use.input) || null, usage };
}

// $3/M in, $15/M out, cache write 1.25x, cache read 0.1x — Sonnet 5's list price.
const dollars = (u) =>
  (u.in * 3e-6) + (u.out * 15e-6) + (u.cacheWrite * 3.75e-6) + (u.cacheRead * 0.30e-6);
const COMMENT_RE = /\/\*[\s\S]*?\*\/|^[ \t]*\/\/.*$/gm;

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
    // theme/fonts/title, exactly as worker.js posts them. Without these the
    // build is the bare template — default palette, system font stack — so a
    // sample could be LOOKED at and still not show what a customer gets.
    // `fontFiles` is production-only: the Worker has no npm, the container does,
    // and the build service resolves the pair itself when they are absent.
    body: JSON.stringify({ files, slug: "eval-aurora", title: BRAND, theme: THEME, fonts: FONTS }),
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

/**
 * Writes one sample's pages to docs/auth-audit/pages/<n>/ so the LAST run is
 * always browsable in the repo. Failures additionally get `_errors.txt`.
 *
 * Never throws: a build that ran and cost money must not be lost because the
 * disk write failed, and the numbers are already in hand by this point.
 */
function saveSample(n, stage, pages, errors) {
  try {
    const dir = path.join(ROOT, "docs", "auth-audit", "pages", String(n));
    // Wiped first, or a run that writes FEWER pages than the last one leaves the
    // previous run's extra route sitting there looking like part of this site —
    // the same leak `src/routes` is reset for on every container build.
    fs.mkdirSync(dir, { recursive: true });
    for (const p of pages) fs.writeFileSync(path.join(dir, p.path.replace(/[/\\]/g, "_")), p.source);
    fs.writeFileSync(path.join(dir, "_stage.txt"), stage + "\n");
    if (errors && errors.length) fs.writeFileSync(path.join(dir, "_errors.txt"), errors.join("\n"));
  } catch (e) { console.error(`could not save sample ${n}:`, e && e.message); }
}

const results = [];
const errorCounts = new Map();
const lintCounts = new Map();

try {
  if (!(await startServer())) { console.error("the build service did not come up"); process.exit(1); }
  console.log(`sampling the page generator ${SAMPLES}×, fixed schema, no database\n`);

  // WIPED ONCE, BEFORE ANY SAMPLE. Per-sample would leave sample 4 and 5 behind
  // when the count drops from five to three, and a stale site sitting beside
  // this run's is indistinguishable from part of it — the same reason the build
  // container resets src/routes rather than overwriting into it.
  try { fs.rmSync(path.join(ROOT, "docs", "auth-audit", "pages"), { recursive: true, force: true }); }
  catch (e) { console.error("could not clear the previous run's pages:", e && e.message); }

  for (let n = 1; n <= SAMPLES; n++) {
    const row = { n, stage: "?", files: [], problems: [], errors: [] };
    try {
      const gen = await generate();
      if (gen.usage) { row.usage = gen.usage; }
      if (gen.truncated) { row.stage = "truncated"; console.log(`  ${n}. TRUNCATED at max_tokens`); results.push(row); continue; }
      const v = validatePages(gen.input);
      if (!v.pages.length) { row.stage = "no-pages"; row.problems = v.problems; console.log(`  ${n}. NO PAGES  ${v.problems.join(" | ") || "(nothing usable)"}`); results.push(row); continue; }

      const problems = v.problems.concat(lintPages(v.pages, SPEC));
      const built = await compile(v.pages);

      row.files = v.pages.map((p) => p.path);
      row.problems = problems;
      if (built.ok) {
        row.stage = "ok";
        console.log(`  ${n}. OK  ${row.files.length} files${problems.length ? `, ${problems.length} lint problem(s)` : ""}`);
      } else {
        row.stage = built.stage || "compile";
        row.errors = String(built.error || "").split("\n").filter((l) => /error TS/.test(l));
        for (const e of row.errors) errorCounts.set(shapeOf(e), (errorCounts.get(shapeOf(e)) || 0) + 1);
        console.log(`  ${n}. FAILED ${row.stage}`);
        for (const e of row.errors.slice(0, 5)) console.log(`       ${e}`);
      }
      // KEEP THE SOURCE OF EVERY SAMPLE, not only the failures.
      //
      // It used to save failures alone, for a good reason — two rounds had been
      // spent inferring what the model wrote from a filename and a column
      // number. But it left the repo able to show every failure and never a
      // success, which is the wrong way round for judging whether the generator
      // is any good: a compile rate says a page typechecked and says nothing
      // about whether it is a site anybody would want. Compiling is not working
      // — that is the lesson the grey charts and the crashing message-scroller
      // both taught, and neither would have been visible in a pass/fail column.
      saveSample(n, row.stage, v.pages, row.errors);
      for (const p of problems.slice(0, 5)) {
        lintCounts.set(p.slice(0, 120), (lintCounts.get(p.slice(0, 120)) || 0) + 1);
        console.log(`       lint: ${p}`);
      }
    } catch (e) {
      // THE CAUSE, NOT JUST THE MESSAGE. Node wraps every transport failure as
      // the single word "fetch failed" and hangs the real reason — DNS, TLS,
      // ECONNRESET, a refused connection — off `.cause`. Reporting only the
      // message turned three identical 250ms network failures into a line that
      // looked exactly like the generator producing nothing, which is the same
      // class of mistake as returning `upstream: 400` with no type: a total
      // outage and a bad answer read identically. Walked, because undici nests.
      const chain = [];
      for (let x = e, i = 0; x && i < 4; x = x.cause, i++) {
        const bit = [x.name, x.message, x.code].filter(Boolean).join(" ");
        if (bit && !chain.includes(bit)) chain.push(bit);
      }
      row.stage = "threw"; row.problems = [chain.join(" ← ") || String(e)];
      console.log(`  ${n}. THREW  ${row.problems[0]}`);
    }
    results.push(row);
  }
} finally {
  if (server) server.kill();
  if (sandbox) { try { fs.rmSync(sandbox, { recursive: true, force: true }); } catch { /* a temp dir */ } }
}

const compiled = results.filter((r) => r.stage === "ok");
const clean = compiled.filter((r) => !r.problems.length).length;

// No "first try" column any more: with the repair pass gone every sample IS a
// first try, and a second number saying the same thing invites reading it as a
// second chance that exists.
console.log(`\n${compiled.length}/${results.length} compiled · ${clean} with no lint problems`);

// WHAT IT COST, AND HOW MUCH OF THE OUTPUT WAS COMMENTS. The second number is
// here because rule 13 asks the model not to write them and an unmeasured rule
// is a wish: comments were 27% of the example set, output is 5x the price of
// input, so this is the largest single lever on what a build costs.
// Computed into a value both the console AND the committed report read. Printed
// only, it lived in a job log that GitHub deletes after 90 days — and cost is
// the number this pipeline is now managed by, so it has to survive in the repo.
let costLines = [];
const withUsage = results.filter((r) => r.usage);
if (withUsage.length) {
  const avg = (f) => withUsage.reduce((a, r) => a + f(r.usage), 0) / withUsage.length;
  const src = results.filter((r) => r.files && r.files.length);
  let all = 0, cmt = 0;
  for (const r of src) for (const f of r.files) {
    const t = typeof f === "string" ? f : (f.source || "");
    all += t.length;
    cmt += (t.match(COMMENT_RE) || []).reduce((a, m) => a + m.length, 0);
  }
  costLines = [
    `output ${Math.round(avg((u) => u.out)).toLocaleString()} tok/sample · ` +
    `fresh in ${Math.round(avg((u) => u.in)).toLocaleString()} · ` +
    `cache read ${Math.round(avg((u) => u.cacheRead)).toLocaleString()} · ` +
    `write ${Math.round(avg((u) => u.cacheWrite)).toLocaleString()}`,
    `$${avg(dollars).toFixed(4)} a sample at list price` +
      (all ? ` · comments are ${(cmt / all * 100).toFixed(1)}% of the source written` : ""),
  ];
  console.log("\n" + costLines.join("\n"));
}
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
    `**${compiled.length}/${results.length} compiled**, ${clean} with no lint problems.`, "",
    "One fixed schema, no database and no publish — this measures the GENERATOR, not the build path around it.",
    "One call a sample, because a build makes one call: there is no repair pass, so this rate IS what the platform ships.",
    "A single failure is variance; a column of the same error is a mismatch worth fixing.", "",
  ];
  // OUTPUT IS ~80% OF WHAT A BUILD COSTS, so the compile rate alone measures the
  // cheaper half. Kept here rather than only on stdout: this is the number the
  // repair pass was removed on, and comparing it against a run from six weeks
  // ago is impossible once the job log is gone.
  if (costLines.length) lines.push("## What it cost", "", ...costLines.map((l) => "- " + l), "");
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
    lines.push(`- **${r.n}. ${r.stage}** — ${r.files.length ? r.files.join(", ") : "(no files)"}`);
    for (const e of r.errors.slice(0, 4)) lines.push(`  - \`${e}\``);
    for (const p of r.problems.slice(0, 4)) lines.push(`  - lint: ${p}`);
  }
  fs.writeFileSync(path.join(out, "PAGE-GEN.md"), lines.join("\n"));
} catch (e) { console.error("report write failed:", e && e.message); }

// One sample failing is variance and must not fail the job. NONE compiling is
// the signal worth acting on, and is what the placeholder problem looks like.
process.exit(compiled.length === 0 ? 1 : 0);
