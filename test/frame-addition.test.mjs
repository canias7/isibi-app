// ── A NEW ITEM IN THE FRAME, ADDED AND NOTHING ELSE (2026-10-02) ───────────
//
// Run 90's A1–A3 — a footer link, a menu link and a header button, each asked
// for as an addition — came back `edit` + `nav`, where the menu editor treats
// every answer as the frame's new state: "add a Call us button" replaced the
// button the site had. The add-on step now hands these to the menu editor as
// ADDITIONS (`frame`, `addition: true`), and the menu editor holds the answer
// to adding. These are the pure halves of that, driven directly; the route
// halves are in `test/edit-removal-door.test.mjs` ("FRAME ADDITION"), and the
// browser's hand-off and loop bound in `test/addon-failure.test.mjs`.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  additionOnly, firstButton, frameNow, withAdded, ADDITION_NOTE, ACTION_PROPS, readAdditions, applyAdditions, NAV_ADD_TOOL,
  actionSlots, applyAction, contactSlots, navSlots, navRequest, navDigest, readNav, runNavEdit, navReply, NAV_TOOL,
} from "../builder/site-nav.mjs";

const HOME = `import { SiteChrome } from "@/components/ui/site-chrome";
const CHROME = {
  name: "Harbour Loaf",
  links: [{ label: "Home", href: "/" }, { label: "Visit", href: "/visit" }],
  action: { label: "Order a loaf", href: "/order" },
  contact: { address: "Bristol", hours: "Wed–Sat 8–2" },
};
export default function P() { return <SiteChrome {...CHROME}><p>Bread.</p></SiteChrome>; }
`;
const VISIT = `import { SiteChrome } from "@/components/ui/site-chrome";
export default function P() { return <SiteChrome name="Harbour Loaf" links={[{ label: "Home", href: "/" }, { label: "Visit", href: "/visit" }, { label: "Gallery", href: "/gallery" }]} action={{ label: "Order a loaf", href: "/order" }}><p>Come by.</p></SiteChrome>; }
`;
const PAGES = [{ path: "index.tsx", source: HOME }, { path: "visit.tsx", source: VISIT }];
const ROUTES = ["/", "/visit", "/gallery", "/order", "/contact"];
const now = () => frameNow({ slots: navSlots(PAGES), actions: actionSlots(PAGES), seconds: actionSlots(PAGES, "secondAction"), contacts: [], lists: [] });
const read = (input) => readNav({ content: [{ type: "tool_use", name: NAV_TOOL.name, input }] }, ROUTES);
const reply = (input) => ({ content: [{ type: "tool_use", name: NAV_TOOL.name, input }], usage: { input_tokens: 10, output_tokens: 5 } });

test("the second button is the first button's shape, read and written by the same scan", () => {
  assert.deepEqual(ACTION_PROPS, ["action", "secondAction"]);
  assert.deepEqual(actionSlots(PAGES, "nonsense"), [], "a property that is not a button was scanned");
  assert.equal(actionSlots(PAGES, "secondAction").every((s) => s.action === null), true, "a second button was read where there is none");
  const out = applyAction(PAGES, { label: "Call us", href: "tel:01174960000" }, false, "secondAction");
  assert.deepEqual(out.changed.sort(), ["index.tsx", "visit.tsx"]);
  for (const p of out.pages) {
    assert.deepEqual(actionSlots([p], "secondAction")[0].action, { label: "Call us", href: "tel:01174960000" }, p.path);
    assert.deepEqual(actionSlots([p])[0].action, { label: "Order a loaf", href: "/order" }, p.path + ": the first button moved");
  }
  assert.ok(out.pages[0].source.includes(' secondAction: { label: "Call us", href: "tel:01174960000" },'), "the object form was not written");
  assert.ok(out.pages[1].source.includes(' secondAction={{ label: "Call us", href: "tel:01174960000" }}'), "the attribute form was not written");
  // AND TAKEN OFF BY ITS OWN FLAG, the first button untouched.
  const off = applyAction(out.pages, null, true, "secondAction");
  assert.equal(off.pages[0].source, HOME);
  assert.equal(off.pages[1].source, VISIT);
});

test("the request tells the menu editor about an addition only when it is one, and shows the second button's slot", () => {
  const base = { instruction: "Add a Call us button", slots: navSlots(PAGES), routes: ROUTES, actions: actionSlots(PAGES), seconds: actionSlots(PAGES, "secondAction") };
  const plain = navRequest(base).messages[0].content;
  const added = navRequest({ ...base, addition: true }).messages[0].content;
  assert.ok(!plain.includes(ADDITION_NOTE), "an ordinary edit was told it is an addition");
  assert.ok(added.includes(ADDITION_NOTE), "an addition was not told to keep what the frame has");
  assert.ok(added.indexOf(ADDITION_NOTE) < added.indexOf("WHAT THEY ASKED FOR"), "the note comes after the request");
  assert.equal(navRequest({ ...base, addition: "true" }).messages[0].content, plain, "a string reads as an addition");
  assert.match(navDigest(base.slots, ROUTES, base.actions, [], [], [], [], base.seconds), /A SECOND BUTTON BESIDE IT:\n  \(none\)/);
  // THE TOOL OFFERS BOTH, and says which is which.
  assert.ok(NAV_TOOL.input_schema.properties.secondAction && NAV_TOOL.input_schema.properties.removeSecondAction);
  assert.match(NAV_TOOL.input_schema.properties.action.description, /ASKED TO ADD A BUTTON WHEN THE HEADER ALREADY HAS ONE, LEAVE THIS OUT/);
});

test("withAdded places each new item after its anchor, at the start or at the end, and never moves or drops one", () => {
  const items = [{ label: "Home", href: "/" }, { label: "Visit", href: "/visit" }];
  assert.deepEqual(withAdded(items, [{ item: { label: "Order", href: "/order" }, after: "$end" }]).map((i) => i.href), ["/", "/visit", "/order"]);
  assert.deepEqual(withAdded(items, [{ item: { label: "Order", href: "/order" }, after: "/" }]).map((i) => i.href), ["/", "/order", "/visit"]);
  assert.deepEqual(withAdded(items, [{ item: { label: "Order", href: "/order" }, after: "$start" }]).map((i) => i.href), ["/order", "/", "/visit"]);
  // An anchor this list does not have puts it at the end, and a chain keeps order.
  assert.deepEqual(withAdded(items, [{ item: { label: "Order", href: "/order" }, after: "/gallery" }]).map((i) => i.href), ["/", "/visit", "/order"]);
  assert.deepEqual(withAdded(items, [{ item: { label: "A", href: "/a" }, after: "/" }, { item: { label: "B", href: "/b" }, after: "/a" }]).map((i) => i.href), ["/", "/a", "/b", "/visit"]);
  // An item the list already has is not added twice, and the input is not mutated.
  assert.deepEqual(withAdded(items, [{ item: { label: "Visit again", href: "/visit" }, after: "$end" }]), items);
  assert.equal(items.length, 2);
});

test("additionOnly: nothing taken, nothing repointed, the frame's arrangement left, a new button becomes the second", () => {
  const n = now();
  assert.equal(n.button, true);
  // NO LONGEST-MENU COUNT SINCE 2026-10-03: it was only the "room" a count of
  // ten left, and the count is gone (the footer correction).
  assert.equal(Object.hasOwn(n, "menuMax"), false, "the frame still measures room against a count");
  const held = additionOnly(read({
    links: [{ label: "Home", href: "/" }, { label: "Contact", href: "/contact" }],
    action: { label: "Call us", href: "tel:01174960000" },
    removeAction: true, layout: { brand: "centre" },
    linkChanges: [{ text: "Visit", href: "/order" }],
  }), n);
  assert.equal(held.removeAction, false);
  assert.equal(held.removeSecondAction, false);
  assert.equal(held.layout, null);
  assert.deepEqual(held.pageLinks, []);
  assert.equal(held.action, undefined, "the header's button was going to be replaced");
  assert.deepEqual(held.secondAction, { label: "Call us", href: "tel:01174960000" });
  assert.equal(held.links, null, "a whole menu is still going to be written");
  // A WHOLE MENU IN AN ADDITION IS NOT READ FOR NEW ITEMS (2026-10-04, run
  // 95's F1): the union of every page's menu decided what was new, and an
  // item two pages had was new to none. An addition names its items (`add`).
  assert.equal(Object.hasOwn(held, "addLinks"), false, "a whole menu was read for new items");
  assert.deepEqual(readAdditions({ add: [{ to: "menu", label: "Contact", href: "/contact", after: "/" }] }, ROUTES).adds,
    [{ to: "menu", item: { label: "Contact", href: "/contact" }, pages: null, after: "/" }]);
  // THE SAME BUTTON RESTATED IS NO CHANGE, and a third is refused by name.
  assert.equal(additionOnly(read({ action: { label: "Order a loaf", href: "/order" } }), n).action, undefined);
  const full = additionOnly(read({ action: { label: "Call us", href: "tel:01174960000" } }), { ...n, second: true, secondNow: { label: "Menu", href: "/menu" } });
  assert.equal(full.action, undefined);
  assert.equal(full.secondAction, undefined);
  assert.deepEqual(full.dropped.map((d) => d.why), ["kept"]);
  assert.match(navReply({ dropped: full.dropped }), /already has two buttons, and I don't replace one when asked to add/);
});

test("additionOnly never rewrites or clears a footer detail, and adds only a new one", () => {
  const n = { ...now(), contacts: [{ address: "Bristol", hours: "Wed–Sat 8–2" }] };
  const held = additionOnly(read({ contact: { address: "", hours: "Every day", phone: "0117 496 0000" } }), n);
  assert.deepEqual(held.contact, { phone: "0117 496 0000" });
  assert.equal(additionOnly(read({ contact: { address: "Leeds" } }), n).contact, null, "a detail the footer had was going to be rewritten");
});

// ── FOOTERS THAT DIFFER FROM PAGE TO PAGE (review, 2026-10-02) ─────────────
//
// `frameNow` read the first page's contact details as the frame's, so an
// addition could accept a phone number the first footer lacked and
// `applyContact` then wrote it over another page's own. Each page keeps what
// it shows; a detail is added only where it is missing.
const C_HOME = `import { SiteChrome } from "@/components/ui/site-chrome";
const CHROME = {
  name: "Harbour Loaf",
  links: [{ label: "Home", href: "/" }, { label: "Visit", href: "/visit" }],
  contact: { address: "Bristol", hours: "Wed–Sat 8–2" },
};
export default function P() { return <SiteChrome {...CHROME}><p>Bread.</p></SiteChrome>; }
`;
const C_VISIT = `import { SiteChrome } from "@/components/ui/site-chrome";
export default function P() { return <SiteChrome name="Harbour Loaf" links={[{ label: "Home", href: "/" }, { label: "Visit", href: "/visit" }]} contact={{ phone: "0117 000 1111", address: "Bristol" }}><p>Come by.</p></SiteChrome>; }
`;
const C_ORDER = `import { SiteChrome } from "@/components/ui/site-chrome";
export default function P() { return <SiteChrome name="Harbour Loaf" links={[{ label: "Home", href: "/" }, { label: "Visit", href: "/visit" }]}><p>Order.</p></SiteChrome>; }
`;
const C_PAGES = [{ path: "index.tsx", source: C_HOME }, { path: "visit.tsx", source: C_VISIT }, { path: "order.tsx", source: C_ORDER }];
const contactsOf = (pages) => pages.map((p) => contactSlots([p]).map((s) => s.contact));

test("frameNow reads every page's own contact details, not the first page's", () => {
  const n = frameNow({ slots: navSlots(C_PAGES), actions: actionSlots(C_PAGES), seconds: actionSlots(C_PAGES, "secondAction"), contacts: contactSlots(C_PAGES), lists: [] });
  assert.deepEqual(n.contacts, [{ address: "Bristol", hours: "Wed–Sat 8–2" }, { phone: "0117 000 1111", address: "Bristol" }, null]);
  // A DETAIL IS NEW WHILE SOME PAGE LACKS IT, and one every page shows is not.
  assert.deepEqual(additionOnly(read({ contact: { phone: "0117 496 0000" } }), n).contact, { phone: "0117 496 0000" });
  assert.equal(additionOnly(read({ contact: { address: "Leeds" } }), { ...n, contacts: n.contacts.slice(0, 2) }).contact, null, "an address every footer shows was going to be rewritten");
});

test("runNavEdit: an added phone number fills only the footers that have none, and each page keeps its own", async () => {
  const answer = { contact: { phone: "0117 496 0000", email: "hello@harbourloaf.co.uk" } };
  const added = await runNavEdit({ send: async () => reply(answer) }, { instruction: "Add our phone number and email to the footer", pages: C_PAGES, routes: ROUTES, addition: true });
  assert.equal(added.ok, true, JSON.stringify(added));
  assert.deepEqual(contactsOf(added.pages), [
    [{ phone: "0117 496 0000", email: "hello@harbourloaf.co.uk", address: "Bristol", hours: "Wed–Sat 8–2" }],
    [{ phone: "0117 000 1111", email: "hello@harbourloaf.co.uk", address: "Bristol" }],
    [{ phone: "0117 496 0000", email: "hello@harbourloaf.co.uk" }],
  ], "a page's own phone number was overwritten, or a footer without one was not given it");
  assert.deepEqual(added.changed.sort(), ["index.tsx", "order.tsx", "visit.tsx"]);
  // ONLY THE PHONE, WHICH THE VISIT PAGE ALREADY SHOWS: the other two change, it does not.
  const phone = await runNavEdit({ send: async () => reply({ contact: { phone: "0117 496 0000" } }) }, { instruction: "Add our phone number to the footer", pages: C_PAGES, routes: ROUTES, addition: true });
  assert.equal(phone.ok, true, JSON.stringify(phone));
  assert.deepEqual(phone.changed.sort(), ["index.tsx", "order.tsx"]);
  assert.equal(phone.pages.find((p) => p.path === "visit.tsx").source, C_VISIT, "the visit page's footer was rewritten");
  // THE CONTROL: the same answer as an ordinary edit writes the number on every page, as it always did.
  const edited = await runNavEdit({ send: async () => reply({ contact: { phone: "0117 496 0000" } }) }, { instruction: "Change the phone number to 0117 496 0000", pages: C_PAGES, routes: ROUTES });
  assert.deepEqual(contactsOf(edited.pages).map((c) => c[0].phone), ["0117 496 0000", "0117 496 0000", "0117 496 0000"]);
});

// ⚠ THIS PINNED A "ROOM" until 2026-10-03: an addition to a menu of nine could
// add one item and named the rest as past a count of ten (the owner, on the
// mixed-work fixes' review: not a technical constraint). Every new item is
// added now, and an item the frame already has is still never touched.
test("an addition adds every new item, whatever the menu's length, and never touches an existing one", () => {
  // EIGHT NEW ITEMS TO A FRAME WHOSE LONGEST MENU HAS THREE: the old room was
  // seven, so the eighth was named as past the count. All eight go in now.
  const eight = ["Bread", "Pastry", "Cakes", "Coffee", "Hampers", "Classes", "Wholesale", "Jobs"].map((label) => ({ label, href: "/#" + label.toLowerCase() }));
  const { adds, dropped } = readAdditions({ add: eight.map((l) => ({ to: "menu", ...l })) }, ROUTES);
  assert.deepEqual(dropped, [], "an addable item was named as left out");
  const out = applyAdditions(PAGES, adds);
  for (const p of out.pages) {
    const was = navSlots([PAGES.find((q) => q.path === p.path)])[0].items.map((i) => i.href);
    assert.deepEqual(navSlots([p])[0].items.map((i) => i.href), [...was, ...eight.map((l) => l.href)], p.path + ": a new item past the old room was left out, or an existing one moved");
  }
});

test("firstButton: a second button on a header with none is its first", () => {
  const r = { action: undefined, secondAction: { label: "Call us", href: "tel:1" }, dropped: [] };
  assert.deepEqual(firstButton(r, false).action, { label: "Call us", href: "tel:1" });
  assert.equal(firstButton(r, false).secondAction, undefined);
  assert.equal(firstButton(r, true), r, "a header with a button lost its second");
});

test("runNavEdit: an addition adds to each page's own menu; an edit's whole menu is the menu it is given", async () => {
  const answer = { links: [{ label: "Contact", href: "/contact" }] };
  const added = await runNavEdit({ send: async () => reply({ add: [{ to: "menu", label: "Contact", href: "/contact" }] }) }, { instruction: "Add Contact to the menu", pages: PAGES, routes: ROUTES, addition: true });
  assert.equal(added.ok, true, JSON.stringify(added));
  const menus = added.pages.map((p) => navSlots([p])[0].items.map((i) => i.href));
  assert.deepEqual(menus, [["/", "/visit", "/contact"], ["/", "/visit", "/gallery", "/contact"]], "a page's own menu was not kept");
  assert.match(added.msg, /Added “Contact” to the menu on 2 pages, beside the items each had/);
  // A WHOLE MENU IN AN ADDITION'S ANSWER IS NOT READ: nothing is added from it.
  const restated = await runNavEdit({ send: async () => reply(answer) }, { instruction: "Add Contact to the menu", pages: PAGES, routes: ROUTES, addition: true });
  assert.equal(restated.ok, false, "a whole menu was read as an addition");
  const edited = await runNavEdit({ send: async () => reply(answer) }, { instruction: "the menu should be Contact", pages: PAGES, routes: ROUTES });
  assert.deepEqual(edited.pages.map((p) => navSlots([p])[0].items.map((i) => i.href)), [["/contact"], ["/contact"]]);
});

test("taking a button off the shared object takes its line and comma, so the object still parses (the first button too)", () => {
  // FOUND BY THE SECOND BUTTON: the removal ended at the property's closing
  // brace and left `,\n ,` — an object literal that does not parse, so "drop
  // the button" on a site written this way could only fail to compile.
  const off = applyAction(PAGES, null, true);
  assert.equal(off.pages[0].source, HOME.replace('  action: { label: "Order a loaf", href: "/order" },\n', ""), "the object form left more than nothing behind");
  assert.equal(off.pages[1].source, VISIT.replace(' action={{ label: "Order a loaf", href: "/order" }}', ""), "the attribute form changed");
  assert.doesNotMatch(off.pages[0].source, /,\s*,/, "a dangling comma was left");
  // A button inserted on the brace's own line comes off to exactly what was there.
  const on = applyAction(PAGES, { label: "Call us", href: "tel:1" }, false, "secondAction");
  assert.deepEqual(applyAction(on.pages, null, true, "secondAction").pages.map((p) => p.source), [HOME, VISIT]);
});
