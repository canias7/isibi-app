/**
 * THE ACCOUNT'S EMAIL AS A CLIENT'S IDENTITY (Claude Code's built-in privacy plugin, cc-plugin-privacy: "Privacy: refuses a
 * call that sends the signed-in account's email address as a client's identity"), as Claude Code 2.1.325 has it (its
 * changelog: it "also refuses your email as a client's identity in … web fetches"; read from its program, 2026-11-14). It
 * checks Bash, Monitor and PowerShell calls, and the scripts such a call names (up to 8, read from disk); Write's content,
 * Edit's new_string (not when its old_string already had it) and NotebookEdit's new_source; WebFetch's url (the address
 * anywhere in it); and every MCP call (Coder's connector tools, and its environment tools and request_secret, which are Claude
 * Code's claude-code-remote MCP tools: REMOTE_TOOLS). A call is refused, without asking, in every mode, after
 * the owner's deny rules (Claude Code's plugin runs the permission check first and keeps its deny), in Claude Code's words
 * with Coder's ("the owner" for "the person"); Coder is told "Permission to use <Tool> denied by plugin cc-plugin-privacy: …",
 * as Claude Code tells its model.
 *
 * The Worker gives the machine the address's length and SHA-256 only (`emailMark`, "<length>:<sha256>", or two of them joined
 * by a comma when the address has quote marks or backslashes: coder-routes.mjs's emailMark), never the address: where Claude
 * Code looks for the address in a text, Coder looks at each stretch of the text that long around an "@" and hashes it.
 */
import { createHash } from "node:crypto";
import { readdir, open } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";

/** The plugin's name, as Claude Code's model is told it. */
export const PRIVACY_PLUGIN = "cc-plugin-privacy";
/** Its refusal (Claude Code 2.1.325's REFUSAL, with "the owner" for "the person"). */
export const ACCOUNT_EMAIL_REFUSED = "This call was refused: it, or a script it names, holds or reads the account's email address beside what looks like a client's identity, or puts the address in a URL. Use a generic client name. If a site needs a real contact, ask the owner which to use. To send this address, the owner sets it themselves in an environment variable the script reads, or runs the command themselves with `!`.";
/** What Coder is told, with Claude Code's name for the tool ("Permission to use Bash denied by plugin cc-plugin-privacy: …"). */
export const accountEmailRefused = (tool) => "Permission to use " + tool + " denied by plugin " + PRIVACY_PLUGIN + ": " + ACCOUNT_EMAIL_REFUSED;

// ── THE TEXT IT READS ────────────────────────────────────────────────────────
const QUOTING = /["'`\\]/g;
/**
 * A call's input as Claude Code reads it (its textOf): a string as sent, then again without its quote marks, backslashes,
 * `$` before a quote and joined lines; a list's items with spaces between; an object's fields as `"name": value` lines.
 */
export function inputText(v) {
  if (typeof v === "string") return v + "\n" + v.replace(/[\\`]\r?\n/g, "").replace(/\$(?=["'])/g, "").replace(QUOTING, "");
  if (typeof v !== "object" || v === null) return "";
  return Array.isArray(v) ? v.map(inputText).join(" ") : Object.entries(v).map(([k, x]) => "\"" + k + "\": " + inputText(x)).join("\n");
}
// WHAT LOOKS LIKE A CLIENT'S IDENTITY (Claude Code 2.1.325's patterns, word for word): a User-Agent; a named identity, a
// mailto= value or SEC EDGAR's; a From: header given with -H or --header, or a "From" key beside the word headers; curl's
// -A, wget's -U and a -user… option.
const UA_WORDS = /user[-_]?agent|[-\u2013-\u2015]-user-(?:a(?:g[a-z]*)?)?(?![a-z-])|[-\u2013-\u2015]usera(?:g[a-z]*)?(?![a-z])|\bua\s*[:=]/i;
const IDENTITY = /set_identity|(?<!-)identity=|(?<![\w-])--identity(?![\w-])|\bmailto=|sec_edgar|edgartools|browse-edgar|\bfrom\s+edgar\s+import\b|\bimport\s+edgar\b|\bsec\.gov\b/i;
const FROM_HEADER = /(?:\s-[a-zA-Z]*H|--header)[\s=]*(?:["']\s*)?[Ff][Rr][Oo][Mm]\s*:/;
const FROM_KEY = /["']From\\*["']\s*[:=,]/;
const HEADERS = /(?<![a-z])headers(?![a-z])/i;
const UA_FLAGS = [[/\bcurl(?:ie)?\b/i, /\s[-\u2013-\u2015][a-zA-WYZ0-9#]*A/], [/\bwget2?\b/i, /\s[-\u2013-\u2015][a-zA-Z0-9]*U/], [/\b(?:curl|wget|iwr|irm|invoke-webrequest|invoke-restmethod)\b/i, /\s[-\u2013-\u2015]user(?![\w=-])/i]];
/** A line that reads git's own email setting (`git config user.email`, $GIT_AUTHOR_EMAIL …), which may hold the address. */
export const GIT_EMAIL = /\bgit\b[^\n]{0,40}\bconfig\b[^\n]{0,40}\buser\.email\b(?![ \t]+(?!\d?>)["'$\w])|\$(?:\{|env:)?GIT_(?:AUTHOR|COMMITTER)_EMAIL\b/i;
/** Whether a text names a client's identity (Claude Code's patterns above). */
export const namesIdentity = (t) => UA_WORDS.test(t) || IDENTITY.test(t) || FROM_HEADER.test(t) || (HEADERS.test(t) && FROM_KEY.test(t)) || UA_FLAGS.some(([a, b]) => a.test(t) && b.test(t));
/** Whether a text may hold the address at all (an "@", "%40", or a line reading git's email): else nothing is checked. */
export const mayHoldAddress = (t) => t.includes("@") || t.includes("%40") || GIT_EMAIL.test(t);

// ── THE ADDRESS, BY ITS MARK ─────────────────────────────────────────────────
const marksOf = (mark) => String(mark || "").split(",").map((x) => /^(\d{1,3}):([0-9a-f]{64})$/.exec(x)).filter(Boolean);
/**
 * The address's forms a text holds (Claude Code's holdsAddress: the text, or the text with %XX decoded, holds the address in
 * any case, or the address without its quote marks and backslashes), each as found, lower-cased.
 */
function addressesIn(text, mark) {
  const marks = marksOf(mark), t = String(text || "");
  if (!marks.length || (!t.includes("@") && !t.includes("%40"))) return [];
  const decoded = t.replace(/%([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(Number.parseInt(h, 16)));
  const found = new Set();
  for (const m of marks) {
    const len = Number(m[1]), want = m[2];
    let hit = "";
    for (const src of [t.toLowerCase(), decoded.toLowerCase()]) {
      for (let at = src.indexOf("@"); at >= 0 && !hit; at = src.indexOf("@", at + 1)) {
        for (let j = Math.max(0, at - len + 1); j <= at && !hit; j++) {
          const cand = src.slice(j, j + len);
          if (cand.length === len && createHash("sha256").update(cand).digest("hex") === want) hit = cand;
        }
      }
      if (hit) break;
    }
    if (hit) found.add(hit);
  }
  return [...found];
}
/** Whether a text holds the address (Claude Code's holdsAddress; WebFetch's url is refused for this alone). */
export const holdsAddress = (text, mark) => addressesIn(text, mark).length > 0;
/**
 * WHETHER A TEXT SENDS THE ADDRESS AS A CLIENT'S IDENTITY (Claude Code 2.1.325's namesUserAgentWithAddress): with the address
 * in it, whether what is left once the address is taken out names an identity; without it, whether one of its lines both
 * reads git's email setting and names an identity.
 */
export function namesUserAgentWithAddress(text, mark) {
  if (!marksOf(mark).length) return false;
  const t = String(text || "");
  const found = addressesIn(t, mark);
  if (!found.length) return t.split("\n").some((line) => GIT_EMAIL.test(line) && namesIdentity(line));
  return namesIdentity(t.replace(new RegExp(found.map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "gi"), " "));
}

// ── WHICH CALLS, AND WHAT OF EACH ────────────────────────────────────────────
/** Claude Code's shell tools: their command and the scripts it names are read. */
export const SHELL_TOOLS = Object.freeze(["Bash", "Monitor", "PowerShell"]);
/** The tools of which one field is read: the one that goes out. */
export const FIELD_TOOLS = new Map([["Write", "content"], ["Edit", "new_string"], ["NotebookEdit", "new_source"], ["WebFetch", "url"]]);
export const MCP_TOOL = /^mcp__/;
/**
 * CLAUDE CODE'S NAMES FOR CODER'S ENVIRONMENT TOOLS AND request_secret: in its cloud sessions these are its claude-code-remote
 * MCP server's tools (mcp__claude-code-remote__get_environment, …, …request_credential), so its check reads each call's whole
 * input as any MCP call's, with no exception for that server (2.1.325: the check's hook takes every tool matching /^mcp__/,
 * and a deny from it stands for a remote session's MCP call too). 2026-11-14.
 */
export const REMOTE_TOOLS = Object.freeze(Object.fromEntries(["get_environment", "update_environment", "create_environment", "switch_environment", "list_environments", "request_secret"].map((t) => [t, "mcp__claude-code-remote__" + (t === "request_secret" ? "request_credential" : t)])));
/** Whether the check reads a tool's calls (by Claude Code's name for it; a connector's is its own, mcp__<server>__<tool>). */
export const checkedTool = (tool) => SHELL_TOOLS.includes(tool) || FIELD_TOOLS.has(tool) || MCP_TOOL.test(String(tool || ""));
/** One field's text (Claude Code's fieldText), with `cut` taken out of a string first. */
export function fieldText(input, field, cut) {
  const v = typeof input === "object" && input !== null ? (Object.entries(input).find(([k]) => k === field) || [])[1] : undefined;
  return inputText(cut !== undefined && typeof v === "string" ? v.replace(cut, " ") : v);
}
/** What a call sends (Claude Code's outgoingText): its tool's field, or its whole input. */
export const outgoingText = (tool, input) => (FIELD_TOOLS.has(tool) ? fieldText(input, FIELD_TOOLS.get(tool)) : inputText(input));
/** Whether a call itself is refused (Claude Code's isRefused): WebFetch for the address in its url; others for the address as an identity. */
export function isRefused(tool, input, mark) {
  const n = outgoingText(tool, input);
  if (tool === "WebFetch") return holdsAddress(n, mark);
  return namesUserAgentWithAddress(n, mark) && !(tool === "Edit" && namesUserAgentWithAddress(fieldText(input, "old_string"), mark));
}

// ── THE SCRIPTS A COMMAND NAMES ──────────────────────────────────────────────
// (Claude Code 2.1.325's patterns, word for word: a word ending in a script's extension, or one starting ./; not one from the
// root nor through ..; and git's own commands taken out of the command first, so `git add send.py` names none.)
const SCRIPT_NAME = /(?<![^\s"'`=(;&|<>])(?:[\w./\\-]*\.(?:py|sh|bash|zsh|js|mjs|cjs|ts|mts|cts|rb|pl|php|lua|ps1|go)|\.[/\\][\w/\\-]+)(?![^\s"'`);&|<>])/gi;
const SCRIPT_OUTSIDE = /^[/\\]|(?:^|[/\\])\.\.(?:[/\\]|$)/;
export const GIT_COMMAND = /(?<=^|[&;|\n])[ \t]*(?:\w+=[^\s&;|]*[ \t]+)*git(?=\s|$)(?:<<-?[ \t]*["']?(\w+)[^]*?(?:\n[ \t]*\1(?:\n?[ \t]*\)"|[ \t\r]*(?=\n|$))|$)|[^\n"'\\<;|&]+|"(?=\$\(cat\s+<<)|"[^"\\]*(?:\\[^]?[^"\\]*)*(?:"|$)|'[^']*(?:'|$)|\\[^]?|<)*/g;
/** The scripts a text names, up to 8 (Claude Code's scriptNames). */
export function scriptNames(text) {
  const out = new Set();
  for (const [name] of String(text || "").matchAll(SCRIPT_NAME)) {
    if (!SCRIPT_OUTSIDE.test(name)) out.add(name);
    if (out.size === 8) break;
  }
  return [...out];
}
/** The most of a script read (Claude Code's plugins read at most 4 MiB; a longer file is not read). */
export const SCRIPT_READ_MAX = 4194304;
/**
 * A SCRIPT'S TEXT, AS CLAUDE CODE'S PLUGIN READS IT: from the folder the commands are in, one name at a time, each found as
 * it is listed; a link anywhere on the way, a name not there, or what is not a file at the end gives nothing; so does a file
 * over 4 MiB or one that can't be read.
 */
export async function scriptText(cwd, name, { max = SCRIPT_READ_MAX } = {}) {
  try {
    let at = String(cwd || ""), isFile = false;
    if (!at) return "";
    for (const part of String(name).split(/[/\\]+/).filter((x) => x !== "" && x !== ".")) {
      const entry = (await readdir(at, { withFileTypes: true })).find((d) => d.name === part);
      if (!entry || entry.isSymbolicLink()) return "";
      at = join(at, part);
      isFile = entry.isFile();
    }
    if (!isFile) return "";
    const fh = await open(at, constants.O_RDONLY | constants.O_NONBLOCK);
    try {
      const parts = [];
      let size = 0;
      for (;;) {
        const buf = Buffer.allocUnsafe(65536);
        let n;
        try { n = (await fh.read(buf, 0, buf.length, null)).bytesRead; } catch (e) { if (e && (e.code === "EAGAIN" || e.code === "EWOULDBLOCK")) break; throw e; }
        if (n === 0) break;
        size += n;
        if (size > max) return "";
        parts.push(buf.subarray(0, n));
      }
      return Buffer.concat(parts).toString("utf8");
    } finally { await fh.close(); }
  } catch { return ""; }
}

/** The same for a call of a tool that names no scripts (all but the shell tools): nothing to read, so it is told at once. */
export function refusedNow(tool, input, mark) {
  if (!marksOf(mark).length || !checkedTool(tool) || SHELL_TOOLS.includes(tool)) return false;
  return mayHoldAddress(outgoingText(tool, input)) && isRefused(tool, input, mark);
}
/**
 * WHETHER CLAUDE CODE'S PRIVACY CHECK REFUSES A CALL (its tool.check hook, once no deny rule has refused it): `tool` is Claude
 * Code's name for it, `input` the call's input as sent, `mark` the address's (no mark: no check). A shell call's scripts are
 * read from `cwd`, the folder its commands run in (`read`: how a script is read, scriptText).
 */
export async function emailRefused(tool, input, mark, { cwd = "", read = scriptText } = {}) {
  if (!marksOf(mark).length || !checkedTool(tool)) return false;
  const sent = outgoingText(tool, input);
  const scripts = SHELL_TOOLS.includes(tool) ? scriptNames(fieldText(input, "command", GIT_COMMAND)) : [];
  if (!scripts.length && !mayHoldAddress(sent)) return false;
  if (isRefused(tool, input, mark)) return true;
  if (!scripts.length) return false;
  const texts = await Promise.all(scripts.map(async (s) => { try { return String((await read(cwd, s)) || ""); } catch { return ""; } }));
  return texts.some((t) => namesUserAgentWithAddress(inputText(t), mark));
}
