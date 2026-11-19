// Claude Code fixes, batch 9 (2026-11-19): hooks' permission_mode and crash notices, Grok's retries and cut-off answers,
// sed's bracket expressions and backup copies.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as H from "../container/coder-hooks.mjs";
import * as A from "../container/coder-agent.mjs";
import { coderSend, retryLine, CUT_OFF_ERROR, CODER_CALL_MS } from "../container/coder-model.mjs";

test("M-c-35 permission_mode only for the events whose examples on Claude Code's hooks page carry it", () => {
  const has = (e) => "permission_mode" in H.hookInput(e, { session: "s", cwd: "/w", mode: "plan" });
  for (const e of ["SessionStart", "Notification", "StopFailure", "CwdChanged", "FileChanged", "PreCompact", "PostCompact", "SessionEnd", "Elicitation", "ElicitationResult", "TaskCreated"]) assert.equal(has(e), false, e);
  for (const e of ["PreToolUse", "PostToolUse", "Stop", "UserPromptSubmit", "TaskCompleted"]) assert.equal(has(e), true, e);
});

test("M-c-37 a failed hook's notice names a Node or Python crash's real error, and a missing PreToolUse command says its check may not have run", () => {
  const node = "/w/hook.js:3\n  throw new Error('boom');\n  ^\n\nError: boom\n    at Object.<anonymous> (/w/hook.js:3:9)";
  assert.equal(H.hookResult("PostToolUse", { code: 1, stdout: "", stderr: node }).notice, "Failed with non-blocking status code: Error: boom");
  const py = "Traceback (most recent call last):\n  File \"/w/h.py\", line 2, in <module>\n    raise ValueError('bad')\nValueError: bad\n";
  assert.equal(H.hookResult("PostToolUse", { code: 1, stdout: "", stderr: py }).notice, "Failed with non-blocking status code: ValueError: bad");
  assert.equal(H.hookResult("PostToolUse", { code: 1, stdout: "", stderr: "plain\nmore" }).notice, "Failed with non-blocking status code: plain");
  const miss = H.hookResult("PreToolUse", { code: 127, stdout: "", stderr: "sh: 1: nohook: not found" });
  assert.match(miss.notice, /nohook: not found \(the hook's command was not found, so its check may not have run\)$/);
  assert.doesNotMatch(H.hookResult("PostToolUse", { code: 127, stdout: "", stderr: "x: not found" }).notice, /may not have run/);
});

test("M-r2-11 the retry line names a rate limit or a lost connection from the first try; other errors from the third", () => {
  const l = (error, attempt = 1) => retryLine({ attempt, maxRetries: 10, waitMs: 1000, error });
  assert.match(l("AI call failed: 429 slow down"), /^AI call failed: 429 slow down · Retrying in 1s · attempt 1\/10$/);
  assert.match(l("Connection error: fetch failed"), /^Connection error: fetch failed ·/);
  assert.match(l("AI call failed: 500 oops"), /^API error ·/);
  assert.match(l("AI call failed: 500 oops", 3), /^AI call failed: 500 oops ·/);
});

const answer = (extra = {}) => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: "half" }] }], usage: { input_tokens: 1, output_tokens: 1 }, ...extra }), text: async () => "" });

test("M-r2-15 an answer Grok cut off at its output limit comes back marked", async () => {
  let r = await coderSend({ XAI_API_KEY: "k" }, { fetchFn: async () => answer({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }) })({ model: "m", messages: [{ role: "user", content: "hi" }] });
  assert.equal(r.cutOff, true);
  r = await coderSend({ XAI_API_KEY: "k" }, { fetchFn: async () => answer({ status: "completed" }) })({ model: "m", messages: [{ role: "user", content: "hi" }] });
  assert.equal(r.cutOff, undefined);
});

test("M-r2-15 the loop keeps a cut-off answer's words, runs none of its calls and ends the turn with Claude Code's error", async () => {
  const events = []; let ran = 0, sent = 0;
  const r = await A.runCoder({
    send: async () => { sent++; return { cutOff: true, message: { role: "assistant", content: "Part one", tool_calls: [{ id: "c1", type: "function", function: { name: "bash", arguments: "{\"command\":\"echo hi\"" } }] }, usage: { in: 1, out: 1 } }; },
    exec: async () => { ran++; return { code: 0, output: "ok\n" }; },
    emit: (e) => events.push(e),
    here: () => "/w", root: "/w", chatId: "b9", where: (p) => (p.startsWith("/") ? p : "/w/" + p),
    ask: async () => ({ choice: "yes" }),
  }, { text: "go", mode: "auto" });
  assert.equal(sent, 1);
  assert.equal(ran, 0);
  assert.ok(events.some((e) => e.type === "text" && e.text === "Part one"));
  assert.ok(events.some((e) => e.type === "error" && e.text === CUT_OFF_ERROR));
  assert.ok(r.messages.some((m) => m.role === "assistant" && m.content === "Part one" && !m.tool_calls));
});

test("M-r2-09 a call past its own time limit is tried again (10 minutes, Claude Code's default); the owner's Stop is not", async () => {
  assert.equal(CODER_CALL_MS, 10 * 60 * 1000);
  const late = () => Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
  let n = 0; const told = [];
  const r = await coderSend({ XAI_API_KEY: "k" }, { fetchFn: async () => { if (++n < 2) throw late(); return answer(); }, wait: async () => {}, rand: () => 0 })({ model: "m", messages: [{ role: "user", content: "hi" }], onRetry: (x) => told.push(x.error) });
  assert.equal(r.message.content, "half"); assert.equal(n, 2); assert.deepEqual(told, ["Request timed out"]);
  n = 0;
  await assert.rejects(coderSend({ XAI_API_KEY: "k" }, { fetchFn: async () => { n++; throw late(); }, wait: async () => {}, rand: () => 0 })({ model: "m", messages: [{ role: "user", content: "hi" }] }), /timeout/);
  assert.equal(n, 11, "after 10 retries the error is shown");
  const ac = new AbortController(); n = 0;
  await assert.rejects(coderSend({ XAI_API_KEY: "k" }, { fetchFn: async () => { n++; ac.abort(); const e = new Error("aborted"); e.name = "AbortError"; throw e; }, wait: async () => {}, rand: () => 0 })({ model: "m", signal: ac.signal, messages: [{ role: "user", content: "hi" }] }));
  assert.equal(n, 1, "the owner's Stop is not retried");
});

import { bashDecision, commandReadOnly, fileCommandTargets, wholeReadOnly } from "../container/coder-perms.mjs";
import { parseShell } from "../container/coder-shell.mjs";
const ROOT = "/work/shop";
const dec = (c, mode, more = {}) => bashDecision(c, { mode, cwd: ROOT, workdirs: [ROOT], ...more });

test("T7 a sed script whose pattern hides the separator in brackets is not taken as read-only", () => {
  for (const c of ["sed -n 's/[/]/;s,/w out,,' f", "sed 's/[/]/;s,/e #,,' f"]) {
    assert.equal(wholeReadOnly(c), false, c);
    for (const mode of ["plan", "acceptEdits"]) assert.notEqual(dec(c, mode).verdict, "allow", c + " " + mode);
  }
  assert.equal(wholeReadOnly("sed -n 's/[x]/y/p' f"), true);
  assert.equal(wholeReadOnly("sed -n 's/[[:alpha:]]/y/p' f"), true);
  assert.equal(wholeReadOnly("sed -n 's/[]x]/y/p' f"), true);
});

test("I67 sed's in-place backup copy is a file the command writes, checked like the file it copies", () => {
  const t = (c) => fileCommandTargets(parseShell(c).commands[0], ROOT);
  assert.deepEqual(t("sed -i.bak 's/a/b/' f.js").paths, [ROOT + "/f.js", ROOT + "/f.js.bak"]);
  assert.deepEqual(t("sed --in-place=.orig 's/a/b/' src/f.js").paths, [ROOT + "/src/f.js", ROOT + "/src/f.js.orig"]);
  assert.deepEqual(t("sed -i'.claude/*' 's/a/b/' f.js").paths, [ROOT + "/f.js", ROOT + "/.claude/f.js"]);
  assert.deepEqual(t("sed -ni'old_*' 's/a/b/' src/f.js").paths, [ROOT + "/src/f.js", ROOT + "/src/old_f.js"]);
  assert.deepEqual(t("sed -i 's/a/b/' f.js").paths, [ROOT + "/f.js"]);
  assert.deepEqual(t("sed -i'../outside/*' 's/a/b/' f.js").paths, [ROOT + "/f.js", "/work/outside/f.js"]);
  assert.notEqual(dec("sed -i'../outside/*' 's/a/b/' f.js", "acceptEdits").verdict, "allow");
  assert.equal(dec("sed -i.bak 's/a/b/' f.js", "acceptEdits").verdict, "allow");
});

import { gitRepoTop } from "../container/coder-perms.mjs";
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

test("T8 a read-only git command in a repository that is not the project's asks, even when the folder was reached by an earlier cd", () => {
  const top = mkdtempSync(tmpdir() + "/b9-");
  try {
    mkdirSync(top + "/.git"); mkdirSync(top + "/tools/meta/objects", { recursive: true }); mkdirSync(top + "/tools/meta/refs");
    writeFileSync(top + "/tools/meta/HEAD", "ref: refs/heads/main\n"); writeFileSync(top + "/tools/meta/config", "");
    assert.equal(gitRepoTop(top + "/src", existsSync), top);
    assert.equal(gitRepoTop(top + "/tools/meta", existsSync), top + "/tools/meta");
    for (const c of ["git status", "git ls-remote"]) for (const mode of ["plan", "acceptEdits"]) {
      assert.notEqual(bashDecision(c, { mode, cwd: top + "/tools/meta", workdirs: [top], repoOf: (d) => gitRepoTop(d, existsSync) }).verdict, "allow", c + " " + mode);
      assert.equal(bashDecision(c, { mode, cwd: top, workdirs: [top], repoOf: (d) => gitRepoTop(d, existsSync) }).verdict, "allow", c + " in the project " + mode);
    }
  } finally { rmSync(top, { recursive: true, force: true }); }
});
