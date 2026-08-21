// HOW MUCH CPU A REQUEST MAY SPEND, and why this file exists at all.
//
// Workers Paid gives a request **30 seconds of CPU by default** and allows up
// to 5 minutes, set through `limits.cpu_ms`. This repo had no `limits` block at
// all until 2026-08-21 — so every build the platform has ever run has been
// against that 30-second default, and nothing anywhere said so.
//
// It is guarded rather than merely set because of what its absence looks like:
// a build that gets killed part-way with the client seeing a connection reset,
// which reads as a network fault or a bad model call and not as a setting. Four
// builds died that way in one day (286s, 291s, 301s, against one at 272s that
// published) before anybody asked which ceiling it was. Deleting this block
// would restore that silently, with every other test green.
//
// ASSERTED AS AN ABSENCE AS WELL AS A PRESENCE: the danger is not a wrong
// number, it is the key going missing in a tidy-up.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const RAW = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");

/**
 * The config is JSONC. Whole-line comments are the only form this file uses,
 * and stripping by LINE rather than by pattern is deliberate: a blanket `//`
 * strip eats the rest of any line containing a URL, and this repo has already
 * been bitten twice by an over-eager comment stripper reporting present code as
 * missing.
 */
function config() {
  return JSON.parse(RAW.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n"));
}

test("the config still parses — a broken wrangler.jsonc fails the whole deploy", () => {
  const cfg = config();
  assert.equal(cfg.name, "isibi-app");
  assert.equal(cfg.main, "worker.js");
});

test("cpu_ms is set, so a build is not killed at the 30-second default", () => {
  const cfg = config();
  assert.ok(cfg.limits, "wrangler.jsonc has no `limits` block — every request is back on the 30s default");
  assert.equal(typeof cfg.limits.cpu_ms, "number");
  assert.ok(cfg.limits.cpu_ms > 30000,
    `cpu_ms is ${cfg.limits.cpu_ms}, which is at or below the default it exists to raise`);
});

test("cpu_ms stays inside what Workers Paid accepts — over it fails the deploy", () => {
  // A value the plan refuses is not a slow build, it is no deploy at all: the
  // whole platform stays on the previous script and the error names a setting
  // rather than a feature. 300000 is the documented maximum.
  assert.ok(config().limits.cpu_ms <= 300000);
});

test("the reasoning is recorded where the setting is, not only in a commit", () => {
  // A bare `"limits": { "cpu_ms": 300000 }` reads as a magic number somebody
  // can safely tidy away. The four dead builds are why it is there.
  const at = RAW.indexOf('"limits"');
  assert.ok(at > 0);
  const above = RAW.slice(Math.max(0, at - 1600), at);
  assert.match(above, /cpu/i, "nothing above the limits block explains what it is for");
  assert.match(above, /30 second|30s|default/i, "nothing above it records the default being raised");
});
