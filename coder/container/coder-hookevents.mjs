// CLAUDE CODE'S HOOK EVENTS OF 2026-11-27 IN CODER (the round "make Coder's hooks match Claude Code's"): WorktreeCreate,
// WorktreeRemove, PreModelSwitch, PostModelSwitch, InstructionsLoaded, ConfigChange, DirectoryAdded and UserPromptExpansion,
// and the fields Stop and SubagentStop hooks get about work still in flight. From Claude Code's hooks reference
// (code.claude.com/docs/en/hooks). The parts with no machine in them, so tests can run them; Coder's loop
// (coder-agent.mjs) runs the hooks. No node: modules.

/** ANSI escape codes, which Claude Code strips before it reads a WorktreeCreate command hook's last line. */
const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*(?:\x07|\x1b\\)/g;

/**
 * THE PATH A WORKTREECREATE HOOK GAVE (Claude Code: "Command hooks: print the path as the last non-empty line of stdout …
 * HTTP hooks: return { hookSpecificOutput: { hookEventName: "WorktreeCreate", worktreePath } }"; "If the hook fails or
 * produces no path, worktree creation fails with an error"; "Claude Code resolves a relative path against the directory the
 * hook ran in, collapsing any . or .. segments"; "refuses an absolute path that contains . or .. segments"). `runs`: each
 * hook's raw run, in order (a command hook's { code, stdout, stderr, timedOut }, an HTTP hook's { http }, an mcp_tool hook's
 * { mcp, stdout }); the last hook's path is used. → { path } or { error }.
 */
export function worktreeHookPath(runs, cwd = "/") {
  let path = "", error = "";
  for (const run of Array.isArray(runs) ? runs : []) {
    if (!run) continue;
    let got = "";
    if (run.timedOut) { error = "the WorktreeCreate hook timed out"; continue; }
    if (run.http) {
      const st = Number(run.http.status) || 0;
      if (run.http.error || !(st >= 200 && st < 300)) { error = "the WorktreeCreate hook's request failed" + (run.http.error ? ": " + String(run.http.error).slice(0, 200) : " with status " + st); continue; }
      let j = null;
      try { j = JSON.parse(String(run.http.body || "")); } catch { j = null; }
      const sp = j && j.hookSpecificOutput;
      got = sp && typeof sp === "object" && typeof sp.worktreePath === "string" ? sp.worktreePath : "";
    } else if (run.mcp) {
      if (run.mcp.ok !== true) { error = "the WorktreeCreate hook's tool failed" + (run.stderr ? ": " + String(run.stderr).slice(0, 200) : ""); continue; }
      got = lastLine(run.stdout);
    } else {
      if (run.code !== 0) { error = "the WorktreeCreate hook failed (exit " + run.code + ")" + (String(run.stderr || "").trim() ? ": " + String(run.stderr).trim().split("\n")[0].slice(0, 200) : ""); continue; }
      got = lastLine(run.stdout);
    }
    if (!got) { error = "the WorktreeCreate hook gave no path"; continue; }
    const p = resolvePath(got, cwd);
    if (p.error) { error = p.error; continue; }
    path = p.path; error = "";
  }
  if (path && !error) return { path };
  return { error: error || "the WorktreeCreate hook gave no path" };
}
const lastLine = (t) => String(t || "").replace(ANSI, "").split("\n").map((l) => l.trim()).filter(Boolean).at(-1) || "";
function resolvePath(p, cwd) {
  const segs = String(p).split("/");
  if (p.startsWith("/")) {
    if (segs.some((s) => s === "." || s === "..")) return { error: "the WorktreeCreate hook's path " + p.slice(0, 200) + " has a . or .. segment" };
    return { path: "/" + segs.filter(Boolean).join("/") };
  }
  const out = String(cwd || "/").split("/").filter(Boolean);
  for (const s of segs) { if (!s || s === ".") continue; if (s === "..") out.pop(); else out.push(s); }
  return { path: "/" + out.join("/") };
}

/**
 * WHETHER A WORKTREEREMOVE HOOK'S REMOVAL FAILED (Claude Code: "Hook exits non-zero: the removal fails if the directory at
 * worktree_path still exists afterward … A hook that deleted the directory before exiting non-zero counts as removed").
 * `runs`: the hooks' raw runs; `gone`: whether the directory is gone now. → "" or why it failed.
 */
export function worktreeRemoveFailed(runs, gone) {
  if (gone) return "";
  const bad = (Array.isArray(runs) ? runs : []).find((r) => r && (r.timedOut || (r.http ? !(Number(r.http.status) >= 200 && Number(r.http.status) < 300) || r.http.error : r.mcp ? r.mcp.ok !== true : r.code !== 0)));
  if (!bad) return "";
  return bad.timedOut ? "timed out" : bad.http ? "its request failed" : bad.mcp ? "its tool failed" : "exited " + bad.code + (String(bad.stderr || "").trim() ? ": " + String(bad.stderr).trim().split("\n")[0].slice(0, 200) : "");
}

/** The shell lines that keep a hook-made worktree's record in the chat's home (one "path|origin" a line). */
export const HOOK_WT_FILE = "$HOME/.coder/hook-worktrees";
const shq = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";
/** Enter a hook-made worktree: remember it with the folder the chat came from, then cd there. Prints "@@CODER-WT OK <path>||<origin>". */
export function enterHookWorktreeScript(path) {
  return ["__o=$(pwd -P); __p=" + shq(path), "cd -- \"$__p\" 2>/dev/null || { echo \"@@CODER-WT ERR the WorktreeCreate hook's path $__p is not a directory Coder can enter\"; exit 3; }", "mkdir -p \"$HOME/.coder\" && printf '%s|%s\\n' \"$(pwd -P)\" \"$__o\" >> \"" + HOOK_WT_FILE + "\"", "echo \"@@CODER-WT OK $(pwd -P)||$__o\""].join("\n");
}
/** Where the chat's shell is, against the hook-made worktrees: "@@CODER-WT HOOKWT <path>|<origin>" or "@@CODER-WT NOHOOKWT". */
export function hookWorktreeHereScript() {
  return ["__h=$(pwd -P); __hit=''", "if [ -f \"" + HOOK_WT_FILE + "\" ]; then while IFS='|' read -r __p __o; do case \"$__h/\" in \"$__p/\"*) __hit=\"$__p|$__o\";; esac; done < \"" + HOOK_WT_FILE + "\"; fi", "if [ -n \"$__hit\" ]; then echo \"@@CODER-WT HOOKWT $__hit\"; else echo \"@@CODER-WT NOHOOKWT\"; fi"].join("\n");
}
/** Leave a hook-made worktree: back to its origin, its record dropped; "gone" says whether its folder is gone. */
export function leaveHookWorktreeScript({ path, origin }) {
  return ["cd -- " + shq(origin) + " 2>/dev/null || cd -- \"$HOME\"", "if [ -f \"" + HOOK_WT_FILE + "\" ]; then grep -v -F -x -- " + shq(path + "|" + origin) + " \"" + HOOK_WT_FILE + "\" > \"" + HOOK_WT_FILE + ".n\" || true; mv -f \"" + HOOK_WT_FILE + ".n\" \"" + HOOK_WT_FILE + "\"; fi", "if [ -e " + shq(path) + " ]; then __g=0; else __g=1; fi", "echo \"@@CODER-WT LEFT $(pwd -P)|$__g\""].join("\n");
}
/** Whether a folder is still there: "@@CODER-WT GONE 1" or "… GONE 0". */
export const goneScript = (path) => "if [ -e " + shq(path) + " ]; then echo '@@CODER-WT GONE 0'; else echo '@@CODER-WT GONE 1'; fi";
/** Claude Code's fallback with no WorktreeRemove hook: "removes the path your WorktreeCreate hook returned as git worktree remove --force would"; a worktree git doesn't know stays. */
export const gitRemoveScript = (path) => "git -C " + shq(path) + " rev-parse --git-common-dir >/dev/null 2>&1 && __m=$(git -C " + shq(path) + " rev-parse --path-format=absolute --git-common-dir 2>/dev/null) && git --git-dir=\"$__m\" worktree remove --force " + shq(path) + " >/dev/null 2>&1; " + goneScript(path);

/**
 * THE INSTRUCTION FILES THE CHAT LOADED, FOR INSTRUCTIONSLOADED HOOKS (Claude Code: "Fires when a CLAUDE.md or
 * .claude/rules/*.md file is loaded into context … at session start for eagerly loaded files and again later when files are
 * lazily loaded"; "doesn't fire when Claude reads AGENTS.md directly"; memory_type User, Project, Local or Managed): the
 * context's "i:<file>" pieces that are instruction files (Coder's CODER.md, CLAUDE.md, CLAUDE.local.md and the rules folders),
 * each `{ file_path, memory_type, load_reason }`. `root`: the repository's folder, for the full path.
 */
export function instructionFiles(pieces, root, reason = "session_start") {
  const out = [];
  for (const p of Array.isArray(pieces) ? pieces : []) {
    const name = String((p && p.key) || "").startsWith("i:") ? String(p.key).slice(2) : "";
    if (!isInstructionFile(name)) continue;
    out.push({ file_path: fullPath(name, root), memory_type: memoryType(name), load_reason: reason });
  }
  return out;
}
export function isInstructionFile(name) {
  const n = String(name || "");
  if (!/[./]/.test(n) || /(^|\/)AGENTS\.md$/i.test(n)) return false;
  return /(^|\/)(CODER|CLAUDE|CLAUDE\.local)\.md$/i.test(n) || /(^|\/)\.(coder|claude)\/rules\/.+\.md$/i.test(n) || /(^|\/)\.(coder|claude)\/(CODER|CLAUDE)\.md$/i.test(n);
}
const memoryType = (name) => (/CLAUDE\.local\.md$/i.test(name) ? "Local" : "Project");
const fullPath = (name, root) => (String(name).startsWith("/") ? String(name) : String(root || "").replace(/\/+$/, "") + "/" + String(name).replace(/^\.?\/+/, ""));
/**
 * THE INSTRUCTION FILES A TOOL'S ANSWER BROUGHT (server.mjs laterNotes: "THE REPO'S INSTRUCTIONS FOR THIS FILE" and a "— <name>:"
 * line for each): `{ file_path, memory_type, load_reason, trigger_file_path }`, load_reason "path_glob_match" for a rule with
 * paths (in a rules folder), "nested_traversal" for a subfolder's CLAUDE.md or CODER.md.
 */
export const LAZY_HEAD = "THE REPO'S INSTRUCTIONS FOR THIS FILE";
export function lazyInstructionFiles(content, root, trigger = "") {
  const t = String(content || "");
  const at = t.indexOf(LAZY_HEAD);
  if (at < 0) return [];
  const out = [];
  for (const m of t.slice(at).matchAll(/^— (.+):$/gm)) {
    const name = m[1].trim();
    if (!isInstructionFile(name)) continue;
    const rule = /(^|\/)\.(coder|claude)\/rules\//i.test(name);
    out.push({ file_path: fullPath(name, root), memory_type: memoryType(name), load_reason: rule ? "path_glob_match" : "nested_traversal", ...(trigger ? { trigger_file_path: String(trigger) } : {}) });
  }
  return out;
}

/**
 * PREMODELSWITCH AND POSTMODELSWITCH INPUT (Claude Code: from_model, to_model, requested_model, source "command" for
 * /model <name>, "picker" for a model picker; PostModelSwitch adds "auto" and "resume"). The cost fields (context_tokens,
 * prompt_cache_warm, cache_ttl, estimated_cache_write_usd, pricing) price Claude's prompt cache and are left out: Grok's
 * cache has no such price. `sw`: the Worker's { from, to, source, requested }. → the event's fields, or null.
 */
export const MODEL_SWITCH_SOURCES = Object.freeze(["command", "picker", "sdk", "auto", "resume"]);
export function modelSwitchFields(sw) {
  if (!sw || typeof sw !== "object") return null;
  const from = String(sw.from || "").slice(0, 100), to = String(sw.to || "").slice(0, 100);
  if (!from || !to || from === to) return null;
  return { from_model: from, to_model: to, requested_model: typeof sw.requested === "string" && sw.requested ? sw.requested.slice(0, 100) : to, source: MODEL_SWITCH_SOURCES.includes(sw.source) ? sw.source : "picker" };
}
/** What the chat says when a PreModelSwitch hook refused the switch (Claude Code "keeps the current model and reports that a PreModelSwitch hook blocked the switch, with your message as the reason"). */
export const modelBlockedText = (from, to, reason) => "PreModelSwitch hook blocked the switch to " + to + (reason ? ": " + String(reason).slice(0, 500) : ".") + " This message runs on " + from + ".";

/**
 * STOP'S AND SUBAGENTSTOP'S background_tasks (Claude Code: "Each entry in background_tasks describes one in-flight task": id,
 * type (shell, subagent, monitor, workflow…), status, description and command capped at 1000 characters, agent_type for a
 * subagent, name for a workflow). `jobs`: the chat's background commands; `bg`: its background agents and workflows.
 */
const cap1k = (t) => { const s = String(t || ""); return s.length > 1000 ? s.slice(0, 1000) + "… [+" + (s.length - 1000) + " chars]" : s; };
export function backgroundTasks(jobs, bg) {
  const out = [];
  for (const [id, j] of jobs instanceof Map ? jobs.entries() : []) {
    if (!j || j.done) continue;
    out.push({ id: String(id), type: j.monitor ? "monitor" : "shell", status: "running", description: cap1k(j.desc), ...(j.command ? { command: cap1k(j.command) } : {}) });
  }
  for (const [id, b] of bg instanceof Map ? bg.entries() : []) {
    if (!b || b.done) continue;
    const e = b.entry || {};
    if (b.kind === "workflow") out.push({ id: String(id), type: "workflow", status: "running", description: cap1k(e.description), name: String((e.record && e.record.name) || String(e.description || "").replace(/^workflow\s*“?|”$/g, "")) });
    else out.push({ id: String(id), type: "subagent", status: "running", description: cap1k(e.description), agent_type: String(e.type || "") });
  }
  return out;
}

/** UserPromptExpansion's input for an owner's command that became a prompt (Claude Code's expansion_type "slash_command"). */
export const BUILTIN_PROMPT_COMMANDS = Object.freeze(["init", "review", "code-review", "security-review", "team-onboarding"]);
export function expansionOf(typed, skill = null) {
  const m = /^\/([A-Za-z0-9][\w-]{0,63}(?::[A-Za-z0-9][\w-]{0,63})?)(?:\s+([\s\S]*))?$/.exec(String(typed || "").trim());
  if (!m) return null;
  const name = m[1];
  const builtin = BUILTIN_PROMPT_COMMANDS.includes(name.toLowerCase());
  if (!builtin && !skill) return null;
  return { expansion_type: "slash_command", command_name: skill ? String(skill.name) : name.toLowerCase(), command_args: String(m[2] || "").trim(), command_source: builtin && !skill ? "builtin" : skill && skill.plugin ? "plugin" : skill && skill.owner ? "userSettings" : "projectSettings", prompt: String(typed).trim() };
}
