// SUMMARIES OF A CHAT'S CONVERSATION, ON THE WORKER (owner, 2026-11-07, items 3 and 9; like Claude
// Code's auto-compact, /compact and Rewind's "Summarize from here" / "Summarize up to here"). Coder's own
// model writes them (container/coder-compact.mjs); the Grok key stays here. What Coder reads
// (messages.json) gets the summary; what the chat shows (events.json) keeps everything, with a note
// where the summary stands in.

import { coderSend, coderModel } from "../container/coder-model.mjs";
import { summaryRequest, summaryMessage, turnCut, filesTouched } from "../container/coder-compact.mjs";

/** A saved conversation past this size has its older jobs summarized before the next job (it was cut at 400 KB). Gloopy's. */
export const COMPACT_HISTORY_AT = 300 * 1024;
/**
 * A CODER CHAT'S, A LAST RESORT ONLY (2026-11-14, the owner: "yes copy claude code"): Coder's machine summarizes the chat by
 * Claude Code's auto-compact before its first request (some 2 MB of text at most, then), and its pictures are kept apart
 * (coder-live.mjs), so this only catches a chat far past that: 6 MB, which the Worker's 128 MB reads, summarizes and saves
 * (test/worker-memory.test.mjs).
 */
export const CODER_COMPACT_SAFETY = 6 * 1024 * 1024;

/** One summary by Coder's model. Answers its text, or "" when it could not be made. `gloopy`: Gloopy's (its copy as before). */
export async function summarize(env, messages, focus = "", { fetchFn = fetch, gloopy = false } = {}) {
  if (!Array.isArray(messages) || !messages.length) return "";
  try {
    const r = await coderSend(env, { fetchFn })({ model: coderModel(env), ...summaryRequest(messages, focus, { gloopy }), webSearch: false });
    return String((r && r.message && r.message.content) || "").trim();
  } catch { return ""; }
}

/**
 * THE CHAT'S MARKS AFTER A SUMMARY (each owner message's place in events and messages, for Rewind).
 * messages [from, to) became one message; `evAt`: where the note was put in the events (or -1).
 * Marks inside the summarized part go (their messages are no longer separate); later ones move up.
 */
export function marksAfter(marks, { from, to, evAt = -1 }) {
  const out = [];
  for (const m of Array.isArray(marks) ? marks : []) {
    if (m.msg >= from && m.msg < to) continue;
    out.push({ ...m, msg: m.msg >= to ? m.msg - (to - from) + 1 : m.msg, ev: evAt >= 0 && m.ev >= evAt ? m.ev + 1 : m.ev });
  }
  return out;
}

/**
 * BEFORE A JOB: a conversation past COMPACT_HISTORY_AT has its older jobs summarized (the newest three
 * of the owner's messages stay whole), like Claude Code's auto-compact. Answers { messages, from, to }
 * (to = 0: nothing was summarized; the old cut then still applies when saving). `gloopy`: a Gloopy chat's, in its words as before.
 */
export async function compactHistory(messages, summarizeFn, { at = COMPACT_HISTORY_AT, gloopy = false, size = NaN } = {}) {
  // (`size`: the saved chat's length as stored, when known, so it is not made again here.)
  if (!Array.isArray(messages) || (Number.isFinite(size) ? size : JSON.stringify(messages).length) <= at) return { messages, from: 0, to: 0 };
  const c = turnCut(messages, 3);
  if (c <= 0) return { messages, from: 0, to: 0 };
  const text = await summarizeFn(messages.slice(0, c), "");
  if (!text) return { messages, from: 0, to: 0 };
  return { messages: [summaryMessage(text, "the earlier jobs of this chat, summarized to make room", filesTouched(messages.slice(0, c)), messages.slice(0, c), { gloopy }), ...messages.slice(c).map(({ tokens, ...m }) => m)], from: 0, to: c };
}
