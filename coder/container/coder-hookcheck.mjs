/**
 * A HOOK'S REWRITES, CHECKED AS CLAUDE CODE CHECKS THEM (the owner, 2026-11-14: "Fix base on Claude Code docs, please";
 * Claude Code 2.1.325's program, where its hooks reference stops):
 *   - a PostToolUse hook's updatedToolOutput: checked against the tool's output shape (coder-zod.mjs checkRewrite); a value
 *     that matches becomes the tool's answer through the tool's own text, what Coder prints for that result object
 *     (outputTextOf, below: Claude Code's mapToolResultToToolResultBlockParam, with Coder's words where Coder has its own);
 *   - a PreToolUse or PermissionRequest hook's updatedInput: checked before the call runs (checkHookInput, Claude Code's
 *     GJe): its schema, the keys the tool does not know dropped, then the tool's own check ("unknown keys are dropped, and
 *     input the tool rejects denies the call", its changelog, 2.1.300).
 * Machine side only (it reads the tools' modules): Coder's loop (coder-agent.mjs) gives it to the hooks' outcome.
 */
import { checkRewrite, zodIssues, failedText, fromJsonSchema, coerceInput, withoutUnknown, deepEqual } from "./coder-zod.mjs";
import { plainOutputText, toolInputFromHook, answeredText } from "./coder-hooks.mjs";
import { grepText, globText } from "./coder-search.mjs";
import { searchText } from "./coder-websearch.mjs";
import { createdText, getText, listText, updateText, TODO_WRITE_RESULT } from "./coder-tasks.mjs";
import { planApproved, ENTERED_PLAN, ENTERED_PLAN_TEXT } from "./coder-plan.mjs";
import { WRITE_FRESH, EDIT_OTHER_CHANGES } from "./coder-tools.mjs";

// ── A REWRITE'S TEXT ─────────────────────────────────────────────────────────
/** A Read result object's lines as Coder's read shows them: each line's number, a tab, the line. */
const numbered = (content, start) => content.split("\n").map((l, i) => String(start + i).padStart(6) + "\t" + l).join("\n");
/**
 * EACH TOOL'S TEXT FOR ITS RESULT OBJECT (Claude Code's tool by tool, EnterPlanMode's and TodoWrite's too since 2026-11-14),
 * as Coder prints it: `(tool, value)` → text, or
 * { text, pics } for a picture Grok is shown; undefined when Coder has no text for it (Claude Code's "mapper returned
 * undefined": a Read notebook, PDF or page-images object, which Coder's read never makes). `ctx`: `shownPath(full)` (a
 * path as Coder's answers name it) and `monitorText(id, ms)` (a monitor's start, coder-agent.mjs's monitorStarted).
 */
export function outputTextOf(ctx = {}) {
  const shown = (p) => (typeof ctx.shownPath === "function" ? ctx.shownPath(String(p)) : String(p));
  return (tool, v) => {
    switch (tool) {
      case "Read": {
        if (v.type === "image") return { text: "", pics: /^image\/(png|jpeg)$/.test(v.file.type) ? [{ type: v.file.type, data: v.file.base64 }] : [] };
        if (v.type !== "text") return undefined;
        const f = v.file;
        // (Claude Code's: the numbered lines; a single empty line; an empty file; an offset past the end. Coder's words for
        // the last two, as its read says them.)
        if (f.content) return numbered(f.content, f.startLine);
        if (f.numLines >= 1 && f.totalLines > 1) return numbered("", f.startLine);
        if (f.numLines >= 1 || f.totalLines === 0) return shown(f.filePath) + " exists, but it is empty.";
        return shown(f.filePath) + " has " + f.totalLines + " line" + (f.totalLines === 1 ? "" : "s") + ": offset " + f.startLine + " is past its end.";
      }
      case "Write": {
        const mod = v.userModified ? " The owner modified your proposed content before accepting it." : "";
        return (v.type === "create" ? "File created successfully at: " + shown(v.filePath) : "The file " + shown(v.filePath) + " has been updated successfully.") + mod + (v.userModified ? "" : WRITE_FRESH);
      }
      case "Edit": {
        const mod = v.userModified ? ".  The owner modified your proposed changes before accepting them. " : "";
        const tail = v.staleRecovered ? EDIT_OTHER_CHANGES : v.userModified || v.contentNotInModelContext ? "" : WRITE_FRESH;
        return v.replaceAll ? "The file " + shown(v.filePath) + " has been updated" + mod + ". All occurrences were successfully replaced." + tail : "The file " + shown(v.filePath) + " has been updated successfully" + mod + "." + tail;
      }
      case "Grep": return grepText(v);
      case "Glob": return globText(v);
      case "WebSearch": return searchText(v);
      case "Monitor":
        if (typeof ctx.monitorText !== "function") return undefined;
        if (!v.persistent) return ctx.monitorText(v.taskId, v.timeoutMs);
        // (Claude Code's for one with no time limit: "persistent — runs until TaskStop or session end".)
        { const t = ctx.monitorText(v.taskId, v.timeoutMs), k = t.indexOf("). "); return "Monitor started (task " + v.taskId + ", persistent — runs until stop_job or chat end)" + (k >= 0 ? t.slice(k + 1) : ""); }
      case "AskUserQuestion": {
        const keys = v.questions.map((q) => ({ key: q.question, text: q.question, labels: (Array.isArray(q.options) ? q.options : []).map((o) => o.label), multi: q.multiSelect === true }));
        return answeredText(keys, v.answers, v.annotations, { response: typeof v.response === "string" ? v.response : "" }).text;
      }
      case "ExitPlanMode":
        if (v.awaitingLeaderApproval) return "Your plan has been submitted to the team lead for approval.\n\nPlan file: " + v.filePath + "\n\n**What happens next:**\n1. Wait for the team lead to review your plan\n2. You will receive a message in your inbox with approval/rejection\n3. If approved, you can proceed with implementation\n4. If rejected, refine your plan based on the feedback\n\n**Important:** Do NOT proceed until you receive approval. Check your inbox for response.\n\nRequest ID: " + v.requestId;
        if (v.isAgent) return 'The owner has approved the plan. There is nothing else needed from you now. Please respond with "ok"';
        return planApproved(v.plan || "", { file: v.filePath || "", edited: v.planWasEdited === true, unsaved: v.planWasEdited === true && !v.filePath });
      // (EnterPlanMode's: its message, then what plan mode asks, as Coder is told on entering it; TodoWrite's: its fixed words.)
      case "EnterPlanMode": return v.message + ENTERED_PLAN_TEXT.slice(ENTERED_PLAN.length);
      case "TodoWrite": return TODO_WRITE_RESULT;
      case "TaskCreate": return createdText(v.task);
      case "TaskGet": return getText(v.task);
      case "TaskList": return listText(v.tasks);
      case "TaskUpdate": return updateText(v);
      default: return plainOutputText(tool, v);
    }
  };
}
/**
 * A POSTTOOLUSE HOOK'S REWRITE OF ONE CALL'S OUTPUT, for the hooks' outcome (coder-hooks.mjs hooksOutcome's `rewrite`):
 * { text, pics? } or { notice }. `given`: the result object the hooks were given.
 */
export const outputRewrite = (tool, ctx = {}, given = null) => (value, { withNote = false } = {}) => checkRewrite(tool, value, { textOf: outputTextOf(ctx), given, withNote });

// ── A HOOK'S NEW INPUT ───────────────────────────────────────────────────────
/** What Claude Code adds after a hook's rewrite it refuses. */
export const REWRITE_TAIL = "The tool input from the model was valid; the hook's rewrite of it was not.";
const FILE_TOOLS = new Set(["read", "write", "edit"]);
const plain = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
/**
 * A PRETOOLUSE OR PERMISSIONREQUEST HOOK'S updatedInput, CHECKED BEFORE THE CALL RUNS (Claude Code 2.1.325's GJe; its words):
 *   1. the tool's schema (`params`, what Grok is given; numbers and booleans written as text taken as such): any issue but a
 *      key it does not know refuses it: "<Event> hook for <Tool> returned updatedInput that failed schema validation: <its
 *      schema's words> / The tool input from the model was valid; the hook's rewrite of it was not.";
 *   2. the keys it does not know dropped;
 *   3. the tool's own check (`check(args)`, coder-inputs.mjs's for the tools that have one), awaited as Claude Code awaits the
 *      tool's validateInput on the rewrite (lsp's file checks, "File does not exist: …", need the chat's files): its schema's
 *      refusal as above, any other as "… returned updatedInput that the tool refused: <its words>"; a check that throws, "…
 *      that the tool could not check: <why> / The tool input from the model was valid.".
 * `name` Coder's tool, `tool` its name for hooks, `input` the hook's (hooks' names: `file_path`). → a Promise of { ok: true,
 * args } (Coder's names, as the tool takes them), or { ok: false, message }. A tool with no schema (a connector's) takes any
 * object.
 */
export async function checkHookInput({ name, tool, input, event = "PreToolUse", params = null, check = null, ctx = {} }) {
  const lead = event + " hook for " + tool;
  let a = toolInputFromHook(name, input);
  if (!a) return { ok: false, message: lead + " returned updatedInput that failed schema validation: " + failedText(tool, zodIssues(fromJsonSchema({ type: "object", properties: {} }), input)) + "\n" + REWRITE_TAIL };
  // (Read's, Write's and Edit's `file_path`, whatever it holds, is the path the hook gave: Claude Code's own name for it.)
  if (FILE_TOOLS.has(name) && plain(input) && Object.prototype.hasOwnProperty.call(input, "file_path")) a.path = input.file_path;
  if (!params || typeof params !== "object" || !params.properties) return { ok: true, args: a };
  a = coerceInput(params, a);
  const issues = zodIssues(fromJsonSchema(params), a).filter((x) => x.code !== "unrecognized_keys");
  // (Named as hooks name them: Read's, Write's and Edit's `path` is `file_path` there.)
  const named = FILE_TOOLS.has(name) ? issues.map((x) => (x.path[0] === "path" ? { ...x, path: ["file_path", ...x.path.slice(1)] } : x)) : issues;
  if (named.length) return { ok: false, message: lead + " returned updatedInput that failed schema validation: " + failedText(tool, named) + "\n" + REWRITE_TAIL };
  a = withoutUnknown(params, a);
  if (typeof check !== "function") return { ok: true, args: a };
  let v;
  try { v = await check(a, ctx); } catch (e) { return { ok: false, message: lead + " returned updatedInput that the tool could not check: " + String((e && e.message) || e) + "\nThe tool input from the model was valid." }; }
  if (v && typeof v.error === "string") {
    const m = v.error.replace(/^error: /, "");
    if (m.startsWith("InputValidationError: ")) return { ok: false, message: lead + " returned updatedInput that failed schema validation: " + m.slice("InputValidationError: ".length) + "\n" + REWRITE_TAIL };
    return { ok: false, message: lead + " returned updatedInput that the tool refused: " + m + "\n" + REWRITE_TAIL };
  }
  return { ok: true, args: v && plain(v.args) ? v.args : a };
}
/** Whether a PermissionRequest hook's new input changes nothing: empty, or the input it was shown (Claude Code's Bnn). */
export const sameInput = (updated, shown) => !updated || typeof updated !== "object" || !Object.keys(updated).length || deepEqual(updated, shown);
