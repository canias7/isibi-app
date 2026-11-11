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
import { bashResultText } from "./coder-checks.mjs";

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
 * (sessionEndBudget). A hook's own `timeout` is kept as given, as in Claude Code (600 is its default, not a cap: Bash docs
 * pass 9); only past a day is it cut, where a timer could no longer hold it (the job's own limit comes long before).
 */
export const HOOK_TIMEOUT_S = 600, HOOK_TIMEOUT_MAX_S = 86_400;
export function timeoutFor(event, given, type = "command") {
  const n = Number(given);
  if (Number.isFinite(n) && n > 0) return Math.min(HOOK_TIMEOUT_MAX_S, Math.max(1, Math.round(n)));
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
/**
 * A HOOK'S TEXT PAST 10,000 CHARACTERS, SAVED (Bash docs pass 9; Claude Code's hooks reference: "except for PreCompact stdout,
 * Claude Code saves the output to a file in the session directory. It replaces the output with the file path and a preview of
 * up to the first 2,000 characters. A large valid Bash result is handled the same way"): a run's plain stdout, measured whole,
 * and its JSON's additionalContext and systemMessage, each on its own, saved with `save(text)` (it answers the file's path)
 * and replaced by Claude Code's saved-output form. One that could not be saved is cut as before.
 */
export function persistHookText(event, run, save) {
  if (!run || typeof save !== "function" || typeof run.stdout !== "string") return run;
  const big = (t) => typeof t === "string" && t.length > HOOK_TEXT_MAX;
  const keep = (t) => { let f = ""; try { f = String(save(t) || ""); } catch { f = ""; } return f ? bashResultText({ output: t, size: Buffer.byteLength(t), file: f, inlineMax: HOOK_TEXT_MAX }) : t; };
  const t = run.stdout.trim();
  if (t.startsWith("{") && t.endsWith("}")) {
    let v = null;
    try { v = JSON.parse(t); } catch { v = null; }
    if (!v || typeof v !== "object" || Array.isArray(v)) return run;
    let changed = false;
    const fix = (o, k) => { if (o && typeof o === "object" && big(o[k])) { o[k] = keep(o[k]); changed = true; } };
    fix(v, "systemMessage");
    fix(v.hookSpecificOutput, "additionalContext");
    return changed ? { ...run, stdout: JSON.stringify(v) } : run;
  }
  return big(run.stdout) && event !== "PreCompact" ? { ...run, stdout: keep(run.stdout) } : run;
}
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
// (The same handler is its type, what it runs, and its `if` and shell: two with the same command under different `if` values
// are two handlers, and each runs when it matches; Claude Code: "If you define the same handler in more than one settings
// file, it runs once". Bash docs pass 9.)
const handlerKey = (h) => h.type + "\u0000" + (h.type === "command" ? h.command + "\u0000" + JSON.stringify(h.args || null) : h.type === "http" ? h.url : h.prompt) + "\u0000" + String(h.if || "") + "\u0000" + String(h.shell || "");

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
    // A BASH MATCHER ON A MONITOR'S COMMAND (Bash docs pass 8; Claude Code 2.1.314: "A PreToolUse or PermissionRequest hook
    // with a Bash matcher also runs on shell commands Claude starts with the Monitor tool, but its allow and updatedInput
    // have no effect on them"; it "gets a Bash call"; it "doesn't run for a WebSocket watch", nor "if its if names Monitor").
    const own = NO_MATCHER.has(event) || matcherMatches(h.matcher, value, NARROW.has(event));
    const viaBash = !own && value === "Monitor" && (event === "PreToolUse" || event === "PermissionRequest") && matcherMatches(h.matcher, "Bash");
    if (!own && !viaBash) continue;
    if (viaBash && call && call.ws) continue;
    let noGrant = viaBash;
    if (h.if) {
      if (!TOOL_EVENTS.has(event) || !call) continue;
      const named = (/^([A-Za-z_][A-Za-z0-9_-]*)/.exec(String(h.if).trim()) || [])[1] || "";
      if (viaBash && named === "Monitor") continue;
      // (A matcher that includes Monitor with an `if` naming Bash: the Monitor call's input, its command matched the Bash
      // way, "but allow and updatedInput have no effect".)
      const tool = call.tool === "Monitor" && named === "Bash" ? "Bash" : call.tool;
      if (!ifRuleMatches(h.if, tool, call.input, call.ctx || {})) continue;
      if (call.tool === "Monitor" && named === "Bash") noGrant = true;
    }
    const key = handlerKey(h);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(viaBash ? { ...h, asBash: true, noGrant: true } : noGrant ? { ...h, noGrant: true } : h);
  }
  return out;
}
/**
 * A RULE AS A PERMISSION UPDATE ENTRY HAS IT (Bash docs pass 8; Claude Code: "rules is an array of {toolName, ruleContent?}
 * objects"; "Bash or Bash(*): { toolName: \"Bash\" }, because both match the whole tool"), and back.
 */
export function ruleEntry(rule) {
  const m = /^([A-Za-z_][A-Za-z0-9_-]*)(?:\(([\s\S]*)\))?$/.exec(String(rule || "").trim());
  if (!m) return null;
  return m[2] === undefined || m[2].trim() === "*" || m[2].trim() === "" ? { toolName: m[1] } : { toolName: m[1], ruleContent: m[2] };
}
export function entryRule(e) {
  if (!e || typeof e !== "object" || typeof e.toolName !== "string" || !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(e.toolName)) return "";
  return typeof e.ruleContent === "string" && e.ruleContent.trim() ? e.toolName + "(" + e.ruleContent + ")" : e.toolName;
}
/** A Monitor call's input as a Bash matcher's hook gets it: a Bash call (Claude Code 2.1.314). */
export function asBashInput(input) {
  const ti = input && input.tool_input && typeof input.tool_input === "object" ? input.tool_input : {};
  return { ...input, tool_name: "Bash", tool_input: { command: String(ti.command || ""), ...(typeof ti.description === "string" ? { description: ti.description } : {}), run_in_background: true } };
}
/** A hook's answer with its allow and updatedInput taken out ("have no effect"), its deny and ask kept. */
export function withoutGrant(event, result) {
  if (!result || !result.json || typeof result.json !== "object") return result;
  const j = { ...result.json };
  if (j.hookSpecificOutput && typeof j.hookSpecificOutput === "object") {
    const spec = { ...j.hookSpecificOutput };
    delete spec.updatedInput;
    if (event === "PreToolUse" && spec.permissionDecision === "allow") delete spec.permissionDecision;
    if (event === "PermissionRequest" && spec.decision && typeof spec.decision === "object" && spec.decision.behavior === "allow") delete spec.decision;
    j.hookSpecificOutput = spec;
  }
  if (j.decision === "approve" || j.decision === "allow") delete j.decision;
  return { ...result, json: j };
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

/**
 * A tool call's input as a hook sees it: Coder's own, and Claude Code's names beside them (`file_path`; for the question
 * card, AskUserQuestion's `questions` list, each question with `multiSelect`).
 */
export function hookToolInput(name, args) {
  const a = args && typeof args === "object" ? { ...args } : {};
  if ((name === "read" || name === "write" || name === "edit" || name === "lsp") && typeof a.path === "string" && a.file_path === undefined) a.file_path = a.path;
  if (name === "ask_user") {
    // (The single question of before, as Claude Code's list of one.)
    if (!(Array.isArray(a.questions) && a.questions.length) && a.question !== undefined) a.questions = [{ question: a.question, header: a.header, options: a.options, multi_select: a.multi_select }];
    if (Array.isArray(a.questions)) a.questions = a.questions.map((q) => (q && typeof q === "object" && !Array.isArray(q) && q.multiSelect === undefined ? { ...q, multiSelect: q.multi_select === true } : q));
  }
  return a;
}
/** A hook's `updatedInput` as Coder's tool takes it (`file_path` back to `path`, `multiSelect` back to `multi_select`). */
export function toolInputFromHook(name, input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const a = { ...input };
  if ((name === "read" || name === "write" || name === "edit" || name === "lsp") && typeof a.file_path === "string") { a.path = a.file_path; delete a.file_path; }
  if (name === "ask_user" && Array.isArray(a.questions)) a.questions = a.questions.map((q) => { if (!q || typeof q !== "object" || Array.isArray(q) || q.multiSelect === undefined) return q; const o = { ...q }; if (typeof o.multiSelect === "boolean") o.multi_select = o.multiSelect; delete o.multiSelect; return o; });
  return a;
}

// A HOOK ANSWERS CODER'S QUESTION CARD (Claude Code's AskUserQuestion with a PreToolUse hook's "allow" and updatedInput:
// "echo back the original questions array and add an answers object mapping each question's text to the chosen answer";
// `answers`: "Maps question text to the selected option label. Multi-select answers join labels with commas").
const NOTES_ONLY = "(notes only)";
const ownKey = (o, k) => (o && typeof o === "object" && !Array.isArray(o) && Object.hasOwn(o, k) ? o[k] : undefined);
const kindOf = (v) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v);
/** Labels joined as Claude Code joins a multi-select answer: ", " between them, a label with ", " or a quote in quotes. */
export const joinLabels = (labels) => labels.map((t) => (t.includes(", ") || t.includes('"') ? JSON.stringify(t) : t)).join(", ");
/** A multi-select answer split back into its labels, as Claude Code splits one (null when it is not a list of labels). */
export function splitLabels(s) {
  const out = [];
  let n = String(s);
  for (;;) {
    if (n.startsWith('"')) {
      let end = -1, esc = false;
      for (let i = 1; i < n.length; i++) { const ch = n[i]; if (esc) { esc = false; continue; } if (ch === "\\") { esc = true; continue; } if (ch === '"') { end = i; break; } }
      if (end === -1) return null;
      try { const v = JSON.parse(n.slice(0, end + 1)); if (typeof v !== "string") return null; out.push(v); } catch { return null; }
      n = n.slice(end + 1);
    } else {
      const at = n.indexOf(", "), part = at === -1 ? n : n.slice(0, at);
      if (part.includes('"')) return null;
      out.push(part);
      n = at === -1 ? "" : n.slice(at);
    }
    if (n === "") break;
    if (!n.startsWith(", ")) return null;
    n = n.slice(2);
    if (n === "") return null;
  }
  return out;
}
/**
 * A hook's answers (and notes) for the question card, checked as Claude Code checks AskUserQuestion's input: `answers`
 * maps a question's text to a label (a list of labels is joined with ", "), `annotations` maps it to { notes, preview }.
 * Returns { answers, annotations }, or { problem }: Claude Code's refusal of a hook's rewrite that fails the tool's schema.
 */
export function hookAnswers(input) {
  const issues = [];
  const typeIssue = (param, expected, got) => issues.push("The parameter `" + param + "` type is expected as `" + expected + "` but provided as `" + got + "`");
  let answers, annotations;
  const a = input && typeof input === "object" ? input : {};
  if (a.answers !== undefined) {
    if (kindOf(a.answers) !== "object") typeIssue("answers", "record", kindOf(a.answers));
    else {
      answers = {};
      for (const [k, v] of Object.entries(a.answers)) {
        const j = Array.isArray(v) && v.every((x) => typeof x === "string") ? v.join(", ") : v;
        if (typeof j === "string") answers[k] = j; else typeIssue("answers." + k, "string", kindOf(v));
      }
    }
  }
  if (a.annotations !== undefined) {
    if (kindOf(a.annotations) !== "object") typeIssue("annotations", "record", kindOf(a.annotations));
    else {
      annotations = {};
      for (const [k, v] of Object.entries(a.annotations)) {
        if (kindOf(v) !== "object") { typeIssue("annotations." + k, "object", kindOf(v)); continue; }
        const o = {};
        for (const f of ["preview", "notes"]) if (v[f] !== undefined) { if (typeof v[f] === "string") o[f] = v[f]; else typeIssue("annotations." + k + "." + f, "string", kindOf(v[f])); }
        annotations[k] = o;
      }
    }
  }
  if (issues.length) return { problem: "PreToolUse hook for AskUserQuestion returned updatedInput that failed schema validation: AskUserQuestion failed due to the following " + (issues.length > 1 ? "issues" : "issue") + ": " + issues.join("\n") + " The tool input from the model was valid; the hook's rewrite of it was not." };
  return { answers, annotations };
}
/**
 * What Coder is told when a hook answered its questions, in Claude Code's words (its AskUserQuestion result): "Your
 * questions have been answered: …" when each answer is one of the choices; "The user answered: …" when one is not (or
 * has notes); "The user did not answer the questions." when none was given. `questions`: { key (the text the answers use),
 * text, labels, multi }. `shown` is the answers alone, for the note on the page.
 */
export function answeredText(questions, answers, annotations) {
  const shown = questions.map((q) => {
    const w = ownKey(answers, q.key), g = ownKey(annotations, q.key);
    const given = !!w && w !== NOTES_ONLY;
    if (!given && !(g && g.notes)) return null;
    const d = [given ? '"' + q.text + '"="' + w + '"' : '"' + q.text + '"=(no option selected)'];
    if (g && g.preview) d.push("selected preview: " + g.preview);
    if (g && g.notes) d.push("notes: " + g.notes);
    return d.join(" ");
  }).filter((x) => x !== null).join(", ");
  if (!shown) return { text: "The user did not answer the questions.", shown: "" };
  const fits = questions.every((q) => {
    const g = ownKey(annotations, q.key);
    if (g && g.notes) return false;
    const y = ownKey(answers, q.key), k = new Set(q.labels);
    if (Array.isArray(y)) return q.multi === true && y.length > 0 && y.every((x) => k.has(x));
    if (!y || y === NOTES_ONLY) return true;
    if (k.has(y)) return true;
    if (q.multi !== true) return false;
    const b = splitLabels(y);
    return b !== null && b.length >= 1 && joinLabels(b) === y && b.every((x) => k.has(x));
  });
  return { text: fits ? "Your questions have been answered: " + shown + ". You can now continue with these answers in mind." : "The user answered: " + shown + ". Read the answers carefully \u2014 they may request clarification, changes, or that you not proceed \u2014 and follow what they actually say.", shown };
}

/**
 * A hook's name in a message: `[<command>]`, as Claude Code names a command hook ("PreToolUse:Bash hook error:
 * [${CLAUDE_PROJECT_DIR}/.claude/hooks/no-rm.sh]: …"); its address for an HTTP hook, "prompt" or "agent" for the others.
 */
export const hookName = (h) => "[" + (h.type === "http" ? String(h.url) : h.type === "prompt" || h.type === "agent" ? h.type : String(h.command) + (h.args && h.args.length ? " " + h.args.join(" ") : "")) + "]";
/**
 * A HOOK'S NOTICE AS THE CHAT SHOWS IT ("<Event>:<Tool> hook error: [<command>]: <why>"): whole up to `max` characters; past
 * that its command is cut short ("…"), never the reason after it (live test round 3: a 1,000-character hook command filled
 * the chat's 600 characters, so "Hook returned incorrect event name …" never showed; Claude Code shows the whole line).
 */
export function hookNoteText(n, max = 600) {
  const s = String(n ?? "");
  if (s.length <= max) return s;
  const m = /^(.{0,80}? hook (?:blocking )?error(?: from command)?: \[)([\s\S]*?)(\]: )((?:Hook returned|Hook output|Failed with|Timed out|Request failed|The response|PreToolUse hook|PostToolUse hook)[\s\S]*|[\s\S]*)$/.exec(s);
  if (!m) return s.slice(0, max);
  const why = m[4].length > 1400 ? m[4].slice(0, 1400) + "…" : m[4];
  const room = Math.max(120, max - m[1].length - m[3].length - Math.min(why.length, max - 200));
  return m[1] + (m[2].length > room ? m[2].slice(0, room) + "…" : m[2]) + m[3] + why;
}
const cap = (s) => { const t = String(s ?? ""); return t.length > HOOK_TEXT_MAX ? t.slice(0, 2000) + "\n… (" + (t.length - 2000).toLocaleString("en-US") + " more characters left out)" : t; };
const BLOCK_FAIL = 'blocking because onFailure is "block"';

/**
 * Stdout as Claude Code reads it: one JSON object "with nothing around it but whitespace", else plain text (or a parse
 * failure). Its own rules (2.1.322, Bash docs pass 9): several lines that are each JSON, none of them a hook's answer (no
 * field Claude Code reads), are plain text ("Hook output is several JSON documents, treating as plain text"), such as a
 * program's log; any other object that does not parse is a failure, in its words (`bad`).
 */
const HOOK_FIELDS = new Set(["continue", "suppressOutput", "stopReason", "decision", "reason", "systemMessage", "hookSpecificOutput", "async", "asyncTimeout"]);
const severalDocs = (t) => {
  const lines = t.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return false;
  return lines.every((l) => { try { const v = JSON.parse(l.trim()); return !(v && typeof v === "object" && !Array.isArray(v)) || !Object.keys(v).some((k) => HOOK_FIELDS.has(k)); } catch { return false; } });
};
export const notJson = (err) => "Hook output looks like a JSON object but is not valid JSON \u2014 " + err + ". Emit the payload with a JSON encoder (jq, ConvertTo-Json, json.dumps) rather than string concatenation so backslashes and quotes inside strings are escaped.";
function readStdout(stdout) {
  const t = String(stdout || "").trim();
  if (!(t.startsWith("{") && t.endsWith("}"))) return { json: null, bad: "" };
  try { const v = JSON.parse(t); return v && typeof v === "object" && !Array.isArray(v) ? { json: v, bad: "" } : { json: null, bad: "not a JSON object" }; } catch (e) {
    if (severalDocs(t)) return { json: null, bad: "" };
    return { json: null, bad: String((e && e.message) || e).slice(0, 200) };
  }
}
/** A hook's answer for another event (Claude Code: "Hook returned incorrect event name: expected '…' but got '…'"), or "". */
export function wrongEvent(event, json) {
  const sp = json && json.hookSpecificOutput;
  if (!sp || typeof sp !== "object" || sp.hookEventName === event) return "";
  return "Hook returned incorrect event name: expected '" + event + "' but got '" + String(sp.hookEventName) + "'. Full stdout: " + JSON.stringify(json, null, 2).slice(0, 4000);
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
    const wrongHttp = wrongEvent(event, json);
    if (wrongHttp) return fail("failed", wrongHttp) || { kind: "error", json: null, text: "", reason: "", notice: wrongHttp };
    if (json) return { kind: "ok", json, text: "", reason: "", notice: "" };
    return fail("failed", bad ? notJson(bad) : "the response was not a JSON object") || { kind: "error", json: null, text: "", reason: "", notice: bad ? notJson(bad) : "The response was not a JSON object" };
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
  if (bad) return fail("failed", notJson(bad)) || { kind: "error", json: null, text: "", reason: "", notice: notJson(bad) };
  // (An answer naming another event is no answer: Claude Code's hookEventName check.)
  const wrong = wrongEvent(event, json);
  if (wrong) return fail("failed", wrong) || { kind: "error", json: null, text: "", reason: "", notice: wrong };
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
 *   classifierContext  PostToolUse: the hooks' notes for the Auto mode checker about this result (Claude Code's
 *               classifierContext: at most 2,000 characters for the call, shared by its hooks; a note whose own rewrite of
 *               the output was refused, or replaced by another hook's, is dropped), or ""
 */
/** What is wrong with a command's new output for Claude Code's Bash output shape ("" when nothing). */
export function bashShapeProblem(u) {
  if (!u || typeof u !== "object" || Array.isArray(u)) return "Expected an object with stdout, stderr and interrupted, received " + (Array.isArray(u) ? "array" : u === null ? "null" : typeof u) + ".";
  const miss = [["stdout", "string"], ["stderr", "string"], ["interrupted", "boolean"]].filter(([k, t]) => typeof u[k] !== t).map(([k, t]) => k + " (" + t + ")");
  return miss.length ? "Expected " + miss.join(", ") + "." : "";
}
export function hooksOutcome(event, runs, { tool = "" } = {}) {
  const label = event + (tool && TOOL_EVENTS.has(event) ? ":" + tool : "");
  const out = { stop: null, decision: "", reason: "", endTurn: "", updatedInput: null, updatedOutput: undefined, context: [], messages: [], notices: [], blocks: [], watchPaths: null, sessionTitle: "", retry: false, classifierContext: "" };
  const notes = [];
  let rewrites = 0, lastRewrite = 0;
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
      // ("defer": honored "only in non-interactive mode with the -p flag" for an app that resumes the run; otherwise "it logs a
      // warning and ignores the hook result", Bash docs pass 8: Coder has no such app.)
      if (d === "defer") d = "";
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
      else if (dec.behavior === "allow" && out.decision !== "deny") {
        out.decision = "allow";
        if (dec.updatedInput && typeof dec.updatedInput === "object" && !Array.isArray(dec.updatedInput)) out.updatedInput = dec.updatedInput;
        // (Its updatedPermissions, Bash docs pass 8: "array of permission update entries to apply, such as adding an allow rule or
        // changing the session permission mode".)
        if (Array.isArray(dec.updatedPermissions)) out.updatedPermissions = [...(out.updatedPermissions || []), ...dec.updatedPermissions.filter((x) => x && typeof x === "object" && !Array.isArray(x))].slice(0, 50);
      }
      continue;
    }
    let rewrite = 0;
    if (event === "PostToolUse" && spec.updatedToolOutput !== undefined) {
      const u = spec.updatedToolOutput;
      rewrite = -1;
      // (For a command, Claude Code checks it against Bash's output shape, stdout and stderr strings and interrupted a boolean,
      // and uses the original output when it does not match, in its words; a match is shown as its result is, stdout then
      // stderr. Bash docs pass 9.)
      const bad = tool === "Bash" || tool === "PowerShell" ? bashShapeProblem(u) : "";
      if (bad) out.notices.push("PostToolUse hook returned updatedToolOutput that does not match " + tool + "'s output shape; using original output. " + bad);
      else if (typeof u === "string") { out.updatedOutput = u; rewrite = lastRewrite = ++rewrites; }
      else if (u && typeof u === "object" && typeof u.stdout === "string") { out.updatedOutput = [u.stdout.replace(/^(\s*\n)+/, "").trimEnd(), typeof u.stderr === "string" ? u.stderr.trim() : "", u.interrupted === true ? "<error>Command was aborted before completion</error>" : ""].filter(Boolean).join("\n"); rewrite = lastRewrite = ++rewrites; }
    }
    // A NOTE FOR THE AUTO MODE CHECKER (Claude Code: "Return classifierContext to send a short note about the tool call's
    // result to the auto mode classifier rather than to Claude").
    if (event === "PostToolUse" && typeof spec.classifierContext === "string" && spec.classifierContext.trim()) notes.push({ text: spec.classifierContext.trim(), rewrite });
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
  if (notes.length) out.classifierContext = notes.filter((n) => n.rewrite === 0 || n.rewrite === lastRewrite).map((n) => n.text).join("\n").slice(0, 2000);
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
/**
 * WHAT CLAUDE CODE ADDS AFTER A POWERSHELL HOOK'S COMMAND (2.1.322, every event but PermissionRequest; Bash docs pass 9): a
 * program that ends with exit code 2 makes the hook exit 2 as well, so it blocks; pwsh on its own exits 1 for it.
 */
export const PS_HOOK_EXIT2 = "\n; if (-not $?) { if ($LASTEXITCODE -eq 2) { exit 2 } }";
// (A shell-form command runs with `sh -c`, as Claude Code runs it ("sh -c on macOS and Linux": dash on Ubuntu), never in the
// shell Coder's commands use; Bash docs pass 9.)
// THE CHAT'S SCRATCH FOLDER IS THERE FOR EVERY HOOK (live test after deploy 124: in a new chat the first PreToolUse hook ran
// before any command had made it, so a hook writing into the `scratchpad_dir` it is given found "Directory nonexistent";
// Claude Code's scratchpad is there from the session's start). The same line Coder's commands start with (SCRATCH_MAKE), in
// the same sandbox.
export const HOOK_SCRATCH_MAKE = "[ -d /tmp/coder-scratch ] || mkdir -m 700 -p /tmp/coder-scratch 2>/dev/null; ";
export function hookShell(h, mark, root) {
  // (A PowerShell hook: pwsh with no profile, non-interactive, the command encoded, its stdin the event's JSON.)
  // (THE PATH PLACEHOLDER, Bash docs pass 8: in exec form "the resolved script path as one argument with no quoting", in
  // `command` and each of `args`; in a PowerShell shell-form command "rewrites the ${CLAUDE_PROJECT_DIR} … placeholders … to
  // PowerShell's ${env:NAME} form"; in a Bash shell-form command the shell reads the exported variable itself.)
  const put = (x) => String(x).split("${CLAUDE_PROJECT_DIR}").join(String(root));
  const cmd = Array.isArray(h.args) ? [put(h.command), ...h.args.map(put)].map(shq).join(" ") : h.shell === "powershell" ? "pwsh -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand " + utf16Base64(String(h.command).split("${CLAUDE_PROJECT_DIR}").join("${env:CLAUDE_PROJECT_DIR}") + (h.event === "PermissionRequest" ? "" : PS_HOOK_EXIT2)) : "sh -c " + shq(String(h.command));
  return HOOK_SCRATCH_MAKE + "__in='@REQUEST'; __in=\"${__in#@}\"; __err=\"$(mktemp 2>/dev/null || echo /tmp/coder-hook-$$)\"; if [ -n \"${CLAUDE_ENV_FILE:-}\" ]; then mkdir -p \"${CLAUDE_ENV_FILE%/*}\" 2>/dev/null; fi; export CLAUDE_PROJECT_DIR=" + shq(root) + " CODER_PROJECT_DIR=" + shq(root) + " CLAUDE_CODE_REMOTE=true; (\n" + cmd + "\n) < \"$__in\" 2>\"$__err\"; __code=$?; printf '\\n%s\\n' '" + mark + "'; cat \"$__err\" 2>/dev/null; rm -f \"$__err\"; exit $__code";
}
/** A command hook's output split at its `mark`: `{ stdout, stderr }` (a background one's file ends with Coder's own line). */
export function splitHookOut(out, mark) {
  const s = String(out || "");
  const k = s.lastIndexOf("\n" + mark + "\n");
  const err = k >= 0 ? s.slice(k + mark.length + 2) : "";
  return { stdout: k >= 0 ? s.slice(0, k) : s, stderr: err.replace(/\n?\[finished, exit code -?\d+\]\n*$/, "") };
}

/** The input every hook gets (Claude Code's common fields), with the event's own. */
export function hookInput(event, { session = "", cwd = "", mode = "auto", effort = "", promptId = "", scratch = "/tmp/coder-scratch" } = {}, extra = {}) {
  // (`scratchpad_dir`: the chat's scratch folder, as Claude Code's common fields give it: Bash docs pass 9.)
  return { session_id: String(session), ...(promptId ? { prompt_id: String(promptId) } : {}), cwd: String(cwd), ...(scratch ? { scratchpad_dir: String(scratch) } : {}), permission_mode: String(mode), hook_event_name: event, ...(effort ? { effort: { level: String(effort) } } : {}), ...extra };
}
