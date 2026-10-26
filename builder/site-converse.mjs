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
import { summaryBlock } from "./chat-context.mjs";
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
/**
 * THE LATEST REPLY IS SHOWN WHOLER (2026-10-15, the conversation batch). A
 * reply listing five ideas runs past 800 characters, so "use the second idea"
 * could point past the router's cut while the reply's own call saw the list
 * whole — and the router, rightly, asked them to say it again. The assistant's
 * most recent turn — the one a follow-up nearly always leans on — keeps up to
 * this much; every other turn keeps its 800. The total grows to match, and only
 * when such a reply is there to show.
 */
export const ROUTER_LAST_REPLY_CHARS = 3200;
export const ROUTER_HISTORY_CHARS = 6400;
const ROLES = Object.freeze(["user", "assistant"]);

/** The most the page may say it left out: a count beyond this is not a count. */
const MAX_OMITTED = 100000;
const MAX_FULL = 10_000_000;

/**
 * The page's history, read: `{ turns: [{ role, text, cut?, full? }], left: n }`,
 * the most recent last, `left` how many earlier turns were not kept — here or
 * by the page. Anything that is not a list of `{ role: "user"|"assistant",
 * text: string }` is skipped and counted with the rest left out — never
 * coerced, never thrown on.
 *
 * WHAT THE PAGE CUT TRAVELS TOO (2026-10-15, Codex's review of `7ca339d1`):
 * the page keeps 30 turns of 4,000 characters, so before this a turn it had
 * cut, or the turns it had dropped, reached the model as if whole. Now the
 * page says so — `{ omitted: n }` opening the list, and `full` on a cut turn
 * — and each is read strictly: an integer in range, and a `full` longer than
 * the text it came with. Anything else is not believed (it claims no cut), so
 * a wrong figure can never make a whole turn look cut or a cut one look
 * whole. A turn cut on either side carries `full`: its length before any cut.
 */
export function readHistory(v, { turns = HISTORY_TURNS, turnChars = HISTORY_TURN_CHARS, total = HISTORY_CHARS, lastReplyChars = 0 } = {}) {
  const all = Array.isArray(v) ? v : [];
  const kept = [];
  let left = 0;
  let used = 0;
  // THE MOST RECENT ASSISTANT TURN, which `lastReplyChars` may show at more
  // than `turnChars` (the router's window only).
  let lastReply = -1;
  for (let i = all.length - 1; i >= 0 && lastReplyChars > 0; i--) {
    const t = all[i];
    if (t && typeof t === "object" && !Array.isArray(t) && t.role === "assistant" && typeof t.text === "string" && t.text.trim()) { lastReply = i; break; }
  }
  for (let i = all.length - 1; i >= 0; i--) {
    const t = all[i];
    if (i === 0 && isOmitted(t)) { left += t.omitted; continue; }
    const ok = t && typeof t === "object" && !Array.isArray(t) && ROLES.includes(t.role) && typeof t.text === "string" && t.text.trim();
    if (!ok) { left++; continue; }
    if (kept.length >= turns || used >= total) { left++; continue; }
    let text = t.text.trim();
    const wireFull = Number.isInteger(t.full) && t.full > text.length && t.full <= MAX_FULL ? t.full : 0;
    let cut = wireFull > 0;
    const before = wireFull || text.length;
    const room = Math.min(i === lastReply ? Math.max(turnChars, lastReplyChars) : turnChars, total - used);
    if (text.length > room) { text = text.slice(0, room); cut = true; }
    used += text.length;
    kept.unshift({ role: t.role, text, ...(cut ? { cut: true, full: before } : {}) });
  }
  return { turns: kept, left };
}
/** The page's own count of earlier turns it did not send: `{ omitted: n }` and nothing else. */
function isOmitted(t) {
  return !!t && typeof t === "object" && !Array.isArray(t) && Object.keys(t).length === 1 &&
    Number.isInteger(t.omitted) && t.omitted > 0 && t.omitted <= MAX_OMITTED;
}

/** The router's window, from the same reading. */
export function routerHistory(v) {
  return readHistory(v, { turns: ROUTER_HISTORY_TURNS, turnChars: ROUTER_TURN_CHARS, total: ROUTER_HISTORY_CHARS, lastReplyChars: ROUTER_LAST_REPLY_CHARS });
}

/**
 * The window as the model reads it: each turn labelled with who said it, in
 * order, with every cut said. Empty when there is nothing to show.
 */
export function historyBlock(h, heading = "THE CONVERSATION SO FAR") {
  const turns = h && Array.isArray(h.turns) ? h.turns : [];
  const left = h && Number.isInteger(h.left) && h.left > 0 ? h.left : 0;
  if (!turns.length && !left) return "";
  const lines = turns.map((t) => (t.role === "user" ? "Owner: " : "Assistant (you): ") + t.text + (t.cut ? cutNote(t) : ""));
  const note = left
    ? "(" + left + " earlier message" + (left === 1 ? " is" : "s are") + " not shown here. Do not assume what they said.)\n"
    : "";
  const gap = left || turns.some((t) => t.cut)
    ? "\nPARTS OF THIS CONVERSATION ARE NOT SHOWN (marked above). If their latest message refers to something that " +
      "could be in a part not shown — words you suggested, an option, a detail — and you cannot find it above, do not " +
      "guess or fill it in: say which part you cannot see and ask them to say it again."
    : "";
  return heading + " — oldest first, their latest message is below, not here.\n" + note + (lines.length ? lines.join("\n") : "(nothing shown)") + gap;
}
/** The conversation as `historyBlock` writes it, one piece per turn: the heading first, any note on what is not shown last. */
export function historyParts(h) {
  const turns = h && Array.isArray(h.turns) ? h.turns : [];
  const left = h && Number.isInteger(h.left) && h.left > 0 ? h.left : 0;
  if (!turns.length && !left) return [];
  const whole = historyBlock(h);
  const lines = turns.map((t) => (t.role === "user" ? "Owner: " : "Assistant (you): ") + t.text + (t.cut ? cutNote(t) : ""));
  if (!lines.length) return [whole];
  const start = whole.indexOf(lines[0]);
  const out = [whole.slice(0, start).replace(/\n$/, "")];
  let at = start;
  for (const l of lines) { out.push(l); at += l.length + 1; }
  const rest = whole.slice(at - 1).replace(/^\n/, "");
  if (rest) out.push(rest);
  return out.filter((x) => x.length);
}
function cutNote(t) {
  return Number.isInteger(t.full) && t.full > t.text.length
    ? " [cut: only the first " + t.text.length + " of its " + t.full + " characters are shown; the rest is not]"
    : " [the rest of this message is not shown]";
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
  "- Answer what they actually said, in the context of the conversation so far. A greeting gets a short, friendly " +
  "greeting and an easy opening to say what they want; a thank-you gets a short reply; a question gets an answer.\n" +
  "- Match the length to the need. A greeting, a quick fact or a yes-or-no question: a sentence or two. An " +
  "explanation, a comparison, ideas to choose from, a review of their site or a plan: as much as it needs to be " +
  "genuinely useful, and no padding. You have room for about 1,500 words; most answers need far fewer.\n" +
  "- Sound like a thoughtful person who knows websites and small businesses: warm, plain and direct. Be warm by being " +
  "useful and specific, not by being excited — no stock openings such as \"Certainly!\" or \"Great question!\", no " +
  "praise of the question, and no exclamation marks unless the moment really calls for one.\n" +
  "- Format only when it helps reading. The chat shows a small set of Markdown: short headings (## or ###), bulleted " +
  "and numbered lists, **bold**, `code`, and links written [like this](https://example.com). Nothing else — no " +
  "tables, images or HTML. A short answer is plain sentences.\n" +
  "- No emoji and no checkmark or warning symbols, unless they asked for them.\n\n" +
  "TALKING ABOUT THEIR SITE.\n" +
  "- Keep three things apart, and let the wording show which is which: what their site says, as written below (say " +
  "it as fact, and name the page); what you suggest (say it as a suggestion, with the reason); and what you do not " +
  "know (say so, and what would settle it). Never pass a suggestion off as something already on the site.\n" +
  "- When they ask what a page does or says, explain it from the words below, page by page, in plain terms.\n" +
  "- When they ask what to improve, suggest the few changes most likely to matter for their visitors and their " +
  "business, most important first, each with why — rather than a long list of everything possible. Base them on " +
  "what the site actually has and lacks.\n" +
  "- When they compare options, say what each is good for and which you would choose for them and why.\n" +
  "- When something you would need is missing — not on the site, not said in the conversation — say what is " +
  "missing and give the most useful answer you can without it, or ask the one thing that would settle it.\n\n" +
  "PLANS AND FOLLOW-UPS.\n" +
  "- When you offer several ideas or options, number them, so they can answer \"the second one\".\n" +
  "- When they are refining a plan with you, build on what was already agreed in the conversation; when the plan " +
  "changes, say the plan as it now stands.\n" +
  "- You cannot make changes in this reply. When a plan is ready, tell them in a sentence how to set it going in " +
  "their own words — for example \"go ahead with the first two\" — and it will be done as a separate step. Do not " +
  "end every reply with a question or an offer; only when a next step is natural. Do not claim anything has been or " +
  "is being done.\n" +
  "- If a note below says their message leans on something that could not be pinned down, do not guess: ask them " +
  "one short, specific question about exactly that, offering the candidates you can see.\n" +
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
 * THE TABLES THE CONVERSATION IS TOLD OF (2026-10-23, audit A36-2), from the
 * schema state (`readSchemaState`): the stored spec's tables with their
 * columns and access, AND every table the catalog has that the spec does not
 * declare (`missing`; all of them for `tables-without-metadata`), with the
 * catalog's columns and access said as not recorded. The router is told the
 * catalog's names, so the reply is never told "no tables" for the same site.
 * `null` when the state cannot be read. Identifier-shaped names only.
 */
const CONVERSE_NAME = /^[a-z_][a-z0-9_]{0,62}$/i;
export function converseTables(st, label = null) {
  if (!st || st.ok !== true || !st.spec || !Array.isArray(st.spec.tables)) return null;
  const declared = st.spec.tables.filter((t) => t && typeof t.name === "string" && CONVERSE_NAME.test(t.name)).map((t) => {
    let who = "";
    try { who = typeof label === "function" ? label(t) : ""; } catch { who = ""; }
    const cols = (Array.isArray(t.columns) ? t.columns : []).map((c) => (typeof c === "string" ? c : c && typeof c.name === "string" ? c.name : "")).filter((c) => CONVERSE_NAME.test(c)).slice(0, 30);
    return { name: t.name, columns: cols, who: who ? "access: " + who : "" };
  });
  const have = new Set(declared.map((t) => t.name.toLowerCase()));
  const catalog = Array.isArray(st.columns) ? st.columns : [];
  const extra = (Array.isArray(st.missing) ? st.missing : []).filter((n) => typeof n === "string" && CONVERSE_NAME.test(n) && !have.has(n.toLowerCase())).map((n) => ({
    name: n,
    columns: catalog.filter((r) => r && r.t === n && typeof r.c === "string" && CONVERSE_NAME.test(r.c)).map((r) => r.c).slice(0, 30),
    who: "access not recorded",
  }));
  return [...declared, ...extra].slice(0, 24);
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
    // DRAFT-FIRST (2026-10-23, audit A36-4): every change is saved to a draft
    // and goes live only when the owner presses Publish, and the stored pages
    // below are that draft — never told as what visitors see.
    if (c.draftFirst === true) head.push("Every change is saved to a draft first and goes live only when they press Publish. The pages below are as saved, which may include changes not published yet: never say a change is live unless they have published it. Nothing you say publishes: when they ask to publish or put their changes live, tell them to press the Publish button above their site.");
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
    // THE SITE MAP'S KEY FACTS (2026-10-26), with where each is written.
    if (typeof c.keyFacts === "string" && c.keyFacts.trim()) out.push(c.keyFacts.trim());
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

/** What the step that read the message could not pin down: the reply asks about exactly this. */
export function unclearBlock(unclear) {
  if (typeof unclear !== "string" || !unclear.trim()) return "";
  return "THEIR MESSAGE LEANS ON SOMETHING THAT COULD NOT BE PINNED DOWN: " + unclear.trim().slice(0, 300) +
    "\nAsk them one short, specific question about this — naming the candidates you can see — and do not guess.";
}

/**
 * The one definition of the conversation call. `gist` is the router's own
 * short reply: shown as a starting point, never as the answer.
 */
export function converseRequest({ message, history = null, summary = null, context = null, attached = [], pending = null, gist = "", unclear = "", model, cacheKey = "" } = {}) {
  const text = String(message || "").trim().slice(0, MAX_INPUT_CHARS);
  const parts = [siteContextBlock(context)];
  const w = waitingBlock(pending);
  if (w) parts.push(w);
  // THE SUMMARY OF WHAT CAME BEFORE (2026-10-20), when the conversation was compacted.
  const sb = summaryBlock(summary);
  if (sb) parts.push(sb);
  const hb = historyBlock(history);
  const head = parts.slice();
  if (hb) parts.push(hb);
  const tail = [];
  const a = attachedBlock(attached);
  if (a) tail.push(a);
  tail.push("THEIR LATEST MESSAGE\n" + text);
  const u = unclearBlock(unclear);
  if (u) tail.push(u);
  if (typeof gist === "string" && gist.trim()) {
    tail.push("A FIRST THOUGHT ON A REPLY, from the step that read the message (use it only if it helps; it may be too short): " + gist.trim().slice(0, 1500));
  }
  // ── CACHED FROM ONE REPLY TO THE NEXT (2026-10-20, owner: "but the catching
  // is in place too right?") ─────────────────────────────────────────────────
  // With a conversation, the message is sent as blocks: the site and the
  // summary, then each turn of the conversation as its own block, the last of
  // them marked for the cache, then the new message. The next reply's request
  // starts with the same blocks, so Claude reads them from its cache (a tenth
  // of the price) instead of paying for them again; Grok caches the same
  // prefix by itself, kept on one server by `cacheKey` (`prompt_cache_key`).
  // Without a conversation it stays one string, as it always was.
  const turns = hb ? historyParts(history) : [];
  const content = turns.length
    ? [
        ...(head.length ? [{ type: "text", text: head.join("\n\n") }] : []),
        ...turns.map((t, i) => (i === turns.length - 1 ? { type: "text", text: t, cache_control: { type: "ephemeral" } } : { type: "text", text: t })),
        { type: "text", text: tail.join("\n\n") },
      ]
    : parts.concat(tail).join("\n\n");
  return {
    model,
    max_tokens: CONVERSE_MAX_TOKENS,
    system: [{ type: "text", text: CONVERSE_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content }],
    ...(typeof cacheKey === "string" && cacheKey ? { cacheKey } : {}),
  };
}
/** All the characters a request carries to the model, whichever shape its message took. */
export function requestChars(req) {
  const sys = req && Array.isArray(req.system) ? req.system.reduce((n, b) => n + (b && typeof b.text === "string" ? b.text.length : 0), 0) : 0;
  const msgs = req && Array.isArray(req.messages) ? req.messages : [];
  return sys + msgs.reduce((n, m) => n + (typeof m.content === "string" ? m.content.length
    : Array.isArray(m.content) ? m.content.reduce((k, b) => k + (b && typeof b.text === "string" ? b.text.length : 0), 0) : 0), 0);
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
