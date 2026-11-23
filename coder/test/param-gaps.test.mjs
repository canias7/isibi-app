// LEFTOVER TOOL-PARAMETER GAPS (2026-11-23, the comparison sheet's "Tool parameters & limits" tab): TaskStop's task_id and
// its old name shell_id, Bash's dangerouslyDisableSandbox, PushNotification's status and result object, and the 1.5 seconds
// before a stopped command is force-killed. No paid calls: the model's replies are made here.
import { test } from "node:test";
import assert from "node:assert/strict";

const A = await import("../container/coder-agent.mjs");
const I = await import("../container/coder-inputs.mjs");
const H = await import("../container/coder-hooks.mjs");

const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const told = (out, id) => (out.messages.find((m) => m.role === "tool" && m.tool_call_id === id) || {}).content;
const schema = (name) => A.CODER_TOOLS.find((t) => t.function && t.function.name === name).function.parameters;

test("PG1 stop_job takes TaskStop's task_id and its deprecated shell_id (and Coder's job); none is refused", () => {
  assert.deepEqual(I.checkStopJobInput({ task_id: "job1" }), { args: { job: "job1" } });
  assert.deepEqual(I.checkStopJobInput({ shell_id: "job2" }), { args: { job: "job2" } });
  assert.deepEqual(I.checkStopJobInput({ job: "job3" }), { args: { job: "job3" } });
  assert.match(I.checkStopJobInput({}).error, /task_id/);
  assert.equal(I.inputCheckFor("stop_job"), I.checkStopJobInput);
  const p = schema("stop_job");
  assert.deepEqual([Object.keys(p.properties).sort(), p.required], [["job", "shell_id", "task_id"], []]);
  assert.match(p.properties.shell_id.description, /Deprecated: use task_id/);
});

test("PG2 hooks see TaskStop's task_id; a hook's task_id is the job that stops", () => {
  assert.deepEqual(H.hookToolInput("stop_job", { job: "job1" }), { job: "job1", task_id: "job1" });
  assert.deepEqual(H.toolInputFromHook("stop_job", { job: "job1", task_id: "job9" }), { job: "job9" });
  assert.deepEqual(H.toolInputFromHook("stop_job", { shell_id: "job4" }), { job: "job4" });
});

test("PG3 in Coder's loop: stop_job with task_id and with shell_id stops the job", async () => {
  let n = 0, alive = true;
  const out = await A.runCoder({
    send: async () => [say("", [call("bash", { command: "npm run dev", run_in_background: true }, "b1")]), say("", [call("stop_job", { task_id: "job1" }, "s1")]), say("", [call("stop_job", { shell_id: "job1" }, "s2")]), say("", [call("stop_job", {}, "s3")])][n++] || say("ok"),
    exec: async () => ({ code: -1, background: true, pid: 4321, log: "/srv/bg-1.log", output: "" }),
    bg: { alive: async () => alive, stop: async () => { alive = false; return true; }, status: async () => ({ alive: false, code: null, why: "coder" }) },
    emit: () => {}, here: () => "/work/p", root: "/work/p",
  }, { text: "go", mode: "auto" });
  assert.equal(JSON.parse(told(out, "s1")).task_id, "job1");
  assert.equal(told(out, "s2"), "Task job1 is not running (status: killed)");
  assert.match(told(out, "s3"), /give task_id/);
});

test("PG4 bash takes dangerouslyDisableSandbox (it changes nothing here, as in Claude Code's cloud sessions); notify takes status \"proactive\"", () => {
  assert.equal(schema("bash").properties.dangerouslyDisableSandbox.type, "boolean");
  assert.deepEqual(schema("notify").properties.status.enum, ["proactive"]);
});

test("PG5 a stopped command without Coder's service is force-killed 1.5 seconds after it was asked to stop (Claude Code: \"force-kill background commands still running 1.5 seconds after being asked to stop\")", async () => {
  const seen = [];
  let n = 0;
  await A.runCoder({
    send: async () => [say("", [call("bash", { command: "npm run dev", run_in_background: true }, "b1")]), say("", [call("stop_job", { task_id: "job1" }, "s1")])][n++] || say("ok"),
    exec: async (x) => { seen.push(x.command); return /kill -TERM/.test(x.command) ? { code: 0, output: "[stopped job1]" } : { code: -1, background: true, pid: 4321, log: "/srv/bg-1.log", output: "" }; },
    emit: () => {}, here: () => "/work/p", root: "/work/p",
  }, { text: "go", mode: "auto" });
  assert.ok(seen.some((c) => /kill -TERM -- -4321 2>\/dev\/null; sleep 1\.5; kill -KILL/.test(c)));
});

test("PG6 PostToolUse hooks get PushNotification's result object and Bash's dangerouslyDisableSandbox", async () => {
  const hookCalls = [];
  let n = 0;
  await A.runCoder({
    send: async () => [say("", [call("notify", { message: "Tests done", status: "proactive" }, "n1"), call("bash", { command: "ls", description: "List", dangerouslyDisableSandbox: true }, "b1")])][n++] || say("ok"),
    exec: async (x) => {
      const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
      if (mark && x.hook === true) { hookCalls.push(JSON.parse(x.payload)); return { code: 0, output: "\n" + mark[0] + "\n" }; }
      return { code: 0, output: "ok\n" };
    },
    emit: () => {}, here: () => "/work/shop", root: "/work/shop", chatId: "shop-h1", where: (p) => (p.startsWith("/") ? p : "/work/shop/" + p),
  }, { text: "go", mode: "auto", hooks: H.hooksFrom({ hooks: { PostToolUse: [{ hooks: [{ type: "command", command: "post.sh" }] }] } }, "settings").list });
  const post = (name) => hookCalls.find((c) => c.hook_event_name === "PostToolUse" && c.tool_name === name);
  const pn = post("PushNotification").tool_response;
  assert.deepEqual([pn.message, pn.pushSent, typeof pn.sentAt], ["Tests done", true, "string"]);
  assert.equal(post("Bash").tool_response.dangerouslyDisableSandbox, true);
});
