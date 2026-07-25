// check-clone.mjs — keeps the Lovable-clone's written rules true against its actual template.
//
// The rules in rules.mjs are prose handed to a model. Prose drifts: a token gets renamed in
// styles.css, a component is removed, and the rules keep confidently telling the model to use
// something that no longer exists. The model then emits code that cannot build, and the failure
// looks like a bad generation rather than a stale instruction.
//
// Run: node builder/lovable/check-clone.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as RULES from './rules.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATE = path.join(here, 'template')
const UI = path.join(TEMPLATE, 'src/components/ui')
const problems = []

// ── 1. Every token the rules name must exist in the stylesheet ────────────────
// STYLE_RULES tells the model to use `bg-card`, `text-muted-foreground` and so on. Each of those
// resolves to a `--color-<name>` registered in the @theme inline block. If one is missing, the
// class silently produces nothing and the element renders unstyled.
const css = fs.readFileSync(path.join(TEMPLATE, 'src/styles.css'), 'utf8')
const registered = new Set([...css.matchAll(/--color-([a-z0-9-]+):/g)].map((m) => m[1]))

// The rules name classes in two opposite senses — "use `bg-card`" and "NEVER write `bg-slate-900`".
// Scanning the text flat would demand a --color-slate-900 token precisely because the rules forbid
// it, so prohibitions are dropped before looking at what is recommended.
const prohibits = (sentence) => /\bNEVER\b|\bnever\b|\bDo not\b|\bdon't\b|\bavoid\b/i.test(sentence)
const recommendedText = RULES.STYLE_RULES.split(/(?<=\.)\s+/).filter((s) => !prohibits(s)).join(' ')
const namedInRules = [...recommendedText.matchAll(/`(?:bg|text|border|ring)-([a-z0-9-]+)`/g)].map((m) => m[1])
for (const token of new Set(namedInRules)) {
  // `border-border` and `ring-ring` resolve through --color-border / --color-ring
  if (!registered.has(token)) problems.push(`STYLE_RULES tells the model to use a "${token}" colour, but --color-${token} is not registered in styles.css`)
}
// The chart palette is referenced as a range rather than by name.
for (const n of [1, 2, 3, 4, 5]) {
  if (!registered.has(`chart-${n}`)) problems.push(`--color-chart-${n} is missing from styles.css, but the rules promise chart-1…chart-5`)
}
// Both light and dark must define every value, or dark mode falls back to the light one.
const rootBlock = (css.match(/:root\s*\{([\s\S]*?)\n\}/) || [, ''])[1]
const darkBlock = (css.match(/\.dark\s*\{([\s\S]*?)\n\}/) || [, ''])[1]
const varsIn = (s) => new Set([...s.matchAll(/^\s+--([a-z0-9-]+):/gm)].map((m) => m[1]))
const light = varsIn(rootBlock), dark = varsIn(darkBlock)
for (const v of light) {
  if (v === 'radius') continue // a single shared value, deliberately not themed
  if (!dark.has(v)) problems.push(`--${v} is defined in :root but not in .dark — dark mode would inherit the light value`)
}

// ── 2. Components the rules point at must be there ────────────────────────────
const present = new Set(fs.readdirSync(UI).filter((f) => f.endsWith('.tsx')).map((f) => f.replace('.tsx', '')))
const promised = ['button', 'card', 'dialog', 'select', 'table', 'calendar', 'chart', 'command', 'form', 'sidebar']
for (const c of promised) {
  if (!present.has(c)) problems.push(`COMPONENT_RULES names "${c}" but src/components/ui/${c}.tsx does not exist`)
}
const claimed = Number((RULES.COMPONENT_RULES.match(/holds (\d+) shadcn/) || [, 0])[1])
if (claimed !== present.size) problems.push(`COMPONENT_RULES says the kit holds ${claimed} components; there are ${present.size}`)

// ── 3. The route shape in the rules must be the real one ──────────────────────
// ROUTE_RULES shows the model a route skeleton. If the router's API moves, that skeleton becomes a
// recipe for code that will not compile — and every generated page would carry the same error.
const root = fs.readFileSync(path.join(TEMPLATE, 'src/routes/__root.tsx'), 'utf8')
const index = fs.readFileSync(path.join(TEMPLATE, 'src/routes/index.tsx'), 'utf8')
if (!/createFileRoute/.test(index)) problems.push('the template\'s own index.tsx does not use createFileRoute, but ROUTE_RULES tells the model to')
if (!/createFileRoute\('\/book'\)/.test(RULES.ROUTE_RULES)) problems.push('ROUTE_RULES no longer shows a createFileRoute example')
if (!/<Outlet\s*\/>/.test(root)) problems.push('__root.tsx has lost its <Outlet />, so no child route can render')
// ROUTE_RULES makes a head/meta block mandatory on every page. Those blocks only reach the document
// if the root route renders <HeadContent /> — TanStack Start supplies it server-side, and this app
// is a client-rendered SPA. Without it every title and og tag is computed and thrown away, which is
// invisible in the browser and cost a real debugging pass to find.
if (!/<HeadContent\s*\/>/.test(root)) {
  problems.push('__root.tsx does not render <HeadContent />, so every page\'s head/meta block would be silently discarded')
}
if (!/head:\s*\(\)/.test(RULES.ROUTE_RULES)) problems.push('ROUTE_RULES no longer requires a head block on each page')

// ── 3b. The shell rules, derived from diffing their two apps ──────────────────
// 66 of the 73 files the two Lovable apps share are byte-identical; __root.tsx is one of the seven
// that are not. It is written per app and carries the header/nav, the site-wide fallback meta and
// the webfont <link>s. An earlier version of these rules told the model to leave it alone, which
// would have produced apps with no chrome and no fonts.
if (/don't rewrite it|already exists — don't/.test(RULES.ROUTE_RULES)) {
  problems.push('ROUTE_RULES still tells the model not to write __root.tsx, but Lovable writes it per app')
}
for (const [needle, why] of [
  ['<HeadContent />', 'without it every page\'s head block is discarded'],
  ['<Outlet />', 'without it no page renders'],
  ['fonts.googleapis.com', 'a --font-* token with no font loaded falls back silently'],
  ['og:title', 'the site-wide fallback meta is what a link preview uses'],
]) {
  if (!RULES.SHELL_RULES.includes(needle)) problems.push(`SHELL_RULES no longer mentions ${needle} — ${why}`)
}
if (!/font-display/.test(RULES.SHELL_RULES) || !/MUST load that font/.test(RULES.SHELL_RULES)) {
  problems.push('SHELL_RULES no longer ties --font-display to actually loading the font, so the CSS token would silently fall back')
}
if (!/routeTree\.gen/.test(fs.readFileSync(path.join(TEMPLATE, '.gitignore'), 'utf8'))) {
  problems.push('routeTree.gen.ts is no longer gitignored — a stale committed copy would silently override the generated one')
}
const pkg = JSON.parse(fs.readFileSync(path.join(TEMPLATE, 'package.json'), 'utf8'))
if (!/tsr generate/.test(pkg.scripts?.build || '')) {
  problems.push('the build script no longer runs `tsr generate` first — a clean checkout would fail on "Could not resolve ./routeTree.gen"')
}

// ── 3c. The data client the rules point at must exist and match them ─────────
// DATA_RULES hands the model a concrete API — db.from(...).select().eq(...), db.publicFrom, and
// db.auth. Their template ships a Supabase client for this; ours ships an equivalent over the
// per-app REST API. If the rules and the client drift, every generated page calls a method that
// is not there, and the failure reads as a bad generation rather than a stale instruction.
const CLIENT = path.join(TEMPLATE, 'src/integrations/db/client.ts')
if (!fs.existsSync(CLIENT)) {
  problems.push('src/integrations/db/client.ts is missing, but DATA_RULES tells every page to import it')
} else {
  const client = fs.readFileSync(CLIENT, 'utf8')
  const methods = [...RULES.DATA_RULES.matchAll(/db\.(?:from\([^)]*\)\.)?([a-zA-Z]+)\(/g)].map((m) => m[1])
  for (const method of new Set(methods)) {
    if (method === 'from') continue
    const declared = new RegExp(`\\b(?:async )?${method}\\s*[(<]|${method}:\\s*(?:async )?[({]`).test(client)
    if (!declared) problems.push(`DATA_RULES shows the model \`db…${method}(\)\` but the client does not define ${method}`)
  }
  if (!/publicFrom/.test(client)) problems.push('the client has lost publicFrom, so a signed-out visitor could not read a declared publicView')
  if (!/from '.\/types'/.test(client)) problems.push('the client no longer imports the generated row types, so every row would fall back to any')
}
const TYPES = path.join(TEMPLATE, 'src/integrations/db/types.ts')
if (!fs.existsSync(TYPES)) problems.push('src/integrations/db/types.ts is missing — the client imports it, so nothing would compile')
else if (!/export interface Tables/.test(fs.readFileSync(TYPES, 'utf8'))) problems.push('types.ts no longer exports a Tables interface, which the client keys every row type off')
if (!/@\/integrations\/db\/client/.test(RULES.DATA_RULES)) problems.push('DATA_RULES no longer tells the model where the database client lives')

// ── 4. Hash history, because the rules promise it ─────────────────────────────
const main = fs.readFileSync(path.join(TEMPLATE, 'src/main.tsx'), 'utf8')
if (!/createHashHistory/.test(main)) {
  problems.push('main.tsx no longer uses hash history, but ROUTE_RULES tells the model the # is handled for it')
}

// ── 5. The rules must not contradict themselves ───────────────────────────────
const recommendedOnly = (text) => text.split(/(?<=\.)\s+/).filter((s) => !prohibits(s)).join(' ')

const page = recommendedOnly(RULES.buildPageRules())
if (/bg-slate-|text-gray-|bg-white\b/.test(page)) {
  problems.push('the assembled page rules recommend a raw palette colour outside of a prohibition')
}
// The literal-mirror variant may MENTION the ui path in order to forbid it; what it must never do
// is tell the model to import from there.
const literal = recommendedOnly(RULES.buildPageRules({ preferComponents: false }))
if (literal.includes('@/components/ui/')) {
  problems.push('the literal-mirror variant recommends @/components/ui/, which is the thing it exists to avoid')
}
if (!/Do not import/i.test(RULES.LITERAL_MIRROR_COMPONENT_RULES)) {
  problems.push('the literal-mirror variant no longer forbids importing the component library, so it is not a literal mirror')
}

// ── report ────────────────────────────────────────────────────────────────────
const tokens = registered.size
if (problems.length) {
  console.error(`clone check — ${problems.length} problem(s):\n`)
  for (const p of problems) console.error('  ✗ ' + p)
  process.exit(1)
}
console.log(`clone check — ${present.size} components, ${tokens} registered colour tokens, light/dark parity, route shape and build wiring all verified`)
console.log('all invariants hold')
