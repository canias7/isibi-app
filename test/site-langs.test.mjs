// A SITE IN MORE THAN ONE LANGUAGE.
//
// THE MECHANISM WAS DECIDED BY A MEASUREMENT. A published site is ONE bundle in
// ONE Worker script — the dispatch namespace keys a script per slug and a Worker
// cannot load code at runtime — so a bilingual site cannot be two bundles. That
// left two designs: rewrite every literal string in model-written page code into
// a runtime lookup, or make the second language ORDINARY ROUTES in the same
// bundle. Driven through the real container and the real router before any of
// this was written: `es/index.tsx` and `es/book.tsx` build, and the packaged
// worker answers `/` and `/book` in English, `/es` and `/es/book` in Spanish and
// `/fr` with the site's own branded 404.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  resolveLangs, langPrefix, prefixRoute, prefixPagePath, langOfPath,
  stripLangPrefix, alternatesFor, relinkForLang, pageForLang, langLabel, MAX_EXTRA_LANGS, RESERVED_PREFIXES,
} from "../builder/site-langs.mjs";
import { collectStrings, readTranslation, translatePages, missingFrom, nextCache, TRANSLATE_TOOL } from "../builder/site-translate.mjs";
import { EDIT_FIELDS, currentStateNote } from "../builder/site-edit.mjs";

const ROOT = path.join(import.meta.dirname, "..");
const worker = fs.readFileSync(path.join(ROOT, "worker.js"), "utf8");
const server = fs.readFileSync(path.join(ROOT, "builder/build-server.mjs"), "utf8");
const root = fs.readFileSync(path.join(ROOT, "builder/lovable/template/src/routes/__root.tsx"), "utf8");
const header = fs.readFileSync(path.join(ROOT, "builder/lovable/template/src/components/ui/site-header.tsx"), "utf8");
const switcherRaw = fs.readFileSync(path.join(ROOT, "builder/lovable/template/src/components/ui/lang-switch.tsx"), "utf8");
// COMMENTS BLANKED, LENGTH-PRESERVING, BEFORE ANYTHING IS ASSERTED. This file
// explains at length why `aria-current` is belt-and-braces — and that prose
// contains the string `aria-current="page"`, so a scan of the raw source
// matched the EXPLANATION and stayed green with the attribute deleted. Prose
// describing a thing contains that thing's spelling: the fifth time this repo
// has recorded it, and the first time inside a guard written the same day.
const switcher = switcherRaw
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + " ".repeat(m.length - p.length));

/* ── which languages, and where each one lives ───────────────────────────── */

test("the primary keeps its own addresses, and that is what makes this additive", () => {
  // EVERY URL AN EXISTING SITE HAS EVER PUBLISHED IS UNTOUCHED. The primary has
  // no prefix, so a customer's shared link, a search engine's index and every
  // stored page path keep working — the second language is purely additive, and
  // one deploy changes nothing about any site already live.
  const { langs } = resolveLangs("en-GB", ["es"], { routes: ["/", "/book"] });
  assert.deepEqual(langs[0], { tag: "en-GB", prefix: "", primary: true });
  assert.deepEqual(langs[1], { tag: "es", prefix: "es", primary: false });
  assert.equal(prefixPagePath("book.tsx", ""), "book.tsx");
  assert.equal(prefixRoute("/book", ""), "/book");
});

test("each refusal is a real failure it prevents", () => {
  const { langs, refused } = resolveLangs("en", ["zzzzzz", "es-MX", "api", "cy"], { routes: ["/", "/cy"] });
  const why = Object.fromEntries(refused.map((r) => [r.lang, r.why]));
  // `es` is already offered, so `es-MX` would want the same `/es` prefix and one
  // of the two would be unreachable. Refused rather than silently lengthened:
  // a site whose Brazilian pages live at `/pt` and its Portuguese at `/pt-pt` is
  // a site nobody asked for.
  const two = resolveLangs("en", ["es", "es-MX"], {});
  assert.equal(two.langs.length, 2);
  assert.equal(two.refused[0].why, "duplicate");
  assert.equal(why["api"], "reserved", "a language may not claim a segment something else answers on");
  // A PAGE THE SITE ALREADY HAS. `/cy` as a page is perfectly ordinary on an
  // English site, and it is exactly what a Welsh prefix would shadow — the
  // language's own pages would be unreachable from the day it was added.
  assert.equal(why["cy"], "page");
  assert.ok(refused.some((r) => r.why === "unreadable"), JSON.stringify(refused));
  // `es-MX` is the only one of the four that survives HERE: nothing before it
  // claimed `/es`. Its refusal is the pair above, which is the case that makes
  // it a duplicate — asserted there rather than conflated with these.
  assert.deepEqual(langs.map((l) => l.prefix), ["", "es"], JSON.stringify(langs));
});

test("the cap counts extras, and refusing one never loses the site", () => {
  const many = ["es", "fr", "de", "it", "pt"];
  const { langs, refused } = resolveLangs("en", many, {});
  assert.equal(langs.length, MAX_EXTRA_LANGS + 1);
  assert.ok(refused.every((r) => r.why === "cap"), JSON.stringify(refused));
  // NEVER THROWS. This runs on a build path, where losing one language must not
  // lose the site.
  for (const bad of [null, undefined, "es", 7, {}]) {
    assert.doesNotThrow(() => resolveLangs("en", bad, {}));
  }
  assert.ok(RESERVED_PREFIXES.has("api") && RESERVED_PREFIXES.has("assets"));
  assert.equal(langPrefix("pt-BR"), "pt");
  assert.equal(langPrefix("not a tag"), null);
  // AN EXTRA MAY NOT CLAIM THE PRIMARY'S OWN BASE. `en-US` beside an `en-GB`
  // site wants `/en`, which is a second copy of the whole site at a second set
  // of addresses in the same language — a duplicate-content problem the owner
  // never asked for, and one nothing else here would refuse.
  const same = resolveLangs("en-GB", ["en-US"], {});
  assert.equal(same.langs.length, 1, JSON.stringify(same.langs));
  assert.equal(same.refused[0].why, "duplicate");
});

test("a language is labelled in its OWN language, by its base subtag", () => {
  // A SWITCHER LABELLED IN THE LANGUAGE THE READER CANNOT READ is one they
  // cannot find, which is the whole point of it.
  assert.equal(langLabel("es", "es"), "Español");
  assert.equal(langLabel("fr", "fr"), "Français", "Intl lowercases in several languages; a nav item is a label");
  // THE BASE SUBTAG, NOT THE FULL TAG: `en-GB` resolves to "British English",
  // which is regional noise in a two-item nav — the reader is choosing a
  // language, not a dialect. Safe because two variants of one language can never
  // both be offered (asserted above), so the base can never be ambiguous.
  assert.equal(langLabel("en-GB", ""), "English");
  assert.equal(langLabel("pt-BR", "pt"), "Português");
  // An unusable answer falls back to the prefix in capitals — plain, and never
  // wrong. This ran in the container, where nothing could drive it.
  assert.equal(langLabel("zzzzzz", "zz"), "ZZ");
});

test("a pathname is matched on a WHOLE segment — /eshop is not Spanish", () => {
  const { langs } = resolveLangs("en", ["es"], {});
  assert.equal(langOfPath("/eshop", langs).tag, "en", "a startsWith here is the anchoring bug the hostname rewrite already recorded");
  assert.equal(langOfPath("/es", langs).tag, "es");
  assert.equal(langOfPath("/es/book", langs).tag, "es");
  assert.equal(langOfPath("/", langs).tag, "en");
  assert.equal(langOfPath("/book", langs).tag, "en");
  assert.equal(langOfPath("", langs).tag, "en");
  // …and back again, which is what the switcher is built on.
  assert.equal(stripLangPrefix("/es/book", langs), "/book");
  assert.equal(stripLangPrefix("/es", langs), "/");
  assert.equal(stripLangPrefix("/book", langs), "/book");
  assert.deepEqual(alternatesFor("/es/book", langs), [{ lang: "en", path: "/book" }, { lang: "es", path: "/es/book" }]);
});

/* ── the translated page ─────────────────────────────────────────────────── */

const SRC = `import { Link } from "@tanstack/react-router";
export const Route = createFileRoute("/book")({ component: P });
const CHROME = { name: "Sharp Fade", links: [{ label: "Menu", href: "/menu" }] };
function P() {
  return (
    <main className="ms-auto text-start">
      <h1>Book a chair</h1>
      <Link to="/menu#prices">Prices</Link>
      <a href="https://instagram.com/x">Instagram</a>
      <a href="tel:01132000000">Ring us</a>
      <a href="#find-us">Find us</a>
      <a href="/u/site/menu.pdf">Menu PDF</a>
    </main>
  );
}`;

test("a translated page declares its own route id, DERIVED FROM ITS PATH", () => {
  // THE ROUTE ID IS IN THE SOURCE, not only in the filename, so `es/book.tsx`
  // says `/es/book` rather than leaving the primary's `/book` in a file that is
  // not at that address. NOT load-bearing — measured on two real builds
  // differing only in that string, both build and both serve the Spanish page,
  // because `tsr generate` writes the tree from the FILE PATH. `route` on the
  // returned object is read as truth, though, and it was wrong for every page.
  //
  // NO `route` FIELD, DELIBERATELY, AND THAT IS THE WHOLE POINT OF THIS TEST.
  // `loadSiteSource` hands the spine `{path, source}` and nothing else, so an
  // earlier version of this test — which passed `route: "/book"` — was a fixture
  // more capable than reality: `bare` fell back to `"/"` for every page, the
  // `declared === bare` check was false for everything but the home page, and
  // `es/book.tsx` shipped still declaring `/book`. Found by mutation, and the
  // `setTotp` lesson in a route id.
  const p = pageForLang({ path: "book.tsx", source: SRC }, "es", ["/", "/book", "/menu"]);
  assert.equal(p.path, "es/book.tsx");
  assert.equal(p.route, "/es/book");
  assert.match(p.source, /createFileRoute\("\/es\/book"\)/);
  assert.doesNotMatch(p.source, /createFileRoute\("\/book"\)/);
  // An explicit route still wins, and the home page still resolves to the bare
  // prefix rather than to `/es/`.
  const home = pageForLang({ path: "index.tsx", source: `createFileRoute("/")` }, "es", ["/"]);
  assert.equal(home.route, "/es");
  assert.match(home.source, /createFileRoute\("\/es"\)/);
});

test("its internal links point at its OWN language, and nothing else moves", () => {
  // A TRANSLATED PAGE THAT LINKS AT THE PRIMARY THROWS THE VISITOR OUT OF THEIR
  // OWN LANGUAGE: they read the Spanish page, press what it calls "Reservar",
  // and land on the English form. The site works and the feature does not.
  const out = relinkForLang(SRC, "es", ["/", "/book", "/menu"]);
  // The nav's own links are an OBJECT PROPERTY (`href: "/menu"`) rather than a
  // JSX attribute, and both forms have to move — `linkSlots` learned the same.
  assert.match(out, /href: "\/es\/menu"/, "a nav link stayed in the primary language");
  assert.match(out, /to="\/es\/menu#prices"/, "a fragment must survive the prefix");
  // Everything that is NOT an internal route is left exactly as written.
  assert.match(out, /href="https:\/\/instagram\.com\/x"/);
  assert.match(out, /href="tel:01132000000"/);
  assert.match(out, /href="#find-us"/);
  assert.match(out, /href="\/u\/site\/menu\.pdf"/, "an upload is not a route and must not be prefixed");
  // …and a class name is not a link, however much it looks like one.
  assert.match(out, /className="ms-auto text-start"/);
});

test("`data-to` is not a link, and an already-prefixed one is not doubled", () => {
  // `\\b` matches between the hyphen and the `t` of `data-to=`, so a word
  // boundary here rewrites a data attribute that has nothing to do with routing.
  assert.equal(relinkForLang('<X data-to="/book" />', "es", ["/book"]), '<X data-to="/book" />');
  assert.equal(relinkForLang('<Link to="/es/book" />', "es", ["/book"]), '<Link to="/es/book" />');
  // A ROUTE THE TRANSLATED SET DOES NOT HAVE IS LEFT ALONE. The route tree is
  // typed, so `<Link to="/es/ghost">` with no file behind it is a COMPILE error
  // and the whole site is lost to it.
  assert.equal(relinkForLang('<Link to="/ghost" />', "es", ["/book"]), '<Link to="/ghost" />');
  assert.equal(relinkForLang(SRC, "", ["/menu"]), SRC, "the primary language rewrites nothing at all");
});

/* ── the words ───────────────────────────────────────────────────────────── */

const PAGES = [
  { path: "index.tsx", route: "/", source: `export const Route = createFileRoute("/")({ component: P });\nconst C = { name: "Sharp Fade", action: { label: "Book now", href: "/book" } };\nfunction P(){ return <main className="flex"><h1>A proper cut</h1></main>; }` },
  { path: "book.tsx", route: "/book", source: `export const Route = createFileRoute("/book")({ component: P });\nconst C = { name: "Sharp Fade", action: { label: "Book now", href: "/book" } };\nfunction P(){ return <h1>Book a chair</h1>; }` },
];

test("the strings are the site's words, deduplicated — never its code", () => {
  const { strings, dropped } = collectStrings(PAGES);
  assert.equal(dropped, 0);
  // DEDUPLICATED BECAUSE A SITE REPEATS ITSELF. "Book now" is in the header of
  // every page; translated twice it comes back as "Reservar" on one and
  // "Reserva" on another, which reads as two businesses.
  assert.equal(strings.filter((s) => s === "Book now").length, 1);
  for (const code of ["flex", "/book", "component", "createFileRoute"]) {
    assert.ok(!strings.includes(code), "`" + code + "` is code and was offered for translation");
  }
  assert.ok(strings.includes("A proper cut") && strings.includes("Book a chair"));
  // Truncation is REPORTED rather than silent, or a partly-translated site
  // publishes as a finished one.
  assert.equal(collectStrings(PAGES, { max: 2 }).dropped, strings.length - 2);
});

test("a wrong-length answer is refused WHOLESALE, never zipped as far as it goes", () => {
  // THE MAPPING IS POSITIONAL. An answer one item short does not translate n-1
  // strings — it puts every translation after the gap on the WRONG string, and
  // the result compiles perfectly and is nonsense. There is no partial credit.
  assert.equal(readTranslation({ strings: ["a", "b"] }, 3).why, "length");
  assert.equal(readTranslation({ strings: ["a", 7, "c"] }, 3).why, "shape");
  assert.equal(readTranslation(null, 3).why, "shape");
  assert.equal(readTranslation({ strings: "a,b,c" }, 3).why, "shape");
  assert.deepEqual(readTranslation({ strings: ["a", "b"] }, 2), { ok: true, strings: ["a", "b"] });
});

test("the pages come back translated, prefixed and relinked in one pass", () => {
  const { strings } = collectStrings(PAGES);
  const dict = { "A proper cut": "Un corte como debe ser", "Book now": "Reservar", "Book a chair": "Reserva una silla" };
  const out = translatePages(PAGES, "es", strings, strings.map((s) => dict[s] || s), { routes: ["/", "/book"] });
  assert.equal(out.failed, false);
  assert.deepEqual(out.pages.map((p) => p.path), ["es/index.tsx", "es/book.tsx"]);
  assert.match(out.pages[0].source, /Un corte como debe ser/);
  assert.match(out.pages[0].source, /createFileRoute\("\/es"\)/);
  assert.match(out.pages[0].source, /href: "\/es\/book"/);
  // CONSISTENT ACROSS PAGES, which is what one call for the whole site buys.
  assert.ok(out.pages.every((p) => /Reservar/.test(p.source)));
  // A NAME THE MODEL LEFT ALONE IS NOT AN EDIT. Rewriting a span with identical
  // text buys nothing and can only introduce a difference — and it has to be
  // asserted on the COUNT, because an edit that writes the same characters back
  // produces byte-identical output and is invisible any other way.
  assert.ok(out.pages.every((p) => /"Sharp Fade"/.test(p.source)));
  const changed = strings.filter((s) => dict[s] && dict[s] !== s).length;
  const occurrences = PAGES.reduce((n, p) => n + strings.filter((s) => dict[s] && dict[s] !== s && p.source.includes(s)).length, 0);
  assert.ok(changed > 0 && occurrences > 0);
  assert.equal(out.applied, occurrences, "an unchanged string was counted as an edit");
  // …and a class name is still a class name.
  assert.match(out.pages[0].source, /className="flex"/);
});

test("a refused batch is REPORTED, never published in the primary language", () => {
  // `applyEdits` refuses a whole batch rather than half-applying it, and that
  // refusal is kept rather than worked around: a site published in a MIXTURE of
  // two languages is worse than one published in the language it was written in.
  //
  // WHAT MUST NOT HAPPEN IS FALLING BACK TO THE UNTRANSLATED PAGES AND REPORTING
  // SUCCESS. `failed` is the only thing that distinguishes the two, and the
  // paths still have to be prefixed — handing back the primary's own paths would
  // OVERWRITE the primary pages with themselves on the publish that follows.
  // TWO PAGES AT ONE PATH is what forces it deterministically: `applyEdits`
  // keys by path, so the second page's offsets are checked against the first
  // page's source, the `from` does not match, and the whole batch is refused.
  const clash = [
    { path: "a.tsx", source: `function P(){ return <h1>Alpha heading here</h1>; }` },
    { path: "a.tsx", source: `function P(){ return <h1>Beta heading over here</h1>; }` },
  ];
  const { strings } = collectStrings(clash);
  const out = translatePages(clash, "es", strings, strings.map((s) => "ES:" + s), { routes: ["/"] });
  assert.equal(out.failed, true, "the refusal is unreachable, so nothing here proves anything");
  assert.equal(out.applied, 0);
  assert.ok(out.error, "a refusal with no reason cannot be diagnosed");
  assert.deepEqual(out.pages.map((p) => p.path), ["es/a.tsx", "es/a.tsx"],
    "a refused batch handed back the PRIMARY's own paths, which overwrite the primary pages on publish");

  // Nothing to translate at all is a CLEAN PASS, not a failure — otherwise a
  // site whose every string the model left alone would report as broken.
  const none = translatePages(PAGES, "es", collectStrings(PAGES).strings, collectStrings(PAGES).strings, { routes: ["/", "/book"] });
  assert.equal(none.failed, false);
  assert.equal(none.applied, 0);
  assert.deepEqual(none.pages.map((p) => p.path), ["es/index.tsx", "es/book.tsx"]);
});

test("the cache is what makes a second language affordable to keep", () => {
  // EVERY CHEAP EDIT REPUBLISHES — a typo fix, a colour change, a swapped
  // picture — and without this each one would re-translate the whole site to
  // keep the two halves in step. Keyed by the ENGLISH STRING, so a colour
  // change, which moves no words, costs NOTHING: zero misses, no model call.
  const cache = { "Book now": "Reservar", "A proper cut": "Un corte" };
  assert.deepEqual(missingFrom(cache, ["Book now", "A proper cut"]), []);
  assert.deepEqual(missingFrom(cache, ["Book now", "New heading"]), ["New heading"]);
  assert.deepEqual(missingFrom(null, ["x"]), ["x"], "a cold cache asks about everything");
  // REBUILT FROM THE CURRENT STRINGS, which is also the pruning: a sentence the
  // owner deleted stops being carried, so it cannot grow without bound.
  assert.deepEqual(nextCache(cache, ["Book now"], {}), { "Book now": "Reservar" });
  assert.deepEqual(nextCache(cache, ["Book now", "New"], { New: "Nuevo" }), { "Book now": "Reservar", New: "Nuevo" });
  // A STRING WITH NO TRANSLATION FALLS BACK TO ITSELF rather than being dropped,
  // or it is asked about again on every publish for ever.
  assert.deepEqual(nextCache({}, ["0113 200 0000"], {}), { "0113 200 0000": "0113 200 0000" });
});

test("the tool asks for an array of the same length, and says what to leave alone", () => {
  const d = TRANSLATE_TOOL.description;
  assert.match(d, /EXACTLY the same length/);
  // A business's own name, an address and a price must come back unchanged, or
  // a translated site renames the business.
  for (const keep of ["name", "address", "phone", "price"]) assert.ok(d.includes(keep), "the tool never says to keep a " + keep);
  assert.equal(TRANSLATE_TOOL.input_schema.properties.strings.type, "array");
});

/* ── the wiring ──────────────────────────────────────────────────────────── */

test("the designer can set it, and is TOLD what the site already offers", () => {
  assert.ok(EDIT_FIELDS.includes("langs"), "a language cannot be asked for at all");
  assert.match(worker, /langs: \{\s*\n\s*type: "array"/, "the look tool has no langs field");
  // `langs` IS THE WHOLE LIST, NOT AN ADDITION, so a designer not told a site is
  // already bilingual has every reason to answer `["cy"]` to "also add Welsh" —
  // dropping the Spanish it had, on a request that was purely additive.
  assert.match(currentStateNote({ brand: "X", langs: ["es"] }), /other languages it is offered in: es/);
  // STATED AS "none" RATHER THAN OMITTED, because an absent line reads as an
  // omission rather than as an answer — the `usePublicRows: YES/NO` lesson.
  assert.match(currentStateNote({ brand: "X" }), /other languages it is offered in: none/);
  // …and a FIRST BUILD adds nothing at all, which is why the line is decided
  // after the emptiness check rather than pushed with the rest.
  assert.equal(currentStateNote({}), "");
  assert.equal(currentStateNote(null), "");
});

test("the container bakes the list, with each language's OWN direction", () => {
  // THE PROPERTY, NOT THE SPELLING: both names are imported from the module
  // that owns them. This was pinned to `{ langLabel, resolveLangs }` and went
  // red on 2026-09-04 when `langPrefix` joined the same line for the render
  // check's route order (task #80) — a guard reporting a feature as broken
  // for an honest third name.
  assert.match(server, /import \{[^}]*\blangLabel\b[^}]*\} from "\.\/site-langs\.mjs"/,
    "langLabel is used without being imported — a ReferenceError on the build path");
  assert.match(server, /import \{[^}]*\bresolveLangs\b[^}]*\} from "\.\/site-langs\.mjs"/,
    "resolveLangs is used without being imported — a ReferenceError on the build path");
  assert.match(server, /const resolvedLangs = resolveLangs\(langValue,/);
  // AN ENGLISH SITE WITH AN ARABIC SECOND LANGUAGE needs `/ar` to read right to
  // left while `/` reads left to right — measured on a real build. Only
  // expressible because the kit is on logical utilities.
  assert.match(server, /dir: dirFor\(l\.tag\)/, "every language must carry its own direction, not the site's");
  // EMPTY UNLESS THE SITE REALLY IS MULTILINGUAL. That is what makes every site
  // published before this render byte-identically.
  assert.match(server, /resolvedLangs\.length < 2 \? \[\]/);
  // THE WIRE, AT BOTH ENDS, because this is the layer where this repo has
  // recorded twelve features that were correct and reachable by nothing. The
  // list arriving over the wire has to REACH `writeSiteBrand`, and the value it
  // computes has to be what is WRITTEN — a mutation dropping either left every
  // assertion above perfectly green and no site bilingual.
  assert.match(server, /writeSiteBrand\(\{[^}]*\blangs: payload\.langs\b/,
    "the container never receives the language list");
  const decl = server.match(/'export const SITE_LANGS[^\n]*\n\s*(\S[^\n]*)/);
  assert.ok(decl && decl[1].includes("JSON.stringify(langsValue)"),
    "SITE_LANGS is computed and then written as something else: " + (decl && decl[1]));
});

test("the document reads its language off the ROUTE, from ONE reading", () => {
  assert.match(root, /function useActiveLang\(\)/);
  assert.match(root, /SITE_LANGS\.find\(\(l\) => l\.prefix === seg/, "the active language is not matched on a whole segment");
  const openTag = (root.match(/<html [^>]*>/) || [""])[0];
  const [, langExpr] = openTag.match(/\blang=\{([^}]+)\}/) || [];
  const [, dirExpr] = openTag.match(/\bdir=\{([^}]+)\}/) || [];
  assert.ok(langExpr && dirExpr, openTag);
  assert.equal(langExpr.split(".")[0], dirExpr.split(".")[0], "two readings can disagree about which language a page is in");
  // A SITE WITH ONE LANGUAGE ANSWERS EXACTLY WHAT IT ANSWERED BEFORE.
  assert.match(root, /SITE_LANG\b/);
  assert.match(root, /SITE_DIR\b/);
});

test("the switcher is rendered BY the header, never passed in", () => {
  // A SWITCHER THE GENERATOR MUST ADD IS ONE IT EVENTUALLY FORGETS, and
  // forgetting leaves a bilingual site whose second half is reachable only by
  // typing a URL — the `safe-image` and `spam-guard` rule.
  assert.match(header, /import \{ LangSwitch \}/);
  assert.equal((header.match(/<LangSwitch/g) || []).length, 2,
    "the switcher must be in the desktop nav AND the mobile sheet — the nav is `hidden md:flex`");
  // …and the sheet has to appear for a one-page bilingual site, or a phone has
  // no way at all to reach the other language.
  assert.match(header, /links\.length > 0 \|\| SITE_LANGS\.length > 1/);
  // IT RENDERS NOTHING ON A SITE WITH ONE LANGUAGE.
  assert.match(switcher, /SITE_LANGS\.length < 2\) return null/);
  // IT LINKS TO THE SAME PAGE, not to the other language's front door.
  assert.match(switcher, /bare === "\/" \? "\/" \+ l\.prefix : "\/" \+ l\.prefix \+ bare/);
  // The label is written in the language it OFFERS, so the link says so.
  assert.match(switcher, /lang=\{l\.lang\}/);
  assert.match(switcher, /dir=\{l\.dir\}/);
  // WHICH LANGUAGE YOU ARE ON IS MATCHED ON A WHOLE SEGMENT. `/eshop` is not
  // Spanish, and a `startsWith` here is the anchoring mistake the hostname
  // rewrite already recorded once — asserted at both ends, because a scan that
  // merely finds a split passes on a file that also carries the wrong form.
  assert.match(switcher, /path\.split\("\/"\)\.filter\(Boolean\)\[0\]/,
    "the active language is not matched on a whole segment");
  assert.doesNotMatch(switcher, /startsWith\("\/" \+ l\.prefix/,
    "a prefix match here reads /eshop as Spanish");
  // NOT COLOUR ALONE for which one you are on. The VISIBLE half is what this
  // asserts, because that is the half `current` really drives: `aria-current`
  // is set by `Link` itself, measured on a real render — removing our copy of
  // it leaves the served HTML byte-identical — so asserting only that attribute
  // would be a test of something with no effect.
  assert.match(switcher, /current \? "font-medium text-foreground underline/,
    "which language you are on is carried by colour alone");
  assert.match(switcher, /aria-current=/);
});

test("the spine translates, caches, and never fails a publish over it", () => {
  // HERE, ON THE SHARED SPINE, so it happens on EVERY publish: a text fix, a
  // colour change, a picture swap and a page rewrite all come through this one
  // function, and a second language regenerated on only some of them drifts out
  // of step with the first — silently, because both halves compile.
  const spine = worker.slice(worker.indexOf("async function recompileAndPublish"));
  const body = spine.slice(0, spine.indexOf("\n}\n"));
  // THE STORED LIST IS WHAT IS READ. Hardcoding it to `[]` leaves every other
  // assertion here green and no site bilingual — the langs never reach the
  // container, no translated page is produced, and a site that HAD a second
  // language quietly loses it on the next typo fix.
  assert.match(body, /const extraLangs = Array\.isArray\(look && look\.langs\) \? look\.langs : \[\]/,
    "the site's stored language list is never read");
  // …AND THE REFUSALS COME BACK WITH THEM. This pinned the destructure as
  // `{ langs: siteLangs }` alone — which was also the bug: `resolveLangs`
  // returns a per-language reason its own docstring calls "a real failure it
  // prevents", every reader kept only `langs`, and `mergeLook` had already
  // STORED the refused tag while `movedFields` reported the look as changed.
  // The customer was told it landed and got no switcher and no routes.
  assert.match(body, /const \{ langs: siteLangs, refused: langsRefused \} = resolveLangs\(/,
    "the spine destructures away the refusal reasons again");
  assert.match(body, /resolveLangs\(\(look && look\.lang\) \|\| "en", extraLangs/,
    "the stored list is read and then not passed to the resolver");
  assert.match(body, /missingFrom\(have, strings\)/, "the spine re-translates the whole site on every edit");
  // RE-ANCHORED 2026-09-04: the assembly moved into ONE function, `filesFor`,
  // so the repair round can compile a corrected list with its variants
  // re-derived — the loop only fills the cache now. The property is unchanged:
  // every variant `translatePages` writes lands in the files the container
  // is sent, off the cache the loop filled, for the first compile.
  const assemble = body.slice(body.indexOf("const filesFor = (list) => {"), body.indexOf("files = filesFor(pages);"));
  assert.ok(assemble.length > 50, "the file assembly is gone, or the first compile no longer uses it");
  assert.match(assemble, /translatePages\(list \|\| \[\], l\.prefix, strings, strings\.map\(/, "the variants are not translated off the cache");
  assert.match(assemble, /nextStrings\[l\.tag\]/, "the assembly does not read the cache the loop filled");
  assert.match(assemble, /for \(const tp of t\.pages\) f\[tp\.path\] = tp\.source/, "the translated pages never reach the build");
  assert.ok(body.indexOf("files = filesFor(pages);") < body.indexOf("let built = await compile();"), "the files are assembled after the compile that needs them");
  // RE-ANCHORED 2026-09-04: the payload is built once, before the fetch, as
  // `cPayload`, because the fetch sits inside a wait for container room and
  // may run more than once. The property — the assembled files are what the
  // container is sent — is read off the payload AND the fetch that carries it.
  assert.match(body, /const cPayload = JSON\.stringify\(\{\s*files, slug,/, "the container is not sent the assembled files");
  assert.match(body, /body: cPayload,/, "the payload is built and then not the one the fetch carries");
  assert.match(body, /langs: extraLangs\.length \? \{ extra: extraLangs, routes: primaryRoutes \} : undefined/);
  // A FAILED TRANSLATION IS NOT A FAILED PUBLISH: the pages fall back to the
  // cache and, for anything new, to the primary language.
  assert.match(body, /if \(got\.ok\)/);
  assert.doesNotMatch(body, /throw new Error\("translate/);
  // WRITTEN BACK ONLY WHEN IT MOVED, so an ordinary publish costs no database
  // write either.
  assert.match(body, /if \(langsChanged\)/);
  assert.match(body, /patchSiteConfig\(env, slug, db, \{ langStrings: nextStrings \}\)/,
    "the spine never writes the translation cache back");
});

test("THE BUILD PATH TRANSLATES, AND ONLY THEN SENDS THE LANGUAGES", () => {
  // THIS TEST USED TO HOLD THE OPPOSITE — "the build path deliberately sends no
  // languages" — and its reason was right about half of the problem: SITE_LANGS
  // with no translated routes behind it is a switcher pointing at a 404. The
  // other half was wrong. The spine proves translating AT PUBLISH is the
  // ordinary thing, and a build is a publish — so the old rule meant a first
  // build that asked for a bilingual site in as many words published
  // monolingual, and the designer's answer sat nowhere (the look store dropped
  // `langs` too, fixed the same day). What has to hold is not the ABSENCE of
  // `langs` but the PAIRING: the translated pages join `files` and `langs`
  // joins the payload in the same request, or neither.
  const build = worker.slice(worker.indexOf("async function buildAndPublishPages"));
  // ── BOTH LANDMARKS ASSERTED BEFORE THE SLICE (2026-08-29) ───────────────────
  //
  // This anchored on the literal `compile: async (pages)` and went red the day an
  // honest second argument arrived (`builtParts`, the components the kit does not
  // have). `indexOf` answered -1, `slice(-1, …)` gave `""`, and every assertion
  // below passed over an empty window while reporting that the build path had
  // stopped resolving languages — which nobody had touched. Two of this repo's
  // recorded traps in one line: a guard pinned to a SPELLING, and a window whose
  // landmark can silently go missing.
  //
  // Anchored on the property instead: the dep exists and takes the pages. An
  // argument added after that is somebody else's business.
  const depAt = build.indexOf("compile: async (pages");
  const reqAt = build.indexOf("http://build/build");
  assert.ok(depAt > 0, "the build path's compile dep is gone, so this window would scan nothing");
  assert.ok(reqAt > depAt, "the container request no longer follows the compile dep — the window is inside out");
  const dep = build.slice(depAt, reqAt);
  // The translation runs BEFORE the request is built — same resolvers as the
  // spine, into the same `files` map the payload carries.
  assert.match(dep, /resolveLangs\(lang \|\| "en", extraLangs/,
    "the build dep never resolves the site's languages");
  // RE-ANCHORED FOR TASK #88: the build's languages are translated through
  // `Promise.all` and written in an ordered fold, so the language is `r.l`
  // where it was `l`. The property is that the translated pages are still
  // built and still join `files` — either spelling satisfies it.
  assert.match(dep, /translatePages\(pages, (?:r\.)?l\.prefix/,
    "the build dep sends langs with no translated routes behind them — a switcher pointing at a 404");
  assert.match(dep, /for \(const tp of t\.pages\) files\[tp\.path\] = tp\.source;/,
    "the translated pages never join the files the container builds");
  // …and the payload's langs key is derived from the SAME list the translation
  // loop ran over, so the two halves cannot disagree about what was offered.
  // RE-ANCHORED 2026-09-04: the payload is built once BEFORE the fetch, as
  // `bPayload`, because the fetch sits inside a wait for container room and
  // may run more than once — so the window is the payload's own, from its
  // binding to the fetch that carries it, and the carry is asserted too.
  const pAt = build.indexOf("const bPayload = JSON.stringify({");
  assert.ok(pAt > depAt && pAt < reqAt, "the build payload is no longer built between the translation and the request");
  const payload = build.slice(pAt, reqAt);
  assert.match(payload, /langs: extraLangs\.length \? \{ extra: extraLangs, routes: primaryRoutes \} : undefined/,
    "the build payload does not carry the languages the dep just translated");
  assert.match(build.slice(reqAt, reqAt + 600), /body: bPayload,/, "the payload is built and then not the one the fetch carries");
  // The cache round-trips: read on the route, written back when it moved, so a
  // revise does not re-buy strings already answered.
  // ON THE ASSIGNMENT'S RIGHT-HAND SIDE — a mutant that read the value and
  // discarded it survived a match on the key alone: the cache then arrives null
  // on every revise and the whole site re-translates each time, slower and never
  // wrong, a Haiku call per language spent on strings already answered.
  assert.match(worker, /priorLangStrings = cfg\.config\.langStrings/,
    "the route reads the translation cache and throws it away");
  assert.match(dep, /if \(langsChanged\)/, "the cache is never written back");
  // THE ROUTE'S OWN THREADING, apart from the dep — not-called and
  // called-with-undefined are two deaths that look identical from inside the
  // dep: `langs` undefined makes `extraLangs` [] and the whole feature is off
  // with every spelling above still present. So the hop that fills it is held
  // separately, on the assignment's right-hand side.
  assert.match(worker, /langs: look\.langs,/, "the route never passes the stored languages to the build");
  assert.match(worker, /langStrings: priorLangStrings,/, "the route never passes the translation cache to the build");
  assert.match(worker, /const extraLangs = Array\.isArray\(langs\) \? langs : \[\];/,
    "the dep no longer derives its language list from the argument the route passes");
});

test("a failed round writes nothing into the cache, and a cache that was never translated reads as none (run 38, 2026-09-04)", async () => {
  const { untranslated } = await import("../builder/site-translate.mjs");
  // THE POISONING: a call that never answered left every missing string with
  // no translation, `nextCache` wrote each one in as itself, and from then on
  // nothing was missing — fretwork-1's Spanish and French were English under
  // both prefixes for three days and the loop never asked again.
  const have = { "Book now": "Reservar" };
  const strings = ["Book now", "A proper cut", "Ring us"];
  const afterFailure = nextCache(have, strings, null);
  assert.deepEqual(afterFailure, { "Book now": "Reservar" }, "a failed round wrote the primary's words in as translations");
  assert.deepEqual(missingFrom(afterFailure, strings), ["A proper cut", "Ring us"], "the strings the failed round never translated are not asked about again");
  // A string the model was ASKED about and left alone is still kept as itself
  // — the rule for names and numbers is unchanged.
  assert.deepEqual(nextCache({}, ["0113 200 0000"], { "0113 200 0000": "0113 200 0000" }), { "0113 200 0000": "0113 200 0000" });
  assert.deepEqual(nextCache({}, ["0113 200 0000"], {}), { "0113 200 0000": "0113 200 0000" }, "a round that answered leaves a hole where a string was declined");
  // THE HEALING: a cache whose every value is its key was never translated.
  assert.equal(untranslated({ "Book now": "Book now", "Ring us": "Ring us" }), true);
  assert.equal(untranslated({ "Book now": "Reservar", "Ring us": "Ring us" }), false, "one real translation reads as none");
  assert.equal(untranslated({}), false, "an empty cache is new, not poisoned");
  assert.equal(untranslated(null), false);
  assert.equal(untranslated("x"), false);
});
