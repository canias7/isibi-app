// THE BUILD'S SOURCE, SLICED IN ONE PLACE.
//
// Six test files scan the build path's source, and until 2026-08-23 every one of
// them found it by slicing forward from the ROUTE MATCH — `url.pathname ===
// "/api/site/react-build"` — because that is where the code happened to live.
//
// It does not live there any more. Moving the build into `runSiteBuild` so a
// queue consumer can call it turned all six guards red at once, on a change
// where the body was proved BYTE-IDENTICAL. That is the positional-anchor
// own-goal this repo has recorded a dozen times, arriving six at a time.
//
// So the anchor is the FUNCTION, which is what those guards were always really
// about, and it lives here rather than being spelled six times — six copies of
// one anchor drift, and the way they drift is one file quietly scanning the
// wrong region and reporting a clean pass over nothing.
//
// THE CLOSE IS A COLUMN-ZERO BRACE, and that is safe by construction rather than
// by luck: the body was extracted from inside `handleRequest`, so every line of
// it is indented, and the function is at module scope. Measured at extraction —
// zero column-0 closing braces inside 125,849 characters of body. The floor
// below is what notices if that ever stops being true.
import fs from "node:fs";

const WORKER_SRC = fs.readFileSync(new URL("../../worker.js", import.meta.url), "utf8");

/** The whole of `runSiteBuild`, from its signature to its closing brace. */
export function buildSource() {
  const at = WORKER_SRC.indexOf("async function runSiteBuild(");
  if (at < 0) {
    throw new Error("runSiteBuild is gone or renamed — every build-source guard is now scanning nothing");
  }
  const end = WORKER_SRC.indexOf("\n}\n", at);
  if (end < 0) throw new Error("runSiteBuild's closing brace moved — rescope build-source.mjs");
  const seg = WORKER_SRC.slice(at, end);
  // A FLOOR, because a slice that silently shrinks reports a clean pass over
  // nothing — and every guard built on this is an absence check, which is
  // exactly the kind that passes hardest when it is looking at the wrong thing.
  if (seg.length < 100_000) {
    throw new Error(`the build source is suspiciously small (${seg.length} chars) — rescope build-source.mjs`);
  }
  return seg;
}

/** The whole Worker, for guards that legitimately need more than the build. */
export function workerSource() {
  return WORKER_SRC;
}
