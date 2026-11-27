// FIVE PLACES CODER DIFFERED FROM CLAUDE CODE (2026-11-27): an edit or write of a file changed since it was read; the zip
// limits (a Zip64 archive's real entry count); a null byte in a path, in Claude Code's words, and the text \u0000 standing
// for one; what PostToolUse hooks get from a picture or PDF read; ExitPlanMode's planWasEdited with no plan file.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const T = await import("../container/coder-tools.mjs");
const S = await import("../container/coder-search.mjs");
const M = await import("../src/coder-marketplace.mjs");
const A = await import("../container/coder-agent.mjs");
const H = await import("../container/coder-hooks.mjs");
const toolsScript = new URL("../container/coder-tools.mjs", import.meta.url).pathname;
const NUL = " cannot contain null bytes (\\0). Remove the null byte and try again.";

/** The tools script run for real in `dir`, following files in `follow`. */
const runner = (dir, follow) => (name, args = {}) => {
  try { return execFileSync("node", ["--no-warnings", toolsScript, Buffer.from(JSON.stringify({ tool: name, args })).toString("base64")], { cwd: dir, encoding: "utf8", env: { ...process.env, CODER_SEEN_DIR: follow } }); } catch (e) { return String(e.stdout || ""); }
};

test("DA1 edit and write refuse a file changed since it was read, in Claude Code's words, even where the edit would apply and after the note that shows the change; a read again lets them through", async () => {
  assert.equal(T.WRITE_CHANGED, "File has been modified since read, either by the user or by a linter. Read it again before attempting to write it");
  const dir = await mkdtemp(join(tmpdir(), "cc-da1-")), follow = await mkdtemp(join(tmpdir(), "cc-da1-f-"));
  const tool = runner(dir, follow);
  const CHANGED = "error: " + T.WRITE_CHANGED + ".";
  await writeFile(join(dir, "f"), "aa\n");
  tool("read", { path: "f" });
  await writeFile(join(dir, "f"), "aa\nzz\n"); // as `echo zz >> f`
  assert.equal(tool("edit", { path: "f", old_string: "aa", new_string: "bb" }), CHANGED, "the old text is there once: still refused");
  assert.equal(tool("write", { path: "f", content: "new\n" }), CHANGED);
  assert.equal(await readFile(join(dir, "f"), "utf8"), "aa\nzz\n", "nothing written");
  // The note after the round (`changed`, then `shown`) is no read.
  JSON.parse(tool("changed", {}));
  tool("changed", { shown: ["f"] });
  assert.equal(tool("edit", { path: "f", old_string: "aa", new_string: "bb" }), CHANGED);
  assert.doesNotMatch(tool("edit", { path: "f", old_string: "aa", new_string: "bb" }), /file state is current/);
  // Read again: allowed.
  tool("read", { path: "f" });
  assert.match(tool("edit", { path: "f", old_string: "aa", new_string: "bb" }), /^The file f has been updated successfully\./);
  assert.equal(await readFile(join(dir, "f"), "utf8"), "bb\nzz\n");
});

/** A zip with just its end records: a Zip64 end record of `n` entries, its locator, and the old end record (count 0xffff). */
function zip64Tail(n) {
  const z = Buffer.alloc(56 + 20 + 22);
  z.writeUInt32LE(0x06064b50, 0); z.writeBigUInt64LE(44n, 4); z.writeBigUInt64LE(BigInt(n), 24); z.writeBigUInt64LE(BigInt(n), 32); z.writeBigUInt64LE(0n, 40); z.writeBigUInt64LE(0n, 48);
  z.writeUInt32LE(0x07064b50, 56); z.writeBigUInt64LE(0n, 64); z.writeUInt32LE(1, 72);
  z.writeUInt32LE(0x06054b50, 76); z.writeUInt16LE(0xffff, 84); z.writeUInt16LE(0xffff, 86); z.writeUInt32LE(0xffffffff, 88); z.writeUInt32LE(0xffffffff, 92);
  return new Uint8Array(z);
}
/** A one-entry zip whose directory says it unpacks to `usize` bytes. */
function zipOf(usize) {
  const name = Buffer.from("a.txt"), data = Buffer.from("x");
  const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt32LE(1, 18); lh.writeUInt32LE(usize, 22); lh.writeUInt16LE(name.length, 26);
  const cd = Buffer.alloc(46); cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt32LE(1, 20); cd.writeUInt32LE(usize, 24); cd.writeUInt16LE(name.length, 28); cd.writeUInt32LE(0, 42);
  const off = 30 + name.length + data.length;
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(46 + name.length, 12); end.writeUInt32LE(off, 16);
  return new Uint8Array(Buffer.concat([lh, name, data, cd, name, end]));
}

test("DA2 the archive limits (Claude Code's plugin download limits, where Coder installs a plugin's zip): a Zip64 archive's real count is read, so more than 100,000 entries is refused; 50 times its size refused; read of a zip stays binary, as Claude Code's Read", async () => {
  assert.equal(M.zipEntries(zip64Tail(100_001)).error, "the archive has more than 100,000 files and folders");
  assert.deepEqual(M.zipEntries(zip64Tail(0)), [], "a Zip64 archive within the limit is read");
  assert.equal(M.zipEntries(zipOf(100_000)).error, "the archive unpacks to more than 50 times its size");
  assert.equal(M.zipEntries(zipOf(1)).length, 1);
  const dir = await mkdtemp(join(tmpdir(), "cc-da2-"));
  await writeFile(join(dir, "a.zip"), Buffer.from(zipOf(1)));
  assert.equal(runner(dir, await mkdtemp(join(tmpdir(), "cc-da2-f-")))("read", { path: "a.zip" }), "error: " + T.BINARY_REFUSED(".zip"));
});

test("DA3 a null byte in a path, in Claude Code's words for Read, Write, Edit, Grep and Glob; the text \\u0000 counts as one (not in Grep's pattern, a regex escape)", () => {
  for (const p of ["a\0b", "a\\u0000b"]) {
    assert.equal(T.pathProblem("read", p), "Read file_path" + NUL);
    assert.equal(T.pathProblem("write", p), "Write file_path" + NUL);
    assert.equal(T.pathProblem("edit", p), "Edit file_path" + NUL);
    assert.equal(T.fileInputProblem("read", { path: p }), "Read file_path" + NUL);
    assert.equal(S.checkGrepInput({ pattern: "x", path: p }).error, "error: Grep path" + NUL);
    assert.equal(S.checkGlobInput({ pattern: "*", path: p }).error, "error: Glob path" + NUL);
    assert.equal(S.checkGlobInput({ pattern: "*" + p }).error, "error: Glob pattern" + NUL);
  }
  assert.equal(S.checkGrepInput({ pattern: "a\0" }).error, "error: Grep pattern" + NUL);
  assert.ok(!S.checkGrepInput({ pattern: "a\\u0000" }).error, "a regex's own \\u0000 in Grep's pattern is kept");
  assert.equal(T.hasNul("plain"), false);
});

test("DA4 what PostToolUse hooks get of a picture or PDF read is Claude Code's Read output: { type: 'image', file: { base64, type, originalSize, dimensions } } and the parts form without the pages' pictures", () => {
  const img = T.pictureFacts({ data: "QUJD", type: "image/png", w: 10, h: 5 }, 123, { w: 20, h: 10 });
  assert.deepEqual(img, { type: "image", file: { base64: "QUJD", type: "image/png", originalSize: 123, dimensions: { originalWidth: 20, originalHeight: 10, displayWidth: 10, displayHeight: 5 } } });
  const parts = T.pdfFacts({ abs: "/w/a.pdf", size: 9, asked: true, count: 2, outputDir: "/tmp/x", firstPage: 3 });
  assert.deepEqual(parts, { type: "parts", file: { filePath: "/w/a.pdf", originalSize: 9, count: 2, outputDir: "/tmp/x" }, firstPage: 3 });
  assert.ok(!("pages" in parts.file) && !("pages" in parts), "no page pictures on the object");
  assert.deepEqual(T.pdfFacts({ abs: "/w/b.pdf", bytes: Buffer.from("%PDF"), size: 4 }), { type: "pdf", file: { filePath: "/w/b.pdf", base64: Buffer.from("%PDF").toString("base64"), originalSize: 4 } });
});

const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
async function planRun(answer) {
  const hookCalls = [];
  let n = 0;
  const steps = [say("", [call("exit_plan_mode", { plan: "1. Fix it\n" }, "x1")]), say("Done.")];
  const events = [];
  const r = await A.runCoder({
    send: async () => steps[Math.min(n++, steps.length - 1)],
    exec: async (x) => {
      const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
      if (mark && x.hook === true) { hookCalls.push(JSON.parse(x.payload)); return { code: 0, output: "\n" + mark[0] + "\n" }; }
      return { code: 0, output: "ok" };
    },
    emit: (e) => events.push(e), here: () => "/work/shop", root: "/work/shop", chatId: "da5", where: (p) => (p.startsWith("/") ? p : "/work/shop/" + p),
    ask: async () => answer, toolSearch: "false",
  }, { text: "Plan it", mode: "plan", messages: [], hooks: H.hooksFrom({ hooks: { PostToolUse: [{ matcher: "ExitPlanMode", hooks: [{ type: "command", command: "post.sh" }] }] } }, "settings").list });
  return { r, post: hookCalls.find((h) => h.hook_event_name === "PostToolUse") };
}

test("DA5 ExitPlanMode's result has planWasEdited: true when the owner edited the plan on the card, with no plan file too; left out when not edited", async () => {
  const edited = await planRun({ choice: "auto", plan: "1. Fix it well\n" });
  assert.ok(edited.post, "PostToolUse ran");
  assert.equal(edited.post.tool_response.planWasEdited, true);
  assert.equal(edited.post.tool_response.plan, "1. Fix it well\n");
  const same = await planRun({ choice: "auto" });
  assert.ok(same.post);
  assert.equal("planWasEdited" in same.post.tool_response, false);
});
