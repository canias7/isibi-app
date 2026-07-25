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

// ── 6. Whole-app starters ─────────────────────────────────────────────────────
// A starter IS the app for anyone whose brief matches it, so a broken import or a hand-rolled fetch does not
// degrade one build — it degrades every booking site we ever ship. These are the same invariants the kit has,
// applied one layer up.
const STARTERS = path.join(here, 'starters')
let starterCount = 0, starterPages = 0
if (fs.existsSync(STARTERS)) {
  const { getCapability } = await import('./capability-registry.mjs')
  const { readStarters } = await import('./build-starters.mjs')
  let data
  try { data = readStarters() } catch (e) { problems.push(`starters do not load: ${e.message}`); data = {} }

  for (const [id, s] of Object.entries(data)) {
    starterCount++
    const pages = s.meta.pages || []
    if (!pages.includes('Home')) problems.push(`starter "${id}" has no Home page — every app needs a landing route`)
    if (!pages.includes('SignIn')) problems.push(`starter "${id}" has no SignIn page but declares member/admin roles`)
    // Declared coverage is what stops a capability being generated, so a typo silently regenerates the page.
    for (const c of s.meta.covers || []) if (!getCapability(c)) problems.push(`starter "${id}" claims to cover "${c}", which is not a real capability`)

    for (const [p, src] of Object.entries(s.files)) {
      if (!p.endsWith('.tsx')) continue
      starterPages++
      for (const m of src.matchAll(/from '\.\.\/components\/(\w+)\.tsx'/g)) {
        if (!components.includes(m[1])) problems.push(`starter "${id}" ${p} imports ../components/${m[1]}.tsx, which does not exist`)
      }
      // Named imports must be real named exports — `import { FormActions } from './FormSection.tsx'`.
      for (const m of src.matchAll(/import \{([^}]+)\} from '\.\.\/components\/(\w+)\.tsx'/g)) {
        const file = path.join(COMPONENTS, `${m[2]}.tsx`)
        if (!fs.existsSync(file)) continue
        const body = fs.readFileSync(file, 'utf8')
        for (const sym of m[1].split(',').map((x) => x.trim()).filter(Boolean)) {
          if (!new RegExp(`export (?:function|const|class) ${sym}\\b`).test(body) && !new RegExp(`export \\{[^}]*\\b${sym}\\b`).test(body)) {
            problems.push(`starter "${id}" ${p} imports { ${sym} } from ${m[2]}.tsx, which does not export it`)
          }
        }
      }
      // The whole point of useResource is that no page hand-rolls plain table I/O. A starter doing it teaches
      // the model — which reads the starter as its worked example — to do it too.
      //
      // SUB-ACTIONS are the exception and are allowed: `/rows/<t>/<id>/restore`, `/stats`, `/duplicates` and the
      // rest are endpoints useResource deliberately does not wrap, and api.* is the documented way to reach them.
      // Only a bare list/record path — `/rows/<t>` or `/rows/<t>/<id>` — is the thing being banned.
      for (const m of src.matchAll(/api\.(get|post|patch|del)\(\s*[`'"]([^`'"]*)/g)) {
        const route = m[2].replace(/\$\{[^}]*\}/g, ':x').split('?')[0]
        const seg = route.split('/').filter(Boolean)          // ['rows', '<table>', …]
        if (seg[0] !== 'rows') continue
        const rest = seg.slice(2).filter((s) => s !== ':x' && !/^\d+$/.test(s))
        if (!rest.length) problems.push(`starter "${id}" ${p} calls api.${m[1]}('${m[2]}') — plain table access goes through useResource`)
      }
    }
  }

  // The committed data module must match the authored files, or the pipeline ships a stale starter.
  const dataPath = path.join(here, 'starters.data.mjs')
  if (!fs.existsSync(dataPath)) problems.push('starters.data.mjs is missing — run `node builder/build-starters.mjs`')
  else {
    const { STARTER_DATA } = await import('./starters.data.mjs')
    for (const [id, s] of Object.entries(data)) {
      const built = STARTER_DATA[id]
      if (!built) { problems.push(`starter "${id}" is not in starters.data.mjs — run \`node builder/build-starters.mjs\``); continue }
      for (const [p, src] of Object.entries(s.files)) {
        if (built.files[p] !== src) { problems.push(`starters.data.mjs is STALE for "${id}" (${p}) — run \`node builder/build-starters.mjs\``); break }
      }
    }
  }
}

// Which app types still generate from scratch. Not a failure — a starter is a big thing to write — but the gap
// should be visible on every run rather than something you have to remember to go and look up.
let starterGap = []
if (starterCount) {
  const { BUNDLES } = await import('./capability-bundles.mjs')
  const { coverage } = await import('./starters.mjs')
  starterGap = coverage(BUNDLES).generateFromScratch
}

// ── Report ────────────────────────────────────────────────────────────────────
const recipeCount = RECIPES.length + Object.keys(FIXED_RECIPES).length
console.log(`kit check — ${components.length} components, ${checked} documented props verified, ${recipeCount} page recipes, ` +
  `${starterCount} whole-app starter(s) / ${starterPages} starter pages`)
if (starterGap.length) console.log(`  no starter yet (these still generate from scratch): ${starterGap.join(', ')}`)
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n`)
  problems.forEach((p) => console.error(`  ✗ ${p}`))
  process.exit(1)
}
console.log('all invariants hold')
