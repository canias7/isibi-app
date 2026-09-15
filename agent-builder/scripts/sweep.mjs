#!/usr/bin/env node
// ONE COMMAND TO RUN THIS DIRECTORY'S MUTATION SWEEP: `npm run sweep`.
//
// Generates the spec (which refuses to emit an ambiguous anchor), then hands it
// to the repository's mutation runner along with this directory's test files.
//
// `--test-timeout` IS NOT OPTIONAL. One of the breakages — the one that stops a
// step being counted before its model call — makes the loop never terminate. That
// is exactly WHY the property matters, and it means the sweep must be able to
// outlive a hanging mutant rather than hang with it.
import { spawnSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(HERE, "..");
const RUNNER = path.resolve(DIR, "..", "scripts", "mutate.mjs");
const TEST_TIMEOUT = "--test-timeout=20000";

if (!fs.existsSync(RUNNER)) {
  console.error(`the mutation runner is not at ${RUNNER}`);
  process.exit(1);
}

const specPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "agent-sweep-")), "spec.json");
const gen = spawnSync(process.execPath, [path.join(HERE, "sweep-spec.mjs"), specPath], { stdio: "inherit" });
if (gen.status !== 0) process.exit(gen.status ?? 1);

const tests = fs.readdirSync(path.join(DIR, "test"))
  .filter((f) => f.endsWith(".test.mjs")).sort()
  .map((f) => path.join(DIR, "test", f));

const run = spawnSync(process.execPath, [RUNNER, specPath, TEST_TIMEOUT, ...tests], { stdio: "inherit" });
process.exit(run.status ?? 1);
