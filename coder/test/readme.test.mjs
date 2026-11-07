// THE README SAYS WHAT CODER DOES NOW (owner, 2026-11-07: "fix this"; the docs
// comparison found old lines): checked against the code itself.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("CD150 the README says what Coder does now: pull requests only on the owner's word, many tools, 8 minutes for a start, no saved keys for the setup script (old lines said otherwise); and those are true", async () => {
  const md = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  for (const old of [/its only tool/, /opens a\s+\*\*pull request\*\* into the main branch/, /given 3 minutes/, /setup script use saved keys/]) assert.doesNotMatch(md, old, String(old));
  assert.match(md, /A \*\*pull request\*\*\s+opens only when the user presses Create PR or Create draft PR in the chat,\s+or asks Coder for one/);
  assert.match(md, /given 8 minutes before the job counts as lost \(`START_GRACE_MS`/);
  assert.match(md, /setup script never gets the owner's saved keys or variables/);
  assert.doesNotMatch(readFileSync(new URL("../../CLAUDE.md", import.meta.url), "utf8"), /one tool, `bash`/);
  // TRUE IN THE CODE: the start's grace, the tools, and no keys while the setup runs.
  const { START_GRACE_MS } = await import("../src/coder-routes.mjs");
  assert.equal(START_GRACE_MS, 8 * 60 * 1000);
  const { CODER_TOOLS } = await import("../container/coder-agent.mjs");
  const names = CODER_TOOLS.map((t) => (t.function || t).name);
  for (const n of ["read", "edit", "write", "grep", "glob", "bash"]) assert.ok(names.includes(n), n);
  const server = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(server, /if \(px && secretList\.length\) px\.setSecrets\(\[\]\);/, "no keys while the setup script runs");
});
