// READ, GREP AND GLOB AS CLAUDE CODE'S, CASE BY CASE (the owner, 2026-11-18: "match claude code", after the check of Claude
// Code's own tools in this session): in Coder's own chats, read says what Claude Code 2.1.327's Read says for a file that isn't
// there ("File does not exist. Note: your current working directory is …", with its "Did you mean …?"), a folder ("EISDIR:
// illegal operation on a directory, read '/etc'"; "/etc/" shows as "read '/etc//'") and a path through a file ("ENOTDIR: not a
// directory, open '…'"); and the .git folder is open to read, grep and glob, as to Claude Code's (its Read opens .git/HEAD; its
// Glob lists .git's files; its Grep searches a path in .git, and takes .git back with a glob of its own such as "*"). Writes
// into .git stay refused. Gloopy's chats keep Coder's earlier ways (the owner, 2026-11-17: "Dont touch gloopy for now").
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const A = await import("../container/coder-agent.mjs");
const T = await import("../container/coder-tools.mjs");
const TOOLS = new URL("../container/coder-tools.mjs", import.meta.url).pathname;

/** A project with a .git folder of its own (no git needed), a file, a folder; `cwd`: where the commands are, under it. */
function project(cwd = "") {
  const dir = mkdtempSync(join(tmpdir(), "readmatch-"));
  writeFileSync(join(dir, "notes.md"), "hi\n");
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "src", "a.ts"), "x\n");
  mkdirSync(join(dir, ".git", "logs"), { recursive: true });
  writeFileSync(join(dir, ".git", "HEAD"), "ref: refs/heads/main\n");
  writeFileSync(join(dir, ".git", "logs", "HEAD"), "0000 1111 a <a@b> 0 +0000\tcommit (initial): i\n");
  writeFileSync(join(dir, ".git", "config"), "[branch \"main\"]\n\tmerge = refs/heads/main\n");
  const base = cwd ? join(dir, cwd) : dir;
  if (cwd) mkdirSync(base, { recursive: true });
  const run = (req) => { const r = spawnSync(process.execPath, ["--no-warnings", TOOLS, Buffer.from(JSON.stringify(req)).toString("base64")], { cwd: dir, env: { ...process.env, CODER_CWD: base }, encoding: "utf8", maxBuffer: 64 << 20 }); return { code: r.status, output: r.stdout.replace(/\n?\u0000?coder-facts[^\n]*\n?/, "\n").replace(/^\n/, "") }; };
  return { dir, base, run };
}
const said = (r) => r.output.replace(/\n$/, "");

test("RM1 read's words in Coder's own chats (ctx.cc), Claude Code's Read's: a file that isn't there (its note, its Did you mean), a folder (EISDIR, a / at the end shown twice), a path through a file (ENOTDIR); Gloopy's chats keep Coder's earlier words", () => {
  const { dir, run } = project();
  const cc = (args, more = {}) => said(run({ tool: "read", args, ctx: { cc: true, ...more } }));
  const old = (args, more = {}) => said(run({ tool: "read", args, ...(Object.keys(more).length ? { ctx: more } : {}) }));
  const note = "File does not exist. Note: your current working directory is " + dir + ".";
  assert.equal(cc({ path: "nope.md" }), "error: " + note);
  assert.equal(cc({ path: "notes.txt" }), "error: " + note + " Did you mean notes.md?", "a file beside it with another ending, by its name");
  assert.equal(cc({ path: "src" }), "error: EISDIR: illegal operation on a directory, read '" + dir + "/src'");
  assert.equal(cc({ path: dir + "/src/" }), "error: EISDIR: illegal operation on a directory, read '" + dir + "/src//'", "as Claude Code's: '/etc/' is read '/etc//'");
  assert.equal(cc({ path: "src/" }), "error: EISDIR: illegal operation on a directory, read '" + dir + "/src'", "a short one is taken without its / (Claude Code: '../' is read '…/coder')");
  assert.equal(cc({ path: "." }), "error: EISDIR: illegal operation on a directory, read '" + dir + "'");
  assert.equal(cc({ path: "/" }, { outside: true }), "error: EISDIR: illegal operation on a directory, read '/'");
  assert.equal(cc({ path: "notes.md/x" }), "error: ENOTDIR: not a directory, open '" + dir + "/notes.md/x'");
  assert.equal(cc({ path: "/etc/no-such-file-here" }, { outside: true }), "error: " + note, "outside, once allowed: the same words");
  assert.equal(cc({ path: "nope/x.md" }), "error: " + note, "a folder that isn't there either");
  assert.match(cc({ path: "notes.md" }), /^1\thi/, "a file is read as before");
  // Gloopy's: as before.
  assert.equal(old({ path: "nope.md" }), "error: no such file: nope.md. Note: your current working directory is " + dir + ".");
  assert.equal(old({ path: "src" }), "error: " + dir + "/src is a folder, not a file: list what is in it with glob, or a command such as ls");
  assert.equal(old({ path: "notes.md/x" }), "error: no such file: notes.md/x. Note: your current working directory is " + dir + ".");
  assert.equal(old({ path: "/etc/no-such-file-here" }, { outside: true }), "error: no such file: /etc/no-such-file-here. Note: your current working directory is " + dir + ".");
  // (Only for read, grep and glob: another tool given the flag keeps its words.)
  assert.deepEqual([...T.CC_TOOLS].sort(), ["glob", "grep", "read"]);
  assert.equal(T.readFolder("/etc"), "EISDIR: illegal operation on a directory, read '/etc'");
  assert.equal(T.readFolder("/etc/"), "EISDIR: illegal operation on a directory, read '/etc//'");
  assert.equal(T.readFolder("/"), "EISDIR: illegal operation on a directory, read '/'");
});

test("RM2 the Did you mean of Claude Code's Read: the same path under the folder the commands are in, when one under its parent isn't there", () => {
  const { dir, base, run } = project("app");
  writeFileSync(join(base, "x.md"), "y\n");
  assert.equal(said(run({ tool: "read", args: { path: dir + "/x.md" }, ctx: { cc: true } })), "error: File does not exist. Note: your current working directory is " + base + ". Did you mean " + base + "/x.md?");
});

test("RM3 the .git folder in Coder's own chats, as Claude Code's tools: read opens .git/HEAD; grep searches a path in .git, leaves .git out of a folder's search unless a glob of the call's own takes it back; glob lists .git's files; writes into .git stay refused; Gloopy's chats refuse it as before", () => {
  const { run } = project();
  const cc = (tool, args) => said(run({ tool, args, ctx: { cc: true } }));
  const old = (tool, args) => said(run({ tool, args }));
  assert.equal(cc("read", { path: ".git/HEAD" }), "1\tref: refs/heads/main\n2\t");
  assert.equal(cc("grep", { pattern: "ref", path: ".git/HEAD", output_mode: "content" }), "1:ref: refs/heads/main");
  assert.equal(cc("grep", { pattern: "refs/heads" }), "No files found", "a folder's search leaves .git out (Claude Code's version-control folders)");
  assert.equal(cc("grep", { pattern: "refs/heads", glob: "*" }).split("\n").slice(1).sort().join("\n"), ".git/HEAD\n.git/config", "its own glob takes .git back, as Claude Code's");
  assert.equal(cc("grep", { pattern: "refs/heads", path: ".git" }).split("\n").slice(1).sort().join("\n"), ".git/HEAD\n.git/config");
  assert.equal(cc("glob", { pattern: "**/HEAD" }).split("\n").sort().join("\n"), ".git/HEAD\n.git/logs/HEAD");
  assert.equal(cc("glob", { pattern: "HEAD", path: ".git" }).split("\n").sort().join("\n"), ".git/HEAD\n.git/logs/HEAD", "as Claude Code's Glob \"HEAD\" in .git");
  assert.equal(said(run({ tool: "write", args: { path: ".git/hooks/pre-commit", content: "x" }, ctx: { cc: true } })), "error: the .git folder is off limits", "a write: never");
  assert.equal(said(run({ tool: "edit", args: { path: ".git/config", old_string: "main", new_string: "x" }, ctx: { cc: true } })), "error: the .git folder is off limits");
  // Gloopy's: as before.
  assert.equal(old("read", { path: ".git/HEAD" }), "error: the .git folder is off limits");
  assert.equal(old("grep", { pattern: "ref", path: ".git/HEAD" }), "error: the .git folder is off limits");
  assert.equal(old("grep", { pattern: "refs/heads", glob: "*" }), "No files found");
  assert.equal(old("glob", { pattern: "**/HEAD" }), "No files found");
});

const call = (name, args, id = "c1") => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
/** One job with a scripted Grok, its file tools run for real in the project; the requests the tools script got. */
async function job(steps, extra = {}) {
  const { dir, run } = project();
  const reqs = [];
  let n = 0;
  const r = await A.runCoder({
    send: async () => steps[Math.min(n++, steps.length - 1)],
    exec: async (x) => { const tm = /coder-tools\.mjs (\S+)$/.exec(String(x.command)); if (!tm) return { code: 0, output: "ok\n" }; const q = tm[1] === "@REQUEST" ? JSON.parse(x.payload) : JSON.parse(Buffer.from(tm[1], "base64").toString("utf8")); reqs.push(q); return run(q); },
    emit: () => {}, here: () => dir, root: dir, chatId: "shop-rm", where: (p) => (p.startsWith("/") ? p : dir + "/" + p),
  }, { text: "look around", mode: "auto", messages: [], ...extra });
  const told = (id) => (r.messages.find((m) => m.role === "tool" && m.tool_call_id === id) || {}).content;
  return { dir, r, reqs, told };
}

test("RM4 through Coder's loop: its own chats get Claude Code's ways (ctx.cc for read, grep and glob, the same request when it is started early, so it runs once); Gloopy's chats don't", async () => {
  const steps = [say("", [call("read", { file_path: "src" }), call("read", { file_path: "nope.md" }, "c2"), call("read", { file_path: ".git/HEAD" }, "c3"), call("glob", { pattern: "**/HEAD" }, "c4")]), say("Done.")];
  let t = await job(steps);
  assert.equal(t.told("c1"), "error: EISDIR: illegal operation on a directory, read '" + t.dir + "/src'");
  assert.equal(t.told("c2"), "error: File does not exist. Note: your current working directory is " + t.dir + ".");
  assert.match(t.told("c3"), /^1\tref: refs\/heads\/main/);
  assert.match(t.told("c4"), /\.git\/HEAD/);
  const runs = t.reqs.filter((q) => ["read", "glob"].includes(q.tool));
  assert.equal(runs.length, 4, "each run once: the early run's request is its turn's");
  assert.ok(runs.every((q) => q.ctx && q.ctx.cc === true), JSON.stringify(runs.map((q) => q.ctx)));
  const { GLOOPY_TOOLS, GLOOPY_SYSTEM } = await import("../container/gloopy-agent.mjs");
  t = await job(steps, { tools: GLOOPY_TOOLS, system: GLOOPY_SYSTEM, who: "Gloopy", nudges: false });
  assert.equal(t.told("c1"), "error: " + t.dir + "/src is a folder, not a file: list what is in it with glob, or a command such as ls");
  assert.match(t.told("c2"), /^error: no such file: nope\.md\./);
  assert.equal(t.told("c3"), "error: the .git folder is off limits");
  assert.ok(t.reqs.every((q) => !(q.ctx && q.ctx.cc)), "never for Gloopy");
});

test("RM5 an @-mention in Coder's own chats reads as Claude Code's Read (ctx.cc): a folder, told by EISDIR, is listed; a file that isn't there, or a path through a file, is left alone; Gloopy's earlier words still understood", async () => {
  const { dir, run } = project();
  const exec = async (x) => { const tm = /coder-tools\.mjs (\S+)$/.exec(String(x.command)); return run(JSON.parse(Buffer.from(tm[1], "base64").toString("utf8"))); };
  const deps = { exec, here: () => dir, root: dir, where: (p) => (p.startsWith("/") ? p : dir + "/" + p) };
  for (const cc of [true, false]) {
    const rows = [];
    const note = await A.mentionNote(deps, ["src", "nope.md", "notes.md/x", "notes.md"], { emit: (e) => rows.push(e), cc });
    const text = JSON.stringify(note);
    assert.match(text, /src\/ \(a folder: what is in it\)/, "cc " + cc);
    assert.match(text, /a\.ts/);
    assert.doesNotMatch(text, /nope\.md|notes\.md\/x/, "left alone");
    assert.match(text, /notes\.md/);
    assert.deepEqual(rows.filter((e) => e.type === "bash").map((e) => e.verb), ["Listed directory", "Read"]);
  }
});
