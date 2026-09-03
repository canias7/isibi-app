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
  MAX_RETURNED, mergeAddonPages, mergeAddonSchema, ADDON_TABLE_FIELDS, ADDON_SPEC_FIELDS,
  unlinkedPages, routeOf, addonReply, keptReply, rowLists, orderingMoved } from "../builder/site-addon.mjs";
import { priorPagesBlock, pagesRequest, pagesPrompt, validatePages, SITE_PAGES_TOOL } from "../builder/page-gen.mjs";
import { EDIT_RULE } from "../builder/site-edit.mjs";
// THE ADD STEP'S OWN RULE (2026-09-02) — the addon no longer reads EDIT_RULE.
import { addRule } from "../builder/site-add.mjs";

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
  // THE SHAPE THAT IS ACTUALLY STORED, first. `cleanPath` strips `src/routes/`
  // on the way in — the container puts it back when it writes the files — so
  // every page this function is handed in production is BARE. Requiring the
  // prefix made it answer "" for every page on every site, which killed the
  // whole `page` edit layer, and nothing caught it because every fixture in this
  // file prepends the prefix by hand.
  assert.equal(routeOf("index.tsx"), "/");
  assert.equal(routeOf("gallery.tsx"), "/gallery");
  assert.equal(routeOf("shop/index.tsx"), "/shop");
  assert.equal(routeOf("shop/item.tsx"), "/shop/item");
  // And the container's spelling still works, because the build reports it.
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
  // RE-ANCHORED 2026-09-03: the call was `…, aSrc, "addon")` and now carries
  // the job's clock after the mode (`"addon", undefined, aJob && aJob.budget`),
  // so `"addon")` no longer closes it. The property is the MODE argument:
  // addon mode is what makes the model return only what it touched.
  assert.match(b, /generateSitePages\(env, briefWithLayout\(\{[\s\S]*?\}\), aSpec, [^\n]*?, aSrc, "addon"[,)]/,
    "generateSitePages is not called in addon mode — it would re-emit every page");
});

test("the addon lane provisions ONLY on first touch of the backend, and charges only after the work lands", () => {
  const raw = addonBlock();
  const b = raw.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => " ".repeat(m.length));
  assert.equal(b.length, raw.length, "blanking must preserve offsets");
  // RE-ANCHORED 2026-09-03. This held `!b.includes("ensureSiteBackend")` —
  // "the site already has a database; provisioning here would be a second
  // path that can create a Neon project". The owner's call moved the whole
  // backend onto this step ("if customer touches it then neon db is created"),
  // so the lane DOES provision now — through the build route's own call, the
  // one path that claims the slug atomically and drops an orphaned project —
  // and the property that survives is the narrow one: ONLY when a backend
  // tier was designed AND the site has no database. One call, under exactly
  // that guard, and nothing on the page-only path reaches it.
  const provs = [...b.matchAll(/ensureSiteBackend\(/g)];
  assert.equal(provs.length, 1, "the addon lane provisions in " + provs.length + " places — one path that can create a Neon project");
  const prov = provs[0].index;
  const tier = b.lastIndexOf("if (aBackend.length) {", prov);
  const guard = b.lastIndexOf("if (!adb) {", prov);
  assert.ok(tier > 0 && guard > tier, "the provision is not under `no backend tier designed → no database → make one`");
  assert.ok(!/\n\s*\}\s*\n[\s\S]*\bif \(/.test(b.slice(guard, prov).replace(/if \(aGateProv && !aGateProv\.go\)[^\n]*/, "")), "something between the no-database guard and the provision closes it");
  assert.match(b.slice(prov, prov + 200), /ensureSiteBackend\(env, ownerSlug, ou\.id, aInstruction,/, "the provision is not for THIS site by ITS owner");
  // MONEY: one place it leaves the ledger (`aCharge`), the synchronous
  // page-path charge after the publish, the pageless charge after the
  // schema apply — never before the work that earns it.
  assert.equal((b.match(/collectCredits\(/g) || []).length, 1, "one place money leaves the ledger");
  const charge = b.indexOf("const aCharge = async (bill) => {");
  assert.ok(charge > 0 && b.indexOf("collectCredits(", charge) < b.indexOf("};", charge), "the ledger call is not inside aCharge");
  const pub = b.indexOf("recompileAndPublish(");
  const sync = b.indexOf("if (!aJob) aCost = await aCharge(aBill);");
  assert.ok(pub > 0 && sync > pub, "the synchronous charge does not come after the publish");
  const apply = b.indexOf("aMade = await applySiteSchema(adb, merged);");
  const pageless = b.indexOf("if (pageless(aAnswers)) {");
  assert.ok(apply > 0 && pageless > apply && pageless < pub, "the pageless answer is not after the schema apply and before the publish");
  assert.match(b.slice(pageless, b.indexOf("\n            }\n", pageless)), /await aCharge\(pageCredits\(\.\.\.aDesignUsage, aSeedUsage\)\)/, "the pageless answer does not bill the small calls through the one charge");
});

test("a failed addon leaves the site untouched, and an unusable one escalates", () => {
  const b = addonBlock();
  assert.match(b, /site is untouched/, "a failed compile must promise the live site survived");
  assert.match(b, /if \(!aMerge\.ok\) return aEscalate\(aMerge\.reason/,
    "nothing usable back must escalate rather than report success");
  // COMMENTS BLANKED FIRST. The first version of this loop listed
  // "no-backend" and kept passing after that refusal was deleted, because the
  // comment explaining the deletion quotes it — prose contains the thing it
  // forbids, the recorded trap, caught here on 2026-09-02.
  const code = b.replace(/^\s*\/\/[^\n]*$/gm, (m) => " ".repeat(m.length));
  for (const reason of ["empty", "unconfigured", "no-source", "no-meta"]) {
    assert.ok(code.includes('aEscalate("' + reason + '"'), "no escalation path for: " + reason);
  }
  // A SITE WITHOUT A DATABASE IS ADDED TO, NOT REFUSED (owner, 2026-09-02:
  // "add will always go in addon" — and a first build provisions none, so
  // that refusal sent every "add a QR code" on most of the platform to a
  // rebuild). The connection is read only under a guard, the spec is an
  // honest empty one, and a designed table on such a site is a named 422
  // rather than a climb.
  assert.ok(!code.includes('aEscalate("no-backend"'), "the addon still refuses a site with no database");
  const meta = code.indexOf("SELECT v FROM _meta WHERE k = 'schema'");
  assert.ok(meta > 0, "the addon no longer reads the site's schema");
  assert.match(code.slice(code.lastIndexOf("if (adb)", meta), meta), /^if \(adb\)/, "the schema read is not gated on there being a database");
  assert.match(code, /aSpec = adb \? null : \{ tables: \[\] \}/, "a site with no database is not given an honest empty spec");
  // RE-ANCHORED 2026-09-03: this held that a designed table on a site with
  // no database was refused by name (`no-database`) before any schema work.
  // The owner moved the backend onto this step and a site gets its database
  // on first touch, so the refusal is GONE — both copies — and what sits
  // where it sat is the provision: after the fold, before the schema work,
  // under the same `!adb`.
  assert.ok(!code.includes('error: "no-database"'), "the addon still refuses a table for want of a database — the first backend tier makes one now");
  const tiers = code.indexOf("const aBackend = backendDesigned(aDesigned);");
  const prov = code.indexOf("adb = await ensureSiteBackend(", tiers);
  const schema = code.indexOf("mergeAddonSchema(", tiers);
  assert.ok(tiers > 0 && prov > tiers && schema > prov, "the database is not made between the fold and the schema work");
  assert.match(code.slice(prov, schema), /aSpec = \{ tables: \[\] \};/, "a database just made is not described as storing nothing");
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
  // THE ESCALATE BRANCH GREW A SIDEWAYS HOP (2026-09-02): the add step names
  // the picture rung for a photograph, and the browser hands the same
  // sentence to the edit route with the hop already spent. This pinned the
  // one-line spelling `if (a.escalate) return fallback()`; what it holds is
  // that an escalate is handled before the failure check, that a named layer
  // other than the addon's own hops to `siteEdit` as handed-off, and that an
  // unnamed one still falls to the revise.
  // RE-ANCHORED 2026-09-03: the reply is read by `addonAnswer` now — one
  // reader for both paths, because the addon route files a queued job (run
  // 21's synchronous POST was reset at 257.6s) and the stored reply is the
  // same object — so the branch reads `o.site`, `o.d`, `o.instruction` off
  // the reader's options and the failure check reads `httpOk`, the response's
  // status however it arrived. The properties are unchanged: an escalate is
  // handled before the failure check, a named layer other than the addon's
  // own hops to `siteEdit` as handed-off, and an unnamed one falls to the
  // revise.
  const esc = b.indexOf("if (a.escalate) {");
  assert.ok(esc > 0, "the escalate branch is gone");
  const fail = b.indexOf("if (!httpOk || !a.ok)", esc);
  assert.ok(fail > esc, "the failure check no longer follows the escalate branch");
  const branch = b.slice(esc, fail);
  assert.match(branch, /layer !== 'addon'/, "an escalate naming the addon itself would hop into the edit route");
  // `[\s\S]*?` rather than `[^)]*`: the page argument is `String(a.page)`,
  // whose own `)` is inside the object — a flat scan where depth matters.
  assert.match(branch, /return siteEdit\(o\.site, \{ \.\.\.\(o\.d \|\| \{\}\), layer: layer,[\s\S]*?\}, o\.instruction, o\.origin, o\.finish, o\.fallback, undefined, true\)/,
    "the hop does not carry the customer's own sentence to the named layer as a handed-off edit");
  assert.match(branch, /return fall\(\);\s*\}\s*$/, "an escalate that names no layer no longer falls to the revise");
  // AND THE REVISE IS THE CUSTOMER'S OWN ASK, never a rewrite for a sentence
  // nobody re-typed: `fall` runs the fallback only when the ask is held.
  assert.match(b, /const canFall = typeof o\.fallback === 'function' && !!o\.instruction;/, "the fallback is not gated on holding the ask");
  // BOTH PATHS REACH THE ONE READER: the synchronous reply directly, the
  // queued one through the shared watcher with this reader named.
  assert.match(b, /return addonAnswer\(r && r\.ok, a, \{ site, d, instruction, origin, finish, fallback, slug \}\);/, "the synchronous reply is not read by addonAnswer");
  assert.match(b, /watchEditJob\(site, d, a\.job, origin, finish, fallback, instruction, undefined, addonAnswer\);/, "a queued addon is not watched with the addon reader");
  // BOTH ANCHORS PROVED FIRST: `indexOf` answers -1 for a missing one, and
  // `-1 < anything` passes exactly when the thing ordered has been renamed —
  // which it was, to `httpOk`, the status however the reply arrived.
  const escAt = b.indexOf("a.escalate");
  const failAt = b.indexOf("!httpOk || !a.ok");
  assert.ok(escAt > 0 && failAt > 0, "the escalate or the failure check is gone");
  assert.ok(escAt < failAt, "the escalation check must run before the failure check");
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
  // THE FIXTURE LIST IS THE WHOLE STRENGTH OF THIS TEST, and it had six entries
  // that all happened to be the simple shapes. TanStack's flat form
  // (`about.team.tsx` → `/about/team`) and its two underscore conventions were
  // in none of them, so when `routeOf` learned them this agreement check stayed
  // green while the client answered `/about.team` for a page really served at
  // `/about/team` — a fourth reading of one mapping, silently disagreeing. Every
  // shape `safeRoute` admits belongs here, including the ones nobody has seen a
  // model emit yet.
  for (const f of [
    "src/routes/index.tsx", "src/routes/gallery.tsx", "src/routes/shop/index.tsx", "src/routes/shop/item.tsx",
    "about.team.tsx", "src/routes/about.team.tsx", "about.index.tsx", "about_.team.tsx",
    "_layout.tsx", "__root.tsx", "shop/$id.tsx", "shop/about.team.tsx",
    "nonsense", "",
  ]) {
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
    // THE STATED ZERO SITS IN THE SAME CALL AS THE BRIEF. The page rung's call
    // grew (2026-09-02) to carry the stored tsx/marks/scene beside the brief,
    // and the addon's grew the same day to carry the designed addition and its
    // component manifest — so this is pinned neither to the call's close nor
    // to `images: 0` being the second key: what must be true is that the
    // brief is the first thing said and `images: 0` is said in the same call.
    const callAt = b.indexOf("briefWithLayout({");
    assert.ok(callAt > 0, name + " no longer composes its brief through briefWithLayout");
    const call = b.slice(callAt, b.indexOf("})", callAt));
    assert.match(call, /^briefWithLayout\(\{\s*brief: \w+/, name + " does not lead the call with the brief");
    assert.match(call, /\bimages: 0\b/, name + " does not tell the model there are no photographs");
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
  // NOT just the word `remove` — the surviving half of the paragraph contains it,
  // which a mutation proved by deleting the sentence that does the work and
  // passing anyway. The instruction has to be the one that ANSWERS the question
  // the model is actually asking itself.
  assert.match(block, /`remove` IS THE ONLY THING THAT DOES IT/,
    "the addon prompt never says which field deletes a page");
  assert.match(block, /NOT returning it does NOTHING here/,
    "the prompt does not contradict the not-returning habit head-on");
  assert.match(block, /a page you do not return is\s+KEPT/i, "the prompt does not correct the revise habit");
  // AND IT MUST BIND ON COST. Measured live: "add a gallery page" rewrote all
  // four existing pages for 28 credits, with the "return only what is new or
  // changed" rule already in the prompt and not binding. A number with the
  // consequence attached is what replaced it.
  assert.match(block, /TWO FILES IS THE NORMAL ANSWER/, "the prompt states no bound on how much comes back");
  assert.match(block, /thrown away/, "the prompt does not say an unasked-for rewrite is discarded");
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
  const reply = new Function([cut("problemNote"), cut("photoNote"), cut("sitePathOf"), cut("jobWords"), cut("addonReplyText")].join("\n") +
    "\nreturn addonReplyText;")();
  const gone = reply({ added: [], changed: [], removed: ["src/routes/prices.tsx"] });
  assert.match(gone, /removed \/prices/, gone);
  const kept = reply({ added: ["src/routes/g.tsx"], kept: [{ path: "src/routes/index.tsx", why: "home" }] });
  assert.match(kept, /I left \//, "a page we refused to delete is kept silently: " + kept);
  assert.match(reply({ added: [], problems: ["g.tsx: names a colour"] }), /names a colour/);
  // THE BACKEND TIERS (2026-09-03): what the engine made, by name; a job with
  // how often it runs, in a customer's words; the database the site got; a
  // function the database refused, with its reason; the key to paste, and
  // where. A pageless reply — a job alone — still reads as done.
  const backend = reply({ added: [], changed: ["src/routes/index.tsx"], functions: ["bookings_on_day"], apis: ["exchange_rate"],
    jobs: [{ name: "remind_tomorrow", fn: "bookings_due_tomorrow", everyMinutes: 1440 }, { name: "weekly", everyMinutes: 10080 }, { name: "often", everyMinutes: 45 }],
    provisioned: true, functionErrors: [{ name: "broken_one", error: "column d does not exist" }], needsSecrets: ["RATES_KEY"] });
  assert.match(backend, /added the function bookings_on_day/, backend);
  assert.match(backend, /connected exchange_rate/, backend);
  assert.match(backend, /scheduled remind_tomorrow \(every day\), weekly \(every week\), often \(every 45 minutes\)/, backend);
  assert.match(backend, /Your site has its own database now\./, backend);
  assert.match(backend, /The function broken_one couldn’t be created — column d does not exist\./, backend);
  assert.match(backend, /add RATES_KEY under Cloud → Secrets/, backend);
  assert.match(reply({ added: [], changed: [], moved: [], jobs: [{ name: "j", everyMinutes: 60 }] }), /^✅ Done — scheduled j \(every hour\)\./, "a job alone does not read as done");
  const plain = reply({ added: ["src/routes/g.tsx"], changed: [] });
  assert.ok(!/function|connected|scheduled|database|Secrets/.test(plain), "an ordinary addition mentions the backend: " + plain);
});

test("a removed page leaves the picker", () => {
  // ADDING WITHOUT REMOVING IS THE SAME LIE THE OTHER WAY ROUND: the customer is
  // told the page is gone, the picker still offers it, and opening it lands on a
  // route the site no longer has. Both halves live in one block so the next
  // field added cannot keep only the flattering one.
  const chat = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  // RE-ANCHORED 2026-09-03: the applying half lives in `applyAddonResult` and
  // the reading half in `addonAnswer` — one copy each, reached by both the
  // synchronous reply and a queued job's stored one. The two windows are the
  // two functions; the properties are the ones this always held.
  const at = chat.indexOf("function applyAddonResult(");
  assert.ok(at > 0, "applyAddonResult is gone");
  const body = chat.slice(at, chat.indexOf("\n}", at));
  assert.match(body, /Array\.isArray\(a\.removed\)/, "the client never reads what was removed");
  assert.match(body, /s\.pages = s\.pages\.filter\(/, "the picker keeps a page that no longer exists");
  // The refusal has to reach the customer rather than falling through to the
  // build — asserted on the ORDER, since `escalate` is checked first.
  const rd = chat.indexOf("function addonAnswer(");
  assert.ok(rd > 0, "addonAnswer is gone");
  const reader = chat.slice(rd, chat.indexOf("\n}", rd));
  assert.ok(reader.indexOf("if (a.escalate)") > 0 && reader.indexOf("if (a.escalate)") < reader.indexOf("a.msg"),
    "a refusal with a message is escalated before it is shown");
  assert.match(reader, /return applyAddonResult\(a, o\);/, "the reader no longer applies a published addition");
});

test("the route hands a considered refusal to the customer, not to the build lane", () => {
  // The wiring half of the same decision. `aEscalate` sets `escalate: true`, and
  // the client's first line is `if (a.escalate) return fallback()` — so a
  // refusal routed through it rebuilds the site for ~25 credits in answer to
  // "remove the home page". The branch must sit BEFORE the escalation.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = w.indexOf("const aMerge = mergeAddonPages(");
  assert.ok(at > 0, "the addon merge call moved");
  // TO A LANDMARK, NOT A BYTE COUNT. This read `at + 1400` and went red on a
  // correct change the moment a documented branch was added between the two
  // anchors — a test about how much prose sits in the region, on the recurring
  // own-goal this repo records as "a window sized in BYTES stops covering what
  // it was written for the moment comments are added above it".
  const end = w.indexOf("recompileAndPublish(env, {", at);
  assert.ok(end > at, "the publish that bounds this region moved — rescope this");
  const after = w.slice(at, end);
  const refuse = after.indexOf("if (!aMerge.ok && aMerge.msg)");
  const climb = after.indexOf("return aEscalate(aMerge.reason");
  assert.ok(refuse > 0, "a refusal with a reason still escalates to the build lane");
  assert.ok(climb > 0, "the escalation is gone — a dead end must still reach the rung above");
  assert.ok(refuse < climb, "the escalation is checked first, so the refusal can never fire");
});

// ── an addon may not rewrite what it was not asked about ─────────────────────
//
// MEASURED LIVE, first run of `edit smoke`: "add a gallery page" came back
// having changed index, book, manage AND work — four of four existing pages —
// for 28 credits, a whole build's price for an addition. The prompt already said
// to return only what is new or changed. A rule a model is merely TOLD is not a
// rule; this is the same reasoning that put MAX_CLARIFY in code.

test("a rewrite nobody asked for is reverted, and named", () => {
  const gallery = page("gallery.tsx", "export default function G(){return <p>Work</p>;}");
  // index carries the new link — that is the ONE page this lane is allowed to
  // reach beyond the thing it adds. `book` was rewritten for no reason at all.
  const linked = { path: SITE[0].path, source: SITE[0].source.replace('"/book"', '"/gallery"') };
  const meddled = { path: SITE[1].path, source: 'export default function Book(){return <p>Book a chair with us today</p>;}' };
  const r = mergeAddonPages(SITE, [gallery, linked, meddled]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.added, ["src/routes/gallery.tsx"]);
  assert.deepEqual(r.changed, ["src/routes/index.tsx"], "the page carrying the link must survive");
  assert.deepEqual(r.reverted, ["src/routes/book.tsx"]);
  assert.equal(r.pages.find((p) => p.path === SITE[1].path).source, SITE[1].source,
    "the customer's own page was replaced by one they did not ask for");
});

test("…and it does NOT apply when nothing was added or removed", () => {
  // "Put testimonials on the home page" is an addon whose whole content is a
  // changed page — the prompt tells the model to do exactly that. There is no
  // route to point at, and reverting here would throw away the entire request.
  const edited = { path: SITE[0].path, source: SITE[0].source + "\n// testimonials" };
  const r = mergeAddonPages(SITE, [edited]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.changed, ["src/routes/index.tsx"]);
  assert.deepEqual(r.reverted, []);
});

test("a page that DROPPED a link to a removed page is never reverted", () => {
  // THE ORDERING TRAP, and the reason both sides of the comparison are checked.
  // On a removal the model's new source is the one with the link taken OUT, so
  // it mentions nothing; the STORED source is the one that still points at the
  // deleted route. Checking only the new source would revert exactly that page —
  // putting a `<Link to="/book">` back for a route that no longer exists, which
  // does not compile, on the one path where the removal loop has already checked
  // that nothing links to it.
  const unlinked = { path: SITE[0].path, source: 'const CHROME = { links: [] };\nexport default function Home(){return <p>Sharp Fade</p>;}' };
  const r = mergeAddonPages(SITE, [unlinked], ["src/routes/book.tsx"]);
  assert.deepEqual(r.removed, ["src/routes/book.tsx"], "kept: " + JSON.stringify(r.kept));
  assert.deepEqual(r.reverted, [], "the unlink was reverted — the site would not compile");
  assert.equal(r.pages.find((p) => p.path === SITE[0].path).source.includes('"/book"'), false);
});

test("reverting can never turn a real addon into a refusal", () => {
  // WRITTEN AS THE OPPOSITE ASSERTION FIRST, and it could not fire. The revert
  // only runs when something was added or removed — and both of those ARE
  // changes, so the set it guards can never be emptied into `no-change`. That is
  // a property of the ordering rather than a coincidence, and it is worth
  // pinning: a future edit that let the revert run unconditionally would make a
  // model whose only output was a rewrite report a publish of a byte-identical
  // site.
  const gallery = page("gallery.tsx", "export default function G(){return <p>Work</p>;}");
  const meddled = { path: SITE[1].path, source: 'export default function Book(){return <p>Different words</p>;}' };
  const r = mergeAddonPages(SITE, [gallery, meddled]);
  assert.equal(r.ok, true, "an addition survived its own revert pass: " + r.reason);
  assert.deepEqual(r.added, ["src/routes/gallery.tsx"]);
  assert.deepEqual(r.reverted, ["src/routes/book.tsx"]);

  // And with NO add and NO removal the rule does not run at all, so a lone
  // rewrite is still the request and still lands.
  const alone = mergeAddonPages(SITE, [meddled]);
  assert.equal(alone.ok, true);
  assert.deepEqual(alone.changed, ["src/routes/book.tsx"]);
  assert.deepEqual(alone.reverted, []);
});

test("a revert is reported all the way to the customer", () => {
  // A SILENT REVERT IS THE SAME PARTIAL THIS LANE HAS HAD TWICE. It is the
  // customer's own page being put back — and if they really did want it edited,
  // this sentence is the only way they find out it did not stick.
  assert.match(addonReply({ added: ["src/routes/g.tsx"], reverted: ["src/routes/book.tsx"] }),
    /I left \/book as it was/);
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(w, /reverted: aMerge\.reverted/, "the route computes the revert and never returns it");
  const chat = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  assert.match(chat, /a\.reverted/, "the client is never told a page was put back");
});

// ── ALTERING A TABLE THE SITE ALREADY HAS ────────────────────────────────────
//
// The whole reason this exists: the lane concatenated `[...prior, ...designed]`
// into `normalizeSchema`, whose dedup is first-declaration-wins, so `payment`
// and `publicView` on an existing table were dropped SILENTLY — which is why a
// site built without a price could never start taking money.

const priorTables = () => ([
  { name: "bookings", access: "collect", columns: [{ name: "customer", type: "text" }],
    unique: ["slot"], confirm: { to: "email", subject: "s", body: "b" } },
  { name: "menu", access: "display", columns: [{ name: "dish", type: "text" }] },
]);

test("a table the site does not have is appended whole, exactly as before", () => {
  const { tables, added, altered } = mergeAddonSchema(priorTables(), [
    { name: "gallery", access: "display", columns: [{ name: "caption", type: "text" }] },
  ]);
  assert.equal(tables.length, 3);
  assert.deepEqual(added, ["gallery"]);
  assert.deepEqual(altered, []);
  assert.equal(tables[2].access, "display", "a NEW table keeps the access it was designed with");
});

test("PAYMENT REACHES A TABLE THAT ALREADY EXISTS — the bug this closes", () => {
  const pay = { from: "bookings", amount: "price", currency: "GBP" };
  const { tables, added, altered } = mergeAddonSchema(priorTables(), [
    { name: "bookings", access: "collect", columns: [], payment: pay },
  ]);
  assert.deepEqual(tables[0].payment, pay);
  assert.deepEqual(added, [], "an existing table was not created");
  assert.deepEqual(altered, [{ table: "bookings", fields: ["payment"] }]);
});

test("publicView reaches one too", () => {
  const view = { columns: ["slot"], where: [], limit: 500 };
  const { tables } = mergeAddonSchema(priorTables(), [
    { name: "bookings", access: "collect", columns: [], publicView: view },
  ]);
  assert.deepEqual(tables[0].publicView, view);
});

test("A COMPELLED `access` IS DISCARDED ON AN EXISTING TABLE, and that is the safety property", () => {
  // `design_schema` requires ["name","access","columns"], so a designer asked to
  // make `bookings` payable MUST answer `access` — and an answer that is
  // compliance with a schema is not a decision about who may read a real
  // business's booking list. Trusting it publishes every customer's phone number.
  const { tables } = mergeAddonSchema(priorTables(), [
    { name: "bookings", access: "display", read: "public", write: "anyone", columns: [], payment: { from: "bookings", amount: "p" } },
  ]);
  assert.equal(tables[0].access, "collect", "the site keeps its own access level");
  assert.equal(tables[0].read, undefined);
  assert.equal(tables[0].write, undefined);
});

test("nothing else about an existing table moves — that is the rules layer's", () => {
  const { tables, altered } = mergeAddonSchema(priorTables(), [
    { name: "bookings", access: "collect", columns: [],
      confirm: { to: "customer", subject: "x", body: "y" }, sms: { to: "customer", body: "z" },
      unique: ["something_else"], maxRows: 3, retired: true },
  ]);
  assert.deepEqual(tables[0].confirm, { to: "email", subject: "s", body: "b" }, "the site's own confirmation survives");
  assert.equal(tables[0].sms, undefined);
  assert.deepEqual(tables[0].unique, ["slot"]);
  assert.equal(tables[0].maxRows, undefined);
  assert.equal(tables[0].retired, undefined);
  assert.deepEqual(altered, [], "and none of it counts as a change");
});

test("a new column is added to an existing table — the one old behaviour that was right", () => {
  const { tables, altered } = mergeAddonSchema(priorTables(), [
    { name: "bookings", access: "collect", columns: [{ name: "customer", type: "text" }, { name: "photo", type: "text" }] },
  ]);
  assert.deepEqual(tables[0].columns.map((c) => c.name), ["customer", "photo"]);
  assert.deepEqual(altered, [{ table: "bookings", fields: ["column photo"] }]);
});

test("A COLUMN IS NEVER REMOVED — _meta is what the data API derives from", () => {
  const { tables } = mergeAddonSchema(priorTables(), [
    { name: "bookings", access: "collect", columns: [{ name: "photo", type: "text" }] },
  ]);
  assert.ok(tables[0].columns.some((c) => c.name === "customer"),
    "dropping a column hides it from every read while the values sit in Postgres");
});

test("a table is never dropped", () => {
  const { tables } = mergeAddonSchema(priorTables(), [{ name: "bookings", access: "collect", columns: [] }]);
  assert.deepEqual(tables.map((t) => t.name), ["bookings", "menu"]);
});

test("the merge does not mutate the stored spec it was handed", () => {
  const prior = priorTables();
  mergeAddonSchema(prior, [{ name: "bookings", access: "collect", columns: [], payment: { from: "bookings", amount: "p" } }]);
  assert.equal(prior[0].payment, undefined, "a merge that edits its input corrupts _meta on a failed apply");
});

test("a designed table with no name is dropped rather than crashing the build", () => {
  const { tables, added } = mergeAddonSchema(priorTables(), [{ access: "display", columns: [] }, null, "menu"]);
  assert.equal(tables.length, 2);
  assert.deepEqual(added, []);
});

test("the two alterable fields are the two that need a PAGE, and nothing else", () => {
  assert.deepEqual(ADDON_TABLE_FIELDS, ["payment", "publicView"]);
});

test("a payable table survives normalizeSchema — the engine really receives it", async () => {
  const { normalizeSchema } = await import("../site-schema.mjs");
  const { tables } = mergeAddonSchema(priorTables(), [{
    name: "bookings", access: "collect",
    columns: [{ name: "price", type: "integer" }],
    payment: { from: "bookings", amount: "price", currency: "GBP" },
  }]);
  const t = normalizeSchema({ tables }).tables[0];
  assert.ok(t.payment, "this is the exact property the old concat dropped");
  assert.equal(t.access, "collect");
});

test("THE ROUTE USES THE MERGE, and reports what it CREATED rather than what was named", () => {
  // ANCHORED ON THE PROPERTY, NOT THE ARGUMENT LIST. The first draft pinned the
  // exact call `mergeAddonSchema(aSpec.tables || [], aDesigned.tables)` and went
  // red on a correct change one commit later — a test about word order, which
  // this repo has now recorded four times.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(w, /const folded = mergeAddonSchema\(/,
    "the addon lane no longer folds its designed schema over the stored one");
  assert.ok(!/tables: \[\.\.\.\(aSpec\.tables \|\| \[\]\), \.\.\.aDesigned\.tables\]/.test(w),
    "the old concat is back, so payment on an existing table is dropped again");
  assert.match(w, /aTables = folded\.added/,
    "the response names every table the designer mentioned, so it claims to have created one the site already had");
  assert.match(w, /import \{[^}]*mergeAddonSchema[^}]*\} from "\.\/builder\/site-addon\.mjs"/,
    "a call to a name that was never imported is a ReferenceError on the build path");
});

test("THE ADDON LANE HAS THE SEED NET, keeps the report, and bills the top-up on the one call", () => {
  // The build path grew the net on 2026-08-12 (the designer omits its own
  // required `seed` — measured twice) and this lane was left one step short of
  // the same promise: "add a specials menu" paid ~25 credits for a page over a
  // permanently-empty table, reported as success, with the seeding report
  // discarded so the failure could not name itself (2026-08-14 audit).
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = w.indexOf("const folded = mergeAddonSchema(");
  assert.ok(at > 0, "the addon schema block moved — rescope this");
  const end = w.indexOf("unlinkedPages(", at);
  assert.ok(end > at, "the addon response moved — rescope this");
  const lane = w.slice(at, end);

  // The net, NARROWED to the tables this addon ADDED — a re-declared existing
  // table is skipped by seedSiteRows when it already has rows, so buying rows
  // for one spends a Haiku call on rows that are immediately discarded.
  assert.match(lane, /const aTop = await topUpSeed\(/, "the seed net is gone from the addon lane");
  assert.match(lane, /folded\.added\.includes\(t\.name\)/, "the net is not narrowed to the added tables");
  // The bought rows must reach the seeding — merged into what is planted, and
  // the report kept rather than thrown away.
  assert.match(lane, /aSeed = mergeSeed\(aSeed, aTop\.rows\)/, "the bought rows never reach the seed");
  assert.match(lane, /aSeeded = await seedSiteRows\(adb, merged, aSeed\)/,
    "the seeding runs on the un-topped seed, or its report is discarded again");
  // ORDER, with both anchors proven first — indexOf(a) < indexOf(b) passes
  // vacuously when either is missing.
  const topAt = lane.indexOf("await topUpSeed(");
  const seedAt = lane.indexOf("seedSiteRows(");
  assert.ok(topAt > 0 && seedAt > 0, "one of the two seed steps is gone");
  assert.ok(topAt < seedAt, "the net runs after the planting — its rows arrive too late to be planted");

  // Billed on the SAME variadic call as the design and pages usages: one bill,
  // one rounding, one floor — a third separately-rounded charge is the exact
  // overbilling that call was rewritten to end.
  // `aDesignUsage` IS A LIST SINCE THE ADD STEP (2026-09-02) — the picker's
  // call and one per kind — and it is SPREAD onto the same variadic call, so
  // the property this holds is unchanged: every model call of the addon on
  // one bill, one rounding, one floor.
  assert.match(w, /pageCredits\(\.\.\.aDesignUsage, aGen && aGen\.usage, aSeedUsage\)/,
    "the top-up's usage is not billed, or is billed on its own rounding");

  // And the response says what happened — the build response's own three
  // fields, so an empty new table can name its cause without Cloudflare logs.
  // Anchored on the response object's own first field, not on `unlinkedPages`
  // — the seed fields sit above it in the literal.
  const respAt = w.indexOf("added: aMerge.added", at);
  assert.ok(respAt > 0, "the addon response literal moved — rescope this");
  // LANDMARK TO LANDMARK, not a byte count (the recorded trap; this was
  // `respAt + 1400` and went red on 2026-09-03 when six honest fields — the
  // backend tiers — landed above the seed fields in the literal).
  const respEnd = w.indexOf("unlinkedPages(", respAt);
  assert.ok(respEnd > respAt, "the response literal's closing landmark is gone");
  const resp = w.slice(respAt, respEnd);
  assert.match(resp, /seeded: aSeeded \? aSeeded\.seeded : undefined/, "the response drops the row counts");
  assert.match(resp, /seedSkipped:/, "the response drops the skip reasons");
  assert.match(resp, /seedTopUp: aSeedTopUp \|\| undefined/, "the response cannot say the net fired");
});

test("the designer is TOLD it may name an existing table, and told access is discarded", () => {
  // Without this the capability exists and nothing can ask for it — the dead
  // feature shape this repo has recorded ten times. The access half matters
  // more: a designer that believes its compelled answer counts would write one.
  assert.match(EDIT_RULE, /table the site already has/i);
  assert.match(EDIT_RULE, /PAYMENTS/);
  assert.match(EDIT_RULE, /publicView/);
  assert.match(EDIT_RULE, /access[^.]*discarded/i);
  // AND THE ADD STEP'S OWN TABLE RULE SAYS THE SAME (2026-09-02): the addon
  // no longer reads `EDIT_RULE` — that is the revise's — so the promise had
  // to move with it, or the capability `mergeAddonSchema` keeps would be one
  // nothing can ask for again.
  const rule = addRule("table");
  assert.match(rule, /table the site already has/i, "the add step is not told it may name an existing table");
  assert.match(rule, /PAYMENT/, "…nor that payment is one of the things it may give one");
  assert.match(rule, /public view/i, "…nor a public view");
  assert.match(rule, /access[^.]*discarded/i, "…nor that an access answer on an existing table is discarded");
});

// ── THE SPEC-LEVEL TIERS ─────────────────────────────────────────────────────
//
// The route passed `{ tables: … }` and nothing else, so `functions`, `apis` and
// `jobs` never reached `normalizeSchema` at all — the entire "the model writes
// the backend" tier unreachable on any site after its first build.

const FN = { name: "hook_stripe", args: [{ name: "payload", type: "jsonb" }], returns: "void", body: "BEGIN END;", internal: true };
const API = { name: "rates", url: "https://example.com/r" };

test("A FUNCTION THE DESIGNER DECLARES REACHES THE SPEC — the tier this unblocks", () => {
  const { spec, declared } = mergeAddonSchema(priorTables(), { tables: [], functions: [FN] });
  assert.deepEqual(spec.functions, [FN]);
  assert.ok(declared.includes("functions"));
});

test("a third-party API declaration reaches it too", () => {
  const { spec } = mergeAddonSchema(priorTables(), { tables: [], apis: [API] });
  assert.deepEqual(spec.apis, [API]);
});

test("a build that declares none sends exactly what it sent before", () => {
  const { spec, declared } = mergeAddonSchema(priorTables(), { tables: [] });
  assert.deepEqual(Object.keys(spec), ["tables"], "an empty tier must not appear as an empty list");
  assert.deepEqual(declared, []);
});

test("an empty list is not a declaration", () => {
  const { spec } = mergeAddonSchema(priorTables(), { tables: [], functions: [], apis: null });
  assert.equal(spec.functions, undefined);
  assert.equal(spec.apis, undefined);
});

test("the three tiers are the ones that were dropped, and rate limits are deliberately not among them", () => {
  assert.deepEqual(ADDON_SPEC_FIELDS, ["functions", "apis", "jobs"]);
  assert.ok(!ADDON_SPEC_FIELDS.includes("rateLimits"),
    "an addon does not ask for rate limits and the erase semantics are a separate question");
});

test("the merge still takes a bare table array, so nothing that called it the old way breaks", () => {
  const { tables, added } = mergeAddonSchema(priorTables(), [{ name: "gallery", access: "display", columns: [] }]);
  assert.equal(tables.length, 3);
  assert.deepEqual(added, ["gallery"]);
});

test("A DECLARED FUNCTION SURVIVES normalizeSchema — measured, because it did not before", async () => {
  const { normalizeSchema } = await import("../site-schema.mjs");
  const { spec } = mergeAddonSchema(priorTables(), { tables: [], functions: [FN], apis: [API] });
  const n = normalizeSchema(spec);
  assert.equal((n.functions || []).length, 1, "this is the exact tier the old `{tables}` call dropped");
  assert.equal((n.apis || []).length, 1);
  // …and the shape the route USED to send drops both, or the assertion above
  // passes against a normaliser that would have worked all along.
  const oldWay = normalizeSchema({ tables: spec.tables });
  assert.equal((oldWay.functions || []).length, 0);
  assert.equal((oldWay.apis || []).length, 0);
});

test("THE ROUTE HANDS OVER THE WHOLE DESIGNED SPEC", () => {
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(w, /mergeAddonSchema\(aSpec\.tables \|\| \[\], aDesigned\)/,
    "the route still passes aDesigned.tables, so functions and apis are dropped again");
  assert.match(w, /normalizeSchema\(folded\.spec\)/,
    "the route rebuilds a tables-only object, which throws the tiers away after the merge kept them");
});

test("`routeOf` CAN READ WHAT `validatePages` STORES", () => {
  // THE GUARD THAT WAS MISSING, and it is a composition rather than a second
  // fixture. `validatePages` decides the path a page is stored under and
  // `routeOf` is what reads it back; two hand-written fixtures agreed with each
  // other and with neither. Driving the real producer into the real consumer is
  // the only form of this that cannot drift.
  //
  // What it cost: the `page` edit layer looked its target up with
  // `routeOf(p.path) === wantRoute`, so it matched nothing, answered `no-page`
  // and escalated EVERY page edit to a ~25-credit addon. Found live 2026-08-12
  // on a deletion that had arrived at the right layer with the right route.
  const stored = validatePages({
    pages: [
      { path: "src/routes/index.tsx", source: 'createFileRoute("/")' },
      { path: "gallery.tsx", source: 'createFileRoute("/gallery")' },
      { path: "routes/shop/index.tsx", source: 'createFileRoute("/shop")' },
    ],
  }, { partial: true }).pages;
  assert.equal(stored.length, 3, "the fixture no longer survives validation — rescope this");
  assert.deepEqual(stored.map((p) => routeOf(p.path)), ["/", "/gallery", "/shop"],
    "a stored page has no route, so nothing that looks one up by route can find it");
  // The property, stated: every page that can be stored can be addressed.
  for (const p of stored) assert.notEqual(routeOf(p.path), "", p.path + " is stored and unaddressable");
});

// ── A LIST REORDERED ON ONE PAGE THAT OTHER PAGES ALSO SHOW ─────────────────

test("rowLists reads the table, the column and the direction", () => {
  assert.deepEqual(
    rowLists('const d = useRows<Dish>("dishes", { order: "name", dir: "asc" });'),
    [{ table: "dishes", order: "name", dir: "asc" }]);
  assert.deepEqual(
    rowLists('const a = usePublicRows<Slot>("appointments", { order: "slot_time", dir: "desc" });'),
    [{ table: "appointments", order: "slot_time", dir: "desc" }]);
  // A list with no options at all is still a list — `useRows<Deal>("deals")` is
  // three of the thirteen calls in the real generated pages.
  assert.deepEqual(rowLists('useRows<Deal>("deals")'), [{ table: "deals", order: "", dir: "" }]);
});

test("A CALL WITH NO LITERAL TABLE IS SKIPPED rather than guessed at", () => {
  // One real call takes a computed argument. A wrong reading becomes a sentence
  // telling an owner their menu appears on a page it does not.
  assert.deepEqual(rowLists("useRows<Row>(tableName, { order: \"id\" })"), []);
  assert.deepEqual(rowLists("useRows(props.table)"), []);
});

test("an `order` belonging to the NEXT list is not read as this one's", () => {
  const src = 'useRows<A>("a");\nconst b = useRows<B>("b", { order: "name", dir: "asc" });';
  assert.deepEqual(rowLists(src), [
    { table: "a", order: "", dir: "" },
    { table: "b", order: "name", dir: "asc" },
  ]);
});

test("orderingMoved names a table whose order changed AND that another page lists", () => {
  const before = 'useRows<Dish>("dishes", { order: "name", dir: "asc" });';
  const after = 'useRows<Dish>("dishes", { order: "price", dir: "asc" });';
  const other = { path: "menu.tsx", source: 'useRows<Dish>("dishes", { order: "name", dir: "asc" });' };
  assert.deepEqual(orderingMoved(before, after, [other]), ["dishes"]);
});

test("...and says nothing when no other page lists it", () => {
  const before = 'useRows<Dish>("dishes", { order: "name" });';
  const after = 'useRows<Dish>("dishes", { order: "price" });';
  assert.deepEqual(orderingMoved(before, after, [{ path: "x.tsx", source: 'useRows<Other>("other")' }]), []);
  assert.deepEqual(orderingMoved(before, after, []), []);
});

test("KEYED ON THE ORDERING HAVING MOVED, not on the table merely appearing", () => {
  // A page edit that changes the wording around a list must not produce a
  // sentence about sort order.
  const src = 'useRows<Dish>("dishes", { order: "name", dir: "asc" });\n<h1>Our menu</h1>';
  const reworded = 'useRows<Dish>("dishes", { order: "name", dir: "asc" });\n<h1>The menu</h1>';
  assert.deepEqual(orderingMoved(src, reworded, [{ path: "m.tsx", source: src }]), []);
});

test("a direction change on its own counts", () => {
  const before = 'useRows<Post>("posts", { order: "id", dir: "asc" });';
  const after = 'useRows<Post>("posts", { order: "id", dir: "desc" });';
  assert.deepEqual(orderingMoved(before, after, [{ path: "b.tsx", source: before }]), ["posts"]);
});

test("a list the page did not have before is not a REORDER", () => {
  // Adding a list is an ordinary page edit; only a list that already existed and
  // now sorts differently is the thing this reports.
  const after = 'useRows<Dish>("dishes", { order: "price" });';
  assert.deepEqual(orderingMoved("", after, [{ path: "m.tsx", source: after }]), []);
});

test("driven over the pages the generator actually wrote", () => {
  // The only corpus here written by the thing being read. It is also where the
  // multi-page case comes from: `services` is listed on BOTH reference pages.
  const dir = new URL("../builder/lovable/template/src/routes/", import.meta.url).pathname;
  const idx = fs.readFileSync(dir + "index.tsx", "utf8");
  const book = fs.readFileSync(dir + "book.tsx", "utf8");
  const onIdx = rowLists(idx).map((l) => l.table);
  const onBook = rowLists(book).map((l) => l.table);
  assert.ok(onIdx.includes("services"), "index lists services: " + onIdx);
  assert.ok(onBook.includes("services"), "book lists services: " + onBook);
  // So reordering it on one really would leave the other disagreeing.
  const reordered = idx.replace(/order: "price"/, 'order: "name"');
  assert.notEqual(reordered, idx, "the fixture still carries the order this rewrites");
  assert.deepEqual(orderingMoved(idx, reordered, [{ path: "book.tsx", source: book }]), ["services"]);
});

test("the page layer computes it and BOTH ends of the wire carry it", () => {
  // Computed and rendered by nothing is this repo's most-recorded failure — the
  // build reply's `notes`, `oneClickBlocked`, the four ticked steps.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(w, /import \{[^}]*orderingMoved[^}]*\} from "\.\/builder\/site-addon\.mjs"/);
  assert.match(w, /const alsoOn = orderingMoved\(target\.source, wrote\.source, eSrc, target\.path\);/);
  assert.match(w, /reordered: alsoOn\.length \? alsoOn\.slice\(0, 4\) : undefined,/);
  const c = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  assert.match(c, /Array\.isArray\(e\.reordered\)/);
  assert.match(c, /listed on other pages too/);
});

test("THE EDITED PAGE EXCLUDES ITSELF — otherwise every reorder reports as shared", () => {
  // The edited page's own new list always matches, so without this the sentence
  // is noise on the majority of edits. It lived in the caller as a `.filter()`
  // one line below the call, where only a source-read could see it, and a
  // mutation deleting it survived — so it moved into the function.
  const before = 'useRows<Dish>("dishes", { order: "name" });';
  const after = 'useRows<Dish>("dishes", { order: "price" });';
  const pages = [{ path: "index.tsx", source: after }, { path: "menu.tsx", source: 'useRows<X>("other")' }];
  assert.deepEqual(orderingMoved(before, after, pages, "index.tsx"), []);
  // And it still finds a genuine second page.
  pages.push({ path: "specials.tsx", source: before });
  assert.deepEqual(orderingMoved(before, after, pages, "index.tsx"), ["dishes"]);
});

test("an options object with no `order` does not borrow the NEXT list's", () => {
  // The window has to stop at this call's own `);`. Unbounded, a list carrying
  // only a `limit` reads the order of whatever list follows it.
  const src = 'useRows<A>("a", { limit: 5 });\nconst b = useRows<B>("b", { order: "name", dir: "asc" });';
  assert.deepEqual(rowLists(src), [
    { table: "a", order: "", dir: "" },
    { table: "b", order: "name", dir: "asc" },
  ]);
});

// ── A CONSIDERED REFUSAL FROM THE MODEL DOES NOT CLIMB THE LADDER ────────────
//
// MEASURED LIVE, TWICE, TWO DAYS APART. `edit smoke` asked for "a gallery page
// showing photographs of our work" against a fixture whose `/work` page IS that
// gallery and is already in the header. The model correctly returned no files —
// and `nothing-returned` escalated, so asking for something the site already has
// rewrote every page of it for ~25 credits. Byte-identical failures on
// 2026-08-16 and 2026-08-18 is what ruled out generator variance.

test("the addon reports the model's own note instead of escalating", () => {
  // The rule is already written one branch up — "'Remove the home page' has an
  // answer, and sending it up rebuilds a customer's site, for ~25 credits" — and
  // it covered our merge's refusals and not the model's, which is the commonest
  // case of it by far.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = w.indexOf("const aMerge = mergeAddonPages(aSrc, aValid.pages, aRemove);");
  assert.ok(at > 0, "the addon merge moved — rescope this");
  const win = w.slice(at, w.indexOf("recompileAndPublish(env, {", at));

  // THE NOTE IS READ OFF THE GENERATION, not invented here.
  assert.match(win, /aGen\.input\.notes === "string"/,
    "the model's note is not read, so a considered refusal cannot be told from a failure");
  // AND IT ANSWERS RATHER THAN ESCALATING — 422 with the note as the message.
  assert.match(win, /aMerge\.reason === "nothing-returned" && aNote/,
    "the refusal branch is gone or no longer requires a note");
  // …AND IT COMES BEFORE THE ESCALATION, or it can never fire.
  const refusal = win.indexOf('aMerge.reason === "nothing-returned"');
  const climb = win.indexOf("return aEscalate(aMerge.reason");
  assert.ok(refusal > 0 && climb > 0 && refusal < climb,
    "the refusal must be decided before the escalation, or the ladder wins every time");
});

test("NOTHING SAID WHY STILL ESCALATES, which is what keeps the recovery", () => {
  // A model that fell over writes no note, and that really is "this lane could
  // not answer" — the one question escalation exists to settle. Requiring the
  // note is what separates the two, so a branch that fired without one would
  // turn every generator failure into a dead end.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = w.indexOf("const aMerge = mergeAddonPages(aSrc, aValid.pages, aRemove);");
  const win = w.slice(at, w.indexOf("recompileAndPublish(env, {", at));
  assert.match(win, /if \(!aMerge\.ok\) return aEscalate\(aMerge\.reason/,
    "the unexplained-failure path no longer escalates");
});

test("the live check asks for a page the fixture does NOT have", () => {
  // The check failed deterministically for days with the code right, because a
  // hardcoded instruction collided with a REUSED fixture's existing pages. A
  // fresh site each run had whatever shape the generator gave it; a reused one
  // is fixed, so the collision is permanent — and invisible from the assertion,
  // which only says the addon did not succeed.
  const t = fs.readFileSync(new URL("../test/integration/edit-smoke.mjs", import.meta.url), "utf8");
  assert.match(t, /const haveRoutes = new Set\(\(b\.files \|\| \[\]\)\.map\(routeOfAdded\)/,
    "the addon instruction is no longer derived from what the site already has");
  assert.match(t, /WANTED\.find\(\(w\) => !haveRoutes\.has\(w\.route\)\)/,
    "it no longer picks a route the site is missing");
  // AND THE ASSERTION BELOW IT IS NOT VACUOUS. `[].every(...)` is `true` and
  // `0 <= 5` is `true`, so it reported `ok` on both runs where the lane returned
  // nothing at all — in the one check meant to catch a lane running away with
  // the site.
  assert.match(t, /if \(a\.ok === true\) \{\s*\n\s*ok\("…and every page it changed was carrying the new link"/,
    "the changed-pages assertion can still pass on a run where the addon did nothing");
});
