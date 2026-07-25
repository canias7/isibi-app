// check.mjs — typecheck the template with EVERY shadcn component mounted.
//
// render-all.tsx imports and renders all 46. Compiling the template alone does not touch most of
// them, so a component whose upstream package renamed a prop stays broken until something actually
// uses it. That is not hypothetical: react-resizable-panels 4.x renamed `direction` to
// `orientation`, and this file kept passing the old name for eight CI runs.
//
// It lived as inline bash inside .github/workflows/clone-check.yml, which is exactly why nobody
// noticed — there was no way to run it locally alongside the other suites. It is a script now.
//
// Run: node builder/lovable/smoke/check.mjs

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATE = path.join(here, '..', 'template')
const target = path.join(TEMPLATE, 'src/routes/render-all.tsx')

if (!fs.existsSync(path.join(TEMPLATE, 'node_modules'))) {
  console.error('render-all check — template dependencies are not installed; run npm install in builder/lovable/template')
  process.exit(1)
}

const run = (cmd, args) => spawnSync(cmd, args, { cwd: TEMPLATE, encoding: 'utf8', shell: false })

fs.copyFileSync(path.join(here, 'render-all.tsx'), target)
let code = 0
try {
  run('npx', ['tsr', 'generate'])
  const tsc = run('npx', ['tsc', '--noEmit', '--pretty', 'false'])
  const errors = String(tsc.stdout || '').split('\n').filter((l) => l.includes('error TS'))
  if (errors.length) {
    console.error(`render-all check — ${errors.length} type error(s) with all 46 components mounted:\n`)
    for (const e of errors.slice(0, 20)) console.error('  ✗ ' + e)
    code = 1
  } else {
    console.log('render-all check — all 46 components typecheck when actually mounted')
  }
} finally {
  // Leaving it behind would put a route named /render-all into the next real build.
  fs.rmSync(target, { force: true })
  run('npx', ['tsr', 'generate'])
}
process.exit(code)
