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
import { pageCost } from "../../builder/publish-pages.mjs";
import { normalizeSchema } from "../../site-schema.mjs";
import { ALL_THEMES } from "../fixtures/themes.mjs";
import { oklchToRgb } from "../../builder/site-theme.mjs";

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
// THREE SHAPES, NOT ONE.
//
// This measured a yoga studio and nothing else, so what it actually told us was
// "the generator handles booking sites". Every other trade — a menu-only café, an
// internal tool with sign-in — went through a DIFFERENT set of declarable
// features, a different family exemplar and a different layout directive, and
// none of it had ever been sampled.
//
// That mattered because today proved the failures are in the PLATFORM rather
// than in one site's luck: `publicView` was uncreated for every site that
// declared one, `PublicRow` was unrenderable for every untyped read. A shape
// nobody samples is a shape whose platform bugs nobody finds.
//
// Deliberately three, and deliberately these three. They are chosen so the
// declarable features they exercise barely overlap:
//
//   booking  — collect + publicView + unique, a member area, an admin table
//   menu     — display only. No form, no members, no publicView at all: the
//              shape where seeding is the whole content and there is nothing to
//              submit, which is most of what this platform builds.
//   tool     — teamScope and member tables, so the page has to sign somebody in.
//              The one shape where `useMember` is mandatory.
//
// Cost is linear: one model call per scenario per sample, ~$0.28 each. CI runs
// one sample of each, so a merge went from ~$0.28 to ~$0.85.
const SCENARIOS = [
  {
    key: "booking",
    // THE AUTHORED PLAN, standing where `family: "salon"` used to.
    //
    // It has to be here, and hand-written, for the reason this whole harness
    // exists: production composes `briefWithLayout({ brief, plan, images })`, so
    // a scenario with no plan sends the BARE BRIEF and measures a prompt the
    // platform does not send. That is the ~287-token gap `briefWithLayout` was
    // extracted to close, reopened one field along.
    //
    // Written as the DESIGNER would answer, not as a minimal stub: six fields,
    // a real page list with roles, and a component manifest — because the
    // manifest is what `siteComponentApi` builds the per-site signature block
    // from, and a scenario naming none measures a build with only the cached
    // core.
    plan: {
      purpose: "A yoga studio where people book a class and members keep their own notes",
      // PER PAGE SINCE 2026-08-21, and this harness's own header is why it had to
      // be rewritten rather than left: a flat shape buys nothing now, so a
      // scenario keeping one would send a directive with no arrangement in it
      // while production sends one with — a harness measuring a different
      // pipeline, which is worse than no harness.
      // ONE PAGE SINCE 2026-08-28 (owner's call — site-plan's MAX_PAGES fell
      // 5 -> 1, the front page IS the site), and the same header rule as the
      // per-page rewrite above applies: a scenario still declaring four pages
      // would be sliced to one by `normalizePlan` anyway, so keeping them here
      // is measuring a directive production never sends. The bands fold onto
      // "/" instead, inside MAX_SECTIONS.
      // ONE PAGE IS ONE JOB (2026-08-28, the run-53 correction). An earlier
      // refold of this scenario stacked the timetable, the booking, a sign-in
      // and a member's private notes down one scroll — four screens wearing
      // one page, which is exactly what the prompt now forbids. The one job
      // here is BOOKING A CLASS; the members' area is a second screen and is
      // left out of the plan rather than squeezed under it.
      shape: [
        { path: "/", sections: [
          "hero — what the studio is, and the Book a class button",
          "week-strip — this week's timetable",
          "availability-grid — the free slots, taken ones struck through",
          "form-row — a name and an email, busy-button the one submit",
          "faq — what to bring, and whether it suits a beginner",
        ] },
      ],
      pages: [
        { path: "/", role: "book a class: what the studio is, the timetable, and the booking" },
      ],
      action: ["Book a class"],
      components: ["site-chrome", "section-header", "data-list", "availability-grid", "form-row",
                   "busy-button", "week-strip", "empty-state", "safe-image", "faq"],
    },
    theme: "herbarium",
    fonts: { heading: "fraunces", body: "inter" },
    brand: "Aurora Yoga",
    brief: "A yoga studio: a class timetable, a booking form, a members area where somebody keeps their own notes, and an account page.",
    tables: [
      // `mask` was removed from the designer tool on 2026-08-04 because nothing
      // can enforce it, so it is gone from here too — an eval that sends a
      // schema production cannot produce is measuring a pipeline we do not run.
      { name: "teachers", access: "display", columns: ["name", "bio", "photo_url"] },
      {
        name: "bookings", access: "collect",
        columns: ["class_name", "customer_name", "customer_email", "slot_date", "slot_time"],
        unique: [{ columns: ["slot_date", "slot_time"] }],
        publicView: { columns: ["slot_date", "slot_time"] },
      },
      { name: "my_notes", access: "user", columns: ["title", "body"] },
      { name: "announcements", access: "admin", columns: ["title", "body"], writeRoles: ["admin"] },
    ],
  },
  {
    key: "menu",
    plan: {
      purpose: "A neighbourhood restaurant showing its menu, its cooks and how to find it",
      shape: [
        { path: "/", sections: [
          "hero — the place, and the phone number as the action",
          "section-header — one per course, price-row every dish with its price",
          "empty-state — when a course has nothing in it",
          "data-list — who cooks",
          "opening-hours — the week",
          "location-card — the address",
        ] },
      ],
      pages: [
        { path: "/", role: "the whole restaurant on one page: the menu with prices, who cooks, the hours and the address" },
      ],
      action: ["Call us"],
      components: ["site-chrome", "section-header", "data-list", "price-row", "opening-hours",
                   "location-card", "safe-image", "empty-state"],
    },
    theme: "herbarium",
    fonts: { heading: "fraunces", body: "inter" },
    brand: "Pell Street Kitchen",
    brief: "A neighbourhood restaurant: the menu with prices, who cooks, opening hours and how to find us. No online booking — people phone.",
    tables: [
      { name: "dishes", access: "display", columns: ["name", "description", "price", "course"] },
      { name: "chefs", access: "display", columns: ["name", "role", "photo_url"] },
      { name: "hours", access: "display", columns: ["day", "opens", "closes"] },
    ],
  },
  {
    key: "tool",
    plan: {
      purpose: "An internal tool where a small sales team signs in and works its deals",
      // ONE JOB: THE DEALS DESK. The accounts table and the playbook are
      // separate working screens — stacked below the deals they are the
      // run-53 failure exactly (northgroup-17 shipped a pipeline, a deal
      // record and a contact book down one scroll), so they are left out of
      // the plan rather than folded in.
      shape: [
        { path: "/", sections: [
          "form-row — sign in, because everything here is behind it",
          "filter-bar — search, and a filter by stage",
          "data-table — every deal, with status-dot and bulk-actions",
          "empty-state — when the filter matches nothing",
        ] },
      ],
      pages: [
        { path: "/", role: "the team's deals desk: sign in, then every deal with its stage" },
      ],
      action: ["Add a deal"],
      components: ["site-chrome", "data-table", "data-list", "form-row", "busy-button",
                   "empty-state", "status-dot", "filter-bar", "bulk-actions"],
    },
    theme: "herbarium",
    fonts: { heading: "fraunces", body: "inter" },
    brand: "Halyard",
    brief: "An internal tool for a small sales team: everyone signs in, sees the deals their team is working, adds their own, and there is a shared list of accounts.",
    tables: [
      { name: "deals", access: "user", columns: ["title", "value", "stage"], teamScope: true },
      { name: "accounts", access: "feed", columns: ["name", "website", "notes"] },
      { name: "playbook", access: "admin", columns: ["title", "body"], writeRoles: ["admin"] },
    ],
  },
];

// Composed through the SAME function worker.js calls, so the directive cannot be
// here in a form production does not send.
for (const sc of SCENARIOS) {
  sc.spec = normalizeSchema({ tables: sc.tables });
  sc.composed = briefWithLayout({ brief: sc.brief, plan: sc.plan });
}

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
async function generate(sc) {
  // No timeout, matching production — a harness that gives up sooner than the
  // thing it measures reports a failure the real path would not have had.
  const r = await postWithRetry(JSON.stringify(pagesRequest({ brief: sc.composed, spec: sc.spec, brand: sc.brand })));
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
  // WHY there are no pages, not merely that there are none. Measured 2026-08-05:
  // the menu sample reported "(nothing usable)" and nothing anywhere said
  // whether the model answered in prose, called no tool, or called the tool with
  // an empty list — three different problems with one message.
  // `generateSitePages` already captures this shape in production; the eval was
  // the half still silent. Block TYPES and a stop reason only, never text: a
  // response can quote the brief, and this goes to a public job log.
  const shape = use ? null : {
    stopReason: String(j.stop_reason || "").slice(0, 40),
    blocks: (Array.isArray(j.content) ? j.content : []).map((b) => String(b && b.type)).slice(0, 6),
  };
  return { input: (use && use.input) || null, usage, shape };
}

// $3/M in, $15/M out, cache write 1.25x, cache read 0.1x — Sonnet 5's list price.
// IMPORTED, NOT RESTATED. This file kept its own rate table while
// publish-pages.mjs kept another, and they disagreed: the customer was billed
// from one and told what a build cost by the other. One table, or they drift
// again — the same reason `pagesRequest` and `briefWithLayout` are shared.
const dollars = (u) => pageCost(u);
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

// A SCENARIO NAMES A FIXTURE PALETTE AND THE CONTAINER TAKES THREE COLOURS. The
// registry left the product on 2026-08-20 and `payload.theme` stopped being read
// anywhere — so this posted a name into a void for a day and every sample was
// compiled against the template's own default palette, which is the exact state
// the comment below says is worse than no harness. Same conversion
// `theme-seam.mjs` and `theme-render.mjs` make: the fixture's OKLCH is the input,
// hex is what travels, and `normalizeSeeds` in the container derives the rest.
const asHex = ([L, C, H]) => {
  const [r, g, b] = oklchToRgb(L, C, H);
  return "#" + [r, g, b].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
};
function seedsFor(name) {
  const t = ALL_THEMES[name];
  if (!t) return null;
  return {
    name, paper: asHex(t.light.paper), ink: asHex(t.light.ink), accent: asHex(t.light.accent),
    dark: { paper: asHex(t.dark.paper), ink: asHex(t.dark.ink), accent: asHex(t.dark.accent) },
  };
}

/** Takes the pages ARRAY and sends what worker.js sends: {path: source}. */
async function compile(pages, sc) {
  const files = {};
  for (const p of pages) files[p.path] = p.source;
  const r = await fetch(`http://127.0.0.1:${PORT}/build`, {
    method: "POST", headers: { "content-type": "application/json" },
    // seeds/fonts/title, exactly as worker.js posts them. Without these the
    // build is the bare template — default palette, system font stack — so a
    // sample could be LOOKED at and still not show what a customer gets.
    // `fontFiles` is production-only: the Worker has no npm, the container does,
    // and the build service resolves the pair itself when they are absent.
    body: JSON.stringify({ files, slug: "eval-" + sc.key, title: sc.brand, seeds: seedsFor(sc.theme), fonts: sc.fonts }),
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
let wiped = false;
function saveSample(key, n, stage, pages, errors) {
  try {
    const root = path.join(ROOT, "docs", "auth-audit", "pages");
    if (!wiped) {
      wiped = true;
      fs.rmSync(root, { recursive: true, force: true });
    }
    const dir = path.join(root, key + "-" + n);
    // Wiped first, or a run that writes FEWER pages than the last one leaves the
    // previous run's extra route sitting there looking like part of this site —
    // the same leak `src/routes` is reset for on every container build.
    fs.mkdirSync(dir, { recursive: true });
    for (const p of pages) fs.writeFileSync(path.join(dir, p.path.replace(/[/\\]/g, "_")), p.source);
    fs.writeFileSync(path.join(dir, "_stage.txt"), stage + "\n");
    if (errors && errors.length) fs.writeFileSync(path.join(dir, "_errors.txt"), errors.join("\n"));
  } catch (e) { console.error(`could not save sample ${key}-${n}:`, e && e.message); }
}

// DID WE EVER GET AN ANSWER? A run that could not ask the model has measured
// nothing, and must not be reported as a compile rate of zero.
let reachedModel = false;

const results = [];
const errorCounts = new Map();
const lintCounts = new Map();

try {
  if (!(await startServer())) { console.error("the build service did not come up"); process.exit(1); }
  console.log(`sampling the page generator ${SAMPLES}× across ${SCENARIOS.length} site shapes (${SCENARIOS.map((x) => x.key).join(", ")}), fixed schemas, no database\n`);

  // WIPED ONCE, and LAZILY — on the first sample that actually has pages to
  // write, not before the run starts.
  //
  // Wiping up front is right for the case it was written for (a run producing
  // FEWER samples than the last leaves stale ones looking like part of it). It
  // is wrong for a run that never reaches the model at all: on 2026-08-04 the
  // Anthropic account ran out of credit, every sample threw a 400 before a
  // single token, and the eval deleted the last real measurement and replaced it
  // with zeroes. An outage should not be able to destroy the evidence.

  for (const sc of SCENARIOS) {
   console.log(`— ${sc.key} (${sc.plan.pages.length} pages)`);
   for (let n = 1; n <= SAMPLES; n++) {
    const row = { key: sc.key, n, stage: "?", files: [], problems: [], errors: [] };
    try {
      const gen = await generate(sc);
      reachedModel = true;
      if (gen.usage) { row.usage = gen.usage; }
      if (gen.truncated) { row.stage = "truncated"; console.log(`  ${sc.key} ${n}. TRUNCATED at max_tokens`); results.push(row); continue; }
      const v = validatePages(gen.input);
      if (!v.pages.length) {
        row.stage = "no-pages";
        row.problems = v.problems;
        const why = v.problems.join(" | ")
          || (gen.shape ? "no tool_use — " + JSON.stringify(gen.shape) : "write_pages was called with no pages");
        console.log(`  ${sc.key} ${n}. NO PAGES  ${why}`);
        results.push(row);
        continue;
      }

      const problems = v.problems.concat(lintPages(v.pages, sc.spec));
      const built = await compile(v.pages, sc);

      row.files = v.pages.map((p) => p.path);
      row.problems = problems;
      if (built.ok) {
        row.stage = "ok";
        console.log(`  ${sc.key} ${n}. OK  ${row.files.length} files${problems.length ? `, ${problems.length} lint problem(s)` : ""}`);
      } else {
        row.stage = built.stage || "compile";
        row.errors = String(built.error || "").split("\n").filter((l) => /error TS/.test(l));
        for (const e of row.errors) errorCounts.set(shapeOf(e), (errorCounts.get(shapeOf(e)) || 0) + 1);
        console.log(`  ${sc.key} ${n}. FAILED ${row.stage}`);
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
      saveSample(sc.key, n, row.stage, v.pages, row.errors);
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
      console.log(`  ${sc.key} ${n}. THREW  ${row.problems[0]}`);
    }
    results.push(row);
   }
  }
} finally {
  if (server) server.kill();
  if (sandbox) { try { fs.rmSync(sandbox, { recursive: true, force: true }); } catch { /* a temp dir */ } }
}

// A TOTAL OUTAGE IS NOT A SCORE OF ZERO.
//
// Measured 2026-08-04: the Anthropic account ran out of credit, all three
// samples threw `400 credit balance is too low`, and the report published
// "**0/3 compiled**" — which reads, permanently and in the repo, as "the
// generator cannot build any of these". It is the same failure the Worker
// already learned one layer down, where a provider outage and a model writing an
// unusable page came back indistinguishable.
//
// So: if nothing ever reached the model, say what happened and leave the last
// real measurement where it is.
if (!reachedModel) {
  const why = (results.find((r) => r.problems && r.problems[0]) || {}).problems || ["no reason recorded"];
  console.error("\nTHE RUN NEVER REACHED THE MODEL — nothing was measured and nothing was billed.");
  console.error("  " + String(why[0]).slice(0, 300));
  console.error("\nPAGE-GEN.md is left as it was: a run that could not ask is not a compile rate of zero.");
  process.exit(1);
}

const compiled = results.filter((r) => r.stage === "ok");
const clean = compiled.filter((r) => !r.problems.length).length;

// PER SHAPE, NOT JUST A TOTAL.
//
// "2/3 compiled" across three different site shapes is the least useful way to
// report this: it cannot distinguish "the generator is fine and one sample was
// unlucky" from "it cannot build a menu site at all". The whole reason for
// sampling more than one shape is to see WHICH one fails, so the number has to
// be broken out or the extra spend buys nothing.
const byShape = SCENARIOS.map((sc) => {
  const rs = results.filter((r) => r.key === sc.key);
  return {
    key: sc.key,
    pages: sc.plan.pages.length,
    ok: rs.filter((r) => r.stage === "ok").length,
    n: rs.length,
    clean: rs.filter((r) => r.stage === "ok" && !r.problems.length).length,
  };
});
const shapeLines = byShape.map((b2) =>
  `${b2.key} (${b2.pages}p): ${b2.ok}/${b2.n} compiled` + (b2.ok ? `, ${b2.clean} clean` : ""));

// No "first try" column any more: with the repair pass gone every sample IS a
// first try, and a second number saying the same thing invites reading it as a
// second chance that exists.
console.log(`\n${compiled.length}/${results.length} compiled · ${clean} with no lint problems`);
for (const l of shapeLines) console.log("  " + l);

// WHAT IT COST, AND HOW MUCH OF THE OUTPUT WAS COMMENTS. The second number is
// here because the no-comments rule asks the model not to write them and an unmeasured rule
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
    "Three site shapes, each with its own schema, family and layout directive — a booking site, a",
    "menu-only site with no form at all, and an internal tool where every page needs a signed-in member.",
    "",
    ...shapeLines.map((l) => "- " + l),
    "",
    "No database and no publish — this measures the GENERATOR, not the build path around it.",
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
    lines.push(`- **${r.key} ${r.n}. ${r.stage}** — ${r.files.length ? r.files.join(", ") : "(no files)"}`);
    for (const e of r.errors.slice(0, 4)) lines.push(`  - \`${e}\``);
    for (const p of r.problems.slice(0, 4)) lines.push(`  - lint: ${p}`);
  }
  fs.writeFileSync(path.join(out, "PAGE-GEN.md"), lines.join("\n"));
} catch (e) { console.error("report write failed:", e && e.message); }

// One sample failing is variance and must not fail the job. NONE compiling is
// the signal worth acting on, and is what the placeholder problem looks like.
process.exit(compiled.length === 0 ? 1 : 0);
