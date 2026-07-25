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

import { buildPageRules, PLAN_RULES, SCHEMA_RULES, STYLE_RULES, SHELL_RULES, OUTPUT_RULES } from './rules.mjs'
import { scaffoldDbTypes } from '../scaffold.mjs'

// Reserves per stage. Pages get whatever is left after the fixed stages are set aside.
// Sized from a real run, not guessed. The first live attempt used 2000/900/3500 and every stage
// that hit its ceiling returned nothing usable — a truncated reply has no closing file block. The
// stylesheet alone is ~150 lines because the model must return it COMPLETE, and a seat-grid page
// is comfortably 250+ lines of code before any prose.
// theme is small now because it returns JSON tokens rather than a whole stylesheet; shell is large
// because __root.tsx must come back complete and a live run truncated it at 5000.
export const RESERVES = { clarify: 700, plan: 1500, schema: 6000, theme: 4000, shell: 9000, repair: 10000 }
// The iterate loop (their step 7). Picking files is cheap; rewriting them is where the budget goes.
export const REVISE_RESERVES = { pick: 600, edit: 6000, repair: 4000 }
export const PER_PAGE = 16000

const FILE_RE = /===FILE:\s*(.+?)===\n([\s\S]*?)(?=\n===FILE:|$)/g

/** Parse the `===FILE: path===` blocks a generation returns. Same wire format as the main pipeline. */
export function parseFiles(text) {
  const out = {}
  for (const m of String(text || '').matchAll(FILE_RE)) {
    const p = m[1].trim().replace(/^\/+/, '')
    if (!p) continue
    // Models often wrap the body in a markdown fence despite being told not to. Stripping it here
    // is cheaper than losing a whole generation to three backticks.
    let body = m[2].replace(/\s+$/, '')
    body = body.replace(/^\s*```[a-zA-Z]*\n/, '').replace(/\n```\s*$/, '')
    out[p] = body + '\n'
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
    // A truncated reply and an empty one look identical downstream, and they need opposite fixes.
    if (g?.truncated) t(`${stage}:truncated`, { warn: `cut off at ${budget} tokens — raise the reserve for ${stage}`, out: 0, remaining: remaining() })
    t(stage, { budget, out: g?.usedOut || 0, truncated: !!g?.truncated, files: Object.keys(files), remaining: remaining() })
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
    const r = await call('schema', `${OUTPUT_RULES}\n\n${SCHEMA_RULES}`,
      `${context}\n\nTables the app needs: ${(plan.tables || []).join(', ')}\n\n` +
      'Return ONE file block:\n===FILE: isibi.schema.json===\n{ "tables": [ … ] }',
      RESERVES.schema)
    merge(r?.files)
    schema = files['isibi.schema.json'] || null
    // A live run returned three tables with no `access` at all, which leaves them unscoped. Catch
    // it here rather than discovering it when a customer reads someone else's row.
    if (schema) {
      try {
        const parsed = JSON.parse(schema)
        const unscoped = (parsed.tables || []).filter((tb) => !tb.access).map((tb) => tb.name)
        if (unscoped.length) t('schema:unscoped', { warn: `no access mode declared on: ${unscoped.join(', ')} — these tables are unscoped`, out: 0, remaining: remaining() })
      } catch { t('schema:unparseable', { warn: 'the schema is not valid JSON', out: 0, remaining: remaining() }) }
    }
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
  //
  // The model returns only the tokens to ADD, as JSON, and they are merged into the base
  // stylesheet in code. Asking for the complete file was the original design and it truncated on a
  // live run — 5000 tokens spent, nothing returned, and the app silently kept the default theme.
  // A 150-line base that never changes should not be re-emitted to add four colours.
  // Deliberately NOT sent the full STYLE_RULES. This stage picks a handful of tokens; it does not
  // need the guidance about which class to use where, and a long prose block invited the model to
  // discuss the palette instead of returning it — a live run spent 2500 tokens and emitted nothing.
  // OUTPUT_RULES cannot be used here either, since it demands ===FILE: blocks; this is JSON.
  const themed = await call('theme',
    'You are choosing the handful of design tokens THIS app needs beyond a standard neutral base.\n' +
    'Reply with ONE JSON object and nothing else. First character `{`, last character `}`. No prose, ' +
    'no explanation, no markdown fence — a reply that starts with anything else is discarded.\n' +
    '{"fonts":{"--font-display":"\'Fraunces\', serif","--font-sans":"\'Inter\', sans-serif"},' +
    '"colors":{"tier-premium":{"light":"oklch(0.86 0.09 60)","dark":"oklch(0.7 0.09 60)"}}}\n' +
    'Rules: every colour needs BOTH light and dark, in oklch. Name two to five colours at most, and ' +
    'only ones the app genuinely needs (a price tier, a status, a brand accent) — the base already ' +
    'has background, foreground, card, muted, primary, secondary, accent, destructive, border and ' +
    'five chart colours. Pick fonts that suit this business. Return {} if the base is genuinely enough.',
    `Business: ${context.slice(0, 800)}`, RESERVES.theme)
  const tokens = safeJson(themed?.text)
  if (!opts.baseCss) {
    t('theme-merged', { warn: 'no base stylesheet supplied, so this app keeps the default theme', out: 0, remaining: remaining() })
  } else if (themed?.g?.truncated && !tokens) {
    // "the base token set was enough" is a DECISION. Being cut off is not one, and reporting it as
    // such hid a real failure for two runs — the app shipped with the default theme and the trace
    // said everything was fine.
    t('theme-merged', { warn: 'the theme reply was cut off, so this app fell back to the default palette — it was not a choice', out: 0, remaining: remaining() })
  } else if (tokens && (Object.keys(tokens.fonts || {}).length || Object.keys(tokens.colors || {}).length)) {
    files['src/styles.css'] = applyTheme(opts.baseCss || '', tokens)
    t('theme-merged', {
      generated: 'src/styles.css',
      added: [...Object.keys(tokens.fonts || {}), ...Object.keys(tokens.colors || {})].join(', '),
      out: 0, remaining: remaining(),
    })
  } else {
    t('theme-merged', { skipped: 'the base token set was enough', out: 0, remaining: remaining() })
  }

  // ── 5. shell — __root.tsx, before the pages that render inside it ──────────
  const shell = await call('shell', `${OUTPUT_RULES}\n\n${SHELL_RULES}`,
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
    const ask = (extra = '') =>
      `${context}\n\nBuild the page at ${routeUrl(page.id)} — ${page.title || page.id}.\n` +
      (schema ? `\nThe database is already designed. Write against it exactly; do not invent field names.\n${schema}\n` : '') +
      extra +
      `\nReturn ONE complete file:\n===FILE: ${path}===`

    let r = await call(`page:${page.id}`, pageRules, ask(), perPage)

    // A cut-off page is WORSE than no page: it is syntactically invalid, so `tsr generate` cannot
    // parse the routes directory and the whole build dies before vite even starts. A live run then
    // burned two repair passes trying to rewrite the same oversized file and was truncated each
    // time. So a truncation is retried immediately, once, with an explicit instruction to write a
    // smaller page — rather than handed to a build that cannot use it.
    if (r?.g?.truncated) {
      const partial = r.files[path]
      if (partial) delete files[path]
      r = await call(`page:${page.id}:retry`, pageRules,
        ask('\nYOUR PREVIOUS ATTEMPT WAS CUT OFF before you finished the file. Write a SHORTER version ' +
          'this time: fewer comments, simpler markup, smaller helper components, no decorative extras. ' +
          'A complete simple page is worth far more than an unfinished elaborate one.\n'),
        perPage)
      // If the retry is ALSO cut off, its partial is just as unparseable as the first one. Shipping
      // it would kill the build exactly as before, so it is dropped and the page is reported
      // missing — an app short one page still builds; an app with half a page does not.
      if (r?.g?.truncated) {
        t(`page:${page.id}:lost`, { warn: 'truncated twice; dropped rather than shipped broken — this page is missing from the app', out: 0, remaining: remaining() })
        r = null
      } else if (!r?.files[path]) {
        t(`page:${page.id}:lost`, { warn: 'the retry returned nothing; this page is missing from the app', out: 0, remaining: remaining() })
      }
    }
    merge(r?.files)
    if (r && !r.files[path]) t(`page:${page.id}:misfiled`, { warn: `expected ${path}, got ${Object.keys(r.files).join(', ') || 'nothing'}`, out: 0, remaining: remaining() })
  }

  // ── 5b. sitemap ($0, deterministic — the routes are already known) ──────────
  const sitemap = scaffoldSitemap(files, opts.siteUrl)
  if (sitemap) {
    files['public/sitemap.xml'] = sitemap
    t('sitemap', { out: 0, files: ['public/sitemap.xml'], remaining: remaining() })
  } else {
    t('sitemap', { skipped: opts.siteUrl ? 'no crawlable routes' : 'no site URL — a relative <loc> is invalid and would be discarded', out: 0, remaining: remaining() })
  }

  // ── 6 + 7. build, then repair on failure ────────────────────────────────────
  let build = { ok: true, skipped: 'no build function supplied' }
  if (typeof deps.build === 'function') {
    const attempts = opts.fixAttempts ?? 2
    for (let i = 0; i <= attempts; i++) {
      build = await deps.build(files)
      t('build', { ok: !!build.ok, attempt: i, error: build.ok ? undefined : firstLine(build.error), out: 0, remaining: remaining() })
      if (build.ok || i === attempts) break
      // Sending every file wastes the budget and invites a rewrite of things that were fine. Send
      // the route files and the schema, which is where a build error in a generated app lives.
      const suspect = Object.fromEntries(Object.entries(files).filter(([f]) =>
        /^src\/routes\/.+\.tsx$/.test(f) || f === 'isibi.schema.json'))
      const r = await call(`repair:${i + 1}`,
        `${pageRules}\n\nThe build failed. Return COMPLETE replacement files for ONLY the files that must ` +
        'change. If a file looks cut off mid-expression, that is the bug — rewrite it SHORTER and finish it.',
        `Error:\n${String(build.error || '').slice(0, 4000)}\n\nFiles:\n${dump(suspect)}`,
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

/**
 * Merge this app's tokens into the base stylesheet, deterministically and for zero tokens.
 * A colour lands in four places, which is exactly the bookkeeping a model gets wrong: the raw
 * value in :root and again in .dark, and a --color-<name> registration in @theme inline so
 * Tailwind emits bg-<name>. Fonts go in the leading @theme block.
 */
export function applyTheme(baseCss, tokens) {
  let css = String(baseCss || '')
  // Merging into nothing would hand the app an empty stylesheet — every token gone, every page
  // unstyled. Better to change nothing than to destroy the base.
  if (!css.includes('@theme')) return css
  const fonts = tokens.fonts || {}
  const colors = tokens.colors || {}

  const fontLines = Object.entries(fonts).map(([k, v]) => `  ${k}: ${v};`)
  const themeColorLines = Object.keys(colors).map((n) => `  --color-${n}: var(--${n});`)
  if (fontLines.length || themeColorLines.length) {
    css = css.replace(/@theme \{[\s\S]*?\n\}/, `@theme {\n${[...fontLines, ...themeColorLines].join('\n')}\n}`)
  }
  const inject = (block, lines) =>
    css.replace(new RegExp(`(${block}\\s*\\{)`), `$1\n${lines.join('\n')}`)
  const light = Object.entries(colors).map(([n, v]) => `  --${n}: ${typeof v === 'string' ? v : v.light};`)
  const dark = Object.entries(colors).map(([n, v]) => `  --${n}: ${typeof v === 'string' ? v : (v.dark || v.light)};`)
  if (light.length) css = inject(':root', light)
  if (dark.length) css = inject('\\.dark', dark)
  return css
}

/**
 * The URLs a built app actually serves, derived from its route files. Mirrors the router's own
 * conventions: `index` is the parent path, a leading `_` is a LAYOUT and contributes no segment,
 * and a `$param` route has no single URL so it is left out.
 */
export function routeUrls(files) {
  const urls = []
  for (const p of Object.keys(files)) {
    const m = /^src\/routes\/(.+)\.tsx$/.exec(p)
    if (!m || m[1].startsWith('__')) continue
    const parts = m[1].split('/')
    if (parts.some((s) => s.includes('$'))) continue
    // `_authenticated/orders.tsx` is `/orders` — but it is behind a login, so it does not belong in
    // a sitemap either. Dropping the whole subtree is both simpler and more correct than mapping it.
    if (parts.some((s) => s.startsWith('_'))) continue
    const last = parts[parts.length - 1]
    const path = last === 'index' ? parts.slice(0, -1).join('/') : parts.join('/')
    urls.push('/' + path)
  }
  return [...new Set(urls)].sort()
}

/**
 * public/sitemap.xml, deterministically and for zero tokens.
 *
 * Lovable generates one too — and theirs is broken. Their sitemap route hard-codes
 * `const BASE_URL = ""`, so every entry comes out as `<loc>/book</loc>`. The sitemap protocol
 * requires a fully-qualified URL, so a crawler discards the file. Rather than copy the bug, this
 * returns null when the site URL is unknown, and the pipeline records that it skipped. An absent
 * sitemap costs nothing; an invalid one is a file that looks like coverage and provides none.
 */
export function scaffoldSitemap(files, siteUrl) {
  const base = String(siteUrl || '').replace(/\/+$/, '')
  if (!/^https?:\/\//.test(base)) return null
  const entries = routeUrls(files).map((u) =>
    `  <url>\n    <loc>${base}${u === '/' ? '/' : u}</loc>\n    <changefreq>weekly</changefreq>\n` +
    `    <priority>${u === '/' ? '1.0' : '0.7'}</priority>\n  </url>`)
  if (!entries.length) return null
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`
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
