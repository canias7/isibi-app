// Does the DESIGNER produce a schema a business can actually use?
//
// WHY THIS EXISTS. The step that decides a site's tables, its access levels, its
// seed rows and its family was measured by NOTHING. `page gen eval` has 43 runs
// of history and SENDS the schema; `confirm smoke` and `member smoke` send one
// deliberately to skip this call; `build smoke` designs one and `console.log`s
// it without asserting anything. So every claim about designer quality — it
// skips `seed`, it picks the nearest preset — rested on two anecdotes from one
// week, and two changes were shipped against them.
//
// This is the same call with everything else stripped away: no database, no
// container, no publish, no account. A brief goes in, N samples come back, and
// each answer is scored on things checkable without a human.
//
// WHAT IT DOES NOT DO. It does not judge whether the schema is GOOD — whether
// `price` should be on the dish or the portion is a design question and this
// harness would only pretend to answer it. It checks properties that are true
// or false: every display table got starter rows, a booking table got something
// holding the slot, a brief about browsing produced something a stranger can
// read. Those are the three failures this platform has actually shipped.
//
// ONE CALL A SAMPLE, because production makes one call a build.
//
// THE REQUEST IS THE REAL ONE, and getting that right is the whole value.
// `page gen eval` issues through `pagesRequest`, the same function worker.js
// uses, specifically so it cannot drift into tuning a different prompt. The
// design call has no such function — it is inline in `worker.js`, which cannot
// be imported — so this reads the REAL tool literal out of the file and
// resolves every identifier from the REAL modules. It is not a restatement; it
// is the same object. `readSchemaTool` REFUSES to stub anything, because a
// stubbed enum is a harness measuring a prompt the platform does not send.
//
// The clean fix is to extract the request the way `pagesRequest` was extracted.
// That is deliberately NOT done here: 17 test files read `worker.js` for this
// tool, and moving it means retargeting all 17 with no live build available to
// verify the result. It is a follow-up for when the platform can be exercised.
//
// Needs ANTHROPIC_API_KEY. Costs exactly one design call per sample —
// ~1.5 credits warm, ~6.5 cold, measured 2026-08-12.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeSchema } from "../../site-schema.mjs";
import { resolveAccess } from "../../site-access.mjs";
import { pageCost } from "../../builder/publish-pages.mjs";
// MODULE SCOPE, deliberately. `readSchemaTool` binds its own `plan` from a
// dynamic import, and that binding does NOT exist out here — reaching for it
// below is a ReferenceError at startup, which is the `vidRefN` shape this
// repo has recorded twice.
import { PLAN_KEYS } from "../../builder/site-plan.mjs";
// AT MODULE SCOPE, like `PLAN_KEYS` — a dynamic import inside the function that
// builds the scope is the `vidRefN` shape, correct until somebody moves a call.
import { SEEDS_FIELD } from "../../builder/site-seeds.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SAMPLES = Math.max(1, Math.min(Number(process.env.EVAL_SAMPLES) || 2, 10));
const KEY = process.env.ANTHROPIC_API_KEY || "";
const MODEL = process.env.EVAL_MODEL || "claude-sonnet-5";

if (!KEY) { console.error("ANTHROPIC_API_KEY is required"); process.exit(1); }

// The tool extraction lives in schema-tool.mjs since 2026-08-21 — see there for
// why it reads worker.js as text. Shared with the Grok probe, so both harnesses
// measure the tool production actually sends.
import { readSchemaTool } from "./schema-tool.mjs";

import { SCENARIOS, CHECKS, ALWAYS, emptyReason } from "./schema-checks.mjs";


async function designOnce({ tool, system }, brief) {
  const req = {
    model: MODEL,
    max_tokens: 8000,
    tools: [{ ...tool, cache_control: { type: "ephemeral" } }],
    tool_choice: { type: "tool", name: "design_schema" },
    system: [{ type: "text", cache_control: { type: "ephemeral" }, text: system }],
    messages: [{ role: "user", content: brief }],
  };
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  const body = await r.json().catch(() => null);
  if (!r.ok) {
    const e = new Error("anthropic " + r.status);
    e.detail = JSON.stringify(body || {}).slice(0, 300);
    throw e;
  }
  const call = (body.content || []).find((b) => b.type === "tool_use");
  const u = body.usage || {};
  return {
    input: call ? call.input : null,
    // WHY AN ANSWER WAS EMPTY, kept rather than discarded.
    //
    // "no tables" had exactly one wording for four different failures — no tool
    // call, a call with no `tables` key, a call with an empty one, and a reply
    // cut off mid-sentence — so a real result could not be diagnosed without
    // paying for another run. That is the `validatePages` lesson (2026-08-10),
    // which separated the same four one layer over and put the output-token
    // count on the message; this harness never got it.
    //
    // `stop_reason` is the one that cannot be inferred afterwards: "max_tokens"
    // means WE cut the model off and the fix is ours, while "tool_use" means it
    // finished and meant it. Those need opposite responses and look identical in
    // a summary line.
    called: !!call,
    stopReason: String(body.stop_reason || "unknown"),
    usage: {
      in: u.input_tokens || 0, out: u.output_tokens || 0,
      cacheRead: u.cache_read_input_tokens || 0, cacheWrite: u.cache_creation_input_tokens || 0,
      model: MODEL,
    },
  };
}

const rows = [];
const totals = { in: 0, out: 0, cacheRead: 0, cacheWrite: 0, model: MODEL };
let reachedModel = false;

const loaded = await readSchemaTool();
// PRINTED FROM THE PLAN, not from a family enum. This read
// `properties.family.enum.length` — a SECOND copy of the same dead expression
// the sanity check above carried, 74 lines apart, and fixing one and not the
// other is how the run died at startup with a TypeError before reaching the
// model. Derived from `PLAN_KEYS`, so a seventh axis needs no edit here.
console.log("tool read: " + PLAN_KEYS.length + " plan fields ("
  + PLAN_KEYS.join("/") + "), " + Object.keys(loaded.tool.input_schema.properties).length
  + " properties, " + JSON.stringify(loaded.tool).length + " chars · system "
  + loaded.system.length + " chars");
console.log(SCENARIOS.length + " scenarios × " + SAMPLES + " samples, model " + MODEL + "\n");

for (const sc of SCENARIOS) {
  for (let n = 1; n <= SAMPLES; n++) {
    const row = { key: sc.key, n, ok: false, checks: [], error: "" };
    try {
      const { input, usage, called, stopReason } = await designOnce(loaded, sc.brief);
      reachedModel = true;
      for (const k of ["in", "out", "cacheRead", "cacheWrite"]) totals[k] += usage[k];
      row.why = emptyReason(input, called, stopReason, usage.out);
      if (!input) {
        // The old wording here was "the model called the tool with nothing in
        // it" — said of a reply where the tool was never called at all, which
        // sends the reader looking for the wrong thing.
        row.error = row.why;
        rows.push(row);
        console.log("  !! " + (sc.key + " " + n).padEnd(16) + row.error);
        continue;
      }
      const spec = normalizeSchema(input);
      for (const name of [...sc.expect, ...ALWAYS]) {
        const res = CHECKS[name](input, spec);
        row.checks.push({ name, ...res });
      }
      row.ok = row.checks.every((c) => c.ok !== false);
      row.tables = spec.tables.map((t) => t.name + ":" + resolveAccess(t).read + "/" + resolveAccess(t).write);
      row.family = input.family;
    } catch (e) {
      row.error = String(e.message) + (e.detail ? " " + e.detail : "");
    }
    rows.push(row);
    const mark = row.error ? "!!" : (row.ok ? "ok" : "  ");
    console.log("  " + mark + " " + (sc.key + " " + n).padEnd(16)
      + (row.error || row.checks.map((c) => (c.ok === false ? "✗" : c.ok === null ? "–" : "✓") + c.name).join(" ")));
    for (const c of row.checks) if (c.ok === false) console.log("        " + c.name + ": " + c.why);
    // The DIAGNOSIS, printed only when there is one — a clean run's output is
    // byte-identical to before. `row.why` is empty whenever tables came back.
    if (row.why) console.log("        why: " + row.why);
    if (row.tables) console.log("        " + row.family + " · " + row.tables.join("  "));
  }
}

// A RUN THAT NEVER REACHED THE MODEL IS NOT A SCORE OF ZERO. The page eval
// learned this the hard way: an empty account writing 0% into the series is a
// permanent lie in the one file that tracks quality.
if (!reachedModel) {
  console.log("\nTHE RUN NEVER REACHED THE MODEL — nothing was measured and nothing was billed.");
  for (const r of rows.slice(0, 1)) console.log("  " + r.error);
  console.log("\nSCHEMA-GEN.md is left as it was: a run that could not ask is not a failure rate.");
  process.exit(1);
}

const passed = rows.filter((r) => r.ok).length;
const failed = rows.filter((r) => !r.ok);
const byCheck = {};
for (const r of rows) for (const c of r.checks) {
  byCheck[c.name] = byCheck[c.name] || { pass: 0, fail: 0, skip: 0 };
  byCheck[c.name][c.ok === false ? "fail" : c.ok === null ? "skip" : "pass"]++;
}
const cost = pageCost(totals);
const md = [
  "# Schema designer — does it produce a usable data model?",
  "",
  "**" + passed + "/" + rows.length + " samples clean.** " + SCENARIOS.length + " briefs × " + SAMPLES + " samples, one call each.",
  "",
  "No database, no publish, no account — this measures the DESIGNER, not the build path around it.",
  "Each check is a property that is true or false, never a judgement about whether the schema is *good*.",
  "",
  "## By check",
  "",
  ...Object.entries(byCheck).map(([k, v]) =>
    "- **" + k + "** — " + v.pass + " pass, " + v.fail + " fail" + (v.skip ? ", " + v.skip + " n/a" : "")),
  "",
  "## What it cost",
  "",
  "- output " + Math.round(totals.out / rows.length) + " tok/sample · fresh in " + totals.in
    + " · cache read " + totals.cacheRead + " · write " + totals.cacheWrite,
  "- " + cost.toFixed(3) + " credits for the run",
  "",
  "## Samples",
  "",
  // THE DIAGNOSIS TRAVELS INTO THE COMMITTED REPORT, not only the job log. A
  // job log is gone in 90 days and nobody re-reads one; this file is the series
  // somebody opens in a month asking "was this always broken?".
  ...rows.map((r) => "- **" + r.key + " " + r.n + "** — " + (r.error ? "ERROR " + r.error
    : (r.ok ? "clean" : r.checks.filter((c) => c.ok === false).map((c) => c.name + " (" + c.why + ")").join("; ")))
    + (r.why && !r.error ? "\n  - why: " + r.why : "")),
  "",
].join("\n");

fs.mkdirSync(path.join(ROOT, "docs", "auth-audit"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "docs", "auth-audit", "SCHEMA-GEN.md"), md);
console.log("\n" + passed + "/" + rows.length + " clean · " + cost.toFixed(3) + " credits · wrote docs/auth-audit/SCHEMA-GEN.md");
process.exit(failed.length ? 1 : 0);
