// CODER'S MEMORY AS A FOLDER (audit M-f-17; Claude Code's memory docs: "The directory contains a `MEMORY.md` index and one
// topic file per memory"). MEMORY.md is the index, loaded at the start of each chat; each memory sits in its own topic file
// beside it (`user_role.md`, `feedback_testing.md`, …), opened with the read tool when needed. The Worker keeps the topic
// files of each repository between chats (coder-routes.mjs) and the machine writes them into the memory folder before a
// job and reads them back after it (server.mjs). Shared by both, so both hold to the same names and sizes.
// (No node:path: the Worker imports this file too.)
const normAbs = (p) => { const out = []; for (const x of p.split("/")) { if (!x || x === ".") continue; if (x === "..") out.pop(); else out.push(x); } return "/" + out.join("/"); };
const dirOf = (p) => p.slice(0, p.lastIndexOf("/")) || "/";
const baseOf = (p) => p.slice(p.lastIndexOf("/") + 1);

/** At most this many topic files, each at most this many characters, and all of them together at most this many. */
export const MEMORY_FILES_MAX = 50, MEMORY_FILE_MAX = 40_000, MEMORY_FILES_TOTAL = 500_000;
/** A topic file's name: letters, digits, `_`, `-` and `.`, ending in `.md`; never hidden, never the index itself. */
export const MEMORY_NAME = /^[A-Za-z0-9_][\w.-]{0,99}\.md$/;
export const MEMORY_INDEX = "MEMORY.md";
export const memoryTopicName = (n) => typeof n === "string" && MEMORY_NAME.test(n) && n !== MEMORY_INDEX && !n.includes("..");

/**
 * The topic files as they may be kept: `{ name: text }` with good names and text only, each cut to MEMORY_FILE_MAX, the
 * first MEMORY_FILES_MAX of them in name order, and none past MEMORY_FILES_TOTAL in all. Anything else → {}.
 */
export function cleanMemoryFiles(obj) {
  const out = {};
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return out;
  let total = 0, n = 0;
  for (const name of Object.keys(obj).sort()) {
    if (n >= MEMORY_FILES_MAX) break;
    if (!memoryTopicName(name) || typeof obj[name] !== "string") continue;
    const text = obj[name].slice(0, MEMORY_FILE_MAX);
    if (total + text.length > MEMORY_FILES_TOTAL) break;
    out[name] = text; total += text.length; n++;
  }
  return out;
}
/** The same two sets of topic files (names and texts)? */
export function sameMemoryFiles(a, b) {
  const ka = Object.keys(a || {}).sort(), kb = Object.keys(b || {}).sort();
  return ka.length === kb.length && ka.every((k, i) => k === kb[i] && a[k] === b[k]);
}
/** Is `p` (in full) one of Coder's memory files: the index `memFile` itself, or a topic file in its folder? */
export function isMemoryPath(p, memFile) {
  if (typeof p !== "string" || !p.startsWith("/") || typeof memFile !== "string" || !memFile.startsWith("/")) return false;
  const full = normAbs(p), mem = normAbs(memFile);
  return full === mem || (dirOf(full) === dirOf(mem) && memoryTopicName(baseOf(full)));
}
/**
 * A MEMORY FILE'S `modified` TIME (Claude Code: when it writes a memory file that starts with front matter it stamps a
 * `modified` time): a text that begins with a `---` front-matter block gets `modified: <ISO time>` in it, an old one
 * replaced. Any other text is left as it is.
 */
export function stampModified(text, at = new Date()) {
  const m = /^---(\r?\n)([\s\S]*?)(\r?\n)---[ \t]*(?=\r?\n|$)/.exec(String(text));
  if (!m) return text;
  const nl = m[1], iso = new Date(at).toISOString();
  const lines = m[2] === "" ? [] : m[2].split(/\r?\n/);
  const i = lines.findIndex((l) => /^modified[ \t]*:/.test(l));
  if (i >= 0) lines[i] = "modified: " + iso; else lines.push("modified: " + iso);
  return "---" + nl + lines.join(nl) + m[3] + "---" + String(text).slice(m[0].length);
}
