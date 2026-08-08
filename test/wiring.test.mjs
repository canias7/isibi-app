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
import { themeCss, THEMES } from "../builder/site-theme.mjs";
import { briefWithLayout } from "../builder/page-gen.mjs";
import { FAMILY_NAMES, READY_FAMILIES, STRUCTURE_NAMES, STRUCTURES, layoutDirective, familiesForPrompt, structuresForPrompt, FAMILIES } from "../builder/site-layouts.mjs";
import { UI_COMPONENTS, UI_SHORTLIST, PAGE_RULES } from "../builder/page-gen.mjs";

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
  assert.match(worker, /theme: \(designed && designed\.theme\) \|\| \(body && body\.theme\)/,
    "the body fallback is gone, so off-list themes really are unreachable");
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
  assert.match(worker, /structure: \(designed && designed\.structure\) \|\| \(body && body\.structure\)/);
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
  assert.match(worker, /const imgBudget = revise \? 0 : imageBudget\(family\)/,
    "the budget is derived from the family, once (and a revise buys none)");
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
  assert.match(clientJs, /siteFinishBuild\(origin, .*, build, note\)/,
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
  assert.match(worker, /const imgBudget = revise \? 0 : imageBudget\(family\)/,
    "a revise re-derives a photo budget and re-bills for pictures the owner has");
  // AND THE FLAG HAS TO ARRIVE. The budget line above is correct and inert if
  // nothing ever passes `revise` — four of five layers working is this repo's
  // signature failure, so the parameter and the call site are asserted apart.
  assert.match(worker, /async function buildAndPublishPages\(env, \{[^}]*\brevise\b[^}]*\}\)/,
    "buildAndPublishPages does not take the flag");
  assert.match(worker, /revise: !!priorBrief,/,
    "nothing tells it this is a revise — `priorBrief` is the free signal, off the ownership check");
});
