// The per-family reference apps, and the three properties that keep them honest:
// one page per family, each leaning on its own family's kit, and none of them
// wired to data — arrangement is their whole job; the reference SITE teaches
// wiring.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { FAMILIES, FAMILY_NAMES } from "../builder/site-layouts.mjs";

const TEMPLATE = path.join(import.meta.dirname, "../builder/lovable/template");
const DIR = path.join(TEMPLATE, "src/family-pages");
const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".tsx"));
const src = Object.fromEntries(files.map((f) => [f.slice(0, -4), fs.readFileSync(path.join(DIR, f), "utf8")]));

test("one page per family, named for it — both directions", () => {
  // Named exactly after the family id, so the wiring step can resolve a family
  // to its page with no lookup table to drift.
  assert.deepEqual(Object.keys(src).sort(), [...FAMILY_NAMES].sort());
});

test("every page leans on its OWN family's components", () => {
  // The page is the proof the directive is buildable. One that ignores the
  // family's kit proves nothing — and would teach the model to ignore it too.
  for (const name of FAMILY_NAMES) {
    const cited = FAMILIES[name].components.filter((c) =>
      src[name].includes(`@/components/ui/${c}"`));
    assert.ok(cited.length >= 3,
      `${name} imports only [${cited}] of its family's components — needs at least 3`);
  }
});

test("family pages are presentational BY DESIGN — no data hooks, no fetch", () => {
  // Arrangement is schema-independent; a page that read tables would need a
  // schema to lint against and would break the moment one changed. The
  // reference SITE (src/routes) is where wiring is taught, deliberately.
  for (const [name, s] of Object.entries(src)) {
    assert.ok(!s.includes("@/lib/rows"), `${name} imports @/lib/rows — wiring belongs to the reference site`);
    assert.ok(!/\bfetch\s*\(/.test(s), `${name} calls fetch`);
  }
});

test("the folder is excluded from the per-build check and covered by the kit's", () => {
  // The charts lesson: excluded-from-build must mean moved-to-kit, or the pages
  // silently rot. Read off the configs so a tsconfig edit cannot drift past.
  const strip = (t) => t.replace(/\/\/[^\n]*/g, "");
  const buildCfg = strip(fs.readFileSync(path.join(TEMPLATE, "tsconfig.json"), "utf8"));
  const kitCfg = strip(fs.readFileSync(path.join(TEMPLATE, "tsconfig.kit.json"), "utf8"));
  assert.ok(buildCfg.includes('"src/family-pages"'), "site builds are paying to typecheck the family pages");
  assert.ok(kitCfg.includes('"src/family-pages/**/*.tsx"'), "nothing typechecks the family pages");
  // And the kit config carries the route tree, or createFileRoute("/") fails on
  // any fresh checkout — the works-on-my-machine failure kit-typecheck documents.
  assert.ok(kitCfg.includes('"src/routeTree.gen.ts"'), "the kit check lost the router augmentation");
});

test("every page is a route module the render harness can mount", () => {
  for (const [name, s] of Object.entries(src)) {
    assert.ok(s.includes('createFileRoute("/")'), `${name} is not mountable as an index route`);
  }
});
