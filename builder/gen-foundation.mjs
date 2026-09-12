/**
 * Generates `builder/foundation-files.mjs` — the SHARED files every generated
 * site is built from, as text the Worker can hand to the code explorer.
 *
 * WHY A GENERATED MODULE. These files live in `builder/lovable/template/` and
 * are baked into the container image; the Worker has no filesystem and cannot
 * read them. There are three ways to get them to a customer's explorer — put a
 * copy in R2 at deploy time, serve them from the container, or bundle them —
 * and bundling is the only one that adds no moving part: no upload step to
 * forget, no container round trip to show a file, no second store to keep in
 * step with the image.
 *
 * IT IS A COPY, AND A COPY DRIFTS — which is exactly why this is generated
 * rather than hand-written, and why `test/foundation-files.test.mjs` re-runs
 * this and compares. `builder/component-api.mjs` is the precedent, down to the
 * failure message. Run `node builder/gen-foundation.mjs` after touching the
 * template's own source.
 *
 * WHAT IS IN AND WHAT IS OUT, and both halves were decided rather than fallen
 * into (owner, 2026-09-11: *"shared foundation files used by the project"*,
 * *"don't dump thousands of unused kit components or compiled bundles"*):
 *
 *   IN  — the app's own scaffold: the router, the server entry, the root route,
 *         the data layer, the helpers and the hooks — AND THE WHOLE PROJECT
 *         ROOT, all twelve files. 25 files.
 *
 * THE ROOT IS COMPLETE RATHER THAN THE FOUR FILES A BUILD READS (owner,
 * 2026-09-12, holding up Lovable's explorer beside ours: *"i [want] it to show
 * it too"*). This listed `package.json`, `tsconfig.json`, `vite.config.ts` and
 * `components.json` — the ones the BUILD consumes — and left the other eight
 * out, which made the difference between showing a project and showing the part
 * of it our pipeline happens to read. **Every one of the twelve was already in
 * the template and already tracked**; nothing was generated for this and nothing
 * new is stored. What the eight are: `README.md` and `AGENTS.md` (what this is,
 * for a person and for the next AI tool), `eslint.config.js`, `.prettierrc` and
 * `.prettierignore` (how the code is checked and laid out), `tsconfig.kit.json`
 * (the kit's own compiler settings), `.gitignore`, and the lock file.
 *
 * AND THE LOCK FILE IS THE ONE THAT MAKES THE DOWNLOAD A PROJECT. `package.json`
 * says "React 19"; `package-lock.json` says React 19.0.2 and four hundred others
 * at exact versions, so an install next month resolves to what this site was
 * built against rather than to whatever is newest. Without it the zip is a thing
 * you read; with it, it is a thing you run.
 *
 * ITS COST, MEASURED BEFORE IT WENT IN, because it is 310,981 bytes against the
 * other eleven's ~24,000 and the Worker hands the whole shared set to the
 * browser on every Code-tab open (`worker.js`, `shared: FOUNDATION_FILES`).
 * **Gzipped it is 62,346** — a lock file is the most repetitive JSON there is —
 * and that is what actually travels. The bundle goes 168,387 -> ~489,000 raw,
 * inside the 600,000 bound the size guard already held for the
 * `theme-candidates/` precedent, and that bound is now close enough that the
 * next thing added here is a decision rather than a habit.
 *   OUT — `src/components/**`: 3,394 kit files, 9.5 MB. A dependency, and no
 *         more part of a customer's project than `node_modules` is. Bundling it
 *         would also put 9.5 MB into every Worker isolate.
 *   OUT — the template's DEMO routes (`index.tsx`, `book.tsx`, `account.tsx`,
 *         `manage.tsx`) and `src/routes/README.md`. The image DELETES these
 *         (`Dockerfile`, the `find src/routes -delete` line), so they are not in
 *         any generated site and showing them would be showing a file that is
 *         not there.
 *   OUT — `src/site-brand.ts`. The template's copy is a STUB and the container
 *         overwrites it per build, so the shared copy is site-specific by nature
 *         and would be actively misleading.
 *   OUT — `src/routeTree.gen.ts`, AND FINDING IT COST A RED CI RUN. It is not in
 *         the repository at all: `builder/lovable/template/.gitignore` names it,
 *         because TanStack's router generator WRITES it from whatever is in
 *         `src/routes` — so every site's build makes its own, listing that
 *         site's pages. It was in this list, and on a machine that had ever run
 *         a real build it read perfectly and baked THAT machine's copy into the
 *         committed module: a file no checkout has, showing routes no site has.
 *         On a fresh checkout it is simply ENOENT, which is what CI said.
 *
 * SO A FOUNDATION FILE MUST BE ONE THE REPOSITORY ACTUALLY HAS, and the guard
 * asks GIT rather than the filesystem — `fs.existsSync` is exactly the test that
 * passed here while the file was untracked. Derived, so the next generated file
 * cannot enter this list either.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = path.join(HERE, "lovable", "template");

/**
 * The files, in the order a reader wants them: the entry points first, then the
 * root route, then the library, then the configuration. Never alphabetical —
 * `components.json` is not where anybody starts reading a project.
 */
export const FOUNDATION_PATHS = [
  "src/router.tsx",
  "src/server.ts",
  "src/routes/__root.tsx",
  "src/styles.css",
  "src/site-locale.ts",
  "src/site-runtime.ts",
  "src/fonts.ts",
  "src/lib/rows.ts",
  "src/lib/utils.ts",
  "src/lib/error-page.tsx",
  "src/lib/error-reporting.ts",
  "src/lib/spam-guard.tsx",
  "src/hooks/use-mobile.tsx",
  // THE PROJECT ROOT, WHOLE — all twelve, in the order a reader wants them:
  // what this is, what it needs, how it builds, how it is checked, and the
  // machine-written list last.
  "README.md",
  "AGENTS.md",
  "package.json",
  "tsconfig.json",
  "tsconfig.kit.json",
  "vite.config.ts",
  "eslint.config.js",
  "components.json",
  ".prettierrc",
  ".prettierignore",
  ".gitignore",
  "package-lock.json",
];

/** Read every foundation file, refusing rather than skipping a missing one. */
export function read(root = TEMPLATE) {
  const out = [];
  for (const rel of FOUNDATION_PATHS) {
    const full = path.join(root, rel);
    // A MISSING FILE IS A THROW, NOT A SKIP. Skipping would quietly shrink the
    // tree the day somebody renames a template file, and the explorer would
    // show a project with no router in it — wrong, and silent.
    out.push({ path: rel, source: fs.readFileSync(full, "utf8") });
  }
  return out;
}

/** The module text, so the guard can compare it against what is committed. */
export function render(files) {
  return [
    "// GENERATED by builder/gen-foundation.mjs — do not edit by hand.",
    "//",
    "// The shared files every generated site is built from, as the code explorer",
    "// shows them. They are identical on every site: what a build changes is",
    "// `src/routes/**`, `src/site-brand.ts` and the theme layer appended to",
    "// `src/styles.css`, and nothing else here moves.",
    "//",
    "// The kit under `src/components/` is deliberately absent — 3,394 files and",
    "// 9.5 MB, a dependency rather than a customer's own project.",
    "export const FOUNDATION_FILES = " + JSON.stringify(files, null, 2) + ";",
    "",
  ].join("\n");
}

const OUT = path.join(HERE, "foundation-files.mjs");

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const files = read();
  fs.writeFileSync(OUT, render(files));
  const bytes = files.reduce((n, f) => n + f.source.length, 0);
  console.log("wrote " + OUT + " — " + files.length + " files, " + bytes + " bytes");
}
