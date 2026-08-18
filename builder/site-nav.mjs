// The eighth edit layer: the navigation, across every page at once.
//
// WHAT COULD NOT BE DONE BEFORE. The nav is a `links` array passed to
// `SiteChrome`, and there is a SEPARATE COPY IN EVERY PAGE FILE — measured over
// the 324 family exemplars the generator learns from: 302 arrays across 93
// families, and not one family where every page's list is the same. So "put
// Book first", "add Contact to the menu", "take Pricing out of the nav" needed
// a structural edit on every page of the site, and the only lane that touches
// every page is the full revise: ~27 credits to move one word.
//
// THE `text` LAYER CAN ALREADY RENAME ONE. It is site-wide and `extractText`
// sees object properties, so "call it Prices instead of Pricing" works today and
// is not what this is for. What it cannot do is REORDER, ADD or REMOVE: it
// applies a string replacement at a recorded offset, which cannot move, insert
// or delete an array element.
//
// WHY A STRUCTURAL EDITOR IS SAFE HERE, WHICH IS THE MEASUREMENT THAT DECIDED
// IT. Over all 302 nav arrays in the corpus: ZERO contain a spread or a `.map`,
// and ZERO have an element without a `label`. Every one is a plain array of
// `{label, href}` literals. So the elements can be replaced wholesale without a
// parser, and anything that is NOT that shape is refused rather than guessed at
// — the same skip-rather-than-guess rule the lint and the import check live
// under.
//
// ONE MODEL CALL, AND IT DECIDES THE LIST AND NOTHING ELSE. Haiku, ~0.3 credits,
// the same as `text` and `look`. The apply is mechanical, so the price does not
// grow with the number of pages — which is the whole point, since the number of
// pages is exactly what made this expensive.
//
// A SIDE EFFECT WORTH STATING, because it is a fix rather than a surprise: one
// list written to every page makes the nav CONSISTENT. Measured over the same
// corpus, 21 of 93 families have a page from which another page cannot be
// reached at all — an agency whose home page has no link to Contact, a college
// whose Courses page has no link to Apply. Any nav change through this lane
// closes those on the site it runs against.
//
// A plain module: no filesystem, no HTTP, its one side effect injected. Tested
// outside the Worker and outside the container.

import { routeOf } from "./site-addon.mjs";

export const NAV_MODEL = "claude-haiku-4-5";
export const NAV_MAX_TOKENS = 1200;

/** A nav longer than this is a menu nobody can use, on a phone least of all. */
export const MAX_NAV_ITEMS = 10;

/** Long enough for "Frequently asked questions", short enough to be a label. */
export const MAX_LABEL = 40;

/**
 * Every place a nav list is written, across every page of the site.
 *
 * TWO FORMS, AND BOTH ARE COMMON. `links={[...]}` as a JSX attribute (261 of the
 * 307 arrays in the corpus) and `links: [...]` as an object property inside a
 * `const CHROME = {...}` the pages of that family share (46). No file uses both.
 *
 * WHAT IDENTIFIES A NAV ARRAY IS THAT ITS ITEMS CARRY A `label`, and that is not
 * a convention — it is the discriminator the measurement handed over. The one
 * `links` array in the whole template that is NOT a nav is `__root.tsx`'s
 * favicon list, `[{ rel: "icon", href: SITE_ICON, type: "image/svg+xml" }]`:
 * same property name, no label. Keying on the name alone would rewrite the tab
 * icon of every site into a menu.
 */
export function navSlots(pages) {
  const out = [];
  for (const p of Array.isArray(pages) ? pages : []) {
    if (!p || typeof p.path !== "string" || typeof p.source !== "string") continue;
    const src = p.source;
    // `links={[` or `links: [` — the open bracket has to be found here rather
    // than by regex, because the CONTENTS are what we need the span of.
    const re = /\blinks\s*(=\s*\{\s*|:\s*)\[/g;
    let m;
    while ((m = re.exec(src))) {
      const open = m.index + m[0].length - 1; // at the `[`
      const close = arrayEnd(src, open);
      if (close < 0) continue;
      const body = src.slice(open + 1, close);
      const items = parseNavItems(body);
      // NO ITEM WITH A LABEL IS NOT A NAV. The favicon array lands here, and so
      // would any future `links` prop that means something else.
      if (!items || !items.some((it) => it.label)) continue;
      out.push({ page: p.path, route: routeOf(p.path), at: open + 1, to: close, items });
    }
  }
  return out;
}

/** The index of the `]` closing the array that opens at `from`. */
function arrayEnd(src, from) {
  let depth = 0, quote = "", esc = false;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === quote) quote = "";
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "[" || c === "{" || c === "(") { depth++; continue; }
    if (c === "]" && depth === 1) return i;
    if (c === "]" || c === "}" || c === ")") { depth--; continue; }
  }
  return -1;
}

/**
 * The array's elements, or null if any one of them is not a plain literal.
 *
 * NULL IS A REFUSAL, NOT AN EMPTY LIST. An array holding `...base` or
 * `items.map(...)` cannot have its interior replaced — doing so would delete
 * whatever that expression contributed — so such a slot is left alone entirely.
 * Zero of the 302 arrays in the corpus are that shape, so this is a guard
 * against what a model might write rather than against what one has.
 */
export function parseNavItems(body) {
  const text = String(body || "").trim();
  if (!text) return [];
  const parts = splitTop(text);
  const out = [];
  for (const raw of parts) {
    const part = raw.trim();
    if (!part) continue;
    // Only an object literal. A spread, a variable, a call or a conditional all
    // land here and refuse the whole slot.
    if (!part.startsWith("{") || !part.endsWith("}")) return null;
    const label = literalProp(part, "label");
    const href = literalProp(part, "href");
    // A COMPUTED VALUE IS ALSO A REFUSAL — `href: route` is a real thing a page
    // could write, and replacing the array would drop the binding.
    if (label === null || href === null) return null;
    out.push({ label, href });
  }
  return out;
}

/** Top-level commas only: a comma inside a nested brace or a string is not one. */
function splitTop(text) {
  const out = [];
  let depth = 0, quote = "", esc = false, start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === quote) quote = "";
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "{" || c === "[" || c === "(") { depth++; continue; }
    if (c === "}" || c === "]" || c === ")") { depth--; continue; }
    if (c === "," && !depth) { out.push(text.slice(start, i)); start = i + 1; }
  }
  out.push(text.slice(start));
  return out;
}

/**
 * A property's STRING-LITERAL value: "" when absent, null when it is computed.
 *
 * The three-way answer is what lets the caller tell "this element has no label"
 * (the favicon array, which is simply not a nav) from "this element's label is
 * an expression" (a nav we must not rewrite).
 */
function literalProp(part, name) {
  const re = new RegExp("(^|[{,\\s])" + name + "\\s*:\\s*");
  const m = re.exec(part);
  if (!m) return "";
  const at = m.index + m[0].length;
  const q = part[at];
  if (q !== '"' && q !== "'") return null;
  let outStr = "";
  for (let i = at + 1; i < part.length; i++) {
    const c = part[i];
    if (c === "\\") { outStr += part[i + 1] ?? ""; i++; continue; }
    if (c === q) return outStr;
    outStr += c;
  }
  return null;
}

export const NAV_TOOL = {
  name: "write_nav",
  description:
    "Say what the site's navigation menu should be, in order. It is the same menu on every page.",
  input_schema: {
    type: "object",
    properties: {
      links: {
        type: "array",
        description:
          "THE WHOLE MENU, IN THE ORDER IT SHOULD APPEAR — not a change to it. Start from the menu listed below and " +
          "return it with the one change they asked for made: an item added, an item taken out, or the order moved " +
          "around. Everything they did not mention comes back exactly as it was, in the same place.\n" +
          "RETURN AN EMPTY ARRAY IF THIS IS NOT A CHANGE TO THE MENU. Saying you could not do it is cheap and correct; " +
          "a guessed menu quietly takes a page off every visitor's route through the site.",
        items: {
          type: "object",
          properties: {
            label: { type: "string", description: "What the visitor reads — one or two words. \"Book\", \"Prices\", \"Our work\"." },
            href: {
              type: "string",
              description:
                "Where it goes. A page of THIS site, exactly as listed below — \"/book\", \"/\" for the home page. " +
                "It may also be a full https:// address for somewhere else entirely, like a social profile.\n" +
                "FOR A SECTION OF A PAGE, PUT THE PAGE IN FRONT OF IT: \"/#prices\", not \"#prices\". This menu is " +
                "shown on EVERY page, and a bare \"#prices\" means \"a section of whatever page you are on right now\" " +
                "— so it does nothing at all on every page but the one holding that section. With the page in front " +
                "it works from anywhere. (On a site with only one page a bare \"#prices\" is right, because there is " +
                "nowhere else to be.)\n" +
                "Anything else is dropped, because a menu item leading nowhere is worse than one that is missing.",
            },
          },
          required: ["label", "href"],
        },
      },
    },
    required: ["links"],
  },
};

const NAV_SYSTEM =
  "You set the navigation menu on a small business's website. It is one menu, shown at the top of every page.\n" +
  "Return the WHOLE menu every time, in order, with only what was asked for changed. A menu is short — most of " +
  "these sites want three to five items — and the one thing a customer is meant to do belongs near the end, where " +
  "the button sits.\n" +
  "Never invent a page. The pages this site has are listed for you; an item pointing anywhere else is dropped.";

/**
 * What the model is shown: the menu as it stands, and every page it could name.
 *
 * THE MENU AS IT STANDS IS THE UNION, not any one page's copy, because there is
 * no single copy — the whole reason this layer exists is that every page has its
 * own. First-seen order, which is the order a visitor meets them on the home
 * page.
 */
export function navDigest(slots, routes) {
  const lines = [];
  const seen = new Map();
  for (const s of Array.isArray(slots) ? slots : []) {
    for (const it of s.items || []) {
      if (!it.href || seen.has(it.href)) continue;
      seen.set(it.href, it.label);
    }
  }
  lines.push("THE MENU AS IT IS NOW:");
  if (!seen.size) lines.push("  (empty)");
  for (const [href, label] of seen) lines.push("  " + (label || "(no label)") + " -> " + href);

  lines.push("");
  lines.push("THE PAGES THIS SITE HAS — an item may point at any of these:");
  const list = [...new Set((Array.isArray(routes) ? routes : []).filter(Boolean))];
  if (!list.length) lines.push("  (none)");
  for (const r of list) lines.push("  " + r);

  // WHICH PAGES ARE NOT IN THE MENU, stated rather than left to be worked out.
  // "add the missing pages to the menu" is a real instruction, and a model that
  // has to diff two lists to answer it gets it wrong more often than one that is
  // told. It is also the shape of the reachability holes measured in the corpus.
  const missing = list.filter((r) => !seen.has(r));
  if (missing.length) {
    lines.push("");
    lines.push("NOT IN THE MENU AT ALL: " + missing.join(", "));
  }
  return lines.join("\n");
}

export function navRequest({ instruction, slots, routes }) {
  return {
    model: NAV_MODEL,
    max_tokens: NAV_MAX_TOKENS,
    system: NAV_SYSTEM,
    tools: [NAV_TOOL],
    tool_choice: { type: "tool", name: NAV_TOOL.name },
    messages: [{
      role: "user",
      content: navDigest(slots, routes) + "\n\nWHAT THEY ASKED FOR:\n" + String(instruction || "").slice(0, 2000),
    }],
  };
}

/**
 * The menu the model asked for, with everything unusable dropped.
 *
 * A DROPPED ITEM IS NOT A DROPPED EDIT. An item pointing at a page that does not
 * exist is a 404 on every page of the site, so it goes; the rest of the menu
 * still changes, and the caller says what was left out.
 */
export function readNav(reply, routes) {
  const blocks = reply && Array.isArray(reply.content) ? reply.content : [];
  const use = blocks.find((b) => b && b.type === "tool_use");
  const raw = use && use.input && use.input.links;
  if (!Array.isArray(raw)) return null;

  const known = new Set((Array.isArray(routes) ? routes : []).filter(Boolean));
  const links = [], dropped = [];
  const seen = new Set();
  for (const it of raw) {
    if (!it || typeof it !== "object") continue;
    // A NON-STRING IS REFUSED RATHER THAN COERCED. `String(["/a","/b"])` is
    // "/a,/b", which is not a route and would be dropped anyway — but the same
    // coercion on a LABEL produces a menu item reading "Book,Prices".
    const label = typeof it.label === "string" ? it.label.trim().slice(0, MAX_LABEL) : "";
    const href = typeof it.href === "string" ? it.href.trim() : "";
    if (!label || !href) { dropped.push({ label, href, why: "incomplete" }); continue; }
    const why = hrefProblem(href, known);
    if (why) { dropped.push({ label, href, why }); continue; }
    if (seen.has(href)) { dropped.push({ label, href, why: "duplicate" }); continue; }
    seen.add(href);
    links.push({ label, href });
    if (links.length >= MAX_NAV_ITEMS) break;
  }
  return { links, dropped };
}

/**
 * Why an href cannot be a menu item, or "" if it can.
 *
 * A PATH OF THIS SITE, because a menu item to a page that does not exist 404s
 * from every page at once. Optionally with a fragment — `/#prices` is the
 * correct way to put a section of the home page in a menu, and it works from
 * every page, which is the whole difference from the case below.
 *
 * AN ABSOLUTE https ADDRESS, because a link to an Instagram profile is an
 * ordinary thing a business wants in its menu.
 *
 * A BARE `#anchor` ONLY ON A SINGLE-PAGE SITE, and this is the rule real
 * generator output changed my mind about. `lintPages` exempts anchors and 256
 * of the corpus's hrefs are one — but those are IN-BODY links on the page that
 * holds the section. A menu is shown on every page, so `#prices` in one is dead
 * on all of them but the home page: the browser looks for that section on the
 * page the visitor is already on and finds nothing. Measured on the only pages
 * in this repo written by the generator itself: `booking-1`'s home page carries
 * `#prices`, `#teachers`, `#find-us` and its other three pages carry none.
 *
 * ON A ONE-PAGE SITE IT IS THE OPPOSITE — the menu IS in-page navigation and
 * nothing else, so refusing anchors there would empty it entirely. `menu-1`, the
 * other generated sample, is exactly that: one page, an anchors-only menu.
 *
 * `//evil.example` IS NOT A PATH, and it is the one shape a naive
 * `startsWith("/")` gets wrong — protocol-relative, so it is another origin
 * wearing a path's clothes. The `safeNext` lesson, and `SiteLink` makes the same
 * distinction one layer down.
 */
function hrefProblem(href, known) {
  if (href.startsWith("//")) return "offsite";
  if (href.startsWith("#")) {
    if (!/^#[\w-]{1,60}$/.test(href)) return "bad-anchor";
    return known.size > 1 ? "page-local" : "";
  }
  if (/^https:\/\/[^\s"'<>]+$/i.test(href)) return "";
  if (!href.startsWith("/")) return "not-a-path";
  // The fragment is split off before the route is checked, or `/#prices` — the
  // one form that works from every page — reads as a page called `/#prices`.
  const hash = href.indexOf("#");
  const at = hash < 0 ? href : href.slice(0, hash);
  const frag = hash < 0 ? "" : href.slice(hash);
  if (frag && !/^#[\w-]{1,60}$/.test(frag)) return "bad-anchor";
  return known.has(at) ? "" : "no-such-page";
}

/**
 * Write one menu into every slot on every page.
 *
 * THE HOME PAGE DOES NOT LINK TO ITSELF, and that is the single exception —
 * measured, not chosen: across the 93 families with a nav, `index.tsx` lists
 * `/` in exactly ONE. The convention is overwhelming and writing "Home" onto
 * every home page would be a visible change nobody asked for.
 *
 * NO SUCH RULE FOR ANY OTHER PAGE, deliberately. There the corpus is split — 31
 * of 209 pages list themselves — so there is no convention to preserve, and
 * inventing one here would be a second opinion about a question nobody has
 * answered.
 *
 * BACK TO FRONT, PER FILE. Each write changes the length of the source, so every
 * offset after it would otherwise be wrong — silently, landing in whatever moved
 * into it. The same rule the free text editor's batch already follows.
 */
export function applyNav(pages, links) {
  const list = Array.isArray(links) ? links : [];
  const slots = navSlots(pages);
  const byPage = new Map();
  for (const s of slots) {
    if (!byPage.has(s.page)) byPage.set(s.page, []);
    byPage.get(s.page).push(s);
  }

  const changed = [];
  const next = (Array.isArray(pages) ? pages : []).map((p) => {
    const mine = byPage.get(p && p.path);
    if (!mine || !mine.length) return p;
    const forHere = p && routeOf(p.path) === "/" ? list.filter((it) => it.href !== "/") : list;
    const body = renderNav(forHere);
    let src = p.source;
    for (const s of [...mine].sort((a, b) => b.at - a.at)) {
      src = src.slice(0, s.at) + body + src.slice(s.to);
    }
    if (src === p.source) return p;
    changed.push(p.path);
    return { ...p, source: src };
  });
  return { pages: next, changed };
}

/**
 * The array's interior, as source.
 *
 * JSON.stringify FOR BOTH VALUES, because a label is words a customer typed and
 * an apostrophe or a quote in one would otherwise close the string and break the
 * build. `Mo's Cuts` is not an edge case, it is a business name.
 */
export function renderNav(links) {
  const list = Array.isArray(links) ? links : [];
  if (!list.length) return "";
  return list
    .map((it) => "{ label: " + JSON.stringify(String(it.label)) + ", href: " + JSON.stringify(String(it.href)) + " }")
    .join(", ");
}

export function navUsage(reply) {
  const u = reply && reply.usage;
  if (!u) return null;
  return {
    model: NAV_MODEL,
    in: u.input_tokens || 0,
    out: u.output_tokens || 0,
    cacheRead: u.cache_read_input_tokens || 0,
    cacheWrite: u.cache_creation_input_tokens || 0,
  };
}

/** What the customer is told, in their words rather than ours. */
export function navReply({ links = [], dropped = [], changed = [] } = {}) {
  if (!links.length) return "I couldn't work out what the menu should be. Tell me what to add, take out or move.";
  const menu = links.map((l) => l.label).join(" · ");
  // HOW MANY PAGES IS THE PART WORTH SAYING, not a flourish. The whole reason
  // this layer exists is that the menu is a separate copy in every page file, so
  // "on 5 pages" is exactly what the owner could not get before without paying
  // for a full rewrite.
  let msg = "✅ Updated the menu on " + changed.length + (changed.length === 1 ? " page" : " pages") + ": " + menu + ".";
  // NAMED, NOT COUNTED. "1 item was dropped" tells them something went wrong and
  // not what, and the commonest reason by far is a page that does not exist —
  // which is a thing they can act on by asking for the page.
  const bad = dropped.filter((d) => d.why === "no-such-page");
  if (bad.length) {
    msg += " I left out " + bad.map((d) => d.label || d.href).join(", ") +
      " — there's no " + bad.map((d) => d.href).join(" or ") + " page on the site yet.";
  }
  // A PAGE-LOCAL ANCHOR GETS ITS OWN SENTENCE, because the fix is one word and
  // they can ask for it. Folded into the generic count it reads as "something
  // went wrong" about a menu item that is nearly right.
  const local = dropped.filter((d) => d.why === "page-local");
  if (local.length) {
    msg += " I left out " + local.map((d) => d.label || d.href).join(", ") +
      " — that points at a section of whichever page you're on, so it would do nothing on the others. " +
      "Say which page it's on and I'll link to it properly.";
  }
  const other = dropped.length - bad.length - local.length;
  if (other > 0) msg += " " + other + (other === 1 ? " item was" : " items were") + " not usable and left out.";
  return msg;
}

/**
 * One model call, then a mechanical rewrite of every page.
 *
 * ESCALATES ONLY WHEN THE SITE HAS NO MENU AT ALL. A model that read the menu
 * and returned nothing does NOT escalate: the rungs above cannot reorder a menu
 * any more cheaply, and sending them up spends ~27 credits to fail differently.
 * The same call `runDataEdit`, `runRulesEdit` and `runPictureEdit` all make.
 *
 * A MENU THAT COMES BACK IDENTICAL IS NOT A FAILED EDIT AND IS NOT A SUCCESS
 * EITHER. Republishing every page to write back the bytes that are already there
 * costs a container run and archives a version whose label describes a change
 * that did not happen. It refuses, and says so — the `no-change` shape the look
 * lane already uses.
 */
export async function runNavEdit(deps, { instruction, pages, routes } = {}) {
  const slots = navSlots(pages);
  if (!slots.length) return { ok: false, escalate: true, reason: "no-nav", usage: null };

  let reply;
  try { reply = await deps.send(navRequest({ instruction, slots, routes })); }
  catch (e) { return { ok: false, escalate: false, reason: "send", error: e, usage: null }; }
  const usage = navUsage(reply);

  const read = readNav(reply, routes);
  if (!read || !read.links.length) {
    return { ok: false, escalate: false, reason: "no-menu", usage, msg: navReply({}) };
  }

  const { pages: next, changed } = applyNav(pages, read.links);
  if (!changed.length) {
    return { ok: false, escalate: false, reason: "no-change", usage, msg: "That's already the menu — nothing to change." };
  }
  return {
    ok: true, pages: next, changed, links: read.links, dropped: read.dropped, usage,
    msg: navReply({ links: read.links, dropped: read.dropped, changed }),
  };
}
