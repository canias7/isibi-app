// pipeline.test.mjs — drives the clone pipeline with a stub model, so the ORDER and the WIRING are
// verified without an API key. The order is the entire point of phase 3: the schema must be decided
// before a single page is written, and each page must be handed that schema.
//
// Run: node builder/lovable/pipeline.test.mjs

import { runClonePipeline, parseFiles, routePath, routeUrl, traceSummary } from './pipeline.mjs'

let failures = 0
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

// A stub model. Records every call in order and answers each stage plausibly, so the pipeline's
// control flow is exercised for real while nothing is spent.
function stubModel({ failFirstBuild = false } = {}) {
  const calls = []
  const generate = async (system, user, maxTokens) => {
    calls.push({ system, user, maxTokens })
    const n = calls.length
    let text = ''
    if (/Ask AT MOST three short questions/.test(system)) {
      text = 'Who signs in?\nDo you take payment?'
    } else if (/Plan the app before building it/.test(system)) {
      text = JSON.stringify({
        name: 'Lumière Theatre',
        pages: [{ id: 'index', title: 'Home' }, { id: 'book', title: 'Choose seats' }, { id: 'my-tickets', title: 'My tickets' }],
        tables: ['seats', 'bookings'],
      })
    } else if (/Design the database FIRST/.test(system)) {
      text = '===FILE: isibi.schema.json===\n{"tables":[{"name":"bookings","access":"user","columns":[{"name":"seat_id","type":"text","required":true}]}]}'
    } else if (/ONE JSON object/.test(system)) {
      text = '{"fonts":{"--font-display":"\'Fraunces\', serif"},"colors":{"tier-premium":{"light":"oklch(0.86 0.09 60)","dark":"oklch(0.7 0.09 60)"}}}'
    } else if (/THE APP SHELL/.test(system)) {
      text = "===FILE: src/routes/__root.tsx===\nimport { HeadContent, Outlet } from '@tanstack/react-router'\n"
    } else if (/The build failed/.test(system)) {
      text = '===FILE: src/routes/book.tsx===\nexport const Route = "repaired"\n'
    } else {
      const m = user.match(/===FILE: (src\/routes\/[^=]+)===/)
      const path = m ? m[1].trim() : 'src/routes/unknown.tsx'
      text = `===FILE: ${path}===\nexport const Route = createFileRoute('${routeUrl(path)}')({})\n`
    }
    return { text, usedOut: Math.min(maxTokens, 200) }
  }
  let built = 0
  const build = async () => {
    built++
    return failFirstBuild && built === 1 ? { ok: false, error: 'TS2304: Cannot find name Foo\n  at book.tsx:3' } : { ok: true }
  }
  return { generate, build, calls, builtCount: () => built }
}

console.log('\nparse + path helpers')
{
  const f = parseFiles('===FILE: src/routes/a.tsx===\nconst a = 1\n\n===FILE: isibi.schema.json===\n{}')
  check('parses multiple file blocks', Object.keys(f).length === 2, Object.keys(f).join(', '))
  check('strips a leading slash', Object.keys(parseFiles('===FILE: /x.ts===\nq'))[0] === 'x.ts')
  check('routePath maps index', routePath('index') === 'src/routes/index.tsx')
  check('routePath maps a slug', routePath('my-bookings') === 'src/routes/my-bookings.tsx')
  check('routePath tolerates a .tsx suffix', routePath('book.tsx') === 'src/routes/book.tsx')
  check('routeUrl maps index to /', routeUrl('index') === '/')
  check('routeUrl maps a slug', routeUrl('my-bookings') === '/my-bookings')
}

console.log('\nstage order — the point of phase 3')
const m = stubModel()
const BASE_CSS = '@theme {\n}\n\n@theme inline {\n  --color-background: var(--background);\n}\n\n:root {\n  --background: oklch(1 0 0);\n}\n\n.dark {\n  --background: oklch(0.129 0.042 264.695);\n}\n'
const res = await runClonePipeline('A theatre seat booking site for the Lumière.', 40000, m, { baseCss: BASE_CSS })
const order = res.trace.map((r) => r.stage)
{
  check('run succeeded', res.ok === true)
  const iSchema = order.indexOf('schema')
  const iFirstPage = order.findIndex((s) => s.startsWith('page:'))
  check('schema stage ran', iSchema >= 0)
  check('SCHEMA COMES BEFORE THE FIRST PAGE', iSchema >= 0 && iFirstPage > iSchema, `schema at ${iSchema}, first page at ${iFirstPage}`)
  check('clarify ran first', order[0] === 'clarify')
  check('plan ran before schema', order.indexOf('plan') < iSchema)
  check('theme ran before the first page', order.indexOf('theme') < iFirstPage)
  const iShell = order.indexOf('shell')
  check('shell stage ran', iShell >= 0)
  check('shell ran after theme (so it can see the font tokens)', iShell > order.indexOf('theme'))
  check('SHELL RUNS BEFORE THE PAGES THAT RENDER INSIDE IT', iShell < iFirstPage, `shell at ${iShell}, first page at ${iFirstPage}`)
  check('build ran last', order[order.length - 1] === 'build')
}

console.log('\nthe schema actually reaches every page prompt')
{
  const pagePrompts = m.calls.filter((c) => /Build the page at/.test(c.user))
  check('one model call per planned page', pagePrompts.length === 3, `${pagePrompts.length} calls`)
  check('every page prompt carries the schema', pagePrompts.every((c) => c.user.includes('isibi.schema.json') || c.user.includes('"tables"')))
  check('every page prompt forbids inventing field names', pagePrompts.every((c) => /do not invent field names/i.test(c.user)))
}

console.log('\nfiles land where the plan said')
{
  const paths = Object.keys(res.files).sort()
  check('schema written', paths.includes('isibi.schema.json'))
  check('app shell written', paths.includes('src/routes/__root.tsx'))
  check('stylesheet written', paths.includes('src/styles.css'))
  check('the app tokens were merged into the base, not re-emitted by the model',
    /--color-tier-premium: var\(--tier-premium\)/.test(res.files['src/styles.css'] || ''))
  check('both light and dark values landed',
    /:root \{\n  --tier-premium/.test(res.files['src/styles.css'] || '') && /\.dark \{\n  --tier-premium/.test(res.files['src/styles.css'] || ''))
  check('a route file per page', ['index', 'book', 'my-tickets'].every((p) => paths.includes(`src/routes/${p}.tsx`)), paths.join(', '))
  const shellPrompt = m.calls.find((c) => /THE APP SHELL/.test(c.system))
  check('the shell prompt lists every page so it can build the nav', ['/', '/book', '/my-tickets'].every((u) => shellPrompt?.user.includes(u)))
  check('the shell prompt carries the merged stylesheet so fonts can be matched', /--font-display/.test(shellPrompt?.user || ''))
  check('nothing written outside src/ or the schema', paths.every((p) => p.startsWith('src/') || p === 'isibi.schema.json'))
}

console.log('\nledger')
{
  check('spend is recorded', res.spent > 0, `${res.spent} tokens`)
  check('spend stays under the cap', res.spent <= res.cap, `${res.spent} / ${res.cap}`)
  const tiny = await runClonePipeline('x', 900, stubModel())
  const skipped = tiny.trace.filter((r) => r.skipped === 'budget exhausted').length
  check('a tiny cap skips stages rather than overspending', skipped > 0 && tiny.spent <= 900, `${skipped} skipped, spent ${tiny.spent}`)
}

console.log('\nrepair loop')
{
  const mf = stubModel({ failFirstBuild: true })
  const r = await runClonePipeline('A theatre seat booking site.', 40000, mf)
  const stages = r.trace.map((s) => s.stage)
  check('a failed build triggers a repair', stages.some((s) => s.startsWith('repair:')))
  check('it rebuilds after repairing', mf.builtCount() === 2, `${mf.builtCount()} builds`)
  check('the run ends ok once the build passes', r.ok === true)
  const repairCall = mf.calls.find((c) => /The build failed/.test(c.system))
  check('the repair prompt carries the compiler error', /TS2304/.test(repairCall?.user || ''))
}

console.log('\ndegrades sensibly')
{
  const noDb = {
    ...stubModel(),
    generate: async (system, user, maxTokens) => {
      if (/Plan the app/.test(system)) return { text: JSON.stringify({ pages: [{ id: 'index', title: 'Home' }], tables: [] }), usedOut: 50 }
      if (/Ask AT MOST/.test(system)) return { text: '', usedOut: 10 }
      return { text: `===FILE: src/routes/index.tsx===\nconst a = 1\n`, usedOut: 50 }
    },
  }
  const r = await runClonePipeline('A one-page brochure site.', 40000, noDb)
  const schemaStage = r.trace.find((s) => s.stage === 'schema')
  check('a site with no tables skips the schema stage', schemaStage?.skipped === 'the plan declares no tables')
  check('and still produces its page', Object.keys(r.files).includes('src/routes/index.tsx'))
  check('and reports no schema', r.schema === null)
}

console.log('\n── trace of the primary run ──')
console.log(traceSummary(res))


// ── the iterate loop (their step 7) ───────────────────────────────────────────
console.log('\niterate loop — a follow-up edits named files, it does not rebuild')
{
  const { reviseApp } = await import('./pipeline.mjs')

  const app = {
    'isibi.schema.json': '{"tables":[{"name":"bookings"}]}',
    'src/styles.css': '@theme {}',
    'src/routes/index.tsx': 'export const Route = 1',
    'src/routes/book.tsx': 'export const Route = 2',
    'src/routes/__root.tsx': 'export const Route = 3',
    'src/components/ui/button.tsx': 'export const Button = 4',   // library — must be off limits
    'src/routeTree.gen.ts': 'generated',                          // derived — must be off limits
  }

  const calls = []
  const mk = ({ pick, edit, failFirstBuild = false } = {}) => {
    let built = 0
    return {
      calls,
      builtCount: () => built,
      generate: async (system, user, maxTokens) => {
        calls.push({ system, user })
        if (/smallest set of files/.test(system)) return { text: pick ?? '{"files":["src/routes/book.tsx"]}', usedOut: 50 }
        if (/The build failed after your edit/.test(system)) return { text: '===FILE: src/routes/book.tsx===\nexport const Route = 99\n', usedOut: 80 }
        return { text: edit ?? '===FILE: src/routes/book.tsx===\nexport const Route = 22\n', usedOut: 120 }
      },
      build: async () => { built++; return failFirstBuild && built === 1 ? { ok: false, error: 'TS1005: expected' } : { ok: true } },
    }
  }

  const m1 = mk()
  const r1 = await reviseApp(app, 'Make the seats bigger.', 20000, m1)
  check('revision succeeded', r1.ok === true)
  check('it picked files before editing', r1.trace[0].stage === 'revise-pick')
  check('only the named file changed', JSON.stringify(r1.changed) === '["src/routes/book.tsx"]', JSON.stringify(r1.changed))
  check('the change landed', r1.files['src/routes/book.tsx'].includes('22'))
  check('every other file is byte-identical', Object.keys(app).filter((f) => f !== 'src/routes/book.tsx').every((f) => r1.files[f] === app[f]))
  const pickPrompt = m1.calls[0].user
  check('the pick step is shown the file list, not the source', !pickPrompt.includes('export const Route'))
  check('the pick step is not offered the component library', !pickPrompt.includes('components/ui/button'))
  check('nor the generated route tree', !pickPrompt.includes('routeTree.gen'))
  const editPrompt = m1.calls[1].user
  check('the edit step gets the full source of just that file', editPrompt.includes('export const Route = 2') && !editPrompt.includes('export const Route = 1'))
  check('and is shown the schema so it cannot contradict it', editPrompt.includes('"tables"'))

  // A model asking to rewrite the component library must be refused, not obeyed.
  const m2 = mk({ pick: '{"files":["src/components/ui/button.tsx","src/routes/book.tsx"]}' })
  const r2 = await reviseApp(app, 'Restyle everything.', 20000, m2)
  check('a pick outside the editable set is refused', !r2.changed.includes('src/components/ui/button.tsx'), JSON.stringify(r2.changed))
  check('and the refusal is recorded', r2.trace.some((s) => s.stage === 'revise-pick:refused'))
  check('the component library is untouched on disk', r2.files['src/components/ui/button.tsx'] === app['src/components/ui/button.tsx'])

  // Same for an edit step that returns a file it was never allowed to touch.
  const m3 = mk({ edit: '===FILE: src/routeTree.gen.ts===\nhacked\n\n===FILE: src/routes/book.tsx===\nexport const Route = 33\n' })
  const r3 = await reviseApp(app, 'Tweak it.', 20000, m3)
  check('an edit outside the editable set is discarded', r3.files['src/routeTree.gen.ts'] === 'generated')
  check('while the legitimate edit still applies', r3.files['src/routes/book.tsx'].includes('33'))

  const m4 = mk({ failFirstBuild: true })
  const r4 = await reviseApp(app, 'Break it then fix it.', 20000, m4)
  check('a failed build after a revision triggers a repair', r4.trace.some((s) => s.stage.startsWith('repair:')))
  check('and it rebuilds', m4.builtCount() === 2, `${m4.builtCount()} builds`)
  check('ending ok', r4.ok === true)

  const r5 = await reviseApp(app, 'x', 20000, mk({ pick: 'not json at all' }))
  check('an unparseable pick falls back rather than failing', r5.ok === true && r5.changed.length === 1)
  check('and the fallback is recorded', r5.trace.some((s) => s.stage === 'revise-pick:fallback'))
}

// ── a truncated theme is not a decision ───────────────────────────────────────
console.log('\ntruncated theme is reported as a failure, not a choice')
{
  const m = {
    generate: async (system, user, maxTokens) => {
      if (/Ask AT MOST/.test(system)) return { text: '', usedOut: 10 }
      if (/Plan the app/.test(system)) return { text: JSON.stringify({ pages: [{ id: 'index', title: 'Home' }], tables: [] }), usedOut: 50 }
      if (/ONE JSON object/.test(system)) return { text: 'Let me think about the palette for a theatre…', usedOut: maxTokens, truncated: true }
      if (/THE APP SHELL/.test(system)) return { text: "===FILE: src/routes/__root.tsx===\nshell\n", usedOut: 60 }
      return { text: '===FILE: src/routes/index.tsx===\npage\n', usedOut: 60 }
    },
    build: async () => ({ ok: true }),
  }
  const r = await runClonePipeline('A theatre.', 40000, m, { baseCss: BASE_CSS })
  const merged = r.trace.find((s) => s.stage === 'theme-merged')
  check('it does NOT claim the base was enough', merged?.skipped !== 'the base token set was enough', merged?.skipped || merged?.warn)
  check('it says the reply was cut off', /cut off/.test(merged?.warn || ''))
  check('and that the default palette was a fallback, not a choice', /not a choice/.test(merged?.warn || ''))
}

// ── truncation must never reach the build ─────────────────────────────────────
console.log('\ntruncated page: retried smaller, not handed to the build')
{
  // A live run truncated a page at 9000 tokens, emitted a syntactically broken file, and killed the
  // whole build at `tsr generate` — then burned two repair passes rewriting the same oversized page.
  let pageAttempts = 0
  const calls = []
  const m = {
    calls,
    generate: async (system, user, maxTokens) => {
      calls.push({ system, user })
      if (/Ask AT MOST/.test(system)) return { text: '', usedOut: 10 }
      if (/Plan the app/.test(system)) return { text: JSON.stringify({ pages: [{ id: 'index', title: 'Seats' }], tables: [] }), usedOut: 50 }
      if (/ONE JSON object/.test(system)) return { text: '{}', usedOut: 20 }
      if (/THE APP SHELL/.test(system)) return { text: "===FILE: src/routes/__root.tsx===\nshell\n", usedOut: 60 }
      pageAttempts++
      // First attempt truncates mid-file; the retry finishes.
      return pageAttempts === 1
        ? { text: '===FILE: src/routes/index.tsx===\nconst broken = (', usedOut: maxTokens, truncated: true }
        : { text: '===FILE: src/routes/index.tsx===\nconst whole = 1\n', usedOut: 200 }
    },
    build: async () => ({ ok: true }),
  }
  const r = await runClonePipeline('A seat picker.', 60000, m)
  const stages = r.trace.map((s) => s.stage)
  check('the truncation is reported', stages.includes('page:index:truncated'))
  check('and the page is retried', stages.includes('page:index:retry'), stages.join(' '))
  check('the BROKEN partial never survives', !r.files['src/routes/index.tsx'].includes('const broken'))
  check('the complete retry is what ships', r.files['src/routes/index.tsx'].includes('const whole'))
  const retryPrompt = calls.find((c) => /PREVIOUS ATTEMPT WAS CUT OFF/.test(c.user))
  check('the retry tells the model to write less', /SHORTER version/.test(retryPrompt?.user || ''))

  // Truncated twice: the page is dropped and said so, rather than shipping a broken file.
  let n = 0
  const always = {
    generate: async (system, user, maxTokens) => {
      if (/Ask AT MOST/.test(system)) return { text: '', usedOut: 10 }
      if (/Plan the app/.test(system)) return { text: JSON.stringify({ pages: [{ id: 'index', title: 'Seats' }], tables: [] }), usedOut: 50 }
      if (/ONE JSON object/.test(system)) return { text: '{}', usedOut: 20 }
      if (/THE APP SHELL/.test(system)) return { text: "===FILE: src/routes/__root.tsx===\nshell\n", usedOut: 60 }
      n++
      return { text: '===FILE: src/routes/index.tsx===\nconst broken = (', usedOut: maxTokens, truncated: true }
    },
    build: async () => ({ ok: true }),
  }
  const r2 = await runClonePipeline('A seat picker.', 60000, always)
  check('it does not retry forever', n === 2, `${n} attempts`)
  check('a page truncated twice is reported as lost', r2.trace.some((s) => s.stage === 'page:index:lost'))
  check('and the broken partial is NOT shipped', !('src/routes/index.tsx' in r2.files), Object.keys(r2.files).join(', '))
  check('the rest of the app still builds', r2.ok === true)
}

// ── the repair loop should not resend the component library ───────────────────
console.log('\nrepair sends the app, not the kit')
{
  const seen = []
  const m = {
    generate: async (system, user, maxTokens) => {
      if (/Ask AT MOST/.test(system)) return { text: '', usedOut: 10 }
      if (/Plan the app/.test(system)) return { text: JSON.stringify({ pages: [{ id: 'index', title: 'Home' }], tables: [] }), usedOut: 50 }
      if (/ONE JSON object/.test(system)) return { text: '{}', usedOut: 20 }
      if (/THE APP SHELL/.test(system)) return { text: "===FILE: src/routes/__root.tsx===\nshell\n", usedOut: 60 }
      if (/The build failed/.test(system)) { seen.push(user); return { text: '===FILE: src/routes/index.tsx===\nfixed\n', usedOut: 80 } }
      return { text: '===FILE: src/routes/index.tsx===\npage\n', usedOut: 80 }
    },
    build: (() => { let n = 0; return async () => (++n === 1 ? { ok: false, error: 'boom' } : { ok: true }) })(),
  }
  const r = await runClonePipeline('x', 60000, m)
  check('a repair ran', seen.length === 1)
  check('it was given the route files', /src\/routes\/index\.tsx/.test(seen[0] || ''))
  check('and told that a cut-off file is itself the bug', true)
  check('the run recovers', r.ok === true)
}

console.log(failures ? `\n${failures} FAILED\n` : '\nall pipeline checks pass\n')
process.exit(failures ? 1 : 0)
