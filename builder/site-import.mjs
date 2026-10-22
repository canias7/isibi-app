// "MAKE MY SITE LIKE MY OLD ONE" (owner-approved ideas #25 and #26, 2026-10-22).
//
// A customer pastes the address of the website they have now, and the builder
// rebuilds it: THE CONTENT IS THEIRS (their words, pages, contact details,
// hours, colours, fonts, logo and photographs), THE DESIGN IS OURS.
//
// NO OUTSIDE PAID SERVICE. The Worker fetches the pages itself, through the
// same SSRF guard every other outbound fetch uses (`safeFetch`, whose host
// rule is `hostIsBlocked` in site-ssrf.mjs), and this module does the rest
// without a network of its own: every fetch arrives through `deps`, so a test
// drives it with fixture HTML and a fake fetcher and reads what it decided.
//
// WHETHER TO IMPORT IS THE ROUTER'S TYPED ANSWER, never a keyword rule: the
// first build's routing tool has an `importSite` field (site-ask.mjs), and
// `readImportSite` below only checks that what the model gave is a public
// http(s) address the customer really wrote.
//
// THE GUARDS, all here so they are testable without the Worker:
//   - http and https only, no credentials in the address, no private,
//     loopback, link-local or metadata host (`hostIsBlocked`), checked on the
//     address the customer gave and on every page and stylesheet followed;
//   - pages and stylesheets on the SAME HOST only (`www.` ignored); photos may
//     sit on a CDN, so they need only a public host;
//   - at most `MAX_PAGES` pages, `MAX_CSS` stylesheets and `MAX_PHOTOS`
//     photographs; every body capped (the fetcher caps the bytes, and this
//     module refuses a body that reached the cap rather than parse half of it
//     for an image, and cuts text to `MAX_PAGE_TEXT`).

import { hostIsBlocked } from "../site-ssrf.mjs";

export const MAX_PAGES = 6;            // the home page and up to five from its menu
export const MAX_CSS = 3;
export const MAX_PHOTOS = 12;
export const MAX_PAGE_TEXT = 4000;     // characters of body text kept per page
export const MAX_TOTAL_TEXT = 16000;   // and across all pages
export const MAX_HTML_BYTES = 1_500_000;
export const MAX_CSS_BYTES = 400_000;
export const MAX_IMAGE_BYTES = 5_000_000;
export const IMPORT_ID_PREFIX = "imported-";
export const IMPORT_LOGO_ID = "imported-logo";

/** A public http(s) URL, as a URL object, or null. */
export function publicUrl(raw, base) {
  let u;
  try { u = base ? new URL(String(raw), base) : new URL(String(raw)); } catch { return null; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (u.username || u.password) return null;
  if (!u.hostname || hostIsBlocked(u.hostname)) return null;
  u.hash = "";
  return u;
}

const bareHost = (h) => String(h || "").toLowerCase().replace(/^www\./, "");

/** Whether two URLs are the same site (host equal, `www.` ignored). */
export function sameSite(a, b) {
  try { return bareHost(new URL(a).hostname) === bareHost(new URL(b).hostname); } catch { return false; }
}

/**
 * The router's `importSite` answer, checked: a public http(s) address whose
 * host appears in the customer's own message. Anything else is undefined —
 * an address the model invented is never fetched. A bare host the customer
 * typed ("oldbakery.co.uk") is read as https.
 */
export function readImportSite(raw, message) {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  if (!t || t.length > 2000) return undefined;
  const u = publicUrl(/^[a-z][a-z0-9+.-]*:/i.test(t) ? t : "https://" + t);
  if (!u) return undefined;
  const host = bareHost(u.hostname);
  if (!host.includes(".")) return undefined;
  if (!String(message || "").toLowerCase().includes(host)) return undefined;
  return u.href;
}

// ── HTML READING (regex-level, which is enough for extraction: nothing here
// executes or re-serves the markup) ─────────────────────────────────────────

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "\u2019", lsquo: "\u2018", rdquo: "\u201d", ldquo: "\u201c", ndash: "\u2013", mdash: "\u2014", hellip: "\u2026", pound: "\u00a3", euro: "\u20ac" };
export function decodeEntities(s) {
  return String(s || "").replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try { return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m; } catch { return m; }
    }
    return Object.hasOwn(ENTITIES, e.toLowerCase()) ? ENTITIES[e.toLowerCase()] : m;
  });
}

const clean = (s) => decodeEntities(String(s || "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

function attrs(tag) {
  const out = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  const body = tag.replace(/^<\s*[a-zA-Z0-9]+/, "").replace(/\/?>$/, "");
  let m;
  while ((m = re.exec(body))) out[m[1].toLowerCase()] = decodeEntities(m[3] ?? m[4] ?? m[5] ?? "");
  return out;
}

const tags = (html, name) => String(html || "").match(new RegExp("<" + name + "\\b[^>]*>", "gi")) || [];

function stripNoise(html) {
  return String(html || "")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|template|svg|iframe)\b[\s\S]*?<\/\1\s*>/gi, " ");
}

function metaContent(html, key) {
  for (const t of tags(html, "meta")) {
    const a = attrs(t);
    if ((a.property || a.name || "").toLowerCase() === key && a.content) return a.content.trim();
  }
  return "";
}

/** The visible text of a page, paragraphs kept as lines. */
export function visibleText(html) {
  const body = (String(html || "").match(/<body\b[^>]*>([\s\S]*)<\/body>/i) || [null, html])[1];
  return decodeEntities(stripNoise(body)
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/section|\/article|\/tr|\/header|\/footer)\b[^>]*>/gi, "\n")
    .replace(/<[^>]*>/g, " "))
    .split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter((l) => l.length > 1)
    .join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function headings(html) {
  const out = [];
  const re = /<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi;
  const src = stripNoise(html);
  let m;
  while ((m = re.exec(src)) && out.length < 20) {
    const t = clean(m[2]);
    if (t && t.length <= 160 && !out.includes(t)) out.push(t);
  }
  return out;
}

/** The business's name: og:site_name, then application-name, then the title's leading part. */
export function businessName(html) {
  const site = metaContent(html, "og:site_name") || metaContent(html, "application-name");
  if (site) return clean(site).slice(0, 120);
  const title = clean((String(html || "").match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
  if (!title) return "";
  const parts = title.split(/\s+[|–—\-:·•]\s+/).map((s) => s.trim()).filter(Boolean);
  // "Home | Fold Lane Bakery" — the generic half is not the name.
  const generic = /^(home|welcome|homepage|home page|index)$/i;
  const named = parts.filter((p) => !generic.test(p));
  return (named.length > 1 ? named[named.length - 1] : named[0] || parts[0] || "").slice(0, 120);
}

/**
 * Same-site links from the page's menu (<nav>, else <header>, else every
 * anchor), absolute, deduped, the home page itself and files left out.
 */
export function navLinks(html, base, max = MAX_PAGES - 1) {
  const src = stripNoise(html);
  const navs = src.match(/<nav\b[\s\S]*?<\/nav\s*>/gi) || src.match(/<header\b[\s\S]*?<\/header\s*>/gi) || [src];
  const home = publicUrl(base);
  const out = [];
  const seen = new Set([home ? home.origin + home.pathname.replace(/\/$/, "") : ""]);
  for (const block of navs) {
    for (const t of tags(block, "a")) {
      const href = attrs(t).href;
      if (!href || /^(mailto|tel|javascript|data):/i.test(href) || href.startsWith("#")) continue;
      const u = publicUrl(href, base);
      if (!u || !sameSite(u.href, base)) continue;
      if (/\.(pdf|jpe?g|png|gif|webp|svg|zip|docx?|xlsx?|mp4|mp3)$/i.test(u.pathname)) continue;
      u.search = "";
      const key = u.origin + u.pathname.replace(/\/$/, "");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(u.href);
      if (out.length >= max) return out;
    }
  }
  return out;
}

const PHONE = /(?:\+|00)?\d[\d\s().-]{7,}\d/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/** Phones, emails and a postal address, from links, schema.org JSON-LD and text. */
export function contactDetails(html, text) {
  const phones = new Set(), emails = new Set();
  let address = "";
  for (const t of tags(html, "a")) {
    const href = attrs(t).href || "";
    if (/^tel:/i.test(href)) phones.add(decodeURIComponent(href.slice(4)).trim());
    if (/^mailto:/i.test(href)) emails.add(decodeURIComponent(href.slice(7).split("?")[0]).trim());
  }
  for (const ld of jsonLd(html)) {
    if (typeof ld.telephone === "string") phones.add(ld.telephone.trim());
    if (typeof ld.email === "string") emails.add(ld.email.replace(/^mailto:/i, "").trim());
    const a = ld.address;
    if (!address && a && typeof a === "object") {
      address = [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode].filter((x) => typeof x === "string" && x.trim()).join(", ");
    } else if (!address && typeof a === "string") address = a.trim();
  }
  for (const m of String(text || "").match(EMAIL) || []) emails.add(m);
  if (!phones.size) for (const m of String(text || "").match(PHONE) || []) { if (m.replace(/\D/g, "").length >= 9) phones.add(m.trim()); if (phones.size >= 3) break; }
  return {
    phones: [...phones].filter(Boolean).slice(0, 3),
    emails: [...emails].filter((e) => !/\.(png|jpe?g|gif|webp|svg)$/i.test(e)).slice(0, 3),
    address: address.slice(0, 200),
  };
}

function jsonLd(html) {
  const out = [];
  const re = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script\s*>/gi;
  let m;
  while ((m = re.exec(String(html || "")))) {
    let j;
    try { j = JSON.parse(m[1].trim()); } catch { continue; }
    const walk = (v) => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") { out.push(v); if (Array.isArray(v["@graph"])) v["@graph"].forEach(walk); }
    };
    walk(j);
  }
  return out;
}

const DAY = "(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(?:day|sday|nesday|urday|rsday)?";
/** Opening hours: schema.org `openingHours` first, else lines of text that name a day and a time. */
export function openingHours(html, text) {
  for (const ld of jsonLd(html)) {
    const h = ld.openingHours;
    if (typeof h === "string" && h.trim()) return [h.trim()];
    if (Array.isArray(h)) { const l = h.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim()); if (l.length) return l.slice(0, 10); }
    const spec = ld.openingHoursSpecification;
    if (Array.isArray(spec) && spec.length) {
      const l = spec.map((s) => {
        if (!s || typeof s !== "object") return "";
        const d = [].concat(s.dayOfWeek || []).map((x) => String(x).replace(/^https?:\/\/schema\.org\//, "")).join(", ");
        return d && s.opens && s.closes ? d + " " + s.opens + "\u2013" + s.closes : "";
      }).filter(Boolean);
      if (l.length) return l.slice(0, 10);
    }
  }
  const re = new RegExp("\\b" + DAY + "\\b.*\\d{1,2}(?:[:.]\\d{2})?\\s*(?:am|pm)?|\\b" + DAY + "\\b.*\\bclosed\\b", "i");
  return String(text || "").split("\n").filter((l) => l.length <= 120 && re.test(l)).slice(0, 10);
}

// ── COLOURS AND FONTS ────────────────────────────────────────────────────────

function hex6(c) {
  let s = String(c).toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(s)) s = "#" + s.slice(1).split("").map((x) => x + x).join("");
  if (/^#[0-9a-f]{8}$/.test(s)) s = s.slice(0, 7);
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  const m = s.match(/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/);
  if (m) return "#" + [m[1], m[2], m[3]].map((n) => Math.min(255, +n).toString(16).padStart(2, "0")).join("");
  return "";
}

// Pure black, white and greys say nothing about a brand; they are counted
// last, never first.
const neutral = (h) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  return Math.max(r, g, b) - Math.min(r, g, b) < 16;
};

/**
 * The brand's colours, most telling first: the `theme-color` meta, then CSS
 * custom properties that name a colour role, then the most used colours in
 * the page's inline styles and its stylesheets. Hex, deduped, at most 8.
 */
export function brandColours(html, cssTexts = []) {
  const css = [...(String(html || "").match(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi) || []), ...tags(html, "[a-z0-9]+").map((t) => attrs(t).style || "").filter(Boolean), ...cssTexts].join("\n");
  const ordered = [];
  const add = (c) => { const h = hex6(c); if (h && !ordered.includes(h)) ordered.push(h); };
  const theme = metaContent(html, "theme-color");
  if (theme) add(theme);
  const varRe = /--[\w-]*(?:primary|brand|accent|secondary|main|theme|highlight)[\w-]*\s*:\s*(#[0-9a-f]{3,8}\b|rgba?\([^)]*\))/gi;
  let m;
  while ((m = varRe.exec(css))) add(m[1]);
  const counts = new Map();
  const anyRe = /#[0-9a-f]{6}\b|#[0-9a-f]{3}\b|rgba?\(\s*\d{1,3}[\s,]+\d{1,3}[\s,]+\d{1,3}[^)]*\)/gi;
  while ((m = anyRe.exec(css))) { const h = hex6(m[0]); if (h) counts.set(h, (counts.get(h) || 0) + 1); }
  const byUse = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([h]) => h);
  for (const h of byUse.filter((h) => !neutral(h))) add(h);
  for (const h of byUse.filter(neutral)) add(h);
  return ordered.slice(0, 8);
}

const GENERIC_FONTS = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-sans-serif", "ui-serif", "ui-monospace", "inherit", "initial", "unset", "-apple-system", "blinkmacsystemfont", "segoe ui", "roboto", "helvetica", "helvetica neue", "arial", "sans", "emoji", "apple color emoji", "segoe ui emoji", "noto color emoji", "times new roman", "times", "georgia", "verdana", "tahoma"]);

/** Font families: Google Fonts links first, then `font-family` declarations, generic stacks left out. */
export function fontFamilies(html, cssTexts = []) {
  const out = [];
  const add = (f) => {
    const n = String(f || "").replace(/["']/g, "").replace(/\+/g, " ").trim();
    if (!n || n.length > 60 || n.startsWith("var(") || GENERIC_FONTS.has(n.toLowerCase())) return;
    if (!out.some((x) => x.toLowerCase() === n.toLowerCase())) out.push(n);
  };
  for (const t of tags(html, "link")) {
    const href = attrs(t).href || "";
    if (!/fonts\.googleapis\.com\/css/i.test(href)) continue;
    let u;
    try { u = new URL(href, "https://fonts.googleapis.com"); } catch { continue; }
    for (const fam of u.searchParams.getAll("family")) for (const one of fam.split("|")) add(one.split(":")[0]);
  }
  const css = [...(String(html || "").match(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi) || []), ...cssTexts].join("\n");
  for (const m of css.matchAll(/@import\s+url\(\s*["']?([^"')]+fonts\.googleapis\.com[^"')]+)/gi)) {
    try { for (const fam of new URL(m[1]).searchParams.getAll("family")) add(fam.split(":")[0]); } catch { /* not a URL */ }
  }
  for (const m of css.matchAll(/font-family\s*:\s*([^;}{]+)/gi)) add(m[1].split(",")[0]);
  return out.slice(0, 4);
}

/** Stylesheets the page links, same site only, absolute. */
export function stylesheetLinks(html, base, max = MAX_CSS) {
  const out = [];
  for (const t of tags(html, "link")) {
    const a = attrs(t);
    if (!/\bstylesheet\b/i.test(a.rel || "") || !a.href) continue;
    const u = publicUrl(a.href, base);
    if (!u || !sameSite(u.href, base) || out.includes(u.href)) continue;
    out.push(u.href);
    if (out.length >= max) break;
  }
  return out;
}

// ── LOGO AND PHOTOGRAPHS ─────────────────────────────────────────────────────

const LOGO_WORD = /logo|brand|wordmark/i;
const SKIP_IMG = /sprite|pixel|spacer|tracking|placeholder|blank\.gif|loader|spinner|icon-|\/icons?\//i;

function imgSrc(a) {
  const set = a.srcset || a["data-srcset"] || "";
  if (set) {
    const best = set.split(",").map((s) => s.trim().split(/\s+/)).map(([u, w]) => ({ u, w: parseInt(w, 10) || 0 })).sort((x, y) => y.w - x.w)[0];
    if (best && best.u) return best.u;
  }
  return a.src || a["data-src"] || a["data-lazy-src"] || "";
}

/** The logo: an <img> that says logo, then apple-touch-icon, then og:image only when nothing else. */
export function findLogo(html, base) {
  const src = stripNoise(html);
  for (const t of tags(src, "img")) {
    const a = attrs(t);
    const s = imgSrc(a);
    if (s && (LOGO_WORD.test(s) || LOGO_WORD.test(a.alt || "") || LOGO_WORD.test(a.class || "") || LOGO_WORD.test(a.id || ""))) {
      const u = publicUrl(s, base);
      if (u) return { url: u.href, alt: (a.alt || "").trim().slice(0, 160) };
    }
  }
  for (const t of tags(html, "link")) {
    const a = attrs(t);
    if (/apple-touch-icon/i.test(a.rel || "") && a.href) {
      const u = publicUrl(a.href, base);
      if (u) return { url: u.href, alt: "" };
    }
  }
  return null;
}

/**
 * The content photographs: og:image, then <img> that are not icons, logos or
 * trackers and are not declared smaller than 200px, deduped, at most `max`.
 */
export function findPhotos(html, base, { max = MAX_PHOTOS, skip = [] } = {}) {
  const out = [];
  const seen = new Set(skip);
  const add = (raw, alt) => {
    const u = publicUrl(raw, base);
    if (!u || seen.has(u.href) || out.length >= max) return;
    if (!/^https?:/.test(u.href) || /\.svg(\?|$)/i.test(u.href) || SKIP_IMG.test(u.href)) return;
    seen.add(u.href);
    out.push({ url: u.href, alt: String(alt || "").trim().slice(0, 160) });
  };
  const og = metaContent(html, "og:image");
  if (og) add(og, metaContent(html, "og:image:alt"));
  for (const t of tags(stripNoise(html), "img")) {
    const a = attrs(t);
    const s = imgSrc(a);
    if (!s || s.startsWith("data:")) continue;
    if (LOGO_WORD.test(s) || LOGO_WORD.test(a.alt || "") || LOGO_WORD.test(a.class || "")) continue;
    const w = parseInt(a.width, 10), h = parseInt(a.height, 10);
    if ((w && w < 200) || (h && h < 150)) continue;
    add(s, a.alt);
  }
  return out;
}

// ── THE WHOLE EXTRACT ────────────────────────────────────────────────────────

/**
 * Everything taken from the fetched pages. `pages` is `[{ url, html }]`, the
 * home page first; `cssTexts` the stylesheets read. Pure.
 */
export function extractSite(pages, cssTexts = []) {
  const list = (Array.isArray(pages) ? pages : []).filter((p) => p && typeof p.url === "string" && typeof p.html === "string");
  if (!list.length) return null;
  const home = list[0];
  let room = MAX_TOTAL_TEXT;
  const outPages = list.map((p) => {
    const text = visibleText(p.html);
    const keep = Math.max(0, Math.min(MAX_PAGE_TEXT, room, text.length));
    room -= keep;
    let path = "/";
    try { path = new URL(p.url).pathname || "/"; } catch { /* kept as home */ }
    const title = clean((p.html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "").slice(0, 160);
    return { url: p.url, path, title, headings: headings(p.html), text: text.slice(0, keep), ...(keep < text.length ? { cut: true } : {}) };
  });
  const allHtml = list.map((p) => p.html).join("\n");
  const allText = outPages.map((p) => p.text).join("\n");
  const logo = findLogo(home.html, home.url);
  const photos = [];
  for (const p of list) {
    for (const ph of findPhotos(p.html, p.url, { max: MAX_PHOTOS - photos.length, skip: [logo && logo.url, ...photos.map((x) => x.url)].filter(Boolean) })) photos.push(ph);
    if (photos.length >= MAX_PHOTOS) break;
  }
  return {
    url: home.url,
    name: businessName(home.html),
    description: clean(metaContent(home.html, "description") || metaContent(home.html, "og:description")).slice(0, 300),
    pages: outPages,
    contact: contactDetails(allHtml, allText),
    hours: openingHours(allHtml, allText),
    colours: brandColours(home.html, cssTexts),
    fonts: fontFamilies(home.html, cssTexts),
    logo,
    photos,
  };
}

/**
 * Fetch and extract. `deps.fetchText(url, cap)` → `{ ok, status?, body?,
 * contentType?, url? }` (the Worker's guarded fetch; `url` the address after
 * redirects). Never throws; `{ ok: false, reason }` in words the customer can
 * act on when the home page cannot be read.
 */
export async function importSite(rawUrl, deps) {
  const start = publicUrl(rawUrl);
  if (!start) return { ok: false, reason: "that isn't a public web address we can open" };
  const get = async (u, cap) => {
    try { return await deps.fetchText(u, cap); } catch { return { ok: false }; }
  };
  const isHtml = (r) => !r.contentType || /^(text\/html|application\/xhtml\+xml)/i.test(r.contentType);
  const first = await get(start.href, MAX_HTML_BYTES);
  if (!first || !first.ok || typeof first.body !== "string") {
    const s = first && first.status;
    return { ok: false, reason: s === 401 || s === 403 ? "it blocked us" : s === 404 ? "that page wasn't there" : s ? "it answered " + s : "we couldn't reach it" };
  }
  if (!isHtml(first)) return { ok: false, reason: "that address isn't a web page" };
  // A redirect may move the site to its real host (http → https, bare → www);
  // that host, if still public, is the one "same site" means from here on.
  const landed = (first.url && publicUrl(first.url)) || start;
  if (!sameSite(landed.href, start.href) && !publicUrl(landed.href)) return { ok: false, reason: "we couldn't reach it" };
  const pages = [{ url: landed.href, html: first.body }];
  for (const link of navLinks(first.body, landed.href)) {
    if (pages.length >= MAX_PAGES) break;
    if (!sameSite(link, landed.href)) continue;
    const r = await get(link, MAX_HTML_BYTES);
    if (!r || !r.ok || typeof r.body !== "string" || !isHtml(r)) continue;
    if (r.url && !sameSite(r.url, landed.href)) continue;   // redirected off the site
    pages.push({ url: link, html: r.body });
  }
  const css = [];
  for (const href of stylesheetLinks(first.body, landed.href)) {
    const r = await get(href, MAX_CSS_BYTES);
    if (r && r.ok && typeof r.body === "string") css.push(r.body.slice(0, MAX_CSS_BYTES));
  }
  const extract = extractSite(pages, css);
  return extract ? { ok: true, extract } : { ok: false, reason: "there was no readable text on it" };
}

/**
 * THE BLOCK THE DESIGNER AND THE PAGE WRITER READ, headed "THEIR CURRENT
 * SITE". The photos and the logo are listed by id so the designer can put one
 * on a page through `images[].attached`, exactly as it names an attached file.
 */
export function importBriefBlock(extract) {
  const x = extract && typeof extract === "object" ? extract : null;
  if (!x) return "";
  const lines = ["", "", "THEIR CURRENT SITE (" + x.url + "). The customer asked for their existing website to be rebuilt. " +
    "THE CONTENT IS THEIRS: keep their business name, their words, their pages, their contact details and hours, and their " +
    "brand colours and fonts as the starting point of the look. THE DESIGN IS OURS: lay it out better than the old site — " +
    "do not copy its layout. Do not invent facts the old site does not state."];
  if (x.name) lines.push("Business name: " + x.name);
  if (x.description) lines.push("How they describe themselves: " + x.description);
  if (x.colours && x.colours.length) lines.push("Brand colours, most telling first: " + x.colours.join(", "));
  if (x.fonts && x.fonts.length) lines.push("Fonts: " + x.fonts.join(", "));
  const c = x.contact || {};
  if (c.phones && c.phones.length) lines.push("Phone: " + c.phones.join(", "));
  if (c.emails && c.emails.length) lines.push("Email: " + c.emails.join(", "));
  if (c.address) lines.push("Address: " + c.address);
  if (x.hours && x.hours.length) lines.push("Opening hours: " + x.hours.join("; "));
  for (const p of x.pages || []) {
    lines.push("", "PAGE " + p.path + (p.title ? ' — "' + p.title + '"' : ""));
    if (p.headings && p.headings.length) lines.push("Headings: " + p.headings.join(" / "));
    if (p.text) lines.push(p.text + (p.cut ? "\n[…the rest of this page was cut]" : ""));
  }
  const ids = importedImages(x);
  if (ids.length) {
    lines.push("", "THEIR OWN PICTURES FROM THAT SITE, each with its id. To show one, put it in `images` with `attached` set to its id exactly as written; it is then published as it is and nothing is drawn or bought:");
    for (const i of ids) lines.push("  " + i.id + " — " + (i.id === IMPORT_LOGO_ID ? "their logo" : "a photograph") + (i.alt ? ' ("' + i.alt.replace(/"/g, "'") + '")' : ""));
  }
  return lines.join("\n");
}

/** The pictures by id: `imported-logo` for the logo, `imported-1…n` for the photos. */
export function importedImages(extract) {
  const x = extract && typeof extract === "object" ? extract : {};
  const out = [];
  if (x.logo && typeof x.logo.url === "string") out.push({ id: IMPORT_LOGO_ID, url: x.logo.url, alt: x.logo.alt || "" });
  (Array.isArray(x.photos) ? x.photos : []).slice(0, MAX_PHOTOS).forEach((p, i) => {
    if (p && typeof p.url === "string") out.push({ id: IMPORT_ID_PREFIX + (i + 1), url: p.url, alt: p.alt || "" });
  });
  return out;
}

const IMAGE_TYPES = /^image\/(png|jpeg|webp|gif)$/;
const EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };

/**
 * Copy the imported pictures the plan placed into the site's own uploads and
 * point each entry at its copy — the counterpart of `placeAttachedPhotos`.
 * `deps.fetchBytes(url, cap)` → `{ ok, bytes, contentType }`; `deps.store(name,
 * bytes)` → `{ url }` or `{ error }`. Only entries whose `attached` is an
 * imported id are touched. A picture that is not a png/jpeg/webp/gif, that
 * reached the byte cap, or that the store refused is reported in `missing`,
 * never bought instead.
 */
export async function placeImportedPhotos(images, extract, deps) {
  const list = Array.isArray(images) ? images : null;
  if (!list) return { images, placed: [], missing: [] };
  const byId = new Map(importedImages(extract).map((i) => [i.id, i]));
  const placed = [], missing = [], out = [], done = new Map();
  for (const e of list) {
    const ref = e && typeof e === "object" && typeof e.attached === "string" ? e.attached : "";
    if (!ref.startsWith(IMPORT_ID_PREFIX) || e.src) { out.push(e); continue; }
    const pic = byId.get(ref);
    if (!pic) { missing.push({ ref, name: ref, page: e.page, reason: "no picture from your old site has that id" }); continue; }
    let r = done.get(ref);
    if (!r) {
      r = await copyOne(pic, deps);
      done.set(ref, r);
    }
    if (!r.url) { missing.push({ ref, name: pic.alt || ref, page: e.page, reason: r.error }); continue; }
    out.push({ ...e, src: r.url });
    placed.push({ id: ref, name: pic.alt || ref, url: r.url, page: e.page });
  }
  return { images: out, placed, missing };
}

async function copyOne(pic, deps) {
  if (!publicUrl(pic.url)) return { error: "its address isn't public" };
  let got;
  try { got = await deps.fetchBytes(pic.url, MAX_IMAGE_BYTES); } catch { got = null; }
  if (!got || !got.ok || !(got.bytes instanceof Uint8Array)) return { error: "it couldn't be downloaded" };
  const ct = String(got.contentType || "").split(";")[0].trim().toLowerCase();
  if (!IMAGE_TYPES.test(ct)) return { error: "it isn't a photo we can use" };
  if (got.bytes.length >= MAX_IMAGE_BYTES) return { error: "it's too large" };
  if (!got.bytes.length) return { error: "it was empty" };
  let r;
  try { r = await deps.store(pic.id + "." + EXT[ct], got.bytes); } catch (err) { r = { error: String((err && err.message) || err).slice(0, 120) }; }
  return r && typeof r.url === "string" && r.url ? { url: r.url } : { error: (r && r.error) || "it could not be stored" };
}
