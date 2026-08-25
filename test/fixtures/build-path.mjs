// WHERE THE BUILD PATH'S SOURCE IS, now that it is two files.
//
// The two long model calls moved from `worker.js` into `builder/build-call.mjs`
// on 2026-08-25, so the container can make them. Fifteen source-reading guards
// went red — every one of them anchored on `worker.js.indexOf("async function
// callBuilderModel(")`, which is a fact about WHICH FILE rather than about the
// property being asserted.
//
// This is the re-anchor. A guard asks for a function BY NAME and gets its body
// from wherever on the build path it lives, so the next move costs one line
// here instead of fifteen edits.
//
// ── WHY NOT JUST CONCATENATE THE TWO FILES ──────────────────────────────────
//
// Because half these guards are NEGATIVE — "worker.js must not keep its own
// provider fetch", "the budget never reaches the wire". Over a concatenation
// those pass whenever the OTHER file happens to satisfy them, which is the
// vacuous shape this repo keeps recording. So the sources stay separate and
// named, and a guard picks the one whose property it is asserting.
import fs from "node:fs";

export const WORKER_SRC = fs.readFileSync(new URL("../../worker.js", import.meta.url), "utf8");
export const CALL_SRC = fs.readFileSync(new URL("../../builder/build-call.mjs", import.meta.url), "utf8");
export const GEN_SRC = fs.readFileSync(new URL("../../builder/page-gen.mjs", import.meta.url), "utf8");

/** Every file the build path's own logic lives in, newest split first.
 *
 * THREE, NOT TWO. `callBuilderModel` is a container-safe LEAF — it imports
 * `model-xai.mjs` and nothing else — while `generateSitePages` needs
 * `pagesRequest` and therefore the whole prompt machinery, ~1MB across fifteen
 * modules, three of them at the repo root and so outside the container's Docker
 * build context. So they live apart on purpose, and this list is what lets a
 * guard assert a property without caring which side of that line it fell.
 */
const SOURCES = [
  ["builder/build-call.mjs", CALL_SRC],
  ["builder/page-gen.mjs", GEN_SRC],
  ["worker.js", WORKER_SRC],
];

/**
 * The body of a top-level function, wherever on the build path it is declared.
 *
 * @param {string} name
 * @returns {{file: string, body: string, src: string}}
 *
 * THROWS RATHER THAN ANSWERING EMPTY, which is the whole point. A guard handed
 * "" asserts nothing and passes — the failure mode every one of these tests
 * already warns about in its own words ("this check would be vacuous"). A throw
 * names the function and says the guard needs rescoping, which is what the
 * fifteen red ones did correctly this morning.
 *
 * THE WINDOW CLOSES AT THE NEXT TOP-LEVEL DECLARATION, never at a byte count.
 * A sized window is outrun by the next comment somebody writes above the next
 * function — the own-goal this repo has recorded a dozen times, including in
 * the test that first sliced this very function.
 */
export function buildPathFn(name) {
  for (const [file, src] of SOURCES) {
    for (const decl of [`export async function ${name}(`, `async function ${name}(`,
                        `export function ${name}(`, `function ${name}(`]) {
      const at = src.indexOf(decl);
      if (at < 0) continue;
      // The next thing declared at column zero — a function, a const, or the
      // doc comment that introduces one.
      const rest = src.slice(at + decl.length);
      const m = rest.match(/\n(?:export )?(?:async )?(?:function|const|class) |\n\/\*\*/);
      const body = m ? rest.slice(0, m.index) : rest;
      if (body.length < 100) continue; // a re-export or a stub, not the real one
      return { file, body: decl + body, src };
    }
  }
  throw new Error(`${name} is on neither worker.js nor builder/build-call.mjs — rescope this guard`);
}
