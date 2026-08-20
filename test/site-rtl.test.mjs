// A SITE WHOSE LANGUAGE READS RIGHT TO LEFT.
//
// `normalizeLang` has accepted `ar`, `he`, `fa` and `ur` since it was written,
// and NOTHING anywhere set `dir` — so a brief written in Arabic produced a site
// correctly DECLARED Arabic and laid out left to right. That is the `lang` gap
// of 2026-08-12 and the dark-palette gap of 2026-08-18 one layer deeper, with
// one difference that decided how this had to be built: those were one
// attribute and one class, and this was not. The kit was written in PHYSICAL
// properties — 1,946 `ml-`/`pl-`/`text-left` utilities across 614 files,
// measured — so setting `dir="rtl"` alone would flip the text and leave every
// margin, padding, border and offset mirrored wrong, which reads as a
// badly-made site rather than an honest limit.
//
// So there are three halves and each is guarded here: the language decides the
// direction, the container bakes it and the document renders it, and the kit
// really is on logical utilities.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { dirFor, RTL_SCRIPTS, RTL_LANGS, normalizeLang } from "../builder/site-identity.mjs";
import { CORPUS_DIR } from "./fixtures/corpus.mjs";

const ROOT = path.join(import.meta.dirname, "..");
const TPL = path.join(ROOT, "builder/lovable/template");
const server = fs.readFileSync(path.join(ROOT, "builder/build-server.mjs"), "utf8");
const root = fs.readFileSync(path.join(TPL, "src/routes/__root.tsx"), "utf8");
const brand = fs.readFileSync(path.join(TPL, "src/site-brand.ts"), "utf8");
const styles = fs.readFileSync(path.join(TPL, "src/styles.css"), "utf8");

/* ── which way does a language read ──────────────────────────────────────── */

test("the languages a real business writes its brief in", () => {
  for (const tag of ["ar", "he", "fa", "ur", "ps", "sd", "ug", "yi", "dv", "ckb"]) {
    assert.equal(dirFor(tag), "rtl", tag);
  }
  for (const tag of ["en", "en-GB", "es", "pt-BR", "fr", "de", "zh", "zh-Hans", "ja", "ko", "hi", "tr", "pl", "el", "ru", "th"]) {
    assert.equal(dirFor(tag), "ltr", tag);
  }
});

test("the SCRIPT subtag wins over the language, in both directions", () => {
  // THE WHOLE REASON THE TABLE IS OF SCRIPTS AND NOT OF LANGUAGES. Azerbaijani
  // is Latin in Azerbaijan and Perso-Arabic in Iran; Kurdish and Punjabi are
  // each written in two scripts with opposite directions. A language list gets
  // those wrong BOTH ways and cannot be told it is wrong, because the tag
  // already carries the answer.
  assert.equal(dirFor("az-Arab"), "rtl", "an RTL script on an LTR language");
  assert.equal(dirFor("ku-Latn"), "ltr", "an LTR script on a language written in two");
  assert.equal(dirFor("ur-Latn"), "ltr", "romanised Urdu reads left to right");
  assert.equal(dirFor("sr-Cyrl"), "ltr");
  assert.equal(dirFor("ha-Arab"), "rtl");
  // …and a region is not a script, so it must not be read as one.
  assert.equal(dirFor("ar-EG"), "rtl");
  assert.equal(dirFor("en-419"), "ltr");
});

test("a language written in two scripts defaults to the one it is usually written in", () => {
  // THIS ASSERTION WAS MISSING AND ITS ABSENCE WAS MASKED. `ku` and `ff` were
  // both in RTL_LANGS, so a Kurmanji or Fulah brief produced a right-to-left
  // site with LATIN text in it — visibly wrong, and reachable by an ordinary
  // brief. The test one above asserts `ku-Latn` is ltr and PASSED THE WHOLE
  // TIME, because the SCRIPT rule answered it: an assertion that reads as
  // covering the language and covers a different rule entirely.
  //
  // Checked against CLDR rather than intuition: `ku` maximises to `ku-Latn-TR`
  // (the Perso-Arabic Kurdish is Sorani, `ckb`) and `ff` to `ff-Latn-SN`.
  assert.equal(dirFor("ku"), "ltr", "bare Kurdish is Kurmanji in Latin");
  assert.equal(dirFor("ff"), "ltr", "bare Fulah is Latin");
  // …and both are still reachable as right to left the honest way.
  assert.equal(dirFor("ku-Arab"), "rtl");
  assert.equal(dirFor("ff-Adlm"), "rtl");
  assert.equal(dirFor("ckb"), "rtl", "Sorani is the Kurdish that really is right to left");
  assert.ok(!RTL_LANGS.has("ku") && !RTL_LANGS.has("ff"),
    "a language whose default script is Latin is back in the RTL list");
});

test("anything normalizeLang refuses is ltr — which is every site already published", () => {
  for (const v of [null, undefined, "", "  ", "not a tag", "zzzzzzz", 7, true, {}, ["ar"], { toString: () => "ar" }]) {
    assert.equal(dirFor(v), "ltr", JSON.stringify(v));
  }
  // A NON-STRING IS NOT COERCED, and the array case is why: `String(["ar"])` is
  // `"ar"`, which is the shape that made a one-element array a valid role and a
  // valid access level twice in this repo. It reaches `normalizeLang`, which
  // refuses it, and this asserts the refusal survives the extra hop.
  assert.equal(normalizeLang(["ar"]), null);
});

test("the RTL script list is the eight, and nothing has crept in", () => {
  // A SHORT CLOSED LIST IS THE POINT. `Intl.Locale.textInfo` exists in this Node
  // and gives the same answers today — and ICU is the thing this repo has
  // already been bitten by, where two ICU VERSIONS disagreed about one locale.
  // A site's direction decided by whichever Node happened to build it could flip
  // silently on a base-image bump, so the table is deliberate.
  assert.deepEqual([...RTL_SCRIPTS].sort(),
    ["Adlm", "Arab", "Hebr", "Mand", "Nkoo", "Samr", "Syrc", "Thaa"]);
  assert.ok(RTL_LANGS.has("ar") && RTL_LANGS.has("he") && RTL_LANGS.has("fa") && RTL_LANGS.has("ur"));
  // The four `normalizeLang` was already documented as accepting must all be in
  // it, or the feature is unreachable for exactly the languages it exists for.
  for (const t of ["ar", "he", "fa", "ur"]) assert.equal(dirFor(t), "rtl", t);
});

/* ── the wiring: language → container → document ─────────────────────────── */

test("the container derives it from the language and bakes it, ANNOTATED", () => {
  assert.match(server, /import \{[^}]*\bdirFor\b[^}]*\} from "\.\/site-identity\.mjs"/,
    "dirFor is used without being imported — a ReferenceError on the build path");
  assert.match(server, /const dirValue = dirFor\(langValue\)/,
    "the direction must come from the LANGUAGE, not from a second stored field that can disagree with it");
  // ANNOTATED for the reason `SITE_MODE` is: an unannotated const has the
  // LITERAL type of whichever value was written, so comparing it with the other
  // member is TS2367 and the template stops compiling.
  assert.match(server, /export const SITE_DIR: "ltr" \| "rtl" = /);
  assert.match(brand, /export const SITE_DIR: "ltr" \| "rtl" = /);
  // Reported back, so a caller can tell what it got rather than inferring it
  // from the absence of an error — the works-but-cannot-say-so shape.
  assert.match(server, /return \{ lang: langValue,[^}]*\bdir: dirValue\b/);
});

test("the document carries it on <html>, beside lang", () => {
  const openTag = (root.match(/<html [^>]*>/) || [""])[0];
  assert.ok(openTag, "no <html> tag in __root.tsx");
  // THE PROPERTY, NOT THE IDENTIFIER. This pinned `dir={SITE_DIR}` and went red
  // the moment a bilingual site made the direction a fact about the ROUTE rather
  // than the site — a test about which local holds the value, on a correct
  // change. What matters is that both attributes are on `<html>`, that they come
  // from ONE reading (so they cannot disagree), and that the baked constants are
  // still what a monolingual site falls back to.
  assert.match(openTag, /\bdir=\{[^}]+\}/, "the direction is not on the document");
  assert.match(openTag, /\blang=\{[^}]+\}/, "…and it must sit beside the language it is derived from");
  const [, langExpr] = openTag.match(/\blang=\{([^}]+)\}/) || [];
  const [, dirExpr] = openTag.match(/\bdir=\{([^}]+)\}/) || [];
  assert.ok(langExpr && dirExpr, openTag);
  assert.equal(langExpr.split(".")[0], dirExpr.split(".")[0],
    "the language and the direction come from two different readings, which can disagree");
  assert.match(root, /import \{[^}]*\bSITE_DIR\b[^}]*\} from "@\/site-brand"/);
  assert.match(root, /\bSITE_DIR\b/, "the baked direction is not the fallback any more");
  // ON `<html>`, NOT `<body>`: the logical utilities resolve against the
  // inherited `direction`, and `<body>` already carries the per-page colour
  // scope, which would then be inside the direction rather than under it.
  assert.doesNotMatch(root, /<body[^>]*SITE_DIR/);
});

/* ── the kit really is on logical utilities ──────────────────────────────── */

const walk = (dir) => {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
};

// PHYSICAL UTILITIES, ON CLASS TOKENS AND NEVER ON SUBSTRINGS. A substring scan
// is worthless here and the first draft of the sweep proved it: `items-center`
// contains `ms-`, `rounded-lg` contains `rounded-l`, `theme-` contains `me-`.
const PHYSICAL = [
  /^ml-/, /^mr-/, /^pl-/, /^pr-/,
  /^text-left$/, /^text-right$/,
  /^border-l$/, /^border-r$/, /^border-l-/, /^border-r-/,
  /^rounded-l$/, /^rounded-r$/, /^rounded-l-/, /^rounded-r-/,
  /^rounded-tl/, /^rounded-tr/, /^rounded-bl/, /^rounded-br/,
  /^scroll-ml-/, /^scroll-mr-/, /^scroll-pl-/, /^scroll-pr-/,
];
const baseOf = (t) => { const i = t.lastIndexOf(":"); return i < 0 ? t : t.slice(i + 1); };

// COMMENTS ARE BLANKED, LENGTH-PRESERVING, BEFORE ANYTHING IS SCANNED. The
// first run of this reported two hits and both were comments SAYING the file
// deliberately does not use `pl-${n}` — prose describing a thing contains that
// thing's spelling, which is the fourth time this repo has recorded that trap.
// Blanked rather than removed, so offsets stay valid against the real text.
const blankComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));

function physicalIn(dirs) {
  const hits = [];
  for (const f of dirs.flatMap(walk)) {
    for (const m of blankComments(fs.readFileSync(f, "utf8")).matchAll(/["'`]([^"'`\n]*)["'`]/g)) {
      for (const tok of m[1].split(/\s+/)) {
        if (!tok) continue;
        const b = baseOf(tok);
        if (PHYSICAL.some((re) => re.test(b))) hits.push(path.relative(TPL, f) + ": " + tok);
      }
    }
  }
  return hits;
}

test("the kit, the exemplars and the reference pages carry no physical side", () => {
  const dirs = [
    path.join(TPL, "src/components/ui"),
    CORPUS_DIR,
    path.join(TPL, "src/routes"),
    path.join(TPL, "src/lib"),
  ];
  const hits = physicalIn(dirs);
  assert.deepEqual(hits, [], hits.slice(0, 12).join(" · "));
  // AND THE SCAN STILL SEES SOMETHING, or "no hits" is a broken regex reporting
  // a clean kit. Counted on what it does find: a logical utility.
  const files = dirs.flatMap(walk);
  assert.ok(files.length > 2000, "the scan is not reading the kit at all: " + files.length);
  const logical = files.filter((f) => /\b(ms|me|ps|pe)-\d|text-(start|end)|border-[se]\b/.test(fs.readFileSync(f, "utf8")));
  assert.ok(logical.length > 300, "the sweep did not land: only " + logical.length + " files use a logical utility");
});

test("the ONE physical idiom that must survive is centring", () => {
  // `left-1/2` WITH `-translate-x-1/2` ALREADY CENTRES IN BOTH DIRECTIONS: the
  // offset is a point and a transform does not mirror. Converted to `start-1/2`
  // it becomes `right:50%` in RTL and the translate pushes it further off — so
  // the "fix" BREAKS a correct centre. Fourteen of them, left exactly as they
  // were, and this is the guard that stops a later tidy-up finishing the job.
  const files = walk(path.join(TPL, "src/components/ui")).concat(walk(path.join(TPL, "src/lib")));
  let centred = 0;
  for (const f of files) {
    for (const m of fs.readFileSync(f, "utf8").matchAll(/["'`]([^"'`\n]*)["'`]/g)) {
      const toks = m[1].split(/\s+/).map(baseOf);
      if (toks.some((t) => /^-?translate-x-/.test(t)) && toks.some((t) => /^-?(left|right)-/.test(t))) centred++;
    }
  }
  assert.ok(centred >= 10, "the centring idiom has been converted away: only " + centred + " left");
});

test("an indent is a logical property, not a left padding", () => {
  // SEVEN COMPONENTS INDENT BY DEPTH — trees, outlines, a finding aid — and all
  // seven expressed it as `paddingLeft`, which a `dir="rtl"` document does not
  // mirror: the tree would step the wrong way while its own text ran the other.
  // A class sweep could never have caught these, because they are inline styles
  // computed from a number.
  const UI = path.join(TPL, "src/components/ui");
  const indenting = walk(UI).filter((f) => /paddingInlineStart/.test(fs.readFileSync(f, "utf8")));
  assert.ok(indenting.length >= 7, "the indents have gone back to paddingLeft: " + indenting.length);
  // THE THREE THAT ARE PHYSICAL ON PURPOSE stay physical, and this names them
  // rather than leaving the exception to memory: `env(safe-area-inset-left)` is
  // a device notch on the actual left of the glass, and `scroll-lock` saves and
  // restores the body's own padding to compensate for a scrollbar.
  for (const name of ["safe-area-pad.tsx", "safe-area.tsx", "scroll-lock.tsx"]) {
    const src = fs.readFileSync(path.join(UI, name), "utf8");
    assert.match(src, /padding(Left|Right)/, name + " lost its deliberate physical property");
  }
});

/* ── directional icons ───────────────────────────────────────────────────── */

test("directional icons mirror, as ONE rule rather than per use", () => {
  // 192 USES ACROSS 70 FILES, measured. Marking each by hand fixes those and
  // nothing the generator writes tomorrow — the `safe-image` argument, where a
  // guard the model must remember is one it eventually forgets. `lucide-react`
  // stamps a per-icon class, verified on a real rendered page, so the mirror is
  // stated once for every use that exists and every use that will.
  for (const icon of ["chevron-left", "chevron-right", "arrow-left", "arrow-right", "reply", "undo", "log-out"]) {
    assert.match(styles, new RegExp('\\[dir="rtl"\\] \\.lucide-' + icon + '[,\\s]'), icon + " does not mirror");
  }
  // `scale`, NOT `transform`, and it is not a preference: Tailwind v4 emits
  // `rotate-180` as the INDIVIDUAL `rotate:` property — measured in a built
  // stylesheet — so a component's own transform utility would REPLACE a
  // `transform` here, while the individual `scale:` composes with it. Proven on
  // a real build: a chevron carrying `rotate-180` in an RTL document computes
  // BOTH `scale: -1 1` and `rotate: 180deg`.
  const block = styles.slice(styles.indexOf('[dir="rtl"] .lucide-chevron-left'));
  assert.match(block.slice(0, 3000), /\{\s*scale: -1 1;\s*\}/,
    "the mirror is not the individual `scale` property — it will fight a component's own rotation");
  assert.doesNotMatch(block.slice(0, 3000), /transform:/);
});

test("media transport and text alignment are deliberately NOT mirrored", () => {
  // A TIMELINE RUNS THE SAME WAY IN EVERY LANGUAGE, so mirroring the transport
  // makes "next track" point at the previous one. And `align-left` depicts a
  // literal alignment the user is CHOOSING — it still means left in an Arabic
  // editor, and mirroring the icon makes the button lie about what it does.
  // Both verified on a real render: play, align-left and a neutral icon all
  // compute `scale: none` in an RTL document.
  for (const icon of ["play", "pause", "skip-forward", "skip-back", "rewind", "fast-forward", "align-left", "align-right"]) {
    assert.doesNotMatch(styles, new RegExp('\\.lucide-' + icon + '\\b'), icon + " must not be mirrored");
  }
});

/* ── what the generator is told ──────────────────────────────────────────── */

test("the generator is told, because the kit cannot stop a page writing ml-4", async () => {
  const { PAGE_RULES } = await import("../builder/page-gen.mjs");
  const i = PAGE_RULES.indexOf("SIDES ARE LOGICAL");
  assert.ok(i > 0, "no rule tells the model to use logical utilities");
  const rule = PAGE_RULES.slice(i, i + 1600);
  for (const s of ["ms-", "ps-", "text-start", "border-s", "rounded-s"]) {
    assert.ok(rule.includes(s), "the rule never names " + s);
  }
  // THE POSITIVE HALF MATTERS AS MUCH AS THE PROHIBITION. A flat "do not use
  // ml-" reads as a restriction with a cost, and the model has every reason to
  // reach for the familiar one anyway; what makes it free is that the two are
  // the same thing in English. Measured over all 96 mappings the kit uses.
  assert.match(rule, /SAME THING IN ENGLISH/,
    "the rule forbids without saying the substitute is free — the publicView failure");
  // …and the exception, or a well-meaning page converts a working centre.
  assert.match(rule, /translate-x-1\/2/, "the centring exception is not stated");
});
