// PARKED (2026-11-03, park-old-way): the old router. Nothing live imports this file;
// see parked/old-way/README.md. Taken from builder/site-ask.mjs at 014a7cd31.
// Telling a question from an instruction — and answering the question.
//
// THE BUILDER COULD NOT BE ASKED ANYTHING. `siteSend` had exactly one decision
// in it — `isBuild = !sitePages(site).length` — so the FIRST message on a project
// built a site and EVERY LATER MESSAGE ran a full revise: designer, page
// generation, container compile, republish. There was no third answer.
//
// That is not a missing feature, it is a live bug, and an expensive one in both
// directions. Type "can you read a URL?" at an existing site and it costs ~21
// credits AND rewrites the customer's pages to whatever the model makes of the
// question. Type "hi" at a new project and it builds a site out of "hi". The
// cheapest possible interaction was routed down the most expensive path there
// is.
//
// ONE MODEL CALL, and that is the whole design constraint. Classifying and then
// answering as two calls makes the cheap path cost double, which defeats the
// point — so the tool returns both: what kind of message this is, and, when it
// is a question, the answer to it. A build request comes back with `intent`
// alone and the caller proceeds exactly as it always did.
//
// THE THIRD INTENT — the builder asking THEM (owner's call, 2026-08-08). On a
// first build it may ask one question before spending ~28 credits on a site
// built from a guess, with the answers as buttons rather than a typed reply, so
// the choice is a choice and not an essay. It rides on this same call, so the
// question costs nothing beyond the routing that was already happening.
//
// Three rules keep it from becoming an interview, and all three are in code
// rather than in the schema description: it is offered only on a FIRST build
// (never a revise), the budget is `MAX_CLARIFY` and is spent by arithmetic
// before the model is asked, and a malformed question is a build. The customer
// can also skip past the whole thing at any point — that is the composer's half.
//
// Plain module with its side effects injected, like `site-context.mjs` and
// `publish-pages.mjs`, so all of it is tested with no network and no Worker.

/** A small call: a routing decision and a short answer, not a design task. */
/**
 * THE PICKED MODEL, NOT A HARDCODED ONE (owner, 2026-08-31).
 *
 * Every small call on this platform was pinned to `claude-haiku-4-5`, so a
 * customer who had picked Grok still had Anthropic in their path — and when
 * Anthropic refused on billing, the whole cheap ladder went down with it while
 * builds carried on fine. Run 93 measured that: a `css` edit answered 503 in
 * 5.3s having spent nothing, and the lane it was testing never ran.
 *
 * DERIVED FROM THE TABLE rather than restated, so it cannot drift from the
 * picker, and it resolves to DEFAULT_PICKER — which is what a caller that
 * forgets to thread the picker gets. That is deliberately the platform default
 * and never Haiku: a forgotten hop should land on the model everything else
 * uses, not quietly back on the provider this change exists to leave.
 */
import { modelsFor } from "../../../builder/build-models.mjs";
import { MAX_INPUT_CHARS, echoTokens } from "../../../builder/input-budget.mjs";
import { historyBlock, readHistory, routerHistory } from "../../../builder/site-converse.mjs";
import { summaryBlock } from "../../../builder/chat-context.mjs";
import { deviceHintLine, readDevices } from "../../../builder/device-scope.mjs";
import { readTargets } from "../../../builder/request-plan.mjs";
import { retryRequest, markRetry, addUsages } from "../../../builder/retry-reason.mjs";
import { normalizePagePath, readPartOf, contextBlock, CONTEXT_HEADING, LIVE_ASK_TOOL, ASK_TOOL, partBlock, usableAsk, APPS_OPEN, heldParts, wordSpans, WORD_CHAR, EDIT_LAYERS, REMOVABLE_LAYERS, MAX_OPTIONS, MIN_OPTIONS, routeDecision, readContext, routeFailure, messageItems, START_OVER_BY, appendAnswer, repeatOf, MAX_SAME_ASK, MAX_ASKED, againNote, withReuse, heldList, OWN_REMOVAL_LAYERS, DOOR_LAYERS, HELD_ITEMS, MODEL3D_FIELD, layerLine, ROUTE_REASONS, wordsIn, tidyJoins, ASK_UNUSABLE, readAsk, MAX_HISTORY, MAX_ANSWER_CHARS, MAX_NOTE_CHARS, shownContext, withNote, withContext, PART_HEADING, readSpans, withPart, reuseNote, clarifiedBrief, ROUTE_ERROR_CLASSES, PROVIDER_CODES, providerCode } from "../../../builder/route-shared.mjs";
// The pieces the live code still uses now live in builder/route-shared.mjs; re-exported here so the parked tests read one module.
export { MIN_OPTIONS, MAX_OPTIONS, EDIT_LAYERS, REMOVABLE_LAYERS, OWN_REMOVAL_LAYERS, DOOR_LAYERS, ASK_TOOL, HELD_ITEMS, messageItems, APPS_OPEN, MODEL3D_FIELD, START_OVER_BY, LIVE_ASK_TOOL, layerLine, ROUTE_REASONS, routeDecision, normalizePagePath, wordSpans, wordsIn, heldList, tidyJoins, heldParts, ASK_UNUSABLE, readAsk, usableAsk, MAX_ASKED, MAX_HISTORY, MAX_SAME_ASK, MAX_ANSWER_CHARS, MAX_NOTE_CHARS, readContext, shownContext, repeatOf, appendAnswer, CONTEXT_HEADING, contextBlock, withNote, withContext, PART_HEADING, readPartOf, readSpans, partBlock, withPart, reuseNote, withReuse, againNote, clarifiedBrief, ROUTE_ERROR_CLASSES, PROVIDER_CODES, providerCode, routeFailure };


export const ASK_MODEL = modelsFor().quick;

/**
 * Enough for a real answer and not enough for an essay.
 *
 * Output is billed at 5x input, so this is the one number here that moves the
 * bill. A question in a builder is "what did you build", "can you read a link",
 * "how do I add a photo" — three or four sentences each. Capped in the SCHEMA
 * description as well, because `max_tokens` truncates mid-word while a
 * description shortens.
 */
export const ASK_MAX_TOKENS = 700;

/**
 * What writing a request out from the conversation may add (`resolved`,
 * 2026-10-14): a paragraph, on a call shown a conversation and on no other.
 */
export const RESOLVED_TOKENS = 400;
/** The words of the conversation a routing call is shown (`readHistory`'s turns). */
function shownTurns(h) {
  return (h && Array.isArray(h.turns) ? h.turns : []).map((t) => (t && typeof t.text === "string" ? t.text : ""));
}

/**
 * HOW MUCH OF A FIRST BUILD'S MESSAGE AND BRIEF THE ROUTER CONSIDERS — the
 * build's own bound, unchanged. A site that exists is not bounded by this
 * (2026-10-03): its messages, answers and held-back parts are kept whole up to
 * the size policy (`MAX_INPUT_CHARS` in input-budget.mjs), refused beyond it
 * and never cut.
 */
// THE ONE-MESSAGE POLICY FOR A FIRST BUILD TOO (2026-10-08, the content-
// preservation batch): the questions are asked of the whole message, which the
// route already refuses past `MAX_INPUT_CHARS` — never of a 2,000-character
// prefix.
export const MAX_MESSAGE = MAX_INPUT_CHARS;

/**
 * HOW MANY QUESTIONS A FIRST BUILD MAY ASK, ENFORCED IN CODE.
 *
 * Owner's call: ask one at a time, on every new project, never on a revise. One
 * at a time is the good version of this — each question can be chosen knowing
 * the last answer — and it is also the version that turns into an interrogation
 * if nothing stops it, because "have you got another question?" is a prompt a
 * model will nearly always say yes to.
 *
 * So the ceiling is arithmetic here, not a polite instruction in a schema
 * description. Three is a round of questions somebody will sit through before
 * seeing anything; the fourth is where they start wondering whether it can
 * actually build a site.
 */
export const MAX_CLARIFY = 3;
/** A first build's question: two short sentences, clipped at a word if longer (`clipQuestion`). */
export const MAX_QUESTION_CHARS = 240;

/** A first build's answer button (`clipOption`). */
export const MAX_OPTION_CHARS = 48;

/**
 * THE ESCALATION LADDER — edit → addon → build, cheapest rung first.
 *
 * Until this existed the router had two work answers, `build` and nothing else,
 * and on a site that already existed `build` meant a full revise: designer, all
 * pages regenerated, container, republish, ~25 credits. So "change the phone
 * number" and "build me a barber shop" ran the identical ten steps.
 *
 * Three rungs now, and the ONLY reason it is safe to default to a cheap one is
 * that each rung can hand off upward when it finds it cannot do the job. An
 * `edit` that locates no target becomes an `addon`; an `addon` that cannot
 * express the change becomes a `build`. So being wrong downward costs one cheap
 * step and then does the right thing, while being wrong upward costs the
 * customer real money for work nobody asked for.
 *
 * That inverts the old rule ON AN EXISTING SITE and leaves it intact everywhere
 * else. `readRouting`'s doctrine — every unclear case resolves to work, never to
 * a chatty paragraph — is unchanged and is what `FALLBACK_*` encode; what
 * changes is WHICH work, and only because the ladder makes the cheap answer
 * recoverable. With no site there is nothing to edit and nothing to add to, so
 * the fallback is still `build`.
 */
export const FALLBACK_WITH_SITE = "addon";
export const FALLBACK_NO_SITE = "build";

/** The block the router is shown under the message, or `""` when there are no items. */
export function itemsBlock(items) {
  return Array.isArray(items) && items.length >= 2
    ? "THEIR MESSAGE, ITEM BY ITEM (the same words; to hold any back, name them by number in heldItems)\n" +
      items.map((it) => "[" + it.n + "] " + it.text.replace(/\s+/g, " ")).join("\n")
    : "";
}

/**
 * AN ANSWER THAT HOLDS ITEMS BACK BY NUMBER, read as the customer's own text
 * (2026-10-23). `heldItems` becomes `alsoAsked`: each held item's text, in
 * item order, exactly as it stands in the message, so the routes always find
 * it. A number that is not an item is ignored (`items-out`); every item held
 * keeps the first with the answer (`items-all-held`), since an answer makes
 * something; no item number read, no items shown, or the answer written out
 * from the conversation (`resolved`), leaves the answer as it came: the words
 * form, read as before. Never coerced: `"5"` is not 5.
 */
export function itemsToWords(input, items, trace = null) {
  const mark = noteTo(trace);
  if (!input || typeof input !== "object" || !given(input.heldItems)) return input;
  const { heldItems, ...rest } = input;
  if (!Array.isArray(items) || items.length < 2 || given(input.resolved)) { mark("items-ignored"); return rest; }
  if (!Array.isArray(heldItems)) { mark("items-unread"); return rest; }
  const n = items.length;
  const pick = [];
  for (const v of heldItems) {
    if (!Number.isInteger(v) || v < 1 || v > n) { mark("items-out"); continue; }
    if (!pick.includes(v)) pick.push(v);
  }
  if (!pick.length) return rest;
  pick.sort((a, b) => a - b);
  if (pick.length === n) { mark("items-all-held"); pick.shift(); }
  mark("items-held");
  return { ...rest, alsoAsked: pick.map((i) => items[i - 1].text) };
}

/**
 * THE ROUTER'S 3D ANSWER, READ: `{ from, subject, page }` or null. A subject
 * that is not words, or too long for fal's prompt (600), is no answer.
 */
export function readModel3d(raw, { pages = [] } = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (raw.from !== "words" && raw.from !== "photo") return null;
  if (typeof raw.subject !== "string") return null;
  const subject = raw.subject.replace(/\s+/g, " ").trim();
  if (!subject || subject.length > 600) return null;
  let page = typeof raw.page === "string" ? raw.page.trim().replace(/\/+$/, "") || "/" : "/";
  if (!/^\/[a-z0-9/_-]{0,120}$/i.test(page)) page = "/";
  const known = (Array.isArray(pages) ? pages : []).map(normalizePagePath).filter(Boolean);
  if (known.length && !known.includes(page)) page = "/";
  return { from: raw.from, subject, page };
}

/**
 * WHAT THE ANSWER IS ALLOWED TO KNOW.
 *
 * A question about the customer's own site ("what pages do I have?", "where do
 * the bookings go?") is answerable only from this, and the alternative to
 * supplying it is a model that invents a plausible site. Deliberately small —
 * names, not contents — because it rides on every builder message and the rows
 * of a `collect` table are customer data that has no business in a routing call.
 */
/** What the router is told under draft-first (audit #216). */
export const DRAFT_FIRST_FACT =
  "Every change they ask for is saved as a draft and goes live only when they press the Publish button above their site; " +
  "the pages named here may include saved changes that are not published yet. Nothing you route publishes: when they ask " +
  "to publish or put their changes live (\"publish my changes\", \"make it live\"), answer \"ask\" and tell them to press " +
  "the Publish button above their site, which shows what will go live.";

export function siteDigest(site, { tablesNone = false } = {}) {
  const s = site || {};
  const bits = [];
  const name = String(s.name || "").trim();
  if (name) bits.push("The site is called " + name + ".");
  const url = String(s.url || "").trim();
  if (url) bits.push("It is published at " + url + ".");
  // DRAFTS UNTIL PUBLISH (2026-10-23, the owner's choice on audit #216 /
  // A36-4): under draft-first every change is saved as a draft and goes live
  // only when the owner presses Publish, so the router is told, and a typed
  // "publish my changes" is pointed at the button rather than read as work.
  // Strictly `=== true`, and set by the route from the Worker's own switch.
  if (s.draftFirst === true && bits.length) bits.push(DRAFT_FIRST_FACT);
  const { pages, tables } = digestLists(s);
  if (pages.length) bits.push("Its pages are: " + pages.join(", ") + ".");
  if (tables.length) bits.push("Its database tables are: " + tables.join(", ") + ".");
  // NONE, WHEN THE ROUTE READ THE SITE AND FOUND NONE (2026-10-05): said, so the
  // router never takes a site with no tables for one whose tables it was not
  // told. Only the route's own read says so (`tablesNone`), never the browser.
  else if (tablesNone === true) bits.push("It has no database tables.");
  if (!bits.length) return "They have not built anything yet — this is a brand new, empty project.";
  return bits.join(" ");
}

/**
 * The page addresses and table names the router is shown, and whether the
 * table names are fewer than were sent. ONE READER for both: the digest shows
 * these, and the decision report (`ROUTE_REASONS`, `tables-cut`) says when the
 * names were cut, so the two cannot disagree about what the model saw.
 *
 * EVERY PAGE (2026-10-03, the owner's first information-limits batch: *"route
 * decisions use complete, authoritative page identities rather than a partial
 * browser cache"*). The addresses were cut at 24, so the router could not name
 * a site's 25th page, and the lane picker — shown the site's real pages through
 * this same reader — could not either. A page address is a few dozen
 * characters, and a site has as many as it has published: the list is the
 * site's own, not a window of it.
 */
export const MAX_DIGEST_TABLES = 64;
export function digestLists(site) {
  const s = site || {};
  const sentPages = Array.isArray(s.pages) ? s.pages : [];
  const sentTables = Array.isArray(s.tables) ? s.tables : [];
  const pages = sentPages.filter((p) => typeof p === "string" && p.trim());
  // 64, NOT 24 (2026-10-25, router-b1): a table name is a few characters and
  // the audit found a site's tables were the facts the router lacked.
  const tables = sentTables.filter((t) => typeof t === "string" && t.trim()).slice(0, MAX_DIGEST_TABLES);
  return { pages, tables, tablesCut: tables.length < sentTables.length };
}

const SYSTEM =
  "You are the assistant inside a website builder for small businesses. The person you are talking to owns the site. " +
  "Every message they send is either an instruction to build or change their site, or something else — a question, a " +
  "greeting, a thank-you. Your job is to say which, and to answer the ones that are not instructions.\n\n" +
  // NO CAPABILITIES LIST (owner, 2026-11-02): the router does not tell the owner
  // what the builder can do; the agent does the work and says so.
  "Do not describe what you are about to do when the answer is \"build\" — the build reports itself. " +
  "Never claim the site has a page, a table, or a feature that is not named below.\n\n" +
  "CONVERSATION IS NOT WORK. A question, a plan they are thinking through, a request for ideas or a comparison, a " +
  "remark about files they attached, or a side question while one of ours waits is \"ask\" — even when it is about " +
  "a change they might make later. Work is a request to make a change now. When the latest message asks for work " +
  "and leans on the conversation shown to you (\"do that\", \"the second one\"), it is work, written out in full " +
  "in `resolved` — unless what it leans on is in a part of the conversation marked as not shown, or cannot be found " +
  "in what is shown: then it is \"ask\", asking them to say it again. Your \"ask\" answer is only the gist: the " +
  "reply they read is written afterwards, with room.\n\n" +
  "THINKING IT THROUGH, THEN DOING IT. Asking for ideas, opinions, a review of their site, what to improve first, or " +
  "a plan — \"what would you change on my home page?\", \"give me three headline ideas\", \"should the menu come " +
  "first?\" — is \"ask\", however much it talks about changes: they are deciding, not instructing. Refining that " +
  "plan (\"drop the third one\", \"what if the menu came first?\") is still \"ask\". A plain go-ahead after it — " +
  "\"go ahead\", \"do it\", \"yes, make those changes\", \"use the second idea\", \"do that on every page\" — is " +
  "work, written out in `resolved`; never answer it with a question asking them to confirm what they just said. " +
  "When the go-ahead could mean more than one thing in the conversation, or points at a part not shown, it is " +
  "\"ask\" with `unclear` saying what — one focused question, not a guess.\n\n" +
  "DECIDE IN THIS ORDER, and stop at the first one that fits.\n" +
  "1. Is the message conversation — a greeting, a thank-you, a question about you or about their site, an idea or a " +
  "plan they are thinking through — \"hi\", \"thanks\", \"what can you do?\", \"can you read a link?\", \"what " +
  "should my home page say?\" — rather than a description of a site to build or a change to make? Then \"ask\". " +
  "NEVER open with a question of your own here: somebody who typed \"hey\" has not told you anything yet, so there is " +
  "nothing to ask them ABOUT. Say hello back and invite them to tell you what they want.\n" +
  "2. Otherwise, if you are told below that this is a first build with questions remaining, and they HAVE described " +
  "something to build: \"clarify\" — BUT ONLY IF THE ANSWER WOULD CHANGE WHAT YOU BUILD. Two things do, and almost " +
  "nothing else does: what the business actually IS, and what visitors DO on the site (book a time, order something, " +
  "send an enquiry, or just read it). Either one changes the pages, the words and what the site stores, and a build " +
  "takes about a minute and costs them again to redo, so the cheapest moment to learn them is before it runs.\n" +
  "   IF THE BRIEF DOES NOT SAY WHAT THE BUSINESS ACTUALLY IS, YOU MUST ASK. That one is never a judgement call: " +
  "\"a website for my business\" and \"book classes\" name no trade, and a gym, a pottery studio and a driving school " +
  "are three different sites. Everything else hangs off it.\n" +
  "   OTHERWISE, IF THE BRIEF ALREADY ANSWERS BOTH, BUILD — do not spend a question just because you have one left. " +
  "A question whose answer changes nothing is a minute of somebody's time, and they came to see a site, not to fill " +
  "in a form. Never ask for things the owner types in afterwards — address, opening hours, prices, phone number, " +
  "staff names — and never ask something they have already told you.\n" +
  "3. Otherwise it is WORK, and which of the three depends on whether a site already exists. You are told below which " +
  "case you are in, and the answers are not interchangeable:\n" +
  "   NO SITE YET — \"build\", always. There is nothing to edit and nothing to add to.\n" +
  "   A SITE EXISTS — \"edit\" or \"addon\", and \"build\" only to throw the whole site away and start again. Pick the " +
  "cheapest one that can honestly do the job: an edit is seconds and costs almost nothing, an addon costs a few " +
  "credits, a rebuild costs about twenty-five and replaces every page they have. Somebody who asked for a different " +
  "shade of blue must never be given a new site. COST NEVER MAKES A NEW ENTRY AN EDIT: a new product, service or " +
  "team member in one of their lists is an \"addon\" even though the list already exists, because for a list an " +
  "edit only changes or takes away the entries that are already there. Nor does it make the other additions edits: " +
  "a new menu link, footer link or button, a new line of words or a new photograph on a page is an \"addon\" even " +
  "though the menu, the footer and the page already exist.\n\n" +
  "WHAT THE THREE COST, because it is the whole reason they are separate. Changing words: no model writes anything, " +
  "the words are lifted out of the page and put back. Changing the look: the design is adjusted and the site is " +
  "recompiled, and not one page is rewritten. Adding a page: one page is written. Rebuilding: every page is written " +
  "again from nothing, and whatever the owner had is gone.";

// ── A SITE THAT EXISTS IS SENT ONE TIE-BREAK (2026-10-25, router-b1) ────────
//
// `SYSTEM`'s third step told a live site to "pick the cheapest one that can
// honestly do the job" and restated the new-entry and frame rules, against the
// tool's own tie-break (the audit's contradiction 2). A site that exists is
// sent `SYSTEM` with that paragraph replaced by a pointer to the one rule in
// the tool's `intent`; a first build is sent `SYSTEM` exactly as it was.
const SYSTEM_SITE_AT = "   A SITE EXISTS — ";
const SYSTEM_SITE_END = "\n\nWHAT THE THREE COST";
const LIVE_SITE_STEP =
  "   A SITE EXISTS — \"edit\" or \"addon\", decided by the one test in the tool's `intent` field against the site " +
  "inventory, and \"build\" only to throw the whole site away and start again: it replaces every page they have. " +
  "Somebody who asked for a different shade of blue must never be given a new site.";
export const LIVE_SYSTEM = (() => {
  const at = SYSTEM.indexOf(SYSTEM_SITE_AT);
  const end = SYSTEM.indexOf(SYSTEM_SITE_END, at);
  if (at < 0 || end < 0 || SYSTEM.indexOf(SYSTEM_SITE_AT, at + 1) >= 0) throw new Error("site-ask: the system's site step was not found exactly once");
  return SYSTEM.slice(0, at) + LIVE_SITE_STEP + SYSTEM.slice(end);
})();

// ── WHAT THE SITE HAS, FOR A SITE THAT EXISTS (2026-10-25, router-b1) ───────
// The route's own read (`builder/route-inventory.mjs`), after the digest: per
// site, after the stable tools and system, so the cached prefix holds.
const MAX_INVENTORY_CHARS = 8000;
export function inventoryBlock(inventory) {
  const t = typeof inventory === "string" ? inventory.trim() : "";
  return t ? "SITE INVENTORY (what the site has now, read from its own files and stored tables)\n" + t.slice(0, MAX_INVENTORY_CHARS) : "";
}

/**
 * The one definition of the routing call.
 *
 * Extracted the way `pagesRequest` was, and for the same reason: the moment two
 * places construct this request, a test tunes something production does not run.
 */
// ── WHAT A SITE THAT EXISTS IS TOLD ABOUT QUESTIONS (2026-10-02) ───────────
//
// Two facts, each said outright rather than left to be inferred: whether a
// question may be asked for this request (wherever one can be kept, however
// many answers it already carries — 2026-10-03); and, when the message may be the
// answer to one already asked, the request that is waiting, what they already
// told us about it (`contextBlock`: its earlier answers, as details of that
// request and never a change of their own), the question and the answers
// offered. The router then says whether the message answers it (`answered`);
// nothing in code reads the customer's words to decide that.
function liveBlock({ canAsk = false, pending = null, context = [], part = null } = {}) {
  const p = pending && typeof pending === "object" ? pending : null;
  const q = p && p.question && typeof p.question === "object" ? p.question : null;
  const opts = q && Array.isArray(q.options) ? q.options.filter((o) => typeof o === "string" && o) : [];
  const waiting = p && q && typeof q.text === "string" && typeof p.request === "string"
    // WHOLE (2026-10-03): the request, the question and every answer offered
    // were each kept to the size policy when they were stored, so nothing here
    // is cut again — a router shown half a request decides for half of it.
    ? "\n\nTHEIR LAST REQUEST IS WAITING ON AN ANSWER\nThey asked: " + p.request.trim() +
      "\nThey were asked: " + q.text.trim() +
      (opts.length ? "\nThe answers they were offered: " + opts.join(" / ") : "") +
      (p.chosen === true ? "\nThey picked one of those answers: it is their message below." : "") +
      "\nTheir message below answers that question, or asks for something else instead, or is a side question or a " +
      "remark that leaves the question waiting (\"ask\", with `answered` false): say which in `answered`. " +
      "With true, decide everything for their last request with the answer taken into account — when it does not " +
      "settle what you asked, ask them a more specific question that names exactly what it left open — and copy any " +
      "part you hold back from their last request. With false, decide everything for the new message alone."
    : "";
  // WHAT THEY ALREADY TOLD US ABOUT THE WAITING REQUEST, in its own section
  // under it: the details of that request, never asked again. Only beside a
  // waiting request — a new message carries no answers of its own — or beside
  // a part of a longer request (2026-10-03), whose answers are that request's.
  const told = waiting || readPartOf(part) ? contextBlock(context) : "";
  const asking = canAsk
    ? "\n\nA QUESTION MAY BE ASKED\nBefore answering with work you may ask them one question instead (\"clarify\"), when " +
      "a detail they left out decides your answer — whether it is a change or an addition, which page or part of the " +
      "site, or what should happen — and neither their message nor the site above settles it. When the message is " +
      "clear, answer with the work." +
      (told ? " Never ask what they already answered under " + CONTEXT_HEADING + "." : "")
    : "\n\nQUESTIONS\nQuestions are closed for this message — never answer \"clarify\".";
  return waiting + (told ? "\n" + told : "") + asking;
}

export function askRequest({ message, site, canClarify = false, brief = "", qa = [], hasSite = false, model = ASK_MODEL, live = false, canAsk = false, pending = null, context = [], part = null, tablesNone = false, history = null, summary = null, answering = false, items = null, device = "", split = null, inventory = "", cacheKey = "" } = {}) {
  // A FIRST BUILD'S MESSAGE IS CUT TO ITS OWN BOUND, AS IT ALWAYS WAS; a site
  // that exists sends it whole (2026-10-03, the size policy): the route has
  // already refused one past `MAX_INPUT_CHARS`, so nothing here shortens what
  // the router decides on.
  const text = live ? String(message || "").trim() : String(message || "").trim().slice(0, MAX_MESSAGE);
  // WHICH ANSWERS ARE EVEN AVAILABLE, said outright rather than left to be
  // inferred from whether the digest happens to list any pages. The digest is a
  // description of the site; this is an instruction about the decision, and a
  // model asked to derive the second from the first will occasionally derive it
  // wrongly — on the one call where being wrong means a customer's site is
  // rebuilt over a colour change.
  const state = hasSite
    ? "\n\nWHICH CASE YOU ARE IN\nTHE SITE ALREADY EXISTS. Answer \"edit\" or \"addon\" for work — never \"build\", unless " +
      "they are explicitly asking to scrap this site and make a different one. Rebuilding replaces every page they have."
    : "\n\nWHICH CASE YOU ARE IN\nTHERE IS NO SITE YET. Answer \"build\" for work — never \"edit\" or \"addon\", because " +
      "there is nothing yet to change or to add to.";
  // EVERY ANSWER THEY GAVE IS SHOWN (2026-10-08, the parallel-tasks batch):
  // the designer can ask beyond the router's own budget, so the answers can
  // outnumber `MAX_CLARIFY`. The budget limits ASKING, never what is kept.
  const qaDone = (Array.isArray(qa) ? qa : []).filter((p) => p && p.q && p.a);
  const left = Math.max(0, MAX_CLARIFY - qaDone.length);
  // WHAT THE ROUND SO FAR WAS, so the next question is not the last one again.
  // Only present on a first build; a revise sends none of this and is told
  // plainly that questions are closed, rather than being left to infer it from
  // an absent section.
  const round = canClarify
    ? "\n\nBEFORE THE BUILD\nThis is their FIRST build — nothing exists yet, so you MAY ask one question before " +
      "building. You have " + left + " question" + (left === 1 ? "" : "s") + " left, and the build starts on its own " +
      "once they are used up — but a question is worth asking only if its answer changes what you would build. If " +
      "you already know what the business is and what people do on the site, build now.\n" +
      (qaDone.length
        ? "WHAT YOU HAVE ALREADY ASKED — do not ask any of these again, or anything close to them:\n" +
          qaDone.map((p) => "- " + String(p.q).trim() + " -> " + String(p.a).trim()).join("\n") + "\n"
        : "") +
      // A TYPED REPLY WHILE OUR QUESTION IS ON SCREEN (2026-10-14) may answer it
      // or may be a side question; only the latter is "ask", and the question
      // stays (the page keeps the round).
      (answering === true
        ? "THEIR MESSAGE IS A TYPED REPLY WHILE YOUR LAST QUESTION IS ON SCREEN (the last line above pairs that question " +
          "with this message, which may not be an answer). If it answers the question, decide " +
          "with that answer. If it is a side question or a remark instead (\"can you also take payments?\"), answer " +
          "\"ask\": the question stays on screen for their answer.\n"
        : "") +
      "THE BRIEF THEY STARTED WITH\n" + String(brief || "").trim().slice(0, MAX_MESSAGE)
    // NO WORK-INTENT ENUMERATION HERE, deliberately. This sentence read
    // `answer "build" or "ask" only` until 2026-08-14 — written when those were
    // the only intents, never updated for the escalation ladder — so every
    // message about a LIVE site carried two contradictory instructions: the
    // state block saying "edit or addon, never build" and this one pointing at
    // the ~25-credit rebuild. The state block is the ONE place legal answers
    // are named; this block owns exactly one fact, that clarify is over.
    // A SITE THAT EXISTS (2026-10-02) is told its own two facts instead
    // (`liveBlock`); everything else in this request is what it was.
    : live
      ? liveBlock({ canAsk, pending, context, part })
      : "\n\nQUESTIONS\nQuestions are closed for this message — never answer \"clarify\".";
  return {
    model,
    // ROOM TO COPY A HELD-BACK PART BACK, on a site that exists (2026-10-03):
    // `alsoAsked` is the customer's own words, copied, from this message or the
    // request waiting on an answer, so the ceiling grows by what may be copied
    // (`echoTokens`). A ceiling, not a charge. A first build's is unchanged.
    // AND ROOM TO WRITE A REQUEST OUT FROM THE CONVERSATION (`resolved`,
    // 2026-10-14) — only when a conversation is shown, the only time one may be
    // written. Every other routing call keeps exactly its ceiling.
    // AND ROOM BY WHAT IS SHOWN (2026-10-23, audit A36-3): `resolved` may
    // restate a plan from the conversation and each held part is copied from
    // it, so twice the longest shown turn is added; a flat 400 cut a go-ahead
    // on a long plan, and every resend failed the same way.
    max_tokens: (live ? ASK_MAX_TOKENS + echoTokens(text, pending && typeof pending.request === "string" ? pending.request : "") : ASK_MAX_TOKENS) + (historyBlock(history) ? RESOLVED_TOKENS + 2 * echoTokens(...shownTurns(history)) : 0),
    // A SITE THAT EXISTS IS SENT ITS OWN TOOL (2026-10-02, `LIVE_ASK_TOOL`); a
    // first build, and anything else, the tool it was always sent.
    tools: [live ? LIVE_ASK_TOOL : ASK_TOOL],
    // FORCED, like both of the other calls. Without it Haiku will happily answer
    // in prose, and the caller has no field to branch on — the whole point here
    // is a decision the code can read, not a reply a human has to interpret.
    tool_choice: { type: "tool", name: "route_message" },
    system: [{ type: "text", text: live && hasSite ? LIVE_SYSTEM : SYSTEM }],
    // A PER-SITE CACHE PIN (2026-10-25, router-b1): every routing call about
    // one site goes to one xAI server (`x-grok-conv-id`, `xaiHeaders`), so a
    // part's route reads the prefix the last one wrote. Ours; stripped before
    // Anthropic (`anthropicWire`).
    ...(live && typeof cacheKey === "string" && /^[A-Za-z0-9_-]{1,120}$/.test(cacheKey) ? { cacheKey } : {}),
    // ONE PART OF A LONGER REQUEST (2026-10-03): the message it came from and
    // what the parts before it did, after its own words — a site's only, and
    // only when the route was handed one (`partBlock`).
    // THE CONVERSATION SO FAR (2026-10-14), its small window only — enough to
    // tell "do that" from a question and to write `resolved` — before their
    // message. Absent when the page sent none.
    messages: [{ role: "user", content: "THEIR SITE\n" + siteDigest(site, { tablesNone }) + (live && hasSite && inventoryBlock(inventory) ? "\n\n" + inventoryBlock(inventory) : "") + state + round + (summaryBlock(summary) ? "\n\n" + summaryBlock(summary) : "") + (historyBlock(history) ? "\n\n" + historyBlock(history) : "") + (live && hasSite && deviceHintLine(device) ? "\n\n" + deviceHintLine(device) : "") + "\n\nTHEIR MESSAGE\n" + text + (live && itemsBlock(items) ? "\n\n" + itemsBlock(items) : "") + (live && partBlock(part) ? "\n\n" + partBlock(part) : "") + (live && splitBlock(split) ? "\n\n" + splitBlock(split) : "") }],
  };
}

/** Where a routing answer came from; `routeDecision` derives it from the codes. */
export const ROUTE_SOURCES = Object.freeze(["model", "fallback", "rule"]);

/** Records into a caller's trace; a no-op without one, so a reader's result never depends on it. */
function noteTo(trace) {
  return trace && Array.isArray(trace.reasons) ? (code) => { trace.reasons.push(code); } : () => {};
}

/** A field the model filled in: not absent, not null, not blank, not `false`. */
function given(v) {
  if (v === undefined || v === null || v === false) return false;
  return !(typeof v === "string" && !v.trim());
}

/**
 * THE REQUEST WRITTEN OUT FROM THE CONVERSATION (2026-10-14): `{ resolved }`
 * when the model gave one on a work answer, a conversation was shown, and it
 * is text no longer than a message may be; otherwise nothing, each case
 * named. Never coerced: a non-string is unread, not its spelling.
 */
function readResolved(input, history, mark) {
  if (!given(input.resolved)) return {};
  if (history !== true) { mark("resolved-ignored"); return {}; }
  if (typeof input.resolved !== "string" || input.resolved.trim().length > MAX_INPUT_CHARS) { mark("resolved-unread"); return {}; }
  mark("resolved");
  return { resolved: input.resolved.trim() };
}

/** The edit's own fields, which an answer that is not an edit carries none of. */
const EDIT_FIELDS = ["layer", "page", "remove", "rename", "tab", "devices"];

/**
 * The parts of the model's answer that the kept answer does not carry, each
 * named. `keeps` is what this answer carries: "answer", "question", "also",
 * "edit". Only for an answer the model's own intent decided: a fallback
 * replaces the whole answer, and its own code says so.
 */
function markLeftOut(input, keeps, mark) {
  if (!keeps.includes("answer") && String(input.answer || "").trim()) mark("answer-ignored");
  if (!keeps.includes("resolved") && given(input.resolved)) mark("resolved-ignored");
  if (!keeps.includes("unclear") && given(input.unclear)) mark("unclear-ignored");
  if (!keeps.includes("question") && given(input.question)) mark("question-ignored");
  if (!keeps.includes("also") && given(input.alsoAsked)) mark("also-ignored");
  if (!keeps.includes("edit") && EDIT_FIELDS.some((k) => given(input[k]))) mark("edit-fields-ignored");
}

/**
 * Whether `readQuestion` shortened the question or changed its options,
 * compared on the spelling it reads. Called only after `readQuestion` has
 * read the same values, so the text's `String` cannot throw here when it did
 * not there; an option is compared only as the string `readQuestion` keeps,
 * and anything else counts as changed.
 */
function markQuestion(raw, q, mark) {
  const flat = (v) => String(v == null ? "" : v).trim().replace(/\s+/g, " ");
  if (q.text !== flat(raw && raw.text)) mark("question-clipped");
  const options = raw && Array.isArray(raw.options) ? raw.options : [];
  const same = (o, i) => typeof options[i] === "string" && o === flat(options[i]);
  if (options.length !== q.options.length || !q.options.every(same)) mark("options-changed");
}

/**
 * WHEN THE ROUTER CANNOT DECIDE, BUILD.
 *
 * Every unclear case resolves to "build", and it is a deliberate asymmetry
 * rather than laziness. Getting it wrong that way costs a build the customer
 * did not quite ask for, which they can see and undo by saying so; getting it
 * wrong the other way answers "add a booking form" with a chatty paragraph and
 * silently does not build the thing they asked for — a failure they cannot
 * distinguish from the builder being broken.
 *
 * So: an unreadable response, an unknown intent, a model error, a missing tool
 * call — all of them are `build`. The router is an optimisation on top of a
 * pipeline that already works, and it must never be the reason a build does not
 * happen.
 */
// ── A SITE THAT EXISTS: A QUESTION BACK, AND WHETHER A MESSAGE ANSWERS ONE (2026-10-02) ──
//
// Owner: *"Let the router ask a targeted question … instead of converting
// clarification into add-on work"*. Until this, `clarify` on a site that
// exists was closed (`canClarify` is a first build's), so a model that needed
// to ask was overruled into `FALLBACK_WITH_SITE` — a paid add-on it had not
// chosen. Now, on a site that exists (`live`):
//
//   * a readable question is the answer wherever a question can be kept
//     (`canAsk`); where none can, it fails the call (`clarify-unkeepable`) —
//     never shown with nothing waiting for an answer, never turned into work;
//   * a question that cannot be shown is a failure of the answer (`unusable`),
//     which the route answers as the routing call failing — never as work;
//   * when a question is waiting (`pending`), the model says whether the
//     message answers it (`answered`), or a clicked answer says so (`chosen`);
//     a reply that does not say is the same failure of the answer.
//
// EVERYTHING ELSE IS `readDecision`, unchanged, and a first build never comes
// through here at all: `live` is false for it, so it is read exactly as before.
export function readRouting(reply, opts = {}) {
  const o = opts && typeof opts === "object" ? opts : {};
  if (o.live !== true) return readDecision(reply, o);
  const blocks = reply && Array.isArray(reply.content) ? reply.content : [];
  const use = blocks.find((b) => b && b.type === "tool_use");
  // HELD BACK BY ITEM NUMBER (2026-10-23) is read as the customer's own text
  // before anything else reads the answer, so every reader sees `alsoAsked`.
  const input = itemsToWords((use && use.input) || {}, o.items, o.trace) || {};
  // AND THE ANSWER EVERY LATER READER IS HANDED CARRIES THE SAME INPUT.
  if (use && input !== use.input) reply = { ...reply, content: blocks.map((b) => (b === use ? { ...b, input } : b)) };
  const mark = noteTo(o.trace);
  const fallback = FALLBACK_WITH_SITE;
  let answered;
  if (o.pending === true) {
    answered = o.chosen === true ? true : input.answered;
    if (typeof answered !== "boolean") {
      if (o.trace) o.trace.input = input;
      if (!use) mark("no-tool-call");
      mark("answered-unread");
      return { intent: fallback, answer: "", unusable: true };
    }
  } else if (input.answered !== undefined) mark("answered-ignored");
  const withAnswered = (out) => (answered === undefined ? out : { ...out, answered });
  if (input.intent === "clarify") {
    if (o.trace) o.trace.input = input;
    // A QUESTION THAT CANNOT BE SHOWN WHOLE IS NO QUESTION (2026-10-03):
    // `readAsk` never shortens one, so the call fails as for an unreadable
    // one — nothing run or billed, a waiting request left waiting.
    const q = usableAsk(input.question);
    if (!q) {
      mark("clarify-unreadable");
      return { intent: fallback, answer: "", unusable: true };
    }
    markQuestion(input.question, q, mark);
    markLeftOut(input, ["question"], mark);
    if (o.canAsk !== true) {
      mark("clarify-unkeepable");
      return { intent: fallback, answer: "", unusable: true };
    }
    return withAnswered({ intent: "clarify", answer: "", question: q });
  }
  const decided = readDecision(reply, { ...o, canClarify: false });
  // ── "START OVER" ASKS FIRST (owner, 2026-10-24) ──────────────────────────
  // A full new description of a site (`startOver` absent) is still the
  // rewrite, as before. "Start over" / "redesign everything" is the rewrite
  // only after the router's own question — "this replaces your whole site,
  // OK?" — was answered yes (`confirming`, the waiting question is that one).
  // Until then the answer is that question, kept like any other; one that
  // cannot be shown or kept fails the call. Never the rewrite on a guess.
  if (decided.intent === "build" && input.startOver === true) {
    if (o.confirming === true && answered === true) {
      mark("startover-confirmed");
      return withAnswered({ ...decided, startOver: true, confirmed: true });
    }
    const q = usableAsk(input.question);
    if (!q) { mark("startover-unasked"); return { intent: fallback, answer: "", unusable: true }; }
    if (o.canAsk !== true) { mark("clarify-unkeepable"); return { intent: fallback, answer: "", unusable: true }; }
    mark("startover-asked");
    return withAnswered({ intent: "clarify", answer: "", question: q, confirm: "rewrite" });
  }
  return withAnswered(decided);
}


function readDecision(reply, { canClarify = false, picked = false, hasSite = false, pages = [], pagesComplete = true, trace = null, history = false } = {}) {
  const blocks = reply && Array.isArray(reply.content) ? reply.content : [];
  const use = blocks.find((b) => b && b.type === "tool_use");
  const input = (use && use.input) || {};
  const answer = String(input.answer || "").trim();
  // THE DECISION REPORT (`ROUTE_REASONS`): every branch below names itself into
  // the caller's trace, when there is one, and returns exactly what it did.
  const mark = noteTo(trace);
  if (trace) trace.input = input;
  if (!use) mark("no-tool-call");
  // The bottom of the ladder for this state. See FALLBACK_WITH_SITE: unclear
  // still resolves to WORK and never to a paragraph — what the site's existence
  // changes is which work, because on an existing site "build" is a ~25-credit
  // rewrite of every page rather than the harmless default it is on an empty one.
  const fallback = hasSite ? FALLBACK_WITH_SITE : FALLBACK_NO_SITE;
  const work = (intent) => ({ intent, answer: "" });

  // CLARIFY IS GATED BY THE CALLER, NOT BY THE MODEL. `canClarify` is false on
  // every revise and the moment the question budget is spent, and a model that
  // answers "clarify" anyway is overruled into WORK — falling through to the
  // ladder below and out to `fallback`. The alternative — trusting the enum to
  // be honoured — is how a revise ends up being interviewed about its own
  // colour scheme.
  //
  // "Overruled into a BUILD" is what this said, and that stopped being true when
  // the ladder landed: `FALLBACK_WITH_SITE` is `addon`, so on an existing site —
  // which is every revise, i.e. exactly where the gate is closed — the answer is
  // an addon and not a build. Right either way (both are work, never a
  // paragraph), and the sentence named the one it is not.
  if (input.intent === "clarify" && canClarify) {
    const q = readQuestion(input.question);
    // A CLARIFY WITH NO USABLE QUESTION IS A BUILD, for exactly the reason an
    // answerless "ask" is: honouring it shows the customer an empty prompt and
    // builds nothing, which is indistinguishable from the builder being broken.
    if (q) {
      markQuestion(input.question, q, mark);
      markLeftOut(input, ["question"], mark);
      return { intent: "clarify", answer: "", question: q };
    }
    mark("clarify-unreadable");
    return work(fallback);
  }

  // THE TWO NEW RUNGS, AND BOTH ARE GATED ON THE SITE EXISTING. An "edit" with
  // nothing to edit is not a cheaper build, it is a lane with no input — so on an
  // empty project both fall through to the bottom of this function and build,
  // which is what every caller did before these existed.
  //
  // AND THE SECOND THING THEY ASKED FOR, ON THE TWO WORK RUNGS ONLY. `layer` is
  // one value and always has been, so a message naming two different parts of
  // the site has half of it dropped — and the customer is then told the half
  // that ran worked, which reads as the builder ignoring them rather than as one
  // change per turn. This does not change what gets DONE: it is a note, so the
  // worst case is a sentence about something they did not ask for.
  //
  // NOT ON `build`, which rewrites everything and folds a second ask in by
  // construction, and not on `ask` or `clarify`, where no work happened for a
  // leftover to sit beside.
  // READ ON THE TWO WORK RUNGS ONLY, where it is kept: on any other answer a
  // held-back part is left out, and the report says so (`also-ignored`).
  // WHAT A MESSAGE LEANING ON THE CONVERSATION ASKS FOR (2026-10-14,
  // `resolved`): read on the three work answers only, where it is run in
  // place of their words — and only when a conversation was shown.
  const res = () => readResolved(input, history, mark);
  // A PHONE APP OF THE SITE (2026-10-20): no step of the site runs; the page
  // asks the app builder. Only for a site that exists; the platform is read
  // from the model's fixed list, Android when it named none.
  // A SECURITY SCAN OF THE SITE (2026-10-21): no step of the site runs; the
  // page starts the scan. Only for a site that exists.
  if (hasSite && input.intent === "security") {
    markLeftOut(input, [], mark);
    return { intent: "security", answer: "" };
  }
  if (APPS_OPEN && hasSite && input.intent === "app") {
    markLeftOut(input, [], mark);
    return { intent: "app", platform: input.platform === "ios" ? "ios" : "android", answer: "" };
  }
  if (hasSite && input.intent === "addon") {
    const m3 = given(input.model3d) ? readModel3d(input.model3d, { pages }) : null;
    if (given(input.model3d) && !m3) mark("model3d-unread");
    // WHICH SCREEN SIZES AN ADDITION IS FOR (2026-10-24, device-scope-build),
    // read as an edit's are; the add-on writer is told.
    const devices = readDevices(input.devices, mark);
    const out = { ...work("addon"), ...(devices ? { devices } : {}), ...readAlso(input, trace), ...res(), ...(m3 ? { model3d: m3 } : {}) };
    markLeftOut({ ...input, devices: undefined }, ["also", "resolved"], mark);
    return out;
  }
  if (hasSite && input.intent === "edit") {
    const { converted, ...edit } = readEdit(input, pages, trace, pagesComplete);
    // ── A CONVERTED EDIT IS A HAND-OVER, AND SAYS WHY (2026-10-02, W5) ───────
    //
    // The held-back part belongs to the decision it was made with. An edit of a
    // page the site lacks is still that decision — the change, made as an
    // addition on that page — so the part stays held back, and the add-on step
    // is told the page and why it has the change. An answer the model did not
    // decide (no step, an unknown one, a page edit naming no page) is not, and
    // its held-back part goes with it: the step it falls to gets the whole
    // message, told why, rather than the half the model meant for another step.
    if (converted) {
      const keeps = converted.reason === "page-unknown";
      if (!keeps && given(input.alsoAsked)) mark("also-dropped");
      const out = { ...edit, ...(keeps ? readAlso(input, trace) : {}), handOver: { from: "route", ...converted }, ...res() };
      markLeftOut(input, ["also", "edit", "resolved"], mark);
      return out;
    }
    // THE DEVICES A CHANGE IS FOR (2026-10-24): a proper subset or nothing
    // (all three, the default); a scope that cannot be read never narrows.
    const devices = readDevices(input.devices, mark);
    const out = { ...edit, ...(devices ? { devices } : {}), ...readAlso(input, trace), ...res() };
    markLeftOut(input, ["also", "edit", "resolved"], mark);
    return out;
  }
  // "build" IS STILL HONOURED ON AN EXISTING SITE, deliberately and narrowly:
  // it is the only way to say "scrap this and make me a different site", which is
  // a thing people really do ask for. The tool description is what keeps it rare.
  if (input.intent === "build") {
    markLeftOut(input, ["resolved"], mark);
    // THEIR CURRENT SITE'S ADDRESS, carried as text only; the route checks it
    // against the message (`readImportSite`) before anything is fetched.
    const imp = typeof input.importSite === "string" && input.importSite.trim() ? { importSite: input.importSite.trim().slice(0, 2000) } : {};
    return { ...work("build"), ...res(), ...imp };
  }

  const intent = input.intent === "ask" ? "ask" : fallback;
  // WHY THE MODEL'S OWN INTENT WAS NOT USED, when it was not: a question back
  // where none may be asked, work with no site to do it on, or an intent that
  // is not one of the five (a reply with no answer at all was named above).
  if (intent !== "ask") {
    if (input.intent === "clarify") mark("clarify-closed");
    else if (input.intent === "edit" || input.intent === "addon") mark("work-without-site");
    else if (use) mark("intent-unknown");
  }
  // AN "ask" WITH NOTHING TO SAY IS A BUILD. The model chose the cheap branch and
  // then wrote no reply, so honouring it would show the customer an empty message
  // and do nothing — the one outcome worse than an unnecessary build.
  if (intent === "ask" && !answer) {
    mark("ask-empty");
    return work(fallback);
  }
  // A PRESSED ANSWER IS NEVER A QUESTION (2026-08-09, and narrowed 2026-10-14).
  //
  // Measured live 2026-08-09: brief "Book classes", two questions answered, and
  // the third press of a button came back *"I'm not sure what you'd like me to
  // build. Tell me about your business."* — to somebody who had just told us,
  // three times, using buttons we wrote. So an answer they PICKED from our own
  // options (`picked`) is never "ask": the only honest outcomes are another
  // question or the work.
  //
  // A TYPED REPLY AND A FILE ARE NO LONGER GATES (the owner, 2026-10-14:
  // *"Planning, attachment discussion and side questions during pending
  // clarification must remain conversation; don't turn them into work merely
  // because attached or answering is true."*). They were: "wait, can you take
  // payments?" typed under a question built a site, and "what do you think of
  // this logo?" with the logo attached ran an edit. Now the router decides,
  // told that a typed reply may be a side question, and a side question
  // leaves the question waiting.
  if (intent === "ask" && picked) {
    mark("ask-while-answering");
    return work(fallback);
  }
  if (intent === "ask") markLeftOut(input, ["answer", "unclear"], mark);
  return { intent, answer: intent === "ask" ? answer : "", ...(intent === "ask" ? readUnclear(input, mark) : {}) };
}

/** What could not be pinned down, for the reply's focused question: text, at most 300 characters, or nothing. */
export const MAX_UNCLEAR_CHARS = 300;
function readUnclear(input, mark) {
  if (!given(input.unclear)) return {};
  if (typeof input.unclear !== "string" || !input.unclear.trim() || input.unclear.trim().length > MAX_UNCLEAR_CHARS) { mark("unclear-unread"); return {}; }
  mark("unclear");
  return { unclear: input.unclear.trim() };
}

/**
 * An edit, or the rung above it.
 *
 * EVERY FAILURE HERE GOES UP, never sideways and never to a refusal. A missing
 * layer, a layer nobody recognises, a page-shaped edit that names no page: each
 * of them means the router did not actually decide, and the cost of guessing
 * "edit" anyway is a lane that finds nothing to change and reports success
 * having done nothing — which is the failure this whole file is written to
 * avoid, one rung down.
 *
 * THE PAGE CHECK IS THE USEFUL ONE, and it falls out of the ladder for free:
 * "change the gallery page" on a site with no gallery is not a broken edit, it
 * is an ADDON, correctly identified without anyone having to ask a model twice.
 *
 * NOT KNOWING BUYS NOTHING, though. With no page list to check against — an
 * older caller, a site whose digest carried none — the edit passes through with
 * the path as given, and the apply step escalates later with a real reason. The
 * alternative is inventing a refusal out of evidence we do not have, and sending
 * every page edit on those sites to a lane that would try to add a duplicate.
 */
/**
 * The second thing they asked for, which this turn is not doing.
 *
 * HELD BACK, NOT ONLY SAID (2026-09-29). It was a note nothing branched on, and
 * run 52 showed what that costs: the edit route ran the whole message anyway,
 * so the part named here was both attempted (on the wrong page) and promised
 * for next time. The browser now posts it with the message and the edit and
 * add-on routes take it out before anything runs (`heldBack`), and the reply's
 * last sentence is composed from what the route really held back. A model
 * that over-reports holds back work they asked for; one that under-reports
 * leaves the work in the turn. The schema description tells it to stay silent
 * when unsure, and this reader stays strict rather than generous.
 *
 * A NON-STRING IS REFUSED RATHER THAN COERCED: `String(["a","b"])` is "a,b",
 * which would be shown to the customer as their own words. The same coercion bug
 * this repo has recorded on `normalizeRole` and on a table's `access`.
 *
 * ABSENT MEANS ABSENT — an empty object, so a response that has no leftover is
 * byte-identical to what it was before this existed.
 */
export function readAlso(input, trace = null) {
  const parts = readAlsoParts(input, trace);
  const n = parts.alsoAsked === undefined ? 0 : (Array.isArray(parts.alsoAsked) ? parts.alsoAsked.length : 1);
  const tg = readChangeTargets(input, n, trace);
  return tg.length ? { ...parts, targets: tg } : parts;
}

/**
 * WHAT EACH CHANGE TOUCHES (`TARGETS`), read through the one checker
 * (`readTargets`): `[{ change, writes, reads }]` for changes numbered 0 to
 * `held`, only what reads. A change outside the numbers is dropped and said
 * (`targets-out`); nothing is coerced. `[]` when none was named.
 */
export function readChangeTargets(input, held, trace = null) {
  const mark = noteTo(trace);
  const v = input ? input.targets : undefined;
  if (!given(v)) return [];
  if (!Array.isArray(v)) { mark("targets-unread"); return []; }
  const top = Number.isInteger(held) && held > 0 ? held : 0;
  const by = readTargets(v);
  const out = [];
  for (const [k, t] of Object.entries(by)) {
    const change = Number(k);
    if (change > top) { mark("targets-out"); continue; }
    if (t.writes.length || t.reads.length) out.push({ change, writes: t.writes, reads: t.reads });
  }
  out.sort((a, b) => a.change - b.change);
  if (out.length) mark("targets-named");
  return out;
}

function readAlsoParts(input, trace = null) {
  const mark = noteTo(trace);
  const v = input ? input.alsoAsked : undefined;
  // A STRING IS ONE PART (the shape every answer had until 2026-10-03, and
  // still a fair answer from a model); A LIST IS SEVERAL. Anything else — a
  // number, an object — is refused, never coerced.
  if (given(v) && typeof v !== "string" && !Array.isArray(v)) { mark("also-not-text"); return {}; }
  const raw = typeof v === "string" ? [v] : Array.isArray(v) ? v : [];
  const out = [];
  for (const p of raw) {
    // A NON-STRING ENTRY IS REFUSED RATHER THAN COERCED: `String(["a","b"])` is
    // "a,b", which would be shown to the customer as their own words — and one
    // unreadable entry makes the list unreadable, so nothing is held back on a
    // guess about which entries were meant.
    if (typeof p !== "string") { mark("also-not-text"); return {}; }
    const t = p.trim();
    if (!t) continue;
    // ⚠ NEVER CUT (2026-09-29). A copy cut between two words is still found in
    // the message — so only its start would be held back, and the rest of the
    // part promised for later would run this turn. A site's message is at most
    // `MAX_INPUT_CHARS` characters (the size policy, 2026-10-03), so a longer
    // copy is not a copy of anything they said: the list is dropped, not cut,
    // and nothing is held back.
    if (t.length > MAX_INPUT_CHARS) { mark("also-too-long"); return {}; }
    if (!out.includes(t)) out.push(t);
  }
  if (!out.length) return {};
  if (out.length > 1) mark("also-several");
  const deps = readDepends(input, out.length, trace);
  return { alsoAsked: out.length === 1 ? out[0] : out, ...(deps.length ? { dependsOn: deps } : {}) };
}

/**
 * WHICH CHANGE NEEDS WHICH (2026-10-03, `DEPENDS_ON`): `[{ change, after }]`
 * over the changes numbered 0 (the one the answer makes) to `held` (the last
 * part held back), each `after` a list of other changes' numbers, an entry for
 * one change merged with another for the same change. `[]` when the model said
 * none — and when what it said cannot be read whole: a number outside the
 * changes, a change that needs itself, a value of another type. A relation is
 * never half-read, and never coerced (`Number("1")` is 1); an unreadable set
 * leaves the parts with no stated order, said in the trace (`depends-unread`),
 * so `builder/request.mjs` runs them as independent parts — each step's own
 * checks refuse work whose prerequisite is missing — and never on a guess.
 */
export function readDepends(input, held, trace = null) {
  const mark = noteTo(trace);
  const v = input ? input.dependsOn : undefined;
  if (!given(v)) return [];
  const top = Number.isInteger(held) && held > 0 ? held : 0;
  const ok = (n) => Number.isInteger(n) && n >= 0 && n <= top;
  if (!Array.isArray(v)) { mark("depends-unread"); return []; }
  const by = new Map();
  for (const e of v) {
    if (!e || typeof e !== "object" || Array.isArray(e) || !ok(e.change) || !Array.isArray(e.after)) { mark("depends-unread"); return []; }
    for (const a of e.after) {
      if (!ok(a) || a === e.change) { mark("depends-unread"); return []; }
    }
    const list = by.get(e.change) || [];
    for (const a of e.after) if (!list.includes(a)) list.push(a);
    by.set(e.change, list);
  }
  const out = [...by.entries()].filter(([, after]) => after.length).map(([change, after]) => ({ change, after: after.slice().sort((x, y) => x - y) }));
  out.sort((x, y) => x.change - y.change);
  if (out.length) mark("depends-named");
  return out;
}

/**
 * One more sentence, not a second brief: the most of the held-back words the
 * reply's last sentence shows (`alsoTail` in public/chat.js). A display bound
 * only — what is held back is never cut.
 */
export const MAX_ALSO_CHARS = 200;

/**
 * A MESSAGE WITH THE PART THE ROUTER HELD BACK TAKEN OUT (2026-09-29).
 *
 *   { ok: true,  run, held }  — `run` is what this turn does; `held` is the part
 *                               taken out, in the customer's own spelling, or
 *                               `""` when nothing was held back.
 *   { ok: false, run, held: "" } — the part could not be found in the message,
 *                               or it was the whole message. The caller must not
 *                               guess: running the message whole would also run
 *                               the part that was promised for later.
 *
 * EVERY OCCURRENCE GOES, so a clause said twice cannot survive once and run.
 * `later` that is not a non-empty string means nothing was held back — the
 * ordinary case, and `run` is then the message itself, untouched.
 */
export function heldBack(message, later) {
  const text = typeof message === "string" ? message : "";
  if (typeof later !== "string" || !later.trim()) return { ok: true, run: text, held: "" };
  const r = heldParts(text, later);
  return { ok: r.ok, run: r.run, held: r.ok ? r.held[0] : "" };
}

/**
 * ONE CHANGE'S OWN WORDS, LESS EVERY PART PUT OFF (2026-10-02, the owner's
 * review of batch 2: *"ensure newly deferred instructions are excluded from
 * every executing step's model input, including overlapping scope words"*).
 *
 * `words` is one change's text as it stands in `message` — a picker's scope for
 * it, which `readScopes` has already found there — and `later` the parts put
 * off this turn (one string or a list, as `heldParts` reads them), each also
 * found in `message`. Every stretch of the change's
 * text that lies inside a part put off is taken out: a part wholly inside its
 * words, and a part that only overlaps their edge ("…and add a page" running
 * into "add a page for our cake orders"). Positions are the message's own, so
 * the words a change shares with a part put off are the part's, wherever in the
 * message each was copied from.
 *
 *   — the change's own text, untouched, when no part put off reaches it;
 *   — what is left of it, when one does;
 *   — `""` when no word of its own is left (the change WAS the part put off),
 *     and when `words` is not in the message at all.
 *
 * WHAT A CHANGE IS, AND WHICH WORDS ASK FOR IT, IS THE PICKER'S DECISION. This
 * only takes out, by position, words a model already said belong to a part put
 * off. A non-string is nothing, never coerced.
 */
export function wordsLess(message, words, later) {
  const text = typeof message === "string" ? message : "";
  const own = wordSpans(text, words)[0];
  if (!own) return "";
  const parts = (Array.isArray(later) ? later : typeof later === "string" ? [later] : []).filter((p) => typeof p === "string" && p.trim());
  const cuts = parts.flatMap((p) => wordSpans(text, p))
    .filter(([s, e]) => s < own[1] && e > own[0])
    .map(([s, e]) => [Math.max(s, own[0]), Math.min(e, own[1])])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (!cuts.length) return text.slice(own[0], own[1]);
  let out = "";
  let at = own[0];
  for (const [s, e] of cuts) {
    if (e <= at) continue;
    out += text.slice(at, Math.max(s, at));
    at = e;
  }
  out = (out + text.slice(at, own[1])).replace(/[ \t]{2,}/g, " ").trim();
  return WORD_CHAR.test(out) ? out : "";
}

// ── A CONVERTED ANSWER SAYS WHY (2026-10-02, the whole-router audit's W5) ───
//
// Every way out of `readEdit` that does not use the model's edit answer carries
// `converted`: `{ reason, page? }`, where `reason` is one of the hand-over's own
// codes (`builder/hand-over.mjs`). `readRouting` turns it into the hand-over the
// add-on step receives and decides what becomes of the held-back part — it is
// taken off before anything is returned, so no caller ever sees the field.
//
//   page-unknown      a page edit naming a page the site was not said to have:
//                     an addition, made by the add-on step, on that page
//   route-unreadable  an edit naming no step, or one that is not among them, or
//                     a page edit naming no page: the model did not decide
const unreadEdit = () => ({ intent: FALLBACK_WITH_SITE, answer: "", converted: { reason: "route-unreadable" } });

export function readEdit(input, pages, trace = null, pagesComplete = true) {
  const mark = noteTo(trace);
  const layer = EDIT_LAYERS.includes(input && input.layer) ? input.layer : null;
  if (!layer) {
    mark(input && given(input.layer) ? "layer-unknown" : "layer-missing");
    return unreadEdit();
  }
  // `remove` IS READ FOR EVERY LAYER THAT HAS ONE, above the page branch.
  //
  // It used to be read only inside the page branch, below the early return —
  // so when the logo layer landed and its tool description asked for the SAME
  // field ("true when they want the logo TAKEN OFF"), the flag was stripped
  // here before the route ever saw it. Everything downstream was correct and
  // starved: the route's gate, the client's `d.remove === true`, the worker's
  // logo branch, `runLogoEdit`'s removal path. "Drop the logo, just the name is
  // fine" fell through to the attach path with no image and answered
  // "Attach the logo with the 📎 button" — the exact inversion the flag exists
  // to prevent, and not escalated, so there was no working removal at all.
  //
  // `=== true` and nothing merely truthy, for the reason the page branch below
  // states at length: this is the one verb where guessing wrong takes something
  // away rather than adding something visible and undoable.
  const remove = input && input.remove === true;
  const removal = remove ? { remove: true } : {};
  // THE TWO FLAGS' OWN REPORTS: a value that is not exactly `true` is left out
  // wherever it is, and a `true` on a step that does not take it is left out
  // too. Recorded, never acted on: what is returned below is unchanged.
  if (given(input.remove) && input.remove !== true) mark("remove-not-true");
  else if (remove && !REMOVABLE_LAYERS.includes(layer)) mark("remove-ignored");
  if (given(input.tab) && layer !== "logo") mark("tab-ignored");
  else if (given(input.tab) && input.tab !== true) mark("tab-not-true");
  // WHICH SLOT THE ARTWORK GOES IN, read only for the layer that has two.
  // Scoped the way `remove` is, and for the same reason: a flag carried by a
  // layer that cannot act on it is one nothing reads, which is how this repo's
  // dead features start. Combines with `remove` — "take the favicon off" is
  // both, and the pair is what makes that removal hit the right slot.
  const tab = layer === "logo" && input && input.tab === true ? { tab: true } : {};
  // ── A LOOK CHANGE CARRIES THE PAGE IT NAMED (2026-09-23) ──────────────────
  //
  // THIS RETURNED BEFORE THE PAGE WAS READ, for every layer but `page` — and
  // `look` is the door whose lanes dispatch a section, a band or a scene to the
  // page rung. So "move the market times up on the gallery page" arrived with
  // no page, and the edit route's fallback made it on the home page: the
  // routing reply, the browser and the dispatcher all forward a page, and this
  // was the one hop that dropped it.
  //
  // ABSENT STAYS ABSENT — no key at all — so a change to the whole site is
  // byte-identical to what it was. The spelling is `normalizePagePath`'s, the
  // same one the page layer resolves with.
  //
  // A PAGE THE SITE DOES NOT HAVE IS KEPT, NOT TURNED INTO AN ADD-ON as the page
  // layer's is below. A colour or a section aimed at a missing page is not an
  // addition — "take the 3D thing off the menu page" must not design a menu
  // page — so the edit route answers it with the site's real pages, at no cost
  // for the edit, before any lane runs. A layer with no use for a page (every
  // other one) still carries none, which is the scoping `remove` and `tab`
  // already have for the same reason: a field nothing can act on is one
  // nothing reads.
  if (layer === "look") {
    const named = normalizePagePath(input && input.page);
    if (given(input.page) && !named) mark("page-unreadable");
    else if (named && named !== input.page) mark("page-normalized");
    if (given(input.rename)) mark("rename-ignored");
    return { intent: "edit", answer: "", layer, ...(named ? { page: named } : {}) };
  }
  if (layer !== "page") {
    if (given(input.page)) mark("page-ignored");
    if (given(input.rename)) mark("rename-ignored");
    return { intent: "edit", answer: "", layer, ...tab, ...(REMOVABLE_LAYERS.includes(layer) ? removal : {}) };
  }
  const want = normalizePagePath(input.page);
  if (!want) {
    mark("page-missing");
    return unreadEdit();
  }
  const known = (Array.isArray(pages) ? pages : []).map(normalizePagePath).filter(Boolean);
  // WHERE THE PAGE IS MOVING TO, read here because it decides the branch below;
  // its own reasons are marked further down, where they always were.
  const rawMove = !remove && typeof input.rename === "string" ? input.rename.trim() : "";
  const movePath = rawMove.startsWith("/") ? normalizePagePath(rawMove) : null;
  // ⚠ A REMOVAL OR A MOVE OF A PAGE THE SITE DOES NOT HAVE IS NOT AN ADDITION
  // (2026-10-02, the whole-router audit's W5). It was turned into one with
  // everything else that named an unknown page, and the part the router held
  // back stayed held back — so "take the Events page off and add a page for
  // our cake orders", on a site with no Events page, sent the add-on step "take
  // the Events page off the site and ." and put the cake page off: the half it
  // could not do run, the half it could held back. The model's own fields say
  // what the change is: taking a page away or moving it, which no addition
  // makes. So the answer stays an edit, and the page step answers it with the
  // site's real pages at no cost for the edit (`page/no-page`), the held-back
  // part named beside it. An edit of a page the site lacks is still an
  // addition, on that page.
  // ⚠ AND ONLY AGAINST THE SITE'S WHOLE LIST (2026-10-03). A page missing from
  // a list that may be partial — the browser's own, when the route could not
  // read the site's (`pagesComplete` false) — is not a page the site lacks: the
  // browser kept six pages across a reload, so an edit of the seventh became an
  // addition. It stays an edit, and the edit step checks it against the site's
  // real pages (`page/no-page` at no cost for the edit when it truly is not
  // there).
  if (known.length && !known.includes(want) && !remove && !(movePath && movePath !== want)) {
    if (pagesComplete === false) {
      mark("page-unverified");
    } else {
      mark("page-unknown");
      return { intent: FALLBACK_WITH_SITE, answer: "", converted: { reason: "page-unknown", page: want } };
    }
  }
  if (!known.length) mark("page-unchecked");
  if (want !== input.page) mark("page-normalized");
  // ── TAKING THE PAGE AWAY, DECIDED HERE AND NOWHERE ELSE ───────────────────
  //
  // MEASURED THREE TIMES: asked to delete a page, the page model rewrites the
  // site and never sets the field that deletes one. The words were made
  // unmissable, the schema constraint that forbade the honest answer was removed,
  // and it still did not happen. So this stops being something a model
  // volunteers and becomes something the ROUTER decides — which it is already
  // equipped for, because it has just resolved the page against the site's real
  // list. A deletion then needs NO page generation at all: ~0.3 credits and a
  // recompile, against the ~28 a rewrite costs.
  //
  // THE BIAS IS INVERTED HERE, AND DELIBERATELY. Everywhere else in this file an
  // unclear answer resolves to WORK, because a wrong refusal is worse than a
  // wrong action. Removal is the one verb where that is false: a wrong "edit"
  // costs a page the customer can see and undo, and a wrong "remove" takes their
  // page away. So it is `=== true` and nothing merely truthy, it only applies to
  // a page that really exists, and everything else is an ordinary page edit.
  //
  // It is safe to be this direct because the merge still refuses the dangerous
  // cases — never the home page, never one another page still links to — and a
  // publish is archived, so a page deleted by mistake is one restore away.
  // ── MOVING THE PAGE, WHICH IS THE OTHER THING ONLY THIS LAYER CAN DO ──────
  //
  // A NEW ADDRESS AND A REMOVAL ARE MUTUALLY EXCLUSIVE, and the removal wins.
  // A model answering both has contradicted itself, and of the two readings
  // "delete it" is the one they plainly asked for if they asked for it at all;
  // moving a page that is on its way out is work nobody wanted.
  //
  // NOT VALIDATED HERE BEYOND ITS SHAPE. `renameRoute` owns every refusal that
  // matters — the home page has no address to move, the target must not already
  // exist, the source must — and it owns them because it is the thing that can
  // SEE the pages. A second opinion here would be a second place for the rules
  // to drift, and this repo has that failure written down several times over.
  // What this does is refuse anything that is not a path at all, so a heading
  // ("Services") cannot reach the renamer as an address.
  //
  // THE LEADING SLASH IS REQUIRED HERE AND NOT ABOVE, and the asymmetry is the
  // whole guard. `normalizePagePath` ADDS one — right for `page`, where a model
  // naming which page it means may reasonably answer `book` or `/book`, and
  // wrong for this field, where the slash is the only thing separating "move it
  // to /services" from "call it Services". Without this, a heading normalises
  // into an address and the page silently moves; caught by its own test rather
  // than reasoned about, because the lenient helper looked safe to reuse.
  const raw = rawMove;
  const rename = movePath;
  const moving = rename && rename !== want ? { rename } : {};
  if (given(input.rename)) {
    if (remove) mark("rename-with-remove");
    else if (!rename) mark("rename-not-path");
    else if (rename === want) mark("rename-same-page");
    else if (rename !== raw) mark("rename-normalized");
  }
  // `remove` is read once, at the top, so the logo layer gets the same field
  // this branch does — it was declared here and the early return above stripped
  // it from every other layer.
  return { intent: "edit", answer: "", layer, page: want, ...removal, ...moving };
}

/**
 * A question the interface can actually render, or null.
 *
 * Null is not an error path — it is the ordinary answer for anything malformed,
 * and the caller turns it into a build. Everything here is a shape the model can
 * plausibly produce: one option, six options, the same answer twice, an empty
 * string among them, a whole paragraph as an option.
 *
 * Deduped CASE-INSENSITIVELY and after trimming, because "Book online" and
 * "book online " are one choice wearing two buttons — and dropping duplicates is
 * what can take a four-option question below the minimum, so the count is
 * checked AFTER the cleaning rather than before it.
 */
/**
 * One option, cut to fit a button.
 *
 * AT A WORD BOUNDARY, never mid-word. Measured live: the model returned "Tell me
 * what you do and I'll ask what people should be able to do", which the old
 * blunt slice rendered as "…and I'll ask what people sho" — a button ending in a
 * fragment, which reads as the interface being broken rather than as the model
 * having written the wrong thing.
 *
 * The clip is a backstop and not the fix; an option that needs clipping at all
 * is a sentence rather than an answer, which is what the tool description now
 * says. This just makes the failure legible when it happens anyway.
 */
export function clipOption(raw) {
  const s = String(raw == null ? "" : raw).trim().replace(/\s+/g, " ");
  if (s.length <= MAX_OPTION_CHARS) return s;
  const cut = s.slice(0, MAX_OPTION_CHARS);
  const sp = cut.lastIndexOf(" ");
  // Only honour the boundary if it leaves most of the button used — a very
  // early space would throw away nearly all of a long single-word answer.
  return (sp >= MAX_OPTION_CHARS * 0.5 ? cut.slice(0, sp) : cut).trim();
}

/**
 * The question text, bounded WITHOUT being mutilated.
 *
 * It was `.slice(0, 240)`, and a live round on 2026-08-09 shipped the customer
 * *"…welcoming and community-focused, or hardcore and inte"* — cut mid-word, on
 * screen, in the one message whose whole job is to read like a person talking.
 *
 * `clipOption` two functions down had already solved this properly for the
 * buttons; the text was written with a bare slice and nobody noticed the
 * asymmetry. Same rule here: fall back to the last word boundary, and only
 * honour it if it leaves most of the allowance used, so a long unbroken run is
 * not thrown away entirely.
 *
 * The ellipsis is deliberate — a sentence that simply stops reads as a bug,
 * where one that trails off reads as brevity. Nothing is actually lost when it
 * fires: the model's habit is to list the options in prose and the buttons
 * below already carry them.
 */
export function clipQuestion(raw) {
  const s = String(raw == null ? "" : raw).trim().replace(/\s+/g, " ");
  if (s.length <= MAX_QUESTION_CHARS) return s;
  const cut = s.slice(0, MAX_QUESTION_CHARS - 1);
  const sp = cut.lastIndexOf(" ");
  return ((sp >= MAX_QUESTION_CHARS * 0.6 ? cut.slice(0, sp) : cut).trim() + "…");
}

export function readQuestion(raw) {
  const q = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : null;
  if (!q) return null;
  const text = clipQuestion(q.text);
  if (!text) return null;
  const seen = new Set();
  const options = [];
  for (const o of Array.isArray(q.options) ? q.options : []) {
    // A STRING, not anything stringifiable: `String(["a","b"])` is "a,b", which
    // renders as one button offering two answers.
    if (typeof o !== "string") continue;
    const label = clipOption(o);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    options.push(label);
    if (options.length >= MAX_OPTIONS) break;
  }
  if (options.length < MIN_OPTIONS) return null;
  return { text, options };
}

/**
 * THE CHANGE WAS TOO BIG FOR ONE STEP (owner, 2026-10-24): what the router is
 * told when a part, or a standalone edit, is routed again to split itself.
 * `split` is `{ why, reason? }` (the request's `readSplit`, or the page's
 * own); anything else is no section. The router is asked to answer the first
 * piece it can do and hold every other piece back in `alsoAsked`, in the
 * customer's own words, so each runs as a part of its own; never `build`.
 */
export function splitBlock(split) {
  if (!split || typeof split !== "object" || Array.isArray(split) || typeof split.why !== "string" || !/^[a-z-]{1,20}$/.test(split.why)) return "";
  const reason = typeof split.reason === "string" && /^[a-z0-9_-]{1,40}$/i.test(split.reason) ? split.reason : "";
  return "THIS WAS TOO BIG FOR ONE STEP\nThe step this was sent to said it needs more than it can make in one go" +
    (reason ? " (its reason: " + reason + ")" : "") + ". Split it into smaller changes the steps can each make: answer the " +
    "first of them, and hold every other one back in alsoAsked, copied word for word from their message, so each runs on " +
    "its own, in order, with dependsOn where one needs another. Every part of what they asked must be in one of them. " +
    "Never answer \"build\": the whole site is never rewritten for this.";
}

/**
 * The four token kinds, in the shape `pageCredits` prices.
 *
 * Same shape as the schema and pages calls so there is one price table for all
 * three — this call is cheap, but "cheap" is not a billing rule, and a model
 * whose price changes should not need a second place edited.
 */
export function askUsage(reply, model = ASK_MODEL) {
  const u = (reply && reply.usage) || {};
  return {
    in: Number(u.input_tokens) || 0,
    out: Number(u.output_tokens) || 0,
    cacheRead: Number(u.cache_read_input_tokens) || 0,
    cacheWrite: Number(u.cache_creation_input_tokens) || 0,
    // The rate column. `askRequest` sends this same constant, so the call and
    // its price cannot disagree — and without it the router was billed at Sonnet
    // rates for a Haiku call, three times over. Invisible today, because a
    // routing call rounds up to the one-credit floor either way; it stops being
    // invisible the moment anything on this path gets bigger.
    model,
  };
}

// ── WHY A ROUTING CALL FAILED, IN WORDS THAT CANNOT CARRY A SECRET ─────────
//
// (Lane 1b, 2026-09-30.) One bare `catch` covered building the request and
// sending it, and the answer kept only `failed: true`. Run 70 (Batch 1) answered
// `addon` + `failed` in 0.4 s and nothing could say why — the xAI account's
// balance was empty, which the owner found by looking. So the failure is named
// now: WHICH STEP threw, and what the evidence allows about why.
//
//   request    — the request could not be built. Nothing was sent.
//   config     — a provider key is not set. Nothing was sent.
//   provider   — the provider answered with an error status.
//   timeout    — our own clock ran out before an answer arrived.
//   transport  — the send threw with no status: the connection failed, or an
//                answer came back that could not be read. `error` says which
//                class, where it can.
//
// EVERY FIELD IS AN ALLOW-LIST, NEVER TEXT. A provider's message can quote the
// request, which holds the customer's words, and an error can carry a header or
// a connection string; none of that is ever read into this object. The status
// is an HTTP status or nothing, the provider's code is one from its own finite
// table (`PROVIDER_CODES`, below) or nothing, and the error is named by a class
// from a fixed list. The Worker hands in its own `upstreamKind` as `classify`,
// so provider errors have one reader, not two.
export const ROUTE_FAILURE_KINDS = ["request", "config", "provider", "timeout", "transport"];

/**
 * Route one message.
 *
 * `deps.send(request)` → the raw Messages API response. Injected so the whole
 * decision runs in tests with no network. `deps.classify(error)`, optional, is
 * the caller's reader of a provider's error body (`upstreamKind` in the Worker).
 *
 * A THROW IS A BUILD, not an error the caller has to handle. See `readRouting`:
 * this sits in front of a path that works, and the worst thing it can do is stop
 * that path running. `usage` comes back null on that route, so nothing is billed
 * for a call that failed — the same our-fault rule the build path follows. And
 * it says why, as `failure` (`routeFailure` above).
 */
/** The router's window over the kept chat: recent messages, each and all capped. */
export const KEPT_TURNS = 40;
export const KEPT_TURN_CHARS = 2000;
export const KEPT_STEP = 20;
export const KEPT_CHARS = 40000;
const ROUTER_LAST_REPLY = 3200;
export async function routeMessage(deps, { message, site, firstBuild = false, brief = "", qa = [], answering = false, picked = false, hasSite = false, model = ASK_MODEL, tablesFilled = false, tablesNone = false, pagesFilled = false, pagesComplete = true, canAsk: askable = false, context = [], pending = null, part = null, history = null, kept = null, device = "", split = null, inventory = "", cacheKey = "", offerAsk = true } = {}) {
  const text = String(message || "").trim();
  // AN EMPTY MESSAGE NEVER REACHES THE MODEL. The composer will not send one, but
  // this is a paid call behind a public route and "the client wouldn't do that"
  // is not a gate.
  if (!text) return { intent: "build", answer: "", usage: null, decision: routeDecision(["no-message"]) };
  // THE BUDGET IS SPENT HERE, in arithmetic, before the model is asked. Owner's
  // call is one question at a time on a first build; `MAX_CLARIFY` is what stops
  // "one at a time" becoming "one after another after another", and a cap the
  // model is merely told about is not a cap.
  const questions = (Array.isArray(qa) ? qa : []).filter((p) => p && p.q && p.a);
  const canClarify = !!firstBuild && questions.length < MAX_CLARIFY;
  // A SITE THAT EXISTS ASKS WHEREVER A QUESTION CAN BE KEPT (2026-10-02):
  // `canAsk` is the route's word that it can keep one. `context` is what they
  // already told us about the waiting request (its earlier answers, read with
  // the steps' own reader), shown beside it and never asked again. HOWEVER
  // MANY ANSWERS IT CARRIES, a question is still offered (2026-10-03, the
  // owner's third review): the total-answer limit is never a reason to act on
  // a guess. A caller that lies about either gets fewer questions or more of
  // its own routing calls, never anybody else's.
  const live = !!hasSite && !firstBuild;
  const waiting = live && pending && typeof pending === "object" ? pending : null;
  const told = waiting ? (readContext(context) || []) : [];
  const canAsk = live && askable === true;
  // `hasSite` IS NOT `!firstBuild`, and collapsing them is the tempting mistake.
  // `firstBuild` is the composer's belief about a project in localStorage;
  // `hasSite` is the server's knowledge that this slug has a published site it
  // owns. They agree almost always, and the case where they do not — a project
  // whose build failed, a stale tab — is exactly the case where routing an edit
  // at a site that does not exist costs a lane with no input. Passed in, and
  // defaulting to false so any caller that has not been taught about it behaves
  // exactly as it did before these two rungs existed.
  const pages = (site && Array.isArray(site.pages)) ? site.pages : [];
  // WHAT THE MODEL IS SHOWN, CUT OR FILLED IN: the decision's `context` codes
  // (`ROUTE_REASONS`), which leave its source alone. Collected INSIDE the
  // request's own catch below, because they read the same caller-supplied
  // values the request does: a brief whose `toString` throws must still end as
  // `request-failed`, exactly as it did before these were named.
  const shown = [];
  // THE CHAT THE SERVER KEEPS, WHEN IT SENT IT (2026-10-20, owner: "do 1"): the
  // summary of what came before and up to `KEPT_TURNS` recent messages, so a
  // request that leans on something said earlier is read with it; cached from
  // one message to the next. The page's short window otherwise, as before.
  const keptSummary = kept && kept.summary && typeof kept.summary.text === "string" ? kept.summary : null;
  //
  // THE WINDOW MOVES IN STEPS OF `KEPT_STEP`, NOT ONE MESSAGE AT A TIME, and
  // that is what lets it be cached: measured live, a window that slid by one
  // message per message changed its own start every time, so the provider's
  // cache never matched past the instructions (11,238 of 11,750 tokens read at
  // full price). Starting on a multiple of 20, the prefix holds for 20 messages
  // and between 40 and 60 recent ones are shown.
  const keptStart = kept && Array.isArray(kept.turns) ? Math.floor(Math.max(0, kept.turns.length - KEPT_TURNS) / KEPT_STEP) * KEPT_STEP : 0;
  const shownHistory = kept && Array.isArray(kept.turns)
    ? readHistory((keptStart ? [{ omitted: keptStart }] : []).concat(kept.turns.slice(keptStart)), { turns: KEPT_TURNS + KEPT_STEP, turnChars: KEPT_TURN_CHARS, total: KEPT_CHARS, lastReplyChars: ROUTER_LAST_REPLY })
    : routerHistory(history);
  // A THROW IS THE BOTTOM OF THE LADDER FOR THIS STATE, not unconditionally a
  // build. On an existing site an unreachable router used to mean the customer
  // paid ~25 credits and had every page rewritten because a Haiku call timed
  // out. `addon` is recoverable in a way that is not.
  //
  // TWO STEPS, TWO CATCHES, ONE FALLBACK: building the request and sending it
  // fail for different reasons, and only telling them apart lets the answer say
  // which (`failure`). What the customer's message leads to is unchanged.
  const fail = (stage, e) => ({
    intent: !!hasSite ? FALLBACK_WITH_SITE : FALLBACK_NO_SITE, answer: "", usage: null, failed: true,
    failure: routeFailure(stage, e, { model, classify: deps && deps.classify }),
    decision: routeDecision([...shown, stage === "request" ? "request-failed" : "send-failed"]),
    // A PROVIDER THAT IS DOWN (owner, 2026-10-24): the fixed notice the call's
    // wait made (`builder/provider-retry.mjs`), so the route waits and asks
    // again instead of acting on the fallback. Only the notice's own fields.
    ...(stage !== "request" && e && e.parked === true && e.providerWait && e.providerWait.notice ? { wait: e.providerWait.notice } : {}),
  });
  // THE MESSAGE'S ITEMS (2026-10-23): on a site that exists, for a message of
  // its own (not an answer to a waiting question), numbered for the router so
  // it holds parts back by number (`heldItems`).
  const items = live && !waiting ? messageItems(text) : [];
  if (items.length) shown.push("items-shown");
  let request;
  try {
    // A FIRST BUILD'S MESSAGE IS CUT TO ITS OWN BOUND (`askRequest`); a site
    // that exists is sent its message whole (2026-10-03).
    if (!live && text.length > MAX_MESSAGE) shown.push("message-cut");
    if (canClarify && String(brief || "").trim().length > MAX_MESSAGE) shown.push("brief-cut");
    const lists = digestLists(site);
    if (lists.tablesCut) shown.push("tables-cut");
    // The route's own word that it filled the table names in (Lane 1d), and the
    // page addresses (2026-10-03).
    if (tablesFilled === true) shown.push("tables-filled");
    if (tablesNone === true) shown.push("tables-none");
    if (pagesFilled === true) shown.push("pages-filled");
    // A PART OF A LONGER REQUEST (2026-10-03) is shown the answers that
    // request already has beside its own words, as a waiting request is, and
    // the message it came from (`partBlock`).
    const partOf = live && !waiting ? readPartOf(part) : null;
    // THE CONVERSATION'S SMALL WINDOW (2026-10-14), read by the one reader the
    // reply's call uses, and said in the decision when shown or cut.
    if (shownHistory.turns.length) shown.push("history-shown");
    if (shownHistory.turns.length && (shownHistory.left > 0 || shownHistory.turns.some((t) => t.cut))) shown.push("history-cut");
    request = askRequest({ items, message: text, site, canClarify, brief, qa: questions, hasSite: !!hasSite, model, live,
      // OFFERED WHEREVER ONE CAN BE KEPT (owner, 2026-10-26: any step may
      // ask, at any stage, parts included); `offerAsk` false is still read
      // for a caller that has nobody to ask.
      canAsk: canAsk && offerAsk !== false, pending: waiting, context: waiting ? told : (partOf ? (readContext(context) || []) : told), part: partOf, tablesNone: tablesNone === true, history: shownHistory.turns.length ? shownHistory : null, summary: keptSummary, answering: canClarify && answering === true && picked !== true, device, split: live && hasSite ? split : null, inventory, cacheKey });
  } catch (e) {
    return fail("request", e);
  }
  let reply;
  try {
    reply = await deps.send(request);
  } catch (e) {
    return fail("send", e);
  }
  // AN ANSWER CUT OFF AT ITS CEILING, ON A SITE THAT EXISTS, IS NO ANSWER
  // (2026-10-03): its held-back part or page may stop mid-word, and nothing is
  // ever run on half of one. A failure of the call, unbilled — our ceiling. A
  // first build reads its answer exactly as before.
  const cutOff = (r, reasons) => (live && r && r.stop_reason === "max_tokens"
    ? { intent: FALLBACK_WITH_SITE, answer: "", usage: null, failed: true, failure: routeFailure("answer", null, { model }), decision: routeDecision([...reasons, "answer-cut"]) }
    : null);
  { const c = cutOff(reply, shown); if (c) return c; }
  // WHETHER THE PAGE LIST IS THE SITE'S WHOLE LIST (2026-10-03): a page missing
  // from a list that may be partial is never read as a page the site lacks.
  const readAs = (r, open, tr) => readRouting(r, {
    canClarify, picked: picked === true, hasSite: !!hasSite, pages, pagesComplete: pagesComplete !== false, trace: tr, history: shownHistory.turns.length > 0,
    live, canAsk: open, pending: !!waiting, chosen: !!(waiting && waiting.chosen === true), items,
    // THE WAITING QUESTION IS THE START-OVER ONE (2026-10-24): only its yes is the rewrite.
    confirming: !!(waiting && waiting.by === START_OVER_BY),
  });
  let trace = { reasons: shown.slice(), input: undefined };
  let routed = readAs(reply, canAsk, trace);
  // ── A QUESTION IT WAS ALREADY ANSWERED (2026-10-02, the owner's second review:
  //    *"when an answer did not resolve the ambiguity, retain the pending
  //    request and let the model ask a more specific follow-up; when the
  //    answer already exists, reuse it instead of asking again"*) ──────────
  //
  // Only for a reply that answers the waiting question: every answer the
  // request now carries is this one and those before it, read as the route
  // will store them (`appendAnswer`). A question back that is one of theirs
  // again (`repeatOf`) is never put to the customer as if new: the router is
  // sent the same request once more with those answers in front of it
  // (`withReuse`), to act on them or ask a more specific question
  // (`clarify-reused`); a router that still asks it is kept with a note naming
  // the answer that did not settle it (`clarify-again`, `againNote`). Only the
  // reply that is used is billed: the call asked again is ours.
  //
  // AT THE REPEATED-QUESTION THRESHOLD OR PAST THE TOTAL-ANSWER LIMIT, IT IS
  // NEVER SENT AGAIN (2026-10-03, the owner's third review: *"Never treat a
  // question limit or repeated question as permission to act … Stop automatic
  // retry loops while keeping a user-driven way to clarify or cancel"*). It
  // was sent with questions closed, to act on a guess. Now its question is
  // kept as it came, under the note (`clarify-again` with no `clarify-reused`
  // before it), and the waiting request stays as it is for the customer's
  // next answer or their Cancel.
  // A QUESTION ABOUT THE SITE IS NOT AN ANSWER (2026-10-23, audit A35-5): the
  // schema only suggests pairing `ask` with answered:false, and an answer read
  // as answered:true with intent `ask` closed the waiting question and, for a
  // request part, marked the part done without its work. It is read as the
  // side question it is: the reply is given and the question keeps waiting.
  if (waiting && routed.unusable !== true && routed.intent === "ask" && routed.answered === true) routed = { ...routed, answered: false };
  if (waiting && routed.unusable !== true && routed.intent === "clarify" && routed.answered === true) {
    // THE ANSWER WHOLE, as the route stores it (2026-10-03): one past the size
    // policy never reaches here — the route refuses it first.
    const all = appendAnswer(told, { q: String(waiting.question && waiting.question.text || "").trim(), a: text }) || [];
    const hit = repeatOf(all, routed.question);
    if (hit.length && (hit.length >= MAX_SAME_ASK || all.length >= MAX_ASKED)) {
      trace.reasons.push("clarify-again");
      // `repeat` IS WHAT THE NOTE IS MADE OF (2026-10-03): the answers that did
      // not settle the question and whether our own re-asking has stopped, so
      // the route can have the note written from them (`repeatNoteFacts`) and
      // keep `againNote` as its fallback.
      routed = { ...routed, again: true, note: againNote(hit), repeat: { answers: hit, atLimit: true } };
    } else if (hit.length) {
      let again;
      try {
        again = withReuse(askRequest({ items, message: text, site, canClarify, brief, qa: questions, hasSite: !!hasSite, model, live, canAsk, pending: waiting, context: told, history: shownHistory.turns.length ? shownHistory : null, summary: keptSummary }), hit);
      } catch (e) {
        return fail("request", e);
      }
      try {
        reply = await deps.send(again);
      } catch (e) {
        return fail("send", e);
      }
      { const c = cutOff(reply, [...shown, "clarify-reused"]); if (c) return c; }
      trace = { reasons: [...shown, "clarify-reused"], input: undefined };
      routed = readAs(reply, canAsk, trace);
      const still = routed.unusable !== true && routed.intent === "clarify" ? repeatOf(all, routed.question) : [];
      if (still.length) {
        trace.reasons.push("clarify-again");
        routed = { ...routed, again: true, note: againNote(still), repeat: { answers: still, atLimit: still.length >= MAX_SAME_ASK || all.length >= MAX_ASKED } };
      }
    }
  }
  // ── A HELD-BACK PART NOT FOUND IN THE MESSAGE, RETRIED ONCE WITH THAT REASON
  //    (owner, 2026-10-24: "retry once with the check's own reason") ──────────
  //
  // Every route that runs the message refuses `held-unread` when a part the
  // router held back (`alsoAsked`) is not the customer's own words. That check
  // is exact (`heldParts`), so it is asked here first: the same request (same
  // model, same effort) goes once more with the router's own answer and the
  // check's reason. A second miss is answered as it came, and the route's
  // existing refusal stands. Both calls are on the message's routing bill.
  let firstUsage = null, retryReason = null;
  if (live && !waiting && routed.unusable !== true && heldUnread(text, routed.alsoAsked)) {
    firstUsage = askUsage(reply, model);
    let again2;
    try { again2 = await deps.send(retryRequest(request, reply, HELD_UNREAD_REASON)); } catch { again2 = null; }
    const c = again2 ? cutOff(again2, shown) : null;
    if (again2 && !c) {
      const t2 = { reasons: shown.slice(), input: undefined };
      const r2 = readAs(again2, canAsk, t2);
      const ok = r2.unusable !== true && !heldUnread(text, r2.alsoAsked);
      markRetry(deps && deps.mark, "route", "held-unread", ok);
      retryReason = { step: "route", reason: "held-unread", ok };
      reply = again2; routed = r2; trace = t2;
    } else {
      markRetry(deps && deps.mark, "route", "held-unread", false);
      retryReason = { step: "route", reason: "held-unread", ok: false };
    }
  }
  // AN ANSWER THAT CANNOT BE USED, ON A SITE THAT EXISTS, IS A FAILURE OF THE
  // CALL (2026-10-02): a question that cannot be shown, or a reply to a waiting
  // question that does not say whether it answers it. Never work in its place,
  // and nothing billed for it — our model, our fault, the build path's rule.
  if (routed.unusable === true) {
    return {
      intent: FALLBACK_WITH_SITE, answer: "", usage: null, failed: true,
      failure: routeFailure("answer", null, { model }),
      decision: routeDecision(trace.reasons, trace.input),
    };
  }
  // PAY ONLY FOR WHAT WORKED (round 2): a retry that still misquotes is
  // refused by the routes as before, at the first call's routing cost.
  const usage = !firstUsage ? askUsage(reply, model)
    : retryReason && retryReason.ok ? addUsages(firstUsage, askUsage(reply, model))
    : firstUsage;
  return { ...routed, usage, ...(retryReason ? { retryReason } : {}), decision: routeDecision(trace.reasons, trace.input) };
}

/** The reason told back when a held-back part is not in the message (2026-10-24). */
export const HELD_UNREAD_REASON = "Your answer could not be used: a part you held back in alsoAsked is not found word for word in the customer's message, or is not a list of their own words. Every held-back part must be copied exactly from the message (or named by its number in brackets when the message is numbered). Answer again with the same decision, holding back the same parts, each copied exactly.";

/** Whether the router's held-back parts cannot be found in the message — the routes' own `held-unread` check. */
export function heldUnread(message, alsoAsked) {
  const listed = heldList(alsoAsked);
  if (listed === null) return true;
  if (!listed.length) return false;
  return !heldParts(message, listed).ok;
}
