/**
 * CLAUDE CODE'S TOOL SEARCH, IN CODER'S CHATS (the owner, 2026-11-14: "yes start on that", after "did we got evryihng from
 * the claude code docs for these tools"). Claude Code 2.1.325 holds some tools back ("deferred"): only their names reach the
 * model, in a message from the system, and the model loads the ones it needs with its ToolSearch tool, whose result is the
 * loaded tools' full definitions. Its docs (mcp "Scale with MCP tool search", agent-sdk "Scale to many tools with tool
 * search", env-vars ENABLE_TOOL_SEARCH, tools-reference ToolSearch) and, where they say nothing, its own program:
 *
 * - WHICH TOOLS: every MCP tool (Coder's connectors) unless its server marks it "anthropic/alwaysLoad", and the built-in
 *   tools whose definition says `shouldDefer: true` (its Rnt/p): LSP, WebFetch, WebSearch, Monitor, TaskStop, TodoWrite,
 *   TaskCreate, TaskGet, TaskList, TaskUpdate, EnterPlanMode and ExitPlanMode, here Coder's lsp, web_fetch, web_search,
 *   monitor, stop_job, todo_write, task_create, task_get, task_list, task_update, enter_plan_mode and exit_plan_mode.
 *   Bash, Read, Edit, Write, Grep, Glob, AskUserQuestion and PowerShell load upfront, and so do Claude Code's cloud tools
 *   (its claude-code-remote server's get_environment, update_environment, create_environment, switch_environment,
 *   list_environments and request_credential: a Claude Code cloud session read on 2026-11-14 lists them with the tools
 *   loaded upfront, not with the deferred ones), here request_secret and the environment tools. Coder's own tools that
 *   Claude Code has no copy of (review, pr_comments, undo_last_job, auto_fix, notify, reply_review, pull_request) stay
 *   upfront too.
 * - ITS SWITCH, ENABLE_TOOL_SEARCH (its zde, Xpt and tzs): unset or true, on; false, off; auto, on once the definitions it
 *   can defer reach 10% of the context window (auto:N, N%; auto:0 always on, auto:100 never), and on for good in a
 *   conversation that already had it. Unset, a conversation that already ran without it stays without it until it is
 *   summarized ("held_off"). A deny rule on ToolSearch turns it off ("ToolSearchTool is not available"), and with nothing
 *   to defer it is off ("no deferred tools available to search").
 * - THE REQUEST'S TOOLS (its request builder): the upfront tools, ToolSearch, and the deferred tools the conversation has
 *   loaded, nothing else; the rest are named in the announcement ("deferred_tools_delta"): "The following deferred tools
 *   are now available via ToolSearch. …", sorted, once, and again only for a change.
 * - A LOADED TOOL STAYS (its TW): for the rest of the conversation, found again in the messages each time, and carried
 *   through a summary on the summary's message (its compact boundary's preCompactDiscoveredTools).
 *
 * Coder keeps its conversation in xAI's request shape, which has no deferred definitions: a tool not loaded is left out of
 * the request's tools, and a load adds it after the others, in the order loaded, so the request's start (and Grok's prompt
 * cache) changes only when a new tool is loaded, and only from that tool on.
 *
 * No Node module here: Coder's Worker loads this file, through the summaries' module (coder-compact.mjs).
 */
import { inputErrorText, typeIssue } from "./coder-zodtext.mjs";

/** The tool's name in Coder (Claude Code's ToolSearch). */
export const TOOL_SEARCH = "tool_search";

/** Coder's tools that Claude Code 2.1.325 defers (its built-in tools with `shouldDefer: true`), in Coder's names. */
export const DEFERRED_TOOLS = Object.freeze(["lsp", "web_fetch", "web_search", "monitor", "stop_job", "todo_write", "task_create", "task_get", "task_list", "task_update", "enter_plan_mode", "exit_plan_mode"]);

/** Their search hints, Claude Code's own (its `searchHint`, matched by a keyword search), with Coder's swaps. */
export const SEARCH_HINTS = Object.freeze({
  lsp: "code intelligence (definitions, references, symbols, hover)",
  web_fetch: "fetch and extract content from a URL",
  web_search: "search the web for current information",
  stop_job: "kill a running background task",
  todo_write: "manage the chat task checklist",
  task_create: "create a task in the task list",
  task_get: "retrieve a task by ID",
  task_list: "list all tasks",
  task_update: "update a task",
  enter_plan_mode: "switch to plan mode to design an approach before coding",
  exit_plan_mode: "present plan for approval and start coding (plan mode only)",
});

/**
 * ITS DESCRIPTION, WORD FOR WORD (2.1.325's lRo, as a Claude Code cloud session gives it: "Deferred tools appear by name in
 * a message from the system", and " Until fetched, only the name is known — there is no parameter schema, so the tool
 * cannot be invoked."), with Coder's tool names in its example.
 */
export const TOOL_SEARCH_DESCRIPTION = "Fetches full schema definitions for deferred tools so they can be called.\n\nDeferred tools appear by name in a message from the system. Until fetched, only the name is known — there is no parameter schema, so the tool cannot be invoked. This tool takes a query, matches it against the deferred tool list, and returns the matched tools' complete JSONSchema definitions inside a <functions> block. Once a tool's schema appears in that result, it is callable exactly like any tool defined at the top of the prompt.\n\nResult format: each matched tool appears as one <function>{\"description\": \"...\", \"name\": \"...\", \"parameters\": {...}}</function> line inside the <functions> block — the same encoding as the tool list at the top of this prompt.\n\nQuery forms:\n- \"select:read,edit,grep\" — fetch these exact tools by name\n- \"notebook jupyter\" — keyword search, up to max_results best matches\n- \"+slack send\" — require \"slack\" in the name, rank by remaining terms";
/** Its inputs, as Claude Code sends them (max_results has a default, so its schema lists it as required). */
export const TOOL_SEARCH_PARAMS = Object.freeze({
  type: "object",
  properties: {
    query: { type: "string", description: "Query to find deferred tools. Use \"select:<tool_name>\" for direct selection, or keywords to search." },
    max_results: { type: "number", default: 5, description: "Maximum number of results to return (default: 5)" },
  },
  required: ["query", "max_results"],
  additionalProperties: false,
});
export const TOOL_SEARCH_TOOL = Object.freeze({ type: "function", function: { name: TOOL_SEARCH, description: TOOL_SEARCH_DESCRIPTION, parameters: TOOL_SEARCH_PARAMS } });

// ── ITS WORDS ───────────────────────────────────────────────────────────────────────────────────────────────────────────
/** A search that loads nothing. */
export const NO_MATCH = "No matching deferred tools found";
/** The announcement (its O_i), then the names, one a line. */
export const DEFERRED_NOW = "The following deferred tools are now available via tool_search. Their schemas are NOT loaded — calling them directly will fail with InputValidationError. Use tool_search with query \"select:<name>[,<name>...]\" to load tool schemas before calling them:";
/** Announced tools that left the chat's tools (its removed names: other tools, and MCP tools, each its own words). */
export const DEFERRED_GONE = "The following deferred tools are no longer available in this chat. Do not search for them — tool_search will return no match:";
export const DEFERRED_GONE_MCP = "The following deferred tools are no longer available (their MCP server disconnected). Do not search for them — tool_search will return no match:";
/** Past this many MCP names, they go by server (its bm and Gle). */
export const NAMES_LISTED_MAX = 30;
/** After a removal (its u$). */
export const AMBIENT = "This is ambient context — do not narrate it to the owner unless they ask or it is directly relevant to their request.";
/** A keyword search that names a tool already loaded upfront (its fo). */
export const alreadyAvailable = (names) => "Already available in this conversation: " + listed(names) + ". " + (names.length === 1 ? "Call it" : "Call whichever you need") + " directly.";
/** A deferred tool called before it was loaded, with an input its schema refuses (its rWs, after the error). */
export function notLoadedHint(def) {
  const name = def && def.function ? def.function.name : "";
  let schema = "";
  try { schema = " For reference, this tool's input schema is: " + JSON.stringify(def.function.parameters); } catch { schema = ""; }
  return "\n\nThis tool's schema was not sent to the API — it was not in the discovered-tool set derived from message history. Without the schema in your prompt, typed parameters (arrays, numbers, booleans) get emitted as strings and the client-side parser rejects them. Load the tool first: call " + TOOL_SEARCH + " with query \"select:" + name + "\", then retry this call." + schema;
}
const listed = (names) => names.slice(0, NAMES_LISTED_MAX).join(", ") + (names.length > NAMES_LISTED_MAX ? ", and " + (names.length - NAMES_LISTED_MAX) + " more" : "");

// ── ITS SWITCH ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const truthy = (v) => ["1", "true", "yes", "on"].includes(String(v).toLowerCase().trim());
const falsy = (v) => ["0", "false", "no", "off"].includes(String(v).toLowerCase().trim());
/** auto:N's N (its tzs and qp): a whole number from 0 to 100, or null (not auto:N, or N is no number: then 10%). */
export function autoPercent(value) {
  const e = String(value);
  if (!e.startsWith("auto:")) return null;
  const s = e.slice(5).trim();
  let n;
  if (/^[+-]?\d+(\.\d+)?$/.test(s)) { n = Number(s); if (!Number.isInteger(n)) n = NaN; }
  else if (/^\d{1,3}(,\d{3})+$/.test(s)) n = parseInt(s.replace(/,/g, ""), 10);
  else n = parseInt(s, 10);
  return Number.isNaN(n) ? null : Math.max(0, Math.min(100, n));
}
/**
 * ENABLE_TOOL_SEARCH AS CLAUDE CODE READS IT (its zde): "tst" (on), "tst-auto" (on past the threshold) or "standard" (off),
 * and auto's percentage (its Xpt: 10 unless auto:N gives one).
 */
export function searchMode(value) {
  const e = value === undefined || value === null ? "" : String(value);
  const n = e ? autoPercent(e) : null;
  if (n === 0) return { mode: "tst", pct: 0 };
  if (n === 100) return { mode: "standard", pct: 100 };
  if (e === "auto" || e.startsWith("auto:")) return { mode: "tst-auto", pct: n === null ? AUTO_PERCENT : n };
  if (truthy(e)) return { mode: "tst", pct: AUTO_PERCENT };
  if (e && falsy(e)) return { mode: "standard", pct: AUTO_PERCENT };
  return { mode: "tst", pct: AUTO_PERCENT };
}
export const AUTO_PERCENT = 10;
/** Grok 4.7's context, in tokens (xAI's model list: maxPromptLength 500,000). */
export const GROK_CONTEXT_TOKENS = 500_000;
/** Claude Code's count of the deferrable definitions in characters, at 2.5 a token (its char fallback, LQr). */
export const AUTO_CHARS_PER_TOKEN = 2.5;
/** auto's threshold in characters (its NQr): 125,000 at 10% of Grok 4.7's context. */
export const autoThreshold = (pct = AUTO_PERCENT, tokens = GROK_CONTEXT_TOKENS) => Math.floor(Math.floor(tokens * (pct / 100)) * AUTO_CHARS_PER_TOKEN);
/** One definition's size as Claude Code counts it (its BQr): name, description and input schema. */
export const definitionChars = (def) => { const f = (def && def.function) || {}; return String(f.name || "").length + String(f.description || "").length + JSON.stringify(f.parameters || {}).length; };

// ── THE CHAT'S RECORD: what its messages say of tool search ─────────────────────────────────────────────────────────────
// A tool_search result keeps the deferred tools it loaded (`toolsLoaded`), an announcement the names it added and removed
// (`toolsAnnounced`), and a summary the tools loaded in what it stands for (`toolsLoaded`, always there) and whether tool
// search was on there (`toolSearchOn`). None of these fields reach Grok (coder-model.mjs sends only a message's own parts).
const names = (a) => (Array.isArray(a) ? a.filter((x) => typeof x === "string" && x) : []);
/** The deferred tools some messages loaded (a summary's carried ones included), in the order first loaded: for a summary. */
export function toolsLoadedIn(messages) {
  const out = new Set();
  for (const m of Array.isArray(messages) ? messages : []) if (m && typeof m === "object") for (const n of names(m.toolsLoaded)) out.add(n);
  return [...out];
}
/** Whether tool search was on in some messages: for a summary of them. */
export function toolSearchOnIn(messages) {
  return (Array.isArray(messages) ? messages : []).some((m) => m && typeof m === "object" && ((m.role === "tool" && Array.isArray(m.toolsLoaded)) || (m.toolsAnnounced && typeof m.toolsAnnounced === "object") || m.toolSearchOn === true));
}
/**
 * WHAT A CHAT'S MESSAGES SAY: the deferred tools loaded (`loaded`), the names announced and not taken back (`announced`),
 * whether tool search was on (`declared`), and whether the chat already ran without it (`ranWithout`: it has answers, no
 * sign of tool search, and no summary made since Coder has it, which starts it afresh, as Claude Code's compaction does).
 */
export function toolSearchRecord(messages) {
  const loaded = new Set(), announced = new Set();
  let declared = false, answered = false, summarized = false;
  for (const m of Array.isArray(messages) ? messages : []) {
    if (!m || typeof m !== "object") continue;
    if (m.role === "assistant") answered = true;
    if (Array.isArray(m.toolsLoaded)) {
      for (const n of names(m.toolsLoaded)) loaded.add(n);
      if (m.role === "tool") declared = true; else summarized = true;
    }
    if (m.toolSearchOn === true) declared = true;
    if (m.toolsAnnounced && typeof m.toolsAnnounced === "object") {
      declared = true;
      for (const n of names(m.toolsAnnounced.added)) announced.add(n);
      for (const n of names(m.toolsAnnounced.removed)) announced.delete(n);
    }
  }
  return { loaded, announced, declared, ranWithout: answered && !declared && !summarized };
}

// ── ON OR OFF, FOR ONE JOB ──────────────────────────────────────────────────────────────────────────────────────────────
/**
 * WHETHER THE JOB USES TOOL SEARCH (its Hbo, then its request builder's "no deferred tools available to search"): `value`
 * the chat's ENABLE_TOOL_SEARCH, `record` toolSearchRecord, `deferred` the definitions it would defer, `denied` a deny rule
 * on ToolSearch. `{ on, why }`, `why` in Claude Code's words for its decision.
 */
export function decideToolSearch({ value, record, deferred = [], denied = false } = {}) {
  const rec = record || { declared: false, ranWithout: false };
  if (denied) return { on: false, why: "mcp_search_unavailable" };
  const { mode, pct } = searchMode(value);
  if (mode === "standard") return { on: false, why: "standard_mode" };
  const unset = value === undefined || value === null || value === "";
  if (unset && rec.ranWithout) return { on: false, why: "held_off" };
  if (mode === "tst-auto" && !rec.declared) {
    const chars = deferred.reduce((n, d) => n + definitionChars(d), 0);
    if (chars < autoThreshold(pct)) return { on: false, why: "auto_below_threshold" };
  }
  if (!deferred.length && !rec.declared) return { on: false, why: "no_deferred_tools" };
  return { on: true, why: mode === "tst-auto" ? (rec.declared ? "auto_held" : "auto_above_threshold") : "tst_enabled" };
}

// ── THE REQUEST'S TOOLS ─────────────────────────────────────────────────────────────────────────────────────────────────
export const isMcpName = (n) => typeof n === "string" && n.startsWith("mcp__");
/** A connector tool's server and tool (its Qn): "mcp__linear__create_issue" → { server: "linear", tool: "create_issue" }. */
export function mcpParts(name) {
  if (!isMcpName(name)) return null;
  const s = name.slice(5), i = s.indexOf("__");
  return i < 0 ? { server: s, tool: "" } : { server: s.slice(0, i), tool: s.slice(i + 2) };
}
/** Whether a tool of the chat's is deferred: one of DEFERRED_TOOLS, or a connector's not marked to load upfront. */
export const isDeferred = (name, upfront = new Set()) => DEFERRED_TOOLS.includes(name) || (isMcpName(name) && !upfront.has(name));
/**
 * The tools the request sends: the chat's tools less the deferred ones not loaded (its request builder: "if(!vs.has(
 * _s.name))return!0; … return eo.has(_s.name)"): the upfront ones in the chat's order, then the loaded ones in the order
 * they were first loaded (`loaded`, a Set, keeps it). The same chat gives the same list, and a load only adds a tool at
 * its end, so Grok's prompt cache keeps everything before it.
 */
export function requestTools(pool, deferred, loaded) {
  const list = (Array.isArray(pool) ? pool : []).filter((t) => t && t.function && t.function.name);
  const up = list.filter((t) => !deferred.has(t.function.name));
  const later = [...loaded].filter((n) => deferred.has(n)).map((n) => list.find((t) => t.function.name === n)).filter(Boolean);
  return [...up, ...later];
}

// ── THE ANNOUNCEMENT ────────────────────────────────────────────────────────────────────────────────────────────────────
/** MCP names by server past NAMES_LISTED_MAX (its Gle): "mcp__linear__* (40), mcp__notion__*". */
export function byServer(list) {
  const n = new Map();
  for (const x of list) { const k = isMcpName(x) ? x.split("__", 2).join("__") + "__*" : x; n.set(k, (n.get(k) || 0) + 1); }
  return [...n.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, c]) => (c > 1 ? k + " (" + c + ")" : k)).join(", ");
}
/**
 * WHAT THE CHAT IS TOLD OF ITS DEFERRED TOOLS (Claude Code's deferred_tools_delta, as its attachment renders it): the
 * deferred tools not yet announced nor loaded, sorted, one a line; announced ones gone from the chat's tools, MCP ones
 * first; then, after a removal, its ambient line; its parts a blank line apart. A note of Coder's app, with its record
 * (`toolsAnnounced`), or null when nothing changed.
 */
export function announcement({ deferred = [], loaded = new Set(), announced = new Set() } = {}) {
  const now = new Set(deferred);
  const added = [...now].filter((n) => !announced.has(n) && !loaded.has(n)).sort();
  const removed = [...announced].filter((n) => !now.has(n)).sort();
  if (!added.length && !removed.length) return null;
  const parts = [];
  if (added.length) parts.push(DEFERRED_NOW + "\n" + added.join("\n"));
  const mcp = removed.filter(isMcpName), other = removed.filter((n) => !isMcpName(n));
  if (mcp.length) parts.push(mcp.length > NAMES_LISTED_MAX ? mcp.length + " deferred tools are no longer available (MCP server disconnected): " + byServer(mcp) + ". Do not search for them — " + TOOL_SEARCH + " will return no match." : DEFERRED_GONE_MCP + "\n" + mcp.join("\n"));
  if (other.length) parts.push(DEFERRED_GONE + "\n" + other.join("\n"));
  if (removed.length) parts.push(AMBIENT);
  return { role: "user", appNote: true, content: "(Note from Coder's app, not the owner:\n" + parts.join("\n\n") + ")", toolsAnnounced: { added, removed } };
}

// ── ITS INPUT ───────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * ITS INPUT, AS CLAUDE CODE TAKES IT (z.object({ query: string, max_results: number, default 5 })): refused before any hook
 * in its words ("InputValidationError: …"), quietly (Claude Code shows no line for the tool); other keys are dropped.
 */
export function checkToolSearchInput(args) {
  const a = args && typeof args === "object" && !Array.isArray(args) ? args : null;
  if (!a) return { error: inputErrorText(TOOL_SEARCH, [typeIssue("object", args, [])]), quiet: true };
  const issues = [];
  if (typeof a.query !== "string") issues.push(typeIssue("string", a.query, ["query"]));
  if (a.max_results !== undefined && (typeof a.max_results !== "number" || Number.isNaN(a.max_results))) issues.push(typeIssue("number", a.max_results, ["max_results"]));
  if (issues.length) return { error: inputErrorText(TOOL_SEARCH, issues), quiet: true };
  return { args: { query: a.query, max_results: a.max_results === undefined ? 5 : a.max_results } };
}

// ── ITS SEARCH ──────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Its limits (its a_, n_ and o_): a query's characters, a keyword query's words, a select's names. */
export const QUERY_MAX = 16_384, WORDS_MAX = 32, SELECT_MAX = 64;
/** A connector's description as a search reads it: up to the upfront limit (the MCP docs: "it reads only the part within the shorter limit"). */
export const MATCH_DESC_MAX = 4_096;
const SELECT_RE = /^select:(.+)$/i;
const cut = (s, n) => (s.length > n ? s.slice(0, n) : s);
/** A keyword query's first WORDS_MAX words (its l_). */
const firstWords = (q) => { const n = cut(q, QUERY_MAX), w = n.trim().split(/\s+/); return w.length <= WORDS_MAX ? n : w.slice(0, WORDS_MAX).join(" "); };
/** The query as Claude Code searches with it (its COs): cut, a keyword query to its first words, a select to its first names. */
export function normalQuery(query) {
  const n = cut(String(query), QUERY_MAX);
  const r = SELECT_RE.test(n) ? n : firstWords(n);
  const s = SELECT_RE.exec(r)?.[1];
  if (s === undefined) return r;
  const h = s.split(",");
  return h.length <= SELECT_MAX ? r : r.slice(0, -s.length) + h.slice(0, SELECT_MAX).join(",");
}
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A tool's name in parts, as its keyword search splits it (its t_). */
function nameParts(name) {
  const m = mcpParts(name);
  if (m) {
    const coarse = [m.server, m.tool].filter(Boolean).map((x) => x.toLowerCase());
    const parts = coarse.flatMap((x) => x.split(/[\s_.]+/)).filter(Boolean);
    return { parts, coarse, full: parts.join(" "), isMcp: true };
  }
  const parts = name.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ").toLowerCase().split(/\s+/).filter(Boolean);
  return { parts, coarse: [name.toLowerCase()], full: parts.join(" "), isMcp: false };
}
const nameOf = (t) => (t && t.function ? String(t.function.name || "") : "");
const describe = (t) => { const d = String((t && t.function && t.function.description) || ""); return isMcpName(nameOf(t)) ? d.slice(0, MATCH_DESC_MAX) : d; };
const hintOf = (t) => String(SEARCH_HINTS[nameOf(t)] || "").slice(0, 4096).toLowerCase();
/** A tool by its name, or the connector tools of that short name (its ide). */
function byName(deferred, all, name) {
  const h = deferred.find((t) => nameOf(t) === name) || all.find((t) => nameOf(t) === name);
  if (h) return [h];
  return all.filter((t) => { const m = mcpParts(nameOf(t)); return !!m && m.tool === name; });
}
/**
 * ITS KEYWORD SEARCH (its y1t, word for word in its scores): an exact name first; a name that starts "mcp__" by its
 * start; else each deferred tool scored on the query's words (a "+word" required): in its name's parts, in its name, in
 * its search hint and in its description; the best `max` with a score above 0, ties in the chat's order.
 */
export function keywordSearch(query, deferred, all, max) {
  const k = firstWords(query).trim().toLowerCase();
  const exact = deferred.find((t) => nameOf(t).toLowerCase() === k) || all.find((t) => nameOf(t).toLowerCase() === k);
  if (exact) return [nameOf(exact)];
  if (k.startsWith("mcp__") && k.length > 5) {
    const q = deferred.filter((t) => nameOf(t).toLowerCase().startsWith(k)).slice(0, max).map(nameOf);
    if (q.length) return q;
  }
  const words = k.split(/\s+/).filter((q) => q.length > 0);
  const must = [], may = [];
  for (const q of words) if (q.startsWith("+") && q.length > 1) must.push(q.slice(1)); else may.push(q);
  const terms = must.length ? [...must, ...may] : words;
  const re = new Map(terms.map((x) => [x, new RegExp("\\b" + escapeRe(x) + "\\b")]));
  let from = deferred;
  if (must.length) from = deferred.filter((t) => {
    const p = nameParts(nameOf(t)), d = describe(t).toLowerCase(), h = hintOf(t);
    return must.every((s) => p.parts.includes(s) || p.parts.some((c) => c.includes(s)) || p.coarse.includes(s) || p.coarse.some((c) => c.includes(s)) || re.get(s).test(d) || (!!h && re.get(s).test(h)));
  });
  return from.map((t) => {
    const p = nameParts(nameOf(t)), d = describe(t).toLowerCase(), h = hintOf(t);
    let score = 0;
    for (const x of terms) {
      const r = re.get(x);
      if (p.parts.includes(x)) score += p.isMcp ? 12 : 10;
      else if (p.parts.some((c) => c.includes(x))) score += p.isMcp ? 6 : 5;
      if (p.coarse.includes(x)) score += p.isMcp ? 12 : 10;
      else if (p.coarse.some((c) => c.includes(x))) score += p.isMcp ? 4 : 3;
      if (p.full.includes(x) && score === 0) score += 3;
      if (h && r.test(h)) score += 4;
      if (r.test(d)) score += 2;
    }
    return { name: nameOf(t), score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, max).map((x) => x.name);
}

/** A value as the API writes a tool's definition: keys sorted, ", " and ": " between, other characters as they are. */
export function definitionJson(v) {
  if (v === null || v === undefined) return "null";
  if (Array.isArray(v)) return "[" + v.map(definitionJson).join(", ") + "]";
  if (typeof v === "object") return "{" + Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ": " + definitionJson(v[k])).join(", ") + "}";
  const s = JSON.stringify(v);
  return s === undefined ? "null" : s;
}
/** ITS RESULT, as the API gives the model the tools it loaded: a <functions> block, one <function>{…}</function> line each. */
export const functionsBlock = (defs) => "<functions>\n" + defs.map((t) => "<function>" + definitionJson({ description: String(t.function.description || ""), name: t.function.name, parameters: t.function.parameters || {} }) + "</function>").join("\n") + "\n</functions>";

/**
 * A CALL OF THE TOOL (its call and its mapToolResultToToolResultBlockParam): `pool` the chat's tools (its order), `deferred`
 * the names it defers. A select gives each named tool (by its name, or a connector tool by its short name); keywords
 * give keywordSearch's best. `{ matches, loaded, text, facts, note }`: the tools found (in order), the deferred ones of
 * them (to load), what Coder is told (their definitions, or NO_MATCH), its result object for PostToolUse hooks (matches,
 * query, total_deferred_tools), and a keyword query that names a tool already loaded upfront: "Already available …".
 */
export function runToolSearch(args, { pool = [], deferred = new Set() } = {}) {
  const all = (Array.isArray(pool) ? pool : []).filter((t) => t && t.function && t.function.name);
  const def = all.filter((t) => deferred.has(nameOf(t)));
  const max = args && args.max_results !== undefined ? args.max_results : 5;
  const query = normalQuery(args && typeof args.query === "string" ? args.query : "");
  const sel = query.match(SELECT_RE);
  let matches = [], note = "";
  if (sel) {
    for (const n of sel[1].split(",").map((x) => x.trim()).filter(Boolean)) for (const t of byName(def, all, n)) if (!matches.includes(nameOf(t))) matches.push(nameOf(t));
  } else {
    const to = query.trim();
    const exactName = all.find((t) => nameOf(t).toLowerCase() === to.toLowerCase());
    matches = keywordSearch(query, def, all, max);
    // (Named, not found by score: the whole query, its words joined by "_", or a word with "_" in it, as a tool's name
    // or a connector tool's short name, when that tool is loaded upfront: "Already available in this conversation".)
    if (!exactName) {
      const words = to.split(/\s+/).map((w) => w.replace(/^\+/, ""));
      const seen = [];
      for (const x of [to, words.join("_"), ...words.filter((w) => w.includes("_"))]) for (const t of byName([], all, x)) if (!seen.includes(nameOf(t))) seen.push(nameOf(t));
      const upfront = seen.filter((n) => !deferred.has(n));
      if (upfront.length) note = alreadyAvailable(upfront);
    }
  }
  const found = matches.map((n) => all.find((t) => nameOf(t) === n)).filter(Boolean);
  return {
    matches,
    loaded: matches.filter((n) => deferred.has(n)),
    text: found.length ? functionsBlock(found) : NO_MATCH,
    facts: { matches, query, total_deferred_tools: def.length },
    note,
  };
}
