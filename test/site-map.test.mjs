// THE ONE SITE MAP (2026-10-26): builder/site-map.mjs, its slices, the text
// step's reach into shared parts, and the worker's save/restore wiring.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSiteMap, mapFor, factKind, quotedElsewhere, partsImported, mapKey, mapVersionKey } from "../builder/site-map.mjs";
import { runTextEdit, scopedText, textItems } from "../builder/site-apply.mjs";
import { routeInventory } from "../builder/route-inventory.mjs";

const pages = [
  { path: "index.tsx", source: `import { Footer } from "@/routes/-parts/footer";\nexport default function P(){return <main><h1>Fold Lane Bakery</h1><p>Sourdough loaf £4.50</p><Footer/></main>}` },
  { path: "contact.tsx", source: `import { Footer } from "@/routes/-parts/footer";\nexport default function P(){return <main><h1>Contact us</h1><p>Write to us any time.</p><a href="mailto:hi@fold.test">Email</a><Footer/></main>}` },
];
const parts = [{ name: "footer", source: `export function Footer(){return <footer><p>Mon–Fri 8am–4pm</p><p>12 Mill Lane, Leeds LS1 4AB</p><p>0113 496 0123</p></footer>}` }];
const spec = { tables: [{ name: "orders", columns: [{ name: "id", notnull: true }, { name: "email", notnull: true, type: "text" }, { name: "note" }, { name: "status", notnull: true, default: "'new'" }] }] };
const map = () => buildSiteMap({ pages, parts, spec, css: ":root{--primary: #222;} body{font-family:'Inter',sans-serif}", version: "v1" });

test("key facts carry every place they are written, and a footer part's facts are shared on every page", () => {
  const m = map();
  const hours = m.facts.find((f) => f.kind === "hours");
  assert.ok(hours, "hours found");
  assert.equal(hours.text, "Mon–Fri 8am–4pm");
  assert.deepEqual(hours.at.map((a) => a.file), ["-parts/footer.tsx"]);
  assert.deepEqual(hours.routes.sort(), ["/", "/contact"]);
  assert.equal(hours.shared, true);
  assert.equal(hours.everyPage, true);
  assert.ok(m.facts.some((f) => f.kind === "phone" && f.text === "0113 496 0123"));
  assert.ok(m.facts.some((f) => f.kind === "address"));
  assert.ok(m.facts.some((f) => f.kind === "email" && f.text === "hi@fold.test" && f.routes.join() === "/contact" && f.shared === false));
  assert.ok(m.facts.some((f) => f.kind === "price" && f.text.includes("£4.50")));
});

test("pages, parts, tables, links, theme: deterministic and structured", () => {
  const m = map();
  assert.deepEqual(m, map(), "same inputs, same map");
  assert.deepEqual(m.pages.map((p) => p.route), ["/", "/contact"]);
  assert.equal(m.pages[1].title, "Contact us");
  assert.deepEqual(m.parts, [{ name: "footer", file: "-parts/footer.tsx", routes: ["/", "/contact"], shared: true }]);
  const cols = Object.fromEntries(m.tables[0].columns.map((c) => [c.name, c.required]));
  assert.deepEqual(cols, { id: false, email: true, note: false, status: false });
  assert.equal(m.theme.tokens["--primary"], "#222");
  assert.deepEqual(m.theme.fonts, ["Inter"]);
  assert.equal(m.version, "v1");
});

test("an unread part is null, never an empty list", () => {
  const m = buildSiteMap({ pages: null, parts: null, spec: null });
  for (const k of ["pages", "parts", "facts", "tables", "links", "photos"]) assert.equal(m[k], null, k);
  assert.equal(mapFor("row", m), null);
});

test("slices: router facts with locations, row required columns, frame writable tables, reply, diagnose", () => {
  const m = map();
  const r = mapFor("router", m);
  assert.match(r, /hours "Mon–Fri 8am–4pm" in part footer \(on every page\)/);
  assert.match(r, /email "hi@fold\.test" in \/contact/);
  assert.ok(r.length <= 2000);
  assert.deepEqual(mapFor("row", m), { orders: ["email"] });
  assert.ok(mapFor("reply", m).startsWith("The site as it stands:"));
  assert.equal(mapFor("diagnose", m).facts.length, m.facts.length);
  // budgeted
  const many = buildSiteMap({ pages: [{ path: "index.tsx", source: "<main>" + Array.from({ length: 200 }, (_, i) => "<p>Item " + i + " £" + i + ".00</p>").join("") + "</main>" }], parts: [] });
  assert.ok(mapFor("router", many).length <= 2000);
});

test("the router inventory carries the key facts with where each is written", () => {
  const inv = routeInventory({ pages: pages.map((p) => ({ ...p, route: p.path === "index.tsx" ? "/" : "/contact" })), spec, parts });
  assert.match(inv, /Key details and where each is written:/);
  assert.match(inv, /part footer/);
});

test("recognisers: what a string is, never copy", () => {
  assert.equal(factKind("Open Tuesday to Sunday, 9am until 5pm"), "hours");
  assert.equal(factKind("+44 20 7946 0958"), "phone");
  assert.equal(factKind("Baked fresh every morning"), "");
  assert.deepEqual(partsImported(pages[0].source), ["footer"]);
  assert.equal(mapKey("Fold"), "source/fold/sitemap.json");
  assert.equal(mapVersionKey("fold", "01-x"), "source/fold/sitemaps/01-x.json");
});

test("a scoped text step is shown the parts its page renders (the footer on /contact)", () => {
  const files = [...pages, { path: "-parts/footer.tsx", source: parts[0].source }];
  const items = textItems(files);
  const sc = scopedText(items, { pages: ["/contact"] }, files);
  assert.ok(sc.shown.some((it) => it.path === "-parts/footer.tsx" && it.text === "Mon–Fri 8am–4pm"));
  // Red side: without the pages, the old reading leaves the footer out.
  const old = scopedText(items, { pages: ["/contact"] });
  assert.ok(!old.shown.some((it) => it.path === "-parts/footer.tsx"));
});

test("quotedElsewhere finds the site's own words in the message, outside what was shown", () => {
  const items = [{ path: "a.tsx", text: "Fresh bread daily" }, { path: "b.tsx", text: "Closed on Mondays" }];
  assert.deepEqual(quotedElsewhere("change 'Closed on Mondays' to open", items, ["a.tsx"]), ["b.tsx"]);
  assert.deepEqual(quotedElsewhere("make it nicer", items, ["a.tsx"]), []);
});

test("runTextEdit: a scoped no-match whose quoted words live elsewhere is asked again with every page, and applied there", async () => {
  const files = [
    { path: "index.tsx", source: `export default function P(){return <main><h1>Welcome in</h1></main>}` },
    { path: "about.tsx", source: `export default function P(){return <main><h1>Our story</h1><p>Closed on Mondays</p></main>}` },
  ];
  const items = textItems(files);
  const calls = [];
  const send = async (req) => {
    calls.push(req);
    const body = req.messages[0].content;
    const idx = body.split("\n").findIndex((l) => l.includes("Closed on Mondays"));
    if (idx < 0) return { content: [{ type: "tool_use", input: { edits: [] } }], usage: {} };
    const id = items.findIndex((it) => it.text === "Closed on Mondays");
    return { content: [{ type: "tool_use", input: { edits: [{ id, to: "Open every day" }] } }], usage: {} };
  };
  const out = await runTextEdit({ send }, { instruction: "On the home page, change \"Closed on Mondays\" to \"Open every day\"", pages: files, scope: { pages: ["/"] } });
  assert.equal(calls.length, 2, "asked again, widened");
  assert.equal(out.ok, true);
  assert.match(out.pages.find((p) => p.path === "about.tsx").source, /Open every day/);
  // Control: words nowhere on the site stay a no-match, with one call.
  calls.length = 0;
  const miss = await runTextEdit({ send }, { instruction: "change \"Not here at all\" to x", pages: files, scope: { pages: ["/"] } });
  assert.equal(miss.reason, "no-match");
  assert.equal(calls.length, 1);
});

test("the worker saves the map with each version, restores it with the version, and the first build saves its landmarks", () => {
  const w = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.ok(w.includes("async function refreshSiteMap("), "refresh exists");
  assert.ok(w.includes("async function loadSiteMap("), "load exists");
  assert.ok((w.match(/await refreshSiteMap\(env, slug/g) || []).length >= 2, "rebuilt after the edit publish and the build");
  assert.ok(w.includes("await restoreSiteMap(env, slug, id)"), "restore brings it back");
  // The landmarks gate reads the build's own publish signal, which `publishPages` returns.
  assert.ok(!w.includes("if (out && out.ok && out.render) await saveLandmarks"), "the dead gate is gone");
  assert.ok(w.includes("if (out && out.page === \"app\" && out.render) await saveLandmarks"), "the build gate reads page app");
});

// ── ALWAYS CURRENT (the owner, 2026-10-26): every way the site changes ──────
// Each change path is listed with the mechanism that keeps the map current.
// A path either refreshes the saved map itself, or is covered by the
// read-time rebuild: no reader is handed the saved copy on trust, and a copy
// served because a rebuild failed is marked `stale: true`.
const CHANGE_PATHS = {
  "first build": "build", "revise": "build",
  "text edit": "spine", "data edit": "read", "rules edit": "read", "look edit": "spine", "picture edit": "spine",
  "logo edit": "spine", "nav edit": "spine", "page edit": "spine", "frame edit": "spine", "add-on": "spine",
  "publish": "spine", "page removal": "spine", "page rename": "spine",
  "restore / rollback": "restore", "discard draft": "read", "draft save under draft-first": "read",
  "schema / table change": "read", "access-rule change": "read", "Data-panel structural edit": "read",
  "uploads library change": "read",
};
test("every change path refreshes the map or is covered by the read-time rebuild; no reader trusts a saved copy", () => {
  const w = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const body = (name) => { const a = w.indexOf("async function " + name + "("); assert.ok(a > 0, name); return w.slice(a, w.indexOf("\n}\n", a)); };
  const mech = {
    build: () => /if \(out && out\.page === "app"\) await refreshSiteMap\(env, slug, /.test(w),
    spine: () => /if \(!unsaved\.length\) await refreshSiteMap\(env, slug, version\);/.test(body("recompileAndPublish")),
    restore: () => /await restoreSiteMap\(env, slug, id\);/.test(body("restoreVersion")),
    read: () => /await refreshSiteMap\(env, slug, null\)/.test(body("currentSiteMap")) && /stale: true/.test(body("currentSiteMap")),
  };
  for (const [path, m] of Object.entries(CHANGE_PATHS)) assert.ok(mech[m] && mech[m](), path + " is not kept current (" + m + ")");
  // THE SAVED COPY IS READ ONLY BY `currentSiteMap` (its marked fallback).
  assert.equal([...w.matchAll(/await loadSiteMap\(/g)].length, 1, "a reader takes the saved map on trust");
  assert.ok(body("currentSiteMap").includes("await loadSiteMap("));
  // EVERY OTHER READER BUILDS FROM WHAT ITS OWN REQUEST JUST READ.
  const readers = [...w.matchAll(/mapFor\("(\w+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(readers, ["addon", "diagnose", "text"], "a new map reader: decide how it stays current, then list it here");
  assert.ok(/currentSiteMap\(env, slug\); map = cur/.test(w), "list_site reads the current map");
});
