import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  navSlots, parseNavItems, renderNav, applyNav, readNav, navDigest,
  navRequest, navUsage, navReply, runNavEdit, NAV_TOOL, NAV_MODEL,
  MAX_NAV_ITEMS, MAX_LABEL,
  actionSlots, applyAction,
} from "../builder/site-nav.mjs";
import { EDIT_LAYERS } from "../builder/site-ask.mjs";

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
  assert.match(window, /THE TOP OF EVERY PAGE/);
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
  assert.match(window, /await recompileAndPublish\(env, \{/);
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
  walk(path.join(root.pathname, "family-pages"), "");
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
  const dir = new URL("../docs/auth-audit/pages/", import.meta.url).pathname;
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
  walk(path.join(root, "family-pages"), "");
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
