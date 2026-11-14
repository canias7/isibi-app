/**
 * CLAUDE CODE'S PLAN MODE AND ITS EXITPLANMODE TOOL (the owner, 2026-11-14: "Do all the talk to you tools execpt for the
 * notify one"), as Claude Code 2.1.325 has them in a session with a disk, as its cloud sessions are: the plan goes in a plan
 * file outside the repository, which plan mode names to the model ("No plan file exists yet. You should create your plan at
 * … using the Write tool"); it is the only file the model may change while planning; ExitPlanMode "does NOT take the plan
 * content as a parameter - it will read the plan from the file you wrote", and Claude Code puts the file's text and path in
 * its input before its check, its hooks and the approval card (its hooks reference: "Claude Code injects the plan content
 * and file path before passing the input to hooks").
 *
 * Coder's machine keeps each chat's plan file beside the chat's memory (planStore, coder-plan-file.mjs), never in the repository's folder,
 * so it never goes to the branch. A run with no plan file (`deps.plan` missing: a test, or a machine that could not make the
 * folder) plans as Claude Code's sessions without a disk do: the plan goes to exit_plan_mode as its `plan` argument.
 *
 * This file holds no Node module (Coder's Worker loads its words through coder-perms.mjs, and the Worker has no Node's);
 * the plan file's reading and writing is in coder-plan-file.mjs, for the machine only.
 *
 * Texts are Claude Code's own (its ExitPlanMode prompt, its plan mode reminders, its tool results), with "Coder" for
 * "Claude", "the owner" for "the user", and Coder's tool names (write, edit, ask_user, exit_plan_mode).
 */

import { inputErrorText, typeIssue, unknownKeysIssue, valueIssue } from "./coder-zodtext.mjs";

// ── ENTER_PLAN_MODE, AS THE MODEL SEES IT (Claude Code's EnterPlanMode; the owner, 2026-11-14: "Fix base on Claude Code docs,
// please"): its prompt, inputs (none) and result, word for word, with Coder's names (glob, grep, read, ask_user,
// exit_plan_mode, enter_plan_mode) and "the owner" for "the user". Its "(use the Agent tool instead)" is left out, as Claude
// Code leaves it out of a session without its Agent tool. ──────────────────────────────────────────────────────────────
export const ENTER_PLAN_DESC = `Use this tool proactively when you're about to start a non-trivial implementation task. Getting owner sign-off on your approach before writing code prevents wasted effort and ensures alignment. This tool transitions you into plan mode where you can explore the codebase and design an implementation approach for owner approval.

## When to Use This Tool

**Prefer using enter_plan_mode** for implementation tasks unless they're simple. Use it when ANY of these conditions apply:

1. **New Feature Implementation**: Adding meaningful new functionality
   - Example: "Add a logout button" - where should it go? What should happen on click?
   - Example: "Add form validation" - what rules? What error messages?

2. **Multiple Valid Approaches**: The task can be solved in several different ways
   - Example: "Add caching to the API" - could use Redis, in-memory, file-based, etc.
   - Example: "Improve performance" - many optimization strategies possible

3. **Code Modifications**: Changes that affect existing behavior or structure
   - Example: "Update the login flow" - what exactly should change?
   - Example: "Refactor this component" - what's the target architecture?

4. **Architectural Decisions**: The task requires choosing between patterns or technologies
   - Example: "Add real-time updates" - WebSockets vs SSE vs polling
   - Example: "Implement state management" - Redux vs Context vs custom solution

5. **Multi-File Changes**: The task will likely touch more than 2-3 files
   - Example: "Refactor the authentication system"
   - Example: "Add a new API endpoint with tests"

6. **Unclear Requirements**: You need to explore before understanding the full scope
   - Example: "Make the app faster" - need to profile and identify bottlenecks
   - Example: "Fix the bug in checkout" - need to investigate root cause

7. **Owner Preferences Matter**: The implementation could reasonably go multiple ways
   - If you would use ask_user to clarify the approach, use enter_plan_mode instead
   - Plan mode lets you explore first, then present options with context

## When NOT to Use This Tool

Only skip enter_plan_mode for simple tasks:
- Single-line or few-line fixes (typos, obvious bugs, small tweaks)
- Adding a single function with clear requirements
- Tasks where the owner has given very specific, detailed instructions
- Pure research/exploration tasks

## What Happens in Plan Mode

In plan mode, you'll:
1. Thoroughly explore the codebase using glob, grep, and read
2. Understand existing patterns and architecture
3. Design an implementation approach
4. Present your plan to the owner for approval
5. Use ask_user if you need to clarify approaches
6. Exit plan mode with exit_plan_mode when ready to implement

## Examples

### GOOD - Use enter_plan_mode:
Owner: "Add user authentication to the app"
- Requires architectural decisions (session vs JWT, where to store tokens, middleware structure)

Owner: "Optimize the database queries"
- Multiple approaches possible, need to profile first, significant impact

Owner: "Implement dark mode"
- Architectural decision on theme system, affects many components

Owner: "Add a delete button to the user profile"
- Seems simple but involves: where to place it, confirmation dialog, API call, error handling, state updates

Owner: "Update the error handling in the API"
- Affects multiple files, owner should approve the approach

### BAD - Don't use enter_plan_mode:
Owner: "Fix the typo in the README"
- Straightforward, no planning needed

Owner: "Add a console.log to debug this function"
- Simple, obvious implementation

Owner: "What files handle routing?"
- Research task, not implementation planning

## Important Notes

- This tool REQUIRES owner approval - they must consent to entering plan mode
- If unsure whether to use it, err on the side of planning - it's better to get alignment upfront than to redo work
- The owner appreciates being consulted before significant changes are made to their codebase
`;
/** Its input: none (Claude Code's strict empty object, so any parameter is refused). */
export const ENTER_PLAN_TOOL = Object.freeze({ type: "function", function: { name: "enter_plan_mode", description: ENTER_PLAN_DESC, parameters: { type: "object", properties: {}, additionalProperties: false } } });
/** Its result object (Claude Code's `message`, what its PostToolUse hooks get), and what Coder is told back. */
export const ENTERED_PLAN = "Entered plan mode. You should now focus on exploring the codebase and designing an implementation approach.";
export const ENTERED_PLAN_TEXT = ENTERED_PLAN + `

In plan mode, you should:
1. Thoroughly explore the codebase to understand existing patterns
2. Identify similar features and architectural approaches
3. Consider multiple approaches and their trade-offs
4. Use ask_user if you need to clarify the approach
5. Design a concrete implementation strategy
6. When ready, use exit_plan_mode to present your plan for approval

Remember: DO NOT write or edit any files yet. This is a read-only exploration and planning phase.`;
/** What the chat shows (Claude Code's own line for it: "Entered plan mode", then "Claude is now exploring …"). */
export const ENTERED_PLAN_SHOWN = "Entered plan mode\nCoder is now exploring and designing an implementation approach.";
/** Its input check (Claude Code's schema, before any hook): `{ args }` or `{ error }` in Claude Code's words. */
export function checkEnterPlanInput(args) {
  const a = args && typeof args === "object" && !Array.isArray(args) ? args : null;
  if (!a) return { error: inputErrorText("EnterPlanMode", [typeIssue("object", args, [])]) };
  const keys = Object.keys(a);
  return keys.length ? { error: inputErrorText("EnterPlanMode", [unknownKeysIssue(keys, [])]) } : { args: {} };
}

// ── EXIT_PLAN_MODE, AS THE MODEL SEES IT ─────────────────────────────────────
/** Its description with a plan file (Claude Code's ExitPlanMode prompt in a session with a disk). */
export const EXIT_PLAN_DESC = `Use this tool when you are in plan mode and have finished writing your plan to the plan file and are ready for owner approval.

## How This Tool Works
- You should have already written your plan to the plan file specified in the plan mode system message
- This tool does NOT take the plan content as a parameter - it will read the plan from the file you wrote
- This tool simply signals that you're done planning and ready for the owner to review and approve
- The owner will see the contents of your plan file when they review it

## When to Use This Tool
IMPORTANT: Only use this tool when the task requires planning the implementation steps of a task that requires writing code. For research tasks where you're gathering information, searching files, reading files or in general trying to understand the codebase - do NOT use this tool.

## Before Using This Tool
Ensure your plan is complete and unambiguous:
- If you have unresolved questions about requirements or approach, use ask_user first (in earlier phases)
- Once your plan is finalized, use THIS tool to request approval

**Important:** Do NOT use ask_user to ask "Is this plan okay?" or "Should I proceed?" - that's exactly what THIS tool does. exit_plan_mode inherently requests owner approval of your plan.

## Examples

1. Initial task: "Search for and understand the implementation of vim mode in the codebase" - Do not use the exit plan mode tool because you are not planning the implementation steps of a task.
2. Initial task: "Help me implement yank mode for vim" - Use the exit plan mode tool after you have finished planning the implementation steps of the task.
3. Initial task: "Add a new feature to handle user authentication" - If unsure about auth method (OAuth, JWT, etc.), use ask_user first, then use exit plan mode tool after clarifying the approach.
`;
/** Its description with no plan file (Claude Code's, in a session without a disk). */
export const EXIT_PLAN_DESC_NO_FILE = `Use this tool when you are in plan mode and your plan is ready for the owner to approve.

- Pass the whole plan as \`plan\`, in Markdown. This session has no plan file, so do not write the plan to a file.
- The owner sees the plan on an approval card and approves or declines it. Do NOT ask "Is this plan okay?" or "Should I proceed?" in any other way: that is what this tool does.
- If they approve, plan mode ends and you carry out the plan as approved.
- If they decline, you stay in plan mode: find out what they want changed, revise the plan, and call this tool again.
`;
/**
 * Its input with a plan file: only Claude Code's `allowedPrompts`, which it keeps in its schema as "Deprecated: no longer
 * used" (its hooks reference: "Claude Code accepts the field but ignores it"); Coder ignores it too.
 */
export const EXIT_PLAN_TOOL = Object.freeze({ type: "function", function: { name: "exit_plan_mode", description: EXIT_PLAN_DESC, parameters: { type: "object", properties: {
  allowedPrompts: { type: "array", description: "Deprecated: no longer used.", items: { type: "object", properties: { tool: { type: "string", enum: ["Bash"], description: "The tool this prompt applies to" }, prompt: { type: "string", description: 'Semantic description of the action, e.g. "run tests", "install dependencies"' } }, required: ["tool", "prompt"] } },
} } } });
/** Its input with no plan file: the whole plan, and nothing else (Claude Code's `additionalProperties: false`). */
export const EXIT_PLAN_TOOL_NO_FILE = Object.freeze({ type: "function", function: { name: "exit_plan_mode", description: EXIT_PLAN_DESC_NO_FILE, parameters: { type: "object", properties: { plan: { type: "string", description: "The whole plan, in Markdown, as the owner will see it" } }, required: ["plan"], additionalProperties: false } } });

// ── PLAN MODE, AS THE MODEL IS TOLD OF IT ────────────────────────────────────
/** Plan mode's first lines (Claude Code's), with what may still be changed. */
const planActive = (except) => "Plan mode is active. The owner indicated that they do not want you to execute yet -- you MUST NOT make any edits" + except + ", run any non-readonly tools (including changing configs or making commits), or otherwise make any changes to the system. This supercedes any other instructions you have received.";
/** Its workflow's first three phases (Claude Code's, for a session with no subagents to send out, as Coder has none). */
const PHASES = `### Phase 1: Initial Understanding
Goal: Gain a comprehensive understanding of the owner's request by reading through code and asking them questions.

1. Focus on understanding the owner's request and the code associated with their request. Actively search for existing functions, utilities, and patterns that can be reused — avoid proposing new code when suitable implementations already exist.

2. Read and explore the relevant files directly to efficiently understand the codebase.

### Phase 2: Design
Goal: Design an implementation approach based on the owner's intent and your exploration results from Phase 1.

- Provide comprehensive background context from Phase 1 exploration including filenames and code path traces
- Describe requirements and constraints
- Produce a detailed implementation plan

### Phase 3: Review
Goal: Review the plan(s) from Phase 2 and ensure alignment with the owner's intentions.
1. Read the critical files you identified during exploration to deepen your understanding
2. Ensure that the plans align with the owner's original request
3. Use ask_user to clarify any remaining questions with the owner`;
/** What the final plan holds (Claude Code's list, for "plan file" or "plan"). */
const finalPlan = (what) => `- Begin with a **Context** section: explain why this change is being made — the problem or need it addresses, what prompted it, and the intended outcome
- Include only your recommended approach, not all alternatives
- Ensure that the ${what} is concise enough to scan quickly, but detailed enough to execute effectively
- Name the critical files to be modified. For changes that repeat a pattern across many files, describe the pattern once and list a few representative paths — do not enumerate every file or line number
- Reference existing functions and utilities you found that should be reused, with their file paths
- Include a verification section describing how to test the changes end-to-end (run the code, use MCP tools, run tests)`;
const CALL_EXIT = `At the very end of your turn, once you have asked the owner questions and are happy with your final plan file - you should always call exit_plan_mode to indicate to the owner that you are done planning.
This is critical - your turn should only end with either using the ask_user tool OR calling exit_plan_mode. Do not stop unless it's for these 2 reasons

**Important:** Use ask_user ONLY to clarify requirements or choose between approaches. Use exit_plan_mode to request plan approval. Do NOT ask about plan approval in any other way - no text questions, no ask_user. Phrases like "Is this plan okay?", "Should I proceed?", "How does this plan look?", "Any changes before we start?", or similar MUST use exit_plan_mode.`;
const ASK_ANY_TIME = "NOTE: At any point in time through this workflow you should feel free to ask the owner questions or clarifications using the ask_user tool. Don't make large assumptions about owner intent. The goal is to present a well researched plan to the owner, and tie any loose ends before implementation begins.";
/**
 * CODER'S OWN LAST LINE, kept from Coder's plan note of before (not in Claude Code's reminder, whose ExitPlanMode
 * description says it instead: "For research tasks … do NOT use this tool"). Listed for the owner to decide on.
 */
export const PLAN_QUESTION_LINE = "If the owner only asked a question, answer it in words, without a plan.";
/**
 * PLAN MODE'S NOTE, each round while it is on (Claude Code's full plan mode reminder; Coder says it in its system note
 * every round, so always whole): with a plan file, where it is and whether it is there yet; with none, Claude Code's
 * words for a session without a disk (the plan goes to exit_plan_mode, or, when that tool is denied, in the reply).
 */
export function planModeNote({ file = "", exists = false, exitOffered = true } = {}) {
  if (file) {
    return planActive(" (with the exception of the plan file mentioned below)") + "\n\n## Plan File Info:\n" +
      (exists ? "A plan file already exists at " + file + ". You can read it and make incremental edits using the edit tool." : "No plan file exists yet. You should create your plan at " + file + " using the write tool.") +
      "\nYou should build your plan incrementally by writing to or editing this file. NOTE that this is the only file you are allowed to edit - other than this you are only allowed to take READ-ONLY actions.\n\n## Plan Workflow\n\n" + PHASES +
      "\n\n### Phase 4: Final Plan\nGoal: Write your final plan to the plan file (the only file you can edit).\n" + finalPlan("plan file") +
      "\n\n### Phase 5: Call exit_plan_mode\n" + CALL_EXIT + "\n\n" + ASK_ANY_TIME + "\n\n" + PLAN_QUESTION_LINE;
  }
  return planActive("") + "\n\n## Where Your Plan Goes:\nThis session has no plan file. " + (exitOffered ? "Pass your plan to exit_plan_mode as its `plan` argument" : "Give your plan to the owner as text in your reply") + ", and do not write it to a file.\n\n## Plan Workflow\n\n" + PHASES +
    "\n\n### Phase 4: Final Plan\nGoal: " + (exitOffered ? "Settle your final plan." : "Give your final plan in your reply.") + "\n" + finalPlan("plan") +
    "\n\n### Phase 5: " + (exitOffered ? "Call exit_plan_mode\nWhen your plan is final, call exit_plan_mode with the whole plan as its `plan` argument. The owner sees it on an approval card: if they approve, plan mode ends; if they decline, you stay in plan mode and revise the plan. Your turn should only end with ask_user (to clarify requirements or choose between approaches) or exit_plan_mode (to request plan approval). Do NOT ask about plan approval in any other way."
      : "Hand Over To The Owner\nWhen your plan is final, end your turn with it. You cannot leave plan mode yourself, and the owner's approval alone does not end it: to have the plan carried out, the owner changes this session's permission mode from Plan to another mode in their app and then tells you to go ahead. Close your reply with one sentence that tells the owner to do that. If they ask for changes instead, reply with the revised plan. Stay read-only until a system reminder says that you have exited plan mode. If they tell you to go ahead before that, tell them that the session is still in plan mode and how to change it.") +
    "\n\n" + ASK_ANY_TIME + "\n\n" + PLAN_QUESTION_LINE;
}
/** The note with no plan file and exit_plan_mode offered (kept under its old name: coder-perms.mjs gives it on). */
export const PLAN_NOTE = planModeNote();
/**
 * PLAN MODE'S SHORT REMINDER BETWEEN TWO WHOLE ONES (Claude Code 2.1.325's sparse plan_mode reminder, word for word from its
 * program, with Coder's names and "the owner" for "the user"): with a plan file, where it is; with none, where the plan goes
 * (to exit_plan_mode, or, when that tool is denied, in the reply).
 */
export function planModeSparse({ file = "", exitOffered = true } = {}) {
  const head = "Plan mode still active (see full instructions earlier in conversation). ";
  if (file) return head + "Read-only except plan file (" + file + "). Follow 5-phase workflow. End turns with ask_user (for clarifications) or exit_plan_mode (for plan approval). Never ask about plan approval via text or ask_user.";
  return head + "Read-only, and there is no plan file. Follow 5-phase workflow. " + (exitOffered ? "When the plan is final, call exit_plan_mode with it as `plan`. Never ask about plan approval via text or ask_user." : "When the plan is final, give it in your reply. Only the owner can end plan mode, by changing the session's permission mode.");
}
/** Claude Code's TURNS_BETWEEN_ATTACHMENTS: plan mode's reminder at most once every this many of the owner's messages. */
export const PLAN_REMINDER_TURNS = 5;
/** Its FULL_REMINDER_EVERY_N_ATTACHMENTS: the whole reminder the first time and every this many times after; the short one between. */
export const PLAN_FULL_EVERY = 5;
/** Where a plan goes, for the reminder: "file" (the plan file), "exit" (exit_plan_mode's `plan`) or "reply" (that tool denied). */
export const planKind = ({ file = "", exitOffered = true } = {}) => (file ? "file" : exitOffered ? "exit" : "reply");
/**
 * WHETHER PLAN MODE'S REMINDER IS DUE BEFORE THIS STEP, AND WHICH ONE (fix round 3, 2026-11-14; Claude Code 2.1.325's
 * plan_mode attachment, looked at before each of its model calls): since plan mode was last left (an app note with "## Exited
 * Plan Mode"), none while fewer than PLAN_REMINDER_TURNS messages of the owner's came after the last reminder; then "full"
 * the first time and every PLAN_FULL_EVERY-th time, "sparse" between; "full" too when where the plan goes changed since the
 * last one (its kind). Reminders carry `planReminder` (their kind). `skipFrom`: the owner's messages from there on are not
 * counted yet (a job's first step: Claude Code decides before it adds the message that starts the turn); `owners(m)`: whether
 * a message is one of the owner's (not a note of Coder's app, a summary, or a message sent while Coder worked). null when none
 * is due.
 */
export function planReminderDue(messages, { kind = "file", skipFrom = Infinity, owners = (m) => m.role === "user" && m.appNote !== true } = {}) {
  const list = Array.isArray(messages) ? messages : [];
  let owner = 0, since = 0, last = null;
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i];
    if (!m || m.role !== "user") continue;
    if (m.planReminder) { since++; if (!last) last = m; continue; }
    if (m.appNote === true && typeof m.content === "string" && m.content.includes("## Exited Plan Mode")) break;
    if (!last && i < skipFrom && owners(m)) owner++;
  }
  const changed = !!last && last.planReminder !== kind;
  if (last && !changed && owner < PLAN_REMINDER_TURNS) return null;
  return changed || (since + 1) % PLAN_FULL_EVERY === 1 ? "full" : "sparse";
}
// ── THE OTHER NOTES OF THE MODES, FROM THE CONVERSATION (fix round 3, 2026-11-14) ──
// Claude Code tells its model of a mode only in the conversation, never in its system prompt ("so the cached prefix stays
// intact"), and decides each of these notes from the conversation before each model call: its plan_mode_exit (out of plan
// mode, a reminder not yet followed by "## Exited Plan Mode"), its auto_mode (in auto mode, once, until "## Exited Auto
// Mode") and its auto_mode_exit. Coder's notes carry what they are: `planReminder`, `modeNote` ("auto", "acceptEdits").
const said = (m, t) => typeof m.content === "string" && m.content.includes(t);
/** Of a mode's note and its end, which came last in the conversation: "note", "end" or null. */
function lastMark(messages, isNote, isEnd) {
  const list = Array.isArray(messages) ? messages : [];
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i];
    if (!m || m.role !== "user" || m.appNote !== true) continue;
    if (isNote(m)) return "note";
    if (isEnd(m)) return "end";
  }
  return null;
}
const planMarks = (messages) => lastMark(messages, (m) => !!m.planReminder, (m) => said(m, "## Exited Plan Mode"));
const autoMarks = (messages) => lastMark(messages, (m) => m.modeNote === "auto", (m) => said(m, "## Exited Auto Mode"));
/** Plan mode's end is owed (out of plan mode): its last reminder is not yet followed by "## Exited Plan Mode". */
export const planExitOwed = (messages) => planMarks(messages) === "note";
/** Auto mode's note is owed (in auto mode): none since auto mode was last left. */
export const autoNoteOwed = (messages) => autoMarks(messages) !== "note";
/** Auto mode's end is owed (out of auto mode): its note is not yet followed by "## Exited Auto Mode". */
export const autoExitOwed = (messages) => autoMarks(messages) === "note";
/**
 * Coder's own Accept edits note is owed (Claude Code has none for that mode; Coder's words for it, given once in the mode
 * since fix round 3 instead of in the system message): the conversation's last note of a mode, or of a mode's change or end,
 * is not this same note.
 */
export function editsNoteOwed(messages, content) {
  const list = Array.isArray(messages) ? messages : [];
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i];
    if (!m || m.role !== "user" || m.appNote !== true) continue;
    if (m.modeNote || m.planReminder || said(m, "## Exited ") || said(m, "The owner's permission mode is now")) return !(m.modeNote === "acceptEdits" && m.content === content);
  }
  return true;
}
/** Leaving plan mode (Claude Code's "## Exited Plan Mode"), and where the plan file is, when there is one. */
export const PLAN_EXITED = "## Exited Plan Mode\n\nYou have exited plan mode. You can now make edits, run tools, and take actions.";
export const planExitedNote = (file = "", exists = false) => PLAN_EXITED + (file && exists ? " The plan file is located at " + file + " if you need to reference it." : "");
/** Plan mode again after an approved plan, its file still there (Claude Code's "## Re-entering Plan Mode"). */
export const planReentryNote = (file) => `## Re-entering Plan Mode

You are returning to plan mode after having previously exited it. A plan file exists at ${file} from your previous planning session.

**Before proceeding with any new planning, you should:**
1. Read the existing plan file to understand what was previously planned
2. Evaluate the owner's current request against that plan
3. Decide how to proceed:
   - **Different task**: If the owner's request is for a different task—even if it's similar or related—start fresh by overwriting the existing plan
   - **Same task, continuing**: If this is explicitly a continuation or refinement of the exact same task, modify the existing plan while cleaning up outdated or irrelevant sections
4. Continue on with the plan process and most importantly you should always edit the plan file one way or the other before calling exit_plan_mode

Treat this as a fresh planning session. Do not assume the existing plan is relevant without evaluating it first.`;
/**
 * THE PLAN AFTER A SUMMARY (Claude Code's plan_file_reference, among what it puts back after compaction whenever the
 * session's plan file is there, in any mode): where it is and what it says.
 */
export const planFileReference = (file, text) => (file ? "A plan file exists from plan mode at: " + file : "A plan exists from plan mode.") + "\n\nPlan contents:\n\n" + String(text) + "\n\nIf this plan is relevant to the current work and not already complete, continue working on it.";

// ── WHAT THE MODEL IS TOLD BACK ──────────────────────────────────────────────
/**
 * THE ANSWER TO AN APPROVED PLAN (Claude Code's ExitPlanMode result): the plan echoed; with a plan file, where it is kept;
 * edited by the owner (or a hook), said so, and when the edit could not be saved to the plan file, that too.
 */
export function planApproved(plan, { file = "", edited = false, unsaved = false } = {}) {
  const p = String(plan || "");
  if (!p.trim()) return "The owner has approved exiting plan mode. You can now proceed.";
  return "The owner has approved your plan. You can now start coding. Start with updating your todo list if applicable" +
    (file ? "\n\nYour plan has been saved to: " + file + "\nYou can refer back to it if needed during implementation." : edited && unsaved ? "\n\nThe edit could not be saved to the plan file, so work from the text below." : "") +
    "\n\n## " + (edited ? "Approved Plan (edited by the owner)" : "Approved Plan") + ":\n" + p;
}
/**
 * ITS REFUSALS BEFORE ANY HOOK OR CARD (Claude Code's checks; "error: " as Coder's failed calls start). Out of plan mode:
 * Claude Code's words, enter_plan_mode for its EnterPlanMode (Coder has it since 2026-11-14).
 */
export const NOT_IN_PLAN_MODE = "error: You are not in plan mode. To enter plan mode, call the enter_plan_mode tool first. If your plan was already approved, continue with implementation.";
export const PLAN_ARG_NEEDED = "error: Pass the whole plan as non-empty text in the `plan` argument, and pass no other argument. This session has no plan file to read it from.";
/** The most a plan given as `plan` may take, as JSON (Claude Code: what "the user's approval card can carry"). */
export const PLAN_CARD_BYTES = 32768;
export const planTooBig = (bytes) => "error: The plan is " + bytes + " bytes as JSON, over the " + PLAN_CARD_BYTES + " that the owner's approval card can carry. A quote, backslash or line break counts as two bytes, and a non-ASCII character as two to four. Shorten the plan and call this tool again.";
/**
 * A PLAN TOO LONG TO SHOW (Claude Code's approval prompt: past 200,000 characters "the plan is too large to be shown in full
 * — approval is withheld; send feedback asking for a shorter plan, or press Esc"; the card has no Esc, so that part goes).
 */
export const PLAN_SHOW_MAX = 200_000;
export const PLAN_WITHHELD = "(the plan is too large to be shown in full — approval is withheld; send feedback asking for a shorter plan)";

// ── ITS INPUT ────────────────────────────────────────────────────────────────
/**
 * ITS INPUT AS CLAUDE CODE TAKES IT (its normalizeToolInput): with a plan file, any `plan` or `planFilePath` the model gave
 * is dropped and the file's own put in (none while there is no file: Claude Code's "No plan found"); with none, as given.
 * `text`: the plan file's text, or null.
 */
export function planInput(args, { file = "", text = null } = {}) {
  const a = args && typeof args === "object" && !Array.isArray(args) ? args : {};
  if (!file) return { ...a };
  const out = {};
  for (const [k, v] of Object.entries(a)) if (k !== "plan" && k !== "planFilePath") out[k] = v;
  return typeof text === "string" ? { ...out, plan: text, planFilePath: file } : out;
}
/**
 * ITS SCHEMA (Claude Code's, which takes keys it does not know): `allowedPrompts`, when given, a list of { tool: "Bash",
 * prompt }; zod 4.6.2's issues, in its order.
 */
export function exitPlanIssues(args) {
  const a = args && typeof args === "object" && !Array.isArray(args) ? args : null;
  if (!a) return [typeIssue("object", args, [])];
  const v = a.allowedPrompts;
  if (v === undefined) return [];
  if (!Array.isArray(v)) return [typeIssue("array", v, ["allowedPrompts"])];
  const out = [];
  v.forEach((x, i) => {
    const at = ["allowedPrompts", i];
    if (!x || typeof x !== "object" || Array.isArray(x)) { out.push(typeIssue("object", x, at)); return; }
    if (x.tool !== "Bash") out.push(valueIssue(["Bash"], [...at, "tool"]));
    if (typeof x.prompt !== "string") out.push(typeIssue("string", x.prompt, [...at, "prompt"]));
  });
  return out;
}
/**
 * ITS CHECK (Claude Code's schema, then its validateInput): { error } or { args }. `noFile`: a run with no plan file. A
 * schema refusal is Claude Code's InputValidationError (its w0, coder-zodtext.mjs).
 */
export function checkPlanInput(args, { mode = "", noFile = false } = {}) {
  const issues = exitPlanIssues(args);
  if (issues.length) return { error: inputErrorText("ExitPlanMode", issues) };
  if (mode !== "plan") return { error: NOT_IN_PLAN_MODE };
  if (noFile) {
    const p = args && typeof args === "object" ? args.plan : undefined;
    if (typeof p !== "string" || !p.trim() || Object.keys(args).length > 1) return { error: PLAN_ARG_NEEDED };
    const bytes = Buffer.byteLength(JSON.stringify(args));
    if (bytes > PLAN_CARD_BYTES) return { error: planTooBig(bytes) };
  }
  return { args };
}

// ── THE PLAN FILE ON CODER'S MACHINE ─────────────────────────────────────────
/**
 * ITS NAME (Claude Code 2.1.111: "Plan files are now named after your prompt (e.g. fix-auth-race-snug-otter.md) instead
 * of purely random words"): the first four words of the owner's message, as one lower-case word with dashes (at most 40
 * characters), then an adjective and a noun from Claude Code's own lists; with no words, an adjective, a verb and a noun.
 */
export function planSlug(seed, rand = Math.random) {
  const pick = (list) => list[Math.min(list.length - 1, Math.floor(Math.max(0, rand()) * list.length))];
  const words = String(seed || "").split(/\s+/).filter(Boolean).slice(0, 4).join(" ").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40).replace(/^-+|-+$/g, "");
  return words ? words + "-" + pick(ADJECTIVES) + "-" + pick(NOUNS) : pick(ADJECTIVES) + "-" + pick(VERBS) + "-" + pick(NOUNS);
}
/** A name Coder made (Claude Code's own check on a plan file's name: lower-case words and dashes, at most 100 characters). */
export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** The most of a plan file read (past PLAN_SHOW_MAX characters its card withholds approval anyway). */
export const PLAN_READ_MAX = 1024 * 1024;
// ── CLAUDE CODE'S WORDS FOR PLAN FILE NAMES (its own lists, as 2.1.325 has them) ──
const ADJECTIVES = Object.freeze([
  "abundant", "ancient", "bright", "calm", "cheerful", "clever", "cozy", "curious", "dapper", "dazzling", "deep",
  "delightful", "eager", "elegant", "enchanted", "fancy", "fluffy", "gentle", "gleaming", "golden", "graceful",
  "happy", "hidden", "humble", "jolly", "joyful", "keen", "kind", "lively", "lovely", "lucky", "luminous", "magical",
  "majestic", "mellow", "merry", "mighty", "misty", "noble", "peaceful", "playful", "polished", "precious", "proud",
  "quiet", "quirky", "radiant", "rosy", "serene", "shiny", "silly", "sleepy", "smooth", "snazzy", "snug", "snuggly",
  "soft", "sparkling", "spicy", "splendid", "sprightly", "starry", "steady", "sunny", "swift", "tender", "tidy",
  "toasty", "tranquil", "twinkly", "valiant", "vast", "velvet", "vivid", "warm", "whimsical", "wild", "wise",
  "witty", "wondrous", "zany", "zesty", "zippy", "breezy", "bubbly", "buzzing", "cheeky", "cosmic", "cozy", "crispy",
  "crystalline", "cuddly", "drifting", "dreamy", "effervescent", "ethereal", "fizzy", "flickering", "floating",
  "floofy", "fluttering", "foamy", "frolicking", "fuzzy", "giggly", "glimmering", "glistening", "glittery",
  "glowing", "goofy", "groovy", "harmonic", "hazy", "humming", "iridescent", "jaunty", "jazzy", "jiggly", "melodic",
  "moonlit", "mossy", "nifty", "peppy", "prancy", "purrfect", "purring", "quizzical", "rippling", "rustling",
  "shimmering", "shimmying", "snappy", "snoopy", "squishy", "swirling", "ticklish", "tingly", "twinkling", "velvety",
  "wiggly", "wobbly", "woolly", "zazzy", "abstract", "adaptive", "agile", "async", "atomic", "binary", "cached",
  "compiled", "composed", "compressed", "concurrent", "cryptic", "curried", "declarative", "delegated",
  "distributed", "dynamic", "eager", "elegant", "encapsulated", "enumerated", "eventual", "expressive", "federated",
  "functional", "generic", "greedy", "hashed", "idempotent", "immutable", "imperative", "indexed", "inherited",
  "iterative", "lazy", "lexical", "linear", "linked", "logical", "memoized", "modular", "mutable", "nested",
  "optimized", "parallel", "parsed", "partitioned", "piped", "polymorphic", "pure", "reactive", "recursive",
  "refactored", "reflective", "replicated", "resilient", "robust", "scalable", "sequential", "serialized", "sharded",
  "sorted", "staged", "stateful", "stateless", "streamed", "structured", "synchronous", "synthetic", "temporal",
  "transient", "typed", "unified", "validated", "vectorized", "virtual"
]);
const VERBS = Object.freeze([
  "baking", "beaming", "booping", "bouncing", "brewing", "bubbling", "chasing", "churning", "coalescing",
  "conjuring", "cooking", "crafting", "crunching", "cuddling", "dancing", "dazzling", "discovering", "doodling",
  "dreaming", "drifting", "enchanting", "exploring", "finding", "floating", "fluttering", "foraging", "forging",
  "frolicking", "gathering", "giggling", "gliding", "greeting", "growing", "hatching", "herding", "honking",
  "hopping", "hugging", "humming", "imagining", "inventing", "jingling", "juggling", "jumping", "kindling",
  "knitting", "launching", "leaping", "mapping", "marinating", "meandering", "mixing", "moseying", "munching",
  "napping", "nibbling", "noodling", "orbiting", "painting", "percolating", "petting", "plotting", "pondering",
  "popping", "prancing", "purring", "puzzling", "questing", "riding", "roaming", "rolling", "sauteeing",
  "scribbling", "seeking", "shimmying", "singing", "skipping", "sleeping", "snacking", "sniffing", "snuggling",
  "soaring", "sparking", "spinning", "splashing", "sprouting", "squishing", "stargazing", "stirring", "strolling",
  "swimming", "swinging", "tickling", "tinkering", "toasting", "tumbling", "twirling", "waddling", "wandering",
  "watching", "weaving", "whistling", "wibbling", "wiggling", "wishing", "wobbling", "wondering", "yawning",
  "zooming"
]);
const NOUNS = Object.freeze([
  "aurora", "avalanche", "blossom", "breeze", "brook", "bubble", "canyon", "cascade", "cloud", "clover", "comet",
  "coral", "cosmos", "creek", "crescent", "crystal", "dawn", "dewdrop", "dusk", "eclipse", "ember", "feather",
  "fern", "firefly", "flame", "flurry", "fog", "forest", "frost", "galaxy", "garden", "glacier", "glade", "grove",
  "harbor", "horizon", "island", "lagoon", "lake", "leaf", "lightning", "meadow", "meteor", "mist", "moon",
  "moonbeam", "mountain", "nebula", "nova", "ocean", "orbit", "pebble", "petal", "pine", "planet", "pond", "puddle",
  "quasar", "rain", "rainbow", "reef", "ripple", "river", "shore", "sky", "snowflake", "spark", "spring", "star",
  "stardust", "starlight", "storm", "stream", "summit", "sun", "sunbeam", "sunrise", "sunset", "thunder", "tide",
  "twilight", "valley", "volcano", "waterfall", "wave", "willow", "wind", "alpaca", "axolotl", "badger", "bear",
  "beaver", "bee", "bird", "bumblebee", "bunny", "cat", "chipmunk", "crab", "crane", "deer", "dolphin", "dove",
  "dragon", "dragonfly", "duckling", "eagle", "elephant", "falcon", "finch", "flamingo", "fox", "frog", "giraffe",
  "goose", "hamster", "hare", "heron", "hippo", "hummingbird", "jellyfish", "kitten", "koala", "ladybug", "lark",
  "lemur", "llama", "lobster", "lynx", "magpie", "meerkat", "moth", "nautilus", "newt", "octopus", "otter", "owl",
  "panda", "parrot", "peacock", "pelican", "penguin", "phoenix", "piglet", "platypus", "pony", "possum", "puffin",
  "puppy", "quail", "quokka", "rabbit", "raccoon", "raven", "robin", "salamander", "seahorse", "seal", "sloth",
  "snail", "sparrow", "sphinx", "squid", "squirrel", "starfish", "swan", "tiger", "toucan", "turtle", "unicorn",
  "walrus", "whale", "wolf", "wombat", "wren", "yeti", "zebra", "acorn", "anchor", "balloon", "beacon", "biscuit",
  "blanket", "bonbon", "book", "boot", "cake", "candle", "candy", "castle", "charm", "clock", "cocoa", "cookie",
  "crayon", "crown", "cupcake", "donut", "dream", "fairy", "fiddle", "flask", "flute", "fountain", "gadget", "gem",
  "gizmo", "globe", "goblet", "hammock", "harp", "haven", "hearth", "honey", "journal", "kazoo", "kettle", "key",
  "kite", "lantern", "lemon", "lighthouse", "locket", "lollipop", "mango", "map", "marble", "marshmallow", "melody",
  "mitten", "mochi", "muffin", "music", "nest", "noodle", "oasis", "origami", "pancake", "parasol", "peach", "pearl",
  "pebble", "pie", "pillow", "pinwheel", "pixel", "pizza", "plum", "popcorn", "pretzel", "prism", "pudding",
  "pumpkin", "puzzle", "quiche", "quill", "quilt", "riddle", "rocket", "rose", "scone", "scroll", "shell", "sketch",
  "snowglobe", "sonnet", "sparkle", "spindle", "sprout", "sundae", "swing", "taco", "teacup", "teapot", "thimble",
  "toast", "token", "tome", "tower", "treasure", "treehouse", "trinket", "truffle", "tulip", "umbrella", "waffle",
  "wand", "whisper", "whistle", "widget", "wreath", "zephyr", "abelson", "adleman", "aho", "allen", "babbage",
  "bachman", "backus", "barto", "bengio", "bentley", "blum", "boole", "brooks", "catmull", "cerf", "cherny",
  "church", "clarke", "cocke", "codd", "conway", "cook", "corbato", "cray", "curry", "dahl", "diffie", "dijkstra",
  "dongarra", "eich", "emerson", "engelbart", "feigenbaum", "floyd", "gosling", "graham", "gray", "hamming",
  "hanrahan", "hartmanis", "hejlsberg", "hellman", "hennessy", "hickey", "hinton", "hoare", "hollerith", "hopcroft",
  "hopper", "iverson", "kahan", "kahn", "karp", "kay", "kernighan", "knuth", "kurzweil", "lamport", "lampson",
  "lecun", "lerdorf", "liskov", "lovelace", "matsumoto", "mccarthy", "metcalfe", "micali", "milner", "minsky",
  "moler", "moore", "naur", "neumann", "newell", "nygaard", "papert", "parnas", "pascal", "patterson", "pearl",
  "perlis", "pike", "pnueli", "rabin", "reddy", "ritchie", "rivest", "rossum", "russell", "scott", "sedgewick",
  "shamir", "shannon", "sifakis", "simon", "stallman", "stearns", "steele", "stonebraker", "stroustrup",
  "sutherland", "sutton", "tarjan", "thacker", "thompson", "torvalds", "turing", "ullman", "valiant", "wadler",
  "wall", "wigderson", "wilkes", "wilkinson", "wirth", "wozniak", "yao"
]);
