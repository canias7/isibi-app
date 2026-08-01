// The per-family reference apps, and the properties that keep them honest:
// one FOLDER per family carrying EXACTLY the page set its family declares,
// each page a mountable route leaning on its own family's kit, and none of it
// wired to data — arrangement is their whole job; the reference SITE teaches
// wiring.
//
// The page set is the load-bearing bijection now (owner's call, 2026-08-01):
// `FAMILIES[n].pages` says what a site of that family ships — one page for a
// café, four for a docs site — and the app on disk is the rendered proof.
// Either side drifting fails here, in both directions.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { FAMILIES, FAMILY_NAMES } from "../builder/site-layouts.mjs";

const TEMPLATE = path.join(import.meta.dirname, "../builder/lovable/template");
const DIR = path.join(TEMPLATE, "src/family-pages");
const dirs = fs.readdirSync(DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
// name -> { file -> source }
const src = Object.fromEntries(dirs.map((n) => [n, Object.fromEntries(
  fs.readdirSync(path.join(DIR, n)).filter((f) => f.endsWith(".tsx"))
    .map((f) => [f.slice(0, -4), fs.readFileSync(path.join(DIR, n, f), "utf8")]))]));

test("one app per family, named for it — both directions", () => {
  // Named exactly after the family id, so the wiring step can resolve a family
  // to its app with no lookup table to drift. And nothing but folders lives
  // here — a stray loose .tsx would be invisible to every check below.
  assert.deepEqual(dirs.sort(), [...FAMILY_NAMES].sort());
  const loose = fs.readdirSync(DIR, { withFileTypes: true }).filter((d) => !d.isDirectory());
  assert.deepEqual(loose.map((d) => d.name), [], "loose files in src/family-pages");
});

test("every app carries EXACTLY its declared page set — both directions", () => {
  // The whole point of `pages`: a café is one scroll, a docs site is four
  // linked pages. A declared page with no file is a directive citing a proof
  // that does not exist; a file no family declares is unreachable by every
  // check and every future wiring.
  for (const name of FAMILY_NAMES) {
    const declared = FAMILIES[name].pages.map((p) => p.file).sort();
    const onDisk = Object.keys(src[name]).sort();
    assert.deepEqual(onDisk, declared, `${name}: declared [${declared}] but the folder has [${onDisk}]`);
  }
});

test("every page is a route module at its own path", () => {
  // The file IS its route: index.tsx mounts "/", book.tsx mounts "/book". The
  // harness posts them under src/routes verbatim, so a wrong path here is a
  // page the build serves at the wrong address — or twice.
  for (const [name, pages] of Object.entries(src)) {
    for (const [file, s] of Object.entries(pages)) {
      const route = file === "index" ? "/" : "/" + file;
      assert.ok(s.includes(`createFileRoute("${route}")`),
        `${name}/${file}.tsx does not mount createFileRoute("${route}")`);
    }
  }
});

test("multi-page apps link between their own pages", () => {
  // A page set that never cross-links is N separate sites sharing a folder.
  // Hash history is the published-site reality, so the links are "#/book"
  // style; every non-index page must be reachable from somewhere in the app,
  // and every non-index page must offer a way back.
  for (const name of FAMILY_NAMES) {
    const pages = src[name];
    const all = Object.values(pages).join("\n");
    for (const p of FAMILIES[name].pages) {
      if (p.file === "index") continue;
      assert.ok(all.includes(`"#/${p.file}"`), `${name}: nothing links to #/${p.file}`);
      assert.ok(pages[p.file].includes('"#/'), `${name}/${p.file}.tsx has no way back into the app`);
    }
  }
});

test("every app leans on its OWN family's components", () => {
  // The app is the proof the directive is buildable. One that ignores the
  // family's kit proves nothing — and would teach the model to ignore it too.
  for (const name of FAMILY_NAMES) {
    const all = Object.values(src[name]).join("\n");
    const cited = FAMILIES[name].components.filter((c) => all.includes(`@/components/ui/${c}"`));
    assert.ok(cited.length >= 3,
      `${name} imports only [${cited}] of its family's components — needs at least 3`);
  }
});

test("family pages are presentational BY DESIGN — no data hooks, no fetch", () => {
  // Arrangement is schema-independent; a page that read tables would need a
  // schema to lint against and would break the moment one changed. The
  // reference SITE (src/routes) is where wiring is taught, deliberately.
  for (const [name, pages] of Object.entries(src)) {
    for (const [file, s] of Object.entries(pages)) {
      assert.ok(!s.includes("@/lib/rows"), `${name}/${file} imports @/lib/rows — wiring belongs to the reference site`);
      assert.ok(!/\bfetch\s*\(/.test(s), `${name}/${file} calls fetch`);
    }
  }
});

test("the folder is excluded from BOTH static passes and owned by the harness", () => {
  // The charts lesson, one level deeper. Excluded-from-build must mean
  // moved-somewhere, and for these files "somewhere" cannot be the kit pass:
  // each app's routes exist only in a tree generated from its own files, so
  // the kit tsc would refuse every non-"/" path. The owner is the integration
  // harness, which builds each family for real — assert it exists and derives
  // its list from the module rather than naming families it remembers.
  const strip = (t) => t.replace(/\/\/[^\n]*/g, "");
  const buildCfg = strip(fs.readFileSync(path.join(TEMPLATE, "tsconfig.json"), "utf8"));
  const kitCfg = strip(fs.readFileSync(path.join(TEMPLATE, "tsconfig.kit.json"), "utf8"));
  assert.ok(buildCfg.includes('"src/family-pages"'), "site builds are paying to typecheck the family pages");
  assert.ok(!kitCfg.includes("family-pages"), "the kit pass claims family-pages and would refuse their routes");
  const harness = fs.readFileSync(path.join(import.meta.dirname, "integration/family-apps.mjs"), "utf8");
  assert.ok(harness.includes("FAMILY_NAMES") && harness.includes("site-layouts.mjs"),
    "the family-apps harness no longer derives its coverage from the module");
  assert.ok(harness.includes("FAMILIES[name].pages"),
    "the harness builds some other page list than the declared one");
});
