// THE "NOT DONE YET" ROWS OF THE OWNER'S TOOLS COMPARISON, BUILT (2026-11-24): Manual mode (Claude Code's "default"), a full disk
// before a command starts, CODER_PYTHON_ENV, Read's picture and PDF result objects for hooks, Artifact's favicon, a feedback
// draft's cleanupPeriodDays, the deep-research workflow and resumeFromRunId across messages, a subagent's cards passed through,
// SendUserFile's inline picture, and Coder's own worktrees kept out of a save's "Not saved" line. Grok is stubbed: no paid call.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MODES, MODE_NAMES, MODE_INFO, normMode, bashDecision, fetchDecision } from "../container/coder-perms.mjs";

const A = await import("../container/coder-agent.mjs");
const G = await import("../container/coder-agents.mjs");
const W = await import("../container/coder-worktree.mjs");
const R = await import("../container/coder-resources.mjs");
const T = await import("../container/coder-tools.mjs");

const ROOT = "/work/shop";
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });

async function job(steps, { mode = "default", answers = [], rules = null, exec = null } = {}) {
  const events = [], seen = [], ran = [], cards = [];
  let n = 0, k = 0;
  const r = await A.runCoder({
    send: async (req) => { seen.push(req); return steps[Math.min(n++, steps.length - 1)]; },
    exec: exec || (async (x) => { ran.push(x.command); return { code: 0, output: "ok\n" }; }),
    emit: (e) => events.push(e),
    here: () => ROOT, root: ROOT, where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p),
    ask: async (pid) => { cards.push(events.find((e) => e.type === "permission" && e.pid === pid)); return answers[k++] || null; },
  }, { text: "go", mode, rules });
  return { r, events, seen, ran: ran.filter((c) => !/coder-tools\.mjs/.test(c)), cards };
}

test("ND1 Manual is a fourth mode, Claude Code's \"default\", named and described for the menu", () => {
  assert.deepEqual(MODES, ["auto", "acceptEdits", "plan", "default"]);
  assert.equal(MODE_NAMES.default, "Manual");
  assert.equal(MODE_INFO.default, "Ask before edits and commands");
  assert.equal(normMode("default"), "default");
  assert.equal(A.hookModeName("default", true), "default");
});

test("ND2 Manual: read-only commands run; a command that changes files asks even inside the project (Accept edits runs it); a fetch asks", () => {
  const d = (mode, c) => bashDecision(c, { mode, rules: {}, cwd: ROOT, workdirs: [ROOT], isProtected: () => "" });
  assert.equal(d("default", "ls -la").verdict, "allow");
  assert.equal(d("default", "git status").verdict, "allow");
  assert.equal(d("default", "mkdir -p src/x").verdict, "ask");
  assert.equal(d("acceptEdits", "mkdir -p src/x").verdict, "allow");
  assert.equal(d("default", "npm test").verdict, "ask");
  assert.equal(bashDecision("npm test", { mode: "default", rules: { allow: ["Bash(npm test *)"] }, cwd: ROOT, workdirs: [ROOT], isProtected: () => "" }).verdict, "allow");
  assert.equal(fetchDecision("https://example.com/x", { mode: "default" }).verdict, "ask");
});

test("ND3 Manual: a file edit waits on a card in Claude Code's words, with \"Yes, allow all edits during this session\"; that answer switches to Accept edits", async () => {
  const steps = [say("", [call("write", { path: "a.md", content: "x\n" }, "w1")]), say("", [call("write", { path: "b.md", content: "y\n" }, "w2")]), say("Done.")];
  const { r, cards } = await job(steps, { answers: [{ choice: "acceptEdits" }] });
  assert.equal(cards.length, 1, "the second write ran without a card, in Accept edits");
  assert.equal(cards[0].tool, "write");
  assert.equal(cards[0].why, "Do you want to make this edit to " + ROOT + "/a.md?");
  assert.equal(cards[0].toEdits, true);
  assert.equal(r.mode, "acceptEdits");
});

test("ND4 Manual: an Edit allow rule covers the file, so no card; a No refuses the write", async () => {
  const ok = await job([say("", [call("write", { path: "a.md", content: "x\n" }, "w1")]), say("Done.")], { rules: { allow: ["Edit(a.md)"], ask: [], deny: [] } });
  assert.equal(ok.cards.length, 0);
  const no = await job([say("", [call("write", { path: "a.md", content: "x\n" }, "w1")]), say("Done.")], { answers: [{ choice: "no" }] });
  assert.equal(no.cards.length, 1);
  assert.equal(no.r.mode, "default");
});

test("ND5 Manual: workflow and Coder's own changing tools ask first (Claude Code's Permission required: Yes)", async () => {
  assert.equal(A.MANUAL_ASKS.workflow({ name: "deep-research" }), "Run a workflow (deep-research)");
  assert.ok(A.MANUAL_ASKS.pull_request);
  assert.equal(A.manualCallWhy("Workflow"), "Coder wants to use Workflow.");
  const { cards } = await job([say("", [call("workflow", { name: "deep-research", args: "q" }, "f1")]), say("ok")], { answers: [{ choice: "no" }] });
  assert.equal(cards.length, 1);
  assert.equal(cards[0].why, "Coder wants to use Workflow.");
});

test("ND6 the page's mode menu lists Manual, and Manual's edit card offers the switch to Accept edits", () => {
  const js = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  assert.match(js, /\{ id: 'default', name: 'Manual', info: 'Ask before edits and commands', icon: 'manual' \}/);
  assert.match(js, /if \(e\.toEdits\) o\.push\(\['acceptEdits', 'Yes, allow all edits during this session'\]\)/);
  const css = readFileSync(new URL("../public/coder.css", import.meta.url), "utf8");
  assert.match(css, /#gfApp \.cd-mode-btn\.is-default\{/);
  assert.match(css, /#gfApp \.cd-filecard-inline\{/);
});

test("ND7 a full disk before a command starts: the command is not started, in Claude Code's words; a volume with room says nothing", async () => {
  const S = await import("../container/server.mjs");
  const full = { blocks: 100n, bavail: 1n, bsize: 4096n };
  assert.match(S.diskFullBefore("/out", { statfs: () => full, probe: () => "ENOSPC" }), /^The command was not started: this computer.s disk is full \(ENOSPC\)/);
  assert.match(S.diskFullBefore("/out", { statfs: () => full, probe: () => "EDQUOT" }), /^The command was not started: the user.s disk quota is used up \(EDQUOT\)/);
  assert.equal(S.diskFullBefore("/out", { statfs: () => full, probe: () => "" }), null);
  let probed = false;
  assert.equal(S.diskFullBefore("/out", { statfs: () => ({ blocks: 100n, bavail: 100000n, bsize: 4096n }), probe: () => { probed = true; return "ENOSPC"; } }), null);
  assert.equal(probed, false, "no test write while there is room");
});

test("ND8 CODER_PYTHON_ENV activates a virtualenv before every command, as if activated before launch", async () => {
  const S = await import("../container/server.mjs");
  assert.equal(S.pythonEnvLine("", "/p"), "");
  assert.equal(S.pythonEnvLine(".venv", "/p"), "if [ -z \"$VIRTUAL_ENV\" ] && [ -r '/p/.venv'/bin/activate ]; then . '/p/.venv'/bin/activate >/dev/null 2>&1; fi\n");
  assert.match(S.pythonEnvLine("~/envs/py/", "/p"), /"\$HOME"\/'envs\/py'\/bin\/activate/);
  assert.equal(S.pythonEnvLine("a\nb", "/p"), "");
});

test("ND9 Read's result objects for hooks: a picture's image form and a PDF's pdf and parts forms", () => {
  const img = T.pictureFacts({ type: "image/png", data: "AAAA", w: 800, h: 600 }, 12345, { w: 1600, h: 1200 });
  assert.deepEqual(img, { type: "image", file: { base64: "AAAA", type: "image/png", originalSize: 12345, dimensions: { originalWidth: 1600, originalHeight: 1200, displayWidth: 800, displayHeight: 600 } } });
  const pdf = T.pdfFacts({ abs: "/p/a.pdf", bytes: Buffer.from("%PDF"), size: 4 });
  assert.deepEqual(pdf, { type: "pdf", file: { filePath: "/p/a.pdf", base64: Buffer.from("%PDF").toString("base64"), originalSize: 4 } });
  const parts = T.pdfFacts({ abs: "/p/a.pdf", size: 9, asked: true, count: 2, outputDir: "/tmp/coder-scratch/read-pages-x", firstPage: 3 });
  assert.deepEqual(parts, { type: "parts", file: { filePath: "/p/a.pdf", originalSize: 9, count: 2, outputDir: "/tmp/coder-scratch/read-pages-x" }, firstPage: 3 });
});

test("ND10 Artifact takes Claude Code's deprecated favicon and leaves it unused", () => {
  assert.ok(R.ARTIFACT_TOOL.function.parameters.properties.favicon);
  assert.equal(R.artifactInputProblem({ file_path: "a.html", favicon: "chart" }), "");
  assert.match(R.artifactInputProblem({ file_path: "a.html", favicon: "x".repeat(33) }), /favicon must be a string of 1 to 32/);
  assert.match(R.artifactInputProblem({ action: "list", favicon: "x" }), /only limit and scope/);
});

test("ND11 a feedback draft expires after the chat's cleanupPeriodDays when shorter than 30", async () => {
  const P = await import("../src/coder-plugins.mjs");
  const day = 24 * 60 * 60 * 1000;
  assert.equal(P.feedbackTtl({}), 30 * day);
  assert.equal(P.feedbackTtl({ keepDays: 7 }), 7 * day);
  assert.equal(P.feedbackTtl({ keepDays: 90 }), 30 * day);
  const store = new Map();
  const bucket = { get: async (k) => (store.has(k) ? { text: async () => store.get(k), json: async () => JSON.parse(store.get(k)) } : null), put: async (k, v) => { store.set(k, typeof v === "string" ? v : String(v)); } };
  const t0 = Date.UTC(2026, 10, 1);
  await P.queueFeedback(bucket, "u1", { title: "t", details: "d", keepDays: 2 }, "c1", t0);
  assert.equal((await P.readFeedback(bucket, "u1", t0 + day)).length, 1);
  assert.equal((await P.readFeedback(bucket, "u1", t0 + 3 * day)).length, 0);
});

test("ND12 Workflow: the built-in deep-research workflow runs by name; a saved one of that name wins", async () => {
  assert.ok(G.BUILTIN_WORKFLOWS["deep-research"].startsWith("export const meta = { name: 'deep-research'"));
  const first = await G.workflowStep({ script: G.BUILTIN_WORKFLOWS["deep-research"], args: "why is the sky blue", done: [] });
  assert.equal(first.status, "pending");
  assert.match(first.pending[0].prompt, /why is the sky blue/);
  const none = await G.workflowStep({ script: G.BUILTIN_WORKFLOWS["deep-research"], args: "", done: [] });
  assert.equal(none.status, "done");
  assert.deepEqual(none.result, { error: "give the question as args" });
  assert.match(G.WORKFLOW_TOOL.function.parameters.properties.name.description, /built-in workflow \(deep-research\)/);
});

test("ND13 Workflow: a run's results are saved on the chat's machine, so resumeFromRunId works from a later message; an unknown one has nothing to resume", async () => {
  const files = new Map();
  const k = { writeText: async (p, t) => { files.set(p, t); }, readText: async (p) => (files.has(p) ? { text: files.get(p) } : { error: "could not read " + p }) };
  const rec = { runId: "wf-3", script: "export const meta = { name: 'x', description: 'y' };\nreturn 1;", scriptPath: "", args: { a: 1 }, done: new Map([["k#0", { ok: "r" }]]) };
  assert.equal(await G.saveRun(k, rec, true), true);
  assert.equal(files.get(G.RUNS_DIR + "/last"), "3");
  assert.equal(await G.lastRunNo(k), 3);
  const back = await G.loadRun(k, "wf-3");
  assert.equal(back.script, rec.script);
  assert.deepEqual(back.args, { a: 1 });
  assert.deepEqual([...back.done], [["k#0", { ok: "r" }]]);
  assert.equal(await G.loadRun(k, "wf-9"), null);
  assert.equal(await G.loadRun(k, "../etc"), null);
  assert.match(G.WORKFLOW_TOOL.function.parameters.properties.resumeFromRunId.description, /later messages of the same chat/);
});

test("ND14 a subagent's permission card is passed through to the owner, tagged with its agent; its answer too", () => {
  const out = [];
  const e = G.taggedEmit((x) => out.push(x), "agent-1-", "look");
  e({ type: "permission", pid: "p1abc", id: "w1", tool: "write", why: "Do you want to make this edit to /a?" });
  e({ type: "permanswer", pid: "p1abc", choice: "yes" });
  assert.deepEqual(out[0], { type: "permission", pid: "p1abc", id: "agent-1-w1", tool: "write", agent: "look", why: "Its agent “look”: Do you want to make this edit to /a?" });
  assert.deepEqual(out[1], { type: "permanswer", pid: "p1abc", choice: "yes" });
  assert.match(G.AGENT_TOOL.function.description, /a step that needs the owner's OK shows the owner its card/);
});

test("ND15 SendUserFile: a picture sent with display render, or none, shows inline under its card in a Coder chat; attach doesn't", () => {
  const js = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  assert.match(js, /const fileInline = \(e, preview, ext\) => \(!GLOOPY && preview && !\/\^pdf\$\/i\.test\(ext\) && \(e\.display === 'render' \|\| e\.display === undefined\)/);
  assert.match(js, /function fileInlineHTML\(id, name, ext\)/);
});

test("ND16 a save keeps Coder's own worktrees under .claude/worktrees out of its \"Not saved\" line; other nested repositories are still named", () => {
  assert.equal(W.ownWorktreePath(".claude/worktrees/fix-a/"), true);
  assert.equal(W.ownWorktreePath(".claude/worktrees/team/fix-b"), true);
  assert.equal(W.ownWorktreePath(".claude/worktrees/"), false);
  assert.equal(W.ownWorktreePath(".claude/worktrees/../vendor/lib"), false);
  assert.equal(W.ownWorktreePath("vendor/lib/"), false);
  assert.equal(W.ownWorktreePath(".claude/other/x"), false);
  const src = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(src, /const left = k\.nested\.filter\(\(path\) => !ownWorktreePath\(path\)\)\.map/);
});
