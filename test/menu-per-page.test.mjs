// ── EACH PAGE'S OWN MENU, CHANGED — NOT ONE MENU WRITTEN EVERYWHERE ─────────
//
// The whole-router audit's W4 (2026-10-02). The menu editor is shown ONE menu,
// the union of every page's, and answers one whole list. That list was written
// into every page as it stood, so on a site whose pages carry different menus
// any menu edit flattened them: a status page listing two items came out with
// all five, a page's own spelling ("Visit" where the home page says "Visit
// us") was overwritten, a page's own order was replaced, and every menu was
// rewritten onto one line even where nothing in it changed.
//
// The answer is now read as the CHANGES it makes to the list the editor was
// shown (`menuChange`, by address) and only those are made to each page's own
// items (`menuApply`). A menu the change leaves as it was is left as written.
// Nothing here reads the customer's words: the cases supply the menu editor's
// answer — the shape its tool asks for, the whole menu with one change made —
// and judge the route by what it stored, compiled, charged and said.
//
// THE SITE: four pages with a menu, each different, and one without.
//   index.tsx   Home · Menu · Visit us · Order       (a shared object, one item a line)
//   menu.tsx    Menu · Visit · Order                  (an attribute, no Home, its own "Visit")
//   visit.tsx   Home · Visit us · Menu · Order        (its own order, one item a line)
//   status.tsx  Home · Status                         (two items, one only it has)
//   order.tsx, takeaway.tsx                           (no menu at all)
// The editor is shown Home · Menu · Visit us · Order · Status.
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { installCompiler, dispatchEnv, isDispatchUpload, dispatchOk } from "./fixtures/cf-containers.mjs";
import { CONFIG_KEY } from "../site-config.mjs";
import { packEditJob, EDIT_JOB_PREFIX, EDIT_JOB_KIND } from "../builder/edit-job.mjs";
import { navSlots, navDigest, menuUnion, menuChange, menuApply, applyNav, navReply, readNav, runNavEdit, NAV_TOOL } from "../builder/site-nav.mjs";
import { editBrowserReply } from "../scripts/addon-sweep.mjs";

const SLUG = "kiln-street-cafe";
const USER = { id: "u-menu-1", email: "owner@example.com" };
const ROUTED = { cost: 2 };

const INDEX = `import { SiteChrome } from "@/components/ui/site-chrome";

const CHROME = {
  name: "Kiln Street Cafe",
  links: [
    { label: "Home", href: "/" },
    { label: "Menu", href: "/menu" },
    { label: "Visit us", href: "/visit" },
    { label: "Order", href: "/order" },
  ],
  action: { label: "Book a table", href: "/visit" },
};

export default function Home() {
  return (
    <SiteChrome {...CHROME}>
      <section className="px-6 py-20">
        <h1>Coffee and cake on Kiln Street</h1>
        <p>Open from seven, every day but Monday.</p>
      </section>
    </SiteChrome>
  );
}
`;
const MENU = `import { SiteChrome } from "@/components/ui/site-chrome";

export default function MenuPage() {
  return (
    <SiteChrome name="Kiln Street Cafe" links={[{ label: "Menu", href: "/menu" }, { label: "Visit", href: "/visit" }, { label: "Order", href: "/order" }]} action={{ label: "Book a table", href: "/visit" }}>
      <section className="px-6 py-20">
        <h1>Today's menu</h1>
        <p>Flat white £3.20. Cardamom bun £2.80.</p>
      </section>
    </SiteChrome>
  );
}
`;
const VISIT = `import { SiteChrome } from "@/components/ui/site-chrome";

export default function Visit() {
  return (
    <SiteChrome
      name="Kiln Street Cafe"
      links={[
        { label: "Home", href: "/" },
        { label: "Visit us", href: "/visit" },
        { label: "Menu", href: "/menu" },
        { label: "Order", href: "/order" },
      ]}
      action={{ label: "Book a table", href: "/visit" }}
    >
      <section className="px-6 py-20">
        <h1>Find us</h1>
        <p>14 Kiln Street, by the canal bridge.</p>
      </section>
    </SiteChrome>
  );
}
`;
const STATUS = `import { SiteChrome } from "@/components/ui/site-chrome";

export default function Status() {
  return (
    <SiteChrome name="Kiln Street Cafe" links={[{ label: "Home", href: "/" }, { label: "Status", href: "/status" }]}>
      <p>The oven is on.</p>
    </SiteChrome>
  );
}
`;
const ORDER = `export default function Order() {
  return <main className="p-6"><h1>Order</h1><p>Collection from nine.</p></main>;
}
`;
const TAKEAWAY = `export default function Takeaway() {
  return <main className="p-6"><h1>Takeaway</h1><p>Ring ahead and we will have it ready.</p></main>;
}
`;
const PAGES = [
  { path: "index.tsx", source: INDEX },
  { path: "menu.tsx", source: MENU },
  { path: "visit.tsx", source: VISIT },
  { path: "status.tsx", source: STATUS },
  { path: "order.tsx", source: ORDER },
  { path: "takeaway.tsx", source: TAKEAWAY },
];
const ORIG = Object.fromEntries(PAGES.map((p) => [p.path, p.source]));
const ROUTES = ["/", "/menu", "/visit", "/status", "/order", "/takeaway"];
const L = (label, href) => ({ label, href });
const HOME = L("Home", "/"), MEN = L("Menu", "/menu"), VIS = L("Visit us", "/visit"), ORD = L("Order", "/order"), STA = L("Status", "/status");
const SHOWN = [HOME, MEN, VIS, ORD, STA];

/** Each page's menus, read by the rung's own reader. */
const menuOf = (src) => navSlots([{ path: "x.tsx", source: src }]).map((s) => s.items);
/** The page with every menu array's interior blanked: what must not move at all. */
function outsideMenus(src) {
  let out = src;
  for (const s of navSlots([{ path: "x.tsx", source: src }]).sort((a, b) => b.at - a.at)) out = out.slice(0, s.at) + "<menu>" + out.slice(s.to);
  return out;
}

// ── THE OBSERVERS ARE ALIVE ───────────────────────────────────────────────────

test("the control: each page's menu is read as it is written, and the editor is shown the union once", () => {
  assert.deepEqual(menuOf(INDEX), [[HOME, MEN, VIS, ORD]]);
  assert.deepEqual(menuOf(MENU), [[MEN, L("Visit", "/visit"), ORD]]);
  assert.deepEqual(menuOf(VISIT), [[HOME, VIS, MEN, ORD]]);
  assert.deepEqual(menuOf(STATUS), [[HOME, STA]]);
  assert.deepEqual(menuOf(ORDER), []);
  assert.deepEqual(menuOf(TAKEAWAY), []);
  const digest = navDigest(navSlots(PAGES), ROUTES, [], [], [], [], [], []);
  assert.ok(digest.includes("THE MENU AS IT IS NOW:\n  Home -> /\n  Menu -> /menu\n  Visit us -> /visit\n  Order -> /order\n  Status -> /status\n"), "the editor is not shown the union: " + digest);
  for (const p of PAGES) if (menuOf(p.source).length) assert.notEqual(outsideMenus(p.source), p.source, p.path + ": the menu blanker found nothing");
});

// ── THE COMPARISON, ON ITS OWN ────────────────────────────────────────────────

test("menuUnion: each address once, where a visitor first meets it, with the first words seen", () => {
  assert.deepEqual(menuUnion(navSlots(PAGES)), SHOWN);
  const slots = [{ items: [HOME, L("Visit us", "/visit")] }, { items: [L("Visit", "/visit"), STA, { label: "No address" }] }, null, { items: null }];
  assert.deepEqual(menuUnion(slots), [HOME, L("Visit us", "/visit"), STA]);
  assert.deepEqual(menuUnion(null), []);
});

test("menuChange: a removal, a rename, a repoint, a replacement, a move and an addition are each read as themselves", () => {
  const only = (c) => ({ removed: [...c.removed], swap: [...c.swap].map(([k, v]) => [k, v.item.href, v.keepWords]), renamed: [...c.renamed].map(([k, v]) => [k, v.from, v.to]), moved: c.moved, added: c.added.map((a) => a.href) });
  const none = { removed: [], swap: [], renamed: [], moved: [], added: [] };
  assert.deepEqual(only(menuChange(SHOWN, SHOWN)), none, "restating the menu is a change");
  assert.deepEqual(only(menuChange(SHOWN, [HOME, MEN, VIS, STA])), { ...none, removed: ["/order"] });
  assert.deepEqual(only(menuChange(SHOWN, [HOME, MEN, L("Find us", "/visit"), ORD, STA])), { ...none, renamed: [["/visit", "Visit us", "Find us"]] });
  // THE SAME WORDS AT A NEW ADDRESS ARE A REPOINT, wherever they stand.
  assert.deepEqual(only(menuChange(SHOWN, [HOME, MEN, VIS, L("Order", "/takeaway"), STA])), { ...none, swap: [["/order", "/takeaway", true]] });
  assert.deepEqual(only(menuChange(SHOWN, [L("Order", "/takeaway"), HOME, MEN, VIS, STA])), { ...none, swap: [["/order", "/takeaway", true]] });
  // NEW WORDS AT A NEW ADDRESS, BETWEEN THE SAME KEPT NEIGHBOURS, ARE A REPLACEMENT.
  assert.deepEqual(only(menuChange(SHOWN, [HOME, MEN, VIS, L("Takeaway", "/takeaway"), STA])), { ...none, swap: [["/order", "/takeaway", false]] });
  // …AND ANYWHERE ELSE THEY ARE AN ADDITION BESIDE A REMOVAL.
  assert.deepEqual(only(menuChange(SHOWN, [L("Takeaway", "/takeaway"), HOME, MEN, VIS, STA])), { ...none, removed: ["/order"], added: ["/takeaway"] });
  // THE FEWEST ITEMS THAT EXPLAIN THE NEW ORDER ARE THE ONES MOVED.
  assert.deepEqual(only(menuChange(SHOWN, [ORD, HOME, MEN, VIS, STA])), { ...none, moved: ["/order"] });
  assert.deepEqual(only(menuChange(SHOWN, [HOME, MEN, ORD, STA, VIS])), { ...none, moved: ["/visit"] });
  // A TIE KEEPS THE EARLIER RUN: two items swapped, the one now second moved.
  assert.deepEqual(only(menuChange([HOME, MEN], [MEN, HOME])), { ...none, moved: ["/"] });
  assert.deepEqual(only(menuChange(SHOWN, [HOME, MEN, L("Takeaway", "/takeaway"), VIS, ORD, STA])), { ...none, added: ["/takeaway"] });
  // AN ADDRESS ANSWERED TWICE IS READ ONCE, the first time; an item with no address is not one.
  const twice = menuChange(SHOWN, [HOME, MEN, VIS, ORD, STA, L("Menu again", "/menu"), { label: "Nowhere" }]);
  assert.deepEqual(only(twice), none);
  assert.deepEqual(twice.order.map((it) => it.href), SHOWN.map((it) => it.href));
});

test("menuApply: only the change is made to a page's own items — its other items, words and order stay", () => {
  const visit = [HOME, VIS, MEN, ORD];
  const menuPage = [MEN, L("Visit", "/visit"), ORD];
  const status = [HOME, STA];
  const apply = (items, answer) => menuApply(items, menuChange(SHOWN, answer));
  // A REMOVAL TAKES THE ITEM OFF WHERE IT IS, and nowhere else changes.
  assert.deepEqual(apply(visit, [HOME, MEN, VIS, STA]), [HOME, VIS, MEN]);
  assert.deepEqual(apply(menuPage, [HOME, MEN, VIS, STA]), [MEN, L("Visit", "/visit")]);
  assert.deepEqual(apply(status, [HOME, MEN, VIS, STA]), status);
  // A RENAME REACHES THE ITEM ON EVERY PAGE THAT LISTS IT, whatever that page called it.
  assert.deepEqual(apply(menuPage, [HOME, MEN, L("Find us", "/visit"), ORD, STA]), [MEN, L("Find us", "/visit"), ORD]);
  assert.deepEqual(apply(status, [HOME, MEN, L("Find us", "/visit"), ORD, STA]), status);
  // A REPOINT KEEPS EACH PAGE'S WORDS; A REPLACEMENT TAKES THE NEW ONES; NEITHER REACHES A PAGE WITHOUT THE ITEM.
  assert.deepEqual(apply([L("Visit", "/visit")], [HOME, MEN, L("Visit us", "/takeaway"), ORD, STA]), [L("Visit", "/takeaway")]);
  assert.deepEqual(apply(menuPage, [HOME, MEN, VIS, L("Takeaway", "/takeaway"), STA]), [MEN, L("Visit", "/visit"), L("Takeaway", "/takeaway")]);
  assert.deepEqual(apply(status, [HOME, MEN, VIS, L("Takeaway", "/takeaway"), STA]), status);
  // A MOVE PUTS THE ITEM AFTER THE NEAREST ITEM THE ANSWER PUT BEFORE IT THAT THIS MENU HAS, else before the next.
  assert.deepEqual(apply(visit, [ORD, HOME, MEN, VIS, STA]), [ORD, HOME, VIS, MEN], "the page's own order of Visit us and Menu was not kept");
  assert.deepEqual(apply(menuPage, [HOME, MEN, ORD, STA, VIS]), [MEN, ORD, L("Visit", "/visit")]);
  assert.deepEqual(apply(status, [ORD, HOME, MEN, VIS, STA]), status);
  // AN ADDITION GOES INTO EVERY MENU, after its anchor where the menu has it.
  assert.deepEqual(apply(visit, [HOME, MEN, L("Takeaway", "/takeaway"), VIS, ORD, STA]), [HOME, VIS, MEN, L("Takeaway", "/takeaway"), ORD]);
  assert.deepEqual(apply(status, [HOME, MEN, L("Takeaway", "/takeaway"), VIS, ORD, STA]), [HOME, L("Takeaway", "/takeaway"), STA]);
  assert.deepEqual(apply([], [L("Takeaway", "/takeaway")].concat(SHOWN)), [L("Takeaway", "/takeaway")]);
  // NO CHANGE IS A COPY, and the page's own list is never mutated.
  const before = JSON.stringify(visit);
  assert.deepEqual(menuApply(visit, null), visit);
  assert.notEqual(menuApply(visit, null)[0], visit[0]);
  apply(visit, [ORD, HOME, MEN, VIS, STA]);
  assert.equal(JSON.stringify(visit), before);
});

test("applyNav: a menu the change leaves as it was is left as written, to the byte", () => {
  const out = applyNav(PAGES, (items) => items);
  assert.deepEqual(out.changed, [], "an unchanged menu was rewritten");
  for (const p of out.pages) assert.equal(p.source, ORIG[p.path], p.path);
  // THE LIST FORM, written everywhere, still reformats only the menus it changes.
  const all = applyNav(PAGES, [HOME, MEN, VIS, ORD]);
  assert.equal(all.pages.find((p) => p.path === "index.tsx").source, INDEX, "the home page's menu already was that list");
  assert.deepEqual(all.changed, ["menu.tsx", "visit.tsx", "status.tsx"]);
});

test("navReply: the menus as they now read — one sentence when every changed page reads the same, each named when they differ", () => {
  assert.equal(navReply({ links: [HOME], changed: ["a.tsx", "b.tsx"], menus: { pages: 2, lists: [{ items: [HOME, MEN], pages: 2 }] } }),
    "✅ Updated the menu on 2 pages: Home · Menu.");
  assert.equal(navReply({ links: [HOME], changed: ["a.tsx", "b.tsx", "c.tsx"], menus: { pages: 2, lists: [{ items: [HOME, MEN], pages: 1 }, { items: [MEN], pages: 1 }] } }),
    "✅ Updated the menu on 2 pages, each keeping its own items — Home · Menu (1 page); Menu (1 page).", "the count is not the pages whose menu changed");
  // WITHOUT THE MENUS, THE ANSWER'S OWN LIST, as before.
  assert.equal(navReply({ links: [HOME, MEN], changed: ["a.tsx"] }), "✅ Updated the menu on 1 page: Home · Menu.");
});

test("runNavEdit: a button changed beside a menu answer that changed no menu is not reported as a menu change", async () => {
  const send = async () => ({ content: [{ type: "tool_use", name: NAV_TOOL.name, input: { links: SHOWN, action: { label: "Reserve", href: "/visit" } } }], usage: { input_tokens: 10, output_tokens: 5 } });
  const r = await runNavEdit({ send }, { instruction: "x", pages: PAGES, routes: ROUTES });
  assert.equal(r.ok, true);
  assert.equal(r.links, null, "the reply carries a menu that did not change");
  assert.doesNotMatch(r.msg, /Updated the menu/);
  assert.match(r.msg, /The button now says “Reserve”/);
  for (const p of r.pages) assert.deepEqual(menuOf(p.source), menuOf(ORIG[p.path]), p.path + ": a menu moved");
});

// ── SEVERAL ITEMS MOVED AT ONCE (owner's review of batch 1, 2026-10-02) ───────
//
// "through runNavEdit, start with Home, Menu, Visit, Order, Status and supply
// the correct model answer Order, Status, Home, Menu, Visit — the current code
// returns no-change … nine of the 120 permutations of five items failed my
// comparison." Reproduced on d4e3f1c7: the same nine, that one included. Each
// moved item was put back while the later moved items still stood where they
// were, so "before the nearest item after it" found one of those and the move
// carried it back. Every moved item now comes out first and goes back in the
// answer's order.
const perms = (a) => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
const hrefs = (l) => l.map((it) => it.href);
/** A one-page site whose one menu is `items`, written the way the editor rewrites it. */
const onePage = (items) => ({ path: "index.tsx", source: "import { SiteChrome } from \"@/components/ui/site-chrome\";\nexport default function P() {\n  return (\n"
  + "    <SiteChrome name=\"Kiln Street Cafe\" links={[" + items.map((it) => "{ label: \"" + it.label + "\", href: \"" + it.href + "\" }").join(", ") + "]}>\n      <h1>Hi</h1>\n    </SiteChrome>\n  );\n}\n" });
const editorSays = (links) => ({ send: async () => ({ content: [{ type: "tool_use", name: NAV_TOOL.name, input: { links } }], usage: { input_tokens: 10, output_tokens: 5 } }) });

test("the owner's case through runNavEdit: Home, Menu, Visit us, Order, Status answered Order, Status, Home, Menu, Visit us becomes that menu — not 'nothing to change'", async () => {
  const r = await runNavEdit(editorSays([ORD, STA, HOME, MEN, VIS]), { instruction: "Put Order and Status first in the menu.", pages: [onePage(SHOWN)], routes: ROUTES });
  assert.equal(r.ok, true, JSON.stringify({ reason: r.reason, msg: r.msg }));
  assert.deepEqual(menuOf(r.pages[0].source), [[ORD, STA, HOME, MEN, VIS]]);
  assert.deepEqual(r.changed, ["index.tsx"]);
  assert.equal(r.msg, "✅ Updated the menu on 1 page: Order · Status · Home · Menu · Visit us.");
});

test("every one of the 120 orders of a five-item menu, answered by the editor, is the order that page ends up with (through runNavEdit)", async () => {
  let changed = 0, restated = 0;
  for (const answer of perms(SHOWN)) {
    const r = await runNavEdit(editorSays(answer), { instruction: "Reorder the menu.", pages: [onePage(SHOWN)], routes: ROUTES });
    const label = hrefs(answer).join(" ");
    if (label === hrefs(SHOWN).join(" ")) {
      assert.equal(r.reason, "no-change", label + ": restating the menu changed it");
      restated++;
      continue;
    }
    assert.equal(r.ok, true, label + ": " + r.msg);
    assert.deepEqual(menuOf(r.pages[0].source), [answer], label);
    changed++;
  }
  assert.deepEqual([changed, restated], [119, 1], "not every order was tried");
});

test("menuApply never lists an address twice: an item the answer adds that this page already lists is not added again", () => {
  // UNREACHABLE THROUGH `runNavEdit`, and said so: there the change is read
  // against the union of the very menus it is applied to, so an added address
  // is on no page. `menuApply` is a function of whatever change it is handed,
  // though, and one read against a menu that lacked an item this page lists
  // must not give the page that item twice.
  const shown = [{ href: "/", label: "Home" }, { href: "/menu", label: "Menu" }];
  const change = menuChange(shown, [...shown, { href: "/order", label: "Order" }]);
  assert.deepEqual(change.added.map((it) => it.href), ["/order"], "the fixture's answer adds nothing");
  assert.deepEqual(change.moved, [], "the fixture's answer moves something");
  const page = [{ href: "/", label: "Home" }, { href: "/order", label: "Order now" }, { href: "/menu", label: "Menu" }];
  assert.deepEqual(menuApply(page, change), page, "the page lists an address twice, or lost its own words for it");
  // CONTROL: a page without it gains it, after the item the answer put before it.
  assert.deepEqual(menuApply(shown, change), [...shown, { href: "/order", label: "Order" }]);
});

test("every one of the 120 orders over four menus that differ: no page gains or loses an item or its words; what the answer did not move keeps the page's order; a menu in the order shown ends in the answer's; a moved item follows the nearest item the answer put before it", () => {
  const pages = { "index.tsx": [HOME, MEN, VIS, ORD], "menu.tsx": [MEN, L("Visit", "/visit"), ORD], "visit.tsx": [HOME, VIS, MEN, ORD], "status.tsx": [HOME, STA] };
  const isSub = (sub, of) => { let k = 0; for (const x of of) if (x === sub[k]) k++; return k === sub.length; };
  let inOrder = 0, moves = 0, anchored = 0;
  for (const answer of perms(SHOWN)) {
    const c = menuChange(SHOWN, answer);
    const order = hrefs(answer);
    for (const [path, items] of Object.entries(pages)) {
      const got = menuApply(items, c);
      const label = path + " for " + order.join(" ");
      assert.deepEqual([...hrefs(got)].sort(), [...hrefs(items)].sort(), label + ": an item came or went");
      for (const g of got) assert.equal(g.label, items.find((i) => i.href === g.href).label, label + ": the page's own words changed");
      assert.ok(isSub(hrefs(items).filter((h) => !c.moved.includes(h)), hrefs(got)), label + ": an item the answer did not move changed place");
      if (isSub(hrefs(items), hrefs(SHOWN))) {
        inOrder++;
        assert.deepEqual(hrefs(got), order.filter((h) => hrefs(items).includes(h)), label + ": not the answer's order");
      }
      for (const m of c.moved.filter((h) => hrefs(items).includes(h))) {
        moves++;
        const before = order.slice(0, order.indexOf(m)).filter((h) => hrefs(items).includes(h));
        if (!before.length) continue;
        anchored++;
        assert.equal(hrefs(got)[hrefs(got).indexOf(m) - 1], before.at(-1), label + ": " + m + " does not follow " + before.at(-1));
      }
    }
  }
  // THE OBSERVERS ARE ALIVE: three of the four menus are in the order shown,
  // and the moves measured on this fixture were each checked.
  assert.deepEqual([inOrder, moves, anchored], [360, 721, 599]);
});

// ── THROUGH THE REAL EDIT ROUTE ───────────────────────────────────────────────

const hex32 = () => randomBytes(16).toString("hex");
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

function bucket() {
  const store = new Map([
    ["source/" + SLUG + "/pages.json", JSON.stringify(PAGES)],
    ["source/" + SLUG + "/parts.json", JSON.stringify([])],
    [CONFIG_KEY(SLUG), JSON.stringify({ look: { brand: "Kiln Street Cafe", theme: "broadsheet" }, css: "" })],
  ]);
  const obj = (v) => ({ text: async () => v, json: async () => JSON.parse(v), arrayBuffer: async () => new TextEncoder().encode(v).buffer });
  return {
    store,
    async get(k) { const v = store.get(k); return v === undefined ? null : obj(v); },
    async put(k, v) { store.set(k, typeof v === "string" ? v : String(v)); },
    async delete(k) { store.delete(k); },
    async list() { return { objects: [], truncated: false }; },
    async head(k) { return store.has(k) ? { key: k } : null; },
  };
}

/**
 * One message through `POST /api/site/<slug>/edit` at `layer: "nav"`, on the
 * synchronous path or through the real queue consumer, with the menu editor's
 * answer supplied. The job's row moves the way the live RPCs move it.
 */
async function drive({ answer, mode = "sync", ask = "Change the menu." }) {
  const b = bucket();
  const url = "https://gofarther.dev/api/site/" + SLUG + "/edit";
  const body = JSON.stringify({ layer: "nav", page: "", remove: false, rename: "", tab: false, instruction: ask, picker: "sonnet", idem: "idem" + hex32().slice(0, 20) });
  const seen = { models: [], debits: [] };
  const id = hex32(), secret = hex32();
  if (mode === "job") b.store.set(EDIT_JOB_PREFIX + id, JSON.stringify(packEditJob({ url, body, uid: USER.id, slug: SLUG, secret, at: Date.now() })));
  const row = { state: "routing", billing: "none", cost: 0, result: null };
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = String((input && input.url) || input || "");
    let args = {};
    try { args = JSON.parse(String((init && init.body) || "{}")); } catch { args = {}; }
    const rpc = u.match(/\/rest\/v1\/rpc\/(edit_\w+)/);
    if (rpc) {
      switch (rpc[1]) {
        case "edit_claim": return json({ ok: true, claimed: true, state: "claimed", billing: row.billing, uid: USER.id, slug: SLUG, needs_review: false });
        case "edit_beat": return json({ ok: true, alive: true, state: "routing", cancel: false });
        case "edit_reserve": row.cost += Number(args.p_cost); row.billing = "reserved"; return json({ ok: true, charged: Number(args.p_cost), cost: row.cost, billing: "reserved" });
        case "edit_exempt": if (row.billing === "none") { row.billing = "exempt"; return json({ ok: true, billing: "exempt", state: row.state }); } return json({ ok: false, error: "billed", billing: row.billing });
        case "edit_may_publish": return json(["reserved", "exempt"].includes(row.billing) ? { ok: true, granted: true } : { ok: true, granted: false, error: row.billing === "none" ? "unbilled" : "terminal" });
        case "edit_publish_mark": case "edit_committed": case "edit_phase_write": return json({ ok: true });
        case "edit_finalize":
          if (args.p_result) row.result = args.p_result;
          if (args.p_ok) { row.state = "done"; if (row.billing === "reserved") row.billing = "finalized"; return json({ ok: true, billing: row.billing, cost: row.cost }); }
          return json({ ok: false, error: "not-published", state: row.state });
        case "edit_refund": { const was = row.billing; row.state = args.p_state || "failed"; if (was === "reserved") { row.billing = "refunded"; return json({ ok: true, refunded: row.cost }); } return json({ ok: true, refunded: 0, billing: was }); }
        case "edit_get": return json({ ok: true, job: id, slug: SLUG, state: row.state, phase: null, cost: row.cost, billing: row.billing, result: row.result, needs_review: false, ms: 1000 });
        default: return json({ ok: false, error: "no stub for " + rpc[1] }, 500);
      }
    }
    if (u.includes("/rpc/use_credits")) { const n = Number(args.cost) || 0; seen.debits.push(n); return json(n > 0 ? n : -1); }
    if (u.includes("/rpc/credit_back")) return new Response(null, { status: 204 });
    if (u.includes("/rpc/get_credits")) return json(50);
    if (u.includes("/auth/v1/user")) return json(USER);
    if (u.includes("/rest/v1/edit_traces")) return new Response(null, { status: 201 });
    if (u.includes("/rest/v1/site_backends")) return json(u.includes("slug=eq." + SLUG) ? [{ uid: USER.id, brief: "", neon_db: "" }] : []);
    if (u.includes("/rest/v1/site_aliases")) return json([]);
    if (u.includes("/rest/v1/site_project")) return json([]);
    if (u.includes("/v1/messages")) {
      const tool = (args.tool_choice && args.tool_choice.name) || "";
      seen.models.push({ tool, args });
      if (tool === NAV_TOOL.name) return json({ stop_reason: "tool_use", content: [{ type: "tool_use", name: tool, input: answer }], usage: { input_tokens: 2000, output_tokens: 400 } });
      return new Response("no stub for tool " + tool, { status: 503 });
    }
    if (isDispatchUpload(u)) return dispatchOk();
    return new Response("unavailable", { status: 503 });
  };
  const c = installCompiler({});
  try {
    const worker = await loadWorker();
    const env = { SITES_BUCKET: b, ANTHROPIC_API_KEY: "test-key", XAI_API_KEY: "test-key", SUPABASE_SERVICE_KEY: "svc-test", CREDITS_MINT_SECRET: "mint-test", ...dispatchEnv() };
    const ctx = makeCtx();
    let res, reply;
    if (mode === "job") {
      await worker.queue({ messages: [{ body: { kind: EDIT_JOB_KIND, id }, ack() {}, retry() {} }] }, env, ctx);
      await Promise.allSettled(ctx.pending);
      res = await worker.fetch(new Request("https://gofarther.dev/api/site/edit/" + id, { headers: { Authorization: "Bearer t" } }), env, makeCtx());
      reply = await res.json().catch(() => null);
    } else {
      res = await worker.fetch(new Request(url, { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer t" }, body }), env, ctx);
      reply = await res.json().catch(() => null);
      await Promise.allSettled(ctx.pending);
    }
    return {
      status: res.status, reply, said: editBrowserReply(reply, res.ok, ROUTED),
      pages: JSON.parse(b.store.get("source/" + SLUG + "/pages.json") || "[]"),
      builds: c.calls.map((k) => k.body), models: seen.models, debits: seen.debits,
      row: { state: row.state, billing: row.billing, cost: row.cost },
    };
  } finally {
    c.uninstall();
    globalThis.fetch = real;
  }
}

const page = (r, p) => (r.pages.find((x) => x.path === p) || {}).source;

/**
 * WHAT EVERY SHIPPED MENU EDIT MUST SHOW: one call to the menu editor, shown
 * the union; one compile carrying exactly the stored pages; each page's menu
 * exactly `want`; nothing outside a menu moved by a byte; a page whose menu
 * `want` leaves alone not touched at all; and the money one charge, equal to
 * the reply's cost, on either path.
 */
function assertShipped(r, mode, want, label) {
  assert.equal(r.status, 200, label + ": " + JSON.stringify(r.reply));
  assert.equal(r.reply && r.reply.ok, true, label + ": the menu change did not ship");
  assert.equal(r.reply.layer, "nav", label + ": answered by another rung");
  assert.deepEqual(r.models.map((m) => m.tool), [NAV_TOOL.name], label + ": the models called");
  assert.ok(String(r.models[0].args.messages[0].content).includes("Visit us -> /visit\n  Order -> /order\n  Status -> /status"), label + ": the menu editor was not shown the union");
  assert.equal(r.builds.length, 1, label + ": one compile carries the change");
  assert.deepEqual(r.pages.map((p) => p.path), PAGES.map((p) => p.path), label + ": a page was removed or added");
  const files = r.builds[0].files || {};
  for (const p of PAGES) {
    const after = page(r, p.path);
    assert.equal(files[p.path], after, label + ": " + p.path + " compiled is not " + p.path + " stored");
    assert.deepEqual(menuOf(after), want[p.path], label + ": " + p.path + "'s menu");
    assert.equal(outsideMenus(after), outsideMenus(p.source), label + ": " + p.path + " changed outside its menu");
    if (JSON.stringify(want[p.path]) === JSON.stringify(menuOf(p.source))) assert.equal(after, p.source, label + ": " + p.path + " was rewritten, and its menu did not change");
  }
  const changed = PAGES.filter((p) => page(r, p.path) !== p.source).map((p) => p.path);
  assert.deepEqual([...r.reply.changed].sort(), [...changed].sort(), label + ": the pages the reply says changed are not the pages that did");
  assert.ok(r.reply.cost > 0, label + ": the menu editor's call was not charged");
  if (mode === "sync") {
    assert.deepEqual(r.debits, [r.reply.cost], label + ": the debits are not the reply's cost");
  } else {
    assert.deepEqual(r.debits, [], label + ": the job path debited directly");
    assert.deepEqual(r.row, { state: "done", billing: "finalized", cost: r.reply.cost }, label + ": the job's row");
  }
  assert.equal(r.said.text, r.reply.msg, label + ": the screen is not the rung's own sentence");
}

const OWN = Object.fromEntries(PAGES.map((p) => [p.path, menuOf(p.source)]));

for (const mode of ["sync", "job"]) {
  test(`(${mode}) "take Order out": it leaves every menu that had it — and only those — and every page keeps its own other items`, async () => {
    const r = await drive({ mode, answer: { links: [HOME, MEN, VIS, STA] } });
    assertShipped(r, mode, {
      "index.tsx": [[HOME, MEN, VIS]],
      "menu.tsx": [[MEN, L("Visit", "/visit")]],
      "visit.tsx": [[HOME, VIS, MEN]],
      "status.tsx": OWN["status.tsx"],
      "order.tsx": [],
      "takeaway.tsx": [],
    }, "remove " + mode);
    assert.equal(r.reply.msg, "✅ Updated the menu on 3 pages, each keeping its own items — Home · Menu · Visit us (1 page); Menu · Visit (1 page); Home · Visit us · Menu (1 page).");
    assert.ok(!r.pages.some((p) => menuOf(p.source).flat().some((it) => it.href === "/order")), "a menu still lists Order");
  });

  test(`(${mode}) "rename Visit us to Find us": the item is renamed on every page that lists it, and nothing else in any menu moves`, async () => {
    const r = await drive({ mode, answer: { links: [HOME, MEN, L("Find us", "/visit"), ORD, STA] } });
    const FIND = L("Find us", "/visit");
    assertShipped(r, mode, {
      "index.tsx": [[HOME, MEN, FIND, ORD]],
      "menu.tsx": [[MEN, FIND, ORD]],
      "visit.tsx": [[HOME, FIND, MEN, ORD]],
      "status.tsx": OWN["status.tsx"],
      "order.tsx": [],
      "takeaway.tsx": [],
    }, "rename " + mode);
  });

  test(`(${mode}) "put Order and Status first": two items moved at once, on four menus that differ — each page's own items, words and the rest of its order kept`, async () => {
    const r = await drive({ mode, answer: { links: [ORD, STA, HOME, MEN, VIS] } });
    assertShipped(r, mode, {
      "index.tsx": [[ORD, HOME, MEN, VIS]],
      "menu.tsx": [[ORD, MEN, L("Visit", "/visit")]],
      "visit.tsx": [[ORD, HOME, VIS, MEN]],
      "status.tsx": [[STA, HOME]],
      "order.tsx": [],
      "takeaway.tsx": [],
    }, "two moved " + mode);
    assert.equal(r.reply.msg, "✅ Updated the menu on 4 pages, each keeping its own items — Order · Home · Menu · Visit us (1 page); Order · Menu · Visit (1 page); Order · Home · Visit us · Menu (1 page); Status · Home (1 page).");
  });

  // TWO MOVED ITEMS ON ONE PAGE, which is where the old placement went wrong:
  // Order went back before Visit us while Visit us still stood in its old
  // place, and Visit us then went back after Order — both where they started.
  test(`(${mode}) "put Order and then Visit us first": two items moved together on the pages that list both, and each page keeps its own words and the rest of its order`, async () => {
    const r = await drive({ mode, answer: { links: [ORD, VIS, HOME, MEN, STA] } });
    assertShipped(r, mode, {
      "index.tsx": [[ORD, VIS, HOME, MEN]],
      "menu.tsx": [[ORD, L("Visit", "/visit"), MEN]],
      "visit.tsx": [[ORD, VIS, HOME, MEN]],
      "status.tsx": OWN["status.tsx"],
      "order.tsx": [],
      "takeaway.tsx": [],
    }, "two moved together " + mode);
  });

  test(`(${mode}) "reverse the menu": every item but one moved, on four menus that differ — none flattened into another`, async () => {
    const r = await drive({ mode, answer: { links: [STA, ORD, VIS, MEN, HOME] } });
    assertShipped(r, mode, {
      "index.tsx": [[ORD, VIS, MEN, HOME]],
      "menu.tsx": [[ORD, L("Visit", "/visit"), MEN]],
      "visit.tsx": [[ORD, VIS, MEN, HOME]],
      "status.tsx": [[STA, HOME]],
      "order.tsx": [],
      "takeaway.tsx": [],
    }, "reversed " + mode);
  });

  test(`(${mode}) "move Order to the front": it moves on each page that has it, and each page's own order of the rest stays`, async () => {
    const r = await drive({ mode, answer: { links: [ORD, HOME, MEN, VIS, STA] } });
    assertShipped(r, mode, {
      "index.tsx": [[ORD, HOME, MEN, VIS]],
      "menu.tsx": [[ORD, MEN, L("Visit", "/visit")]],
      "visit.tsx": [[ORD, HOME, VIS, MEN]],
      "status.tsx": OWN["status.tsx"],
      "order.tsx": [],
      "takeaway.tsx": [],
    }, "move " + mode);
  });

  test(`(${mode}) "add Takeaway after Menu": every menu gains it beside its own items, after Menu where the menu has Menu`, async () => {
    const TAKE = L("Takeaway", "/takeaway");
    const r = await drive({ mode, answer: { links: [HOME, MEN, TAKE, VIS, ORD, STA] } });
    assertShipped(r, mode, {
      "index.tsx": [[HOME, MEN, TAKE, VIS, ORD]],
      "menu.tsx": [[MEN, TAKE, L("Visit", "/visit"), ORD]],
      "visit.tsx": [[HOME, VIS, MEN, TAKE, ORD]],
      "status.tsx": [[HOME, TAKE, STA]],
      "order.tsx": [],
      "takeaway.tsx": [],
    }, "add " + mode);
  });

  test(`(${mode}) "replace Order with Takeaway": the new item stands where Order stood, on the pages that had Order`, async () => {
    const TAKE = L("Takeaway", "/takeaway");
    const r = await drive({ mode, answer: { links: [HOME, MEN, VIS, TAKE, STA] } });
    assertShipped(r, mode, {
      "index.tsx": [[HOME, MEN, VIS, TAKE]],
      "menu.tsx": [[MEN, L("Visit", "/visit"), TAKE]],
      "visit.tsx": [[HOME, VIS, MEN, TAKE]],
      "status.tsx": OWN["status.tsx"],
      "order.tsx": [],
      "takeaway.tsx": [],
    }, "replace " + mode);
  });

  test(`(${mode}) "point Visit us at the takeaway page": each page's own words stay, at the new address`, async () => {
    const r = await drive({ mode, answer: { links: [HOME, MEN, L("Visit us", "/takeaway"), ORD, STA] } });
    assertShipped(r, mode, {
      "index.tsx": [[HOME, MEN, L("Visit us", "/takeaway"), ORD]],
      "menu.tsx": [[MEN, L("Visit", "/takeaway"), ORD]],
      "visit.tsx": [[HOME, L("Visit us", "/takeaway"), MEN, ORD]],
      "status.tsx": OWN["status.tsx"],
      "order.tsx": [],
      "takeaway.tsx": [],
    }, "repoint " + mode);
  });

  test(`(${mode}) an answer that restates the menu it was shown changes no page, publishes nothing and says so`, async () => {
    const r = await drive({ mode, answer: { links: SHOWN } });
    assert.equal(r.reply && r.reply.ok, false, JSON.stringify(r.reply));
    assert.equal(r.reply.error, "no-change");
    assert.equal(r.reply.msg, "That's already the menu — nothing to change.");
    assert.equal(r.builds.length, 0, "a no-op was compiled");
    for (const p of PAGES) assert.equal(page(r, p.path), p.source, p.path + " was rewritten by a no-op");
  });
}

test("the answers supplied above are ones the route's own reader keeps whole, item for item", () => {
  // EVERY ADDRESS IS A PAGE OF THIS SITE, so nothing a case supplies is
  // dropped on the way in and read as a removal it never asked for.
  for (const links of [[HOME, MEN, VIS, STA], [HOME, MEN, L("Find us", "/visit"), ORD, STA], [ORD, HOME, MEN, VIS, STA],
    [HOME, MEN, L("Takeaway", "/takeaway"), VIS, ORD, STA], [HOME, MEN, VIS, L("Takeaway", "/takeaway"), STA], [HOME, MEN, L("Visit us", "/takeaway"), ORD, STA], SHOWN]) {
    const read = readNav({ content: [{ type: "tool_use", name: NAV_TOOL.name, input: { links } }] }, ROUTES);
    assert.deepEqual(read.links, links, JSON.stringify(read.dropped));
    assert.deepEqual(read.dropped, []);
  }
  assert.ok(Object.hasOwn(NAV_TOOL.input_schema.properties, "links"), "the menu editor's tool no longer answers a menu");
});
