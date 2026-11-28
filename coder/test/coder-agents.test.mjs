// CLAUDE CODE'S AGENT, SUBAGENTHANDBACK, LISTAGENTS, SENDMESSAGE AND WORKFLOW IN CODER (2026-11-23; coder-agents.mjs).
// The model is stubbed: no paid call is made.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const A = await import("../container/coder-agent.mjs");
const G = await import("../container/coder-agents.mjs");
const H = await import("../container/coder-hooks.mjs");
const TS = await import("../container/coder-toolsearch.mjs");
const T = await import("../container/coder-tools.mjs");

const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const ROOT = "/data/coder/projects/agents-t";
const isSub = (req) => (req.messages || []).some((m) => m.role === "system" && String(m.content).startsWith("You are an agent for Coder"));
const userText = (req) => (req.messages || []).filter((m) => m.role === "user").map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content))).join("\n");
const base = (send, extra = {}) => ({ send, exec: async () => ({ code: 0, output: "" }), emit: () => {}, here: () => ROOT, root: ROOT, home: "/home/dev", chatId: "agents-t", where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p), toolSearch: "false", ...extra });
const opts = (text) => ({ text, mode: "auto", rules: { allow: [], ask: [], deny: [] } });
// (A foreground report's no-authority header, 2026-11-28, left off here: subagents-cc-1128b tests it.)
const toolAnswer = (r, id) => String((r.messages.find((m) => m.role === "tool" && m.tool_call_id === id) || {}).content || "").replace(/^\[Subagent output: [^\n]*\]\n/, "");

/** A background workflow's result, from its task notification. */
const wfResult = (r, id) => { for (const m of r.messages) { const x = new RegExp("<task-id>" + id + "</task-id>[\\s\\S]*?<result>\\n([\\s\\S]*?)\\n</result>").exec(String(m.content || "")); if (x) return x[1]; } return ""; };

test("the tools: agent, list_agents, workflow and subagent_handback upfront; send_message held back; Claude Code's names for hooks; the caps in the descriptions", () => {
  const names = A.CODER_TOOLS.map((t) => t.function.name);
  for (const n of ["agent", "subagent_handback", "list_agents", "send_message", "workflow"]) assert.ok(names.includes(n), n);
  assert.ok(TS.DEFERRED_TOOLS.includes("send_message"));
  for (const n of ["agent", "subagent_handback", "list_agents", "workflow"]) assert.ok(!TS.DEFERRED_TOOLS.includes(n), n + " is upfront");
  assert.deepEqual(["agent", "subagent_handback", "list_agents", "send_message", "workflow"].map((n) => H.ccTool(n)), ["Agent", "SubagentHandback", "ListAgents", "SendMessage", "Workflow"]);
  for (const t of [G.AGENT_TOOL, G.WORKFLOW_TOOL, G.SEND_MESSAGE_TOOL]) assert.match(t.function.description, /at most 3 subagents run at the same time and at most 10 in all/);
  assert.deepEqual(G.AGENT_TOOL.function.parameters.required, ["description", "prompt"]);
  assert.ok(A.NOT_FROM_GITHUB.includes("agent") && A.NOT_FROM_GITHUB.includes("workflow"), "not from GitHub");
  assert.match(readFileSync(new URL("../container/Dockerfile", import.meta.url), "utf8"), / coder-agents\.mjs /);
  assert.equal(typeof T.TOOLS.workflow_step, "function");
});

test("the caps: 3 at once and 10 in all by default; CODER_MAX_SUBAGENTS_AT_ONCE and CODER_MAX_SUBAGENTS_TOTAL change them, within bounds", async () => {
  assert.deepEqual(G.subagentCaps({}), { atOnce: 3, total: 10 });
  assert.deepEqual(G.subagentCaps({ CODER_MAX_SUBAGENTS_AT_ONCE: "2", CODER_MAX_SUBAGENTS_TOTAL: "4" }), { atOnce: 2, total: 4 });
  assert.deepEqual(G.subagentCaps({ CODER_MAX_SUBAGENTS_AT_ONCE: "99", CODER_MAX_SUBAGENTS_TOTAL: "x" }), { atOnce: 10, total: 10 });
  const b = G.subagentBudget({ atOnce: 3, total: 10 });
  let running = 0, peak = 0;
  await Promise.all(Array.from({ length: 8 }, () => b.run(async () => { running++; peak = Math.max(peak, running); await new Promise((r) => setTimeout(r, 5)); running--; })));
  assert.equal(peak, 3, "never more than 3 at once");
  const c = G.subagentBudget({ atOnce: 1, total: 2 });
  assert.deepEqual([c.take(), c.take(), c.take()], [true, true, false]);
});

test("agent runs a subagent on Coder's loop with the chat's model and effort and its own tools; its subagent_handback is the call's answer; send_message resumes it with its history; list_agents lists it", async () => {
  const seen = [];
  let subTurn = 0;
  const main = [
    say("", [call("agent", { run_in_background: false, description: "Find the config", prompt: "Where is the config loaded?", subagent_type: "Explore", name: "finder" }, "a1")]),
    say("", [call("list_agents", {}, "l1")]),
    say("", [call("send_message", { to: "finder", message: "And where is it saved?" }, "s1")]),
    say("Done."),
  ];
  let mi = 0;
  const send = async (req) => {
    seen.push({ sub: isSub(req), model: req.model, effort: req.effort, tools: (req.tools || []).map((t) => t.function.name), text: userText(req), n: (req.messages || []).length });
    if (isSub(req)) { subTurn++; return subTurn === 1 ? say("", [call("subagent_handback", { message: "It is loaded in src/config.js." }, "h1")]) : say("", [call("subagent_handback", { message: "It is saved in src/save.js." }, "h2")]); }
    return main[Math.min(mi++, main.length - 1)];
  };
  const r = await A.runCoder(base(send), { ...opts("find the config"), model: "grok-x", effort: "low" });
  assert.match(toolAnswer(r, "a1"), /^It is loaded in src\/config\.js\.\n\nagentId: agent-1 \(name: finder\) · completed/);
  assert.match(toolAnswer(r, "l1"), /- agent-1 \(finder\) · Explore · completed · Find the config/);
  assert.match(toolAnswer(r, "l1"), /Subagents left in this job: 9 of 10/);
  assert.match(toolAnswer(r, "s1"), /^It is saved in src\/save\.js\./);
  const subs = seen.filter((s) => s.sub);
  assert.equal(subs.length, 2);
  for (const s of subs) { assert.equal(s.model, "grok-x"); assert.equal(s.effort, "low"); }
  assert.ok(subs[0].tools.includes("subagent_handback") && subs[0].tools.includes("read"));
  for (const n of ["agent", "workflow", "edit", "write", "send_message"]) assert.ok(!subs[0].tools.includes(n), "an Explore agent has no " + n);
  assert.match(subs[1].text, /Where is the config loaded\?[\s\S]*And where is it saved\?/, "resumed with its history");
  assert.ok(subs[1].n > subs[0].n);
});

test("the cap: past CODER_MAX_SUBAGENTS_TOTAL an agent call is refused and the model is told to do the rest itself; subagent_handback in the main chat is refused", async () => {
  const main = [
    say("", [call("agent", { run_in_background: false, description: "one", prompt: "do one" }, "a1"), call("agent", { run_in_background: false, description: "two", prompt: "do two" }, "a2"), call("subagent_handback", { message: "x" }, "h0")]),
    say("ok"),
  ];
  let mi = 0, subs = 0;
  const send = async (req) => { if (isSub(req)) { subs++; return say("finished"); } return main[Math.min(mi++, main.length - 1)]; };
  const r = await A.runCoder(base(send, { subagentEnv: { CODER_MAX_SUBAGENTS_TOTAL: "1" } }), opts("go"));
  // (2: it answered in words, was told once to hand back (HANDBACK_NUDGE, 2026-11-23), and answered in words again.)
  assert.equal(subs, 2);
  assert.match(toolAnswer(r, "a1"), /^finished\n\nagentId: agent-1/, "with no handback even after the reminder, its last words are its report");
  assert.match(toolAnswer(r, "a2"), /cap of subagents is reached \(1 in all; CODER_MAX_SUBAGENTS_TOTAL/);
  assert.match(toolAnswer(r, "h0"), /only a subagent hands back/);
});

test("workflow: the script's passes run in the sandbox (stubbed in-process here); agent() calls run as subagents, parallel() side by side within the cap, schema answers parsed; resumeFromRunId reuses done calls", async () => {
  const script = `export const meta = { name: 'review', description: 'review files' }
phase('Review')
const found = await parallel(args.files.map((f) => () => agent('review ' + f, { label: f, schema: { type: 'object', required: ['ok'] } })))
log('reviewed ' + found.length)
return { found }`;
  const prompts = [];
  let mi = 0;
  // (A workflow runs in the background, as Claude Code's: the call answers at once, and its result is a task notification.)
  const main = [say("", [call("workflow", { script, args: { files: ["a.js", "b.js", "c.js", "d.js"] } }, "w1")]), say("Launched."), say("", [call("workflow", { resumeFromRunId: "wf-1" }, "w2")]), say("Launched again."), say("ok")];
  let live = 0, peak = 0;
  const send = async (req) => {
    if (isSub(req)) {
      live++; peak = Math.max(peak, live); await new Promise((r) => setTimeout(r, 5)); live--;
      const t = userText(req); prompts.push(t);
      return say("", [call("subagent_handback", { message: "```json\n" + JSON.stringify({ ok: !/b\.js/.test(t) }) + "\n```" }, "h")]);
    }
    return main[Math.min(mi++, main.length - 1)];
  };
  const r = await A.runCoder(base(send, { workflowStep: G.workflowStep }), opts("review"));
  assert.match(toolAnswer(r, "w1"), /^Workflow launched in the background\.\ntaskId: wf-1 · taskType: local_workflow · runId: wf-1\nworkflowName: review\nsummary: review files/);
  const w1 = wfResult(r, "wf-1");
  assert.match(w1, /^workflow “review” · runId wf-1 · 4 agents run/);
  assert.match(w1, /## Review\nreviewed 4/);
  assert.deepEqual(JSON.parse(w1.split("result:\n")[1]), { found: [{ ok: true }, { ok: false }, { ok: true }, { ok: true }] });
  assert.ok(peak <= 3, "at most 3 at once, was " + peak);
  assert.equal(prompts.length, 4, "the resumed run reused all four");
  assert.match(wfResult(r, "wf-2"), /runId wf-2 · 0 agents run/);
  assert.match(prompts[0], /JSON Schema/);
});

test("workflow scripts: meta is required; Date.now and Math.random throw; a failing script's error comes back", async () => {
  assert.match((await G.workflowStep({ script: "return 1" })).error, /must begin with export const meta/);
  const m = "export const meta = { name: 'x', description: 'y' }\n";
  assert.deepEqual((await G.workflowStep({ script: m + "return args.n + 1", args: { n: 1 } })).result, 2);
  assert.match((await G.workflowStep({ script: m + "return Date.now()" })).error, /Date\.now\(\) is not available/);
  assert.match((await G.workflowStep({ script: m + "return Math.random()" })).error, /Math\.random\(\) is not available/);
  const p = await G.workflowStep({ script: m + "const a = await agent('x'); return a" });
  assert.equal(p.status, "pending");
  assert.equal(p.pending.length, 1);
  assert.equal((await G.workflowStep({ script: m + "const a = await agent('x'); return a", done: [[p.pending[0].key, { ok: "hi" }]] })).result, "hi");
  assert.match(String(G.splitScript("export const meta = { name: foo(), description: 'y' }").error), /literal/);
});
