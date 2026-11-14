// FIX ROUND 4, HOOKS (2026-11-14; the third recheck's CL4, D4 and D5, the owner: "yes" to fixing them), as Claude Code
// 2.1.325's hooks reference and its program have them:
//   CL4  mcp_tool hooks run: a tool of one of the chat's connectors, through the Worker, with ${path}s filled from the hook's
//        input, the tool's text read as a command hook's stdout, Claude Code's timeouts, errors and words.
//   D4   a card shows at once and its PermissionRequest hooks run beside it: whichever decides first counts (a hook's answer
//        closes the card; a hook still running when the owner answered is dropped); the 6-second Notification is timed
//        from the card; a card's pause waits for hooks still deciding.
//   D5   where no one can answer (a job from GitHub, no way to show a card), the PermissionRequest hooks still run, and the
//        call is refused only when none decides.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const H = await import("../container/coder-hooks.mjs");
const A = await import("../container/coder-agent.mjs");
const M = await import("../src/coder-mcp.mjs");
const { modelPass } = await import("../src/coder-model-gate.mjs");
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
const out = (event, o) => ({ stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: event, ...o } }) });

/**
 * Coder's loop with a scripted Grok and a pretend machine: its command hooks answered by `hookRun`, the tools script by
 * `tools`, connector hooks by `mcpHook`; `ask` the owner (none: no card can be shown); `events` the chat's events.
 */
async function loop(steps, { hooks = {}, hookRun = () => ({}), ask = null, mcpHook = null, tools = {}, mode = "acceptEdits", extra = {}, deps = {}, events = [] } = {}) {
  const seen = [], ran = [], hookCalls = [], requests = [];
  let n = 0;
  const r = await A.runCoder({
    send: async (req) => { seen.push(req); const s = steps[Math.min(n++, steps.length - 1)]; return typeof s === "function" ? s(req) : s; },
    exec: async (x) => {
      const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
      if (mark && x.hook === true) {
        const input = JSON.parse(x.payload);
        const rec = { input, done: false };
        hookCalls.push(rec);
        const a = (await hookRun(input)) || {};
        rec.done = true;
        return { code: Number.isInteger(a.code) ? a.code : 0, output: String(a.stdout || "") + "\n" + mark[0] + "\n" + String(a.stderr || "") };
      }
      if (x.hook === true) return { code: 0, output: "" };
      const tm = /coder-tools\.mjs (\S+)$/.exec(String(x.command));
      if (tm) {
        const req = tm[1] === "@REQUEST" ? JSON.parse(x.payload) : JSON.parse(Buffer.from(tm[1], "base64").toString("utf8"));
        requests.push(req);
        const f = tools[req.tool];
        if (!f) return { code: 0, output: "" };
        const o = await f(req.args, x);
        return typeof o === "string" ? { code: 0, output: o } : o;
      }
      ran.push(x.command);
      return { code: 0, output: "ok\n" };
    },
    emit: (e) => events.push(e),
    here: () => "/work/shop", root: "/work/shop", home: "/home/dev", chatId: "shop-f4", where: (p) => (p.startsWith("/") ? p : "/work/shop/" + p),
    ...(ask ? { ask } : {}), ...(mcpHook ? { mcpHook } : {}), ...deps,
  }, { text: "go", mode, messages: [], hooks: H.hooksFrom({ hooks }, "settings").list, ...extra });
  const told = (id) => { for (const req of seen) for (const m of req.messages) if (m.role === "tool" && m.tool_call_id === id) return m.content; const m = r.messages.find((x) => x.role === "tool" && x.tool_call_id === id); return m ? m.content : ""; };
  return { r, events, seen, ran, hookCalls, requests, told };
}
/** The machine's own way of waiting on a card (server.mjs's ask): the owner's answer after `after` ms, a pause, a withdrawal. */
const machineAsk = ({ after = Infinity, answer = { choice: "yes" }, log = [] } = {}) => async (pid, { until = 0, park = 0, gone = null } = {}) => {
  const t0 = Date.now();
  log.push(pid);
  for (;;) {
    if (gone && gone()) return { choice: "gone" };
    if (Date.now() - t0 >= after) return answer;
    if (park && Date.now() >= park) return { choice: "park" };
    if (until && Date.now() > until) return null;
    await wait(2);
  }
};
const PR = (matcher = "Bash") => ({ PermissionRequest: [{ matcher, hooks: [{ type: "command", command: "perm.sh" }] }] });
const allowPR = (more = {}) => out("PermissionRequest", { decision: { behavior: "allow", ...more } });
const denyPR = (message) => out("PermissionRequest", { decision: { behavior: "deny", ...(message ? { message } : {}) } });

// ── CL4: MCP_TOOL HOOKS ─────────────────────────────────────────────────────────────────────────────────────────────

test("F4H1 mcp_tool hooks in settings as Claude Code reads them: server and tool, input an object of arguments, no onFailure; on every event Coder has (SessionStart: command and mcp_tool); their timeouts; one server, tool and input runs once", () => {
  const s = H.hooksFrom({ hooks: {
    PreToolUse: [{ matcher: "Write|Edit", hooks: [{ type: "mcp_tool", server: "my_server", tool: "security_scan", input: { file_path: "${tool_input.file_path}" }, timeout: 20, statusMessage: "Scanning…" }] }],
    SessionStart: [{ hooks: [{ type: "mcp_tool", server: "Linear", tool: "whoami" }, { type: "http", url: "https://x.example.com" }] }],
    UserPromptSubmit: [{ hooks: [{ type: "mcp_tool", server: "Notes", tool: "lookup" }] }],
    SessionEnd: [{ hooks: [{ type: "mcp_tool", server: "Slack", tool: "post", input: { text: "${reason}" } }] }],
    Stop: [{ hooks: [{ type: "mcp_tool", tool: "x" }, { type: "mcp_tool", server: "a", tool: "b", input: ["x"] }, { type: "mcp_tool", server: "a", tool: "b", onFailure: "block" }] }],
  } });
  assert.deepEqual(s.list, [
    { event: "PreToolUse", matcher: "Write|Edit", type: "mcp_tool", timeout: 20, ownTimeout: true, statusMessage: "Scanning…", source: "settings", server: "my_server", tool: "security_scan", input: { file_path: "${tool_input.file_path}" } },
    { event: "SessionStart", matcher: "", type: "mcp_tool", timeout: 600, source: "settings", server: "Linear", tool: "whoami" },
    { event: "UserPromptSubmit", matcher: "", type: "mcp_tool", timeout: 30, source: "settings", server: "Notes", tool: "lookup" },
    { event: "SessionEnd", matcher: "", type: "mcp_tool", timeout: 1.5, source: "settings", server: "Slack", tool: "post", input: { text: "${reason}" } },
    { event: "Stop", matcher: "", type: "mcp_tool", timeout: 600, source: "settings", server: "a", tool: "b" },
  ]);
  assert.deepEqual(s.problems, ["SessionStart doesn't take http hooks", "Stop: an mcp_tool hook needs its server and tool", "Stop: an mcp_tool hook's input is an object of the tool's arguments"]);
  // (Claude Code: "Events that support all five hook types", "PermissionRequest supports command, http, mcp_tool, and prompt",
  // the others "command, http, and mcp_tool", "SessionStart and Setup support command and mcp_tool hooks".)
  for (const e of H.HOOK_EVENTS) assert.ok(H.typesFor(e).includes("mcp_tool"), e);
  assert.deepEqual(H.typesFor("SessionStart"), ["command", "mcp_tool"]);
  assert.match(H.hooksFrom({ hooks: { Stop: [{ hooks: [{ type: "script" }] }] } }).problems[0], /^Stop: a hook's type is command, http, mcp_tool, prompt or agent \(not script\)$/);
  // The owner's box takes them (before: "mcp_tool hooks don't run on Coder (it has no MCP servers)").
  assert.equal(H.hooksSetting('{"hooks":{"PostToolUse":[{"matcher":"Write","hooks":[{"type":"mcp_tool","server":"my_server","tool":"security_scan","input":{"file_path":"${tool_input.file_path}"}}]}]}}').ok, true);
  assert.doesNotMatch(read("container/coder-hooks.mjs"), /it has no MCP servers/);
  // "If you define the same handler in more than one settings file, it runs once": server, tool and input.
  const one = { event: "Stop", matcher: "", type: "mcp_tool", server: "a", tool: "b", input: { x: 1 } };
  assert.equal(H.hooksFor([one, { ...one, source: "project" }], "Stop").length, 1);
  assert.equal(H.hooksFor([one, { ...one, input: { x: 2 } }, { ...one, tool: "c" }], "Stop").length, 3);
});

test("F4H2 an mcp_tool hook's call: ${path}s filled from its input as Claude Code fills them; not called at a chat's start (SessionStart startup or resume), with Claude Code's words; 'not connected' with no connectors; within its timeout; the tool's text read as a command hook's stdout, isError a non-blocking error, an answer it could not read refusing a PreToolUse call", async () => {
  const hin = { hook_event_name: "PreToolUse", session_id: "s1", tool_name: "Write", tool_input: { file_path: "/work/a.js", n: 3, deep: { k: [1, 2] }, nul: null } };
  assert.deepEqual(H.mcpHookArgs({ file_path: "${tool_input.file_path}", note: "for ${session_id} (${tool_input.n})", obj: "${tool_input.deep}", none: "${tool_input.nope}", nul: "${tool_input.nul}", list: ["${tool_name}", 4, null, { at: "${tool_input.deep.k.1}" }], keep: true, dollars: "$5, ${}, $tool_name, ${tool_input.file_path.x}" }, hin), { file_path: "/work/a.js", note: "for s1 (3)", obj: '{"k":[1,2]}', none: "", nul: "", list: ["Write", 4, null, { at: "2" }], keep: true, dollars: "$5, ${}, $tool_name, " });
  assert.deepEqual(H.mcpHookArgs(undefined, hin), {});
  const h = { event: "PreToolUse", type: "mcp_tool", server: "Lint", tool: "scan", input: { path: "${tool_input.file_path}" }, timeout: 600 };
  const calls = [];
  let r = await H.runMcpToolHook(h, hin, { call: async (x) => { calls.push(x); return { ok: true, body: "clean" }; } });
  assert.deepEqual(calls, [{ server: "Lint", tool: "scan", args: { path: "/work/a.js" }, timeoutMs: 600_000 }]);
  assert.deepEqual(r, { mcp: { ok: true }, code: 0, stdout: "clean", stderr: "" });
  // A chat's start: not called (Claude Code: "fire before the session's MCP servers are available to hooks"); after a summary, called.
  const never = async () => { throw new Error("called"); };
  r = await H.runMcpToolHook({ ...h, event: "SessionStart" }, { hook_event_name: "SessionStart", source: "startup" }, { call: never });
  assert.deepEqual(r, { mcp: { ok: false }, code: 1, stdout: "", stderr: "mcp_tool hooks are not available for the 'SessionStart' hook event (no MCP client context)" });
  assert.equal((await H.runMcpToolHook({ ...h, event: "SessionStart" }, { hook_event_name: "SessionStart", source: "resume" }, { call: never })).stderr, H.mcpHookNoContext("SessionStart"));
  assert.equal((await H.runMcpToolHook({ ...h, event: "SessionStart" }, { hook_event_name: "SessionStart", source: "compact" }, { call: async () => ({ ok: true, body: "x" }) })).stdout, "x");
  // No connectors in this job: Claude Code's "not connected".
  assert.equal((await H.runMcpToolHook(h, hin, {})).stderr, "MCP server 'Lint' not connected");
  // Its timeout: given up on, as a command hook's ("Timed out").
  r = await H.runMcpToolHook({ ...h, timeout: 0.05 }, hin, { call: () => new Promise(() => {}) });
  assert.equal(r.timedOut, true);
  assert.equal(H.hookResult("PreToolUse", r, h).notice, "Timed out");
  assert.equal((await H.runMcpToolHook(h, hin, { call: async () => { throw new Error("socket hang up"); } })).stderr, "socket hang up");
  // WHAT ITS TEXT MEANS: JSON as a command hook's on exit 0; plain text context where a command's would be; an error.
  const R = (event, run) => H.hookResult(event, run, h);
  const okRun = (body) => ({ mcp: { ok: true }, code: 0, stdout: body, stderr: "" });
  const pre = H.hooksOutcome("PreToolUse", [{ hook: h, result: R("PreToolUse", okRun(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "a secret in the file" } }))) }], { tool: "Write" });
  assert.deepEqual([pre.decision, pre.reason], ["deny", "PreToolUse:Write hook error: a secret in the file"]);
  assert.deepEqual(H.hooksOutcome("UserPromptSubmit", [{ hook: h, result: R("UserPromptSubmit", okRun("Branch: main")) }]).context, ["Branch: main"]);
  const err = H.hooksOutcome("PostToolUse", [{ hook: h, result: R("PostToolUse", { mcp: { ok: false }, code: 1, stdout: "", stderr: "scanner is down" }) }], { tool: "Write" });
  assert.deepEqual([err.decision, err.notices], ["", ["PostToolUse:Write hook error: [mcp_tool hook]: scanner is down"]]);
  assert.equal(R("Stop", { mcp: { ok: false }, code: 1, stdout: "", stderr: "" }).notice, "MCP tool returned an error");
  assert.equal(R("Stop", okRun("{nope}")).notice, H.notJson("Expected property name or '}' in JSON at position 1 (line 1 column 2)"));
  // An answer it could not read, or a refused call (`withheld`): on PreToolUse the call is refused ("refusing rather than
  // skipping that gate"), elsewhere a non-blocking error.
  const words = M.hookToolBlocked("Lint", "scan");
  const w = { mcp: { ok: false, withheld: true }, code: 1, stdout: "", stderr: words };
  const gate = H.hooksOutcome("PreToolUse", [{ hook: h, result: R("PreToolUse", w) }], { tool: "Bash" });
  assert.deepEqual([gate.decision, gate.reason], ["deny", "PreToolUse:Bash hook error: a PreToolUse mcp_tool hook could not run (" + words + "); refusing rather than skipping that gate"]);
  assert.deepEqual(H.hooksOutcome("Stop", [{ hook: h, result: R("Stop", w) }]).notices, ["Stop hook error: [mcp_tool hook]: " + words]);
});

test("F4H3 in Coder's loop: a PreToolUse mcp_tool hook gets its call's input and can deny it; plain text lets it run; a PostToolUse one adds context; a refused one refuses the call; with no connectors it says 'not connected' and the call runs; at a chat's start it is not called", async () => {
  const hooks = { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "mcp_tool", server: "Guard", tool: "check", input: { command: "${tool_input.command}", cwd: "${cwd}" } }] }] };
  const steps = [say("", [call("bash", { command: "npm install left-pad", description: "Install" }, "b1")]), say("ok")];
  const asked = [];
  let t = await loop(steps, { hooks, mode: "auto", mcpHook: async (x) => { asked.push(x); return { ok: true, body: JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "No installs today." } }) }; } });
  assert.deepEqual(asked, [{ server: "Guard", tool: "check", args: { command: "npm install left-pad", cwd: "/work/shop" }, timeoutMs: 600_000 }]);
  assert.deepEqual(t.ran, []);
  assert.equal(t.told("b1"), "PreToolUse:Bash hook error: No installs today.");
  t = await loop(steps, { hooks, mode: "auto", mcpHook: async () => ({ ok: true, body: "looks fine" }) });
  assert.deepEqual(t.ran.filter((c) => /left-pad/.test(c)).length, 1);
  // A tool refused for hooks (blocked in this chat): the call is refused, in Claude Code's words.
  t = await loop(steps, { hooks, mode: "auto", mcpHook: async () => ({ ok: false, body: "", withheld: true, error: M.hookToolBlocked("Guard", "check") }) });
  assert.deepEqual(t.ran, []);
  assert.equal(t.told("b1"), "PreToolUse:Bash hook error: a PreToolUse mcp_tool hook could not run (Hooks can't call 'check' of MCP server 'Guard', because that tool is blocked in this session. Remove this mcp_tool hook or point it at another tool.); refusing rather than skipping that gate");
  // No connectors in the job: Claude Code's non-blocking error, and the call runs.
  t = await loop(steps, { hooks, mode: "auto" });
  assert.ok(t.events.some((e) => e.type === "note" && e.text === "PreToolUse:Bash hook error: [mcp_tool hook]: MCP server 'Guard' not connected"));
  assert.equal(t.ran.filter((c) => /left-pad/.test(c)).length, 1);
  // PostToolUse: its additionalContext goes with the result.
  t = await loop(steps, { hooks: { PostToolUse: [{ matcher: "Bash", hooks: [{ type: "mcp_tool", server: "Notes", tool: "log" }] }] }, mode: "auto", mcpHook: async () => ({ ok: true, body: JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: "Logged to the team's notes." } }) }) });
  assert.match(t.told("b1"), /\(Note from Coder's app, not the owner: PostToolUse:Bash hook additional context: Logged to the team's notes\.\)$/);
  // SessionStart at a chat's start: not called, Claude Code's words shown; its UserPromptSubmit one is, its text context.
  const called = [];
  t = await loop([say("ok")], { hooks: { SessionStart: [{ hooks: [{ type: "mcp_tool", server: "Notes", tool: "brief" }] }], UserPromptSubmit: [{ hooks: [{ type: "mcp_tool", server: "Notes", tool: "branch" }] }] }, mode: "auto", mcpHook: async (x) => { called.push(x.tool); return { ok: true, body: "Branch: main" }; } });
  assert.deepEqual(called, ["branch"]);
  assert.ok(t.events.some((e) => e.type === "note" && e.text === "SessionStart hook error: [mcp_tool hook]: mcp_tool hooks are not available for the 'SessionStart' hook event (no MCP client context)"));
  assert.ok(t.seen[0].messages.some((m) => m.content === "(Note from Coder's app, not the owner: UserPromptSubmit hook additional context: Branch: main)"));
});

// A fake connector (MCP over HTTP) for the Worker's side.
function memBucket() {
  const m = new Map();
  return { m, get: async (k) => (m.has(k) ? { text: async () => m.get(k) } : null), put: async (k, v) => { m.set(k, String(v)); }, delete: async (k) => { m.delete(k); } };
}
const env = { CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://jessica.gofarther.dev" };
const TOOLS = [{ name: "list_issues", description: "List issues", inputSchema: { type: "object", properties: {} }, annotations: { readOnlyHint: true } }, { name: "create_issue", description: "Make an issue", inputSchema: { type: "object", properties: { title: { type: "string" } } } }, { name: "wipe", description: "Delete all", inputSchema: { type: "object", properties: {} } }];
function fakeServer(answer) {
  const seen = [];
  const fetchFn = async (url, init = {}) => {
    const msg = JSON.parse(init.body);
    seen.push(msg);
    if (!("id" in msg)) return new Response(null, { status: 202 });
    const j = (result) => new Response(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result }), { status: 200, headers: { "content-type": "application/json" } });
    if (msg.method === "initialize") return j({ protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "fake", version: "1" } });
    if (msg.method === "tools/list") return j({ tools: TOOLS });
    if (msg.method === "tools/call") return answer(msg, j);
    return j({});
  };
  return { seen, fetchFn };
}

test("F4H4 the Worker's side of an mcp_tool hook: only a connector this chat has, by the name the owner gave it ('not connected' otherwise, a job from GitHub included); a tool set to Block or off in this chat refused in Claude Code's words; the tool's text parts, others as [type], one per line; isError its error; an answer too large to read in Claude Code's words; through /api/coder/mcp with the job's pass", async () => {
  const b = memBucket();
  const s = fakeServer((msg, j) => (msg.params.name === "create_issue" ? j({ content: [{ type: "text", text: "made " + JSON.stringify(msg.params.arguments) }, { type: "image", data: "aGk=", mimeType: "image/png" }, { type: "resource_link", uri: "x://1" }, { type: "text", text: "done" }] }) : j({ isError: true, content: [{ type: "text", text: "not allowed" }] })));
  const r = await M.addConnector(env, b, "u1", { name: "Linear", url: "https://mcp.example.com/mcp", key: "good", fetchFn: s.fetchFn });
  const list = await M.readConnectors(b, "u1");
  list[0].perms = { wipe: "block" };
  await M.writeConnectors(b, "u1", list);
  const { map } = M.toolsFor(await M.readConnectors(b, "u1"));
  await M.keepJobTools(b, "u1", "chat-1", 4, map);
  const meta = { turn: 4, toolsOff: [r.connector.id + ":list_issues"] };
  const hc = (h, turn = 4) => M.hookCall(env, b, "u1", "chat-1", turn, meta, h, { fetchFn: s.fetchFn });
  assert.deepEqual(await hc({ server: "Linear", tool: "create_issue", args: { title: "Bug" }, timeoutMs: 5000 }), { ok: true, body: 'made {"title":"Bug"}\n[image]\n[resource_link]\ndone' });
  assert.equal(s.seen.filter((x) => x.method === "tools/call").length, 1);
  assert.deepEqual(await hc({ server: "Jira", tool: "create_issue" }), { ok: false, body: "", error: "MCP server 'Jira' not connected" });
  assert.deepEqual(await hc({ server: "Linear", tool: "create_issue" }, 5), { ok: false, body: "", error: "MCP server 'Linear' not connected" }, "a job without this chat's connectors (from GitHub, or after the chat moved on)");
  assert.deepEqual(await hc({ server: "Linear", tool: "wipe" }), { ok: false, body: "", withheld: true, error: "Hooks can't call 'wipe' of MCP server 'Linear', because that tool is blocked in this session. Remove this mcp_tool hook or point it at another tool." });
  assert.equal((await hc({ server: "Linear", tool: "list_issues" })).withheld, true, "switched off in this chat");
  assert.equal(s.seen.filter((x) => x.method === "tools/call").length, 1, "neither was called");
  assert.deepEqual(await hc({ server: "Linear", tool: "other" }), { ok: false, body: "not allowed", error: "not allowed" });
  // An answer too large to read (Coder's limit, 20 million characters): Claude Code's words, and no verdict.
  const chunk = new TextEncoder().encode("x".repeat(1_000_000));
  const big = fakeServer(() => new Response(new ReadableStream({ start(c) { for (let i = 0; i < 21; i++) c.enqueue(chunk); c.close(); } }), { status: 200, headers: { "content-type": "application/json" } }));
  assert.deepEqual(await M.hookCall(env, b, "u1", "chat-1", 4, meta, { server: "Linear", tool: "create_issue" }, { fetchFn: big.fetchFn }), { ok: false, body: "", withheld: true, error: 'MCP tool "create_issue" on server "Linear" gave no answer that could be read, because a message from the server was too large, so this hook gave no verdict. If this keeps happening, the tool must send a smaller answer.' });
  // The gate: the job's pass, as for its tools.
  await b.put("coder/u1/chat-1/meta.json", JSON.stringify(meta));
  const until = String(Date.now() + 60_000);
  const pass = await modelPass(env, "u1/chat-1", "4", until);
  const req = (body, p = pass) => new Request("https://jessica.gofarther.dev/api/coder/mcp", { method: "POST", headers: { "x-coder-chat": "u1/chat-1", "x-coder-turn": "4", "x-coder-until": until, "x-coder-model": p }, body: JSON.stringify(body) });
  const e2 = { ...env, CODER_BUCKET: b };
  assert.equal((await M.handleMcp(req({ hook: { server: "Linear", tool: "create_issue" } }, "x".repeat(43)), e2, { fetchFn: s.fetchFn })).status, 403);
  const res = await M.handleMcp(req({ hook: { server: "Linear", tool: "create_issue", args: { title: "From a hook" }, timeoutMs: 5000 } }), e2, { fetchFn: s.fetchFn });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, body: 'made {"title":"From a hook"}\n[image]\n[resource_link]\ndone' });
  assert.deepEqual(M.hookToolText({ content: [{ type: "text", text: "" }], isError: true }), { ok: false, body: "", error: "MCP tool returned an error" });
});

test("F4H5 the machine's caller for mcp_tool hooks: it posts { hook } to the Worker with the job's pass and reads its answer; a job with connectors gets it; SessionEnd's mcp_tool hooks run through it when the machine stops", async () => {
  const sent = [];
  const fetchFn = async (url, init) => { sent.push({ url, init: { ...init, body: JSON.parse(init.body) } }); return new Response(JSON.stringify({ ok: false, body: "", withheld: true, error: "blocked" }), { status: 200, headers: { "content-type": "application/json" } }); };
  const c = A.connectorHookCaller({ url: "https://coder.example/api/coder/model", headers: { "x-coder-model": "pass" } }, fetchFn);
  assert.deepEqual(await c({ server: "Linear", tool: "wipe", args: {}, timeoutMs: 30_000 }), { ok: false, body: "", error: "blocked", withheld: true });
  assert.equal(sent[0].url, "https://coder.example/api/coder/mcp");
  assert.deepEqual(sent[0].init.body, { hook: { server: "Linear", tool: "wipe", args: {}, timeoutMs: 30_000 } });
  assert.equal(sent[0].init.headers["x-coder-model"], "pass");
  const down = A.connectorHookCaller({ url: "https://coder.example/api/coder/model", headers: {} }, async () => { throw new TypeError("fetch failed"); });
  assert.deepEqual(await down({ server: "a", tool: "b", args: {}, timeoutMs: 1000 }), { ok: false, body: "", error: "Coder's server could not be reached" });
  const srv = read("container/server.mjs");
  assert.match(srv, /\.\.\.\(mcpCall \? \{ mcp: mcpCall, mcpHook: connectorHookCaller\(via\) \} : \{\}\),/);
  assert.match(srv, /hooksFor\(t\.hooksLast, "SessionEnd", reason\)\.filter\(\(h\) => h\.type === "command" \|\| h\.type === "http" \|\| h\.type === "mcp_tool"\)/);
  assert.match(srv, /runMcpToolHook\(\{ \.\.\.h, timeout: budget \}, input, \{ call: typeof t\.turnDeps\.mcpHook === "function" \? t\.turnDeps\.mcpHook : null \}\)/);
  assert.match(read("container/coder-agent.mjs"), /if \(h\.type === "mcp_tool"\) return runMcpToolHook\(h, input, \{ call: typeof deps\.mcpHook === "function" \? deps\.mcpHook : null \}\);/);
});

// ── D4: THE CARD AND ITS PERMISSIONREQUEST HOOKS AT ONCE ───────────────────────────────────────────────────────────────

test("F4H6 a card shows at once, beside its PermissionRequest hooks: the owner answering first decides, and a hook that answers later is dropped (its updatedPermissions too); a hook deciding first closes the card with its answer, marked as the hook's, and a no in Claude Code's words for that path", async () => {
  const steps = [say("", [call("bash", { command: "npm install left-pad", description: "Install" }, "b1")]), say("ok")];
  // The owner first: the hook still deciding when they answered.
  const events = [];
  let shownWhileHookRan = false;
  let t = await loop(steps, { hooks: PR(), events, ask: machineAsk({ after: 10 }), hookRun: async () => { await wait(120); shownWhileHookRan = events.some((e) => e.type === "permission"); return allowPR({ updatedPermissions: [{ type: "addRules", rules: [{ toolName: "Bash", ruleContent: "curl *" }], behavior: "allow", destination: "localSettings" }] }); } });
  assert.equal(t.ran.filter((c) => /left-pad/.test(c)).length, 1);
  assert.deepEqual(t.events.filter((e) => e.type === "permanswer").map((e) => [e.choice, e.hook]), [["yes", undefined]], "the owner's answer");
  await wait(150);
  assert.equal(shownWhileHookRan, true, "the card was up while the hook ran");
  assert.ok(!t.events.some((e) => e.type === "note" && /A PermissionRequest hook allowed this/.test(e.text)), "the hook's late allow dropped");
  assert.deepEqual(t.r.rulesAdded || [], [], "its updatedPermissions not applied");
  // A hook first: the card closes with its answer; the owner's later click counts for nothing.
  t = await loop(steps, { hooks: PR(), ask: machineAsk({ after: 400 }), hookRun: () => denyPR("Installs wait for review.") });
  assert.deepEqual(t.events.filter((e) => e.type === "permanswer").map((e) => [e.choice, e.hook]), [["no", true]]);
  assert.equal(t.told("b1"), "Installs wait for review.");
  assert.deepEqual(t.ran, []);
  assert.equal(t.events.find((e) => e.type === "result" && e.id === "b1").output, "Not run: your PermissionRequest hook said no: Installs wait for review.");
  t = await loop(steps, { hooks: PR(), ask: machineAsk({ after: 400 }), hookRun: () => denyPR("") });
  assert.equal(t.told("b1"), "Permission denied by PermissionRequest hook");
  t = await loop(steps, { hooks: PR(), ask: machineAsk({ after: 400 }), hookRun: () => allowPR({ updatedInput: { command: "npm install --ignore-scripts left-pad", description: "Install" } }) });
  assert.deepEqual(t.ran.filter((c) => /left-pad/.test(c)).map((c) => c.split("\n").pop()), ["npm install --ignore-scripts left-pad"]);
  assert.deepEqual(t.events.filter((e) => e.type === "permanswer").map((e) => [e.choice, e.hook]), [["yes", true]]);
  // Its interrupt stops Coder, the card closed as stopped.
  t = await loop(steps, { hooks: PR(), ask: machineAsk({ after: 400 }), hookRun: () => out("PermissionRequest", { decision: { behavior: "deny", message: "Stop.", interrupt: true } }) });
  assert.equal(t.r.status, "stopped");
  assert.deepEqual(t.events.filter((e) => e.type === "permanswer").map((e) => [e.choice, e.hook]), [["stop", true]]);
  // The page says the hook answered it.
  const ui = read("public/coder.js");
  assert.match(ui, /if \(ans\.hook === true\) return \(c === 'yes' \? '<span class="cd-perm-ok">✓ ' \+ \(e\.tool === 'plan' \? 'Approved' : 'Allowed'\) \+ '<\/span>' : '<span class="cd-perm-no">' \+ \(c === 'stop' \? 'Stopped' : '✕ ' \+ \(e\.tool === 'plan' \? 'Not approved' : 'Not allowed'\)\) \+ '<\/span>'\) \+ ' · by your PermissionRequest hook';/);
  assert.match(ui, /const askDone = \(ans\) => \(ans\.hook === true \? \(ans\.choice === 'yes' \? '<span class="cd-perm-ok">✓ Answered<\/span>' : '<span class="cd-perm-no">' \+ \(ans\.choice === 'stop' \? 'Stopped' : '✕ Not answered'\) \+ '<\/span>'\) \+ ' · by your PermissionRequest hook' :/);
});

test("F4H7 the card's Notification hook ('permission_prompt') is timed from the card, not after its PermissionRequest hooks, and not run when a hook answered sooner; the question card races its hooks the same way", async () => {
  const steps = [say("", [call("bash", { command: "npm install left-pad", description: "Install" }, "b1")]), say("ok")];
  const NOTE = { Notification: [{ matcher: "permission_prompt", hooks: [{ type: "command", command: "note.sh" }] }] };
  const order = [];
  let t = await loop(steps, { hooks: { ...PR(), ...NOTE }, ask: machineAsk({ after: 200 }), deps: { promptNotifyMs: 20 }, hookRun: async (i) => { order.push("start " + i.hook_event_name); if (i.hook_event_name === "PermissionRequest") { await wait(100); order.push("end PermissionRequest"); } return {}; } });
  assert.deepEqual(order, ["start PermissionRequest", "start Notification", "end PermissionRequest"], "the notification came while the hook still ran");
  t = await loop(steps, { hooks: { ...PR(), ...NOTE }, ask: machineAsk({ after: 400 }), deps: { promptNotifyMs: 60 }, hookRun: (i) => (i.hook_event_name === "PermissionRequest" ? allowPR() : {}) });
  await wait(100);
  assert.ok(!t.hookCalls.some((h) => h.input.hook_event_name === "Notification"), "a hook answered sooner");
  // THE QUESTION CARD: the owner first; the hook's answers that come later dropped.
  const DB = { question: "Which database?", header: "Database", options: [{ label: "Postgres", description: "Already here." }, { label: "SQLite", description: "One file." }] };
  const q = [say("", [call("ask_user", { questions: [DB] }, "q1")]), say("ok")];
  const QH = { PermissionRequest: [{ matcher: "AskUserQuestion", hooks: [{ type: "command", command: "q.sh" }] }] };
  t = await loop(q, { hooks: QH, mode: "auto", ask: machineAsk({ after: 10, answer: { choice: "answers", picks: [{ options: [0] }] } }), hookRun: async () => { await wait(100); return allowPR({ updatedInput: { questions: [DB], answers: { "Which database?": "SQLite" } } }); } });
  assert.match(t.told("q1"), /"Which database\?"="Postgres"/);
  assert.deepEqual(t.events.filter((e) => e.type === "permanswer").map((e) => [e.choice, e.hook]), [["answers", undefined]]);
  // A hook first: the card closed with its answers.
  t = await loop(q, { hooks: QH, mode: "auto", ask: machineAsk({ after: 400 }), hookRun: () => allowPR({ updatedInput: { questions: [DB], answers: { "Which database?": "SQLite" } } }) });
  assert.match(t.told("q1"), /"Which database\?"="SQLite"/);
  assert.deepEqual(t.events.filter((e) => e.type === "permanswer").map((e) => [e.choice, e.hook]), [["yes", true]]);
  assert.ok(t.events.some((e) => e.type === "note" && e.text === 'A PermissionRequest hook answered Coder\'s question for you: "Which database?"="SQLite"'));
});

test("F4H8 a card left open pauses its job after a while (PARK_MS) only once its PermissionRequest hooks are done: a hook still deciding keeps the job, and its answer counts; one that decides nothing lets the job pause", async () => {
  const steps = [say("I'll install it.", [call("bash", { command: "npm install left-pad", description: "Install" }, "b1")]), say("Installed.")];
  let t = await loop(steps, { hooks: PR(), ask: machineAsk(), deps: { parkMs: 20 }, hookRun: async () => { await wait(150); return allowPR(); } });
  assert.notEqual(t.r.status, "parked");
  assert.equal(t.ran.filter((c) => /left-pad/.test(c)).length, 1);
  assert.deepEqual(t.events.filter((e) => e.type === "permanswer").map((e) => [e.choice, e.hook]), [["yes", true]]);
  t = await loop(steps, { hooks: PR(), ask: machineAsk(), deps: { parkMs: 20 }, hookRun: async () => { await wait(150); return {}; } });
  assert.equal(t.r.status, "parked");
  assert.deepEqual(t.ran, []);
  // With no hooks, the pause comes as before.
  t = await loop(steps, { ask: machineAsk(), deps: { parkMs: 20 } });
  assert.equal(t.r.status, "parked");
});

// ── D5: WHERE NO ONE CAN ANSWER ───────────────────────────────────────────────────────────────────────────────────────

test("F4H9 a job from GitHub: a command that would ask (a protected file) is run when a PermissionRequest hook allows it, refused with the hook's no (\"Permission denied by hook\" when it gave no message), and refused as before when none decides; with auto mode off, a hook's allow runs it with no checker", async () => {
  const steps = [say("", [call("bash", { command: "echo registry=x > .npmrc", description: "Set the registry" }, "b1")]), say("ok")];
  let t = await loop(steps, { hooks: PR(), mode: "auto", extra: { github: true }, hookRun: () => allowPR() });
  assert.deepEqual(t.ran.filter((c) => /npmrc/.test(c)).length, 1);
  assert.ok(t.events.some((e) => e.type === "note" && e.text === "A PermissionRequest hook allowed this."));
  assert.ok(!t.events.some((e) => e.type === "permission" || e.type === "runask"), "no card");
  const pr = t.hookCalls.find((h) => h.input.hook_event_name === "PermissionRequest").input;
  assert.deepEqual([pr.tool_name, pr.tool_input.command], ["Bash", "echo registry=x > .npmrc"]);
  t = await loop(steps, { hooks: PR(), mode: "auto", extra: { github: true }, hookRun: () => denyPR("") });
  assert.deepEqual(t.ran, []);
  assert.equal(t.told("b1"), "Permission denied by hook");
  assert.equal(t.events.find((e) => e.type === "result" && e.id === "b1").output, "Not run: your PermissionRequest hook said no.");
  t = await loop(steps, { hooks: PR(), mode: "auto", extra: { github: true }, hookRun: () => ({}) });
  assert.deepEqual(t.ran, []);
  assert.match(t.told("b1"), /^error: this command writes \.npmrc, a protected file, so it is not run in a job started from GitHub, where no one can allow it/);
  // Auto mode off in a GitHub job: no checker may approve; a hook's allow runs it, unreviewed; none, refused as before.
  const steps2 = [say("", [call("bash", { command: "touch x.txt" }, "b2")]), say("done")];
  const gh = { github: true, autoOff: true, checker: true, checkWhere: { key: "k1", repo: "ana/shop", branch: "coder/shop-1" } };
  t = await loop(steps2, { hooks: PR(), mode: "auto", extra: gh, hookRun: () => allowPR() });
  assert.deepEqual(t.ran.filter((c) => !/coder-tools\.mjs/.test(c)), ["touch x.txt"]);
  assert.equal(t.seen.length, 2, "no checker was asked");
  t = await loop(steps2, { hooks: PR(), mode: "auto", extra: gh, hookRun: () => ({}) });
  assert.deepEqual(t.ran.filter((c) => !/coder-tools\.mjs/.test(c)), []);
  assert.deepEqual(t.events.filter((e) => e.type === "result" && e.id === "b2").map((e) => e.output), [A.AUTO_OFF_GITHUB]);
});

test("F4H10 with no way to show a card, every tool that would ask runs its PermissionRequest hooks first: a search under a Read ask rule, a page fetch, a connector tool that asks every time, a rule on another tool, Coder's question and its plan", async () => {
  // A search under the owner's Read ask rule.
  const grep = [say("", [call("grep", { pattern: "TODO", path: "notes.md" }, "g1")]), say("ok")];
  const rules = { allow: [], ask: ["Read(*.md)"], deny: [] };
  let t = await loop(grep, { hooks: PR("Grep"), extra: { rules }, tools: { grep: (a) => "searched " + a.pattern }, hookRun: () => allowPR() });
  assert.match(t.told("g1"), /^searched TODO/);
  t = await loop(grep, { hooks: PR("Grep"), extra: { rules }, tools: { grep: (a) => "searched " + a.pattern }, hookRun: () => ({}) });
  // (Told the card's words, Claude Code's, as for a page fetch: round 5.)
  assert.equal(t.told("g1"), "Coder requested permissions to read from /work/shop/notes.md, but you haven't granted it yet.");
  // A page fetch the owner must approve: refused in Claude Code's words when no hook allows it.
  const fetch = [say("", [call("web_fetch", { url: "https://example.com/a", prompt: "What is it?" }, "f1")]), say("ok")];
  t = await loop(fetch, { hooks: PR("WebFetch"), hookRun: () => denyPR("No fetching from here.") });
  assert.equal(t.told("f1"), "No fetching from here.");
  t = await loop(fetch, { hooks: PR("WebFetch"), hookRun: () => ({}) });
  assert.equal(t.told("f1"), "Coder requested permissions to use WebFetch, but you haven't granted it yet.");
  // A connector tool its server asks about every time.
  const conn = [{ name: "mcp__bank__pay", label: "Bank: pay", description: "Pay", parameters: { type: "object", properties: {} }, readOnly: false, perm: "ask", server: "c1", connector: "Bank", always: true }];
  const mcpCalls = [];
  const mcp = async (name, args) => { mcpCalls.push(name); return { text: "paid", isError: false }; };
  const pay = [say("", [call("mcp__bank__pay", {}, "m1")]), say("ok")];
  t = await loop(pay, { hooks: PR("mcp__bank__pay"), mode: "auto", extra: { connectors: conn }, deps: { mcp }, hookRun: () => allowPR() });
  assert.deepEqual(mcpCalls, ["mcp__bank__pay"]);
  t = await loop(pay, { hooks: PR("mcp__bank__pay"), mode: "auto", extra: { connectors: conn }, deps: { mcp }, hookRun: () => ({}) });
  assert.equal(t.told("m1"), "error: this connector tool needs the owner's approval each time, and nobody can be asked here");
  assert.equal(mcpCalls.length, 1);
  // A rule asking about another tool (TaskCreate).
  const task = [say("", [call("task_create", { subject: "Add tests", description: "Unit tests for the cart" }, "t1")]), say("ok")];
  t = await loop(task, { hooks: PR("TaskCreate"), extra: { rules: { allow: [], ask: ["TaskCreate"], deny: [] } }, hookRun: () => allowPR() });
  assert.match(t.told("t1"), /^Task #1 created successfully: Add tests/);
  t = await loop(task, { hooks: PR("TaskCreate"), extra: { rules: { allow: [], ask: ["TaskCreate"], deny: [] } }, hookRun: () => ({}) });
  assert.equal(t.told("t1"), "not run: the owner's rule TaskCreate asks first for TaskCreate, and no one can answer in this job");
  // Coder's question: a hook's answers, or its no; with none, the turn ends with the question, as before.
  const DB = { question: "Which database?", header: "Database", options: [{ label: "Postgres", description: "Already here." }, { label: "SQLite", description: "One file." }] };
  const q = [say("", [call("ask_user", { questions: [DB] }, "q1")]), say("ok")];
  const QH = PR("AskUserQuestion");
  t = await loop(q, { hooks: QH, mode: "auto", hookRun: () => allowPR({ updatedInput: { questions: [DB], answers: { "Which database?": "SQLite" } } }) });
  assert.match(t.told("q1"), /^Your questions have been answered: "Which database\?"="SQLite"/);
  assert.ok(!t.events.some((e) => e.type === "question"), "no card");
  t = await loop(q, { hooks: QH, mode: "auto", hookRun: () => denyPR("") });
  assert.equal(t.told("q1"), "Permission denied by hook");
  t = await loop(q, { hooks: QH, mode: "auto", hookRun: () => ({}) });
  assert.equal(t.told("q1"), "asked the owner; their answer comes as the next message");
  // Its plan: a hook's allow with its input approves it.
  const plan = [say("", [call("exit_plan_mode", { plan: "1. Fix the cart\n" }, "x1")]), say("Done.")];
  t = await loop(plan, { hooks: PR("ExitPlanMode"), mode: "plan", hookRun: (i) => allowPR({ updatedInput: i.tool_input }) });
  assert.match(t.told("x1"), /^The owner has approved your plan\./);
  t = await loop(plan, { hooks: PR("ExitPlanMode"), mode: "plan", hookRun: () => ({}) });
  assert.equal(t.told("x1"), "the plan is shown to the owner; they approve it by changing the mode");
  // REFUSE INSTEAD OF ASKING (Settings; Claude Code's denyInsteadOfPrompting): no card; the hooks decide first, in the words of
  // that path; none decides, refused as before.
  const cmd = [say("", [call("bash", { command: "npm install left-pad", description: "Install" }, "b1")]), say("ok")];
  const never = machineAsk({ after: 0, answer: { choice: "yes" } });
  t = await loop(cmd, { hooks: PR(), ask: never, extra: { denyInstead: true }, hookRun: () => allowPR() });
  assert.equal(t.ran.filter((c) => /left-pad/.test(c)).length, 1);
  assert.ok(!t.events.some((e) => e.type === "permission"), "no card");
  t = await loop(cmd, { hooks: PR(), ask: never, extra: { denyInstead: true }, hookRun: () => denyPR("") });
  assert.equal(t.told("b1"), "Permission denied by hook");
  t = await loop(cmd, { hooks: PR(), ask: never, extra: { denyInstead: true }, hookRun: () => ({}) });
  assert.ok(t.told("b1").startsWith(A.DENY_INSTEAD_TEXT));
  assert.deepEqual(t.ran, []);
});

test("F4H11 on a real machine: a SessionEnd mcp_tool hook runs when the machine stops, through the job's connector caller (a job with no connectors: Claude Code's 'not connected'), and is in the stop's record", async () => {
  const http = await import("node:http");
  const { mkdtemp } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { createApp } = await import("../container/server.mjs");
  const roots = { root: await mkdtemp(join(tmpdir(), "coder-f4-")), gitRoot: await mkdtemp(join(tmpdir(), "coder-f4g-")), memRoot: await mkdtemp(join(tmpdir(), "coder-f4m-")), bgRoot: await mkdtemp(join(tmpdir(), "coder-f4b-")), home: await mkdtemp(join(tmpdir(), "coder-f4h-")) };
  const project = "f4-end1";
  const app = createApp({ ...roots, send: async () => say("Bye.") });
  const srv = http.createServer(app);
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + srv.address().port;
  try {
    const hooks = { hooks: { SessionEnd: [{ hooks: [{ type: "mcp_tool", server: "Slack", tool: "post", input: { text: "Chat ended: ${reason}" } }] }] } };
    assert.equal((await fetch(base + "/turn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project, text: "bye", messages: [], hooks }) })).status, 200);
    for (let i = 0; i < 200; i++) { const st = await (await fetch(base + "/state?project=" + project + "&since=0")).json(); if (st.result) break; await wait(50); }
    assert.equal(await app.sessionEnd("other"), 1);
    const recs = readFileSync(join(roots.gitRoot, ".session-end.log"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    const said = recs.at(-1).said;
    assert.deepEqual([said.length, said[0].chat, said[0].hook, said[0].code, said[0].out], [1, project, "Slack post", 1, "MCP server 'Slack' not connected"]);
  } finally { srv.close(); }
});
