// CODER'S ROUTES (2026-11-05), in Coder's own Worker. Off unless CODER_ON is
// "on" (free while testing: nothing is charged).
//
// THE CODE LIVES IN THE USER'S GITHUB (owner, 2026-11-05: "instead of the files
// going to R2 … the code goes through their GitHub account"). A project is one
// of their repositories: Coder clones it in its container, works on its own
// branch (coder/<project>), and after each piece of work commits, pushes that
// branch and opens a pull request into the repository's main branch, as the
// user. Coder's bucket keeps only the chat and the user's GitHub connection
// (encrypted), never their code.
//
// Kept in Coder's bucket, under coder/<user>/:
//   github.json             the GitHub connection (sealed)
//   <project>/meta.json     { id, name, repo, base, branch, turn, saved, status, pr, at }
//   <project>/messages.json the conversation as Coder reads it
//   <project>/events.json   what the chat shows
//   memory/<repo>.md        what Coder learned about that repository (its memory)
//
//   GET  /api/coder/github                       connected? and where to connect
//   GET  /api/coder/github/start                 { url }: the GitHub sign-in to open
//   GET  /api/coder/github/callback?code&state   GitHub sends the user back here
//   GET  /api/coder/github/repos                 the repositories they let Coder use
//   GET  /api/coder/review/settings              Code Review, per repository (owner item 11)
//   POST /api/coder/review/settings              { repo, runs: off|push|open|manual, level: quick|standard|deep }
//   GET  /api/coder/push                         notifications: Coder's push key, the two switches, devices (item 8)
//   POST /api/coder/push/(subscribe|unsubscribe|settings|test)
//   POST /api/coder/github/disconnect
//   GET  /api/coder/projects                     their projects
//   POST /api/coder/projects    { repo, base? }  a project for one of their repositories
//   GET  /api/coder/projects/:id                 its meta and chat
//   POST /api/coder/projects/:id/message { text } start a turn (the text, or an answer)
//   GET  /api/coder/projects/:id/state?since=n   new chat lines; when the turn ends,
//                                                the branch is pushed and the pull request opened
//   POST /api/coder/projects/:id/stop
import { pickModel, CODER_MODELS } from "../container/coder-model.mjs";
/**
 * THE EFFORT SAVED ON AN ACCOUNT, AS IT COUNTS NOW (owner, 2026-11-10: "can you do the effort level on low and make sure
 * it's actually on low"). Coder's default became Low. A "high" saved before then was the old default (a save of the
 * model or effort stored it with them), so it counts as not chosen and Low applies; a pick the page saves from now on
 * carries `pickV` 2 and counts as chosen, High included.
 */
export const PICK_V = 2;
export function savedEffort(saved) {
  if (!saved || typeof saved !== "object") return undefined;
  return saved.pickV === PICK_V || saved.effort !== "high" ? saved.effort : undefined;
}
/**
 * WHAT A MESSAGE'S AI CALLS USED, kept on the chat's record (`usage`, the last message's): how many calls, their input
 * tokens and how many of those xAI's prompt cache served, their output and reasoning tokens, their cost in xAI's ticks
 * (10,000,000,000 to the dollar), the efforts sent ("default" when none was) and the efforts xAI said it used. The auto
 * mode checker's calls are counted apart (`checker`). To check, with the owner's word of 2026-11-10, that the effort is
 * really Low and that the cache works.
 */
/**
 * THE OWNER'S SETTINGS (owner, 2026-11-10: "do the 2 u left out optional, the setting put it in settings"), kept on the
 * account for all its chats and changed in Settings (the gear's menu):
 * - `bgHours`: the longest a background command may run (Claude Code: 2 hours, which BASH_MAX_TIMEOUT_MS raises; Coder's
 *   machine stays on while one runs, so the owner picks it here);
 * - `endDetached`: whether stopping a background command also ends what it started in the background, under setsid or
 *   timeout (Claude Code's docs say it does; its 2.1.322 leaves them running: off is that);
 * - `diskWarnGib`: tell Coder when the work disk has less than this many GiB free (Claude Code's
 *   CLAUDE_CODE_WARN_DISK_FREE_GIB; 0 is off, as Claude Code's is unless set: Bash docs pass 8);
 * - `memWarnGib`: tell Coder when the machine has less than this many GiB of memory available (Claude Code's
 *   CLAUDE_CODE_WARN_MEMORY_FREE_GIB, "a system reminder saying how much is available"; 0 is off, as there);
 * - `hooks`: the owner's own hooks (the owner, 2026-11-10: "yea do all 4"; Claude Code's hooks in its user settings), as the
 *   JSON they typed, in Claude Code's shape, checked when saved (hooksSetting); given to Coder's machine with each message.
 * - `autoMode`: the owner's rules for auto mode's checker (the owner, 2026-11-10: "yea do all of them"; Claude Code's
 *   `autoMode` block, which it reads only from the user's own settings), as JSON text, checked when saved (autoModeSetting);
 * - `denyInstead`: refuse a step that would ask, instead of asking (Claude Code's permissions.denyInsteadOfPrompting).
 * - `autoOff`: Auto mode turned off (Bash docs pass 6; Claude Code's disableAutoMode "disable": "Remove auto mode from the
 *   Shift+Tab cycle. Any session that would otherwise start in auto mode … starts in default instead"): chats start in Accept
 *   edits, Coder's nearest to Claude Code's default mode, and Auto is not offered (noAuto).
 */
export const BG_HOURS = [2, 4, 8, 12, 24], DISK_GIB = [0, 1, 2, 5, 10, 20], MEM_GIB = [0, 1, 2, 4, 8];
export function prefsOf(saved) {
  const s = saved && typeof saved === "object" ? saved : {};
  return {
    bgHours: BG_HOURS.includes(Number(s.bgHours)) ? Number(s.bgHours) : 2,
    endDetached: s.endDetached !== false,
    diskWarnGib: DISK_GIB.includes(Number(s.diskWarnGib)) ? Number(s.diskWarnGib) : 0,
    memWarnGib: MEM_GIB.includes(Number(s.memWarnGib)) ? Number(s.memWarnGib) : 0,
    hooks: typeof s.hooks === "string" && hooksSetting(s.hooks).ok ? s.hooks : "",
    autoMode: typeof s.autoMode === "string" && autoModeSetting(s.autoMode).ok ? s.autoMode : "",
    denyInstead: s.denyInstead === true,
    autoOff: s.autoOff === true,
  };
}
/** A mode under the owner's Settings: Auto, with Auto mode turned off, is Accept edits. */
export const noAuto = (m, saved) => (m === "auto" && prefsOf(saved).autoOff ? "acceptEdits" : m);
/** A change to the settings, checked: `{ prefs }` (only what was sent, with the rest kept) or `{ error }`. */
export function prefsChange(saved, body) {
  const now = prefsOf(saved), b = body && typeof body === "object" ? body : {};
  if ("bgHours" in b && !BG_HOURS.includes(Number(b.bgHours))) return { error: "The longest time for a background command is one of " + BG_HOURS.join(", ") + " hours." };
  if ("endDetached" in b && typeof b.endDetached !== "boolean") return { error: "Stop's choice is on or off." };
  if ("diskWarnGib" in b && !DISK_GIB.includes(Number(b.diskWarnGib))) return { error: "The low-disk warning is one of " + DISK_GIB.join(", ") + " GB (0 is off)." };
  if ("memWarnGib" in b && !MEM_GIB.includes(Number(b.memWarnGib))) return { error: "The low-memory warning is one of " + MEM_GIB.join(", ") + " GB (0 is off)." };
  if ("hooks" in b) { if (typeof b.hooks !== "string") return { error: "The hooks are JSON text." }; const h = hooksSetting(b.hooks); if (!h.ok) return { error: h.error }; }
  let warnings = [];
  if ("autoMode" in b) { if (typeof b.autoMode !== "string") return { error: "The auto mode rules are JSON text." }; const a = autoModeSetting(b.autoMode); if (!a.ok) return { error: a.error }; warnings = a.warnings; }
  if ("denyInstead" in b && typeof b.denyInstead !== "boolean") return { error: "Refusing instead of asking is on or off." };
  if ("autoOff" in b && typeof b.autoOff !== "boolean") return { error: "Turning Auto mode off is on or off." };
  return { prefs: { bgHours: "bgHours" in b ? Number(b.bgHours) : now.bgHours, endDetached: "endDetached" in b ? b.endDetached : now.endDetached, diskWarnGib: "diskWarnGib" in b ? Number(b.diskWarnGib) : now.diskWarnGib, memWarnGib: "memWarnGib" in b ? Number(b.memWarnGib) : now.memWarnGib, hooks: "hooks" in b ? String(b.hooks).trim() : now.hooks, autoMode: "autoMode" in b ? String(b.autoMode).trim() : now.autoMode, denyInstead: "denyInstead" in b ? b.denyInstead : now.denyInstead, autoOff: "autoOff" in b ? b.autoOff : now.autoOff }, ...(warnings.length ? { warnings } : {}) };
}
/** What Coder's machine is given of them with each message. */
export const machinePrefs = (saved) => { const p = prefsOf(saved); return { bgMaxMs: p.bgHours * 3_600_000, endDetached: p.endDetached, diskWarnGib: p.diskWarnGib, memWarnGib: p.memWarnGib, ...(p.denyInstead ? { denyInstead: true } : {}), ...(p.autoOff ? { autoOff: true } : {}) }; };
/** The owner's auto mode rules as Coder's machine takes them (Claude Code's autoMode block), or null. */
export const machineAutoMode = (saved) => { const a = autoModeSetting(prefsOf(saved).autoMode); return a.ok && a.value ? a.value : null; };
/** The owner's hooks as Coder's machine takes them (`{ hooks, disableAllHooks }`), or null. */
export const machineHooks = (saved) => { const h = hooksSetting(prefsOf(saved).hooks); return h.ok && h.value ? h.value : null; };
export function usageSummary(list, turn) {
  const all = (Array.isArray(list) ? list : []).filter((u) => u && typeof u === "object").slice(0, 5000);
  const add = (arr, k) => arr.reduce((n, u) => n + (Number.isFinite(Number(u[k])) && Number(u[k]) > 0 ? Math.round(Number(u[k])) : 0), 0);
  const kinds = (arr, f) => [...new Set(arr.map(f).filter(Boolean))].slice(0, 5);
  const part = (arr) => ({ calls: arr.length, in: add(arr, "in"), cached: add(arr, "cached"), out: add(arr, "out"), reasoning: add(arr, "reasoning"), costTicks: add(arr, "cost_ticks"), efforts: kinds(arr, (u) => String(u.effort || "default").slice(0, 20)), said: kinds(arr, (u) => (typeof u.effortSaid === "string" ? u.effortSaid.slice(0, 20) : "")) });
  const check = all.filter((u) => u.kind === "check");
  return { turn: Number(turn) || 0, ...part(all.filter((u) => u.kind !== "check")), ...(check.length ? { checker: part(check) } : {}) };
}
import { normMode, ruleProblem, ruleWarning, ruleSaved, MODES } from "../container/coder-perms.mjs";
import { hooksSetting } from "../container/coder-hooks.mjs";
import { autoModeSetting } from "../container/coder-checker.mjs";
import { modelAccess } from "./coder-model-gate.mjs";
import { PROJECT_ID, SETUP_SCRIPT_MAX, scrub, secretVar } from "../container/coder-checks.mjs";
// (The check for a secret-looking variable is shared with Coder's machine, which tells Grok of them: coder-checks.mjs.)
export { secretVar };
import { okHost, okPattern, HEADER_RE, KEY_RE, PREFIXES, PATH_RE, headerValue, normSecret, normNetwork, parseEnv, toEnv, normConfig, configSecrets, SECRET_KINDS, notSentWhy, varsDropped } from "../container/coder-secrets.mjs";
import { handleWebhook, loginKey, profileKey, branchKey } from "./coder-mentions.mjs";
import { repoReviewKey, reviewSettingsOf, REVIEW_RUNS, REVIEW_LEVELS } from "./coder-review.mjs";
import { readPush, writePush, cleanSub, vapidKeys, notifyOwner, seenKey, MAX_DEVICES } from "./coder-push.mjs";
import { listEnvs, saveEnvList, readEnvData, writeEnvData, envIdFor, uniqueName, envForRepo, envIdOf, markUsed, envListOut, ENV_NAME, MAX_ENVS, DEFAULT_ENV, setupKeyOf, readEnvCache, writeEnvCache } from "./coder-environments.mjs";
import { FROM_COPY, FROM_COPY_GB, CACHE_PENDING_MS } from "./coder-fly.mjs";
import { summarize, compactHistory, marksAfter } from "./coder-summary.mjs";
import { summaryMessage, filesTouched } from "../container/coder-compact.mjs";
import { egressPass, machineKeyRules, EGRESS_PATH } from "./coder-egress.mjs";
import { watchJob, watchKey, watchBackground, WATCH_PREFIX } from "./coder-watch.mjs";
import { livePass, LIVE_PATH, readLive, dropLive, wholeSteps } from "./coder-live.mjs";
import { gitAccess } from "./coder-git.mjs";
import { githubReady, makeState, readState, newNonce, STATE_COOKIE, signInUrl, installUrl, exchangeCode, saveConnection, forgetConnection, userToken, gh, ghRead, repoAccess, listRepos, openPullRequest, postReview, REPO, BRANCH, seal, unseal } from "./coder-github.mjs";

const MAX_PROJECTS = 50;
const MAX_TEXT = 20000;
/**
 * MESSAGES SENT WHILE CODER WORKS (Claude Code: "Type a message and press Enter while Claude is working. Claude Code queues
 * the message instead of interrupting the turn, and lists the queued entries in the conversation until it sends them"): at
 * most this many wait at once, kept with the chat (queue.json).
 */
export const QUEUE_MAX = 20;
const newQid = () => "q" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
/** The first of what waits to go out when a turn ends: a `!` command alone, or the messages up to the next one (Claude Code: queued commands "run one at a time", messages go out "in the order you typed them"). */
export function nextQueued(queue) {
  const q = Array.isArray(queue) ? queue : [];
  if (!q.length) return [];
  if (q[0].shell) return [q[0]];
  const cut = q.findIndex((x) => x.shell);
  return cut < 0 ? q.slice() : q.slice(0, cut);
}
// IMAGES IN THE CHAT (owner, 2026-11-05, "16"): up to 4 pictures a message, each up to 1.5 MB.
export const MAX_IMAGES = 4;
/** After this long away from a chat, Coder starts its answer with a one-line recap (owner, 2026-11-05). */
export const AWAY_MS = 2 * 60 * 60 * 1000;
export const MAX_IMAGE_BYTES = 1_500_000;
/** The message's pictures, checked: `[{ type, data }]` (base64), or an error text. */
export function checkImages(list) {
  if (!Array.isArray(list) || !list.length) return { images: [] };
  if (list.length > MAX_IMAGES) return { error: "at most " + MAX_IMAGES + " pictures a message" };
  const out = [];
  for (const x of list) {
    const type = String((x && x.type) || "");
    const data = String((x && x.data) || "");
    if (!/^image\/(png|jpeg|webp|gif)$/.test(type)) return { error: "pictures must be PNG, JPEG, WebP or GIF" };
    if (!/^[A-Za-z0-9+/]+=*$/.test(data) || data.length * 0.75 > MAX_IMAGE_BYTES) return { error: "each picture must be under 1.5 MB" };
    out.push({ type, data });
  }
  return { images: out };
}
// REVIEW (owner, 2026-11-05, "5"): Coder reviews its branch, written on the server.
/** The chat's other repositories, as the machine gets them: each on the chat's branch. */
// A READ-ONLY REPOSITORY (owner item 5, like Claude Code: any public repository can be worked on, and the
// work goes back to GitHub "only when your GitHub connection has push access"): what the chat says.
export const keptNote = (repo) => "Kept on Coder's machine (you can read " + repo + " but not push to it, so nothing went to GitHub). See changes shows it, and downloads it as a patch file.";
export const noPrNote = (repo) => "No pull request: you can read " + repo + " but not push to it, so Coder cannot open one there.";
export const extraFor = (meta) => (Array.isArray(meta && meta.repos) ? meta.repos : []).slice(0, 3).map((r) => ({ repo: r.repo, base: r.base, branch: meta.branch, ...(r.readOnly ? { readOnly: true } : {}) }));
export const REVIEWS = {
  code: { label: "Review", text: "Review the changes on this chat's branch compared with BASE_BRANCH (git diff BASE_BRANCH...HEAD). Look for bugs, broken edge cases, missing tests and anything a careful reviewer would flag. Run the tests if there are any. Do NOT change any files: answer with a short list of findings, most serious first, each with the file and line and a one-line fix. If everything looks fine, say so." },
  security: { label: "Security review", text: "Do a security review of the changes on this chat's branch compared with BASE_BRANCH (git diff BASE_BRANCH...HEAD): injection, unsafe input handling, secrets in code, auth or permission mistakes, unsafe dependencies, path traversal, XSS, SSRF. Do NOT change any files: answer with a short list of real risks, most serious first, each with the file and line, why it matters and a one-line fix. If you find nothing serious, say so." },
};
// THE REPO'S ENVIRONMENT (owner, 2026-11-05, "14"): a setup script and the
// owner's own variables, per repository, sealed like the GitHub token.
/** What the page may see of the saved secrets: never the values. */
const KIND_LABEL = { headers: "", body: "body parameter", oauth: "OAuth 2.0 client credentials", gcp: "Google Cloud service account", aws: "AWS SigV4" };
// (A key that is never sent says so, and why: notSentWhy, Bash docs pass 9, part F.)
export const secretList = (secrets) => { const list = (secrets || []).map(normSecret).filter(Boolean); return list.map((s, i) => ({ id: s.id, name: s.name, kind: s.kind, hosts: s.hosts, host: s.hosts[0], paths: s.paths,
  headers: s.kind === "headers" ? s.headers.map((h) => ({ name: h.name, prefix: h.prefix })) : [{ name: KIND_LABEL[s.kind] + (s.kind === "body" ? " " + s.config.param : s.kind === "aws" ? " " + s.config.service + " " + s.config.region : ""), prefix: "" }],
  header: s.kind === "headers" ? s.headers[0].name : KIND_LABEL[s.kind], at: s.at, ...(notSentWhy(list, i) ? { notSent: notSentWhy(list, i) } : {}) })); };
export const envKey = (uid, repo) => "coder/" + uid + "/env/" + String(repo).replace("/", "__") + ".json";
export async function readEnv(env, bucket, uid, repo) {
  const o = await bucket.get(envKey(uid, repo));
  const none = { script: "", vars: {}, secrets: [], network: normNetwork(null) };
  if (!o) return none;
  try {
    const rec = JSON.parse(await o.text()); const v = await unseal(env, rec.box);
    return { script: String(v.script || ""), vars: v.vars && typeof v.vars === "object" ? v.vars : {}, secrets: (Array.isArray(v.secrets) ? v.secrets : []).map(normSecret).filter(Boolean), network: normNetwork(v.network) };
  } catch { return none; }
}
/** A path's end without the full stop, comma or unmatched bracket of the sentence around it (as tidyPath in container/coder-agent.mjs). */
function tidyPath(p) {
  p = String(p).replace(/[.,]+$/, "");
  for (const [o, c] of [["(", ")"], ["[", "]"]]) while (p.endsWith(c) && p.split(c).length > p.split(o).length) p = p.slice(0, -1).replace(/[.,]+$/, "");
  return p;
}
/** @path mentions in a message, as a note for Coder. */
export function fileMentions(text) {
  // The same paths Coder's machine reads into the message (mentionedPaths in container/coder-agent.mjs); "@src/" is a folder.
  const paths = [...new Set([...String(text).matchAll(/(?:^|\s)@([\w.()\[\]+~@,/-]+\.\w+|[\w()\[\]+~@,-]+\/[\w.()\[\]+~@,/-]*)/g)].map((m) => tidyPath(m[1])).filter((p) => p && !p.split("/").includes("..")))].slice(0, 20);
  return paths.length ? "\n\n(The owner pointed at these files: " + paths.join(", ") + ".)" : "";
}
// SEVERAL CHATS AT ONCE (owner, 2026-11-05: "no limit"): each chat has its own
// container and a user may have any number working at once. CODER_MAX_RUNNING
// (a setting) puts a per-person limit back when Coder opens to other users.
export function maxRunning(env) { const n = Number(env && env.CODER_MAX_RUNNING); return Number.isInteger(n) && n > 0 ? n : Infinity; }
// MEMORY PER REPO (owner, 2026-11-05): what Coder learns about a repository,
// kept between chats, read at the start of each turn.
/** Comments on the changes, checked, as the words Coder reads (2026-11-05: on the server). */
export function commentsText(list) {
  if (!Array.isArray(list) || !list.length) return "";
  const lines = list.slice(0, 20).map((c) => {
    const file = String((c && c.file) || "").slice(0, 300);
    const line = Number.isInteger(c && c.line) && c.line > 0 ? c.line : 0;
    const quote = String((c && c.quote) || "").replace(/\s+/g, " ").slice(0, 200);
    const text = String((c && c.text) || "").trim().slice(0, 500);
    return file && text ? "- " + file + (line ? " line " + line : "") + (quote ? " (`" + quote + "`)" : "") + ": " + text : "";
  }).filter(Boolean);
  return lines.length ? "Comments on the changes:\n" + lines.join("\n") : "";
}
const settingsKey = (uid) => ["coder", uid, "settings.json"].join("/");
/**
 * THE CHAT'S OWN LINK (the page opens a chat from /?chat=<id>, as a notification does): every command of Coder's gets it,
 * like Claude Code's CLAUDE_CODE_REMOTE_SESSION_ID in a cloud session ("Use this to put a traceable link in PR bodies,
 * commit messages, Slack posts, or generated reports").
 */
export const chatLinkOf = (env, id) => String((env && env.APP_ORIGIN) || "https://gofarther.dev").replace(/\/+$/, "") + "/?chat=" + encodeURIComponent(String(id || ""));
/**
 * THE ACCOUNT'S EMAIL, AS COMMANDS ARE CHECKED FOR IT (Bash docs pass 5; Claude Code 2.1.321: "the account email check …
 * refuse[s] only a shell command that holds your email and names a User-Agent, without asking"): the machine gets its
 * length and SHA-256, never the address, and looks for it in Grok's commands ("<length>:<sha256>"; "" without an email).
 */
export async function emailMark(email) {
  const e = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!e || !e.includes("@") || e.length > 254) return "";
  const one = async (x) => x.length + ":" + [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(x)))].map((b) => b.toString(16).padStart(2, "0")).join("");
  // (Claude Code 2.1.323 also looks for the address without its quote marks and backslashes, o'brien@… as obrien@…: then
  // a second mark, after a comma.)
  const bare = e.replace(/["'`\\]/g, "");
  return bare !== e ? (await one(e)) + "," + (await one(bare)) : one(e);
}
/**
 * THE CHAT'S LINK ON ITS COMMITS AND PULL REQUESTS (the owner, 2026-11-09: "yes i want that"; Claude Code's cloud sessions add a
 * `Claude-Session: <url>` trailer to each commit and the session's link to pull request descriptions, unless its setting
 * attribution.sessionUrl is false): Coder's machine adds a `Coder-Chat: <link>` trailer to each commit it makes for the chat,
 * and its pull requests end "Made with Coder: <link>". Off when the chat's environment sets CODER_CHAT_LINK=false. Only the
 * chat's owner, signed in, can open the link.
 */
export async function chatLinkFor(env, bucket, uid, meta, id) {
  try {
    const data = await readEnvData(env, bucket, uid, await envIdOf(bucket, uid, meta));
    if (/^(0|false|no|off)$/i.test(String((data && data.vars && data.vars.CODER_CHAT_LINK) ?? "").trim())) return "";
  } catch { /* the default: on */ }
  return chatLinkOf(env, id);
}
export const madeWith = (link) => "\n\nMade with Coder" + (link ? ": " + link : ".");
/**
 * THE OWNER'S ! COMMANDS, KEPT ON THEIR ACCOUNT FOR EACH REPOSITORY (Claude Code's shell mode: "type a partial command and
 * press Tab to complete from previous ! commands in the current project"): the page's Tab completes from them, in any chat
 * of that repository, on any device. The newest SHELL_HIST_MAX a repository, for the SHELL_HIST_REPOS used last.
 */
export const SHELL_HIST_MAX = 100, SHELL_HIST_REPOS = 30;
const shellHistKey = (uid) => ["coder", uid, "shell-history.json"].join("/");
export async function rememberShell(bucket, uid, repo, cmd) {
  const c = String(cmd || "").trim().slice(0, 2000), r = String(repo || "");
  if (!c || !/^[\w.-]+\/[\w.-]+$/.test(r)) return;
  const all = await getJson(bucket, shellHistKey(uid), {});
  const was = all && typeof all === "object" && Array.isArray(all[r]) ? all[r].filter((x) => typeof x === "string" && x !== c) : [];
  const next = { [r]: [c, ...was].slice(0, SHELL_HIST_MAX) };
  for (const [k, v] of Object.entries(all && typeof all === "object" ? all : {})) if (k !== r && Array.isArray(v) && Object.keys(next).length < SHELL_HIST_REPOS) next[k] = v;
  await putJson(bucket, shellHistKey(uid), next);
}
export async function shellHistoryOf(bucket, uid, repo) {
  const all = await getJson(bucket, shellHistKey(uid), {});
  const list = all && typeof all === "object" && Array.isArray(all[String(repo || "")]) ? all[String(repo || "")] : [];
  return list.filter((x) => typeof x === "string").slice(0, SHELL_HIST_MAX);
}

/**
 * THE OWNER'S PERMISSION RULES FOR EACH REPOSITORY (the permission modes, 2026-11-09; Claude Code saves "Yes, and don't ask
 * again" to the repository's .claude/settings.local.json, "Permanently per repository and command", and lists every rule in
 * /permissions): kept on their account, never in the repository; Coder gets them with each message.
 */
const rulesKey = (uid, repo) => ["coder", uid, "rules", String(repo).replace(/[^A-Za-z0-9._-]+/g, "__") + ".json"].join("/");
export const RULES_MAX = 200;
export async function rulesOf(bucket, uid, repo) {
  const r = await getJson(bucket, rulesKey(uid, repo), {});
  const out = { allow: [], ask: [], deny: [] };
  for (const k of Object.keys(out)) out[k] = [...new Set((Array.isArray(r && r[k]) ? r[k] : []).filter((x) => typeof x === "string" && x.length <= 400 && ruleSaved(x)))].slice(0, RULES_MAX);
  // (Its working folders: Claude Code's additionalDirectories.)
  out.dirs = [...new Set((Array.isArray(r && r.dirs) ? r.dirs : []).filter((x) => typeof x === "string" && !dirProblem(x)).map((x) => x.trim()))].slice(0, DIRS_MAX);
  // (Whether the owner trusts the repository's own settings, Claude Code's workspace trust: see setTrust.)
  if (r && r.trust === true) out.trust = true;
  return out;
}
/**
 * THE REPOSITORY'S ADDITIONAL WORKING FOLDERS (the owner, 2026-11-10: "yea do all of them"; Claude Code's
 * permissions.additionalDirectories, "Additional working directories for file access"): folders on Coder's machine, outside
 * the project, where Coder works as in the project. A full path, or one in Coder's home (~/…); "" when it is right.
 */
export const DIRS_MAX = 20;
export function dirProblem(d) {
  const t = String(d ?? "").trim();
  if (!t) return "Give the folder's path.";
  if (t.length > 400) return "That path is too long.";
  if (/[\u0000-\u001f\u007f]/.test(t)) return "That path has characters a path can't have.";
  if (!(t.startsWith("/") || t === "~" || t.startsWith("~/"))) return "A working folder is a full path (/data/notes) or one in Coder's home (~/notes).";
  if (t.split("/").includes("..")) return "A working folder's path can't use ..";
  if (/^\/+$/.test(t)) return "Not the whole machine: name a folder.";
  return "";
}
/** Adds (or, with `remove`, takes out) rules of one kind; a rule moves out of the other kinds when added to one. */
/**
 * TRUSTING A REPOSITORY'S OWN SETTINGS (Bash docs pass 6; Claude Code's workspace trust: "permissions.allow rules and
 * permissions.additionalDirectories entries in a project's .claude/settings.json grant capability, so Claude Code applies them
 * only after you accept the workspace trust dialog"): on or off, kept with the repository's rules; Coder's machine then uses
 * them (repoSettings).
 */
export async function setTrust(bucket, uid, repo, on) {
  const now = await rulesOf(bucket, uid, repo);
  if (on === true) now.trust = true; else delete now.trust;
  await putJson(bucket, rulesKey(uid, repo), now);
  return now;
}
/** A chat's session rules as a job gives them back (`{ allow, ask, deny }`, plain rule texts, 50 each), or null. */
export function sessionRulesOf(x) {
  if (!x || typeof x !== "object") return null;
  const out = {};
  for (const k of ["allow", "ask", "deny"]) out[k] = (Array.isArray(x[k]) ? x[k] : []).filter((r) => typeof r === "string" && r.length > 0 && r.length <= 400).slice(0, 50);
  return out;
}
/** What a turn's request carries of the chat's session rules (from PermissionRequest hooks): `{ sessionRules }` or nothing. */
export const sessionRulesOn = (meta) => { const s = sessionRulesOf(meta && meta.sessionRules); return s ? { sessionRules: s } : {}; };
export async function changeRules(bucket, uid, repo, kind, list, { remove = false } = {}) {
  const now = await rulesOf(bucket, uid, repo);
  if (kind === "dirs") {
    const dirs = (Array.isArray(list) ? list : []).map((x) => String(x || "").trim()).filter((x) => !dirProblem(x));
    if (!dirs.length) return now;
    now.dirs = remove ? now.dirs.filter((x) => !dirs.includes(x)) : [...new Set([...now.dirs, ...dirs])].slice(-DIRS_MAX);
    await putJson(bucket, rulesKey(uid, repo), now);
    return now;
  }
  const want = (Array.isArray(list) ? list : []).map((x) => String(x || "").trim()).filter((x) => x.length <= 400 && ruleSaved(x));
  if (!["allow", "ask", "deny"].includes(kind) || !want.length) return now;
  if (remove) now[kind] = now[kind].filter((x) => !want.includes(x));
  else {
    for (const k of ["allow", "ask", "deny"]) if (k !== kind) now[k] = now[k].filter((x) => !want.includes(x));
    now[kind] = [...new Set([...now[kind], ...want])].slice(-RULES_MAX);
  }
  await putJson(bucket, rulesKey(uid, repo), now);
  return now;
}

const memoryKey = (uid, repo) => ["coder", uid, "memory", String(repo).replace(/[^A-Za-z0-9._-]+/g, "__") + ".md"].join("/");
export const MEMORY_MAX = 25000;
const MAX_EVENTS = 4000;

export function coderOn(env) { return !!env && env.CODER_ON === "on"; }
/** Whether this signed-in user may use Coder: their email is in CODER_USERS (comma-separated). */
export function coderAllowed(env, user) {
  const email = user && typeof user.email === "string" ? user.email.trim().toLowerCase() : "";
  if (!email) return false;
  return String((env && env.CODER_USERS) || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean).includes(email);
}

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const keyOf = (uid, ...rest) => ["coder", uid, ...rest].join("/");
async function getJson(bucket, key, fallback) {
  const o = await bucket.get(key);
  if (!o) return fallback;
  try { return JSON.parse(await o.text()); } catch { return fallback; }
}
const putJson = (bucket, key, v) => bucket.put(key, JSON.stringify(v), { httpMetadata: { contentType: "application/json" } });
/**
 * A DELETED CHAT'S BRANCH RECORDS (branchKey: which chat a branch's pull request news and `@coder` comments go to): its own
 * branch's and the one it works on (auto-fix may have moved it onto a pull request's), only while they name this chat.
 */
export async function dropBranchRecords(bucket, uid, id, meta) {
  if (!bucket || typeof bucket.delete !== "function" || !meta || typeof meta.repo !== "string") return 0;
  let n = 0;
  for (const b of new Set([meta.branch, "coder/" + id].filter((x) => typeof x === "string" && x))) {
    const k = branchKey(meta.repo, b);
    const rec = await getJson(bucket, k, null);
    if (rec && rec.uid === uid && rec.id === id) { await bucket.delete(k); n++; }
  }
  return n;
}

/** A CHAT IN THE LIST (2026-11-05, the owner: "each coder can have its own session"): each
 *  project is one chat, with its own history, branch and pull request. */
function listEntry(meta) {
  // `waiting`: its last job ended asking the owner something; `ran`: how long that job took (the desktop
  // app's notifications, owner item 8).
  return { id: meta.id, name: meta.repo, repo: meta.repo, title: meta.title || "", status: meta.status || "idle", pr: meta.pr ? meta.pr.number : null, at: meta.at, waiting: meta.waiting || null, ran: Number(meta.ran) || 0 };
}
// THE AUDIT (2026-11-05): one shared index.json lost updates when two chats
// changed at once. Now each chat keeps only its own meta.json, and the list is
// read from them, so nothing is overwritten.
async function saveMeta(bucket, uid, meta) {
  await putJson(bucket, keyOf(uid, meta.id, "meta.json"), meta);
}
/**
 * THE CHAT'S PERMISSION MODE CHANGED (the page's mode menu, /plan): only the mode is written, on the chat as it is now, so a
 * job's end saved meanwhile is never undone. `modeAt`: when the owner picked it (a card's switch older than that is not kept).
 */
async function saveMode(bucket, uid, id, mode) {
  const now = await getJson(bucket, keyOf(uid, id, "meta.json"), null);
  if (!now) return null;
  const next = { ...now, mode, modeAt: Date.now() };
  await saveMeta(bucket, uid, next);
  return next;
}
/** The owner's variable and key values a chat must never keep, and this job's (sealed when it started; used up here). */
async function hiddenValues(env, bucket, uid, meta) {
  const envNow = await readEnvData(env, bucket, uid, await envIdOf(bucket, uid, meta));
  let jobKeys = [];
  const ho = await bucket.get(keyOf(uid, meta.id, "hide.json"));
  if (ho) { try { const v = await unseal(env, JSON.parse(await ho.text()).box); if (Array.isArray(v)) jobKeys = v.map(String); } catch { /* none */ } await bucket.delete(keyOf(uid, meta.id, "hide.json")); }
  // (The owner's variables: only those that look secret, by name or value: secretVar. Round 5 of the live test, 2026-11-12:
  // every value was hidden, so a variable set to `false` turned every "false" in the chat into "[hidden]".)
  return [...Object.entries(envNow.vars).filter(([k, v]) => secretVar(k, v)).map(([, v]) => String(v)), ...envNow.secrets.flatMap((x) => [...x.headers.flatMap((h) => { try { return [h.value, headerValue(h)]; } catch { return [h.value]; } }), ...configSecrets(x.kind, x.config)]), ...jobKeys].filter((v) => v.length >= 4);
}
/** Those values hidden in a job's steps: their text, the lines a write shows under its step (the owner, 2026-11-09), and the files a command changed. */
export function hideIn(events, values) {
  const hide = (x) => { let t = String(x); for (const v of values) t = t.split(v).join("[hidden]"); return t; };
  if (values.length) for (const ev of events) {
    for (const f of ["text", "output", "command"]) if (typeof ev[f] === "string") ev[f] = hide(ev[f]);
    if (ev && ev.change && Array.isArray(ev.change.lines)) ev.change.lines = ev.change.lines.map(hide);
    if (ev && Array.isArray(ev.problems)) ev.problems = ev.problems.map((p) => (p && typeof p === "object" ? { ...p, message: hide(p.message || ""), code: hide(p.code || "") } : p));
    // The files a command changed (their names and lines, under its step).
    if (ev && ev.files && typeof ev.files === "object") {
      if (Array.isArray(ev.files.files)) ev.files.files = ev.files.files.map((f) => (f && typeof f === "object" ? { ...f, path: hide(f.path || ""), lines: Array.isArray(f.lines) ? f.lines.map(hide) : [] } : f));
      if (Array.isArray(ev.files.others)) ev.files.others = ev.files.others.map(hide);
    }
  }
  return events;
}
/**
 * A JOB THE MACHINE LOST (it restarted, slept, or stopped answering; or it was
 * gone when Stop was pressed): what the job saved as it went (coder-live.mjs)
 * is put back in the chat, its values hidden, with `note` after it, and Coder
 * is told the job was cut off and its unsaved changes are gone (like Claude
 * Code, which keeps "your conversation history" but not the work that was
 * still running). Then the chat is free. Answers `{ steps, ev, idle }`.
 */
async function endLostJob(env, bucket, uid, meta, note) {
  const id = meta.id;
  const kept = await readLive(env, bucket, uid, id, meta.turn).catch(() => ({ events: [], messages: null }));
  const steps = hideIn(kept.events, kept.events.length ? await hiddenValues(env, bucket, uid, meta).catch(() => []) : []);
  const ev = { at: Date.now(), ...note };
  const old = await getJson(bucket, keyOf(uid, id, "events.json"), []);
  await putJson(bucket, keyOf(uid, id, "events.json"), [...old, ...steps, ev].slice(-MAX_EVENTS));
  if (steps.length || kept.messages) {
    const asked = (steps.find((e) => e && e.type === "user") || {}).text;
    // The chat's saved history, then this job's part as far as it came (to its last whole step).
    const saved = await getJson(bucket, keyOf(uid, id, "messages.json"), []);
    const base = wholeSteps([...(Array.isArray(saved) ? saved : []), ...(kept.messages || [])]);
    const told = [
      { role: "user", appNote: true, content: "(Note from Coder's app, not the owner: Coder's machine stopped during the last job, so the job ended there" + (typeof asked === "string" && asked && !(kept.messages && kept.messages.length) ? ". The owner had asked: \"" + asked.slice(0, 2000) + "\"" : "") + ". Its steps are kept in the chat, but the changes it made in the files since the last save are gone: the branch has only what was saved before.)" },
      { role: "assistant", content: "Understood: that job was cut off, and its unsaved changes are gone." },
    ];
    await putJson(bucket, keyOf(uid, id, "messages.json"), capHistory([...base, ...told]));
  }
  const idle = { ...meta, status: "idle", saved: meta.turn, at: Date.now() };
  await saveMeta(bucket, uid, idle);
  await dropLive(bucket, uid, id).catch(() => {});
  if (typeof bucket.delete === "function") await bucket.delete(watchKey(uid, id, meta.turn)).catch(() => {});
  return { steps, ev, idle };
}
/** The user's chats, newest first, read from each chat's own meta.json. */
/** The chat's pull request if it is still open on GitHub; null when merged, closed or gone. */
export async function prStillOpen(token, repo, pr, fetchFn = fetch) {
  if (!pr || !pr.number) return null;
  const r = await gh(token, "/repos/" + repo + "/pulls/" + Number(pr.number), { fetchFn }).catch(() => null);
  if (!r || !r.ok) return r && r.status === 404 ? null : pr;
  return r.data && r.data.state === "open" && !r.data.merged ? pr : null;
}
export async function listChats(bucket, uid) {
  const prefix = keyOf(uid) + "/";
  const keys = [];
  let cursor;
  do {
    const page = await bucket.list({ prefix, cursor });
    for (const o of page.objects || []) if (/^[^/]+\/meta\.json$/.test(o.key.slice(prefix.length))) keys.push(o.key);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  const metas = await Promise.all(keys.map((k) => getJson(bucket, k, null)));
  return metas.filter((m) => m && m.id).map(listEntry).sort((a, b) => (b.at || 0) - (a.at || 0));
}
/**
 * AUTO-FIX FOR A PULL REQUEST, ASKED FOR IN THE CHAT (owner item 2; Claude Code's docs, read 2026-11-07:
 * "Any existing PR: paste the PR URL into a session and tell Claude to auto-fix it"; "tell Claude to stop
 * watching the PR"). Only a pull request of the chat's repository whose branch is there too (a fork's
 * cannot be pushed to), and not one another chat already has; the chat then works on its branch.
 * Answers { note, meta? } (meta: what changes on the chat).
 */
export async function autofixFor(env, bucket, uid, meta, want, token, fetchFn = fetch) {
  const on = !(want && want.on === false);
  const m = /^(?:https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/pull\/)?#?(\d{1,9})(?:[/?#].*)?$/.exec(String((want && want.pr) || "").trim());
  if (!m) return { note: "Auto-fix was not changed: give the pull request's address or number." };
  const repo = m[1] || meta.repo, number = Number(m[2]);
  if (repo.toLowerCase() !== String(meta.repo).toLowerCase()) return { note: "Auto-fix was not changed: pull request #" + number + " is in " + repo + "; open a chat on that repository for it." };
  // A read-only chat cannot push a fix (owner item 5).
  if (on && meta.readOnly) return { note: "Auto-fix was not turned on: you can read " + meta.repo + " but not push to it, so Coder could not push a fix." };
  if (!on) {
    if (meta.pr && Number(meta.pr.number) === number && meta.autofix === true) return { meta: { autofix: false }, note: "Auto-fix is off for pull request #" + number + "." };
    return { note: "Auto-fix was not on for pull request #" + number + " in this chat." };
  }
  const r = await gh(token, "/repos/" + meta.repo + "/pulls/" + number, { fetchFn });
  const d = r && r.ok && r.data ? r.data : null;
  if (!d) return { note: "Auto-fix was not turned on: GitHub shows no pull request #" + number + " in " + meta.repo + " that Coder can see." };
  if (d.state !== "open") return { note: "Auto-fix was not turned on: pull request #" + number + " is closed." };
  const head = d.head || {}, into = d.base || {};
  if (!head.repo || !into.repo || head.repo.id !== into.repo.id) return { note: "Auto-fix was not turned on: pull request #" + number + " comes from a fork, whose branch Coder cannot push to." };
  const branch = String(head.ref || ""), base = String(into.ref || "");
  if (!BRANCH.test(branch) || !BRANCH.test(base)) return { note: "Auto-fix was not turned on: pull request #" + number + "'s branch has a name Coder cannot use." };
  const owner = await getJson(bucket, branchKey(meta.repo, branch), null);
  if (owner && !(owner.uid === uid && owner.id === meta.id)) return { note: "Auto-fix was not turned on: pull request #" + number + "'s branch belongs to another chat; turn it on there." };
  if (!owner) await bucket.put(branchKey(meta.repo, branch), JSON.stringify({ uid, id: meta.id }), { httpMetadata: { contentType: "application/json" } });
  const moved = branch !== meta.branch;
  return {
    meta: { autofix: true, autofixTries: 0, pr: { number, url: String(d.html_url || "") }, ...(moved ? { branch, base, commits: [], pushed: true } : {}) },
    note: "Auto-fix is on for pull request #" + number + ": when a check fails or you review it, Coder fixes it in this chat" + (moved ? ", on its branch " + branch + " (this chat now works on that branch)" : "") + ". Turn it off with the Auto-fix button, or ask Coder.",
  };
}

/** How long a chat may say "working" with no machine answering before it is freed. */
export const STALE_MS = 15 * 60 * 1000;
/**
 * A job is marked running before its machine is handed it; for this long, a machine without it is still waking up, not lost.
 * 8 minutes: a machine being made or updated first fetches Coder's image (up to FLY_PULL_MS, 5 minutes), then sets up.
 */
export const START_GRACE_MS = 8 * 60 * 1000;
/** How much conversation Coder keeps (the audit): the oldest is dropped first, starting again at a message from the user. */
export const HISTORY_MAX = 400 * 1024;
export function capHistory(messages, max = HISTORY_MAX) { return capHistoryInfo(messages, max).messages; }
/** capHistory, and how many of the messages went from the front (`dropped`): Rewind's marks move up by that many. */
export function capHistoryInfo(messages, max = HISTORY_MAX) {
  if (!Array.isArray(messages)) return { messages: [], dropped: 0 };
  let out = messages, dropped = 0;
  while (out.length && JSON.stringify(out).length > max) {
    // At one of the owner's messages (or a summary), never at a note of Coder's app.
    const next = out.findIndex((m, i) => i > 0 && m && m.role === "user" && m.appNote !== true);
    if (next > 0) { out = out.slice(next); dropped += next; continue; }
    // ONE JOB ALONE IS OVER THE SIZE (the review, 2026-11-08: it used to leave nothing at all): its long answers are cut
    // shorter instead, and only if that is not enough does the job's own record go, keeping the owner's message.
    for (const keep of [2000, 300]) {
      out = out.map((m) => (m && (m.role === "tool" || m.appNote === true) && typeof m.content === "string" && m.content.length > keep ? { ...m, content: m.content.slice(0, keep) + "\n[… cut short in the saved chat: read the file again if you need it]" } : m));
      if (JSON.stringify(out).length <= max) return { messages: out, dropped };
    }
    // The owner's message stays where Rewind's mark for it now points (the second review, 2026-11-08: the mark was lost).
    const at = out.findIndex((m) => m && m.role === "user" && m.appNote !== true && typeof m.content === "string");
    return at >= 0 ? { messages: [{ ...out[at], content: out[at].content.slice(0, 20000) }, { role: "assistant", content: "(The steps of this job were too long to keep in the saved chat.)" }], dropped: dropped + at } : { messages: [], dropped: messages.length };
  }
  return { messages: out, dropped };
}
/** WHAT "UNDO" WOULD UNDO (owner, 2026-11-06, "3"): the chat's last commit, and whether the last job made it. */
export function lastJobFor(meta) {
  const cs = meta && Array.isArray(meta.commits) ? meta.commits : [];
  const l = cs[cs.length - 1];
  return l ? { title: String(l.title || "").slice(0, 200), changed: l.turn === meta.turn } : { title: "", changed: false };
}

/** A chat's title: the first words of its first message. */
/** A chat's background commands still running, as its machine lists them (tool 4, part 2), checked: at most 20. */
export function bgListOf(x) {
  return (Array.isArray(x) ? x : []).slice(0, 20).filter((b) => b && /^job\d{1,6}$/.test(String(b.id || ""))).map((b) => ({ id: String(b.id), desc: String(b.desc || "").slice(0, 200), command: String(b.command || "").split("\n")[0].slice(0, 200), at: Number(b.at) || 0, deadline: Number(b.deadline) || 0 }));
}
export function chatTitle(text) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  return t.length > 60 ? t.slice(0, 57).replace(/\s+\S*$/, "") + "…" : t;
}

/** A project id from a repository's name: lowercase words joined by dashes, with a short suffix. */
export function projectIdFor(name, rand = Math.random) {
  const base = String(name || "project").split("/").pop().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "project";
  // 8 random characters (the audit: 4 could repeat, and two chats would share a branch).
  return (base.length < 3 ? "project-" + base : base) + "-" + Math.floor(rand() * 36 ** 4).toString(36).padStart(4, "0") + Math.floor(rand() * 36 ** 4).toString(36).padStart(4, "0");
}

// ── REWIND'S "RESTORE CODE", LIKE CLAUDE CODE'S CHECKPOINTS (the owner, 2026-11-13: "yea do those 2 things") ──
/** The project's own names for the files a job's write and edit changed (the machine's `edited`), kept with its commit. */
export const EDITED_KEEP = 200, EDITED_PATH_KEEP = 300;
const editedOf = (r) => (r && Array.isArray(r.edited) ? r.edited.filter((x) => typeof x === "string" && x && x.length <= EDITED_PATH_KEEP && !x.startsWith("/") && !x.split("/").includes("..")) : null);
/**
 * WHAT A JOB'S COMMIT KEEPS FOR REWIND: `edited` (the files Coder's file tools changed in it, Claude Code's tracked files:
 * "Claude Code tracks all changes made by its file editing tools") and `tracked` (it changed a file those tools had changed by
 * then, whatever changed it: Claude Code's "Under each prompt, the rewind menu counts changes to files Claude had already
 * edited, whatever made them", so the page offers "Restore code" for it). Nothing for a job the machine gave no list for
 * (Rewind then reverts the later jobs whole, as before).
 */
export function commitTracking(commits, result, pushed) {
  const edited = editedOf(result);
  if (!edited || (result && result.editedCut === true) || edited.length > EDITED_KEEP) return {};
  const known = new Set(edited);
  for (const c of Array.isArray(commits) ? commits : []) for (const x of Array.isArray(c.edited) ? c.edited : []) known.add(x);
  const files = pushed && Array.isArray(pushed.files) ? pushed.files : null;
  const tracked = edited.length > 0 || !files || pushed.filesCut === true || files.some((f) => known.has(f));
  return { edited, tracked };
}
/**
 * WHAT "RESTORE CODE" PUTS BACK, rewinding to before message `turn` (Claude Code's checkpoints: "A file that only Bash commands
 * changed isn't tracked and stays as it is"; "Once Claude has edited a file with its file editing tools in your conversation,
 * /rewind undoes changes that Bash commands make to that file afterward"): every file Coder's file tools changed in the chat,
 * as it was before that message, or, for one they first changed after it, as it was before the job that first changed it.
 * `{ later, items: [{ path, before }] }` (the content to go back to: the one in the parent of commit `before`), or null when a
 * job on record has no list of its own (one from before 2026-11-13): the later jobs are then reverted whole, as before.
 */
export function restorePlan(commits, turn) {
  const cs = Array.isArray(commits) ? commits : [];
  const later = cs.filter((c) => Number(c.turn) >= turn);
  if (!later.length) return { later, items: [] };
  if (!cs.every((c) => Array.isArray(c.edited))) return null;
  const first = new Map();
  for (const c of cs) for (const p of c.edited) if (!first.has(p)) first.set(p, c);
  const items = [...first].map(([path, c]) => ({ path, before: Number(c.turn) >= turn ? c.sha : later[0].sha }));
  return { later, items };
}
/** Claude Code's warning for the files a code restore skipped (2.1.323), naming them, as the chat can show them. */
export const RESTORE_SKIP_WHY = "the tracked path is (or became) a link or other non-regular file, its directory changed since the checkpoint, or its backup could not be safely read";
export function restoreSkipped(paths) {
  const n = paths.length;
  return "Restored the code, but skipped " + n + " " + (n === 1 ? "file" : "files") + ": " + RESTORE_SKIP_WHY + ". Skipped files were left untouched: " + namesSaid(paths) + ".";
}
/** Paths named in a sentence: the first 20, then how many more. */
export function namesSaid(paths, most = 20) {
  const list = paths.slice(0, most).map((p) => String(p).slice(0, 200));
  return list.join(", ") + (paths.length > most ? " and " + (paths.length - most) + " more" : "");
}
/** Whether rewinding to before message `turn` has code to restore (the page's own check, coder.js's codeToRestore, is the same). */
export function codeToRestore(commits, turn) {
  const cs = Array.isArray(commits) ? commits : [];
  const later = cs.filter((c) => Number(c.turn) >= turn);
  if (!later.length) return false;
  if (!cs.every((c) => Array.isArray(c.edited))) return true;
  return later.some((c) => c.tracked !== false);
}

/** The first line of the agent's summary, as a commit message and a pull request title. */
export function commitTitle(summary) {
  const first = String(summary || "").split(/\n|(?<=\.)\s/)[0].trim();
  return (first || "Changes by Coder").slice(0, 120);
}

/**
 * WHAT A SAVE LEFT OUT, SAID IN THE CHAT (the audit, 2026-11-06). Coder's
 * machine never runs git inside a folder that holds its own repository (the
 * audit), so such a folder is not saved; the owner is told which, instead of
 * reading "Saved to the branch" alone. `left`: `[{ path, kind }]` from the machine.
 */
export function leftOutNote(left) {
  const list = (Array.isArray(left) ? left : []).filter((x) => x && typeof x.path === "string" && x.path);
  if (!list.length) return "";
  const what = { repo: "a folder with its own git repository", link: "a submodule's folder that is a link", submodule: "a submodule whose commit could not be read" };
  const named = list.slice(0, 8).map((x) => x.path.replace(/[\u0000-\u001f`]/g, "").slice(0, 120) + " (" + (what[x.kind] || what.repo) + ")");
  return "Not saved: " + named.join(", ") + (list.length > 8 ? " and " + (list.length - 8) + " more" : "") + ". Coder's app never runs git inside these" +
    (list.some((x) => x.kind === "repo" || !what[x.kind]) ? "; to save a folder's files, remove its .git." : ".");
}

/**
 * Handle one /api/coder/ request. `deps`: `authUser(request) → { id } | { signin } | { down } | null`
 * (only `id` is signed in; coder-auth.mjs),
 * `container(name) → { fetch(Request) }`, optional `fetchFn` (GitHub calls).
 */
export async function handleCoder(request, env, ctx, deps) {
  if (!coderOn(env)) return json({ error: "Coder is not switched on yet." }, 404);
  const bucket = env.CODER_BUCKET;
  if (!bucket) return json({ error: "storage is not available" }, 503);
  const fetchFn = deps.fetchFn || fetch;
  const url = new URL(request.url);
  const parts = url.pathname.replace(/^\/api\/coder\/?/, "").split("/").filter(Boolean);

  // ── THE GITHUB SIGN-IN'S RETURN: a plain visit from GitHub, with no sign-in
  // header; the signed state says whose it is. ──
  if (parts[0] === "github" && parts[1] === "callback") {
    const back = String(env.APP_ORIGIN || "https://gofarther.dev") + "/";
    if (!githubReady(env)) return Response.redirect(back + "?github=unavailable", 302);
    const cookie = String(request.headers.get("cookie") || "").split(/;\s*/).find((c) => c.startsWith(STATE_COOKIE + "="));
    const uid = await readState(env, url.searchParams.get("state"), Date.now(), cookie ? decodeURIComponent(cookie.slice(STATE_COOKIE.length + 1)) : "");
    const code = url.searchParams.get("code");
    if (!uid || !code) return Response.redirect(back + "?github=failed", 302);
    try {
      const tok = await exchangeCode(env, code, fetchFn);
      const me = await gh(tok.access, "/user", { fetchFn });
      const login = me.ok && me.data ? String(me.data.login || "") : "";
      // A different GitHub account than before: the old login no longer points here (the audit).
      const before = await getJson(bucket, "coder/" + uid + "/github.json", null);
      if (before && before.login && before.login.toLowerCase() !== login.toLowerCase() && typeof bucket.delete === "function") await bucket.delete(loginKey(before.login));
      await saveConnection(env, bucket, uid, tok, login);
      // Who this GitHub login is on Coder, for @coder in comments.
      if (login) await bucket.put(loginKey(login), JSON.stringify({ uid }), { httpMetadata: { contentType: "application/json" } });
    } catch { return Response.redirect(back + "?github=failed", 302); }
    return Response.redirect(back + "?github=connected", 302);
  }

  // ── @CODER IN GITHUB COMMENTS: GitHub's signed notification (coder-mentions.mjs).
  // The job then runs as the person who connected that GitHub account. ──
  if (parts[0] === "github" && parts[1] === "webhook" && request.method === "POST") {
    return handleWebhook(request, env, ctx, { fetchFn, coder: (req, who) => handleCoder(req, env, ctx, { ...deps, authUser: async () => who }) });
  }

  const user = await deps.authUser(request);
  // THE EMAILED CODE, REALLY REQUIRED (the audit, 2026-11-06): a genuine Supabase
  // session without the Worker's proof of both sign-in steps is told to sign in
  // again, and `signin` lets the page tell this from other refusals. When
  // Supabase cannot be asked, nobody is signed out for it.
  if (user && user.signin === true && typeof user.id !== "string") return json({ error: "Sign in again.", signin: true }, 401);
  if (user && user.down === true && typeof user.id !== "string") return json({ error: "Sign-in could not be checked. Try again in a minute." }, 503);
  if (!user || typeof user.id !== "string") return json({ error: "sign in first" }, 401);
  // WHILE TESTING (2026-11-05, the owner: "turn it on", free while testing):
  // only the emails in CODER_USERS may use it. Empty list = nobody.
  if (!coderAllowed(env, user)) return json({ error: "Coder is not open to this account yet." }, 403);
  const uid = user.id;

  if (parts[0] === "github") {
    if (!githubReady(env)) return json({ error: "GitHub is not set up for Coder yet." }, 503);
    const what = parts[1] || "";
    if (!what && request.method === "GET") {
      // The account's email, so @coder on GitHub can check it is allowed.
      if (user.email) await bucket.put(profileKey(uid), JSON.stringify({ email: String(user.email) }), { httpMetadata: { contentType: "application/json" } });
      const t = await userToken(env, bucket, uid, { fetchFn });
      return json({ ok: true, connected: !!t, login: t ? t.login : "", install: installUrl(env) });
    }
    if (what === "start" && request.method === "GET") {
      // The random value goes in a cookie for the whole gofarther.dev (the callback is on coder.gofarther.dev).
      const nonce = newNonce();
      const res = json({ ok: true, url: signInUrl(env, await makeState(env, uid, Date.now(), nonce)) });
      const host = new URL(String(env.CODER_PUBLIC_URL || "https://coder.gofarther.dev")).hostname.split(".").slice(-2).join(".");
      res.headers.append("set-cookie", STATE_COOKIE + "=" + nonce + "; Path=/api/coder/github; Domain=" + host + "; Max-Age=900; HttpOnly; Secure; SameSite=Lax");
      return res;
    }
    if (what === "disconnect" && request.method === "POST") {
      const before = await getJson(bucket, "coder/" + uid + "/github.json", null);
      if (before && before.login && typeof bucket.delete === "function") await bucket.delete(loginKey(before.login));
      await forgetConnection(bucket, uid);
      return json({ ok: true });
    }
    if (what === "repos" && request.method === "GET") {
      const t = await userToken(env, bucket, uid, { fetchFn });
      if (!t) return json({ error: "connect GitHub first", connect: true }, 409);
      try { return json({ ok: true, repos: await listRepos(t.token, fetchFn), install: installUrl(env) }); }
      catch { return json({ error: "GitHub could not be reached" }, 502); }
    }
    return json({ error: "not found" }, 404);
  }

  // CODE REVIEW, PER REPOSITORY (owner item 11, like Claude Code's "Review runs" and review level): set by an
  // owner who may push to the repository (Claude Code: "Adding a repository needs write access to it"), where
  // Coder's app is installed (its reviews are posted as the app). Off: no record.
  if (parts[0] === "review" && parts[1] === "settings") {
    if (request.method === "GET") return json({ ok: true, repos: await reviewSettingsOf(bucket, uid) });
    if (request.method !== "POST") return json({ error: "method" }, 405);
    let body = {}; try { body = await request.json(); } catch { body = {}; }
    const repo = String(body.repo || "").trim();
    if (!REPO.test(repo)) return json({ error: "pick one of your GitHub repositories" }, 400);
    const runs = String(body.runs || "");
    if (runs !== "off" && !REVIEW_RUNS.includes(runs)) return json({ error: "pick when reviews run" }, 400);
    const level = REVIEW_LEVELS.includes(body.level) ? body.level : "standard";
    const t = await userToken(env, bucket, uid, { fetchFn });
    if (!t) return json({ error: "connect GitHub first", connect: true }, 409);
    const r = await repoAccess(t.token, repo, { fetchFn });
    if (!r.ok || !r.data.permissions) return json({ error: "Add " + repo + " to Coder in GitHub first: Code review works where Coder's app is installed.", install: installUrl(env) }, 403);
    if (r.readOnly) return json({ error: "Code review needs write access to " + repo + "." }, 403);
    const name = String(r.data.full_name || repo);
    if (runs === "off") { if (typeof bucket.delete === "function") await bucket.delete(repoReviewKey(name)); return json({ ok: true, repo: name, runs: "off" }); }
    await bucket.put(repoReviewKey(name), JSON.stringify({ repo: name, uid, runs, level, at: Date.now() }), { httpMetadata: { contentType: "application/json" } });
    return json({ ok: true, repo: name, runs, level });
  }

  // NOTIFICATIONS (owner item 8, like Claude Code's "Push when Claude decides" and "Push when actions
  // required"): this account's devices (each a browser's push subscription, kept sealed) and its two switches.
  if (parts[0] === "push") {
    const cfg = await readPush(env, bucket, uid);
    if (parts.length === 1 && request.method === "GET") return json({ ok: true, key: (await vapidKeys(env, bucket)).publicKey, decides: cfg.decides, actions: cfg.actions, devices: cfg.subs.length });
    if (request.method !== "POST") return json({ error: "method" }, 405);
    let body = {}; try { body = await request.json(); } catch { body = {}; }
    if (parts[1] === "subscribe") {
      const s = cleanSub(body);
      if (!s) return json({ error: "that is not a browser's push address" }, 400);
      const subs = [...cfg.subs.filter((x) => x.endpoint !== s.endpoint), { ...s, at: Date.now() }].slice(-MAX_DEVICES);
      await writePush(env, bucket, uid, { ...cfg, subs });
      return json({ ok: true, devices: subs.length });
    }
    if (parts[1] === "unsubscribe") {
      const subs = cfg.subs.filter((x) => x.endpoint !== String(body.endpoint || ""));
      await writePush(env, bucket, uid, { ...cfg, subs });
      return json({ ok: true, devices: subs.length });
    }
    if (parts[1] === "settings") {
      const next = { ...cfg, ...(typeof body.decides === "boolean" ? { decides: body.decides } : {}), ...(typeof body.actions === "boolean" ? { actions: body.actions } : {}) };
      await writePush(env, bucket, uid, next);
      return json({ ok: true, decides: next.decides, actions: next.actions });
    }
    if (parts[1] === "test") {
      const r = await notifyOwner(env, uid, { kind: "decides", title: "Coder", body: "Notifications are on for this device." }, { fetchFn, force: true });
      return json({ ok: true, sent: r.sent, ...(r.why ? { why: r.why } : {}) });
    }
    return json({ error: "not found" }, 404);
  }

  // THE MODEL LIST AND THE USER'S PICK (kept on their account).
  if (parts[0] === "settings") {
    const saved = await getJson(bucket, settingsKey(uid), {});
    // (`mode`: the permission mode new chats start in: the last one picked other than Plan, as in Claude Code's desktop app
    // and VS Code, where "Picking Plan … applies to that conversation only".)
    const startMode = (m) => noAuto(m === "acceptEdits" ? "acceptEdits" : "auto", saved);
    if (request.method === "GET") return json({ ok: true, models: CODER_MODELS, pick: { ...pickModel(saved.model, savedEffort(saved)), mode: startMode(saved.mode) }, prefs: prefsOf(saved) });
    if (request.method !== "POST") return json({ error: "method" }, 405);
    let body = {}; try { body = await request.json(); } catch { body = {}; }
    // Settings (the gear's menu) send `prefs`; the model, effort and mode pickers send their own fields.
    const change = body.prefs && typeof body.prefs === "object" ? prefsChange(saved, body.prefs) : { prefs: prefsOf(saved) };
    if (change.error) return json({ error: change.error }, 400);
    const chosen = pickModel(body.model ?? saved.model, body.effort ?? savedEffort(saved));
    const mode = noAuto(MODES.includes(body.mode) && body.mode !== "plan" ? body.mode : startMode(saved.mode), { ...saved, ...change.prefs });
    // (A page from before Low became the default sends no pickV: what it saves still counts as the old default.)
    const keepPick = body.prefs && typeof body.prefs === "object" && !("model" in body) && !("effort" in body) ? { model: saved.model, effort: saved.effort } : chosen;
    await putJson(bucket, settingsKey(uid), { ...saved, ...keepPick, mode, ...(body.pickV === PICK_V || saved.pickV === PICK_V ? { pickV: PICK_V } : {}), ...change.prefs });
    return json({ ok: true, pick: { ...chosen, mode }, prefs: change.prefs, ...(change.warnings ? { warnings: change.warnings } : {}) });
  }
  // THE OWNER'S PERMISSION RULES FOR A REPOSITORY (Claude Code's /permissions: "lists all permission rules", where you add
  // or remove them): GET ?repo=owner/name; POST { repo, kind: allow | ask | deny, add | remove: "Bash(npm test *)" }.
  if (parts[0] === "permissions") {
    const repo = request.method === "GET" ? String(url.searchParams.get("repo") || "") : "";
    // A CHANGE WHILE A JOB RUNS (Bash docs pass 8; Claude Code: rule changes take effect at the next tool call): each running
    // chat of this repository is given its new rules at once (its machine's /rules), not only its next message.
    const tellRunning = async (repoName, rules) => {
      try {
        const page = await bucket.list({ prefix: WATCH_PREFIX + uid + "__" });
        const ids = [...new Set((page.objects || []).map((o) => { const rest = String(o.key).slice((WATCH_PREFIX + uid + "__").length); const k = rest.lastIndexOf("__"); return k > 0 ? rest.slice(0, k) : ""; }).filter((x) => PROJECT_ID.test(x)))].slice(0, 20);
        await Promise.all(ids.map(async (cid) => {
          const m = await getJson(bucket, keyOf(uid, cid, "meta.json"), null);
          if (!m || m.repo !== repoName || m.status !== "running") return;
          await deps.container(uid + "-" + cid).fetch(new Request("http://coder/rules", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: cid, rules }) })).catch(() => null);
        }));
      } catch { /* the next message has them */ }
    };
    // (Claude Code's short warning row for each rule it keeps but warns about, keyed "kind\nrule": Bash docs pass 5.)
    const notices = (rules) => { const out = {}; for (const k of ["allow", "ask", "deny"]) for (const x of (rules && rules[k]) || []) { const w = ruleWarning(k, x); if (w && w.notice) out[k + "\n" + x] = w.notice; } return out; };
    if (request.method === "GET") { if (!REPO.test(repo)) return json({ error: "which repository?" }, 400); const rules = await rulesOf(bucket, uid, repo); return json({ ok: true, repo, rules, notices: notices(rules) }); }
    if (request.method !== "POST") return json({ error: "method" }, 405);
    let body = {}; try { body = await request.json(); } catch { body = {}; }
    const r = String(body.repo || "");
    if (!REPO.test(r)) return json({ error: "which repository?" }, 400);
    const kind = String(body.kind || "");
    // TRUSTING THE REPOSITORY'S OWN SETTINGS (setTrust): { kind: "trust", on }.
    if (kind === "trust") {
      if (typeof body.on !== "boolean") return json({ error: "Trust is on or off." }, 400);
      const rules = await setTrust(bucket, uid, r, body.on);
      return json({ ok: true, repo: r, rules, notices: notices(rules) });
    }
    if (!["allow", "ask", "deny", "dirs"].includes(kind)) return json({ error: "kind is allow, ask, deny or dirs" }, 400);
    // A WORKING FOLDER (Claude Code's additionalDirectories): its path checked, then kept with the repository's rules.
    if (kind === "dirs") {
      const d = String(body.add ?? body.remove ?? "").trim();
      if (body.add !== undefined && dirProblem(d)) return json({ error: dirProblem(d) }, 400);
      const rules = await changeRules(bucket, uid, r, "dirs", [d], { remove: body.remove !== undefined });
      return json({ ok: true, repo: r, rules, notices: notices(rules) });
    }
    const rule = String(body.add ?? body.remove ?? "").trim();
    // (A rule Claude Code would skip as malformed is refused in its words; one it keeps but that never matches, a rule on
    // the command itself, Bash(command:…), or one naming no known tool, is saved with its warning, as Claude Code does.)
    if (ruleProblem(rule)) return json({ error: ruleProblem(rule) }, 400);
    if (!ruleSaved(rule)) return json({ error: "Coder knows rules like Bash(npm test *), Bash(git push *), Bash(run_in_background:true), Bash, WebFetch(domain:example.com), WebFetch, Read(./.env), Edit(src/**), Read, Edit, Write, Grep, Glob or Monitor" }, 400);
    const rules = await changeRules(bucket, uid, r, kind, [rule], { remove: body.remove !== undefined });
    await tellRunning(r, rules);
    // A RULE CLAUDE CODE KEEPS BUT WARNS ABOUT (Bash docs pass 5: its error reference, "Has a wildcard before the rest of the
    // command"; its rule check's :* warnings): saved, with the warning in its words.
    const w = body.remove === undefined ? ruleWarning(kind, rule) : null;
    return json({ ok: true, repo: r, rules, notices: notices(rules), ...(w ? { warning: w.warning } : {}) });
  }

  // A SLASH COMMAND: { text, project? } → { note?, open?, url?, pick? }.
  // (The slash commands were removed on 2026-11-05, owner: each one already has a button.)

  // ENVIRONMENTS, LIKE CLAUDE CODE'S (owner, 2026-11-06, coder-environments.mjs):
  // the user's own, named, not tied to repos; Default is made for them.
  //   GET  /environments                 the list (names only)
  //   POST /environments { name, script?, network?, repos? }   a new one
  //   POST /environments/:id { name? | archive? }               rename, archive (never Default)
  if (parts[0] === "environments") {
    const list = await listEnvs(bucket, uid);
    if (parts.length === 1 && request.method === "GET") return json({ ok: true, environments: envListOut(list) });
    if (request.method !== "POST") return json({ error: "method" }, 405);
    let body = {}; try { body = await request.json(); } catch { body = {}; }
    if (parts.length === 1) {
      if (list.filter((e) => !e.archived).length >= MAX_ENVS) return json({ error: "at most " + MAX_ENVS + " environments" }, 409);
      const name = String(body.name || "").trim();
      if (!ENV_NAME.test(name)) return json({ error: "give it a name (up to 40 characters)" }, 400);
      const script = typeof body.script === "string" ? body.script.replace(/\r/g, "") : "";
      if (script.length > SETUP_SCRIPT_MAX) return json({ error: "the setup script is over 64 KB" }, 413);
      const id = envIdFor(name, list);
      const e = { id, name: uniqueName(name, list), at: Date.now(), repos: (Array.isArray(body.repos) ? body.repos : []).map(String).filter((r) => REPO.test(r)).slice(0, 20) };
      if (e.repos.length) e.used = Date.now(); // made for these repos: their next chat starts with it
      await writeEnvData(env, bucket, uid, id, { script, vars: {}, secrets: [], network: normNetwork(body.network && typeof body.network === "object" ? body.network : null) });
      list.push(e);
      await saveEnvList(bucket, uid, list);
      return json({ ok: true, environment: { id, name: e.name, isDefault: false }, environments: envListOut(list) });
    }
    const target = parts.length === 2 ? list.find((e) => e.id === parts[1]) : null;
    if (!target) return json({ error: "no such environment" }, 404);
    if (target.id === DEFAULT_ENV && (body.name !== undefined || body.archive !== undefined)) return json({ error: "the Default environment keeps its name and is never archived" }, 400);
    if (body.name !== undefined) {
      const n = String(body.name).trim();
      if (!ENV_NAME.test(n)) return json({ error: "give it a name (up to 40 characters)" }, 400);
      target.name = uniqueName(n, list.filter((e) => e !== target));
    }
    if (body.archive === true) target.archived = true;
    if (body.archive === false) delete target.archived;
    await saveEnvList(bucket, uid, list);
    return json({ ok: true, environment: { id: target.id, name: target.name, archived: !!target.archived }, environments: envListOut(list) });
  }

  if (parts[0] !== "projects") return json({ error: "not found" }, 404);
  if (parts.length === 1) {
    const index = await listChats(bucket, uid);
    if (request.method === "GET") return json({ ok: true, projects: index });
    if (request.method !== "POST") return json({ error: "method" }, 405);
    if (!githubReady(env)) return json({ error: "GitHub is not set up for Coder yet." }, 503);
    if (index.length >= MAX_PROJECTS) return json({ error: "at most " + MAX_PROJECTS + " projects" }, 409);
    let body = {}; try { body = await request.json(); } catch { body = {}; }
    const repo = String(body.repo || "").trim();
    if (!REPO.test(repo)) return json({ error: "pick one of your GitHub repositories" }, 400);
    const t = await userToken(env, bucket, uid, { fetchFn });
    if (!t) return json({ error: "connect GitHub first", connect: true }, 409);
    // ANY REPOSITORY THIS USER CAN READ, LIKE CLAUDE CODE (owner item 5; its docs: "a session can clone any
    // public repository", and push back "only when your GitHub connection has push access"): GitHub itself
    // says, as them. One they cannot push to is READ-ONLY: Coder's work stays on its machine.
    const r = await repoAccess(t.token, repo, { fetchFn });
    if (!r.ok) return json({ error: "GitHub shows you no repository named " + repo + ". For a private one, add it to Coder in GitHub first.", install: installUrl(env) }, 404);
    // A job started from GitHub (like Claude Code's GitHub app: "the triggering user must have write access").
    if (r.readOnly && body.needPush === true) return json({ error: "Coder cannot write to " + repo + ": add it to Coder in GitHub first", install: installUrl(env) }, 403);
    const base = typeof body.base === "string" && BRANCH.test(body.base) ? body.base : String(r.data.default_branch || "main");
    if (!BRANCH.test(base)) return json({ error: "this repository's main branch has a name Coder cannot use" }, 400);
    let id = projectIdFor(repo);
    // Never on top of an existing chat or someone's branch.
    for (let k = 0; k < 5 && ((await bucket.get(keyOf(uid, id, "meta.json"))) || (await bucket.get(branchKey(repo, "coder/" + id)))); k++) id = projectIdFor(repo);
    // ITS ENVIRONMENT (like Claude Code, picked before the first message): the one
    // asked for, else the one its repo's chats use, else Default.
    const envs = await listEnvs(bucket, uid);
    const asked = typeof body.envId === "string" ? envs.find((e) => e.id === body.envId && !e.archived) : null;
    const envId = asked ? asked.id : await envForRepo(bucket, uid, repo, envs);
    // ITS PERMISSION MODE (Claude Code's cloud sessions: picked "both when you create the task and while the session
    // runs"): the one picked on the new chat's page, else the account's last pick (never Plan, which is for one chat).
    const picks = await getJson(bucket, settingsKey(uid), {});
    const mode = noAuto(MODES.includes(body.mode) ? body.mode : picks.mode === "acceptEdits" ? "acceptEdits" : "auto", picks);
    const meta = { id, name: repo, repo, title: "", base, branch: "coder/" + id, turn: 0, saved: 0, status: "idle", pr: null, at: Date.now(), envId, mode, ...(r.readOnly ? { readOnly: true } : {}) };
    await saveMeta(bucket, uid, meta);
    // Whose this branch is, so GitHub's news about its pull request (failed
    // checks, reviews) can reach the right chat (auto-fix, coder-mentions.mjs).
    // (A read-only chat's branch never reaches GitHub.)
    if (!meta.readOnly) await bucket.put(branchKey(repo, meta.branch), JSON.stringify({ uid, id }), { httpMetadata: { contentType: "application/json" } });
    return json({ ok: true, project: meta });
  }

  const id = parts[1];
  if (!PROJECT_ID.test(id)) return json({ error: "bad project" }, 400);
  const metaKey = keyOf(uid, id, "meta.json");
  const meta = await getJson(bucket, metaKey, null);
  if (!meta) return json({ error: "no such project" }, 404);
  const box = () => deps.container(uid + "-" + id);
  const call = (path, init) => box().fetch(new Request("http://coder" + path, init));
  const post = (path, body, more = {}) => call(path, { method: "POST", headers: { "content-type": "application/json", ...more }, body: JSON.stringify(body) });
  // A SUMMARY BY CODER'S OWN MODEL (owner items 3 and 9), on this Worker (deps.summarize in tests).
  const summarizeFn = (m, f) => (typeof deps.summarize === "function" ? deps.summarize(m, f) : summarize(env, m, f, { fetchFn }));
  const action = parts[2] || "";

  if (!action && request.method === "GET") return json({ ok: true, project: meta, events: await getJson(bucket, keyOf(uid, id, "events.json"), []), queue: await getJson(bucket, keyOf(uid, id, "queue.json"), []), shellHistory: await shellHistoryOf(bucket, uid, meta.repo) });

  if (action === "message" && request.method === "POST") {
    let body = {}; try { body = await request.json(); } catch { body = {}; }
    // THE MODE THE PAGE SHOWS goes with the message (the page's mode menu also changes it at once, /mode). And /plan (Claude
    // Code: "prefixing a single prompt with /plan" enters plan mode): the chat goes to Plan mode, and the rest is the
    // message; /plan alone only changes the mode. Never from GitHub, where strangers write.
    if (body.fromGithub !== true) {
      const planned = typeof body.text === "string" ? /^\s*\/plan(?:\s+([\s\S]*))?$/i.exec(body.text) : null;
      const want = planned ? "plan" : MODES.includes(body.mode) ? noAuto(body.mode, await getJson(bucket, settingsKey(uid), {})) : "";
      if (planned) body.text = String(planned[1] || "").trim();
      if (want && want !== normMode(meta.mode)) {
        const saved = await saveMode(bucket, uid, id, want);
        if (saved) Object.assign(meta, { mode: saved.mode, modeAt: saved.modeAt });
        if (meta.status === "running") await post("/mode", { project: id, mode: want }).catch(() => null);
      }
      if (planned && !body.text && !(Array.isArray(body.images) && body.images.length)) return json({ ok: true, project: meta, mode: "plan" });
    }
    const review = typeof body.review === "string" && REVIEWS[body.review] ? REVIEWS[body.review] : null;
    // A TURN ONLY TO TELL CODER ITS BACKGROUND COMMAND ENDED (tool 4, part 2; Claude Code "re-invokes you when it exits"):
    // started by the every-minute run (coder-watch.mjs), with no message of the owner's; the machine starts it only when it
    // has something to tell.
    const wake = body.fromBackground === true && !review;
    const said = review ? review.label : wake ? "" : String(body.text || "").trim();
    // THE OWNER'S OWN COMMAND (tool 4, part 3; Claude Code's shell mode: "! npm test" runs it directly, its output goes into
    // the conversation, and Claude responds to it): a message starting with "!", typed in the page (never from GitHub, where
    // strangers write), with no pictures or comments. The machine runs it as Coder's commands run.
    const shell = !review && !wake && body.fromGithub !== true && /^!/.test(said) && !commentsText(body.comments) && !(Array.isArray(body.images) && body.images.length) ? said.replace(/^!\s*/, "") : null;
    if (shell === "") return json({ error: "write a command after !" }, 400);
    const notes = commentsText(body.comments);
    const text = notes ? notes + (said ? "\n\n" + said : "") : said;
    const pics = checkImages(body.images);
    if (pics.error) return json({ error: pics.error }, 400);
    if (!text && !pics.images.length && !wake) return json({ error: "write something first" }, 400);
    if (text.length > MAX_TEXT) return json({ error: "the message is over " + MAX_TEXT + " characters" }, 413);
    if (shell && body.fromQueue !== true) await rememberShell(bucket, uid, meta.repo, shell).catch(() => {});
    if (meta.status === "running") {
      // QUEUED WHILE CODER WORKS (Claude Code's queue): the owner's message, or `!` command, typed in the page; not a review,
      // a /compact, pictures or line comments, nor anything from GitHub. A message goes to the running job at once (Coder
      // reads it when its running tool calls finish, in this turn); a command waits for the job's end. What is left when
      // the job ends goes out next, by itself (the state route below).
      const queueable = !review && !wake && body.fromGithub !== true && body.autofix !== true && !notes && !pics.images.length && !!said && !/^\/compact\b/i.test(said);
      if (!queueable) return json({ error: pics.images.length || notes ? "Coder is still working: send pictures or line comments once it is done" : "Coder is still working on the last message" }, 409);
      const queue = await getJson(bucket, keyOf(uid, id, "queue.json"), []);
      if (queue.length >= QUEUE_MAX) return json({ error: QUEUE_MAX + " messages are already waiting for Coder. Wait for it to read them." }, 429);
      const entry = { qid: newQid(), text: said, at: Date.now(), ...(shell !== null ? { shell: true } : {}) };
      const waiting = [...queue, entry];
      await putJson(bucket, keyOf(uid, id, "queue.json"), waiting);
      if (!entry.shell) await post("/queue", { project: id, qid: entry.qid, text: entry.text }).catch(() => null);
      return json({ ok: true, queued: true, qid: entry.qid, queue: waiting, project: meta });
    }
    // /compact [what to keep] (like Claude Code's: "Summarizes the conversation to free up context. Accepts
    // optional focus instructions"): the conversation so far becomes one summary for Coder. Made on the chat's machine, as a
    // job of its own that Coder does not answer, so the owner's PreCompact, PostCompact and SessionStart ("compact") hooks run
    // around it, as Claude Code's do (round 5 of the live test, 2026-11-12: made here, away from the machine, they never ran).
    const compact = /^\/compact(?:\s+([\s\S]*))?$/i.exec(said);
    const compactJob = compact && !notes && !pics.images.length ? { focus: String(compact[1] || "").replace(/\s+/g, " ").trim().slice(0, 300) } : null;
    if (compactJob) {
      const msgs = await getJson(bucket, keyOf(uid, id, "messages.json"), []);
      if (!Array.isArray(msgs) || !msgs.length) return json({ error: "There is nothing to summarize yet." }, 400);
    }
    const t = await userToken(env, bucket, uid, { fetchFn });
    if (!t) return json({ error: "connect GitHub again: the connection has ended", connect: true }, 409);
    const running = (await listChats(bucket, uid)).filter((x) => x.id !== id && x.status === "running").length;
    if (running >= maxRunning(env)) return json({ error: maxRunning(env) + " chats are already working. Wait for one to finish, or stop one." }, 429);
    let messages = await getJson(bucket, keyOf(uid, id, "messages.json"), []);
    // A LONG CHAT IS SUMMARIZED, NOT CUT (owner item 3, like Claude Code's auto-compact): past
    // COMPACT_HISTORY_AT, its older jobs become one summary for Coder; the chat still shows them all.
    let baseMarks = Array.isArray(meta.marks) ? meta.marks : [];
    // (Not before the owner's /compact, which summarizes all of it.)
    const squeezed = compactJob ? { messages, from: 0, to: 0 } : await compactHistory(messages, summarizeFn);
    if (squeezed.to) {
      messages = squeezed.messages;
      await putJson(bucket, keyOf(uid, id, "messages.json"), messages);
      const evs = await getJson(bucket, keyOf(uid, id, "events.json"), []);
      await putJson(bucket, keyOf(uid, id, "events.json"), [...evs, { at: Date.now(), type: "note", text: "Compacted: the earlier part of this chat is now a summary for Coder, to make room (like Claude Code's auto-compact). The chat still shows it all." }].slice(-MAX_EVENTS));
      baseMarks = marksAfter(baseMarks, { from: squeezed.from, to: squeezed.to });
    }
    const saved = await getJson(bucket, settingsKey(uid), {});
    const pick = pickModel(body.model || saved.model, body.effort || savedEffort(saved));
    // THE CHAT'S ENVIRONMENT (like Claude Code's: picked before the first message).
    const envId = await envIdOf(bucket, uid, meta);
    const envEntry = (await listEnvs(bucket, uid)).find((e) => e.id === envId) || { id: envId, name: "Default" };
    const setup = await readEnvData(env, bucket, uid, envId);
    const environment = { name: envEntry.name, isDefault: envId === DEFAULT_ENV };
    // THE ENVIRONMENT'S SAVED COPY OF ITS SETUP (owner, 2026-11-07: "ok start"; like Claude Code's
    // cache; on Fly.io only): a new chat's disk is made from it (its machine then skips the setup),
    // and a setup run on a fresh disk is saved as the copy (below, once the machine says it waits).
    const copyOn = typeof deps.snapshot === "function" && typeof deps.cacheUsable === "function" && !!String(setup.script || "").trim();
    const setupKey = copyOn ? await setupKeyOf(setup) : "";
    const copyNow = copyOn ? await readEnvCache(bucket, uid, envId) : null;
    // ONLY A COPY FLY.IO HAS FINISHED (live test #25, 2026-11-07: a chat started a minute after the copy
    // was asked for; Fly takes minutes to finish one, and refused it). A chat's first message asks Fly
    // about one not yet known to be finished; while it is being finished, this chat runs the setup
    // itself (said in the chat) and makes no second copy.
    let useCopy = null, copyWait = "";
    if (copyNow && deps.cacheUsable(copyNow, setupKey)) {
      if (copyNow.ready === true) useCopy = copyNow;
      else if (meta.turn === 0 && typeof deps.copyState === "function") {
        const st = await deps.copyState(copyNow).catch(() => null);
        if (st && st.status === "created") {
          useCopy = { ...copyNow, ready: true, ...(st.retention > 0 ? { retention: st.retention } : {}) };
          await writeEnvCache(bucket, uid, envId, useCopy).catch(() => {});
        } else if (!(st && st.status === "gone") && Date.now() - Number(copyNow.at) < CACHE_PENDING_MS) {
          const mins = Math.max(1, Math.round((Date.now() - Number(copyNow.at)) / 60000));
          copyWait = "Setup: Fly.io is still finishing the environment's saved copy of the setup (asked for " + mins + " minute" + (mins === 1 ? "" : "s") + " ago), so this chat runs the setup script itself. New chats start from the copy once it is finished.";
        }
      }
    }
    // A job started from GitHub (whose text strangers can write) gets the setup script but NOT the owner's variables.
    if (body.fromGithub === true) { setup.vars = {}; setup.secrets = []; }
    // NETWORK SECRETS go to the machine's proxy only (never into the AI's text).
    // THE KEYS STAY HERE (2026-11-06, like Claude Code): the machine gets where they
    // apply and this job's pass for the Worker's egress; the Worker adds them.
    const secrets = machineKeyRules(setup.secrets);
    // This job's key values, kept sealed on our side to hide them in its chat (never sent to the machine).
    const jobValues = (setup.secrets || []).flatMap((s) => [...s.headers.flatMap((h) => { try { return [h.value, headerValue(h)]; } catch { return [h.value]; } }), ...configSecrets(s.kind, s.config)]).filter(Boolean);
    const egress = { url: String(env.CODER_PUBLIC_URL || "https://gofarther.dev").replace(/\/+$/, "") + EGRESS_PATH, chat: uid + "/" + id, turn: meta.turn + 1, pass: await egressPass(env, uid + "/" + id, meta.turn + 1) };
    delete setup.secrets;
    // THE CHAT SAVED AS IT GOES (like Claude Code, 2026-11-06): where the machine sends this job's steps, with its own pass.
    const livePassNow = env.CODER_PUBLIC_URL ? await livePass(env, uid + "/" + id, meta.turn + 1) : "";
    const live = livePassNow ? { url: String(env.CODER_PUBLIC_URL).replace(/\/+$/, "") + LIVE_PATH, chat: uid + "/" + id, turn: meta.turn + 1, pass: livePassNow } : null;
    const mo = await bucket.get(memoryKey(uid, meta.repo));
    const memory = mo ? (await mo.text()).slice(0, MEMORY_MAX) : "";
    // WHERE THIS MESSAGE STARTS in the saved chat and in Coder's history, so
    // Rewind can go back to just before it (like Claude Code's /rewind, 2026-11-06).
    const evCount = (await getJson(bucket, keyOf(uid, id, "events.json"), [])).length;
    // (Not for the owner's /compact: no message of the owner's to go back to; its summary moves the marks when it ends.)
    const marks = compactJob ? baseMarks : [...baseMarks, { turn: meta.turn + 1, ev: evCount, msg: Array.isArray(messages) ? messages.length : 0 }].slice(-100);
    // THE REVIEW THREAD AN AUTO-FIX JOB MAY ANSWER IN (owner item 2, like Claude Code's auto-fix: it "may reply
    // to review comment threads"): only one GitHub's news started the job for; kept for its end.
    const rt = body.autofix === true && body.fromGithub === true && body.replyTo && typeof body.replyTo === "object" ? body.replyTo : null;
    const replyTo = rt && Number.isInteger(rt.pr) && rt.pr > 0 && Array.isArray(rt.ids) ? { pr: rt.pr, ids: rt.ids.filter((x) => Number.isInteger(x) && x > 0).slice(0, 10) } : null;
    const next = { ...meta, envId, title: meta.title || chatTitle(text), turn: meta.turn + 1, status: "running", at: Date.now(), waiting: null, autofixTries: body.autofix === true ? (meta.autofixTries || 0) + 1 : 0, marks, jobFromGithub: body.fromGithub === true, jobReplyTo: replyTo && replyTo.ids.length ? replyTo : null };
    const wakeOn = wake ? { wake: true } : {}, shellOn = shell ? { shell } : {}, compactOn = compactJob ? { compact: compactJob } : {};
    // ITS BACKGROUND COMMANDS AS THE CHAT LAST SAW THEM: one its machine no longer knows (it was restarted, or slept) is said lost.
    const bgOn = bgListOf(meta.background).length ? { background: bgListOf(meta.background) } : {};
    // WHEN THE CHAT LAST HAD AN ANSWER (its last activity), for a resumed chat's SessionStart hooks (Bash docs pass 8).
    const lastAtOn = messages.length && Number(meta.at) > 0 ? { lastAt: Number(meta.at) } : {};
    // THE CHAT KNOWS THE JOB HAS STARTED BEFORE THE MACHINE IS ASKED (2026-11-06):
    // the machine sets up first (the clone, the setup script), which can take
    // minutes, and Cloudflare stops a request whose tab has closed; the watch
    // list then carries the job on. (Keys added by the Worker work during the
    // setup too: the job is "running" by then.)
    await saveMeta(bucket, uid, next);
    // THIS JOB'S KEY VALUES, kept sealed until it ends, so they stay hidden in
    // its chat even if the owner removes the key meanwhile (the audit, 2026-11-06).
    if (jobValues.length) await bucket.put(keyOf(uid, id, "hide.json"), JSON.stringify({ box: await seal(env, jobValues) }));
    // ON THE WATCH LIST (like Claude Code, 2026-11-06): the job keeps going and
    // is saved when it ends, even after the tab is closed (coder-watch.mjs).
    await watchJob(bucket, { uid, email: user.email, id, turn: next.turn }).catch(() => {});
    // Not started after all: the chat is as it was.
    const notStarted = async () => {
      await saveMeta(bucket, uid, meta);
      if (typeof bucket.delete === "function") { if (jobValues.length) await bucket.delete(keyOf(uid, id, "hide.json")).catch(() => {}); await bucket.delete(watchKey(uid, id, next.turn)).catch(() => {}); }
      await dropLive(bucket, uid, id).catch(() => {});
    };
    // `model` is the Grok pass alone: a second `model` (the name) once replaced it (live test, CD145).
    let r;
    try {
    r = await post("/turn", { secrets, egress, live, model: await modelAccess(env, uid, id, meta.turn + 1), extra: extraFor(meta), project: id, chatUrl: chatLinkOf(env, id), emailMark: await emailMark(user && user.email), cwd: typeof meta.cwd === "string" ? meta.cwd : "", mode: noAuto(normMode(meta.mode), saved), prePlanMode: noAuto(saved.mode === "acceptEdits" ? "acceptEdits" : "auto", saved), rules: await rulesOf(bucket, uid, meta.repo), ...sessionRulesOn(meta), ...wakeOn, ...shellOn, ...compactOn, ...bgOn, ...lastAtOn, text: wake || shell || compactJob ? "" : review ? review.text.split("BASE_BRANCH").join(meta.base) : (text || "(see the picture)") + fileMentions(text), shown: wake || shell || compactJob ? "" : body.fromGithub === true && body.autofix !== true && typeof body.shown === "string" && body.shown.trim() ? body.shown.slice(0, 300) : body.autofix === true ? "Auto-fix: " + String((text.split("<<<GITHUB\n")[1] || text.split("\n").filter(Boolean)[1] || "").split("\n")[0]).slice(0, 160) : text || "(see the picture)", images: pics.images, messages, repo: meta.repo, base: meta.base, branch: meta.branch, git: await gitAccess(env, uid, id, meta.turn + 1), ...(meta.readOnly ? { readOnly: true } : {}), effort: pick.effort, prefs: machinePrefs(saved), hooks: machineHooks(saved), autoMode: machineAutoMode(saved), memory, setup, github: body.fromGithub === true, away: body.fromGithub !== true && messages.length && Date.now() - (meta.at || Date.now()) >= AWAY_MS ? Date.now() - meta.at : 0, lastJob: lastJobFor(meta), environment, cache: { make: copyOn && !copyWait, ...(copyWait ? { note: copyWait } : {}) }, ...(next.jobReplyTo ? { replyTo: next.jobReplyTo } : {}) }, useCopy ? { [FROM_COPY]: useCopy.snapshot, [FROM_COPY_GB]: String(Number(useCopy.size) || 0) } : {});
    } catch (e) {
      await notStarted();
      return json({ error: "Coder's machine could not be started (" + String((e && e.message) || e).replace(/\s+/g, " ").slice(0, 200) + "). Try again in a minute." }, 502);
    }
    if (!r.ok) {
      await notStarted();
      // THE REAL REASON, whatever shape it came in (the container's JSON, or the
      // platform's own text when the container could not start).
      const raw = await r.text().catch(() => "");
      let why = ""; try { why = String((JSON.parse(raw) || {}).error || ""); } catch { why = raw.replace(/\s+/g, " ").trim(); }
      return json({ error: r.status === 409 ? "Coder is still working on the last message" : "Coder could not open " + meta.repo + " (" + r.status + (why ? ": " + why.slice(0, 200) : "") + ")" }, r.status === 409 ? 409 : 502);
    }
    // THE COPY IS SAVED NOW: the setup just ran on this chat's fresh disk and worked, and the
    // machine waits (before Coder starts) while Fly.io saves the disk; then it is told to go.
    // (Not saved, or no answer: the machine goes on by itself after a while.)
    let started = null;
    try { started = await r.json(); } catch { started = null; }
    if (started && started.held === true) {
      const snap = copyOn ? await deps.snapshot(uid + "-" + id).catch(() => null) : null;
      if (snap) await writeEnvCache(bucket, uid, envId, { ...snap, key: setupKey, at: Date.now(), from: id }).catch(() => {});
      // Said in the chat by the machine, after its setup (like Claude Code's cache, which is otherwise unseen).
      const note = !copyOn ? "" : snap ? "Setup: Fly.io " + (snap.ready ? "saved" : "is saving") + " a copy of the setup's result for this environment's next new chats (like Claude Code's environment cache). They start from it" + (snap.ready ? "" : " once it is finished, in a few minutes,") + " and skip the setup." : "Setup: a copy of the setup's result could not be saved this time (Fly.io did not start saving it in time). The next new chat in this environment runs the setup and tries again.";
      await post("/go", { project: id, ...(note ? { note } : {}) }).catch(() => {});
    }
    // Auto-fix tries in a row; a message from the owner starts the count again.
    await markUsed(bucket, uid, envId, meta.repo).catch(() => {});
    // STOPPED WHILE THE MACHINE WAS SETTING UP (the chat was freed meanwhile): the machine stops it too.
    const nowMeta = await getJson(bucket, metaKey, null);
    if (!nowMeta || nowMeta.status !== "running" || nowMeta.turn !== next.turn) { await post("/stop", { project: id }).catch(() => {}); return json({ ok: true, project: nowMeta || meta }); }
    return json({ ok: true, project: next });
  }

  // THE CHAT'S PERMISSION MODE, picked in the page's mode menu (Claude Code's cloud sessions: picked "both when you create the
  // task and while the session runs"): saved with the chat and told to its running job (from its next step on); a pick
  // other than Plan is also where new chats start.
  if (action === "mode" && request.method === "POST") {
    let body = {}; try { body = await request.json(); } catch { body = {}; }
    if (!MODES.includes(body.mode)) return json({ error: "the modes are Auto, Accept edits and Plan" }, 400);
    if (body.mode === "auto" && prefsOf(await getJson(bucket, settingsKey(uid), {})).autoOff) return json({ error: "Auto mode is turned off in Settings." }, 400);
    const next = await saveMode(bucket, uid, id, body.mode);
    if (body.mode !== "plan") { const picks = await getJson(bucket, settingsKey(uid), {}); if (picks.mode !== body.mode) await putJson(bucket, settingsKey(uid), { ...picks, mode: body.mode }); }
    let told = false;
    if (next && next.status === "running") told = !!((await post("/mode", { project: id, mode: body.mode }).then((r) => r.json()).catch(() => null)) || {}).ok;
    return json({ ok: true, project: next || meta, told });
  }
  // THE OWNER'S ANSWER ON A CARD A STEP WAITS ON (Claude Code's permission prompt; a plan's approval), for the running job.
  if (action === "answer" && request.method === "POST") {
    let body = {}; try { body = await request.json(); } catch { body = {}; }
    if (meta.status !== "running") return json({ ok: false, error: "Coder is not waiting for an answer any more." }, 409);
    const m = await post("/answer", { project: id, pid: String(body.pid || ""), choice: String(body.choice || ""), comment: typeof body.comment === "string" ? body.comment.slice(0, 2000) : "" }).then((r) => r.json()).catch(() => null);
    if (!m) return json({ ok: false, error: "Coder's machine could not be reached. Try again in a moment." }, 502);
    if (!m.ok) return json({ ok: false, error: m.why || "That card is no longer waiting for an answer." }, 409);
    return json({ ok: true });
  }

  if (action === "state" && request.method === "GET") {
    // THE OWNER IS LOOKING AT THIS CHAT (its page visible and focused): no push about it for a while (item 8).
    if (url.searchParams.get("seen") === "1") {
      const was = await getJson(bucket, seenKey(uid), null);
      if (!was || was.id !== id || Date.now() - Number(was.at) > 15_000) await putJson(bucket, seenKey(uid), { id, at: Date.now() }).catch(() => {});
    }
    const since = Math.max(0, Number(url.searchParams.get("since")) || 0);
    let s = null;
    try { const r = await call("/state?project=" + id + "&since=" + since, { method: "GET" }); s = r.ok ? await r.json() : null; } catch { s = null; }
    // An ended job leaves the watch list at once (coder-watch.mjs).
    const unwatch = () => (typeof bucket.delete === "function" ? bucket.delete(watchKey(uid, id, meta.turn)).catch(() => {}) : null);
    // A CHAT NEVER STAYS "WORKING" FOR GOOD (the audit): a machine that lost the
    // turn (restarted, slept) frees it at once; one that never answers frees it
    // after STALE_MS.
    const free = async (why) => {
      // What the job saved as it went is put back in the chat (like Claude Code); the page then loads the saved chat.
      const { steps, ev, idle } = await endLostJob(env, bucket, uid, meta, { type: "error", text: why });
      return json({ ok: true, events: [ev], next: since, running: false, project: idle, ...(steps.length ? { reload: true } : {}) });
    };
    if (!s) {
      if (meta.status === "running" && Date.now() - (meta.at || 0) > STALE_MS) return free("Coder's machine stopped answering, so this job was ended. What it did so far is above; its unsaved changes are gone. Send your message again to carry on.");
      // The chat was already freed (by Stop, or another tab): nothing to wait for; the page loads the saved chat.
      if (meta.status !== "running") return json({ ok: true, events: [], next: since, running: false, project: meta, reload: true });
      return json({ ok: false, error: "Coder's machine could not be reached", project: meta }, 502);
    }
    if (meta.status === "running" && !s.running && !s.result) {
      // STILL STARTING: the chat says "running" before the machine is handed the job (it may be waking up); not lost yet.
      if (Date.now() - (meta.at || 0) < START_GRACE_MS) return json({ ok: true, events: [], next: since, running: true, project: meta });
      return free("Coder's machine restarted, so this job ended here. What it did so far is above; its unsaved changes are gone. Send your message again to carry on.");
    }
    // THE TURN ENDED: the chat is kept, and the work goes to GitHub (a commit on
    // Coder's branch, pushed, and a pull request), once per turn.
    if (s.result && meta.status === "running" && meta.saved < meta.turn) {
      // THE TURN'S END IS DONE ONCE (the audit): the machine hands it to the
      // first asker only, so two tabs never push or save it twice.
      const claim = await post("/claim", { project: id }).then((r) => r.json()).catch(() => ({ ok: false }));
      if (!claim.ok) return json({ ok: true, events: s.events || [], next: s.next || since, running: true, project: meta });
      const all = await call("/state?project=" + id + "&since=0", { method: "GET" }).then((r) => r.json()).catch(() => ({ events: [] }));
      const old = await getJson(bucket, keyOf(uid, id, "events.json"), []);
      const fresh = Array.isArray(all.events) ? all.events.slice() : [];
      // OWNER, 2026-11-05 (option A): the work is PUSHED to Coder's branch after
      // each job, but a pull request opens only when the user presses
      // "Create pull request". A merged or closed one is forgotten, so the
      // button comes back for the next one.
      let pr = meta.pr || null, pushNote = "", pushed = !!meta.pushed, prs = meta.prs || {};
      const extraNotes = [];
      // What an auto-fix asked for in the chat changes on the chat (autofixFor).
      const afMeta = {};
      // Each job that changed files is one commit: kept so it can be undone.
      let commits = Array.isArray(meta.commits) ? meta.commits : [];
      // A READ-ONLY CHAT (owner item 5): its work is committed on Coder's machine, never sent to GitHub.
      let keptHere = !!meta.kept;
      const t = await userToken(env, bucket, uid, { fetchFn });
      if (!t && !meta.readOnly) pushNote = "Not sent to GitHub: the connection has ended. Connect GitHub again and send a message to push it.";
      else {
        const p = await post("/push", { project: id, repo: meta.repo, branch: meta.branch, git: await gitAccess(env, uid, id, meta.turn), message: commitTitle(s.result.summary), chatUrl: await chatLinkFor(env, bucket, uid, meta, id), extra: extraFor(meta), ...(meta.readOnly ? { noPush: true } : {}) }).then((r) => r.json()).catch(() => ({ ok: false, why: "the machine could not be reached" }));
        // THE CHAT'S OTHER REPOSITORIES (2026-11-06): each saved to the chat's branch in its own repository, and its pull request when Coder was asked for one.
        for (const x of Array.isArray(p.extra) ? p.extra : []) {
          const line = !x.ok ? "Not sent to GitHub in " + x.repo + ": " + String(x.why || "the push failed").slice(0, 160) : x.kept ? (x.changed ? keptNote(x.repo) : "") : x.pushed && x.changed !== false ? "Saved to the branch " + meta.branch + " in " + x.repo : "";
          if (line) extraNotes.push(line);
        }
        for (const want of Array.isArray(s.result.prExtra) ? s.result.prExtra : []) {
          const x = (Array.isArray(meta.repos) ? meta.repos : []).find((r) => r.repo === want.repo);
          if (!x) { extraNotes.push("No pull request in " + String(want.repo).slice(0, 100) + ": it is not one of this chat's repositories."); continue; }
          if (x.readOnly) { extraNotes.push(noPrNote(x.repo)); continue; }
          if (!t) { extraNotes.push("No pull request in " + x.repo + ": connect GitHub again first."); continue; }
          const made = await openPullRequest(t.token, x.repo, { head: meta.branch, base: x.base, title: String(want.title || "Changes by Coder").slice(0, 200), body: String(want.body || "").slice(0, 8000) + madeWith(await chatLinkFor(env, bucket, uid, meta, id)), draft: want.draft === true }, fetchFn).catch(() => null);
          if (made) { prs = { ...prs, [x.repo]: made }; extraNotes.push((want.draft === true ? "Draft pull request #" : "Pull request #") + made.number + " opened in " + x.repo + ": " + made.url); }
          else extraNotes.push("The pull request in " + x.repo + " could not be opened on GitHub (is its branch saved?).");
        }
        if (!p.ok) pushNote = (meta.readOnly ? "Not kept: " : "Not sent to GitHub: ") + String(p.why || "the push failed").slice(0, 200);
        else if (meta.readOnly) {
          if (p.changed) {
            keptHere = true;
            if (p.sha) commits = [...commits, { sha: p.sha, turn: meta.turn, title: commitTitle(s.result.summary), at: Date.now(), ...commitTracking(commits, s.result, p) }].slice(-50);
            pushNote = keptNote(meta.repo);
          }
        } else if (p.pushed && p.changed !== false) {
          pushed = true;
          if (p.sha) commits = [...commits, { sha: p.sha, turn: meta.turn, title: commitTitle(s.result.summary), at: Date.now(), ...commitTracking(commits, s.result, p) }].slice(-50);
          if (pr) pr = await prStillOpen(t.token, meta.repo, pr, fetchFn);
          pushNote = "Saved to the branch " + meta.branch + (pr ? " · pull request #" + pr.number + " updated" : "");
        }
        // What the save left out, even when nothing else changed (the audit, 2026-11-06).
        const lo = leftOutNote(p.left);
        if (lo) pushNote = (pushNote ? pushNote + " · " : "") + lo;
      }
      // UNDO, ASKED FOR IN THE CHAT (owner, 2026-11-06: Coder calls it itself):
      // the last job's commit is reverted and pushed, like the old Undo button.
      if (s.result.undoRequest && (t || meta.readOnly)) {
        const before = Array.isArray(meta.commits) ? meta.commits.length : 0;
        if (commits.length > before) pushNote = (pushNote ? pushNote + " · " : "") + "Not undone: this job changed files too. Ask again on its own.";
        else if (!commits.length) pushNote = (pushNote ? pushNote + " · " : "") + "Nothing to undo: no job in this chat changed files yet.";
        else {
          const last = commits[commits.length - 1];
          const u = await post("/undo", { project: id, repo: meta.repo, base: meta.base, branch: meta.branch, git: await gitAccess(env, uid, id, meta.turn), chatUrl: await chatLinkFor(env, bucket, uid, meta, id), sha: last.sha, ...(meta.readOnly ? { noPush: true } : {}) }).then((x) => x.json()).catch(() => ({ ok: false, why: "Coder's machine could not be reached" }));
          if (u.ok) { commits = commits.slice(0, -1); pushNote = "Undid the last job (" + last.title + "). The files are back as they were; " + (meta.readOnly ? "kept on Coder's machine" : "saved to the branch " + meta.branch + (pr ? " · pull request #" + pr.number + " updated" : "")) + "."; }
          else pushNote = (pushNote ? pushNote + " · " : "") + "Could not undo: " + String(u.why || u.error || "unknown").slice(0, 200);
          const lo = leftOutNote(u.left);
          if (lo && !pushNote.includes(lo)) pushNote += " · " + lo;
        }
      }
      // THE PULL REQUEST CODER WAS ASKED FOR in the chat (owner, 2026-11-05: "b").
      const want = s.result.prRequest;
      if (want && meta.readOnly) pushNote = (pushNote ? pushNote + " · " : "") + noPrNote(meta.repo);
      else if (want && t && pushed) {
        const open = pr ? await prStillOpen(t.token, meta.repo, pr, fetchFn) : null;
        if (open) { pr = open; pushNote = (pushNote ? pushNote + " · " : "") + "Pull request #" + pr.number + " updated: " + pr.url; }
        else {
          pr = await openPullRequest(t.token, meta.repo, { head: meta.branch, base: meta.base, title: String(want.title || "Changes by Coder").slice(0, 200), body: String(want.body || "").slice(0, 8000) + madeWith(await chatLinkFor(env, bucket, uid, meta, id)), draft: want.draft === true }, fetchFn).catch(() => null);
          pushNote = (pushNote ? pushNote + " · " : "") + (pr ? (want.draft === true ? "Draft pull request #" : "Pull request #") + pr.number + " opened: " + pr.url : "The pull request could not be opened on GitHub.");
        }
      } else if (want) pushNote = (pushNote ? pushNote + " · " : "") + (t ? "No pull request: there are no changes on this chat's branch yet." : "");
      // THE REVIEW ON THE PULL REQUEST Coder was asked for (like Claude Code's /code-review --comment).
      const rv = s.result.reviewPost;
      if (rv) {
        const x = t && pr && pr.number ? await postReview(t.token, meta.repo, pr.number, rv, fetchFn).catch(() => null) : null;
        const note = !(t && pr && pr.number) ? "No pull request yet: the review stays in this chat." : x && x.ok ? "Review posted on pull request #" + pr.number + (x.inline ? "" : " (as one comment: GitHub took no line comments)") + "." : "The review could not be posted on GitHub.";
        pushNote = (pushNote ? pushNote + " · " : "") + note;
      }
      // REPLIES IN REVIEW THREADS (owner item 2, like Claude Code's auto-fix: "posted using your GitHub
      // account ... each reply is labeled as coming from Claude Code"): only in the thread this job was for.
      const rr = Array.isArray(s.result.reviewReplies) ? s.result.reviewReplies.slice(0, 10) : [];
      if (rr.length) {
        const allow = meta.jobReplyTo && Array.isArray(meta.jobReplyTo.ids) ? meta.jobReplyTo : null;
        let done = 0;
        for (const x of rr) {
          if (!allow || !t || !allow.ids.includes(Number(x && x.id))) continue;
          const r = await gh(t.token, "/repos/" + meta.repo + "/pulls/" + Number(allow.pr) + "/comments/" + Number(x.id) + "/replies", { method: "POST", body: { body: String(x.body || "").slice(0, 4000) + "\n\n— Coder (gofarther.dev), for @" + (t.login || "the owner") }, fetchFn }).catch(() => null);
          if (r && r.ok) done++;
        }
        extraNotes.push(done ? "Answered in " + done + " review thread" + (done > 1 ? "s" : "") + " on pull request #" + allow.pr + " (as you, marked as Coder's)." : "No answer was posted on GitHub" + (allow ? " (GitHub refused it)." : ": only the review comment this job was started for can be answered."));
      }
      // AUTO-FIX, ASKED FOR IN THE CHAT (owner item 2, like Claude Code: "paste the PR URL into a session and
      // tell Claude to auto-fix it", or "tell Claude to stop watching the PR").
      const afWant = s.result.autofixRequest;
      if (afWant) {
        const r = t ? await autofixFor(env, bucket, uid, meta, afWant, t.token, fetchFn) : { note: "Auto-fix was not changed: connect GitHub again first." };
        if (r.meta) Object.assign(afMeta, r.meta);
        extraNotes.push(r.note);
      }
      if (pushNote) fresh.push({ at: Date.now(), type: "github", text: pushNote });
      for (const line of extraNotes) fresh.push({ at: Date.now(), type: "github", text: line });
      // THE OWNER'S VARIABLE VALUES are never kept in the chat (nor posted to GitHub from it).
      hideIn(fresh, await hiddenValues(env, bucket, uid, meta));
      // THE OWNER'S /compact, MADE: Rewind's marks inside what was summarized go, as before (marksAfter).
      const cj = s.result.compact && typeof s.result.compact === "object" ? s.result.compact : null;
      if (cj && cj.done === true && Number.isInteger(cj.to) && cj.to > 0) meta.marks = marksAfter(meta.marks, { from: 0, to: cj.to });
      const capped = capHistoryInfo(s.result.messages), kept = capped.messages;
      await putJson(bucket, keyOf(uid, id, "messages.json"), kept);
      if (typeof s.result.memory === "string") await bucket.put(memoryKey(uid, meta.repo), s.result.memory.slice(0, MEMORY_MAX), { httpMetadata: { contentType: "text/markdown" } });
      const allEvents = [...old, ...fresh], keptEvents = allEvents.slice(-MAX_EVENTS);
      await putJson(bucket, keyOf(uid, id, "events.json"), keptEvents);
      // The oldest history may have been trimmed: Rewind's marks move with it.
      const dropM = capped.dropped, dropE = allEvents.length - keptEvents.length;
      meta.marks = (Array.isArray(meta.marks) ? meta.marks : []).map((m) => ({ ...m, msg: m.msg - dropM, ev: m.ev - dropE })).filter((m) => m.msg >= 0 && m.ev >= 0);
      // WHAT THE JOB LEFT FOR THE OWNER (owner item 8): a question, a key or an approval it waits for; how long it ran.
      const asked = fresh.filter((e) => e && ["question", "secret", "envchange", "writeask", "runask"].includes(e.type)).at(-1);
      // WHERE THE CHAT'S COMMANDS ARE (the owner, 2026-11-08: "lets do it the claude code way"): a cd carries over to the
      // next message's commands too ("This includes commands Claude runs in response to your later messages").
      const cwd = typeof s.result.cwd === "string" && s.result.cwd.startsWith("/") ? s.result.cwd.slice(0, 1000) : "";
      // ITS BACKGROUND COMMANDS STILL RUNNING (tool 4, part 2): kept with the chat (the page lists them, with Stop), and the
      // chat goes on the every-minute run's list, which starts a turn to tell Coder when one ends (coder-watch.mjs).
      const background = bgListOf(s.result.background);
      // THE MODE A CARD SWITCHED TO (Auto from a command's card; Auto or Accept edits from an approved plan), unless the owner
      // picked one since; and the rules "Yes, and don't ask again" added for this repository.
      const switched = fresh.filter((e) => e && e.type === "mode" && MODES.includes(e.mode) && (e.by === "card" || e.by === "plan" || e.by === "autoOff" || e.by === "settings" || e.by === "hook")).at(-1);
      const modeNow = switched && Number(switched.at || 0) > Number(meta.modeAt || 0) ? { mode: switched.mode } : {};
      if (Array.isArray(s.result.rulesAdded) && s.result.rulesAdded.length) await changeRules(bucket, uid, meta.repo, "allow", s.result.rulesAdded.slice(0, 20)).catch(() => {});
      // RULES A PERMISSIONREQUEST HOOK ADDED (Bash docs pass 9): for a settings file, the repository's saved rules; for the
      // "session", the chat's own, sent with each of its next messages (Claude Code: in memory for the session).
      for (const kind of ["ask", "deny"]) { const l = s.result.rulesSaved && Array.isArray(s.result.rulesSaved[kind]) ? s.result.rulesSaved[kind].filter((x) => typeof x === "string").slice(0, 20) : []; if (l.length) await changeRules(bucket, uid, meta.repo, kind, l).catch(() => {}); }
      const sessionRules = sessionRulesOf(s.result.sessionRules);
      // A HOOK'S TITLE FOR THE CHAT (Claude Code's sessionTitle, from a SessionStart or UserPromptSubmit hook): the chat's name.
      const hookTitle = typeof s.result.sessionTitle === "string" && s.result.sessionTitle.trim() ? { title: s.result.sessionTitle.trim().replace(/\s+/g, " ").slice(0, 200) } : {};
      const ended = { ...meta, ...modeNow, ...hookTitle, ...(sessionRules ? { sessionRules } : {}), background, saved: meta.turn, ...(cwd ? { cwd } : {}), pr, prs, pushed, commits, ...(keptHere ? { kept: true } : {}), waiting: asked ? asked.type : null, ran: Math.max(0, Date.now() - Number(meta.at || Date.now())), usage: usageSummary(s.result.usage, meta.turn), summary: String(s.result.summary || "").slice(0, 4000) || meta.summary || "", status: s.result.status === "done" ? "idle" : s.result.status, at: Date.now(), jobReplyTo: null, ...afMeta };
      await saveMeta(bucket, uid, ended);
      await unwatch();
      // (And while one of its asyncRewake hooks runs, which may wake it.)
      if (background.length || Number(s.result.hooksRunning) > 0) await watchBackground(bucket, { uid, email: user.email, id, maxMs: machinePrefs(await getJson(bucket, settingsKey(uid), {})).bgMaxMs }).catch(() => {});
      // Saved: what it sent as it went is no longer needed (after the save, so a late sending is refused).
      await dropLive(bucket, uid, id).catch(() => {});
      // WHAT THE OWNER SENT WHILE IT WORKED AND CODER DID NOT READ (Claude Code: "When the turn ends with messages still
      // queued, they go out without another key press, in the order you typed them"): the next message starts now, and the
      // page loads the chat to follow it.
      const read = new Set(Array.isArray(s.result.readQueued) ? s.result.readQueued : []);
      let waiting = (await getJson(bucket, keyOf(uid, id, "queue.json"), [])).filter((q) => q && !read.has(q.qid));
      await putJson(bucket, keyOf(uid, id, "queue.json"), waiting);
      const first = nextQueued(waiting);
      if (first.length) {
        const headers = new Headers(request.headers); headers.set("content-type", "application/json");
        const r2 = await handleCoder(new Request(new URL(request.url).origin + "/api/coder/projects/" + encodeURIComponent(id) + "/message", { method: "POST", headers, body: JSON.stringify({ text: first.map((q) => q.text).join("\n\n"), fromQueue: true }) }), env, ctx, deps).catch(() => null);
        if (r2 && r2.status === 200) {
          const sent = new Set(first.map((q) => q.qid));
          waiting = (await getJson(bucket, keyOf(uid, id, "queue.json"), [])).filter((q) => q && !sent.has(q.qid));
          await putJson(bucket, keyOf(uid, id, "queue.json"), waiting);
          const nowMeta = await getJson(bucket, metaKey, ended);
          return json({ ok: true, events: [...(s.events || []), ...(pushNote ? [fresh.at(-1)] : [])], next: s.next || since, running: false, project: nowMeta, queue: waiting, reload: true });
        }
      }
      return json({ ok: true, events: [...(s.events || []), ...(pushNote ? [fresh.at(-1)] : [])], next: s.next || since, running: false, project: ended, queue: waiting });
    }
    // SAVED ELSEWHERE (by another tab, or by the every-minute run while no tab
    // was open): the page loads the saved chat, which has the save's own lines.
    const elsewhere = !!s.result && !s.running && meta.status !== "running";
    // THE RUNNING COMMAND'S LAST LINES (Claude Code 1.0.48), for the page only: never saved with the chat.
    const progress = s.running && s.progress && Array.isArray(s.progress.lines) ? { at: Number(s.progress.at) || 0, lines: s.progress.lines.slice(-5).map((l) => String(l).slice(0, 300)) } : null;
    return json({ ok: true, events: s.events || [], next: s.next || since, running: !!s.running, project: meta, background: bgListOf(s.background), queue: await getJson(bucket, keyOf(uid, id, "queue.json"), []), ...(progress ? { progress } : {}), ...(elsewhere ? { reload: true } : {}) });
  }

  // TAKE BACK A MESSAGE WAITING FOR CODER (Claude Code: "To take a queued message back, click the ✕ on it. The text returns to
  // the message box … If Claude has already read the message, it stays in the conversation").
  if (action === "queue" && request.method === "POST") {
    let body = {}; try { body = await request.json(); } catch { body = {}; }
    const queue = await getJson(bucket, keyOf(uid, id, "queue.json"), []);
    const q = queue.find((x) => x && x.qid === String(body.remove || ""));
    if (!q) return json({ ok: false, error: "That message is no longer waiting: Coder has it.", queue }, 409);
    if (!q.shell && meta.status === "running") {
      const m = await post("/unqueue", { project: id, qid: q.qid }).then((x) => x.json()).catch(() => null);
      if (!m) return json({ ok: false, error: "Coder's machine could not be reached. Try again in a moment.", queue }, 502);
      if (m.read === true) return json({ ok: false, read: true, error: "Coder has already read it, so it stays in the conversation.", queue }, 409);
    }
    const left = (await getJson(bucket, keyOf(uid, id, "queue.json"), [])).filter((x) => x && x.qid !== q.qid);
    await putJson(bucket, keyOf(uid, id, "queue.json"), left);
    return json({ ok: true, removed: true, text: q.text, queue: left });
  }

  // THE CHAT'S BACKGROUND COMMANDS (tool 4, part 2, like Claude Code's tasks list): those still running after Coder's
  // answer, from its machine, and how many ended that Coder was not told of yet (GET); the owner's Stop on one (POST { id }:
  // Coder is told, Claude Code 2.1.257). The chat keeps the list, for the page.
  if (action === "background" && (request.method === "GET" || request.method === "POST")) {
    // ONE'S OUTPUT (GET ?output=<id>; like Claude Code's tasks list, where a background task shows its output): its last
    // lines from the machine, with no secrets, and its output file's path, as Coder was told it.
    const want = request.method === "GET" ? new URL(request.url).searchParams.get("output") : null;
    if (want !== null) {
      if (!/^job\d{1,6}$/.test(want)) return json({ error: "no such background command" }, 400);
      let o = null;
      try { const r = await call("/bgout?project=" + id + "&id=" + want, { method: "GET" }); o = r.ok ? await r.json() : null; } catch { o = null; }
      if (!o) return json({ error: "Coder's machine could not be reached" }, 502);
      if (o.ok !== true) return json({ error: String(o.why || "that background command is not running") }, 404);
      const ended = o.ended && typeof o.ended === "object" ? { code: Number.isInteger(o.ended.code) ? o.ended.code : null, why: String(o.ended.why || "") } : null;
      return json({ ok: true, id: want, file: String(o.file || "").slice(0, 300), lines: (Array.isArray(o.lines) ? o.lines : []).slice(-40).map((l) => String(l).slice(0, 300)), ...(ended ? { ended } : {}) });
    }
    let body = {};
    if (request.method === "POST") { try { body = await request.json(); } catch { body = {}; } }
    // THE OWNER MOVES THE RUNNING COMMAND TO THE BACKGROUND (the page's "Run in background", Claude Code's Ctrl+B).
    if (request.method === "POST" && body.move === true) {
      const m = await post("/bgmove", { project: id }).then((r) => r.json()).catch(() => null);
      return m && m.ok === true ? json({ ok: true, moved: true }) : json({ error: (m && m.why) || "Coder's machine could not move it" }, 409);
    }
    let stopped = null;
    if (request.method === "POST") {
      const job = String(body.id || "");
      if (!/^job\d{1,6}$/.test(job)) return json({ error: "no such background command" }, 400);
      stopped = await post("/bgstop", { project: id, id: job }).then((r) => r.json()).catch(() => null);
      if (!stopped || stopped.ok !== true) return json({ error: (stopped && stopped.why) || "Coder's machine could not stop it", project: meta }, 409);
    }
    let st = null;
    try { const r = await call("/bgstate?project=" + id, { method: "GET" }); st = r.ok ? await r.json() : null; } catch { st = null; }
    if (!st) return json({ ok: false, error: "Coder's machine could not be reached", project: meta }, 502);
    const background = bgListOf(st.background);
    const now = await getJson(bucket, metaKey, meta);
    let saved = now;
    if (JSON.stringify(bgListOf(now.background)) !== JSON.stringify(background)) { saved = { ...now, background }; await saveMeta(bucket, uid, saved); }
    return json({ ok: true, background, untold: Number(st.untold) || 0, hooks: Number(st.hooks) || 0, running: st.running === true, project: saved, ...(stopped ? { stopped: true } : {}) });
  }

  // WHAT CODER CHANGED (the "See changes" button): its branch against the main
  // branch, as GitHub has it (what the pull request holds). No AI.
  // CREATE PULL REQUEST (the user's button): the open one when there is one,
  // else a fresh one from Coder's branch.
  if (action === "pr" && request.method === "POST") {
    if (meta.readOnly) return json({ error: noPrNote(meta.repo) }, 409);
    if (meta.status === "running") return json({ error: "Coder is still working. Try again when it is done." }, 409);
    if (!meta.pushed) return json({ error: "Coder has not saved any changes to GitHub yet." }, 400);
    const t = await userToken(env, bucket, uid, { fetchFn });
    if (!t) return json({ error: "Connect GitHub again first." }, 401);
    let pr = meta.pr ? await prStillOpen(t.token, meta.repo, meta.pr, fetchFn) : null;
    if (!pr) pr = await openPullRequest(t.token, meta.repo, { head: meta.branch, base: meta.base, title: "Coder: " + commitTitle(meta.summary || meta.title || "changes"), body: String(meta.summary || "").slice(0, 4000) + madeWith(await chatLinkFor(env, bucket, uid, meta, id)) }, fetchFn).catch(() => null);
    if (!pr) return json({ error: "GitHub would not open the pull request. There may be nothing new on the branch compared with " + meta.base + "." }, 502);
    const next = { ...meta, pr, at: Date.now() };
    await saveMeta(bucket, uid, next);
    return json({ ok: true, url: pr.url, number: pr.number, project: next });
  }

  // UNDO THE LAST JOB (owner, 2026-11-05): revert its commit, save it, and tell Coder.
  if (action === "undo" && request.method === "POST") {
    if (meta.status === "running") return json({ error: "Coder is still working. Stop it first, or wait." }, 409);
    const commits = Array.isArray(meta.commits) ? meta.commits : [];
    const last = commits[commits.length - 1];
    if (!last) return json({ error: "There is no job to undo." }, 400);
    const t = await userToken(env, bucket, uid, { fetchFn });
    if (!t) return json({ error: "Connect GitHub again first." }, 401);
    let r;
    try { r = await post("/undo", { project: id, repo: meta.repo, base: meta.base, branch: meta.branch, git: await gitAccess(env, uid, id, meta.turn), chatUrl: await chatLinkFor(env, bucket, uid, meta, id), sha: last.sha, ...(meta.readOnly ? { noPush: true } : {}) }).then((x) => x.json()); }
    catch { r = { ok: false, why: "Coder's machine could not be reached" }; }
    if (!r.ok) return json({ error: "Could not undo: " + String(r.why || r.error || "unknown").slice(0, 300) }, 409);
    const lo = leftOutNote(r.left);
    const note = "Undid the last job (" + last.title + "). The files are back as they were; " + (meta.readOnly ? "kept on Coder's machine" : "saved to the branch " + meta.branch) + "." + (lo ? " · " + lo : "");
    const old = await getJson(bucket, keyOf(uid, id, "events.json"), []);
    const ev = { at: Date.now(), type: "github", text: note };
    await putJson(bucket, keyOf(uid, id, "events.json"), [...old, ev].slice(-MAX_EVENTS));
    // Coder is told, so its next message knows the change is gone.
    const msgs = await getJson(bucket, keyOf(uid, id, "messages.json"), []);
    await putJson(bucket, keyOf(uid, id, "messages.json"), capHistory([...msgs, { role: "user", content: "(Note from Coder's app: the owner pressed Undo. Your last job's commit \"" + last.title + "\" was reverted; those changes are no longer in the files.)" }, { role: "assistant", content: "Understood: that change was undone." }]));
    const next = { ...meta, commits: commits.slice(0, -1), at: Date.now() };
    await saveMeta(bucket, uid, next);
    return json({ ok: true, project: next, events: [ev] });
  }

  // REWIND, like Claude Code's (its docs, read 2026-11-06: "Restore code and
  // conversation", "Restore conversation", "Restore code"; owner: "Finish all
  // this"): back to just before one of the owner's messages. The code goes back
  // by reverting the later jobs' commits, newest first, each saved to the branch
  // (never a force push); the chat goes back by cutting what came after.
  if (action === "rewind" && request.method === "POST") {
    if (meta.status === "running") return json({ error: "Coder is still working. Stop it first, or wait." }, 409);
    let body = {}; try { body = await request.json(); } catch { body = {}; }
    const turn = Number(body.turn), code = body.code === true, chat = body.chat === true;
    const mark = (Array.isArray(meta.marks) ? meta.marks : []).find((m) => m.turn === turn);
    if (!mark) return json({ error: "That message is too old to rewind to here." }, 400);
    // SUMMARIZE FROM HERE / UP TO HERE (owner item 9, like Claude Code's Rewind: "compress the conversation
    // from this point forward" / "before this point into a summary, keeping later messages intact"; the
    // original messages stay in the chat; an optional focus guides it). Files are never touched.
    const sumWay = body.summarize === "from" || body.summarize === "upto" ? body.summarize : "";
    if (sumWay) {
      const msgs = await getJson(bucket, keyOf(uid, id, "messages.json"), []);
      const evs = await getJson(bucket, keyOf(uid, id, "events.json"), []);
      const [from, to] = sumWay === "upto" ? [0, Math.min(mark.msg, msgs.length)] : [Math.min(mark.msg, msgs.length), msgs.length];
      if (to - from < 1) return json({ error: sumWay === "upto" ? "There is nothing before this message to summarize." : "There is nothing from this message on to summarize." }, 400);
      const focus = String(body.focus || "").replace(/\s+/g, " ").trim().slice(0, 300);
      const sum = await summarizeFn(msgs.slice(from, to), focus);
      if (!sum) return json({ error: "The summary could not be made. Try again in a minute." }, 502);
      const what = sumWay === "upto" ? "everything before one of the owner's messages (Rewind: Summarize up to here)" : "one of the owner's messages and everything after it (Rewind: Summarize from here)";
      const ev = { at: Date.now(), type: "note", text: "Summarized conversation: " + (sumWay === "upto" ? "everything above this point" : "this point and everything below it") + " is now a summary for Coder" + (focus ? " (kept in focus: " + focus.slice(0, 160) + ")" : "") + ". The chat still shows it all." };
      const evAt = Math.max(0, Math.min(mark.ev, evs.length));
      const nextEvs = [...evs.slice(0, evAt), ev, ...evs.slice(evAt)].slice(-MAX_EVENTS);
      await putJson(bucket, keyOf(uid, id, "messages.json"), capHistory([...msgs.slice(0, from), summaryMessage(sum, what + (focus ? ", focused on: " + focus : ""), filesTouched(msgs.slice(from, to))), ...msgs.slice(to)]));
      await putJson(bucket, keyOf(uid, id, "events.json"), nextEvs);
      const next = { ...meta, marks: marksAfter(meta.marks, { from, to, evAt }), at: Date.now() };
      await saveMeta(bucket, uid, next);
      return json({ ok: true, project: next, events: nextEvs, summarized: sumWay });
    }
    if (!code && !chat) return json({ error: "Choose the code, the chat, or both." }, 400);
    let commits = Array.isArray(meta.commits) ? meta.commits : [];
    const later = commits.filter((c) => Number(c.turn) >= turn).reverse();
    let undone = 0;
    // LIKE CLAUDE CODE'S CHECKPOINTS (the owner, 2026-11-13): only the files Coder's file tools changed go back (restorePlan);
    // a chat with jobs from before then reverts the later jobs whole, as before.
    const plan = code && later.length ? restorePlan(commits, turn) : null;
    let restored = null, skippedFiles = [], restoreLeft = "";
    if (code && later.length && plan && !plan.items.length) restored = [];
    else if (code && later.length && plan) {
      const t = await userToken(env, bucket, uid, { fetchFn });
      if (!t && !meta.readOnly) return json({ error: "Connect GitHub again first." }, 401);
      let r;
      try { r = await post("/restore", { project: id, repo: meta.repo, base: meta.base, branch: meta.branch, git: await gitAccess(env, uid, id, meta.turn), chatUrl: await chatLinkFor(env, bucket, uid, meta, id), items: plan.items, message: "Rewind: files back as they were before \"" + String(plan.later[0].title || "an earlier job").replace(/\s+/g, " ").slice(0, 120) + "\"", ...(meta.readOnly ? { noPush: true } : {}) }).then((x) => x.json()); }
      catch { r = { ok: false, why: "Coder's machine could not be reached" }; }
      if (!r || !r.ok) return json({ error: "Could not restore the code: " + String((r && (r.why || r.error)) || "unknown").slice(0, 300) }, 409);
      restored = Array.isArray(r.restored) ? r.restored.filter((x) => typeof x === "string") : [];
      skippedFiles = Array.isArray(r.skipped) ? r.skipped.filter((x) => typeof x === "string") : [];
      restoreLeft = leftOutNote(r.left);
      commits = commits.filter((c) => !later.includes(c));
    } else if (code && later.length) {
      const t = await userToken(env, bucket, uid, { fetchFn });
      if (!t) return json({ error: "Connect GitHub again first." }, 401);
      for (const c of later) {
        let r;
        try { r = await post("/undo", { project: id, repo: meta.repo, base: meta.base, branch: meta.branch, git: await gitAccess(env, uid, id, meta.turn), chatUrl: await chatLinkFor(env, bucket, uid, meta, id), sha: c.sha, ...(meta.readOnly ? { noPush: true } : {}) }).then((x) => x.json()); }
        catch { r = { ok: false, why: "Coder's machine could not be reached" }; }
        if (!r.ok) {
          // What was undone so far stays undone, and is recorded.
          const part = { ...meta, commits: commits.filter((x) => !later.slice(0, undone).includes(x)), at: Date.now() };
          await saveMeta(bucket, uid, part);
          return json({ error: "Could not rewind the code" + (undone ? " all the way (" + undone + " of " + later.length + " jobs undone)" : "") + ": " + String(r.why || r.error || "unknown").slice(0, 300), project: part }, 409);
        }
        undone++;
      }
      commits = commits.filter((c) => !later.includes(c));
    }
    let events = await getJson(bucket, keyOf(uid, id, "events.json"), []);
    let msgs = await getJson(bucket, keyOf(uid, id, "messages.json"), []);
    if (chat) { events = events.slice(0, mark.ev); msgs = msgs.slice(0, mark.msg); }
    const savedTo = meta.readOnly ? "kept on Coder's machine" : "saved to the branch " + meta.branch;
    const codeSaid = !code ? "" : restored ? (restored.length ? "the code is back as it was (" + restored.length + " file" + (restored.length === 1 ? "" : "s") + " restored, " + savedTo + "; files only commands changed stay as they are)" : "the code had no changes to restore") : later.length ? "the code is back as it was (" + undone + " job" + (undone === 1 ? "" : "s") + " undone, saved to the branch " + meta.branch + ")" : "the code had no later changes";
    const note = "Rewound to before an earlier message: " + [codeSaid, chat ? "the chat after it is gone" : ""].filter(Boolean).join("; ") + "." + (skippedFiles.length ? " " + restoreSkipped(skippedFiles) : "") + (restoreLeft ? " · " + restoreLeft : "");
    const ev = { at: Date.now(), type: "github", text: note };
    events = [...events, ev].slice(-MAX_EVENTS);
    // Code only: Coder is told, so it knows those changes are gone.
    if (code && !chat && restored && restored.length) msgs = [...msgs, { role: "user", content: "(Note from Coder's app: the owner restored the code to before an earlier message, as Claude Code's checkpoints do. The files your file tools (write, edit) had changed since then are back as they were: " + namesSaid(restored) + "." + (skippedFiles.length ? " Skipped and left as they are: " + namesSaid(skippedFiles) + "." : "") + " Files that only commands changed were left as they are. Nothing to do now.)" }];
    else if (code && !chat && !restored && later.length) msgs = [...msgs, { role: "user", content: "(Note from Coder's app: the owner rewound the code to before an earlier message. The commits of the later jobs were reverted: " + later.map((c) => "\"" + c.title + "\"").join(", ") + ". Those changes are no longer in the files. Nothing to do now.)" }];
    await putJson(bucket, keyOf(uid, id, "events.json"), events);
    await putJson(bucket, keyOf(uid, id, "messages.json"), capHistory(msgs));
    const next = { ...meta, commits, marks: chat ? (meta.marks || []).filter((m) => m.turn < turn) : meta.marks, at: Date.now() };
    await saveMeta(bucket, uid, next);
    return json({ ok: true, project: next, events });
  }

  // AUTO-FIX ON/OFF for this chat's pull request (off until turned on, like Claude Code's: owner item 2).
  if (action === "autofix" && request.method === "POST") {
    let body = {}; try { body = await request.json(); } catch { body = {}; }
    const next = { ...meta, autofix: body.on !== false, autofixTries: 0 };
    await saveMeta(bucket, uid, next);
    return json({ ok: true, project: next });
  }

  // THE REPO'S ENVIRONMENT (owner, 2026-11-06: "make it similar" to Claude
  // Code's): network access (full / limited / none, plus allowed sites), secrets
  // (never their values), the setup script, and variables in .env form (shown,
  // like Claude Code's: they are not for secrets).
  // (Since 2026-11-06 these are the CHAT'S ENVIRONMENT, like Claude Code's, which
  // may be used by other chats too; see coder-environments.mjs.)
  // LIKE CLAUDE CODE: a chat picks its environment before its first message.
  // THE STARTING BRANCH, like Claude Code (its docs, read 2026-11-06: "change the
  // branch in the control after the repository selector"; owner: "Finish all
  // this"): the repo's branches, and the pick, until the chat's first message.
  if (action === "branches" && request.method === "GET") {
    const t = await userToken(env, bucket, uid, { fetchFn });
    if (!t) return json({ error: "connect GitHub first", connect: true }, 409);
    const r = await ghRead(t.token, "/repos/" + meta.repo + "/branches?per_page=100", { fetchFn });
    if (!r.ok || !Array.isArray(r.data)) return json({ error: "GitHub could not list the branches" }, 502);
    // `all`: for Compare against, every branch but this chat's own (other chats' too); else none of Coder's.
    const all = url.searchParams.get("all") === "1";
    const names = r.data.map((b) => String((b && b.name) || "")).filter((n) => BRANCH.test(n) && (all ? n !== meta.branch : !n.startsWith("coder/")));
    return json({ ok: true, base: meta.base, branches: [...new Set([meta.base, ...names])].slice(0, 100) });
  }
  // SEVERAL REPOSITORIES IN ONE CHAT, like Claude Code (its docs, read 2026-11-06:
  // "You can add multiple repositories"; owner: "Finish all this"): up to 3 more,
  // added or taken away before the chat's first message, each one the owner's
  // GitHub lets Coder write to. Each gets its own folder and the chat's branch.
  if (action === "repos" && (request.method === "POST" || request.method === "DELETE")) {
    if (meta.turn > 0) return json({ error: "this chat's repositories were picked before its first message; start a new chat to use others" }, 409);
    const list = Array.isArray(meta.repos) ? meta.repos : [];
    if (request.method === "DELETE") {
      const gone = String(url.searchParams.get("repo") || "");
      const next = { ...meta, repos: list.filter((r) => r.repo !== gone) };
      await saveMeta(bucket, uid, next);
      return json({ ok: true, project: next });
    }
    let body = {}; try { body = await request.json(); } catch { body = {}; }
    const repo = String(body.repo || "").trim();
    if (!REPO.test(repo)) return json({ error: "pick one of your GitHub repositories" }, 400);
    if (repo.toLowerCase() === String(meta.repo).toLowerCase() || list.some((r) => r.repo.toLowerCase() === repo.toLowerCase())) return json({ error: repo + " is already in this chat" }, 400);
    if (list.length >= 3) return json({ error: "at most 3 more repositories in one chat" }, 400);
    const t = await userToken(env, bucket, uid, { fetchFn });
    if (!t) return json({ error: "connect GitHub first", connect: true }, 409);
    // Any repository this user can read (owner item 5, like the chat's own): one they cannot push to is read-only.
    const r = await repoAccess(t.token, repo, { fetchFn });
    if (!r.ok) return json({ error: "GitHub shows you no repository named " + repo + ". For a private one, add it to Coder in GitHub first.", install: installUrl(env) }, 404);
    const base = String(r.data.default_branch || "main");
    if (!BRANCH.test(base)) return json({ error: "this repository's main branch has a name Coder cannot use" }, 400);
    const next = { ...meta, repos: [...list, { repo, base, ...(r.readOnly ? { readOnly: true } : {}) }] };
    await saveMeta(bucket, uid, next);
    return json({ ok: true, project: next });
  }
  if (action === "base" && request.method === "POST") {
    if (meta.turn > 0) return json({ error: "this chat's starting branch was picked before its first message; start a new chat to use another one" }, 409);
    let body = {}; try { body = await request.json(); } catch { body = {}; }
    const base = typeof body.base === "string" ? body.base : "";
    if (!BRANCH.test(base) || base.startsWith("coder/")) return json({ error: "pick one of the repository's branches" }, 400);
    const t = await userToken(env, bucket, uid, { fetchFn });
    if (!t) return json({ error: "connect GitHub first", connect: true }, 409);
    const r = await ghRead(t.token, "/repos/" + meta.repo + "/branches/" + encodeURIComponent(base), { fetchFn });
    if (!r.ok) return json({ error: meta.repo + " has no branch named " + base }, 404);
    const next = { ...meta, base };
    await saveMeta(bucket, uid, next);
    return json({ ok: true, project: next });
  }
  if (action === "environment" && request.method === "POST") {
    if (meta.turn > 0) return json({ error: "this chat's environment was picked before its first message; start a new chat to use another one" }, 409);
    let body = {}; try { body = await request.json(); } catch { body = {}; }
    const e = (await listEnvs(bucket, uid)).find((x) => x.id === body.envId && !x.archived);
    if (!e) return json({ error: "no such environment" }, 404);
    const next = { ...meta, envId: e.id };
    await saveMeta(bucket, uid, next);
    return json({ ok: true, project: next });
  }
  let chatEnvId = null;
  const theEnvId = async () => {
    if (chatEnvId) return chatEnvId;
    chatEnvId = await envIdOf(bucket, uid, meta);
    // An older chat keeps the environment it got from now on.
    if (meta.envId !== chatEnvId) { meta.envId = chatEnvId; await saveMeta(bucket, uid, meta); }
    return chatEnvId;
  };
  const envOut = async (e) => {
    const list = await listEnvs(bucket, uid);
    const id = await theEnvId();
    const me = list.find((x) => x.id === id) || { id, name: "Default" };
    return { ok: true, repo: meta.repo, envId: id, name: me.name, isDefault: id === DEFAULT_ENV, archived: !!me.archived, locked: meta.turn > 0, environments: envListOut(list), script: e.script, vars: Object.keys(e.vars), varsText: toEnv(e.vars), varsDropped: varsDropped(e.vars), secrets: secretList(e.secrets), network: e.network };
  };
  const readEnv2 = async () => readEnvData(env, bucket, uid, await theEnvId());
  // NETWORK AND KEY CHANGES REACH JOBS THAT ARE RUNNING (like Claude Code: "within
  // about a minute"; owner, 2026-11-06: "Finish all this"): every chat of this
  // environment that is working now gets the new setting on its machine at once.
  // A job started from GitHub gets the network but never the keys.
  const reachRunning = async (cur) => {
    const envNow = await theEnvId();
    let reached = 0, cursor;
    do {
      const page = await bucket.list({ prefix: "coder/" + uid + "/", cursor }).catch(() => ({ objects: [] }));
      for (const o of page.objects || []) {
        const mm = /^coder\/[^/]+\/([^/]+)\/meta\.json$/.exec(o.key);
        if (!mm || !PROJECT_ID.test(mm[1])) continue;
        const m = mm[1] === id ? meta : await getJson(bucket, o.key, null);
        // (A running job, or a chat whose background commands still run: Bash docs pass 8.)
        const bgOn = !!m && Array.isArray(m.background) && m.background.length > 0;
        if (!m || (m.status !== "running" && !bgOn) || (m.envId || (await envIdOf(bucket, uid, m))) !== envNow) continue;
        try {
          const r = await deps.container(uid + "-" + mm[1]).fetch(new Request("http://coder/network", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: mm[1], setup: { network: cur.network }, secrets: m.jobFromGithub ? [] : machineKeyRules(cur.secrets), egress: { url: String(env.CODER_PUBLIC_URL || "https://gofarther.dev").replace(/\/+$/, "") + EGRESS_PATH, chat: uid + "/" + mm[1], turn: m.turn, pass: await egressPass(env, uid + "/" + mm[1], m.turn) } }) }));
          if (r.ok) reached++;
        } catch { /* that job's next message gets it anyway */ }
      }
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    return reached;
  };
  const saveEnv = async (e) => writeEnvData(env, bucket, uid, await theEnvId(), e);
  if (action === "env" && request.method === "GET") return json(await envOut(await readEnv2()));
  if (action === "env" && request.method === "POST") {
    let body = {}; try { body = await request.json(); } catch { body = {}; }
    const cur = await readEnv2();
    // Its name (never Default's).
    if (body.name !== undefined) {
      const id = await theEnvId(), list = await listEnvs(bucket, uid), me = list.find((x) => x.id === id);
      const n = String(body.name).trim();
      if (id === DEFAULT_ENV) return json({ error: "the Default environment keeps its name" }, 400);
      if (!ENV_NAME.test(n)) return json({ error: "give it a name (up to 40 characters)" }, 400);
      if (me) { me.name = uniqueName(n, list.filter((x) => x !== me)); await saveEnvList(bucket, uid, list); }
    }
    if (typeof body.script === "string") { if (body.script.length > SETUP_SCRIPT_MAX) return json({ error: "the setup script is over 64 KB" }, 413); cur.script = body.script; }
    if (typeof body.varsText === "string") {
      if (body.varsText.length > 100000) return json({ error: "that is too long" }, 413);
      cur.vars = parseEnv(body.varsText);
    }
    for (const [k, v] of Object.entries(body.vars && typeof body.vars === "object" ? body.vars : {})) {
      if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(k)) return json({ error: "variable names are letters, digits and _ (" + String(k).slice(0, 40) + ")" }, 400);
      if (v === null) delete cur.vars[k]; else if (typeof v === "string") cur.vars[k] = v.slice(0, 4000);
    }
    if (Object.keys(cur.vars).length > 50) return json({ error: "at most 50 variables" }, 400);
    const nb = body.network && typeof body.network === "object" ? body.network : null;
    if (nb) {
      const n = { ...cur.network, hosts: [...cur.network.hosts] };
      if (["none", "trusted", "full", "custom"].includes(nb.mode)) n.mode = nb.mode;
      if (nb.mode === "limited" || nb.limited === true) n.mode = "custom";
      if (nb.limited === false) n.mode = "full";
      if (typeof nb.defaults === "boolean") n.defaults = nb.defaults;
      if (Array.isArray(nb.hosts)) n.hosts = [];
      for (const h of [...(Array.isArray(nb.hosts) ? nb.hosts : []), ...(Array.isArray(nb.add) ? nb.add : [])]) { const ok = okPattern(h); if (!ok) return json({ error: "not a site like api.example.com or *.example.com: " + String(h).slice(0, 60) }, 400); if (!n.hosts.includes(ok)) n.hosts.push(ok); }
      for (const h of Array.isArray(nb.remove) ? nb.remove : []) n.hosts = n.hosts.filter((x) => x !== String(h).toLowerCase());
      if (n.hosts.length > 100) return json({ error: "at most 100 allowed sites" }, 400);
      // THE BLOCKED SITES (Claude Code's sandbox.network.deniedDomains), the whole list each time.
      if (Array.isArray(nb.denied)) {
        const denied = [];
        for (const h of nb.denied) { const ok = okPattern(h); if (!ok) return json({ error: "not a site like api.example.com or *.example.com: " + String(h).slice(0, 60) }, 400); if (!denied.includes(ok)) denied.push(ok); }
        if (denied.length > 100) return json({ error: "at most 100 blocked sites" }, 400);
        if (denied.length) n.denied = denied; else delete n.denied;
      }
      // Allowing a site on the default list (Trusted) makes it Custom: the default list plus that site.
      if (Array.isArray(nb.add) && nb.add.length && n.mode === "trusted") { n.mode = "custom"; n.defaults = true; }
      cur.network = n;
    }
    await saveEnv(cur);
    const reached = await reachRunning(cur);
    return json({ ...(await envOut(cur)), reached });
  }
  // A SECRET (owner, 2026-11-06, like Claude Code's "Add secret"): from Coder's
  // card ({ host, value, header?, prefix? }) or the Add secret form ({ name,
  // hosts, paths, headers: [{ name, prefix, value }] }); DELETE ?id= (or ?host=).
  if (action === "secret" && (request.method === "POST" || request.method === "DELETE")) {
    const cur = await readEnv2();
    if (request.method === "DELETE") {
      const id = String(url.searchParams.get("id") || url.searchParams.get("host") || "").toLowerCase();
      cur.secrets = cur.secrets.filter((s) => s.id.toLowerCase() !== id && !(s.hosts.length === 1 && s.hosts[0] === id));
      await saveEnv(cur);
      return json({ ok: true, secrets: secretList(cur.secrets), reached: await reachRunning(cur) });
    }
    let body = {}; try { body = await request.json(); } catch { body = {}; }
    const form = Array.isArray(body.hosts);
    const rawHosts = form ? body.hosts : [body.host];
    const hosts = rawHosts.map((h) => String(h || "").trim()).filter(Boolean);
    if (!hosts.length) return json({ error: "add at least one website, like api.example.com" }, 400);
    for (const h of hosts) if (!okPattern(h)) return json({ error: "not a site like api.example.com or *.example.com: " + h.slice(0, 60) }, 400);
    const kind = SECRET_KINDS.includes(body.kind) ? body.kind : "headers";
    const config = kind === "headers" ? null : normConfig(kind, body.config);
    if (kind !== "headers" && !config) return json({ error: { body: "give the parameter name and its value", oauth: "give an https token URL, the client ID and the client secret", gcp: "paste the service account's JSON key file (type service_account)", aws: "give the access key ID, the secret access key, the region (like us-east-1) and the service (like s3)" }[kind] }, 400);
    const headers = kind !== "headers" ? [] : form ? (Array.isArray(body.headers) ? body.headers : []) : [{ name: body.header || "Authorization", prefix: body.prefix === undefined ? "Bearer" : body.prefix, value: body.value }];
    if (kind === "headers" && !headers.length) return json({ error: "add a header with the key" }, 400);
    for (const h of headers) {
      const name = String((h && h.name) || "").trim(), value = String((h && h.value) || "").trim(), prefix = String((h && h.prefix) || "");
      if (!value) return json({ error: "paste the key first" }, 400);
      if (!KEY_RE.test(value)) return json({ error: "that does not look like a key: one line of plain letters, digits and symbols, no spaces" }, 400);
      if (!HEADER_RE.test(name)) return json({ error: "that header cannot carry a key (use Authorization, or a name ending in -Key or -Token)" }, 400);
      if (!PREFIXES.includes(prefix)) return json({ error: "the prefix is Bearer, Token, Key, Basic or empty" }, 400);
    }
    const paths = (Array.isArray(body.paths) ? body.paths : []).map((x) => String(x).trim()).filter(Boolean);
    for (const x of paths) if (!PATH_RE.test(x)) return json({ error: "a path prefix starts with / (like /api/v1/): " + x.slice(0, 60) }, 400);
    const sec = normSecret({ id: form ? "s" + Date.now().toString(36) : okPattern(hosts[0]), name: String(body.name || "").slice(0, 60), kind, config, hosts, paths, headers: headers.map((h) => ({ name: String(h.name).trim(), prefix: String(h.prefix || ""), value: String(h.value).trim() })), at: Date.now() });
    if (!sec) return json({ error: "that secret is not complete" }, 400);
    cur.secrets = [...cur.secrets.filter((s) => s.id !== sec.id), sec];
    if (cur.secrets.length > 20) return json({ error: "at most 20 secrets per repo" }, 400);
    await saveEnv(cur);
    return json({ ok: true, secrets: secretList(cur.secrets), reached: await reachRunning(cur) });
  }

  // THE REPO'S FILE NAMES, for @ in the chat box (owner, 2026-11-05, "16").
  if (action === "files" && request.method === "GET") {
    const t = await userToken(env, bucket, uid, { fetchFn });
    if (!t) return json({ error: "connect GitHub first", connect: true }, 409);
    let tree = meta.readOnly ? { ok: false } : await gh(t.token, "/repos/" + meta.repo + "/git/trees/" + encodeURIComponent(meta.branch) + "?recursive=1", { fetchFn });
    if (!tree.ok) tree = await ghRead(t.token, "/repos/" + meta.repo + "/git/trees/" + encodeURIComponent(meta.base) + "?recursive=1", { fetchFn });
    const files = tree.ok && tree.data && Array.isArray(tree.data.tree) ? tree.data.tree.filter((x) => x.type === "blob").map((x) => String(x.path)).filter((p) => !/(^|\/)(node_modules|\.git)\//.test(p)).slice(0, 5000) : [];
    return json({ ok: true, files });
  }

  if (action === "changes" && request.method === "GET") {
    const t = await userToken(env, bucket, uid, { fetchFn });
    if (!t) return json({ error: "connect GitHub again", connect: true }, 409);
    // COMPARE AGAINST ANOTHER BRANCH, like Claude Code ("the diff view compares the session's changes
    // against its base branch by default. To compare against any other branch in the repository, select
    // Compare against and pick one": its docs, read 2026-11-07; owner, item 4).
    const against = String(url.searchParams.get("against") || "").trim() || meta.base;
    if (!BRANCH.test(against) || against.includes("..") || against.startsWith("-") || against.startsWith("/")) return json({ error: "that is not a branch name" }, 400);
    // A READ-ONLY CHAT (owner item 5): its branch is only on Coder's machine, so the machine shows it, as
    // GitHub's compare would (like Claude Code, whose diff view also shows what is not pushed yet).
    if (meta.readOnly) {
      const r = await post("/diff", { project: id, repo: meta.repo, against, git: await gitAccess(env, uid, id, meta.turn) }).then((x) => x.json()).catch(() => null);
      if (!r || !r.ok) return json({ error: "Coder's machine could not show the changes" + (r && r.why ? ": " + String(r.why).slice(0, 200) : "") }, 502);
      const files = (Array.isArray(r.files) ? r.files : []).slice(0, 100).map((f) => ({ path: String(f.path || ""), add: f.add | 0, del: f.del | 0, patch: typeof f.patch === "string" ? f.patch.slice(0, 20000) : "" }));
      return json({ ok: true, against, files, add: files.reduce((n, f) => n + f.add, 0), del: files.reduce((n, f) => n + f.del, 0), local: true });
    }
    const c = await gh(t.token, "/repos/" + meta.repo + "/compare/" + encodeURIComponent(against) + "..." + encodeURIComponent(meta.branch), { fetchFn });
    if (c.status === 404) return json({ ok: true, against, files: [], add: 0, del: 0 });
    if (!c.ok || !c.data) return json({ error: "GitHub could not show the changes" }, 502);
    const files = (Array.isArray(c.data.files) ? c.data.files : []).slice(0, 100).map((f) => ({ path: String(f.filename || ""), add: f.additions | 0, del: f.deletions | 0, patch: typeof f.patch === "string" ? f.patch.slice(0, 20000) : "" }));
    return json({ ok: true, against, files, add: files.reduce((n, f) => n + f.add, 0), del: files.reduce((n, f) => n + f.del, 0) });
  }

  // A READ-ONLY CHAT'S WORK AS A PATCH FILE (owner item 5): its commits since the main branch, in git's own
  // format (git am applies it), from Coder's machine, the only place they are.
  if (action === "patch" && request.method === "GET") {
    if (!meta.readOnly) return json({ error: "This chat's work is on GitHub, in the branch " + meta.branch + "." }, 400);
    const r = await post("/patch", { project: id, base: meta.base }).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    if (!j || !j.ok) return json({ error: "Coder's machine could not make the patch" + (j && j.why ? ": " + String(j.why).slice(0, 200) : "") }, 502);
    if (!j.patch) return json({ error: "There is nothing to download yet: Coder has not changed any files in this chat." }, 404);
    const name = String(meta.repo).split("/")[1].replace(/[^\w.-]/g, "") + "-" + id + ".patch";
    return new Response(j.patch, { headers: { "content-type": "text/x-patch; charset=utf-8", "content-disposition": "attachment; filename=\"" + name + "\"", "cache-control": "no-store" } });
  }

  // DELETE A CHAT from the list (its branch and pull request stay on GitHub).
  if (!action && request.method === "DELETE") {
    if (meta.status === "running") return json({ error: "Coder is still working in this chat: stop it first" }, 409);
    for (const k of ["meta.json", "messages.json", "events.json"]) if (typeof bucket.delete === "function") await bucket.delete(keyOf(uid, id, k));
    await dropLive(bucket, uid, id).catch(() => {});
    // ITS BRANCH RECORDS GO TOO, only those that are this chat's (round 6 of the live test, 2026-11-12: a deleted chat's record
    // still sent `@coder` on its pull request to it, "Coder could not start: no such project", and would have kept another
    // chat from turning on auto-fix for that pull request, "belongs to another chat").
    await dropBranchRecords(bucket, uid, id, meta).catch(() => {});
    // ITS MACHINE GOES TOO (Fly.io: the chat's own VM and its kept disk; worker.js).
    if (typeof deps.dropMachine === "function") await deps.dropMachine(uid + "-" + id).catch(() => {});
    return json({ ok: true });
  }

  if (action === "stop" && request.method === "POST") {
    let st = null;
    try { st = await post("/stop", { project: id }).then((r) => r.json()); } catch { st = null; }
    // Nothing is running on the machine (or it is gone): the chat is freed now.
    if (meta.status === "running" && (!st || st.running === false)) {
      // What the job saved as it went is kept (like Claude Code).
      await endLostJob(env, bucket, uid, meta, { type: "stopped" });
      // The page loads the saved chat (it no longer waits for a machine that is gone).
      return json({ ok: true, reload: true });
    }
    return json({ ok: true });
  }

  return json({ error: "not found" }, 404);
}
