// HOOKS (Bash docs, the owner, 2026-11-10: "yea do all 4"): Claude Code's hooks in Coder. Its hooks reference: "Hooks are
// user-defined shell commands … that execute at specific points in Claude Code's lifecycle." The owner's own (Settings, kept
// on the account, as Claude Code's user settings) and the repository's (`.claude/settings.json` and
// `.claude/settings.local.json`, as Claude Code's project settings), in Claude Code's shape:
//   { "hooks": { "PreToolUse": [ { "matcher": "Bash", "hooks": [ { "type": "command", "command": "…", "timeout": 60 } ] } ] } }
// Each runs on Coder's machine as Coder's own commands do (its user, its room, the project's folder), with the event's JSON on
// stdin; its exit code, stdout and stderr say what happens, as in Claude Code. This file is the part with no machine in it:
// reading the settings, matching, the input, and what a hook's output means. (No node: modules: the Worker checks the owner's
// hooks with it.)
import { ifRuleMatches } from "./coder-perms.mjs";

/** The events Coder has (Claude Code's names), and the ones about a tool call. */
export const HOOK_EVENTS = ["SessionStart", "UserPromptSubmit", "PreToolUse", "PermissionRequest", "PostToolUse", "PostToolUseFailure", "Notification", "Stop", "PreCompact", "PostCompact"];
export const TOOL_EVENTS = new Set(["PreToolUse", "PermissionRequest", "PostToolUse", "PostToolUseFailure"]);
/** The events whose matcher Claude Code ignores ("If you add a matcher field to an event without matcher support, it is silently ignored"). */
const NO_MATCHER = new Set(["UserPromptSubmit", "Stop"]);
/** Claude Code's timeouts: "Defaults: 600 for command … Claude Code lowers the command … default to 30 on UserPromptSubmit". */
export const HOOK_TIMEOUT_S = 600;
export const timeoutFor = (event, given) => { const n = Number(given); return Number.isFinite(n) && n > 0 ? Math.min(HOOK_TIMEOUT_S, Math.max(1, Math.round(n))) : event === "UserPromptSubmit" ? 30 : HOOK_TIMEOUT_S; };
/** "A hook's additionalContext, systemMessage, and initialUserMessage strings, and its plain stdout, are capped at 10,000 characters." */
export const HOOK_TEXT_MAX = 10_000;
/** Claude Code's cap on Stop hooks that keep a turn going: "after stop hooks have continued the turn eight times in a row". */
export const STOP_BLOCK_CAP = 8;
/** The owner's hooks box in Settings: at most this many characters of JSON. */
export const HOOKS_SETTING_MAX = 20_000;

/** Coder's tools by Claude Code's names (what a matcher and a hook's `tool_name` see); Coder's own tools keep their names. */
export const CC_TOOL = { bash: "Bash", monitor: "Monitor", read: "Read", write: "Write", edit: "Edit", grep: "Grep", glob: "Glob", lsp: "LSP", web_fetch: "WebFetch", stop_job: "TaskStop", ask_user: "AskUserQuestion", exit_plan_mode: "ExitPlanMode", todo: "TodoWrite" };
export const ccTool = (name, monitor = false) => (monitor ? "Monitor" : CC_TOOL[name] || String(name || ""));

/**
 * A SETTINGS OBJECT'S HOOKS (Claude Code's shape), each handler on its own line: `{ list: [{ event, matcher, command, args,
 * timeout, if, source }], disabled, problems }`. Only command hooks run on Coder's machine; another type is named in
 * `problems` and left out. `source`: "settings" (the owner's) or "project" (the repository's).
 */
export function hooksFrom(settings, source = "settings") {
  const out = { list: [], disabled: false, problems: [] };
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return out;
  if (settings.disableAllHooks === true) out.disabled = true;
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
        if (h.type !== "command") { out.problems.push(event + ": only command hooks run on Coder's machine (not " + String(h.type || "no type") + ")"); continue; }
        if (typeof h.command !== "string" || !h.command.trim()) { out.problems.push(event + ": a command hook needs its command"); continue; }
        const args = Array.isArray(h.args) && h.args.every((x) => typeof x === "string") ? h.args : null;
        out.list.push({ event, matcher, command: h.command, ...(args ? { args } : {}), timeout: timeoutFor(event, h.timeout), ...(typeof h.if === "string" && h.if.trim() ? { if: h.if.trim() } : {}), source });
      }
    }
  }
  return out;
}

/**
 * THE OWNER'S HOOKS BOX (Settings): the JSON text as typed → `{ ok, value, error }`. It holds Claude Code's settings shape,
 * `{ "hooks": { … } }` (and `disableAllHooks`), or the hooks object alone; empty is none.
 */
export function hooksSetting(text) {
  const t = String(text ?? "").trim();
  if (!t) return { ok: true, value: null };
  if (t.length > HOOKS_SETTING_MAX) return { ok: false, error: "The hooks are over " + HOOKS_SETTING_MAX.toLocaleString("en-US") + " characters." };
  let v;
  try { v = JSON.parse(t); } catch (e) { return { ok: false, error: "The hooks are not valid JSON: " + String((e && e.message) || e).slice(0, 200) }; }
  if (!v || typeof v !== "object" || Array.isArray(v)) return { ok: false, error: "The hooks must be a JSON object, as in Claude Code's settings: { \"hooks\": { \"PreToolUse\": [ … ] } }." };
  const settings = v.hooks !== undefined || v.disableAllHooks !== undefined ? v : { hooks: v };
  const r = hooksFrom(settings, "settings");
  if (r.problems.length) return { ok: false, error: r.problems[0] + "." };
  return { ok: true, value: { ...(settings.hooks !== undefined ? { hooks: settings.hooks } : {}), ...(settings.disableAllHooks === true ? { disableAllHooks: true } : {}) } };
}

/**
 * Claude Code's matcher: "*", "" or none matches all; only letters, digits, _, -, spaces, `,` and `|`: one exact name or a
 * list; anything else: a JavaScript regular expression, unanchored.
 */
export function matcherMatches(matcher, value) {
  const m = matcher === undefined || matcher === null ? "" : String(matcher);
  if (m === "" || m === "*") return true;
  if (/^[A-Za-z0-9_\- ,|]+$/.test(m)) return m.split(/[|,]/).map((x) => x.trim()).filter(Boolean).includes(String(value));
  try { return new RegExp(m).test(String(value)); } catch { return false; }
}

/**
 * THE HOOKS THAT RUN FOR ONE EVENT, deduplicated by command ("If you define the same handler in more than one settings file,
 * it runs once"): `value` is what the matcher filters (a tool's name, how a session started, what started a summary); for a
 * tool event, `call` `{ tool, input, ctx }` for `if` ("On other events, a hook with if set never runs"). A Bash matcher also
 * fires on a Monitor's command, on PreToolUse and PermissionRequest.
 */
export function hooksFor(all, event, value = "", call = null) {
  const seen = new Set(), out = [];
  for (const h of Array.isArray(all) ? all : []) {
    if (!h || h.event !== event) continue;
    if (!NO_MATCHER.has(event) && !matcherMatches(h.matcher, value) && !(value === "Monitor" && (event === "PreToolUse" || event === "PermissionRequest") && matcherMatches(h.matcher, "Bash"))) continue;
    if (h.if) {
      if (!TOOL_EVENTS.has(event) || !call) continue;
      const tool = call.tool === "Monitor" && /^Bash\(/.test(h.if) ? "Bash" : call.tool;
      if (!ifRuleMatches(h.if, tool, call.input, call.ctx || {})) continue;
    }
    const key = h.command + "\u0000" + JSON.stringify(h.args || null);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
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

/** A hook's command as one line for a message: `[<command>]`, as Claude Code names it ("PreToolUse:Bash hook error: [${CLAUDE_PROJECT_DIR}/.claude/hooks/no-rm.sh]: …"). */
export const hookName = (h) => "[" + String(h.command) + (h.args && h.args.length ? " " + h.args.join(" ") : "") + "]";
const cap = (s) => { const t = String(s ?? ""); return t.length > HOOK_TEXT_MAX ? t.slice(0, 2000) + "\n… (" + (t.length - 2000).toLocaleString("en-US") + " more characters left out)" : t; };

/**
 * WHAT ONE RUN SAYS (Claude Code's table, "To find your hook's outcome … match what it printed to stdout … with its exit code"):
 * `run` `{ code, stdout, stderr, timedOut }` → `{ kind: "ok" | "block" | "error", json, text, reason, notice }`. Stdout is JSON
 * only when it is one object "with nothing around it but whitespace"; exit 2 blocks, its stderr the reason (a JSON decision's
 * reason before it); another code with valid JSON is a success, with plain text a non-blocking error ("Failed with
 * non-blocking status code: <first line of stderr>"); a hook that timed out says nothing.
 */
export function hookResult(event, run) {
  const code = run && Number.isInteger(run.code) ? run.code : -1;
  const stdout = String((run && run.stdout) || ""), stderr = String((run && run.stderr) || "");
  if (run && run.timedOut) return { kind: "error", json: null, text: "", reason: "", notice: "Timed out" };
  const t = stdout.trim();
  let json = null, bad = "";
  if (t.startsWith("{") && t.endsWith("}")) {
    try { const v = JSON.parse(t); if (v && typeof v === "object" && !Array.isArray(v)) json = v; else bad = "not a JSON object"; } catch (e) { bad = String((e && e.message) || e).slice(0, 200); }
  }
  const text = json || bad ? "" : stdout;
  const firstErr = stderr.split("\n").map((l) => l.trim()).find(Boolean) || "";
  if (code === 2) return { kind: "block", json, text: "", reason: cap(stderr.trim()), notice: "" };
  if (bad) return { kind: "error", json: null, text: "", reason: "", notice: "Hook output is not valid JSON: " + bad };
  if (code === 0 || json) return { kind: "ok", json, text: cap(text), reason: "", notice: "" };
  return { kind: "error", json: null, text: "", reason: "", notice: "Failed with non-blocking status code: " + firstErr };
}

/**
 * ALL OF AN EVENT'S RUNS, TOGETHER (`runs` `[{ hook, result }]`): what Coder does next.
 *   stop        { reason } when one said "continue": false ("Claude stops processing entirely"), its stopReason
 *   decision    PreToolUse: "deny" | "ask" | "allow" | "" ("precedence is deny > defer > ask > allow"; exit 2 is a deny);
 *               PermissionRequest: "allow" | "deny" | ""; UserPromptSubmit, PostToolUse(Failure), Stop, PreCompact: "block" | ""
 *   reason      the decision's reason, in Claude Code's words for a block by exit 2 ("<Event>:<Tool> hook error: [cmd]: …")
 *   updatedInput, updatedOutput   PreToolUse's new input; PostToolUse's new output (a string, or Bash's { stdout })
 *   context     additionalContext strings, and plain stdout on UserPromptSubmit and SessionStart (and PreCompact's, as instructions)
 *   messages    systemMessage strings, for the owner
 *   notices     "<Event> hook error" lines for the owner (non-blocking errors)
 */
export function hooksOutcome(event, runs, { tool = "" } = {}) {
  const label = event + (tool && TOOL_EVENTS.has(event) ? ":" + tool : "");
  const out = { stop: null, decision: "", reason: "", updatedInput: null, updatedOutput: undefined, context: [], messages: [], notices: [], blocks: [] };
  const rank = { deny: 4, ask: 2, allow: 1, "": 0 };
  for (const { hook, result } of Array.isArray(runs) ? runs : []) {
    if (!result) continue;
    if (result.kind === "error") { out.notices.push(label + " hook error: " + hookName(hook) + ": " + result.notice); continue; }
    const j = result.json || {};
    const spec = j.hookSpecificOutput && typeof j.hookSpecificOutput === "object" ? j.hookSpecificOutput : {};
    if (j.continue === false) out.stop = out.stop || { reason: typeof j.stopReason === "string" ? cap(j.stopReason) : "" };
    if (typeof j.systemMessage === "string" && j.systemMessage.trim()) out.messages.push(cap(j.systemMessage));
    if (typeof spec.additionalContext === "string" && spec.additionalContext.trim()) out.context.push(cap(spec.additionalContext));
    if (result.text && result.text.trim() && (event === "UserPromptSubmit" || event === "SessionStart" || event === "PreCompact")) out.context.push(cap(result.text.trim()));
    const blockBy = (why) => { out.blocks.push(label + " hook " + (result.kind === "block" ? "error" : "blocking error from command") + ": " + hookName(hook) + ": " + (why || "(no reason given)")); };
    if (event === "PreToolUse") {
      let d = typeof spec.permissionDecision === "string" ? spec.permissionDecision : j.decision === "approve" ? "allow" : j.decision === "block" ? "deny" : "";
      if (d === "defer") d = "deny";
      if (result.kind === "block") d = "deny";
      const why = typeof spec.permissionDecisionReason === "string" ? spec.permissionDecisionReason : typeof j.reason === "string" ? j.reason : "";
      if (d === "deny") blockBy(result.kind === "block" ? (why || result.reason) : why);
      if (rank[d] !== undefined && rank[d] > rank[out.decision]) { out.decision = d; out.reason = d === "deny" ? out.blocks[out.blocks.length - 1] : cap(why); }
      if (spec.updatedInput && typeof spec.updatedInput === "object" && !Array.isArray(spec.updatedInput) && d !== "deny") out.updatedInput = spec.updatedInput;
      continue;
    }
    if (event === "PermissionRequest") {
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
    // A BLOCK: exit 2, or decision "block" (UserPromptSubmit, PostToolUse, PostToolUseFailure, Stop, PreCompact).
    if (result.kind === "block" || j.decision === "block") {
      const why = typeof j.reason === "string" && j.reason.trim() ? cap(j.reason) : result.reason;
      if (event === "SessionStart" || event === "PostCompact" || event === "Notification") { if (result.kind === "block") out.notices.push(label + " hook error: " + hookName(hook) + ": " + (result.reason || "(no reason given)")); continue; }
      out.decision = "block";
      blockBy(why);
      out.reason = out.reason || why;
    }
  }
  return out;
}

/** The input every hook gets (Claude Code's common fields), with the event's own. */
export function hookInput(event, { session = "", cwd = "", mode = "auto", effort = "" } = {}, extra = {}) {
  return { session_id: String(session), cwd: String(cwd), permission_mode: String(mode), hook_event_name: event, ...(effort ? { effort: { level: String(effort) } } : {}), ...extra };
}
