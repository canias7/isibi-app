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

// ── 6. The Radix-backed five must stay Radix-backed ───────────────────────────
// Modal, Dropdown, Popover, Tooltip and MultiSelect were hand-rolled and each was missing the invisible half of
// its job — no focus trap in the dialog, no arrow keys in the menu, a popover that could not be opened from the
// keyboard at all, a tooltip never announced to a screen reader, and overlays that rendered off-screen near a
// window edge. Their PROPS did not change, which is the trap: someone can "simplify" one back to a plain div
// and nothing visible breaks. This check is the thing that notices.
const RADIX_BACKED = {
  'Modal.tsx': '@radix-ui/react-dialog',
  'Dropdown.tsx': '@radix-ui/react-dropdown-menu',
  'Popover.tsx': '@radix-ui/react-popover',
  'Tooltip.tsx': '@radix-ui/react-tooltip',
  'MultiSelect.tsx': '@radix-ui/react-popover',
}
for (const [file, pkg] of Object.entries(RADIX_BACKED)) {
  const p = path.join(COMPONENTS, file)
  if (!fs.existsSync(p)) { problems.push(`${file} is missing`); continue }
  if (!fs.readFileSync(p, 'utf8').includes(pkg)) {
    problems.push(`${file} no longer imports ${pkg} — the accessibility behaviour it exists for (focus trap / keyboard nav / collision flipping) is gone`)
  }
}

// ── 6b. Patterns taken from shadcn ────────────────────────────────────────────
// Three things we adopted after reading their registry, each of which reverts invisibly:
//  · cva() in Button — the variant keys are part of the TYPE, so `variant="primry"` is a compile error. Go back
//    to a lookup object and the typo silently renders an unstyled button instead.
//  · asChild via Radix Slot — lets `<Button asChild><a…>` be a real anchor. Drop it and call sites keep
//    compiling (asChild just lands in ...props and is spread onto the DOM as an unknown attribute).
//  · Sidebar's collapsible groups — a nav group holding the current route must open itself, and the disclosure
//    must be a real button carrying aria-expanded. Both are easy to "tidy" away without anything looking broken.
const SHADCN_PATTERNS = [
  ['Button.tsx', /from 'class-variance-authority'/, 'no longer uses cva() — variant typos stop being compile errors'],
  ['Button.tsx', /@radix-ui\/react-slot/, 'no longer imports Radix Slot — asChild silently does nothing'],
  ['Button.tsx', /export const buttonVariants/, 'no longer exports buttonVariants — link-styled-as-button call sites must re-derive the classes'],
  ['Sidebar.tsx', /aria-expanded/, 'nav group disclosure lost aria-expanded — a screen reader cannot tell open from closed'],
  ['Sidebar.tsx', /holdsCurrent/, 'nav groups no longer auto-open on the current route — the user cannot see where they are'],
]
for (const [file, re, why] of SHADCN_PATTERNS) {
  const p = path.join(COMPONENTS, file)
  if (!fs.existsSync(p)) { problems.push(`${file} is missing`); continue }
  if (!re.test(fs.readFileSync(p, 'utf8'))) problems.push(`${file} ${why}`)
}

// ── 7. Generated row types ────────────────────────────────────────────────────
// db-types.ts is produced from isibi.schema.json at build time, and useResource reads it to type every row. Two
// ways that silently stops working: the template default file goes missing (so the import fails), or someone
// widens useResource's write signature back to `Record<string, any>` — which was the original shape and which
// quietly defeated the whole thing, letting a value outside a declared enum type-check and then be rejected by
// the server at runtime.
const dbTypes = path.join(LIB, 'db-types.ts')
if (!fs.existsSync(dbTypes)) {
  problems.push('src/lib/db-types.ts is missing — useResource imports it, so every build would fail')
} else {
  const hook = fs.existsSync(hookPath) ? fs.readFileSync(hookPath, 'utf8') : ''
  if (!/from '\.\/db-types\.ts'/.test(hook)) problems.push('useResource no longer imports db-types.ts — rows would all fall back to `any`')
  if (/values: Partial<Row> \| Record<string, any>/.test(hook)) {
    problems.push('useResource accepts `Record<string, any>` on writes again — that defeats the generated types (a bad enum value would type-check)')
  }
  // usePublicRows is the ONLY way a page reads a table's public view; a hand-rolled fetch would skip the cache
  // and, more importantly, hide from the reader that they are touching a deliberately-public endpoint.
  if (!/export function usePublicRows/.test(hook)) {
    problems.push('useResource.ts no longer exports usePublicRows — pages would hand-roll the public-view fetch')
  }
  const { dbTypesModule } = await import('./scaffold.mjs')
  // The generator must survive a schema it has never seen, including an empty one.
  try {
    const empty = dbTypesModule({})
    if (!/export interface Tables/.test(empty)) problems.push('dbTypesModule does not emit a Tables interface for an empty schema')
  } catch (e) { problems.push(`dbTypesModule throws on an empty schema: ${e.message}`) }
}

// ── 8. Whole-app starters ─────────────────────────────────────────────────────
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

// ── 9. Icon slots must accept BOTH spellings ─────────────────────────────────
// A live build failed on exactly this: EmptyState declared `icon?: IconComponent` and rendered
// `<Icon/>`, while Stat/PageHeader/Sidebar/NotificationItem declared `icon?: ReactNode` and rendered
// `{icon}`. Every starter and the shared docs pass the COMPONENT, so a generated page following the
// majority hit TS2322 on code that reads correctly. The two spellings are indistinguishable from
// COMPONENT_INVENTORY, so this cannot be left to the model to guess.
{
  const compDir = COMPONENTS;
  for (const f of fs.readdirSync(compDir).filter((n) => n.endsWith(".tsx"))) {
    const src = fs.readFileSync(path.join(compDir, f), "utf8");
    if (/\bicon\??:\s*ReactNode\b/.test(src)) {
      problems.push(`${f} declares \`icon?: ReactNode\`, which rejects \`icon={Inbox}\` — the form every starter and page recipe uses. Use IconSlot from src/lib/icon.tsx.`);
    }
  }
  const helper = path.join(here, 'template/src/lib/icon.tsx');
  if (!fs.existsSync(helper)) problems.push("src/lib/icon.tsx is missing — the components with an icon slot import renderIcon from it");
  else {
    const src = fs.readFileSync(helper, "utf8");
    // A lucide icon is `forwardRef(...)` — an OBJECT, not a function. The first version of renderIcon
    // tested only for a function, so every icon fell through and got rendered as a child: React error
    // #31 on a page that typechecked clean. Checking for a function alone is the bug, not the fix.
    // Matched as the CODE form, not the bare word: the doc comment above it also says $$typeof, and a
    // first version of this rule was satisfied by that comment while the branch itself was gone. Third
    // time this exact trap has been hit — a checker must match what runs, never what explains it.
    if (!/'\$\$typeof' in/.test(src)) problems.push("renderIcon does not recognise a forwardRef component (lucide icons are objects, not functions) — `icon={Inbox}` would throw React error #31 at runtime");
    if (!/isValidElement/.test(src)) problems.push("renderIcon no longer checks isValidElement first, so an element would be mistaken for a component");
  }
}

// ── 10. The import convention must be stated, not inferred ───────────────────
// A live build died on `import { PageHeader } from '../components/PageHeader.tsx'` — a named import
// of a default export, which rollup rejects and which fails the WHOLE site, not just that page. The
// inventory documents named exports where they exist ("default Card + {CardHeader…}") but never
// stated the baseline, so the model generalised from those examples. Costs one sentence to prevent.
{
  const { REACT_RULES: RR } = await import('./react-gen.mjs');
  if (!/EVERY component is a DEFAULT export/.test(RR)) {
    problems.push("REACT_RULES no longer states that components are default exports — a named import of a default export is a hard build failure, and the inventory's `default X + {Y}` entries invite the wrong guess");
  }
  // Every component the inventory names must actually HAVE a default export, or the rule is a lie.
  for (const n of named) {
    const f = path.join(COMPONENTS, `${n}.tsx`);
    if (!fs.existsSync(f)) continue;
    if (!/export default/.test(fs.readFileSync(f, 'utf8'))) {
      problems.push(`${n}.tsx has no default export, but REACT_RULES tells the model every component does`);
    }
  }
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
