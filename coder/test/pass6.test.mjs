// BASH DOCS PASS 6 (the owner, 2026-11-10: "yea do all of them"): the last differences found between Claude Code's Bash
// docs and Coder, each test checked against Claude Code's own words (its docs, and its program, version 2.1.322).
import { test } from "node:test";
import assert from "node:assert/strict";

const H = await import("../container/coder-hooks.mjs");
const ROOT = "/work/shop";
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const CHECKER = /^You are the safety checker of Coder's auto mode/;

/**
 * Coder's loop on a pretend machine: hooks answered by `hookRun(input)`; the auto mode checker (when on) by `verdict(action)`;
 * each card answered from `answers` (else "yes").
 */
async function job(steps, { hooks = null, hookRun = () => ({}), mode = "auto", text = "go", answers = [], checker = false, verdict = () => '{"decision":"allow"}', rules = null, extra = {}, deps = {} } = {}) {
  const { runCoder } = await import("../container/coder-agent.mjs");
  const events = [], seen = [], ran = [], hookCalls = [], cards = [], checks = [], execs = [];
  let n = 0, k = 0;
  const r = await runCoder({
    send: async (req) => {
      const sys = req.messages && req.messages[0] && req.messages[0].content;
      if (CHECKER.test(String(sys || ""))) {
        checks.push(req);
        const action = String(req.messages[1].content).split("THE ACTION TO JUDGE:\n")[1] || "";
        return { message: { role: "assistant", content: verdict(action, req) }, usage: { in: 100, out: 5 } };
      }
      seen.push(req);
      return steps[Math.min(n++, steps.length - 1)];
    },
    exec: async (x) => {
      const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
      if (mark && x.hook === true) {
        const input = JSON.parse(x.payload);
        hookCalls.push({ input, command: x.command });
        const a = (await hookRun(input, x.command)) || {};
        return { code: Number.isInteger(a.code) ? a.code : 0, output: String(a.stdout || "") + "\n" + mark[0] + "\n" + String(a.stderr || "") };
      }
      execs.push(x);
      ran.push(x.command);
      return { code: 0, output: "ok\n" };
    },
    emit: (e) => events.push(e),
    here: () => ROOT, root: ROOT, chatId: "shop-p6", where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p),
    ask: async (pid) => { cards.push(events.find((e) => e.type === "permission" && e.pid === pid)); return answers[k++] || { choice: "yes" }; },
    ...deps,
  }, { text, mode, rules, checker, checkWhere: { key: "chat-" + Math.random().toString(36).slice(2), repo: "ana/shop", branch: "coder/shop-1" }, ...(hooks ? { hooks: H.hooksFrom({ hooks }, "settings").list } : {}), ...extra });
  const told = (id) => { for (const req of seen) for (const m of req.messages) if (m.role === "tool" && m.tool_call_id === id) return m.content; return ""; };
  return { r, events, seen, ran: ran.filter((c) => !/coder-tools\.mjs/.test(c)), execs, hookCalls, cards, checks, told };
}
const hk = (cmd) => [{ hooks: [{ type: "command", command: cmd }] }];
const ALLOW = () => ({ stdout: '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}' });

test("CD387 Plan mode: a PreToolUse hook's allow has no effect on a command that isn't read-only (Claude Code's \"Hook approvals in plan mode\"); its new input still applies; read-only commands and other modes as before; the plan itself, approved by a hook with a new input, needs no card", async () => {
  // Plan, a command that changes a file: the same card as with no hook.
  let t = await job([say("", [call("bash", { command: "touch notes.txt", description: "Make notes" }, "b1")]), say("ok")], { hooks: { PreToolUse: hk("allow.sh") }, hookRun: ALLOW, mode: "plan" });
  assert.equal(t.cards.length, 1, "asked, as with no hook");
  assert.deepEqual([t.cards[0].tool, t.cards[0].id], ["bash", "b1"]);
  // Refused on the card: it never runs.
  t = await job([say("", [call("bash", { command: "touch notes.txt", description: "Make notes" }, "b1")]), say("ok")], { hooks: { PreToolUse: hk("allow.sh") }, hookRun: ALLOW, mode: "plan", answers: [{ choice: "no" }] });
  assert.deepEqual(t.ran, []);
  // Its updatedInput still applies: the card and the run are for the hook's command.
  t = await job([say("", [call("bash", { command: "npm test", description: "Test" }, "b1")]), say("ok")], { hooks: { PreToolUse: hk("ci.sh") }, mode: "plan", hookRun: () => ({ stdout: '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","updatedInput":{"command":"npm test -- --ci","description":"Test"}}}' }) });
  assert.equal(t.cards.length, 1);
  assert.ok(t.events.some((e) => e.type === "bash" && e.id === "b1" && e.command === "npm test -- --ci"), "the card is for the hook's command");
  assert.deepEqual(t.ran.map((c) => c.split("\n").pop()), ["npm test -- --ci"]);
  // A read-only command: no card, in Plan as before.
  t = await job([say("", [call("bash", { command: "ls src", description: "List" }, "b1")]), say("ok")], { hooks: { PreToolUse: hk("allow.sh") }, hookRun: ALLOW, mode: "plan" });
  assert.deepEqual([t.cards.length, t.ran.length], [0, 1]);
  // Accept edits: the hook's allow still skips the question.
  t = await job([say("", [call("bash", { command: "touch notes.txt", description: "Make notes" }, "b1")]), say("ok")], { hooks: { PreToolUse: hk("allow.sh") }, hookRun: ALLOW, mode: "acceptEdits" });
  assert.deepEqual([t.cards.length, t.ran.length], [0, 1]);
  // Plan with the checker (CODER_USE_AUTO_MODE_DURING_PLAN on): the hook's allow doesn't skip its judging there either.
  t = await job([say("", [call("bash", { command: "touch notes.txt", description: "Make notes" }, "b1")]), say("ok")], { hooks: { PreToolUse: hk("allow.sh") }, hookRun: ALLOW, mode: "plan", checker: true, verdict: () => '{"decision":"block","rule":"Local Operations","reason":"Plan mode changes no files"}' });
  assert.equal(t.checks.length, 1, "judged, as with no hook");
  assert.deepEqual(t.ran, []);
  // In Auto the hook's allow still skips the checker (Claude Code: "allow skips the permission prompt").
  t = await job([say("", [call("bash", { command: "touch notes.txt", description: "Make notes" }, "b1")]), say("ok")], { hooks: { PreToolUse: hk("allow.sh") }, hookRun: ALLOW, mode: "auto", checker: true, verdict: () => '{"decision":"block","rule":"x","reason":"y"}' });
  assert.deepEqual([t.checks.length, t.ran.length], [0, 1]);

  // THE PLAN: a hook's allow with updatedInput approves it with no card; Plan mode goes back to the owner's start mode.
  const planCall = (plan) => [say("", [call("exit_plan_mode", { plan }, "p1")]), say("Starting.")];
  const approve = () => ({ stdout: '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","updatedInput":{"plan":"1. Add the cart test\\n2. Run it"}}}' });
  t = await job(planCall("1. Add the cart test"), { hooks: { PreToolUse: [{ matcher: "ExitPlanMode", hooks: [{ type: "command", command: "approve.sh" }] }] }, hookRun: approve, mode: "plan", extra: { planExit: "acceptEdits" } });
  assert.equal(t.cards.length, 0, "no plan card");
  assert.deepEqual(t.events.filter((e) => e.type === "mode").map((e) => e.mode), ["acceptEdits"]);
  assert.ok(t.events.some((e) => e.type === "note" && e.text === "A PreToolUse hook approved the plan: Plan mode is off (now Accept edits)."));
  assert.equal(t.told("p1"), "The owner has approved your plan. You can now start coding. Start with updating your todo list if applicable\n\n## Approved Plan:\n1. Add the cart test\n2. Run it\n\n## Exited Plan Mode\nYou have exited plan mode. You can now make edits, run tools, and take actions.");
  assert.equal(t.hookCalls[0].input.tool_name, "ExitPlanMode");
  // Its allow alone (no new input): the plan card, as before (Claude Code: "ExitPlanMode need[s] updatedInput paired with "allow"").
  t = await job(planCall("1. Add the cart test"), { hooks: { PreToolUse: hk("allow.sh") }, hookRun: ALLOW, mode: "plan", answers: [{ choice: "no" }] });
  assert.deepEqual([t.cards.length, t.cards[0] && t.cards[0].tool], [1, "plan"]);
  // The start mode by default: Auto.
  t = await job(planCall("1. Add the cart test"), { hooks: { PreToolUse: hk("approve.sh") }, hookRun: approve, mode: "plan" });
  assert.deepEqual(t.events.filter((e) => e.type === "mode").map((e) => e.mode), ["auto"]);
});

test("CD387b the Worker tells the machine the owner's start mode (where a plan a hook approved goes back to), and a WebSocket watch's hook allow does nothing in Plan mode", async () => {
  const { readFileSync } = await import("node:fs");
  const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
  assert.match(read("src/coder-routes.mjs"), /prePlanMode: noAuto\(saved\.mode === "acceptEdits" \? "acceptEdits" : "auto", saved\)/);
  assert.match(read("container/server.mjs"), /planExit: body\.prePlanMode === "acceptEdits" \? "acceptEdits" : "auto"/);
  assert.match(read("container/coder-agent.mjs"), /else if \(c\.hook && c\.hook\.decision === "allow" && !dec\.strict && modeW !== "plan"\) dec = \{ verdict: "allow" \};/);
  // In the loop: a watch in Plan with a hook's allow is still asked about.
  const t = await job([say("", [call("monitor", { description: "Deploy feed", ws: { url: "wss://deploys.example.com/live" } }, "m1")]), say("ok")], { hooks: { PreToolUse: hk("allow.sh") }, hookRun: ALLOW, mode: "plan", answers: [{ choice: "no" }] });
  assert.equal(t.cards.length, 1);
  assert.equal(t.cards[0].tool, "monitor");
});

test("CD388 disableAllHooks by Claude Code's settings precedence: the repository's .claude/settings.local.json, then its .claude/settings.json, then the owner's own (\"a \"disableAllHooks\": false in a project's .claude/settings.json overrides a true in your user settings\")", async () => {
  const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { hooksForTurn } = await import("../container/server.mjs");
  const account = { hooks: { Stop: [{ hooks: [{ type: "command", command: "mine.sh" }] }] } };
  const d = mkdtempSync(join(tmpdir(), "coder-p6hk-"));
  mkdirSync(join(d, ".claude"));
  const put = (f, v) => writeFileSync(join(d, ".claude", f), JSON.stringify(v));
  const names = (r) => r.map((h) => h.command);
  // The owner's true, the repository's false: the repository's wins, so hooks run (the owner's and the repository's).
  put("settings.json", { disableAllHooks: false, hooks: { Stop: [{ hooks: [{ type: "command", command: "repo.sh" }] }] } });
  assert.deepEqual(names(hooksForTurn(d, { ...account, disableAllHooks: true })), ["mine.sh", "repo.sh"]);
  // The owner's false, the repository's true: off.
  put("settings.json", { disableAllHooks: true });
  assert.deepEqual(hooksForTurn(d, { ...account, disableAllHooks: false }), []);
  // settings.local.json over settings.json, either way.
  put("settings.local.json", { disableAllHooks: false });
  assert.deepEqual(names(hooksForTurn(d, account)), ["mine.sh"]);
  put("settings.json", { disableAllHooks: false });
  put("settings.local.json", { disableAllHooks: true });
  assert.deepEqual(hooksForTurn(d, account), []);
  // Neither sets it: the owner's own.
  put("settings.json", {});
  put("settings.local.json", {});
  assert.deepEqual(hooksForTurn(d, { ...account, disableAllHooks: true }), []);
  assert.deepEqual(names(hooksForTurn(d, account)), ["mine.sh"]);
  // From GitHub the repository's files aren't read: the owner's alone decides.
  put("settings.json", { disableAllHooks: false });
  assert.deepEqual(hooksForTurn(d, { ...account, disableAllHooks: true }, { github: true }), []);
});

test("CD389 tool-name wildcards in deny and ask rules (Claude Code's \"Tool name wildcards\"): `*` every tool, `B*` Bash, matched on the whole name; an allow one is skipped and approves nothing; a bare-name deny takes the tool away from Grok, Coder's other tools included", async () => {
  const P = await import("../container/coder-perms.mjs");
  assert.deepEqual(P.parseRule("*"), { tool: "*", spec: null, glob: true });
  assert.deepEqual(P.parseRule("mcp__*"), { tool: "mcp__*", spec: null, glob: true });
  assert.equal(P.parseRule("B*(npm *)"), null, "a wildcard tool name takes no content");
  assert.deepEqual([P.parseRule("TodoWrite"), P.parseRule("WebSearch"), P.parseRule("TodoWrite(x)")], [{ tool: "TodoWrite", spec: null }, { tool: "WebSearch", spec: null }, null]);
  const m = P.toolGlobMatches;
  assert.deepEqual([m("*", "Bash"), m("B*", "Bash"), m("B*", "WebFetch"), m("*Fetch", "WebFetch"), m("mcp__*", "Bash"), m("Bash*", "Bash"), m("Ba", "Bash")], [true, true, false, true, false, true, false]);
  // Deny and ask: a wildcard counts as a rule on the whole tool; allow: never.
  assert.deepEqual([P.wholeRule({ deny: ["*"] }, "deny", "Read"), P.wholeRule({ ask: ["W*"] }, "ask", "WebFetch"), P.wholeRule({ allow: ["*"] }, "allow", "Bash")], ["*", "W*", ""]);
  assert.equal(P.bashDecision("ls", { mode: "acceptEdits", rules: { deny: ["*"] } }).verdict, "deny");
  const ask = P.bashDecision("ls", { mode: "acceptEdits", rules: { ask: ["B*"] } });
  assert.deepEqual([ask.verdict, !!ask.byRule], ["ask", true]);
  assert.equal(P.bashDecision("npm test", { mode: "acceptEdits", rules: { allow: ["*", "B*"] } }).verdict, "ask", "an allow wildcard approves nothing");
  assert.equal(P.fetchDecision("https://example.com/a", { mode: "auto", rules: { deny: ["Web*"] } }).why, "Permission to use WebFetch on example.com has been denied.");
  assert.equal(P.fetchDecision("https://example.com/a", { mode: "auto", rules: { ask: ["*"] } }).verdict, "ask");
  assert.equal(P.fileToolDecision("read", "/work/shop/a.txt", { rules: { deny: ["*"] }, root: "/work/shop" }).why, "Permission to use Read has been denied.");
  assert.equal(P.fileToolDecision("write", "/work/shop/a.txt", { rules: { ask: ["*"] }, root: "/work/shop" }).verdict, "ask");
  // A monitor: a wildcard naming Monitor and not Bash is a rule on all of it; one naming Bash applies as it is.
  assert.deepEqual(P.monitorRules({ deny: ["Mon*"], ask: ["*"], allow: [] }), { allow: [], ask: ["*"], deny: ["Bash"] });
  // Saved, and an allow one with Claude Code's point said (an anchored mcp__server__ one is kept quietly: no MCP servers here).
  assert.deepEqual([P.ruleSaved("*"), P.ruleSaved("mcp__*"), P.ruleSaved("mcp__github__get_*")], [true, true, true]);
  assert.equal(P.ruleWarning("allow", "*").warning, 'Allow rule "*" names tools with a wildcard. An allow rule takes a wildcard only after a literal mcp__<server>__ prefix, so this one is skipped and doesn\'t auto-approve anything.');
  assert.equal(P.ruleWarning("allow", "*").notice, "Allow rule * is skipped · it approves nothing");
  assert.deepEqual([P.ruleWarning("allow", "mcp__github__*"), P.ruleWarning("deny", "*"), P.ruleWarning("ask", "B*")], [null, null, null]);
  assert.match(P.ruleProblem("b*"), /^Tool names must start with uppercase/);

  // IN THE LOOP: the tools Grok is offered.
  const names = (t) => (t.seen[0].tools || []).map((x) => x.function.name);
  let t = await job([say("ok")], { rules: { deny: ["*"], ask: [], allow: [] } });
  assert.deepEqual(names(t), [], "a deny on every tool: none offered");
  assert.equal(t.seen[0].webSearch, false, "Grok's web search off too");
  t = await job([say("ok")], { rules: { deny: ["Bash"], ask: [], allow: [] } });
  assert.ok(!names(t).includes("bash") && !names(t).includes("monitor") && names(t).includes("read"));
  t = await job([say("ok")], { rules: { deny: ["TodoWrite", "W*"], ask: [], allow: [] } });
  assert.ok(!names(t).includes("todo") && !names(t).includes("write") && !names(t).includes("web_fetch") && names(t).includes("edit"));
  assert.equal(t.seen[0].webSearch, false, "W* names WebSearch");
  t = await job([say("ok")], { rules: { deny: [], ask: [], allow: ["*"] } });
  assert.ok(names(t).includes("bash") && t.seen[0].webSearch === undefined, "an allow wildcard takes nothing away");
  // A call to a denied tool anyway: refused in Claude Code's words.
  t = await job([say("", [call("todo", { items: [{ text: "a", status: "pending" }] }, "t1")]), say("ok")], { rules: { deny: ["*"], ask: [], allow: [] } });
  assert.equal(t.told("t1"), "Permission to use TodoWrite has been denied.");
  assert.ok(!t.events.some((e) => e.type === "todo"));
  // An ask rule on Coder's other tools: a card first; Yes runs it, No stops.
  t = await job([say("", [call("todo", { items: [{ text: "a", status: "pending" }] }, "t1")]), say("ok")], { rules: { deny: [], ask: ["*"], allow: [] } });
  assert.deepEqual([t.cards.length, t.cards[0].tool, t.cards[0].what, t.cards[0].why], [1, "todo", "Use TodoWrite", "Your rule * asks first for TodoWrite."]);
  assert.ok(t.events.some((e) => e.type === "todo"));
  t = await job([say("", [call("todo", { items: [{ text: "a", status: "pending" }] }, "t1")]), say("ok")], { rules: { deny: [], ask: ["TodoWrite"], allow: [] }, answers: [{ choice: "no" }] });
  assert.ok(!t.events.some((e) => e.type === "todo"));
  // Its own question is the question for ask_user: no card first.
  t = await job([say("", [call("ask_user", { question: "Which?", options: [{ label: "A", description: "a" }, { label: "B", description: "b" }] }, "q1")])], { rules: { deny: [], ask: ["*"], allow: [] } });
  assert.equal(t.cards.length, 0);
  assert.ok(t.events.some((e) => e.type === "question"));
  // Bash under an ask wildcard: asked, in Auto too.
  t = await job([say("", [call("bash", { command: "ls", description: "List" }, "b1")]), say("ok")], { rules: { deny: [], ask: ["*"], allow: [] } });
  assert.deepEqual([t.cards.length, t.cards[0] && t.cards[0].tool], [1, "bash"]);
});

test("CD390 the write block (outside Bash; Claude Code's permissions.blockWritesOutsideWorkingDirectories, here CODER_BLOCK_WRITES_OUTSIDE_WORKING_DIRECTORIES): write and edit refuse a path outside the working folders, and a repository's settings files anywhere, in Claude Code's words; Coder's scratch folder and memory file stay writable; commands are not limited", async () => {
  const { mkdtempSync, mkdirSync, realpathSync, readFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const A = await import("../container/coder-agent.mjs");
  const { SCRATCH } = await import("../container/coder-tools.mjs");
  const root = realpathSync(mkdtempSync(join(tmpdir(), "coder-p6wb-")));
  mkdirSync(join(root, "src"));
  const notes = realpathSync(mkdtempSync(join(tmpdir(), "coder-p6wn-")));
  const mem = join(root, "..", "coder-p6-memory.md");
  const deps = { here: () => root, root, where: (p) => (p.startsWith("/") ? p : root + "/" + p), memFile: mem };
  const toolRan = (t, id) => t.execs.some((x) => /coder-tools\.mjs/.test(String(x.command)) && String(x.command).includes(id) || (x.tool && x.id === id));
  const one = async (name, args, extra = { writeBlock: true }, more = {}) => {
    const t = await job([say("", [call(name, args, "w1")]), say("ok")], { deps: { ...deps, ...more }, extra, mode: "acceptEdits" });
    return { t, told: t.told("w1") };
  };
  // Outside: refused, in Claude Code's words with Coder's setting.
  let r = await one("write", { path: "/etc/coder-x.conf", content: "x" });
  assert.equal(r.told, A.WRITE_BLOCKED("/etc/coder-x.conf", [root]));
  assert.equal(r.told, "error: /etc/coder-x.conf is outside " + root + "; the CODER_BLOCK_WRITES_OUTSIDE_WORKING_DIRECTORIES setting blocks writes outside the working directories. Ask the owner to add the directory as a working folder (the rules' Working folders), or to remove that setting.");
  r = await one("edit", { path: "/etc/hosts", old_string: "a", new_string: "b" });
  assert.match(r.told, /^error: \/etc\/hosts is outside /);
  // A settings file, inside the project too.
  r = await one("write", { path: ".claude/settings.json", content: "{}" });
  assert.equal(r.told, "error: " + root + "/.claude/settings.json: Writes to Claude Code settings files are blocked while CODER_BLOCK_WRITES_OUTSIDE_WORKING_DIRECTORIES is on, because a settings file can lift that block.");
  r = await one("edit", { path: ".claude/settings.local.json", old_string: "a", new_string: "b" });
  assert.match(r.told, /\.claude\/settings\.local\.json: Writes to Claude Code settings files are blocked/);
  // Inside, the scratch folder, the memory file: not refused by the block.
  for (const p of ["src/a.js", SCRATCH + "/crop.png", mem]) {
    r = await one("write", { path: p, content: "x" });
    assert.doesNotMatch(r.told, /CODER_BLOCK_WRITES_OUTSIDE_WORKING_DIRECTORIES/, p);
  }
  // A working folder the owner added: writable; one only the repository's settings add: refused.
  r = await one("write", { path: notes + "/a.md", content: "x" }, { writeBlock: true }, { otherRoots: [notes] });
  assert.doesNotMatch(r.told, /CODER_BLOCK_WRITES/);
  r = await one("write", { path: notes + "/a.md", content: "x" }, { writeBlock: true }, { otherRoots: [notes], repoDirs: [notes] });
  assert.match(r.told, /is outside .*CODER_BLOCK_WRITES_OUTSIDE_WORKING_DIRECTORIES/);
  // Off: the block says nothing (the tool's own checks decide).
  r = await one("write", { path: "/etc/coder-x.conf", content: "x" }, {});
  assert.doesNotMatch(r.told, /CODER_BLOCK_WRITES/);
  // Commands are not limited.
  const c = await job([say("", [call("bash", { command: "echo x > /tmp/coder-p6-out.txt", description: "Write" }, "b1")]), say("ok")], { deps, extra: { writeBlock: true }, mode: "auto" });
  assert.doesNotMatch(c.told("b1"), /CODER_BLOCK_WRITES/);
  // The machine turns it on from the environment's variable, and gives Coder its memory file.
  const server = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(server, /writeBlock: varOn\(rawVars\.CODER_BLOCK_WRITES_OUTSIDE_WORKING_DIRECTORIES\)/);
  assert.match(server, /ownDirs: \[bgDir, outDir\],\n[^\n]*\n\s+memFile,\n/);
});

test("CD391 the working folders' own instructions (Claude Code's CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD, here CODER_ADDITIONAL_DIRECTORIES_CODER_MD): each folder's CODER.md, .coder/CODER.md and .coder/rules load as the project's do, named by full path; its path rules and subfolders' files load when Coder works on a file there; off by default", async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, realpathSync, readFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const S = await import("../container/server.mjs");
  const d = realpathSync(mkdtempSync(join(tmpdir(), "coder-p6in-")));
  mkdirSync(join(d, ".coder", "rules"), { recursive: true });
  mkdirSync(join(d, "api"));
  writeFileSync(join(d, "CODER.md"), "Notes repo: keep one file per day.\n<!-- maintainers only -->\n");
  writeFileSync(join(d, ".coder", "rules", "style.md"), "Dates as YYYY-MM-DD.\n");
  writeFileSync(join(d, ".coder", "rules", "sql.md"), "---\npaths:\n  - \"**/*.sql\"\n---\nUse lowercase SQL.\n");
  writeFileSync(join(d, "api", "CODER.md"), "The api folder is generated: never edit it.\n");
  const more = await S.extraInstructions([d], [{ name: "CODER.md", text: "x".repeat(10) }]);
  assert.deepEqual(more.notes.map((n) => n.name), [d + "/CODER.md", d + "/.coder/rules/style.md"]);
  assert.equal(more.notes[0].text.trim(), "Notes repo: keep one file per day.", "comments left out, as the project's");
  assert.deepEqual(more.later.map((x) => [x.name, x.root]), [[d + "/.coder/rules/sql.md", d], [d + "/api/CODER.md", d]]);
  // Loaded when Coder works on a file there (a full path), once.
  const shown = new Set();
  assert.match(S.laterNotes(more.later, "/work/shop", d + "/q/report.sql", shown), /Use lowercase SQL\./);
  assert.match(S.laterNotes(more.later, "/work/shop", d + "/api/x.json", shown), /never edit it/);
  assert.equal(S.laterNotes(more.later, "/work/shop", d + "/api/y.json", shown), "", "once");
  // A short path is the project's, never a working folder's.
  assert.equal(S.laterNotes(more.later, "/work/shop", "q/report.sql", new Set()), "");
  // The budget: what the project's instructions left.
  const full = await S.extraInstructions([d], [{ name: "CODER.md", text: "x".repeat(S.NOTES_MAX) }]);
  assert.match(full.notes[0].text, /^\[Not loaded here: the instructions already come to 100,000 characters\. Read .*\/CODER\.md with the read tool\.\]$/);
  // The machine reads them only with the variable on.
  const server = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(server, /if \(addDirs\.length && varOn\(rawVars\.CODER_ADDITIONAL_DIRECTORIES_CODER_MD\)\) \{\n\s+const more = await extraInstructions\(addDirs, notes\);/);
  assert.match(server, /const context = contextFor\(notes, typeof body\.memory === "string" \? body\.memory : "", later\);/);
});

test("CD392 the repository's own .claude/settings.json and .claude/settings.local.json (Claude Code's project settings and workspace trust): deny and ask rules always; allow rules and working folders only once the owner trusts the repository, with Claude Code's warning until then; its env for the commands, minus what a repository shouldn't set; its read and write blocks; never through a link, never from GitHub", async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, readFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const S = await import("../container/server.mjs");
  const d = mkdtempSync(join(tmpdir(), "coder-p6rs-"));
  mkdirSync(join(d, ".claude"));
  writeFileSync(join(d, ".claude", "settings.json"), JSON.stringify({
    permissions: { deny: ["Bash(rm -rf *)", "not a rule ("], ask: ["Bash(git push *)"], allow: ["Bash(npm test *)"], additionalDirectories: ["../shared"], blockWritesOutsideWorkingDirectories: true },
    env: { FOO: "1", N: 3, HOME: "/x", https_proxy: "http://elsewhere", CODER_SHELL: "zsh", TMPDIR: "/x", NODE_EXTRA_CA_CERTS: "/x", "BAD-NAME": "1", OBJ: { a: 1 } },
  }));
  writeFileSync(join(d, ".claude", "settings.local.json"), JSON.stringify({ env: { FOO: "2" }, permissions: { allow: ["Bash(ls *)"] } }));
  // Not trusted: deny and ask apply; allow and the working folder wait, with Claude Code's warning, one per file and kind.
  let s = S.repoSettings(d);
  assert.deepEqual([s.deny, s.ask, s.allow, s.dirs], [["Bash(rm -rf *)"], ["Bash(git push *)"], [], []]);
  assert.deepEqual(s.held.map(S.heldNote), [
    "Ignoring 1 permissions.allow entry from .claude/settings.json: this repository has not been trusted. Turn on \"Trust this repository's settings\" in its permission rules to use them.",
    "Ignoring 1 additionalDirectories entry from .claude/settings.json: this repository has not been trusted. Turn on \"Trust this repository's settings\" in its permission rules to use them.",
    "Ignoring 1 permissions.allow entry from .claude/settings.local.json: this repository has not been trusted. Turn on \"Trust this repository's settings\" in its permission rules to use them.",
  ]);
  // env: settings.local.json over settings.json; numbers as text; what a repository shouldn't set left out.
  assert.deepEqual(s.env, { FOO: "2", N: "3" });
  assert.deepEqual([s.blockReads, s.blockWrites, s.autoOff], [false, true, false]);
  // Trusted: all of it.
  s = S.repoSettings(d, { trust: true });
  assert.deepEqual([s.allow, s.dirs, s.held], [["Bash(npm test *)", "Bash(ls *)"], ["../shared"], []]);
  // From GitHub: nothing.
  s = S.repoSettings(d, { trust: true, github: true });
  assert.deepEqual([s.deny, s.allow, s.env, s.held], [[], [], {}, []]);
  // .claude as a link out of the project: not read.
  const out = mkdtempSync(join(tmpdir(), "coder-p6ro-"));
  writeFileSync(join(out, "settings.json"), JSON.stringify({ permissions: { allow: ["Bash"] }, env: { X: "1" } }));
  const d2 = mkdtempSync(join(tmpdir(), "coder-p6rl-"));
  symlinkSync(out, join(d2, ".claude"));
  s = S.repoSettings(d2, { trust: true });
  assert.deepEqual([s.allow, s.env], [[], {}]);
  // The owner's rules first, the repository's after.
  assert.deepEqual(S.withRepoRules({ allow: ["Bash(make *)"], ask: [], deny: [], dirs: ["~/x"] }, { allow: ["Bash(ls *)"], ask: ["Bash(git push *)"], deny: ["Bash(rm *)"] }), { allow: ["Bash(make *)", "Bash(ls *)"], ask: ["Bash(git push *)"], deny: ["Bash(rm *)"], dirs: ["~/x"] });
  assert.equal(S.withRepoRules(null, { allow: [], ask: [], deny: [] }), null);
  // The machine: the env under the owner's variables, the rules, the working folders (those only the repository adds kept apart
  // for the write block), the blocks; the trust switch from the owner's rules.
  const server = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(server, /const repoSet = repoSettings\(dir, \{ trust: !!\(body\.rules && body\.rules\.trust === true\), github: body\.github === true \}\);\n\s+for \(const h of repoSet\.held\) t\.events\.push\(\{ at: Date\.now\(\), type: "note", text: heldNote\(h\) \}\);/);
  assert.match(server, /const extraEnv = \{ GIT_EDITOR: "true", \.\.\.repoSet\.env, \.\.\.ownerVars, /);
  assert.match(server, /rules: withRepoRules\(body\.rules, repoSet\), /);
  assert.match(server, /readBlock: varOn\(rawVars\.CODER_BLOCK_READS_OUTSIDE_WORKING_DIRECTORIES\) \|\| repoSet\.blockReads, writeBlock: varOn\(rawVars\.CODER_BLOCK_WRITES_OUTSIDE_WORKING_DIRECTORIES\) \|\| repoSet\.blockWrites, /);
  assert.match(server, /repoDirs: repoOnlyDirs,/);
  // The Worker keeps the trust switch with the repository's rules.
  const R = await import("../src/coder-routes.mjs");
  const m = new Map();
  const bucket = { async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, String(v)); } };
  assert.equal("trust" in (await R.rulesOf(bucket, "u1", "ana/shop")), false);
  assert.equal((await R.setTrust(bucket, "u1", "ana/shop", true)).trust, true);
  assert.equal((await R.rulesOf(bucket, "u1", "ana/shop")).trust, true);
  await R.changeRules(bucket, "u1", "ana/shop", "allow", ["Bash(ls *)"]);
  assert.equal((await R.rulesOf(bucket, "u1", "ana/shop")).trust, true, "kept when a rule changes");
  assert.equal("trust" in (await R.setTrust(bucket, "u1", "ana/shop", false)), false);
  assert.match(readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8"), /if \(kind === "trust"\) \{\n\s+if \(typeof body\.on !== "boolean"\) return json\(\{ error: "Trust is on or off\." \}, 400\);/);
  // The page: the switch in the rules dialog.
  assert.match(readFileSync(new URL("../public/coder.js", import.meta.url), "utf8"), /trustBox\.onchange = async \(\) => \{ await change\(\{ kind: 'trust', on: trustBox\.checked \}\); paint\(\); \};/);
});

// (The Worker on a pretend bucket and machine, as in permissions.test.mjs.)
function fakeBucket() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}
async function worker({ status = "idle", result = null, events = [] } = {}) {
  const R = await import("../src/coder-routes.mjs");
  const { saveConnection } = await import("../src/coder-github.mjs");
  const uid = "user-1234567890abcdef", id = "shop-pm2";
  const bucket = fakeBucket();
  const env = { CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://coder.gofarther.dev", CODER_BUCKET: bucket };
  await saveConnection(env, bucket, uid, { access: "ghu_user" }, "ana");
  const mk = "coder/" + uid + "/" + id + "/meta.json";
  await bucket.put(mk, JSON.stringify({ id, repo: "ana/shop", base: "main", branch: "coder/" + id, turn: 1, saved: 0, status, at: Date.now(), title: "x", mode: "acceptEdits" }));
  const toMachine = [];
  let claimed = false;
  const box = () => ({ fetch: async (req) => {
    const p = new URL(req.url).pathname;
    if (req.method === "POST") toMachine.push({ p, body: await req.clone().json().catch(() => null) });
    if (p === "/mode") return Response.json({ ok: true });
    if (p === "/answer") { const b = await req.json(); return Response.json(b.pid === "p1abcdef" ? { ok: true } : { ok: false, why: "That card is no longer waiting for an answer." }); }
    if (p === "/state") return Response.json(!result ? { running: status === "running", events: [] } : { running: false, events, next: events.length, result });
    if (p === "/claim") { const first = !claimed; claimed = true; return Response.json({ ok: first }); }
    if (p === "/push") return Response.json({ ok: true, pushed: false });
    if (p === "/turn") return Response.json({ ok: true });
    return Response.json({ ok: true });
  } });
  const go = async (path, init = {}) => { const r = await R.handleCoder(new Request("https://gofarther.dev/api/coder/" + path, { ...init, headers: { "content-type": "application/json" } }), env, {}, { fetchFn: async () => new Response("{}", { status: 404 }), authUser: async () => ({ id: uid, email: "me@x.y" }), container: box }); return { status: r.status, data: await r.json() }; };
  return { R, bucket, uid, id, mk, go, toMachine, meta: () => JSON.parse(bucket.m.get(mk)) };
}

test("CD393 Auto mode turned off (Claude Code's disableAutoMode \"disable\": \"Any session that would otherwise start in auto mode … starts in default instead\"): from Settings, chats start in Accept edits (Coder's nearest to the default mode); Auto is not offered in the menu, the cards or the plan's approval; the machine keeps any way into Auto out; a repository's own settings can turn it off too", async () => {
  const w = await worker();
  const R = w.R;
  // Settings: kept, checked, sent to the machine.
  assert.deepEqual([R.prefsOf({ autoOff: true }).autoOff, R.prefsOf({}).autoOff], [true, false]);
  assert.equal(R.prefsChange({}, { autoOff: "yes" }).error, "Turning Auto mode off is on or off.");
  assert.equal(R.prefsChange({}, { autoOff: true }).prefs.autoOff, true);
  assert.deepEqual([R.machinePrefs({ autoOff: true }).autoOff, R.machinePrefs({}).autoOff], [true, undefined]);
  assert.deepEqual([R.noAuto("auto", { autoOff: true }), R.noAuto("auto", {}), R.noAuto("plan", { autoOff: true })], ["acceptEdits", "auto", "plan"]);
  let x = await w.go("settings", { method: "POST", body: JSON.stringify({ prefs: { autoOff: true } }) });
  assert.equal(x.data.prefs.autoOff, true);
  x = await w.go("settings");
  assert.equal(x.data.pick.mode, "acceptEdits", "new chats start in Accept edits");
  // The mode menu can't pick Auto; Accept edits and Plan still can.
  x = await w.go("projects/" + w.id + "/mode", { method: "POST", body: JSON.stringify({ mode: "auto" }) });
  assert.deepEqual([x.status, x.data.error], [400, "Auto mode is turned off in Settings."]);
  assert.equal((await w.go("projects/" + w.id + "/mode", { method: "POST", body: JSON.stringify({ mode: "plan" }) })).status, 200);
  // A chat saved in Auto goes to the machine in Accept edits, with Settings' word, and a plan's way out is Accept edits.
  w.bucket.m.set(w.mk, JSON.stringify({ ...w.meta(), mode: "auto" }));
  await w.go("projects/" + w.id + "/message", { method: "POST", body: JSON.stringify({ text: "run the tests" }) });
  const turn = w.toMachine.find((t) => t.p === "/turn").body;
  assert.deepEqual([turn.mode, turn.prePlanMode, turn.prefs.autoOff], ["acceptEdits", "acceptEdits", true]);

  // THE MACHINE: a chat in Auto works in Accept edits, said and saved like a card's switch; no card offers Auto; a plan
  // approved with "auto" goes to Accept edits.
  let t = await job([say("", [call("bash", { command: "npm test", description: "Test" }, "b1")]), say("ok")], { mode: "auto", extra: { autoOff: true } });
  assert.deepEqual(t.events.filter((e) => e.type === "mode").map((e) => [e.mode, e.by]), [["acceptEdits", "autoOff"]]);
  assert.ok(t.events.some((e) => e.type === "note" && e.text === "Auto mode is turned off, so this chat works in Accept edits."));
  assert.match(t.seen[0].messages[0].content, /PERMISSION MODE: Accept edits/);
  assert.equal(t.cards.length, 1, "npm test asks in Accept edits");
  assert.equal(t.cards[0].toAuto, undefined, "no switch to Auto offered");
  t = await job([say("", [call("exit_plan_mode", { plan: "1. Fix it" }, "p1")]), say("ok")], { mode: "plan", extra: { autoOff: true }, answers: [{ choice: "auto" }] });
  assert.deepEqual(t.events.filter((e) => e.type === "mode").map((e) => e.mode), ["acceptEdits"]);
  // Off: as before.
  t = await job([say("", [call("bash", { command: "npm test", description: "Test" }, "b1")]), say("ok")], { mode: "acceptEdits" });
  assert.equal(t.cards[0].toAuto, true);
  // The machine takes it from Settings or from the repository's own settings (repoSettings' autoOff).
  const { readFileSync } = await import("node:fs");
  const server = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  const S = await import("../container/server.mjs");
  assert.deepEqual([S.prefsIn({ autoOff: true }).autoOff, S.prefsIn({}).autoOff], [true, false]);
  assert.match(server, /autoOff: PREFS\.autoOff === true \|\| repoSet\.autoOff, /);
  // The page: Auto left out of the menu, the cards and the plan's approval; the switch in Settings.
  const page = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  assert.match(page, /const modeList = \(\) => MODE_LIST\.filter\(\(x\) => !\(S\.autoOff && x\.id === 'auto'\)\);/);
  assert.match(page, /if \(e\.toAuto && !S\.autoOff\) o\.push\(\['auto', 'Yes, and switch to auto mode'\]\);/);
  assert.match(page, /\$\('cdSetAutoOff'\)\.onchange = \(e\) => save\('autoOff', e\.currentTarget\.checked\);/);
});

test("CD394 an environment's blocked sites (Claude Code's sandbox.network.deniedDomains: \"always blocked, even if matched by allowedDomains\", \"refused in every permission mode\"): never reached in any network setting, Full included and with a saved key; Full with blocked sites goes through the gate; the gate refuses them in Coder's words; kept and edited in Environment", async () => {
  const N = await import("../container/coder-secrets.mjs");
  // Kept, checked; none: the setting as it was (its setup copy too).
  assert.deepEqual(N.normNetwork({ mode: "full", denied: ["Tracker.example.com", "*.ads.example", "bad host!", "tracker.example.com"] }).denied, ["tracker.example.com", "*.ads.example"]);
  assert.equal("denied" in N.normNetwork({ mode: "full" }), false);
  // Refused in every setting, a keyed site too; the rest as before.
  const full = { mode: "full", denied: ["tracker.example.com", "*.ads.example"] };
  assert.deepEqual([N.hostAllowed("tracker.example.com", full), N.hostAllowed("x.ads.example", full), N.hostAllowed("example.org", full)], [false, false, true]);
  assert.equal(N.hostAllowed("tracker.example.com", full, ["tracker.example.com"]), false, "a saved key doesn't open a blocked site");
  assert.equal(N.hostAllowed("registry.npmjs.org", { mode: "trusted", denied: ["registry.npmjs.org"] }), false);
  assert.deepEqual([N.netWalled({ mode: "full" }), N.netWalled(full), N.netWalled({ mode: "trusted" })], [false, true, true]);
  // The gate: a blocked site refused at once, in Coder's words; any other site in Full not refused by the list.
  const { mkdtemp } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const net = await import("node:net");
  const { startProxy, DENIED } = await import("../container/coder-proxy.mjs");
  const px = await startProxy({ dir: join(await mkdtemp(join(tmpdir(), "coder-p6px-")), "px") });
  try {
    px.setNetwork(full);
    const ask = (text) => new Promise((ok) => { let b = ""; const s = net.connect(px.port, "127.0.0.1", () => s.write(text)); const done = () => { clearTimeout(tm); s.destroy(); ok(b); }; const tm = setTimeout(done, 4000); s.on("data", (x) => { b += x; if (/\r\n\r\n/.test(b) && /^HTTP\/1\.1 (200|403)/.test(b) && (/^HTTP\/1\.1 200/.test(b) || b.includes("is on this environment"))) done(); }); s.on("close", done); s.on("error", done); });
    const c = await ask("CONNECT tracker.example.com:443 HTTP/1.1\r\nHost: tracker.example.com:443\r\n\r\n");
    assert.match(c, /^HTTP\/1\.1 403 Forbidden\r\nX-Coder-Blocked: tracker\.example\.com\r\n/);
    assert.ok(c.endsWith(DENIED("tracker.example.com")));
    assert.equal(DENIED("tracker.example.com"), "Blocked: tracker.example.com is on this environment's blocked sites (Claude Code's sandbox.network.deniedDomains), refused whatever the network setting allows. Don't retry it; only the owner can change that list.");
    const h = await ask("GET http://x.ads.example/a HTTP/1.1\r\nHost: x.ads.example\r\n\r\n");
    assert.match(h, /^HTTP\/1\.1 403 /);
    assert.ok(h.includes("x.ads.example is on this environment's blocked sites"));
    assert.deepEqual(px.blockedSince(0).map((b) => [b.host, b.why]), [["tracker.example.com", "on the blocked sites list"], ["x.ads.example", "on the blocked sites list"]]);
  } finally { await px.close(); }
  // The machine: Full with blocked sites is walled like a limited setting, and Coder is told which.
  const { readFileSync } = await import("node:fs");
  const server = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.equal((server.match(/const net = \{ \.\.\.nn, limited: netWalled\(nn\) \};/g) || []).length, 2);
  assert.match(server, /NETWORK: FULL, but for the environment's blocked sites: /);
  // The Worker keeps the list (checked); the page edits it under Network access.
  const routes = readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8");
  assert.match(routes, /if \(denied\.length > 100\) return json\(\{ error: "at most 100 blocked sites" \}, 400\);/);
  const page = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  assert.match(page, /network: \{ mode: f\.mode, hosts: f\.hosts, defaults: f\.defaults, denied: f\.denied \|\| \[\] \}/);
  assert.match(page, /<label class="cd-em-l">Blocked sites<\/label>/);
});

test("CD395 the subprocess environment scrub and the script caps (Claude Code's CLAUDE_CODE_SUBPROCESS_ENV_SCRUB and CLAUDE_CODE_SCRIPT_CAPS, here CODER_SUBPROCESS_ENV_SCRUB and CODER_SCRIPT_CAPS): credentials by name or value leave the commands' variables, GitHub tokens and the proxy stay, an index address loses its password; a capped script runs only so many times a chat, in Claude Code's words", async () => {
  const X = await import("../container/coder-scrub.mjs");
  // Names, by Claude Code's own pattern.
  for (const n of ["NPM_TOKEN", "DB_PASSWORD", "AWS_SECRET_ACCESS_KEY", "MY_API_KEY", "SLACK_WEBHOOK", "SENTRY_DSN", "API_KEYS", "MYTOKEN", "DB_PASS", "DATABASE_CONNECTION_STRING", "mongoConnString", "INPUT_NPM_TOKEN"]) assert.equal(X.credentialName(n), true, n);
  for (const n of ["GITHUB_TOKEN", "GH_TOKEN", "GH_ENTERPRISE_TOKEN", "HTTPS_PROXY", "no_proxy", "GIT_CONFIG_KEY_0", "GIT_CONFIG_COUNT", "PWD", "OLDPWD", "PATH", "KEYBOARD_LAYOUT", "AUTHOR", "NODE_ENV", "PATCH_LEVEL"]) assert.equal(X.credentialName(n), false, n);
  // Values, by their shape.
  for (const v of ["postgres://app:hunter2@db:5432/shop", "https://ghp_abcdefghijklmnopqrstuv@github.com/x", "app:hunter2@db.internal", "-----BEGIN RSA PRIVATE KEY-----\nMII", "Authorization: Bearer abcdef123456", "Bearer abc123def456", "sk-abcdefghijklmnopqrstu"]) assert.equal(X.credentialValue(v), true, v);
  for (const v of ["https://example.com/a", "hello world", "node:20@sha256:" + "a".repeat(64), "C:\\tools", "mailto:x@y.z", "npm:left-pad@1.3.0", "production"]) assert.equal(X.credentialValue(v), false, v);
  // A set of variables, in place: the names removed are answered, never the values.
  const vars = { NPM_TOKEN: "x", DATABASE_URL: "postgres://app:hunter2@db/shop", PIP_INDEX_URL: "https://me:pw@pypi.corp.example/simple", GITHUB_TOKEN: "ghp_abcdefghijklmnopqrstuv", HTTPS_PROXY: "http://u:p@proxy:3128", NODE_ENV: "test" };
  assert.deepEqual(X.scrubVars(vars), ["NPM_TOKEN", "DATABASE_URL"]);
  assert.deepEqual(vars, { PIP_INDEX_URL: "https://pypi.corp.example/simple", GITHUB_TOKEN: "ghp_abcdefghijklmnopqrstuv", HTTPS_PROXY: "http://u:p@proxy:3128", NODE_ENV: "test" });
  // The caps, as Claude Code reads them and counts.
  assert.deepEqual(X.scriptCapsIn('{"deploy.sh": 2, "x": "3", " ": 1}'), { "deploy.sh": 2 });
  assert.deepEqual([X.scriptCapsIn("nope"), X.scriptCapsIn("[]"), X.scriptCapsIn("")], [null, null, null]);
  const counts = {};
  assert.deepEqual([X.capHit("./scripts/deploy.sh", { "deploy.sh": 2 }, counts), X.capHit("./scripts/deploy.sh $(evil)", { "deploy.sh": 2 }, counts)], ["", ""]);
  assert.equal(X.capHit("./scripts/deploy.sh && ./scripts/deploy.sh", { "deploy.sh": 2 }, counts), "Script call limit exceeded: deploy.sh has been called 4 times (cap: 2). This limit prevents data exfiltration via repeated write operations in untrusted-input workflows.");
  assert.equal(counts["deploy.sh"], 4, "counted even when refused");
  assert.equal(X.capHit("ls", { "deploy.sh": 2 }, counts), "");
  // In the loop: the third deploy is not run.
  const saved = [];
  const caps = { caps: { "deploy.sh": 2 }, counts: {}, save: (c) => saved.push({ ...c }) };
  const t = await job([say("", [call("bash", { command: "./deploy.sh", description: "Deploy" }, "b1"), call("bash", { command: "./deploy.sh", description: "Deploy" }, "b2"), call("bash", { command: "./deploy.sh", description: "Deploy" }, "b3")]), say("ok")], { deps: { scriptCaps: caps }, mode: "auto", extra: {} });
  assert.deepEqual(t.ran.map((c) => c.split("\n").pop()), ["./deploy.sh", "./deploy.sh"]);
  assert.match(t.told("b3"), /^Script call limit exceeded: deploy\.sh has been called 3 times \(cap: 2\)\./);
  assert.deepEqual(saved.at(-1), { "deploy.sh": 3 }, "kept for the chat's next messages");
  // The machine: the scrub on the owner's and the repository's variables (on by default from GitHub), the caps only with it.
  const { readFileSync } = await import("node:fs");
  const server = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(server, /const scrubOn = varOn\(varsGiven\.CODER_SUBPROCESS_ENV_SCRUB\) \|\| \(body\.github === true && !varOff\(varsGiven\.CODER_SUBPROCESS_ENV_SCRUB\)\);\n\s+if \(scrubOn\) \{ scrubVars\(repoSet\.env\); scrubVars\(ownerVars\); \}/);
  assert.match(server, /const capsGiven = scrubOn \? scriptCapsIn\(/);
  assert.doesNotMatch(readFileSync(new URL("../container/coder-scrub.mjs", import.meta.url), "utf8"), /from "node:/);
});

test("CD396 a command's own hosts in Auto mode (Claude Code's allowed_domains): checked in its words; reviewed by the checker with the command, even one an allow rule or a hook would approve; listed on a card a rule asks with; opened by the gate for that command alone while it runs; refused where nothing can be added; ignored in other modes", async () => {
  const N = await import("../container/coder-secrets.mjs");
  // The entries, as Claude Code checks them.
  assert.equal(N.listProblem(["registry.npmjs.org", "*.pythonhosted.org", "10.0.0.5:8080", "[2001:db8::1]:443"]), "");
  assert.equal(N.listProblem(["a b"]), '"a b": ' + N.LIST_FORMAT);
  assert.equal(N.listProblem(["0.0.0.0"]), '"0.0.0.0": ' + N.LIST_LOOPBACK);
  assert.equal(N.listProblem(["[::ffff:127.0.0.1]"]), '"[::ffff:127.0.0.1]": ' + N.LIST_LOOPBACK);
  assert.equal(N.listProblem(["Example.com"]), '"Example.com": ' + N.LIST_SPELLING);
  assert.equal(N.listProblem(Array.from({ length: 101 }, (_, i) => "h" + i + ".example")), "allowed_domains has at most 100 entries");
  const list = ["registry.npmjs.org", "*.pythonhosted.org", "api.example.com:8443"];
  assert.deepEqual([N.listCovers(list, "registry.npmjs.org", 443), N.listCovers(list, "files.pythonhosted.org", 443), N.listCovers(list, "api.example.com", 8443), N.listCovers(list, "api.example.com", 443), N.listCovers(list, "example.org", 443)], [true, true, true, false, false]);

  // THE GATE: a listed host opens only for requests carrying that command's pass, until it is closed; blocked sites stay blocked.
  const { mkdtemp } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const net = await import("node:net");
  const { startProxy, UNLISTED, DENIED, passOf } = await import("../container/coder-proxy.mjs");
  const px = await startProxy({ dir: join(await mkdtemp(join(tmpdir(), "coder-p6hl-")), "px") });
  try {
    px.setNetwork({ mode: "custom", hosts: ["github.com"], defaults: false, denied: ["evil.example"] });
    const pass = "a".repeat(32);
    px.openFor(pass, ["registry.npmjs.org", "evil.example"]);
    assert.match(px.env(pass).HTTPS_PROXY, new RegExp("^http://cmd:" + pass + "@127\\.0\\.0\\.1:\\d+$"));
    assert.doesNotMatch(px.env().HTTPS_PROXY, /cmd:/);
    const auth = (p) => "Proxy-Authorization: Basic " + Buffer.from("cmd:" + p).toString("base64") + "\r\n";
    assert.equal(passOf({ "proxy-authorization": "Basic " + Buffer.from("cmd:" + pass).toString("base64") }), pass);
    const ask = (text) => new Promise((ok) => { let b = ""; const s = net.connect(px.port, "127.0.0.1", () => s.write(text)); const done = () => { clearTimeout(tm); s.destroy(); ok(b); }; const tm = setTimeout(done, 3000); s.on("data", (x) => { b += x; if (/^HTTP\/1\.1 \d{3}/.test(b) && b.includes("\r\n\r\n")) setTimeout(done, 50); }); s.on("close", done); s.on("error", done); });
    const before = px.blockedSince(0).length;
    // With the pass: the listed host is not refused by the list.
    const ok = await ask("CONNECT registry.npmjs.org:443 HTTP/1.1\r\nHost: registry.npmjs.org:443\r\n" + auth(pass) + "\r\n");
    assert.doesNotMatch(ok, /^HTTP\/1\.1 403/);
    assert.equal(px.blockedSince(0).length, before, "not blocked");
    // With the pass, a host it doesn't list: told so, in Claude Code's words.
    const un = await ask("CONNECT example.org:443 HTTP/1.1\r\nHost: example.org:443\r\n" + auth(pass) + "\r\n");
    assert.match(un, /^HTTP\/1\.1 403/);
    assert.ok(un.endsWith(UNLISTED("example.org")));
    assert.equal(UNLISTED("example.org"), "Blocked: example.org is not in this command's allowed_domains — re-run the command with this host listed if it needs it.");
    // A blocked site stays blocked, listed or not.
    assert.ok((await ask("CONNECT evil.example:443 HTTP/1.1\r\nHost: evil.example:443\r\n" + auth(pass) + "\r\n")).endsWith(DENIED("evil.example")));
    // Without a pass, or after the command ended: the network list's refusal.
    assert.match(await ask("CONNECT registry.npmjs.org:443 HTTP/1.1\r\nHost: registry.npmjs.org:443\r\n\r\n"), /Blocked by this repo's network list: registry\.npmjs\.org/);
    px.closeFor(pass);
    assert.equal(px.openLists(), 0);
    assert.match(await ask("CONNECT registry.npmjs.org:443 HTTP/1.1\r\nHost: registry.npmjs.org:443\r\n" + auth(pass) + "\r\n"), /Blocked by this repo's network list: registry\.npmjs\.org/);
  } finally { await px.close(); }

  // CODER'S LOOP.
  const A = await import("../container/coder-agent.mjs");
  const hostsOf = (t, cmd) => (t.execs.find((x) => String(x.command).split("\n").pop() === cmd) || {}).hosts;
  const npm = (extra = {}) => say("", [call("bash", { command: "npm install left-pad", description: "Install", allowed_domains: ["registry.npmjs.org"], ...extra }, "b1")]);
  // Offered on bash and monitor where the gate can open hosts; not elsewhere.
  let t = await job([say("ok")], { extra: { hostLists: "on" } });
  const tool = (n) => t.seen[0].tools.find((x) => x.function.name === n).function.parameters.properties;
  assert.equal(tool("bash").allowed_domains.description, A.HOSTS_DESC);
  assert.ok(tool("monitor").allowed_domains);
  t = await job([say("ok")], { extra: { hostLists: null } });
  assert.equal(t.seen[0].tools.find((x) => x.function.name === "bash").function.parameters.properties.allowed_domains, undefined);
  // Auto: the checker sees the hosts with the command; approved, the command runs with them.
  t = await job([npm(), say("ok")], { extra: { hostLists: "on" }, checker: true });
  assert.equal(t.checks.length, 1);
  assert.match(t.checks[0].messages[1].content, /\(allowed_domains: the hosts this command asks to reach beyond the chat's network list, for this command alone: registry\.npmjs\.org\)/);
  assert.deepEqual(hostsOf(t, "npm install left-pad"), ["registry.npmjs.org"]);
  // A read-only command, and one an allow rule covers, are still reviewed for their hosts.
  t = await job([say("", [call("bash", { command: "curl -sI https://registry.npmjs.org/", description: "Check", allowed_domains: ["registry.npmjs.org"] }, "b1")]), say("ok")], { extra: { hostLists: "on" }, checker: true, rules: { allow: ["Bash(curl *)"], ask: [], deny: [] } });
  assert.equal(t.checks.length, 1, "allow rules approve the command, not the hosts");
  // Blocked by the checker: not run.
  t = await job([npm(), say("ok")], { extra: { hostLists: "on" }, checker: true, verdict: () => '{"decision":"block","rule":"Untrusted host","reason":"not needed"}' });
  assert.deepEqual(t.ran, []);
  // An ask rule: the card lists them; approving runs with them.
  t = await job([npm(), say("ok")], { extra: { hostLists: "on" }, checker: true, rules: { allow: [], ask: ["Bash(npm install *)"], deny: [] } });
  assert.deepEqual(t.cards[0].hosts, ["registry.npmjs.org"]);
  assert.deepEqual(hostsOf(t, "npm install left-pad"), ["registry.npmjs.org"]);
  // No checker to review them: run without them, and told so.
  t = await job([npm(), say("ok")], { extra: { hostLists: "on" }, checker: false });
  assert.equal(hostsOf(t, "npm install left-pad"), undefined);
  assert.ok(t.told("b1").endsWith(A.HOSTS_UNCHECKED));
  // Another mode: ignored.
  t = await job([npm(), say("ok")], { mode: "acceptEdits", extra: { hostLists: "on" }, checker: true, answers: [{ choice: "yes" }] });
  assert.equal(hostsOf(t, "npm install left-pad"), undefined);
  assert.equal(t.cards[0].hosts, undefined);
  // Nothing can be added (None), nothing can enforce them, or a bad entry: refused, in Claude Code's words.
  t = await job([npm(), say("ok")], { extra: { hostLists: "none" }, checker: true });
  assert.deepEqual([t.ran.length, t.told("b1")], [0, A.HOSTS_LOCKED]);
  t = await job([npm(), say("ok")], { extra: { hostLists: "off" }, checker: true });
  assert.equal(t.told("b1"), A.HOSTS_UNWALLED);
  t = await job([npm({ allowed_domains: ["Registry.npmjs.org"] }), say("ok")], { extra: { hostLists: "on" }, checker: true });
  assert.equal(t.told("b1"), 'error: "Registry.npmjs.org": ' + N.LIST_SPELLING);
  // A WebSocket watch takes none.
  t = await job([say("", [call("monitor", { description: "Feed", ws: { url: "wss://feed.example.com/x" }, allowed_domains: ["feed.example.com"] }, "m1")]), say("ok")], { extra: { hostLists: "on" }, checker: true });
  assert.equal(t.told("m1"), "error: " + A.HOSTS_ONLY_COMMAND);
  // The machine: the gate's pass for the command, closed when it ends (a background one with its job); Coder told in Auto.
  const { readFileSync } = await import("node:fs");
  const server = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(server, /hostLists: nn\.mode === "full" \? null : nn\.mode === "none" \? "none" : walled \? "on" : "off", /);
  assert.match(server, /const pass = !tool && Array\.isArray\(hosts\) && hosts\.length && px \? randomBytes\(16\)\.toString\("hex"\) : "";\n\s+if \(pass\) px\.openFor\(pass, hosts\);/);
  assert.match(server, /\.\.\.\(pass \? px\.env\(pass\) : \{\}\), \[TASK_MARK\]: mark/);
  assert.match(server, /if \(pass && !\(r && r\.background && r\.pid\)\) px\.closeFor\(pass\);/);
  assert.match(server, /if \(typeof j\.closePass === "function"\) \{ try \{ j\.closePass\(\); \}/);
  assert.match(server, /In Auto mode, a command can name the hosts it needs beyond this list in its allowed_domains/);
});

test("CD397 the PowerShell tool (Claude Code's, opt-in on Linux: CODER_USE_POWERSHELL_TOOL): its description, its rules (the shape of Bash's, aliases canonicalized, every part must be allowed), read-only cmdlets, its Start-Sleep check, how it runs (pwsh, no profile, non-interactive, execution policy bypassed unless CODER_POWERSHELL_RESPECT_EXECUTION_POLICY, its folder kept), the owner's ! commands in it (CODER_DEFAULT_SHELL), and hooks with shell: powershell", async () => {
  const PS = await import("../container/coder-ps.mjs");
  const P = await import("../container/coder-perms.mjs");
  // Parts and aliases.
  assert.deepEqual(PS.psParts("Get-ChildItem | Select-Object -First 5; git status && npm test || echo 'a;b|c'"), ["Get-ChildItem", "Select-Object -First 5", "git status", "npm test", "echo 'a;b|c'"]);
  assert.deepEqual(PS.psParts("Get-ChildItem | ForEach-Object { Remove-Item $_; Write-Host x }"), ["Get-ChildItem", "ForEach-Object { Remove-Item $_; Write-Host x }"]);
  assert.deepEqual([PS.psCanon("gci"), PS.psCanon("LS"), PS.psCanon("rm"), PS.psCanon("Get-Content")], ["get-childitem", "get-childitem", "remove-item", "get-content"]);
  // Read-only: reading cmdlets, programs Coder's bash check calls read-only; never a redirection, a script block or a sub-expression.
  const nro = (p) => /^git (status|log)\b/.test(p);
  assert.deepEqual([
    PS.psReadOnly("Get-ChildItem -Recurse | Select-Object -First 5"), PS.psReadOnly("gci; cat README.md"), PS.psReadOnly("git status", { nativeReadOnly: nro }),
    PS.psReadOnly("Remove-Item build"), PS.psReadOnly("Get-Content a > b"), PS.psReadOnly("Get-ChildItem | ForEach-Object { Remove-Item $_ }"), PS.psReadOnly("Write-Output $(Remove-Item x)"), PS.psReadOnly("git push", { nativeReadOnly: nro }), PS.psReadOnly("Invoke-Expression 'x'"),
  ], [true, true, true, false, false, false, false, false, false]);
  // Rules: case-insensitive, aliases as their cmdlets, a trailing " *" also the bare command.
  assert.deepEqual([PS.psRuleMatches("Get-ChildItem *", "gci -Recurse"), PS.psRuleMatches("get-childitem *", "dir"), PS.psRuleMatches("Remove-Item *", "rm -r build"), PS.psRuleMatches("git commit *", "git commit -m x"), PS.psRuleMatches("git commit *", "git push"), PS.psRuleMatches(null, "anything")], [true, true, true, true, false, true]);
  assert.deepEqual(P.parseRule("PowerShell(Get-ChildItem *)"), { tool: "PowerShell", spec: "Get-ChildItem *" });
  assert.deepEqual([P.parseRule("PowerShell"), P.parseRule("PowerShell(*)")], [{ tool: "PowerShell", spec: null }, { tool: "PowerShell", spec: null }]);
  // The decision.
  const dec = (cmd, mode, rules = {}) => P.psDecision(cmd, { mode, rules, nativeReadOnly: nro });
  assert.equal(dec("Get-ChildItem", "acceptEdits").verdict, "allow");
  assert.deepEqual([dec("Remove-Item build", "acceptEdits").verdict, dec("Remove-Item build", "acceptEdits").suggest], ["ask", ["PowerShell(Remove-Item *)"]]);
  assert.deepEqual(dec("git commit -m x; npm test", "plan").suggest, ["PowerShell(git commit *)", "PowerShell(npm test *)"]);
  assert.equal(dec("rm -r build", "auto", { deny: ["PowerShell(Remove-Item *)"] }).why, "Permission to use PowerShell with command rm -r build has been denied.");
  assert.equal(dec("Get-ChildItem", "auto", { deny: ["*"] }).verdict, "deny");
  assert.deepEqual([dec("npm test", "auto", { ask: ["PowerShell(npm *)"] }).verdict, dec("npm test", "auto", { ask: ["PowerShell(npm *)"] }).byRule], ["ask", true]);
  assert.equal(dec("npm test", "acceptEdits", { allow: ["PowerShell(npm test *)"] }).verdict, "allow");
  assert.equal(dec("npm test; Remove-Item x", "acceptEdits", { allow: ["PowerShell(npm test *)"] }).verdict, "ask", "every part must be allowed");
  assert.equal(dec("Remove-Item x", "auto").verdict, "allow", "Auto: the checker judges it");
  // Start-Sleep, in Claude Code's words.
  assert.deepEqual([PS.psSleepWhat("Start-Sleep 30"), PS.psSleepWhat("Start-Sleep -Seconds 40; git status"), PS.psSleepWhat("sleep 5")], ["standalone Start-Sleep 30", "Start-Sleep 40 followed by: git status", ""]);
  // How it runs.
  for (const t of ["hi", "Get-ChildItem | % { $_.Name }", "é ✓ 😀"]) assert.equal(PS.utf16Base64(t), Buffer.from(t, "utf16le").toString("base64"), t);
  const cmd = PS.psCommand("Set-Location src; Get-ChildItem");
  assert.match(cmd, /^export CODER_PS_CWD="\$\(mktemp 2>\/dev\/null \|\| echo \/tmp\/coder-ps-cwd-\$\$\)"; pwsh -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand [A-Za-z0-9+/=]+ <\/dev\/null; __coderPs=\$\?; /);
  assert.match(cmd, /if \[ -n "\$__coderTo" \] && \[ -d "\$__coderTo" \]; then cd "\$__coderTo"; fi; \(exit \$__coderPs\)$/);
  const script = Buffer.from(/-EncodedCommand ([A-Za-z0-9+/=]+)/.exec(cmd)[1], "base64").toString("utf16le");
  assert.equal(script, PS.psScript("Set-Location src; Get-ChildItem"));
  assert.deepEqual(script.split("\n").slice(0, 2), ["try { $PSStyle.OutputRendering = 'PlainText' } catch {}", "Set-Location src; Get-ChildItem"]);
  assert.match(script, /\(Get-Location\)\.ProviderPath \| Set-Content -NoNewline -LiteralPath \$env:CODER_PS_CWD/);
  assert.doesNotMatch(PS.psCommand("x", { bypass: false }), /ExecutionPolicy/, "CODER_POWERSHELL_RESPECT_EXECUTION_POLICY");
  // Its description: Claude Code's, with Coder's tool names and timeouts.
  const d = PS.psDescription({ defaultMs: 120000, maxMs: 600000, outMax: 30000 });
  assert.ok(d.startsWith("Executes a given PowerShell command with optional timeout. Working directory persists between commands; shell state (variables, functions) does not."));
  assert.match(d, /    - Content search: Use grep \(NOT Select-String\)\n/);
  assert.match(d, /up to 600000ms \/ 10 minutes for a foreground command\)\. If not specified, commands will timeout after 120000ms \(2 minutes\)/);
  assert.match(d, /Unix commands that DO NOT exist in PowerShell \u2014 use the equivalent instead:/);
  // Hooks: shell powershell runs in pwsh; another shell is named.
  const H = await import("../container/coder-hooks.mjs");
  const hs = H.hooksFrom({ hooks: { Stop: [{ hooks: [{ type: "command", command: "Write-Output 'done'", shell: "powershell" }, { type: "command", command: "x", shell: "fish" }] }] } });
  assert.equal(hs.list[0].shell, "powershell");
  assert.deepEqual(hs.problems, ["Stop: a hook's shell is bash or powershell (not fish)"]);
  assert.match(H.hookShell(hs.list[0], "<<m>>", "/work/shop"), new RegExp("\\(\\npwsh -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand " + PS.utf16Base64("Write-Output 'done'").replace(/[+/=]/g, "\\$&") + "\\n\\) < \"\\$__in\""));
  assert.equal(H.ccTool("powershell"), "PowerShell");

  // CODER'S LOOP.
  const on = { powershell: { bypass: true, defaultShell: false } };
  let t = await job([say("ok")], { extra: on });
  const names = t.seen[0].tools.map((x) => x.function.name);
  assert.equal(names[names.indexOf("bash") + 1], "powershell");
  const psTool = t.seen[0].tools.find((x) => x.function.name === "powershell").function;
  assert.equal(psTool.parameters.properties.command.description, "The PowerShell command to execute");
  assert.ok(psTool.description.startsWith("Executes a given PowerShell command"));
  t = await job([say("ok")], {});
  assert.ok(!t.seen[0].tools.some((x) => x.function.name === "powershell"), "off unless the environment turns it on");
  // A reading command in Accept edits: run in pwsh, shown as written, its step marked.
  t = await job([say("", [call("powershell", { command: "Get-ChildItem", description: "List" }, "p1")]), say("ok")], { mode: "acceptEdits", extra: on });
  const ex = t.execs.find((x) => x.shown === "Get-ChildItem");
  assert.ok(ex && /pwsh -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand /.test(ex.command));
  assert.ok(t.events.some((e) => e.type === "bash" && e.id === "p1" && e.shell === "powershell" && e.command === "Get-ChildItem"));
  // One that changes things: a PowerShell card; denied by a rule: refused.
  t = await job([say("", [call("powershell", { command: "Remove-Item build -Recurse", description: "Clean" }, "p1")]), say("ok")], { mode: "acceptEdits", extra: on, answers: [{ choice: "no" }] });
  assert.deepEqual([t.cards[0].tool, t.cards[0].rules], ["powershell", ["PowerShell(Remove-Item *)"]]);
  assert.deepEqual(t.ran, []);
  t = await job([say("", [call("powershell", { command: "rm build", description: "Clean" }, "p1")]), say("ok")], { extra: on, rules: { allow: [], ask: [], deny: ["PowerShell(Remove-Item *)"] } });
  assert.equal(t.told("p1"), "Permission to use PowerShell with command rm build has been denied.");
  // Auto: the checker judges what isn't read-only, as PowerShell.
  t = await job([say("", [call("powershell", { command: "Remove-Item build", description: "Clean" }, "p1")]), say("ok")], { extra: on, checker: true });
  assert.match(t.checks[0].messages[1].content, /THE ACTION TO JUDGE:\npowershell: Remove-Item build/);
  t = await job([say("", [call("powershell", { command: "Get-ChildItem", description: "List" }, "p1")]), say("ok")], { extra: on, checker: true });
  assert.equal(t.checks.length, 0, "read-only: no check");
  // Start-Sleep blocked in the foreground.
  t = await job([say("", [call("powershell", { command: "Start-Sleep 30", description: "Wait" }, "p1")]), say("ok")], { extra: on });
  assert.match(t.told("p1"), /^Blocked: standalone Start-Sleep 30\. To wait for a condition, run a loop in the background/);
  // Hooks see it as PowerShell.
  t = await job([say("", [call("powershell", { command: "Get-ChildItem", description: "List" }, "p1")]), say("ok")], { extra: on, hooks: { PreToolUse: [{ matcher: "PowerShell", hooks: [{ type: "command", command: "check.sh" }] }] } });
  assert.deepEqual([t.hookCalls[0].input.tool_name, t.hookCalls[0].input.tool_input.command], ["PowerShell", "Get-ChildItem"]);
  // The execution policy respected: no bypass.
  t = await job([say("", [call("powershell", { command: "Get-ChildItem", description: "List" }, "p1")]), say("ok")], { mode: "acceptEdits", extra: { powershell: { bypass: false } } });
  assert.doesNotMatch(t.execs.find((x) => x.shown === "Get-ChildItem").command, /ExecutionPolicy/);
  // The owner's ! command in PowerShell (CODER_DEFAULT_SHELL powershell).
  t = await job([say("ok")], { extra: { powershell: { bypass: true, defaultShell: true }, shell: "Get-Location" } });
  const own = t.execs.find((x) => x.shown === "Get-Location");
  assert.ok(own && /pwsh -NoProfile/.test(own.command));
  // The machine: on with the environment's variable and pwsh there; the image has pwsh.
  const { readFileSync } = await import("node:fs");
  const server = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(server, /const psOn = psWanted && PWSH_PATHS\.some\(\(p\) => existsSync\(p\)\);/);
  assert.match(server, /powershell: psOn \? \{ bypass: !varOn\(rawVars\.CODER_POWERSHELL_RESPECT_EXECUTION_POLICY\), defaultShell: String\(rawVars\.CODER_DEFAULT_SHELL \|\| ""\)\.trim\(\)\.toLowerCase\(\) === "powershell" \} : null, /);
  const docker = readFileSync(new URL("../container/Dockerfile", import.meta.url), "utf8");
  assert.match(docker, /apt-get install -y --no-install-recommends powershell; /);
  assert.match(docker, / coder-ps\.mjs /);
  assert.match(readFileSync(new URL("../public/coder.js", import.meta.url), "utf8"), /powershell: 'PowerShell command'/);
});

test("CD398 a hook answers Coder's question card (Claude Code's AskUserQuestion with a PreToolUse hook's \"allow\" and updatedInput: \"echo back the original questions array and add an answers object\"): no card, Coder goes on in the same turn, told in Claude Code's words; its allow alone, or an ask rule, still shows the card; a bad rewrite is refused in Claude Code's words", async () => {
  const Q = { question: "Which database?", header: "Database", options: [{ label: "Postgres", description: "A server" }, { label: "SQLite", description: "A file" }] };
  const X = { question: "Which extras?", header: "Extras", options: [{ label: "Auth", description: "Sign-in" }, { label: "Search, fast", description: "Full text" }, { label: "Logs", description: "Kept 30 days" }], multi_select: true };
  const ask = (args) => [say("", [call("ask_user", args, "q1")]), say("Done.")];
  const AQ = { PreToolUse: [{ matcher: "AskUserQuestion", hooks: [{ type: "command", command: "answer.sh" }] }] };
  const answer = (answers, more = {}) => (input) => ({ stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow", updatedInput: { questions: input.tool_input.questions, ...(answers === undefined ? {} : { answers }), ...more } } }) });
  const cardsOf = (t) => t.events.filter((e) => e.type === "question");
  const noteOf = (t) => (t.events.find((e) => e.type === "note" && e.hook === "PreToolUse") || {}).text;

  // Answered with one of the choices: no card, the turn goes on, Claude Code's words.
  let t = await job(ask({ questions: [Q] }), { hooks: AQ, hookRun: answer({ "Which database?": "Postgres" }) });
  assert.equal(cardsOf(t).length, 0, "no card");
  assert.equal(t.told("q1"), 'Your questions have been answered: "Which database?"="Postgres". You can now continue with these answers in mind.');
  assert.equal(noteOf(t), 'A PreToolUse hook answered Coder\'s question for you: "Which database?"="Postgres"');
  assert.equal(t.seen.length, 2, "Coder went on in the same turn");
  // The hook sees Claude Code's AskUserQuestion input (multiSelect beside Coder's multi_select).
  assert.equal(t.hookCalls[0].input.tool_name, "AskUserQuestion");
  assert.deepEqual(t.hookCalls[0].input.tool_input.questions, [{ ...Q, multiSelect: false }]);
  // An answer that is not one of the choices: Claude Code's other words.
  t = await job(ask({ questions: [Q] }), { hooks: AQ, hookRun: answer({ "Which database?": "Whichever is cheaper" }) });
  assert.equal(t.told("q1"), 'The user answered: "Which database?"="Whichever is cheaper". Read the answers carefully — they may request clarification, changes, or that you not proceed — and follow what they actually say.');
  // Several choices: a list is joined with ", "; a label with ", " in it is quoted, as Claude Code joins them.
  t = await job(ask({ questions: [Q, X] }), { hooks: AQ, hookRun: answer({ "Which database?": "SQLite", "Which extras?": ["Auth", "Logs"] }) });
  assert.deepEqual(t.hookCalls[0].input.tool_input.questions.map((q) => q.multiSelect), [false, true]);
  assert.equal(t.told("q1"), 'Your questions have been answered: "Which database?"="SQLite", "Which extras?"="Auth, Logs". You can now continue with these answers in mind.');
  assert.equal(noteOf(t), 'A PreToolUse hook answered Coder\'s questions for you: "Which database?"="SQLite", "Which extras?"="Auth, Logs"');
  t = await job(ask({ questions: [X] }), { hooks: AQ, hookRun: answer({ "Which extras?": 'Auth, "Search, fast"' }) });
  assert.match(t.told("q1"), /^Your questions have been answered: /);
  // Several choices for a one-choice question: not one of its choices.
  t = await job(ask({ questions: [Q] }), { hooks: AQ, hookRun: answer({ "Which database?": "Postgres, SQLite" }) });
  assert.match(t.told("q1"), /^The user answered: "Which database\?"="Postgres, SQLite"\. Read the answers carefully/);
  // The hook may turn on several choices with Claude Code's name (multiSelect).
  t = await job(ask({ questions: [Q] }), { hooks: AQ, hookRun: (input) => answer({ "Which database?": "Postgres, SQLite" })({ tool_input: { questions: input.tool_input.questions.map((q) => ({ ...q, multiSelect: true })) } }) });
  assert.match(t.told("q1"), /^Your questions have been answered: /);
  // One of two answered: only that one is told.
  t = await job(ask({ questions: [Q, X] }), { hooks: AQ, hookRun: answer({ "Which database?": "Postgres" }) });
  assert.equal(t.told("q1"), 'Your questions have been answered: "Which database?"="Postgres". You can now continue with these answers in mind.');
  // A note beside the answer (Claude Code's annotations): told, in its other words.
  t = await job(ask({ questions: [Q] }), { hooks: AQ, hookRun: answer({ "Which database?": "Postgres" }, { annotations: { "Which database?": { notes: "the team knows it" } } }) });
  assert.equal(t.told("q1"), 'The user answered: "Which database?"="Postgres" notes: the team knows it. Read the answers carefully — they may request clarification, changes, or that you not proceed — and follow what they actually say.');
  // New input with no answers: no card all the same, and Claude Code's words for it.
  t = await job(ask({ questions: [Q] }), { hooks: AQ, hookRun: answer(undefined) });
  assert.equal(cardsOf(t).length, 0);
  assert.equal(t.told("q1"), "The user did not answer the questions.");
  assert.equal(noteOf(t), "A PreToolUse hook took Coder's question and gave no answer, so you were not asked.");
  // The single question of before: the hook sees a list of one, and answers it.
  t = await job(ask({ question: "Which database?", options: ["Postgres", "SQLite"] }), { hooks: AQ, hookRun: answer({ "Which database?": "SQLite" }) });
  assert.deepEqual(t.hookCalls[0].input.tool_input.questions, [{ question: "Which database?", options: ["Postgres", "SQLite"], multiSelect: false }]);
  assert.match(t.told("q1"), /^Your questions have been answered: "Which database\?"="SQLite"\./);

  // Its allow alone is not enough (Claude Code: "Returning "allow" alone is not sufficient for these tools"): the card, as before.
  t = await job(ask({ questions: [Q] }), { hooks: AQ, hookRun: ALLOW });
  assert.equal(cardsOf(t).length, 1);
  assert.equal(t.seen.length, 1, "the turn ended at the card");
  assert.ok(!t.events.some((e) => e.type === "note" && e.hook === "PreToolUse"));
  // An ask rule on AskUserQuestion: the card all the same (hook decisions don't bypass permission rules).
  t = await job(ask({ questions: [Q] }), { hooks: AQ, hookRun: answer({ "Which database?": "Postgres" }), rules: { deny: [], ask: ["AskUserQuestion"], allow: [] } });
  assert.equal(cardsOf(t).length, 1);
  // A deny rule: refused before any hook answers.
  t = await job(ask({ questions: [Q] }), { hooks: AQ, hookRun: answer({ "Which database?": "Postgres" }), rules: { deny: ["AskUserQuestion"], ask: [], allow: [] } });
  assert.equal(t.told("q1"), "Permission to use AskUserQuestion has been denied.");
  // A rewrite that fails the tool's schema: refused, in Claude Code's words; no card.
  t = await job(ask({ questions: [Q] }), { hooks: AQ, hookRun: answer({ "Which database?": 2 }) });
  assert.equal(cardsOf(t).length, 0);
  assert.equal(t.told("q1"), "PreToolUse hook for AskUserQuestion returned updatedInput that failed schema validation: AskUserQuestion failed due to the following issue: The parameter `answers.Which database?` type is expected as `string` but provided as `number` The tool input from the model was valid; the hook's rewrite of it was not.");
  assert.ok(t.events.some((e) => e.type === "result" && e.id === "q1" && e.hookBlocked === true));
  assert.equal(t.seen.length, 2, "Coder is told and goes on");

  // The helpers, against Claude Code's own: its joining and splitting of several labels, and its check of the input.
  assert.equal(H.joinLabels(["Auth", "Search, fast", 'Say "hi"']), 'Auth, "Search, fast", "Say \\"hi\\""');
  assert.deepEqual(H.splitLabels('Auth, "Search, fast", "Say \\"hi\\""'), ["Auth", "Search, fast", 'Say "hi"']);
  assert.equal(H.splitLabels('Auth, "Search'), null);
  assert.equal(H.splitLabels("Auth, "), null);
  assert.deepEqual(H.hookAnswers({ answers: { a: ["x", "y"] }, annotations: { a: { notes: "n" } } }), { answers: { a: "x, y" }, annotations: { a: { notes: "n" } } });
  assert.match(H.hookAnswers({ answers: "Postgres" }).problem, /The parameter `answers` type is expected as `record` but provided as `string`/);
  assert.match(H.hookAnswers({ answers: { a: 1 }, annotations: { a: { notes: 2 } } }).problem, /following issues: The parameter `answers\.a` type is expected as `string` but provided as `number`\nThe parameter `annotations\.a\.notes` type/);
  // The machine's question tool still ends the turn when no hook answers (its card is the next message's question).
  t = await job(ask({ questions: [Q] }));
  assert.deepEqual([cardsOf(t).length, t.seen.length], [1, 1]);
});
