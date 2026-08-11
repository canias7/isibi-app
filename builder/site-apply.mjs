// The edit lane: change what the site already has, and nothing else.
//
// WHAT THIS IS FOR. Until it existed there was one work lane, and every change
// to a live site re-entered at the top of it: designer, all pages regenerated,
// container, republish, ~25 credits. "Change the phone number in the header" and
// "build me a barber shop" ran the identical ten steps, and the bill was almost
// entirely the pages step — ~23 credits of output tokens re-emitting five pages
// that did not change.
//
// THE PROTECTION IS THAT THE STEPS ARE ABSENT, NOT THAT A RULE FORBIDS THEM.
// Nothing in this module can reach `applySiteSchema`, `seedSiteRows` or the page
// generator, so "an edit never touches the database" is a property of the lane
// rather than an instruction somebody has to remember. That is the same argument
// `site-rls.mjs` makes about a `collect` table having no SELECT policy: an
// omission cannot be weakened by putting a filter in the wrong clause.
//
// TWO OF THE THREE LAYERS NEED NO PAGE MODEL CALL AT ALL, and that is the whole
// saving rather than a detail:
//
//   text — the words are lifted out of the stored source by `site-text.mjs`,
//          a cheap model picks which ones change, and they go back at the exact
//          offsets they came from. No page is rewritten.
//   look — the designer already knows how to move theme, family, fonts, corners
//          and colours WITHOUT touching a page (site-edit.mjs, absent means
//          unchanged), and `recompileAndPublish` reads the look out of `_meta`
//          rather than being handed it. So the whole layer is: decide, store,
//          recompile. Not one page goes through a model.
//   page — one page's source through the page model, instead of all of them.
//
// Plain module with its side effects injected, like `site-ask.mjs` and
// `publish-pages.mjs`, so every decision here is tested with no network, no
// container and no Worker.

import { extractText, applyEdits } from "./site-text.mjs";

/** Haiku. Choosing which of a list of strings to change is not a design task. */
export const TEXT_MODEL = "claude-haiku-4-5";

/**
 * Enough for a handful of replacements and not enough for an essay.
 *
 * The model returns short strings and an id each, so this is generous. Output
 * bills at 5x input; a text edit that wanted more than this is not a text edit.
 */
export const TEXT_MAX_TOKENS = 1500;

/**
 * HOW MANY STRINGS THE MODEL IS EVEN SHOWN.
 *
 * A five-page site offers a few hundred. The cap is on the INPUT because that is
 * what is paid for on every text edit, and the strings are offered in source
 * order so what gets dropped is the tail of the longest page rather than an
 * arbitrary scatter. A change that needed a string past the cap comes back as
 * "nothing matched", which escalates — the honest outcome, and not a silent miss.
 */
export const MAX_TEXT_ITEMS = 400;

/** One replacement. Matches `site-text.mjs`'s own ceiling on a label. */
export const MAX_TEXT_CHARS = 400;

export const TEXT_TOOL = {
  name: "write_text_edits",
  description: "Choose which of the numbered pieces of text on this site should change, and what each should say instead.",
  input_schema: {
    type: "object",
    properties: {
      edits: {
        type: "array",
        description:
          "One entry per piece of text that this change actually alters. LEAVE OUT everything the change does not " +
          "mention — an entry that puts back what is already there costs the customer a rebuild for nothing, and an " +
          "entry that rewords something nobody asked about is the exact failure this lane exists to prevent.\n" +
          "IF THE SAME THING APPEARS ON SEVERAL PAGES — a phone number in a footer, a business name in a header — " +
          "change EVERY one of them. Half-applied is worse than not applied, because the site then disagrees with itself.\n" +
          "If nothing in the list is what they meant, return an empty array rather than guessing at the nearest thing.",
        items: {
          type: "object",
          properties: {
            id: {
              type: "integer",
              description: "The number printed beside the text in the list below. Never invent one.",
            },
            to: {
              type: "string",
              description:
                "What that text should say instead. Plain words only: no quotes, no braces, no angle brackets and no " +
                "backslashes — this is written straight into the page's source, where any of those stops the site " +
                "compiling. Keep it about as long as what it replaces; a heading that triples in length breaks the layout.",
            },
          },
          required: ["id", "to"],
        },
      },
    },
    required: ["edits"],
  },
};

const SYSTEM =
  "You change the wording on a small business's published website. You are given every piece of text on it, numbered, " +
  "and one instruction from the owner. Say which numbers change and what they should say.\n\n" +
  "CHANGE ONLY WHAT THEY ASKED FOR. This is the entire job. The owner asked for one thing; everything else on their " +
  "site is there because they wanted it, and improving it while you are in there is not a favour — they cannot see " +
  "what you touched, and the next thing they notice is that a heading they liked is gone.\n\n" +
  "You are not writing copy. If they say what the new text is, use their words exactly, including their spelling and " +
  "capitalisation. Only write something yourself when they describe a change rather than dictating one, and then " +
  "match the voice of the text around it.\n\n" +
  "Some pieces of text are labels, some are headings, some are whole sentences. Length matters: a button that says " +
  "\"Book\" cannot become a sentence, and a heading that doubles in length wraps badly on a phone.";

/**
 * The one definition of the text-edit call.
 *
 * Extracted the way `askRequest` and `pagesRequest` were, and for the same
 * reason: two places constructing this means a test tunes something production
 * does not run.
 *
 * NUMBERED IDS, NOT OFFSETS. The model never sees or returns a character
 * position — it picks numbers off a list we printed, and the caller maps them
 * back. A model that cannot name an offset cannot name a WRONG one, which on a
 * page of TSX is the difference between a typo fix and a site that will not
 * compile. `site-text.mjs` still refuses the edit if the source has moved under
 * it; this makes that the second line of defence rather than the first.
 */
export function textRequest({ instruction, items }) {
  const list = (Array.isArray(items) ? items : []).slice(0, MAX_TEXT_ITEMS);
  const lines = list.map((it, i) => i + ". [" + it.path + "] " + it.text);
  return {
    model: TEXT_MODEL,
    max_tokens: TEXT_MAX_TOKENS,
    tools: [TEXT_TOOL],
    tool_choice: { type: "tool", name: "write_text_edits" },
    system: [{ type: "text", text: SYSTEM }],
    messages: [{
      role: "user",
      content:
        "THE TEXT ON THEIR SITE\n" + lines.join("\n") +
        "\n\nWHAT THEY ASKED FOR\n" + String(instruction || "").trim().slice(0, 2000),
    }],
  };
}

/**
 * Every string on the site, in one flat numbered list.
 *
 * FLAT AND CROSS-PAGE ON PURPOSE. A phone number lives in a footer that is on
 * every page, and a list scoped to one page would change it in one place and
 * leave the site disagreeing with itself — which is worse than not changing it,
 * because nobody notices.
 */
export function textItems(pages) {
  const out = [];
  for (const p of Array.isArray(pages) ? pages : []) {
    if (!p || typeof p.path !== "string") continue;
    for (const it of extractText(p.source)) {
      out.push({ path: p.path, text: it.text, at: it.at });
      if (out.length >= MAX_TEXT_ITEMS) return out;
    }
  }
  return out;
}

/**
 * Turn what the model chose back into edits `site-text.mjs` will accept.
 *
 * EVERY REJECTION HERE IS SILENT AND DELIBERATE. An id nobody offered, a
 * replacement that is empty, one carrying a character that would break the
 * source: none of them is an error the customer can act on, and failing the
 * whole batch over one malformed entry would lose the four good ones beside it.
 * What matters is the count — zero edits is an outcome the lane reports and
 * escalates on, and that is where a model that understood nothing surfaces.
 *
 * `from` IS TAKEN FROM OUR OWN LIST, never from the model. It is what
 * `applyEdit` checks the source still says at that offset, so letting the model
 * supply it would let it authorise its own overwrite.
 */
export function readTextEdits(reply, items) {
  const blocks = reply && Array.isArray(reply.content) ? reply.content : [];
  const use = blocks.find((b) => b && b.type === "tool_use");
  const raw = (use && use.input && use.input.edits) || [];
  const list = Array.isArray(items) ? items : [];
  const out = [];
  const seen = new Set();
  for (const e of Array.isArray(raw) ? raw : []) {
    if (!e || typeof e !== "object") continue;
    const id = Math.floor(Number(e.id));
    if (!Number.isFinite(id) || id < 0 || id >= list.length) continue;
    if (seen.has(id)) continue;
    const to = typeof e.to === "string" ? e.to.trim() : "";
    if (!to || to.length > MAX_TEXT_CHARS) continue;
    // The same characters `applyEdit` refuses, checked here so a bad entry costs
    // itself rather than the batch it travelled in.
    if (/["'`{}<>\\]/.test(to)) continue;
    const it = list[id];
    if (to === it.text) continue; // putting back what is already there is not an edit
    seen.add(id);
    out.push({ path: it.path, at: it.at, from: it.text, to });
  }
  return out;
}

/** The four token kinds, in the shape `pageCredits` prices. One price table, everywhere. */
export function textUsage(reply) {
  const u = (reply && reply.usage) || {};
  return {
    in: Number(u.input_tokens) || 0,
    out: Number(u.output_tokens) || 0,
    cacheRead: Number(u.cache_read_input_tokens) || 0,
    cacheWrite: Number(u.cache_creation_input_tokens) || 0,
    model: TEXT_MODEL,
  };
}

/**
 * The whole text layer: strings out, a cheap model call, strings back.
 *
 * `deps.send(request)` → the raw Messages API response.
 *
 * ESCALATES RATHER THAN REPORTING SUCCESS HAVING DONE NOTHING. Three ways to
 * find no target — a site with no extractable words, a model that matched none
 * of them, a batch every entry of which was malformed — and all three answer
 * `{ok:false, escalate:true}`, because the honest reading of "I could not find
 * what you meant" is that this was not a text change. The rung above can do it.
 *
 * A THROW ESCALATES TOO, and bills nothing: `usage` is null on that path, the
 * same our-fault rule the build path follows.
 */
export async function runTextEdit(deps, { instruction, pages } = {}) {
  const items = textItems(pages);
  if (!items.length) return { ok: false, escalate: true, reason: "no-text", usage: null };
  let reply;
  try {
    reply = await deps.send(textRequest({ instruction, items }));
  } catch (e) {
    return { ok: false, escalate: true, reason: "model", detail: String((e && e.message) || "").slice(0, 200), usage: null };
  }
  const usage = textUsage(reply);
  const edits = readTextEdits(reply, items);
  if (!edits.length) return { ok: false, escalate: true, reason: "no-match", usage };
  const ed = applyEdits(pages, edits);
  // A REFUSAL FROM `applyEdits` IS NOT AN ESCALATION, and it is DEFENSIVE rather
  // than a path this function can reach on its own: the offsets it sends are the
  // ones `textItems` just read out of the same objects, so within one call they
  // agree by construction. What it catches is the source moving underneath —
  // a concurrent build finishing between the extract and the apply — which is
  // real and is exactly the case a shared `applyEdits` refuses for.
  //
  // It must NOT go up the ladder: the rung above would be working from the same
  // out-of-date copy, so retrying is what fixes it and a bigger lane is not.
  // Nothing is published either way; `ok:false` is the whole contract.
  if (!ed.ok) return { ok: false, escalate: false, reason: "stale", detail: ed.error, usage };
  return { ok: true, pages: ed.pages, applied: ed.applied, edits, usage };
}
