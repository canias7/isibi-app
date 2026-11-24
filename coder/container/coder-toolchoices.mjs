/**
 * THE TOOLS PAGE (the owner, 2026-11-24, with an approved mockup: "BUILD IT"): for each of Coder's tools the owner picks
 * Ask, Always allow or Never, or leaves it at its default. Shared by the Worker (which keeps the choices per owner, in
 * coder/<uid>/tools.json) and Coder's machine (which turns them into its permission rules). No `process` here: the Worker's
 * bundle imports this file.
 *
 * HOW A CHOICE BECOMES A RULE (applyToolChoices):
 * - A row the owner never changed is not stored and adds nothing: Coder works as before.
 * - The owner's own written rules and the repository's .claude/settings.json rules come first: when any of them names one of
 *   a row's tools (in any kind, allow, ask or deny, whole or with a pattern), that row's choice is set aside and those rules
 *   decide for that tool alone.
 * - Always allow: an allow rule on the tool's Claude Code name (Bash, Edit, WebFetch, ...). Deny and ask rules still win,
 *   and every safety check runs as for any allow rule (protected paths ask, Auto's checker still checks commands, since a
 *   whole-tool Bash allow rule is dropped in Auto).
 * - Ask: an ask rule on the tool. For Bash and PowerShell, a command that only reads still runs without asking (the
 *   machine checks it per command: `toolChoices.ask`), as the page's own words say.
 * - Never: a deny rule on the tool (the tool is taken out of the chat).
 * Tools Claude Code has no rule name for in Coder's rule reader (Agent, CronCreate, connector tools ...) and the GitHub
 * connector's tools (push_branch ..., GITHUB_ROWS) are
 * carried in `toolChoices` and checked by name where Coder decides whether a call asks or is refused.
 */
import { parseRule, GITHUB_CONNECTOR_TOOLS, githubMcpName } from "./coder-perms.mjs";

/**
 * THE GITHUB CONNECTOR'S TOOLS (the owner, 2026-11-24, approved mockup): Coder's GitHub tools left the Tools page and are
 * shown as a built-in connector, GitHub, on the Connectors page, one row per tool. Their choices are kept with the Tools
 * page's (ids "github:<tool>") and applied by the same code below. Defaults are what Coder did before.
 */
export const GITHUB_ROWS = Object.freeze([
  {"id": "github:push_branch", "group": "GitHub", "connector": "github", "tool": "push_branch", "name": "Push branch", "line": "Push to the chat's branch", "tip": "Lets Coder send its work to the chat's own branch on GitHub in the middle of a turn. It never touches your main branch.", "rules": ["push_branch"], "def": "allow"},
  {"id": "github:pull_request", "group": "GitHub", "connector": "github", "tool": "pull_request", "name": "Create or update pull request", "line": "Open a pull request, mark it ready or draft, reply or comment", "tip": "Lets Coder open a pull request for its branch, or change one: mark it ready or draft, resolve a thread, reply or comment.", "rules": ["pull_request", "pr_update"], "def": "allow"},
  {"id": "github:pr_read", "group": "GitHub", "connector": "github", "tool": "pr_read", "name": "Read pull request", "line": "Read a pull request's reviews and comments", "tip": "Lets Coder read the reviews and comments on a pull request. It never changes anything.", "rules": ["pr_read"], "def": "allow"},
  {"id": "github:pr_comments", "group": "GitHub", "connector": "github", "tool": "pr_comments", "name": "Post review comments", "line": "Post review findings on a pull request's lines", "tip": "Lets Coder post its review findings as comments on the lines of its pull request, when you ask for that.", "rules": ["pr_comments"], "def": "allow"},
  {"id": "github:reply_review", "group": "GitHub", "connector": "github", "tool": "reply_review", "name": "Reply to a review comment", "line": "Answer the review comment an auto-fix job was started for", "tip": "Lets Coder answer, in its thread on GitHub, the review comment that started an auto-fix job.", "rules": ["reply_review"], "def": "allow"},
  {"id": "github:auto_fix", "group": "GitHub", "connector": "github", "tool": "auto_fix", "name": "Auto-fix a pull request", "line": "Fix a pull request on its own", "tip": "Lets Coder fix its pull request by itself when a check fails or someone leaves a review comment. At most 3 tries in a row.", "rules": ["auto_fix"], "def": "ask"},
  {"id": "github:review", "group": "GitHub", "connector": "github", "tool": "review", "name": "Review a pull request", "line": "Review the branch's changes (code or security)", "tip": "Lets Coder read the changes on its branch to review them for bugs or security problems. It changes nothing.", "rules": ["review"], "def": "allow"},
].map((r) => Object.freeze({ ...r, rules: Object.freeze(r.rules) })));
/** The old Tools page's GitHub rows, and the connector's rows each one's choice moves to. */
const OLD_GITHUB_ROWS = Object.freeze({ "push": ["github:push_branch"], "pull-request": ["github:pull_request"], "review-comments": ["github:pr_comments", "github:pr_read", "github:reply_review"], "auto-fix": ["github:auto_fix"] });
const GH_NAMES = new Set(GITHUB_CONNECTOR_TOOLS);

export const TOOL_CHOICE_VALUES = Object.freeze(["allow", "ask", "deny"]);
export const TOOL_CHOICE_GROUPS = Object.freeze(["Files", "Commands", "Web", "Helpers", "Scheduling", "Sharing", "Side copies", "Connectors", "Plugins and skills", "Other"]);
/** Each row of the page: its id, group, name, short line, the "!" explanation, the rule names it stands for, and its default. */
export const TOOL_ROWS = Object.freeze([
  {"id": "read", "group": "Files", "name": "Read", "line": "Read a file, picture, PDF or notebook", "tip": "Lets Coder open and look at a file in your repository, including pictures, PDFs and notebooks. It never changes anything.", "rules": ["Read"], "def": "allow"},
  {"id": "write", "group": "Files", "name": "Write", "line": "Create or replace a file", "tip": "Lets Coder create a new file, or replace a whole file with new content.", "rules": ["Write"], "def": "allow"},
  {"id": "edit", "group": "Files", "name": "Edit", "line": "Change part of a file", "tip": "Lets Coder change part of a file, like fixing one line, without rewriting the rest.", "rules": ["Edit"], "def": "allow"},
  {"id": "notebookedit", "group": "Files", "name": "NotebookEdit", "line": "Change a Jupyter notebook cell", "tip": "Lets Coder change a cell in a Jupyter notebook (.ipynb file).", "rules": ["NotebookEdit"], "def": "allow"},
  {"id": "grep", "group": "Files", "name": "Grep", "line": "Search inside files", "tip": "Lets Coder search for words or code inside your files.", "rules": ["Grep"], "def": "allow"},
  {"id": "glob", "group": "Files", "name": "Glob", "line": "Find files by name", "tip": "Lets Coder find files by their name, like every file ending in .js.", "rules": ["Glob"], "def": "allow"},
  {"id": "lsp", "group": "Files", "name": "LSP", "line": "Code navigation: definitions, references", "tip": "Lets Coder jump to where code is defined and find where it is used, like an editor does.", "rules": ["LSP"], "def": "allow"},
  {"id": "bash", "group": "Commands", "name": "Bash", "line": "Run a command", "tip": "Lets Coder run commands on its machine, like installing packages, running tests or building your app. Commands that only read things always run.", "rules": ["Bash"], "def": "ask"},
  {"id": "powershell", "group": "Commands", "name": "PowerShell", "line": "Run a PowerShell command", "tip": "Lets Coder run PowerShell commands. Off unless you turn it on.", "rules": ["PowerShell"], "def": "ask", "note": "Off unless CODER_USE_POWERSHELL_TOOL is turned on in your environment."},
  {"id": "monitor", "group": "Commands", "name": "Monitor", "line": "Watch a command's output", "tip": "Lets Coder watch a running command and react to what it prints, like a server's log.", "rules": ["Monitor"], "def": "ask", "note": "Its commands follow Bash's choice too."},
  {"id": "taskstop", "group": "Commands", "name": "TaskStop", "line": "Stop a running command or helper", "tip": "Lets Coder stop a command or helper that is still running.", "rules": ["TaskStop"], "def": "allow"},
  {"id": "webfetch", "group": "Web", "name": "WebFetch", "line": "Read a web page", "tip": "Lets Coder read a web page, like documentation.", "rules": ["WebFetch"], "def": "allow"},
  {"id": "websearch", "group": "Web", "name": "WebSearch", "line": "Search the web", "tip": "Lets Coder search the web. Each search uses a little Grok.", "rules": ["WebSearch"], "def": "allow"},
  {"id": "browser", "group": "Web", "name": "Browser", "line": "Open pages, click, fill forms, run page scripts", "tip": "Lets Coder use a real browser: open pages, click, fill in forms, run page scripts and upload files.", "rules": ["tabs_context_mcp", "tabs_create_mcp", "navigate", "read_page", "computer", "form_input", "javascript_tool", "file_upload", "browser_batch"], "def": "ask", "note": "Only in chats where Coder's browser is on."},
  {"id": "agent", "group": "Helpers", "name": "Agent", "line": "Start a helper AI", "tip": "Lets Coder start a helper AI for part of the job. Each helper uses more Grok (at most 3 at once, 10 per job).", "rules": ["Agent"], "def": "allow"},
  {"id": "workflow", "group": "Helpers", "name": "Workflow", "line": "Run several helpers from a script", "tip": "Lets Coder run several helpers from a script. Uses more Grok.", "rules": ["Workflow"], "def": "ask"},
  {"id": "sendmessage", "group": "Helpers", "name": "SendMessage", "line": "Message a running helper", "tip": "Lets Coder send a follow-up to a helper it already started.", "rules": ["SendMessage"], "def": "allow"},
  {"id": "croncreate", "group": "Scheduling", "name": "CronCreate", "line": "Run a prompt on a timer", "tip": "Lets Coder run a prompt on a timer, like every hour. Each run uses Grok (at most 24 a day).", "rules": ["CronCreate"], "def": "ask"},
  {"id": "schedulewakeup", "group": "Scheduling", "name": "ScheduleWakeup", "line": "Come back later on its own", "tip": "Lets Coder come back to the chat by itself later, for example to check on a long build.", "rules": ["ScheduleWakeup"], "def": "ask"},
  {"id": "remotetrigger", "group": "Scheduling", "name": "RemoteTrigger", "line": "Scheduled tasks that start new chats", "tip": "Lets Coder set up scheduled tasks that start a new chat on their own.", "rules": ["RemoteTrigger"], "def": "ask"},
  {"id": "artifact", "group": "Sharing", "name": "Artifact", "line": "Publish a page", "tip": "Lets Coder publish a page (HTML or Markdown) that you can open, and share with a link if you choose.", "rules": ["Artifact", "artifact"], "def": "ask"},
  {"id": "senduserfile", "group": "Sharing", "name": "SendUserFile", "line": "Send you a file", "tip": "Lets Coder send you a file to see or download.", "rules": ["SendUserFile"], "def": "allow"},
  {"id": "pushnotification", "group": "Sharing", "name": "PushNotification", "line": "Notify your phone", "tip": "Lets Coder send a notification to your phone, for example when a long job finishes.", "rules": ["PushNotification"], "def": "allow"},
  {"id": "enterworktree", "group": "Side copies", "name": "EnterWorktree", "line": "Make a side copy of the code", "tip": "Lets Coder make a side copy of the code on a new branch, so it can try something without touching the main copy.", "rules": ["EnterWorktree"], "def": "allow"},
  {"id": "exitworktree", "group": "Side copies", "name": "ExitWorktree", "line": "Leave or remove a side copy", "tip": "Lets Coder leave a side copy, keeping it or removing it. Removing asks first if work would be lost.", "rules": ["ExitWorktree"], "def": "ask"},
  {"id": "connector-tools", "group": "Connectors", "name": "Connector tools", "line": "Your connected apps' tools", "tip": "Lets Coder use tools from apps you connected, like Notion or Linear.", "rules": ["mcp__*"], "def": "ask", "note": "Only when you have connectors in the chat."},
  {"id": "connector-files", "group": "Connectors", "name": "Connector files", "line": "List and read a connector's files", "tip": "Lets Coder list and read files your connected apps share.", "rules": ["ListMcpResourcesTool", "ReadMcpResourceTool", "ReadMcpResourceDirTool", "list_mcp_resources", "read_mcp_resource", "read_mcp_resource_dir"], "def": "allow", "note": "Only when a connector shares files."},
  {"id": "skill", "group": "Plugins and skills", "name": "Skill", "line": "Use a saved skill", "tip": "Lets Coder use a saved skill (saved instructions for a kind of job).", "rules": ["Skill"], "def": "allow"},
  {"id": "install-plugin", "group": "Plugins and skills", "name": "Install plugin", "line": "Install a plugin or marketplace", "tip": "Lets Coder install a plugin or add a marketplace.", "rules": ["suggest_plugin_install"], "def": "ask"},
  {"id": "save-skill", "group": "Plugins and skills", "name": "Save skill", "line": "Save a proposed skill", "tip": "Lets Coder save a new skill it wrote for you.", "rules": ["propose_skills"], "def": "ask"},
  {"id": "projects", "group": "Plugins and skills", "name": "Projects", "line": "Read and search your project", "tip": "Lets Coder read and search the files in the project you attached to chats.", "rules": ["projects"], "def": "allow"},
  {"id": "askuserquestion", "group": "Other", "name": "AskUserQuestion", "line": "Ask you a question", "tip": "Lets Coder ask you a multiple-choice question when it needs your choice.", "rules": ["AskUserQuestion"], "def": "allow"},
  {"id": "task-list", "group": "Other", "name": "Task list", "line": "Keep a checklist", "tip": "Lets Coder keep a checklist of the steps it is working through.", "rules": ["TodoWrite", "TaskCreate", "TaskGet", "TaskList", "TaskUpdate"], "def": "allow"},
  {"id": "plan-mode", "group": "Other", "name": "Plan mode", "line": "Make a plan before changing things", "tip": "Lets Coder make a plan for you to approve before it changes anything.", "rules": ["EnterPlanMode", "ExitPlanMode"], "def": "allow"},
  {"id": "reportfindings", "group": "Other", "name": "ReportFindings", "line": "Show code review findings", "tip": "Lets Coder show code review findings as a list card.", "rules": ["ReportFindings"], "def": "allow"},
  {"id": "sendfeedback", "group": "Other", "name": "SendFeedback", "line": "Draft feedback for you", "tip": "Lets Coder draft feedback about Coder for you to review. Nothing is sent unless you press Send.", "rules": ["SendFeedback"], "def": "allow"},
  {"id": "undo", "group": "Other", "name": "Undo", "line": "Undo the last job's changes", "tip": "Lets Coder undo the file changes from its last job.", "rules": ["undo_last_job"], "def": "ask"},
  {"id": "endconversation", "group": "Other", "name": "EndConversation", "line": "End the chat", "tip": "Lets Coder end the chat. Only for abuse, or when you ask and confirm.", "rules": ["EndConversation"], "def": "deny", "note": "Claude Code's rule: it can't be turned off while other tools remain."},
].map((r) => Object.freeze({ ...r, rules: Object.freeze(r.rules) })));
/** Every row with a choice: the Tools page's and the GitHub connector's. */
export const ALL_ROWS = Object.freeze([...TOOL_ROWS, ...GITHUB_ROWS]);
const BY_ID = new Map(ALL_ROWS.map((r) => [r.id, r]));
/** Shell tools whose Ask lets read-only commands through (checked per command on the machine). */
const SHELL_ASK = new Set(["Bash", "PowerShell"]);
/** Claude Code's EndConversation can't be denied while any other tool remains: its Never is shown, not applied. */
const NOT_DENIED = new Set(["EndConversation"]);

/** The owner's stored choices, cleaned: only known rows and the three values. */
export function cleanToolChoices(x) {
  const out = {};
  if (!x || typeof x !== "object" || Array.isArray(x)) return out;
  for (const [k, v] of Object.entries(x)) if (BY_ID.has(k) && TOOL_CHOICE_VALUES.includes(v)) out[k] = v;
  // (A choice saved on the old Tools page's GitHub rows moves to the GitHub connector's rows, unless one is set there.)
  for (const [k, ids] of Object.entries(OLD_GITHUB_ROWS)) if (TOOL_CHOICE_VALUES.includes(x[k])) for (const id of ids) if (!out[id]) out[id] = x[k];
  return out;
}
/** One change: { id, value } where value is allow | ask | deny, or "default" to forget the choice. */
export function changeToolChoice(now, id, value) {
  if (Object.hasOwn(OLD_GITHUB_ROWS, id)) return { error: "GitHub's tools moved to the Connectors page: GitHub." };
  if (!BY_ID.has(id)) return { error: "Coder has no tool “" + String(id).slice(0, 60) + "” on its Tools page." };
  if (value !== "default" && !TOOL_CHOICE_VALUES.includes(value)) return { error: "A choice is Ask, Always allow, Never or Reset to default." };
  const out = cleanToolChoices(now);
  if (value === "default") delete out[id]; else out[id] = value;
  return { choices: out };
}

const arr = (x) => (Array.isArray(x) ? x.filter((y) => typeof y === "string") : []);
/** Whether one of the owner's or repository's rule texts names this tool (whole, with a pattern, or by a wildcard). */
function names(rule, n) {
  const t = String(rule).trim();
  if (t === n || t.startsWith(n + "(")) return true;
  // (A GitHub tool by its connector name too: mcp__github__push_branch, mcp__github, mcp__github__*.)
  const gh = githubMcpName(n);
  if (gh && names(t, gh)) return true;
  if (n === "mcp__*") return t.startsWith("mcp__");
  const x = parseRule(t);
  if (!x) return false;
  if (x.tool === n) return true;
  if (x.mcp && n.startsWith(x.tool + "__")) return true;
  if (x.glob) { try { return new RegExp("^" + x.tool.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$").test(n); } catch { return false; } }
  return false;
}

/**
 * The rules with the owner's tool choices added (see the top of this file). `rules`: the owner's and the repository's,
 * merged (server.mjs withRepoRules). `choices`: cleaned or not. Returns the rules unchanged when nothing is chosen, else a
 * copy with `toolChoices: { allow, ask, deny, aside }`: the names the machine checks itself, and the rows set aside.
 */
export function applyToolChoices(rules, choices) {
  const c = cleanToolChoices(choices);
  const r = rules && typeof rules === "object" ? rules : null;
  if (!Object.keys(c).length) return r;
  const base = { allow: arr(r && r.allow), ask: arr(r && r.ask), deny: arr(r && r.deny) };
  const all = [...base.allow, ...base.ask, ...base.deny];
  const add = { allow: [], ask: [], deny: [] };
  const tc = { allow: [], ask: [], deny: [], aside: [] };
  for (const row of ALL_ROWS) {
    const v = c[row.id];
    if (!v) continue;
    if (row.rules.some((n) => all.some((x) => names(x, n)))) { tc.aside.push(row.id); continue; }
    for (const n of row.rules) {
      if (v === "deny" && NOT_DENIED.has(n)) continue;
      const ruled = n !== "mcp__*" && !GH_NAMES.has(n) && !!parseRule(n) && !(v === "ask" && SHELL_ASK.has(n));
      if (ruled) { if (!add[v].includes(n)) add[v].push(n); } else if (!tc[v].includes(n)) tc[v].push(n);
    }
  }
  return { ...(r || {}), allow: [...base.allow, ...add.allow], ask: [...base.ask, ...add.ask], deny: [...base.deny, ...add.deny], toolChoices: tc };
}
/** The machine's view of a rules object's tool choices: sets of names it checks itself. */
export function toolChoiceSets(rules) {
  const t = rules && typeof rules === "object" && rules.toolChoices && typeof rules.toolChoices === "object" ? rules.toolChoices : {};
  return { allow: new Set(arr(t.allow)), ask: new Set(arr(t.ask)), deny: new Set(arr(t.deny)) };
}
/** The card's line for a call the Tools page asks about. */
export const toolChoiceAskWhy = (name) => "Your Tools page says to ask before Coder uses " + name + ".";
export const toolChoiceDenied = (name) => "Permission to use " + name + " has been denied (the owner's Tools page says Never).";
