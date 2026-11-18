// PROTECTED WRITES AND A "/" AT A PATH'S END, AS CLAUDE CODE'S (the owner, 2026-11-18: "match", to the three differences
// found while matching read, grep and glob; Claude Code 2.1.327's docs, program and own tools, tried on scratch files):
//   1. in Auto, a write, an edit or a notebook edit of a protected file goes to the checker, as Claude Code routes it to its
//      classifier ("Routed to the classifier, which decides"), shown it as Claude Code shows its classifier one ("<path>:
//      <content>"); in Accept edits, with an ask rule, with no checker, or in a job from GitHub, as before;
//   2. one that reaches a protected folder only through a link asks first, in every mode, never the checker, in Claude Code's
//      words ("… which is a sensitive file. <path> resolves through a symlink to <where it leads>.");
//   3. write and edit take the path as given, a full one keeping its "/": a file's path with a "/" at its end, or one through a
//      file, is the system's error ("ENOTDIR: not a directory, stat '…'"), even before the hooks; one that isn't there is made
//      without its "/".
// Coder's own chats; Gloopy's as they were (the owner, 2026-11-17: "Dont touch gloopy for now").
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const A = await import("../container/coder-agent.mjs");
const C = await import("../container/coder-checker.mjs");
const P = await import("../container/coder-perms.mjs");
const TOOLS = new URL("../container/coder-tools.mjs", import.meta.url).pathname;
const CHECKER_RE = /^You are the safety checker of Coder's auto mode/;

/** A project with a .git folder (no git needed), a .husky folder, a file, a folder, and a link `gl` to .git. */
function project() {
  const dir = mkdtempSync(join(tmpdir(), "protwrite-"));
  writeFileSync(join(dir, "notes.md"), "hi\n");
  mkdirSync(join(dir, "src"));
  mkdirSync(join(dir, ".git", "info"), { recursive: true });
  writeFileSync(join(dir, ".git", "HEAD"), "ref: refs/heads/main\n");
  mkdirSync(join(dir, ".husky"));
  symlinkSync(".git", join(dir, "gl"));
  const run = (req) => { const r = spawnSync(process.execPath, ["--no-warnings", TOOLS, Buffer.from(JSON.stringify(req)).toString("base64")], { cwd: dir, env: { ...process.env, CODER_CWD: dir }, encoding: "utf8", maxBuffer: 64 << 20 }); return { code: r.status, output: r.stdout.replace(/\n?\u0000?coder-facts[^\n]*\n?/, "\n").replace(/^\n/, "") }; };
  return { dir, run };
}
const said = (r) => r.output.replace(/\n$/, "");
const call = (name, args, id = "c1") => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });

/** One job: a scripted Grok, the tools run for real in a project, the checker answering `verdict`, the owner `answers`. */
async function job(steps0, extra = {}, { verdict = '{"decision":"allow"}', answers = ["yes"], before = null } = {}) {
  const { dir, run } = project();
  const more = before ? before(dir) : null;
  const steps = typeof steps0 === "function" ? steps0(dir, more) : steps0;
  const events = [], checks = [], reqs = [];
  let n = 0, k = 0;
  const r = await A.runCoder({
    send: async (req) => {
      if (req.messages && req.messages[0] && CHECKER_RE.test(String(req.messages[0].content || ""))) { checks.push(req); return { message: { role: "assistant", content: typeof verdict === "function" ? verdict(checks.length) : verdict }, usage: { in: 2, out: 1 } }; }
      return steps[Math.min(n++, steps.length - 1)];
    },
    exec: async (x) => { const tm = /coder-tools\.mjs (\S+)$/.exec(String(x.command)); if (!tm) return { code: 0, output: "ok\n" }; const q = tm[1] === "@REQUEST" ? JSON.parse(x.payload) : JSON.parse(Buffer.from(tm[1], "base64").toString("utf8")); reqs.push(q); return run(q); },
    emit: (e) => events.push(e), here: () => dir, root: dir, chatId: "shop-pw-" + Math.random().toString(36).slice(2, 8), where: (p) => (p.startsWith("/") ? p : dir + "/" + p),
    ...(answers ? { ask: async () => ({ choice: answers[Math.min(k++, answers.length - 1)] }) } : {}),
  }, { text: "go", mode: "auto", messages: [], ...extra });
  const told = (id) => (r.messages.find((m) => m.role === "tool" && m.tool_call_id === id) || {}).content;
  return { dir, more, r, events, checks, reqs, told, cards: events.filter((e) => e.type === "permission") };
}
const shown = (t) => t.checks.map((q) => q.messages.map((m) => String(m.content)).join("\n")).join("\n");

test("PW1 the checker is shown a write, an edit and a notebook edit as Claude Code shows its classifier one: \"<path>: <content>\", \"<path>: <new_string>\", \"<notebook_path> <edit_mode>: <new_source>\"", () => {
  assert.equal(C.actionShown("write", { path: ".husky/pre-commit", content: "npm test\n" }), "write: .husky/pre-commit: npm test\n");
  assert.equal(C.actionShown("edit", { path: ".git/config", old_string: "a", new_string: "b" }), "edit: .git/config: b");
  assert.equal(C.actionShown("notebook_edit", { notebook_path: ".vscode/n.ipynb", new_source: "x = 1" }), "notebook_edit: .vscode/n.ipynb replace: x = 1");
  assert.equal(C.actionShown("notebook_edit", { notebook_path: "n.ipynb", new_source: "", edit_mode: "delete" }), "notebook_edit: n.ipynb delete: ");
  assert.match(C.actionShown("write", { path: "a", content: "x".repeat(7000) }), /…\[1000 more characters\]$/);
});

test("PW2 in Auto, a write to a protected file goes to the checker, not to a card: allowed, written; blocked, refused in Claude Code's words; at auto mode's limit of blocks, the card", async () => {
  const w = [say("", [call("write", { file_path: ".git/info/exclude", content: "*.log\n" })]), say("Done.")];
  let t = await job(w, { checker: true });
  assert.equal(t.checks.length, 1, "judged by the checker");
  assert.match(shown(t), /THE ACTION TO JUDGE:\nwrite: \.git\/info\/exclude: \*\.log/);
  assert.equal(t.cards.length, 0, "no card");
  assert.equal(readFileSync(join(t.dir, ".git", "info", "exclude"), "utf8"), "*.log\n");
  t = await job(w, { checker: true }, { verdict: '{"decision":"block","rule":"Self-Modification","reason":"changes git settings"}' });
  assert.equal(t.cards.length, 0);
  assert.match(t.told("c1"), /Self-Modification/);
  assert.equal(existsSync(join(t.dir, ".git", "info", "exclude")), false, "blocked: not written");
  // An edit too.
  t = await job([say("", [call("write", { file_path: ".husky/pre-commit", content: "a\n" })]), say("", [call("edit", { file_path: ".husky/pre-commit", old_string: "a", new_string: "b" }, "c2")]), say("Done.")], { checker: true });
  assert.equal(t.checks.length, 2);
  assert.match(shown(t), /edit: \.husky\/pre-commit: b/);
  assert.equal(readFileSync(join(t.dir, ".husky", "pre-commit"), "utf8"), "b\n");
  // Three blocks in a row: the third falls back to the card (auto mode's limit), whose Yes writes it.
  const three = [say("", [call("write", { file_path: ".husky/a", content: "1\n" })]), say("", [call("write", { file_path: ".husky/b", content: "2\n" }, "c2")]), say("", [call("write", { file_path: ".husky/c", content: "3\n" }, "c3")]), say("Done.")];
  t = await job(three, { checker: true }, { verdict: '{"decision":"block","rule":"Self-Modification","reason":"hooks"}' });
  assert.equal(t.checks.length, 3);
  assert.equal(t.cards.length, 1, "the third asks");
  assert.deepEqual([existsSync(join(t.dir, ".husky", "a")), existsSync(join(t.dir, ".husky", "b")), readFileSync(join(t.dir, ".husky", "c"), "utf8")], [false, false, "3\n"]);
});

test("PW3 a protected write still asks, as before, in Accept edits, with no checker, with an ask rule, and in Gloopy's chats; in a job from GitHub it is refused", async () => {
  const w = [say("", [call("write", { file_path: ".git/info/exclude", content: "*.log\n" })]), say("Done.")];
  const why = (t) => "Coder requested permissions to edit " + t.dir + "/.git/info/exclude which is a sensitive file.";
  let t = await job(w, { mode: "acceptEdits", checker: true });
  assert.deepEqual([t.checks.length, t.cards.length, t.cards[0].why], [0, 1, why(t)]);
  assert.equal(readFileSync(join(t.dir, ".git", "info", "exclude"), "utf8"), "*.log\n", "Yes: written");
  t = await job(w, { checker: false });
  assert.deepEqual([t.checks.length, t.cards.length], [0, 1], "Auto with no checker: the card");
  t = await job(w, { checker: true, rules: { allow: [], deny: [], ask: ["Edit(.git/**)"] } });
  assert.deepEqual([t.checks.length, t.cards.length], [0, 1], "an ask rule asks");
  t = await job(w, { checker: true, github: true });
  assert.deepEqual([t.checks.length, t.told("c1")], [0, why(t)]);
  const { GLOOPY_TOOLS, GLOOPY_SYSTEM } = await import("../container/gloopy-agent.mjs");
  t = await job([say("", [call("write", { path: ".husky/pre-commit", content: "x\n" })]), say("Done.")], { checker: true, tools: GLOOPY_TOOLS, system: GLOOPY_SYSTEM, who: "Gloopy", nudges: false });
  assert.deepEqual([t.checks.filter((q) => /write: \.husky/.test(JSON.stringify(q.messages))).length, t.cards.length], [0, 1], "Gloopy's: its card, as before");
});

test("PW4 a write that reaches a protected folder only through a link asks first in every mode, never the checker, in Claude Code's words; Yes writes it, No leaves it; in a job from GitHub it is refused in those words", async () => {
  const w = [say("", [call("write", { file_path: "gl/info/exclude", content: "*.log\n" })]), say("Done.")];
  const why = (t) => "Coder requested permissions to edit " + t.dir + "/gl/info/exclude which is a sensitive file. " + t.dir + "/gl/info/exclude resolves through a symlink to " + t.dir + "/.git/info/exclude.";
  assert.equal(P.sensitiveViaWhy("/w/gl/x", "/w/.git/x"), "Coder requested permissions to edit /w/gl/x which is a sensitive file. /w/gl/x resolves through a symlink to /w/.git/x.");
  let t = await job(w, { checker: true });
  assert.deepEqual([t.checks.length, t.cards.length, t.cards[0].why], [0, 1, why(t)], "Auto: the card, not the checker");
  assert.equal(readFileSync(join(t.dir, ".git", "info", "exclude"), "utf8"), "*.log\n");
  t = await job(w, { mode: "acceptEdits" }, { answers: ["no"] });
  assert.equal(t.cards[0].why, why(t));
  assert.equal(existsSync(join(t.dir, ".git", "info", "exclude")), false, "No: not written");
  t = await job(w, { checker: true, github: true });
  assert.equal(t.told("c1"), why(t));
  assert.equal(existsSync(join(t.dir, ".git", "info", "exclude")), false);
  // (A link to a folder that isn't protected: no card, as before.)
  t = await job([say("", [call("write", { file_path: "notes2.md", content: "x\n" })]), say("Done.")], { mode: "acceptEdits" });
  assert.equal(t.cards.length, 0);
});

test("PW5 write and edit in Coder's own chats take the path as Claude Code's Write and Edit: a file's full path with a \"/\" at its end, or one through a file, is \"ENOTDIR: not a directory, stat '…'\"; one that isn't there is made without its \"/\"; Gloopy's chats as before", () => {
  const { dir, run } = project();
  const cc = (tool, args) => said(run({ tool, args, ctx: { cc: true } }));
  const old = (tool, args) => said(run({ tool, args }));
  const enotdir = (p) => "error: ENOTDIR: not a directory, stat '" + p + "'";
  assert.equal(cc("edit", { path: dir + "/notes.md/", old_string: "hi", new_string: "yo" }), enotdir(dir + "/notes.md/"));
  assert.equal(cc("write", { path: dir + "/notes.md/", content: "x\n" }), enotdir(dir + "/notes.md/"));
  assert.equal(cc("write", { path: dir + "/notes.md/x", content: "x\n" }), enotdir(dir + "/notes.md/x"));
  assert.equal(cc("edit", { path: dir + "/notes.md/x/", old_string: "", new_string: "y\n" }), enotdir(dir + "/notes.md/x/"));
  assert.equal(readFileSync(join(dir, "notes.md"), "utf8"), "hi\n", "nothing changed");
  assert.match(cc("write", { path: dir + "/new.txt/", content: "new\n" }), /^File created successfully at: new\.txt /);
  assert.equal(readFileSync(join(dir, "new.txt"), "utf8"), "new\n");
  assert.match(cc("write", { path: dir + "/sub/new4.txt/", content: "x\n" }), /^File created successfully at: sub\/new4\.txt /);
  assert.match(cc("edit", { path: dir + "/new3.txt/", old_string: "", new_string: "made\n" }), /^The file new3\.txt has been updated successfully\./);
  assert.equal(readFileSync(join(dir, "new3.txt"), "utf8"), "made\n");
  assert.equal(cc("edit", { path: dir + "/nope.txt/", old_string: "x", new_string: "y" }), "error: File does not exist. Note: your current working directory is " + dir + ".");
  assert.equal(cc("write", { path: dir + "/src/", content: "x\n" }), "error: src is a directory, not a file. To create a file inside it, include the file name in path.");
  assert.match(cc("write", { path: "short.txt/", content: "s\n" }), /^File created successfully at: short\.txt /, "a short one loses its / anyway");
  // Before the hooks too: the loop's check of a write (file_check, Coder's own chats only).
  assert.equal(said(run({ tool: "file_check", args: { tool: "write", args: { path: dir + "/notes.md/x" } }, ctx: { cc: true } })), enotdir(dir + "/notes.md/x"));
  assert.equal(said(run({ tool: "file_check", args: { tool: "edit", args: { path: dir + "/notes.md/", old_string: "hi", new_string: "yo" } }, ctx: { cc: true } })), enotdir(dir + "/notes.md/"));
  // Gloopy's: as before.
  assert.match(old("write", { path: dir + "/new5.txt/", content: "x\n" }), /^error: EISDIR: illegal operation on a directory, open /);
  assert.equal(old("write", { path: dir + "/notes.md/x", content: "x\n" }), "error: EEXIST: file already exists, mkdir '" + dir + "/notes.md'");
});

test("PW6 through Coder's loop: a write through a file is refused by its check before the hooks and any card, as Claude Code's Write refuses it before its prompt", async () => {
  const t = await job([say("", [call("write", { file_path: "notes.md/x", content: "x\n" })]), say("Done.")], { mode: "plan" });
  assert.equal(t.cards.length, 0, "no card first, even in Plan");
  assert.equal(t.told("c1"), "error: ENOTDIR: not a directory, stat '" + t.dir + "/notes.md/x'");
  assert.ok(t.reqs.some((q) => q.tool === "file_check" && q.ctx && q.ctx.cc === true), "the check before the hooks has Claude Code's ways");
});

/** A folder outside the project, and a link `out` to it from the project. */
function linkOut(dir) { const outside = mkdtempSync(join(tmpdir(), "pw-out-")); symlinkSync(outside, join(dir, "out")); return outside; }

test("PW7 a write inside the working folders that leads out of them through a link asks first in every mode (Auto too, never the checker), in Claude Code's words; Yes writes it there, No leaves it; an Edit allow rule for the path and where it leads asks nothing; refused in a job from GitHub, and under the write block; one named outside them is still refused; Gloopy's as before", async () => {
  const w = [say("", [call("write", { file_path: "out/x.txt", content: "x\n" })]), say("Done.")];
  const why = (t) => "Coder requested permissions to write to " + t.dir + "/out/x.txt, but you haven't granted it yet. " + t.dir + "/out/x.txt resolves through a symlink to " + t.more + "/x.txt, which is outside the allowed working directories.";
  assert.equal(P.outsideWriteWhy("/w/out/x", "/o/x"), "Coder requested permissions to write to /w/out/x, but you haven't granted it yet. /w/out/x resolves through a symlink to /o/x, which is outside the allowed working directories.");
  let t = await job(w, { mode: "acceptEdits" }, { before: linkOut });
  assert.deepEqual([t.cards.length, t.cards[0].why], [1, why(t)]);
  assert.equal(readFileSync(join(t.more, "x.txt"), "utf8"), "x\n", "Yes: written where the link leads");
  t = await job(w, { checker: true }, { before: linkOut });
  assert.deepEqual([t.checks.length, t.cards.length, t.cards[0].why], [0, 1, why(t)], "Auto: the card, never the checker");
  t = await job(w, { mode: "acceptEdits" }, { before: linkOut, answers: ["no"] });
  assert.equal(existsSync(join(t.more, "x.txt")), false, "No: not written");
  t = await job(w, { mode: "acceptEdits", rules: { allow: ["Edit(out/**)", "Edit(/" + tmpdir() + "/**)"], ask: [], deny: [] } }, { before: linkOut });
  assert.equal(t.cards.length, 0, "an allow rule covers the path and where it leads");
  assert.equal(readFileSync(join(t.more, "x.txt"), "utf8"), "x\n");
  t = await job(w, { mode: "acceptEdits", rules: { allow: ["Edit(out/**)"], ask: [], deny: [] } }, { before: linkOut });
  assert.equal(t.cards.length, 1, "a rule for the path alone does not");
  t = await job(w, { checker: true, github: true }, { before: linkOut });
  assert.equal(t.told("c1"), why(t));
  assert.equal(existsSync(join(t.more, "x.txt")), false);
  t = await job(w, { mode: "acceptEdits", writeBlock: true }, { before: linkOut });
  assert.equal(t.cards.length, 0);
  assert.match(t.told("c1"), /CODER_BLOCK_WRITES_OUTSIDE_WORKING_DIRECTORIES/);
  assert.equal(existsSync(join(t.more, "x.txt")), false, "the write block refuses it first");
  t = await job((dir, outside) => [say("", [call("write", { file_path: outside + "/direct.txt", content: "x\n" })]), say("Done.")], { mode: "acceptEdits" }, { before: linkOut });
  assert.equal(t.told("c1"), "error: that path is outside the project", "named outside: still refused");
  const { GLOOPY_TOOLS, GLOOPY_SYSTEM } = await import("../container/gloopy-agent.mjs");
  t = await job([say("", [call("write", { path: "out/x.txt", content: "x\n" })]), say("Done.")], { mode: "acceptEdits", tools: GLOOPY_TOOLS, system: GLOOPY_SYSTEM, who: "Gloopy", nudges: false }, { before: linkOut });
  assert.deepEqual([t.cards.length, t.told("c1")], [0, "error: that path leads outside the project"], "Gloopy's: as before");
});

test("PW8 in Plan, with its checker reviewing during planning: a write to a protected file goes to the checker (allowed: written without plan mode's card; blocked: refused); any other write asks as before; with Plan's checker off, the card", async () => {
  const w = [say("", [call("write", { file_path: ".git/info/exclude", content: "*.log\n" })]), say("Done.")];
  let t = await job(w, { mode: "plan", checker: true });
  assert.equal(t.checks.length, 1);
  assert.match(shown(t), /write: \.git\/info\/exclude: \*\.log/);
  assert.equal(t.cards.length, 0, "no card, not even plan mode's");
  assert.equal(readFileSync(join(t.dir, ".git", "info", "exclude"), "utf8"), "*.log\n");
  t = await job(w, { mode: "plan", checker: true }, { verdict: '{"decision":"block","rule":"Self-Modification","reason":"git settings"}' });
  assert.equal(t.cards.length, 0);
  assert.match(t.told("c1"), /Self-Modification/);
  assert.equal(existsSync(join(t.dir, ".git", "info", "exclude")), false);
  t = await job([say("", [call("write", { file_path: "notes2.md", content: "x\n" })]), say("Done.")], { mode: "plan", checker: true });
  assert.deepEqual([t.checks.length, t.cards.length], [0, 1], "another write: plan mode's card, as before");
  assert.match(String(t.cards[0].why), /while in plan mode/);
  t = await job(w, { mode: "plan", checker: true, checkerInPlan: false });
  assert.deepEqual([t.checks.length, t.cards.length], [0, 1], "Plan's checker off: the card");
});
