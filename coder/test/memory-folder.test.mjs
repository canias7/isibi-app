// Coder's memory as a folder (audit M-f-17; Claude Code's memory docs: "a `MEMORY.md` index and one topic file per memory").
// MEMORY.md stays the index that loads at the start; each memory sits in its own topic file beside it, which the Worker keeps
// per repository between chats, the machine writes before a job and reads back after it, and the file tools may write
// (stamping a `modified` time in front matter, as Claude Code does).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync, symlinkSync, existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { cleanMemoryFiles, sameMemoryFiles, isMemoryPath, stampModified, memoryTopicName, MEMORY_FILES_MAX, MEMORY_FILE_MAX } from "../container/memory-files.mjs";

const HERE = (p) => join(import.meta.dirname, "..", p);
const TOOLS = HERE("container/coder-tools.mjs");

test("MF1 topic files: good names only, the index never among them, capped in number, size and total", () => {
  for (const n of ["user_role.md", "feedback-testing.md", "a.b.md", "x.md"]) assert.ok(memoryTopicName(n), n);
  for (const n of ["MEMORY.md", ".hidden.md", "../x.md", "a/b.md", "notes.txt", "", "a b.md", "-x.md"]) assert.ok(!memoryTopicName(n), n);
  const got = cleanMemoryFiles({ "MEMORY.md": "index", "ok.md": "fine", "../bad.md": "no", "num.md": 5, "big.md": "x".repeat(MEMORY_FILE_MAX + 10) });
  assert.deepEqual(Object.keys(got).sort(), ["big.md", "ok.md"]);
  assert.equal(got["big.md"].length, MEMORY_FILE_MAX);
  const many = {}; for (let i = 0; i < MEMORY_FILES_MAX + 7; i++) many["m" + String(i).padStart(3, "0") + ".md"] = "t";
  assert.equal(Object.keys(cleanMemoryFiles(many)).length, MEMORY_FILES_MAX);
  const huge = {}; for (let i = 0; i < 20; i++) huge["h" + i + ".md"] = "y".repeat(MEMORY_FILE_MAX);
  assert.ok(Object.values(cleanMemoryFiles(huge)).join("").length <= 500_000);
  for (const bad of [null, "text", [1], 3]) assert.deepEqual(cleanMemoryFiles(bad), {});
  assert.ok(sameMemoryFiles({ a: "1" }, { a: "1" }) && !sameMemoryFiles({ a: "1" }, { a: "2" }) && !sameMemoryFiles({ a: "1" }, {}));
});

test("MF2 a memory path is the index or a topic file directly beside it, nothing else", () => {
  const mem = "/srv/coder-memory/p1/MEMORY.md";
  assert.ok(isMemoryPath(mem, mem));
  assert.ok(isMemoryPath("/srv/coder-memory/p1/user_role.md", mem));
  assert.ok(isMemoryPath("/srv/coder-memory/p1/./x/../feedback.md", mem));
  for (const p of ["/srv/coder-memory/p1/sub/a.md", "/srv/coder-memory/p2/a.md", "/srv/coder-memory/p1/a.txt", "/srv/coder-memory/p1/.x.md", "/etc/passwd", "relative.md"]) assert.ok(!isMemoryPath(p, mem), p);
  assert.ok(!isMemoryPath("/srv/coder-memory/p1/a.md", ""));
});

test("MF3 the `modified` time: stamped in front matter, an old one replaced, text without front matter untouched", () => {
  const at = new Date("2026-11-20T10:00:00Z");
  assert.equal(stampModified("---\nname: Role\ntype: user\n---\nThe owner is a designer.\n", at), "---\nname: Role\ntype: user\nmodified: 2026-11-20T10:00:00.000Z\n---\nThe owner is a designer.\n");
  assert.equal(stampModified("---\ntype: user\nmodified: 2020-01-01\n---\nx", at), "---\ntype: user\nmodified: 2026-11-20T10:00:00.000Z\n---\nx");
  assert.equal(stampModified("- [Role](user_role.md)\n", at), "- [Role](user_role.md)\n");
});

test("MF4 the tools script, for real: write and edit reach a topic file beside MEMORY.md and stamp `modified`; a secret is refused there as in MEMORY.md; a file in a subfolder of the memory folder is not let through", () => {
  const dir = mkdtempSync(join(tmpdir(), "mf4-"));
  const seen = mkdtempSync(join(tmpdir(), "mf4-seen-"));
  const mem = mkdtempSync(join(tmpdir(), "mf4-mem-"));
  const memFile = join(mem, "MEMORY.md");
  const tool = (name, args) => String(spawnSync("node", ["--no-warnings", TOOLS, Buffer.from(JSON.stringify({ tool: name, args })).toString("base64")], { cwd: dir, encoding: "utf8", timeout: 20_000, env: { ...process.env, CODER_SEEN_DIR: seen, CODER_MEMORY_FILE: memFile } }).stdout || "");
  try {
    writeFileSync(memFile, "");
    const topic = join(mem, "user_role.md");
    const out = tool("write", { path: topic, content: "---\nname: Role\ntype: user\n---\nThe owner reviews on phones.\n" });
    assert.match(out, /File created successfully/, out);
    const text = readFileSync(topic, "utf8");
    assert.match(text, /^---\nname: Role\ntype: user\nmodified: \d{4}-\d\d-\d\dT[\d:.]+Z\n---\nThe owner reviews on phones\.\n$/);
    const out2 = tool("edit", { path: topic, old_string: "phones", new_string: "tablets" });
    assert.match(out2, /updated successfully/, out2);
    assert.match(readFileSync(topic, "utf8"), /modified: .*\n---\nThe owner reviews on tablets\.\n$/);
    assert.match(tool("read", { path: topic }), /tablets/);
    // A secret: refused in a topic file, as in MEMORY.md.
    const key = "ghp_" + "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8";
    assert.match(tool("write", { path: join(mem, "keys.md"), content: "token " + key }), /^error: /);
    assert.ok(!existsSync(join(mem, "keys.md")));
    // Not a topic file: a subfolder, or a name that is not .md, stays outside the project.
    mkdirSync(join(mem, "sub"));
    assert.match(tool("write", { path: join(mem, "sub", "x.md"), content: "x" }), /^error: .*outside the project/);
    assert.match(tool("write", { path: join(mem, "x.txt"), content: "x" }), /^error: .*outside the project/);
  } finally { for (const d of [dir, seen, mem]) rmSync(d, { recursive: true, force: true }); }
});

test("MF5 the machine: topic files written into the memory folder and read back (a round trip of several), ones the Worker no longer has removed, a link or a bad name never read", async () => {
  const S = await import("../container/server.mjs");
  const mem = mkdtempSync(join(tmpdir(), "mf5-"));
  try {
    writeFileSync(join(mem, "MEMORY.md"), "- [Role](user_role.md)\n");
    writeFileSync(join(mem, "stale.md"), "old");
    await S.writeMemoryFiles(mem, { "user_role.md": "---\ntype: user\n---\nrole", "feedback_tests.md": "---\ntype: feedback\n---\nrun all", "../escape.md": "no" });
    assert.deepEqual(readdirSync(mem).sort(), ["MEMORY.md", "feedback_tests.md", "user_role.md"]);
    const uid = process.getuid();
    assert.deepEqual(await S.readMemoryFiles(mem, uid), { "feedback_tests.md": "---\ntype: feedback\n---\nrun all", "user_role.md": "---\ntype: user\n---\nrole" });
    // A link (to a file outside) and a hard-linked name are never read back.
    const outside = join(mem, "..", "mf5-secret-" + process.pid);
    writeFileSync(outside, "secret");
    symlinkSync(outside, join(mem, "link.md"));
    spawnSync("ln", [join(mem, "user_role.md"), join(mem, "second.md")]);
    const back = await S.readMemoryFiles(mem, uid);
    assert.ok(!("link.md" in back) && !("second.md" in back) && !("user_role.md" in back), JSON.stringify(Object.keys(back)));
    rmSync(outside, { force: true });
    // The index is never among the topic files.
    assert.ok(!("MEMORY.md" in back));
  } finally { rmSync(mem, { recursive: true, force: true }); }
});

test("MF6 the Worker keeps the topic files per repository beside the index: sent with each job (none to a job from GitHub), saved back only when changed and never from a GitHub job; the machine's turn writes them for Coder, not Gloopy; the prompt tells Coder Claude Code's way", () => {
  const routes = readFileSync(HERE("src/coder-routes.mjs"), "utf8");
  assert.match(routes, /export const memoryFilesKey = \(uid, repo\) => memoryKey\(uid, repo\)\.replace\(\/\\\.md\$\/, "\.files\.json"\);/);
  assert.match(routes, /const memoryFilesP = soon\(async \(\) => \(body\.fromGithub === true \? \{\} : cleanMemoryFiles\(await getJson\(bucket, memoryFilesKey\(uid, meta\.repo\), \{\}\)\)\)\);/);
  assert.match(routes, /memory, memoryFiles, setup, github: body\.fromGithub === true/);
  assert.match(routes, /memFilesNew !== null && !sameMemoryFiles\(memFilesNew, cleanMemoryFiles\(oldMemoryFiles\)\) && meta\.jobFromGithub !== true \? putJson\(bucket, memoryFilesKey\(uid, meta\.repo\), memFilesNew\) : null/);
  // The old single text still loads, unchanged, as the index.
  assert.match(routes, /const mo = await bucket\.get\(memoryKey\(uid, meta\.repo\)\); return mo \? \(await mo\.text\(\)\)\.slice\(0, MEMORY_MAX\) : "";/);
  const server = readFileSync(HERE("container/server.mjs"), "utf8");
  assert.match(server, /if \(!gloopy && body\.memoryFiles && typeof body\.memoryFiles === "object"\) await writeMemoryFiles\(memDir, body\.memoryFiles/);
  assert.match(server, /const memoryFiles = gloopy \? undefined : await readMemoryFiles\(memDir\);/);
  assert.match(server, /This file is the INDEX of your memory: one line per memory, each pointing at its own topic file/);
  assert.match(server, /`type:` \(one of user, feedback, project, reference\)/);
  assert.ok(!/add one short line to that file/.test(server));
  assert.match(readFileSync(HERE("container/Dockerfile"), "utf8"), / memory-files\.mjs \.\//);
});
