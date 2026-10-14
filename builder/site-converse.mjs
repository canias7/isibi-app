// THE CONVERSATION — WHAT THE ASSISTANT SAYS WHEN A MESSAGE IS NOT WORK
// (2026-10-14, the owner's two-area batch).
//
// Owner: *"Remove the rigid 1–3-sentence/no-Markdown restriction and blanket
// bans on headings and bullets. Make the assistant naturally helpful,
// conversational and appropriately detailed … Give conversational answers an
// appropriate output budget without blindly increasing every routing call.
// Connect normal conversation history … Supply relevant owner-authorized site
// context … Replace the fixed capability list's 'anything else is unsupported'
// rule with accurate capability guidance and honest uncertainty. Never claim
// inspection, browsing or execution that did not happen."*
//
// TWO CALLS, EACH SIZED FOR ITS JOB. The router (`builder/site-ask.mjs`) still
// decides what a message is, on its own small ceiling, and for a question it
// writes only the gist of a reply. When — and only when — it decides the
// message is conversation, this call writes the reply: shown the conversation
// so far, what the route could read of the owner's own site, and a ceiling
// that fits an explanation, a comparison or a plan. Work never reaches here,
// so no routing call and no work step grows by a token.
//
// WHAT IT IS SHOWN, AND WHAT IT IS TOLD IT WAS NOT. The conversation is the
// page's own copy of this project's thread, sent with the message (the server
// keeps none), cut to a stated window with the cut said in words. The site
// context is read by the route for the verified owner: the pages' own words,
// the tables' names and columns and who may write to them — never a row, so no
// visitor's booking, order or message reaches a model here — and the files
// the owner uploaded, by address, kind and size. Attached files are named, and
// the model is told it was not shown them. It is told, in so many words, that
// it has not opened the live site, browsed, run anything, watched a video or
// listened to a recording in this conversation, so a reply cannot say it did.

import { MAX_INPUT_CHARS } from "./input-budget.mjs";

/**
 * THE REPLY'S CEILING: room for a real explanation or plan (about 1,500
 * words), and never a routing call's. A ceiling, not a charge: a greeting
 * costs what a greeting costs. The model is told the room it has, so a long
 * answer is planned to fit rather than cut.
 */
export const CONVERSE_MAX_TOKENS = 2400;

// ── THE CONVERSATION WINDOW ─────────────────────────────────────────────────
//
// Sent by the page with every message, read here strictly. The most recent
// turns are kept, oldest dropped first; a turn longer than its own cap keeps
// its start and says it was cut; what was left out is counted and said to the
// model, so it never takes a window for the whole conversation.
export const HISTORY_TURNS = 30;
export const HISTORY_TURN_CHARS = 4000;
export const HISTORY_CHARS = 24000;
/** The router's smaller window: enough to resolve "do that" and "the second one", never a transcript. */
export const ROUTER_HISTORY_TURNS = 8;
export const ROUTER_TURN_CHARS = 800;
export const ROUTER_HISTORY_CHARS = 4800;
const ROLES = Object.freeze(["user", "assistant"]);

/**
 * The page's history, read: `{ turns: [{ role, text, cut? }], left: n }`, the
 * most recent last, `left` how many earlier turns were not kept. Anything that
 * is not a list of `{ role: "user"|"assistant", text: string }` is skipped and
 * counted with the rest left out — never coerced, never thrown on.
 */
export function readHistory(v, { turns = HISTORY_TURNS, turnChars = HISTORY_TURN_CHARS, total = HISTORY_CHARS } = {}) {
  const all = Array.isArray(v) ? v : [];
  const kept = [];
  let left = 0;
  let used = 0;
  for (let i = all.length - 1; i >= 0; i--) {
    const t = all[i];
    const ok = t && typeof t === "object" && !Array.isArray(t) && ROLES.includes(t.role) && typeof t.text === "string" && t.text.trim();
    if (!ok) { left++; continue; }
    if (kept.length >= turns || used >= total) { left++; continue; }
    let text = t.text.trim();
    let cut = false;
    const room = Math.min(turnChars, total - used);
    if (text.length > room) { text = text.slice(0, room); cut = true; }
    used += text.length;
    kept.unshift({ role: t.role, text, ...(cut ? { cut: true } : {}) });
  }
  return { turns: kept, left };
}

/** The router's window, from the same reading. */
export function routerHistory(v) {
  return readHistory(v, { turns: ROUTER_HISTORY_TURNS, turnChars: ROUTER_TURN_CHARS, total: ROUTER_HISTORY_CHARS });
}

/**
 * The window as the model reads it: each turn labelled with who said it, in
 * order, with every cut said. Empty when there is nothing to show.
 */
export function historyBlock(h, heading = "THE CONVERSATION SO FAR") {
  const turns = h && Array.isArray(h.turns) ? h.turns : [];
  const left = h && Number.isInteger(h.left) && h.left > 0 ? h.left : 0;
  if (!turns.length && !left) return "";
  const lines = turns.map((t) => (t.role === "user" ? "Owner: " : "Assistant (you): ") + t.text + (t.cut ? " [the rest of this message is not shown]" : ""));
  const note = left
    ? "(" + left + " earlier message" + (left === 1 ? " is" : "s are") + " not shown here. Do not assume what they said.)\n"
    : "";
  return heading + " — oldest first, their latest message is below, not here.\n" + note + (lines.length ? lines.join("\n") : "(nothing shown)");
}

// ── WHAT THE BUILDER CAN DO, AND HOW SURE TO BE ─────────────────────────────
//
// One statement, read by the router and by this call, so the two never
// describe a different product. It says what is known to work, what is known
// not to be offered, and that anything else is a question to be honest about
// rather than a "no".
export const CAPABILITIES =
  "WHAT THE BUILDER CAN DO, so you describe it accurately:\n" +
  "- Build a complete website from a description — pages, words, design, and its own Postgres database when the " +
  "site stores things — and publish it at its own address. Attached images and PDFs can be used as reference for " +
  "a build, and a pasted link can be read.\n" +
  "- Change a site that exists when the owner asks in plain words: wording, colours, fonts and layout, pictures and " +
  "the logo, the menu, a page's content or address, the entries in its lists (a menu, products, services, team), " +
  "and settings such as whether bookings are open. It can add pages and features, and remove them. Every change is " +
  "saved as a version that can be undone by asking.\n" +
  "- Features a site can have: bookings and enquiries visitors send in, orders and payments through the owner's own " +
  "Stripe account, email through the owner's own email key, sign-in for the site's members, spam protection, a " +
  "custom domain, a search-engine description, and redirects for moved pages.\n" +
  "- Files: the owner can upload pictures, documents, and video and audio files to the site's file library, and use " +
  "them on the site — a video or audio player on a page plays the owner's own file from its address.\n" +
  "- The owner can see and edit the rows in the site's database tables in the Data panel.\n" +
  "NOT OFFERED today: visitors uploading video or audio, a mobile app in the app stores, email newsletters or " +
  "campaigns, editing video or audio, and writing code the owner runs elsewhere.\n" +
  "ANYTHING ELSE you are asked about is something you are not sure of: say so honestly — that you are not certain " +
  "the builder can do it — and suggest describing it as a request so the builder can try, or a way to get close. " +
  "Never promise something you are unsure of, and never flatly say it is impossible when you only do not know.";

// ── WHAT THE MODEL KNOWS, AND WHAT IT MUST NOT CLAIM ────────────────────────
export const HONESTY =
  "WHAT YOU KNOW AND WHAT YOU DID. Everything you know about their site is written in this message, read from the " +
  "site the builder stores for them; anything not written here you do not know. In this conversation you have not " +
  "opened their live site, visited any web address, searched the web, run or tested anything, changed anything, or " +
  "watched a video or listened to a recording — so never say or imply that you checked, looked at, tested, visited, " +
  "watched, listened to or changed something. When the answer depends on something you were not shown, say what you " +
  "do not know and how they could find out or tell you. Never invent a page, a table, a feature, a file or a number.";

export const CONVERSE_SYSTEM =
  "You are the assistant inside Go Farther, a website builder for small businesses. The person you are talking to " +
  "owns the project: a site they are building or one that is already published. This message is conversation, not " +
  "a request for work — a question, an idea to think through, a plan, a remark — and your reply is what they read.\n\n" +
  CAPABILITIES + "\n\n" + HONESTY + "\n\n" +
  "HOW TO ANSWER.\n" +
  "- Answer what they actually said, in the context of the conversation so far. A greeting gets a greeting and an " +
  "invitation to say what they want; a thank-you gets a short reply; a question gets an answer.\n" +
  "- Match the length to the question. A greeting, a quick fact or a yes-or-no question: a sentence or two. An " +
  "explanation, a comparison, ideas to choose from, or a plan: as much as it needs to be genuinely useful, and no " +
  "padding. You have room for about 1,500 words; most answers need far fewer.\n" +
  "- Write like a helpful person, warm and direct. No stock openings such as \"Certainly!\" or \"Great question!\".\n" +
  "- Format only when it helps reading. The chat shows a small set of Markdown: short headings (## or ###), bulleted " +
  "and numbered lists, **bold**, `code`, and links written [like this](https://example.com). Nothing else — no " +
  "tables, images or HTML. A short answer is plain sentences.\n" +
  "- No emoji and no checkmark or warning symbols, unless they asked for them.\n" +
  "- You cannot make changes in this reply. When they would like something done, tell them they can just ask for it " +
  "(for example \"Add a page for our catering menu\") and it will be done as a separate step. Do not claim anything " +
  "has been or is being done.\n" +
  "- If a question of ours is waiting for their answer (said below), it stays open: answer what they asked now, and " +
  "you may remind them briefly that the question is still there.";

// ── THE SITE, AS THE ROUTE READ IT ──────────────────────────────────────────
export const CONTEXT_CHARS = 16000;
const PAGE_CHARS = 1500;
const MAX_FILES_SHOWN = 40;

function kb(n) {
  if (!Number.isFinite(n) || n < 0) return "";
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + " MB";
  return Math.max(1, Math.round(n / 1000)) + " KB";
}
function secs(n) {
  if (!Number.isFinite(n) || n <= 0) return "";
  const s = Math.round(n);
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

/**
 * The site context block. `ctx` is the route's reading (`readConverseContext`
 * shape): every field optional, and what could not be read is said as not
 * known rather than left to look like nothing. Bounded to `CONTEXT_CHARS`, the
 * cut said.
 */
export function siteContextBlock(ctx) {
  const c = ctx && typeof ctx === "object" ? ctx : {};
  const out = [];
  if (c.exists !== true) {
    out.push("THEIR PROJECT\nNo site has been built for this project yet.");
    if (typeof c.brief === "string" && c.brief.trim()) out.push("What they first described: " + c.brief.trim().slice(0, 2000));
    const qa = Array.isArray(c.qa) ? c.qa.filter((p) => p && typeof p.q === "string" && typeof p.a === "string") : [];
    if (qa.length) out.push("Questions already asked and answered:\n" + qa.map((p) => "- " + p.q.trim() + " -> " + p.a.trim()).join("\n"));
  } else {
    const head = ["THEIR SITE"];
    if (typeof c.name === "string" && c.name.trim()) head.push("It is called " + c.name.trim() + ".");
    if (typeof c.url === "string" && c.url.trim()) head.push("It is published at " + c.url.trim() + ".");
    out.push(head.join("\n"));
    const pages = Array.isArray(c.pages) ? c.pages : null;
    if (pages && pages.length) {
      const lines = pages.map((p) => {
        const words = typeof p.text === "string" && p.text.trim() ? p.text.trim() : "";
        const cut = words.length > PAGE_CHARS;
        return "Page " + p.path + (words ? ": " + words.slice(0, PAGE_CHARS) + (cut ? " … [more words on this page not shown]" : "") : " (its words could not be read)");
      });
      out.push("ITS PAGES AND THE WORDS ON THEM (as stored, not a view of the live page):\n" + lines.join("\n"));
    } else if (Array.isArray(c.paths) && c.paths.length) {
      out.push("Its pages are: " + c.paths.join(", ") + ". Their words could not be read for this answer.");
    } else out.push("Its pages could not be read for this answer.");
    if (Array.isArray(c.tables)) {
      if (!c.tables.length) out.push("It has no database tables.");
      else {
        out.push("ITS DATABASE TABLES (names and columns only — you are not shown any rows):\n" + c.tables.map((t) =>
          "- " + t.name + (Array.isArray(t.columns) && t.columns.length ? " (" + t.columns.join(", ") + ")" : "") +
          (t.who ? " — " + t.who : "")).join("\n"));
      }
    } else out.push("Its database tables could not be read for this answer.");
    if (Array.isArray(c.files)) {
      if (!c.files.length) out.push("Its file library is empty.");
      else {
        const shown = c.files.slice(0, MAX_FILES_SHOWN);
        out.push("ITS FILE LIBRARY (what the owner uploaded; you know each file's name, kind and size, not what is in it):\n" +
          shown.map(fileLine).join("\n") + (c.files.length > shown.length ? "\n(" + (c.files.length - shown.length) + " more files not listed)" : ""));
      }
    } else out.push("Its file library could not be read for this answer.");
  }
  let text = out.join("\n\n");
  if (text.length > CONTEXT_CHARS) text = text.slice(0, CONTEXT_CHARS) + "\n[the rest of the site's description is not shown]";
  return text;
}

/** One library file, as a line: what it is and its address — never its contents. */
export function fileLine(f) {
  const kind = f.kind === "video" ? "video" : f.kind === "audio" ? "audio" : f.kind === "doc" ? "document" : "picture";
  const bits = [kind];
  if (f.mime) bits.push(String(f.mime));
  const size = kb(Number(f.size));
  if (size) bits.push(size);
  const d = secs(Number(f.duration));
  if (d) bits.push(d + " long (as the owner's browser reported)");
  if (Number.isInteger(f.width) && Number.isInteger(f.height) && f.width > 0 && f.height > 0) bits.push(f.width + "×" + f.height);
  return "- " + (f.name ? JSON.stringify(String(f.name)) + " " : "") + "at " + f.url + " (" + bits.join(", ") + ")";
}

/** Files that came with this message: named, and said to be unseen. */
export function attachedBlock(files) {
  const list = (Array.isArray(files) ? files : []).filter((f) => f && typeof f === "object" && typeof f.name === "string").slice(0, 12);
  if (!list.length) return "";
  return "FILES THEY ATTACHED TO THIS MESSAGE — you were not shown their contents, only these names:\n" +
    list.map((f) => "- " + JSON.stringify(f.name.slice(0, 200)) + (typeof f.kind === "string" && f.kind ? " (" + f.kind.slice(0, 20) + ")" : "")).join("\n") +
    "\nYou can discuss what they might use them for. Do not describe what is in them.";
}

/** A question of ours that is waiting: it stays open while they talk. */
export function waitingBlock(pending) {
  const p = pending && typeof pending === "object" ? pending : null;
  if (!p || typeof p.question !== "string" || !p.question.trim()) return "";
  return "A QUESTION OF OURS IS WAITING FOR THEIR ANSWER, and stays open: " + p.question.trim() +
    (typeof p.request === "string" && p.request.trim() ? "\nIt is about their request: " + p.request.trim().slice(0, 2000) : "");
}

/**
 * The one definition of the conversation call. `gist` is the router's own
 * short reply: shown as a starting point, never as the answer.
 */
export function converseRequest({ message, history = null, context = null, attached = [], pending = null, gist = "", model } = {}) {
  const text = String(message || "").trim().slice(0, MAX_INPUT_CHARS);
  const parts = [siteContextBlock(context)];
  const w = waitingBlock(pending);
  if (w) parts.push(w);
  const hb = historyBlock(history);
  if (hb) parts.push(hb);
  const a = attachedBlock(attached);
  if (a) parts.push(a);
  parts.push("THEIR LATEST MESSAGE\n" + text);
  if (typeof gist === "string" && gist.trim()) {
    parts.push("A FIRST THOUGHT ON A REPLY, from the step that read the message (use it only if it helps; it may be too short): " + gist.trim().slice(0, 1500));
  }
  return {
    model,
    max_tokens: CONVERSE_MAX_TOKENS,
    system: [{ type: "text", text: CONVERSE_SYSTEM }],
    messages: [{ role: "user", content: parts.join("\n\n") }],
  };
}

/**
 * The reply's text, read: the text blocks joined. `cut` when the model reached
 * the ceiling. Empty when there is none — the caller then has no reply.
 */
export function readConverse(reply) {
  const blocks = reply && Array.isArray(reply.content) ? reply.content : [];
  const text = blocks.filter((b) => b && b.type === "text" && typeof b.text === "string").map((b) => b.text).join("").trim();
  return { text, cut: !!(reply && reply.stop_reason === "max_tokens") };
}

/**
 * Write the reply. `deps.send(request)` is the model call. Never throws: a
 * failure answers `{ ok: false, stage }`, with no usage, so nothing is
 * charged for a reply we could not get.
 */
export async function converse(deps, args = {}) {
  let req;
  try { req = converseRequest(args); } catch { return { ok: false, stage: "request", usage: null }; }
  let reply;
  try { reply = await deps.send(req); } catch (e) { return { ok: false, stage: "send", usage: null, error: e }; }
  const r = readConverse(reply);
  if (!r.text) return { ok: false, stage: "empty", usage: null };
  const u = (reply && reply.usage) || {};
  return {
    ok: true, answer: r.text, cut: r.cut,
    usage: { in: Number(u.input_tokens) || 0, out: Number(u.output_tokens) || 0, cacheRead: Number(u.cache_read_input_tokens) || 0, cacheWrite: Number(u.cache_creation_input_tokens) || 0, model: args.model },
  };
}
