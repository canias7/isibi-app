import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import {
  navSlots, parseNavItems, renderNav, applyNav, readNav, navDigest,
  navRequest, navUsage, navReply, runNavEdit, NAV_TOOL, NAV_MODEL,
  MAX_NAV_ITEMS, MAX_LABEL,
  actionSlots, applyAction,
  linkSlots, matchLinks, applyPageLinks, linkRefusal,
  MAX_LINK_CHANGES, MAX_LINK_LINES, MAX_LINK_SLOTS,
} from "../builder/site-nav.mjs";
import { EDIT_LAYERS } from "../builder/site-ask.mjs";
import { CORPUS_DIR } from "./fixtures/corpus.mjs";
import { GENERATED_DIR } from "./fixtures/generated.mjs";

const page = (p, links) => ({
  path: p,
  source: `import { SiteChrome } from "@/components/ui/site-chrome";\nexport default function P() {\n  return (\n    <SiteChrome name="Cutler Row" links={[${links}]}>\n      <h1>Hello</h1>\n    </SiteChrome>\n  );\n}\n`,
});
const NAV = `{ label: "Prices", href: "/prices" }, { label: "Book", href: "/book" }`;

// ── FINDING THE MENU ────────────────────────────────────────────────────────

test("navSlots finds a JSX links attribute and reads its items", () => {
  const slots = navSlots([page("index.tsx", NAV)]);
  assert.equal(slots.length, 1);
  assert.equal(slots[0].route, "/");
  assert.deepEqual(slots[0].items, [
    { label: "Prices", href: "/prices" },
    { label: "Book", href: "/book" },
  ]);
});

test("navSlots finds the object-property form too — 46 of the corpus use it", () => {
  const src = {
    path: "book.tsx",
    source: `const CHROME = {\n  name: "Cutler Row",\n  links: [{ label: "Prices", href: "/prices" }],\n};\nexport default function P() { return <SiteChrome {...CHROME} />; }\n`,
  };
  const slots = navSlots([src]);
  assert.equal(slots.length, 1);
  assert.deepEqual(slots[0].items, [{ label: "Prices", href: "/prices" }]);
});

test("a links array whose items carry NO label is not a nav", () => {
  // THE FAVICON LIST IN `__root.tsx`, byte for byte: same property name, no
  // label. Keying on the name alone would rewrite every site's tab icon into a
  // menu.
  const src = {
    path: "__root.tsx",
    source: `head: () => ({ links: [{ rel: "icon", href: "/icon.svg", type: "image/svg+xml" }] })`,
  };
  assert.deepEqual(navSlots([src]), []);
});

test("a links array of {network, href} is not a nav either", () => {
  // `SocialLinks` — three real pages in the corpus pass this, and it is a
  // different component's prop that happens to share a name.
  const src = { path: "index.tsx", source: `<SocialLinks links={[{ network: "Instagram", href: "#" }]} />` };
  assert.deepEqual(navSlots([src]), []);
});

test("a nested brace or bracket does not end the array early", () => {
  const src = { path: "index.tsx", source: `<SiteChrome links={[{ label: "A", href: "/a", meta: { k: [1, 2] } }, { label: "B", href: "/b" }]} />` };
  const slots = navSlots([src]);
  assert.equal(slots.length, 1);
  assert.equal(slots[0].items.length, 2);
  assert.equal(slots[0].items[1].href, "/b");
});

test("a bracket inside a string does not end the array", () => {
  const src = { path: "index.tsx", source: `<SiteChrome links={[{ label: "Sale ]", href: "/sale" }]} />` };
  assert.deepEqual(navSlots([src])[0].items, [{ label: "Sale ]", href: "/sale" }]);
});

test("an escaped quote inside a label does not end the string", () => {
  const src = { path: "index.tsx", source: `<SiteChrome links={[{ label: "Mo\\"s", href: "/mo" }]} />` };
  assert.equal(navSlots([src])[0].items[0].label, 'Mo"s');
});

test("two pages each get their own slot", () => {
  const slots = navSlots([page("index.tsx", NAV), page("book.tsx", NAV)]);
  assert.deepEqual(slots.map((s) => s.page), ["index.tsx", "book.tsx"]);
});

test("a page with no source or no path is skipped rather than throwing", () => {
  assert.deepEqual(navSlots([null, { path: "a.tsx" }, { source: "x" }, 7]), []);
  assert.deepEqual(navSlots(null), []);
});

// ── REFUSING WHAT CANNOT BE REWRITTEN ───────────────────────────────────────

test("a spread refuses the whole slot — replacing it would delete what it contributed", () => {
  assert.equal(parseNavItems(`...base, { label: "B", href: "/b" }`), null);
  const src = { path: "index.tsx", source: `<SiteChrome links={[...base, { label: "B", href: "/b" }]} />` };
  assert.deepEqual(navSlots([src]), []);
});

test("a computed href refuses the slot", () => {
  assert.equal(parseNavItems(`{ label: "B", href: route }`), null);
});

test("a .map refuses the slot", () => {
  assert.equal(parseNavItems(`...items.map((i) => ({ label: i.n, href: i.h }))`), null);
});

test("an empty array parses as no items rather than as a refusal", () => {
  assert.deepEqual(parseNavItems("  "), []);
  assert.deepEqual(parseNavItems(""), []);
});

// ── THE ROUND TRIP ──────────────────────────────────────────────────────────

test("renderNav JSON-escapes a label, so an apostrophe or a quote cannot break the build", () => {
  // `Mo's Cuts` is not an edge case, it is a business name.
  const out = renderNav([{ label: `Mo's "best" cuts`, href: "/mo" }]);
  assert.deepEqual(parseNavItems(out), [{ label: `Mo's "best" cuts`, href: "/mo" }]);
});

test("an empty menu renders as an empty interior", () => {
  assert.equal(renderNav([]), "");
  assert.equal(renderNav(null), "");
});

// ── WRITING IT BACK ─────────────────────────────────────────────────────────

test("applyNav writes one menu into every page", () => {
  const pages = [page("index.tsx", NAV), page("book.tsx", NAV)];
  const links = [{ label: "Book", href: "/book" }, { label: "Prices", href: "/prices" }];
  const { pages: next, changed } = applyNav(pages, links);
  assert.deepEqual(changed, ["index.tsx", "book.tsx"]);
  for (const p of next) {
    const items = navSlots([p])[0].items;
    assert.deepEqual(items.map((i) => i.href).filter((h) => h !== "/"), ["/book", "/prices"]);
  }
});

test("THE HOME PAGE DOES NOT LINK TO ITSELF — measured, 1 of 93 in the corpus", () => {
  const pages = [page("index.tsx", NAV), page("book.tsx", NAV)];
  const links = [{ label: "Home", href: "/" }, { label: "Book", href: "/book" }];
  const { pages: next } = applyNav(pages, links);
  const home = navSlots([next.find((p) => p.path === "index.tsx")])[0].items;
  const book = navSlots([next.find((p) => p.path === "book.tsx")])[0].items;
  assert.deepEqual(home, [{ label: "Book", href: "/book" }]);
  // NO SUCH RULE FOR ANY OTHER PAGE. The corpus is split there (31 of 209 list
  // themselves), so there is no convention to preserve and inventing one would
  // be a second opinion about a question nobody has answered.
  assert.deepEqual(book, [{ label: "Home", href: "/" }, { label: "Book", href: "/book" }]);
});

test("a page whose own route it already lists keeps listing itself", () => {
  const pages = [page("book.tsx", NAV)];
  const { pages: next } = applyNav(pages, [{ label: "Book", href: "/book" }]);
  assert.deepEqual(navSlots(next)[0].items, [{ label: "Book", href: "/book" }]);
});

test("two slots in one file are both written, and the offsets stay right", () => {
  // BACK TO FRONT: each write changes the length of the source, so a forward
  // pass lands the second write in whatever moved into its offset.
  const src = {
    path: "index.tsx",
    source: `<A links={[{ label: "Old", href: "/old" }]} />\n<B links={[{ label: "Old", href: "/old" }]} />`,
  };
  const { pages: next } = applyNav([src], [{ label: "New", href: "/new" }, { label: "Two", href: "/two" }]);
  const slots = navSlots(next);
  assert.equal(slots.length, 2);
  for (const s of slots) assert.deepEqual(s.items.map((i) => i.href), ["/new", "/two"]);
});

test("a page with no nav is left byte-identical and is not reported changed", () => {
  const plain = { path: "terms.tsx", source: `export default function P() { return <p>Terms</p>; }` };
  const { pages: next, changed } = applyNav([plain, page("index.tsx", NAV)], [{ label: "Book", href: "/book" }]);
  assert.equal(next[0].source, plain.source);
  assert.deepEqual(changed, ["index.tsx"]);
});

test("writing the menu that is already there reports NO change", () => {
  const pages = [page("book.tsx", NAV)];
  const { changed } = applyNav(pages, [
    { label: "Prices", href: "/prices" },
    { label: "Book", href: "/book" },
  ]);
  assert.deepEqual(changed, []);
});

// ── READING THE MODEL ───────────────────────────────────────────────────────

const reply = (links, usage) => ({ content: [{ type: "tool_use", input: { links } }], usage });
const ROUTES = ["/", "/prices", "/book"];

test("readNav keeps a menu of real routes, in order", () => {
  const r = readNav(reply([{ label: "Book", href: "/book" }, { label: "Prices", href: "/prices" }]), ROUTES);
  assert.deepEqual(r.links, [{ label: "Book", href: "/book" }, { label: "Prices", href: "/prices" }]);
  assert.deepEqual(r.dropped, []);
});

test("A PAGE THAT DOES NOT EXIST IS DROPPED AND NAMED — it would 404 from every page", () => {
  const r = readNav(reply([{ label: "Book", href: "/book" }, { label: "Gallery", href: "/gallery" }]), ROUTES);
  assert.deepEqual(r.links, [{ label: "Book", href: "/book" }]);
  assert.equal(r.dropped[0].why, "no-such-page");
  assert.equal(r.dropped[0].href, "/gallery");
});

test("A BARE ANCHOR IS DROPPED ON A MULTI-PAGE SITE — it is dead on every page but one", () => {
  // `lintPages` exempts anchors and 256 of the corpus's hrefs are one, but those
  // are IN-BODY links on the page holding the section. A menu is shown on every
  // page, so `#prices` there means "a section of whatever page you are on" and
  // finds nothing on the other four.
  const r = readNav(reply([{ label: "Prices", href: "#prices" }]), ROUTES);
  assert.deepEqual(r.links, []);
  assert.equal(r.dropped[0].why, "page-local");
});

test("...AND IS KEPT ON A ONE-PAGE SITE, where the menu IS in-page navigation", () => {
  // Refusing it there would empty the menu entirely. `menu-1`, one of the two
  // generated samples in this repo, is exactly that shape.
  const r = readNav(reply([{ label: "Prices", href: "#prices" }]), ["/"]);
  assert.deepEqual(r.links, [{ label: "Prices", href: "#prices" }]);
});

test("A PAGE PLUS A FRAGMENT IS THE FORM THAT WORKS FROM EVERYWHERE", () => {
  // `/#prices` is the correct way to put a section of the home page in a menu.
  // Checked against the route with the fragment split off, or it reads as a page
  // called "/#prices" and is dropped as nonexistent.
  const r = readNav(reply([{ label: "Prices", href: "/#prices" }, { label: "Kit", href: "/book#kit" }]), ROUTES);
  assert.deepEqual(r.links, [{ label: "Prices", href: "/#prices" }, { label: "Kit", href: "/book#kit" }]);
});

test("a fragment on a page that does not exist is still dropped", () => {
  const r = readNav(reply([{ label: "X", href: "/ghost#a" }]), ROUTES);
  assert.deepEqual(r.links, []);
  assert.equal(r.dropped[0].why, "no-such-page");
});

test("a malformed fragment is refused on both forms", () => {
  for (const href of ["#a b", "/#a b", "#" + "x".repeat(80)]) {
    assert.deepEqual(readNav(reply([{ label: "X", href }]), ROUTES).links, [], href);
  }
});

test("the reply NAMES a page-local anchor and says how to fix it", () => {
  const msg = navReply({
    links: [{ label: "Book", href: "/book" }],
    dropped: [{ label: "Prices", href: "#prices", why: "page-local" }],
    changed: ["index.tsx"],
  });
  assert.match(msg, /Prices/);
  assert.match(msg, /section of whichever page/);
  // Not folded into the generic count, which reads as "something went wrong"
  // about a menu item that is nearly right.
  assert.doesNotMatch(msg, /not usable/);
});

test("an absolute https address is allowed — a social profile in a menu is ordinary", () => {
  const r = readNav(reply([{ label: "Instagram", href: "https://instagram.com/x" }]), ROUTES);
  assert.equal(r.links.length, 1);
});

test("A PROTOCOL-RELATIVE URL IS REFUSED — it starts with a slash and is another origin", () => {
  // The one shape a naive startsWith("/") gets wrong. The `safeNext` lesson.
  const r = readNav(reply([{ label: "Evil", href: "//evil.example" }]), ROUTES);
  assert.deepEqual(r.links, []);
  assert.equal(r.dropped[0].why, "offsite");
});

test("http:// and javascript: are refused", () => {
  for (const href of ["http://x.example", "javascript:alert(1)", "data:text/html,x", "mailto:a@b.c"]) {
    const r = readNav(reply([{ label: "X", href }]), ROUTES);
    assert.deepEqual(r.links, [], href);
  }
});

test("a non-string label or href is refused rather than coerced", () => {
  // `String(["Book","Prices"])` is "Book,Prices" — one item wearing two answers.
  const r = readNav(reply([{ label: ["Book", "Prices"], href: "/book" }, { label: "B", href: ["/a", "/b"] }]), ROUTES);
  assert.deepEqual(r.links, []);
});

test("a duplicate href is dropped — two menu items to one page", () => {
  const r = readNav(reply([{ label: "Book", href: "/book" }, { label: "Booking", href: "/book" }]), ROUTES);
  assert.equal(r.links.length, 1);
  assert.equal(r.dropped[0].why, "duplicate");
});

test("a label is bounded, and a menu is bounded", () => {
  const long = readNav(reply([{ label: "x".repeat(500), href: "/book" }]), ROUTES);
  assert.equal(long.links[0].label.length, MAX_LABEL);
  const many = readNav(reply(Array.from({ length: 40 }, (_, i) => ({ label: "L" + i, href: "/#a" + i }))), ROUTES);
  assert.equal(many.links.length, MAX_NAV_ITEMS);
});

test("no tool call, or a links that is not an array, reads as nothing", () => {
  assert.equal(readNav({ content: [{ type: "text", text: "hi" }] }, ROUTES), null);
  assert.equal(readNav(reply("/book"), ROUTES), null);
  assert.equal(readNav(null, ROUTES), null);
});

// ── WHAT THE MODEL IS SHOWN ─────────────────────────────────────────────────

test("the digest states the menu as it is, the pages that exist, and what is missing from it", () => {
  const slots = navSlots([page("index.tsx", NAV), page("book.tsx", NAV)]);
  const d = navDigest(slots, ["/", "/prices", "/book", "/about"]);
  assert.match(d, /Prices -> \/prices/);
  assert.match(d, /Book -> \/book/);
  // NOT IN THE MENU is stated rather than left to be worked out: "add the
  // missing pages to the menu" is a real instruction, and a model that has to
  // diff two lists to answer it gets it wrong more often than one that is told.
  assert.match(d, /NOT IN THE MENU AT ALL: \/, \/about/);
});

test("the digest says so when there is no menu and when there are no pages", () => {
  const d = navDigest([], []);
  assert.match(d, /\(empty\)/);
  assert.match(d, /\(none\)/);
  assert.doesNotMatch(d, /NOT IN THE MENU/);
});

test("the request forces the tool and carries the instruction", () => {
  const req = navRequest({ instruction: "put book first", slots: navSlots([page("index.tsx", NAV)]), routes: ROUTES });
  assert.equal(req.model, NAV_MODEL);
  assert.equal(req.tool_choice.name, NAV_TOOL.name);
  assert.deepEqual(req.tools, [NAV_TOOL]);
  assert.match(req.messages[0].content, /put book first/);
});

test("the tool asks for the WHOLE menu, not a change to it", () => {
  // A model returning only the item to add would silently delete the rest.
  const d = NAV_TOOL.input_schema.properties.links.description;
  assert.match(d, /THE WHOLE MENU/);
  // AND LEAVING IT OUT MEANS THE MENU IS UNCHANGED — the field is optional now,
  // because a button-only ask that forces the model to restate the menu is how
  // an item goes missing.
  assert.match(d, /LEAVE THIS OUT ENTIRELY IF THE MENU IS NOT CHANGING/);
  assert.ok(!(NAV_TOOL.input_schema.required || []).includes("links"),
    "links must be optional, or a button-only change restates the menu");
});

// ── THE LANE ────────────────────────────────────────────────────────────────

const okReply = reply(
  [{ label: "Book", href: "/book" }, { label: "Prices", href: "/prices" }],
  { input_tokens: 100, output_tokens: 20 },
);

test("runNavEdit rewrites every page and reports what changed", async () => {
  const out = await runNavEdit({ send: async () => okReply }, {
    instruction: "put book first", pages: [page("index.tsx", NAV), page("book.tsx", NAV)], routes: ROUTES,
  });
  assert.equal(out.ok, true);
  assert.deepEqual(out.changed, ["index.tsx", "book.tsx"]);
  assert.equal(out.usage.model, NAV_MODEL);
  assert.match(out.msg, /2 pages/);
});

test("A SITE WITH NO MENU AT ALL ESCALATES — there is nothing here to edit", () => {
  return runNavEdit({ send: async () => { throw new Error("must not be called"); } }, {
    instruction: "put book first", pages: [{ path: "a.tsx", source: "export default () => null;" }], routes: ROUTES,
  }).then((out) => {
    assert.equal(out.ok, false);
    assert.equal(out.escalate, true);
    assert.equal(out.reason, "no-nav");
  });
});

test("A MODEL THAT RETURNED NO MENU DOES NOT ESCALATE — the rungs above are no cheaper", async () => {
  const out = await runNavEdit({ send: async () => reply([]) }, {
    instruction: "make it blue", pages: [page("index.tsx", NAV)], routes: ROUTES,
  });
  assert.equal(out.ok, false);
  assert.equal(out.escalate, false);
  assert.equal(out.reason, "no-menu");
  assert.ok(out.msg);
});

test("A MENU THAT COMES BACK IDENTICAL REFUSES rather than republishing every page", async () => {
  // Republishing to write back bytes that are already there costs a container
  // run and archives a version whose label describes a change that did not
  // happen.
  const same = reply([{ label: "Prices", href: "/prices" }, { label: "Book", href: "/book" }]);
  const out = await runNavEdit({ send: async () => same }, {
    instruction: "put prices first", pages: [page("book.tsx", NAV)], routes: ROUTES,
  });
  assert.equal(out.ok, false);
  assert.equal(out.escalate, false);
  assert.equal(out.reason, "no-change");
});

test("a send failure is reported, never escalated", async () => {
  const out = await runNavEdit({ send: async () => { throw new Error("down"); } }, {
    instruction: "x", pages: [page("index.tsx", NAV)], routes: ROUTES,
  });
  assert.equal(out.escalate, false);
  assert.equal(out.reason, "send");
  assert.ok(out.error);
});

test("the reply NAMES a page that does not exist rather than counting it", async () => {
  // "1 item was dropped" says something went wrong and not what; the commonest
  // reason is a page they can simply ask for.
  const out = await runNavEdit({
    send: async () => reply([{ label: "Book", href: "/book" }, { label: "Gallery", href: "/gallery" }]),
  }, { instruction: "add gallery", pages: [page("index.tsx", NAV)], routes: ROUTES });
  assert.equal(out.ok, true);
  assert.match(out.msg, /Gallery/);
  assert.match(out.msg, /no \/gallery page/);
});

test("navUsage is null when the reply carries none", () => {
  assert.equal(navUsage({ content: [] }), null);
  assert.equal(navUsage(null), null);
});

test("navReply says what the menu now is", () => {
  const msg = navReply({ links: [{ label: "Book", href: "/book" }], changed: ["index.tsx"] });
  assert.match(msg, /1 page/);
  assert.match(msg, /Book/);
});

// ── REACHABLE ───────────────────────────────────────────────────────────────

test("`nav` is a layer the router can answer with", () => {
  // A lane the router cannot name is reachable by nothing, which is the shape
  // twelve dead features in this repo have had.
  assert.ok(EDIT_LAYERS.includes("nav"));
});

test("the router's layer description names the menu and points a new page at addon", () => {
  const src = fs.readFileSync(new URL("../builder/site-ask.mjs", import.meta.url), "utf8");
  const at = src.indexOf('"\\"nav\\" —');
  assert.ok(at > 0, "the nav layer has a description");
  const window = src.slice(at, src.indexOf('"\\"page\\" —', at));
  assert.ok(window.length > 100, "the window reaches the next layer");
  // THE PROPERTY, NOT THE SPELLING. This was pinned to the exact phrase "THE TOP
  // OF EVERY PAGE" and went red on a correct change — the lane grew the footer's
  // contact details, which are at the BOTTOM, so the headline had to stop
  // claiming the top. What it must say is that this lane is the same on every
  // page, since that is the fact separating it from `page`.
  assert.match(window, /every[- ]page/i);
  assert.match(window, /THE MENU — which items are in it/);
  // An item can only point at a page that exists, so "add a gallery to the
  // menu" with no gallery page is an addon and must say so here.
  assert.match(window, /ONLY EVER POINTS AT PAGES THE SITE ALREADY HAS/);
});

test("THE `page` LAYER NO LONGER SENDS A MENU CHANGE TO THE ADDON LANE", () => {
  // It used to, by name: "add the gallery to the menu everywhere" was its own
  // worked example of something to answer "addon" for. Correct while nothing
  // could edit a menu; with this layer it is a ~27-credit page-generation call
  // to move one word, and the example has to point at the cheap lane or the
  // layer is reachable by nothing.
  // COMMENTS ARE BLANKED BEFORE THE ABSENCE IS JUDGED, and this test failed
  // against a correct fix without it: the comment recording why the clause
  // changed quotes the clause, so prose explaining a bug contains the bug's
  // spelling. WHOLE LINES ONLY — blanking from any `//` would eat a line
  // holding an `https://` URL, and this file is mostly prompt text.
  const src = fs.readFileSync(new URL("../builder/site-ask.mjs", import.meta.url), "utf8")
    .replace(/^[ \t]*\/\/[^\n]*/gm, (m) => " ".repeat(m.length));
  const at = src.indexOf('"ONE PAGE, AND ONLY ONE.');
  assert.ok(at > 0);
  const window = src.slice(at, at + 1400);
  assert.doesNotMatch(window, /add the gallery to the menu/);
  assert.match(window, /A MENU CHANGE IS \\"nav\\"/);
});

test("the worker dispatches the nav layer and imports the module", () => {
  // The wiring layer, where this repo has recorded twelve dead features. A call
  // to a name that was never imported is a ReferenceError on the edit path.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(w, /import \{ runNavEdit \} from "\.\/builder\/site-nav\.mjs"/);
  const at = w.indexOf('if (eLayer === "nav")');
  assert.ok(at > 0, "the nav branch exists");
  const window = w.slice(at, w.indexOf('if (eLayer === "picture")', at));
  assert.ok(window.length > 500, "the window reaches the next branch");
  assert.match(window, /await runNavEdit\(/);
  // THE ROUTES ARE THE ALLOW-LIST and they have to come from the real pages —
  // an empty list drops every internal item in the menu.
  assert.match(window, /routes: navRoutes/);
  assert.match(window, /eSrc\.map\(\(p\) => routeOf\(p\.path\)\)/);
  // It republishes through the one spine, so a nav edit gets the render check,
  // the version archive and the redirect map like every other cheap edit.
  // `publishStep` since 2026-08-29 — the edit route's branches hand their pages
  // to a deferring wrapper so the spine runs ONCE per message (owner: "if the
  // act was 2 things then 1 publish"). The property is unchanged: this branch
  // still hands its pages to the publish path.
  assert.match(window, /await publishStep\(env, \{/);
});

// ── THE CORPUS, WHICH IS WHAT DECIDES WHETHER THIS CAN EXIST ────────────────

test("driven over every page the generator learns from: no false positives, and every menu round-trips", () => {
  // A STRUCTURAL EDITOR IS ONLY ALLOWED HERE IF IT IS RIGHT ABOUT REAL PAGES.
  // The bar `lintPages` had to clear over its 328, applied to the same corpus:
  // the 324 family exemplars plus the reference pages.
  const root = new URL("../builder/lovable/template/src/", import.meta.url);
  const pages = [];
  const walk = (dir, rel) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      const r = rel ? rel + "/" + e.name : e.name;
      if (e.isDirectory()) walk(full, r);
      else if (e.name.endsWith(".tsx")) pages.push({ path: r, source: fs.readFileSync(full, "utf8") });
    }
  };
  walk(CORPUS_DIR, "");
  walk(path.join(root.pathname, "routes"), "");

  // The floor first: a scan that silently stopped matching would report a clean
  // corpus and prove nothing.
  assert.ok(pages.length > 300, "the corpus was found: " + pages.length);
  const slots = navSlots(pages);
  assert.ok(slots.length > 290, "menus were found: " + slots.length);

  // NOT ONE FALSE POSITIVE. The four `links` arrays in the corpus that are not
  // navs — the favicon list and three `SocialLinks` — must all be excluded.
  const bad = slots.filter((s) => s.items.some((it) => !it.label || !it.href));
  assert.deepEqual(bad, [], "every item found has a label and an href");
  assert.equal(slots.filter((s) => s.page.endsWith("__root.tsx")).length, 0, "the favicon list is not a menu");

  // EVERY MENU SURVIVES BEING WRITTEN BACK. If a menu cannot round-trip, this
  // lane corrupts that page the first time anybody reorders anything.
  for (const s of slots) {
    assert.deepEqual(parseNavItems(renderNav(s.items)), s.items, s.page);
  }
});

test("driven over the only pages in this repo the GENERATOR wrote", () => {
  // THE EXEMPLARS ARE PAGES WE WROTE, in the house style, so a rule tuned on
  // them is tuned to us rather than to the thing being linted. These eight files
  // are committed eval output — the only corpus here written by the generator —
  // and they are what changed the anchor rule: `booking-1`'s home page carries
  // three bare `#` anchors in its menu and its other three pages carry none.
  const dir = GENERATED_DIR;
  const sites = fs.readdirSync(dir).filter((d) => fs.statSync(path.join(dir, d)).isDirectory());
  assert.ok(sites.length >= 3, "the generated samples were found: " + sites.length);

  let withNav = 0;
  for (const site of sites) {
    const files = fs.readdirSync(path.join(dir, site)).filter((f) => f.endsWith(".tsx"));
    const pages = files.map((f) => ({ path: f, source: fs.readFileSync(path.join(dir, site, f), "utf8") }));
    for (const s of navSlots(pages)) {
      withNav++;
      // The two properties that decide whether this lane can touch generator
      // output at all: every item is readable, and it survives a round trip.
      assert.ok(s.items.every((it) => it.label && it.href), site + "/" + s.page);
      assert.deepEqual(parseNavItems(renderNav(s.items)), s.items, site + "/" + s.page);
    }
  }
  assert.ok(withNav >= 4, "menus were found in the generated samples: " + withNav);
});

// ── THE HEADER'S CALL-TO-ACTION BUTTON ──────────────────────────────────────

const withBtn = (p, extra = "") => ({
  path: p,
  source: `export default function P() {\n  return (\n    <SiteChrome name="Cutler Row" links={[${NAV}]} action={{ label: "Book a chair", href: "/book" }}${extra}>\n      <h1>Hi</h1>\n    </SiteChrome>\n  );\n}\n`,
});
const noBtn = (p) => ({
  path: p,
  source: `export default function P() {\n  return (\n    <SiteChrome name="Cutler Row" links={[${NAV}]}>\n      <h1>Hi</h1>\n    </SiteChrome>\n  );\n}\n`,
});

test("actionSlots reads the button out of a JSX attribute and a shared object", () => {
  assert.deepEqual(actionSlots([withBtn("index.tsx")])[0].action,
    { label: "Book a chair", href: "/book" });
  const shared = {
    path: "book.tsx",
    source: `const CHROME = {\n  name: "Cutler Row",\n  action: { label: "Book a chair", href: "/book" },\n};\nexport default function P() { return <SiteChrome {...CHROME} />; }\n`,
  };
  const slots = actionSlots([shared]);
  // ONE SLOT, NOT TWO. The tag spreads the object, so it is not an insertion
  // point — a prop written before a spread is overridden by it.
  assert.equal(slots.length, 1);
  assert.equal(slots[0].kind, "obj");
  assert.deepEqual(slots[0].action, { label: "Book a chair", href: "/book" });
});

test("a header with no button is an INSERTION point, not an absence", () => {
  const slots = actionSlots([noBtn("index.tsx")]);
  assert.equal(slots.length, 1);
  assert.equal(slots[0].action, null);
  assert.ok(slots[0].insertAt > 0);
});

test("A SPREAD TAG IS NEVER AN INSERTION POINT — found by driving the reference pages", () => {
  const spread = { path: "x.tsx", source: `export default () => <SiteChrome {...CHROME} />;` };
  assert.deepEqual(actionSlots([spread]), []);
});

test("changing the destination rewrites every page's button", () => {
  const pages = [withBtn("index.tsx"), withBtn("book.tsx")];
  const { pages: next, changed } = applyAction(pages, { label: "Get a quote", href: "/contact" }, false);
  assert.deepEqual(changed, ["index.tsx", "book.tsx"]);
  for (const p of next) {
    assert.deepEqual(actionSlots([p])[0].action, { label: "Get a quote", href: "/contact" });
  }
});

test("a removal takes the whole attribute away, not just its contents", () => {
  // `action={{}}` would compile and render a button with no label.
  const { pages: next, changed } = applyAction([withBtn("index.tsx")], null, true);
  assert.deepEqual(changed, ["index.tsx"]);
  assert.doesNotMatch(next[0].source, /action=/);
  // The header is now an INSERTION point rather than nothing — which is what
  // makes "actually, put it back" work.
  const after = actionSlots(next);
  assert.equal(after.length, 1);
  assert.equal(after[0].action, null);
  // And the tag is left tidy: no `name="X" >` with a hole in it.
  assert.doesNotMatch(next[0].source, / {2}>/);
  // and the rest of the tag is intact
  assert.match(next[0].source, /name="Cutler Row"/);
  assert.equal(navSlots(next).length, 1);
});

test("adding one to a header that has none produces a readable button", () => {
  const { pages: next, changed } = applyAction([noBtn("index.tsx")], { label: "Call now", href: "tel:+441132000000" }, false);
  assert.deepEqual(changed, ["index.tsx"]);
  assert.deepEqual(actionSlots(next)[0].action, { label: "Call now", href: "tel:+441132000000" });
  // The menu beside it is untouched.
  assert.equal(navSlots(next)[0].items.length, 2);
});

test("REMOVING A BUTTON THAT IS NOT THERE IS A NO-OP, not a failure", () => {
  // Asking for something to go that is already gone is not an error.
  const { pages: next, changed } = applyAction([noBtn("index.tsx")], null, true);
  assert.deepEqual(changed, []);
  assert.equal(next[0].source, noBtn("index.tsx").source);
});

test("a tel: destination is allowed — 46 of the 288 buttons in the corpus are one", () => {
  // One destination in six is a phone number; refusing it would refuse the whole
  // conversion path for every trade whose customers ring rather than book.
  const r = readNav({ content: [{ type: "tool_use", input: { action: { label: "Call now", href: "tel:+44 113 200 0000" } } }] }, ROUTES);
  assert.deepEqual(r.action, { label: "Call now", href: "tel:+44 113 200 0000" });
});

test("a free-text tel: is refused — it is a URL scheme like any other", () => {
  for (const href of ["tel:call me", "tel:", "tel:<script>", "tel:" + "9".repeat(60)]) {
    const r = readNav({ content: [{ type: "tool_use", input: { action: { label: "Call", href } } }] }, ROUTES);
    assert.equal(r.action, undefined, href);
    assert.equal(r.dropped[0].why, "bad-number", href);
  }
});

test("a button to a page that does not exist is refused, and the reply says which", () => {
  const r = readNav({ content: [{ type: "tool_use", input: { action: { label: "Shop", href: "/shop" } } }] }, ROUTES);
  assert.equal(r.action, undefined);
  assert.equal(r.dropped[0].why, "no-such-page");
  assert.match(navReply({ links: [], dropped: r.dropped, action: null, changed: [] }), /no \/shop page/);
});

test("`action` AND `removeAction` together keeps the button", () => {
  // Being wrong toward a button that exists costs a label they can change again;
  // being wrong the other way takes their conversion button off the site.
  const r = readNav({ content: [{ type: "tool_use", input: {
    action: { label: "Book", href: "/book" }, removeAction: true } }] }, ROUTES);
  assert.deepEqual(r.action, { label: "Book", href: "/book" });
  assert.equal(r.removeAction, false);
});

test("A BUTTON-ONLY ANSWER LEAVES THE MENU ALONE", async () => {
  const pages = [withBtn("index.tsx"), withBtn("book.tsx")];
  const before = navSlots(pages).map((s) => JSON.stringify(s.items));
  const out = await runNavEdit({
    send: async () => ({ content: [{ type: "tool_use", input: { action: { label: "Get a quote", href: "/prices" } } }] }),
  }, { instruction: "point the button at prices", pages, routes: ROUTES });
  assert.equal(out.ok, true);
  assert.deepEqual(navSlots(out.pages).map((s) => JSON.stringify(s.items)), before);
  assert.equal(out.links, null);
  assert.match(out.msg, /Get a quote/);
  assert.match(out.msg, /2 pages/);
});

test("a menu change and a button change in one answer both land", async () => {
  const out = await runNavEdit({
    send: async () => ({ content: [{ type: "tool_use", input: {
      links: [{ label: "Book", href: "/book" }],
      action: { label: "Call", href: "tel:+441132000000" } } }] }),
  }, { instruction: "tidy the top", pages: [withBtn("index.tsx")], routes: ROUTES });
  assert.equal(out.ok, true);
  assert.deepEqual(navSlots(out.pages)[0].items, [{ label: "Book", href: "/book" }]);
  assert.deepEqual(actionSlots(out.pages)[0].action, { label: "Call", href: "tel:+441132000000" });
  assert.match(out.msg, /button/i);
});

test("a button that is already what was asked for reports NO change", async () => {
  const out = await runNavEdit({
    send: async () => ({ content: [{ type: "tool_use", input: { action: { label: "Book a chair", href: "/book" } } }] }),
  }, { instruction: "call it Book a chair", pages: [withBtn("index.tsx")], routes: ROUTES });
  assert.equal(out.ok, false);
  assert.equal(out.reason, "no-change");
  assert.equal(out.escalate, false);
  assert.match(out.msg, /button/i);
});

test("the digest states the button, and says so when there is none", () => {
  const pages = [withBtn("index.tsx")];
  assert.match(navDigest(navSlots(pages), ROUTES, actionSlots(pages)), /THE BUTTON AT THE TOP:\n {2}Book a chair -> \/book/);
  const bare = [noBtn("index.tsx")];
  assert.match(navDigest(navSlots(bare), ROUTES, actionSlots(bare)), /there is no button/);
});

test("a site with a header but no menu can still be reached — it does not escalate", async () => {
  // A page with a button and no links array at all: the lane can still change
  // the button, so treating "no menu" as "nothing here" would send it up the
  // ladder to a ~27-credit rewrite.
  const only = { path: "index.tsx", source: `<SiteChrome name="X" action={{ label: "Book", href: "/book" }}>{null}</SiteChrome>` };
  const out = await runNavEdit({
    send: async () => ({ content: [{ type: "tool_use", input: { action: { label: "Call", href: "tel:+441132000000" } } }] }),
  }, { instruction: "make it a call button", pages: [only], routes: ROUTES });
  assert.equal(out.ok, true);
  assert.deepEqual(actionSlots(out.pages)[0].action, { label: "Call", href: "tel:+441132000000" });
});

test("driven over every real header the generator and the exemplars wrote", () => {
  // The bar the menu had to clear, applied to the button: every one this finds
  // must be complete, and must survive being written back.
  const root = new URL("../builder/lovable/template/src/", import.meta.url).pathname;
  const pages = [];
  const walk = (dir, rel) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      const r = rel ? rel + "/" + e.name : e.name;
      if (e.isDirectory()) walk(full, r);
      else if (e.name.endsWith(".tsx")) pages.push({ path: r, source: fs.readFileSync(full, "utf8") });
    }
  };
  walk(CORPUS_DIR, "");
  walk(path.join(root, "routes"), "");

  const slots = actionSlots(pages);
  const real = slots.filter((s) => s.action);
  assert.ok(real.length > 260, "buttons were found: " + real.length);
  for (const s of real) {
    assert.ok(s.action.label, s.page);
    assert.ok(s.action.href, s.page);
  }
  // ROUND TRIP: rewriting every button with its own value must change nothing.
  for (const s of real) {
    const p = pages.find((x) => x.path === s.page);
    const { changed } = applyAction([p], s.action, false);
    // A page can hold several headers with DIFFERENT buttons; writing one value
    // into all of them is a real change, so only assert the single-slot pages.
    if (actionSlots([p]).filter((x) => x.action).length === 1) {
      assert.deepEqual(changed, [], s.page + " round-tripped to a different source");
    }
  }
});

test("the router's nav layer names the BUTTON as well as the menu", () => {
  // A capability the router cannot describe is one nothing can reach — the
  // shape twelve dead features in this repo have had.
  const src = fs.readFileSync(new URL("../builder/site-ask.mjs", import.meta.url), "utf8");
  const at = src.indexOf('"\\"nav\\" —');
  const window = src.slice(at, src.indexOf('"\\"page\\" —', at));
  assert.match(window, /THE BUTTON — what it says AND where it goes/);
  // The phone case is named explicitly: it is 46 of the 288 buttons in the
  // corpus, and for a trade it is the entire conversion path.
  assert.match(window, /phone number belongs here/);
});

test("the worker carries the button's outcome back", () => {
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = w.indexOf('ok: true, layer: "nav"');
  assert.ok(at > 0);
  const window = w.slice(at, at + 700);
  assert.match(window, /action: nOut\.action \|\| undefined/);
  assert.match(window, /removedAction: nOut\.removedAction \|\| undefined/);
});

test("two headers in one file are both written, and the offsets stay right", () => {
  // BACK TO FRONT, like the menu: each write changes the length of the source,
  // so a forward pass lands the second write in whatever moved into its offset.
  // Found by mutation — every other button test had a single slot, so the sort
  // could be inverted with the whole suite green.
  const src = {
    path: "index.tsx",
    source: `<SiteHeader brand="A" action={{ label: "Old", href: "/old" }} />\n<SiteChrome name="A" action={{ label: "Old", href: "/old" }}>x</SiteChrome>`,
  };
  const { pages: next, changed } = applyAction([src], { label: "New one", href: "/book" }, false);
  assert.deepEqual(changed, ["index.tsx"]);
  const slots = actionSlots(next);
  assert.equal(slots.length, 2);
  for (const s of slots) assert.deepEqual(s.action, { label: "New one", href: "/book" });
});

test("two headers, both removed, and nothing is left mangled", () => {
  const src = {
    path: "index.tsx",
    source: `<SiteHeader brand="A" action={{ label: "Old", href: "/old" }} />\n<SiteChrome name="A" action={{ label: "Old", href: "/old" }}>x</SiteChrome>`,
  };
  const { pages: next } = applyAction([src], null, true);
  assert.doesNotMatch(next[0].source, /action=/);
  assert.match(next[0].source, /<SiteHeader brand="A" \/>/);
  assert.match(next[0].source, /<SiteChrome name="A">x<\/SiteChrome>/);
});

test("the REQUEST shows the model the button, not just the digest in isolation", () => {
  // Testing `navDigest` directly leaves `navRequest` free to stop passing the
  // slots to it — the model would never learn a button exists, and every button
  // change would come back as an invention. Found by mutation.
  const pages = [withBtn("index.tsx")];
  const req = navRequest({
    instruction: "point the button at prices",
    slots: navSlots(pages), routes: ROUTES, actions: actionSlots(pages),
  });
  assert.match(req.messages[0].content, /THE BUTTON AT THE TOP:\n {2}Book a chair -> \/book/);
});

test("runNavEdit SENDS the button in its request", () => {
  // Every other lane test hands back a canned reply, so the request itself was
  // never looked at — `runNavEdit` could stop passing the button slots to
  // `navRequest` and the model would be asked to change something it was never
  // shown. Two mutants in a row lived in that gap.
  let sent = null;
  return runNavEdit({ send: async (req) => { sent = req; return reply([]); } }, {
    instruction: "point the button at prices", pages: [withBtn("index.tsx")], routes: ROUTES,
  }).then(() => {
    assert.ok(sent, "the lane made a request");
    assert.match(sent.messages[0].content, /THE BUTTON AT THE TOP:\n {2}Book a chair -> \/book/);
    // and the menu is still in there beside it
    assert.match(sent.messages[0].content, /THE MENU AS IT IS NOW:/);
  });
});

// ── EVERY LINK WRITTEN INTO THE PAGES ───────────────────────────────────────
//
// Measured over the 337 pages the generator learns from and writes: 600 links
// live in the chrome — the menu and the button, both already site-wide editable
// — and 469 live in the page bodies, where the only lane that could touch one
// was `page`: one page, one model call, for a destination.

const body = (p, inner) => ({
  path: p,
  source: `export default function P() {\n  return (\n    <SiteChrome name="Cutler Row" links={[${NAV}]}>\n${inner}\n    </SiteChrome>\n  );\n}\n`,
});

test("linkSlots reads a plain anchor, and names it by its own words", () => {
  const slots = linkSlots([body("index.tsx", `      <a href="/contact">Send an enquiry</a>`)]);
  assert.equal(slots.length, 1);
  assert.equal(slots[0].href, "/contact");
  assert.equal(slots[0].label, "Send an enquiry");
  assert.equal(slots[0].typed, false);
});

test("a <Link to> and a <SiteLink to> are found, and marked TYPED", () => {
  // The distinction decides what may be written back: both are checked against
  // the route tree the container generates, so an anchor or a `tel:` there is a
  // build that FAILS rather than a link that degrades.
  const slots = linkSlots([body("index.tsx",
    `      <Link to="/book">Book now</Link>\n      <SiteLink to="/prices">Prices</SiteLink>`)]);
  assert.deepEqual(slots.map((s) => [s.tag, s.href, s.typed]),
    [["Link", "/book", true], ["SiteLink", "/prices", true]]);
});

test("A LINK QUOTED IN A COMMENT IS NOT A LINK", () => {
  // The template's own prose quotes `<Link to="/book">` while explaining the
  // convention, and a scan that reads it offers the customer a link that does
  // not exist. Found by looking at real matches before writing a line of this.
  const slots = linkSlots([body("index.tsx",
    `      {/* always write <Link to="/gone">Old thing</Link> rather than an anchor */}\n      <a href="/contact">Real one</a>`)]);
  assert.deepEqual(slots.map((s) => s.href), ["/contact"]);
});

test("blanking a comment PRESERVES LENGTH, so every offset stays valid", () => {
  // Removing them instead shifts every index after the comment, and the write
  // lands in whatever moved into it. The recurring bug this repo has recorded
  // three times: strip by blanking, never by removing.
  const src = body("index.tsx",
    `      // point it at /old one day\n      <a href="/contact">Enquire</a>`);
  const slots = linkSlots([src]);
  assert.equal(slots.length, 1);
  assert.equal(src.source.slice(slots[0].at, slots[0].to), "/contact");
});

test("THE MENU AND THE BUTTON ARE NOT BODY LINKS — they are object literals", () => {
  // No href may be owned by two scanners: two lanes rewriting one is two things
  // that can disagree about where it points. It holds by construction rather
  // than by an exclusion — the menu is an array of `{label, href}` objects and
  // the button is one object, so neither can hold a JSX link tag.
  const src = {
    path: "index.tsx",
    source: `const CHROME = { links: [{ label: "Book", href: "/book" }], action: { label: "Call", href: "tel:+441134960000" } };\nexport default function P() {\n  return (\n    <SiteChrome {...CHROME}>\n      <a href="/contact">Enquire</a>\n    </SiteChrome>\n  );\n}\n`,
  };
  assert.deepEqual(linkSlots([src]).map((s) => s.href), ["/contact"]);
});

test("A JSX-VALUED CHROME PROP IS A BODY LINK, because nothing else can reach it", () => {
  // The first draft skipped everything syntactically inside a `<SiteChrome>`
  // tag. Measured, that excluded ZERO of the corpus's 458 body links and was
  // WRONG in the one shape it could fire on: `navSlots` only reads arrays of
  // `{label, href}` and `actionSlots` only one object, so a link written as JSX
  // here is reachable by neither — skipping it made it editable by nothing.
  const src = {
    path: "index.tsx",
    source: `<SiteChrome name="A" links={[${NAV}]} footer={<a href="/terms">Terms</a>}>\n  <a href="/c">Enquire</a>\n</SiteChrome>`,
  };
  assert.deepEqual(linkSlots([src]).map((s) => s.href), ["/terms", "/c"]);
  // AND THE MENU BESIDE IT IS STILL THE MENU'S, which is the property that
  // exclusion was reaching for and that this must not cost.
  assert.deepEqual(navSlots([src])[0].items.map((i) => i.href), ["/prices", "/book"]);
});

test("a computed destination is skipped rather than guessed at", () => {
  const slots = linkSlots([body("index.tsx",
    `      <Link to={route}>Dynamic</Link>\n      <a href="/ok">Fine</a>`)]);
  assert.deepEqual(slots.map((s) => s.href), ["/ok"]);
});

test("nested markup inside a link is dropped from its words", () => {
  const slots = linkSlots([body("index.tsx",
    `      <a href="/book"><span className="x">Book</span> now</a>`)]);
  assert.equal(slots[0].label, "Book now");
});

test("a link with no closing tag in reach gets no words rather than swallowing the page", () => {
  const slots = linkSlots([{ path: "index.tsx", source: `<a href="/x">` + "y".repeat(600) }]);
  assert.equal(slots.length, 1);
  assert.equal(slots[0].label, "");
});

test("a page with no source or no path is skipped rather than throwing", () => {
  assert.deepEqual(linkSlots([null, { path: "a.tsx" }, { source: "<a href='/x'>y</a>" }]), []);
  assert.deepEqual(linkSlots(null), []);
});

// ── WHICH LINKS A CHANGE NAMES ──────────────────────────────────────────────

const MANY = [
  { page: "index.tsx", label: "Book now", href: "/book", typed: false },
  { page: "about.tsx", label: "Book now", href: "/classes", typed: false },
  { page: "about.tsx", label: "Prices", href: "/prices", typed: true },
];

test("matched on the words, which is how a customer refers to a link", () => {
  assert.deepEqual(matchLinks(MANY, { label: "Book now", to: "/x" }).map((s) => s.href),
    ["/book", "/classes"]);
});

test("matched on the destination, which is how they refer to a SET of them", () => {
  assert.deepEqual(matchLinks(MANY, { from: "/classes", to: "/x" }).map((s) => s.page), ["about.tsx"]);
});

test("GIVEN BOTH, BOTH MUST MATCH — that is what tells two identical labels apart", () => {
  const hit = matchLinks(MANY, { label: "Book now", from: "/classes", to: "/x" });
  assert.deepEqual(hit.map((s) => s.page), ["about.tsx"]);
});

test("A CHANGE THAT NAMES NEITHER MATCHES NOTHING", () => {
  // An entry carrying only a destination to move TO is a model that answered the
  // field and not the question, and applying it to every link on the site is the
  // single most destructive thing this lane could do.
  assert.deepEqual(matchLinks(MANY, { to: "/everywhere" }), []);
});

test("the words are matched case- and space-insensitively, because a customer types them", () => {
  assert.equal(matchLinks(MANY, { label: "  book NOW ", to: "/x" }).length, 2);
});

// ── WRITING THEM BACK ───────────────────────────────────────────────────────

test("applyPageLinks repoints one link across every page that carries it", () => {
  const pages = [
    body("index.tsx", `      <a href="/contact">Enquire</a>`),
    body("about.tsx", `      <a href="/contact">Enquire</a>`),
  ];
  const out = applyPageLinks(pages, [{ label: "Enquire", to: "/book" }], ["/", "/about", "/book", "/contact"]);
  assert.equal(out.moved, 2);
  assert.deepEqual(out.changed, ["index.tsx", "about.tsx"]);
  for (const p of out.pages) assert.match(p.source, /href="\/book"/);
});

test("two links in one file are both written, and the offsets stay right", () => {
  // BACK TO FRONT, like the menu and the button: each write changes the length
  // of the source, so a forward pass lands the second write in whatever moved
  // into its offset. The first link is repointed to a LONGER path deliberately.
  const pages = [body("index.tsx",
    `      <a href="/c">One</a>\n      <a href="/c">Two</a>`)];
  const out = applyPageLinks(pages, [{ label: "One", from: "/c", to: "/a-much-longer-path" },
    { label: "Two", from: "/c", to: "/b" }], ["/", "/a-much-longer-path", "/b", "/c"]);
  assert.equal(out.moved, 2);
  const slots = linkSlots(out.pages);
  assert.deepEqual(slots.map((s) => [s.label, s.href]),
    [["One", "/a-much-longer-path"], ["Two", "/b"]]);
});

test("A TYPED LINK IS REFUSED WHEN THE DESTINATION IS NOT A PAGE — and the plain one beside it still goes", () => {
  // `<Link to>` is checked against the generated route tree, so an anchor there
  // is a build that fails and a customer left with the site they had plus a bill.
  const pages = [body("index.tsx",
    `      <Link to="/book">Go</Link>\n      <a href="/book">Go</a>`)];
  const out = applyPageLinks(pages, [{ label: "Go", to: "/#form" }], ["/", "/book"]);
  assert.equal(out.moved, 1);
  assert.equal(out.refused.length, 1);
  assert.equal(out.refused[0].why, "typed-needs-page");
  const slots = linkSlots(out.pages);
  assert.deepEqual(slots.map((s) => [s.tag, s.href]), [["Link", "/book"], ["a", "/#form"]]);
});

test("a destination that is not usable at all refuses the whole change", () => {
  const pages = [body("index.tsx", `      <a href="/book">Go</a>`)];
  const out = applyPageLinks(pages, [{ label: "Go", to: "/nowhere" }], ["/", "/book"]);
  assert.deepEqual(out.changed, []);
  assert.equal(out.refused[0].why, "no-such-page");
});

test("a link that already points there is not a change", () => {
  // Republishing every page to write back the bytes already there costs a
  // container run and archives a version describing a change that did not happen.
  const pages = [body("index.tsx", `      <a href="/book">Go</a>`)];
  const out = applyPageLinks(pages, [{ label: "Go", to: "/book" }], ["/", "/book"]);
  assert.equal(out.moved, 0);
  assert.deepEqual(out.changed, []);
});

test("words that name no link on the site are refused and named", () => {
  const pages = [body("index.tsx", `      <a href="/book">Go</a>`)];
  const out = applyPageLinks(pages, [{ label: "Nope", to: "/book" }], ["/", "/book"]);
  assert.equal(out.refused[0].why, "no-such-link");
  assert.match(linkRefusal(out.refused), /couldn.t find a link saying/);
});

test("an entry with nowhere to go is skipped rather than clearing the href", () => {
  const pages = [body("index.tsx", `      <a href="/book">Go</a>`)];
  const out = applyPageLinks(pages, [{ label: "Go", to: "" }, { label: "Go", to: "   " }], ["/", "/book"]);
  assert.deepEqual(out.changed, []);
  assert.match(out.pages[0].source, /href="\/book"/);
});

test("a tel: destination is allowed on a body link, like the button", () => {
  const pages = [body("index.tsx", `      <a href="/contact">Ring us</a>`)];
  const out = applyPageLinks(pages, [{ label: "Ring us", to: "tel:+441134960000" }], ["/", "/contact"]);
  assert.equal(out.moved, 1);
  assert.match(out.pages[0].source, /href="tel:\+441134960000"/);
});

test("the three refusals are three different sentences, because they are three next steps", () => {
  const said = ["no-such-link", "typed-needs-page", "no-such-page"]
    .map((why) => linkRefusal([{ label: "Go", to: "/x", why }]));
  assert.equal(new Set(said).size, 3, said.join(" | "));
  assert.equal(linkRefusal([]), "");
  assert.equal(linkRefusal(null), "");
});

// ── READING THE ANSWER ──────────────────────────────────────────────────────

const linkReply = (pageLinks) => ({ content: [{ type: "tool_use", input: { pageLinks } }] });

test("readNav keeps a well-formed link change", () => {
  const r = readNav(linkReply([{ label: "Enquire", to: "/book" }]), ROUTES);
  assert.deepEqual(r.pageLinks, [{ label: "Enquire", from: "", to: "/book" }]);
});

test("AN ENTRY WITH NEITHER WORDS NOR A CURRENT DESTINATION IS DROPPED", () => {
  // It is a model that answered the field and not the question; applied, it
  // would repoint every link on the site.
  const r = readNav(linkReply([{ to: "/book" }]), ROUTES);
  assert.deepEqual(r.pageLinks, []);
  assert.equal(r.dropped[0].why, "incomplete");
});

test("an entry with nowhere to go is dropped", () => {
  const r = readNav(linkReply([{ label: "Enquire" }]), ROUTES);
  assert.deepEqual(r.pageLinks, []);
});

test("a non-string label or destination is refused rather than coerced", () => {
  // `String(["/a","/b"])` is "/a,/b" — the coercion bug this repo has recorded
  // on `normalizeRole` and on a table's `access`.
  const r = readNav(linkReply([{ label: ["a", "b"], to: ["/a", "/b"] }, "nope", null]), ROUTES);
  assert.deepEqual(r.pageLinks, []);
});

test("the number of link changes in one instruction is bounded", () => {
  const many = Array.from({ length: MAX_LINK_CHANGES + 5 }, (_, i) => ({ label: "L" + i, to: "/book" }));
  assert.equal(readNav(linkReply(many), ROUTES).pageLinks.length, MAX_LINK_CHANGES);
});

test("A LINK-ONLY ANSWER IS NOT 'NO ANSWER' — it used to return null", () => {
  // The same shape as the button: `readNav` returning null threw away an answer
  // that named no menu, so a customer asking only about a link in the copy was
  // told "I couldn't work out what the menu should be" about a menu they never
  // mentioned.
  const r = readNav(linkReply([{ label: "Enquire", to: "/book" }]), ROUTES);
  assert.ok(r, "a links-only answer is an answer");
  assert.equal(r.links, null, "and it says nothing about the menu");
});

// ── WHAT THE MODEL IS SHOWN ─────────────────────────────────────────────────

test("the digest lists the links by their words, grouped, with a page count", () => {
  // A customer names a link by its words, and the same words on four pages are
  // ONE link to them rather than four.
  const pages = [body("index.tsx", `      <a href="/contact">Enquire</a>`),
    body("about.tsx", `      <a href="/contact">Enquire</a>`)];
  const d = navDigest(navSlots(pages), ROUTES, [], linkSlots(pages));
  assert.match(d, /LINKS INSIDE THE PAGES/);
  assert.match(d, /“Enquire” -> \/contact {2}\(on 2 pages\)/);
});

test("A TYPED LINK IS MARKED, so the model does not ask for a change that gets refused", () => {
  const pages = [body("index.tsx", `      <Link to="/book">Book now</Link>`)];
  const d = navDigest(navSlots(pages), ROUTES, [], linkSlots(pages));
  assert.match(d, /“Book now” -> \/book {2}\[must point at a page of this site\]/);
});

test("a site with no links in the copy gets no block at all", () => {
  const d = navDigest(navSlots([page("index.tsx", NAV)]), ROUTES, [], []);
  assert.doesNotMatch(d, /LINKS INSIDE THE PAGES/);
});

test("the digest's link list is bounded", () => {
  const links = Array.from({ length: MAX_LINK_LINES + 20 }, (_, i) => ({ label: "L" + i, href: "/p" + i, typed: false }));
  const d = navDigest([], ROUTES, [], links);
  assert.equal(d.split("\n").filter((l) => l.startsWith("  “")).length, MAX_LINK_LINES);
});

// ── THE LANE ────────────────────────────────────────────────────────────────

test("runNavEdit SENDS the links in its request", () => {
  // Every other lane test hands back a canned reply, so the request itself was
  // never looked at — `runNavEdit` could stop passing the link slots to
  // `navRequest` and the model would be asked to change something it was never
  // shown. Two mutants in a row have lived in exactly that gap.
  let sent = null;
  const pages = [body("index.tsx", `      <a href="/contact">Enquire</a>`)];
  return runNavEdit({ send: async (req) => { sent = req; return linkReply([]); } }, {
    instruction: "point the enquiry link at the booking page", pages, routes: ROUTES,
  }).then(() => {
    assert.match(sent.messages[0].content, /“Enquire” -> \/contact/);
  });
});

test("a links-only change goes through and reports how many moved", () => {
  const pages = [body("index.tsx", `      <a href="/contact">Enquire</a>`),
    body("about.tsx", `      <a href="/contact">Enquire</a>`)];
  return runNavEdit({ send: async () => linkReply([{ label: "Enquire", to: "/book" }]) }, {
    instruction: "send the enquiry link to booking", pages, routes: ROUTES,
  }).then((out) => {
    assert.equal(out.ok, true);
    assert.equal(out.movedLinks, 2);
    assert.deepEqual(out.changed, ["index.tsx", "about.tsx"]);
    assert.match(out.msg, /Repointed 2 links across 2 pages/);
    // AND IT SAYS NOTHING ABOUT THE MENU, which did not change.
    assert.doesNotMatch(out.msg, /menu/i);
  });
});

test("A SITE WITH LINKS IN THE COPY AND NO CHROME AT ALL IS STILL THIS LANE'S WORK", () => {
  // Escalating spends a ~27-credit rewrite to do what this does for one Haiku
  // call. Nothing to edit is the only thing that escalates.
  const pages = [{ path: "index.tsx", source: `<a href="/contact">Enquire</a>` }];
  return runNavEdit({ send: async () => linkReply([{ label: "Enquire", to: "/book" }]) }, {
    instruction: "x", pages, routes: ROUTES,
  }).then((out) => {
    assert.equal(out.ok, true);
    assert.equal(out.movedLinks, 1);
  });
});

test("a site with nothing to edit at all still escalates", () => {
  return runNavEdit({ send: async () => linkReply([]) }, {
    instruction: "x", pages: [{ path: "index.tsx", source: "export default () => <h1>Hi</h1>;" }], routes: ROUTES,
  }).then((out) => {
    assert.equal(out.escalate, true);
    assert.equal(out.reason, "no-nav");
  });
});

test("A REFUSED LINK IS NOT REPORTED AS A SUCCESS", () => {
  // The one shape this lane must not have: the customer told a link moved when
  // it did not.
  const pages = [body("index.tsx", `      <a href="/book">Go</a>`)];
  return runNavEdit({ send: async () => linkReply([{ label: "Nope", to: "/book" }]) }, {
    instruction: "x", pages, routes: ROUTES,
  }).then((out) => {
    assert.equal(out.ok, false);
    assert.equal(out.reason, "no-change");
    assert.match(out.msg, /couldn.t find a link saying “Nope”/);
  });
});

test("a menu change and a link change in one instruction both land, and both are said", () => {
  const pages = [body("index.tsx", `      <a href="/contact">Enquire</a>`)];
  return runNavEdit({
    send: async () => ({
      content: [{ type: "tool_use", input: {
        links: [{ label: "Book", href: "/book" }],
        pageLinks: [{ label: "Enquire", to: "/book" }],
      } }],
    }),
  }, { instruction: "x", pages, routes: ROUTES }).then((out) => {
    assert.equal(out.ok, true);
    assert.match(out.msg, /Updated the menu/);
    assert.match(out.msg, /1 link in the copy repointed too/);
  });
});

// ── THE WIRING, WHICH IS WHERE TWELVE FEATURES HAVE DIED ─────────────────────

test("the router's nav layer names the links in the copy", () => {
  // A capability the router cannot describe is one nothing can reach.
  const src = fs.readFileSync(new URL("../builder/site-ask.mjs", import.meta.url), "utf8");
  const at = src.indexOf('"\\"nav\\" —');
  const window = src.slice(at, src.indexOf('"\\"page\\" —', at));
  assert.match(window, /LINKS WRITTEN INTO THE PAGES/);
});

test("the worker carries the links' outcome back", () => {
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = w.indexOf('ok: true, layer: "nav"');
  assert.ok(at > 0);
  const window = w.slice(at, w.indexOf("cost: await eCharge", at));
  assert.match(window, /movedLinks: nOut\.movedLinks/);
  assert.match(window, /refusedLinks: nOut\.refusedLinks/);
});

test("driven over every page the generator learns from: not one false link", () => {
  // THE BAR EVERY NEW RULE HERE HAS TO CLEAR. A structural editor is only
  // allowed if it is right about real pages — the same corpus the menu and the
  // button were calibrated against.
  const root = new URL("../builder/lovable/template/src/", import.meta.url).pathname;
  const pages = [];
  const walk = (dir, rel) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      const r = rel ? rel + "/" + e.name : e.name;
      if (e.isDirectory()) walk(full, r);
      else if (e.name.endsWith(".tsx")) pages.push({ path: r, source: fs.readFileSync(full, "utf8") });
    }
  };
  walk(CORPUS_DIR, "");
  walk(path.join(root, "routes"), "");
  assert.ok(pages.length > 300, "the corpus was found: " + pages.length);

  const slots = linkSlots(pages);
  // The floor first: a scan that silently stopped matching would report a clean
  // corpus and prove nothing. Measured: 458 body links across the 329 pages.
  assert.ok(slots.length > 400, "body links were found: " + slots.length);
  // AND THE CAP MUST NOT BE BINDING HERE. It is a runaway guard, not a display
  // bound — the corpus sat at exactly 400 under the old number, which is a
  // silent truncation of the APPLY wearing the shape of a clean run.
  assert.ok(slots.length < MAX_LINK_SLOTS, "the cap is not what stopped the scan");

  // NAMED BY THEIR WORDS, which is the whole handle a customer has on one.
  // Measured: 8 of 458 have none, every one of them a link inside a `.map()`
  // whose words are `{item.title}` — computed, so there is nothing to read.
  // Those degrade honestly: they can be matched by destination and not by name.
  const unnamed = slots.filter((s) => !s.label);
  assert.ok(unnamed.length < 20, "nearly every link has readable words: " + unnamed.length);
  // AND THE TYPED FORM IS REALLY EXERCISED. Without one in a real corpus the
  // `typed` half of this is calibrated against hand-written fixtures alone.
  //
  // READ OFF THE GENERATOR'S PAGES RATHER THAN THE KIT'S, and the move is the
  // point rather than a convenience. This walk covers `template/src/routes`,
  // and until 2026-08-30 that is where the typed links came from — but a KIT
  // file may no longer name a route with a literal `<Link to="…">` at all. A
  // generated page that declares required search params retypes the route and
  // breaks any such link in a file the model never saw, which killed a paid
  // build (run 82; see test/template-links.test.mjs, which now forbids it).
  //
  // So the kit having none is the fix working, not the corpus thinning out.
  // Typed links remain correct — and common — in a GENERATED page, which is
  // told in as many words to link between its own pages with `<Link to="/menu">`
  // and is the only author that knows its own search contract. That is where
  // the `typed` branch is calibrated from now.
  const genPages = [];
  for (const site of fs.readdirSync(GENERATED_DIR)) {
    const sd = path.join(GENERATED_DIR, site);
    if (!fs.statSync(sd).isDirectory()) continue;
    for (const f of fs.readdirSync(sd).filter((f) => f.endsWith(".tsx"))) {
      genPages.push({ path: site + "/" + f, source: fs.readFileSync(path.join(sd, f), "utf8") });
    }
  }
  const genSlots = linkSlots(genPages);
  assert.ok(genSlots.length > 0, "no body links in the generated corpus — this scan has drifted and proves nothing");
  assert.ok(genSlots.some((s) => s.typed), "the generated corpus carries a typed link");
  // AND THE KIT REALLY HAS NONE, so the sentence above is a measurement rather
  // than an excuse. If a literal link returns to the kit this says so here too,
  // not only in template-links.test.mjs.
  assert.ok(!slots.some((s) => s.typed),
    "a kit page names a route with a typed link again — see test/template-links.test.mjs for what that costs");

  for (const s of slots) {
    // EVERY SLOT MUST BE A REAL WRITE POINT. The recorded offsets are what get
    // rewritten, so one that does not hold the href it claims corrupts a page.
    const src = pages.find((p) => p.path === s.page).source;
    assert.equal(src.slice(s.at, s.to), s.href, s.page + " " + s.href);
  }

  // AND NOT ONE HREF IS OWNED BY TWO SCANNERS. This is the property the deleted
  // chrome exclusion was standing in for, asserted directly against every span
  // the other two lanes really rewrite — 306 menus and 306 buttons against 458
  // body links, zero overlaps. A link claimed by two lanes is two things that
  // can disagree about where it points.
  const owned = new Map();
  const claim = (s) => {
    if (s.at == null) return;
    if (!owned.has(s.page)) owned.set(s.page, []);
    owned.get(s.page).push([s.at, s.to]);
  };
  navSlots(pages).forEach(claim);
  actionSlots(pages).forEach(claim);
  assert.ok(owned.size > 90, "the other two scanners found their spans: " + owned.size);
  for (const l of slots) {
    for (const [a, b] of owned.get(l.page) || []) {
      assert.ok(l.at < a || l.at > b, l.page + " " + l.href + " is claimed by two lanes");
    }
  }
});

test("driven over the only pages in this repo the GENERATOR wrote", () => {
  // The exemplars are pages WE wrote, in the house style, so a rule tuned on
  // them is tuned to us. These are committed eval output.
  const dir = GENERATED_DIR;
  const sites = fs.readdirSync(dir).filter((d) => fs.statSync(path.join(dir, d)).isDirectory());
  let found = 0;
  for (const site of sites) {
    const files = fs.readdirSync(path.join(dir, site)).filter((f) => f.endsWith(".tsx"));
    const pages = files.map((f) => ({ path: f, source: fs.readFileSync(path.join(dir, site, f), "utf8") }));
    for (const s of linkSlots(pages)) {
      found++;
      const src = pages.find((p) => p.path === s.page).source;
      assert.equal(src.slice(s.at, s.to), s.href, site + "/" + s.page);
    }
  }
  assert.ok(found >= 5, "body links were found in the generated samples: " + found);
});

// ── A COMPUTED BUTTON IS REPLACED, NEVER DOUBLED ──────────────────────────
//
// Found 2026-09-02 by driving `applyAction` over the 332-page corpus and parsing
// every result with TypeScript: one page, `marketplace/index.tsx`, whose button
// is `label: buying ? "Browse everything" : "Start selling"`. `readAction`
// answers null for a computed label, the writer read that null as "no button
// yet", and the insertion branch sliced at an `insertAt` the slot does not have
// — `src.slice(0, undefined)` is the whole file, so the page came back as
// itself, then the attribute, then itself again. fretwork-1's header has the
// same shape, and its `action` lane died twice with "Unexpected token (181:9)":
// line 181 being the first line after the page's last.
const computedBtn = (p) => ({
  path: p,
  source: `const buying = true;\nexport default function P() {\n  return (\n    <SiteChrome name="Made Round Here" links={[${NAV}]}\n      action={{ label: buying ? "Browse everything" : "Start selling", href: buying ? "/browse" : "/sell" }}>\n      <h1>Hi</h1>\n    </SiteChrome>\n  );\n}\n`,
});

test("a computed button is a slot with no readable action, marked so", () => {
  const slots = actionSlots([computedBtn("index.tsx")]);
  assert.equal(slots.length, 1);
  assert.equal(slots[0].action, null);
  assert.equal(slots[0].computed, true, "a computed button must say it is computed, not look like an absence");
  assert.ok(slots[0].inner && slots[0].inner.at > 0, "the existing attribute's span is what makes it replaceable");
  assert.equal(actionSlots([noBtn("index.tsx")])[0].computed, undefined, "a header with no button is not computed");
});

test("changing a computed button replaces it in place, and the file is not doubled", () => {
  const before = computedBtn("index.tsx");
  const { pages: next, changed } = applyAction([before], { label: "Book a free lesson", href: "/book" }, false);
  assert.deepEqual(changed, ["index.tsx"]);
  const src = next[0].source;
  assert.equal((src.match(/export default function/g) || []).length, 1, "the page was doubled");
  assert.ok(src.length < before.source.length + 80, "the page grew by more than the attribute");
  assert.deepEqual(actionSlots(next)[0].action, { label: "Book a free lesson", href: "/book" });
  assert.ok(!/buying \?/.test(src), "the expression is gone — replaced, not appended");
  // And a removal takes the computed attribute away whole.
  const gone = applyAction([before], null, true).pages[0].source;
  assert.ok(!/action=/.test(gone), "the computed button was not removed");
  assert.equal((gone.match(/export default function/g) || []).length, 1);
});

test("applyAction over the whole corpus never writes a page TypeScript cannot parse", () => {
  // THE MEASUREMENT THAT FOUND THE BUG, kept as the guard. The kit's own
  // TypeScript parses every result; a syntax error that was not there before is
  // a writer that broke a page.
  // THE KIT'S TYPESCRIPT WHERE THE KIT IS INSTALLED, THE ROOT'S EVERYWHERE
  // ELSE (2026-09-02). This required the template's copy and nothing else,
  // and CI's `npm ci` installs the ROOT's dependencies only — so `unit tests`
  // went red on every push to main the day this guard shipped, four runs,
  // none read until a fifth push looked. The recorded trap ("a CI step that
  // does not install what the tests import"), on the guard written the same
  // day as the fix for it. `typescript` is a root devDependency now, at the
  // version the template resolves, and the guard takes either — it still
  // REFUSES to skip, because a corpus scan that never runs in CI proves
  // nothing there.
  const req = createRequire(new URL("../builder/lovable/template/package.json", import.meta.url));
  let ts = null;
  try { ts = req("typescript"); } catch { ts = null; }
  if (!ts) { try { ts = createRequire(import.meta.url)("typescript"); } catch { ts = null; } }
  assert.ok(ts, "neither the kit's nor the root's TypeScript is installed — this guard cannot run");
  const errs = (src) => (ts.transpileModule(src, { reportDiagnostics: true, fileName: "x.tsx", compilerOptions: { jsx: ts.JsxEmit.Preserve } }).diagnostics || []).length;
  let checked = 0, broke = [];
  for (const site of fs.readdirSync(CORPUS_DIR)) {
    const sd = path.join(CORPUS_DIR, site);
    if (!fs.statSync(sd).isDirectory()) continue;
    const pages = fs.readdirSync(sd).filter((f) => f.endsWith(".tsx")).map((f) => ({ path: f, source: fs.readFileSync(path.join(sd, f), "utf8") }));
    const before = new Map(pages.map((p) => [p.path, errs(p.source)]));
    const out = applyAction(pages, { label: "Book a free lesson", href: "/book" }, false);
    for (const p of out.pages) {
      if (!out.changed.includes(p.path)) continue;
      checked++;
      if (errs(p.source) && !before.get(p.path)) broke.push(site + "/" + p.path);
    }
  }
  assert.ok(checked >= 200, "the corpus scan found only " + checked + " pages with a button — the scan has drifted");
  assert.deepEqual(broke, [], "applyAction broke these pages");
});

// ── A COMPUTED BUTTON IS DESCRIBED BY ITS HALVES, NEVER AS ABSENT ──────────
//
// Live, 2026-09-02, the seventh sweep: fretwork-1's header button has computed
// words and a literal `tel:+441144960123`. `readAction` answers null for the
// whole button, the digest said "(there is no button)", and the model asked to
// change the WORDS wrote a new button and had to invent its link — "/". The
// page's one working control became a link to itself on a request about
// wording. The slot now carries each half as it stands (`known`), and the
// digest states them, so the half they did not ask about is there to copy.
const halfBtn = (p) => ({
  path: p,
  source: `const open = true;\nexport default function P() {\n  return (\n    <SiteChrome name="Crookes" links={[${NAV}]}\n      action={{ label: open ? "Your first lesson is free" : "Lessons", href: "tel:+441144960123" }}>\n      <h1>Hi</h1>\n    </SiteChrome>\n  );\n}\n`,
});

test("a computed button's slot carries the halves that are plain text", () => {
  const [s] = actionSlots([halfBtn("index.tsx")]);
  assert.equal(s.action, null, "the whole button must still read as unreadable to the writer");
  assert.deepEqual(s.known, { label: null, href: "tel:+441144960123" }, "the literal link is not carried beside the computed words");
  const [both] = actionSlots([computedBtn("index.tsx")]);
  assert.deepEqual(both.known, { label: null, href: null }, "two computed halves are not both null");
  const [plain] = actionSlots([withBtn("index.tsx")]);
  assert.deepEqual(plain.known, plain.action, "a readable button's halves must equal its action");
});

test("the digest states a computed button's halves and never calls it absent", () => {
  const pages = [halfBtn("index.tsx")];
  const d = navDigest(navSlots(pages), ROUTES, actionSlots(pages));
  assert.match(d, /THE BUTTON AT THE TOP:\n {2}\(its words are worked out on the page\) -> tel:\+441144960123/, "the digest does not show the literal link beside the computed words");
  assert.doesNotMatch(d, /there is no button/, "a computed button is reported as no button");
  assert.match(d, /Keep the half they did not ask about/, "the model is not told to keep the other half");
  // Both halves computed: both said so, still not absent.
  const both = navDigest(navSlots([computedBtn("index.tsx")]), ROUTES, actionSlots([computedBtn("index.tsx")]));
  assert.match(both, /\(its words are worked out on the page\) -> \(its link is worked out on the page\)/);
  // And a readable button reads exactly as before.
  const plain = navDigest(navSlots([withBtn("index.tsx")]), ROUTES, actionSlots([withBtn("index.tsx")]));
  assert.match(plain, /THE BUTTON AT THE TOP:\n {2}Book a chair -> \/book/);
  assert.doesNotMatch(plain, /worked out on the page/);
});

test("the object form of the button carries its known halves too", () => {
  // The same header written as a config object rather than a JSX prop — the
  // second shape `actionSlots` reads — must carry `known` the same way, or a
  // site built in that shape keeps losing its link. Caught by a mutation
  // sweep: the JSX guard above left this branch unobserved.
  const objBtn = {
    path: "index.tsx",
    source: `const open = true;\nconst CHROME = {\n  name: "Crookes",\n  action: { label: open ? "Your first lesson is free" : "Lessons", href: "tel:+441144960123" },\n};\nexport default function P() { return <SiteChrome {...CHROME} />; }\n`,
  };
  const [s] = actionSlots([objBtn]);
  assert.equal(s.kind, "obj");
  assert.equal(s.action, null);
  assert.deepEqual(s.known, { label: null, href: "tel:+441144960123" }, "the object form does not carry the literal link");
  const d = navDigest([], ROUTES, actionSlots([objBtn]));
  assert.match(d, /\(its words are worked out on the page\) -> tel:\+441144960123/);
  assert.doesNotMatch(d, /there is no button/);
});
