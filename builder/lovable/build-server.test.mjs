// build-server.test.mjs — exercises the clone build service against a real APP_DIR and a real
// vite build, without needing a container runtime.
//
// It reproduces what the Dockerfile sets up: the template at APP_DIR, a pristine copy at
// .template-src, and node_modules present. Everything the service does then runs for real —
// the write allowlist, the src wipe-and-restore, `tsr generate`, `vite build`, dist collection
// and the advisory typecheck.
//
// NOT covered: the container image itself. There is no Docker daemon in this sandbox, so the
// Dockerfile is unverified — see the note printed at the end.
//
// Run: node builder/lovable/build-server.test.mjs

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATE = path.join(here, 'template')
const APP = fs.mkdtempSync(path.join(os.tmpdir(), 'clone-svc-'))

// Must be set before the module loads, since APP_DIR is read at import time.
process.env.APP_DIR = APP
process.env.NO_SERVER = '1'
const { buildFiles, safeRel, collectDist } = await import('./build-server.mjs')

let failures = 0
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

// ── stand up what the Dockerfile produces ─────────────────────────────────────
console.log(`\nAPP_DIR: ${APP}`)
fs.cpSync(TEMPLATE, APP, { recursive: true, filter: (s) => !s.includes('node_modules') && !s.includes('/dist') })
fs.symlinkSync(path.join(TEMPLATE, 'node_modules'), path.join(APP, 'node_modules'))
fs.cpSync(path.join(APP, 'src'), path.join(APP, '.template-src'), { recursive: true })
fs.cpSync(path.join(APP, 'public'), path.join(APP, '.template-public'), { recursive: true })

console.log('\nwrite allowlist')
{
  check('accepts a generated page', safeRel('src/routes/book.tsx') === 'src/routes/book.tsx')
  check('accepts the stylesheet', safeRel('src/styles.css') === 'src/styles.css')
  check('accepts the schema', safeRel('isibi.schema.json') === 'isibi.schema.json')
  check('accepts index.html', safeRel('index.html') === 'index.html')
  check('rejects package.json', safeRel('package.json') === null)
  check('rejects node_modules', safeRel('node_modules/evil.js') === null)
  check('rejects a path escape', safeRel('../../etc/passwd') === null)
  check('rejects an absolute path', safeRel('/etc/passwd') === null)
  // The route tree is derived; letting a model write it would override the real route table.
  check('rejects the generated route tree', safeRel('src/routeTree.gen.ts') === null)
  check('rejects an unknown top-level file', safeRel('Dockerfile') === null)
}

const pageSrc = (route, title) => `import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('${route}')({
  head: () => ({ meta: [{ title: '${title}' }] }),
  component: Page,
})

function Page() {
  return <div className="bg-background text-foreground" data-page="${route}">${title}</div>
}
`

console.log('\na real build')
const res = await buildFiles({
  'src/routes/index.tsx': pageSrc('/', 'Home'),
  'src/routes/book.tsx': pageSrc('/book', 'Book'),
  'isibi.schema.json': '{"tables":[]}',
  'package.json': '{"evil":true}',        // must be rejected, not written
  '../escape.txt': 'nope',                 // must be rejected
})
{
  check('build succeeded', res.ok === true, res.error ? res.error.split('\n')[0] : '')
  check('generated pages were written', res.written.includes('src/routes/book.tsx'))
  check('the schema was written', res.written.includes('isibi.schema.json'))
  check('package.json was rejected', res.rejected.includes('package.json'))
  check('the path escape was rejected', res.rejected.includes('../escape.txt'))
  check('package.json on disk is untouched', JSON.parse(fs.readFileSync(path.join(APP, 'package.json'), 'utf8')).evil === undefined)
}

console.log('\nthe route tree is generated, not assumed')
{
  check('routeTree.gen.ts exists after the build', fs.existsSync(path.join(APP, 'src/routeTree.gen.ts')))
  const tree = fs.readFileSync(path.join(APP, 'src/routeTree.gen.ts'), 'utf8')
  check('it picked up the generated route', /book/.test(tree))
}

console.log('\ndist')
{
  const names = Object.keys(res.files)
  check('index.html returned', names.includes('index.html'))
  check('a js bundle returned', names.some((n) => /assets\/.*\.js$/.test(n)))
  check('a css bundle returned', names.some((n) => /assets\/.*\.css$/.test(n)))
  check('text assets come back as text', typeof res.files['index.html']?.t === 'string')
  const css = Object.entries(res.files).find(([n]) => n.endsWith('.css'))?.[1]?.t || ''
  check('the theme tokens made it into the CSS', /--color-background|--background/.test(css))
}

console.log('\nthe template survives a build (the wipe restores it)')
{
  check('the component library is still there', fs.readdirSync(path.join(APP, 'src/components/ui')).length === 46)
  check('the data client is still there', fs.existsSync(path.join(APP, 'src/integrations/db/client.ts')))
  check('main.tsx is still there', fs.existsSync(path.join(APP, 'src/main.tsx')))
}

console.log('\na second build does not inherit the first')
{
  const r2 = await buildFiles({ 'src/routes/index.tsx': pageSrc('/', 'Only') })
  check('second build succeeded', r2.ok === true, r2.error ? r2.error.split('\n')[0] : '')
  check("the first build's page is gone", !fs.existsSync(path.join(APP, 'src/routes/book.tsx')))
  check('the component library survived again', fs.readdirSync(path.join(APP, 'src/components/ui')).length === 46)
}

// public/ became writeable when the sitemap stage landed, and Vite copies it into dist verbatim.
// So without a wipe, site A's sitemap.xml is PUBLISHED under site B's domain — a crawler is handed
// another customer's URLs. src/ was already wiped; this is the same fault in the directory nobody
// thought to protect because until now nothing could write there.
console.log('\none site\'s public/ does not reach the next')
{
  const siteA = await buildFiles({
    'src/routes/index.tsx': pageSrc('/', 'A'),
    'public/sitemap.xml': '<?xml version="1.0"?><urlset><url><loc>https://site-a.test/</loc></url></urlset>',
  })
  check('site A built with its sitemap', siteA.ok === true, siteA.error?.split('\n')[0] || '')
  check('and it was published', Boolean(siteA.files['sitemap.xml']), Object.keys(siteA.files).join(' ').slice(0, 80))

  const siteB = await buildFiles({ 'src/routes/index.tsx': pageSrc('/', 'B') })
  check('site B built', siteB.ok === true, siteB.error?.split('\n')[0] || '')
  check("site A's sitemap did NOT leak into site B", !siteB.files['sitemap.xml'])
  check('but the template\'s own public files survived', Boolean(siteB.files['robots.txt'] && siteB.files['favicon.svg']))
}

console.log('\nfailure paths')
{
  const badRoute = await buildFiles({ 'src/routes/index.tsx': 'export const Route = ' }, { smoke: false })
  check('a syntax error returns ok:false', badRoute.ok === false)
  check('the compiler output is returned for the repair loop', /error|expected/i.test(badRoute.error || ''), (badRoute.error || '').split('\n')[0]?.slice(0, 70))
  check('it does not throw', true)
}

console.log('\nruntime smoke check — compiles is not runs')
{
  // esbuild does not resolve names, so an undefined variable compiles cleanly and then throws in
  // the browser. Without the smoke check this ships as a white screen with ok:true.
  const src = "import { createFileRoute } from '@tanstack/react-router'\nexport const Route = createFileRoute('/')({ component: () => <div>{oops}</div> })\n"

  const noSmoke = await buildFiles({ 'src/routes/index.tsx': src }, { smoke: false })
  check('WITHOUT the smoke check it compiles clean', noSmoke.ok === true, 'this is the bug the check exists for')

  const withSmoke = await buildFiles({ 'src/routes/index.tsx': src })
  if (withSmoke.smoke?.ran === false) {
    console.log(`  – smoke check unavailable (${withSmoke.smoke.reason}); skipping`)
  } else {
    check('WITH it the build fails', withSmoke.ok === false)
    check('and names the runtime error for the repair loop', /oops|is not defined/.test(withSmoke.error || ''), (withSmoke.error || '').split('\n')[1]?.slice(0, 80))
  }

  const good = await buildFiles({ 'src/routes/index.tsx': pageSrc('/', 'Fine'), 'src/routes/book.tsx': pageSrc('/book', 'Book') })
  check('a working app still passes the smoke check', good.ok === true, good.error?.split('\n')[0] || '')
  if (good.smoke?.ran) check('every route was visited', good.smoke.errors.length === 0)
}

console.log('\nadvisory typecheck')
{
  const r = await buildFiles({ 'src/routes/index.tsx': pageSrc('/', 'Home') }, { smoke: false })
  check('typecheck ran', r.typecheck?.ran === true)
  check('a clean app reports no type errors', (r.typecheck?.errors || []).length === 0, (r.typecheck?.errors || [])[0] || '')

  // A type error must NOT fail the build — shipping an app with a type error beats shipping nothing.
  const typed = await buildFiles({
    'src/routes/index.tsx': "import { createFileRoute } from '@tanstack/react-router'\nconst n: number = 'not a number'\nexport const Route = createFileRoute('/')({ component: () => <div>{n}</div> })\n",
  }, { smoke: false })
  check('a type error still builds', typed.ok === true, typed.error ? typed.error.split('\n')[0] : '')
  check('but is reported for the repair loop', (typed.typecheck?.errors || []).length > 0, (typed.typecheck?.errors || [])[0]?.slice(0, 90) || 'none reported')
}

fs.rmSync(APP, { recursive: true, force: true })
console.log('\nNOTE: the Dockerfile itself is unverified — no Docker daemon in this sandbox.')
console.log(failures ? `\n${failures} FAILED\n` : '\nbuild service: all checks pass\n')
process.exit(failures ? 1 : 0)
