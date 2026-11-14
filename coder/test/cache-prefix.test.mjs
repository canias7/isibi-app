// GROK'S PROMPT CACHE ACROSS A CHAT (the cache fix of 2026-11-14). Live, one chat on Low in Accept edits: after a tool_search
// load and a No on web_fetch's card, the next message (a command, then Stop) had only 1,152 of 20,420 tokens cached, the part
// a chat's very first call gets too; later, the turn answering the owner's `!` command after their Settings hooks were set
// back to none, the same. Here a fake Grok gets every request a chat makes and each one is compared with the one before it,
// as xAI gets them (coder-model.mjs's Responses shape): its system message, its tools and its earlier messages must be the
// last request's, byte for byte, so its start is cached; the only change is a tool_search load, which adds the tool after
// the others. And every tool keeps the definition the chat first sent it with (coder-toolsearch.mjs lockTools, Claude
// Code's tool schema cache), whatever the settings make of it later. Stand-ins only: no Grok, no network.
import { test } from "node:test";
import assert from "node:assert/strict";

const A = await import("../container/coder-agent.mjs");
const T = await import("../container/coder-toolsearch.mjs");
const M = await import("../container/coder-model.mjs");
const C = await import("../container/coder-compact.mjs");
const H = await import("../container/coder-hooks.mjs");
const P = await import("../container/coder-parallel.mjs");
const { REJECTED } = await import("../container/coder-perms.mjs");

const ROOT = "/work/shop";
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
/** The context Coder's machine gives each message (coder-context.mjs pieces): the instruction file, the chat's state, the date. */
const CONTEXT = [{ key: "i:CLAUDE.md", text: "\n\nCONTENTS OF CLAUDE.md: be brief.\n" }, { key: "s:WORKING FOLDER", text: "\n\nWORKING FOLDER: /work/shop\n" }, { key: "d:DATE", text: "\n\nToday's date is 2026-11-14.\n" }];
const connector = (i, extra = {}) => ({ name: "mcp__linear__tool_" + i, label: "Linear: tool " + i, description: "From the Linear connector (MCP). Tool " + i + " of Linear.", parameters: { type: "object", properties: { id: { type: "string" } } }, readOnly: true, perm: "allow", ...extra });
/** A request as xAI gets it: its instructions, each tool's JSON, each input item's JSON. */
const asSent = (req) => { const { instructions, input } = M.toResponsesInput(req.messages); return { instructions, tools: M.toResponsesTools(req.tools).map((t) => JSON.stringify(t)), names: req.tools.map((t) => t.function.name), input: input.map((x) => JSON.stringify(x)) }; };

/**
 * A CHAT ON A PRETEND MACHINE: each message a job of its own, its messages kept between them as Coder's Worker keeps them (as
 * JSON). Every request to Grok (not the page reader's or a checker's) is kept, in order, labelled "m<message>#<call>".
 */
function chat() {
  const sent = [];
  let saved = [], k = 0;
  const run = async (steps, { text = "go", shell = "", answer = () => ({ choice: "yes" }), stopIn = "", stopAnswer = false, resumed = false, takeUp = null, hooks = null, opts = {}, deps = {} } = {}) => {
    k++;
    let n = 0, stopAt = 0;
    const events = [], hookCalls = [];
    const r = await A.runCoder({
      send: async (req) => {
        const sys = String((req.messages[0] && req.messages[0].content) || "");
        if (sys === A.PAGE_READER || /safety checker/.test(sys)) return { message: { role: "assistant", content: '{"decision":"allow"}' }, usage: { in: 1, out: 1 } };
        if (!req.tools || !req.tools.length) return { message: { role: "assistant", content: "SUMMARY of what came before" }, usage: { in: 1, out: 1 } };
        sent.push({ label: "m" + k + "#" + (n + 1), req: JSON.parse(JSON.stringify({ messages: req.messages, tools: req.tools })) });
        // (The owner's Stop while Grok answers: the answer never comes back.)
        if (stopAnswer) { setTimeout(() => { stopAt = Date.now(); }, 15); await new Promise((ok) => { const t = setTimeout(ok, 3000); if (req.signal) req.signal.addEventListener("abort", () => { clearTimeout(t); ok(); }); }); }
        return steps[Math.min(n++, steps.length - 1)];
      },
      exec: async (x) => {
        const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
        if (mark && x.hook === true) { hookCalls.push(JSON.parse(x.payload)); return { code: 0, output: "\n" + mark[0] + "\n" }; }
        const tm = /coder-tools\.mjs (\S+)$/.exec(String(x.command));
        if (tm) { const q = tm[1] === "@REQUEST" ? JSON.parse(x.payload) : JSON.parse(Buffer.from(tm[1], "base64").toString("utf8")); return { code: 0, output: q.tool === "web_fetch" ? "<p>a page</p>" : "result of " + q.tool + " " + (q.args.path || q.args.file_path || q.args.pattern || "") }; }
        // (The owner's Stop while this command runs.)
        if (stopIn && String(x.command).includes(stopIn)) { setTimeout(() => { stopAt = Date.now(); }, 5); await wait(40); return { code: 143, output: "Terminated\n" }; }
        return { code: 0, output: "ran " + x.command + "\n" };
      },
      emit: (e) => events.push(e), sleep: async () => {},
      stopped: async () => stopAt > 0, stoppedAt: () => stopAt,
      here: () => ROOT, root: ROOT, home: "/home/dev", chatId: "shop-cache", where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p),
      ask: async (pid) => answer(events.find((e) => e.type === "permission" && e.pid === pid)),
      ...deps,
    }, { text, shell, mode: "acceptEdits", messages: JSON.parse(JSON.stringify(saved)), context: CONTEXT, resumed, ...(takeUp ? { takeUp } : {}), ...(hooks ? { hooks: H.hooksFrom({ hooks }, "settings").list } : {}), ...opts });
    saved = r.messages;
    const told = (id) => { const m = r.messages.find((x) => x.role === "tool" && x.tool_call_id === id); return m ? m.content : undefined; };
    return { r, events, hookCalls, told };
  };
  return { sent, run, labels: () => sent.map((s) => s.label), get messages() { return saved; } };
}
/**
 * The next request starts with the one before it, byte for byte: the same system message, its tools (and, after a load, the
 * loaded ones after them: `added`), then its messages.
 */
function startsWith(a0, b0, { added = [] } = {}) {
  const a = asSent(a0.req), b = asSent(b0.req), at = a0.label + " → " + b0.label;
  assert.equal(b.instructions, a.instructions, at + ": the system message");
  assert.deepEqual(b.tools.slice(0, a.tools.length), a.tools, at + ": the tools, byte for byte");
  assert.deepEqual(b.names.slice(a.tools.length), added, at + ": nothing but " + (added.join(", ") || "nothing") + " after them");
  assert.deepEqual(b.input.slice(0, a.input.length), a.input, at + ": the earlier messages, byte for byte");
  assert.ok(b.input.length > a.input.length, at + ": and more after them");
}
const allStartWith = (sent, loads = {}) => { for (let i = 1; i < sent.length; i++) startsWith(sent[i - 1], sent[i], { added: loads[sent[i].label] || [] }); };

test("CP1 the live chat, seven messages: each request is the last one and more, byte for byte (system message, tools, messages), but for the tool_search load, which adds web_fetch after the others; the No on web_fetch's card (the reads keep their results, the fetch REJECTED, the mark), a Stop while a command runs and the machine started again change nothing before them", async () => {
  const c = chat();
  // 1. get_environment (2 calls).
  await c.run([say("", [call("get_environment", {}, "g1")]), say("Here is your environment.")], { text: "get_environment" });
  // 2. "reply ok" (1 call).
  await c.run([say("ok")], { text: "reply ok" });
  // 3. a sequence (2 calls).
  await c.run([say("", [call("bash", { command: "seq 1 3", description: "Count" }, "q1")]), say("1 2 3")], { text: "seq" });
  // 4. four calls.
  await c.run([say("", [call("glob", { pattern: "*.md" }, "d1")]), say("", [call("grep", { pattern: "shop" }, "d2")]), say("", [call("read", { file_path: "README.md" }, "d3")]), say("Done.")], { text: "look around" });
  // 5. three tools in one reply, web_fetch loaded first; No on its card (2 calls).
  const five = await c.run([say("", [call("tool_search", { query: "select:web_fetch", max_results: 1 }, "s1")]), say("", [call("read", { file_path: "README.md" }, "e1"), call("glob", { pattern: "*.md" }, "e2"), call("web_fetch", { url: "https://example.org/", prompt: "What is on it?" }, "e3")]), say("never")], { text: "In one reply, call these three tools together: read README.md; glob with pattern \"*.md\"; web_fetch the URL https://example.org/", answer: () => ({ choice: "no" }) });
  assert.deepEqual(T.toolSearchRecord(five.r.messages).loaded, new Set(["web_fetch"]));
  assert.equal(five.told("e3"), REJECTED);
  assert.match(String(five.told("e1")), /result of read/);
  assert.deepEqual(five.r.messages.at(-1), P.interruptedNote(), "the mark of the turn its No interrupted");
  // 6. a command, then Stop, on a machine that started again (1 call).
  const six = await c.run([say("", [call("bash", { command: "npm run build", description: "Build" }, "f1")]), say("never")], { text: "run the build", stopIn: "npm run build", resumed: true });
  assert.equal(six.r.status, "stopped");
  // 7. a plain question (1 call).
  await c.run([say("An answer.")], { text: "what did you just do?" });
  assert.deepEqual(c.labels(), ["m1#1", "m1#2", "m2#1", "m3#1", "m3#2", "m4#1", "m4#2", "m4#3", "m4#4", "m5#1", "m5#2", "m6#1", "m7#1"], "the calls of each message, as live");
  allStartWith(c.sent, { "m5#2": ["web_fetch"] });
  // (The one live break that was not the load: message 6 sends message 5's last tools, byte for byte, web_fetch with them.)
  const m52 = c.sent.find((s) => s.label === "m5#2"), m61 = c.sent.find((s) => s.label === "m6#1");
  assert.deepEqual(asSent(m61.req).tools, asSent(m52.req).tools);
  assert.equal(asSent(m61.req).names.at(-1), "web_fetch");
});

test("CP2 the same No given on a card left open (the job paused, then taken up with the owner's No on another machine), and a Stop while Grok answers (its answer dropped, the chat's record of what that request carried kept on the mark): the next requests still start with the last ones, byte for byte", async () => {
  const c = chat();
  await c.run([say("Hello.")], { text: "hi" });
  const five = await c.run([say("", [call("tool_search", { query: "select:web_fetch", max_results: 1 }, "s1")]), say("", [call("read", { file_path: "README.md" }, "e1"), call("glob", { pattern: "*.md" }, "e2"), call("web_fetch", { url: "https://example.org/", prompt: "What is on it?" }, "e3")]), say("never")], { text: "three together", answer: () => ({ choice: "park" }) });
  assert.equal(five.r.status, "parked");
  const back = await c.run([say("never")], { text: "", takeUp: { ...five.r.parked, answer: { choice: "no" } }, resumed: true });
  assert.equal(back.r.status, "done");
  assert.equal(back.told("e3"), REJECTED);
  assert.equal(c.sent.length, 3, "the job taken up asks Grok nothing");
  // A Stop while Grok answers the next message: nothing of its answer kept.
  const stopped = await c.run([say("never")], { text: "explain it all", stopAnswer: true });
  assert.equal(stopped.r.status, "stopped");
  assert.deepEqual(stopped.r.messages.at(-1).content, P.INTERRUPTED);
  await c.run([say("An answer.")], { text: "a plain question" });
  assert.deepEqual(c.labels(), ["m1#1", "m2#1", "m2#2", "m4#1", "m5#1"]);
  allStartWith(c.sent, { "m2#2": ["web_fetch"] });
  // A chat's first request stopped while Grok answers: its record goes on the mark, so the next message, with the network
  // gate now on (bash with allowed_domains as this job makes it), still sends what the stopped request carried.
  const d = chat();
  await d.run([say("never")], { text: "hi", stopAnswer: true });
  const mark = d.messages.at(-1);
  assert.equal(mark.content, P.INTERRUPTED);
  assert.ok(Array.isArray(mark.toolLocks) && mark.toolLocks.includes("bash"), "the record of the tools sent, on the mark");
  await d.run([say("ok")], { text: "again", opts: { hostLists: "on" } });
  startsWith(d.sent[0], d.sent[1]);
});

test("CP3 the second live break: a turn with a PreToolUse hook on Read from Settings, then Settings' hooks set back to none and the owner's own `!cat …` command, which Coder answers, then a plain message: each request starts with the last one, byte for byte (Claude Code keeps its prefix across a settings change and a shell-mode message)", async () => {
  const c = chat();
  await c.run([say("Hello.")], { text: "hi" });
  const readHook = { PreToolUse: [{ matcher: "Read", hooks: [{ type: "command", command: "echo read >> ~/r70-hooks.log" }] }] };
  const ten = await c.run([say("", [call("read", { file_path: "README.md" }, "r1")]), say("It says shop.")], { text: "read README.md", hooks: readHook });
  assert.equal(ten.hookCalls.filter((h) => h.hook_event_name === "PreToolUse").length, 1, "the hook ran");
  const eleven = await c.run([say("The log had one line.")], { text: "", shell: "cat ~/r70-hooks.log; rm -f ~/r70-hooks.log" });
  assert.equal(eleven.hookCalls.length, 0, "no hooks now");
  const sentEleven = c.sent.at(-1).req.messages.map((m) => String(m.content || ""));
  assert.ok(sentEleven.includes("<bash-input>cat ~/r70-hooks.log; rm -f ~/r70-hooks.log</bash-input>"), "Coder answers the owner's command");
  await c.run([say("An answer.")], { text: "and now?" });
  assert.deepEqual(c.labels(), ["m1#1", "m2#1", "m2#2", "m3#1", "m4#1"]);
  allStartWith(c.sent);
});

test("CP4 a setting changed between two messages leaves the tools the same bytes: each tool keeps the definition the chat first sent it with (Claude Code's tool schema cache), whatever the job now makes of it: Settings' background limit, BASH_DEFAULT_TIMEOUT_MS, the output limits, background commands off, the network gate's allowed_domains, web_fetch's cache time, a loaded connector tool's description and its length limit", async () => {
  const mcp = async () => ({ text: "fine", isError: false });
  const conn = [connector(1), connector(2)];
  const c = chat();
  await c.run([say("", [call("tool_search", { query: "select:web_fetch,monitor,mcp__linear__tool_1", max_results: 5 }, "s1")]), say("Loaded.")], { text: "load them", deps: { mcp }, opts: { connectors: conn } });
  const changes = [
    ["Settings' background limit", { opts: { timeouts: { defaultMs: 120000, maxMs: 600000, bgDefaultMs: 1800000, bgMaxMs: 4 * 3600000 } } }],
    ["BASH_DEFAULT_TIMEOUT_MS", { opts: { timeouts: { defaultMs: 60000, maxMs: 600000, bgDefaultMs: 1800000, bgMaxMs: 7200000 } } }],
    ["the output limits", { opts: { outLimits: { inlineMax: 50000, readBack: 50000 } } }],
    ["background commands off", { opts: { noBg: true } }],
    ["the network gate on", { opts: { hostLists: "on" } }],
    ["web_fetch's cache time", { deps: { webFetch: { cacheTtlMs: 60000 } } }],
    ["a connector's new description", { opts: { connectors: [connector(1, { description: "From the Linear connector (MCP). Tool 1, in new words." }), connector(2)] } }],
    ["the connector description limit", { deps: { mcpDescMax: 10 } }],
  ];
  const first = asSent(c.sent.at(-1).req).tools;
  for (const [what, o] of changes) {
    await c.run([say("ok")], { text: "after " + what, deps: { mcp, ...(o.deps || {}) }, opts: { connectors: conn, ...(o.opts || {}) } });
    assert.deepEqual(asSent(c.sent.at(-1).req).tools, first, what + ": the same tools, byte for byte");
  }
  allStartWith(c.sent, { "m1#2": ["web_fetch", "monitor", "mcp__linear__tool_1"] });
  // (Each of those settings does change what the job makes of the tool: without the lock, the tools would differ.)
  const bash = (o) => JSON.stringify(A.toolsFor(A.CODER_TOOLS, o).find((t) => t.function.name === "bash"));
  for (const o of [{ bgMaxMs: 4 * 3600000 }, { defaultMs: 60000 }, { inlineMax: 50000 }, { noBg: true }]) assert.notEqual(bash(o), bash({}), JSON.stringify(o));
  assert.notEqual(JSON.stringify(A.webFetchTools(A.CODER_TOOLS, { cacheTtlMs: 60000 })), JSON.stringify(A.CODER_TOOLS));
  // The chat's record: its first answer locks the tools it sent, Coder's own unchanged ones by name, in a few hundred
  // characters; the loaded ones on the answer of the request that first sent them, a connector's by its definition.
  const answers = c.messages.filter((m) => m.role === "assistant" && m.toolLocks);
  assert.deepEqual(answers[0].toolLocks, c.sent[0].req.tools.map((t) => t.function.name));
  assert.ok(JSON.stringify(answers[0].toolLocks).length < 1000);
  assert.deepEqual(answers[1].toolLocks.map(T.lockName), ["web_fetch", "monitor", "mcp__linear__tool_1"]);
  assert.deepEqual(answers[1].toolLocks.slice(0, 2), ["web_fetch", "monitor"], "Coder's own as its code defines them: by name");
  assert.equal(answers[1].toolLocks[2].def.function.description, "From the Linear connector (MCP). Tool 1 of Linear.");
  assert.equal(answers.length, 2, "nothing more to lock after");
});

test("CP5 when a lock no longer holds: a connector tool whose parameters changed is sent as it is now and locked again (Claude Code's key for an MCP tool: its name and its input schema); one of Coder's own locked by a definition of another version of Coder's tool code (a deploy) is sent as this version makes it; a new tool is locked as it is first sent", async () => {
  const mcp = async () => ({ text: "fine", isError: false });
  const c = chat();
  await c.run([say("", [call("tool_search", { query: "select:mcp__linear__tool_1", max_results: 5 }, "s1")]), say("Loaded.")], { text: "load it", deps: { mcp }, opts: { connectors: [connector(1), connector(2)] } });
  const before = asSent(c.sent.at(-1).req);
  const wider = connector(1, { parameters: { type: "object", properties: { id: { type: "string" }, team: { type: "string" } } } });
  await c.run([say("ok")], { text: "its server changed it", deps: { mcp }, opts: { connectors: [wider, connector(2)] } });
  const now = asSent(c.sent.at(-1).req);
  assert.deepEqual(now.tools.slice(0, -1), before.tools.slice(0, -1), "the others byte for byte");
  assert.deepEqual(JSON.parse(now.tools.at(-1)).parameters, wider.parameters, "the connector tool as it is now");
  const relocked = c.messages.filter((m) => m.toolLocks).at(-1).toolLocks;
  assert.deepEqual(relocked.map((e) => e.def.function.parameters), [wider.parameters]);
  await c.run([say("ok")], { text: "and again", deps: { mcp }, opts: { connectors: [wider, connector(2)] } });
  assert.deepEqual(asSent(c.sent.at(-1).req).tools, now.tools, "locked again from there");
  // A deploy: bash locked (gate on) by a definition of another version of the tool code is sent as this version makes it.
  const d = chat();
  await d.run([say("hi")], { text: "hi", opts: { hostLists: "on" } });
  const lock = d.messages.find((m) => m.toolLocks).toolLocks.find((e) => T.lockName(e) === "bash");
  assert.equal(lock.v, A.TOOLS_V, "Coder's own changed by a setting: by definition, with the tool code's version");
  assert.ok(lock.def.function.parameters.properties.allowed_domains);
  const old = d.messages.map((m) => (m.toolLocks ? { ...m, toolLocks: m.toolLocks.map((e) => (T.lockName(e) === "bash" ? { def: { ...e.def, function: { ...e.def.function, description: "an older bash" } }, v: "older" } : e)) } : m));
  let deployReq = null;
  const e = await A.runCoder({ send: async (req) => { deployReq = req; return say("ok"); }, exec: async () => ({ code: 0, output: "" }), emit: () => {}, here: () => ROOT, root: ROOT, where: (p) => p, ask: async () => ({ choice: "yes" }) }, { text: "after a deploy", mode: "acceptEdits", messages: old, hostLists: "on" });
  const sentBash = deployReq.tools.find((t) => t.function.name === "bash");
  assert.equal(sentBash.function.description, A.CODER_TOOLS.find((t) => t.function.name === "bash").function.description, "as this version makes it");
  assert.ok(sentBash.function.parameters.properties.allowed_domains, "the gate's input with it, as this job makes it");
  assert.equal(e.messages.filter((m) => m.toolLocks).at(-1).toolLocks.find((x) => T.lockName(x) === "bash").v, A.TOOLS_V, "and locked again");
});

test("CP6 a summary carries the locks (the owner's /compact, and the Worker's summary of earlier jobs): the request after it sends the same tools, byte for byte, though a setting changed meanwhile", async () => {
  const c = chat();
  await c.run([say("", [call("tool_search", { query: "select:web_fetch", max_results: 1 }, "s1")]), say("Loaded.")], { text: "load web_fetch" });
  const tools = asSent(c.sent.at(-1).req).tools;
  const sum = C.summaryMessage("s", "the earlier jobs", [], c.messages);
  assert.deepEqual(sum.toolLocks, T.toolLocksIn(c.messages));
  assert.ok(sum.toolLocks.length > 10);
  await c.run([say("ok")], { text: "after /compact", opts: { compact: { focus: "" } } });
  assert.ok(C.isSummary(c.messages[0]) && Array.isArray(c.messages[0].toolLocks), "the /compact's summary carries them");
  await c.run([say("ok")], { text: "after the summary", opts: { timeouts: { defaultMs: 60000, maxMs: 600000, bgDefaultMs: 1800000, bgMaxMs: 4 * 3600000 } } });
  assert.deepEqual(asSent(c.sent.at(-1).req).tools, tools, "the same tools, byte for byte");
  const w = chat();
  await w.run([say("ok")], { text: "hi" });
  let afterReq = null;
  await A.runCoder({ send: async (req) => { afterReq = req; return say("ok"); }, exec: async () => ({ code: 0, output: "" }), emit: () => {}, here: () => ROOT, root: ROOT, where: (p) => p, ask: async () => ({ choice: "yes" }) }, { text: "next", mode: "acceptEdits", messages: [sum], noBg: true });
  assert.deepEqual(afterReq.tools.map((t) => JSON.stringify(M.toResponsesTools([t])[0])), tools, "after the Worker's summary too");
});

test("CP7 lockTools, keyed as Claude Code's tool schema cache keys a tool (its name, and an MCP tool's input schema): a name lock is the tool's stock definition; one of Coder's own locked by its definition holds for the version of the tool code that made it; a connector's while its parameters are the same; a tool with none is locked as it goes (by name when it is its stock definition); a later lock in place of an earlier one", () => {
  const d = (n, desc = n, props = {}) => ({ type: "function", function: { name: n, description: desc, parameters: { type: "object", properties: props } } });
  const stock = new Map([["bash", d("bash", "stock bash")], ["read", d("read")]]);
  const nm = (l) => l.map((t) => t.function.description);
  // Nothing locked: as they are, locked now (by name when stock).
  let r = T.lockTools([d("bash", "stock bash"), d("read", "read, changed"), d("mcp__x__t", "theirs")], new Map(), { stock, version: "v1" });
  assert.deepEqual(nm(r.tools), ["stock bash", "read, changed", "theirs"]);
  assert.deepEqual(r.locks, ["bash", { def: d("read", "read, changed"), v: "v1" }, { def: d("mcp__x__t", "theirs") }]);
  // Locked: as locked, whatever the job now makes of them; nothing new to lock.
  const locks = new Map(r.locks.map((e) => [T.lockName(e), e]));
  r = T.lockTools([d("bash", "bash, gate on"), d("read", "read again"), d("mcp__x__t", "theirs, new words")], locks, { stock, version: "v1" });
  assert.deepEqual(nm(r.tools), ["stock bash", "read, changed", "theirs"]);
  assert.equal(r.locks, null);
  // Another version of Coder's tool code: Coder's own (locked by definition) as made now; a connector's new parameters: as now.
  r = T.lockTools([d("read", "read v2"), d("mcp__x__t", "theirs", { team: { type: "string" } })], locks, { stock, version: "v2" });
  assert.deepEqual(nm(r.tools), ["read v2", "theirs"]);
  assert.deepEqual(r.locks.map(T.lockName), ["read", "mcp__x__t"]);
  // A name lock for a tool no longer stock (gone from Coder): as made now, locked again.
  r = T.lockTools([d("gone", "x")], new Map([["gone", "gone"]]), { stock, version: "v1" });
  assert.deepEqual(r.locks, [{ def: d("gone", "x"), v: "v1" }]);
  // The record: a later lock in place of an earlier one.
  assert.deepEqual(T.toolLocksIn([{ toolLocks: ["bash", { def: d("read", "a"), v: "v1" }] }, { role: "assistant", toolLocks: [{ def: d("read", "b"), v: "v2" }] }]), ["bash", { def: d("read", "b"), v: "v2" }]);
  assert.deepEqual([...T.toolSearchRecord([{ role: "assistant", content: "", toolLocks: ["bash"] }]).locks.keys()], ["bash"]);
  // The stock tools are Coder's own as its code defines them (web_search as Coder's chats send it).
  assert.equal(A.STOCK_TOOLS.get("web_search").function.parameters.properties.mode !== undefined, true);
  for (const n of ["bash", "read", "tool_search", "web_fetch", "exit_plan_mode", "todo_write"]) assert.ok(A.STOCK_TOOLS.has(n), n);
  assert.match(A.TOOLS_V, /^[0-9a-f]{16}$/);
});
