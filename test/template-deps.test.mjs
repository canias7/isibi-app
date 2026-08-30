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
