// The addon lane's merge.
//
// The two failures this file is written around are both silent. A merge that
// drops pages publishes a site consisting of the new page alone; a merge that
// reports pages as "changed" when they came back byte-identical sends the owner
// looking for damage that is not there.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  MAX_RETURNED, mergeAddonPages, unlinkedPages, routeOf, addonReply,
} from "../builder/site-addon.mjs";
import { priorPagesBlock, pagesRequest, pagesPrompt, validatePages } from "../builder/page-gen.mjs";

const page = (path, source) => ({ path: "src/routes/" + path, source });
const SITE = [
  page("index.tsx", 'const CHROME = { links: [{ label: "Book", href: "/book" }] };\nexport default function Home(){return <p>Sharp Fade</p>;}'),
  page("book.tsx", 'export default function Book(){return <p>Book a chair</p>;}'),
  page("prices.tsx", 'export default function Prices(){return <p>From 20</p>;}'),
];

// ── the merge ────────────────────────────────────────────────────────────────

test("a returned page replaces its own, and every other page survives", () => {
  // The container wipes src/routes and writes what it is given, so a merge that
  // handed back only the subset would publish a one-page site.
  const r = mergeAddonPages(SITE, [page("gallery.tsx", "export default function G(){return <p>Work</p>;}")]);
  assert.equal(r.ok, true);
  assert.equal(r.pages.length, 4, "the pages nobody returned must survive");
  assert.deepEqual(r.pages.map((p) => p.path).sort(), [
    "src/routes/book.tsx", "src/routes/gallery.tsx", "src/routes/index.tsx", "src/routes/prices.tsx",
  ]);
  assert.deepEqual(r.added, ["src/routes/gallery.tsx"]);
  assert.deepEqual(r.changed, []);
  assert.equal(r.pages.find((p) => p.path === "src/routes/book.tsx").source, SITE[1].source);
});

test("NOTHING IS EVER DELETED — this lane adds", () => {
  // "Return every page and I will infer the deletions" is the revise's contract.
  // Here it would turn a model returning two files into a site of two pages.
  const r = mergeAddonPages(SITE, [page("gallery.tsx", "export default function G(){return <p>x</p>;}")]);
  for (const p of SITE) assert.ok(r.pages.some((q) => q.path === p.path), p.path + " was dropped");
});

test("a page returned byte-identical is not reported as changed", () => {
  // "changed 3 pages" when three came back untouched is the report that makes
  // somebody go looking for damage that is not there.
  const r = mergeAddonPages(SITE, [
    page("gallery.tsx", "export default function G(){return <p>x</p>;}"),
    { path: SITE[1].path, source: SITE[1].source },
  ]);
  assert.deepEqual(r.added, ["src/routes/gallery.tsx"]);
  assert.deepEqual(r.changed, [], "an identical page is not a change");
});

test("a real edit to an existing page IS reported as changed", () => {
  const r = mergeAddonPages(SITE, [
    { path: SITE[0].path, source: SITE[0].source.replace('"/book"', '"/gallery"') },
  ]);
  assert.deepEqual(r.added, []);
  assert.deepEqual(r.changed, ["src/routes/index.tsx"]);
});

test("nothing returned, and nothing that changes anything, are both refused", () => {
  assert.equal(mergeAddonPages(SITE, []).reason, "nothing-returned");
  assert.equal(mergeAddonPages(SITE, null).reason, "nothing-returned");
  assert.equal(mergeAddonPages(SITE, [{ path: "x.tsx", source: "   " }]).reason, "nothing-returned");
  // Everything came back identical: the model understood nothing and the honest
  // outcome is to say so rather than bill a recompile for a byte-identical site.
  const same = mergeAddonPages(SITE, SITE.map((p) => ({ ...p })));
  assert.equal(same.ok, false);
  assert.equal(same.reason, "no-change");
});

test("a returned set larger than the cap is a rewrite wearing an addon's clothes", () => {
  const many = Array.from({ length: MAX_RETURNED + 1 }, (_, i) => page("p" + i + ".tsx", "export default function P(){return <p>" + i + "</p>;}"));
  const r = mergeAddonPages(SITE, many);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "too-many");
  assert.equal(r.count, MAX_RETURNED + 1);
  assert.equal(mergeAddonPages(SITE, many.slice(0, MAX_RETURNED)).ok, true, "the cap itself must be allowed");
});

test("malformed entries are skipped, not crashed on", () => {
  const r = mergeAddonPages(SITE, [null, { path: 5, source: "x" }, { path: "a.tsx" }, page("g.tsx", "export default function G(){return <p>x</p>;}")]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.added, ["src/routes/g.tsx"]);
});

// ── reachability ─────────────────────────────────────────────────────────────

test("a route path is derived from the file, and an odd shape is skipped", () => {
  assert.equal(routeOf("src/routes/index.tsx"), "/");
  assert.equal(routeOf("src/routes/gallery.tsx"), "/gallery");
  assert.equal(routeOf("src/routes/shop/index.tsx"), "/shop");
  assert.equal(routeOf("src/routes/shop/item.tsx"), "/shop/item");
  // A wrong answer here would report a linked page as orphaned, so anything
  // unrecognised answers "" and is skipped.
  assert.equal(routeOf("weird.txt"), "");
  assert.equal(routeOf(""), "");
  assert.equal(routeOf(null), "");
});

test("a new page nobody links to is NAMED, not refused", () => {
  // Refusing would throw away a page that exists and compiles, and charge for
  // it. The owner can ask for the link in one more sentence.
  const merged = mergeAddonPages(SITE, [page("gallery.tsx", "export default function G(){return <p>x</p>;}")]);
  assert.deepEqual(unlinkedPages(merged.pages, merged.added), ["/gallery"]);

  const linked = mergeAddonPages(SITE, [
    page("gallery.tsx", "export default function G(){return <p>x</p>;}"),
    { path: SITE[0].path, source: SITE[0].source.replace('"/book"', '"/gallery"') },
  ]);
  assert.deepEqual(unlinkedPages(linked.pages, linked.added), [], "a page linked from the home page is reachable");
});

test("reachability never checks a page against itself", () => {
  // A gallery page linking to /gallery does not make it reachable from anywhere.
  const merged = mergeAddonPages(SITE, [page("gallery.tsx", 'const C = { links: [{ href: "/gallery" }] };\nexport default function G(){return <p>x</p>;}')]);
  assert.deepEqual(unlinkedPages(merged.pages, merged.added), ["/gallery"]);
});

// ── what the customer is told ────────────────────────────────────────────────

test("the reply names the pages, including the one they did not ask about", () => {
  // This lane can touch a page nobody asked about — the nav link — so not saying
  // which is how a legitimate change reads as the site being altered behind them.
  const r = addonReply({ added: ["src/routes/gallery.tsx"], changed: ["src/routes/index.tsx"] });
  assert.match(r, /\/gallery/);
  assert.match(r, /linked it from \//);
  assert.ok(!/undefined/.test(r));
});

test("an unreachable page is said plainly, with the fix", () => {
  const r = addonReply({ added: ["src/routes/gallery.tsx"], changed: [], unlinked: ["/gallery"] });
  assert.match(r, /Nothing links to \/gallery/);
  assert.match(r, /say where you want the link/i, "the owner must be told what to do about it");
});

test("an empty reply is still a sentence", () => {
  assert.match(addonReply(), /^✅/);
  assert.match(addonReply({}), /^✅/);
});

// ── the prompt half ──────────────────────────────────────────────────────────

test("addon mode asks for ONLY what is new or changed; revise still asks for everything", () => {
  // The two modes must not converge — a shared block that drifted into "return
  // every page" would silently make an addon cost a revise, and nothing would
  // fail.
  const addon = priorPagesBlock(SITE, "addon");
  assert.match(addon, /RETURN ONLY WHAT IS NEW OR CHANGED/);
  assert.match(addon, /A page you do not return is kept exactly as it is/);
  assert.match(addon, /each page carries its own nav links/i, "the model must be told why the nav needs touching");
  assert.match(addon, /belongs on a page that already exists/i, "a testimonials section is an edit, not a route");

  const revise = priorPagesBlock(SITE, "revise");
  assert.match(revise, /Return every page again/);
  assert.ok(!/RETURN ONLY WHAT IS NEW OR CHANGED/.test(revise));
  // And the default is unchanged, so no existing caller's request moves.
  assert.equal(priorPagesBlock(SITE), revise);
});

test("mode reaches the request through the ONE call definition", () => {
  // Two places constructing this is how a test tunes something production does
  // not run — the reason pagesRequest exists at all.
  const spec = { tables: [] };
  const addon = pagesRequest({ brief: "add a gallery", spec, brand: "Sharp Fade", priorPages: SITE, mode: "addon" });
  const body = typeof addon.messages[0].content === "string" ? addon.messages[0].content : addon.messages[0].content.at(-1).text;
  assert.match(body, /RETURN ONLY WHAT IS NEW OR CHANGED/);

  const revise = pagesRequest({ brief: "add a gallery", spec, brand: "Sharp Fade", priorPages: SITE });
  const rbody = typeof revise.messages[0].content === "string" ? revise.messages[0].content : revise.messages[0].content.at(-1).text;
  assert.match(rbody, /Return every page again/, "the default must still be a full revise");
  // The cached system block is byte-identical either way, or an addon would miss
  // the ~27,000-token prompt cache every time.
  assert.deepEqual(addon.system, revise.system);
});

test("a site too large to inline falls back to the full rewrite in BOTH modes", () => {
  // The degradation is deliberate: with the source not shown, "return only what
  // changed" is an instruction the model cannot follow — it has nothing to
  // return the rest OF.
  const huge = [page("index.tsx", "x".repeat(400000))];
  for (const mode of ["addon", "revise"]) {
    const b = priorPagesBlock(huge, mode);
    assert.match(b, /too large to show here/, mode + " must degrade rather than lie");
    assert.ok(!/RETURN ONLY WHAT IS NEW OR CHANGED/.test(b));
  }
});

// ── the guard that stops this rotting ────────────────────────────────────────

test("the addon module cannot reach the schema engine or the publisher", () => {
  const raw = fs.readFileSync(new URL("../builder/site-addon.mjs", import.meta.url), "utf8");
  const src = raw.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => " ".repeat(m.length));
  assert.equal(src.length, raw.length, "blanking must preserve offsets");
  // It is a merge, not an orchestrator: no I/O, no imports at all.
  assert.ok(!/\bimport\b/.test(src), "the addon merge must stay a plain module with no dependencies");
  assert.match(raw, /export function mergeAddonPages/);
});

// ── the wiring, at both ends ─────────────────────────────────────────────────

const WORKER = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const CHAT = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");

function addonBlock() {
  const from = WORKER.indexOf("\n          if (ad) {");
  assert.ok(from > 0, "the addon handler is gone — every assertion below would pass vacuously");
  const to = WORKER.indexOf("\n          if (tx) {", from);
  assert.ok(to > from, "could not find the end of the addon handler");
  return WORKER.slice(from, to);
}

test("the addon route exists, is dispatched, and reaches the module", () => {
  assert.match(WORKER, /const ad = url\.pathname\.match\(\/\^\\\/api\\\/site\\\/[^\n]*\\\/addon\$/,
    "no /api/site/<slug>/addon matcher");
  const gate = WORKER.match(/if \(om \|\| mm \|\|[^)]*\) \{/g) || [];
  assert.ok(gate.length && gate.every((g) => g.includes("|| ad")), "the addon matcher is not dispatched");
  const owner = WORKER.match(/const ownerSlug = \(([^)]*)\)\[1\]/);
  assert.ok(owner && owner[1].split("||").map((s) => s.trim()).includes("ad"),
    "the addon matcher is not in the ownerSlug list");
  const b = addonBlock();
  assert.match(b, /mergeAddonPages\(/, "the merge is not wired");
  assert.match(b, /unlinkedPages\(/, "reachability is computed nowhere");
  assert.match(b, /assertOwner\(/, "the addon lane is not ownership-gated");
  assert.match(b, /"addon"\)/, "generateSitePages is not called in addon mode — it would re-emit every page");
});

test("the addon lane never provisions, and charges only after publishing", () => {
  const raw = addonBlock();
  const b = raw.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => " ".repeat(m.length));
  assert.equal(b.length, raw.length, "blanking must preserve offsets");
  // The site already has a database. Provisioning here would be a second path
  // that can create a Neon project, which is the leak site-provision.mjs exists
  // to prevent.
  assert.ok(!b.includes("ensureSiteBackend"), "the addon lane must not provision");
  const spend = b.indexOf("collectCredits(");
  assert.ok(spend > 0, "the addon lane spends nothing");
  assert.ok(b.indexOf("recompileAndPublish(") > 0 && b.indexOf("recompileAndPublish(") < spend,
    "the charge must come after the publish");
  assert.equal((b.match(/collectCredits\(/g) || []).length, 1, "one place money leaves the ledger");
});

test("a failed addon leaves the site untouched, and an unusable one escalates", () => {
  const b = addonBlock();
  assert.match(b, /site is untouched/, "a failed compile must promise the live site survived");
  assert.match(b, /if \(!aMerge\.ok\) return aEscalate\(aMerge\.reason/,
    "nothing usable back must escalate rather than report success");
  for (const reason of ["empty", "unconfigured", "no-source", "no-backend", "no-meta"]) {
    assert.ok(b.includes('aEscalate("' + reason + '"'), "no escalation path for: " + reason);
  }
});

test("the composer dispatches an addon and falls back on everything else", () => {
  assert.match(CHAT, /d\.intent === 'addon' && site\.slug\) return siteAddon\(/,
    "the client never routes an addon anywhere");
  const from = CHAT.indexOf("function siteAddon(");
  assert.ok(from > 0, "siteAddon is gone");
  const to = CHAT.indexOf("\nfunction sitePathOf(", from);
  assert.ok(to > from, "could not find the end of siteAddon");
  const b = CHAT.slice(from, to);
  assert.match(b, /'\/addon'/);
  assert.match(b, /if \(a\.escalate\) return fallback\(\)/);
  assert.ok(b.indexOf("a.escalate") < b.indexOf("!r.ok || !a.ok"),
    "the escalation check must run before the failure check");
  assert.match(b, /\}\)\.catch\(fallback\)/);
  // A NEW PAGE HAS TO REACH THE PICKER, or the customer is told it was added and
  // cannot open it.
  assert.match(b, /s\.pages\.push\(\{ path: p \}\)/);
});

test("the client's route-path reader agrees with the module's", () => {
  // Two copies, because the client cannot import the module. They must not
  // disagree about what `src/routes/shop/index.tsx` is called.
  const from = CHAT.indexOf("function sitePathOf(file) {");
  assert.ok(from > 0, "sitePathOf is gone or reshaped");
  // To the first line that is exactly a closing brace — slicing to the NEXT
  // function swept up the comment block above it, and a trailing `//` line
  // inside `new Function("return (…)")` is a syntax error rather than a
  // disagreement. The first draft reported that as the two readers differing.
  const to = CHAT.indexOf("\n}\n", from);
  assert.ok(to > from, "could not find the end of sitePathOf");
  // eslint-disable-next-line no-new-func
  const clientPathOf = new Function("return (" + CHAT.slice(from, to + 2).replace(/^function sitePathOf/, "function") + ")")();
  for (const f of ["src/routes/index.tsx", "src/routes/gallery.tsx", "src/routes/shop/index.tsx", "src/routes/shop/item.tsx", "nonsense", ""]) {
    assert.equal(clientPathOf(f), routeOf(f), "the two readers disagree about " + JSON.stringify(f));
  }
});

test("a PARTIAL set is not told it has no home page", () => {
  // The survivor of the mutation sweep, and a real gap: an addon returns only
  // what it wrote, so an index.tsx is absent by design and the site's real one
  // is kept by the merge. Without the flag every single addon carries a false
  // "There is no index.tsx" problem — and `problems` reaches the customer.
  const partial = { pages: [{ path: "gallery.tsx", source: 'import {createFileRoute} from "x";\nexport const Route = createFileRoute("/gallery")({});' }] };
  const asPartial = validatePages(partial, { partial: true });
  assert.equal(asPartial.pages.length, 1, "the page itself must still validate");
  assert.ok(!asPartial.problems.some((p) => /index\.tsx/.test(p)),
    "a partial set must not be told it has no home page: " + JSON.stringify(asPartial.problems));

  // And the flag is not a no-op — a WHOLE site with no index really is broken,
  // and must still be reported. Both directions, or the assertion above passes
  // on a validator that stopped checking at all.
  const asWhole = validatePages(partial);
  assert.ok(asWhole.problems.some((p) => /index\.tsx/.test(p)),
    "a full page set with no home page must still be flagged");
});
