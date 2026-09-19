// THE ADD STEP IS ITS OWN PATH — asserted, and driven.
//
// Owner, 2026-09-02: "lets start building the addon part". The addon route
// called the BUILD's designer (`designSiteSchema`, the 96,130-character tool)
// anchored on the stored look to add one page or one code, and read four
// fields off the answer. `builder/site-add.mjs` is the split the edit path got
// on 2026-08-29: its own picker, one small tool per kind of thing a site can
// lack, its own wording, nothing from worker.js.
//
// WHAT IS ASSERTED HERE, in two opposite halves, as `edit-lanes.test.mjs`
// does for the edit path:
//   * the step borrows NOTHING from the build's tool or wording, and
//   * the shapes it must share (a table, a hand-written part) are the build's
//     own objects, by identity — one shape, two framings, never two copies.
// And the wiring: the route runs this step where it ran the designer, the
// fields the edit path refuses to create all have a kind here, and the
// browser hops sideways when the step names a cheaper rung.
//
// DRIVEN, NOT READ, wherever the module can be called: the picker and the
// add runner take a fake `send`, the cleaner and the fold take real answers.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { readSchemaTool } from "./integration/schema-tool.mjs";
import { EDIT_LAYERS } from "../builder/site-ask.mjs";
import { TABLE_ITEM, FUNCTION_ITEM, API_ITEM, JOB_ITEM } from "../builder/site-table.mjs";
import { TSX_ITEM, MAX_TSX, MAX_COMPONENTS, TOOL_DIRECTIVE } from "../builder/site-plan.mjs";
import { MAX_PAGES } from "../builder/page-gen.mjs";
import { routeOf } from "../builder/site-addon.mjs";
import { modelsFor } from "../builder/build-models.mjs";
import { MAX_QRS } from "../builder/site-qr-list.mjs";
import { IMAGE_CAP, MAX_PROMPT_CHARS } from "../builder/site-images.mjs";
import { MIN_EVERY_MINUTES, MAX_EVERY_MINUTES, AT_RE as JOBS_AT_RE, ON_RE as JOBS_ON_RE } from "../site-jobs.mjs";
import { REQUIREMENT_ITEM } from "../builder/site-requirements.mjs";
import {
  ADD_KINDS, OWN_ADDS, DISPATCHED_ADDS, PLACING_ADDS, MAKES_PAGES, addLayerIn, LIST_ADDS, MAX_ADDS, MAX_ADD_PAGES, MAX_ADD_COMPONENTS, MAX_ADD_TABLES, MAX_SECTIONS, MAX_ADD_SEED_ROWS, MAX_MESSAGE, ADD_MODEL, ADD_DESIGN_RULE,
  BACKEND_ADDS, BACKEND_KEYS, MAX_ADD_FUNCTIONS, MAX_ADD_APIS, MAX_ADD_JOBS, MIN_JOB_MINUTES, MAX_JOB_MINUTES, AT_RE, ON_RE, onceDay, backendDesigned, pageless, jobEvery,
  addLayer, pickTool, pickRequest, readAdds, pickAdds, addUsage,
  addTool, addRule, composeRule, RULE_PARTS, addRequest, siteNote, readAddAnswer, runAdd,
  cleanAdd, fileOfRoute, addDirective, foldAdds, addRefusal, alreadyReply, pageLabels,
  REQUIREMENT_ADDS, tableFacts, deadQrs, deadQrNote,
} from "../builder/site-add.mjs";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const SRC = read("../builder/site-add.mjs");

/** Length-preserving comment blanking, string-aware — worker.js has `//` inside strings. */
function blankComments(src) {
  let out = ""; let i = 0; let inBlock = false; let quote = "";
  while (i < src.length) {
    const c = src[i]; const nx = src[i + 1];
    if (inBlock) { if (c === "*" && nx === "/") { out += "  "; i += 2; inBlock = false; continue; } out += c === "\n" ? "\n" : " "; i++; continue; }
    if (quote) { out += c; if (c === "\\") { out += nx === undefined ? "" : nx; i += 2; continue; } if (c === quote) quote = ""; i++; continue; }
    if (c === '"' || c === "'" || c === "`") { quote = c; out += c; i++; continue; }
    if (c === "/" && nx === "*") { out += "  "; i += 2; inBlock = true; continue; }
    if (c === "/" && nx === "/") { while (i < src.length && src[i] !== "\n") { out += " "; i++; } continue; }
    out += c; i++;
  }
  return out;
}
const at = (src, needle, what) => { const i = src.indexOf(needle); assert.ok(i >= 0, `${what}: landmark "${needle}" is gone`); return i; };

const SITE = { name: "Sheffield Beginner Guitar", kind: "shopfront", pages: ["/"], tables: [], hasDatabase: false, qr: null, three: null, tsx: [] };
const MULTI = { ...SITE, pages: ["/", "/about"] };
const DB = { ...SITE, hasDatabase: true, tables: ["bookings"] };

/** A reply the way the API answers a forced tool call. */
const toolReply = (name, input, extra = {}) => ({
  content: [{ type: "tool_use", name, input }],
  usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 100, cache_creation_input_tokens: 0 },
  ...extra,
});

// ── THE PARTITION ────────────────────────────────────────────────────────────

test("the kinds are two disjoint groups that cover the list, and a dispatched kind names a real edit layer", () => {
  assert.ok(ADD_KINDS.length >= 6, `only ${ADD_KINDS.length} kinds — the table has shrunk`);
  // ── THREE GROUPS SINCE 2026-09-17, STILL TOTAL AND STILL DISJOINT ────────
  //
  // RE-ANCHORED, NOT APPEASED. The property was never "there are two groups";
  // it is that every kind is answered in exactly one place, so none can be
  // designed-and-dispatched or neither. `PLACING_ADDS` is the third: a kind
  // that names a layer AND carries a tool, because where its work happens
  // depends on the company it keeps — a photograph alone is the picture rung's
  // and one beside a page is this step's, since this step is what makes the
  // slot. Adding it to `DISPATCHED_ADDS` would have been the appeasement, and
  // it would have asserted the old defect as correct.
  assert.deepEqual([...OWN_ADDS, ...PLACING_ADDS, ...DISPATCHED_ADDS].sort(), [...ADD_KINDS].sort(), "a kind is in no group or in more than one");
  for (const k of OWN_ADDS) { assert.ok(!DISPATCHED_ADDS.includes(k) && !PLACING_ADDS.includes(k)); assert.equal(addLayer(k), null, `${k} acts here and dispatches`); }
  for (const k of DISPATCHED_ADDS) {
    assert.ok(!PLACING_ADDS.includes(k), `${k} is in both dispatched groups`);
    const layer = addLayer(k);
    assert.ok(EDIT_LAYERS.includes(layer), `${k} dispatches to "${layer}", which is not an edit layer the route has`);
  }
  // ── AND THE PLACING GROUP IS PROVED ALIVE IN BOTH DIRECTIONS ─────────────
  //
  // `DISPATCHED_ADDS` IS EMPTY TODAY, so the loop above asserts nothing at all
  // — a negative assertion with a dead observer, which this repository has
  // recorded against it. That is exactly why this block exists: the layer
  // vocabulary and the tool check have to be driven somewhere, and the kinds
  // that carry both are here.
  assert.ok(PLACING_ADDS.length >= 1, "no kind designs-here-or-dispatches — this block scans nothing");
  for (const k of PLACING_ADDS) {
    const layer = addLayer(k);
    assert.ok(EDIT_LAYERS.includes(layer), `${k} dispatches to "${layer}", which is not an edit layer the route has`);
    assert.doesNotThrow(() => addTool(k), `${k} names a layer and has no tool to be designed in`);
    // THE TWO ANSWERS, AND WHICH COMPANY DECIDES THEM. Alone it is the layer;
    // beside a kind that writes page source it is ours. `MAKES_PAGES` is the
    // list, and a kind that is NOT on it leaves the dispatch alone — a table
    // reaching the page call is no reason to place a photograph.
    assert.equal(addLayerIn(k, [k]), layer, `${k} alone must still go to its own rung`);
    for (const m of MAKES_PAGES) assert.equal(addLayerIn(k, [m, k]), null, `${k} beside ${m} must be designed here`);
    for (const m of ADD_KINDS.filter((x) => x !== k && !MAKES_PAGES.includes(x))) {
      assert.equal(addLayerIn(k, [m, k]), layer, `${k} beside ${m} must still dispatch — ${m} writes no page source`);
    }
    // FAIL-CLOSED ON A MALFORMED LIST: nothing that is not an array of strings
    // carries a page-writing kind, so the answer is the dispatch, which is what
    // the platform did before this group existed.
    for (const junk of [null, undefined, "page", 3, {}, [null], [["page"]]]) {
      assert.equal(addLayerIn(k, junk), layer, `${k} with a malformed kind list must dispatch`);
    }
  }
  // AND AN OWN KIND IS UNTOUCHED BY THE COMPANY IT KEEPS: it names no layer, so
  // there is nothing for the company to change and the answer is this module in
  // every case. (The control that stops "beside a page it is null" being
  // satisfied by a reader answering null for everything is above — a placing
  // kind ALONE, and beside every kind that writes no page source, answers its
  // layer.)
  for (const k of OWN_ADDS) for (const m of MAKES_PAGES) assert.equal(addLayerIn(k, [m, k]), null);
  // ⚠ AND THE GROUP ITSELF IS A WALL, DRIVEN IN A TWO-KIND WORLD (2026-09-17).
  // `DISPATCHED_ADDS` is empty on the real platform, so the membership test in
  // `addLayerIn` cannot change an answer here — MEASURED: 81 probes over every
  // kind and nine company shapes, zero differences with it and without it. A
  // wall nobody can drive is a wall nobody is guarding, so the group is a
  // PARAMETER (`cleanTools(v, catalog)`'s own reason) and the rule is driven
  // against a world where a kind dispatches and is NOT placed here: it keeps
  // its layer whatever company it keeps, because it has no tool to answer with.
  for (const k of PLACING_ADDS) {
    const layer = addLayer(k);
    assert.equal(addLayerIn(k, ["page", k], []), layer,
      `${k} was designed here although nothing says it can be — a kind with no tool of its own would be asked for an answer and dropped`);
    assert.equal(addLayerIn(k, ["page", k], [k]), null,
      `${k} is in the placing group and was dispatched anyway — the observer is dead and the line above proves nothing`);
  }
  // The intent router promises these by name; a section, a form and a map
  // are components (owner, 2026-09-02: "section is just adding a new
  // component, so its a tsx step that adds components").
  for (const k of ["page", "table", "component", "qr", "three", "photo"]) assert.ok(ADD_KINDS.includes(k), "no kind for " + k);
  assert.ok(!ADD_KINDS.includes("section"), "a section is a component, not a kind of its own");
  // `Object.hasOwn`, never truthiness — the Stripe plan lookup's bug.
  assert.equal(addLayer("constructor"), null);
  assert.equal(addLayer(["photo"]), null);
});

test("the photograph kind designs a shot list the picture pipeline can take, and refuses what it cannot", () => {
  // ── THE `photo` TOOL ANSWERS `imageDirective`'S OWN LIST SHAPE ───────────
  //
  // `{page, describe}` is what the build path's reader already takes, so the
  // shot list crosses to the page writer through that rather than a second
  // shape beside it. Asserted against the tool the model really sees.
  const props = addTool("photo").input_schema.properties.photo;
  assert.equal(props.type, "array");
  assert.deepEqual([...props.items.required].sort(), ["describe", "page"]);
  assert.deepEqual(Object.keys(props.items.properties).sort(), ["describe", "page"]);
  // THE WORDS ARE THE PROMPT SOMEBODY PAYS FOR, and the description says so —
  // this is the one field in the whole add step whose contents are billed.
  assert.match(props.items.properties.describe.description, /PAID to draw/);

  const SITE_P = { ...SITE, planned: [{ path: "/gallery" }] };
  // A PAGE THIS SAME CHANGE IS ADDING IS A REAL DESTINATION — `going`, the one
  // list every placing kind resolves through.
  const ok = cleanAdd("photo", [{ page: "/gallery", describe: "the bench under the window" }], SITE_P);
  assert.deepEqual(ok.value, [{ page: "/gallery", describe: "the bench under the window" }]);
  // AND A PAGE NOBODY HAS IS REFUSED BY NAME, never moved to the home page:
  // the silent substitution the owner corrected on the component tier, and
  // worse here because a photograph is bought.
  assert.equal(cleanAdd("photo", [{ page: "/prices", describe: "x" }], SITE_P).why, "no-page");
  // AN UNDESCRIBED PICTURE IS REFUSED, because `planImages` deliberately never
  // sends a token with nothing inside it — so it would be a slot nothing fills
  // and a customer told a photograph was added.
  assert.equal(cleanAdd("photo", [{ page: "/gallery", describe: "   " }], SITE_P).why, "no-photo");
  assert.match(addRefusal("no-photo"), /what's in it/);
  // A LONG BRIEF IS SLICED AND NOT REFUSED, which is exactly what `imagePrompt`
  // does to it one hop later: refusing here would turn a usable description
  // into no picture at all.
  const long = cleanAdd("photo", [{ page: "/gallery", describe: "b".repeat(MAX_PROMPT_CHARS + 80) }], SITE_P);
  assert.equal(long.value[0].describe.length, MAX_PROMPT_CHARS);

  // ── THE FOLD HANDS THE ROUTE A DEDUPED LIST ──────────────────────────────
  //
  // ON THE PAIR, never on the page alone: the same picture asked for twice is
  // ONE purchase (`planImages` reuses a token's url wherever it appears), and
  // two different pictures on one page are two.
  const many = foldAdds([{ kind: "photo", value: cleanAdd("photo", [
    { page: "/gallery", describe: "the bench" },
    { page: "/gallery", describe: "the bench" },
    { page: "/gallery", describe: "a finished guitar" },
    { page: "/", describe: "the bench" },
  ], SITE_P).value }], {}, SITE_P);
  assert.deepEqual(many.photos, [
    { page: "/gallery", describe: "the bench" },
    { page: "/gallery", describe: "a finished guitar" },
    { page: "/", describe: "the bench" },
  ]);
  // AND IT IS NOT ON `designed`, which is what `mergeLook` folds into the
  // site's STORED look: a photograph is bought once and the site then carries
  // the PICTURE, not the instruction — storing it would re-buy the same set on
  // the next unrelated edit, which is the rule `budgetFor` exists for.
  assert.equal(many.designed.photos, undefined);
  assert.equal(many.designed.images, undefined);
  // NO DIRECTIVE BLOCK, DELIBERATELY: `imageDirective` already names the page
  // and hands over the exact token, and a second block saying the same thing in
  // other words is how one picture becomes two.
  assert.equal(addDirective("photo", { page: "/gallery", describe: "the bench" }, SITE_P), "");
  assert.doesNotMatch(many.directive, /the bench/, "the fold describes the picture twice");
});

test("every field the edit path refuses to create has a kind here, and the route refuses a second one by name", () => {
  const W = blankComments(read("../worker.js"));
  const decl = W.slice(at(W, "const ADD_ONLY_FIELDS = [", "list"), W.indexOf("];", at(W, "const ADD_ONLY_FIELDS = [", "list")));
  const fields = [...decl.matchAll(/"([a-z]+)"/g)].map((m) => m[1]);
  assert.ok(fields.length >= 2, "the edit path's add-only list is empty — this test scans nothing");
  for (const f of fields) assert.ok(OWN_ADDS.includes(f), `the edit path sends "${f}" to the addon and the add step cannot make one`);
  // THE MIRROR OF THE WALL, NARROWED (2026-09-03): the addon block refuses a
  // second of what a site carries ONE of — `SINGLE_FIELDS`, which is `three`
  // alone now that a site carries several QR codes — and names the door that
  // changes the first. `qr` stays on `ADD_ONLY_FIELDS` (the edit path may not
  // CREATE one) and comes off the single list (the addon may add another);
  // both facts are asserted, because either list drifting is a customer
  // bounced between the two doors.
  const b = W.slice(at(W, "if (ad) {", "addon"), at(W, "if (tx) {", "addon end"));
  const loop = b.indexOf("for (const f of SINGLE_FIELDS) {\n              if (aKinds.includes(f) && aHas[f]) {");
  assert.ok(loop > 0, "the addon does not refuse a kind the site carries one of, off the single-field list");
  assert.match(b.slice(loop, b.indexOf("}", b.indexOf("}", loop) + 1) + 1), /alreadyReply\(f\)/, "the refusal does not name the door that changes it");
  const single = W.slice(at(W, "const SINGLE_FIELDS = [", "single"), W.indexOf("];", at(W, "const SINGLE_FIELDS = [", "single")));
  const singles = [...single.matchAll(/"([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(singles, ["three"], "the fields a site carries one of");
  assert.ok(fields.includes("qr") && !singles.includes("qr"), "a QR code must be add-only for the edit path AND addable again for the addon");
  for (const f of singles) assert.ok(fields.includes(f), "a single field the edit path may create: " + f);
  // …and the addon's picker is shown the site's codes as the LIST, so the
  // designer names a new one against every name and destination it has.
  assert.match(b, /qr: qrList\(aLook\.qr\),/, "the addon's site note is not handed the stored codes as a list");
  // …AND THE SITE'S OWN ADDRESS (run 26, 2026-09-03), read by the one reader
  // of the public address, so a code that opens one of the site's pages has
  // a real destination — the designer answered nothing without it. A read
  // that fails leaves it blank rather than refusing every other kind.
  assert.match(b, /let aUrl = "";\s*try \{ aUrl = await publicUrlFor\(env, ownerSlug\); \} catch \{ aUrl = ""; \}/, "the addon does not read the site's public address, or a failed read is not blank");
  // RE-ANCHORED 2026-09-14: `const aSite = {` became `const siteFacts = (spec)
  // => ({` — the facts are REBUILT after each kind, so a designer sees what the
  // ones before it proposed rather than the stored site alone.
  const factsAt = b.indexOf("const siteFacts = (spec) => ({");
  assert.ok(factsAt > 0, "the site facts are no longer built from a spec");
  const siteLit = b.slice(factsAt, b.indexOf("});", factsAt));
  assert.match(siteLit, /\burl: aUrl,/, "the site note is not handed the address");
  // …AND WHAT EACH PAGE CALLS ITSELF (run 28), out of the stored source and
  // the stored plan, so "the booking page" is findable among routes.
  assert.match(siteLit, /\blabels: pageLabels\(aSrc, aLook\.pages\),/, "the site note is not handed the pages' own headlines");
  assert.match(W, /import \{[^}]*\bpageLabels\b[^}]*\} from "\.\/builder\/site-add\.mjs"/, "pageLabels is called and never imported");
  // …AND EVERY DESIGNER'S RAW REPLY IS KEPT, on the site's own store, the
  // moment the loop ends and before a decline can return — then read back by
  // the owner through the answer route with `kind=addon`.
  const runAt = at(b, "const ran = await runAdd(", "run");
  // ANCHORED ON THE CALL, NOT ON ITS ARGUMENT LIST. This read the whole literal
  // and went red on 2026-09-13 for an honest extra argument — the coverage
  // record — reporting the keep as gone when it had only grown. The property is
  // the ORDER: kept, then the decline may return.
  const keep = b.indexOf("await saveAddonAnswer(env, ownerSlug, {", runAt);
  const decline = b.indexOf('error: "declined"', runAt);
  assert.ok(keep > runAt && decline > keep, "the designers' replies are not kept before the decline returns");
  // AND THE DEVELOPER RECORD GOES WITH THEM (owner, 2026-09-13): the counts,
  // the unreadable entries and the invalid property names, none of which the
  // customer is told. Read inside the call's own span, so a record written
  // somewhere else entirely cannot satisfy it.
  //
  // RE-ANCHORED 2026-09-14. This pinned the whole `requirementRecord({ list:
  // aReq, skipped: … , ran:` argument list, which is the recorded "assert the
  // property, not the spelling" trap: the record is written TWICE now (once
  // here and once after the apply, so the stored coverage says what really
  // became of each requirement), so the literal moved into `aRecord` and the
  // call became `aSaveAnswer`. The property is that the save carries the
  // coverage and happens before the decline returns.
  assert.match(b.slice(keep, decline), /coverage: aRecord\(\)/,
    "the coverage record is not stored beside the replies");
  const rec = b.indexOf("const aRecord = () => requirementRecord({");
  assert.ok(rec > 0 && rec < keep, "the record composer is gone, or is written below its own use");
  assert.match(b.slice(rec, b.indexOf("});", rec)), /list: aReq, skipped: aReqSkipped, invalid: \[\.\.\.aBadProps\]/,
    "the record no longer carries the coverage list, the unreadable entries and the invalid properties");
  assert.match(b.slice(runAt, keep), /aKept\.push\(\{ kind: k, answered: ran\.value !== undefined, stop_reason: [^}]*content: \(ran\.raw && ran\.raw\.content\) \|\| null \}\);/, "a reply is kept without its content");
  // POSITION, NOT PRESENCE (the sweep's survivor): the push must sit BEFORE
  // the decline's `continue`, or an unanswered designer — the one reply
  // worth reading — is exactly the one never kept.
  const pushAt = b.indexOf("aKept.push({ kind: k,", runAt);
  const skipAt = b.indexOf("if (ran.value === undefined) { aDeclined.push(k); continue; }", runAt);
  assert.ok(pushAt > runAt && skipAt > pushAt, "an unanswered designer's reply is not kept — the decline skips past the keep");
  assert.match(W, /url\.searchParams\.get\("kind"\) === "addon" \? await loadAddonAnswer\(env, aslug\) : await loadGenAnswer\(env, aslug\)/, "the answer route cannot read the addon's kept replies");
  const keyFn = W.slice(at(W, 'const ADDON_ANSWER_KEY = (slug) => "source/"', "key"), W.indexOf("\n", at(W, 'const ADDON_ANSWER_KEY = (slug) => "source/"', "key")));
  assert.match(keyFn, /addon-answer\.json/, "the addon's replies share the build answer's key — one would overwrite the other");
  // …and "has" is read the way the wall reads it: the stored look OR the page.
  assert.match(b, /aHas\[f\] = hasLookField\(aLook, f\) \|\| \(aSrc \|\| \[\]\)\.some\(\(p\) => ADD_EVIDENCE\[f\]\.test/, "the addon reads 'already has' off the stored look alone — run 12's misfire");
});

// ── NOTHING FROM THE BUILD, SHAPES BY IDENTITY ───────────────────────────────

test("the step imports nothing from worker.js and carries none of the build's tool or wording", () => {
  const bare = SRC.replace(/^\s*(?:\/\/|\*|\/\*)[^\n]*$/gm, (m) => " ".repeat(m.length));
  const imports = [...bare.matchAll(/^import [^;]* from "([^"]+)";/gm)].map((m) => m[1]);
  assert.ok(imports.length >= 3, "the import list is empty — the scan is broken");
  for (const from of imports) {
    assert.ok(!/worker\.js/.test(from), "the add step imports from worker.js: " + from);
    // `site-qr-list.mjs` (2026-09-03) is a SHAPE module in the `BEHAVIOR_ITEM`
    // / `TABLE_ITEM` sense — the QR list's names, files and reader, imported
    // by the build (through site-qr.mjs), the container, the page writer and
    // the edit route alike, and carrying no wording of any path's.
    // THE ADD STEP'S OWN REPAIR (2026-09-04, owner: "each path has a repair
    // path") shares the tweak rung's MECHANISM — `site-tweak.mjs`, whose
    // guards keep a page's words and route and are calibrated at 0 false
    // alarms over 1,640 real tweaks; copying eight guards is how five copies
    // of one route mapping happened — and two shapes: the render check's own
    // serious kinds (`site-render.mjs`) and the variant-to-primary reading
    // (`site-langs.mjs`). Its wording is its own, asserted below; the BUILD's
    // repair module is never imported, asserted next.
    // `site-requirements.mjs` (2026-09-13) is this step's OWN metadata shape —
    // the coverage list — and is deliberately not part of `TABLE_ITEM`, which
    // `design_schema` binds by identity. `../site-access.mjs` is a LEAF with no
    // imports of its own, and is the platform's single answer to "what does
    // this table's access mean": `site-schema.mjs`, `site-rls.mjs`,
    // `site-owner.mjs`, `builder/page-gen.mjs`, `builder/site-rules.mjs` and
    // `builder/site-seed.mjs` all read it. It carries VOCABULARY (the five
    // preset names) and no path's wording, which is the property this test is
    // really about — the wording check below is what enforces that half.
    // `../site-schema.mjs` and `../site-apis.mjs` (2026-09-14) are the two
    // ENGINES, shared by the build path and the addon path alike, and what is
    // taken from each is ONE NUMBER: the longest body it will accept. Both
    // engines SLICE, silently, and this step's own cleaner sliced too — at
    // 8,000 against the engine's 4,000, so a body in between passed here whole
    // and was cut on the way into Postgres. A refusal derived from the wall is
    // the repository's own rule (`laneMaxTokens`); a refusal retyped beside it
    // is the "two copies of one thing" trap, which is what the old 8,000 was.
    // THE COST IS NAMED: `site-schema.mjs` pulls the Neon driver in, so this
    // module is no longer dependency-free at load. It carries no path's
    // wording, which is the property this test is really about.
    // `./site-files.mjs` (2026-09-17) is a LEAF with no imports of its own and
    // is the platform's single answer to "where does a component live" —
    // `PART_DIR`, `partPath`, `partNameOf`, `editableFiles`, read by the
    // Worker and by the container through it. `deadQrs` has to answer "does
    // this page import that component" once components joined the withheld
    // set, and the alternative was a second literal `"-parts/"` beside the
    // one `partNameOf` reads: the "two copies of one thing" trap, which is
    // the same reason `MAX_FN_BODY` two entries up is imported rather than
    // retyped. It carries VOCABULARY and no path's wording, which is the
    // property this test is really about.
    // `./site-images.mjs` (2026-09-17) is the platform's single answer to
    // "how many photographs may one change buy, and how much of a description
    // reaches the image model" — `IMAGE_CAP` and `MAX_PROMPT_CHARS`, the two
    // numbers `planImages` and `buySitePhotos` really enforce. The `photo`
    // kind's tool states both, and a ceiling retyped here would be a wall this
    // tool promises and the spend path does not keep: the same "two copies of
    // one thing" the two body caps above are imported to avoid. It imports one
    // budget constant and nothing else, so it costs no dependency, and it
    // carries VOCABULARY and no path's wording — the property this test is
    // really about.
    // `../site-api-shape.mjs` (2026-09-19) is dependency-free and is the
    // platform's single answer to "what does a connection say about itself" —
    // `cleanShape`, `cleanParams`, `cleanCredential` and `apiDetailLines`. The
    // `api` kind's tool offers a response sketch, typed parameters and
    // credential guidance, and this step has to CLEAN all three before storing
    // them; the engine's own `normalizeApi` asks the same three functions on
    // its way to `_meta.schema`. A second cleaner here would be two ideas of
    // what a valid sketch is, deciding different things about the same
    // declaration on the two paths it takes — the "two copies of one thing"
    // trap the two body caps above are imported to avoid. It carries
    // VOCABULARY and no path's wording, which is the property this test is
    // really about.
    // `../site-rls.mjs` (2026-09-19) owns `functionSql`, which EMITS the
    // `LANGUAGE` clause, so it is the platform's single answer to "which
    // languages does a generated function really have" — `FN_LANGUAGES`. The
    // `function` kind's tool offers the field and this step has to refuse a
    // language the emitter would not write; a list retyped here would be a set
    // of words the tool offers and the DDL cannot honour, which is the "two
    // copies of one thing" trap the two body caps above are imported to avoid,
    // with the failure landing at CREATE time on a customer's database. Its
    // only import is `site-access.mjs`, which this step already reaches, so it
    // costs no new dependency; it carries VOCABULARY and no path's wording,
    // which is the property this test is really about.
    assert.ok(["./site-plan.mjs", "./site-table.mjs", "./site-addon.mjs", "./build-models.mjs", "./site-qr-list.mjs", "./site-tweak.mjs", "./site-render.mjs", "./site-langs.mjs", "./site-requirements.mjs", "./site-files.mjs", "./site-images.mjs", "../site-access.mjs", "../site-schema.mjs", "../site-apis.mjs", "../site-api-shape.mjs", "../site-rls.mjs"].includes(from),
      "the add step reaches into a module the two paths do not share: " + from);
    assert.notEqual(from, "./site-repair.mjs", "the add step imports the BUILD's repair — the addon path triggering the build path");
  }
  // WHOLE WORDS: the add step's own `ADD_REPAIR_RULES` contains the build's
  // identifier as a substring, and a substring read flagged the step's own
  // wording as the build's.
  for (const word of ["design_schema", "SITE_SCHEMA", "designSiteSchema", "You design", "EDIT_RULE", "currentStateNote", "TWEAK_RULES", "REPAIR_RULES", "one visual change"]) {
    const whole = new RegExp("(?<![A-Za-z0-9_])" + word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![A-Za-z0-9_])");
    assert.ok(!whole.test(bare), "the add step carries another path's wording or tool: " + word);
  }
});

test("the table kind asks for the ONE table shape the build asks for — by identity, and the build really sends it", async () => {
  const tool = addTool("table");
  assert.equal(tool.input_schema.properties.table.items.properties.table, TABLE_ITEM, "the add step's table is not the shared item");
  const { tool: build } = await readSchemaTool();
  assert.deepEqual(build.input_schema.properties.backend.properties.tables.items, TABLE_ITEM,
    "the build tool's table item is not the shared one — two shapes of a table again");
  // …and the part shape, for the two kinds that may declare one.
  for (const k of ["page", "component"]) {
    const item = addTool(k).input_schema.properties[k].items;
    assert.equal(item.properties.tsx.items, TSX_ITEM, k + " declares parts in a shape of its own");
    assert.equal(item.properties.tsx.maxItems, MAX_TSX);
    assert.equal(item.properties.components.maxItems, MAX_COMPONENTS);
  }
});

// ── NO LOW LIMITS WHILE TESTING (owner, 2026-09-02) ─────────────────────────
test("a message may name every kind, and the kinds that come in numbers answer lists with ceilings a site can hold", () => {
  assert.equal(MAX_ADDS, ADD_KINDS.length, "a message cannot name every kind it asks for");
  // `photo` JOINED 2026-09-17: a message may ask for several pictures, so the
  // answer is a list like every other kind that comes in numbers.
  assert.deepEqual([...LIST_ADDS].sort(), ["api", "component", "function", "job", "page", "photo", "table"]);
  for (const k of LIST_ADDS) {
    const p = addTool(k).input_schema.properties[k];
    assert.equal(p.type, "array", k + " answers one thing, not a list");
    // The backend's own ceilings are the engine's (it keeps eight of each
    // tier), and a message that adds four connections or four jobs is
    // already a site that reads as several.
    assert.ok(p.maxItems >= (k === "api" || k === "job" ? 4 : 6), k + " has a low cap: " + p.maxItems);
    // …AND A PHOTOGRAPH'S CAP IS THE PLATFORM'S OWN, not a number of this
    // file's: `planImages` and the design step both slice at `IMAGE_CAP`, so a
    // wider one here would offer a picture nothing downstream will ever buy.
    if (k === "photo") assert.equal(p.maxItems, IMAGE_CAP, "the photo tool promises a cap the spend path does not keep");
    assert.ok(Array.isArray(p.items.required) && p.items.required.length, k + "'s entries require nothing");
  }
  for (const k of [...OWN_ADDS, ...PLACING_ADDS].filter((x) => !LIST_ADDS.includes(x))) assert.equal(addTool(k).input_schema.properties[k].type, "object", k + " is a list of a thing a site has one of");
  // The page cap is the page writer's own ceiling: a seventh page would be
  // dropped there, so promising it here would be a page nobody gets.
  assert.ok(MAX_ADD_PAGES <= MAX_PAGES, "the add step promises more pages than the page writer keeps");
  assert.ok(MAX_ADD_COMPONENTS >= 6 && MAX_ADD_TABLES >= 3);
  assert.ok(MAX_ADD_FUNCTIONS >= 3 && MAX_ADD_FUNCTIONS <= 8 && MAX_ADD_APIS >= 2 && MAX_ADD_APIS <= 8 && MAX_ADD_JOBS >= 2 && MAX_ADD_JOBS <= 8,
    "a backend cap outruns the engine's eight, or promises fewer than a lookup, its cancel and its amend");
  // And the rules say "as many as they asked for", never "one".
  //
  // `table` IS THE EXCEPTION AND IT IS A DELIBERATE REVERSAL (owner,
  // 2026-09-13: "Replace the restriction based on how many things the customer
  // explicitly named with the smallest complete data model"). The count rule —
  // as many tables as the things they NAMED, and not one more — refuses the
  // supporting table a feature cannot work without: bookings that point at a
  // slot nothing defines. So the assertion moves off the COUNT and onto the
  // two halves that replaced it, which are the same wall said the other way
  // round: smallest, and every unnamed table justified.
  for (const k of LIST_ADDS.filter((x) => x !== "table")) {
    assert.match(addRule(k), /AS MANY [A-Z ]+ AS (THEY|THE THINGS THEY) (ASKED FOR|NAMED)/, k + "'s rule still caps the count at one");
    assert.match(addRule(k), /NOT ONE MORE/, k + "'s rule has no ceiling");
  }
  const tableRule = addRule("table");
  assert.match(tableRule, /THE SMALLEST SET OF TABLES THAT MAKES WHAT THEY ASKED FOR ACTUALLY WORK/,
    "the table rule no longer asks for the smallest COMPLETE model");
  assert.match(tableRule, /not one table larger/i, "the table rule lost its ceiling — smallest with no upper bound is a quota");
  assert.match(tableRule, /`because`/, "a supporting table is no longer made to justify itself");
  // AND THE OLD COUNT RULE IS GONE RATHER THAN SITTING BESIDE THE NEW ONE.
  // Both at once is a contradiction the model resolves by picking one, and
  // which one it picks is not something this repository can observe.
  assert.doesNotMatch(tableRule, /AS MANY TABLES AS THE THINGS THEY NAMED/,
    "the count rule is still in the table rule, contradicting the smallest-complete one");
});

// ── THE UNIVERSAL RULE (owner, 2026-09-02) ──────────────────────────────────
test("whatever is added keeps the design system — said to the designers and to the page writer, in the same words", () => {
  assert.match(ADD_DESIGN_RULE, /KEEPS THE SITE'S DESIGN SYSTEM/);
  for (const w of ["theme", "stylesheet", "typefaces", "colours", "shape", "kit parts", "conventions"]) assert.ok(ADD_DESIGN_RULE.includes(w), "the rule does not name " + w);
  // Hop 1: every own kind's designer call carries it in the cached system text.
  for (const k of OWN_ADDS) {
    const req = addRequest({ kind: k, message: "x", site: SITE, model: "m" });
    assert.ok(req.system[0].text.includes(ADD_DESIGN_RULE), k + "'s designer is not told the rule");
  }
  // Hop 2: the fold's directive to the page writer opens with it, once, and
  // only when something is being added.
  const f = foldAdds([{ kind: "qr", value: { points: "tel:1", label: "Ring", page: "/", where: "" } }], {}, SITE);
  assert.ok(f.directive.startsWith("## Adding to this site\n" + ADD_DESIGN_RULE), "the page writer is not told the rule first");
  assert.equal(f.directive.split(ADD_DESIGN_RULE).length, 2, "the rule is repeated");
  assert.equal(foldAdds([], {}, SITE).directive, "", "an empty fold carries a directive");
});

// ── THE TOOLS ────────────────────────────────────────────────────────────────

test("one property per tool, named by the kind, nothing required at the top, the kind's own required inside", () => {
  for (const k of OWN_ADDS) {
    const t = addTool(k);
    assert.equal(t.name, "add_to_site");
    // THE KIND, AND AT MOST THIS STEP'S OWN METADATA BESIDE IT (owner,
    // 2026-09-13). `requirements` is a sibling of the kind and never a field
    // inside it: inside, it would land in `TABLE_ITEM`, which `design_schema`
    // binds by identity — so it would enlarge the build's tool and become a
    // promise `declarable-enforced` requires the schema engine to keep. It is
    // neither: no DDL is emitted from it and nothing is stored in `_meta`.
    //
    // DERIVED FROM WHETHER THE KIND ASKS FOR IT, so a kind that does not
    // declare `requirements` still has exactly one property and a kind that
    // does cannot quietly gain a third.
    const want = REQUIREMENT_ADDS.includes(k) ? [k, "requirements"] : [k];
    assert.deepEqual(Object.keys(t.input_schema.properties).sort(), want.slice().sort(),
      k + ": the tool has a property that is neither the kind nor this step's own metadata");
    if (REQUIREMENT_ADDS.includes(k)) {
      assert.equal(t.input_schema.properties.requirements.items, REQUIREMENT_ITEM,
        k + ": the coverage list is not the shared item");
      assert.ok(!Object.keys(TABLE_ITEM.properties).includes("requirements"),
        "the coverage list leaked into TABLE_ITEM, which design_schema binds by identity");
    }
    assert.deepEqual(t.input_schema.required, [], k + ": something is required of a kind that may decline");
    const p = t.input_schema.properties[k];
    assert.equal(p.description, addRule(k), k + ": the property does not carry the kind's rule");
    // A list kind's entry is the object; a single kind's property is.
    const item = p.type === "array" ? p.items : p;
    assert.equal(item.type, "object");
    assert.ok(Array.isArray(item.required) && item.required.length, k + ": the addition itself requires nothing");
    for (const r of item.required) assert.ok(Object.hasOwn(item.properties, r), k + ": requires a property it does not have: " + r);
  }
});

test("a kind with no tool is refused by name, and an unknown kind is refused", () => {
  // ── RE-ANCHORED 2026-09-17, AND THE PROPERTY MOVED RATHER THAN BROKE ─────
  //
  // This pinned `photo` as the example of a kind with no tool, which it was
  // until it started being designed here beside a page. What makes a tool
  // impossible is having NO SHAPE — not naming a layer — so the refusal is
  // asserted over the kinds that really have none, and `photo` is asserted the
  // other way: it HAS one, and its rule composes.
  for (const k of DISPATCHED_ADDS) {
    assert.throws(() => addTool(k), /does not act here/, k + " has no shape and yet a tool");
    assert.throws(() => addRule(k), /no rule/);
  }
  for (const k of PLACING_ADDS) {
    assert.ok(addTool(k).input_schema.properties[k], k + " is designed here and has no tool");
    assert.equal(addRule(k).split("\n").length, 4, k + ": the rule is not four parts");
  }
  assert.throws(() => addTool("nope"), /no add for kind/);
  assert.throws(() => addTool(["page"]), /no add for kind/);
  assert.throws(() => addRule("nope"), /no add for kind/);
});

test("every kind states all four parts of its rule, and the composer refuses a missing one", () => {
  assert.deepEqual(RULE_PARTS, ["is", "yours", "wide", "keep"]);
  for (const k of [...OWN_ADDS, ...PLACING_ADDS]) {
    const parts = addRule(k).split("\n");
    assert.equal(parts.length, 4, k + ": the rule is not four parts");
    for (const p of parts) assert.ok(p.trim().length > 20, k + ": a part is too short to be a rule");
  }
  assert.throws(() => composeRule("x", { is: "a", yours: "b", wide: "c" }), /keep/);
  assert.throws(() => composeRule("x", { is: "a", yours: "b", wide: "  ", keep: "d" }), /wide/);
  assert.throws(() => composeRule("x", null), /no rule/);
  assert.equal(composeRule("x", { is: " a ", yours: "b", wide: "c", keep: "d" }), "a\nb\nc\nd");
});

// ── THE PICKER ───────────────────────────────────────────────────────────────

test("the picker's tool is built from the kinds and describes every one of them", () => {
  const t = pickTool();
  assert.equal(t.name, "pick_adds");
  const kinds = t.input_schema.properties.kinds;
  assert.deepEqual(kinds.items.enum, ADD_KINDS);
  assert.equal(kinds.maxItems, MAX_ADDS);
  assert.equal(kinds.minItems, 1);
  for (const k of ADD_KINDS) assert.ok(kinds.description.includes('"' + k + '" — '), "the picker is not told what " + k + " means");
  assert.throws(() => pickTool(["page", "nope"]), /no add for kind: nope/);
  assert.throws(() => pickTool([]), /no kinds/);
  assert.deepEqual(pickTool(["qr"]).input_schema.properties.kinds.items.enum, ["qr"]);
});

test("the picker's answer is refused down to offered kinds, de-duped, capped, and in RUN order", () => {
  const got = readAdds(toolReply("pick_adds", { kinds: ["page", "table", "page", ["qr"], "nope", "photo", "three"] }));
  // De-duped and refused down to real names, then sorted into the caller's
  // order: a table runs before the page that shows it.
  assert.deepEqual(got, ["table", "page", "three", "photo"]);
  assert.deepEqual(readAdds(toolReply("pick_adds", { kinds: ["page", "table"] })), ["table", "page"]);
  // Every kind may be named (no low limits); the cap is the count of kinds.
  assert.deepEqual(readAdds(toolReply("pick_adds", { kinds: [...ADD_KINDS].reverse() })), ADD_KINDS);
  assert.deepEqual(readAdds(toolReply("pick_adds", { kinds: [...ADD_KINDS, ...ADD_KINDS] })), ADD_KINDS);
  assert.deepEqual(readAdds(toolReply("pick_adds", { kinds: ["page"] }), ["qr"]), [], "a kind not offered was accepted");
  assert.deepEqual(readAdds({ content: [{ type: "text", text: "hi" }] }), []);
  assert.deepEqual(readAdds(null), []);
});

test("the picking request and the add request are cached where they must be and carry the picked model", () => {
  const p = pickRequest({ message: "Add a gallery page", current: "The site is called X.", model: "sentinel-model" });
  assert.equal(p.model, "sentinel-model");
  assert.equal(p.tool_choice.name, "pick_adds");
  assert.ok(p.tools[0].cache_control && p.system[0].cache_control, "the picker's fixed blocks are not cached");
  // THE SITE IS LABELLED BY THE MODULE, NOT BY THE CALLER (owner, 2026-09-13).
  // The picker used to get `siteDigest` — routes and table names — and now gets
  // the same note the designers read, because this is the one call that decides
  // whether the table designer runs at all and a name list cannot answer "does
  // the site already store this". Labelled here so both requests say the same
  // words for the same thing; a caller composing its own heading would be the
  // second copy of a sentence this module owns.
  assert.match(p.messages[0].content, /^Their site as it stands:\nThe site is called X\.\n\nTheir message:\nAdd a gallery page$/);
  // AND THE SITE STILL RIDES THE PER-CALL BYTES, never the cached prefix: the
  // tool and the system text must stay byte-identical for every customer or the
  // prefix stops caching and every addition on the platform pays for a cold one.
  const p2 = pickRequest({ message: "Add a gallery page", current: "The site is called Y.", model: "sentinel-model" });
  assert.equal(JSON.stringify(p2.tools), JSON.stringify(p.tools), "the site leaked into the picker's cached tool");
  assert.equal(JSON.stringify(p2.system), JSON.stringify(p.system), "the site leaked into the picker's cached system text");
  // NO SITE AT ALL STILL WORKS, and carries no empty heading: an addon on a
  // site whose note could not be read is not an addon with a blank label.
  assert.match(pickRequest({ message: "hi", model: "m" }).messages[0].content, /^Their message:\nhi$/);
  const a = addRequest({ kind: "component", message: "x".repeat(MAX_MESSAGE + 50), site: SITE, model: "sentinel-model" });
  assert.equal(a.model, "sentinel-model");
  assert.equal(a.tool_choice.name, "add_to_site");
  assert.ok(a.tools[0].cache_control && a.system[0].cache_control, "the add's fixed blocks are not cached");
  assert.ok(a.messages[0].content.includes(siteNote(SITE)), "the add is not shown the site");
  assert.ok(!a.messages[0].content.includes("x".repeat(MAX_MESSAGE + 1)), "the message is not capped");
  assert.equal(ADD_MODEL, modelsFor().quick, "the default model is not the picker's");
});

test("pageLabels: each page's own headline out of its source, or its plan name, never a heading with no words", () => {
  const src = (path, source) => ({ path, source });
  const labels = pageLabels([
    src("index.tsx", '<main><h1 className="text-2xl">Book a {kind}\n guitar <em>lesson</em> &amp; more</h1></main>'),
    src("prices.tsx", "<h1>{brand}</h1>"),
    src("about.tsx", "<p>no heading</p>"),
    // A HEADING WITH NO WORDS — a star, a year — is not a label: the sweep
    // showed the first fixture for this was merely EMPTY, which any test
    // drops, so the plan name has to win over a heading that is there and
    // says nothing.
    src("gallery.tsx", "<h1>★ 2024</h1>"),
    src("_layout.tsx", "<h1>Layout</h1>"),
    null, "x",
  ], [{ name: "Book", path: "/" }, { name: "Lesson Prices", path: "/prices" }, { name: "Team", path: "/about/" }, { name: "Gallery", path: "/gallery" }, { path: "/x" }, null]);
  assert.deepEqual(labels, { "/": "Book a guitar lesson & more", "/prices": "Lesson Prices", "/about": "Team", "/gallery": "Gallery" },
    "the headline is not cleaned of JSX and tags, the plan name does not fill in for an empty or wordless heading, or a route is missed");
  assert.deepEqual(pageLabels([src("index.tsx", "<h1>★</h1>")], []), {}, "a heading with no words is a label");
  assert.deepEqual(pageLabels(null, null), {});
  assert.deepEqual(pageLabels([src("index.tsx", "<h1>" + "x".repeat(200) + "</h1>")], []), { "/": "x".repeat(80) }, "a headline is not capped");
  assert.deepEqual(pageLabels([], [{ name: "Home", path: "/" }]), { "/": "Home" }, "the plan name alone is not a label");
  assert.deepEqual(pageLabels([src("index.tsx", "<h1>Book</h1>")], [{ name: "Home", path: "/" }]), { "/": "Book" }, "the headline does not win over the plan name");
});

test("the site note says names, not contents, and says a missing database out loud", () => {
  const none = siteNote(SITE);
  assert.match(none, /NO database/);
  assert.match(none, /Its pages are: \//);
  assert.match(none, /shopfront/);
  const db = siteNote({ ...DB, kind: "tool", qr: [{ name: "ring", points: "tel:0114", label: "Scan to ring" }], three: "a pick", tsx: [{ name: "chord-diagram" }] });
  assert.match(db, /It stores: bookings\./);
  assert.match(db, /WORKING TOOL/);
  // EVERY CODE BY NAME, WITH BOTH HALVES (2026-09-03): the designer adding a
  // code has to pick a name the site does not use and a destination it does
  // not already carry, so it is shown all of each.
  assert.match(db, /a QR code: `ring` \("Scan to ring", scanning it: tel:0114\)/);
  const two = siteNote({ ...DB, qr: [{ name: "ring", points: "tel:0114", label: "Ring" }, { name: "wifi", points: "WIFI:T:WPA;S:x;P:y;;", label: "Wifi" }] });
  assert.match(two, /2 QR codes: `ring` \(.*\), `wifi` \(/);
  // The old single code reads as one named `qr` — a site published before the
  // list is described exactly as it is.
  assert.match(siteNote({ ...DB, qr: { points: "tel:0114", label: "Ring" } }), /a QR code: `qr` \("Ring"/);
  assert.ok(!/QR/.test(siteNote({ ...DB, qr: { label: "half" } })), "a code with no destination is not a code the site carries");
  assert.match(db, /3D scene/);
  assert.match(db, /parts written for it: chord-diagram/);
  assert.ok(!/\{|\[/.test(db), "the note prints a structure rather than names");
  assert.match(siteNote(null), /\(unnamed\)/);
  // ITS ADDRESS (run 26, 2026-09-03): the QR designer answered nothing for
  // "a code that opens the booking page" because it may not invent a
  // destination and was never told where the site lives. Said with one of
  // the site's real pages resolved as the example, and only when there is
  // an address to say.
  const addressed = siteNote({ ...MULTI, url: "https://fretwork-1.gofarther.app/" });
  assert.match(addressed, /Its address is https:\/\/fretwork-1\.gofarther\.app\/ — /, "the designer is not told the site's address");
  assert.match(addressed, /\(https:\/\/fretwork-1\.gofarther\.app\/about\)/, "the example is not one of the site's own pages resolved against the address");
  assert.match(addressed, /real destination/, "the note does not say the site's own pages are real destinations");
  assert.match(siteNote({ ...SITE, url: "https://x.test" }), /\(https:\/\/x\.test\/\)/, "a one-page site's example is not its home page");
  assert.ok(!/address/.test(siteNote(SITE)), "a site with no address is told one");
  assert.ok(!/address/.test(siteNote({ ...SITE, url: "fretwork-1.gofarther.app" })), "a bare host is used as an address");
  assert.ok(!/address/.test(siteNote({ ...SITE, url: ["https://x.test"] })), "an array was coerced to an address");
  // EACH PAGE WITH WHAT IT CALLS ITSELF (run 28): the designer declined "the
  // booking page" on a site whose home page is headed "Book a guitar lesson",
  // because it was shown routes alone.
  const labelled = siteNote({ ...MULTI, labels: { "/": "Book a guitar lesson", "/about": 'The "team"' } });
  assert.match(labelled, /Its pages are: \/ \("Book a guitar lesson"\), \/about \("The 'team'"\)\./, "the pages are not printed with their own headlines");
  assert.match(siteNote({ ...MULTI, labels: { "/": "Book" } }), /Its pages are: \/ \("Book"\), \/about\./, "a page with no label is dropped or mislabelled");
  assert.match(siteNote({ ...MULTI, labels: ["Book"] }), /Its pages are: \/, \/about\./, "an array of labels is read as labels");
});

test("pickAdds and runAdd are driven through a fake send: a throw is carried, a truncation is named, a decline is nothing", async () => {
  const sent = [];
  const send = async (req) => { sent.push(req); return toolReply("pick_adds", { kinds: ["component"] }); };
  const picked = await pickAdds({ send }, { message: "Add testimonials", model: "m1" });
  assert.deepEqual(picked.kinds, ["component"]);
  assert.equal(picked.usage.model, "m1", "the usage is not tagged with the model that was sent");
  assert.equal(picked.usage.cacheRead, 100);
  assert.equal(sent.length, 1);
  // An empty message makes no call at all — a paid call behind a public route.
  assert.deepEqual(await pickAdds({ send }, { message: "   " }), { kinds: [], usage: null, failed: false });
  assert.equal(sent.length, 1);
  const boom = new Error("down"); boom.status = 503;
  const failed = await pickAdds({ send: async () => { throw boom; } }, { message: "x" });
  assert.equal(failed.failed, true); assert.equal(failed.error, boom); assert.deepEqual(failed.kinds, []);

  const ran = await runAdd({ send: async () => toolReply("add_to_site", { component: { page: "/", does: "quotes", components: ["testimonial"] } }) },
    { kind: "component", message: "x", site: SITE, model: "m2" });
  assert.equal(ran.failed, false);
  assert.deepEqual(ran.value, { page: "/", does: "quotes", components: ["testimonial"] });
  assert.equal(ran.usage.model, "m2");
  const cut = await runAdd({ send: async () => toolReply("add_to_site", { component: {} }, { stop_reason: "max_tokens" }) }, { kind: "component", message: "x", site: SITE, model: "m2" });
  assert.equal(cut.failed, true); assert.equal(cut.error.truncated, true); assert.ok(cut.usage, "a truncated call's usage is dropped, so it is not billed");
  const dead = await runAdd({ send: async () => { throw boom; } }, { kind: "component", message: "x", site: SITE, model: "m2" });
  assert.equal(dead.failed, true); assert.equal(dead.error, boom);
  const declined = await runAdd({ send: async () => toolReply("add_to_site", { component: null }) }, { kind: "component", message: "x", site: SITE, model: "m2" });
  assert.equal(declined.failed, false); assert.equal(declined.value, undefined);
  // THE RAW REPLY RIDES OUT (run 28), so the route can keep what a designer
  // said whether or not it answered — a decline with nothing to read cost
  // three live runs.
  assert.ok(Array.isArray(declined.raw && declined.raw.content), "a declined call's raw reply is not handed up");
  assert.ok(Array.isArray(ran.raw && ran.raw.content), "an answered call's raw reply is not handed up");
  // THE READER ANSWERS AN EXPLICIT SHAPE (owner, 2026-09-13), not a bare value:
  // it used to return `use.input[kind]` and nothing else, so a sibling property
  // the model wrote was dropped one hop after it was written — this
  // repository's most-repeated defect, and the reason the coverage list could
  // not simply be added to the tool. Both arrays are ALWAYS arrays, so a
  // consumer never has to ask whether this kind offers them.
  const bare = readAddAnswer(toolReply("add_to_site", {}), "page");
  assert.equal(bare.value, undefined);
  assert.deepEqual(bare.requirements, []);
  assert.deepEqual(bare.skipped, []);
  assert.equal(addUsage({}, "m"), null);
});

// ── THE ANSWER, CLEANED ──────────────────────────────────────────────────────

test("fileOfRoute is routeOf run backwards", () => {
  for (const r of ["/", "/gallery", "/about/team", "/x-y", "/a1/b2"]) assert.equal(routeOf(fileOfRoute(r)), r, r);
  assert.equal(fileOfRoute("/"), "index.tsx");
  assert.equal(fileOfRoute("gallery"), "gallery.tsx", "a route without its slash is not repaired");
  assert.equal(fileOfRoute("/Gallery/"), "gallery.tsx");
  assert.equal(fileOfRoute("junk!"), "");
  assert.equal(fileOfRoute(["/x"]), "", "String([...]) coercion");
});

test("cleanAdd: a page is repaired where it can be and refused where a guess would be a page on a live site", () => {
  const ok = cleanAdd("page", {
    path: "gallery", name: " Gallery ", purpose: "show work",
    sections: ["a", "b", ...Array(20).fill("more")],
    components: ["Gallery", "site-chrome", "site-chrome", "bad name", 7],
    tsx: [{ name: "Seat-Map", does: "seats", props: "rows: X[]" }, { name: "seat-map", does: "dup", props: "p" }, { name: "no-props", does: "x" }],
    link: "the header",
  }, SITE);
  assert.equal(ok.ok, true);
  // A LIST KIND ANSWERS A LIST; a bare object is a list of one.
  assert.ok(Array.isArray(ok.value) && ok.value.length === 1);
  const g = ok.value[0];
  assert.equal(g.path, "/gallery"); assert.equal(g.file, "gallery.tsx"); assert.equal(g.name, "Gallery");
  assert.deepEqual(g.components, ["gallery", "site-chrome"]);
  assert.equal(g.sections.length, MAX_SECTIONS);
  assert.deepEqual(g.tsx, [{ name: "seat-map", does: "seats", props: "rows: X[]" }]);
  assert.deepEqual(ok.skipped, []);
  assert.equal(cleanAdd("page", { ...g, path: "/" }, SITE).why, "no-path", "the home page is a page to add");
  assert.equal(cleanAdd("page", { ...g, path: "/about" }, MULTI).why, "page-exists");
  assert.equal(cleanAdd("page", { ...g, name: "" }, SITE).why, "no-plan");
  assert.equal(cleanAdd("page", { ...g, sections: [], components: [] }, SITE).why, "no-plan");
  assert.equal(cleanAdd("page", { ...g, path: "bad path!" }, SITE).why, "no-path");
  assert.equal(cleanAdd("page", null, SITE).why, "nothing");
  assert.equal(cleanAdd("page", "gallery", SITE).why, "nothing");
  assert.equal(cleanAdd("page", [], SITE).why, "nothing");
  assert.equal(cleanAdd("nope", {}, SITE).why, "no-kind");
  // ── RE-ANCHORED 2026-09-17: THE PROPERTY IS "NO TOOL", NOT "DISPATCHES" ──
  //
  // This asserted `photo` uncleanable, which was true while it had no shape.
  // It has one now, so an empty answer is refused for the REAL reason — it
  // named no page and described no picture — and the `no-kind` refusal is
  // asserted over a kind that genuinely has nothing to be answered in.
  assert.equal(cleanAdd("photo", {}, SITE).why, "no-photo", "an undescribed picture must be refused by name");
  for (const k of DISPATCHED_ADDS) assert.equal(cleanAdd(k, {}, SITE).why, "no-kind", k + " has no tool and so nothing to clean");
});

test("cleanAdd: a list keeps every usable entry, names the rest, and refuses only when none is usable", () => {
  const many = cleanAdd("page", [
    { path: "/prices", name: "Prices", purpose: "p", sections: ["a"], components: ["price-list"] },
    { path: "/prices", name: "Again", purpose: "p", sections: ["a"], components: [] },   // the same answer already added it
    { path: "/", name: "Home", purpose: "p", sections: ["a"], components: [] },          // the home page
    { path: "/about", name: "About", purpose: "p", sections: ["b"], components: ["site-chrome"] },
    "junk",
  ], SITE);
  assert.equal(many.ok, true);
  assert.deepEqual(many.value.map((p) => p.path), ["/prices", "/about"]);
  assert.deepEqual(many.skipped, [{ why: "page-exists", name: "/prices" }, { why: "no-path", name: "/" }]);
  // Every entry bad: refused with the FIRST reason, the rest still named.
  const none = cleanAdd("page", [{ path: "/" }, { path: "/about", name: "About", purpose: "p", sections: [], components: [] }], MULTI);
  assert.equal(none.ok, false); assert.equal(none.why, "no-path"); assert.equal(none.skipped.length, 2);
  // Capped at the list's ceiling, silently — a seventh page is one the page
  // writer would drop anyway.
  const pages = Array.from({ length: MAX_ADD_PAGES + 3 }, (_, i) => ({ path: "/p" + i, name: "P" + i, purpose: "p", sections: ["a"], components: [] }));
  assert.equal(cleanAdd("page", pages, SITE).value.length, MAX_ADD_PAGES);
  // Components and tables the same way; a table named twice is once.
  const comps = cleanAdd("component", [{ page: "/", does: "quotes", components: ["testimonial"] }, { page: "/", does: "x", components: [] }], SITE);
  assert.equal(comps.value.length, 1); assert.deepEqual(comps.skipped, [{ why: "no-component", name: "x" }]);
  const tables = cleanAdd("table", [{ table: { name: "bookings", columns: [{ name: "when" }] } }, { table: { name: "bookings", columns: [{ name: "x" }] } }], DB);
  assert.equal(tables.value.length, 1); assert.deepEqual(tables.skipped, [{ why: "no-table", name: "bookings" }]);
});

test("cleanAdd: a component lands on the one page a one-page site has, is refused on a many-page site it cannot name, and IS a component", () => {
  // RE-ANCHORED 2026-09-17, and this expectation MOVED rather than broke — it
  // asserted the defect as correct. The answer NAMED `/testimonials`, a route
  // this site does not have, and the one-page shortcut swallowed it and
  // answered `/`. The shortcut's own justification is about an answer that
  // names NOTHING ("there is exactly one place this can go"); a named route
  // the site has not got is the silent substitution the owner ruled out, one
  // branch over from the 2026-09-14 fix for the multi-page case.
  const one = cleanAdd("component", { does: "quotes", components: ["testimonial"], where: "after the hero" }, SITE);
  assert.equal(one.ok, true); assert.equal(one.value[0].page, "/"); assert.equal(one.value[0].where, "after the hero");
  assert.deepEqual(one.value[0].components, ["testimonial"]);
  assert.equal(cleanAdd("component", { page: "/testimonials", does: "quotes", components: ["testimonial"] }, SITE).why, "no-page",
    "a named route the ONE-page site does not have silently became its home page");
  assert.equal(cleanAdd("component", { page: "/nope", does: "quotes", components: ["testimonial"] }, MULTI).why, "no-page");
  assert.equal(cleanAdd("component", { page: "about", does: "quotes", components: ["testimonial"] }, MULTI).value[0].page, "/about");
  // RE-ANCHORED 2026-09-14, and the expectation MOVED rather than broke (owner:
  // *"On a multi-page site, a missing destination must not silently become the
  // home page."*). This asserted that an unnamed destination falls back to `/`
  // whenever the site has a home page — which is every site — so the `no-page`
  // refusal one line up was unreachable for an answer that named NOTHING, and a
  // section meant for /about was added to the front page and reported as done.
  // The one-page fallback is kept, and is on its own line above: there the home
  // page is not a guess, it is the only answer there is.
  assert.equal(cleanAdd("component", { does: "quotes", components: ["testimonial"] }, MULTI).why, "no-page",
    "a section with no destination silently became the home page of a multi-page site");
  assert.equal(cleanAdd("component", { page: "/", components: ["x"] }, SITE).why, "no-plan");
  // THE COMPONENT IS THE ADDITION (owner: "a tsx step that adds components"):
  // an answer that names no kit part and writes none is a band the page
  // writer would have to invent — the reading the owner corrected.
  assert.equal(cleanAdd("component", { page: "/", does: "quotes", components: [] }, SITE).why, "no-component");
  assert.equal(cleanAdd("component", { page: "/", does: "quotes", components: ["not a name"] }, SITE).why, "no-component");
  const own = cleanAdd("component", { page: "/", does: "a tide clock", components: [], tsx: [{ name: "tide-clock", does: "shows the tide", props: "port: string" }] }, SITE);
  assert.equal(own.ok, true); assert.deepEqual(own.value[0].components, []); assert.equal(own.value[0].tsx[0].name, "tide-clock");
});

test("cleanAdd: a table needs a name and columns unless it gives an existing table payment or a public view", () => {
  const ok = cleanAdd("table", { table: { name: "Bookings", columns: [{ name: "when", type: "text" }, { nope: 1 }], access: "collect" }, seed: [{ when: "x" }, "junk", ...Array(20).fill({ when: "y" })], shows: "/" }, DB);
  assert.equal(ok.ok, true);
  const t = ok.value[0];
  assert.equal(t.table.name, "bookings");
  assert.equal(t.table.columns.length, 1);
  assert.equal(t.table.access, "collect", "the rest of the item must ride through to the engine");
  assert.equal(t.seed.length, MAX_ADD_SEED_ROWS);
  assert.equal(t.shows, "/");
  assert.equal(t.exists, true);
  assert.equal(cleanAdd("table", { table: { name: "bookings", columns: [] } }, SITE).why, "no-columns");
  assert.equal(cleanAdd("table", { table: { name: "orders", columns: [], payment: { from: "products" } } }, DB).why, "no-columns", "payment on a table the site does not have is not an alteration");
  assert.equal(cleanAdd("table", { table: { name: "bookings", columns: [], payment: { from: "services" } } }, DB).ok, true);
  assert.equal(cleanAdd("table", { table: { name: "bookings", columns: [], publicView: { columns: ["when"] } } }, DB).ok, true);
  assert.equal(cleanAdd("table", { table: { name: "Bad Name", columns: [{ name: "a" }] } }, DB).why, "no-table");
  assert.equal(cleanAdd("table", { table: ["bookings"] }, DB).why, "no-table");
  assert.equal(cleanAdd("table", {}, DB).why, "no-table");
});

test("cleanAdd: a code needs both halves and a name the site does not use; a scene needs a description; each lands on a page", () => {
  // RE-ANCHORED 2026-09-17, the same expectation move as the component case:
  // `page: "/x"` NAMES a route this one-page site has not got, and the one-page
  // shortcut answered `/`. The shortcut is for an answer that names nothing,
  // which this line now is; a named route the site lacks is asserted beside it.
  const qr = cleanAdd("qr", { points: " tel:0114 ", label: "Ring", where: "contact" }, SITE);
  assert.deepEqual(qr, { ok: true, value: { name: "ring", points: "tel:0114", label: "Ring", page: "/", where: "contact" } });
  assert.equal(cleanAdd("qr", { points: "tel:0114", label: "Ring", page: "/x" }, SITE).value.page, "",
    "a named route the ONE-page site does not have silently became its home page");
  assert.equal(cleanAdd("qr", { label: "Ring" }, SITE).why, "no-destination");
  assert.equal(cleanAdd("qr", { points: "tel:0114" }, SITE).why, "no-destination");
  assert.equal(cleanAdd("qr", { points: "tel:0114", label: "Ring", page: "/nope" }, MULTI).value.page, "", "a page it cannot name is left for the page call to decide");
  // ── A SITE CARRIES SEVERAL (owner, 2026-09-03) ──────────────────────────
  // The name is an identifier the page writes after a dot, derived from the
  // caption when the answer gave none; what is refused is not "a second
  // code" but a second code with a name or a destination the site already
  // has, a destination a QR may not carry, a caption that yields no name, and
  // a site already at the ceiling.
  assert.equal(cleanAdd("qr", { name: "Join our wifi!", points: "WIFI:T:WPA;S:x;P:y;;", label: "Wifi" }, SITE).value.name, "joinourwifi", "the name is not made an identifier");
  assert.equal(cleanAdd("qr", { points: "javascript:alert(1)", label: "Ring" }, SITE).why, "bad-destination");
  assert.equal(cleanAdd("qr", { points: "tel:0114", label: "!!!" }, SITE).why, "no-name");
  const ONE = { ...SITE, qr: [{ name: "ring", points: "tel:0114", label: "Ring" }] };
  assert.equal(cleanAdd("qr", { points: "TEL:0114", label: "Call us" }, ONE).why, "same-code", "a second code pointing where one already does is not refused");
  assert.equal(cleanAdd("qr", { points: "https://x.test", label: "Ring" }, ONE).why, "same-name", "a second code under a name the site has is not refused");
  const second = cleanAdd("qr", { name: "wifi", points: "WIFI:T:WPA;S:x;P:y;;", label: "Join the wifi" }, ONE);
  assert.equal(second.ok, true, "a second code with its own name and destination is refused: " + second.why);
  // The old single code reads as one named `qr`, so a site published before
  // the list can take a second and cannot take another `qr`.
  const LEGACY = { ...SITE, qr: { points: "tel:0114", label: "Ring" } };
  assert.equal(cleanAdd("qr", { points: "https://x.test", label: "Menu" }, LEGACY).ok, true);
  assert.equal(cleanAdd("qr", { name: "qr", points: "https://x.test", label: "Menu" }, LEGACY).why, "same-name", "the old single code is not read as the name `qr`");
  const FULL = { ...SITE, qr: Array.from({ length: MAX_QRS }, (_, i) => ({ name: "c" + i, points: "https://x.test/" + i, label: "L" + i })) };
  assert.equal(cleanAdd("qr", { name: "more", points: "https://y.test", label: "More" }, FULL).why, "too-many");
  // THE SITE'S OWN PAGES ARE REAL DESTINATIONS (run 26, 2026-09-03): a bare
  // route is resolved against the site's address; a route the site lacks, or
  // an address the route could not read, is a named refusal, never a guess.
  const AT = { ...MULTI, url: "https://fretwork-1.gofarther.app/" };
  assert.equal(cleanAdd("qr", { points: "/about", label: "About us" }, AT).value.points, "https://fretwork-1.gofarther.app/about", "a route of the site's own is not resolved against its address");
  assert.equal(cleanAdd("qr", { points: "/", label: "Book a lesson" }, AT).value.points, "https://fretwork-1.gofarther.app/", "the home page is not a destination");
  assert.equal(cleanAdd("qr", { points: "/About/", label: "About" }, AT).value.points, "https://fretwork-1.gofarther.app/about", "a route is not normalised the way the site's own are");
  assert.equal(cleanAdd("qr", { points: "/nope", label: "x" }, AT).why, "no-such-page", "a code pointing at a page the site lacks is not refused");
  assert.equal(cleanAdd("qr", { points: "/about", label: "x" }, MULTI).why, "no-address", "a route with no address to resolve against is not refused");
  assert.equal(cleanAdd("qr", { points: "https://elsewhere.test/x", label: "x" }, AT).value.points, "https://elsewhere.test/x", "a full URL is rewritten");
  assert.equal(cleanAdd("qr", { points: "tel:0114", label: "x" }, AT).value.points, "tel:0114", "a non-URL destination is rewritten");
  // …and the designer is TOLD both halves of that: the tool says a route is a
  // real answer, and the rule says the site's own pages are not invented —
  // without either, run 26's model answers nothing again, honestly.
  assert.match(addTool("qr").input_schema.properties.qr.properties.points.description, /route/, "the tool does not say a route of the site's own is an answer");
  assert.match(addRule("qr"), /own pages are NOT invented/, "the rule does not except the site's own pages from never-invent");
  const three = cleanAdd("three", { scene: "a spinning pick", page: "/" }, SITE);
  assert.deepEqual(three, { ok: true, value: { scene: "a spinning pick", page: "/" } });
  assert.equal(cleanAdd("three", { page: "/" }, SITE).why, "no-scene");
});

// ── THE DIRECTIVE AND THE FOLD ───────────────────────────────────────────────

test("the directive says what is new, where it goes and what it is built from — and a tool site gets the tool block", () => {
  // RE-ANCHORED 2026-09-14 (owner: *"Check kit names against the real available
  // catalog"*). The fixture named `form-shell`, which SOUNDS like a kit part and
  // is not one of the 2,112 — so it used to be written into the directive as a
  // component to reach for, and the page rules say in as many words to call a
  // kit component rather than rewrite it. It is dropped and named now, which is
  // asserted beside the real name rather than instead of it: this case is about
  // the DIRECTIVE, so its fixture uses names the kit really has.
  const invented = cleanAdd("page", { path: "/book", name: "Book", purpose: "book a lesson", sections: ["form"], components: ["site-chrome", "form-shell"] }, SITE);
  assert.deepEqual(invented.value[0].components, ["site-chrome"], "a name the kit does not have was written into the plan");
  assert.deepEqual(invented.unknownKit, ["form-shell"], "the dropped name is not reported, so nobody can be told");
  const page = cleanAdd("page", { path: "/book", name: "Book", purpose: "book a lesson", sections: ["form", "hours"], components: ["site-chrome", "form-section"], link: "the header menu" }, SITE).value[0];
  const d = addDirective("page", page, SITE);
  assert.match(d, /book\.tsx/); assert.match(d, /\/book/); assert.match(d, /"Book"/);
  assert.match(d, /LAYOUT — book a lesson\./);
  assert.match(d, /Reach first for: site-chrome, form-section\./);
  assert.match(d, /1\. form\n\s+2\. hours/, "the bands are not numbered in order");
  assert.match(d, /Link it from the header menu/);
  assert.ok(!d.includes(TOOL_DIRECTIVE), "a shopfront got the tool block");
  assert.ok(addDirective("page", page, { ...SITE, kind: "tool" }).includes(TOOL_DIRECTIVE), "a tool site did not get the tool block");
  const component = cleanAdd("component", { page: "/", where: "after the hero", does: "quotes from students", components: ["testimonial"] }, SITE).value[0];
  const s = addDirective("component", component, SITE);
  assert.match(s, /^## The component you are adding/);
  assert.match(s, /On the home page \(index\.tsx\), after the hero/);
  assert.match(s, /quotes from students/);
  assert.match(s, /The kit component: testimonial — its exact props are listed above; call it, do not rewrite it/);
  assert.match(s, /byte-identical/); assert.match(s, /No new page file/);
  assert.ok(addDirective("component", component, { ...SITE, kind: "tool" }).includes(TOOL_DIRECTIVE));
  // One written for this site is named as a part, with its props.
  const own = addDirective("component", { page: "/", where: "", does: "the tide", components: [], tsx: [{ name: "tide-clock", does: "x", props: "port: string" }] }, SITE);
  assert.match(own, /Written for this site: tide-clock \(port: string\) — write it as a part and call it from the page/);
  assert.ok(!/The kit component/.test(own), "a part written for this site is not called a kit component");
  const table = cleanAdd("table", { table: { name: "bookings", columns: [{ name: "when" }] }, seed: [{ when: "x" }], shows: "/book" }, DB).value[0];
  const t = addDirective("table", table, DB);
  assert.match(t, /`bookings`/); assert.match(t, /1 starter rows/); assert.match(t, /\/book \(book\.tsx\)/); assert.match(t, /changes|adds/);
  const q = addDirective("qr", { points: "x", label: "y", page: "/", where: "" }, SITE);
  assert.match(q, /SITE_QR/); assert.match(q, /contact or closing band/);
  assert.match(addDirective("three", { scene: "x", page: "/" }, SITE), /3D block above/);
  assert.equal(addDirective("nope", {}, SITE), "");
});

test("foldAdds appends the parts by name over the stored ones, folds the tables with their rows, and unions the kit parts", () => {
  const prior = { tsx: [{ name: "chord-diagram", does: "chords", props: "p" }] };
  const answers = [
    { kind: "table", value: cleanAdd("table", { table: { name: "bookings", columns: [{ name: "when" }] }, seed: [{ when: "x" }], shows: "/book" }, DB).value },
    { kind: "page", value: cleanAdd("page", { path: "/book", name: "Book", purpose: "book", sections: ["form"], components: ["site-chrome", "form-section"], tsx: [{ name: "slot-picker", does: "picks", props: "s" }, { name: "chord-diagram", does: "chords, redone", props: "p2" }] }, SITE).value },
    { kind: "component", value: cleanAdd("component", { page: "/", does: "quotes", components: ["testimonial", "site-chrome"] }, SITE).value },
    { kind: "qr", value: { points: "tel:0114", label: "Ring", page: "/", where: "" } },
    { kind: "three", value: { scene: "a pick", page: "/" } },
    null, { kind: "photo" },
  ];
  const f = foldAdds(answers, prior, SITE);
  assert.deepEqual(f.designed.tsx, [{ name: "chord-diagram", does: "chords, redone", props: "p2" }, { name: "slot-picker", does: "picks", props: "s" }],
    "the stored part is dropped, or the new one is not appended, or a re-declared one is not merged by name");
  assert.deepEqual(f.designed.tables.map((t) => t.name), ["bookings"]);
  assert.deepEqual(f.designed.seed, { bookings: [{ when: "x" }] });
  // A LIST, APPENDED (2026-09-03): the fold hands the merge the stored codes
  // plus the new one, named from its caption when the answer gave none.
  assert.deepEqual(f.designed.qr, [{ name: "ring", points: "tel:0114", label: "Ring" }]);
  const kept = foldAdds([{ kind: "qr", value: { name: "wifi", points: "WIFI:T:WPA;S:x;P:y;;", label: "Wifi" } }], { qr: { points: "tel:0114", label: "Ring" } }, SITE);
  assert.deepEqual(kept.designed.qr.map((c) => c.name), ["qr", "wifi"], "the stored code is dropped when another is added, or the old single code is not read as `qr`");
  assert.deepEqual(kept.designed.qr[0], { name: "qr", points: "tel:0114", label: "Ring" }, "the stored code does not come through character for character");
  assert.equal(f.designed.three, "a pick");
  assert.deepEqual(f.components, ["site-chrome", "form-section", "testimonial"]);
  assert.deepEqual(f.files, ["book.tsx"]);
  const blocks = f.directive.split("\n\n## ");
  assert.equal(blocks.length, 6, "the rule, then one block per addition, in run order");
  assert.match(blocks[0], /^## Adding to this site/);
  assert.match(blocks[1], /^The table/);
  assert.match(blocks[2], /^The page/);
  // A LIST KIND FOLDS EVERY ENTRY: two pages are two blocks and two files.
  const two = foldAdds([{ kind: "page", value: cleanAdd("page", [
    { path: "/prices", name: "Prices", purpose: "p", sections: ["a"], components: ["price-list"] },
    { path: "/about", name: "About", purpose: "p", sections: ["b"], components: ["site-chrome"] },
  ], SITE).value }], {}, SITE);
  assert.deepEqual(two.files, ["prices.tsx", "about.tsx"]);
  assert.deepEqual(two.components, ["price-list", "site-chrome"]);
  assert.equal((two.directive.match(/## The page you are adding/g) || []).length, 2);
  // Nothing declared, nothing stored: a site with no parts must not store [].
  const bare = foldAdds([{ kind: "qr", value: { points: "x", label: "y" } }], {}, SITE);
  assert.equal(bare.designed.tsx, undefined);
  assert.equal(bare.designed.tables, undefined);
  assert.deepEqual(bare.components, []);
  // `requirements` JOINED THE FOLD'S ANSWER (owner, 2026-09-13) — hop 4 of the
  // eight. An empty fold carries an empty list, never an absent one, for the
  // reason every other field here is an array: a consumer that has to test for
  // undefined before it can iterate is one that will forget to.
  // `photos` JOINED THE FOLD'S ANSWER (2026-09-17), and it is on the EMPTY
  // shape for the reason `requirements` is: a key that appears only when
  // something was designed makes "nothing was asked for" and "the reader never
  // ran" the same `undefined` at the route, and the route's own shot list is
  // what decides whether the page writer is given tokens at all.
  assert.deepEqual(foldAdds([], null, null), { designed: {}, components: [], directive: "", files: [], requirements: [], photos: [] });
});

test("every refusal token has a sentence of its own, and the already-reply names the door that changes it", () => {
  const tokens = ["page-exists", "no-path", "no-page", "no-plan", "no-component", "no-table", "no-columns", "no-destination", "no-scene",
    // The QR list's own refusals (2026-09-03): a code the site cannot take
    // another of, by name or by destination; a destination a QR may not
    // carry; a caption that yields no name; a site at the ceiling.
    "bad-destination", "no-name", "same-name", "same-code", "too-many",
    // Run 26: a code opening one of the site's own pages — a page it lacks,
    // or an address the route could not read.
    "no-such-page", "no-address",
    // The backend tiers (2026-09-03): a function with no body or return, a
    // connection with no name or a plain-http address, a job with no name
    // or naming a function the site may not run.
    "no-function", "no-api", "bad-url", "no-job", "no-job-fn",
    // A clock time on a job that runs more often than daily (2026-09-03).
    "bad-time"];
  const seen = new Set();
  for (const t of tokens) {
    const s = addRefusal(t, "page");
    assert.ok(s.length > 20 && !seen.has(s), t + ": no sentence of its own");
    assert.notEqual(s, addRefusal("nothing"), t + " falls to the default sentence");
    seen.add(s);
  }
  assert.match(addRefusal("nothing", "page"), /\(page\)/);
  assert.match(addRefusal("no-destination"), /Nothing was changed/);
  assert.match(alreadyReply("three"), /already has a 3D scene/);
  assert.match(alreadyReply("x"), /already has/);
  // NO "ALREADY" SENTENCE FOR A QR CODE (2026-09-03): a site carries several,
  // so a second is an addition and the only refusals are the duplicates
  // `cleanAdd` names. A named sentence here would be a door back to the wall
  // that run 24 measured refusing an honest addition.
  assert.ok(!/QR/.test(alreadyReply("qr")), "a second QR code is refused as 'already' — a site carries several");
  assert.match(addRefusal("same-code"), /already has a QR code pointing there/);
  assert.match(addRefusal("same-name"), /with that name/);
  assert.match(addRefusal("too-many"), /as many QR codes as it can/);
});

// ── THE BACKEND IS THE ADDON'S (owner, 2026-09-03) ──────────────────────────
//
// "the build step doesnt have backend so its gonna be on the addon step if
// needed … if customer touches it then neon db is created". Three more kinds,
// the build's own item shapes by identity, and a site that gets its database
// the first time any of the four is designed for it.
test("the three other tiers are kinds here — the build's own shapes by identity, in run order, on the engine's own floor", async () => {
  for (const k of BACKEND_ADDS) assert.ok(OWN_ADDS.includes(k), k + " is a backend kind this module does not design");
  assert.deepEqual(BACKEND_ADDS, ["table", "function", "api", "job"]);
  assert.deepEqual(BACKEND_KEYS, ["tables", "functions", "apis", "jobs"], "the fold keys are not derived from the kinds");
  // RUN ORDER: a table before the function that reads it, both before the
  // job that runs the function, all before the page that shows them.
  const order = BACKEND_ADDS.map((k) => ADD_KINDS.indexOf(k));
  assert.ok(order.every((i, n) => i >= 0 && (n === 0 || i > order[n - 1])) && order[order.length - 1] < ADD_KINDS.indexOf("page"), "the backend kinds do not run in order, before the page");
  const { tool: build } = await readSchemaTool();
  const backend = build.input_schema.properties.backend.properties;
  for (const [k, item, key] of [["function", FUNCTION_ITEM, "functions"], ["api", API_ITEM, "apis"], ["job", JOB_ITEM, "jobs"]]) {
    assert.equal(addTool(k).input_schema.properties[k].items, item, k + "'s item is not the shared shape");
    assert.deepEqual(backend[key].items, item, "the build tool's " + key + " item is not the shared one — two shapes again");
  }
  // The engine's floor for a job and this module's are one number, and the
  // rule says it.
  assert.equal(MIN_JOB_MINUTES, MIN_EVERY_MINUTES, "the job floor drifted from site-jobs.mjs");
  // ⚠ AND THE CEILING, WHICH MATTERS MORE THAN THE FLOOR. A one-time job's
  // interval is FORCED to this value as a fail-safe: if `spec.on` is ever lost
  // the job degrades to *at most monthly* rather than to whatever the model
  // asked for. If the two numbers drift apart, that fail-safe silently becomes
  // whatever number THIS file happens to hold — which is the runaway the field
  // exists to prevent, arriving through the twin.
  assert.equal(MAX_JOB_MINUTES, MAX_EVERY_MINUTES, "the job ceiling drifted from site-jobs.mjs");
  assert.equal(String(ON_RE), String(JOBS_ON_RE), "the one-time date shape drifted from site-jobs.mjs");
  assert.match(addRule("job"), new RegExp("under " + MIN_JOB_MINUTES + " minutes"), "the job rule does not say the floor");
  // The picker is told a reminder is a job AND a function.
  const desc = pickTool().input_schema.properties.kinds.description;
  assert.match(desc, /is a `job` AND a `function` \(the job runs a function/, "the picker's examples do not say a job needs its function");
  assert.match(desc, /"job" — [^\n]*`job` AND a `function`/, "the job hint does not say so");
});

test("cleanAdd: a function needs a name, a body and a return; a connection an https address; a job a function the site may run", () => {
  const DBF = { ...DB, functions: ["booking_by_claim", "bookings_due_tomorrow"], jobFns: ["bookings_due_tomorrow"] };
  const fn = cleanAdd("function", [
    { name: "Bookings_On_Day", args: [{ name: "d", type: "text" }, { nope: 1 }], returns: "int", body: "SELECT count(*)::int FROM bookings WHERE preferred_day = d" },
    { name: "nobody", returns: "int" },
    { name: "booking_by_claim", args: [{ name: "tok", type: "text" }], returns: "setof bookings", body: "SELECT * FROM bookings WHERE claim_token = tok", internal: true },
  ], DBF);
  assert.equal(fn.ok, true);
  assert.deepEqual(fn.value[0], { name: "bookings_on_day", args: [{ name: "d", type: "text" }], returns: "int", body: "SELECT count(*)::int FROM bookings WHERE preferred_day = d", internal: false, exists: false });
  assert.equal(fn.value[1].exists, true, "a function the site lists is not marked as replaced");
  assert.equal(fn.value[1].internal, true, "a declared `internal: true` did not survive");
  assert.deepEqual(fn.skipped, [{ why: "no-function", name: "nobody" }]);
  // ── RE-ANCHORED 2026-09-14: `internal` IS NO LONGER COERCED ───────────────
  //
  // This case used to hand `internal: "yes"` and assert it came back `false`.
  // That WAS the behaviour and it was the defect: truthy-and-not-`true` created
  // the function PUBLIC — `GRANT EXECUTE … TO anonymous` — on the one field
  // whose whole job is privacy, with `ok` and an empty `skipped`. Refused now,
  // by name, because cannot-tell must never read as the most permissive answer
  // available. `definer: false` is its sibling: a REQUEST for invoker rights
  // that this step cannot express, so it is refused rather than inverted.
  const priv = cleanAdd("function", [
    { name: "reads_private", returns: "int", body: "SELECT 1", internal: "yes" },
    { name: "wants_invoker", returns: "int", body: "SELECT 1", definer: false },
    { name: "plain_one", returns: "int", body: "SELECT 1", internal: true, definer: true },
  ], DBF);
  assert.equal(priv.ok, true, "one unreadable privacy value took the whole answer down");
  assert.deepEqual(priv.value.map((f) => f.name), ["plain_one"], "a refused privacy value was built anyway");
  assert.deepEqual(priv.skipped, [{ why: "bad-internal", name: "reads_private" }, { why: "no-invoker", name: "wants_invoker" }]);
  assert.equal(cleanAdd("function", [{ name: "Bad Name", returns: "int", body: "SELECT 1" }], DBF).why, "no-function");
  assert.equal(cleanAdd("function", [{ name: "twice", returns: "int", body: "SELECT 1" }, { name: "twice", returns: "int", body: "SELECT 2" }], DBF).value.length, 1, "a name repeated in one answer is kept twice");
  const api = cleanAdd("api", [
    { name: "Exchange_Rate", url: "https://api.frankfurter.app/latest?from=GBP&to=EUR", method: "get", params: ["from", "Bad Name"], cacheSeconds: 99999, headers: { Accept: "application/json", nope: 3 } },
    { name: "plain", url: "http://x.test" },
    { name: "posted", url: "https://x.test/graphql", method: "POST", body: "{\"query\":\"{ rates }\"}" },
  ], DBF);
  assert.equal(api.ok, true);
  assert.deepEqual(api.value[0], { name: "exchange_rate", url: "https://api.frankfurter.app/latest?from=GBP&to=EUR", method: "GET", headers: { Accept: "application/json" }, params: ["from"], cacheSeconds: 3600, exists: false });
  assert.equal(api.value[1].body, "{\"query\":\"{ rates }\"}", "a POST body is dropped");
  assert.deepEqual(api.skipped, [{ why: "bad-url", name: "plain" }], "a plain-http service is accepted, or refused under another name");
  assert.equal(cleanAdd("api", [{ name: "x" }], DBF).why, "bad-url");
  assert.equal(cleanAdd("api", [{ url: "https://x.test" }], DBF).why, "no-api");
  const job = cleanAdd("job", [
    { name: "Remind_Tomorrow", fn: "bookings_due_tomorrow", everyMinutes: 5 },
    { name: "bad", fn: "booking_by_claim", everyMinutes: 60 },
    { name: "worse", fn: "nothing", everyMinutes: 60 },
  ], DBF);
  assert.equal(job.ok, true);
  assert.deepEqual(job.value, [{ name: "remind_tomorrow", fn: "bookings_due_tomorrow", everyMinutes: MIN_JOB_MINUTES, exists: false }], "a job under the floor is not raised to it, or a name is not lowered");
  assert.deepEqual(job.skipped.map((s) => s.why), ["no-job-fn", "no-job-fn"], "a job naming a function a visitor could call, or none at all, is kept");
  assert.equal(cleanAdd("job", [{ name: "x", fn: "nothing", everyMinutes: 60 }], DBF).why, "no-job-fn");
  assert.equal(cleanAdd("job", [{ fn: "bookings_due_tomorrow", everyMinutes: 60 }], DBF).why, "no-job");
  // THE SITE'S `jobFns` IS THE ONE LIST A JOB MAY NAME FROM — `functions`
  // alone is not enough, because the engine drops a job on a public function.
  assert.equal(cleanAdd("job", [{ name: "x", fn: "booking_by_claim", everyMinutes: 60 }], { ...DBF, jobFns: [] }).why, "no-job-fn");
  assert.equal(cleanAdd("job", [{ name: "x", fn: "fresh", everyMinutes: 60 }], { ...DBF, jobFns: ["fresh"] }).ok, true, "a builder the route appended after the function designer is refused");
});

test("the note lists each table with its columns, the functions a job may run apart, and says a site with no database gets one on first touch", () => {
  const n = siteNote({ ...DB, tables: ["bookings", "lessons"], columns: { bookings: ["name text", "email text", "preferred_day text"], lessons: "junk" },
    functions: ["booking_by_claim", "bookings_due_tomorrow"], jobFns: ["bookings_due_tomorrow"], apis: ["exchange_rate"], jobs: ["remind_tomorrow"] });
  assert.match(n, /It stores: bookings \(name text, email text, preferred_day text\), lessons\./, "the columns are not printed beside their table");
  assert.match(n, /Its database functions are: booking_by_claim, bookings_due_tomorrow\./);
  assert.match(n, /The functions a scheduled job may run are: bookings_due_tomorrow\./, "the job designer is not told which functions it may name");
  assert.match(n, /Its outside connections are: exchange_rate\./);
  assert.match(n, /Its scheduled jobs are: remind_tomorrow\./);
  assert.match(siteNote(DB), /It stores: bookings\./, "a table with no columns given is not printed bare");
  const none = siteNote(SITE);
  assert.match(none, /NO database yet/);
  assert.match(none, /first table, function, outside connection or scheduled job you design for it creates one/, "the designer is not told a first touch makes the database");
  assert.ok(!/cannot be added/.test(none), "the note still says a table cannot be added to a site with no database");
  assert.ok(!/functions are/.test(siteNote(DB)), "a site with no functions is told it has some");
});

test("the fold carries the three tiers as name-keyed lists; the directive says what a page calls and that a job changes no page; pageless is decided here", () => {
  const DBF = { ...DB, jobFns: ["bookings_due_tomorrow"] };
  const fn = cleanAdd("function", [{ name: "bookings_on_day", args: [{ name: "d", type: "text" }], returns: "int", body: "SELECT 1", internal: false }, { name: "bookings_due_tomorrow", returns: "json", body: "SELECT '[]'::json", internal: true }], DBF).value;
  const api = cleanAdd("api", [{ name: "exchange_rate", url: "https://x.test/r?k={{RATES_KEY}}", params: ["base"] }], DBF).value;
  const job = cleanAdd("job", [{ name: "remind_tomorrow", fn: "bookings_due_tomorrow", everyMinutes: 1440 }], DBF).value;
  const f = foldAdds([{ kind: "function", value: fn }, { kind: "api", value: api }, { kind: "job", value: job }], {}, DBF);
  assert.deepEqual(f.designed.functions, [
    { name: "bookings_on_day", args: [{ name: "d", type: "text" }], returns: "int", body: "SELECT 1", internal: false },
    { name: "bookings_due_tomorrow", args: [], returns: "json", body: "SELECT '[]'::json", internal: true },
  ], "the functions do not reach the spec in the engine's shape, or `internal` is lost");
  assert.deepEqual(f.designed.apis, [{ name: "exchange_rate", url: "https://x.test/r?k={{RATES_KEY}}", method: "GET", params: ["base"] }], "`exists` rides into the spec, or the connection is lost");
  assert.deepEqual(f.designed.jobs, [{ name: "remind_tomorrow", fn: "bookings_due_tomorrow", everyMinutes: 1440 }]);
  assert.equal(f.designed.tables, undefined, "a fold with no table stores one");
  assert.deepEqual(backendDesigned(f.designed), ["functions", "apis", "jobs"]);
  assert.deepEqual(backendDesigned({ tables: [{ name: "x" }], functions: [] }), ["tables"]);
  assert.deepEqual(backendDesigned(null), []);
  assert.match(f.directive, /## The function this change adds\n- `bookings_on_day\(d: text\) -> int` is live in the site's database\. Call it by NAME/, "the page writer is not told the function and the hooks");
  assert.match(f.directive, /`bookings_due_tomorrow\(\) -> json` is live in the site's database, INTERNAL/, "an internal function is offered to the page");
  assert.match(f.directive, /useApi\("exchange_rate", \{ base \}\)/, "the page writer is not told how to read the connection");
  // "every day", not "every 1440 minutes" (2026-09-03, `jobEvery`).
  assert.match(f.directive, /## The scheduled job this change adds\n- `remind_tomorrow` runs `bookings_due_tomorrow\(\)` every day and sends[^\n]*It changes NO page/, "the page writer is told to write a page for a job");
  assert.match(addDirective("function", { name: "f", args: [], returns: "int", exists: true }, DB), /this change replaces/, "a function named again is not said to be replaced");
  // PAGELESS: a job, or internal functions alone, changes no page; anything
  // else does, and nothing at all is not pageless.
  assert.equal(pageless([{ kind: "job", value: job }]), true);
  assert.equal(pageless([{ kind: "function", value: [fn[1]] }, { kind: "job", value: job }]), true);
  assert.equal(pageless([{ kind: "function", value: fn }]), false, "a function a page calls is pageless");
  assert.equal(pageless([{ kind: "api", value: api }, { kind: "job", value: job }]), false, "a connection a page reads is pageless");
  assert.equal(pageless([{ kind: "table", value: [{ table: { name: "t" } }] }]), false);
  assert.equal(pageless([]), false, "nothing to add is pageless — it is `declined`");
  assert.equal(pageless([{ kind: "function", value: [] }]), false);
});

// ── THE WIRING ───────────────────────────────────────────────────────────────

test("THE BACKEND HOPS: the site is described with its columns and tiers, designed functions reach the job designer, the database is made on first touch, the jobs are registered, and a pageless addition answers without a compile", () => {
  const W = blankComments(read("../worker.js"));
  const b = W.slice(at(W, "if (ad) {", "addon"), at(W, "if (tx) {", "addon end"));
  assert.match(W, /import \{[^}]*\bbackendDesigned\b[^}]*\bpageless\b[^}]*\} from "\.\/builder\/site-add\.mjs"/, "the two decisions are not imported");
  assert.match(W, /import \{[^}]*\bnormalizeJob\b[^}]*\} from "\.\/site-jobs\.mjs"/, "the engine's job reader is not imported");
  // THE SITE, as the designers see it: the tables with their columns, the
  // three tiers by name, and the internal functions apart.
  // RE-ANCHORED 2026-09-14, and the rename is the change: the facts are a
  // FUNCTION of a spec now, called once on the frozen baseline and again after
  // every kind on the accumulated proposal. `aSpec` became the parameter for
  // the same reason — reading the baseline here would show the fifth designer
  // the site as it was before the first one ran.
  const site = b.slice(at(b, "const siteFacts = (spec) => ({", "site"), at(b, "hasDatabase: !!adb,", "site end"));
  for (const key of ["columns:", "functions:", "jobFns:", "apis:", "jobs:"]) assert.ok(site.includes(key), "the site note is not handed " + key);
  assert.match(site, /jobFns: \(\(spec && spec\.functions\) \|\| \[\]\)\.filter\(\(f\) => f && f\.name && f\.internal\)/, "`jobFns` is not the INTERNAL functions");
  // …AND WHICH OF THEM THIS MESSAGE IS STILL BUILDING, so a designer can rely
  // on a name AND know it is not there yet. Asserted on the addon block rather
  // than on `site`: that window closes at `hasDatabase`, which sits ABOVE this
  // line — the recorded "a window running to a named neighbour" trap, met
  // writing the assertion rather than reading one.
  assert.match(b, /proposed: \{ \.\.\.aNewNames \}/, "the note cannot tell a stored name from one being added right now");
  assert.match(site, /c\.name \+ \(c\.type \? " " \+ c\.type : ""\)/, "a column is not printed with its type");
  // THE FUNCTION DESIGNER'S ANSWERS REACH THE JOB DESIGNER: appended to the
  // site's lists as they are cleaned, the internal ones to `jobFns`, under
  // the kind's own name.
  // THE ANSWER CARRIES ITS COVERAGE LIST WITH IT (owner, 2026-09-13) — hop 4's
  // input. Anchored on the call's head rather than its whole argument list, the
  // lesson of the `saveAddonAnswer` landmark two hundred lines up.
  const push = at(b, "aAnswers.push({ kind: k, value: clean.value,", "answer kept");
  assert.match(b.slice(push, push + 200), /aAnswers\.push\(\{ kind: k, value: clean\.value, requirements: ran\.requirements \}\);/,
    "the kept answer drops the coverage list the designer answered");
  const feed = b.slice(push, at(b, "await saveAddonAnswer(", "kept replies"));
  // RE-ANCHORED 2026-09-14, AND THE PROPERTY WIDENED RATHER THAN MOVED. This
  // pinned two hand-written pushes gated on `k === "function"` — the only two
  // facts that ever crossed between the kinds' separate model calls, so the
  // `api` designer could not see the table just designed and the `page`
  // designer was handed the STORED site. One accumulation replaces them: the
  // cleaned items fold into the proposal and the facts are rebuilt from it, so
  // EVERY later designer sees everything decided so far — the function reaching
  // the job designer included, which is what these three lines were for.
  assert.match(feed, /aProposed = proposedSpec\(aProposed, k, clean\.value\)/, "a designed item never joins the proposal");
  assert.match(feed, /aSite = siteFacts\(aProposed\)/, "the next designer is not shown what this one designed");
  assert.match(feed, /if \(k === "function" && one\.internal === true && !aNewNames\.jobFns\.includes\(one\.name\)\) aNewNames\.jobFns\.push\(one\.name\)/,
    "an internal function does not join `jobFns`, or a public one does");
  // …AND `jobFns` REMAINS THE INTERNAL ONES ONLY, which is the half a job's
  // cleaner reads: the engine drops a job naming any other function, silently.
  assert.match(site, /jobFns: \(\(spec && spec\.functions\) \|\| \[\]\)\.filter\(\(f\) => f && f\.name && f\.internal\)/,
    "`jobFns` stopped being the internal functions");
  // THE DATABASE ON FIRST TOUCH: any tier designed, no connection → make
  // one, before the schema work, gated under a job, and a failure is ours
  // — named, scrubbed, nothing charged.
  const tiers = at(b, "const aBackend = backendDesigned(aDesigned);", "tiers");
  const prov = at(b, "adb = await ensureSiteBackend(env, ownerSlug, ou.id, aInstruction,", "provision");
  const schema = at(b, "const folded = mergeAddonSchema(", "schema");
  assert.ok(tiers < prov && prov < schema, "the provision is not between the fold and the schema work");
  const gate = b.slice(tiers, prov);
  assert.match(gate, /if \(aBackend\.length\) \{/, "the schema block is not gated on a tier being designed");
  assert.match(gate, /if \(!adb\) \{/, "the provision is not gated on there being no database");
  assert.match(gate, /aJob\.gate\("editing"\)/, "a queued provision is not asked cancel and budget first");
  const fail = b.slice(prov, schema);
  assert.match(fail, /error: "provision", cost: 0, ours: true,/, "a failed provision is not named as ours at no charge");
  assert.match(fail, /stage: \(e && e\.stage\) \|\| null,/, "a failed provision does not say which call failed");
  assert.match(fail, /detail: scrubSecrets\(/, "the detail is not scrubbed");
  assert.match(fail, /status: 502/);
  assert.match(fail, /aSpec = \{ tables: \[\] \};/, "a database just made is not described as empty");
  // RE-ANCHORED, NOT APPEASED (2026-09-15). This was pinned to
  // `let adb = await siteBackendBySlug(env, ownerSlug);` — the SPELLING of a
  // reader that has been replaced. `siteBackendBySlug` collapses four facts
  // into one `null` (run 47's defect) and the route now asks
  // `siteBackendDetail`, which tells them apart and resolves an incomplete
  // reference instead of reporting an empty site.
  //
  // THE PROPERTY IS UNCHANGED AND IS WHAT IS ASSERTED: the connection is a
  // `let`, so the provision below has somewhere to put its answer. Pinned to
  // the declaration itself rather than to which function fills it, which is
  // the "assert the property, not the spelling" rule the old line broke.
  assert.match(b, /\blet adb = aBack\.conn;/, "the connection is not reassignable — the provision's answer has nowhere to go");
  assert.match(b, /const aBack = await siteBackendDetail\(env, ownerSlug\)/,
    "the route no longer asks which of the four backend states this site is in");
  assert.match(b, /if \(aBack\.state === "none"\) aSpec = \{ tables: \[\] \};/,
    "`{tables: []}` is no longer keyed on the ONE state in which it is true");
  // A JOB ON A STORED INTERNAL FUNCTION is re-attached through the engine's
  // own reader, only when the stored function really is internal.
  const norm = at(b, "const merged = normalizeSchema(folded.spec);", "normalize");
  const reattach = b.slice(norm, at(b, "let aSeed = aDesigned.seed;", "seed"));
  assert.match(reattach, /const j = normalizeJob\(raw\);/, "a designed job is not read by the engine's reader");
  assert.match(reattach, /f && f\.internal && String\(f\.name\)\.toLowerCase\(\) === j\.fn/, "a job on a public stored function is re-attached");
  // THE SEED NET ONLY FOR AN ADDED TABLE; the engine's report read for what
  // it made; the jobs registered by the build route's own call.
  const apply = at(b, "aMade = await applySiteSchema(adb, merged);", "apply");
  assert.match(b.slice(norm, apply), /if \(folded\.added\.length\) \{\s*const aTop = await topUpSeed\(/, "the seed net buys rows for a change that added no table");
  const made = b.slice(apply, at(b, "aSeeded = await seedSiteRows(adb, merged, aSeed)", "seeding"));
  assert.match(made, /aFunctions = aNamed\("functions"\)\.filter\(\(n\) => aMadeFns\.includes\(n\)\);/, "the reply names functions the engine did not make");
  assert.match(made, /aFnErrors = Array\.isArray\(aMade && aMade\.functionErrors\)/, "a function the database refused is not carried");
  assert.match(made, /await persistSiteJobs\(env, ou\.id, ownerSlug, merged\.jobs\);/, "the jobs are not registered");
  assert.match(made, /flatMap\(\(a\) => secretsNeeded\(a\)\)/, "the secrets a connection needs are not read");
  // PAGELESS: before the page call, billed through the one charge, answered
  // in the page path's shape. RE-ANCHORED 2026-09-05 (stage 8): the schema
  // work above is a CLOSURE the pageless path runs itself before it answers
  // (`await aApplyBackend(null)`), and the page path runs at the seam — so
  // "after the schema work" is the call inside the pageless block, not the
  // block's position below the closure's text.
  const pl0 = at(b, "if (pageless(aAnswers)) {", "pageless");
  const gen = at(b, "aGen = await generateSitePages(", "page call");
  assert.ok(pl0 > at(b, "aApplyBackend = async (version) => {", "the apply closure") && pl0 < gen, "the pageless answer is not between the apply closure and the page call");
  const pl = b.slice(pl0, gen);
  assert.ok(at(pl, "await aApplyBackend(null)", "the pageless path's own apply") < at(pl, "const aCostNow = ", "the pageless charge"), "the pageless path does not run the schema work before it answers");
  assert.match(pl, /added: \[\], changed: \[\], removed: \[\], moved: \[\],/, "the pageless answer is not in the page path's shape");
  assert.match(pl, /functions: aFunctions, jobs: aJobs,/);
  assert.match(pl, /provisioned: aProvisioned \|\| undefined,/);
  // THE REPLY ON THE PAGE PATH carries the tiers, the errors, the secrets and
  // the provision — absent when none, so an ordinary addon's reply is unchanged.
  const reply = b.slice(at(b, "tables: aTables, altered: aAltered,", "reply"), at(b, "unlinked: unlinkedPages(", "reply end"));
  for (const line of ["functions: aFunctions.length ? aFunctions : undefined,", "apis: aApis.length ? aApis : undefined,", "jobs: aJobs.length ? aJobs : undefined,",
    "functionErrors: aFnErrors.length ? aFnErrors : undefined,", "needsSecrets: aSecrets.length ? aSecrets : undefined,", "provisioned: aProvisioned || undefined,"]) {
    assert.ok(reply.includes(line), "the reply drops: " + line);
  }
});

test("THE ROUTE RUNS THE ADD STEP WHERE IT RAN THE BUILD'S DESIGNER, and folds what the step designed", () => {
  const W = blankComments(read("../worker.js"));
  const b = W.slice(at(W, "if (ad) {", "addon"), at(W, "if (tx) {", "addon end"));
  assert.ok(!/designSiteSchema\(/.test(b), "the addon still calls the build's designer");
  // ── RE-ANCHORED 2026-09-17: `addLayer(` BECAME `addLayerIn(` ─────────────
  //
  // The route asks WHERE THIS KIND'S WORK HAPPENS FOR THIS MESSAGE, which for
  // a `PLACING_ADDS` kind depends on the company it keeps — so the reader took
  // a second argument and the old literal stopped occurring. The property is
  // that the route reaches the module's decision rather than re-deciding, and
  // the stronger form of it is below: all THREE asks go through the one
  // reader, since two of them disagreeing is a kind designed and then reported
  // as skipped, or set aside and never designed.
  for (const fn of ["pickAdds(", "runAdd(", "cleanAdd(", "foldAdds(", "addLayerIn(", "addRefusal(", "alreadyReply("]) assert.ok(b.includes(fn), "the addon does not call " + fn);
  assert.ok(!/\baddLayer\(/.test(b), "the addon asks the kind's own layer somewhere the message decides it");
  assert.equal((b.match(/addLayerIn\(/g) || []).length, 4, "the addon does not ask the one reader at the escalate, the set-aside list and the loop gate");
  assert.match(W, /import \{[^}]*\bpickAdds\b[^}]*\} from "\.\/builder\/site-add\.mjs"/, "a call to a name never imported is a ReferenceError on the addon path");
  // The order: picked, hopped, refused-by-name, designed, cleaned, folded, merged.
  const pick = at(b, "const aPicked = await pickAdds(", "pick");
  const hop = at(b, "if (aHop && aKinds.length === 1) return aEscalate(\"layer\", { layer: addLayerIn(aHop, aKinds), kind: aHop });", "hop");
  // RE-ANCHORED 2026-09-03: the named refusal of a table on a site with no
  // database sat between the hop and the design. The backend is the addon's
  // now and the first tier designed MAKES the database, so what follows the
  // fold is the provision, then the schema work, then the look merge.
  const run = at(b, "const ran = await runAdd(", "run");
  // ⚠ RE-ANCHORED 2026-09-19, and the expectation MOVED rather than broke: the
  // site handed to the cleaner is `aSite` PLUS `today`, the site's own local
  // date, for the one-time job's past-date refusal. `aSite` is rebuilt from the
  // proposal after every kind, so a field stamped inside `siteFacts` would
  // vanish between the first designer and the last — which for that wall means
  // it stands down for every kind but the first. The spread at the call is the
  // fix, and the assertion is that the cleaner still gets the site facts AND
  // gets the date.
  const clean = at(b, "const clean = cleanAdd(k, ran.value, { ...aSite, today: aToday });", "clean");
  const fold = at(b, "const aFold = foldAdds(aAnswers, aLook, aSite);", "fold");
  const designed = at(b, "const aDesigned = aFold.designed;", "designed");
  const prov = at(b, "adb = await ensureSiteBackend(env, ownerSlug, ou.id, aInstruction, (n) => aMark(\"prov:\" + n, \"ok\"));", "provision");
  const schema = at(b, "const folded = mergeAddonSchema(aSpec.tables || [], aDesigned);", "schema");
  const merged = at(b, "const aMerged = mergeLook(aLook, aDesigned, {}, { instructed: true });", "merge");
  assert.ok(pick < hop && hop < run && run < clean && clean < fold && fold < designed && designed < prov && prov < schema && schema < merged, "the addon's steps are out of order");
  assert.ok(!b.includes('error: "no-database"'), "a table is still refused for want of a database — the first backend tier makes one now");
  // Every small call is the picker's model, and every usage rides one bill.
  assert.match(b.slice(pick, hop), /model: aModels\.quick/, "the picker is not on the picked model");
  assert.match(b.slice(run, clean), /model: aModels\.quick/, "an add is not on the picked model");
  assert.match(b.slice(run, clean), /if \(ran\.usage\) aDesignUsage\.push\(ran\.usage\);/, "an add's usage is not billed");
  assert.match(b, /pageCredits\(\.\.\.aDesignUsage, aGen && aGen\.usage, aSeedUsage\)/, "the picker's and the adds' usages are not on the one bill");
  // A cleaner's refusal and a declined step are sentences, never climbs.
  assert.match(b.slice(clean, fold), /addRefusal\(clean\.why, k\)/, "a refused answer is not told to the customer");
  assert.match(b.slice(clean, fold), /if \(!aAnswers\.length\) \{/, "every kind declining is not a named answer");
  assert.match(b, /if \(!aPicked\.kinds\.length\) return aEscalate\("no-add"\)/, "a picker that named nothing does not climb");
  // The page call is told the addition and shown the kit parts' props.
  const gen = at(b, "aGen = await generateSitePages(env, briefWithLayout({", "page call");
  const call = b.slice(gen, b.indexOf("}), aSpec", gen));
  assert.match(call, /brief: aInstruction \+ \(aFold\.directive \? "\\n\\n" \+ aFold\.directive : ""\)/, "the directive does not ride the brief");
  // RE-ANCHORED 2026-09-17, and the expectation is WIDER rather than moved
  // (owner: *"required kit signatures"*). This was pinned to `aFold.components`
  // — the union of what THIS change declares — so a writer editing a page
  // built from `<Accordion>` got that component's props only when the addition
  // happened to name it too. `aPlanComponents` is that union PLUS the kit
  // components the site's existing pages import, and the property is that both
  // sources reach the plan; the spelling of the variable is not the property.
  const plan = call.match(/plan: ([A-Za-z]+)\.length \? \{ components: \1 \} : null/);
  assert.ok(plan, "the kit parts are not handed to the page call: " + call);
  const planBuild = b.slice(b.indexOf("const " + plan[1] + " = "), gen);
  assert.match(planBuild, /aFold\.components/, "the addition's own components do not reach the page call's plan");
  assert.match(planBuild, /pageComponents\(aSrc\)/, "the kit components the site's pages already import do not reach the page call's plan");
  // The reply says what kinds were added and what was set aside — and which
  // entries of a list were left out, with the server's own sentence.
  assert.match(b, /kinds: aAnswers\.map\(\(a\) => a\.kind\), skipped: aSkipped,/, "the reply does not say what was added");
  assert.match(b.slice(clean, fold), /for \(const sk of Array\.isArray\(clean\.skipped\) \? clean\.skipped : \[\]\) aNotAdded\.push\(\{ kind: k, \.\.\.sk, msg: addRefusal\(sk\.why, k\) \}\);/, "an entry left out of a list is not carried to the reply");
  assert.match(b, /notAdded: aNotAdded\.length \? aNotAdded\.slice\(0, 6\) : undefined,/, "the reply does not say which entries were left out");
  // The model-down answer is the edit route's: billing is ours, a timeout is ours.
  const down = b.slice(at(b, "const aDown = (e, what) => {", "down"), pick);
  assert.match(down, /isCallTimeout\(e\)/); assert.match(down, /k\.billing/); assert.match(down, /status: 503/);
});

// ── A CLOCK TIME ON A JOB (owner, 2026-09-03) ───────────────────────────────
//
// "Every day at nine" was "every 1440 minutes from whenever it was added".
// The designer answers `at`; the zone is the owner's browser's, read by the
// route and stamped on the cleaned job; the fold carries both to the engine.
test("a job's clock time is cleaned, refused off a faster job, folded with the zone the route stamps, and said in words", () => {
  assert.equal(String(AT_RE), String(JOBS_AT_RE), "the clock-time shape drifted from site-jobs.mjs");
  const DBF = { ...DB, functions: ["due"], jobFns: ["due"] };
  const c = cleanAdd("job", [
    { name: "remind", fn: "due", everyMinutes: 1440, at: "09:00" },
    { name: "hourly", fn: "due", everyMinutes: 60, at: "09:00" },
    { name: "junk", fn: "due", everyMinutes: 1440, at: "9am" },
    { name: "plain", fn: "due", everyMinutes: 60 },
  ], DBF);
  assert.deepEqual(c.value, [{ name: "remind", fn: "due", everyMinutes: 1440, at: "09:00", exists: false }, { name: "plain", fn: "due", everyMinutes: 60, exists: false }]);
  assert.deepEqual(c.skipped, [{ why: "bad-time", name: "hourly" }, { why: "bad-time", name: "junk" }], "a time on an hourly job, or an unreadable time, is kept or dropped silently");
  assert.match(addRefusal("bad-time"), /once a day or less often/);
  assert.ok(!Object.hasOwn(c.value[0], "tz"), "this module invented a zone — only the route knows it");
  // The route stamps the zone; the fold carries both to the engine.
  const stamped = c.value.map((j) => (j.at ? { ...j, tz: "Europe/London" } : j));
  const f = foldAdds([{ kind: "job", value: stamped }], {}, DBF);
  assert.deepEqual(f.designed.jobs, [{ name: "remind", fn: "due", everyMinutes: 1440, at: "09:00", tz: "Europe/London" }, { name: "plain", fn: "due", everyMinutes: 60 }]);
  assert.match(f.directive, /`remind` runs `due\(\)` every day at 09:00 \(Europe\/London\) and sends/, "the page writer is not told the clock time");
  assert.equal(jobEvery({ everyMinutes: 1440, at: "09:00", tz: "Europe/London" }), "every day at 09:00 (Europe/London)");
  assert.equal(jobEvery({ everyMinutes: 10080 }), "every week");
  assert.equal(jobEvery({ everyMinutes: 2880, at: "18:30" }), "every 2 days at 18:30");
  assert.equal(jobEvery({ everyMinutes: 45 }), "every 45 minutes");
  assert.equal(jobEvery({ everyMinutes: 1440, at: "9am" }), "every day", "an unreadable time is said");
  // The shape offers it, the rule says it.
  assert.equal(JOB_ITEM.properties.at.type, "string");
  assert.match(addRule("job"), /`at` for the time of day/, "the job rule does not mention the clock time");
  // THE ROUTE: the zone read from the post through Intl, stamped on jobs with
  // a time as they are cleaned, and carried to the reply.
  const W = blankComments(read("../worker.js"));
  const b = W.slice(at(W, "if (ad) {", "addon"), at(W, "if (tx) {", "addon end"));
  assert.match(b, /const aTz = validTimeZone\(ab && ab\.tz\);/, "the owner's zone is not read from the post");
  assert.match(b, /if \(k === "job" && aTz\) \{\s*for \(const j of Array\.isArray\(clean\.value\) \? clean\.value : \[\]\) if \(j && j\.at\) j\.tz = aTz;/, "a job with a time is not stamped with the zone");
  assert.match(b, /\.\.\.\(j\.at \? \{ at: j\.at, tz: j\.tz \|\| null \} : \{\}\)/, "the reply drops the clock time");
  assert.match(W, /import \{[^}]*\bvalidTimeZone\b[^}]*\} from "\.\/site-jobs\.mjs"/, "validTimeZone is not imported");
});

// ── THE ADD STEP'S OWN REPAIR (owner, 2026-09-04: "each path has a repair path") ──
//
// "Try to fix it, if not fix, send as it is." Run 34's gear addon published a
// page the render check had just watched crash. The round is the ADD step's
// own — its wording, scoped to the pages the addition wrote — and shares only
// the tweak rung's mechanism with the build's pass. Driven here with fakes.

const REPAIR = await import("../builder/site-add.mjs");
const { readPage } = await import("../builder/site-render.mjs");
const { REPAIR_RULES } = await import("../builder/site-repair.mjs");
const { TWEAK_RULES, MAX_TWEAK_CHARS } = await import("../builder/site-tweak.mjs");
const rPage = (path, extra = "") => ({
  path,
  source: `import { createFileRoute } from "@tanstack/react-router";\n` +
    `export const Route = createFileRoute("${path === "index.tsx" ? "/" : "/" + path.replace(/\.tsx$/, "")}")({ component: P });\n` +
    `function P() { return <div><h1>Crookes Guitar School</h1><p>Second-hand guitars.</p>${extra}</div>; }\n`,
});
const rCrash = (route = "/gear", viewport = "desktop") => readPage({
  route, viewport, text: 109, images: 0, crashed: true,
  consoleErrors: ["Error: useFormField should be used within <FormItem>"],
});
const rReply = (source) => ({ content: [{ type: "tool_use", input: { source } }], usage: { input_tokens: 10, output_tokens: 20 } });
const rFixed = (p) => p.source.replace("<p>Second-hand guitars.</p>", "<div><p>Second-hand guitars.</p></div>");
const LANGS = [{ tag: "en", prefix: "", primary: true }, { tag: "es", prefix: "es" }, { tag: "fr", prefix: "fr" }];

test("the add step's repair rules are its OWN wording — not the build's, not the tweak lane's — and say what the shared guards enforce", () => {
  assert.notEqual(REPAIR.ADD_REPAIR_RULES, REPAIR_RULES, "the add step's repair reuses the build's wording");
  assert.notEqual(REPAIR.ADD_REPAIR_RULES, TWEAK_RULES);
  assert.match(REPAIR.ADD_REPAIR_RULES, /ADDITION/, "the rule does not say this is an addition to a live site");
  assert.match(REPAIR.ADD_REPAIR_RULES, /design system/, "the add step's universal rule is missing from its repair");
  assert.match(REPAIR.ADD_REPAIR_RULES, /DO NOT CHANGE ANY OF THE WORDS/);
  assert.match(REPAIR.ADD_REPAIR_RULES, /createFileRoute/);
  assert.match(REPAIR.ADD_REPAIR_RULES, /`cannot`/);
  assert.match(REPAIR.ADD_REPAIR_RULES, /watched happening in a browser/i);
  assert.equal(REPAIR.MAX_ADD_REPAIRS, 3);
});

test("addRepairBrief: only the pages this addition wrote, only serious findings, a variant's crash is its primary page's", () => {
  const pages = [rPage("index.tsx"), rPage("gear.tsx"), rPage("prices.tsx")];
  // Run 34's report as the reply carried it: the variants threw, the primary route was not in the (partial) report.
  const findings = [...rCrash("/es/gear", "phone"), ...rCrash("/fr/gear", "phone"), ...rCrash("/es", "phone")];
  const b = REPAIR.addRepairBrief({ ok: true, findings }, pages, { langs: LANGS, touched: ["gear.tsx", "index.tsx"] });
  assert.deepEqual(b.work.map((w) => w.path).sort(), ["gear.tsx", "index.tsx"]);
  assert.equal(b.work.find((w) => w.path === "gear.tsx").route, "/gear", "the route handed to the model is the primary one");
  assert.equal(b.work.find((w) => w.path === "gear.tsx").instruction.match(/useFormField/g).length, 1, "two variants of one crash are one sentence");
  // A page the addition did not touch is NOT this step's to rewrite, however broken.
  const notMine = REPAIR.addRepairBrief({ ok: true, findings: rCrash("/prices") }, pages, { langs: LANGS, touched: ["gear.tsx"] });
  assert.equal(notMine.work.length, 0, "the round rewrote a page the addition did not write");
  // `src/routes/` on either side is forgiven — the paths meet as bare names.
  assert.equal(REPAIR.addRepairBrief({ ok: true, findings: rCrash("/gear") }, pages, { touched: ["src/routes/gear.tsx"] }).work.length, 1);
  // No `touched` list at all means every page is in scope (a caller that has none).
  assert.equal(REPAIR.addRepairBrief({ ok: true, findings: rCrash("/prices") }, pages, {}).work.length, 1);
  // Only serious kinds buy a call; a check that could not run buys nothing.
  for (const kind of ["logged", "contrast", "overflow", "image"]) {
    assert.equal(REPAIR.addRepairBrief({ ok: true, findings: [{ route: "/gear", viewport: "desktop", kind, detail: "x" }] }, pages, { touched: ["gear.tsx"] }).work.length, 0, kind);
  }
  assert.equal(REPAIR.addRepairBrief({ ok: false, findings: rCrash("/gear") }, pages, { touched: ["gear.tsx"] }).work.length, 0);
  assert.equal(REPAIR.addRepairBrief(null, pages, { touched: ["gear.tsx"] }).work.length, 0);
  // The cap, and what it dropped.
  const many = ["a", "b", "c", "d"].map((n) => rPage(`${n}.tsx`));
  const capped = REPAIR.addRepairBrief({ ok: true, findings: many.flatMap((p) => rCrash("/" + p.path.replace(/\.tsx$/, ""))) }, many, { touched: many.map((p) => p.path) });
  assert.equal(capped.work.length, REPAIR.MAX_ADD_REPAIRS);
  assert.equal(capped.dropped, 1);
  // The instruction says it is the addition's page, and carries the detail whole.
  assert.match(REPAIR.addRepairInstruction(new Set(["threw"]), ["Error: useFormField should be used within <FormItem>"]), /addition wrote and it crashed[\s\S]*useFormField should be used within <FormItem>/);
  assert.match(REPAIR.addRepairInstruction(new Set(["blank"]), []), /nothing rendered/);
});

test("addRepairRound: no report, clean, no room and no deps each answer by name and spend NOTHING", async () => {
  const pages = [rPage("gear.tsx")];
  let sent = 0, compiled = 0;
  const send = async () => { sent++; return rReply(rFixed(pages[0])); };
  const compile = async () => { compiled++; return { ok: true, files: {} }; };
  const t = ["gear.tsx"];
  assert.equal((await REPAIR.addRepairRound({ report: null, pages, touched: t, send, compile })).why, "no-report");
  assert.equal((await REPAIR.addRepairRound({ report: { ok: false, findings: rCrash() }, pages, touched: t, send, compile })).why, "no-report");
  assert.equal((await REPAIR.addRepairRound({ report: { ok: true, findings: [] }, pages, touched: t, send, compile })).why, "clean");
  const time = await REPAIR.addRepairRound({ report: { ok: true, findings: rCrash() }, pages, touched: t, send, compile, room: false });
  assert.equal(time.ran, false);
  assert.equal(time.why, "time");
  assert.deepEqual(time.routes, ["/gear"], "a round there was no time for names the page it would have fixed");
  assert.equal((await REPAIR.addRepairRound({ report: { ok: true, findings: rCrash() }, pages, touched: t })).why, "no-deps");
  assert.equal(sent + compiled, 0, "an answer that did not run spent something");
});

test("addRepairRound: a fix that compiles is what ships, on the add step's own rules and the picked model", async () => {
  const pages = [rPage("index.tsx"), rPage("gear.tsx")];
  const want = rFixed(pages[1]);
  const seen = [];
  const compiled = [];
  const out = await REPAIR.addRepairRound({
    report: { ok: true, findings: rCrash("/es/gear", "phone") }, pages, touched: ["gear.tsx"], langs: LANGS,
    send: async (req) => { seen.push(req); return rReply(want); }, model: "sentinel-quick",
    compile: async (list) => { compiled.push(list); return { ok: true, files: { "index.html": { t: "<build-2>" } }, render: { ok: true, findings: [] } }; },
  });
  assert.equal(out.ran, true);
  assert.deepEqual(out.repaired, ["/gear"]);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].system, REPAIR.ADD_REPAIR_RULES, "the request does not carry the add step's own rules");
  assert.equal(seen[0].model, "sentinel-quick", "the request does not ride the picked model");
  assert.match(seen[0].messages[0].content, /^WHAT WENT WRONG ON THE ADDITION\n/);
  assert.equal(compiled.length, 1, "the corrected list was compiled once");
  assert.equal(compiled[0][1].source, want, "…and it was the FIXED source that was compiled");
  assert.equal(compiled[0][0], pages[0], "the untouched page is the same object");
  assert.equal(out.built.files["index.html"].t, "<build-2>", "the second build is what ships");
  assert.equal(out.pages[1].source, want, "…and the fixed pages are what is stored");
  assert.equal(out.usage.length, 1, "the call is charged for");
});

test("addRepairRound: a fix that does not compile ships the ORIGINAL and says so; a refused fix compiles nothing; nothing escapes", async () => {
  const pages = [rPage("gear.tsx")];
  const t = ["gear.tsx"];
  const held = await REPAIR.addRepairRound({
    report: { ok: true, findings: rCrash() }, pages, touched: t,
    send: async () => rReply(rFixed(pages[0])), compile: async () => ({ ok: false, stage: "typecheck", error: "the repair broke it" }),
  });
  assert.equal(held.ran, true);
  assert.equal(held.built, null, "a broken repair must never replace a build that worked");
  assert.equal(held.pages, null, "…nor be stored for the next revise to inherit");
  assert.equal(held.failed, "typecheck");
  assert.deepEqual(held.repaired, ["/gear"]);
  assert.equal(held.usage.length, 1);
  let compiled = 0;
  const refused = await REPAIR.addRepairRound({
    report: { ok: true, findings: rCrash() }, pages, touched: t,
    send: async () => rReply(pages[0].source.replace("Second-hand guitars.", "Used guitars.")),
    compile: async () => { compiled++; return { ok: true, files: {} }; },
  });
  assert.equal(refused.built, null);
  assert.equal(refused.failed, "refused");
  assert.equal(refused.refused[0].route, "/gear");
  assert.equal(compiled, 0, "nothing to compile when every fix was refused");
  assert.equal(refused.usage.length, 1, "the refused call still cost");
  const big = rPage("gear.tsx"); big.source += "x".repeat(MAX_TWEAK_CHARS);
  let calls = 0;
  const tooBig = await REPAIR.addRepairRound({ report: { ok: true, findings: rCrash() }, pages: [big], touched: t, send: async () => { calls++; return rReply("x"); }, compile: async () => ({ ok: true, files: {} }) });
  assert.equal(calls, 0, "a page too large to send cheaply was paid for");
  assert.equal(tooBig.refused[0].reason, "too-big");
  for (const bad of [
    { send: async () => { throw new Error("provider down"); }, compile: async () => ({ ok: true, files: {} }) },
    { send: async () => rReply(rFixed(pages[0])), compile: async () => { throw new Error("container gone"); } },
  ]) {
    const out = await REPAIR.addRepairRound({ report: { ok: true, findings: rCrash() }, pages, touched: t, ...bad });
    assert.equal(out.ran, true);
    assert.equal(out.built, null, "the original build stands");
  }
});

test("addRepairNote: quiet on a fix that held; a fix there was no time for, or that did not hold, is said with the page", () => {
  assert.equal(REPAIR.addRepairNote(null), "");
  assert.equal(REPAIR.addRepairNote({ ran: false, why: "clean" }), "");
  assert.equal(REPAIR.addRepairNote({ ran: false, why: "no-report" }), "");
  assert.equal(REPAIR.addRepairNote({ ran: true, built: { files: {} }, repaired: ["/gear"], refused: [] }), "", "a page that needed a second pass and got one is our business");
  const time = REPAIR.addRepairNote({ ran: false, why: "time", routes: ["/gear"] });
  assert.match(time, /\/gear/); assert.match(time, /published as it is/); assert.match(time, /time/);
  const held = REPAIR.addRepairNote({ ran: true, built: null, failed: "typecheck", repaired: ["/gear"], refused: [] });
  assert.match(held, /\/gear/); assert.match(held, /didn't hold/); assert.match(held, /published as it was/);
  const refusedOnly = REPAIR.addRepairNote({ ran: true, built: null, failed: "refused", repaired: [], refused: [{ route: "/gear", reason: "reworded" }] });
  assert.match(refusedOnly, /\/gear/);
  const mixed = REPAIR.addRepairNote({ ran: true, built: { files: {} }, repaired: ["/gear"], refused: [{ route: "/prices", reason: "cannot" }] });
  assert.match(mixed, /\/prices/); assert.doesNotMatch(mixed, /\/gear/); assert.match(mixed, /published as it is/);
});

// ─────────────────────────────────────────────────────────────────────────────
// THE PLANNED-ROUTE HAND-OFF, AT THE MODULE (2026-09-17)
//
// The route-level demonstrations are in `test/addon-route.test.mjs`, where each
// of these is driven through `POST /api/site/<slug>/addon`. These are the
// branches a route case cannot separate — the shortcut's own boundary, the
// second-add refusal, and the two halves of the note — every one a survivor of
// the first mutation pass rather than a case written from the code.
// ─────────────────────────────────────────────────────────────────────────────

test("a page this change is adding is a destination, is not a page the site HAS, and cannot be added twice", () => {
  const ADDING = { ...SITE, planned: [{ path: "/gallery", name: "Gallery" }] };
  const on = (page, site) => cleanAdd("component", [{ page, does: "a caption", components: ["card"] }], site);

  // THE ONE-PAGE SHORTCUT READS THE SITE AS IT WILL BE, not as it is. Its whole
  // justification is "there is exactly one place this can go", which expires
  // the instant this same change adds a second page — the recorded "a rule true
  // because of a layer below it expires when that layer moves", where the layer
  // is this message's own earlier designer.
  assert.equal(on("", SITE).value[0].page, "/", "a site really adding nothing lost the shortcut");
  assert.equal(on("", ADDING).why, "no-page", "an unplaced section landed on the home page of a site that is growing a second one");
  assert.equal(on("", { ...MULTI, planned: [] }).why, "no-page", "the multi-page refusal moved");

  // A PLANNED ROUTE IS A DESTINATION, and one nobody is adding still is not.
  assert.equal(on("/gallery", ADDING).value[0].page, "/gallery");
  assert.equal(on("/gallery", SITE).why, "no-page");
  assert.equal(on("/prices", ADDING).why, "no-page", "any route at all became a destination");

  // …AND IT IS STILL NOT A PAGE THE SITE HAS: adding it a second time is the
  // same refusal as adding one that is already live.
  const pg = (path) => cleanAdd("page", [{ path, name: "G", purpose: "show the work", sections: ["a grid"] }], ADDING);
  assert.equal(pg("/gallery").why, "page-exists", "a page this change already plans could be made a second time");
  assert.equal(pg("/prices").ok, true, "a route nobody has and nobody is adding stopped being addable");

  // THE SHAPE IS TOLERANT AT THE EDGES, because the route hands `{path, name}`
  // and a caller with only routes is a legitimate reading of the same fact.
  assert.equal(on("/gallery", { ...SITE, planned: ["/gallery"] }).value[0].page, "/gallery");
  assert.equal(on("/gallery", { ...SITE, planned: [null, 7, {}, { path: "" }] }).why, "no-page");
});

test("the note says a planned page is coming, never that it is there, and tells written components from declared ones", () => {
  const coming = siteNote({ name: "Fretwork", pages: ["/"], labels: { "/": "Guitar repairs" },
    planned: [{ path: "/gallery", name: "Gallery" }] });
  // TWO LINES, AND THE FIRST IS THE SITE AS IT IS. Folding the planned page in
  // would send a designer looking for source that does not exist yet.
  assert.match(coming, /^Its pages are: \/ \("Guitar repairs"\)\.$/m, coming);
  assert.match(coming, /^This same change is ALSO adding a page, which do(es)? not exist yet: \/gallery \("Gallery"\)\./m, coming);
  assert.doesNotMatch(coming, /^Its pages are: [^\n]*gallery/m, "the planned page was presented as one the site has");
  // A SITE ADDING NOTHING READS EXACTLY AS IT ALWAYS DID.
  assert.doesNotMatch(siteNote({ name: "Fretwork", pages: ["/"] }), /ALSO adding/);
  assert.doesNotMatch(siteNote({ name: "Fretwork", pages: ["/"], planned: [{ path: "/" }] }), /ALSO adding/,
    "a planned route the site already has was announced as new");

  // ── WRITTEN VERSUS DECLARED ─────────────────────────────────────────────
  //
  // `tsx` is the cumulative DECLARATION list and says nothing about whether
  // anything was ever written; `parts` is what has a file. Three states, and
  // the third is why `null` is not `[]`.
  const both = siteNote({ name: "F", pages: ["/"],
    tsx: [{ name: "tide-chart" }, { name: "catch-log" }], parts: [{ name: "tide-chart" }] });
  assert.match(both, /already written: tide-chart/, both);
  assert.match(both, /nothing has written yet: catch-log/, both);
  assert.doesNotMatch(both, /already written: [^\n;]*catch-log/, "a declaration with no file was called written");
  assert.doesNotMatch(both, /nothing has written yet: [^\n;]*tide-chart/, "a component with a file was called unwritten");
  // A READ THAT FAILED IS NOT A SITE WITH NO COMPONENTS: `null` leaves the old
  // sentence, which is what every caller that passes no `parts` gets.
  assert.match(siteNote({ name: "F", pages: ["/"], tsx: [{ name: "tide-chart" }] }), /parts written for it: tide-chart/);
  assert.match(siteNote({ name: "F", pages: ["/"], tsx: [{ name: "tide-chart" }], parts: null }), /parts written for it: tide-chart/,
    "a failed parts read was reported as a site with no components of its own");
  assert.match(siteNote({ name: "F", pages: ["/"], tsx: [{ name: "tide-chart" }], parts: [] }), /nothing has written yet: tide-chart/,
    "a site that really has no component files was not said to have none");

  // AND THE LOOK IT IS WEARING, in names — the thing every add rule tells a
  // designer to keep and nothing in its inputs used to state.
  const look = siteNote({ name: "F", pages: ["/"], theme: "harbour-slate", css: true });
  assert.match(look, /Its theme is harbour-slate/, look);
  assert.match(look, /stylesheet written for it/, look);
  assert.doesNotMatch(siteNote({ name: "F", pages: ["/"] }), /Its theme is/);
  assert.doesNotMatch(siteNote({ name: "F", pages: ["/"], theme: "harbour-slate" }), /stylesheet written for it/);
});

// ── A NEW QR CODE OUTLIVING THE PAGE IT OPENS (2026-09-17) ──────────────────
test("deadQrs drops only a code THIS change added that opens a page THIS change lost", () => {
  const URL_ = "https://fretwork-1.gofarther.app";
  const code = (name, path) => ({ name, points: URL_ + path, label: name });
  const at = (...codes) => ({ qr: codes, url: URL_ + "/" });

  // THE CASE ITSELF: a code added by this change, pointing at a route this
  // change planned and did not ship.
  const gone = deadQrs({ ...at(code("gallery", "/gallery")), prior: [], missing: ["/gallery"], wrote: [] });
  assert.deepEqual(gone.qr, [], "the dead code was published");
  assert.deepEqual(gone.dropped, [{ name: "gallery", route: "/gallery" }]);
  assert.deepEqual(gone.withheld, []);

  // A CODE THE SITE ALREADY HAD IS NOT THIS CHANGE'S TO REMOVE, whatever it
  // opens. `prior` is the whole of that test, and it is by NAME because that is
  // what identifies a code — `cleanAdd` refuses a second code of the same name.
  const old = deadQrs({ ...at(code("gallery", "/gallery")), prior: [code("gallery", "/gallery")], missing: ["/gallery"], wrote: [] });
  assert.deepEqual(old.qr.map((c) => c.name), ["gallery"], "a code the site already had was taken away");
  assert.deepEqual(old.dropped, []);

  // A CODE OPENING A PAGE THAT SHIPPED, and one opening a page nobody planned
  // — neither is a candidate, and the second is the control that `missing` is
  // really what decides rather than "this change added a code".
  assert.deepEqual(deadQrs({ ...at(code("menu", "/menu")), prior: [], missing: ["/gallery"], wrote: [] }).dropped, []);
  assert.deepEqual(deadQrs({ ...at(code("gallery", "/gallery")), prior: [], missing: [], wrote: [] }).dropped, []);

  // ANOTHER SITE'S ADDRESS IS NOT OUR ROUTE. The path matches and the origin
  // does not, so nothing is dropped — which is why the origin is compared and
  // not just the pathname.
  const away = deadQrs({ qr: [{ name: "gallery", points: "https://example.com/gallery", label: "x" }], prior: [], missing: ["/gallery"], wrote: [], url: URL_ + "/" });
  assert.deepEqual(away.dropped, [], "a code pointing at somebody else's site was dropped");

  // AND A PAYLOAD THAT IS NOT A PAGE AT ALL. `tel:` and `WIFI:` parse as URLs
  // with a pathname, and reading one of those as a route is how a code nobody
  // asked about disappears.
  for (const points of ["tel:+441234567890", "WIFI:S:Fretwork;T:WPA;P:hello;;", "mailto:hi@fretwork.test", "not a url"]) {
    const r = deadQrs({ qr: [{ name: "c", points, label: "x" }], prior: [], missing: ["/gallery", "/c"], wrote: [], url: URL_ + "/" });
    assert.deepEqual(r.dropped, [], "a " + points.slice(0, 8) + " code was read as a route");
    assert.deepEqual(r.qr.map((c) => c.name), ["c"]);
  }

  // WITH NO ADDRESS NOTHING IS DROPPED, which is the fail-safe direction: we
  // cannot tell whose page a URL names without knowing our own origin, and a
  // code removed on a guess cannot be put back by the customer.
  assert.deepEqual(deadQrs({ qr: [code("gallery", "/gallery")], prior: [], missing: ["/gallery"], wrote: [] }).dropped, []);

  // NOTHING TO DO IS THE ORDINARY ANSWER, and it hands the list straight back.
  assert.deepEqual(deadQrs().qr, []);
  assert.deepEqual(deadQrs({ ...at(code("a", "/a")), missing: [] }).qr.map((c) => c.name), ["a"]);
});

test("a page THIS change wrote that renders a dropped code is withheld with it", () => {
  // ⚠ THIS CASE IS THE OPPOSITE OF THE ONE IT REPLACES, which read "deadQrs
  // keeps a code a shipped page really renders, and says so instead" and
  // ASSERTED THE DEFECT AS CORRECT (owner, 2026-09-17: *"A warning does not
  // complete the dependency."*). Keeping the code shipped a printed thing that
  // opens nothing, beside a sentence asking the customer not to print it.
  const URL_ = "https://fretwork-1.gofarther.app";
  const qr = [{ name: "gallery", points: URL_ + "/gallery", label: "Our gallery" }];
  const page = (source, added) => [{ path: "index.tsx", source, added }];
  const shows = page("export default () => <img src={SITE_QRS.gallery.src} />");
  const blank = page("export default () => <main/>");

  // THE CODE GOES, AND THE PAGE GOES WITH IT — a CHANGED page reverts, so the
  // entry says `added: false` and the route restores the stored source.
  const held = deadQrs({ qr, prior: [], missing: ["/gallery"], wrote: shows, url: URL_ + "/" });
  assert.deepEqual(held.qr, [], "the code a page renders was published anyway");
  assert.deepEqual(held.dropped, [{ name: "gallery", route: "/gallery" }]);
  assert.deepEqual(held.withheld, [{ path: "index.tsx", added: false }]);

  // AND THE CONTROL, which is what makes the line above about the reference
  // rather than about the code: same code, same missing page, a page that does
  // not mention it — dropped, and nothing withheld.
  const drop = deadQrs({ qr, prior: [], missing: ["/gallery"], wrote: blank, url: URL_ + "/" });
  assert.deepEqual(drop.dropped, [{ name: "gallery", route: "/gallery" }]);
  assert.deepEqual(drop.withheld, [], "a page that never mentions the code was withheld");

  // THE REFERENCE READER IS `qrUnplaced`'s, INVERTED — one binding regex on the
  // platform, not two — so the bracket form counts exactly as the dot form does.
  const bracket = page("export default () => <img src={SITE_QRS['gallery'].src} />");
  assert.deepEqual(deadQrs({ qr, prior: [], missing: ["/gallery"], wrote: bracket, url: URL_ + "/" }).withheld.length, 1);

  // ⚠ A `source` THAT IS NOT A STRING IS NOT A PAGE THAT RENDERS ANYTHING, and
  // this is drivable rather than defensive: `qrUnplaced` reads
  // `String((p && p.source) || "")`, and `String(["SITE_QRS.gallery"])` is the
  // bare string — this repository's own recorded `String(["a"]) === "a"` trap.
  // MEASURED over six shapes: five agree either way and this one does not, so
  // without the filter an entry whose source is an ARRAY reads as a page
  // rendering the code and its page is withheld for nothing.
  const arr = deadQrs({ qr, prior: [], missing: ["/gallery"], url: URL_ + "/",
    wrote: [{ path: "index.tsx", source: ["SITE_QRS.gallery"] }] });
  assert.deepEqual(arr.withheld, [], "a non-string source was coerced into a page that renders the code");
  assert.deepEqual(arr.dropped, [{ name: "gallery", route: "/gallery" }], "the code itself still goes");

  // A PAGE THIS CHANGE INVENTED IS MARKED AS ONE, because withholding it means
  // something different — it does not go out at all, and its route goes with it.
  const made = deadQrs({ qr, prior: [], missing: ["/gallery"], wrote: page("<img src={SITE_QRS.gallery.src}/>", true), url: URL_ + "/" });
  assert.deepEqual(made.withheld, [{ path: "index.tsx", added: true }]);

  // …AND THAT IS WHAT MAKES THE CASCADE REAL, which is why this is a fixed
  // point and not a pass: withholding an ADDED page takes its route away, so a
  // SECOND code pointing at that route dies too, and a third page rendering
  // THAT code is withheld in turn. `MAX_QRS` is 6, so the chain is
  // constructible rather than hypothetical.
  const chain = deadQrs({
    qr: [{ name: "gallery", points: URL_ + "/gallery", label: "a" }, { name: "posters", points: URL_ + "/posters", label: "b" }],
    prior: [], missing: ["/gallery"], url: URL_ + "/",
    wrote: [
      { path: "posters.tsx", source: "<img src={SITE_QRS.gallery.src}/>", added: true },
      { path: "flyer.tsx", source: "<img src={SITE_QRS.posters.src}/>", added: true },
    ],
  });
  assert.deepEqual(chain.dropped.map((d) => d.name).sort(), ["gallery", "posters"],
    "the second code survived a page that is no longer there: " + JSON.stringify(chain.dropped));
  assert.deepEqual(chain.withheld.map((w) => w.path).sort(), ["flyer.tsx", "posters.tsx"],
    "the cascade stopped after one round: " + JSON.stringify(chain.withheld));

  // ⚠ AND THE LEGACY `SITE_QR` BINDING BELONGS TO THE FIRST CODE ONLY, which is
  // why `qrUnplaced` is asked with the WHOLE list one page at a time rather than
  // with a one-element list per code: its legacy arm is keyed on a code's INDEX,
  // so a one-code list makes every code look like the first. MEASURED on a page
  // carrying a bare `SITE_QR`: the real reading answers ["gallery"] and the
  // one-at-a-time reading answers ["gallery","posters"] — a second code read as
  // rendered, and its page withheld over a binding that is not its.
  const two = [{ name: "gallery", points: URL_ + "/gallery", label: "a" }, { name: "posters", points: URL_ + "/posters", label: "b" }];
  const bare = [{ path: "flyer.tsx", source: "export default () => <img src={SITE_QR.src} />", added: false }];
  const legacy = deadQrs({ qr: two, prior: [], missing: ["/posters"], wrote: bare, url: URL_ + "/" });
  assert.deepEqual(legacy.dropped, [{ name: "posters", route: "/posters" }], "the second code survived its missing page");
  assert.deepEqual(legacy.withheld, [],
    "a page carrying the FIRST code's legacy binding was withheld over the second: " + JSON.stringify(legacy.withheld));
  // …AND THE CONTROL, so the line above is about the INDEX and not about the
  // legacy form being unreadable: the same page, with the FIRST code dropped.
  const legacyFirst = deadQrs({ qr: two, prior: [], missing: ["/gallery"], wrote: bare, url: URL_ + "/" });
  assert.deepEqual(legacyFirst.withheld, [{ path: "flyer.tsx", added: false }],
    "the legacy binding is not read at all, so the control proves nothing");

  // A CHANGED PAGE DOES NOT BREAK THE CHAIN, and that is the other half of the
  // same rule: it reverts to a version the site is already serving, so its
  // route is still there and a code pointing at it is untouched.
  const kept = deadQrs({
    qr: [{ name: "gallery", points: URL_ + "/gallery", label: "a" }, { name: "posters", points: URL_ + "/posters", label: "b" }],
    prior: [], missing: ["/gallery"], url: URL_ + "/",
    wrote: [{ path: "posters.tsx", source: "<img src={SITE_QRS.gallery.src}/>", added: false }],
  });
  assert.deepEqual(kept.dropped.map((d) => d.name), ["gallery"], "a reverted page's route was treated as gone");
  assert.deepEqual(kept.qr.map((c) => c.name), ["posters"]);
});

test("a CUSTOM COMPONENT that renders a dropped code is withheld too, and the page importing it follows", () => {
  // ⚠ THE DEFECT THE OWNER REPORTED STILL REPRODUCING (2026-09-17): the first
  // cut read `wrote` — the PAGES — and a component is not a page, so a change
  // whose binding sat in `src/routes/-parts/<name>.tsx` dropped the code and
  // published the component regardless. A dead build, on purpose.
  const URL_ = "https://fretwork-1.gofarther.app";
  const qr = [{ name: "gallery", points: URL_ + "/gallery", label: "Our gallery" }];
  const shows = [{ name: "qr-banner", source: "export function QrBanner(){return <img src={SITE_QRS.gallery.src}/>}", added: true }];

  const held = deadQrs({ qr, prior: [], missing: ["/gallery"], wrote: [], wroteParts: shows, url: URL_ + "/" });
  assert.deepEqual(held.qr, [], "the code a component renders was published anyway");
  assert.deepEqual(held.withheldParts, [{ name: "qr-banner", added: true }], JSON.stringify(held.withheldParts));

  // THE CONTROL, which is what makes the line above about the reference rather
  // than about components being withheld wholesale: the same code, the same
  // missing page, a component that never mentions it.
  const blank = [{ name: "qr-banner", source: "export function QrBanner(){return <div/>}", added: true }];
  const drop = deadQrs({ qr, prior: [], missing: ["/gallery"], wrote: [], wroteParts: blank, url: URL_ + "/" });
  assert.deepEqual(drop.dropped, [{ name: "gallery", route: "/gallery" }], "the code itself still goes");
  assert.deepEqual(drop.withheldParts, [], "a component that never mentions the code was withheld");

  // A COMPONENT THE SITE ALREADY HAS IS MARKED AS ONE, because withholding it
  // means something different — the site keeps the version it is serving, and
  // no page that imports it can break.
  const kept = deadQrs({ qr, prior: [], missing: ["/gallery"], wrote: [],
    wroteParts: [{ ...shows[0], added: false }], url: URL_ + "/" });
  assert.deepEqual(kept.withheldParts, [{ name: "qr-banner", added: false }]);

  // …AND THE CASCADE CROSSES THE TWO LISTS, which is the property this half
  // exists for: an ADDED page importing a withheld ADDED component compiles
  // against a file that is not there, so it goes with it. `PART_DIR` is the
  // one definition of what that import path looks like — the same constant the
  // container and the band split read — so there is no second spelling here.
  const cascade = deadQrs({
    qr, prior: [], missing: ["/gallery"], url: URL_ + "/",
    wrote: [{ path: "posters.tsx", source: "import { QrBanner } from '@/routes/-parts/qr-banner'\n<QrBanner/>", added: true }],
    wroteParts: shows,
  });
  assert.deepEqual(cascade.withheldParts, [{ name: "qr-banner", added: true }]);
  assert.deepEqual(cascade.withheld, [{ path: "posters.tsx", added: true }],
    "the page importing the withheld component shipped anyway: " + JSON.stringify(cascade.withheld));

  // AND A COMPONENT THE SITE ALREADY HAS BREAKS THE CHAIN, for the same reason
  // a CHANGED page does: it reverts to what is serving, so the import resolves.
  const safe = deadQrs({
    qr, prior: [], missing: ["/gallery"], url: URL_ + "/",
    wrote: [{ path: "posters.tsx", source: "import { QrBanner } from '@/routes/-parts/qr-banner'\n<QrBanner/>", added: true }],
    wroteParts: [{ ...shows[0], added: false }],
  });
  assert.deepEqual(safe.withheld, [], "a page importing a component that reverts was withheld for nothing");

  // ⚠ AND A NAME IS MATCHED AT ITS BOUNDARY, never as a prefix: `qr-banner`
  // and `qr-banner-2` are two components, and an import of the second must not
  // read as an import of the first.
  const near = deadQrs({
    qr, prior: [], missing: ["/gallery"], url: URL_ + "/",
    wrote: [{ path: "posters.tsx", source: "import { X } from '@/routes/-parts/qr-banner-2'\n<X/>", added: true }],
    wroteParts: shows,
  });
  assert.deepEqual(near.withheld, [], "a longer component name matched as a prefix of the withheld one");

  // A NON-STRING `source` IS NOT A COMPONENT THAT RENDERS ANYTHING, the same
  // `String(["a"]) === "a"` trap the page half already pays for.
  const arr = deadQrs({ qr, prior: [], missing: ["/gallery"], wrote: [], url: URL_ + "/",
    wroteParts: [{ name: "qr-banner", source: ["SITE_QRS.gallery"], added: true }] });
  assert.deepEqual(arr.withheldParts, [], "a non-string source was coerced into a component that renders the code");
  assert.deepEqual(arr.dropped, [{ name: "gallery", route: "/gallery" }], "the code itself still goes");

  // ⚠ AND THE LEFT EDGE IS A WALL, NOT A NICETY — a sweep survivor, then
  // MEASURED over four real import shapes. `PART_DIR` is `-parts/`, so without
  // `(^|["'/])` in front of it a page importing somebody else's
  // `@/components/my-parts/qr-banner`, or merely LINKING to
  // `https://x.test/spare-parts/qr-banner`, reads as an import of OUR
  // `qr-banner` and is withheld for nothing. Measured: both of those ship with
  // the edge and are withheld without it, while both real spellings of our own
  // import — the `@/routes/-parts/x` every prompt teaches and the relative
  // `./-parts/x` TypeScript also resolves — are withheld either way. It is the
  // trap `partNameOf`'s own comment records (*"a PAGE legitimately called
  // `my-parts/x.tsx` is not a component"*), met from the importing side.
  const importer = (source) => deadQrs({
    qr, prior: [], missing: ["/gallery"], url: URL_ + "/",
    wrote: [{ path: "posters.tsx", source, added: true }], wroteParts: shows,
  }).withheld.length;
  assert.equal(importer("import { QrBanner } from '@/routes/-parts/qr-banner'"), 1, "our own import is not read as one");
  assert.equal(importer("import { QrBanner } from './-parts/qr-banner'"), 1, "the relative spelling TypeScript resolves is not read as one");
  assert.equal(importer("import { X } from '@/components/my-parts/qr-banner'"), 0, "another directory's component was read as ours");
  assert.equal(importer('<a href="https://x.test/spare-parts/qr-banner">parts</a>'), 0, "a link in the page text was read as an import");

  // AND THE FIXED POINT REALLY NEEDS ITS ROUNDS — also a sweep survivor, also
  // measured rather than argued. The bound is `codes + parts + 1`, and a
  // THREE-link chain is what separates it from a two-pass loop: each link is a
  // code dying, its component withheld, and the ADDED page importing that
  // component withheld in turn, which takes a route away and kills the next
  // code. MEASURED with the loop cut to two passes: `c` survives its missing
  // page, `pc` publishes rendering a code that does not exist, and
  // `leaflet.tsx` ships importing a file nothing will write.
  const link = (n, r) => ({ name: n, points: URL_ + r, label: n });
  const draws = (n, c) => ({ name: n, source: "<img src={SITE_QRS." + c + ".src}/>", added: true });
  const uses = (p, n) => ({ path: p, source: "import { X } from '@/routes/-parts/" + n + "'\n<X/>", added: true });
  const deep = deadQrs({
    qr: [link("a", "/gallery"), link("b", "/posters"), link("c", "/flyer")],
    prior: [], missing: ["/gallery"], url: URL_ + "/",
    wroteParts: [draws("pa", "a"), draws("pb", "b"), draws("pc", "c")],
    wrote: [uses("posters.tsx", "pa"), uses("flyer.tsx", "pb"), uses("leaflet.tsx", "pc")],
  });
  assert.deepEqual(deep.dropped.map((d) => d.name).sort(), ["a", "b", "c"],
    "the third code survived its missing page: " + JSON.stringify(deep.dropped));
  assert.deepEqual(deep.withheldParts.map((w) => w.name).sort(), ["pa", "pb", "pc"], JSON.stringify(deep.withheldParts));
  assert.deepEqual(deep.withheld.map((w) => w.path).sort(), ["flyer.tsx", "leaflet.tsx", "posters.tsx"],
    "the cascade stopped before the third link: " + JSON.stringify(deep.withheld));
});

test("deadQrs follows component-to-component imports, in both spellings and to any depth", () => {
  // ⚠ THE OWNER'S REPORTED CHAIN AT THE MODULE (2026-09-17): *"Propagate
  // withholding through component-to-component imports as well as
  // page-to-component imports. Continue until dependencies settle."*
  //
  // The page loop has asked "does this import a component that will not exist"
  // since the cascade shipped; the component loop asked only "does this render
  // a dead code", so a component ONE HOP from the binding was published
  // importing a module nothing would write. The route case has the end-to-end
  // measurement; this is the property on its own, where the depth and the two
  // spellings can be driven at all.
  const SITE = "https://fretwork-1.gofarther.app";
  const qr = [{ name: "gallery", points: SITE + "/gallery", label: "Our gallery" }];
  const dead = { qr, prior: [], missing: ["/gallery"], url: SITE + "/" };
  const card = { name: "qr-card", source: "<img src={SITE_QRS.gallery.src}/>", added: true };

  // ── THE TWO SPELLINGS A COMPONENT REALLY USES ────────────────────────────
  // `@/routes/-parts/x` is the one every prompt teaches. `./x` is what a
  // SIBLING is, with no `-parts/` in it at all, and both resolve — so a
  // propagation that admits only the taught one is incomplete by exactly the
  // spelling a model is most likely to reach for between two files in one
  // directory.
  for (const [what, src] of [
    ["the taught path", "import { QrCard } from '@/routes/-parts/qr-card'\n<QrCard/>"],
    ["a sibling relative", "import { QrCard } from './qr-card'\n<QrCard/>"],
    ["a sibling with its extension", "import { QrCard } from './qr-card.tsx'\n<QrCard/>"],
  ]) {
    const r = deadQrs({ ...dead, wrote: [], wroteParts: [card, { name: "panel", source: src, added: true }] });
    assert.deepEqual(r.withheldParts.map((w) => w.name).sort(), ["panel", "qr-card"],
      "a component importing the withheld one by " + what + " shipped: " + JSON.stringify(r.withheldParts));
  }

  // …AND THE SIBLING FORM IS ASKED OF COMPONENTS AND OF NOTHING ELSE, which is
  // what keeps admitting it safe. From a PAGE, `./qr-card` means
  // `src/routes/qr-card.tsx` — another PAGE — so reading it as a part import
  // would withhold a page for a file it never mentioned. MEASURED both ways
  // round, because the discriminator is the whole argument.
  const pageSib = deadQrs({ ...dead, wroteParts: [card],
    wrote: [{ path: "posters.tsx", source: "import { X } from './qr-card'\n<X/>", added: true }] });
  assert.deepEqual(pageSib.withheld, [],
    "a page importing its own sibling route was read as importing a component: " + JSON.stringify(pageSib.withheld));
  const pageDir = deadQrs({ ...dead, wroteParts: [card],
    wrote: [{ path: "posters.tsx", source: "import { X } from './-parts/qr-card'\n<X/>", added: true }] });
  assert.deepEqual(pageDir.withheld.map((w) => w.path), ["posters.tsx"],
    "the control: a page that really does import the component still goes with it");

  // …AND THE THREE THINGS THAT ARE NOT AN IMPORT, each a shape a real component
  // carries and each the discriminator for one wall in that regex. Measured:
  // all four ship as they are and are withheld with the wall removed.
  const part = (source) => deadQrs({ ...dead, wrote: [],
    wroteParts: [card, { name: "panel", source, added: true }] }).withheldParts.map((w) => w.name);
  assert.deepEqual(part("import { X } from './qr-card-2'\n<X/>"), ["qr-card"],
    "a longer component name matched as a prefix on the sibling spelling");
  assert.deepEqual(part("// the card is in ./qr-card\n<div/>"), ["qr-card"],
    "a COMMENT naming the sibling was read as an import — the quote is what separates them");
  assert.deepEqual(part('<a href="https://x.test/qr-card">the card</a>'), ["qr-card"],
    "a link ending in the component's name was read as an import — the `./` is what separates them");
  assert.deepEqual(part("import { X } from \"@/components/ui/qr-card\"\n<X/>"), ["qr-card"],
    "a KIT component of the same name was read as this site's own");

  // …AND THE NAME IS A NAME, NEVER A PATTERN. `validatePages` refuses anything
  // but kebab-case, so this cannot arrive through the route — and `deadQrs` is
  // exported and takes what it is handed, so the wall is DRIVEN here rather
  // than left as one nobody can reach. Unescaped, `qr.card` matches `qrxcard`.
  const meta = deadQrs({ ...dead, wrote: [],
    wroteParts: [
      { name: "qr.card", source: "<img src={SITE_QRS.gallery.src}/>", added: true },
      { name: "panel", source: "import { X } from './qrxcard'\n<X/>", added: true },
    ] });
  assert.deepEqual(meta.withheldParts.map((w) => w.name), ["qr.card"],
    "a component name was read as a regex, so an unrelated file matched it: " + JSON.stringify(meta.withheldParts));

  // ── DEPTH, IN THE ORDER THAT COSTS THE MOST ROUNDS ───────────────────────
  // A chain of five components listed BACKWARDS: each round the loop walks the
  // whole list, so a forward chain settles in one pass and a reversed one needs
  // a round per link. That is what the bound is for, and a bound that is short
  // does not hang — it returns with the fixed point unsettled, which is the
  // same dangling import one round later.
  const linkPart = (n, to) => ({ name: n, source: "import { X } from '@/routes/-parts/" + to + "'\n<X/>", added: true });
  const chain = deadQrs({ ...dead, wrote: [],
    wroteParts: [linkPart("p5", "p4"), linkPart("p4", "p3"), linkPart("p3", "p2"), linkPart("p2", "qr-card"), card] });
  assert.deepEqual(chain.withheldParts.map((w) => w.name).sort(), ["p2", "p3", "p4", "p5", "qr-card"],
    "the chain settled short: " + JSON.stringify(chain.withheldParts.map((w) => w.name)));

  // ── RESTORE THE EXISTING, WITHHOLD THE NEW TOGETHER ──────────────────────
  // Owner's own sentence, and it is one rule rather than two branches: an
  // existing component withheld REVERTS to the source the site is serving, so
  // its importers can go on importing it and it never joins the "will not
  // exist" set. MEASURED at depth, which is where the two could come apart: a
  // NEW card, an EXISTING panel that this change rewrote to use it, and a page
  // importing the panel.
  const revert = deadQrs({ ...dead,
    wroteParts: [card, { name: "panel", source: "import { QrCard } from './qr-card'\n<QrCard/>", added: false }],
    wrote: [{ path: "posters.tsx", source: "import { Panel } from '@/routes/-parts/panel'\n<Panel/>", added: true }],
  });
  assert.deepEqual(revert.withheldParts.map((w) => w.name).sort(), ["panel", "qr-card"],
    "the rewritten component kept an import of a file that will not exist: " + JSON.stringify(revert.withheldParts));
  assert.deepEqual(revert.withheldParts.find((w) => w.name === "panel").added, false,
    "an existing component was marked as one this change invented");
  assert.deepEqual(revert.withheld, [],
    "a page was withheld for importing a component that merely reverts: " + JSON.stringify(revert.withheld));

  // …AND THE CONTROL, so that last assertion is about `added` and not about the
  // page's import being unreadable: the same page, the same import, with the
  // panel marked as one this change invented.
  const gone = deadQrs({ ...dead,
    wroteParts: [card, { name: "panel", source: "import { QrCard } from './qr-card'\n<QrCard/>", added: true }],
    wrote: [{ path: "posters.tsx", source: "import { Panel } from '@/routes/-parts/panel'\n<Panel/>", added: true }],
  });
  assert.deepEqual(gone.withheld.map((w) => w.path), ["posters.tsx"],
    "a page importing a component that will NOT exist shipped: " + JSON.stringify(gone.withheld));

  // ── AND A CLEAN CHAIN IS UNTOUCHED ───────────────────────────────────────
  // The same three files with the page present: nothing dropped, nothing
  // withheld. Without this the whole case is satisfied by withholding
  // everything always.
  const ok = deadQrs({ qr, prior: [], missing: [], url: SITE + "/",
    wroteParts: [card, { name: "panel", source: "import { QrCard } from './qr-card'\n<QrCard/>", added: true }],
    wrote: [{ path: "posters.tsx", source: "import { Panel } from '@/routes/-parts/panel'\n<Panel/>", added: true }],
  });
  assert.deepEqual([ok.dropped, ok.withheld, ok.withheldParts], [[], [], []],
    "a chain whose page is present was withheld anyway: " + JSON.stringify(ok));
});

test("deadQrNote says the two outcomes apart, and says nothing when there is nothing to say", () => {
  assert.equal(deadQrNote(), "");
  assert.equal(deadQrNote({ dropped: [], withheld: [] }), "");

  const drop = deadQrNote({ dropped: [{ name: "gallery", route: "/gallery" }] });
  assert.match(drop, /I didn't add the QR code gallery/, drop);
  assert.match(drop, /Ask me for the page again/, "the sentence does not say what to do about it");

  // THE WITHHELD PAGE IS A DIFFERENT FACT AND NEEDS ITS OWN WORDS: the customer
  // asked for a change to a page and that page is exactly as it was, which is
  // not something the code's own sentence says. NAMED BY ROUTE, not by file.
  const kept = deadQrNote({ withheld: [{ path: "index.tsx", added: false }] });
  assert.match(kept, /I've left \/ as it was/, kept);
  assert.doesNotMatch(kept, /index\.tsx/, "the customer was shown a file name");
  assert.doesNotMatch(kept, /didn't add the QR/, "a withheld page borrowed the code's sentence");

  // …AND A PAGE THIS CHANGE INVENTED GETS THE OTHER ONE, because "I left it as
  // it was" is FALSE of a page that has never existed and sends the customer
  // looking for something that was never there.
  const never = deadQrNote({ withheld: [{ path: "posters.tsx", added: true }] });
  assert.match(never, /I haven't added \/posters either/, never);
  assert.doesNotMatch(never, /left \/posters as it was/, "a page that never existed was described as left as it was");

  // BOTH AT ONCE ARE BOTH SAID, and plurals hold.
  const two = deadQrNote({ dropped: [{ name: "a" }, { name: "b" }], withheld: [{ path: "menu.tsx" }, { path: "about.tsx" }] });
  assert.match(two, /QR codes a, b/, two);
  assert.match(two, /I've left \/menu, \/about as they were/, two);
});
