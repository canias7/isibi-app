// THE FOOTER'S CONTACT DETAILS, on the nav lane — and the comment-blind bracket
// scanner that fixing it exposed.
//
// The slots shipped on 2026-08-18 and only a fresh build could fill them: every
// site published before that could never get a phone number in its footer short
// of a ~27-credit rewrite. That is the on-disk-and-reachable-by-nothing shape
// this repo has deleted 289 files over, so the wiring is what most of this file
// asserts.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  CONTACT_FIELDS, MAX_CONTACT_CHARS, contactSlots, readContact, applyContact,
  navSlots, actionSlots, navDigest, readNav, navReply, runNavEdit, NAV_TOOL,
} from "../builder/site-nav.mjs";
import { ASK_TOOL } from "../builder/site-ask.mjs";
import { COMPONENT_TYPES } from "../builder/component-api.mjs";

const ROUTES = path.join(import.meta.dirname, "../builder/lovable/template/src/routes");
const page = (f) => ({ path: f, source: fs.readFileSync(path.join(ROUTES, f), "utf8") });
const REF = () => ["index.tsx", "book.tsx", "manage.tsx", "account.tsx"].map(page);

// ── the fields ────────────────────────────────────────────────────────────────

test("CONTACT_FIELDS is exactly what SiteContact declares", () => {
  // DERIVED, because two lists of one thing drift — and the direction this one
  // drifts in is a field the customer can be shown and cannot change, or one
  // written into the source that the component ignores.
  const shape = COMPONENT_TYPES["site-footer"] && COMPONENT_TYPES["site-footer"].SiteContact;
  assert.ok(shape, "SiteContact is no longer a resolvable type");
  const declared = [...shape.matchAll(/(\w+)\?\s*:/g)].map((m) => m[1]);
  assert.ok(declared.length >= 4, "the SiteContact scan found almost nothing — check the shape");
  assert.deepEqual([...CONTACT_FIELDS].sort(), declared.sort());
});

// ── reading what is there ─────────────────────────────────────────────────────

test("a real page's contact block is read back with its newline intact", () => {
  const slot = contactSlots([page("index.tsx")])[0];
  assert.ok(slot, "the home page yields no contact slot at all");
  assert.equal(slot.contact.phone, "0114 270 0000");
  // The source holds `\n` as an escape; a reader that does not unescape hands
  // the model a literal backslash and it comes back in the address.
  assert.ok(slot.contact.address.includes("\n"), "the address lost its line break on the way in");
  assert.doesNotMatch(slot.contact.address, /\\n/, "the address kept a literal backslash-n");
});

test("a value that is not a plain string is left out rather than guessed at", () => {
  assert.deepEqual(readContact('phone: SOME_CONST, email: "a@b.c"'), { email: "a@b.c" });
});

// ── changing it ───────────────────────────────────────────────────────────────

test("naming one field leaves the others exactly as they were", () => {
  // THE FAILURE THIS PREVENTS IS VICIOUS: "change the phone number" replacing
  // the whole object wipes the address and the opening hours, and the customer
  // finds out when somebody cannot find the shop.
  const out = applyContact(REF(), { phone: "0114 999 1234" });
  assert.equal(out.changed.length, 4, "not every page was updated: " + out.changed.join(", "));
  const after = contactSlots(out.pages)[0].contact;
  assert.equal(after.phone, "0114 999 1234");
  assert.equal(after.address, "14 Cutler Row\nSheffield S1 2AY");
  assert.equal(after.hours, "Tue–Fri 9–6, Sat 8.30–5");
  assert.equal(after.email, "hello@cutlerrow.co.uk");
});

test("an empty string takes one field away and keeps the rest", () => {
  const out = applyContact(REF(), { hours: "" });
  const after = contactSlots(out.pages)[0].contact;
  assert.equal(after.hours, undefined);
  assert.equal(after.phone, "0114 270 0000");
});

test("clearing every field removes the property rather than leaving an empty one", () => {
  const out = applyContact(REF(), Object.fromEntries(CONTACT_FIELDS.map((f) => [f, ""])));
  assert.equal(contactSlots(out.pages)[0].contact, null);
  // The source is stored and re-read on every later edit, so tidy is not
  // cosmetic — a stray `contact: {},` is a shape the next scan has to survive.
  assert.doesNotMatch(out.pages[0].source, /contact:\s*\{\s*\}/);
});

test("a site that never had a contact block gets one — the whole point", () => {
  // Every site published before the slots existed is this shape.
  const bare = REF().map((p) => ({ ...p, source: p.source.replace(/\n {2}contact: \{[\s\S]*?\n {2}\},/, "") }));
  assert.equal(contactSlots(bare)[0].contact, null, "the fixture still has a contact block");
  const out = applyContact(bare, { phone: "0113 200 0000" });
  assert.equal(out.changed.length, 4);
  assert.deepEqual(contactSlots(out.pages)[0].contact, { phone: "0113 200 0000" });
});

test("clearing a field on a site that has no contact block is a no-op, not a failure", () => {
  const bare = REF().map((p) => ({ ...p, source: p.source.replace(/\n {2}contact: \{[\s\S]*?\n {2}\},/, "") }));
  const out = applyContact(bare, { hours: "" });
  assert.deepEqual(out.changed, []);
});

test("naming no field changes nothing at all", () => {
  const before = REF();
  const out = applyContact(before, { social: "x" });
  assert.deepEqual(out.changed, []);
  assert.equal(out.pages[0].source, before[0].source);
});

test("what is written back parses as what was asked for", () => {
  // A round trip is the assertion that catches a serialiser that emits
  // something the reader cannot get back — the two are one contract.
  const change = { phone: "+44 20 7946 0000", address: "1 High St\nLeeds LS1 1AA", hours: "", email: "a@b.co" };
  const out = applyContact(REF(), change);
  const after = contactSlots(out.pages)[0].contact;
  assert.equal(after.phone, change.phone);
  assert.equal(after.address, change.address);
  assert.equal(after.email, change.email);
  assert.equal(after.hours, undefined);
});

// ── the comment-blind scanner ─────────────────────────────────────────────────

test("a comment with an apostrophe in it does not blind the bracket scanners", () => {
  // THE BUG, EXACTLY AS IT BIT. `// The footer's small print.` inside a CHROME
  // object opened a string `braceEnd` never closed, so the page yielded NO SLOT
  // AT ALL — no menu, no button, no contact, silently. It was found because a
  // comment written for this very feature triggered it.
  const src = [
    'const CHROME = {',
    '  name: "X",',
    "  // The footer's small print — an apostrophe used to end the scan here.",
    '  action: { label: "Book", href: "/book" },',
    '  links: [{ label: "Home", href: "/" }],',
    '};',
    'export function P() { return <SiteChrome {...CHROME} />; }',
  ].join("\n");
  const pages = [{ path: "index.tsx", source: src }];
  assert.equal(actionSlots(pages).length, 1, "the button is invisible behind an apostrophe");
  assert.equal(navSlots(pages).length, 1, "the menu is invisible behind an apostrophe");
  assert.equal(contactSlots(pages).length, 1, "the contact slot is invisible behind an apostrophe");
});

test("a block comment and a brace inside a comment are both survived", () => {
  const src = [
    'const CHROME = {',
    '  /* a } in a block comment used to close the object early */',
    '  name: "X",',
    '  // and a { here',
    '  action: { label: "Book", href: "/book" },',
    '};',
  ].join("\n");
  const slots = actionSlots([{ path: "index.tsx", source: src }]);
  assert.equal(slots.length, 1);
  assert.equal(slots[0].action.label, "Book");
});

test("a // inside a STRING is still a string, not a comment", () => {
  // The inverse mistake: treating a URL's slashes as a comment would swallow
  // the rest of the object.
  const slots = actionSlots([{ path: "i.tsx", source:
    'const CHROME = { action: { label: "Us", href: "https://example.com/x" }, name: "X" };' }]);
  assert.equal(slots.length, 1);
  assert.equal(slots[0].action.href, "https://example.com/x");
});

// ── the model's side ──────────────────────────────────────────────────────────

test("the digest states what the footer says today", () => {
  // Without it a one-field change cannot be expressed safely: the model cannot
  // tell "add an email" from "replace everything with an email".
  const d = navDigest(navSlots(REF()), ["/"], actionSlots(REF()), [], contactSlots(REF()));
  assert.match(d, /THE FOOTER'S CONTACT DETAILS/);
  assert.match(d, /0114 270 0000/);
  // A two-line address must not break the digest into something unreadable.
  assert.match(d, /14 Cutler Row \/ Sheffield S1 2AY/);
});

test("a site with no contact block is described as having none, not omitted", () => {
  const d = navDigest([], ["/"], [], [], [{ page: "index.tsx", contact: null }]);
  assert.match(d, /\(none/, "the digest says nothing at all about an empty footer");
});

test("the tool offers the four fields and forbids inventing one", () => {
  const c = NAV_TOOL.input_schema.properties.contact;
  assert.ok(c, "the nav tool no longer offers `contact`");
  assert.deepEqual(Object.keys(c.properties).sort(), [...CONTACT_FIELDS].sort());
  assert.match(c.description, /NEVER INVENT ONE/, "the tool no longer forbids inventing a phone number");
  assert.match(c.description, /EMPTY STRING/, "the removal verb is undocumented");
  assert.match(c.description, /NAME ONLY THE FIELDS THEY ASKED ABOUT/, "absent-means-unchanged is undocumented");
});

test("readNav keeps only string fields, trimmed and bounded", () => {
  const reply = { content: [{ type: "tool_use", input: { contact: {
    phone: "  0113 200 0000  ", email: 42, address: "x".repeat(500), nonsense: "y",
  } } }] };
  const read = readNav(reply, ["/"]);
  assert.equal(read.contact.phone, "0113 200 0000");
  assert.equal(read.contact.email, undefined, "a number was coerced into an address");
  assert.equal(read.contact.address.length, MAX_CONTACT_CHARS);
  assert.equal(read.contact.nonsense, undefined);
});

test("an empty or absent contact object reads as no contact change", () => {
  for (const input of [{}, { contact: null }, { contact: [] }, { contact: { phone: 7 } }]) {
    const read = readNav({ content: [{ type: "tool_use", input }] }, ["/"]);
    // A reply with NOTHING usable in it nulls the whole read, which is the
    // existing contract; what must not happen is a contact that reads as set.
    assert.equal(read && read.contact, null, JSON.stringify(input));
  }
});

test("the customer is told which fields moved, and never their values", () => {
  const msg = navReply({ changed: ["a.tsx", "b.tsx"], contact: { phone: "0113 200 0000", hours: "" } });
  assert.match(msg, /✅/);
  assert.match(msg, /phone/);
  assert.match(msg, /opening hours/, "`hours` is shown to the customer as a field name");
  assert.doesNotMatch(msg, /0113 200 0000/, "the reply prints the number back at them");
  assert.match(msg, /2 pages/);
});

// ── the wiring ────────────────────────────────────────────────────────────────

test("runNavEdit applies a contact-only answer, and says so", async () => {
  // THE WHOLE LANE, END TO END, with only the model faked — this is the layer
  // where twelve features in this repo have been correct and dead.
  const deps = { send: async () => ({
    content: [{ type: "tool_use", input: { contact: { phone: "0113 200 0000" } } }],
    usage: { input_tokens: 10, output_tokens: 5 },
  }) };
  const out = await runNavEdit(deps, { instruction: "put our number in the footer", pages: REF(), routes: ["/"] });
  assert.equal(out.ok, true, out.reason);
  assert.equal(out.changed.length, 4);
  assert.deepEqual(out.contact, { phone: "0113 200 0000" });
  assert.match(out.msg, /footer/);
  assert.equal(contactSlots(out.pages)[0].contact.phone, "0113 200 0000");
});

test("a contact answer that changes nothing is reported, not published", async () => {
  const deps = { send: async () => ({
    content: [{ type: "tool_use", input: { contact: { phone: "0114 270 0000" } } }],
    usage: null,
  }) };
  const out = await runNavEdit(deps, { instruction: "set the number", pages: REF(), routes: ["/"] });
  assert.equal(out.ok, false);
  assert.equal(out.reason, "no-change");
  assert.match(out.msg, /already/);
});

test("the Worker forwards which fields moved, and not the values", () => {
  const worker = fs.readFileSync(path.join(import.meta.dirname, "../worker.js"), "utf8");
  const nav = worker.slice(worker.indexOf('if (eLayer === "nav")'), worker.indexOf('if (eLayer === "picture")'));
  assert.ok(nav.length > 500, "the nav branch could not be sliced out");
  assert.match(nav, /contact:\s*nOut\.contact\s*\?\s*Object\.keys\(nOut\.contact\)/,
    "the nav branch does not forward `contact`, or forwards the customer's own values");
});

test("the ROUTER sends a footer ask to the nav lane", () => {
  // THE LAST LINK, and the one whose absence makes everything above unreachable.
  // The `nav` description said "THE TOP OF EVERY PAGE", so "put our number in
  // the footer" had no reason to arrive here at all — it would have gone to
  // `text` (which cannot add a field) or `page` (which edits ONE page, and a
  // footer that differs between pages is the inconsistency its own description
  // warns about).
  const layer = ASK_TOOL.input_schema.properties.layer.description;
  const nav = layer.slice(layer.indexOf('"nav"'), layer.indexOf('"page"'));
  assert.ok(nav.length > 200, "the nav clause could not be sliced out of the router description");
  assert.match(nav, /footer/i, "the router never mentions the footer under `nav`");
  assert.match(nav, /BOTTOM of every page/, "the router does not say the footer is site-wide");
  // And it must not swallow the timetable, which is rows in a table.
  assert.match(nav, /timetable/i, "the router does not send a day-by-day timetable to `data`");
});
