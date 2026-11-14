// CLAUDE CODE'S WEBSEARCH IN CODER (the owner, 2026-11-14: "start fixing and filling in gaps on those tools"; web search
// becomes "a tool like Claude Code's WebSearch (each search its own Grok call)"): container/coder-websearch.mjs and its
// place in Coder's loop, the model client, the checker, the hooks, Gloopy and the machine's settings.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const W = await import("../container/coder-websearch.mjs");
const A = await import("../container/coder-agent.mjs");
const H = await import("../container/coder-hooks.mjs");
const M = await import("../container/coder-model.mjs");
const C = await import("../container/coder-checker.mjs");
const I = await import("../container/coder-inputs.mjs");
const G = await import("../container/gloopy-agent.mjs");
const S = await import("../container/server.mjs");
const P = await import("../container/coder-perms.mjs");
const WF = await import("../container/coder-webfetch.mjs");
const ISSUES = await import("../container/coder-issues.mjs");

const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const REMINDER = "REMINDER: You MUST include the sources above in your response to the user using markdown hyperlinks.";
// What Coder's model client gives back for a search's own request (xAI's items, in order, as coderSend passes them on).
const FOUND = { message: { role: "assistant", content: "Node 24 is the latest." }, searches: [{ query: "node latest", sources: ["https://nodejs.org/en/blog"] }], output: [
  { type: "reasoning", status: "completed" },
  { type: "web_search_call", id: "ws_1", status: "completed", action: { type: "search", query: "node latest", sources: [{ type: "url", url: "https://nodejs.org/en/blog" }] } },
  { type: "message", content: [{ type: "output_text", text: "Node 24 is the latest." }] },
], usage: { in: 50, out: 10, searches: 1, cost_ticks: 5000 } };
const FOUND_TEXT = 'Web search results for query: "node latest"\n\nLinks: [{"title":"https://nodejs.org/en/blog","url":"https://nodejs.org/en/blog"}]\n\nNode 24 is the latest.\n\n\n' + REMINDER;
const CHECKER = /^You are the safety checker of Coder's auto mode/;

let roots = 0;
/** One job of Coder's with a scripted Grok: its answers (`steps`), a search's own answer, the checker's verdict. */
async function job(steps, { mode = "auto", rules = null, checker = false, checkerInPlan = true, answers = [], hooks = null, found = FOUND, verdict = '{"decision":"allow"}', deps = {}, opts = {} } = {}) {
  const events = [], seen = [], searches = [], checks = [], hookCalls = [], asked = [];
  let n = 0;
  const root = "/work/ws" + (++roots);
  const r = await A.runCoder({
    send: async (req) => {
      seen.push(req);
      if (req.webSearch) { searches.push(req); if (found instanceof Error) throw found; return typeof found === "function" ? found(req) : found; }
      if (req.messages && req.messages[0] && CHECKER.test(String(req.messages[0].content || ""))) { checks.push(req); return { message: { role: "assistant", content: verdict }, usage: { in: 2, out: 1 } }; }
      return steps[Math.min(n++, steps.length - 1)];
    },
    exec: async (x) => {
      const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
      if (mark && x.hook === true) { const input = JSON.parse(x.payload); hookCalls.push(input); const a = (hooks && hooks.run && hooks.run(input)) || {}; return { code: 0, output: String(a.stdout || "") + "\n" + mark[0] + "\n" }; }
      return { code: 0, output: "ok\n" };
    },
    emit: (e) => events.push(e),
    here: () => root, root, chatId: "ws-chat", where: (p) => (p.startsWith("/") ? p : root + "/" + p),
    ask: async (pid) => { asked.push(pid); return answers.shift() || { choice: "yes" }; },
    ...deps,
  }, { text: "which node is latest?", mode, messages: [], model: "grok-4.7", effort: "medium", ...(rules ? { rules } : {}), checker, checkerInPlan, ...(hooks ? { hooks: H.hooksFrom({ hooks: hooks.settings }, "settings").list } : {}), ...opts });
  const told = (id) => (r.messages.find((m) => m.role === "tool" && m.tool_call_id === id) || {}).content;
  return { r, events, seen, searches, checks, hookCalls, asked, told };
}

test("WS1 web_search is a tool like Claude Code's WebSearch: Claude Code's short description (but for \"US-only\"), its inputs and their words, its name in rules and hooks; Coder's, a job's from GitHub, Gloopy's and its helpers' tools have it", () => {
  const t = W.WEB_SEARCH_TOOL.function;
  assert.equal(t.name, "web_search");
  assert.equal(t.description, "Search the web. Returns result blocks with titles and URLs.\n\n- The current month is (provided in the conversation below) — use this when searching for recent information.\n- `allowed_domains` / `blocked_domains` filter results.\n- After answering from results, end with a \"Sources:\" list of the URLs you used as markdown links.");
  assert.doesNotMatch(t.description, /US-only/);
  assert.deepEqual(Object.keys(t.parameters.properties), ["query", "allowed_domains", "blocked_domains"], "no mode: Grok's search has no lighter or fuller kind");
  assert.deepEqual([t.parameters.properties.query.description, t.parameters.properties.query.minLength, t.parameters.required, t.parameters.additionalProperties], ["The search query to use", 2, ["query"], false]);
  assert.equal(t.parameters.properties.allowed_domains.description, "Only include search results from these domains (at most 5)");
  assert.equal(t.parameters.properties.blocked_domains.description, "Never include search results from these domains (at most 5)");
  for (const [list, name] of [[A.CODER_TOOLS, "Coder"], [A.GITHUB_TOOLS, "GitHub"], [G.GLOOPY_TOOLS, "Gloopy"], [G.HELPER_TOOLS, "helpers"]]) assert.ok(list.some((x) => x.function.name === "web_search"), name);
  assert.equal(H.ccTool("web_search"), "WebSearch");
  assert.deepEqual(H.hookToolInput("web_search", { query: "q", allowed_domains: ["a.com"] }), { query: "q", allowed_domains: ["a.com"] }, "Claude Code's names already");
  assert.equal(I.inputCheckFor("web_search"), W.checkInput);
  assert.deepEqual([A.RUN_TOOLS.web_search.verb, A.RUN_TOOLS.web_search.label({ query: "node latest" })], ["Searched the web for", "\"node latest\""]);
  assert.deepEqual(P.parseRule("WebSearch"), { tool: "WebSearch", spec: null });
  // Coder's and Gloopy's instructions no longer call search "built into you".
  for (const s of [A.CODER_SYSTEM, G.GLOOPY_SYSTEM, G.HELPER_SYSTEM]) { assert.doesNotMatch(s, /built into you/); assert.match(s, /web_search/); }
});

test("WS2 its input as Claude Code takes it, before any hook: its schema's refusals in Claude Code's words, `mode` dropped without a word, both lists refused, and Grok's limit of 5 domains a list", () => {
  const V = W.checkInput;
  assert.deepEqual(V({ query: "node latest", mode: "standard" }), { args: { query: "node latest" } });
  assert.deepEqual(V({ query: "q2", allowed_domains: ["nodejs.org"] }), { args: { query: "q2", allowed_domains: ["nodejs.org"] } });
  assert.deepEqual(V({ query: "q2", allowed_domains: [], blocked_domains: ["x.com"] }), { args: { query: "q2", allowed_domains: [], blocked_domains: ["x.com"] } }, "an empty list is no list");
  assert.deepEqual(V({}), { error: "error: InputValidationError: web_search failed due to the following issue:\nThe required parameter `query` is missing" });
  // (Only a value wrong: zod's own issues, as Claude Code gives them; test WEB4.)
  assert.deepEqual(V({ query: "a" }), { error: "error: InputValidationError: " + JSON.stringify([{ origin: "string", code: "too_small", minimum: 2, inclusive: true, path: ["query"], message: "Too small: expected string to have >=2 characters" }], null, 2) });
  assert.deepEqual(V({ query: 7, allowed_domains: "nodejs.org", engine: "bing" }), { error: "error: InputValidationError: web_search failed due to the following issues:\nAn unexpected parameter `engine` was provided\nThe parameter `query` type is expected as `string` but provided as `number`\nThe parameter `allowed_domains` type is expected as `array` but provided as `string`" });
  assert.deepEqual(V({ query: "q2", blocked_domains: ["a.com", 3] }), { error: "error: InputValidationError: web_search failed due to the following issue:\nThe parameter `blocked_domains[1]` type is expected as `string` but provided as `number`" });
  assert.deepEqual(V({ query: "q2", allowed_domains: ["a.com"], blocked_domains: ["b.com"] }), { error: "error: Cannot specify both allowed_domains and blocked_domains in the same request" });
  assert.deepEqual(V({ query: "q2", allowed_domains: ["a.com", "b.com", "c.com", "d.com", "e.com", "f.com"] }), { error: "error: Grok's web search takes at most 5 domains in allowed_domains (6 were given): name 5 or fewer, or search more than once" });
  assert.ok(V({ query: "q2", blocked_domains: ["a.com", "b.com", "c.com", "d.com", "e.com"] }).args, "5 is fine");
});

test("WS3 each search is its own request through Coder's model client: Claude Code's system text and question, xAI's web search alone with the domain lists as its filters, forced, its turns limited, its sources asked for, the chat's model and effort; no other call carries xAI's search", async () => {
  const q = W.searchRequest({ model: "grok-4.7", effort: "medium", args: { query: "node latest", blocked_domains: [" w3schools.com "] } });
  assert.deepEqual(q, {
    model: "grok-4.7", effort: "medium",
    messages: [{ role: "system", content: "You run a web search for another model, which is waiting on the result and can search again. Search once, then reply with a brief summary of the results." }, { role: "user", content: "Perform a web search for the query: node latest" }],
    tools: [], webSearch: { excluded_domains: ["w3schools.com"] }, tool_choice: "required", maxTurns: 8, parallelToolCalls: false, include: ["web_search_call.action.sources", "no_inline_citations"],
  });
  // What reaches xAI.
  const bodies = [];
  const send = M.coderSend({ XAI_API_KEY: "k" }, { fetchFn: async (u, init) => { bodies.push(JSON.parse(init.body)); return new Response(JSON.stringify(FOUND)); } });
  const r = await send(W.searchRequest({ model: "grok-4.7", effort: "medium", args: { query: "node latest", allowed_domains: ["nodejs.org"] } }));
  assert.deepEqual(bodies[0].tools, [{ type: "web_search", filters: { allowed_domains: ["nodejs.org"] } }]);
  // (At most 8 searches, Claude Code's max_uses: one tool call a turn, 8 turns; test WEB2.)
  assert.deepEqual([bodies[0].tool_choice, bodies[0].max_turns, bodies[0].parallel_tool_calls, bodies[0].include, bodies[0].reasoning, bodies[0].instructions], ["required", 8, false, ["web_search_call.action.sources", "no_inline_citations"], { effort: "medium" }, W.SEARCH_SYSTEM]);
  assert.deepEqual(r.output, FOUND.output, "xAI's own items, in order, for the result");
  await send(W.searchRequest({ model: "grok-4.7", args: { query: "node latest" } }));
  assert.deepEqual(bodies[1].tools, [{ type: "web_search" }], "no filters without lists");
  // Every other call: no xAI search (Coder's own calls search through the tool).
  await send({ model: "grok-4.7", tools: [], messages: [{ role: "user", content: "x" }] });
  assert.equal("tools" in bodies[2] || "max_turns" in bodies[2] || "include" in bodies[2] || "parallel_tool_calls" in bodies[2], false);
  assert.deepEqual(M.toResponsesTools([], { webSearch: { allowed_domains: [], excluded_domains: ["a.com"] } }), [{ type: "web_search", filters: { excluded_domains: ["a.com"] } }]);
});

test("WS4 the result in Claude Code's words: the query, the words before each search, each search's links as JSON (a title is the address when xAI gives none), \"No links found.\", \"Web search error: <code>\", the words after, the REMINDER line; Claude Code's result object for the hooks", () => {
  const out = [
    { type: "message", content: [{ type: "output_text", text: "Looking." }] },
    { type: "web_search_call", id: "ws_1", status: "completed", action: { type: "search", query: "a", sources: [{ type: "url", url: "https://a.example/x" }, { type: "url", url: "https://a.example/x" }, { type: "url", url: "https://b.example/y", title: "B" }, { type: "url", url: "javascript:alert(1)" }] } },
    { type: "web_search_call", id: "ws_2", status: "completed", action: { type: "search", query: "b", sources: [] } },
    { type: "web_search_call", id: "ws_3", status: "failed" },
    { type: "web_search_call", id: "ws_4", status: "completed", action: { type: "open_page", url: "https://c.example/" } },
    { type: "message", content: [{ type: "output_text", text: "Summary " }, { type: "output_text", text: "here." }] },
    { type: "message", content: [{ type: "output_text", text: "More." }] },
  ];
  const f = W.searchResults({ output: out, usage: { searches: 3 } }, "node latest", 1.5);
  assert.deepEqual(f, { query: "node latest", durationSeconds: 1.5, searchCount: 4, results: [
    "Looking.",
    { tool_use_id: "ws_1", content: [{ title: "https://a.example/x", url: "https://a.example/x" }, { title: "B", url: "https://b.example/y" }] },
    { tool_use_id: "ws_2", content: [] },
    "Web search error: failed",
    { tool_use_id: "ws_4", content: [{ title: "https://c.example/", url: "https://c.example/" }] },
    "Summary here.\n\nMore.",
  ] });
  assert.equal(W.searchText(f), 'Web search results for query: "node latest"\n\nLooking.\n\nLinks: [{"title":"https://a.example/x","url":"https://a.example/x"},{"title":"B","url":"https://b.example/y"}]\n\nNo links found.\n\nWeb search error: failed\n\nLinks: [{"title":"https://c.example/","url":"https://c.example/"}]\n\nSummary here.\n\nMore.\n\n\n' + REMINDER);
  assert.equal(W.searchShown(f), "https://a.example/x\nhttps://b.example/y\nhttps://c.example/");
  assert.equal(W.searchShown({ results: ["words"] }), "(searched)");
  // A client that gives only its searches and its words (no xAI items): the searches, then the words.
  assert.deepEqual(W.searchResults({ message: { content: "Node 24." }, searches: [{ query: "q", sources: ["https://n.example/"] }] }, "q", 0).results, [{ tool_use_id: "search-1", content: [{ title: "https://n.example/", url: "https://n.example/" }] }, "Node 24."]);
  assert.equal(W.searchText(W.searchResults({ output: [{ type: "message", content: [{ type: "output_text", text: "  " }] }] }, "q", 0)), 'Web search results for query: "q"\n\n\n' + REMINDER);
});

test("WS5 in the loop: Grok's web_search call runs as its own Grok call (the chat's model and effort), its step reads as before, Grok gets Claude Code's result, the call is counted in the usage, and the hooks see WebSearch with Claude Code's tool_input and result object", async () => {
  const hooks = { settings: { PreToolUse: [{ matcher: "WebSearch", hooks: [{ type: "command", command: "pre.sh" }] }], PostToolUse: [{ matcher: "WebSearch", hooks: [{ type: "command", command: "post.sh" }] }] } };
  const t = await job([say("", [call("web_search", { query: "node latest", blocked_domains: ["w3schools.com"], mode: "extended" }, "w1")]), say("Node 24.")], { hooks });
  assert.equal(t.r.status, "done");
  assert.equal(t.searches.length, 1);
  assert.deepEqual([t.searches[0].model, t.searches[0].effort, t.searches[0].webSearch, t.searches[0].messages[1].content], ["grok-4.7", "medium", { excluded_domains: ["w3schools.com"] }, "Perform a web search for the query: node latest"]);
  assert.equal(t.told("w1"), FOUND_TEXT);
  const step = t.events.find((e) => e.type === "bash" && e.id === "w1");
  assert.deepEqual([step.tool, step.verb, step.command], ["web_search", "Searched the web for", "\"node latest\""]);
  const res = t.events.find((e) => e.type === "result" && e.id === "w1");
  assert.deepEqual([res.code, res.output], [0, "https://nodejs.org/en/blog"]);
  assert.ok(t.r.usage.some((u) => u.searches === 1 && u.cost_ticks === 5000), "the search's own call is in the usage");
  const main = t.seen.filter((q) => !q.webSearch);
  // (Offered: one of the tools Claude Code defers, named in tool search's note until loaded; tool-search.test.mjs.)
  assert.ok(main.every((q) => q.webSearch === undefined) && main[0].messages.some((m) => m.toolsAnnounced && m.toolsAnnounced.added.includes("web_search")), "Coder's calls offer the tool, never xAI's own search");
  const pre = t.hookCalls.find((x) => x.hook_event_name === "PreToolUse");
  assert.deepEqual([pre.tool_name, pre.tool_input], ["WebSearch", { query: "node latest", blocked_domains: ["w3schools.com"] }], "after the input check: `mode` dropped");
  const post = t.hookCalls.find((x) => x.hook_event_name === "PostToolUse");
  assert.equal(post.tool_name, "WebSearch");
  assert.deepEqual({ ...post.tool_response, durationSeconds: 0 }, { query: "node latest", results: [{ tool_use_id: "ws_1", content: [{ title: "https://nodejs.org/en/blog", url: "https://nodejs.org/en/blog" }] }, "Node 24 is the latest."], durationSeconds: 0, searchCount: 1 });
  assert.equal(typeof post.tool_response.durationSeconds, "number");
  // An input check's refusal: before any hook, nothing run, the step said with its verb.
  const t2 = await job([say("", [call("web_search", { query: "n" }, "w2")]), say("ok")], { hooks });
  assert.equal(t2.searches.length + t2.hookCalls.length, 0);
  assert.match(t2.told("w2"), /^error: InputValidationError: \[\n  \{\n    "origin": "string",\n    "code": "too_small",/);
  assert.equal(t2.events.find((e) => e.type === "bash" && e.id === "w2").verb, "Searched the web for");
});

test("WS6 its permission as Claude Code's in Coder's chats: asked in Accept edits and Plan (\"Coder wants to search the web for: …\"), \"don't ask again\" saving WebSearch for the repository; an ask rule asks in every mode; an allow rule runs it; a deny rule takes it away; a hook's ask asks and its allow runs it", async () => {
  // Accept edits: the card, and "Yes, and don't ask again" saves the rule.
  let t = await job([say("", [call("web_search", { query: "node latest" }, "w1")]), say("", [call("web_search", { query: "node lts" }, "w2")]), say("Done.")], { mode: "acceptEdits", answers: [{ choice: "always" }] });
  const card = t.events.find((e) => e.type === "permission");
  assert.deepEqual([card.tool, card.id, card.what, card.rules, card.why], ["web_search", "w1", "Coder wants to search the web for: node latest", ["WebSearch"], undefined]);
  assert.equal(t.events.filter((e) => e.type === "permission").length, 1, "the second ran under the new rule");
  assert.equal(t.searches.length, 2);
  assert.deepEqual(t.r.rulesAdded, ["WebSearch"]);
  // No: nothing runs, Claude Code's words.
  t = await job([say("", [call("web_search", { query: "node latest" }, "w1")]), say("ok")], { mode: "acceptEdits", answers: [{ choice: "no" }] });
  assert.equal(t.searches.length, 0);
  assert.equal(t.told("w1"), P.REJECTED);
  assert.equal(t.events.find((e) => e.type === "result" && e.id === "w1").output, "Not run: you said no.");
  // Plan (its checker off): asked too.
  t = await job([say("", [call("web_search", { query: "node latest" }, "w1")]), say("ok")], { mode: "plan", checker: true, checkerInPlan: false });
  assert.equal(t.events.filter((e) => e.type === "permission").length, 1);
  assert.equal(t.checks.length, 0);
  // An ask rule: every mode, Auto too; its reason, no "don't ask again".
  t = await job([say("", [call("web_search", { query: "node latest" }, "w1")]), say("ok")], { mode: "auto", checker: true, rules: { allow: [], ask: ["WebSearch"], deny: [] } });
  const c2 = t.events.find((e) => e.type === "permission");
  assert.deepEqual([c2.why, c2.rules, c2.byRule, t.checks.length], ["Your rule WebSearch asks first for WebSearch.", undefined, true, 0]);
  // An allow rule: no card in Accept edits, no checker in Auto.
  t = await job([say("", [call("web_search", { query: "node latest" }, "w1")]), say("ok")], { mode: "acceptEdits", rules: { allow: ["WebSearch"], ask: [], deny: [] } });
  assert.deepEqual([t.events.filter((e) => e.type === "permission").length, t.searches.length], [0, 1]);
  t = await job([say("", [call("web_search", { query: "node latest" }, "w1")]), say("ok")], { mode: "auto", checker: true, rules: { allow: ["WebSearch"], ask: [], deny: [] } });
  assert.deepEqual([t.checks.length, t.searches.length], [0, 1]);
  // A deny rule: not offered; a call anyway refused in Claude Code's words.
  t = await job([say("", [call("web_search", { query: "node latest" }, "w1")]), say("ok")], { mode: "auto", rules: { allow: [], ask: [], deny: ["WebSearch"] } });
  assert.ok(!t.seen[0].tools.some((x) => x.function.name === "web_search"));
  assert.deepEqual([t.told("w1"), t.searches.length], ["Permission to use WebSearch has been denied.", 0]);
  // A PreToolUse hook's ask: a card with its reason; its allow: no card.
  const hookSaid = (decision) => ({ settings: { PreToolUse: [{ matcher: "WebSearch", hooks: [{ type: "command", command: "pre.sh" }] }] }, run: (input) => (input.hook_event_name === "PreToolUse" ? { stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: decision, permissionDecisionReason: "searches need a look" } }) } : {}) });
  t = await job([say("", [call("web_search", { query: "node latest" }, "w1")]), say("ok")], { mode: "auto", hooks: hookSaid("ask") });
  assert.equal(t.events.find((e) => e.type === "permission").why, "searches need a look");
  t = await job([say("", [call("web_search", { query: "node latest" }, "w1")]), say("ok")], { mode: "acceptEdits", hooks: hookSaid("allow") });
  assert.deepEqual([t.events.filter((e) => e.type === "permission").length, t.searches.length], [0, 1]);
  // A card that no one can answer: not run, said.
  t = await job([say("", [call("web_search", { query: "node latest" }, "w1")]), say("ok")], { mode: "acceptEdits", deps: { ask: undefined } });
  // (In Claude Code's words, as a page fetch's: "Claude requested permissions to use WebSearch, but you haven't granted it yet.")
  assert.deepEqual([t.told("w1"), t.searches.length], ["not run: Coder requested permissions to use WebSearch, but you haven't granted it yet.", 0]);
  // The card's PermissionRequest hooks see WebSearch, its input, and Claude Code's suggestion: a WebSearch allow rule for the
  // repository's local settings. A refused call (a deny rule) fires no PostToolUse hook: it never ran.
  const seenBy = { settings: { PermissionRequest: [{ matcher: "WebSearch", hooks: [{ type: "command", command: "perm.sh" }] }], PostToolUse: [{ matcher: "WebSearch", hooks: [{ type: "command", command: "post.sh" }] }] } };
  t = await job([say("", [call("web_search", { query: "node latest" }, "w1")]), say("ok")], { mode: "acceptEdits", hooks: seenBy });
  const pr = t.hookCalls.find((x) => x.hook_event_name === "PermissionRequest");
  assert.deepEqual([pr.tool_name, pr.tool_input, pr.permission_suggestions], ["WebSearch", { query: "node latest" }, [{ type: "addRules", rules: [{ toolName: "WebSearch" }], behavior: "allow", destination: "localSettings" }]]);
  t = await job([say("", [call("web_search", { query: "node latest" }, "w1")]), say("ok")], { mode: "auto", rules: { allow: [], ask: [], deny: ["WebSearch"] }, hooks: seenBy });
  assert.deepEqual([t.hookCalls.filter((x) => x.hook_event_name === "PostToolUse").length, t.events.find((e) => e.type === "result" && e.id === "w1").ran], [0, false]);
});

test("WS7 Auto mode's checker judges a search with its query, as Claude Code's classifier (and in Plan with Plan's checker on): a block is said in Claude Code's words and nothing runs; an allow runs it", async () => {
  let t = await job([say("", [call("web_search", { query: "node latest" }, "w1")]), say("ok")], { mode: "auto", checker: true, verdict: '{"decision":"block","rule":"Data Exfiltration","reason":"The query carries the owner\'s token."}' });
  assert.equal(t.checks.length, 1);
  assert.match(t.checks[0].messages[1].content, /THE ACTION TO JUDGE:\nweb_search: node latest$/);
  assert.equal(t.searches.length, 0);
  assert.equal(t.events.find((e) => e.type === "result" && e.id === "w1").output, C.blockedShown("Data Exfiltration", "The query carries the owner's token."));
  assert.equal(t.told("w1"), C.autoDenied("[Data Exfiltration] The query carries the owner's token."));
  t = await job([say("", [call("web_search", { query: "node latest" }, "w1")]), say("ok")], { mode: "auto", checker: true });
  assert.deepEqual([t.checks.length, t.searches.length, t.events.filter((e) => e.type === "permission").length], [1, 1, 0]);
  t = await job([say("", [call("web_search", { query: "node latest" }, "w1")]), say("ok")], { mode: "plan", checker: true });
  assert.deepEqual([t.checks.length, t.searches.length], [1, 1]);
  assert.match(t.checks[0].messages[0].content, /MODE: Plan\./);
  // What the checker is shown of an earlier search: its query, as Claude Code's classifier is.
  assert.equal(C.actionShown("web_search", { query: "node latest", allowed_domains: ["nodejs.org"] }), "web_search: node latest");
  assert.equal(C.checkerTranscript([{ role: "user", content: "go" }, { role: "assistant", content: "", tool_calls: [call("web_search", { query: "node latest" }, "w0")] }]), "[owner] go\n[Coder's action] web_search: node latest");
});

test("WS8 the chat's budget, Claude Code's: 200 searches shared by every agent of the chat, refilling about 100 an hour, its settings by Claude Code's rules, kept across the chat's messages; when it is used up the call does nothing and Coder is told so in Claude Code's words", async () => {
  assert.deepEqual([W.searchMaxOf(undefined), W.searchMaxOf("500"), W.searchMaxOf(" 7 "), W.searchMaxOf("0"), W.searchMaxOf("-3"), W.searchMaxOf("1e3"), W.searchMaxOf("abc")], [200, 500, 7, 200, 200, 200, 200]);
  assert.deepEqual([W.searchRefillsOf(undefined), W.searchRefillsOf("0"), W.searchRefillsOf("50"), W.searchRefillsOf(" 50"), W.searchRefillsOf("5.5")], [100, 0, 50, 100, 100]);
  // The count, refilling: 100 an hour gives one back every 36 seconds; the rate in use is the lower one when it changes.
  let clock = 0, saved = null;
  const keep = { load: () => saved, save: (o) => { saved = o; } };
  let b = W.searchBudget({ keep, max: 2, refills: 100, now: () => clock });
  assert.deepEqual([b.tryConsume(), b.tryConsume(), b.tryConsume()], [true, true, false]);
  assert.equal(b.msUntilNextCall(), 36_000);
  clock = 36_000;
  assert.deepEqual([b.tryConsume(), b.tryConsume()], [true, false]);
  // Kept: a new message of the chat (a new budget over the same file) goes on from there.
  b = W.searchBudget({ keep, max: 2, refills: 100, now: () => clock });
  assert.equal(b.tryConsume(), false);
  clock += 2 * 36_000;
  b = W.searchBudget({ keep, max: 2, refills: 100, now: () => clock });
  assert.deepEqual([b.tryConsume(), b.tryConsume(), b.tryConsume()], [true, true, false]);
  const off = W.searchBudget({ max: 1, refills: 0, now: () => 0 });
  assert.deepEqual([off.tryConsume(), off.tryConsume(), off.msUntilNextCall()], [true, false, Infinity]);
  // Claude Code's notice, with Coder's names ("the owner" for its "the user", 2026-11-14; a job from GitHub's: test WEB3).
  assert.equal(W.usedUpText({ max: 200, refills: 100 }), "Web search was not performed: this chat's web search budget is used up (limit: 200 web_search calls shared by every agent in this chat; the budget refills at about 100 calls per hour, so searching becomes possible again later in the chat). Do not pause or wait for the refill: continue with the information already gathered and say so in your answer; do not work around the limit by querying search engines with curl or wget from bash, by querying them in a browser or through a computer-use tool, or by searching or fetching through a third-party reader, proxy or archive service. If more searches are genuinely needed, ask the owner to raise CODER_MAX_WEB_SEARCHES_PER_SESSION.");
  assert.equal(W.usedUpText({ max: 1, refills: 0 }), "Web search was not performed: this chat's web search budget is used up (limit: 1 web_search call, shared by every agent in this chat; it does not refill). Continue with the information already gathered instead of searching again, and say so in your answer; do not work around the limit by querying search engines with curl or wget from bash, by querying them in a browser or through a computer-use tool, or by searching or fetching through a third-party reader, proxy or archive service. If more searches are genuinely needed, ask the owner to raise CODER_MAX_WEB_SEARCHES_PER_SESSION.");
  // In the loop: the chat's settings (CODER_MAX_WEB_SEARCHES_PER_SESSION, CODER_WEB_SEARCH_REFILLS_PER_HOUR) and its kept count.
  let kept = null;
  const t = await job([say("", [call("web_search", { query: "node latest" }, "w1"), call("web_search", { query: "node lts" }, "w2")]), say("ok")], { opts: { searchLimits: { max: "1", refills: "0" } }, deps: { searchKeep: { load: () => kept, save: (o) => { kept = o; } } }, hooks: { settings: { PostToolUse: [{ matcher: "WebSearch", hooks: [{ type: "command", command: "post.sh" }] }] } } });
  assert.equal(t.searches.length, 1);
  const notice = W.usedUpText({ max: 1, refills: 0 });
  assert.equal(t.told("w2"), 'Web search results for query: "node lts"\n\n' + notice + "\n\n\n" + REMINDER);
  assert.deepEqual([t.events.find((e) => e.type === "result" && e.id === "w2").code, t.events.find((e) => e.type === "result" && e.id === "w2").output], [0, notice]);
  const post = t.hookCalls.filter((x) => x.hook_event_name === "PostToolUse").at(-1);
  assert.deepEqual([post.tool_response.searchCount, post.tool_response.durationSeconds, post.tool_response.results], [0, 0, [notice]]);
  assert.equal(kept.used, 1);
  // The settings' names, from a repository's .claude/settings.json by Claude Code's (server.mjs's REPO_OWN_ENV), and the
  // count kept beside the chat's other state.
  assert.deepEqual([S.REPO_OWN_ENV.CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION, S.REPO_OWN_ENV.CLAUDE_CODE_WEB_SEARCH_REFILLS_PER_HOUR], ["CODER_MAX_WEB_SEARCHES_PER_SESSION", "CODER_WEB_SEARCH_REFILLS_PER_HOUR"]);
  const server = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(server, /searchKeep: checksKeep\(join\(memRoot, project \+ "\.searches\.json"\)\),/);
  assert.match(server, /t\.searchLimits = \{ max: rawVars\.CODER_MAX_WEB_SEARCHES_PER_SESSION, refills: rawVars\.CODER_WEB_SEARCH_REFILLS_PER_HOUR \};/);
  assert.match(server, /runCoder\(turnDeps, \{[^\n]*searchLimits: t\.searchLimits,/);
});

test("WS9 a search that fails: Coder's \"error: \" and the model client's words, or Claude Code's when the request ended with nothing; the step failed, and PostToolUseFailure hooks run", async () => {
  const hooks = { settings: { PostToolUseFailure: [{ matcher: "WebSearch", hooks: [{ type: "command", command: "fail.sh" }] }] } };
  let t = await job([say("", [call("web_search", { query: "node latest" }, "w1")]), say("ok")], { found: Object.assign(new Error("AI call failed: 500 upstream"), { status: 500 }), hooks });
  assert.equal(t.told("w1"), "error: AI call failed: 500 upstream");
  assert.equal(t.events.find((e) => e.type === "result" && e.id === "w1").code, 1);
  assert.equal(t.hookCalls.find((x) => x.hook_event_name === "PostToolUseFailure").error, "error: AI call failed: 500 upstream");
  const cut = new Error("The operation was aborted due to timeout"); cut.name = "TimeoutError";
  t = await job([say("", [call("web_search", { query: "node latest" }, "w1")]), say("ok")], { found: cut });
  assert.equal(t.told("w1"), "error: The search was cut off before any results arrived. Try again.");
});

test("WS10 Gloopy and its helpers search through the same tool, with no card (Gloopy's own permission settings), and share their chat's budget", async () => {
  const seen = [], searches = [], events = [];
  let main = 0, help = 0;
  const steps = [say("", [call("web_search", { query: "hotels rome" }, "g1")]), say("", [call("helpers", { tasks: [{ name: "Prices", task: "find prices" }] }, "g2")]), say("Here you go.")];
  const helperSteps = [say("", [call("web_search", { query: "rome prices" }, "h1")]), say("No more searches left.")];
  const r = await A.runCoder({
    send: async (req) => {
      seen.push(req);
      if (req.webSearch) { searches.push(req); return FOUND; }
      return /^HELPER SYSTEM/.test(String(req.messages[0].content)) ? helperSteps[Math.min(help++, 1)] : steps[Math.min(main++, 2)];
    },
    exec: async () => ({ code: 0, output: "ok\n" }), emit: (e) => events.push(e), here: () => "/home/g", root: "/home/g", chatId: "gloopy-ws",
    ask: async () => { throw new Error("no card for Gloopy's searches"); },
  }, { text: "find a hotel", mode: "acceptEdits", system: G.GLOOPY_SYSTEM, tools: G.GLOOPY_TOOLS, nudges: false, who: "Gloopy", helper: { system: "HELPER SYSTEM", tools: G.HELPER_TOOLS }, searchLimits: { max: "1", refills: "0" } });
  assert.equal(r.status, "done");
  assert.equal(events.filter((e) => e.type === "permission").length, 0);
  assert.equal(searches.length, 1, "the helper's search found the budget used");
  const helperTold = seen.filter((q) => /^HELPER SYSTEM/.test(String(q.messages[0].content))).at(-1).messages.find((m) => m.role === "tool").content;
  assert.match(helperTold, /^Web search results for query: "rome prices"\n\nWeb search was not performed: this chat's web search budget is used up/);
  assert.ok(seen.every((q) => !q.webSearch || searches.includes(q)) && seen.filter((q) => !q.webSearch).every((q) => q.webSearch === undefined), "no other call carries xAI's search");
  assert.ok(events.some((e) => e.type === "bash" && e.tool === "web_search" && /^“Prices” · /.test(e.command)), "the helper's step under its name");
  // Gloopy's words: its search is its web_search tool.
  assert.match(G.HELPER_SYSTEM, /- Your tools: web_search \(use it for anything current\), web_fetch/);
  assert.match(G.GLOOPY_SYSTEM, /web_search \(use it for anything current\), web_fetch \(a separate reader/);
});

test("WS11 Coder's context gives today's date as Claude Code's does (\"Today's date is …\"), after the memory, so the description's \"current month\" line works; the page's card for a search has its title", () => {
  const at = new Date(2026, 10, 14, 9, 30).getTime();
  assert.equal(S.todayLine(at), "Today's date is 2026-11-14.");
  const ctx = S.contextText([], "/m.md", "- tests: npm test", [], S.todayLine(at));
  assert.match(ctx, /YOUR MEMORY FOR THIS REPO[\s\S]*\n\nToday's date is 2026-11-14\.$/);
  assert.match(S.contextText([], "/m.md", ""), /\n\nToday's date is \d{4}-\d{2}-\d{2}\.$/, "today's, by default");
  const page = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  assert.match(page, /web_fetch: 'Fetch', web_search: 'Web search', pull_request:/);
  // The tool's file is on the machine's copy (CD78).
  const copy = readFileSync(new URL("../container/Dockerfile", import.meta.url), "utf8").split("\n").find((l) => /^COPY package\.json /.test(l));
  assert.ok(copy.includes(" coder-websearch.mjs "));
});

// ── THE RECHECK OF 2026-11-14 (the owner: "Fix base on Claude Code docs, please"): Claude Code 2.1.325's docs and program. ──
test("WEB1 WebSearch's rules as Claude Code 2.1.325 takes them: WebSearch(*) is the whole tool; a * or ? anywhere else is refused in its words (\"WebSearch does not support wildcards\"); a deny or ask rule on the query, WebSearch(query:<exact text>), matches that query", async () => {
  assert.deepEqual(P.parseRule("WebSearch(*)"), { tool: "WebSearch", spec: null });
  for (const r of ["WebSearch(x*)", "WebSearch(query:node*)", "WebSearch(what?)", "WebSearch( * )"]) {
    assert.equal(P.ruleProblem(r), "WebSearch does not support wildcards. Use exact search terms without * or ?. Examples: WebSearch(claude ai), WebSearch(typescript tutorial)", r);
    assert.equal(P.ruleSaved(r), false, r);
  }
  assert.deepEqual(P.parseRule("WebSearch(query: node latest )"), { tool: "WebSearch", spec: "query: node latest", param: { name: "query", value: "node latest" } });
  assert.equal(P.ruleSaved("WebSearch(query:node latest)"), true);
  assert.equal(P.parseRule("WebSearch(engine:bing)"), null, "not one of its inputs");
  const D = (rules, query) => W.searchDecision({ mode: "acceptEdits", rules, input: { query } });
  assert.deepEqual(D({ deny: ["WebSearch(query:node latest)"] }, "node latest"), { verdict: "deny", rule: "WebSearch(query:node latest)", why: "Permission to use WebSearch with query:node latest has been denied." });
  assert.deepEqual(D({ deny: ["WebSearch(query:node latest)"] }, "  node latest "), D({ deny: ["WebSearch(query:node latest)"] }, "node latest"), "the query's own spaces aside");
  assert.equal(D({ deny: ["WebSearch(query:node latest)"] }, "node lts").verdict, "ask", "another query: as before");
  assert.equal(D({ deny: ["WebSearch(query:node latest)"] }, "Node Latest").verdict, "ask", "the exact text");
  assert.deepEqual(D({ ask: ["WebSearch(query:node latest)"] }, "node latest"), { verdict: "ask", rule: "WebSearch(query:node latest)", why: "Your rule WebSearch(query:node latest) asks first for WebSearch.", byRule: true });
  assert.equal(W.searchDecision({ mode: "auto", rules: { ask: ["WebSearch(query:node latest)"] }, input: { query: "node latest" } }).verdict, "ask", "in Auto too");
  assert.equal(D({ allow: ["WebSearch(query:node latest)"] }, "node latest").verdict, "ask", "an allow rule on a value approves nothing");
  assert.equal(D({ deny: ["WebSearch(allowed_domains:a.com)"] }, "x").verdict, "ask", "a list is no scalar");
  // In the loop: denied in Claude Code's words, never searched; the tool stays offered for other queries.
  const t = await job([say("", [call("web_search", { query: "node latest" }, "w1"), call("web_search", { query: "node lts" }, "w2")]), say("ok")], { rules: { deny: ["WebSearch(query:node latest)"] } });
  assert.equal(t.told("w1"), "Permission to use WebSearch with query:node latest has been denied.");
  assert.equal(t.searches.length, 1);
  // (Offered: named in tool search's note as a deferred tool, as Claude Code defers its WebSearch; tool-search.test.mjs.)
  assert.ok(t.seen[0].messages.some((m) => m.toolsAnnounced && m.toolsAnnounced.added.includes("web_search")));
});

test("WEB2 at most 8 searches a call, Claude Code's max_uses: xAI's max_turns does not limit its searches (\"During a single turn, the model may invoke multiple tools in parallel\"), so the search's request has 8 turns of one tool call each (parallel_tool_calls off)", async () => {
  assert.deepEqual([W.SEARCH_MAX_USES, W.SEARCH_MAX_TURNS], [8, 8]);
  const q = W.searchRequest({ model: "grok-4.7", args: { query: "node latest" } });
  assert.deepEqual([q.maxTurns, q.parallelToolCalls], [8, false]);
  const bodies = [];
  const send = M.coderSend({ XAI_API_KEY: "k" }, { fetchFn: async (u, init) => { bodies.push(JSON.parse(init.body)); return new Response(JSON.stringify(FOUND)); } });
  await send(q);
  assert.deepEqual([bodies[0].max_turns, bodies[0].parallel_tool_calls], [8, false]);
  await send({ model: "grok-4.7", tools: [], messages: [{ role: "user", content: "x" }], parallelToolCalls: true });
  assert.equal("parallel_tool_calls" in bodies[1], false, "only a request that turns it off says so");
});

test("WEB3 a job started from GitHub counts its own searches, from none, with no refill unless the setting gives one, as Claude Code's non-interactive runs (\"the limit applies per turn, not per session\"), and is told so in Claude Code's words for a turn; the chat's own count is left alone", async () => {
  assert.equal(W.usedUpText({ max: 1, refills: 0, perTurn: true }), "Web search was not performed: this turn's web search budget is used up (limit: 1 web_search call per turn, shared by every agent in it). Continue with the information already gathered instead of searching again, and say so in your answer; do not work around the limit by querying search engines with curl or wget from bash, by querying them in a browser or through a computer-use tool, or by searching or fetching through a third-party reader, proxy or archive service. If more searches are genuinely needed, tell the owner they can send a follow-up message after this reply to continue the search, or ask them to raise CODER_MAX_WEB_SEARCHES_PER_SESSION.");
  assert.equal(W.usedUpText({ max: 200, refills: 50, perTurn: true }), "Web search was not performed: this turn's web search budget is used up (limit: 200 web_search calls shared by every agent in this turn; the budget refills at about 50 calls per hour, so searching becomes possible again later in the turn). Do not pause or wait for the refill: continue with the information already gathered and say so in your answer; do not work around the limit by querying search engines with curl or wget from bash, by querying them in a browser or through a computer-use tool, or by searching or fetching through a third-party reader, proxy or archive service. If more searches are genuinely needed, tell the owner they can send a follow-up message after this reply to continue the search, or ask them to raise CODER_MAX_WEB_SEARCHES_PER_SESSION.");
  assert.deepEqual([W.searchRefillsOf(undefined, 0), W.searchRefillsOf("50", 0), W.searchRefillsOf("x", 0), W.searchRefillsOf(undefined)], [0, 50, 0, 100]);
  // In the loop: a GitHub job with a chat count already at the limit still searches (its own count), up to its own limit.
  let kept = { used: 5, carry: 0, at: Date.now(), rate: 100 };
  const steps = [say("", [call("web_search", { query: "node latest" }, "w1"), call("web_search", { query: "node lts" }, "w2")]), say("ok")];
  const t = await job(steps, { mode: "auto", opts: { github: true, searchLimits: { max: "1" } }, deps: { searchKeep: { load: () => kept, save: (o) => { kept = o; } } } });
  assert.equal(t.searches.length, 1);
  assert.equal(t.told("w2"), 'Web search results for query: "node lts"\n\n' + W.usedUpText({ max: 1, refills: 0, perTurn: true }) + "\n\n\n" + REMINDER);
  assert.equal(kept.used, 5, "the chat's count untouched");
  // The chat's own job goes on from its count (at the limit: nothing searched).
  const c = await job(steps, { mode: "auto", opts: { searchLimits: { max: "5" } }, deps: { searchKeep: { load: () => kept, save: (o) => { kept = o; } } } });
  assert.equal(c.searches.length, 0);
  assert.match(c.told("w1"), /this chat's web search budget is used up/);
});

test("WEB4 an input whose only fault is a value is refused with zod's own issues, as Claude Code gives them (\"InputValidationError: [ … ]\", its w0); beside a missing, stray or wrongly typed field, each is listed in its words (checked against Claude Code 2.1.325's own zod)", () => {
  const raw = (issues) => "error: InputValidationError: " + JSON.stringify(issues, null, 2);
  const SHORT = { origin: "string", code: "too_small", minimum: 2, inclusive: true, path: ["query"], message: "Too small: expected string to have >=2 characters" };
  assert.deepEqual(W.checkInput({ query: "a" }), { error: raw([SHORT]) });
  assert.deepEqual(W.checkInput({ query: "\u{1F600}" }), { error: raw([SHORT]) }, "one character, as zod counts it");
  assert.deepEqual(W.checkInput({ query: "\u{1F600}a" }).args, { query: "\u{1F600}a" });
  assert.deepEqual(W.checkInput({ query: "a", x: 1 }), { error: "error: InputValidationError: web_search failed due to the following issues:\nAn unexpected parameter `x` was provided\nThe parameter `query` is invalid: Too small: expected string to have >=2 characters" });
  assert.deepEqual(W.checkInput({ query: ["a"] }), { error: "error: InputValidationError: web_search failed due to the following issues:\nThe parameter `query` type is expected as `string` but provided as `array`\nThe parameter `query` is invalid: Too small: expected array to have >=2 items" });
  assert.deepEqual(WF.checkInput({ url: "https://a.example", prompt: "p", offset: 1e20 }), { error: raw([{ code: "too_big", maximum: 9007199254740991, note: "Integers must be within the safe integer range.", origin: "int", inclusive: true, path: ["offset"], message: "Too big: expected int to be <=9007199254740991" }]) });
  assert.deepEqual(WF.checkInput({ url: "https://a.example", prompt: "p", offset: -1e20 }), { error: raw([{ code: "too_small", minimum: -9007199254740991, note: "Integers must be within the safe integer range.", origin: "int", inclusive: true, path: ["offset"], message: "Too small: expected int to be >=-9007199254740991" }, { origin: "number", code: "too_small", minimum: 0, inclusive: true, path: ["offset"], message: "Too small: expected number to be >=0" }]) });
  assert.deepEqual(WF.checkInput({ url: "bad", prompt: "p", offset: "-3" }), { error: raw([{ code: "invalid_format", format: "url", path: ["url"], message: "Invalid URL" }, { origin: "number", code: "too_small", minimum: 0, inclusive: true, path: ["offset"], message: "Too small: expected number to be >=0" }]) });
  assert.deepEqual(WF.checkInput({ url: "bad", prompt: "p", a: 1, b: 2 }), { error: "error: InputValidationError: web_fetch failed due to the following issues:\nAn unexpected parameter `a` was provided\nAn unexpected parameter `b` was provided\nThe parameter `url` is invalid: Invalid URL" });
  // Claude Code's formatter itself (coder-issues.mjs): a long message cut at 500 characters, more than 20 listed as a count.
  const many = Array.from({ length: 22 }, (_, i) => ({ code: "custom", path: ["p" + i], message: i === 0 ? "x".repeat(600) : "bad" }));
  const text = ISSUES.issuesText("T", [{ expected: "string", code: "invalid_type", path: ["q"], message: "Invalid input: expected string, received undefined" }, ...many]);
  assert.ok(text.startsWith("T failed due to the following issues:\nThe required parameter `q` is missing\nThe parameter `p0` is invalid: " + "x".repeat(500) + "… [+100 chars]\n"));
  assert.ok(text.endsWith("The parameter `p19` is invalid: bad\n(2 more issues not listed)"));
});
