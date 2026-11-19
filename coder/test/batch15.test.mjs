// CLAUDE CODE FIXES, BATCH 15 (2026-11-19): audit items, each kept fixed here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, utimes, readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const S = await import("../container/server.mjs");
const T = await import("../container/coder-tools.mjs");

test("I52 a named pipe as a repository settings file is skipped at once, and a plain one beside it still read", async () => {
  const dir = await mkdtemp(join(tmpdir(), "coder-b15-fifo-"));
  await mkdir(join(dir, ".claude"));
  execFileSync("mkfifo", [join(dir, ".claude", "settings.json")]);
  await writeFile(join(dir, ".claude", "settings.local.json"), JSON.stringify({ env: { A: "1" }, hooks: { Stop: [{ hooks: [{ type: "command", command: "true" }] }] } }));
  // (Run in a child process: a blocking open would freeze this one forever.)
  const code = `const S = await import(${JSON.stringify(new URL("../container/server.mjs", import.meta.url).href)});
    const f = S.repoSettingsFiles(${JSON.stringify(dir)}); const h = S.hooksForTurn(${JSON.stringify(dir)}, null);
    console.log(JSON.stringify({ files: f.map((x) => x.file), hooks: h.length }));`;
  const out = execFileSync(process.execPath, ["--input-type=module", "-e", code], { timeout: 8000, encoding: "utf8" });
  const r = JSON.parse(out.trim().split("\n").pop());
  assert.deepEqual(r.files, ["settings.local.json"]);
  assert.equal(r.hooks, 1);
});

test("L-machine-55 clearing old saved outputs spares a running background command's output file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "coder-b15-out-"));
  await writeFile(join(dir, "live.txt"), "still running");
  await utimes(join(dir, "live.txt"), new Date(1000), new Date(1000));
  for (let i = 0; i < 100; i++) await writeFile(join(dir, "n" + i + ".txt"), "x");
  await S.keepNewest(dir, 100, new Set(["live.txt"]));
  const left = await readdir(dir);
  assert.ok(left.includes("live.txt"));
  assert.equal(left.length, 101);
  await S.keepNewest(dir, 100);
  assert.ok(!(await readdir(dir)).includes("live.txt"), "without the spare set the oldest goes, as before");
});

test("M-f-02 a rule's paths on one comma line, and a [list] with a brace pattern, split as Claude Code reads them", () => {
  const one = S.ruleParts("---\npaths: src/**/*.ts, lib/**/*.ts\n---\nbody");
  assert.deepEqual(one.globs, ["src/**/*.ts", "lib/**/*.ts"]);
  assert.ok(S.globAny(one.globs, "lib/b.ts"));
  const list = S.ruleParts('---\npaths: ["src/**/*.{ts,tsx}", "lib/**/*.ts"]\n---\nbody');
  assert.deepEqual(list.globs, ["src/**/*.{ts,tsx}", "lib/**/*.ts"]);
  assert.ok(S.globAny(list.globs, "src/x.tsx"));
  assert.deepEqual(S.splitPaths('"a,b", c'), ['"a,b"', " c"]);
  assert.deepEqual(S.ruleParts("---\npaths:\n  - a/*.md\n  - b/*.md\n---\n").globs, ["a/*.md", "b/*.md"]);
});

test("M-r2-33 the memory's front matter and HTML comments do not reach Grok; code fences keep theirs", () => {
  const mem = "---\nname: x\n---\n- tests: npm test\n<!-- private\nnote -->\n```\n<!-- kept -->\n```\n";
  assert.equal(T.memoryLoaded(mem), "- tests: npm test\n```\n<!-- kept -->\n```\n");
  const text = S.contextText([], "/m/MEMORY.md", mem);
  assert.ok(text.includes("- tests: npm test"));
  assert.ok(!text.includes("private") && !text.includes("name: x"));
  assert.ok(text.includes("(empty so far)") === false);
  assert.ok(S.contextText([], "/m/MEMORY.md", "<!-- only a comment -->").includes("(empty so far)"));
});

test("M-r2-35 the memory sentence says what to keep and what to skip, as Claude Code's", () => {
  const text = S.contextText([], "/m/MEMORY.md", "");
  assert.match(text, /When the owner asks you to remember something/);
  assert.match(text, /Skip anything the code, git history or CODER\.md already show/);
});

test("L-ops-29 the shell snapshot is taken once per machine start, and again after the setup, a shell switch or a lost file", () => {
  const taken = new Map();
  assert.equal(S.snapshotDue(taken, { home: "/h", shell: "bash" }), true, "first job on this machine");
  taken.set("/h", "bash");
  assert.equal(S.snapshotDue(taken, { home: "/h", shell: "bash" }), false, "second message: not again");
  assert.equal(S.snapshotDue(taken, { home: "/h", shell: "bash", setupRan: true }), true);
  assert.equal(S.snapshotDue(taken, { home: "/h", shell: "zsh" }), true);
  assert.equal(S.snapshotDue(taken, { home: "/h", shell: "bash", exists: false }), true);
});
