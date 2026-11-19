// L-second-31 (2026-11-19): a tool input that cannot become text, like {"toString":1}, never crashes the job, and the
// Auto checker's summary of an old call holding one still reads.
import { test } from "node:test";
import assert from "node:assert/strict";
import { RUN_TOOLS, commandTimeoutS } from "../container/coder-agent.mjs";
import { checkerTranscript } from "../container/coder-checker.mjs";
import { pagesProblem } from "../container/coder-tools.mjs";
import { asText } from "../container/coder-text.mjs";
import { job } from "./ask-user-input.test.mjs";

const bad = { toString: 1 };
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });

test("L-second-31 labels, timeouts, pages and the checker's summary take {toString:1} without throwing", async () => {
  assert.equal(asText(bad), '{"toString":1}');
  for (const [name, spec] of Object.entries(RUN_TOOLS)) {
    const a = { path: bad, pages: bad, pattern: bad, operation: bad, filePath: bad, line: bad, url: bad, query: bad };
    assert.equal(typeof spec.label(a), "string", name);
  }
  assert.equal(typeof commandTimeoutS({ timeout: bad }), "number");
  assert.equal(typeof commandTimeoutS({ timeout_s: bad }), "number");
  assert.match(pagesProblem(bad), /^Invalid pages parameter/);
  const convo = [{ role: "user", content: "go" }, { role: "assistant", content: "", tool_calls: [call("write", { path: "a.js", content: bad }, "w1"), call("edit", { path: "b.js", old_string: bad, new_string: bad }, "e1")] }];
  assert.match(checkerTranscript(convo), /toString/);
  const t = await job([say("", [call("read", { path: bad }, "r1"), call("glob", { pattern: bad }, "g1"), call("bash", { command: "ls", timeout: bad }, "b1"), call("stop_job", { job: bad }, "s1")]), say("done")], { choice: "yes" });
  for (const id of ["r1", "g1", "b1", "s1"]) assert.ok(t.told(id), id + " answered");
  assert.equal(t.seen.length, 2, "the job goes on");
});
