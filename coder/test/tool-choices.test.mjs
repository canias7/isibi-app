// THE TOOLS PAGE'S CHOICES AS RULES (the owner, 2026-11-24): Always allow is an allow rule on the tool's Claude Code name,
// Ask an ask rule, Never a deny rule; a row never changed adds nothing; the owner's own rules and the repository's
// .claude/settings.json rules come first; Coder's safety checks still run. No model calls: the loop runs on a stub.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TOOL_ROWS, applyToolChoices, cleanToolChoices, changeToolChoice, toolChoiceSets } from "../container/coder-toolchoices.mjs";
import { bashDecision, fetchDecision, fileToolDecision, parseRule } from "../container/coder-perms.mjs";
import { droppedInAuto } from "../container/coder-checker.mjs";
import { withRepoRules } from "../container/server.mjs";

const EMPTY = { allow: [], ask: [], deny: [] };

test("TC1 the page's rows: every group and tool of the mockup, each with its explanation and the names its rule uses", () => {
  assert.equal(TOOL_ROWS.length, 38);
  assert.deepEqual([...new Set(TOOL_ROWS.map((r) => r.group))], ["Files", "Commands", "Web", "Helpers", "Scheduling", "Sharing", "Side copies", "Connectors", "Plugins and skills", "Other"]);
  for (const r of TOOL_ROWS) { assert.ok(r.tip.length > 20 && r.line && r.rules.length, r.id); assert.ok(["allow", "ask", "deny"].includes(r.def), r.id); assert.doesNotMatch(r.tip + r.line + r.name, /\p{Extended_Pictographic}/u); }
  const by = Object.fromEntries(TOOL_ROWS.map((r) => [r.name, r.rules]));
  assert.deepEqual([by.Bash, by.Edit, by.WebFetch, by.Agent, by.CronCreate, by["Connector tools"]], [["Bash"], ["Edit"], ["WebFetch"], ["Agent"], ["CronCreate"], ["mcp__*"]]);
  assert.match(readFileSync(new URL("../container/coder-toolchoices.mjs", import.meta.url), "utf8"), /^(?![\s\S]*\bprocess\.)/, "no process in the Worker's copy");
});

test("TC2 storing: only known rows and the three values; Reset to default forgets the row", () => {
  assert.deepEqual(cleanToolChoices({ bash: "deny", nope: "allow", read: "maybe" }), { bash: "deny" });
  assert.deepEqual(changeToolChoice({}, "bash", "allow"), { choices: { bash: "allow" } });
  assert.deepEqual(changeToolChoice({ bash: "allow", read: "ask" }, "bash", "default"), { choices: { read: "ask" } });
  assert.match(changeToolChoice({}, "rm-rf", "allow").error, /no tool/);
  assert.match(changeToolChoice({}, "bash", "sometimes").error, /Ask, Always allow, Never/);
});

test("TC3 a choice becomes the right rule; nothing chosen changes nothing", () => {
  const rules = { allow: ["Bash(npm test)"], ask: [], deny: [] };
  assert.equal(applyToolChoices(rules, {}), rules, "no choices: the very same rules");
  assert.equal(applyToolChoices(rules, undefined), rules);
  const m = applyToolChoices(EMPTY, { write: "allow", read: "ask", "webfetch": "deny", edit: "deny", agent: "deny", "croncreate": "ask", "connector-tools": "ask", bash: "ask", powershell: "deny", "task-list": "allow", "endconversation": "deny" });
  assert.deepEqual(m.allow, ["Write", "TodoWrite", "TaskCreate", "TaskGet", "TaskList", "TaskUpdate"]);
  assert.deepEqual(m.ask, ["Read"]);
  assert.deepEqual(m.deny, ["Edit", "PowerShell", "WebFetch"]);
  // Names Coder's rule reader has no rule for, and Bash's Ask (read-only commands still run), go to the machine by name.
  assert.deepEqual(m.toolChoices, { allow: [], ask: ["Bash", "CronCreate", "mcp__*"], deny: ["Agent"], aside: [] });
  for (const k of ["allow", "ask", "deny"]) for (const r of m[k]) assert.ok(parseRule(r), r);
  // EndConversation: Claude Code's, it can't be denied while other tools remain.
  assert.ok(!m.deny.includes("EndConversation") && !m.toolChoices.deny.includes("EndConversation"));
  assert.deepEqual(toolChoiceSets(m).deny, new Set(["Agent"]));
});

test("TC4 the owner's own rules and the repository's come first: a tool they name keeps its rules, and the choice is set aside", () => {
  // The owner's allow rule for one command: Never for Bash doesn't override it.
  let m = applyToolChoices({ allow: ["Bash(npm test *)"], ask: [], deny: [] }, { bash: "deny", read: "deny" });
  assert.deepEqual([m.deny, m.toolChoices.aside], [["Read"], ["bash"]]);
  assert.equal(bashDecision("npm test", { mode: "acceptEdits", rules: m, cwd: "/w", workdirs: ["/w"] }).verdict, "allow");
  // The owner's ask rule beats Always allow.
  m = applyToolChoices({ allow: [], ask: ["WebFetch(domain:example.com)"], deny: [] }, { "webfetch": "allow" });
  assert.deepEqual(m.allow, []);
  assert.equal(fetchDecision("https://example.com/x", { mode: "acceptEdits", rules: m }).verdict, "ask");
  // A wildcard names it too.
  assert.deepEqual(applyToolChoices({ allow: [], ask: [], deny: ["Web*"] }, { "websearch": "allow" }).toolChoices.aside, ["websearch"]);
  // The repository's .claude/settings.json rules, merged on the machine (withRepoRules), come first too.
  m = withRepoRules({ allow: [], ask: [], deny: [], toolsPage: { bash: "deny", grep: "deny" } }, { allow: [], ask: ["Bash(git push *)"], deny: [] });
  assert.deepEqual([m.deny, m.toolChoices.aside], [["Grep"], ["bash"]]);
  assert.equal(bashDecision("git push origin x", { mode: "acceptEdits", rules: m, cwd: "/w", workdirs: ["/w"] }).verdict, "ask");
  // With no repository rules, the owner's choices still apply.
  m = withRepoRules({ allow: [], ask: [], deny: [], toolsPage: { bash: "deny" } }, { allow: [], ask: [], deny: [] });
  assert.deepEqual(m.deny, ["Bash"]);
  assert.equal(bashDecision("npm test", { mode: "acceptEdits", rules: m, cwd: "/w", workdirs: ["/w"] }).verdict, "deny");
  assert.equal(withRepoRules({ allow: ["Bash(ls)"], ask: [], deny: [] }, { allow: [], ask: [], deny: [] }).toolChoices, undefined, "nothing chosen, nothing added");
});

test("TC5 Coder's safety checks still run: a Bash allow is dropped in Auto (the checker still checks), a protected file still asks", () => {
  const m = applyToolChoices(EMPTY, { bash: "allow", edit: "allow", write: "allow" });
  assert.deepEqual(m.allow, ["Write", "Edit", "Bash"]);
  assert.equal(droppedInAuto("Bash"), true, "in Auto a whole-tool Bash allow is dropped, so the checker still runs");
  const d = fileToolDecision("edit", "/w/.git/config", { rules: m, root: "/w", cwd: "/w", mode: "acceptEdits" });
  assert.notEqual(d && d.verdict, "allow", "a protected path is never allowed by a rule: " + JSON.stringify(d));
});

const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
async function job(steps, { mode = "auto", rules = null } = {}) {
  const { runCoder } = await import("../container/coder-agent.mjs");
  const events = [], ran = [], cards = [], checks = [];
  let n = 0;
  const r = await runCoder({
    send: async (req) => {
      const sys = String((req.messages[0] && req.messages[0].content) || "");
      if (/^You are the safety checker/.test(sys)) { checks.push(req); return { message: { role: "assistant", content: '{"decision":"allow"}' }, usage: { in: 1, out: 1 } }; }
      return steps[Math.min(n++, steps.length - 1)];
    },
    exec: async (x) => { if (!x.tool) ran.push(x.command); return { code: 0, output: "ok\n" }; },
    emit: (e) => events.push(e),
    here: () => "/work/shop", root: "/work/shop", where: (p) => (p.startsWith("/") ? p : "/work/shop/" + p),
    ask: async (pid) => { cards.push(events.find((e) => e.type === "permission" && e.pid === pid)); return { choice: "yes" }; },
  }, { text: "ship it", mode, rules, checker: true, checkWhere: { key: "tc-" + Math.random() } });
  const told = (id) => (r.messages.find((m) => m.role === "tool" && m.tool_call_id === id) || {}).content || "";
  return { r, events, ran, cards, checks, told };
}

test("TC6 on Coder's loop: Bash's Ask asks before a command that changes something, never before one that only reads; the owner's rule for it comes first", async () => {
  const ask = applyToolChoices(EMPTY, { bash: "ask" });
  let t = await job([say("", [call("bash", { command: "ls -la" }, "b1")]), say("", [call("bash", { command: "npm install left-pad" }, "b2")]), say("ok")], { rules: ask });
  assert.equal(t.cards.length, 1, "one card, for npm install");
  assert.match(JSON.stringify(t.cards[0]), /npm install left-pad/);
  assert.match(JSON.stringify(t.cards[0]), /Tools page/);
  assert.deepEqual(t.ran, ["ls -la", "npm install left-pad"]);
  // Not chosen: no card (Auto's checker decides, as before).
  t = await job([say("", [call("bash", { command: "npm install left-pad" }, "b2")]), say("ok")], { rules: EMPTY });
  assert.equal(t.cards.length, 0);
  // The owner's own allow rule for the command: set aside, no card.
  t = await job([say("", [call("bash", { command: "npm install left-pad" }, "b2")]), say("ok")], { rules: applyToolChoices({ allow: ["Bash(npm install *)"], ask: [], deny: [] }, { bash: "ask" }) });
  assert.equal(t.cards.length, 0);
});

test("TC7 on Coder's loop: Never refuses a tool by its name (PushNotification), Ask puts a card first", async () => {
  let t = await job([say("", [call("notify", { message: "done" }, "n1")]), say("ok")], { rules: applyToolChoices(EMPTY, { "pushnotification": "deny" }) });
  assert.match(t.told("n1"), /PushNotification/);
  assert.match(t.told("n1"), /denied|not available|no tool|unknown/i);
  t = await job([say("", [call("notify", { message: "done" }, "n1")]), say("ok")], { rules: applyToolChoices(EMPTY, { "pushnotification": "ask" }) });
  assert.equal(t.cards.length, 1);
  assert.match(JSON.stringify(t.cards[0]), /PushNotification/);
});

test("TC8 the Worker keeps the choices per owner (coder/<uid>/tools.json): GET the rows and choices, POST one, Reset to default", async () => {
  const { handleCoder } = await import("../src/coder-routes.mjs");
  const m = new Map();
  const bucket = { async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); }, async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
  const uid = "user-1234567890abcdef";
  const env = { CODER_ON: "on", CODER_USERS: "me@x.y", CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://coder.gofarther.dev", CODER_BUCKET: bucket };
  const deps = { fetchFn: async () => new Response("{}", { status: 404 }), authUser: async () => ({ id: uid, email: "me@x.y" }), container: () => ({ fetch: async () => Response.json({ ok: true }) }) };
  const go = (method, body) => handleCoder(new Request("https://gofarther.dev/api/coder/tool-choices", { method, headers: { "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) }), env, { waitUntil() {} }, deps);
  let r = await go("GET");
  let j = await r.json();
  assert.equal(r.status, 200);
  assert.deepEqual([j.rows.length, j.groups.length, j.choices], [38, 10, {}]);
  assert.equal(m.size, 0, "nothing stored until the owner picks something");
  r = await go("POST", { id: "bash", value: "deny" });
  assert.deepEqual((await r.json()).choices, { bash: "deny" });
  assert.deepEqual(JSON.parse(m.get("coder/" + uid + "/tools.json")), { bash: "deny" });
  r = await go("POST", { id: "bash", value: "sometimes" });
  assert.equal(r.status, 400);
  r = await go("POST", { id: "bash", value: "default" });
  assert.deepEqual((await r.json()).choices, {});
  // The turn sends them with the rules, as toolsPage (read by server.mjs withRepoRules).
  assert.match(readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8"), / : 0, toolsPage: await toolChoicesOf\(bucket, uid\), /);
});
