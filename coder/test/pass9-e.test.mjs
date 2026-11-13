// BASH DOCS PASS 9, PART E (the owner, 2026-11-11: "Yes pls" to building pass 9's list in order; part E: the hooks
// details): each test checked against Claude Code's hooks reference and its own program, 2.1.322.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import http from "node:http";

const S = await import("../container/server.mjs");
const A = await import("../container/coder-agent.mjs");
const H = await import("../container/coder-hooks.mjs");

const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });

/** One job of Coder's loop with hooks, its machine stood in for: `hookRun(input, x)` answers each hook; `execRun(x)` each command. */
async function loop(steps, hooks, { hookRun = () => ({}), execRun = null, mode = "auto", opts = {}, deps = {}, answers = [] } = {}) {
  const events = [], seen = [], ran = [], hookCalls = [], resets = [], cards = [];
  let n = 0, k = 0;
  const r = await A.runCoder({
    send: async (req) => { seen.push(req); return steps[Math.min(n++, steps.length - 1)]; },
    exec: async (x) => {
      const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
      if (mark && x.hook === true) { const input = JSON.parse(x.payload); hookCalls.push({ input, x }); const a = (await hookRun(input, x)) || {}; return { code: a.code || 0, output: String(a.stdout || "") + "\n" + mark[0] + "\n" + String(a.stderr || "") }; }
      if (x.hook === true) { resets.push(x); return { code: 0, output: "" }; }
      if (x.tool) return { code: 0, output: "" };
      ran.push(x.command);
      return execRun ? await execRun(x) : { code: 0, output: "ok\n" };
    },
    emit: (e) => events.push(e),
    here: () => "/work/shop", root: "/work/shop", home: "/home/dev", chatId: "shop-e1", where: (p) => (p.startsWith("/") ? p : "/work/shop/" + p),
    ask: async (pid) => { cards.push(events.find((e) => e.type === "permission" && e.pid === pid)); return answers[k++] || { choice: "yes" }; },
    ...deps,
  }, { text: "go", mode, hooks: H.hooksFrom({ hooks }, "settings").list, ...opts });
  const told = (id) => { for (const req of seen) for (const m of req.messages) if (m.role === "tool" && m.tool_call_id === id) return m.content; return ""; };
  return { r, events, seen, ran, hookCalls, resets, cards, told };
}
const cmd = (command) => [{ hooks: [{ type: "command", command }] }];

test("CD485 hooks are told the mode as Claude Code's cloud names it: \"default\" in the Accept edits the owner picks there (Coder's commands that change files ask, as in Claude Code's default), \"acceptEdits\" where commands may change files, \"plan\", \"auto\"", async () => {
  const mode = async (m, opts) => { const t = await loop([say("", [call("bash", { command: "ls" }, "b1")]), say("ok")], { PreToolUse: cmd("p.sh") }, { mode: m, opts }); return t.hookCalls[0].input.permission_mode; };
  assert.equal(await mode("acceptEdits", { fileEdits: false }), "default");
  assert.equal(await mode("acceptEdits", { fileEdits: true }), "acceptEdits");
  assert.equal(await mode("plan", { fileEdits: false }), "plan");
  assert.equal(await mode("auto", { fileEdits: false }), "auto");
});

test("CD486 a hook's command runs with `sh -c`, as Claude Code runs it (\"sh -c on macOS and Linux\": dash here, never the shell Coder's commands use); exec form and PowerShell as before", () => {
  const w = H.hookShell({ type: "command", command: "echo \"$CLAUDE_PROJECT_DIR\" | ./check.sh" }, "MARK", "/work/shop");
  assert.match(w, /\(\nsh -c 'echo "\$CLAUDE_PROJECT_DIR" \| \.\/check\.sh'\n\) < "\$__in" 2>"\$__err"/);
  assert.match(H.hookShell({ type: "command", command: "it's.sh" }, "MARK", "/w"), /\nsh -c 'it'\\''s\.sh'\n/, "its quotes kept");
  assert.match(H.hookShell({ type: "command", command: "/opt/check", args: ["--fast", "${CLAUDE_PROJECT_DIR}/x"] }, "MARK", "/work/shop"), /\n'\/opt\/check' '--fast' '\/work\/shop\/x'\n/, "exec form: no shell");
  assert.match(H.hookShell({ type: "command", shell: "powershell", command: "Write-Output hi" }, "MARK", "/w"), /\ncase "\$\{TERM:-\}" in ''\|linux\|dumb\) export TERM=xterm-256color;; esac; pwsh -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command 'Write-Output hi/);
});

test("CD487 a PreToolUse hook's additionalContext reaches Coder whatever the call's fate (Claude Code gives it with a hook's deny, and with a call a rule refused), not only when it ran", async () => {
  const ctx = (decision) => ({ stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", ...(decision ? { permissionDecision: decision, permissionDecisionReason: "not now" } : {}), additionalContext: "the deploy window is closed" } }) });
  let t = await loop([say("", [call("bash", { command: "npm publish" }, "b1")]), say("ok")], { PreToolUse: cmd("p.sh") }, { hookRun: () => ctx("deny") });
  assert.match(t.told("b1"), /not now/);
  assert.match(t.told("b1"), /PreToolUse:Bash hook additional context: the deploy window is closed/);
  t = await loop([say("", [call("bash", { command: "npm publish" }, "b1")]), say("ok")], { PreToolUse: cmd("p.sh") }, { hookRun: () => ctx(""), opts: { rules: { allow: [], ask: [], deny: ["Bash(npm publish)"] } } });
  assert.match(t.told("b1"), /has been denied/);
  assert.match(t.told("b1"), /PreToolUse:Bash hook additional context: the deploy window is closed/);
  assert.deepEqual(t.ran, []);
});

test("CD488 a hook's text past 10,000 characters is saved to a file in the chat's output folder and given as its path and a 2,000-character preview, as Claude Code does (its plain stdout whole; additionalContext and systemMessage each on its own; PreCompact's stdout cut, never saved)", async () => {
  const big = "line of hook output\n".repeat(700);
  const saved = [];
  const save = (text) => { saved.push(text); return "/data/memory/shop.out/k3x9q1a2b.txt"; };
  const r1 = H.persistHookText("PostToolUse", { code: 0, stdout: big }, save);
  assert.ok(r1.stdout.startsWith("<persisted-output>\nOutput too large (13.7KB). Full output saved to: /data/memory/shop.out/k3x9q1a2b.txt\n\nPreview (first 2KB):\nline of hook output\n"), r1.stdout.slice(0, 200));
  assert.ok(r1.stdout.length < 2300);
  const r2 = H.persistHookText("PreToolUse", { code: 0, stdout: JSON.stringify({ systemMessage: "short", hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: big } }) }, save);
  const j2 = JSON.parse(r2.stdout);
  assert.equal(j2.systemMessage, "short");
  assert.match(j2.hookSpecificOutput.additionalContext, /^<persisted-output>\nOutput too large/);
  assert.equal(H.persistHookText("PreCompact", { code: 0, stdout: big }, save).stdout, big, "PreCompact's stdout: not saved");
  assert.deepEqual(saved.map((x) => x.length), [big.length, big.length]);
  assert.equal(H.persistHookText("PostToolUse", { code: 0, stdout: "small" }, save).stdout, "small");
  // In Coder's loop, with the machine's save.
  const t = await loop([say("", [call("bash", { command: "ls" }, "b1")]), say("ok")], { PostToolUse: cmd("p.sh") }, { hookRun: () => ({ stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: big } }) }), deps: { saveText: save } });
  assert.match(t.told("b1"), /PostToolUse:Bash hook additional context: <persisted-output>\nOutput too large \(13\.7KB\)\. Full output saved to: \/data\/memory\/shop\.out\/k3x9q1a2b\.txt/);
});

test("CD489 a hook's own timeout is kept as given (Claude Code's 600 is a default, not a cap); at most 12 prompt or agent hooks run at once, the rest as those finish", async () => {
  assert.deepEqual([H.timeoutFor("PreToolUse"), H.timeoutFor("PreToolUse", 1800), H.timeoutFor("PreToolUse", 10 ** 9)], [600, 1800, H.HOOK_TIMEOUT_MAX_S]);
  assert.equal(A.MODEL_HOOKS_AT_ONCE, 12);
  let now = 0, most = 0, judged = 0;
  const hooks = { PreToolUse: [{ matcher: "Bash", hooks: Array.from({ length: 15 }, (_, i) => ({ type: "prompt", prompt: "Is this safe? (" + i + ") $ARGUMENTS" })) }] };
  let n = 0;
  await A.runCoder({
    send: async (req) => {
      const sys = String((req.messages[0] && req.messages[0].content) || "");
      if (/You are evaluating a hook|hook/i.test(sys) && req.tools && !req.tools.length) { now++; most = Math.max(most, now); await new Promise((ok) => setTimeout(ok, 30)); now--; judged++; return say('{"ok": true}'); }
      if (!req.tools || !req.tools.length) { now++; most = Math.max(most, now); await new Promise((ok) => setTimeout(ok, 30)); now--; judged++; return say('{"ok": true}'); }
      return n++ === 0 ? say("", [call("bash", { command: "ls" }, "b1")]) : say("ok");
    },
    exec: async () => ({ code: 0, output: "ok\n" }),
    emit: () => {}, here: () => "/work/shop", root: "/work/shop",
  }, { text: "go", mode: "auto", hooks: H.hooksFrom({ hooks }, "settings").list });
  assert.equal(judged, 15, "all of them judged");
  assert.ok(most <= 12 && most >= 2, "at most 12 at once: " + most);
});

test("CD490 a hook's JSON as Claude Code reads it: an answer naming another event is no answer (\"Hook returned incorrect event name: expected '…' but got '…'\"); several JSON lines that are none of a hook's answers are plain text; other broken JSON in its words", () => {
  const r = (stdout, ev = "PreToolUse", hook = {}) => H.hookResult(ev, { code: 0, stdout, stderr: "" }, hook);
  const wrong = r(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", permissionDecision: "allow" } }));
  assert.equal(wrong.kind, "error");
  assert.match(wrong.notice, /^Hook returned incorrect event name: expected 'PreToolUse' but got 'PostToolUse'\. Full stdout: \{\n  "hookSpecificOutput"/);
  assert.equal(r(JSON.stringify({ hookSpecificOutput: { permissionDecision: "allow" } })).kind, "error", "no event name: no answer, as in Claude Code");
  assert.equal(r(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse" } }), "PreToolUse", { onFailure: "block" }).kind, "block", "onFailure block");
  assert.deepEqual([r(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow" } })).kind, r(JSON.stringify({ decision: "block", reason: "x" })).kind], ["ok", "ok"], "an answer without hookSpecificOutput needs no name");
  const logs = '{"level":"info","msg":"start"}\n{"level":"info","msg":"done"}';
  assert.deepEqual([r(logs).kind, r(logs).text], ["ok", logs], "a log of JSON lines: plain text");
  const mixed = '{"decision":"block","reason":"no"}\n{"level":"info"}';
  assert.match(r(mixed).notice, /^Hook output looks like a JSON object but is not valid JSON \u2014 /);
  assert.equal(r("{ not json }").notice.endsWith("Emit the payload with a JSON encoder (jq, ConvertTo-Json, json.dumps) rather than string concatenation so backslashes and quotes inside strings are escaped."), true);
});

test("CD491 with CODER_BASH_EDIT_DIFF on, a git command that moves the work tree takes no diff and PostToolUse says so, as Claude Code's bashEditDiff does (`skipped: true`)", async () => {
  const t = await loop([say("", [call("bash", { command: "git checkout main" }, "b1"), call("bash", { command: "git stash" }, "b2")]), say("ok")], { PostToolUse: cmd("p.sh") }, { opts: { editDiff: true } });
  const posts = t.hookCalls.filter((h) => h.input.hook_event_name === "PostToolUse");
  assert.deepEqual(posts.map((h) => h.input.tool_response.bashEditDiff), [{ skipped: true }, { skipped: true }]);
});

test("CD492 the Notification hooks of a card that waits (\"permission_prompt\") run 6 seconds after it shows, never for a card answered sooner, as Claude Code's; CODER_DISABLE_PERMISSION_PROMPT_NOTIFY_HOOKS turns them off", async () => {
  assert.equal(A.PROMPT_NOTIFY_MS, 6000);
  const N = { Notification: [{ matcher: "permission_prompt", hooks: [{ type: "command", command: "notify.sh" }] }] };
  const steps = [say("", [call("bash", { command: "npm install x" }, "b1")]), say("ok")];
  const slowAsk = (t0) => ({ promptNotifyMs: 15, ask: async () => { await new Promise((ok) => setTimeout(ok, t0)); return { choice: "yes" }; } });
  let t = await loop(steps, N, { mode: "acceptEdits", opts: { fileEdits: false }, deps: slowAsk(80) });
  assert.deepEqual(t.hookCalls.map((h) => [h.input.hook_event_name, h.input.notification_type]), [["Notification", "permission_prompt"]]);
  t = await loop(steps, N, { mode: "acceptEdits", opts: { fileEdits: false }, deps: slowAsk(0) });
  await new Promise((ok) => setTimeout(ok, 40));
  assert.deepEqual(t.hookCalls, [], "answered sooner: none");
  t = await loop(steps, N, { mode: "acceptEdits", opts: { fileEdits: false, promptNotify: false }, deps: slowAsk(80) });
  assert.deepEqual(t.hookCalls, [], "turned off");
  assert.match(readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8"), /promptNotify: !varOn\(rawVars\.CODER_DISABLE_PERMISSION_PROMPT_NOTIFY_HOOKS\)/);
});

test("CD493 the same command under two `if` values (or two shells) is two handlers, each run when it matches (Claude Code: the same handler in two settings files runs once)", () => {
  const all = H.hooksFrom({ hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "guard.sh", if: "Bash(git *)" }, { type: "command", command: "guard.sh", if: "Bash(npm *)" }, { type: "command", command: "guard.sh", if: "Bash(git *)" }] }] } }, "settings").list;
  const run = (c) => H.hooksFor(all, "PreToolUse", "Bash", { tool: "Bash", input: { command: c }, ctx: {} }).map((h) => h.if);
  assert.deepEqual(run("git push"), ["Bash(git *)"], "the same handler twice: once");
  assert.deepEqual(run("npm test"), ["Bash(npm *)"]);
  const two = H.hooksFrom({ hooks: { Stop: [{ hooks: [{ type: "command", command: "x" }, { type: "command", command: "x", shell: "powershell" }] }] } }, "settings").list;
  assert.equal(H.hooksFor(two, "Stop", "").length, 2);
});

test("CD494 the AI's home has a ~/.claude folder, as a Claude Code machine has (the hooks guide's examples write to ~/.claude/…): made at the machine's start when nothing is there, the AI's own", () => {
  const server = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(server, /try \{ mkdirSync\(join\(d\.home, "\.claude"\), \{ mode: 0o755 \}\); if \(dev\) lchownSync\(join\(d\.home, "\.claude"\), dev\.uid, dev\.gid\); \} catch/);
  assert.match(readFileSync(new URL("../container/Dockerfile", import.meta.url), "utf8"), /useradd -m -u 1001 dev && install -d -o dev -g dev -m 755 \/home\/dev\/\.claude/);
});

test("CD495 a PostToolUse hook gets Claude Code's Bash output fields: backgroundTaskId, backgroundedByUser, timedOutAfterMs, returnCodeInterpretation; a new output for a command must have Bash's shape (stdout, stderr, interrupted), else the original stays, in Claude Code's words; a command that could not start fires PostToolUseFailure", async () => {
  const runs = { "npm run dev": { code: -1, background: true, pid: 9, log: "/srv/bg-1.log", jobId: "job1", output: "" }, "npm run build": { code: -1, background: true, timedOut: true, pid: 10, log: "/srv/bg-2.log", jobId: "job2", output: "half\n", size: 5 }, "grep -r TODO src": { code: 1, output: "" }, "make": { code: -1, notStarted: true, output: "The command was not started: this computer's disk is full (ENOSPC) …" } };
  const t = await loop([say("", [call("bash", { command: "npm run dev", run_in_background: true }, "b1"), call("bash", { command: "npm run build", timeout: 60000 }, "b2"), call("bash", { command: "grep -r TODO src" }, "b3"), call("bash", { command: "make" }, "b4")]), say("ok")], { PostToolUse: cmd("p.sh"), PostToolUseFailure: cmd("f.sh") }, { execRun: (x) => runs[x.command] || { code: 0, output: "" }, deps: { bg: { alive: async () => true, stop: async () => true } } });
  const post = (id) => t.hookCalls.find((h) => h.input.tool_use_id === id);
  assert.equal(post("b1").input.tool_response.backgroundTaskId, "job1");
  assert.deepEqual([post("b2").input.tool_response.backgroundTaskId, post("b2").input.tool_response.timedOutAfterMs], ["job2", 60000]);
  assert.equal(post("b3").input.tool_response.returnCodeInterpretation, "No matches found");
  assert.deepEqual([post("b4").input.hook_event_name, /disk is full/.test(post("b4").input.error)], ["PostToolUseFailure", true]);
  // A new output of the wrong shape: the original stays, and the chat says why.
  const o = H.hooksOutcome("PostToolUse", [{ hook: { type: "command", command: "x" }, result: { kind: "ok", json: { hookSpecificOutput: { hookEventName: "PostToolUse", updatedToolOutput: "[redacted]" } } } }], { tool: "Bash" });
  assert.equal(o.updatedOutput, undefined);
  assert.equal(o.notices[0], "PostToolUse hook returned updatedToolOutput that does not match Bash's output shape; using original output. Expected an object with stdout, stderr and interrupted, received string.");
  const ok = H.hooksOutcome("PostToolUse", [{ hook: { type: "command", command: "x" }, result: { kind: "ok", json: { hookSpecificOutput: { hookEventName: "PostToolUse", updatedToolOutput: { stdout: "\n\nclean\n", stderr: "warn ", interrupted: false } } } } }], { tool: "Bash" });
  assert.equal(ok.updatedOutput, "clean\nwarn", "shown as Claude Code shows a result: stdout, then stderr");
  assert.equal(H.hooksOutcome("PostToolUse", [{ hook: { type: "command", command: "x" }, result: { kind: "ok", json: { hookSpecificOutput: { hookEventName: "PostToolUse", updatedToolOutput: "text" } } } }], { tool: "Read" }).updatedOutput, "text", "another tool's: as before");
});

test("CD496 a cd moves the folder FileChanged watches (its names in the current folder, Claude Code's \"working directory\"); the env file CwdChanged and FileChanged hooks write is cleared at every move; the owner's `!` cd runs CwdChanged too", async () => {
  // The owner's `!` cd (the stand-in's exec answers it; its cd is seen through `here`).
  let where = "/work/shop";
  const calls = [];
  await A.runCoder({
    send: async () => say("ok"),
    exec: async (x) => { const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command)); if (mark && x.hook) { calls.push(JSON.parse(x.payload)); return { code: 0, output: "\n" + mark[0] + "\n" }; } if (x.hook || x.envReset) { calls.push({ reset: x.hookEnv }); return { code: 0, output: "" }; } if (x.command === "cd app") where = "/work/shop/app"; return { code: 0, output: "" }; },
    emit: () => {}, here: () => where, root: "/work/shop",
  }, { shell: "cd app", hooks: H.hooksFrom({ hooks: { CwdChanged: cmd("c.sh") } }, "settings").list });
  const cw = calls.find((c) => c.hook_event_name === "CwdChanged");
  assert.deepEqual(cw && [cw.old_cwd, cw.new_cwd], ["/work/shop", "/work/shop/app"]);
  assert.ok(calls.some((c) => c.reset === "cwd"), "its env file cleared first");
  // With only FileChanged hooks, the env file is cleared at a cd all the same.
  where = "/work/shop";
  const calls2 = [];
  let n = 0;
  await A.runCoder({
    send: async () => (n++ === 0 ? say("", [call("bash", { command: "cd app" }, "b1")]) : say("ok")),
    exec: async (x) => { if (x.hook || x.envReset) { calls2.push({ reset: x.hookEnv, tool: x.tool }); return { code: 0, output: "[]" }; } if (x.tool) return { code: 0, output: "[]" }; if (x.command === "cd app") where = "/work/shop/app"; return { code: 0, output: "" }; },
    emit: () => {}, here: () => where, root: "/work/shop",
  }, { text: "go", mode: "auto", hooks: H.hooksFrom({ hooks: { FileChanged: [{ matcher: ".envrc", hooks: [{ type: "command", command: "f.sh" }] }] } }, "settings").list });
  assert.ok(calls2.filter((c) => c.reset === "cwd").length >= 2, "at the start and at the cd");
  // FileChanged's names: in the folder the commands are in now.
  where = "/work/shop/app";
  const looked = [];
  await A.runCoder({
    send: async () => say("ok"),
    exec: async (x) => { const m = /coder-tools\.mjs (\S+)$/.exec(String(x.command)); if (m) { try { const q = JSON.parse(Buffer.from(m[1], "base64").toString("utf8")); if (q.tool === "stamps") looked.push(...q.args.paths); } catch { /* another tool */ } } return { code: 0, output: "[]" }; },
    emit: () => {}, here: () => where, root: "/work/shop",
  }, { text: "go", mode: "auto", hooks: H.hooksFrom({ hooks: { FileChanged: [{ matcher: ".envrc|.env", hooks: [{ type: "command", command: "f.sh" }] }] } }, "settings").list });
  assert.deepEqual(looked.slice(0, 2), ["/work/shop/app/.envrc", "/work/shop/app/.env"]);
});

test("CD497 on a real machine: a hook that runs while the commands' folder is gone runs from the project's folder and leaves the folder as it is, so Coder's next command is told \"Shell cwd was reset to …\" (Claude Code runs a hook from a fallback folder; the session's own is not reset by it)", async () => {
  const root = await mkdtemp(join(tmpdir(), "coder-root-")), home = await mkdtemp(join(tmpdir(), "coder-home-"));
  const mem = await mkdtemp(join(tmpdir(), "coder-mem-")), git = await mkdtemp(join(tmpdir(), "coder-git-")), bgr = await mkdtemp(join(tmpdir(), "coder-bgr-"));
  const replies = [say("", [call("bash", { command: "mkdir -p sub && cd sub" }, "b1")]), say("", [call("bash", { command: "rmdir \"$PWD\"", run_in_background: true }, "b2")]), say("", [call("bash", { command: "pwd" }, "b3")]), say("Done.")];
  let n = 0;
  const srv = http.createServer(S.createApp({ root, home, memRoot: mem, gitRoot: git, bgRoot: bgr, send: async () => replies[Math.min(n++, replies.length - 1)], env: {}, uid: null, gid: null }));
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + srv.address().port;
  try {
    const account = { hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "true" }] }] } };
    const res = await fetch(base + "/turn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: "p9e-cwd", text: "go", messages: [], mode: "auto", hooks: account }) });
    assert.equal(res.status, 200);
    let st;
    for (let i = 0; i < 600; i++) { st = await (await fetch(base + "/state?project=p9e-cwd&since=0")).json(); if (st.result) break; await new Promise((ok) => setTimeout(ok, 50)); }
    const out = (id) => (st.events.find((e) => e.type === "result" && e.id === id) || {}).output || "";
    assert.match(out("b3"), /Shell cwd was reset to \S+p9e-cwd/, out("b3"));
  } finally {
    await new Promise((r) => srv.close(r));
    for (const d of [root, home, mem, git, bgr]) await rm(d, { recursive: true, force: true }).catch(() => {});
  }
});
