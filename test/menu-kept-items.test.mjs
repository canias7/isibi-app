// ── A MENU EDIT KEEPS THE ITEMS IT WAS SHOWN (audit A27-1, 2026-10-22) ───────
//
// The menu editor is shown the site's menu and answers the whole list back.
// Every restated item used to be checked as if it were NEW, so an existing
// phone link (`tel:`), email link (`mailto:`), uploaded file (`/u/…`) or bare
// `#anchor` on a multi-page site failed that check, fell out of the answer,
// and was then deleted from every page as if the request had removed it.
//
// Now an address the editor was shown is kept as it was whatever its scheme;
// only a NEW address faces the new-item checks; an item the answer leaves out
// is still removed. The cases supply the editor's answer (the tool's shape).
import test from "node:test";
import assert from "node:assert/strict";
import { runNavEdit, navSlots, readNav } from "../builder/site-nav.mjs";

const ROUTES = ["/", "/gallery", "/visit"];
const ITEMS = [
  { label: "Gallery", href: "/gallery" },
  { label: "Visit", href: "/visit" },
  { label: "Call us", href: "tel:+441144960123" },
  { label: "Email", href: "mailto:hello@example.com" },
  { label: "Menu (PDF)", href: "/u/menu.pdf" },
  { label: "Prices", href: "#prices" },
];
const lit = (items) => "[" + items.map((it) => `{ label: ${JSON.stringify(it.label)}, href: ${JSON.stringify(it.href)} }`).join(", ") + "]";
const src = (items) => `import { SiteChrome } from "@/components/ui/site-chrome";

export default function P() {
  return (
    <SiteChrome name="Fold Lane" links={${lit(items)}}>
      <section id="prices"><h1>Bread</h1></section>
    </SiteChrome>
  );
}
`;
const pages = () => [
  { path: "index.tsx", source: src(ITEMS) },
  { path: "gallery.tsx", source: src(ITEMS) },
  { path: "visit.tsx", source: src(ITEMS) },
];
const answer = (links) => ({ content: [{ type: "tool_use", input: { links } }], usage: { input_tokens: 1, output_tokens: 1 } });
const menus = (out) => navSlots(out.pages).map((s) => s.items.map((it) => it.href));

test("a reorder keeps tel:, mailto:, an upload and a bare anchor on every page", async () => {
  const moved = [ITEMS[1], ITEMS[0], ...ITEMS.slice(2)];
  const out = await runNavEdit({ send: async () => answer(moved) }, { instruction: "Put Visit first in the menu", pages: pages(), routes: ROUTES });
  assert.equal(out.ok, true, out.msg);
  const all = menus(out);
  assert.equal(all.length, 3);
  for (const m of all) assert.deepEqual(m, moved.map((it) => it.href));
  assert.doesNotMatch(out.msg, /left out/i);
});

test("a rename keeps the anchor it renamed, in place", async () => {
  const renamed = ITEMS.map((it) => (it.href === "#prices" ? { label: "Our prices", href: "#prices" } : it));
  const out = await runNavEdit({ send: async () => answer(renamed) }, { instruction: "Rename Prices to Our prices", pages: pages(), routes: ROUTES });
  assert.equal(out.ok, true, out.msg);
  for (const s of navSlots(out.pages)) {
    assert.deepEqual(s.items.map((it) => it.href), ITEMS.map((it) => it.href));
    assert.equal(s.items.find((it) => it.href === "#prices").label, "Our prices");
  }
});

test("a requested removal of an existing phone link still removes it", async () => {
  const less = ITEMS.filter((it) => !it.href.startsWith("tel:"));
  const out = await runNavEdit({ send: async () => answer(less) }, { instruction: "Take Call us out of the menu", pages: pages(), routes: ROUTES });
  assert.equal(out.ok, true, out.msg);
  for (const m of menus(out)) assert.deepEqual(m, less.map((it) => it.href));
});

test("a NEW item still faces the new-item checks", async () => {
  const more = [...ITEMS, { label: "Ring", href: "tel:+440000000000" }, { label: "Nowhere", href: "/nope" }];
  const out = await runNavEdit({ send: async () => answer(more) }, { instruction: "Add a ring link", pages: pages(), routes: ROUTES });
  for (const m of menus(out)) assert.deepEqual(m, ITEMS.map((it) => it.href));
  // The reader on its own, with nothing shown, refuses the same shapes.
  const r = readNav(answer(ITEMS), ROUTES);
  assert.deepEqual(r.links.map((it) => it.href), ["/gallery", "/visit"]);
  // Shown, they are kept.
  const k = readNav(answer(ITEMS), ROUTES, ITEMS.map((it) => it.href));
  assert.deepEqual(k.links.map((it) => it.href), ITEMS.map((it) => it.href));
});
