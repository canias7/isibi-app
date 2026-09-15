#!/usr/bin/env node
// ONE COMMAND FOR THE SQL SWEEP: `npm run sweep:sql`.
//
// Generates the SQL spec, then hands it to the repository's mutation runner with
// the DATABASE check as the test — `node --test` runs that script and propagates
// its exit code, so a schema guarantee broken on purpose shows up as a red run.
//
// SLOWER THAN THE UNIT SWEEP BY CONSTRUCTION: every mutant creates a database and
// applies the whole migration. That is the price of proving a guarantee against
// the engine that enforces it.
import { spawnSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(HERE, "..");
const RUNNER = path.resolve(DIR, "..", "scripts", "mutate.mjs");
const CHECK = path.join(DIR, "test", "integration", "pg-schema.mjs");

if (!fs.existsSync(RUNNER)) { console.error(`the mutation runner is not at ${RUNNER}`); process.exit(1); }

// A MUTANT THAT CANNOT BE READ IS NOT A KILL. If there is no cluster the check
// SKIPS and exits 0, which the runner would read as "every mutant survived" — a
// sweep that tested nothing and said so in the most misleading way available. So
// the cluster is confirmed here, before a single mutant is written.
const probe = spawnSync("su", ["postgres", "-c", "psql -X -tAc 'select 1'"], { stdio: "ignore" });
if (probe.status !== 0) {
  console.error("No local PostgreSQL that `su postgres` can reach, so every mutant would");
  console.error("'survive' a check that skipped itself. Start one and re-run:");
  console.error("  pg_ctlcluster 16 main start");
  process.exit(1);
}

const specPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "agent-sql-sweep-")), "spec.json");
const gen = spawnSync(process.execPath, [path.join(HERE, "sql-sweep-spec.mjs"), specPath], { stdio: "inherit" });
if (gen.status !== 0) process.exit(gen.status ?? 1);

const run = spawnSync(process.execPath, [RUNNER, specPath, CHECK], { stdio: "inherit" });
process.exit(run.status ?? 1);
