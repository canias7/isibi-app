// build-base-css.mjs — compiles the clone template's src/styles.css into base-css.data.mjs.
//
// The theme stage merges each app's palette INTO the template stylesheet, so the pipeline needs that
// file as a string. In CI and locally it could just be read off disk — but the pipeline runs inside
// worker.js, a Cloudflare Worker with no filesystem. Same split the capability registry and the
// starters already use: author the real file, generate a flat data module, commit both.
//
// Getting this wrong is silent and total: applyTheme returns the base unchanged when there is no
// @theme block to merge into, so a stale or empty module ships an app with NO stylesheet — every
// page renders unstyled and nothing errors.
//
//   node builder/lovable/build-base-css.mjs           # regenerate
//   node builder/lovable/build-base-css.mjs --check   # fail if stale (CI)

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const SOURCE = path.join(here, 'template/src/styles.css')
const OUT = path.join(here, 'base-css.data.mjs')

const css = fs.readFileSync(SOURCE, 'utf8')
const generated =
  '// GENERATED from template/src/styles.css by build-base-css.mjs — do not edit by hand.\n' +
  '// The pipeline runs inside the Worker, which has no filesystem, so the stylesheet ships as data.\n' +
  `export const BASE_CSS = ${JSON.stringify(css)}\n`

if (process.argv.includes('--check')) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : ''
  if (current !== generated) {
    console.error('base-css.data.mjs is STALE — run: node builder/lovable/build-base-css.mjs')
    process.exit(1)
  }
  console.log('base-css.data.mjs is up to date')
} else {
  fs.writeFileSync(OUT, generated)
  console.log(`base-css.data.mjs written — ${css.length} chars`)
}
