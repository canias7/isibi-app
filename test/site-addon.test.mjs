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
  MAX_RETURNED, mergeAddonPages, unlinkedPages, routeOf, addonReply, keptReply,
} from "../builder/site-addon.mjs";
import { priorPagesBlock, pagesRequest, pagesPrompt, validatePages, SITE_PAGES_TOOL } from "../builder/page-gen.mjs";

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

test("neither lane can publish an unbought image token", async () => {
  // FOUND BY AUDIT, and it is a bug this repo has shipped once already. Neither
  // lane buys photographs, and `site-images.mjs`'s own comment says what happens
  // without a stated zero: "a model with no instruction writes image tokens
  // anyway". An unbought token publishes as the literal text `@@IMG:a barber
  // chair@@` — a broken image AND a visible leak of how the site was made.
  //
  // BOTH HALVES, because either alone is the failure. The directive is what
  // should stop one being written; the sweep is what stops one reaching a
  // customer if it is written regardless.
  const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const block = (open, close) => {
    const from = worker.indexOf(open);
    assert.ok(from > 0, "block is gone: " + open.trim());
    const to = worker.indexOf(close, from);
    assert.ok(to > from, "could not find the end of " + open.trim());
    return worker.slice(from, to);
  };
  for (const [name, b] of [
    ["addon", block("\n          if (ad) {", "\n          if (tx) {")],
    ["page edit", block("\n            if (eLayer === \"page\") {", "\n            // A LAYER NOBODY IMPLEMENTS")],
  ]) {
    assert.match(b, /briefWithLayout\(\{ brief: \w+, images: 0 \}\)/,
      name + " does not tell the model there are no photographs");
    assert.match(b, /applyImages\(\w+\.pages, \{\}\)/,
      name + " does not sweep an unbought token before publishing");
  }

  // And the sweep really does clear one, so the assertion above is not just
  // matching a call that does nothing.
  const { applyImages } = await import("../builder/site-images.mjs");
  const swept = applyImages([{ path: "a.tsx", source: '<SafeImage src="@@IMG:a chair@@" alt="x" />' }], {});
  assert.ok(!swept[0].source.includes("@@IMG"), "the sweep does not clear an unbought token");
});

test("both generating lanes LINT, and both show what it found", async () => {
  // THE BIGGEST GAP THE AUDIT FOUND. `lintPages` ran only inside the build path,
  // so the addon lane and the page-edit layer published without ANY of it: a
  // table the schema never declared, a `collect` table being listed, a component
  // that does not exist, an invented prop, a `#/` link, a demo chart full of a
  // stranger's invented numbers — and the literal colour that makes the look
  // layer silently do nothing. Measured on one page carrying four of them: the
  // build path reports four problems and both lanes reported none.
  const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(worker, /^import .*\blintPages\b/m, "worker.js does not import the lint");
  const block = (open, close) => {
    const from = worker.indexOf(open);
    assert.ok(from > 0, "block is gone: " + open.trim());
    const to = worker.indexOf(close, from);
    assert.ok(to > from, "could not find the end of " + open.trim());
    return worker.slice(from, to);
  };
  for (const [name, b] of [
    ["addon", block("\n          if (ad) {", "\n          if (tx) {")],
    ["page edit", block("\n            if (eLayer === \"page\") {", "\n            // A LAYER NOBODY IMPLEMENTS")],
  ]) {
    assert.match(b, /lintPages\(\w+\.pages, \w+\)/, name + " publishes a generated page without linting it");
    // Against the SITE'S OWN schema, or the table checks cannot fire at all.
    assert.match(b, /\.problems\.concat\(lintPages\(/, name + " drops the lint's findings on the floor");
  }

  // And the lint really does catch these, so the assertions above are not
  // matching a call that finds nothing.
  const { lintPages } = await import("../builder/page-gen.mjs");
  const found = lintPages([{
    path: "src/routes/g.tsx",
    source: 'import { createFileRoute } from "@tanstack/react-router";\n' +
      'export const Route = createFileRoute("/g")({});\n' +
      'export default function G(){ fetch("/x"); return <div className="bg-amber-400"><a href="#/book">B</a></div>; }',
  }], { tables: [] });
  assert.ok(found.length >= 3, "the lint found only " + found.length + " on a page carrying several faults");
});

test("the customer is SHOWN what the lint found, on both lanes", () => {
  // A lint problem deliberately does not block publishing — the site is real and
  // usable — but a problem nobody is shown is a problem nobody fixes. Both
  // replies returned "✅ Done." and dropped `problems` entirely.
  const chat = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  assert.match(chat, /function problemNote\(/, "there is no way to render a lint problem");
  // ONE helper, used by both — two copies drift into one lane reporting and the
  // other not, which is the exact shape this session keeps finding.
  assert.equal((chat.match(/function problemNote\(/g) || []).length, 1);
  assert.match(chat, /problemNote\(e\.problems\)/, "the page edit does not show them");
  assert.match(chat, /problemNote\(a\.problems\)/, "the addon does not show them");
});

test("chat.js calls nothing it does not define", () => {
  // FOUND BY THIS FILE'S OWN TEST, and it was live for a moment: a call to
  // `problemNote` landed while the function itself did not, because a script
  // aborted between the two edits. `node --check` passes — it is a syntax check,
  // not a scope check — so the failure would have been a ReferenceError the
  // first time anybody used the addon lane. The `vidRefN` class, in the one file
  // no test can import.
  //
  // COMMENTS ARE NOT BLANKED, AND THAT IS THE MEASURED DECISION. The first draft
  // blanked them the way every other scan in this repo does, and a stray `/*`
  // inside a string ate 38% OF THE FILE — precisely the failure already recorded
  // for worker.js at 46%. It swallowed four real declarations and reported them
  // as undeclared. Raw source: 1554 declarations and ZERO false alarms, against
  // 1381 and four.
  //
  // Proved to fail honestly rather than assumed: renaming `problemNote`'s
  // declaration makes this go red, measured before it was kept.
  const chat = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  const declared = new Set([
    ...[...chat.matchAll(/(?:^|\s)(?:async\s+)?function\s+(\w+)\s*\(/gm)].map((m) => m[1]),
    ...[...chat.matchAll(/(?:^|[;{},)]\s*|\s)(?:const|let|var)\s+(\w+)\s*=/gm)].map((m) => m[1]),
  ]);
  assert.ok(declared.size > 1000, "only found " + declared.size + " declarations — the scan broke");
  // Narrowed to names shaped like this file's OWN vocabulary, so browser and
  // library globals are not flagged. A wider net here would cry wolf, and a
  // scan that cries wolf is worse than no scan.
  const ours = /\b(site[A-Z]\w+|render[A-Z]\w+|paint[A-Z]\w+|problemNote|editReply|addonReplyText|buildDownMsg)\s*\(/g;
  const missing = [...new Set([...chat.matchAll(ours)].map((m) => m[1]))].filter((n) => !declared.has(n));
  assert.deepEqual(missing, [], "chat.js calls " + missing.join(", ") + " and declares it nowhere");
});

// ── taking a page away ───────────────────────────────────────────────────────
//
// The lane could only ever ADD. "Remove the gallery page" came back `no-change`,
// escalated, and cost a full ~25-credit revise to do by omission — about twelve
// times what it should. Allowed here and NOT in the data layer, and the reason
// is undo: every publish is archived and there is a restore route, so a page
// deleted by mistake comes back. A row does not.

test("a named page is removed, and that alone is a real change", () => {
  // The load-bearing half is the SECOND assertion. The old guard was
  // `!added.length && !changed.length` → no-change, so a removal on its own —
  // which is what "delete the prices page" is — reported nothing happened and
  // escalated to the rung this lane exists to undercut.
  const r = mergeAddonPages(SITE, [page("index.tsx", 'const CHROME = { links: [] };\nexport default function Home(){return <p>Sharp Fade</p>;}')], ["src/routes/prices.tsx"]);
  assert.equal(r.ok, true, "a removal with the unlink is not a change: " + r.reason);
  assert.deepEqual(r.removed, ["src/routes/prices.tsx"]);
  assert.equal(r.pages.some((p) => p.path === "src/routes/prices.tsx"), false, "the page is still in the set");
  assert.equal(r.pages.length, 2, "the other pages must survive a removal");
});

test("the home page is never removable", () => {
  // The one address a customer shares. A site whose root renders nothing is
  // worse than any page they wanted gone — the same rule the salvage already
  // applies to a build with no index.
  const r = mergeAddonPages(SITE, [page("book.tsx", "export default function Book(){return <p>New</p>;}")], ["src/routes/index.tsx"]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.removed, []);
  assert.equal(r.pages.some((p) => p.path === "src/routes/index.tsx"), true);
  assert.deepEqual(r.kept, [{ path: "src/routes/index.tsx", why: "home" }]);
});

test("a page something still links to is kept, and the linkers are named", () => {
  // A <Link to="/book"> pointing at a route that no longer exists does not
  // compile, so deleting it would fail the WHOLE change: 20-40s of container
  // time to achieve nothing, and a TypeScript error the owner cannot act on.
  // Refused here instead, with the pages that still point at it named, because
  // "ask me to take the link out first" is a sentence they can act on.
  const r = mergeAddonPages(SITE, [page("prices.tsx", "export default function P(){return <p>New</p>;}")], ["src/routes/book.tsx"]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.removed, []);
  assert.equal(r.kept.length, 1);
  assert.equal(r.kept[0].why, "linked");
  assert.deepEqual(r.kept[0].from, ["src/routes/index.tsx"], "the page still pointing at it is not named");
});

test("the unlink and the removal land together", () => {
  // The ordinary shape of a correct deletion: the page goes, and the page that
  // linked to it comes back with the link taken out. The linker check must read
  // the RETURNED source, not the stored one, or a correct change is refused.
  const unlinked = page("index.tsx", 'const CHROME = { links: [] };\nexport default function Home(){return <p>Sharp Fade</p>;}');
  const r = mergeAddonPages(SITE, [unlinked], ["src/routes/book.tsx"]);
  assert.deepEqual(r.removed, ["src/routes/book.tsx"], "kept for: " + JSON.stringify(r.kept));
  assert.deepEqual(r.kept, []);
});

test("a page written and removed in one breath is left alone", () => {
  // Contradictory instructions from one model call. Keeping the file is the
  // recoverable direction — they can ask again — where honouring both leaves
  // them a page that was written and immediately deleted, with the reply
  // claiming both.
  const r = mergeAddonPages(SITE, [page("gallery.tsx", "export default function G(){return <p>W</p>;}")], ["src/routes/gallery.tsx"]);
  assert.deepEqual(r.added, ["src/routes/gallery.tsx"]);
  assert.deepEqual(r.removed, []);
  assert.equal(r.pages.some((p) => p.path === "src/routes/gallery.tsx"), true);
});

test("removal ignores what it cannot act on", () => {
  const r = mergeAddonPages(SITE, [page("gallery.tsx", "export default function G(){return <p>W</p>;}")],
    ["src/routes/nope.tsx", null, 42, { path: "src/routes/prices.tsx" }]);
  assert.deepEqual(r.removed, [], "a path the site does not have was acted on");
  assert.deepEqual(r.kept, []);
  assert.equal(r.pages.length, 4);
});

test("removal is bounded like everything else that comes back", () => {
  // A set larger than MAX_RETURNED is not an addon, it is a rewrite wearing one
  // — the same reasoning the returned pages already carry, applied to the half
  // that DESTROYS rather than adds.
  const big = Array.from({ length: 20 }, (_, i) => page("p" + i + ".tsx", "export default function P(){return <p>" + i + "</p>;}"));
  const r = mergeAddonPages([...SITE, ...big], [page("gallery.tsx", "export default function G(){return <p>W</p>;}")],
    big.map((p) => p.path));
  assert.ok(r.removed.length <= MAX_RETURNED, "removed " + r.removed.length + " pages in one addon");
});

test("nothing added, nothing changed, nothing removed still says why it kept things", () => {
  // A refusal with no reason reads as the lane being broken. The client says
  // "I left / — that is the home page", which is only possible if the refusal
  // carries it — and `kept` is a DIFFERENT reason from `no-change` precisely so
  // the route can tell a considered refusal from a dead end.
  const r = mergeAddonPages(SITE, [page("index.tsx", SITE[0].source)], ["src/routes/index.tsx"]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "kept");
  assert.deepEqual(r.kept, [{ path: "src/routes/index.tsx", why: "home" }]);
});

test("the reply says what went and what was left behind", () => {
  assert.match(addonReply({ removed: ["src/routes/prices.tsx"] }), /removed \/prices/);
  const kept = addonReply({ added: ["src/routes/gallery.tsx"], kept: [{ path: "src/routes/index.tsx", why: "home" }] });
  assert.match(kept, /I left \/ /, "the page we refused to delete is not mentioned: " + kept);
  assert.match(kept, /home page/);
  const linked = addonReply({ kept: [{ path: "src/routes/book.tsx", why: "linked", from: ["src/routes/index.tsx"] }] });
  assert.match(linked, /I left \/book/);
  assert.match(linked, /\/ still links to it/, linked);
});

test("the model is TOLD how to remove, in the addon block and in the tool", () => {
  // THE VERB IS UNREACHABLE WITHOUT THE SENTENCE. The full-revise block says
  // "to delete a page, simply do not return it" — true there, and a no-op here,
  // where an unreturned page is KEPT. A model working from that habit answers
  // "remove the gallery" by returning nothing, which is precisely the escalation
  // this change exists to stop.
  const block = priorPagesBlock(SITE, "addon");
  assert.match(block, /TO REMOVE A PAGE, LIST IT IN `remove`/, "the addon prompt never mentions removal");
  assert.match(block, /a page you do not return is\s+KEPT/i, "the prompt does not correct the revise habit");
  // And the tool has somewhere to put it. OPTIONAL — a build must not be asked
  // for a field it can never have a use for.
  assert.ok(SITE_PAGES_TOOL.input_schema.properties.remove, "the tool cannot carry a removal");
  assert.equal(SITE_PAGES_TOOL.input_schema.required.includes("remove"), false, "removal is required of every build");
  assert.match(SITE_PAGES_TOOL.input_schema.properties.remove.description, /Never remove the home page/);
});

test("the route reads `remove` and hands it to the merge", () => {
  // The wiring layer: worker.js cannot be imported, and this repo has recorded
  // a feature dead at exactly this seam nine times. A merge that accepts a third
  // argument nobody passes is the whole feature, silently absent.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(w, /Array\.isArray\(aGen\.input\.remove\)/, "the route never reads what the model returned");
  assert.match(w, /mergeAddonPages\(aSrc, aValid\.pages, aRemove\)/, "the merge is called without the removals");
  // And the answer carries both halves back, or the client cannot tell the
  // owner what went and what was refused.
  assert.match(w, /removed: aMerge\.removed/);
  assert.match(w, /kept: aMerge\.kept/);
});

test("a refusal is a refusal, not a reason to rebuild the site", () => {
  // THE LADDER'S ONE EXCEPTION. Escalation means "this lane could not answer",
  // and the rung above rewrites every page for ~25 credits. "Remove the home
  // page" HAS an answer — no, and here is why — so sending it up rebuilds a
  // customer's site in reply to a question. The merge carries the sentence, and
  // the route returns it instead of escalating.
  const r = mergeAddonPages(SITE, [page("index.tsx", SITE[0].source)], ["src/routes/index.tsx"]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "kept");
  assert.match(r.msg, /home page/, "the refusal cannot explain itself: " + r.msg);
  // And a genuine dead end still escalates — the two must not collapse.
  const dead = mergeAddonPages(SITE, []);
  assert.equal(dead.ok, false);
  assert.equal(dead.msg, undefined, "an empty answer must still reach the rung above");
});

test("a removal with nothing to return is still work", () => {
  // FOUND BY A MUTANT. Taking away a page nothing links to means the model
  // correctly returns no files at all — and that was read as an empty answer,
  // refused as `nothing-returned`, and escalated to the lane this one exists to
  // undercut. The commonest deletion there is, at twelve times the price.
  const r = mergeAddonPages(SITE, [], ["src/routes/prices.tsx"]);
  assert.equal(r.ok, true, "a removal-only call was refused: " + r.reason);
  assert.deepEqual(r.removed, ["src/routes/prices.tsx"]);
  assert.equal(r.pages.length, 2);
  // A removal list with nothing usable in it is still an empty answer.
  assert.equal(mergeAddonPages(SITE, [], ["", null]).reason, "nothing-returned");
});

test("one composition for the pages we would not delete", () => {
  // It is half of a success reply and ALL of a refusal. Two copies drift into a
  // refusal that explains itself and a success that keeps a page silently.
  const kept = [{ path: "src/routes/book.tsx", why: "linked", from: ["src/routes/index.tsx"] }];
  assert.ok(keptReply(kept).trim().length > 20);
  assert.ok(addonReply({ added: ["src/routes/g.tsx"], kept }).includes(keptReply(kept).trim()),
    "the success reply says it differently from the refusal");
});

test("the addon reply is DRIVEN, not grepped", () => {
  // Same lesson as the edit replies: a grep for `a.removed` passes while the
  // branch that reads it is blanked, because the word survives elsewhere.
  const chat = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  const cut = (name) => {
    const at = chat.indexOf("function " + name + "(");
    assert.ok(at > 0, name + " is gone from chat.js");
    const end = chat.indexOf("\n}", at);
    return chat.slice(at, end + 2);
  };
  const reply = new Function(cut("problemNote") + "\n" + cut("sitePathOf") + "\n" + cut("addonReplyText") +
    "\nreturn addonReplyText;")();
  const gone = reply({ added: [], changed: [], removed: ["src/routes/prices.tsx"] });
  assert.match(gone, /removed \/prices/, gone);
  const kept = reply({ added: ["src/routes/g.tsx"], kept: [{ path: "src/routes/index.tsx", why: "home" }] });
  assert.match(kept, /I left \//, "a page we refused to delete is kept silently: " + kept);
  assert.match(reply({ added: [], problems: ["g.tsx: names a colour"] }), /names a colour/);
});

test("a removed page leaves the picker", () => {
  // ADDING WITHOUT REMOVING IS THE SAME LIE THE OTHER WAY ROUND: the customer is
  // told the page is gone, the picker still offers it, and opening it lands on a
  // route the site no longer has. Both halves live in one block so the next
  // field added cannot keep only the flattering one.
  const chat = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  const at = chat.indexOf("function siteAddon(");
  assert.ok(at > 0);
  const body = chat.slice(at, chat.indexOf("\n}", at));
  assert.match(body, /Array\.isArray\(a\.removed\)/, "the client never reads what was removed");
  assert.match(body, /s\.pages = s\.pages\.filter\(/, "the picker keeps a page that no longer exists");
  // The refusal has to reach the customer rather than falling through to the
  // build — asserted on the ORDER, since `escalate` is checked first.
  assert.ok(body.indexOf("if (a.escalate)") < body.indexOf("a.msg"),
    "a refusal with a message is escalated before it is shown");
});

test("the route hands a considered refusal to the customer, not to the build lane", () => {
  // The wiring half of the same decision. `aEscalate` sets `escalate: true`, and
  // the client's first line is `if (a.escalate) return fallback()` — so a
  // refusal routed through it rebuilds the site for ~25 credits in answer to
  // "remove the home page". The branch must sit BEFORE the escalation.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = w.indexOf("const aMerge = mergeAddonPages(");
  assert.ok(at > 0, "the addon merge call moved");
  const after = w.slice(at, at + 1400);
  const refuse = after.indexOf("if (!aMerge.ok && aMerge.msg)");
  const climb = after.indexOf("return aEscalate(aMerge.reason");
  assert.ok(refuse > 0, "a refusal with a reason still escalates to the build lane");
  assert.ok(climb > 0, "the escalation is gone — a dead end must still reach the rung above");
  assert.ok(refuse < climb, "the escalation is checked first, so the refusal can never fire");
});
