// ── THE TWO RISKS LEFT BY THE WRITTEN FRAME (2026-10-23) ────────────────────
//
// `build-ai-writes-all`, third round:
//
//   1. A NEW PAGE'S MENU LINK ON A WRITTEN FRAME. The add-on step put a new
//      page in every menu with `applyAdditions`, which writes `SiteChrome`'s
//      `links`; a site whose header the model wrote has none, so the new page
//      was in no menu. Now the link goes into the written header (and the
//      footer's own link list) — a copy of the list's last entry where the
//      list is unambiguous, one frame edit as an addition otherwise — in the
//      same publish as the page. A `SiteChrome` site is unchanged.
//   2. THE SINGLE-CALL FALLBACK, ENFORCED. It was told to write the frame and
//      nothing checked; now its answer is counted (kit imports, `SiteChrome`,
//      the two parts) and, when a page names `SiteChrome` or a part is
//      missing, ONE bounded repair turn asks for the written parts. The counts
//      ride the build trace (`fallback`). Also the Worker's hop into the page
//      call carries `{ ownParts }` (it dropped it).
//
// Model answers are supplied, never called.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { addon, writtenPage, compiledPages } from "./fixtures/addon-route.mjs";
import { insertFrameLinks, addFrameLinks, FRAME_EDIT_TOOL } from "../builder/site-frame.mjs";
import { fallbackFrameCounts, enforceFallbackFrame, fallbackRepairRequest, FRAME_REPAIR_TOOL } from "../builder/page-bands.mjs";

const WCODE = readFileSync(new URL("../worker.js", import.meta.url), "utf8");

const HOME = `import { createFileRoute } from "@tanstack/react-router";
import SiteHeader from "@/routes/-parts/site-header";
import SiteFooter from "@/routes/-parts/site-footer";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="flex-1 outline-none"><h1>Fretwork</h1><p>Guitar lessons.</p></main>
      <SiteFooter />
    </div>
  );
}
`;
const HEADER = `import { Link } from "@tanstack/react-router";

const LINKS = [
  { to: "/", label: "Home" },
  { to: "/prices", label: "Prices" },
];

export default function SiteHeader() {
  return (
    <header className="border-b border-border">
      <nav className="flex gap-4">{LINKS.map((l) => <Link key={l.to} to={l.to}>{l.label}</Link>)}</nav>
    </header>
  );
}
`;
const FOOTER = `import { Link } from "@tanstack/react-router";

export default function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <nav className="flex gap-3 text-sm">
        <Link to="/" className="hover:underline">Home</Link>
        <Link to="/prices" className="hover:underline">Prices</Link>
      </nav>
      <p>Fretwork, guitar lessons.</p>
    </footer>
  );
}
`;
const PRICES = `import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/prices")({ component: P });
function P() { return <main><h1>Prices</h1></main>; }
`;
const PARTS = [{ name: "site-header", source: HEADER }, { name: "site-footer", source: FOOTER }];
const PAGES = [{ path: "index.tsx", source: HOME }, { path: "prices.tsx", source: PRICES }];

// ── 1. THE MODULE ──────────────────────────────────────────────────────────

test("FRAME LINKS 1 — an unambiguous list gains a copy of its last entry (objects and JSX); an ambiguous or absent one is never guessed", () => {
  const h = insertFrameLinks(HEADER, [{ href: "/lessons", label: "Lessons" }]);
  assert.deepEqual(h.added, ["/lessons"]);
  assert.ok(h.source.includes('{ to: "/prices", label: "Prices" },\n  { to: "/lessons", label: "Lessons" },'), h.source);
  const f = insertFrameLinks(FOOTER, [{ href: "/lessons", label: "Lessons" }]);
  assert.ok(f.source.includes('<Link to="/prices" className="hover:underline">Prices</Link>\n        <Link to="/lessons" className="hover:underline">Lessons</Link>'), f.source);
  // Already listed: nothing added.
  assert.deepEqual(insertFrameLinks(HEADER, [{ href: "/prices/", label: "Prices" }]).added, []);
  // Two lists (a desktop and a mobile menu) or a single link: not guessed.
  assert.equal(insertFrameLinks(FOOTER + "\n" + FOOTER.replace("SiteFooter", "Other"), [{ href: "/x", label: "X" }]), null);
  assert.equal(insertFrameLinks('export default function H(){ return <Link to="/">Home</Link>; }', [{ href: "/x", label: "X" }]), null);
  // Words that would need escaping are not spliced.
  assert.equal(insertFrameLinks(HEADER, [{ href: "/x", label: 'Say "hi"' }]), null);
});

test("FRAME LINKS 2 — addFrameLinks: inserted without a model call; with no list, one frame edit as an addition; never on a SiteChrome site", async () => {
  const adds = [{ to: "menu", item: { label: "Lessons", href: "/lessons" }, pages: null, after: null }];
  const routes = ["/", "/prices", "/lessons"];
  let sent = 0;
  const r = await addFrameLinks({ send: async () => { sent++; return {}; } }, { pages: PAGES, parts: PARTS, routes, adds });
  assert.equal(r.ok, true);
  assert.equal(r.how, "inserted");
  assert.deepEqual(r.changed, ["header", "footer"]);
  assert.equal(sent, 0, "a model was called for an unambiguous list");
  // No list in the header: one frame edit, told it is an addition and the new page.
  const bare = [{ name: "site-header", source: 'import { Link } from "@tanstack/react-router";\nexport default function SiteHeader(){ return <header><Link to="/">Fretwork</Link></header>; }\n' }];
  const reqs = [];
  const answered = bare[0].source.replace("</header>", '<Link to="/lessons">Lessons</Link></header>');
  const m = await addFrameLinks({ send: async (q) => { reqs.push(q); return { content: [{ type: "tool_use", name: FRAME_EDIT_TOOL.name, input: { header: answered } }] }; } }, { pages: PAGES, parts: bare, routes, adds });
  assert.equal(m.ok, true, JSON.stringify(m));
  assert.equal(m.how, "model");
  assert.equal(reqs.length, 1);
  assert.match(reqs[0].messages[0].content, /THIS IS AN ADDITION/);
  assert.match(reqs[0].messages[0].content, /"Lessons" \(\/lessons\)/);
  // A page still naming SiteChrome: not a written frame, nothing done.
  const kit = await addFrameLinks({ send: async () => { throw new Error("called"); } }, { pages: [{ path: "index.tsx", source: "<SiteChrome />" }], parts: PARTS, routes, adds });
  assert.equal(kit.ok, false);
  assert.equal(kit.reason, "no-frame");
});

// ── 1. THROUGH THE REAL ADD-ON ROUTE ───────────────────────────────────────

test("FRAME LINKS 3 — through the add-on route: a new page on a written frame is linked in the written header and footer, in the same compile, and no page gains SiteChrome", async () => {
  const r = await addon("fw-frame-lessons", "add a Lessons page", {
    kinds: ["page"], publishes: true, storedPages: PAGES, parts: PARTS,
    answers: { page: { page: [{ path: "/lessons", name: "Lessons", purpose: "the lessons", sections: ["a band"], components: [], link: { in: "menu" } }] } },
    written: [writtenPage("/lessons")],
  });
  assert.equal(r.body && r.body.ok, true, JSON.stringify(r.body).slice(0, 600));
  assert.equal(r.compiles.length >= 1, true, "nothing compiled");
  const files = r.compiles[0].body.files || {};
  const all = JSON.stringify(r.compiles[0].body);
  const head = Object.entries(files).find(([k]) => /site-header/.test(k));
  const partsSent = r.compiles[0].body.parts;
  const headerSrc = head ? String(head[1]) : (Array.isArray(partsSent) ? (partsSent.find((p) => p && p.name === "site-header") || {}).source : "") || "";
  assert.ok(headerSrc.includes('{ to: "/lessons", label: "Lessons" }'), "the written header was not given the new page: " + all.slice(0, 400));
  const foot = Object.entries(files).find(([k]) => /site-footer/.test(k));
  const footerSrc = foot ? String(foot[1]) : (Array.isArray(partsSent) ? (partsSent.find((p) => p && p.name === "site-footer") || {}).source : "") || "";
  assert.ok(footerSrc.includes('<Link to="/lessons" className="hover:underline">Lessons</Link>'), "the footer's own list was not given the new page");
  for (const p of compiledPages(r)) assert.ok(!/\bSiteChrome\b/.test(p.source), p.path + " gained SiteChrome");
  // Stored with the publish.
  const stored = JSON.parse(r.store.store.get("source/fw-frame-lessons/parts.json") || "[]");
  assert.ok(stored.some((p) => p.name === "site-header" && p.source.includes("/lessons")), "the stored header lacks the link");
});

// ── 2. THE FALLBACK ────────────────────────────────────────────────────────

const KIT_PAGE = { path: "index.tsx", source: 'import { SiteChrome } from "@/components/ui/site-chrome";\nimport { Button } from "@/components/ui/button";\nexport default function P(){ return <SiteChrome><main><Button>Go</Button></main></SiteChrome>; }\n' };
const OWN_PAGE = { path: "index.tsx", source: HOME };

test("FALLBACK 1 — the counts: kit imports, files naming SiteChrome, each frame part", () => {
  assert.deepEqual(fallbackFrameCounts({ pages: [KIT_PAGE] }), { kitImports: 2, siteChrome: 1, header: false, footer: false, repair: true });
  assert.deepEqual(fallbackFrameCounts({ pages: [OWN_PAGE], parts: PARTS }), { kitImports: 0, siteChrome: 0, header: true, footer: true, repair: false });
  assert.equal(fallbackFrameCounts({ pages: [OWN_PAGE], parts: [PARTS[0]] }).repair, true);
});

test("FALLBACK 2 — one bounded repair turn when SiteChrome is used or a part is missing; taken only when it leaves nothing to repair; usage added; never a second turn", async () => {
  const gen = { input: { pages: [KIT_PAGE] }, usage: { in: 10, out: 20, cacheRead: 0, cacheWrite: 0, model: "m" } };
  const reqs = [];
  const good = { stop_reason: "tool_use", usage: { input_tokens: 5, output_tokens: 7 }, content: [{ type: "tool_use", name: FRAME_REPAIR_TOOL.name, input: { parts: PARTS, pages: [OWN_PAGE] } }] };
  const r = await enforceFallbackFrame(gen, { send: async (q) => { reqs.push(q); return good; }, directive: "## Components to build", model: "m" });
  assert.equal(reqs.length, 1);
  assert.equal(reqs[0].tool_choice.name, FRAME_REPAIR_TOOL.name);
  assert.ok(reqs[0].max_tokens > 0);
  assert.match(reqs[0].messages[0].content, /uses SiteChrome/);
  assert.match(reqs[0].messages[0].content, /`site-header` is missing/);
  assert.match(reqs[0].messages[0].content, /## Components to build/);
  assert.deepEqual(r.counts, { kitImports: 2, siteChrome: 1, header: 0, footer: 0, repair: 1, repaired: 1, kitImportsAfter: 0, siteChromeAfter: 0 });
  assert.equal(r.gen.input.pages[0].source, HOME);
  assert.ok(r.gen.input.parts.some((p) => p.name === "site-footer"));
  assert.deepEqual([r.gen.usage.in, r.gen.usage.out], [15, 27]);
  // A repair that still leaves SiteChrome: the call's own answer stands, the turn is counted.
  const bad = { stop_reason: "tool_use", content: [{ type: "tool_use", name: FRAME_REPAIR_TOOL.name, input: { parts: PARTS } }] };
  const b = await enforceFallbackFrame(gen, { send: async () => bad, model: "m" });
  assert.equal(b.counts.repair, 1);
  assert.equal(b.counts.repaired, 0);
  assert.equal(b.gen.input, gen.input);
  // Nothing to repair: no call.
  const ok = await enforceFallbackFrame({ input: { pages: [OWN_PAGE], parts: PARTS } }, { send: async () => { throw new Error("called"); } });
  assert.equal(ok.counts.repair, 0);
  // A send that throws: the answer stands.
  const t = await enforceFallbackFrame(gen, { send: async () => { throw new Error("down"); } });
  assert.equal(t.gen, gen);
  assert.equal(fallbackRepairRequest({ input: gen.input }).system[0].text.includes("NO KIT"), true);
});

test("FALLBACK 3 — the wiring: the first build's one call is enforced and marked; the Worker's hop carries the page call's options", () => {
  const at = WCODE.indexOf("const singleAnswer = await generateSitePages(");
  assert.ok(at > 0, "the fallback's page call is gone");
  const blk = WCODE.slice(at, WCODE.indexOf("} catch (e) {", at));
  // RE-ANCHORED 2026-10-24 (combine-d): beside the rewrite's file pick and question, and a first build's (`pageAsk`).
  assert.match(blk, /\{ ownParts: ownFirst, only: reviseOnly, \.\.\.\(\(revise \|\| priorPages\) \? \{ ask: canAskPages \} : pageAsk\) \}/);
  assert.match(blk, /if \(!ownFirst\) return singleAnswer;/);
  assert.match(blk, /enforceFallbackFrame\(singleAnswer,/);
  assert.match(blk, /if \(oneFix\.counts\) try \{ mark\?\.\("fallback", oneFix\.counts\); \}/);
  assert.match(blk, /return oneFix\.gen;/);
  // The add-on's frame-link call: billed with the designers, offered only while that bill is to come.
  const fl = WCODE.indexOf("const aFl = await addFrameLinks(");
  assert.ok(fl > 0, "the add-on's frame-link step is gone");
  const flBlk = WCODE.slice(fl - 200, fl + 900);
  assert.match(flBlk, /addFrameLinks\(aFirstPlaced \? \{\} : \{ send: aQuick\("frame-links"\) \}/);
  assert.match(flBlk, /if \(aFl\.usage\) aDesignUsage\.push\(aFl\.usage\);/);
  const hop = WCODE.indexOf("const generateSitePages = (");
  assert.ok(hop > 0);
  const line = WCODE.slice(hop, WCODE.indexOf(";\n", hop));
  assert.match(line, /keep = \[\], opts = undefined\)/);
  assert.match(line, /kind, keep, opts\)/);
});
