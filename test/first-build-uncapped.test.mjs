// THE FIRST BUILD HAS NO PAGE, SECTION OR COMPONENT CAP (owner, 2026-10-24):
// "eliminate the sections, the cap on the sections, the cap on the pages, the
// cap on the components on the first build".
//
// The section cap existed because builds made "one full page full of themes"
// — a whole site stacked down one scroll. The answer now is real pages. These
// cases drive a ten-page, thirty-section design through the real plan reader
// (`normalizePlan`), the real split decision (`pagesPlan`, `bandRefusal`), the
// real frame facts (`chromeFor`, from worker.js), the real fan-out writer
// (`generateSiteBands`, with a stubbed `call` whose answers are built from what
// each writer is TOLD — its own name, the frame's page list) and the real page
// validator (`validatePages`): nothing is dropped, every page is written by its
// own bands, one header and one footer link every page. And a full revise of a
// stored nine-page site keeps all nine.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { normalizePlan, directiveFromPlan, MAX_PAGES, MAX_SECTIONS, MAX_COMPONENTS } from "../builder/site-plan.mjs";
import { pagesPlan, bandRefusal, generateSiteBands, bandFile, WHOLE_PAGE_BAND, MAX_BANDS } from "../builder/page-bands.mjs";
import { validatePages, MAX_PAGES as WRITER_MAX_PAGES } from "../builder/page-gen.mjs";
import { MAX_FANOUT_REQS, MAX_MODEL_FANOUT } from "../builder/model-fanout.mjs";
import { DESIGN_GRAPH, needKnown } from "../builder/design-graph.mjs";
import { loadWorkerModule } from "./fixtures/worker-harness.mjs";
const { frameFactsApi } = await loadWorkerModule();

const WORKER = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

// A DESIGN ANSWER IN THE SHAPE THE DESIGN TOOL ASKS FOR: `pages` as
// `{ name, path }`, `shape` as `{ path, sections[] }` per page, components
// from the kit menu. Ten pages of three bands each: thirty sections.
const NAMES = ["Home", "Menu", "Bakery", "Cakes", "Coffee", "Catering", "Story", "Team", "Visit", "Contact"];
const PATHS = NAMES.map((n, i) => (i === 0 ? "/" : "/" + n.toLowerCase()));
const DESIGN = {
  kind: "shopfront",
  purpose: "a neighbourhood bakery's whole offer, one subject a page",
  pages: NAMES.map((name, i) => ({ name, path: PATHS[i] })),
  shape: PATHS.map((path, i) => ({
    path,
    sections: [`opening band for ${NAMES[i]} — full width`, `the ${NAMES[i]} detail — two columns`, `closing ${NAMES[i]} action — centred`],
  })),
  action: ["Order a loaf"],
  components: Array.from({ length: 40 }, (_, i) => "comp-" + i),
};

const toolUse = (source) => ({ content: [{ type: "tool_use", name: "write_band", input: { source } }], usage: { input_tokens: 10, output_tokens: 5 } });

// THE STUB WRITER: each request is answered from its own prompt, as a model
// obeying it would — a band writes exactly the function it is told is YOURS;
// the header and the footer link every page the facts list.
function writerFor(seen) {
  return async (_keys, reqs) => {
    seen.push(reqs);
    return reqs.map((req, i) => {
      const text = typeof req.messages[0].content === "string" ? req.messages[0].content : req.messages[0].content.at(-1).text;
      const name = /YOURS IS (\w+)/.exec(text)[1];
      let body;
      if (name === "SiteHeader" || name === "SiteFooter") {
        const line = text.split("\n").find((l) => l.startsWith("- Its pages")) || "";
        const links = [...line.matchAll(/(\S[^,→]*?) → (\/[a-z0-9-]*)/g)].map((m) => ({ label: m[1].trim(), href: m[2] }));
        const tag = name === "SiteHeader" ? "header" : "footer";
        body = 'import { Link } from "@tanstack/react-router";\n\nfunction ' + name + "() {\n  return (\n    <" + tag + ">\n" +
          links.map((l) => '      <Link to="' + l.href + '">' + l.label + "</Link>").join("\n") + "\n    </" + tag + ">\n  );\n}\n";
      } else {
        body = "function " + name + "() {\n  return <section className=\"mx-auto max-w-6xl px-6\"><h2>" + name + "</h2></section>;\n}\n";
      }
      return { i, state: "done", answer: toolUse(body), ms: 100, waveMs: 400 };
    });
  };
}

test("the caps are gone: the constants are infinity on the first build's path", () => {
  for (const [n, v] of Object.entries({ MAX_PAGES, MAX_SECTIONS, MAX_COMPONENTS, MAX_BANDS, WRITER_MAX_PAGES })) {
    assert.equal(v, Infinity, n + " is a cap again");
  }
  // CONCURRENCY IS KEPT (8 at once); the list bound clears a big real site.
  assert.equal(MAX_MODEL_FANOUT, 8);
  assert.ok(MAX_FANOUT_REQS >= 10 * 30 + 2, "the container's list bound would send a large multi-page build back to one call");
});

test("TEN PAGES, THIRTY SECTIONS, FORTY COMPONENTS: the plan reader keeps every one, and the directive names every page and band", () => {
  const plan = normalizePlan(DESIGN);
  assert.deepEqual(plan.pages.map((p) => p.path), PATHS, "a page was dropped or reordered");
  assert.equal(plan.shape.length, 10);
  assert.equal(plan.shape.flatMap((s) => s.sections).length, 30, "a section was dropped");
  assert.equal(plan.components.length, 40, "a component was dropped");
  assert.equal(plan.notBuilt, undefined, "something planned was moved to notBuilt");
  const d = directiveFromPlan(plan);
  assert.match(d, /This site has 10 pages:/);
  for (let i = 0; i < 10; i++) {
    assert.ok(d.includes(`- ${PATHS[i]} — ${NAMES[i]}`), "the directive lost page " + PATHS[i]);
    assert.ok(d.includes(`closing ${NAMES[i]} action`), "the directive lost a band of " + PATHS[i]);
  }
});

test("EVERY PAGE IS SPLIT: one fan-out holds every page's bands and one frame; the split is not refused", () => {
  const plan = normalizePlan(DESIGN);
  const split = pagesPlan({ shape: plan.shape, pages: plan.pages, mode: "build" });
  assert.equal(split.why, "");
  assert.deepEqual(split.pages.map((p) => p.route), PATHS);
  assert.equal(split.pages.flatMap((p) => p.lines).length, 30);
  assert.equal(bandRefusal({ pages: 10, canFire: true, door: true, shape: plan.shape, route: "/", mode: "build", pageList: plan.pages }), "",
    "a ten-page plan was refused the split — it would go to one call");
  // CONTROLS: the refusals that remain still refuse.
  assert.equal(bandRefusal({ pages: 0, canFire: true, door: true, pageList: [] }), "pages");
  assert.equal(bandRefusal({ pages: 10, canFire: false, door: true, pageList: plan.pages }), "sync");
  assert.equal(bandRefusal({ pages: 10, canFire: true, door: false, shape: plan.shape, mode: "build", pageList: plan.pages }), "door");
  assert.equal(pagesPlan({ shape: plan.shape, pages: plan.pages, mode: "revise" }).why, "revise");
  assert.equal(pagesPlan({ shape: plan.shape, pages: plan.pages, priorPages: [{ path: "index.tsx" }], mode: "build" }).why, "revise");
  // A PAGE THE DESIGN DID NOT ARRANGE IS STILL WRITTEN, never dropped.
  const loose = pagesPlan({ shape: plan.shape.slice(0, 9), pages: plan.pages, mode: "build" });
  assert.equal(loose.why, "");
  assert.deepEqual(loose.pages[9].lines, [WHOLE_PAGE_BAND + "Contact"], "an unarranged page lost its writer");
  // ONE PAGE KEEPS THE ONE-PAGE RULE: a single band is not worth a split.
  assert.equal(pagesPlan({ shape: [{ path: "/", sections: ["only"] }], pages: [{ path: "/", name: "Home" }], mode: "build" }).why, "thin");
});

test("THROUGH THE WRITER AND THE VALIDATOR: ten pages written, thirty band files, one header and one footer linking every page, nothing dropped or stubbed", async () => {
  const plan = normalizePlan(DESIGN);
  const split = pagesPlan({ shape: plan.shape, pages: plan.pages, mode: "build" });
  const chrome = frameFactsApi.chromeFor(plan, "Fold Lane", "a bakery");
  assert.deepEqual(chrome.links.map((l) => l.href), PATHS, "the frame's facts do not list every page");
  const seen = [];
  const fan = await generateSiteBands({
    brief: "a bakery", spec: {}, brand: "Fold Lane", model: "m", route: "/", chrome,
    lines: split.pages.flatMap((p) => p.lines), pages: split.pages, actions: plan.action, notBuilt: [],
  }, {}, writerFor(seen), null);
  // ONE fan-out call holding every request: thirty bands, then the frame.
  assert.equal(seen.length, 1, "the pages were not sent as one fan-out");
  assert.equal(seen[0].length, 32);
  const bandPrompts = seen[0].slice(0, 30).map((r) => r.messages[0].content);
  for (let i = 0; i < 10; i++) {
    assert.ok(bandPrompts[i * 3].includes("THIS PAGE\n" + PATHS[i] + " — " + NAMES[i]), "a band was not told its page");
  }
  assert.equal(fan.bands, 30);
  assert.equal(fan.wrote, 30);
  assert.equal(fan.wroteFrame, 2);
  assert.equal(fan.refused, undefined, "a band or the frame was refused and stubbed");
  // EVERY PAGE, AT ITS OWN FILE.
  assert.deepEqual(fan.input.pages.map((p) => p.path), PATHS.map(bandFile));
  const parts = fan.input.parts;
  assert.equal(parts.filter((p) => p.name === "site-header").length, 1, "the header was written more than once, or not at all");
  assert.equal(parts.filter((p) => p.name === "site-footer").length, 1, "the footer was written more than once, or not at all");
  assert.ok(!parts.some((p) => /site-(header|footer)-\d/.test(p.name)), "a later page wrote its own copy of the frame");
  assert.equal(parts.filter((p) => p.name.startsWith("band-")).length, 30);
  assert.equal(new Set(parts.map((p) => p.name)).size, parts.length, "two parts share a file");
  for (const pg of fan.input.pages) {
    assert.match(pg.source, /from "@\/routes\/-parts\/site-header"/, pg.path + " does not use the one header");
    assert.match(pg.source, /from "@\/routes\/-parts\/site-footer"/, pg.path + " does not use the one footer");
    assert.equal((pg.source.match(/from "@\/routes\/-parts\/band-/g) || []).length, 3, pg.path + " does not compose its own three bands");
  }
  // THE VALIDATOR KEEPS IT ALL, and the frame links every page.
  const v = validatePages(fan.input);
  assert.equal(v.pages.length, 10, "the validator dropped a page: " + v.problems.join(" | "));
  const header = (v.parts || []).find((p) => p.name === "site-header");
  const footer = (v.parts || []).find((p) => p.name === "site-footer");
  assert.ok(header && footer, "the frame did not survive validation");
  for (const href of PATHS) {
    assert.ok(header.source.includes('to="' + href + '"'), "the header does not link " + href);
    assert.ok(footer.source.includes('to="' + href + '"'), "the footer does not link " + href);
  }
});

test("A FULL REVISE OF A STORED NINE-PAGE SITE KEEPS ALL NINE — through the plan reader and the page validator", () => {
  // `_meta.site_look` on an old site holds `{ path, role }`; a revise reads it
  // back through `normalizePlan`, then hands every stored page to
  // `validatePages`. Both cut (to 1 and to 6) until 2026-10-24.
  const stored = { purpose: "an older multi-page site", pages: Array.from({ length: 9 }, (_, i) => ({ path: i ? "/p" + i : "/", role: "page " + i })) };
  const plan = normalizePlan(stored);
  assert.equal(plan.pages.length, 9, "the revise's plan lost a stored page");
  const mk = (path, links = "") => ({ path, source: 'import { createFileRoute, Link } from "@tanstack/react-router";\nexport const Route = createFileRoute("/")({ component: P });\nfunction P(){ return <div>' + links + "</div>; }" });
  const pages = [mk("index.tsx", Array.from({ length: 8 }, (_, i) => '<Link to="/p' + (i + 1) + '">x</Link>').join("")), ...Array.from({ length: 8 }, (_, i) => mk("p" + (i + 1) + ".tsx"))];
  const v = validatePages({ pages });
  assert.equal(v.pages.length, 9, "the revise dropped a stored page: " + v.problems.join(" | "));
  for (let i = 1; i <= 8; i++) assert.ok(v.pages[0].source.includes('to="/p' + i + '"'), "a link to a kept page was rewritten");
});

test("THE DESIGN GRAPH: the agents that name a page are told the pages", () => {
  const byName = new Map(DESIGN_GRAPH.map((a) => [a.name, a]));
  const known = { pages: DESIGN.pages, theme: "bakery", brand: "Fold Lane" };
  for (const n of ["shape", "images"]) {
    assert.deepEqual(needKnown(byName.get(n), byName, known), { pages: DESIGN.pages }, "`" + n + "` cannot see the page paths it must name");
  }
});

test("THE WIRING: the build hands every page to the writer and the page list to the decision", () => {
  const at = WORKER.indexOf("const split = pagesPlan(");
  assert.ok(at > 0, "the build no longer splits every page");
  const win = WORKER.slice(at, WORKER.indexOf("return fan;", at));
  assert.ok(win.length > 200 && win.length < 20000, "the window is not the split block");
  assert.match(win, /pageList: plan && Array\.isArray\(plan\.pages\) \? plan\.pages : \[\]/, "the decision is not told the page list");
  assert.match(win, /pages: splitPages,/, "the writer is not handed every page");
  assert.match(win, /const bandLines = splitPages\.flatMap\(\(p\) => p\.lines\)/, "the band lines are not every page's");
});
