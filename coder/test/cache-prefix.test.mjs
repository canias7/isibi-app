// GROK'S PROMPT CACHE ACROSS A CHAT (the cache fix of 2026-11-14). Live, one chat on Low in Accept edits: after a tool_search
// load and a No on web_fetch's card, the next message (a command, then Stop) had only 1,152 of 20,420 tokens cached, the part
// a chat's very first call gets too; later, the turn answering the owner's `!` command after their Settings hooks were set
// back to none, the same. Here a fake Grok gets every request a chat makes and each one is compared with the one before it,
// as xAI gets them (coder-model.mjs's Responses shape): its system message, its tools and its earlier messages must be the
// last request's, byte for byte, so its start is cached; the only change is a tool_search load, which adds the tool after
// the others. And every tool keeps the definition the chat first sent it with (coder-toolsearch.mjs lockTools, Claude
// Code's tool schema cache), whatever the settings make of it later. And (the owner, 2026-11-14: "yes copy claude code") the
// saved chat is the conversation as sent, long answers and pictures whole, so the next message starts with the last one; the
// cache breaks only at a summary (Claude Code's auto-compact). Stand-ins only: no Grok, no network.
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
  // (`real`: each answer says what its request used, as xAI counts it, 4 characters a token, so Claude Code's auto-compact counts
  // from it.)
  const run = async (steps, { text = "go", shell = "", answer = () => ({ choice: "yes" }), stopIn = "", stopAnswer = false, resumed = false, takeUp = null, hooks = null, opts = {}, deps = {}, real = false } = {}) => {
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
        const step = steps[Math.min(n++, steps.length - 1)];
        return real ? { ...step, usage: { in: Math.ceil(JSON.stringify({ m: req.messages, t: req.tools }).length / 4), out: 40 } } : step;
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
  assert.equal(mark.toolLocksV, A.TOOLS_V, "with the version of the tool code that sent them");
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
  assert.ok(answers.every((m) => m.toolLocksV === A.TOOLS_V), "each with the version of the tool code that sent them");
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
  const held = d.messages.find((m) => m.toolLocks), lock = held.toolLocks.find((e) => T.lockName(e) === "bash");
  assert.equal(held.toolLocksV, A.TOOLS_V, "with the tool code's version");
  assert.ok(lock.def.function.parameters.properties.allowed_domains, "Coder's own changed by a setting: by definition");
  const old = d.messages.map((m) => (m.toolLocks ? { ...m, toolLocksV: "older", toolLocks: m.toolLocks.map((e) => (T.lockName(e) === "bash" ? { def: { ...e.def, function: { ...e.def.function, description: "an older bash" } } } : e)) } : m));
  let deployReq = null;
  const e = await A.runCoder({ send: async (req) => { deployReq = req; return say("ok"); }, exec: async () => ({ code: 0, output: "" }), emit: () => {}, here: () => ROOT, root: ROOT, where: (p) => p, ask: async () => ({ choice: "yes" }) }, { text: "after a deploy", mode: "acceptEdits", messages: old, hostLists: "on" });
  const sentBash = deployReq.tools.find((t) => t.function.name === "bash");
  assert.equal(sentBash.function.description, A.CODER_TOOLS.find((t) => t.function.name === "bash").function.description, "as this version makes it");
  assert.ok(sentBash.function.parameters.properties.allowed_domains, "the gate's input with it, as this job makes it");
  const relock = e.messages.filter((m) => m.toolLocks).at(-1);
  assert.equal(relock.toolLocksV, A.TOOLS_V, "and locked again with this version");
  assert.ok(relock.toolLocks.find((x) => T.lockName(x) === "bash").def.function.parameters.properties.allowed_domains);
  assert.ok(relock.toolLocks.includes("read"), "every one of Coder's own tools of the older version, a name lock too");
});

test("CP6 a summary carries the locks (the owner's /compact, and the Worker's summary of earlier jobs): the request after it sends the same tools, byte for byte, though a setting changed meanwhile", async () => {
  const c = chat();
  await c.run([say("", [call("tool_search", { query: "select:web_fetch", max_results: 1 }, "s1")]), say("Loaded.")], { text: "load web_fetch" });
  const tools = asSent(c.sent.at(-1).req).tools;
  const sum = C.summaryMessage("s", "the earlier jobs", [], c.messages);
  const L = T.toolLocksIn(c.messages);
  assert.deepEqual([sum.toolLocks, sum.toolLocksV], [L.toolLocks, A.TOOLS_V]);
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
  assert.deepEqual(r.locks, ["bash", { def: d("read", "read, changed") }, { def: d("mcp__x__t", "theirs") }]);
  // Locked (the record as toolSearchRecord reads it: name → the lock and its message's version): as locked, whatever the job
  // now makes of them; nothing new to lock.
  const locks = T.toolSearchRecord([{ role: "assistant", content: "", toolLocks: r.locks, toolLocksV: "v1" }]).locks;
  assert.deepEqual([...locks.keys()], ["bash", "read", "mcp__x__t"]);
  r = T.lockTools([d("bash", "bash, gate on"), d("read", "read again"), d("mcp__x__t", "theirs, new words")], locks, { stock, version: "v1" });
  assert.deepEqual(nm(r.tools), ["stock bash", "read, changed", "theirs"]);
  assert.equal(r.locks, null);
  // Another version of Coder's tool code: Coder's own as made now, by name as well as by definition; a connector's holds while
  // its parameters do, and with new parameters is as it is now.
  r = T.lockTools([d("bash", "bash, gate on"), d("read", "read v2"), d("mcp__x__t", "theirs, new words")], locks, { stock, version: "v2" });
  assert.deepEqual(nm(r.tools), ["bash, gate on", "read v2", "theirs"]);
  assert.deepEqual(r.locks.map(T.lockName), ["bash", "read"]);
  r = T.lockTools([d("mcp__x__t", "theirs", { team: { type: "string" } })], locks, { stock, version: "v1" });
  assert.deepEqual(r.locks, [{ def: d("mcp__x__t", "theirs", { team: { type: "string" } }) }]);
  // A record with no version (or another): none of Coder's own holds.
  assert.equal(T.lockTools([d("read", "now")], T.toolSearchRecord([{ role: "assistant", content: "", toolLocks: [{ def: d("read", "then") }] }]).locks, { stock, version: "v1" }).tools[0].function.description, "now");
  // For a summary: a later lock in place of an earlier one; Coder's own only from the last version that locked any (one of an
  // older version holds for none after it), a connector's whatever the version.
  assert.deepEqual(T.toolLocksIn([{ toolLocks: ["bash", { def: d("read", "a") }, { def: d("mcp__x__t", "theirs") }], toolLocksV: "v1" }, { role: "assistant", toolLocks: [{ def: d("read", "b") }], toolLocksV: "v2" }]), { toolLocks: [{ def: d("read", "b") }, { def: d("mcp__x__t", "theirs") }], toolLocksV: "v2" });
  assert.equal(T.toolLocksIn([{ role: "user", content: "x" }]), null);
  // The stock tools are Coder's own as its code defines them (web_search as Coder's chats send it).
  assert.equal(A.STOCK_TOOLS.get("web_search").function.parameters.properties.mode !== undefined, true);
  for (const n of ["bash", "read", "tool_search", "web_fetch", "exit_plan_mode", "todo_write"]) assert.ok(A.STOCK_TOOLS.has(n), n);
  assert.match(A.TOOLS_V, /^[0-9a-f]{16}$/);
});

test("CP8 bash's description names the shell Coder's commands run in on the chat's machine (its CODER_SHELL, or its zsh: the machine's `t.shell`), as Claude Code's Bash description names the user's shell, never the owner's own `!` command (which it had been given); a chat's first request carries it, locked from there; a chat locked before keeps what it sent until Coder's tool code changes (TOOLS_V)", async () => {
  const bashOf = (req) => req.tools.find((t) => t.function.name === "bash").function;
  const STOCK_BASH = A.CODER_TOOLS.find((t) => t.function.name === "bash");
  // A chat on a zsh machine: its first request says zsh, and its answer locks that.
  const z = chat();
  await z.run([say("hi")], { text: "hi", opts: { cmdShell: "/usr/bin/zsh" } });
  assert.match(bashOf(z.sent[0].req).description, /^Run ONE shell command \(zsh\)/);
  assert.match(bashOf(z.sent[0].req).description, /\(~\/\.zshrc, as it was when this message started\)/);
  const first = z.messages.find((m) => m.toolLocks);
  assert.equal(first.toolLocksV, A.TOOLS_V);
  assert.match(first.toolLocks.find((e) => T.lockName(e) === "bash").def.function.description, /^Run ONE shell command \(zsh\)/, "locked by its definition");
  // The owner's `!` command on it, and a message after: the same bytes.
  await z.run([say("It listed the folder.")], { text: "", shell: "ls -la", opts: { cmdShell: "/usr/bin/zsh" } });
  await z.run([say("ok")], { text: "next", opts: { cmdShell: "/usr/bin/zsh" } });
  allStartWith(z.sent);
  // A bash machine whose chat starts with the owner's own command naming zsh: bash's description still says bash.
  const b = chat();
  await b.run([say("It printed the path.")], { text: "", shell: "ls /bin/zsh", opts: { cmdShell: "bash" } });
  assert.match(bashOf(b.sent[0].req).description, /^Run ONE shell command \(bash\)/);
  assert.deepEqual(bashOf(b.sent[0].req), STOCK_BASH.function, "the stock definition");
  assert.ok(b.messages.find((m) => m.toolLocks).toolLocks.includes("bash"), "locked by name");
  // That chat's lock holds on a zsh machine (the same version of the tool code): what it sent, until the tool code changes.
  await b.run([say("ok")], { text: "and on zsh?", opts: { cmdShell: "/usr/bin/zsh" } });
  assert.deepEqual(bashOf(b.sent[1].req), STOCK_BASH.function, "kept as it was sent");
  allStartWith(b.sent);
  // Locked by an older version of the tool code (before this fix): made again for this machine, zsh, and locked again.
  const older = b.messages.map((m) => (m.toolLocks ? { ...m, toolLocksV: "older" } : m));
  let req = null;
  const r = await A.runCoder({ send: async (q) => { req = q; return say("ok"); }, exec: async () => ({ code: 0, output: "" }), emit: () => {}, here: () => ROOT, root: ROOT, where: (p) => p, ask: async () => ({ choice: "yes" }) }, { text: "after the deploy", mode: "acceptEdits", messages: older, cmdShell: "/usr/bin/zsh" });
  assert.match(bashOf(req).description, /^Run ONE shell command \(zsh\)/);
  const relock = r.messages.filter((m) => m.toolLocks).at(-1);
  assert.equal(relock.toolLocksV, A.TOOLS_V);
  assert.match(relock.toolLocks.find((e) => T.lockName(e) === "bash").def.function.description, /\(zsh\)/);
  // Coder's machine gives runCoder the shell its commands run in (shellOf: CODER_SHELL, else the machine's zsh).
  const { readFileSync } = await import("node:fs");
  const server = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(server, /t\.shell = shellOf\(rawVars\.CODER_SHELL\);/);
  assert.match(server, /runCoder\(turnDeps, \{[^\n]*\bcmdShell: t\.shell,/);
  assert.match(server, /runCoder\(turnDeps, \{[^\n]*shell: typeof body\.shell === "string"/, "and the owner's own command apart, as before");
});

/** A machine whose reads give big files: `size` characters each, a .png a picture; nothing changed since (`mtimes`). */
const bigMachine = (size, PICS_MARK = "") => async (x) => {
  const tm = /coder-tools\.mjs (\S+)$/.exec(String(x.command));
  if (!tm) return { code: 0, output: "ran " + x.command + "\n" };
  const q = tm[1] === "@REQUEST" ? JSON.parse(x.payload) : JSON.parse(Buffer.from(tm[1], "base64").toString("utf8"));
  const p = String(q.args.path || q.args.file_path || "");
  if (q.tool === "read" && /\.png$/.test(p)) return { code: 0, output: PICS_MARK + JSON.stringify({ text: "Picture: " + p + " (64×64, PNG, 1 KB), shown to you as a picture after these results.", pictures: [{ type: "image/png", data: "iVBORw0KGgo=" }] }) };
  if (q.tool === "read") return { code: 0, output: Array.from({ length: Math.ceil(size / 100) }, (_, i) => String(i + 1).padStart(6) + "\t" + "x".repeat(93)).join("\n") };
  if (q.tool === "mtimes") return { code: 0, output: "[]" };
  return { code: 0, output: "result of " + q.tool + " " + p };
};

test("CP9 the saved chat is the conversation as sent (the owner, 2026-11-14: \"yes copy claude code\"; Claude Code's transcript keeps every tool result and image block whole): after a 60,000-character read, the note of an @-mentioned file as long, a read's picture and the owner's own picture, the next message's request starts with the last one, byte for byte (the saved chat used to cut them to 12,000 characters and leave the pictures out, so the next request differed from there)", async () => {
  const { PICS_MARK } = await import("../container/coder-tools.mjs");
  const exec = bigMachine(60_000, PICS_MARK);
  const c = chat();
  await c.run([say("", [call("read", { file_path: "big.txt" }, "r1")]), say("", [call("read", { file_path: "shot.png" }, "r2")]), say("Read them.")], { text: "look at @notes.txt, then read big.txt and shot.png", deps: { exec } });
  await c.run([say("A small picture.")], { text: "and this one?", opts: { images: [{ type: "image/png", data: "iVBORw0KGgo=" }] }, deps: { exec } });
  await c.run([say("ok")], { text: "thanks", deps: { exec } });
  assert.deepEqual(c.labels(), ["m1#1", "m1#2", "m1#3", "m2#1", "m3#1"]);
  allStartWith(c.sent);
  // What the saved chat kept: the read whole, the note whole, both pictures, as Grok was sent them.
  const long = (await exec({ command: "node coder-tools.mjs " + Buffer.from(JSON.stringify({ tool: "read", args: { path: "big.txt" } })).toString("base64") })).output;
  assert.ok(long.length >= 60_000 && long.length > 4 * A.SAVE_ONE_MAX);
  assert.equal(c.messages.find((m) => m.role === "tool" && m.tool_call_id === "r1").content, long, "the read whole");
  assert.ok(c.messages.some((m) => m.appNote === true && m.content.includes("--- notes.txt ---") && m.content.includes(long)), "the @-mention's note whole");
  assert.deepEqual(c.messages.filter((m) => Array.isArray(m.images)).map((m) => [m.readPics === true, m.images]), [[true, ["data:image/png;base64,iVBORw0KGgo="]], [false, ["data:image/png;base64,iVBORw0KGgo="]]], "the read's picture and the owner's");
  // (Gloopy's saved chat is cut as before: forSaving.)
  assert.notEqual(A.forSaving({ role: "tool", tool_call_id: "r1", content: long }).content, long);
});

test("CP10 the cache breaks only at a summary: a job that fills the conversation past Claude Code's auto-compact threshold (here CODER_AUTOCOMPACT_PCT_OVERRIDE at 5%, 24,000 tokens) is summarized whole before its next request; every request before it starts with the last one; the one after it keeps the system message and the tools, byte for byte, and starts with the summary; from there each request, the next message's too, starts with the last one", async () => {
  // (Each read some 5,000 tokens; the system message and the tools some 16,000.)
  const exec = bigMachine(20_000);
  const c = chat();
  const vars = { CODER_AUTOCOMPACT_PCT_OVERRIDE: "5" };
  await c.run([say("Hello.")], { text: "hi", deps: { exec }, opts: { compactVars: vars }, real: true });
  const two = await c.run([say("", [call("read", { file_path: "big1.txt" }, "r1")]), say("", [call("read", { file_path: "big2.txt" }, "r2")]), say("Read both.")], { text: "read big1.txt and big2.txt", deps: { exec }, opts: { compactVars: vars }, real: true });
  await c.run([say("ok")], { text: "and now?", deps: { exec }, opts: { compactVars: vars }, real: true });
  assert.deepEqual(c.labels(), ["m1#1", "m2#1", "m2#2", "m2#3", "m3#1"]);
  assert.ok(two.events.some((e) => e.type === "note" && e.text === C.COMPACTED_SHOWN && e.compacted && e.compacted.trigger === "auto"), "summarized once, mid-job");
  const at = (l) => c.sent.find((x) => x.label === l);
  startsWith(at("m1#1"), at("m2#1"));
  startsWith(at("m2#1"), at("m2#2"));
  // The summary: the system message and the tools the same bytes; the conversation starts again from the summary.
  const before = asSent(at("m2#2").req), after = asSent(at("m2#3").req);
  assert.equal(after.instructions, before.instructions);
  assert.deepEqual(after.tools, before.tools);
  assert.match(JSON.parse(after.input[0]).content, /^This chat is being continued from a previous conversation that ran out of context\./);
  startsWith(at("m2#3"), at("m3#1"));
  assert.ok(C.isSummary(c.messages[0]), "the saved chat starts with it");
});
