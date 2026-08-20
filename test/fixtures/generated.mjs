// THE ONLY PAGES IN THIS REPO THE GENERATOR WROTE — pinned, so a bad eval run
// cannot eat them.
//
// These eight files are committed output from `page gen eval`: the one corpus
// here written by the thing our checks lint, as opposed to the 324 exemplars,
// which are pages WE wrote in the house style. About four checks measure their
// false-alarm rate against them — the nav slot-finder, the anchor rule, the
// order lane — precisely because a rule tuned only on our own pages is tuned to
// us rather than to the model.
//
// THEY USED TO BE READ STRAIGHT OUT OF `docs/auth-audit/pages/`, AND THAT
// DIRECTORY IS THE EVAL'S OWN PER-RUN OUTPUT. The eval `git add`s it wholesale
// every run, so the corpus was whatever the LAST run happened to produce.
// Measured 2026-08-20: a run whose menu and tool scenarios both failed committed
// only `booking-1` and DELETED the other two, taking the corpus from 8 pages
// across 3 sites to 4 across 1 — and four floor guards went red on main for a
// reason that had nothing to do with any change.
//
// The floors did their job: they exist because most of those checks assert an
// ABSENCE, and an absence over a shrunken corpus is a weaker claim wearing the
// same green tick. But going red on every unlucky eval run is not a workable
// signal either, and the honest fix is the one this repo already applied to the
// 324 exemplars when the families were deleted: the CORPUS is not the
// PRODUCER'S OUTPUT DIRECTORY. `docs/auth-audit/pages/` stays exactly as it is —
// the eval's rolling latest, useful for reading what the generator did today —
// and the checks read this instead.
//
// ONE PATH, like `test/fixtures/corpus.mjs` and `test/fixtures/themes.mjs`: four
// test files each spelling the location is four things to keep in step, and the
// day one drifts it walks an empty directory and reports a clean sweep over
// nothing.
//
// REFRESHING IT is a deliberate act — copy a good eval run's `docs/auth-audit/
// pages/` over this directory and re-run the suite. That is the point: the
// corpus moves when somebody decides it should, not when a run happens to fail.
import fs from "node:fs";
import path from "node:path";

export const GENERATED_DIR = new URL("./generated/", import.meta.url).pathname;

/** The sites in it — `booking-1`, `menu-1`, `tool-1`. */
export function generatedSites() {
  return fs.readdirSync(GENERATED_DIR)
    .filter((d) => fs.statSync(path.join(GENERATED_DIR, d)).isDirectory())
    .sort();
}

/** Every generated page, as `{site, file, src}`. */
export function generatedPages() {
  const out = [];
  for (const site of generatedSites()) {
    for (const file of fs.readdirSync(path.join(GENERATED_DIR, site))) {
      if (!file.endsWith(".tsx")) continue;
      out.push({ site, file, src: fs.readFileSync(path.join(GENERATED_DIR, site, file), "utf8") });
    }
  }
  return out;
}
