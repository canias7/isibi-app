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
//
// TWO BUILD CONTEXTS SINCE 2026-09-04. The site image's Dockerfile moved to the
// REPOSITORY ROOT so the image can carry the Worker's own module graph as the
// job runtime (the `worker/` tree, checked by its own test below), and that
// graph spans builder/, builder-game/ and the root modules — a context rooted
// at builder/ cannot reach above itself. So the site service's COPY sources are
// root-relative (`builder/build-server.mjs`) while its closure is still
// dir-relative (`build-server.mjs`); `prefix` is the difference, and `context`
// is where a COPY source has to exist. The game image is untouched.
const ROOT = new URL("../", import.meta.url).pathname;
const SERVICES = [
  { name: "site", dir: ROOT + "builder/", dockerfile: ROOT + "Dockerfile", context: ROOT, prefix: "builder/",
    cls: "SiteBuildContainer", port: "8080" },
  { name: "game", dir: ROOT + "builder-game/", dockerfile: ROOT + "builder-game/Dockerfile", context: ROOT + "builder-game/", prefix: "",
    cls: "GameBuildContainer", port: "8080" },
];

/** Every relative specifier a file imports, including `with { type: "json" }`,
 * as `{ spec, dynamic }` — a static `from "./x"` or an `import("./x")`. */
function relativeImports(file) {
  const src = fs.readFileSync(file, "utf8")
    // Blank comments so a commented-out import is not treated as real. Blanked
    // rather than deleted, so nothing else shifts.
    .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));
  const out = [];
  for (const m of src.matchAll(/\bfrom\s*["'](\.[^"']+)["']/g)) out.push({ spec: m[1], dynamic: false });
  for (const m of src.matchAll(/\bimport\s*\(\s*["'](\.[^"']+)["']\s*\)/g)) out.push({ spec: m[1], dynamic: true });
  return out;
}

/** The transitive closure of what some entrypoints need, as root-relative paths.
 *
 * `.js` IS WALKED AS WELL AS `.mjs` (2026-09-04): the job runner's closure goes
 * through `worker.js`, and a walk that stopped there would call the Worker's
 * whole import graph a leaf — a clean sweep over the one tree this file was
 * extended to check. Both build services' closures are all `.mjs`, so nothing
 * changes for them. JSON and friends stay leaves.
 */
function closure(entries, root) {
  const seen = new Set();
  const stack = [...entries];
  while (stack.length) {
    const file = stack.pop();
    const rel = path.relative(root, file);
    if (seen.has(rel)) continue;
    seen.add(rel);
    if (!/\.m?js$/.test(file)) continue;
    for (const { spec, dynamic } of relativeImports(file)) {
      const resolved = path.resolve(path.dirname(file), spec);
      // A DYNAMIC IMPORT THAT LEAVES THE TREE IS THE OTHER PROGRAM'S. The build
      // server imports `container-job.mjs` for `readLaunch`, and that module's
      // `import("../worker.js")` runs only when it is the ENTRY — spawned out of
      // `/app/worker/builder/`, where `../worker.js` is the Worker. Followed
      // from the build server's copy at `/app/`, it names a file that is not
      // there and is never asked for. A STATIC import outside the tree is still
      // reported: it would be missing at startup, and the COPY comparison says
      // so by name (`../x.mjs` matches no line).
      if (dynamic && path.relative(root, resolved).startsWith("..")) continue;
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
  // A name spawned INTO THE WORKER TREE is not a sibling of the build server —
  // it runs out of `/app/worker/builder/`, where the worker-tree test below
  // checks it — and demanding it beside build-server.mjs would be a red test
  // on a correct image. Subtracted by name here rather than by weakening the
  // scan, so a real sibling spawned tomorrow is still seen.
  const inWorkerTree = new Set(workerSpawned(entry).map((rel) => path.basename(rel)));
  const out = new Set();
  for (const m of src.matchAll(/["']([A-Za-z0-9._-]+\.mjs)["']/g)) {
    const p = path.join(root, m[1]);
    if (m[1] !== path.basename(entry) && !inWorkerTree.has(m[1]) && fs.existsSync(p)) out.add(p);
  }
  return [...out];
}

/**
 * The files build-server.mjs spawns out of the WORKER TREE, root-relative.
 *
 * `startJob` and `checkWorkerTree` hand node `path.join(WORKER_DIR, "builder",
 * "container-job.mjs")` and `--import` `worker-register.mjs` the same way, so
 * no import names either; the walk from the runner cannot see the runner
 * itself, nor the register hook that loads before it. DERIVED FROM THE JOIN
 * rather than listed: a third file spawned that way is covered the day it is
 * written. The game service has no WORKER_DIR and answers [].
 */
function workerSpawned(entry) {
  const src = fs.readFileSync(entry, "utf8")
    .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));
  const out = new Set();
  for (const m of src.matchAll(/path\.join\(\s*WORKER_DIR\s*((?:,\s*["'][^"']+["']\s*)+)\)/g)) {
    const segs = [...m[1].matchAll(/["']([^"']+)["']/g)].map((s) => s[1]);
    out.add(segs.join("/"));
  }
  return [...out];
}

/**
 * Every source path the COPY lines name, as `{src, dest, staged}`.
 *
 * ONE READER, because two consumers ask opposite questions of the same lines —
 * "is everything we import copied" and "does everything we copy exist" — and two
 * copies of the parse drift toward one of them silently seeing a shorter list
 * than the other. `staged` marks a `--from=` copy, whose source is a previous
 * build stage rather than the build context, so it is not a path on disk.
 * `dest` (2026-09-04) is the last word of the line: the site image copies the
 * SAME module to two places — `builder/site-theme.mjs` to `./` for the build
 * server and to `./worker/builder/` for the job runner — and each consumer
 * reads only the lines destined for its own tree.
 */
function copySources(df) {
  const out = [];
  for (const m of df.matchAll(/^COPY\s+(.+?)\s+(\S+)\s*$/gm)) {
    const parts = m[1].trim().split(/\s+/);
    const staged = parts.some((p) => p.startsWith("--from="));
    for (const src of parts) {
      if (src.startsWith("--")) continue; // a flag, not a path
      out.push({ src, dest: m[2], staged });
    }
  }
  return out;
}

/** The COPY lines that land in the BUILD SERVER's tree — everything not destined under `./worker`. */
const forService = (c) => !/^\.\/worker(?:\/|$)/.test(c.dest);
/** The COPY lines that land in the JOB RUNNER's tree. */
const forWorker = (c) => /^\.\/worker(?:\/|$)/.test(c.dest);

test("the COPY parser skips flags and multi-stage sources", () => {
  // NEITHER DOCKERFILE HAS EITHER SHAPE TODAY, so a mutation removing these two
  // rules changes no answer and survives a sweep — which reads exactly like the
  // rules being pointless. They are not, and both failures land in the direction
  // this repo rates worse than a miss: without the flag skip, `--chown=node:node`
  // is looked for as a file and a correct Dockerfile is reported broken; without
  // the `--from=` rule, a multi-stage copy of an artefact BUILT in an earlier
  // stage is looked for on disk, and a perfectly good multi-stage build fails a
  // test. So they are driven here rather than left to a Dockerfile that does not
  // exist yet.
  const flagged = copySources("COPY --chown=node:node build-server.mjs ./\n");
  assert.deepEqual(flagged, [{ src: "build-server.mjs", dest: "./", staged: false }],
    "a COPY flag was read as a path — a correct Dockerfile would be reported as missing a file");

  const staged = copySources("COPY --from=builder /app/dist/ ./dist/\n");
  assert.deepEqual(staged, [{ src: "/app/dist/", dest: "./dist/", staged: true }],
    "a multi-stage source was not marked staged — it would be looked for in the build context, where it never is");

  // The two trees are told apart by DESTINATION, and `./worker` alone (no
  // slash) is the worker tree too — `COPY package.json ./worker` would be a
  // legal spelling of the same line. `./workers/` would not be.
  const both = copySources("COPY builder/a.mjs ./\nCOPY builder/a.mjs ./worker/builder/\nCOPY package.json ./worker\nCOPY x ./workers/\n");
  assert.deepEqual(both.filter(forService).map((c) => c.src), ["builder/a.mjs", "x"]);
  assert.deepEqual(both.filter(forWorker).map((c) => c.src), ["builder/a.mjs", "package.json"]);
});

test("the worker-spawn scan reads the join's segments and nothing else", () => {
  // Driven, because the tripwire below subtracts what this finds: a scan that
  // found nothing would put the runner back among the build server's siblings
  // and demand it at `/app/`, a red test on the correct image; a scan that
  // read a join it should not would hide a real sibling from the tripwire.
  const dir = path.dirname(new URL(import.meta.url).pathname);
  const fake = path.join(dir, ".worker-spawn-probe.mjs");
  fs.writeFileSync(fake,
    'const a = path.join(WORKER_DIR, "builder", "container-job.mjs");\n' +
    'const b = path.join(WORKER_DIR, "worker.js");\n' +
    'const c = path.join(APP, "builder", "not-this.mjs");\n' +
    '// const d = path.join(WORKER_DIR, "builder", "commented-out.mjs");\n');
  try {
    assert.deepEqual(workerSpawned(fake).sort(), ["builder/container-job.mjs", "worker.js"]);
  } finally { fs.rmSync(fake, { force: true }); }
});

/** Of those sources, the ones that are not in the build context at `dir`. */
function missingFromContext(sources, dir) {
  return sources
    .filter(({ src }) => !fs.existsSync(path.join(dir, src.replace(/\/$/, ""))))
    .map(({ src }) => src);
}

for (const svc of SERVICES) {
test(`the ${svc.name} image copies everything build-server.mjs imports, transitively`, () => {
  const entry = path.join(svc.dir, "build-server.mjs");
  const needed = closure([entry, ...spawnedSiblings(entry, svc.dir)], svc.dir);
  assert.ok(needed.size >= 2, `only ${needed.size} files in the ${svc.name} closure — the walk stopped working`);

  const df = fs.readFileSync(svc.dockerfile, "utf8");
  // What each COPY brings in: either a named file or a directory prefix. ONLY
  // THE LINES DESTINED FOR THE SERVICE'S OWN TREE: the site image also copies
  // most of these modules a second time, under `./worker/`, where the build
  // server's `import "./site-theme.mjs"` cannot see them — a copy that lands
  // only there is a service that still fails to start. And the source is read
  // with the context prefix off (`builder/site-theme.mjs` → `site-theme.mjs`),
  // which is the same path the closure answers.
  const files = new Set();
  const dirs = [];
  const unprefixed = [];
  for (const { src } of copySources(df).filter(forService)) {
    if (svc.prefix && !src.startsWith(svc.prefix)) { unprefixed.push(src); continue; }
    const rel = src.slice(svc.prefix.length);
    if (rel.endsWith("/")) dirs.push(rel);
    else files.add(rel);
  }
  assert.ok(files.size || dirs.length, "no COPY lines found — retarget this test");
  assert.deepEqual(unprefixed, [],
    `the ${svc.name} image copies ${unprefixed.join(", ")} into the service's tree from outside ${svc.prefix} — ` +
    "nothing there imports across the prefix, so say which tree the line is for");

  const missing = [...needed].filter((rel) => {
    if (files.has(rel)) return false;
    return !dirs.some((d) => rel === d.replace(/\/$/, "") || rel.startsWith(d));
  });
  assert.deepEqual(missing, [],
    `the ${svc.name} build-server.mjs imports these and the image does not contain ` +
    `them, so the service cannot start: ${missing.join(", ")}`);
});

test(`every path the ${svc.name} Dockerfile COPYs exists on disk`, () => {
  // THE OTHER DIRECTION FROM THE TEST ABOVE, AND IT FAILS HARDER.
  //
  // That one catches an import with no COPY: the image builds and the service
  // dies at startup. This catches a COPY with no file, which does not degrade at
  // all — buildx cannot compute a checksum for a path missing from the build
  // context, the image never builds, and `wrangler deploy` fails, so THE WHOLE
  // WORKER DOES NOT SHIP. Measured 2026-08-20 on `COPY theme-candidates/`, which
  // outlived its directory by one commit when the 500 hand-written themes moved
  // to `test/fixtures/themes/`.
  //
  // The import walk is structurally blind to it — nothing imports a directory
  // that is gone — which is exactly why the two checks are separate rather than
  // one cleverer one. BOTH TREES' lines are checked here: a worker-tree COPY of
  // a path that is not there fails the image exactly the same way.
  const df = fs.readFileSync(svc.dockerfile, "utf8");
  const named = copySources(df).filter((c) => !c.staged);
  assert.ok(named.length >= 3,
    `only ${named.length} COPY sources found in the ${svc.name} Dockerfile — the parse stopped working, ` +
    "and an absence check over an empty list is a clean sweep over nothing");
  assert.deepEqual(missingFromContext(named, svc.context), [],
    `the ${svc.name} Dockerfile COPYs paths that are not in its build context (${svc.context}), ` +
    "so `docker build` fails and the deploy ships nothing");
});

test(`the ${svc.name} COPY-exists check can actually fail`, () => {
  // Driven rather than asserted: a checker that returns [] for everything passes
  // the test above perfectly, on a Dockerfile naming a path that is not there.
  //
  // `ghost-batches/`, not `theme-candidates/` — that was the fixture's missing
  // path from the day the real directory left the build context, and on
  // 2026-08-27 the registry came BACK and the ghost got a body: the exact path
  // this test fed the checker as guaranteed-absent became a real COPY again,
  // and the can-fail proof failed against correct code. The fixture path is now
  // one nothing will ever create. Spelled with the service's own prefix, so the
  // real file in the fixture is really there and only the ghost is missing.
  const bogus = copySources(`COPY ${svc.prefix}build-server.mjs ${svc.prefix}ghost-batches/ ./\n`).filter((c) => !c.staged);
  assert.deepEqual(missingFromContext(bogus, svc.context), [svc.prefix + "ghost-batches/"],
    "the checker did not flag a path that is not on disk — it would pass on the exact Dockerfile that broke the deploy");
});

test(`the ${svc.name} entrypoint is the file whose imports were just checked`, () => {
  // The walk above is only meaningful if build-server.mjs is what actually runs.
  const df = fs.readFileSync(svc.dockerfile, "utf8");
  assert.match(df, /^CMD \["node", "build-server\.mjs"\]/m,
    "the container runs something else — the import check is pointed at the wrong file");
  assert.match(df, new RegExp("^EXPOSE " + svc.port, "m"), "the port must match the class's defaultPort");
});

test(`the ${svc.name} spawns no sibling — and if one comes back, COPY it`, () => {
  // NEITHER SERVICE SPAWNS ONE NOW. The site service spawned
  // `prerender-child.mjs` until TanStack Start removed the build-time prerender;
  // the game service never has.
  //
  // ASSERTED AS AN ABSENCE RATHER THAN DELETED, and it is a tripwire rather than
  // a rule: the COPY check above is DERIVED, so it covers a child added
  // tomorrow — but only if that child is also in the Dockerfile, and the failure
  // if it is not is silent (MODULE_NOT_FOUND at spawn time, on a step that is
  // best-effort, so the build succeeds and the feature just never works). This
  // line going red is the signal to read that check rather than a complaint
  // about the change.
  const entry = path.join(svc.dir, "build-server.mjs");
  const found = spawnedSiblings(entry, svc.dir).map((p) => path.basename(p));
  assert.deepEqual(found, [],
    `${svc.name} gained a spawned sibling (${found.join(", ")}) — make sure the Dockerfile COPYs it, ` +
    "then update this assertion; a missing COPY fails at runtime on a best-effort step, which is silent");
});

test("the spawned-sibling scan still fires on the shape it was written for", () => {
  // The absence above is only worth anything if the scan can still SEE one. A
  // scan that silently stopped matching would report both services clean and
  // prove nothing — which is the failure this whole file exists to stop, one
  // level up. Driven over a synthetic entrypoint that names a file really on
  // disk beside it.
  const dir = path.dirname(new URL(import.meta.url).pathname);
  const fake = path.join(dir, ".spawn-scan-probe.mjs");
  const sibling = path.basename(new URL(import.meta.url).pathname);
  fs.writeFileSync(fake, 'spawn(process.execPath, ["' + sibling + '"]);\n');
  try {
    const found = spawnedSiblings(fake, dir).map((p) => path.basename(p));
    assert.ok(found.includes(sibling), "the spawned-sibling scan no longer matches a spawned sibling");
    // And a name inside a COMMENT is not one, or every mention of a deleted
    // child in prose would demand a COPY line for a file nothing runs.
    fs.writeFileSync(fake, '// see "' + sibling + '" for why\n');
    assert.deepEqual(spawnedSiblings(fake, dir), [], "a commented mention reads as a spawned sibling");
  } finally { fs.rmSync(fake, { force: true }); }
});

test(`the ${svc.name} image carries every file the service COPIES into the template`, () => {
  // THE THIRD BLIND SPOT, after imports and spawned siblings. A file read off
  // disk and written into `src/` for vite to bundle is named by no import and
  // spawned by nothing, so neither of the two checks above can see it.
  //
  // `packageWorker` staged `site-worker/entry.js` that way until TanStack Start
  // removed the second vite pass, so nothing does it today — this stays because
  // it is DERIVED from the entrypoint's own path joins, and therefore covers the
  // next one without anybody remembering the file.
  //
  // A missing COPY here fails differently from both, and more quietly: the
  // service starts fine, every ordinary build is unaffected, and only the build
  // that needed the staged file fails. A feature that silently never works
  // rather than a container that will not boot — the harder one to notice.
  const entry = fs.readFileSync(path.join(svc.dir, "build-server.mjs"), "utf8");
  const df = fs.readFileSync(svc.dockerfile, "utf8");
  const staged = [...entry.matchAll(/path\.join\(path\.dirname\(fileURLToPath\(import\.meta\.url\)\),\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)/g)]
    .map((m) => m[1] + "/" + m[2])
    .filter((rel) => fs.existsSync(path.join(svc.dir, rel)));
  for (const rel of staged) {
    const dir = svc.prefix + rel.split("/")[0];
    assert.ok(new RegExp("^COPY\\s+(?:[^\\n]*\\s)?" + dir.replace(/[.\/]/g, "\\$&") + "/", "m").test(df),
      `${svc.name}'s build-server stages ${rel} into the template and the image does not carry ${dir}/ — ` +
      "every build that asks for a worker would fail to stage it, silently, while everything else stays green");
  }
  // NOTHING IS STAGED TODAY, so the loop above is vacuous — said plainly here
  // rather than left looking like live protection, which is the thing this repo
  // rates worse than no protection at all. The scan is proved to fire by its own
  // test below, and this line going red means somebody staged a file and this
  // check now really covers it.
  assert.deepEqual(staged, [],
    `${svc.name} stages ${staged.join(", ")} into the template — check the Dockerfile COPYs it, then update this`);
});

test("the staged-file scan still fires on the shape it was written for", () => {
  // Same reasoning as the spawned-sibling probe: an assertion that nothing is
  // staged is worth nothing if the scan could no longer see one.
  const dir = path.dirname(new URL(import.meta.url).pathname);
  const fake = path.join(dir, ".stage-scan-probe.mjs");
  const here = path.basename(new URL(import.meta.url).pathname);
  fs.writeFileSync(fake,
    'const P = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "cf-stub.mjs");\n' +
    'const Q = path.join(path.dirname(fileURLToPath(import.meta.url)), "nope", "absent.mjs");\n');
  try {
    const src = fs.readFileSync(fake, "utf8");
    const staged = [...src.matchAll(/path\.join\(path\.dirname\(fileURLToPath\(import\.meta\.url\)\),\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)/g)]
      .map((m) => m[1] + "/" + m[2])
      .filter((rel) => fs.existsSync(path.join(dir, rel)));
    assert.deepEqual(staged, ["fixtures/cf-stub.mjs"],
      "the staged-file scan no longer matches a two-segment join, or stopped filtering ones that are not there");
    assert.ok(here, "sanity");
  } finally { fs.rmSync(fake, { force: true }); }
});

test(`the ${svc.name} image bakes every pristine base the service restores from`, () => {
  // THE FAILURE IS SILENT AND CROSS-TENANT. `.routes-base` is read with no
  // catch, so a missing one kills the first build loudly.
  // `.styles-base.css` is the ONLY base whose absence is deliberately soft — and
  // soft here meant `src/styles.css` fell back to ITSELF, i.e. the previous
  // customer's sheet, and every later build appended to it. Measured over three
  // builds with the base missing: 16 → 23 → 32 `:root` blocks, every earlier
  // theme still in the file.
  //
  // Deleting the two `cp` lines from the Dockerfile and running every
  // Dockerfile-reading test in the repo was 150 pass, 0 fail — nothing asserted
  // either path.
  //
  // DERIVED FROM THE SERVICE'S OWN CONSTANTS, so a fourth base is covered without
  // anybody remembering this file. Anchored on the `_BASE` NAMING rather than on
  // "a dotfile under APP": a runtime scratch dir written by the server is also a
  // dotfile, and demanding the image bake one would be a red test on a correct
  // image — which this repo rates worse than the miss.
  const src = fs.readFileSync(path.join(svc.dir, "build-server.mjs"), "utf8");
  const bases = [...src.matchAll(/const\s+\w*_BASE\s*=\s*path\.join\(APP,\s*"([^"]+)"\)/g)].map((m) => m[1]);
  if (!bases.length) return;                       // the game service restores from none
  // A FLOOR, so a scan that silently stopped matching cannot report a clean
  // image. It was 3 while `.index-base.html` existed; the shell went with the
  // move to Start, where the document is `__root.tsx` rendered per request and
  // there is nothing to keep a pristine copy OF. Two is what remains, and this
  // number tracks the constants rather than describing an intent.
  assert.ok(bases.length >= 2, `only ${bases.length} pristine bases found — the scan stopped matching`);
  const df = fs.readFileSync(svc.dockerfile, "utf8");
  for (const b of bases) {
    assert.ok(df.includes("/app/" + b),
      `build-server.mjs restores from ${b} and the image never creates it — ` +
      "a build then falls back to the PREVIOUS customer's file");
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

// ── THE WORKER TREE (2026-09-04) ────────────────────────────────────────────
//
// The site image carries a second program: the Worker's own module graph under
// `/app/worker/`, which `build-server.mjs` spawns (`/job/run`) to execute a
// queued edit or addon inside the site's container instead of in the queue
// consumer. It is laid out exactly as the repository is — `worker.js` at the
// tree's root, `builder/…` and `builder-game/…` beneath it — because every
// relative import in it has to resolve there, and its node_modules come from
// the ROOT lockfile. A module the job imports and the tree lacks is a job that
// dies at import inside the container, with the consumer already gone (the
// Worker runs a job itself only when the container REFUSES the launch), so the
// build server imports the tree once at startup and refuses launches while it
// does not import. These tests are what keeps that refusal from ever firing on
// a deployed image.
const SITE = SERVICES[0];

/** The runner's closure plus the files the spawn and the loader name by string. */
function workerTreeNeeds() {
  const entry = path.join(SITE.dir, "build-server.mjs");
  const spawned = workerSpawned(entry);
  // The loader chain is wired by STRING, not by import: `worker-register.mjs`
  // hands `register()` the loader's path and the loader maps two specifiers to
  // its shims by URL. Followed here by the same literals, so a shim renamed or
  // added is covered without anyone editing a list.
  const literal = (rel) => {
    const src = fs.readFileSync(ROOT + rel, "utf8")
      .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));
    return [...src.matchAll(/["'](\.\/[A-Za-z0-9._-]+\.mjs)["']/g)]
      .map((m) => path.relative(ROOT, path.resolve(path.dirname(ROOT + rel), m[1])));
  };
  const byString = new Set();
  const stack = [...spawned];
  while (stack.length) {
    const rel = stack.pop();
    if (byString.has(rel)) continue;
    byString.add(rel);
    for (const next of literal(rel)) stack.push(next);
  }
  const entries = [...byString].map((rel) => ROOT + rel);
  return { spawned, byString: [...byString], needed: closure(entries, ROOT) };
}

test("the worker tree carries everything the job runner imports, at the path each import expects", () => {
  const { spawned, byString, needed } = workerTreeNeeds();
  // THE SPAWN IS THE ROOT OF THE WALK, so prove the scan found it: with nothing
  // spawned the closure is empty and an emptiness check over an empty tree is a
  // clean sweep over nothing.
  assert.ok(spawned.includes("builder/container-job.mjs"), "the build server no longer spawns the runner out of WORKER_DIR: " + spawned.join(", "));
  assert.ok(spawned.includes("builder/worker-register.mjs"), "the build server no longer registers the loader out of WORKER_DIR: " + spawned.join(", "));
  for (const f of ["builder/worker-loader.mjs", "builder/cloudflare-shim.mjs", "builder/containers-shim.mjs"]) {
    assert.ok(byString.includes(f), `the loader chain no longer reaches ${f} by string — the scan stopped matching, or the loader stopped mapping it`);
  }
  // A floor on the closure, because the whole point is that it crosses into
  // worker.js and the Worker's graph: a walk that stopped at the runner would
  // answer a handful of files and certify a tree missing the Worker itself.
  assert.ok(needed.has("worker.js"), "the runner's closure does not reach worker.js — the walk stopped at the .js boundary");
  assert.ok(needed.size >= 80, `only ${needed.size} files in the runner's closure — the Worker's graph is not being walked`);

  const df = fs.readFileSync(SITE.dockerfile, "utf8");
  const copies = copySources(df).filter(forWorker).map((c) => ({ ...c, dest: c.dest.replace(/\/?$/, "/") }));
  assert.ok(copies.length >= 3, "no COPY lines land under ./worker/ — retarget this test");
  const missing = [], misplaced = [];
  for (const rel of needed) {
    const hit = copies.find((c) => c.src === rel || (c.src.endsWith("/") && rel.startsWith(c.src)));
    if (!hit) { missing.push(rel); continue; }
    // WHERE IT LANDS IS HALF THE CHECK. `COPY builder/edit-job.mjs ./worker/`
    // is a line that exists and a module `worker.js` cannot import: it lands at
    // /app/worker/edit-job.mjs while the import says ./builder/edit-job.mjs.
    // The destination must mirror the source's directory under ./worker/.
    const want = hit.src.endsWith("/")
      ? "./worker/" + hit.src
      : "./worker/" + (path.dirname(rel) === "." ? "" : path.dirname(rel) + "/");
    if (hit.dest !== want) misplaced.push(`${rel} lands in ${hit.dest}, its imports expect ${want}`);
  }
  assert.deepEqual(missing, [],
    "the job runner imports these and the image's worker tree does not carry them, so the job dies at import " +
    "inside the container and the build server refuses every launch: " + missing.join(", "));
  assert.deepEqual(misplaced, [],
    "copied to a place the imports cannot see: " + misplaced.join(" · "));
});

test("the worker-tree check reads the destination, not only the name", () => {
  // Driven, because the `misplaced` branch above is vacuous on a correct
  // Dockerfile and a mutation that stops comparing destinations survives it.
  // The same lines, one moved: the module is copied, and to the wrong tree.
  const lines = "COPY worker.js ./worker/\nCOPY builder/edit-job.mjs ./worker/\nCOPY builder/theme-candidates/ ./worker/theme-candidates/\n";
  const copies = copySources(lines).filter(forWorker);
  const judge = (rel) => {
    const hit = copies.find((c) => c.src === rel || (c.src.endsWith("/") && rel.startsWith(c.src)));
    if (!hit) return "missing";
    const want = hit.src.endsWith("/") ? "./worker/" + hit.src : "./worker/" + (path.dirname(rel) === "." ? "" : path.dirname(rel) + "/");
    return hit.dest === want ? "ok" : "misplaced";
  };
  assert.equal(judge("worker.js"), "ok");
  assert.equal(judge("builder/edit-job.mjs"), "misplaced", "a builder module copied to ./worker/ read as placed");
  assert.equal(judge("builder/theme-candidates/batch-1.mjs"), "misplaced", "a directory copied beside the tree read as placed");
  assert.equal(judge("builder/site-lanes.mjs"), "missing");
});

test("every package the worker tree imports is a production dependency of the root, a builtin, or a shim", async () => {
  // `npm ci --omit=dev` in the image installs `dependencies` alone, so a package
  // the Worker imports out of `devDependencies` is present on every developer's
  // machine, present in CI, and absent in the container — the CI-install trap
  // one layer down. STATEMENT-LEVEL IMPORTS ONLY: page-gen.mjs's rules quote
  // `from "sonner"` and `from "@tanstack/react-router"` inside prompt strings,
  // describing what a generated PAGE imports, and a bare `from "…"` scan reads
  // those as the Worker's own and fails a correct tree.
  const { shimFor } = await import("../builder/worker-loader.mjs");
  const { builtinModules } = await import("node:module");
  const { needed } = workerTreeNeeds();
  const pkg = JSON.parse(fs.readFileSync(ROOT + "package.json", "utf8"));
  const deps = new Set(Object.keys(pkg.dependencies || {}));
  const dev = new Set(Object.keys(pkg.devDependencies || {}));
  const packageOf = (spec) => spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
  const seen = new Map();
  for (const rel of needed) {
    if (!/\.m?js$/.test(rel)) continue;
    const src = fs.readFileSync(ROOT + rel, "utf8")
      .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));
    // The bracket half of a statement carries no quote, so the class stops the
    // match at the first string it would otherwise wander into — an `export
    // const X = [` followed pages later by `from "@/lib/rows"` inside a prompt
    // was read as an import of the kit's rows module on the first draft.
    const specs = [];
    for (const m of src.matchAll(/^(?:import|export)\s[^;"'`]*?\bfrom\s*["']([^"']+)["']/gm)) specs.push(m[1]);
    for (const m of src.matchAll(/^import\s*["']([^"']+)["']/gm)) specs.push(m[1]);
    for (const m of src.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) specs.push(m[1]);
    for (const s of specs) if (!s.startsWith(".")) seen.set(s, rel);
  }
  assert.ok(seen.has("@cloudflare/containers") && seen.has("@neondatabase/serverless"),
    "the bare-import scan no longer sees the Worker's own packages: " + [...seen.keys()].join(", "));
  const wrong = [];
  for (const [spec, rel] of seen) {
    if (spec.startsWith("node:") || builtinModules.includes(spec)) continue;
    if (shimFor(spec)) continue;
    const name = packageOf(spec);
    if (deps.has(name)) continue;
    wrong.push(`${rel} imports ${spec}` + (dev.has(name) ? " (a devDependency — absent under --omit=dev)" : " (not a dependency of the root)"));
  }
  assert.deepEqual(wrong, [], "the job would die at import inside the container: " + wrong.join(" · "));
  // And the tree's node_modules really are the root's, production only.
  const df = fs.readFileSync(SITE.dockerfile, "utf8");
  const lock = copySources(df).filter(forWorker).filter((c) => /^package(-lock)?\.json$/.test(c.src));
  assert.deepEqual(lock.map((c) => c.src).sort(), ["package-lock.json", "package.json"],
    "the worker tree is not handed the root's package.json and lockfile");
  assert.match(df, /^RUN\s+cd\s+worker\s*&&\s*npm ci\b[^\n]*--omit=dev/m,
    "the worker tree's dependencies are not installed from its lockfile, production only");
});

test("no COPY source of the site image is excluded by .dockerignore", () => {
  // The context is the whole repository now, so the ignore file is what keeps it
  // small — and a path it excludes is a path buildx cannot COPY, failing the
  // image the way a missing file does, while the on-disk check above still
  // passes because the file is right there. Plain lines only: the two globs
  // (`**/node_modules`, `**/dist`) and `*.log` name nothing a COPY line would.
  const ignore = fs.readFileSync(ROOT + ".dockerignore", "utf8").split("\n")
    .map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && !l.includes("*"))
    .map((l) => l.replace(/\/$/, ""));
  assert.ok(ignore.includes("test") && ignore.includes("docs"), "the ignore file no longer excludes the big directories: " + ignore.join(", "));
  const df = fs.readFileSync(SITE.dockerfile, "utf8");
  const shut = [];
  for (const { src } of copySources(df).filter((c) => !c.staged)) {
    const s = src.replace(/\/$/, "");
    if (ignore.some((ig) => s === ig || s.startsWith(ig + "/"))) shut.push(src);
  }
  assert.deepEqual(shut, [], "COPYd and ignored at once, so the image cannot build: " + shut.join(", "));
});

test("NO HARNESS SETS UP A SANDBOX THE IMAGE WOULD NOT PRODUCE", () => {
  // EVERY INTEGRATION HARNESS FAKES `/app` BY HAND — it copies the template into
  // a temp directory and then reproduces the pristine bases the Dockerfile bakes.
  // So the Dockerfile and six separate harnesses each hold a copy of the same
  // fact, and when the fact changes they go out of step ONE AT A TIME.
  //
  // MEASURED, not hypothetical: deleting the template's `index.html` for
  // TanStack Start broke SIX harnesses, and I fixed one by hand and shipped it.
  // `family apps` went red on main; `page gen eval` was skipped so it hid;
  // `site routing`, `theme seam`, `theme render` and `site runtime` were not
  // triggered and would have failed on their next run. That is the whole reason
  // this check is derived rather than a list.
  //
  // THE RULE: a harness may only copy a base that the Dockerfile also bakes.
  const dir = new URL("./integration/", import.meta.url).pathname;
  const df = fs.readFileSync(new URL("../Dockerfile", import.meta.url).pathname, "utf8")
    .replace(/^#[^\n]*$/gm, "");   // a comment naming a retired base is not a bake
  const offenders = [];
  for (const name of fs.readdirSync(dir).filter((f) => f.endsWith(".mjs"))) {
    const src = fs.readFileSync(path.join(dir, name), "utf8").replace(/\/\/[^\n]*/g, "");
    for (const m of src.matchAll(/["'](\.[a-z0-9-]+(?:-base)(?:\.[a-z]+)?)["']/gi)) {
      if (!df.includes(m[1])) offenders.push(name + " copies " + m[1]);
    }
  }
  assert.deepEqual(offenders, [],
    "a harness builds a sandbox the image does not: " + offenders.join(" · ") +
    " — the harness passes or fails on something production never sees");
});

test("the pristine-base scan still sees the bases that DO exist", () => {
  // The check above passes vacuously against a scan that stopped matching, which
  // is the failure this whole file exists to stop one level up. The two real
  // bases are `.routes-base` and `.styles-base.css`; both must be found in the
  // Dockerfile and in at least one harness, or the pattern has drifted.
  const df = fs.readFileSync(new URL("../Dockerfile", import.meta.url).pathname, "utf8");
  const dir = new URL("./integration/", import.meta.url).pathname;
  const all = fs.readdirSync(dir).filter((f) => f.endsWith(".mjs"))
    .map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n");
  for (const base of [".routes-base", ".styles-base.css"]) {
    assert.ok(df.includes(base), "the image no longer bakes " + base);
    assert.ok(new RegExp('["\']' + base.replace(".", "\\.") + '["\']').test(all),
      "no harness reproduces " + base + " — either it is gone or the scan pattern has drifted");
  }
});

test("NO HARNESS SERVES A DOCUMENT OUT OF A DIST", () => {
  // THE HALF THE SANDBOX CHECK ABOVE MISSED, and it cost another red on main.
  // That one caught harnesses that COPY a base the image no longer bakes; this
  // catches the ones that then SERVE `dist["index.html"]` as the document.
  //
  // Under TanStack Start `dist/client` contains no HTML at all — the document is
  // `__root.tsx`, rendered per request — so a harness doing that answers the
  // router's own "Not found" for every page of every site. Measured as exactly
  // "9 chars" in `theme-render`, on all four themes, light and dark.
  //
  // Four harnesses had it. `test/integration/lib/serve-site.mjs` is the one copy
  // now, and this is what stops a fifth being written.
  const dir = new URL("./integration/", import.meta.url).pathname;
  const offenders = [];
  for (const name of fs.readdirSync(dir).filter((f) => f.endsWith(".mjs"))) {
    const src = fs.readFileSync(path.join(dir, name), "utf8").replace(/\/\/[^\n]*/g, "");
    // THE FALLBACK SHAPE ONLY — `… || x["index.html"]` or `… || "index.html"`.
    // That is what actually causes the bug: serving the shell for an address the
    // dist does not have. A bare `x["index.html"]` is too broad and flagged
    // `site-build.mjs`, whose use is the ASSERTION THAT THERE IS NONE
    // (`!built.files["index.html"]`) — a false alarm on correct code, which this
    // repo rates strictly worse than the miss.
    if (/\|\|\s*(?:[A-Za-z_$][\w$.]*)?\[\s*["']index\.html["']\s*\]/.test(src) ||
        /\|\|\s*["']index\.html["']/.test(src)) {
      offenders.push(name);
    }
  }
  assert.deepEqual(offenders, [],
    "these serve a document from the dist: " + offenders.join(", ") +
    " — Start emits no HTML there, so every page would answer Not found. Use lib/serve-site.mjs");
});

test("the shared site server is the one copy, and it renders rather than looking up", () => {
  // The absence above is worth nothing if the replacement stopped doing the job.
  // Asserted on the two properties that make it correct: it resolves the server
  // per REQUEST (a fetch captured at construction is the bundle from before the
  // first build — measured, it answers "no server bundle" for every page), and
  // it has NO shell fallback, which is what stops an unknown address rendering
  // the home page's markup at the wrong URL.
  // COMMENTS BLANKED FIRST: this file's own header explains the bug and
  // therefore CONTAINS its spelling, so a bare scan finds the thing it forbids
  // in the prose describing why it is forbidden. Fourth time this session.
  const lib = fs.readFileSync(new URL("./integration/lib/serve-site.mjs", import.meta.url).pathname, "utf8")
    .replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(lib, /const currentSsr = \(\) =>/, "the server is captured once rather than resolved per request");
  assert.ok(!/\[\s*["']index\.html["']\s*\]/.test(lib), "the shared server fell back to a shell of its own");
  assert.match(lib, /loadSiteServer/, "the shared server no longer loads a built server at all");
  // And every harness that stands a site up uses it.
  //
  // A PROPERTY NOW, NOT A COUNT. This read `users.length >= 4` — a census of the
  // harnesses that happened to exist the day it was written — so deleting
  // `family-apps.mjs` with the families turned it red while every remaining
  // harness was doing exactly the right thing. A test about how many files there
  // are, failing a change that was correct: this repo's most repeated own-goal.
  //
  // What it protects is that nobody hand-rolls a second one, so that is what is
  // asserted: a harness naming the SSR bundle or the loader must go through the
  // shared server. `contrast-cases.mjs` runs its own `createServer` and is not a
  // counter-example — it serves a static page with no built site anywhere near
  // it, which is why it names neither.
  const dir = new URL("./integration/", import.meta.url).pathname;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".mjs"));
  const users = [];
  for (const f of files) {
    const src = fs.readFileSync(path.join(dir, f), "utf8");
    const shared = /serveSite\(/.test(src);
    if (shared) users.push(f);
    if (/loadSiteServer|dist-ssr/.test(src) && !shared) {
      assert.fail(f + " loads a built site server without going through serveSite() — a second copy");
    }
  }
  // The floor is what stops the sweep passing vacuously: a scan that silently
  // stopped matching would report a clean directory and prove nothing.
  assert.ok(users.length >= 3,
    "only " + users.length + " harnesses use the shared server, so the scan is not seeing them: " + users.join(", "));
});
