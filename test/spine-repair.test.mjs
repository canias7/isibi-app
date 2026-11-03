// THE SEAM ON THE PUBLISH SPINE, AND THE ADD STEP'S OWN REPAIR THROUGH IT
// (owner, 2026-09-04: "try to fix it, if not fix, send as it is" — then, when
// the first cut ran the BUILD's repair pass inside the shared spine, "each
// path has a repair path").
//
// The spine offers ONE seam between the compile and the first write and knows
// nothing about what happens there; the ADD step's own round (`addRepairRound`
// in site-add.mjs, driven in test/site-add.test.mjs) is handed in by the addon
// route and by nobody else. THIS file reads the wiring — the hop the wiring
// trap has cut twelve times — from landmark to landmark, never by byte — and
// COMPILES the Worker as a module once, because the round's variable landed
// beside a name the addon route already had and every text read stayed green.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

/**
 * Parse a source as an ES MODULE, flag-free, without evaluating it.
 *
 * `node --check worker.js` exits 0 on this file with a duplicate `let` in it
 * (measured 2026-09-04, Node 22.22): the package declares no `"type"`, so the
 * `.js` is not parsed as a module and the check says nothing. `--input-type`
 * on stdin is the module parse with no file and no flag that may be renamed.
 */
function moduleParse(src) {
  const r = spawnSync(process.execPath, ["--input-type=module", "--check"], { input: src, encoding: "utf8" });
  return { ok: r.status === 0, err: String(r.stderr || "") };
}

test("the Worker parses as an ES module — a text read cannot see a name already taken in the scope", () => {
  // THE OBSERVER IS PROVEN ALIVE FIRST: a source with a duplicate binding must
  // be refused by name, or a pass below means nothing (the plain `--check` did
  // exactly that).
  const control = moduleParse(worker + "\nlet __twice = 1;\nlet __twice = 2;\n");
  assert.equal(control.ok, false, "the module parse passed a duplicate binding — it is not parsing as a module");
  assert.match(control.err, /'__twice' has already been declared/, "the refusal does not name the duplicate");
  const real = moduleParse(worker);
  assert.ok(real.ok, "worker.js does not parse as a module:\n" + real.err.split("\n").slice(0, 6).join("\n"));
});

function between(src, from, to, what) {
  const a = src.indexOf(from);
  assert.ok(a >= 0, `landmark missing: ${what || from}`);
  const b = src.indexOf(to, a);
  assert.ok(b > a, `closing landmark missing after ${what || from}: ${to}`);
  return src.slice(a, b);
}

const spine = between(worker, "async function recompileAndPublish(", "async function siteOgImage(", "the spine");

test("the spine offers a seam between the compile's verdict and the first write, and knows nothing about repair", () => {
  // RE-ANCHORED 2026-09-04: this pinned the hook as the LAST parameter
  // (`afterCompile = null }) {`) and went red when an honest `models` arrived
  // after it for the spine's translation call (run 38) — reporting the seam
  // gone when nothing had moved. The property is that the signature takes the
  // hook and defaults it to none, wherever it sits in the list.
  const signature = spine.slice(0, spine.indexOf(") {") + 3);
  assert.ok(signature.length > 40 && signature.length < 600, "the spine's signature is not where this reads it");
  assert.match(signature, /\bafterCompile = null\b/, "the spine does not take a seam hook, defaulting to none");
  // THE SPINE IMPORTS NOTHING FROM THE BUILD'S REPAIR MODULE and names no
  // repair: the owner's rule is that the add step does not trigger the build
  // path, and the spine is every path's.
  assert.doesNotMatch(worker, /from "\.\/builder\/site-repair\.mjs"/, "the Worker imports the build's repair module");
  assert.doesNotMatch(spine, /repairRound|repairPages|repairBrief/, "the spine reaches for a repair by name");
  const seam = between(spine, 'if (typeof afterCompile === "function") {', "// THE SAME META A BUILD PUBLISHES", "the seam");
  // AFTER the compile verdict and the dead-css refusal, BEFORE the gate and
  // the first write — so what the seam answers is what is written, archived,
  // stored and uploaded.
  const verdict = spine.indexOf("if (!built || built.ok !== true || !built.files)");
  const deadCss = spine.indexOf('error: "dead-css"');
  const seamAt = spine.indexOf('if (typeof afterCompile === "function") {');
  const gate = spine.indexOf('editRpc(env, "edit_may_publish"');
  // THE FIRST WRITE IS THE STAGING (stage 7, 2026-09-05), which sits BEFORE
  // the gate by design — additive, under the build's own prefix — and the
  // live site moves at the activation after it. The seam must precede the
  // staging, because what it answers is what gets staged; this read
  // `writeSiteDistToR2` after the gate and went red for the change.
  const write = spine.indexOf("await stageBuild(buildDeps(env), {");
  const live = spine.indexOf("await activateBuild(adeps, {");
  assert.ok(verdict > 0 && deadCss > verdict && seamAt > deadCss, "the seam runs before the compile is judged or before a dead stylesheet is refused");
  assert.ok(write > seamAt && gate > write && live > gate, "the seam runs after the first write, or the staging is not before the gate, or the activation not after it");
  // What the hook is handed: the build, the pages, the site's languages, the
  // job, and a recompile of a corrected list through the ONE file assembly.
  const call = between(seam, "seamOut = await afterCompile({", "});", "the hook call");
  for (const needle of ["built, pages, langs: siteLangs, job,", "recompile: async (list) => { files = filesFor(list); return compile(); },"]) {
    assert.ok(call.includes(needle), `the hook is not handed: ${needle}`);
  }
  // A hook that throws is logged and ignored — the site compiled.
  assert.match(seam, /\} catch \(e\) \{[\s\S]*seamOut = null;/, "a throwing hook is not held");
  // Its answer replaces the build ONLY when it is a build.
  assert.match(seam, /const replaced = !!\(seamOut && seamOut\.built && seamOut\.built\.ok === true && seamOut\.built\.files && Array\.isArray\(seamOut\.pages\)\);/,
    "the seam replaces the build on an answer that is not a compiled build");
  assert.match(seam, /if \(replaced\) \{ built = seamOut\.built; pages = seamOut\.pages; \}/, "a replacement does not replace both `built` and `pages`");
});

test("the files are ONE assembly, used by the first compile and by a recompile at the seam", () => {
  const assemble = between(spine, "const filesFor = (list) => {", "files = filesFor(pages);", "filesFor");
  assert.match(assemble, /for \(const p of list \|\| \[\]\) f\[p\.path\] = p\.source;/, "the primary pages are not in the assembly");
  assert.match(assemble, /translatePages\(list \|\| \[\], l\.prefix, strings,/, "the variants are not in the assembly");
  // RE-ANCHORED FOR TASK #88: this opened on `for (const l of siteLangs) {`,
  // which WAS the translation loop's first line and is now the assembly's own
  // — the translation phase starts at `const extras = …` since the languages
  // run through `Promise.all`. Anchored the wrong way round, the window ran
  // backwards and the guard reported the assembly as missing. The property is
  // unchanged: the translation phase must not write `files` itself, or there
  // are two assemblies of the same thing and a repair recompiles the stale one.
  const loop = between(spine, "const extras = siteLangs.filter((l) => !l.primary);", "const filesFor = (list) => {", "the translation phase");
  assert.doesNotMatch(loop, /files\[/, "the loop still writes files — two assemblies of the same thing");
  assert.match(spine, /\n  let files = \{\};/, "`files` must be reassignable for a recompile");
  assert.ok(spine.indexOf("files = filesFor(pages);") < spine.indexOf("let built = await compile();"), "the first compile runs before the files are assembled");
});
