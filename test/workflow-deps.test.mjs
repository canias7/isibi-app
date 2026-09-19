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

// ── …AND DECLARED IS NOT INSTALLABLE ────────────────────────────────────────
//
// ⚠ THE THIRD LINK IN THE SAME CHAIN, and it cost four more red pushes on
// 2026-09-19. The case above ends at *is it declared*; `unit.yml` and
// `site-build.yml` both run **`npm ci`**, which reads the LOCKFILE and treats
// package.json as a contract it must already satisfy. A package added to one
// and not the other is not "installed late" — `npm ci` REFUSES THE WHOLE
// INSTALL, in about a second, before a single test runs.
//
// So the fix for the render guards' missing `lucide-react` — declaring it at
// the root, which is exactly what the case above asks for — took CI from *two
// failing cases* to *no cases at all*, and the census written in the same
// commit could not see it, because it asserted the declaration and stopped
// there. **A stricter check on the wrong half of an invariant reads as
// progress.**
//
// AND IT FAILS IN THE LOUD DIRECTION, which is the only mercy here: the step
// goes red at once. What makes it expensive is that the red looks identical to
// a suite failure, so it is read as "the tests broke" rather than "the install
// refused" until somebody notices the job lasted sixteen seconds.
//
// DERIVED, NOT A LIST. The template's twin (`test/template-deps.test.mjs`)
// names its three packages, which is right there — they are a specific feature's
// specific dependencies. Here the subject is the manifest ITSELF, so a typed
// list would be a second copy of it and the next package added would have to
// find this line to stay green. That is the shape that let this through.
test("every root dependency is in the root lockfile, or `npm ci` refuses the whole install", () => {
  const root = new URL("..", import.meta.url).pathname;
  const pkg = JSON.parse(readFileSync(root + "package.json", "utf8"));
  const lock = JSON.parse(readFileSync(root + "package-lock.json", "utf8"));

  const declared = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const names = Object.keys(declared);

  // THE OBSERVER IS ALIVE. An empty manifest, or a lock whose root entry moved,
  // would satisfy every assertion below by having nothing to check.
  assert.ok(names.length >= 5,
    "fewer than five root dependencies — package.json is not being read: " + names.length);

  // `npm ci` COMPARES TWO THINGS and both are asserted, because they fail
  // differently: the lock's ROOT ENTRY is the copy of the manifest npm diffs
  // against (a range that moved is refused even though the package is present),
  // and `packages["node_modules/<name>"]` is the resolved tree it installs FROM
  // (a range that agrees with nothing resolved installs nothing).
  const rootEntry = (lock.packages || {})[""] || {};
  const lockDeclared = { ...(rootEntry.dependencies || {}), ...(rootEntry.devDependencies || {}) };

  const missing = names.filter((n) => !Object.hasOwn(lockDeclared, n));
  assert.deepEqual(missing, [],
    "declared in package.json and absent from the lockfile's root entry, so `npm ci` refuses the install " +
    "before any test runs — run `npm install --package-lock-only`: " + missing.join(", "));

  const drifted = names.filter((n) => lockDeclared[n] !== declared[n]);
  assert.deepEqual(drifted, [],
    "the lockfile's root entry records a different range from package.json, which `npm ci` refuses: " +
    drifted.map((n) => n + " (" + declared[n] + " vs " + lockDeclared[n] + ")").join(", "));

  const unresolved = names.filter((n) => !Object.hasOwn(lock.packages || {}, "node_modules/" + n));
  assert.deepEqual(unresolved, [],
    "declared and in the lockfile's root entry but with nothing resolved to install: " + unresolved.join(", "));
});

test("every workflow that runs the suite installs with `npm ci`, which is what makes the case above load-bearing", () => {
  // WITHOUT THIS THE CHECK ABOVE IS ABOUT NOTHING. `npm install` reconciles a
  // stale lock silently and would make a drifted range harmless; `npm ci`
  // refuses it. The strictness asserted above is the workflows' own choice, so
  // it is read from them rather than assumed — and if a workflow moves to
  // `npm install`, this goes red and the case above can be relaxed on purpose
  // instead of quietly protecting an invariant nothing depends on any more.
  //
  // ⚠ AND THE SCAN HAS TO ASK FOR BOTH SPELLINGS, which the first draft of this
  // case did not. Matching `node --test` alone reads THREE workflows and misses
  // **`unit.yml`** — the one whose `npm ci` is what actually broke — because it
  // runs `npm test`, and the `node --test` invocation lives in package.json's
  // scripts. A census that silently skips its own subject is this repository's
  // vacuous-assertion trap, and it was caught by printing what the scan found
  // rather than by trusting that a green case had looked at anything.
  const root = new URL("..", import.meta.url).pathname;
  const dir = root + ".github/workflows/";
  const scripts = JSON.parse(readFileSync(root + "package.json", "utf8")).scripts || {};

  // Which npm scripts really run the node test runner — derived, so renaming
  // `test` or adding a second suite script cannot slip past.
  const testScripts = Object.keys(scripts).filter((s) => /node --test/.test(scripts[s]));
  assert.ok(testScripts.includes("test"),
    "no npm script runs `node --test` — package.json moved and this scan is reading the wrong thing: " +
    JSON.stringify(scripts));
  const runsSuite = new RegExp("node --test|npm (run )?(" + testScripts.join("|") + ")\\b");

  const seen = [];
  for (const f of readdirSync(dir).filter((f) => /\.ya?ml$/.test(f))) {
    const y = readFileSync(dir + f, "utf8");
    if (!runsSuite.test(y)) continue;
    seen.push(f);
    assert.match(y, /npm ci\b/,
      f + " runs the suite and does not install with `npm ci` — the lockfile census no longer describes it");
  }

  // THE OBSERVER IS ALIVE, and specifically alive on the workflow this round is
  // about: a scan that stopped matching would report perfect compliance.
  assert.ok(seen.includes("unit.yml"),
    "unit.yml was not read — it is the workflow whose install refused, so a census that misses it proves nothing. Read: " + seen.join(", "));
  assert.ok(seen.length >= 2, "only " + seen.length + " suite-running workflow found — the scan has drifted: " + seen.join(", "));
});
