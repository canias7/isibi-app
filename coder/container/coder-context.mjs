// THE CHAT'S CONTEXT IN THE CONVERSATION, NOT IN THE SYSTEM MESSAGE (fix round 4, 2026-11-14; the owner said yes to keeping
// Coder's system message the same for the whole chat, as Claude Code keeps its system prompt, so a chat's cached prefix
// only grows). What Coder's machine knows of the project, the owner and the machine used to follow Coder's instructions in
// the system message, made again at each message: a cd, the memory written, a break before the message, the date, the
// last job's title each changed it, and Grok read the whole chat again at full price. Claude Code 2.1.325 sends all of it as
// conversation messages:
//  - its docs: "CLAUDE.md content is delivered as a user message after the system prompt, not as part of the system prompt
//    itself" (memory); "CLAUDE.md content and environment details such as the working directory, platform, shell, and OS
//    version don't affect the system prompt cache, because Claude Code delivers them in the conversation, not the system
//    prompt" (Agent SDK, modifying system prompts); "Editing them mid-session does not invalidate the cache, but the edit
//    also doesn't apply. ... The new content loads on the next /clear, /compact, or restart" (prompt caching); after
//    compaction "Project-root CLAUDE.md and unscoped rules | Re-injected from disk", "Auto memory | Re-injected from disk"
//    (context window).
//  - its program: the CLAUDE.md files and the auto memory's MEMORY.md are one "instructions" announcement, made from the
//    session's context, which is read at the session's start (a resume too) and again only after a compaction (or a few
//    refresh events), and appended to the conversation before the next request; read again and different, only the files
//    that changed are announced: "Instruction files were re-read <when>; these differ from their earlier copies — each
//    replaces its earlier copy, …", with "Instructions no longer present: <path>". The date is its own announcement
//    ("Today's date is …"; "The date has changed. Today's date is now …" when it changes). The environment, its "Primary
//    working directory" among it, is announced at the start, and "# Environment update" is appended whenever it changes,
//    as after a cd. The whole context in one message reads "As you answer the user's questions, you can use the following
//    context:" (its inline form).
// Here: the context Coder's machine makes (server.mjs contextFor) comes as pieces, each with a key whose first letter says how
// it is kept: "i:" an instruction file or the memory (read again only on the chat's first message after its machine started
// again, Claude Code's resume, or after a summary), "s:" the chat's state (checked at each message: the working folder, the
// environment, git, undo, …), "d:" the date, "e:" this message's own news (the recap after a break, the setup script that
// failed), told once and kept nowhere. Each piece's text is as the context gave it, so the whole announcement reads as the
// system message's context did. The notes carry what they announced (`ctx`: each key's hash, null for one gone), so the
// next message compares with the conversation itself, as Claude Code compares with its transcript; a note cut in the saved
// chat, or gone with a summary or Rewind, makes the next message announce the whole context again. Gloopy keeps its own
// context in its system message, as before (the owner: Gloopy stays unchanged).

/** A piece of the context: `key` ("i:", "s:", "d:" or "e:", then the title it is named by) and its text as the context gives it. */
export const piece = (key, text) => ({ key: String(key), text: String(text ?? "") });
/** How a piece is kept, from its key. */
export const kindOf = (key) => ({ i: "instructions", s: "state", d: "date", e: "event" })[String(key).slice(0, 1)] || "state";
const titleOf = (key) => String(key).replace(/^[isde]:/, "");

/**
 * The context as pieces: a list from Coder's machine (the empty ones left out), or a text (a caller of runCoder's own), as one
 * piece of the chat's state.
 */
export function piecesOf(context) {
  if (Array.isArray(context)) return context.filter((p) => p && typeof p.key === "string" && /^[isde]:./.test(p.key) && typeof p.text === "string" && p.text.trim()).map((p) => piece(p.key, p.text));
  const t = typeof context === "string" ? context : "";
  return t.trim() ? [piece("s:CONTEXT", t)] : [];
}
/** The context's text, as the system message gave it before (this message's own news left out): for the checker and the marks. */
export const piecesText = (pieces) => (Array.isArray(pieces) ? pieces : []).filter((p) => kindOf(p.key) !== "event").map((p) => p.text).join("").trim();

/** A short hash of a piece's text (cyrb53: plain JS, so any part of Coder can load this file). */
export function ctxHash(text) {
  const s = String(text ?? "");
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) { const ch = s.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** How every note of Coder's app starts and ends. */
export const NOTE_OPEN = "(Note from Coder's app, not the owner:\n", NOTE_CLOSE = ")";
/** The whole context in one message, as Claude Code's inline form opens it ("As you answer the user's questions, …"). */
export const CONTEXT_INTRO = "As you answer the owner's questions, you can use the following context:";
/** When the instruction files were read again (Claude Code's "when this session started", "after the conversation was compacted"). */
export const REREAD_WHEN = Object.freeze({ session_start: "when this chat's machine started again", compaction: "after the conversation was compacted" });
/** Instruction files read again that differ (Claude Code's words; Coder's pieces each carry their own heading, so no preamble is named). */
export const rereadHead = (reason) => "Instruction files were re-read " + (REREAD_WHEN[reason] || REREAD_WHEN.session_start) + "; these differ from their earlier copies — each replaces its earlier copy:";
/** One that is gone (Claude Code's words). */
export const goneInstructions = (title) => "Instructions no longer present: " + title;
/** The chat's state changed (Claude Code's session context: "The session context has changed; these values replace the earlier ones:"). */
export const STATE_HEAD = "The chat context has changed; these values replace the earlier ones:";
/** Parts of it gone (Claude Code: "the values announced earlier (…) no longer apply"). */
export const goneState = (titles) => "These values announced earlier no longer apply: " + titles.join(", ") + ".";
/** A new day (Claude Code's date announcement, "changed"). */
export const dateChanged = (date) => "The date has changed. Today's date is now " + date + ". No need to announce the new date — the owner's own clock shows it.";

/** Is this one of the context's notes? */
export const isContextNote = (m) => !!m && m.role === "user" && m.appNote === true && !!m.ctx && typeof m.ctx === "object" && !Array.isArray(m.ctx);
/** Whole as it was made: not cut in the saved chat (forSaving keeps it whole; the Worker's last-resort cut does not). */
const intact = (m) => typeof m.content === "string" && m.content.length === m.ctxLen;

/**
 * WHAT THE CONVERSATION WAS LAST TOLD OF THE CONTEXT: each key's hash, from its last whole announcement (`ctxAll`) on, or null
 * when there is none (a new chat, or one whose announcement a summary, Rewind or the saved chat's size took away), or when a
 * note from there on is no longer whole.
 */
export function announcedContext(messages) {
  const list = Array.isArray(messages) ? messages : [];
  let at = -1;
  for (let i = list.length - 1; i >= 0; i--) if (isContextNote(list[i]) && list[i].ctxAll === true) { at = i; break; }
  if (at < 0) return null;
  const was = new Map();
  for (let i = at; i < list.length; i++) {
    const m = list[i];
    if (!isContextNote(m)) continue;
    if (!intact(m)) return null;
    for (const [k, h] of Object.entries(m.ctx)) { if (h === null) was.delete(k); else if (typeof h === "string") was.set(k, h); }
  }
  return was;
}

const note = (body, ctx, all = false) => {
  const content = NOTE_OPEN + body + NOTE_CLOSE;
  return { role: "user", appNote: true, ctx, ...(all ? { ctxAll: true } : {}), ctxLen: content.length, content };
};

/**
 * THE CONTEXT'S NOTES BEFORE A REQUEST: the whole context when the conversation has none (`ctxAll`); else what changed since it
 * was told, in one note: the chat's state and the date at every message, the instruction files and the memory only when they
 * were read again (`reason`: "session_start", the chat's first message since its machine started; "compaction", after a
 * summary). [] when nothing is owed.
 */
export function contextNotes(messages, pieces, { reason = "" } = {}) {
  const now = (Array.isArray(pieces) ? pieces : []).filter((p) => kindOf(p.key) !== "event");
  const was = announcedContext(messages);
  if (!was) {
    if (!now.length) return [];
    return [note(CONTEXT_INTRO + "\n" + piecesText(now), Object.fromEntries(now.map((p) => [p.key, ctxHash(p.text)])), true)];
  }
  const reread = reason === "session_start" || reason === "compaction";
  const here = new Map(now.map((p) => [p.key, p]));
  const ctx = {}, changed = { instructions: [], state: [], date: [] }, gone = { instructions: [], state: [] };
  for (const p of now) {
    const kind = kindOf(p.key);
    if (kind === "instructions" && !reread) continue;
    const h = ctxHash(p.text);
    if (was.get(p.key) === h) continue;
    ctx[p.key] = h;
    changed[kind].push(p);
  }
  for (const k of was.keys()) {
    if (here.has(k)) continue;
    const kind = kindOf(k);
    if (kind === "date" || (kind === "instructions" && !reread)) continue;
    ctx[k] = null;
    gone[kind === "instructions" ? "instructions" : "state"].push(titleOf(k));
  }
  const parts = [];
  if (changed.instructions.length) parts.push(rereadHead(reason) + "\n\n" + changed.instructions.map((p) => p.text.trim()).join("\n\n"));
  for (const t of gone.instructions) parts.push(goneInstructions(t));
  if (changed.state.length) parts.push(STATE_HEAD + "\n" + changed.state.map((p) => p.text.trim()).join("\n\n"));
  if (gone.state.length) parts.push(goneState(gone.state));
  for (const p of changed.date) { const d = /\d{4}-\d{2}-\d{2}/.exec(p.text); parts.push(d ? dateChanged(d[0]) : p.text.trim()); }
  return parts.length ? [note(parts.join("\n\n"), ctx)] : [];
}

/** THIS MESSAGE'S OWN NEWS (the recap after a break, the setup script that failed): a note each, told once, kept as any note. */
export function eventNotes(pieces) {
  return (Array.isArray(pieces) ? pieces : []).filter((p) => kindOf(p.key) === "event").map((p) => ({ role: "user", appNote: true, content: NOTE_OPEN + p.text.trim() + NOTE_CLOSE }));
}
