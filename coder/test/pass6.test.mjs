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
