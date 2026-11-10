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
  assert.match(read("src/coder-routes.mjs"), /prePlanMode: saved\.mode === "acceptEdits" \? "acceptEdits" : "auto"/);
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
