// THE SITE'S WHOLE STYLESHEET, WRITTEN BY THE MODEL (2026-08-23, owner's call).
//
// `seeds`, `fonts`, `style`, `tokens` and `tokensPage` came off `design_schema`
// and one `css` field replaced them. This file holds three things:
//
//   1. `readCss` and `fontsIn` themselves — the reader, which is deliberately
//      NOT a validator (see the module header) and therefore has exactly one
//      job that can go wrong: reporting a failure the page cannot report.
//   2. THE ABSENCE, at every layer the five fields were live at. That is the
//      half that rots silently — a field quietly restored beside `css` gives the
//      model two ways to decide one look with nothing choosing between them.
//   3. THE CHAIN, link by link, because this repo has recorded a dozen features
//      correct at every layer and dead at one.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readCss, fontsIn, cssNote, MAX_CSS, LABEL_GUARD, SHELL_GUARD, ON_FILL_PAIRS } from "../builder/site-freecss.mjs";
import { CONFIG_FIELDS } from "../site-config.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const worker = read("worker.js");
const container = read("builder/build-server.mjs");
const chat = read("public/chat.js");
/** Comments blanked WHOLE-LINE and length-preserving — every absence below is
 *  judged on code, because prose explaining a deletion spells the deleted thing
 *  and this repo has been caught by that in a lint, a router guard, an absence
 *  check and a scope scan. */
const code = worker.split("\n").map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? "" : l)).join("\n");
/** The design tool's own text. THE ANCHOR IS PROVED before anything is judged
 *  absent from it: `indexOf` answers -1 for a literal that moved, `slice(-1)` is
 *  one character, and every absence below would then pass over nothing. A
 *  negative assertion has to show its observer is alive first. */
const toolAt = code.indexOf('name: "design_schema"');
assert.ok(toolAt > 0, "the design_schema literal moved — every absence in this file is reading nothing");
const tool = code.slice(toolAt);

/* ── 1. THE READER ───────────────────────────────────────────────────────── */

test("a stylesheet is read, never validated — and every silent failure is named", () => {
  const r = readCss(':root{--background:#faf7f2;--foreground:#1b1714}body{background:var(--background)}');
  assert.equal(r.usable, true);
  assert.equal(r.definesCore, true);
  assert.deepEqual(r.notes, [], "an ordinary stylesheet must produce no sentence at all");
  assert.equal(cssNote(r), "");
});

test("A NON-STRING IS REFUSED RATHER THAN COERCED", () => {
  // `String(["a{}"])` is `"a{}"` — a perfectly good stylesheet built out of a
  // shape mistake. This repo has shipped that coercion as a real bug three
  // times: a one-element array as a role, as an access level, and as a model id.
  for (const [v, why] of [[["a{}"], "not-a-string"], [42, "not-a-string"], [{}, "not-a-string"],
                          [null, "none"], [undefined, "none"], ["", "empty"], ["   ", "empty"]]) {
    const r = readCss(v);
    assert.equal(r.usable, false, JSON.stringify(v) + " was accepted as a stylesheet");
    assert.equal(r.reason, why);
    assert.equal(r.css, undefined, "an unusable read must hand back no bytes to write");
  }
  // AND A REFUSED SHEET SAYS SO WHILE AN ABSENT ONE DOES NOT. Collapsing the two
  // loses the half that matters: `none` is the ordinary path — the tool tells
  // the model to OMIT `css` to leave the look alone, so every text fix and
  // picture swap takes it and a sentence there would appear on every edit that
  // is not about the design. A non-string is an answer we THREW AWAY, and with
  // no note the customer is told the look moved when the stored sheet was kept.
  assert.equal(cssNote(readCss(["a{}"])).length > 0, true,
    "a stylesheet we could not read is discarded in silence");
  assert.match(cssNote(readCss(42)), /kept the look it had/,
    "…and the sentence must say what happened to their site, not name a type");
  for (const quiet of [null, undefined, "", "   "]) {
    assert.equal(cssNote(readCss(quiet)), "",
      "omitting the stylesheet is how a non-look edit is expressed and must be silent");
  }
});

test("A LONG SHEET IS CUT AT A RULE BOUNDARY, and says so", () => {
  // Chopped mid-declaration the sheet is a syntax error from that point on and
  // Lightning CSS drops everything after it — so a one-character overrun would
  // cost the whole tail rather than the last rule.
  // THE RULE LENGTH MUST NOT DIVIDE `MAX_CSS`, AND THE FIRST DRAFT'S DID.
  // `"a{color:red}"` is 12 characters and 60,000 is a multiple of 12, so a naive
  // `slice(0, MAX_CSS)` landed exactly on a `}` and `endsWith("}")` was true
  // whether or not the boundary logic existed at all — a mutation replacing the
  // whole search with `-1` survived. A fixture that cannot express the failure
  // reports a guarantee nobody is holding. 13 characters, and the misalignment
  // is asserted rather than assumed so this cannot go quietly vacuous again.
  const RULE = "ab{color:red}";
  assert.notEqual(MAX_CSS % RULE.length, 0,
    "the fixture is boundary-aligned, so a raw cut would pass this test");
  const r = readCss(RULE.repeat(9000));
  assert.equal(r.usable, true);
  assert.ok(r.bytes <= MAX_CSS, "the cap does not bind");
  assert.ok(r.css.endsWith("}"), "the sheet was cut inside a block");
  assert.equal(r.truncated, true);
  assert.match(cssNote(r), /longer than/, "a truncated sheet says nothing, so the missing tail reads as a design choice");
});

test("THE THREE SILENT FAILURES ARE EACH NAMED, because the page cannot report any of them", () => {
  // A font we cannot host falls back in the browser; a remote url() is refused
  // by the site's own CSP; a sheet that sets no token renders the whole kit on
  // shadcn's defaults. None of the three throws, none fails a build, and all
  // three look from outside like the model simply having taste we did not
  // expect. Each is asserted apart, or one sentence covering two is a report
  // that cannot discriminate.
  assert.match(cssNote(readCss('body{font-family:"Zzqx Nonesuch",serif;--background:#fff;--foreground:#000}')),
    /Zzqx Nonesuch/, "a typeface we cannot fetch is not named");
  assert.match(cssNote(readCss('body{background:url(https://evil.example/x.png);--background:#fff;--foreground:#000}')),
    /url\(\)/, "a remote reference the CSP refuses is not named");
  assert.match(cssNote(readCss("p{color:red}")), /default palette/,
    "a sheet that sets none of the kit's own variables is not reported");
  // …and a `data:` URI is deliberately NOT reported: it needs no network and is
  // the one remote-looking form that actually works.
  assert.doesNotMatch(cssNote(readCss('body{background:url("data:image/svg+xml,<svg/>");--background:#fff;--foreground:#000}')),
    /url\(\)/, "a data: URI is reported as refused, which is a false alarm on a working sheet");
});

test("fontsIn RESOLVES A STACK BEHIND A CUSTOM PROPERTY — the template's own shape", () => {
  // THE FIRST DRAFT SKIPPED THIS ON FALSE REASONING: that the variable's own
  // declaration would be scanned as a `font-family`. It is not — `--font-sans:
  // "Lora", serif` is a CUSTOM PROPERTY — so the family was named, never matched
  // and never fetched. And it is not an edge case: it is exactly how the
  // template's own styles.css is written, so it is the shape a model copying it
  // produces.
  assert.deepEqual(fontsIn(':root{--font-sans:"Lora",Georgia,serif;--font-heading:"Playfair Display",serif}'
    + "body{font-family:var(--font-sans)}h1{font-family:var(--font-heading)}").ids,
    ["lora", "playfair-display"]);
  // …and a direct declaration still works.
  assert.deepEqual(fontsIn('body{font-family:"Cormorant Garamond",serif}').ids, ["cormorant-garamond"],
    "resolved against the shortlist rather than the whole catalogue — a family we can fetch is reported as a fallback");
  // A COMMENTED-OUT FAMILY IS NOT FETCHED. Blanked length-preserving so offsets
  // stay valid, and this repo has been bitten five times by prose containing the
  // thing a scan is looking for.
  assert.deepEqual(fontsIn('/* body{font-family:"Lora"} */ body{font-family:"Geist"}').ids, ["geist"]);
});

test("A SYSTEM FACE IS SILENT — the false alarm that would report a working stylesheet", () => {
  // `font-family: Georgia, serif` is a complete, working, deliberate answer: the
  // face ships with every desktop operating system, so there is nothing to fetch
  // and nothing degrades. Without the system list the report would tell the
  // customer their typeface "is not one we can host" about a stylesheet doing
  // exactly what it says — and a check that cries wolf on correct output is
  // worse than the miss it prevents, which is the bar every lint in this repo
  // had to clear before it could exist.
  for (const stack of ["Georgia,serif", '"Helvetica Neue",Arial,sans-serif', "Menlo,monospace",
                       "-apple-system,BlinkMacSystemFont,sans-serif", "sans-serif"]) {
    const r = fontsIn("body{font-family:" + stack + "}");
    assert.deepEqual(r.missing, [], stack + " is reported as a typeface we cannot host");
    assert.deepEqual(r.ids, [], stack + " triggers a download of a face the reader already has");
  }
  // AND THE REPORT USES THE CUSTOMER'S OWN SPELLING, not the normalised key.
  // "helvetica neue" reads as a bug where "Helvetica Neue" reads as their words
  // handed back.
  assert.deepEqual(fontsIn('body{font-family:"Zzqx Nonesuch"}').missing, ["Zzqx Nonesuch"]);
});

/* ── 2. THE ABSENCE ──────────────────────────────────────────────────────── */

test("THE FIVE LOOK FIELDS ARE GONE FROM THE TOOL, at every layer they were live at", () => {
  // Restored beside `css`, any one of them gives the model two ways to decide
  // one look — and the container applies BOTH: the axes and the palette into the
  // theme, then the model's stylesheet over the top. Whichever ran last wins,
  // silently, and the two answers can differ on every site.
  for (const gone of ["seeds", "fonts", "style", "tokens", "tokensPage"]) {
    assert.doesNotMatch(tool, new RegExp("\\n\\s{6}" + gone + ": \\{|\\n\\s{6}" + gone + ": [A-Z]"),
      "`" + gone + "` is back on design_schema beside `css`");
  }
  const required = worker.match(/required: \[[^\]]*\],\s*\n\s*\},\s*\n\};/);
  assert.ok(required, "could not find design_schema's required list");
  // `theme`, NOT `css`, since 2026-08-27: the registry returned and the look
  // every build must have is the theme's — compelling `css` would force a model
  // sheet onto every build against its own on-request contract. The five old
  // fields stay off the required list either way.
  assert.match(required[0], /"theme"/,
    "the theme is not compelled, so a site whose designer omits it ships the template's plain default look");
  assert.doesNotMatch(required[0], /"css"/,
    "`css` is compelled again — the on-request contract is broken on every build");
  for (const gone of ["seeds", "fonts", "style", "tokens", "tokensPage"]) {
    assert.doesNotMatch(required[0], new RegExp('"' + gone + '"'),
      "`" + gone + "` is required and the tool no longer offers it — every build 400s");
  }
});

test("…AND THE ENGINES THEY DROVE ARE GONE TOO, which is the 2026-08-24 half", () => {
  // ── THIS ASSERTION IS INVERTED, AND EACH POSITION WAS RIGHT ON ITS PREMISE ──
  //
  // It used to require the OPPOSITE: that `mergeTokens`, `mergeStyle` and the
  // stored palette, pairing and axes all still flowed on both spines. That was
  // correct while sites existed wearing them — the tool stopped ASKING on
  // 2026-08-23 and nothing stopped CARRYING, so deleting the carry would have
  // stripped a live design on somebody's next typo fix.
  //
  // What moved is the measurement: all 25 sites are ours, smoke runs and the
  // `lido-*` experiment arms, so "one deploy re-styles no site" protected
  // nobody. The owner's call is that the look is the stylesheet alone.
  //
  // ASSERTED AS AN ABSENCE, which is the half that rots silently. A `tokens:`
  // or `style:` line quietly restored to either payload gives the container a
  // second opinion about the look beside the stylesheet, and the two then
  // disagree with whichever the compiler reads last winning.
  //
  // JUDGED ON `code`, NEVER ON `worker`: the paragraphs recording this deletion
  // necessarily spell every name being forbidden, which is the trap this file's
  // own header warns about and would fail every absence below against correct
  // source.
  // ── (a) THE ENGINE NAMES, which are unambiguous and unique to that tier ────
  for (const [re, why] of [
    [/mergeTokens\(/, "the token merge is back — a second way to decide a colour"],
    [/mergeStyle\(/, "the style merge is back — a second way to decide the look"],
    [/parseTokens\(/, "the token parser is back"],
    [/parseStyle\(/, "the axis parser is back"],
    [/withContrast\(/, "the derived-ink pass is back, so something is patching tokens again"],
    [/pageTokensFor\(/, "per-page colours are being assembled again"],
  ]) assert.doesNotMatch(code, re, why);

  // ── (b) AND NO CONTAINER PAYLOAD CARRIES ONE ───────────────────────────────
  //
  // SCOPED TO THE PAYLOAD BY BRACE DEPTH, never matched across the whole file.
  // The first draft forbade `\n\s+style: ` outright and went red on
  // `style: { type: "number" …}` — the TTS voice-tuning field, a completely
  // unrelated feature — which is a false alarm on correct code, and this repo
  // rates that worse than the miss.
  const payloads = [];
  for (const m of code.matchAll(/body: JSON\.stringify\(\{/g)) {
    let d = 1, i = m.index + m[0].length;
    for (; i < code.length && d > 0; i++) {
      if (code[i] === "{") d++;
      else if (code[i] === "}") d--;
    }
    const body = code.slice(m.index, i);
    if (body.includes("worker: true") || body.includes("fontFiles:")) payloads.push(body);
  }
  assert.ok(payloads.length >= 2, "found " + payloads.length + " container payloads — the walk stopped matching");
  for (const body of payloads) {
    for (const [re, why] of [
      [/\n\s+seeds: /, "a payload carries a palette again"],
      [/\n\s+tokens: /, "a payload carries a token patch again"],
      [/\n\s+style: /, "a payload carries the style axes again"],
      [/\n\s+pageTokens: /, "a payload carries per-page colours again"],
      [/\n\s+pageFonts: /, "a payload carries per-page typefaces again"],
      // `fonts:` LEFT THIS LIST ON 2026-08-27: the pair flows again, and only
      // as `themeFontPair(theme)` — the theme's own curated recommendation,
      // never the model's answer and never the stored look's. The shape is
      // pinned below rather than forbidden here.
    ]) assert.doesNotMatch(body, re, why);
    // …AND IT STILL CARRIES WHAT IT MUST, or the absences above pass on a
    // payload that has stopped describing a look at all. `theme` and the
    // theme-derived pair joined `css` when the registry returned — a payload
    // missing either is a themed site republishing on the plain template.
    assert.match(body, /\n\s+css: /, "a container payload no longer carries the stylesheet");
    assert.match(body, /\n\s+theme: /, "a container payload no longer carries the theme — a themed site republishes plain");
    assert.match(body, /\n\s+fonts: themeFontPair\(/,
      "a payload's typeface pair no longer comes from the theme's own recommendation");
  }
  // AND THE ONE THING THAT DID SURVIVE, because the seven absences above pass
  // perfectly on a platform where no site can have a look at all: the stylesheet
  // is still read, still stored and still sent. The chain below asserts it link
  // by link; this is the floor that stops THIS test going vacuous.
  assert.match(code, /readCss\(designed && designed\.css\)/,
    "the build path no longer reads the model's stylesheet");
  // …AND `EDIT_FIELDS` STILL NAMES `seeds` AND `fonts`, deliberately. Nothing
  // sends them any more, and `mergeLook` rebuilds its output from that list — so
  // a name dropped there DESTROYS a stored value on the next unrelated edit
  // rather than merely ignoring it. Kept and unused beats deleted and lossy.
  assert.match(read("builder/site-edit.mjs"), /EDIT_FIELDS = \[[^\]]*"seeds"[^\]]*"fonts"/,
    "`seeds` or `fonts` left EDIT_FIELDS — a stored value is now destroyed rather than ignored");
});

/* ── 3. THE CHAIN ────────────────────────────────────────────────────────── */

test("THE STYLESHEET REACHES THE PAGE — every link, because any one kills it silently", () => {
  // 1. the designer can answer at all
  assert.match(tool, /\n\s{6}css: \{/, "design_schema has no css field");
  // 2. …the answer is read through the module rather than trusted raw
  assert.match(worker, /readCss\(designed && designed\.css\)/, "the build path never reads the answer");
  // 3. …it is stored
  assert.match(worker, /patchSiteConfig\(env, slug, db, \{ css: siteCss \}\)/, "the stylesheet is never stored");
  // 4. …and read back EVERYWHERE THE LOOK IS.
  //
  //    THIS USED TO BE A SCAN OVER `_meta` QUERIES AND IS NOW A PROPERTY, which
  //    is a stronger claim reached by a smaller check. The failure it guards is
  //    a path that reads the palette and NOT the stylesheet, republishing the
  //    site on the template's plain defaults with its whole design gone — the
  //    `site_logo` failure at the scale of every page at once. While each reader
  //    wrote its own `SELECT … WHERE k IN (…)` that was a real hazard, because a
  //    reader could legitimately ask for four of the five keys.
  //
  //    Since 2026-08-24 the look is ONE R2 OBJECT and `loadConfig` answers with
  //    every field or refuses. So a reader cannot get the palette without the
  //    stylesheet: there is no query to leave a key out of. What has to hold
  //    instead is that nothing has grown a second way to read a look.
  assert.match(read("site-config.mjs"), /CONFIG_FIELDS = \[[^\]]*"css"/,
    "the stylesheet is no longer part of a site's config, so a reader can miss it again");
  const readers = (worker.match(/readSiteConfig\(env,/g) || []).length;
  assert.ok(readers >= 4, "only " + readers + " config readers found — the scan stopped matching");
  //    …AND NOTHING READS A LOOK FIELD OUT OF `_meta` ANY MORE. This is the
  //    absence that makes the property above true rather than merely likely: one
  //    lane going back to its own query is one lane that can leave a key out.
  for (const k of ["site_look", "site_css", "site_logo", "site_icon", "site_verify", "site_lang_strings"]) {
    assert.doesNotMatch(worker, new RegExp("_meta[^\\n]*'" + k + "'"),
      k + " is read or written through `_meta` again — the look has two stores, and whichever is read first wins");
  }
  // 5. …it reaches both container payloads
  assert.equal((worker.match(/css: cssRead\.usable \? cssRead\.css : undefined/g) || []).length, 2,
    "a container payload does not carry the stylesheet");
  // 6. …and the container writes it, LAST
  assert.match(container, /const cssUsed = writeCss\(payload\.css\)/, "the container never writes it");
  const w = container.indexOf("const cssUsed = writeCss(");
  for (const before of ["writeTheme(", "writeTokens(", "writePageTokens(", "writeFonts("]) {
    assert.ok(container.indexOf(before) < w,
      before + " runs after the model's stylesheet, so a stored look would overwrite it");
  }
});

test("THE LABEL GUARD COVERS THE ON-FILL PAIRS AND NOTHING ELSE", () => {
  // A BUTTON'S WORDS MAY NOT BE ITS OWN FILL. Four live sightings of one rule:
  // `a, nav a { color: var(--muted-foreground) }` — unlayered, so it beat the
  // kit's own layered utility — painted every CTA label its own background.
  //
  // THE SIX ARE THE FOREGROUNDS THAT SIT ON A FILLED SWATCH. Measured off the
  // kit: those are the pairs where breaking one blanks the words.
  assert.deepEqual([...ON_FILL_PAIRS],
    ["primary", "secondary", "accent", "destructive", "success", "warning"],
    "the on-fill set moved — a label colour is guarded or freed that was not before");
  for (const n of ON_FILL_PAIRS) {
    assert.ok(LABEL_GUARD.includes(".text-" + n + "-foreground{color:var(--" + n + "-foreground)}"),
      n + " has no label guard — a blanket element rule can blank that label again");
  }
  // …AND THE THREE THAT MUST STAY FREE, which is the half that decides whether
  // this is a guard or a cage. `muted-foreground` alone is 7,444 uses in the
  // kit: it is the colour of ordinary text on ordinary paper, and quieting
  // links with it is exactly the freedom the css field promises.
  for (const n of ["muted", "card", "popover"]) {
    assert.ok(!LABEL_GUARD.includes(n + "-foreground"),
      n + "-foreground is guarded — the model can no longer restyle ordinary text");
  }
  assert.ok(!/(^|\n)\s*[a-z]/.test(LABEL_GUARD),
    "the guard carries a bare element selector — it must only ever raise a class above one");
  // EVERY VALUE IS A `var()`, so the model keeps control THROUGH THE TOKEN. A
  // literal here would freeze six colours on every site that writes a
  // stylesheet — a guard that overrules the design rather than protecting it.
  const values = [...LABEL_GUARD.matchAll(/color:([^}]+)\}/g)].map((m) => m[1]);
  assert.equal(values.length, ON_FILL_PAIRS.length, "the guard's shape changed — the scan is reading nothing");
  for (const v of values) {
    assert.match(v, /^var\(--[a-z-]+\)$/, "the guard hardcodes " + v + " — the model cannot move that colour any more");
  }
});

test("…AND IT IS WRITTEN, BEFORE THE MODEL'S SHEET AND ONLY WITH ONE", () => {
  // The wiring, because the block can be perfectly correct and reach no site:
  // this repo has recorded a dozen features right at every layer and dead at
  // one. `build-server.mjs` starts an HTTP server, so it is read rather than
  // driven.
  assert.match(container, /import \{[^}]*\bLABEL_GUARD\b[^}]*\} from "\.\/site-freecss\.mjs"/,
    "the container never imports the label guard — every CTA can be blanked again");
  const write = /fs\.writeFileSync\(STYLES, base \+ "\\n" \+ LABEL_GUARD \+ "\\n" \+ SHELL_GUARD \+ "\\n" \+ report\.css \+ "\\n"\)/;
  assert.match(container, write, "the guard is not written beside the model's stylesheet");
  // BEFORE, NOT AFTER, and the difference is measured rather than stylistic:
  // both placements beat a blanket element rule (a class wins on specificity
  // whatever the order), and only this one leaves a model that aims at
  // `.text-primary-foreground` itself in charge of it. It also keeps the css
  // field's own promise — YOUR RULES ARE WRITTEN LAST — literally true.
  const line = container.match(write)[0];
  assert.ok(line.indexOf("LABEL_GUARD") < line.indexOf("report.css"),
    "the guard is written after the model's sheet — a deliberate label rule can no longer win");
  assert.ok(line.indexOf("SHELL_GUARD") < line.indexOf("report.css"),
    "the shell guard is written after the model's sheet");
  assert.match(container, /import \{[^}]*\bSHELL_GUARD\b[^}]*\} from "\.\/site-freecss\.mjs"/,
    "the container never imports the shell guard — the shell can be re-gridded again");
  // …ONLY ON THE APPLIED PATH. A site that sent no stylesheet must compile to
  // byte-identical output, or one deploy re-styles every site on the platform.
  const at = container.indexOf("function writeCss(");
  assert.ok(at > 0, "writeCss moved — this check is reading nothing");
  const fn = container.slice(at, container.indexOf("\n}", at));
  assert.ok(fn.indexOf("if (!report.usable)") < fn.indexOf("LABEL_GUARD"),
    "the guard is written before the usable check, so a build that sent no stylesheet is no longer untouched");
});

test("THE SHELL GUARD PINS THE STACKING AND NOTHING ELSE", () => {
  // Run 51: the model's sheet re-gridded `site-chrome` — the shell whose
  // children are header, page and footer STACKED — and grid auto-placement
  // dealt them into columns (brand clipped, footer in a 216px gutter,
  // measured live on northgroup-15). The guard closes that in the cascade:
  // a DOUBLED attribute selector scores (0,2,0) against the (0,1,0) any
  // plausible model rule carries, and among unlayered rules specificity
  // decides wherever each lands.
  assert.ok(SHELL_GUARD.startsWith("[data-slot=site-chrome][data-slot=site-chrome]{"),
    "the selector is no longer doubled — the guard loses to any model rule on the shell");
  assert.match(SHELL_GUARD, /display:flex/, "the stacking's display is no longer pinned");
  assert.match(SHELL_GUARD, /flex-direction:column/, "the stacking's direction is no longer pinned");
  // MINIMAL BY DESIGN: only the stacking. A guard that creeps into colour,
  // spacing or size is the platform overruling skin the law says is the
  // model's — count the declarations rather than trusting the intent.
  const decls = SHELL_GUARD.slice(SHELL_GUARD.indexOf("{") + 1, SHELL_GUARD.indexOf("}"))
    .split(";").filter(Boolean);
  assert.equal(decls.length, 2, "the shell guard grew past the stacking: " + decls.join(";"));
  // ONE rule, ONE subject — a second selector here is a second component
  // being pinned, which is a decision, not a tidy-up.
  assert.equal((SHELL_GUARD.match(/\{/g) || []).length, 1, "the shell guard grew a second rule");
  assert.ok(!SHELL_GUARD.includes(","), "the shell guard grew a second subject");
});

test("A REVISE IS SHOWN THE SHEET, and told to hand it back with the change made", () => {
  // `css` is REPLACED rather than merged — a stylesheet is one whole thing, not
  // a set of named slots — so the anti-re-roll guarantee cannot live in a merge
  // the way `mergeTokens`' does. It lives in the prompt instead, and BOTH halves
  // are needed: the model has to SEE the current sheet, and it has to be TOLD
  // that what it returns replaces everything.
  const edit = read("builder/site-edit.mjs");
  assert.match(edit, /const css = str\(c\.css\)/, "currentStateNote never reads the stored stylesheet");
  assert.match(edit, /ITS STYLESHEET/, "the note never labels it, so the model cannot tell what it is looking at");
  assert.match(edit, /A change to the LOOK[^.]*is `css` and nothing else/, "the rule never names the field");
  assert.match(edit, /REPLACES the whole stylesheet/i,
    "the rule never says a fresh sheet loses everything, which is the one thing it has to say");
  // …and NOT capped. A `.slice()` here would have the model return the truncated
  // sheet, that answer would REPLACE the stored one, and the tail of the
  // customer's design would be gone — silently, on a request about a phone
  // number. `MAX_CSS` bounds it once, at the door, where it refuses rather than
  // destroys.
  const at = edit.indexOf("const css = str(c.css)");
  assert.ok(at > 0, "the note no longer reads the stylesheet at all, so this cap check is watching nothing");
  assert.doesNotMatch(edit.slice(at, edit.indexOf("\n  }", at)), /\.slice\(/,
    "the stylesheet is truncated on its way to the model, so a revise silently drops the tail of the design");
  // AND BOTH LANES SUPPLY IT. The build route's `editState` and the look lane's
  // `current` are two separate objects: one carrying it and not the other is a
  // revise that re-rolls the look on whichever path the customer happened to hit.
  assert.match(worker, /const storedCss = cfg\.ok \? cfg\.config\.css : ""/,
    "the build route never reads the sheet for the designer");
  assert.match(worker, /css: storedCss,/, "the build route reads the sheet and does not hand it over");
  assert.match(worker, /css: priorCss,/, "the look lane reads the sheet and does not hand it over");
});

test("AN UNUSABLE ANSWER KEEPS WHAT IS STORED — on both lanes", () => {
  // `readCss` refuses a non-string and an empty string, and neither is an
  // instruction to strip a customer's site bare. Asserted at the assignment on
  // both lanes, because a lane that took the answer regardless would publish an
  // empty stylesheet over a live design and report success.
  assert.match(worker, /const siteCss = cssAsk\.usable \? cssAsk\.css : priorCss;/,
    "the build path replaces the stored sheet with an unusable answer");
  assert.match(worker, /const nextCss = cssAsk\.usable \? cssAsk\.css : priorCss;/,
    "the look lane replaces the stored sheet with an unusable answer");
});

test("THE CUSTOMER IS TOLD, at both ends of the wire", () => {
  // A css change moves no NAMED thing — `moved`, `tokens` and `style` are all
  // lists of names — so without a word for it the reply is "✅ Updated the look."
  // with nothing after it, on the one lane every colour change is now routed to.
  // That is the works-but-cannot-say-so shape, and it reads to a customer as a
  // change that silently failed.
  assert.match(worker, /css: cssMoved \|\| undefined,/, "the look reply never says the stylesheet moved");
  assert.match(chat, /e\.css \? \['the design'\] : \[\]/, "the client never renders it");
  // AND THE SENTENCE ABOUT WHAT THE SHEET COSTS, on BOTH replies. The build path
  // says it too — unlike `styleNote`, which is silent on a first build because
  // naming axes to somebody seeing their site for the first time describes a
  // design they never asked to change. This one names FAILURES, and those are
  // just as wrong on a first build and just as invisible from the page.
  assert.equal((worker.match(/cssNote: cssNote\(cssAsk\)/g) || []).length, 2,
    "one of the two replies does not say what the stylesheet cost the site");
  assert.match(chat, /e\.cssNote/, "the look reply never renders the sentence");
  assert.match(chat, /d\.cssNote/, "the build reply never renders the sentence");
});

test("THE LOOK LANE COUNTS THE STYLESHEET AS A CHANGE — at both of its gates", () => {
  // ── FOUND BY MUTATION, AND BOTH SURVIVORS ARE THE SAME FAILURE ─────────────
  //
  // Since 2026-08-23 `css` is the ONLY thing a look edit moves — `tokens` and
  // `style` are gone from the tool, so `tokensMoved` and `styleMoved` are false
  // on every build there is. That makes these two conditions the whole lane, and
  // nothing was holding either of them.
  //
  // 1. THE NO-CHANGE GATE. Drop `!cssMoved` and a sheet that really moved reads
  //    as nothing moved; `named` is true (`cssAsk.usable`), so the lane answers
  //    "Your site already looks like that — nothing to change." The customer's
  //    colour change is not applied, not published, and REPORTED AS ALREADY
  //    DONE, which is the one answer they cannot act on.
  const lane = worker.slice(worker.indexOf('if (eLayer === "look") {'));
  assert.ok(lane.length > 1000, "the look lane moved and this guard is reading nothing");
  const gate = lane.match(/if \(!moved\.length &&([^)]*)\) \{/);
  assert.ok(gate, "the look lane's no-change gate moved");
  assert.match(gate[1], /!cssMoved/,
    "a css-only look edit reads as nothing to do, so the change is dropped and reported as already applied");
  // 2. THE ESCALATION GATE. `site_look` can be thin or absent on a site whose
  //    whole design is in `site_css` — that is the ordinary shape of everything
  //    built from today. Gated on the look alone, every such site escalates its
  //    colour change to a ~27-credit page rewrite, which recompiles from the very
  //    same stylesheet and cannot change a colour either.
  const esc = lane.match(/if \(![A-Za-z]+([^)]*)\) return escalate\("no-look"\);/);
  assert.ok(esc, "the look lane's no-look escalation moved");
  assert.match(esc[1], /!priorCss/,
    "a site whose design lives in the stylesheet escalates every colour change to a rebuild");
  // 3. AND THE BUILD ROUTE'S OWN GATE, which is the same failure one lane over
  //    and was the third survivor of the same sweep. `editState` is what tells
  //    the designer the site's name, its stylesheet and `EDIT_RULE`; gated on
  //    `stored` alone, a site whose `site_look` is thin while `site_css` carries
  //    the whole design is handed NONE of it and designs from scratch — the
  //    re-roll the anchoring exists to stop, on the revise path.
  const build = worker.match(/if \(stored([^)]*)\) \{\s*\n\s*editState = \{/);
  assert.ok(build, "the build route's editState gate moved");
  assert.match(build[1], /\|\| storedCss/,
    "a revise of a site whose design lives in the stylesheet is not treated as an edit at all");
});

test("A FAILED COMPILE PUTS THE STORED SHEET BACK", () => {
  // The sheet is stored BEFORE the recompile because `recompileAndPublish` reads
  // it from the store — and so does every other publish path, so a failed
  // compile would leave the change waiting for the customer's next unrelated
  // edit to apply it silently, under a version label naming only the typo they
  // were fixing. At the scale of the whole design.
  const b = worker.slice(worker.indexOf('if (eLayer === "look") {'));
  const roll = b.slice(b.indexOf("restored = true"), b.indexOf('error: "compile"'));
  assert.ok(roll.length > 100, "the look lane's rollback block moved — the absence below would pass over nothing");
  assert.match(roll, /cssMoved \? \{ look: priorLook, css: priorCss \}/,
    "a failed look compile does not put the stylesheet back");
  // GATED ON HAVING MOVED, so a lane that touched no CSS writes nothing back
  // for it. The type discipline that used to need its own assertion here — the
  // sheet is a STRING and `JSON.stringify`ing it stores a quoted, escaped copy
  // the container hands to the browser as one string literal — is now a property
  // of the store: `site-config.mjs` keeps each field in its own type and there
  // is no per-key serialisation left to get wrong.
  assert.match(roll, /if \(!w\.ok\) throw/, "a failed restore is swallowed, so it reads as a clean rollback");
});

test("THE MODEL IS TOLD WHAT ITS RULES LAND ON — the facts it cannot guess", () => {
  // Every one of these is a property of OUR template rather than of CSS, so a
  // model not told about it cannot know: which custom properties the kit paints
  // with, that dark mode is a class rather than a media query, that a page can
  // be addressed at all, that a `url()` to another host is refused, and that a
  // family name is a request for a FILE. The `publicView` failure — a capability
  // conditioned on a fact the model was never given — has cost this platform a
  // whole build twice.
  const at = worker.indexOf("      css: {");
  assert.ok(at > 0, "the css field is gone");
  const field = worker.slice(at, worker.indexOf("\n      },", at));
  assert.match(field, /SITE_TOKEN_NAMES\.map/,
    "the token list is restated rather than derived, so it drifts from what the kit reads");
  assert.match(field, /`\.dark`|\.dark/, "nothing says dark mode is a class");
  assert.match(field, /body\[data-page/, "nothing says a page can have its own look");
  assert.match(field, /url\(\)/, "nothing says a remote url\\(\\) is refused, so a site's look is spent on one");
  assert.match(field, /Google Fonts/, "nothing says how a typeface is obtained");
  assert.match(field, /written LAST|WRITTEN LAST/, "nothing says the model's rules win");
});

/* ── 5. THE LOOK IS ONE THING, DERIVED ──────────────────────────────────────
 *
 * The four tests above assert this feature by feature. This one asserts the
 * PROPERTY, derived from the `_meta` keys themselves, so a sixth look concept
 * stored tomorrow is covered without anybody remembering this file.
 */

test("EXACTLY ONE STORED FIELD DECIDES WHAT A SITE LOOKS LIKE", () => {
  // ── WHY DERIVED RATHER THAN A LIST ─────────────────────────────────────────
  //
  // `site_tokens`, `site_page_tokens`, `site_page_fonts` and `site_style` were
  // all look keys until 2026-08-24, each written by two lanes and read by three
  // — and every one was DEAD from 2026-08-23, when `design_schema` stopped
  // offering the field that fed it. Four dead stores is what a hand-kept list
  // produces; the durable form is to name what a look field IS and let the scan
  // find them.
  //
  // A LOOK FIELD IS ONE THE CONTAINER IS SENT AS THE DESIGN. `logo`, `icon`,
  // `verify` and `langStrings` are stored beside the stylesheet and are NOT the
  // look — they are artwork, a verification tag and a translation cache — so the
  // discriminator is what the payload styles with, not the fact of being stored.
  //
  // DERIVED FROM `CONFIG_FIELDS` SINCE THE MOVE TO R2, which is the same claim
  // one store along: the whole config is six named fields in one module, so a
  // seventh look concept has to be declared there to exist at all.
  const fields = new Set(CONFIG_FIELDS);
  assert.ok(fields.size >= 4, "only " + fields.size + " config fields found — the scan stopped matching");

  // THE FOUR THAT WENT, asserted by name as well as by the derivation above,
  // because a scan that silently stopped matching would pass the derived half.
  // Checked against the config AND against `_meta`, since restoring one to
  // either store is what would make the look two things again.
  for (const k of ["tokens", "pageTokens", "pageFonts", "style"]) {
    assert.ok(!fields.has(k), "`" + k + "` is a stored look field again — the look is two things");
  }
  for (const k of ["site_tokens", "site_page_tokens", "site_page_fonts", "site_style"]) {
    assert.doesNotMatch(code, new RegExp("'" + k + "'"), "`" + k + "` is a stored look key again");
  }
  // …AND THE ONE THAT STAYED, or every absence above passes on a platform with
  // no look at all.
  assert.ok(fields.has("css"), "the stylesheet is no longer stored — a site has no look");
});

test("AND ITS ENGINE RUNS IN EXACTLY ONE PLACE", () => {
  // A LOOK IS RENDERED IN THE CONTAINER AND NOWHERE ELSE, which was already
  // this repo's rule. Since 2026-08-27 the look's base is a REGISTRY THEME:
  // `writeTheme` resolves the name through `resolveTheme` in the container, and
  // the Worker never renders one — its only judging is `FIELD_KEEPS.theme`
  // asking the same registry whether an answer counts, which is a different
  // question at a different moment, not a second rendering.
  //
  // `normalizeSeeds` LEFT build-server WITH THE SEEDS ERA — the palette engine
  // survives inside `site-identity.mjs`, where `markGround` still derives a
  // favicon ground from any stored 2026-08-20-era seeds — and the Worker must
  // not regain it: two places judging one palette is how the same colours get
  // refused on one path and accepted on the other.
  assert.doesNotMatch(code, /normalizeSeeds\(/,
    "the Worker judges a palette again — two places can now refuse the same colours");
  assert.match(container, /resolveTheme\(/,
    "the container no longer resolves the theme — every themed site ships the default look");
  assert.match(read("builder/site-identity.mjs"), /normalizeSeeds\(/,
    "the favicon's ground is no longer judged by the one palette engine");
});
