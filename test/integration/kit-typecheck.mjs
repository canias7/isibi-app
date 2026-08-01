// Typechecks the whole 500-component kit in one pass.
//
// WHY THIS EXISTS AS A SEPARATE THING. tsconfig.json excludes
// src/components/ui from the per-build check: a generated page imports ten or
// twenty of the 500, TypeScript still follows those imports, and the build goes
// 8.7s -> 3.0s. That is safe for anything a page reaches for — and it drops the
// floor out from under everything a page does NOT. Break a component nobody
// currently imports and nothing says so, until months later a generated site
// uses it and that build fails looking like the model's fault.
//
// So the check moved rather than went away. It runs here, once, on any change
// under builder/ — not 500 times a day inside customer builds.
//
// $0: no model call, no container, no Neon project.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const TEMPLATE = path.join(import.meta.dirname, "../../builder/lovable/template");
let failed = 0;
const ok = (label) => console.log("  ok   " + label);
const bad = (label, detail) => { failed++; console.log("  FAIL " + label + (detail ? "\n" + detail : "")); };

function tsc(project) {
  const started = Date.now();
  const r = spawnSync("npx", ["tsc", ...(project ? ["-p", project] : []), "--noEmit"],
    { cwd: TEMPLATE, encoding: "utf8" });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || ""), ms: Date.now() - started };
}

// The route tree comes first: the per-build check below needs it (main.tsx
// imports src/routeTree.gen.ts), and generating it up front means both tsc
// passes run against the same freshly generated file. src/family-pages is in
// NEITHER pass — each family app declares routes the template tree never
// registers, so they are typechecked per family by
// test/integration/family-apps.mjs, against a tree regenerated from their own
// files, which is the only configuration in which they are honest to check.
console.log("generating the route tree, as a site build does…");
const gen = spawnSync("npx", ["tsr", "generate"], { cwd: TEMPLATE, encoding: "utf8" });
if (gen.status === 0) ok("route tree generated");
else bad("could not generate the route tree", ((gen.stderr || "") + (gen.stdout || "")).slice(0, 600));

console.log("typechecking the whole kit…");
const kit = tsc("tsconfig.kit.json");
if (kit.code === 0) ok(`all components typecheck (${kit.ms}ms)`);
else bad("the component kit does not typecheck", kit.out.split("\n").slice(0, 20).join("\n"));

// The per-build config must still be clean, and must still be the FAST one —
// otherwise the exclusion has silently stopped applying and every site build is
// paying for the kit again with nobody noticing.
//
// `tsr generate` FIRST, because that is what a site build does — build-server
// runs it before typechecking for the stated reason that main.tsx imports
// src/routeTree.gen.ts. That file is generated and gitignored, so it exists on
// any machine that has ever built and never in a fresh checkout: this test
// passed locally and failed in CI on both errors it produces, which is the
// definition of "works on my machine". A test whose whole claim is that it
// checks things "the way a site build does" has to do the step the site build
// does, or it is testing a configuration nothing ever runs.
console.log("typechecking a build the way a site build does…");
const build = tsc(null);
if (build.code === 0) ok(`the per-build check is clean (${build.ms}ms)`);
else bad("the per-build typecheck failed", build.out.split("\n").slice(0, 20).join("\n"));
// Reported, not asserted. The saving is the whole reason for the split, so it
// is worth seeing in the log — but wall-clock is the wrong thing to fail a
// build on. Whether the exclusion is still in place is checked deterministically
// in test/tsconfig-coverage.test.mjs, off the config itself.
console.log(`  note per-build ${build.ms}ms · full kit ${kit.ms}ms · saved ${kit.ms - build.ms}ms per site build`);

// THE PROPERTY THE EXCLUSION RESTS ON, asserted rather than assumed: an
// excluded file is dropped from the INITIAL list, and TypeScript still follows
// an import into it. If that ever stopped being true, a page importing a broken
// component would bundle and publish.
console.log("proving an excluded component is still checked when imported…");
const routes = path.join(TEMPLATE, "src/routes");
const probeC = path.join(TEMPLATE, "src/components/ui/__probe.tsx");
const probeR = path.join(routes, "__probe.tsx");
try {
  fs.writeFileSync(probeC, "export function Probe({ n }: { n: number }) { return <p>{n}</p>; }\n");
  fs.writeFileSync(probeR,
    'import { Probe } from "@/components/ui/__probe";\n' +
    "export const bad = <Probe n=\"not a number\" />;\n");
  const r = tsc(null);
  if (r.code !== 0 && /__probe/.test(r.out)) ok("a type error in an excluded component is still reported");
  else bad("an excluded component's error was NOT caught — the exclusion is a real exclusion now", r.out.slice(0, 600));
} finally {
  fs.rmSync(probeC, { force: true });
  fs.rmSync(probeR, { force: true });
}

console.log(`\n${4 - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
