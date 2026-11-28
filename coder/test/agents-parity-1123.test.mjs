// CODER'S AGENT, WORKFLOW, TASKSTOP, TASK-TOOL, TOOL SEARCH AND SKILL ROWS MADE CLAUDE CODE'S (2026-11-23): agents from the
// main conversation run in the background by default and a subagent's wait; subagents can start agents; SubagentHandback
// only in auto mode; outputFile and canReadOutputFile; usage and totalTokens of the final request; modelsUsed only on a
// swap; workflows launch in the background (async_launched, local_workflow) with a syntax check first; stop_job stops a
// background agent by name; the Task tools' availability rules; tool search's catalog and compaction; a skill that sets
// allowed-tools asks. The model is stubbed: no paid call is made.
import { test } from "node:test";
import assert from "node:assert/strict";

const A = await import("../container/coder-agent.mjs");
const G = await import("../container/coder-agents.mjs");
const TK = await import("../container/coder-tasks.mjs");
const TS = await import("../container/coder-toolsearch.mjs");
const CP = await import("../container/coder-compact.mjs");
const SK = await import("../container/coder-skills.mjs");

const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 3, out: 2 } });
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const ROOT = "/data/coder/projects/agents-1123";
const isSub = (req) => (req.messages || []).some((m) => m.role === "system" && /You are an agent for Coder|You run as a subagent of Coder/.test(String(m.content)));
const userText = (req) => (req.messages || []).filter((m) => m.role === "user").map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content))).join("\n");
const base = (send, extra = {}) => ({ send, exec: async () => ({ code: 0, output: "" }), emit: () => {}, here: () => ROOT, root: ROOT, home: "/home/dev", chatId: "agents-1123", where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p), toolSearch: "false", ...extra });
const opts = (text, more = {}) => ({ text, mode: "auto", rules: { allow: [], ask: [], deny: [] }, ...more });
const toolAnswer = (r, id) => String((r.messages.find((m) => m.role === "tool" && m.tool_call_id === id) || {}).content || "");
const mainLoop = (main) => { let mi = 0; return () => main[Math.min(mi++, main.length - 1)]; };
const noteOf = (r, id) => String((r.messages.find((m) => m.role === "user" && new RegExp("<task-id>" + id + "</task-id>").test(String(m.content || ""))) || {}).content || "");

test("run_in_background left out: the main conversation's agent runs in the background, a subagent's waits, a definition's background counts", () => {
  assert.equal(G.backgroundOf(undefined, null, false), true);
  assert.equal(G.backgroundOf(undefined, null, true), false);
  assert.equal(G.backgroundOf(undefined, { background: true }, true), true);
  assert.equal(G.backgroundOf(false, { background: true }, false), false);
  assert.equal(G.backgroundOf(true, null, true), true);
  assert.match(G.AGENT_TOOL.function.parameters.properties.run_in_background.description, /Left out: true from the main conversation, false from a subagent/);
});

test("a main-conversation agent with no run_in_background is launched in the background with outputFile and canReadOutputFile; its report is written there", async () => {
  const events = [], cmds = [];
  const next = mainLoop([say("", [call("agent", { description: "look", prompt: "Check a.js" }, "a1")]), say("Launched."), say("Done.")]);
  const send = async (req) => (isSub(req) ? say("", [call("subagent_handback", { message: "a.js is fine." }, "h")]) : next());
  const exec = async ({ command }) => { cmds.push(command); return { code: 0, output: "" }; };
  const r = await A.runCoder(base(send, { exec, emit: (e) => events.push(e) }), opts("go", { model: "grok-4.7", effort: "low" }));
  const launched = events.find((e) => e.type === "result" && e.id === "a1").agentResult;
  assert.equal(launched.status, "async_launched");
  assert.equal(launched.isAsync, true);
  assert.equal(launched.outputFile, "/tmp/coder-agents/agent-1.output");
  assert.equal(launched.canReadOutputFile, true);
  assert.match(toolAnswer(r, "a1"), /outputFile: \/tmp\/coder-agents\/agent-1\.output/);
  const wrote = cmds.filter((c) => /base64 -d > '\/tmp\/coder-agents\/agent-1\.output'/.test(c));
  assert.equal(wrote.length, 2, "made empty at launch, then the report");
  assert.equal(Buffer.from(/printf %s '([^']*)'/.exec(wrote[1])[1], "base64").toString(), "a.js is fine.\n");
  assert.match(noteOf(r, "agent-1"), /<output-file>\/tmp\/coder-agents\/agent-1\.output<\/output-file>/);
});

test("a general-purpose subagent can start an agent of its own, which it waits for; both count against the job's caps", async () => {
  let depth2 = 0;
  const next = mainLoop([say("", [call("agent", { description: "outer", prompt: "OUTER task", run_in_background: false }, "a1")]), say("ok")]);
  const send = async (req) => {
    if (!isSub(req)) return next();
    const t = userText(req);
    if (/INNER task/.test(t)) { depth2++; return say("", [call("subagent_handback", { message: "inner report" }, "hi")]); }
    const tools = (req.tools || []).map((x) => x.function.name);
    assert.ok(tools.includes("agent"), "the general-purpose subagent has agent");
    const answered = (req.messages || []).find((m) => m.role === "tool");
    if (!answered) return say("", [call("agent", { description: "inner", prompt: "INNER task" }, "n1")]);
    assert.match(String(answered.content), /^inner report/, "it waited for the inner agent");
    return say("", [call("subagent_handback", { message: "outer report" }, "ho")]);
  };
  const r = await A.runCoder(base(send), opts("go"));
  assert.equal(depth2, 1);
  assert.match(toolAnswer(r, "a1"), /^outer report/);
});

test("subagent_handback is given only in auto mode; otherwise a subagent's last words are its report", () => {
  const coderTools = [{ type: "function", function: { name: "read" } }, { type: "function", function: { name: "bash" } }];
  assert.ok(G.subagentTools(coderTools, "Explore", null, { mode: "auto" }).some((t) => t.function.name === "subagent_handback"));
  for (const m of ["default", "acceptEdits", "plan", "bypassPermissions"]) assert.ok(!G.subagentTools(coderTools, "Explore", null, { mode: m }).some((t) => t.function.name === "subagent_handback"), m);
  assert.equal(G.handbackFor("auto"), true);
});

test("usage and totalTokens are the final request's; modelsUsed only when a mid-run swap happened", () => {
  const u = G.usageOf([{ in: 100, out: 50 }, { in: 7, out: 3, cached: 2 }]);
  assert.equal(u.totalTokens, 10);
  assert.equal(u.usage.input_tokens, 7);
  assert.equal(u.usage.cache_read_input_tokens, 2);
  for (const k of ["server_tool_use", "service_tier", "cache_creation", "inference_geo", "speed", "iterations"]) assert.ok(k in u.usage, k);
  assert.equal(G.modelsUsedOf([{ model: "grok-4.7" }, { model: "grok-4.7" }], "grok-4.7"), null);
  assert.deepEqual(G.modelsUsedOf([{ model: "b" }, { model: "a" }], "a"), ["a", "b", "a"]);
});

test("a workflow returns at once (async_launched, local_workflow, workflowName, runId, summary, scriptPath); one failing its syntax check never runs", async () => {
  assert.match(G.WORKFLOW_TOOL.function.description, /in the background/);
  const events = [];
  let subs = 0;
  const good = "export const meta = { name: 'two', description: 'two steps' }\nconst a = await agent('x')\nreturn a";
  const bad = "export const meta = { name: 'oops', description: 'broken' }\nreturn 1 +;";
  const next = mainLoop([say("", [call("workflow", { script: bad }, "w0"), call("workflow", { script: good }, "w1")]), say("Launched."), say("ok")]);
  const send = async (req) => { if (isSub(req)) { subs++; return say("", [call("subagent_handback", { message: "step done" }, "h")]); } return next(); };
  const r = await A.runCoder(base(send, { emit: (e) => events.push(e), workflowStep: G.workflowStep }), opts("go"));
  const w0 = events.find((e) => e.type === "result" && e.id === "w0").workflowResult;
  assert.equal(w0.status, "async_launched");
  assert.equal(w0.workflowName, "oops");
  assert.match(w0.error, /Unexpected token/);
  assert.match(toolAnswer(r, "w0"), /failed its syntax check, so it never ran/);
  const w1 = events.find((e) => e.type === "result" && e.id === "w1").workflowResult;
  assert.deepEqual(w1, { status: "async_launched", taskId: "wf-2", taskType: "local_workflow", workflowName: "two", runId: "wf-2", summary: "two steps" });
  assert.equal(subs, 1, "only the good workflow ran");
  const n = noteOf(r, "wf-2");
  assert.match(n, /<task-type>local_workflow<\/task-type>\n<status>completed<\/status>/);
  assert.match(n, /result:\n"step done"/);
});

test("stop_job stops a background agent by its name (Claude Code's TaskStop from v2.1.198); its notification says killed", async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const next = mainLoop([say("", [call("agent", { description: "slow", prompt: "slow work", name: "slowpoke" }, "a1")]), say("", [call("stop_job", { task_id: "slowpoke" }, "s1")]), say("Stopped it."), say("ok")]);
  let mainN = 0;
  const send = async (req) => {
    if (isSub(req)) { await gate; return say("", [call("read", { file_path: "a.js" }, "r1")]); }
    mainN++;
    if (mainN === 3) setTimeout(release, 5);
    return next();
  };
  const r = await A.runCoder(base(send), opts("go"));
  assert.match(toolAnswer(r, "s1"), /"message":"Successfully stopped task: agent-1 \(slow\)","task_id":"agent-1","task_type":"local_agent"/);
  assert.match(noteOf(r, "agent-1"), /<status>killed<\/status>/);
  const bg = new Map();
  assert.equal(G.stopBgTask(bg, "nope"), null);
});

test("the Task tools: on by default for Opus 4.7, Sonnet 4.6, Haiku 4.5 and older; newer and unknown models need the opt-in; cloud and background sessions always", () => {
  for (const m of ["claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5-20251001", "claude-3-5-sonnet-20241022", "claude-sonnet-4-20250514", "claude-opus-4-1"]) assert.equal(TK.taskToolsAvailable({ model: m }), true, m);
  for (const m of ["claude-opus-5", "claude-opus-4-8", "claude-sonnet-4-7", "grok-4.7", ""]) assert.equal(TK.taskToolsAvailable({ model: m }), false, m);
  assert.equal(TK.taskToolsAvailable({ model: "grok-4.7", optIn: true }), true);
  assert.equal(TK.taskToolsAvailable({ model: "grok-4.7", allowed: ["TaskCreate"] }), true);
  assert.equal(TK.taskToolsAvailable({ model: "grok-4.7", background: true }), true);
  assert.equal(TK.taskToolsAvailable({ model: "grok-4.7", cloud: true }), true, "Coder's chats are cloud sessions");
});

test("tool search: the catalog holds up to 10,000 tools; found tools are dropped when the messages that found them are compacted (Coder's chats)", () => {
  assert.equal(TS.TOOL_SEARCH_CATALOG_MAX, 10_000);
  const part = [{ role: "tool", tool_call_id: "t", content: "found", toolsLoaded: ["mcp__x__y"], toolDefs: [{ type: "function", function: { name: "mcp__x__y" } }] }];
  const coder = CP.summaryMessage("sum", "earlier", [], part);
  assert.deepEqual(coder.toolsLoaded, []);
  assert.equal(coder.toolDefs, undefined);
  const gloopy = CP.summaryMessage("sum", "earlier", [], part, { gloopy: true });
  assert.deepEqual(gloopy.toolsLoaded, ["mcp__x__y"], "Gloopy's unchanged");
});

// (2026-11-28, Claude Code's skills docs: allowed-tools pre-approves tools for the turn and disallowed-tools only narrows, so
// neither makes loading ask; a skill's hooks still do. skills-agents-1128.test.mjs.)
test("a skill that sets hooks asks before it is used; allowed-tools and disallowed-tools don't", () => {
  assert.equal(SK.skillAsks({ name: "x", "allowed-tools": "Bash(git *)" }), "");
  assert.equal(SK.skillAsks({ hooks: "", "disallowed-tools": "Write" }), "hooks");
  assert.equal(SK.skillAsks({ name: "x", description: "y" }), "");
});
