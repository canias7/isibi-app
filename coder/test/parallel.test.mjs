// A REPLY'S CALLS SIDE BY SIDE, AS CLAUDE CODE RUNS THEM (recheck 2's S3 and W3; the owner, 2026-11-14: "yes pls all of
// that"): coder-parallel.mjs and Coder's call loop. Claude Code 2.1.325 (its agent loop docs, "Read-only tools (like Read,
// Glob, Grep, and MCP tools marked as read-only) can run concurrently. Tools that modify state (like Edit, Write, and Bash)
// run sequentially"; its program's StreamingToolExecutor and each tool's isConcurrencySafe): a reply's consecutive safe
// calls run together, an unsafe one alone, in order; each call has its own checks, hooks and card and its own result.
// Stand-ins only: no Grok, no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

const A = await import("../container/coder-agent.mjs");
const P = await import("../container/coder-parallel.mjs");
const H = await import("../container/coder-hooks.mjs");
const { REJECTED, NOT_NOW } = await import("../container/coder-perms.mjs");
const TOOLS = join(import.meta.dirname, "../container/coder-tools.mjs");
const ROOT = "/work/shop";
const CHECKER = /^You are the safety checker of Coder's auto mode/;
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));

/**
 * ONE JOB WITH STAND-INS: Grok's replies in turn (`steps`); every run (the tools script's for a file tool or a page's fetch, a
 * command, a connector's call, a web search, the page reader) takes `ms(tag)` and is logged as it starts and ends, with how
 * many ran at once; the checker answers `verdict(action)` after `checkMs`; hook commands answer `hookOut(input)`.
 */
async function job(steps, { mode = "acceptEdits", rules = null, hooks = null, checker = false, verdict = () => '{"decision":"allow"}', checkMs = 60, ms = () => 40, answer = () => ({ choice: "yes" }), connectors = [], hookOut = () => "", hookMs = () => 0, budget = null, deps: more = {}, opts = {} } = {}) {
  const log = [], events = [], checks = [], cards = [], requests = [], hookIns = [];
  let open = 0, most = 0, checking = 0, mostChecks = 0, n = 0;
  const t0 = Date.now();
  const at = () => Date.now() - t0;
  const run = async (tag, out) => {
    open++; most = Math.max(most, open); log.push({ ev: "start", tag, at: at() });
    try { await wait(ms(tag)); return out; } finally { open--; log.push({ ev: "end", tag, at: at() }); }
  };
  const r = await A.runCoder({
    send: async (req) => {
      const sys = String((req.messages && req.messages[0] && req.messages[0].content) || "");
      if (CHECKER.test(sys)) {
        const action = String(req.messages[1].content).split("THE ACTION TO JUDGE:\n")[1] || "";
        checking++; mostChecks = Math.max(mostChecks, checking); checks.push({ action, at: at() });
        await wait(checkMs);
        checking--; log.push({ ev: "verdict", tag: action, at: at() });
        return { message: { role: "assistant", content: verdict(action) }, usage: { in: 100, out: 5, kind: "check" } };
      }
      if (sys === A.PAGE_READER) return run("reader", { message: { role: "assistant", content: "what the page says" }, usage: { in: 50, out: 5, kind: "reader" } });
      if (req.webSearch && typeof req.webSearch === "object") { const q = String(req.messages[1].content); return run("search:" + q.slice(-12), { message: { role: "assistant", content: "found it" }, usage: { in: 20, out: 5, kind: "search" } }); }
      requests.push(req);
      return steps[Math.min(n++, steps.length - 1)];
    },
    exec: async (x) => {
      const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
      if (mark && x.hook === true) {
        const input = JSON.parse(x.payload);
        hookIns.push({ ...input, at: at() });
        const tag = "hook:" + input.hook_event_name + ":" + (input.tool_use_id || "");
        const d = hookMs(input);
        if (d > 0) { log.push({ ev: "start", tag, at: at() }); await wait(d); log.push({ ev: "end", tag, at: at() }); }
        return { code: 0, output: String(hookOut(input) || "") + "\n" + mark[0] + "\n" };
      }
      const tm = /coder-tools\.mjs (\S+)$/.exec(String(x.command));
      if (tm) {
        const req = tm[1] === "@REQUEST" ? JSON.parse(x.payload) : JSON.parse(Buffer.from(tm[1], "base64").toString("utf8"));
        const tag = req.tool + ":" + (req.args.pattern || req.args.path || req.args.url || req.args.filePath || "");
        return run(tag, { code: 0, output: req.tool === "web_fetch" ? "<p>a page</p>" : "result of " + tag });
      }
      return run("bash:" + x.command, { code: 0, output: "ran " + x.command + "\n" });
    },
    mcp: async (name, args) => run("mcp:" + name + ":" + JSON.stringify(args), { text: "answer of " + name, isError: false }),
    ...(budget ? { searchBudget: budget } : {}),
    emit: (e) => events.push(e), sleep: async () => {},
    here: () => ROOT, root: ROOT, home: "/home/dev", where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p),
    ask: async (pid) => { const card = events.find((e) => e.type === "permission" && e.pid === pid); cards.push({ card, at: at() }); return answer(card); },
    ...(typeof more === "function" ? more({ log, at }) : more),
  }, { text: "go", mode, checker, checkWhere: { key: "pa-" + Math.random().toString(36).slice(2) }, ...(rules ? { rules } : {}), ...(hooks ? { hooks: H.hooksFrom({ hooks }, "settings").list } : {}), connectors, ...opts });
  const when = (ev, tag) => { const x = log.find((e) => e.ev === ev && e.tag === tag); return x ? x.at : -1; };
  const told = (id) => { for (const m of r.messages || []) if (m && m.role === "tool" && m.tool_call_id === id) return String(m.content); return undefined; };
  // The tool answers Grok got next, in the order it got them.
  const order = (k = 1) => (requests[k] ? requests[k].messages.filter((m) => m.role === "tool").map((m) => m.tool_call_id) : []);
  const steps0 = events.filter((e) => e.type === "bash" || e.type === "result").map((e) => e.type + ":" + e.id);
  return { r, log, events, checks, cards, requests, hookIns, most: () => most, mostChecks: () => mostChecks, when, told, order, steps: steps0 };
}

test("PA1 Claude Code 2.1.325's concurrency-safe tools by Coder's names, a call's safety on its input, the groups (consecutive safe calls together, an unsafe one alone), and the early runs' bookkeeping: taken once, only for the same input, a model call's use counted once, nothing left unhandled", async () => {
  assert.deepEqual([...P.SAFE_TOOLS].sort(), ["ask_user", "enter_plan_mode", "exit_plan_mode", "glob", "grep", "lsp", "monitor", "read", "stop_job", "task_get", "task_list", "task_update", "tool_search", "web_fetch", "web_search"]);
  const ro = { readOnly: (cmd) => /^(ls|cat|grep)\b/.test(cmd), connector: (n) => (n === "mcp__x__list" ? true : n === "mcp__x__make" ? false : undefined) };
  const safe = (name, args) => P.safeCall({ name, args }, ro);
  for (const n of ["read", "grep", "glob", "lsp", "web_fetch", "web_search", "tool_search", "task_get", "task_list", "task_update"]) assert.equal(safe(n, {}), true, n);
  for (const n of ["edit", "write", "todo_write", "task_create", "request_secret", "update_environment", "pull_request", "review", "powershell"]) assert.equal(safe(n, {}), false, n);
  assert.equal(safe("bash", { command: "ls src" }), true, "a command that only reads");
  assert.equal(safe("bash", { command: "touch x" }), false, "one that changes something");
  assert.equal(safe("bash", { command: " " }), false);
  assert.equal(safe("mcp__x__list", {}), true, "a connector's read-only tool (readOnlyHint)");
  assert.equal(safe("mcp__x__make", {}), false);
  assert.equal(P.safeCall({ name: "read", args: null }, ro), false, "an input that could not be read runs alone");
  assert.equal(P.safeCall({ name: "grep", args: {} }, { ...ro, inputOk: () => false }), false, "nor one its schema refuses");
  const calls = ["read", "grep", "edit", "glob", "glob", "write", "read"].map((name) => ({ name, args: {} }));
  const isSafe = (c) => P.safeCall(c, ro);
  assert.deepEqual([0, 2, 3, 5, 6].map((i) => P.groupEnd(calls, i, isSafe)), [2, 3, 5, 6, 7]);
  // The early runs.
  const used = [], taken = [];
  let clock = 1000;
  const e = P.earlyRuns({ now: () => clock, onUsage: (u) => used.push(u), onTaken: (id, s, d) => taken.push([id, s, d]) });
  e.start("a", "k1", async () => { clock += 5; return { out: "A", usage: { in: 1 } }; });
  assert.equal(e.has("a"), true);
  assert.deepEqual(await e.take("a", "k1"), { out: "A", usage: null }, "its use taken off: counted once, as it ended");
  assert.deepEqual(used, [{ in: 1 }]);
  assert.deepEqual(taken, [["a", 1000, 1005]]);
  assert.equal(await e.take("a", "k1"), null, "taken once");
  e.start("b", "k1", async () => "B");
  assert.equal(await e.take("b", "k2"), null, "another input: not used");
  let ran = 0;
  e.checkThenRun("c", "auto\nbash: ls", async () => ({ decision: "allow", usage: { in: 2 } }), "bash\nls", async (v) => v.decision !== "block", async () => { ran++; return "C"; });
  assert.deepEqual(await e.takeCheck("c", "auto\nbash: ls"), { decision: "allow", usage: null });
  assert.equal(await e.take("c", "bash\nls"), "C");
  e.checkThenRun("c2", "auto\nbash: ls", async () => ({ decision: "allow" }), "bash\nls", async () => true, async () => "C2");
  await e.takeCheck("c2", "auto\nbash: ls");
  assert.equal(e.takeCheck("c2", "auto\nbash: ls"), null, "its verdict taken once (asked again, its turn starts over on its own)");
  assert.equal(await e.take("c2", "bash\nls"), null);
  e.checkThenRun("d", "auto\nbash: cat x", async () => ({ decision: "block" }), "bash\ncat x", async (v) => v.decision !== "block", async () => { ran++; return "D"; });
  assert.deepEqual(await e.takeCheck("d", "auto\nbash: cat x"), { decision: "block" });
  assert.equal(await e.take("d", "bash\ncat x"), null, "blocked: never run");
  assert.equal(ran, 1);
  e.checkThenRun("f", "auto\nbash: ls", async () => ({ decision: "allow" }), "bash\nls", async () => true, async () => "F");
  assert.equal(e.takeCheck("f", "plan\nbash: ls"), null, "a verdict for another action or mode is not used");
  assert.equal(await e.take("f", "bash\nls"), null, "nor its run");
  // One that fails and is never taken leaves nothing unhandled.
  let loose = 0;
  const onLoose = () => { loose++; };
  process.on("unhandledRejection", onLoose);
  e.start("g", "k", async () => { throw new Error("broken"); });
  await wait(20);
  process.off("unhandledRejection", onLoose);
  assert.equal(loose, 0);
  e.start("h", "k", async () => { throw new Error("broken"); });
  await assert.rejects(e.take("h", "k"), /broken/, "taken, its error is its turn's to handle");
});

test("PA2 several grep, read and glob calls in one reply run at the same time; Grok gets their results, and the chat shows their steps, in the order asked", async () => {
  const t = await job([say("", [call("grep", { pattern: "slow" }, "g1"), call("read", { path: "a.txt" }, "r1"), call("glob", { pattern: "*.js" }, "f1")]), say("done")], { ms: (tag) => (tag === "grep:slow" ? 150 : 40) });
  assert.equal(t.r.status, "done");
  assert.equal(t.most(), 3, "all three at once");
  assert.ok(t.when("end", "read:a.txt") < t.when("end", "grep:slow") && t.when("end", "glob:*.js") < t.when("end", "grep:slow"), "the slow one held none of the others up");
  assert.deepEqual(t.order(), ["g1", "r1", "f1"], "results in the order asked");
  assert.deepEqual(t.steps, ["bash:g1", "result:g1", "bash:r1", "result:r1", "bash:f1", "result:f1"], "steps in the order asked");
  assert.equal(t.told("r1"), "result of read:a.txt");
  assert.match(t.told("g1"), /^result of grep:slow/);
  // One call alone runs as it always did.
  const one = await job([say("", [call("read", { path: "a.txt" }, "r1")]), say("done")]);
  assert.equal(one.told("r1"), "result of read:a.txt");
});

test("PA3 a call that changes something splits the group: it waits for the calls before it to end and runs alone, and the calls after it wait for it; a connector's read-only calls on either side of it too", async () => {
  const t = await job([say("", [call("grep", { pattern: "a" }, "g1"), call("read", { path: "x.txt" }, "r1"), call("edit", { path: "x.txt", old_string: "a", new_string: "b" }, "e1"), call("grep", { pattern: "b" }, "g2"), call("read", { path: "y.txt" }, "r2")]), say("done")]);
  assert.ok(t.when("start", "edit:x.txt") >= Math.max(t.when("end", "grep:a"), t.when("end", "read:x.txt")), "the edit after both");
  assert.ok(t.when("start", "grep:b") >= t.when("end", "edit:x.txt") && t.when("start", "read:y.txt") >= t.when("end", "edit:x.txt"), "the calls after it after it");
  assert.equal(t.most(), 2);
  assert.deepEqual(t.order(), ["g1", "r1", "e1", "g2", "r2"]);
  // A command that writes, between two that only read.
  const b = await job([say("", [call("bash", { command: "ls src" }, "b1"), call("bash", { command: "touch out.txt" }, "b2"), call("bash", { command: "cat README.md" }, "b3")]), say("done")], { rules: { allow: ["Bash(touch *)"], ask: [], deny: [] } });
  assert.ok(b.when("start", "bash:touch out.txt") >= b.when("end", "bash:ls src") && b.when("start", "bash:cat README.md") >= b.when("end", "bash:touch out.txt"));
  // Connectors: read-only ones go together, but not across a call that changes something (they all started at once before).
  const conn = A.connectorTools([{ name: "mcp__x__list", label: "X: list", readOnly: true, perm: "allow", parameters: { type: "object", properties: {} } }]);
  const c = await job([say("", [call("mcp__x__list", { a: 1 }, "k1"), call("mcp__x__list", { a: 2 }, "k2"), call("edit", { path: "x.txt", old_string: "a", new_string: "b" }, "e1"), call("mcp__x__list", { a: 3 }, "k3")]), say("done")], { connectors: conn });
  assert.equal(c.most(), 2, "the first two together");
  assert.ok(c.when("start", 'mcp:mcp__x__list:{"a":3}') >= c.when("end", "edit:x.txt"), "the third after the edit");
  assert.deepEqual(c.order(), ["k1", "k2", "e1", "k3"]);
});

test("PA4 web_fetch and web_search calls in one reply run at the same time (fetches, page readers and searches), each search taken from the chat's budget once, and each model call's use counted once; results in the order asked", async () => {
  let used = 0;
  const budget = { tryConsume: () => { used++; return true; }, max: () => 200, refillsPerHour: () => 0 };
  const steps = [say("", [call("web_fetch", { url: "https://example.com/a", prompt: "what is a" }, "w1"), call("web_search", { query: "first question" }, "s1"), call("web_fetch", { url: "https://example.com/b", prompt: "what is b" }, "w2"), call("web_search", { query: "second question" }, "s2")]), say("done")];
  const t = await job(steps, { rules: { allow: ["WebFetch(domain:example.com)", "WebSearch"], ask: [], deny: [] }, budget, ms: () => 60 });
  assert.equal(t.r.status, "done");
  assert.equal(t.cards.length, 0, "allowed by the owner's rules: no card");
  assert.ok(t.most() >= 4, "the two fetches and the two searches at once: " + t.most());
  assert.equal(used, 2, "two searches from the budget");
  assert.deepEqual(t.order(), ["w1", "s1", "w2", "s2"]);
  assert.equal(t.told("w1"), "what the page says");
  assert.match(t.told("s1"), /found it/);
  const kinds = t.r.usage.map((u) => u.kind).filter(Boolean).sort();
  assert.deepEqual(kinds, ["reader", "reader", "search", "search"], "each counted once");
  // Without a rule, Accept edits asks for each on its card, in its turn: none starts before its card is answered.
  const asked = await job(steps, { budget });
  assert.equal(asked.cards.length, 4);
  for (const [i, tag] of [[0, "web_fetch:https://example.com/a"], [2, "web_fetch:https://example.com/b"]]) assert.ok(asked.when("start", tag) >= asked.cards[i].at, tag + " after its card");
});

test("PA5 in Auto, the checker's verdicts for the group's calls are asked side by side, each call starting once its own verdict lets it; a blocked one never runs and is told why; a command that only reads no longer runs before its verdict", async () => {
  const steps = [say("", [call("bash", { command: "ls src" }, "b1"), call("bash", { command: "cat .env" }, "b2"), call("web_search", { query: "node 22 release date" }, "s1"), call("grep", { pattern: "TODO" }, "g1")]), say("done")];
  const t = await job(steps, { mode: "auto", checker: true, verdict: (a) => (/cat \.env/.test(a) ? '{"decision":"block","rule":"Credential Exploration","reason":"reads a secrets file"}' : '{"decision":"allow"}'), checkMs: 80, ms: () => 40 });
  assert.equal(t.r.status, "done");
  assert.equal(t.checks.length, 3, "one verdict each for the two commands and the search (grep needs none), none asked twice");
  assert.equal(t.mostChecks(), 3, "asked side by side");
  assert.ok(t.when("start", "grep:TODO") < t.when("verdict", "bash: ls src"), "the grep did not wait for any verdict");
  assert.ok(t.when("start", "bash:ls src") >= t.when("verdict", "bash: ls src"), "each command after its own verdict");
  assert.equal(t.when("start", "bash:cat .env"), -1, "the blocked one never ran");
  assert.ok(t.log.some((e) => e.ev === "start" && e.tag.startsWith("search:")));
  assert.match(t.told("b2"), /^Permission for this action was denied by the Coder auto mode classifier\. Reason: \[Credential Exploration\] reads a secrets file\./);
  assert.deepEqual(t.order(), ["b1", "b2", "s1", "g1"]);
  assert.equal(t.r.usage.filter((u) => u.kind === "check").length, 3, "each verdict's use counted once");
  // Page fetches: one to a site no rule allows, judged first (beside the others); one to a pre-approved documentation site,
  // started at the group's start with no verdict, as Claude Code runs it.
  const f = await job([say("", [call("web_fetch", { url: "https://example.com/x", prompt: "x" }, "w1"), call("web_fetch", { url: "https://nodejs.org/api/fs.html", prompt: "fs" }, "w2"), call("read", { path: "a.txt" }, "r1")]), say("done")], { mode: "auto", checker: true, checkMs: 80, ms: () => 40 });
  assert.deepEqual(f.checks.map((x) => x.action), ["web_fetch: https://example.com/x: x"]);
  assert.ok(f.when("start", "web_fetch:https://example.com/x") >= f.when("verdict", "web_fetch: https://example.com/x: x"), "after its verdict");
  assert.ok(f.when("start", "web_fetch:https://nodejs.org/api/fs.html") < f.when("verdict", "web_fetch: https://example.com/x: x"), "the documentation site waited for nothing");
  assert.deepEqual(f.order(), ["w1", "w2", "r1"]);
});

test("PA6 a refused call inside a group is refused in its turn and holds none of the others up; a call that needs a card waits for the owner in its turn while the calls after it already run; a No ends the turn (round 5: one that ran beside the card and returned keeps what it returned)", async () => {
  const rules = { allow: [], deny: ["Read(secret.txt)"], ask: ["Read(ask.txt)"] };
  const steps = [say("", [call("read", { path: "a.txt" }, "r1"), call("read", { path: "secret.txt" }, "r2"), call("read", { path: "ask.txt" }, "r3"), call("read", { path: "b.txt" }, "r4")]), say("done")];
  const t = await job(steps, { rules, ms: () => 40 });
  assert.equal(t.when("start", "read:secret.txt"), -1, "the refused one never ran");
  // (Refused in the same words as when it is asked for alone.)
  const alone = await job([say("", [call("read", { path: "secret.txt" }, "r2")]), say("done")], { rules });
  assert.equal(t.told("r2"), alone.told("r2"));
  assert.match(t.told("r2"), /denied/);
  assert.equal(t.cards.length, 1);
  assert.ok(t.when("start", "read:b.txt") < t.cards[0].at, "the one after the card already ran");
  assert.ok(t.when("start", "read:ask.txt") >= t.cards[0].at, "the card's own call after the owner's yes");
  assert.equal(t.told("r3"), "result of read:ask.txt");
  assert.deepEqual(t.order(), ["r1", "r2", "r3", "r4"]);
  assert.equal(t.log.filter((e) => e.ev === "start" && e.tag === "read:b.txt").length, 1, "run once");
  // The owner says no: the turn ends (round 5, Claude Code 2.1.325's executor after its deny with "interrupt"): the read that
  // ran beside the card and returned before the No keeps what it returned; Grok is not asked again.
  const no = await job(steps, { rules, ms: (tag) => (tag === "read:b.txt" ? 5 : 40), answer: async () => { await wait(40); return { choice: "no" }; } });
  assert.equal(no.told("r3"), REJECTED);
  assert.equal(no.told("r4"), "result of read:b.txt");
  assert.equal(no.told("r1"), "result of read:a.txt");
  assert.equal(no.requests.length, 1);
  assert.notEqual(NOT_NOW, REJECTED, "NOT_NOW stays Gloopy's");
});

test("PA7 (round 5) a PreToolUse hook of the owner's that runs for a call runs at the call's group's start, beside the other calls and their hooks, and the call's run starts after it, as Claude Code runs each call's hooks inside its own run; each hook runs once; PostToolUse hooks run in the order asked, each with its call's own run time", async () => {
  const hooks = { PreToolUse: [{ matcher: "Read", hooks: [{ type: "command", command: "pre.sh" }] }], PostToolUse: [{ matcher: "Grep", hooks: [{ type: "command", command: "post.sh" }] }] };
  const t = await job([say("", [call("read", { path: "a.txt" }, "r1"), call("grep", { pattern: "x" }, "g1"), call("read", { path: "b.txt" }, "r2"), call("grep", { pattern: "y" }, "g2")]), say("done")], { hooks, ms: () => 40, hookMs: (x) => (x.hook_event_name === "PreToolUse" ? 30 : 0) });
  assert.equal(t.r.status, "done");
  assert.ok(t.when("start", "grep:y") < t.when("end", "read:a.txt"), "both greps at the group's start");
  assert.ok(t.when("start", "hook:PreToolUse:r2") < t.when("end", "hook:PreToolUse:r1"), "the two reads' hooks at the same time");
  assert.ok(t.when("start", "read:a.txt") >= t.when("end", "hook:PreToolUse:r1") && t.when("start", "read:b.txt") >= t.when("end", "hook:PreToolUse:r2"), "each read after its own hook");
  assert.ok(t.when("start", "read:b.txt") < t.when("end", "read:a.txt"), "and the hooked reads at the same time, no longer one after another");
  const pre = t.hookIns.filter((h) => h.hook_event_name === "PreToolUse").map((h) => h.tool_use_id);
  assert.deepEqual(pre, ["r1", "r2"], "each read's hook once");
  const post = t.hookIns.filter((h) => h.hook_event_name === "PostToolUse");
  assert.deepEqual(post.map((h) => h.tool_use_id), ["g1", "g2"]);
  for (const h of post) assert.ok(h.duration_ms <= 40 + 30, "its own run time, not its wait for its turn: " + h.duration_ms);
  assert.deepEqual(t.order(), ["r1", "g1", "r2", "g2"]);
});

test("PA8 the record of the files Coder read is kept whole when reads run at the same time: the tools script holds a lock while it changes the record (before, a read made beside another could be lost, and edit then said the file was never read)", async () => {
  const proj = mkdtempSync(join(tmpdir(), "pa-proj-")), seen = mkdtempSync(join(tmpdir(), "pa-seen-"));
  const N = 8;
  for (let k = 0; k < N; k++) writeFileSync(join(proj, "f" + k + ".txt"), "line " + k + "\n");
  const tool = (req) => new Promise((ok) => { const p = spawn("node", ["--no-warnings", TOOLS, Buffer.from(JSON.stringify(req)).toString("base64")], { cwd: proj, env: { ...process.env, CODER_SEEN_DIR: seen } }); let out = ""; p.stdout.on("data", (d) => { out += d; }); p.on("close", (code) => ok({ code, out })); });
  for (let round = 0; round < 2; round++) await Promise.all(Array.from({ length: N }, (_, k) => tool({ tool: "read", args: { path: "f" + k + ".txt" } })));
  const list = JSON.parse(readFileSync(join(seen, "index.json"), "utf8"));
  assert.deepEqual(list.map((x) => x.abs.split("/").pop()).sort(), Array.from({ length: N }, (_, k) => "f" + k + ".txt").sort(), "every read recorded");
  // Each file may then be written over, as one read (Claude Code's Write takes a file read before).
  const wrote = await Promise.all(Array.from({ length: N }, (_, k) => tool({ tool: "write", args: { path: "f" + k + ".txt", content: "new " + k + "\n" } })));
  assert.ok(wrote.every((w) => w.code === 0), wrote.map((w) => w.out).join("\n"));
  // A lock left by a run that was stopped is taken over once it is old.
  writeFileSync(join(seen, "index.lock"), "");
  const old = new Date(Date.now() - 60_000);
  const { utimesSync, existsSync } = await import("node:fs");
  utimesSync(join(seen, "index.lock"), old, old);
  writeFileSync(join(proj, "late.txt"), "late\n");
  assert.equal((await tool({ tool: "read", args: { path: "late.txt" } })).code, 0);
  assert.ok(JSON.parse(readFileSync(join(seen, "index.json"), "utf8")).some((x) => x.abs.endsWith("/late.txt")));
  assert.equal(existsSync(join(seen, "index.lock")), false, "and let go");
});

test("PA9 Gloopy keeps its own run-ahead (its connectors all at once, its commands that only read in a row), unchanged; the source keeps the take of each early result to its call's own input", async () => {
  const src = readFileSync(new URL("../container/coder-agent.mjs", import.meta.url), "utf8");
  assert.match(src, /if \(offered && notYet\.filter\(quiet\)\.length > 1\) for \(const c of notYet\.filter\(quiet\)\) mcpEarly\.set\(c\.id, mcpRun\(c\)\);/);
  assert.match(src, /if \(offered && !ahead\.has\(\(calls\[i\] \|\| \{\}\)\.id\) && i \+ 1 < calls\.length && await okAhead\(calls\[i\]\)/);
  assert.match(src, /if \(!offered && !closing && i >= groupTo\) await startGroup\(i\);/);
  assert.match(src, /r = \(await early\.take\(c\.id, JSON\.stringify\(req\)\)\) \|\| await toolRun\(c, req, args\);/);
  assert.match(src, /const wf = \(await early\.take\(c\.id, "web_fetch\\n" \+ JSON\.stringify\(args\)\)\) \|\| await fetchRun\(args\);/);
  assert.match(src, /const searched = await early\.take\(c\.id, "web_search\\n" \+ JSON\.stringify\(chk\.args\)\);\n\s+if \(!searched && !webBudget\.tryConsume\(\)\) \{/);
  assert.match(readFileSync(new URL("../container/Dockerfile", import.meta.url), "utf8"), /COPY package\.json [^\n]* coder-parallel\.mjs [^\n]*\.\//, "copied into the image");
});

test("PA10 (round 5) the owner's Stop while a group runs: every call that was running then is told Claude Code's rejection with its \"stopped while running\" correction (its step shown stopped), and the job ends there, with no call to Grok", async () => {
  let stop = false;
  const t = await job([say("", [call("read", { path: "a.txt" }, "r1"), call("grep", { pattern: "x" }, "g1"), call("glob", { pattern: "*.md" }, "f1")]), say("never")], { ms: (tag) => (tag === "read:a.txt" ? 20 : 120), deps: { stopped: async () => stop } });
  assert.equal(t.r.status, "done", "the first ends while nothing is stopped");
  assert.equal(t.most(), 3);
  // Stopped once the group has started (the first one's turn sees it before it takes its result): all three were running.
  const s = await job([say("", [call("read", { path: "a.txt" }, "r1"), call("grep", { pattern: "x" }, "g1"), call("glob", { pattern: "*.md" }, "f1")]), say("never")], { ms: () => 60, deps: ({ log }) => ({ stopped: async () => log.some((e) => e.ev === "start" && e.tag === "glob:*.md") }) });
  assert.equal(s.r.status, "stopped");
  for (const id of ["r1", "g1", "f1"]) assert.equal(s.told(id), A.STOPPED_RUNNING, id);
  assert.deepEqual(s.events.filter((e) => e.type === "result").map((e) => [e.id, e.output]), [["r1", "(stopped by the owner while it ran)"], ["g1", "(stopped by the owner while it ran)"], ["f1", "(stopped by the owner while it ran)"]]);
  assert.equal(s.events.filter((e) => e.type === "stopped").length, 1);
  assert.equal(s.requests.length, 1, "Grok is not asked again");
});

test("PA11 a verdict that comes after the job ended (the owner's No on an earlier card ended the turn) starts nothing: the search it was for is never made", async () => {
  const t = await job([say("", [call("web_fetch", { url: "https://ask.example/x", prompt: "x" }, "w1"), call("web_search", { query: "late verdict" }, "s1")]), say("never")], { mode: "auto", checker: true, checkMs: 150, rules: { allow: [], deny: [], ask: ["WebFetch(domain:ask.example)"] }, answer: () => ({ choice: "no" }) });
  assert.equal(t.told("w1"), REJECTED);
  assert.equal(t.told("s1"), REJECTED, "not started when the No came: Claude Code's rejection too (round 5)");
  await wait(300);
  assert.equal(t.checks.length, 1, "its verdict was asked beside the card");
  assert.ok(!t.log.some((e) => e.ev === "start" && e.tag.startsWith("search:")), "and the search never made");
});

// ROUND 5 (the owner, 2026-11-14: "Yes pls" to the last differences round 3 found): Claude Code 2.1.325's executor when a
// round ends early, each call's hooks at its group's start, and Read, Write and Edit's deny rules before the hooks.
const PK = await import("../container/coder-park.mjs");

test("PA12 (round 5) the owner's No on a card: a call that ran beside it and returned before the No keeps what it returned (its step shown, its result told), as Claude Code's executor keeps a finished call's result; one still running and those not started get Claude Code's rejection; nothing new starts, and Grok is not asked again", async () => {
  const rules = { allow: [], deny: [], ask: ["Read(ask.txt)"] };
  const steps = [say("", [call("read", { path: "ask.txt" }, "r1"), call("read", { path: "fast.txt" }, "r2"), call("read", { path: "slow.txt" }, "r3"), call("edit", { path: "x.txt", old_string: "a", new_string: "b" }, "e1"), call("read", { path: "late.txt" }, "r4")]), say("never")];
  const t = await job(steps, { rules, ms: (tag) => (tag === "read:fast.txt" ? 5 : tag === "read:slow.txt" ? 400 : 40), answer: async () => { await wait(60); return { choice: "no" }; } });
  assert.equal(t.r.status, "done");
  assert.equal(t.r.summary, "stopped: the owner said no");
  assert.equal(t.requests.length, 1);
  assert.deepEqual(["r1", "r2", "r3", "e1", "r4"].map((id) => t.told(id)), [REJECTED, "result of read:fast.txt", REJECTED, REJECTED, REJECTED]);
  assert.ok(t.when("start", "read:slow.txt") >= 0, "the slow one had started beside the card");
  assert.equal(t.when("start", "edit:x.txt"), -1, "the edit after the group never started");
  assert.equal(t.when("start", "read:late.txt"), -1);
  // The chat: the card's step said no; the read that returned shows its step and result after it.
  const shown = t.events.filter((e) => e.type === "bash" || e.type === "result").map((e) => e.type + ":" + e.id + (e.output ? ":" + e.output : ""));
  assert.deepEqual(shown, ["bash:r1", "result:r1:Not run: you said no.", "bash:r2", "result:r2:result of read:fast.txt"]);
});

test("PA13 (round 5) each call's PreToolUse hooks at its group's start: a hook's ask keeps its call to its card in its turn; a deny refuses it in its turn, unrun; a hook's allow lets a page fetch the mode would ask about start beside the others with no card; a new input waits for the turn's check; every hook runs once", async () => {
  const hooks = { PreToolUse: [{ matcher: "Read|WebFetch", hooks: [{ type: "command", command: "pre.sh" }] }] };
  const out = (x) => {
    const p = String((x.tool_input && (x.tool_input.file_path || x.tool_input.url)) || "");
    const d = (decision, extra = {}) => JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: decision, permissionDecisionReason: "by the hook", ...extra } });
    if (p.endsWith("ask.txt")) return d("ask");
    if (p.endsWith("deny.txt")) return d("deny");
    if (p.endsWith("swap.txt")) return JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", updatedInput: { file_path: "/work/shop/other.txt" } } });
    if (p.includes("example.com")) return d("allow");
    return "";
  };
  const steps = [say("", [call("read", { path: "a.txt" }, "r1"), call("read", { path: "ask.txt" }, "r2"), call("read", { path: "deny.txt" }, "r3"), call("web_fetch", { url: "https://example.com/p", prompt: "p" }, "w1"), call("read", { path: "swap.txt" }, "r4"), call("read", { path: "b.txt" }, "r5")]), say("done")];
  const t = await job(steps, { hooks, hookOut: out, hookMs: (x) => (x.hook_event_name === "PreToolUse" ? 25 : 0), ms: () => 40 });
  assert.equal(t.r.status, "done");
  const pre = t.hookIns.filter((h) => h.hook_event_name === "PreToolUse").map((h) => h.tool_use_id);
  assert.deepEqual([...pre].sort(), ["r1", "r2", "r3", "r4", "r5", "w1"], "each call's hooks once");
  assert.ok(t.when("start", "hook:PreToolUse:r5") < t.when("end", "hook:PreToolUse:r1"), "all of them at the group's start");
  assert.equal(t.cards.length, 1, "only the hook's ask showed a card");
  assert.ok(t.when("start", "read:ask.txt") >= t.cards[0].at, "its read after the card");
  assert.ok(t.when("start", "web_fetch:https://example.com/p") < t.cards[0].at, "the fetch the hook allowed ran beside the card, with no card of its own");
  assert.ok(t.when("start", "read:b.txt") < t.cards[0].at, "a plain hooked read too");
  assert.equal(t.when("start", "read:deny.txt"), -1, "the denied one never ran");
  assert.match(t.told("r3"), /by the hook/);
  assert.equal(t.when("start", "read:swap.txt"), -1, "the hook's new input, not the old one");
  assert.ok(t.when("start", "read:/work/shop/other.txt") >= t.cards[0].at, "the new input ran in its turn, after the card before it");
  assert.deepEqual(t.order(), ["r1", "r2", "r3", "w1", "r4", "r5"]);
});

test("PA14 (round 5) a card left open pauses the job: the calls beside it that returned keep their results in the chat (their steps shown), the record's later calls are only those still unanswered; the job that takes the round up again runs none of them again (a search is made and counted once) and gives Grok every result; Stop on the paused card keeps them too", async () => {
  let searches = 0;
  const budget = { tryConsume: () => { searches++; return true; }, max: () => 200, refillsPerHour: () => 0 };
  const rules = { allow: ["WebSearch"], deny: [], ask: ["Read(ask.txt)"] };
  const steps = [say("Looking.", [call("read", { path: "ask.txt" }, "r1"), call("web_search", { query: "release notes" }, "s1"), call("read", { path: "fast.txt" }, "r2"), call("read", { path: "slow.txt" }, "r3")]), say("Found it.")];
  const first = await job(steps, { rules, budget, ms: (tag) => (tag === "read:slow.txt" ? 400 : 5), answer: async () => { await wait(80); return { choice: "park" }; } });
  assert.equal(first.r.status, "parked");
  assert.deepEqual(["r1", "s1", "r2", "r3"].map((id) => first.told(id) === undefined ? undefined : String(first.told(id)).slice(0, 18)), [undefined, String(first.told("s1")).slice(0, 18), "result of read:fas", undefined]);
  assert.match(first.told("s1"), /found it/);
  const rec = first.r.parked;
  assert.deepEqual([rec.call.id, rec.rest], ["r1", ["r3"]], "only the slow read, still running, waits for the job taken up again");
  assert.ok(PK.parkedRound(first.r.messages, rec), "the round still waits on its card");
  assert.ok(first.events.some((e) => e.type === "result" && e.id === "s1") && first.events.some((e) => e.type === "result" && e.id === "r2"));
  // Taken up again with a Yes: the card's read runs, then the slow one; the search and the fast read are not run again.
  const again = await job([say("Found it.")], { rules, budget, ms: () => 5, opts: { text: "", messages: first.r.messages, takeUp: { ...rec, answer: { choice: "yes" } } }, answer: async () => { throw new Error("no card again"); } });
  assert.equal(again.r.status, "done");
  assert.equal(searches, 1, "the search was made and counted once");
  assert.equal(again.when("start", "search:ease notes"), -1, "no search in the job taken up again");
  assert.equal(again.when("start", "read:fast.txt"), -1);
  assert.ok(again.when("start", "read:ask.txt") >= 0 && again.when("start", "read:slow.txt") >= 0);
  const sent = again.requests[0].messages.filter((m) => m.role === "tool").map((m) => m.tool_call_id);
  assert.deepEqual([...sent].sort(), ["r1", "r2", "r3", "s1"], "Grok gets every result of the round");
  assert.equal(again.told("r2"), "result of read:fast.txt");
  assert.equal(again.r.messages.filter((m) => m.role === "tool" && m.tool_call_id === "r2").length, 1, "answered once");
  // A No on the paused card: the unanswered one is rejected, the ones that returned keep their results.
  const no = await job([say("never")], { rules, budget, opts: { text: "", messages: first.r.messages, takeUp: { ...rec, answer: { choice: "no" } } } });
  assert.deepEqual(["r1", "s1", "r2", "r3"].map((id) => no.told(id) === REJECTED ? "rejected" : "kept"), ["rejected", "kept", "kept", "rejected"]);
  // Stop on the paused card (Coder's Worker closes it): the same, in the words of Claude Code's Stop on a turn it hands back
  // stopped (NOT_NOW, round 6).
  const closed = PK.closeParked(first.r.messages, rec);
  const said = (id) => closed.filter((m) => m.role === "tool" && m.tool_call_id === id).map((m) => m.content);
  assert.deepEqual([said("r1"), said("r3")], [[NOT_NOW], [NOT_NOW]]);
  assert.deepEqual(said("r2"), ["result of read:fast.txt"]);
});

test("PA15 (round 5) the owner's Stop while the job runs, as Claude Code's executor ends a turn its cloud's Stop aborts (\"remote-cancel\"): a call that returned before the Stop keeps its result, one still running is told its rejection with the \"stopped while running\" correction, one not started its rejection; a card's call stopped while it waited, its rejection; Gloopy keeps its words", async () => {
  let stopAt = 0;
  const t0 = Date.now();
  const steps = [say("", [call("read", { path: "slow.txt" }, "r1"), call("read", { path: "fast.txt" }, "r2"), call("grep", { pattern: "x" }, "g1"), call("edit", { path: "y.txt", old_string: "a", new_string: "b" }, "e1")]), say("never")];
  setTimeout(() => { stopAt = Date.now(); }, 100);
  const t = await job(steps, { ms: (tag) => (tag === "read:fast.txt" ? 5 : 300), deps: { stopped: async () => stopAt > 0, stoppedAt: () => stopAt } });
  assert.equal(t.r.status, "stopped");
  assert.ok(stopAt - t0 >= 90);
  assert.deepEqual(["r1", "r2", "g1", "e1"].map((id) => t.told(id)), [A.STOPPED_RUNNING, "result of read:fast.txt", A.STOPPED_RUNNING, REJECTED]);
  assert.match(A.STOPPED_RUNNING, /^The owner doesn't want to proceed with this tool use\. .* Correction to the text above: this call was stopped while running, not refused before it ran\./);
  assert.equal(t.when("start", "edit:y.txt"), -1);
  assert.equal(t.requests.length, 1);
  assert.deepEqual(t.events.filter((e) => e.type === "result").map((e) => [e.id, e.output]), [["r1", "(stopped by the owner while it ran)"], ["r2", "result of read:fast.txt"], ["g1", "(stopped by the owner while it ran)"]]);
  assert.ok(!t.r.messages.some((m) => m.role === "tool" && /^stopped by the owner$/.test(String(m.content))), "no longer Coder's old words");
  // Stop on a card while its job runs: the card's call was not running, its rejection; the read beside it that returned keeps
  // its result.
  const rules = { allow: [], deny: [], ask: ["Read(ask.txt)"] };
  const c = await job([say("", [call("read", { path: "ask.txt" }, "r1"), call("read", { path: "fast.txt" }, "r2")]), say("never")], { rules, ms: () => 5, answer: async () => { await wait(40); return { choice: "stop" }; } });
  assert.equal(c.r.status, "stopped");
  assert.deepEqual([c.told("r1"), c.told("r2")], [REJECTED, "result of read:fast.txt"]);
  assert.ok(c.events.some((e) => e.type === "result" && e.id === "r1" && e.output === "Not run: stopped."));
  // Coder's machine notes when Stop was pressed, once, and gives it to the job (deps.stoppedAt).
  const server = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(server, /if \(!t\.stop\) t\.stopAt = Date\.now\(\); t\.stop = true;/);
  assert.match(server, /stoppedAt: \(\) => t\.stopAt \|\| 0,/);
  // The source keeps Gloopy's: "stopped by the owner", and NOT_NOW after a No.
  const src = readFileSync(new URL("../container/coder-agent.mjs", import.meta.url), "utf8");
  assert.match(src, /reply\(said \|\| \(offered \? "stopped by the owner" : REJECTED\)\);\n\s+if \(offered\) \{ emit\(\{ type: "stopped" \}\); return end\("stopped"\); \}/);
  assert.match(src, /if \(offered\) \{ for \(const rest of calls0\.slice\(i \+ 1\)\) convo\.push\(\{ role: "tool", tool_call_id: rest\.id, content: NOT_NOW \}\); return end\("done", \{ summary: lastSaid \|\| summary \}\); \}/);
});

test("PA16 (round 5) a read, write or edit that one of the owner's deny rules blocks is refused before its PreToolUse hooks, in Claude Code 2.1.325's words (its validateInput); grep's Read rule, a rule matched only through a link, and the other tools' rules stay its permission check's, after the hooks", async () => {
  const hooks = { PreToolUse: [{ matcher: "Read|Write|Edit|Grep", hooks: [{ type: "command", command: "pre.sh" }] }] };
  const rules = { allow: [], ask: [], deny: ["Read(secret/**)", "Edit(locked.txt)"] };
  const t = await job([say("", [call("read", { path: "secret/a.txt" }, "r1"), call("edit", { path: "locked.txt", old_string: "a", new_string: "b" }, "e1"), call("write", { path: "secret/b.txt", content: "x" }, "w1"), call("grep", { pattern: "k", path: "secret" }, "g1"), call("read", { path: "ok.txt" }, "r2")]), say("done")], { hooks, rules });
  assert.equal(t.r.status, "done");
  const hooked = t.hookIns.filter((h) => h.hook_event_name === "PreToolUse").map((h) => h.tool_use_id).sort();
  assert.deepEqual(hooked, ["g1", "r2"], "no hook for the three a deny rule blocks: refused before hooks run");
  assert.equal(t.told("r1"), "File is in a directory that is denied by your permission settings.");
  assert.equal(t.told("e1"), "File is in a directory that is denied by your permission settings.");
  assert.equal(t.told("w1"), "File is covered by a Read deny rule in your permission settings and cannot be written.");
  assert.match(t.told("g1"), /^Permission to read .*secret has been denied\.$/);
  assert.equal(t.told("r2"), "result of read:ok.txt");
  for (const id of ["r1", "e1", "w1"]) assert.ok(t.events.some((e) => e.type === "bash" && e.id === id) && t.events.some((e) => e.type === "result" && e.id === id && e.ran === false), id + ": its step, refused");
  assert.equal(t.log.filter((e) => e.ev === "start" && /secret|locked/.test(e.tag)).length, 0, "none of them ran");
});

test("PA17 (round 5) a call of the group refused at its start (a deny rule, the checker's block) had its answer then, as Claude Code's refused call has it in its own run: a No keeps its refusal, and a pause keeps it with the others' results, so the job taken up again asks the checker nothing again", async () => {
  const rules = { allow: [], deny: ["Read(secret.txt)"], ask: ["Read(ask.txt)"] };
  const verdict = (a) => (/cat \.env/.test(a) ? '{"decision":"block","rule":"Credential Exploration","reason":"reads a secrets file"}' : '{"decision":"allow"}');
  const steps = [say("Checking.", [call("read", { path: "ask.txt" }, "r1"), call("bash", { command: "cat .env" }, "b1"), call("bash", { command: "ls src" }, "b2"), call("read", { path: "secret.txt" }, "r2")]), say("Checked.")];
  const opts = { mode: "auto", checker: true, verdict, checkMs: 30, rules, ms: () => 10 };
  const no = await job(steps, { ...opts, answer: async () => { await wait(120); return { choice: "no" }; } });
  assert.equal(no.told("r1"), REJECTED);
  assert.match(no.told("b1"), /^Permission for this action was denied by the Coder auto mode classifier\. Reason: \[Credential Exploration\]/);
  assert.equal(no.told("b2"), "ran ls src");
  assert.equal(no.told("r2"), "File is in a directory that is denied by your permission settings.");
  assert.equal(no.checks.length, 2);
  // Paused instead: all three are answered before the pause; taken up again, the checker is asked nothing more.
  const first = await job(steps, { ...opts, answer: async () => { await wait(120); return { choice: "park" }; } });
  assert.equal(first.r.status, "parked");
  assert.deepEqual(first.r.parked.rest, []);
  assert.deepEqual(["b1", "b2", "r2"].map((id) => typeof first.told(id)), ["string", "string", "string"]);
  const again = await job([say("Checked.")], { ...opts, opts: { text: "", messages: first.r.messages, takeUp: { ...first.r.parked, answer: { choice: "yes" } } }, answer: async () => { throw new Error("no card again"); } });
  assert.equal(again.r.status, "done");
  assert.equal(again.checks.length, 0, "no verdict asked again");
  assert.equal(again.when("start", "bash:ls src"), -1, "nothing run again");
  assert.equal(again.told("r1"), "result of read:ask.txt");
});

test("PA18 (round 5) the early starts' bookkeeping for a round that ends early: where each stood at a time (done, running, waiting, none; one refused at the group's start, or blocked by its verdict, done; a search the budget refused is not), hooks taken once and only for the same input, and what each gets (closedAs: Claude Code's executor's outcomes)", async () => {
  let clock = 100;
  const e = P.earlyRuns({ now: () => clock });
  let finish;
  e.start("a", "k", () => new Promise((ok) => { finish = ok; }));
  await wait(0);
  assert.equal(e.state("a"), "running");
  clock = 150; finish("A"); await wait(0);
  assert.deepEqual([e.state("a", 149), e.state("a", 150), e.state("a")], ["running", "done", "done"], "done only from when its result came");
  e.start("n", "k", async () => null);
  await wait(0);
  assert.equal(e.state("n"), "waiting", "nothing given: not done");
  e.start("f", "k", async () => { throw new Error("x"); });
  await wait(0);
  assert.equal(e.state("f"), "done", "its error came: its turn tells it");
  e.refused("r");
  assert.deepEqual([e.state("r"), e.has("r")], ["done", true]);
  assert.equal(await e.take("r", "k"), null, "no run of it to take");
  e.checkThenRun("b", "auto\nx", async () => ({ decision: "block" }), "k", async (v) => v.decision !== "block", async () => "B");
  e.checkThenRun("c", "auto\ny", () => new Promise(() => {}), "k", async () => true, async () => "C");
  await wait(0); await wait(0);
  assert.deepEqual([e.state("b"), e.state("c"), e.state("zz")], ["done", "waiting", "none"]);
  // Hooks: waiting while they run; taken once, for the same input.
  let hooksDone;
  e.startHooks("h", "in1", () => new Promise((ok) => { hooksDone = ok; }));
  assert.deepEqual([e.has("h"), e.state("h")], [true, "waiting"]);
  await wait(0);
  hooksDone({ decision: "allow" });
  assert.equal(e.takeHooks("h", "in2"), null, "another input: its turn runs them");
  e.startHooks("g", "in1", async () => ({ decision: "allow" }));
  assert.deepEqual(await e.takeHooks("g", "in1"), { decision: "allow" });
  assert.equal(e.takeHooks("g", "in1"), null, "once");
  // What each call after the one that ended the round gets.
  const table = ["no", "stop", "park"].map((why) => ["done", "running", "waiting", "none"].map((st) => P.closedAs(why, st)));
  assert.deepEqual(table, [["turn", "rejected", "rejected", "rejected"], ["turn", "stopped-running", "rejected", "rejected"], ["turn", "later", "later", "later"]]);
  assert.ok(new P.RoundClosing("no") instanceof P.RoundClosing);
});
