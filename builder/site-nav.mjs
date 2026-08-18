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
 * Long enough for a two-line address, short enough that nothing pastes an essay
 * into the bottom of every page of a site.
 */
export const MAX_CONTACT_CHARS = 160;

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

/**
 * The header's CALL-TO-ACTION BUTTON, on every page that has one.
 *
 * THE SINGLE MOST IMPORTANT CONTROL ON A SMALL BUSINESS'S SITE, and its
 * destination could not be changed by anything. Measured: 258 of 315
 * `<SiteChrome>`/`<SiteHeader>` elements carry an `action`, plus 30 of the 47
 * shared `const CHROME` objects — 288 in all, every one with a literal href.
 *
 * ITS LABEL WAS ALREADY EDITABLE AND ITS DESTINATION WAS NOT, which is the exact
 * shape that makes a gap invisible. Driven through the real `extractText`:
 * "Book a chair" is offered and `/book` is not — correctly, because the text
 * layer refuses anything with no whitespace and no capital, the rule that stops
 * it renaming a column. So "call the button Get a quote" worked and "point it at
 * the contact page instead" had no path at all.
 *
 * ONE PER PAGE, LIKE THE MENU. Same file, same duplication, same fix — which is
 * why it lives here rather than in a ninth layer: to a customer the menu and the
 * button are both "the top of the site", and every layer is a permanent
 * prompt-token cost on the router's description on every message.
 */
export function actionSlots(pages) {
  const out = [];
  for (const p of Array.isArray(pages) ? pages : []) {
    if (!p || typeof p.path !== "string" || typeof p.source !== "string") continue;
    const src = p.source;

    // The JSX form: `<SiteChrome … action={{ … }} …>`.
    for (const m of src.matchAll(/<Site(?:Chrome|Header)\b/g)) {
      const end = tagEnd(src, m.index);
      if (end < 0) continue;
      const tag = src.slice(m.index, end);
      const a = /\baction=\{\{/.exec(tag);
      if (!a) {
        // A SPREAD TAG IS NOT AN INSERTION POINT, and this was found by driving
        // the reference pages rather than by reading. `<SiteChrome {...CHROME}>`
        // takes its action from the shared object, which this scan finds
        // separately — and a prop written BEFORE a spread is overridden by it,
        // so an insert here would compile, publish and change nothing at all.
        // 4 of the 5 reference pages are exactly that shape.
        if (/\{\s*\.\.\./.test(tag)) continue;
        // NO BUTTON YET, AND WHERE ONE WOULD GO. Immediately after the tag
        // name is the one insertion point that needs no judgement at all —
        // attribute order is otherwise meaningless to JSX, so nothing can be
        // displaced.
        out.push({ page: p.path, kind: "jsx", insertAt: m.index + m[0].length, action: null });
        continue;
      }
      const from = m.index + a.index + a[0].length - 1; // at the inner `{`
      const close = braceEnd(src, from);
      if (close < 0) continue;
      out.push({
        page: p.path, kind: "jsx",
        // The whole attribute, so a removal takes `action={{…}}` away entirely
        // rather than leaving `action={{}}`, which is a button with no label.
        at: m.index + a.index, to: close + 2,
        inner: { at: from + 1, to: close },
        action: readAction(src.slice(from + 1, close)),
      });
    }

    // The shared-object form: `const CHROME = { …, action: { … } }`.
    const cm = /const CHROME\s*=\s*\{/.exec(src);
    if (cm) {
      const objAt = cm.index + cm[0].length - 1;
      const objEnd = braceEnd(src, objAt);
      if (objEnd > 0) {
        const body = src.slice(objAt + 1, objEnd);
        const a = /\baction:\s*\{/.exec(body);
        if (!a) {
          out.push({ page: p.path, kind: "obj", insertAt: objAt + 1, action: null });
        } else {
          const from = objAt + 1 + a.index + a[0].length - 1;
          const close = braceEnd(src, from);
          if (close > 0) {
            out.push({
              page: p.path, kind: "obj",
              at: objAt + 1 + a.index, to: close + 1,
              inner: { at: from + 1, to: close },
              action: readAction(src.slice(from + 1, close)),
            });
          }
        }
      }
    }
  }
  return out;
}

/** The label and destination of one action object, or null if either is computed. */
function readAction(body) {
  const label = literalProp("{" + body + "}", "label");
  const href = literalProp("{" + body + "}", "href");
  if (label === null || href === null) return null;
  if (!label) return null;
  return { label, href };
}

/** The index just past the opening tag that starts at `from`. */
function tagEnd(src, from) {
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
    if (c === "{") { depth++; continue; }
    if (c === "}") { depth = Math.max(0, depth - 1); continue; }
    if (c === ">" && !depth) return i;
  }
  return -1;
}

/**
 * How far a comment starting at `i` runs, or 0 if there is no comment there.
 *
 * BOTH BRACKET SCANNERS WERE COMMENT-BLIND, and the failure is silent and total:
 * an apostrophe in a `//` line — `// The footer's small print.` — opened a
 * string the scanner never closed, so `braceEnd` ran to the end of the file and
 * returned -1, and the page yielded NO SLOT AT ALL. Not a wrong menu: no menu,
 * no button, no contact, on that page, with nothing reported.
 *
 * MEASURED WHEN IT BIT: of 307 corpus pages with a nav or CHROME structure, 112
 * carry a comment with an unbalanced quote somewhere in the file, and exactly
 * ONE broke — because the hazard only fires when the quote sits INSIDE the span
 * being scanned. That is what makes it the worst kind of latent bug: rare
 * enough to survive every test, and triggered by writing an ordinary English
 * comment in the wrong place.
 *
 * A `/` OUTSIDE A STRING CANNOT BE DIVISION HERE. `//` is never a valid operator
 * and these scanners only ever run over object and array literals, so treating
 * both forms as comments is safe.
 */
function commentEnd(src, i) {
  if (src[i] !== "/") return 0;
  if (src[i + 1] === "/") {
    const nl = src.indexOf("\n", i);
    return (nl < 0 ? src.length : nl) - i;
  }
  if (src[i + 1] === "*") {
    const close = src.indexOf("*/", i + 2);
    return (close < 0 ? src.length : close + 2) - i;
  }
  return 0;
}

/** The index of the `}` closing the object that opens at `from`. */
function braceEnd(src, from) {
  let depth = 0, quote = "", esc = false;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === quote) quote = "";
      continue;
    }
    const skip = commentEnd(src, i);
    if (skip) { i += skip - 1; continue; }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "{" || c === "[" || c === "(") { depth++; continue; }
    if (c === "}" && depth === 1) return i;
    if (c === "}" || c === "]" || c === ")") { depth--; continue; }
  }
  return -1;
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
    const skip = commentEnd(src, i);
    if (skip) { i += skip - 1; continue; }
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
          "LEAVE THIS OUT ENTIRELY IF THE MENU IS NOT CHANGING — if they are only asking about the button, say " +
          "nothing about the menu. Restating a menu you were not asked to touch is how an item goes missing.\n" +
          "AND LEAVE OUT BOTH THIS AND `action` IF NEITHER IS WHAT THEY MEANT. Saying you could not do it is cheap " +
          "and correct; a guessed menu quietly takes a page off every visitor's route through the site.",
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
      action: {
        type: "object",
        description:
          "THE ONE BUTTON AT THE TOP OF EVERY PAGE — the thing the business most wants a visitor to do. \"Book a " +
          "chair\", \"Get a quote\", \"Call now\". Return the WHOLE button, both what it says and where it goes, " +
          "even when only one of the two is changing.\n" +
          "LEAVE IT OUT IF THEY ARE NOT ASKING ABOUT THE BUTTON. It is the same button on every page, so changing it " +
          "changes all of them at once.",
        properties: {
          label: { type: "string", description: "What the button says — two or three words." },
          href: {
            type: "string",
            description:
              "Where it goes. A page of THIS site exactly as listed below, \"/#prices\" for a section of one, an " +
              "https:// address, or \"tel:\" followed by the phone number for a Call button — which is the right " +
              "answer for a trade whose customers ring rather than book.",
          },
        },
        required: ["label", "href"],
      },
      pageLinks: {
        type: "array",
        description:
          "LINKS INSIDE THE PAGES — the ones written into the copy, not the menu or the button. \"Send an enquiry\", " +
          "\"See the full lineup\", \"Back to records\". Every link on the site with the same words is changed at " +
          "once, on every page it appears on.\n" +
          "ONE ENTRY PER LINK THEY ARE CHANGING, and nothing else. Leave the whole field out if they are not asking " +
          "about a link in the copy.",
        items: {
          type: "object",
          properties: {
            label: {
              type: "string",
              description:
                "The link's own words, copied EXACTLY from the list below — that is how they refer to it. Leave it " +
                "out only when they named a destination rather than words (\"everything pointing at /old-prices\").",
            },
            from: {
              type: "string",
              description:
                "Where it goes NOW, exactly as listed. Give this as well as the words when the same words appear " +
                "twice going to different places, and instead of them when they named no words at all.",
            },
            to: {
              type: "string",
              description:
                "Where it should go INSTEAD. A page of this site, \"/#prices\" for a section of one, an https:// " +
                "address, or \"tel:\" and the number. Some links are typed against the site's own pages and can " +
                "only ever point at one — those are marked below, and anything else is left alone rather than " +
                "breaking the site.",
            },
          },
          required: ["to"],
        },
      },
      removeAction: {
        type: "boolean",
        description:
          "TRUE to take the button off the header entirely — \"drop the Book button\", \"we don't need a button up " +
          "there\". Leave it out otherwise; setting it alongside `action` is contradictory and the button is kept.",
      },
      contact: {
        type: "object",
        description:
          "THE DETAILS AT THE BOTTOM OF EVERY PAGE — the phone number, email address, postal address and opening " +
          "line a visitor scrolls to the footer to find. Use this for \"put our number in the footer\", \"the " +
          "address is wrong\", \"add our opening hours at the bottom\", \"we've moved\".\n" +
          "NAME ONLY THE FIELDS THEY ASKED ABOUT. Everything you leave out stays exactly as it is — so changing a " +
          "phone number is `{\"phone\": \"…\"}` and nothing else. Restating the address while you are in there is " +
          "how a business ends up with the wrong one on every page of its site.\n" +
          "AN EMPTY STRING TAKES A FIELD AWAY: `{\"hours\": \"\"}` for \"stop showing our opening times\".\n" +
          "NEVER INVENT ONE. If they say to add a phone number and do not say what it is, leave this out entirely — " +
          "a made-up number is worse than no number, because somebody rings it.\n" +
          "This is the FOOTER. A number that belongs in the header as a call-now button is `action`, not this.",
        properties: {
          phone: {
            type: "string",
            description:
              "Written the way they write it — \"0114 270 0000\", \"+44 20 7946 0000\". The tappable link is worked " +
              "out from it, so do not reformat and do not add a country code they did not give you.",
          },
          email: { type: "string", description: "The address itself — \"hello@example.co.uk\". The mailto: link is added for you." },
          address: {
            type: "string",
            description:
              "The postal address, with a real newline between the lines: \"14 Cutler Row\\nSheffield S1 2AY\". " +
              "It renders as written.",
          },
          hours: {
            type: "string",
            description:
              "ONE LINE — \"Tue–Sun 12–10\", \"Mon–Fri 9–5.30\". A full day-by-day timetable is rows in a table on " +
              "the page, not this; if they ask for one, leave this out.",
          },
        },
      },
    },
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
export function navDigest(slots, routes, actions, links, contacts) {
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

  // THE BUTTON AS IT STANDS, and whether there IS one. A model told nothing
  // about it cannot be asked to change it, and one told only that a button
  // exists cannot tell "point it at contact" from "add a button".
  const btn = (Array.isArray(actions) ? actions : []).map((a) => a && a.action).filter(Boolean)[0];
  lines.push("");
  lines.push("THE BUTTON AT THE TOP:");
  lines.push(btn ? "  " + btn.label + " -> " + btn.href : "  (there is no button)");

  // THE LINKS WRITTEN INTO THE PAGES, grouped by what they SAY and where they
  // go — a customer names one by its words, and the same words on four pages
  // are one link to them rather than four.
  const groups = new Map();
  for (const l of Array.isArray(links) ? links : []) {
    if (!l || !l.label) continue;
    const k = l.label + "\u0000" + l.href;
    const g = groups.get(k) || { label: l.label, href: l.href, n: 0, typed: false };
    g.n++; g.typed = g.typed || l.typed;
    groups.set(k, g);
  }
  if (groups.size) {
    lines.push("");
    lines.push("LINKS INSIDE THE PAGES — the words, where they go, and how many pages carry one:");
    for (const g of [...groups.values()].slice(0, MAX_LINK_LINES)) {
      lines.push("  \u201c" + g.label + "\u201d -> " + g.href +
        (g.n > 1 ? "  (on " + g.n + " pages)" : "") +
        // STATED, NOT LEFT TO BE WORKED OUT. A typed link can only ever point at
        // a page of this site, and a model that sends one to an anchor is asking
        // for a change that gets refused.
        (g.typed ? "  [must point at a page of this site]" : ""));
    }
  }

  // WHAT THE FOOTER SAYS TODAY. Without it a one-field change is impossible to
  // express safely: the model cannot tell "add an email" from "replace
  // everything with an email", and the merge it has to reason about is the one
  // this digest is describing. First slot that has anything, since every page
  // carries the same object.
  const con = (Array.isArray(contacts) ? contacts : []).map((c) => c.contact).find((c) => c && Object.keys(c).length);
  lines.push("");
  lines.push("THE FOOTER'S CONTACT DETAILS, on every page:");
  if (!con) lines.push("  (none — the footer shows only the name, the tagline and the menu)");
  else for (const f of CONTACT_FIELDS) {
    if (typeof con[f] === "string" && con[f]) lines.push("  " + f + ": " + con[f].replace(/\n/g, " / "));
  }

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

export function navRequest({ instruction, slots, routes, actions, links, contacts }) {
  return {
    model: NAV_MODEL,
    max_tokens: NAV_MAX_TOKENS,
    system: NAV_SYSTEM,
    tools: [NAV_TOOL],
    tool_choice: { type: "tool", name: NAV_TOOL.name },
    messages: [{
      role: "user",
      content: navDigest(slots, routes, actions, links, contacts) + "\n\nWHAT THEY ASKED FOR:\n" + String(instruction || "").slice(0, 2000),
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
  const input = (use && use.input) || null;
  if (!input) return null;
  const raw = input.links;

  const known = new Set((Array.isArray(routes) ? routes : []).filter(Boolean));
  const links = [], dropped = [];
  const seen = new Set();

  // ── THE BUTTON, READ BEFORE THE MENU so a button-only answer is not lost ──
  //
  // `links` is OPTIONAL now: absent means the menu is not changing. Required, a
  // customer asking only about the button would have the model restate a menu
  // it was not asked to touch, which is how an item goes missing.
  let action, removeAction = false;
  if (input.removeAction === true) removeAction = true;
  const ra = input.action;
  if (ra && typeof ra === "object" && !Array.isArray(ra)) {
    const label = typeof ra.label === "string" ? ra.label.trim().slice(0, MAX_LABEL) : "";
    const href = typeof ra.href === "string" ? ra.href.trim() : "";
    const why = href ? actionHrefProblem(href, known) : "incomplete";
    if (!label || why) dropped.push({ label, href, why: why || "incomplete", button: true });
    else {
      action = { label, href };
      // BOTH AT ONCE IS CONTRADICTORY AND THE BUTTON IS KEPT — being wrong
      // toward a button that exists costs a label somebody can change again,
      // and being wrong the other way takes their conversion button off the
      // site. The same asymmetry `remove` lives under everywhere else.
      removeAction = false;
    }
  }

  // ── LINKS IN THE COPY ───────────────────────────────────────────────────
  //
  // Kept as the model gave them and resolved against the real slots at APPLY
  // time, because matching needs the pages and this function only has the
  // routes. What is checked here is the shape: an entry with nowhere to go, or
  // with neither words nor a current destination to find it by, is dropped —
  // the second is a model that answered the field and not the question, and
  // applying it to every link on the site is the worst thing this lane could do.

  // ── THE FOOTER'S CONTACT DETAILS ────────────────────────────────────────
  //
  // ONLY THE FIELDS NAMED, and only strings. An absent field means unchanged
  // and an empty string means take it away, so the two must stay
  // distinguishable all the way to `applyContact` — which is why a non-string
  // is dropped rather than coerced. `String(["a"])` is `"a"`, and this writes
  // into the footer of every page.
  let contact = null;
  const rc = input.contact;
  if (rc && typeof rc === "object" && !Array.isArray(rc)) {
    const picked = {};
    for (const f of CONTACT_FIELDS) {
      if (typeof rc[f] !== "string") continue;
      picked[f] = rc[f].trim().slice(0, MAX_CONTACT_CHARS);
    }
    if (Object.keys(picked).length) contact = picked;
  }

  const pageLinks = [];
  for (const c of Array.isArray(input.pageLinks) ? input.pageLinks : []) {
    if (!c || typeof c !== "object") continue;
    const to = typeof c.to === "string" ? c.to.trim() : "";
    const label = typeof c.label === "string" ? c.label.trim().slice(0, 120) : "";
    const from = typeof c.from === "string" ? c.from.trim() : "";
    if (!to || (!label && !from)) { dropped.push({ label, href: to, why: "incomplete", link: true }); continue; }
    pageLinks.push({ label, from, to });
    if (pageLinks.length >= MAX_LINK_CHANGES) break;
  }

  if (!Array.isArray(raw)) {
    // A REFUSED BUTTON IS NOT "NO ANSWER". Returning null here threw away the
    // reason it was refused, so a customer asking to point the button at a page
    // that does not exist was told "I couldn't work out what the menu should be"
    // — about a menu they never mentioned. Found by my own test.
    // `contact` COUNTS HERE. Without it a footer-only answer — which is the
    // commonest shape this lane's newest field produces — fell out as `null`
    // and the whole change was dropped before anything could apply it.
    if (!action && !removeAction && !dropped.length && !pageLinks.length && !contact) return null;
    return { links: null, dropped, action, removeAction, pageLinks, contact };
  }
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
  return { links, dropped, action, removeAction, pageLinks, contact };
}

/**
 * Why an href cannot be the BUTTON's destination, or "" if it can.
 *
 * EVERYTHING THE MENU ALLOWS, PLUS `tel:`. Measured over the 288 action objects
 * in the corpus: 178 site paths, 63 anchors and 46 `tel:` — so one destination
 * in six is a phone number, and refusing it would refuse the entire conversion
 * path for every trade whose customers ring rather than book. It is right HERE
 * and not in the menu, because a phone number is a call to action rather than a
 * place on the site.
 *
 * BOUNDED TO DIGITS AND THE PUNCTUATION A NUMBER REALLY USES. `tel:` is a URL
 * scheme like any other and the value is written into an href, so a free-text
 * one is somewhere to put a payload.
 */
function actionHrefProblem(href, known) {
  if (/^tel:/i.test(href)) return /^tel:\+?[0-9][0-9 ()./-]{4,24}$/.test(href) ? "" : "bad-number";
  return hrefProblem(href, known);
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

/** "phone", "phone and email", "phone, email and address". */
function humanList(fields) {
  const words = fields.map((f) => (f === "hours" ? "opening hours" : f === "address" ? "address" : f));
  if (words.length <= 1) return words[0] || "";
  return words.slice(0, -1).join(", ") + " and " + words[words.length - 1];
}

/** What the customer is told, in their words rather than ours. */
export function navReply({ links = [], dropped = [], changed = [], action = null, removedAction = false, moved = 0, refused = [], contact = null } = {}) {
  const where = changed.length + (changed.length === 1 ? " page" : " pages");

  // THE FOOTER ON ITS OWN, before every other branch. Falling through would
  // report a menu that did not change, and the customer has no way of knowing
  // which of the two we actually did — the works-but-cannot-say-so disease.
  // NAMES WHAT MOVED rather than printing the values back: an address is two
  // lines and a phone number they just typed is not news.
  if (contact && !links.length && !action && !removedAction && !moved) {
    const set = CONTACT_FIELDS.filter((f) => typeof contact[f] === "string" && contact[f] !== "");
    const cleared = CONTACT_FIELDS.filter((f) => contact[f] === "");
    const said = [];
    if (set.length) said.push("Updated the footer's " + humanList(set));
    if (cleared.length) said.push("took the " + humanList(cleared) + " off it");
    return "✅ " + said.join(", and ") + " — on " + where + ".";
  }
  // THE BUTTON ON ITS OWN, when the menu was not part of the ask. Falling
  // through to the menu sentence would report a menu that did not change.
  // LINKS IN THE COPY, ON THEIR OWN. Falling through to the menu sentence
  // would report a menu that did not change.
  if (!links.length && !action && !removedAction && moved) {
    return "✅ Repointed " + moved + (moved === 1 ? " link" : " links") + " across " + where + "." +
      (refused.length ? " " + linkRefusal(refused) : "");
  }
  if (!links.length && (action || removedAction)) {
    const said = removedAction
      ? "✅ Took the button off the top of the site — " + where + " updated."
      : "✅ The button now says “" + action.label + "” and goes to " + action.href + ", on " + where + ".";
    return said + droppedNote(dropped);
  }
  if (!links.length) {
    const why = droppedNote(dropped);
    if (why) return "I couldn't make that change." + why;
    return "I couldn't work out what the menu should be. Tell me what to add, take out or move.";
  }
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
  // AND THE BUTTON, when this change carried both.
  if (removedAction) msg += " The button at the top is gone too.";
  else if (action) msg += " The button now says “" + action.label + "” and goes to " + action.href + ".";
  if (moved) msg += " " + moved + (moved === 1 ? " link" : " links") + " in the copy repointed too.";
  if (refused.length) msg += " " + linkRefusal(refused);
  return msg;
}

/** The dropped-item sentences, shared by both halves of the reply. */
function droppedNote(dropped) {
  const list = Array.isArray(dropped) ? dropped : [];
  const btn = list.filter((d) => d.button);
  if (!btn.length) return "";
  // THE BUTTON'S OWN REFUSAL NAMES WHAT WAS WRONG WITH IT. A silent drop here
  // is the worst shape this lane has: the customer is told the button changed
  // and it did not.
  const why = btn[0].why;
  if (why === "no-such-page") return " I left the button where it was — there's no " + btn[0].href + " page yet.";
  if (why === "bad-number") return " I left the button where it was — that doesn't look like a phone number.";
  if (why === "page-local") return " I left the button where it was — that points at a section of whichever page you're on, so it would do nothing on the others.";
  return " I left the button where it was — I couldn't use that destination.";
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
  const actions = actionSlots(pages);
  const links = linkSlots(pages);
  const contacts = contactSlots(pages);
  // NOTHING TO EDIT IS THE ONLY THING THAT ESCALATES. A site with a button and
  // no menu, or links in the copy and no chrome at all, is still this lane's
  // work — sending it up costs a ~27-credit rewrite to do what this does free.
  if (!slots.length && !actions.length && !links.length) {
    return { ok: false, escalate: true, reason: "no-nav", usage: null };
  }

  let reply;
  try { reply = await deps.send(navRequest({ instruction, slots, routes, actions, links, contacts })); }
  catch (e) { return { ok: false, escalate: false, reason: "send", error: e, usage: null }; }
  const usage = navUsage(reply);

  const read = readNav(reply, routes);
  const wantsMenu = !!(read && read.links && read.links.length);
  const wantsButton = !!(read && (read.action || read.removeAction));
  const wantsLinks = !!(read && read.pageLinks && read.pageLinks.length);
  const wantsContact = !!(read && read.contact);
  if (!wantsMenu && !wantsButton && !wantsLinks && !wantsContact) {
    // THE REASON TRAVELS EVEN WHEN NOTHING COULD BE APPLIED. `navReply({})` is
    // the honest answer only when the model said nothing usable at all; when it
    // named a button we had to refuse, the customer is owed the refusal.
    const why = read && read.dropped && read.dropped.length ? navReply({ dropped: read.dropped }) : navReply({});
    return { ok: false, escalate: false, reason: "no-menu", usage, msg: why };
  }

  let out = { pages: Array.isArray(pages) ? pages : [], changed: [] };
  if (wantsMenu) out = applyNav(out.pages, read.links);
  let btn = { pages: out.pages, changed: [] };
  if (wantsButton) btn = applyAction(out.pages, read.action, read.removeAction);
  let lnk = { pages: btn.pages, changed: [], moved: 0, refused: [] };
  if (wantsLinks) lnk = applyPageLinks(btn.pages, read.pageLinks, routes);
  let con = { pages: lnk.pages, changed: [] };
  if (wantsContact) con = applyContact(lnk.pages, read.contact);
  const changed = [...new Set([...out.changed, ...btn.changed, ...lnk.changed, ...con.changed])];

  if (!changed.length) {
    return {
      ok: false, escalate: false, reason: "no-change", usage,
      msg: wantsMenu
        ? "That's already the menu — nothing to change."
        : wantsButton
          ? "That's already what the button says and where it goes — nothing to change."
          : wantsContact
            ? "The footer already says that — nothing to change."
            : linkRefusal(lnk.refused) || "Those links already point there — nothing to change.",
    };
  }
  return {
    ok: true, pages: con.pages, changed,
    contact: wantsContact ? read.contact : null,
    links: wantsMenu ? read.links : null,
    action: read.action || null, removedAction: !!read.removeAction,
    movedLinks: lnk.moved, refusedLinks: lnk.refused,
    dropped: read.dropped, usage,
    msg: navReply({
      links: wantsMenu ? read.links : [], action: read.action,
      removedAction: !!read.removeAction, dropped: read.dropped, changed,
      moved: lnk.moved, refused: lnk.refused,
      contact: wantsContact ? read.contact : null,
    }),
  };
}

/**
 * Write one button into every header, or take it off every header.
 *
 * TWO SHAPES AND AN INSERTION, because that is what the corpus has: the JSX
 * attribute, the shared `const CHROME` property, and a header that has no button
 * at all. A page carrying BOTH — a `<SiteChrome {...CHROME}>` whose object holds
 * the action — yields only the object slot, since a prop written before a spread
 * is overridden by it.
 *
 * BACK TO FRONT, PER FILE, for the reason `applyNav` states: each write changes
 * the length of the source, so a forward pass lands every later offset in
 * whatever moved into it.
 */
export function applyAction(pages, action, remove) {
  if (!action && !remove) return { pages: Array.isArray(pages) ? pages : [], changed: [] };
  const slots = actionSlots(pages);
  const byPage = new Map();
  for (const s of slots) {
    if (!byPage.has(s.page)) byPage.set(s.page, []);
    byPage.get(s.page).push(s);
  }

  const body = action
    ? "{ label: " + JSON.stringify(String(action.label)) + ", href: " + JSON.stringify(String(action.href)) + " }"
    : "";
  const changed = [];
  const next = (Array.isArray(pages) ? pages : []).map((p) => {
    const mine = byPage.get(p && p.path);
    if (!mine || !mine.length) return p;
    let src = p.source;
    // A slot with an existing button is EDITED; one without is only INSERTED
    // into, and only when there is a button to insert. A removal on a header
    // that has none is a no-op rather than a failure — asking for something to
    // go that is already gone is not an error.
    const doable = mine.filter((s) => (s.action ? true : !!action));
    for (const s of [...doable].sort((a, b) => (b.at ?? b.insertAt) - (a.at ?? a.insertAt))) {
      if (!s.action) {
        src = src.slice(0, s.insertAt) +
          (s.kind === "jsx" ? " action={" + body + "}" : " action: " + body + ",") +
          src.slice(s.insertAt);
        continue;
      }
      if (remove) {
        // The single space in front goes with it, or the tag is left reading
        // `name="X" >`. The source is stored and re-read on every later edit,
        // so tidy is not cosmetic here.
        const from = s.at > 0 && src[s.at - 1] === " " ? s.at - 1 : s.at;
        src = src.slice(0, from) + src.slice(s.to);
        continue;
      }
      src = src.slice(0, s.inner.at) + body.slice(1, -1) + src.slice(s.inner.to);
    }
    if (src === p.source) return p;
    changed.push(p.path);
    return { ...p, source: src };
  });
  return { pages: next, changed };
}

/**
 * THE FOOTER'S CONTACT DETAILS — the phone, email, address and opening line the
 * bottom of every page carries.
 *
 * WHY THIS LANE AND NOT A NEW ONE. It is the same operation `action` already is:
 * one object, spread into every page, changed everywhere at once. The `page`
 * lane is explicitly the wrong home — it edits ONE page, and a footer that
 * differs between pages is the inconsistency its own description warns about.
 *
 * AND WITHOUT IT THE SLOTS WERE REACHABLE ONLY BY A FRESH BUILD. `SiteChrome`
 * gained `contact` on 2026-08-18; the generator fills it on a new site, and
 * every site published before that could never get a phone number in its footer
 * short of a ~27-credit rewrite. That is the on-disk-and-reachable-by-nothing
 * shape this repo has deleted 289 files over.
 *
 * FIELD-LEVEL MERGE, because absent means unchanged everywhere else in this
 * codebase and the alternative is vicious: "change the phone number" replacing
 * the whole object wipes the address and the opening hours, and the customer
 * finds out when somebody cannot find the shop. An EMPTY STRING is the removal
 * verb, so a field can still be taken away.
 */
export const CONTACT_FIELDS = ["phone", "email", "address", "hours"];

/** The `key: "value"` pairs of a contact object literal, as a plain map. */
export function readContact(body) {
  const out = {};
  for (const f of CONTACT_FIELDS) {
    // The value is a JSON string in the source, so JSON.parse gives back the
    // real text — including a `\n` in an address, which must stay a newline and
    // not become a literal backslash on the way through.
    const m = new RegExp(`\\b${f}\\s*:\\s*("(?:[^"\\\\]|\\\\.)*")`).exec(String(body || ""));
    if (!m) continue;
    try { out[f] = JSON.parse(m[1]); } catch { /* not a plain string — leave it out */ }
  }
  return out;
}

/** Where each page's contact object is, or where one would go. */
export function contactSlots(pages) {
  const out = [];
  for (const p of Array.isArray(pages) ? pages : []) {
    if (!p || typeof p.path !== "string" || typeof p.source !== "string") continue;
    const src = p.source;

    for (const m of src.matchAll(/<Site(?:Chrome|Header)\b/g)) {
      const end = tagEnd(src, m.index);
      if (end < 0) continue;
      const tag = src.slice(m.index, end);
      const a = /\bcontact=\{\{/.exec(tag);
      if (!a) {
        // A SPREAD TAG IS NOT AN INSERTION POINT — `actionSlots` learned this by
        // being driven against the reference pages: a prop written before a
        // spread is overridden by it, so the insert would compile, publish and
        // change nothing.
        if (/\{\s*\.\.\./.test(tag)) continue;
        out.push({ page: p.path, kind: "jsx", insertAt: m.index + m[0].length, contact: null });
        continue;
      }
      const from = m.index + a.index + a[0].length - 1;
      const close = braceEnd(src, from);
      if (close < 0) continue;
      out.push({
        page: p.path, kind: "jsx",
        at: m.index + a.index, to: close + 2,
        contact: readContact(src.slice(from + 1, close)),
      });
    }

    const cm = /const CHROME\s*=\s*\{/.exec(src);
    if (cm) {
      const objAt = cm.index + cm[0].length - 1;
      const objEnd = braceEnd(src, objAt);
      if (objEnd > 0) {
        const body = src.slice(objAt + 1, objEnd);
        const a = /\bcontact:\s*\{/.exec(body);
        if (!a) {
          out.push({ page: p.path, kind: "obj", insertAt: objAt + 1, contact: null });
        } else {
          const from = objAt + 1 + a.index + a[0].length - 1;
          const close = braceEnd(src, from);
          if (close > 0) {
            out.push({
              page: p.path, kind: "obj",
              // Runs to the comma, so a full removal leaves no `contact: {},`
              // behind — the source is stored and re-read on every later edit.
              at: objAt + 1 + a.index,
              to: src[close + 1] === "," ? close + 2 : close + 1,
              contact: readContact(src.slice(from + 1, close)),
            });
          }
        }
      }
    }
  }
  return out;
}

/** `{ phone: "…", … }` as it should appear in the source, or "" for nothing. */
function contactBody(fields) {
  const parts = CONTACT_FIELDS
    .filter((f) => typeof fields[f] === "string" && fields[f] !== "")
    .map((f) => `${f}: ${JSON.stringify(fields[f])}`);
  return parts.length ? `{ ${parts.join(", ")} }` : "";
}

/**
 * Write the contact details into every page's chrome.
 *
 * BACK TO FRONT, PER FILE, for the reason `applyNav` states: each write changes
 * the length of the source, so a forward pass lands every later offset in
 * whatever moved into it.
 */
export function applyContact(pages, change) {
  const asked = CONTACT_FIELDS.filter((f) => typeof (change || {})[f] === "string");
  if (!asked.length) return { pages: Array.isArray(pages) ? pages : [], changed: [] };

  const byPage = new Map();
  for (const s of contactSlots(pages)) {
    if (!byPage.has(s.page)) byPage.set(s.page, []);
    byPage.get(s.page).push(s);
  }

  const changed = [];
  const next = (Array.isArray(pages) ? pages : []).map((p) => {
    const mine = byPage.get(p && p.path);
    if (!mine || !mine.length) return p;
    let src = p.source;
    for (const s of [...mine].sort((a, b) => (b.at ?? b.insertAt) - (a.at ?? a.insertAt))) {
      // ABSENT MEANS UNCHANGED, so the merge starts from what is already there.
      const merged = { ...(s.contact || {}) };
      for (const f of asked) merged[f] = change[f];
      const body = contactBody(merged);

      // NOTHING TO DO IS NOT A CHANGE. The writer re-serialises the whole
      // object, so without this an answer restating what is already there
      // rewrites every page, runs the container and cuts a version — and the
      // customer is told it worked when nothing moved. Compared on the SERIALISED
      // form, which is the only thing that reaches the file.
      if (s.contact && body === contactBody(s.contact)) continue;

      if (!s.contact) {
        // Nothing there yet, and nothing to write: asking to clear a field on a
        // site that has no contact block at all is a no-op, not a failure.
        if (!body) continue;
        src = src.slice(0, s.insertAt) +
          (s.kind === "jsx" ? " contact={" + body + "}" : " contact: " + body + ",") +
          src.slice(s.insertAt);
        continue;
      }
      if (!body) {
        const from = s.at > 0 && src[s.at - 1] === " " ? s.at - 1 : s.at;
        src = src.slice(0, from) + src.slice(s.to);
        continue;
      }
      src = src.slice(0, s.at) +
        (s.kind === "jsx" ? "contact={" + body + "}" : "contact: " + body + ",") +
        src.slice(s.to);
    }
    if (src === p.source) return p;
    changed.push(p.path);
    return { ...p, source: src };
  });
  return { pages: next, changed };
}

/**
 * Every link in the PAGES, as opposed to the chrome.
 *
 * WHAT THIS REACHES THAT NOTHING ELSE DID. Measured across the 337 pages the
 * generator learns from and writes: 600 links live in the chrome — the menu and
 * the header button, both site-wide editable — and 469 live in the page bodies,
 * where the only lane that could touch one was `page`: one page at a time, one
 * model call, for a link's destination. There was no site-wide version at all.
 *
 * The text lane cannot help, deliberately: it refuses `href` and `to` by name,
 * which is the rule that stops it rewriting a route id or a column reference.
 *
 * NAMED BY THEIR WORDS, because that is how a customer refers to one — "the Get
 * in touch link", not "the third anchor". The words are the element's own
 * children, which is why they have to be read rather than guessed at.
 *
 * COMMENTS ARE BLANKED FIRST. The template's own prose quotes `<Link to="/book">`
 * while explaining the convention, and a scan that reads it offers the customer a
 * link that does not exist — found by looking at real matches before writing a
 * line of this.
 *
 * NO HREF IS OWNED BY TWO SCANNERS, and it needs no exclusion to hold — which is
 * the opposite of what the first draft of this assumed. The menu is an array of
 * `{label, href}` object literals and the button an object literal, so neither
 * can contain a JSX link tag: measured across the 458 body links in the corpus,
 * ZERO fall inside a span `navSlots` or `actionSlots` owns.
 *
 * The draft skipped everything syntactically inside a `<SiteChrome>` tag, which
 * excluded nothing at all in 458 cases and was WRONG in the one shape it can
 * fire on — `footer={<a href="/terms">Terms</a>}`, a JSX-valued prop that is
 * legal today and that neither of the other two scanners can reach, so skipping
 * it made that link editable by nothing. The overlap property is asserted
 * directly instead, which is the thing that actually had to be true.
 */
const LINK_TAGS = /<(a|Link|SiteLink)\b/g;

export function linkSlots(pages) {
  const out = [];
  for (const p of Array.isArray(pages) ? pages : []) {
    if (!p || typeof p.path !== "string" || typeof p.source !== "string") continue;
    const src = p.source;
    // Length-preserving, so every offset below is valid against the REAL source.
    const scan = blankComments(src);

    let m;
    LINK_TAGS.lastIndex = 0;
    while ((m = LINK_TAGS.exec(scan))) {
      const end = tagEnd(scan, m.index);
      if (end < 0) continue;
      const tag = scan.slice(m.index, end);
      // `to` on the typed forms, `href` on everything else. A computed value —
      // `to={route}` — is skipped rather than guessed at.
      const attr = /\b(href|to)\s*=\s*"([^"]*)"/.exec(tag);
      if (!attr) continue;
      const at = m.index + attr.index + attr[0].indexOf('"') + 1;
      const to = at + attr[2].length;
      out.push({
        page: p.path,
        tag: m[1],
        // A `<Link to>`/`<SiteLink>` is TYPED against the route tree, so its
        // destination can only ever be a real route — an anchor or a `tel:`
        // there fails the build rather than degrading.
        typed: m[1] !== "a",
        href: attr[2],
        at, to,
        label: linkLabel(scan, end, m[1]),
      });
      if (out.length >= MAX_LINK_SLOTS) return out;
    }
  }
  return out;
}

/**
 * A RUNAWAY GUARD, NOT A DISPLAY BOUND — and the two are deliberately not one
 * number. `linkSlots` feeds the APPLY as well as the digest, so a cap tuned to
 * what a model can read silently leaves links this lane cannot see: the customer
 * asks for every "Book now" to move, some of them do, and nothing says which.
 * What the model is SHOWN is bounded separately, by `MAX_LINK_LINES`.
 *
 * Measured: the whole 329-page exemplar corpus holds ~400 body links and a real
 * site is five to ten pages, so nothing genuine comes near this.
 */
export const MAX_LINK_SLOTS = 2000;

/** Enough lines to describe a site's links without burying the instruction. */
export const MAX_LINK_LINES = 40;

/** One instruction is not fifty link changes. */
export const MAX_LINK_CHANGES = 12;

/** The words between the element's tags, with any nested markup dropped. */
function linkLabel(src, from, tag) {
  const close = src.indexOf("</" + tag, from);
  if (close < 0 || close - from > 400) return "";
  return src.slice(from + 1, close)
    .replace(/<[^>]*>/g, " ")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

/** Comments blanked, offsets preserved — never removed, or every index shifts. */
function blankComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));
}

/**
 * Which links a requested change actually names.
 *
 * MATCHED ON THE WORDS, THE DESTINATION, OR BOTH. The words are how a customer
 * refers to a link; the destination is how they refer to a set of them ("all the
 * ones pointing at the old prices page"). Given both, both must match — which is
 * what lets one instruction pick "Book now → /book" apart from "Book now →
 * /classes" on a site that has each.
 *
 * A CHANGE THAT NAMES NEITHER MATCHES NOTHING, deliberately. An entry carrying
 * only a destination to move TO is a model that answered the field and not the
 * question, and applying it to every link on the site is the single most
 * destructive thing this lane could do.
 */
export function matchLinks(slots, change) {
  const label = typeof change.label === "string" ? change.label.trim().toLowerCase() : "";
  const from = typeof change.from === "string" ? change.from.trim() : "";
  if (!label && !from) return [];
  return (Array.isArray(slots) ? slots : []).filter((s) => {
    if (label && s.label.trim().toLowerCase() !== label) return false;
    if (from && s.href !== from) return false;
    return true;
  });
}

/**
 * Rewrite the links a change names, across every page that carries one.
 *
 * A TYPED LINK CAN ONLY EVER POINT AT A REAL PAGE. `<Link to>` and `<SiteLink>`
 * are checked against the route tree the container generates, so an anchor or a
 * `tel:` there is not a degraded link — it is a build that fails and a customer
 * left with the site they had plus a bill. Those slots are refused with a reason
 * and the plain `<a>` ones in the same change still go through.
 *
 * BACK TO FRONT, PER FILE, for the reason the two scanners above state: every
 * write changes the length of the source.
 */
export function applyPageLinks(pages, changes, routes) {
  const list = Array.isArray(changes) ? changes : [];
  if (!list.length) return { pages: Array.isArray(pages) ? pages : [], changed: [], moved: 0, refused: [] };

  const known = new Set((Array.isArray(routes) ? routes : []).filter(Boolean));
  const slots = linkSlots(pages);
  const edits = new Map();
  const refused = [];
  let moved = 0;

  for (const c of list) {
    const to = c && typeof c.to === "string" ? c.to.trim() : "";
    if (!to) continue;
    const hits = matchLinks(slots, c);
    if (!hits.length) { refused.push({ ...c, why: "no-such-link" }); continue; }
    const why = actionHrefProblem(to, known);
    if (why) { refused.push({ ...c, why }); continue; }
    // A typed link takes only a real page, and `known` is exactly that set.
    const plainOnly = !known.has(to);
    for (const s of hits) {
      if (s.typed && plainOnly) { refused.push({ ...c, why: "typed-needs-page" }); continue; }
      if (s.href === to) continue;
      if (!edits.has(s.page)) edits.set(s.page, []);
      edits.get(s.page).push({ at: s.at, to: s.to, href: to });
      moved++;
    }
  }

  const changed = [];
  const next = (Array.isArray(pages) ? pages : []).map((p) => {
    const mine = edits.get(p && p.path);
    if (!mine || !mine.length) return p;
    let src = p.source;
    for (const e of [...mine].sort((a, b) => b.at - a.at)) {
      src = src.slice(0, e.at) + e.href + src.slice(e.to);
    }
    if (src === p.source) return p;
    changed.push(p.path);
    return { ...p, source: src };
  });
  return { pages: next, changed, moved, refused };
}

/**
 * Why a link change could not be made, in a sentence the owner can act on.
 *
 * NAMED PER REASON, because the three are three different next steps: find the
 * right words, ask for the page first, or point a typed link somewhere it can
 * actually go. A single "couldn't do that" leaves them guessing at which.
 */
export function linkRefusal(refused) {
  const list = (Array.isArray(refused) ? refused : []).filter(Boolean);
  if (!list.length) return "";
  const name = (r) => "“" + (r.label || r.from || r.to) + "”";
  const first = list[0];
  if (first.why === "no-such-link") {
    return "I couldn't find a link saying " + name(first) + " anywhere on the site.";
  }
  if (first.why === "typed-needs-page") {
    return "That link is typed against the site's own pages, so it can only point at one of them — " +
      first.to + " isn't a page here.";
  }
  if (first.why === "no-such-page") {
    return "There's no " + first.to + " page on the site yet, so I left that link where it was.";
  }
  return "I couldn't use " + first.to + " as a destination, so that link is unchanged.";
}
