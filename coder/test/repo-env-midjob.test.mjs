// A REPOSITORY'S env CHANGED MID-JOB applies at once (the audit, 2026-11-20; Claude Code's env-vars docs: "A running session
// applies new and changed values to its environment when you save the file … Removing a variable from the file doesn't unset
// it in a running session").
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { repoEnvMidJob, ownMidJob, repoSettings, bashOutputLimits, bashTimeouts } from "../container/server.mjs";

test("RE1 a new or changed name applies now; the owner's own wins; a removed one stays; Coder's own marks are never replaced", () => {
  const target = { FOO: "1", KEEP: "x", MINE: "owner", GIT_EDITOR: "true" };
  const set = repoEnvMidJob({ was: { FOO: "1", KEEP: "x" }, now: { FOO: "2", BAR: "new", MINE: "repo", GIT_EDITOR: "vim", OTEL_X: "y" }, ownerVars: { MINE: "owner" }, target });
  assert.deepEqual(set.sort(), ["BAR", "FOO"]);
  assert.deepEqual(target, { FOO: "2", KEEP: "x", MINE: "owner", GIT_EDITOR: "true", BAR: "new" });
});

test("RE2 the repository's settings file read again mid-job gives the new value of its env", async () => {
  const dir = await mkdtemp(join(tmpdir(), "coder-re-"));
  await mkdir(join(dir, ".claude"));
  await writeFile(join(dir, ".claude", "settings.json"), JSON.stringify({ env: { FOO: "1" } }));
  const a = repoSettings(dir, { trust: true });
  const target = { FOO: a.env.FOO };
  await writeFile(join(dir, ".claude", "settings.json"), JSON.stringify({ env: { FOO: "2", BASH_MAX_OUTPUT_LENGTH: "50000" } }));
  const b = repoSettings(dir, { trust: true });
  repoEnvMidJob({ was: a.env, now: b.env, ownerVars: {}, target });
  assert.equal(target.FOO, "2");
  // BASH_MAX_OUTPUT_LENGTH is one of the command settings: changed in place, so the job's own object sees it.
  const t = { tmo: bashTimeouts({}), outLimits: bashOutputLimits({}), searchLimits: {} };
  const held = t.outLimits;
  ownMidJob(t, {}, b.own, {});
  assert.equal(held, t.outLimits);
  assert.deepEqual(t.outLimits, bashOutputLimits({ BASH_MAX_OUTPUT_LENGTH: "50000" }));
  assert.notDeepEqual(t.outLimits, bashOutputLimits({}));
  // The owner's own setting still wins.
  ownMidJob(t, { BASH_MAX_OUTPUT_LENGTH: "30000" }, b.own, {});
  assert.deepEqual(t.outLimits, bashOutputLimits({ BASH_MAX_OUTPUT_LENGTH: "30000" }));
});
