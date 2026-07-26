// worker-wiring.test.mjs — the clone, wired into the live builder in worker.js.
//
// The clone is a DIFFERENT stack from the legacy builder: React 19 + Tailwind v4 + TanStack Router,
// file-based routes under src/routes/, its own container image. Every legacy post-generation step
// reads the OTHER layout — scaffoldRouting keys off src/pages/, the lint gate expects it, the
// completeness check demands src/App.tsx, and buildInContainer talks to the React 18 image.
//
// Run any one of those against clone output and it fails in a way that looks like a bad generation:
// an empty router, a lint error for a file that does not exist, "the generated project came out
// incomplete", or a compile that cannot resolve a single import. That is precisely how the builder
// died for four months, so the gates get a test.
//
// Run: node builder/lovable/worker-wiring.test.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const worker = fs.readFileSync(path.join(here, '../../worker.js'), 'utf8')

let failures = 0
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

console.log('\nthe clone pipeline is reachable from the worker')
{
  check('the pipeline is imported', /import\("\.\/builder\/lovable\/pipeline\.mjs"\)/.test(worker))
  check('and actually called', /await runClonePipeline\(brief, RB_MAX_OUT/.test(worker))
  check('against its OWN container', /getContainer\(env\.CLONE_BUILD_CONTAINER\)/.test(worker))
  // applyTheme returns the base unchanged when there is no @theme block to merge into, so a missing
  // baseCss ships an app with NO stylesheet — every page unstyled, nothing thrown.
  check('with the base stylesheet supplied', /baseCss: BASE_CSS/.test(worker))
  check('which ships as data, since a Worker has no filesystem', /base-css\.data\.mjs/.test(worker))
  check('a failure falls back rather than losing the build', /clone pipeline came up short/.test(worker))
}

console.log('\nevery legacy step that reads the OTHER layout is gated off')
for (const [needle, why] of [
  ['if (!cloneRes && starterId', 'the 258-kit starters do not exist in the clone'],
  ['if (!cloneRes && !files["src/App.jsx"])', 'scaffoldRouting keys off src/pages/ and would generate an EMPTY router'],
  ['if (usesBackend && !cloneRes)', 'the schema repair rewrites the legacy layout'],
  ['if (env.PIPELINE_V2 === "1" && !cloneRes)', 'the lint gate would flag files the clone never writes'],
  ['while (!cloneRes && !bd.ok', 'the fix loop rebuilds through the React 18 container'],
  ['if (!cloneRes && Array.isArray(bd.runtimeErrors)', 'the runtime repair rebuilds through the wrong container too'],
]) {
  check(needle.slice(0, 46), worker.includes(needle), why)
}

console.log('\nthe completeness check knows the clone\'s shape')
{
  // The clone has NO src/App.tsx and no src/pages/. Judged by the legacy contract, a perfectly good
  // build is rejected with "the generated project came out incomplete" — the exact four-month bug.
  check('it has a clone branch', /cloneRes\s*\n?\s*\?\s*Boolean\(files\["index\.html"\] && files\["src\/routes\/index\.tsx"\]/.test(worker))
  check('and still requires the root layout', /files\["src\/routes\/__root\.tsx"\]/.test(worker))
  check('the legacy branch is untouched', /files\["src\/pages\/Home\.tsx"\] && files\["src\/App\.tsx"\]/.test(worker))
}

console.log('\nfollow-up edits on a clone app go to the clone\'s own loop')
{
  // Detected from the app's SHAPE, not a flag: a site the clone built must stay editable by the
  // clone even if CLONE_BUILDER is later switched off, or its next edit is handed a src/pages/
  // contract for an app that has none.
  check('a clone app is recognised by its root layout', /files\["src\/routes\/__root\.tsx"\] && env\.CLONE_BUILD_CONTAINER/.test(worker))
  check('and revised by reviseApp', /await reviseApp\(files, instruction, RB_MAX_OUT/.test(worker))
  check('through the clone container', /const cc = getContainer\(env\.CLONE_BUILD_CONTAINER\)/.test(worker))
  check('the legacy edit prompt is skipped', /if \(!cloneRevise\) \{/.test(worker))
  check('and so is the legacy rebuild', /while \(!cloneRevise && !bd\.ok/.test(worker))
  // reviseApp sizes each of its steps, so the revise stream needs a per-call ceiling like the
  // build one — without it every step asks for the whole budget.
  check('the revise stream takes a per-call ceiling', /const streamGen = async \(system, userContent, onDelta, maxTokens\)/.test(worker))
  check('a backend added by an edit is still picked up', /the clone edit may have extended the backend/.test(worker))
}

console.log('\nthe container is declared, bound and migrated')
{
  const wrangler = fs.readFileSync(path.join(here, '../../wrangler.jsonc'), 'utf8')
  check('the image is the clone Dockerfile', /"image":\s*"\.\/builder\/lovable\/Dockerfile"/.test(wrangler))
  check('the binding exists', /"name":\s*"CLONE_BUILD_CONTAINER"/.test(wrangler))
  // A new Durable Object class without its own migration tag is rejected at deploy, not at review.
  check('a migration tag was added for the new class', /"new_sqlite_classes":\s*\["CloneBuildContainer"\]/.test(wrangler))
  check('the class is exported from the worker', /export class CloneBuildContainer extends Container/.test(worker))
}

console.log('\nthe generated stylesheet data is current')
{
  const data = fs.readFileSync(path.join(here, 'base-css.data.mjs'), 'utf8')
  const source = fs.readFileSync(path.join(here, 'template/src/styles.css'), 'utf8')
  check('base-css.data.mjs matches template/src/styles.css', data.includes(JSON.stringify(source)),
    'run: node builder/lovable/build-base-css.mjs')
  check('and carries an @theme block to merge into', source.includes('@theme'))
}

console.log(failures ? `\n${failures} FAILED\n` : '\nall clone-wiring checks pass\n')
process.exit(failures ? 1 : 0)
