import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  navSlots, parseNavItems, renderNav, applyNav, readNav, navDigest,
  navRequest, navUsage, navReply, runNavEdit, NAV_TOOL, NAV_MODEL,
  MAX_NAV_ITEMS, MAX_LABEL,
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

test("an in-page anchor is allowed — PAGE_RULES blesses them and the corpus is full of them", () => {
  const r = readNav(reply([{ label: "Prices", href: "#prices" }]), ROUTES);
  assert.deepEqual(r.links, [{ label: "Prices", href: "#prices" }]);
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
  const many = readNav(reply(Array.from({ length: 40 }, (_, i) => ({ label: "L" + i, href: "#a" + i }))), ROUTES);
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
  assert.match(d, /RETURN AN EMPTY ARRAY IF THIS IS NOT A CHANGE TO THE MENU/);
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
  assert.match(window, /MENU AT THE TOP OF EVERY PAGE/);
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
