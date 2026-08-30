// A CI STEP THAT RUNS TESTS WITHOUT INSTALLING WHAT THEY IMPORT.
//
// THE FAILURE THIS EXISTS TO END, recorded 2026-08-30. `site-build.yml` ran
// `node --test test/page-gen.test.mjs test/publish-pages.test.mjs` under the
// comment "both modules are dependency-free, so no install is needed" — true
// when it was written. Then `builder/site-qr.mjs` began importing
// `qrcode-generator` to draw a QR code, one test there evaluates the real design
// tool (which imports that module), and the step began failing with "Cannot find
// package 'qrcode-generator'".
//
// IT STAYED RED FOR FIVE COMMITS. The suite passes locally, where the dependency
// IS installed, so nothing anybody ran locally said a word: the check and the
// thing it checked disagreed about the environment, which is the one
// disagreement a test cannot report on itself.
//
// ── WHY THIS IS BLUNT RATHER THAN CLEVER ────────────────────────────────────
//
// The first draft walked the import graph of the named test files and asked
// whether any bare specifier survived. It FALSE-ALARMED immediately, and
// instructively: these test files carry example page source as string
// fixtures, so a regex looking for `import … from "…"` finds `@/lib/rows` and
// `@/components/ui/hero-split` — imports in a STRING, in a language the graph
// walker does not parse. Distinguishing those needs a real parser, and this
// repo's standing rule is that a check which flags correct code teaches the next
// session away from something that works.
//
// So the property asserted is the blunt one, and it is still true: a step that
// runs any of this repo's tests must install this repo's dependencies first.
// There is no false-alarm surface — complying costs one line — and it catches
// the whole class rather than today's package.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const WF = new URL("../.github/workflows/", import.meta.url).pathname;

test("every workflow step that runs `node --test` installs dependencies first", () => {
  const files = readdirSync(WF).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));
  assert.ok(files.length >= 5, "almost no workflows found — this guard is reading the wrong directory");

  let steps = 0;
  for (const f of files) {
    const src = readFileSync(path.join(WF, f), "utf8");
    for (const m of src.matchAll(/^\s*-\s*run:\s*node --test\b.*$/gm)) {
      steps++;
      // ORDERING IS THE WHOLE PROPERTY. An install that runs after the tests is
      // an install that ran too late, which is exactly as broken as none — so
      // this looks BACKWARDS from the step rather than anywhere in the file.
      const before = src.slice(0, m.index);
      assert.match(before, /npm ci/,
        f + " runs `node --test` without installing root dependencies first — a test that imports any real " +
        "package will fail there and pass everywhere else");
    }
  }
  // THE OBSERVER IS ALIVE. If the scan stops matching — a workflow reformatted,
  // the runner invoked differently — it would report perfect compliance while
  // checking nothing, which is this repo's vacuous-assertion trap.
  assert.ok(steps >= 1, "no `node --test` step found in any workflow — the scan has drifted and proves nothing");
});

test("the package the QR step needs is DECLARED, not just installed", () => {
  // The other half of the same failure, and it fails the opposite way round: a
  // module importing a package nobody declared works on a machine that happens
  // to have it and nowhere else. Named rather than derived, because the derived
  // version is the graph walk that false-alarmed — and one real dependency
  // asserted honestly beats a clever check that cries wolf.
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url).pathname, "utf8"));
  const deps = pkg.dependencies || {};
  const qr = readFileSync(new URL("../builder/site-qr.mjs", import.meta.url).pathname, "utf8");
  assert.match(qr, /from "qrcode-generator"/, "the QR module no longer imports the encoder — this check is stale");
  assert.ok(Object.hasOwn(deps, "qrcode-generator"),
    "builder/site-qr.mjs imports `qrcode-generator` and package.json does not declare it");
});
