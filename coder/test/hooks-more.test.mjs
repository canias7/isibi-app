// THE REST OF CLAUDE CODE'S HOOKS (Bash docs, the owner, 2026-11-10: "yea do all of them"): its other hook kinds (http,
// prompt, agent), its background hooks (async, asyncRewake), onFailure, the quiet-output rule, CLAUDE_ENV_FILE, bashEditDiff,
// and its events CwdChanged, FileChanged, PostToolBatch, PermissionDenied, StopFailure and SessionEnd.
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const H = await import("../container/coder-hooks.mjs");
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const hk = (cmd, more = {}) => [{ hooks: [{ type: "command", command: cmd, ...more }] }];
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));

test("CD384 Claude Code's other hook kinds and fields, as it reads them: http, prompt and agent hooks and where each runs; their timeouts; async, asyncRewake and onFailure; the narrow matcher; what each new event's output means", () => {
  // THE KINDS: http (a url), prompt and agent (a prompt); SessionStart takes only command hooks, PermissionRequest no agent
  // hook, the observing events command and http; mcp_tool is named (Coder has no MCP servers).
  const s = H.hooksFrom({
    allowedHttpHookUrls: ["https://hooks.example.com/*"], httpHookAllowedEnvVars: ["MY_TOKEN"],
    hooks: {
      PreToolUse: [{ matcher: "Bash", hooks: [{ type: "http", url: "https://hooks.example.com/pre", headers: { Authorization: "Bearer $MY_TOKEN", "Bad Header": "x" }, allowedEnvVars: ["MY_TOKEN"], onFailure: "block", timeout: 9 }, { type: "prompt", prompt: "Safe? $ARGUMENTS", continueOnBlock: true, model: "claude-x" }, { type: "agent", prompt: "Look first", statusMessage: "Checking…" }] }],
      PostToolUse: [{ matcher: "Write", hooks: [{ type: "command", command: "./tests.sh", async: true }, { type: "command", command: "./watch.sh", asyncRewake: true, timeout: 120 }, { type: "mcp_tool", server: "x", tool: "y" }] }],
      SessionStart: [{ hooks: [{ type: "http", url: "https://hooks.example.com/s" }] }],
      PermissionRequest: [{ hooks: [{ type: "agent", prompt: "x" }] }],
      CwdChanged: [{ hooks: [{ type: "prompt", prompt: "x" }] }],
      Stop: [{ hooks: [{ type: "http", url: "ftp://x" }, { type: "prompt" }] }],
    },
  });
  assert.deepEqual(s.list, [
    { event: "PreToolUse", matcher: "Bash", type: "http", timeout: 9, ownTimeout: true, source: "settings", url: "https://hooks.example.com/pre", headers: { Authorization: "Bearer $MY_TOKEN" }, allowedEnvVars: ["MY_TOKEN"], onFailure: "block" },
    { event: "PreToolUse", matcher: "Bash", type: "prompt", timeout: 30, source: "settings", prompt: "Safe? $ARGUMENTS", model: "claude-x", continueOnBlock: true },
    { event: "PreToolUse", matcher: "Bash", type: "agent", timeout: 60, statusMessage: "Checking…", source: "settings", prompt: "Look first" },
    { event: "PostToolUse", matcher: "Write", type: "command", timeout: 600, source: "settings", command: "./tests.sh", async: true },
    { event: "PostToolUse", matcher: "Write", type: "command", timeout: 120, ownTimeout: true, source: "settings", command: "./watch.sh", asyncRewake: true },
  ]);
  assert.deepEqual(s.problems, ["PostToolUse: mcp_tool hooks don't run on Coder (it has no MCP servers)", "SessionStart doesn't take http hooks", "PermissionRequest doesn't take agent hooks", "CwdChanged doesn't take prompt hooks", "Stop: an http hook needs an http or https url", "Stop: a prompt hook needs its prompt"]);
  assert.deepEqual([s.httpUrls, s.httpEnvVars], [["https://hooks.example.com/*"], ["MY_TOKEN"]]);
  assert.deepEqual([H.typesFor("SessionStart"), H.typesFor("PermissionRequest"), H.typesFor("FileChanged"), H.typesFor("PostToolBatch")], [["command"], ["command", "http", "prompt"], ["command", "http"], ["command", "http", "prompt", "agent"]]);
  // TIMEOUTS: 30 for prompt, 60 for agent; SessionEnd shares 1.5 seconds, raised by a hook's own up to 60, or set outright.
  assert.deepEqual([H.timeoutFor("Stop", undefined, "prompt"), H.timeoutFor("Stop", undefined, "agent"), H.timeoutFor("SessionEnd")], [30, 60, 1.5]);
  const se = H.hooksFrom({ hooks: { SessionEnd: [{ hooks: [{ type: "command", command: "a" }, { type: "command", command: "b", timeout: 10 }] }] } }).list;
  assert.deepEqual([H.sessionEndBudget(se.slice(0, 1)), H.sessionEndBudget(se), H.sessionEndBudget([{ event: "SessionEnd", ownTimeout: true, timeout: 500 }]), H.sessionEndBudget(se, "5000")], [1.5, 10, 60, 5]);
  // THE OWNER'S BOX keeps the allowlists.
  assert.deepEqual(H.hooksSetting('{ "allowedHttpHookUrls": [], "hooks": {} }').value, { hooks: {}, allowedHttpHookUrls: [] });
  // THE NARROW MATCHER (FileChanged, StopFailure): only letters, digits, _ and | are exact names.
  const m = H.matcherMatches;
  assert.deepEqual([m("rate_limit|overloaded", "overloaded", true), m("rate_limit", "rate_limit_x", true), m("server-error", "server-error", true), m(".envrc|package.json", "package.json", true), m("a, b", "b", true), m("a, b", "b")], [true, false, true, true, false, true]);
  // EVENTS WITH NO MATCHER: PostToolBatch and CwdChanged; FileChanged by the file's name.
  const all = [{ event: "PostToolBatch", matcher: "Nope", type: "command", command: "batch" }, { event: "CwdChanged", matcher: "Nope", type: "command", command: "cwd" }, { event: "FileChanged", matcher: ".envrc|.env", type: "command", command: "fc" }];
  assert.deepEqual([H.hooksFor(all, "PostToolBatch", "").length, H.hooksFor(all, "CwdChanged", "").length, H.hooksFor(all, "FileChanged", ".env").length, H.hooksFor(all, "FileChanged", "a.env").length], [1, 1, 1, 1], "a regular expression, unanchored");
  assert.deepEqual(H.watchedNames(all), [".envrc", ".env"]);
  // ONFAILURE "block": a failure does what exit 2 does, in Claude Code's words; never on Stop or in the background.
  const r = (event, run, hook = { type: "command" }) => H.hookResult(event, run, hook);
  assert.deepEqual(r("PreToolUse", { code: 1, stderr: "lint broke\n" }, { type: "command", onFailure: "block" }), { kind: "block", json: null, text: "", reason: 'failed; blocking because onFailure is "block"\nlint broke', notice: "", failBlock: true });
  assert.equal(r("PreToolUse", { code: 0, timedOut: true }, { type: "command", onFailure: "block" }).reason, 'timed out; blocking because onFailure is "block"');
  assert.equal(r("PreToolUse", { code: 1, stdout: '{"decision":"approve"}' }, { type: "command", onFailure: "block" }).kind, "block", "any other exit code fails, even with JSON");
  assert.equal(r("Stop", { code: 1, stderr: "x" }, { type: "command", onFailure: "block" }).kind, "error");
  assert.equal(r("PostToolUse", { code: 1, stderr: "x" }, { type: "command", async: true, onFailure: "block" }).kind, "error");
  const out1 = H.hooksOutcome("PreToolUse", [{ hook: { type: "command", command: "./lint.sh" }, result: r("PreToolUse", { code: 1, stderr: "lint broke" }, { type: "command", onFailure: "block" }) }], { tool: "Bash" });
  assert.equal(out1.reason, 'PreToolUse:Bash hook error: [command hook]: failed; blocking because onFailure is "block"\nlint broke');
  assert.equal(H.hooksOutcome("PermissionRequest", [{ hook: { type: "command", command: "p" }, result: r("PermissionRequest", { code: 3, stderr: "down" }, { type: "command", onFailure: "block" }) }], { tool: "Bash" }).decision, "deny", "PermissionRequest: denied");
  // THE QUIET RULE (a hook that left a program holding its output): not believed when it grants, rewrites or injects, or
  // printed JSON cut short; a deny still counts.
  assert.equal(r("PreToolUse", { code: 0, quiet: true, stdout: '{"hookSpecificOutput":{"permissionDecision":"allow"}}' }).reason, H.QUIET_GRANT);
  assert.equal(r("PostToolUse", { code: 0, quiet: true, stdout: '{"hookSpecificOutput":{"additionalContext":"x"}}' }).reason, H.QUIET_GRANT);
  assert.equal(r("PreToolUse", { code: 0, quiet: true, stdout: '{"hookSpecificOutput":' }).reason, H.QUIET_PARTIAL);
  assert.equal(r("PreToolUse", { code: 0, quiet: true, stdout: '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny"}}' }).kind, "ok");
  assert.match(H.QUIET_GRANT, /stdio went quiet .* refusing to honor the suspect capture$/);
  // HTTP RESPONSES (Claude Code's "HTTP response handling").
  const hr = (http0, hook = { type: "http" }) => H.hookResult("PreToolUse", { http: http0 }, hook);
  assert.deepEqual([hr({ status: 204, body: "" }).kind, hr({ status: 200, body: '{"decision":"block"}' }).json, hr({ status: 200, body: "plain" }).notice, hr({ status: 503, body: "" }).notice, hr({ error: "connect ECONNREFUSED" }).notice], ["ok", { decision: "block" }, "The response was not a JSON object", "Request failed with status 503", "Request failed: connect ECONNREFUSED"]);
  assert.equal(hr({ status: 503 }, { type: "http", onFailure: "block" }).reason, 'failed; blocking because onFailure is "block"\nHTTP 503');
  assert.deepEqual(H.hookResult("PreToolUse", { notRun: "Not run: its URL is not in allowedHttpHookUrls" }, { type: "http" }).notice, "Not run: its URL is not in allowedHttpHookUrls");
  // PROMPT AND AGENT VERDICTS, per event (Claude Code's table).
  const v = (event, verdict, hook = { type: "prompt" }, tool = "Bash") => H.hooksOutcome(event, [{ hook, result: H.hookResult(event, { verdict }, hook) }], { tool });
  const pre = v("PreToolUse", { ok: false, reason: "no rm" });
  assert.deepEqual([pre.decision, pre.reason, pre.endTurn], ["deny", "PreToolUse:Bash hook (prompt): no rm", "no rm"], "denied, and the turn ends");
  assert.deepEqual([v("PreToolUse", { ok: false, reason: "no" }, { type: "prompt", continueOnBlock: true }).endTurn, v("PreToolUse", { ok: false, reason: "no" }, { type: "agent" }).endTurn], ["", ""], "continueOnBlock, and an agent hook: the turn goes on");
  assert.deepEqual([v("PostToolUse", { ok: false, reason: "bad" }).endTurn, v("PostToolUse", { ok: false, reason: "bad" }, { type: "agent" }).blocks], ["bad", ["PostToolUse:Bash hook (agent): bad"]]);
  assert.deepEqual([v("Stop", { ok: false, reason: "run tests" }).decision, v("Stop", { ok: false, reason: "never", impossible: true }).decision, v("Stop", { ok: true }).decision], ["block", "", ""]);
  assert.deepEqual([v("PermissionRequest", { ok: false, reason: "x" }).decision, v("UserPromptSubmit", { ok: false, reason: "secrets" }).reason], ["", "secrets"]);
  // THE NEW EVENTS' OUTPUT.
  const o = (event, stdout, code = 0) => H.hooksOutcome(event, [{ hook: { type: "command", command: "h" }, result: H.hookResult(event, { code, stdout }) }], { tool: "Bash" });
  assert.equal(o("PermissionDenied", '{"hookSpecificOutput":{"hookEventName":"PermissionDenied","retry":true}}').retry, true);
  assert.deepEqual(o("StopFailure", '{"systemMessage":"x","continue":false}'), o("SessionEnd", '{"systemMessage":"y"}'), "their output is not used");
  const cw = o("CwdChanged", '{"continue":false,"systemMessage":"moved","hookSpecificOutput":{"hookEventName":"CwdChanged","watchPaths":["/w/.envrc","rel/x"]}}');
  assert.deepEqual([cw.stop, cw.messages, cw.watchPaths], [null, ["moved"], ["/w/.envrc"]], "continue is not used there; absolute paths only");
  const ss = o("SessionStart", '{"hookSpecificOutput":{"hookEventName":"SessionStart","sessionTitle":"Fix the cart","watchPaths":["/w/.env"]}}');
  assert.deepEqual([ss.sessionTitle, ss.watchPaths], ["Fix the cart", ["/w/.env"]]);
  assert.equal(o("UserPromptSubmit", '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","sessionTitle":"Cart bug"}}').sessionTitle, "Cart bug");
  // A BACKGROUND HOOK'S NEWS: its JSON alone (several lines) or on a line of its own; an asyncRewake one's stderr at exit 2.
  assert.deepEqual(H.asyncHookTexts({ async: true }, { code: 0, stdout: '{\n  "hookSpecificOutput": {"additionalContext": "tests failed"},\n  "systemMessage": "heads up"\n}\n' }), ["tests failed", "heads up"]);
  assert.deepEqual(H.asyncHookTexts({ async: true }, { code: 0, stdout: 'running…\n{"hookSpecificOutput":{"additionalContext":"3 passed"}}\n' }), ["3 passed"]);
  assert.deepEqual([H.asyncHookTexts({ asyncRewake: true }, { code: 2, stdout: "out", stderr: "build broke\n" }), H.asyncHookTexts({ asyncRewake: true }, { code: 2, stdout: "only stdout\n", stderr: "" }), H.asyncHookTexts({ asyncRewake: true }, { code: 1, stderr: "x" })], [["build broke"], ["only stdout"], []]);
  // A PROMPT: $ARGUMENTS is the input, \$ a dollar; with none, the input after it.
  assert.equal(H.hookPrompt("Costs \\$1.00? $ARGUMENTS", { a: 1 }), 'Costs $1.00? {"a":1}');
  assert.equal(H.hookPrompt("Check this.", { a: 1 }), 'Check this.\n\n{"a":1}');
  assert.deepEqual([H.parseHookVerdict('Sure: {"ok": false, "reason": "no"}'), H.parseHookVerdict("ok"), H.parseHookVerdict('{"ok": "yes"}')], [{ ok: false, reason: "no", impossible: false }, null, null]);
  // ALLOWEDHTTPHOOKURLS: * a wildcard, the host's case and its final dot ignored; an empty list blocks all; none set allows all.
  assert.deepEqual([H.httpUrlAllowed("https://HOOKS.example.com./a", ["https://hooks.example.com/*"]), H.httpUrlAllowed("http://localhost:8080/x", ["http://localhost:*"]), H.httpUrlAllowed("https://evil.example/", ["https://hooks.example.com/*"]), H.httpUrlAllowed("https://a.b/", []), H.httpUrlAllowed("https://a.b/", undefined)], [true, true, false, false, true]);
  // STOPFAILURE'S KINDS.
  assert.deepEqual([429, 503, 401, 402, 404, 400, 500, 0].map((status) => H.stopFailureKind({ status })), ["rate_limit", "overloaded", "authentication_failed", "billing_error", "model_not_found", "invalid_request", "server_error", "unknown"]);
  // A COMMAND HOOK'S SHELL: exec form quoted word by word; its output split at its mark, Coder's own end line left out.
  assert.match(H.hookShell({ command: "/x/check.sh", args: ["a b", "it's"] }, "<<m>>", "/w"), /\(\n'\/x\/check\.sh' 'a b' 'it'\\''s'\n\)/);
  assert.match(H.hookShell({ command: "x" }, "<<m>>", "/w"), /if \[ -n "\$\{CLAUDE_ENV_FILE:-\}" \]; then mkdir -p "\$\{CLAUDE_ENV_FILE%\/\*\}" 2>\/dev\/null; fi; export CLAUDE_PROJECT_DIR='\/w'/);
  assert.deepEqual(H.splitHookOut("out\n<<m>>\nerr\n\n[finished, exit code 2]\n", "<<m>>"), { stdout: "out", stderr: "err\n" });
  assert.doesNotMatch(read("container/coder-hooks.mjs"), /from "node:/);
});

/** Coder's loop with hooks on a pretend machine. `judge(req, n)` answers prompt and agent hooks; `tools` answers coder-tools.mjs. */
async function loop(steps, hooks, { judge = () => say('{"ok": true}'), checkerSays = null, tools = {}, hookRun = () => ({}), mode = "auto", text = "go", messages = [], cwd = { now: "/work/shop" }, onRun = null, more = {}, opts = {} } = {}) {
  const { runCoder } = await import("../container/coder-agent.mjs");
  const events = [], seen = [], ran = [], hookCalls = [], judged = [], execs = [], checks = [];
  let n = 0;
  const r = await runCoder({
    send: async (req) => {
      const sys = String((req.messages[0] && req.messages[0].content) || "");
      if (sys.startsWith(H.HOOK_JUDGE)) { judged.push(req); return await judge(req, judged.length); }
      if (/^You are the safety checker/.test(sys)) { checks.push(req); const v = checkerSays(req); if (v instanceof Error) throw v; return { message: { role: "assistant", content: v }, usage: { in: 2, out: 1 } }; }
      seen.push(req);
      const s = steps[Math.min(n++, steps.length - 1)];
      if (s instanceof Error) throw s;
      return s;
    },
    exec: async (x) => {
      execs.push(x);
      const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
      if (mark && x.hook === true) {
        const input = JSON.parse(x.payload);
        hookCalls.push({ input, x });
        const a = (await hookRun(input, x)) || {};
        return { code: Number.isInteger(a.code) ? a.code : 0, output: String(a.stdout || "") + "\n" + mark[0] + "\n" + String(a.stderr || ""), ...(a.quiet ? { quiet: true } : {}), ...(a.timedOut ? { timedOut: true } : {}), ...(a.background ? { background: true } : {}) };
      }
      const tm = /coder-tools\.mjs (\S+)$/.exec(String(x.command));
      if (tm) {
        const req = tm[1] === "@REQUEST" ? JSON.parse(x.payload) : JSON.parse(Buffer.from(tm[1], "base64").toString("utf8"));
        const f = tools[req.tool];
        if (!f) return { code: 0, output: "" };
        const out = await f(req.args, x);
        return typeof out === "string" ? { code: 0, output: out } : out;
      }
      if (x.envReset) return { code: 0, output: "" };
      ran.push(x.command);
      if (typeof onRun === "function") { const o = await onRun(x.command, x); if (o) return o; }
      return { code: 0, output: "ok\n" };
    },
    emit: (e) => events.push(e),
    here: () => cwd.now, root: "/work/shop", chatId: "shop-h2", where: (p) => (p.startsWith("/") ? p : cwd.now + "/" + p),
    ask: async () => ({ choice: "yes" }),
    ...more,
  }, { text, mode, messages, hooks: Array.isArray(hooks) ? hooks : H.hooksFrom({ hooks }, "settings").list, ...opts });
  return { r, events, seen, ran, hookCalls, judged, execs, checks };
}

test("CD384b in Coder's loop: prompt and agent hooks judge with Coder's model; PostToolBatch, PermissionDenied, StopFailure, CwdChanged and FileChanged run when Claude Code runs them; background hooks report later; HTTP hooks go out from the machine; bashEditDiff; a hook's chat title", async () => {
  // A PROMPT HOOK on PreToolUse: Coder's model at low effort judges the call with its input; "ok": false denies it and ends
  // the turn (a warning in the chat); the round's other calls do not run.
  let t = await loop([say("", [call("bash", { command: "rm -rf build", description: "Clean" }, "b1"), call("bash", { command: "ls", description: "List" }, "b2")]), say("never")], { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "prompt", prompt: "Is this safe? $ARGUMENTS" }] }] }, { judge: () => say('{"ok": false, "reason": "rm is not allowed here"}') });
  assert.deepEqual([t.ran, t.seen.length], [[], 1]);
  assert.equal(t.r.messages.find((m) => m.tool_call_id === "b1").content, "PreToolUse:Bash hook (prompt): rm is not allowed here");
  assert.equal(t.r.messages.find((m) => m.tool_call_id === "b2").content, "not run: a hook ended this turn");
  assert.ok(t.events.some((e) => e.type === "note" && e.warn === true && e.text === "PreToolUse hook: rm is not allowed here"));
  assert.match(t.judged[0].messages[1].content, /^Is this safe\? \{"session_id":"shop-h2","prompt_id":"[0-9a-f-]{36}","cwd":"\/work\/shop","scratchpad_dir":"\/tmp\/coder-scratch","permission_mode":"auto","hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":\{"command":"rm -rf build"/);
  assert.deepEqual([t.judged[0].effort, t.judged[0].webSearch, t.judged[0].tools], ["low", false, []]);
  assert.equal(t.r.usage.length, 2, "the hook's call counts");
  // continueOnBlock: denied, and Coder goes on.
  t = await loop([say("", [call("bash", { command: "rm -rf build" }, "b1")]), say("ok")], { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "prompt", prompt: "x", continueOnBlock: true }] }] }, { judge: () => say('{"ok": false, "reason": "no"}') });
  assert.deepEqual([t.ran.length, t.seen.length], [0, 2]);
  // AN AGENT HOOK looks first (read, grep, glob; the owner's Read rules hold), then answers.
  const reads = [];
  t = await loop([say("", [call("bash", { command: "npm test" }, "b1")]), say("ok")], { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "agent", prompt: "Does package.json have a test script?" }] }] }, {
    judge: (req, k) => (k === 1 ? say("", [call("read", { path: "package.json" }, "r1"), call("read", { file_path: ".env" }, "r2"), call("bash", { command: "rm -rf /" }, "r3")]) : say('{"ok": true}')),
    tools: { read: (a) => { reads.push(a.path); return "     1\t{\"scripts\":{\"test\":\"node --test\"}}"; } },
    opts: { rules: { deny: ["Read(.env)"] } },
  });
  assert.deepEqual(reads, ["/work/shop/package.json"]);
  assert.deepEqual(t.judged[0].tools.map((x) => x.function.name).sort(), ["glob", "grep", "read"]);
  const back = t.judged[1].messages.filter((m) => m.role === "tool").map((m) => m.content);
  assert.equal(back[0], '     1\t{"scripts":{"test":"node --test"}}');
  assert.match(back[1], /^error: /, "the owner's Read deny rule");
  assert.equal(back[2], "error: only read, grep and glob work here");
  assert.equal(t.ran.length, 1);
  // A STOP PROMPT HOOK: "ok": false keeps Coder going with its reason; "impossible": true lets it stop.
  let k2 = 0;
  t = await loop([say("Done."), say("Done, tests run.")], { Stop: [{ hooks: [{ type: "prompt", prompt: "Were the tests run? $ARGUMENTS" }] }] }, { judge: () => say(++k2 === 1 ? '{"ok": false, "reason": "run the tests"}' : '{"ok": true}') });
  assert.equal(t.seen.length, 2);
  assert.equal(t.seen[1].messages.at(-1).content, "(Note from Coder's app, not the owner: Stop hook (prompt): run the tests)");
  t = await loop([say("Done.")], { Stop: [{ hooks: [{ type: "prompt", prompt: "x" }] }] }, { judge: () => say('{"ok": false, "reason": "never", "impossible": true}') });
  assert.equal(t.seen.length, 1);
  // A prompt hook that takes too long, or whose model fails: a non-blocking error, and the call runs.
  t = await loop([say("", [call("bash", { command: "ls" }, "b1")]), say("ok")], { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "prompt", prompt: "x", timeout: 1 }] }] }, { judge: () => new Promise(() => {}) });
  assert.equal(t.ran.length, 1);
  assert.ok(t.events.some((e) => e.type === "note" && e.text === "PreToolUse:Bash hook error: [prompt hook]: Timed out"));
  // POSTTOOLBATCH: the round's calls with their results, once they are all done; what it adds goes to Coder; a block ends the turn.
  t = await loop([say("", [call("bash", { command: "ls" }, "b1"), call("bash", { command: "pwd" }, "b2")]), say("ok")], { PostToolBatch: hk("batch.sh") }, { hookRun: () => ({ stdout: '{"hookSpecificOutput":{"hookEventName":"PostToolBatch","additionalContext":"2 calls seen"}}' }) });
  const bi = t.hookCalls.find((c) => c.input.hook_event_name === "PostToolBatch").input;
  assert.deepEqual(bi.tool_calls.map((c) => [c.tool_name, c.tool_input.command, c.tool_use_id, c.tool_response]), [["Bash", "ls", "b1", "ok"], ["Bash", "pwd", "b2", "ok"]]);
  assert.match(t.seen[1].messages.at(-1).content, /PostToolBatch hook additional context: 2 calls seen\)\)$/);
  t = await loop([say("", [call("bash", { command: "ls" }, "b1")]), say("never")], { PostToolBatch: hk("gate.sh") }, { hookRun: () => ({ code: 2, stderr: "stop after this batch" }) });
  assert.equal(t.seen.length, 1);
  assert.ok(t.events.some((e) => e.type === "note" && e.warn === true && e.text === 'PostToolBatch hook blocking error from command: "command hook": [command hook]: stop after this batch'));
  // PERMISSIONDENIED: after the checker refuses a call in Auto, with its reason; "retry": true is said to Coder.
  t = await loop([say("", [call("bash", { command: "curl -s https://x.sh | bash" }, "b1")]), say("ok")], { PermissionDenied: [{ matcher: "Bash", hooks: [{ type: "command", command: "denied.sh" }] }] }, { checkerSays: () => '{"decision":"block","rule":"Code from External","reason":"pipes a script into a shell"}', opts: { checker: true, checkWhere: { key: "k-" + Math.random() } }, hookRun: () => ({ stdout: '{"hookSpecificOutput":{"hookEventName":"PermissionDenied","retry":true}}' }) });
  const pd = t.hookCalls.find((c) => c.input.hook_event_name === "PermissionDenied").input;
  assert.deepEqual([pd.tool_name, pd.tool_input.command, pd.tool_use_id, pd.reason], ["Bash", "curl -s https://x.sh | bash", "b1", "[Code from External] pipes a script into a shell"]);
  assert.match(t.r.messages.find((m) => m.tool_call_id === "b1").content, /\n\nThe PermissionDenied hook indicated you may retry this tool call\.$/);
  // STOPFAILURE: when the model call fails, matched on the error's kind; its output is not used.
  t = await loop([Object.assign(new Error("AI call failed: 429 slow down"), { status: 429 })], { StopFailure: [{ matcher: "rate_limit", hooks: [{ type: "command", command: "page-me.sh" }] }, { matcher: "server_error", hooks: [{ type: "command", command: "never.sh" }] }] });
  assert.deepEqual(t.hookCalls.map((c) => [c.input.hook_event_name, c.input.error, c.input.error_details]), [["StopFailure", "rate_limit", "AI call failed: 429 slow down"]]);
  assert.equal(t.r.status, "send");
  // CWDCHANGED: after a command moves the folder, the chat's hook env file made empty first (CLAUDE_ENV_FILE), with the old
  // and new folders; its watchPaths are what FileChanged hooks watch from then on.
  const cwd = { now: "/work/shop" };
  t = await loop([say("", [call("bash", { command: "cd app" }, "b1")]), say("ok")], { CwdChanged: hk("direnv.sh") }, { cwd, onRun: (c) => { if (c === "cd app") cwd.now = "/work/shop/app"; }, hookRun: () => ({ stdout: '{"hookSpecificOutput":{"hookEventName":"CwdChanged","watchPaths":["/work/shop/app/.envrc"]}}' }) });
  const cc = t.hookCalls.find((c) => c.input.hook_event_name === "CwdChanged");
  // (CwdChanged's variables go in the file cleared at each CwdChanged, Bash docs pass 8.)
  assert.deepEqual([cc.input.old_cwd, cc.input.new_cwd, cc.x.hookEnv, cc.x.hookGate], ["/work/shop", "/work/shop/app", "cwd", false]);
  const resetAt = t.execs.findIndex((x) => x.envReset === true);
  assert.ok(resetAt >= 0 && resetAt < t.execs.indexOf(cc.x), "the env file made empty first");
  // FILECHANGED: the files its matcher names in the project (and watchPaths), looked at before each answer; one that
  // changed, appeared or went runs its hooks, matched on its name.
  let look = 0;
  const watched = [];
  t = await loop([say("", [call("bash", { command: "ls" }, "b1")]), say("", [call("bash", { command: "ls" }, "b2")]), say("ok")], { FileChanged: [{ matcher: ".env|.envrc", hooks: [{ type: "command", command: "reload.sh" }] }] }, {
    tools: { stamps: (a) => { watched.push(a.paths); look++; return JSON.stringify([{ path: "/work/shop/.env", ...(look === 1 ? { mtime: 1, size: 3 } : { mtime: 2, size: 4 }) }, look < 3 ? { path: "/work/shop/.envrc", gone: true } : { path: "/work/shop/.envrc", mtime: 5, size: 1 }]); } },
    hookRun: () => ({ stdout: '{"systemMessage":"reloaded"}' }),
  });
  assert.deepEqual(watched[0], ["/work/shop/.env", "/work/shop/.envrc"]);
  assert.deepEqual(t.hookCalls.map((c) => [c.input.hook_event_name, c.input.file_path, c.input.event]), [["FileChanged", "/work/shop/.env", "change"], ["FileChanged", "/work/shop/.envrc", "add"]]);
  assert.ok(t.events.some((e) => e.type === "note" && e.text === "reloaded"));
  // BACKGROUND HOOKS (async): started, not waited for; what they say comes to Coder at its next step, never to the owner.
  t = await loop([say("", [call("bash", { command: "npm run build" }, "b1")]), say("", [call("bash", { command: "ls" }, "b2")]), say("ok")], { PostToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "tests.sh", async: true }] }] }, { hookRun: async (i, x) => { assert.equal(x.hookAsync.event, "PostToolUse"); return { stdout: '{"hookSpecificOutput":{"additionalContext":"tests passed after ' + i.tool_input.command + '"}}' }; } });
  assert.ok(t.seen[1].messages.some((m) => m.content === "(Note from Coder's app, not the owner: an async PostToolUse hook finished:\ntests passed after npm run build)"));
  assert.ok(!t.events.some((e) => e.type === "note" && /tests passed/.test(e.text)), "not shown to the owner");
  // An asyncRewake one that exited 2 (from Coder's machine, deps.hookNews) wakes the chat: Coder is told it is only for that.
  t = await loop([say("I'll fix the build.")], {}, { text: "", more: { hookNews: (() => { let once = [{ event: "PostToolUse", texts: ["build broke: missing semicolon"], rewake: true }]; return () => once.splice(0); })() } });
  assert.equal(t.seen[0].messages.at(-2).content, "(Note from Coder's app, not the owner: an asyncRewake PostToolUse hook exited with code 2:\nbuild broke: missing semicolon)");
  assert.match(t.seen[0].messages.at(-1).content, /the owner sent no message: this turn is only to tell you what the hook above said/);
  assert.ok(t.events.some((e) => e.type === "note" && e.text === "A background PostToolUse hook exited with code 2 and woke Coder."));
  // AN HTTP HOOK: sent from the machine (coder-tools.mjs's http_hook) with only the variables both lists allow; its JSON
  // answer decides; an address allowedHttpHookUrls leaves out is not sent to.
  const posts = [];
  const httpHooks = [{ event: "PreToolUse", matcher: "Bash", type: "http", url: "https://hooks.example.com/pre", headers: { Authorization: "Bearer $MY_TOKEN" }, allowedEnvVars: ["MY_TOKEN", "OTHER"], timeout: 30, source: "settings", urlsAllowed: ["https://hooks.example.com/*"], envAllowed: ["MY_TOKEN"] }];
  t = await loop([say("", [call("bash", { command: "rm -rf dist" }, "b1")]), say("ok")], httpHooks, { tools: { http_hook: (a, x) => { posts.push({ a, x }); return JSON.stringify({ status: 200, body: '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"policy says no"}}' }); } } });
  assert.deepEqual([posts[0].a.url, posts[0].a.allowed, JSON.parse(posts[0].a.body).tool_input.command, posts[0].a.timeoutMs, posts[0].x.hook, posts[0].x.hookGate], ["https://hooks.example.com/pre", ["MY_TOKEN"], "rm -rf dist", 30000, true, true]);
  assert.deepEqual([t.ran, t.r.messages.find((m) => m.tool_call_id === "b1").content], [[], "PreToolUse:Bash hook error: policy says no"]);
  t = await loop([say("", [call("bash", { command: "ls" }, "b1")]), say("ok")], [{ ...httpHooks[0], urlsAllowed: [] }], { tools: { http_hook: () => { throw new Error("never sent"); } } });
  assert.equal(t.ran.length, 1);
  assert.ok(t.events.some((e) => e.type === "note" && e.text === "PreToolUse:Bash hook error: [http hook]: Not run: its URL is not in allowedHttpHookUrls"));
  // BASHEDITDIFF: a command's changed files (with CODER_BASH_EDIT_DIFF on) in its PostToolUse hook's tool_response.
  t = await loop([say("", [call("bash", { command: "sed -i s/a/b/ src/app.js" }, "b1")]), say("ok")], { PostToolUse: hk("post.sh") }, { opts: { editDiff: true }, tools: { snap: () => '{"id":"s1"}', snapdiff: () => JSON.stringify({ changedFiles: ["/work/shop/src/app.js", "/work/shop/README.md"], files: [{ path: "/work/shop/src/app.js", kind: "update", add: 1, del: 1, lines: ["-a", "+b"] }], moreFiles: 1 }) } });
  const pt = t.hookCalls.find((c) => c.input.hook_event_name === "PostToolUse").input.tool_response;
  assert.deepEqual(pt.bashEditDiff, { changedFiles: ["/work/shop/src/app.js", "/work/shop/README.md"], files: [{ filePath: "/work/shop/src/app.js", hunks: [{ lines: ["-a", "+b"] }] }], moreFiles: 1 });
  // A HOOK'S TITLE FOR THE CHAT (sessionTitle); and what hooks run with: the env file for SessionStart, CwdChanged and
  // FileChanged; never the memory cap for one that can block (hookGate).
  t = await loop([say("ok")], { SessionStart: hk("start.sh"), UserPromptSubmit: hk("title.sh"), Notification: hk("n.sh") }, { hookRun: (i) => (i.hook_event_name === "UserPromptSubmit" ? { stdout: '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","sessionTitle":"Cart checkout bug"}}' } : {}) });
  assert.equal(t.r.sessionTitle, "Cart checkout bug");
  const flags = Object.fromEntries(t.hookCalls.map((c) => [c.input.hook_event_name, [c.x.hookEnv, c.x.hookGate]]));
  assert.deepEqual(flags, { SessionStart: ["session", false], UserPromptSubmit: [false, true] });
  // STATUSMESSAGE: a line in the chat while it runs.
  t = await loop([say("", [call("bash", { command: "ls" }, "b1")]), say("ok")], { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "slow.sh", statusMessage: "Checking the policy…" }] }] });
  assert.ok(t.events.some((e) => e.type === "note" && e.hookStatus === true && e.text === "Checking the policy…"));
});

test("CD384c on a real machine: CLAUDE_ENV_FILE carries a SessionStart hook's variables to Coder's commands; a hook that leaves a program holding its output answers 10 seconds after it ends, and its allow is not believed; background hooks run after the answer, and an asyncRewake one wakes the chat; an HTTP hook posts from the machine; SessionEnd hooks run when the machine stops", async () => {
  const { createApp, hookNews, JOBS, untoldOf } = await import("../container/server.mjs");
  const roots = { root: await mkdtemp(join(tmpdir(), "coder-hm-")), gitRoot: await mkdtemp(join(tmpdir(), "coder-hmg-")), memRoot: await mkdtemp(join(tmpdir(), "coder-hmm-")), bgRoot: await mkdtemp(join(tmpdir(), "coder-hmb-")), home: await mkdtemp(join(tmpdir(), "coder-hmh-")) };
  const project = "hm-test1";
  const posted = [];
  const hookSrv = http.createServer((req, res) => { let b = ""; req.on("data", (d) => (b += d)).on("end", () => { posted.push({ auth: req.headers.authorization, body: JSON.parse(b) }); res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: "the web hook saw " + JSON.parse(b).tool_input.command } })); }); });
  await new Promise((r) => hookSrv.listen(0, "127.0.0.1", r));
  const hookUrl = "http://127.0.0.1:" + hookSrv.address().port + "/hook";
  const node = (js) => "node --no-warnings -e " + JSON.stringify(js);
  const account = {
    allowedHttpHookUrls: ["http://127.0.0.1:*"],
    hooks: {
      SessionStart: [{ hooks: [{ type: "command", command: "echo 'export FROM_HOOK=set-by-session-start' >> \"$CLAUDE_ENV_FILE\"" }] }],
      PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "case \"$(cat)\" in *quiet-test*) echo '{\"hookSpecificOutput\":{\"permissionDecision\":\"allow\"}}'; sleep 30 & ;; esac" }] }],
      PostToolUse: [{ matcher: "Bash", hooks: [
        { type: "command", command: node("let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{setTimeout(()=>{console.log(JSON.stringify({hookSpecificOutput:{additionalContext:'async saw '+JSON.parse(s).tool_input.command}}))},1500)})"), async: true },
        { type: "command", command: "cat >/dev/null; sleep 2; echo 'the build broke' >&2; exit 2", asyncRewake: true, timeout: 60 },
        { type: "http", url: hookUrl, headers: { Authorization: "Bearer $HOOK_TOKEN" }, allowedEnvVars: ["HOOK_TOKEN"] },
      ] }],
      SessionEnd: [{ hooks: [{ type: "command", command: "cat > \"$CLAUDE_PROJECT_DIR/ended.json\"" }] }],
    },
  };
  const steps = [say("", [call("bash", { command: "echo \"$FROM_HOOK\"", description: "Say it" }, "b1")]), say("Done."), say("I'll look at the build."), say("", [call("bash", { command: "echo quiet-test", description: "Quiet" }, "q1")]), say("Done 2."), say("Bye.")];
  let n = 0;
  const seen = [];
  const app = createApp({ ...roots, hookQuietMs: 1500, send: async (req) => { seen.push(req); return steps[Math.min(n++, steps.length - 1)]; } });
  const srv = http.createServer(app);
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + srv.address().port;
  const post = (p, b) => fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
  const done = async () => { let st; for (let i = 0; i < 400; i++) { st = await (await fetch(base + "/state?project=" + project + "&since=0")).json(); if (st.result) return st; await wait(50); } return st; };
  try {
    // 1. CLAUDE_ENV_FILE: what the SessionStart hook wrote there is in the next command; the HTTP hook posted from here, with
    // the owner's variable it may use.
    assert.equal((await post("/turn", { project, text: "go", messages: [], hooks: account, setup: { vars: { HOOK_TOKEN: "tok-1" } } })).status, 200);
    let st = await done();
    assert.equal(st.events.find((e) => e.type === "result" && e.id === "b1").output, "set-by-session-start");
    assert.deepEqual([posted.length, posted[0].auth, posted[0].body.hook_event_name, posted[0].body.tool_input.command], [1, "Bearer tok-1", "PostToolUse", "echo \"$FROM_HOOK\""]);
    assert.match(seen[1].messages.find((m) => m.role === "tool" && m.tool_call_id === "b1").content, /PostToolUse:Bash hook additional context: the web hook saw echo "\$FROM_HOOK"\)$/);
    assert.ok(existsSync(join(roots.home, ".coder-hook-env", project + ".sh")));
    // 2. The background hooks went on after the answer; not the chat's background commands.
    assert.deepEqual(st.result.background, []);
    await wait(3500);
    const ended = [...JOBS.values()].filter((j) => j.project === project && j.hook);
    assert.ok(ended.length >= 1 && ended.every((j) => j.end), "ended by now");
    assert.equal(untoldOf(project).length, 1, "only the asyncRewake one that exited 2 wakes the chat");
    // 3. Woken: Coder is told what each said (the asyncRewake one's stderr; the async one's additionalContext).
    assert.equal((await post("/turn", { project, text: "", wake: true, messages: seen[1].messages.slice(1).concat([{ role: "assistant", content: "Done." }]), hooks: account })).status, 200);
    st = await done();
    const told = seen.at(-1).messages.map((m) => m.content).join("\n");
    assert.match(told, /an asyncRewake PostToolUse hook exited with code 2:\nthe build broke/);
    assert.match(told, /an async PostToolUse hook finished:\nasync saw echo "\$FROM_HOOK"/);
    assert.deepEqual(hookNews(project), [], "told once");
    // 4. THE QUIET RULE: the hook printed an allow and left `sleep 30` holding its output; Coder stopped waiting 1.5 seconds
    // after it ended (10 on a real machine) and did not believe it.
    const t0 = Date.now();
    assert.equal((await post("/turn", { project, text: "go again", messages: [{ role: "user", content: "go" }, { role: "assistant", content: "Done." }], hooks: { ...account, hooks: { PreToolUse: account.hooks.PreToolUse } } })).status, 200);
    st = await done();
    assert.ok(Date.now() - t0 < 15_000, "not the 30 seconds of the program it left");
    assert.equal(st.events.find((e) => e.type === "result" && e.id === "q1").output, "PreToolUse:Bash hook error: [command hook]: " + H.QUIET_GRANT);
    // 5. SESSIONEND when the machine stops: the chat's hooks, with why ("other").
    assert.equal(await app.sessionEnd("other"), 0, "the last message had none");
    assert.equal((await post("/turn", { project, text: "bye", messages: [{ role: "user", content: "go" }, { role: "assistant", content: "Done." }], hooks: { hooks: { SessionEnd: account.hooks.SessionEnd } } })).status, 200);
    await done();
    assert.equal(await app.sessionEnd("other"), 1);
    const endIn = JSON.parse(readFileSync(join(roots.root, project, "ended.json"), "utf8"));
    assert.deepEqual([endIn.hook_event_name, endIn.reason, endIn.session_id], ["SessionEnd", "other", project]);
  } finally { srv.close(); hookSrv.close(); hookSrv.closeAllConnections?.(); }
});

test("CD384d the machine's side: CODER_TOOL_MEMORY_CGROUP_EXCLUDE as Claude Code's kinds; a hook's exec gets its env file, the shell prefix and the quiet wait; the hook env file before each command; the Dockerfile copies what the hooks need", async () => {
  const S = await import("../container/server.mjs");
  assert.deepEqual([[...S.memCappedKinds("")], [...S.memCappedKinds("all-new")], [...S.memCappedKinds("none")], [...S.memCappedKinds("hooks, bogus")], [...S.memCappedKinds("hooks,lsp,helper")]], [[], [], ["hooks", "lsp", "helper"], ["lsp", "helper"], []]);
  // (SessionStart's file, then CwdChanged's and FileChanged's, Bash docs pass 8.)
  assert.equal(S.hookEnvLine("shop-1"), "if [ -r \"$HOME\"/.coder-hook-env/'shop-1.sh' ]; then . \"$HOME\"/.coder-hook-env/'shop-1.sh'; fi\nif [ -r \"$HOME\"/.coder-hook-env/'shop-1.cwd.sh' ]; then . \"$HOME\"/.coder-hook-env/'shop-1.cwd.sh'; fi\n");
  const server = read("container/server.mjs");
  assert.match(server, /const capped = tool && typeof t\.memCgNow === "function" && t\.memKinds instanceof Set && t\.memKinds\.has\(hook \? "hooks" : kind === "lsp" \? "lsp" : "helper"\) && !\(hook && hookGate\);/);
  assert.match(server, /\.\.\.\(hook \? \{ quietMs: hookQuietMs, shellPrefix: noPrefix \? "" : t\.shellPrefix \|\| "" \} : \{\}\)/, "the owner's CODER_SHELL_PREFIX wraps hooks too (not exec-form or PowerShell ones: pass 8, CD425)");
  assert.match(server, /\.\.\.\(hookEnvFile \? \{ CLAUDE_ENV_FILE: hookEnvFile \} : \{\}\)/);
  assert.match(read("container/coder-agent.mjs"), /\.\.\.\(c\.name === "lsp" \? \{ kind: "lsp" \} : \{\}\)/);
  // A quiet exec, for real: the answer 1 second after its own process ends, the program it left still running.
  const dir = await mkdtemp(join(tmpdir(), "coder-q-"));
  const t0 = Date.now();
  const r = await S.execIn(dir, "echo said; sleep 20 &", 30, { kill: true, uid: null, quietMs: 1000 });
  assert.deepEqual([r.code, r.output.trim(), r.quiet], [0, "said", true]);
  assert.ok(Date.now() - t0 < 5000);
  const r2 = await S.execIn(dir, "echo plain", 30, { kill: true, uid: null, quietMs: 1000 });
  assert.deepEqual([r2.output.trim(), r2.quiet], ["plain", undefined]);
  writeFileSync(join(dir, "x"), "1");
  mkdirSync(join(dir, "y"));
});
