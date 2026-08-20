// The site's language and its own mark.
//
// Two things every published site had in common and neither was true of it:
// `<html lang="en">` was hardcoded in the template, and all of them shared one
// favicon. Both are invisible to anyone building a site and obvious to the
// person it is for, which is exactly the class this repo keeps being bitten by.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { normalizeLang, initials, brandHue, initialsMark, isWide, MAX_INITIALS, siteIconFrom, markGround, MARK_L, MARK_C_CAP } from "../builder/site-identity.mjs";
import { normalizeSeeds } from "../builder/site-seeds.mjs";
import { contrast } from "../builder/site-theme.mjs";

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

test("THE MARK TAKES THE SITE'S OWN ACCENT, not a hash of its name", () => {
  // Measured before this: "Fade & Co Barbershop" hashes to hue 273 — a PURPLE
  // tab icon on a warm-brick site whose own accent is hue 36. The designer
  // authors three colours, the engine derives thirty-one from them, and the
  // most-repeated mark of the brand matched none of it.
  const seeds = { name: "Warm Brick", paper: "#faf7f2", ink: "#1b1714", accent: "#b44a2e" };
  const ground = markGround(seeds);
  assert.ok(ground, "a usable palette produced no ground");
  const [, , H] = normalizeSeeds(seeds).theme.light.accent;
  assert.equal(ground[2], H, "the mark's hue is not the site's accent hue");
  assert.ok(ground[0] <= MARK_L, "the lightness is no longer bounded, so white text is not guaranteed");
  // A CEILING, NOT A FIXED VALUE: a near-black brand keeps its own weight
  // rather than being lightened to mid-grey. Found by looking at a render.
  const noir = { name: "Noir", paper: "#ffffff", ink: "#0a0a0a", accent: "#171717" };
  const dark = markGround(noir);
  assert.ok(dark[0] < MARK_L - 0.1,
    `a near-black accent was lightened to L=${dark[0].toFixed(2)} instead of keeping its own weight`);
  assert.match(initialsMark("Fade & Co Barbershop", seeds), /fill="#[0-9a-f]{6}"/,
    "the ground is not a hex colour, so anything but a browser may not render it");
  // …AND IT IS NOT THE HASH. Without this the test passes on a mark that took
  // the palette and then ignored it.
  const hashed = /fill="([^"]+)"/.exec(initialsMark("Fade & Co Barbershop"))[1];
  const seeded = /fill="([^"]+)"/.exec(initialsMark("Fade & Co Barbershop", seeds))[1];
  assert.notEqual(seeded, hashed, "the palette changed nothing");
  assert.match(hashed, /^hsl\(/, "the no-palette fallback stopped being the name hash");
});

test("THE CHROMA CAP IS REACHABLE, and it is a style bound rather than a safety one", () => {
  // A mutation removing it SURVIVED, so it needed measuring rather than
  // assuming. Both halves came back: it is reachable — 38 of the 500 pinned
  // palettes carry an accent above the cap, up to 0.220 — and it is NOT what
  // keeps the mark legible, since white clears 5.36:1 even at chroma 0.37. So
  // what it bounds is how saturated a 32px square gets, which no contrast test
  // can see and this one asserts directly.
  const loud = markGround({ name: "x", paper: "#fffdf5", ink: "#1a1a12", accent: "#ff0000" });
  assert.ok(loud, "the fixture palette was refused, so this proves nothing");
  assert.ok(loud[1] <= MARK_C_CAP, `the mark took chroma ${loud[1].toFixed(3)}, above the cap`);
  // …and the cap must still be REACHABLE, or this goes vacuous the day the
  // palette engine starts clamping chroma below it and nobody notices.
  const raw = normalizeSeeds({ name: "x", paper: "#fffdf5", ink: "#1a1a12", accent: "#ff0000" });
  assert.ok(raw.theme.light.accent[1] > MARK_C_CAP,
    "no palette can exceed the cap any more, so it bounds nothing");
});

test("WHITE INITIALS CLEAR CONTRAST AT EVERY HUE THE MARK CAN TAKE", () => {
  // The guarantee the fixed lightness exists for, driven rather than asserted —
  // and the old `hsl()` form's own claim was CHECKED before it was replaced:
  // swept the same way it bottoms out at 3.55:1, which clears AA-large and not
  // AA body. This form has to be at least as good everywhere, or the change
  // traded a coherent colour for a less readable one.
  const WHITE = [1, 0, 0];
  assert.equal(Math.round(contrast(WHITE, [0, 0, 0])), 21, "the instrument is miscalibrated, so nothing below means anything");
  let worst = Infinity, at = null;
  for (let h = 0; h < 360; h++) {
    for (const C of [0, 0.04, 0.08, 0.12, MARK_C_CAP]) {
      const c = contrast([MARK_L, C, h], WHITE);
      if (c < worst) { worst = c; at = [h, C]; }
    }
  }
  assert.ok(worst >= 4.5, `white initials drop to ${worst.toFixed(2)}:1 at hue ${at[0]} chroma ${at[1]}`);
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

/* ── the premises this is built on ─────────────────────────────────────── */

test("THE THREE VALUES REACH THE SITE AS A MODULE, and nothing patches a document", () => {
  // `applyIdentity` LIVED HERE AND IS GONE. It put the title, the language and
  // the icon into the built `index.html` with three regexes — and under TanStack
  // Start there is no `index.html`: the document is `__root.tsx`, rendered per
  // request, so there is nothing to patch and the values are ordinary props a
  // component renders.
  //
  // ASSERTED AS AN ABSENCE, not merely deleted, which is the `@/examples/*`
  // precedent: while the function existed its tests read the template's own
  // `index.html`, so restoring either half without the other gives regex surgery
  // on a file no site is built from — every assertion passing against something
  // that ships nowhere.
  const mod = fs.readFileSync(new URL("../builder/site-identity.mjs", import.meta.url), "utf8");
  assert.ok(!/export function applyIdentity/.test(mod),
    "applyIdentity is back — Start emits no shell for it to patch");
  assert.ok(!fs.existsSync(new URL("../builder/lovable/template/index.html", import.meta.url)),
    "the template has an index.html again — the head is composed by __root.tsx now");
});


test("the build service writes the identity and does not mutate the template's own icon", () => {
  // The container is long-lived and serves every build on the platform.
  // Overwriting `public/favicon.svg` leaves no pristine copy, so the first
  // site's mark becomes the fallback for every brandless site after it — the
  // one-build's-files-leak-into-the-next class this file's neighbours already
  // guard against for `src/routes` and `dist`.
  const src = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");
  // THE IDENTITY REACHES THE SITE AS A GENERATED MODULE, not as a patched shell.
  // This asserted `applyIdentity(base, { title, lang, icon })` — the regex
  // surgery on `index.html` — which stopped existing when the document became
  // `__root.tsx` under Start. Re-anchored on the property, and derived at BOTH
  // ends: the container must write each value and the root route must render it,
  // because either half alone passes while the wire is cut. That exact shape has
  // been the wiring failure here a dozen times.
  //
  // The neighbouring assertions that read the template's own `index.html` for a
  // lang/title/icon went with `applyIdentity`, as the note here said they should:
  // that file is gone, so they would have held against something no site is made
  // of.
  const brand = /function writeSiteBrand\(\{[\s\S]*?\n\}/.exec(src);
  assert.ok(brand, "the build service no longer writes the brand module");
  const root = fs.readFileSync(
    new URL("../builder/lovable/template/src/routes/__root.tsx", import.meta.url), "utf8");
  for (const name of ["SITE_LANG", "SITE_ICON", "SITE_NAME"]) {
    assert.ok(brand[0].includes(name),
      `the build service no longer writes ${name} — the site would keep the template's own`);
  }
  // THE IMPORT LINE IS STRIPPED FIRST, and a mutation is why: written as a bare
  // `root.includes("SITE_LANG")` this passed against a document changed to
  // `lang="en"`, because the name still appeared in the import above. Asserting
  // a name EXISTS is not asserting it is USED — the declaration-satisfying-a-
  // call-assertion failure this repo has recorded three times.
  const body = root.replace(/^import[\s\S]*?from\s+["'][^"']+["'];?$/gm, "");
  for (const name of ["SITE_LANG", "SITE_ICON"]) {
    assert.ok(body.includes(name),
      `the document no longer renders ${name} — the container writes a value nothing reads`);
  }
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

// ── THE OWNER'S OWN TAB ICON ────────────────────────────────────────────────

test("siteIconFrom accepts our own upload paths and absolute https, and NOTHING else", () => {
  // The value ends up in a `src` inside generated TypeScript. It comes out of our
  // own `_meta`, and "it came from us" is how the first person to reach that row
  // through some other route gets an XSS on a customer's site.
  assert.equal(siteIconFrom("/u/sharp-fade/abc123.png").href, "/u/sharp-fade/abc123.png");
  assert.equal(siteIconFrom("https://cdn.example.com/i.png").href, "https://cdn.example.com/i.png");
  for (const bad of [
    "javascript:alert(1)", "data:image/svg+xml,<svg onload=alert(1)>", "http://x.example/i.png",
    "//evil.example/i.png", "/etc/passwd", "/u/../../secret.png", "i.png",
  ]) {
    const out = siteIconFrom(bad);
    assert.equal(out && out.href, null, bad);
    assert.equal(out && out.refused, true, bad);
  }
});

test("a non-string is refused rather than coerced", () => {
  // `String(["/u/a/b.png"])` is "/u/a/b.png", which would pass the shape check.
  for (const v of [null, undefined, 7, ["/u/a/b.png"], { href: "/u/a/b.png" }]) {
    assert.equal(siteIconFrom(v), null, String(v));
  }
});

test("THE TYPE IS READ OFF THE EXTENSION, which is ours rather than a caller's claim", () => {
  // `uploadName` builds the filename from the kind `sniffImage` decided off the
  // leading bytes, so the extension is a fact about the file. It matters because
  // the document used to declare `image/svg+xml` unconditionally, which is a lie
  // about an owner's PNG and a browser may refuse it.
  assert.equal(siteIconFrom("/u/a/x.png").type, "image/png");
  assert.equal(siteIconFrom("/u/a/x.jpg").type, "image/jpeg");
  assert.equal(siteIconFrom("/u/a/x.jpeg").type, "image/jpeg");
  assert.equal(siteIconFrom("/u/a/x.webp").type, "image/webp");
  assert.equal(siteIconFrom("/u/a/x.svg").type, "image/svg+xml");
});

test("AN UNKNOWN EXTENSION IS NOT A REFUSAL — it is a type we decline to claim", () => {
  // An absent `type` is a perfectly ordinary `<link rel="icon">` that browsers
  // sniff. Declaring the WRONG one is the failure this field exists to stop, so
  // the honest answer to "I don't know" is silence, not a guess and not a refusal
  // of an icon the owner really did send.
  const out = siteIconFrom("https://cdn.example.com/icon");
  assert.equal(out.href, "https://cdn.example.com/icon");
  assert.equal(out.type, "");
  assert.equal(out.refused, false);
  // A query string or a fragment must not hide the extension.
  assert.equal(siteIconFrom("https://cdn.example.com/i.png?v=2").type, "image/png");
  assert.equal(siteIconFrom("https://cdn.example.com/i.svg#a").type, "image/svg+xml");
});

test("nothing sent is nothing to decide — the site draws its initials", () => {
  assert.equal(siteIconFrom(""), null);
  assert.equal(siteIconFrom("   "), null);
});
