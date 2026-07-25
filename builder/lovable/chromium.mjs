// chromium.mjs — find playwright, wherever it happens to be installed.
//
// Three places in this directory need a browser and each got it wrong differently: build-server.mjs
// used a bare `import('playwright')`, which resolves upward from builder/lovable/ and so never
// reached the package installed under template/; integration.test.mjs hard-coded
// /opt/node22/lib/node_modules/playwright/index.mjs, which exists in this sandbox and nowhere else,
// so it died the moment CI got far enough to run it. Both failures reported as something other than
// "the browser could not be found", which is why each survived several runs.
//
// One resolver, used by both.

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

/**
 * The chromium launcher, or null. `roots` are directories to resolve the package FROM, tried in
 * order — pass the app directory first when the install lives there.
 */
export async function loadChromium(roots = []) {
  const candidates = [...roots, here, path.join(here, 'template')]
    .filter((r, i, a) => r && a.indexOf(r) === i)
  for (const root of candidates) {
    let entry
    try { entry = createRequire(path.join(root, 'package.json')).resolve('playwright') } catch { continue }
    // The resolved entry is CommonJS and named-export detection is not guaranteed for it, so read
    // through .default as well rather than trusting one shape.
    try {
      const mod = await import(pathToFileURL(entry).href)
      const chromium = mod.chromium || mod.default?.chromium
      if (chromium) return chromium
    } catch { /* try the next root */ }
  }
  try { const mod = await import('playwright'); return mod.chromium || mod.default?.chromium || null } catch { return null }
}

/**
 * Chrome binaries on disk, newest build first. Used when the installed browser belongs to a
 * different playwright build than the package — common on a dev box and in this sandbox.
 */
export function discoverChrome() {
  // A GitHub runner installs to ~/.cache/ms-playwright, which the first live run missed entirely —
  // the smoke check reported "skipped" on a run that had a browser sitting right there.
  const home = process.env.HOME || ''
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    '/opt/pw-browsers',
    '/ms-playwright',
    home && path.join(home, '.cache/ms-playwright'),
  ].filter(Boolean)
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

/** Launch, falling back to any chrome on disk when the bundled browser does not match. */
export async function launchChromium(roots = []) {
  const chromium = await loadChromium(roots)
  if (!chromium) return { browser: null, reason: `playwright not resolvable from ${[...roots, here].join(', ')}` }
  const errors = []
  for (const opts of [{}, ...discoverChrome().map((executablePath) => ({ executablePath }))]) {
    try { return { browser: await chromium.launch(opts) } } catch (e) { errors.push(String(e?.message || e).split('\n')[0]) }
  }
  return { browser: null, reason: `chromium failed to launch: ${errors[0]?.slice(0, 140)}` }
}
