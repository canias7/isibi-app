/**
 * THE CALIBRATION CORPUS — 324 hand-written pages, and the ONE path to them.
 *
 * WHAT THEY ARE NOW, which is not what they were. They were the 100 per-trade
 * reference apps: `builder/gen-family-exemplars.mjs` baked one home page per
 * trade into `builder/family-exemplars.mjs`, and `pagesPrompt` handed the
 * matching one to the model as a worked example. That whole tier went on
 * 2026-08-20 with the families — the designer stopped naming a trade, so an
 * exemplar keyed on the trade name had no key left.
 *
 * WHY THEY SURVIVED IT. They are the only corpus in this repo of complete,
 * compiling pages written in the house style, and about a dozen checks measure
 * their FALSE-ALARM RATE against it: the prop lint, the colour lint, the
 * import/export lint, the link lane, the nav slot-finder, the tweak lane, the
 * rename cap and hold, the download sweep and the RTL sweep. This repo's
 * standing rule is that a check crying wolf on correct code is strictly worse
 * than the miss it prevents, and these pages are the evidence that ours do not.
 * Deleting them does not advance the goal — it removes the evidence.
 *
 * WHY THEY MOVED OUT OF THE TEMPLATE. `builder/Dockerfile` does
 * `COPY lovable/template/ ./`, so while they lived at
 * `template/src/family-pages` they shipped **3.4 MB into every build container
 * image** — excluded from `tsconfig.json`, imported by no page, reachable by
 * nothing, and typechecked by nothing once their own harness was deleted. That
 * is the on-disk-and-reachable-by-nothing shape this repo has removed 289 files
 * over, and it also made `tsconfig-coverage.test.mjs` unable to pass honestly:
 * a directory excluded from the build check and covered by no harness is
 * exactly what that test exists to catch.
 *
 * Out here they cost a build nothing, the exclusion is gone rather than
 * special-cased, and the open question — keep the corpus or delete it — is one
 * `rm -rf` either way.
 *
 * ONE PATH, imported rather than spelled, because seven test files each writing
 * `../builder/lovable/template/src/family-pages` is seven things to keep in
 * step, and the day one of them drifts it walks an empty directory and reports
 * a clean sweep over nothing.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";

/** Absolute path to the corpus root. Subdirectories are one per former trade. */
export const CORPUS_DIR = path.join(import.meta.dirname, "corpus");

/** The same thing as a directory URL, for callers that resolve with `new URL`. */
export const CORPUS_URL = pathToFileURL(CORPUS_DIR + path.sep);
