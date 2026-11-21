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

/**
 * /btw, CLAUDE CODE'S SIDE QUESTION (round 6 of the live checks, 2026-11-21; its docs: "Claude answers a side question from
 * what's already in the conversation"; "The question and answer never enter the conversation history"; "No tool access";
 * "Single response"; "A later side question also sees your earlier side questions: Claude Code replays the newest 20
 * exchanges"; "Available while Claude is working ... doesn't interrupt the main turn"). The request: the chat's conversation
 * as plain text (newest part, BTW_CONTEXT_MAX characters), the newest BTW_KEEP earlier side questions, then this one; no tools.
 */
export const BTW_KEEP = 20, BTW_CONTEXT_MAX = 200_000, BTW_QUESTION_MAX = 2000;
export const BTW_SYSTEM = "You are Coder, answering a side question about the current session. Answer only from what is already in the conversation below: the owner's messages, your replies, and the tool results gathered so far. You have no tools: you cannot read files, run commands or search now. If the answer is not in the conversation, say so briefly. Answer in one reply, short and plain.";
const flat = (c) => (typeof c === "string" ? c : Array.isArray(c) ? c.map((p) => (p && typeof p.text === "string" ? p.text : p && p.type === "image_url" ? "(a picture)" : "")).join("\n") : "");
export function btwRequest(messages, earlier, question) {
  const lines = [];
  for (const m of Array.isArray(messages) ? messages : []) {
    if (!m || typeof m !== "object") continue;
    const calls = Array.isArray(m.tool_calls) ? m.tool_calls.map((c) => "[tool call " + String((c.function && c.function.name) || "") + " " + String((c.function && c.function.arguments) || "").slice(0, 2000) + "]").join("\n") : "";
    const text = flat(m.content);
    if (m.role === "tool") lines.push("TOOL RESULT:\n" + text.slice(0, 4000));
    else if (m.role === "user" || m.role === "assistant") lines.push((m.role === "user" ? "OWNER:\n" : "CODER:\n") + text + (calls ? "\n" + calls : ""));
  }
  let convo = lines.join("\n\n");
  if (convo.length > BTW_CONTEXT_MAX) convo = "…(earlier part left out)\n" + convo.slice(-BTW_CONTEXT_MAX);
  const msgs = [{ role: "system", content: BTW_SYSTEM }, { role: "user", content: "THE CONVERSATION SO FAR:\n<<<\n" + (convo || "(nothing yet)") + "\n>>>" }, { role: "assistant", content: "Understood. Ask your side question." }];
  for (const x of (Array.isArray(earlier) ? earlier : []).slice(-BTW_KEEP)) if (x && typeof x.q === "string" && typeof x.a === "string") msgs.push({ role: "user", content: "/btw " + x.q }, { role: "assistant", content: x.a });
  msgs.push({ role: "user", content: "/btw " + String(question || "").slice(0, BTW_QUESTION_MAX) });
  return { messages: msgs };
}
/** The side question's answer by Coder's model, with no tools; "" when it could not be made. */
export async function sideAnswer(env, messages, earlier, question, { fetchFn = fetch } = {}) {
  try {
    const r = await coderSend(env, { fetchFn })({ model: coderModel(env), ...btwRequest(messages, earlier, question), webSearch: false });
    return String((r && r.message && r.message.content) || "").trim();
  } catch { return ""; }
}
