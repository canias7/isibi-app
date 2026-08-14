// What a published site says it IS — its language and its mark.
//
// TWO THINGS EVERY GENERATED SITE HAD IN COMMON, AND NEITHER WAS TRUE OF IT.
//
// `<html lang="en">` is hardcoded in the template and `writeIndexHtml` rewrote
// only the `<title>`, so a café in Lisbon and a peluquería in Madrid both
// published as English. That is not cosmetic: Chrome offers to translate a
// Spanish page into English when the page claims to be English, a screen reader
// pronounces Spanish words with an English voice, and a search engine files the
// site under the wrong language. It is invisible to everyone building the site
// and obvious to the person it is for.
//
// `/favicon.svg` is a 231-byte dark square with a circle in it, shipped in the
// template's `public/`, so EVERY site the platform has ever published shares one
// tab icon — the same mark in the tab, the bookmark bar and the phone home
// screen for a barber, a bakery and a builder. A business's own logo is a
// separate feature needing an explicit choice; a mark derived from its NAME
// needs nothing at all and is right for the ~all of them who have no square icon
// file to hand.
//
// BOTH ARE WRITTEN IN ONE PLACE because there is only one place: `index.html` is
// what Vite builds from and what every prerendered route derives its head from.
// The model never sees that file, so this can only happen at build time — the
// same argument `site-meta.mjs` makes for the tags it injects after the fact.
//
// Plain module, no filesystem and no HTTP, so every decision here is testable
// outside the container.

/** Two letters is a mark; three is a word set too small to read. */
export const MAX_INITIALS = 2;

/**
 * A language tag, or null.
 *
 * A SUBSET OF BCP-47 RATHER THAN A PARSER. The value is written into an HTML
 * attribute, so the safe move is to accept only shapes that cannot contain
 * anything needing escaping and refuse everything else — then there is no
 * escaping question to get wrong. What is accepted is what a real site uses:
 * a language (`es`), optionally a script (`zh-Hans`), optionally a region
 * (`pt-BR`), or both (`zh-Hans-CN`).
 *
 * CANONICALISED, NOT PASSED THROUGH. BCP-47 says language lowercase, script
 * Titlecase, region UPPERCASE — and the case is not decoration: `zh-hans` is a
 * well-formed tag that matchers built on the convention miss. A model asked for
 * a language answers `PT-br` often enough that normalising is cheaper than
 * hoping.
 *
 * Refusing rather than defaulting to `en` is deliberate: the caller decides what
 * an unreadable answer means, and every caller here keeps whatever the site had.
 */
export function normalizeLang(v) {
  const raw = typeof v === "string" ? v.trim() : "";
  if (!raw) return null;
  const m = /^([a-z]{2,3})(?:-([a-z]{4}))?(?:-([a-z]{2}|[0-9]{3}))?$/i.exec(raw);
  if (!m) return null;
  const lang = m[1].toLowerCase();
  const script = m[2] ? m[2][0].toUpperCase() + m[2].slice(1).toLowerCase() : "";
  const region = m[3] ? m[3].toUpperCase() : "";
  return [lang, script, region].filter(Boolean).join("-");
}

/**
 * The letters that stand for a business.
 *
 * TWO WORDS, NOT TWO LETTERS OF ONE. "Sharp Fade Barbers" is SF and "Zephyr" is
 * Z — a single word gets one letter, because "ZE" reads as an abbreviation of
 * nothing while "Z" reads as a mark. The words that do not carry the name are
 * dropped (`&`, `and`, `the`, `of`), or "Forno & Co" would be F&.
 *
 * NON-LATIN NAMES KEEP THEIR OWN CHARACTERS. A `[A-Z]` filter would give a
 * Greek or Cyrillic business an empty mark, which is the failure this exists to
 * prevent, so anything that is a letter in Unicode counts. An emoji or a
 * punctuation mark does not.
 */
export function initials(brand) {
  const s = String(brand == null ? "" : brand).trim();
  if (!s) return "";
  const skip = new Set(["and", "the", "of", "for", "at", "de", "la", "le", "el", "y", "e"]);
  const words = s
    .split(/[\s /_.,·|–—-]+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter((w) => w && /\p{L}/u.test(w[0]) && !skip.has(w.toLowerCase()));
  if (!words.length) return "";
  // ONE WORD GETS ONE LETTER, and it needs no branch — `slice(0, 2)` of a
  // one-element array is that element. A `if (words.length === 1)` early return
  // was here and a mutation proved it INERT: deleting it changed no answer for
  // any name. Removed rather than kept, because a line that cannot affect the
  // output reads as a decision being enforced when nothing is enforcing it.
  return words.slice(0, MAX_INITIALS).map((w) => w[0].toUpperCase()).join("");
}

/**
 * A stable hue for a name.
 *
 * DERIVED FROM THE BRAND AND NOT FROM THE THEME, and that is a decision rather
 * than a shortcut. An SVG favicon is fetched as its own document: it cannot read
 * a custom property off the page, so a mark that "matched the theme" would have
 * to bake a colour the theme can then change underneath it. Deriving from the
 * name means the mark is stable for the life of the business and distinct
 * between two businesses, which is the whole job of a tab icon.
 *
 * FNV-1a rather than a sum of char codes: "ab" and "ba" hash the same under a
 * sum, and two salons on one street are exactly the pair that would collide.
 */
export function brandHue(brand) {
  const s = String(brand == null ? "" : brand);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % 360;
}

/**
 * Is this text written in a script whose glyphs fill a full em?
 *
 * CJK, Hangul, kana and the full-width Latin forms. Everything else — Latin,
 * Greek, Cyrillic, Arabic, Hebrew, Devanagari — sits well inside an em at these
 * sizes, so widening the test would shrink marks that are already right.
 */
export function isWide(text) {
  return /[ᄀ-ᇿ⺀-鿿ꥠ-꥿가-퟿豈-﫿＀-｠￠-￦]/.test(String(text || ""));
}

/**
 * Escaped for XML. The brand is the customer's, so it is not ours to trust.
 *
 * On the INITIALS this is belt-and-braces and cannot fire — `initials` takes the
 * first character of each word and keeps only words beginning with a Unicode
 * letter, so what comes back is letters and nothing else. Kept rather than
 * removed, and said here rather than left to read as protection: that guarantee
 * is an emergent property of a filter one edit away from changing, and the
 * function is also used on the TITLE and the icon path, where it does real work.
 */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));

/**
 * The site's own favicon, as an SVG document.
 *
 * A ROUNDED SQUARE WITH THE INITIALS, at 32×32 with the text centred by
 * `dominant-baseline` rather than a magic offset — a nudged `y` is right at one
 * font size and wrong at every other, and the mark has to hold at 16px in a tab
 * and at 180px on a home screen.
 *
 * `font-family` NAMES A STACK AND ENDS IN `sans-serif`, deliberately. An SVG
 * favicon renders in the browser's own context with no access to the site's
 * bundled fonts, so naming the site's heading face would silently fall back —
 * to whatever the browser picks, which is not the same on two machines. A stack
 * that ends somewhere real is a mark that looks the same everywhere.
 *
 * LIGHTNESS IS FIXED AND THE TEXT IS WHITE. Deriving the text colour by
 * luminance sounds better and buys a mark that is sometimes dark-on-light and
 * sometimes light-on-dark, i.e. inconsistent across the platform for no gain;
 * pinning the ground dark enough that white always clears contrast is one
 * decision instead of a calculation that can be wrong.
 */
export function initialsMark(brand) {
  const letters = initials(brand);
  if (!letters) return null;
  const hue = brandHue(brand);
  const bg = `hsl(${hue} 62% 34%)`;
  // 1 letter sits larger than 2 — the same box has to hold both without one
  // looking lost and the other touching the edges.
  //
  // A FULL-WIDTH SCRIPT NEEDS ITS OWN SIZE, and this was found by RENDERING the
  // marks rather than by reasoning about them. A CJK glyph is ~1em wide against
  // ~0.68em for a Latin capital, so two of them at the Latin size measure 30px
  // in a 32px box and touch the rounded corners — it compiles, it is valid SVG,
  // and it looks broken. Same lesson as the charts that typechecked while
  // rendering grey.
  const wide = isWide(letters);
  const size = letters.length > 1 ? (wide ? 12 : 15) : (wide ? 17 : 19);
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">' +
    `<rect width="32" height="32" rx="7" fill="${bg}"/>` +
    `<text x="16" y="16.5" text-anchor="middle" dominant-baseline="central" fill="#fff" ` +
    `font-family="ui-sans-serif,system-ui,-apple-system,Segoe UI,Helvetica,Arial,sans-serif" ` +
    `font-size="${size}" font-weight="700" letter-spacing="0.2">${esc(letters)}</text>` +
    "</svg>"
  );
}

/**
 * Put the title, the language and the icon into the built document.
 *
 * ONE FUNCTION FOR ALL THREE because they live in one file and each of them was
 * a separate opportunity to rewrite it. `writeIndexHtml` did the title with a
 * regex and the other two did not exist; adding two more regexes at the call
 * site is two more places for the escaping to differ.
 *
 * ONLY EVER A NO-OP, NEVER AN ERROR. A document with no `<html>` tag, no
 * `<title>`, or no icon link comes back with whatever could be applied and the
 * rest untouched — publishing a site whose title did not change beats failing a
 * build over a head tag, which is the same rule `injectMeta` follows.
 */
export function applyIdentity(html, { title, lang, icon } = {}) {
  let out = String(html == null ? "" : html);

  const t = String(title || "").trim().slice(0, 70);
  // Function replacer for the same reason as `setTitle` in site-meta.mjs: a
  // brand containing `$$`/`$&`/`$'` is a replacement PATTERN to String.replace,
  // and this is the customer's own trading name going into the tag.
  if (t) out = out.replace(/<title>[\s\S]*?<\/title>/i, () => "<title>" + esc(t) + "</title>");

  const l = normalizeLang(lang);
  if (l) {
    // The attribute may be absent as well as wrong — a template edited to
    // `<html>` would otherwise silently keep publishing sites with no language
    // at all, which is the state this function exists to end.
    out = /<html\b[^>]*\blang\s*=/i.test(out)
      ? out.replace(/(<html\b[^>]*?\blang\s*=\s*)(["'])[^"']*\2/i, `$1$2${l}$2`)
      : out.replace(/<html\b/i, `<html lang="${l}"`);
  }

  if (icon) {
    // REPLACE THE HREF, never the whole tag: the template's link also carries
    // `type="image/svg+xml"`, and a browser handed an icon with no type has to
    // sniff it.
    out = out.replace(/(<link\b[^>]*\brel\s*=\s*["']icon["'][^>]*\bhref\s*=\s*)(["'])[^"']*\2/i, `$1$2${esc(icon)}$2`);
  }
  return out;
}
