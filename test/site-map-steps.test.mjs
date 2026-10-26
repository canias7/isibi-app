// THE SITE MAP REACHES EVERY STEP (2026-10-26, round 2): the row designer,
// the frame writer, the reply model, and the router's first routing asking
// up front through its existing question. SUPPLIED MODEL ANSWERS ONLY: whether
// a real router asks here is a live measurement this file cannot make.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSiteMap, mapFor } from "../builder/site-map.mjs";
import { routeInventory } from "../builder/route-inventory.mjs";
import { routeMessage, LIVE_ASK_TOOL } from "../builder/site-ask.mjs";
import { siteNote, noteFor } from "../builder/site-add.mjs";
import { replyContext } from "../builder/site-reply.mjs";
import { frameEditRequest } from "../builder/site-frame.mjs";

const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");

// A cafe inside a shop: one set of opening hours, written once in the footer
// part every page renders, and the contact page saying they cover the business.
const FOOTER = `export function Footer(){return <footer><p>Open Mon–Sun 9am–5pm</p><p>01632 960 123</p><p>hello@harbour.test</p></footer>}`;
const PAGES = [
  { path: "index.tsx", source: `import { Footer } from "@/routes/-parts/footer";\nexport default function P(){return <main><h1>Harbour Books</h1><p>A bookshop with a cafe at the back.</p><Footer/></main>}` },
  { path: "cafe.tsx", source: `import { Footer } from "@/routes/-parts/footer";\nexport default function P(){return <main><h1>The cafe</h1><p>Coffee and cake among the shelves.</p><p>Flat white £3.20</p><Footer/></main>}` },
  { path: "contact.tsx", source: `import { Footer } from "@/routes/-parts/footer";\nexport default function P(){return <main><h1>Contact</h1><p>Our hours cover the shop and the cafe.</p><Footer/></main>}` },
];
const PARTS = [{ name: "footer", source: FOOTER }];
const SPEC = { tables: [{ name: "orders", columns: [{ name: "id", notnull: true }, { name: "name", notnull: true }, { name: "note" }] }] };
const SITE = { name: "Harbour Books", url: "https://harbour.gofarther.app", pages: ["/", "/cafe", "/contact"], tables: ["orders"] };
const said = (input) => ({ stop_reason: "tool_use", content: [{ type: "tool_use", name: LIVE_ASK_TOOL.name, input }], usage: { input_tokens: 10, output_tokens: 5 } });
const ROUTES = PAGES.map((p) => ({ ...p, route: p.path === "index.tsx" ? "/" : "/" + p.path.replace(/\.tsx$/, "") }));

// THE ROUTER no longer gets the key facts: it explores (2026-10-26, explore-code).

test("THE ROUTER SLICE'S SIZE on a realistic site: inside ~2–3k tokens with the inventory", () => {
  // Eight pages with footer facts, a menu of prices, twelve tables.
  const menu = Array.from({ length: 24 }, (_, i) => "<li><p>Item " + i + "</p><p>£" + (3 + i) + ".50</p></li>").join("");
  const pages = [...ROUTES, ...Array.from({ length: 5 }, (_, i) => ({ path: "p" + i + ".tsx", route: "/p" + i, source: `import { Footer } from "@/routes/-parts/footer";\nexport default function P(){return <main><h1>Page ${i}</h1><ul>${menu}</ul><Footer/></main>}` }))];
  const tables = Array.from({ length: 12 }, (_, i) => ({ name: "t" + i, columns: Array.from({ length: 8 }, (_, j) => ({ name: "c" + j, notnull: j < 2 })) }));
  const inv = routeInventory({ pages, spec: { tables }, parts: PARTS });
  const facts = mapFor("router", buildSiteMap({ pages, parts: PARTS }));
  const tokens = (s) => Math.ceil(s.length / 4);
  assert.ok(tokens(facts) <= 500, "facts slice " + tokens(facts));
  assert.ok(tokens(inv) <= 1600, "inventory with facts " + tokens(inv));
});

// THE ROW DESIGNER AND THE FRAME WRITER no longer get map slices: they explore
// (2026-10-26, explore-code; test/explore-everywhere.test.mjs).

test("THE REPLY MODEL is told what exists, from the current map, as facts", () => {
  const map = mapFor("reply", buildSiteMap({ pages: PAGES, parts: PARTS, spec: SPEC }));
  const ctx = replyContext({ request: "r", site: { name: "Harbour Books", slug: "harbour", pages: ["/"], map } });
  assert.ok(ctx.includes("Pages: / (\"Harbour Books\"), /cafe (\"The cafe\"), /contact (\"Contact\")"));
  assert.ok(ctx.includes("Tables: orders"));
  assert.ok(!replyContext({ request: "r", site: { name: "x", slug: "x" } }).includes("as it stands"));
  assert.match(W, /siteMapText = mapFor\("reply", await withinMs\(currentSiteMap\(env, ask\.slug\)/);
  assert.match(W, /site: \{ name: ask\.name, slug: ask\.slug, pages, map: siteMapText \}/);
});
