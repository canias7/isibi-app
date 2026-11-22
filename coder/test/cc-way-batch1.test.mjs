import { test } from "node:test";
import assert from "node:assert/strict";
import * as S from "../container/server.mjs";

test("M-c-57 every command also gets Claude Code's own names: CLAUDECODE=1, CLAUDE_CODE_SESSION_ID, CLAUDE_CODE_REMOTE_SESSION_ID and CLAUDE_EFFORT, and a repository's env cannot set them", () => {
  const m = S.coderMarks("shop-q9", "", "max");
  assert.equal(m.CLAUDECODE, "1");
  assert.equal(m.CLAUDE_CODE_SESSION_ID, "shop-q9");
  assert.equal(m.CLAUDE_CODE_REMOTE_SESSION_ID, "shop-q9");
  assert.equal(m.CLAUDE_EFFORT, "max");
  assert.equal(S.coderMarks("shop-q9", "").CLAUDE_EFFORT, undefined, "no effort: not set, as Claude Code");
  assert.equal(S.coderMarks("", "").CLAUDE_CODE_SESSION_ID, undefined, "no chat id: no session id");
  for (const k of ["CLAUDECODE", "CLAUDE_CODE_SESSION_ID", "CLAUDE_CODE_REMOTE_SESSION_ID", "CLAUDE_EFFORT"]) assert.ok(S.REPO_ENV_OFF.test(k), k);
});

import { compactLimits, contextWarning } from "../container/coder-compact.mjs";
test("MISS-80 a warning before the chat is summarized, in Claude Code's words", () => {
  const L = compactLimits({ contextWindow: 500_000, pct: 92 });
  assert.equal(contextWarning(L.warn - 1, L), "", "below the warning: nothing");
  assert.match(contextWarning(L.warn + 10, L), /^Context left until auto-compact: \d+%$/);
  assert.equal(contextWarning(L.threshold - 4_400, L), "Context left until auto-compact: " + Math.round(4_400 / L.threshold * 100) + "%");
  const off = compactLimits({ contextWindow: 500_000, enabled: false });
  assert.match(contextWarning(off.warn + 1, off), /^Context low \(\d+% remaining\) · Run \/compact to compact & continue$/);
  assert.equal(contextWarning(L.threshold + 1, L), "", "at the threshold it compacts instead");
});

const ROOT = "/work/shop";
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
async function job(steps, answers) {
  const { runCoder } = await import("../container/coder-agent.mjs");
  const events = [], cards = [];
  let n = 0, k = 0;
  const r = await runCoder({
    send: async () => steps[Math.min(n++, steps.length - 1)],
    exec: async () => ({ code: 0, output: "ok\n" }),
    emit: (e) => events.push(e),
    here: () => ROOT, root: ROOT, where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p),
    ask: async (pid) => { cards.push(events.find((e) => e.type === "permission" && e.pid === pid)); return answers[k++] || null; },
  }, { text: "go", mode: "acceptEdits" });
  return { r, events, cards };
}

test("MISS-64 a card for the project's .claude folder offers Claude Code's 'Yes, and allow … to edit its own settings for this session'; chosen, later .claude edits in the job don't ask", async () => {
  const steps = [say("", [call("write", { path: ".claude/settings.json", content: "{}\n" }, "w1")]), say("", [call("write", { path: ".claude/commands/x.md", content: "hi\n" }, "w2")]), say("Done.")];
  const a = await job(steps, [{ choice: "claudeDir" }]);
  assert.equal(a.cards.length, 1, "the second .claude write did not ask");
  assert.equal(a.cards[0].claudeDir, true);
  const b = await job(steps, [{ choice: "yes" }, { choice: "yes" }]);
  assert.equal(b.cards.length, 2, "a plain Yes is for that one edit only");
  const c = await job([say("", [call("write", { path: ".husky/pre-commit", content: "x\n" }, "w1")]), say("ok")], [{ choice: "no" }]);
  assert.equal(c.cards[0].claudeDir, undefined, "only for the .claude folder");
});

test("MISS-64 the page shows the option and its answer line", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  assert.match(src, /\['claudeDir', 'Yes, and allow Coder to edit its own settings for this session'\]/);
  const srv = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(srv, /\["yes", "always", "claudeDir",/);
});
