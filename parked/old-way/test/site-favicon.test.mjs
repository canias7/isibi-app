// PARKED (2026-11-03, park-old-way): the old-way half of test/site-favicon.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// The designer-drawn tab icon (2026-08-28, owner's call: "in the design step,
// lets add a svg step, for the favicon").
//
// TWO HALVES. The VALIDATOR is driven — it is the security boundary between a
// model-written SVG and a document served from the site's own origin, so every
// refusal class is exercised rather than read. The WIRING is source-read,
// because the field's whole failure mode is the recorded one: a value decided
// correctly in one module and dropped at a hop nobody asserted — the layer
// twelve features in this repo have died in.

import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import {
  cleanFavicon, FAVICON_FIELD, FAVICON_TAGS, FAVICON_ATTRS, MAX_FAVICON,
  readWordmark, WORDMARK_FIELD, MAX_WORDMARK,
} from "../../../builder/site-favicon.mjs";
import { mergeLook, currentStateNote, EDIT_FIELDS } from "../../../builder/site-edit.mjs";
import { readMark, sameMark, markWire } from "../../../builder/site-mark.mjs";

const worker = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
const server = fs.readFileSync(new URL("../../../builder/build-server.mjs", import.meta.url), "utf8");
const chat = fs.readFileSync(new URL("../../../public/chat.js", import.meta.url), "utf8");

// Comments spell the things these tests assert about — the prose-contains-the-
// spelling trap, recorded in this repo nine-plus times — so every source scan
// below runs over a length-preserving blank of the WHOLE-LINE comments.
const blank = (src) => src.replace(/^\s*\/\/[^\n]*$/gm, (m) => " ".repeat(m.length));

/** A window from a landmark to the next top-level declaration — never bytes. */
function topLevel(src, opener) {
  const at = src.indexOf(opener);
  assert.ok(at >= 0, "anchor missing: " + opener);
  const rest = src.slice(at + opener.length);
  const end = rest.search(/\n(?:async\s+)?function\s|\nconst\s|\nexport\s/);
  assert.ok(end > 200, "window collapsed for: " + opener);
  return src.slice(at, at + opener.length + end);
}

const GOOD =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">' +
  '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
  '<stop offset="0" stop-color="#1a1a1a"/><stop offset="1" stop-color="#444"/>' +
  "</linearGradient></defs>" +
  '<rect width="64" height="64" rx="14" fill="url(#g)"/>' +
  '<path d="M18 40 L32 16 L46 40 Z" fill="#f4efe6"/></svg>';

test("the router knows a tab-icon ask is the cheap look layer", () => {
  // Without this sentence every layer below it is unreachable for the one
  // message shape it serves — the publicView lesson, which has cost a whole
  // site twice: a capability nobody is told about is one nobody routes to.
  const ask = fs.readFileSync(new URL("../builder/site-ask.mjs", import.meta.url), "utf8");
  const at = ask.indexOf('\\"look\\" — colour, theme');
  assert.ok(at > 0, "the look layer's description is gone");
  assert.match(ask.slice(at, at + 400), /TAB ICON/, "the look layer never mentions the tab icon");
});


/* ── the wordmark: text or a drawn logo (owner's call, 2026-08-28) ─────────── */

const MARK = '<svg viewBox="0 0 240 64"><rect width="240" height="64" rx="8" fill="#10331f"/>' +
  '<path d="M20 44 V20 h8 l10 16 10-16 h8 v24 h-7 V33 l-8 12 h-6 l-8-12 v11 z" fill="#f2f7f0"/></svg>';

test("the reply and the router both know the logo choice", () => {
  assert.match(chat, /wordmark: 'the logo'/);
  const ask = fs.readFileSync(new URL("../builder/site-ask.mjs", import.meta.url), "utf8");
  const at = ask.indexOf('\\"look\\" — colour, theme');
  assert.ok(at > 0);
  assert.match(ask.slice(at, at + 700), /draw us a logo/,
    "the look layer never says a drawn logo is reachable without a file");
});
