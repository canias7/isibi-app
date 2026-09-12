// EVERY PACKAGE THE PAGE WRITER IS TOLD IT MAY IMPORT MUST ACTUALLY COMPILE.
//
// THE BUILD THIS EXISTS TO STOP, measured on `ashgrove-1` 2026-08-30 and paid
// for at 45 credits. The 3D step was added on 2026-08-29 with `three` and
// `@react-three/fiber` put into the template's dependencies — and NOT
// `@types/three`. `three` is one of the rare packages that ships no type
// declarations of its own, so the moment a model wrote what the page rules
// invite it to write:
//
//     import type { Group } from "three"
//
// `tsc --noEmit` refused with TS7016 and the whole build failed at typecheck.
// The site kept its placeholder and the customer was charged.
//
// WHY NOTHING CAUGHT IT EARLIER, and this is the instructive half: the field
// was DEAD until the same day. The design step answered a scene and nothing
// forwarded it, so no page had ever imported `three` — the dependency was
// unreachable, and so was its missing type declaration. Wiring the feature up
// is what made the defect reachable. A feature that has never run has never
// been tested, however green the suite is.
//
// The local template `node_modules` is also stale and has neither package, so
// `site-build.mjs` passed 301/301 here without ever compiling an import of it.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname;
const pkg = JSON.parse(readFileSync(ROOT + "builder/lovable/template/package.json", "utf8"));
const rules = readFileSync(ROOT + "builder/page-gen.mjs", "utf8");
const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
// npm's own shape for an unscoped package name: lowercase, starting on a letter
// or a digit, then letters, digits, `.`, `_` or `-`. Kept here as ONE constant
// because it is asked twice below — once of the real manifest, once of the
// shapes npm refuses — and two copies of a rule drift.
const NPM_NAME = /^[a-z0-9][a-z0-9._-]*$/;

test("every package the page rules offer is a real template dependency", () => {
  // DERIVED FROM THE PROMPT, not from a list kept beside it. The rules say
  // "Import nothing that is not already a dependency" and then name the ones
  // that are — so the names in that sentence are a promise, and a promise about
  // a package nobody installed is a build that fails at the model's first
  // honest attempt to use it.
  const named = ["lucide-react", "date-fns", "recharts", "three", "@react-three/fiber"];
  for (const p of named) {
    assert.match(rules, new RegExp("`?" + p.replace("/", "\\/") + "`?"),
      "`" + p + "` is not named in the page rules any more — this list has drifted from the prompt it mirrors");
    assert.ok(Object.hasOwn(deps, p),
      "the page rules tell the model it may import `" + p + "` and the template does not depend on it");
  }
});

test("`three` carries its type declarations — the package that ships none", () => {
  // NAMED RATHER THAN DERIVED, and deliberately. The general rule — "every
  // dependency needs an @types package" — is FALSE: `recharts`, `date-fns` and
  // `lucide-react` all bundle their own declarations, and asserting @types for
  // them would flag correct code, which this repo holds to be worse than no
  // check at all.
  //
  // `three` is the exception among everything the page writer is offered, so it
  // is the exception that gets asserted, with the cost of getting it wrong
  // recorded above.
  assert.ok(Object.hasOwn(deps, "three"), "`three` is gone from the template — this check is stale");
  assert.ok(Object.hasOwn(deps.constructor === Object ? deps : {}, "@types/three"),
    "the template depends on `three`, which ships NO type declarations, and does not depend on `@types/three` — " +
    "any page that imports a three type fails `tsc` with TS7016 and takes the whole build down at the typecheck stage");

  // AND THE TWO TRACK EACH OTHER. A types package a major version adrift from
  // its runtime is the same failure wearing a subtler face: the declarations
  // describe a library the container does not have.
  const major = (r) => String(r || "").replace(/^[^0-9]*/, "").split(".").slice(0, 2).join(".");
  assert.equal(major(deps["@types/three"]), major(deps.three),
    "`@types/three` (" + deps["@types/three"] + ") and `three` (" + deps.three + ") are different minor lines — " +
    "three's declarations track its releases closely and a mismatch types a library the build does not ship");
});

test("the lockfile carries the types, or `npm ci` in the container installs nothing", () => {
  // THE CONTAINER RUNS `npm ci`, WHICH READS THE LOCKFILE AND NOT package.json.
  // A dependency added to one and not the other installs on a developer's
  // machine and nowhere else — the same environment disagreement that kept CI
  // red for five commits earlier today, arriving through a different door.
  const lock = readFileSync(ROOT + "builder/lovable/template/package-lock.json", "utf8");
  for (const p of ["three", "@react-three/fiber", "@types/three"]) {
    assert.ok(lock.includes('"node_modules/' + p + '"'),
      "`" + p + "` is in the template's package.json and not in its lockfile — `npm ci` will not install it");
  }
});

test("the project's name says the same thing in all three places it is written", () => {
  // `npm ci` REFUSES A LOCK FILE THAT DISAGREES WITH package.json ABOUT THE
  // NAME, and the name is written THREE times: once in `package.json`, and
  // twice in the lock — its own top-level `name` and the root package entry
  // `packages[""]`.name. The container's image build is `npm ci` (see the
  // Dockerfile's COPY of exactly these two files, pinned by
  // `test/dockerfile.test.mjs`), so a rename that reaches one and not the
  // others does not fail a test or a page — it fails the IMAGE BUILD, at
  // deploy, after everything here has gone green.
  //
  // NOTHING ASSERTED THIS UNTIL 2026-09-12, when the name was changed for the
  // first time: `isibi-lovable-clone` -> `gofarther-site` (owner: *"change the
  // name and merge"*), because showing the whole project root put
  // `package.json` in front of every customer and line two called the product a
  // clone of a competitor. Until that day the three agreed by never having been
  // touched, which is not a property — it is a habit, and this is the edit that
  // ended it.
  //
  // DERIVED FROM package.json, never a fourth copy typed here. A constant in
  // this file would be "two lists of the same thing" with the manifest as the
  // other list, and the next rename would have to find this line to stay green
  // — which is the same miss one layer up.
  //
  // AND THIS IS THE SECOND WALL, DELIBERATELY, WHICH A SWEEP CANNOT SAY.
  // `test/foundation-files.test.mjs` re-runs the generator and compares, and
  // both these files are bundled — so every wrong-name mutant makes the
  // committed bundle stale and dies there too. MEASURED, not assumed: the
  // seven mutants in `scripts/mutants/template-name.json` all die under either
  // test file ALONE, which reads exactly like one of the two walls being
  // pointless. It is not, and the case that separates them was measured by
  // hand: apply a partial rename and then REGENERATE the bundle, and the
  // staleness guard is satisfied (7 pass, 0 fail) while this one is the only
  // thing that fails (3 pass, 1 fail). A rename with a regenerate in the middle
  // of it is the likely mistake, not the unlikely one — so do not delete this
  // because nothing appears to need it.
  const lock = JSON.parse(readFileSync(ROOT + "builder/lovable/template/package-lock.json", "utf8"));
  // THE OBSERVER IS ALIVE FIRST: a lock file with no root package entry would
  // make the comparison below vacuous and pass over a name nobody wrote.
  assert.ok(pkg.name, "the template's package.json has no name — `npm ci` refuses a nameless project");
  assert.ok(lock.packages && lock.packages[""], "the lock file has no root package entry — this check is measuring nothing");
  assert.equal(lock.name, pkg.name,
    "the lock file's own name (" + lock.name + ") is not the project's (" + pkg.name + ") — `npm ci` refuses the pair and the container image fails to build");
  assert.equal(lock.packages[""].name, pkg.name,
    "the lock file's root package is named " + lock.packages[""].name + " and the project is " + pkg.name + " — `npm ci` refuses the pair and the container image fails to build");
  // AND IT MUST BE A NAME npm WILL TAKE. An uppercase letter or a space is a
  // refusal at install, which is the same deploy-time failure wearing a
  // different message; the rule is npm's, not ours.
  assert.match(pkg.name, NPM_NAME,
    "`" + pkg.name + "` is not a name npm accepts — lowercase, and no spaces");
  // DRIVEN, because one real value cannot prove a rule. `gofarther-site` passes
  // a regex that says nothing at all, and a sweep cannot tell the two apart
  // while only one name is ever asked: there is no second manifest to rename.
  // So the rule is asked about the shapes npm refuses, and about one it takes.
  for (const bad of ["GoFarther-Site", "gofarther site", " gofarther-site", "-gofarther", "", ".hidden"]) {
    assert.ok(!NPM_NAME.test(bad), "the name rule accepts " + JSON.stringify(bad) + ", which npm does not");
  }
  for (const good of ["gofarther-site", "a", "site.v2", "go_farther"]) {
    assert.ok(NPM_NAME.test(good), "the name rule refuses " + JSON.stringify(good) + ", which npm takes — a rule that refuses a valid rename blocks one");
  }
});
