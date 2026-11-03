// PARKED (2026-11-03, park-old-way): the old-way half of test/no-emoji-replies.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
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
import { PICTOGRAPH } from "../../../test/fixtures/pictograph.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const ROOT = new URL("../../../", import.meta.url);
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
  "'Code re-sent ✓'",               // the sign-in form's own note
  // THE PROVIDER NOTICE (2026-10-24, provider-retry re-landed): fixed server
  // text, never model-written, whose exact symbols the owner wrote and approved
  // ("⚠ <Model> error 503 · Service Unavailable", "✓ <Model> is answering again
  // · picking up where it stopped": docs/plans/2026-10-24-model-failures.md,
  // "The exact fixed messages"). The owner's word wins over this guard for
  // these strings only; every model-written line is still held to it.
  '"⚠ " + f.model + " error " + f.code',             // builder/provider-retry.mjs noticeTitle
  'return "⚠ " + (label ? label + " · " : "") + what', // the panel row (module and page)
  "title: '\\u2713 ' + (wm.wait.model || 'The model') + ' is answering again", // the chat's recovery line
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
  // THE AGENTS' AVATAR ICONS (owner-approved mock-ups, 2026-11-02): pictures in
  // the conversations bar and the Create-an-agent icon picker, never a reply.
  "const AGENT_ICONS = { accounting: '\\u{1F4CA}'",
];

test("EVERY INSTRUCTION A MODEL WRITES TO THE CUSTOMER FROM says no emoji or symbols unless asked, and none invites one", async () => {
  const { REPLY_SYSTEM } = await import("../../../builder/site-reply.mjs");
  const { PROGRESS_SYSTEM, TASK_SYSTEM } = await import("../../../builder/site-progress.mjs");
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
