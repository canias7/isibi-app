// PARKED (2026-11-03, park-old-way): the old-way half of test/site-map-steps.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// THE SITE MAP REACHES EVERY STEP (2026-10-26, round 2): the row designer,
// the frame writer, the reply model, and the router's first routing asking
// up front through its existing question. SUPPLIED MODEL ANSWERS ONLY: whether
// a real router asks here is a live measurement this file cannot make.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSiteMap, mapFor } from "../../../builder/site-map.mjs";
import { routeInventory } from "../../../builder/route-inventory.mjs";
import { LIVE_ASK_TOOL } from "../../../builder/route-shared.mjs";
import { siteNote, noteFor } from "../../../builder/site-add.mjs";
import { replyContext } from "../../../builder/site-reply.mjs";
import { frameEditRequest } from "../../../builder/site-frame.mjs";

const W = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");

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

test("THE ROW DESIGNER is shown the map's tables with required columns; other designers are not", () => {
  const rowNote = mapFor("rowNote", buildSiteMap({ spec: SPEC }));
  assert.match(rowNote, /- orders: id, name\*, note/);
  const site = { name: "Harbour Books", pages: ["/"], rowNote };
  assert.ok(siteNote(noteFor("row", site)).includes("- orders: id, name*, note"));
  assert.ok(!siteNote(noteFor("page", site)).includes("name*"));
  assert.match(W, /rowNote: \(\(\) => \{ try \{ return mapFor\("rowNote", buildSiteMap\(\{ spec, label: accessLabel \}\)\)/);
  // The live read stays the truth for what an entry must fill.
  assert.match(W, /rowRequired: aRowRequired/);
});

test("THE FRAME WRITER is given the frame slice as its note, beside the live tables", () => {
  const note = mapFor("frame", buildSiteMap({ pages: PAGES, parts: PARTS }));
  assert.match(note, /^The site as it stands:/);
  assert.match(note, /hours "Open Mon–Sun 9am–5pm" in part footer/);
  const req = frameEditRequest({ instruction: "x", frame: {}, routes: ["/"], note });
  assert.ok(req.messages[0].content.includes(note));
  assert.match(W, /note: \(\(\) => \{ try \{ return mapFor\("frame", buildSiteMap\(\{ pages: eSrc, parts: fRead\.parts \}\)\)/);
});
