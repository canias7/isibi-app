/**
 * CLAUDE CODE'S WEBSEARCH (the owner, 2026-11-14: "start fixing and filling in gaps on those tools"; web search becomes "a
 * tool like Claude Code's WebSearch (each search its own Grok call)"). Read from Claude Code's docs (tools reference,
 * permissions, hooks, env vars, the Agent SDK's WebSearchInput and WebSearchOutput) and, where they say nothing, from its
 * 2.1.323 program: a tool Coder calls with `query` and the domain lists; each call is one separate model request whose only
 * tool is the search (Claude Code: "You run a web search for another Claude model, which is waiting on the result and can
 * search again. Search once, then reply with a brief summary of the results."), and Coder gets the result in Claude Code's
 * words ("Web search results for query: …", "Links: […]", the summary, the REMINDER line). Its permission is Claude
 * Code's (a rule on the whole tool: WebSearch; asked without one, judged by auto mode's checker in Auto), and so is the
 * chat's search budget (200 calls, refilling about 100 an hour).
 *
 * Where Grok can't do what Claude Code does, the closest, said here: xAI's web search takes its domain lists per request
 * (`filters`), at most 5 domains each; it has no limit on searches per request, only on turns (`max_turns`); its sources
 * come with no titles, so a link's title is its address; and it has no lighter or fuller search, so Claude Code's `mode`
 * input (only some of its sessions have it) is left out, and dropped when sent, as Claude Code drops it where it is off.
 */
import { wholeRule, normMode } from "./coder-perms.mjs";

/** Claude Code's name for the tool: what its permission rules and hooks say (Coder's own name is `web_search`). */
export const WEB_SEARCH_NAME = "WebSearch";
/** THE CHAT'S SEARCH BUDGET (Claude Code's tools reference: "An interactive terminal session has a limit of 200 WebSearch calls"; "an interactive terminal session's limit refills at about 100 calls per hour"). */
export const SEARCHES_MAX = 200, REFILLS_DEFAULT = 100;
const HOUR_MS = 3_600_000;
/** xAI's limit on each domain list ("Only search within specific domains (max 5)"; "Exclude specific domains from search (max 5)"). */
export const DOMAINS_MAX = 5;
/**
 * TURNS FOR ONE SEARCH: Claude Code asks for one search ("Search once") and lets its request make up to eight ("The tool may
 * issue up to eight backend searches per call"); xAI limits turns, not searches, and its docs give 1 to 2 for "Quick
 * lookups". Two: one search, and room for one refinement.
 */
export const SEARCH_MAX_TURNS = 2;
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

const kindOf = (v) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v);
const INPUTS = ["query", "allowed_domains", "blocked_domains"];
/**
 * WEB_SEARCH'S INPUT, AS CLAUDE CODE TAKES IT (coder-inputs.mjs: before any hook, card or run). First its schema, refused in
 * Claude Code's words ("InputValidationError: WebSearch failed due to the following issue:" with "The required parameter
 * `query` is missing", "An unexpected parameter `x` was provided", "The parameter `x` type is expected as `string` but
 * provided as `number`", "The parameter `query` is invalid: Too small: expected string to have >=2 characters"); `mode`,
 * which Claude Code takes only where its search modes are on, dropped without a word, as it drops it elsewhere. Then its
 * own checks ("Error: Missing query", "Error: Cannot specify both allowed_domains and blocked_domains in the same
 * request"), Coder's mark of a failed call ("error: ") in place of their "Error: "; and xAI's limit of 5 domains a list.
 */
export function checkInput(args) {
  const a = args && typeof args === "object" && !Array.isArray(args) ? { ...args } : {};
  delete a.mode;
  const missing = [], unexpected = [], types = [], other = [];
  if (a.query === undefined) missing.push("query");
  else if (typeof a.query !== "string") types.push(["query", "string", kindOf(a.query)]);
  else if (a.query.length < 2) other.push("The parameter `query` is invalid: Too small: expected string to have >=2 characters");
  for (const k of ["allowed_domains", "blocked_domains"]) {
    if (a[k] === undefined) continue;
    if (!Array.isArray(a[k])) types.push([k, "array", kindOf(a[k])]);
    else a[k].forEach((x, i) => { if (typeof x !== "string") types.push([k + "[" + i + "]", "string", kindOf(x)]); });
  }
  for (const k of Object.keys(a)) if (!INPUTS.includes(k)) unexpected.push(k);
  const lines = [...missing.map((k) => "The required parameter `" + k + "` is missing"), ...unexpected.slice(0, 20).map((k) => "An unexpected parameter `" + String(k).slice(0, 60) + "` was provided"), ...types.slice(0, 20).map(([k, e, r]) => "The parameter `" + k + "` type is expected as `" + e + "` but provided as `" + r + "`"), ...other];
  if (lines.length) return { error: "error: InputValidationError: web_search failed due to the following " + (lines.length > 1 ? "issues" : "issue") + ":\n" + lines.join("\n") };
  if (!a.query.length) return { error: "error: Missing query" };
  const allowed = Array.isArray(a.allowed_domains) ? a.allowed_domains : [], blocked = Array.isArray(a.blocked_domains) ? a.blocked_domains : [];
  if (allowed.length && blocked.length) return { error: "error: Cannot specify both allowed_domains and blocked_domains in the same request" };
  for (const [k, l] of [["allowed_domains", allowed], ["blocked_domains", blocked]]) {
    if (l.length > DOMAINS_MAX) return { error: "error: Grok's web search takes at most " + DOMAINS_MAX + " domains in " + k + " (" + l.length + " were given): name " + DOMAINS_MAX + " or fewer, or search more than once" };
  }
  const out = { query: a.query };
  if (Array.isArray(a.allowed_domains)) out.allowed_domains = a.allowed_domains;
  if (Array.isArray(a.blocked_domains)) out.blocked_domains = a.blocked_domains;
  return { args: out };
}

/**
 * WHAT A SEARCH OF CODER'S CHAT NEEDS BEFORE IT RUNS (Claude Code's permissions: "Web search | WebSearch | Yes | Permanently
 * per repository"; "WebSearch permission rules take no specifier"; rules checked deny, then ask, then allow; in auto mode
 * the classifier judges what no rule settles, and "When auto mode is available, Claude Code sends these calls during
 * planning to auto mode's classifier for review … Web searches"): `deny` (its words), `ask` (a rule's, every time),
 * `allow`, `check` (the checker), or `ask` with "don't ask again" (a WebSearch allow rule). `planChecks`: Plan's checker on.
 */
export function searchDecision({ mode = "auto", rules = {}, planChecks = false } = {}) {
  const d = wholeRule(rules, "deny", WEB_SEARCH_NAME);
  if (d) return { verdict: "deny", rule: d, why: SEARCH_DENIED };
  const a = wholeRule(rules, "ask", WEB_SEARCH_NAME);
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
export function searchRefillsOf(v) {
  const t = v === undefined || v === null ? "" : String(v);
  const n = /^\d+$/.test(t) ? Number(t) : NaN;
  return Number.isSafeInteger(n) ? n : REFILLS_DEFAULT;
}

/**
 * THE CHAT'S SEARCH BUDGET (Claude Code's: a count of the calls made, shared by every agent of the session, that refills over
 * time: each hour gives back `refills` calls, the rate in use being the lower of the old and the new when it changes; it
 * starts over once nothing is used). Coder's chat is Claude Code's session, so the count is kept with the chat (`keep`:
 * { load, save }, a file beside its other state) and lasts across its messages and its machine's sleeps.
 */
export function searchBudget({ keep = null, max = SEARCHES_MAX, refills = REFILLS_DEFAULT, now = () => Date.now() } = {}) {
  let s = null;
  const load = () => {
    if (s) return s;
    let o = null;
    try { o = keep && typeof keep.load === "function" ? keep.load() : null; } catch { o = null; }
    const ok = o && typeof o === "object" && Number.isSafeInteger(o.used) && o.used >= 0 && Number.isFinite(o.carry) && o.carry >= 0 && Number.isFinite(o.at) && Number.isFinite(o.rate) && o.rate >= 0;
    s = ok ? { used: o.used, carry: o.carry, at: o.at, rate: o.rate } : { used: 0, carry: 0, at: now(), rate: refills };
    return s;
  };
  const save = () => { try { if (keep && typeof keep.save === "function") keep.save({ ...s }); } catch { /* counted in memory still */ } };
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
 * WHAT CODER IS TOLD WHEN THE BUDGET IS USED UP (Claude Code 2.1.323's text, with Coder's names: its session is Coder's
 * chat, its tools web_search and bash, its setting CODER_MAX_WEB_SEARCHES_PER_SESSION). The call ran and did nothing, as
 * Claude Code's ("searches appear in the conversation as calls that did nothing").
 */
export function usedUpText({ max = SEARCHES_MAX, refills = REFILLS_DEFAULT } = {}) {
  const n = calls(max).replace(/ call/, " web_search call");
  const limit = refills > 0
    ? "limit: " + n + " shared by every agent in this chat; the budget refills at about " + calls(refills) + " per hour, so searching becomes possible again later in the chat"
    : "limit: " + n + ", shared by every agent in this chat; it does not refill";
  const go = refills > 0 ? "Do not pause or wait for the refill: continue with the information already gathered and say so in your answer" : "Continue with the information already gathered instead of searching again, and say so in your answer";
  return "Web search was not performed: this chat's web search budget is used up (" + limit + "). " + go + "; do not work around the limit by querying search engines with curl or wget from bash, by querying them in a browser or through a computer-use tool, or by searching or fetching through a third-party reader, proxy or archive service. If more searches are genuinely needed, ask the user to raise CODER_MAX_WEB_SEARCHES_PER_SESSION.";
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
 * on the caller's model and effort), with xAI's web search (`webSearch`: its domain filters), its turns limited and its
 * sources asked for. Gives { facts, text, usage } or { error } (Coder's "error: " mark and the client's words, or Claude
 * Code's when the request ended with nothing).
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
    maxTurns: SEARCH_MAX_TURNS,
    include: [...SEARCH_INCLUDE],
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
