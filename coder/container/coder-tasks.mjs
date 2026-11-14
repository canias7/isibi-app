// CLAUDE CODE'S TASK LIST: TaskCreate, TaskGet, TaskList and TaskUpdate (the owner, 2026-11-14: "Do all the talk to you
// tools execpt for the notify one"). Coder's checklist was its own `todo` tool, like Claude Code's TodoWrite. Claude Code on
// the web has the four Task tools instead (its tools reference, "Task tool availability": "Wherever the tools are available,
// you get the four Task tools, or TodoWrite instead when you set CLAUDE_CODE_ENABLE_TASKS=0", and "In background sessions
// and in cloud sessions, Claude Code provides the same tools on every model"), so Coder has them in place of `todo`, by
// Coder's names: task_create, task_get, task_list and task_update.
//
// Everything here is Claude Code 2.1.325's own (its program, read: the tools' descriptions, inputs, the fixes it makes to a
// call's input and the checks after them, the list's rules, its answers to the model, the result objects its hooks get, and
// its reminder), word for word, with "the user" as "the owner" and, where a text tells Coder to use one of these tools,
// Coder's name for it. The list itself is the chat's own, kept between messages (Claude Code keeps a session's in
// ~/.claude/tasks/: one list a session, its ids counted up from 1 and never used twice); Coder's machine keeps it in a file
// of root's beside the chat's memory (taskStore).
import { rename, open as openFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, basename, join } from "node:path";

/** Coder's names for the four tools, and Claude Code's (hooks, rules and permission texts use Claude Code's). */
export const TASK_TOOL_CC = Object.freeze({ task_create: "TaskCreate", task_get: "TaskGet", task_list: "TaskList", task_update: "TaskUpdate" });
export const TASK_TOOL_NAMES = Object.freeze(Object.keys(TASK_TOOL_CC));
export const isTaskTool = (name) => Object.prototype.hasOwnProperty.call(TASK_TOOL_CC, String(name || ""));
/** The statuses (TaskUpdate also takes `deleted`, which removes the task). */
export const TASK_STATUSES = Object.freeze(["pending", "in_progress", "completed"]);

// ---------------------------------------------------------------------------------------------------------------------
// WHAT CODER IS TOLD: each tool's description (Claude Code's prompt for it, sent to the model as the tool's description; the
// parts only an agent team gets left out, as Claude Code leaves them out of a session without one).
// ---------------------------------------------------------------------------------------------------------------------
export const TASK_CREATE_PROMPT = `Use this tool to create a structured task list for your current coding session. This helps you track progress, organize complex tasks, and demonstrate thoroughness to the owner.
It also helps the owner understand the progress of the task and overall progress of their requests.

## When to Use This Tool

Use this tool proactively in these scenarios:

- Complex multi-step tasks - When a task requires 3 or more distinct steps or actions
- Non-trivial and complex tasks - Tasks that require careful planning or multiple operations
- Plan mode - When using plan mode, create a task list to track the work
- Owner explicitly requests todo list - When the owner directly asks you to use the todo list
- Owner provides multiple tasks - When the owner provides a list of things to be done (numbered or comma-separated)
- After receiving new instructions - Immediately capture the owner's requirements as tasks
- When you start working on a task - Mark it as in_progress BEFORE beginning work
- After completing a task - Mark it as completed and add any new follow-up tasks discovered during implementation

## When NOT to Use This Tool

Skip using this tool when:
- There is only a single, straightforward task
- The task is trivial and tracking it provides no organizational benefit
- The task can be completed in less than 3 trivial steps
- The task is purely conversational or informational

NOTE that you should not use this tool if there is only one trivial task to do. In this case you are better off just doing the task directly.

## Task Fields

- **subject**: A brief, actionable title in imperative form (e.g., "Fix authentication bug in login flow")
- **description**: What needs to be done
- **activeForm** (optional): Present continuous form shown in the spinner when the task is in_progress (e.g., "Fixing authentication bug"). If omitted, the spinner shows the subject instead.

All tasks are created with status \`pending\`.

## Tips

- Create tasks with clear, specific subjects that describe the outcome
- After creating tasks, use task_update to set up dependencies (blocks/blockedBy) if needed
- Check task_list first to avoid creating duplicate tasks
`;

export const TASK_GET_PROMPT = `Use this tool to retrieve a task by its ID from the task list.

## When to Use This Tool

- When you need the full description and context before starting work on a task
- To understand task dependencies (what it blocks, what blocks it)
- After being assigned a task, to get complete requirements

## Output

Returns full task details:
- **subject**: Task title
- **description**: Detailed requirements and context
- **status**: 'pending', 'in_progress', or 'completed'
- **blocks**: Tasks waiting on this one to complete
- **blockedBy**: Tasks that must complete before this one can start

## Tips

- After fetching a task, verify its blockedBy list is empty before beginning work.
- Use task_list to see all tasks in summary form.
`;

export const TASK_UPDATE_PROMPT = `Use this tool to update a task in the task list.

## When to Use This Tool

**Mark tasks as resolved:**
- When you have completed the work described in a task
- When a task is no longer needed or has been superseded
- IMPORTANT: Always mark your assigned tasks as resolved when you finish them
- After resolving, call task_list to find your next task

- ONLY mark a task as completed when you have FULLY accomplished it
- If you encounter errors, blockers, or cannot finish, keep the task as in_progress
- When blocked, create a new task describing what needs to be resolved
- Never mark a task as completed if:
  - Tests are failing
  - Implementation is partial
  - You encountered unresolved errors
  - You couldn't find necessary files or dependencies

**Delete tasks:**
- When a task is no longer relevant or was created in error
- Setting status to \`deleted\` permanently removes the task

**Update task details:**
- When requirements change or become clearer
- When establishing dependencies between tasks

## Fields You Can Update

- **status**: The task status (see Status Workflow below)
- **subject**: Change the task title (imperative form, e.g., "Run tests")
- **description**: Change the task description
- **activeForm**: Present continuous form shown in spinner when in_progress (e.g., "Running tests")
- **owner**: Change the task owner (agent name)
- **metadata**: Merge metadata keys into the task (set a key to null to delete it)
- **addBlocks**: Mark tasks that cannot start until this one completes
- **addBlockedBy**: Mark tasks that must complete before this one can start

## Status Workflow

Status progresses: \`pending\` → \`in_progress\` → \`completed\`

Use \`deleted\` to permanently remove a task.

## Staleness

Make sure to read a task's latest state using \`task_get\` before updating it.

## Examples

Mark task as in progress when starting work:
\`\`\`json
{"taskId": "1", "status": "in_progress"}
\`\`\`

Mark task as completed after finishing work:
\`\`\`json
{"taskId": "1", "status": "completed"}
\`\`\`

Delete a task:
\`\`\`json
{"taskId": "1", "status": "deleted"}
\`\`\`

Claim a task by setting owner:
\`\`\`json
{"taskId": "1", "owner": "my-name"}
\`\`\`

Set up task dependencies:
\`\`\`json
{"taskId": "2", "addBlockedBy": ["1"]}
\`\`\`
`;

export const TASK_LIST_PROMPT = `Use this tool to list all tasks in the task list.

## When to Use This Tool

- To see what tasks are available to work on (status: 'pending', no owner, not blocked)
- To check overall progress on the project
- To find tasks that are blocked and need dependencies resolved
- After completing a task, to check for newly unblocked work or claim the next available task
- **Prefer working on tasks in ID order** (lowest ID first) when multiple tasks are available, as earlier tasks often set up context for later ones

## Output

Returns a summary of each task:
- **id**: Task identifier (use with task_get, task_update)
- **subject**: Brief description of the task
- **status**: 'pending', 'in_progress', or 'completed'
- **owner**: Agent ID if assigned, empty if available
- **blockedBy**: List of open task IDs that must be resolved first (tasks with blockedBy cannot be claimed until dependencies resolve)

Use task_get with a specific task ID to view full details including description and comments.
`;

/** Each input's own description, as Claude Code's schemas give them. */
const ACTIVE_FORM_DESC = "Present continuous form shown in spinner when in_progress (e.g., \"Running tests\")";
/** The four tools as Grok is offered them: strict objects, as Claude Code's schemas are (an input they don't name is refused). */
export const TASK_TOOLS = Object.freeze([
  { type: "function", function: { name: "task_create", description: TASK_CREATE_PROMPT, parameters: { type: "object", properties: {
    subject: { type: "string", description: "A brief title for the task" },
    description: { type: "string", description: "What needs to be done" },
    activeForm: { type: "string", description: ACTIVE_FORM_DESC },
    metadata: { type: "object", description: "Arbitrary metadata to attach to the task" },
  }, required: ["subject", "description"], additionalProperties: false } } },
  { type: "function", function: { name: "task_get", description: TASK_GET_PROMPT, parameters: { type: "object", properties: {
    taskId: { type: "string", description: "The ID of the task to retrieve" },
  }, required: ["taskId"], additionalProperties: false } } },
  { type: "function", function: { name: "task_list", description: TASK_LIST_PROMPT, parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function", function: { name: "task_update", description: TASK_UPDATE_PROMPT, parameters: { type: "object", properties: {
    taskId: { type: "string", description: "The ID of the task to update" },
    subject: { type: "string", description: "New subject for the task" },
    description: { type: "string", description: "New description for the task" },
    activeForm: { type: "string", description: ACTIVE_FORM_DESC },
    status: { type: "string", enum: [...TASK_STATUSES, "deleted"], description: "New status for the task" },
    addBlocks: { type: "array", items: { type: "string" }, description: "Task IDs that this task blocks" },
    addBlockedBy: { type: "array", items: { type: "string" }, description: "Task IDs that block this task" },
    owner: { type: "string", description: "New owner for the task" },
    metadata: { type: "object", description: "Metadata keys to merge into the task. Set a key to null to delete it." },
  }, required: ["taskId"], additionalProperties: false } } },
]);

// ---------------------------------------------------------------------------------------------------------------------
// A CALL'S INPUT, AS CLAUDE CODE TAKES IT (checked before any hook, as its validation is: "Validation rejections are
// returned as tool_use_error results and happen before hooks run, so they fire neither PreToolUse nor PostToolUseFailure").
// ---------------------------------------------------------------------------------------------------------------------
const isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
/** A string with something in it (Claude Code's test before it reads one name as another). */
const filled = (v) => typeof v === "string" && v.trim() !== "";
/** What a value is, as Claude Code's schema names it in "provided as `…`". */
const kindOf = (v) => (v === undefined ? "undefined" : v === null ? "null" : Array.isArray(v) ? "array" : typeof v === "number" && Number.isNaN(v) ? "nan" : typeof v);
/** A subject made from a description (Claude Code's: its first line, at most 80 characters, cut at a space past the 40th). */
export function subjectFrom(description) {
  const first = String(description).split("\n")[0].trim();
  const chars = Array.from(first);
  if (chars.length <= 80) return first;
  const cut = chars.slice(0, 80).join("");
  const sp = cut.lastIndexOf(" ");
  return (sp > 40 ? cut.slice(0, sp) : cut).trim();
}
const CREATE_KEYS = new Set(["subject", "description", "activeForm", "metadata"]);
/**
 * TASKCREATE'S FIXES (Claude Code 2.1.325's coerceInput; its changelog: "Improved `TaskCreate` reliability: malformed inputs
 * are repaired automatically"): a `task` wrapper opened; `title` or `name` read as `subject`, `content` as `description`,
 * `active_form` as `activeForm`; a missing description taken from the subject, or a missing subject from the description;
 * then, with both, every other input dropped, and an activeForm or metadata of the wrong kind. Not for a call that sends a
 * list (`tasks`, `todos`) or a subagent's inputs (`prompt`, `subagent_type`). Nothing is told of them, as in Claude Code.
 */
export function fixCreateInput(input) {
  if (!isObj(input)) return null;
  const list = (o) => has(o, "tasks") || has(o, "todos");
  const agentish = (o) => has(o, "prompt") || has(o, "subagent_type");
  if (list(input)) return null;
  const r = { ...input };
  let changed = false;
  if (agentish(r) && !(filled(r.subject) && filled(r.description))) return null;
  if (!has(r, "subject") && !has(r, "description") && has(r, "task")) {
    const t = r.task;
    if (filled(t)) { delete r.task; r.description = t; changed = true; }
    else if (isObj(t)) {
      if (list(t)) return null;
      if (agentish(t) && !(filled(t.subject) && filled(t.description))) return null;
      delete r.task; Object.assign(r, t); changed = true;
    } else return null;
  }
  for (const [names, to] of [[["title", "name"], "subject"], [["content"], "description"], [["active_form"], "activeForm"]]) {
    for (const k of names) if (has(r, k) && !has(r, to) && filled(r[k])) { r[to] = r[k]; delete r[k]; changed = true; }
  }
  if (filled(r.subject) && !has(r, "description")) { r.description = r.subject; changed = true; }
  else if (filled(r.description) && !has(r, "subject")) { r.subject = subjectFrom(r.description); changed = true; }
  if (filled(r.subject) && filled(r.description)) {
    for (const k of Object.keys(r)) if (!CREATE_KEYS.has(k)) { delete r[k]; changed = true; }
    if (has(r, "activeForm") && typeof r.activeForm !== "string") { delete r.activeForm; changed = true; }
    if (has(r, "metadata") && !isObj(r.metadata)) { delete r.metadata; changed = true; }
  }
  return changed ? r : null;
}
/** TASKUPDATE'S FIXES (Claude Code's coerceInput): `id` or `task_id` read as `taskId`, `active_form` as `activeForm`. */
export function fixUpdateInput(input) {
  if (!isObj(input)) return null;
  const r = { ...input };
  let changed = false;
  for (const [names, to] of [[["id", "task_id"], "taskId"], [["active_form"], "activeForm"]]) {
    for (const k of names) if (has(r, k) && !has(r, to) && filled(r[k])) { r[to] = r[k]; delete r[k]; changed = true; }
  }
  return changed ? r : null;
}
/** Each tool's inputs: a string, a list of strings, an object (Claude Code's record), or one of the statuses. */
const SHAPES = {
  task_create: { subject: "string!", description: "string!", activeForm: "string", metadata: "record" },
  task_get: { taskId: "string!" },
  task_list: {},
  task_update: { taskId: "string!", subject: "string", description: "string", activeForm: "string", status: "status", addBlocks: "strings", addBlockedBy: "strings", owner: "string", metadata: "record" },
};
/**
 * WHAT CLAUDE CODE'S SCHEMA SAYS OF AN INPUT, or "" (its words: the missing inputs, then the unexpected ones, then those of
 * the wrong type, then any other, headed "<Tool> failed due to the following issue(s):").
 */
export function taskSchemaProblem(name, input) {
  const shape = SHAPES[name];
  if (!shape) return "";
  const a = isObj(input) ? input : {};
  const missing = [], unexpected = [], wrong = [], other = [];
  const type = (k, expected, v) => wrong.push("The parameter `" + k + "` type is expected as `" + expected + "` but provided as `" + kindOf(v) + "`");
  for (const [k, kind] of Object.entries(shape)) {
    const v = a[k];
    if (v === undefined) { if (kind.endsWith("!")) missing.push(k); continue; }
    if (kind === "string" || kind === "string!") { if (typeof v !== "string") type(k, "string", v); }
    else if (kind === "record") { if (!isObj(v)) type(k, "record", v); }
    else if (kind === "strings") { if (!Array.isArray(v)) type(k, "array", v); else v.forEach((x, i) => { if (typeof x !== "string") type(k + "[" + i + "]", "string", x); }); }
    else if (kind === "status") { if (!(typeof v === "string" && (TASK_STATUSES.includes(v) || v === "deleted"))) other.push("The parameter `" + k + "` matches none of the accepted forms"); }
  }
  for (const k of Object.keys(a)) if (!has(shape, k)) unexpected.push(k);
  const lines = [...missing.map((k) => "The required parameter `" + k + "` is missing"), ...unexpected.map((k) => "An unexpected parameter `" + k + "` was provided"), ...wrong, ...other];
  return lines.length ? TASK_TOOL_CC[name] + " failed due to the following " + (lines.length > 1 ? "issues" : "issue") + ":\n" + lines.join("\n") : "";
}
/**
 * CLAUDE CODE'S HINT WITH A REFUSED TASKCREATE (its validationErrorSteer), before the schema's words: a call that sent a list.
 * (Its other hint, for a call with a subagent's inputs, sends Claude to its Agent tool, which Coder doesn't have.)
 */
export const TASK_LIST_STEER = "task_create creates ONE task per call and has no `tasks` or `todos` parameter. Call task_create once per task, passing `subject` (a brief title) and `description` (what needs to be done) as top-level string parameters.";
function createSteer(input) {
  if (!isObj(input)) return "";
  const t = isObj(input.task) ? input.task : null;
  return has(input, "tasks") || has(input, "todos") || (t && (has(t, "tasks") || has(t, "todos"))) ? TASK_LIST_STEER : "";
}
/**
 * A TASK TOOL'S INPUT CHECKED (Claude Code's order: its fixes, then its schema): `{ args }`, the input to use (fixed when Claude
 * Code fixes it), or `{ error }`, what Coder is told ("error: InputValidationError: …", Coder's mark of a failed call).
 */
export function checkTaskInput(name, args) {
  if (!isTaskTool(name)) return { args };
  const fixed = name === "task_create" ? fixCreateInput(args) : name === "task_update" ? fixUpdateInput(args) : null;
  const a = fixed || (isObj(args) ? args : {});
  const bad = taskSchemaProblem(name, a);
  if (!bad) return { args: a };
  const steer = name === "task_create" ? createSteer(args) : "";
  return { error: "error: InputValidationError: " + (steer ? steer + "\n\n" : "") + bad };
}

// ---------------------------------------------------------------------------------------------------------------------
// THE LIST (Claude Code's: one per session; ids "1", "2", … from a high-water mark, so an id is never used twice, even after
// a task is deleted or a TaskCreated hook rolls one back; listed in id order).
// ---------------------------------------------------------------------------------------------------------------------
/** A new, empty list. `mark`: the highest id ever given. */
export const emptyTasks = () => ({ mark: 0, tasks: [] });
const strList = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
/** One stored task, checked as Claude Code checks each task file (one that is not a task is left out). */
function readTask(t) {
  if (!isObj(t) || typeof t.id !== "string" || !t.id || typeof t.subject !== "string" || typeof t.description !== "string" || !TASK_STATUSES.includes(t.status)) return null;
  return { id: t.id, subject: t.subject, description: t.description, ...(typeof t.activeForm === "string" ? { activeForm: t.activeForm } : {}), ...(typeof t.owner === "string" ? { owner: t.owner } : {}), status: t.status, blocks: strList(t.blocks), blockedBy: strList(t.blockedBy), ...(isObj(t.metadata) ? { metadata: t.metadata } : {}) };
}
const byId = (a, b) => Number(a.id) - Number(b.id);
/** A stored list read back (anything else: an empty list). */
export function readTasks(saved) {
  if (!isObj(saved)) return emptyTasks();
  const seen = new Set();
  const tasks = (Array.isArray(saved.tasks) ? saved.tasks : []).map(readTask).filter((t) => t && !seen.has(t.id) && seen.add(t.id)).sort(byId);
  const mark = Number.isSafeInteger(saved.mark) && saved.mark > 0 ? saved.mark : 0;
  return { mark, tasks };
}
const highest = (st) => st.tasks.reduce((n, t) => { const x = Number.parseInt(t.id, 10); return Number.isNaN(x) ? n : Math.max(n, x); }, st.mark);
/** TaskCreate: a new pending task with the next id. */
export function createTask(st, { subject, description, activeForm, metadata }) {
  const id = String(highest(st) + 1);
  const task = { id, subject, description, ...(typeof activeForm === "string" ? { activeForm } : {}), status: "pending", blocks: [], blockedBy: [], ...(isObj(metadata) ? { metadata } : {}) };
  st.tasks.push(task);
  st.mark = Math.max(st.mark, Number(id));
  return task;
}
/** One task by its id, as given (Claude Code's: "Task not found" for any other). */
export const findTask = (st, id) => st.tasks.find((t) => t.id === id) || null;
/** A task removed (Claude Code's deleteTask): the high-water mark kept past it, and its id taken off every other task's links. */
export function deleteTask(st, id) {
  const n = Number.parseInt(id, 10);
  if (!Number.isNaN(n) && n > st.mark) st.mark = n;
  const i = st.tasks.findIndex((t) => t.id === id);
  if (i < 0) return false;
  st.tasks.splice(i, 1);
  for (const t of st.tasks) { t.blocks = t.blocks.filter((x) => x !== id); t.blockedBy = t.blockedBy.filter((x) => x !== id); }
  return true;
}
/** A link between two tasks (Claude Code's blockTask): `from` blocks `to`; nothing when either is not on the list. */
function link(st, from, to) {
  const a = findTask(st, from), b = findTask(st, to);
  if (!a || !b) return false;
  if (!a.blocks.includes(to)) a.blocks = [...a.blocks, to];
  if (!b.blockedBy.includes(from)) b.blockedBy = [...b.blockedBy, from];
  return true;
}
/** Metadata merged (Claude Code's: a key set to null is removed). */
export function mergeMetadata(was, more) {
  const out = { ...(isObj(was) ? was : {}) };
  for (const [k, v] of Object.entries(more)) { if (v === null) delete out[k]; else out[k] = v; }
  return out;
}
/**
 * TaskUpdate, in Claude Code's order: the task (not found: "Task not found"); its new subject, description, activeForm and
 * owner when they differ; metadata merged; `deleted` removes it; `completed` asks the TaskCompleted hooks first
 * (`beforeComplete(task)`: their blocking messages, which stop the whole update); then the new links. Answers
 * `{ data, changed }`: Claude Code's result object, and whether the list changed.
 */
export async function updateTask(st, input, { beforeComplete = async () => [] } = {}) {
  const taskId = input.taskId;
  const t = findTask(st, taskId);
  if (!t) return { data: { success: false, taskId, updatedFields: [], error: "Task not found" }, changed: false };
  const fields = [], z = {};
  for (const k of ["subject", "description", "activeForm", "owner"]) if (input[k] !== undefined && input[k] !== t[k]) { z[k] = input[k]; fields.push(k); }
  if (input.metadata !== undefined) { z.metadata = mergeMetadata(t.metadata, input.metadata); fields.push("metadata"); }
  const from = t.status;
  if (input.status !== undefined) {
    if (input.status === "deleted") {
      const ok = deleteTask(st, taskId);
      return { data: { success: ok, taskId, updatedFields: ok ? ["deleted"] : [], ...(ok ? { statusChange: { from, to: "deleted" } } : { error: "Failed to delete task" }) }, changed: ok };
    }
    if (input.status !== from) {
      if (input.status === "completed") {
        const blocks = await beforeComplete(t);
        if (Array.isArray(blocks) && blocks.length) return { data: { success: false, taskId, updatedFields: [], error: blocks.join("\n") }, changed: false };
      }
      z.status = input.status; fields.push("status");
    }
  }
  const before = { blocks: t.blocks.slice(), blockedBy: t.blockedBy.slice() };
  Object.assign(t, z);
  let linked = false;
  if (Array.isArray(input.addBlocks) && input.addBlocks.length) {
    const fresh = input.addBlocks.filter((x) => !before.blocks.includes(x));
    for (const x of fresh) if (link(st, taskId, x)) linked = true;
    if (fresh.length) fields.push("blocks");
  }
  if (Array.isArray(input.addBlockedBy) && input.addBlockedBy.length) {
    const fresh = input.addBlockedBy.filter((x) => !before.blockedBy.includes(x));
    for (const x of fresh) if (link(st, x, taskId)) linked = true;
    if (fresh.length) fields.push("blockedBy");
  }
  return { data: { success: true, taskId, updatedFields: fields, ...(z.status !== undefined ? { statusChange: { from, to: z.status } } : {}) }, changed: Object.keys(z).length > 0 || linked };
}
/** TaskList's summary: no task marked `_internal` in its metadata; a task's blockers only while they are not completed. */
export function listTasks(st) {
  const shown = st.tasks.filter((t) => !(isObj(t.metadata) && t.metadata._internal));
  const done = new Set(shown.filter((t) => t.status === "completed").map((t) => t.id));
  return shown.map((t) => ({ id: t.id, subject: t.subject, status: t.status, ...(t.owner !== undefined ? { owner: t.owner } : {}), blockedBy: t.blockedBy.filter((x) => !done.has(x)) }));
}

// ---------------------------------------------------------------------------------------------------------------------
// WHAT CODER IS ANSWERED (Claude Code's own texts), and the result objects its PostToolUse hooks get (its tool_response).
// ---------------------------------------------------------------------------------------------------------------------
export const createdText = (task) => "Task #" + task.id + " created successfully: " + task.subject;
export const createdFacts = (task) => ({ task: { id: task.id, subject: task.subject, description: task.description } });
export const getFacts = (task) => ({ task: task ? { id: task.id, subject: task.subject, description: task.description, status: task.status, blocks: task.blocks.slice(), blockedBy: task.blockedBy.slice() } : null });
export function getText(task) {
  if (!task) return "Task not found";
  const lines = ["Task #" + task.id + ": " + task.subject, "Status: " + task.status, "Description: " + task.description];
  if (task.blockedBy.length) lines.push("Blocked by: " + task.blockedBy.map((x) => "#" + x).join(", "));
  if (task.blocks.length) lines.push("Blocks: " + task.blocks.map((x) => "#" + x).join(", "));
  return lines.join("\n");
}
export const updateText = (d) => (!d.success ? d.error || "Task #" + d.taskId + " not found" : "Updated task #" + d.taskId + " " + d.updatedFields.join(", "));
export const listText = (tasks) => (!tasks.length ? "No tasks found" : tasks.map((t) => "#" + t.id + " [" + t.status + "] " + t.subject + (t.owner ? " (" + t.owner + ")" : "") + (t.blockedBy.length ? " [blocked by " + t.blockedBy.map((x) => "#" + x).join(", ") + "]" : "")).join("\n"));
/** What a TaskCreated or TaskCompleted hook that blocks says (Claude Code's "<Event> hook feedback:" and a new line). */
export const taskHookFeedback = (event, text) => event + " hook feedback:\n" + text;

// ---------------------------------------------------------------------------------------------------------------------
// CLAUDE CODE'S REMINDER (its task_reminder): before each answer, when Coder has the task tools and its last 10 steps used
// neither task_create nor task_update, and no reminder came in its last 10 steps. Claude Code counts each part of an answer
// (a text, a tool call) as one step, as it keeps them; Coder's answer holds its text and its calls together, so they are
// counted one by one here, the newest first.
// ---------------------------------------------------------------------------------------------------------------------
export const TASK_REMINDER_TURNS = 10;
const REMINDER_HEAD = "The task tools haven't been used recently. If you're working on tasks that would benefit from tracking progress, consider using task_create to add new tasks and task_update to update task status (set to in_progress when starting, completed when done). Also consider cleaning up the task list if it has become stale. Only use these if relevant to the current work. This is just a gentle reminder - ignore if not applicable.\n";
/** The reminder as Coder is given it: a note of Coder's app (Claude Code's is a system reminder), with the tasks on the list. */
export const NOTE_START = "(Note from Coder's app, not the owner:\n";
export function taskReminderNote(tasks) {
  let text = REMINDER_HEAD;
  const lines = (Array.isArray(tasks) ? tasks : []).map((t) => "#" + t.id + ". [" + t.status + "] " + t.subject).join("\n");
  if (lines.length) text += "\n\nHere are the existing tasks:\n\n" + lines;
  return NOTE_START + text.replace(/\n+$/, "") + ")";
}
const isReminder = (m) => m && m.role === "user" && typeof m.content === "string" && m.content.startsWith(NOTE_START + REMINDER_HEAD.slice(0, 60));
/** The parts of one of Coder's answers, in order: its text, then each tool call's name. */
function answerParts(m) {
  const parts = [];
  if (typeof m.content === "string" ? m.content.trim() : Array.isArray(m.content) && m.content.some((x) => x && typeof x.text === "string" && x.text.trim())) parts.push("");
  for (const c of Array.isArray(m.tool_calls) ? m.tool_calls : []) parts.push(String((c && c.function && c.function.name) || ""));
  return parts;
}
/** Whether the reminder is due now (Claude Code's 10 steps since the tools were used, and 10 since the last reminder). */
export function taskReminderDue(convo, turns = TASK_REMINDER_TURNS) {
  let sinceUse = 0, sinceReminder = 0, used = false, reminded = false;
  for (let i = (Array.isArray(convo) ? convo.length : 0) - 1; i >= 0; i--) {
    const m = convo[i];
    if (!m || typeof m !== "object") continue;
    if (m.role === "assistant") {
      const parts = answerParts(m);
      for (let k = parts.length - 1; k >= 0; k--) {
        if (!used && (parts[k] === "task_create" || parts[k] === "task_update")) used = true;
        if (!used) sinceUse++;
        if (!reminded) sinceReminder++;
      }
    } else if (!reminded && isReminder(m)) reminded = true;
    if (used && reminded) break;
  }
  return sinceUse >= turns && sinceReminder >= turns;
}

// ---------------------------------------------------------------------------------------------------------------------
// WHAT THE OWNER SEES: the list in the chat's checklist (the page's "Plan" box), as Claude Code's own task list shows it
// (no task marked `_internal`), each in progress by its activeForm when it has one (Claude Code's docs, "Track todos": a
// progress display "shows each active item's activeForm label in place of its subject"). The page's own words for the
// statuses: done (Claude Code's completed), in_progress, pending.
// ---------------------------------------------------------------------------------------------------------------------
export const PAGE_ITEMS_MAX = 100;
export function pageItems(st, clean = (s) => s) {
  return st.tasks.filter((t) => !(isObj(t.metadata) && t.metadata._internal)).slice(0, PAGE_ITEMS_MAX).map((t) => ({
    text: String(clean(t.status === "in_progress" && filled(t.activeForm) ? t.activeForm : t.subject)).replace(/\s+/g, " ").trim().slice(0, 200),
    status: t.status === "completed" ? "done" : t.status,
  }));
}

// ---------------------------------------------------------------------------------------------------------------------
// THE CHAT'S LIST, KEPT BETWEEN MESSAGES: one file of root's beside the chat's memory (its folder is root's, so the AI's
// commands cannot swap it), written whole each time through a new file then renamed over it, read never through a link.
// ---------------------------------------------------------------------------------------------------------------------
export function taskStore(file) {
  return {
    load: async () => {
      let fh;
      try { fh = await openFile(file, constants.O_RDONLY | constants.O_NOFOLLOW); } catch { return emptyTasks(); }
      try { return readTasks(JSON.parse(await fh.readFile("utf8"))); } catch { return emptyTasks(); } finally { await fh.close().catch(() => {}); }
    },
    save: async (st) => {
      const tmp = join(dirname(file), "." + basename(file) + "." + process.pid + "." + Date.now() + ".tmp");
      const fh = await openFile(tmp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      try { await fh.writeFile(JSON.stringify({ mark: st.mark, tasks: st.tasks })); } finally { await fh.close(); }
      await rename(tmp, file);
    },
  };
}
