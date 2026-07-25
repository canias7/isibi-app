// integration.test.mjs — runs the clone pipeline end to end against the REAL template and a REAL
// vite build. The model is still a stub, but everything downstream of it is genuine: files are
// written into a copy of the template, `tsr generate` runs, vite compiles, and the built app is
// loaded in a browser.
//
// This is what connects phase 3 to phase 1. The unit test proves the pipeline calls things in the
// right order; this proves that what comes out the other end is an app that actually runs.
//
// Run: node builder/lovable/integration.test.mjs

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runClonePipeline, traceSummary } from './pipeline.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATE = path.join(here, 'template')
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'clone-build-'))

let failures = 0
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

// ── a copy of the template, sharing the installed node_modules ────────────────
console.log(`\nworkspace: ${WORK}`)
fs.cpSync(TEMPLATE, WORK, {
  recursive: true,
  filter: (src) => !src.includes('node_modules') && !src.includes('/dist'),
})
fs.symlinkSync(path.join(TEMPLATE, 'node_modules'), path.join(WORK, 'node_modules'))

// ── a stub model that emits page code a compiler will actually accept ─────────
// The unit test only cares about control flow, so its pages are stubs. Here they have to be real
// TSX using the real router API and the real token names, or the build is not testing anything.
const page = (route, title, body) => `===FILE: src/routes/${route === '/' ? 'index' : route.slice(1)}.tsx===
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { db } from '@/integrations/db/client'

export const Route = createFileRoute('${route}')({
  head: () => ({ meta: [
    { title: '${title} — Lumière Theatre' },
    { name: 'description', content: '${title} at the Lumière Theatre.' },
    { property: 'og:title', content: '${title} — Lumière Theatre' },
    { property: 'og:description', content: '${title} at the Lumière Theatre.' },
  ] }),
  component: Page,
})

function Page() {
  // Exercises the real client against the real GENERATED types: the seat column exists on Booking
  // because the schema stage declared it, so a typo here would fail the build.
  const { data: taken } = useQuery({
    queryKey: ['bookings', '${route}'],
    queryFn: async () => {
      const { data, error } = await db.publicFrom('bookings').select().eq('status', 'confirmed').order('seat')
      if (error) throw new Error(error.message)
      return (data ?? []).map((b) => b.seat)
    },
  })
  void taken
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">Lumière Theatre</p>
        <h1 className="font-display mt-1 text-3xl" data-page="${route}">${title}</h1>
        <div className="mt-8 rounded-2xl border border-border bg-card p-6">${body}</div>
        <Link to="/" className="mt-6 inline-block text-sm text-muted-foreground underline">Home</Link>
      </div>
    </div>
  )
}
`

const stub = async (system, user, maxTokens) => {
  const out = (text) => ({ text, usedOut: Math.min(maxTokens, 300) })
  if (/Ask AT MOST/.test(system)) return out('')
  if (/Plan the app/.test(system)) {
    return out(JSON.stringify({
      name: 'Lumière Theatre',
      pages: [{ id: 'index', title: 'Tonight' }, { id: 'book', title: 'Choose seats' }, { id: 'my-tickets', title: 'My tickets' }],
      tables: ['bookings'],
    }))
  }
  if (/Design the database FIRST/.test(system)) {
    return out('===FILE: isibi.schema.json===\n' + JSON.stringify({
      tables: [{
        name: 'bookings', access: 'user',
        columns: [{ name: 'seat', type: 'text', required: true }, { name: 'status', type: 'text', enum: ['held', 'confirmed'] }],
        publicView: { columns: ['seat'], where: ['status:eq:confirmed'] },
      }],
    }, null, 2))
  }
  if (/Return the COMPLETE src\/styles\.css/.test(system)) {
    // A real per-app theme edit: adds a token in oklch to @theme, :root and .dark, as the rules require.
    const css = fs.readFileSync(path.join(TEMPLATE, 'src/styles.css'), 'utf8')
      .replace(/@theme \{[\s\S]*?\}/, '@theme {\n  --color-tier-premium: oklch(0.86 0.09 60);\n}')
    return out('===FILE: src/styles.css===\n' + css)
  }
  if (/THE APP SHELL/.test(system)) {
    // A real shell: HeadContent so page meta lands, Outlet so pages render, site-wide fallback
    // meta naming the business, and the webfont links that make --font-display resolve.
    return out(`===FILE: src/routes/__root.tsx===
import { HeadContent, Link, Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Lumière Theatre' },
      { name: 'description', content: 'Tonight at the Lumière.' },
      { property: 'og:title', content: 'Lumière Theatre' },
      { property: 'og:type', content: 'website' },
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&display=swap' },
    ],
  }),
  component: RootLayout,
})

function RootLayout() {
  return (
    <>
      <HeadContent />
      <div className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border" data-shell="header">
          <nav className="mx-auto flex max-w-6xl gap-5 px-6 py-4 text-sm">
            <Link to="/">Tonight</Link>
            <Link to="/book">Book</Link>
            <Link to="/my-tickets">My tickets</Link>
          </nav>
        </header>
        <Outlet />
      </div>
    </>
  )
}
`)
  }
  const m = user.match(/Build the page at (\S+) — (.+)/)
  if (m) return out(page(m[1], m[2].trim(), 'Body copy.'))
  return out('')
}

// ── a real build ──────────────────────────────────────────────────────────────
const build = async (files) => {
  for (const [rel, src] of Object.entries(files)) {
    const abs = path.join(WORK, rel)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, src)
  }
  try {
    execFileSync('npm', ['run', 'build'], { cwd: WORK, stdio: 'pipe', timeout: 300000 })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e.stdout || '') + String(e.stderr || '') }
  }
}

console.log('\nrunning the clone pipeline against the real template')
const res = await runClonePipeline('A theatre seat booking site for the Lumière.', 40000, { generate: stub, build })
console.log(traceSummary(res))

console.log('\ndb-types generated for $0')
{
  const gen = res.trace.find((r) => r.stage === 'db-types')
  check('the pipeline generated row types', !!gen, gen ? gen.generated : 'stage never ran')
  check('it cost nothing', gen?.out === 0)
}

console.log('\nbuild')
check('pipeline reports success', res.ok === true, res.build?.error ? res.build.error.split('\n')[0] : '')
check('vite produced a bundle', fs.existsSync(path.join(WORK, 'dist/index.html')))
check('the route tree was generated', fs.existsSync(path.join(WORK, 'src/routeTree.gen.ts')))

console.log('\nwhat the pipeline wrote')
{
  const schema = JSON.parse(fs.readFileSync(path.join(WORK, 'isibi.schema.json'), 'utf8'))
  check('schema on disk and parseable', Array.isArray(schema.tables) && schema.tables.length === 1)
  check('the schema kept its publicView', !!schema.tables[0].publicView)
  const types = fs.readFileSync(path.join(WORK, 'src/integrations/db/types.ts'), 'utf8')
  check('row types were generated from the schema', /export interface Booking/.test(types), types.split('\n').find((l) => l.includes('interface Booking')) || '')
  check('the enum column became a literal union', /'held' \| 'confirmed'/.test(types))
  check('the generated types replaced the empty placeholder', !/export interface Tables \{\}/.test(types))
  const css = fs.readFileSync(path.join(WORK, 'src/styles.css'), 'utf8')
  check('the app token reached the stylesheet', css.includes('--color-tier-premium'))
  check('the base tokens survived the theme edit', css.includes('--color-muted-foreground') && css.includes('.dark'))
  const routes = fs.readdirSync(path.join(WORK, 'src/routes')).filter((f) => f.endsWith('.tsx'))
  check('three route files plus the root', routes.length === 4, routes.join(', '))
  const rootSrc = fs.readFileSync(path.join(WORK, 'src/routes/__root.tsx'), 'utf8')
  check('the pipeline wrote the app shell', /createRootRouteWithContext/.test(rootSrc))
  check('the shell kept <HeadContent />', /<HeadContent\s*\/>/.test(rootSrc))
  check('the shell kept <Outlet />', /<Outlet\s*\/>/.test(rootSrc))
  check('site-wide meta names the business, not a placeholder', /Lumière/.test(rootSrc) && !/Lovable App|Generated Project/.test(rootSrc))
  check('the font token declared in CSS is actually loaded in the shell', css.includes('--font-display') ? /fonts\.googleapis\.com/.test(rootSrc) : true)
}

console.log('\nthe built app runs')
{
  const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs')
  const { createServer } = await import('node:http')
  const ROOT = path.join(WORK, 'dist')
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }
  const server = createServer((q, r) => {
    let p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]))
    if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(ROOT, 'index.html')
    r.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' })
    r.end(fs.readFileSync(p))
  }).listen(4630)

  const browser = await chromium.launch()
  const pg = await browser.newPage()
  const errors = []
  pg.on('pageerror', (e) => errors.push(String(e).split('\n')[0]))

  // The shell loads webfonts from Google. This sandbox has no route to them, so the request hangs
  // and delays first paint. Fulfil it locally: the assertion that matters is that the <link> is in
  // the document, not that the network can reach it.
  let fontRequests = 0
  await pg.route('**://fonts.googleapis.com/**', (route) => { fontRequests++; route.fulfill({ status: 200, contentType: 'text/css', body: '' }) })
  await pg.route('**://fonts.gstatic.com/**', (route) => route.fulfill({ status: 200, body: '' }))

  await pg.goto('http://localhost:4630/#/', { waitUntil: 'networkidle' }); await pg.waitForTimeout(700)
  check('the home route renders', (await pg.locator('[data-page="/"]').count()) === 1)
  check('the page title came from the head block', (await pg.title()).includes('Lumière'), await pg.title())

  await pg.goto('http://localhost:4630/#/book', { waitUntil: 'networkidle' }); await pg.waitForTimeout(600)
  check('a generated route renders', (await pg.locator('[data-page="/book"]').count()) === 1)
  check('its own head/meta applied', (await pg.title()).includes('Choose seats'), await pg.title())

  const bg = await pg.evaluate(() => getComputedStyle(document.body).backgroundColor)
  check('theme tokens are live on the page', bg && bg !== 'rgba(0, 0, 0, 0)', bg)
  check('the shell renders around every page', (await pg.locator('[data-shell="header"]').count()) === 1)
  const fontLink = await pg.locator('link[href*="fonts.googleapis.com"]').count()
  check('the webfont link reached the document head', fontLink > 0, `${fontLink} link(s)`)
  check('the browser actually requested the font', fontRequests > 0, `${fontRequests} request(s)`)
  await pg.getByRole('link', { name: 'My tickets' }).click(); await pg.waitForTimeout(500)
  check('shell nav navigates between generated pages', (await pg.locator('[data-page="/my-tickets"]').count()) === 1)
  check('no runtime errors', errors.length === 0, errors[0] || '')

  await browser.close(); server.close()
}

fs.rmSync(WORK, { recursive: true, force: true })
console.log(failures ? `\n${failures} FAILED\n` : '\nend to end: the clone pipeline produces an app that builds and runs\n')
process.exit(failures ? 1 : 0)
