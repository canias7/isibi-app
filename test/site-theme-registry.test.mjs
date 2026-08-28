// THE 500 THEMES ARE THE BASE OF EVERY BUILD AGAIN — the chain, link by link.
//
// Owner's call, 2026-08-27: "we are gonna have the 500 themes, and with the
// option if user wants a specific thing then the free css comes in as customer
// requested." The registry moved back from test fixtures to
// `builder/site-theme-registry.mjs`, the designer picks a theme by name from an
// enum of all 500, and the model's free `css` became the ON-REQUEST layer on
// top rather than the whole look.
//
// EVERY GUARD HERE IS A LINK OF THE CHAIN, because this repo has recorded a
// dozen features correct at every layer and dead at one: the enum must be the
// registry's own ids, the merge must refuse a name the registry does, the
// stored theme must reach both container payloads, and the css field must say
// its half of the bargain out loud. The container's render is proven in
// `test/integration/site-build.mjs` against the real compiler.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readSchemaTool } from "./integration/schema-tool.mjs";
import { ALL_THEMES, THEME_IDS, resolveTheme, themeFontPair } from "../builder/site-theme-registry.mjs";
import { SHORTLIST } from "../builder/site-fonts.mjs";
import { mergeLook, keepsValue, EDIT_FIELDS } from "../builder/site-edit.mjs";

const ROOT = path.join(import.meta.dirname, "..");
const worker = fs.readFileSync(path.join(ROOT, "worker.js"), "utf8");

/* ── the registry itself ──────────────────────────────────────────────────── */

test("the registry is whole — 500 themes, every one resolvable", () => {
  // The floor is the point: a batch import that silently stopped composing
  // would leave a smaller registry that still "works", with the missing themes
  // reading as model hallucinations at the merge.
  assert.ok(THEME_IDS.length >= 490, `only ${THEME_IDS.length} themes — a batch fell out of the registry`);
  for (const id of THEME_IDS) assert.ok(resolveTheme(id), `${id} is listed and does not resolve`);
  // The prototype keys, because `ALL_THEMES["__proto__"]` is truthy and this
  // exact bug shipped once in the Stripe plan lookup.
  for (const junk of ["__proto__", "constructor", "toString", "", null, undefined, 7, ["broadsheet"]]) {
    assert.equal(resolveTheme(junk), null, JSON.stringify(junk) + " resolved to a theme");
  }
});

test("every theme's font pair names two INSTALLED faces", () => {
  // `themeFontPair` is where an unasked site's typeface comes from, and the
  // container's `resolvePair` silently drops an id it cannot resolve — so a
  // pair naming a face outside the 24 installed families is a theme whose
  // typography ships as the default while everything reports success. That is
  // the exact failure shape `site-fonts.mjs` is written around.
  const installed = new Set(SHORTLIST.map((f) => f.id));
  let checked = 0;
  for (const id of THEME_IDS) {
    const pair = themeFontPair(id);
    assert.ok(pair, `${id} recommends no font pair — its sites ship the default face`);
    for (const half of [pair.heading, pair.body]) {
      assert.ok(installed.has(half), `${id} recommends "${half}", which is not an installed family`);
    }
    checked++;
  }
  assert.ok(checked >= 490, "the pair sweep ran over almost nothing");
  // And a copy, never the registry's own object — stored state aliasing a
  // module constant is how a shared object eventually gets mutated.
  const a = themeFontPair("broadsheet");
  a.heading = "mutated";
  assert.equal(themeFontPair("broadsheet").heading, "noto-serif", "themeFontPair hands out the registry's own object");
});

test("the fixture path is a re-export of the product, not a second copy", async () => {
  // Seven test files import through `test/fixtures/themes.mjs`; if it ever
  // becomes its own data again, the calibration corpus and the product can
  // disagree about what a theme is — which is the drift the one-path rule
  // exists to prevent.
  const fixture = await import("./fixtures/themes.mjs");
  assert.equal(fixture.ALL_THEMES, ALL_THEMES, "the fixture holds a different registry from the product");
  assert.equal(fixture.resolveTheme, resolveTheme, "the fixture judges names with a different function");
});

/* ── the tool ─────────────────────────────────────────────────────────────── */

test("the tool's theme enum IS the registry — all 500, derived", async () => {
  const { tool } = await readSchemaTool();
  const field = tool.input_schema.properties.theme;
  assert.ok(field, "design_schema no longer offers a theme");
  // The enum is the registry's own id list — an enum restated by hand drifts,
  // and the direction it drifts in is a designer told a theme exists that the
  // container then cannot resolve: a site that reports a look and ships the
  // default.
  assert.deepEqual(field.enum, THEME_IDS, "the tool's enum is not the registry's own id list");
  assert.ok(field.enum.length >= 490, "the enum shrank — the owner's call is all 500, not a shortlist");
  // Required on a BUILD — the compelled look field — and the description must
  // say the css bargain, or the model answers both halves on every build.
  assert.ok(tool.input_schema.required.includes("theme"), "a first build no longer compels a theme");
  assert.match(field.description, /every build wears one/i, "the field no longer says every build gets a theme");
  assert.match(field.description, /`css`[^.]*ONLY for what the customer/,
    "the field no longer points the css layer at the customer's own asks");
});

test("the css field is the ON-REQUEST layer, and says so at its front door", async () => {
  const { tool } = await readSchemaTool();
  const css = tool.input_schema.properties.css;
  assert.ok(css, "design_schema no longer offers css — the customer-requested layer is gone");
  // The contract's three load-bearing sentences, on the WIRE text (the real
  // evaluated tool, not the source spelling) — each one's deletion is silent:
  // without the omit sentence every build gets a sheet again; without the
  // only-the-rules sentence a single ask invites a second whole design.
  assert.match(css.description, /^CSS ON TOP OF THE THEME, ONLY WHEN ASKED/,
    "the css field no longer opens with the on-request contract");
  assert.match(css.description, /OMIT this field entirely unless the customer's own words ask/,
    "the omit-by-default sentence is gone — every build gets a model sheet again");
  assert.match(css.description, /write ONLY the rules that answer what they asked/,
    "the minimal-answer sentence is gone — one ask invites a whole design");
  // And it is NOT compelled — a required field is one the model must answer.
  assert.ok(!tool.input_schema.required.includes("css"),
    "css is required — the on-request contract is broken on every single build");
});

/* ── the merge ────────────────────────────────────────────────────────────── */

test("mergeLook can never return a theme the registry refuses", () => {
  // The tool's enum is advisory (strict validation is unavailable on this
  // tool), so a hallucinated name reaches the merge — and counted as a value it
  // REPLACES a good stored theme, after which the container falls soft to the
  // default look on every publish for good. Same invariant as `seeds`, same
  // single-validator rule.
  assert.equal(keepsValue("theme", "broadsheet"), true);
  for (const junk of ["not-a-theme", "", "__proto__", "constructor", ["broadsheet"], { name: "noir" }]) {
    assert.equal(keepsValue("theme", junk), false, JSON.stringify(junk) + " counts as a theme");
  }
  const stored = { theme: "broadsheet" };
  // A hallucinated answer keeps the stored theme, instructed or not.
  assert.equal(mergeLook(stored, { theme: "zzz-nonesuch" }, null, { instructed: true }).theme, "broadsheet");
  // A real answer moves it — that is what "switch it to noir" costs: one cheap
  // look edit, no rebuild.
  assert.equal(mergeLook(stored, { theme: "noir" }, null, { instructed: true }).theme, "noir");
  // And silence keeps it, which is what stops a revise about a phone number
  // re-theming the site.
  assert.equal(mergeLook(stored, {}, null, { instructed: true }).theme, "broadsheet");
  assert.ok(EDIT_FIELDS.includes("theme"), "theme fell off EDIT_FIELDS — the merge destroys it on the next edit");
});

/* ── the wire ─────────────────────────────────────────────────────────────── */

test("the stored theme reaches the build path, the payloads, and the resume record", () => {
  // The route hands the MERGED look's theme into buildAndPublishPages — which
  // stores its args for the resume, so a fired build's second invocation
  // replays the same theme — and both container payloads carry it beside the
  // pair. The payload halves are held in detail by site-freecss.test.mjs and
  // site-fonts.test.mjs; this is the route link those cannot see.
  assert.match(worker, /\n\s*theme: look\.theme,/,
    "buildArgs no longer carries the merged theme — a build renders the default look");
  assert.match(worker, /async function buildAndPublishPages\(env, \{[^}]*\btheme\b[^}]*\}\)/,
    "buildAndPublishPages does not accept a theme — the argument lands nowhere");
  // The spine reads it off the stored look, so a typo fix keeps the theme.
  assert.match(worker, /theme: \(look && look\.theme\) \|\| undefined,/,
    "the cheap-edit spine no longer carries the stored theme — a typo fix republishes plain");
});
