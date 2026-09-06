// STAGE 5e (2026-09-06): THE BROAD ROLLOUT OF THE JOB RUNNER.
//
// The flip itself is one value — `JOB_RUNNER_EVERYONE` — and its two doors,
// its readings and the consumer firing under it were built and driven with the
// runner (task #93); `test/container-job.test.mjs` holds the shipped defaults
// and drives the fork under the broad word. What this stage adds is the ONE
// thing the flip makes reachable, and this file is its guard:
//
//   with one canary site the account is never full because of us; with every
//   site's jobs going through the fire, they share the account's container
//   ceiling — and a fire that meets no room WAITS (JOB_FIRE_MS, 90s) before
//   the consumer falls back to running the job itself. Ninety seconds plus a
//   fresh 840s budget is 930 against a platform ceiling of 900: the job would
//   be evicted with half a minute still on its clock, running no catch and no
//   finally. So the inline fallback's budget is what the invocation has LEFT.
//
// The elapsed cannot be driven end to end without a real 45-second wait (that
// is where the cap begins to bite), so the decision is driven as a function
// and the two call sites are read by landmark, with the container's own
// dispatch asserted NOT to carry it.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  inlineBudgetMs, CONSUMER_CEILING_MS, EDIT_JOB_MS, TERMINAL_RESERVE_MS, JOB_FIRE_MS,
  jobRunnerOn, jobRunnerFor, jobRunnerEveryone, readCanaryList,
} from "../builder/edit-job.mjs";
import { BUILD_BUDGET_MS, CONTAINER_BUILD_BUDGET_MS } from "../builder/build-budget.mjs";

const ROOT = new URL("..", import.meta.url);
const WORKER = readFileSync(new URL("worker.js", ROOT), "utf8");
const YML = readFileSync(new URL(".github/workflows/deploy.yml", ROOT), "utf8");
const noComments = (s) => s.replace(/^(\s*)\/\/.*$/gm, (m) => " ".repeat(m.length));
const at = (src, needle, what) => { const i = src.indexOf(needle); assert.ok(i >= 0, (what || needle) + " not found"); return i; };
// LANDMARK TO LANDMARK, and the closing one is looked for AFTER the opening —
// `indexOf(to)` from the top of the file answers a landmark that sits BEFORE
// the window and yields the empty string, which passes every assertion inside
// it (the recorded vacuous-window trap; its first draft here had exactly that).
const between = (src, from, to, what) => {
  const a = at(src, from, what + " (start)");
  const b = src.indexOf(to, a + from.length);
  assert.ok(b > a, what + " (end) not found after its start");
  return src.slice(a, b);
};

const NOW = 1_800_000_000_000;

// ── the finding, as arithmetic ──────────────────────────────────────────────

test("the fire's wait does not fit above the job's budget — which is why the cap exists", () => {
  // The room between the budget and the ceiling is the isolate's teardown, and
  // `EDIT_JOB_MS`'s own comment names it as sixty seconds. The fire may spend
  // ninety waiting for container room before the budget is even built.
  const room = CONSUMER_CEILING_MS - EDIT_JOB_MS;
  assert.ok(room > 0, "the job's budget already outruns the platform's ceiling");
  assert.ok(JOB_FIRE_MS > room,
    "the fire's wait now fits above the budget (" + JOB_FIRE_MS + " <= " + room + ") — say so where the cap is explained, and keep the cap: it is what makes the two numbers independent");
  // And what the cap answers for exactly that shape: the job's clock, the wait
  // it followed and the terminal writes all fit inside one invocation.
  const capped = inlineBudgetMs(NOW - JOB_FIRE_MS, EDIT_JOB_MS, NOW);
  assert.ok(capped + JOB_FIRE_MS + TERMINAL_RESERVE_MS <= CONSUMER_CEILING_MS,
    "a job that waited the whole fire window still outlives its isolate: " + capped);
});

test("inlineBudgetMs: what it wants, what is left, and never a number the budget reads as absent", () => {
  // NOTHING SPENT — the flags off, no binding, a refusal: the fire returns at
  // once and the job gets exactly what it asks for.
  assert.equal(inlineBudgetMs(NOW, EDIT_JOB_MS, NOW), EDIT_JOB_MS);
  assert.equal(inlineBudgetMs(NOW - 900, EDIT_JOB_MS, NOW), EDIT_JOB_MS, "a second of claim must not shorten a job");
  // The headroom is real: up to `CONSUMER_CEILING_MS - TERMINAL_RESERVE_MS -
  // EDIT_JOB_MS` may be spent before the cap bites at all.
  const slack = CONSUMER_CEILING_MS - TERMINAL_RESERVE_MS - EDIT_JOB_MS;
  assert.ok(slack > 0 && slack < 60_000, "the headroom is not what the numbers say: " + slack);
  assert.equal(inlineBudgetMs(NOW - slack, EDIT_JOB_MS, NOW), EDIT_JOB_MS, "the cap bit inside the headroom");
  assert.equal(inlineBudgetMs(NOW - slack - 1000, EDIT_JOB_MS, NOW), EDIT_JOB_MS - 1000, "the cap did not follow the elapsed");
  // A whole fire window spent: the job runs on what is left, not on a clock
  // that outlives the isolate.
  assert.equal(inlineBudgetMs(NOW - JOB_FIRE_MS, EDIT_JOB_MS, NOW), CONSUMER_CEILING_MS - TERMINAL_RESERVE_MS - JOB_FIRE_MS);
  // NOTHING LEFT AT ALL is a positive number, because `makeEditBudget` reads a
  // non-positive total as "use the default" — which is the 840s this refuses.
  assert.equal(inlineBudgetMs(NOW - CONSUMER_CEILING_MS, EDIT_JOB_MS, NOW), 1000);
  assert.equal(inlineBudgetMs(NOW - CONSUMER_CEILING_MS * 4, EDIT_JOB_MS, NOW), 1000);
  // A clock that is not one (the container's runtime, a driver) means no
  // invocation to fit inside.
  for (const absent of [0, undefined, null, NaN, -1, "1800000000000", ["x"]]) {
    assert.equal(inlineBudgetMs(absent, EDIT_JOB_MS, NOW), EDIT_JOB_MS, "a startedAt of " + JSON.stringify(absent) + " capped a job");
  }
  // The want is honoured whatever it is — the build's own budget, the
  // container's longer one — and a junk want falls back rather than becoming
  // one.
  assert.equal(inlineBudgetMs(NOW, BUILD_BUDGET_MS, NOW), BUILD_BUDGET_MS);
  assert.equal(inlineBudgetMs(0, CONTAINER_BUILD_BUDGET_MS, NOW), CONTAINER_BUILD_BUDGET_MS, "the container's longer clock was cut by a ceiling it does not live under");
  for (const junk of [0, -5, undefined, "840000", {}]) assert.equal(inlineBudgetMs(0, junk, NOW), EDIT_JOB_MS);
  // A CLOCK AHEAD OF US IS NOT EXTRA TIME. Read with a want the ceiling
  // actually binds: against `EDIT_JOB_MS` the want wins either way and the
  // clamp is invisible — a case that describes the branch without driving it
  // (the sweep's M5 survived on exactly that, 2026-09-06). The container's
  // longer want is above what any invocation has left, so the clamp decides.
  assert.equal(inlineBudgetMs(NOW + 60_000, CONTAINER_BUILD_BUDGET_MS, NOW), CONSUMER_CEILING_MS - TERMINAL_RESERVE_MS,
    "a startedAt in the future bought time this invocation does not have");
  assert.equal(inlineBudgetMs(NOW + 60_000, EDIT_JOB_MS, NOW), EDIT_JOB_MS);
});

// ── the wiring ──────────────────────────────────────────────────────────────

test("the queue handler takes this delivery's own clock and hands it to both inline paths", () => {
  const src = noComments(WORKER);
  const handler = between(src, "async queue(batch, env, ctx) {", "async function runDomainWatch(", "the queue handler");
  assert.ok(handler.length > 1000, "the queue handler moved");
  // PER MESSAGE, not per batch: a batch of two runs them one after the other.
  const loop = handler.indexOf("for (const message of batch.messages) {");
  const clock = handler.indexOf("const deliveredAt = Date.now();");
  assert.ok(loop >= 0 && clock > loop, "the delivery's clock is not taken inside the message loop");
  assert.ok(handler.indexOf("try {", loop) > clock, "the clock is taken after the work has begun");
  // BOTH PATHS THAT FIRE carry it. The resume path never fires and is left
  // alone; the container's runtime is asserted below.
  assert.match(handler, /runQueuedSiteEdit\(env, ctx, edit\.id, \{[^}]*startedAt: deliveredAt \}\)/,
    "the inline edit runs on a fresh budget after the fire's wait");
  assert.match(handler, /runQueuedSiteBuild\(env, ctx, msg\.id, \{[^}]*startedAt: deliveredAt \}\)/,
    "the inline build runs on a fresh budget after the fire's wait");
});

test("each consumer's budget is what the invocation has left, and the container's is not", () => {
  const src = noComments(WORKER);
  const edit = between(src, "async function runQueuedSiteEdit(env, ctx, id, {", "\n/**\n * RUN ONE JOB IN THIS PROCESS", "runQueuedSiteEdit");
  assert.match(edit, /startedAt = 0 \} = \{\}\)/, "the edit consumer does not take the delivery's clock");
  const capped = at(edit, "const budgetMs = inlineBudgetMs(startedAt, EDIT_JOB_MS);", "the edit's cap");
  const used = at(edit, "budget: makeEditBudget(budgetMs)", "the edit's budget");
  assert.ok(capped < used, "the budget is built before it is capped");
  assert.ok(!/makeEditBudget\(EDIT_JOB_MS\)/.test(edit), "the edit consumer still builds a budget the invocation cannot hold");

  const build = between(src, "async function runQueuedSiteBuild(env, ctx, id, {", "\n/**", "runQueuedSiteBuild");
  assert.match(build, /startedAt = 0 \} = \{\}\)/, "the build consumer does not take the delivery's clock");
  assert.match(build, /makeBudget\(inlineBudgetMs\(startedAt, budgetMs \|\| BUILD_BUDGET_MS\)/,
    "the build's budget is not bounded by what the invocation has left");

  // AND THE CONTAINER'S DISPATCH MUST NOT CARRY IT. Inside the site's
  // container there is no fifteen-minute invocation — the launch's deadline
  // (stage 5d) is the ceiling — so a `startedAt` there would cut every
  // container build from twenty-seven minutes to whatever is left of a
  // Worker's clock that does not exist.
  const dispatch = between(src, "export async function runContainerJob(env, ctx, {", "\n/** The gateway's signing key", "runContainerJob");
  assert.ok(/CONTAINER_BUILD_BUDGET_MS/.test(dispatch), "the container's own budget left the dispatch");
  assert.ok(!/startedAt/.test(dispatch), "the container's job was handed a Worker invocation's clock");
});

// ── what the flip is, and that it is one value ──────────────────────────────

test("the broad flag is off in the deploy and reaches every identity when it is on", () => {
  // THE STATEMENT THIS STAGE MAKES, as properties rather than prose: the flip
  // is one value, it needs no code change, and it is off until somebody sets
  // it. `test/container-job.test.mjs` holds the canary's own default to one
  // site and drives the consumer firing under the broad word.
  const everyone = /JOB_RUNNER_EVERYONE: \$\{\{ secrets\.JOB_RUNNER_EVERYONE \|\| '([^']*)' \}\}/.exec(YML);
  assert.ok(everyone, "the deploy does not carry the broad flag");
  assert.equal(jobRunnerEveryone({ JOB_RUNNER_EVERYONE: everyone[1] }), false, "the shipped default turns the runner on for everyone");
  // On, it reaches an account and a site the canary never names — and the
  // canary is not needed beside it.
  for (const on of ["on", "1", "true", "yes"]) {
    assert.equal(jobRunnerOn({ JOB_RUNNER_EVERYONE: on }), true);
    assert.equal(jobRunnerFor({ JOB_RUNNER_EVERYONE: on }, { uid: "", slug: "any-site-99" }), true);
    assert.equal(jobRunnerFor({ JOB_RUNNER_EVERYONE: on }, { uid: "11111111-2222-3333-4444-555555555555", slug: "" }), true);
  }
  // OFF AGAIN IS THE SAME ONE VALUE, and the canary keeps whatever it names —
  // the rollback is a secret and a deploy, never a revert.
  const canary = /JOB_RUNNER_CANARY: \$\{\{ secrets\.JOB_RUNNER_CANARY \|\| '([^']*)' \}\}/.exec(YML);
  assert.ok(canary, "the deploy does not carry the canary");
  const named = readCanaryList(canary[1]);
  const off = { JOB_RUNNER_CANARY: canary[1], JOB_RUNNER_EVERYONE: "off" };
  assert.equal(jobRunnerFor(off, { uid: "x", slug: "any-site-99" }), false, "turning the broad flag off left another site on the runner");
  if (named.length) assert.equal(jobRunnerFor(off, { uid: "x", slug: named[0] }), true, "turning the broad flag off also turned the canary off");
});
