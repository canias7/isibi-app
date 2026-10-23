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
import { extractText, applyEdit } from "./site-text.mjs";
import { pageForLang, MAX_EXTRA_LANGS } from "./site-langs.mjs";

/** The most strings one call will carry. */
export const MAX_STRINGS = 900;

// ── BATCHES, AND A FAILURE REMEMBERED (2026-10-23, the owner's choice on audit
// #195 / A32-2) ────────────────────────────────────────────────────────────
//
// A language's missing strings went out in ONE call with an 8,000-token
// answer, so a large site (or a language that takes twice the tokens) was cut
// off on every publish, asked again whole and failed the same way. Now they go
// in batches sized well under that answer; each batch's successes are kept; a
// batch refused for its size or shape is remembered by a key of its own words
// and not asked again until those words change. A refused batch is never
// charged.

/** At most this many strings in one call. */
export const BATCH_MAX_STRINGS = 150;
/** At most this many characters of strings (as sent, JSON) in one call: about a quarter of the answer's room in English, so a language at twice the tokens still fits. */
export const BATCH_MAX_CHARS = 6000;
/** Why a batch failed that asking again would not change. */
export const LASTING_FAILURES = new Set(["shape", "length", "size", "unusable"]);
/** The key under the translation cache that holds each language's remembered failures (never a language tag). */
export const STUCK_KEY = "_stuck";

/** The missing strings in order, cut into batches of at most `maxStrings` and `maxChars`. */
export function translationBatches(missing, { maxStrings = BATCH_MAX_STRINGS, maxChars = BATCH_MAX_CHARS } = {}) {
  const out = [];
  let cur = [], size = 2;
  for (const s of Array.isArray(missing) ? missing : []) {
    if (typeof s !== "string") continue;
    const n = JSON.stringify(s).length + 1;
    if (cur.length && (cur.length >= maxStrings || size + n > maxChars)) { out.push(cur); cur = []; size = 2; }
    cur.push(s); size += n;
  }
  if (cur.length) out.push(cur);
  return out;
}

/** A batch's own key: its words, in order (FNV-1a over the JSON, with the count). */
export function batchKey(batch) {
  const t = JSON.stringify(Array.isArray(batch) ? batch : []);
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0") + ":" + (Array.isArray(batch) ? batch.length : 0);
}

/** The remembered failures of one language, read strictly from the cache. */
export function stuckFor(cache, tag) {
  const all = cache && typeof cache === "object" && cache[STUCK_KEY] && typeof cache[STUCK_KEY] === "object" ? cache[STUCK_KEY] : {};
  const list = Object.hasOwn(all, tag) && Array.isArray(all[tag]) ? all[tag] : [];
  return new Set(list.filter((k) => typeof k === "string"));
}

/** Every language's remembered failures after a round: only the non-empty, or null when none. */
export function stuckAfter(byTag) {
  const out = {};
  for (const [tag, keys] of Object.entries(byTag || {})) if (Array.isArray(keys) && keys.length) out[tag] = [...new Set(keys)].sort();
  return Object.keys(out).length ? out : null;
}

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
 *
 * BUT NOT AFTER A ROUND THAT FAILED (run 38, 2026-09-04). The rule above is
 * written for a string the model was ASKED about and left alone — a name, a
 * phone number. A call that never answered left every missing string with no
 * translation, this wrote each one in as itself, and from then on nothing was
 * missing: fretwork-1's Spanish and French were English under both prefixes
 * for three days and the loop never asked again. `fresh === null` says the
 * round failed: the cache keeps only what it already held for today's strings,
 * the rest stay missing, and the next publish asks.
 */
export function nextCache(cache, strings, fresh, failed = null) {
  const have = cache && typeof cache === "object" ? cache : {};
  const out = {};
  // A STRING WHOSE BATCH FAILED (2026-10-23, audit #195) is treated as the
  // whole failed round treats every string: what was cached stays, nothing new
  // is written in as itself, and it stays missing.
  const lost = failed instanceof Set ? failed : null;
  for (const s of Array.isArray(strings) ? strings : []) {
    if (lost && lost.has(s)) { const k = typeof have[s] === "string" ? usableTranslation(s, have[s]) : null; if (k !== null) out[s] = k; continue; }
    // A TRANSLATION THAT CANNOT BE WRITTEN INTO A PAGE IS NEVER CACHED
    // (2026-10-22, audit A32-1). Cached, it read as known on every later
    // publish, nothing was asked again, and the language stayed behind until
    // the English changed. Left out, the next publish asks for it again. The
    // stored form is the one `usableTranslation` writes, so a cache holding
    // a plain apostrophe from before this heals as it is rewritten.
    if (fresh === null) { const k = typeof have[s] === "string" ? usableTranslation(s, have[s]) : null; if (k !== null) out[s] = k; continue; }
    const got = fresh && typeof fresh[s] === "string" ? fresh[s] : have[s];
    if (typeof got !== "string") { out[s] = s; continue; }
    const k = usableTranslation(s, got);
    if (k !== null) out[s] = k;
  }
  return out;
}

/**
 * A translation in the form it can be written into a page, or null when it
 * cannot be (2026-10-22, audit A32-1).
 *
 * THE PAGE WRITER REFUSES QUOTES, BRACES, ANGLE BRACKETS AND BACKSLASHES, and
 * anything over 400 characters, because a string in TSX sits in one of three
 * places (JSX text, a quoted attribute, a JavaScript string) and each breaks on
 * a different character. French and Spanish answer with apostrophes and quotes
 * all the time ("L'equipe"), and one of them used to refuse the whole language.
 *
 * SO STRAIGHT QUOTES BECOME TYPOGRAPHIC ONES, which mean nothing in any of the
 * three places and are the correct marks in every language we offer; line
 * breaks become spaces. What is still unsafe after that (a brace, an angle
 * bracket, a backtick, a backslash) or is too long is refused for THIS string
 * only: it keeps the original wording, and the rest of the language is written.
 * An answer identical to the original is kept as it is.
 */
export const MAX_TRANSLATION = 400;
export function usableTranslation(from, to) {
  if (typeof to !== "string") return null;
  if (to === from) return to;
  let open = true;
  const t = to
    .replace(/[\r\n\u2028\u2029]+/g, " ")
    .replace(/'/g, "\u2019")
    .replace(/"/g, () => { const q = open ? "\u201C" : "\u201D"; open = !open; return q; });
  if (!t.trim() || t.length > MAX_TRANSLATION) return null;
  if (/[`{}<>\\]/.test(t)) return null;
  return t;
}

/**
 * The sentence the customer reads about a language that is behind, or "".
 *
 * Built from each language's own outcome (`ok`, `kept`), never from the
 * request: a language whose translation could not be used says so, and so does
 * one where some phrases stayed in the original wording.
 */
export function langNote(outcomes, refused = []) {
  const out = [];
  // A LANGUAGE `resolveLangs` REFUSED IS SAID TOO (audit A32-4). It was put on
  // the answer as `langsRefused` and no reply read it, so "add Italian" as a
  // fourth language was told as done and no /it ever appeared. One sentence
  // per refusal, from its own reason.
  const WHY = {
    cap: (l) => "The site can be offered in at most " + MAX_EXTRA_LANGS + " other languages, so " + l + " was not added.",
    duplicate: (l) => l + " was not added: the site already has a language at the same address.",
    reserved: (l) => l + " was not added: its address is one the site already uses for something else.",
    page: (l) => l + " was not added: the site has a page at the address that language would use.",
    unreadable: (l) => "“" + l + "” was not added: it is not a language code I can read.",
  };
  for (const r of Array.isArray(refused) ? refused : []) {
    if (r && typeof r.lang === "string" && Object.hasOwn(WHY, r.why)) out.push(WHY[r.why](r.lang));
  }
  for (const o of Array.isArray(outcomes) ? outcomes : []) {
    if (!o || typeof o.tag !== "string") continue;
    const kept = Number(o.kept) || 0;
    const behind = Number(o.behind) || 0;
    // A LASTING FAILURE IS NOT RETRIED ON THE NEXT CHANGE (audit #195): said
    // so, rather than promising a try that will not happen.
    const lasting = o.why === "stuck" || LASTING_FAILURES.has(o.why);
    if (o.ok === false) out.push(lasting
      ? "The " + o.tag + " pages could not be translated, so they show your original wording; I won't try those words again until you change them."
      : "The " + o.tag + " pages could not be translated this time, so they show your original wording for now; I'll try again on your next change.");
    else {
      if (behind > 0) out.push(behind + (behind === 1 ? " phrase" : " phrases") + " on the " + o.tag + " pages could not be translated this time and show your original wording for now.");
      if (kept > 0) out.push(kept + (kept === 1 ? " phrase" : " phrases") + " on the " + o.tag + " pages could not be translated safely and show your original wording for now.");
    }
  }
  return out.join(" ");
}

/**
 * A cache that was never translated — every string stored as itself — which
 * is what the rule above wrote for a language whose every call failed. Read
 * as no cache at all, so the language starts over on the next publish; a real
 * translation has at least one string that differs from its key. A site whose
 * every string the model would legitimately keep (nothing but names) pays a
 * call per publish for it, which is honest and rare. Empty is not this: an
 * empty cache is simply new.
 */
export function untranslated(cache) {
  if (!cache || typeof cache !== "object") return false;
  const keys = Object.keys(cache);
  return keys.length > 0 && keys.every((k) => cache[k] === k);
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
  // STRINGS WHOSE TRANSLATION COULD NOT BE WRITTEN: each keeps its original
  // wording and is named, and the rest of the language is still written.
  const refused = new Set();
  strings.forEach((s, i) => {
    const tr = translations[i];
    if (!tr || tr === s) return;
    const k = usableTranslation(s, tr);
    if (k === null) refused.add(s); else if (k !== s) map.set(s, k);
  });
  const list = (Array.isArray(pages) ? pages : []).map((p) => ({ path: (p && p.path) || "", source: String((p && p.source) || "") }));
  const edits = [];
  for (const p of list) {
    for (const t of extractText(p.source)) {
      const to = map.get(t.text);
      if (to) edits.push({ path: p.path, at: t.at, from: t.text, to });
    }
  }
  // ONE EDIT AT A TIME, BACK TO FRONT, and a refused edit costs only its own
  // string (2026-10-22, audit A32-1). `applyEdits` refuses a whole batch for
  // one bad edit, which is right for the text editor, where the owner typed
  // every change, and wrong here: one apostrophe published the whole language
  // in the primary wording, paid for and reported as done.
  const draft = new Map(list.map((p) => [p.path, { path: p.path, source: p.source }]));
  let applied = 0;
  let error = null;
  for (const e of edits.slice().sort((a, b) => b.at - a.at)) {
    const page = draft.get(e.path);
    const r = applyEdit(page.source, e);
    if (!r.ok) { refused.add(e.from); error = error || r.error; continue; }
    page.source = r.source;
    applied++;
  }
  const out = [];
  for (const p of Array.isArray(pages) ? pages : []) {
    const d = draft.get((p && p.path) || "");
    const source = d ? d.source : String((p && p.source) || "");
    const page = pageForLang({ ...p, source }, prefix, routes);
    if (page) out.push(page);
  }
  return { pages: out, applied, failed: refused.size > 0, refused: [...refused], error };
}
