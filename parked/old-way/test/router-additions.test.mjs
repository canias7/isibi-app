// PARKED (2026-11-03, park-old-way): the old-way half of test/router-additions.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// ── A NEW MENU LINK, FOOTER LINK, HEADER BUTTON, LINE OR PHOTOGRAPH IS AN ADDITION (2026-10-02) ──
//
// Run 90 (A1–A5): five additions — a footer link, a menu link, a header
// button, a line on a page and a photograph on a page — all came back `edit`,
// because the `nav`, `picture`, `text` and `page` clauses gave additions as
// their own examples, against the add-on clause and the tie-break. The owner:
// *"Make the router consistently treat new menu links, footer links, header
// buttons, page text and photos as additions, and ensure the add-on path can
// actually deliver them before changing live routing."* The add-on path now
// delivers each (`frame`, `words`, `photo`); these guard the wording, the
// request the real route sends, and the edits that must stay edits.
import test from "node:test";
import assert from "node:assert/strict";
import { ASK_TOOL, askRequest } from "../builder/site-ask.mjs";

const P = ASK_TOOL.input_schema.properties;
const INTENT = P.intent.description.split("\n");
const LAYER = P.layer.description.split("\n");
const ALSO = P.alsoAsked.description;
const SYSTEM = askRequest({ message: "x", site: { name: "s" }, hasSite: true }).system[0].text;

function oneLine(lines, re, what) {
  const hits = lines.map((l, i) => [l, i]).filter(([l]) => re.test(l));
  assert.equal(hits.length, 1, what + ": expected exactly one line, found " + hits.length);
  return { line: hits[0][0], at: hits[0][1] };
}
function clause(layer, next) {
  const at = LAYER.findIndex((l) => l.startsWith("\"" + layer + "\" — "));
  const end = LAYER.findIndex((l) => l.startsWith("\"" + next + "\" — "));
  assert.ok(at >= 0 && end > at, "the " + layer + " clause's landmarks moved");
  return LAYER.slice(at, end);
}
const quotes = (lines) => lines.flatMap((l) => [...l.matchAll(/"([^"]+)"/g)].map((m) => m[1]));

test("the tie-break, the edit sentence and the system's cost rule say the same, and keep existing items edits", () => {
  const t = oneLine(INTENT, /^THE QUESTION THAT SEPARATES EDIT FROM ADDON:/, "the tie-break").line;
  assert.match(t, /a new link in the menu or the footer, a new button at the top, a new line of words and a new photograph on a page, whatever each one goes into/);
  assert.match(t, /Changing an entry that is already there, or taking one off, is "edit"\. So is changing or taking off a link, a button, the words or a photograph the site already has\./);
  const e = oneLine(INTENT, /^"edit" is for what the site ALREADY HAS/, "the edit sentence").line;
  assert.match(e, /changed, moved or taken away/);
  assert.match(e, /A NEW link, button, line or photograph put beside the ones it has is not an edit\./);
  assert.match(SYSTEM, /COST NEVER MAKES A NEW ENTRY AN EDIT:[^\n]*Nor does it make the other additions edits: a new menu link, footer link or button, a new line of words or a new photograph on a page is an "addon"/);
  // AND THE FIELD STILL ENDS AS IT DID: unsure is addon, a removal never is.
  assert.match(INTENT[INTENT.length - 2], /^WHEN YOU CANNOT TELL, ANSWER "addon"/);
  assert.match(INTENT[INTENT.length - 1], /^A REMOVAL IS NEVER AN ADDON\./);
});

test("the request the routing call really sends carries the rules, and none of run 90's messages verbatim", () => {
  const req = askRequest({ message: "Add our Instagram to the footer.", site: { name: "Harbour Loaf", pages: ["/", "/visit"] }, hasSite: true });
  const wire = JSON.stringify(req);
  for (const rule of ["A NEW ITEM IN THE FRAME EVERY PAGE SHARES IS AN ADDITION TOO", "ADDING TO THE FRAME IS NOT AN EDIT",
    "A PHOTOGRAPH ADDED TO A PAGE IS NOT THIS LAYER", "WORDS THAT ARE NOT ON THE PAGE YET ARE NOT THIS LAYER", "Nor does it make the other additions edits"]) {
    assert.ok(wire.includes(rule), "the request does not carry: " + rule);
  }
  // THE VALIDATION BATCH SENDS RUN 90'S OWN SENTENCES, so the prompt must not
  // carry them: a rule that names the test's words would pass the test and
  // say nothing about the next customer.
  const instructions = JSON.stringify([req.system, req.tools]);
  for (const sent of ["@harbourloaf", "Add Order to the menu", "Call us button at the top that rings", "closed on bank holidays", "sourdough to the Visit page"]) {
    assert.ok(!instructions.includes(sent), "the router's instructions carry run 90's message: " + sent);
  }
});
