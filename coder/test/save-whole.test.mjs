// A SAVE THAT NEVER LEAVES THE FILE EMPTY OR CUT OFF (2026-11-20, audit M-r2-05; Claude Code's changelog: edited files no
// longer end up "empty or cut off when the disk fills during a save").
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, stat, symlink, chmod, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { saveWhole } from "../container/coder-tools.mjs";

const full = () => Object.assign(new Error("ENOSPC: no space left on device, write"), { code: "ENOSPC" });
// A write that puts half the bytes down, then finds the disk full.
const halfThenFull = async (to, bytes) => { const b = Buffer.from(bytes); if (typeof to === "string") await writeFile(to, b.subarray(0, b.length >> 1)); else await to.write(b.subarray(0, b.length >> 1)); throw full(); };

test("SW1 the disk filling during a save leaves the old text whole, and no temporary file behind", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sw-"));
  try {
    const f = join(dir, "a.txt");
    await writeFile(f, "the old text, all of it\n");
    await assert.rejects(saveWhole(f, "a much longer new text that will not fit\n".repeat(50), { writeFile: halfThenFull }), /ENOSPC/);
    assert.equal(await readFile(f, "utf8"), "the old text, all of it\n");
    assert.deepEqual(await readdir(dir), ["a.txt"]);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("SW2 where no rename is possible, a failed in-place write puts the old bytes back", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sw-"));
  try {
    const f = join(dir, "b.txt");
    await writeFile(f, "kept\n");
    const noRename = async () => { throw Object.assign(new Error("EXDEV"), { code: "EXDEV" }); };
    let n = 0;
    const write = async (to, bytes) => { n++; if (typeof to === "string") return halfThenFull(to, bytes); return to.write(Buffer.from(bytes)); };
    await assert.rejects(saveWhole(f, "x".repeat(4000), { rename: noRename, writeFile: write }), /ENOSPC/);
    assert.equal(n, 2);
    assert.equal(await readFile(f, "utf8"), "kept\n");
    assert.deepEqual(await readdir(dir), ["b.txt"]);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("SW3 a good save keeps the file's permissions and writes through a link to its target", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sw-"));
  try {
    const f = join(dir, "run.sh"), l = join(dir, "link.sh");
    await writeFile(f, "old\n"); await chmod(f, 0o750); await symlink(f, l);
    await saveWhole(l, "new\n");
    assert.equal(await readFile(f, "utf8"), "new\n");
    assert.equal((await stat(f)).mode & 0o777, 0o750);
    assert.equal((await import("node:fs")).lstatSync(l).isSymbolicLink(), true);
    assert.deepEqual((await readdir(dir)).sort(), ["link.sh", "run.sh"]);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
