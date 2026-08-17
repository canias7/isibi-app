// What a published site looks like when somebody SHARES it.
//
// A generated site had a `<title>` and nothing else — no description, no Open
// Graph tags — and its `<div id="root">` is empty until JavaScript runs. Google
// runs JavaScript, so it indexes eventually. **Link previews do not.** WhatsApp,
// iMessage, Slack, Facebook and LinkedIn all fetch the HTML once, read the head,
// and render whatever is there.
//
// Which meant a barber shop sending customers their own link got a bare URL with
// no name, no description and no picture. For a small business that link IS the
// marketing, and it was blank on every site the builder has ever published.
//
// Injected at publish time rather than generated into the page, because the head
// belongs to the built dist and the model never sees it.

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ESC[c]);

const MAX_TITLE = 70;
const MAX_DESC = 200;

/** Marks our block so a rebuild replaces it instead of stacking another copy. */
const OPEN = "<!--isibi:meta-->";
const CLOSE = "<!--/isibi:meta-->";

/**
 * The file whose PRESENCE means "this site is published".
 *
 * IT EXISTS BECAUSE START TOOK THE OLD SIGNAL AWAY. A published site used to be
 * served from a document in R2, so wiping `sites/<slug>/` made every page 404 —
 * that miss WAS the take-down, and both site deletion and the offline switch
 * rely on it. Under Start the document is rendered from the script's own bundle
 * and needs no R2 at all, so a site whose files are gone kept serving: measured
 * by the container harness as "200 — a deleted site is still serving".
 *
 * A MISS IS PERMANENT AND A THROW IS TRANSIENT, which is the distinction the old
 * entry drew explicitly and which was lost with it. An R2 blip must not take a
 * live site down; an absent marker means somebody deleted the site.
 *
 * ONE R2 HEAD PER DOCUMENT, which is not a new cost: serving a page WAS one R2
 * get before this tier existed, and a head is cheaper than the get it replaces.
 * Not cached per isolate, deliberately — "take this site offline" that waits for
 * an isolate to recycle is not offline.
 *
 * INSIDE `sites/<slug>/` on purpose, unlike the meta sidecar: it has to be wiped
 * by exactly the same prefix sweep that takes the site down, or it would outlive
 * what it is a marker for.
 */
export const SITE_LIVE_FILE = "site.live";

/**
 * Where a site's publish-time meta lives.
 *
 * THE SITE'S OWN WORKER READS THIS KEY and the platform writes it, so it is one
 * expression rather than two spellings — the drift class this repo has recorded
 * repeatedly, and here it would be silent: a mismatched key reads as a site with
 * no description rather than as an error.
 *
 * The template cannot import this module (it is built separately), so
 * `src/server.ts` carries the only other copy and a test holds the two together.
 *
 * OUTSIDE `sites/<slug>/`, which is the served prefix AND the one the publish
 * sweep wipes. Under it, this file would be both publicly fetchable and deleted
 * by the next publish of the site that depends on it.
 */
export function siteMetaKey(slug) {
  return "sitemeta/" + String(slug || "") + ".json";
}

/**
 * Build the head fragment. Pure, so what goes into a published page is testable
 * without R2, a build, or a browser.
 */
export function metaTags(meta) {
  // `= {}` only defaults `undefined`, not `null` — and a caller with nothing to
  // say passes null far more naturally than it omits the argument. Destructuring
  // it directly threw.
  const { brand, description, url, image, slug, routesCsv, redirectsCsv } = meta || {};
  const title = String(brand || "").trim().slice(0, MAX_TITLE);
  // Collapse whitespace: a description written across lines becomes one line in
  // a preview anyway, and a raw newline inside an attribute is a broken tag.
  const desc = String(description || "").replace(/\s+/g, " ").trim().slice(0, MAX_DESC);
  // THE SLUG IS ITS OWN REASON TO EMIT THIS BLOCK, so the early return below
  // asks about it too. A site with no brand and no description still has to
  // know its own name, and without this line the head would be skipped and
  // every data call on a custom domain would go to the wrong site.
  const site = /^[a-z0-9][a-z0-9-]{0,80}$/i.test(String(slug || "")) ? String(slug).toLowerCase() : "";
  if (!title && !desc && !site) return "";

  const t = [];
  // WHICH SITE THIS IS, read by `siteSlug()` in @/lib/rows.
  //
  // Not decoration and not for a crawler. A published site normally learns its
  // own slug from the path — `/s/<slug>/` — and ON A CUSTOM DOMAIN THERE IS NO
  // SUCH PATH: the page is served at `/`, the match fails, and the client falls
  // back to the build-time default. Every read and every form on the site would
  // then address a DIFFERENT site's API. Injected here because this is the one
  // place that rewrites the built head, which the model never sees.
  if (site) t.push(`<meta name="site-slug" content="${esc(site)}">`);
  // THE SITE'S OWN MANIFEST — the route list and the redirect map, read back by
  // the Worker's SPA fallback (site-seo.mjs composes and parses both). They ride
  // in this fenced block so a republish REPLACES them: a manifest that stacked
  // would keep answering for routes deleted two publishes ago. Home page only —
  // the fallback reads index.html and nothing else — pre-encoded by the caller
  // because this module is a leaf and stays one.
  if (typeof routesCsv === "string" && routesCsv) t.push(`<meta name="site-routes" content="${esc(routesCsv)}">`);
  if (typeof redirectsCsv === "string" && redirectsCsv) t.push(`<meta name="site-redirects" content="${esc(redirectsCsv)}">`);
  if (desc) t.push(`<meta name="description" content="${esc(desc)}">`);
  if (title) t.push(`<meta property="og:title" content="${esc(title)}">`);
  if (desc) t.push(`<meta property="og:description" content="${esc(desc)}">`);
  t.push('<meta property="og:type" content="website">');
  if (url) t.push(`<meta property="og:url" content="${esc(url)}">`);
  if (image) {
    t.push(`<meta property="og:image" content="${esc(image)}">`);
    // summary_large_image only renders large if there IS an image; without one
    // it produces an empty box, so the card type follows the picture.
    t.push('<meta name="twitter:card" content="summary_large_image">');
  } else {
    t.push('<meta name="twitter:card" content="summary">');
  }
  if (title) t.push(`<meta name="twitter:title" content="${esc(title)}">`);
  if (desc) t.push(`<meta name="twitter:description" content="${esc(desc)}">`);
  if (image) t.push(`<meta name="twitter:image" content="${esc(image)}">`);
  return OPEN + t.join("") + CLOSE;
}

/**
 * Put the tags in a built page's head.
 *
 * Idempotent by construction: an existing block is replaced, so republishing a
 * site fifty times leaves one copy rather than fifty. Never touches anything
 * else in the document — the dist is Vite's output and this is not the place to
 * be clever with it.
 *
 * Returns the html unchanged when there is nothing to say or nowhere to put it.
 * A site published without a description is worse than one that fails to build,
 * so this can only ever be a no-op, never an error.
 */
export function injectMeta(html, meta) {
  const src = String(html == null ? "" : html);
  const tags = metaTags(meta);
  const stripped = src.replace(new RegExp(OPEN + "[\\s\\S]*?" + CLOSE, "g"), "");
  if (!tags) return stripped;

  // After <title> when there is one, so the human-readable bits sit together;
  // otherwise straight after <head>.
  const titleEnd = stripped.search(/<\/title\s*>/i);
  if (titleEnd >= 0) {
    const at = titleEnd + stripped.slice(titleEnd).match(/<\/title\s*>/i)[0].length;
    return stripped.slice(0, at) + tags + stripped.slice(at);
  }
  const head = stripped.match(/<head[^>]*>/i);
  if (head) {
    const at = stripped.indexOf(head[0]) + head[0].length;
    return stripped.slice(0, at) + tags + stripped.slice(at);
  }
  // No head at all — not a document we understand, so leave it exactly as it is.
  return stripped;
}

/**
 * What THIS page should say about itself, derived from what it rendered.
 *
 * Every page of a published site used to share one set of tags, because every
 * page shared one document. Now each route is prerendered to its own file, so a
 * booking page pasted into WhatsApp can preview as the booking page instead of
 * the home page.
 *
 * READ OFF THE PAGE'S OWN MARKUP, not from a second thing the model has to
 * write. The prerendered body already contains the heading and the opening
 * sentence the model chose; asking for them again is a field that can disagree
 * with the page, and this codebase has that failure written down several times
 * over.
 *
 * The home page is deliberately EXEMPT: its site-level description is written by
 * the designer for exactly this purpose, and it beats a paragraph scraped from a
 * hero. Anything this cannot work out falls back to the site-level values, so
 * the worst case is what every page had before.
 */
export function pageMeta(html, base, { home = false, route } = {}) {
  const meta = { ...(base || {}) };
  if (home) return meta;
  const src = String(html == null ? "" : html);

  // AND `og:url` MOVES WITH THE PAGE. It did not, and every prerendered page on
  // every published site named the site's HOME page — a repeat finding, raised
  // 2026-08-09 and still true five days later. So a booking page shared into
  // WhatsApp carried the right title and description over a URL pointing
  // somewhere else, and a crawler was told two addresses are one page.
  //
  // `base.url` is the site's own origin-plus-mount, whatever that is on this
  // publish (the app zone, the subdomain, the owner's own domain), so appending
  // the route is right on all three. An unknown route leaves it exactly as it is
  // today — the absent-means-today's-behaviour rule the manifest already uses.
  if (route && base && base.url) meta.url = String(base.url).replace(/\/+$/, "") + route;

  // The words inside a tag, with markup removed and character references
  // DECODED rather than deleted.
  //
  // IT STRIPPED THEM, AND THAT WAS WRONG TWICE OVER. The old rule was
  // `/&[a-z]+;|&#\d+;/gi` → a space, which mangled the entities it matched and
  // missed the one that matters most:
  //
  //   - HEX REFERENCES WERE NOT MATCHED AT ALL, and `&#x27;` is exactly what the
  //     prerenderer emits for a straight apostrophe. Measured against this
  //     template's own React: `renderToString` turns "Mo's Cuts & the barber's
  //     chair" into `Mo&#x27;s Cuts &amp; the barber&#x27;s chair`. So every
  //     share preview and every per-page title derived from prerendered text
  //     carried a literal `&#x27;` where an apostrophe belonged — visible
  //     garbage in a WhatsApp card, on any business with a possessive in its
  //     name.
  //   - THE ONES IT DID MATCH BECAME A SPACE, so "Mo&#39;s Cuts" read as
  //     "Mo s Cuts" — a different mangling of the same name.
  //
  // Decoding is the correct layering and is safe by construction: every value
  // this returns goes out through `esc` (or `setTitle`'s own escaper), so a `<`
  // or `&` recovered here is re-escaped at the boundary. Decode at the reader,
  // escape at the writer.
  //
  // A numeric reference outside Unicode is left exactly as it was rather than
  // throwing — `String.fromCodePoint` raises on an invalid code point, and a
  // malformed page must cost its own meta at most.
  const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  const decode = (s) => s
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => { const n = parseInt(h, 16); return n <= 0x10ffff ? String.fromCodePoint(n) : m; })
    .replace(/&#(\d+);/g, (m, d) => { const n = parseInt(d, 10); return n <= 0x10ffff ? String.fromCodePoint(n) : m; })
    .replace(/&([a-z]+);/gi, (m, n) => (Object.hasOwn(NAMED, n.toLowerCase()) ? NAMED[n.toLowerCase()] : m));
  const textOf = (re) => {
    const m = src.match(re);
    if (!m) return "";
    return decode(m[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  };

  // THE PAGE'S OWN HEADING, falling back to `<h2>`.
  //
  // `<h1>` alone was not enough, and the reason is structural rather than bad
  // luck: only 11 of the kit's components render an `<h1>` and 49 render an
  // `<h2>`, so a page assembled from SECTIONS has none at all. Measured on a
  // real build 2026-08-13 — a barber shop's `/work` is `SiteChrome >
  // SectionHeader + Gallery + CtaBand`, `SectionHeader` is an `<h2>` (correctly,
  // it heads a section), and the page therefore carried the HOME page's title.
  // Confirmed independently against the generator's own committed output: of 9
  // real pages, the one with no `<h1>` is `work.tsx`, on a different site.
  //
  // A gallery page's first `<h2>` is what that page is about, so it is a good
  // title. The risk is a page with several sections, where the first heading is
  // a sub-topic rather than the subject — still strictly better than repeating
  // the site name on every page of the site, which is what happened before.
  const h1 = textOf(/<h1[^>]*>([\s\S]{0,400}?)<\/h1>/i)
    || textOf(/<h2[^>]*>([\s\S]{0,400}?)<\/h2>/i);
  // Suffixed with the brand rather than replacing it: a preview card reading
  // "Book a chair" alone does not say whose chair.
  if (h1 && h1.length <= 70) {
    // COMPARED ON WORDS, WITH PUNCTUATION NORMALISED OUT OF BOTH SIDES.
    //
    // This was written when `textOf` STRIPPED `&amp;` to a space, so a heading
    // reading "Fade & Co Barbershop — the work" arrived as "Fade Co Barbershop
    // — the work" and a plain `includes` of the raw brand MISSED, appending the
    // suffix and saying the business twice. `textOf` decodes now, so the two
    // sides agree on the ampersand as well — but the normalisation stays and is
    // still what does the work: a heading and a brand can differ by a dash, a
    // comma or a curly apostrophe and still be the same name.
    const key = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    meta.brand = base && base.brand && !key(h1).includes(key(base.brand))
      ? h1 + " · " + base.brand
      : h1;
  }

  const p = textOf(/<p[^>]*>([\s\S]{0,600}?)<\/p>/i);
  // Long enough to be a sentence and not a label. A three-word caption under a
  // heading makes a worse preview than the site's own description.
  if (p.length >= 40) meta.description = p.slice(0, 200);

  return meta;
}

/**
 * The document title, which is a different thing from the share tags.
 *
 * `injectMeta` deliberately touches nothing but its own fenced block, and it is
 * right not to — the dist is Vite's output. But a prerendered page copies the
 * shell's head, so without this every page of a site carries the brand as its
 * `<title>`: one browser tab name for four pages, and one heading in a search
 * result. Separate function, separate decision, both testable.
 *
 * A no-op when there is no title element or nothing to say — the same rule as
 * the tags: a page with a plain title is a far smaller problem than a broken one.
 */
// ONE PATTERN, TWO USES. It was written out twice — once to ask whether there
// is a title and once to replace it — and while the two literals agree, the
// presence check below CANNOT change the answer: `String.replace` with no match
// returns the string unchanged, so both paths give back `src`.
//
// Measured, not assumed: a mutation deleting the check survives every
// behavioural test there is, and none could ever catch it, because nothing
// observable separates "returned early" from "replaced nothing". Kept rather
// than deleted — it holds by the two patterns being identical, which is exactly
// one edit away from being false, and a broader test than replace is how a page
// would gain a `<title>` somewhere nobody wanted one. Sharing the constant is
// what makes that guarantee real instead of a coincidence between two literals,
// and `test/site-meta.test.mjs` holds the sharing STRUCTURALLY for the same
// reason: it is the only kind of assertion this property admits.
const TITLE_TAG = /<title[^>]*>[\s\S]*?<\/title\s*>/i;

export function setTitle(html, title) {
  const src = String(html == null ? "" : html);
  const t = String(title == null ? "" : title).replace(/\s+/g, " ").trim().slice(0, 70);
  if (!t || !TITLE_TAG.test(src)) return src;
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // A FUNCTION REPLACER, never a concatenated string. String.replace treats
  // `$$`, `$&` and `$'` in the replacement as PATTERNS — so a title reading
  // "Win $$$ prizes" published as "Win $$ prizes", `$&` re-inserted the old
  // title inside the new one, and "Mo$'s Cuts" — an ordinary stylised trading
  // name — spliced everything after the old title back into the document,
  // doubling the head (2026-08-13 audit, each verified with this module). A
  // function's return value is inserted VERBATIM, which closes the whole class.
  return src.replace(TITLE_TAG, () => "<title>" + esc(t) + "</title>");
}
