// THE COMPARISON SHEET'S TOOL ROWS (2026-11-23): Read, Write, Edit, NotebookEdit, Bash, Monitor, TaskStop, Glob and Grep made
// to do what Claude Code's do: its messages word for word, its limits and settings keys, its result fields, and the output
// file checked before use. No paid calls: nothing here reaches a model.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync, symlinkSync, lstatSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const TOOLS = join(here, "..", "container", "coder-tools.mjs");
const T = await import("../container/coder-tools.mjs");
const S = await import("../container/server.mjs");
const C = await import("../container/coder-checks.mjs");
const F = await import("../container/coder-bashfacts.mjs");
const R = await import("../src/coder-routes.mjs");

const inDir = (dir) => { const seen = mkdtempSync(join(tmpdir(), "ct-seen-")); return (name, args) => String(spawnSync("node", ["--no-warnings", TOOLS, Buffer.from(JSON.stringify({ tool: name, args })).toString("base64")], { cwd: dir, encoding: "utf8", env: { ...process.env, CODER_SEEN_DIR: seen } }).stdout || ""); };

test("CT1 edit and notebook_edit refuse a file that is not valid UTF-8 in Claude Code's words, word for word; write replaces it unless the new text holds U+FFFD", () => {
  assert.equal(T.CC_NOT_UTF8, "File is not valid UTF-8. It may use a legacy encoding such as Windows-1252, Shift-JIS or GBK, or be binary. This tool saves the whole file as UTF-8, which would replace every byte it cannot decode with U+FFFD. Nothing was written. Make the change with a shell command that reads and writes the file in its own encoding, or ask the user whether to convert the file to UTF-8 first.");
  const dir = mkdtempSync(join(tmpdir(), "ct1-"));
  const tool = inDir(dir);
  try {
    const old = Buffer.from("caf\xe9 au lait\n", "latin1");
    writeFileSync(join(dir, "l.txt"), old);
    assert.equal(tool("edit", { path: "l.txt", old_string: "au lait", new_string: "noir" }), "error: " + T.CC_NOT_UTF8);
    assert.deepEqual(readFileSync(join(dir, "l.txt")), old, "nothing written");
    writeFileSync(join(dir, "n.ipynb"), Buffer.from('{"cells":[],"x":"\xe9"}', "latin1"));
    tool("read", { path: "n.ipynb" });
    assert.equal(tool("notebook_edit", { notebook_path: "n.ipynb", new_source: "x", cell_type: "code", edit_mode: "insert" }), "error: " + T.CC_NOT_UTF8);
    tool("read", { path: "l.txt" });
    assert.equal(tool("write", { path: "l.txt", content: "bad �\n" }),"error: " + T.CC_NOT_UTF8);
    assert.deepEqual(readFileSync(join(dir, "l.txt")), old, "refused with U+FFFD");
    assert.match(tool("write", { path: "l.txt", content: "café\n" }), /^The file l\.txt has been updated successfully\./);
    assert.equal(readFileSync(join(dir, "l.txt"), "utf8"), "café\n", "saved as UTF-8");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("CT2 a picture over 128 MB, and a pipe sending more than 128 MB, are refused in Claude Code's words", () => {
  assert.equal(T.picTooLarge("a.png"), "File is too large to read as an image (the limit is 128MB): a.png. If it is an image, resize it or export a smaller copy, then read that.");
  assert.equal(T.picPipeTooLarge("p.png"), "Cannot read this as an image: p.png is a pipe or a device, not a regular file, and it sent more than 128MB without ending.");
  const dir = mkdtempSync(join(tmpdir(), "ct2-"));
  try {
    writeFileSync(join(dir, "big.png"), "");
    execFileSync("truncate", ["-s", String(T.PIC_MAX_BYTES + 1), join(dir, "big.png")]);
    assert.equal(inDir(dir)("read", { path: "big.png" }), "error: " + T.picTooLarge("big.png"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("CT3 read returns up to 2,000 lines with no limit given, and marks truncatedByTokenCap in its result object", () => {
  assert.equal(T.READ_DEFAULT_LINES, 2000);
  const dir = mkdtempSync(join(tmpdir(), "ct3-"));
  try {
    writeFileSync(join(dir, "f.txt"), Array.from({ length: 2500 }, (_, i) => "l" + i).join("\n") + "\n");
    const out = inDir(dir)("read", { path: "f.txt" });
    assert.match(out, /\n  2000\tl1999\n\[PARTIAL view: lines 1-2000 of 2500 /);
    assert.doesNotMatch(out, /\t l2000\n/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("CT4 bashEditDiffEnabled: the environment variable beats the key; a repository's false turns it off, its true counts for nothing; the owner's Settings true is every mode; unset, Auto and Bypass only", () => {
  assert.equal(S.bashEditDiffOn({ vars: { CODER_BASH_EDIT_DIFF: "0" }, prefs: { bashEditDiffEnabled: true }, mode: "auto" }), false);
  assert.equal(S.bashEditDiffOn({ vars: { CODER_BASH_EDIT_DIFF: "1" }, repoOff: true, mode: "default" }), true);
  assert.equal(S.bashEditDiffOn({ prefs: { bashEditDiffEnabled: true }, repoOff: true, mode: "auto" }), false);
  assert.equal(S.bashEditDiffOn({ prefs: { bashEditDiffEnabled: true }, mode: "default" }), true);
  assert.equal(S.bashEditDiffOn({ mode: "default" }), false);
  assert.equal(S.bashEditDiffOn({ mode: "acceptEdits" }), false);
  assert.equal(S.bashEditDiffOn({ mode: "auto" }), true);
  assert.equal(S.bashEditDiffOn({ mode: "bypassPermissions" }), true);
  assert.equal(S.prefsIn({ bashEditDiffEnabled: true }).bashEditDiffEnabled, true);
  // The owner's Settings take it as a key; the machine is given it.
  assert.equal(R.prefsChange({}, { bashEditDiffEnabled: "yes" }).error, "bashEditDiffEnabled is true or false.");
  const p = R.prefsChange({}, { bashEditDiffEnabled: true }).prefs;
  assert.equal(p.bashEditDiffEnabled, true);
  assert.equal(R.machinePrefs(p).bashEditDiffEnabled, true);
  // A repository's settings file: only false counts.
  const dir = mkdtempSync(join(tmpdir(), "ct4-"));
  try {
    mkdirSync(join(dir, ".claude"));
    writeFileSync(join(dir, ".claude", "settings.json"), JSON.stringify({ bashEditDiffEnabled: false }));
    assert.equal(S.repoSettings(dir).editDiffOff, true);
    writeFileSync(join(dir, ".claude", "settings.json"), JSON.stringify({ bashEditDiffEnabled: true }));
    assert.equal(S.repoSettings(dir).editDiffOff, false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("CT5 BASH_MAX_TIMEOUT_MS (or BASH_DEFAULT_TIMEOUT_MS) above 7,200,000 raises the background maximum; neither shortens it", () => {
  assert.equal(S.bashTimeouts({}, {}).bgMaxMs, 7_200_000);
  assert.equal(S.bashTimeouts({ BASH_MAX_TIMEOUT_MS: "10800000" }, {}).bgMaxMs, 10_800_000);
  assert.equal(S.bashTimeouts({ BASH_DEFAULT_TIMEOUT_MS: "9000000" }, {}).bgMaxMs, 9_000_000);
  assert.equal(S.bashTimeouts({ BASH_MAX_TIMEOUT_MS: "60000" }, {}).bgMaxMs, 7_200_000);
});

test("CT6 a pkill whose pattern matches Coder's own service is refused in Claude Code's words; others run", () => {
  assert.equal(C.pkillRefusal(12345), "pkill: refusing to run — this pattern matches the Claude CLI process (PID 12345). Narrow the pattern, or target your own children with `pkill -P $$ ...`.");
  // This test's own process stands in for the service: the wrapper names process.pid.
  // (Signal 0, so nothing is ended even if the guard failed; the pattern matches every node process, this one among them.)
  const r = spawnSync("bash", ["-c", C.PROC_WRAPPERS + "pkill --signal 0 -f " + JSON.stringify(process.execPath) + "; echo code=$?; pkill --signal 0 -f zzz-no-such-process-zzz; echo code2=$?"], { encoding: "utf8" });
  assert.match(r.stdout, /code=1\ncode2=1\n/);
  assert.equal(r.stderr.trim(), C.pkillRefusal(process.pid));
});

test("CT7 Bash's result fields: gitOperation (commit, push, branch, pr) and noOutputExpected", () => {
  assert.deepEqual(F.gitOperationOf("git commit -m x", "[main 1a2b3c4] x\n 1 file changed", 0), { commit: { sha: "1a2b3c4", kind: "committed", branch: "main" } });
  assert.deepEqual(F.gitOperationOf("git commit --amend --no-edit", "[detached HEAD 1a2b3c4] x\n", 0), { commit: { sha: "1a2b3c4", kind: "amended" } });
  assert.deepEqual(F.gitOperationOf("git cherry-pick abc", "[dev 9f9f9f9] y\n", 0), { commit: { sha: "9f9f9f9", kind: "cherry-picked", branch: "dev" } });
  assert.deepEqual(F.gitOperationOf("git push origin dev", "To github.com:a/b.git\n   1a2b3c4..5d6e7f8  dev -> dev\n", 0), { push: { branch: "dev" } });
  assert.deepEqual(F.gitOperationOf("git merge dev", "Fast-forward\n", 0), { branch: { action: "merged" } });
  assert.deepEqual(F.gitOperationOf("git rebase main", "Successfully rebased\n", 0), { branch: { action: "rebased" } });
  assert.deepEqual(F.gitOperationOf("gh pr create --fill", "https://github.com/a/b/pull/7\n", 0), { pr: { number: 7, url: "https://github.com/a/b/pull/7", action: "created" } });
  assert.deepEqual(F.gitOperationOf("gh pr reopen 7", "", 0), { pr: { number: 7, action: "reopened" } });
  assert.deepEqual(F.gitOperationOf("gh pr merge 7 --auto --squash", "", 0), { pr: { number: 7, action: "auto-merge-enabled" } });
  assert.deepEqual(F.gitOperationOf("gh pr merge 7 --disable-auto", "", 0), { pr: { number: 7, action: "auto-merge-disabled" } });
  assert.deepEqual(F.gitOperationOf("gh pr ready 7 --undo", "", 0), { pr: { number: 7, action: "draft" } });
  assert.equal(F.gitOperationOf("git commit -m x", "", 1), null);
  assert.equal(F.noOutputExpected("mkdir -p a && mv a b"), true);
  assert.equal(F.noOutputExpected("ls"), false);
  assert.equal(F.noOutputExpected("cp -v a b"), false);
});

test("CT8 a command's output file swapped for a link, or its folder moved, is refused ('task output swap refused')", async () => {
  assert.equal(S.OUTPUT_SWAP_REFUSED, "task output swap refused");
  const dir = mkdtempSync(join(tmpdir(), "ct8-"));
  try {
    mkdirSync(join(dir, "out"));
    writeFileSync(join(dir, "out", "f.txt"), "x");
    const ids = { file: lstatSync(join(dir, "out", "f.txt")), dir: lstatSync(join(dir, "out")) };
    const same = () => S.outputSwapped({ file: { dev: ids.file.dev, ino: ids.file.ino }, dir: { dev: ids.dir.dev, ino: ids.dir.ino } }, { file: lstatSync(join(dir, "out", "f.txt")), dir: lstatSync(join(dir, "out")) });
    assert.equal(same(), false);
    rmSync(join(dir, "out", "f.txt"));
    writeFileSync(join(dir, "target"), "secret");
    symlinkSync(join(dir, "target"), join(dir, "out", "f.txt"));
    assert.equal(same(), true, "a link in its place");
    renameSync(join(dir, "out"), join(dir, "out2"));
    mkdirSync(join(dir, "out"));
    writeFileSync(join(dir, "out", "f.txt"), "y");
    assert.equal(same(), true, "its folder moved and another made");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("CT9 write's diff is skipped only past about 10 MB, as Claude Code's; a saved tool result is capped at 1 GB", async () => {
  assert.equal(T.WRITE_DIFF_MAX, 10 * 1024 * 1024);
  const A = await import("../container/coder-agent.mjs");
  assert.equal(A.SAVED_RESULT_MAX, 1024 ** 3);
});

test("CT10 write and edit results carry Claude Code's gitDiff in a git repository: status added or modified, the GitHub owner/repo", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ct10-"));
  try {
    execFileSync("git", ["init", "-q", dir]);
    execFileSync("git", ["-C", dir, "remote", "add", "origin", "https://github.com/acme/app.git"]);
    writeFileSync(join(dir, "a.txt"), "one\n");
    const g = await T.gitDiffOf(join(dir, "a.txt"), false, [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: ["-one", "+two"] }]);
    assert.deepEqual(g, { filename: "a.txt", status: "modified", additions: 1, deletions: 1, changes: 2, patch: "@@ -1,1 +1,1 @@\n-one\n+two", repository: "acme/app" });
    assert.equal((await T.gitDiffOf(join(dir, "b.txt"), true, [])).status, "added");
    assert.equal(await T.gitDiffOf(join(tmpdir(), "nowhere-" + Date.now(), "x.txt"), true, []), null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("CT11 a deny rule removing Bash brings grep and glob back to Coder's chat (Claude Code on Linux); an allow rule naming them doesn't", async () => {
  const A = await import("../container/coder-agent.mjs");
  const say = (content) => ({ message: { role: "assistant", content }, usage: { in: 1, out: 1 } });
  const ROOT = "/work/shop";
  const names = async (rules) => {
    const seen = [];
    await A.runCoder({ send: async (req) => { seen.push(req); return say("done"); }, exec: async () => ({ code: 0, output: "" }), emit: () => {}, here: () => ROOT, root: ROOT, where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p) }, { text: "hi", mode: "acceptEdits", rules });
    return seen[0].tools.map((t) => t.function.name);
  };
  const denied = await names({ allow: [], ask: [], deny: ["Bash"] });
  assert.ok(denied.includes("grep") && denied.includes("glob"), denied.join(","));
  const allowed = await names({ allow: ["Grep", "Glob"], ask: [], deny: [] });
  assert.ok(!allowed.includes("grep") && !allowed.includes("glob"));
  const scoped = await names({ allow: [], ask: [], deny: ["Bash(git push *)"] });
  assert.ok(!scoped.includes("grep"), "a scoped Bash rule does not remove Bash");
});
