/**
 * A REPLY'S CALLS SIDE BY SIDE, AS CLAUDE CODE RUNS THEM (recheck 2's S3 and W3; the owner, 2026-11-14: "yes pls all of
 * that"). Claude Code's agent loop docs: "When Claude requests multiple tool calls in a single turn, both SDKs can run them
 * concurrently or sequentially depending on the tool. Read-only tools (like `Read`, `Glob`, `Grep`, and MCP tools marked as
 * read-only) can run concurrently. Tools that modify state (like `Edit`, `Write`, and `Bash`) run sequentially to avoid
 * conflicts."
 *
 * What its program does (2.1.325, the query loop's StreamingToolExecutor): each call of a reply is queued in the order
 * asked, marked concurrency-safe when its tool's isConcurrencySafe says so for its input (an input its schema refuses is
 * not); a safe call starts at once when every call already running is safe too; any other call waits until none runs, and
 * then runs alone; the calls after a waiting one wait for it. So a reply's consecutive safe calls run together and an unsafe
 * one runs alone, in order (seen in this session too, a Claude Code 2.1.325 cloud session: three read-only commands started
 * within 3 ms of each other; a `touch` between two of them started only once the first had ended, and the third only once
 * the `touch` had). Nothing caps how many run together there: CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY (10 when unset) caps
 * only its older batch runner, which it uses to take up a deferred call again, and code mode's own calls. Each call goes
 * through its own input check, PreToolUse hooks, permission check and card while the others run, and gives its own result:
 * a refused or failed call cancels none of the others (its changelog: "Parallel tool calls: a failed Bash command no longer
 * cancels other calls in the same batch — each tool returns its own result independently"). Its PostToolUse hooks run as
 * each call ends; PostToolBatch once all have. Its chat shows each call where it was asked; the model gets the results in
 * the order they finish (each call's result is passed on as soon as it is done).
 *
 * Coder runs the same groups (coder-agent.mjs): at a group's first call, each call of the group that needs nothing before
 * it runs (no PreToolUse hook of its own, no card, no rule that refuses it; Coder's auto mode checker's verdict, when it
 * needs one, asked right then beside the others', as Claude Code asks for each call at its start) starts at once
 * (`earlyRuns`); every call still takes its turn in the order asked, where its checks are made as before and it takes the
 * result of its early start, so the chat shows the steps, and Grok gets the results, in the order asked (xAI pairs each
 * result with its call by its id, so the order changes nothing for Grok). A call that needs a hook, a card or the owner runs
 * in its turn, while the others of its group run. Where no one can answer while Coder works, a question or a plan ends the
 * turn in its turn, so no call after it starts early.
 */

/**
 * CLAUDE CODE'S CONCURRENCY-SAFE TOOLS, by Coder's names (2.1.325, each tool's isConcurrencySafe in its program): Read, Grep,
 * Glob, LSP, WebFetch, WebSearch, ToolSearch, TaskGet, TaskList and TaskUpdate, TaskStop, Monitor, AskUserQuestion,
 * EnterPlanMode and ExitPlanMode always; Bash when its command only reads (its isConcurrencySafe is its isReadOnly); an MCP
 * tool when it is marked read-only (readOnlyHint), or its server lets its calls overlap. Never: Edit, Write, NotebookEdit,
 * TodoWrite, TaskCreate, Skill.
 * (PowerShell is safe there when its command only reads too; Coder knows that only after PowerShell's own parse, in the
 * call's turn, so a PowerShell call runs alone here.)
 */
export const SAFE_TOOLS = new Set(["read", "grep", "glob", "lsp", "web_fetch", "web_search", "tool_search", "task_get", "task_list", "task_update", "stop_job", "monitor", "ask_user", "enter_plan_mode", "exit_plan_mode"]);

/**
 * WHETHER A CALL MAY RUN BESIDE OTHERS (Claude Code's isConcurrencySafe on its parsed input). `readOnly(command)`: whether a
 * command only reads; `connector(name)`: true for a connector's tool marked read-only, false for another of its tools,
 * undefined for no connector's; `inputOk(name, args)`: whether the tool's own input check takes the input.
 */
export function safeCall(c, { readOnly = () => false, connector = () => undefined, inputOk = () => true } = {}) {
  if (!c || typeof c.name !== "string" || !c.args || typeof c.args !== "object" || Array.isArray(c.args)) return false;
  if (c.name === "bash") return typeof c.args.command === "string" && c.args.command.trim() !== "" && readOnly(c.args.command) === true;
  const mcp = connector(c.name);
  if (mcp !== undefined) return mcp === true;
  return SAFE_TOOLS.has(c.name) && inputOk(c.name, c.args) !== false;
}

/**
 * THE END OF THE GROUP THAT STARTS AT `from` (exclusive): the run of consecutive safe calls from there, or `from + 1` for a
 * call that runs alone.
 */
export function groupEnd(calls, from, isSafe) {
  const list = Array.isArray(calls) ? calls : [];
  if (from >= list.length) return from;
  if (!isSafe(list[from])) return from + 1;
  let to = from + 1;
  while (to < list.length && isSafe(list[to])) to++;
  return to;
}

/** What a run started with a verdict gives when the verdict did not let it start. */
const SKIPPED = Symbol("not started");

/**
 * THE CALLS STARTED AT THEIR GROUP'S START, each taken in its turn with the same `key` (what it was started with: a turn
 * that has come to a different input, a hook's or a fix's, runs its call itself and the early result is not used).
 * `onUsage(u)`: what an early model call used (a page reader's, a search's, the checker's), counted when it ends, taken off
 * what the call's turn gets so it is counted once; `onTaken(id, startedAt, endedAt)`: an early result used in its turn.
 */
export function earlyRuns({ now = Date.now, onUsage = null, onTaken = null } = {}) {
  const runs = new Map();
  const counted = (x) => {
    if (!x || typeof x !== "object" || !x.usage) return x;
    try { if (typeof onUsage === "function") onUsage(x.usage); } catch { /* counted where it can be */ }
    return { ...x, usage: null };
  };
  const settle = (e, p) => {
    e.promise = p.then((x) => { const v = counted(x); if (v !== SKIPPED) e.doneAt = now(); return v; });
    // (One never taken, its job stopped or its turn's input changed, rejects into nothing.)
    e.promise.catch(() => {});
  };
  return {
    has: (id) => runs.has(id),
    /** `run()` started now for call `id`, to be taken in its turn with the same `key`. */
    start(id, key, run) {
      const e = { key, at: now(), doneAt: 0 };
      settle(e, Promise.resolve().then(run));
      runs.set(id, e);
    },
    /**
     * A VERDICT ASKED NOW (`check()`, the auto mode checker's, for exactly the action `checkKey` names) and, once it lets the
     * call run (`go(verdict)`), `run()` started at once; its turn takes the verdict (takeCheck) and then the result (take).
     */
    checkThenRun(id, checkKey, check, key, go, run) {
      const e = { key, checkKey, at: 0, doneAt: 0 };
      e.check = Promise.resolve().then(check).then(counted, (err) => ({ error: String((err && err.message) || err).slice(0, 200), kind: "unavailable" }));
      settle(e, e.check.then(async (v) => { if (!(await go(v))) return SKIPPED; e.at = now(); return run(); }));
      runs.set(id, e);
    },
    /** The verdict asked at the group's start for this same action, once; null when there is none (or it was for another). */
    takeCheck(id, checkKey) {
      const e = runs.get(id);
      if (!e || !e.check) return null;
      if (e.checkKey !== checkKey || e.checkTaken) { runs.delete(id); return null; }
      e.checkTaken = true;
      return e.check;
    },
    /** The early result of call `id` when it was started with this `key` (a Promise of it), else a Promise of null. */
    take(id, key) {
      const e = runs.get(id);
      runs.delete(id);
      if (!e || e.key !== key) return Promise.resolve(null);
      return e.promise.then((x) => {
        if (x === SKIPPED || x === null || x === undefined) return null;
        try { if (typeof onTaken === "function") onTaken(id, e.at, e.doneAt); } catch { /* timing only */ }
        return x;
      });
    },
  };
}
