// The site's language and its own mark.
//
// Two things every published site had in common and neither was true of it:
// `<html lang="en">` was hardcoded in the template, and all of them shared one
// favicon. Both are invisible to anyone building a site and obvious to the
// person it is for, which is exactly the class this repo keeps being bitten by.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { normalizeLang, initials, brandHue, initialsMark, applyIdentity, isWide, MAX_INITIALS } from "../builder/site-identity.mjs";

const TEMPLATE = fs.readFileSync(new URL("../builder/lovable/template/index.html", import.meta.url), "utf8");

/* ── the language tag ────────────────────────────────────────────────────── */

test("the ordinary tags are accepted", () => {
  assert.equal(normalizeLang("es"), "es");
  assert.equal(normalizeLang("fr"), "fr");
  assert.equal(normalizeLang("pt-BR"), "pt-BR");
  assert.equal(normalizeLang("zh-Hans"), "zh-Hans");
  assert.equal(normalizeLang("zh-Hans-CN"), "zh-Hans-CN");
  assert.equal(normalizeLang("cy"), "cy");
});

test("CASE IS CANONICALISED, not passed through", () => {
  // BCP-47 is language lowercase, script Titlecase, region UPPERCASE — and it is
  // not decoration: `zh-hans` is well-formed and matchers built on the
  // convention miss it. A model answers `PT-br` often enough to be worth
  // normalising rather than hoping.
  assert.equal(normalizeLang("ES"), "es");
  assert.equal(normalizeLang("PT-br"), "pt-BR");
  assert.equal(normalizeLang("zh-hANS-cn"), "zh-Hans-CN");
});

test("whitespace around a tag is not a different tag", () => {
  assert.equal(normalizeLang("  de  "), "de");
});

test("A THREE-DIGIT REGION IS REAL and is kept", () => {
  // `es-419` is Latin American Spanish — a UN M.49 area code, which is the one
  // region form that is not two letters. A rule written as `[a-z]{2}` refuses a
  // tag used by most of the Spanish-speaking world.
  assert.equal(normalizeLang("es-419"), "es-419");
});

test("ANYTHING THAT IS NOT A TAG IS REFUSED, never coerced", () => {
  // The value goes into an HTML attribute. Accepting only shapes that cannot
  // contain anything needing escaping means there is no escaping question to
  // get wrong — so the refusals are the security property, not a nicety.
  for (const bad of ["Spanish", "en_GB", "e", "english", "", "  ", "en-", "-en", "en--GB", "zh-Hans-CN-x-private"]) {
    assert.equal(normalizeLang(bad), null, JSON.stringify(bad) + " was accepted as a language");
  }
});

test("a tag carrying a quote or a tag is refused", () => {
  for (const bad of ['en" onload="x', "en'><script>", "en>", "en/*"]) {
    assert.equal(normalizeLang(bad), null, JSON.stringify(bad) + " reached the attribute");
  }
});

test("a non-string is refused rather than stringified", () => {
  // `String(["es"])` is `"es"`, which is the coercion bug this repo has already
  // recorded twice — once on a role and once on a table's access level.
  for (const bad of [["es"], { toString: () => "es" }, 7, null, undefined, true]) {
    assert.equal(normalizeLang(bad), null);
  }
});

/* ── the mark ────────────────────────────────────────────────────────────── */

test("two words give two letters and one word gives one", () => {
  assert.equal(initials("Sharp Fade Barbers"), "SF");
  assert.equal(initials("Zephyr"), "Z");
  assert.equal(initials("forno and co"), "FC");
});

test("the words that do not carry the name are dropped", () => {
  // "Forno & Co" is FC, not F&. The joining words are what a mark leaves out.
  assert.equal(initials("Forno & Co"), "FC");
  assert.equal(initials("The Rose and Crown"), "RC");
  assert.equal(initials("Bank of Dave"), "BD");
});

test("NON-LATIN NAMES KEEP THEIR OWN CHARACTERS", () => {
  // An `[A-Z]` filter gives a Greek or Cyrillic business an empty mark, which
  // is the exact failure this exists to prevent.
  assert.equal(initials("Καφενείο Ρόδος"), "ΚΡ");
  assert.equal(initials("Пекарня Хлеб"), "ПХ");
  assert.equal(initials("東京 寿司"), "東寿");
});

test("a name with nothing to take initials from returns empty", () => {
  for (const bad of ["", "   ", "★ ✦", "…", null, undefined, 7]) {
    assert.equal(initials(bad), "", JSON.stringify(bad) + " produced a mark");
  }
});

test("never more than two letters", () => {
  assert.equal(initials("One Two Three Four Five").length, MAX_INITIALS);
});

test("TWO NAMES THAT ARE ANAGRAMS DO NOT SHARE A COLOUR", () => {
  // A sum of char codes hashes "ab" and "ba" identically, and two salons on one
  // street are exactly the pair that would collide. FNV-1a does not.
  assert.notEqual(brandHue("Anna Lee"), brandHue("Lee Anna"));
  assert.notEqual(brandHue("ab"), brandHue("ba"));
});

test("the hue is stable and in range", () => {
  assert.equal(brandHue("Sharp Fade"), brandHue("Sharp Fade"));
  for (const n of ["a", "Sharp Fade", "Forno & Co", "", "东京"]) {
    const h = brandHue(n);
    assert.ok(Number.isInteger(h) && h >= 0 && h < 360, n + " hashed to " + h);
  }
});

test("the mark is a self-contained SVG carrying the initials", () => {
  const svg = initialsMark("Sharp Fade Barbers");
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /viewBox="0 0 32 32"/);
  assert.match(svg, />SF</);
  assert.match(svg, /<\/svg>$/);
});

test("A BRAND WITH NO LETTERS GETS NO MARK, rather than an empty square", () => {
  // null is the caller's signal to keep the template's own icon. An empty
  // rounded square is worse than the generic one it replaced.
  assert.equal(initialsMark("★"), null);
  assert.equal(initialsMark(""), null);
  assert.equal(initialsMark(null), null);
});

test("THE MARK CAN ONLY EVER CONTAIN LETTERS, whatever the brand is", () => {
  // The real safety property, and it is stronger than escaping: `initials`
  // takes the FIRST CHARACTER of each word and only keeps a word whose first
  // character is a letter, so nothing else can reach the SVG at all. The
  // `esc()` around it is belt-and-braces and says so in the source — asserting
  // that escaping HAPPENS would be asserting a thing that cannot fire, which
  // this codebase has recorded as reading like protection that is not there.
  //
  // The brand is the customer's and the file is served from the site's own
  // origin, so the property is worth driving adversarially rather than reasoning
  // about.
  for (const brand of ['<script>alert(1)</script>', 'x" onload="y', "&Amp; </text><script>", "'; DROP", "a<b>c"]) {
    const svg = initialsMark(brand);
    if (svg === null) continue;
    const text = />([^<]*)<\/text>/.exec(svg);
    assert.ok(text, "the mark for " + JSON.stringify(brand) + " has no text node");
    assert.match(text[1], /^\p{L}{1,2}$/u, JSON.stringify(text[1]) + " is not one or two letters");
  }
});

test("…and the mark for a hostile brand is still a valid single element", () => {
  const svg = initialsMark('<script>alert(1)</script>');
  assert.equal((svg.match(/</g) || []).length, (svg.match(/>/g) || []).length,
    "the icon's tags do not balance, so the brand broke out of it");
  assert.ok(!/<script/i.test(svg), "raw markup reached the icon");
});

test("the font stack ends somewhere that certainly exists", () => {
  // An SVG favicon renders in the browser's own context with no access to the
  // site's bundled fonts, so a stack naming only the site's heading face falls
  // back to whatever the browser picks — different on two machines.
  assert.match(initialsMark("Sharp Fade"), /sans-serif"/);
});

test("one letter is set larger than two", () => {
  const one = /font-size="(\d+)"/.exec(initialsMark("Zephyr"))[1];
  const two = /font-size="(\d+)"/.exec(initialsMark("Sharp Fade"))[1];
  assert.ok(Number(one) > Number(two), "a single letter is not sized to fill the same box");
});

test("A FULL-WIDTH SCRIPT IS SET SMALLER, and it has to be", () => {
  // Found by RENDERING the marks, not by reasoning about them: a CJK glyph is
  // ~1em wide against ~0.68em for a Latin capital, so two at the Latin size
  // measure 30 of the 32px box and touch the rounded corners. Valid SVG that
  // looks broken — the grey-charts lesson.
  const cjk = Number(/font-size="(\d+)"/.exec(initialsMark("東京 寿司"))[1]);
  const latin = Number(/font-size="(\d+)"/.exec(initialsMark("Sharp Fade"))[1]);
  assert.ok(cjk < latin, "a full-width pair is set at the Latin size and overflows the box");
  // The measurement that decides it: two glyphs at ~1em must leave real margin.
  assert.ok(cjk * 2 <= 26, "two full-width glyphs at " + cjk + "px fill a 32px box");
});

test("the wide test does not catch the scripts that are already right", () => {
  // Widening it shrinks marks that fit perfectly well. Greek and Cyrillic
  // rendered correctly at the Latin size and must stay there.
  for (const n of ["Sharp Fade", "Καφενείο Ρόδος", "Пекарня Хлеб", "مقهى الشمس", "बीकानेर मिष्ठान"]) {
    assert.equal(isWide(initials(n)), false, n + " was treated as full-width");
  }
  for (const n of ["東京 寿司", "서울 식당", "さくら 亭"]) {
    assert.equal(isWide(initials(n)), true, n + " was not treated as full-width");
  }
});

/* ── writing it into the document ────────────────────────────────────────── */

test("the title, the language and the icon all land in the real template", () => {
  const out = applyIdentity(TEMPLATE, { title: "Sharp Fade", lang: "es", icon: "/icon.svg" });
  assert.match(out, /<title>Sharp Fade<\/title>/);
  assert.match(out, /<html lang="es">/);
  assert.match(out, /href="\/icon\.svg"/);
});

test("THE ICON'S TYPE ATTRIBUTE SURVIVES", () => {
  // Replacing the whole `<link>` drops `type="image/svg+xml"`, and a browser
  // handed an icon with no type has to sniff it.
  const out = applyIdentity(TEMPLATE, { icon: "/icon.svg" });
  assert.match(out, /type="image\/svg\+xml"/);
  assert.ok(!/favicon\.svg/.test(out), "the template's own icon is still referenced");
});

test("a language that is not a tag leaves the attribute alone", () => {
  // Every site built before this exists with `lang="en"` and no stored value.
  // Guessing here would relabel them all.
  const out = applyIdentity(TEMPLATE, { title: "Sharp Fade", lang: "Spanish" });
  assert.match(out, /<html lang="en">/);
});

test("nothing named leaves the document byte-identical", () => {
  assert.equal(applyIdentity(TEMPLATE, {}), TEMPLATE);
  assert.equal(applyIdentity(TEMPLATE), TEMPLATE);
});

test("AN <html> WITH NO lang GETS ONE", () => {
  // The attribute may be absent as well as wrong. Without this branch a
  // template edited to a bare `<html>` publishes every site with no language at
  // all — the state this function exists to end, arriving from the other side.
  const out = applyIdentity("<!doctype html><html><head></head></html>", { lang: "fr" });
  assert.match(out, /<html lang="fr">/);
});

test("an existing lang is REPLACED, not appended to", () => {
  const out = applyIdentity('<html lang="en" dir="ltr">', { lang: "ar" });
  assert.match(out, /lang="ar"/);
  assert.ok(!/lang="en"/.test(out), "two lang attributes, and the first one wins");
  assert.match(out, /dir="ltr"/, "another attribute on the same tag was eaten");
});

test("the title is escaped and capped", () => {
  const out = applyIdentity(TEMPLATE, { title: '<b>&"x' });
  assert.match(out, /<title>&lt;b&gt;&amp;&quot;x<\/title>/);
  const long = applyIdentity(TEMPLATE, { title: "y".repeat(200) });
  assert.equal(/<title>(y*)<\/title>/.exec(long)[1].length, 70);
});

test("A DOCUMENT WE DO NOT UNDERSTAND IS RETURNED, never thrown on", () => {
  // Publishing a site whose title did not change beats failing a build over a
  // head tag — the same rule `injectMeta` follows one module over.
  for (const junk of ["", "not html at all", "<p>hello</p>", null, undefined]) {
    const out = applyIdentity(junk, { title: "X", lang: "es", icon: "/i.svg" });
    assert.equal(typeof out, "string");
  }
});

/* ── the premises this is built on ───────────────────────────────────────── */

test("THE TEMPLATE STILL HAS THE THREE THINGS THIS REWRITES", () => {
  // Every assertion above is about editing a document, and they all pass
  // vacuously against a template whose shape has moved. This is the check that
  // the thing being edited is still the thing that ships.
  assert.match(TEMPLATE, /<html\b[^>]*\blang\s*=/i, "the template no longer declares a lang");
  assert.match(TEMPLATE, /<title>[\s\S]*?<\/title>/i, "the template no longer has a title");
  assert.match(TEMPLATE, /<link\b[^>]*rel=["']icon["']/i, "the template no longer links an icon");
});

test("the build service writes the identity and does not mutate the template's own icon", () => {
  // The container is long-lived and serves every build on the platform.
  // Overwriting `public/favicon.svg` leaves no pristine copy, so the first
  // site's mark becomes the fallback for every brandless site after it — the
  // one-build's-files-leak-into-the-next class this file's neighbours already
  // guard against for `src/routes` and `dist`.
  const src = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");
  assert.match(src, /applyIdentity\(base, \{ title, lang, icon \}\)/, "the build service no longer applies the identity");
  // ANCHORED ON THE WHOLE FILENAME, and a mutation is why. Written `/icon\.svg/`
  // this passed against a build service writing over `favicon.svg` — the string
  // is a SUBSTRING of the thing it was meant to forbid, so both assertions here
  // were vacuous at once. `!/writeFileSync\([^)]*favicon\.svg/` could not see it
  // either: the write is `writeFileSync(iconPath, svg)`, a variable, not a
  // literal. Assert the property, not the spelling.
  const iconPath = /const iconPath = path\.join\(APP, "public", "([^"]+)"\)/.exec(src);
  assert.ok(iconPath, "the per-build icon path is gone");
  assert.equal(iconPath[1], "icon.svg",
    "the build service writes its per-build mark to " + iconPath[1] +
    " — over the template's own file, which leaves no pristine copy for a brandless site");
  // Deleted before every build, or a stale mark is one site's icon on another's
  // tab — exactly what `resetRoutes` exists to prevent one directory over.
  assert.match(src, /fs\.rmSync\(iconPath, \{ force: true \}\)/, "the previous build's icon is not cleared");
});

test("THE LANGUAGE REACHES THE CONTAINER FROM BOTH PUBLISH PATHS", () => {
  // `worker.js` cannot be imported, so this is the only thing standing between
  // a correct module and a field nothing sends. Both paths, because a build and
  // a recompile are separate call sites and each has silently dropped a field
  // of the published meta before.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(w, /lang: \(look && look\.lang\) \|\| null/, "recompileAndPublish does not send the language");
  assert.match(w, /lang: lang \|\| null/, "the build path does not send the language");
  assert.match(w, /lang: look\.lang,/, "the build route does not pass the merged language through");
});

test("THE REPLY DOES NOT SAY 'lang' TO A CUSTOMER", () => {
  // `moved` carries the stored look's own keys and the client joined them raw,
  // so a language change answered "✅ Updated the look — lang." — our field name
  // read out to somebody who does not have one. `public/chat.js` is a plain
  // script nothing imports, so this is the only thing holding it.
  const c = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  const at = c.indexOf("if (e.layer === 'look')");
  assert.ok(at > 0, "the look reply is gone");
  const block = c.slice(at, c.indexOf("return out + problemNote(e.problems);", at));
  assert.match(block, /SAY = \{[^}]*lang: 'language'/, "the look reply has no plain word for the language");
  assert.match(block, /moved\.map\([^)]*\)[\s\S]{0,80}SAY\[k\] \|\| k/,
    "the mapping is declared and not applied — the raw field name still reaches the sentence");
});

test("…and the designer can name one", () => {
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const tool = w.slice(w.indexOf('name: "design_schema"'), w.indexOf('tool_choice: { type: "tool", name: "design_schema" }'));
  assert.ok(tool.length > 1000, "the design_schema window is not reading the tool");
  assert.match(tool, /^\s*lang: \{/m, "design_schema has no lang field, so nothing can ever set one");
  // BCP-47 named explicitly: told only "the language", a model answers
  // "Spanish", which `normalizeLang` correctly refuses — and the site then
  // silently keeps English, which is the bug wearing a fix.
  assert.match(tool, /BCP-47/, "the designer is not told what shape a language tag is");
});
