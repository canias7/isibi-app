// Two fixes from the live test of 2026-11-21: read follows a .git gitfile to the chat's own git folder (outside the work tree,
// as on Coder's machine: server.mjs gitDirFor, GIT_ROOT/<chat>), and a write or edit in .git is refused at once, with no card.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, symlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { gitDirFor } from "../container/server.mjs";

const TOOLS = new URL("../container/coder-tools.mjs", import.meta.url).pathname;
const tool = (cwd, name, args) => { const r = spawnSync(process.execPath, ["--no-warnings", TOOLS, Buffer.from(JSON.stringify({ tool: name, args })).toString("base64")], { cwd, encoding: "utf8", env: { PATH: process.env.PATH } }); return String(r.stdout || "").replace(/^\u0000coder-facts\u0000[^\n]*\n/, ""); };

test("read opens .git/HEAD through the work tree's gitfile, in the chat's own git folder only", async () => {
  const top = await mkdtemp(join(tmpdir(), "coder-gitdir-"));
  const work = join(top, "work", "chat1"), gitRoot = join(top, "git");
  const gd = gitDirFor(work, gitRoot), other = gitDirFor(join(top, "work", "chat2"), gitRoot);
  for (const d of [work, join(gd, "refs"), other]) await mkdir(d, { recursive: true });
  await writeFile(join(gd, "HEAD"), "ref: refs/heads/main\n");
  await writeFile(join(gd, "config"), "[core]\n\tbare = false\n");
  await writeFile(join(gd, "credentials"), "secret\n");
  await writeFile(join(other, "HEAD"), "ref: refs/heads/other\n");
  await writeFile(join(work, ".git"), "gitdir: " + gd + "\n");
  assert.match(tool(work, "read", { path: ".git/HEAD" }), /^\s*1\tref: refs\/heads\/main/);
  assert.match(tool(work, "read", { path: join(work, ".git", "config") }), /bare = false/);
  assert.equal(tool(work, "read", { path: ".git/credentials" }), "error: the .git folder is off limits");
  assert.equal(tool(work, "read", { path: ".git/nope" }), "error: no such file: .git/nope. Note: your current working directory is " + work + ".");
  // A link out of the git folder, to another chat's: refused.
  await symlink(join(other, "HEAD"), join(gd, "OTHER"));
  assert.equal(tool(work, "read", { path: ".git/OTHER" }), "error: that path leads outside the project");
  // A gitfile naming another chat's folder: refused.
  await writeFile(join(work, ".git"), "gitdir: " + other + "\n");
  assert.equal(tool(work, "read", { path: ".git/HEAD" }), "error: the .git folder is off limits");
  // Writing is still refused.
  await writeFile(join(work, ".git"), "gitdir: " + gd + "\n");
  assert.equal(tool(work, "write", { path: ".git/zz-test.txt", content: "x" }), "error: the .git folder is off limits");
});

const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });

for (const [name, args] of [["write", { path: ".git/zz-test.txt", content: "x\n" }], ["edit", { path: "/work/shop/.git/HEAD", old_string: "a", new_string: "b" }]]) {
  test("a " + name + " in .git is refused straight away, with no sensitive-file card", async () => {
    const { runCoder } = await import("../container/coder-agent.mjs");
    const events = [], seen = [], cards = [];
    let n = 0;
    const steps = [say("", [call(name, args, "w1")]), say("ok")];
    await runCoder({
      send: async (req) => { seen.push(req); return steps[Math.min(n++, steps.length - 1)]; },
      exec: async () => ({ code: 0, output: "ok\n" }),
      emit: (e) => events.push(e),
      here: () => "/work/shop", root: "/work/shop", where: (p) => (p.startsWith("/") ? p : "/work/shop/" + p),
      ask: async (pid) => { cards.push(pid); return { choice: "yes" }; },
    }, { text: "go", mode: "acceptEdits" });
    assert.equal(cards.length, 0, "no card");
    assert.ok(!events.some((e) => e.type === "permission" || e.type === "writeask"));
    const told = seen[1].messages.find((m) => m.role === "tool" && m.tool_call_id === "w1");
    assert.equal(told.content, "error: the .git folder is off limits");
    assert.ok(events.some((e) => e.type === "result" && e.output === "error: the .git folder is off limits"));
  });
}
