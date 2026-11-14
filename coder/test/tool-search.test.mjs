// CLAUDE CODE'S TOOL SEARCH IN CODER'S CHATS (the owner, 2026-11-14: "yes start on that"; container/coder-toolsearch.mjs):
// Claude Code 2.1.325 holds back the tools it defers (its built-in ones with shouldDefer, and MCP tools), names them in a
// message from the system, and loads the ones the model asks for with its ToolSearch tool. Coder copies it: which tools,
// the tool's words, its search, its result, the announcement, ENABLE_TOOL_SEARCH, the hooks, a tool called before it was
// loaded, and a loaded tool kept for the rest of the chat (the next message, a summary).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const T = await import("../container/coder-toolsearch.mjs");
const A = await import("../container/coder-agent.mjs");
const H = await import("../container/coder-hooks.mjs");
const C = await import("../container/coder-compact.mjs");
const I = await import("../container/coder-inputs.mjs");
const PL = await import("../container/coder-plan.mjs");
const K = await import("../container/coder-tasks.mjs");
const S = await import("../container/server.mjs");
const SUM = await import("../src/coder-summary.mjs");
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const ROOT = "/work/shop";
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const names = (req) => req.tools.map((t) => t.function.name);
/** Coder's loop on a pretend machine: Grok answers `steps` in turn; hooks answered by `hookRun(input)`. */
async function job(steps, { messages = [], deps: more = {}, extra = {}, hooks = null, hookRun = () => ({}) } = {}) {
  const events = [], seen = [], hookCalls = [], ran = [];
  let n = 0;
  const r = await A.runCoder({
    send: async (req) => { seen.push(JSON.parse(JSON.stringify(req))); return steps[Math.min(n++, steps.length - 1)]; },
    exec: async (x) => {
      const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
      if (mark && x.hook === true) {
        const input = JSON.parse(x.payload);
        hookCalls.push(input);
        const a = (await hookRun(input)) || {};
        return { code: Number.isInteger(a.code) ? a.code : 0, output: String(a.stdout || "") + "\n" + mark[0] + "\n" + String(a.stderr || "") };
      }
      ran.push(x);
      return { code: 0, output: "ok\n" };
    },
    emit: (e) => events.push(e),
    here: () => ROOT, root: ROOT, chatId: "shop-ts", where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p),
    ask: async () => ({ choice: "yes" }),
    ...more,
  }, { text: "go", mode: "auto", messages, ...(hooks ? { hooks: H.hooksFrom({ hooks }, "settings").list } : {}), ...extra });
  const told = (id) => { for (const m of r.messages) if (m.role === "tool" && m.tool_call_id === id) return m.content; return undefined; };
  return { r, events, seen, hookCalls, ran, told };
}
const connector = (i, extra = {}) => ({ name: "mcp__linear__tool_" + i, label: "Linear: tool " + i, description: "From the Linear connector (MCP). Tool " + i + " of Linear.", parameters: { type: "object", properties: { id: { type: "string" } } }, readOnly: true, perm: "allow", ...extra });

test("TS1 Claude Code's ToolSearch is Coder's tool_search: its description word for word (2.1.325's lRo as a Claude Code cloud session gives it, Coder's tool names in its example), its inputs as Claude Code sends them, its result words; hooks and rules know it as ToolSearch; its input check runs before any hook", () => {
  const d = T.TOOL_SEARCH_TOOL.function;
  assert.equal(d.name, "tool_search");
  assert.equal(d.description, "Fetches full schema definitions for deferred tools so they can be called.\n\nDeferred tools appear by name in a message from the system. Until fetched, only the name is known — there is no parameter schema, so the tool cannot be invoked. This tool takes a query, matches it against the deferred tool list, and returns the matched tools' complete JSONSchema definitions inside a <functions> block. Once a tool's schema appears in that result, it is callable exactly like any tool defined at the top of the prompt.\n\nResult format: each matched tool appears as one <function>{\"description\": \"...\", \"name\": \"...\", \"parameters\": {...}}</function> line inside the <functions> block — the same encoding as the tool list at the top of this prompt.\n\nQuery forms:\n- \"select:read,edit,grep\" — fetch these exact tools by name\n- \"notebook jupyter\" — keyword search, up to max_results best matches\n- \"+slack send\" — require \"slack\" in the name, rank by remaining terms");
  assert.deepEqual(d.parameters, { type: "object", properties: { query: { type: "string", description: "Query to find deferred tools. Use \"select:<tool_name>\" for direct selection, or keywords to search." }, max_results: { type: "number", default: 5, description: "Maximum number of results to return (default: 5)" } }, required: ["query", "max_results"], additionalProperties: false });
  assert.equal(T.NO_MATCH, "No matching deferred tools found");
  assert.equal(T.DEFERRED_NOW, "The following deferred tools are now available via tool_search. Their schemas are NOT loaded — calling them directly will fail with InputValidationError. Use tool_search with query \"select:<name>[,<name>...]\" to load tool schemas before calling them:");
  assert.equal(H.ccTool("tool_search"), "ToolSearch");
  assert.equal(I.inputCheckFor("tool_search"), T.checkToolSearchInput);
  // (Its input: zod's object, max_results 5 by default, other keys dropped; refused quietly, in Claude Code's words.)
  assert.deepEqual(T.checkToolSearchInput({ query: "select:lsp", extra: 1 }), { args: { query: "select:lsp", max_results: 5 } });
  assert.deepEqual(T.checkToolSearchInput({}), { error: "error: InputValidationError: tool_search failed due to the following issue:\nThe required parameter `query` is missing", quiet: true });
  assert.deepEqual(T.checkToolSearchInput({ query: "x", max_results: "3" }), { error: "error: InputValidationError: tool_search failed due to the following issue:\nThe parameter `max_results` type is expected as `number` but provided as `string`", quiet: true });
  // (Worker-safe: the Worker loads it through coder-compact.mjs. The machine copies it.)
  assert.ok(!/from "node:/.test(read("container/coder-toolsearch.mjs")));
  assert.match(read("container/Dockerfile"), /COPY package\.json [^\n]* coder-toolsearch\.mjs [^\n]*\.\//);
});

test("TS2 the tools Claude Code 2.1.325 defers, in Coder's names (its shouldDefer: LSP, WebFetch, WebSearch, Monitor, TaskStop, TodoWrite, the four Task tools, EnterPlanMode, ExitPlanMode); the others load upfront, Claude Code's cloud tools (request_secret, the environment tools) and Coder's own included; every connector unless marked alwaysLoad", () => {
  assert.deepEqual([...T.DEFERRED_TOOLS], ["lsp", "web_fetch", "web_search", "monitor", "stop_job", "todo_write", "task_create", "task_get", "task_list", "task_update", "enter_plan_mode", "exit_plan_mode"]);
  const all = [...A.CODER_TOOLS, PL.EXIT_PLAN_TOOL, K.TODO_WRITE_TOOL].map((t) => t.function.name);
  for (const n of T.DEFERRED_TOOLS) assert.ok(all.includes(n), n + " is one of Coder's tools");
  for (const n of ["bash", "read", "edit", "write", "grep", "glob", "ask_user", "request_secret", "get_environment", "update_environment", "create_environment", "switch_environment", "list_environments", "review", "pr_comments", "undo_last_job", "auto_fix", "notify", "reply_review", "pull_request", "powershell", "tool_search"]) assert.equal(T.isDeferred(n), false, n + " loads upfront");
  assert.equal(T.isDeferred("mcp__linear__create_issue"), true);
  assert.equal(T.isDeferred("mcp__linear__create_issue", new Set(["mcp__linear__create_issue"])), false, "a connector tool marked alwaysLoad");
  // Claude Code's search hints, matched by a keyword search.
  assert.equal(T.SEARCH_HINTS.lsp, "code intelligence (definitions, references, symbols, hover)");
  assert.equal(T.SEARCH_HINTS.web_fetch, "fetch and extract content from a URL");
  assert.equal(T.SEARCH_HINTS.exit_plan_mode, "present plan for approval and start coding (plan mode only)");
});

test("TS3 ENABLE_TOOL_SEARCH read as Claude Code reads it (its zde, Xpt, tzs): unset or true on, false off, auto past 10% of the context (auto:N, N%; auto:0 always, auto:100 never), the threshold in characters at 2.5 a token of Grok 4.7's 500,000", () => {
  const m = (v) => T.searchMode(v).mode;
  for (const v of [undefined, "", "true", "1", "YES", " on ", "whatever"]) assert.equal(m(v), "tst", String(v));
  for (const v of ["false", "0", "No", "OFF"]) assert.equal(m(v), "standard", v);
  assert.deepEqual(T.searchMode("auto"), { mode: "tst-auto", pct: 10 });
  assert.deepEqual(T.searchMode("auto:5"), { mode: "tst-auto", pct: 5 });
  assert.deepEqual(T.searchMode("auto:250"), { mode: "standard", pct: 100 });
  assert.equal(m("auto:0"), "tst");
  assert.equal(m("auto:100"), "standard");
  assert.deepEqual(T.searchMode("auto:x"), { mode: "tst-auto", pct: 10 }, "N not a number: 10%");
  assert.equal(m("AUTO"), "tst", "auto is matched as written");
  assert.equal(T.autoThreshold(10), 125_000);
  assert.equal(T.autoThreshold(5), 62_500);
});

test("TS4 on or off for a job (its Hbo): a deny rule on ToolSearch, false, a chat that already ran without it (unset only, until a summary), auto under its threshold, or nothing to defer turn it off; auto stays on in a chat that had it", () => {
  const def = [{ type: "function", function: { name: "lsp", description: "x".repeat(10), parameters: {} } }];
  const fresh = T.toolSearchRecord([]);
  const old = T.toolSearchRecord([{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }]);
  const had = T.toolSearchRecord([{ role: "user", content: "hi" }, { role: "tool", tool_call_id: "a", content: "x", toolsLoaded: [] }]);
  assert.deepEqual(T.decideToolSearch({ value: undefined, record: fresh, deferred: def }), { on: true, why: "tst_enabled" });
  assert.deepEqual(T.decideToolSearch({ value: undefined, record: fresh, deferred: def, denied: true }), { on: false, why: "mcp_search_unavailable" });
  assert.deepEqual(T.decideToolSearch({ value: "false", record: fresh, deferred: def }), { on: false, why: "standard_mode" });
  assert.deepEqual(T.decideToolSearch({ value: undefined, record: old, deferred: def }), { on: false, why: "held_off" });
  assert.deepEqual(T.decideToolSearch({ value: "true", record: old, deferred: def }), { on: true, why: "tst_enabled" }, "ENABLE_TOOL_SEARCH=true overrides the hold");
  assert.deepEqual(T.decideToolSearch({ value: "auto", record: fresh, deferred: def }), { on: false, why: "auto_below_threshold" });
  assert.deepEqual(T.decideToolSearch({ value: "auto", record: had, deferred: def }), { on: true, why: "auto_held" });
  const big = [{ type: "function", function: { name: "mcp__x__y", description: "d".repeat(130_000), parameters: {} } }];
  assert.deepEqual(T.decideToolSearch({ value: "auto", record: fresh, deferred: big }), { on: true, why: "auto_above_threshold" });
  assert.deepEqual(T.decideToolSearch({ value: undefined, record: fresh, deferred: [] }), { on: false, why: "no_deferred_tools" });
  assert.deepEqual(T.decideToolSearch({ value: undefined, record: had, deferred: [] }), { on: true, why: "tst_enabled" });
  // A summary made since Coder has tool search starts the chat afresh, as Claude Code's compaction does.
  const summarized = T.toolSearchRecord([C.summaryMessage("s", "the earlier jobs", [], [{ role: "assistant", content: "x" }]), { role: "user", content: "hi" }, { role: "assistant", content: "hello" }]);
  assert.equal(summarized.ranWithout, false);
});

test("TS5 the chat's record of tool search, read from its messages: the tools loaded (in the order first loaded, a summary's carried ones too), the names announced and taken back", () => {
  const msgs = [
    { role: "user", content: "s", toolsLoaded: ["web_fetch"], toolSearchOn: true },
    { role: "user", appNote: true, content: "n", toolsAnnounced: { added: ["lsp", "monitor", "mcp__a__b"], removed: [] } },
    { role: "tool", tool_call_id: "1", content: "x", toolsLoaded: ["lsp", "web_fetch"] },
    { role: "user", appNote: true, content: "n", toolsAnnounced: { added: [], removed: ["mcp__a__b"] } },
  ];
  const r = T.toolSearchRecord(msgs);
  assert.deepEqual([...r.loaded], ["web_fetch", "lsp"]);
  assert.deepEqual([...r.announced].sort(), ["lsp", "monitor"]);
  assert.equal(r.declared, true);
  assert.deepEqual(T.toolsLoadedIn(msgs), ["web_fetch", "lsp"]);
  assert.equal(T.toolSearchOnIn([{ role: "assistant", content: "x" }]), false);
});

test("TS6 its search, as Claude Code's (its COs, ide and y1t): select by exact names in the order named (a connector tool by its short name too); keywords: an exact name, an mcp__ prefix, +required words, its scores (name parts, search hint, description) and max_results; nothing found says so", () => {
  const fn = (name, description, parameters = { type: "object", properties: {} }) => ({ type: "function", function: { name, description, parameters } });
  const pool = [fn("bash", "Run a shell command"), fn("lsp", "Code intelligence"), fn("web_fetch", "Fetch a page"), fn("web_search", "Search the web"), fn("mcp__slack__send_message", "Send a message to a Slack channel"), fn("mcp__slack__read_channel", "Read a channel"), fn("mcp__linear__create_issue", "Create an issue"), fn("mcp__jira__create_issue", "Create an issue")];
  const deferred = new Set(["lsp", "web_fetch", "web_search", "mcp__slack__send_message", "mcp__slack__read_channel", "mcp__linear__create_issue", "mcp__jira__create_issue"]);
  const run = (query, max) => T.runToolSearch({ query, max_results: max === undefined ? 5 : max }, { pool, deferred });
  assert.deepEqual(run("select:web_search,lsp").matches, ["web_search", "lsp"]);
  assert.deepEqual(run("select:create_issue").matches, ["mcp__linear__create_issue", "mcp__jira__create_issue"], "connector tools by their short name");
  assert.deepEqual(run("select:bash").matches, ["bash"], "an upfront tool's definition is given too");
  assert.deepEqual(run("select:nope").matches, []);
  assert.equal(run("select:nope").text, "No matching deferred tools found");
  assert.deepEqual(run("WEB_FETCH").matches, ["web_fetch"], "an exact name, any case");
  assert.deepEqual(run("mcp__slack").matches, ["mcp__slack__send_message", "mcp__slack__read_channel"]);
  assert.deepEqual(run("+slack send").matches, ["mcp__slack__send_message", "mcp__slack__read_channel"], "send scores the first higher");
  assert.deepEqual(run("+linear send").matches, ["mcp__linear__create_issue"]);
  assert.deepEqual(run("web").matches, ["web_search", "web_fetch"], "13 each for the name; web_search's search hint (4) and description (2) put it first");
  assert.deepEqual(run("web", 1).matches, ["web_search"]);
  assert.deepEqual(run("issue").matches, ["mcp__linear__create_issue", "mcp__jira__create_issue"], "ties in the chat's order");
  assert.deepEqual(run("code intelligence definitions").matches, ["lsp"], "its search hint and description");
  assert.deepEqual(run("zebra").matches, []);
  const r = run("select:lsp");
  assert.deepEqual(r.facts, { matches: ["lsp"], query: "select:lsp", total_deferred_tools: 7 });
  assert.deepEqual(r.loaded, ["lsp"]);
  assert.deepEqual(run("select:bash").loaded, [], "an upfront tool is not one to load");
  // Its limits: a keyword query to its first 32 words, a select to its first 64 names.
  assert.equal(T.normalQuery(Array.from({ length: 40 }, (_, i) => "w" + i).join(" ")).split(" ").length, 32);
  assert.equal(T.normalQuery("select:" + Array.from({ length: 70 }, (_, i) => "t" + i).join(",")).split(",").length, 64);
  // A keyword query that names a tool already loaded upfront by a connector tool's short name: Claude Code's note.
  const up = T.runToolSearch({ query: "create_issue", max_results: 5 }, { pool, deferred: new Set(["lsp"]) });
  assert.equal(up.note, "Already available in this conversation: mcp__linear__create_issue, mcp__jira__create_issue. Call whichever you need directly.");
  const one = T.runToolSearch({ query: "send_message", max_results: 5 }, { pool, deferred: new Set(["lsp"]) });
  assert.equal(one.note, "Already available in this conversation: mcp__slack__send_message. Call it directly.");
  assert.equal(T.runToolSearch({ query: "send_message", max_results: 5 }, { pool, deferred }).note, "", "not when it is deferred");
});

test("TS7 its result is the loaded tools' definitions as the API gives them to Claude (a Claude Code cloud session's own ToolSearch result read 2026-11-14): a <functions> block, one <function> line each, keys sorted, \", \" and \": \" between them, other characters as they are", () => {
  const t = { type: "function", function: { name: "stop_job", description: "Stop a job — now.\n", parameters: { type: "object", required: ["job"], properties: { job: { type: "string", description: "Its \"id\"" } }, additionalProperties: false } } };
  assert.equal(T.functionsBlock([t, t]), "<functions>\n<function>{\"description\": \"Stop a job — now.\\n\", \"name\": \"stop_job\", \"parameters\": {\"additionalProperties\": false, \"properties\": {\"job\": {\"description\": \"Its \\\"id\\\"\", \"type\": \"string\"}}, \"required\": [\"job\"], \"type\": \"object\"}}</function>\n<function>{\"description\": \"Stop a job — now.\\n\", \"name\": \"stop_job\", \"parameters\": {\"additionalProperties\": false, \"properties\": {\"job\": {\"description\": \"Its \\\"id\\\"\", \"type\": \"string\"}}, \"required\": [\"job\"], \"type\": \"object\"}}</function>\n</functions>");
});

test("TS8 in a chat (ENABLE_TOOL_SEARCH unset): the first request leaves the deferred tools out and has tool_search; a note after the owner's message names them, sorted; a select loads them, its result their definitions, and from the next request they are sent after the others, in the order loaded; the next message keeps them and is told nothing again", async () => {
  const off = await job([say("done")], { deps: { toolSearch: "false" } });
  const on = await job([say("", [call("tool_search", { query: "select:web_fetch,task_create", max_results: 5 }, "s1")]), say("", [call("tool_search", { query: "lsp", max_results: 5 }, "s2")]), say("done")]);
  const first = on.seen[0];
  for (const n of T.DEFERRED_TOOLS) assert.ok(!names(first).includes(n), n + " is held back");
  assert.ok(names(first).includes("tool_search") && names(first).includes("bash") && names(first).includes("request_secret"));
  assert.ok(!names(off.seen[0]).includes("tool_search") && names(off.seen[0]).includes("web_fetch"), "ENABLE_TOOL_SEARCH=false: every tool upfront");
  // What the first request saves (2026-11-14: 70,563 characters of tool definitions without it, 52,972 with it).
  const size = (req) => JSON.stringify(req.tools).length;
  assert.ok(size(off.seen[0]) - size(first) > 15_000, "about 17,600 characters fewer");
  const note = first.messages.find((m) => m.role === "user" && String(m.content).includes("deferred tools are now available"));
  assert.equal(note.content, "(Note from Coder's app, not the owner:\n" + T.DEFERRED_NOW + "\nenter_plan_mode\nexit_plan_mode\nlsp\nmonitor\nstop_job\ntask_create\ntask_get\ntask_list\ntask_update\nweb_fetch\nweb_search)");
  const at = first.messages.indexOf(note);
  assert.equal(first.messages[at - 1].content, "go", "right after the owner's message");
  assert.equal(on.events.filter((e) => e.type === "bash").length, 0, "the chat shows no line for tool_search");
  // The select's result: the definitions, kept with the loaded names.
  const r1 = on.r.messages.find((m) => m.role === "tool" && m.tool_call_id === "s1");
  const def = (n) => on.seen[0].tools.concat(off.seen[0].tools).find((t) => t.function.name === n);
  assert.equal(r1.content, T.functionsBlock([def("web_fetch"), def("task_create")]));
  assert.deepEqual(r1.toolsLoaded, ["web_fetch", "task_create"]);
  assert.deepEqual(names(on.seen[1]), [...names(first), "web_fetch", "task_create"], "added at the end, in the order loaded");
  assert.deepEqual(names(on.seen[2]), [...names(first), "web_fetch", "task_create", "lsp"]);
  // The next message: the loaded tools still sent, nothing announced again; Grok never sees the records.
  const next = await job([say("ok")], { messages: on.r.messages });
  assert.deepEqual(names(next.seen[0]), names(on.seen[2]));
  assert.equal(next.seen[0].messages.filter((m) => String(m.content).includes("deferred tools are now available")).length, 1);
  const { toResponsesInput } = await import("../container/coder-model.mjs");
  assert.ok(!JSON.stringify(toResponsesInput(next.seen[0].messages)).includes("toolsLoaded"));
});

test("TS9 ENABLE_TOOL_SEARCH from the chat's environment, or the repository's .claude/settings.json env (one of the variables Claude Code applies from any settings file); false sends every tool, connectors included, with no connector_search", async () => {
  assert.equal(S.REPO_OWN_ENV.ENABLE_TOOL_SEARCH, "ENABLE_TOOL_SEARCH");
  assert.match(read("container/server.mjs"), /toolSearch: rawVars\.ENABLE_TOOL_SEARCH,/);
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "coder-ts-"));
  try {
    mkdirSync(join(dir, ".claude"));
    writeFileSync(join(dir, ".claude", "settings.json"), JSON.stringify({ env: { ENABLE_TOOL_SEARCH: "false" } }));
    const own = S.repoSettings(dir).own;
    assert.equal(S.withRepoOwn({}, own).ENABLE_TOOL_SEARCH, "false", "the repository's");
    assert.equal(S.withRepoOwn({ ENABLE_TOOL_SEARCH: "auto" }, own).ENABLE_TOOL_SEARCH, "auto", "the chat's environment wins");
  } finally { rmSync(dir, { recursive: true, force: true }); }
  const many = Array.from({ length: 120 }, (_, i) => connector(i, { description: "From the Linear connector (MCP). " + "d".repeat(1200) }));
  const { seen } = await job([say("done")], { deps: { toolSearch: "false", mcp: async () => ({ text: "ok", isError: false }) }, extra: { connectors: many } });
  const n = names(seen[0]);
  assert.ok(!n.includes("tool_search") && !n.includes("connector_search"));
  assert.equal(n.filter((x) => x.startsWith("mcp__")).length, 80, "all of them (at most 80), upfront");
});

test("TS10 connectors are deferred unless their server marks a tool alwaysLoad: named in the note, loaded by a search with their description up to 16,384 characters; one called before it is loaded still runs; Gloopy keeps connector_search", async () => {
  const ran = [];
  const tools = [connector(1, { description: "From the Linear connector (MCP). " + "a".repeat(5000) }), connector(2, { alwaysLoad: true })];
  const r = await job([say("", [call("tool_search", { query: "select:mcp__linear__tool_1", max_results: 5 }, "s1")]), say("", [call("mcp__linear__tool_1", { id: "1" }, "c1")]), say("done")], { deps: { mcp: async (n) => { ran.push(n); return { text: "fine", isError: false }; } }, extra: { connectors: tools } });
  const first = names(r.seen[0]);
  assert.ok(first.includes("mcp__linear__tool_2") && !first.includes("mcp__linear__tool_1"));
  assert.ok(first.indexOf("tool_search") < first.indexOf("mcp__linear__tool_2"), "tool_search before the connectors");
  assert.ok(r.seen[0].messages.some((m) => String(m.content).includes("\nmcp__linear__tool_1\n")));
  const loaded = r.seen[1].tools.find((t) => t.function.name === "mcp__linear__tool_1");
  assert.equal(loaded.function.description.length, "From the Linear connector (MCP). ".length + 5000, "past 4,096 characters");
  assert.deepEqual(ran, ["mcp__linear__tool_1"]);
  // Not loaded, called anyway: it runs (Claude Code runs a deferred tool whose input is good).
  const ran2 = [];
  await job([say("", [call("mcp__linear__tool_1", { id: "1" }, "c1")]), say("done")], { deps: { mcp: async (n) => { ran2.push(n); return { text: "fine", isError: false }; } }, extra: { connectors: tools } });
  assert.deepEqual(ran2, ["mcp__linear__tool_1"]);
  // Gloopy (an agent with its own tools) is unchanged: connector_search past its threshold.
  assert.match(read("container/coder-agent.mjs"), /const mcpDeferred = !!offered && mcpTools\.length > 0 && deferConnectors\(mcpTools\);/);
});

test("TS11 a deferred tool called before it was loaded, with an input its check refuses: the error, then Claude Code's note (its rWs) with the tool's schema; once loaded, the error alone; one with a good input runs without loading", async () => {
  const r = await job([say("", [call("task_get", { task: 3 }, "g1")]), say("", [call("tool_search", { query: "select:task_get", max_results: 5 }, "s1")]), say("", [call("task_get", { task: 3 }, "g2")]), say("", [call("task_list", {}, "l1")]), say("done")]);
  const def = A.CODER_TOOLS.find((t) => t.function.name === "task_get");
  const first = r.told("g1");
  assert.ok(first.startsWith("error: InputValidationError: "), first);
  assert.ok(first.endsWith("\n\nThis tool's schema was not sent to the API — it was not in the discovered-tool set derived from message history. Without the schema in your prompt, typed parameters (arrays, numbers, booleans) get emitted as strings and the client-side parser rejects them. Load the tool first: call tool_search with query \"select:task_get\", then retry this call. For reference, this tool's input schema is: " + JSON.stringify(def.function.parameters)));
  assert.ok(!r.told("g2").includes("discovered-tool set"), "loaded now");
  assert.ok(!r.told("l1").startsWith("error"), "task_list ran, not loaded: " + r.told("l1"));
  // (With tool search off, never.)
  const off = await job([say("", [call("task_get", { task: 3 }, "g1")]), say("done")], { deps: { toolSearch: "false" } });
  assert.ok(!off.told("g1").includes("discovered-tool set"));
});

test("TS12 hooks see it as ToolSearch (Claude Code runs them for it as for any tool): PreToolUse with its input (max_results filled in), PostToolUse with its result object; a deny rule on ToolSearch turns tool search off", async () => {
  const hooks = { PreToolUse: [{ matcher: "ToolSearch", hooks: [{ type: "command", command: "pre" }] }], PostToolUse: [{ matcher: "ToolSearch", hooks: [{ type: "command", command: "post" }] }] };
  const r = await job([say("", [call("tool_search", { query: "select:lsp" }, "s1")]), say("done")], { hooks });
  const pre = r.hookCalls.find((x) => x.hook_event_name === "PreToolUse"), post = r.hookCalls.find((x) => x.hook_event_name === "PostToolUse");
  assert.equal(pre.tool_name, "ToolSearch");
  assert.deepEqual(pre.tool_input, { query: "select:lsp", max_results: 5 });
  assert.deepEqual(post.tool_response, { matches: ["lsp"], query: "select:lsp", total_deferred_tools: 11 });
  const denied = await job([say("done")], { extra: { rules: { deny: ["ToolSearch"] } } });
  assert.ok(!names(denied.seen[0]).includes("tool_search") && names(denied.seen[0]).includes("web_fetch"), "every tool upfront");
});

test("TS13 a loaded tool stays after a summary (Claude Code carries them on its compact boundary): a summary's message keeps them, the Worker's and the job's own; after it the deferred tools not loaded are named again", async () => {
  const part = [{ role: "assistant", content: "" }, { role: "tool", tool_call_id: "s1", content: "<functions>…", toolsLoaded: ["lsp"] }];
  const s = C.summaryMessage("what happened", "the earlier jobs", [], part);
  assert.deepEqual(s.toolsLoaded, ["lsp"]);
  assert.equal(s.toolSearchOn, true);
  assert.deepEqual(C.summaryMessage("x", "y").toolsLoaded, undefined, "no part, no record");
  // The Worker's summary before a job (compactHistory) and Rewind's and /compact's on the Worker pass what they summarize.
  const msgs = [{ role: "user", content: "a".repeat(200) }, ...part, { role: "assistant", content: "ok" }, { role: "user", content: "b" }, { role: "assistant", content: "ok" }, { role: "user", content: "c" }, { role: "assistant", content: "ok" }, { role: "user", content: "d" }, { role: "assistant", content: "ok" }];
  const out = await SUM.compactHistory(msgs, async () => "summary", { at: 10 });
  assert.deepEqual(out.messages[0].toolsLoaded, ["lsp"]);
  assert.match(read("src/coder-routes.mjs"), /filesTouched\(msgs\.slice\(from, to\)\), msgs\.slice\(from, to\)\)/);
  assert.match(read("src/coder-routes.mjs"), /filesTouched\(msgs\), msgs\)\]/);
  // The owner's /compact in a job, then the next message: lsp still sent, the others named again.
  const first = await job([say("", [call("tool_search", { query: "select:lsp", max_results: 5 }, "s1")]), say("done")]);
  const compacted = await job([say("the summary")], { messages: first.r.messages, extra: { compact: { focus: "" } } });
  assert.equal(compacted.r.messages.length, 1);
  assert.deepEqual(compacted.r.messages[0].toolsLoaded, ["lsp"]);
  const after = await job([say("ok")], { messages: compacted.r.messages });
  assert.ok(names(after.seen[0]).includes("lsp") && !names(after.seen[0]).includes("web_fetch"));
  const again = after.seen[0].messages.find((m) => String(m.content).includes("deferred tools are now available"));
  assert.ok(again && !again.content.includes("\nlsp\n") && again.content.includes("\nweb_fetch\n"));
});

test("TS14 a chat that already ran without tool search keeps every tool upfront while ENABLE_TOOL_SEARCH is unset (Claude Code: \"stays so until it is compacted or cleared\"); true turns it on there", async () => {
  const old = [{ role: "user", content: "earlier" }, { role: "assistant", content: "earlier answer" }];
  const held = await job([say("ok")], { messages: old });
  assert.ok(!names(held.seen[0]).includes("tool_search") && names(held.seen[0]).includes("lsp"));
  const forced = await job([say("ok")], { messages: old, deps: { toolSearch: "true" } });
  assert.ok(names(forced.seen[0]).includes("tool_search") && !names(forced.seen[0]).includes("lsp"));
});

test("TS15 plan mode's tools are deferred too (Claude Code's EnterPlanMode and ExitPlanMode): exit_plan_mode is one of the chat's tools in every mode under tool search, loaded like the others, refused out of plan mode; a job from GitHub defers its own tools", async () => {
  const r = await job([say("", [call("tool_search", { query: "select:exit_plan_mode", max_results: 5 }, "s1")]), say("", [call("exit_plan_mode", {}, "e1")]), say("done")]);
  assert.ok(names(r.seen[1]).includes("exit_plan_mode"));
  assert.equal(r.told("e1"), PL.NOT_IN_PLAN_MODE, "out of plan mode");
  const gh = await job([say("done")], { extra: { github: true } });
  const n = names(gh.seen[0]);
  assert.ok(n.includes("tool_search") && !n.includes("web_fetch") && !n.includes("enter_plan_mode") && !n.includes("request_secret"));
  const note = gh.seen[0].messages.find((m) => String(m.content).includes("deferred tools are now available"));
  assert.ok(!note.content.includes("plan_mode"), "no plan mode in a job from GitHub");
});

test("TS16 a deferred tool that left the chat's tools is said gone, as Claude Code's delta says it (MCP ones first, by server past 30), with its ambient line", async () => {
  const one = await job([say("done")], { deps: { mcp: async () => ({ text: "", isError: false }) }, extra: { connectors: [connector(1), connector(2)] } });
  const next = await job([say("ok")], { messages: one.r.messages, deps: { mcp: async () => ({ text: "", isError: false }) }, extra: { connectors: [connector(1)] } });
  const gone = next.seen[0].messages.filter((m) => m.appNote && m.toolsAnnounced).at(-1);
  assert.equal(gone.content, "(Note from Coder's app, not the owner:\n" + T.DEFERRED_GONE_MCP + "\nmcp__linear__tool_2\n\n" + T.AMBIENT + ")");
  assert.deepEqual(gone.toolsAnnounced, { added: [], removed: ["mcp__linear__tool_2"] });
  const many = T.announcement({ deferred: [], announced: new Set(Array.from({ length: 31 }, (_, i) => "mcp__a__t" + i).concat(["lsp"])) });
  assert.equal(many.content, "(Note from Coder's app, not the owner:\n31 deferred tools are no longer available (MCP server disconnected): mcp__a__* (31). Do not search for them — tool_search will return no match.\n\n" + T.DEFERRED_GONE + "\nlsp\n\n" + T.AMBIENT + ")");
  assert.equal(T.announcement({ deferred: ["lsp"], announced: new Set(["lsp"]) }), null, "nothing changed");
});

test("TS17 the cache: the same chat sends the same tool list, and a load only adds at the end (Grok's prompt cache keeps what comes before it)", () => {
  const fn = (name) => ({ type: "function", function: { name, description: name, parameters: {} } });
  const pool = ["read", "lsp", "bash", "web_fetch", "tool_search"].map(fn);
  const deferred = new Set(["lsp", "web_fetch"]);
  assert.deepEqual(T.requestTools(pool, deferred, new Set()).map((t) => t.function.name), ["read", "bash", "tool_search"]);
  assert.deepEqual(T.requestTools(pool, deferred, new Set(["web_fetch", "lsp"])).map((t) => t.function.name), ["read", "bash", "tool_search", "web_fetch", "lsp"]);
  assert.deepEqual(T.requestTools(pool, deferred, new Set(["gone"])).map((t) => t.function.name), ["read", "bash", "tool_search"], "a loaded tool no longer in the chat is not sent");
});

test("TS18 a job paused on a card and taken up again later keeps the tools loaded before it paused (they are kept with the chat's messages): the request after the owner's answer still sends them", async () => {
  const park = async () => ({ choice: "park" });
  const run = (steps, opts, ask) => job(steps, { deps: { ask }, extra: { mode: "acceptEdits", ...opts } });
  const first = await run([say("", [call("tool_search", { query: "select:web_fetch", max_results: 5 }, "s1")]), say("", [call("bash", { command: "npm install left-pad", description: "Install" }, "b1")])], {}, park);
  assert.equal(first.r.status, "parked");
  assert.deepEqual(first.r.messages.find((m) => m.tool_call_id === "s1").toolsLoaded, ["web_fetch"]);
  const back = await run([say("Done.")], { text: "", messages: first.r.messages, takeUp: { ...first.r.parked, answer: { choice: "yes" } } }, async () => { throw new Error("no card again"); });
  assert.equal(back.r.status, "done");
  assert.ok(names(back.seen[0]).includes("web_fetch"), "still loaded after the pause");
  assert.equal(back.seen[0].messages.filter((m) => m.toolsAnnounced).length, 1, "and not named again");
});
