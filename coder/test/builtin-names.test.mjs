// L-second-30 (2026-11-19): names built into JavaScript (constructor, valueOf, toString, __proto__) are no tool and no
// read-only program: a tool by that name gets "No such tool available", a command by that name asks, nothing crashes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bashDecision } from "../container/coder-perms.mjs";
import { job } from "./ask-user-input.test.mjs";

const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });

test("L-second-30 constructor/valueOf/toString/__proto__ ask as commands and are no tools", async () => {
  for (const mode of ["acceptEdits", "plan"]) for (const c of ["constructor", "valueOf", "toString *", "__proto__", "hasOwnProperty x"]) {
    assert.equal(bashDecision(c, { mode, rules: {}, cwd: "/work/shop", workdirs: ["/work/shop"] }).verdict, "ask", mode + " " + c);
  }
  const t = await job([say("", [call("constructor", {}, "c1"), call("toString", {}, "c2"), call("bash", { command: "valueOf" }, "c3"), call("bash", { command: "__proto__" }, "c4")]), say("done")], { choice: "yes" });
  assert.match(t.told("c1"), /^Error: No such tool available: constructor/);
  assert.match(t.told("c2"), /^Error: No such tool available: toString/);
  assert.ok(t.told("c3") && t.told("c4"), "the commands get answers");
  assert.equal(t.cards.length, 2, "each command asks");
  assert.equal(t.seen.length, 2, "the turn goes on");
});
