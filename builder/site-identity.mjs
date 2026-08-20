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
//
// IT WAS A LEAF UNTIL THE MARK TOOK THE SITE'S OWN COLOUR, and these two are
// what that costs. Neither imports this file, so there is no cycle; both are
// themselves plain modules, so nothing here becomes harder to drive.
import { normalizeSeeds } from "./site-seeds.mjs";
import { oklchToRgb } from "./site-theme.mjs";

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
 * Light paper or dark, as one of exactly two strings.
 *
 * BESIDE `normalizeLang` AND FOR THE OPPOSITE REASON. That one REFUSES rather
 * than defaulting, because a caller must be able to keep whatever the site had.
 * This one cannot: `<html>` either carries the class or it does not, so there is
 * no "leave it alone" to express, and the safe answer for everything unreadable
 * is the one every site published before 2026-08-18 already has. An absent value
 * is not an error here — it is what every existing site sends.
 *
 * A NON-STRING IS NOT COERCED. `String(["dark"])` is `"dark"`, which is the
 * shape that made a one-element array a valid role and a valid access level
 * twice in this repo. This decides how an entire site is drawn, so it takes a
 * string or it takes light.
 */
export function normalizeMode(v) {
  return (typeof v === "string" && v.trim().toLowerCase() === "dark") ? "dark" : "light";
}

/**
 * The eight scripts written right to left, as BCP-47 script subtags.
 *
 * A SCRIPT LIST RATHER THAN A LANGUAGE LIST, because the script is what decides
 * and the language often does not. Azerbaijani is Latin in Azerbaijan and
 * Perso-Arabic in Iran; Kashmiri and Punjabi are each written in two scripts
 * with opposite directions. A language list gets those wrong in BOTH directions
 * and cannot be told it is wrong, because the tag carries the answer.
 */
export const RTL_SCRIPTS = new Set(["Arab", "Hebr", "Thaa", "Syrc", "Nkoo", "Adlm", "Mand", "Samr"]);

/**
 * The languages whose DEFAULT script is right to left, for a tag that names no
 * script. `he` means Hebrew script even though it does not say so.
 */
export const RTL_LANGS = new Set([
  "ar", "he", "iw", "fa", "ur", "ps", "sd", "ug", "yi", "ji", "dv", "ckb",
  "syr", "arc", "nqo", "prs", "pnb", "skr", "bal", "khw", "glk", "mzn",
]);

// `ku` AND `ff` ARE DELIBERATELY ABSENT, and they were both in this list until
// it was checked against CLDR rather than against intuition. Kurdish defaults to
// KURMANJI IN LATIN (`ku` → `ku-Latn-TR`; the Perso-Arabic one is Sorani, which
// is `ckb`), and Fulah defaults to Latin too (`ff` → `ff-Latn-SN`; Adlam is
// `ff-Adlm`). Both were making a site right to left with LATIN text in it —
// visibly wrong, and reachable by an ordinary brief.
//
// Named here rather than left as an absence, because both ARE reachable as
// right to left through the script rule above (`ku-Arab`, `ff-Adlm`) and the
// obvious "fix" is to put them back. My own test asserted `dirFor("ku-Latn")`
// is ltr and PASSED THE WHOLE TIME — satisfied by the script rule, so it read as
// covering the language and covered a different rule entirely.

/**
 * `ltr` or `rtl` for a language tag.
 *
 * THE SCRIPT SUBTAG WINS WHEN THERE IS ONE, and that is the whole design. It is
 * the only part of the tag that answers the question directly, so `az-Arab` is
 * right to left and `ku-Latn` is left to right even though the base languages
 * pull the other way. Only a tag naming no script falls back to the language's
 * own default.
 *
 * A TABLE RATHER THAN `Intl.Locale.textInfo`, which exists here and gives the
 * same answers today. ICU is the thing this repo has already been bitten by:
 * two ICU VERSIONS disagree about one locale, so a site's direction would be
 * decided by whichever Node happened to build it, and could silently flip on a
 * base-image bump. The set of right-to-left scripts is eight entries and has not
 * changed in decades; determinism is worth more here than coverage of a script
 * nobody has asked for.
 *
 * Takes whatever `normalizeLang` accepts. Anything it refuses is `ltr`, which is
 * what every site published before this already is.
 */
export function dirFor(lang) {
  const tag = normalizeLang(lang);
  if (!tag) return "ltr";
  const parts = tag.split("-");
  const script = parts.find((p) => p.length === 4);
  if (script) return RTL_SCRIPTS.has(script) ? "rtl" : "ltr";
  return RTL_LANGS.has(parts[0]) ? "rtl" : "ltr";
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
 * The mark's ground — THE SITE'S OWN ACCENT, not a hash of its name.
 *
 * `brandHue` above was the whole answer while nothing else about a site was
 * authored, and it stopped being one the day the designer started writing a
 * palette. Measured: "Fade & Co Barbershop" hashes to hue 273 — a PURPLE tab
 * icon on a warm-brick site whose own accent is hue 36. The designer picks three
 * colours, the engine derives thirty-one from them, and the most-repeated mark
 * of the brand — the tab, the bookmark bar, the phone home screen — was a colour
 * nobody chose that matched nothing on the site.
 *
 * OKLCH RATHER THAN THE OLD `hsl()`, and that is a legibility improvement rather
 * than a tidy-up. The mark pins its lightness so white initials always clear
 * contrast, and how much contrast a fixed lightness BUYS depends on the hue:
 * swept over all 360 hues with the calibrated instrument, `hsl(h 62% 34%)`
 * bottoms out at 3.55:1 (hue 60), which clears AA-large and not AA body. The
 * same discipline in OKLCH — the palette's own space — bottoms out at 6.95:1
 * across every hue AND every chroma up to the cap. Strictly better everywhere,
 * and the mark is now in the same colour space as the thing it represents.
 *
 * THE ACCENT'S OWN CHROMA IS KEPT, capped rather than replaced, so a deliberately
 * neutral brand gets a near-grey mark. That is their identity, not a failure to
 * pick a colour, and the sweep covers chroma 0 as well.
 *
 * `null` when the palette is unusable or absent, so the caller falls back to the
 * hash — a site with no seeds still gets a mark rather than none.
 */
export const MARK_L = 0.42;
export const MARK_C_CAP = 0.16;

export function markGround(seeds) {
  const out = normalizeSeeds(seeds);
  if (!out || !out.theme || !out.theme.light) return null;
  const accent = out.theme.light.accent;
  if (!Array.isArray(accent) || accent.length < 3) return null;
  const [L, C, H] = accent;
  if (![L, C, H].every(Number.isFinite)) return null;
  // A CEILING, NOT A FIXED VALUE, and looking at a render is what found it.
  // Pinning outright made a deliberately near-black brand ("Noir", accent
  // L 0.14) come out MID-GREY — lighter than the identity it is meant to be.
  // Darker only ever increases contrast against white initials, so taking the
  // lower of the two is safe by construction and truer to the brand: a dark
  // accent keeps its own weight, a bright one is brought down to the floor the
  // sweep measured.
  return [Math.min(L, MARK_L), Math.min(Math.max(C, 0), MARK_C_CAP), H];
}

/**
 * A hex string, because a favicon is not only rendered by a browser.
 *
 * `oklch()` in an SVG `fill` is fine in a current browser and this document is
 * also read by bookmark managers, OS home-screen shortcuts and link unfurlers,
 * where the older notation is the one that cannot be got wrong. `oklchToRgb`
 * already clamps into sRGB, so nothing here can produce an out-of-range channel.
 */
function hexOf([L, C, H]) {
  const to255 = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));
  return "#" + oklchToRgb(L, C, H).map((v) => to255(v).toString(16).padStart(2, "0")).join("");
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
 * decision instead of a calculation that can be wrong. VERIFIED rather than
 * asserted, and the claim held: swept over all 360 hues, the old `hsl()` form
 * bottoms out at 3.55:1 and never drops below 3.0, so white really did always
 * clear the bar a 32px mark in bold caps has to clear. `markGround` raises that
 * floor to 6.95:1 without changing the discipline.
 *
 * THE GROUND COMES FROM THE SITE, falling back to the name hash only when there
 * is no usable palette — see `markGround`.
 */
export function initialsMark(brand, seeds) {
  const letters = initials(brand);
  if (!letters) return null;
  const ground = markGround(seeds);
  const bg = ground ? hexOf(ground) : `hsl(${brandHue(brand)} 62% 34%)`;
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
 * The owner's OWN tab icon, if they sent one we can serve.
 *
 * WHY THIS IS HERE RATHER THAN IN THE CONTAINER, which is where it started: the
 * decision is pure — is this URL usable, and what are the bytes — and inside
 * `build-server.mjs` nothing can drive it. A mutation sweep proved that
 * immediately: making the container ignore the stored icon entirely, and making
 * its shape check accept any string at all, BOTH survived a green suite. The
 * container keeps the wiring; the judgement lives where it can be tested.
 *
 * A SEPARATE PIECE OF ARTWORK FROM THE HEADER LOGO, never a smaller copy. A
 * wordmark is legible at a few hundred pixels and a smear at 16, so a site that
 * used one for both would have a worse tab than one showing its initials — which
 * is why this is asked for and never inferred from the logo.
 *
 * THE TYPE IS READ OFF THE EXTENSION, WHICH IS OURS. `uploadName` builds the
 * filename from the kind `sniffImage` decided off the leading bytes, so the
 * extension is a fact about the file rather than a caller's claim about it. It
 * matters because the document used to declare `image/svg+xml` unconditionally,
 * which is a lie about an owner's PNG and a browser may refuse an icon whose
 * declared type does not match.
 *
 * SHAPE-CHECKED BECAUSE IT REACHES A `src` IN GENERATED TYPESCRIPT — an absolute
 * https URL or one of our own `/u/` upload paths, and nothing else. The value
 * comes out of our own `_meta`, and "it came from us" is how the first person to
 * reach that row through some other route gets an XSS on a customer's site.
 */
export const ICON_TYPES = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  webp: "image/webp", svg: "image/svg+xml",
};

export function siteIconFrom(sent) {
  const raw = typeof sent === "string" ? sent.trim() : "";
  if (!raw) return null;
  const ok = /^https:\/\/[^\s"'<>]+$/i.test(raw)
    || /^\/u\/[a-z0-9][a-z0-9-]{0,80}\/[a-z0-9._-]{1,120}$/i.test(raw);
  if (!ok) return { href: null, type: "", refused: true };
  // AN UNKNOWN EXTENSION IS NOT A REFUSAL. The URL is one we minted or an https
  // address the owner gave us; what we cannot do is CLAIM a type for it, and an
  // absent `type` is a perfectly ordinary `<link rel="icon">` that browsers
  // sniff. Declaring the wrong one is the failure this field exists to stop.
  const ext = (raw.match(/\.([a-z0-9]+)(?:[?#]|$)/i) || [, ""])[1].toLowerCase();
  return { href: raw, type: ICON_TYPES[ext] || "", refused: false };
}
