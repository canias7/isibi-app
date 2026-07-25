// pipeline.mjs — the Lovable-clone build pipeline.
//
// Mirrors their order of operations. The one that matters is stage 3: THE DATABASE IS DESIGNED
// BEFORE ANY PAGE IS WRITTEN. The existing isibi pipeline does the opposite — it generates pages
// first, notices afterwards that they talk to a database, and retro-fits a schema from whatever
// field names the pages happened to guess (`schema-fix` is a REPAIR stage there). That means each
// page invents its own shape and a later stage reconciles them. Here every page is written against
// a data model that already exists.
//
//   1 clarify   ask two or three questions                      (model, cheap)
//   2 plan      pages, routes, tables                           (model)
//   3 schema    isibi.schema.json — BEFORE any page             (model)
//   4 theme     this app's own tokens in src/styles.css         (model, cheap)
//   5 shell     __root.tsx — nav, site meta, webfont links       (model)
//   6 pages     one complete file per route, one call each      (model, the bulk)
//   7 build     compile                                         (free)
//   8 repair    feed compile errors back, loop                  (model, only on failure)
//
// Stage 5 exists because diffing their two apps showed __root.tsx is one of only seven shared
// files that DIFFER between them — it is written per app, and it carries the header, nav, footer,
// site-wide meta and the Google Fonts <link>s that make `--font-display` actually resolve.
//
// Pure and injectable, same shape as full-pipeline.mjs: deps.generate(system, user, maxTokens) and
// deps.build(files). Everything is driven through a single shared ledger, so the sum of every model
// call is <= cap and later stages are skipped rather than overspending.

import { buildPageRules, PLAN_RULES, SCHEMA_RULES, STYLE_RULES, SHELL_RULES } from './rules.mjs'
import { scaffoldDbTypes } from '../scaffold.mjs'

// Reserves per stage. Pages get whatever is left after the fixed stages are set aside.
export const RESERVES = { clarify: 700, plan: 1200, schema: 2000, theme: 900, shell: 2200, repair: 4000 }
// The iterate loop (their step 7). Picking files is cheap; rewriting them is where the budget goes.
export const REVISE_RESERVES = { pick: 600, edit: 6000, repair: 4000 }
export const PER_PAGE = 3500

const FILE_RE = /===FILE:\s*(.+?)===\n([\s\S]*?)(?=\n===FILE:|$)/g

/** Parse the `===FILE: path===` blocks a generation returns. Same wire format as the main pipeline. */
export function parseFiles(text) {
  const out = {}
  for (const m of String(text || '').matchAll(FILE_RE)) {
    const p = m[1].trim().replace(/^\/+/, '')
    if (p) out[p] = m[2].replace(/\s+$/, '') + '\n'
  }
  return out
}

/** Route file path for a page id: "my-bookings" -> "src/routes/my-bookings.tsx", "index" -> index.tsx */
export function routePath(id) {
  const clean = String(id || '').trim().replace(/\.tsx$/, '').replace(/^\/+|\/+$/g, '')
  return 'src/routes/' + (clean === '' || clean === '/' ? 'index' : clean) + '.tsx'
}

/** URL a route file serves, for the head/meta prompt. */
export function routeUrl(id) {
  const clean = String(id || '').replace(/\.tsx$/, '')
  return clean === 'index' ? '/' : '/' + clean.replace(/\/index$/, '')
}

export async function runClonePipeline(brief, cap, deps, opts = {}) {
  if (!deps || typeof deps.generate !== 'function') return { ok: false, error: 'deps.generate required' }

  const trace = []
  const t = (stage, info) => {
    const rec = { n: trace.length + 1, stage, ...info }
    trace.push(rec)
    if (opts.onStage) opts.onStage(rec)
    return rec
  }

  // ── one shared ledger for the whole build ───────────────────────────────────
  let spent = 0
  const remaining = () => Math.max(0, cap - spent)
  const call = async (stage, system, user, reserve) => {
    const budget = Math.min(reserve, remaining())
    if (budget < 300) {
      t(stage, { skipped: 'budget exhausted', out: 0, remaining: remaining() })
      return null
    }
    const g = await deps.generate(system, user, budget)
    spent += g?.usedOut || 0
    const files = parseFiles(g?.text || '')
    t(stage, { budget, out: g?.usedOut || 0, files: Object.keys(files), remaining: remaining() })
    return { g, files, text: g?.text || '' }
  }

  const files = {}
  const merge = (f) => Object.assign(files, f || {})

  // ── 1. clarify ──────────────────────────────────────────────────────────────
  // Cheap and first, exactly as they do it. Skipped when the caller already has answers.
  let questions = []
  if (opts.clarify !== false) {
    const r = await call('clarify',
      'You are scoping a web app before it is built. Ask AT MOST three short questions whose answers would ' +
      'change what gets built — who signs in, whether money is taken, what the single most important screen is. ' +
      'Return one question per line, nothing else. If the brief is already clear, return nothing.',
      brief, RESERVES.clarify)
    questions = String(r?.text || '').split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 3)
  } else {
    t('clarify', { skipped: 'answers supplied by caller', out: 0, remaining: remaining() })
  }

  const context = [brief, opts.answers ? `\n\nAnswers:\n${opts.answers}` : ''].join('')

  // ── 2. plan ─────────────────────────────────────────────────────────────────
  const planned = await call('plan', PLAN_RULES,
    `${context}\n\nReturn JSON only: {"name":"<business name>","pages":[{"id":"index","title":"..."}],"tables":["..."]}`,
    RESERVES.plan)
  const plan = safeJson(planned?.text) || {}
  const pages = Array.isArray(plan.pages) && plan.pages.length ? plan.pages : [{ id: 'index', title: 'Home' }]
  const needsDb = Array.isArray(plan.tables) && plan.tables.length > 0
  t('plan-parsed', { pages: pages.map((p) => p.id), tables: plan.tables || [], needsDb, out: 0, remaining: remaining() })

  // ── 3. schema — BEFORE pages. This is the whole point of the reordering. ────
  let schema = null
  if (needsDb) {
    const r = await call('schema', SCHEMA_RULES,
      `${context}\n\nTables the app needs: ${(plan.tables || []).join(', ')}\n\n` +
      'Return ONE file block:\n===FILE: isibi.schema.json===\n{ "tables": [ … ] }',
      RESERVES.schema)
    merge(r?.files)
    schema = files['isibi.schema.json'] || null
    if (!schema) t('schema-missing', { warn: 'the plan named tables but no schema was returned; pages will be written without one', out: 0, remaining: remaining() })

    // Row types, generated from the schema for zero tokens — the same trick their template uses
    // (their integrations/supabase/types.ts is stamped "automatically generated"). With this in
    // place `db.from('bookings')` returns typed rows and a column typo is a compile error rather
    // than undefined on screen.
    if (schema) {
      const gen = scaffoldDbTypes({ 'isibi.schema.json': schema })
      const emitted = gen['src/lib/db-types.ts']
      if (emitted) {
        files['src/integrations/db/types.ts'] = emitted
        t('db-types', { generated: 'src/integrations/db/types.ts', out: 0, remaining: remaining() })
      }
    }
  } else {
    t('schema', { skipped: 'the plan declares no tables', out: 0, remaining: remaining() })
  }

  // ── 4. theme — this app's own tokens, before pages reference them ───────────
  // Inferred rather than observed: their seat picker's styles.css carries tokens their model
  // invented (--color-tier-premium, --font-display: Fraunces), but whether that was its own call
  // or part of page generation is not visible from the output. It is a separate stage here so a
  // page can never reference a token that was never declared.
  const themed = await call('theme',
    `${STYLE_RULES}\n\nReturn the COMPLETE src/styles.css with this app's own tokens filled into the first ` +
    '@theme block, and any new semantic colours added to BOTH :root and .dark plus registered in @theme inline. ' +
    'Leave every existing base token exactly as it is.',
    `${context}\n\nCurrent stylesheet:\n${opts.baseCss || '(the standard shadcn base)'}`,
    RESERVES.theme)
  merge(themed?.files)

  // ── 5. shell — __root.tsx, before the pages that render inside it ──────────
  const shell = await call('shell', SHELL_RULES,
    `${context}\n\nPages in this app: ${pages.map((p) => routeUrl(p.id)).join(', ')}.\n` +
    (files['src/styles.css'] ? `\nThe stylesheet you must match (note any --font-* tokens — load those fonts):\n${files['src/styles.css'].slice(0, 2500)}\n` : '') +
    '\nReturn ONE complete file:\n===FILE: src/routes/__root.tsx===',
    RESERVES.shell)
  merge(shell?.files)

  // ── 6. pages — one complete file per route, one call each, as they do ──────
  const fixed = RESERVES.repair
  const perPage = Math.max(1200, Math.min(PER_PAGE, Math.floor((remaining() - fixed) / Math.max(1, pages.length))))
  const pageRules = buildPageRules({ preferComponents: opts.preferComponents })
  for (const page of pages) {
    const path = routePath(page.id)
    const r = await call(`page:${page.id}`,
      pageRules,
      `${context}\n\nBuild the page at ${routeUrl(page.id)} — ${page.title || page.id}.\n` +
      (schema ? `\nThe database is already designed. Write against it exactly; do not invent field names.\n${schema}\n` : '') +
      `\nReturn ONE complete file:\n===FILE: ${path}===`,
      perPage)
    merge(r?.files)
    if (r && !r.files[path]) t(`page:${page.id}:misfiled`, { warn: `expected ${path}, got ${Object.keys(r.files).join(', ') || 'nothing'}`, out: 0, remaining: remaining() })
  }

  // ── 6 + 7. build, then repair on failure ────────────────────────────────────
  let build = { ok: true, skipped: 'no build function supplied' }
  if (typeof deps.build === 'function') {
    const attempts = opts.fixAttempts ?? 2
    for (let i = 0; i <= attempts; i++) {
      build = await deps.build(files)
      t('build', { ok: !!build.ok, attempt: i, error: build.ok ? undefined : firstLine(build.error), out: 0, remaining: remaining() })
      if (build.ok || i === attempts) break
      const r = await call(`repair:${i + 1}`,
        `${pageRules}\n\nThe build failed. Return COMPLETE replacement files for ONLY the files that must change.`,
        `Error:\n${String(build.error || '').slice(0, 4000)}\n\nFiles:\n${dump(files)}`,
        RESERVES.repair)
      if (!r || !Object.keys(r.files).length) break
      merge(r.files)
    }
  } else {
    t('build', { skipped: 'no build function supplied', out: 0, remaining: remaining() })
  }

  return {
    ok: !!build.ok,
    files,
    plan,
    questions,
    schema: schema ? 'declared' : null,
    spent,
    cap,
    remaining: remaining(),
    build,
    trace,
  }
}

/**
 * reviseApp — their step 7, the part a build pipeline alone does not give you.
 *
 * After the first build, every follow-up ("make the seats bigger", "add a cancel button") is a
 * TARGETED EDIT to named files, not a rebuild. Lovable's transcripts show exactly that: a message
 * arrives, specific files are rewritten, the rest of the app is untouched.
 *
 * Two steps rather than one, because handing the model every file to change three lines is both
 * expensive and a good way to have it rewrite something it was not asked to touch:
 *   1 pick — given only the file LIST and the request, name the files that must change (cheap)
 *   2 edit — given the FULL SOURCE of just those files, return complete replacements
 * Then build, and repair on failure exactly as the first build does.
 *
 * Returns the same shape as runClonePipeline, so a caller can treat a build and a revision alike.
 */
export async function reviseApp(files, request, cap, deps, opts = {}) {
  if (!deps || typeof deps.generate !== 'function') return { ok: false, error: 'deps.generate required' }
  if (!files || !Object.keys(files).length) return { ok: false, error: 'nothing to revise' }

  const trace = []
  const t = (stage, info) => { const r = { n: trace.length + 1, stage, ...info }; trace.push(r); if (opts.onStage) opts.onStage(r); return r }
  let spent = 0
  const remaining = () => Math.max(0, cap - spent)
  const call = async (stage, system, user, reserve) => {
    const budget = Math.min(reserve, remaining())
    if (budget < 300) { t(stage, { skipped: 'budget exhausted', out: 0, remaining: remaining() }); return null }
    const g = await deps.generate(system, user, budget)
    spent += g?.usedOut || 0
    const parsed = parseFiles(g?.text || '')
    t(stage, { budget, out: g?.usedOut || 0, files: Object.keys(parsed), remaining: remaining() })
    return { g, files: parsed, text: g?.text || '' }
  }

  const next = { ...files }
  // Files the app owns and a revision may touch. The component library and the generated route
  // tree are off limits — a follow-up about a booking form has no business rewriting Button.
  const editable = Object.keys(next).filter((f) =>
    f === 'isibi.schema.json' || f === 'src/styles.css' || /^src\/routes\/.+\.tsx$/.test(f))

  // ── 1. pick ─────────────────────────────────────────────────────────────────
  const picked = await call('revise-pick',
    'You are deciding the smallest set of files to change. Return JSON only: {"files":["src/routes/book.tsx"]}. ' +
    'Name only files that MUST change for the request. Fewer is better — a file you list will be rewritten in full.',
    `Request: ${request}\n\nFiles you may change:\n${editable.join('\n')}`,
    REVISE_RESERVES.pick)
  const asked = safeJson(picked?.text)?.files
  let targets = Array.isArray(asked) ? asked.filter((f) => editable.includes(f)) : []
  const refused = Array.isArray(asked) ? asked.filter((f) => !editable.includes(f)) : []
  if (refused.length) t('revise-pick:refused', { warn: `not editable, ignored: ${refused.join(', ')}`, out: 0, remaining: remaining() })
  if (!targets.length) {
    // Better to attempt the likeliest file than to fail silently on an unparseable pick.
    targets = editable.filter((f) => f.startsWith('src/routes/')).slice(0, 1)
    t('revise-pick:fallback', { warn: `no usable pick; defaulting to ${targets.join(', ') || 'nothing'}`, out: 0, remaining: remaining() })
  }
  if (!targets.length) return { ok: false, error: 'no editable files', files: next, spent, cap, trace }

  // ── 2. edit ─────────────────────────────────────────────────────────────────
  const rules = buildPageRules({ preferComponents: opts.preferComponents })
  const edited = await call('revise-edit',
    `${rules}\n\nYou are editing an app that already works. Change ONLY what the request asks for and ` +
    'return each changed file COMPLETE — not a diff, not a fragment. Leave everything else exactly as it is.',
    `Request: ${request}\n\n` +
    (next['isibi.schema.json'] ? `The database (do not contradict it):\n${next['isibi.schema.json']}\n\n` : '') +
    `Files to change:\n${dump(Object.fromEntries(targets.map((f) => [f, next[f]])))}`,
    REVISE_RESERVES.edit)

  const changed = Object.keys(edited?.files || {}).filter((f) => editable.includes(f))
  for (const f of changed) next[f] = edited.files[f]
  const ignored = Object.keys(edited?.files || {}).filter((f) => !editable.includes(f))
  if (ignored.length) t('revise-edit:ignored', { warn: `returned files outside the editable set, discarded: ${ignored.join(', ')}`, out: 0, remaining: remaining() })
  if (!changed.length) return { ok: false, error: 'the revision returned no usable files', files: next, spent, cap, trace }

  // ── 3. build, repair on failure ─────────────────────────────────────────────
  let build = { ok: true, skipped: 'no build function supplied' }
  if (typeof deps.build === 'function') {
    const attempts = opts.fixAttempts ?? 2
    for (let i = 0; i <= attempts; i++) {
      build = await deps.build(next)
      t('build', { ok: !!build.ok, attempt: i, error: build.ok ? undefined : firstLine(build.error), out: 0, remaining: remaining() })
      if (build.ok || i === attempts) break
      const fix = await call(`repair:${i + 1}`,
        `${rules}\n\nThe build failed after your edit. Return COMPLETE replacement files for ONLY what must change.`,
        `Error:\n${String(build.error || '').slice(0, 4000)}\n\nFiles:\n${dump(Object.fromEntries(changed.map((f) => [f, next[f]])))}`,
        REVISE_RESERVES.repair)
      const fixed = Object.keys(fix?.files || {}).filter((f) => editable.includes(f))
      if (!fixed.length) break
      for (const f of fixed) next[f] = fix.files[f]
    }
  } else {
    t('build', { skipped: 'no build function supplied', out: 0, remaining: remaining() })
  }

  return { ok: !!build.ok, files: next, changed, untouched: Object.keys(files).length - changed.length, spent, cap, remaining: remaining(), build, trace }
}

const firstLine = (s) => String(s || '').split('\n')[0].slice(0, 200)
const dump = (files, limit = 60000) =>
  Object.entries(files).map(([p, s]) => `===FILE: ${p}===\n${s}`).join('\n\n').slice(0, limit)

function safeJson(text) {
  if (!text) return null
  const m = String(text).match(/\{[\s\S]*\}/)
  if (!m) return null
  try { return JSON.parse(m[0]) } catch { return null }
}

/** Human-readable trace, for the comparison harness and for debugging a real run. */
export function traceSummary(result) {
  if (!result) return '(no result)'
  const lines = result.trace.map((r) => {
    const what = r.skipped ? `skipped — ${r.skipped}` : r.warn ? `WARN ${r.warn}`
      : r.files ? `${r.out} tok → ${r.files.join(', ') || '(no files)'}`
      : r.ok !== undefined ? (r.ok ? 'ok' : `failed — ${r.error}`) : `${r.out ?? 0} tok`
    return `  ${String(r.n).padStart(2)}. ${r.stage.padEnd(22)} ${what}`
  })
  return lines.join('\n') + `\n  spent ${result.spent} / cap ${result.cap}`
}

export default { runClonePipeline, reviseApp, parseFiles, routePath, routeUrl, traceSummary, RESERVES, REVISE_RESERVES, PER_PAGE }
