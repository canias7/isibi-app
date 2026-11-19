// Batch 14: the low-disk and low-memory warnings from the environment's variables, as Claude Code reads them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("batch 14: CLAUDE_CODE_WARN_DISK_FREE_GIB / _MEMORY_ from the owner's variables beat Settings; plain digits only", async () => {
  const { warnGibFrom } = await import("../container/server.mjs");
  assert.equal(warnGibFrom({ CLAUDE_CODE_WARN_DISK_FREE_GIB: "30" }, "DISK", 2), 30);
  assert.equal(warnGibFrom({ CLAUDE_CODE_WARN_MEMORY_FREE_GIB: "3" }, "MEMORY", 0), 3);
  assert.equal(warnGibFrom({ CLAUDE_CODE_WARN_DISK_FREE_GIB: "1e1" }, "DISK", 2), 0, "not plain digits: off");
  assert.equal(warnGibFrom({ CLAUDE_CODE_WARN_DISK_FREE_GIB: "ten" }, "DISK", 2), 0);
  assert.equal(warnGibFrom({ CLAUDE_CODE_WARN_DISK_FREE_GIB: "0" }, "DISK", 5), 0);
  assert.equal(warnGibFrom({ CLAUDE_CODE_WARN_DISK_FREE_GIB: "30", CODER_WARN_DISK_FREE_GIB: "7" }, "DISK", 2), 7, "Coder's name wins");
  assert.equal(warnGibFrom({}, "DISK", 5), 5, "none set: the Settings choice");
  assert.equal(warnGibFrom(null, "MEMORY", 4), 4);
  // Read from the owner's variables only, never the repository's settings file.
  const src = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(src, /diskWarnGib: warnGibFrom\(body\.setup && body\.setup\.vars, "DISK", PREFS\.diskWarnGib\)/);
  assert.match(src, /memWarnGib: warnGibFrom\(body\.setup && body\.setup\.vars, "MEMORY", PREFS\.memWarnGib\)/);
});
