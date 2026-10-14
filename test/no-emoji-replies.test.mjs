// NO EMOJI OR CHECKMARKS IN WHAT THE BUILDER SAYS, AND NO NUMBERS ON A
// REQUEST'S PARTS (the owner, 2026-10-13).
//
// *"i dont want checkmarks or emojis in the progress stuff neither regular
// chats unless requested"*, and, choosing from rendered options, a dash before
// each part instead of 1, 2, 3 ("E"), and a dash before each progress line in
// place of its time, with the thin thread between them and no dot ("4c").
//
// THREE HALVES, EACH ASSERTED WHERE IT LIVES:
//   1. the sentences our own code says: no pictograph in any string the chat
//      or the builder composes, except the few interface labels named below;
//   2. the sentences a model writes: each customer-facing instruction says no
//      emoji or symbols unless the customer asked, and none invites one;
//   3. the card: the parts and the progress lines carry no number, time or dot,
//      and the stylesheet draws the dash.
import { PICTOGRAPH } from "./fixtures/pictograph.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const ROOT = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");
const PIC = PICTOGRAPH;

// Escapes are read as the characters they make: `'\u2705 Back online.'` is a tick.
const unescape = (l) => l.replace(/\\u\{?([0-9a-fA-F]{4,5})\}?/g, (m, h) => String.fromCodePoint(parseInt(h, 16)));
/** Every non-comment line of `src` carrying a pictograph, as `file:line: text`. */
function pictographLines(file, src) {
  const out = [];
  src.split("\n").forEach((l, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(l)) return;
    if (PIC.test(unescape(l))) out.push(file + ":" + (i + 1) + ": " + l.trim());
  });
  return out;
}

// THE ONLY PICTOGRAPHS LEFT, and why each is not a reply:
const ALLOWED = [
  "★ Most popular",                 // a pricing card's badge
  "'🔔 Emails on' : '🔕 Emails off'", // the email toggle's own label
  "(o.body ? '▶' : '')",            // a build step's expand chevron
  ".replace(/^✅",                   // reading a reply stored before this rule
  "⚠ THE LINE IS ENFORCEMENT",      // the router's own instructions, never shown
  "Pictogram",                      // a kit component's name in a usage example
  // FOUND ONLY ONCE THE SET WAS PINNED (2026-10-14): ✓ U+2713 and ✕ U+2715 are
  // not \p{Extended_Pictographic} on any Unicode, so the scanner never saw them.
  // Interface controls and form notes, not a reply or a progress line:
  '<span class="check">✓</span>',   // the selected item in the model and effort menus
  'aria-label="Close">✕</button>',  // a dialog's close button
  'class="cp-close">✕</button>',    // the top-up panel's close button
  'class="cp-close up-close">✕</button>',
  'aria-label="Remove" title="Remove">✕</button>', // removing an automation step
  "'Code re-sent ✓'",               // the sign-in form's own note
  "'Password updated ✓'",           // the settings form's own note
  '"up-credroll">✓ Unused credits roll over', // a pricing card's feature line
  "'Link preview \\u2713'",          // the file list's toggle, on
  '"✓ "',                           // docs/components.md's generator (compared byte for byte)
  "A ✓ means it exists",            // the same generator's legend
  // WAITING FOR THE OWNER: the build card's step marks and stage chips. These
  // are progress, which the 2026-10-13 rule covers; the marks are the owner's
  // own treatment E (2026-09-07), whose guard requires a failed step to differ
  // by shape, not colour alone. Not changed without the owner's choice
  // (docs/backlog.md).
  '<span class="st-step-tick">✓</span>',
  '<span class="st-step-fail">✕</span>',
  '<span class="st-bchip">✓ \'',
];

test("the scanner is alive: it finds a tick, a warning sign and an escaped one, and skips comments", () => {
  assert.deepEqual(pictographLines("x", "const a = '✅ Done.';\n// ⚠️ a comment\nconst b = '\\u26a0\\ufe0f x';\nconst c = 'plain';").map((l) => l.split(":")[1]), ["1", "3"]);
});

// RUN 38503645857 (2026-10-14): CI's Node 22.23 ships Unicode 17, which took ★
// and 688 other characters out of \p{Extended_Pictographic}; this machine's
// Node 22.22 (Unicode 16) kept them. The scanner found the pricing badge here
// and not there. The set is now pinned (test/fixtures/pictograph.mjs).
test("the scanner reads the same on every Node: the characters Unicode 17 dropped, and the checkmarks and crosses it never had, are found", () => {
  for (const c of ["★", "☐", "☒", "⚑", "✎", "✓", "✗", "✘", "✕", "☆", "✅", "✔", "⚠", "🎉"]) assert.ok(PIC.test(c), "not found: " + c);
  for (const c of ["→", "•", "–", "—", "£", "é", "a"]) assert.ok(!PIC.test(c), "plain text read as a pictograph: " + c);
  // and no test asks the runtime alone again
  const bare = readdirSync(new URL("test/", ROOT)).filter((f) => f.endsWith(".mjs"))
    .filter((f) => /\\p\{Extended_Pictographic\}\/u/.test(read("test/" + f)));
  assert.deepEqual(bare, [], "a test reads emoji from the running Node's Unicode tables alone");
});

test("NOTHING OUR CODE SAYS carries an emoji or a checkmark: the chat, the poll and every builder module", () => {
  const files = ["public/chat.js", "public/edit-poll.js", "public/site-list.js", "worker.js",
    ...readdirSync(new URL("builder/", ROOT)).filter((f) => f.endsWith(".mjs")).map((f) => "builder/" + f)];
  assert.ok(files.length > 40, "the builder's modules were not found");
  const found = files.flatMap((f) => pictographLines(f, read(f)));
  const left = found.filter((l) => !ALLOWED.some((a) => l.includes(a)));
  assert.deepEqual(left, [], "a sentence carries an emoji or a checkmark:\n" + left.join("\n"));
  // Each allowance is still needed: one that matches nothing is a hole.
  for (const a of ALLOWED) assert.ok(found.some((l) => l.includes(a)), "an allowance matches nothing now — drop it: " + a);
});

test("EVERY INSTRUCTION A MODEL WRITES TO THE CUSTOMER FROM says no emoji or symbols unless asked, and none invites one", async () => {
  const { REPLY_SYSTEM } = await import("../builder/site-reply.mjs");
  const { PROGRESS_SYSTEM, TASK_SYSTEM } = await import("../builder/site-progress.mjs");
  const { ASK_TOOL, LIVE_ASK_TOOL } = await import("../builder/site-ask.mjs");
  const said = {
    "the final reply": REPLY_SYSTEM,
    "a progress line": PROGRESS_SYSTEM,
    "a task's lines": TASK_SYSTEM,
    "the router's answer (first build)": ASK_TOOL.input_schema.properties.answer.description,
    "the router's answer (a live site)": LIVE_ASK_TOOL.input_schema.properties.answer.description,
  };
  for (const [what, text] of Object.entries(said)) {
    assert.equal(typeof text, "string", what + " is not found");
    assert.match(text, /no[^.\n]*emoji[^.\n]*unless[^.\n]*ask/i, what + " does not rule out emoji unless asked");
    assert.doesNotMatch(text, PIC, what + " shows the model an emoji to copy");
  }
  assert.doesNotMatch(REPLY_SYSTEM, /You may start with/, "the final reply is still invited to open with a symbol");
});

test("THE CARD: a part has no number and a progress line no time or dot; the stylesheet draws a dash for each", () => {
  const chat = read("public/chat.js");
  const css = read("public/styles.css");
  const fn = chat.slice(chat.indexOf("function progressListHTML("), chat.indexOf("\n}\n", chat.indexOf("function progressListHTML(")));
  assert.ok(fn.length > 40, "progressListHTML is gone");
  assert.doesNotMatch(fn, /class="at"|<i>|progressAt|\.ms\b/, "a progress line still carries its time or the live dot");
  assert.ok(!chat.includes("function progressAt("), "the time is still formatted for a line");
  const rule = (sel) => { const m = css.match(new RegExp("(^|\\n)" + sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " \\{([^}]*)\\}")); return m ? m[2] : null; };
  assert.match(rule(".st-req-parts") || "", /list-style: none/, "the parts are numbered again");
  assert.match(rule(".st-req-part::before") || "", /content: '\\2013'/, "a part has no dash");
  assert.match(rule(".st-req-prog li::before") || "", /content: '\\2013'/, "a progress line has no dash");
  assert.match(rule(".st-req-prog li:not(:last-child)::after") || "", /width: 1px/, "the thread between progress lines is gone");
  assert.doesNotMatch(css, /\.st-req-prog li\.live i\b/, "the live dot is drawn again");
});
