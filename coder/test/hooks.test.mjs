// HOOKS (Bash docs, the owner, 2026-11-10: "yea do all 4"): Claude Code's hooks in Coder, each rule from its hooks reference.
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync, writeFileSync, mkdirSync, symlinkSync, mkdtempSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const H = await import("../container/coder-hooks.mjs");
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });

test("CD383 hooks as Claude Code reads them: the settings' shape, its matchers, `if`, deduplication, its exit-code table and each event's decisions, in its words", () => {
  // The settings: { hooks: { Event: [ { matcher, hooks: [ { type, command, timeout } ] } ] } }: command, http, prompt and
  // agent hooks (CD384); an unknown event is named.
  const s = H.hooksFrom({ hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "./no-rm.sh", timeout: 5 }, { type: "prompt", prompt: "x" }] }], Bogus: [] } }, "project");
  assert.deepEqual(s.list, [{ event: "PreToolUse", matcher: "Bash", type: "command", timeout: 5, ownTimeout: true, source: "project", command: "./no-rm.sh" }, { event: "PreToolUse", matcher: "Bash", type: "prompt", timeout: 30, source: "project", prompt: "x" }]);
  assert.deepEqual(s.problems, ["Bogus is not an event Coder has (it has SessionStart, UserPromptSubmit, PreToolUse, PermissionRequest, PostToolUse, PostToolUseFailure, PostToolBatch, PermissionDenied, TaskCreated, TaskCompleted, Notification, Stop, StopFailure, PreCompact, PostCompact, CwdChanged, FileChanged, SessionEnd)"]);
  // Timeouts: 600 seconds, 30 on UserPromptSubmit.
  assert.deepEqual([H.timeoutFor("PreToolUse"), H.timeoutFor("UserPromptSubmit"), H.timeoutFor("Stop", 9999)], [600, 30, 9999], "a hook's own timeout kept (600 is Claude Code's default, no cap: Bash docs pass 9)");
  assert.equal(H.hooksFrom({ disableAllHooks: true }).disabled, true);
  // The owner's box: Claude Code's settings shape or the hooks object alone; checked.
  assert.deepEqual(H.hooksSetting(""), { ok: true, value: null });
  assert.deepEqual(H.hooksSetting('{ "Stop": [ { "hooks": [ { "type": "command", "command": "echo hi" } ] } ] }').value, { hooks: { Stop: [{ hooks: [{ type: "command", command: "echo hi" }] }] } });
  assert.match(H.hooksSetting("{ nope").error, /^The hooks are not valid JSON: /);
  assert.equal(H.hooksSetting('{ "hooks": { "PreToolUse": [ { "hooks": [ { "type": "command" } ] } ] } }').error, "PreToolUse: a command hook needs its command.");
  assert.deepEqual(H.hooksSetting('{ "disableAllHooks": true }').value, { disableAllHooks: true });
  // Matchers: "*", "" or none: all; letters, digits, _, -, spaces, , and |: exact names; anything else: an unanchored regex.
  const m = H.matcherMatches;
  assert.deepEqual([m("*", "Bash"), m("", "Read"), m(undefined, "x"), m("Bash", "Bash"), m("Bash", "BashX"), m("Edit|Write", "Write"), m("Edit, Write", "Edit"), m("Edit.*", "NotebookEdit"), m("^Edit$", "NotebookEdit"), m("mcp__memory__.*", "mcp__memory__x")], [true, true, true, true, false, true, true, true, false, true]);
  // Which hooks run: deduplicated; a Bash matcher also on a Monitor's command (PreToolUse and PermissionRequest only); `if`
  // on a tool event, never on another; no matcher on UserPromptSubmit and Stop.
  const all = [
    { event: "PreToolUse", matcher: "Bash", command: "a.sh", timeout: 600 },
    { event: "PreToolUse", matcher: "Bash", command: "a.sh", timeout: 600 },
    { event: "PreToolUse", matcher: "Edit|Write", command: "fmt.sh", if: "Edit(*.ts)", timeout: 600 },
    { event: "PostToolUse", matcher: "Bash", command: "post.sh", timeout: 600 },
    { event: "Stop", matcher: "Nothing", command: "stop.sh", timeout: 600 },
    { event: "Stop", matcher: "", command: "never.sh", if: "Bash(x)", timeout: 600 },
  ];
  assert.deepEqual(H.hooksFor(all, "PreToolUse", "Bash", { tool: "Bash", input: { command: "ls" } }).map((h) => h.command), ["a.sh"]);
  assert.deepEqual(H.hooksFor(all, "PreToolUse", "Monitor", { tool: "Monitor", input: { command: "tail -f x" } }).map((h) => h.command), ["a.sh"]);
  assert.deepEqual(H.hooksFor(all, "PostToolUse", "Monitor", { tool: "Monitor", input: {} }).map((h) => h.command), []);
  assert.deepEqual(H.hooksFor(all, "PreToolUse", "Edit", { tool: "Edit", input: { file_path: "src/a.ts" }, ctx: { cwd: "/w", root: "/w" } }).map((h) => h.command), ["fmt.sh"]);
  assert.deepEqual(H.hooksFor(all, "PreToolUse", "Edit", { tool: "Edit", input: { file_path: "src/a.js" }, ctx: { cwd: "/w", root: "/w" } }).map((h) => h.command), []);
  assert.deepEqual(H.hooksFor(all, "Stop", "").map((h) => h.command), ["stop.sh"], "Stop has no matcher; a hook with `if` never runs on it");
  // Claude Code's table of stdout × exit code.
  const r = (code, stdout = "", stderr = "", timedOut = false) => H.hookResult("PreToolUse", { code, stdout, stderr, timedOut });
  assert.equal(r(0, '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}').kind, "ok");
  assert.equal(r(1, '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny"}}').kind, "ok", "valid JSON with any other code: the fields decide");
  assert.deepEqual(r(2, "", "Blocked: rm commands are not allowed\n"), { kind: "block", json: null, text: "", reason: "Blocked: rm commands are not allowed", notice: "" });
  assert.deepEqual(r(1, "", "something broke\nmore"), { kind: "error", json: null, text: "", reason: "", notice: "Failed with non-blocking status code: something broke" });
  assert.match(r(0, "{ not json }").notice, /^Hook output looks like a JSON object but is not valid JSON \u2014 .*\. Emit the payload with a JSON encoder \(jq, ConvertTo-Json, json\.dumps\) rather than string concatenation so backslashes and quotes inside strings are escaped\.$/);
  assert.equal(r(0, "[1,2]").kind, "ok", "an array is plain text");
  assert.equal(r(0, "", "", true).notice, "Timed out");
  // Each event's decisions.
  const out = (event, runs, tool) => H.hooksOutcome(event, runs.map(([command, run]) => ({ hook: { command }, result: H.hookResult(event, run) })), { tool });
  const d1 = out("PreToolUse", [["no-rm.sh", { code: 2, stderr: "Blocked: rm commands are not allowed" }], ["ok.sh", { code: 0, stdout: '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}' }]], "Bash");
  assert.deepEqual([d1.decision, d1.reason], ["deny", "PreToolUse:Bash hook error: [command hook]: Blocked: rm commands are not allowed"], "Claude Code's cloud words, a hook named by its kind; deny > ask > allow");
  const d2 = out("PreToolUse", [["a", { code: 0, stdout: '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}' }], ["b", { code: 0, stdout: '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"check first","updatedInput":{"command":"npm test -- --ci"},"additionalContext":"CI is red"}}' }]], "Bash");
  assert.deepEqual([d2.decision, d2.reason, d2.updatedInput, d2.context], ["ask", "check first", { command: "npm test -- --ci" }, ["CI is red"]]);
  assert.equal(out("PreToolUse", [["old", { code: 0, stdout: '{"decision":"approve"}' }]], "Bash").decision, "allow", "the deprecated approve");
  const p = out("PostToolUse", [["lint.sh", { code: 0, stdout: '{"decision":"block","reason":"2 lint errors","hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"fix them first"}}' }]], "Edit");
  assert.deepEqual([p.decision, p.blocks, p.context], ["block", ['PostToolUse:Edit hook blocking error from command: "command hook": 2 lint errors'], ["fix them first"]]);
  assert.equal(out("PostToolUse", [["r", { code: 0, stdout: '{"hookSpecificOutput":{"hookEventName":"PostToolUse","updatedToolOutput":{"stdout":"[redacted]","stderr":"","interrupted":false}}}' }]], "Bash").updatedOutput, "[redacted]");
  const u = out("UserPromptSubmit", [["ctx", { code: 0, stdout: "Branch: main\n" }], ["gate", { code: 0, stdout: '{"decision":"block","reason":"No secrets in prompts"}' }]]);
  assert.deepEqual([u.decision, u.reason, u.context], ["block", "No secrets in prompts", ["Branch: main"]]);
  assert.deepEqual(out("Stop", [["t", { code: 2, stderr: "run the tests first" }]]).blocks, ["Stop hook feedback:\n[command hook]: run the tests first"]);
  assert.deepEqual(out("Stop", [["t", { code: 0, stdout: '{"decision":"block","reason":"run the tests first"}' }]]).blocks, ['Stop hook feedback:\nrun the tests first\n\nStop hook blocking error from command: "command hook": run the tests first']);
  const st = out("PostToolUse", [["s", { code: 0, stdout: '{"continue":false,"stopReason":"Build failed","systemMessage":"heads up"}' }]], "Bash");
  assert.deepEqual([st.stop, st.messages], [{ reason: "Build failed" }, ["heads up"]]);
  assert.deepEqual(out("PreToolUse", [["x", { code: 1, stderr: "oops" }]], "Bash").notices, ["PreToolUse:Bash hook error: [command hook]: Failed with non-blocking status code: oops"]);
  assert.deepEqual(out("SessionStart", [["s", { code: 2, stderr: "nope" }]]).decision, "", "SessionStart can't block");
  const pr = out("PermissionRequest", [["p", { code: 0, stdout: '{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"deny","message":"not on Fridays"}}}' }]], "Bash");
  assert.deepEqual([pr.decision, pr.reason], ["deny", "not on Fridays"]);
  // Inputs as Claude Code names them.
  assert.deepEqual(H.hookToolInput("edit", { path: "a.ts", old_string: "a", new_string: "b" }), { path: "a.ts", old_string: "a", new_string: "b", file_path: "a.ts" });
  assert.deepEqual(H.toolInputFromHook("write", { file_path: "b.ts", content: "x" }), { path: "b.ts", content: "x" });
  assert.deepEqual([H.ccTool("bash"), H.ccTool("bash", true), H.ccTool("stop_job"), H.ccTool("pull_request")], ["Bash", "Monitor", "TaskStop", "pull_request"]);
  assert.doesNotMatch(read("container/coder-hooks.mjs"), /from "node:/);
});

/** Coder's loop with hooks, on a pretend machine: `hookRun(input)` answers each hook ({ code, stdout, stderr }). */
async function hooked(steps, hooks, { hookRun, mode = "auto", text = "go", messages = [], answers = [], askWait = 0, notifyMs } = {}) {
  const { runCoder } = await import("../container/coder-agent.mjs");
  const events = [], seen = [], ran = [], hookCalls = [], cards = [];
  let n = 0, k = 0;
  const r = await runCoder({
    send: async (req) => { seen.push(req); return steps[Math.min(n++, steps.length - 1)]; },
    exec: async (x) => {
      const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
      if (mark && x.hook === true) {
        const input = JSON.parse(x.payload);
        hookCalls.push({ input, command: x.command });
        const a = (await hookRun(input, x.command)) || {};
        return { code: Number.isInteger(a.code) ? a.code : 0, output: String(a.stdout || "") + "\n" + mark[0] + "\n" + String(a.stderr || "") };
      }
      ran.push(x.command);
      return { code: 0, output: "ok\n" };
    },
    emit: (e) => events.push(e),
    here: () => "/work/shop", root: "/work/shop", chatId: "shop-h1", where: (p) => (p.startsWith("/") ? p : "/work/shop/" + p),
    ask: async (pid) => { cards.push(events.find((e) => e.type === "permission" && e.pid === pid)); if (askWait) await new Promise((ok) => setTimeout(ok, askWait)); return answers[k++] || { choice: "yes" }; },
    ...(notifyMs !== undefined ? { promptNotifyMs: notifyMs } : {}),
  }, { text, mode, messages, hooks: H.hooksFrom({ hooks }, "settings").list });
  return { r, events, seen, ran: ran.filter((c) => !/coder-tools\.mjs/.test(c)), hookCalls, cards };
}

test("CD383b in Coder's loop: PreToolUse blocks, rewrites, asks or allows; PostToolUse adds to the result; UserPromptSubmit blocks or adds; SessionStart adds at a chat's start; Stop keeps Coder going (8 times at most); continue:false stops; PermissionRequest answers a card", async () => {
  const hk = (cmd) => [{ hooks: [{ type: "command", command: cmd }] }];
  // PRETOOLUSE: exit 2 blocks the command, its stderr to Coder in Claude Code's words; nothing runs.
  let t = await hooked([say("", [call("bash", { command: "rm -rf build", description: "Clean" }, "b1")]), say("ok")], { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "./no-rm.sh" }] }] }, { hookRun: (i) => (/^rm /.test(i.tool_input.command) ? { code: 2, stderr: "Blocked: rm commands are not allowed" } : {}) });
  assert.deepEqual(t.ran, []);
  assert.equal(t.r.messages.find((m) => m.tool_call_id === "b1").content, "PreToolUse:Bash hook error: [command hook]: Blocked: rm commands are not allowed");
  // Its input: Claude Code's common fields and the call's.
  const inp = t.hookCalls[0].input;
  assert.deepEqual([inp.hook_event_name, inp.session_id, inp.cwd, inp.permission_mode, inp.tool_name, inp.tool_input.command, inp.tool_use_id], ["PreToolUse", "shop-h1", "/work/shop", "auto", "Bash", "rm -rf build", "b1"]);
  assert.match(t.hookCalls[0].command, /export CLAUDE_PROJECT_DIR='\/work\/shop' CODER_PROJECT_DIR='\/work\/shop' CLAUDE_CODE_REMOTE=true; \(\nsh -c '\.\/no-rm\.sh'\n\) < "\$__in" 2>"\$__err"/, "its stdin and stderr, apart; run with sh -c, as Claude Code runs a hook's command");
  // updatedInput: the command that runs is the hook's.
  t = await hooked([say("", [call("bash", { command: "npm test", description: "Test" }, "b1")]), say("ok")], { PreToolUse: hk("ci.sh") }, { hookRun: () => ({ stdout: '{"hookSpecificOutput":{"hookEventName":"PreToolUse","updatedInput":{"command":"npm test -- --ci","description":"Test"}}}' }) });
  assert.deepEqual(t.ran.map((c) => c.split("\n").pop()), ["npm test -- --ci"]);
  // ask: a card even in Auto, with the hook's reason; allow: none in Accept edits for a command that would ask.
  t = await hooked([say("", [call("bash", { command: "ls", description: "List" }, "b1")]), say("ok")], { PreToolUse: hk("ask.sh") }, { hookRun: () => ({ stdout: '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"Listing is watched here"}}' }) });
  assert.deepEqual([t.cards.length, t.cards[0] && t.cards[0].why], [1, "Listing is watched here"]);
  t = await hooked([say("", [call("bash", { command: "npm test", description: "Test" }, "b1")]), say("ok")], { PreToolUse: hk("allow.sh") }, { mode: "acceptEdits", hookRun: () => ({ stdout: '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}' }) });
  assert.deepEqual([t.cards.length, t.ran.length], [0, 1]);
  // POSTTOOLUSE: its block reason and context beside the result; a PreToolUse hook's context too.
  t = await hooked([say("", [call("bash", { command: "npm run build", description: "Build" }, "b1")]), say("ok")], { PreToolUse: hk("pre.sh"), PostToolUse: hk("post.sh") }, { hookRun: (i) => (i.hook_event_name === "PreToolUse" ? { stdout: '{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"Deploy target: staging"}}' } : { stdout: '{"decision":"block","reason":"bundle over 2 MB","hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"see size.log"}}' }) });
  const b1 = t.r.messages.find((m) => m.tool_call_id === "b1").content;
  assert.match(b1, /^ok\n\nPostToolUse:Bash hook blocking error from command: "command hook": bundle over 2 MB\n\n\(Note from Coder's app, not the owner: PreToolUse:Bash hook additional context: Deploy target: staging\)\n\n\(Note from Coder's app, not the owner: PostToolUse:Bash hook additional context: see size\.log\)$/);
  const post = t.hookCalls.find((c) => c.input.hook_event_name === "PostToolUse").input;
  assert.deepEqual([post.tool_response.stdout, post.tool_response.code], ["ok", 0]);
  // USERPROMPTSUBMIT: a block keeps the message from Coder (no model call), in Claude Code's words; plain stdout is context.
  t = await hooked([say("never")], { UserPromptSubmit: hk("gate.sh") }, { text: "my key is sk-123", hookRun: () => ({ stdout: '{"decision":"block","reason":"No keys in messages"}' }) });
  assert.equal(t.seen.length, 0);
  assert.ok(t.events.some((e) => e.type === "note" && e.text === "UserPromptSubmit operation blocked by hook:\nNo keys in messages\n\nOriginal prompt: my key is sk-123"));
  assert.ok(!JSON.stringify(t.r.messages).includes("sk-123"), "kept from Coder's history");
  t = await hooked([say("ok")], { UserPromptSubmit: hk("ctx.sh"), SessionStart: [{ matcher: "startup", hooks: [{ type: "command", command: "start.sh" }] }] }, { text: "hi", hookRun: (i) => ({ stdout: i.hook_event_name === "SessionStart" ? "This repo uses pnpm." : "Branch: main" }) });
  const msgs = t.seen[0].messages.map((m) => m.content);
  const at = msgs.indexOf("hi");
  assert.equal(msgs[at - 1], "(Note from Coder's app, not the owner: SessionStart hook additional context: This repo uses pnpm.)", "at the chat's start, before the first message");
  assert.equal(msgs[at + 1], "(Note from Coder's app, not the owner: UserPromptSubmit hook additional context: Branch: main)");
  t = await hooked([say("ok")], { SessionStart: hk("start.sh") }, { text: "again", messages: [{ role: "user", content: "earlier" }, { role: "assistant", content: "done" }], hookRun: () => ({ stdout: "x" }) });
  assert.equal(t.hookCalls.length, 0, "not on a later message");
  // STOP: a block keeps Coder going with the reason; at most 8 times in a row.
  let stops = 0;
  t = await hooked([say("All done.")], { Stop: hk("tests.sh") }, { hookRun: (i) => { stops++; assert.equal(i.stop_hook_active, stops > 1); assert.equal(i.last_assistant_message, "All done."); return { code: 2, stderr: "Run the tests first." }; } });
  assert.equal(stops, 8);
  assert.equal(t.seen.length, 9);
  assert.equal(t.seen[1].messages.at(-1).content, "(Note from Coder's app, not the owner: Stop hook feedback:\n[command hook]: Run the tests first.)");
  t = await hooked([say("Done."), say("Ran them.")], { Stop: hk("fb.sh") }, { hookRun: (i) => (i.stop_hook_active ? {} : { stdout: '{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"Please run the test suite before finishing"}}' }) });
  assert.equal(t.seen.length, 2);
  assert.match(t.seen[1].messages.at(-1).content, /Stop hook feedback:\nPlease run the test suite before finishing\)$/);
  // CONTINUE: FALSE stops Coder, its reason shown.
  t = await hooked([say("", [call("bash", { command: "make", description: "Build" }, "b1")]), say("never")], { PostToolUse: hk("stop.sh") }, { hookRun: () => ({ stdout: '{"continue":false,"stopReason":"Build failed, fix errors before continuing"}' }) });
  assert.equal(t.seen.length, 1);
  assert.ok(t.events.some((e) => e.type === "note" && e.text === "Build failed, fix errors before continuing"));
  // PERMISSIONREQUEST: allow answers the card for the owner; the NOTIFICATION hooks run when a card waits.
  t = await hooked([say("", [call("bash", { command: "npm test", description: "Test" }, "b1")]), say("ok")], { PermissionRequest: hk("ok.sh") }, { mode: "acceptEdits", hookRun: () => ({ stdout: '{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}' }) });
  assert.deepEqual([t.cards.length, t.ran.length], [0, 1]);
  // (The Notification hooks of a card that waits: after Claude Code's 6 seconds, never for one answered sooner. Bash docs
  // pass 9; here the wait made short.)
  t = await hooked([say("", [call("bash", { command: "npm test", description: "Test" }, "b1")]), say("ok")], { Notification: [{ matcher: "permission_prompt", hooks: [{ type: "command", command: "notify.sh" }] }] }, { mode: "acceptEdits", hookRun: () => ({}) });
  await new Promise((ok) => setTimeout(ok, 20));
  assert.deepEqual(t.hookCalls, [], "answered at once: no notification");
  t = await hooked([say("", [call("bash", { command: "npm test", description: "Test" }, "b1")]), say("ok")], { Notification: [{ matcher: "permission_prompt", hooks: [{ type: "command", command: "notify.sh" }] }] }, { mode: "acceptEdits", hookRun: () => ({}), askWait: 80, notifyMs: 10 });
  await new Promise((ok) => setTimeout(ok, 20));
  assert.deepEqual(t.hookCalls.map((c) => [c.input.hook_event_name, c.input.notification_type, c.input.message]), [["Notification", "permission_prompt", "Coder needs your permission to use Bash"]]);
  // A non-blocking error is shown to the owner, and the command runs.
  t = await hooked([say("", [call("bash", { command: "ls", description: "List" }, "b1")]), say("ok")], { PreToolUse: hk("flaky.sh") }, { hookRun: () => ({ code: 1, stderr: "something broke" }) });
  assert.equal(t.ran.length, 1);
  assert.ok(t.events.some((e) => e.type === "note" && e.text === "PreToolUse:Bash hook error: [command hook]: Failed with non-blocking status code: something broke"));
});

test("CD383c on a real machine: the owner's hooks and the repository's .claude/settings.json run as Coder's commands do, the event's JSON on stdin, exit 2 blocks with stderr, JSON on stdout decides; never the repository's in a job from GitHub, none with disableAllHooks, and never a settings file through a link", async () => {
  const { createApp, hooksForTurn } = await import("../container/server.mjs");
  const roots = { root: await mkdtemp(join(tmpdir(), "coder-hk-")), gitRoot: await mkdtemp(join(tmpdir(), "coder-hkg-")), memRoot: await mkdtemp(join(tmpdir(), "coder-hkm-")), bgRoot: await mkdtemp(join(tmpdir(), "coder-hkb-")) };
  const dir = join(roots.root, "hk-test1");
  mkdirSync(join(dir, ".claude"), { recursive: true });
  // The repository's: a SessionStart hook that prints plain text (context) and saves what it was given.
  writeFileSync(join(dir, ".claude", "settings.json"), JSON.stringify({ hooks: { SessionStart: [{ matcher: "startup", hooks: [{ type: "command", command: "cat > \"$CLAUDE_PROJECT_DIR/start-input.json\"; echo 'This repo is a test shop.'" }] }] } }));
  const node = (js) => "node --no-warnings -e " + JSON.stringify(js);
  const account = { hooks: {
    PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: node("let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);if(/^rm /.test(j.tool_input.command)){console.error('Blocked: rm commands are not allowed');process.exit(2)}})") }] }],
    PostToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: node("let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log(JSON.stringify({hookSpecificOutput:{hookEventName:'PostToolUse',additionalContext:'saw '+j.tool_name+' in '+j.permission_mode+' printing '+JSON.stringify(j.tool_response.stdout)}}))})") }] }],
  } };
  const steps = [say("", [call("bash", { command: "rm -rf build", description: "Clean" }, "b1"), call("bash", { command: "echo hello", description: "Say hi" }, "b2")]), say("Done.")];
  let n = 0;
  const seen = [];
  const app = createApp({ ...roots, send: async (req) => { seen.push(req); return steps[Math.min(n++, steps.length - 1)]; } });
  const srv = http.createServer(app);
  await new Promise((r) => srv.listen(0, r));
  const base = "http://127.0.0.1:" + srv.address().port;
  try {
    await fetch(base + "/turn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: "hk-test1", text: "clean and greet", messages: [], hooks: account }) });
    let st;
    for (let i = 0; i < 200; i++) { st = await (await fetch(base + "/state?project=hk-test1&since=0")).json(); if (st.result) break; await new Promise((r) => setTimeout(r, 100)); }
    const last = seen.at(-1).messages;
    assert.equal(last.find((m) => m.role === "tool" && m.tool_call_id === "b1").content, "PreToolUse:Bash hook error: [command hook]: Blocked: rm commands are not allowed");
    assert.equal(last.find((m) => m.role === "tool" && m.tool_call_id === "b2").content, "hello\n\n(Note from Coder's app, not the owner: PostToolUse:Bash hook additional context: saw Bash in auto printing \"hello\")");
    assert.ok(seen[0].messages.some((m) => m.content === "(Note from Coder's app, not the owner: SessionStart hook additional context: This repo is a test shop.)"));
    const startIn = JSON.parse(readFileSync(join(dir, "start-input.json"), "utf8"));
    assert.deepEqual([startIn.hook_event_name, startIn.source, startIn.session_id], ["SessionStart", "startup", "hk-test1"]);
  } finally { srv.close(); }
  // Which hooks a message gets.
  const d2 = mkdtempSync(join(tmpdir(), "coder-hk2-"));
  mkdirSync(join(d2, ".claude"));
  writeFileSync(join(d2, ".claude", "settings.local.json"), JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: "local.sh" }] }] } }));
  assert.deepEqual(hooksForTurn(d2, account).map((h) => [h.event, h.source]), [["PreToolUse", "settings"], ["PostToolUse", "settings"], ["Stop", "project"]]);
  assert.deepEqual(hooksForTurn(d2, account, { github: true }).map((h) => h.source), ["settings", "settings"], "not the repository's in a job from GitHub");
  assert.deepEqual(hooksForTurn(d2, { ...account, disableAllHooks: true }), []);
  writeFileSync(join(d2, ".claude", "settings.json"), JSON.stringify({ disableAllHooks: true }));
  assert.deepEqual(hooksForTurn(d2, account), [], "the repository's own disableAllHooks");
  const d3 = mkdtempSync(join(tmpdir(), "coder-hk3-"));
  const outside = mkdtempSync(join(tmpdir(), "coder-hk3o-"));
  writeFileSync(join(outside, "settings.json"), JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: "evil.sh" }] }] } }));
  symlinkSync(outside, join(d3, ".claude"));
  assert.deepEqual(hooksForTurn(d3, null), [], "a .claude that is a link out of the project");
});

test("CD383d Settings has the owner's hooks: a box of Claude Code's settings JSON, checked by the Worker, sent with each message", async () => {
  const R = await import("../src/coder-routes.mjs");
  const good = '{ "hooks": { "PreToolUse": [ { "matcher": "Bash", "hooks": [ { "type": "command", "command": "./check.sh" } ] } ] } }';
  assert.deepEqual(R.prefsChange({}, { hooks: good }).prefs.hooks, good);
  assert.match(R.prefsChange({}, { hooks: "{" }).error, /^The hooks are not valid JSON/);
  assert.equal(R.prefsChange({}, { hooks: 5 }).error, "The hooks are JSON text.");
  assert.deepEqual(R.machineHooks({ hooks: good }), JSON.parse(good));
  assert.equal(R.machineHooks({}), null);
  assert.match(read("src/coder-routes.mjs"), /prefs: machinePrefs\(saved\), hooks: machineHooks\(saved\),/);
  const page = read("public/coder.js");
  assert.match(page, /'<div class="cd-set-head">Hooks<\/div>'/);
  assert.match(page, /<textarea id="cdSetHooks" class="cd-set-hooks"/);
  assert.match(page, /\$\('cdSetHooksSave'\)\.onclick = \(\) => save\('hooks', hooksDraft\);/);
  assert.match(read("container/Dockerfile"), / coder-filerules\.mjs coder-hooks\.mjs /);
  // A call a hook blocked shows the hook's words under its step, and "✕ blocked by hook" (as an auto mode block does).
  const grab = (name) => page.slice(page.indexOf("  function " + name + "("), page.indexOf("\n  }\n", page.indexOf("  function " + name + "(")) + 4);
  const esc = (x) => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const { stepAutoBlock, hookBlockOf } = new Function("esc", grab("noColor") + grab("autoBlockOf") + grab("hookBlockOf") + grab("hookWords") + grab("stepAutoBlock") + "return { stepAutoBlock, hookBlockOf };")(esc);
  const r = { code: -1, hookBlocked: true, output: "PreToolUse:Bash hook error: [command hook]: Blocked: rm commands are not allowed" };
  assert.deepEqual(hookBlockOf(r), { event: "PreToolUse:Bash", why: "[command hook]: Blocked: rm commands are not allowed" });
  assert.equal(stepAutoBlock(r), '<div class="cd-autoblock"><div class="cd-autoblock-head">Blocked by your hook</div><div class="cd-autoblock-why cd-hookblock-why">PreToolUse:Bash hook error: [command hook]: Blocked: rm commands are not allowed</div></div>');
  // (A hook's "no" in JSON has no brackets in Claude Code's words: the box shows it too.)
  assert.deepEqual(hookBlockOf({ code: -1, hookBlocked: true, output: "PreToolUse:Bash hook error: Blocked by hook" }), { event: "PreToolUse:Bash", why: "Blocked by hook" });
  assert.equal(hookBlockOf({ code: -1, output: r.output }), null, "only a step the loop marked as blocked by a hook");
  assert.match(page, /hookBlockOf\(r\) \? 'blocked by hook'/);
});
