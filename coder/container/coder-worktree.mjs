// CLAUDE CODE'S EnterWorktree, ExitWorktree, EndConversation, SendFeedback AND ReportFindings, AS CODER'S enter_worktree,
// exit_worktree, end_conversation, send_feedback AND report_findings (2026-11-23).
//
// From Claude Code's docs (tools-reference.md: "EnterWorktree tool behavior", "EndConversation tool behavior", "SendFeedback
// tool behavior", the table rows for ExitWorktree and ReportFindings; worktrees.md; the Agent SDK's TypeScript reference for
// each tool's input and output). Coder's differences, said plainly:
//   - Worktrees live on the chat's machine, under the repository's .claude/worktrees/ (Claude Code's own place), on a branch
//     named worktree-<name>. The chat's commands then start there, as after a cd.
//   - ExitWorktree with action "remove" refuses work at risk (uncommitted files, commits not pushed or not on the original
//     branch) unless discard_changes is true, and then asks the owner on a card first (Claude Code 2.1.327 asks too).
//   - SendFeedback: Coder has no Anthropic feedback service. The draft is a card for the owner, kept with the chat, with Copy;
//     nothing is sent anywhere by itself.
//   - EndConversation ends the chat's job; the chat then takes no new messages (Claude Code locks the session the same way).
//   - ReportFindings: the findings as a list card in the chat; Coder's /code-review uses it.
// No Node module here, so the page's tests and the Worker can read the same words.

/** Coder's names and Claude Code's (hooks, rules and permission texts use Claude Code's). */
export const CC_NAMES = Object.freeze({ enter_worktree: "EnterWorktree", exit_worktree: "ExitWorktree", end_conversation: "EndConversation", send_feedback: "SendFeedback", report_findings: "ReportFindings" });

/** Where the worktrees go, inside the repository (Claude Code's). */
export const WORKTREE_DIR = ".claude/worktrees";
/** What a chat that ended answers to a new message (Claude Code's words, with "chat" for its session commands). */
export const ENDED_TEXT = "Coder ended this conversation. Start a new chat to continue.";
/** At most this many feedback drafts a job (Claude Code shows at most three cards a session). */
export const FEEDBACK_MAX = 3;
/** At most this many findings a call (Claude Code's). */
export const FINDINGS_MAX = 32;
export const LEVELS = Object.freeze(["low", "medium", "high", "xhigh", "max"]);
export const VERDICTS = Object.freeze(["CONFIRMED", "PLAUSIBLE"]);
export const OUTCOMES = Object.freeze(["fixed", "skipped", "no_change_needed"]);

// ── WHAT CODER IS TOLD ─────────────────────────────────────────────────────────────────────────────────────────────────
export const ENTER_WORKTREE_DESCRIPTION = "Creates and enters a temporary git worktree for isolated work, so you can change files without touching the chat's main checkout. Use it ONLY when the owner asks to work in a worktree (\"start a worktree\", \"do this in a worktree\"). The new worktree is made under " + WORKTREE_DIR + "/<name> of the repository, on a new branch worktree-<name> from the current HEAD, and your commands then start there. Pass `path` instead to switch into an existing worktree of this repository (one `git worktree list` shows); a path outside " + WORKTREE_DIR + "/ asks the owner first. `name` and `path` are mutually exclusive. From inside a worktree, only `path` works, and it must be under " + WORKTREE_DIR + "/. Leave with exit_worktree.";
export const ENTER_WORKTREE_PARAMS = Object.freeze({ type: "object", properties: {
  name: { type: "string", description: "Optional name for the new worktree: letters, digits, dots, underscores and dashes, with / between parts, at most 64 characters. A random name when left out." },
  path: { type: "string", description: "Path of an existing worktree of this repository to switch into, instead of creating one." },
}, required: [], additionalProperties: false });

export const EXIT_WORKTREE_DESCRIPTION = "Exits the worktree session that enter_worktree started and returns your commands to the original working directory (the repository's main checkout). action \"keep\" leaves the worktree and its branch on disk; \"remove\" deletes both. Removing a worktree that has uncommitted files or commits that are not pushed or not on the original branch is refused unless discard_changes is true; confirm with the owner first, then call again with discard_changes: true (the owner is also asked on a card), or use action \"keep\" to preserve the work. Only for a worktree under " + WORKTREE_DIR + "/; with none active it does nothing.";
export const EXIT_WORKTREE_PARAMS = Object.freeze({ type: "object", properties: {
  action: { type: "string", enum: ["keep", "remove"], description: "\"keep\" leaves the worktree and branch on disk; \"remove\" deletes both." },
  discard_changes: { type: "boolean", description: "Must be true to remove a worktree with uncommitted files or unmerged commits." },
}, required: ["action"], additionalProperties: false });

export const END_CONVERSATION_DESCRIPTION = "Ends this conversation: the chat's job stops and the chat takes no new messages (the owner starts a new chat to continue; its history is kept). Use it ONLY in two situations: (1) the owner keeps sending abusive messages after you gave a clear warning and failed to redirect the conversation; (2) the owner explicitly asks you to end the conversation, and then confirms when you ask whether they still want to proceed. General frustration, profanity, or a task going badly don't qualify, and neither do requests for harmful content, which you decline instead of ending the conversation.";
export const END_CONVERSATION_PARAMS = Object.freeze({ type: "object", properties: {
  reason: { type: "string", enum: ["abuse", "owner_request"], description: "Why: sustained abuse after a warning, or the owner asked and confirmed." },
}, required: ["reason"], additionalProperties: false });

export const SEND_FEEDBACK_DESCRIPTION = "Drafts a feedback report about Coder for the owner to review. Nothing is sent anywhere: the draft shows as a card in the chat, kept with it, and the owner can copy it and send it on if they want. Draft one when a tool or command keeps failing, when you can't help with something the owner asked for, when the owner points out a mistake you made or you notice one, or when the owner asks you to file feedback. title: one short line. area: what it is about (a tool's name, \"commands\", \"the page\"…). details: what happened, what was expected, and the steps, plainly; no secrets or keys. At most " + FEEDBACK_MAX + " drafts a job.";
export const SEND_FEEDBACK_PARAMS = Object.freeze({ type: "object", properties: {
  title: { type: "string", description: "One short line naming the problem." },
  area: { type: "string", description: "What it is about, e.g. a tool's name." },
  details: { type: "string", description: "What happened, what was expected, and how to make it happen again." },
}, required: ["title", "details"], additionalProperties: false });

export const REPORT_FINDINGS_DESCRIPTION = "Reports code-review findings as a structured list, so the owner sees them as a list card instead of text. Call it when code-review instructions tell you to (the owner's /code-review or /review), once, after you have checked each finding. Order findings most severe first, at most " + FINDINGS_MAX + "; pass an empty array when none survived. Each finding: file (repo-relative path), line (optional, 1-indexed), summary (one sentence stating the defect), failure_scenario (the concrete inputs and state that lead to the wrong output or crash), and optionally short_summary (at most 60 characters), category (a short kebab-case slug such as correctness or test-coverage), severity (high, medium or low), verdict (CONFIRMED or PLAUSIBLE, when a verify pass ran) and outcome (fixed, skipped or no_change_needed, only when re-reporting after applying fixes). level: optional, the effort level of the review. After it, answer in a sentence or two; don't repeat the list.";
export const REPORT_FINDINGS_PARAMS = Object.freeze({ type: "object", properties: {
  level: { type: "string", enum: LEVELS.slice() },
  findings: { type: "array", maxItems: FINDINGS_MAX, items: { type: "object", properties: {
    file: { type: "string" }, line: { type: "integer", minimum: 1 }, summary: { type: "string" }, failure_scenario: { type: "string" },
    short_summary: { type: "string", maxLength: 60 }, category: { type: "string" }, severity: { type: "string", enum: ["high", "medium", "low"] },
    verdict: { type: "string", enum: VERDICTS.slice() }, outcome: { type: "string", enum: OUTCOMES.slice() },
  }, required: ["file", "summary", "failure_scenario"], additionalProperties: false } },
}, required: ["findings"], additionalProperties: false });

const fn = (name, description, parameters) => Object.freeze({ type: "function", function: { name, description, parameters } });
export const ENTER_WORKTREE_TOOL = fn("enter_worktree", ENTER_WORKTREE_DESCRIPTION, ENTER_WORKTREE_PARAMS);
export const EXIT_WORKTREE_TOOL = fn("exit_worktree", EXIT_WORKTREE_DESCRIPTION, EXIT_WORKTREE_PARAMS);
export const END_CONVERSATION_TOOL = fn("end_conversation", END_CONVERSATION_DESCRIPTION, END_CONVERSATION_PARAMS);
export const SEND_FEEDBACK_TOOL = fn("send_feedback", SEND_FEEDBACK_DESCRIPTION, SEND_FEEDBACK_PARAMS);
export const REPORT_FINDINGS_TOOL = fn("report_findings", REPORT_FINDINGS_DESCRIPTION, REPORT_FINDINGS_PARAMS);
export const CC_TOOLS = Object.freeze([REPORT_FINDINGS_TOOL, ENTER_WORKTREE_TOOL, EXIT_WORKTREE_TOOL, SEND_FEEDBACK_TOOL, END_CONVERSATION_TOOL]);

// ── INPUT CHECKS (before any hook, as Claude Code's validation) ────────────────────────────────────────────────────────
const str = (v) => (typeof v === "string" ? v : "");
const oneLine = (v, n) => str(v).replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
const unknownKeys = (args, keys) => Object.keys(args || {}).filter((k) => !keys.includes(k));

/** A worktree name as Claude Code takes it: segments of [A-Za-z0-9._-], joined by /, at most 64 characters, no . or .. part. */
export function worktreeNameOk(name) {
  const n = String(name || "");
  if (!n || n.length > 64) return false;
  return n.split("/").every((s) => /^[A-Za-z0-9._-]+$/.test(s) && s !== "." && s !== "..");
}
/** A random name for a new worktree. */
export const randomWorktreeName = (rand = Math.random) => "wt-" + Math.floor(rand() * 0xffffff).toString(16).padStart(6, "0");

export function checkEnterWorktree(args) {
  const a = args && typeof args === "object" ? args : {};
  const extra = unknownKeys(a, ["name", "path"]);
  if (extra.length) return { error: "error: unknown parameter " + extra.map((k) => "`" + k + "`").join(", ") };
  if (a.name !== undefined && typeof a.name !== "string") return { error: "error: name must be a string" };
  if (a.path !== undefined && typeof a.path !== "string") return { error: "error: path must be a string" };
  if (str(a.name).trim() && str(a.path).trim()) return { error: "error: name and path are mutually exclusive" };
  if (str(a.name).trim() && !worktreeNameOk(a.name.trim())) return { error: "error: Invalid worktree name: use letters, digits, dots, underscores and dashes, with / between parts, at most 64 characters" };
  return { args: { ...(str(a.name).trim() ? { name: a.name.trim() } : {}), ...(str(a.path).trim() ? { path: a.path.trim() } : {}) } };
}
export function checkExitWorktree(args) {
  const a = args && typeof args === "object" ? args : {};
  const extra = unknownKeys(a, ["action", "discard_changes"]);
  if (extra.length) return { error: "error: unknown parameter " + extra.map((k) => "`" + k + "`").join(", ") };
  if (a.action !== "keep" && a.action !== "remove") return { error: "error: action must be \"keep\" or \"remove\"" };
  if (a.discard_changes !== undefined && typeof a.discard_changes !== "boolean") return { error: "error: discard_changes must be true or false" };
  return { args: { action: a.action, ...(a.discard_changes === true ? { discard_changes: true } : {}) } };
}
export function checkEndConversation(args) {
  const a = args && typeof args === "object" ? args : {};
  if (a.reason !== "abuse" && a.reason !== "owner_request") return { error: "error: reason must be \"abuse\" or \"owner_request\"" };
  return { args: { reason: a.reason } };
}
export function checkSendFeedback(args) {
  const a = args && typeof args === "object" ? args : {};
  const title = oneLine(a.title, 200), details = str(a.details).replace(/\r\n?/g, "\n").trim().slice(0, 8000), area = oneLine(a.area, 80);
  if (!title) return { error: "error: give a title" };
  if (!details) return { error: "error: give the details" };
  return { args: { title, details, ...(area ? { area } : {}) } };
}
/** One finding as the card and Coder's answer take it, or a string saying what is wrong with it. */
export function cleanFinding(f, i = 0) {
  if (!f || typeof f !== "object" || Array.isArray(f)) return "finding " + (i + 1) + " is not an object";
  const file = oneLine(f.file, 500).replace(/^\.\//, ""), summary = oneLine(f.summary, 1000), scenario = str(f.failure_scenario).replace(/\s+/g, " ").trim().slice(0, 3000);
  if (!file) return "finding " + (i + 1) + " needs file";
  if (!summary) return "finding " + (i + 1) + " needs summary";
  if (!scenario) return "finding " + (i + 1) + " needs failure_scenario";
  const line = Number(f.line);
  const out = { file, summary, failure_scenario: scenario };
  if (f.line !== undefined && f.line !== null) { if (!Number.isInteger(line) || line < 1) return "finding " + (i + 1) + ": line must be a whole number from 1"; out.line = line; }
  const short = oneLine(f.short_summary, 200); if (short) out.short_summary = short.slice(0, 60);
  const cat = oneLine(f.category, 60).toLowerCase(); if (cat) { if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cat)) return "finding " + (i + 1) + ": category must be a short kebab-case slug"; out.category = cat; }
  if (f.severity !== undefined) { if (!["high", "medium", "low"].includes(f.severity)) return "finding " + (i + 1) + ": severity must be high, medium or low"; out.severity = f.severity; }
  if (f.verdict !== undefined) { if (!VERDICTS.includes(f.verdict)) return "finding " + (i + 1) + ": verdict must be CONFIRMED or PLAUSIBLE"; out.verdict = f.verdict; }
  if (f.outcome !== undefined) { if (!OUTCOMES.includes(f.outcome)) return "finding " + (i + 1) + ": outcome must be fixed, skipped or no_change_needed"; out.outcome = f.outcome; }
  return out;
}
export function checkReportFindings(args) {
  const a = args && typeof args === "object" ? args : {};
  if (!Array.isArray(a.findings)) return { error: "error: findings must be an array (empty when none survived)" };
  if (a.findings.length > FINDINGS_MAX) return { error: "error: at most " + FINDINGS_MAX + " findings a call" };
  if (a.level !== undefined && !LEVELS.includes(a.level)) return { error: "error: level must be one of " + LEVELS.join(", ") };
  const findings = [];
  for (let i = 0; i < a.findings.length; i++) { const f = cleanFinding(a.findings[i], i); if (typeof f === "string") return { error: "error: " + f }; findings.push(f); }
  return { args: { findings, ...(a.level ? { level: a.level } : {}) } };
}
export const CC_INPUT_CHECKS = Object.freeze({ enter_worktree: checkEnterWorktree, exit_worktree: checkExitWorktree, end_conversation: checkEndConversation, send_feedback: checkSendFeedback, report_findings: checkReportFindings });

// ── WHAT THE TOOLS ANSWER ──────────────────────────────────────────────────────────────────────────────────────────────
/** report_findings' answer to Coder (Claude Code's output carries the count and the findings back). */
export function findingsResult(args) {
  const n = args.findings.length;
  return n ? "Reported " + n + " finding" + (n === 1 ? "" : "s") + " to the owner as a list card. Don't repeat the list in your answer." : "Reported no findings to the owner. Say so in a sentence.";
}
/** The findings as plain text (the card's Copy, and the hooks' tool_response). */
export function findingsText(findings) {
  return findings.map((f, i) => (i + 1) + ". " + f.file + (f.line ? ":" + f.line : "") + (f.category ? " [" + f.category + "]" : "") + (f.severity ? " (" + f.severity + ")" : "") + " — " + f.summary + "\n   " + f.failure_scenario).join("\n");
}
/** send_feedback's answer to Coder. */
export const FEEDBACK_QUEUED = "Draft saved for the owner's review as a card in the chat. Nothing has been sent; the owner decides whether to send it.";
/** end_conversation's answer (Coder answers nothing after it). */
export const ENDED_RESULT = "The conversation has ended. Do not answer further.";

// ── WORKTREES, ON THE CHAT'S MACHINE ───────────────────────────────────────────────────────────────────────────────────
/** A shell word, single-quoted. */
export const shq = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";
/** The marks the scripts print for Coder's loop (each on its own line). */
export const MARK = "@@CODER-WT";
// (Shared start: the repository's top, its main checkout and whether the commands are in one of its worktrees.)
const FACTS = [
  "__top=$(git rev-parse --show-toplevel 2>/dev/null) || { echo \"" + MARK + " ERR not in a git repository\"; exit 3; }",
  "__common=$(git -C \"$__top\" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)",
  "__gd=$(git -C \"$__top\" rev-parse --path-format=absolute --git-dir 2>/dev/null)",
  "__main=$(dirname \"$__common\")",
  "__inwt=0; [ \"$__common\" != \"$__gd\" ] && __inwt=1",
].join("\n") + "\n";

/** The script that makes a new worktree and moves into it. */
export function enterNewScript(name) {
  return FACTS + [
    "if [ \"$__inwt\" = 1 ]; then echo \"" + MARK + " ERR Already in a worktree session: from inside a worktree only path works, under " + WORKTREE_DIR + "/\"; exit 3; fi",
    "__wt=\"$__main/" + WORKTREE_DIR + "/\"" + shq(name) + "; __br=" + shq("worktree-" + name),
    "if [ -e \"$__wt\" ]; then echo \"" + MARK + " ERR A worktree named " + name.replace(/["$`\\]/g, "") + " already exists at $__wt; pass it as path to enter it\"; exit 3; fi",
    "if git -C \"$__main\" show-ref --verify --quiet \"refs/heads/$__br\"; then echo \"" + MARK + " ERR the branch $__br already exists\"; exit 3; fi",
    "mkdir -p \"$(dirname \"$__wt\")\" && git -C \"$__main\" worktree add -q -b \"$__br\" \"$__wt\" HEAD >/dev/null 2>&1 || { echo \"" + MARK + " ERR git could not create the worktree\"; exit 3; }",
    "cd -- \"$__wt\" && echo \"" + MARK + " OK $__wt|$__br|$__main\"",
  ].join("\n");
}
/** The script that moves into an existing worktree (`approved`: the owner allowed one outside .claude/worktrees/). */
export function enterPathScript(path, approved = false) {
  return FACTS + [
    "__p=$(cd -- " + shq(path) + " 2>/dev/null && pwd -P) || { echo \"" + MARK + " ERR no such folder: \"" + shq(path) + "; exit 3; }",
    "__ok=0; __br=''; __cur=''",
    "while IFS= read -r __l; do case \"$__l\" in \"worktree \"*) __cur=${__l#worktree }; [ \"$(cd -- \"$__cur\" 2>/dev/null && pwd -P)\" = \"$__p\" ] && __ok=1;; \"branch \"*) [ \"$__ok\" = 1 ] && [ -z \"$__br\" ] && __br=${__l#branch refs/heads/};; esac; done <<EOF\n$(git -C \"$__main\" worktree list --porcelain 2>/dev/null)\nEOF",
    "if [ \"$__ok\" != 1 ] || [ \"$__p\" = \"$(cd -- \"$__main\" && pwd -P)\" ]; then echo \"" + MARK + " ERR $__p is not a worktree of this repository (see git worktree list)\"; exit 3; fi",
    "__under=0; case \"$__p/\" in \"$(cd -- \"$__main\" && pwd -P)/" + WORKTREE_DIR + "/\"*) __under=1;; esac",
    "if [ \"$__inwt\" = 1 ] && [ \"$__under\" != 1 ]; then echo \"" + MARK + " ERR from inside a worktree, the path must be under " + WORKTREE_DIR + "/ of the repository\"; exit 3; fi",
    approved ? ":" : "if [ \"$__under\" != 1 ]; then echo \"" + MARK + " ASK $__p\"; exit 4; fi",
    "cd -- \"$__p\" && echo \"" + MARK + " OK $__p|$__br|$__main\"",
  ].join("\n");
}
/** The script that says what exit_worktree would leave behind (no move, nothing changed). */
export function exitFactsScript() {
  return FACTS + [
    "if [ \"$__inwt\" != 1 ]; then echo \"" + MARK + " NONE\"; exit 0; fi",
    "case \"$__top/\" in \"$__main/" + WORKTREE_DIR + "/\"*) ;; *) echo \"" + MARK + " NONE\"; exit 0;; esac",
    "__br=$(git -C \"$__top\" symbolic-ref --short -q HEAD 2>/dev/null || true)",
    "__files=$(git -C \"$__top\" status --porcelain 2>/dev/null | wc -l | tr -d ' ')",
    "__base=$(git -C \"$__main\" rev-parse -q --verify HEAD 2>/dev/null || true)",
    "if git -C \"$__top\" rev-parse -q --verify '@{u}' >/dev/null 2>&1; then __commits=$(git -C \"$__top\" rev-list --count '@{u}..HEAD' 2>/dev/null || echo 0); else __commits=$(git -C \"$__top\" rev-list --count HEAD --not ${__base:+\"$__base\"} --remotes 2>/dev/null || echo 0); fi",
    "echo \"" + MARK + " STATE $__top|$__br|$__main|$__files|$__commits\"",
  ].join("\n");
}
/** The script that leaves: back to the main checkout, removing the worktree and its branch for "remove". */
export function exitScript({ top, main, branch, remove }) {
  return [
    "cd -- " + shq(main) + " || { echo \"" + MARK + " ERR the original folder is gone\"; exit 3; }",
    remove ? "git worktree remove --force " + shq(top) + " >/dev/null 2>&1 || { echo \"" + MARK + " ERR git could not remove the worktree\"; exit 3; }" : ":",
    remove && branch ? "git branch -D " + shq(branch) + " >/dev/null 2>&1 || true" : ":",
    "echo \"" + MARK + " OK " + "$(pwd -P)\"",
  ].join("\n");
}
/** The mark a script printed: { kind, rest } (kind OK, ERR, ASK, NONE or STATE), or null. */
export function markOf(output) {
  const lines = String(output || "").split("\n").map((l) => l.trim()).filter((l) => l.startsWith(MARK + " "));
  if (!lines.length) return null;
  const m = /^\S+ (\w+)\s?(.*)$/.exec(lines[lines.length - 1]);
  return m ? { kind: m[1], rest: m[2] } : null;
}
/** STATE's fields. */
export function exitState(rest) {
  const [top, branch, main, files, commits] = String(rest || "").split("|");
  return { top, branch, main, files: Number(files) || 0, commits: Number(commits) || 0 };
}
/** What a removal would throw away, in words ("" when nothing). */
export function atRiskWords({ files, commits }) {
  const parts = [];
  if (files) parts.push(files + " uncommitted " + (files === 1 ? "file" : "files"));
  if (commits) parts.push(commits + " " + (commits === 1 ? "commit" : "commits") + " not pushed or not on the original branch");
  return parts.join(" and ");
}
export const exitRefusedText = (state) => "Worktree has " + atRiskWords(state) + ". Removing it would discard this work. Confirm with the owner, then call exit_worktree again with discard_changes: true — or use action: \"keep\" to preserve the worktree.";
export const NO_WORKTREE = "No-op: there is no active worktree session to exit. Your commands are not in a worktree under " + WORKTREE_DIR + "/, so nothing was changed.";
