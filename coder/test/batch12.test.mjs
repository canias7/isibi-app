// CLAUDE CODE FIXES, BATCH 12 (2026-11-19): file-tool items from the audit, each kept fixed here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, stat, chmod, mkdir } from "node:fs/promises";
import { spawnSync, execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const script = new URL("../container/coder-tools.mjs", import.meta.url).pathname;
const asRoot = process.getuid && process.getuid() === 0;
async function box() {
  const dir = await mkdtemp(join(tmpdir(), "coder-b12-"));
  const seen = await mkdtemp(join(tmpdir(), "coder-b12-seen-"));
  if (asRoot) execFileSync("chown", ["-R", "1001:1001", dir, seen]);
  const run = (tool, args) => {
    const b64 = Buffer.from(JSON.stringify({ tool, args })).toString("base64");
    const env = { ...process.env, CODER_SEEN_DIR: seen, HOME: "/tmp" };
    const r = asRoot
      ? spawnSync("setpriv", ["--reuid=1001", "--regid=1001", "--clear-groups", "node", "--no-warnings", script, b64], { cwd: dir, encoding: "utf8", env, maxBuffer: 64 << 20 })
      : spawnSync("node", ["--no-warnings", script, b64], { cwd: dir, encoding: "utf8", env, maxBuffer: 64 << 20 });
    return String(r.stdout || "") + String(r.stderr || "");
  };
  const put = async (name, text, mode) => { await mkdir(join(dir, name, ".."), { recursive: true }); await writeFile(join(dir, name), text); if (mode) await chmod(join(dir, name), mode); if (asRoot) execFileSync("chown", ["-R", "1001:1001", dir]); };
  return { dir, run, put };
}

test("B12 L-machine-04: a read that fails or shows nothing does not lift the partial-read guard", async () => {
  const { run, put } = await box();
  await put("big.txt", Array.from({ length: 3000 }, (_, i) => "row " + i + " " + "y".repeat(92)).join("\n"));
  assert.match(run("read", { path: "big.txt", allow_large: true }), /PARTIAL view/);
  run("read", { path: "big.txt", offset: 1, limit: 2400 }); // too long: fails
  assert.match(run("read", { path: "big.txt", offset: 9999 }), /past its end/);
  const w = run("write", { path: "big.txt", content: "wiped" });
  assert.doesNotMatch(w, /successfully|created|updated/i, w);
});

test("B12 L-machine-10: a notebook over 256 KB, once read, may be written", async () => {
  const { dir, run, put } = await box();
  const nb = { cells: [{ cell_type: "code", source: ["print(1)"], outputs: [{ output_type: "display_data", data: { "image/png": "A".repeat(400 * 1024) } }], metadata: {}, execution_count: 1 }], metadata: {}, nbformat: 4, nbformat_minor: 5 };
  await put("n.ipynb", JSON.stringify(nb));
  run("read", { path: "n.ipynb" });
  const w = run("write", { path: "n.ipynb", content: JSON.stringify({ ...nb, cells: [] }) });
  assert.doesNotMatch(w, /not been read/, w);
  assert.equal(JSON.parse(await readFile(join(dir, "n.ipynb"), "utf8")).cells.length, 0);
});

test("B12 L-machine-11: names that start with two dots are ordinary names; ../ still climbs out", async () => {
  const { run, put } = await box();
  await put("..cache/x.txt", "hello\n");
  await put("..env.bak", "k=v\n");
  assert.match(run("read", { path: "..cache/x.txt" }), /1\thello/);
  assert.match(run("read", { path: "..env.bak" }), /1\tk=v/);
  assert.match(run("read", { path: "../x" }), /outside the project|no such file/);
  const T = await import("../container/coder-tools.mjs");
  assert.deepEqual(["..", "../a", "..cache", "..env.bak", "a/.."].map(T.climbsOut), [true, true, false, false, false]);
});

test("B12 L-machine-22: read and edit refuse two different paths, before hooks", async () => {
  const T = await import("../container/coder-tools.mjs");
  for (const name of ["read", "edit"]) {
    assert.match(T.fileInputProblem(name, { path: ".env", file_path: "notes.txt", old_string: "a", new_string: "b" }), /An unexpected parameter `file_path` was provided/);
    assert.doesNotMatch(T.fileInputProblem(name, { path: "a.txt", file_path: "a.txt", old_string: "a", new_string: "b" }), /unexpected parameter/);
  }
});

test("B12 M-r2-39: write replaces a read-only file of its own and it stays read-only", async () => {
  const { dir, run, put } = await box();
  await put("ro.txt", "locked\n", 0o444);
  run("read", { path: "ro.txt" });
  const w = run("write", { path: "ro.txt", content: "new\n" });
  assert.doesNotMatch(w, /EACCES/, w);
  assert.equal(await readFile(join(dir, "ro.txt"), "utf8"), "new\n");
  assert.equal((await stat(join(dir, "ro.txt"))).mode & 0o777, 0o444);
});

test("B12 M-a-11: allow_large is sized by the room left, not a 400,000-character ceiling", async () => {
  const { run, put } = await box();
  await put("huge.txt", Array.from({ length: 6000 }, (_, i) => "row " + (i + 1) + " " + "y".repeat(92)).join("\n"));
  const all = run("read", { path: "huge.txt", allow_large: true, max_chars: 1_000_000 });
  assert.ok(all.length > 600_000 && !/PARTIAL/.test(all), "the whole 600,000-character file");
  assert.match(run("read", { path: "huge.txt", allow_large: true, max_chars: 200_000 }), /PARTIAL view/);
});
