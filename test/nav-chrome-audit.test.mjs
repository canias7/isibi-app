// THE MENU AND FOOTER READERS, FOUR AUDIT FINDINGS (2026-10-23, r1-g3):
// A27-3 (a footer contact edit deleted fields it could not read), A27-4 (a
// comment inside a list hid it), A27-5 (footer `mailto:` links were refused),
// A27-6 (footer columns were read as menus). Each case runs the module's own
// readers and writers on a page source of the shape that broke.
import test from "node:test";
import assert from "node:assert/strict";
import {
  navSlots, applyContact, contactSlots, chromeListSlots, applyChromeList,
  readNav, readAdditions, applyAdditions,
} from "../builder/site-nav.mjs";

const page = (path, chrome, body = "<SiteChrome {...CHROME}><main /></SiteChrome>") => ({
  path,
  source: "import { createFileRoute } from '@tanstack/react-router'\n" +
    "const CHROME = " + chrome + "\n" +
    "export const Route = createFileRoute('/')({ component: P })\nfunction P() { return (" + body + ") }\n",
});

test("A27-3: a contact field the reader cannot read refuses the slot, so an edit to another field deletes nothing", () => {
  const chrome = "{ contact: { phone: PHONE, email: \"hello@cutlerrow.co.uk\", address: `14 Cutler Row\nSheffield`, hours: 'Tue–Fri 9–6' } }";
  const pages = [page("index.tsx", chrome)];
  const r = applyContact(pages, { email: "bookings@cutlerrow.co.uk" });
  const src = r.pages[0].source;
  for (const kept of ["phone: PHONE", "14 Cutler Row", "'Tue–Fri 9–6'"]) assert.ok(src.includes(kept), "deleted: " + kept + "\n" + src);
  // CONTROL: every field a plain string is still merged field by field.
  const plain = [page("index.tsx", "{ contact: { phone: \"0114 000\", email: \"hello@cutlerrow.co.uk\" } }")];
  const ok = applyContact(plain, { email: "bookings@cutlerrow.co.uk" });
  assert.deepEqual(ok.changed, ["index.tsx"]);
  assert.ok(ok.pages[0].source.includes("\"0114 000\"") && ok.pages[0].source.includes("bookings@cutlerrow.co.uk"));
  assert.deepEqual(contactSlots(plain)[0].contact, { phone: "0114 000", email: "hello@cutlerrow.co.uk" });
});

test("A27-4: a comment between menu items does not hide the menu", () => {
  const withComment = page("index.tsx", "{ links: [\n  { label: \"Menu\", href: \"/menu\" },\n  // Gallery comes back in the spring\n  { label: \"Visit\", href: \"/visit\" },\n] }");
  const slots = navSlots([withComment]);
  assert.equal(slots.length, 1, "the commented menu was skipped");
  assert.deepEqual(slots[0].items.map((i) => i.label), ["Menu", "Visit"]);
  // A comment INSIDE an item keeps the item readable too.
  const inner = page("index.tsx", "{ links: [{ label: \"Menu\", /* the food */ href: \"/menu\" }] }");
  assert.deepEqual(navSlots([inner])[0].items, [{ label: "Menu", href: "/menu" }]);
});

test("A27-4: a footer list with a comment is read, and an unreadable one is never doubled with a second key", () => {
  const commented = page("index.tsx", "{ social: [\n  { network: \"instagram\", href: \"https://instagram.com/x\" },\n  // TODO\n  { network: \"x\", href: \"https://x.com/x\" },\n] }");
  const slots = chromeListSlots([commented], "social");
  assert.equal(slots.length, 1);
  assert.deepEqual(slots[0].items.map((i) => i.network), ["instagram", "x"]);
  const r = applyChromeList([commented], "social", [{ network: "instagram", href: "https://instagram.com/x" }]);
  assert.equal((r.pages[0].source.match(/\bsocial:/g) || []).length, 1, r.pages[0].source);
  assert.ok(!r.pages[0].source.includes("x.com"), "the X link is still there");
  // A LIST THAT CANNOT BE READ (a spread) IS LEFT ALONE, NOT DOUBLED.
  const spread = page("index.tsx", "{ social: [...BASE, { network: \"x\", href: \"https://x.com/x\" }] }");
  assert.deepEqual(chromeListSlots([spread], "social"), []);
  const r2 = applyChromeList([spread], "social", [{ network: "instagram", href: "https://instagram.com/x" }]);
  assert.deepEqual(r2.changed, []);
  assert.equal((r2.pages[0].source.match(/\bsocial:/g) || []).length, 1);
  // CONTROL: a page with no list at all still gets one inserted.
  const none = page("index.tsx", "{ links: [{ label: \"Menu\", href: \"/menu\" }] }");
  assert.equal(chromeListSlots([none], "social").length, 1);
});

test("A27-5: a footer email link is kept when the list is restated, and can be added; a malformed one is refused", () => {
  const routes = ["/", "/menu"];
  const social = [
    { network: "facebook", href: "https://facebook.com/f" },
    { network: "instagram", href: "https://instagram.com/f" },
    { network: "email", href: "mailto:hello@f.co.uk" },
  ];
  const r = readNav({ content: [{ type: "tool_use", input: { social } }] }, routes);
  assert.deepEqual(r.lists.social.map((s) => s.network), ["facebook", "instagram", "email"], JSON.stringify(r.dropped));
  const add = readAdditions({ add: [{ to: "social", network: "email", href: "mailto:hello@f.co.uk" }] }, routes);
  assert.equal(add.adds.length, 1, JSON.stringify(add.dropped));
  for (const bad of ["mailto:", "mailto:a@b.co?bcc=c@d.co", "mailto:a@b.co,c@d.co", "mailto:nobody"]) {
    const d = readAdditions({ add: [{ to: "social", network: "email", href: bad }] }, routes);
    assert.equal(d.adds.length, 0, bad);
    assert.equal(d.dropped[0].why, "bad-address", bad);
  }
  // THE MENU IS UNCHANGED: a mailto there is still not a page.
  const m = readAdditions({ add: [{ to: "menu", label: "Email", href: "mailto:hello@f.co.uk" }] }, routes);
  assert.equal(m.adds.length, 0);
});

test("A27-6: a NavFooter column's links are not a menu, and a new menu item goes into the menu only", () => {
  const src = "{ links: [{ label: \"Menu\", href: \"/menu\" }, { label: \"Visit\", href: \"/visit\" }] }\n" +
    "const COLUMNS = [\n  { title: \"Visit\", links: [{ label: \"Opening hours\", href: \"/visit#hours\" }] },\n" +
    "  { title: \"Small print\", links: [{ label: \"Privacy\", href: \"/privacy\" }] },\n]";
  const pages = [page("index.tsx", src, "<SiteChrome {...CHROME}><NavFooter columns={COLUMNS} /><NavFooter columns={[{ title: \"x\", links: [{ label: \"Allergens\", href: \"/allergens\" }] }]} /></SiteChrome>")];
  const slots = navSlots(pages);
  assert.deepEqual(slots.map((s) => s.items.map((i) => i.label).join("|")), ["Menu|Visit"]);
  const out = applyAdditions(pages, [{ to: "menu", item: { label: "Gallery", href: "/gallery" } }]);
  const after = out.pages[0].source;
  assert.equal((after.match(/Gallery/g) || []).length, 1, after);
  assert.ok(/label: "Visit", href: "\/visit" \}, \{ label: "Gallery"/.test(after), after);
});
