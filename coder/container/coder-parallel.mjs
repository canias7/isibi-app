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
 * it runs (no card, no rule that refuses it; Coder's auto mode checker's verdict, when it needs one, asked right then beside
 * the others', as Claude Code asks for each call at its start) starts at once (`earlyRuns`); every call still takes its turn
 * in the order asked, where its checks are made as before and it takes the result of its early start, so the chat shows the
 * steps, and Grok gets the results, in the order asked (xAI pairs each result with its call by its id, so the order changes
 * nothing for Grok). A call that needs a card or the owner runs in its turn, while the others of its group run. Where no one
 * can answer while Coder works, a question or a plan ends the turn in its turn, so no call after it starts early.
 *
 * ROUND 5 (the owner, 2026-11-14: "Yes pls" to the last differences round 3 found):
 * - EACH CALL'S OWN PRETOOLUSE HOOKS AT ITS GROUP'S START (Claude Code runs a call's hooks, its permission check and its card
 *   inside that call's own run, so a group's calls run their hooks at the same time): a call with a hook of the owner's has its
 *   hooks started beside the others' (`startHooks`), and, when they decided nothing that its turn must act on (a deny, an ask,
 *   a new input, a stop), its run starts right after them, as one with no hook would; its turn takes their outcome
 *   (`takeHooks`), so they run once.
 * - A ROUND THAT ENDS EARLY (`RoundClosing`, `closedAs`): the owner's No on a card (Claude Code's deny with "interrupt": its
 *   turn's controller aborted, with no reason of its own), their Stop (its "remote-cancel"), or a card left open that pauses
 *   the job. Claude Code then keeps what each call of the reply that ran beside it returned, when it had returned by then (its
 *   executor yields a finished call's result as it comes, whatever the calls before it are still doing); a call still running
 *   gets its synthetic result (createSyntheticErrorMessage: its rejection, REJECTED, after a No; after a Stop its rejection
 *   with "Correction to the text above: this call was stopped while running …", STOPPED_RUNNING, the "remote-cancel" of a call
 *   that was running); one that had not started gets the rejection too. A paused job keeps its finished ones' results in the
 *   chat (its cloud session's results stay in its transcript while its machine sleeps), so the job taken up again gives them to
 *   Grok with the round's other results and runs none of them again.
 *
 * ROUND 6 (the owner, 2026-11-14: "do what claude code does"):
 * - THE MARK OF AN INTERRUPTED TURN (INTERRUPTED_TOOL_USE, INTERRUPTED; interruptedNote): after a No or a Stop has ended the
 *   round and every call has its result, Claude Code 2.1.325 adds a message of its own to the conversation, "[Request
 *   interrupted by user for tool use]" (its query loop, when its turn was aborted while the tools ran), or "[Request
 *   interrupted by user]" when the abort came while the model was answering (or, between two rounds, before its next answer).
 *   Not after a pause, nor where the turn stopped for its own reasons (a check's denial, below). Coder adds the same, "the
 *   owner" for "user" (coder-agent.mjs closedEnd).
 * - A ROUND STOPPED BY THE AUTO MODE CHECKER (closedAs "checker"): when the checker gave no verdict too many times in a row,
 *   Claude Code's denial for that call ends the turn ("permission-stop"): the calls beside it that started go on and keep what
 *   they return, and each one not started is told SKIPPED_BY_CHECK; no mark follows.
 */

/** Claude Code 2.1.325's own marks of an interrupted turn, "the owner" for "user" as Coder's REJECTED and STOPPED_RUNNING have it. */
export const INTERRUPTED_TOOL_USE = "[Request interrupted by the owner for tool use]";
export const INTERRUPTED = "[Request interrupted by the owner]";
/**
 * THAT MARK AS CLAUDE CODE ADDS IT: a user message of its own after the round's results (`toolUse`: the abort came while the
 * tools ran, else while the model answered), never the owner's words (appNote: Coder's counts, cuts and summaries of the
 * owner's messages pass it by, as Claude Code's pass its interrupt messages by).
 */
export const interruptedNote = (toolUse = true) => ({ role: "user", appNote: true, content: toolUse ? INTERRUPTED_TOOL_USE : INTERRUPTED });
/**
 * WHAT A CALL NOT STARTED IS TOLD WHEN THE AUTO MODE CHECKER'S NO-VERDICT DENIAL ON ANOTHER CALL ENDED THE TURN (Claude Code
 * 2.1.325's own words, its "permission-stop" cancel text).
 */
export const SKIPPED_BY_CHECK = "[Tool call skipped: the turn was stopped before this call ran, by the check whose denial is on another call in this batch. Nothing refused this call and it had no effects; re-run it if still needed.]";

/**
 * CLAUDE CODE'S CONCURRENCY-SAFE TOOLS, by Coder's names (2.1.325, each tool's isConcurrencySafe in its program): Read, Grep,
 * Glob, LSP, WebFetch, WebSearch, ToolSearch, TaskGet, TaskList and TaskUpdate, TaskStop, Monitor, AskUserQuestion,
 * EnterPlanMode and ExitPlanMode always; Bash when its command only reads (its isConcurrencySafe is its isReadOnly); an MCP
 * tool when it is marked read-only (readOnlyHint), or its server lets its calls overlap. Never: Edit, Write, NotebookEdit,
 * TodoWrite, TaskCreate, Skill.
 * (Never PowerShell, there either: its isConcurrencySafe is its isReadOnly, which checks a command only against a parse of it
 * that the check is not given, so it answers no for every command (2.1.325: `cn(e)`, `FLt(e.command)` with no parse). A
 * PowerShell call runs alone, as in Claude Code. Round 5 checked this, 2026-11-14.)
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
  // (A call's PreToolUse hooks started at its group's start: its id → their outcome to come. Round 5.)
  const hooks = new Map();
  const counted = (x) => {
    if (!x || typeof x !== "object" || !x.usage) return x;
    try { if (typeof onUsage === "function") onUsage(x.usage); } catch { /* counted where it can be */ }
    return { ...x, usage: null };
  };
  const settle = (e, p) => {
    e.promise = p.then((x) => { const v = counted(x); if (v !== SKIPPED) { e.doneAt = now(); e.value = v; } else e.skipped = true; return v; }, (err) => { e.doneAt = now(); e.failed = true; throw err; });
    // (One never taken, its job stopped or its turn's input changed, rejects into nothing.)
    e.promise.catch(() => {});
  };
  return {
    has: (id) => runs.has(id) || hooks.has(id),
    /**
     * WHERE CALL `id`'S EARLY START STOOD AT TIME `at` (for a round that ends early, `closedAs`): "done" (its result, or its
     * error, had come), "running" (started, no result yet), "waiting" (its hooks or its verdict still deciding, or the run held
     * back by them), "none" (not started early). A run that gave nothing (a search the budget refused) is not done.
     */
    state(id, at = Infinity) {
      const e = runs.get(id);
      if (!e) return hooks.has(id) ? "waiting" : "none";
      // (One refused at the group's start, by its own check, a rule, its hook or the checker: its turn only refuses it, so it
      // had its answer then, as Claude Code's call refused in its own run has.)
      if (e.decided && e.doneAt <= at) return "done";
      if (e.doneAt && e.doneAt <= at && !e.skipped) return e.failed || (e.value !== null && e.value !== undefined) ? "done" : "waiting";
      if (e.at && e.at <= at && !e.skipped) return "running";
      return "waiting";
    },
    /**
     * A CALL REFUSED AT ITS GROUP'S START (its input, a deny rule, its own hook's deny): its turn refuses it, with nothing run;
     * it counts as answered then (`state`), and it is not started early.
     */
    refused(id) { if (!runs.has(id)) runs.set(id, { key: null, at: 0, doneAt: now(), decided: true }); },
    /**
     * A CALL'S PRETOOLUSE HOOKS STARTED AT ITS GROUP'S START (`run()`: their outcome, once what follows them, its run's start
     * or not, is decided), for its turn to take with the same `key` (the hooks' input).
     */
    startHooks(id, key, run) {
      const h = { key, at: now() };
      h.promise = Promise.resolve().then(run);
      h.promise.catch(() => {});
      hooks.set(id, h);
    },
    /** The outcome of call `id`'s hooks started early, for this same input, once (a Promise); else null (its turn runs them). */
    takeHooks(id, key) {
      const h = hooks.get(id);
      hooks.delete(id);
      return h && h.key === key ? h.promise : null;
    },
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
      // (A verdict that blocks it: its turn refuses it, so it had its answer then, `state`.)
      settle(e, e.check.then(async (v) => { if (!(await go(v))) { if (v && !v.error && v.decision === "block") { e.decided = true; e.doneAt = now(); } return SKIPPED; } e.at = now(); return run(); }));
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

/**
 * A ROUND THAT ENDS EARLY, thrown from a call's turn (`why`: "no", "stop", "park", or "checker": the auto mode checker's
 * no-verdict denial that ends the turn): Coder's loop answers that call, if its turn did not, and goes on to the next one in
 * closing mode (coder-agent.mjs).
 */
export class RoundClosing {
  constructor(why) { this.why = why; }
}

/**
 * WHAT A CALL AFTER THE ONE THAT ENDED THE ROUND GETS (`why`, as RoundClosing's; `state`, its early start's as the round ended:
 * earlyRuns' state), as Claude Code 2.1.325's executor gives it: "turn" when it had its result by then (its turn takes that
 * result, in its words, as on any turn); for a Stop, "stopped-running" when it was running; "rejected" otherwise (Claude Code's
 * rejection after a No, and after a Stop for one that was not running); for a pause, "later": its turn comes when the job is
 * taken up again. After the checker's denial ("checker"): "turn" for one running too (it goes on, and keeps its result), and
 * "skipped" for one not started (SKIPPED_BY_CHECK). (Round 6.)
 */
export function closedAs(why, state) {
  if (state === "done") return "turn";
  if (why === "park") return "later";
  if (why === "checker") return state === "running" ? "turn" : "skipped";
  if (why === "stop" && state === "running") return "stopped-running";
  return "rejected";
}
