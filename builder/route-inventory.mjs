/**
 * THE ROUTER'S SITE INVENTORY (2026-10-25, router-b1; the router audit's step 3).
 *
 * The router was shown page paths and table NAMES only, so it could not tell
 * whether "make Lessons bookable" names something the site has: it knew
 * neither that `/lessons` reads `lessons` nor that `lesson_bookings` exists,
 * nor what the menu and footer already hold. The audit traced the live
 * `addon`-for-what-exists and the lone row insert for a booking feature to
 * exactly that. This is the compact description it is given now:
 *
 *   tables  each table with its columns, `*` for one an entry must fill
 *           (NOT NULL, no default), `=` for one with a default, and who may
 *           read and write it when the caller can say
 *   pages   each page's headings, the kit sections it renders, whether it has
 *           a form, and the tables it reads and writes (the data hooks it calls)
 *   frame   the menu's items, the header's button, the footer's details,
 *           social links and small print, read by the menu editor's own readers
 *
 * FACTS FROM THE SITE'S OWN FILES AND STORED SPEC, NEVER A ROW: nothing a
 * visitor submitted is read. Pure: the route hands it what it read; a part it
 * could not read is left out, never said as none.
 *
 * BUDGETED (`INVENTORY_CHARS`): pages' section lists go first, then pages and
 * tables are cut with a line saying so. It is sent after the stable rules, so
 * the cached prefix (tools, system) is unchanged; it is the same for every
 * call about one site until the site changes.
 */
import { navSlots, menuUnion, actionSlots, contactSlots, chromeListSlots } from "./site-nav.mjs";
// THE ADD-ON'S OWN PAGE READERS (the coordinator, 2026-10-25): the router's map
// is built from the same fact source as the add-on's `siteFacts` (`labels`,
// `builtFrom`), not from a reader of its own.
import { pageLabels, pageComponents } from "./site-add.mjs";
// THE ONE SITE MAP (2026-10-26): the key facts and where each is written.
import { buildSiteMap, mapFor } from "./site-map.mjs";

export const INVENTORY_CHARS = 6000;
const MAX_TABLES = 64;
const MAX_COLUMNS = 30;
const MAX_HEADINGS = 6;
const MAX_COMPONENTS = 10;
const NAME = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;

const READ_HOOKS = new Set(["useRows", "usePublicRows", "useRow"]);
const WRITE_HOOKS = new Set(["useCreateRow", "useUpdateRow", "useDeleteRow", "useUploadFile"]);
const HOOK = /\b(use(?:Rows|PublicRows|Row|CreateRow|UpdateRow|DeleteRow|Cart|Checkout|UploadFile))\s*(?:<[^()]*?>)?\s*\(\s*["'`]([A-Za-z_][A-Za-z0-9_]{0,62})["'`]/g;
// The form and layout primitives every page uses say nothing about what the
// page offers; the kit's sections (a gallery, a team grid, an availability
// grid) do. A name that extends another imported one (`FormField`, `CardTitle`)
// is a part of it and is left out too.
const PRIMITIVES = new Set(["Button", "Input", "Label", "Textarea", "Select", "Form", "Card", "Skeleton", "Badge", "Separator", "Checkbox", "Switch", "Dialog", "Tabs", "RadioGroup", "Toaster", "SafeImage", "Link"]);
const HEADING = /<h([12])\b[^>]*>\s*([^<{}]{2,80}?)\s*<\/h\1>/g;

const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const oneLine = (s) => String(s).replace(/\s+/g, " ").trim();

/** One table's line, or null for a table with no usable name. */
function tableLine(t, label) {
  if (!t || typeof t !== "object" || typeof t.name !== "string" || !NAME.test(t.name)) return null;
  const cols = (Array.isArray(t.columns) ? t.columns : []).slice(0, MAX_COLUMNS).map((c) => {
    if (typeof c === "string") return NAME.test(c) ? c : "";
    if (!c || typeof c !== "object" || typeof c.name !== "string" || !NAME.test(c.name)) return "";
    const def = c.default != null || c.defaultValue != null;
    const must = (c.notnull === true || c.required === true || c.notNull === true) && !def && !(c.pk || c.primary) && c.name !== "id" && c.name !== "created_at";
    return c.name + (must ? "*" : def ? "=" : "");
  }).filter(Boolean);
  let who = "";
  try { who = typeof label === "function" ? String(label(t) || "") : ""; } catch { who = ""; }
  return "- " + t.name + (cols.length ? ": " + cols.join(", ") : "") + (who ? " (" + oneLine(who) + ")" : "");
}

/** What one page holds: headings, kit sections and own parts, a form, tables read and written. */
export function pageFacts(source, path = "src/routes/index.tsx") {
  const src = typeof source === "string" ? source : "";
  const page = { path, source: src };
  const built = Object.values(pageComponents([page]))[0] || { kit: [], parts: [] };
  const label = Object.values(pageLabels([page]))[0] || "";
  const reads = [], writes = [];
  for (const m of src.matchAll(HOOK)) {
    const list = WRITE_HOOKS.has(m[1]) ? writes : READ_HOOKS.has(m[1]) ? reads : null;
    if (list && !list.includes(m[2])) list.push(m[2]);
  }
  const kit = built.kit.filter((n) => /^[A-Z]/.test(n) && n !== "SiteChrome" && new RegExp("<" + n + "\\b").test(src));
  const kept = [...kit.filter((n) => !PRIMITIVES.has(n) && !kit.some((o) => o !== n && n.startsWith(o))), ...built.parts];
  const headings = label ? [label] : [];
  for (const m of src.matchAll(HEADING)) {
    const h = oneLine(m[2]);
    if (h && !headings.includes(h)) headings.push(h);
    if (headings.length >= MAX_HEADINGS) break;
  }
  const form = /<form\b|\buseForm\s*[<(]/.test(src);
  return { reads, writes, components: kept.slice(0, MAX_COMPONENTS), headings, form };
}

/** The frame's items, read by the menu editor's own readers; lines, or [] when none could be read. */
export function frameFacts(pages) {
  const list = Array.isArray(pages) ? pages : [];
  const lines = [];
  try {
    const menu = menuUnion(navSlots(list));
    if (menu.length) lines.push("- menu: " + menu.map((it) => clip(oneLine(it.label || ""), 40) + " → " + it.href).join("; "));
    const button = actionSlots(list).map((s) => s && s.action).find(Boolean);
    if (button) lines.push("- header button: " + clip(oneLine(button.label), 40) + " → " + button.href);
    const contact = contactSlots(list).map((s) => s && s.contact).find((c) => c && typeof c === "object" && Object.keys(c).length);
    if (contact) lines.push("- footer details: " + Object.entries(contact).filter(([, v]) => typeof v === "string" && v).map(([k, v]) => k + " " + clip(oneLine(v), 60)).join("; "));
    for (const prop of ["social", "legal"]) {
      const items = chromeListSlots(list, prop).map((s) => s && s.items).find((x) => Array.isArray(x) && x.length);
      if (items) lines.push("- footer " + (prop === "social" ? "social links" : "small print") + ": " + items.map((it) => clip(oneLine(it.network || it.label || ""), 30)).filter(Boolean).join(", "));
    }
  } catch { return lines; }
  return lines;
}

/**
 * The inventory text, or "" when nothing was read. `pages` is
 * `[{ path, route, source }]` (route the page's address), `spec` the stored
 * spec's `{ tables }` or null when it could not be read, `label` an optional
 * access describer for a table.
 */
/**
 * THE SITE MAP, STRUCTURED AND REUSABLE (2026-10-25): `{ tables, pages, frame }`
 * from the same inputs, `null` for a part that could not be read. The router's
 * text below is one rendering of it; another consumer can take the facts.
 * `tables` are lines (name, columns with `*` / `=`, access), `pages` per route
 * `{ route, headings, components, form, reads, writes }`, `frame` lines.
 */
export function siteMap({ pages = null, spec = null, label = null, words = true } = {}) {
  const tables = spec && Array.isArray(spec.tables) ? spec.tables.slice(0, MAX_TABLES).map((t) => tableLine(t, label)).filter(Boolean) : null;
  const pageList = Array.isArray(pages) ? pages.filter((p) => p && typeof p.route === "string" && typeof p.source === "string") : null;
  // `words` false leaves the pages' headings out: a part of a request is never
  // shown words another part may have changed since (the request's rule, R11).
  const facts = pageList ? pageList.map((p) => { const f = pageFacts(p.source, typeof p.path === "string" ? p.path : undefined); return { route: p.route, ...f, headings: words === false ? [] : f.headings }; }) : null;
  return { tables, pages: facts, frame: pageList ? frameFacts(pageList) : [] };
}

export function routeInventory({ pages = null, spec = null, label = null, budget = INVENTORY_CHARS, words = true, parts = null, map = null } = {}) {
  const { tables, pages: facts, frame } = siteMap({ pages, spec, label, words });
  // KEY DETAILS WITH WHERE EACH IS WRITTEN (the site map's router slice), so
  // one set of opening hours in a shared footer is seen as the whole site's.
  // Left out with the headings when a part may not see words (`words` false).
  let keyFacts = "";
  if (words !== false) {
    try { keyFacts = mapFor("router", map || (Array.isArray(pages) ? buildSiteMap({ pages: pages.map((p) => ({ path: p.path || "", source: p.source })), parts }) : null)); } catch { keyFacts = ""; }
  }
  const pageLine = (f, withSections) => {
    const bits = [];
    if (f.headings.length) bits.push("headings: " + f.headings.map((h) => "\"" + clip(h, 60) + "\"").join(", "));
    if (withSections && f.components.length) bits.push("sections: " + f.components.join(", "));
    if (f.form) bits.push("has a form");
    if (f.reads.length) bits.push("reads " + f.reads.join(", "));
    if (f.writes.length) bits.push("writes " + f.writes.join(", "));
    return "- " + f.route + (bits.length ? ": " + bits.join("; ") : "");
  };
  const build = (withSections) => {
    const parts = [];
    if (tables) parts.push("Tables (columns; * an entry must fill, = has a default):\n" + (tables.length ? tables.join("\n") : "- none"));
    if (facts && facts.length) parts.push("Pages:\n" + facts.map((f) => pageLine(f, withSections)).join("\n"));
    if (frame.length) parts.push("The frame every page shares:\n" + frame.join("\n"));
    return parts.join("\n");
  };
  // ONE BUDGET FOR BOTH: the key facts' room is taken first, the inventory cut to the rest.
  const room = Math.max(0, budget - (keyFacts ? keyFacts.length + 1 : 0));
  let out = build(true);
  if (out.length > room) out = build(false);
  if (out.length > room) {
    const cut = out.slice(0, room);
    out = cut.slice(0, cut.lastIndexOf("\n") > 0 ? cut.lastIndexOf("\n") : cut.length) + "\n- … (more not shown)";
  }
  // The key facts ride after the budgeted inventory, on their own budget (`mapFor`).
  return keyFacts ? (out ? out + "\n" : "") + keyFacts : out;
}
