// A CLOUD CARD OPENS THE OFFLINE/ONLINE PANEL (2026-09-08, owner: "add the
// card").
//
// `sitePublishPanel` holds "Take it offline" and "Put it back online", and its
// ONLY caller was the Publish button on the workspace top bar — which was
// gated `isReact ? '' : …`, so it appeared only on a project that had never
// built. The capability was live on the server (`siteSetLive` →
// `POST /api/site/<slug>/offline`) and unreachable in the product; removing
// Publish on 2026-09-07 did not bury it, it was already buried.
//
// What these guards hold:
//
//   • the card exists, is dispatched, and opens THAT panel — a card with no
//     handler and a handler with no card are equally dead, and this repo has
//     shipped both;
//   • its sentence describes the PANEL, never the site's state, because the
//     state it would have to read (`site.offline`) is a browser-local flag
//     nothing puts on the wire;
//   • the panel and the setter behind it still exist, so the dispatch has
//     something to dispatch.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const CHAT = fs.readFileSync(path.join(here, "../public/chat.js"), "utf8");

/**
 * Whole-line comments blanked, LENGTH PRESERVED so offsets still line up.
 *
 * This change's own comments name `sitePublishPanel`, `visibility` and the
 * Publish button repeatedly while explaining where each one went — the
 * recorded "prose contains the thing it forbids", which here would let the
 * presence checks below pass by matching an explanation rather than code.
 */
const BARE = CHAT.split("\n")
  .map((l) => (/^\s*\/\//.test(l) ? " ".repeat(l.length) : l))
  .join("\n");

/** The card table, landmark to landmark — never a byte window. */
function cardTable() {
  const at = BARE.indexOf("const cards = [");
  assert.ok(at > 0, "moreCloud's card table is gone");
  const end = BARE.indexOf("\n  ];", at);
  assert.ok(end > at, "the card table has no end landmark — re-derive this window");
  return BARE.slice(at, end);
}

/** Each row's LAST element: the value `data-cloud` is built from. */
function cardKeys() {
  return [...cardTable().matchAll(/,\s*'([a-z]+)'\],/g)].map((m) => m[1]);
}

// ── THE CARD ────────────────────────────────────────────────────────────────

test("Cloud offers a Visibility card, keyed at its own position", () => {
  const keys = cardKeys();
  // THE OBSERVER IS ALIVE: the table really parsed, so an absence below is an
  // absence in the product rather than in this reader.
  assert.ok(keys.length >= 13, "only " + keys.length + " cards found — the table reader is broken");
  assert.ok(keys.includes("visibility"), "the Visibility card is gone from Cloud; found " + keys.join(", "));

  // MATCHED AT THE KEY'S OWN POSITION — the recorded trap from the Submissions
  // card, where `'inbox'` is ALSO that row's icon name at position 0, so a
  // plain `includes` could not tell a renamed key from an unchanged icon.
  // `zap` is this row's icon and is deliberately not a key anywhere.
  assert.ok(!keys.includes("zap"), "an icon name is being read as a dispatch key — the reader is too loose");

  const row = cardTable().split("\n").find((l) => /'visibility'\],\s*$/.test(l));
  assert.ok(row, "the Visibility row moved out of the table's own lines");
  assert.match(row, /^\s*\['zap', 'Visibility',/, "the card's icon or name moved");
});

test("the card is live for any published site, backend or not", () => {
  const row = cardTable().split("\n").find((l) => /'visibility'\],\s*$/.test(l));
  // `!!site.slug`, the Domains rule — NOT `dataLive`. Taking a site off the web
  // has nothing to do with whether it has a database, and gating on one would
  // hide the control from every brochure site, which is most of the platform.
  assert.match(row, /,\s*!!site\.slug,\s*'visibility'\]/,
    "the Visibility card is gated on something other than having an address");
  assert.ok(!/dataLive,\s*'visibility'\]/.test(row),
    "the card is gated on having a database — a site with no backend can still go offline");
});

test("the card's sentence describes the panel, never the site's state", () => {
  const row = cardTable().split("\n").find((l) => /'visibility'\],\s*$/.test(l));

  // THE REASON THIS IS A GUARD AND NOT A PREFERENCE. `site.offline` is written
  // by `siteSetLive` into localStorage and is carried by NOTHING on the wire:
  // asserted here against the two files that would have to carry it, so this
  // case fails the day somebody wires it and the sentence may then tell the
  // truth about state.
  const listJs = fs.readFileSync(path.join(here, "../public/site-list.js"), "utf8");
  assert.ok(!/offline/.test(listJs),
    "site-list.js carries `offline` now — the card MAY report the real state; re-derive this guard");

  // So the row may not read that flag, and may not claim either state.
  assert.ok(!/site\.offline/.test(row),
    "the card reads a browser-local flag: a site taken offline elsewhere would be described wrongly");
  assert.ok(!/[Ll]ive at|[Oo]ff the web right now|currently/.test(row),
    "the card claims a state it cannot know for a site taken offline on another machine");

  // AND IT STILL SAYS WHAT IT DOES, both ways round — a card whose sentence
  // said nothing would pass every assertion above.
  assert.match(row, /Take your site off the web, or put it back/, "the live sentence");
  assert.match(row, /Build the first draft/, "the not-yet-built sentence");
});

// ── THE DOOR ────────────────────────────────────────────────────────────────

test("the card is dispatched, and opens the panel that was orphaned", () => {
  assert.match(BARE, /b\.dataset\.cloud === 'visibility'\) sitePublishPanel\(site\)/,
    "the Visibility card opens nothing — a card with no handler is the dead control this repo keeps finding");

  // A HANDLER WITH NO CARD IS AS DEAD AS A CARD WITH NO HANDLER, so both ends
  // of the chain are asserted, and so is what sits behind them.
  assert.match(BARE, /function sitePublishPanel\(site\)/, "the panel itself is gone");
  assert.match(BARE, /function siteSetLive\(site, live\)/, "the setter behind the panel is gone");

  // The panel's own two controls, which are the whole point of giving it a
  // door: read out of the panel rather than assumed.
  const at = BARE.indexOf("function sitePublishPanel(site)");
  const panel = BARE.slice(at, BARE.indexOf("\n}", at));
  assert.match(panel, /id="spUnpub"/, "“Take it offline” is gone from the panel");
  assert.match(panel, /id="spLive"/, "“Put it back online” is gone from the panel");
  assert.match(panel, /siteSetLive\(site, false\)/, "the offline button no longer calls the setter");
  assert.match(panel, /siteSetLive\(site, true\)/, "the online button no longer calls the setter");
});

test("Publish stayed deleted — this is a door, not a restoration", () => {
  // The owner removed the Publish button; giving its panel a Cloud card must
  // not quietly put the button back. Asserted BESIDE a control in the same top
  // bar group that stays, so the absence has a live observer.
  assert.ok(!BARE.includes('id="stPub"'), "the Publish button is back on the top bar");
  assert.ok(BARE.includes('id="stDl"'), "the top bar group is gone — re-anchor this");
});

test("the setter still reaches the route that really exists", () => {
  const at = BARE.indexOf("function siteSetLive(site, live)");
  const fn = BARE.slice(at, BARE.indexOf("\n}", at));
  // The one endpoint this whole feature rests on. `siteUnpublish` before it
  // POSTed a path with zero occurrences in worker.js and told the owner to try
  // again forever; the guard exists so a door is never opened onto that again.
  assert.match(fn, /'\/api\/site\/' \+ encodeURIComponent\(slug\) \+ '\/offline'/,
    "the setter's endpoint moved — check it is a route worker.js actually has");
  const worker = fs.readFileSync(path.join(here, "../worker.js"), "utf8");
  assert.match(worker, /\\\/offline\$/, "worker.js has no offline route — the card opens onto a 404");
  // `on: true` means OFFLINE, matching the route's name. Inverting this makes
  // both buttons do the opposite of what they say.
  assert.match(fn, /on: !live/, "the offline flag is inverted — the buttons would swap meanings");
});
