// ─────────────────────────────────────────────────────────────────────────────
// WHAT A PAGE EDIT MAY DO TO THE SITE'S OWN COMPONENTS (audit A21-2, finding 39,
// 2026-10-22)
// ─────────────────────────────────────────────────────────────────────────────
//
// The page rung shows its writer every stored component (`-parts/*.tsx`) and
// used to keep every one that came back, checked for photographs and for
// nothing else: `keepCheck` and `preservePageProse` compared the PAGE only, so
// a writer that returned /menu unchanged and `menu-card` with two items gone
// (and `visit-map`, which only /visit draws, reworded) published both with
// "Updated /menu." — the checks were handed two equal strings.
//
// TWO RULES, both read off the code, never off words in the request:
//
//   1. A COMPONENT THE EDITED PAGE DOES NOT DRAW IS KEPT AS IT WAS. Reached
//      from the page through its imports (and the imports of what it imports),
//      before or after the rewrite; an import this reader cannot follow counts
//      as reached, so the second rule still holds it to its words. A
//      component only another page draws is not this edit's to rewrite.
//   2. A COMPONENT IT DOES DRAW KEEPS ITS WORDS AND LINKS, except what the
//      message asks for. Its links and the components it draws are the page
//      check's own inventory (`keepInventory`, `inPart`); its words are read
//      with the page check's own parser (`proseInventory`). Every loss goes to
//      the same judge, item by item, with the same quote rules (`judgeItems`).
//
// A COMPONENT THAT BREAKS A RULE IS PUT BACK AS IT WAS, and the rest of the
// change still ships — the customer is told which, never "Updated" alone.
// A brand-new component has nothing to lose and is never held.

import { partBindings, partNameOf } from "./site-files.mjs";
import { keepInventory, headingAt, judgeItems, KEEP_MODEL } from "./page-keep.mjs";
import { proseInventory } from "./page-prose.mjs";
import { tweakParser } from "./site-tweak.mjs";

const named = (list) => (Array.isArray(list) ? list : []).filter((p) => p && typeof p.name === "string" && typeof p.source === "string");

/**
 * THE STORED COMPONENTS THIS PAGE DRAWS — a Set of names, followed through
 * components that import components. `null` from `partBindings` (an import
 * clause it cannot read) counts as drawn: cannot-tell never reads as "no".
 * A page that IS a component (`-parts/x.tsx`) draws itself.
 */
export function partsReached(pageSources, pagePath, stored) {
  const parts = named(stored);
  const seen = new Set();
  const self = partNameOf(pagePath);
  if (self) seen.add(self);
  const queue = (Array.isArray(pageSources) ? pageSources : []).filter((s) => typeof s === "string").map((s) => [s, !!self]);
  while (queue.length) {
    const [src, inPart] = queue.shift();
    for (const p of parts) {
      if (seen.has(p.name)) continue;
      const b = partBindings(src, p.name, inPart);
      if (b === null || b.length) { seen.add(p.name); queue.push([p.source, true]); }
    }
  }
  return seen;
}

/**
 * THE WORDS A REWRITE OF ONE COMPONENT TOOK OFF OR CHANGED — keep-check items.
 * Words are matched exactly (text and where they render) across the whole
 * file first; a lost line with an unmatched new line in the same kind of
 * element and the same place is one CHANGE ("£4" now reads "£5"); anything
 * else lost is LOST. Each carries the heading it sat under, so a request can
 * name it. `null` when the source cannot be read: cannot-tell is never "kept".
 */
export function partTextItems(before, after, parse) {
  let b, a;
  try { b = proseInventory(before, parse); a = proseInventory(after, parse); } catch { return null; }
  const key = (x) => JSON.stringify([x.text, x.context]);
  const added = a.atoms.slice();
  const lost = [];
  for (const atom of b.atoms) {
    const i = added.findIndex((x) => key(x) === key(atom));
    if (i >= 0) added.splice(i, 1); else lost.push(atom);
  }
  const items = [];
  for (const atom of lost) {
    const section = headingAt(before, atom.at);
    const i = added.findIndex((x) => x.role === atom.role && x.context === atom.context && x.heading === atom.heading);
    if (i >= 0) {
      const to = added.splice(i, 1)[0];
      items.push({ kind: "text-changed", label: atom.text, to: to.text, section });
    } else {
      items.push({ kind: "text-lost", label: atom.text, section });
    }
  }
  return items;
}

/**
 * ONE REWRITTEN COMPONENT, CHECKED — `keepCheck`'s verdicts: `kept`, `asked`,
 * `withheld`, or `unchecked` (no parser, an unreadable file, a judge that
 * failed). Only `kept` and `asked` may ship.
 */
export async function partKeepCheck({ message, before, after, does, send, model = KEEP_MODEL, parse }) {
  if (before === after) return { verdict: "kept", items: [], unsure: [], usage: null };
  const reader = parse === undefined ? await Promise.resolve().then(() => tweakParser()).catch(() => null) : parse;
  if (typeof reader !== "function") return { verdict: "unchecked", why: "no-parser", items: [], unsure: [], usage: null };
  const text = partTextItems(before, after, reader);
  if (!text) return { verdict: "unchecked", why: "unparsed", items: [], unsure: [], usage: null };
  const inv = keepInventory(before, after, { does, inPart: true });
  return judgeItems({ message, inv: { ...inv, items: [...inv.items, ...text] }, send, model });
}

/** A component in the customer's words: what it was declared to do, else its name spaced. */
export function partSaid(name, does) {
  const d = does instanceof Map ? does.get(name) : null;
  const t = typeof d === "string" ? d.trim().replace(/^(the|a|an)\s+/i, "") : "";
  return "the " + (t || String(name).replace(/[-_]+/g, " "));
}

const listOf = (xs) => xs.length <= 1 ? (xs[0] || "") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1];

/**
 * WHAT THE CUSTOMER IS TOLD ABOUT COMPONENTS PUT BACK — one sentence per
 * reason, `""` when there is none. `other` is drawn by another page only;
 * `lost` would have lost words or links the message did not ask about.
 * The browser (`public/chat.js`) and the reply facts (`site-reply.mjs`) say
 * the same two things in their own voice.
 */
export function partsHeldMsg(other, lost) {
  const o = (Array.isArray(other) ? other : []).filter((x) => typeof x === "string" && x);
  const l = (Array.isArray(lost) ? lost : []).filter((x) => typeof x === "string" && x);
  const out = [];
  if (l.length) out.push("I left " + listOf(l) + " exactly as " + (l.length === 1 ? "it was" : "they were") +
    ": the rewrite would also have taken words or links off " + (l.length === 1 ? "it" : "them") +
    " that you didn't ask about. Name exactly what to change there and I'll do just that.");
  if (o.length) out.push("I left " + listOf(o) + " exactly as " + (o.length === 1 ? "it was" : "they were") +
    ": " + (o.length === 1 ? "it isn't" : "they aren't") + " part of the page you asked about.");
  return out.join(" ");
}
