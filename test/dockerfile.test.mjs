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
  const df = fs.readFileSync(path.join(svc.dir, "Dockerfile"), "utf8");
  const staged = [...entry.matchAll(/path\.join\(path\.dirname\(fileURLToPath\(import\.meta\.url\)\),\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)/g)]
    .map((m) => m[1] + "/" + m[2])
    .filter((rel) => fs.existsSync(path.join(svc.dir, rel)));
  for (const rel of staged) {
    const dir = rel.split("/")[0];
    assert.ok(new RegExp("^COPY\\s+(?:[^\\n]*\\s)?" + dir + "/", "m").test(df),
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
  const df = fs.readFileSync(path.join(svc.dir, "Dockerfile"), "utf8");
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
  const df = fs.readFileSync(new URL("../builder/Dockerfile", import.meta.url).pathname, "utf8")
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
  const df = fs.readFileSync(new URL("../builder/Dockerfile", import.meta.url).pathname, "utf8");
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
