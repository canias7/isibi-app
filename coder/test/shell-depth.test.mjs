// L-machine-44 (2026-11-19): a command nested too deep to read is one Coder cannot read (it asks), never a crash.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseShell } from "../container/coder-shell.mjs";
import { bashDecision } from "../container/coder-perms.mjs";
import { dangerousRm, RM_UNCHECKED } from "../container/coder-bashcheck.mjs";

test("L-machine-44 1,500 nested $( is unreadable and asks; a normal nested command still reads", () => {
  const deep = "echo " + "$(".repeat(1500) + "ls" + ")".repeat(1500);
  const t0 = Date.now();
  assert.equal(parseShell(deep).ok, false);
  assert.ok(Date.now() - t0 < 2000);
  assert.notEqual(bashDecision(deep, { mode: "acceptEdits", rules: {}, cwd: "/tmp" }).verdict, "allow");
  assert.match(dangerousRm(deep, { cwd: "/tmp" }), /can't rule out a dangerous removal/); // (no rm in it: M-a-19)
  const sub = "( ".repeat(1500) + "ls" + " )".repeat(1500);
  assert.equal(parseShell(sub).ok, false);
  const ok = parseShell("echo $(cat $(ls a) | wc -l)");
  assert.equal(ok.ok, true);
  assert.ok(ok.commands.some((c) => c.words && c.words[0] && c.words[0].text === "ls"));
});
