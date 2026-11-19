// Claude Code fixes, batch 5 (2026-11-19).
import { test } from "node:test";
import assert from "node:assert/strict";
const A = await import("../container/coder-agent.mjs");
const C = await import("../container/coder-compact.mjs");
const W = await import("../src/coder-routes.mjs");

test("B5-1 /compact on a single exchange is refused in Claude Code's words", () => {
  assert.equal(C.TOO_SHORT_TO_COMPACT, "Not enough messages to compact.");
  assert.equal(C.tooShortToCompact([]), true);
  assert.equal(C.tooShortToCompact([{ role: "user", content: "hi" }]), true, "a prompt with no reply");
  assert.equal(C.tooShortToCompact([{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }]), true, "one exchange");
  assert.equal(C.tooShortToCompact([{ role: "user", content: "a" }, { role: "assistant", content: "b" }, { role: "user", content: "c" }]), false);
});

test("B5-2 up to 100 @-mentioned files, on the machine and in the Worker's note", () => {
  const text = Array.from({ length: 120 }, (_, i) => "@f" + i + ".js").join(" ");
  assert.equal(A.MENTIONS_MAX, 100);
  assert.equal(A.mentionedPaths(text).length, 100);
  assert.equal(W.fileMentions(text).split(", ").length, 100);
});

test("B5-3 a suggested next message that is only a tag is dropped", async () => {
  const ask = (c) => () => Promise.resolve({ message: { content: c } });
  for (const c of ['<signal type="empty" />', "<none/>", "<empty>", "</x>"]) assert.equal(await A.nextPromptFor(ask(c)), "", c);
  for (const c of ["run <tests> again", "fix the <Button> bug"]) assert.equal(await A.nextPromptFor(ask(c)), c);
});

test("B5-4 a long command is shown back by its start and end only", () => {
  const cmd = "S" + "x".repeat(2998) + "E";
  const out = A.commandEnds(cmd);
  assert.ok(out.length <= 1000, String(out.length));
  assert.ok(out.startsWith("S") && out.endsWith("E"));
  assert.equal(A.commandEnds("ls"), "ls");
});
