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
    } else if (/Return the COMPLETE src\/styles\.css/.test(system)) {
      text = '===FILE: src/styles.css===\n@theme {\n  --color-tier-premium: oklch(0.86 0.09 60);\n}\n'
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
const res = await runClonePipeline('A theatre seat booking site for the Lumière.', 40000, m)
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
  check('stylesheet written', paths.includes('src/styles.css'))
  check('a route file per page', ['index', 'book', 'my-tickets'].every((p) => paths.includes(`src/routes/${p}.tsx`)), paths.join(', '))
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

console.log(failures ? `\n${failures} FAILED\n` : '\nall pipeline checks pass\n')
process.exit(failures ? 1 : 0)
