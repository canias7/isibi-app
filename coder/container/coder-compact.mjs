// LONG CHATS ARE SUMMARIZED, NOT CUT (owner, 2026-11-07, item 3: "Coder drops the older part; Claude
// Code summarizes it"; item 9: Rewind "can't summarize"). Claude Code's docs (read 2026-11-07):
// "Auto-compaction runs automatically when the context window approaches capacity"; "/compact ...
// Summarizes the conversation to free up context. Accepts optional focus instructions"; and Rewind's
// "Summarize from here" and "Summarize up to here", where "the original messages stay in the session
// transcript". Here: the part to compress becomes one message, written by Coder's own model from a
// plain-text copy of that part; the chat on the page still shows everything.
import { toolsLoadedIn, toolSearchOnIn, toolDefsIn } from "./coder-toolsearch.mjs";

/** How a summary message starts (so it is found, and never summarized as the owner's words). */
export const SUMMARY_TAG = "(Coder's app: a summary of an earlier part of this conversation";
/** The text sent to make a summary, at most (the newest kept when longer). */
export const TRANSCRIPT_MAX = 150_000;

export const SUMMARY_SYSTEM = "You write a summary of part of a coding conversation between the owner and Coder (an AI coding agent working in the owner's repository), so that Coder can carry on with your summary in place of those messages. Keep: what the owner asked for (their own words when short), their decisions and preferences, what was done (files created or changed, with their paths; commands that mattered and what they showed), errors met and how they were solved, where the work stands, and what is still open. Keep exact names: file paths, functions, branches, commands, error messages. Leave out greetings, and file contents the files themselves now hold. Never include passwords, tokens or keys. Plain text, at most about 600 words.";

const cut = (s, n) => { s = String(s || ""); return s.length > n ? s.slice(0, Math.floor(n * 0.7)) + "\n[…]\n" + s.slice(-Math.floor(n * 0.3)) : s; };

/** A plain-text copy of messages, for the summary (each tool's answer cut short). */
export function transcriptText(messages, max = TRANSCRIPT_MAX) {
  const lines = [];
  for (const m of Array.isArray(messages) ? messages : []) {
    if (!m || typeof m !== "object") continue;
    const text = typeof m.content === "string" ? m.content : Array.isArray(m.content) ? m.content.map((x) => (x && typeof x.text === "string" ? x.text : "")).join("\n") : "";
    if (m.role === "user") lines.push((text.startsWith(SUMMARY_TAG) ? "EARLIER SUMMARY: " : isAppNote(m) ? "NOTE FROM CODER'S APP: " : "OWNER: ") + cut(text, 6000));
    else if (m.role === "assistant") {
      if (text.trim()) lines.push("CODER: " + cut(text, 4000));
      for (const c of Array.isArray(m.tool_calls) ? m.tool_calls : []) {
        const f = (c && c.function) || {};
        lines.push("CODER USED " + String(f.name || "a tool") + ": " + cut(String(f.arguments || ""), 600));
      }
    } else if (m.role === "tool") lines.push("RESULT: " + cut(text, 1500));
  }
  const all = lines.join("\n\n");
  return all.length > max ? "[… the oldest part is left out …]\n" + all.slice(-max) : all;
}

/** The model call that writes a summary (no tools). `focus`: what the owner wants it to keep. */
export function summaryRequest(messages, focus = "") {
  const f = String(focus || "").replace(/\s+/g, " ").trim().slice(0, 500);
  return { messages: [
    { role: "system", content: SUMMARY_SYSTEM },
    { role: "user", content: "THE PART OF THE CONVERSATION TO SUMMARIZE:\n\n" + transcriptText(messages) + "\n\nWrite the summary now." + (f ? " The owner asks it to focus on: " + f : "") },
  ], tools: [] };
}

/**
 * The message that stands in for what was summarized. `what`: which part ("the earlier jobs", …). `files`: the files that
 * part worked on (filesTouched), kept as `reread` until Coder's next job reads the most recently changed of them again.
 * `planRef`: the chat's plan file is still to be put back in front of Coder after it (Claude Code's plan_file_reference after
 * compaction, 2026-11-14), by the job that next reads it. `part`: the messages it stands for, whose loaded deferred tools it
 * carries (`toolsLoaded`, and `toolSearchOn` when tool search was on there): Claude Code's compact boundary keeps them
 * (its preCompactDiscoveredTools), so a tool loaded with tool_search stays loaded after a summary (coder-toolsearch.mjs);
 * and their definitions as loaded (`toolDefs`), which keep one whose source goes away in the request's tools.
 */
export function summaryMessage(text, what, files = [], part = null) {
  const reread = Array.isArray(files) ? files.filter((p) => typeof p === "string" && p).slice(-REREAD_LIST_MAX) : [];
  const defs = Array.isArray(part) ? toolDefsIn(part) : [];
  const tools = Array.isArray(part) ? { toolsLoaded: toolsLoadedIn(part), ...(defs.length ? { toolDefs: defs } : {}), ...(toolSearchOnIn(part) ? { toolSearchOn: true } : {}) } : {};
  return { role: "user", content: SUMMARY_TAG + ": " + what + ". The chat on the owner's page still shows all of it.)\n" + String(text || "").trim(), ...(reread.length ? { reread } : {}), planRef: true, ...tools };
}

/**
 * A COMMAND THAT VIEWS ONE FILE, which counts as reading it (Claude Code's tools reference: "cat, nl, bat, batcat,
 * head, tail, sed -n 'X,Yp', grep, egrep, fgrep, and rg, each run on one file with no pipes or redirects"; its
 * memory docs: reading "includes viewing the file with a Bash command that counts as a read"): the file, or "".
 */
export function viewedFile(command) {
  const c = String(command || "").trim();
  if (!c || /[|;&<>`$(){}\n\\]/.test(c)) return ""; // no pipes, redirects, chaining or substitution
  const words = c.match(/'[^']*'|"[^"]*"|\S+/g) || [];
  const unq = (w) => w.replace(/^'([^']*)'$/, "$1").replace(/^"([^"]*)"$/, "$1");
  const [prog, ...args] = words;
  const plain = (skipValue) => { const out = []; for (let i = 0; i < args.length; i++) { if (skipValue.test(args[i])) { i++; continue; } if (!args[i].startsWith("-")) out.push(unq(args[i])); } return out; };
  if (["cat", "nl", "bat", "batcat", "head", "tail"].includes(prog)) { const f = plain(/^-[nc]$/); return f.length === 1 ? f[0] : ""; }
  if (prog === "sed") return args.length === 3 && args[0] === "-n" && /^\d+(,\d+)?p$/.test(unq(args[1])) ? unq(args[2]) : "";
  if (["grep", "egrep", "fgrep", "rg"].includes(prog)) { const f = plain(/^(-[efmABC]|--regexp|--file|--max-count)$/); return f.length === 2 ? f[1] : ""; }
  return "";
}

/**
 * THE FILES A PART OF THE CONVERSATION WORKED ON, the most recent last: read, edited or written by Coder, viewed with a
 * command (viewedFile), @-mentioned (the app's note names them in `files`), or named by an earlier summary (`reread`).
 * Right after a summary, Coder reads the most recently changed of them again, like Claude Code ("Right after
 * compaction, Claude Code re-reads up to five of the files Claude has read or edited in the session").
 */
export const REREAD_LIST_MAX = 50;
export function filesTouched(messages, max = REREAD_LIST_MAX) {
  const seen = new Map(); let n = 0;
  const add = (p) => { const k = typeof p === "string" ? p.trim().replace(/^(\.\/)+/, "") : ""; if (!k || k.length > 500) return; seen.delete(k); seen.set(k, ++n); };
  for (const m of Array.isArray(messages) ? messages : []) {
    if (!m || typeof m !== "object") continue;
    if (m.role === "user") { for (const p of Array.isArray(m.reread) ? m.reread : []) add(p); for (const p of Array.isArray(m.files) ? m.files : []) add(p); continue; }
    if (m.role !== "assistant" || !Array.isArray(m.tool_calls)) continue;
    for (const c of m.tool_calls) {
      const f = (c && c.function) || {};
      let a = null;
      try { a = typeof f.arguments === "string" ? JSON.parse(f.arguments || "{}") : f.arguments; } catch { a = null; }
      if (!a || typeof a !== "object") continue;
      if (["read", "edit", "write"].includes(f.name)) add(a.path);
      else if (f.name === "bash" && typeof a.command === "string") add(viewedFile(a.command));
    }
  }
  return [...seen.keys()].slice(-max);
}

/** Is this one of those summary messages? */
export const isSummary = (m) => !!m && m.role === "user" && typeof m.content === "string" && m.content.startsWith(SUMMARY_TAG);
/**
 * A NOTE Coder's app added for Coder (the files the owner @-mentioned, the pictures a read opened, a reminder before it
 * finishes), marked `appNote`: not a message of the owner's, so a summary never starts at one or calls it the owner's.
 */
export const isAppNote = (m) => !!m && m.role === "user" && m.appNote === true;

/**
 * WHERE A JOB'S OWN STEPS MAY BE CUT for a summary: before an assistant message (its tool answers
 * follow it, so none is ever cut from its call), leaving the newest `keep` rounds as they are. `from`:
 * the first message that may go (after the owner's message that started the job). -1 when there is
 * not enough to compress.
 */
export function cutPoint(convo, from, keep = 8, budget = Infinity) {
  const starts = [];
  for (let i = from; i < convo.length; i++) if (convo[i] && convo[i].role === "assistant") starts.push(i);
  const n = starts.length;
  // BY SIZE TOO (the review, 2026-11-08: with reads of up to 100,000 characters, eight rounds alone could be more than
  // the room, so a long job's requests grew without end): the newest rounds kept whole come to at most `budget`, and
  // at least the newest one is kept.
  const fits = (k) => JSON.stringify(convo.slice(starts[n - k])).length <= budget;
  let k = Math.min(keep, n);
  while (k > 1 && !fits(k)) k--;
  if (k === n) return -1; // nothing older to summarize
  if (k === keep && n <= keep + 1) return -1; // they all fit: wait for more than keep + 1 rounds, as before
  return starts[n - k];
}

/**
 * WHERE OLDER JOBS MAY BE CUT for a summary (between jobs): at a message of the owner's, keeping the
 * newest `keepTurns` of the owner's messages and what followed them. -1 when there is not enough.
 */
export function turnCut(messages, keepTurns = 3) {
  const owner = [];
  for (let i = 0; i < messages.length; i++) if (messages[i] && messages[i].role === "user" && !isSummary(messages[i]) && !isAppNote(messages[i])) owner.push(i);
  if (owner.length <= keepTurns) return -1;
  return owner[owner.length - keepTurns];
}
