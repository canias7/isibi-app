// CLAUDE CODE FIXES, BATCH 25 (2026-11-19).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const toolsScript = new URL("../container/coder-tools.mjs", import.meta.url).pathname;
const readIn = (dir, args) => { try { return execFileSync("node", ["--no-warnings", "--input-type=module", "-e", "const { toolRead } = await import(" + JSON.stringify(toolsScript) + "); process.stdout.write(await toolRead(" + JSON.stringify(args) + "));"], { cwd: dir, encoding: "utf8", maxBuffer: 16 << 20 }); } catch (e) { return "ERROR " + String(e.stderr || e.stdout || ""); } };

test("M-a-10: a part of a text file over 20 MB is read with offset and limit; a whole read is still refused", async () => {
  const dir = await mkdtemp(join(tmpdir(), "coder-big-"));
  const line = "x".repeat(99);
  const n = 220000; // 22 MB
  const rows = [];
  for (let i = 1; i <= n; i++) rows.push(i <= 10 ? "line" + i : line);
  await writeFile(join(dir, "big.txt"), rows.join("\n") + "\n");
  const part = readIn(dir, { path: "big.txt", offset: 5, limit: 3 });
  assert.equal(part, "     5\tline5\n     6\tline6\n     7\tline7\n[lines 5-7 of " + n + "; read more with offset 8]");
  assert.match(readIn(dir, { path: "big.txt" }), /ERROR[\s\S]*too big for this tool/);
});

test("M-f-11: a subfolder's own .coder/rules load once a file under it is touched; a paths rule only for matching files there", async () => {
  const { mkdir } = await import("node:fs/promises");
  const { dirname } = await import("node:path");
  const S = await import("../container/server.mjs");
  const put = async (dir, rel, text) => { await mkdir(dirname(join(dir, rel)), { recursive: true }); await writeFile(join(dir, rel), text); };
  const dir = await mkdtemp(join(tmpdir(), "coder-subrules-"));
  await put(dir, "src/a.js", "a");
  await put(dir, "src/x.ts", "x");
  await put(dir, "lib/b.js", "b");
  await put(dir, "src/.coder/rules/team.md", "Team rule here.\n");
  await put(dir, "src/.coder/rules/ts.md", "---\npaths:\n  - \"**/*.ts\"\n---\nTS rule here.\n");
  const { later } = await S.repoInstructions(dir);
  const shown = new Set();
  assert.equal(S.laterNotes(later, dir, "lib/b.js", shown), "");
  const first = S.laterNotes(later, dir, "src/a.js", shown);
  assert.match(first, /Team rule here/);
  assert.doesNotMatch(first, /TS rule here/);
  assert.equal(S.laterNotes(later, dir, "src/a.js", shown), "");
  assert.match(S.laterNotes(later, dir, "src/x.ts", shown), /TS rule here/);
});

test("I68: PowerShell short settings (-rf, -r -fo) no longer hide the target; a wildcard, home or system folder after them is refused", async () => {
  const P = await import("../container/coder-perms.mjs");
  const Q = await import("../container/coder-psparse.mjs");
  const { fakeParse } = await import("./ps-fake.mjs");
  const ROOT = "/work/shop";
  const where = { cwd: ROOT, home: "/home/dev", pathAbs: (p) => { const t = p === "~" || p.startsWith("~/") ? "/home/dev" + p.slice(1) : p; return (t.startsWith("/") ? t : join(ROOT, t)).replace(/\/+$/, "") || "/"; }, inside: (p) => { const abs = p.startsWith("/") ? p : join(ROOT, p); return abs === ROOT || abs.startsWith(ROOT + "/"); } };
  const decide = (cmd) => P.psDecision(cmd, { mode: "acceptEdits", rules: {}, parsed: fakeParse(cmd), nativeReadOnly: () => false, ...where });
  assert.deepEqual(Q.psPathArgs({ name: "Remove-Item", args: ["-rf", "*"] }), ["*"]);
  assert.deepEqual(Q.psPathArgs({ name: "Remove-Item", args: ["-r", "-fo", ".claude"] }), [".claude"]);
  assert.deepEqual(Q.psWriteTargets({ name: "Remove-Item", args: ["-r", "-fo", ".husky"] }), [".husky"]);
  assert.equal(decide("Remove-Item -rf *").verdict, "deny");
  assert.equal(decide("Remove-Item -rf ~").verdict, "deny");
  assert.equal(decide("Remove-Item -r -fo /etc").verdict, "deny");
  // A value setting still takes its value.
  assert.deepEqual(Q.psPathArgs({ name: "Remove-Item", args: ["-Filter", "*.log", "logs"] }), ["logs"]);
});
