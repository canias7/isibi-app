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
import { frontmatterHooks, frontmatterOf } from "./coder-yaml.mjs";

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
  "general-purpose": { tools: ["bash", "read", "edit", "write", "notebook_edit", "grep", "glob", "web_fetch", "web_search", "skill", "agent"], note: "", description: "General-purpose agent for researching complex questions, searching for code, and executing multi-step tasks. When you are searching for a keyword or file and are not confident that you will find the right match in the first few tries use this agent to perform the search for you." },
  Explore: { tools: ["bash", "read", "grep", "glob", "web_fetch", "web_search", "skill"], note: "You are an Explore agent: search and read only. Never change a file: no edits, no writes, no commands that change anything (no installs, no git commit, no rm, no redirects into files).", description: "Fast agent specialized for exploring codebases. Use this when you need to quickly find files by patterns, search code for keywords, or answer questions about the codebase (read-only)." },
  Plan: { tools: ["bash", "read", "grep", "glob", "web_fetch", "web_search", "skill"], note: "You are a Plan agent: research the code and design an implementation plan (the steps, the files, the risks). Never change a file: no edits, no writes, no commands that change anything.", description: "Software architect agent for designing implementation plans. Use this when you need to plan the implementation strategy for a task: it returns step-by-step plans, identifies critical files, and considers architectural trade-offs (read-only)." },
  // CLAUDE CODE'S web-fetch (2026-11-23; its tools reference: "the subagent built into Claude Code that reads web pages for
  // Claude … The subagent calls WebFetch, reads the page, and sends Claude the answer"; "reads pages of up to about 48,000
  // characters in full"): its web_fetch gives the page's own text, up to 48,000 characters a call (coder-agent.mjs). The
  // chat's web_fetch rules and hooks apply to its fetches; Agent(web-fetch) in deny turns it off.
  "web-fetch": { tools: ["web_fetch"], note: "You are the web-fetch agent: fetch the URL you were given with web_fetch (its result is the page's own text, up to about 48,000 characters a call; fetch on with offset when the page goes on and the question needs more), read it, and answer the question about it in your report. Fetch nothing else.", description: "Reads a web page for Coder: give it the URL and a question about the page; it fetches the page, reads up to about 48,000 characters of it in full, and answers the question." },
});
/** The tools a subagent can ever have (Claude Code's "tools available to subagents", in Coder's names). */
// (skill, Claude Code's Skill: "Subagents can still invoke unlisted project, user, and plugin skills through the Skill tool";
// "To prevent a subagent from invoking skills entirely, omit Skill from the tools list or add it to disallowedTools". 2026-11-28.)
export const SUBAGENT_AVAILABLE = Object.freeze(["bash", "read", "edit", "write", "notebook_edit", "grep", "glob", "lsp", "web_fetch", "web_search", "skill", "agent"]);
/** The models an agent can run on: Coder's own (coder-model.mjs), and the effort levels Claude Code's input takes. */
export const AGENT_MODELS = Object.freeze(CODER_MODELS.map((m) => m.id));
export const AGENT_EFFORTS = Object.freeze(["low", "medium", "high", "xhigh", "max"]);
/** A custom agent's folder in the repository (Claude Code's project subagents). */
export const AGENTS_DIR = ".claude/agents";

const capsWords = "at most 3 subagents run at the same time and at most 10 in all for one job (the machine's CODER_MAX_SUBAGENTS_AT_ONCE and CODER_MAX_SUBAGENTS_TOTAL can change these); a workflow's agents and a resumed agent count too, and a call past the cap is refused";

/** Claude Code's Agent tool, its inputs (AgentInput) and its description, in Coder's words. */
export const AGENT_TOOL = Object.freeze({ type: "function", function: {
  name: "agent",
  description: "Launch a new agent to handle complex, multi-step tasks autonomously.\n\nThe agent tool launches specialized agents (subprocesses) that autonomously handle complex tasks. Each agent type has specific capabilities and tools available to it.\n\nAvailable agent types and the tools they have access to:\n- general-purpose: " + AGENT_TYPES["general-purpose"].description + " (Tools: bash, read, edit, write, notebook_edit, grep, glob, web_fetch, web_search, skill, agent, and the chat's connector tools)\n- Explore: " + AGENT_TYPES.Explore.description + " (Tools: bash, read, grep, glob, web_fetch, web_search, skill, and the chat's connector tools)\n- Plan: " + AGENT_TYPES.Plan.description + " (Tools: bash, read, grep, glob, web_fetch, web_search, skill, and the chat's connector tools)\n- web-fetch: " + AGENT_TYPES["web-fetch"].description + " (Tools: web_fetch)\n- the repository's custom agents: each .md file in " + AGENTS_DIR + "/ (subfolders too) with a name and a description in its frontmatter (and optionally tools, disallowedTools, model, effort, maxTurns, isolation, background, skills, memory, omitClaudeMd and permissionMode; the file's body is its instructions). One named like a built-in type replaces it. list_agents lists them.\n\nWhen using the agent tool, specify a subagent_type parameter to select which agent type to use. If omitted, the general-purpose agent is used. The old name of this tool, Task, still works.\n\nWhen NOT to use the agent tool:\n- If you want to read a specific file path, use read or glob instead, to find the match more quickly\n- If you are searching for a specific class definition like \"class Foo\", use glob instead\n- If you are searching for code within a specific file or set of 2-3 files, use read instead\n- Other tasks that are not related to the agent descriptions above\n\nUsage notes:\n- Always include a short description (3-5 words) summarizing what the agent will do\n- Launch multiple agents concurrently whenever possible, to maximize performance; to do that, use a single message with multiple agent calls (they run side by side; " + capsWords + ")\n- When the agent is done, it will return a single message back to you. The result returned by the agent is not visible to the owner. To show the owner the result, you should send a text message back to the owner with a concise summary of the result.\n- run_in_background: left out, an agent you start from the main conversation runs in the background, and one a subagent starts is waited for (unless its definition sets background: true); set it to false to wait for the result, true to run in the background. When an agent runs in the background, you will be automatically notified when it completes; do not sleep, poll, or proactively check on its progress. Continue with other work or respond to the owner instead.\n- To continue a previously spawned agent, use send_message with the agent's ID or name as the `to` field. The agent resumes with its full context preserved. Each fresh agent invocation with a prompt starts without context, so provide a complete task description.\n- The agent's outputs should generally be trusted\n- Clearly tell the agent whether you expect it to write code or just to do research (search, file reads, web fetches, etc.), since it is not aware of the owner's intent\n- If the agent description mentions that it should be used proactively, then you should try your best to use it without the owner having to ask for it first. Use your judgement.\n- You can optionally set isolation: \"worktree\" to run the agent in a temporary git worktree, giving it an isolated copy of the repository. The worktree is automatically cleaned up if the agent makes no changes; if changes are made, the worktree path and branch are returned in the result.\n- model and effort run the agent on another of Coder's models (" + AGENT_MODELS.join(", ") + ") or effort level; the chat's are used when left out. An effort the model doesn't take runs at the nearest level it does.\n- Launching an agent never asks the owner; the agent's own steps are checked against the chat's rules and mode as it runs, and a step that needs the owner's OK shows the owner its card, as the chat's own steps do. A general-purpose subagent can start agents of its own (they share the job's caps), up to three layers below the chat (CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH changes it); a nested agent runs on its parent's model unless the call or its definition names another.\n- Coder has no agent teams and no remote agents: team_name and mode are accepted for Claude Code's input and ignored, and isolation \"remote\" is refused.",
  parameters: { type: "object", properties: {
    description: { type: "string", description: "A short (3-5 word) description of the task" },
    prompt: { type: "string", description: "The task for the agent to perform" },
    subagent_type: { type: "string", description: "The type of specialized agent to use for this task: general-purpose (the default), Explore, Plan, or the name of a custom agent in " + AGENTS_DIR + "/" },
    model: { type: "string", enum: [...AGENT_MODELS], description: "Optional model to use for this agent. If not specified, inherits from the chat" },
    effort: { type: "string", enum: [...AGENT_EFFORTS], description: "Optional effort level for this agent. If not specified, inherits from the chat (or the custom agent's effort)" },
    run_in_background: { type: "boolean", description: "Whether to run this agent in the background (you will be notified when it completes). Left out: true from the main conversation, false from a subagent" },
    name: { type: "string", description: "Name for the spawned agent. Makes it addressable via send_message({to: name}) while it runs and after it finishes." },
    team_name: { type: "string", description: "Deprecated; ignored (Coder has no agent teams)" },
    mode: { type: "string", enum: ["acceptEdits", "auto", "bypassPermissions", "default", "dontAsk", "plan"], description: "Deprecated; ignored. A subagent runs in the chat's permission mode, asking the owner for what would need the owner's OK" },
    isolation: { type: "string", enum: ["worktree", "remote"], description: "Isolation mode. \"worktree\" creates a temporary git worktree so the agent works on an isolated copy of the repo. \"remote\" is Claude Code's cloud agent and is refused in Coder" },
  }, required: ["description", "prompt"] },
} });

/** Claude Code's SubagentHandback: a subagent's report, delivered once, which ends its run. Only a subagent has it. */
export const SUBAGENT_HANDBACK_TOOL = Object.freeze({ type: "function", function: {
  name: "subagent_handback",
  description: "Deliver your final report to the agent that spawned you (your caller). Use it once, for that hand-off only: when your work is complete, call subagent_handback({message: <your full report>}). The call ends your run, so do everything else first and put everything your caller needs in that one report. It is not a messaging channel: do not use it for progress updates or questions.\n\nOnly a report delivered through subagent_handback reaches your caller; plain text you write at the end is NOT delivered. There is no recipient parameter: the report can only go to your caller.",
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
  description: "Runs a dynamic workflow: a script that orchestrates many subagents in the background and returns one consolidated result. Use it only when the owner asks for a workflow or a task needs the same step over many items (an audit of many files, a migration, cross-checked research). At least one of script, name or scriptPath is required.\n\nThe script must begin with `export const meta = { name: '...', description: '...' }` as a literal (an optional `phases` array names its stages), then plain JavaScript with top-level await:\n- `await agent(prompt, { label, schema, subagent_type, model, effort, phase })` runs one subagent and gives its report; with `schema` (a JSON Schema) the parsed JSON it returns. It gives null when the agent failed, its answer didn't match the schema, or the cap was reached.\n- `parallel([() => agent(...), ...])` runs several at once and waits for all; `pipeline(items, (item) => agent(...))` runs one per item.\n- `phase(title)` starts a stage (agents after it are grouped under it) and `log(message)` shows progress.\n- `args` is the input; `return` the result.\nDate.now(), Math.random() and new Date() with no argument throw (pass a time in args). The script runs in the chat's sandbox, not with your tools. The call returns at once (status async_launched: taskId, taskType local_workflow, workflowName, runId, summary, scriptPath; error if the script fails its syntax check, and then it never ran) and the workflow runs in the background; you are notified when it completes, with the agents run per phase, the log and the result. stop_job with the taskId stops it. resumeFromRunId with the runId reruns a script and reuses the agent() calls already done with unchanged input (in this chat, later messages too). name may be a built-in workflow: deep-research (args: the question) fans out web searches across several angles, cross-checks the claims and returns a cited report. Limits: " + capsWords + ".",
  parameters: { type: "object", properties: {
    script: { type: "string", description: "Inline workflow script. Must begin with export const meta = { name, description } as a literal, followed by the script body using agent(), parallel(), pipeline(), and phase()" },
    name: { type: "string", description: "Name of a built-in workflow (deep-research) or one saved in .claude/workflows/<name>.js. Resolved to a script" },
    scriptPath: { type: "string", description: "Path to a workflow script file on disk. Takes precedence over script and name" },
    args: { description: "Input value exposed to the script as the global args. Pass arrays and objects as actual JSON values, not as a JSON-encoded string" },
    resumeFromRunId: { type: "string", description: "Run ID of a prior workflow invocation to resume. Completed agent() calls with unchanged inputs return cached results; the rest run live. Works in later messages of the same chat too" },
    title: { type: "string", description: "Ignored; the script's meta block sets the title" },
    description: { type: "string", description: "Ignored; the script's meta block sets the description" },
  }, required: [] },
} });

/** Claude Code's tool names, in Coder's (for a custom agent's tools and disallowedTools lists). */
const CC_TO_CODER = { Bash: "bash", Read: "read", Edit: "edit", Write: "write", NotebookEdit: "notebook_edit", Grep: "grep", Glob: "glob", LSP: "lsp", WebFetch: "web_fetch", WebSearch: "web_search", MultiEdit: "edit", Skill: "skill" };
const toolEntry = (t) => { const n = String(t).trim().replace(/\(.*\)$/, "").trim(); return CC_TO_CODER[n] || n.toLowerCase(); };
const listField = (v) => (Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : []).map((x) => String(x).trim()).filter(Boolean);

const fmHooks = (src) => { try { return frontmatterHooks(src); } catch { return null; } };
const boolField = (v) => v === true || /^(true|yes|on|1)$/i.test(String(v ?? "").trim());
const strField = (v) => (v === null || v === undefined || typeof v === "object" ? "" : String(v).trim());
/** Claude Code's permissionMode values ("manual as an alias for default"). */
export const AGENT_MODES = Object.freeze(["default", "acceptEdits", "auto", "dontAsk", "bypassPermissions", "plan"]);
/** Claude Code's memory scopes for a subagent. */
export const AGENT_MEMORY_SCOPES = Object.freeze(["user", "project", "local"]);
/**
 * A custom agent's file (.claude/agents/<file>.md): { def } | { skip: why } (Claude Code's "Subagent files Claude Code skips").
 * The frontmatter is read as YAML (coder-yaml.mjs), so lists and multi-line values work. SKILLS AND SUBAGENTS ROUND
 * (2026-11-28): skills, memory, omitClaudeMd, initialPrompt, permissionMode and mcpServers are kept too.
 */
export function parseAgentFile(text, file = "") {
  const src = String(text || "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  if (!src.startsWith("---\n")) return { skip: "no frontmatter" };
  const end = src.indexOf("\n---", 3);
  if (end < 0) return { skip: "the frontmatter doesn't close" };
  const fm = frontmatterOf(src);
  if (!fm) return { skip: "its YAML doesn't parse" };
  const name = strField(fm.name);
  if (!name) return { skip: "no name" };
  if (name.startsWith("-") || name.includes(":") || name.length > 256) return { skip: "the name starts with -, holds : or is over 256 characters" };
  const description = typeof fm.description === "string" ? fm.description.trim() : strField(fm.description);
  if (!description) return { skip: "a name but no description" };
  const turns = Number.parseInt(String(fm.maxTurns ?? ""), 10);
  const mode = strField(fm.permissionMode) === "manual" ? "default" : strField(fm.permissionMode);
  const mem = strField(fm.memory).toLowerCase();
  const mcp = Array.isArray(fm.mcpServers) ? fm.mcpServers : fm.mcpServers && typeof fm.mcpServers === "object" ? Object.entries(fm.mcpServers).map(([k, v]) => ({ [k]: v })) : [];
  return { def: {
    name, description: description.slice(0, 1000), file,
    tools: fm.tools === undefined || fm.tools === null || fm.tools === "" ? null : listField(fm.tools),
    disallowedTools: listField(fm.disallowedTools),
    model: strField(fm.model),
    effort: AGENT_EFFORTS.includes(strField(fm.effort)) ? strField(fm.effort) : "",
    maxTurns: Number.isFinite(turns) && turns > 0 ? Math.min(turns, SUBAGENT_ROUNDS) : 0,
    isolation: strField(fm.isolation) === "worktree" ? "worktree" : "",
    background: boolField(fm.background),
    // (Claude Code: "skills: Skills to preload into the subagent's context at startup", "up to the first 32 distinct names".)
    skills: [...new Set(listField(fm.skills))].slice(0, 32),
    memory: AGENT_MEMORY_SCOPES.includes(mem) ? mem : "",
    omitClaudeMd: boolField(fm.omitClaudeMd),
    initialPrompt: strField(fm.initialPrompt).slice(0, 20_000),
    permissionMode: AGENT_MODES.includes(mode) ? mode : "",
    mcpServers: mcp.map((x) => (typeof x === "string" ? x.trim() : x && typeof x === "object" && !Array.isArray(x) ? Object.keys(x)[0] && { [Object.keys(x)[0]]: x[Object.keys(x)[0]] } : null)).filter(Boolean).slice(0, 20),
    prompt: src.slice(end + 4).replace(/^[^\n]*\n?/, "").trim().slice(0, 20_000),
    // (Its frontmatter hooks, Claude Code's settings shape: run only while it runs, its Stop as SubagentStop; coder-fmhooks.mjs.)
    ...(fmHooks(src) ? { hooks: fmHooks(src) } : {}),
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
    // (A tools list of only connector tools, such as mcp__github__*, is not "zero tools": subagentConnectors keeps them.)
    if (!names.length && !def.tools.some((t) => /^mcp__/i.test(String(t).trim()))) return { error: "Agent '" + def.name + "' would be spawned with zero tools: no entry of its tools list (" + def.tools.join(", ") + ") is a tool a subagent can use in Coder (" + SUBAGENT_AVAILABLE.join(", ") + "; Claude Code's names such as Read, Grep and Bash work too)." };
  }
  if (def && def.disallowedTools.length) { const no = def.disallowedTools.map(toolEntry); names = names.filter((n) => !no.includes(n)); }
  return { names };
}

/**
 * A SUBAGENT'S CONNECTOR (MCP) TOOLS (Claude Code: "Subagents inherit the built-in tools and MCP tools available in the main
 * conversation"; `tools` "Inherits every tool available to subagents if omitted"; its MCP entries: `mcp__github__*` in tools
 * gives "every tool from one server", `mcp__github` or `mcp__github__*` in disallowedTools withholds one server's, `mcp__*`
 * every MCP tool; disallowedTools wins). The built-in web-fetch agent has only web_fetch. `list`: the chat's connector tools
 * ({ name, ... }). -> the ones this agent gets. 2026-11-28.
 */
export function subagentConnectors(list, type, def = null) {
  const all = (Array.isArray(list) ? list : []).filter((t) => t && typeof t.name === "string" && t.name.startsWith("mcp__"));
  if (!def && type === "web-fetch") return [];
  const raw = (v) => (Array.isArray(v) ? v : []).map((x) => String(x).trim().replace(/\(.*\)$/, "").trim()).filter((x) => /^mcp__/i.test(x));
  const inTools = (n, e) => n === e || e === "mcp__*" || (e.endsWith("__*") && n.startsWith(e.slice(0, -1)));
  const inDeny = (n, e) => inTools(n, e) || n.startsWith(e + "__");
  let out = all;
  if (def && Array.isArray(def.tools) && def.tools.length) { const want = raw(def.tools); out = out.filter((t) => want.some((e) => inTools(t.name, e))); }
  if (def && Array.isArray(def.disallowedTools) && def.disallowedTools.length) { const no = raw(def.disallowedTools); out = out.filter((t) => !no.some((e) => inDeny(t.name, e))); }
  return out;
}

/** A forked skill's step (Claude Code shows the agent type it runs as, such as Explore, with the skill's name). 2026-11-28. */
export const forkLabel = (sk) => ((sk && sk.agent ? String(sk.agent) : "general-purpose") + ": " + String((sk && sk.name) || "skill")).slice(0, 80);

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
  // (frameCount: Claude Code's count of screen frames a computer-use agent took; Coder's agents take none.)
  st.frameCount = 0;
  return st;
}
/** Claude Code's usage on an agent's result: its last request's, and its whole run's tokens. */
export function usageOf(list) {
  const u = Array.isArray(list) ? list.filter((x) => x && typeof x === "object") : [];
  const last = u.at(-1) || {};
  // (Claude Code: "usage and totalTokens come from the subagent's final API request, not the whole run". 2026-11-23.)
  const total = (Number(last.in) || 0) + (Number(last.out) || 0);
  return { usage: { input_tokens: Number(last.in) || 0, output_tokens: Number(last.out) || 0, cache_creation_input_tokens: null, cache_read_input_tokens: Number(last.cached) || null, server_tool_use: null, service_tier: null, cache_creation: null, inference_geo: null, speed: null, iterations: null, output_tokens_details: { thinking_tokens: Number(last.reasoning) || 0 }, fallback_credit: null }, totalTokens: total };
}
/** Claude Code's modelsUsed: the run's models in order, only when a mid-run swap happened (a model shows again on a swap back). */
export function modelsUsedOf(list, first = "") {
  const seq = [];
  for (const x of [{ model: first }, ...(Array.isArray(list) ? list : [])]) { const m = x && typeof x.model === "string" ? x.model : ""; if (m && seq.at(-1) !== m) seq.push(m); }
  return seq.length > 1 ? seq : null;
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
export const SUBAGENT_TAIL = "You run as a subagent of Coder, the owner's AI coding assistant on gofarther.dev, with one task from Coder. Never ask the owner anything: you can't reach them; a step that needs their OK is refused (say so in your report). When you are done, call subagent_handback with your full report if you have that tool (it ends your run); otherwise end with your full report as your final answer. No emojis.";

/** The tools a subagent of `type` gets from `coderTools` (Coder's own definitions), and subagent_handback (`names`: a custom agent's). */
export function subagentTools(coderTools, type, names = null, { mode = "auto" } = {}) {
  const want = Array.isArray(names) ? names.filter((n) => SUBAGENT_AVAILABLE.includes(n)) : (AGENT_TYPES[type] || AGENT_TYPES["general-purpose"]).tools;
  const list = Array.isArray(coderTools) ? coderTools : [...(coderTools || [])];
  const got = want.map((n) => list.find((t) => t && t.function && t.function.name === n) || (n === "agent" ? AGENT_TOOL : null)).filter(Boolean);
  // (Claude Code gives SubagentHandback only in auto mode, and then whatever the agent's tools say: handbackFor.)
  return handbackFor(mode) ? [...got, SUBAGENT_HANDBACK_TOOL] : got;
}
/** Whether a subagent gets subagent_handback (Claude Code: "Given only in auto mode"; otherwise its last words are its report). */
export const handbackFor = (mode) => mode === "auto";

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
 * A WORKFLOW RUN'S SAVED RESULTS (Claude Code: a run is resumable within the same session; in a cloud session "the run's results"
 * are saved with the session): on the chat's machine, RUNS_DIR/<runId>.json, { script, scriptPath, args, done }, written as its
 * agents finish, so resumeFromRunId works from a later message of the chat; RUNS_DIR/last holds the newest run's number, so a
 * new run's id is new. A run whose saved form is over RUN_SAVE_MAX characters is kept for its own job only. 2026-11-24.
 */
export const RUNS_DIR = "/tmp/coder-agents/workflow-runs";
export const RUN_SAVE_MAX = 90_000;
export async function saveRun(k, record, first = false) {
  if (typeof k.writeText !== "function" || !record || !/^wf-\d{1,6}$/.test(String(record.runId))) return false;
  let text = "";
  try { text = JSON.stringify({ runId: record.runId, script: record.script, scriptPath: record.scriptPath || "", args: record.args === undefined ? null : record.args, done: [...record.done] }); } catch { return false; }
  try {
    if (first) await k.writeText(RUNS_DIR + "/last", String(record.runId).slice(3));
    if (text.length > RUN_SAVE_MAX) return false;
    await k.writeText(RUNS_DIR + "/" + record.runId + ".json", text);
    return true;
  } catch { return false; }
}
export async function loadRun(k, runId) {
  const id = String(runId || "").trim();
  if (!/^wf-\d{1,6}$/.test(id) || typeof k.readText !== "function") return null;
  let got; try { got = await k.readText(RUNS_DIR + "/" + id + ".json"); } catch { return null; }
  if (!got || got.error || typeof got.text !== "string") return null;
  try {
    const j = JSON.parse(got.text);
    if (!j || typeof j.script !== "string" || !Array.isArray(j.done)) return null;
    return { runId: id, script: j.script, scriptPath: typeof j.scriptPath === "string" ? j.scriptPath : "", args: j.args === null ? undefined : j.args, done: new Map(j.done.filter((x) => Array.isArray(x) && typeof x[0] === "string")), status: "saved" };
  } catch { return null; }
}
export async function lastRunNo(k) {
  // (Only where runs are saved: a job that can't write them has none from before.)
  if (typeof k.readText !== "function" || typeof k.writeText !== "function") return 0;
  try { const got = await k.readText(RUNS_DIR + "/last"); const n = got && !got.error ? Number(String(got.text || "").trim()) : 0; return Number.isInteger(n) && n > 0 && n < 1e6 ? n : 0; } catch { return 0; }
}
/**
 * CLAUDE CODE'S BUILT-IN WORKFLOW, /deep-research (its workflows docs, "Bundled workflows": "Fans out web searches on a question
 * across several angles, fetches and cross-checks the sources it finds, votes on each claim, and returns a cited report with
 * claims that didn't survive cross-checking filtered out"; a claim no verifier could check is listed as unverified). Coder's
 * script for it, run by name ("deep-research", args: the question), within the job's caps of subagents. 2026-11-24.
 */
export const BUILTIN_WORKFLOWS = Object.freeze({
  "deep-research": [
    "export const meta = { name: 'deep-research', description: 'Researches a question across several angles, cross-checks the sources and returns a cited report', phases: ['Search', 'Verify', 'Report'] };",
    "const q = String(typeof args === 'string' ? args : (args && (args.question || args.q)) || '').trim();",
    "if (!q) return { error: 'give the question as args' };",
    "phase('Search');",
    "const plan = await agent('Split this research question into 3 to 5 distinct angles worth searching separately. Question: ' + q, { label: 'angles', schema: { type: 'object', properties: { angles: { type: 'array', items: { type: 'string' } } }, required: ['angles'] } });",
    "const angles = (plan && Array.isArray(plan.angles) && plan.angles.length ? plan.angles : [q]).slice(0, 5);",
    "const CLAIMS = { type: 'object', properties: { claims: { type: 'array', items: { type: 'object', properties: { claim: { type: 'string' }, source: { type: 'string' } }, required: ['claim', 'source'] } } }, required: ['claims'] };",
    "const found = await parallel(angles.map((a) => () => agent('Research this with web_search, then web_fetch the best sources: ' + a + '\\n(It is one angle of the question: ' + q + ')\\nReport up to 4 specific claims that answer it, each with the URL of the source it came from.', { label: String(a).slice(0, 60), schema: CLAIMS, subagent_type: 'general-purpose' })));",
    "const claims = found.flatMap((f) => (f && Array.isArray(f.claims) ? f.claims : [])).slice(0, 12);",
    "log(angles.length + ' angles, ' + claims.length + ' claims');",
    "phase('Verify');",
    "const VERDICT = { type: 'object', properties: { verdict: { type: 'string', enum: ['supported', 'refuted', 'unverified'] }, sources: { type: 'array', items: { type: 'string' } } }, required: ['verdict'] };",
    "const checks = await parallel(claims.map((c) => () => agent('Cross-check this claim against independent sources with web_search and web_fetch (not only the one given). Claim: ' + c.claim + '\\nGiven source: ' + c.source + '\\nVerdict supported, refuted, or unverified when you could not check it.', { label: 'check: ' + String(c.claim).slice(0, 50), schema: VERDICT })));",
    "const kept = [];",
    "claims.forEach((c, i) => { const v = checks[i]; if (v && v.verdict === 'refuted') return; kept.push({ claim: c.claim, sources: [c.source].concat(v && Array.isArray(v.sources) ? v.sources : []).slice(0, 4), verified: !!(v && v.verdict === 'supported') }); });",
    "phase('Report');",
    "const report = await agent('Write a concise report answering: ' + q + '\\nUse only these cross-checked claims, cite each claim\\'s sources as links, and list the ones marked verified: false as unverified: ' + JSON.stringify(kept), { label: 'report' });",
    "return { question: q, report, claims: kept.length, dropped: claims.length - kept.length };",
  ].join("\n"),
});

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

/** Where a background agent's report is written when it finishes (Claude Code's outputFile), in the chat's sandbox. */
export const OUTPUT_DIR = "/tmp/coder-agents";

/**
 * A WORKFLOW SCRIPT'S SYNTAX CHECK before it runs (Claude Code's Workflow result: "error when the script fails its syntax
 * check (then it never ran despite the status)"): its meta, and the body compiled (never run) here. → { meta } | { error }.
 */
export function syntaxCheck(script) {
  const parts = splitScript(script);
  if (parts.error) return { error: parts.error };
  try { new vm.Script("(async () => {\n" + parts.body + "\n})", { filename: "workflow.js" }); } catch (e) { return { error: String((e && e.message) || e).slice(0, 300), meta: parts.meta }; }
  return { meta: parts.meta };
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
    // (A subagent's permission card, passed through to the owner as Claude Code passes a subagent's prompts ("Permission prompts
    // are passed through to you as they come up"; 2026-11-24): its call's id tagged, the agent named on it; and its answer.)
    else if (e.type === "permission") emit({ ...e, id: tag + e.id, agent: String(label).slice(0, 80), why: "Its agent “" + label + "”: " + String(e.why || "") });
    else if (e.type === "permanswer") emit(e);
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
/** The Agent call's content for a subagent that handed its report back with subagent_handback (read it from that call's PreToolUse or PostToolUse hook, tool_input.message). */
export const HANDBACK_CONTENT = "The subagent delivered its report through SubagentHandback.";
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
  // (ITS FRONTMATTER HOOKS, Claude Code's "Subagent hooks: Claude Code runs them only while that subagent is running", its Stop
  // as SubagentStop; a project agent's only once the owner trusts the repository's settings. 2026-11-27, coder-fmhooks.mjs.)
  // (k.agentHooks: coder-fmhooks.mjs agentHooksOf with the repository's trust, from coder-agent.mjs; this module stays light for the tools script.)
  const fm = typeof k.agentHooks === "function" ? k.agentHooks(entry.def) || { own: [], stop: [], held: false } : { own: [], stop: [], held: false };
  if (fm.held && typeof k.note === "function") { try { k.note("The hooks in agent " + entry.def.name + "'s file did not run: turn on \"Trust this repository's settings\" in its permission rules first."); } catch { /* said once */ } }
  const tag = entry.id + (entry.sends ? "-m" + entry.sends : "") + "-";
  // (ITS PRELOADED SKILLS AND ITS MEMORY, Claude Code's `skills` and `memory` fields, read when it starts. 2026-11-28.)
  if (entry.startup === undefined) entry.startup = await startupOf(entry, k);
  const once = (text, messages) => k.budget.run(() => Promise.resolve().then(() => k.startSub({
    type: entry.type, prompt: text, messages, label, emit: taggedEmit(emit, tag, label),
    model: entry.model, effort: entry.effort, toolNames: entry.toolNames, mode: entry.mode, depth: entry.depth, contextOf: (c) => subagentContext(c, entry.type, entry.def), def: entry.def,
    system: systemFor(entry.type, entry.def) + entry.startup + (context.length ? "\n\n" + context.join("\n") : ""),
    maxRounds: entry.def && entry.def.maxTurns ? entry.def.maxTurns : SUBAGENT_ROUNDS,
    cwd: wt ? wt.path : "", agentId: entry.id, stopReq: () => entry.stopReq === true, ...(fm.own.length ? { hooks: fm.own } : {}),
  })).catch((e) => ({ status: "error", messages: [], usage: [], summary: String((e && e.message) || e).slice(0, 300) })));
  let res = (await once(prompt, past)) || { status: "error", messages: [], usage: [] };
  const allUsage = [...(Array.isArray(res.usage) ? res.usage : [])];
  // SUBAGENTSTOP (Claude Code: "Runs when a Claude Code subagent has finished responding"; a block, or additionalContext, keeps
  // the subagent running with the reason as its next instruction; at most STOP_AGAIN_MAX times in a row, as for Stop hooks).
  for (let n = 0; typeof k.hookStop === "function" && res.status === "done" && n < STOP_AGAIN_MAX; n++) {
    let again = "";
    try { again = String((await k.hookStop({ agentId: entry.id, type: entry.type, active: n > 0, last: lastWords(res), messages: Array.isArray(res.messages) ? res.messages : [], ...(fm.stop.length ? { hooks: fm.stop } : {}) })) || ""); } catch { again = ""; }
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
  const swaps = modelsUsedOf(res.usage, entry.model);
  const result = {
    // (Claude Code's content: "The subagent's final text blocks, or, for a subagent whose report goes through SubagentHandback,
    // a short note about that hand-back in their place". 2026-11-27.)
    status: "completed", agentId: entry.id, agentType: entry.type, content: [{ type: "text", text: res && typeof res.handback === "string" && res.handback.trim() ? HANDBACK_CONTENT : report }],
    resolvedModel: entry.model, ...(swaps ? { modelsUsed: swaps } : {}), totalToolUseCount: toolUses, totalDurationMs: Math.max(0, nowOf(k) - t0), totalTokens: u.totalTokens,
    usage: u.usage, toolStats: stats, prompt: String(prompt).slice(0, 20_000),
    ...(kept ? { worktreePath: kept.path, ...(kept.branch ? { worktreeBranch: kept.branch } : {}) } : {}),
  };
  entry.result = result;
  if (entry.outputFile && typeof k.writeText === "function") { try { await k.writeText(entry.outputFile, report + "\n"); } catch { /* the notification carries it too */ } }
  const text = report + "\n\nagentId: " + entry.id + (entry.name ? " (name: " + entry.name + ")" : "") + " · " + entry.status + " · send_message continues it"
    + (kept ? "\nworktreePath: " + kept.path + (kept.branch ? "\nworktreeBranch: " + kept.branch : "") : "")
    + "\n<usage>model: " + entry.model + (entry.effort ? " (" + entry.effort + ")" : "") + "\ntotal_tokens: " + u.totalTokens + "\ntool_uses: " + toolUses + "\nduration_ms: " + result.totalDurationMs + "</usage>";
  return { code: res.status === "done" ? 0 : 1, text, label: (entry.sends ? "Agent answered: " : "Agent finished: ") + label, usage: Array.isArray(res.usage) ? res.usage : [], stop: res.status === "stopped", result };
}

/** Claude Code's nesting limit: CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH layers below the main conversation (default 3; 1 turns nesting off). */
export const SPAWN_DEPTH = 3, SPAWN_DEPTH_VAR = "CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH";
export const spawnDepthOf = (env) => capOf(env && env[SPAWN_DEPTH_VAR], SPAWN_DEPTH, 1, 10);

/**
 * A CUSTOM AGENT'S PERMISSION MODE (Claude Code's permissionMode rules): unset, a plugin's, or the chat in bypassPermissions,
 * acceptEdits or auto: the chat's mode; the chat in plan: plan; the chat in default (Manual) or dontAsk: the agent's own,
 * except bypassPermissions, auto when auto mode is off, and a mode Coder doesn't have.
 */
export function agentModeOf(parent, def, { autoOff = false } = {}) {
  const p = String(parent || "auto");
  const want = def && !def.plugin ? String(def.permissionMode || "") : "";
  if (!want || ["bypassPermissions", "acceptEdits", "auto"].includes(p)) return p;
  if (p === "plan") return "plan";
  if (want === "bypassPermissions" || want === "dontAsk" || (want === "auto" && autoOff)) return p;
  return ["auto", "acceptEdits", "plan", "default"].includes(want) ? want : p;
}

/**
 * WHAT OF THE CHAT'S CONTEXT A SUBAGENT STARTS WITH (Claude Code's "What loads at startup"): never the chat's auto memory ("the
 * main conversation's auto memory isn't loaded"); the CLAUDE.md files and the git status, except "The built-in Explore, Plan,
 * and web-fetch agents skip this" (git status: Explore and Plan) and a definition with omitClaudeMd skips CLAUDE.md.
 */
export function subagentContext(context, type, def = null) {
  const builtIn = !def;
  const noMd = (builtIn && ["Explore", "Plan", "web-fetch"].includes(type)) || !!(def && def.omitClaudeMd);
  const noGit = builtIn && ["Explore", "Plan", "web-fetch"].includes(type);
  const keep = (p) => {
    const key = String(p && p.key || ""), text = String(p && p.text || "").trimStart();
    if (key === "i:YOUR MEMORY FOR THIS REPO") return false;
    if (noMd && key.startsWith("i:") && /^(THE REPO'S OWN INSTRUCTIONS|MORE OF THE REPO'S INSTRUCTIONS)/.test(text)) return false;
    if (noGit && key === "i:GIT STATUS") return false;
    return true;
  };
  return Array.isArray(context) ? context.filter(keep) : context;
}

/** A subagent memory scope's folder (Claude Code: user ~/.claude/agent-memory/<name>/, project .claude/agent-memory/<name>/, local .claude/agent-memory-local/<name>/). */
export function agentMemoryDir(def, { root = "", home = "" } = {}) {
  if (!def || !def.memory) return "";
  const n = String(def.name).replace(/[^\w.-]/g, "-");
  if (def.memory === "user") return (home || "~") + "/.claude/agent-memory/" + n;
  return (root || ".") + "/.claude/" + (def.memory === "local" ? "agent-memory-local/" : "agent-memory/") + n;
}
/** Claude Code loads "the first 200 lines or 25KB of MEMORY.md in the memory directory, whichever comes first". */
export function memoryHead(text) {
  const lines = String(text || "").split("\n").slice(0, 200).join("\n");
  return Buffer.from(lines, "utf8").length > 25_000 ? Buffer.from(lines, "utf8").subarray(0, 25_000).toString("utf8").replace(/\uFFFD+$/, "") : lines;
}
/** The tools a memory scope turns on: read, write and edit; in plan mode, read only. */
export const memoryToolsFor = (mode) => (mode === "plan" ? ["read"] : ["read", "write", "edit"]);
/** The memory instructions a subagent with a memory scope is given (`readOnly`: in plan mode, read it but write nothing). */
export function memoryPrompt(dir, text, { readOnly = false } = {}) {
  const head = memoryHead(text).trim();
  if (readOnly) return "\n\nYOUR AGENT MEMORY (persistent, kept across chats) is the folder " + dir + "/. You are in plan mode, which is read-only: read your memory when it may help, but do not write, edit or create any memory file now (plan mode allows no file changes)."
    + (head ? "\n\nMEMORY.md:\n" + head : "\n\n(MEMORY.md is empty so far.)");
  return "\n\nYOUR AGENT MEMORY (persistent, kept across chats) is the folder " + dir + "/. Read it before you start when it may help, and as you work save what you learn there (the owner's preferences and corrections, project decisions and why), one topic file per memory, with MEMORY.md as the index: one line per memory pointing at its file. Only the first 200 lines or 25KB of MEMORY.md are loaded when you start; when it grows past that, curate it (merge or drop stale entries, move detail into topic files)."
    + (head ? "\n\nMEMORY.md:\n" + head : "\n\n(MEMORY.md is empty so far.)");
}

/** What a subagent starts with beyond its prompt: its preloaded skills' full text, and its memory (k.skills, k.readText). */
async function startupOf(entry, k) {
  const def = entry.def;
  if (!def) return "";
  let out = "";
  const skills = Array.isArray(k.skills) ? k.skills : [];
  for (const n of Array.isArray(def.skills) ? def.skills : []) {
    // (Claude Code: "You can't preload skills that set disable-model-invocation: true"; a missing one is skipped.)
    const sk = skills.find((s) => s && s.model && s.name.toLowerCase() === String(n).toLowerCase());
    if (sk && typeof k.skillText === "function") { try { out += "\n\n<preloaded-skill name=\"" + sk.name + "\">\n" + k.skillText(sk) + "\n</preloaded-skill>"; } catch { /* skipped */ } }
  }
  if (def.memory) {
    const dir = agentMemoryDir(def, { root: k.root || "", home: k.home || "" });
    let text = "";
    if (typeof k.readText === "function") { try { const r = await k.readText(dir + "/MEMORY.md"); text = r && typeof r.text === "string" ? r.text : ""; } catch { text = ""; } }
    out += memoryPrompt(dir, text, { readOnly: entry.mode === "plan" });
  }
  return out;
}

/**
 * WHETHER AN AGENT RUNS IN THE BACKGROUND (Claude Code's run_in_background: "Left out, a call from the main conversation runs
 * the new agent in the background, and a call from a subagent waits for it", unless the agent's definition sets background).
 */
export function backgroundOf(asked, def, isSub) {
  if (asked === true || asked === false) return asked;
  if (def && def.background) return true;
  return !isSub;
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
  if (!prompt) return { error: "error: give prompt: the task for the agent" };
  if (args.isolation !== undefined && args.isolation !== "worktree") return { error: args.isolation === "remote" ? "error: isolation \"remote\" runs Claude Code's agents in a cloud session, which Coder doesn't have; leave it out or use \"worktree\"" : "error: isolation is \"worktree\"" };
  // (Claude Code: "A user or project subagent named Explore overrides the built-in and keeps its own model field".)
  const defs = await customOf(k);
  const def = defs.find((d) => d && d.name === type) || null;
  // (Claude Code's "Disable specific subagents": Agent(name) in the deny rules, built-in and custom alike; Task(name) too.)
  if (typeof k.typeDenied === "function" && k.typeDenied(type)) return { error: "error: Permission to use Agent with subagent_type " + oneLine(type, 80) + " has been denied." };
  if (!AGENT_TYPES[type] && !def) return { error: "error: Agent type '" + oneLine(type, 80) + "' not found. Available agents: " + [...Object.keys(AGENT_TYPES), ...defs.map((d) => d.name)].join(", ") };
  const tools = resolveAgentTools(type, def);
  if (tools.error) return { error: "error: " + tools.error };
  const mdl = resolveAgentModel({ model: args.model, effort: args.effort }, def, k.chat || {});
  if (mdl.error) return { error: "error: " + mdl.error };
  const name = oneLine(args.name, 40);
  if (name && (name === "main" || [...k.agents.values()].some((a) => a.name === name))) return { error: "error: an agent named “" + name + "” already exists: send_message continues it" };
  if (!k.budget.take()) return { error: capNote(k) };
  const id = "agent-" + (k.agents.size + 1);
  // (THE DEPTH LIMIT, Claude Code's CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH: "up to three layers below the main conversation. At
  // the depth limit, Claude Code withholds the Agent tool". A memory scope turns on read, write and edit. 2026-11-28.)
  const depth = (Number(k.depth) || 0) + 1;
  let toolNames = tools.names;
  if (depth >= spawnDepthOf(k.env)) toolNames = toolNames.filter((n) => n !== "agent");
  const mode = agentModeOf(k.mode, def, { autoOff: k.autoOff === true });
  // (AGENT MEMORY IN PLAN MODE: Claude Code turns on Read, Write and Edit for a memory scope, but plan mode stays read-only,
  // "Write and Edit are denied", and a tool in disallowedTools stays removed; so in plan mode the memory is read, not written.
  // 2026-11-28.)
  if (def && def.memory) for (const n of memoryToolsFor(mode)) if (!toolNames.includes(n) && !(def.disallowedTools || []).map(toolEntry).includes(n)) toolNames = [...toolNames, n];
  const entry = { id, name, type, description: description || oneLine(prompt, 80), status: "running", messages: [], sends: 0, model: mdl.model, effort: mdl.effort, toolNames, def, depth, mode, isolation: args.isolation === "worktree" || (def && def.isolation === "worktree") ? "worktree" : "", background: backgroundOf(args.run_in_background, def, k.isSub) };
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

  if (c.name === "subagent_handback") {
    if (!k.isSub) return no("error: only a subagent hands back a report; you are the main conversation, so answer the owner in words");
    const message = String(args.message ?? "").trim();
    if (!message) return no("error: give message: your full report");
    // (Shown in the chat as a step, as Claude Code shows a subagent's SubagentHandback call: the live test of 2026-11-23 found
    // only its result sent, which the page draws under a step of the same id, so nothing showed.)
    emit({ type: "bash", id: c.id, tool: "agent", verb: "Handed back its report", command: oneLine(message, 120) });
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
    emit({ type: "bash", id: c.id, tool: "agent", verb: args.run_in_background === true || (args.run_in_background === undefined && !k.isSub) ? "Started an agent in the background" : "Started an agent", command: description || oneLine(prompt, 80) });
    const pre = k.early instanceof Map ? k.early.get(c.id) : null;
    if (pre) k.early.delete(c.id);
    const st = pre ? await pre : await startAgent(c, k);
    if (!st || st.error) return no((st && st.error) || "error: the agent could not start");
    const entry = st.entry;
    if (entry.background && k.bg instanceof Map) {
      const b = { entry, done: false, out: null, kind: "agent" };
      const canRead = typeof k.writeText === "function";
      if (canRead) { entry.outputFile = OUTPUT_DIR + "/" + entry.id + ".output"; try { await k.writeText(entry.outputFile, ""); } catch { entry.outputFile = ""; } }
      b.promise = entry.promise.then((x) => { b.done = true; b.out = x; }, (e) => { b.done = true; b.out = { code: 1, text: "error: " + String((e && e.message) || e), usage: [] }; });
      k.bg.set(entry.id, b);
      say(0, "Async agent launched successfully.\nagentId: " + entry.id + (entry.name ? " (name: " + entry.name + ")" : "") + " (use send_message with to: '" + (entry.name || entry.id) + "' to continue this agent)\nThe agent is working in the background. You will be notified automatically when it completes." + (entry.outputFile ? "\noutputFile: " + entry.outputFile + " (its report is written there when it finishes)" : "") + "\nDo not duplicate this agent's work: avoid working with the same files or topics it is using. Briefly tell the owner what you launched and end your response, or go on with other work.", "Agent started in the background: " + entry.description, { agentResult: { status: "async_launched", isAsync: true, agentId: entry.id, description: entry.description, resolvedModel: entry.model, prompt: prompt.slice(0, 20_000), outputFile: entry.outputFile || "", canReadOutputFile: !!entry.outputFile } });
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
    emit({ type: "bash", id: c.id, tool: "workflow", verb: "Started a workflow", command: oneLine(args.scriptPath || (typeof args.script === "string" && args.script.trim() ? (/name\s*:\s*["'`]([^"'`]{1,80})/.exec(args.script) || [])[1] || "inline script" : "") || args.name || args.resumeFromRunId || "inline script", 120) });
    if (k.isSub) return no("error: a subagent can't run workflows");
    // (A run of an earlier message of this chat: its saved results, on the chat's machine. Claude Code: "resumable within the
    // same session"; "nothing to resume" when its saved results can't be found. 2026-11-24.)
    const prev = typeof args.resumeFromRunId === "string" && args.resumeFromRunId ? k.runs.get(args.resumeFromRunId) || (await loadRun(k, args.resumeFromRunId)) : null;
    if (args.resumeFromRunId && !prev) return no("error: nothing to resume: no workflow run " + oneLine(args.resumeFromRunId, 40) + " in this chat. Start the workflow over as a new run.");
    let script = "", scriptPath = "";
    if (typeof args.scriptPath === "string" && args.scriptPath.trim()) {
      const got = await k.readText(args.scriptPath.trim());
      if (got.error) return no("error: " + got.error);
      script = got.text; scriptPath = args.scriptPath.trim();
    } else if (typeof args.script === "string" && args.script.trim()) script = args.script;
    // (Claude Code: scriptPath "takes precedence over script and name"; an inline script over a name. The live test of
    // 2026-11-23 sent script with name "say-hi": the name was read first, .claude/workflows/say-hi.js was missing, and the first
    // start failed.)
    else if (typeof args.name === "string" && args.name.trim()) {
      const nm = args.name.trim().replace(/^\//, "").replace(/\.js$/, "");
      if (!/^[\w-]{1,80}$/.test(nm)) return no("error: name is a built-in workflow's name (" + Object.keys(BUILTIN_WORKFLOWS).join(", ") + ") or one in .claude/workflows/");
      // (A saved one first, as Claude Code's own commands come after the project's; then a built-in one.)
      const got = await k.readText(".claude/workflows/" + nm + ".js");
      if (!got.error) { script = got.text; scriptPath = ".claude/workflows/" + nm + ".js"; }
      else if (Object.hasOwn(BUILTIN_WORKFLOWS, nm)) script = BUILTIN_WORKFLOWS[nm];
      else return no("error: " + got.error + " (no saved workflow " + nm + "; the built-in ones: " + Object.keys(BUILTIN_WORKFLOWS).join(", ") + ")");
    } else if (prev) { script = prev.script; scriptPath = prev.scriptPath || ""; }
    else return no("error: give script, name or scriptPath");
    const input = args.args === undefined && prev ? prev.args : args.args;
    const done = new Map(prev ? prev.done : []);
    const runId = "wf-" + (Math.max(k.runs.size, await lastRunNo(k)) + 1);
    const taskId = runId;
    const record = { runId, script, scriptPath, args: input, done, status: "running", stopReq: false };
    k.runs.set(runId, record);
    await saveRun(k, record, true);
    // CLAUDE CODE'S WORKFLOW RETURNS AT ONCE (2026-11-23): status async_launched with taskId, taskType local_workflow,
    // workflowName (meta.name), runId, summary (meta.description), scriptPath; error when the script fails its syntax check
    // (then it never runs, despite the status). The run's final result comes later as a task notification.
    const chk = syntaxCheck(script);
    const meta0 = chk.meta || null;
    const launched = { status: "async_launched", taskId, taskType: "local_workflow", workflowName: meta0 ? meta0.name : "", runId, summary: meta0 ? meta0.description : "", ...(scriptPath ? { scriptPath } : {}) };
    if (chk.error) {
      record.status = "failed";
      say(1, "Workflow launched with an error: the script failed its syntax check, so it never ran: " + chk.error + "\ntaskId: " + taskId + " · runId " + runId + (scriptPath ? "\nscriptPath: " + scriptPath + " (edit it and run again)" : ""), "Workflow not run: " + oneLine(chk.error, 80), { workflowResult: { ...launched, error: chk.error } });
      return { usage };
    }
    const own = [];
    const runAll = async () => {
      const stoppedHere = async () => record.stopReq || (await stopped());
      const runOne = async (o) => { const r = await k.budget.run(() => Promise.resolve().then(() => k.startSub({ type: o.type, prompt: o.prompt, messages: [], label: o.label, emit: taggedEmit(emit, o.tag, o.label), model: o.model, effort: o.effort, toolNames: (AGENT_TYPES[o.type] || AGENT_TYPES["general-purpose"]).tools, system: systemFor(o.type), maxRounds: SUBAGENT_ROUNDS, cwd: "", agentId: o.tag.replace(/-$/, ""), stopReq: () => record.stopReq })).catch((e) => ({ status: "error", messages: [], usage: [], summary: String((e && e.message) || e).slice(0, 300) }))); for (const u of (r && r.usage) || []) own.push(u); return r || { status: "error", messages: [], usage: [] }; };
      let pass = null, agentsRun = 0, capped = 0, logs = [];
      const byPhase = new Map();
      for (let n = 0; n < WORKFLOW_PASSES; n++) {
        if (await stoppedHere()) { record.status = "stopped"; return { code: 1, killed: true, text: "workflow " + runId + " was stopped (resumeFromRunId " + runId + " continues it)", usage: own }; }
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
          // (The progress view groups the agents under the script's named stages, meta.phases and phase(): a line per stage.)
          if (ph && !byPhase.has(ph)) emit({ type: "note", text: "Workflow " + runId + " · phase: " + ph, phase: ph, workflow: runId });
          byPhase.set(ph, (byPhase.get(ph) || 0) + 1);
          const type = AGENT_TYPES[p.subagent_type] ? p.subagent_type : "general-purpose";
          const mdl = resolveAgentModel({ model: AGENT_MODELS.includes(p.model) ? p.model : "", effort: AGENT_EFFORTS.includes(p.effort) ? p.effort : "" }, null, k.chat || {});
          const prompt = p.prompt + (p.schema ? "\n\nYour report (subagent_handback's message, or your final answer) must be only JSON matching this JSON Schema, with no other words:\n" + JSON.stringify(p.schema) : "");
          const label = (ph ? ph + " · " : "") + (p.label || "step " + (base + j + 1));
          const r = await runOne({ type, prompt, label, tag: runId + "-" + (base + j + 1) + "-", model: mdl.model, effort: mdl.effort });
          if (r.status !== "done") { done.set(p.key, { ok: null }); return; }
          const rep = reportOf(r);
          if (p.schema) { const v = schemaAnswer(rep, p.schema); done.set(p.key, { ok: v.error ? null : v.value }); } else done.set(p.key, { ok: rep });
        }));
        await saveRun(k, record);
      }
      const meta = pass && pass.meta ? pass.meta : meta0;
      const nm = meta && meta.name ? meta.name : "";
      const phases = [...byPhase.entries()].filter(([p]) => p).map(([p, n]) => p + ": " + n);
      const head = "workflow" + (nm ? " “" + nm + "”" : "") + " · runId " + runId + " · " + agentsRun + " agent" + (agentsRun === 1 ? "" : "s") + " run" + (capped ? " · " + capped + " agent() call" + (capped === 1 ? "" : "s") + " gave null: this job's cap of subagents was reached" : "")
        + (meta && meta.description ? "\nsummary: " + meta.description : "") + (phases.length ? "\nphases: " + phases.join(", ") : "") + (scriptPath ? "\nscriptPath: " + scriptPath : "");
      const logText = logs.length ? "\nlog:\n" + logs.join("\n") : "";
      if (!pass || pass.status !== "done") {
        record.status = "failed";
        const why = pass && pass.status === "pending" ? "it was still waiting after " + WORKFLOW_PASSES + " passes" : String((pass && pass.error) || "it failed");
        return { code: 1, text: "error: the " + head + "\nstopped: " + why + logText + "\n(resumeFromRunId " + runId + " reruns it and reuses the agents already done)", usage: own };
      }
      record.status = "done";
      let out; try { out = JSON.stringify(pass.result, null, 2); } catch { out = String(pass.result); }
      if (out === undefined) out = "null";
      if (out.length > WORKFLOW_RESULT_MAX) out = out.slice(0, WORKFLOW_RESULT_MAX) + "\n…(cut: " + out.length + " characters)";
      return { code: 0, text: head + logText + "\nresult:\n" + out, usage: own };
    };
    const entry = { id: taskId, name: "", description: "workflow" + (meta0 && meta0.name ? " “" + meta0.name + "”" : ""), type: "workflow", status: "running", record };
    const p = runAll().catch((e) => ({ code: 1, text: "error: " + String((e && e.message) || e).slice(0, 300), usage: own }));
    if (k.bg instanceof Map) {
      const b = { entry, done: false, out: null, kind: "workflow" };
      b.promise = p.then((x) => { b.done = true; b.out = x; entry.status = x && x.code === 0 ? "completed" : "failed"; });
      k.bg.set(taskId, b);
      say(0, "Workflow launched in the background.\ntaskId: " + taskId + " · taskType: local_workflow · runId: " + runId + (launched.workflowName ? "\nworkflowName: " + launched.workflowName : "") + (launched.summary ? "\nsummary: " + launched.summary : "") + (scriptPath ? "\nscriptPath: " + scriptPath : "") + "\nYou will be notified automatically when it completes (resumeFromRunId " + runId + " reruns it later, reusing finished agents; stop_job with " + taskId + " stops it). Do not poll for it; go on with other work or tell the owner what you launched.", "Workflow started in the background" + (launched.workflowName ? ": " + launched.workflowName : ""), { workflowResult: launched });
      return { usage };
    }
    // (No background list, as in a test's bare loop: the run is waited for, and its result is this call's answer.)
    const out = await p;
    for (const u of out.usage || []) usage.push(u);
    say(out.code, out.text, out.code === 0 ? "Workflow finished" : "", { workflowResult: launched });
    return { usage };
  }
  return no("error: unknown agent tool");
}

/**
 * TASKSTOP FOR A BACKGROUND AGENT OR WORKFLOW (Claude Code from v2.1.198: "TaskStop's task_id also accepts ... a named
 * background agent, by agent ID or name"): asks it to stop. → the stopped task's JSON answer, or null when none matches.
 */
export function stopBgTask(bg, idOrName) {
  if (!(bg instanceof Map)) return null;
  const want = String(idOrName || "").trim();
  if (!want) return null;
  let hit = bg.get(want) ? [want, bg.get(want)] : [...bg.entries()].find(([, b]) => b && b.entry && b.entry.name && b.entry.name === want);
  if (!hit) return null;
  const [id, b] = hit;
  if (b.done) return { code: 1, text: "Task " + id + " is not running (status: " + (b.entry.status || "completed") + ")" };
  b.entry.stopReq = true;
  if (b.entry.record) b.entry.record.stopReq = true;
  const type = b.kind === "workflow" ? "local_workflow" : "local_agent";
  return { code: 0, text: JSON.stringify({ message: "Successfully stopped task: " + id + " (" + (b.entry.description || id) + ")", task_id: id, task_type: type }) };
}

/** The background agents that have ended: a notification for each (Claude Code's task notification), and they leave the list. */
export function takeBgAgents(bg) {
  const out = [];
  if (!(bg instanceof Map)) return out;
  for (const [id, b] of bg) {
    if (!b.done) continue;
    bg.delete(id);
    const o = b.out || { code: 1, text: "(no report)", usage: [] };
    const st = b.entry.stopReq || o.killed ? "killed" : o.code === 0 ? "completed" : "failed";
    const what = b.kind === "workflow" ? "Workflow " + (b.entry.record && b.entry.record.runId ? b.entry.record.runId : id) : "Agent “" + (b.entry.name || b.entry.description) + "”";
    out.push({ id, kind: b.kind || "agent", usage: o.usage || [], ok: o.code === 0, text: "<task-notification>\n<task-id>" + id + "</task-id>\n" + (b.kind === "workflow" ? "<task-type>local_workflow</task-type>\n" : "") + "<status>" + st + "</status>\n<summary>" + what + " " + (st === "killed" ? "was stopped" : st) + "</summary>\n" + (b.entry.outputFile ? "<output-file>" + b.entry.outputFile + "</output-file>\n" : "") + "<result>\n" + o.text + "\n</result>\n</task-notification>" });
  }
  return out;
}

/** Custom agents from the text of .claude/agents/*.md (`files`: [{ file, text }]): the definitions, and the files skipped. */
export function customAgentsFrom(files) {
  const defs = [], skipped = [];
  for (const f of Array.isArray(files) ? files : []) {
    const p = parseAgentFile(f && f.text, f && f.file);
    if (p.def) { if (!defs.some((d) => d.name === p.def.name)) defs.push(p.def); }
    else if (p.skip && p.skip !== "no frontmatter" && p.skip !== "no name") skipped.push((f && f.file) + ": " + p.skip);
  }
  return { defs: defs.slice(0, 50), skipped };
}
/** The shell script that prints each .claude/agents/*.md file, each after a mark line (read as `dev` in the chat's sandbox). */
export const AGENT_FILES_MARK = "@@CODER-AGENT-FILE ";
export function agentFilesScript() {
  // (Claude Code "scans .claude/agents/ … recursively, so you can organize definitions into subfolders"; identity comes only
  // from the name field. Sorted, so the first of two files with one name is the one kept. 2026-11-28.)
  return "find " + AGENTS_DIR + " -type f -name '*.md' 2>/dev/null | LC_ALL=C sort | head -n 100 | while IFS= read -r f; do printf '%s%s\\n' '" + AGENT_FILES_MARK + "' \"$f\"; head -c 40000 -- \"$f\"; printf '\\n'; done 2>/dev/null; true";
}
/** That script's output, as [{ file, text }]. */
export function agentFilesOf(output) {
  const out = [];
  let cur = null;
  for (const line of String(output || "").split("\n")) {
    if (line.startsWith(AGENT_FILES_MARK)) { cur = { file: line.slice(AGENT_FILES_MARK.length).trim(), lines: [] }; out.push(cur); }
    else if (cur) cur.lines.push(line);
  }
  return out.slice(0, 100).map((x) => ({ file: x.file, text: x.lines.join("\n") }));
}
/** A subagent's worktree: the script that makes one without moving the chat's shell, and the one that cleans it up when unchanged. */
export function agentWorktreeScript(name) { return "(\n" + enterNewScript(name) + "\n)"; }
export function agentWorktreeFinishScript({ path, branch }, { service = false } = {}) {
  // (`service`: on Coder's machines root removes it (worktreeNow); the shell only says it is clean, and where the main checkout is.)
  if (service) return "( cd -- " + shq(path) + " 2>/dev/null || { echo '" + MARK + " GONE'; exit 0; }\n"
    + "__main=${PWD%%/.claude/worktrees/*}\n"
    + "__files=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')\n"
    + "__commits=$(git rev-list --count HEAD --not \"$(git -C \"$__main\" rev-parse HEAD)\" 2>/dev/null || echo 0)\n"
    + "if [ \"$__files\" = 0 ] && [ \"$__commits\" = 0 ]; then echo \"" + MARK + " CLEAN $__main\"; else echo '" + MARK + " KEPT'; fi )";
  return "( cd -- " + shq(path) + " 2>/dev/null || { echo '" + MARK + " GONE'; exit 0; }\n"
    + "__main=$(dirname \"$(git rev-parse --path-format=absolute --git-common-dir)\")\n"
    + "__files=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')\n"
    + "__commits=$(git rev-list --count HEAD --not \"$(git -C \"$__main\" rev-parse HEAD)\" 2>/dev/null || echo 0)\n"
    + "if [ \"$__files\" = 0 ] && [ \"$__commits\" = 0 ]; then cd -- \"$__main\" && git worktree remove --force " + shq(path) + " >/dev/null 2>&1; " + (branch ? "git branch -D " + shq(branch) + " >/dev/null 2>&1; " : "") + "echo '" + MARK + " REMOVED'; else echo '" + MARK + " KEPT'; fi )";
}
