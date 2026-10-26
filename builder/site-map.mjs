/**
 * THE ONE SITE MAP (2026-10-26, the owner's decision: every step "knows
 * everything").
 *
 * Before this, each step carried its own partial description of the site: the
 * router's inventory (`route-inventory.mjs`), the add-on's `siteFacts` and
 * `siteNote`, the conversation's `readConverseContext`, the row designer's
 * required columns, the frame writer's menu reader, the landmark map, the
 * theme note and the photo inventory. None of them knew where the site's
 * key details live, so a request for "the opening hours" aimed at /contact
 * answered no-match when the hours were written once, in the footer part
 * every page shares.
 *
 * This is one structured description, built DETERMINISTICALLY from the
 * site's stored source and its live schema, with no model call:
 *
 *   pages   route, file, title, headings, kit sections, own parts, a form,
 *           the tables it reads and writes
 *   parts   each shared part's file and the routes that render it
 *   facts   KEY TEXT FACTS — contact details, opening hours, prices,
 *           addresses — each with every file and route it is written in,
 *           and whether it is shared (written in a part several routes
 *           render, or on several routes)
 *   tables  columns (type, required, default) and who may read and write
 *   links   page ↔ table: reads, writes, form
 *   frame   the menu's items, the header's button, the footer's details,
 *           social links and small print (the menu editor's own readers)
 *   theme   the stylesheet's custom properties and font families
 *   photos  each picture's address and description, by file
 *
 * A part that could not be read is `null`, never an empty list (cannot-tell
 * never reads as a value). `mapFor(kind)` hands each step its slice.
 *
 * Facts, never rules: a slice says what the site holds and where; it never
 * tells a model what to do with it.
 */
import { extractText } from "./site-text.mjs";
import { routeOf } from "./site-addon.mjs";
import { partPath } from "./site-files.mjs";
import { pageFacts, frameFacts } from "./route-inventory.mjs";

export const MAP_VERSION = 1;
const MAX_FACTS = 80;
const MAX_LOCS = 12;
const MAX_PHOTOS = 60;
const MAX_TOKENS = 40;
const NAME = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;

const oneLine = (s) => String(s).replace(/\s+/g, " ").trim();
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

// ── RECOGNISERS OF WHAT A STRING IS (content, not a request's words) ─────────
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[a-z]{2,}/i;
const PHONE = /(?:\+\d|\(?\b0\d)[\d\s().-]{6,}\d/;
const DAY = "(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\\.?";
const TIME = "\\d{1,2}(?:[:.]\\d{2})?\\s?(?:am|pm)?";
const HOURS = new RegExp("\\b" + DAY + "\\b[^]*?(?:" + TIME + "|closed)|\\b\\d{1,2}(?:[:.]\\d{2})?\\s?(?:am|pm)\\b|\\b\\d{1,2}[:.]\\d{2}\\s?[–—-]\\s?\\d{1,2}[:.]\\d{2}\\b", "i");
const PRICE = /(?:[£$€¥₹]\s?\d[\d,]*(?:\.\d{1,2})?|\b\d[\d,]*(?:\.\d{1,2})?\s?(?:€|£|kr|zł)(?![\w]))/;
const POSTCODE = /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/;
const STREET = /\b\d{1,5}[a-z]?\s+(?:[A-Z][\w'’-]*\s+){1,4}(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Way|Drive|Dr|Place|Pl|Square|Sq|Row|Close|Terrace|Boulevard|Blvd|Court|Ct|Hill|Gardens|Crescent|Parade|Mews|Walk|Quay|Wharf)\b\.?/;

/** The kind of key fact a string is, or "" when it is ordinary copy. */
export function factKind(text) {
  const s = typeof text === "string" ? text : "";
  if (!s || s.length > 240) return "";
  if (EMAIL.test(s)) return "email";
  const digits = (s.match(/\d/g) || []).length;
  if (PHONE.test(s) && digits >= 8 && !PRICE.test(s)) return "phone";
  if (POSTCODE.test(s) || STREET.test(s)) return "address";
  if (HOURS.test(s)) return "hours";
  if (PRICE.test(s)) return "price";
  return "";
}

const PART_IMPORT = /from\s*["']@\/routes\/-parts\/([A-Za-z0-9_.-]+?)(?:\.tsx?)?["']/g;
const NAMED_PART = /import\s+([A-Z][\w$]*)\s+from\s*["']@\/routes\/-parts\/([A-Za-z0-9_.-]+?)(?:\.tsx?)?["']/g;
const MAX_BLOCKS = 16;
const IMG = /<(?:img|SafeImage)\b([^>]*?)\/?>/g;
const ATTR = (name) => new RegExp("\\b" + name + "\\s*=\\s*[\"']([^\"']{1,400})[\"']");

/** The parts a source imports, by stored name. */
export function partsImported(source) {
  const out = [];
  for (const m of String(source || "").matchAll(PART_IMPORT)) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}

/**
 * THE PAGE'S BLOCKS, IN THE ORDER IT RENDERS THEM (2026-10-26, the owner:
 * "the map again, isn't the map in everything already"). A page built in
 * bands composes components named by the build (`Band3Split`), each in its
 * own part file; a model shown only those names cannot tell which one is
 * "the reviews section". Each block is named with its component, its file
 * and the first words it shows, read from the part's own source.
 * `[]` when the page composes no part (an inline page): its headings stand.
 */
export function blocksOf(source, partSrc) {
  const src = String(source || "");
  const fileOf = new Map();
  for (const m of src.matchAll(NAMED_PART)) if (!fileOf.has(m[1])) fileOf.set(m[1], m[2]);
  if (!fileOf.size) return [];
  const out = [];
  const seen = new Set();
  for (const m of src.matchAll(/<([A-Z][\w$]*)\b/g)) {
    const name = m[1];
    if (!fileOf.has(name) || seen.has(name)) continue;
    seen.add(name);
    const file = fileOf.get(name);
    const body = partSrc instanceof Map && partSrc.has(file) ? partSrc.get(file) : null;
    let words = null;
    if (typeof body === "string") {
      try { words = extractText(body).map((it) => oneLine(it.text)).filter(Boolean).slice(0, 3).map((t) => clip(t, 60)); } catch { words = null; }
    }
    out.push({ name, file, words });
    if (out.length >= MAX_BLOCKS) break;
  }
  return out;
}

/** `{ from: to }` (a manifest's redirects) as a list, or null when unread. */
function redirectsOf(r) {
  if (!r || typeof r !== "object" || Array.isArray(r)) return null;
  return Object.entries(r).filter(([a, b]) => typeof a === "string" && typeof b === "string" && a.startsWith("/") && b.startsWith("/")).slice(0, 40).map(([from, to]) => ({ from, to }));
}
/** `{ lang, extra }` as `{ main, others }`, or null when unread. */
function languagesOf(l) {
  if (!l || typeof l !== "object") return null;
  const tag = (x) => (typeof x === "string" && /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(x) ? x : null);
  const others = (Array.isArray(l.extra) ? l.extra : []).map((x) => tag(typeof x === "string" ? x : x && x.code)).filter(Boolean);
  return { main: tag(l.lang) || null, others };
}

/** mailto:/tel: targets, which hold a fact even where no text shows it. */
function linkFacts(source) {
  const out = [];
  for (const m of String(source || "").matchAll(/["'](mailto:|tel:)([^"'?]{3,120})/g)) {
    out.push({ text: m[2].trim(), kind: m[1] === "mailto:" ? "email" : "phone", link: true });
  }
  return out;
}

function themeOf(css) {
  if (typeof css !== "string" || !css.trim()) return null;
  const tokens = {};
  for (const m of css.matchAll(/(--[A-Za-z0-9-]{1,48})\s*:\s*([^;{}]{1,120});/g)) {
    if (Object.keys(tokens).length >= MAX_TOKENS) break;
    if (!Object.hasOwn(tokens, m[1])) tokens[m[1]] = oneLine(m[2]);
  }
  const fonts = [];
  for (const m of css.matchAll(/font-family\s*:\s*([^;{}]{1,200})/g)) {
    const first = oneLine(m[1]).split(",")[0].replace(/["']/g, "").trim();
    if (first && !first.startsWith("var(") && !fonts.includes(first)) fonts.push(first);
  }
  for (const m of css.matchAll(/family=([A-Za-z0-9+]+)/g)) {
    const f = m[1].replace(/\+/g, " ");
    if (!fonts.includes(f)) fonts.push(f);
  }
  return { tokens, fonts: fonts.slice(0, 8) };
}

function tableOf(t, label) {
  if (!t || typeof t !== "object" || typeof t.name !== "string" || !NAME.test(t.name)) return null;
  const columns = (Array.isArray(t.columns) ? t.columns : []).slice(0, 40).map((c) => {
    if (typeof c === "string") return NAME.test(c) ? { name: c, type: null, required: null, default: null } : null;
    if (!c || typeof c !== "object" || typeof c.name !== "string" || !NAME.test(c.name)) return null;
    const def = c.default != null ? String(c.default) : c.defaultValue != null ? String(c.defaultValue) : null;
    const nn = c.notnull === true || c.required === true || c.notNull === true;
    const sys = !!(c.pk || c.primary) || c.name === "id" || c.name === "created_at";
    return { name: c.name, type: typeof c.type === "string" ? c.type : null, required: nn && def == null && !sys, default: def };
  }).filter(Boolean);
  let access = "";
  try { access = typeof label === "function" ? oneLine(label(t) || "") : ""; } catch { access = ""; }
  const rules = t.rules && typeof t.rules === "object" ? t.rules : (typeof t.access === "string" ? { access: t.access } : null);
  return { name: t.name, columns, access: access || null, ...(rules ? { rules } : {}) };
}

/**
 * Build the map. `pages` `[{ path, source }]` (stored, bare paths) or null
 * when unread; `parts` `[{ name, source }]` or null; `spec` `{ tables }` or
 * null; `label` an access describer; `css` the stylesheet or null.
 */
export function buildSiteMap({ pages = null, parts = null, spec = null, label = null, css = null, version = null, redirects = null, languages = null, rowCounts = null } = {}) {
  const pageList = Array.isArray(pages) ? pages.filter((p) => p && typeof p.path === "string" && typeof p.source === "string") : null;
  const partList = Array.isArray(parts) ? parts.filter((p) => p && typeof p.name === "string" && typeof p.source === "string") : null;
  const out = {
    v: MAP_VERSION, version: typeof version === "string" ? version : null, pages: null, parts: null, facts: null, tables: null, links: null, frame: null, theme: themeOf(css), photos: null,
    // WHAT ELSE A SITE IS (2026-10-26, the owner: the map covers everything):
    // the addresses that redirect and the languages it is shown in.
    redirects: redirectsOf(redirects), languages: languagesOf(languages),
  };

  // Which routes render each part (directly or through another part).
  const usedBy = new Map();
  const partSrc = new Map((partList || []).map((p) => [p.name, p.source]));
  if (pageList) {
    for (const p of pageList) {
      const r = routeOf(p.path);
      if (!r) continue;
      const seen = new Set();
      const walk = (src, depth) => {
        for (const n of partsImported(src)) {
          if (seen.has(n) || depth > 4) continue;
          seen.add(n);
          if (!usedBy.has(n)) usedBy.set(n, []);
          if (!usedBy.get(n).includes(r)) usedBy.get(n).push(r);
          if (partSrc.has(n)) walk(partSrc.get(n), depth + 1);
        }
      };
      walk(p.source, 0);
    }
    out.pages = pageList.map((p) => {
      const route = routeOf(p.path);
      if (!route) return null;
      const f = pageFacts(p.source, p.path);
      return { route, file: p.path, title: f.headings[0] || null, headings: f.headings, components: f.components, parts: partsImported(p.source), blocks: blocksOf(p.source, partList ? partSrc : null), form: f.form, reads: f.reads, writes: f.writes };
    }).filter(Boolean);
    out.links = out.pages.flatMap((p) => [...new Set([...p.reads, ...p.writes])].map((t) => ({ route: p.route, table: t, reads: p.reads.includes(t), writes: p.writes.includes(t), form: p.form && p.writes.includes(t) })));
    try { out.frame = frameFacts(pageList.map((p) => ({ ...p, route: routeOf(p.path) }))); } catch { out.frame = null; }
  }
  if (partList) {
    out.parts = partList.map((p) => {
      const routes = usedBy.get(p.name) || [];
      return { name: p.name, file: partPath(p.name), routes, shared: routes.length > 1 };
    });
  }

  // KEY TEXT FACTS, grouped by their words, with every place they are written.
  if (pageList) {
    const allRoutes = out.pages.map((p) => p.route);
    const files = pageList.map((p) => ({ file: p.path, route: routeOf(p.path) || null, part: null, source: p.source }))
      .concat((partList || []).map((p) => ({ file: partPath(p.name), route: null, part: p.name, source: p.source })));
    const byText = new Map();
    for (const f of files) {
      const found = extractText(f.source).map((it) => ({ text: oneLine(it.text), kind: factKind(oneLine(it.text)) })).filter((x) => x.kind).concat(linkFacts(f.source));
      for (const x of found) {
        const key = x.kind + "\u0000" + x.text.toLowerCase();
        if (!byText.has(key)) byText.set(key, { kind: x.kind, text: clip(x.text, 160), at: [] });
        const e = byText.get(key);
        const routes = f.part ? (usedBy.get(f.part) || []) : f.route ? [f.route] : [];
        if (!e.at.some((a) => a.file === f.file) && e.at.length < MAX_LOCS) e.at.push({ file: f.file, ...(f.part ? { part: f.part } : {}), routes });
      }
    }
    out.facts = [...byText.values()].map((e) => {
      const routes = [...new Set(e.at.flatMap((a) => a.routes))];
      const shared = routes.length > 1 || e.at.some((a) => a.part && (usedBy.get(a.part) || []).length > 1);
      return { ...e, routes, shared, everyPage: allRoutes.length > 1 && allRoutes.every((r) => routes.includes(r)) };
    }).slice(0, MAX_FACTS);

    const photos = [];
    for (const f of files) {
      for (const m of String(f.source).matchAll(IMG)) {
        const src = (m[1].match(ATTR("src")) || [])[1];
        if (!src) continue;
        const alt = (m[1].match(ATTR("alt")) || [])[1] || "";
        photos.push({ file: f.file, src: clip(src, 200), alt: clip(oneLine(alt), 100) });
        if (photos.length >= MAX_PHOTOS) break;
      }
    }
    out.photos = photos;
  }

  if (spec && Array.isArray(spec.tables)) {
    const counts = rowCounts && typeof rowCounts === "object" ? rowCounts : null;
    out.tables = spec.tables.slice(0, 64).map((t) => tableOf(t, label)).filter(Boolean).map((t) => {
      const n = counts && Object.hasOwn(counts, t.name) ? counts[t.name] : null;
      return { ...t, rows: Number.isInteger(n) && n >= 0 ? n : null };
    });
  }
  return out;
}

/** Where a fact is written, in a few words: `footer part (every page)`, `/contact`. */
function whereOf(f) {
  const bits = f.at.map((a) => (a.part ? "part " + a.part + (a.routes.length ? " (on " + (f.everyPage && a.routes.length > 1 ? "every page" : a.routes.join(", ")) + ")" : "") : (a.routes[0] || a.file)));
  return [...new Set(bits)].slice(0, 4).join("; ") + (bits.length > 4 ? "; …" : "");
}

/** The key-facts index, one line each, within `budget` characters. */
export function factLines(map, { budget = 1800, kinds = null } = {}) {
  const facts = map && Array.isArray(map.facts) ? map.facts : [];
  const order = ["hours", "phone", "email", "address", "price"];
  const list = facts.filter((f) => !kinds || kinds.includes(f.kind)).slice().sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  const lines = [];
  let used = 0;
  for (const f of list) {
    const line = "- " + f.kind + " \"" + clip(f.text, 90).replace(/"/g, "'") + "\" in " + whereOf(f);
    if (used + line.length + 1 > budget) { lines.push("- … (more not shown)"); break; }
    lines.push(line);
    used += line.length + 1;
  }
  return lines;
}

const FRAMING = "The site as it stands";

/**
 * EACH STEP'S SLICE. Text, or a structured object where the consumer takes
 * one. `""` / null when the map has nothing for that step.
 *
 *   router   key facts with where each is written (budgeted, ~2–3k tokens
 *            with the inventory beside it)
 *   addon    the facts index, for the add-on's site note
 *   row      `{ table: [required column names] }`
 *   frame    `{ frame, writable: [tables a visitor may write] }`
 *   text     the facts index (every place each fact is written)
 *   reply    what exists: routes, tables, the frame
 *   diagnose the whole map, compacted
 */
export function mapFor(kind, map, opts = {}) {
  if (!map || typeof map !== "object") return kind === "row" || kind === "frame" || kind === "diagnose" ? null : "";
  switch (kind) {
    case "router":
    case "text":
    case "addon": {
      const lines = factLines(map, { budget: opts.budget || (kind === "router" ? 1800 : 2400) });
      return lines.length ? "Key details and where each is written:\n" + lines.join("\n") : "";
    }
    case "row": {
      if (!Array.isArray(map.tables)) return null;
      return Object.fromEntries(map.tables.map((t) => [t.name, t.columns.filter((c) => c.required === true).map((c) => c.name)]));
    }
    case "frame": {
      // FACTS FOR THE FRAME WRITER: what the frame holds now, which tables a
      // page writes to, and the key facts with where each is written. The
      // live schema handed beside it stays the truth for what a form may use.
      const bits = [];
      if (Array.isArray(map.frame) && map.frame.length) bits.push("The frame now:\n" + map.frame.join("\n"));
      const writable = Array.isArray(map.links) ? [...new Set(map.links.filter((l) => l.writes).map((l) => l.table + " (written by " + map.links.filter((x) => x.writes && x.table === l.table).map((x) => x.route).join(", ") + ")"))] : [];
      if (writable.length) bits.push("Tables a page writes to: " + writable.join("; "));
      const facts = factLines(map, { budget: opts.budget || 1600 });
      if (facts.length) bits.push("Key details and where each is written:\n" + facts.join("\n"));
      return bits.length ? FRAMING + ":\n" + bits.join("\n") : "";
    }
    case "rowNote": {
      // THE ROW DESIGNER'S CONTEXT: each table's columns, those an entry must
      // fill marked `*`, and who may write it. The live read stays the truth.
      if (!Array.isArray(map.tables) || !map.tables.length) return "";
      return FRAMING + " (tables; * an entry must fill):\n" + map.tables.map((t) => "- " + t.name + ": " + t.columns.map((c) => c.name + (c.required ? "*" : "")).join(", ") + (t.access ? " (" + t.access + ")" : "")).join("\n");
    }
    case "reply": {
      const bits = [];
      if (Array.isArray(map.pages)) bits.push("Pages: " + map.pages.map((p) => p.route + (p.title ? " (\"" + clip(p.title, 50) + "\")" : "")).join(", "));
      if (Array.isArray(map.tables)) bits.push("Tables: " + (map.tables.map((t) => t.name).join(", ") || "none"));
      if (Array.isArray(map.frame) && map.frame.length) bits.push("Frame:\n" + map.frame.join("\n"));
      return bits.length ? FRAMING + ":\n" + bits.join("\n") : "";
    }
    case "diagnose": {
      return {
        version: map.version, pages: map.pages, parts: map.parts, tables: map.tables, links: map.links,
        frame: map.frame, facts: Array.isArray(map.facts) ? map.facts.map((f) => ({ kind: f.kind, text: f.text, where: whereOf(f), shared: f.shared })) : null,
        theme: map.theme ? { fonts: map.theme.fonts, tokens: Object.keys(map.theme.tokens || {}).length } : null,
        photos: Array.isArray(map.photos) ? map.photos.length : null,
      };
    }
    case "site":
    case "page":
    case "look":
    case "nav":
    case "data":
    case "rules":
    case "picture":
    case "edit":
    case "addon-full":
      return siteSlice(map, kind, opts);
    default: return "";
  }
}

const KIND_ORDER = {
  page: ["blocks", "frame", "facts", "tables", "photos", "redirects", "languages"],
  look: ["blocks", "frame", "facts", "photos", "tables", "redirects", "languages"],
  picture: ["photos", "blocks", "frame", "facts", "tables", "redirects", "languages"],
  nav: ["frame", "pages", "redirects", "languages", "facts", "blocks", "tables"],
  data: ["tables", "links", "facts", "pages", "frame", "redirects", "languages"],
  rules: ["tables", "links", "pages", "facts", "frame", "redirects", "languages"],
};
const ALL_SECTIONS = ["blocks", "frame", "tables", "links", "facts", "photos", "redirects", "languages"];

/**
 * THE WHOLE SITE, FOR ANY STEP THAT REASONS ABOUT IT (2026-10-26, the owner:
 * the map goes in everything). Every section, the step's own first, within a
 * budget: each page's blocks in the order it shows them, each
 * named with its component and its first words; the frame (menu, button,
 * footer); tables with their columns, required ones `*`, row counts and who
 * may read and write; which page reads or writes which table and where a form
 * writes; key facts with where each is written; photos; redirects; languages.
 * `opts.page` puts that page first. Facts, never instructions.
 */
export function siteSlice(map, kind = "site", opts = {}) {
  if (!map || typeof map !== "object") return "";
  const budget = Number(opts.budget) > 0 ? Number(opts.budget) : 5200;
  const order = KIND_ORDER[kind] || ALL_SECTIONS;
  const sections = [...order, ...ALL_SECTIONS.filter((s) => !order.includes(s))];
  const pages = Array.isArray(map.pages) ? map.pages.slice() : [];
  const focus = typeof opts.page === "string" && opts.page ? opts.page : "";
  if (focus) pages.sort((a, b) => (a.route === focus ? -1 : b.route === focus ? 1 : 0));
  const parts = [];
  const add = (head, lines) => { if (lines && lines.length) parts.push(head + "\n" + lines.join("\n")); };
  for (const s of sections) {
    if ((s === "blocks" || s === "pages") && pages.length) {
      add("Pages, each with its blocks in the order the page shows them:", pages.map((p) => {
        const head = "- " + p.route + (p.title ? " (\"" + clip(p.title, 50) + "\")" : "") + (p.form ? " [form]" : "");
        const blocks = Array.isArray(p.blocks) && p.blocks.length
          ? p.blocks.map((b, i) => "    " + (i + 1) + ". " + b.name + (b.words && b.words.length ? " — \"" + b.words.join(" / ").replace(/"/g, "'") + "\"" : "")).join("\n")
          : (Array.isArray(p.headings) && p.headings.length ? "    headings: " + p.headings.slice(0, 6).map((h) => "\"" + clip(h, 50) + "\"").join(", ") : "");
        return s === "pages" ? head : head + (blocks ? "\n" + blocks : "");
      }));
    } else if (s === "frame" && Array.isArray(map.frame) && map.frame.length) add("Header, menu and footer:", map.frame);
    else if (s === "tables" && Array.isArray(map.tables)) {
      add("Tables (* an entry must fill):", map.tables.length ? map.tables.map((t) => "- " + t.name + (t.rows != null ? " (" + t.rows + " rows)" : "") + ": " + t.columns.map((c) => c.name + (c.required ? "*" : "")).join(", ") + (t.access ? " — " + t.access : "")) : ["- none"]);
    } else if (s === "links" && Array.isArray(map.links) && map.links.length) {
      add("Which page reads or writes which table:", map.links.map((l) => "- " + l.route + " " + [l.reads ? "reads" : "", l.writes ? (l.form ? "writes (form)" : "writes") : ""].filter(Boolean).join(" and ") + " " + l.table));
    } else if (s === "facts") {
      const f = factLines(map, { budget: 1600 });
      add("Key details and where each is written:", f);
    } else if (s === "photos" && Array.isArray(map.photos) && map.photos.length) {
      add("Photos:", map.photos.slice(0, 30).map((ph) => "- " + ph.file + ": " + (ph.alt ? "\"" + ph.alt + "\" " : "") + ph.src));
    } else if (s === "redirects" && Array.isArray(map.redirects) && map.redirects.length) {
      add("Redirects:", map.redirects.map((r) => "- " + r.from + " → " + r.to));
    } else if (s === "languages" && map.languages && (map.languages.main || map.languages.others.length)) {
      parts.push("Languages: " + [map.languages.main, ...map.languages.others].filter(Boolean).join(", "));
    }
  }
  if (!parts.length) return "";
  let out = FRAMING + ":";
  for (const p of parts) {
    if (out.length + p.length + 2 > budget) { out += "\n… (more of the site not shown)"; break; }
    out += "\n" + p;
  }
  return out;
}

// ── THE MAP RIDES EVERY CALL THAT REASONS ABOUT A SITE ───────────────────────
//
// One transport wrapper, so a step needs no prompt change to see the site: the
// slice is appended to the request's first user turn as one more block. An
// empty slice (an unread map, a map that could not be built in time) sends the
// request unchanged — the map never stops a call.
export const MAP_MARK = "THE SITE AS IT STANDS";
export function withMapNote(request, text) {
  const t = typeof text === "string" ? text.trim() : "";
  if (!t || !request || typeof request !== "object" || Array.isArray(request)) return request;
  // IN THE SYSTEM TURN, AFTER THE STEP'S OWN RULES: the customer's turn stays
  // exactly what the step wrote (its message last, its file whole), and the
  // site rides as reference beside the rules every step already has.
  const block = MAP_MARK + " (for reference; the files and tools you are given stay the truth):\n" + t;
  const sys = request.system;
  if (typeof sys === "string") return sys.includes(MAP_MARK) ? request : { ...request, system: sys + "\n\n" + block };
  if (Array.isArray(sys)) return sys.some((c) => c && typeof c.text === "string" && c.text.includes(MAP_MARK)) ? request : { ...request, system: [...sys, { type: "text", text: block }] };
  if (sys === undefined || sys === null) return { ...request, system: block };
  return request;
}
/** A `send(req)` that carries the slice `note()` answers (async, fails open). */
export function mapSend(send, note) {
  return async (req) => {
    let t = "";
    try { t = typeof note === "function" ? await note() : ""; } catch { t = ""; }
    return send(withMapNote(req, t));
  };
}
/** The same for a `call(keys, req, budget)` transport (the page writer's). */
export function mapCall(call, note) {
  return async (keys, req, ...rest) => {
    let t = "";
    try { t = typeof note === "function" ? await note() : ""; } catch { t = ""; }
    return call(keys, withMapNote(req, t), ...rest);
  };
}

/**
 * THE FILES THAT HOLD WORDS THE INSTRUCTION QUOTES, outside `shownFiles`: the
 * text step's way to find a phrase written in a shared part or on another
 * page. Literal containment of the site's own words in the message, nothing
 * read from the message's vocabulary. Items `[{ path, text }]`.
 */
export function quotedElsewhere(instruction, items, shownFiles) {
  const said = oneLine(String(instruction || "")).toLowerCase();
  if (!said) return [];
  const shown = new Set(shownFiles || []);
  const out = new Set();
  for (const it of Array.isArray(items) ? items : []) {
    if (!it || shown.has(it.path)) continue;
    const t = oneLine(it.text || "").toLowerCase();
    if (t.length >= 4 && said.includes(t)) out.add(it.path);
  }
  return [...out];
}

export function mapKey(slug) { return "source/" + String(slug).toLowerCase() + "/sitemap.json"; }
export function mapVersionKey(slug, version) { return "source/" + String(slug).toLowerCase() + "/sitemaps/" + String(version) + ".json"; }
