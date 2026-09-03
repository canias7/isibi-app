// THE ADD STEP IS ITS OWN PATH — asserted, and driven.
//
// Owner, 2026-09-02: "lets start building the addon part". The addon route
// called the BUILD's designer (`designSiteSchema`, the 93,852-character tool)
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
import { TABLE_ITEM } from "../builder/site-table.mjs";
import { TSX_ITEM, MAX_TSX, MAX_COMPONENTS, TOOL_DIRECTIVE } from "../builder/site-plan.mjs";
import { MAX_PAGES } from "../builder/page-gen.mjs";
import { routeOf } from "../builder/site-addon.mjs";
import { modelsFor } from "../builder/build-models.mjs";
import { MAX_QRS } from "../builder/site-qr-list.mjs";
import {
  ADD_KINDS, OWN_ADDS, DISPATCHED_ADDS, LIST_ADDS, MAX_ADDS, MAX_ADD_PAGES, MAX_ADD_COMPONENTS, MAX_ADD_TABLES, MAX_SECTIONS, MAX_ADD_SEED_ROWS, MAX_MESSAGE, ADD_MODEL, ADD_DESIGN_RULE,
  addLayer, pickTool, pickRequest, readAdds, pickAdds, addUsage,
  addTool, addRule, composeRule, RULE_PARTS, addRequest, siteNote, readAddAnswer, runAdd,
  cleanAdd, fileOfRoute, addDirective, foldAdds, addRefusal, alreadyReply,
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
  assert.deepEqual([...OWN_ADDS, ...DISPATCHED_ADDS].sort(), [...ADD_KINDS].sort(), "a kind is in neither group or in both");
  for (const k of OWN_ADDS) { assert.ok(!DISPATCHED_ADDS.includes(k)); assert.equal(addLayer(k), null, `${k} acts here and dispatches`); }
  for (const k of DISPATCHED_ADDS) {
    const layer = addLayer(k);
    assert.ok(EDIT_LAYERS.includes(layer), `${k} dispatches to "${layer}", which is not an edit layer the route has`);
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
    assert.ok(["./site-plan.mjs", "./site-table.mjs", "./site-addon.mjs", "./build-models.mjs", "./site-qr-list.mjs"].includes(from),
      "the add step reaches into a module the two paths do not share: " + from);
  }
  for (const word of ["design_schema", "SITE_SCHEMA", "designSiteSchema", "You design", "EDIT_RULE", "currentStateNote"]) {
    assert.ok(!bare.includes(word), "the add step carries the build's wording or tool: " + word);
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
  assert.deepEqual([...LIST_ADDS].sort(), ["component", "page", "table"]);
  for (const k of LIST_ADDS) {
    const p = addTool(k).input_schema.properties[k];
    assert.equal(p.type, "array", k + " answers one thing, not a list");
    assert.ok(p.maxItems >= 6, k + " has a low cap: " + p.maxItems);
    assert.ok(Array.isArray(p.items.required) && p.items.required.length, k + "'s entries require nothing");
  }
  for (const k of OWN_ADDS.filter((x) => !LIST_ADDS.includes(x))) assert.equal(addTool(k).input_schema.properties[k].type, "object", k + " is a list of a thing a site has one of");
  // The page cap is the page writer's own ceiling: a seventh page would be
  // dropped there, so promising it here would be a page nobody gets.
  assert.ok(MAX_ADD_PAGES <= MAX_PAGES, "the add step promises more pages than the page writer keeps");
  assert.ok(MAX_ADD_COMPONENTS >= 6 && MAX_ADD_TABLES >= 3);
  // And the rules say "as many as they asked for", never "one".
  for (const k of LIST_ADDS) {
    assert.match(addRule(k), /AS MANY [A-Z ]+ AS (THEY|THE THINGS THEY) (ASKED FOR|NAMED)/, k + "'s rule still caps the count at one");
    assert.match(addRule(k), /NOT ONE MORE/, k + "'s rule has no ceiling");
  }
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
    assert.deepEqual(Object.keys(t.input_schema.properties), [k], k + ": the tool has a property that is not the kind");
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

test("a dispatched kind has no tool, and an unknown kind is refused", () => {
  assert.throws(() => addTool("photo"), /picture/);
  assert.throws(() => addTool("nope"), /no add for kind/);
  assert.throws(() => addTool(["page"]), /no add for kind/);
  assert.throws(() => addRule("photo"), /no rule/);
});

test("every kind states all four parts of its rule, and the composer refuses a missing one", () => {
  assert.deepEqual(RULE_PARTS, ["is", "yours", "wide", "keep"]);
  for (const k of OWN_ADDS) {
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
  assert.match(p.messages[0].content, /^The site is called X\.\n\nTheir message:\nAdd a gallery page$/);
  const a = addRequest({ kind: "component", message: "x".repeat(MAX_MESSAGE + 50), site: SITE, model: "sentinel-model" });
  assert.equal(a.model, "sentinel-model");
  assert.equal(a.tool_choice.name, "add_to_site");
  assert.ok(a.tools[0].cache_control && a.system[0].cache_control, "the add's fixed blocks are not cached");
  assert.ok(a.messages[0].content.includes(siteNote(SITE)), "the add is not shown the site");
  assert.ok(!a.messages[0].content.includes("x".repeat(MAX_MESSAGE + 1)), "the message is not capped");
  assert.equal(ADD_MODEL, modelsFor().quick, "the default model is not the picker's");
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
  assert.equal(readAddAnswer(toolReply("add_to_site", {}), "page"), undefined);
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
  assert.equal(cleanAdd("photo", {}, SITE).why, "no-kind", "a dispatched kind has nothing to clean");
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
  const one = cleanAdd("component", { page: "/testimonials", does: "quotes", components: ["testimonial"], where: "after the hero" }, SITE);
  assert.equal(one.ok, true); assert.equal(one.value[0].page, "/"); assert.equal(one.value[0].where, "after the hero");
  assert.deepEqual(one.value[0].components, ["testimonial"]);
  assert.equal(cleanAdd("component", { page: "/nope", does: "quotes", components: ["testimonial"] }, MULTI).why, "no-page");
  assert.equal(cleanAdd("component", { page: "about", does: "quotes", components: ["testimonial"] }, MULTI).value[0].page, "/about");
  assert.equal(cleanAdd("component", { does: "quotes", components: ["testimonial"] }, MULTI).value[0].page, "/", "no page named on a site with a home page is the home page");
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
  const qr = cleanAdd("qr", { points: " tel:0114 ", label: "Ring", page: "/x", where: "contact" }, SITE);
  assert.deepEqual(qr, { ok: true, value: { name: "ring", points: "tel:0114", label: "Ring", page: "/", where: "contact" } });
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
  const three = cleanAdd("three", { scene: "a spinning pick", page: "/" }, SITE);
  assert.deepEqual(three, { ok: true, value: { scene: "a spinning pick", page: "/" } });
  assert.equal(cleanAdd("three", { page: "/" }, SITE).why, "no-scene");
});

// ── THE DIRECTIVE AND THE FOLD ───────────────────────────────────────────────

test("the directive says what is new, where it goes and what it is built from — and a tool site gets the tool block", () => {
  const page = cleanAdd("page", { path: "/book", name: "Book", purpose: "book a lesson", sections: ["form", "hours"], components: ["site-chrome", "form-shell"], link: "the header menu" }, SITE).value[0];
  const d = addDirective("page", page, SITE);
  assert.match(d, /book\.tsx/); assert.match(d, /\/book/); assert.match(d, /"Book"/);
  assert.match(d, /LAYOUT — book a lesson\./);
  assert.match(d, /Reach first for: site-chrome, form-shell\./);
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
    { kind: "page", value: cleanAdd("page", { path: "/book", name: "Book", purpose: "book", sections: ["form"], components: ["site-chrome", "form-shell"], tsx: [{ name: "slot-picker", does: "picks", props: "s" }, { name: "chord-diagram", does: "chords, redone", props: "p2" }] }, SITE).value },
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
  assert.deepEqual(f.components, ["site-chrome", "form-shell", "testimonial"]);
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
  assert.deepEqual(foldAdds([], null, null), { designed: {}, components: [], directive: "", files: [] });
});

test("every refusal token has a sentence of its own, and the already-reply names the door that changes it", () => {
  const tokens = ["page-exists", "no-path", "no-page", "no-plan", "no-component", "no-table", "no-columns", "no-destination", "no-scene",
    // The QR list's own refusals (2026-09-03): a code the site cannot take
    // another of, by name or by destination; a destination a QR may not
    // carry; a caption that yields no name; a site at the ceiling.
    "bad-destination", "no-name", "same-name", "same-code", "too-many"];
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

// ── THE WIRING ───────────────────────────────────────────────────────────────

test("THE ROUTE RUNS THE ADD STEP WHERE IT RAN THE BUILD'S DESIGNER, and folds what the step designed", () => {
  const W = blankComments(read("../worker.js"));
  const b = W.slice(at(W, "if (ad) {", "addon"), at(W, "if (tx) {", "addon end"));
  assert.ok(!/designSiteSchema\(/.test(b), "the addon still calls the build's designer");
  for (const fn of ["pickAdds(", "runAdd(", "cleanAdd(", "foldAdds(", "addLayer(", "addRefusal(", "alreadyReply("]) assert.ok(b.includes(fn), "the addon does not call " + fn);
  assert.match(W, /import \{[^}]*\bpickAdds\b[^}]*\} from "\.\/builder\/site-add\.mjs"/, "a call to a name never imported is a ReferenceError on the addon path");
  // The order: picked, hopped, refused-by-name, designed, cleaned, folded, merged.
  const pick = at(b, "const aPicked = await pickAdds(", "pick");
  const hop = at(b, "if (aHop && aKinds.length === 1) return aEscalate(\"layer\", { layer: addLayer(aHop), kind: aHop });", "hop");
  const nodb = at(b, 'if (aKinds.includes("table") && !adb) {', "no-database");
  const run = at(b, "const ran = await runAdd(", "run");
  const clean = at(b, "const clean = cleanAdd(k, ran.value, aSite);", "clean");
  const fold = at(b, "const aFold = foldAdds(aAnswers, aLook, aSite);", "fold");
  const designed = at(b, "const aDesigned = aFold.designed;", "designed");
  const merged = at(b, "const aMerged = mergeLook(aLook, aDesigned, {}, { instructed: true });", "merge");
  assert.ok(pick < hop && hop < nodb && nodb < run && run < clean && clean < fold && fold < designed && designed < merged, "the addon's steps are out of order");
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
  assert.match(call, /plan: aFold\.components\.length \? \{ components: aFold\.components \} : null/, "the kit parts are not handed to the page call");
  // The reply says what kinds were added and what was set aside — and which
  // entries of a list were left out, with the server's own sentence.
  assert.match(b, /kinds: aAnswers\.map\(\(a\) => a\.kind\), skipped: aSkipped,/, "the reply does not say what was added");
  assert.match(b.slice(clean, fold), /for \(const sk of Array\.isArray\(clean\.skipped\) \? clean\.skipped : \[\]\) aNotAdded\.push\(\{ kind: k, \.\.\.sk, msg: addRefusal\(sk\.why, k\) \}\);/, "an entry left out of a list is not carried to the reply");
  assert.match(b, /notAdded: aNotAdded\.length \? aNotAdded\.slice\(0, 6\) : undefined,/, "the reply does not say which entries were left out");
  // The model-down answer is the edit route's: billing is ours, a timeout is ours.
  const down = b.slice(at(b, "const aDown = (e, what) => {", "down"), pick);
  assert.match(down, /isCallTimeout\(e\)/); assert.match(down, /k\.billing/); assert.match(down, /status: 503/);
});
