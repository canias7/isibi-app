// L-machine-45 (2026-11-19): a tool call whose input is no object (a number, true, an object sent as a string) gets an
// input error for that call, and the turn goes on, as in Claude Code.
import { test } from "node:test";
import assert from "node:assert/strict";

const raw = (name, argsText, id) => ({ id, type: "function", function: { name, arguments: argsText } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });

export async function job(steps, { mode = "acceptEdits", choice = "no" } = {}) {
  const { runCoder } = await import("../container/coder-agent.mjs");
  const events = [], seen = [], ran = [], cards = [];
  let n = 0;
  const r = await runCoder({
    send: async (req) => { seen.push(req); return steps[Math.min(n++, steps.length - 1)]; },
    exec: async (x) => { if (!x.tool) ran.push(x.command); return { code: 0, output: "ok\n" }; },
    emit: (e) => events.push(e),
    here: () => "/work/shop", root: "/work/shop", where: (p) => (p.startsWith("/") ? p : "/work/shop/" + p),
    ask: async (pid) => { cards.push(events.find((e) => e.type === "permission" && e.pid === pid)); return { choice }; },
  }, { text: "go", mode, checker: false, checkWhere: { key: "ai-" + Math.random() } });
  const told = (id) => (r.messages.find((m) => m.role === "tool" && m.tool_call_id === id) || {}).content || "";
  return { r, events, seen, ran, cards, told };
}

test("L-machine-45 ask_user with 5, true or a doubly encoded object gets an input error and the turn ends done", async () => {
  const twice = JSON.stringify(JSON.stringify({ questions: [{ question: "Which?", options: [{ label: "a" }, { label: "b" }] }] }));
  const t = await job([say("", [raw("ask_user", "5", "a1"), raw("ask_user", "true", "a2"), raw("ask_user", twice, "a3"), raw("bash", "[1]", "a4")]), say("done")]);
  for (const id of ["a1", "a2", "a3", "a4"]) assert.match(t.told(id), /InputValidationError/, id);
  assert.equal(t.seen.length, 2, "Grok is asked again");
  assert.notEqual(t.r.status, "error");
});
