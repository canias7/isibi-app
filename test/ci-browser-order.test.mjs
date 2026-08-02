// A BROWSER STEP MUST COME AFTER THE STEP THAT INSTALLS THE BROWSER.
//
// This is a guard against a failure that can only ever be seen in CI. This
// container has PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers pre-populated, and
// every browser harness in this repo finds it there and launches happily — so a
// step placed ABOVE `npx playwright install` runs green locally, every time, and
// goes red only on a runner where nothing is pre-installed.
//
// It happened on 2026-08-02: `theme-render.mjs` was added to site-build.yml
// eighteen lines above the install step, passed the whole free suite here, and
// turned `site build` red on main the moment it merged.
//
// DERIVED AT BOTH ENDS, which is the only version of this worth having. It does
// not carry a list of "the browser tests" — it reads each script the workflow
// runs and asks whether that FILE launches a browser. A new harness is covered
// the day it is written, and a harness that stops needing a browser stops being
// constrained without anybody editing this file.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const DIR = ".github/workflows";

/**
 * The ordered shell commands of each job, as {job, steps:[string]}.
 *
 * Deliberately per-JOB and not per-file. Every workflow has exactly one job
 * today, so a flat scan would agree with this one on every input — and would
 * quietly start lying the day somebody splits the browser steps into a second
 * job, since an install in job A does nothing for a step in job B. That is the
 * shape of false pass this whole file exists to prevent.
 *
 * Only `run:` matters. `uses:` steps are actions, and none of them launch a
 * browser or install one.
 */
function jobsOf(src) {
  const lines = src.split("\n");
  const out = [];
  let inJobs = false, cur = null;
  for (const line of lines) {
    if (/^jobs:/.test(line)) { inJobs = true; continue; }
    if (!inJobs) continue;
    if (/^\S/.test(line)) { inJobs = false; continue; }   // back to a top-level key
    const job = line.match(/^ {2}([A-Za-z_][\w-]*):\s*$/);
    if (job) { cur = { job: job[1], steps: [] }; out.push(cur); continue; }
    if (!cur) continue;
    // `- run: cmd` and the `name:`-first form `  run: cmd` both land here. A
    // block scalar (`run: |`) carries its command on the following lines; those
    // are captured too, because a multi-line step that launches a browser is
    // still a browser step.
    const run = line.match(/^\s+(?:- )?run:\s*(.+)$/);
    if (run && run[1] !== "|" && run[1] !== ">") { cur.steps.push(run[1]); continue; }
    if (run) { cur.steps.push("<block>"); continue; }
    if (/^\s{10,}\S/.test(line) && cur.steps.at(-1) === "<block>") cur.steps.push(line.trim());
  }
  return out;
}

const INSTALLS = /playwright\s+install/;
// What a script has to do to need one. Both forms appear in this repo: a bare
// dynamic import, and the createRequire() resolution against the TEMPLATE's
// package.json (playwright is the template's devDependency, not the root's).
const LAUNCHES = /chromium\.launch\s*\(/;

/**
 * The `on.push.paths` list, or null when the workflow has no path filter.
 *
 * Line-by-line rather than one regex over the block, and this is not tidiness:
 * the obvious `/paths:\n((?:\s+- .+\n)+)/` stops at the first line that is not
 * a list item, and these files EXPLAIN their entries — neon-e2e has a
 * three-line comment in the middle of its list. That regex read four of its
 * seven globs and reported the other three as unmatched, which is a guard
 * failing on correct config. Comments and blank lines continue the block.
 */
function pathFilterOf(src) {
  const lines = src.split("\n");
  const i = lines.findIndex((l) => /^\s*paths:\s*$/.test(l));
  if (i === -1) return null;
  const out = [];
  for (const line of lines.slice(i + 1)) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const item = line.match(/^\s+- (.+)$/);
    if (!item) break;
    out.push(item[1].replace(/['"]/g, "").trim());
  }
  return out;
}

const workflows = fs.readdirSync(DIR).filter((f) => /\.ya?ml$/.test(f))
  .map((f) => ({ file: f, jobs: jobsOf(fs.readFileSync(path.join(DIR, f), "utf8")) }));

/** Every `node <script>` a step runs, paired with the step's index. */
function scriptsIn(steps) {
  const out = [];
  steps.forEach((cmd, i) => {
    for (const m of cmd.matchAll(/node\s+(?:--\S+\s+)*["']?((?:test|builder|scripts)\/[\w./-]+\.mjs)["']?/g)) {
      out.push({ script: m[1], at: i });
    }
  });
  return out;
}

test("the workflows parse into jobs with steps at all", () => {
  // Without this the whole file passes vacuously on a parser that returns
  // nothing — the most reassuring possible way to check nothing.
  assert.ok(workflows.length >= 10, `found ${workflows.length} workflows`);
  const withSteps = workflows.filter((w) => w.jobs.some((j) => j.steps.length));
  assert.equal(withSteps.length, workflows.length,
    "some workflow parsed to zero steps: " +
    workflows.filter((w) => !w.jobs.some((j) => j.steps.length)).map((w) => w.file).join(", "));
});

test("something in this repo actually launches a browser", () => {
  // The other half of not passing for the wrong reason. If no script matches
  // LAUNCHES — a renamed API, a moved harness — the ordering test below has
  // nothing to check and reports success.
  const harnesses = fs.readdirSync("test/integration")
    .filter((f) => f.endsWith(".mjs"))
    .filter((f) => LAUNCHES.test(fs.readFileSync(path.join("test/integration", f), "utf8")));
  assert.ok(harnesses.length >= 3, `only ${harnesses.length} browser harnesses found — has the launch call been renamed?`);
});

test("every step that launches a browser runs after one that installs it", () => {
  let checked = 0;
  for (const { file, jobs } of workflows) {
    for (const { job, steps } of jobs) {
      const installAt = steps.findIndex((s) => INSTALLS.test(s));
      for (const { script, at } of scriptsIn(steps)) {
        if (!fs.existsSync(script)) continue;                 // a workflow may run a script from another ref
        if (!LAUNCHES.test(fs.readFileSync(script, "utf8"))) continue;
        checked++;
        assert.ok(installAt !== -1,
          `${file}:${job} runs ${script}, which launches a browser, and never installs one`);
        assert.ok(installAt < at,
          `${file}:${job} runs ${script} at step ${at} but installs the browser at step ${installAt} — ` +
          "it will pass in this container, where /opt/pw-browsers is pre-populated, and fail on a runner");
      }
    }
  }
  assert.ok(checked >= 3, `only ${checked} browser steps were checked across every workflow`);
});

test("site build installs the browser before both of its browser steps", () => {
  // The specific regression, pinned by name. The derived test above is the
  // general rule; this one fails with the name of the file that broke.
  const steps = jobsOf(fs.readFileSync(path.join(DIR, "site-build.yml"), "utf8"))[0].steps;
  const installAt = steps.findIndex((s) => INSTALLS.test(s));
  const render = steps.findIndex((s) => /theme-render\.mjs/.test(s));
  const runtime = steps.findIndex((s) => /site-runtime\.mjs/.test(s));
  assert.ok(installAt !== -1 && render !== -1 && runtime !== -1,
    `install ${installAt}, theme-render ${render}, site-runtime ${runtime} — a step went missing`);
  assert.ok(installAt < render, "theme-render runs before the browser is installed");
  assert.ok(installAt < runtime, "site-runtime runs before the browser is installed");
});

test("a workflow triggers on changes to the scripts it runs", () => {
  // The other way this goes quiet: a harness whose own workflow never fires
  // when it changes. `site-build.yml` ran theme-seam and theme-render while its
  // path filter named neither, so editing one of them proved nothing until an
  // unrelated push happened to run it.
  for (const { file, jobs } of workflows) {
    const globs = pathFilterOf(fs.readFileSync(path.join(DIR, file), "utf8"));
    if (!globs) continue;                                    // no path filter — runs on everything it is asked to
    const covers = (p) => globs.some((g) => g === p || (g.endsWith("/**") && p.startsWith(g.slice(0, -2))));
    for (const { steps } of jobs) {
      for (const { script } of scriptsIn(steps)) {
        if (!fs.existsSync(script)) continue;
        assert.ok(covers(script),
          `${file} runs ${script} and its path filter does not match it — a change to that script runs nothing`);
      }
    }
  }
});
