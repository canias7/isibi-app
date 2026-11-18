// READ, GREP AND GLOB AS CLAUDE CODE'S, CASE BY CASE (the owner, 2026-11-18: "match claude code", after the check of Claude
// Code's own tools in this session): in Coder's own chats, read says what Claude Code 2.1.327's Read says for a file that isn't
// there ("File does not exist. Note: your current working directory is …", with its "Did you mean …?"), a folder ("EISDIR:
// illegal operation on a directory, read '/etc'"; "/etc/" shows as "read '/etc//'") and a path through a file ("ENOTDIR: not a
// directory, open '…'"); and the .git folder is open to read, grep and glob, as to Claude Code's (its Read opens .git/HEAD; its
// Glob lists .git's files; its Grep searches a path in .git, and takes .git back with a glob of its own such as "*").
// Then (the owner, 2026-11-18: "match"): read opens a file named with a "/" at its end, and a Mac screenshot's other spelling
// (the narrow no-break space before AM or PM); Grep and Glob give the system's words for a path through a file ("ENOTDIR: not
// a directory, stat '…'"), a full path keeping its "/"; and a write into .git is asked about first (a protected folder, "…
// which is a sensitive file.") and then made, where Coder's tools had refused it whatever the answer. Gloopy's chats keep
// Coder's earlier ways (the owner, 2026-11-17: "Dont touch gloopy for now").
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync, copyFileSync } from "node:fs";
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
  // (Only for read, grep and glob, and write, edit and notebook_edit for the .git folder, RM8: another tool given the flag keeps
  // its ways.)
  assert.deepEqual([...T.CC_TOOLS].sort(), ["edit", "glob", "grep", "notebook_edit", "read", "write"]);
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
  // (A write or an edit there: refused without the flag; with it, Coder's loop has asked first, RM9.)
  assert.equal(said(run({ tool: "write", args: { path: ".git/hooks/pre-commit", content: "x" } })), "error: the .git folder is off limits");
  assert.equal(said(run({ tool: "edit", args: { path: ".git/config", old_string: "main", new_string: "x" } })), "error: the .git folder is off limits");
  // Gloopy's: as before.
  assert.equal(old("read", { path: ".git/HEAD" }), "error: the .git folder is off limits");
  assert.equal(old("grep", { pattern: "ref", path: ".git/HEAD" }), "error: the .git folder is off limits");
  assert.equal(old("grep", { pattern: "refs/heads", glob: "*" }), "No files found");
  assert.equal(old("glob", { pattern: "**/HEAD" }), "No files found");
});

const call = (name, args, id = "c1") => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
/** One job with a scripted Grok, its file tools run for real in the project; the requests the tools script got. */
async function job(steps0, extra = {}, { answers = null, before = null } = {}) {
  const { dir, run } = project();
  if (before) before(dir);
  // (Steps that name the project's own folder are made from it.)
  const steps = typeof steps0 === "function" ? steps0(dir) : steps0;
  const reqs = [], events = [], cards = [];
  let n = 0, k = 0;
  const r = await A.runCoder({
    send: async () => steps[Math.min(n++, steps.length - 1)],
    exec: async (x) => { const tm = /coder-tools\.mjs (\S+)$/.exec(String(x.command)); if (!tm) return { code: 0, output: "ok\n" }; const q = tm[1] === "@REQUEST" ? JSON.parse(x.payload) : JSON.parse(Buffer.from(tm[1], "base64").toString("utf8")); reqs.push(q); return run(q); },
    emit: (e) => events.push(e), here: () => dir, root: dir, chatId: "shop-rm", where: (p) => (p.startsWith("/") ? p : dir + "/" + p),
    ...(answers ? { ask: async (card) => { cards.push(card); return { choice: answers[Math.min(k++, answers.length - 1)] }; } } : {}),
  }, { text: "look around", mode: "auto", messages: [], ...extra });
  const told = (id) => (r.messages.find((m) => m.role === "tool" && m.tool_call_id === id) || {}).content;
  return { dir, r, reqs, told, events, cards: events.filter((e) => e.type === "permission") };
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

/** The picture a Mac names its screenshot with (the narrow no-break space before AM), and one with a plain space. */
const NB = "\u202F";
function shots(dir) {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAACgAAAAeAQMAAABkE86eAAAAA1BMVEX/AAAZ4gk3AAAADElEQVQI12NgGHoAAAC0AAFecZC/AAAAAElFTkSuQmCC", "base64");
  writeFileSync(join(dir, "Screenshot 2026-11-18 at 9.41.03" + NB + "AM.png"), png);
  writeFileSync(join(dir, "Shot 2026-11-18 at 9.41.03 PM.png"), png);
  writeFileSync(join(dir, "Pic 2026-11-18 at 9.41.03" + NB + "AM.jpg"), png);
}

test("RM6 read in Coder's own chats, as Claude Code's Read: a file named in full with a \"/\" at its end is that file; a Mac screenshot named with the other space before AM or PM is found (.png, AM and PM in capitals); Gloopy's chats as before", () => {
  const { dir, run } = project();
  shots(dir);
  const cc = (p) => run({ tool: "read", args: { path: p }, ctx: { cc: true } }).output;
  const old = (p) => run({ tool: "read", args: { path: p } }).output;
  assert.match(cc(dir + "/notes.md/"), /^1\thi/);
  assert.match(cc(dir + "/notes.md//"), /^1\thi/);
  assert.match(cc("notes.md/"), /^1\thi/, "a short one loses its / anyway");
  assert.equal(said({ output: cc(dir + "/src/") }), "error: EISDIR: illegal operation on a directory, read '" + dir + "/src//'", "a folder keeps it");
  assert.match(cc("Screenshot 2026-11-18 at 9.41.03 AM.png"), /Picture: Screenshot 2026-11-18 at 9\.41\.03\u202FAM\.png \(40×30, PNG/, "a plain space asked, the Mac's found");
  assert.match(cc("Shot 2026-11-18 at 9.41.03" + NB + "PM.png"), /Picture: Shot 2026-11-18 at 9\.41\.03 PM\.png/, "and the other way");
  assert.match(cc(dir + "/Screenshot 2026-11-18 at 9.41.03 AM.png"), /Picture: /, "by its full path too");
  const note = "error: File does not exist. Note: your current working directory is " + dir + ".";
  assert.equal(said({ output: cc("Screenshot 2026-11-18 at 9.41.03 am.png") }), note, "am in small letters: not swapped");
  assert.equal(said({ output: cc("Pic 2026-11-18 at 9.41.03 AM.jpg") }), note, ".png only");
  assert.equal(T.screenshotAlt("/a/Screenshot 1 at 9.41.03 AM.png"), "/a/Screenshot 1 at 9.41.03" + NB + "AM.png");
  assert.equal(T.screenshotAlt("/a/S at 1" + NB + "PM.png"), "/a/S at 1 PM.png");
  assert.equal(T.screenshotAlt("/a/notes.md"), "");
  // Gloopy's: as before.
  assert.equal(said({ output: old(dir + "/notes.md/") }), "error: no such file: notes.md. Note: your current working directory is " + dir + ".");
  assert.match(old("Screenshot 2026-11-18 at 9.41.03 AM.png"), /^error: no such file: /);
});

test("RM7 grep and glob in Coder's own chats, as Claude Code's: a path through a file, or a file's full path with a \"/\" at its end, is the system's error (\"ENOTDIR: not a directory, stat '…'\"); a short one loses its \"/\" (grep searches the file; glob: \"Path is not a directory\"); one that isn't there as before; Gloopy's chats as before", () => {
  const { dir, run } = project();
  const cc = (tool, args) => said(run({ tool, args, ctx: { cc: true } }));
  const old = (tool, args) => said(run({ tool, args }));
  const enotdir = (p) => "error: ENOTDIR: not a directory, stat '" + p + "'";
  assert.equal(cc("grep", { pattern: "hi", path: dir + "/notes.md/" }), enotdir(dir + "/notes.md/"));
  assert.equal(cc("grep", { pattern: "hi", path: "notes.md/x" }), enotdir(dir + "/notes.md/x"));
  assert.equal(cc("glob", { pattern: "*", path: dir + "/notes.md/" }), enotdir(dir + "/notes.md/"));
  assert.equal(cc("glob", { pattern: "*", path: "notes.md/x" }), enotdir(dir + "/notes.md/x"));
  assert.equal(cc("grep", { pattern: "hi", path: "notes.md/" }), "Found 1 file\nnotes.md");
  assert.equal(cc("glob", { pattern: "*", path: "notes.md/" }), "error: Path is not a directory: notes.md/");
  assert.equal(cc("glob", { pattern: "*.ts", path: dir + "/src/" }), "src/a.ts", "a folder's full path with its / is searched");
  assert.equal(cc("grep", { pattern: "hi", path: "nope/" }), "error: Path does not exist: nope/. Note: your current working directory is " + dir + ".");
  assert.equal(cc("glob", { pattern: "*", path: "nope/x" }), "error: Directory does not exist: nope/x. Note: your current working directory is " + dir + ".");
  // Gloopy's: as before.
  assert.equal(old("grep", { pattern: "hi", path: dir + "/notes.md/" }), "Found 1 file\nnotes.md");
  assert.equal(old("grep", { pattern: "hi", path: "notes.md/x" }), "error: Path does not exist: notes.md/x. Note: your current working directory is " + dir + ".");
  assert.equal(old("glob", { pattern: "*", path: "notes.md/x" }), "error: Directory does not exist: notes.md/x. Note: your current working directory is " + dir + ".");
});

test("RM8 write, edit and notebook_edit into .git with Coder's loop's flag (after its protected-folder card): made; without it (Gloopy's chats), refused as before", () => {
  const { dir, run } = project();
  const cc = (tool, args) => said(run({ tool, args, ctx: { cc: true } }));
  assert.match(cc("write", { path: ".git/info/exclude", content: "*.log\n" }), /^File created successfully at: \.git\/info\/exclude/);
  assert.equal(readFileSync(join(dir, ".git", "info", "exclude"), "utf8"), "*.log\n");
  assert.match(cc("read", { path: ".git/config" }), /merge = refs\/heads\/main/);
  assert.match(cc("edit", { path: ".git/config", old_string: "refs/heads/main", new_string: "refs/heads/dev" }), /has been updated successfully/);
  assert.match(readFileSync(join(dir, ".git", "config"), "utf8"), /refs\/heads\/dev/);
  assert.equal(said(run({ tool: "write", args: { path: ".git/hooks/pre-commit", content: "x" } })), "error: the .git folder is off limits");
  assert.equal(existsSync(join(dir, ".git", "hooks", "pre-commit")), false);
  assert.equal(said(run({ tool: "lsp", args: { operation: "hover", filePath: ".git/config", line: 1, character: 1 }, ctx: { cc: true } })), "error: the .git folder is off limits", "the flag is only for read, grep, glob, write, edit and notebook_edit");
});

test("RM9 through Coder's loop: a write into .git asks first in Claude Code's words (\"… which is a sensitive file.\"), then is made; No leaves it; in a job from GitHub refused in those words; a trailing \"/\", a screenshot's other space and grep's ENOTDIR as above; Gloopy's chats refuse .git as before", async () => {
  const w = [say("", [call("write", { file_path: ".git/info/exclude", content: "*.log\n" })]), say("Done.")];
  let t = await job(w, { mode: "acceptEdits" }, { answers: ["yes"] });
  assert.equal(t.cards.length, 1);
  assert.equal(t.cards[0].why, "Coder requested permissions to edit " + t.dir + "/.git/info/exclude which is a sensitive file.");
  assert.match(t.told("c1"), /^File created successfully at: \.git\/info\/exclude/);
  assert.equal(readFileSync(join(t.dir, ".git", "info", "exclude"), "utf8"), "*.log\n");
  t = await job(w, { mode: "acceptEdits" }, { answers: ["no"] });
  assert.equal(existsSync(join(t.dir, ".git", "info", "exclude")), false, "No: not written");
  t = await job(w, { mode: "auto", github: true });
  assert.equal(t.told("c1"), "Coder requested permissions to edit " + t.dir + "/.git/info/exclude which is a sensitive file.");
  assert.equal(existsSync(join(t.dir, ".git", "info", "exclude")), false);
  t = await job((dir) => [say("", [call("read", { file_path: dir + "/notes.md/" }), call("read", { file_path: "Screenshot 2026-11-18 at 9.41.03 AM.png" }, "c2"), call("grep", { pattern: "hi", path: dir + "/notes.md/" }, "c3"), call("grep", { pattern: "hi", path: "notes.md/x" }, "c4")]), say("Done.")], {}, { before: shots });
  assert.match(t.told("c1"), /^1\thi/);
  assert.match(String(t.told("c2")), /Screenshot 2026-11-18 at 9\.41\.03\u202FAM\.png/);
  assert.equal(t.told("c3"), "error: ENOTDIR: not a directory, stat '" + t.dir + "/notes.md/'", "the permission check's view of the path and the search's agree");
  assert.equal(t.told("c4"), "error: ENOTDIR: not a directory, stat '" + t.dir + "/notes.md/x'");
  const { GLOOPY_TOOLS, GLOOPY_SYSTEM } = await import("../container/gloopy-agent.mjs");
  t = await job(w, { mode: "acceptEdits", tools: GLOOPY_TOOLS, system: GLOOPY_SYSTEM, who: "Gloopy", nudges: false }, { answers: ["yes"] });
  assert.equal(t.told("c1"), "error: the .git folder is off limits");
  assert.equal(existsSync(join(t.dir, ".git", "info", "exclude")), false);
});
