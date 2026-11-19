// Batch 14: Claude Code's CLAUDE_CODE_... switch names work in the Environment window too.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("batch 14: Claude Code's names in the Environment window set Coder's switches; Coder's name wins; the name still reaches commands", async () => {
  const SV = await import("../container/server.mjs");
  const raw = { CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: "1", CLAUDE_CODE_SUBPROCESS_ENV_SCRUB: "1", FOO: "x" };
  const v = SV.ownerCoderVars(raw);
  assert.equal(SV.varOn(v.CODER_DISABLE_BACKGROUND_TASKS), true, "background commands off");
  assert.equal(SV.varOn(v.CODER_SUBPROCESS_ENV_SCRUB), true);
  assert.equal(v.CLAUDE_CODE_DISABLE_BACKGROUND_TASKS, "1", "Claude Code's name is kept as a plain variable");
  assert.deepEqual(raw, { CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: "1", CLAUDE_CODE_SUBPROCESS_ENV_SCRUB: "1", FOO: "x" }, "the given ones untouched");
  assert.equal(SV.ownerCoderVars({ CLAUDE_CODE_SHELL: "/bin/zsh", CODER_SHELL: "bash" }).CODER_SHELL, "bash", "CODER_ name wins");
  assert.equal(SV.ownerNameFor(raw, "CODER_DISABLE_BACKGROUND_TASKS"), "CLAUDE_CODE_DISABLE_BACKGROUND_TASKS");
  assert.equal(SV.ownerNameFor({ CODER_SHELL: "bash" }, "CODER_SHELL"), "CODER_SHELL");
  // Wired where the job reads its settings.
  const src = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(src, /const varsGiven = ownerCoderVars\(/);
  assert.match(src, /const ownerRaw = ownerCoderVars\(ownerTyped\)/);
});
