// THE WORKTREE, FEEDBACK, FINDINGS, END AND PLUGIN TOOLS AS CLAUDE CODE HAS THEM (2026-11-23, second pass): Claude Code's own
// descriptions and inputs (keywords), .worktreeinclude, the feedback queue, EndConversation's rules, plugin hooks and agents,
// and /plugin:skill. A scripted AI: no model is called.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { existsSync, realpathSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import * as W from "../container/coder-worktree.mjs";
import * as C from "../container/coder-plugins.mjs";
import * as P from "../src/coder-plugins.mjs";
import * as A from "../container/coder-agents.mjs";
import { slashSkill } from "../container/coder-skills.mjs";
import { runCoder } from "../container/coder-agent.mjs";

const call = (name, args, id = name + Math.random().toString(36).slice(2, 7)) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const scripted = (steps) => { let i = 0; const seen = []; return { seen, send: async (req) => { seen.push(req); return steps[Math.min(i++, steps.length - 1)]; } }; };
const toolMsgs = (s) => s.seen.at(-1).messages.filter((m) => m.role === "tool").map((m) => m.content);
const fnOf = (list, n) => list.find((t) => t.function.name === n).function;
function fakeBucket() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, String(v)); }, async delete(k) { m.delete(k); } };
}

test("P2-1 descriptions and inputs are Claude Code's: worktree tools, keywords on the four list/search tools, findings without severity", () => {
  assert.match(W.ENTER_WORKTREE_DESCRIPTION, /^Use this tool ONLY when explicitly instructed to work in a worktree/);
  assert.match(W.ENTER_WORKTREE_DESCRIPTION, /## When NOT to Use/);
  assert.match(W.ENTER_WORKTREE_DESCRIPTION, /\.worktreeinclude/);
  assert.match(W.EXIT_WORKTREE_DESCRIPTION, /^Exit a worktree session created by enter_worktree/);
  assert.match(W.EXIT_WORKTREE_DESCRIPTION, /is a \*\*no-op\*\*/);
  assert.deepEqual(Object.keys(W.ENTER_WORKTREE_PARAMS.properties), ["name", "path"]);
  assert.match(W.ENTER_WORKTREE_PARAMS.properties.name.description, /max 64 chars total/);
  assert.ok(!("severity" in W.REPORT_FINDINGS_PARAMS.properties.findings.items.properties));
  for (const [n, req] of [["search_plugins", true], ["search_skills", true], ["list_plugins", false], ["list_skills", false]]) {
    const f = fnOf(C.PLUGIN_TOOLS, n);
    const k = f.parameters.properties.keywords;
    assert.equal(k.type, "array", n); assert.equal(k.maxItems, 8, n); assert.equal(k.items.maxLength, 64, n); assert.equal(k.items.minLength, 1, n);
    assert.equal(k.minItems, req ? 1 : undefined, n);
    assert.deepEqual(f.parameters.required, req ? ["keywords"] : [], n);
  }
  assert.match(fnOf(C.PLUGIN_TOOLS, "search_plugins").description, /keywords \["lint", "format", "code quality"\]/);
  assert.match(fnOf(C.PLUGIN_TOOLS, "list_skills").description, /Pass keywords to filter to a topic; omit to list all/);
});

test("P2-2 checkKeywords: 1 to 8 phrases of 1 to 64 characters; optional for the list tools; a plain query still works", () => {
  assert.deepEqual(C.checkKeywords({ keywords: ["a", "b"] }, true), { keywords: ["a", "b"] });
  assert.match(C.checkKeywords({}, true).error, /required/);
  assert.deepEqual(C.checkKeywords({}, false), { keywords: [] });
  assert.match(C.checkKeywords({ keywords: Array(9).fill("x") }, true).error, /1 to 8/);
  assert.match(C.checkKeywords({ keywords: ["x".repeat(65)] }, true).error, /1 to 64/);
  assert.match(C.checkKeywords({ keywords: "db" }, true).error, /array/);
  assert.deepEqual(C.checkKeywords({ query: "db" }, true), { keywords: ["db"] });
  assert.equal(P.keywordsQuery({ keywords: ["code", "review"] }), "code review");
});

test("P2-3 list_skills filters by keywords; search_skills sends keywords; list_plugins passes them to the server", async () => {
  const api = [];
  const deps = { envApi: async (b) => { api.push(b); return b.action === "skills_catalog" ? { ok: true, skills: [] } : { ok: true, plugins: [] }; } };
  const out = [];
  const ctx = (args) => ({ args, id: "x", deps, emit: () => {}, reply: (t) => out.push(t), skills: [{ name: "deploy-notes", description: "Write deploy notes" }, { name: "code-review:review-changes", description: "Review changes", source: "plugin code-review" }] });
  await C.pluginTool("list_skills", ctx({ keywords: ["review"] }));
  assert.match(out.at(-1), /code-review:review-changes/); assert.doesNotMatch(out.at(-1), /deploy-notes/);
  await C.pluginTool("list_skills", ctx({}));
  assert.match(out.at(-1), /deploy-notes/);
  await C.pluginTool("search_skills", ctx({ keywords: [] }));
  assert.match(out.at(-1), /error: keywords takes 1 to 8/);
  await C.pluginTool("list_plugins", ctx({ keywords: ["db"] }));
  assert.deepEqual(api.at(-1), { action: "plugins_list", keywords: ["db"] });
});

test("P2-4 enter_worktree copies the gitignored files .worktreeinclude names (never tracked ones), and answers EnterWorktreeOutput", async () => {
  const d = realpathSync(await mkdtemp(join(tmpdir(), "wti-")));
  const g = (...a) => execFileSync("git", ["-C", d, ...a], { encoding: "utf8" });
  g("init", "-q", "-b", "main"); g("config", "user.email", "t@t"); g("config", "user.name", "t");
  await writeFile(join(d, ".gitignore"), ".env\nconfig/secrets.json\nvendor/\nnot-listed.txt\n");
  await writeFile(join(d, ".worktreeinclude"), ".env\nconfig/secrets.json\nvendor/**/config.json\ntracked.txt\n");
  await writeFile(join(d, "tracked.txt"), "t\n");
  g("add", "."); g("commit", "-q", "-m", "one");
  await writeFile(join(d, ".env"), "A=1\n");
  await mkdir(join(d, "config")); await writeFile(join(d, "config/secrets.json"), "{}");
  await mkdir(join(d, "vendor/lib"), { recursive: true }); await writeFile(join(d, "vendor/lib/config.json"), "{}"); await writeFile(join(d, "vendor/lib/other.js"), "x");
  await writeFile(join(d, "not-listed.txt"), "n");
  let cwd = d;
  const exec = async ({ command }) => { try { const o = execFileSync("bash", ["-c", command + "\necho \"@@PWD $(pwd -P)\""], { cwd, encoding: "utf8" }); const p = /@@PWD (.*)/.exec(o); if (p) cwd = p[1].trim(); return { code: 0, output: o.replace(/@@PWD .*\n?/, "") }; } catch (e) { return { code: e.status, output: String(e.stdout || "") }; } };
  const s = scripted([say("", [call("enter_worktree", { name: "inc" })]), say("", [call("exit_worktree", { action: "keep" })]), say("Done.")]);
  await runCoder({ send: s.send, exec, emit: () => {} }, { text: "work in a worktree" });
  const wt = join(d, ".claude/worktrees/inc");
  assert.equal(readFileSync(join(wt, ".env"), "utf8"), "A=1\n");
  assert.ok(existsSync(join(wt, "config/secrets.json")));
  assert.ok(existsSync(join(wt, "vendor/lib/config.json")));
  assert.ok(!existsSync(join(wt, "vendor/lib/other.js")));
  assert.ok(!existsSync(join(wt, "not-listed.txt")));
  const t = toolMsgs(s);
  const enter = JSON.parse(t.find((x) => x.startsWith("{\"worktreePath\"")));
  assert.equal(enter.worktreePath, wt); assert.equal(enter.worktreeBranch, "worktree-inc");
  assert.match(enter.message, /copied 3 files named in \.worktreeinclude/);
  const exit = JSON.parse(t.find((x) => x.startsWith("{\"action\"")));
  assert.deepEqual([exit.action, exit.originalCwd, exit.worktreePath, exit.worktreeBranch], ["keep", d, wt, "worktree-inc"]);
});

test("P2-5 EndConversation: deny rules naming it have no effect while other tools remain; \"*\" removes it unless an allow rule names it; no PreToolUse hook runs for it", async () => {
  const denies = (list) => (n) => list.includes("*") || list.includes(n);
  assert.equal(W.endConversationDenied(null, denies(["EndConversation"]), false), false);
  assert.equal(W.endConversationDenied(null, denies(["*"]), false), true);
  assert.equal(W.endConversationDenied(null, denies(["*"]), true), false);
  assert.equal(W.endConversationDenied(null, denies([...W.CORE_TOOLS]), false), false);
  const ev = [];
  const s = scripted([say("", [call("end_conversation", { reason: "owner_request" })]), say("never")]);
  const hooks = [{ event: "PreToolUse", matcher: "", type: "command", command: "echo hooked >&2; exit 2", timeout: 10, source: "settings" }];
  const r = await runCoder({ send: s.send, exec: async () => ({ code: 0, output: "" }), emit: (e) => ev.push(e) }, { text: "end it, yes I confirm", rules: { deny: ["EndConversation"] }, hooks });
  assert.equal(r.ended, true);
  assert.ok(ev.some((e) => e.type === "ended"));
});

test("P2-6 send_feedback joins the owner's queue: 10 drafts across chats (the oldest dropped), 30 days; 3 cards a chat, then a count", async () => {
  const b = fakeBucket();
  for (let i = 0; i < 11; i++) await P.queueFeedback(b, "u", { title: "t" + i, details: "d" }, "coder/c1", 1000 + i);
  const list = await P.readFeedback(b, "u", 2000);
  assert.equal(list.length, 10); assert.equal(list[0].title, "t1");
  assert.equal((await P.readFeedback(b, "u", 1010 + P.FEEDBACK_TTL_MS)).length, 0);
  assert.match((await P.queueFeedback(b, "u", { title: "", details: "d" })).error, /title/);
  // Through the machine's question, as the chat's job asks it.
  const r = await P.pluginsApi({}, b, "u", { branch: "coder/c2" }, { action: "feedback_queue", title: "x", details: "y" });
  assert.equal(r.ok, true); assert.equal(r.inChat, 1);
  // The page's queue: newest first; discard one.
  const got = await (await P.handlePluginRoutes(new Request("https://x.test/api/coder/feedback"), b, "u", ["feedback"])).json();
  assert.equal(got.drafts[0].title, "x");
  const del = await P.handlePluginRoutes(new Request("https://x.test/api/coder/feedback/" + r.id, { method: "DELETE" }), b, "u", ["feedback", r.id]);
  assert.equal(del.status, 200);
  // In the loop: the server says how many this chat has; past three, only a count.
  const ev = []; let n = 2;
  const s = scripted([say("", [call("send_feedback", { title: "a", details: "b" }), call("send_feedback", { title: "a", details: "b" })]), say("ok")]);
  await runCoder({ send: s.send, exec: async () => ({ code: 0, output: "" }), emit: (e) => ev.push(e), envApi: async () => ({ ok: true, id: "fb1", queued: 7, inChat: ++n, dropped: 0 }) }, { text: "file feedback" });
  assert.equal(ev.filter((e) => e.type === "feedback").length, 1);
  assert.equal(ev.find((e) => e.type === "feedback_count").queued, 7);
});

test("P2-7 plugin hooks join the owner's hooks; plugin agents are custom subagents named plugin:agent", async () => {
  const b = fakeBucket();
  await P.installPlugin(b, "u", "testing"); await P.installPlugin(b, "u", "code-review");
  const parts = await P.ownerPluginParts(b, "u");
  assert.deepEqual(parts.hooks.map((h) => h.plugin), ["testing"]);
  assert.deepEqual(parts.agents.map((a) => [a.plugin, a.file]), [["code-review", "code-reviewer.md"]]);
  assert.match(P.pluginOut(P.PLUGIN_CATALOG[1]).contents, /1 hook/);
  assert.deepEqual(P.pluginOut(P.PLUGIN_CATALOG[0]).agents, ["code-reviewer"]);
  // The machine merges the hooks (in a child process: server.mjs is the machine's server).
  const code = `const S = await import(${JSON.stringify(new URL("../container/server.mjs", import.meta.url).href)});
    const h = S.hooksForTurn(null, null, { plugins: ${JSON.stringify(parts.hooks)} });
    const off = S.hooksForTurn(null, { disableAllHooks: true }, { plugins: ${JSON.stringify(parts.hooks)} });
    console.log(JSON.stringify({ h: h.map((x) => [x.event, x.matcher, x.plugin]), off: off.length }));`;
  const out = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", code], { timeout: 15000, encoding: "utf8" }).trim().split("\n").pop());
  assert.deepEqual(out.h, [["PostToolUse", "Edit|Write", "testing"]]);
  assert.equal(out.off, 0);
  // The agent file read as Claude Code's agents/<name>.md.
  const custom = A.pluginAgentsFrom(parts.agents);
  assert.deepEqual(Object.keys(custom), ["code-review:code-reviewer"]);
  assert.deepEqual(custom["code-review:code-reviewer"].tools, ["read", "grep", "glob", "bash"]);
  assert.match(custom["code-review:code-reviewer"].note, /careful code reviewer/);
  assert.deepEqual(A.parseAgentFile("---\nname: Bad Name\ndescription: x\n---\nhi").error, "bad name: lowercase letters, digits and hyphens");
  assert.equal(A.parseAgentFile("no frontmatter").error, "no frontmatter");
  // Never given the tools no subagent gets, whatever `tools` says.
  assert.deepEqual(A.parseAgentFile("---\nname: a\ndescription: d\ntools: Read, EndConversation, AskUserQuestion, Write\ndisallowedTools: Write\n---\n").tools, ["read"]);
  const tool = A.agentToolFor(custom);
  assert.ok(tool.function.parameters.properties.subagent_type.enum.includes("code-review:code-reviewer"));
  assert.equal(A.agentToolFor({}), A.AGENT_TOOL);
  // The agent tool runs it with its own prompt and tools.
  let started = null;
  const said = [];
  await A.agentToolCall({ id: "a1", name: "agent", args: { description: "review", prompt: "review it", subagent_type: "code-review:code-reviewer" } }, {
    emit: () => {}, reply: (t) => said.push(t), budget: A.subagentBudget({ atOnce: 1, total: 2 }), agents: new Map(), runs: new Map(), custom,
    startSub: async (o) => { started = o; return { status: "done", handback: "no bugs", messages: [], usage: [] }; },
  });
  assert.equal(started.type, "code-review:code-reviewer");
  assert.match(said[0], /no bugs/);
  const names = A.subagentTools([{ function: { name: "read" } }, { function: { name: "write" } }, { function: { name: "end_conversation" } }], "code-review:code-reviewer", custom).map((t) => t.function.name);
  assert.deepEqual(names, ["read", "subagent_handback"]);
});

test("P2-8 /plugin:skill typed in the box runs that plugin's skill", () => {
  const sk = { name: "code-review:review-changes", description: "d", body: "b", user: true };
  const r = slashSkill("/code-review:review-changes main", [sk]);
  assert.equal(r.skill, sk); assert.equal(r.args, "main");
  assert.equal(slashSkill("/code-review:nope", [sk]), null);
  const js = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  assert.ok(js.includes("/^[A-Za-z0-9][\\w-]{0,63}(?::[A-Za-z0-9][\\w-]{0,63})?$/.test(String(x.name || ''))"));
});
