// CODER'S AGENT TOOLS, CLAUDE CODE'S WAY (2026-11-23, second pass; coder-agents.mjs): every input of Claude Code's Agent, its
// background runs, a message's agent calls side by side, model and effort, isolation "worktree", custom agents from
// .claude/agents/*.md, the old name Task, the result's fields, SubagentStart and SubagentStop hooks, workflow extras and
// send_message's summary. The model is stubbed: no paid call is made.
import { test } from "node:test";
import assert from "node:assert/strict";

const A = await import("../container/coder-agent.mjs");
const G = await import("../container/coder-agents.mjs");
const H = await import("../container/coder-hooks.mjs");
const W = await import("../container/coder-worktree.mjs");

const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 3, out: 2 } });
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const ROOT = "/data/coder/projects/agents-cc";
const isSub = (req) => (req.messages || []).some((m) => m.role === "system" && /You are an agent for Coder|You run as a subagent of Coder/.test(String(m.content)));
const sysOf = (req) => String(((req.messages || []).find((m) => m.role === "system") || {}).content || "");
const userText = (req) => (req.messages || []).filter((m) => m.role === "user").map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content))).join("\n");
const base = (send, extra = {}) => ({ send, exec: async () => ({ code: 0, output: "" }), emit: () => {}, here: () => ROOT, root: ROOT, home: "/home/dev", chatId: "agents-cc", where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p), toolSearch: "false", ...extra });
const opts = (text, more = {}) => ({ text, mode: "auto", rules: { allow: [], ask: [], deny: [] }, ...more });
const toolAnswer = (r, id) => String((r.messages.find((m) => m.role === "tool" && m.tool_call_id === id) || {}).content || "");
const mainLoop = (main) => { let mi = 0; return () => main[Math.min(mi++, main.length - 1)]; };

test("agent's inputs are Claude Code's AgentInput, with Coder's models; its description is Claude Code's, with the caps, custom agents, background and worktree", () => {
  const p = G.AGENT_TOOL.function.parameters.properties;
  assert.deepEqual(Object.keys(p), ["description", "prompt", "subagent_type", "model", "effort", "run_in_background", "name", "team_name", "mode", "isolation"]);
  assert.deepEqual(p.model.enum, ["grok-4.7"]);
  assert.deepEqual(p.effort.enum, ["low", "medium", "high", "xhigh", "max"]);
  assert.deepEqual(p.isolation.enum, ["worktree", "remote"]);
  assert.deepEqual(p.mode.enum, ["acceptEdits", "auto", "bypassPermissions", "default", "dontAsk", "plan"]);
  const d = G.AGENT_TOOL.function.description;
  assert.match(d, /^Launch a new agent to handle complex, multi-step tasks autonomously\./);
  assert.match(d, /use a single message with multiple agent calls/);
  assert.match(d, /you will be automatically notified when it completes/);
  assert.match(d, /isolation: "worktree"/);
  assert.match(d, /\.claude\/agents\/\*\.md/);
  assert.match(d, /The old name of this tool, Task, still works/);
  assert.match(d, /no agent teams and no remote agents/);
  assert.deepEqual(Object.keys(G.WORKFLOW_TOOL.function.parameters.properties), ["script", "name", "scriptPath", "args", "resumeFromRunId", "title", "description"]);
  assert.deepEqual(Object.keys(G.SEND_MESSAGE_TOOL.function.parameters.properties), ["to", "message", "summary"]);
  assert.match(G.SUBAGENT_HANDBACK_TOOL.function.description, /^Deliver your final report to the agent that spawned you \(your caller\)/);
  assert.ok(H.HOOK_EVENTS.includes("SubagentStart") && H.HOOK_EVENTS.includes("SubagentStop"));
});

test("the old name Task starts an agent; send_message's summary is the first line, cut at 200 characters", () => {
  const calls = A.readCalls({ tool_calls: [call("Task", { description: "x", prompt: "y" }, "t1"), call("task", {}, "t2")] });
  assert.deepEqual(calls.map((c) => c.name), ["agent", "agent"]);
  assert.equal(G.summaryOf("", "First line\nsecond"), "First line");
  assert.equal(G.summaryOf("a".repeat(250), "x").length, 200);
  assert.ok(G.summaryOf("a".repeat(250), "x").endsWith("…"));
});

test("model and effort: only Coder's models; an effort the model lacks runs at its nearest level; a custom agent's own, then the chat's", () => {
  assert.deepEqual(G.resolveAgentModel({ effort: "max" }, null, { model: "grok-4.7", effort: "low" }), { model: "grok-4.7", effort: "xhigh" });
  assert.deepEqual(G.resolveAgentModel({}, null, { model: "grok-4.7", effort: "medium" }), { model: "grok-4.7", effort: "medium" });
  assert.deepEqual(G.resolveAgentModel({}, { model: "sonnet", effort: "high" }, { model: "grok-4.7", effort: "low" }), { model: "grok-4.7", effort: "high" });
  assert.match(G.resolveAgentModel({ model: "opus" }, null, {}).error, /model is one of grok-4\.7/);
  assert.match(G.resolveAgentModel({ effort: "huge" }, null, {}).error, /effort is one of/);
});

test("custom agents: .claude/agents/*.md frontmatter (name, description, tools, disallowedTools, model, effort, maxTurns), the files Claude Code skips, and zero tools refused", () => {
  const file = "---\nname: reviewer\ndescription: Reviews code\ntools: Read, Grep, Bash\ndisallowedTools: [Bash]\nmodel: inherit\neffort: high\nmaxTurns: 5\n---\nYou review code carefully.\n";
  const { def } = G.parseAgentFile(file, ".claude/agents/reviewer.md");
  assert.equal(def.name, "reviewer");
  assert.equal(def.prompt, "You review code carefully.");
  assert.deepEqual(G.resolveAgentTools("reviewer", def), { names: ["read", "grep"] });
  assert.equal(def.maxTurns, 5);
  assert.equal(G.parseAgentFile("no frontmatter").skip, "no frontmatter");
  assert.equal(G.parseAgentFile("---\ndescription: x\n---\n").skip, "no name");
  assert.match(G.parseAgentFile("---\nname: a:b\ndescription: x\n---\n").skip, /holds :/);
  assert.equal(G.parseAgentFile("---\nname: a\n---\n").skip, "a name but no description");
  const list = G.parseAgentFile("---\nname: lister\ndescription: d\ntools:\n  - Glob\n  - WebSearch\n---\nbody").def;
  assert.deepEqual(G.resolveAgentTools("lister", list).names, ["glob", "web_search"]);
  assert.match(G.resolveAgentTools("x", { name: "x", tools: ["Frobnicate"], disallowedTools: [] }).error, /would be spawned with zero tools.*Frobnicate/);
  const files = G.agentFilesOf(G.AGENT_FILES_MARK + ".claude/agents/reviewer.md\n" + file + "\n" + G.AGENT_FILES_MARK + ".claude/agents/README.md\n# notes\n");
  const got = G.customAgentsFrom(files);
  assert.deepEqual(got.defs.map((d) => d.name), ["reviewer"]);
  assert.match(G.agentFilesScript(), /\.claude\/agents\/\*\.md/);
});

test("a custom agent runs with its own instructions, tools, effort and step limit; an unknown type is refused with the list", async () => {
  const subs = [];
  const def = G.parseAgentFile("---\nname: reviewer\ndescription: Reviews code\ntools: Read, Grep\neffort: high\nmaxTurns: 3\n---\nYou review code carefully.").def;
  const next = mainLoop([say("", [call("agent", { description: "review", prompt: "Review x.js", subagent_type: "reviewer" }, "a1"), call("agent", { description: "nope", prompt: "p", subagent_type: "ghost" }, "a2")]), say("ok")]);
  const send = async (req) => { if (isSub(req)) { subs.push({ sys: sysOf(req), tools: req.tools.map((t) => t.function.name), effort: req.effort }); return say("", [call("subagent_handback", { message: "Looks fine." }, "h")]); } return next(); };
  const r = await A.runCoder(base(send, { customAgents: async () => [def] }), opts("go", { model: "grok-4.7", effort: "low" }));
  assert.equal(subs.length, 1);
  assert.match(subs[0].sys, /^You review code carefully\./);
  assert.deepEqual(subs[0].tools.sort(), ["grep", "read", "subagent_handback"]);
  assert.equal(subs[0].effort, "high");
  assert.match(toolAnswer(r, "a1"), /^Looks fine\./);
  assert.match(toolAnswer(r, "a2"), /Agent type 'ghost' not found\. Available agents: general-purpose, Explore, Plan, reviewer/);
});

test("a message's agent calls run side by side, at most 3 at once; with CODER_MAX_SUBAGENTS_AT_ONCE 1, one at a time", async () => {
  for (const [env, want] of [[{}, 3], [{ CODER_MAX_SUBAGENTS_AT_ONCE: "1" }, 1]]) {
    let live = 0, peak = 0;
    const next = mainLoop([say("", [1, 2, 3, 4].map((n) => call("agent", { description: "job " + n, prompt: "do job " + n }, "a" + n))), say("ok")]);
    const send = async (req) => {
      if (isSub(req)) { live++; peak = Math.max(peak, live); await new Promise((r) => setTimeout(r, 20)); live--; return say("", [call("subagent_handback", { message: "done " + userText(req).slice(-5) }, "h")]); }
      return next();
    };
    const r = await A.runCoder(base(send, { subagentEnv: env }), opts("go"));
    assert.equal(peak, want, "peak with " + JSON.stringify(env));
    for (const n of [1, 2, 3, 4]) assert.match(toolAnswer(r, "a" + n), new RegExp("^done job " + n));
  }
});

test("run_in_background: the call answers at once; the agent's result arrives later as a notification, before the turn ends; the result's fields (usage, toolStats, model)", async () => {
  const events = [];
  let release;
  const gate = new Promise((r) => { release = r; });
  const next = mainLoop([say("", [call("agent", { description: "slow", prompt: "Read a.js and fix it", run_in_background: true, name: "bg" }, "a1")]), say("Launched; waiting."), say("All done.")]);
  let mainCalls = 0;
  const send = async (req) => {
    if (isSub(req)) {
      const n = (req.messages || []).filter((m) => m.role === "tool").length;
      if (n === 0) return say("", [call("read", { file_path: "a.js" }, "r1"), call("edit", { file_path: "a.js", old_string: "a", new_string: "b\nc" }, "e1")]);
      await gate; return say("", [call("subagent_handback", { message: "Fixed a.js." }, "h")]);
    }
    mainCalls++;
    if (mainCalls === 2) setTimeout(release, 10);
    return next();
  };
  const r = await A.runCoder(base(send, { emit: (e) => events.push(e) }), opts("go", { model: "grok-4.7", effort: "low" }));
  assert.match(toolAnswer(r, "a1"), /^Async agent launched successfully\.\nagentId: agent-1 \(name: bg\)/);
  const note = r.messages.find((m) => m.role === "user" && /<task-notification>/.test(String(m.content)));
  assert.ok(note, "the notification reached Grok");
  assert.match(note.content, /<status>completed<\/status>[\s\S]*Fixed a\.js\.[\s\S]*<usage>model: grok-4\.7 \(low\)/);
  const fin = r.messages.filter((m) => m.role === "assistant").at(-1);
  assert.equal(fin.content, "All done.");
  const launched = events.find((e) => e.type === "result" && e.id === "a1");
  assert.equal(launched.agentResult.status, "async_launched");
  // (A foreground agent's result carries Claude Code's AgentOutput fields.)
  const ev2 = [];
  const next2 = mainLoop([say("", [call("agent", { description: "fg", prompt: "Read a.js and fix it" }, "f1")]), say("ok")]);
  const send2 = async (req) => {
    if (isSub(req)) { const n = (req.messages || []).filter((m) => m.role === "tool").length; return n === 0 ? say("", [call("read", { file_path: "a.js" }, "r1"), call("edit", { file_path: "a.js", old_string: "a", new_string: "b\nc" }, "e1")]) : say("", [call("subagent_handback", { message: "Fixed." }, "h")]); }
    return next2();
  };
  await A.runCoder(base(send2, { emit: (e) => ev2.push(e) }), opts("go", { model: "grok-4.7", effort: "low" }));
  const res = ev2.find((e) => e.type === "result" && e.id === "f1").agentResult;
  assert.equal(res.status, "completed");
  assert.equal(res.resolvedModel, "grok-4.7");
  assert.equal(res.agentType, "general-purpose");
  assert.deepEqual({ ...res.toolStats }, { readCount: 1, searchCount: 0, bashCount: 0, editFileCount: 1, linesAdded: 2, linesRemoved: 1, otherToolCount: 0 });
  assert.equal(res.totalToolUseCount, 2);
  assert.equal(res.usage.input_tokens, 3);
  assert.equal(res.totalTokens, 10);
});

test("isolation worktree: the agent's worktree is made without moving the chat's shell, its commands run there, and a changed one is kept with its path and branch", async () => {
  const cmds = [];
  const exec = async (x) => {
    const c = String(x.command || "");
    cmds.push(c);
    if (c.includes("worktree add")) return { code: 0, output: W.MARK + " OK " + ROOT + "/.claude/worktrees/agent-1-x|worktree-agent-1-x|" + ROOT + "\n" };
    if (c.includes("git status --porcelain")) return { code: 0, output: W.MARK + " KEPT\n" };
    return { code: 0, output: "ok\n" };
  };
  const next = mainLoop([say("", [call("agent", { description: "iso", prompt: "change things", isolation: "worktree" }, "a1"), call("agent", { description: "remote", prompt: "x", isolation: "remote" }, "a2")]), say("ok")]);
  let sub = 0;
  const send = async (req) => { if (isSub(req)) { sub++; return sub === 1 ? say("", [call("bash", { command: "ls -la" }, "b1")]) : say("", [call("subagent_handback", { message: "Changed f.txt." }, "h")]); } return next(); };
  const r = await A.runCoder(base(send, { exec }), opts("go"));
  const made = cmds.find((c) => c.includes("worktree add"));
  assert.ok(made.startsWith("(\n"), "made in a subshell");
  assert.ok(cmds.some((c) => c.startsWith("( cd -- '" + ROOT + "/.claude/worktrees/agent-1-x' || exit 1\nls -la")), "its command ran in the worktree");
  assert.match(toolAnswer(r, "a1"), /worktreePath: .*agent-1-x\nworktreeBranch: worktree-agent-1-x/);
  assert.match(toolAnswer(r, "a2"), /isolation "remote" runs Claude Code's agents in a cloud session/);
});

test("SubagentStart adds context to the agent; SubagentStop (matched on the agent's type) keeps it going once; the chat's Stop hook doesn't run for it", async () => {
  const hooks = H.hooksFrom({ hooks: {
    SubagentStart: [{ matcher: "Explore", hooks: [{ type: "command", command: "start-hook" }] }],
    SubagentStop: [{ matcher: "Explore", hooks: [{ type: "command", command: "stop-hook" }] }],
    Stop: [{ hooks: [{ type: "command", command: "main-stop" }] }],
  } }, "settings").list;
  const ran = [];
  let stops = 0;
  const exec = async (x) => {
    const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
    if (mark && x.hook === true) {
      const input = JSON.parse(x.payload);
      ran.push(input);
      let out = "";
      if (input.hook_event_name === "SubagentStart") out = JSON.stringify({ hookSpecificOutput: { hookEventName: "SubagentStart", additionalContext: "Follow security guidelines" } });
      if (input.hook_event_name === "SubagentStop" && stops++ === 0) out = JSON.stringify({ decision: "block", reason: "Also check b.js" });
      return { code: 0, output: out + "\n" + mark[0] + "\n" };
    }
    return { code: 0, output: "" };
  };
  const subs = [];
  const next = mainLoop([say("", [call("agent", { description: "look", prompt: "Check a.js", subagent_type: "Explore" }, "a1")]), say("ok")]);
  const send = async (req) => { if (isSub(req)) { subs.push({ sys: sysOf(req), text: userText(req) }); return subs.length === 1 ? say("a.js is fine") : say("b.js is fine too"); } return next(); };
  const r = await A.runCoder(base(send, { exec }), opts("go", { hooks }));
  const evs = ran.map((x) => x.hook_event_name);
  assert.deepEqual(evs.filter((e) => e !== "Stop"), ["SubagentStart", "SubagentStop", "SubagentStop"]);
  assert.equal(evs.filter((e) => e === "Stop").length, 1, "the chat's own Stop hook ran once, for the chat");
  const start = ran.find((x) => x.hook_event_name === "SubagentStart");
  assert.equal(start.agent_type, "Explore"); assert.equal(start.agent_id, "agent-1");
  const stop = ran.find((x) => x.hook_event_name === "SubagentStop");
  assert.equal(stop.last_assistant_message, "a.js is fine"); assert.equal(stop.stop_hook_active, false);
  assert.match(subs[0].sys, /Follow security guidelines/);
  assert.match(subs[1].text, /Also check b\.js/);
  assert.match(toolAnswer(r, "a1"), /^b\.js is fine too/);
});

test("workflow extras: agent() takes model, effort and phase; the answer names the summary and the agents per phase", async () => {
  const script = `export const meta = { name: 'audit', description: 'audit two files', phases: ['Scan', 'Fix'] }
phase('Scan')
const a = await agent('scan a', { effort: 'medium' })
const b = await agent('fix b', { phase: 'Fix', model: 'grok-4.7' })
return [a, b]`;
  const p = await G.workflowStep({ script });
  assert.equal(p.pending[0].phase, "Scan");
  assert.equal(p.pending[0].effort, "medium");
  const efforts = [];
  const next = mainLoop([say("", [call("workflow", { script }, "w1")]), say("ok")]);
  const send = async (req) => { if (isSub(req)) { efforts.push(req.effort); return say("", [call("subagent_handback", { message: "ok " + userText(req) }, "h")]); } return next(); };
  const r = await A.runCoder(base(send, { workflowStep: G.workflowStep }), opts("go", { model: "grok-4.7", effort: "low" }));
  const w = toolAnswer(r, "w1");
  assert.match(w, /summary: audit two files\nphases: Scan: 1, Fix: 1/);
  assert.deepEqual(efforts, ["medium", "low"]);
});
