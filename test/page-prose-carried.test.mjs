// WORDS AND LINKS CARRIED IN PROPS AND DATA (2026-10-22, audit finding 38,
// A21-1).
//
// The full page writer rewrites the whole page, and its text guard
// (`preservePageProse`) read only text between tags and a braced literal. A
// menu entry in `<SiteChrome links={[…]}>`, a section's cards in `items={[…]}`
// and a CTA's `title` and `action={{ label, href }}` were invisible, so the
// audit's rewrite — the hours changed as asked, the Order menu entry and the
// whole CTA band gone — answered `{ ok: true }` and was published "updated".
//
// Every page here is a fixture written for the case; every "writer's answer"
// is supplied. What these prove is the check: which losses are found, which a
// request grants, and what the refusal names.
import { test } from "node:test";
import assert from "node:assert/strict";
import { preservePageProse, proseWithheldMsg, PROSE_WITHHELD } from "../builder/page-prose.mjs";

const MENU = `[{ label: "Menu", href: "/menu" }, { label: "Order", href: "/order" }]`;
const page = ({ menu = MENU, hours = "Open 8 till 4.", band = `      <CtaBand title="Order ahead" action={{ label: "Order now", href: "/order" }} />\n`, breads = true, cls = "py-16" } = {}) => `import { SiteChrome } from "@/components/site-chrome";
import { CtaBand } from "@/components/ui/cta-band";
import { Cards } from "@/components/ui/cards";
import { useRows } from "@/lib/rows";
export default function Home() {
  const rows = useRows("loaves", { order: "created_at", dir: "desc" });
  return (
    <SiteChrome name="Fold Lane" links={${menu}}>
      <section id="hours" className="${cls}"><h2>Hours</h2><p>${hours}</p></section>
${breads ? `      <section id="breads"><h2>Breads</h2><Cards items={[{ title: "Rye", body: "Dense and dark." }, { title: "Seeded", body: "Toasted seeds." }]} /></section>\n` : ""}${band}    </SiteChrome>
  );
}
`;
const BEFORE = page();
const HOURS_ASK = "Change the text under ‘Hours’ to ‘Open 8 till 5.’";
const check = (after, message, before = BEFORE) => preservePageProse({ before, after, message, page: "/" });

test("THE AUDIT'S CASE: the hours changed, the Order menu entry and the CTA band gone — refused, each loss named", async () => {
  const after = page({ menu: `[{ label: "Menu", href: "/menu" }]`, hours: "Open 8 till 5.", band: "" });
  const r = await check(after, HOURS_ASK);
  assert.equal(r.ok, false);
  assert.equal(r.why, "unconfirmed-target");
  for (const lost of ["Order", "the link to /order (Order)", "Order ahead", "Order now", "the link to /order (Order now)"]) {
    assert.ok(r.blocked.includes(lost), lost + " in " + JSON.stringify(r.blocked));
  }
  // Nothing that stayed is named: the hours were asked for, the Menu entry kept.
  assert.ok(!r.blocked.some(x => /Open 8|Menu\b|the link to \/menu/.test(x)), JSON.stringify(r.blocked));
  const msg = proseWithheldMsg(r.blocked);
  assert.ok(msg.startsWith(PROSE_WITHHELD));
  assert.match(msg, /“Order ahead”/);
  assert.match(msg, /the link to \/order \(Order\)/);
});

test("ONE LOSS AT A TIME: only the menu entry, only the band, only a section's card data", async () => {
  const hours = "Open 8 till 5.";
  assert.equal((await check(page({ menu: `[{ label: "Menu", href: "/menu" }]`, hours }), HOURS_ASK)).ok, false, "menu entry");
  assert.equal((await check(page({ band: "", hours }), HOURS_ASK)).ok, false, "band");
  const noRye = page({ hours }).replace(`{ title: "Rye", body: "Dense and dark." }, `, "");
  const r = await check(noRye, HOURS_ASK);
  assert.equal(r.ok, false, "card data");
  assert.deepEqual(r.blocked, ["Rye", "Dense and dark."]);
  // A link's address moved, its words kept, is a loss too.
  const moved = page({ hours, menu: MENU.replace(`href: "/order"`, `href: "/shop"`) });
  assert.deepEqual((await check(moved, HOURS_ASK)).blocked, ["the link to /order (Order)"]);
});

test("CONTROLS: the narrow rewrite publishes; code strings (class names, table and column names) are not words", async () => {
  assert.deepEqual(await check(page({ hours: "Open 8 till 5." }), HOURS_ASK), { ok: true });
  const restyled = page({ hours: "Open 8 till 5.", cls: "py-24 bg-muted" }).replace(`useRows("loaves", { order: "created_at", dir: "desc" })`, `useRows("loaves", { order: "name", dir: "asc" })`);
  assert.deepEqual(await check(restyled, HOURS_ASK), { ok: true });
  // A reorder keeps everything.
  const reordered = page({ menu: `[{ label: "Order", href: "/order" }, { label: "Menu", href: "/menu" }]`, hours: "Open 8 till 5." });
  assert.deepEqual(await check(reordered, HOURS_ASK), { ok: true });
});

test("ASKED FOR: removing the Order link, rewording a button, removing a section with its cards — all still publish", async () => {
  const noOrder = page({ menu: `[{ label: "Menu", href: "/menu" }]` });
  assert.deepEqual(await check(noOrder, "Remove the ‘Order’ link."), { ok: true });
  assert.deepEqual(await check(noOrder, "Remove the ‘Order’ menu item."), { ok: true });
  const reworded = page({ band: `      <CtaBand title="Order ahead" action={{ label: "Order today", href: "/order" }} />\n` });
  assert.deepEqual(await check(reworded, "Change ‘Order now’ to ‘Order today’."), { ok: true });
  assert.deepEqual(await check(page({ breads: false }), "Remove the ‘Breads’ section."), { ok: true });
});

test("NOT ASKED FOR: the wrong link taken, an unquoted mention, a kept item", async () => {
  // Asked to remove the menu's Order link; the writer took the band's instead.
  const wrong = page({ band: `      <CtaBand title="Order ahead" />\n` });
  const r = await check(wrong, "Remove the ‘Order’ link.");
  assert.equal(r.ok, false);
  assert.ok(r.blocked.includes("Order now"), JSON.stringify(r.blocked));
  assert.ok(r.blocked.includes("the link to /order (Order now)"));
  // A removal clause beside a keep clause for the same words grants nothing.
  const noOrder = page({ menu: `[{ label: "Menu", href: "/menu" }]` });
  assert.equal((await check(noOrder, "Remove the ‘Order’ link but keep ‘Order’.")).ok, false);
  // Breads asked about by name for its heading only does not take its cards.
  assert.equal((await check(page({ breads: false }), "Change the ‘Breads’ heading to ‘Loaves’.")).ok, false);
});

test("LISTS AND CODE KEYS: a list of words is words; a code key's value in data is not", async () => {
  const withList = (list, variant) => page({ band: `      <CtaBand title="Order ahead" points={${list}} action={{ label: "Order now", href: "/order", variant: "${variant}" }} />\n` });
  const before = withList(`["Baked at dawn", "Stone ground"]`, "Outline Large");
  const r = await check(withList(`["Baked at dawn"]`, "Outline Large"), HOURS_ASK, before);
  assert.deepEqual(r.blocked, ["Stone ground"]);
  assert.deepEqual(await check(withList(`["Baked at dawn", "Stone ground"]`, "Solid Small"), HOURS_ASK, before), { ok: true });
});

test("THE REFUSAL'S WORDS: unchanged when there is nothing to name; long words cut", () => {
  assert.equal(proseWithheldMsg(undefined), PROSE_WITHHELD);
  assert.equal(proseWithheldMsg([]), PROSE_WITHHELD);
  assert.equal(proseWithheldMsg(["Order", "the link to /order"]), PROSE_WITHHELD + " It would also have changed or removed: “Order”, the link to /order.");
  assert.match(proseWithheldMsg(["x".repeat(200)]), /x{77}…”\.$/);
});
