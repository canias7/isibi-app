// Audit group g3 (2026-10-22): A04-3 (a held job on a new function that failed
// is not registered at Publish) and A06-5 (page writers see the draft's held
// tables). S6-2 and A01-5 were already fixed (reply-held-draft, site-placeholder).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deadNewFunctions, jobsWithoutDead } from "../site-draft.mjs";

const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
/** The source between two landmarks, both asserted present first. */
function between(a, b, from = 0) {
  const i = src.indexOf(a, from);
  assert.ok(i >= 0, "landmark missing: " + a);
  const k = src.indexOf(b, i + a.length);
  assert.ok(k > i, "landmark missing: " + b);
  return src.slice(i, k);
}

test("A04-3: only a function the site did not already have counts as dead", () => {
  const errs = [{ name: "Remind", error: "syntax" }, { name: "old_fn", error: "x" }];
  assert.deepEqual(deadNewFunctions(errs, ["old_fn"]), ["remind"]);
  assert.deepEqual(deadNewFunctions(errs, null), [], "an unknown prior takes no job off");
  assert.deepEqual(deadNewFunctions(undefined, []), []);
  assert.deepEqual(deadNewFunctions([], []), []);
});

test("A04-3: jobs on a dead function are split out, the rest kept", () => {
  const jobs = [{ name: "nudge", fn: "REMIND" }, { name: "tidy", fn: "old_fn" }];
  const r = jobsWithoutDead(jobs, ["remind"]);
  assert.deepEqual(r.jobs.map((j) => j.name), ["tidy"]);
  assert.deepEqual(r.blocked, [{ name: "nudge", fn: "REMIND" }]);
  assert.deepEqual(jobsWithoutDead(jobs, undefined).jobs.length, 2);
  assert.deepEqual(jobsWithoutDead(undefined, ["remind"]), { jobs: [], blocked: [] });
});

test("A04-3: the publication's schema step keeps the dead functions, and its jobs step leaves their jobs out, told", () => {
  const schema = between('if (!did("schema")) {', 'if (!did("jobs")) {');
  assert.match(schema, /const made = await live\.applySiteSchema\(/);
  assert.match(schema, /deadNewFunctions\(made && made\.functionErrors, prior\)/);
  assert.match(schema, /mark\("schema", dead\.length \? \{ deadFns: dead \} : \{\}\)/);
  const jobs = between('if (!did("jobs")) {', 'if (!did("seeds")) {');
  assert.match(jobs, /jobsWithoutDead\(plan\.jobs, j\.deadFns\)/);
  assert.match(jobs, /skipped\.push\(\{ stage: "jobs"/);
  assert.match(jobs, /persistSiteJobs\(env, j\.uid, slug, sorted\.jobs\)/);
  assert.doesNotMatch(jobs, /persistSiteJobs\(env, j\.uid, slug, plan\.jobs\)/);
});

test("A06-5: the Edit page rung overlays the draft's held changes on its schema before the writer", () => {
  const rung = between('if (!eSpec) return explain("page/spec-unreadable", {}, { backend: "spec-missing" });', "const eModels = modelsFor(");
  assert.match(rung, /eView = await draftView\(env, ownerSlug\)/);
  assert.match(rung, /eSpec = specOverlay\(eSpec, eView\.ops\)/);
  assert.match(rung, /backend: "draft"/, "an unreadable draft stops");
});

test("A06-5: a held revise writes its pages against the draft's schema", () => {
  const rev = between("let pageSpec = spec;", "pageSpec = withStoredSpec(spec, read.spec);");
  assert.match(rev, /bWriter\.holding/);
  assert.match(rev, /await draftView\(env, slug\)/);
  assert.match(rev, /specOverlay\(read\.spec, view\.ops\)/);
  assert.match(rev, /read = \{ ok: false, why: "draft-unreadable" \}/);
});
