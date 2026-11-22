// CLAUDE CODE FIXES, BATCH 6 (2026-11-19): the dangerous-delete check follows a folder change inside brackets (M-r2-03),
// leaves harmless deletes alone (L-machine-27), words its card's reason as Claude Code does (M-r2-31), and refuses an
// unreadable command with no rm in it in Claude Code 2.1.327's words (M-a-19).
import { test } from "node:test";
import assert from "node:assert/strict";
const B = await import("../container/coder-bashcheck.mjs");
const A = await import("../container/coder-agent.mjs");
const ctx = { cwd: "/work/proj", home: "/home/dev", workdirs: ["/work/proj"] };
const flagged = (c) => !!B.dangerousRm(c, ctx);

test("M-r2-03: a delete after a folder change inside brackets or a -c script is judged from that folder", () => {
  for (const c of ["(cd .. && rm -rf proj)", "(cd ..; rm -rf proj)", "(cd /work && rm -rf proj)", "(cd /; rm -rf etc)", "bash -c 'cd .. && rm -rf proj'", "sh -c \"cd / && rm -rf etc\"", "cd .. && rm -rf proj"]) assert.ok(flagged(c), c);
  assert.ok(!flagged("(cd src && rm -rf build)"));
});

test("L-machine-27: harmless deletes inside the project get no dangerous-delete card; the docs' own examples still do", () => {
  for (const c of ["(cd a && make); rm -rf ./out", "bash -c 'rm -rf ./dist'", "rm -rf \"$(pwd)/dist\"", "rm -rf packages/*/dist", "cd sub && rm -f *.o", "cd $X && rm -rf ./x"]) assert.ok(!flagged(c), c);
  for (const c of ["rm -rf logs/*/*", "rm -rf logs/*/", "cd logs && rm -rf a/*", "rm -rf ~/$(cmd)", "cd $X && rm -rf ..", "cd $X && rm -rf ../y"]) assert.ok(flagged(c), c);
});

test("M-r2-31: the card's reason for a mounted drive or the folder holding drives is Claude Code's one line; Grok keeps the long text", async () => {
  assert.equal(B.rmCardReason(B.dangerousRm("rm -rf /mnt/data", ctx)), "Dangerous rm operation on mounted drive path: /mnt/data");
  assert.equal(B.rmCardReason(B.dangerousRm("rm -rf /mnt", ctx)), "Dangerous rm operation on critical path: /mnt");
  assert.equal(B.rmCardReason(B.dangerousRm("rm -rf /usr", ctx)), "");
  const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
  const events = [];
  let n = 0;
  const steps = [say("x", [{ id: "b1", type: "function", function: { name: "bash", arguments: JSON.stringify({ command: "rm -rf /mnt/data" }) } }]), say("ok")];
  await A.runCoder({ send: async () => steps[Math.min(n++, 1)], exec: async () => ({ code: 0, output: "" }), emit: (e) => events.push(e), ask: async () => ({ choice: "no" }), here: () => "/work/proj", root: "/work/proj", chatId: "rm-b6" }, { text: "go", messages: [], mode: "acceptEdits" });
  // (In Accept edits: Auto refuses such a removal at once since batch 7 of "Go Claude Code way", with no card.)
  const card = events.find((e) => e.type === "permission");
  assert.ok(card, "a card was shown");
  assert.equal(card.why, "Dangerous rm operation on mounted drive path: /mnt/data");
});

test("M-a-19: an unreadable command with no rm gets its own refusal (send a harmless one again in plain syntax); one with rm keeps the old one", () => {
  assert.equal(B.dangerousRm("echo \"hello", ctx), B.RM_UNCHECKED_NO_RM);
  assert.equal(B.dangerousRm("rm -rf \"x", ctx), B.RM_UNCHECKED);
  const told = A.rmDenied(B.RM_UNCHECKED_NO_RM);
  assert.match(told, /can be sent again in plain syntax/);
  assert.doesNotMatch(told, /leave the removal to them|re-issuing/);
  assert.match(A.rmDenied(B.RM_UNCHECKED), /re-issuing the removal/);
});
