// A FULL DISK, side by side with Claude Code 2.1.322 (2026-11-12; the owner: "yes do the disk and memory test" and "remember
// to run claude code to compare and fix"). Claude Code, on a full 8 MB disk holding its project and its temporary directory
// (as its cloud machine has one disk), ran `echo hello` and said what it printed was lost; Coder refused to start it. Claude
// Code's note is about its temporary directory only, after a command that failed, before the command's output.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const S = await import("../container/server.mjs");
const A = await import("../container/coder-agent.mjs");
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });

test("CD546 a full disk, as Claude Code 2.1.322 says it: only the volume of Coder's folder for command output, under 10 MB free or 1,000 free inodes; \"whatever this command printed was lost\" when it printed nothing; a test write when it can't be looked at; Claude Code's own advice", async () => {
  const fs = (mb, ffree = 50000n) => () => ({ blocks: 1000n, bavail: BigInt(mb) * 256n, bsize: 4096n, files: 100000n, ffree });
  const where = "this computer's volume holding /x (Coder's folder for command output)";
  const never = () => { throw new Error("no test write expected"); };
  assert.equal(S.FREE_SPACE, "Free space on that volume, then retry. If this is the owner's own computer, tell them before deleting anything to make room.");
  assert.equal(S.diskNoteAfter("/x", false, { statfs: fs(3), probe: never }), "Disk full: " + where + " has 3 MB free, so this command's output may be cut short and its own writes may have failed with \"No space left on device\". " + S.FREE_SPACE);
  assert.equal(S.diskNoteAfter("/x", true, { statfs: fs(0), probe: never }), "Disk full: " + where + " has 0 MB free, so whatever this command printed was lost and its own writes may have failed with \"No space left on device\". " + S.FREE_SPACE);
  assert.equal(S.diskNoteAfter("/x", false, { statfs: fs(500, 12n), probe: never }), "Nearly out of inodes: " + where + " has 12 free inodes, so creating files there may fail and the command may have failed for that reason. " + S.FREE_SPACE);
  assert.equal(S.diskNoteAfter("/x", false, { statfs: fs(500), probe: never }), null, "room, and it printed something: nothing to say");
  assert.equal(S.diskNoteAfter("/x", true, { statfs: fs(500), probe: () => "" }), null, "it printed nothing, and a test write worked");
  assert.equal(S.diskNoteAfter("/x", true, { statfs: fs(500), probe: () => "EDQUOT" }), "Disk quota used up: a test write beside this command's output file, on the volume holding /x (Coder's folder for command output), failed with EDQUOT, so whatever this command printed was lost and its own writes may have failed with \"Disk quota exceeded\". Delete files there that are no longer needed, then retry. If this is the owner's own computer, tell them before deleting anything to make room.");
  assert.equal(S.diskNoteAfter("/x", false, { statfs: () => { throw new Error("gone"); }, probe: () => "ENOSPC" }), "Disk full: a test write beside this command's output file, on the volume holding /x (Coder's folder for command output), failed with ENOSPC (the volume, or the user's quota on it, has no space left), so this command's output may be cut short and its own writes may have failed with \"No space left on device\". " + S.FREE_SPACE);
  // A real test write leaves nothing behind.
  const dir = await mkdtemp(join(tmpdir(), "coder-fd-"));
  assert.equal(S.probeWrite(dir), "");
  assert.deepEqual((await import("node:fs")).readdirSync(dir), []);
  assert.notEqual(S.probeWrite(join(dir, "no-such-folder")), "");
  // On the machine: a full disk never keeps a command from starting (Coder needs no file to start one), and the note is made
  // only after one that failed, not one stopped at its time limit.
  const server = read("container/server.mjs");
  assert.doesNotMatch(server, /notStarted: true, output: "The command was not started/);
  assert.match(server, /if \(!tool && r && !r\.background && r\.code !== 0 && !r\.timedOut\) \{\n\s+const note = diskNoteAfter\(outDir, !String\(r\.output \|\| ""\)\.trim\(\)\);\n\s+if \(note\) r\.diskNote = note;/);
});

test("CD547 the full-disk note goes before the command's output, after a blank line, as Claude Code puts it (and alone when it printed nothing): for Coder's commands and the owner's own (!)", async () => {
  const note = "Disk full: this computer's volume holding /data/memory/c.out (Coder's folder for command output) has 0 MB free, so this command's output may be cut short and its own writes may have failed with \"No space left on device\". " + S.FREE_SPACE;
  assert.equal(A.withDiskNote("out\n", { diskNote: note }), note + "\n\nout\n");
  assert.equal(A.withDiskNote("  \n", { diskNote: note }), note);
  assert.equal(A.withDiskNote("out", {}), "out");
  // Coder's command: the model is told "Exit code 1", then the note, then what it printed.
  const seen = [];
  let n = 0;
  const steps = [say("", [call("bash", { command: "head -c 20000000 /dev/zero > big.bin" }, "h1")]), say("Done.")];
  const exec = async () => ({ code: 1, output: "head: error writing 'standard output': No space left on device\n", diskNote: note });
  await A.runCoder({ send: async (req) => { seen.push(req); return steps[Math.min(n++, steps.length - 1)]; }, exec, emit: () => {}, here: () => "/w", root: "/w" }, { text: "go" });
  const told = seen[1].messages.find((m) => m.role === "tool" && m.tool_call_id === "h1").content;
  assert.equal(told, "Exit code 1\n" + note + "\n\nhead: error writing 'standard output': No space left on device");
  // The owner's own command: the note first in what it showed and what Coder is told.
  const events = [], seen2 = [];
  await A.runCoder({ send: async (req) => { seen2.push(req); return say("Noted."); }, exec: async () => ({ code: 1, output: "", diskNote: note }), emit: (e) => events.push(e), here: () => "/w", root: "/w" }, { shell: "echo hello" });
  const shown = events.find((e) => e.type === "result");
  assert.ok(shown.output.startsWith(note), shown.output.slice(0, 80));
  assert.ok(JSON.stringify(seen2[0].messages).includes(JSON.stringify(note).slice(1, 60)), "Coder is told it too");
});
