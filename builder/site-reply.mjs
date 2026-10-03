// ── THE CUSTOMER'S REPLY, WRITTEN BY A MODEL FROM WHAT REALLY HAPPENED ─────
//
// (2026-10-03.) Owner: *"Make normal customer-facing messages throughout edit
// and add-on model-written, including router clarification, success, partial
// completion, pending work, ordinary refusals, repeated-question explanations,
// and cancellation acknowledgments … Code must supply structured, verified
// facts about what changed, what failed, what remains pending, and whether
// input is needed; the model should explain those facts naturally using the
// conversation and site context, without inventing outcomes or changing
// execution decisions. Keep fixed messages only for genuine technical failures
// … A reply-generation failure must never rerun completed work."*
//
// THREE PARTS, AND EACH KEEPS TO ITS OWN JOB.
//
//   THE FACTS are read off the route's own final answer — the fields the
//   browser's composer has always read (`editReplyBody`, `addonReplyText`,
//   `alsoTail`, `wholeRequestNote` in public/chat.js) — and never off the
//   request's wording. Each is one short statement with an id and a kind:
//   something that changed, something that did not and why, a part left for
//   later, the question that needs an answer, what it cost, how to undo it.
//   Where a step already wrote its own account of a result (a refusal's
//   reason, the menu editor's list of links), that account is the fact: the
//   step is the only side that knows it.
//
//   THE CALL is one forced tool call (`write_reply`) on the customer's own
//   picked quick model, shown the facts, their words, the answers they gave
//   and the site's name and pages. It must say which facts it explained
//   (`covers`); a reply that leaves one out is asked for once more, and a
//   second miss is not used.
//
//   THE FALLBACK is to change nothing. A reply that cannot be had — the call
//   failed, timed out, or never covered every fact — leaves the route's answer
//   exactly as it was, and the browser says what it always said. Nothing here
//   runs before the outcome is final, writes anything, or charges anything, so
//   a reply that fails cannot repeat a change or a charge.
//
// WHAT IS NOT WRITTEN BY A MODEL, ON PURPOSE: a technical failure of ours (a
// model or provider that did not answer, a store or service that could not be
// reached), told by its fixed sentence — decided by what the answer says
// (`ours`, and the reasons in `TECHNICAL`), never by its HTTP status alone;
// an escalation, which is not an ending (the browser walks on); a receipt for
// queued work; and the first build, whose interview this never touches.
//
// DEPENDENCY-LIGHT: the Worker and the job child both import it, and the job
// image copies `builder/` modules by name (the Dockerfile's worker line).

import { heldList, readContext, MAX_ANSWER_CHARS } from "./site-ask.mjs";

/** The switch: `MODEL_REPLIES` = "on" in the Worker's vars. Anything else keeps every reply as it was. */
export function repliesOn(env) {
  return !!(env && typeof env.MODEL_REPLIES === "string" && env.MODEL_REPLIES.trim().toLowerCase() === "on");
}

/** Where the reply came from, on the answer the browser reads. Only "model" is ever written. */
export const REPLY_SOURCE = "model";

/** The longest reply used. Enough for several facts; a reply past it is refused, never cut. */
export const REPLY_MAX_CHARS = 1600;

/** What one call may write. A reply is a few sentences. */
export const REPLY_MAX_TOKENS = 700;

/**
 * How long a reply may take, end to end, both attempts together. The work is
 * already done and the customer is waiting on its sentence; past this the
 * route answers without one and the browser says it the old way.
 */
export const REPLY_DEADLINE_MS = 20000;

/** One call's own ceiling, inside the deadline. */
export const REPLY_CALL_MS = 12000;

/** At most this many facts go to one call; a longer list is cut and the cut is said. */
export const MAX_FACTS = 24;

/** One fact's text, at most. */
const FACT_MAX = 420;

export const REPLY_TOOL = {
  name: "write_reply",
  description:
    "Write the one chat message the customer reads now, explaining every fact you were given, and list the id of each fact you explained.",
  input_schema: {
    type: "object",
    properties: {
      reply: {
        type: "string",
        description:
          "The message to the customer, in plain sentences. Explain every fact, and only the facts. Usually one to three " +
          "short sentences; more only when there are several facts. No headings, no lists unless there are four or more changes.",
      },
      covers: {
        type: "array",
        items: { type: "string" },
        description: "The id of every fact your reply explains, exactly as written in brackets (for example \"c1\"). Every fact must be here.",
      },
    },
    required: ["reply", "covers"],
  },
};

export const REPLY_SYSTEM =
  "You write the chat message a customer reads after asking an AI website builder to change their live website. " +
  "The builder's code has already done the work and checked what really happened; you are given that as a list of facts, " +
  "each with an id. Your job is only to tell the customer, naturally and briefly, what those facts say.\n\n" +
  "RULES\n" +
  "- Say only what the facts say. Never claim a change, a failure, a charge, a refund, a question or a next step that no " +
  "fact states. If a fact says nothing on the site changed, say so plainly.\n" +
  "- Explain every fact, and list its id in covers. Do not drop one because another seems more important.\n" +
  "- When a fact says a question will be shown under your reply, lead into it in a few words. Do not ask it yourself, " +
  "do not repeat its words, and do not invent answers to choose from.\n" +
  "- When a fact names a part of their request that was left for later, say plainly that it was not tried, in their own words.\n" +
  "- Describe their site the way they would: pages by their names or addresses, things by the words people see. Never " +
  "mention steps, tools, layers, files, code, models or error codes.\n" +
  "- Use their own words for things on their site where the facts quote them.\n" +
  "- Write in the language they wrote their message in. Warm and direct; no apologies beyond one short one when something " +
  "did not work; no marketing.\n" +
  "- You may start with ✅ when everything they asked for was done, or ⚠️ when part or all of it was not. Otherwise no emoji.\n" +
  "- Never put a fact's id in the reply itself.";

// ── FACTS ────────────────────────────────────────────────────────────────

/**
 * WHAT TECHNICAL MEANS HERE: a failure of ours that no rewording helps —
 * a model, provider, store or service that did not answer, or a state we
 * cannot read. These keep their fixed sentences. Everything else that ends a
 * request (a page the site does not have, a change already in place, a part
 * that needs a detail, a refusal to take something off, a compile that did
 * not come together) is an ordinary outcome and is explained.
 */
export const TECHNICAL = Object.freeze(new Set([
  "send", "no-container", "queue", "stale", "bad-idem", "needs-review", "storage not configured",
  "backend", "config", "store", "rename-store", "generate", "provision", "schema", "verify",
  "parts-unreadable", "row-unprotected", "row-write", "unread", "no-page-back", "clarify-unkept",
  "unconfigured", "held-unread", "context-unread", "scope-unread", "layer", "editable-state",
  "no-meta", "lost", "could not read the job", "stopped", "time", "budget", "unverified",
]));

/**
 * Whether an answer is a failure of ours, by what it says — `ours`, a reason
 * in `TECHNICAL`, a stop the platform made (`review`), or a charge the ledger
 * could not take for a reason other than the balance — never by its status.
 */
export function technicalAnswer(body) {
  if (!body || typeof body !== "object") return false;
  if (body.ours === true || body.failed === true || body.review === true) return true;
  if (body.error === "unbilled") return body.detail !== "insufficient";
  return typeof body.error === "string" && TECHNICAL.has(body.error);
}

const clip = (v, n = FACT_MAX) => {
  const s = String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
};
const said = (v) => (typeof v === "string" && v.trim() ? clip(v) : "");
const quote = (v, n = 160) => "“" + clip(v, n) + "”";
const listOf = (items) => (items.length <= 1 ? items.join("") : items.slice(0, -1).join(", ") + " and " + items[items.length - 1]);
const count = (n, one, many) => (n === 1 ? "one " + one : n + " " + (many || one + "s"));

/** A page file as the address people see: `src/routes/gallery.tsx` → `/gallery` (the browser's `sitePathOf`). */
export function pathOf(file) {
  if (typeof file === "string" && /^\/[^\s]*$/.test(file)) return file;
  const m = String(file || "").match(/^(?:src\/routes\/)?(.+)\.tsx$/i);
  if (!m) return "";
  const rel = m[1];
  const cut = rel.lastIndexOf("/");
  const dir = cut < 0 ? "" : rel.slice(0, cut + 1);
  const segs = (cut < 0 ? rel : rel.slice(cut + 1)).split(".").filter(Boolean).map((s) => s.replace(/_$/, ""));
  if (segs.some((s) => s.charAt(0) === "_")) return "";
  if (segs[segs.length - 1] === "index") segs.pop();
  return "/" + (dir + segs.join("/")).replace(/\/$/, "");
}
const paths = (v) => [...new Set((Array.isArray(v) ? v : []).map(pathOf).filter(Boolean))];
const strings = (v, n = 8) => (Array.isArray(v) ? v : []).filter((x) => typeof x === "string" && x.trim()).slice(0, n).map((x) => clip(x, 200));
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** A list of facts with ids by kind: c changed, f not done, p pending, q question, n note, m money, u undo. */
function factList() {
  const out = [];
  const seen = new Set();
  const n = {};
  const PREFIX = { changed: "c", "not-done": "f", pending: "p", question: "q", note: "n", money: "m", undo: "u", nothing: "x" };
  const add = (kind, text) => {
    const t = clip(text);
    if (!t || seen.has(kind + "|" + t)) return;
    seen.add(kind + "|" + t);
    const p = PREFIX[kind] || "n";
    n[p] = (n[p] || 0) + 1;
    out.push({ id: p + n[p], kind, text: t });
  };
  return { add, out };
}

/** The parts left for later: this turn's (`deferred`) and those put off before a question (`putOff`). */
function heldFacts(F, body, done) {
  const now = heldList(body.deferred) || [];
  const earlier = heldList(body.putOff) || [];
  const parts = now.concat(earlier.filter((p) => !now.includes(p)));
  for (const p of parts.slice(0, 6)) {
    F.add("pending", (done ? "Left for later, so not tried this time (they can send it next): " : "Left for later, so not tried: ") + quote(p, 200));
  }
}

/** The question a step or the router is asking, shown under the reply by the page itself. */
function questionFact(F, q) {
  if (!q || typeof q.text !== "string" || !q.text.trim()) return;
  F.add("question", "A question for them will be shown right under your reply, with its own words and choices: " + quote(q.text, 240) +
    ". Lead into it briefly; do not repeat or answer it.");
}

/**
 * A STEP'S QUESTION AND NOTHING ELSE TO SAY: nothing ran, nothing was put off,
 * nothing charged. The question is the model's own words already, and the page
 * draws it with its card, so there is nothing for a reply to explain — and no
 * call is made for one.
 */
function questionOnly(facts) {
  return facts.some((f) => f.kind === "question") && facts.every((f) => f.kind === "question" || f.kind === "nothing");
}

/** What a refusal or a part that did not go through says, each once; parts that said nothing are counted. */
function partialFacts(F, parts) {
  let silent = 0;
  for (const p of parts) {
    const m = p && typeof p.msg === "string" ? p.msg.trim() : "";
    if (!m) silent++;
    else F.add("not-done", "Part of the request was not done. The builder's own reason: " + quote(m, 360));
  }
  if (silent) F.add("not-done", count(silent, "more part") + " of the request did not go through, with no reason recorded; asking for it again on its own will say why.");
  const charged = parts.map((p) => num(p && p.cost)).filter((c) => c !== null && c > 0);
  const total = charged.reduce((a, c) => a + c, 0);
  if (total > 0) F.add("money", (charged.length === 1 ? "That part" : "Those parts") + " still cost " + count(total, "credit") + ".");
}

/** The money a refusal states (`wholeRequestNote`): the edit's own charge, and the routing call's when it is known. */
function refusalMoney(F, body, routedCost) {
  const cost = num(body.cost);
  const unchanged = body.unchanged === true || body.error === "withheld";
  if (unchanged) F.add("nothing", "Nothing on their site changed.");
  if (cost !== null && cost >= 0) F.add("money", cost > 0 ? "This change still cost " + count(cost, "credit") + "." : "This change cost them nothing.");
  const routed = num(routedCost);
  if (routed !== null && routed > 0) F.add("money", "Reading their message cost " + count(routed, "credit") + ".");
}

const LOOK_SAY = { lang: "the language", brand: "the name", description: "the description", theme: "the theme", favicon: "the tab icon", wordmark: "the logo" };

/** What the page operations that published did (`pageOpsSaid`). */
function pageOpFacts(F, ops) {
  let gone = false;
  for (const op of (Array.isArray(ops) ? ops : [])) {
    if (!op || typeof op !== "object") continue;
    const page = typeof op.page === "string" && op.page ? op.page : "";
    const removed = paths(op.removed);
    if (Array.isArray(op.removed) && op.removed.length) {
      F.add("changed", "Took " + (removed.length ? listOf(removed) : "that page") + " off the site.");
      gone = true;
    } else if (typeof op.renamedTo === "string" && op.renamedTo) {
      F.add("changed", "Moved " + (page || "that page") + " to " + op.renamedTo + "; the old address sends visitors to the new one.");
    } else {
      F.add("changed", "Updated " + (page || "the page") + ".");
    }
  }
  if (gone) F.add("undo", "Every published version is kept, so a page taken off can be put back if they ask.");
}

/** What a change did beside what was asked for (`editOutcomes`), every layer. */
function outcomeFacts(F, e) {
  const kept = strings(e.keptParts);
  if (kept.length) F.add("not-done", "Left " + listOf(kept) + " alone: too long to show the builder in one go, and rewriting it unseen would risk losing what it does.");
  const unseen = strings(e.unseenParts);
  if (unseen.length) F.add("not-done", "Could not read the site's sections just then, so " + listOf(unseen) + " stayed exactly as before; asking again may work.");
  const unsure = strings(e.partsUnsure);
  if (unsure.length) F.add("note", "Could not confirm that " + listOf(unsure) + " is still on the page; worth a look before sharing it.");
  const heldPix = Number(e.photosKept) || 0;
  if (heldPix > 0) F.add("note", (heldPix === 1 ? "The photograph" : "The " + heldPix + " photographs") + " already on the page stayed; only what was asked about changed.");
  const lostPix = Number(e.photosRemoved) || 0;
  const offPix = typeof e.photosTakenOff === "number" && e.photosTakenOff > 0 ? e.photosTakenOff : 0;
  if (lostPix > 0) F.add("changed", count(lostPix, "photograph") + (lostPix === 1 ? " is" : " are") + " no longer on the site.");
  if (offPix > 0) F.add("undo", "To undo that, they can roll back to the previous build in Cloud → Versions.");
  else if (lostPix > 0) F.add("undo", "To undo that, they can say “put the " + (lostPix === 1 ? "photo" : "photos") + " back”.");
  const parts = Array.isArray(e.partial) ? e.partial : [];
  partialFacts(F, e.clarify ? parts.filter((p) => !(p && p.error === "clarify")) : parts);
  const frames = Number(e.photos) || 0;
  if (frames > 0) F.add("note", "There " + (frames === 1 ? "is an empty space" : "are " + frames + " empty spaces") + " for a photo; uploading their own in the Data panel fills " + (frames === 1 ? "it" : "them") + ".");
  const listPix = Number(e.listPhotos) || 0;
  if (listPix > 0 || e.listPhotosMore === true) F.add("note", "The page draws its pictures from a list, so the photographs there come from that list; they can ask for photographs there.");
  for (const p of strings(e.problems, 3)) F.add("note", "Worth knowing: " + p);
  const render = said(e.renderNote);
  if (render) F.add("note", render);
}

/**
 * THE FACTS OF AN EDIT'S FINAL ANSWER — the edit route's, synchronous or a
 * queued job's stored one. `skip` says why no reply is written: an answer that
 * is not an ending, or a failure of ours that keeps its fixed sentence.
 */
export function editReplyFacts(e, { routedCost = null } = {}) {
  if (!e || typeof e !== "object" || Array.isArray(e)) return { skip: "unreadable", facts: [] };
  if (e.escalate === true) return { skip: "escalate", facts: [] };
  if (typeof e.job === "string" && typeof e.poll === "string") return { skip: "receipt", facts: [] };
  if (e.ok === true && e.recovered === true) return { skip: "recovered", facts: [] };
  if (typeof e.ok !== "boolean") return { skip: "unreadable", facts: [] };
  if (technicalAnswer(e)) return { skip: "technical", facts: [] };
  const F = factList();
  if (e.ok === true) {
    const layer = typeof e.layer === "string" ? e.layer : "";
    if (layer === "text") {
      const n = Number(e.applied) || 0;
      const now = strings(e.changed, 4).map((x) => quote(x, 80));
      F.add("changed", "Changed the wording" + (n > 1 ? " in " + n + " places" : "") + (now.length ? "; it now reads " + listOf(now) : "") + ".");
      const stale = Array.isArray(e.staleTel) ? e.staleTel : [];
      if (stale.length && stale[0] && typeof stale[0].href === "string") {
        const mail = /^mailto:/.test(stale[0].href);
        F.add("not-done", mail
          ? "The email link still sends to " + clip(stale[0].href.replace(/^mailto:/, ""), 120) + "; saying “point the email link at the new address” fixes it."
          : "The Call link still dials " + clip(stale[0].href.replace(/^tel:/, ""), 60) + "; saying “make the call button use the new number” fixes it.");
      }
    } else if (layer === "data") {
      const rows = Array.isArray(e.applied) ? e.applied : [];
      const gone = rows.filter((r) => r && r.removed);
      const rest = rows.filter((r) => r && !r.removed);
      const added = rest.filter((r) => r.id === undefined);
      const changed = rest.filter((r) => r.id !== undefined);
      const tables = (list) => [...new Set(list.map((r) => (typeof r.table === "string" ? r.table : "")).filter(Boolean))];
      if (changed.length) F.add("changed", "Updated " + count(changed.length, "entry", "entries") + (tables(changed).length ? " in " + listOf(tables(changed)) : "") + ".");
      if (added.length) F.add("changed", "Added " + count(added.length, "entry", "entries") + (tables(added).length ? " to " + listOf(tables(added)) : "") + ".");
      for (const g of gone.slice(0, 3)) {
        const w = g.was && typeof g.was === "object" ? g.was : null;
        const cols = w ? Object.keys(w).filter((k) => k !== "id" && w[k] != null && String(w[k]).trim()) : [];
        const desc = cols.slice(0, 3).map((k) => k + " " + clip(w[k], 60)).join(", ");
        F.add("changed", "Removed an entry from " + (typeof g.table === "string" ? g.table : "a list") + (desc ? " (" + desc + ")" : "") + ".");
        const name = cols.length ? clip(w[cols[0]], 40) : "";
        if (name) F.add("undo", "To bring it back, they can say “put " + name + " back”.");
      }
      if (gone.length > 3) F.add("changed", "Removed " + count(gone.length - 3, "more entry", "more entries") + ".");
      const sorted = said(e.sortMsg);
      if (sorted) F.add("changed", sorted.replace(/^✅\s*/, ""));
      if (e.failed) F.add("not-done", count(Number(e.failed) || 1, "entry", "entries") + " could not be saved; trying that one again may work.");
      if (!rows.length && !sorted) F.add("changed", "The change was made.");
    } else if (layer === "page" && ((Array.isArray(e.removed) && e.removed.length) || (typeof e.renamedTo === "string" && e.renamedTo))) {
      pageOpFacts(F, [e]);
    } else if (layer === "page") {
      F.add("changed", "Updated " + (typeof e.page === "string" && e.page ? e.page : "the page") + ".");
      const reord = strings(e.reordered);
      if (reord.length) F.add("note", listOf(reord) + (reord.length === 1 ? " is" : " are") + " listed on other pages too, and only this page changed; saying “do the same everywhere” makes them match.");
      const ign = paths(e.ignored);
      if (ign.length) F.add("not-done", "Only that one page changed; " + listOf(ign) + (ign.length === 1 ? " was" : " were") + " left alone, and asking again naming " + (ign.length === 1 ? "it" : "them") + " would change " + (ign.length === 1 ? "it" : "them") + " too.");
    } else if (layer === "look") {
      const ops = Array.isArray(e.pageOps) ? e.pageOps : [];
      const look = said(e.lookNote);
      if (look) F.add("changed", look);
      const moved = (Array.isArray(e.moved) ? e.moved : []).filter((k) => typeof k === "string").slice(0, 6).map((k) => LOOK_SAY[k] || k);
      const bits = moved.concat(strings(e.tokens, 4), strings(e.style, 4), e.css ? ["the design"] : []);
      const where = typeof e.tokensPage === "string" && e.tokensPage ? " on " + e.tokensPage : "";
      if (bits.length) F.add("changed", "Changed " + listOf(bits) + where + ".");
      pageOpFacts(F, ops);
      const takeOff = said(e.takeOffNote);
      if (takeOff) F.add("not-done", takeOff);
      if (moved.includes("the name")) {
        const n = Number(e.renamed) || 0;
        F.add(n ? "changed" : "note", n
          ? "Changed the name in " + count(n, "place") + " on the pages too."
          : "The title and link preview use the new name, but the old name was not found written on any page; the headings are worth checking.");
      }
      for (const n of [e.styleNote, e.tokenNote, e.cssNote]) { const s = said(n); if (s) F.add("note", s); }
      if (!F.out.length) F.add("changed", "Updated the look.");
    } else {
      // picture, nav, logo, rename, rules: the step wrote its own account,
      // because only it knows which picture, which links, which address.
      const own = said(e.msg);
      F.add("changed", own ? "What the builder reports it did: " + quote(own.replace(/^✅\s*/, ""), 400) : "The change was made.");
      if (layer === "rules") F.add("note", "It took effect at once; nothing needed rebuilding.");
    }
    outcomeFacts(F, e);
  } else {
    if (e.error === "clarify") {
      // A step that asked and did nothing else: nothing ran, nothing charged.
      F.add("nothing", "Nothing on their site changed yet; one detail is needed first.");
    } else {
      const own = said(e.msg);
      if (own) F.add("not-done", "The change was not made. The builder's own reason: " + quote(own, 400));
      else {
        const parts = Array.isArray(e.partial) ? e.partial.filter((p) => !(p && p.error === "clarify")) : [];
        if (parts.length) partialFacts(F, parts);
        else F.add("not-done", "The change did not go through.");
      }
      refusalMoney(F, e, routedCost);
    }
  }
  heldFacts(F, e, e.ok === true);
  questionFact(F, e.clarify);
  return questionOnly(F.out) ? { skip: "question-only", facts: [] } : { skip: null, facts: F.out };
}

/** A scheduled job as a customer reads it (the browser's `jobWords`, without the zone). */
function jobSaid(j) {
  if (!j || typeof j !== "object" || typeof j.name !== "string" || !j.name) return "";
  const m = Number(j.everyMinutes);
  const every = !Number.isFinite(m) || m <= 0 ? ""
    : m % 10080 === 0 ? (m === 10080 ? "every week" : "every " + (m / 10080) + " weeks")
      : m % 1440 === 0 ? (m === 1440 ? "every day" : "every " + (m / 1440) + " days")
        : m % 60 === 0 ? (m === 60 ? "every hour" : "every " + (m / 60) + " hours")
          : "every " + m + " minutes";
  const at = typeof j.at === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(j.at) ? " at " + j.at : "";
  return clip(j.name, 80) + (every ? " (" + every + at + ")" : "");
}

/** THE FACTS OF AN ADD-ON'S FINAL ANSWER, synchronous or a queued job's stored one. */
export function addonReplyFacts(a, { routedCost = null } = {}) {
  if (!a || typeof a !== "object" || Array.isArray(a)) return { skip: "unreadable", facts: [] };
  if (a.escalate === true) return { skip: "escalate", facts: [] };
  if (typeof a.job === "string" && typeof a.poll === "string") return { skip: "receipt", facts: [] };
  if (a.ok === true && a.recovered === true) return { skip: "recovered", facts: [] };
  if (typeof a.ok !== "boolean") return { skip: "unreadable", facts: [] };
  if (technicalAnswer(a)) return { skip: "technical", facts: [] };
  const F = factList();
  if (a.ok === true) {
    const added = paths(a.added);
    const removed = paths(a.removed);
    const changed = paths(a.changed);
    if (added.length) F.add("changed", "Added " + listOf(added) + " to the site.");
    if (removed.length) F.add("changed", "Removed " + listOf(removed) + ".");
    if (changed.length) F.add("changed", "Updated " + listOf(changed) + ".");
    const tables = strings(a.tables);
    if (tables.length) F.add("changed", "The site now stores " + listOf(tables) + ".");
    const fns = strings(a.functions);
    if (fns.length) F.add("changed", "Added " + (fns.length === 1 ? "the function " : "the functions ") + listOf(fns) + ".");
    const apis = strings(a.apis);
    if (apis.length) F.add("changed", "Connected " + listOf(apis) + ".");
    const jobs = (Array.isArray(a.jobs) ? a.jobs : []).map(jobSaid).filter(Boolean);
    if (jobs.length) F.add("changed", "Scheduled " + listOf(jobs) + ".");
    const rows = (Array.isArray(a.rows) ? a.rows : []).filter((r) => r && typeof r.table === "string" && r.table);
    for (const r of rows.slice(0, 6)) {
      F.add("changed", "Added " + (typeof r.label === "string" && r.label ? quote(r.label, 120) : "an entry") + " to " + clip(r.table, 60) + (Number.isSafeInteger(r.id) ? " (entry " + r.id + ")" : "") + ".");
    }
    if (rows.length > 6) F.add("changed", "Added " + count(rows.length - 6, "more entry", "more entries") + ".");
    for (const w of (Array.isArray(a.words) ? a.words : []).slice(0, 3)) {
      if (w && typeof w.words === "string" && w.words && typeof w.page === "string" && w.page.charAt(0) === "/") F.add("changed", "Added " + quote(w.words, 140) + " to " + w.page + ".");
    }
    const placed = [...new Set((Array.isArray(a.ownPhotos) ? a.ownPhotos : []).map((p) => (p && typeof p.page === "string" && p.page.charAt(0) === "/" ? p.page : "")).filter(Boolean))];
    if (placed.length) F.add("changed", "Put one of their own photographs on " + listOf(placed) + ".");
    if (a.provisioned === true) F.add("changed", "The site has its own database now.");
    for (const fe of (Array.isArray(a.functionErrors) ? a.functionErrors : []).slice(0, 3)) {
      if (fe && typeof fe.name === "string" && fe.name) F.add("not-done", "The function " + clip(fe.name, 80) + " could not be created" + (fe.error ? ": " + clip(fe.error, 140) : "") + ".");
    }
    for (const je of (Array.isArray(a.jobErrors) ? a.jobErrors : []).slice(0, 3)) {
      if (je && typeof je.name === "string" && je.name) F.add("not-done", "The scheduled job " + clip(je.name, 80) + " could not be set up" + (je.error ? ": " + clip(je.error, 140) : "") + ", so it will not run yet.");
    }
    const secrets = strings(a.needsSecrets);
    if (secrets.length) F.add("note", "To switch it on, they add " + listOf(secrets) + " under Cloud → Secrets.");
    for (const k of ["credentialNote", "pictureNote", "coverNote", "keptPartsNote"]) { const s = said(a[k]); if (s) F.add(k === "coverNote" ? "not-done" : "note", s); }
    const frames = Number(a.photos) || 0;
    if (frames > 0) F.add("note", "There " + (frames === 1 ? "is an empty space" : "are " + frames + " empty spaces") + " for a photo; uploading their own in the Data panel fills " + (frames === 1 ? "it" : "them") + ".");
    const skipped = Array.isArray(a.skipped) ? a.skipped : [];
    if (skipped.includes("photo")) F.add("not-done", "The photograph is a separate step: asking for it on its own places it.");
    if (skipped.includes("frame")) F.add("not-done", "The new link, button or footer item is a separate step: asking for it on its own adds it to every page.");
    for (const nA of (Array.isArray(a.notAdded) ? a.notAdded : []).slice(0, 3)) {
      if (nA && typeof nA.msg === "string" && nA.msg) F.add("not-done", "Left out " + (typeof nA.name === "string" && nA.name ? quote(nA.name, 80) : "one " + clip(nA.kind || "entry", 30)) + ". The builder's own reason: " + quote(nA.msg, 300));
    }
    for (const k of (Array.isArray(a.kept) ? a.kept : []).slice(0, 3)) {
      if (!k || !k.path) continue;
      const p = pathOf(k.path) || clip(k.path, 80);
      F.add("not-done", k.why === "home"
        ? "Left " + p + ": it is the home page, and removing it would leave the site with no front door."
        : "Left " + p + ": " + listOf(paths(k.from)) + " still links to it; the link has to come out first.");
    }
    const back = paths(a.reverted).slice(0, 3);
    if (back.length) F.add("note", "Left " + listOf(back) + " as " + (back.length === 1 ? "it was" : "they were") + ": nothing there needed to change for this.");
    const unlinked = strings(a.unlinked);
    if (unlinked.length) F.add("note", "Nothing links to " + listOf(unlinked) + " yet; saying where the link should go adds it.");
    for (const p of strings(a.problems, 3)) F.add("note", "Worth knowing: " + p);
    const render = said(a.renderNote);
    if (render) F.add("note", render);
    if (!F.out.length) F.add("changed", "The addition was made.");
  } else if (a.error === "clarify") {
    F.add("nothing", "Nothing was added yet; one detail is needed first.");
  } else {
    const own = said(a.msg);
    F.add("not-done", own ? "Nothing was added. The builder's own reason: " + quote(own, 400) : "The addition did not go through.");
    for (const nA of (Array.isArray(a.notAdded) ? a.notAdded : []).slice(0, 3)) {
      if (nA && typeof nA.msg === "string" && nA.msg) F.add("not-done", "Left out " + (typeof nA.name === "string" && nA.name ? quote(nA.name, 80) : "one entry") + ". The builder's own reason: " + quote(nA.msg, 300));
    }
    if (routedCost !== null && num(routedCost) > 0) F.add("money", "Reading their message cost " + count(num(routedCost), "credit") + ".");
  }
  heldFacts(F, a, a.ok === true);
  questionFact(F, a.clarify);
  return questionOnly(F.out) ? { skip: "question-only", facts: [] } : { skip: null, facts: F.out };
}

/**
 * THE FACTS OF A ROUTING ANSWER THAT ENDS THE TURN: an answer to a question
 * that is no longer the live one, one too long to keep, a request whose answers
 * are full, a question being answered elsewhere. A question the router asks is
 * already its own words (the model's), and its note is written apart
 * (`repeatNoteFacts`); a failed routing call is ours and keeps its sentence.
 */
export function routeReplyFacts(d) {
  if (!d || typeof d !== "object" || Array.isArray(d)) return { skip: "unreadable", facts: [] };
  if (d.failed === true) return { skip: "technical", facts: [] };
  const F = factList();
  if (d.error === "stale-question") {
    F.add("not-done", d.why === "expired"
      ? "The question they were answering had expired, so their reply was not acted on."
      : "The question they were answering had already been answered or set aside, so their reply was not acted on.");
    F.add("nothing", "Nothing on their site changed, and nothing was charged.");
    F.add("note", "They can say what they would like now, and it will be taken from there.");
  } else if (d.error === "question-busy") {
    F.add("not-done", "Their last question was being answered somewhere else at the same moment, so this message was not acted on.");
    F.add("nothing", "Nothing on their site changed, and nothing was charged.");
    F.add("note", "Sending the message again picks it up from there.");
  } else if (d.error === "answer-too-long") {
    F.add("not-done", "Their answer is longer than can be kept beside the request (at most " + MAX_ANSWER_CHARS + " characters).");
    F.add("pending", "Their request is still waiting, with its question still open; answering in a sentence or two lets it go ahead.");
    F.add("nothing", "Nothing on their site changed, and nothing was charged.");
  } else if (d.error === "answers-full") {
    F.add("not-done", "Their request already carries as many answers as can be kept beside it, and every one of them is still needed, so this answer could not be added without forgetting one they gave.");
    F.add("nothing", "Nothing on their site changed, and nothing was charged.");
    F.add("pending", "Their request is still waiting; pressing Cancel on the question and sending what is left of it as a new message lets it go ahead.");
  } else {
    return { skip: "not-an-ending", facts: [] };
  }
  return { skip: null, facts: F.out };
}

/** THE FACTS OF A CANCEL: what the question route answered (`{ cancelled, why, putOff }`). */
export function cancelReplyFacts(r) {
  if (!r || typeof r !== "object" || Array.isArray(r) || typeof r.cancelled !== "boolean") return { skip: "unreadable", facts: [] };
  const F = factList();
  if (r.cancelled) {
    F.add("changed", "Their waiting request is cancelled: nothing more will be done for it.");
    F.add("nothing", "Nothing on their site changed because of it.");
    const parts = heldList(r.putOff) || [];
    for (const p of parts.slice(0, 6)) F.add("pending", "Left for later and never tried, so it is not done either: " + quote(p, 200));
  } else {
    F.add("not-done", r.why === "expired"
      ? "There was nothing to cancel: that question had already expired."
      : r.why === "missing"
        ? "There was nothing to cancel: no question is waiting on this site."
        : "There was nothing to cancel: that question had already been answered or replaced, so whatever it led to is going ahead as answered.");
  }
  return { skip: null, facts: F.out };
}

/**
 * THE FACTS OF A QUESTION ASKED AGAIN: the note above a question the router or
 * a step asked once more, after answers that did not settle it. `earlier` is
 * every answer they gave to it, oldest first; `atLimit` says that nothing will
 * be sent to a model again on its own, so only their answer or a cancel moves it.
 */
export function repeatNoteFacts({ question, earlier = [], atLimit = false } = {}) {
  const q = question && typeof question.text === "string" ? question.text.trim() : "";
  const answers = (Array.isArray(earlier) ? earlier : []).map((p) => (p && typeof p.a === "string" ? p.a.trim() : "")).filter(Boolean);
  if (!q || !answers.length) return { skip: "unreadable", facts: [] };
  const F = factList();
  F.add("note", "This question was asked before, and their " + (answers.length === 1 ? "answer, " + quote(answers[0], 160) + "," : "answers, " + listOf(answers.slice(-3).map((a) => quote(a, 120))) + ",") + " did not settle it.");
  F.add("question", "The question will be shown right under your note, with its own words: " + quote(q, 240) + ". Do not repeat it.");
  F.add("pending", atLimit
    ? "Nothing more will be done until they answer once more or cancel the request; either is fine."
    : "Their request is waiting for this one answer.");
  return { skip: null, facts: F.out };
}

// ── THE CALL ──────────────────────────────────────────────────────────────

/** What the model is shown besides the facts: their words, their answers, the site. */
export function replyContext({ request = "", answers = [], site = null } = {}) {
  const lines = [];
  const name = site && typeof site.name === "string" ? clip(site.name, 80) : "";
  const slug = site && typeof site.slug === "string" ? clip(site.slug, 80) : "";
  const pages = site && Array.isArray(site.pages) ? site.pages.filter((p) => typeof p === "string" && p.charAt(0) === "/").slice(0, 30) : [];
  if (name || slug) lines.push("THEIR SITE: " + (name || slug) + (name && slug ? " (" + slug + ")" : ""));
  if (pages.length) lines.push("ITS PAGES: " + pages.join(", "));
  const words = typeof request === "string" ? request.trim() : "";
  if (words) lines.push("WHAT THEY ASKED FOR:\n" + clip(words, 2000));
  const told = (readContext(answers) || []).slice(-12);
  if (told.length) lines.push("WHAT THEY TOLD US IN ANSWER TO EARLIER QUESTIONS:\n" + told.map((p) => "- " + quote(p.q, 200) + " → " + quote(p.a, 300)).join("\n"));
  return lines.join("\n\n");
}

/** The request one reply call sends. `missed` names the facts a first answer left out. */
export function replyRequest({ facts, context = "", model, missed = [] }) {
  const shown = facts.slice(0, MAX_FACTS);
  const cut = facts.length - shown.length;
  const body = (context ? context + "\n\n" : "") +
    "WHAT REALLY HAPPENED (explain every fact; list each id you explained in covers):\n" +
    shown.map((f) => "[" + f.id + "] " + f.text).join("\n") +
    (cut > 0 ? "\n(" + cut + " smaller details are not listed; do not mention them.)" : "") +
    (missed.length ? "\n\nYOUR LAST REPLY LEFT OUT " + missed.join(", ") + ". Explain every fact this time." : "");
  return {
    model,
    max_tokens: REPLY_MAX_TOKENS,
    tools: [REPLY_TOOL],
    tool_choice: { type: "tool", name: REPLY_TOOL.name },
    system: [{ type: "text", text: REPLY_SYSTEM }],
    messages: [{ role: "user", content: body }],
  };
}

/**
 * A reply, read and checked: the forced tool's `reply`, inside the length
 * bound, carrying no fact id in its text, with every listed fact in `covers`.
 * `{ ok, text, missing }`; `ok` false with `missing` empty is an answer that
 * could not be read at all.
 */
export function readReply(reply, facts, maxChars = REPLY_MAX_CHARS) {
  const shown = facts.slice(0, MAX_FACTS);
  const block = reply && Array.isArray(reply.content) ? reply.content.find((b) => b && b.type === "tool_use" && b.name === REPLY_TOOL.name) : null;
  const input = block && block.input && typeof block.input === "object" ? block.input : null;
  if (!input || typeof input.reply !== "string" || !Array.isArray(input.covers)) return { ok: false, text: "", missing: [] };
  const text = input.reply.replace(/\r\n/g, "\n").trim();
  if (!text || text.length > maxChars) return { ok: false, text: "", missing: [] };
  const ids = new Set(shown.map((f) => f.id));
  if ([...ids].some((id) => new RegExp("\\[" + id + "\\]").test(text))) return { ok: false, text: "", missing: [] };
  const covered = new Set(input.covers.filter((c) => typeof c === "string").map((c) => c.trim()));
  const missing = shown.map((f) => f.id).filter((id) => !covered.has(id));
  return { ok: missing.length === 0, text, missing };
}

/** The four token kinds, in the shape `pageCredits` prices (the router's `askUsage`). */
export function replyUsage(reply, model) {
  const u = (reply && reply.usage) || {};
  return {
    in: Number(u.input_tokens) || 0,
    out: Number(u.output_tokens) || 0,
    cacheRead: Number(u.cache_read_input_tokens) || 0,
    cacheWrite: Number(u.cache_creation_input_tokens) || 0,
    model,
  };
}

/**
 * WRITE ONE REPLY. Never throws. `{ ok: true, text, usage, attempts }`, or
 * `{ ok: false, why, usage, attempts }` — `why` one of `no-facts`, `send`,
 * `deadline`, `unreadable`, `uncovered`. At most two calls: a first answer
 * that left a fact out is asked once more, naming what it missed.
 */
export async function writeReply(deps, { facts, context = "", model, deadlineMs = REPLY_DEADLINE_MS, maxChars = REPLY_MAX_CHARS, now = () => Date.now() } = {}) {
  const usage = [];
  if (!Array.isArray(facts) || !facts.length) return { ok: false, why: "no-facts", usage, attempts: 0 };
  if (!deps || typeof deps.send !== "function") return { ok: false, why: "send", usage, attempts: 0 };
  const start = now();
  let missed = [];
  let attempts = 0;
  let why = "unreadable";
  while (attempts < 2) {
    const left = deadlineMs - (now() - start);
    if (left <= 0) return { ok: false, why: "deadline", usage, attempts };
    attempts++;
    let timer;
    let reply;
    try {
      reply = await Promise.race([
        Promise.resolve().then(() => deps.send(replyRequest({ facts, context, model, missed }))),
        new Promise((_, no) => { timer = setTimeout(() => no(Object.assign(new Error("reply deadline"), { deadline: true })), left); }),
      ]);
    } catch (e) {
      return { ok: false, why: e && e.deadline ? "deadline" : "send", usage, attempts };
    } finally {
      if (timer) clearTimeout(timer);
    }
    usage.push(replyUsage(reply, model));
    const read = readReply(reply, facts, maxChars);
    if (read.ok) return { ok: true, text: read.text, usage, attempts };
    if (!read.missing.length) { why = "unreadable"; break; }
    missed = read.missing;
    why = "uncovered";
  }
  return { ok: false, why, usage, attempts };
}

/** The answer with the reply on it, as one new object: every field kept, `reply` and `replySource` added. */
export function withReplyText(body, text) {
  return { ...body, reply: text, replySource: REPLY_SOURCE };
}
