// Build service for the Lovable-clone stack (runs inside builder/lovable/Dockerfile).
//
// Same contract as builder/build-server.mjs so the Worker can talk to either:
//   POST /build   { "files": { "<relpath>": "<utf8 source>", … } }
//     → 200 { ok: true,  files: { "index.html": {t}, "assets/x.js": {t}, … }, typecheck: {…} }
//     → 200 { ok: false, error: "<build output, trimmed>" }
//   GET  /health  → 200 "ok"
//
// Three differences from the original service, all forced by the stack:
//   · `tsr generate` must run before vite, because routeTree.gen.ts is derived from src/routes/**
//     and does not exist in a clean checkout. Skipping it fails with "Could not resolve
//     ./routeTree.gen", which reads like a broken generation rather than a missing build step.
//   · Tailwind v4 is CSS-first: there is no tailwind.config.js or postcss.config.js to write.
//   · The config is vite.config.ts, not .js.
//
// And one addition neither service had: a RUNTIME SMOKE CHECK. esbuild does not resolve names, so
// a page referencing an undefined variable compiles cleanly and then white-screens in the browser.
// Lovable's answer is to catch it in production — their lib/lovable-error-reporting.ts hooks
// onerror, unhandledrejection and React error boundaries and phones home. Catching it at build time
// is strictly better: every route is loaded headlessly and a throw fails the build, which puts the
// error in front of the repair loop instead of in front of a customer.

import http from 'node:http'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const APP = process.env.APP_DIR || '/app'
const SRC = path.join(APP, 'src')
const DIST = path.join(APP, 'dist')
const TEMPLATE_SRC = path.join(APP, '.template-src')
const MAX_BODY = 12 * 1024 * 1024
const BUILD_TIMEOUT = 120_000
const TSR_TIMEOUT = 30_000
const TSC_TIMEOUT = 45_000

const send = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)) }

// Writes are confined to an allowlist under APP: never escape the directory, never touch
// node_modules or package.json. routeTree.gen.ts is excluded deliberately — it is generated, and
// letting a model overwrite it would silently override the real route table.
export function safeRel(rel) {
  const p = path.normalize(String(rel || '')).replace(/^(\.\.(\/|\\|$))+/, '')
  if (!p || p.startsWith('/') || p.includes('..')) return null
  if (p === 'package.json' || p.startsWith('node_modules')) return null
  if (p === 'src/routeTree.gen.ts') return null
  if (!/^(index\.html|vite\.config\.ts|isibi\.schema\.json|src\/.+)$/.test(p)) return null
  return p
}

// src/ is wiped between builds so one site's pages cannot leak into the next — but the shipped
// template lives there too (components/ui, lib, integrations, main.tsx, styles.css). The image
// bakes a pristine copy at /app/.template-src and it is restored here. Without this, generated
// pages import a component library that no longer exists and every build fails.
function wipeSrc() {
  try { fs.rmSync(SRC, { recursive: true, force: true }) } catch {}
  try {
    if (fs.existsSync(TEMPLATE_SRC)) { fs.cpSync(TEMPLATE_SRC, SRC, { recursive: true }); return }
  } catch {}
  fs.mkdirSync(SRC, { recursive: true })
}
function wipeDist() { try { fs.rmSync(DIST, { recursive: true, force: true }) } catch {} }

function run(cmd, args, timeout) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: APP, env: { ...process.env, NODE_ENV: 'production' } })
    let out = ''
    child.stdout.on('data', (d) => { out += d })
    child.stderr.on('data', (d) => { out += d })
    const to = setTimeout(() => { try { child.kill('SIGKILL') } catch {} resolve({ code: -1, out: `${cmd} timed out after ${timeout}ms` }) }, timeout)
    child.on('close', (code) => { clearTimeout(to); resolve({ code, out: out.trim() }) })
    child.on('error', (e) => { clearTimeout(to); resolve({ code: -1, out: String(e?.message || e) }) })
  })
}

// Advisory only, exactly as in the original service: vite strips types without checking them, so
// tsc is the only thing enforcing the contracts — but a customer getting nothing because of a type
// error is worse than a shipped app with one. Findings are returned for the repair loop.
async function typecheck() {
  if (!fs.existsSync(path.join(APP, 'tsconfig.json'))) return { ran: false, errors: [] }
  const { out } = await run('npx', ['tsc', '--noEmit', '--pretty', 'false'], TSC_TIMEOUT)
  return { ran: true, errors: out.split('\n').filter((l) => /error TS\d+/.test(l)).slice(0, 40) }
}

export function collectDist(dir = DIST, base = '') {
  const out = {}
  if (!fs.existsSync(dir)) return out
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const rel = base ? `${base}/${name}` : name
    if (fs.statSync(full).isDirectory()) Object.assign(out, collectDist(full, rel))
    else {
      const buf = fs.readFileSync(full)
      out[rel] = /\.(html|css|js|mjs|svg|json|map|txt|xml|webmanifest)$/i.test(name)
        ? { t: buf.toString('utf8') }
        : { b: buf.toString('base64') }
    }
  }
  return out
}

// Serve a dist directory and load every route, collecting anything the page throws.
// Best-effort by design: if Chromium is unavailable the check is skipped and the build still
// succeeds. A missing checker must never cost a customer their app.
async function smokeTest(routeUrls) {
  let chromium
  try { ({ chromium } = await import('playwright')) } catch { return { ran: false, reason: 'playwright not installed' } }

  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' }
  const server = http.createServer((q, r) => {
    let p = path.join(DIST, decodeURIComponent(q.url.split('?')[0]))
    if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(DIST, 'index.html')
    r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' })
    r.end(fs.readFileSync(p))
  })
  await new Promise((r) => server.listen(0, r))
  const port = server.address().port

  // In the container the bundled browser matches the playwright version and the plain launch works.
  // Elsewhere (CI, a dev box, this sandbox) the installed browser can belong to a different
  // playwright build, so fall back to whatever chrome binary is actually on disk before giving up.
  let browser
  const launchErrors = []
  for (const opts of [{}, ...discoverChrome().map((executablePath) => ({ executablePath }))]) {
    try { browser = await chromium.launch(opts); break } catch (e) { launchErrors.push(String(e?.message || e).split('\n')[0]) }
  }
  if (!browser) {
    server.close()
    return { ran: false, reason: `chromium failed to launch: ${launchErrors[0]?.slice(0, 140)}` }
  }

  const errors = []
  try {
    const page = await browser.newPage()
    const at = () => page.url().split('#')[1] || '/'
    page.on('pageerror', (e) => errors.push(`${at()}: ${String(e).split('\n')[0]}`))

    // React 19 does NOT rethrow a render error to window.onerror — it logs it. So a page whose
    // component references an undefined variable produces no pageerror at all, and the app shell
    // still renders around the hole, which means "did anything mount" misses it too. The only
    // reliable signal is a console error carrying a real exception name.
    page.on('console', (m) => {
      if (m.type() !== 'error') return
      const text = m.text().split('\n')[0]
      if (!/^(?:Uncaught\s+)?(?:[A-Z]\w*)?Error: /.test(text)) return
      // The smoke test runs with no backend reachable, so a data-driven page will always fail its
      // requests. Those are expected here and must not fail an otherwise sound build.
      if (/Failed to fetch|NetworkError|ERR_|net::|fetch failed|Load failed/i.test(text)) return
      errors.push(`${at()}: ${text.slice(0, 200)}`)
    })
    // Webfonts and other third-party hosts are not reachable from a build sandbox; a hanging
    // request would look like a broken app. Fulfil them locally so only real faults surface.
    await page.route('**://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }))
    await page.route('**://fonts.gstatic.com/**', (r) => r.fulfill({ status: 200, body: '' }))
    for (const url of routeUrls) {
      await page.goto(`http://127.0.0.1:${port}/#${url}`, { waitUntil: 'load', timeout: 15000 }).catch(() => {})
      await page.waitForTimeout(400)
      const empty = await page.evaluate(() => (document.getElementById('root')?.textContent || '').trim().length === 0).catch(() => false)
      if (empty) errors.push(`${url}: rendered nothing — the page mounted empty`)
    }
    await page.close()
  } finally {
    await browser.close().catch(() => {})
    server.close()
  }
  return { ran: true, errors: [...new Set(errors)].slice(0, 20) }
}

/** Chrome binaries on disk, newest build first. Used when the bundled browser does not match. */
function discoverChrome() {
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers', '/ms-playwright'].filter(Boolean)
  const found = []
  for (const root of roots) {
    if (!fs.existsSync(root)) continue
    for (const dir of fs.readdirSync(root).filter((d) => d.startsWith('chromium')).sort().reverse()) {
      for (const rel of ['chrome-linux/chrome', 'chrome-linux/headless_shell']) {
        const full = path.join(root, dir, rel)
        if (fs.existsSync(full)) found.push(full)
      }
    }
  }
  return found
}

/** Route file paths → the hash URLs the built SPA serves. */
export function routeUrlsFrom(dir = path.join(APP, 'src/routes')) {
  if (!fs.existsSync(dir)) return ['/']
  const urls = []
  const walk = (d, prefix = '') => {
    for (const name of fs.readdirSync(d)) {
      const full = path.join(d, name)
      if (fs.statSync(full).isDirectory()) { walk(full, `${prefix}/${name}`); continue }
      if (!name.endsWith('.tsx') || name.startsWith('__')) continue
      const base = name.replace(/\.tsx$/, '')
      if (base.startsWith('_') || base.includes('$')) continue // layout and dynamic routes need params
      urls.push(base === 'index' ? (prefix || '/') : `${prefix}/${base}`)
    }
  }
  walk(dir)
  return urls.length ? [...new Set(urls)] : ['/']
}

export async function buildFiles(files, opts = {}) {
  wipeSrc(); wipeDist()

  const written = [], rejected = []
  for (const [rel, src] of Object.entries(files || {})) {
    const safe = safeRel(rel)
    if (!safe) { rejected.push(rel); continue }
    const full = path.join(APP, safe)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, String(src))
    written.push(safe)
  }

  // The route tree is derived from src/routes/**, so it has to be regenerated after the pages land
  // and before vite resolves ./routeTree.gen from main.tsx.
  const gen = await run('npx', ['tsr', 'generate'], TSR_TIMEOUT)
  if (gen.code !== 0) return { ok: false, error: `route generation failed:\n${gen.out}`.slice(0, 6000), written, rejected }

  const built = await run('npx', ['vite', 'build', '--logLevel', 'warn'], BUILD_TIMEOUT)
  if (built.code !== 0) return { ok: false, error: built.out.slice(0, 6000), written, rejected }

  // Compiles is not runs. This is the check that separates the two.
  const smoke = opts.smoke === false ? { ran: false, reason: 'disabled by caller' } : await smokeTest(routeUrlsFrom())
  if (smoke.ran && smoke.errors.length) {
    return { ok: false, error: `the app builds but crashes at runtime:\n${smoke.errors.join('\n')}`, written, rejected, smoke }
  }

  return { ok: true, files: collectDist(), typecheck: await typecheck(), smoke, written, rejected }
}

// ── server ────────────────────────────────────────────────────────────────────
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = []
    req.on('data', (c) => { n += c.length; if (n > limit) { reject(new Error('body too large')); req.destroy(); return } chunks.push(c) })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

if (process.env.NODE_ENV !== 'test' && !process.env.NO_SERVER) {
  http.createServer(async (req, res) => {
    if (req.url === '/health') { res.writeHead(200); return res.end('ok') }
    if (req.method !== 'POST' || req.url !== '/build') return send(res, 404, { ok: false, error: 'not found' })
    try {
      const body = JSON.parse(await readBody(req, MAX_BODY))
      send(res, 200, await buildFiles(body.files))
    } catch (e) {
      send(res, 200, { ok: false, error: String(e?.message || e) })
    }
  }).listen(8080, () => console.log('clone build service on :8080'))
}
