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

// THE PROBE MUST NOT SCORE A ROW THAT DID NOT DO ITS WORK.
//
// Its first run printed two verdicts it had not earned. `sub` came back 200 in
// 0.1 SECONDS for a 240-second request — the inner fetch never waited — and the
// script reported "A SUBREQUEST CAN BE HELD FOR 420s", because all it looked at
// was a status code and a wall-clock. And `burn` was scored `last() || 0`, so a
// mode that died on its FIRST step printed "burning stops at 0s".
//
// Both are the same defect: survival inferred from a green tick rather than
// from evidence the work happened. A harness that cannot fail honestly is worse
// than no harness, and this one goes on to decide whether a ~130-credit build
// is worth spending.
const PROBE = readFileSync(new URL("../scripts/wall-probe.mjs", import.meta.url), "utf8");

test("a probe row is scored on doing the work, not on returning 200", () => {
  // The inner duration has to travel back from the Worker and be read here, or
  // a subrequest that never waited is indistinguishable from one held open.
  assert.match(PROBE, /innerMs/, "the probe does not read how long the inner fetch actually took");
  assert.match(PROBE, /valid\s*=\s*false/, "nothing in the probe can mark a row as not-measured");
  // And a row that did not measure must stop the mode rather than being
  // counted: every larger step would be invalid the same way.
  assert.match(PROBE, /if \(!returned \|\| !valid\) break/);
});

test("a mode that measured nothing gets no ceiling", () => {
  // The failure this replaces printed a confident diagnosis sourced from a
  // request that never happened. Every verdict is gated on `measured`.
  assert.match(PROBE, /const measured =/);
  for (const m of ["burn", "mem", "sub"]) {
    const at = PROBE.indexOf(`MODES.includes("${m}")`);
    assert.ok(at > 0, `no verdict block for ${m}`);
    const block = PROBE.slice(at, at + 700);
    assert.match(block, /!measured\(/, `${m}'s verdict is not gated on having measured anything`);
  }
});

test("the Worker reports what its burn loop got through, not just that it ran", () => {
  const w = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = w.indexOf('url.searchParams.get("burn")');
  assert.ok(at > 0);
  const block = w.slice(at, at + 900);
  // A TIMED inner slice cannot work: Workers freeze `Date.now()` between I/O,
  // so `while (Date.now() - slice < N)` compares one frozen reading against
  // itself and never terminates. That is not a slow test, it is a different
  // test — an unbounded spin wearing the label of a bounded one.
  assert.doesNotMatch(block, /while \(Date\.now\(\) - slice/,
    "the burn slice is timed again — a frozen clock makes that an unbounded spin");
  assert.match(block, /SPINS_PER_SLICE/, "the slice is not a counted amount of work");
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

// ── OBSERVABILITY: THE ONLY WAY A DEAD CONTAINER CAN SAY WHAT KILLED IT ──────
//
// Runs 40 and 41 each lost a generation inside the container, and every
// diagnosis stalled at the same wall: the container's stdout/stderr — the one
// place an OOM or a rollout's SIGTERM announces itself — reaches Workers Logs
// ONLY when observability is enabled, and this key was absent, so nothing was
// ever retained. The absence is the danger, exactly like `limits` above: a
// tidy-up that drops the block does not break a build, it silently restores
// the state where no failed build can ever be explained.
test("observability is on, so container stderr is retained rather than lost", () => {
  const cfg = config();
  assert.ok(cfg.observability, "wrangler.jsonc has no `observability` block — container deaths are unreadable again");
  assert.equal(cfg.observability.enabled, true, "observability is declared and switched off, which reads as on");
});

test("nothing is sampled away — the failure that matters is the one a rate drops", () => {
  // The runs worth reading are the rare ones. A head_sampling_rate below 1
  // trades exactly those away; if volume ever binds, scope WHAT logs instead.
  const rate = config().observability.head_sampling_rate;
  assert.ok(rate === undefined || rate === 1, `head_sampling_rate is ${rate} — a sampled log drops the rare failure it exists for`);
});
