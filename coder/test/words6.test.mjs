// ROUND 6, WORDS (2026-11-14, the owner: "do what claude code does"): the reason lines left in Coder's own words on its
// permission cards, and the refusals Coder is told where no one can answer, copied from Claude Code 2.1.325's program: its
// permission dialog's line for an ask rule ("Permission rule <rule> requires confirmation for this command.", in auto mode
// "Ask rule <rule> overrides auto mode for this command."), for a PreToolUse hook's ask with no reason ("Hook PreToolUse:Bash
// requires confirmation for this command."), and the asks themselves, what its model is told (a bare -p run returns them;
// after its "What required approval:" under denyInsteadOfPrompting): "Claude requested permissions to use Bash, but you
// haven't granted it yet.", Write's and Edit's "Claude requested permissions to edit <path> which is a sensitive file." and
// "Cannot write to <path> while in plan mode.", an MCP tool's "Cannot call <tool> while in plan mode.", Monitor's "Monitor
// will open a WebSocket to <url>", a hook's "Hook PreToolUse:Bash asked for confirmation for this tool". "Claude" is Coder.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const P = await import("../container/coder-perms.mjs");
const W = await import("../container/coder-websearch.mjs");
const H = await import("../container/coder-hooks.mjs");
const A = await import("../container/coder-agent.mjs");
const read = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const ROOT = "/work/shop";
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });

/** Coder's loop on a pretend machine: each card answered from `answers` ("no" when they run out); `noOne`: no way to ask. */
async function job(steps, { mode = "acceptEdits", rules = null, answers = [], hooks = null, hookRun = () => ({}), noOne = false, extra = {} } = {}) {
  const events = [], seen = [], ran = [], cards = [];
  let n = 0, k = 0;
  const r = await A.runCoder({
    send: async (req) => { seen.push(req); return steps[Math.min(n++, steps.length - 1)]; },
    exec: async (x) => {
      const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
      if (mark && x.hook === true) { const a = (await hookRun(JSON.parse(x.payload))) || {}; return { code: 0, output: String(a.stdout || "") + "\n" + mark[0] + "\n" }; }
      ran.push(x.command);
      return { code: 0, output: "ok\n" };
    },
    emit: (e) => events.push(e),
    here: () => ROOT, root: ROOT, chatId: "shop-wd", where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p),
    ...(noOne ? {} : { ask: async (pid) => { cards.push(events.find((e) => e.type === "permission" && e.pid === pid)); return answers[k++] || { choice: "no" }; } }),
  }, { text: "go", mode, rules, ...(hooks ? { hooks: H.hooksFrom({ hooks }, "settings").list } : {}), ...extra });
  const told = (id) => (r.messages.find((m) => m.role === "tool" && m.tool_call_id === id) || {}).content;
  return { r, events, seen, cards, told, ran: ran.filter((c) => !/coder-tools\.mjs/.test(c)) };
}
const askHook = (matcher) => ({ PreToolUse: [{ matcher, hooks: [{ type: "command", command: "ask.sh" }] }] });
const askOut = (reason) => () => ({ stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "ask", ...(reason ? { permissionDecisionReason: reason } : {}) } }) });
const DENIED = (what) => A.DENY_INSTEAD_TEXT + what;

test("WD1 an ask rule's line on Coder's cards in Claude Code 2.1.325's words, its permission dialog's (\"Permission rule … requires confirmation for this command.\", \"… this tool.\" on a tool's card, \"Ask rule … overrides auto mode …\" in Auto), and what Coder is told of it, Claude Code's ask (\"Coder requested permissions to use Bash, but you haven't granted it yet.\"): bash, PowerShell, a monitor's command and a WebSocket watch, web_search", () => {
  assert.equal(P.ruleAskWhy("Bash(npm test)", "acceptEdits"), "Permission rule Bash(npm test) requires confirmation for this command.");
  assert.equal(P.ruleAskWhy("Bash(npm test)", "plan"), "Permission rule Bash(npm test) requires confirmation for this command.");
  assert.equal(P.ruleAskWhy("Bash(npm test)", "auto"), "Ask rule Bash(npm test) overrides auto mode for this command.");
  assert.equal(P.ruleAskWhy("WebSearch", "acceptEdits", "tool"), "Permission rule WebSearch requires confirmation for this tool.");
  assert.equal(P.askedWhy("Bash"), "Coder requested permissions to use Bash, but you haven't granted it yet.");
  // bash: a rule on the command, on one of its settings, on a file it names.
  const bd = (cmd, mode, rules, input = null) => P.bashDecision(cmd, { mode, rules, cwd: ROOT, workdirs: [ROOT], input });
  for (const [mode, line] of [["acceptEdits", "Permission rule Bash(npm test) requires confirmation for this command."], ["plan", "Permission rule Bash(npm test) requires confirmation for this command."], ["auto", "Ask rule Bash(npm test) overrides auto mode for this command."]]) {
    const d = bd("npm test", mode, { ask: ["Bash(npm test)"] });
    assert.deepEqual([d.verdict, d.rule, d.why, d.told, d.byRule], ["ask", "Bash(npm test)", line, "Coder requested permissions to use Bash, but you haven't granted it yet.", true], mode);
  }
  assert.equal(bd("make", "acceptEdits", { ask: ["Bash(timeout:*)"] }, { command: "make", timeout: 9000 }).why, "Permission rule Bash(timeout:*) requires confirmation for this command.");
  assert.equal(bd("cat .env", "acceptEdits", { ask: ["Read(./.env)"] }).why, "Permission rule Read(./.env) requires confirmation for this command.");
  // PowerShell: its command too.
  const pd = P.psDecision("Get-Content notes.txt", { mode: "acceptEdits", rules: { ask: ["PowerShell(Get-Content *)"] } });
  assert.deepEqual([pd.verdict, pd.why, pd.told], ["ask", "Permission rule PowerShell(Get-Content *) requires confirmation for this command.", "Coder requested permissions to use PowerShell, but you haven't granted it yet."]);
  // A monitor's command: the owner's rule as written; a Monitor rule's ask told as Claude Code's for Monitor.
  const mr = P.monitorRules({ ask: ["Monitor(tail *)"] }, "acceptEdits");
  const md = P.namedForMonitor(P.bashDecision("tail -f log", { mode: "acceptEdits", rules: mr, cwd: ROOT, workdirs: [ROOT], input: { command: "tail -f log" }, settings: P.MONITOR_SETTINGS }), mr);
  assert.deepEqual([md.rule, md.why, md.told], ["Monitor(tail *)", "Permission rule Monitor(tail *) requires confirmation for this command.", "Coder requested permissions to use Monitor, but you haven't granted it yet."]);
  // A WebSocket watch: its Monitor dialog's "this tool"; its own ask, with its subprotocols as Claude Code lists them.
  assert.equal(P.wsDecision({ rules: { ask: ["Monitor"] }, mode: "acceptEdits" }).why, "Permission rule Monitor requires confirmation for this tool.");
  assert.deepEqual([P.wsDecision({ rules: { ask: ["Bash"] }, mode: "auto" }).why, P.wsDecision({ rules: { ask: ["Bash"] }, mode: "auto" }).strict], ["Ask rule Bash overrides auto mode for this tool.", true]);
  assert.equal(P.wsAskText("wss://feed.example.com/x"), "Monitor will open a WebSocket to wss://feed.example.com/x");
  assert.equal(P.wsAskText("wss://a.b/c", ["v1", "chat"]), 'Monitor will open a WebSocket to wss://a.b/c (subprotocols: "v1", "chat")');
  assert.equal(P.wsAskText("wss://a.b/c", ["p".repeat(49), "b", "c", "d", "e", "f"]), 'Monitor will open a WebSocket to wss://a.b/c (subprotocols: "' + "p".repeat(48) + '…", "b", "c", "d" (+2 more))');
  // web_search.
  assert.equal(W.searchDecision({ mode: "plan", rules: { ask: ["WebSearch"] } }).why, "Permission rule WebSearch requires confirmation for this tool.");
  assert.equal(W.searchDecision({ mode: "auto", rules: { ask: ["WebSearch(query:x)"] }, input: { query: "x" } }).why, "Ask rule WebSearch(query:x) overrides auto mode for this tool.");
  // A hook's ask and plan mode's, Claude Code's words.
  assert.equal(P.hookAskWhy("Bash", "command"), "Hook PreToolUse:Bash requires confirmation for this command.");
  assert.equal(P.hookAskTold("Write"), "Hook PreToolUse:Write asked for confirmation for this tool");
  assert.equal(P.planWriteWhy("/work/shop/notes.md"), "Cannot write to /work/shop/notes.md while in plan mode.");
  assert.equal(P.planWriteWhy("/work/shop/a\nb.md"), "Cannot write to /work/shop/a&#10;b.md while in plan mode.", "a control character as Claude Code writes it");
  assert.equal(P.planCallWhy("mcp__linear__create_issue"), "Cannot call mcp__linear__create_issue while in plan mode.");
  // None of Coder's own words for these is left in Coder's code (Gloopy's own cards are Gloopy's).
  for (const f of ["container/coder-perms.mjs", "container/coder-agent.mjs", "container/coder-websearch.mjs"]) {
    const src = read(f);
    for (const gone of ["asks first for this command", "asks first for every command", "\" asks first.\"", "Plan mode is on:", "is a protected file: it can make code run", "is a protected file (it can make code run on the owner's computer, or change how the project is built), so it is not changed", "A PreToolUse hook asks", "Coder wants to open a WebSocket", "and no one can answer in this job\"", "asks them first, and no one can answer here", "the owner must approve fetching", "the owner must approve opening a WebSocket"]) assert.ok(!src.includes(gone), f + ": " + gone);
  }
});

test("WD2 in Coder's loop: the cards' lines and what Coder is told, Claude Code's: a rule's card and its ask (where no one can answer, and after \"What required approval:\" when Settings refuse instead of asking); plan mode's for a write and for Coder's own pull request; a protected file's for write and edit; a hook's ask with no reason; a WebSocket watch's", async () => {
  // A bash rule, in Accept edits: the card's line; the card carries nothing more for the page.
  let t = await job([say("", [call("bash", { command: "npm test" }, "b1")]), say("ok")], { rules: { allow: [], ask: ["Bash(npm test)"], deny: [] }, answers: [{ choice: "yes" }] });
  assert.deepEqual([t.cards.length, t.cards[0].why, "told" in t.cards[0]], [1, "Permission rule Bash(npm test) requires confirmation for this command.", false]);
  // Settings: refuse instead of asking: Coder told Claude Code's ask after its "What required approval:".
  t = await job([say("", [call("bash", { command: "npm test" }, "b1")]), say("ok")], { rules: { allow: [], ask: ["Bash(npm test)"], deny: [] }, extra: { denyInstead: true } });
  assert.equal(t.told("b1"), DENIED("Coder requested permissions to use Bash, but you haven't granted it yet. (npm test)"));
  // Another tool under a rule: its card's line in Auto; where no one can answer, Claude Code's ask.
  t = await job([say("", [call("task_create", { subject: "a", description: "a" }, "t1")]), say("ok")], { mode: "auto", rules: { allow: [], ask: ["TaskCreate"], deny: [] }, answers: [{ choice: "yes" }] });
  assert.equal(t.cards[0].why, "Ask rule TaskCreate overrides auto mode for this tool.");
  t = await job([say("", [call("task_create", { subject: "a", description: "a" }, "t1")]), say("ok")], { rules: { allow: [], ask: ["TaskCreate"], deny: [] }, noOne: true });
  assert.equal(t.told("t1"), "Coder requested permissions to use TaskCreate, but you haven't granted it yet.");
  // Plan mode: a write, by its path in full; where no one can answer, Coder told the same.
  t = await job([say("", [call("write", { path: "notes.md", content: "x\n" }, "w1")]), say("ok")], { mode: "plan" });
  assert.deepEqual([t.cards[0].tool, t.cards[0].path, t.cards[0].why], ["write", "notes.md", "Cannot write to /work/shop/notes.md while in plan mode."]);
  t = await job([say("", [call("write", { path: "src/new.js", content: "x\n" }, "w2")]), say("ok")], { mode: "plan", noOne: true });
  assert.equal(t.told("w2"), "Cannot write to /work/shop/src/new.js while in plan mode.");
  // Plan mode: Coder's own pull request (as Claude Code's MCP tools that may change something).
  t = await job([say("", [call("pull_request", { title: "Fix the cart", body: "x" }, "p1")]), say("ok")], { mode: "plan" });
  assert.deepEqual([t.cards[0].tool, t.cards[0].why], ["pull_request", "Cannot call pull_request while in plan mode."]);
  // A protected file: Write's and Edit's own check, by the path in full; a .claude folder's settings file in its other words.
  t = await job([say("", [call("write", { path: ".husky/pre-commit", content: "npm test\n" }, "w1")]), say("ok")]);
  assert.equal(t.cards[0].why, "Coder requested permissions to edit /work/shop/.husky/pre-commit which is a sensitive file.");
  t = await job([say("", [call("edit", { path: ".claude/settings.json", old_string: "a", new_string: "b" }, "e1")]), say("ok")], { mode: "plan" });
  assert.equal(t.cards[0].why, "Coder requested permissions to write to /work/shop/.claude/settings.json, but you haven't granted it yet.", "a protected path before plan mode, as Claude Code's order");
  // From GitHub, where no one can answer: told Claude Code's ask itself, a write's and a command's.
  t = await job([say("", [call("write", { path: ".npmrc", content: "registry=x\n" }, "w1"), call("bash", { command: "echo x > .bashrc" }, "b1")]), say("ok")], { mode: "auto", noOne: true, extra: { github: true } });
  assert.equal(t.told("w1"), "Coder requested permissions to edit /work/shop/.npmrc which is a sensitive file.");
  assert.equal(t.told("b1"), "Coder requested permissions to edit /work/shop/.bashrc which is a sensitive file.");
  // A PreToolUse hook's ask with no reason: its dialog's line; Coder told its words for it. With a reason: the reason.
  t = await job([say("", [call("bash", { command: "npm test" }, "b1")]), say("ok")], { mode: "auto", hooks: askHook("Bash"), hookRun: askOut("") });
  assert.equal(t.cards[0].why, "Hook PreToolUse:Bash requires confirmation for this command.");
  t = await job([say("", [call("bash", { command: "npm test" }, "b1")]), say("ok")], { mode: "auto", hooks: askHook("Bash"), hookRun: askOut(""), extra: { denyInstead: true } });
  assert.equal(t.told("b1"), DENIED("Hook PreToolUse:Bash asked for confirmation for this tool (npm test)"));
  t = await job([say("", [call("write", { path: "notes.md", content: "x\n" }, "w1")]), say("ok")], { mode: "acceptEdits", hooks: askHook("Write"), hookRun: askOut("") });
  assert.equal(t.cards[0].why, "Hook PreToolUse:Write requires confirmation for this edit.");
  t = await job([say("", [call("write", { path: "notes.md", content: "x\n" }, "w1")]), say("ok")], { mode: "acceptEdits", hooks: askHook("Write"), hookRun: askOut("check the notes"), noOne: true });
  assert.equal(t.told("w1"), "check the notes");
  // A WebSocket watch: Claude Code's ask on its card and, where no one can answer, what Coder is told; a rule adds only its line.
  const ws = (id) => call("monitor", { ws: { url: "wss://feed.example.com/deploys", protocols: ["v1"] }, description: "Deploy feed", timeout_ms: 600000 }, id);
  t = await job([say("", [ws("m1")]), say("ok")]);
  assert.equal(t.cards[0].why, 'Monitor will open a WebSocket to wss://feed.example.com/deploys (subprotocols: "v1")');
  t = await job([say("", [ws("m1")]), say("ok")], { noOne: true });
  assert.equal(t.told("m1"), 'Monitor will open a WebSocket to wss://feed.example.com/deploys (subprotocols: "v1")');
  t = await job([say("", [ws("m1")]), say("ok")], { rules: { allow: [], ask: ["Monitor"], deny: [] }, noOne: true });
  assert.equal(t.told("m1"), 'Monitor will open a WebSocket to wss://feed.example.com/deploys (subprotocols: "v1")');
});
