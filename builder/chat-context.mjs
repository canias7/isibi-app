// THE CONVERSATION'S WINDOW, AND ITS AUTO-COMPACTION (2026-10-20, owner: "we
// need to have the context window in full use, lets do it like chatgpt and
// claude code does … maybe auto compact at 75 percent").
//
// WHAT CHANGED. The reply to a message that is conversation used to be shown
// the last 30 turns, at most 24,000 characters, of whatever the page sent: a
// few percent of a window of 500,000 tokens (Grok) or 1,000,000 (Claude). Now
// the server reads the chat it keeps (`chat/<uid>/<chat>.json`) and shows the
// model all of it, oldest first, up to `COMPACT_AT` of the picked model's
// window. When the conversation would pass that line, its older part is
// summarized by the same model, the summary is kept on the chat (`summary`:
// its text and how many messages it covers), and from then on the model is
// shown the summary and every message after it. That is the same shape Claude
// Code and ChatGPT use.
//
// SIZES ARE ESTIMATED at three characters a token, the context bar's rule, so
// the bar and the call agree. The kept tail after a compaction is
// `KEEP_RECENT` of the window: the newest turns stay word for word.

/** Compaction starts when the next call would carry this share of the window. */
export const COMPACT_AT = 0.75;
/** After a compaction the newest turns, up to this share of the window, stay whole. */
export const KEEP_RECENT = 0.15;
/** Characters a token, the estimate used everywhere in the context bar. */
export const CHARS_PER_TOKEN = 3;
/** The summary's own ceiling, in tokens of output. */
export const SUMMARY_MAX_TOKENS = 8000;

export const tokensOf = (chars) => Math.ceil((Number(chars) || 0) / CHARS_PER_TOKEN);

/**
 * The chat's messages as conversation turns: who said it and the words, in
 * order. A reply still being written (`held`) and an empty message are not
 * turns; an assistant message with answers offered says them, the way the page
 * always sent them. `index` is the message's place in the chat, so a summary
 * can say where it stops.
 */
export function turnsOf(msgs) {
  const out = [];
  const list = Array.isArray(msgs) ? msgs : [];
  for (let i = 0; i < list.length; i++) {
    const x = list[i];
    if (!x || typeof x !== "object" || typeof x.t !== "string" || x.held || x.compact) continue;
    let text = x.t.trim();
    if (x.r === "a" && Array.isArray(x.opts)) {
      const opts = x.opts.filter((o) => typeof o === "string" && o);
      if (opts.length) text += (text ? "\n" : "") + "(Answers offered: " + opts.join(" / ") + ")";
    }
    if (!text) continue;
    out.push({ role: x.r === "u" ? "user" : "assistant", text, index: i });
  }
  return out;
}

/** The kept summary, read strictly: `{ text, upTo }` with `upTo` a count of messages it covers. */
export function readSummary(s, msgCount) {
  if (!s || typeof s !== "object" || typeof s.text !== "string" || !s.text.trim()) return null;
  if (!Number.isInteger(s.upTo) || s.upTo < 1 || s.upTo > msgCount) return null;
  return { text: s.text, upTo: s.upTo, at: Number(s.at) || 0 };
}

/**
 * What the next call carries of the conversation, and whether it is over the
 * line. `current` is the message being sent: when it is already the chat's
 * last message from the owner, it goes as the message, never also as history.
 * `fixedChars` is everything else in the call (instructions, the site, the
 * message), so the share is of the whole call.
 */
export function planWindow({ msgs, summary, window, fixedChars = 0, current = "" }) {
  const all = Array.isArray(msgs) ? msgs : [];
  const sum = readSummary(summary, all.length);
  let turns = turnsOf(all.slice(sum ? sum.upTo : 0)).map((t) => ({ ...t, index: t.index + (sum ? sum.upTo : 0) }));
  const now = typeof current === "string" ? current.trim() : "";
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].role === "user") { if (now && turns[i].text === now) turns.splice(i, 1); break; }
  }
  const convChars = turns.reduce((n, t) => n + t.text.length + 24, 0);
  const sumChars = sum ? sum.text.length + 120 : 0;
  const tokens = tokensOf(fixedChars + convChars + sumChars);
  const win = Number(window) > 0 ? Number(window) : 0;
  const used = win ? tokens / win : 0;
  return {
    summary: sum, turns, window: win, tokens,
    parts: { fixed: tokensOf(fixedChars), summary: tokensOf(sumChars), conversation: tokensOf(convChars) },
    used, compactAt: COMPACT_AT, over: win > 0 && used >= COMPACT_AT,
  };
}

/**
 * Where a compaction cuts: the newest turns that fit `KEEP_RECENT` of the
 * window stay whole, and everything before them is summarized. Null when
 * there is nothing older to summarize (one turn alone over the line is shown
 * as it is; the call's own ceiling is the provider's).
 */
export function compactSplit(plan) {
  const room = Math.max(1, Math.floor(plan.window * KEEP_RECENT * CHARS_PER_TOKEN));
  let kept = 0;
  let cut = plan.turns.length;
  for (let i = plan.turns.length - 1; i >= 0; i--) {
    if (kept + plan.turns[i].text.length > room && cut < plan.turns.length) break;
    kept += plan.turns[i].text.length;
    cut = i;
  }
  if (cut <= 0) return null;
  const older = plan.turns.slice(0, cut);
  return { older, upTo: plan.turns[cut] ? plan.turns[cut].index : older[older.length - 1].index + 1 };
}

export const COMPACT_SYSTEM =
  "You compact a long conversation between a website owner and the assistant that builds and edits their website, so the conversation can go on within the model's memory. " +
  "Write a faithful summary that the assistant will read in place of the messages it covers. Keep every decision, request, preference, name, wording the owner asked for, number, price, date, address, colour, page, " +
  "what was built or changed and what was not, questions still open, and anything promised for later. Keep the owner's own words where the exact wording matters. " +
  "Do not invent anything, do not add advice, and do not drop a request because it seems small. Use short headed sections and bullet points. Write it in the language of the conversation.";

/** The summary call: an earlier summary (if any) and the turns it now has to cover. */
export function compactRequest({ prior = null, older, model }) {
  const lines = older.map((t) => (t.role === "user" ? "Owner: " : "Assistant: ") + t.text);
  const body = (prior && prior.text ? "THE SUMMARY SO FAR (of the messages before these)\n" + prior.text + "\n\n" : "") +
    "THE MESSAGES TO SUMMARIZE, OLDEST FIRST\n" + lines.join("\n\n") +
    "\n\nWrite the one summary that replaces " + (prior && prior.text ? "the summary so far and " : "") + "these messages.";
  return {
    model,
    max_tokens: SUMMARY_MAX_TOKENS,
    system: [{ type: "text", text: COMPACT_SYSTEM }],
    messages: [{ role: "user", content: body }],
  };
}

/**
 * Compact. `deps.send(request)` is the model call. Never throws: a failure
 * answers `{ ok: false }` with no usage, so nothing is charged, and the caller
 * shows the conversation as it can.
 */
export async function compact(deps, { plan, model }) {
  const split = compactSplit(plan);
  if (!split) return { ok: false, stage: "nothing", usage: null };
  let reply;
  try { reply = await deps.send(compactRequest({ prior: plan.summary, older: split.older, model })); }
  catch (e) { return { ok: false, stage: "send", usage: null, error: e }; }
  const blocks = reply && Array.isArray(reply.content) ? reply.content : [];
  const text = blocks.filter((b) => b && b.type === "text" && typeof b.text === "string").map((b) => b.text).join("").trim();
  if (!text) return { ok: false, stage: "empty", usage: null };
  const u = (reply && reply.usage) || {};
  return {
    ok: true,
    summary: { text, upTo: split.upTo, at: Date.now(), model },
    usage: { in: Number(u.input_tokens) || 0, out: Number(u.output_tokens) || 0, cacheRead: Number(u.cache_read_input_tokens) || 0, cacheWrite: Number(u.cache_creation_input_tokens) || 0, model },
  };
}

/** The summary as the reply's call reads it. Empty when there is none. */
export function summaryBlock(summary) {
  if (!summary || typeof summary.text !== "string" || !summary.text.trim()) return "";
  return "EARLIER IN THIS CONVERSATION (a summary of the messages before the ones below, written when the conversation grew long; trust it as what was said)\n" + summary.text.trim();
}
