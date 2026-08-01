// Nothing falls between the two typecheck configs.
//
// tsconfig.json is what every site build runs, and it EXCLUDES four directories
// — the blocks, the charts, the examples and the 500-component kit — because a
// generated page imports a handful of them and TypeScript follows those imports
// anyway. tsconfig.kit.json covers the kit, once, in CI.
//
// The failure this guards is quiet and permanent: add `src/components/widgets`,
// exclude it for speed, forget to add it anywhere else, and those files are
// never typechecked again by anything. Every test still passes. Every build
// still succeeds. It surfaces the day a customer's site imports one.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const TEMPLATE = "builder/lovable/template";
/**
 * A tsconfig is JSONC: both comment styles, and trailing commas.
 *
 * STRING-AWARE, and it has to be. A regex `/\/\*[\s\S]*?\*\//` looks right and
 * silently ate `/**​/` out of the glob `src/components/ui/**​/*.ts`, leaving
 * `src/components/ui*.ts` — a config that still parsed, still looked plausible,
 * and matched nothing. That is the exact `strip()` failure CLAUDE.md records
 * against worker.js, and it does not announce itself.
 */
function readJsonc(p) {
  const src = fs.readFileSync(p, "utf8");
  let out = "", i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '"') {                                    // copy a string whole
      let j = i + 1;
      while (j < src.length && !(src[j] === '"' && src[j - 1] !== "\\")) j++;
      out += src.slice(i, j + 1); i = j + 1; continue;
    }
    if (c === "/" && src[i + 1] === "*") { i = src.indexOf("*/", i + 2) + 2 || src.length; continue; }
    if (c === "/" && src[i + 1] === "/") { const n = src.indexOf("\n", i); i = n === -1 ? src.length : n; continue; }
    out += c; i++;
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
}

const base = readJsonc(path.join(TEMPLATE, "tsconfig.json"));
const kit = readJsonc(path.join(TEMPLATE, "tsconfig.kit.json"));

test("the kit is excluded from the per-build check", () => {
  // Deterministic version of "is the 5.5s saving still real". The integration
  // test measures it; this one asserts it, because wall-clock is the wrong
  // thing to fail a build on.
  assert.ok(base.exclude.includes("src/components/ui"),
    "src/components/ui must stay excluded from tsconfig.json, or every site build pays for the whole kit again");
});

test("and it is picked up by the config that does check it", () => {
  assert.equal(kit.extends, "./tsconfig.json", "the kit config must inherit the same compiler options");
  assert.deepEqual(kit.exclude, [], "the kit config must exclude nothing — it is the safety net");
  assert.ok(kit.include.some((g) => g.startsWith("src/components/ui/")),
    "the kit config must actually include the kit");
});

test("every excluded directory is checked by something", () => {
  // Derived, not listed: whatever tsconfig.json excludes has to be a CATALOGUE
  // (never edited by hand, only ever imported), covered by the kit config, or
  // owned by a named integration harness. A fifth exclusion added for speed
  // fails here until somebody decides which it is.
  const CATALOGUE = new Set(["src/components/charts"]);
  // src/family-pages cannot join the kit pass: each family app declares routes
  // (/listing, /guide …) that only exist in a route tree generated from its
  // own files, so the honest check is a real per-family build. Owned by
  // test/integration/family-apps.mjs — asserted to exist and to derive its
  // coverage from site-layouts.mjs in test/family-pages.test.mjs.
  const HARNESSED = new Map([["src/family-pages", "test/integration/family-apps.mjs"]]);
  const covered = (dir) => kit.include.some((g) => g.replace(/\/\*\*.*$/, "").startsWith(dir));
  for (const dir of base.exclude) {
    if (HARNESSED.has(dir)) {
      assert.ok(fs.existsSync(HARNESSED.get(dir)), `${dir}'s harness ${HARNESSED.get(dir)} is gone`);
      continue;
    }
    assert.ok(CATALOGUE.has(dir) || covered(dir),
      `${dir} is excluded from the build check and checked by nothing else — add it to tsconfig.kit.json`);
  }
});

test("no source directory is invisible to both configs", () => {
  // The other direction: a directory that exists on disk and is matched by
  // neither config's include. `src/**` in the base covers everything today, so
  // this only fires if somebody narrows it.
  const dirs = fs.readdirSync(path.join(TEMPLATE, "src"), { withFileTypes: true })
    .filter((d) => d.isDirectory()).map((d) => "src/" + d.name);
  const broad = base.include.some((g) => g.startsWith("src/**"));
  for (const dir of dirs) {
    const inBase = broad && !base.exclude.some((e) => dir === e || dir.startsWith(e + "/"));
    const inKit = kit.include.some((g) => g.replace(/\/\*\*.*$/, "").startsWith(dir));
    assert.ok(inBase || inKit || base.exclude.some((e) => dir === e || dir.startsWith(e + "/")),
      `${dir} is matched by neither tsconfig — its files are never typechecked`);
  }
});

test("the CI job that runs the kit check exists and is triggered by a change to it", () => {
  // A safety net nothing runs is not a safety net. This is the same class of
  // check as the ones asserting a declared schema feature is actually reachable.
  const wf = fs.readFileSync(".github/workflows/site-build.yml", "utf8");
  assert.match(wf, /kit-typecheck\.mjs/, "site-build must run the full-kit typecheck");
  assert.match(wf, /'builder\/\*\*'/, "and must trigger on any change under builder/, which is where the kit lives");
});
