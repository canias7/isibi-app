// CODER_DISABLE_FILE_MENTIONS (Claude Code's CLAUDE_CODE_DISABLE_FILE_MENTIONS): @-mentioned files are named, not read in.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mentionPathsNote } from "../container/coder-agent.mjs";

test("file mentions off: only the paths, with a note to read them, and a Read-denied path left out", () => {
  const n = mentionPathsNote({ root: "/w" }, ["src/a.js", "secret.env"], (p) => p === "secret.env");
  assert.equal(n.role, "user");
  assert.match(n.content, /read them with your read tool/);
  assert.match(n.content, /src\/a\.js/);
  assert.doesNotMatch(n.content, /secret\.env/);
  assert.equal(mentionPathsNote({}, ["x"], () => true), null);
});

test("file mentions off: the switch reaches the loop from the chat's environment, and the loop uses it", () => {
  const server = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(server, /mentionsOff: varOn\(rawVars\.CODER_DISABLE_FILE_MENTIONS\)/);
  const agent = readFileSync(new URL("../container/coder-agent.mjs", import.meta.url), "utf8");
  assert.match(agent, /const note = mentionsOff \? mentionPathsNote\(/);
});
