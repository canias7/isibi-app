// THE MEDIA COMPONENTS A CUSTOMER'S OWN URL GOES INTO (2026-09-19).
//
// Three kit parts take a URL somebody supplies — `video-embed` for YouTube and
// Vimeo, `video-player` for a file, `audio-player` for a sound file — and the
// addon's whole media flow ends at one of them. This drives the REAL template
// files with react-dom/server: a signature list says what props exist, and only
// a render says what the component does with them.
//
// ⚠ THE DEFECT THIS FILE WAS OPENED FOR. `video-embed` stamped `data-slot` on
// its FALLBACK branch and on nothing else, so a video that WORKS was invisible
// to every reader that counts slots — `curl … | grep -o 'data-slot="[^"]*"'`,
// which is how "what does this site really use" is answered with no auth and no
// publish, and the css lane, which is required to target by `data-slot`. Both
// consequences were backwards: a working video read as no video at all, and a
// BROKEN one was the only kind that showed up. Recorded as open since
// 2026-09-17 and measured still present before this was written.
//
// NOTHING HERE TOUCHES A NETWORK. An embed is an `<iframe src>` and a player is
// a `<video src>`; the markup is the subject and no third party is asked for
// anything — which is also why these are safe to run in CI.
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderKit } from "./fixtures/site-render.mjs";
import fs from "node:fs";
import path from "node:path";

const EMBED = "src/components/ui/video-embed.tsx";
const PLAYER = "src/components/ui/video-player.tsx";
const AUDIO = "src/components/ui/audio-player.tsx";

/** Every `data-slot` value in a rendered fragment, in order. */
const slots = (html) => [...html.matchAll(/data-slot="([^"]*)"/g)].map((m) => m[1]);






// ── EVERY PACKAGE A RENDER GUARD LOADS IS DECLARED AT THE ROOT ──────────────
//
// ⚠ THIS EXISTS BECAUSE CI WENT RED FOR FOUR PUSHES AND LOCAL STAYED GREEN.
// `renderKit` loads the REAL template file and falls through to `require` for
// any bare specifier — which resolves here, where the template's own
// `node_modules` is installed, and does not in `unit.yml`, which runs
// `npm ci` at the ROOT and nothing else. `video-player.tsx` imports
// `lucide-react`; the root did not declare it; CI answered
// `Cannot find module 'lucide-react'` on two cases while every local run
// passed. This repository's own recorded trap — *a CI step that does not
// install what the tests import* — and it is only catchable by a census,
// because a new kit component pulling in a new package looks like nothing at
// all until somebody reads the run.
//
// THE CENSUS IS OVER WHAT THE GUARDS REALLY LOAD, derived from their own
// `renderKit` calls rather than from a list typed here, so a component added
// to a render guard next month brings its packages with it.
test("every package the render guards load is declared at the root", () => {
  const ROOT = path.join(import.meta.dirname, "..");
  const TEMPLATE = path.join(ROOT, "builder", "lovable", "template");
  const declared = new Set(Object.keys(
    JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).devDependencies || {}));

  // WHICH FILES — off the guards' own calls. `renderKit("<path>", …)`.
  const files = new Set();
  for (const f of fs.readdirSync(path.join(ROOT, "test")).filter((x) => x.endsWith(".test.mjs"))) {
    const src = fs.readFileSync(path.join(ROOT, "test", f), "utf8");
    for (const m of src.matchAll(/renderKit\(\s*"([^"]+)"/g)) files.add(m[1]);
    // …and the ones behind a constant, which is how this file names them.
    for (const m of src.matchAll(/=\s*"(src\/components\/ui\/[a-z0-9-]+\.tsx)"/g)) files.add(m[1]);
  }
  assert.ok(files.size >= 3, "the census found no rendered kit files — its observer is dead: " + files.size);

  // WHICH PACKAGES — every bare specifier, walked transitively through the
  // `@/` imports the resolver follows, because a component's own import of a
  // kit helper is how a package arrives without appearing in the guard.
  const seen = new Set(), need = new Map();
  const walk = (rel) => {
    if (seen.has(rel)) return;
    seen.add(rel);
    const abs = path.join(TEMPLATE, rel);
    if (!fs.existsSync(abs)) return;
    for (const m of fs.readFileSync(abs, "utf8").matchAll(/^\s*import[^"']*["']([^"']+)["']/gm)) {
      const id = m[1];
      if (id.startsWith("@/")) {
        const base = path.join("src", id.slice(2));
        for (const ext of [".tsx", ".ts"]) if (fs.existsSync(path.join(TEMPLATE, base + ext))) walk(base + ext);
        continue;
      }
      if (id.startsWith(".") || id.startsWith("/")) continue;
      // `react` and `react-dom/server` are handed in by the resolver itself
      // and are declared anyway; a scoped or sub-path import declares its
      // PACKAGE (`@scope/name`, or the first segment).
      const pkg = id.startsWith("@") ? id.split("/").slice(0, 2).join("/") : id.split("/")[0];
      if (!need.has(pkg)) need.set(pkg, rel);
    }
  };
  for (const f of files) walk(f);
  assert.ok(need.size >= 1, "no packages were found at all — the import scan is dead");

  const missing = [...need].filter(([p]) => !declared.has(p));
  assert.deepEqual(missing, [],
    "these packages are loaded by a render guard and NOT declared in the root package.json, "
    + "so CI cannot resolve them however green this machine is: "
    + missing.map(([p, from]) => p + " (from " + from + ")").join(", "));
});
