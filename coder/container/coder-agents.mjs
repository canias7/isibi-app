// CLAUDE CODE'S AGENT, SUBAGENTHANDBACK, LISTAGENTS, SENDMESSAGE AND WORKFLOW TOOLS FOR CODER (2026-11-23).
//
// Claude Code's tools reference: Agent "Spawns a subagent with its own context window to handle a task"; SubagentHandback
// "Delivers a subagent's final report to whichever conversation receives that subagent's result"; ListAgents "Lists the
// agents Claude can message with SendMessage"; SendMessage "Sends a message to another agent: ... a subagent it resumes by
// agent ID or name"; Workflow "Runs a dynamic workflow: a script that orchestrates many subagents ... and returns one
// consolidated result". In Coder their names are agent, subagent_handback, list_agents, send_message and workflow
// (coder-hooks.mjs CC_TOOL gives hooks Claude Code's names). A subagent runs on Coder's own loop (runCoder) the way
// Gloopy's helpers do, with the chat's model and effort (Low when the chat has none) unless the call names others.
//
// SECOND PASS (2026-11-23, Claude Code's way): its full descriptions and every input; run_in_background (a task notification
// later); a message's agent calls side by side; model (Coder's models only) and effort; isolation "worktree"; custom agents
// from .claude/agents/*.md; the old name Task; AgentOutput's fields; SubagentStart and SubagentStop hooks; agent()'s model,
// effort and phase in workflows; send_message's summary. What can't exist in Coder (agent teams, remote agents, other
// sessions) is said in the descriptions and refused.
//
// COST CAPS (the owner: Grok spend): a job runs at most CODER_MAX_SUBAGENTS_AT_ONCE (3) subagents at the same time and
// CODER_MAX_SUBAGENTS_TOTAL (10) runs in all, a workflow's agents and resumed agents included.
//
// A WORKFLOW'S SCRIPT never runs in Coder's service: it runs as `dev` in the chat's sandbox (coder-tools.mjs workflow_step),
// over and over, as Claude Code relaunches a run: each pass gets the results of the agent() calls done so far and stops at
// the calls still to do; the service runs those as subagents and passes again. Date.now(), Math.random() and new Date() with
// no argument throw, as in Claude Code, so every pass makes the same calls.
import vm from "node:vm";
import { CODER_MODELS } from "./coder-model.mjs";
import { enterNewScript, shq, MARK } from "./coder-worktree.mjs";

/** The caps' defaults, and the environment variables that change them. */
export const SUBAGENTS_AT_ONCE = 3, SUBAGENTS_TOTAL = 10;
export const AT_ONCE_VAR = "CODER_MAX_SUBAGENTS_AT_ONCE", TOTAL_VAR = "CODER_MAX_SUBAGENTS_TOTAL";
/** A subagent's step limit and time limit; its report's length in the parent's answer. */
export const SUBAGENT_ROUNDS = 40, SUBAGENT_MS = 10 * 60 * 1000, SUBAGENT_REPORT_MAX = 20_000;
/** A workflow: its passes at most, one pass's time, and its result's length. */
export const WORKFLOW_PASSES = 40, WORKFLOW_PASS_S = 30, WORKFLOW_RESULT_MAX = 30_000;

const capOf = (v, dflt, lo, hi) => { const n = Number.parseInt(String(v ?? ""), 10); return Number.isFinite(n) && String(v).trim() !== "" ? Math.min(hi, Math.max(lo, n)) : dflt; };
/** The caps from the machine's environment: at once 1 to 10, in all 0 (none) to 50. */
export function subagentCaps(env = {}) {
  return { atOnce: capOf(env && env[AT_ONCE_VAR], SUBAGENTS_AT_ONCE, 1, 10), total: capOf(env && env[TOTAL_VAR], SUBAGENTS_TOTAL, 0, 50) };
}

/** A job's budget of subagents: `take()` counts one run against the total (false past it); `run(fn)` waits for a free slot. */
export function subagentBudget(caps) {
  let used = 0, running = 0, peak = 0;
  const waiting = [];
  const next = () => { if (running < caps.atOnce && waiting.length) { running++; peak = Math.max(peak, running); waiting.shift()(); } };
  return {
    caps,
    get used() { return used; },
    get peak() { return peak; },
    left: () => Math.max(0, caps.total - used),
    take: () => (used < caps.total ? (used++, true) : false),
    run: async (fn) => {
      await new Promise((ok) => { waiting.push(ok); next(); });
      try { return await fn(); } finally { running--; next(); }
    },
  };
}

/** The kinds of subagent (Claude Code's built-in general-purpose, Explore and Plan), and the tools each gets. */
export const AGENT_TYPES = Object.freeze({
  "general-purpose": { tools: ["bash", "read", "edit", "write", "notebook_edit", "grep", "glob", "web_fetch", "web_search"], note: "", description: "General-purpose agent for researching complex questions, searching for code, and executing multi-step tasks. When you are searching for a keyword or file and are not confident that you will find the right match in the first few tries use this agent to perform the search for you." },
  Explore: { tools: ["bash", "read", "grep", "glob", "web_fetch", "web_search"], note: "You are an Explore agent: search and read only. Never change a file: no edits, no writes, no commands that change anything (no installs, no git commit, no rm, no redirects into files).", description: "Fast agent specialized for exploring codebases. Use this when you need to quickly find files by patterns, search code for keywords, or answer questions about the codebase (read-only)." },
  Plan: { tools: ["bash", "read", "grep", "glob", "web_fetch", "web_search"], note: "You are a Plan agent: research the code and design an implementation plan (the steps, the files, the risks). Never change a file: no edits, no writes, no commands that change anything.", description: "Software architect agent for designing implementation plans. Use this when you need to plan the implementation strategy for a task: it returns step-by-step plans, identifies critical files, and considers architectural trade-offs (read-only)." },
  // CLAUDE CODE'S web-fetch (2026-11-23; its tools reference: "the subagent built into Claude Code that reads web pages for
  // Claude … The subagent calls WebFetch, reads the page, and sends Claude the answer"; "reads pages of up to about 48,000
  // characters in full"): its web_fetch gives the page's own text, up to 48,000 characters a call (coder-agent.mjs). The
  // chat's web_fetch rules and hooks apply to its fetches; Agent(web-fetch) in deny turns it off.
  "web-fetch": { tools: ["web_fetch"], note: "You are the web-fetch agent: fetch the URL you were given with web_fetch (its result is the page's own text, up to about 48,000 characters a call; fetch on with offset when the page goes on and the question needs more), read it, and answer the question about it in your report. Fetch nothing else.", description: "Reads a web page for Coder: give it the URL and a question about the page; it fetches the page, reads up to about 48,000 characters of it in full, and answers the question." },
});
/** The tools a subagent can ever have (Claude Code's "tools available to subagents", in Coder's names). */
export const SUBAGENT_AVAILABLE = Object.freeze(["bash", "read", "edit", "write", "notebook_edit", "grep", "glob", "lsp", "web_fetch", "web_search"]);
/** The models an agent can run on: Coder's own (coder-model.mjs), and the effort levels Claude Code's input takes. */
export const AGENT_MODELS = Object.freeze(CODER_MODELS.map((m) => m.id));
export const AGENT_EFFORTS = Object.freeze(["low", "medium", "high", "xhigh", "max"]);
/** A custom agent's folder in the repository (Claude Code's project subagents). */
export const AGENTS_DIR = ".claude/agents";

const capsWords = "at most 3 subagents run at the same time and at most 10 in all for one job (the machine's CODER_MAX_SUBAGENTS_AT_ONCE and CODER_MAX_SUBAGENTS_TOTAL can change these); a workflow's agents and a resumed agent count too, and a call past the cap is refused";

/** Claude Code's Agent tool, its inputs (AgentInput) and its description, in Coder's words. */
export const AGENT_TOOL = Object.freeze({ type: "function", function: {
  name: "agent",
  description: "Launch a new agent to handle complex, multi-step tasks autonomously.\n\nThe agent tool launches specialized agents (subprocesses) that autonomously handle complex tasks. Each agent type has specific capabilities and tools available to it.\n\nAvailable agent types and the tools they have access to:\n- general-purpose: " + AGENT_TYPES["general-purpose"].description + " (Tools: bash, read, edit, write, notebook_edit, grep, glob, web_fetch, web_search)\n- Explore: " + AGENT_TYPES.Explore.description + " (Tools: bash, read, grep, glob, web_fetch, web_search)\n- Plan: " + AGENT_TYPES.Plan.description + " (Tools: bash, read, grep, glob, web_fetch, web_search)\n- web-fetch: " + AGENT_TYPES["web-fetch"].description + " (Tools: web_fetch)\n- the repository's custom agents: each file in " + AGENTS_DIR + "/*.md with a name and a description in its frontmatter (and optionally tools, disallowedTools, model, effort, maxTurns, isolation and background; the file's body is its instructions). list_agents lists them.\n\nWhen using the agent tool, specify a subagent_type parameter to select which agent type to use. If omitted, the general-purpose agent is used. The old name of this tool, Task, still works.\n\nWhen NOT to use the agent tool:\n- If you want to read a specific file path, use read or glob instead, to find the match more quickly\n- If you are searching for a specific class definition like \"class Foo\", use glob instead\n- If you are searching for code within a specific file or set of 2-3 files, use read instead\n- Other tasks that are not related to the agent descriptions above\n\nUsage notes:\n- Always include a short description (3-5 words) summarizing what the agent will do\n- Launch multiple agents concurrently whenever possible, to maximize performance; to do that, use a single message with multiple agent calls (they run side by side; " + capsWords + ")\n- When the agent is done, it will return a single message back to you. The result returned by the agent is not visible to the owner. To show the owner the result, you should send a text message back to the owner with a concise summary of the result.\n- You can optionally run agents in the background using the run_in_background parameter. When an agent runs in the background, you will be automatically notified when it completes; do not sleep, poll, or proactively check on its progress. Continue with other work or respond to the owner instead.\n- To continue a previously spawned agent, use send_message with the agent's ID or name as the `to` field. The agent resumes with its full context preserved. Each fresh agent invocation with a prompt starts without context, so provide a complete task description.\n- The agent's outputs should generally be trusted\n- Clearly tell the agent whether you expect it to write code or just to do research (search, file reads, web fetches, etc.), since it is not aware of the owner's intent\n- If the agent description mentions that it should be used proactively, then you should try your best to use it without the owner having to ask for it first. Use your judgement.\n- You can optionally set isolation: \"worktree\" to run the agent in a temporary git worktree, giving it an isolated copy of the repository. The worktree is automatically cleaned up if the agent makes no changes; if changes are made, the worktree path and branch are returned in the result.\n- model and effort run the agent on another of Coder's models (" + AGENT_MODELS.join(", ") + ") or effort level; the chat's are used when left out. An effort the model doesn't take runs at the nearest level it does.\n- Launching an agent never asks the owner; the agent's own steps are checked against the chat's rules as it runs, and a step that would need the owner's OK is refused (the agent says so in its report). A subagent can't start agents of its own.\n- Coder has no agent teams and no remote agents: team_name and mode are accepted for Claude Code's input and ignored, and isolation \"remote\" is refused.",
  parameters: { type: "object", properties: {
    description: { type: "string", description: "A short (3-5 word) description of the task" },
    prompt: { type: "string", description: "The task for the agent to perform" },
    subagent_type: { type: "string", description: "The type of specialized agent to use for this task: general-purpose (the default), Explore, Plan, or the name of a custom agent in " + AGENTS_DIR + "/" },
    model: { type: "string", enum: [...AGENT_MODELS], description: "Optional model to use for this agent. If not specified, inherits from the chat" },
    effort: { type: "string", enum: [...AGENT_EFFORTS], description: "Optional effort level for this agent. If not specified, inherits from the chat (or the custom agent's effort)" },
    run_in_background: { type: "boolean", description: "Set to true to run this agent in the background. You will be notified when it completes." },
    name: { type: "string", description: "Name for the spawned agent. Makes it addressable via send_message({to: name}) while it runs and after it finishes." },
    team_name: { type: "string", description: "Deprecated; ignored (Coder has no agent teams)" },
    mode: { type: "string", enum: ["acceptEdits", "auto", "bypassPermissions", "default", "dontAsk", "plan"], description: "Deprecated; ignored. A subagent runs in the chat's permission mode, refusing what would need the owner's OK" },
    isolation: { type: "string", enum: ["worktree", "remote"], description: "Isolation mode. \"worktree\" creates a temporary git worktree so the agent works on an isolated copy of the repo. \"remote\" is Claude Code's cloud agent and is refused in Coder" },
  }, required: ["description", "prompt"] },
} });

/** Claude Code's SubagentHandback: a subagent's report, delivered once, which ends its run. Only a subagent has it. */
export const SUBAGENT_HANDBACK_TOOL = Object.freeze({ type: "function", function: {
  name: "subagent_handback",
  description: "Deliver your final report to the agent that spawned you (your caller). Use it once, for that hand-off only: when your work is complete, call subagent_handback({message: <your full report>}). The call ends your run, so do everything else first and put everything your caller needs in that one report. It is not a messaging channel: do not use it for progress updates or questions.\n\nOnly a report delivered through subagent_handback reaches your caller; if you finish without it, your last words are taken as your report. There is no recipient parameter: the report can only go to your caller.",
  parameters: { type: "object", properties: { message: { type: "string", description: "Your full report for your caller" } }, required: ["message"] },
} });

/** Claude Code's ListAgents: the agents send_message can reach in this job. */
export const LIST_AGENTS_TOOL = Object.freeze({ type: "function", function: {
  name: "list_agents",
  description: "Lists the agents you can message with send_message: the subagents this job started (their id, name, type, status and task), and the agent types you can start with the agent tool (the built-in ones and the repository's custom agents in " + AGENTS_DIR + "/). The first line is this chat itself (main). Coder has no agent teams, and no other sessions or machines to message.",
  parameters: { type: "object", properties: {}, required: [] },
} });

/** Claude Code's SendMessage, to a subagent (resumed with its whole history). Held back until tool_search loads it. */
export const SEND_MESSAGE_TOOL = Object.freeze({ type: "function", function: {
  name: "send_message",
  description: "Sends a message to another agent: a subagent this job started, which it resumes by agent ID or name (as list_agents shows them). A finished agent resumes with its full conversation history (every earlier tool call, result and reasoning), works on the message, and its new report is this call's answer; a message to an agent still running in the background waits until it finishes, then resumes it. Use it to continue an agent's work instead of starting over. Include an optional summary, typically 5-10 words, that the owner sees as a one-line preview; when you leave it out, the first line of the message is used, and a summary longer than 200 characters is cut with an ellipsis. A resumed run counts against the job's cap of subagents (" + capsWords + "). Coder has no agent teams and no other sessions to message: \"main\" (you) and anything else are refused.",
  parameters: { type: "object", properties: {
    to: { type: "string", description: "The agent's id or name" },
    message: { type: "string", description: "The message" },
    summary: { type: "string", description: "A 5-10 word preview of the message" },
  }, required: ["to", "message"] },
} });

/** Claude Code's Workflow tool, its inputs (WorkflowInput) and its description, in Coder's words. */
export const WORKFLOW_TOOL = Object.freeze({ type: "function", function: {
  name: "workflow",
  description: "Runs a dynamic workflow: a script that orchestrates many subagents and returns one consolidated result. Use it only when the owner asks for a workflow or a task needs the same step over many items (an audit of many files, a migration, cross-checked research). At least one of script, name or scriptPath is required.\n\nThe script must begin with `export const meta = { name: '...', description: '...' }` as a literal (an optional `phases` array names its stages), then plain JavaScript with top-level await:\n- `await agent(prompt, { label, schema, subagent_type, model, effort, phase })` runs one subagent and gives its report; with `schema` (a JSON Schema) the parsed JSON it returns. It gives null when the agent failed, its answer didn't match the schema, or the cap was reached.\n- `parallel([() => agent(...), ...])` runs several at once and waits for all; `pipeline(items, (item) => agent(...))` runs one per item.\n- `phase(title)` starts a stage (agents after it are grouped under it) and `log(message)` shows progress.\n- `args` is the input; `return` the result.\nDate.now(), Math.random() and new Date() with no argument throw (pass a time in args). The script runs in the chat's sandbox, not with your tools. In Coder the run finishes before this call answers. The answer gives the workflow's name, summary, runId, the agents run per phase, the log and the result: resumeFromRunId with the runId reruns a script and reuses the agent() calls already done with unchanged input (same job only). Limits: " + capsWords + ".",
  parameters: { type: "object", properties: {
    script: { type: "string", description: "Inline workflow script. Must begin with export const meta = { name, description } as a literal, followed by the script body using agent(), parallel(), pipeline(), and phase()" },
    name: { type: "string", description: "Name of a workflow saved in .claude/workflows/<name>.js. Resolved to a script" },
    scriptPath: { type: "string", description: "Path to a workflow script file on disk. Takes precedence over script and name" },
    args: { description: "Input value exposed to the script as the global args. Pass arrays and objects as actual JSON values, not as a JSON-encoded string" },
    resumeFromRunId: { type: "string", description: "Run ID of a prior workflow invocation to resume. Completed agent() calls with unchanged inputs return cached results; the rest run live. Same job only" },
    title: { type: "string", description: "Ignored; the script's meta block sets the title" },
    description: { type: "string", description: "Ignored; the script's meta block sets the description" },
  }, required: [] },
} });

/** Claude Code's tool names, in Coder's (for a custom agent's tools and disallowedTools lists). */
const CC_TO_CODER = { Bash: "bash", Read: "read", Edit: "edit", Write: "write", NotebookEdit: "notebook_edit", Grep: "grep", Glob: "glob", LSP: "lsp", WebFetch: "web_fetch", WebSearch: "web_search", MultiEdit: "edit" };
const toolEntry = (t) => { const n = String(t).trim().replace(/\(.*\)$/, "").trim(); return CC_TO_CODER[n] || n.toLowerCase(); };
const listField = (v) => (Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : []).map((x) => String(x).trim()).filter(Boolean);
const unq = (v) => { const t = String(v).trim(); return /^(["']).*\1$/.test(t) ? t.slice(1, -1) : t; };

/** A custom agent's file (.claude/agents/<file>.md): { def } | { skip: why } (Claude Code's "Subagent files Claude Code skips"). */
export function parseAgentFile(text, file = "") {
  const src = String(text || "").replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  if (!src.startsWith("---\n")) return { skip: "no frontmatter" };
  const end = src.indexOf("\n---", 3);
  if (end < 0) return { skip: "the frontmatter doesn't close" };
  const fm = {};
  let key = "";
  for (const raw of src.slice(4, end).split("\n")) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const item = /^\s+-\s*(.*)$/.exec(raw);
    if (item && key) { if (!Array.isArray(fm[key])) fm[key] = []; fm[key].push(unq(item[1])); continue; }
    const m = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(raw);
    if (!m) { if (/^\s/.test(raw)) continue; return { skip: "its YAML doesn't parse" }; }
    key = m[1];
    const v = m[2].trim();
    fm[key] = v === "" ? "" : /^\[.*\]$/.test(v) ? v.slice(1, -1).split(",").map(unq).filter(Boolean) : unq(v);
  }
  const name = typeof fm.name === "string" ? fm.name.trim() : "";
  if (!name) return { skip: "no name" };
  if (name.startsWith("-") || name.includes(":") || name.length > 256) return { skip: "the name starts with -, holds : or is over 256 characters" };
  if (typeof fm.description !== "string" || !fm.description.trim()) return { skip: "a name but no description" };
  const turns = Number.parseInt(String(fm.maxTurns ?? ""), 10);
  return { def: {
    name, description: fm.description.trim().slice(0, 1000), file,
    tools: fm.tools === undefined || fm.tools === "" ? null : listField(fm.tools),
    disallowedTools: listField(fm.disallowedTools),
    model: typeof fm.model === "string" ? fm.model.trim() : "",
    effort: AGENT_EFFORTS.includes(String(fm.effort || "").trim()) ? String(fm.effort).trim() : "",
    maxTurns: Number.isFinite(turns) && turns > 0 ? Math.min(turns, SUBAGENT_ROUNDS) : 0,
    isolation: fm.isolation === "worktree" ? "worktree" : "",
    background: fm.background === "true",
    prompt: src.slice(end + 4).replace(/^[^\n]*\n?/, "").trim().slice(0, 20_000),
  } };
}

/**
 * THE TOOLS A SUBAGENT GETS (Claude Code's rules): neither field: every tool of its type; `tools` only: those listed (that a
 * subagent can have); `disallowedTools`: removed (it wins over tools). → { names } | { error } (zero tools: Claude Code's
 * "Agent would be spawned with zero tools", naming the entries).
 */
export function resolveAgentTools(type, def = null) {
  let names = def ? [...SUBAGENT_AVAILABLE] : [...(AGENT_TYPES[type] || AGENT_TYPES["general-purpose"]).tools];
  if (def && Array.isArray(def.tools) && def.tools.length) {
    const want = def.tools.map(toolEntry);
    names = SUBAGENT_AVAILABLE.filter((n) => want.includes(n));
    if (!names.length) return { error: "Agent '" + def.name + "' would be spawned with zero tools: no entry of its tools list (" + def.tools.join(", ") + ") is a tool a subagent can use in Coder (" + SUBAGENT_AVAILABLE.join(", ") + "; Claude Code's names such as Read, Grep and Bash work too)." };
  }
  if (def && def.disallowedTools.length) { const no = def.disallowedTools.map(toolEntry); names = names.filter((n) => !no.includes(n)); }
  return { names };
}

/** The model and effort an agent runs on: the call's, else its definition's, else the chat's; only Coder's models. */
export function resolveAgentModel({ model = "", effort = "" } = {}, def = null, chat = {}) {
  let m = model ? String(model) : "";
  if (m && !AGENT_MODELS.includes(m)) return { error: "model is one of " + AGENT_MODELS.join(", ") + " (Coder's models); leave it out to use the chat's" };
  if (effort && !AGENT_EFFORTS.includes(String(effort))) return { error: "effort is one of " + AGENT_EFFORTS.join(", ") };
  if (!m && def && def.model && AGENT_MODELS.includes(def.model)) m = def.model;
  if (!m) m = chat.model || CODER_MODELS[0].id;
  const spec = CODER_MODELS.find((x) => x.id === m);
  let e = String(effort || (def && def.effort) || chat.effort || (spec ? spec.effort : ""));
  if (spec && !spec.efforts.includes(e)) { const want = Math.max(0, AGENT_EFFORTS.indexOf(e)); e = [...spec.efforts].sort((a, b) => Math.abs(AGENT_EFFORTS.indexOf(a) - want) - Math.abs(AGENT_EFFORTS.indexOf(b) - want))[0]; }
  return { model: m, effort: e };
}

/** Claude Code's toolStats for a subagent's run: counted from its conversation's tool calls. */
export function toolStatsOf(messages) {
  const st = { readCount: 0, searchCount: 0, bashCount: 0, editFileCount: 0, linesAdded: 0, linesRemoved: 0, otherToolCount: 0 };
  const lines = (t) => (typeof t === "string" && t ? t.split("\n").length : 0);
  for (const m of Array.isArray(messages) ? messages : []) {
    if (!m || m.role !== "assistant" || !Array.isArray(m.tool_calls)) continue;
    for (const c of m.tool_calls) {
      const n = c && c.function ? String(c.function.name || "") : "";
      if (!n || n === "subagent_handback") continue;
      let a = {}; try { a = JSON.parse((c.function && c.function.arguments) || "{}") || {}; } catch { a = {}; }
      if (n === "read") st.readCount++;
      else if (n === "grep" || n === "glob" || n === "web_search" || n === "web_fetch") st.searchCount++;
      else if (n === "bash" || n === "powershell") st.bashCount++;
      else if (n === "edit" || n === "write" || n === "notebook_edit") {
        st.editFileCount++;
        if (n === "write") st.linesAdded += lines(a.content);
        else if (n === "edit") { st.linesAdded += lines(a.new_string); st.linesRemoved += lines(a.old_string); }
      } else st.otherToolCount++;
    }
  }
  return st;
}
/** Claude Code's usage on an agent's result: its last request's, and its whole run's tokens. */
export function usageOf(list) {
  const u = Array.isArray(list) ? list.filter((x) => x && typeof x === "object") : [];
  const last = u.at(-1) || {};
  const total = u.reduce((n, x) => n + (Number(x.in) || 0) + (Number(x.out) || 0), 0);
  return { usage: { input_tokens: Number(last.in) || 0, output_tokens: Number(last.out) || 0, cache_creation_input_tokens: null, cache_read_input_tokens: Number(last.cached) || null, server_tool_use: null, service_tier: null, cache_creation: null }, totalTokens: total };
}
/** A summary for send_message (Claude Code: the first line when none is given; over 200 characters cut with an ellipsis). */
export function summaryOf(summary, message) {
  const s = String(summary ?? "").trim() || String(message ?? "").split("\n").map((l) => l.trim()).find(Boolean) || "";
  return s.length > 200 ? s.slice(0, 199) + "…" : s;
}
/** A subagent's instructions: a custom agent's own (its file's body), else Coder's, with its type's note. */
export function systemFor(type, def = null) {
  if (def) return (def.prompt || "You are the custom agent " + def.name + ": " + def.description) + "\n\n" + SUBAGENT_TAIL;
  return SUBAGENT_SYSTEM + (AGENT_TYPES[type] && AGENT_TYPES[type].note ? "\n\n" + AGENT_TYPES[type].note : "");
}

/** A subagent's instructions (Claude Code's general-purpose agent's, in Coder's words). */
export const SUBAGENT_SYSTEM = `You are an agent for Coder, the owner's AI coding assistant on gofarther.dev. Coder gave you one task: use the tools available to complete it. Complete the task fully: don't gold-plate, but don't leave it half-done.

- Your strengths: searching for code, configurations and patterns across large codebases; analyzing several files to understand a system; investigating questions that need many files; multi-step research and changes.
- Search broadly when you don't know where something lives; read when you know the path. Prefer editing an existing file to creating one. Never write report files: your report is your answer.
- Never ask the owner anything: you can't reach them. A step that needs their OK is refused; say so in your report.
- When you are done, call subagent_handback with your full report for Coder (what you did, what you found, the relevant file paths). It ends your run. Coder relays what matters to the owner, so give the essentials, with no emojis.`;

/** What every custom agent is told after its own instructions. */
export const SUBAGENT_TAIL = "You run as a subagent of Coder, the owner's AI coding assistant on gofarther.dev, with one task from Coder. Never ask the owner anything: you can't reach them; a step that needs their OK is refused (say so in your report). When you are done, call subagent_handback with your full report (it ends your run), with no emojis.";

/** The tools a subagent of `type` gets from `coderTools` (Coder's own definitions), and subagent_handback (`names`: a custom agent's). */
export function subagentTools(coderTools, type, names = null) {
  const want = Array.isArray(names) ? names.filter((n) => SUBAGENT_AVAILABLE.includes(n)) : (AGENT_TYPES[type] || AGENT_TYPES["general-purpose"]).tools;
  const list = Array.isArray(coderTools) ? coderTools : [...(coderTools || [])];
  return [...want.map((n) => list.find((t) => t && t.function && t.function.name === n)).filter(Boolean), SUBAGENT_HANDBACK_TOOL];
}

// PLUGIN AGENTS AS CUSTOM SUBAGENTS (2026-11-23; Claude Code's plugins reference: a plugin's agents/<name>.md, frontmatter
// then the system prompt, named plugin:agent). Read with the same parser as the repository's .claude/agents/*.md files
// (parseAgentFile, above), so the same fields work (tools, disallowedTools, model, effort, maxTurns, isolation, background).
// Ignored for plugin agents, as Claude Code ignores them: hooks, mcpServers, permissionMode. Never given to a subagent
// whatever `tools` says (Claude Code's always-removed list): only SUBAGENT_AVAILABLE's tools reach one.
/** The Worker's pluginAgents ([{ plugin, file, text }]) → custom agent definitions named "plugin:agent". A bad file is skipped. */
export function pluginAgentsFrom(list) {
  const out = [];
  for (const a of Array.isArray(list) ? list.slice(0, 30) : []) {
    if (!a || typeof a.plugin !== "string" || !/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(a.plugin)) continue;
    const file = String(a.file || "");
    let p = parseAgentFile(a.text, file);
    // (A plugin agent's file may leave out name: its file's name is used.)
    if (p.skip === "no name") p = parseAgentFile(String(a.text || "").replace(/^\uFEFF?---\r?\n/, "---\nname: " + file.replace(/^.*\//, "").replace(/\.md$/, "") + "\n"), file);
    if (!p.def) continue;
    // (The prefix isn't doubled: a plugin "x" with agent "x-y" is x:x-y, as Claude Code names it.)
    const name = a.plugin + ":" + p.def.name;
    if (out.some((d) => d.name === name)) continue;
    out.push({ ...p.def, name, plugin: a.plugin, file: "plugin " + a.plugin + (file ? " · " + file : "") });
  }
  return out;
}
/** The agent tool, its description naming the plugin agents too (`defs`: pluginAgentsFrom's). */
export function agentToolFor(defs) {
  const list = Array.isArray(defs) ? defs : [];
  if (!list.length) return AGENT_TOOL;
  const f = AGENT_TOOL.function;
  return { type: "function", function: { ...f, description: f.description + "\n\nPlugin agents (subagent_type is the name): " + list.map((d) => d.name + " (" + oneLine(d.description, 200) + ")").join("; ") + "." } };
}

/** A finished subagent's report: what it handed back, else its last words. */
export function reportOf(r) {
  if (r && typeof r.handback === "string" && r.handback.trim()) return r.handback.trim();
  const last = ((r && r.messages) || []).filter((m) => m && m.role === "assistant" && typeof m.content === "string" && m.content.trim()).at(-1);
  return last ? last.content.trim() : String((r && r.summary) || "").trim();
}
/** A subagent run's end, in words. */
export const statusWords = (s) => ({ done: "completed", rounds: "stopped at its step limit (partial: send_message continues it)", time: "ran out of time (partial: send_message continues it)", stopped: "stopped by the owner", error: "failed" }[s] || String(s || "failed"));

/** A conversation fit to resume: every tool call of an assistant message answered (a handback's round may leave some). */
export function resumable(messages) {
  const out = [];
  const list = Array.isArray(messages) ? messages : [];
  for (let k = 0; k < list.length; k++) {
    const m = list[k];
    out.push(m);
    if (m && m.role === "assistant" && Array.isArray(m.tool_calls)) {
      const answered = new Set();
      for (let j = k + 1; j < list.length && list[j] && list[j].role === "tool"; j++) answered.add(list[j].tool_call_id);
      const missing = m.tool_calls.filter((c) => c && !answered.has(c.id));
      let j = k + 1;
      while (j < list.length && list[j] && list[j].role === "tool") out.push(list[j++]);
      for (const c of missing) out.push({ role: "tool", tool_call_id: c.id, content: "not run: the agent handed back its report first" });
      k = j - 1;
    }
  }
  return out;
}

/** The JSON a schema-bound agent answered: the first JSON value in its report, checked for the schema's top-level shape. */
export function schemaAnswer(text, schema) {
  const s = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  let v;
  try { v = JSON.parse(s); } catch {
    const at = s.search(/[{[]/);
    if (at < 0) return { error: "the agent's answer was not JSON" };
    const close = s[at] === "{" ? "}" : "]";
    try { v = JSON.parse(s.slice(at, s.lastIndexOf(close) + 1)); } catch { return { error: "the agent's answer was not valid JSON" }; }
  }
  if (schema && typeof schema === "object") {
    if (schema.type === "object" && (v === null || typeof v !== "object" || Array.isArray(v))) return { error: "expected an object" };
    if (schema.type === "array" && !Array.isArray(v)) return { error: "expected an array" };
    if (schema.type === "object" && Array.isArray(schema.required)) { const miss = schema.required.filter((k) => !(k in v)); if (miss.length) return { error: "missing required " + miss.join(", ") }; }
  }
  return { value: v };
}

/** A workflow script's meta block (a literal) and its body: { meta, body } or { error }. */
export function splitScript(script) {
  const src = String(script || "").replace(/^﻿/, "");
  const m = /^\s*export\s+const\s+meta\s*=\s*/.exec(src);
  if (!m) return { error: "the script must begin with export const meta = { name, description }" };
  let i = m[0].length;
  if (src[i] !== "{") return { error: "meta must be an object literal" };
  let depth = 0, q = "";
  for (; i < src.length; i++) {
    const ch = src[i];
    if (q) { if (ch === "\\") i++; else if (ch === q) q = ""; continue; }
    if (ch === "'" || ch === "\"" || ch === "`") { q = ch; continue; }
    if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) break;
  }
  if (depth !== 0) return { error: "meta's braces don't close" };
  const lit = src.slice(m[0].length, i + 1);
  if (/[()]|\.\.\.|\$\{/.test(lit.replace(/(["'`])(?:\\.|(?!\1)[^\\])*\1/g, "\"\""))) return { error: "meta must hold literal values only (no calls, variables or spreads)" };
  let meta;
  try { meta = vm.runInNewContext("(" + lit + ")", Object.create(null), { timeout: 200 }); } catch (e) { return { error: "meta is not a literal: " + String((e && e.message) || e).slice(0, 200) }; }
  if (!meta || typeof meta.name !== "string" || !meta.name.trim() || typeof meta.description !== "string") return { error: "meta needs a name and a description (strings)" };
  return { meta: { name: meta.name.trim().slice(0, 80), description: meta.description.slice(0, 300), ...(Array.isArray(meta.phases) ? { phases: meta.phases.map(String).slice(0, 30) } : {}) }, body: src.slice(i + 1).replace(/^\s*;/, "") };
}

/**
 * ONE PASS OF A WORKFLOW'S SCRIPT (in the chat's sandbox, as `dev`: coder-tools.mjs workflow_step). `done` holds the agent()
 * calls finished so far ([key, { ok } | { error }]); a call not among them is listed in `pending` and never settles in this
 * pass. → { status: "done", result, logs } | { status: "pending", pending, logs } | { status: "error", error, logs }.
 */
export async function workflowStep({ script, args, done } = {}) {
  const parts = splitScript(script);
  if (parts.error) return { status: "error", error: parts.error, logs: [] };
  const cache = new Map(Array.isArray(done) ? done.filter((x) => Array.isArray(x) && typeof x[0] === "string") : []);
  const pending = [], logs = [], seen = new Map();
  const keyOf = (prompt, opts) => { const base = JSON.stringify([prompt, opts.schema || null, opts.subagent_type || ""]) + (opts.model || opts.effort ? JSON.stringify([opts.model || "", opts.effort || ""]) : ""); const n = seen.get(base) || 0; seen.set(base, n + 1); return base + "#" + n; };
  let phaseNow = "";
  const ctx = vm.createContext(Object.create(null));
  const clone = vm.runInContext("(s) => (s === undefined ? undefined : JSON.parse(s))", ctx);
  const never = vm.runInContext("() => new Promise(() => {})", ctx);
  const ok = vm.runInContext("(v) => Promise.resolve(v)", ctx);
  const bad = vm.runInContext("(m) => Promise.reject(new Error(m))", ctx);
  const agent = (prompt, opts) => {
    const o = opts && typeof opts === "object" ? opts : {};
    const p = String(prompt ?? "");
    const type = typeof o.subagent_type === "string" ? o.subagent_type : "";
    const schema = o.schema && typeof o.schema === "object" ? JSON.parse(JSON.stringify(o.schema)) : null;
    const model = typeof o.model === "string" ? o.model.slice(0, 60) : "", effort = typeof o.effort === "string" ? o.effort.slice(0, 10) : "";
    const ph = typeof o.phase === "string" && o.phase ? o.phase.slice(0, 120) : phaseNow;
    const key = keyOf(p, { schema, subagent_type: type, model, effort });
    if (cache.has(key)) { const r = cache.get(key) || {}; return r.error ? bad(String(r.error)) : ok(clone(JSON.stringify(r.ok ?? null))); }
    pending.push({ key, prompt: p.slice(0, 20_000), label: typeof o.label === "string" ? o.label.slice(0, 80) : "", ...(schema ? { schema } : {}), ...(type ? { subagent_type: type } : {}), ...(model ? { model } : {}), ...(effort ? { effort } : {}), ...(ph ? { phase: ph } : {}) });
    return never();
  };
  ctx.__agent = agent;
  ctx.__log = (m) => { if (logs.length < 200) logs.push(String(m).slice(0, 500)); };
  ctx.__phase = (t) => { phaseNow = String(t).slice(0, 120); if (logs.length < 200) logs.push("## " + phaseNow); };
  ctx.args = clone(args === undefined ? undefined : JSON.stringify(args));
  const prelude = `"use strict";
const agent = (p, o) => __agent(p, o);
const log = (m) => __log(m);
const phase = (t) => __phase(t);
const parallel = (tasks) => Promise.all(Array.from(tasks || [], (t) => (typeof t === "function" ? t() : t)));
const pipeline = (items, fn) => Promise.all(Array.from(items || [], (x, i) => fn(x, i)));
Date.now = () => { throw new Error("Date.now() is not available in a workflow: pass a timestamp in through args"); };
Math.random = () => { throw new Error("Math.random() is not available in a workflow"); };
globalThis.Date = new Proxy(Date, { construct(t, a) { if (!a.length) throw new Error("new Date() needs an argument in a workflow: pass a timestamp in through args"); return new t(...a); }, apply(t, s, a) { throw new Error("Date() is not available in a workflow"); } });
`;
  let finished = false, result, failed = null;
  try {
    const p = vm.runInContext(prelude + "(async () => {\n" + parts.body + "\n})()", ctx, { timeout: 5000, filename: "workflow.js" });
    p.then((v) => { finished = true; result = v; }, (e) => { finished = true; failed = e; });
  } catch (e) { return { status: "error", error: String((e && e.message) || e).slice(0, 500), logs }; }
  for (let k = 0; k < 20 && !finished; k++) await new Promise((r) => setImmediate(r));
  if (failed) return { status: "error", error: String((failed && failed.message) || failed).slice(0, 500), logs };
  if (finished) { let out; try { out = JSON.parse(JSON.stringify(result ?? null)); } catch { out = String(result); } return { status: "done", result: out, logs, meta: parts.meta }; }
  if (pending.length) return { status: "pending", pending, logs, meta: parts.meta };
  return { status: "error", error: "the script is waiting on something that never ends (only agent(), parallel() and pipeline() can be awaited)", logs };
}

/** The tool names this file answers (coder-agent.mjs sends their calls to agentToolCall). */
export const AGENT_TOOL_NAMES = Object.freeze(["agent", "subagent_handback", "list_agents", "send_message", "workflow"]);
/** Claude Code's old name for its Agent tool ("The previous name `Task` is still accepted as an alias"). */
export const AGENT_ALIASES = Object.freeze(["Task", "task", "Agent"]);

const oneLine = (v, n) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
/** A subagent's steps in the chat: under its own id and name, as Gloopy's helpers' are. */
export function taggedEmit(emit, tag, label) {
  return (e) => {
    if (typeof emit !== "function" || !e) return;
    if (e.type === "bash" || e.type === "result") emit({ ...e, id: tag + e.id, ...(e.type === "bash" ? { command: "“" + label + "” · " + String(e.command || "") } : {}), ...(e.type === "result" && typeof e.label === "string" && e.label ? { label: "“" + label + "” · " + e.label } : {}) });
    else if (e.type === "paused") emit({ ...e, why: "Its agent “" + label + "”: " + String(e.why || "") });
  };
}
const capNote = (k) => "error: this job's cap of subagents is reached (" + k.budget.caps.total + " in all; " + TOTAL_VAR + " changes it). Do the rest yourself.";
const nowOf = (k) => (typeof k.now === "function" ? k.now() : Date.now());

/** The custom agents: the repository's (k.customAgents() → defs, once a job), then the plugins' (k.pluginAgents), or none. */
async function customOf(k) {
  const plugins = Array.isArray(k.pluginAgents) ? k.pluginAgents : [];
  if (typeof k.customAgents !== "function") return plugins;
  let d = [];
  try { d = await k.customAgents(); } catch { d = []; }
  return [...(Array.isArray(d) ? d : []), ...plugins];
}

/** How many times in a row SubagentStop hooks can keep one agent going (Claude Code's Stop hook cap, 8). */
export const STOP_AGAIN_MAX = 8;
/** A finished run's last words (SubagentStop's last_assistant_message: its closing text, not the handed-back report). */
const lastWords = (r) => { const m = ((r && r.messages) || []).filter((x) => x && x.role === "assistant" && typeof x.content === "string" && x.content.trim()).at(-1); return m ? m.content.trim().slice(0, 20_000) : ""; };

/**
 * ONE RUN OF A SUBAGENT (a new one, or one resumed by send_message): its SubagentStart hooks, its worktree when isolated, the
 * run itself within the caps, then Claude Code's completed result (AgentOutput) and its text. → { code, text, label, usage,
 * stop, result }.
 */
async function runAgent(entry, prompt, past, k) {
  const emit = typeof k.emit === "function" ? k.emit : () => {};
  const t0 = nowOf(k);
  let wt = entry.wt || null;
  if (entry.isolation === "worktree" && !wt) {
    const made = k.worktree && typeof k.worktree.create === "function" ? await Promise.resolve(k.worktree.create("agent-" + entry.id.replace(/^agent-/, "") + "-" + t0.toString(36).slice(-4))).catch((e) => ({ error: String((e && e.message) || e) })) : { error: "worktrees can't be made here" };
    if (!made || made.error || !made.path) { entry.status = "failed"; return { code: 1, text: "error: isolation \"worktree\": " + String((made && made.error) || "git could not create the worktree"), label: "Agent failed: " + entry.description, usage: [] }; }
    wt = entry.wt = made;
  }
  // (SubagentStart: on a new agent and on a resumed one; its additionalContext goes into the agent's context.)
  let context = [];
  if (typeof k.hookStart === "function") { try { const got = await k.hookStart(entry.id, entry.type); context = Array.isArray(got) ? got.filter((x) => typeof x === "string" && x.trim()) : []; } catch { context = []; } }
  const label = entry.name || entry.description;
  const tag = entry.id + (entry.sends ? "-m" + entry.sends : "") + "-";
  const once = (text, messages) => k.budget.run(() => Promise.resolve().then(() => k.startSub({
    type: entry.type, prompt: text, messages, label, emit: taggedEmit(emit, tag, label),
    model: entry.model, effort: entry.effort, toolNames: entry.toolNames,
    system: systemFor(entry.type, entry.def) + (context.length ? "\n\n" + context.join("\n") : ""),
    maxRounds: entry.def && entry.def.maxTurns ? entry.def.maxTurns : SUBAGENT_ROUNDS,
    cwd: wt ? wt.path : "", agentId: entry.id,
  })).catch((e) => ({ status: "error", messages: [], usage: [], summary: String((e && e.message) || e).slice(0, 300) })));
  let res = (await once(prompt, past)) || { status: "error", messages: [], usage: [] };
  const allUsage = [...(Array.isArray(res.usage) ? res.usage : [])];
  // SUBAGENTSTOP (Claude Code: "Runs when a Claude Code subagent has finished responding"; a block, or additionalContext, keeps
  // the subagent running with the reason as its next instruction; at most STOP_AGAIN_MAX times in a row, as for Stop hooks).
  for (let n = 0; typeof k.hookStop === "function" && res.status === "done" && n < STOP_AGAIN_MAX; n++) {
    let again = "";
    try { again = String((await k.hookStop({ agentId: entry.id, type: entry.type, active: n > 0, last: lastWords(res) })) || ""); } catch { again = ""; }
    if (!again.trim()) break;
    const more = (await once(again, resumable(res.messages))) || { status: "error", messages: [], usage: [] };
    for (const u of Array.isArray(more.usage) ? more.usage : []) allUsage.push(u);
    res = { ...more, messages: Array.isArray(more.messages) && more.messages.length ? more.messages : res.messages };
  }
  res.usage = allUsage;
  entry.status = statusWords(res.status);
  if (Array.isArray(res.messages) && res.messages.length) entry.messages = res.messages;
  // (Claude Code: "The worktree is automatically cleaned up if the subagent makes no changes"; kept, its path and branch.)
  let kept = null;
  if (wt) {
    let f = null;
    try { f = k.worktree && typeof k.worktree.finish === "function" ? await k.worktree.finish(wt) : { kept: true }; } catch { f = { kept: true }; }
    if (f && f.kept) kept = wt; else entry.wt = null;
  }
  const report = (reportOf(res) || "(no report)").slice(0, SUBAGENT_REPORT_MAX);
  const stats = toolStatsOf(res.messages);
  const u = usageOf(res.usage);
  const toolUses = Object.entries(stats).filter(([n]) => n.endsWith("Count")).reduce((n, [, v]) => n + v, 0);
  const result = {
    status: "completed", agentId: entry.id, agentType: entry.type, content: [{ type: "text", text: report }],
    resolvedModel: entry.model, totalToolUseCount: toolUses, totalDurationMs: Math.max(0, nowOf(k) - t0), totalTokens: u.totalTokens,
    usage: u.usage, toolStats: stats, prompt: String(prompt).slice(0, 20_000),
    ...(kept ? { worktreePath: kept.path, ...(kept.branch ? { worktreeBranch: kept.branch } : {}) } : {}),
  };
  entry.result = result;
  const text = report + "\n\nagentId: " + entry.id + (entry.name ? " (name: " + entry.name + ")" : "") + " · " + entry.status + " · send_message continues it"
    + (kept ? "\nworktreePath: " + kept.path + (kept.branch ? "\nworktreeBranch: " + kept.branch : "") : "")
    + "\n<usage>model: " + entry.model + (entry.effort ? " (" + entry.effort + ")" : "") + "\ntotal_tokens: " + u.totalTokens + "\ntool_uses: " + toolUses + "\nduration_ms: " + result.totalDurationMs + "</usage>";
  return { code: res.status === "done" ? 0 : 1, text, label: (entry.sends ? "Agent answered: " : "Agent finished: ") + label, usage: Array.isArray(res.usage) ? res.usage : [], stop: res.status === "stopped", result };
}

/**
 * AN AGENT CALL, STARTED (its checks, the cap, then its run under way): { entry } | { error }. coder-agent.mjs starts each
 * agent call of one message this way at once (Claude Code runs a message's agent calls side by side), and each call's turn
 * takes its result (agentToolCall, k.early).
 */
export async function startAgent(c, k) {
  const args = c && c.args && typeof c.args === "object" ? c.args : {};
  const description = oneLine(args.description, 80), prompt = String(args.prompt ?? "").trim();
  const type = args.subagent_type === undefined || args.subagent_type === "" ? "general-purpose" : String(args.subagent_type);
  if (k.isSub) return { error: "error: a subagent can't start agents of its own" };
  if (!prompt) return { error: "error: give prompt: the task for the agent" };
  if (args.isolation !== undefined && args.isolation !== "worktree") return { error: args.isolation === "remote" ? "error: isolation \"remote\" runs Claude Code's agents in a cloud session, which Coder doesn't have; leave it out or use \"worktree\"" : "error: isolation is \"worktree\"" };
  const defs = AGENT_TYPES[type] ? [] : await customOf(k);
  const def = AGENT_TYPES[type] ? null : defs.find((d) => d && d.name === type) || null;
  if (!AGENT_TYPES[type] && !def) return { error: "error: Agent type '" + oneLine(type, 80) + "' not found. Available agents: " + [...Object.keys(AGENT_TYPES), ...defs.map((d) => d.name)].join(", ") };
  const tools = resolveAgentTools(type, def);
  if (tools.error) return { error: "error: " + tools.error };
  const mdl = resolveAgentModel({ model: args.model, effort: args.effort }, def, k.chat || {});
  if (mdl.error) return { error: "error: " + mdl.error };
  const name = oneLine(args.name, 40);
  if (name && (name === "main" || [...k.agents.values()].some((a) => a.name === name))) return { error: "error: an agent named “" + name + "” already exists: send_message continues it" };
  if (!k.budget.take()) return { error: capNote(k) };
  const id = "agent-" + (k.agents.size + 1);
  const entry = { id, name, type, description: description || oneLine(prompt, 80), status: "running", messages: [], sends: 0, model: mdl.model, effort: mdl.effort, toolNames: tools.names, def, isolation: args.isolation === "worktree" || (def && def.isolation === "worktree") ? "worktree" : "", background: args.run_in_background === true || !!(def && def.background) };
  k.agents.set(id, entry);
  entry.promise = runAgent(entry, prompt, [], k);
  entry.promise.catch(() => {});
  return { entry };
}

/**
 * ONE CALL OF agent, subagent_handback, list_agents, send_message OR workflow (from coder-agent.mjs's loop). `k`:
 *  emit, reply(text), budget (subagentBudget), agents (Map, the job's), runs (Map, the job's workflow runs),
 *  isSub (this loop is a subagent's), startSub({ type, prompt, messages, label, emit, model, effort, toolNames, system,
 *  maxRounds, cwd, agentId }) → a runCoder result, step(args) → a workflowStep pass, readText(path) → { text } | { error },
 *  stopped() → boolean; and optionally chat ({ model, effort }), customAgents() → defs, pluginAgents (defs, pluginAgentsFrom's), worktree ({ create(name), finish(wt) }),
 *  hookStart(agentId, type) → context strings, bg (Map: agents in the background), early (Map: calls started already), now().
 * → { usage: [...], stop?: true, handback?: string }.
 */
export async function agentToolCall(c, k) {
  const args = c && c.args && typeof c.args === "object" ? c.args : {};
  const usage = [];
  const emit = typeof k.emit === "function" ? k.emit : () => {};
  const stopped = async () => { try { return typeof k.stopped === "function" && (await k.stopped()) === true; } catch { return false; } };
  const say = (code, out, label, extra) => { emit({ type: "result", id: c.id, code, output: String(out).slice(0, 20_000), ...(label ? { label } : {}), ...(extra || {}) }); k.reply(out); };
  const no = (m) => { say(1, m); return { usage }; };
  const run = async ({ type, prompt, messages, label, tag, model, effort }) => {
    const r = await k.budget.run(() => Promise.resolve().then(() => k.startSub({ type, prompt, messages, label, emit: taggedEmit(emit, tag, label), model, effort, toolNames: (AGENT_TYPES[type] || AGENT_TYPES["general-purpose"]).tools, system: systemFor(type), maxRounds: SUBAGENT_ROUNDS, cwd: "", agentId: tag.replace(/-$/, "") })).catch((e) => ({ status: "error", messages: [], usage: [], summary: String((e && e.message) || e).slice(0, 300) })));
    for (const u of (r && r.usage) || []) usage.push(u);
    return r || { status: "error", messages: [], usage: [] };
  };

  if (c.name === "subagent_handback") {
    if (!k.isSub) return no("error: only a subagent hands back a report; you are the main conversation, so answer the owner in words");
    const message = String(args.message ?? "").trim();
    if (!message) return no("error: give message: your full report");
    say(0, "delivered", "Handed back its report");
    return { usage, stop: true, handback: message.slice(0, SUBAGENT_REPORT_MAX) };
  }

  if (c.name === "list_agents") {
    emit({ type: "bash", id: c.id, tool: "agent", verb: "Listed agents", command: "" });
    const lines = ["- main (this chat: you)"];
    for (const a of k.agents.values()) lines.push("- " + a.id + (a.name ? " (" + a.name + ")" : "") + " · " + a.type + " · " + a.status + (a.background && a.status === "running" ? " in the background" : "") + " · " + a.description);
    const defs = await customOf(k);
    const types = [...Object.entries(AGENT_TYPES).map(([n, t]) => "- " + n + ": " + t.description), ...defs.map((d) => "- " + d.name + " (custom, " + d.file + "): " + oneLine(d.description, 200))];
    say(0, lines.join("\n") + "\n\nSubagents left in this job: " + k.budget.left() + " of " + k.budget.caps.total + " (at most " + k.budget.caps.atOnce + " at once).\n\nAgent types you can start:\n" + types.join("\n"));
    return { usage };
  }

  if (c.name === "agent") {
    const description = oneLine(args.description, 80), prompt = String(args.prompt ?? "").trim();
    emit({ type: "bash", id: c.id, tool: "agent", verb: args.run_in_background === true ? "Started an agent in the background" : "Started an agent", command: description || oneLine(prompt, 80) });
    const pre = k.early instanceof Map ? k.early.get(c.id) : null;
    if (pre) k.early.delete(c.id);
    const st = pre ? await pre : await startAgent(c, k);
    if (!st || st.error) return no((st && st.error) || "error: the agent could not start");
    const entry = st.entry;
    if (entry.background && k.bg instanceof Map) {
      const b = { entry, done: false, out: null };
      b.promise = entry.promise.then((x) => { b.done = true; b.out = x; }, (e) => { b.done = true; b.out = { code: 1, text: "error: " + String((e && e.message) || e), usage: [] }; });
      k.bg.set(entry.id, b);
      say(0, "Async agent launched successfully.\nagentId: " + entry.id + (entry.name ? " (name: " + entry.name + ")" : "") + " (use send_message with to: '" + (entry.name || entry.id) + "' to continue this agent)\nThe agent is working in the background. You will be notified automatically when it completes.\nDo not duplicate this agent's work: avoid working with the same files or topics it is using. Briefly tell the owner what you launched and end your response, or go on with other work.", "Agent started in the background: " + entry.description, { agentResult: { status: "async_launched", isAsync: true, agentId: entry.id, description: entry.description, resolvedModel: entry.model, prompt: prompt.slice(0, 20_000) } });
      return { usage };
    }
    const out = await entry.promise;
    for (const u of out.usage || []) usage.push(u);
    say(out.code, out.text, out.label, out.result ? { agentResult: out.result } : null);
    return { usage, ...(out.stop ? { stop: true } : {}) };
  }

  if (c.name === "send_message") {
    const to = oneLine(args.to, 80), message = String(args.message ?? "").trim();
    const summary = summaryOf(args.summary, message);
    emit({ type: "bash", id: c.id, tool: "agent", verb: "Messaged an agent", command: (to + (summary ? ": " + summary : "")).slice(0, 240) });
    if (k.isSub) return no("error: a subagent can't message agents");
    if (!to || !message) return no("error: give to (an agent's id or name) and message");
    if (to === "main") return no("error: main is you");
    const a = k.agents.get(to) || [...k.agents.values()].find((x) => x.name === to);
    if (!a) return no("error: no agent is called " + to + " (list_agents shows them). Coder has no agent teams or other sessions to message.");
    // (One still running in the background: the message waits for it, as Claude Code queues a message to a running agent.)
    if (a.status === "running" && a.promise) { try { await a.promise; } catch { /* its end is its status */ } }
    if (!k.budget.take()) return no(capNote(k));
    a.status = "running"; a.sends++;
    a.promise = runAgent(a, message, resumable(a.messages), k);
    if (k.bg instanceof Map) k.bg.delete(a.id);
    const out = await a.promise;
    for (const u of out.usage || []) usage.push(u);
    say(out.code, out.text, out.label, out.result ? { agentResult: out.result, summary } : { summary });
    return { usage, ...(out.stop ? { stop: true } : {}) };
  }

  if (c.name === "workflow") {
    emit({ type: "bash", id: c.id, tool: "workflow", verb: "Ran a workflow", command: oneLine(args.scriptPath || args.name || args.resumeFromRunId || "inline script", 120) });
    if (k.isSub) return no("error: a subagent can't run workflows");
    const prev = typeof args.resumeFromRunId === "string" && args.resumeFromRunId ? k.runs.get(args.resumeFromRunId) : null;
    if (args.resumeFromRunId && !prev) return no("error: no workflow run " + oneLine(args.resumeFromRunId, 40) + " in this job");
    let script = "", scriptPath = "";
    if (typeof args.scriptPath === "string" && args.scriptPath.trim()) {
      const got = await k.readText(args.scriptPath.trim());
      if (got.error) return no("error: " + got.error);
      script = got.text; scriptPath = args.scriptPath.trim();
    } else if (typeof args.name === "string" && args.name.trim()) {
      const nm = args.name.trim().replace(/\.js$/, "");
      if (!/^[\w-]{1,80}$/.test(nm)) return no("error: name is a workflow's name in .claude/workflows/");
      const got = await k.readText(".claude/workflows/" + nm + ".js");
      if (got.error) return no("error: " + got.error);
      script = got.text; scriptPath = ".claude/workflows/" + nm + ".js";
    } else if (typeof args.script === "string" && args.script.trim()) script = args.script;
    else if (prev) { script = prev.script; scriptPath = prev.scriptPath || ""; }
    else return no("error: give script, name or scriptPath");
    const input = args.args === undefined && prev ? prev.args : args.args;
    // (Resumed: the agent() calls already done are reused; a call's key holds its prompt and options, so one whose input
    // changed is run again, as Claude Code's resumeFromRunId does.)
    const done = new Map(prev ? prev.done : []);
    const runId = "wf-" + (k.runs.size + 1);
    const record = { runId, script, scriptPath, args: input, done, status: "running" };
    k.runs.set(runId, record);
    let pass = null, agentsRun = 0, capped = 0, logs = [];
    const byPhase = new Map();
    for (let n = 0; n < WORKFLOW_PASSES; n++) {
      if (await stopped()) { record.status = "stopped"; say(1, "stopped by the owner (resumeFromRunId " + runId + " continues it)"); return { usage, stop: true }; }
      pass = await k.step({ script, args: input, done: [...done] });
      if (!pass || typeof pass !== "object") pass = { status: "error", error: "the script's pass gave nothing" };
      if (Array.isArray(pass.logs)) logs = pass.logs;
      if (pass.status !== "pending") break;
      const fresh = [];
      for (const p of pass.pending || []) if (p && typeof p.key === "string" && !done.has(p.key) && !fresh.some((x) => x.key === p.key)) fresh.push(p);
      if (!fresh.length) { pass = { status: "error", error: "the script waits on agent() calls that never settle" }; break; }
      const base = done.size;
      await Promise.all(fresh.map(async (p, j) => {
        if (!k.budget.take()) { capped++; done.set(p.key, { ok: null }); return; }
        agentsRun++;
        const ph = typeof p.phase === "string" && p.phase ? p.phase : "";
        byPhase.set(ph, (byPhase.get(ph) || 0) + 1);
        const type = AGENT_TYPES[p.subagent_type] ? p.subagent_type : "general-purpose";
        const mdl = resolveAgentModel({ model: AGENT_MODELS.includes(p.model) ? p.model : "", effort: AGENT_EFFORTS.includes(p.effort) ? p.effort : "" }, null, k.chat || {});
        const prompt = p.prompt + (p.schema ? "\n\nYour report (subagent_handback's message) must be only JSON matching this JSON Schema, with no other words:\n" + JSON.stringify(p.schema) : "");
        const label = (ph ? ph + " · " : "") + (p.label || "step " + (base + j + 1));
        const r = await run({ type, prompt, messages: [], label, tag: runId + "-" + (base + j + 1) + "-", model: mdl.model, effort: mdl.effort });
        if (r.status !== "done") { done.set(p.key, { ok: null }); return; }
        const rep = reportOf(r);
        if (p.schema) { const v = schemaAnswer(rep, p.schema); done.set(p.key, { ok: v.error ? null : v.value }); } else done.set(p.key, { ok: rep });
      }));
    }
    const meta = pass && pass.meta ? pass.meta : null;
    const nm = meta && meta.name ? meta.name : "";
    const phases = [...byPhase.entries()].filter(([p]) => p).map(([p, n]) => p + ": " + n);
    const head = "workflow" + (nm ? " “" + nm + "”" : "") + " · runId " + runId + " · " + agentsRun + " agent" + (agentsRun === 1 ? "" : "s") + " run" + (capped ? " · " + capped + " agent() call" + (capped === 1 ? "" : "s") + " gave null: this job's cap of subagents was reached" : "")
      + (meta && meta.description ? "\nsummary: " + meta.description : "") + (phases.length ? "\nphases: " + phases.join(", ") : "") + (scriptPath ? "\nscriptPath: " + scriptPath : "");
    const logText = logs.length ? "\nlog:\n" + logs.join("\n") : "";
    const fields = { workflowResult: { workflowName: nm, runId, summary: meta ? meta.description : "", ...(scriptPath ? { scriptPath } : {}), agentsRun, ...(phases.length ? { phases: Object.fromEntries([...byPhase.entries()].filter(([p]) => p)) } : {}) } };
    if (!pass || pass.status !== "done") {
      record.status = "failed";
      const why = pass && pass.status === "pending" ? "it was still waiting after " + WORKFLOW_PASSES + " passes" : String((pass && pass.error) || "it failed");
      say(1, "error: the " + head + "\nstopped: " + why + logText + "\n(resumeFromRunId " + runId + " reruns it and reuses the agents already done)", "", { ...fields, workflowResult: { ...fields.workflowResult, error: why } });
      return { usage };
    }
    record.status = "done";
    let out; try { out = JSON.stringify(pass.result, null, 2); } catch { out = String(pass.result); }
    if (out === undefined) out = "null";
    if (out.length > WORKFLOW_RESULT_MAX) out = out.slice(0, WORKFLOW_RESULT_MAX) + "\n…(cut: " + out.length + " characters)";
    say(0, head + logText + "\nresult:\n" + out, "Workflow finished" + (nm ? ": " + nm : ""), fields);
    return { usage };
  }
  return no("error: unknown agent tool");
}

/** The background agents that have ended: a notification for each (Claude Code's task notification), and they leave the list. */
export function takeBgAgents(bg) {
  const out = [];
  if (!(bg instanceof Map)) return out;
  for (const [id, b] of bg) {
    if (!b.done) continue;
    bg.delete(id);
    const o = b.out || { code: 1, text: "(no report)", usage: [] };
    out.push({ id, usage: o.usage || [], ok: o.code === 0, text: "<task-notification>\n<task-id>" + id + "</task-id>\n<status>" + (o.code === 0 ? "completed" : "failed") + "</status>\n<summary>Agent “" + (b.entry.name || b.entry.description) + "” " + (o.code === 0 ? "completed" : "failed") + "</summary>\n<result>\n" + o.text + "\n</result>\n</task-notification>" });
  }
  return out;
}

/** Custom agents from the text of .claude/agents/*.md (`files`: [{ file, text }]): the definitions, and the files skipped. */
export function customAgentsFrom(files) {
  const defs = [], skipped = [];
  for (const f of Array.isArray(files) ? files : []) {
    const p = parseAgentFile(f && f.text, f && f.file);
    if (p.def) { if (!AGENT_TYPES[p.def.name] && !defs.some((d) => d.name === p.def.name)) defs.push(p.def); }
    else if (p.skip && p.skip !== "no frontmatter" && p.skip !== "no name") skipped.push((f && f.file) + ": " + p.skip);
  }
  return { defs: defs.slice(0, 50), skipped };
}
/** The shell script that prints each .claude/agents/*.md file, each after a mark line (read as `dev` in the chat's sandbox). */
export const AGENT_FILES_MARK = "@@CODER-AGENT-FILE ";
export function agentFilesScript() {
  return "for f in " + AGENTS_DIR + "/*.md; do [ -f \"$f\" ] || continue; printf '%s%s\\n' '" + AGENT_FILES_MARK + "' \"$f\"; head -c 40000 -- \"$f\"; printf '\\n'; done 2>/dev/null; true";
}
/** That script's output, as [{ file, text }]. */
export function agentFilesOf(output) {
  const out = [];
  let cur = null;
  for (const line of String(output || "").split("\n")) {
    if (line.startsWith(AGENT_FILES_MARK)) { cur = { file: line.slice(AGENT_FILES_MARK.length).trim(), lines: [] }; out.push(cur); }
    else if (cur) cur.lines.push(line);
  }
  return out.slice(0, 50).map((x) => ({ file: x.file, text: x.lines.join("\n") }));
}
/** A subagent's worktree: the script that makes one without moving the chat's shell, and the one that cleans it up when unchanged. */
export function agentWorktreeScript(name) { return "(\n" + enterNewScript(name) + "\n)"; }
export function agentWorktreeFinishScript({ path, branch }) {
  return "( cd -- " + shq(path) + " 2>/dev/null || { echo '" + MARK + " GONE'; exit 0; }\n"
    + "__main=$(dirname \"$(git rev-parse --path-format=absolute --git-common-dir)\")\n"
    + "__files=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')\n"
    + "__commits=$(git rev-list --count HEAD --not \"$(git -C \"$__main\" rev-parse HEAD)\" 2>/dev/null || echo 0)\n"
    + "if [ \"$__files\" = 0 ] && [ \"$__commits\" = 0 ]; then cd -- \"$__main\" && git worktree remove --force " + shq(path) + " >/dev/null 2>&1; " + (branch ? "git branch -D " + shq(branch) + " >/dev/null 2>&1; " : "") + "echo '" + MARK + " REMOVED'; else echo '" + MARK + " KEPT'; fi )";
}
