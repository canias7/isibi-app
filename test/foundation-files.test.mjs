// THE SHARED FILES THE EXPLORER SHOWS, AND THE COPY THAT MUST NOT DRIFT.
//
// `builder/foundation-files.mjs` is a COPY of files that live in
// `builder/lovable/template/`, bundled because a Worker has no filesystem and
// the template lives in the container image. A copy drifts, so it is generated
// and this re-runs the generator and compares — `builder/component-api.mjs` is
// the precedent, down to the failure message.
//
// WHAT WOULD GO WRONG WITHOUT IT: somebody edits the template's `router.tsx`,
// every site is built from the new one, and the explorer keeps showing the old
// one. Not a crash — a code viewer quietly lying about the project it is
// showing, which is worse than not showing it at all.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { read, render, FOUNDATION_PATHS } from "../builder/gen-foundation.mjs";
import { FOUNDATION_FILES } from "../builder/foundation-files.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = path.join(here, "../builder/lovable/template");
const DOCKERFILE = fs.readFileSync(path.join(here, "../Dockerfile"), "utf8");

test("the committed foundation is what the generator makes from the template today", () => {
  const committed = fs.readFileSync(path.join(here, "../builder/foundation-files.mjs"), "utf8");
  assert.equal(render(read(TEMPLATE)), committed,
    "builder/foundation-files.mjs is stale — run `node builder/gen-foundation.mjs`");
});

test("every foundation path is a real file in the template", () => {
  for (const rel of FOUNDATION_PATHS) {
    assert.ok(fs.existsSync(path.join(TEMPLATE, rel)), "the foundation names a file the template has not got: " + rel);
  }
  assert.ok(FOUNDATION_PATHS.length >= 15, "the foundation has shrunk — re-derive it");
  assert.equal(FOUNDATION_FILES.length, FOUNDATION_PATHS.length, "a path produced no file");
  for (const f of FOUNDATION_FILES) assert.ok(f.source.length, f.path + " was bundled empty");
});

test("a foundation file is one the REPOSITORY has, never one a build made", () => {
  // THIS COST A RED CI RUN, and the case above is why it took one. `existsSync`
  // asks the FILESYSTEM, and on any machine that has ever run a real build of the
  // template the filesystem holds files git does not: `src/routeTree.gen.ts` is
  // written by TanStack's router generator from whatever is in `src/routes`, and
  // the template's own `.gitignore` names it. It was in FOUNDATION_PATHS. Locally
  // it read perfectly and baked THAT machine's copy into the committed module — a
  // file no checkout has, listing routes no site has, shown to customers under
  // "Shared with every site". On a fresh checkout it is ENOENT, which is the only
  // reason anybody found out.
  //
  // SO ASK GIT. Untracked and ignored are the same answer here: neither is a file
  // the repository can promise is the same on every machine.
  const tracked = new Set(
    execFileSync("git", ["ls-files", "-z", "--", "builder/lovable/template"], { cwd: path.join(here, ".."), encoding: "utf8" })
      .split("\0").filter(Boolean).map((p) => p.replace(/^builder\/lovable\/template\//, "")),
  );
  // THE OBSERVER IS ALIVE FIRST: a `git ls-files` that answered nothing would
  // make every assertion below vacuous and report a clean set over no data.
  assert.ok(tracked.size > 1000, "the template listing came back empty — this check is measuring nothing (" + tracked.size + ")");
  for (const rel of FOUNDATION_PATHS) {
    assert.ok(tracked.has(rel),
      "the foundation names a file git does not track — a build made it, so it is site-specific and differs per machine: " + rel);
  }
  // AND THE ONE THAT GOT IN IS NAMED, so nobody puts it back by reading the
  // template's directory listing and assuming a `.ts` beside the root route
  // belongs with it.
  assert.ok(!FOUNDATION_PATHS.includes("src/routeTree.gen.ts"),
    "the generated route tree is back in the shared set");
});

test("THE PROJECT ROOT IS COMPLETE — every tracked root file is shown", () => {
  // THIS IS THE CHECK THAT WAS MISSING, and its absence is what the owner found
  // by holding Lovable's explorer up beside ours (2026-09-12). The list named
  // the four root files the BUILD reads — `package.json`, `tsconfig.json`,
  // `vite.config.ts`, `components.json` — and the other eight were in the
  // template, tracked by git, and simply not listed. Nothing failed: the tree
  // drew, the download worked, and what a customer got was the part of their
  // project our pipeline happens to consume rather than their project.
  //
  // DERIVED FROM GIT, NEVER A SECOND HAND-TYPED LIST. A list here would be "two
  // lists of the same thing" with the template as the other list, and it would
  // drift the same silent way the first one did. Asking git also settles the
  // generated-file question for free: `routeTree.gen.ts`, `.tanstack/` and
  // `node_modules/` are untracked or ignored, so they can never arrive through
  // this door — which is the red CI run of 2026-09-11, closed by derivation
  // rather than by naming the one file that got in.
  const rootFiles = execFileSync("git", ["ls-files", "-z", "--", "builder/lovable/template"], { cwd: path.join(here, ".."), encoding: "utf8" })
    .split("\0").filter(Boolean)
    .map((p) => p.replace(/^builder\/lovable\/template\//, ""))
    .filter((p) => !p.includes("/"));
  // THE OBSERVER IS ALIVE FIRST: an empty listing would make the loop vacuous
  // and report a complete root over no data at all.
  assert.ok(rootFiles.length >= 10, "the root listing came back short — this check is measuring nothing (" + rootFiles.length + ")");
  for (const rel of rootFiles) {
    assert.ok(FOUNDATION_PATHS.includes(rel),
      "the project root has a file the explorer does not show: " + rel + " — add it to FOUNDATION_PATHS, or state here why a customer should not see it");
  }
  // AND THE LOCK FILE BY NAME, because it is the one whose absence makes the
  // download unrunnable rather than merely incomplete, and the one whose size
  // makes it the first candidate somebody later drops to save bytes.
  assert.ok(FOUNDATION_PATHS.includes("package-lock.json"),
    "the lock file is gone — a downloaded project installs whatever is newest instead of what it was built against");
});

test("DRIVEN: a missing template file THROWS; it is never skipped", () => {
  // SKIPPING WOULD QUIETLY SHRINK THE TREE the day somebody renames a template
  // file, and the explorer would then show a project with no router in it —
  // wrong, and silent, which this repository rates as the worse failure.
  //
  // DRIVEN AGAINST A ROOT THAT REALLY LACKS THE FILES, because over the real
  // template nothing is missing, so a `try {} catch {}` wrapped round the read
  // changes no answer and reads exactly like a check nobody needs. The sweep
  // said so: that mutant survived every case in this file. A root with one file
  // in it is the shape that separates them.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gf-foundation-"));
  try {
    assert.throws(() => read(root), /ENOENT|no such file/i,
      "a foundation path that names nothing was skipped — the tree silently loses a file");
    // AND WITH ONE OF THEM PRESENT, so the throw is about the MISSING one rather
    // than about the directory being empty: a partial root must still refuse.
    const one = FOUNDATION_PATHS[0];
    fs.mkdirSync(path.join(root, path.dirname(one)), { recursive: true });
    fs.writeFileSync(path.join(root, one), "// present\n");
    assert.throws(() => read(root), /ENOENT|no such file/i,
      "a root holding SOME of the foundation answered a short list instead of refusing");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("the kit, the bundles and the demo routes are NOT in it", () => {
  const paths = FOUNDATION_FILES.map((f) => f.path);
  // THE KIT IS A DEPENDENCY, not a customer's project: 3,394 files and 9.5 MB,
  // and it would be in every Worker isolate.
  assert.ok(!paths.some((p) => p.startsWith("src/components/")), "the kit was bundled into the Worker");
  assert.ok(!paths.some((p) => p.includes("node_modules") || p.endsWith(".map")), "a build artefact was bundled");
  // THE IMAGE DELETES THE TEMPLATE'S DEMO ROUTES, so they are in no generated
  // site and showing one is showing a file that is not there. Derived from the
  // Dockerfile's own line rather than a list typed here.
  assert.match(DOCKERFILE, /find src\/routes -maxdepth 1 -name '\*\.tsx' ! -name '__root\.tsx' -delete/,
    "the image no longer deletes the demo routes — re-derive which routes a site really has");
  for (const gone of ["src/routes/index.tsx", "src/routes/book.tsx", "src/routes/account.tsx", "src/routes/manage.tsx"]) {
    assert.ok(!paths.includes(gone), "a demo route the image deletes is shown as part of every project: " + gone);
  }
  // `__root.tsx` IS THE ONE ROUTE THAT SURVIVES, and it is the platform's.
  assert.ok(paths.includes("src/routes/__root.tsx"), "the root route is missing from the shared set");
  // AND NOT `site-brand.ts`: the template's copy is a STUB the container
  // overwrites per build, so a shared copy is the one entry that would mislead.
  assert.ok(!paths.includes("src/site-brand.ts"), "the site-brand stub is shown as a shared file");
});

test("the bundle is the size it is meant to be, and the image carries it", () => {
  // A BOUND, NOT A NUMBER TO HIT. This text is in every isolate, so a change
  // that quietly multiplies it should be a decision somebody makes; the
  // existing precedent in this Worker is `builder/theme-candidates/` at ~292 KB.
  //
  // AND THE HEADROOM IS SMALL NOW, said out loud rather than discovered by a red
  // run. Adding the whole project root on 2026-09-12 took this 168,387 ->
  // 489,115, nearly all of it `package-lock.json` at 310,981. What TRAVELS is
  // far less — the Worker hands the set to the browser on every Code-tab open
  // and a lock file is the most repetitive JSON there is, so gzipped the whole
  // payload went 60,781 -> 126,616, about 66 KB more per open — but the bound
  // here is on the RAW text, because that is what sits in the isolate. So the
  // next file added is a decision: there are ~110,000 bytes left under it.
  const bytes = FOUNDATION_FILES.reduce((n, f) => n + f.source.length, 0);
  assert.ok(bytes > 50_000, "the foundation is suspiciously small — " + bytes + " bytes");
  assert.ok(bytes < 600_000, "the foundation has grown past the bundled-data precedent — " + bytes + " bytes");
  // `worker.js` is the job runtime inside the container, so anything it imports
  // must be on the image's COPY line or the container dies at import.
  assert.match(DOCKERFILE, /builder\/foundation-files\.mjs/, "the image does not carry the shared foundation");
});
