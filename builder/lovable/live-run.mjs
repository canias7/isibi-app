// live-run.mjs — runs the Lovable-clone pipeline for real against Claude, builds the result, and
// prints a scorecard next to the numbers measured from Lovable's own output.
//
// SPENDS CREDITS. Runs from .github/workflows/clone-compare.yml (workflow_dispatch), which is where
// ANTHROPIC_API_KEY lives. It cannot run in the dev sandbox — Actions secrets are write-only, so
// the key is not readable from outside a workflow.
//
//   node builder/lovable/live-run.mjs --brief "…" [--model claude-sonnet-5] [--cap 40000] [--out DIR]
//
// The default brief is the theatre seat picker, because that is the one prompt Lovable has already
// answered in this repo — its output is in the uploaded zip, so the comparison is like for like.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runClonePipeline, traceSummary } from './pipeline.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATE = path.join(here, 'template')

// ── args ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback
}

const DEFAULT_BRIEF =
  'Build a page where a customer picks seats for a theatre show. Show the seating chart — 12 rows ' +
  '(A–L), 18 seats per row, with a centre aisle. Seats can be available, already sold, or selected ' +
  'by me. There are three price tiers: Premium (rows A–D, $95), Standard (E–H, $65), Balcony (I–L, ' +
  '$40). Some seats are wheelchair accessible. Let me pick up to 6 seats, show a running total, and ' +
  'confirm the booking.'

// Inputs may arrive as flags (local) or environment variables (the workflow passes them that way,
// since splicing arbitrary text into a shell command is fragile and an injection point).
const BRIEF = arg('brief', process.env.CLONE_BRIEF?.trim() || DEFAULT_BRIEF)
const MODEL = arg('model', process.env.CLONE_MODEL?.trim() || 'claude-sonnet-5')
const CAP = Number(arg('cap', process.env.CLONE_CAP?.trim() || '40000'))
const OUT = arg('out', path.join(os.tmpdir(), 'clone-live'))
const KEY = process.env.ANTHROPIC_API_KEY

// --dry exercises this whole runner — pipeline, real build, scorecard, artifact — with a stub model
// instead of the API. It is how the runner is verified before a live run spends anything.
const DRY = argv.includes('--dry')

if (!KEY && !DRY) {
  console.error('ANTHROPIC_API_KEY is not set. This runner is meant for the clone-compare workflow,')
  console.error('where the repository secret is available; Actions secrets cannot be read from outside one.')
  process.exit(2)
}

// ── the model adapter: what makes deps.generate real ──────────────────────────
let calls = 0, inTokens = 0, outTokens = 0, truncated = 0
async function generate(system, user, maxTokens) {
  calls++
  if (DRY) return dryGenerate(system, user, maxTokens)
  const body = {
    model: MODEL,
    max_tokens: Math.max(400, Math.min(maxTokens, 16000)),
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: user }],
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (r.status === 429 || r.status >= 500) {
      const wait = 2000 * 2 ** attempt
      console.error(`  … ${r.status}, retrying in ${wait}ms`)
      await new Promise((res) => setTimeout(res, wait))
      continue
    }
    if (!r.ok) {
      console.error(`  ! API ${r.status}: ${(await r.text()).slice(0, 300)}`)
      return { text: '', usedOut: 0 }
    }
    const j = await r.json()
    inTokens += j.usage?.input_tokens || 0
    outTokens += j.usage?.output_tokens || 0
    // stop_reason is the difference between "the model had nothing to say" and "we cut it off
    // mid-sentence". The first live run reported five stages as "(no files)" when every one of
    // them had actually been truncated at exactly its reserve.
    if (j.stop_reason === 'max_tokens') truncated++
    return {
      text: (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n'),
      usedOut: j.usage?.output_tokens || 0,
      truncated: j.stop_reason === 'max_tokens',
    }
  }
  return { text: '', usedOut: 0 }
}

// A stand-in that returns the same SHAPE the real stages must return, so --dry exercises the
// parsing, the file routing and the scorecard rather than pretending they worked.
function dryGenerate(system, user, maxTokens) {
  const out = (text) => {
    // Count them the same way the live path does, so the scorecard's token and cost columns are
    // genuinely exercised by a dry run rather than reading zero.
    const usedOut = Math.min(maxTokens, 250)
    inTokens += Math.round((system.length + user.length) / 4)
    outTokens += usedOut
    return { text, usedOut }
  }
  if (/Ask AT MOST/.test(system)) return out('')
  if (/Plan the app/.test(system)) return out(JSON.stringify({ name: 'Dry Run', pages: [{ id: 'index', title: 'Home' }], tables: ['bookings'] }))
  if (/Design the database FIRST/.test(system)) {
    return out('===FILE: isibi.schema.json===\n' + JSON.stringify({ tables: [{ name: 'bookings', access: 'user', columns: [{ name: 'seat', type: 'text', required: true }] }] }, null, 2))
  }
  if (/Return the COMPLETE src\/styles\.css/.test(system)) return out('===FILE: src/styles.css===\n' + fs.readFileSync(path.join(TEMPLATE, 'src/styles.css'), 'utf8'))
  if (/THE APP SHELL/.test(system)) {
    return out(`===FILE: src/routes/__root.tsx===
import { HeadContent, Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({ meta: [{ title: 'Dry Run' }] }),
  component: () => (<><HeadContent /><Outlet /></>),
})
`)
  }
  const m = user.match(/===FILE: (src\/routes\/[^=]+)===/)
  const p = m ? m[1].trim() : 'src/routes/index.tsx'
  return out(`===FILE: ${p}===
import { createFileRoute } from '@tanstack/react-router'
import { db } from '@/integrations/db/client'
export const Route = createFileRoute('/')({
  head: () => ({ meta: [{ title: 'Dry Run' }] }),
  component: () => { void db; return <div className="bg-background text-foreground">dry run</div> },
})
`)
}

// ── a real build, through the real build service ──────────────────────────────
const APP = fs.mkdtempSync(path.join(os.tmpdir(), 'clone-live-app-'))
fs.cpSync(TEMPLATE, APP, { recursive: true, filter: (s) => !s.includes('node_modules') && !s.includes('/dist') })
if (fs.existsSync(path.join(TEMPLATE, 'node_modules'))) {
  fs.symlinkSync(path.join(TEMPLATE, 'node_modules'), path.join(APP, 'node_modules'))
}
fs.cpSync(path.join(APP, 'src'), path.join(APP, '.template-src'), { recursive: true })

process.env.APP_DIR = APP
process.env.NO_SERVER = '1'
const { buildFiles } = await import('./build-server.mjs')
const build = (files) => buildFiles(files)

// ── run ───────────────────────────────────────────────────────────────────────
console.log(`\n${DRY ? 'DRY RUN (stub model, real build) · ' : ''}model ${MODEL} · cap ${CAP} tokens · workspace ${APP}\n`)
console.log(`brief: ${BRIEF.slice(0, 120)}…\n`)

const started = Date.now()
const res = await runClonePipeline(BRIEF, CAP, { generate, build }, {
  // The theme stage merges the app's tokens INTO this. Without it applyTheme would have nothing to
  // merge into and the app would ship with an empty stylesheet.
  baseCss: fs.readFileSync(path.join(TEMPLATE, 'src/styles.css'), 'utf8'),
  onStage: (r) => console.log(`  ${String(r.n).padStart(2)}. ${r.stage}${r.skipped ? ` — skipped (${r.skipped})` : r.warn ? ` — WARN ${r.warn}` : r.out ? ` — ${r.out} tok` : ''}`),
})
const seconds = Math.round((Date.now() - started) / 1000)

console.log('\n' + traceSummary(res))

// ── write the app out so it can be inspected and compared ─────────────────────
fs.mkdirSync(OUT, { recursive: true })
for (const [rel, src] of Object.entries(res.files)) {
  const full = path.join(OUT, rel)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, src)
}

// ── scorecard ─────────────────────────────────────────────────────────────────
// Lovable's column is measured from the seat picker in their zip, not estimated.
const pageFiles = Object.keys(res.files).filter((f) => /^src\/routes\/.*\.tsx$/.test(f))
const totalLines = Object.entries(res.files)
  .filter(([f]) => f.endsWith('.tsx'))
  .reduce((n, [, s]) => n + s.split('\n').length, 0)
const src = Object.values(res.files).join('\n')
const usesComponents = (src.match(/@\/components\/ui\//g) || []).length
const usesDbClient = /@\/integrations\/db\/client/.test(src)
const hasSchema = Boolean(res.files['isibi.schema.json'])
const schemaText = res.files['isibi.schema.json'] || ''
const cost = (inTokens / 1e6) * 3 + (outTokens / 1e6) * 15 // sonnet-5 list rate; opus differs

const row = (label, ours, theirs) => console.log(`  ${label.padEnd(34)}${String(ours).padEnd(22)}${theirs}`)
console.log('\n' + '='.repeat(78))
console.log(`  ${'MEASURE'.padEnd(34)}${'CLONE (this run)'.padEnd(22)}LOVABLE (their zip)`)
console.log('  ' + '-'.repeat(74))
row('built ok', res.ok ? 'yes' : `NO — ${String(res.build?.error || '').split('\n')[0].slice(0, 40)}`, 'yes')
row('route files', pageFiles.length, '2')
row('total .tsx lines', totalLines, '432')
row('shadcn components imported', usesComponents, '0')
row('database declared', hasSchema ? 'yes' : 'no', 'no — sold seats from hash()')
row('reads through a real client', usesDbClient ? 'yes' : 'no', 'no — nothing persisted')
const smoke = res.build?.smoke
row('runtime smoke check', smoke?.ran ? (smoke.errors.length ? 'FAILED' : 'passed') : 'skipped', 'n/a')
row('model calls', calls, 'unknown')
row('responses truncated', truncated ? `${truncated} — RAISE THE RESERVES` : 'none', 'n/a')
row('output tokens', outTokens, 'unknown')
row('wall clock', `${seconds}s`, 'unknown')
row('est. cost', `$${cost.toFixed(3)}`, 'unknown')
console.log('='.repeat(78))

// A bare "skipped" hid a real wiring bug for eight runs: the one check that catches a white-screening
// app was never running, and the scorecard said nothing about why. The reason is the whole signal.
if (smoke && !smoke.ran) console.log(`\nsmoke check did not run: ${smoke.reason}`)
if (smoke?.errors?.length) for (const e of smoke.errors) console.log(`  runtime error — ${e}`)

if (hasSchema) {
  const s = JSON.parse(schemaText || '{}')
  console.log('\nschema the model designed BEFORE writing any page:')
  for (const t of s.tables || []) {
    const flags = ['unique', 'publicView', 'noOverlap', 'transitions', 'checks'].filter((k) => t[k])
    console.log(`  ${t.name} (${t.access}) — ${(t.columns || []).length} columns${flags.length ? ` · ${flags.join(', ')}` : ''}`)
  }
  console.log('\n  Lovable, on the same brief: no database at all. Sold seats came from')
  console.log('  `hash(id) < 0.22` and "confirm booking" wrote to a useState.')
}

console.log(`\napp written to ${OUT}`)
fs.writeFileSync(path.join(OUT, '_scorecard.json'), JSON.stringify({
  model: MODEL, ok: res.ok, seconds, calls, inTokens, outTokens, cost,
  pages: pageFiles, totalLines, usesComponents, usesDbClient, hasSchema,
  smoke: res.build?.smoke, typecheck: res.build?.typecheck, trace: res.trace,
}, null, 2))

process.exit(res.ok ? 0 : 1)
