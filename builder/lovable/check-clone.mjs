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
if (!/createFileRoute\(["']\/book["']\)/.test(RULES.ROUTE_RULES)) problems.push('ROUTE_RULES no longer shows a createFileRoute example')
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
// The smoke check imports playwright at runtime. Without the package it reports "not installed"
// and silently degrades — which is what happened for seven live runs, so the one check that
// catches a white-screening app had never actually run outside a local test.
const pkg = JSON.parse(fs.readFileSync(path.join(TEMPLATE, 'package.json'), 'utf8'))
if (!pkg.devDependencies?.playwright) {
  problems.push('playwright is not a devDependency of the clone template, so the runtime smoke check can never run')
}
if (!/playwright install/.test(fs.readFileSync(path.join(here, 'Dockerfile'), 'utf8'))) {
  problems.push('the Dockerfile does not install Chromium, so the smoke check would be skipped in the container')
}
// …and having the package is not enough: it is installed under the APP, while build-server.mjs
// lives here, so a bare `import('playwright')` resolves upward and misses it. That is what kept the
// check skipped even after the package was added. It must resolve from APP, and read the chromium
// export through .default — the resolved entry is CommonJS and the named export comes back undefined.
const server = fs.readFileSync(path.join(here, 'build-server.mjs'), 'utf8')
const chromiumMod = fs.existsSync(path.join(here, 'chromium.mjs')) ? fs.readFileSync(path.join(here, 'chromium.mjs'), 'utf8') : ''
if (!chromiumMod) problems.push('chromium.mjs is missing — the smoke check and the integration test both resolve the browser through it')
if (!/createRequire\(path\.join\(root, 'package\.json'\)\)\.resolve\('playwright'\)/.test(chromiumMod)) {
  problems.push('chromium.mjs no longer resolves playwright from the given roots, so CI would silently skip the smoke check again')
}
if (!/default\?\.chromium/.test(chromiumMod)) {
  problems.push('chromium.mjs reads only the named chromium export; playwright\'s CJS entry returns undefined for it')
}
// Every browser call site must go through it. Three of them hard-coded a different wrong path
// before this was one function, and each failure reported as something other than "no browser".
for (const [file, why] of [
  ['build-server.mjs', 'the runtime smoke check would silently report itself skipped'],
  ['integration.test.mjs', 'a hard-coded sandbox path dies in CI'],
]) {
  const src = fs.readFileSync(path.join(here, file), 'utf8')
  // Static `from './chromium.mjs'` or dynamic `import('./chromium.mjs')` both count.
  if (!/(?:from|import\()\s*'\.\/chromium\.mjs'/.test(src)) problems.push(`${file} does not resolve the browser through chromium.mjs — ${why}`)
  // Match the import itself, not prose: the comment explaining the old hard-coded path mentions it,
  // and a first attempt at this rule flagged its own documentation.
  if (/import\(\s*['"][^'"]*node_modules\/playwright/.test(src)) problems.push(`${file} hard-codes a playwright path; it exists on one machine and nowhere else`)
}
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
  // Quote-agnostic on purpose: the template is Prettier-formatted with double quotes, and a checker
  // that pins the quote style fails the next time `npm run format` runs rather than the next time
  // something actually breaks.
  if (!/from ["']\.\/types["']/.test(client)) problems.push('the client no longer imports the generated row types, so every row would fall back to any')
}
const TYPES = path.join(TEMPLATE, 'src/integrations/db/types.ts')
if (!fs.existsSync(TYPES)) problems.push('src/integrations/db/types.ts is missing — the client imports it, so nothing would compile')
else if (!/export interface Tables/.test(fs.readFileSync(TYPES, 'utf8'))) problems.push('types.ts no longer exports a Tables interface, which the client keys every row type off')
if (!/@\/integrations\/db\/client/.test(RULES.DATA_RULES)) problems.push('DATA_RULES no longer tells the model where the database client lives')

// A live run came back with three tables and no access mode on any of them, which leaves them
// unscoped. The rule now lists the modes by name, so the checker holds it to that.
if (!/EVERY table MUST carry an `access` mode/.test(RULES.SCHEMA_RULES)) {
  problems.push('SCHEMA_RULES no longer requires an access mode per table — unscoped tables let anyone read anyone\'s rows')
}
for (const mode of ['user', 'admin', 'feed', 'collect', 'display']) {
  if (!new RegExp('`' + mode + '`').test(RULES.SCHEMA_RULES)) problems.push(`SCHEMA_RULES no longer names the "${mode}" access mode, so the model cannot choose it`)
}

const main = fs.readFileSync(path.join(TEMPLATE, 'src/main.tsx'), 'utf8')

// ── 3d. The pieces both of their apps ship and ours did not ──────────────────
// Found by re-diffing the two zips against this template: fifteen files are in BOTH of their apps
// and were absent here. These are the ones that carry behaviour rather than infrastructure we
// deliberately replaced (their SSR entry, their Supabase client).
for (const [rel, why] of [
  ['src/lib/error-reporting.ts', 'a production white-screen would produce no signal at all'],
  ['src/lib/error-page.tsx', 'a thrown route would unmount the tree and show a blank page'],
  ['eslint.config.js', 'a customer who downloads the repo has nothing to run'],
  ['.prettierrc', 'formatting drifts between the vendored components and generated pages'],
  ['README.md', 'the repo arrives with no explanation of how it fits together'],
  ['public/robots.txt', 'a published site with no robots.txt is a crawl gamble'],
  ['public/favicon.svg', 'the browser tab falls back to a blank page icon'],
  ['.isibi/project.json', 'an app cannot be traced back to the template revision that built it'],
]) {
  if (!fs.existsSync(path.join(TEMPLATE, rel))) problems.push(`${rel} is missing — ${why}`)
}
// The error page only helps if the router is told to use it, and the global handlers only fire if
// something installs them. Both are one line in main.tsx and both fail silently when dropped.
// Matching the bare word would be satisfied by the comment that explains it, which a mutation test
// caught doing exactly that. Match the property being set.
if (!/defaultErrorComponent\s*:/.test(main)) {
  problems.push('main.tsx does not set defaultErrorComponent, so a thrown route white-screens instead of rendering ErrorPage')
}
if (!/installErrorReporting\(\)/.test(main)) {
  problems.push('main.tsx never calls installErrorReporting(), so nothing catches an error outside React')
}
// Their _authenticated layout route is the one pattern from their zip that changes generated code on
// every app with a login. Without it in the rules, each page hand-rolls its own check or forgets.
if (!/_authenticated/.test(RULES.ROUTE_RULES) || !/beforeLoad/.test(RULES.ROUTE_RULES)) {
  problems.push('ROUTE_RULES no longer teaches the _authenticated layout route, so auth checks scatter across pages')
}
// The rules' code examples are handed to the model verbatim. If they contradict the Prettier config
// the template ships, every generated page lands failing the lint script we just gave the customer.
const pr = JSON.parse(fs.readFileSync(path.join(TEMPLATE, '.prettierrc'), 'utf8'))
if (pr.singleQuote === false && /from '@tanstack/.test(RULES.ROUTE_RULES)) {
  problems.push('ROUTE_RULES shows single-quoted imports but .prettierrc sets singleQuote:false — generated pages would lint dirty')
}
// public/ is writeable now (the sitemap lands there) and Vite copies it into dist verbatim, so it
// must be restored between builds or one customer's sitemap is published under another's domain.
// `wipePublic()` alone matches the function DEFINITION, so deleting only the call slipped through.
// The call is what matters, and it must sit alongside the src wipe on the same build path.
if (!/wipeSrc\(\);\s*wipePublic\(\)/.test(server) || !/\.template-public/.test(server)) {
  problems.push('build-server.mjs does not restore public/ between builds — a generated sitemap.xml would leak into the next site')
}

// ── 4. Hash history, because the rules promise it ─────────────────────────────
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
