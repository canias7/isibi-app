// Does the build-service image contain everything the build service imports?
//
// WHY THIS EXISTS. `build-server.mjs` imported `site-theme.mjs` and
// `site-theme-registry.mjs`; the Dockerfile copied neither. Inside the container
// node threw ERR_MODULE_NOT_FOUND at startup, the process exited, nothing ever
// listened on 8080 — and Cloudflare reported that as "Failed to start container:
// There has been an internal error connecting to the port" on some runs and "The
// container is not running, consider calling start()" on others. Two messages,
// one cause, which is why it read as flaky infrastructure for a whole day while
// every generated site fell back to the placeholder.
//
// The Dockerfile already CARRIED this warning in prose — "a missing one is not a
// degraded build, the service fails to start at all" — written about
// `site-fonts.mjs`, and then two more imports were added without touching the
// COPY. A comment cannot fail a build. This can.
//
// DERIVED AT BOTH ENDS and TRANSITIVE: it walks the import graph from
// build-server.mjs rather than checking a list somebody remembered, so a module
// added three hops down is covered without anyone thinking about it.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// BOTH build services. The game one happens to be correct today, and it is the
// identical shape — one Dockerfile, one entrypoint, a handful of hand-listed
// COPY lines that nothing forced to keep up with the imports. Covering only the
// one that broke would leave the same bug live next door.
const SERVICES = [
  { name: "site", dir: new URL("../builder/", import.meta.url).pathname, cls: "SiteBuildContainer", port: "8080" },
  { name: "game", dir: new URL("../builder-game/", import.meta.url).pathname, cls: "GameBuildContainer", port: "8080" },
];

/** Every relative specifier a file imports, including `with { type: "json" }`. */
function relativeImports(file) {
  const src = fs.readFileSync(file, "utf8")
    // Blank comments so a commented-out import is not treated as real. Blanked
    // rather than deleted, so nothing else shifts.
    .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));
  const out = [];
  for (const m of src.matchAll(/\bfrom\s*["'](\.[^"']+)["']/g)) out.push(m[1]);
  for (const m of src.matchAll(/\bimport\s*\(\s*["'](\.[^"']+)["']\s*\)/g)) out.push(m[1]);
  return out;
}

/** The transitive closure of what some entrypoints need, as dir-relative paths. */
function closure(entries, root) {
  const seen = new Set();
  const stack = [...entries];
  while (stack.length) {
    const file = stack.pop();
    const rel = path.relative(root, file);
    if (seen.has(rel)) continue;
    seen.add(rel);
    if (!/\.mjs$/.test(file)) continue;      // json and friends are leaves
    for (const spec of relativeImports(file)) {
      const resolved = path.resolve(path.dirname(file), spec);
      if (fs.existsSync(resolved)) stack.push(resolved);
      else assert.fail(`${rel} imports ${spec}, which does not exist`);
    }
  }
  return seen;
}

/**
 * The sibling .mjs files build-server.mjs SPAWNS rather than imports.
 *
 * The import walk cannot see these — `prerender-child.mjs` is handed to
 * `process.execPath` as an argument, so no `from "./…"` names it — and a missing
 * COPY would not fail the walk. It would fail every build's prerender at
 * runtime with MODULE_NOT_FOUND, and since the prerender is best-effort by
 * design the build would SUCCEED and publish every site with the home page's
 * snapshot at every address. Silent, and on the one step whose whole purpose is
 * link previews.
 *
 * DERIVED, not listed: any `"<name>.mjs"` literal in the entrypoint that names a
 * real file next to it is treated as a second entrypoint, so a child added
 * tomorrow is covered without anybody remembering this file. It over-includes by
 * design — a module merely NAMED in a string and never spawned would also be
 * required in the image, which costs a COPY line and never a broken container.
 */
function spawnedSiblings(entry, root) {
  const src = fs.readFileSync(entry, "utf8")
    .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));
  const out = new Set();
  for (const m of src.matchAll(/["']([A-Za-z0-9._-]+\.mjs)["']/g)) {
    const p = path.join(root, m[1]);
    if (m[1] !== path.basename(entry) && fs.existsSync(p)) out.add(p);
  }
  return [...out];
}

for (const svc of SERVICES) {
test(`the ${svc.name} image copies everything build-server.mjs imports, transitively`, () => {
  const entry = path.join(svc.dir, "build-server.mjs");
  const needed = closure([entry, ...spawnedSiblings(entry, svc.dir)], svc.dir);
  assert.ok(needed.size >= 2, `only ${needed.size} files in the ${svc.name} closure — the walk stopped working`);

  const df = fs.readFileSync(path.join(svc.dir, "Dockerfile"), "utf8");
  // What each COPY brings in: either a named file or a directory prefix.
  const files = new Set();
  const dirs = [];
  for (const m of df.matchAll(/^COPY\s+(.+?)\s+\S+\s*$/gm)) {
    for (const src of m[1].trim().split(/\s+/)) {
      if (src.endsWith("/")) dirs.push(src);
      else files.add(src);
    }
  }
  assert.ok(files.size || dirs.length, "no COPY lines found — retarget this test");

  const missing = [...needed].filter((rel) => {
    if (files.has(rel)) return false;
    return !dirs.some((d) => rel === d.replace(/\/$/, "") || rel.startsWith(d));
  });
  assert.deepEqual(missing, [],
    `the ${svc.name} build-server.mjs imports these and the image does not contain ` +
    `them, so the service cannot start: ${missing.join(", ")}`);
});

test(`the ${svc.name} entrypoint is the file whose imports were just checked`, () => {
  // The walk above is only meaningful if build-server.mjs is what actually runs.
  const df = fs.readFileSync(path.join(svc.dir, "Dockerfile"), "utf8");
  assert.match(df, /^CMD \["node", "build-server\.mjs"\]/m,
    "the container runs something else — the import check is pointed at the wrong file");
  assert.match(df, new RegExp("^EXPOSE " + svc.port, "m"), "the port must match the class's defaultPort");
});

test(`the ${svc.name} spawned-sibling scan can still see one`, () => {
  // A scan that silently stops matching reports a clean image and proves
  // nothing — the failure this whole file exists to stop, one level up. The
  // site service really does spawn a child; the game one does not, and that is
  // asserted as the honest answer rather than skipped.
  const entry = path.join(svc.dir, "build-server.mjs");
  const found = spawnedSiblings(entry, svc.dir).map((p) => path.basename(p));
  if (svc.name === "site") {
    assert.ok(found.includes("prerender-child.mjs"),
      "the prerender child is no longer named in build-server.mjs — either it stopped being spawned " +
      "(model-written code is back in the build server's own process) or this scan stopped matching");
  } else {
    assert.deepEqual(found, [], `${svc.name} gained a spawned sibling; make sure it is in the COPY line`);
  }
});

test(`the ${svc.name} container class agrees with the image's port`, () => {
  // A mismatch here has the SAME SYMPTOM as a missing module — Cloudflare cannot
  // reach the port and reports a start failure — so it is worth pinning next to
  // the cause that actually happened.
  const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const at = worker.indexOf("export class " + svc.cls);
  assert.ok(at > 0, `${svc.cls} is gone`);
  const port = /defaultPort\s*=\s*(\d+)/.exec(worker.slice(at, at + 300));
  assert.ok(port, `${svc.cls} no longer declares a defaultPort`);
  assert.equal(port[1], svc.port);
});
}
