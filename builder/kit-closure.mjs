/**
 * THE KIT FILES A SITE ACTUALLY HAS.
 *
 * The Code tab showed 28 files and the Download zipped the same 28 — and
 * `src/routes/__root.tsx`, which IS one of them, imports `@/components/ui/sonner`.
 * So the project a customer downloaded could not build: a folder of source whose
 * imports name modules that are not in it. That is the defect this module exists
 * to close, and the explorer showing the real project falls out of the same fix
 * (owner, 2026-09-12, holding Lovable's tree beside ours: *"look at all of this,
 * we dont have all of it"*).
 *
 * IT IS THE CLOSURE, NOT THE KIT. The kit is 3,394 files and 17 MB — 2,112 of
 * them under `src/components/ui` alone — and shipping that to a browser on every
 * tab open is not a thing anybody should do. But a SITE does not have 3,394
 * files; it has the ones its pages import, transitively. MEASURED over twelve
 * real generated sites from the corpus: **13 to 46 files, 105,027 to 192,138
 * bytes, 38 to 65 KB gzipped** — which is the same order as the 25 shared files
 * already sent today, and comparable to what a shadcn project carries in total.
 * So there is nothing to lazy-load and no second store to keep: the closure
 * travels with the source, the way `parts` does.
 *
 * WHY IT IS COMPUTED WHERE THE FILES ARE. The Worker can work out WHICH files a
 * site needs — it holds the page source — but not what is IN them: the kit lives
 * in the container image and the Worker has no filesystem. The container has
 * both halves at publish time, so it resolves the closure and hands it up with
 * everything else it already returns.
 *
 * DEPENDENCY-FREE, and the reader is injected, because it has to run in three
 * places that have nothing in common: the container (real files on disk), the
 * Worker's tests (a fake map), and this repository's own corpus scan.
 */

/** `@/x` is `src/x` — the alias `components.json` and `tsconfig` both declare. */
export const ALIAS = "@/";
export const ALIAS_ROOT = "src/";

/**
 * The extensions tried, IN ORDER, and the order is the resolver.
 *
 * `@/components/ui/button` is a file (`button.tsx`); `@/components/ui/chart` may
 * be a directory with an `index.tsx`. Trying the bare path LAST rather than first
 * is what keeps `foo.tsx` winning over a `foo` directory, which is what the
 * bundler does.
 */
export const TRIES = [".tsx", ".ts", "/index.tsx", "/index.ts", ""];

/**
 * Every `@/…` specifier in a source file.
 *
 * IMPORTS AND RE-EXPORTS BOTH, because a kit component that re-exports another
 * (`export { x } from "@/components/ui/y"`) needs `y` in the project just as
 * much as an import does — and `from "…"` is the one spelling both share.
 *
 * A DYNAMIC `import("@/…")` IS MATCHED TOO. It is how a page lazy-loads a heavy
 * component, and a build that cannot resolve it fails exactly like a static one.
 */
export function kitSpecs(source) {
  const src = typeof source === "string" ? source : "";
  const out = [];
  for (const m of src.matchAll(/(?:from|import)\s*\(?\s*["'](@\/[^"']+)["']/g)) out.push(m[1]);
  return out;
}

/** `@/components/ui/button` → `src/components/ui/button`. Anything else is left alone. */
export function aliasPath(spec) {
  const s = typeof spec === "string" ? spec : "";
  return s.startsWith(ALIAS) ? ALIAS_ROOT + s.slice(ALIAS.length) : "";
}

/**
 * Walk the import graph from `seeds` and answer every kit file the project needs.
 *
 * @param seeds   the source of the files a build already has — the generated
 *                pages, the parts written for this site, and the shared set.
 * @param read    (path) => string | null, over the template's real files.
 * @param have    paths the project already carries, so the closure is only what
 *                is MISSING. The 25 shared files are in here, which is why
 *                `src/lib/utils.ts` is not counted twice.
 *
 * ANSWERS WHAT IT COULD NOT FIND, rather than dropping it. A specifier that
 * resolves to nothing is a page that will not build, and it is the one thing
 * worth saying out loud — `repairImports` exists upstream for exactly this class
 * and a silent drop here would hide its misses.
 *
 * BOUNDED. `MAX_KIT_FILES` is a ceiling on a closure, not a budget to fill: the
 * worst real site measured needs 46 and the bound is 400, so it can only ever
 * catch a runaway (a cycle through a barrel file, a template that starts
 * re-exporting the world). Reaching it is reported, never silently truncated.
 */
export const MAX_KIT_FILES = 400;

export function kitClosure(seeds, read, have = []) {
  const known = new Set((Array.isArray(have) ? have : []).map(String));
  const files = [];
  const missing = [];
  const seen = new Set();
  // A QUEUE, NOT RECURSION: the kit re-exports through barrel files and a cycle
  // is an ordinary thing there — `seen` is what makes one terminate, and it is
  // keyed on the RESOLVED path rather than the specifier, so `@/lib/utils` and
  // `@/lib/utils.ts` cannot both be walked.
  const queue = [];
  for (const s of (Array.isArray(seeds) ? seeds : [])) {
    for (const spec of kitSpecs(typeof s === "string" ? s : (s && s.source))) queue.push(spec);
  }
  let capped = false;
  while (queue.length) {
    const spec = queue.shift();
    const base = aliasPath(spec);
    if (!base) continue;
    let hit = null;
    for (const ext of TRIES) {
      const path = base + ext;
      if (seen.has(path)) { hit = "seen"; break; }
      const text = read(path);
      if (typeof text === "string") { hit = { path, text }; break; }
    }
    if (hit === "seen") continue;
    if (!hit) { if (!missing.includes(spec)) missing.push(spec); continue; }
    seen.add(hit.path);
    // ALREADY IN THE PROJECT — walked for ITS imports, never sent again. The
    // shared set is the case: `src/lib/utils.ts` is bundled already, and it
    // imports things of its own that the closure still has to carry.
    if (!known.has(hit.path)) {
      if (files.length >= MAX_KIT_FILES) { capped = true; continue; }
      files.push({ path: hit.path, source: hit.text });
    }
    for (const next of kitSpecs(hit.text)) queue.push(next);
  }
  // ONE ORDER, ALWAYS, so two builds of an unchanged site store the same bytes
  // and the explorer does not reshuffle under a customer between publishes.
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { files, missing, capped };
}
