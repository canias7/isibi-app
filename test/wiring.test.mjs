// IS IT REACHABLE? — the check this repo keeps needing and keeps not having.
//
// The pattern, five times over: something is written, tested, on disk, and
// reachable by NOTHING. The 27 blocks, the 196 examples, the 1,140 charts, and
// eleven schema-engine features all shipped that way. Every one of them
// compiled, every unit test passed, and none of it could be used.
//
// site-theme.mjs and site-layouts.mjs were the sixth and seventh: both were
// imported only by their own tests when this file was written, so no generated
// site could carry a theme or a layout family. These assertions are the chain
// from a module on disk to a value in a built site, checked link by link,
// because every previous instance had four of five links working.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { THEME_IDS, THEME_SHORTLIST, ALL_THEMES, resolveTheme } from "../builder/site-theme-registry.mjs";
import { budgetFor, imageBudget } from "../builder/site-images.mjs";
import { mergeLook, movedFields, hasValue, EDIT_RULE, currentStateNote } from "../builder/site-edit.mjs";
import { themeCss, THEMES } from "../builder/site-theme.mjs";
import { briefWithLayout } from "../builder/page-gen.mjs";
import { FAMILY_NAMES, READY_FAMILIES, STRUCTURE_NAMES, STRUCTURES, layoutDirective, familiesForPrompt, structuresForPrompt, FAMILIES } from "../builder/site-layouts.mjs";
import { UI_COMPONENTS, UI_SHORTLIST, PAGE_RULES, schemaDigest, lintPages } from "../builder/page-gen.mjs";

const ROOT = path.join(import.meta.dirname, "..");
const worker = fs.readFileSync(path.join(ROOT, "worker.js"), "utf8");
const buildServer = fs.readFileSync(path.join(ROOT, "builder/build-server.mjs"), "utf8");

test("every theme the designer may pick actually resolves and renders", () => {
  assert.equal(THEME_IDS.length, Object.keys(ALL_THEMES).length);
  assert.ok(THEME_IDS.length >= 500, `only ${THEME_IDS.length} themes reachable`);
  for (const id of THEME_IDS) {
    const t = resolveTheme(id);
    assert.ok(t, `${id} is offered and does not resolve`);
    const css = themeCss(t);
    assert.ok(typeof css === "string" && css.length > 200, `${id} renders nothing usable`);
  }
});

test("a promoted theme wins over its candidate of the same name", () => {
  // The registry spreads THEMES last precisely so promotion — the version whose
  // `needs` capability is actually built — beats the swatch. Asserted rather
  // than left to the reader, because the ordering looks arbitrary.
  for (const name of Object.keys(THEMES)) {
    assert.deepEqual(ALL_THEMES[name], THEMES[name], `${name} is not the promoted version`);
  }
});

test("a world is merged UNDER its theme, so a hand-authored axis wins", () => {
  // worlds.mjs states this rule in its own header. Reversed, a generated world
  // silently overwrites an axis somebody chose by hand — invisible, because both
  // values are valid and the site still builds.
  const zine = resolveTheme("zine");
  assert.equal(zine.decor, "paper", "the world was not merged at all");
  assert.equal(zine.inputs, "underline", "the world overwrote the theme's own axis");
});

test("an unknown theme resolves to null rather than throwing", () => {
  // A theme is decoration on a site whose data layer is already live. Losing a
  // build over a misspelt name would be the tail wagging the dog.
  assert.equal(resolveTheme("no-such-theme"), null);
  assert.equal(resolveTheme(""), null);
  assert.equal(resolveTheme(undefined), null);
  assert.equal(resolveTheme(42), null);
});

test("the designer is OFFERED a theme and a family, both derived", () => {
  // Derived, not restated: a hand-typed list here would drift from the module
  // and offer a name that resolves to nothing.
  assert.match(worker, /const SITE_THEME_IDS = THEME_SHORTLIST;/);
  // READY only. The enum used to be every family while familiesForPrompt()
  // described ready ones alone, so the model could be offered a name it was
  // told nothing about and whose directive resolves to null.
  assert.match(worker, /const SITE_FAMILY_IDS = READY_FAMILIES;/);
  assert.match(worker, /enum: SITE_THEME_IDS/);
  assert.match(worker, /enum: SITE_FAMILY_IDS/);
});

test("and REQUIRED to choose, or every site silently keeps the default look", () => {
  const req = worker.match(/required: \[("[a-z]+", ?)+"[a-z]+"\],\s*\n\s*\},\s*\n\};/);
  assert.ok(req, "could not find design_schema's required list");
  assert.match(req[0], /"theme"/);
  assert.match(req[0], /"family"/);
});

test("the shortlist is 100, spread over every category, and still all resolve", () => {
  // A flat first-100 would be every print and tech theme and nothing else — a
  // shortlist that cannot dress a bakery. The round-robin is what stops that,
  // and it is invisible unless something checks the spread.
  assert.equal(THEME_SHORTLIST.length, 100);
  const allCats = new Set(Object.values(ALL_THEMES).map((t) => t.cat || "shipped"));
  const listCats = new Set(THEME_SHORTLIST.map((n) => ALL_THEMES[n].cat || "shipped"));
  assert.equal(listCats.size, allCats.size, `only ${listCats.size} of ${allCats.size} categories are offered`);
  for (const n of THEME_SHORTLIST) assert.ok(resolveTheme(n), `${n} is offered and does not resolve`);
  assert.equal(new Set(THEME_SHORTLIST).size, 100, "the shortlist repeats a theme");
});

test("the promoted themes are always offered", () => {
  // They are the two whose `needs` are actually built. Losing one because a
  // category lane filled first would make the best-supported themes the least
  // likely to be chosen.
  for (const name of Object.keys(THEMES)) {
    assert.ok(THEME_SHORTLIST.includes(name), `${name} is promoted and not offered`);
  }
});

test("the other 400 are bounded, not lost — any of the 500 still resolves", () => {
  // The fonts bargain: the shortlist bounds what the MODEL picks between, and a
  // caller naming one directly on the request body reaches any of them.
  const offList = THEME_IDS.filter((n) => !THEME_SHORTLIST.includes(n));
  assert.equal(offList.length, THEME_IDS.length - 100);
  for (const n of offList) assert.ok(resolveTheme(n), `${n} is unreachable even by name`);
  // DRIVEN, NOT SPELLED. This pinned the inline `(priorLook && …) || (designed
  // && …) || (body && …)` chain twice over and went red when the merge moved
  // into `mergeLook` — a correct change failing a test about word order. The
  // property that keeps an off-list theme reachable is that a body-supplied
  // theme survives when nothing else names one, whoever implements it.
  assert.equal(mergeLook(null, null, { theme: "off-list-one" }).theme, "off-list-one",
    "a theme named on the request body no longer reaches the build");
  assert.equal(mergeLook(null, { theme: "designed" }, { theme: "off-list-one" }).theme, "designed",
    "the body outranks the designer on a first build");
  // …and the route has to actually use it, or the merge is correct and unread.
  assert.match(worker, /const merged = mergeLook\(priorLook, designed, body/, "the route does not merge the look");
  assert.match(worker, /\n\s*theme: lookTheme,/, "the look no longer uses the resolved theme");
});

test("the DESIGN call is cached, like the page call", () => {
  // It carries ~6,800 tokens that are byte-identical every build and was paying
  // full price for all of them, while the page call — three and a half times
  // bigger — was a cache read. The small call was the expensive one.
  const i = worker.indexOf("async function designSiteSchema");
  assert.ok(i > 0, "designSiteSchema moved");
  const call = worker.slice(i, i + 3500);
  assert.match(call, /tools: \[\{ \.\.\.SITE_SCHEMA_TOOL, cache_control: \{ type: "ephemeral" \} \}\]/);
  assert.match(call, /system: \[\{ type: "text", cache_control: \{ type: "ephemeral" \}/,
    "the system block must be a block array, or cache_control has nowhere to live");
});

test("the chosen theme reaches the container, by name", () => {
  // The seam that was missing entirely: the enum existed in an earlier draft and
  // the value went nowhere, so the model chose a theme on every build and no
  // site ever wore one.
  assert.match(worker, /theme: theme \|\| null,/);
  assert.match(worker, /async function buildAndPublishPages\(env, \{[^}]*\btheme\b[^}]*\}\)/);
});

test("the chosen family reaches the PAGE prompt as a directive, not a name", () => {
  // THIRD TIME THIS WENT RED FOR A CORRECT CHANGE — twice for the variant axis
  // arriving and leaving, now for the composition moving into page-gen.mjs so
  // the eval could reach it. Its own comment already called that the sign of an
  // assertion pinned too tightly, and matching a looser regex was not enough:
  // the fix is to stop asserting WHERE it happens.
  //
  // What must be true: the worker hands BOTH axes to the shared composer, and
  // that composer really does turn them into a directive. The second half is
  // behavioural, so it holds wherever the code lives.
  assert.match(worker, /briefWithLayout\(\{[^}]*\bfamily\b[^}]*\bstructure\b[^}]*\}\)/s,
    "the worker no longer passes the family and its structure to the composer");
  const out = briefWithLayout({ brief: "a shop", family: "store", structure: "card-grid" });
  assert.match(out, /^a shop\n\n/, "the brief must still lead");
  assert.match(out, /LAYOUT — /, "the family must arrive as a directive, not a name");
  assert.ok(out.includes(STRUCTURES["card-grid"].text), "the structure must ride with it");
});

test("a null directive is never interpolated into the brief", () => {
  // layoutDirective answers null for an unknown family or structure, and the
  // unguarded form appends the literal word "null" and LOSES the layout.
  // Asserted behaviourally rather than by matching the guard's spelling.
  assert.equal(layoutDirective("store", { structure: "nope" }), null, "the null case moved");
  for (const args of [
    { brief: "a shop" },
    { brief: "a shop", family: "not-a-family" },
    { brief: "a shop", family: "store", structure: "nope" },
  ]) {
    assert.equal(briefWithLayout(args), "a shop", JSON.stringify(args));
  }
});

test("the structure axis is offered, optional, and every name works", () => {
  // Optional on purpose, unlike the other three: every family declares a
  // sensible default, so a skipped answer is a good answer. The fonts field is
  // required because skipping it means no typeface at all — skipping this one
  // means "the shape this kind of site usually takes".
  assert.match(worker, /const SITE_STRUCTURE_IDS = STRUCTURE_NAMES;/);
  assert.match(worker, /enum: SITE_STRUCTURE_IDS/);
  const req = worker.match(/required: \[("[a-z]+", ?)+"[a-z]+"\],\s*\n\s*\},\s*\n\};/);
  assert.ok(req && !/"structure"/.test(req[0]), "structure is required, so a good default can never apply");
  for (const st of STRUCTURE_NAMES) {
    const d = layoutDirective("store", { structure: st });
    assert.ok(d && d.includes(STRUCTURES[st].text), `${st} is offered and does not reach the directive`);
  }
});

test("the structure reaches the route, and the model is told what each one is", () => {
  // The property rather than the spelling — same move as the theme chain above.
  assert.equal(mergeLook(null, null, { structure: "bento" }).structure, "bento",
    "a structure named on the request body no longer reaches the build");
  assert.equal(mergeLook({ structure: "sidebar" }, { structure: "bento" }, null).structure, "sidebar",
    "an uninstructed designer overrides the stored structure again");
  assert.match(worker, /structure: look\.structure,/, "and the resolved value has to reach the build");
  assert.match(worker, /async function buildAndPublishPages\(env, \{[^}]*\bstructure\b[^}]*\}\)/);
  assert.match(worker, /structuresForPrompt\(\)/, "the eight are offered as bare names with no description");
  const blurbs = structuresForPrompt();
  for (const st of STRUCTURE_NAMES) assert.ok(blurbs.includes(st + " —"), `${st} is offered undescribed`);
});

test("omitting the structure keeps the family's own default", () => {
  // The whole reason it can be optional. If the override leaked in as undefined
  // and overwrote the default, every site would land on one shape.
  for (const name of READY_FAMILIES) {
    const fam = FAMILIES[name];
    const d = layoutDirective(name, {});
    assert.ok(d.includes(STRUCTURES[fam.structure].text), `${name} lost its default structure`);
  }
});

test("the container turns that name into real CSS, after the font write", () => {
  assert.match(buildServer, /function writeTheme\(/);
  assert.match(buildServer, /resolveTheme\(name\)/);
  // Ordering is the correctness argument: writeFonts restores styles.css from
  // the pristine base, so a theme written first is overwritten by it.
  const fontsAt = buildServer.indexOf("const fontsUsed = writeFonts(");
  const themeAt = buildServer.indexOf("const themeUsed = writeTheme(");
  assert.ok(fontsAt > 0 && themeAt > 0, "one of the two writes is missing");
  assert.ok(themeAt > fontsAt, "writeTheme runs BEFORE writeFonts and will be overwritten");
});

test("the theme write fails soft — a bad name never costs the site", () => {
  const fn = buildServer.slice(buildServer.indexOf("function writeTheme("));
  const body = fn.slice(0, fn.indexOf("\n}\n"));
  assert.match(body, /if \(!theme\) return \{ applied: false/);
  assert.match(body, /catch/);
  assert.ok(!/throw/.test(body), "writeTheme can throw, which would take the build with it");
});

test("the designer is told what each family BUILDS, derived from the module", () => {
  // It described four of the 26 by hand and left the other 22 to be chosen from
  // a bare name. A hand-written sample is also the shape that drifts: the module
  // gains a family, the description does not, and nothing says so.
  assert.match(worker, /familiesForPrompt\(\)/, "the family field no longer carries the descriptions");
  const blurbs = familiesForPrompt();
  for (const name of READY_FAMILIES) {
    assert.ok(blurbs.includes(name + " —"), `${name} is offered with no description of what it builds`);
  }
});

test("the readiness gate is a real filter, not an alias", () => {
  // THIS ASSERTION USED TO DEMAND AT LEAST ONE NOT-READY FAMILY, on the ground
  // that with none the gate is never observed doing anything. True, and it made
  // the guard depend on the repo staying incomplete — it went red the day the
  // last family landed, which is the one day it should have been celebrating.
  //
  // Checking it against VALUES cannot work once every family is ready: an alias
  // and a filter agree exactly when nothing is filtered out. So it is checked
  // against the SOURCE instead, which is what stays true either way. Restore a
  // not-ready family tomorrow and this still holds.
  const layouts = fs.readFileSync(path.join(ROOT, "builder/site-layouts.mjs"), "utf8");
  assert.match(layouts, /READY_FAMILIES\s*=\s*FAMILY_NAMES\.filter\(\s*\(\s*\w+\s*\)\s*=>\s*FAMILIES\[\w+\]\.ready\s*\)/,
    "READY_FAMILIES no longer derives from the ready flag — a not-ready family would be offered to the designer");
  assert.match(layouts, /function familiesForPrompt\(\)\s*\{\s*return READY_FAMILIES/,
    "familiesForPrompt no longer reads READY_FAMILIES, so the gate has stopped applying to the prompt");
  // And the flag has to mean something: a family carrying `wants` is one the
  // gate exists for, so it may never also be ready.
  for (const [id, f] of Object.entries(FAMILIES)) {
    if (f.wants?.length) assert.equal(f.ready, false, `${id} wants components AND is offered to the designer`);
  }
});

test("every family the designer may pick produces a real directive", () => {
  assert.ok(READY_FAMILIES.length >= 26, `only ${READY_FAMILIES.length} ready families`);
  for (const name of READY_FAMILIES) {
    const d = layoutDirective(name);
    assert.ok(typeof d === "string" && d.length > 60, `${name} gives no usable directive`);
    assert.match(d, /LAYOUT —/, `${name}'s directive is not shaped like one`);
  }
});

test("the component shortlist covers every component a family declares", () => {
  // The floor. Each of the 26 families names the components its pages need, and
  // a shortlist missing one breaks that family rather than trimming a prompt —
  // which is why this is 157 and not the 100 originally asked for.
  const declared = new Set();
  for (const fam of Object.values(FAMILIES)) for (const c of fam.components || []) declared.add(c);
  const offered = new Set(UI_SHORTLIST);
  for (const c of declared) assert.ok(offered.has(c), `${c} is declared by a family and not offered to the model`);
});

test("every name in the shortlist is a real component", () => {
  const real = new Set(UI_COMPONENTS);
  for (const c of UI_SHORTLIST) assert.ok(real.has(c), `${c} is offered and does not exist`);
});

test("the LINT still knows all 2,058, so a real import is never refused", () => {
  // Only the PROMPT was shortened. Narrowing the lint too would turn "a
  // component the model was not told about" into "a component the pipeline
  // rejects", which is a much worse failure and a silent one.
  assert.ok(UI_COMPONENTS.length > 2000, `the lint's allow-list shrank to ${UI_COMPONENTS.length}`);
  assert.ok(UI_SHORTLIST.length < UI_COMPONENTS.length, "the shortlist is not actually shorter");
});

test("the rules do not claim the shortlist is everything that exists", () => {
  // Rule 3 used to say "these exist and nothing else does", which was already
  // wrong about the 882 charts and would now be wrong about 1,901 components
  // too. A false absolute in the prompt is how a whole tier goes unused.
  const i = PAGE_RULES.indexOf("THE KIT FOR EVERY CONTROL");
  const rule = PAGE_RULES.slice(i, i + 400);
  assert.ok(!/exist and nothing\s+else does/.test(rule), "rule 3 asserts a falsehood about the kit");
});

/* ------------------------------------------------------------ photographs */

// THE CHAIN, link by link. This feature has the exact shape of the seven that
// were on disk and reachable by nothing: a module, a rule in the prompt, a
// budget, a dep. Four of the five links working is the state every one of those
// shipped in, so each link is asserted separately rather than end-to-end.

const clientJs = fs.readFileSync(path.join(ROOT, "public/chat.js"), "utf8");

test("the build both ASKS for photographs and BUYS them", () => {
  // Either half alone is a dead feature wearing the other's clothes: state the
  // allowance with no dep and the model writes tokens nobody buys (every one
  // becomes a placeholder); supply the dep with no allowance and nothing ever
  // writes a token for it to find. The two live ~10 lines apart and it is
  // entirely possible to add one and forget the other.
  // ANCHORED ON THE DECISION, NOT ITS SPELLING. This named the exact expression
  // `revise ? 0 : imageBudget(family)`, so a correct change failed a test about
  // word order — the trap this repo keeps recording. What matters is that ONE
  // call decides the budget and the model is told that same number.
  assert.match(worker, /const imgBudget = budgetFor\(family, \{ revise, priorPages, slug \}\)/,
    "the budget is no longer derived in one place from the family and the site's own history");
  assert.match(worker, /briefWithLayout\(\{ brief, family, structure, images: imgBudget \}\)/,
    "and stated to the model in the user turn");
  assert.match(worker, /images: \(pages, \{ balance, reserve \}\) =>\s*\n?\s*buySitePhotos\(/,
    "and the dep that buys them is supplied to publishPages");
});

test("a generated photograph is stored where /u/ actually looks for it", () => {
  // A second copy of `uploads/<slug>/` is a picture written where the serving
  // route does not look — a 404 the bundle compiles perfectly around, so
  // nothing else in the pipeline can catch it.
  const fn = worker.slice(worker.indexOf("async function buySitePhotos"), worker.indexOf("// Resolve @@SPRITE"));
  assert.ok(fn.length > 400, "found the function, not an empty window");
  assert.match(fn, /uploadKey\(slug, name\)/);
  assert.match(fn, /uploadUrl\(slug, name\)/);
  assert.ok(!/["']uploads\//.test(fn), "it must not spell the prefix itself");
  assert.ok(!/["']\/u\//.test(fn), "nor the public path");
});

test("the bytes are sniffed and named by content, exactly like an owner upload", () => {
  const fn = worker.slice(worker.indexOf("async function buySitePhotos"), worker.indexOf("// Resolve @@SPRITE"));
  assert.match(fn, /sniffImage\(bytes\)/, "the declared type is what the image model sent, not what we asked for");
  assert.match(fn, /uploadName\(hex, kind\.ext\)/, "content hash, so /u/ can honestly serve it immutable");
  assert.match(fn, /MAX_UPLOAD_BYTES/, "the same size cap the upload route enforces");
});

test("what is BILLED is what was stored, not what was planned", () => {
  // Counting the shots would charge for an image-model outage: six planned, six
  // failures, six charges. `urls` is only written by a successful put.
  const fn = worker.slice(worker.indexOf("async function buySitePhotos"), worker.indexOf("// Resolve @@SPRITE"));
  assert.match(fn, /made: urls\.size/);
  assert.ok(!/made: plan\.shots\.length/.test(fn));
});

test("one failed picture does not cost the others, or the build", () => {
  const fn = worker.slice(worker.indexOf("async function buySitePhotos"), worker.indexOf("// Resolve @@SPRITE"));
  // Per-shot try/catch inside the Promise.all, so a rejection cannot take the
  // whole batch down with it.
  // `lastIndexOf`, because there is an EARLY `return {` above the Promise.all
  // for the nothing-to-buy case — `indexOf` finds that one and slices an empty
  // window, which then matches nothing and reports a gap that is not there.
  const inMap = fn.slice(fn.indexOf("Promise.all"), fn.lastIndexOf("return {"));
  assert.ok(inMap.length > 200, "found the loop body, not an empty window");
  assert.match(inMap, /try \{/);
  assert.match(inMap, /\} catch \(e\) \{/);
  assert.ok(!/throw /.test(inMap.slice(inMap.indexOf("} catch"))), "the catch must not rethrow");
});

test("the photograph sentence reaches the chat", () => {
  // Composed on the server and rendered by the client. `imageNote` returning a
  // string that nothing displays is this repo's most-repeated failure, and the
  // response field alone does not prove the other end exists.
  assert.match(worker, /imagesNote: imageNote\(pages\.images\)/);
  assert.match(clientJs, /d\.imagesNote === 'string'/,
    "public/chat.js must actually read it");
  // `[,)]` rather than a closing paren: the call grew a fifth argument (the
  // build's own failure diagnosis) and this pinned the ARITY while meaning to
  // pin the note. A guard that breaks on an added argument gets loosened by
  // whoever hits it, which is worse than one that never fired.
  assert.match(clientJs, /siteFinishBuild\(origin, .*, build, note[,)]/,
    "and pass it through as the note");
});

test("the image price and the image model are not two answers to one question", () => {
  // `IMAGE_USD` in publish-pages.mjs prices exactly what `SITE_IMG_MODEL`
  // generates. Moving the model without moving the price silently re-prices
  // every build, in whichever direction is worse.
  assert.match(worker, /const SITE_IMG_MODEL = "fal-ai\/nano-banana-pro"/);
  const priced = fs.readFileSync(path.join(ROOT, "worker.js"), "utf8")
    .match(/"fal-ai\/nano-banana-pro":\s*([0-9.]+)/);
  assert.ok(priced, "the model has a row in IMAGE_USD");
  const table = fs.readFileSync(path.join(ROOT, "builder/publish-pages.mjs"), "utf8")
    .match(/export const IMAGE_USD = ([0-9.]+)/);
  assert.ok(table, "and publish-pages states the build's own price");
  assert.equal(Number(table[1]), Number(priced[1]),
    "the build price and the generation price must be the same number");
});

test("every way out of buySitePhotos sweeps the tokens", () => {
  // THE LIVE BUG THIS EXISTS FOR, found by `build smoke` and a screenshot.
  // The nothing-to-buy branch returned `pages` untouched, so the raw
  // `@@IMG:...@@` text shipped into the bundle, SafeImage saw a TRUTHY src, and
  // the published home page rendered a broken-image icon with its alt showing.
  //
  // It bit on the commonest path there is: a new account is granted 20 credits
  // and a build costs about 21, so nothing is affordable and that branch is what
  // EVERY first build takes. The graceful-degradation path the whole feature is
  // built around was the one that degraded to a broken page.
  //
  // Nothing in the unit suite could see it — `applyImages` is tested directly
  // and is correct; the bug was in not calling it — and worker.js cannot be
  // imported. So it is a source read, and it counts the EXITS rather than
  // looking for the call, because "applyImages appears somewhere in the
  // function" was true the whole time it was broken.
  const fn = worker.slice(worker.indexOf("async function buySitePhotos"), worker.indexOf("// Resolve @@SPRITE"));
  assert.ok(fn.length > 400, "found the function, not an empty window");
  const exits = [...fn.matchAll(/return\s+(?:\{|done\()/g)];
  assert.ok(exits.length >= 2, "expected the early exit and the final one — found " + exits.length);
  for (const m of exits) {
    assert.match(m[0], /return done\(/,
      "an exit that does not go through `done` skips applyImages and ships raw tokens");
  }
  assert.match(fn, /const done = \([\s\S]{0,80}applyImages\(pages, urls\)/,
    "and `done` is what sweeps");
});

/* ------------------------------------------------- client -> route reachability */

test("every /api path the client calls is answered by a route in worker.js", () => {
  // THE CHECK THAT WOULD HAVE CAUGHT THREE SEPARATE LIVE BUGS AT ONCE.
  //
  // `/api/site/backend/delete` (the Delete-this-site button) and
  // `/api/site/backend/delete-all` (account deletion) were called by the client
  // and answered by nothing: both 404s were swallowed by a `catch {}`, so a
  // customer was told their site and data were permanently removed while the
  // published site, its Neon database and its claimed slug all kept running.
  // The real `DELETE /api/site/<slug>` route had zero callers.
  //
  // MATCHED AGAINST ROUTE MATCHERS, NOT AGAINST THE FILE TEXT. A plain
  // `worker.includes(path)` passes on a COMMENT explaining that a route was
  // deleted, which is the "matches its own prose" failure this repo keeps
  // hitting — and comment-blanking worker.js is not an option either: a stray
  // `/*` inside a string makes the blanker eat 46% of the file, which hides real
  // code and is the direction that costs a bug rather than a false alarm.
  //
  // STATIC PATHS ONLY. A path the client concatenates a slug onto is checked by
  // its prefix through the sub-router rule below, not as a literal.
  const client = fs.readFileSync(path.join(ROOT, "public/chat.js"), "utf8") + "\n" +
    fs.readFileSync(path.join(ROOT, "public/auth.js"), "utf8");

  const literals = new Set();
  for (const m of worker.matchAll(/url\.pathname\s*===\s*"([^"]+)"/g)) literals.add(m[1]);
  const regexes = [];
  for (const m of worker.matchAll(/(\/(?:\\.|\[[^\]]*\]|[^/\n])+\/[a-z]*)\.test\(url\.pathname\)/g)) {
    try { regexes.push(new RegExp(m[1].replace(/^\//, "").replace(/\/[a-z]*$/, ""))); } catch { /* not a pathname regex */ }
  }
  assert.ok(literals.size > 30, `only ${literals.size} literal routes found — the scan broke`);
  assert.ok(literals.has("/api/credits"), "a known route is not being seen");
  assert.ok(regexes.length >= 1, "the pathname regexes are not being read");

  const answered = (p) => {
    if (literals.has(p) || regexes.some((r) => r.test(p))) return true;
    // `/api/site/<slug>/<verb>` and `/api/db/<slug>/...` are sub-routers: the
    // slug is dynamic, so the verb suffix is what has to exist.
    const seg = p.split("/").filter(Boolean);
    if (seg[0] === "api" && seg[1] === "site" && seg.length >= 3) {
      const tail = "/" + seg.slice(2).join("/");
      if (worker.includes('"' + tail + '"') || worker.includes('endsWith("' + tail)) return true;
    }
    return p.startsWith("/api/db/") || p.startsWith("/api/m/");
  };

  const dead = [];
  // A LITERAL ENDING IN `/` IS A PREFIX BEING CONCATENATED, not a path. Without
  // this, `apiFetch('/api/site/' + slug)` reads as a call to `/api/site` and
  // buries the one call that really is dead among three that are fine.
  for (const m of client.matchAll(/(?:apiFetch|fetch)\(\s*(["'`])(\/api\/[A-Za-z0-9/_-]*)\1/g)) {
    if (m[2].endsWith("/")) continue;
    if (!answered(m[2])) dead.push(m[2] + " (public/chat.js:" + client.slice(0, m.index).split("\n").length + ")");
  }
  assert.deepEqual([...new Set(dead)], [], "the client calls routes that do not exist — these 404 at runtime");
});

test("a REVISE buys no new photographs", () => {
  // Every revise re-derived the same family budget and the model wrote fresh
  // descriptions, so nothing matched what was bought last time: a customer
  // revising a 5-photo agency site paid ~94 credits in NEW photographs on every
  // revise, for pictures they already owned, and orphaned the originals. Even a
  // typo fix bought one, because the directive actively asks for a token.
  // THE PROPERTY, DRIVEN — not the spelling of the line that implements it.
  // Pinned to `revise ? 0 : imageBudget(family)`, this failed on the change that
  // fixed a second bug in the same rule: a site whose FIRST build died before
  // the image step has no photographs, and every attempt after it is a revise,
  // so it could never get one. Both halves are asserted through the real
  // function, and the wiring is checked separately below.
  const shown = [{ path: "index.tsx", source: '<SafeImage src="/u/cafe/a.jpg" />' }];
  const none = [{ path: "index.tsx", source: "<SafeImage src={row.photo} />" }];
  assert.equal(budgetFor("marketplace", { revise: true, priorPages: shown, slug: "cafe" }), 0,
    "a revise re-derives a photo budget and re-bills for pictures the owner has");
  assert.equal(budgetFor("marketplace", { revise: true, priorPages: none, slug: "cafe" }), imageBudget("marketplace"),
    "a site that never got a photograph can never get one, however often it is rebuilt");
  assert.match(worker, /const imgBudget = budgetFor\(family, \{ revise, priorPages, slug \}\)/,
    "…and the route no longer asks that question");
  // AND THE FLAG HAS TO ARRIVE. The budget line above is correct and inert if
  // nothing ever passes `revise` — four of five layers working is this repo's
  // signature failure, so the parameter and the call site are asserted apart.
  assert.match(worker, /async function buildAndPublishPages\(env, \{[^}]*\brevise\b[^}]*\}\)/,
    "buildAndPublishPages does not take the flag");
  assert.match(worker, /revise: existing,/,
    "nothing tells it this is a revise — `existing` is the free signal, off the ownership check");
  // AND THE SIGNAL IS OWNERSHIP, NOT THE STORED BRIEF. This was `!!priorBrief`,
  // which gives the same answer for every site built since the brief started
  // being recorded and the WRONG one for anything older: such a revise read as a
  // first build and would have re-bought every photograph on it at ~19 credits
  // each. The row is read once, for the ownership check, so this costs nothing.
  assert.match(worker, /existing = !!\(owner && owner\.uid\);/,
    "`existing` is not set from the ownership row — the flag arrives as undefined, " +
    "so every revise reads as a first build and buys photographs again");
});

test("a revise keeps the site's stored look instead of re-rolling it", () => {
  // A revise sends only the instruction, so the designer named a theme, a family
  // and a font pair from a few words — "fix a typo" could re-family a
  // booking-first barber shop and re-font the whole site. The fallback chain's
  // comment claimed `body.theme`/`body.family`/`body.fonts` anchored the look;
  // the client has never sent any of them, so that anchor did not exist.
  //
  // The chain is asserted link by link, because this feature is one missing link
  // from being decorative: read it back, prefer it, write it on a first build,
  // and only look it up on a revise.
  // Matched on the KEY rather than on the whole statement: the read was widened
  // to fetch `site_tokens` in the same round trip, and a guard anchored on the
  // exact SQL went red on a change that kept every property it was written to
  // protect. Anchoring on the literal a query cannot work without is the
  // durable form.
  assert.match(worker, /FROM _meta WHERE k[^\n]*'site_look'/, "nothing reads the stored look");
  assert.match(worker, /INSERT INTO _meta \(k,v\) VALUES \('site_look'/, "nothing ever writes it");
  assert.match(worker, /if \(priorBrief\) \{[\s\S]{0,400}site_look/,
    "the look is read on a FIRST build too, which would pin an empty one");
  // WRITTEN ON EVERY BUILD NOW, and this assertion is the inverse of what it
  // was. `if (!priorLook)` was correct while the look could never change after a
  // first build — anchoring made the stored value permanent, so re-writing it
  // was a no-op. An edit can move any of these now (owner's rule 2026-08-10),
  // and writing only on the first build would apply the change once and forget
  // it, so the NEXT edit would resurrect the old look. Safe because the value
  // written is the merged one, which is stored-unless-named.
  assert.ok(!/if \(!priorLook\) \{/.test(worker),
    "the look is written only on a first build again, so an edit to it is forgotten by the next edit");
  assert.match(worker, /INSERT INTO _meta \(k,v\) VALUES \('site_look'[\s\S]{0,120}JSON\.stringify\(look\)/,
    "the merged look is not what gets stored");

  // AND THE GUARANTEE ITSELF, driven rather than spelled. "A revise keeps the
  // stored look" is now "stored unless the change named it" — the same
  // protection, expressed so that asking CAN change it.
  const stored = { theme: "broadsheet", family: "salon", structure: "sidebar", brand: "Sharp Fade", description: "A barber shop." };
  // An instructed designer that named nothing changes nothing. This is the case
  // that used to re-roll the look, and it is the ordinary edit.
  const quiet = mergeLook(stored, { tokens: { background: "#ffff00" } }, null, { instructed: true });
  for (const k of ["theme", "family", "structure", "brand", "description"]) {
    assert.equal(quiet[k], stored[k], `a colour-only edit moved ${k}`);
  }
  assert.deepEqual(movedFields(stored, quiet), [], "a colour-only edit reports having moved something");
  // …and naming one moves exactly that one.
  const rethemed = mergeLook(stored, { theme: "zine" }, null, { instructed: true });
  assert.equal(rethemed.theme, "zine", "an edit that asks for a new theme cannot get one");
  assert.equal(rethemed.family, "salon", "re-theming also changed the family");
  assert.deepEqual(movedFields(stored, rethemed), ["theme"]);
  // WITHOUT the instruction the OLD precedence holds, which is the interlock:
  // an unread state must never let an untold designer re-roll a live site.
  assert.equal(mergeLook(stored, { theme: "zine" }, null).theme, "broadsheet",
    "an uninstructed designer re-themes the site again");
  for (const k of ["theme", "family", "structure", "fonts"]) {
    assert.ok(new RegExp(k + ": look\\." + k + ",").test(worker), k + " does not reach the build from `look`");
  }
});

test("a prototype key is not a theme", () => {
  // `ALL_THEMES["__proto__"]` is the object prototype — truthy, so it walked past
  // the `|| null` and came back as `{}`: neither a real theme nor the null every
  // caller fails soft on. Same bug that shipped once in the Stripe plan lookup.
  for (const k of ["__proto__", "constructor", "toString", "valueOf", "hasOwnProperty"]) {
    assert.equal(resolveTheme(k), null, k + " resolves to something");
  }
  assert.ok(resolveTheme(THEME_SHORTLIST[0]), "a real theme still resolves");
});

test("the third-party api tier is reachable by a generated page", () => {
  // `useApi` was the ONE hook in @/lib/rows that no rule and no digest ever
  // mentioned — so a site could declare an api, the platform would serve it, and
  // no generated page could ever call it. The whole tier reachable by nothing,
  // which is this repo's signature failure. Asserted as a chain: the hook exists,
  // the digest names what was declared, and the lint catches a name that was not.
  const rows = fs.readFileSync(path.join(ROOT, "builder/lovable/template/src/lib/rows.ts"), "utf8");
  assert.match(rows, /export function useApi\b/, "the hook is gone");
  const spec = { tables: [{ name: "m", access: "display", columns: ["a"] }], apis: [{ name: "rates", params: ["base"] }] };
  const digest = schemaDigest(spec);
  assert.match(digest, /useApi\(name, \{ params \}\)/, "the digest never names the hook");
  assert.match(digest, /rates\(base\)/, "a declared api is not described to the model");
  assert.deepEqual(lintPages([{ path: "index.tsx", source: 'useApi("rates", {})' }], spec), [],
    "a declared api is refused");
  assert.equal(lintPages([{ path: "index.tsx", source: 'useApi("weather", {})' }], spec).length, 1,
    "an undeclared api compiles, publishes and 404s — the lint has to catch it");
  // And a site that declares none says nothing at all, rather than an empty header.
  assert.ok(!/OUTSIDE DATA/.test(schemaDigest({ tables: spec.tables })), "an empty section is still tokens");
});

test("the client accepts a build that answered, flaws and all", () => {
  // `!d.error` refused every placeholder build that carried a reason — which is
  // all of them: the route returns `error` beside `ok:true` on validate, home,
  // typecheck, build and generate. The most common real failure took the ERROR
  // branch, which claims "you weren't charged" over charged stages and never
  // records the slug that WAS provisioned, so the project lost its own database
  // and the next message ran as a fresh first build against a claimed slug.
  //
  // `error: true` is the client's OWN stream sentinel; the server sends a string.
  assert.match(clientJs, /if \(r\.ok && d && d\.error !== true && d\.slug\) \{/,
    "a placeholder build with a reason is refused again");
  assert.ok(!/if \(r\.ok && d && !d\.error && d\.slug\)/.test(clientJs), "the truthiness check is back");
});

test("account deletion stops when the site sweep did not finish", () => {
  // Not best-effort: `site_backends.uid` cascades with `auth.users`, so deleting
  // the account over a half-finished sweep leaves sites serving publicly with
  // nothing left that can authorise removing them. There is no second chance.
  const i = clientJs.indexOf("/api/site/delete-all");
  assert.ok(i > 0, "account deletion no longer sweeps the sites");
  const block = clientJs.slice(i, i + 1200);
  assert.match(block, /if \(!dr\.ok \|\| !dj \|\| dj\.ok !== true\) \{/, "a partial sweep no longer stops the deletion");
  assert.match(block, /return;/, "it must not fall through to deleting the account");
  assert.match(block, /was NOT deleted/, "and the customer has to be told why");
});

// ── ONE BUILD MUST NOT LEAVE ANYTHING FOR THE NEXT ONE ──────────────────────
//
// `getContainer(env.SITE_BUILD_CONTAINER)` is called with no id, so EVERY build
// on the platform lands in ONE long-lived container. That is why `resetRoutes`
// exists, and why it wipes `src/routes`, the generated route tree and `dist`
// before a build writes anything: two sites sharing a working directory is how
// one customer's pages once got published to another customer's slug.
//
// `dist-ssr` is the newest member of that set — the server bundle the prerender
// imports. Left behind by a failed SSR build it is one site's pages waiting to
// be rendered into another site's snapshots, and the import is cache-busted per
// build precisely because the module system would otherwise hand back the first
// one forever.
//
// Asserted by NAME rather than derived, because "which constants are build
// outputs" is a judgement no scan makes reliably — and a wrong derivation here
// passes vacuously, which is the failure this file is full of.
test("every build output is wiped before the next build starts", () => {
  const src = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");
  const at = src.indexOf("function resetRoutes()");
  assert.ok(at > 0, "resetRoutes moved — rescope this");
  const body = src.slice(at, src.indexOf("\n}", at));

  for (const [what, re] of [
    ["the generated route tree", /rmSync\(GEN,/],
    ["the client dist", /rmSync\(DIST,/],
    ["the server bundle (dist-ssr)", /rmSync\(path\.join\(APP, SSR_DIR\)/],
  ]) {
    assert.match(body, re, `resetRoutes no longer clears ${what} — the previous build's output survives into this one`);
  }

  // AND THE ONE THING THAT REALLY STOPS THE FIRST SITE BECOMING EVERY LATER
  // SITE'S SNAPSHOT: the bundle is loaded in a process that did not exist a
  // moment ago. This used to assert a cache-buster on an in-process `import()`
  // in THIS file, which was the correct guard while the render ran here — it now
  // runs in `prerender-child.mjs`, whose module registry starts empty, so a
  // fresh process is the mechanism and the buster is belt-and-braces beside it.
  //
  // Asserted at both ends, because either alone passes while the other is
  // broken: the parent must spawn a child per build, and the child must be the
  // only thing that loads the bundle.
  assert.match(src, /run\(process\.execPath, \[PRERENDER_CHILD,/,
    "the prerender no longer runs as its own process — model-written code is back in the build server's event loop");
  assert.ok(!/import\([^)]*entry-server\.js/.test(src),
    "build-server.mjs imports the SSR bundle itself again — that is the in-process execution the child exists to end");

  const child = fs.readFileSync(new URL("../builder/prerender-child.mjs", import.meta.url), "utf8");
  assert.match(child, /"\?v=" \+ Date\.now\(\)/,
    "the child's import lost its cache buster — harmless today, and the guard against this ever moving back in-process");
});

// ── THE PLATFORM MUST SAY WHY A BUILD FAILED ────────────────────────────────
//
// It diagnosed this completely and threw the diagnosis away at the last layer.
// `stage`, `error` and `cited` (the exact source lines the compiler pointed at)
// came back on every failed build; `problems` (the lint's findings) and
// `functionErrors` (model-written SQL that failed to create) came back even on a
// SUCCESSFUL one — and the client rendered none of the five. The owner saw "the
// pages didn't compile" and had to open devtools to learn anything more.
// Measured 2026-08-09 on a real ~20-credit build: fifteen minutes hunting for an
// answer the response already carried.
//
// THE CHAIN IS ASSERTED LINK BY LINK, because "computed, returned, rendered by
// nothing" is the exact shape being fixed and it is this repo's signature
// failure. Four of five links working is what every previous instance looked
// like.
test("a failed build's own diagnosis reaches the screen", () => {
  const client = fs.readFileSync(path.join(ROOT, "public/chat.js"), "utf8");
  const css = fs.readFileSync(path.join(ROOT, "public/styles.css"), "utf8");

  // 1. the server still sends all five
  for (const field of ["stage", "error", "cited", "problems", "functionErrors"]) {
    assert.ok(new RegExp(`\\b${field}:`).test(worker),
      `the build response stopped carrying ${field} — there is nothing left to render`);
  }

  // 2. the client reads each of them
  const i = client.indexOf("function buildWhy(");
  assert.ok(i > 0, "buildWhy is gone — the diagnosis is discarded again");
  const body = client.slice(i, client.indexOf("\n}", client.indexOf("return out.join", i)));
  // ANCHORED ON THE CONDITION, not on the name appearing. A mutation to
  // `if (false && Array.isArray(d.problems))` leaves `d.problems` right there in
  // the source and survived a first sweep — the same trap this repo records
  // against message strings, one field over.
  for (const field of ["cited", "problems", "functionErrors"]) {
    assert.ok(new RegExp(`if \\(Array\\.isArray\\(d\\.${field}\\)\\)`).test(body)
      || new RegExp(`if \\(Array\\.isArray\\(d\\.${field}\\)\\s*&&`).test(body),
      `buildWhy no longer guards on d.${field} being an array — it is either ignored or unguarded`);
  }
  for (const field of ["stage", "error"]) {
    assert.ok(new RegExp(`typeof d\\.${field} === 'string'`).test(body), `buildWhy ignores ${field}`);
  }
  // The lint's findings and a failed function are NOT gated on the placeholder:
  // a site can publish while carrying either, and those are the failures nobody
  // would otherwise notice, because the site looks fine until a visitor hits the
  // broken part.
  // Extracted by brace matching rather than by regex: `problems` and
  // `functionErrors` must sit OUTSIDE the placeholder branch, because a site can
  // publish while carrying either — a page the lint refused, or a confirmation
  // function that never got created — and those are the failures nobody would
  // otherwise notice, since the site looks fine until a visitor hits the broken
  // part.
  const ph = body.indexOf("if (d.page === 'placeholder') {");
  assert.ok(ph > 0, "the placeholder branch is gone");
  let depth = 0, close = ph;
  for (let k = ph; k < body.length; k++) {
    if (body[k] === "{") depth++;
    else if (body[k] === "}" && --depth === 0) { close = k; break; }
  }
  const inside = body.slice(ph, close);
  for (const field of ["problems", "functionErrors"]) {
    assert.ok(!inside.includes("d." + field),
      `${field} is trapped inside the placeholder branch — a site that PUBLISHED never reports it`);
  }

  // 3. IT IS CALLED. A helper that is defined and never invoked is the same bug
  //    wearing a fix — asserted apart from its definition, the Bookmarks lesson.
  assert.match(client, /siteFinishBuild\(origin, \(built \? '✅ ' : '⚠️ '\)[^;]*, build, note, buildWhy\(d\)\)/,
    "buildWhy is defined and never called on the build path");

  // 4. IT IS STORED, so it survives a reload — the thread is rebuilt from
  //    localStorage, and a diagnosis that vanishes on refresh is half a fix.
  assert.match(client, /s\.msgs\.push\(\{ r: 'a', t: reply, note: note \|\| undefined, why: why \|\| undefined/,
    "the diagnosis is not stored on the message");

  // 5. IT IS RENDERED.
  assert.match(client, /m\.why \? '<div class="st-why">' \+ esc\(m\.why\) \+ '<\/div>' : ''/,
    "nothing paints the diagnosis");

  // 6. AND IT IS READABLE. This carries file:line references and real source
  //    lines; without preserved newlines four errors become one unreadable
  //    sentence. `.st-note` had exactly that bug — it was split out of `.st-msg`
  //    to fix collapsing newlines and then never given a white-space of its own,
  //    so the notes it joins with "\n" ran together anyway.
  assert.match(css, /\.st-why \{[^}]*white-space: pre-wrap/, ".st-why collapses its newlines");
  assert.match(css, /\.st-why \{[^}]*monospace/, ".st-why is not monospace — source lines lose their shape");
  assert.match(css, /\.st-note \{[^}]*white-space: pre-line/, ".st-note runs its separate notes together again");
});

// ── A PUBLISH MUST NOT DAMAGE A SITE THAT ALREADY WORKS ─────────────────────

test("the Worker tells publishPages which pages the site is already serving", () => {
  // `salvagePlan` can be perfectly right about "never stub a page that works"
  // while nothing hands it the fact — the wiring layer, for the thirteenth
  // recorded time. Both ends: the value is DERIVED from the prior source, and
  // it is PASSED.
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(src, /const livePages = \(Array\.isArray\(priorPages\) \? priorPages : \[\]\)/,
    "livePages is no longer derived from the site's stored source");
  assert.match(src, /\{ spec, slug, priorUsage, livePages \}/,
    "livePages is computed and never handed to publishPages");
  // It must be the PATHS. Handing over the page objects would make
  // `published.has(bare)` false for every one of them, which reads exactly like
  // a first build and silently switches the protection off.
  const at = src.indexOf("const livePages =");
  assert.match(src.slice(at, at + 220), /\.map\(\(p\) => p && p\.path\)/,
    "livePages carries page objects rather than paths — every lookup would miss");
});

test("EVERY prerendered document is written after the assets it names", () => {
  // This sorted `index.html` alone, which was the whole truth exactly while a
  // site was one HTML file plus a bundle. Each route is prerendered to its own
  // document now — stable names, written in readdir order — so `book.html` PUT
  // before the hashed chunks it references is a blank page at a public URL for
  // the seconds of a republish.
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = src.indexOf("const entries = Object.entries(dist || {})");
  assert.ok(at > 0, "the publish ordering moved — rescope this");
  const sortExpr = src.slice(at, src.indexOf(";", at));
  assert.ok(!/\^index\\\.html\$/.test(sortExpr),
    "only index.html is ordered last again — every other prerendered page can point at unwritten assets");

  // DRIVEN, not only read: a sort that matches the right pattern and compares
  // the wrong way round reads identically.
  // eslint-disable-next-line no-new-func
  const cmp = new Function("return (" + /\.sort\((\(a, b\) => [^;]+)\)/.exec(sortExpr)[1] + ")")();
  const order = ["index.html", "assets/app-abc.js", "book.html", "assets/x.css", "work.html"]
    .map((n) => [n, {}]).sort(cmp).map(([n]) => n);
  const firstHtml = order.findIndex((n) => /\.html$/.test(n));
  const lastAsset = order.map((n) => /\.html$/.test(n)).lastIndexOf(false);
  assert.ok(firstHtml > lastAsset,
    "a document is written before an asset: " + JSON.stringify(order));
});

test("a restore orders its documents the same way", () => {
  // Same one-file sort, same failure: a version's `book.html` copied in before
  // the assets it names is a blank page for the length of the rollback.
  const src = fs.readFileSync(new URL("../site-versions.mjs", import.meta.url), "utf8");
  const at = src.indexOf("const ordered = names.slice().sort(");
  assert.ok(at > 0, "the rollback ordering moved — rescope this");
  assert.ok(!/\^index\\\.html\$/.test(src.slice(at, src.indexOf(";", at))),
    "rollbackVersion orders only index.html last again");
});

test("why salvage could not rescue a build reaches the caller", () => {
  // `salvagePlan` has always computed this and the module has always returned
  // it, and NOTHING forwarded it — while a comment in that file claimed the eval
  // read `foreign`, and the eval never calls publishPages at all. So the signal
  // designed to catch "we shipped a broken kit component" died in the return.
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(src, /salvage: \(pages\.salvage && pages\.salvage\.reason\) \? pages\.salvage : undefined,/,
    "the salvage plan is computed and dropped at the route");
  // And the comment that was false is gone: a claim about a consumer that does
  // not exist is what gets believed next time somebody edits the line.
  const pub = fs.readFileSync(new URL("../builder/publish-pages.mjs", import.meta.url), "utf8");
  assert.ok(!/because the eval reads\s*\n?\s*\*?\s*it/.test(pub),
    "the false claim that the eval reads `foreign` is back");
});

test("a look that failed SOFT reaches the caller instead of publishing silently", () => {
  // `writeTheme` and `writeFonts` never fail a build — a site whose data layer
  // is live must not be lost over a typeface — so they answer `applied:false`
  // with a sentence instead. Both were reported by the container on every build
  // and forwarded by NOTHING, so the failure they exist to describe was
  // invisible at every layer above.
  //
  // Latent today and the class is not: a stored `site_look.theme` naming a theme
  // later REMOVED from the registry — a deletion this repo performs regularly —
  // would make every subsequent publish of that site ship the default look while
  // reporting success, for ever.
  const container = fs.readFileSync(path.join(ROOT, "builder/build-server.mjs"), "utf8");
  assert.match(container, /applied: false/, "the container no longer reports a soft failure at all");
  assert.match(container, /theme: themeUsed, /, "the container stopped carrying its theme result");

  const pub = fs.readFileSync(path.join(ROOT, "builder/publish-pages.mjs"), "utf8");
  assert.match(pub, /\[\["theme", bd && bd\.theme\], \["fonts", bd && bd\.fonts\]\]/,
    "publish-pages drops the container's applied-flags");
  assert.match(pub, /r\.applied !== false/,
    "a soft failure is judged by something other than the container's own flag");
  assert.match(pub, /if \(soft\.length\) out\.lookSoft = soft;/,
    "the soft-failure list is computed and dropped");

  // BOTH PUBLISH PATHS. Every cheap edit republishes through
  // `recompileAndPublish`, so a build-path-only fix leaves a text fix, a colour
  // change and a picture swap all shipping the default look in silence.
  assert.match(worker, /lookSoft: pages\.lookSoft \|\| undefined,/, "the build route drops it");
  assert.match(worker, /lookSoft: lookSoft\.length \? lookSoft : undefined \}/,
    "recompileAndPublish drops it, so every cheap edit is silent about it");

  // CARRIED ONLY WHEN SOMETHING WENT WRONG, at both layers: a build where the
  // theme and the fonts both applied must be byte-identical on the wire, so the
  // field's PRESENCE is the signal rather than its contents.
  assert.ok(!/lookSoft: soft,/.test(pub) && !/lookSoft: lookSoft,/.test(worker),
    "the soft-failure list is now on every response — a field nobody reads is not a warning");
});

test("a refused guarantee and a refused table name both reach the caller", () => {
  // Both were computed by nothing and both are the same class: a silent
  // subtraction from the customer's site. `refusedFields` did not exist, and a
  // bad table name did not survive normalisation at all — it 502'd the whole
  // build at `sqlIdent`.
  assert.match(worker, /import \{[^}]*refusedFields[^}]*\} from "\.\/site-schema\.mjs"/,
    "the route cannot see the refused-guarantee reader");
  assert.match(worker, /const refused = refusedFields\(body\.schema \|\| designed \|\| \{\}\)/,
    "the route never asks which declared guarantee was refused");
  assert.match(worker, /refused: refused\.length \? refused : undefined,/,
    "the refused list is computed and dropped");
  assert.match(worker, /const badNames = Array\.isArray\(spec && spec\.refusedTables\)/,
    "the route never reads which table name the engine refused");
  assert.match(worker, /refusedTables: badNames\.length \? badNames : undefined,/,
    "the refused table names are read and dropped");

  // PRESENT ONLY WHEN THERE IS SOMETHING TO SAY, at both, so an ordinary
  // build's response is byte-identical to what it was.
  assert.ok(!/refused: refused,/.test(worker) && !/refusedTables: badNames,/.test(worker),
    "a field carried on every build is not a warning");

  // AND THE SAME SOURCE AS `reached`, which is the raw answer before the
  // allow-list — after it there is nothing left to read.
  const at = worker.indexOf("const reached = droppedFields(");
  const to = worker.indexOf("const badNames =", at);
  assert.ok(at > 0 && to > at, "the reach/refuse block moved — rescope this");
  assert.match(worker.slice(at, to), /refusedFields\(body\.schema \|\| designed \|\| \{\}\)/,
    "the two readers disagree about which spec they are judging");
});
