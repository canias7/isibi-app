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
  CONTAINER_EDIT_JOB_MS, CONTAINER_EDIT_BUDGET_MS,
  jobRunnerOn, jobRunnerFor, jobRunnerEveryone, readCanaryList,
} from "../builder/edit-job.mjs";
import { BUILD_BUDGET_MS, CONTAINER_BUILD_BUDGET_MS } from "../builder/build-budget.mjs";
import { BUILD_JOB_MS } from "../builder/build-job.mjs";

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
  // AND `startedAt` IS ASSERTED AS A MEMBER OF THE SIGNATURE, never as its last
  // element: it WAS last until this change put `budgetMs` after it, so the old
  // spelling `startedAt = 0 } = {})` reported the delivery's clock as gone from
  // a signature that still carries it. The recorded "pinning a list by its last
  // element" trap, met on this line.
  assert.match(edit, /startedAt = 0\s*[,}]/, "the edit consumer does not take the delivery's clock");
  // RE-ANCHORED 2026-09-14: the want stopped being the literal `EDIT_JOB_MS`
  // and became the caller's cap — null on a Worker delivery, the container's
  // own on a runner's — so this line read `inlineBudgetMs(startedAt,
  // EDIT_JOB_MS)` and now reads `(startedAt, capMs)`. THE PROPERTY IS
  // UNCHANGED and is what is asserted: whatever the cap, it is bounded by what
  // this invocation has left, BEFORE the budget is built from it. The default
  // is `inlineBudgetMs`'s own (driven above), not a second copy here — which
  // is why no `EDIT_JOB_MS` literal is wanted at this line any more.
  const capped = at(edit, "const budgetMs = inlineBudgetMs(startedAt, capMs);", "the edit's cap");
  const used = at(edit, "budget: makeEditBudget(budgetMs)", "the edit's budget");
  assert.ok(capped < used, "the budget is built before it is capped");
  assert.ok(!/makeEditBudget\(EDIT_JOB_MS\)/.test(edit), "the edit consumer still builds a budget the invocation cannot hold");
  assert.ok(!/makeEditBudget\(capMs\)|makeEditBudget\(CONTAINER_EDIT_BUDGET_MS\)/.test(edit),
    "the container's cap reaches the budget without passing the ceiling — a Worker delivery carrying one would outlive its isolate");
  // AND THE FALLBACK HAS ONE HOME. `capMs || EDIT_JOB_MS` at the consumer is a
  // second copy of `inlineBudgetMs`'s own first line; the log's comparison asks
  // the same function with no clock instead. (`runQueuedSiteBuild`'s `||` is a
  // DIFFERENT default this function cannot know, and is asserted below.)
  assert.ok(!/capMs\s*(\|\||\?\?)\s*EDIT_JOB_MS/.test(edit), "the edit consumer keeps its own copy of inlineBudgetMs's fallback");
  assert.match(edit, /const wantMs = inlineBudgetMs\(0, capMs\);/, "the log has nothing to compare against, or compares against a second copy of the default");

  const build = between(src, "async function runQueuedSiteBuild(env, ctx, id, {", "\n/**", "runQueuedSiteBuild");
  assert.match(build, /startedAt = 0\s*[,}]/, "the build consumer does not take the delivery's clock");
  assert.match(build, /makeBudget\(inlineBudgetMs\(startedAt, budgetMs \|\| BUILD_BUDGET_MS\)/,
    "the build's budget is not bounded by what the invocation has left");

  // AND THE CONTAINER'S DISPATCH MUST NOT CARRY IT. Inside the site's
  // container there is no fifteen-minute invocation — the launch's deadline
  // (stage 5d) is the outer bound — so a `startedAt` there would cut every
  // container build from NO LIMIT AT ALL down to whatever is left of a
  // Worker's clock that does not exist. (This read "from twenty-seven minutes"
  // until 2026-09-14, which was true for one commit: the first answer to run
  // 44 sized a stopwatch here, and the owner deleted it the same day.)
  const dispatch = between(src, "export async function runContainerJob(env, ctx, {", "\n/** The gateway's signing key", "runContainerJob");
  assert.ok(/CONTAINER_BUILD_BUDGET_MS/.test(dispatch), "the container's own budget left the dispatch");
  // AND SINCE 2026-09-14 THE EDIT HAS ONE TOO. This dispatch passed the build a
  // container budget and the edit nothing at all from the day builds moved
  // across (stage 5b), so an edit in the container fell back to the fourteen
  // minutes sized for a Worker isolate — the recorded "a rule true because of a
  // layer below it expires when that layer moves", in the money path. It cost
  // run 44 (2026-09-14) a published addon at 12m22s with thirteen minutes of
  // room it could not see.
  assert.ok(/CONTAINER_EDIT_BUDGET_MS/.test(dispatch), "an edit in the container runs on a Worker isolate's clock");
  assert.ok(!/startedAt/.test(dispatch), "the container's job was handed a Worker invocation's clock");
});

// ── THE EDIT'S CONTAINER CLOCK (2026-09-14) ─────────────────────────────────
//
// Owner, on being told an addon had stopped at fourteen minutes: "addon, edit
// and build gotta run on the container, just like the build path." Builds got a
// pair of their own when they moved (stage 5b) and edits did not, so this is
// that pair, and the cases below are what keeps it from being either number by
// accident.

test("the container's work is on NO clock, and the two kinds agree about that and about the deadline that remains", () => {
  // INVERTED 2026-09-14, the day after it was written, and the inversion is the
  // point rather than a correction of a slip. This case asserted that the
  // container's budget was a NUMBER — bigger than the Worker's, smaller than
  // the deadline, with a stated gap — which was this repository sizing a
  // stopwatch for a place that has none. Owner: *"Containers shouldn't have a
  // time limit."*
  assert.equal(CONTAINER_EDIT_BUDGET_MS, Infinity, "the container's edit budget is a stopwatch again");
  assert.equal(CONTAINER_EDIT_BUDGET_MS, CONTAINER_BUILD_BUDGET_MS, "the two kinds' work budgets disagree inside one container");
  assert.equal(CONTAINER_EDIT_JOB_MS, BUILD_JOB_MS, "the two kinds' outer clocks disagree — one of them is wrong about how long a container may hold a job");
  // AND THE UNBOUNDED BUDGET IS ONLY SAFE BECAUSE OF WHAT STAYS BOUNDED.
  // `expired()` never fires now, so the thing that ends a wedged job is the
  // DEADLINE, which reaches the child as a SIGTERM one kill-grace past it — and
  // that SIGTERM is only deliverable while the container is still held. The
  // ordering is asserted in build-runner beside `MAX_BUSY_HOLD_MS`; what
  // matters here is that the deadline is a real finite number and did not go
  // infinite with the budget.
  assert.ok(Number.isFinite(CONTAINER_EDIT_JOB_MS) && CONTAINER_EDIT_JOB_MS > 0,
    "the outer bound went infinite with the work budget — nothing then ends a job that is alive and never finishing, and it holds its site's lease for ever");
  // WORTH HAVING: a deadline at or under the Worker's whole clock would make
  // the container pointless, which is the state this pair was found in.
  assert.ok(CONTAINER_EDIT_JOB_MS > EDIT_JOB_MS, "the container's deadline is not longer than the Worker's own clock — running there buys nothing");
  assert.ok(CONTAINER_EDIT_JOB_MS > CONSUMER_CEILING_MS, "the container's deadline fits inside a Worker isolate, so the two numbers say the same thing");
  // AND THE RESERVES ARE STILL REAL NUMBERS. They stop being load-bearing
  // against an infinite total — nothing is ever running out — but a caller that
  // reads them arithmetically must not meet a NaN.
  assert.ok(Number.isFinite(TERMINAL_RESERVE_MS) && TERMINAL_RESERVE_MS > 0);
});

test("inlineBudgetMs over the edit's container cap: unclamped where there is no invocation, clamped where there is", () => {
  // THE SEAM THE WHOLE CHANGE RESTS ON, driven rather than reasoned. The
  // container's runtime hands in no clock, so the cap arrives whole; a Worker
  // delivery hands in a real one, so the same cap is cut to what the isolate
  // has left. Both halves matter: the first is the feature, the second is the
  // wall under it.
  assert.equal(inlineBudgetMs(0, CONTAINER_EDIT_BUDGET_MS, NOW), CONTAINER_EDIT_BUDGET_MS, "the container's edit clock was cut by a ceiling it does not live under");
  assert.equal(inlineBudgetMs(NOW, CONTAINER_EDIT_BUDGET_MS, NOW), CONSUMER_CEILING_MS - TERMINAL_RESERVE_MS, "a Worker delivery handed the container's cap kept it, and would be evicted mid-publish");
  assert.equal(inlineBudgetMs(NOW - JOB_FIRE_MS, CONTAINER_EDIT_BUDGET_MS, NOW), CONSUMER_CEILING_MS - TERMINAL_RESERVE_MS - JOB_FIRE_MS);
  // AND THE WORKER'S OWN PATH IS BYTE FOR BYTE WHAT IT WAS. `capMs` is null
  // there, and null is not a finite want, so the function's own fallback
  // answers `EDIT_JOB_MS` exactly as the deleted literal did.
  assert.equal(inlineBudgetMs(0, null, NOW), EDIT_JOB_MS, "a Worker delivery no longer gets the edit job's own clock");
  assert.equal(inlineBudgetMs(NOW, null, NOW), EDIT_JOB_MS);
  assert.equal(inlineBudgetMs(NOW - JOB_FIRE_MS, null, NOW), inlineBudgetMs(NOW - JOB_FIRE_MS, EDIT_JOB_MS, NOW), "the null cap and the old literal disagree about a delivery that waited");
});

test("THE BUDGET BLOCK, EVALUATED THROUGH THE CONSUMER'S OWN SIGNATURE: what each caller hands in is the total makeEditBudget is built with", () => {
  // A TEXT READ CERTIFIES AT THE LAYER BELOW THE BREAK — this repo's own most
  // repeated finding — so the consumer's own lines are CARRIED OUT and RUN with
  // the real `inlineBudgetMs`, and what `makeEditBudget` was handed is read off
  // the call. That is the hop no assertion about spelling can prove: a cap
  // computed and not forwarded is this repository's commonest defect.
  //
  // AND THE CARRY STARTS AT THE SIGNATURE'S OWN DESTRUCTURING, not below it —
  // the first draft of this case handed `capMs` in as a PARAMETER, so the
  // destructure was outside everything it drove and a sweep mutant that simply
  // stopped reading `budgetMs` off the options SURVIVED: the caller forwarded
  // it, the receiver ignored it, every landmark stayed where a text read looks
  // for it, and the container silently went back to fourteen minutes. That is
  // run 44's defect wearing a different hop, so the options object the real
  // dispatch builds is what goes in now, and the parameter NAME is part of what
  // is driven.
  const src = noComments(WORKER);
  const edit = between(src, "async function runQueuedSiteEdit(env, ctx, id, {", "\n/**\n * RUN ONE JOB IN THIS PROCESS", "runQueuedSiteEdit");
  // DEPTH-AWARE, because a flat `\{[^)]*\}` is greedy to the wrong brace: the
  // signature ends `} = {}) {`, so a flat read captures the empty default too.
  const head = edit.slice(0, edit.indexOf("\n"));
  const open = head.indexOf("{");
  assert.ok(open > 0, "the consumer takes no options object at all");
  let depth = 0, close = -1;
  for (let i = open; i < head.length; i++) {
    if (head[i] === "{") depth++;
    else if (head[i] === "}" && --depth === 0) { close = i; break; }
  }
  assert.ok(close > open, "the options object in the signature does not close on its own line");
  const destructure = head.slice(open, close + 1);
  const block = between(edit, "const wantMs = inlineBudgetMs(0, capMs);", "\n    beat = setInterval(", "the budget block");
  assert.ok(/makeEditBudget\(/.test(block) && /makeJobCtx\(/.test(block), "the carried block does not reach the budget");
  const logs = [];
  // `opts` goes through the REAL destructure; nothing below names a parameter
  // the source does not declare, so a dropped or renamed `budgetMs` is a
  // ReferenceError here rather than a silent fallback.
  const run = new Function("opts", "inlineBudgetMs", "makeEditBudget", "makeJobCtx", "console", "id", "env", "owner", "job", "Date", "Math",
    "const " + destructure + " = opts || {};\n" + block + "\nreturn jctx;");
  const totals = [];
  const drive = (opts, now) => {
    logs.length = 0;
    return run(opts, (a, b) => inlineBudgetMs(a, b, now), (total) => { totals.push(total); return { total }; },
      (_e, o) => o, { log: (...a) => logs.push(a.join(" ")) }, "e_x", {}, "c_x", { uid: "u", slug: "s" },
      { now: () => now }, Math);
  };
  // THE CONTAINER'S CALLER, spelled exactly as `runContainerJob` spells it: the
  // cap arrives whole at `makeEditBudget`.
  const inContainer = drive({ takeOver: "c_x", budgetMs: CONTAINER_EDIT_BUDGET_MS }, NOW);
  assert.equal(inContainer.budget.total, CONTAINER_EDIT_BUDGET_MS, "the container's cap did not reach the budget it was handed in for");
  assert.equal(logs.length, 0, "an uncut budget said it was cut");
  // THE WORKER'S CALLER, spelled as the queue handler spells it: no cap, so the
  // function's own default, unchanged.
  const inWorker = drive({ lease: "c_y", claim: null, startedAt: NOW }, NOW);
  assert.equal(inWorker.budget.total, EDIT_JOB_MS, "a Worker delivery no longer builds the edit job's own budget");
  assert.equal(logs.length, 0);
  // A Worker delivery that waited out the fire: cut, and SAID. The sentence is
  // the only sign of the cap biting, so a silent cut is a real loss.
  const waited = drive({ lease: "c_y", startedAt: NOW - JOB_FIRE_MS }, NOW);
  assert.equal(waited.budget.total, CONSUMER_CEILING_MS - TERMINAL_RESERVE_MS - JOB_FIRE_MS);
  assert.equal(logs.length, 1, "a budget cut by the ceiling was cut in silence");
  assert.match(logs[0], /inline budget cut to/);
  // AND THE TOTALS REALLY DIFFER, which is what makes every line above a
  // measurement rather than a description of one.
  assert.ok(totals[0] > totals[1], "the container's caller and the Worker's build the same budget: " + totals.join(" vs "));
});

// ── what the flip is, and that it is one value ──────────────────────────────

test("the broad flag is on in the deploy and reaches every identity", () => {
  // THE STATEMENT THIS STAGE MAKES, as properties rather than prose: the flip
  // is one value and it needs no code change. INVERTED 2026-09-14 — it was
  // "off until somebody sets it", and the owner set it ("addon, edit and build
  // gotta run on the container, just like the build path"), so holding the
  // deploy to the un-flipped state would pin a rollout that has happened.
  // `test/container-job.test.mjs` carries the full history of this default and
  // drives the consumer firing under the broad word.
  const everyone = /JOB_RUNNER_EVERYONE: \$\{\{ secrets\.JOB_RUNNER_EVERYONE \|\| '([^']*)' \}\}/.exec(YML);
  assert.ok(everyone, "the deploy does not carry the broad flag");
  assert.equal(jobRunnerEveryone({ JOB_RUNNER_EVERYONE: everyone[1] }), true, "the shipped default no longer runs every site's jobs in its own container");
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
