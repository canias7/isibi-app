// COMMITTED AND PUSHED INSIDE THE TURN, CLAUDE CODE'S WAY (the owner, 2026-11-17: "do it the claude code way"; the page sat on
// "Saving to the branch…" for 8 minutes while the push ran after the turn). No model or GitHub is called.
import test from "node:test";
import assert from "node:assert/strict";
import { runCoder } from "../container/coder-agent.mjs";

const call = (name, args, id = name + "1") => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const script = (turns) => { let n = 0; const seen = []; return { seen, send: async (q) => { seen.push(q); const last = q.messages[q.messages.length - 1]; if (q.tool_choice === "none" && last && /commit/i.test(String(last.content))) return say("Add hello file"); return turns[Math.min(n++, turns.length - 1)]; } }; };

test("PT1 a turn that changed files pushes before its answer is done: a Push step with its result, the commit kept, nothing left for the turn's end", async () => {
  const s = script([say("", [call("write", { path: "a.txt", content: "hi\n" })]), say("Added a.txt.")]);
  const events = [], asked = [];
  const r = await runCoder({ send: s.send, exec: async () => ({ code: 0, output: "" }), writeFile: async () => {}, emit: (e) => events.push(e), dirtyNow: async () => true, pushNow: async (m) => { asked.push(m); return { ok: true, pushed: true, changed: true, sha: "abcdef1234567" }; } }, { text: "add a.txt" });
  assert.equal(asked.length, 1);
  assert.equal(r.push, undefined, "nothing pushed again after the turn");
  assert.equal(r.midPushes.length, 1);
  const push = events.findIndex((e) => e.type === "bash" && e.tool === "push_branch");
  const done = events.findIndex((e) => e.type === "done");
  assert.ok(push >= 0 && push < done, "the push is a step shown before the turn is done");
  assert.ok(events.some((e) => e.type === "result" && e.code === 0 && /pushed to GitHub now \(commit abcdef1\)/.test(e.output)));
});

test("PT2 nothing changed: no push step; a failed push is shown and left for the turn's end; never from GitHub or a read-only chat", async () => {
  let events = [], n = 0;
  await runCoder({ send: script([say("Nothing to do.")]).send, exec: async () => ({ code: 0, output: "" }), emit: (e) => events.push(e), dirtyNow: async () => false, pushNow: async () => { n++; return { ok: true }; } }, { text: "hi" });
  assert.equal(n, 0);
  assert.ok(!events.some((e) => e.tool === "push_branch"));
  events = [];
  const r = await runCoder({ send: script([say("Done.")]).send, exec: async () => ({ code: 0, output: "" }), emit: (e) => events.push(e), dirtyNow: async () => true, pushNow: async () => ({ ok: false, why: "could not push: busy" }) }, { text: "hi" });
  assert.equal(r.push, true, "tried again when the turn is saved");
  assert.ok(events.some((e) => e.type === "result" && e.code === 1 && /busy/.test(e.output)));
  for (const opts of [{ github: true }, { readOnly: { main: true } }]) {
    n = 0;
    await runCoder({ send: script([say("Done.")]).send, exec: async () => ({ code: 0, output: "" }), dirtyNow: async () => true, pushNow: async () => { n++; return { ok: true }; } }, { text: "hi", ...opts });
    assert.equal(n, 0);
  }
});

test("PT3 two repositories: the push's result names each one", async () => {
  const s = script([say("", [call("push_branch", {})]), say("ok")]);
  await runCoder({ send: s.send, exec: async () => ({ code: 0, output: "" }), dirtyNow: async () => false, pushNow: async () => ({ ok: true, pushed: true, changed: true, sha: "1111111aaaa", extra: [{ repo: "o/two", ok: true, pushed: true, sha: "2222222bbbb" }, { repo: "o/three", ok: true, pushed: false }] }) }, { text: "push" });
  const t = String(s.seen[1].messages.filter((m) => m.role === "tool").pop().content);
  assert.match(t, /commit 1111111/);
  assert.match(t, /o\/two: pushed \(commit 2222222\)/);
  assert.match(t, /o\/three: nothing new to push/);
});
