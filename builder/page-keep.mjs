// WHAT A PAGE REWRITE MAY NOT LOSE ON ITS WAY PAST (2026-09-24).
//
// Owner, after reproducing it through the edit route: a narrow change — "show
// the opening hours as a short list" — came back from the full page writer with
// an unrelated section left out, and the route published it and said "✅
// Updated /.". Nothing between the writer's answer and the publish compared
// what the page had with what it was about to have.
//
// THIS MODULE IS THAT COMPARISON, AND IT IS DELIBERATELY NARROW. Two things on
// a page can be read reliably enough to refuse on: an in-body link with a
// literal destination (`linkSlots`), and one of the site's OWN components the
// page renders (`partUses`). Run 11 is why it stops there — a correct,
// requested consolidation took `<section>` from 15 to 13, so any block-level
// rule would have refused a real, correct edit. A section of plain words or
// kit-only markup is NOT covered, and the file says so wherever it matters.
//
// THE FACTS ARE CODE'S AND THE INTENT IS THE CUSTOMER'S OWN WORDS, AND THE TWO
// NEVER MIX. Code computes exactly what the rewrite lost. Whether the message
// asked for each loss is asked of a small model call — made ONLY when
// something was lost — which must QUOTE the words that ask for it, item by
// item. Code then checks each quote: the words really occur in the message,
// and EITHER they name the item they are attached to, OR the judge says they
// ask for a whole GROUP ("links", "sections") and the item is of a kind that
// group can hold (`KEEP_GROUPS`).
//
// ⚠ NONE OF THAT PROVES INTENT (owner: *"Quote presence and word overlap are
// not proof of intent"*). A verified quote establishes that the words occur in
// the request; a shared naming word, that they refer to the item by something
// it is called; a group of the right kind, that a group claim is not being
// stretched over a different kind of thing. Whether those words AUTHORISE that
// particular loss is still the model's judgement. "Keep the order form"
// contains the words "order form" and quotes perfectly — the rule tells the
// model a request to keep something is not a request to remove it, and nothing
// in code can check that it listened. So this is a narrowing of what can slip
// through, never a guarantee, and every test that supplies the model's answer
// proves the path and not the judgement. And because a check can fail on a
// message that really did ask, a check's refusal is never told to the customer
// as "your message didn't ask" — see `keepWithheldMsg`.

import { linkSlots } from "./site-nav.mjs";
import { localParts, partUses, partBindings, drawsTag, tagAt } from "./site-files.mjs";
import { modelsFor } from "./build-models.mjs";

/** The picker's quick model by default — every small call follows the picker. */
export const KEEP_MODEL = modelsFor().quick;

/** A verdict per item is a few words; far under the smallest model's ceiling. */
export const KEEP_MAX_TOKENS = 1024;

/** Enough of the message to judge it by, the same bound the tweak rung sends. */
const MAX_MESSAGE = 2000;

/** How many items a refusal names before it counts the rest. */
const MAX_SAID = 3;

// ─────────────────────────────────────────────────────────────────────────────
// WHERE ON THE PAGE A THING SAT
// ─────────────────────────────────────────────────────────────────────────────

/** Comments blanked, offsets preserved — the same shape `linkSlots` scans. */
function blankComments(s) {
  return String(s).replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));
}

const HEADING = /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]\s*>|<[A-Z][\w.]*\b[^>]*?\b(?:title|heading)\s*=\s*"([^"]{1,120})"/g;

/**
 * THE HEADING A POSITION SITS UNDER — the nearest `<h1>`–`<h6>`, or a
 * component's literal `title=`/`heading=` prop, above it and after the last
 * `</section>` before it. `""` when there is none.
 *
 * A DESCRIPTION, NEVER A PERMISSION AND NEVER A GROUPING. It tells the judge
 * and the customer which part of the page an item was in, and it lets the
 * pairing below prefer a partner from the same part of the page. Nothing is
 * allowed or refused because of a heading alone.
 *
 * The `</section>` cut is what stops a link in a section with no heading of
 * its own from borrowing the previous section's.
 */
export function headingAt(src, at) {
  const upto = blankComments(src).slice(0, Math.max(0, Number(at) || 0));
  const cut = upto.lastIndexOf("</section");
  const region = cut >= 0 ? upto.slice(cut) : upto;
  let best = "";
  HEADING.lastIndex = 0;
  for (const m of region.matchAll(HEADING)) {
    const raw = m[1] != null ? m[1].replace(/<[^>]*>/g, " ").replace(/\{[^}]*\}/g, " ") : m[2];
    const text = String(raw).replace(/\s+/g, " ").trim();
    if (text) best = text;
  }
  return best.slice(0, 80);
}

// ─────────────────────────────────────────────────────────────────────────────
// LINKS, PAIRED BY IDENTITY — NEVER COUNTED
// ─────────────────────────────────────────────────────────────────────────────

function linksOf(src) {
  return linkSlots([{ path: "page.tsx", source: String(src == null ? "" : src) }])
    .map((l) => ({ label: l.label, href: l.href, at: l.at, section: headingAt(src, l.at) }));
}

/**
 * WHAT HAPPENED TO EVERY LINK THE PAGE HAD — `{kept, retargeted, relabeled,
 * lost, added}`.
 *
 * ⚠ EXACT IDENTITY FIRST, ACROSS BOTH WHOLE INVENTORIES, BEFORE ANY LOOSER
 * PAIRING (owner: *"Match exact link identities across the inventories before
 * considering retargets or relabels"*). A link whose words and destination
 * both survive anywhere on the page is kept, wherever it moved — so a reorder
 * pairs every link with itself and manufactures nothing.
 *
 * EACH RULE RUNS TWICE: first only between links under the same heading, then
 * anywhere. That is what keeps a REPEATED label honest. Two "Book now → /book"
 * links, one per section, one section removed: the survivor pairs with its own
 * section's link first, so the loss is reported in the section that really
 * lost it — and a loss reported in the wrong section is one the judge would
 * rightly say nobody asked for.
 *
 *   exact      same words, same destination            → kept
 *   retarget   same (non-empty) words, new destination → RETARGETED, judged
 *   relabel    same destination, new words             → kept (words are
 *                                                         text, which this
 *                                                         does not protect)
 *   leftover   a link before with no partner           → LOST, judged
 *              a link after with no partner            → added, which never
 *                                                         offsets a loss
 *
 * A WORDLESS LINK PAIRS BY DESTINATION ALONE: the retarget rule needs words to
 * recognise a link by, so an empty label can only be kept or lost.
 *
 * ⚠ A LIMIT, STATED: two links that keep their words and SWAP destinations
 * read as two links that moved, because each identity still exists somewhere
 * — the price of matching exact identity across the whole page first.
 */
export function pairLinks(before, after) {
  const b = linksOf(before), a = linksOf(after);
  const open = b.map(() => true);
  const used = new Set();
  const kept = [], retargeted = [], relabeled = [];
  const pass = (fits, onPair) => {
    b.forEach((l, i) => {
      if (!open[i]) return;
      const k = a.findIndex((x, j) => !used.has(j) && fits(l, x));
      if (k < 0) return;
      used.add(k);
      open[i] = false;
      onPair(l, a[k]);
    });
  };
  const here = (l, x) => l.section === x.section;
  const exact = (l, x) => l.label === x.label && l.href === x.href;
  const words = (l, x) => !!l.label && l.label === x.label && l.href !== x.href;
  const place = (l, x) => l.href === x.href;
  const keep = (l) => kept.push(l);
  const moved = (l, x) => retargeted.push({ label: l.label, href: l.href, to: x.href, section: l.section });
  const reworded = (l, x) => relabeled.push({ label: l.label, to: x.label, href: l.href, section: l.section });
  pass((l, x) => exact(l, x) && here(l, x), keep);
  pass(exact, keep);
  pass((l, x) => words(l, x) && here(l, x), moved);
  pass(words, moved);
  pass((l, x) => place(l, x) && here(l, x), reworded);
  pass(place, reworded);
  const lost = b.filter((_, i) => open[i]).map((l) => ({ label: l.label, href: l.href, section: l.section }));
  const added = a.filter((_, j) => !used.has(j)).map((x) => ({ label: x.label, href: x.href, section: x.section }));
  return { kept, retargeted, relabeled, lost, added };
}

// ─────────────────────────────────────────────────────────────────────────────
// THE SITE'S OWN COMPONENTS — CONFIRMED ABSENT IS NOT UNCERTAIN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * WHAT HAPPENED TO EVERY COMPONENT OF THE SITE'S OWN THE PAGE RENDERED —
 * `{gone, unsure}`, and the two never mix.
 *
 * THE LIST COMES FROM THE BEFORE'S IMPORTS, so a writer that deletes the
 * import line cannot take the component out of the question. Only what the
 * before PROVABLY showed is protected:
 *
 *   before     after                                     reading
 *   rendered   rendered                                  kept
 *   rendered   unused — imported, never drawn or named   GONE (confirmed)
 *   rendered   none, and no tag its old import bound     GONE (confirmed)
 *   rendered   unsure — named, not provably drawn        UNSURE
 *   rendered   none, but its old tag is still drawn      UNSURE
 *   unsure     anything but rendered                     UNSURE — never
 *                                                        confirmed shown
 *
 * AN UNSURE READING NEVER REFUSES AND IS NEVER COUNTED AS KEPT. It is reported
 * so a customer can look, because silence would let "✅ Updated /." stand over
 * something this check could not see.
 */
export function partStates(before, after, { inPart = false } = {}) {
  const src0 = String(before == null ? "" : before), src1 = String(after == null ? "" : after);
  const names = [...new Set(localParts(src0, inPart).map((p) => p.name))];
  const was = partUses(src0, names, inPart), now = partUses(src1, names, inPart);
  const gone = [], unsure = [];
  for (const name of names) {
    const b = was.get(name) || "none", a = now.get(name) || "none";
    const bound = partBindings(src0, name, inPart);
    const at = Array.isArray(bound) ? tagAt(src0, bound) : -1;
    const section = at >= 0 ? headingAt(src0, at) : "";
    const one = (how) => ({ name, section, how });
    if (b === "rendered") {
      if (a === "rendered") continue;
      if (a === "unused") { gone.push(one("import-kept")); continue; }
      if (a === "none") {
        if (Array.isArray(bound) && bound.length && !drawsTag(src1, bound)) gone.push(one("import-removed"));
        else unsure.push(one("tag-without-import"));
        continue;
      }
      unsure.push(one("not-provably-drawn"));
      continue;
    }
    if (b === "unsure" && a !== "rendered") unsure.push(one("never-confirmed"));
  }
  return { gone, unsure };
}

// ─────────────────────────────────────────────────────────────────────────────
// THE INVENTORY: WHAT NEEDS A JUDGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/** `look.tsx`'s declarations as name → what the component does. */
export function declaredDoes(tsx) {
  const out = new Map();
  for (const t of Array.isArray(tsx) ? tsx : []) {
    if (t && typeof t.name === "string" && typeof t.does === "string" && t.does.trim()) out.set(t.name.trim(), t.does.trim().slice(0, 160));
  }
  return out;
}

/**
 * EVERY LOSS THE MESSAGE HAS TO ANSWER FOR — `{items, unsure, relabeled,
 * added}`. `items` is what the judge is asked about, numbered from 1 in this
 * order: links lost, links re-pointed, components gone.
 */
export function keepInventory(before, after, { does, inPart = false } = {}) {
  const said = does instanceof Map ? does : declaredDoes(does);
  const links = pairLinks(before, after);
  const parts = partStates(before, after, { inPart });
  const items = [
    ...links.lost.map((l) => ({ kind: "link-lost", label: l.label, href: l.href, section: l.section })),
    ...links.retargeted.map((l) => ({ kind: "link-moved", label: l.label, href: l.href, to: l.to, section: l.section })),
    ...parts.gone.map((p) => ({ kind: "part-gone", name: p.name, does: said.get(p.name) || "", section: p.section, how: p.how })),
  ];
  const unsure = parts.unsure.map((p) => ({ name: p.name, does: said.get(p.name) || "", section: p.section, how: p.how }));
  return { items, unsure, relabeled: links.relabeled, added: links.added };
}

// ─────────────────────────────────────────────────────────────────────────────
// THE QUOTE: IN THE MESSAGE, AND ABOUT THE ITEM
// ─────────────────────────────────────────────────────────────────────────────

/** Case, whitespace and punctuation (quote marks included) folded away. */
function fold(s) {
  return String(s == null ? "" : s).normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/**
 * ARE THESE WORDS REALLY IN THE MESSAGE — whole words, in order, after folding
 * case, whitespace and punctuation. A quote must hold a word of three letters
 * or more, so "a" or "on" cannot pass by occurring everywhere.
 */
export function quoteInMessage(message, quote) {
  const q = fold(quote);
  if (!q || !/\p{L}{3,}/u.test(q)) return false;
  return (" " + fold(message) + " ").includes(" " + q + " ");
}

// Words that name no item: grammar, the page's own furniture, and the verbs a
// request is phrased in. Short and generic on purpose — nothing here is a word
// a business would name a section, a link or a form by.
const STOP = new Set([
  "the", "and", "for", "with", "from", "into", "onto", "this", "that", "these", "those", "then", "than",
  "there", "here", "your", "our", "their", "its", "you", "all", "any", "off", "out", "not", "but", "are",
  "was", "were", "has", "have", "had", "can", "could", "will", "would", "should", "just", "also", "only",
  "please", "page", "home", "site", "website", "section", "link", "button", "part", "bit", "one", "some",
  "more", "less", "other", "same", "new", "old", "instead", "over", "under", "above", "below", "top",
  "bottom", "way", "via", "take", "remove", "make", "change", "put", "add", "show", "send", "move", "keep",
  "get", "see", "let", "use", "give", "http", "https", "www", "com", "org", "net", "html", "mailto", "tel", "index",
]);

/** One trailing plural `s` off, so "directions" and "direction" meet. */
const stem = (w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);

function naming(s) {
  return fold(s).split(" ").filter((w) => w.length >= 3 && /\p{L}/u.test(w)).map(stem).filter((w) => !STOP.has(w));
}

/**
 * THE WORDS AN ITEM CAN BE NAMED BY: its link words, the heading it sat
 * under, its destination (and new destination), and for a component its name
 * and what it was declared to do.
 */
export function itemTerms(item) {
  const it = item || {};
  const name = typeof it.name === "string" ? it.name.replace(/[-_]+/g, " ") : "";
  return new Set([it.label, it.section, it.does, name, it.href, it.to].flatMap(naming));
}

/**
 * DO THESE WORDS NAME THIS ITEM — a naming word shared between the quote and
 * the item. This is what refuses a GENUINE quote attached to the WRONG item:
 * *"Take the "Find us" section off"* really is in the message, and it names
 * the "Find us" section — so it can answer for the Directions link that sat
 * there and cannot answer for the order form under "Order ahead".
 *
 * ⚠ A HEURISTIC, WITH ITS COST STATED. A paraphrase that shares no word with
 * the item's words, heading or destination — "the map link" for a link that
 * says "Directions" — is refused, and the refusal tells the customer how to
 * say it. An item with no naming words at all (a wordless link to "/" under no
 * heading) cannot be checked this way and is left to the judge alone.
 *
 * ⚠ AND IT IS ONE OF TWO WAYS A QUOTE CAN COVER AN ITEM, NEVER THE ONLY ONE
 * (owner, 2026-09-24). Made mandatory, it refused *"Remove all links from the
 * home page"* for both of the page's links — a clear request about a GROUP
 * cannot name each member, and the customer was told their message had not
 * asked. A group the judge declares is the other way in (`groupCovers`).
 */
export function quoteNamesItem(quote, item) {
  const terms = itemTerms(item);
  if (!terms.size) return true;
  return naming(quote).some((w) => terms.has(w));
}

// ─────────────────────────────────────────────────────────────────────────────
// A GROUP ASKED FOR AT ONCE — DECLARED BY THE JUDGE, CHECKED BY KIND
// ─────────────────────────────────────────────────────────────────────────────

/**
 * THE GROUPS A MESSAGE CAN ASK FOR WHOLE, and the kinds of item each can hold.
 *
 *   links      every link — gone, or pointed somewhere else
 *   sections   the site's own sections, and the links that were inside them:
 *              a section taken off takes its links with it
 *
 * WHICH GROUP A QUOTE ASKS FOR IS THE JUDGE'S READING, NOT CODE'S. Deciding it
 * here would mean reading English — *"all the links"*, *"every button"*,
 * *"everything below the hours"* — and a keyword list for that only ever
 * grows. So the judge DECLARES the group on each item it answers that way,
 * and code checks the one thing it can know without reading English: the item
 * is a KIND that group can hold. That is what stops a group being stretched
 * over something it does not contain — *"Remove all links"* declared as the
 * links group cannot answer for the order form, which is a section. The kinds
 * are the inventory's own, so nothing here is a word list.
 *
 * ⚠ STILL JUDGED ITEM BY ITEM. A group is not a blanket: every item needs its
 * own answer, so *"all the links except Directions"* is a group answer for the
 * links it covers and a plain no for Directions. Code cannot read the
 * *"except"* — a judge that counts Directions in anyway is believed, exactly as
 * a judge that misreads *"keep the order form"* is.
 *
 * ⚠ AND THE CONTAINMENT RUNS ONE WAY. A section holds links, so a sections
 * group may answer for a link that is gone; a link holds no section. Which
 * links were really inside the sections that went is the judge's reading too.
 */
export const KEEP_GROUPS = Object.freeze({
  links: Object.freeze(["link-lost", "link-moved"]),
  sections: Object.freeze(["part-gone", "link-lost"]),
});

/**
 * DOES A GROUP THE JUDGE DECLARED HOLD THIS KIND OF ITEM — `true`, or the
 * reason it does not: `unknown-group` (not one of `KEEP_GROUPS`) or
 * `group-other-kind` (a group that cannot hold this kind of thing).
 */
export function groupCovers(group, item) {
  const kinds = typeof group === "string" && Object.hasOwn(KEEP_GROUPS, group) ? KEEP_GROUPS[group] : null;
  if (!kinds) return "unknown-group";
  return kinds.includes(item && item.kind) ? true : "group-other-kind";
}

// ─────────────────────────────────────────────────────────────────────────────
// THE JUDGE: ONE SMALL CALL, MADE ONLY WHEN SOMETHING WAS LOST
// ─────────────────────────────────────────────────────────────────────────────

export const KEEP_TOOL = {
  name: "keep_check",
  description: "For every numbered item, say whether the customer's message itself asks for it.",
  input_schema: {
    type: "object",
    properties: {
      answers: {
        type: "array",
        description: "One entry for every numbered item.",
        items: {
          type: "object",
          properties: {
            n: { type: "integer", description: "The item's number." },
            asked: {
              type: "boolean",
              description: "true ONLY when the message itself asks for this item — by naming it, or as one of a group it asks for.",
            },
            quote: {
              type: "string",
              description: "When asked is true: the exact words, copied from the message, that ask for this item or for the group it belongs to. Otherwise leave it empty.",
            },
            group: {
              type: "string",
              enum: Object.keys(KEEP_GROUPS),
              description: "Only when quote asks for a whole group rather than naming this item: \"links\" when the words ask for the links, \"sections\" when they ask for the sections. Leave it out when the words name this item itself.",
            },
          },
          required: ["n", "asked"],
        },
      },
    },
    required: ["answers"],
  },
};

export const KEEP_RULES =
  "A customer sent one message asking for a change to one page of their website. The page was rewritten, and " +
  "the rewrite also lost or changed the items listed below. Your only job is to say, for EACH item, whether the " +
  "customer's message itself asks for THAT item to go, or to change that way.\n\n" +
  "Answer every item by its number. asked: true ONLY when the message asks for that particular item — and then " +
  "copy into quote the exact words from the message that ask for it. Otherwise asked: false, with no quote.\n\n" +
  "How to read the message:\n" +
  "- Asking to remove a section asks for what was inside that section; each item says which heading it sat under.\n" +
  "- A message can ask for a whole group at once instead of naming each thing — \"remove all the links\", \"take " +
  "off every section except the hours\". Each item in that group is asked for: answer it asked: true, copy the " +
  "words that ask for the group into quote, and set group to what those words ask for — \"links\" or " +
  "\"sections\". Leave group out when the words name the item itself.\n" +
  "- A group is still answered item by item. Anything the message leaves out of its group (\"all the links " +
  "except Directions\") is not asked for.\n" +
  "- A group asks only for what it names. Asking for every link does not ask for any section; asking for the " +
  "sections asks for the links inside them, and for no link anywhere else.\n" +
  "- Asking for one thing never asks for anything else. A message about the opening hours does not ask for a link " +
  "or a form to go.\n" +
  "- A message that asks to KEEP something, or only mentions it, does not ask for it to go.\n" +
  "- Asking to point a link somewhere else asks for that link's new destination, not for it to be removed.\n" +
  "- When you are not sure, answer asked: false. A wrong false costs the customer one more sentence; a wrong true " +
  "loses part of their site.";

function describe(it, i) {
  const n = i + 1;
  const under = it.section ? ", under the heading “" + it.section + "”" : "";
  if (it.kind === "link-moved") {
    return n + ". A link that now goes somewhere else — its words “" + it.label + "”, it went to " + it.href +
      " and now goes to " + it.to + under + ".";
  }
  if (it.kind === "part-gone") {
    return n + ". One of the site's own sections, no longer on the page — the component “" + it.name + "”" +
      (it.does ? ", which is " + it.does : "") + under + ".";
  }
  return n + ". A link that is no longer on the page — " + (it.label ? "its words “" + it.label + "”, " : "it had no words, ") +
    "it went to " + it.href + under + ".";
}

/** The request, in the shape `callBuilderModel` sends. */
export function keepRequest({ message, items, model = KEEP_MODEL }) {
  const msg = String(message == null ? "" : message).trim().slice(0, MAX_MESSAGE);
  return {
    model,
    max_tokens: KEEP_MAX_TOKENS,
    system: KEEP_RULES,
    tools: [KEEP_TOOL],
    tool_choice: { type: "tool", name: KEEP_TOOL.name },
    messages: [{
      role: "user",
      content: "THE CUSTOMER'S MESSAGE, word for word:\n" + msg +
        "\n\nWHAT THE REWRITE LOST OR CHANGED:\n" + (Array.isArray(items) ? items : []).map(describe).join("\n"),
    }],
  };
}

/** What this call cost, in the shape the ledger prices. */
export function keepUsage(reply, model = KEEP_MODEL) {
  const u = reply && reply.usage;
  if (!u) return null;
  return {
    model,
    in: u.input_tokens || 0,
    out: u.output_tokens || 0,
    cacheRead: u.cache_read_input_tokens || 0,
    cacheWrite: u.cache_creation_input_tokens || 0,
  };
}

/**
 * THE JUDGE'S ANSWER, READ — `{ok: true, asked, unasked}`, or `{ok: false,
 * why}` when there is no answer to read at all.
 *
 * FAILS CLOSED AT EVERY STEP. An item the answer leaves out, one answered
 * twice in disagreement, an `asked` that is not the boolean `true`, a quote
 * missing, a quote not in the message, and a quote that neither names its item
 * nor comes with a declared group that can hold it are all NOT ASKED — each
 * with its own reason, so a refusal can be audited. Only a reply with no
 * readable list is `ok: false`, which is ours and is said differently: the
 * loss may have been asked for, and we could not tell.
 *
 * A DECLARED GROUP IS AN ALTERNATIVE TO NAMING, NEVER A REPLACEMENT FOR IT: a
 * quote that names its item is accepted with or without a group, so a judge
 * that labels a named request as a group costs nothing, and only the quotes
 * that name nothing depend on the group being one that can hold the item. A
 * `group` that is not a string is not read at all — never coerced.
 */
export function readKeep(reply, { message, items }) {
  const list = Array.isArray(items) ? items : [];
  const block = (reply && Array.isArray(reply.content) ? reply.content : [])
    .find((c) => c && c.type === "tool_use" && c.name === KEEP_TOOL.name);
  const answers = block && block.input && block.input.answers;
  if (!Array.isArray(answers)) return { ok: false, why: "no-answer" };
  const byN = new Map();
  const clash = new Set();
  for (const a of answers) {
    if (!a || typeof a !== "object" || !Number.isInteger(a.n) || a.n < 1 || a.n > list.length) continue;
    const said = {
      asked: a.asked === true,
      quote: typeof a.quote === "string" ? a.quote : "",
      group: typeof a.group === "string" ? a.group.trim() : "",
    };
    const prev = byN.get(a.n);
    if (!prev) { byN.set(a.n, said); continue; }
    if (prev.asked !== said.asked) clash.add(a.n);
    else if (!prev.quote && said.quote) byN.set(a.n, said);
  }
  const asked = [], unasked = [];
  list.forEach((it, i) => {
    const s = byN.get(i + 1);
    let why = "";
    if (!s) why = "unanswered";
    else if (clash.has(i + 1)) why = "conflicting";
    else if (!s.asked) why = "not-asked";
    else if (!s.quote.trim()) why = "no-quote";
    else if (!quoteInMessage(message, s.quote)) why = "quote-not-in-message";
    else if (!quoteNamesItem(s.quote, it)) {
      const g = s.group ? groupCovers(s.group, it) : "quote-not-about-item";
      if (g !== true) why = g;
    }
    const out = { ...it, quote: s ? s.quote : "", ...(s && s.group ? { group: s.group } : {}) };
    if (why) unasked.push({ ...out, why }); else asked.push(out);
  });
  return { ok: true, asked, unasked };
}

/**
 * THE WHOLE CHECK — one inventory, and one judge call when it found anything.
 *
 *   kept       nothing was lost: no call, nothing to bill
 *   asked      every loss was asked for: publish, and bill the call
 *   withheld   something was not asked for: refuse, nothing published
 *   unchecked  the call failed or could not be read: refuse, ours
 *
 * `unsure` rides beside every verdict, because an uncertain component is
 * neither a loss to refuse nor something kept.
 */
export async function keepCheck({ message, before, after, does, inPart = false, send, model = KEEP_MODEL }) {
  const inv = keepInventory(before, after, { does, inPart });
  if (!inv.items.length) return { verdict: "kept", items: [], unsure: inv.unsure, usage: null };
  let reply = null;
  try {
    reply = await send(keepRequest({ message, items: inv.items, model }));
  } catch (e) {
    return { verdict: "unchecked", why: "send", items: inv.items, unsure: inv.unsure, usage: null, error: e };
  }
  const usage = keepUsage(reply, model);
  const read = readKeep(reply, { message, items: inv.items });
  if (!read.ok) return { verdict: "unchecked", why: read.why, items: inv.items, unsure: inv.unsure, usage };
  if (read.unasked.length) {
    return { verdict: "withheld", items: inv.items, asked: read.asked, unasked: read.unasked, unsure: inv.unsure, usage };
  }
  return { verdict: "asked", items: inv.items, asked: read.asked, unasked: [], unsure: inv.unsure, usage };
}

// ─────────────────────────────────────────────────────────────────────────────
// WHAT THE CUSTOMER IS TOLD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A COMPONENT IN THE CUSTOMER'S WORDS — the heading it sat under, else what it
 * was declared to do, else a plain description. Never a file name: `order-form`
 * is a name the designer coined.
 */
export function partPhrase(it) {
  if (it && it.section) return "the “" + it.section + "” section";
  const d = it && typeof it.does === "string" ? it.does.trim().replace(/^(the|a|an)\s+/i, "") : "";
  if (d) return "the " + d;
  return "one of your page’s own sections";
}

function linkPhrase(it) {
  const words = it.label ? "the “" + it.label + "” link" : "the link to " + it.href;
  return it.label && it.section ? words + " under “" + it.section + "”" : words;
}

function listOf(xs) {
  const shown = xs.slice(0, MAX_SAID);
  const rest = xs.length - shown.length;
  const head = shown.length > 1 ? shown.slice(0, -1).join(", ") + " and " + shown[shown.length - 1] : shown[0] || "";
  return rest > 0 ? shown.join(", ") + " and " + rest + " more" : head;
}

/**
 * THE REFUSAL, SCOPED TO THIS RUNG. It says what this change would also have
 * done and that it was not made — and stops there. "Nothing on your site
 * changed" and "you haven't been charged" are claims about the whole request,
 * which the browser adds on the one branch that can see the whole request
 * refused (`withheldPhotosMsg`'s rule, one protection over).
 *
 * ⚠ THE CLAIM IS ONLY AS STRONG AS WHAT MADE IT (owner, 2026-09-24: *"The
 * customer is incorrectly told the message didn't ask to remove those
 * links"*). "Which your message didn't ask for" is the JUDGE'S reading, so it
 * is said only when the judge answered no to every item listed. Anything else
 * — the judge said yes and a check could not confirm it, or left an item out,
 * or contradicted itself — is a refusal the message may not deserve, and the
 * sentence says only that it could not be confirmed. The weaker clause is true
 * of every item either way, which is why a mixed list takes it.
 */
export function keepWithheldMsg(unasked) {
  const xs = Array.isArray(unasked) ? unasked : [];
  const off = xs.filter((it) => it.kind !== "link-moved").map((it) => (it.kind === "part-gone" ? partPhrase(it) : linkPhrase(it)));
  const moved = xs.filter((it) => it.kind === "link-moved")
    .map((it) => (it.label ? "the “" + it.label + "” link" : "a link") + " at " + it.to + " instead of " + it.href);
  const acts = [];
  if (off.length) acts.push("taking " + listOf(off) + " off the page");
  if (moved.length) acts.push("pointing " + listOf(moved));
  const many = xs.length > 1;
  const judgedNo = xs.length > 0 && xs.every((it) => it.why === "not-asked");
  return "I couldn't make that change without also " + acts.join(", and ") +
    (judgedNo ? ", which your message didn't ask for" : ", which I couldn't confirm your message asked for") +
    " — so I didn't make it. If you do want " +
    (many ? "those changes" : "that change") + ", say so in your message and send it again.";
}

/** The check could not be made. Fail closed, and say whose failure it was. */
export const KEEP_UNCHECKED_MSG =
  "I couldn't check that the rewrite kept everything you didn't ask to change, so I didn't make it — this is on us. Try again in a moment.";

/** The uncertain components, as the phrases the screen names them by. */
export function unsurePhrases(unsure) {
  return (Array.isArray(unsure) ? unsure : []).map(partPhrase).slice(0, 6);
}
