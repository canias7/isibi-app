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

// ── 4. Page recipes may only name components that exist ───────────────────────
// A recipe telling the model to use `<FilterPanel>` when the kit has `FilterBar` sends it hunting for a file
// that isn't there. Same drift class as the inventory, so it gets the same guard.
const { componentsNamedInRecipes, RECIPES, FIXED_RECIPES } = await import('./page-recipes.mjs')
// A recipe may legitimately name a NAMED export (CommentList lives in Comment.tsx, FormActions in
// FormSection.tsx), so the valid set is every exported symbol, not just filenames.
const exported = new Set(components)
for (const f of components) {
  const src = fs.readFileSync(path.join(COMPONENTS, `${f}.tsx`), 'utf8')
  for (const m of src.matchAll(/export (?:default )?(?:function|const|class)\s+([A-Z]\w*)/g)) exported.add(m[1])
  for (const m of src.matchAll(/export \{([^}]*)\}/g)) m[1].split(',').forEach((x) => exported.add(x.trim().split(/\s+as\s+/).pop()))
}
// SHOUTED words are emphasis in the prose, not component names.
const badRefs = componentsNamedInRecipes().filter((n) => n !== n.toUpperCase() && !exported.has(n))
if (badRefs.length) problems.push(`page recipes name component(s) that do not exist: ${badRefs.join(', ')}`)

// ── 5. useResource: the documented shape must be the real shape ───────────────
// The rules promise pages a specific set of keys off one destructure. Prose promising a key the hook does not
// return is the same failure as `EmptyState message=` — except here the model writes `const { rows } = …`,
// gets undefined, and the page renders blank with no error at all.
const LIB = path.join(here, 'template/src/lib')
const hookPath = path.join(LIB, 'useResource.ts')
if (!fs.existsSync(hookPath)) {
  problems.push('src/lib/useResource.ts is missing, but the generator rules tell every page to import it')
} else {
  const hook = fs.readFileSync(hookPath, 'utf8')
  const promised = ['data', 'total', 'loading', 'error', 'saving', 'create', 'update', 'remove', 'refetch']
  const returned = promised.filter((k) => new RegExp(`^\\s{4}${k}:`, 'm').test(hook))
  const absent = promised.filter((k) => !returned.includes(k))
  if (absent.length) problems.push(`useResource is documented as returning ${absent.join(', ')} but does not`)
  // Every generated app crashes on its first read ("No QueryClient set") if the provider is ever dropped.
  const main = fs.readFileSync(path.join(here, 'template/src/main.tsx'), 'utf8')
  if (!/QueryClientProvider/.test(main)) problems.push('main.tsx does not mount QueryClientProvider — useResource would throw in every generated app')
}

// ── Report ────────────────────────────────────────────────────────────────────
const recipeCount = RECIPES.length + Object.keys(FIXED_RECIPES).length
console.log(`kit check — ${components.length} components, ${checked} documented props verified, ${recipeCount} page recipes`)
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n`)
  problems.forEach((p) => console.error(`  ✗ ${p}`))
  process.exit(1)
}
console.log('all invariants hold')
