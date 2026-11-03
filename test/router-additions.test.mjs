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
import { ASK_TOOL } from "../builder/route-shared.mjs";

const P = ASK_TOOL.input_schema.properties;
const INTENT = P.intent.description.split("\n");
const LAYER = P.layer.description.split("\n");
const ALSO = P.alsoAsked.description;

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

test("the addon clause claims the frame, new words and a new photograph, with examples that are not run 90's", () => {
  const open = oneLine(INTENT, /^"addon" — ADDING SOMETHING THE SITE DOES NOT HAVE YET\./, "the addon clause");
  const frame = oneLine(INTENT, /^A NEW ITEM IN THE FRAME EVERY PAGE SHARES IS AN ADDITION TOO/, "the frame/words/photo line");
  const edit = oneLine(INTENT, /^"edit" is for what the site ALREADY HAS/, "the edit sentence");
  assert.ok(open.at < frame.at && frame.at < edit.at, "the line is not inside the addon clause");
  const s = frame.line;
  for (const thing of ["a link added to the menu", "a social or small-print link added to the footer", "a contact detail added at the bottom",
    "a button added at the top", "a line or a sentence added to a page", "a photograph added to a page"]) {
    assert.ok(s.includes(thing), "the line does not name " + thing);
  }
  assert.match(s, /even one that shows some already/, "a photograph beside the page's own is not said to be an addition");
  assert.match(s, /the link, the button, the line and the photograph do not\.$/);
  // THE PHOTOGRAPH LEFT THE OPENING LIST'S "on a page that does not have one":
  // the existing photographs no longer decide it.
  assert.doesNotMatch(open.line, /photograph on a page that does not have one/);
});

test("no edit layer gives an addition as its own example any more, and each says where an addition goes", () => {
  // THE OBSERVER IS ALIVE: each clause is found, and each has examples to scan.
  const nav = clause("nav", "page");
  const picture = clause("picture", "logo");
  const text = clause("text", "look");
  const page = clause("page", "rename");
  for (const [name, c] of [["nav", nav], ["picture", picture], ["text", text], ["page", page]]) assert.ok(quotes(c).length >= 2, name + " has no examples to scan");
  // A QUOTED EXAMPLE THAT ADDS is what run 90 measured. Each clause's
  // examples are its own edits now; the one quoted addition allowed is inside
  // the sentence that says it is NOT this layer.
  // A line that says its example IS an addon (the nav clause's "a page the
  // site does not have yet") is the rule, not a counter-example.
  const adds = (c) => c.filter((l) => !/IS NOT THIS LAYER|ARE NOT THIS LAYER|IS NOT AN EDIT|is an "addon"|intent "addon"/.test(l))
    .flatMap((l) => [...l.matchAll(/"([^"]+)"/g)].map((m) => m[1]))
    .filter((q) => /^add\b/i.test(q) || /^put\b.*\b(in|on|at|to) the (menu|footer|bottom|top|header)\b/i.test(q));
  assert.deepEqual(adds(nav), [], "the nav clause still gives an addition as its own example");
  assert.deepEqual(adds(picture), [], "the picture clause still gives an addition as its own example");
  assert.deepEqual(adds(page), [], "the page clause still gives an addition as its own example");
  assert.ok(nav.some((l) => /^ADDING TO THE FRAME IS NOT AN EDIT: a NEW menu link, a NEW social or small-print link, a NEW contact detail or a NEW button is intent "addon"/.test(l)), "nav does not send a frame addition to addon");
  assert.ok(picture.some((l) => /^A PHOTOGRAPH ADDED TO A PAGE IS NOT THIS LAYER/.test(l) && /intent "addon", even on a page that shows some already/.test(l)), "picture does not send a new photograph to addon");
  assert.ok(text.some((l) => /^WORDS THAT ARE NOT ON THE PAGE YET ARE NOT THIS LAYER: a line, a sentence or a paragraph ADDED to a page is intent "addon"/.test(l)), "text does not send new words to addon");
  assert.ok(page.some((l) => /Something NEW on the page — a section, a line of words, a photograph — is intent "addon", not this layer\./.test(l)), "page does not send something new to addon");
  assert.ok(!page.some((l) => /add a block built from parts the page already has/.test(l)), "page still claims an added block");
  assert.ok(LAYER.some((l) => /^A CHANGE TO THE MENU IT HAS IS "nav", NOT THIS\./.test(l)));
  assert.ok(!LAYER.some((l) => /NOT THIS AND NOT "addon"/.test(l)), "a new menu item is still kept from the add-on");
});

test("the edits that must stay edits are still claimed: existing menu items, the button, footer details, a photograph's swap and crop", () => {
  const nav = clause("nav", "page").join("\n");
  assert.match(nav, /THE MENU — which items are in it, what order they come in, taking one out\./);
  for (const ex of ["Put Book first", "take Pricing out of the nav", "the menu should be Home, Services, Contact", "Change the Book button to Get a quote",
    "drop the button", "take the Twitter icon off", "the address is wrong, we've moved", "take the opening times off"]) {
    assert.ok(nav.includes("\\\"" + ex + "\\\"") || nav.includes("\"" + ex + "\""), "nav lost the edit example " + JSON.stringify(ex));
  }
  assert.match(nav, /A menu they want REWRITTEN as a whole list, in the order they give, is still this layer\./);
  assert.match(nav, /A phone number belongs here/);
  assert.match(nav, /Instagram/);
  assert.match(nav, /small print/);
  const picture = clause("picture", "logo").join("\n");
  assert.match(picture, /swapping one for another, filling the empty frame, taking one off, or CHANGING WHICH PART OF IT YOU SEE/);
  assert.match(picture, /A PICTURE THAT IS CUT OFF IS THIS LAYER, AND IT COSTS NOTHING/);
  // A stored row added stays the add-on's, one taken off stays `data`.
  const data = clause("data", "text").join("\n");
  assert.match(data, /A NEW ENTRY IS NOT THIS LAYER/);
  assert.match(data, /TAKING AN EXISTING ROW OFF ONE OF THOSE LISTS IS THIS LAYER TOO/);
  // A whole page taken off stays `page` with `remove`.
  assert.ok(LAYER.some((l) => /^THIS IS ALSO WHERE A PAGE IS DELETED\./.test(l)));
});

test("look's reach is what the site already has, so a new item beside a look change is held back, not dropped into look", () => {
  assert.match(ALSO, /Each as the site already has it: a NEW menu link, button, line of words or photograph is an addition, which "look" does not make\./);
  // THE LEGITIMATE HOLD IS UNCHANGED: something to ADD beside a change.
  assert.match(ALSO, /something to ADD that the site does not have yet beside a change/);
  // And the whole-message rule, which reads that reach, is unchanged.
  const last = LAYER[LAYER.length - 1];
  assert.match(last, /^ONE ANSWER FOR THE WHOLE MESSAGE/);
  assert.match(last, /Hold a change back only when no one answer can make it with the rest\.$/);
});
