// CLAUDE CODE'S TASK LIST IN PLACE OF CODER'S TODO (the owner, 2026-11-14: "Do all the talk to you tools execpt for the notify
// one"): Claude Code on the web has TaskCreate, TaskGet, TaskList and TaskUpdate (its tools reference, "Task tool
// availability"), so Coder has them as task_create, task_get, task_list and task_update (container/coder-tasks.mjs), as Claude
// Code 2.1.325 has them: what the model is told, the fixes and checks before any hook, the answers and result objects, the
// TaskCreated and TaskCompleted hooks, its reminder, the chat's list kept between messages, and the page's checklist.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync, symlinkSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const K = await import("../container/coder-tasks.mjs");
const A = await import("../container/coder-agent.mjs");
const H = await import("../container/coder-hooks.mjs");
const P = await import("../container/coder-perms.mjs");
const G = await import("../container/gloopy-agent.mjs");
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const ROOT = "/work/shop";
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
/** The chat's list on a pretend machine (what server.mjs's taskStore keeps in its file). */
function memoryStore(start = null) {
  let saved = start ? JSON.parse(JSON.stringify(start)) : null;
  return { now: () => saved, load: async () => saved, save: async (st) => { saved = JSON.parse(JSON.stringify(st)); } };
}
/** Coder's loop on a pretend machine: hooks answered by `hookRun(input)`; cards by `answers` (else "yes"). */
async function job(steps, { hooks = null, hookRun = () => ({}), store = null, rules = null, answers = [], extra = {}, deps: more = {} } = {}) {
  const events = [], seen = [], hookCalls = [], cards = [];
  let n = 0, k = 0;
  const r = await A.runCoder({
    send: async (req) => { seen.push(req); return steps[Math.min(n++, steps.length - 1)]; },
    exec: async (x) => {
      const mark = /<<coder-hook-stderr-[a-z0-9]+>>/.exec(String(x.command));
      if (mark && x.hook === true) {
        const input = JSON.parse(x.payload);
        hookCalls.push(input);
        const a = (await hookRun(input)) || {};
        return { code: Number.isInteger(a.code) ? a.code : 0, output: String(a.stdout || "") + "\n" + mark[0] + "\n" + String(a.stderr || "") };
      }
      return { code: 0, output: "ok\n" };
    },
    emit: (e) => events.push(e),
    ...(store ? { tasks: store } : {}),
    here: () => ROOT, root: ROOT, chatId: "shop-tk", where: (p) => (p.startsWith("/") ? p : ROOT + "/" + p),
    ask: async (pid) => { cards.push(events.find((e) => e.type === "permission" && e.pid === pid)); return answers[k++] || { choice: "yes" }; },
    ...more,
  }, { text: "go", mode: "auto", rules, ...(hooks ? { hooks: H.hooksFrom({ hooks }, "settings").list } : {}), ...extra });
  const told = (id) => { for (const req of seen) for (const m of req.messages) if (m.role === "tool" && m.tool_call_id === id) return m.content; return undefined; };
  return { r, events, seen, hookCalls, cards, told };
}
const hk = (cmd) => [{ hooks: [{ type: "command", command: cmd }] }];

test("TK1 Claude Code's four task tools are Coder's in place of todo: their descriptions word for word (Coder's names where one sends Coder to another, \"the owner\" for \"the user\"), strict inputs, Claude Code's names for hooks and rules, its system prompt's line; Gloopy keeps its own todo", () => {
  const names = A.CODER_TOOLS.map((t) => t.function.name);
  // (enter_plan_mode, Claude Code's EnterPlanMode, after ask_user since 2026-11-14.)
  assert.deepEqual(names.slice(names.indexOf("ask_user"), names.indexOf("ask_user") + 7), ["ask_user", "enter_plan_mode", "task_create", "task_get", "task_list", "task_update", "bash"]);
  assert.ok(!names.includes("todo"), "no todo for Coder");
  const tool = (n) => A.CODER_TOOLS.find((t) => t.function.name === n).function;
  // Claude Code's prompts, as their descriptions.
  assert.equal(tool("task_create").description, K.TASK_CREATE_PROMPT);
  assert.match(K.TASK_CREATE_PROMPT, /^Use this tool to create a structured task list for your current coding session\. This helps you track progress, organize complex tasks, and demonstrate thoroughness to the owner\.\nIt also helps the owner understand the progress of the task and overall progress of their requests\.\n\n## When to Use This Tool\n/);
  assert.ok(K.TASK_CREATE_PROMPT.includes("- **activeForm** (optional): Present continuous form shown in the spinner when the task is in_progress (e.g., \"Fixing authentication bug\"). If omitted, the spinner shows the subject instead.\n\nAll tasks are created with status `pending`.\n"));
  assert.ok(K.TASK_CREATE_PROMPT.endsWith("## Tips\n\n- Create tasks with clear, specific subjects that describe the outcome\n- After creating tasks, use task_update to set up dependencies (blocks/blockedBy) if needed\n- Check task_list first to avoid creating duplicate tasks\n"));
  assert.equal(tool("task_get").description, K.TASK_GET_PROMPT);
  assert.ok(K.TASK_GET_PROMPT.endsWith("- After fetching a task, verify its blockedBy list is empty before beginning work.\n- Use task_list to see all tasks in summary form.\n"));
  assert.equal(tool("task_update").description, K.TASK_UPDATE_PROMPT);
  assert.ok(K.TASK_UPDATE_PROMPT.includes("- After resolving, call task_list to find your next task\n"));
  assert.ok(K.TASK_UPDATE_PROMPT.includes("Status progresses: `pending` → `in_progress` → `completed`\n\nUse `deleted` to permanently remove a task.\n\n## Staleness\n\nMake sure to read a task's latest state using `task_get` before updating it.\n"));
  assert.ok(K.TASK_UPDATE_PROMPT.endsWith("Set up task dependencies:\n```json\n{\"taskId\": \"2\", \"addBlockedBy\": [\"1\"]}\n```\n"));
  assert.equal(tool("task_list").description, K.TASK_LIST_PROMPT);
  assert.ok(K.TASK_LIST_PROMPT.includes("- **id**: Task identifier (use with task_get, task_update)\n"));
  assert.ok(K.TASK_LIST_PROMPT.endsWith("Use task_get with a specific task ID to view full details including description and comments.\n"));
  // (Only an agent team's parts are left out, as in a session without one; no mention of Claude Code's own names for these.)
  for (const p of [K.TASK_CREATE_PROMPT, K.TASK_GET_PROMPT, K.TASK_LIST_PROMPT, K.TASK_UPDATE_PROMPT]) {
    assert.doesNotMatch(p, /teammate|TaskCreate|TaskGet|TaskList|TaskUpdate|Claude|\buser\b/i);
  }
  // Their inputs, as Claude Code's strict schemas.
  const params = (n) => tool(n).parameters;
  assert.deepEqual([params("task_create").required, params("task_create").additionalProperties, Object.keys(params("task_create").properties)], [["subject", "description"], false, ["subject", "description", "activeForm", "metadata"]]);
  assert.equal(params("task_create").properties.activeForm.description, "Present continuous form shown in spinner when in_progress (e.g., \"Running tests\")");
  assert.deepEqual([params("task_get").required, params("task_get").properties.taskId.description], [["taskId"], "The ID of the task to retrieve"]);
  assert.deepEqual([params("task_list").properties, params("task_list").additionalProperties], [{}, false]);
  assert.deepEqual(Object.keys(params("task_update").properties), ["taskId", "subject", "description", "activeForm", "status", "addBlocks", "addBlockedBy", "owner", "metadata"]);
  assert.deepEqual(params("task_update").properties.status.enum, ["pending", "in_progress", "completed", "deleted"]);
  assert.equal(params("task_update").properties.metadata.description, "Metadata keys to merge into the task. Set a key to null to delete it.");
  // Claude Code's names, for hooks (tool_name, matchers) and rules.
  assert.deepEqual(K.TASK_TOOL_NAMES.map((n) => H.ccTool(n)), ["TaskCreate", "TaskGet", "TaskList", "TaskUpdate"]);
  for (const n of ["TaskCreate", "TaskGet", "TaskList", "TaskUpdate"]) assert.deepEqual(P.parseRule(n), { tool: n, spec: null });
  assert.deepEqual([P.parseRule("TaskCreate(*)"), P.parseRule("TaskUpdate(x)")], [{ tool: "TaskCreate", spec: null }, null], "whole-tool rules only, as TodoWrite's");
  // Claude Code's system prompt's line for them ("# Using your tools"), and the tool list.
  assert.ok(A.CODER_SYSTEM.includes("\n- Use task_create to plan and track work. Mark each task completed as soon as it's done; don't batch.\n"));
  assert.ok(A.CODER_SYSTEM.includes("task_create, task_get, task_list and task_update (your task list, which the owner sees)"));
  assert.doesNotMatch(A.CODER_SYSTEM, /\btodo \(/);
  // Gloopy keeps its own checklist, where it was among its tools.
  const gl = G.GLOOPY_TOOLS.map((t) => t.function.name);
  assert.equal(gl[gl.indexOf("ask_user") + 1], "todo");
  assert.ok(!gl.some((n) => K.isTaskTool(n)));
  assert.match(G.TODO_TOOL.function.description, /^Your checklist for a job with several steps/);
  // The machine's copy holds the new module (CD78 checks every import).
  const copy = read("container/Dockerfile").split("\n").find((l) => /^COPY package\.json /.test(l));
  assert.ok(copy.includes(" coder-tasks.mjs "));
});

test("TK2 a call's input as Claude Code takes it, before any hook: TaskCreate's and TaskUpdate's fixes, then the strict schema, refused in Claude Code's words (\"InputValidationError: TaskCreate failed due to the following issue: …\"), with its hint for a call that sends a list", () => {
  const ok = (name, args) => K.checkTaskInput(name, args).args;
  const bad = (name, args) => K.checkTaskInput(name, args).error;
  assert.deepEqual(ok("task_create", { subject: "Fix it", description: "The login" }), { subject: "Fix it", description: "The login" });
  // TaskCreate's fixes (Claude Code's coerceInput).
  assert.deepEqual(ok("task_create", { title: "Fix bug", content: "In login" }), { subject: "Fix bug", description: "In login" });
  assert.deepEqual(ok("task_create", { name: "Fix bug", active_form: "Fixing bug" }), { subject: "Fix bug", activeForm: "Fixing bug", description: "Fix bug" }, "a description from the subject");
  assert.deepEqual(ok("task_create", { task: "Run the tests" }), { description: "Run the tests", subject: "Run the tests" });
  assert.deepEqual(ok("task_create", { task: { subject: "a", description: "b", priority: "high" } }), { subject: "a", description: "b" });
  assert.deepEqual(ok("task_create", { subject: "a", description: "b", status: "pending", owner: "me", id: "4", activeForm: 3, metadata: [1] }), { subject: "a", description: "b" }, "other inputs dropped, as Claude Code drops them");
  assert.deepEqual(ok("task_create", { subject: "a", description: "b", metadata: { k: 1 } }), { subject: "a", description: "b", metadata: { k: 1 } });
  // A subject made from a description: its first line, at most 80 characters, cut at a space past the 40th.
  const long = "Rewrite the payment form so that the card field validates on blur and shows errors inline\nthen more";
  assert.equal(ok("task_create", { description: long }).subject, "Rewrite the payment form so that the card field validates on blur and shows");
  assert.equal(K.subjectFrom("Short one\nsecond line"), "Short one");
  assert.equal(K.subjectFrom("x".repeat(90)), "x".repeat(80));
  // A list in one call: refused, with Claude Code's hint first.
  assert.equal(bad("task_create", { tasks: [{ subject: "a", description: "b" }] }), "error: InputValidationError: task_create creates ONE task per call and has no `tasks` or `todos` parameter. Call task_create once per task, passing `subject` (a brief title) and `description` (what needs to be done) as top-level string parameters.\n\nTaskCreate failed due to the following issues:\nThe required parameter `subject` is missing\nThe required parameter `description` is missing\nAn unexpected parameter `tasks` was provided");
  assert.match(bad("task_create", { task: { todos: [] } }), /^error: InputValidationError: task_create creates ONE task per call/);
  // A subagent's inputs: no fix (Claude Code's other hint names its Agent tool, which Coder doesn't have).
  assert.equal(bad("task_create", { prompt: "do x", subagent_type: "general" }), "error: InputValidationError: TaskCreate failed due to the following issues:\nThe required parameter `subject` is missing\nThe required parameter `description` is missing\nAn unexpected parameter `prompt` was provided\nAn unexpected parameter `subagent_type` was provided");
  assert.equal(bad("task_create", { subject: 4, description: "b" }), "error: InputValidationError: TaskCreate failed due to the following issue:\nThe parameter `subject` type is expected as `string` but provided as `number`");
  // TaskUpdate's fixes: id or task_id for taskId, active_form for activeForm.
  assert.deepEqual(ok("task_update", { id: "3", active_form: "Running" }), { taskId: "3", activeForm: "Running" });
  assert.deepEqual(ok("task_update", { task_id: "3", status: "deleted" }), { taskId: "3", status: "deleted" });
  assert.equal(bad("task_update", { taskId: 3 }), "error: InputValidationError: TaskUpdate failed due to the following issue:\nThe parameter `taskId` type is expected as `string` but provided as `number`");
  // Only a value wrong (no parameter missing, unexpected or of the wrong type): zod's own message, its issues as JSON, as
  // Claude Code's w0 gives it (checked against zod 4.6.2 itself).
  assert.equal(bad("task_update", { taskId: "1", status: "done" }), "error: InputValidationError: " + JSON.stringify([{ code: "invalid_union", errors: [[{ code: "invalid_value", values: ["pending", "in_progress", "completed"], path: [], message: 'Invalid option: expected one of "pending"|"in_progress"|"completed"' }], [{ code: "invalid_value", values: ["deleted"], path: [], message: 'Invalid input: expected "deleted"' }]], path: ["status"], message: "Invalid input" }], null, 2));
  // With a parameter of the wrong type too: Claude Code's lines, the union's last ("matches none of the accepted forms" when
  // its message says nothing more).
  assert.equal(bad("task_update", { taskId: 1, status: "done" }), "error: InputValidationError: TaskUpdate failed due to the following issues:\nThe parameter `taskId` type is expected as `string` but provided as `number`\nThe parameter `status` matches none of the accepted forms");
  assert.equal(bad("task_update", { taskId: "1", addBlocks: "2", addBlockedBy: [2], metadata: null }), "error: InputValidationError: TaskUpdate failed due to the following issues:\nThe parameter `addBlocks` type is expected as `array` but provided as `string`\nThe parameter `addBlockedBy[0]` type is expected as `string` but provided as `number`\nThe parameter `metadata` type is expected as `record` but provided as `null`");
  assert.deepEqual(ok("task_update", { taskId: "1", addBlocks: ["2"], metadata: { a: null } }), { taskId: "1", addBlocks: ["2"], metadata: { a: null } });
  assert.equal(bad("task_get", {}), "error: InputValidationError: TaskGet failed due to the following issue:\nThe required parameter `taskId` is missing");
  assert.equal(bad("task_list", { all: true }), "error: InputValidationError: TaskList failed due to the following issue:\nAn unexpected parameter `all` was provided");
  assert.deepEqual(ok("task_list", {}), {});
  assert.deepEqual(K.checkTaskInput("bash", { command: "ls" }), { args: { command: "ls" } }, "only the task tools");
});

test("TK3 the list's rules and Claude Code's answers: ids from 1, never used twice; TaskUpdate's fields in its order; deleting takes the id off other tasks' links; TaskList hides _internal tasks and completed blockers; TaskGet shows them all", async () => {
  const st = K.emptyTasks();
  const t1 = K.createTask(st, { subject: "Add tests", description: "Cart tests", activeForm: "Adding tests" });
  const t2 = K.createTask(st, { subject: "Run them", description: "npm test" });
  const t3 = K.createTask(st, { subject: "Ship", description: "Push it", metadata: { _internal: true } });
  assert.deepEqual([t1.id, t2.id, t3.id], ["1", "2", "3"]);
  assert.equal(K.createdText(t1), "Task #1 created successfully: Add tests");
  assert.deepEqual(K.createdFacts(t1), { task: { id: "1", subject: "Add tests", description: "Cart tests" } });
  const up = (input, o) => K.updateTask(st, input, o);
  let r = await up({ taskId: "1", status: "in_progress" });
  assert.deepEqual(r, { data: { success: true, taskId: "1", updatedFields: ["status"], statusChange: { from: "pending", to: "in_progress" } }, changed: true });
  assert.equal(K.updateText(r.data), "Updated task #1 status");
  r = await up({ taskId: "1", subject: "Add tests", status: "in_progress" });
  assert.equal(K.updateText(r.data), "Updated task #1 ", "nothing new: Claude Code's words as they are");
  assert.equal(r.changed, false);
  r = await up({ taskId: "2", owner: "alice", description: "npm test -- cart", metadata: { pr: 12 }, subject: "Run the tests" });
  assert.deepEqual(r.data.updatedFields, ["subject", "description", "owner", "metadata"], "in Claude Code's order");
  r = await up({ taskId: "2", metadata: { pr: null, ci: "green" } });
  assert.deepEqual([r.data.updatedFields, K.findTask(st, "2").metadata], [["metadata"], { ci: "green" }], "metadata merged; null removes a key");
  r = await up({ taskId: "1", addBlocks: ["2", "99"] });
  assert.equal(K.updateText(r.data), "Updated task #1 blocks", "a task not on the list is no link, as in Claude Code");
  assert.deepEqual([K.findTask(st, "1").blocks, K.findTask(st, "2").blockedBy], [["2"], ["1"]]);
  assert.equal(K.updateText((await up({ taskId: "2", addBlockedBy: ["1"] })).data), "Updated task #2 ", "already linked");
  assert.equal(K.getText(K.findTask(st, "2")), "Task #2: Run the tests\nStatus: pending\nDescription: npm test -- cart\nBlocked by: #1");
  assert.equal(K.getText(K.findTask(st, "1")), "Task #1: Add tests\nStatus: in_progress\nDescription: Cart tests\nBlocks: #2");
  assert.equal(K.getText(null), "Task not found");
  assert.deepEqual(K.getFacts(K.findTask(st, "1")), { task: { id: "1", subject: "Add tests", description: "Cart tests", status: "in_progress", blocks: ["2"], blockedBy: [] } });
  assert.deepEqual(K.getFacts(null), { task: null });
  assert.equal(K.listText(K.listTasks(st)), "#1 [in_progress] Add tests\n#2 [pending] Run the tests (alice) [blocked by #1]", "no _internal task");
  // A completed blocker no longer blocks, in TaskList; TaskGet still shows it.
  await up({ taskId: "1", status: "completed" });
  assert.deepEqual(K.listTasks(st)[1], { id: "2", subject: "Run the tests", status: "pending", owner: "alice", blockedBy: [] });
  assert.match(K.getText(K.findTask(st, "2")), /\nBlocked by: #1$/);
  // A TaskCompleted hook that blocks: nothing changes, its words are the answer.
  r = await up({ taskId: "2", status: "completed", subject: "Other" }, { beforeComplete: async (t) => [K.taskHookFeedback("TaskCompleted", "[command hook]: tests fail on " + t.subject)] });
  assert.deepEqual(r, { data: { success: false, taskId: "2", updatedFields: [], error: "TaskCompleted hook feedback:\n[command hook]: tests fail on Run the tests" }, changed: false });
  assert.equal(K.updateText(r.data), "TaskCompleted hook feedback:\n[command hook]: tests fail on Run the tests");
  assert.equal(K.findTask(st, "2").subject, "Run the tests");
  // Deleted: gone, its id off the others' links, and never given again.
  r = await up({ taskId: "1", status: "deleted", subject: "ignored" });
  assert.deepEqual(r.data, { success: true, taskId: "1", updatedFields: ["deleted"], statusChange: { from: "completed", to: "deleted" } });
  assert.equal(K.updateText(r.data), "Updated task #1 deleted");
  assert.deepEqual(K.findTask(st, "2").blockedBy, []);
  K.deleteTask(st, "3");
  assert.equal(K.createTask(st, { subject: "Next", description: "n" }).id, "4", "3 was the highest: not used again");
  assert.deepEqual((await up({ taskId: "9", status: "completed" })).data, { success: false, taskId: "9", updatedFields: [], error: "Task not found" });
  assert.equal(K.updateText({ success: false, taskId: "9", updatedFields: [] }), "Task #9 not found");
  assert.equal(K.listText([]), "No tasks found");
  // A stored list read back: its tasks checked one by one, in id order, its mark kept.
  assert.deepEqual(K.readTasks({ mark: 7, tasks: [{ id: "10", subject: "b", description: "", status: "pending", blocks: [], blockedBy: [] }, { id: "2", subject: "a", description: "d", status: "done" }, { id: "3", subject: "c", description: "d", status: "completed", owner: 5 }, "x"] }), { mark: 7, tasks: [{ id: "3", subject: "c", description: "d", status: "completed", blocks: [], blockedBy: [] }, { id: "10", subject: "b", description: "", status: "pending", blocks: [], blockedBy: [] }] });
  assert.deepEqual([K.readTasks(null), K.readTasks("[]")], [K.emptyTasks(), K.emptyTasks()]);
});

test("TK4 in a job: each tool answers in Claude Code's words; the chat's checklist shows the list (each in progress by its activeForm, as Claude Code's docs' progress display) and no step; the list is the chat's, kept between messages, its ids going on; Coder has no todo", async () => {
  const store = memoryStore();
  let t = await job([say("", [
    call("task_create", { subject: "Add tests", description: "Cart tests", activeForm: "Adding tests" }, "c1"),
    call("task_create", { title: "Run them" }, "c2"),
    call("task_update", { taskId: "1", status: "in_progress" }, "u1"),
    call("task_update", { id: "2", addBlockedBy: ["1"] }, "u2"),
    call("task_list", {}, "l1"),
    call("task_get", { taskId: "2" }, "g1"),
  ]), say("Started.")], { store });
  assert.deepEqual(["c1", "c2", "u1", "u2", "l1", "g1"].map(t.told), ["Task #1 created successfully: Add tests", "Task #2 created successfully: Run them", "Updated task #1 status", "Updated task #2 blockedBy", "#1 [in_progress] Add tests\n#2 [pending] Run them [blocked by #1]", "Task #2: Run them\nStatus: pending\nDescription: Run them\nBlocked by: #1"]);
  assert.equal(t.events.filter((e) => e.type === "bash").length, 0, "no step: Claude Code shows none for these tools");
  assert.deepEqual(t.events.filter((e) => e.type === "todo").pop().items, [{ text: "Adding tests", status: "in_progress" }, { text: "Run them", status: "pending" }]);
  assert.deepEqual(store.now().tasks.map((x) => [x.id, x.status]), [["1", "in_progress"], ["2", "pending"]]);
  // The next message: the same list.
  t = await job([say("", [call("task_update", { taskId: "1", status: "completed" }, "u3"), call("task_create", { subject: "Ship", description: "Push" }, "c3"), call("task_list", {}, "l2")]), say("ok")], { store });
  assert.equal(t.told("c3"), "Task #3 created successfully: Ship");
  assert.equal(t.told("l2"), "#1 [completed] Add tests\n#2 [pending] Run them\n#3 [pending] Ship");
  assert.deepEqual(t.events.filter((e) => e.type === "todo").pop().items, [{ text: "Add tests", status: "done" }, { text: "Run them", status: "pending" }, { text: "Ship", status: "pending" }], "completed shows as done (✓)");
  // A task that changed nothing shows nothing new; reading changes nothing.
  t = await job([say("", [call("task_get", { taskId: "3" }, "g2"), call("task_update", { taskId: "3", status: "pending" }, "u4")]), say("ok")], { store });
  assert.equal(t.events.filter((e) => e.type === "todo").length, 0);
  // With no file (a machine without one): the job keeps its own list.
  t = await job([say("", [call("task_create", { subject: "a", description: "b" }, "c1"), call("task_list", {}, "l1")]), say("ok")]);
  assert.equal(t.told("l1"), "#1 [pending] a");
  // Coder's old todo is not one of its tools now.
  t = await job([say("", [call("todo", { items: [{ text: "a", status: "pending" }] }, "t1")]), say("ok")]);
  assert.equal(t.told("t1"), "error: no such tool: todo");
  assert.ok(!t.events.some((e) => e.type === "todo"));
});

test("TK5 hooks see the calls as Claude Code's: TaskCreate and the rest by name, the fixed input, a result object; TaskCreated rolls a task back and TaskCompleted keeps one open, in Claude Code's words; a refused input fires no hook", async () => {
  const hooks = { PreToolUse: [{ matcher: "TaskCreate|TaskUpdate|TaskList|TaskGet", hooks: [{ type: "command", command: "pre.sh" }] }], PostToolUse: [{ matcher: "Task.*", hooks: [{ type: "command", command: "post.sh" }] }] };
  let t = await job([say("", [call("task_create", { title: "Add tests", content: "Cart" }, "c1"), call("task_update", { taskId: "1", status: "in_progress" }, "u1"), call("task_get", { taskId: "1" }, "g1"), call("task_list", {}, "l1"), call("task_create", { tasks: [] }, "bad")]), say("ok")], { hooks, store: memoryStore() });
  const ev = (name, tool) => t.hookCalls.filter((h) => h.hook_event_name === name && h.tool_name === tool);
  assert.deepEqual(ev("PreToolUse", "TaskCreate").map((h) => h.tool_input), [{ subject: "Add tests", description: "Cart" }], "the fixed input; the refused call fired none");
  assert.deepEqual(ev("PostToolUse", "TaskCreate")[0].tool_response, { output: "Task #1 created successfully: Add tests", task: { id: "1", subject: "Add tests", description: "Cart" } });
  assert.deepEqual(ev("PostToolUse", "TaskUpdate")[0].tool_response, { output: "Updated task #1 status", success: true, taskId: "1", updatedFields: ["status"], statusChange: { from: "pending", to: "in_progress" } });
  assert.deepEqual(ev("PostToolUse", "TaskGet")[0].tool_response, { output: "Task #1: Add tests\nStatus: in_progress\nDescription: Cart", task: { id: "1", subject: "Add tests", description: "Cart", status: "in_progress", blocks: [], blockedBy: [] } });
  assert.deepEqual(ev("PostToolUse", "TaskList")[0].tool_response, { output: "#1 [in_progress] Add tests", tasks: [{ id: "1", subject: "Add tests", status: "in_progress", blockedBy: [] }] });
  assert.equal(t.hookCalls.filter((h) => h.tool_use_id === "bad").length, 0);
  // TaskCreated and TaskCompleted (Claude Code's: no matchers, no permission_mode from these tools).
  const store = memoryStore();
  const taskHooks = { TaskCreated: [{ matcher: "anything", hooks: [{ type: "command", command: "created.sh" }] }], TaskCompleted: hk("done.sh"), PostToolUseFailure: [{ matcher: "TaskCreate", hooks: [{ type: "command", command: "fail.sh" }] }], PostToolUse: [{ matcher: "TaskCreate", hooks: [{ type: "command", command: "post.sh" }] }] };
  const hookRun = (input) => {
    if (input.hook_event_name === "TaskCreated" && !/^\[T-\d+\]/.test(input.task_subject)) return { code: 2, stderr: "Task subject must start with a ticket number, e.g. '[TICKET-123] Add feature'" };
    if (input.hook_event_name === "TaskCompleted") return { code: 2, stderr: "Tests not passing" };
    return {};
  };
  t = await job([say("", [call("task_create", { subject: "Add tests", description: "d" }, "c1"), call("task_create", { subject: "[T-1] Add tests", description: "d" }, "c2"), call("task_update", { taskId: "2", status: "completed", subject: "New" }, "u1")]), say("ok")], { hooks: taskHooks, hookRun, store });
  assert.equal(t.told("c1"), "error: TaskCreated hook feedback:\n[command hook]: Task subject must start with a ticket number, e.g. '[TICKET-123] Add feature'");
  assert.equal(t.told("c2"), "Task #2 created successfully: [T-1] Add tests", "the rolled-back task's id is not used again");
  assert.equal(t.told("u1"), "TaskCompleted hook feedback:\n[command hook]: Tests not passing", "an answer, not a failed call, as Claude Code's");
  assert.deepEqual(store.now().tasks.map((x) => [x.id, x.subject, x.status]), [["2", "[T-1] Add tests", "pending"]]);
  const created = t.hookCalls.find((h) => h.hook_event_name === "TaskCreated");
  assert.deepEqual([created.task_id, created.task_subject, created.task_description, "permission_mode" in created, created.session_id], ["1", "Add tests", "d", false, "shop-tk"]);
  const done = t.hookCalls.find((h) => h.hook_event_name === "TaskCompleted");
  assert.deepEqual([done.task_id, done.task_subject, done.task_description, "permission_mode" in done], ["2", "[T-1] Add tests", "d", false]);
  const failed = t.hookCalls.filter((h) => h.hook_event_name === "PostToolUseFailure");
  assert.deepEqual(failed.map((h) => [h.tool_name, h.tool_use_id, h.error]), [["TaskCreate", "c1", "error: TaskCreated hook feedback:\n[command hook]: Task subject must start with a ticket number, e.g. '[TICKET-123] Add feature'"]]);
  assert.deepEqual(t.hookCalls.filter((h) => h.hook_event_name === "PostToolUse").map((h) => h.tool_use_id), ["c2"], "the rolled-back call is a failure, not a success");
  // A JSON block, and a prompt hook's: their reasons, in the same words.
  const out = (event, runs) => H.hooksOutcome(event, runs);
  assert.deepEqual(out("TaskCreated", [{ hook: { type: "command", command: "x.sh" }, result: H.hookResult("TaskCreated", { code: 0, stdout: '{"decision":"block","reason":"Needs a ticket"}', stderr: "" }) }]).blocks, ["TaskCreated hook feedback:\nNeeds a ticket"]);
  assert.deepEqual(out("TaskCompleted", [{ hook: { type: "prompt", prompt: "Are the tests green?" }, result: { kind: "ok", verdict: { ok: false, reason: "They fail" } } }]).blocks, ["TaskCompleted hook feedback:\n[Are the tests green?]: They fail"]);
  assert.equal(out("TaskCompleted", [{ hook: { type: "prompt", prompt: "p" }, result: { kind: "ok", verdict: { ok: false, reason: "no" } } }]).endTurn, "", "the turn goes on");
  // Their settings: the two events, every kind of hook, no matcher.
  const s = H.hooksFrom({ hooks: { TaskCreated: [{ hooks: [{ type: "prompt", prompt: "Is it named well?" }, { type: "agent", prompt: "Check" }] }], TaskCompleted: [{ matcher: "x", hooks: [{ type: "http", url: "https://hooks.example.com/t" }] }] } }, "settings");
  assert.deepEqual([s.problems, s.list.map((h) => [h.event, h.type])], [[], [["TaskCreated", "prompt"], ["TaskCreated", "agent"], ["TaskCompleted", "http"]]]);
  assert.equal(H.hooksFor(s.list, "TaskCompleted", "").length, 1, "its matcher is ignored");
  assert.ok(H.GATING_EVENTS.has("TaskCreated") && H.GATING_EVENTS.has("TaskCompleted"));
  assert.equal("permission_mode" in H.hookInput("TaskCreated", { session: "s", cwd: "/w", mode: "plan" }, { task_id: "1" }), false);
  assert.equal(H.hookInput("Stop", { session: "s", cwd: "/w", mode: "plan" }).permission_mode, "plan");
});

test("TK6 Claude Code's reminder: after 10 steps (each text and each tool call) with neither task_create nor task_update and no reminder in them, a note in its words with the list; once, then again only 10 steps later; not with task_update taken away by a rule", async () => {
  const a = (text, ...names) => ({ role: "assistant", content: text, ...(names.length ? { tool_calls: names.map((n, i) => ({ id: n + i, type: "function", function: { name: n, arguments: "{}" } })) } : {}) });
  const nine = [a("", "bash", "bash", "bash"), a("x", "read", "read"), a("y", "grep", "bash")];
  assert.equal(K.taskReminderDue(nine), false, "9 steps");
  assert.equal(K.taskReminderDue([...nine, a("", "glob")]), true, "10 steps");
  assert.equal(K.taskReminderDue([a("", "task_update"), ...nine, a("", "glob")]), true);
  assert.equal(K.taskReminderDue([a("", "bash", "task_update"), ...nine]), false, "the steps after task_update count, not one before it in its answer");
  assert.equal(K.taskReminderDue([a("", "task_update", "bash"), ...nine]), true, "one after it in its answer counts");
  assert.equal(K.taskReminderDue([a("", "task_get"), ...nine, a("", "task_list")]), true, "reading the list is no use of the tools");
  const note = { role: "user", appNote: true, content: K.taskReminderNote([]) };
  assert.equal(K.taskReminderDue([...nine, a("")], 10), false, "an empty answer is no step");
  assert.equal(K.taskReminderDue([a("", "bash"), note, ...nine]), false, "a reminder in the last 10 steps");
  assert.equal(K.taskReminderDue([note, ...nine, a("", "bash")]), true);
  assert.equal(K.taskReminderNote([]), "(Note from Coder's app, not the owner:\nThe task tools haven't been used recently. If you're working on tasks that would benefit from tracking progress, consider using task_create to add new tasks and task_update to update task status (set to in_progress when starting, completed when done). Also consider cleaning up the task list if it has become stale. Only use these if relevant to the current work. This is just a gentle reminder - ignore if not applicable.)");
  assert.equal(K.taskReminderNote([{ id: "2", status: "pending", subject: "Ship", metadata: { _internal: true } }, { id: "4", status: "completed", subject: "Test" }]).split("applicable.")[1], "\n\n\nHere are the existing tasks:\n\n#2. [pending] Ship\n#4. [completed] Test)");
  // In a job: the note before the answer that follows the 10th step, once.
  const store = memoryStore({ mark: 2, tasks: [{ id: "2", subject: "Ship", description: "d", status: "pending", blocks: [], blockedBy: [] }] });
  const steps = [];
  for (let k = 0; k < 7; k++) steps.push(say("step " + k, [call("bash", { command: "ls", description: "List" }, "b" + k)]));
  steps.push(say("done"));
  let t = await job(steps, { store });
  const notes = (req) => req.messages.filter((m) => m.role === "user" && typeof m.content === "string" && m.content.includes("The task tools haven't been used recently."));
  assert.deepEqual(t.seen.map((req) => notes(req).length), [0, 0, 0, 0, 0, 1, 1, 1]);
  assert.ok(notes(t.seen[5])[0].content.endsWith("Here are the existing tasks:\n\n#2. [pending] Ship)"));
  assert.equal(t.events.filter((e) => e.type === "note" && /task tools/.test(e.text || "")).length, 0, "Coder's alone: not shown in the chat");
  // Without task_update (a rule took it away): no reminder.
  t = await job(steps, { store, rules: { deny: ["TaskUpdate"], ask: [], allow: [] } });
  assert.ok(t.seen.every((req) => notes(req).length === 0));
  assert.ok(!t.seen[0].tools.some((x) => x.function.name === "task_update") && t.seen[0].tools.some((x) => x.function.name === "task_create"));
});

test("TK7 the chat's list on the machine: root's own file beside the chat's memory, written whole through a new file, never read through a link; the checklist the page shows is capped", async () => {
  const dir = mkdtempSync(join(tmpdir(), "coder-tasks-"));
  try {
    const file = join(dir, "chat-1.tasks.json");
    const s = K.taskStore(file);
    assert.deepEqual(await s.load(), K.emptyTasks(), "no file yet");
    const st = K.emptyTasks();
    K.createTask(st, { subject: "a", description: "b" });
    await s.save(st);
    assert.deepEqual(await s.load(), { mark: 1, tasks: [{ id: "1", subject: "a", description: "b", status: "pending", blocks: [], blockedBy: [] }] });
    assert.equal(statSync(file).mode & 0o777, 0o600);
    writeFileSync(file, "{not json");
    assert.deepEqual(await s.load(), K.emptyTasks());
    const other = join(dir, "other.json");
    writeFileSync(other, JSON.stringify({ mark: 3, tasks: [] }));
    const link = join(dir, "linked.tasks.json");
    symlinkSync(other, link);
    assert.deepEqual(await K.taskStore(link).load(), K.emptyTasks(), "never through a link");
  } finally { rmSync(dir, { recursive: true, force: true }); }
  // server.mjs gives each job the chat's file.
  // (Or the list CODER_TASK_LIST_ID names, Claude Code's CLAUDE_CODE_TASK_LIST_ID: taskFileFor, TK9.)
  assert.match(read("container/server.mjs"), /tasks: taskStore\(taskFileFor\(memRoot, project, rawVars\.CODER_TASK_LIST_ID\)\),/);
  assert.equal(K.taskFileFor("/data/memory", "chat-1"), "/data/memory/chat-1.tasks.json");
  // The page's checklist: at most 100, each line at most 200 characters on one line, no _internal task.
  const st = K.emptyTasks();
  for (let k = 0; k < 105; k++) K.createTask(st, { subject: "t" + k + "\n  " + "x".repeat(300), description: "d", ...(k === 0 ? { metadata: { _internal: 1 } } : {}) });
  const items = K.pageItems(st);
  assert.equal(items.length, 100);
  assert.equal(items[0].text, "t1 " + "x".repeat(197));
});

test("TK8 the page: in Coder's chat a checklist update doesn't split a run of commands (Claude Code's changelog: \"Fixed consecutive shell commands splitting into multiple … rows when todo/task updates were interleaved between them\"): the latest is drawn after the group it came in; Gloopy's as before", () => {
  const ui = read("public/coder.js");
  assert.match(ui, /if \(e\.type === 'result'\) return;\n\s+if \(e\.type === 'todo' && !GLOOPY\) \{ if \(!S\.events\.slice\(i \+ 1\)\.some\(\(x\) => x\.type === 'todo'\)\) plan = todoHTML\(e\); if \(!group\.length\) flush\(\); return; \}/);
  assert.match(ui, /const flush = \(\) => \{\n\s+if \(!group\.length\) \{ if \(plan\) \{ out\.push\(plan\); plan = ''; \} return; \}/);
  assert.match(ui, /\n\s+group = \[\];\n\s+if \(plan\) \{ out\.push\(plan\); plan = ''; \}\n\s+\};/);
  assert.match(ui, /else if \(e\.type === 'todo'\) \{ if \(S\.events\.slice\(i \+ 1\)\.some\(\(x\) => x\.type === 'todo'\)\) return; out\.push\(todoHTML\(e\)\); \}/);
  // The checklist itself, as before: ✓ done, • in progress.
  const src = ui.slice(ui.indexOf("const todoHTML = (e) =>") + "const todoHTML = ".length, ui.indexOf(";\n", ui.indexOf("const todoHTML = (e) =>")));
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const items = [{ text: "Add <tests>", status: "done" }, { text: "Running tests", status: "in_progress" }, { text: "Ship", status: "pending" }];
  const rows = '<div class="cd-todo-i is-done"><span class="cd-todo-box">✓</span>Add &lt;tests&gt;</div><div class="cd-todo-i is-in_progress"><span class="cd-todo-box">•</span>Running tests</div><div class="cd-todo-i is-pending"><span class="cd-todo-box"></span>Ship</div></div>';
  // Coder's task list titled as Claude Code 2.1.325 titles its own ("Tasks", then " · 1/3 done"; the docs: "Task list");
  // Gloopy's checklist keeps "Plan".
  assert.equal(new Function("esc", "GLOOPY", "return " + src)(esc, false)({ items }), '<div class="cd-todo"><b>Tasks<span class="cd-todo-n"> · 1/3 done</span></b>' + rows);
  assert.equal(new Function("esc", "GLOOPY", "return " + src)(esc, true)({ items }), '<div class="cd-todo"><b>Plan</b>' + rows);
  assert.match(read("public/coder.css"), /\n\.cd-todo-n\{font-weight:400;text-transform:none;letter-spacing:0\}\n/);
});

// ── CLAUDE_CODE_ENABLE_TASKS=0 AND CLAUDE_CODE_TASK_LIST_ID (the owner, 2026-11-14: "Fix base on Claude Code docs, please") ──
test("TK9 CLAUDE_CODE_ENABLE_TASKS=0 (Coder's CODER_ENABLE_TASKS, or the repository's): Claude Code's TodoWrite as todo_write in place of the four task tools, its prompt, schema, answer, result object, checks, store and reminder; its system prompt line; the other family is no tool", async () => {
  assert.equal(K.TODO_WRITE_PROMPT, "Create and update a task list for the current session. The list is rendered to the owner as your working plan.\n\n- Each todo has `content`, `status` (\"pending\" | \"in_progress\" | \"completed\"), and `activeForm` (present-tense label shown while in progress).\n- Send the full list each call; it replaces the previous one.\n- Keep one item `in_progress` at a time and mark it `completed` when done.");
  const p = K.TODO_WRITE_TOOL.function.parameters;
  assert.deepEqual([K.TODO_WRITE_TOOL.function.name, p.required, p.additionalProperties, p.properties.todos.description, p.properties.todos.items.required, p.properties.todos.items.properties.status.enum], ["todo_write", ["todos"], false, "The updated todo list", ["content", "status", "activeForm"], ["pending", "in_progress", "completed"]]);
  assert.equal(K.TODO_WRITE_RESULT, "Todos have been modified successfully. Ensure that you continue to use the todo list to track your progress. Please proceed with the current tasks if applicable");
  assert.equal(H.ccTool("todo_write"), "TodoWrite");
  // Its input, as its schema takes it (zod 4.6.2's own issues; Claude Code's w0 words).
  const ok = { todos: [{ content: "Add tests", status: "in_progress", activeForm: "Adding tests", extra: 1 }] };
  assert.deepEqual(K.checkTodoInput(ok), { args: { todos: [{ content: "Add tests", status: "in_progress", activeForm: "Adding tests" }] } }, "a todo's other keys dropped, as its schema drops them");
  assert.equal(K.checkTodoInput({}).error, "error: InputValidationError: TodoWrite failed due to the following issue:\nThe required parameter `todos` is missing");
  assert.equal(K.checkTodoInput({ todos: [], x: 1 }).error, "error: InputValidationError: TodoWrite failed due to the following issue:\nAn unexpected parameter `x` was provided");
  assert.equal(K.checkTodoInput({ todos: [{ content: "", status: "pending", activeForm: "A" }] }).error, "error: InputValidationError: " + JSON.stringify([{ origin: "string", code: "too_small", minimum: 1, inclusive: true, path: ["todos", 0, "content"], message: "Content cannot be empty" }], null, 2));
  assert.equal(K.checkTodoInput({ todos: [{ content: "A", status: "done", activeForm: "A" }] }).error, "error: InputValidationError: " + JSON.stringify([{ code: "invalid_value", values: ["pending", "in_progress", "completed"], path: ["todos", 0, "status"], message: 'Invalid option: expected one of "pending"|"in_progress"|"completed"' }], null, 2));
  assert.equal(K.checkTodoInput({ todos: [{ content: 3, status: "done" }] }).error, "error: InputValidationError: TodoWrite failed due to the following issues:\nThe required parameter `todos[0].activeForm` is missing\nThe parameter `todos[0].content` type is expected as `string` but provided as `number`\nThe parameter `todos[0].status` is invalid: Invalid option: expected one of \"pending\"|\"in_progress\"|\"completed\"");
  // Its reminder, in Claude Code's words.
  assert.equal(K.todoReminderNote([]), "(Note from Coder's app, not the owner:\nThe todo_write tool hasn't been used recently. If you're working on tasks that would benefit from tracking progress, consider using the todo_write tool to track progress. Also consider cleaning up the todo list if has become stale and no longer matches what you are working on. Only use it if it's relevant to the current work. This is just a gentle reminder - ignore if not applicable.)");
  assert.ok(K.todoReminderNote([{ content: "A", status: "pending", activeForm: "a" }, { content: "B", status: "completed", activeForm: "b" }]).endsWith("ignore if not applicable.\n\n\nHere are the existing contents of your todo list:\n\n[1. [pending] A\n2. [completed] B])"));
  // In a job.
  let saved = null;
  const todos = { load: async () => saved, save: async (x) => { saved = JSON.parse(JSON.stringify(x)); } };
  const hooks = { PostToolUse: [{ matcher: "TodoWrite", hooks: [{ type: "command", command: "post.sh" }] }] };
  const list = [{ content: "Add tests", status: "in_progress", activeForm: "Adding tests" }, { content: "Ship", status: "pending", activeForm: "Shipping" }];
  const done = list.map((x) => ({ ...x, status: "completed" }));
  let t = await job([say("", [call("todo_write", { todos: list }, "t1")]), say("", [call("todo_write", { todos: done }, "t2"), call("task_create", { subject: "a", description: "b" }, "c1")]), say("Done.")], { hooks, extra: { tasksOff: true }, deps: { todos } });
  const names = t.seen[0].tools.map((x) => x.function.name);
  assert.ok(!names.some((n) => K.isTaskTool(n)), "no task tools");
  assert.equal(names[names.indexOf("enter_plan_mode") + 1], "todo_write", "in their place");
  assert.equal(t.seen[0].tools.find((x) => x.function.name === "todo_write"), K.TODO_WRITE_TOOL);
  const sys = t.seen[0].messages[0].content;
  assert.ok(sys.includes("todo_write (your task list, which the owner sees)") && sys.includes("\n- Use todo_write to plan and track work. Mark each task completed as soon as it's done; don't batch.\n"));
  assert.ok(!/task_create|task_update/.test(sys));
  assert.equal(t.told("t1"), K.TODO_WRITE_RESULT);
  assert.deepEqual(t.events.filter((e) => e.type === "todo")[0].items, [{ text: "Adding tests", status: "in_progress" }, { text: "Ship", status: "pending" }]);
  assert.deepEqual(t.events.filter((e) => e.type === "todo")[1].items, [{ text: "Add tests", status: "done" }, { text: "Ship", status: "done" }]);
  assert.deepEqual(saved, [], "a list all completed is kept as none, as Claude Code keeps it");
  const posts = t.hookCalls.filter((h) => h.hook_event_name === "PostToolUse");
  assert.deepEqual(posts.map((h) => [h.tool_name, h.tool_response.oldTodos, h.tool_response.newTodos]), [["TodoWrite", [], list], ["TodoWrite", list, done]]);
  assert.equal(t.told("c1"), "error: No such tool available: task_create");
  // The list kept between messages.
  saved = list;
  t = await job([say("", [call("todo_write", { todos: [list[1]] }, "t1")]), say("ok")], { hooks, extra: { tasksOff: true }, deps: { todos } });
  assert.deepEqual(t.hookCalls.find((h) => h.hook_event_name === "PostToolUse").tool_response.oldTodos, list);
  // Its reminder in a job: after 10 steps without it.
  saved = list;
  const steps = [];
  for (let k = 0; k < 7; k++) steps.push(say("step " + k, [call("bash", { command: "ls", description: "List" }, "b" + k)]));
  steps.push(say("done"));
  t = await job(steps, { extra: { tasksOff: true }, deps: { todos } });
  const notes = (req) => req.messages.filter((m) => m.role === "user" && typeof m.content === "string" && m.content.includes("The todo_write tool hasn't been used recently."));
  assert.deepEqual(t.seen.map((req) => notes(req).length), [0, 0, 0, 0, 0, 1, 1, 1]);
  assert.ok(notes(t.seen[5])[0].content.endsWith("[1. [in_progress] Add tests\n2. [pending] Ship])"));
  assert.ok(t.seen.every((req) => !req.messages.some((m) => typeof m.content === "string" && m.content.includes("The task tools haven't been used recently."))));
  // Rules on the task tools don't touch it; one on TodoWrite does.
  t = await job([say("ok")], { extra: { tasksOff: true }, rules: { allow: [], ask: [], deny: ["TaskCreate", "TaskGet", "TaskList", "TaskUpdate"] } });
  assert.ok(t.seen[0].tools.some((x) => x.function.name === "todo_write"));
  t = await job([say("ok")], { extra: { tasksOff: true }, rules: { allow: [], ask: [], deny: ["TodoWrite"] } });
  assert.ok(!t.seen[0].tools.some((x) => x.function.name === "todo_write" || K.isTaskTool(x.function.name)));
  // With the task tools (the default): todo_write is no tool.
  t = await job([say("", [call("todo_write", { todos: list }, "t1")]), say("ok")]);
  assert.ok(!t.seen[0].tools.some((x) => x.function.name === "todo_write"));
  assert.equal(t.told("t1"), "error: No such tool available: todo_write");
  // An agent with tools of its own (Gloopy, its own todo) is not changed by it.
  t = await job([say("ok")], { extra: { tasksOff: true, tools: G.GLOOPY_TOOLS.filter((x) => ["todo", "ask_user"].includes(x.function.name)) } });
  assert.deepEqual(t.seen[0].tools.map((x) => x.function.name), ["ask_user", "todo"]);
  assert.ok(t.seen[0].messages[0].content.includes("task_create, task_get, task_list and task_update (your task list, which the owner sees)"));
  // The machine: the setting by Claude Code's name from a repository's file, Coder's in the environment; the chat's todo list
  // in a file of root's beside its memory.
  const S = await import("../container/server.mjs");
  assert.deepEqual([S.REPO_OWN_ENV.CLAUDE_CODE_ENABLE_TASKS, S.REPO_OWN_ENV.CLAUDE_CODE_TASK_LIST_ID], ["CODER_ENABLE_TASKS", "CODER_TASK_LIST_ID"]);
  const server = read("container/server.mjs");
  assert.match(server, /tasksOff: varOff\(rawVars\.CODER_ENABLE_TASKS\),/);
  assert.match(server, /todos: todoStore\(join\(memRoot, project \+ "\.todos\.json"\)\),/);
  const dir = mkdtempSync(join(tmpdir(), "coder-todos-"));
  try {
    const s = K.todoStore(join(dir, "c.todos.json"));
    assert.deepEqual(await s.load(), []);
    await s.save(list);
    assert.deepEqual(await s.load(), list);
    writeFileSync(join(dir, "c.todos.json"), JSON.stringify({ todos: [{ content: "", status: "pending", activeForm: "x" }] }));
    assert.deepEqual(await s.load(), [], "a list its schema refuses: none");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("TK10 CLAUDE_CODE_TASK_LIST_ID (Coder's CODER_TASK_LIST_ID, or the repository's): the chat's task list is the named one, in the memory folder's tasks/, its name as Claude Code makes it (anything but letters, digits, _ and - becomes -)", async () => {
  assert.equal(K.taskListName("my project/v2.0"), "my-project-v2-0");
  assert.equal(K.taskListName("../../etc"), "------etc");
  assert.equal(K.taskFileFor("/data/memory", "chat-1", "shop"), "/data/memory/tasks/shop.json");
  assert.equal(K.taskFileFor("/data/memory", "chat-1", " a b "), "/data/memory/tasks/-a-b-.json", "as Claude Code takes it: not trimmed");
  assert.equal(K.taskFileFor("/data/memory", "chat-1", ""), "/data/memory/chat-1.tasks.json");
  assert.equal(K.taskFileFor("/data/memory", "chat-1"), "/data/memory/chat-1.tasks.json");
  const dir = mkdtempSync(join(tmpdir(), "coder-tasklist-"));
  try {
    const st = K.emptyTasks();
    K.createTask(st, { subject: "a", description: "b" });
    await K.taskStore(K.taskFileFor(dir, "chat-1", "shop")).save(st);
    assert.deepEqual(await K.taskStore(K.taskFileFor(dir, "chat-2", "shop")).load(), { mark: 1, tasks: st.tasks }, "another chat with the same list reads it");
    assert.equal(statSync(join(dir, "tasks")).mode & 0o777, 0o700, "its folder made, root's own");
    assert.deepEqual(await K.taskStore(K.taskFileFor(dir, "chat-2")).load(), K.emptyTasks(), "a chat's own list is apart");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
