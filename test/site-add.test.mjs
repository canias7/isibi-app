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
import { routeOf } from "../builder/site-addon.mjs";
import { modelsFor } from "../builder/build-models.mjs";
import {
  ADD_KINDS, OWN_ADDS, DISPATCHED_ADDS, MAX_ADDS, MAX_SECTIONS, MAX_ADD_SEED_ROWS, MAX_MESSAGE, ADD_MODEL,
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
  // THE MIRROR OF THE WALL: the same list, read in the addon block, refuses a
  // second code or scene and names the door that changes the first.
  const b = W.slice(at(W, "if (ad) {", "addon"), at(W, "if (tx) {", "addon end"));
  const loop = b.indexOf("for (const f of ADD_ONLY_FIELDS) {\n              if (aKinds.includes(f) && aHas[f]) {");
  assert.ok(loop > 0, "the addon does not refuse a kind the site already has off the edit path's own list");
  assert.match(b.slice(loop, b.indexOf("}", b.indexOf("}", loop) + 1) + 1), /alreadyReply\(f\)/, "the refusal does not name the door that changes it");
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
    assert.ok(["./site-plan.mjs", "./site-table.mjs", "./site-addon.mjs", "./build-models.mjs"].includes(from),
      "the add step reaches into a module the two paths do not share: " + from);
  }
  for (const word of ["design_schema", "SITE_SCHEMA", "designSiteSchema", "You design", "EDIT_RULE", "currentStateNote"]) {
    assert.ok(!bare.includes(word), "the add step carries the build's wording or tool: " + word);
  }
});

test("the table kind asks for the ONE table shape the build asks for — by identity, and the build really sends it", async () => {
  const tool = addTool("table");
  assert.equal(tool.input_schema.properties.table.properties.table, TABLE_ITEM, "the add step's table is not the shared item");
  const { tool: build } = await readSchemaTool();
  assert.deepEqual(build.input_schema.properties.backend.properties.tables.items, TABLE_ITEM,
    "the build tool's table item is not the shared one — two shapes of a table again");
  // …and the part shape, for the two kinds that may declare one.
  for (const k of ["page", "component"]) {
    assert.equal(addTool(k).input_schema.properties[k].properties.tsx.items, TSX_ITEM, k + " declares parts in a shape of its own");
    assert.equal(addTool(k).input_schema.properties[k].properties.tsx.maxItems, MAX_TSX);
    assert.equal(addTool(k).input_schema.properties[k].properties.components.maxItems, MAX_COMPONENTS);
  }
});

// ── THE TOOLS ────────────────────────────────────────────────────────────────

test("one property per tool, named by the kind, nothing required at the top, the kind's own required inside", () => {
  for (const k of OWN_ADDS) {
    const t = addTool(k);
    assert.equal(t.name, "add_to_site");
    assert.deepEqual(Object.keys(t.input_schema.properties), [k], k + ": the tool has a property that is not the kind");
    assert.deepEqual(t.input_schema.required, [], k + ": something is required of a kind that may decline");
    const p = t.input_schema.properties[k];
    assert.equal(p.type, "object");
    assert.equal(p.description, addRule(k), k + ": the property does not carry the kind's rule");
    assert.ok(Array.isArray(p.required) && p.required.length, k + ": the addition itself requires nothing");
    for (const r of p.required) assert.ok(Object.hasOwn(p.properties, r), k + ": requires a property it does not have: " + r);
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
  // Capped at MAX_ADDS in the order the model listed them, then sorted into
  // the caller's order: a table runs before the page that shows it.
  assert.deepEqual(got, ["table", "page", "photo"]);
  assert.deepEqual(readAdds(toolReply("pick_adds", { kinds: ["page", "table"] })), ["table", "page"]);
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
  const db = siteNote({ ...DB, kind: "tool", qr: { label: "Scan to ring" }, three: "a pick", tsx: [{ name: "chord-diagram" }] });
  assert.match(db, /It stores: bookings\./);
  assert.match(db, /WORKING TOOL/);
  assert.match(db, /QR code \("Scan to ring"\)/);
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
  assert.equal(ok.value.path, "/gallery"); assert.equal(ok.value.file, "gallery.tsx"); assert.equal(ok.value.name, "Gallery");
  assert.deepEqual(ok.value.components, ["gallery", "site-chrome"]);
  assert.equal(ok.value.sections.length, MAX_SECTIONS);
  assert.deepEqual(ok.value.tsx, [{ name: "seat-map", does: "seats", props: "rows: X[]" }]);
  assert.equal(cleanAdd("page", { ...ok.value, path: "/" }, SITE).why, "no-path", "the home page is a page to add");
  assert.equal(cleanAdd("page", { ...ok.value, path: "/about" }, MULTI).why, "page-exists");
  assert.equal(cleanAdd("page", { ...ok.value, name: "" }, SITE).why, "no-plan");
  assert.equal(cleanAdd("page", { ...ok.value, sections: [], components: [] }, SITE).why, "no-plan");
  assert.equal(cleanAdd("page", { ...ok.value, path: "bad path!" }, SITE).why, "no-path");
  assert.equal(cleanAdd("page", null, SITE).why, "nothing");
  assert.equal(cleanAdd("page", "gallery", SITE).why, "nothing");
  assert.equal(cleanAdd("nope", {}, SITE).why, "no-kind");
});

test("cleanAdd: a component lands on the one page a one-page site has, is refused on a many-page site it cannot name, and IS a component", () => {
  const one = cleanAdd("component", { page: "/testimonials", does: "quotes", components: ["testimonial"], where: "after the hero" }, SITE);
  assert.equal(one.ok, true); assert.equal(one.value.page, "/"); assert.equal(one.value.where, "after the hero");
  assert.deepEqual(one.value.components, ["testimonial"]);
  assert.equal(cleanAdd("component", { page: "/nope", does: "quotes", components: ["testimonial"] }, MULTI).why, "no-page");
  assert.equal(cleanAdd("component", { page: "about", does: "quotes", components: ["testimonial"] }, MULTI).value.page, "/about");
  assert.equal(cleanAdd("component", { does: "quotes", components: ["testimonial"] }, MULTI).value.page, "/", "no page named on a site with a home page is the home page");
  assert.equal(cleanAdd("component", { page: "/", components: ["x"] }, SITE).why, "no-plan");
  // THE COMPONENT IS THE ADDITION (owner: "a tsx step that adds components"):
  // an answer that names no kit part and writes none is a band the page
  // writer would have to invent — the reading the owner corrected.
  assert.equal(cleanAdd("component", { page: "/", does: "quotes", components: [] }, SITE).why, "no-component");
  assert.equal(cleanAdd("component", { page: "/", does: "quotes", components: ["not a name"] }, SITE).why, "no-component");
  const own = cleanAdd("component", { page: "/", does: "a tide clock", components: [], tsx: [{ name: "tide-clock", does: "shows the tide", props: "port: string" }] }, SITE);
  assert.equal(own.ok, true); assert.deepEqual(own.value.components, []); assert.equal(own.value.tsx[0].name, "tide-clock");
});

test("cleanAdd: a table needs a name and columns unless it gives an existing table payment or a public view", () => {
  const ok = cleanAdd("table", { table: { name: "Bookings", columns: [{ name: "when", type: "text" }, { nope: 1 }], access: "collect" }, seed: [{ when: "x" }, "junk", ...Array(20).fill({ when: "y" })], shows: "/" }, DB);
  assert.equal(ok.ok, true);
  assert.equal(ok.value.table.name, "bookings");
  assert.equal(ok.value.table.columns.length, 1);
  assert.equal(ok.value.table.access, "collect", "the rest of the item must ride through to the engine");
  assert.equal(ok.value.seed.length, MAX_ADD_SEED_ROWS);
  assert.equal(ok.value.shows, "/");
  assert.equal(ok.value.exists, true);
  assert.equal(cleanAdd("table", { table: { name: "bookings", columns: [] } }, SITE).why, "no-columns");
  assert.equal(cleanAdd("table", { table: { name: "orders", columns: [], payment: { from: "products" } } }, DB).why, "no-columns", "payment on a table the site does not have is not an alteration");
  assert.equal(cleanAdd("table", { table: { name: "bookings", columns: [], payment: { from: "services" } } }, DB).ok, true);
  assert.equal(cleanAdd("table", { table: { name: "bookings", columns: [], publicView: { columns: ["when"] } } }, DB).ok, true);
  assert.equal(cleanAdd("table", { table: { name: "Bad Name", columns: [{ name: "a" }] } }, DB).why, "no-table");
  assert.equal(cleanAdd("table", { table: ["bookings"] }, DB).why, "no-table");
  assert.equal(cleanAdd("table", {}, DB).why, "no-table");
});

test("cleanAdd: a code needs both halves and a scene needs a description; each lands on a page", () => {
  const qr = cleanAdd("qr", { points: " tel:0114 ", label: "Ring", page: "/x", where: "contact" }, SITE);
  assert.deepEqual(qr, { ok: true, value: { points: "tel:0114", label: "Ring", page: "/", where: "contact" } });
  assert.equal(cleanAdd("qr", { label: "Ring" }, SITE).why, "no-destination");
  assert.equal(cleanAdd("qr", { points: "tel:0114" }, SITE).why, "no-destination");
  assert.equal(cleanAdd("qr", { points: "tel:0114", label: "Ring", page: "/nope" }, MULTI).value.page, "", "a page it cannot name is left for the page call to decide");
  const three = cleanAdd("three", { scene: "a spinning pick", page: "/" }, SITE);
  assert.deepEqual(three, { ok: true, value: { scene: "a spinning pick", page: "/" } });
  assert.equal(cleanAdd("three", { page: "/" }, SITE).why, "no-scene");
});

// ── THE DIRECTIVE AND THE FOLD ───────────────────────────────────────────────

test("the directive says what is new, where it goes and what it is built from — and a tool site gets the tool block", () => {
  const page = cleanAdd("page", { path: "/book", name: "Book", purpose: "book a lesson", sections: ["form", "hours"], components: ["site-chrome", "form-shell"], link: "the header menu" }, SITE).value;
  const d = addDirective("page", page, SITE);
  assert.match(d, /book\.tsx/); assert.match(d, /\/book/); assert.match(d, /"Book"/);
  assert.match(d, /LAYOUT — book a lesson\./);
  assert.match(d, /Reach first for: site-chrome, form-shell\./);
  assert.match(d, /1\. form\n\s+2\. hours/, "the bands are not numbered in order");
  assert.match(d, /Link it from the header menu/);
  assert.ok(!d.includes(TOOL_DIRECTIVE), "a shopfront got the tool block");
  assert.ok(addDirective("page", page, { ...SITE, kind: "tool" }).includes(TOOL_DIRECTIVE), "a tool site did not get the tool block");
  const component = cleanAdd("component", { page: "/", where: "after the hero", does: "quotes from students", components: ["testimonial"] }, SITE).value;
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
  const table = cleanAdd("table", { table: { name: "bookings", columns: [{ name: "when" }] }, seed: [{ when: "x" }], shows: "/book" }, DB).value;
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
  assert.deepEqual(f.designed.qr, { points: "tel:0114", label: "Ring" });
  assert.equal(f.designed.three, "a pick");
  assert.deepEqual(f.components, ["site-chrome", "form-shell", "testimonial"]);
  assert.deepEqual(f.files, ["book.tsx"]);
  const blocks = f.directive.split("\n\n## ");
  assert.equal(blocks.length, 5, "one block per addition, in run order");
  assert.match(blocks[0], /^## The table/);
  assert.match(blocks[1], /^The page/);
  // Nothing declared, nothing stored: a site with no parts must not store [].
  const bare = foldAdds([{ kind: "qr", value: { points: "x", label: "y" } }], {}, SITE);
  assert.equal(bare.designed.tsx, undefined);
  assert.equal(bare.designed.tables, undefined);
  assert.deepEqual(bare.components, []);
  assert.deepEqual(foldAdds([], null, null), { designed: {}, components: [], directive: "", files: [] });
});

test("every refusal token has a sentence of its own, and the already-reply names the door that changes it", () => {
  const tokens = ["page-exists", "no-path", "no-page", "no-plan", "no-component", "no-table", "no-columns", "no-destination", "no-scene"];
  const seen = new Set();
  for (const t of tokens) {
    const s = addRefusal(t, "page");
    assert.ok(s.length > 20 && !seen.has(s), t + ": no sentence of its own");
    assert.notEqual(s, addRefusal("nothing"), t + " falls to the default sentence");
    seen.add(s);
  }
  assert.match(addRefusal("nothing", "page"), /\(page\)/);
  assert.match(addRefusal("no-destination"), /Nothing was changed/);
  assert.match(alreadyReply("qr"), /already has a QR code/); assert.match(alreadyReply("qr"), /change/);
  assert.match(alreadyReply("three"), /already has a 3D scene/);
  assert.match(alreadyReply("x"), /already has/);
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
  // The reply says what kinds were added and what was set aside.
  assert.match(b, /kinds: aAnswers\.map\(\(a\) => a\.kind\), skipped: aSkipped,/, "the reply does not say what was added");
  // The model-down answer is the edit route's: billing is ours, a timeout is ours.
  const down = b.slice(at(b, "const aDown = (e, what) => {", "down"), pick);
  assert.match(down, /isCallTimeout\(e\)/); assert.match(down, /k\.billing/); assert.match(down, /status: 503/);
});
