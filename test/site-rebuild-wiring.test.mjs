// The rebuild queue is only worth having if it is REACHED.
//
// This repo has recorded twelve features that were correct, tested, and wired to
// nothing — `xaiSkipped`, `langUsage`, `siteRedirectFor`, `notifyOwnerOfSubmission`
// and the rest. Every one of them looked fine from both ends. So the module's own
// 22 tests are half the job; these are the other half, and they read `worker.js`
// because that file is the layer a module test cannot see.
//
// Everything here is asserted as a PROPERTY rather than a spelling. Twelve guards
// went red on correct changes during the last audit round because they pinned an
// argument list or an exact expression.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { BATCH } from "../site-rebuild.mjs";

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

/** The body of a named function, by brace depth — a request init is full of
 *  braces and a flat scan has been written wrong here four times. */
function bodyOf(name) {
  const at = worker.indexOf("async function " + name + "(");
  assert.notEqual(at, -1, name + " is not in worker.js");
  const open = worker.indexOf("{", at);
  let d = 0;
  for (let i = open; i < worker.length; i++) {
    const c = worker[i];
    if (c === "{") d++;
    else if (c === "}") { d--; if (d === 0) return worker.slice(open, i + 1); }
  }
  assert.fail(name + " has no closing brace");
}

test("the cron actually calls it", () => {
  // Without this the queue fills and nothing ever drains it — the shape twelve
  // dead features here had in common.
  const at = worker.indexOf("async scheduled(");
  assert.notEqual(at, -1);
  const sched = worker.slice(at, at + 2000);
  assert.match(sched, /waitUntil\(\s*runSiteRebuild\(/, "the scheduled handler must drive the drain");
});

test("it drains at the module's OWN batch, not a number typed here", () => {
  // The batch is the module's decision (a few per tick since 2026-09-04, each
  // site in its own container lane; it was 1 while the build service was
  // one-at-a-time for the whole platform). A copy of that number in worker.js
  // is a second opinion, and the day the two disagree a bulk rebuild either
  // starves the cron invocation or crawls.
  const body = bodyOf("runSiteRebuild");
  assert.match(body, /limit:\s*REBUILD_BATCH/, "the limit must come from the module");
  assert.doesNotMatch(body, /limit:\s*\d/, "the batch must not be restated as a literal");
  // RE-ANCHORED 2026-09-04: this pinned 1 and its reason; the property is
  // that the number is the module's and is a real, small batch.
  assert.ok(Number.isInteger(BATCH) && BATCH >= 1 && BATCH <= 20, "the module's answer is a small batch — see its own comment for why: " + BATCH);
});

test("every dep drainRebuild uses is supplied", () => {
  // DERIVED FROM THE MODULE, so a sixth dep added there fails here rather than
  // being silently undefined — which in a Worker is a TypeError inside a cron
  // tick that nobody is watching.
  const mod = fs.readFileSync(new URL("../site-rebuild.mjs", import.meta.url), "utf8");
  const needed = [...new Set([...mod.matchAll(/\bdeps\.(\w+)\s*\(/g)].map((m) => m[1]))];
  assert.ok(needed.length >= 5, "the scan found " + needed.length + " deps — it has stopped matching");
  const body = bodyOf("runSiteRebuild");
  for (const dep of needed) {
    assert.match(body, new RegExp("\\b" + dep + ":\\s*async"), "worker.js does not supply deps." + dep);
  }
});

test("`exists` THROWS on an unreadable answer — it never answers false", () => {
  // The dangerous direction, and the whole reason the drain asks instead of
  // reading a message. "Supabase would not answer" read as "the site was
  // deleted" drops a LIVE site from the queue permanently, and nothing anywhere
  // records that it never got the upgrade.
  const body = bodyOf("runSiteRebuild");
  const at = body.indexOf("exists: async");
  assert.notEqual(at, -1);
  const seg = body.slice(at, body.indexOf("rebuild: async"));
  assert.match(seg, /if\s*\(!\s*\w+\.ok\)\s*throw/, "a failed read must throw, not fall through to a boolean");
});

// ── the claim, whose three load-bearing properties live only in worker.js ────
//
// The module's own tests cover the DECISION (a lost claim spends nothing, only
// a literal true wins). None of them can see whether the PATCH that produces
// that boolean is actually atomic — and a claim that always answers true, or
// always false, is worse than no claim at all. All three below were found by
// mutation, not by reading.

const claimBody = () => {
  const body = bodyOf("runSiteRebuild");
  const at = body.indexOf("claim: async");
  assert.notEqual(at, -1, "worker.js supplies no claim");
  const end = body.indexOf("rebuild: async", at);
  assert.ok(end > at, "the claim block could not be bounded");
  return body.slice(at, end);
};

test("the claim's WHERE re-states DUENESS — without it both ticks win", () => {
  // This is the entire atomicity. A PATCH filtered on the slug alone matches for
  // every concurrent tick, so both claim it, both spend a container run, and the
  // guard reads as present while protecting nothing.
  assert.match(claimBody(), /next_try_at=lte\./,
    "the claim must be conditional on the row still being due");
});

test("the claim CHECKS the write succeeded", () => {
  // Supabase in read-only mode reads fine and 5xxs on writes. Unchecked, the
  // claim would answer true on every tick for as long as that lasted — which is
  // the duplicate run continuously rather than occasionally. `runScheduledSiteJobs`
  // had this exact bug and its comment is the rule: a claim that cannot be
  // recorded is a claim lost.
  assert.match(claimBody(), /if \(!\w+\.ok\) return false;/,
    "a failed PATCH must be a LOST claim, not a won one");
});

test("the claim asks for the ROW BACK, or it can never win", () => {
  // The subtlest of the three and the most total: with `return=minimal`
  // PostgREST sends no body, so the answer is always empty, the claim always
  // loses, and THE DRAIN NEVER REBUILDS ANYTHING — a queue that fills and is
  // worked through by nobody, silently, which is the state this whole feature
  // exists to end.
  const seg = claimBody();
  assert.match(seg, /Prefer:\s*["'`]return=representation/, "the claim needs the row back to know it won");
  assert.doesNotMatch(seg, /return=minimal/, "return=minimal makes the claim permanently unwinnable");
});

test("`rebuild` REFUSES without stored source rather than publishing an empty site", () => {
  // Publishing with no pages replaces a working site with one that has no
  // routes — strictly worse than not rebuilding it at all.
  const body = bodyOf("runSiteRebuild");
  const at = body.indexOf("rebuild: async");
  const seg = body.slice(at, body.indexOf("forget: async"));
  assert.match(seg, /loadSiteSource\(/, "it must read the site's own stored source");
  const guard = seg.indexOf("if (!pages)");
  const publish = seg.indexOf("recompileAndPublish(");
  assert.ok(guard !== -1 && guard < publish, "the refusal must come BEFORE the publish");
  assert.match(seg.slice(guard, publish), /ours:\s*true/,
    "a missing source is ours — an R2 blip and a sourceless site are one null here, " +
    "so it must retry rather than park a site whose pages may be fine");
});

test("a rebuild costs no credits — no model call on this path", () => {
  // The property that makes a platform-wide bump affordable at all. A model call
  // here would turn a 14-site sweep into a real bill and a 500-site one into an
  // outage of the ledger.
  const body = bodyOf("runSiteRebuild");
  for (const banned of ["callBuilderModel", "generateSitePages", "anthropicMessages", "designSiteSchema"]) {
    assert.ok(!body.includes(banned), "the rebuild path must not call " + banned);
  }
});

test("the publish is the SHARED spine, not a second copy of it", () => {
  // `recompileAndPublish` was extracted precisely because a second copy of the
  // publish dropped three fields of the published meta. A bulk path with its own
  // copy would do it again, on every site at once.
  assert.match(bodyOf("runSiteRebuild"), /recompileAndPublish\(env,/);
});

test("the version it archives is LABELLED as ours", () => {
  // Every publish archives a version. An unlabelled row in an owner's history
  // reads as a change they made and cannot remember.
  assert.match(bodyOf("runSiteRebuild"), /label:\s*["'`]platform rebuild/);
});

test("nothing in the Worker enqueues — the queue is operator-written", () => {
  // If the platform could queue itself, one bug becomes a self-sustaining
  // republish of every site. Rows come from the operator sweep and nowhere else.
  assert.ok(!/site_rebuild[^\n]*method:\s*["']POST/.test(worker),
    "worker.js must not insert into site_rebuild");
});

test("the operator sweep exists, is dry by default, and does not reset a parked row", () => {
  const script = fs.readFileSync(new URL("../.github/scripts/enqueue-rebuild.mjs", import.meta.url), "utf8");
  const flow = fs.readFileSync(new URL("../.github/workflows/rebuild-all-sites.yml", import.meta.url), "utf8");
  assert.match(flow, /workflow_dispatch/, "manual only — this is an operator action");
  assert.match(flow, /default:\s*false/, "apply must default to false");
  // Re-queuing a stuck site would throw away its attempts and its last_error,
  // which is the only record of WHY it is stuck.
  assert.match(script, /resolution=ignore-duplicates/, "a second sweep must not reset in-flight rows");
});
