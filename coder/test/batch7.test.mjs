// Claude Code fixes, batch 7 (2026-11-19).
import { test } from "node:test";
import assert from "node:assert/strict";
import { actionShown, parseVerdict, droppedInAuto } from "../container/coder-checker.mjs";
import { commandProblem, capOutput } from "../container/coder-checks.mjs";
import { dropOldestRounds, transcriptText, summaryMessage, isSummary, hasSummary, COMPACT_TRUNCATED } from "../container/coder-compact.mjs";
import { globMatch, globAny, expandBraces } from "../container/coder-globs.mjs";
import { readFile } from "node:fs/promises";

test("B7-1 (I29) the checker sees a long command and its whole host list; the card carries every host", async () => {
  const cmd = "echo " + "x".repeat(9000) + " && git push --force";
  assert.ok(actionShown("bash", { command: cmd }).includes("git push --force"));
  const hosts = Array.from({ length: 99 }, (_, i) => "h" + i + "-" + "a".repeat(200) + ".example.com").concat(["last.example.com"]);
  const s = actionShown("bash", { command: "curl x", allowed_domains: hosts });
  for (const h of hosts) assert.ok(s.includes(h), h.slice(0, 10));
  const src = await readFile(new URL("../container/coder-agent.mjs", import.meta.url), "utf8");
  assert.ok(!src.includes("hostsFor.slice(0, 20)"));
});

test("B7-2 (L-machine-20) a quoted allow before the real block is read as block; one verdict as before", () => {
  assert.equal(parseVerdict('Considering {"decision":"allow"} would be wrong. {"decision":"block","rule":"X","reason":"r"}').decision, "block");
  assert.equal(parseVerdict('Sure.\n```json\n{"decision":"allow"}\n```').decision, "allow");
  assert.equal(parseVerdict('{"decision":"block","reason":"has {} inside"}').decision, "block");
  assert.equal(parseVerdict("no json"), null);
});

test("B7-3 (M-e-05) Auto sets aside 2.1.327's wide rules; narrow ones stay", () => {
  for (const r of ["Bash(timeout *)", "Bash(nice:*)", "Bash(* --version)", "Bash($HOME/bin/*)", "Bash(~/bin/tool *)", "Bash(pnpm dlx *)", "Bash(npm exec *)", "Bash(/usr/bin/npm run:*)", "Bash(python3.11 *)", "Bash(node22 *)", "PowerShell(C:\\tools\\x.exe *)"]) assert.equal(droppedInAuto(r), true, r);
  for (const r of ["Bash(npm test)", "Bash(/usr/bin/npm test)", "Bash(git status)", "Bash(timeout 5 npm test)", "Bash(python3 -m http.server *)"]) assert.equal(droppedInAuto(r), false, r);
});

test("B7-4 (M-a-02) a word alone does not refuse a command", () => {
  for (const c of ['grep -rn "shutdown" src/', 'git commit -m "fix reboot loop"', "cat mkfs-notes.txt", "npm test -- --su x", "reboot"]) assert.equal(commandProblem(c), "", c);
  assert.match(commandProblem(":(){ :|:& };:"), /refused/);
});

test("B7-5 (M-g-30) shown output is never cut through an emoji", () => {
  const max = 1000, head = 600;
  const t = "a".repeat(head - 1) + "\u{1F600}" + "b".repeat(5000) + "\u{1F600}" + "c".repeat(399);
  const out = capOutput(t, max);
  assert.ok(!/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(out));
  assert.equal(JSON.parse(JSON.stringify(out)), out);
  const n = Number(/\[(\d+) characters not shown\]/.exec(out)[1]);
  const shown = out.replace(/\n… \[\d+ characters not shown\] …\n/, "");
  assert.equal(shown.length + n, t.length);
});

test("B7-6 (M-g-20) shortening a summary request keeps the earlier summary", () => {
  const sum = summaryMessage("earlier summary text", "x");
  assert.ok(isSummary(sum));
  const msgs = [sum];
  for (let i = 0; i < 10; i++) msgs.push({ role: "assistant", content: "a" + i + " " + "w".repeat(4000) }, { role: "user", content: "u" + i });
  for (const gap of [undefined, 1, 500, 5000]) {
    const r = dropOldestRounds(msgs, gap);
    assert.ok(r && r[0] === sum, String(gap));
    assert.equal(r[1].content, COMPACT_TRUNCATED);
    assert.ok(r.length < msgs.length);
  }
  const t = transcriptText(msgs, 5000);
  assert.ok(t.includes("earlier summary text"));
  assert.ok(t.length < 6000);
});

test("B7-7 (M-f-28) a reply without a <summary> block is not taken as a summary", async () => {
  assert.equal(hasSummary("Sure, here is the fix"), false);
  assert.equal(hasSummary("<analysis>x</analysis><summary>y</summary>"), true);
  const src = await readFile(new URL("../container/coder-agent.mjs", import.meta.url), "utf8");
  assert.ok(src.includes("if (text && hasSummary(said)) return { text, headCut };"));
});

test("B7-8 (I53, M-f-03) brace expansion is bounded and done once; {ts,tsx} still works", () => {
  assert.equal(globAny(["src/*.{ts,tsx}"], "src/a.ts"), true);
  assert.equal(globAny(["src/*.{ts,tsx}"], "src/a.tsx"), true);
  const many = "{a,b}".repeat(59);
  const t0 = Date.now();
  assert.equal(globAny([many], "x.md"), false);
  assert.ok(Date.now() - t0 < 50);
  const big = "{1,2,3,4,5,6,7,8,9,0}{1,2,3,4,5,6,7,8,9,0}{1,2,3,4,5,6,7,8,9,0}{a,b}";
  const list = expandBraces(["*.{md,txt}", big, "lib/*.{js,mjs}"]);
  assert.ok(list.includes(big) && list.includes("lib/*.mjs") && list.includes("*.md"));
  assert.equal(globAny(["*.{md,txt}", big, "lib/*.{js,mjs}"], "lib/a.mjs"), true);
  assert.equal(globAny([big], "1a"), false);
});

test("B7-9 (M-a-23) square brackets in a rule's pattern", () => {
  assert.equal(globMatch("src/[abc].ts", "src/a.ts"), true);
  assert.equal(globMatch("src/[abc].ts", "src/d.ts"), false);
  assert.equal(globMatch("file[0-9].js", "file3.js"), true);
  assert.equal(globMatch("file[!0-9].js", "file3.js"), false);
  assert.equal(globMatch("photos [2024/**", "photos [2024/x.jpg"), false);
  assert.equal(globMatch("photos \\[2024/**", "photos [2024/x.jpg"), true);
  assert.equal(globAny(["photos [2024/**", "*.md"], "a.md"), true);
});
