// THE READ BLOCK KEEPS CODER'S OWN MEMORY FILE READABLE (audit M-r2-41, 2026-11-19; Claude Code's settings reference: "Files
// Claude Code itself needs stay readable, such as … the CLAUDE.md memory file"). Only the file itself, not its folder.
// And the read block covers bash only, not PowerShell (audit L-second-18; Claude Code: "recognized file-reading Bash commands").
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve, isAbsolute } from "node:path";

const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });

test("RBM1 with the read block on, Coder's memory file is readable (read tool and cat); a topic file beside it too (Claude Code's memory folder, audit M-f-17); any other file beside it is still refused", async () => {
  const A = await import("../container/coder-agent.mjs");
  const base = await mkdtemp(join(tmpdir(), "coder-rbm-"));
  const work = join(base, "proj"), memDir = join(base, "mem");
  await mkdir(work, { recursive: true }); await mkdir(memDir, { recursive: true });
  const memFile = join(memDir, "MEMORY.md"), other = join(memDir, "other.txt"), topic = join(memDir, "user_role.md");
  await writeFile(memFile, "- tests: npm test\n"); await writeFile(other, "x\n"); await writeFile(topic, "---\ntype: user\n---\nx\n");
  try {
    const run = async (calls, opts) => {
      const events = [], toolsRan = [], commands = [];
      let n = 0;
      const exec = async ({ command, tool: isTool }) => {
        const m = isTool ? /coder-tools\.mjs (\S+)$/.exec(command) : null;
        if (m) { const req = JSON.parse(Buffer.from(m[1], "base64").toString("utf8")); toolsRan.push(req.args.path || ""); return { code: 0, output: "(read)" }; }
        commands.push(command);
        const r = spawnSync("bash", ["-c", command], { cwd: work, encoding: "utf8" });
        return { code: r.status, output: r.stdout + r.stderr };
      };
      const steps = [say("", calls), say("Done.")];
      await A.runCoder({ send: async () => steps[Math.min(n++, steps.length - 1)], exec, emit: (e) => events.push(e), here: () => work, root: work, where: (p) => (isAbsolute(p) ? resolve(p) : resolve(work, p)), home: join(base, "home"), ownDirs: [join(base, "out")], memFile }, { text: "go", ...opts });
      return { events, toolsRan, commands, result: (id) => events.find((e) => e.type === "result" && e.id === id) };
    };
    const t = await run([call("read", { path: memFile }, "r0"), call("read", { path: other }, "r1"), call("read", { path: topic }, "r2")], { readBlock: true });
    assert.ok(t.toolsRan.some((p) => resolve(work, p) === topic), "a topic file beside it read");
    assert.ok(t.toolsRan.some((p) => resolve(work, p) === memFile), "memory file read");
    assert.match(t.result("r1").output, /CODER_BLOCK_READS_OUTSIDE_WORKING_DIRECTORIES/, "the file beside it is refused");
    const c = await run([call("bash", { command: "cat " + memFile }, "b0")], { readBlock: true, mode: "auto" });
    // PowerShell is not under the block, as in Claude Code (audit L-second-18): no readblock card in Auto.
    const ps = await run([call("powershell", { command: "Get-Content ../outside/o.txt", description: "Read" }, "p0")], { readBlock: true, mode: "auto", powershell: { bypass: true, defaultShell: false } });
    assert.equal(ps.events.find((e) => e.type === "runask" && e.kind === "readblock"), undefined, "PowerShell gets no readblock card");
    assert.equal(c.events.find((e) => e.type === "runask" && e.kind === "readblock"), undefined, "cat of the memory file is not asked about");
  } finally { await rm(base, { recursive: true, force: true }); }
});
