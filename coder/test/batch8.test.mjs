// CLAUDE CODE FIXES, BATCH 8 (2026-11-19): hooks, as Claude Code's hooks reference reads.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const H = await import("../container/coder-hooks.mjs");
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const J = (o) => JSON.stringify(o);
const cmd = { type: "command", command: "c" };
const one = (event, run, hook = cmd, tool = "") => H.hooksOutcome(event, [{ hook, result: H.hookResult(event, run, hook) }], { tool });

test("B8-22 a broken TaskCompleted hook with onFailure block is only an error notice", () => {
  const hb = { type: "command", command: "c", onFailure: "block" };
  assert.equal(H.hookResult("TaskCompleted", { code: 1, stdout: "", stderr: "x" }, hb).kind, "error");
  assert.equal(H.hookResult("TaskCompleted", { timedOut: true }, hb).kind, "error");
  assert.equal(H.hookResult("TaskCompleted", { code: 127, stdout: "", stderr: "not found" }, hb).kind, "error");
  assert.equal(H.hookResult("TaskCompleted", { http: { status: 503 } }, { type: "http", url: "u", onFailure: "block" }).kind, "error");
  assert.equal(H.hookResult("TaskCreated", { code: 1, stdout: "", stderr: "x" }, hb).kind, "block");
});

test("B8-23 CwdChanged and FileChanged exit 2 show their stderr as a notice, and block nothing", () => {
  for (const ev of ["CwdChanged", "FileChanged"]) {
    const o = one(ev, { code: 2, stdout: "", stderr: "bad dir" });
    assert.deepEqual(o.notices, [ev + " hook error: [command hook]: bad dir"]);
    assert.equal(o.decision, ""); assert.deepEqual(o.blocks, []);
    assert.deepEqual(one(ev, { code: 2, stdout: "", stderr: "" }).notices, [ev + " hook error: [command hook]: No stderr output"]);
  }
});

test("B8-25 an agent Stop hook cannot end the turn by calling the work impossible; a prompt hook still can", () => {
  const ag = { type: "agent", prompt: "p" }, pr = { type: "prompt", prompt: "p" };
  const v = { verdict: { ok: false, reason: "never", impossible: true } };
  const a = one("Stop", v, ag);
  assert.equal(a.decision, "block");
  assert.deepEqual(a.blocks, ["Stop hook feedback:\nAgent hook condition was not met: never"]);
  assert.equal(one("Stop", v, pr).decision, "");
  assert.ok(!H.HOOK_JUDGE_AGENT.includes("impossible"));
  assert.ok(H.HOOK_JUDGE.includes("impossible"));
  assert.match(read("container/coder-agent.mjs"), /content: HOOK_JUDGE_AGENT \+/);
});

test("B8-29 each SessionEnd hook keeps its own limit within the budget", () => {
  const hooks = [{ event: "SessionEnd", ownTimeout: true, timeout: 30 }, { event: "SessionEnd" }];
  const b = H.sessionEndBudget(hooks);
  assert.equal(b, 30);
  assert.equal(H.sessionEndHookLimit(hooks[0], b), 30);
  assert.equal(H.sessionEndHookLimit(hooks[1], b), 1.5);
  const b2 = H.sessionEndBudget(hooks, "5000");
  assert.equal(H.sessionEndHookLimit({}, b2, "5000"), 5);
  assert.equal(H.sessionEndHookLimit({ ownTimeout: true, timeout: 2 }, b2, "5000"), 2);
  const b3 = H.sessionEndBudget([{ event: "SessionEnd", ownTimeout: true, timeout: 90 }]);
  assert.equal(H.sessionEndHookLimit({ ownTimeout: true, timeout: 90 }, b3), 60);
  assert.match(read("container/server.mjs"), /timeoutS: lim,/);
});

test("B8-13 Stop and TaskCompleted exit 2 with a missing file and no stdout is a non-blocking error", () => {
  const err = "python3: can't open file '/x.py': [Errno 2] No such file or directory\n";
  for (const ev of ["Stop", "TaskCompleted"]) {
    const r = H.hookResult(ev, { code: 2, stdout: "", stderr: err }, cmd);
    assert.equal(r.kind, "error");
    assert.equal(r.notice, "Failed with non-blocking status code: " + err.trim());
    assert.equal(H.hookResult(ev, { code: 2, stdout: "said", stderr: err }, cmd).kind, "block");
  }
  assert.equal(H.hookResult("PreToolUse", { code: 2, stdout: "", stderr: err }, cmd).kind, "block");
});

test("B8-15 exit 2 with JSON that blocks with a reason uses that reason", () => {
  const pre = one("PreToolUse", { code: 2, stdout: J({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "json" } }), stderr: "from stderr" }, cmd, "Bash");
  assert.equal(pre.reason, "PreToolUse:Bash hook error: json");
  assert.deepEqual(one("PostToolUse", { code: 2, stdout: J({ decision: "block", reason: "jr" }), stderr: "e" }, cmd, "Bash").blocks, ['PostToolUse:Bash hook blocking error from command: "command hook": jr']);
  assert.deepEqual(one("Stop", { code: 2, stdout: J({ decision: "block", reason: "jr" }), stderr: "e" }).blocks, ['Stop hook feedback:\njr\n\nStop hook blocking error from command: "command hook": jr']);
  assert.equal(one("UserPromptSubmit", { code: 2, stdout: J({ decision: "block", reason: "jr" }), stderr: "e" }).reason, "jr");
  // (No JSON: stderr as before.)
  assert.equal(one("UserPromptSubmit", { code: 2, stdout: "", stderr: "e" }).reason, "e");
});

test("B8-17 suppressOriginalPrompt leaves the typed text out of the block note", () => {
  const sup = { decision: "block", reason: "no", hookSpecificOutput: { hookEventName: "UserPromptSubmit", suppressOriginalPrompt: true } };
  assert.equal(one("UserPromptSubmit", { code: 0, stdout: J(sup), stderr: "" }).suppressPrompt, true);
  assert.equal(one("UserPromptSubmit", { code: 2, stdout: J(sup), stderr: "e" }).suppressPrompt, true);
  assert.equal(one("UserPromptSubmit", { code: 0, stdout: J({ decision: "block", reason: "no" }), stderr: "" }).suppressPrompt, false);
  assert.match(read("container/coder-agent.mjs"), /up\.suppressPrompt \? "" : "\\n\\nOriginal prompt: "/);
});

test("B8-19 PreCompact and PostCompact systemMessage and continue are ignored; a block still blocks", () => {
  const o = one("PreCompact", { code: 0, stdout: J({ continue: false, systemMessage: "hi" }), stderr: "" });
  assert.equal(o.stop, null); assert.deepEqual(o.messages, []); assert.equal(o.decision, "");
  assert.deepEqual(one("PostCompact", { code: 0, stdout: J({ systemMessage: "hi" }), stderr: "" }).messages, []);
  assert.equal(one("PreCompact", { code: 0, stdout: J({ decision: "block", reason: "r" }), stderr: "" }).decision, "block");
  assert.ok(!read("container/coder-agent.mjs").includes("preC.decision === \"block\" || preC.stop"));
});

test("B8-20 a long PreCompact output is not cut to 2,000 characters before the 10,000 cap", () => {
  const long = "a".repeat(15_000);
  const o = one("PreCompact", { code: 0, stdout: long, stderr: "" });
  assert.equal(o.context[0].length, 15_000);
  assert.ok(one("UserPromptSubmit", { code: 0, stdout: long, stderr: "" }).context[0].length < 3000);
});

test("B8-21 529 and 503 are server_error for StopFailure", () => {
  assert.equal(H.stopFailureKind({ status: 529 }), "server_error");
  assert.equal(H.stopFailureKind({ status: 503 }), "server_error");
});
