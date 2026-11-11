// HOOKS (Bash docs, the owner, 2026-11-10: "yea do all 4", then "yea do all of them"): Claude Code's hooks in Coder. Its
// hooks reference: "Hooks are user-defined shell commands … that execute at specific points in Claude Code's lifecycle." The
// owner's own (Settings, kept on the account, as Claude Code's user settings) and the repository's (`.claude/settings.json` and
// `.claude/settings.local.json`, as Claude Code's project settings), in Claude Code's shape:
//   { "hooks": { "PreToolUse": [ { "matcher": "Bash", "hooks": [ { "type": "command", "command": "…", "timeout": 60 } ] } ] } }
// Command hooks run on Coder's machine as Coder's own commands do (its user, its room, the folder its commands are in), with the
// event's JSON on stdin; HTTP hooks send it to a web address from there too (so the environment's network rules hold); prompt
// and agent hooks ask Coder's model. Their exit code, stdout and stderr (or answer) say what happens, as in Claude Code. This file
// is the part with no machine in it: reading the settings, matching, the input, and what a hook's output means. (No node:
// modules: the Worker checks the owner's hooks with it.)
import { utf16Base64 } from "./coder-ps.mjs";
import { ifRuleMatches } from "./coder-perms.mjs";

/** The events Coder has (Claude Code's names), and the ones about a tool call. */
export const HOOK_EVENTS = ["SessionStart", "UserPromptSubmit", "PreToolUse", "PermissionRequest", "PostToolUse", "PostToolUseFailure", "PostToolBatch", "PermissionDenied", "Notification", "Stop", "StopFailure", "PreCompact", "PostCompact", "CwdChanged", "FileChanged", "SessionEnd"];
export const TOOL_EVENTS = new Set(["PreToolUse", "PermissionRequest", "PostToolUse", "PostToolUseFailure", "PermissionDenied"]);
/** The events whose matcher Claude Code ignores ("If you add a matcher field to an event without matcher support, it is silently ignored"). */
const NO_MATCHER = new Set(["UserPromptSubmit", "Stop", "PostToolBatch", "CwdChanged"]);
/** "FileChanged and StopFailure use a narrower exact-match set of letters, digits, _, and | only." */
const NARROW = new Set(["FileChanged", "StopFailure"]);
/** The events whose hooks can block or change an action (never under the memory cap: Claude Code's "Permission-gating hooks"). */
export const GATING_EVENTS = new Set(["PreToolUse", "PermissionRequest", "UserPromptSubmit", "Stop", "PreCompact", "PostToolBatch", "PostToolUse", "PostToolUseFailure"]);
/** The events whose hooks get the chat's hook env file (Claude Code: "CLAUDE_ENV_FILE is available for SessionStart, Setup, CwdChanged, and FileChanged hooks"). */
export const ENV_FILE_EVENTS = new Set(["SessionStart", "CwdChanged", "FileChanged"]);

/**
 * THE KINDS OF HOOK EACH EVENT TAKES (Claude Code's "Prompt-based hooks" lists; Coder has no MCP servers, so no mcp_tool):
 * all four on the events that can stop or steer Coder, no agent on PermissionRequest, command and HTTP on the others, and
 * only command on SessionStart ("SessionStart and Setup support command and mcp_tool hooks").
 */
const ALL_TYPES = ["command", "http", "prompt", "agent"];
export function typesFor(event) {
  if (event === "SessionStart") return ["command"];
  if (["PermissionDenied", "PostToolBatch", "PostToolUse", "PostToolUseFailure", "PreToolUse", "Stop", "UserPromptSubmit"].includes(event)) return ALL_TYPES;
  if (event === "PermissionRequest") return ["command", "http", "prompt"];
  return ["command", "http"];
}

/**
 * Claude Code's timeouts, in seconds: "Defaults: 600 for command, http, and mcp_tool; 30 for prompt; 60 for agent. Claude
 * Code lowers the command, http, and mcp_tool default to 30 on UserPromptSubmit"; SessionEnd hooks share a 1.5-second budget
 * (sessionEndBudget). A hook's own `timeout` is kept, up to 600.
 */
export const HOOK_TIMEOUT_S = 600;
export function timeoutFor(event, given, type = "command") {
  const n = Number(given);
  if (Number.isFinite(n) && n > 0) return Math.min(HOOK_TIMEOUT_S, Math.max(1, Math.round(n)));
  if (type === "prompt") return 30;
  if (type === "agent") return 60;
  if (event === "SessionEnd") return 1.5;
  return event === "UserPromptSubmit" ? 30 : HOOK_TIMEOUT_S;
}
/**
 * SESSIONEND'S BUDGET, in seconds (Claude Code: "SessionEnd hooks have a default timeout of 1.5 seconds … The overall budget
 * rises automatically to match the highest per-hook timeout in your settings files, up to 60 seconds"; its
 * CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS, Coder's CODER_SESSIONEND_HOOKS_TIMEOUT_MS, sets it outright).
 */
export function sessionEndBudget(hooks, envMs) {
  const set = Number(envMs);
  if (Number.isFinite(set) && set > 0) return Math.min(600, set / 1000);
  const own = (Array.isArray(hooks) ? hooks : []).filter((h) => h && h.event === "SessionEnd" && h.ownTimeout).map((h) => h.timeout);
  return Math.min(60, Math.max(1.5, ...own));
}
/** "A hook's additionalContext, systemMessage, and initialUserMessage strings, and its plain stdout, are capped at 10,000 characters." */
export const HOOK_TEXT_MAX = 10_000;
/** Claude Code's cap on Stop hooks that keep a turn going: "after stop hooks have continued the turn eight times in a row". */
export const STOP_BLOCK_CAP = 8;
/** The owner's hooks box in Settings: at most this many characters of JSON. */
export const HOOKS_SETTING_MAX = 20_000;
/** How long after a hook's own process exits Coder stops waiting for the rest of its output (Claude Code: "up to 10 seconds"). */
export const HOOK_QUIET_MS = 10_000;
/** An agent hook's turns at most (Claude Code: "After up to 50 turns, the subagent returns a structured { "ok": true/false } decision"). */
export const AGENT_HOOK_TURNS = 50;

/** Coder's tools by Claude Code's names (what a matcher and a hook's `tool_name` see); Coder's own tools keep their names. */
export const CC_TOOL = { bash: "Bash", powershell: "PowerShell", monitor: "Monitor", read: "Read", write: "Write", edit: "Edit", grep: "Grep", glob: "Glob", lsp: "LSP", web_fetch: "WebFetch", stop_job: "TaskStop", ask_user: "AskUserQuestion", exit_plan_mode: "ExitPlanMode", todo: "TodoWrite" };
export const ccTool = (name, monitor = false) => (monitor ? "Monitor" : CC_TOOL[name] || String(name || ""));

const strList = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim()).slice(0, 100) : null);

/**
 * A SETTINGS OBJECT'S HOOKS (Claude Code's shape), each handler on its own line: `{ list, disabled, problems, httpUrls,
 * httpEnvVars }`. A handler: `{ event, matcher, type, timeout, ownTimeout, if, statusMessage, source }` and its kind's own
 * fields: command (`command`, `args`, `async`, `asyncRewake`, `onFailure`), http (`url`, `headers`, `allowedEnvVars`,
 * `onFailure`), prompt (`prompt`, `model`, `continueOnBlock`), agent (`prompt`, `model`). A kind an event doesn't take is named
 * in `problems` and left out, as Claude Code skips it. `source`: "settings" (the owner's) or "project" (the repository's).
 * `httpUrls` and `httpEnvVars`: Claude Code's allowedHttpHookUrls and httpHookAllowedEnvVars, when set.
 */
export function hooksFrom(settings, source = "settings") {
  const out = { list: [], disabled: false, problems: [], httpUrls: null, httpEnvVars: null };
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return out;
  if (settings.disableAllHooks === true) out.disabled = true;
  if (settings.allowedHttpHookUrls !== undefined) out.httpUrls = strList(settings.allowedHttpHookUrls) || [];
  if (settings.httpHookAllowedEnvVars !== undefined) out.httpEnvVars = strList(settings.httpHookAllowedEnvVars) || [];
  const hooks = settings.hooks;
  if (hooks === undefined) return out;
  if (!hooks || typeof hooks !== "object" || Array.isArray(hooks)) { out.problems.push("hooks must be an object of events"); return out; }
  for (const [event, groups] of Object.entries(hooks)) {
    if (!HOOK_EVENTS.includes(event)) { out.problems.push(event + " is not an event Coder has (it has " + HOOK_EVENTS.join(", ") + ")"); continue; }
    if (!Array.isArray(groups)) { out.problems.push(event + " must be a list of matcher groups"); continue; }
    for (const g of groups) {
      if (!g || typeof g !== "object" || !Array.isArray(g.hooks)) { out.problems.push(event + ": each group needs a hooks list"); continue; }
      const matcher = typeof g.matcher === "string" ? g.matcher : "";
      for (const h of g.hooks) {
        if (!h || typeof h !== "object") continue;
        const type = String(h.type || "");
        if (type === "mcp_tool") { out.problems.push(event + ": mcp_tool hooks don't run on Coder (it has no MCP servers)"); continue; }
        if (!ALL_TYPES.includes(type)) { out.problems.push(event + ": a hook's type is command, http, prompt or agent (not " + (type || "no type") + ")"); continue; }
        if (!typesFor(event).includes(type)) { out.problems.push(event + " doesn't take " + type + " hooks"); continue; }
        const base = { event, matcher, type, timeout: timeoutFor(event, h.timeout, type), ...(Number.isFinite(Number(h.timeout)) && Number(h.timeout) > 0 ? { ownTimeout: true } : {}), ...(typeof h.if === "string" && h.if.trim() ? { if: h.if.trim() } : {}), ...(typeof h.statusMessage === "string" && h.statusMessage.trim() ? { statusMessage: h.statusMessage.trim().slice(0, 200) } : {}), source };
        const onFailure = h.onFailure === "block" ? { onFailure: "block" } : {};
        if (type === "command") {
          if (typeof h.command !== "string" || !h.command.trim()) { out.problems.push(event + ": a command hook needs its command"); continue; }
          // (`shell`: bash, or powershell, Claude Code's: "runs that hook in PowerShell. Hooks spawn PowerShell directly, so this
          // works regardless of CLAUDE_CODE_USE_POWERSHELL_TOOL".)
          if (h.shell !== undefined && h.shell !== "bash" && h.shell !== "powershell") { out.problems.push(event + ": a hook's shell is bash or powershell (not " + String(h.shell) + ")"); continue; }
          const args = Array.isArray(h.args) && h.args.every((x) => typeof x === "string") ? h.args : null;
          out.list.push({ ...base, command: h.command, ...(args ? { args } : {}), ...(h.shell === "powershell" && !args ? { shell: "powershell" } : {}), ...(h.async === true ? { async: true } : {}), ...(h.asyncRewake === true ? { asyncRewake: true } : {}), ...onFailure });
        } else if (type === "http") {
          let ok = false;
          try { const u = new URL(String(h.url || "")); ok = u.protocol === "https:" || u.protocol === "http:"; } catch { ok = false; }
          if (!ok) { out.problems.push(event + ": an http hook needs an http or https url"); continue; }
          const headers = h.headers && typeof h.headers === "object" && !Array.isArray(h.headers) ? Object.fromEntries(Object.entries(h.headers).filter(([k, v]) => /^[A-Za-z0-9-]{1,100}$/.test(k) && typeof v === "string").slice(0, 30)) : null;
          out.list.push({ ...base, url: String(h.url), ...(headers ? { headers } : {}), ...(strList(h.allowedEnvVars) ? { allowedEnvVars: strList(h.allowedEnvVars) } : {}), ...onFailure });
        } else {
          if (typeof h.prompt !== "string" || !h.prompt.trim()) { out.problems.push(event + ": a " + type + " hook needs its prompt"); continue; }
          out.list.push({ ...base, prompt: h.prompt.slice(0, 20_000), ...(typeof h.model === "string" && h.model.trim() ? { model: h.model.trim() } : {}), ...(type === "prompt" && h.continueOnBlock === true ? { continueOnBlock: true } : {}) });
        }
      }
    }
  }
  return out;
}

/**
 * THE OWNER'S HOOKS BOX (Settings): the JSON text as typed → `{ ok, value, error }`. It holds Claude Code's settings shape,
 * `{ "hooks": { … } }` (with `disableAllHooks`, `allowedHttpHookUrls` and `httpHookAllowedEnvVars`), or the hooks object
 * alone; empty is none.
 */
const TOP_KEYS = ["hooks", "disableAllHooks", "allowedHttpHookUrls", "httpHookAllowedEnvVars"];
export function hooksSetting(text) {
  const t = String(text ?? "").trim();
  if (!t) return { ok: true, value: null };
  if (t.length > HOOKS_SETTING_MAX) return { ok: false, error: "The hooks are over " + HOOKS_SETTING_MAX.toLocaleString("en-US") + " characters." };
  let v;
  try { v = JSON.parse(t); } catch (e) { return { ok: false, error: "The hooks are not valid JSON: " + String((e && e.message) || e).slice(0, 200) }; }
  if (!v || typeof v !== "object" || Array.isArray(v)) return { ok: false, error: "The hooks must be a JSON object, as in Claude Code's settings: { \"hooks\": { \"PreToolUse\": [ … ] } }." };
  const settings = TOP_KEYS.some((k) => v[k] !== undefined) ? v : { hooks: v };
  const r = hooksFrom(settings, "settings");
  if (r.problems.length) return { ok: false, error: r.problems[0] + "." };
  const value = {};
  for (const k of TOP_KEYS) if (settings[k] !== undefined && (k !== "disableAllHooks" || settings[k] === true)) value[k] = settings[k];
  return { ok: true, value };
}

/**
 * Claude Code's matcher: "*", "" or none matches all; only letters, digits, _, -, spaces, `,` and `|`: one exact name or a
 * list; anything else: a JavaScript regular expression, unanchored. `narrow` (FileChanged, StopFailure): only letters, digits,
 * _ and | stay exact names.
 */
export function matcherMatches(matcher, value, narrow = false) {
  const m = matcher === undefined || matcher === null ? "" : String(matcher);
  if (m === "" || m === "*") return true;
  if (narrow ? /^[A-Za-z0-9_|]+$/.test(m) : /^[A-Za-z0-9_\- ,|]+$/.test(m)) return m.split(narrow ? /\|/ : /[|,]/).map((x) => x.trim()).filter(Boolean).includes(String(value));
  try { return new RegExp(m).test(String(value)); } catch { return false; }
}

/** One handler's key, for "If you define the same handler in more than one settings file, it runs once". */
const handlerKey = (h) => h.type + "\u0000" + (h.type === "command" ? h.command + "\u0000" + JSON.stringify(h.args || null) : h.type === "http" ? h.url : h.prompt);

/**
 * THE HOOKS THAT RUN FOR ONE EVENT, deduplicated: `value` is what the matcher filters (a tool's name, how a session started,
 * what started a summary, a changed file's name, an error's type); for a tool event, `call` `{ tool, input, ctx }` for `if`
 * ("On other events, a hook with if set never runs"). A Bash matcher also fires on a Monitor's command, on PreToolUse and
 * PermissionRequest.
 */
export function hooksFor(all, event, value = "", call = null) {
  const seen = new Set(), out = [];
  for (const h of Array.isArray(all) ? all : []) {
    if (!h || h.event !== event) continue;
    if (!NO_MATCHER.has(event) && !matcherMatches(h.matcher, value, NARROW.has(event)) && !(value === "Monitor" && (event === "PreToolUse" || event === "PermissionRequest") && matcherMatches(h.matcher, "Bash"))) continue;
    if (h.if) {
      if (!TOOL_EVENTS.has(event) || !call) continue;
      const tool = call.tool === "Monitor" && /^Bash\(/.test(h.if) ? "Bash" : call.tool;
      if (!ifRuleMatches(h.if, tool, call.input, call.ctx || {})) continue;
    }
    const key = handlerKey(h);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}

/**
 * THE FILES FILECHANGED HOOKS WATCH, from their matchers (Claude Code: "the value is split on | and each segment is registered
 * as a literal filename in the working directory"; an omitted matcher adds nothing, a "*" registers itself).
 */
export function watchedNames(all) {
  const out = new Set();
  for (const h of Array.isArray(all) ? all : []) if (h && h.event === "FileChanged" && h.matcher) for (const n of h.matcher.split("|").map((x) => x.trim()).filter(Boolean)) out.add(n);
  return [...out].slice(0, 200);
}

/** A tool call's input as a hook sees it: Coder's own, and Claude Code's names beside them (`file_path`). */
export function hookToolInput(name, args) {
  const a = args && typeof args === "object" ? { ...args } : {};
  if ((name === "read" || name === "write" || name === "edit" || name === "lsp") && typeof a.path === "string" && a.file_path === undefined) a.file_path = a.path;
  return a;
}
/** A hook's `updatedInput` as Coder's tool takes it (`file_path` back to `path`). */
export function toolInputFromHook(name, input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const a = { ...input };
  if ((name === "read" || name === "write" || name === "edit" || name === "lsp") && typeof a.file_path === "string") { a.path = a.file_path; delete a.file_path; }
  return a;
}

/**
 * A hook's name in a message: `[<command>]`, as Claude Code names a command hook ("PreToolUse:Bash hook error:
 * [${CLAUDE_PROJECT_DIR}/.claude/hooks/no-rm.sh]: …"); its address for an HTTP hook, "prompt" or "agent" for the others.
 */
export const hookName = (h) => "[" + (h.type === "http" ? String(h.url) : h.type === "prompt" || h.type === "agent" ? h.type : String(h.command) + (h.args && h.args.length ? " " + h.args.join(" ") : "")) + "]";
const cap = (s) => { const t = String(s ?? ""); return t.length > HOOK_TEXT_MAX ? t.slice(0, 2000) + "\n… (" + (t.length - 2000).toLocaleString("en-US") + " more characters left out)" : t; };
const BLOCK_FAIL = 'blocking because onFailure is "block"';

/** Stdout as Claude Code reads it: one JSON object "with nothing around it but whitespace", else plain text (or a parse failure). */
function readStdout(stdout) {
  const t = String(stdout || "").trim();
  if (!(t.startsWith("{") && t.endsWith("}"))) return { json: null, bad: "" };
  try { const v = JSON.parse(t); return v && typeof v === "object" && !Array.isArray(v) ? { json: v, bad: "" } : { json: null, bad: "not a JSON object" }; } catch (e) { return { json: null, bad: String((e && e.message) || e).slice(0, 200) }; }
}
/** Whether an answer "grants, rewrites or injects" (Claude Code's words): an allow, a new input or output, added context. */
const grants = (j) => {
  if (!j) return false;
  const sp = j.hookSpecificOutput && typeof j.hookSpecificOutput === "object" ? j.hookSpecificOutput : {};
  const dec = sp.decision && typeof sp.decision === "object" ? sp.decision : {};
  return sp.permissionDecision === "allow" || j.decision === "approve" || dec.behavior === "allow" || sp.updatedInput !== undefined || dec.updatedInput !== undefined || sp.updatedToolOutput !== undefined || (typeof sp.additionalContext === "string" && sp.additionalContext.trim() !== "");
};
/** Claude Code's words for a capture it will not believe (its hook runner, 2.1.322). */
export const QUIET_GRANT = "hook output parsed as a document that grants, rewrites or injects, but its stdio went quiet before end-of-stream and a dropped later document could have changed it; refusing to honor the suspect capture";
export const QUIET_PARTIAL = "hook output opens a JSON payload that never completed before its stdio went quiet; refusing to read the partial capture as a verdict";

/**
 * WHAT ONE RUN SAYS (Claude Code's table, "To find your hook's outcome … match what it printed to stdout … with its exit code"):
 * `run` `{ code, stdout, stderr, timedOut, quiet }` (a command hook's; an HTTP hook's `{ http: { status, body, error },
 * timedOut }`; a prompt or agent hook's `{ verdict: { ok, reason, impossible } }` or `{ error }`) → `{ kind: "ok" | "block" |
 * "error", json, text, reason, notice, verdict?, failBlock? }`. Exit 2 blocks, its stderr the reason; another code with valid
 * JSON is a success, with plain text a non-blocking error ("Failed with non-blocking status code: <first line of stderr>"); a
 * hook that timed out says nothing. `hook.onFailure` "block": a failure does what exit 2 does (`failBlock`), in Claude Code's
 * words ("failed; blocking because onFailure is "block"", "timed out; …"), except on Stop. A hook that left a program
 * holding its output (`quiet`: Coder stopped waiting 10 seconds after it ended) is not believed when it grants, rewrites or
 * injects (QUIET_GRANT), or printed JSON cut short (QUIET_PARTIAL).
 */
export function hookResult(event, run, hook = {}) {
  const blocks = hook.onFailure === "block" && event !== "Stop" && !hook.async && !hook.asyncRewake;
  const fail = (what, more = "") => blocks ? { kind: "block", json: null, text: "", reason: cap(what + "; " + BLOCK_FAIL + (more ? "\n" + more : "")), notice: "", failBlock: true } : null;
  // A hook that was not run (an HTTP hook to an address allowedHttpHookUrls leaves out).
  if (run && typeof run.notRun === "string") return { kind: "error", json: null, text: "", reason: "", notice: run.notRun };
  // A prompt or agent hook: its model's answer.
  if (hook.type === "prompt" || hook.type === "agent") {
    if (run.timedOut) return { kind: "error", json: null, text: "", reason: "", notice: "Timed out" };
    if (!run || !run.verdict) return { kind: "error", json: null, text: "", reason: "", notice: String((run && run.error) || "The model gave no answer").slice(0, 300) };
    return { kind: "ok", json: null, text: "", reason: "", notice: "", verdict: { ok: run.verdict.ok === true, reason: cap(String(run.verdict.reason || "")), impossible: run.verdict.impossible === true } };
  }
  // An HTTP hook (Claude Code's "HTTP response handling").
  if (run && run.http) {
    if (run.timedOut) return fail("timed out") || { kind: "error", json: null, text: "", reason: "", notice: "Timed out" };
    const { status, body, error } = run.http;
    if (error) return fail("failed", String(error)) || { kind: "error", json: null, text: "", reason: "", notice: "Request failed: " + String(error).slice(0, 200) };
    if (!(status >= 200 && status < 300)) return fail("failed", "HTTP " + status) || { kind: "error", json: null, text: "", reason: "", notice: "Request failed with status " + status };
    const t = String(body || "").trim();
    if (!t) return { kind: "ok", json: null, text: "", reason: "", notice: "" };
    const { json, bad } = readStdout(t);
    if (json) return { kind: "ok", json, text: "", reason: "", notice: "" };
    return fail("failed", bad || "the response was not a JSON object") || { kind: "error", json: null, text: "", reason: "", notice: bad ? "Hook output is not valid JSON: " + bad : "The response was not a JSON object" };
  }
  const code = run && Number.isInteger(run.code) ? run.code : -1;
  const stdout = String((run && run.stdout) || ""), stderr = String((run && run.stderr) || "");
  if (run && run.timedOut) return fail("timed out") || { kind: "error", json: null, text: "", reason: "", notice: "Timed out" };
  const { json, bad } = readStdout(stdout);
  // A HOOK WHOSE OUTPUT WENT QUIET BEFORE IT ENDED (a program it started still holds it): what it said is not believed when
  // it grants, rewrites or injects, or is JSON cut short, and that counts as exit 2 does.
  if (run && run.quiet && code !== 2) {
    if (json && grants(json)) return { kind: "block", json: null, text: "", reason: QUIET_GRANT, notice: "" };
    if (!json && String(stdout).trim().startsWith("{")) return { kind: "block", json: null, text: "", reason: QUIET_PARTIAL, notice: "" };
  }
  const text = json || bad ? "" : stdout;
  const firstErr = stderr.split("\n").map((l) => l.trim()).find(Boolean) || "";
  if (code === 2) return { kind: "block", json, text: "", reason: cap(stderr.trim()), notice: "" };
  if (bad) return fail("failed", "Hook output is not valid JSON: " + bad) || { kind: "error", json: null, text: "", reason: "", notice: "Hook output is not valid JSON: " + bad };
  if (code !== 0) { const f = fail("failed", stderr.trim()); if (f) return f; }
  if (code === 0 || json) return { kind: "ok", json, text: cap(text), reason: "", notice: "" };
  return { kind: "error", json: null, text: "", reason: "", notice: "Failed with non-blocking status code: " + firstErr };
}

/**
 * ALL OF AN EVENT'S RUNS, TOGETHER (`runs` `[{ hook, result }]`): what Coder does next.
 *   stop        { reason } when one said "continue": false ("Claude stops processing entirely"), its stopReason
 *   decision    PreToolUse: "deny" | "ask" | "allow" | "" ("precedence is deny > defer > ask > allow"; exit 2 is a deny);
 *               PermissionRequest: "allow" | "deny" | ""; UserPromptSubmit, PostToolUse(Failure), PostToolBatch, Stop,
 *               PreCompact: "block" | ""
 *   reason      the decision's reason, in Claude Code's words for a block by exit 2 ("<Event>:<Tool> hook error: [cmd]: …")
 *   endTurn     a prompt hook's ok: false where Claude Code ends the turn ("the turn ends and the reason appears in the chat as a
 *               warning line"): its reason
 *   updatedInput, updatedOutput   PreToolUse's new input; PostToolUse's new output (a string, or Bash's { stdout })
 *   context     additionalContext strings, and plain stdout on UserPromptSubmit and SessionStart (and PreCompact's, as instructions)
 *   messages    systemMessage strings, for the owner
 *   notices     "<Event> hook error" lines for the owner (non-blocking errors)
 *   watchPaths  absolute paths FileChanged hooks watch from now on (SessionStart, CwdChanged, FileChanged), or null
 *   sessionTitle  the chat's new title (SessionStart, UserPromptSubmit), or ""
 *   retry       PermissionDenied: Coder may try the call again
 */
export function hooksOutcome(event, runs, { tool = "" } = {}) {
  const label = event + (tool && TOOL_EVENTS.has(event) ? ":" + tool : "");
  const out = { stop: null, decision: "", reason: "", endTurn: "", updatedInput: null, updatedOutput: undefined, context: [], messages: [], notices: [], blocks: [], watchPaths: null, sessionTitle: "", retry: false };
  // (StopFailure and SessionEnd: "Claude Code ignores the hook's output and exit code"; "discards their JSON output fields".)
  if (event === "StopFailure" || event === "SessionEnd") return out;
  const rank = { deny: 4, ask: 2, allow: 1, "": 0 };
  for (const { hook, result } of Array.isArray(runs) ? runs : []) {
    if (!result) continue;
    if (result.kind === "error") { if (event !== "Notification") out.notices.push(label + " hook error: " + hookName(hook) + ": " + result.notice); continue; }
    // A PROMPT OR AGENT HOOK'S VERDICT (Claude Code's "Response schema"; an agent hook as a prompt hook with continueOnBlock).
    if (result.verdict) {
      const v = result.verdict;
      if (v.ok) continue;
      const why = v.reason || "(no reason given)";
      const goOn = hook.type === "agent" || hook.continueOnBlock === true;
      const line = label + " hook (" + hook.type + "): " + why;
      if (event === "Stop") { if (!v.impossible) { out.decision = "block"; out.blocks.push(line); out.reason = out.reason || why; } }
      else if (event === "PreToolUse") { out.decision = "deny"; out.reason = line; out.blocks.push(line); if (!goOn) out.endTurn = out.endTurn || why; }
      else if (event === "PostToolUse") { if (goOn) { out.decision = "block"; out.blocks.push(line); out.reason = out.reason || why; } else out.endTurn = out.endTurn || why; }
      else if (event === "PostToolUseFailure") { out.decision = "block"; out.blocks.push(line); out.reason = out.reason || why; }
      else if (event === "PostToolBatch" || event === "UserPromptSubmit") { out.decision = "block"; out.blocks.push(line); out.reason = out.reason || why; out.endTurn = out.endTurn || why; }
      continue;
    }
    const j = result.json || {};
    const spec = j.hookSpecificOutput && typeof j.hookSpecificOutput === "object" ? j.hookSpecificOutput : {};
    // (CwdChanged and FileChanged: "Claude Code reads watchPaths and systemMessage from their JSON output and discards continue".)
    const observe = event === "CwdChanged" || event === "FileChanged";
    if (j.continue === false && !observe && event !== "Notification") out.stop = out.stop || { reason: typeof j.stopReason === "string" ? cap(j.stopReason) : "" };
    if (typeof j.systemMessage === "string" && j.systemMessage.trim() && event !== "Notification") out.messages.push(cap(j.systemMessage));
    const wp = Array.isArray(spec.watchPaths) ? spec.watchPaths : Array.isArray(j.watchPaths) ? j.watchPaths : null;
    if (wp && (event === "SessionStart" || observe)) out.watchPaths = [...(out.watchPaths || []), ...wp.filter((p) => typeof p === "string" && p.startsWith("/") && p.length < 4096)].slice(0, 200);
    if (observe) continue;
    if (typeof spec.sessionTitle === "string" && spec.sessionTitle.trim() && (event === "SessionStart" || event === "UserPromptSubmit")) out.sessionTitle = spec.sessionTitle.trim().slice(0, 200);
    if (typeof spec.additionalContext === "string" && spec.additionalContext.trim()) out.context.push(cap(spec.additionalContext));
    if (result.text && result.text.trim() && (event === "UserPromptSubmit" || event === "SessionStart" || event === "PreCompact")) out.context.push(cap(result.text.trim()));
    const blockBy = (why) => { out.blocks.push(label + " hook " + (result.kind === "block" ? "error" : "blocking error from command") + ": " + hookName(hook) + ": " + (why || "(no reason given)")); };
    if (event === "PermissionDenied") { if (spec.retry === true) out.retry = true; continue; }
    if (event === "PreToolUse") {
      let d = typeof spec.permissionDecision === "string" ? spec.permissionDecision : j.decision === "approve" ? "allow" : j.decision === "block" ? "deny" : "";
      if (d === "defer") d = "deny";
      if (result.kind === "block") d = "deny";
      const why = typeof spec.permissionDecisionReason === "string" ? spec.permissionDecisionReason : typeof j.reason === "string" ? j.reason : "";
      if (d === "deny") blockBy(result.kind === "block" ? (result.failBlock ? result.reason : why || result.reason) : why);
      if (rank[d] !== undefined && rank[d] > rank[out.decision]) { out.decision = d; out.reason = d === "deny" ? out.blocks[out.blocks.length - 1] : cap(why); }
      if (spec.updatedInput && typeof spec.updatedInput === "object" && !Array.isArray(spec.updatedInput) && d !== "deny") out.updatedInput = spec.updatedInput;
      continue;
    }
    if (event === "PermissionRequest") {
      // (Exit 2 "isn't honored for this event"; a failure with onFailure "block" "denies the request".)
      if (result.failBlock) { out.decision = "deny"; out.reason = result.reason; continue; }
      const dec = spec.decision && typeof spec.decision === "object" ? spec.decision : {};
      if (dec.behavior === "deny") { out.decision = "deny"; out.reason = typeof dec.message === "string" ? cap(dec.message) : ""; if (dec.interrupt === true) out.stop = out.stop || { reason: out.reason }; }
      else if (dec.behavior === "allow" && out.decision !== "deny") { out.decision = "allow"; if (dec.updatedInput && typeof dec.updatedInput === "object") out.updatedInput = dec.updatedInput; }
      continue;
    }
    if (event === "PostToolUse" && spec.updatedToolOutput !== undefined) {
      const u = spec.updatedToolOutput;
      if (typeof u === "string") out.updatedOutput = u;
      else if (u && typeof u === "object" && typeof u.stdout === "string") out.updatedOutput = u.stdout + (typeof u.stderr === "string" && u.stderr ? "\n" + u.stderr : "");
    }
    // A BLOCK: exit 2, or decision "block" (UserPromptSubmit, PostToolUse, PostToolUseFailure, PostToolBatch, Stop, PreCompact).
    if (result.kind === "block" || j.decision === "block") {
      const why = typeof j.reason === "string" && j.reason.trim() ? cap(j.reason) : result.reason;
      if (event === "SessionStart" || event === "PostCompact") { if (result.kind === "block") out.notices.push(label + " hook error: " + hookName(hook) + ": " + (result.reason || "(no reason given)")); continue; }
      if (event === "Notification") continue;
      out.decision = "block";
      blockBy(why);
      out.reason = out.reason || why;
    }
  }
  return out;
}

/**
 * WHAT A BACKGROUND HOOK GIVES CODER when it is done (Claude Code: an async hook's "additionalContext and systemMessage fields …
 * to Claude on the next conversation turn … neither field is shown to you"; an asyncRewake hook that "exits with code 2 wakes
 * Claude immediately … The hook's stderr, or stdout if stderr is empty, is shown to Claude"): the texts, or [].
 */
export function asyncHookTexts(hook, run) {
  const code = run && Number.isInteger(run.code) ? run.code : -1;
  const stdout = String((run && run.stdout) || ""), stderr = String((run && run.stderr) || "");
  if (hook.asyncRewake && code === 2) return [cap((stderr.trim() || stdout.trim() || "(no output)"))];
  // (Its JSON alone on stdout, or on one line of its own.)
  let { json } = readStdout(stdout);
  if (!json) for (const l of stdout.split("\n").reverse()) { const r = readStdout(l); if (r.json) { json = r.json; break; } }
  if (!json) return [];
  const spec = json.hookSpecificOutput && typeof json.hookSpecificOutput === "object" ? json.hookSpecificOutput : {};
  return [spec.additionalContext, json.systemMessage].filter((x) => typeof x === "string" && x.trim()).map(cap);
}

/**
 * A PROMPT OR AGENT HOOK'S QUESTION (Claude Code: "Use $ARGUMENTS as a placeholder for the hook input JSON. Escape with a
 * backslash to include literal text: \$1.00 renders as $1.00"; "If $ARGUMENTS is not present, input JSON is appended to the
 * prompt").
 */
export function hookPrompt(prompt, input) {
  const json = JSON.stringify(input);
  const p = String(prompt);
  let used = false;
  const out = p.replace(/\\\$|\$ARGUMENTS/g, (m) => { if (m === "\\$") return "$"; used = true; return json; });
  return used ? out : out + "\n\n" + json;
}
/** The instructions a prompt or agent hook's model answers by (Claude Code's response schema). */
export const HOOK_JUDGE = "You check one moment of an AI coding agent's work for its owner, by the owner's rule below. Answer with one JSON object and nothing else: {\"ok\": true} when the rule allows it or the condition holds, or {\"ok\": false, \"reason\": \"<one or two sentences>\"} when it does not" + ", adding \"impossible\": true when the condition can never be met.";
/** A prompt or agent hook's answer read: `{ ok, reason, impossible }`, or null when it isn't one. */
export function parseHookVerdict(text) {
  const t = String(text || "");
  const m = /\{[\s\S]*\}/.exec(t);
  if (!m) return null;
  try { const v = JSON.parse(m[0]); return v && typeof v.ok === "boolean" ? { ok: v.ok, reason: typeof v.reason === "string" ? v.reason : "", impossible: v.impossible === true } : null; } catch { return null; }
}

/** Whether an HTTP hook may send to a web address (Claude Code's allowedHttpHookUrls: "* as a wildcard"; none set: any). */
export function httpUrlAllowed(url, patterns) {
  if (!Array.isArray(patterns)) return true;
  let u;
  try { u = new URL(String(url)); } catch { return false; }
  const norm = (x) => x.replace(/^(https?:\/\/)([^/:]+)\.(?=[:/]|$)/i, "$1$2");
  const target = norm(u.protocol + "//" + u.host.toLowerCase() + u.pathname + u.search);
  return patterns.some((p) => { try { return new RegExp("^" + norm(String(p)).split("*").map((x) => x.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$", "i").test(target); } catch { return false; } });
}

/**
 * A MODEL ERROR'S KIND, as StopFailure hooks match it (Claude Code: "rate_limit, overloaded, authentication_failed,
 * billing_error, invalid_request, model_not_found, server_error, max_output_tokens, unknown"), from its HTTP status.
 */
export function stopFailureKind(e) {
  const st = Number(e && e.status) || Number((/\b(\d{3})\b/.exec(String((e && e.message) || "")) || [])[1]) || 0;
  if (st === 429) return "rate_limit";
  if (st === 529 || st === 503) return "overloaded";
  if (st === 401 || st === 403) return "authentication_failed";
  if (st === 402) return "billing_error";
  if (st === 404) return "model_not_found";
  if (st === 400 || st === 413 || st === 422) return "invalid_request";
  if (st >= 500) return "server_error";
  return "unknown";
}

/**
 * A COMMAND HOOK AS THE SHELL RUNS IT: the event's JSON on its stdin (a file Coder's machine writes, named where @REQUEST
 * is), its stderr kept apart after `mark`, Claude Code's variables set (CLAUDE_PROJECT_DIR, CLAUDE_CODE_REMOTE; the folder of
 * CLAUDE_ENV_FILE made when the event has one). With `args`, each one a word of its own ("Exec form").
 */
const shq = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";
export function hookShell(h, mark, root) {
  // (A PowerShell hook: pwsh with no profile, non-interactive, the command encoded, its stdin the event's JSON.)
  const cmd = Array.isArray(h.args) ? [h.command, ...h.args].map(shq).join(" ") : h.shell === "powershell" ? "pwsh -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand " + utf16Base64(String(h.command)) : String(h.command);
  return "__in='@REQUEST'; __in=\"${__in#@}\"; __err=\"$(mktemp 2>/dev/null || echo /tmp/coder-hook-$$)\"; if [ -n \"${CLAUDE_ENV_FILE:-}\" ]; then mkdir -p \"${CLAUDE_ENV_FILE%/*}\" 2>/dev/null; fi; export CLAUDE_PROJECT_DIR=" + shq(root) + " CODER_PROJECT_DIR=" + shq(root) + " CLAUDE_CODE_REMOTE=true; (\n" + cmd + "\n) < \"$__in\" 2>\"$__err\"; __code=$?; printf '\\n%s\\n' '" + mark + "'; cat \"$__err\" 2>/dev/null; rm -f \"$__err\"; exit $__code";
}
/** A command hook's output split at its `mark`: `{ stdout, stderr }` (a background one's file ends with Coder's own line). */
export function splitHookOut(out, mark) {
  const s = String(out || "");
  const k = s.lastIndexOf("\n" + mark + "\n");
  const err = k >= 0 ? s.slice(k + mark.length + 2) : "";
  return { stdout: k >= 0 ? s.slice(0, k) : s, stderr: err.replace(/\n?\[finished, exit code -?\d+\]\n*$/, "") };
}

/** The input every hook gets (Claude Code's common fields), with the event's own. */
export function hookInput(event, { session = "", cwd = "", mode = "auto", effort = "" } = {}, extra = {}) {
  return { session_id: String(session), cwd: String(cwd), permission_mode: String(mode), hook_event_name: event, ...(effort ? { effort: { level: String(effort) } } : {}), ...extra };
}
