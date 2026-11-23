// FIXES FROM THE LIVE TOOL TEST OF 2026-11-23 (worktrees, the plugin catalog, SubagentHandback, the workflow's first start,
// TodoWrite, and a chat machine's cold start). A scripted AI: no model is called.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { existsSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { runCoder } from "../container/coder-agent.mjs";
import { worktreeNow } from "../container/server.mjs";
import * as W from "../container/coder-worktree.mjs";

const call = (name, args, id = name + Math.random().toString(36).slice(2, 7)) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const scripted = (steps) => { let i = 0; const seen = []; return { seen, send: async (req) => { seen.push(req); return steps[Math.min(i++, steps.length - 1)]; } }; };
const toolMsgs = (s) => s.seen.at(-1).messages.filter((m) => m.role === "tool").map((m) => m.content);
const sh = (cwd, script) => { try { return { code: 0, output: execFileSync("bash", ["-c", script], { cwd, encoding: "utf8" }) }; } catch (e) { return { code: e.status, output: String(e.stdout || "") }; } };

// Coder's layout: the checkout in <root>/<chat>, its git folder apart in <gitRoot>/<chat> (a .git file points there).
async function coderRepo() {
  const t = realpathSync(await mkdtemp(join(tmpdir(), "wtl-")));
  const root = join(t, "proj"), gitRoot = join(t, "git"), d = join(root, "chat1");
  await mkdir(d, { recursive: true }); await mkdir(gitRoot, { recursive: true });
  const g = (...a) => execFileSync("git", ["-C", d, ...a], { encoding: "utf8" });
  execFileSync("git", ["init", "-q", "-b", "main", "--separate-git-dir=" + join(gitRoot, "chat1"), d]);
  g("config", "user.email", "t@t"); g("config", "user.name", "t");
  await writeFile(join(d, "a.txt"), "a\n"); g("add", "."); g("commit", "-q", "-m", "one");
  return { d, g, root, gitRoot };
}

test("LF1 worktrees on Coder's layout: the shell never writes the git folder; Coder's service makes and removes the worktree; keep and remove both work", async () => {
  const { d, g, root, gitRoot } = await coderRepo();
  // The facts script finds the main checkout even though the git folder is not <checkout>/.git.
  const where = W.markOf(sh(d, W.whereScript()).output);
  assert.equal(where.kind, "WHERE");
  assert.deepEqual(W.whereOf(where.rest), { top: d, main: d, inwt: false });
  let cwd = d;
  const cmds = [];
  const exec = async ({ command }) => { cmds.push(command); const r = sh(cwd, command + "\necho \"@@PWD $(pwd -P)\""); const p = /@@PWD (.*)/.exec(r.output); if (p) cwd = p[1].trim(); return { code: r.code, output: r.output.replace(/@@PWD .*\n?/, "") }; };
  const calls = [];
  const worktree = (a) => { calls.push(a.op); return worktreeNow({ ...a, dirs: [d], gitRoot, root, owner: null, quiet: async () => () => {} }); };
  const s = scripted([say("", [call("enter_worktree", { name: "wt1" })]), say("", [call("bash", { command: "pwd" })]), say("", [call("exit_worktree", { action: "remove" })]),
    say("", [call("enter_worktree", { name: "wt2" })]), say("", [call("exit_worktree", { action: "keep" })]), say("Done.")]);
  await runCoder({ send: s.send, exec, emit: () => {}, worktree }, { text: "worktree" });
  const t = toolMsgs(s);
  assert.ok(t.some((x) => x.includes("Created worktree at " + join(d, ".claude/worktrees/wt1") + " on branch worktree-wt1")), t.join("\n"));
  assert.ok(t.some((x) => x.includes(join(d, ".claude/worktrees/wt1"))) );
  assert.ok(t.some((x) => /Exited and removed the worktree/.test(x)), t.join("\n"));
  assert.ok(t.some((x) => /Exited the worktree\. Your work is preserved/.test(x)), t.join("\n"));
  assert.deepEqual(calls, ["add", "remove", "add"]);
  // The chat's shell only read the repository: no git command in it wrote a ref or a worktree.
  assert.ok(!cmds.some((c) => /worktree (add|remove)|branch -D/.test(c)), cmds.join("\n---\n"));
  assert.equal(cwd, d);
  assert.ok(!existsSync(join(d, ".claude/worktrees/wt1")));
  assert.ok(existsSync(join(d, ".claude/worktrees/wt2/a.txt")));
  assert.equal(g("branch", "--list", "worktree-wt1").trim(), "");
  assert.match(g("branch", "--list", "worktree-wt2"), /worktree-wt2/);
});

test("LF2 worktreeNow refuses a folder that is not the chat's, a link on the way, and removing anything outside .claude/worktrees/", async () => {
  const { d, root, gitRoot } = await coderRepo();
  const o = { dirs: [d], gitRoot, root, owner: null, quiet: async () => () => {} };
  assert.equal((await worktreeNow({ ...o, op: "add", main: "/etc", name: "x" })).ok, false);
  assert.equal((await worktreeNow({ ...o, op: "add", main: d, name: "../x" })).ok, false);
  execFileSync("ln", ["-s", "/tmp", join(d, ".claude")]);
  const r = await worktreeNow({ ...o, op: "add", main: d, name: "x" });
  assert.equal(r.ok, false); assert.match(r.why, /not a plain folder/);
  assert.equal((await worktreeNow({ ...o, op: "remove", main: d, path: d, branch: "main" })).ok, false);
  assert.equal((await worktreeNow({ ...o, quiet: async () => null, op: "add", main: d, name: "y" })).ok, false);
});

test("LF3 search_plugins and suggest_plugin_install through envCaller: the Worker's { ok, plugins } reaches the tool (built-in catalog plus a marketplace), and the install card shows", async () => {
  const { envCaller } = await import("../container/coder-envtools.mjs");
  const { pluginsApi, PLUGIN_CATALOG } = await import("../src/coder-plugins.mjs");
  const { pluginTool } = await import("../container/coder-plugins.mjs");
  const store = new Map([["coder/u1/marketplaces.json", JSON.stringify([{ name: "acme", plugins: [{ name: "lintfix", description: "Lint and format code" }] }])]]);
  const bucket = { get: async (k) => (store.has(k) ? { text: async () => store.get(k) } : null), put: async (k, v) => { store.set(k, String(v)); } };
  const envApi = envCaller({ url: "https://x/api/coder/model", headers: {} }, async (_u, init) => new Response(JSON.stringify(await pluginsApi({}, bucket, "u1", {}, JSON.parse(init.body)))));
  const ev = [], said = [];
  const ctx = (args) => ({ args, id: "p1", deps: { envApi }, emit: (e) => ev.push(e), reply: (t) => said.push(t) });
  await pluginTool("search_plugins", ctx({ keywords: ["lint"] }));
  assert.match(said.at(-1), /lintfix@acme/, said.at(-1));
  await pluginTool("search_plugins", ctx({ keywords: [PLUGIN_CATALOG[0].name] }));
  assert.match(said.at(-1), new RegExp(PLUGIN_CATALOG[0].name));
  await pluginTool("suggest_plugin_install", ctx({ plugins: [PLUGIN_CATALOG[0].name], reason: "fits" }));
  assert.match(said.at(-1), /^ok: the owner now sees a card/);
  assert.ok(ev.some((e) => e.type === "plugins_suggest" && e.plugins[0].name === PLUGIN_CATALOG[0].name));
});

test("LF4 a subagent with subagent_handback that answers in words is told once to hand back; the handback shows as a step", async () => {
  const A = await import("../container/coder-agent.mjs");
  const G = await import("../container/coder-agents.mjs");
  const ev = [];
  const s = scripted([say("The repo has 3 files."), say("", [call("subagent_handback", { message: "3 files" }, "h1")]), say("x")]);
  const r = await runCoder({ send: s.send, exec: async () => ({ code: 0, output: "" }), emit: (e) => ev.push(e) }, { text: "count files", tools: G.subagentTools([], "Explore", null, { mode: "auto" }), subagent: { type: "Explore" } });
  assert.equal(r.handback, "3 files");
  assert.ok(s.seen[1].messages.some((m) => m.role === "user" && m.content === A.HANDBACK_NUDGE));
  assert.ok(ev.some((e) => e.type === "bash" && e.id === "h1" && e.verb === "Handed back its report" && e.command === "3 files"), JSON.stringify(ev));
  assert.match(G.SUBAGENT_HANDBACK_TOOL.function.description, /plain text you write at the end is NOT delivered/);
});

test("LF5 workflow: an inline script wins over name (Claude Code: scriptPath, then script, then name), so a name with no saved file does not fail the start", async () => {
  const G = await import("../container/coder-agents.mjs");
  const said = [], ev = [];
  let read = 0;
  const k = { emit: (e) => ev.push(e), reply: (t) => said.push(t), runs: new Map(), agents: new Map(), budget: G.subagentBudget({ atOnce: 1, total: 1 }), readText: async () => { read++; return { error: "no such file" }; }, step: async () => ({ status: "done", result: "hi" }), stopped: async () => false, bg: () => {}, startSub: async () => ({ status: "done", messages: [] }) };
  await G.agentToolCall({ id: "w1", name: "workflow", args: { name: "say-hi", script: "export const meta = { name: 'say-hi', description: 'reply hi' }\nreturn 'hi'" } }, k).catch(() => {});
  assert.equal(read, 0);
  assert.ok(!said.some((t) => /no such file/.test(t)), said.join("\n"));
  assert.ok(ev.some((e) => e.type === "bash" && e.command === "say-hi"));
});

test("LF6 TodoWrite matches Claude Code: cloud chats get the four Task tools on every model, todo_write only with tasks off; and a cold machine is waited for three minutes", async () => {
  const K = await import("../container/coder-tasks.mjs");
  assert.equal(K.taskToolsAvailable({ model: "grok-4.7", cloud: true }), true);
  assert.equal(K.taskToolsAvailable({ model: "grok-4.7" }), false);
  const F = await import("../src/coder-fly.mjs");
  assert.ok(F.FLY_RETRY_MS >= 3 * 60_000);
});
