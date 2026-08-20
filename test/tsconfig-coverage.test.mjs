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
  // (never edited by hand, only ever imported) or covered by the kit config. A
  // third exclusion added for speed fails here until somebody decides which it
  // is.
  //
  // THERE IS NO `HARNESSED` ESCAPE HATCH ANY MORE, and losing it is the point.
  // It held `src/family-pages` and `src/variant-pages`, each pointed at
  // `test/integration/family-apps.mjs` — a real per-family build, because those
  // pages declared routes the template's own tree never registers. That harness
  // was deleted with the families on 2026-08-20, at which point the exclusion
  // was covered by nothing and this test was correct to go red: files excluded
  // from the build check and checked by nothing else is exactly what it exists
  // to catch.
  //
  // It was answered by MOVING the pages out of the template rather than by
  // widening the exemption. They are test data now (`test/fixtures/corpus/`),
  // reach no prompt and ship in nothing, so there is no exclusion left to
  // justify — and the container stopped carrying 3.4 MB it never used. Adding a
  // per-directory exemption back is how a real gap gets waved through, so the
  // shape of this check is deliberately narrower than it was.
  const CATALOGUE = new Set(["src/components/charts"]);
  const covered = (dir) => kit.include.some((g) => g.replace(/\/\*\*.*$/, "").startsWith(dir));
  for (const dir of base.exclude) {
    assert.ok(CATALOGUE.has(dir) || covered(dir),
      `${dir} is excluded from the build check and checked by nothing else — add it to tsconfig.kit.json`);
  }
  // And the exclusions really name directories that exist. `src/variant-pages`
  // sat in the map above for months after the directory was gone: an exemption
  // for something absent reads as coverage of something real.
  for (const dir of base.exclude) {
    assert.ok(fs.existsSync(path.join(TEMPLATE, dir)), `tsconfig.json excludes ${dir}, which is not on disk`);
  }
});

test("the calibration corpus is out of the template, and still there", () => {
  // BOTH HALVES, because each without the other is a different silent failure.
  //
  // Back inside `src/`, it ships in every build container image again (the
  // Dockerfile copies the template wholesale) and needs an exclusion to keep the
  // per-build typecheck fast — which is what put this file in the state above.
  //
  // Gone entirely, about a dozen checks that measure their FALSE-ALARM RATE
  // against these pages start walking an empty directory. Most of them assert an
  // absence — no physical utility, no dangling link, no invented prop — and an
  // absence over nothing is trivially true, so they would all report clean while
  // covering nothing at all. Their own floors catch it one at a time; this says
  // it once, at the cause.
  assert.ok(!fs.existsSync(path.join(TEMPLATE, "src/family-pages")),
    "the corpus is back inside the template — it ships in every build image from there");
  const dir = path.join("test", "fixtures", "corpus");
  assert.ok(fs.existsSync(dir), "the calibration corpus is gone — every check that measures against it now proves nothing");
  const count = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).length;
  assert.ok(count > 90, "only " + count + " corpus families found — the corpus is being eaten");
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

test("the generated corpus is pinned, and out of the eval's own output directory", () => {
  // BOTH HALVES, like the calibration corpus above, and for a reason that is not
  // hypothetical: it happened on 2026-08-20.
  //
  // Four checks read the only pages in this repo the GENERATOR wrote — the nav
  // slot-finder, the anchor rule and two order-lane checks — and they used to
  // read them straight out of `docs/auth-audit/pages/`, which is `page gen
  // eval`'s per-run output. The eval `git add`s that directory wholesale, so a
  // run whose menu and tool scenarios both failed committed one site and DELETED
  // the other two: 8 pages across 3 sites became 4 across 1, and four floor
  // guards went red on main for a reason unrelated to any change.
  //
  // Gone the other way — no floors — those checks would have gone quietly
  // VACUOUS instead, which is the worse of the two.
  const dir = path.join("test", "fixtures", "generated");
  assert.ok(fs.existsSync(dir), "the generated corpus is gone — four checks now measure against nothing");
  const sites = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory());
  assert.ok(sites.length >= 3, "only " + sites.length + " generated sites — the corpus is being eaten");

  // AND NOTHING READS THE EVAL'S OUTPUT DIRECTORY AS A CORPUS ANY MORE. Restoring
  // one of those reads is what brings the coupling straight back, and it reads as
  // an innocent path change.
  // THE NEEDLE IS BUILT AT RUNTIME, so this file does not match itself — the
  // alternative is a self-exemption, which is a hole somebody later widens. Same
  // trick `test/source-bytes.test.mjs` uses for the same reason. Comments are
  // blanked too, because prose explaining why the coupling was removed spells
  // the path it was removed from: the trap this repo has recorded eight times.
  const needle = ["docs", "auth-audit", "pages"].join("/");
  for (const f of fs.readdirSync("test").filter((n) => n.endsWith(".test.mjs"))) {
    const src = fs.readFileSync(path.join("test", f), "utf8").replace(/^\s*\/\/.*$/gm, "");
    assert.ok(!src.includes(needle),
      f + " reads the eval's own output directory as a corpus — a failed run will eat it");
  }
});
