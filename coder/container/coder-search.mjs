/**
 * CLAUDE CODE'S GREP AND GLOB (the owner, 2026-11-14: "start fixing and filling in gaps on those tools"; "if we are doing it
 * with docs in reference is not extras, is extras when we make it up out of nowhere"). Both run on ripgrep in Claude Code,
 * with one search runner (2.1.323's mJ), so they live here together:
 *   - what Grok is told of them: Claude Code's short ("lean") descriptions, the ones a model that isn't one of Claude's older
 *     ones gets (its CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT: "newer models use the shorter one"), and their inputs, word for word;
 *   - their input checks, run before any hook (coder-inputs.mjs): Claude Code's fixes with their notes, its schema's refusals
 *     and its validation, in its words;
 *   - the search itself, on Coder's machine (coder-tools.mjs runs it, as the unprivileged user, inside the project);
 *   - its text for Grok, and its result object for the PostToolUse hooks (Claude Code's GrepOutput and GlobOutput).
 * Where Claude Code's docs say nothing, its 2.1.323 program says what to do. Coder's own safety items stay (the owner's
 * choice): no path outside the project, and nothing in .git.
 */
import { spawn } from "node:child_process";
import { realpathSync } from "node:fs";
import { stat, lstat, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, relative, resolve, join, dirname, basename, sep } from "node:path";
import { fileRuleHit, anchorOf, plainPath } from "./coder-filerules.mjs";
import { zodIssues, fromJsonSchema, failedText } from "./coder-zod.mjs";

// ── WHAT GROK IS TOLD ────────────────────────────────────────────────────────
/** Grep's description: Claude Code's short one, its "via Bash" Coder's `bash` tool. */
export const GREP_DESCRIPTION = 'Content search built on ripgrep. Prefer this over `grep`/`rg` via bash \u2014 results integrate with the permission UI and file links.\n\n- Full regex syntax (e.g. "log.*Error", "function\\s+\\w+"). Ripgrep, not grep \u2014 escape literal braces (`interface\\{\\}`).\n- Filter with `glob` (e.g. "**/*.tsx") or `type` (e.g. "js", "py", "rust").\n- `output_mode`: "content" (matching lines), "files_with_matches" (paths only, default), or "count".\n- `multiline: true` for patterns that span lines.';
/** Glob's description: Claude Code's short one. */
export const GLOB_DESCRIPTION = 'Fast file pattern matching. Supports glob patterns like "**/*.js" or "src/**/*.ts". Returns matching file paths sorted by modification time.';
/** Grep's inputs, in Claude Code's order, each with its own description (2.1.323's schema). */
export const GREP_PROPERTIES = Object.freeze({
  pattern: { type: "string", description: "The regular expression pattern to search for in file contents" },
  path: { type: "string", description: "File or directory to search in (rg PATH). Defaults to current working directory." },
  glob: { type: "string", description: 'Glob pattern to filter files (e.g. "*.js", "*.{ts,tsx}") - maps to rg --glob' },
  output_mode: { type: "string", enum: ["content", "files_with_matches", "count"], description: 'Output mode: "content" shows matching lines (supports -A/-B/-C context, -n line numbers, head_limit), "files_with_matches" shows file paths (supports head_limit), "count" shows match counts (supports head_limit). Defaults to "files_with_matches".' },
  "-B": { type: "number", description: 'Number of lines to show before each match (rg -B). Requires output_mode: "content", ignored otherwise.' },
  "-A": { type: "number", description: 'Number of lines to show after each match (rg -A). Requires output_mode: "content", ignored otherwise.' },
  "-C": { type: "number", description: "Alias for context." },
  context: { type: "number", description: 'Number of lines to show before and after each match (rg -C). Requires output_mode: "content", ignored otherwise.' },
  "-n": { type: "boolean", description: 'Show line numbers in output (rg -n). Requires output_mode: "content", ignored otherwise. Defaults to true.' },
  "-i": { type: "boolean", description: "Case insensitive search (rg -i)" },
  "-o": { type: "boolean", description: 'Print only the matched (non-empty) parts of each matching line, one match per output line (rg -o / --only-matching). Requires output_mode: "content", ignored otherwise. Defaults to false.' },
  type: { type: "string", description: "File type to search (rg --type). Common types: js, py, rust, go, java, etc. More efficient than include for standard file types." },
  head_limit: { type: "number", description: 'Limit output to first N lines/entries, equivalent to "| head -N". Works across all output modes: content (limits output lines), files_with_matches (limits file paths), count (limits count entries). Defaults to 250 when unspecified. Pass 0 for unlimited (use sparingly \u2014 large result sets waste context).' },
  offset: { type: "number", description: 'Skip first N lines/entries before applying head_limit, equivalent to "| tail -n +N | head -N". Works across all output modes. Defaults to 0.' },
  multiline: { type: "boolean", description: "Enable multiline mode where . matches newlines and patterns can span lines (rg -U --multiline-dotall). Default: false." },
});
/** Glob's inputs (2.1.323's schema). Unlike Grep, no `file_path` for `path`. */
export const GLOB_PROPERTIES = Object.freeze({
  pattern: { type: "string", description: "The glob pattern to match files against" },
  path: { type: "string", description: 'The directory to search in. If not specified, the current working directory will be used. IMPORTANT: Omit this field to use the default directory. DO NOT enter "undefined" or "null" - simply omit it for the default behavior. Must be a valid directory path if provided.' },
});
/** A tool's definition for Grok: Claude Code's schema is strict ("An unexpected parameter `x` was provided"). */
export const searchToolDef = (name) => ({ type: "function", function: { name, description: name === "grep" ? GREP_DESCRIPTION : GLOB_DESCRIPTION, parameters: { type: "object", properties: name === "grep" ? GREP_PROPERTIES : GLOB_PROPERTIES, required: ["pattern"], additionalProperties: false } } });

// ── THE INPUT CHECKS (before any hook) ───────────────────────────────────────
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
/** "true" and "false" as booleans, as Claude Code's schema takes them (its TA, for -n, -i, -o and multiline). */
const asBoolean = (v) => (v === "true" ? true : v === "false" ? false : v);
/** A number written as text, as a number (Claude Code's schema: "-B", "-A", "-C", context, head_limit, offset). */
const asNumber = (v) => {
  if (typeof v !== "string") return v;
  const n = v.trim();
  if (/^[-+]?\d+(\.\d+)?$/.test(n)) { const x = Number(n); if (Number.isFinite(x)) return x; }
  return v;
};
const GREP_NUMBERS = new Set(["-B", "-A", "-C", "context", "head_limit", "offset"]);
const GREP_BOOLEANS = new Set(["-n", "-i", "-o", "multiline"]);
/**
 * WHAT CLAUDE CODE'S SCHEMA SAYS OF AN INPUT, or "" (coder-zod.mjs: its strict schema's zod issues, in its w0's words, 2.1.325):
 * the missing parameters, then the unexpected ones, then those of the wrong type, then any other ("is invalid: …"), headed
 * "<Tool> failed due to the following issue(s):"; when only values are wrong (an output_mode it does not have), zod's own
 * list of issues, as JSON (the owner, 2026-11-14: "Fix base on Claude Code docs, please").
 */
function schemaProblem(tool, input, props) {
  const issues = zodIssues(fromJsonSchema({ type: "object", properties: props, required: ["pattern"], additionalProperties: false }), input);
  return issues.length ? failedText(tool, issues) : "";
}
/** A null byte in one of these, refused in Claude Code's words ("Grep pattern cannot contain null bytes (\0). …"). */
const nulProblem = (tool, pairs) => { const hit = pairs.find(([, s]) => typeof s === "string" && s.includes("\u0000")); return hit ? tool + " " + hit[0] + " cannot contain null bytes (\\0). Remove the null byte and try again." : ""; };
/**
 * GREP'S FIXES (Claude Code 2.1.292: "Grep accepts `file_path` for `path`"; 2.1.295: "a search sent with grep's `-l`, `-c`
 * or `-r` flag now runs instead of failing the call"; its coerceInput, word for word): the input fixed, and what Coder is
 * told, or null when nothing needed fixing.
 */
function grepFixes(input) {
  const n = { ...input }, said = [];
  const fp = n.file_path;
  if (typeof fp === "string" && fp !== "") {
    const fresh = !has(n, "path");
    if (fresh || n.path === fp) { delete n.file_path; n.path = fp; said.push("Grep's parameter for where to search is named `path`. " + (fresh ? "`file_path` was read as `path`." : "`file_path` repeated `path` and was ignored.")); }
  }
  for (const [flag, mode] of [["-l", "files_with_matches"], ["-c", "count"]]) {
    if (asBoolean(n[flag]) !== true) continue;
    const fresh = !has(n, "output_mode");
    if (fresh || n.output_mode === mode) { delete n[flag]; n.output_mode = mode; said.push(fresh ? "`" + flag + "` is not a Grep parameter and was read as `output_mode: \"" + mode + "\"`." : "`" + flag + "` repeated `output_mode` and was ignored."); }
  }
  if (asBoolean(n["-r"]) === true) { delete n["-r"]; said.push("`-r` was ignored: Grep always searches a directory recursively."); }
  return said.length ? { input: n, note: "Note: " + said.join(" ") } : null;
}
/** Grep's input as its schema reads it: numbers and booleans written as text taken as such. */
const grepParsed = (input) => { const out = {}; for (const [k, v] of Object.entries(input)) out[k] = GREP_NUMBERS.has(k) ? asNumber(v) : GREP_BOOLEANS.has(k) ? asBoolean(v) : v; return out; };
/**
 * GREP'S INPUT, AS CLAUDE CODE TAKES IT (coder-inputs.mjs; the owner, 2026-11-14): its fixes (used only when the fixed input
 * passes its schema), then its schema ("InputValidationError: Grep failed due to the following issue: …"), then its own
 * checks: no null byte in pattern, path, glob or type, and head_limit and offset whole numbers of 0 or more. A refusal starts
 * with "error: ", Coder's mark of a failed call.
 */
export function checkGrepInput(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) return { error: "error: InputValidationError: Grep failed due to the following issue:\nThe required parameter `pattern` is missing" };
  const fixed = grepFixes(args);
  const useFix = fixed && !schemaProblem("Grep", grepParsed(fixed.input), GREP_PROPERTIES);
  const a = grepParsed(useFix ? fixed.input : args);
  const bad = schemaProblem("Grep", a, GREP_PROPERTIES);
  if (bad) return { error: "error: InputValidationError: " + bad };
  const nul = nulProblem("Grep", [["pattern", a.pattern], ["path", a.path], ["glob", a.glob], ["type", a.type]]);
  if (nul) return { error: "error: " + nul };
  for (const [k, x] of [["head_limit", a.head_limit], ["offset", a.offset]]) {
    if (x !== undefined && (!Number.isInteger(x) || x < 0)) return { error: "error: " + k + " must be a whole number of 0 or more, got " + x + "." + (k === "head_limit" ? " Pass 0 for unlimited." : "") };
  }
  return useFix ? { args: a, note: fixed.note } : { args: a };
}
/** GLOB'S INPUT, AS CLAUDE CODE TAKES IT: its strict schema, then no null byte in pattern or path. */
export function checkGlobInput(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) return { error: "error: InputValidationError: Glob failed due to the following issue:\nThe required parameter `pattern` is missing" };
  const bad = schemaProblem("Glob", args, GLOB_PROPERTIES);
  if (bad) return { error: "error: InputValidationError: " + bad };
  const nul = nulProblem("Glob", [["pattern", args.pattern], ["path", args.path]]);
  if (nul) return { error: "error: " + nul };
  return { args: { ...args } };
}

// ── THE SETTINGS ─────────────────────────────────────────────────────────────
/** Claude Code's search time limit: 20 seconds (60 on WSL, which Coder's machine is not). */
export const SEARCH_TIMEOUT_MS = 20_000;
/** The longest a timer takes (Claude Code caps CLAUDE_CODE_GLOB_TIMEOUT_SECONDS there). */
const TIMER_MAX_MS = 2_147_483_647;
const on = (v) => /^(1|true|yes|on)$/i.test(String(v ?? "").trim());
/**
 * THE ENVIRONMENT'S SEARCH SETTINGS (Claude Code's env vars under Coder's names; server.mjs maps a repository's
 * CLAUDE_CODE_GLOB_* onto them): CODER_GLOB_TIMEOUT_SECONDS ("Timeout in seconds for Glob and Grep tool searches. Defaults to
 * 20 seconds"), CODER_GLOB_HIDDEN ("Set to false to exclude dotfiles from results when Claude invokes the Glob tool. Included
 * by default. Does not affect … Grep") and CODER_GLOB_NO_IGNORE ("Set to false to make the Glob tool respect .gitignore
 * patterns. By default, Glob returns all matching files including gitignored ones"). Read as Claude Code reads them: a
 * timeout only when it is a number above 0; the other two on unless set to something that isn't a yes.
 */
export function searchSettingsFrom(vars = {}) {
  const v = vars && typeof vars === "object" ? vars : {};
  const t = Number(String(v.CODER_GLOB_TIMEOUT_SECONDS ?? "").trim() || 0);
  return { timeoutMs: t > 0 ? Math.min(t * 1000, TIMER_MAX_MS) : SEARCH_TIMEOUT_MS, hidden: on(v.CODER_GLOB_HIDDEN || "true"), noIgnore: on(v.CODER_GLOB_NO_IGNORE || "true") };
}
const timeoutOf = (ctx) => { const t = Number(ctx && ctx.timeoutMs); return t > 0 ? Math.min(t, TIMER_MAX_MS) : SEARCH_TIMEOUT_MS; };

// ── THE RUNNER (Claude Code's mJ and Y$) ─────────────────────────────────────
/** ripgrep's output kept at most (Claude Code: "the 20MB output cap"). */
export const RG_OUTPUT_MAX = 20_000_000;
/** How long after its SIGTERM a search at its time limit gets its SIGKILL, and how long its end is then waited for. */
const KILL_GRACE_MS = 5000;
/** A failed search, its text Claude Code's (shown whole: coder-tools.mjs prints a long one). */
export class SearchError extends Error { constructor(m) { super(m); this.long = true; } }
const SHELL_SEARCH = "Do not run a recursive search in the shell instead (for example grep -r, find or rg)";
/** "The search failed, so this is not a "no matches" result" (Claude Code's errors page, and its program's last sentence). */
export const SEARCH_FAILED = 'The search failed, so this is not a "no matches" result: matches may exist. What happened to the search program (ripgrep) is not known, and no results were read. Run the search once more. If it fails again, tell the user that searches are failing. ' + SHELL_SEARCH + ": it can reach what this tool is set to leave out.";
/** What partial results start with (Claude Code 2.1.317: "Fixed Claude treating partial Grep and Glob results as complete when a search hit its time limit"). */
export const SEARCH_STOPPED = "The search stopped before it finished, most likely at its time limit, so these results are incomplete: more matches may exist. Search a more specific path or pattern.";
const secondsWords = (ms) => { const e = ms / 1000; return "Ripgrep search timed out after " + e + " " + (e === 1 ? "second" : "seconds"); };
/** A search that found nothing before its time limit (Claude Code 2.1.23: "ripgrep search timeouts silently returning empty results" fixed). */
export const timedOutText = (ms) => secondsWords(ms) + ". The search may have matched files but did not complete in time. Try searching a more specific path or pattern.";
/** ripgrep refusing what it was given (Claude Code's tools reference: "returns an error that includes ripgrep's diagnostic"). */
const USAGE_ERROR = /^rg: (?:regex parse error|error parsing glob|unrecognized file type|error parsing flag|compiled regex exceeds size limit)/m;
const usageText = (stderr) => "Search failed \u2014 ripgrep rejected the pattern, glob, or file type without searching:\n" + String(stderr).trim().slice(0, 2000);
/** The search path ripgrep could not read (Claude Code 2.1.292: "Claude now retries once or tells you"). */
function unreadableText(errno) {
  const denied = errno === 13 || errno === 1;
  const what = denied ? "permission denied" : errno === 5 ? "input/output error" : "an operating system error";
  const then = denied ? "Tell the user that the path could not be read. " + SHELL_SEARCH + "." : "Run the search once more. If it fails again, tell the user that the search is failing. " + SHELL_SEARCH + ": it can also reach other files, which this tool is set to leave out.";
  return "Search failed: ripgrep could not read the path it was given (" + what + ", os error " + errno + "), so nothing was searched. This is not a \"no matches\" result. " + then;
}
/** The machine out of a resource ripgrep needs to start (Claude Code 2.1.277), with Claude Code's reason and advice. */
const SPAWN_SHORT = { EAGAIN: ["a limit on processes or threads was reached", "this machine has reached a limit on processes; closing other programs can help"], ENOMEM: ["there is not enough memory", "this machine is short of memory; closing other programs can help"], EMFILE: ["this Coder process has too many files open", "Coder needs a restart"], ENFILE: ["the system has too many files open", "this machine has too many files open; closing other programs can help"] };
const spawnShortText = (code) => { const [why, advice] = SPAWN_SHORT[code] || ["the system ran out of a resource", "this machine is short of a resource needed to start programs"]; return "ripgrep could not start, so nothing was searched and matches may still exist: the operating system could not start it because " + why + " (" + code + "). Retry in a moment. If it keeps failing, tell the user that " + advice + "."; };
/** ripgrep's output lines as Claude Code reads them (its rawLines): the last line break ends a line, it is not one more. */
const rawLines = (s) => (s === "" ? [] : s.replace(/\n$/, "").split("\n"));
/** A cut-off last line left out (Claude Code's Bce): one with a null byte keeps what is before its last one. */
function wholeLines(lines, text) {
  const last = lines[lines.length - 1];
  if (last === undefined || text.endsWith("\n")) return lines;
  const k = last.lastIndexOf("\u0000");
  return k === -1 ? lines.slice(0, -1) : [...lines.slice(0, -1), last.slice(0, k + 1)];
}
/** One run of ripgrep: its exit, what it printed (each kept to RG_OUTPUT_MAX), and whether its time limit or the cap stopped it. */
function rgOnce(args, target, { cwd, timeoutMs, single }) {
  return new Promise((done) => {
    const argv = ["--no-config", ...(single ? ["-j", "1"] : []), ...args, target];
    let child;
    try { child = spawn("rg", argv, { cwd, stdio: ["ignore", "pipe", "pipe"] }); } catch (e) { done({ spawnError: e, stdout: "", stderr: "" }); return; }
    const out = [], err = [];
    let outBytes = 0, errBytes = 0, capped = false, atLimit = false, finished = false, t2 = null, t3 = null;
    const finish = (r) => {
      if (finished) return;
      finished = true;
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      done({ ...r, stdout: Buffer.concat(out).toString("utf8"), stderr: Buffer.concat(err).toString("utf8"), capped, atLimit });
    };
    child.stdout.on("data", (b) => {
      if (capped) return;
      const room = RG_OUTPUT_MAX - outBytes;
      if (b.length <= room) { out.push(b); outBytes += b.length; return; }
      out.push(b.subarray(0, room)); outBytes += room; capped = true;
      try { child.kill("SIGKILL"); } catch { /* gone */ }
    });
    child.stderr.on("data", (b) => { const room = RG_OUTPUT_MAX - errBytes; if (room <= 0) return; err.push(b.length <= room ? b : b.subarray(0, room)); errBytes += Math.min(b.length, room); });
    // (At its time limit: SIGTERM, then SIGKILL 5 seconds later, then its end waited for 5 seconds more: Claude Code 2.1.316,
    // "Fixed Grep and Glob never returning when the search process is killed at the timeout but does not exit".)
    const t1 = setTimeout(() => {
      atLimit = true;
      try { child.kill("SIGTERM"); } catch { /* gone */ }
      t2 = setTimeout(() => { try { child.kill("SIGKILL"); } catch { /* gone */ } t3 = setTimeout(() => finish({ code: null, signal: "SIGTERM" }), KILL_GRACE_MS); }, KILL_GRACE_MS);
    }, timeoutMs);
    child.on("error", (e) => finish({ spawnError: e }));
    child.on("close", (code, signal) => finish({ code, signal: signal || (atLimit ? "SIGTERM" : null) }));
  });
}
/**
 * A SEARCH, AS CLAUDE CODE'S RUNNER READS IT (2.1.323's mJ, with rejectOnInputError): `{ lines, timedOut }`, or a
 * SearchError in Claude Code's words. Exit 1 is no match; exit 2 with results keeps them (one unreadable file among many);
 * a search its time limit stopped keeps what it had read, marked; one that read nothing says so. ripgrep's own config file is
 * never read (`--no-config`, as Claude Code's built-in ripgrep; 2.0.30: "Removed support for custom ripgrep configuration").
 */
export async function runRipgrep(args, target, { cwd, timeoutMs = SEARCH_TIMEOUT_MS } = {}) {
  let r = await rgOnce(args, target, { cwd, timeoutMs, single: false });
  // (Short of threads: once more, single-threaded, as Claude Code does: "rg EAGAIN error detected, retrying with single-threaded mode (-j 1)".)
  if (!r.spawnError && !r.capped && r.code !== 0 && r.code !== 1 && /os error 11|Resource temporarily unavailable/.test(r.stderr)) r = await rgOnce(args, target, { cwd, timeoutMs, single: true });
  if (r.spawnError) {
    const code = r.spawnError.code;
    if (code === "ENOENT") throw new SearchError("ripgrep not found on PATH. Install it (brew install ripgrep / apt install ripgrep / winget install BurntSushi.ripgrep.MSVC).");
    if (code && has(SPAWN_SHORT, code)) throw new SearchError(spawnShortText(code));
    throw new SearchError(String(r.spawnError.message || r.spawnError));
  }
  const { stdout, stderr } = r;
  const failed = r.capped || !(r.code === 0 || r.code === 1);
  if (!failed) return { lines: rawLines(stdout), timedOut: false };
  // (Stopped by the output cap is no kill for this: Claude Code's runner sees "stdout maxBuffer length exceeded" there.)
  const killed = !r.capped && (r.signal === "SIGTERM" || r.signal === "SIGKILL");
  const odd = !r.capped && (r.code === null || r.code === undefined) && (!r.signal || ["SIGHUP", "SIGINT", "SIGPIPE"].includes(r.signal));
  let lines = stdout.trim().length ? rawLines(stdout) : [];
  if (lines.length && (killed || r.capped || odd)) lines = wholeLines(lines, stdout);
  if (r.code === 2 && !lines.length && USAGE_ERROR.test(stderr)) throw new SearchError(usageText(stderr));
  if (r.code === 2 && lines.every((l) => l.endsWith('"type":"summary"}')) && stderr.startsWith("rg: " + target + ": ") && !stderr.trimEnd().includes("\n")) {
    const errno = Number((/\(os error (\d+)\)\s*$/.exec(stderr) || [])[1]);
    if (!Number.isNaN(errno) && errno !== 2 && errno !== 20) throw new SearchError(unreadableText(errno));
  }
  if (r.code !== 2 && !killed && !r.capped && !odd && !/os error 11|Resource temporarily unavailable/.test(stderr) && !lines.length) throw new SearchError(SEARCH_FAILED);
  if (r.capped && !lines.length) throw new SearchError("Ripgrep output passed the " + RG_OUTPUT_MAX / 1e6 + "MB limit before a single complete line was read, so there are no usable results: at least one matching line is extremely long. Try a more specific pattern or path, or exclude very large files.");
  if (killed && !lines.length) throw new SearchError(timedOutText(timeoutMs));
  // (Results cut short by a SIGTERM or SIGKILL are marked whoever sent it, the time limit or the system (out of memory), as
  // Claude Code marks them: "The search stopped before it finished…".)
  return { lines, timedOut: killed };
}

// ── PATHS ────────────────────────────────────────────────────────────────────
/** A path as Claude Code takes one (its `_t`): trimmed, `~` and `~/` from the home folder, a short one from where the commands are. */
export function fullPath(p, base) {
  const n = String(p).trim();
  if (!n) return base;
  const home = process.env.HOME || homedir();
  if (n === "~") return resolve(home);
  if (n.startsWith("~/")) return resolve(home, n.slice(2));
  return isAbsolute(n) ? resolve(n) : resolve(base, n);
}
/** A result's path as Claude Code shows it (its Kit): from where the commands are, with no "./"; a full path when outside. */
export const shownPath = (p, base) => { const r = relative(base, p); return r.startsWith("..") ? p : r; };
const within = (p, dir) => p === dir || p.startsWith(dir.endsWith(sep) ? dir : dir + sep);
/** Where ripgrep runs (Claude Code's myt): where the commands are when the search is inside it, else the search's own folder. */
const searchCwd = (target, base, isDir) => (within(target, base) ? base : isDir ? target : base);
/**
 * "Did you mean …?" (Claude Code's $Ee, for a missing path): when the path is beside the folder the commands are in, and the
 * same path from inside that folder exists.
 */
async function didYouMean(full, base) {
  let c = full;
  try { c = join(await realpath(dirname(full)), basename(full)); } catch { /* as given */ }
  const up = dirname(base), pre = up === sep ? sep : up + sep;
  if (!c.startsWith(pre) || c.startsWith(base + sep) || c === base) return "";
  const guess = join(base, relative(up, c));
  try { await stat(guess); return guess; } catch { return ""; }
}
const NOTE_CWD = "Note: your current working directory is";

// ── READ DENY RULES (Claude Code: "a best-effort attempt to apply Read(path) deny rules to all built-in tools that read files like Grep and Glob")
/**
 * THE OWNER'S READ DENY RULES, given to ripgrep as `--iglob !…` (Claude Code's yIr: a rule anchored at a folder as a pattern
 * from where ripgrep runs, `!/…`; one that matches at any depth as `!**\/…`; a folder's `…/**` also as the folder itself; a
 * rule with `[` left to the check below). Best effort, as Claude Code's: each result is still checked against the rules.
 */
export function denyGlobs(deny, rgCwd) {
  if (!deny || !Array.isArray(deny.rules)) return [];
  const out = [], seen = new Set();
  const add = (g) => { if (!seen.has(g)) { seen.add(g); out.push(g); } if (g.endsWith("/**") && g.length > 4) { const d = g.slice(0, -3); if (d !== "!**" && !seen.has(d)) { seen.add(d); out.push(d); } } };
  // (Braces written as classes, as Claude Code's zce does, so ripgrep reads them literally.)
  const braces = (s) => { let o = "", inClass = false; for (let i = 0; i < s.length; i++) { const ch = s[i]; if (ch === "\\" && i + 1 < s.length) { o += ch + s[++i]; continue; } if (inClass) { if (ch === "]") inClass = false; o += ch; continue; } if (ch === "[") { inClass = true; o += ch; } else if (ch === "{" || ch === "}") o += "[" + ch + "]"; else o += ch; } return o; };
  for (const t of deny.rules) {
    const m = /^Read\(([\s\S]*)\)$/.exec(String(t || "").trim());
    if (!m) continue;
    const spec = m[1].trim();
    if (!spec || spec === "*" || spec === "**" || spec.startsWith("!") || spec.includes("[")) continue;
    const a = anchorOf(spec, "deny", { root: deny.root || "/", home: deny.home || "" });
    if (!a) continue;
    if (a.pattern.startsWith("/")) {
      const abs = plainPath(join(a.root, a.pattern));
      if (abs === plainPath(rgCwd)) { add("!**"); continue; }
      if (!within(abs, plainPath(rgCwd))) continue;
      add("!/" + braces(abs.slice(plainPath(rgCwd).length + 1)));
    } else add("!**/" + braces(a.pattern.replace(/^(\*\*\/)+/, "")));
  }
  return out;
}
/** Whether a Read deny rule covers a full path (coder-filerules.mjs, Claude Code's rules, its symlinks followed). */
function denyCheck(deny) {
  if (!deny || !Array.isArray(deny.rules) || !deny.rules.some((r) => /^Read\(/.test(String(r || "").trim()))) return null;
  const seen = new Map();
  const real = (p) => { try { return realpathSync(p); } catch { return ""; } };
  return (p) => {
    // (Path rules only: a rule on the whole Read tool is Read's own, as Claude Code's search reads them. 2026-11-14.)
    if (!seen.has(p)) seen.set(p, !!fileRuleHit(deny.rules, "Read", p, "deny", { root: deny.root || "/", home: deny.home || "", sources: deny.sources || null, real, pathOnly: true }));
    return seen.get(p);
  };
}

// ── GREP (Claude Code's uMr) ─────────────────────────────────────────────────
/** The folders of other version-control tools Claude Code never searches (2.1.86: "Added .jj and .sl to VCS directory exclusion lists so Grep … don't descend into Jujutsu or Sapling metadata"). */
export const VCS_DIRS = [".git", ".svn", ".hg", ".bzr", ".jj", ".sl"];
/** How many lines, paths or counts Grep gives when head_limit isn't set. */
export const GREP_HEAD_LIMIT = 250;
/** A Grep result's text kept in the chat, inline (Claude Code: Grep's maxResultSizeChars); past it, saved to a file. */
export const GREP_INLINE_MAX = 20_000;
/** Glob's (its 100,000, under Claude Code's 50,000 for every tool's result). */
export const GLOB_INLINE_MAX = 50_000;
/** A page of results (Claude Code's Rrt): `head_limit` 0 is all of them; unset, 250. */
function page(items, limit, offset = 0) {
  if (limit === 0) return { items: items.slice(offset), appliedLimit: undefined };
  const n = limit ?? GREP_HEAD_LIMIT;
  return { items: items.slice(offset, offset + n), appliedLimit: items.length - offset > n ? n : undefined };
}
/** "limit: 250, offset: 10" (Claude Code's Art). */
const pageWords = (limit, offset) => [limit !== undefined ? "limit: " + limit : "", offset ? "offset: " + offset : ""].filter(Boolean).join(", ");
/** A file's lines with their newlines counted to a byte (Claude Code's _Mr, for -o). */
const linesBefore = (buf, n) => { let c = 0; for (let i = Math.min(n, buf.length) - 1; i >= 0; i--) if (buf[i] === 10) c++; return c; };
const noCr = (t) => (t.endsWith("\r") ? t.slice(0, -1) : t);
/**
 * CONTENT MODE'S LINES FROM RIPGREP'S JSON (Claude Code's mMr): `path\0N:text` for a match, `path\0N-text` for context, `--`
 * between groups apart, a line over 500 characters as "[Omitted long matching line]", and a binary file's matches as one
 * line, "binary file matches (found "\0" byte around offset N)".
 */
function contentLines(json, { contextBreaks, onlyMatching }) {
  const text = (x) => (x === undefined || x === null ? "" : x.text !== undefined ? x.text : Buffer.from(x.bytes ?? "", "base64").toString("utf8"));
  const long = (t, kind) => (t.length > 500 ? (kind === "match" ? "[Omitted long matching line]" : "[Omitted long context line]") : t);
  const out = [];
  let held = [], lastPath = null, lastLine = -1;
  for (const l of json) {
    if (!l.startsWith("{")) continue;
    let x;
    try { x = JSON.parse(l); } catch { continue; }
    if (x === null || typeof x !== "object") continue;
    const d = x.data ?? {};
    if (x.type === "begin") { held = []; continue; }
    if (x.type === "end") {
      const bin = typeof d.binary_offset === "number";
      for (const h of held) if (!bin || !h.slice(h.indexOf("\u0000") + 1).includes("\u0000")) out.push(h);
      if (bin && held.length) out.push(text(d.path) + "\u0000binary file matches (found \"\\0\" byte around offset " + d.binary_offset + ")");
      held = [];
      continue;
    }
    if (x.type !== "match" && x.type !== "context") continue;
    const p = text(d.path), n = d.line_number ?? 0, body = text(d.lines).replace(/\r?\n$/, "");
    if (contextBreaks && lastPath !== null && (p !== lastPath || n > lastLine + 1)) held.push("--");
    if (x.type === "match" && onlyMatching) {
      let end = n;
      for (const s of d.submatches ?? []) {
        const at = n + linesBefore(Buffer.from(body), s.start ?? 0);
        text(s.match).split("\n").forEach((m, k) => { held.push(p + "\u0000" + (at + k) + ":" + long(noCr(m), "match")); end = at + k; });
      }
      lastPath = p; lastLine = end;
      continue;
    }
    const kind = x.type === "match" ? "match" : "context", mark = kind === "match" ? ":" : "-";
    const parts = body.split("\n").map(noCr);
    parts.forEach((t, k) => held.push(p + "\u0000" + (n + k) + mark + long(t, kind)));
    lastPath = p; lastLine = n + parts.length - 1;
  }
  for (const h of held) out.push(h);
  return out;
}
/** The other modes' entries from ripgrep's `--null` output (Claude Code's Cko): paths, or `path:N` with no count of 0. */
function nullEntries(lines, mode) {
  const s = lines.join("\n");
  if (!s.includes("\u0000")) return lines;
  if (mode === "count") { const out = [], re = /([^\0]*)\0:?(\d+)(?:\n|$)/gy; for (let m = re.exec(s); m !== null; m = re.exec(s)) if (m[2] !== "0") out.push(m[1] + ":" + m[2]); return out; }
  const parts = s.split("\u0000");
  parts.pop();
  return parts.filter((x) => x !== "");
}
/** Grep's text for Grok (Claude Code's mapToolResultToToolResultBlockParam), from its result object. */
export function grepText(d) {
  const pre = d.timedOut ? SEARCH_STOPPED + "\n\n" : "";
  const p = pageWords(d.appliedLimit, d.appliedOffset);
  if (d.mode === "content") {
    const body = d.content || (d.appliedOffset && (d.totalLines ?? 0) > 0 ? "No entries at this offset" : "No matches found");
    return pre + (p ? body + "\n\n[Showing results with pagination = " + p + "]" : body);
  }
  if (d.mode === "count") {
    const t = d.numMatches ?? 0, f = d.numFiles ?? 0;
    const body = d.content || (t > 0 ? "No entries at this offset" : "No matches found");
    return pre + body + "\n\nFound " + t + " total " + (t === 1 ? "occurrence" : "occurrences") + " across " + f + " " + (f === 1 ? "file" : "files") + "." + (p ? " with pagination = " + p : "");
  }
  if (!d.numFiles) return pre + (d.appliedOffset && (d.totalFiles ?? 0) > 0 ? "No entries at this offset. [Showing results with pagination = " + p + "]" : "No files found");
  return pre + "Found " + d.numFiles + " " + (d.numFiles === 1 ? "file" : "files") + (p ? " " + p : "") + "\n" + d.filenames.join("\n");
}
const inGit = (p) => /(^|\/)\.git(\/|$)/.test(p);
/**
 * GREP, ON CODER'S MACHINE: `{ text, facts }`. `env`: `{ base, inside, deny, timeoutMs }` (`base` where the commands are;
 * `inside(path, opts)` coder-tools.mjs's check that keeps a path inside the project; `deny` the owner's Read deny rules).
 */
export async function grepTool(args, env) {
  // (Its input check again: a call that comes another way, an agent hook's, is held to it too.)
  const ok = checkGrepInput(args);
  if (ok.error) throw new SearchError(ok.error.replace(/^error: /, ""));
  const a = ok.args;
  const base = env.base;
  const mode = a.output_mode ?? "files_with_matches";
  const target0 = typeof a.path === "string" && a.path ? fullPath(a.path, base) : base;
  // (Coder's own rule, kept: inside the project, never in .git.)
  const { abs: target } = await env.inside(target0, { output: true });
  // A PATH THAT ISN'T THERE (Claude Code's aMr): "Path does not exist: … Note: your current working directory is …".
  if (typeof a.path === "string" && a.path) {
    try { await stat(target); } catch (e) {
      if (!e || (e.code !== "ENOENT" && e.code !== "ENOTDIR")) throw e;
      const guess = await didYouMean(target, base);
      throw new SearchError("Path does not exist: " + a.path + ". " + NOTE_CWD + " " + base + "." + (guess ? " Did you mean " + guess + "?" : ""));
    }
  }
  let isDir;
  try { isDir = (await stat(target)).isDirectory(); } catch {
    // (Gone since: Claude Code's dMr, an empty result.)
    return mode === "content" ? done({ mode: "content", numFiles: 0, filenames: [], content: "", numLines: 0, totalLines: 0 }) : mode === "count" ? done({ mode: "count", numFiles: 0, filenames: [], content: "", numMatches: 0 }) : done({ mode: "files_with_matches", filenames: [], numFiles: 0, totalFiles: 0 });
  }
  const cwd = searchCwd(target, base, isDir);
  // RIPGREP'S ARGUMENTS, IN CLAUDE CODE'S ORDER: hidden files searched, the version-control folders left out, lines cut at
  // 500 columns, then the call's own.
  const rg = ["--hidden"];
  for (const d of VCS_DIRS) rg.push("--glob", "!" + d);
  rg.push("--max-columns", "500");
  if (a.multiline === true) rg.push("-U", "--multiline-dotall");
  if (a["-i"] === true) rg.push("-i");
  if (mode === "files_with_matches") rg.push("-l"); else if (mode === "count") rg.push("-c", "-H");
  rg.push(mode === "content" ? "--json" : "--null");
  if (mode === "content") rg.push("-n");
  if (a["-o"] === true && mode === "content") rg.push("-o");
  if (mode === "content") {
    if (a.context !== undefined) rg.push("-C", String(a.context));
    else if (a["-C"] !== undefined) rg.push("-C", String(a["-C"]));
    else { if (a["-B"] !== undefined) rg.push("-B", String(a["-B"])); if (a["-A"] !== undefined) rg.push("-A", String(a["-A"])); }
  }
  if (a.pattern.startsWith("-")) rg.push("-e", a.pattern); else rg.push(a.pattern);
  if (a.type) rg.push("--type", a.type);
  // `glob`, split at spaces, and at commas outside braces (Claude Code: "*.{ts,tsx}" is one glob, "*.ts,*.tsx" two).
  if (a.glob) for (const w of a.glob.split(/\s+/)) for (const g of w.includes("{") && w.includes("}") ? [w] : w.split(",")) if (g) rg.push("--glob", g);
  for (const g of denyGlobs(env.deny, cwd)) rg.push("--iglob", g);
  // (And .git once more, last: a later glob of the call's own, such as "*", would take it back, and Coder never searches it.)
  rg.push("--glob", "!.git");
  const run = await runRipgrep(rg, target, { cwd, timeoutMs: timeoutOf(env) });
  let lines = mode === "content" ? contentLines(run.lines, { contextBreaks: [a.context, a["-C"], a["-B"], a["-A"]].some((x) => typeof x === "number" && x > 0), onlyMatching: a["-o"] === true }) : nullEntries(run.lines, mode);
  // READ DENY RULES AND .git, BEFORE THE PAGE IS CUT: a line, path or count of a file they cover is left out.
  const denied = denyCheck(env.deny);
  const pathOf = (l) => (mode === "content" ? (l === "--" ? null : l.slice(0, Math.max(0, l.indexOf("\u0000")))) : mode === "count" ? l.slice(0, Math.max(0, l.lastIndexOf(":"))) : l);
  const before = lines.length;
  lines = lines.filter((l) => { const p = pathOf(l); return p === null || !(inGit(p) || (denied && denied(p))); });
  if (lines.length !== before) lines = lines.filter((l, k, all) => l !== "--" || (k > 0 && k < all.length - 1 && all[k - 1] !== "--"));
  const limit = a.head_limit, offset = a.offset ?? 0;
  const timed = run.timedOut ? { timedOut: true } : {};
  if (mode === "content") {
    const { items, appliedLimit } = page(lines, limit, offset);
    const n = a["-n"] !== false;
    const shown = items.map((l) => {
      const z = l.indexOf("\u0000");
      if (z < 0) return n ? l : l.replace(/^\d+[:-]/, "");
      const rest = l.slice(z + 1), m = /^(\d+)([:-])/.exec(rest), mark = m ? m[2] : ":";
      const body = n || m === null ? rest : rest.slice(m[0].length);
      return isDir ? shownPath(l.slice(0, z), base) + mark + body : body;
    });
    return done({ mode: "content", numFiles: 0, filenames: [], content: shown.join("\n"), numLines: shown.length, totalLines: lines.length, ...(appliedLimit !== undefined ? { appliedLimit } : {}), ...(offset > 0 ? { appliedOffset: offset } : {}), ...timed });
  }
  if (mode === "count") {
    const { items, appliedLimit } = page(lines, limit, offset);
    const shown = items.map((l) => { const k = l.lastIndexOf(":"); return k > 0 ? shownPath(l.slice(0, k), base) + l.slice(k) : l; });
    let matches = 0, files = 0;
    for (const l of lines) { const k = l.lastIndexOf(":"); if (k > 0) { const x = parseInt(l.slice(k + 1), 10); if (!Number.isNaN(x)) { matches += x; files += 1; } } }
    return done({ mode: "count", numFiles: files, filenames: [], content: shown.join("\n"), numMatches: matches, ...(appliedLimit !== undefined ? { appliedLimit } : {}), ...(offset > 0 ? { appliedOffset: offset } : {}), ...timed });
  }
  // FILES MODE: newest first (Claude Code: each file's modification time, then its name).
  const times = await Promise.allSettled(lines.map((p) => stat(p)));
  const sorted = lines.map((p, k) => [p, times[k].status === "fulfilled" ? times[k].value.mtimeMs ?? 0 : 0]).sort((x, y) => (y[1] - x[1]) || x[0].localeCompare(y[0])).map((x) => x[0]);
  const { items, appliedLimit } = page(sorted, limit, offset);
  const names = items.map((p) => shownPath(p, base));
  return done({ mode: "files_with_matches", filenames: names, numFiles: names.length, totalFiles: sorted.length, ...(appliedLimit !== undefined ? { appliedLimit } : {}), ...(offset > 0 ? { appliedOffset: offset } : {}), ...timed });
  function done(facts) { return { text: grepText(facts), facts }; }
}

// ── GLOB (Claude Code's NH, zyn and CPr) ─────────────────────────────────────
/** How many files Glob lists (Claude Code: "Results are sorted by modification time and capped at 100 files"). */
export const GLOB_LIMIT = 100;
/** The note under a capped list (Claude Code's HPr). */
export function globCapNote(d) {
  const n = d.filenames.length;
  if (d.totalMatches === undefined) return "(Results are truncated. Consider using a more specific path or pattern.)";
  if (d.countIsComplete) return "(Showing " + n + " of " + d.totalMatches + " matching files; " + (d.totalMatches - n) + " more are not listed. Narrow the pattern or path to see the rest.)";
  return "(Showing the first " + n + " files; there are more than " + d.totalMatches + " matches. Narrow the pattern or path to see the rest.)";
}
/** Glob's text for Grok. */
export function globText(d) {
  const pre = d.timedOut ? SEARCH_STOPPED + "\n\n" : "";
  if (!d.filenames.length) return pre + "No files found";
  return pre + [...d.filenames, ...(d.truncated ? [globCapNote(d)] : [])].join("\n");
}
/** A full pattern split at its first wildcard (Claude Code's EPr): the folder before it, and the pattern from there. */
export function splitPattern(p) {
  const m = /[*?[{]/.exec(p);
  if (!m) return { baseDir: dirname(p), relativePattern: basename(p) };
  const s = p.slice(0, m.index), k = s.lastIndexOf("/");
  if (k === -1) return { baseDir: "", relativePattern: p };
  return { baseDir: k === 0 ? "/" : s.slice(0, k), relativePattern: p.slice(k + 1) };
}
/**
 * A PATTERN THAT STARTS WITH THE FOLDERS THE SEARCH IS ALREADY IN (Claude Code's RPr): `container/x.mjs` searched from
 * `…/container` is `/x.mjs` there. Its plain leading folders (no wildcard) that repeat the end of the folder are dropped.
 */
export function droppedRepeat(pattern, dir) {
  const segs = pattern.split("/");
  let s = 0;
  while (s < segs.length - 1 && segs[s] !== "" && !/[*?[\]{}!]/.test(segs[s])) s++;
  const tail = dir.split(/[\\/]+/).filter(Boolean);
  for (let y = s; y > 0; y--) {
    const head = segs.slice(0, y), end = tail.slice(-y);
    if (end.length === y && head.every((x, i) => x === end[i])) return "/" + segs.slice(y).join("/");
  }
  return pattern;
}
/** Whether the folders a rewrite drops really are there, inside the search folder (Claude Code's PPr): then it isn't made. */
async function droppedExist(dir, pattern, rewritten) {
  const segs = pattern.split("/"), kept = rewritten.replace(/^\//, "").split("/").length;
  const gone = segs.slice(0, Math.max(1, segs.length - kept));
  let p = dir;
  for (const g of gone) {
    p = join(p, g);
    try { const st = await lstat(p); if (!st.isDirectory() || st.isSymbolicLink()) return false; } catch { return false; }
  }
  return gone.length > 0;
}
/**
 * GLOB, ON CODER'S MACHINE: `{ text, facts }`. `env` as Grep's, with `hidden` and `noIgnore` (CODER_GLOB_HIDDEN and
 * CODER_GLOB_NO_IGNORE, both on unless the environment turns them off).
 */
export async function globTool(args, env) {
  const t0 = Date.now();
  const ok = checkGlobInput(args);
  if (ok.error) throw new SearchError(ok.error.replace(/^error: /, ""));
  const a = ok.args;
  const base = env.base;
  let pattern = String(a.pattern);
  // A FULL PATTERN names its own folder (Claude Code's vrt): the folder before its first wildcard is searched, `path` aside.
  let dir0, own = false;
  if (isAbsolute(pattern)) { const s = splitPattern(pattern); if (s.baseDir) { dir0 = fullPath(s.baseDir, base); pattern = s.relativePattern; own = true; } }
  if (!own) dir0 = typeof a.path === "string" && a.path ? fullPath(a.path, base) : base;
  // (Coder's own rule, kept: inside the project, never in .git.)
  const { abs: dir } = await env.inside(dir0);
  // `path` ITSELF CHECKED when it is the folder searched (Claude Code's UPr): "Directory does not exist: …", "Path is not a
  // directory: …".
  if (typeof a.path === "string" && a.path && dir0 === fullPath(a.path, base)) {
    let st;
    try { st = await stat(dir); } catch (e) {
      if (!e || (e.code !== "ENOENT" && e.code !== "ENOTDIR")) throw e;
      const guess = await didYouMean(dir, base);
      throw new SearchError("Directory does not exist: " + a.path + ". " + NOTE_CWD + " " + base + "." + (guess ? " Did you mean " + guess + "?" : ""));
    }
    if (!st.isDirectory()) throw new SearchError("Path is not a directory: " + a.path);
  }
  let rewritten = false;
  if (!own) { const r = droppedRepeat(pattern, dir); if (r !== pattern && !(await droppedExist(dir, pattern, r))) { pattern = r; rewritten = true; } }
  let isDir;
  try { isDir = (await stat(dir)).isDirectory(); } catch { return globDone({ files: [], truncated: false, totalMatches: 0, countIsComplete: true, timedOut: false }); }
  const cwd = searchCwd(dir, base, isDir);
  // (A rewritten pattern starts at the search folder, which ripgrep's globs count from where it runs: Claude Code's zyn.)
  if (rewritten && pattern.startsWith("/") && cwd !== dir) {
    const r = relative(cwd, dir).split(sep).join("/");
    pattern = r === "" || r === ".." || r.startsWith("../") || isAbsolute(r) ? pattern.slice(1) : "/" + r + pattern;
  }
  // RIPGREP'S ARGUMENTS (Claude Code's CPr): the files, oldest first, gitignored and hidden ones too unless the environment
  // says otherwise; Read deny rules left out; .git never (Coder's).
  const rg = ["--files", "--null", "--glob", pattern, "--sort=modified", ...(env.noIgnore !== false ? ["--no-ignore"] : []), ...(env.hidden !== false ? ["--hidden"] : [])];
  for (const g of denyGlobs(env.deny, cwd)) rg.push("--iglob", g);
  rg.push("--glob", "!.git");
  const run = await runRipgrep(rg, dir, { cwd, timeoutMs: timeoutOf(env) });
  // (Nothing in .git, whatever the pattern: Coder's.)
  const found = nullEntries(run.lines, "files_with_matches").filter((p) => !inGit(p));
  // THE CAP, PAST READ DENY RULES (Claude Code's CPr: with deny rules, files are judged in order until 100 are kept, so the
  // count past them is only a floor).
  const denied = denyCheck(env.deny);
  const limit = GLOB_LIMIT;
  let files, truncated, totalMatches, complete = true;
  if (!denied) { files = found.slice(0, limit); truncated = found.length > limit; totalMatches = found.length; }
  else {
    files = []; let kept = 0, k = 0;
    for (; k < found.length && files.length < limit; k++) { const p = found[k]; if (denied(p)) continue; kept++; files.push(p); }
    totalMatches = kept; complete = k >= found.length; truncated = !complete;
  }
  return globDone({ files, truncated, totalMatches, countIsComplete: complete && !run.timedOut, timedOut: run.timedOut });
  function globDone(r) {
    const filenames = r.files.map((p) => shownPath(p, base));
    const facts = { filenames, durationMs: Date.now() - t0, numFiles: filenames.length, truncated: r.truncated, totalMatches: r.totalMatches, countIsComplete: r.countIsComplete, ...(r.timedOut ? { timedOut: true } : {}) };
    return { text: globText(facts), facts };
  }
}
