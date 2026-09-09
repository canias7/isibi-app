// A MERGE RUNS THE DEPLOY AND NOTHING ELSE.
//
// Owner, 2026-09-09, looking at the list of workflow results on a merge:
// "REMOVE ALL THOSE WORKFLOWS FROM THE MERGE THING, I JUST WANT THE MERGE THING
// TEHRE, THATS IT."
//
// Before that day a push to main started twenty-three workflows: the deploy,
// three bare probes, the unit suite, five smokes chained to the Deploy
// COMPLETING, and thirteen more behind path filters — one of which
// (`edit smoke`) spends about fifty credits. Now it starts one.
//
// WHY THIS IS A CENSUS AND NOT A LIST. The recorded trap is "a hop nobody listed
// is a hop nobody guards": a guard naming today's twenty-two would be a guard
// that says nothing about the twenty-third workflow somebody adds next month
// with `push: branches: [main]` copied off an old one. So this reads the
// DIRECTORY and requires the answer to be exactly one file. A new workflow that
// fires on a merge fails this by existing.
//
// AND THE WHOLE SUITE WAS BLIND TO IT. Twenty-two triggers came off in one
// commit and all 5,722 tests stayed green — nothing anywhere asserted which
// workflows a merge starts. That is why this file exists at all, and it is the
// wiring trap pointed at the CI config rather than at a value on a wire.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { unpark, triggersOf, firesOnPush, chainedTo } from "./fixtures/parked-triggers.mjs";

const DIR = ".github/workflows";
const DEPLOY = "deploy.yml";
const DEPLOY_NAME = "Deploy to Cloudflare";

const FILES = fs.readdirSync(DIR).filter((f) => /\.ya?ml$/.test(f)).sort();
const read = (f) => fs.readFileSync(path.join(DIR, f), "utf8");

// The note the parking wrote. Matched on the sentence rather than the box-drawn
// rule above it, because the rule is decoration and the sentence is the promise.
const PARK_NOTE = "TO PUT IT BACK: uncomment the block.";

test("the reader found the workflows at all", () => {
  // Every assertion below iterates this list, so a directory read that stops
  // matching reports "nothing fires on a merge" — which is the thing being
  // claimed. The floor is what stops this file certifying an empty folder.
  assert.ok(FILES.length >= 30, `only ${FILES.length} workflows found — the directory read broke`);
  const withOn = FILES.filter((f) => triggersOf(read(f)).size > 0);
  assert.deepEqual(withOn, FILES,
    "some workflow parsed to zero triggers, so it is invisible to this census: " +
    FILES.filter((f) => !withOn.includes(f)).join(", "));
});

test("THE CENSUS: exactly one workflow starts on a push to main, and it is the deploy", () => {
  const onMain = FILES.filter((f) => firesOnPush(read(f), "main"));
  assert.deepEqual(onMain, [DEPLOY],
    "a merge starts more than the deploy: " + onMain.join(", "));
});

test("THE CENSUS: nothing is chained to the Deploy completing", () => {
  // The five smokes ran this way — `workflow_run`, which is a second door onto
  // the merge and does not show up in a push-trigger scan at all. Both doors are
  // asked, because closing one of them is what closing "the merge thing" means.
  const chained = FILES.filter((f) => chainedTo(read(f), DEPLOY_NAME));
  assert.deepEqual(chained, [],
    "these run when the deploy finishes, so they are still on the merge: " + chained.join(", "));
});

test("the deploy itself is untouched — it IS the merge thing", () => {
  // The other half, and it is not rhetorical: a change that took main off EVERY
  // trigger would pass both census tests above and ship nothing, ever. The
  // owner asked for one workflow on the merge, not none.
  assert.equal(firesOnPush(read(DEPLOY), "main"), true, "the deploy no longer runs on a merge");
});

test("nothing became unreachable: every parked workflow can still be started by hand", () => {
  // A trigger removed from a workflow with no `workflow_dispatch` is a workflow
  // nobody can ever run — which would make this change a deletion wearing a
  // comment. Asked of the parked ones by name, since they are the ones that
  // lost a door.
  const parked = FILES.filter((f) => read(f).includes(PARK_NOTE));
  assert.ok(parked.length >= 18, `only ${parked.length} parked workflows found`);
  for (const f of parked) {
    assert.ok(triggersOf(read(f)).has("workflow_dispatch"),
      `${f}: its trigger is parked and it has no workflow_dispatch — nothing can start it`);
  }
});

test("a parked trigger really is parked, and really does come back when uncommented", () => {
  // THE RESTORE NOTE HAS TO BE TRUE. "Uncomment the block" is a promise about
  // text nothing executes, so it is the kind of instruction that rots silently:
  // a block re-indented, half-deleted, or parked from the wrong lines reads
  // exactly the same and restores nothing. Driven as a round trip — parked, the
  // workflow is off the merge; un-parked, it is back on it.
  const parked = FILES.filter((f) => read(f).includes(PARK_NOTE));
  let restored = 0;
  for (const f of parked) {
    const src = read(f);
    assert.equal(firesOnPush(src, "main") || chainedTo(src, DEPLOY_NAME), false,
      `${f}: carries a parking note and is still on the merge`);
    const back = unpark(src);
    const live = firesOnPush(back, "main") || chainedTo(back, DEPLOY_NAME);
    assert.ok(live, `${f}: uncommenting its parked block restores no trigger — the note lies`);
    restored++;
  }
  assert.equal(restored, parked.length);
  assert.ok(restored >= 18, `only ${restored} parked blocks round-tripped`);
});

test("the three that run on every branch keep running on every branch but main", () => {
  // `unit tests`, `site build` and `answer read` had no branch filter at all, so
  // taking them off the merge by deleting the trigger would have taken them off
  // the FEATURE BRANCH too — where they are the signal that makes the merge safe
  // to fast-forward. `branches-ignore` is the narrow cut, and this is what says
  // the narrow cut is what was made.
  for (const f of ["unit.yml", "site-build.yml", "answer-read.yml"]) {
    const src = read(f);
    assert.equal(firesOnPush(src, "main"), false, `${f} still runs on a merge`);
    assert.equal(firesOnPush(src, "claude/help-needed-ehlwlj"), true,
      `${f} stopped running on the working branch — the guard that makes a merge safe is gone`);
    assert.match(src, /branches-ignore: \[main\]/, `${f}: main is excluded some other way than the one asserted here`);
  }
});

// ── THE READER, DRIVEN ────────────────────────────────────────────────────────
//
// Every answer above comes out of `firesOnPush` / `chainedTo`, and both are
// hand-written because this repo has no YAML parser at the root. A reader that
// silently stops matching answers "no" for every input, and "no" is exactly the
// result these tests want — so the reader is driven against inputs whose answers
// are known, in BOTH directions. Cross-checked against PyYAML over all 33 real
// workflows the day it was written: no disagreements.
const YES_NO_FILTER = "on:\n  push:\n  workflow_dispatch:\n";
const YES_MAIN = "on:\n  push:\n    branches: [main]\n";
const NO_OTHER_BRANCH = "on:\n  push:\n    branches: [release]\n";
const NO_IGNORED = "on:\n  push:\n    branches-ignore: [main]\n    paths:\n      - 'x.mjs'\n";
const NO_DISPATCH_ONLY = "on:\n  workflow_dispatch:\n";
const NO_PARKED = "on:\n  # TO PUT IT BACK: uncomment the block.\n  #   push:\n  #     branches: [main]\n  workflow_dispatch:\n";
const CHAINED = 'on:\n  workflow_run:\n    workflows: ["Deploy to Cloudflare"]\n    types: [completed]\n';

test("the reader says YES where a workflow really does fire on a merge", () => {
  // The middle case is the one that would invert this whole file: a bare
  // `push:` with no filter fires on EVERY branch, main included. Read as "no
  // filter, so no main", the census would call a repo that runs everything on
  // every merge perfectly clean.
  assert.equal(firesOnPush(YES_NO_FILTER, "main"), true, "a push with no branch filter reads as not-on-main");
  assert.equal(firesOnPush(YES_MAIN, "main"), true, "branches: [main] reads as not-on-main");
  assert.equal(chainedTo(CHAINED, DEPLOY_NAME), true, "a workflow_run on the deploy reads as unchained");
});

test("the reader says NO only where it should", () => {
  assert.equal(firesOnPush(NO_OTHER_BRANCH, "main"), false);
  assert.equal(firesOnPush(NO_OTHER_BRANCH, "release"), true, "the reader answers no for every branch, not just main");
  assert.equal(firesOnPush(NO_IGNORED, "main"), false);
  assert.equal(firesOnPush(NO_IGNORED, "some-branch"), true, "branches-ignore turned into branches-nowhere");
  assert.equal(firesOnPush(NO_DISPATCH_ONLY, "main"), false);
  assert.equal(firesOnPush(NO_PARKED, "main"), false, "a commented-out trigger reads as live");
  assert.equal(chainedTo(NO_PARKED, DEPLOY_NAME), false);
  assert.equal(chainedTo(YES_MAIN, DEPLOY_NAME), false, "a push-triggered workflow reads as chained to the deploy");
});

test("un-parking restores the trigger and leaves the explanation a comment", () => {
  // The discriminator the parking rests on: a parked YAML line keeps its own
  // indentation after the `  # ` prefix, a note written by a person does not.
  // Get that backwards and un-parking turns the sentence into a syntax error
  // sitting where the trigger should be — which the round-trip test above would
  // then report as a workflow that cannot be restored.
  const back = unpark(NO_PARKED);
  assert.equal(firesOnPush(back, "main"), true, "un-parking did not bring the trigger back");
  assert.match(back, /^\s*# TO PUT IT BACK/m, "un-parking un-commented the note as well as the trigger");
  assert.doesNotMatch(back, /^\s*#\s+push:/m, "the trigger is still commented out after un-parking");
});
