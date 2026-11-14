// CONNECTORS WITH MAIN'S HOOKS, RULES AND PLAN MODE (owner, 2026-11-13: "merge carefully so we can have that code, i said
// carefully cuz theres old code there"). The connectors (MCP) work was built on an older Coder; merged, a connector's tool
// goes through what every other tool goes through, as Claude Code's MCP tools do: permission rules by its own name
// (mcp__<server>__<tool>), PreToolUse, PermissionRequest and PostToolUse hooks by that name, Plan mode, and a No that ends
// the turn.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runCoder, connectorTools } from "../container/coder-agent.mjs";
import { hooksFrom } from "../container/coder-hooks.mjs";
import { REJECTED, REJECTED_SAID, NOT_NOW } from "../container/coder-perms.mjs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
// Linear's two tools: one that changes something (Needs approval, as such tools start) and one that only reads (Always allow).
const TOOLS = connectorTools([
  { name: "mcp__linear__create_issue", label: "Linear: create_issue", parameters: { type: "object", properties: { title: { type: "string" } } } },
  { name: "mcp__linear__list_issues", label: "Linear: list_issues", readOnly: true, parameters: { type: "object", properties: {} } },
]);

/** One job: Grok's replies in turn; hook commands answer with hookOut(input); the owner answers each card with answer(card). */
async function go({ steps, mode = "acceptEdits", rules = null, hooks = null, hookOut = () => "", answer = () => ({ choice: "yes" }), tools = TOOLS, waiting = [], slowMcp = 0 }) {
  let n = 0;
  const seen = [], events = [], mcpCalls = [], cards = [], hookIns = [], order = [];
  const r = await runCoder({
    send: async (req) => { seen.push(req); return steps[Math.min(n++, steps.length - 1)]; },
    exec: async (x) => {
      if (x.hook === true) {
        const input = JSON.parse(x.payload || "{}");
        hookIns.push(input);
        order.push("hook:" + input.hook_event_name);
        const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
        return { code: 0, output: (hookOut(input) || "") + (mark ? "\n" + mark[0] + "\n" : "") };
      }
      return { code: 0, output: "" };
    },
    emit: (e) => events.push(e), sleep: async () => {},
    here: () => "/work/shop", root: "/work/shop", home: "/home/dev", where: (p) => (p.startsWith("/") ? p : "/work/shop/" + p),
    // (The owner answers once the card's PermissionRequest hooks have had their turn: a card one of them answered is withdrawn,
    // `gone`, as they run beside it since fix round 4.)
    ask: async (pid, o = {}) => { const card = events.find((e) => e.type === "permission" && e.pid === pid); cards.push(card); if (o.gone) for (let w = 0; w < 50 && !o.gone(); w++) await new Promise((ok) => setTimeout(ok, 2)); return o.gone && o.gone() ? { choice: "gone" } : answer(card); },
    mcp: async (name, args) => {
      mcpCalls.push([name, args]);
      order.push("start:" + name);
      if (slowMcp) await new Promise((ok) => setTimeout(ok, slowMcp));
      order.push("end:" + name);
      return { text: "done " + name, isError: false };
    },
  }, { text: "go", mode, connectors: tools, connectorsWaiting: waiting, ...(rules ? { rules } : {}), ...(hooks ? { hooks: hooksFrom({ hooks }, "settings").list } : {}) });
  const told = (id) => { for (const m of [...seen.flatMap((q) => q.messages), ...(r.messages || [])]) if (m && m.role === "tool" && m.tool_call_id === id) return m.content; return undefined; };
  return { r, seen, events, mcpCalls, cards, hookIns, order, told };
}
/** The tools a request offers: those it sends, and those tool search's note names as deferred (tool-search.test.mjs). */
const offered = (req) => [...req.tools.map((x) => x.function.name), ...req.messages.filter((m) => m && m.toolsAnnounced).flatMap((m) => m.toolsAnnounced.added)];
const pre = (decision, reason) => JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: decision, permissionDecisionReason: reason } });

test("MC18 (2026-11-13, merged with main's rules) a deny rule naming a connector tool, or every one (mcp__*), keeps it from Grok and refuses a call anyway in Claude Code's words; an ask rule asks once, not twice", async () => {
  const create = [say("", [call("mcp__linear__create_issue", { title: "Bug" }, "k1")]), say("ok")];
  // Every connector tool denied: none offered, and a call anyway is refused, never sent.
  let t = await go({ steps: create, rules: { deny: ["mcp__*"] } });
  assert.ok(!offered(t.seen[0]).some((x) => x.startsWith("mcp__") || x === "connector_search"), "no connector tool offered");
  assert.equal(t.told("k1"), "Permission to use mcp__linear__create_issue has been denied.");
  assert.deepEqual(t.mcpCalls, []);
  // One tool denied by its own name: only that one is kept out.
  t = await go({ steps: [say("done")], rules: { deny: ["mcp__linear__create_issue"] } });
  const names = offered(t.seen[0]).filter((x) => x.startsWith("mcp__"));
  assert.deepEqual(names, ["mcp__linear__list_issues"]);
  // All of one connector's tools, by its name alone (Claude Code: "mcp__puppeteer matches any tool provided by the puppeteer
  // server"); a name that is only the start of one names nothing.
  t = await go({ steps: [say("done")], rules: { deny: ["mcp__linear"] } });
  assert.ok(!offered(t.seen[0]).some((x) => x.startsWith("mcp__")));
  t = await go({ steps: [say("done")], rules: { deny: ["mcp__lin"] } });
  assert.equal(offered(t.seen[0]).filter((x) => x.startsWith("mcp__")).length, 2);
  // Such rules are Claude Code's own and kept: parsed, saved, no warning.
  const P = await import("../container/coder-perms.mjs");
  assert.deepEqual([P.parseRule("mcp__linear__create_issue"), P.parseRule("mcp__linear"), P.parseRule("mcp__linear(x)")], [{ tool: "mcp__linear__create_issue", spec: null, mcp: true }, { tool: "mcp__linear", spec: null, mcp: true }, null]);
  assert.deepEqual([P.ruleSaved("mcp__linear"), P.ruleWarning("deny", "mcp__linear")], [true, null]);
  // No allow rule skips a tool on Needs approval since round 6's follow-up 3 (until then its name, its connector's or
  // mcp__<server>__* approved it): it asks as Claude Code's ask it can't skip, an organization's "ask" ("allow rules for that
  // tool don't take effect"), with that ask's line; the owner's Yes runs it. In Plan mode an allow rule does not approve a
  // tool that changes something either.
  for (const allow of [["mcp__linear__create_issue"], ["mcp__linear"], ["mcp__linear__*"], ["mcp__*"], ["*"]]) {
    t = await go({ steps: create, rules: { allow } });
    assert.deepEqual([t.cards.length, t.cards[0].why, t.mcpCalls.length], [1, "Coder requested permissions to use mcp__linear__create_issue, but you haven't granted it yet.", 1], allow[0]);
  }
  t = await go({ steps: create, mode: "plan", rules: { allow: ["mcp__linear__create_issue"] } });
  assert.equal(t.cards.length, 1, "Plan mode still asks");
  // An ask rule on a tool that is on Needs approval: one card (the rule's), then it runs once.
  t = await go({ steps: create, rules: { ask: ["mcp__linear__create_issue"] } });
  assert.equal(t.cards.length, 1, "asked once");
  assert.equal(t.cards[0].why, "Permission rule mcp__linear__create_issue requires confirmation for this tool.");
  assert.deepEqual(t.mcpCalls, [["mcp__linear__create_issue", { title: "Bug" }]]);
});

test("MC19 (2026-11-13, merged with main's hooks) a connector tool's hooks see its own name (mcp__<server>__<tool>): PreToolUse can block it or ask (its allow skips no ask: not Needs approval's since round 6's follow-up 3, nor Plan mode's for one that changes something); PermissionRequest answers its card; PostToolUse follows it", async () => {
  const create = [say("", [call("mcp__linear__create_issue", { title: "Bug" }, "k1")]), say("ok")];
  const list = [say("", [call("mcp__linear__list_issues", {}, "k1")]), say("ok")];
  const preHook = { PreToolUse: [{ matcher: "mcp__linear__.*", hooks: [{ type: "command", command: "check.sh" }] }] };
  // A PreToolUse deny: the hook saw the tool by its own name and input; the call never went out; Coder is told why.
  let t = await go({ steps: create, hooks: preHook, hookOut: () => pre("deny", "no Linear writes today") });
  const seenByHook = t.hookIns.find((x) => x.hook_event_name === "PreToolUse");
  assert.deepEqual([seenByHook.tool_name, seenByHook.tool_input, seenByHook.tool_use_id], ["mcp__linear__create_issue", { title: "Bug" }, "k1"]);
  assert.deepEqual(t.mcpCalls, []);
  assert.match(t.told("k1"), /no Linear writes today/);
  // A PreToolUse ask on a read-only tool that is on Always allow: the owner is asked, with the hook's reason.
  t = await go({ steps: list, hooks: preHook, hookOut: () => pre("ask", "check Linear reads") });
  assert.equal(t.cards.length, 1);
  assert.equal(t.cards[0].why, "check Linear reads");
  assert.equal(t.mcpCalls.length, 1);
  // A PreToolUse allow does not skip a tool on Needs approval since round 6's follow-up 3 (until then: no card): Claude Code's
  // ask it can't skip still asks, with its line; the owner's Yes runs it. On Always allow it runs with no card.
  t = await go({ steps: create, hooks: preHook, hookOut: () => pre("allow", "fine") });
  assert.deepEqual([t.cards.length, t.cards[0].why, t.mcpCalls.length], [1, "Coder requested permissions to use mcp__linear__create_issue, but you haven't granted it yet.", 1]);
  t = await go({ steps: list, hooks: preHook, hookOut: () => pre("allow", "fine") });
  assert.deepEqual([t.cards.length, t.mcpCalls.length], [0, 1]);
  // ...but not in Plan mode, for a tool that changes something: Plan mode asks.
  t = await go({ steps: create, mode: "plan", hooks: preHook, hookOut: () => pre("allow", "fine") });
  assert.equal(t.cards.length, 1);
  // (Claude Code's words since round 6: its plan mode's ask for an MCP tool that may change something.)
  assert.equal(t.cards[0].why, "Cannot call mcp__linear__create_issue while in plan mode.");
  // A PermissionRequest hook sees the tool's own name, not the card's "connector"; its no is given to Coder as its message
  // (as for every tool since 2026-11-13), its card closed with that no (shown at once beside its hooks since fix round 4) and
  // nothing runs.
  const permHook = { PermissionRequest: [{ matcher: "mcp__linear__create_issue", hooks: [{ type: "command", command: "perm.sh" }] }] };
  t = await go({ steps: create, hooks: permHook, hookOut: (x) => (x.hook_event_name === "PermissionRequest" ? JSON.stringify({ hookSpecificOutput: { hookEventName: "PermissionRequest", decision: { behavior: "deny", message: "Linear is read-only here" } } }) : "") });
  assert.equal(t.hookIns.find((x) => x.hook_event_name === "PermissionRequest").tool_name, "mcp__linear__create_issue");
  assert.equal(t.told("k1"), "Linear is read-only here");
  assert.deepEqual([t.cards.length, t.mcpCalls.length, t.seen.length], [1, 0, 2], "the card closed by the hook, nothing ran, Coder went on");
  // PostToolUse runs after the call, by the tool's name.
  t = await go({ steps: list, hooks: { PostToolUse: [{ matcher: "mcp__.*", hooks: [{ type: "command", command: "after.sh" }] }] } });
  const post = t.hookIns.find((x) => x.hook_event_name === "PostToolUse");
  assert.equal(post.tool_name, "mcp__linear__list_issues");
  assert.deepEqual(t.order.filter((x) => x !== "hook:SessionStart"), ["start:mcp__linear__list_issues", "end:mcp__linear__list_issues", "hook:PostToolUse"]);
});

test("MC20 (2026-11-13, merged) a No on a connector's card ends the turn as on every other card (the rest of the round is not run); a No with a note goes on with it; in Plan mode a tool that changes something asks even on Always allow, one that only reads does not", async () => {
  const two = [say("", [call("mcp__linear__create_issue", { title: "Bug" }, "k1"), call("mcp__linear__list_issues", {}, "k2")]), say("ok")];
  // A plain No: Claude Code's words for it, the rest of the round not run, and Grok is not asked again.
  let t = await go({ steps: two, answer: () => ({ choice: "no" }) });
  // (Round 5: the later call, not started when the No came, gets Claude Code's rejection too.)
  assert.deepEqual([t.told("k1"), t.told("k2")], [REJECTED, REJECTED]);
  assert.deepEqual([t.r.status, t.seen.length, t.mcpCalls.length], ["done", 1, 0]);
  // The card: a connector's, shown as one, its hooks' name kept beside it.
  assert.deepEqual([t.cards[0].tool, t.cards[0].hookTool, t.cards[0].what], ["connector", "mcp__linear__create_issue", "Use Linear: create_issue"]);
  // A No with a note: Coder is told the note and goes on.
  t = await go({ steps: two, answer: (card) => (card.hookTool === "mcp__linear__create_issue" ? { choice: "no", comment: "use the bug template" } : { choice: "yes" }) });
  assert.equal(t.told("k1"), REJECTED_SAID + "use the bug template");
  assert.deepEqual([t.seen.length, t.mcpCalls.map((x) => x[0])], [2, ["mcp__linear__list_issues"]]);
  // Plan mode: the tool that changes something asks even when it is on Always allow; the read-only one runs.
  const allowAll = connectorTools(TOOLS.map((x) => ({ ...x, perm: "allow" })));
  t = await go({ steps: two, mode: "plan", tools: allowAll });
  assert.equal(t.cards.length, 1);
  assert.equal(t.cards[0].hookTool, "mcp__linear__create_issue");
  assert.equal(t.mcpCalls.length, 2, "both ran after the Yes");
});

test("MC21 (2026-11-13, merged; 2026-11-14, Claude Code's groups, coder-parallel.mjs; round 5) read-only connector tools start side by side; with a PreToolUse hook that runs for them, each runs its hook at the group's start and starts after it, still side by side, as Claude Code runs each call's hooks in its own run; a hook for other tools holds nothing back", async () => {
  const twoReads = [say("", [call("mcp__linear__list_issues", {}, "k1"), call("mcp__linear__list_issues", { q: "b" }, "k2")]), say("ok")];
  let t = await go({ steps: twoReads, slowMcp: 20 });
  assert.deepEqual(t.order, ["start:mcp__linear__list_issues", "start:mcp__linear__list_issues", "end:mcp__linear__list_issues", "end:mcp__linear__list_issues"], "side by side");
  t = await go({ steps: twoReads, slowMcp: 20, hooks: { PreToolUse: [{ matcher: "mcp__linear__.*", hooks: [{ type: "command", command: "x.sh" }] }] } });
  assert.deepEqual(t.order.filter((x) => !x.startsWith("hook:")), ["start:mcp__linear__list_issues", "start:mcp__linear__list_issues", "end:mcp__linear__list_issues", "end:mcp__linear__list_issues"], "side by side, after their hooks");
  assert.equal(t.order.filter((x) => x === "hook:PreToolUse").length, 2, "each call's hook once");
  assert.ok(t.order.lastIndexOf("hook:PreToolUse") < t.order.indexOf("start:mcp__linear__list_issues"), "both hooks before either call");
  // (A hook only for Bash: Claude Code runs each call's own hooks in its own run, so these two still go side by side.)
  t = await go({ steps: twoReads, slowMcp: 20, hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "x.sh" }] }] } });
  assert.deepEqual(t.order, ["start:mcp__linear__list_issues", "start:mcp__linear__list_issues", "end:mcp__linear__list_issues", "end:mcp__linear__list_issues"], "side by side");
  // Under a rule asking for the tool: one after another, each asked.
  t = await go({ steps: twoReads, slowMcp: 20, rules: { ask: ["mcp__linear__list_issues"] } });
  assert.equal(t.cards.length, 2);
  assert.deepEqual(t.order, ["start:mcp__linear__list_issues", "end:mcp__linear__list_issues", "start:mcp__linear__list_issues", "end:mcp__linear__list_issues"]);
});

test("MC22 (2026-11-13, merged) the note on connectors waiting for their sign-in follows the owner's message, and not one a UserPromptSubmit hook blocked; Settings and Connectors both in the gear's menu", async () => {
  const note = (t) => t.events.filter((e) => e.type === "note" && /^Not signed in yet: Notion\./.test(e.text)).length;
  let t = await go({ steps: [say("ok")], waiting: ["Notion"] });
  assert.equal(note(t), 1);
  const users = t.events.map((e, i) => [e.type, i]);
  assert.ok(users.findIndex(([k]) => k === "user") < t.events.findIndex((e) => e.type === "note" && /Not signed in yet/.test(e.text)), "after the message");
  t = await go({ steps: [say("ok")], waiting: ["Notion"], hooks: { UserPromptSubmit: [{ hooks: [{ type: "command", command: "gate.sh" }] }] }, hookOut: (x) => (x.hook_event_name === "UserPromptSubmit" ? JSON.stringify({ decision: "block", reason: "not now" }) : "") });
  assert.equal(note(t), 0);
  assert.ok(t.events.some((e) => e.type === "note" && /UserPromptSubmit operation blocked by hook/.test(e.text)));
  // The page: both menu items, both dialogs, both hooks listened for.
  const html = read("public/index.html"), page = read("public/coder.js"), app = read("public/app.js");
  assert.match(html, /id="gfSettings">Settings<\/button><button type="button" role="menuitem" id="gfConnectors">Connectors<\/button>/);
  for (const f of ["async function showSettings()", "async function showConnectors(note)", "async function showChatConnectors()", "async function showNotifications()"]) assert.equal(page.split(f).length, 2, f);
  for (const ev of ["gf:settings", "gf:connectors", "gf:notify"]) { assert.ok(page.includes("window.addEventListener('" + ev + "'"), ev); assert.ok(app.includes("new CustomEvent('" + ev + "')"), ev); }
  // The permission card's title for a connector, beside main's newer ones.
  assert.match(page, /const PERM_TITLE = \{ bash: 'Bash command', powershell: 'PowerShell command', [^\n]*undo_last_job: 'Undo', connector: 'Connector' \};/);
});
