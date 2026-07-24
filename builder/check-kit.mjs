// check-kit.mjs — guards the component kit's invariants.
//
// Every rule here exists because breaking it has ALREADY cost us real bugs. Written-down conventions drift;
// a check that runs does not. Run with `node builder/check-kit.mjs` (exits non-zero on any violation).
//
//   1. Components are .tsx.        A stray .jsx still builds, so nothing would tell you the kit had drifted.
//   2. Every component is in COMPONENT_INVENTORY. The inventory once fell THREE ROUNDS behind — 47 of 118
//      components were invisible to the generator, which happily rebuilt things it already had.
//   3. Documented props exist.     `variant="outline"`, `EmptyState message=` and `<Avatar size={32}/>` were
//      all prose promising something the code did not implement. Three silent rendering bugs.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const COMPONENTS = path.join(here, 'template/src/components')
const problems = []

// ── 1. Extension ──────────────────────────────────────────────────────────────
const all = fs.readdirSync(COMPONENTS)
const strays = all.filter((f) => /\.(jsx|js)$/.test(f))
if (strays.length) problems.push(`components must be .tsx — found ${strays.length}: ${strays.join(', ')}`)
const components = all.filter((f) => f.endsWith('.tsx')).map((f) => f.replace('.tsx', ''))

// ── 2. Inventory coverage ─────────────────────────────────────────────────────
const { COMPONENT_INVENTORY } = await import('./react-gen.mjs')
const missing = components.filter((n) => !COMPONENT_INVENTORY.includes(`${n}.tsx`))
if (missing.length) {
  problems.push(`${missing.length} component(s) missing from COMPONENT_INVENTORY, so the generator cannot use them:\n    ${missing.join(', ')}`)
}
// …and the reverse: the inventory naming a file that no longer exists.
const named = [...COMPONENT_INVENTORY.matchAll(/`([A-Z][A-Za-z0-9]*)\.tsx`/g)].map((m) => m[1])
const ghosts = [...new Set(named)].filter((n) => !components.includes(n))
if (ghosts.length) problems.push(`inventory names component(s) that do not exist: ${ghosts.join(', ')}`)

// ── 3. Documented props must be real ──────────────────────────────────────────
// Parse "`Name.tsx` (propA, propB — description)" out of the inventory and check each prop against the file's
// generated interface. Only bare identifiers are checked; shapes like `items=[{…}]` are skipped.
let checked = 0
for (const m of COMPONENT_INVENTORY.matchAll(/`([A-Z][A-Za-z0-9]*)\.tsx`\s*\(([^)]*)\)/g)) {
  const [, name, argsRaw] = m
  if (!components.includes(name)) continue
  const src = fs.readFileSync(path.join(COMPONENTS, `${name}.tsx`), 'utf8')
  // Everything before the em-dash is the prop list; after it is prose.
  // Strip nested shapes and call signatures FIRST — `columns=[{key,header,render}]` and `renderRow(row,i,update)`
  // describe the shape of a value, not props of the component, and reading their fields as props is wrong.
  const propsPart = argsRaw.split('—')[0]
    .replace(/=\[[^\]]*\]/g, '')
    .replace(/=\{[^}]*\}/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/=[^,]*/g, '')
  const claimed = propsPart.split(',').map((p) => p.trim()).filter((p) => /^[a-z][A-Za-z0-9]*$/.test(p))
  // A component that spreads ...props accepts every DOM attribute for its element, so those are always valid.
  const spreads = /\.\.\.(props|rest)/.test(src)
  for (const prop of claimed) {
    if (spreads && /^(on[A-Z]|value|checked|type|name|id|placeholder|disabled|required|min|max|step|rows|accept|multiple|autoComplete)/.test(prop)) continue
    checked++
    // The prop is real if it appears in an interface/type body OR in the destructuring.
    if (!new RegExp(`^\\s+${prop}\\??:`, 'm').test(src) && !new RegExp(`[{,]\\s*${prop}\\s*[,=:}]`).test(src)) {
      problems.push(`${name}.tsx: inventory documents prop \`${prop}\` but the component does not accept it`)
    }
  }
}

// ── Report ────────────────────────────────────────────────────────────────────
console.log(`kit check — ${components.length} components, ${checked} documented props verified`)
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n`)
  problems.forEach((p) => console.error(`  ✗ ${p}`))
  process.exit(1)
}
console.log('all invariants hold')
