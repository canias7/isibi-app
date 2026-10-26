// THE TEXT STEP'S DETERMINISTIC READERS (moved from the deleted site map,
// 2026-10-26, explore-code phase 5): the parts a scoped page renders, the
// site's own words quoted from outside what was shown, and the widened retry
// they drive. Kept from `test/site-map.test.mjs` as they were.
import test from "node:test";
import assert from "node:assert/strict";
import { runTextEdit, scopedText, textItems, quotedElsewhere, partsImported } from "../builder/site-apply.mjs";


const pages = [
  { path: "index.tsx", source: `import { Footer } from "@/routes/-parts/footer";\nexport default function P(){return <main><h1>Fold Lane Bakery</h1><p>Sourdough loaf £4.50</p><Footer/></main>}` },
  { path: "contact.tsx", source: `import { Footer } from "@/routes/-parts/footer";\nexport default function P(){return <main><h1>Contact us</h1><p>Write to us any time.</p><a href="mailto:hi@fold.test">Email</a><Footer/></main>}` },
];
const parts = [{ name: "footer", source: `export function Footer(){return <footer><p>Mon–Fri 8am–4pm</p><p>12 Mill Lane, Leeds LS1 4AB</p><p>0113 496 0123</p></footer>}` }];

test("partsImported names the parts a source imports, by stored name, once each", () => {
  assert.deepEqual(partsImported(pages[0].source), ["footer"]);
  assert.deepEqual(partsImported('import A from "@/routes/-parts/a";\nimport B from "@/routes/-parts/b.tsx";\nimport A2 from "@/routes/-parts/a";'), ["a", "b"]);
  assert.deepEqual(partsImported("no imports"), []);
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
  // Words in a file already shown are not "elsewhere".
  assert.deepEqual(quotedElsewhere("change 'Fresh bread daily' to weekly", items, ["a.tsx"]), []);
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

