// CLAUDE CODE'S AGENT, SUBAGENTHANDBACK, LISTAGENTS, SENDMESSAGE AND WORKFLOW TOOLS FOR CODER (2026-11-23).
//
// Claude Code's tools reference: Agent "Spawns a subagent with its own context window to handle a task"; SubagentHandback
// "Delivers a subagent's final report to whichever conversation receives that subagent's result"; ListAgents "Lists the
// agents Claude can message with SendMessage"; SendMessage "Sends a message to another agent: ... a subagent it resumes by
// agent ID or name"; Workflow "Runs a dynamic workflow: a script that orchestrates many subagents ... and returns one
// consolidated result". In Coder their names are agent, subagent_handback, list_agents, send_message and workflow
// (coder-hooks.mjs CC_TOOL gives hooks Claude Code's names). A subagent runs on Coder's own loop (runCoder) the way
// Gloopy's helpers do, with the chat's model and effort (Low when the chat has none).
//
// COST CAPS (the owner: Grok spend): a job runs at most CODER_MAX_SUBAGENTS_AT_ONCE (3) subagents at the same time and
// CODER_MAX_SUBAGENTS_TOTAL (10) runs in all, a workflow's agents and resumed agents included.
//
// A WORKFLOW'S SCRIPT never runs in Coder's service: it runs as `dev` in the chat's sandbox (coder-tools.mjs workflow_step),
// over and over, as Claude Code relaunches a run: each pass gets the results of the agent() calls done so far and stops at
// the calls still to do; the service runs those as subagents and passes again. Date.now(), Math.random() and new Date() with
// no argument throw, as in Claude Code, so every pass makes the same calls.
import vm from "node:vm";

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
  "general-purpose": { tools: ["bash", "read", "edit", "write", "notebook_edit", "grep", "glob", "web_fetch", "web_search"], note: "" },
  Explore: { tools: ["bash", "read", "grep", "glob", "web_fetch", "web_search"], note: "You are an Explore agent: search and read only. Never change a file: no edits, no writes, no commands that change anything (no installs, no git commit, no rm, no redirects into files)." },
  Plan: { tools: ["bash", "read", "grep", "glob", "web_fetch", "web_search"], note: "You are a Plan agent: research the code and design an implementation plan (the steps, the files, the risks). Never change a file: no edits, no writes, no commands that change anything." },
});

const capsWords = "at most 3 subagents run at the same time and at most 10 in all for one job (the machine's CODER_MAX_SUBAGENTS_AT_ONCE and CODER_MAX_SUBAGENTS_TOTAL can change these); a workflow's agents and a resumed agent count too, and a call past the cap is refused";

/** Claude Code's Agent tool, its inputs (AgentInput) and its description, in Coder's words. */
export const AGENT_TOOL = Object.freeze({ type: "function", function: {
  name: "agent",
  description: "Launch a new agent to handle complex, multi-step tasks autonomously. The agent (a subagent) works in its own conversation with its own tools, then returns one final report as this call's answer; you don't see its steps (the owner sees them in the chat). Available agent types: general-purpose (every file, command and web tool: research, multi-step changes), Explore (read-only: find files, search code, answer questions about the codebase), Plan (read-only: design an implementation plan). The agent starts fresh: the prompt is all it knows of this chat, so give it everything it needs (paths, errors, decisions) and say exactly what to report back. Use it for a task big or separate enough to keep out of your own context; for one quick search or edit, do it yourself. Several agent calls in one message run one after another; to run agents side by side, use workflow's parallel(). Each agent uses Grok with this chat's model and effort: " + capsWords + ". The answer ends with the agent's id: send_message with that id (or its name) continues the same agent with its whole history.",
  parameters: { type: "object", properties: {
    description: { type: "string", description: "A short (3-5 word) description of the task" },
    prompt: { type: "string", description: "The task for the agent to perform" },
    subagent_type: { type: "string", enum: Object.keys(AGENT_TYPES), description: "The type of specialized agent to use for this task (general-purpose when left out)" },
    name: { type: "string", description: "A name for the agent, so send_message can reach it by name" },
    run_in_background: { type: "boolean", description: "Accepted for Claude Code's input; in Coder the agent always finishes before this call answers" },
    model: { type: "string", description: "Ignored: agents use this chat's model" },
    effort: { type: "string", description: "Ignored: agents use this chat's effort" },
  }, required: ["description", "prompt"] },
} });

/** Claude Code's SubagentHandback: a subagent's report, delivered once, which ends its run. Only a subagent has it. */
export const SUBAGENT_HANDBACK_TOOL = Object.freeze({ type: "function", function: {
  name: "subagent_handback",
  description: "Deliver your final report to the agent that started you. Use it once, when your work is complete: subagent_handback({message: <your full report>}). The call ends your run, so do everything else first and put everything your caller needs in that one report. It is not a messaging channel: no progress updates or questions. If you finish without it, your last words are taken as your report.",
  parameters: { type: "object", properties: { message: { type: "string", description: "Your full report for your caller" } }, required: ["message"] },
} });

/** Claude Code's ListAgents: the agents send_message can reach in this job. */
export const LIST_AGENTS_TOOL = Object.freeze({ type: "function", function: {
  name: "list_agents",
  description: "List the agents you can message with send_message: the subagents this job started (their id, name, type, status and task). The first line is this chat itself (main). Coder has no agent teams and no other sessions to message.",
  parameters: { type: "object", properties: {}, required: [] },
} });

/** Claude Code's SendMessage, to a subagent (resumed with its whole history). Held back until tool_search loads it. */
export const SEND_MESSAGE_TOOL = Object.freeze({ type: "function", function: {
  name: "send_message",
  description: "Send a message to an agent this job started (by its id or name, as list_agents shows them): a finished agent resumes with its full conversation history (every earlier tool call, result and reasoning), works on the message, and its new report is this call's answer. Use it to continue an agent's work instead of starting over. A resumed run counts against the job's cap of subagents (" + capsWords + "). summary: an optional 5-10 word preview the owner sees.",
  parameters: { type: "object", properties: {
    to: { type: "string", description: "The agent's id or name" },
    message: { type: "string", description: "The message" },
    summary: { type: "string", description: "A 5-10 word preview of the message" },
  }, required: ["to", "message"] },
} });

/** Claude Code's Workflow tool, its inputs (WorkflowInput) and its description, in Coder's words. */
export const WORKFLOW_TOOL = Object.freeze({ type: "function", function: {
  name: "workflow",
  description: "Run a dynamic workflow: a script that orchestrates many subagents and returns one consolidated result. Use it only when the owner asks for a workflow or a task needs the same step over many items (an audit of many files, a migration, cross-checked research). The script must begin with `export const meta = { name: '...', description: '...' }` (a literal), then plain JavaScript with top-level await: `await agent(prompt, { label, schema, subagent_type })` runs one subagent and gives its report (with `schema`, a JSON Schema, the parsed JSON it returns), or null when it failed or the cap was reached; `parallel([() => agent(...), ...])` runs several at once and waits for all; `pipeline(items, (item) => agent(...))` runs one per item; `phase(title)` and `log(message)` show progress; `args` is the input; `return` the result. Date.now(), Math.random() and new Date() with no argument throw (pass a time in args). The script runs in the chat's sandbox, not with your tools. In Coder the run finishes before this call answers. The answer gives a runId: resumeFromRunId with it reruns a script and reuses the agent() calls already done with the same input. Limits: " + capsWords + ".",
  parameters: { type: "object", properties: {
    script: { type: "string", description: "Inline workflow script, beginning with export const meta = { name, description }" },
    name: { type: "string", description: "Name of a workflow saved in .claude/workflows/<name>.js" },
    scriptPath: { type: "string", description: "Path to a workflow script file; takes precedence over script and name" },
    args: { description: "Input value exposed to the script as the global args (pass arrays and objects as JSON values, not a JSON string)" },
    resumeFromRunId: { type: "string", description: "Run id of an earlier workflow run in this job to resume" },
    title: { type: "string", description: "Ignored; the script's meta block sets the title" },
    description: { type: "string", description: "Ignored; the script's meta block sets the description" },
  }, required: [] },
} });

/** A subagent's instructions (Claude Code's general-purpose agent's, in Coder's words). */
export const SUBAGENT_SYSTEM = `You are an agent for Coder, the owner's AI coding assistant on gofarther.dev. Coder gave you one task: use the tools available to complete it. Complete the task fully: don't gold-plate, but don't leave it half-done.

- Your strengths: searching for code, configurations and patterns across large codebases; analyzing several files to understand a system; investigating questions that need many files; multi-step research and changes.
- Search broadly when you don't know where something lives; read when you know the path. Prefer editing an existing file to creating one. Never write report files: your report is your answer.
- Never ask the owner anything: you can't reach them. A step that needs their OK is refused; say so in your report.
- When you are done, call subagent_handback with your full report for Coder (what you did, what you found, the relevant file paths). It ends your run. Coder relays what matters to the owner, so give the essentials, with no emojis.`;

/** The tools a subagent of `type` gets from `coderTools` (Coder's own definitions), and subagent_handback. */
export function subagentTools(coderTools, type) {
  const want = (AGENT_TYPES[type] || AGENT_TYPES["general-purpose"]).tools;
  const list = Array.isArray(coderTools) ? coderTools : [...(coderTools || [])];
  return [...want.map((n) => list.find((t) => t && t.function && t.function.name === n)).filter(Boolean), SUBAGENT_HANDBACK_TOOL];
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
  const keyOf = (prompt, opts) => { const base = JSON.stringify([prompt, opts.schema || null, opts.subagent_type || ""]); const n = seen.get(base) || 0; seen.set(base, n + 1); return base + "#" + n; };
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
    const key = keyOf(p, { schema, subagent_type: type });
    if (cache.has(key)) { const r = cache.get(key) || {}; return r.error ? bad(String(r.error)) : ok(clone(JSON.stringify(r.ok ?? null))); }
    pending.push({ key, prompt: p.slice(0, 20_000), label: typeof o.label === "string" ? o.label.slice(0, 80) : "", ...(schema ? { schema } : {}), ...(type ? { subagent_type: type } : {}) });
    return never();
  };
  ctx.__agent = agent;
  ctx.__log = (m) => { if (logs.length < 200) logs.push(String(m).slice(0, 500)); };
  ctx.__phase = (t) => { if (logs.length < 200) logs.push("## " + String(t).slice(0, 120)); };
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

const oneLine = (v, n) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
/** A subagent's steps in the chat: under its own id and name, as Gloopy's helpers' are. */
export function taggedEmit(emit, tag, label) {
  return (e) => {
    if (typeof emit !== "function" || !e) return;
    if (e.type === "bash" || e.type === "result") emit({ ...e, id: tag + e.id, ...(e.type === "bash" ? { command: "“" + label + "” · " + String(e.command || "") } : {}), ...(e.type === "result" && typeof e.label === "string" && e.label ? { label: "“" + label + "” · " + e.label } : {}) });
    else if (e.type === "paused") emit({ ...e, why: "Its agent “" + label + "”: " + String(e.why || "") });
  };
}

/**
 * ONE CALL OF agent, subagent_handback, list_agents, send_message OR workflow (from coder-agent.mjs's loop). `k`:
 *  emit, reply(text), budget (subagentBudget), agents (Map, the job's), runs (Map, the job's workflow runs),
 *  isSub (this loop is a subagent's), startSub({ type, prompt, messages, label, emit }) → a runCoder result,
 *  step(args) → a workflowStep pass, readText(path) → { text } | { error }, stopped() → boolean.
 * → { usage: [...], stop?: true, handback?: string }.
 */
export async function agentToolCall(c, k) {
  const args = c && c.args && typeof c.args === "object" ? c.args : {};
  const usage = [];
  const emit = typeof k.emit === "function" ? k.emit : () => {};
  const stopped = async () => { try { return typeof k.stopped === "function" && (await k.stopped()) === true; } catch { return false; } };
  const say = (code, out, label) => { emit({ type: "result", id: c.id, code, output: String(out).slice(0, 20_000), ...(label ? { label } : {}) }); k.reply(out); };
  const no = (m) => { say(1, m); return { usage }; };
  const capNote = () => "error: this job's cap of subagents is reached (" + k.budget.caps.total + " in all; " + TOTAL_VAR + " changes it). Do the rest yourself.";
  const run = async ({ type, prompt, messages, label, tag }) => {
    const r = await k.budget.run(() => Promise.resolve().then(() => k.startSub({ type, prompt, messages, label, emit: taggedEmit(emit, tag, label) })).catch((e) => ({ status: "error", messages: [], usage: [], summary: String((e && e.message) || e).slice(0, 300) })));
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
    for (const a of k.agents.values()) lines.push("- " + a.id + (a.name ? " (" + a.name + ")" : "") + " · " + a.type + " · " + a.status + " · " + a.description);
    say(0, lines.join("\n") + "\n\nSubagents left in this job: " + k.budget.left() + " of " + k.budget.caps.total + " (at most " + k.budget.caps.atOnce + " at once).");
    return { usage };
  }

  if (c.name === "agent") {
    const description = oneLine(args.description, 80), prompt = String(args.prompt ?? "").trim();
    const type = args.subagent_type === undefined || args.subagent_type === "" ? "general-purpose" : String(args.subagent_type);
    emit({ type: "bash", id: c.id, tool: "agent", verb: "Started an agent", command: description || oneLine(prompt, 80) });
    if (k.isSub) return no("error: a subagent can't start agents of its own");
    if (!prompt) return no("error: give prompt: the task for the agent");
    if (!AGENT_TYPES[type]) return no("error: subagent_type is one of " + Object.keys(AGENT_TYPES).join(", "));
    const name = oneLine(args.name, 40);
    if (name && [...k.agents.values()].some((a) => a.name === name)) return no("error: an agent named “" + name + "” already exists: send_message continues it");
    if (!k.budget.take()) return no(capNote());
    const id = "agent-" + (k.agents.size + 1);
    const entry = { id, name, type, description: description || oneLine(prompt, 80), status: "running", messages: [], sends: 0 };
    k.agents.set(id, entry);
    const r = await run({ type, prompt, messages: [], label: name || entry.description, tag: id + "-" });
    entry.status = statusWords(r.status); entry.messages = r.messages || [];
    say(r.status === "done" ? 0 : 1, (reportOf(r) || "(no report)").slice(0, SUBAGENT_REPORT_MAX) + "\n\nagentId: " + id + (name ? " (name: " + name + ")" : "") + " · " + entry.status + " · send_message continues it", "Agent finished: " + entry.description);
    return { usage, ...(r.status === "stopped" ? { stop: true } : {}) };
  }

  if (c.name === "send_message") {
    const to = oneLine(args.to, 80), message = String(args.message ?? "").trim();
    emit({ type: "bash", id: c.id, tool: "agent", verb: "Messaged an agent", command: (to + (args.summary ? ": " + oneLine(args.summary, 80) : "")).slice(0, 120) });
    if (k.isSub) return no("error: a subagent can't message agents");
    if (!to || !message) return no("error: give to (an agent's id or name) and message");
    if (to === "main") return no("error: main is you");
    const a = k.agents.get(to) || [...k.agents.values()].find((x) => x.name === to);
    if (!a) return no("error: no agent is called " + to + " (list_agents shows them). Coder has no agent teams or other sessions to message.");
    if (!k.budget.take()) return no(capNote());
    a.status = "running"; a.sends++;
    const r = await run({ type: a.type, prompt: message, messages: resumable(a.messages), label: a.name || a.description, tag: a.id + "-m" + a.sends + "-" });
    a.status = statusWords(r.status); if (Array.isArray(r.messages) && r.messages.length) a.messages = r.messages;
    say(r.status === "done" ? 0 : 1, (reportOf(r) || "(no report)").slice(0, SUBAGENT_REPORT_MAX) + "\n\nagentId: " + a.id + " · " + a.status, "Agent answered: " + (a.name || a.description));
    return { usage, ...(r.status === "stopped" ? { stop: true } : {}) };
  }

  if (c.name === "workflow") {
    emit({ type: "bash", id: c.id, tool: "workflow", verb: "Ran a workflow", command: oneLine(args.scriptPath || args.name || args.resumeFromRunId || "inline script", 120) });
    if (k.isSub) return no("error: a subagent can't run workflows");
    const prev = typeof args.resumeFromRunId === "string" && args.resumeFromRunId ? k.runs.get(args.resumeFromRunId) : null;
    if (args.resumeFromRunId && !prev) return no("error: no workflow run " + oneLine(args.resumeFromRunId, 40) + " in this job");
    let script = "";
    if (typeof args.scriptPath === "string" && args.scriptPath.trim()) {
      const got = await k.readText(args.scriptPath.trim());
      if (got.error) return no("error: " + got.error);
      script = got.text;
    } else if (typeof args.name === "string" && args.name.trim()) {
      const nm = args.name.trim().replace(/\.js$/, "");
      if (!/^[\w-]{1,80}$/.test(nm)) return no("error: name is a workflow's name in .claude/workflows/");
      const got = await k.readText(".claude/workflows/" + nm + ".js");
      if (got.error) return no("error: " + got.error);
      script = got.text;
    } else if (typeof args.script === "string" && args.script.trim()) script = args.script;
    else if (prev) script = prev.script;
    else return no("error: give script, name or scriptPath");
    const input = args.args === undefined && prev ? prev.args : args.args;
    // (Resumed: the agent() calls already done are reused; a call's key holds its prompt and options, so one whose input
    // changed is run again, as Claude Code's resumeFromRunId does.)
    const done = new Map(prev ? prev.done : []);
    const runId = "wf-" + (k.runs.size + 1);
    const record = { runId, script, args: input, done, status: "running" };
    k.runs.set(runId, record);
    let pass = null, agentsRun = 0, capped = 0, logs = [];
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
        const type = AGENT_TYPES[p.subagent_type] ? p.subagent_type : "general-purpose";
        const prompt = p.prompt + (p.schema ? "\n\nYour report (subagent_handback's message) must be only JSON matching this JSON Schema, with no other words:\n" + JSON.stringify(p.schema) : "");
        const label = p.label || "step " + (base + j + 1);
        const r = await run({ type, prompt, messages: [], label, tag: runId + "-" + (base + j + 1) + "-" });
        if (r.status !== "done") { done.set(p.key, { ok: null }); return; }
        const rep = reportOf(r);
        if (p.schema) { const v = schemaAnswer(rep, p.schema); done.set(p.key, { ok: v.error ? null : v.value }); } else done.set(p.key, { ok: rep });
      }));
    }
    const nm = pass && pass.meta && pass.meta.name ? pass.meta.name : "";
    const head = "workflow" + (nm ? " “" + nm + "”" : "") + " · runId " + runId + " · " + agentsRun + " agent" + (agentsRun === 1 ? "" : "s") + " run" + (capped ? " · " + capped + " agent() call" + (capped === 1 ? "" : "s") + " gave null: this job's cap of subagents was reached" : "");
    const logText = logs.length ? "\nlog:\n" + logs.join("\n") : "";
    if (!pass || pass.status !== "done") {
      record.status = "failed";
      const why = pass && pass.status === "pending" ? "it was still waiting after " + WORKFLOW_PASSES + " passes" : String((pass && pass.error) || "it failed");
      say(1, "error: the " + head + " stopped: " + why + logText + "\n(resumeFromRunId " + runId + " reruns it and reuses the agents already done)");
      return { usage };
    }
    record.status = "done";
    let out; try { out = JSON.stringify(pass.result, null, 2); } catch { out = String(pass.result); }
    if (out === undefined) out = "null";
    if (out.length > WORKFLOW_RESULT_MAX) out = out.slice(0, WORKFLOW_RESULT_MAX) + "\n…(cut: " + out.length + " characters)";
    say(0, head + logText + "\nresult:\n" + out, "Workflow finished" + (nm ? ": " + nm : ""));
    return { usage };
  }
  return no("error: unknown agent tool");
}
