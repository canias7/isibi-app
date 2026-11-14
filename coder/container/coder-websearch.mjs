/**
 * CLAUDE CODE'S WEBSEARCH (the owner, 2026-11-14: "start fixing and filling in gaps on those tools"; web search becomes "a
 * tool like Claude Code's WebSearch (each search its own Grok call)"). Read from Claude Code's docs (tools reference,
 * permissions, hooks, env vars, the Agent SDK's WebSearchInput and WebSearchOutput) and, where they say nothing, from its
 * 2.1.323 program: a tool Coder calls with `query` and the domain lists; each call is one separate model request whose only
 * tool is the search (Claude Code: "You run a web search for another Claude model, which is waiting on the result and can
 * search again. Search once, then reply with a brief summary of the results."), and Coder gets the result in Claude Code's
 * words ("Web search results for query: …", "Links: […]", the summary, the REMINDER line). Its permission is Claude
 * Code's (a rule on the whole tool: WebSearch; asked without one, judged by auto mode's checker in Auto), and so is the
 * search budget: 200 calls a turn in Coder's chats, as in Claude Code's cloud sessions (the owner, 2026-11-14, chose Claude
 * Code's rule); Gloopy's chat keeps its own count (200, refilling about 100 an hour).
 *
 * CLAUDE CODE'S `mode` (its cloud sessions' WebSearch, 2.1.325; the owner, 2026-11-14, chose to add it): Coder's chats and
 * jobs from GitHub are offered Claude Code's input, "standard" or "extended", with its description and its note in the
 * system prompt, word for word (WEB_SEARCH_MODE_TOOL, SEARCH_MODE_NOTE); a call without it runs "extended", as Claude Code's
 * prefault. Gloopy and its helpers keep the tool as it was (WEB_SEARCH_TOOL, no `mode`, dropped when sent).
 *
 * Where Grok can't do what Claude Code does, the closest, said here: xAI's web search takes its domain lists per request
 * (`filters`), at most 5 domains each; it has no limit on searches per request, only on turns (`max_turns`), so its searches
 * are held to Claude Code's 8 by one tool call a turn (`parallel_tool_calls` off) and 8 turns; its sources come with no
 * titles, so a link's title is its address; and it has no search profile (Claude Code's "standard" asks Anthropic's search
 * for its "fast" one), so "extended" is the search as it was (up to 8 searches) and "standard" the lightest request that
 * still searches: one turn, so one search (xAI's "Quick lookups | 1-2").
 */
import { wholeRule, normMode, parseRule, settingMatches } from "./coder-perms.mjs";
import { issuesText, typeIssue, keysIssue, minLengthIssue } from "./coder-issues.mjs";
import { valueIssue } from "./coder-zodtext.mjs";

/** Claude Code's name for the tool: what its permission rules and hooks say (Coder's own name is `web_search`). */
export const WEB_SEARCH_NAME = "WebSearch";
/** THE SEARCH BUDGET (Claude Code's tools reference: "An interactive terminal session has a limit of 200 WebSearch calls"; "an interactive terminal session's limit refills at about 100 calls per hour"; Gloopy's chat's refill). */
export const SEARCHES_MAX = 200, REFILLS_DEFAULT = 100;
const HOUR_MS = 3_600_000;
/** xAI's limit on each domain list ("Only search within specific domains (max 5)"; "Exclude specific domains from search (max 5)"). */
export const DOMAINS_MAX = 5;
/**
 * SEARCHES IN ONE CALL: Claude Code asks for one search ("Search once") and lets its request make up to eight ("The tool may
 * issue up to eight backend searches per call", its request's `max_uses: 8`). xAI has no such limit: `max_turns` "does not
 * directly limit the number of individual tool calls … During a single turn, the model may invoke multiple tools in
 * parallel". So the search's request turns parallel tool calls off (xAI's `parallel_tool_calls`, "Whether to allow the model
 * to run parallel tool calls"): one call a turn, and 8 turns, at most 8 searches.
 */
export const SEARCH_MAX_USES = 8;
export const SEARCH_MAX_TURNS = SEARCH_MAX_USES;
/**
 * A "standard" SEARCH'S TURNS: one (one search, its tool calls one a turn), the lightest xAI request that still searches (xAI's
 * tool usage guide, "When to Use max_turns": "Quick lookups | 1-2 | Fastest response, may miss deeper insights"; "When the
 * agent reaches the limit, it will stop making additional tool calls and generate a final response"). "extended" has 8.
 */
export const SEARCH_STANDARD_TURNS = 1;
/** Claude Code's two kinds of search, and the one a call without `mode` runs (its schema's `.prefault("extended")`). */
export const SEARCH_MODES = Object.freeze(["standard", "extended"]);
export const SEARCH_MODE_DEFAULT = "extended";
/**
 * WHAT THE SEARCH'S REQUEST ASKS xAI TO RETURN: the sources of each search (xAI: "web_search_call.action.sources" for the
 * Responses API), and the summary without xAI's inline [[1]](url) marks (its "no_inline_citations"), as Claude Code's own
 * summary is plain text: the links come with each search, as Claude Code's do.
 */
export const SEARCH_INCLUDE = Object.freeze(["web_search_call.action.sources", "no_inline_citations"]);

/**
 * THE DESCRIPTION GROK IS GIVEN: Claude Code 2.1.323's own for current models, word for word but for "US-only" (its search
 * is Anthropic's, which is; Grok's isn't). "The current month is (provided in the conversation below)" is Claude Code's
 * text too: the date is in Coder's context ("Today's date is …").
 */
export const WEB_SEARCH_DESCRIPTION = "Search the web. Returns result blocks with titles and URLs.\n\n" +
  "- The current month is (provided in the conversation below) — use this when searching for recent information.\n" +
  "- `allowed_domains` / `blocked_domains` filter results.\n" +
  "- After answering from results, end with a \"Sources:\" list of the URLs you used as markdown links.";
/**
 * THE TOOL (Claude Code's inputs, its hooks reference and Agent SDK: query, allowed_domains, blocked_domains, with its own
 * descriptions; "query" at least 2 characters; no other input). The lists say xAI's limit, as a list of 6 is refused.
 * Gloopy's and its helpers' (Gloopy stays as it is): Coder's own chats and jobs have WEB_SEARCH_MODE_TOOL in its place.
 */
export const WEB_SEARCH_TOOL = Object.freeze({ type: "function", function: {
  name: "web_search",
  description: WEB_SEARCH_DESCRIPTION,
  parameters: { type: "object", properties: {
    query: { type: "string", minLength: 2, description: "The search query to use" },
    allowed_domains: { type: "array", items: { type: "string" }, description: "Only include search results from these domains (at most " + DOMAINS_MAX + ")" },
    blocked_domains: { type: "array", items: { type: "string" }, description: "Never include search results from these domains (at most " + DOMAINS_MAX + ")" },
  }, required: ["query"], additionalProperties: false },
} });
/**
 * CLAUDE CODE'S `mode` (its cloud sessions' WebSearch, 2.1.325: `mode` after the other inputs, "standard" or "extended", its
 * description word for word, and in its schema's `required` with `query`, as the tool reaches the model; the owner,
 * 2026-11-14, chose to add it).
 */
export const SEARCH_MODE_DESCRIPTION = "\"standard\": the normal web search: quick and cheap; right for straightforward lookups (reference facts, official pages, documentation, well-known people, places and topics) and simple follow-up lookups. \"extended\": a thorough, fresh search at several times the cost and latency.";
export const WEB_SEARCH_MODE_TOOL = Object.freeze({ type: "function", function: {
  ...WEB_SEARCH_TOOL.function,
  parameters: { ...WEB_SEARCH_TOOL.function.parameters, properties: {
    ...WEB_SEARCH_TOOL.function.parameters.properties,
    mode: { type: "string", enum: [...SEARCH_MODES], description: SEARCH_MODE_DESCRIPTION },
  }, required: ["query", "mode"] },
} });
/** Coder's own tools with Claude Code's web_search, `mode` and all, in the place of the one without it. */
export const searchModeTools = (list) => (Array.isArray(list) ? list : []).map((t) => (t && t.function && t.function.name === "web_search" ? WEB_SEARCH_MODE_TOOL : t));
/**
 * THE SCHEMA A HOOK'S REWRITE IS CHECKED WITH (coder-hookcheck.mjs): the input side of Claude Code's, as zod writes it (its
 * `mode` not required, "extended" by default), so a rewrite that leaves `mode` out runs "extended", as Claude Code's schema
 * fills it in; any other tool's parameters as they are.
 */
export const hookParamsFor = (name, params) => (name === "web_search" && params && params.properties && params.properties.mode ? { ...params, properties: { ...params.properties, mode: { default: SEARCH_MODE_DEFAULT, ...params.properties.mode } }, required: (Array.isArray(params.required) ? params.required : []).filter((k) => k !== "mode") } : params);
/**
 * CLAUDE CODE'S NOTE ON IT, its own part of the system prompt whenever the tool is offered (its 2.1.325 system_hint, word for
 * word, web_search for its WebSearch).
 */
export const SEARCH_MODE_NOTE = "web_search takes a `mode`. Use \"standard\" by default: it is the normal search, quick and cheap. Use \"extended\" only when a \"standard\" result comes back thin, off-target or possibly outdated, or from the start for hard-to-find or niche facts, very recent events, prices and availability, and multi-step research: it is thorough and fresh but several times the cost. When you plan several searches, send them in the same turn.";

/** THE SEARCH'S OWN REQUEST: Claude Code's system text and question, "another Claude model" being "another model" here. */
export const SEARCH_SYSTEM = "You run a web search for another model, which is waiting on the result and can search again. Search once, then reply with a brief summary of the results.";
export const searchAsk = (query) => "Perform a web search for the query: " + query;
/** What Coder is told after the results (Claude Code's own line). */
export const SEARCH_REMINDER = "REMINDER: You MUST include the sources above in your response to the user using markdown hyperlinks.";
/** A search whose request ended before any answer came (Claude Code: "The search was cut off before any results arrived. Try again."). */
export const SEARCH_CUT_OFF = "The search was cut off before any results arrived. Try again.";
/** The question on the owner's card (Claude Code's: "Claude wants to search the web for: <query>"). */
export const searchAskText = (query) => "Coder wants to search the web for: " + query;
/** A call to the tool a rule took away (Claude Code's words for a denied tool). */
export const SEARCH_DENIED = "Permission to use " + WEB_SEARCH_NAME + " has been denied.";
/** A search that waits for the owner's Yes where no one can give it (Claude Code's words: "Claude requested permissions to use WebSearch, but you haven't granted it yet."). */
export const SEARCH_UNGRANTED = "Coder requested permissions to use " + WEB_SEARCH_NAME + ", but you haven't granted it yet.";

const INPUTS = ["query", "allowed_domains", "blocked_domains"];
/**
 * WEB_SEARCH'S INPUT, AS CLAUDE CODE TAKES IT (coder-inputs.mjs: before any hook, card or run). First its schema (Claude
 * Code's: query a string of at least 2 characters, the lists strings, nothing else), refused in Claude Code's words
 * ("InputValidationError: WebSearch failed due to the following issue:" with "The required parameter `query` is missing",
 * "An unexpected parameter `x` was provided", "The parameter `x` type is expected as `string` but provided as `number`"; and
 * when only a value is wrong, such as a query of one character, zod's own issues as JSON, coder-issues.mjs); its `mode`
 * ("standard" or "extended"; any other value refused with zod's issue; none given: "extended", Claude Code's prefault, which
 * its hooks then see), for Coder's own chats and jobs; for Gloopy's (`ctx.searchModes` false), whose tool has none, dropped
 * without a word, as Claude Code drops it where its search modes are off. Then its own checks ("Error: Missing query", "Error:
 * Cannot specify both allowed_domains and blocked_domains in the same request"), Coder's mark of a failed call ("error: ")
 * in place of their "Error: "; and xAI's limit of 5 domains a list.
 */
export function checkInput(args, ctx = {}) {
  const modes = !(ctx && ctx.searchModes === false);
  const a = args && typeof args === "object" && !Array.isArray(args) ? { ...args } : {};
  if (!modes) delete a.mode;
  const issues = [];
  if (typeof a.query !== "string") issues.push(typeIssue("string", a.query, ["query"]));
  const short = minLengthIssue(a.query, 2, ["query"]);
  if (short) issues.push(short);
  for (const k of ["allowed_domains", "blocked_domains"]) {
    if (a[k] === undefined) continue;
    if (!Array.isArray(a[k])) issues.push(typeIssue("array", a[k], [k]));
    else a[k].forEach((x, i) => { if (typeof x !== "string") issues.push(typeIssue("string", x, [k, i])); });
  }
  if (modes && a.mode !== undefined && !SEARCH_MODES.includes(a.mode)) issues.push(valueIssue(SEARCH_MODES, ["mode"]));
  const unknown = Object.keys(a).filter((k) => !INPUTS.includes(k) && !(modes && k === "mode"));
  if (unknown.length) issues.push(keysIssue(unknown));
  if (issues.length) return { error: "error: InputValidationError: " + issuesText("web_search", issues) };
  if (!a.query.length) return { error: "error: Missing query" };
  const allowed = Array.isArray(a.allowed_domains) ? a.allowed_domains : [], blocked = Array.isArray(a.blocked_domains) ? a.blocked_domains : [];
  if (allowed.length && blocked.length) return { error: "error: Cannot specify both allowed_domains and blocked_domains in the same request" };
  for (const [k, l] of [["allowed_domains", allowed], ["blocked_domains", blocked]]) {
    if (l.length > DOMAINS_MAX) return { error: "error: Grok's web search takes at most " + DOMAINS_MAX + " domains in " + k + " (" + l.length + " were given): name " + DOMAINS_MAX + " or fewer, or search more than once" };
  }
  const out = { query: a.query };
  if (Array.isArray(a.allowed_domains)) out.allowed_domains = a.allowed_domains;
  if (Array.isArray(a.blocked_domains)) out.blocked_domains = a.blocked_domains;
  if (modes) out.mode = a.mode === undefined ? SEARCH_MODE_DEFAULT : a.mode;
  return { args: out };
}

/**
 * A DENY OR ASK RULE ON ONE OF THE CALL'S INPUTS (Claude Code's "Match by input parameter": "A parameter rule matches when
 * Claude calls the tool with that parameter set to that exact value", "A parameter the model omits is never matched", only
 * a scalar; "Whitespace around the colon is ignored"), or "".
 */
function paramRule(rules, kind, input) {
  if (!input || typeof input !== "object") return "";
  return (Array.isArray(rules && rules[kind]) ? rules[kind] : []).find((r) => { const x = parseRule(r); if (!x || x.tool !== WEB_SEARCH_NAME || !x.param) return false; const v = input[x.param.name]; return settingMatches(x.param.value, typeof v === "string" ? v.trim() : v); }) || "";
}
/**
 * WHAT A SEARCH OF CODER'S CHAT NEEDS BEFORE IT RUNS (Claude Code's permissions: "Web search | WebSearch | Yes | Permanently
 * per repository"; "WebSearch permission rules take no specifier"; rules checked deny, then ask, then allow; in auto mode
 * the classifier judges what no rule settles, and "When auto mode is available, Claude Code sends these calls during
 * planning to auto mode's classifier for review … Web searches"): `deny` (its words), `ask` (a rule's, every time),
 * `allow`, `check` (the checker), or `ask` with "don't ask again" (a WebSearch allow rule). `planChecks`: Plan's checker on.
 */
export function searchDecision({ mode = "auto", rules = {}, planChecks = false, input = null } = {}) {
  const d = wholeRule(rules, "deny", WEB_SEARCH_NAME);
  if (d) return { verdict: "deny", rule: d, why: SEARCH_DENIED };
  // (A rule on the call's query, WebSearch(query:<exact text>), in Claude Code 2.1.325's words: "Permission to use WebSearch
  // with query:… has been denied."; an ask one asks, as one on the whole tool. 2026-11-14.)
  const pd = paramRule(rules, "deny", input);
  if (pd) return { verdict: "deny", rule: pd, why: "Permission to use " + WEB_SEARCH_NAME + " with " + parseRule(pd).spec + " has been denied." };
  const a = wholeRule(rules, "ask", WEB_SEARCH_NAME) || paramRule(rules, "ask", input);
  if (a) return { verdict: "ask", rule: a, why: "Your rule " + a + " asks first for " + WEB_SEARCH_NAME + ".", byRule: true };
  const ok = wholeRule(rules, "allow", WEB_SEARCH_NAME);
  if (ok) return { verdict: "allow", rule: ok, byRule: true };
  const m = normMode(mode);
  if (m === "auto" || (m === "plan" && planChecks)) return { verdict: "check" };
  return { verdict: "ask", why: "", suggest: [WEB_SEARCH_NAME] };
}

/**
 * THE BUDGET'S SETTINGS (Claude Code's CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION: "Accepts a positive whole number with no
 * upper bound. Anything else is ignored and the default applies"; CLAUDE_CODE_WEB_SEARCH_REFILLS_PER_HOUR: "Takes plain
 * digits only; any other spelling reads as unset", 0 turning the refill off), Coder's CODER_MAX_WEB_SEARCHES_PER_SESSION and
 * CODER_WEB_SEARCH_REFILLS_PER_HOUR.
 */
export function searchMaxOf(v) {
  const t = v === undefined || v === null ? "" : String(v).trim();
  const n = /^\d+$/.test(t) ? Number(t) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : SEARCHES_MAX;
}
/** (`unset`: the rate when the setting says none: 0 in Coder's chats and jobs from GitHub, Claude Code's "In a
 * non-interactive session the default is 0, which turns refill off", as its cloud sessions are; 100 an hour in Gloopy's.) */
export function searchRefillsOf(v, unset = REFILLS_DEFAULT) {
  const t = v === undefined || v === null ? "" : String(v);
  const n = /^\d+$/.test(t) ? Number(t) : NaN;
  return Number.isSafeInteger(n) ? n : unset;
}

/**
 * THE SEARCH BUDGET (Claude Code's: a count of the calls made, shared by every agent of the session, that refills over time:
 * each hour gives back `refills` calls, the rate in use being the lower of the old and the new when it changes; it starts
 * over once nothing is used). Kept with the chat (`keep`: { load, save }, a file beside its other state), so it lasts across
 * the machine's sleeps. COUNTED PER TURN IN CODER'S CHATS (the owner, 2026-11-14, chose Claude Code's rule; its cloud sessions
 * are non-interactive: "the limit applies per turn, not per session … The limit resets when you send the next message"):
 * `fresh`, a new turn, starts from none and keeps that at once, so a card that paused the job and its answer stay one turn
 * (the job that takes the answer up goes on from the kept count). Gloopy's chat: one count for the whole chat, as before.
 */
export function searchBudget({ keep = null, fresh = false, max = SEARCHES_MAX, refills = REFILLS_DEFAULT, now = () => Date.now() } = {}) {
  let s = null;
  const load = () => {
    if (s) return s;
    let o = null;
    try { o = !fresh && keep && typeof keep.load === "function" ? keep.load() : null; } catch { o = null; }
    const ok = o && typeof o === "object" && Number.isSafeInteger(o.used) && o.used >= 0 && Number.isFinite(o.carry) && o.carry >= 0 && Number.isFinite(o.at) && Number.isFinite(o.rate) && o.rate >= 0;
    s = ok ? { used: o.used, carry: o.carry, at: o.at, rate: o.rate } : { used: 0, carry: 0, at: now(), rate: refills };
    return s;
  };
  const save = () => { try { if (keep && typeof keep.save === "function") keep.save({ ...s }); } catch { /* counted in memory still */ } };
  if (fresh) { load(); save(); }
  const settle = () => {
    load();
    const t = now(), rate = Math.min(refills, s.rate), dt = Math.max(0, t - s.at);
    s.rate = refills; s.at = t;
    if (s.used === 0) { s.carry = 0; return; }
    s.carry += dt * rate;
    const back = Math.floor(s.carry / HOUR_MS);
    if (back >= s.used) { s.used = 0; s.carry = 0; return; }
    s.used -= back; s.carry -= back * HOUR_MS;
  };
  return {
    /** One search taken from the budget, or false when it is used up. */
    tryConsume() { settle(); const ok = s.used < max; if (ok) s.used++; save(); return ok; },
    /** How long until one more search may run (0 now; Infinity when nothing refills). */
    msUntilNextCall() { settle(); const over = s.used - max; if (over < 0) return 0; if (refills === 0) return Infinity; return Math.max(1, Math.ceil(((over + 1) * HOUR_MS - s.carry) / refills)); },
    refillsPerHour: () => refills,
    max: () => max,
  };
}
const calls = (n) => n + " " + (n === 1 ? "call" : "calls");
/**
 * WHAT CODER IS TOLD WHEN THE BUDGET IS USED UP (Claude Code 2.1.325's text, with Coder's names: its session is Coder's
 * chat, its user the owner, its tools web_search and bash, its setting CODER_MAX_WEB_SEARCHES_PER_SESSION). The call ran and
 * did nothing, as Claude Code's ("searches appear in the conversation as calls that did nothing"). `perTurn`: Coder's chats
 * and jobs started from GitHub, whose budget is the turn's, as Claude Code's non-interactive runs' and cloud sessions' ("the
 * limit applies per turn, not per session"), in its words for one ("this turn's", "per turn", "send a follow-up message after
 * this reply"); Gloopy's chat, "this chat's".
 */
export function usedUpText({ max = SEARCHES_MAX, refills = REFILLS_DEFAULT, perTurn = false } = {}) {
  const scope = perTurn ? "turn" : "chat";
  const n = calls(max).replace(/ call/, " web_search call");
  const limit = refills > 0
    ? "limit: " + n + " shared by every agent in this " + scope + "; the budget refills at about " + calls(refills) + " per hour, so searching becomes possible again later in the " + scope
    : perTurn ? "limit: " + n + " per turn, shared by every agent in it" : "limit: " + n + ", shared by every agent in this chat; it does not refill";
  const go = refills > 0 ? "Do not pause or wait for the refill: continue with the information already gathered and say so in your answer" : "Continue with the information already gathered instead of searching again, and say so in your answer";
  const more = perTurn ? ["tell the owner they can send a follow-up message after this reply to continue the search", "ask them to raise CODER_MAX_WEB_SEARCHES_PER_SESSION"] : ["ask the owner to raise CODER_MAX_WEB_SEARCHES_PER_SESSION"];
  return "Web search was not performed: this " + scope + "'s web search budget is used up (" + limit + "). " + go + "; do not work around the limit by querying search engines with curl or wget from bash, by querying them in a browser or through a computer-use tool, or by searching or fetching through a third-party reader, proxy or archive service. If more searches are genuinely needed, " + more.join(", or ") + ".";
}

const httpUrl = (u) => typeof u === "string" && /^https?:\/\/\S+$/i.test(u) && u.length <= 2048;
/** A search's links: its sources (an address and, when xAI gives one, a title; else the address is its title). */
function linksOf(item) {
  const a = item && item.action && typeof item.action === "object" ? item.action : {};
  const src = Array.isArray(a.sources) ? a.sources : [];
  const seen = new Set(), out = [];
  for (const x of src) {
    const url = typeof x === "string" ? x : x && typeof x.url === "string" ? x.url : "";
    if (!httpUrl(url) || seen.has(url)) continue;
    seen.add(url);
    const title = x && typeof x.title === "string" && x.title.trim() ? x.title.trim().slice(0, 500) : url;
    out.push({ title, url });
  }
  // (A page Grok's search opened, with no sources of its own: that page.)
  if (!out.length && httpUrl(a.url)) out.push({ title: a.url, url: a.url });
  return out;
}
/**
 * THE RESULT OBJECT (Claude Code's WebSearchOutput: "{ query; results: Array<{ tool_use_id; content: Array<{ title; url }> }
 * | string>; durationSeconds; searchCount? }"), from the search's answer as Claude Code builds it: the words before a search
 * one entry, each search its links (or "Web search error: <code>" when it failed), the words after it the last; searchCount
 * the searches made. `answer`: what the model client gave back (its `output`, xAI's own items, when there is one).
 */
export function searchResults(answer, query, durationSeconds = 0) {
  const results = [];
  let text = "", made = 0;
  const flush = () => { if (text.trim()) results.push(text.trim()); text = ""; };
  const items = answer && Array.isArray(answer.output) ? answer.output : null;
  if (items) {
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      if (item.type === "web_search_call") {
        made++;
        flush();
        if (item.status === "failed") { const e = item.error && typeof item.error === "object" ? item.error : {}; results.push("Web search error: " + String(e.code || e.type || "failed").slice(0, 80)); continue; }
        results.push({ tool_use_id: String(item.id || "search-" + made).slice(0, 100), content: linksOf(item) });
      } else if (item.type === "message") {
        const part = (Array.isArray(item.content) ? item.content : []).map((c) => (c && typeof c.text === "string" ? c.text : "")).join("");
        // (Two messages are two paragraphs: Coder's model client joins them so, after the live test of 2026-11-06.)
        if (part) text += text && !/\s$/.test(text) ? "\n\n" + part : part;
      }
    }
  } else {
    // (A model client that gives only its searches and its words: the searches, then the words.)
    for (const sr of answer && Array.isArray(answer.searches) ? answer.searches : []) { made++; results.push({ tool_use_id: "search-" + made, content: linksOf({ action: { sources: Array.isArray(sr && sr.sources) ? sr.sources : [] } }) }); }
    text = answer && answer.message && typeof answer.message.content === "string" ? answer.message.content : "";
  }
  flush();
  const billed = Number(answer && answer.usage && answer.usage.searches);
  return { query, results, durationSeconds, searchCount: Math.max(made, Number.isFinite(billed) ? billed : 0) };
}
/** WHAT CODER IS GIVEN (Claude Code's result, word for word: the query, each entry, the links as JSON, the REMINDER line). */
export function searchText({ query = "", results = [] } = {}) {
  let y = "Web search results for query: \"" + query + "\"\n\n";
  for (const k of Array.isArray(results) ? results : []) {
    if (k === null || k === undefined) continue;
    if (typeof k === "string") y += k + "\n\n";
    else if (Array.isArray(k.content) && k.content.length > 0) y += "Links: " + JSON.stringify(k.content) + "\n\n";
    else y += "No links found.\n\n";
  }
  y += "\n" + SEARCH_REMINDER;
  return y.trim();
}
/** Under the step in the chat, as before: the pages the search found, or that it searched. */
export function searchShown({ results = [] } = {}) {
  const urls = [];
  for (const k of Array.isArray(results) ? results : []) if (k && typeof k === "object" && Array.isArray(k.content)) for (const l of k.content) if (l && typeof l.url === "string" && !urls.includes(l.url)) urls.push(l.url);
  return urls.slice(0, 30).join("\n") || "(searched)";
}

/**
 * ONE SEARCH: its own request through Coder's model client (Claude Code: a request with the search as its only tool, forced,
 * on the caller's model and effort), with xAI's web search (`webSearch`: its domain filters), its sources asked for, and one
 * call a turn: "extended" (and a call without `mode`) at most 8 searches in 8 turns, "standard" one turn, one search. An answer
 * with nothing in it is taken (`emptyOk`), as Claude Code takes one: its result is the query's line and the REMINDER, no
 * links (2.1.325 throws only on an API error: "if(J!==null&&ve.results.length===0)throw"). Gives { facts, text, usage } or
 * { error } (Coder's "error: " mark and the client's words, or Claude Code's when the request ended with nothing).
 */
export function searchRequest({ model = "", effort = "", args = {} } = {}) {
  const query = typeof args.query === "string" ? args.query : "";
  const allowed = (Array.isArray(args.allowed_domains) ? args.allowed_domains : []).filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim());
  const blocked = (Array.isArray(args.blocked_domains) ? args.blocked_domains : []).filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim());
  return {
    model, ...(effort ? { effort } : {}),
    messages: [{ role: "system", content: SEARCH_SYSTEM }, { role: "user", content: searchAsk(query) }],
    tools: [],
    webSearch: { ...(allowed.length ? { allowed_domains: allowed } : {}), ...(blocked.length ? { excluded_domains: blocked } : {}) },
    tool_choice: "required",
    maxTurns: args.mode === "standard" ? SEARCH_STANDARD_TURNS : SEARCH_MAX_TURNS,
    parallelToolCalls: false,
    include: [...SEARCH_INCLUDE],
    emptyOk: true,
  };
}
export async function runWebSearch(send, { model = "", effort = "", args = {}, now = () => Date.now() } = {}) {
  const t0 = now();
  const query = typeof args.query === "string" ? args.query : "";
  let r;
  try { r = await send(searchRequest({ model, effort, args })); }
  catch (e) {
    const cut = e && (e.name === "TimeoutError" || e.name === "AbortError");
    return { error: "error: " + (cut ? SEARCH_CUT_OFF : String((e && e.message) || e).replace(/\s+/g, " ").slice(0, 600)) };
  }
  const facts = searchResults(r, query, Math.max(0, now() - t0) / 1000);
  return { facts, text: searchText(facts), usage: r && r.usage ? r.usage : null };
}
