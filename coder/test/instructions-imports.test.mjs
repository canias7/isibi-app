// INSTRUCTION FILES: @ IMPORTS (M-f-01, Claude Code's memory.md) AND FILES A READ DENY RULE COVERS (M-r2-18, errors.md:
// "Instruction file not loaded (a Read deny rule covers it)").
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

const S = await import("../container/server.mjs");
const put = async (dir, rel, text) => { await mkdir(dirname(join(dir, rel)), { recursive: true }); await writeFile(join(dir, rel), text); };
const all = (r) => r.notes.map((n) => n.text).join("\n");

test("MF01 CODER.md's @AGENTS.md loads AGENTS.md right after the line naming it; code spans and fenced blocks stay plain text", async () => {
  const dir = await mkdtemp(join(tmpdir(), "coder-imp-"));
  await put(dir, "CODER.md", "Top.\nSee @AGENTS.md for more.\nNot this: `@README.md`.\n```\n@docs/x.md\n```\nEnd.");
  await put(dir, "AGENTS.md", "AGENTS TEXT");
  await put(dir, "README.md", "README TEXT");
  await put(dir, "docs/x.md", "X TEXT");
  const r = await S.repoInstructions(dir);
  const t = all(r);
  assert.ok(t.includes("See @AGENTS.md for more.\nAGENTS TEXT\nNot this"), t);
  assert.ok(!t.includes("README TEXT") && !t.includes("X TEXT"), t);
  await rm(dir, { recursive: true, force: true });
});

test("MF01 paths count from the naming file's folder; four hops at most; a loop loads each file once; nothing from outside the project or through a link", async () => {
  const dir = await mkdtemp(join(tmpdir(), "coder-imp-"));
  const out = await mkdtemp(join(tmpdir(), "coder-out-"));
  await put(out, "secret.md", "OUTSIDE TEXT");
  await put(dir, ".coder/CODER.md", "Start @guide.md and @../top.md @" + join(out, "secret.md") + " @../../x.md @linked.md");
  await symlink(join(out, "secret.md"), join(dir, ".coder/linked.md"));
  await put(dir, ".coder/guide.md", "GUIDE @h1.md");
  await put(dir, "top.md", "TOP @.coder/CODER.md");
  await put(dir, ".coder/h1.md", "H1 @h2.md");
  await put(dir, ".coder/h2.md", "H2 @h3.md");
  await put(dir, ".coder/h3.md", "H3 @h4.md");
  await put(dir, ".coder/h4.md", "H4");
  const t = all(await S.repoInstructions(dir));
  for (const w of ["GUIDE", "TOP", "H1", "H2", "H3"]) assert.ok(t.includes(w), w + " in " + t);
  assert.ok(!t.includes("H4"), "five hops: not loaded");
  assert.ok(!t.includes("OUTSIDE TEXT"), "outside the project");
  assert.equal(t.split("Start @guide").length, 2, "the loop loads each file once");
  await rm(dir, { recursive: true, force: true }); await rm(out, { recursive: true, force: true });
});

test("MF01 importTarget and importTokens", () => {
  assert.equal(S.importTarget("/p", "CODER.md", "docs/a.md"), "docs/a.md");
  assert.equal(S.importTarget("/p", ".coder/CODER.md", "../a.md"), "a.md");
  assert.equal(S.importTarget("/p", "CODER.md", "../a.md"), "");
  assert.equal(S.importTarget("/p", "CODER.md", "/p/b.md."), "b.md");
  assert.equal(S.importTarget("/p", "CODER.md", "/etc/passwd"), "");
  assert.equal(S.importTarget("/p", "CODER.md", "~/x.md"), "");
  assert.deepEqual(S.importTokens("mail me@x.com, see @a.md and `@b.md`"), ["a.md"]);
});

test("MR218 a file a Read deny rule covers is not given to Grok and the chat is told; CODER.md still loads; an import of a denied file is held back too; no rules: all load", async () => {
  const dir = await mkdtemp(join(tmpdir(), "coder-deny-"));
  await put(dir, "CODER.md", "MAIN @private/p.md");
  await put(dir, "private/p.md", "PRIVATE TEXT");
  await put(dir, ".coder/rules/shared.md", "SHARED TEXT");
  const rules = { allow: [], ask: [], deny: ["Read(.coder/rules/**)", "Read(private/**)"] };
  const r = await S.repoInstructions(dir, { withhold: S.instructionWithhold(dir, rules) });
  const t = all(r);
  assert.ok(t.includes("MAIN") && !t.includes("SHARED TEXT") && !t.includes("PRIVATE TEXT"), t);
  assert.deepEqual(r.withheld.map((w) => w.path).sort(), [".coder/rules/shared.md", "private/p.md"]);
  const said = S.withheldNotes(r.withheld);
  assert.ok(said.includes("Instruction file not loaded (a Read deny rule covers it):\npath: .coder/rules/shared.md"), said.join("|"));
  const free = await S.repoInstructions(dir, { withhold: S.instructionWithhold(dir, { allow: [], ask: [], deny: [] }) });
  assert.ok(all(free).includes("SHARED TEXT") && all(free).includes("PRIVATE TEXT"));
  assert.deepEqual(S.withheldNotes([1, 2, 3, 4, 5].map((i) => ({ path: "f" + i, why: "w" }))).slice(-1), ["and 2 more instruction files not loaded"]);
  await rm(dir, { recursive: true, force: true });
});
