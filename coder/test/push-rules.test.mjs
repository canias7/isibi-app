// CODER'S PUSH AND PULL REQUEST GO THROUGH THE RULES AND AUTO'S CHECKER (the audit, 2026-11-20; Claude Code's auto-mode docs:
// "These rules match commands that begin with `git push` or `gh pr create`"): push_branch is `git push origin <branch>`,
// pull_request is `gh pr create`, and the push before Coder's answer is a push too.
import { test } from "node:test";
import assert from "node:assert/strict";

const ROOT = "/work/shop";
const A = await import("../container/coder-agent.mjs");
const CHECK = /THE ACTION TO JUDGE:/;
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });

async function job(steps, { mode = "acceptEdits", rules = null, checker = false, verdict = () => '{"decision":"allow"}', answers = [] } = {}) {
  const events = [], seen = [], checks = [], cards = [], pushes = [], prs = [];
  let n = 0, k = 0;
  const r = await A.runCoder({
    send: async (req) => {
      if (CHECK.test(String((req.messages[1] || {}).content || ""))) { checks.push(String(req.messages[1].content)); return { message: { role: "assistant", content: verdict() }, usage: { in: 1, out: 1 } }; }
      seen.push(req);
      return steps[Math.min(n++, steps.length - 1)];
    },
    exec: async (x) => (/--porcelain=v1/.test(x.command) ? { code: 0, output: "__git_rc=128\n" } : { code: 0, output: "ok\n" }),
    emit: (e) => events.push(e), sleep: async () => {},
    here: () => ROOT, root: ROOT, home: "/home/dev", chatId: "shop-push", where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p),
    pushNow: async (m) => { pushes.push(m); return { ok: true, pushed: true, sha: "abcdef1234" }; },
    envApi: async (x) => { prs.push(x); return { number: 7, url: "https://github.com/ana/shop/pull/7" }; },
    ask: async (pid) => { cards.push(events.find((e) => e.type === "permission" && e.pid === pid)); return answers[k++] || { choice: "yes" }; },
  }, { text: "work on the shop", mode, rules, checker, checkWhere: { key: "k" + Math.random(), repo: "ana/shop", branch: "coder/shop-1" } });
  const told = (id) => { for (const req of seen) for (const m of req.messages) if (m.role === "tool" && m.tool_call_id === id) return m.content; return ""; };
  return { r, events, checks, cards, pushes, prs, told };
}
const push = [say("", [call("push_branch", { message: "save" }, "p1")]), say("done")];
const pr = [say("", [call("pull_request", { title: "Fix the cart" }, "q1")]), say("done")];

test("PR1 a Bash(git push *) deny rule refuses push_branch; an ask rule shows a card first", async () => {
  let t = await job(push, { rules: { allow: [], ask: [], deny: ["Bash(git push *)"] } });
  assert.equal(t.pushes.length, 0);
  assert.match(t.told("p1"), /has been denied/);
  t = await job(push, { rules: { allow: [], ask: ["Bash(git push *)"], deny: [] }, answers: [{ choice: "no" }] });
  assert.equal(t.cards.length, 1);
  assert.match(JSON.stringify(t.cards[0]), /git push origin coder\/shop-1/);
  assert.equal(t.pushes.length, 0);
  t = await job(push, { rules: { allow: [], ask: ["Bash(git push *)"], deny: [] }, answers: [{ choice: "yes" }] });
  assert.equal(t.cards.length, 1);
  assert.equal(t.pushes.length, 1);
  // (No rule: pushed with no card, as Claude Code's cloud session pushes its own branch.)
  t = await job(push);
  assert.deepEqual([t.cards.length, t.pushes.length], [0, 1]);
});

test("PR2 a Bash(gh pr create *) deny rule refuses pull_request", async () => {
  const t = await job(pr, { rules: { allow: [], ask: [], deny: ["Bash(gh pr create *)"] } });
  assert.deepEqual([t.pushes.length, t.prs.length], [0, 0]);
  assert.match(t.told("q1"), /has been denied/);
  const ok = await job(pr);
  assert.equal(ok.prs.length, 1);
});

test("PR3 in Auto, the checker judges a push as the command git push, and its block stops it", async () => {
  const t = await job(push, { mode: "auto", checker: true, verdict: () => '{"decision":"block","rule":"Owner said no","reason":"the owner said not to push"}' });
  assert.equal(t.checks.length, 1);
  assert.match(t.checks[0], /git push origin coder\/shop-1/);
  assert.equal(t.pushes.length, 0);
  const ok = await job(push, { mode: "auto", checker: true });
  assert.deepEqual([ok.checks.length, ok.pushes.length], [1, 1]);
});
