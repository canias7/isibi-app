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
 * Build the head fragment. Pure, so what goes into a published page is testable
 * without R2, a build, or a browser.
 */
export function metaTags(meta) {
  // `= {}` only defaults `undefined`, not `null` — and a caller with nothing to
  // say passes null far more naturally than it omits the argument. Destructuring
  // it directly threw.
  const { brand, description, url, image, slug } = meta || {};
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
