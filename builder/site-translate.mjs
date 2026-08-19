// TURNING A SITE'S PAGES INTO A SECOND LANGUAGE.
//
// THE HARD HALF WAS ALREADY BUILT. Telling prose from code in a TSX file is the
// whole difficulty of this, and `site-text.mjs` solved it for the free text
// editor: it offers only strings it is confident about — never a `className`, a
// route id, a column name or an identifier — and applies a change at the exact
// offset it offered it, back to front so no edit moves another. Translation is
// that machinery pointed at a different source of replacements, so this module
// is small on purpose and inherits every guard that one is mutation-checked for.
//
// ONE CALL PER LANGUAGE, NOT PER PAGE. The strings of a whole site are ~760
// tokens a page and a real site is four to six pages, so the entire thing fits
// in one request — and a page-at-a-time loop would translate "Book" on the home
// page and "Reserve" on the booking page, which reads as two businesses.
//
// HAIKU, because this is the cheapest thing a model can be asked to do and the
// expensive models are no better at it. Priced through the same one table as
// every other call.
//
// WHAT IT DELIBERATELY DOES NOT TOUCH: DATABASE ROWS. A café's menu lives in
// Postgres, not in the page, so the dishes stay in the owner's own words. That
// limit is real and is stated to the customer rather than discovered by them.
import { extractText, applyEdits } from "./site-text.mjs";
import { pageForLang } from "./site-langs.mjs";

/** The most strings one call will carry. */
export const MAX_STRINGS = 900;

/**
 * Every string on the site, deduplicated.
 *
 * DEDUPLICATED BECAUSE A SITE REPEATS ITSELF. "Book now" is in the header of
 * every page, and translating it once means it cannot come back as "Reservar"
 * on one page and "Reserva" on another — which is the failure a per-page loop
 * produces and nobody notices until a customer does.
 *
 * IT RETURNED A `where` MAP — every occurrence's page and offset — AND NOTHING
 * READ IT. `translatePages` re-scans the pages itself, because the offsets it
 * needs are the ones in the source it is about to edit; the caller destructures
 * `{strings, dropped}`. A field computed on every publish and consumed by
 * nobody is the shape this repo has deleted 289 files over, so it is gone rather
 * than kept in case.
 */
export function collectStrings(pages, { max = MAX_STRINGS } = {}) {
  const seen = new Set();
  for (const p of Array.isArray(pages) ? pages : []) {
    const src = String((p && p.source) || "");
    if (!src) continue;
    for (const t of extractText(src)) seen.add(t.text);
  }
  const all = [...seen];
  // TRUNCATION IS REPORTED, NEVER SILENT. A site whose strings do not fit comes
  // back partly translated, and a caller that cannot tell would publish it as a
  // finished second language.
  const kept = all.slice(0, max);
  return { strings: kept, dropped: all.length - kept.length };
}

/**
 * The tool the model is given.
 *
 * AN ARRAY POSITIONALLY MATCHED TO THE INPUT, not a map keyed by the English.
 * A map would need the model to reproduce every source string exactly to key
 * it, and a single stray character silently loses that string — an object whose
 * keys are attacker-shaped data is the same trap `seed` already records. An
 * array of the same length can be checked with one comparison.
 */
export const TRANSLATE_TOOL = {
  name: "write_translation",
  description:
    "Translate a website's own words into the target language. You are given the site's strings as an array; " +
    "return `strings` as an array of EXACTLY the same length, in the same order, each item the translation of the " +
    "item at that position.\n" +
    "KEEP a string exactly as it is when translating it would be wrong: a business's own name, a person's name, a " +
    "street address, an email address, a phone number, a price, a time, a social handle, a brand.\n" +
    "These are the words on a small business's website, so translate the way that business would speak to its own " +
    "customers — a booking button, a heading, a line about opening hours. Match the length roughly: a heading that " +
    "doubles in length breaks the layout it was written for.\n" +
    "Never add, drop or reorder items. If an item is already in the target language, return it unchanged.",
  input_schema: {
    type: "object",
    properties: {
      strings: { type: "array", items: { type: "string" }, description: "One translation per input string, same order." },
    },
    required: ["strings"],
  },
};

/**
 * What comes back, checked before anything is written.
 *
 * A WRONG LENGTH IS REFUSED WHOLESALE rather than zipped as far as it goes. The
 * mapping is positional, so an answer one item short does not translate n-1
 * strings — it puts every translation after the gap on the WRONG string, and the
 * result compiles perfectly and is nonsense. There is no partial credit here.
 */
export function readTranslation(input, expected) {
  const got = input && Array.isArray(input.strings) ? input.strings : null;
  if (!got) return { ok: false, why: "shape" };
  if (got.length !== expected) return { ok: false, why: "length", got: got.length, expected };
  const out = got.map((v) => (typeof v === "string" ? v : null));
  if (out.some((v) => v === null)) return { ok: false, why: "shape" };
  return { ok: true, strings: out };
}

/**
 * Which strings this language has never been asked about.
 *
 * THE CACHE IS WHAT MAKES A SECOND LANGUAGE AFFORDABLE TO KEEP. Every cheap
 * edit republishes — a typo fix, a colour change, a swapped picture — and
 * without this each one would re-translate the whole site to keep the two halves
 * in step. Keyed by the ENGLISH STRING rather than by a page or an offset, so a
 * paragraph that moves to another page is still translated and a colour change,
 * which moves no words at all, costs NOTHING: zero misses, no model call.
 *
 * REBUILT FROM THE CURRENT STRINGS ON EVERY PUBLISH, which is also the pruning:
 * a sentence the owner deleted stops being carried, so the cache cannot grow
 * without bound as a site is edited over years.
 */
export function missingFrom(cache, strings) {
  const have = cache && typeof cache === "object" ? cache : {};
  return (Array.isArray(strings) ? strings : []).filter((s) => typeof have[s] !== "string");
}

/**
 * The cache after a round, holding exactly what the site says today.
 *
 * A STRING WITH NO TRANSLATION FALLS BACK TO ITSELF rather than being dropped.
 * The alternative is a page with a hole in it: `translatePages` skips anything
 * absent, so an untranslated string simply stays in the primary language, which
 * is the honest degradation. Storing it keeps the count of misses honest too —
 * without it, a string the model declined to change would be asked about again
 * on every publish for ever.
 */
export function nextCache(cache, strings, fresh) {
  const have = cache && typeof cache === "object" ? cache : {};
  const out = {};
  for (const s of Array.isArray(strings) ? strings : []) {
    const got = fresh && typeof fresh[s] === "string" ? fresh[s] : have[s];
    out[s] = typeof got === "string" ? got : s;
  }
  return out;
}

/**
 * The translated pages, ready to compile.
 *
 * AN UNCHANGED STRING IS NOT AN EDIT. A price, a phone number and a business's
 * own name come back exactly as they went in — which is correct — and rewriting
 * a span with the identical text is a change to the source that buys nothing and
 * can only introduce a difference.
 */
export function translatePages(pages, prefix, strings, translations, { routes = [] } = {}) {
  const map = new Map();
  strings.forEach((s, i) => { if (translations[i] && translations[i] !== s) map.set(s, translations[i]); });
  const list = (Array.isArray(pages) ? pages : []).map((p) => ({ path: (p && p.path) || "", source: String((p && p.source) || "") }));
  const edits = [];
  for (const p of list) {
    for (const t of extractText(p.source)) {
      const to = map.get(t.text);
      if (to) edits.push({ path: p.path, at: t.at, from: t.text, to });
    }
  }
  // ONE BATCH OVER EVERY PAGE, which is `applyEdits`' own contract: it sorts
  // back to front so no edit moves another, and REFUSES the whole batch rather
  // than half-applying it. That refusal is kept rather than worked around — a
  // site published in a mixture of two languages is worse than one published in
  // the language it was written in.
  const done = edits.length ? applyEdits(list, edits) : { ok: true, pages: list, applied: 0 };
  const sources = new Map((done.ok ? done.pages : list).map((p) => [p.path, p.source]));
  const out = [];
  for (const p of Array.isArray(pages) ? pages : []) {
    const source = sources.get((p && p.path) || "") ?? String((p && p.source) || "");
    const page = pageForLang({ ...p, source }, prefix, routes);
    if (page) out.push(page);
  }
  return { pages: out, applied: done.ok ? done.applied : 0, failed: !done.ok, error: done.ok ? null : done.error };
}
