/**
 * Localisation primitives — string expansion, translation memory, QA
 * typology, plural coverage, locale readiness and terminology.
 *
 * The expansion factor a locale really produces, the words a memory
 * removes and what the rest costs, the errors per thousand words, whether
 * a string set can express a locale's plural forms, the share of a product
 * a locale actually covers and the divergence of a term are all DERIVED.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const money = (v: number) =>
  "£" + (Math.abs(v) < 10 ? Math.abs(v).toFixed(2) : Math.round(Math.abs(v)).toLocaleString("en-GB"))

/* ------------------------------------------------------------------ *
 * StringGrowth — how much longer each locale's text is than the
 * source. The factor is DERIVED from the actual strings, because the
 * rule of thumb everybody quotes is a single number for all lengths,
 * and short strings expand far more than long ones.
 * ------------------------------------------------------------------ */
export function StringGrowth({
  locales,
  budgetFactor,
  className = "",
}: {
  /** paired source and translated character counts */
  locales: { name: string; pairs: { source: number; translated: number }[] }[]
  /** the expansion the layout was designed to absorb */
  budgetFactor?: number
  className?: string
}) {
  const rows = locales
    .map((l) => {
      const factors = l.pairs.map((p) => p.translated / Math.max(p.source, 1))
      const totalSrc = l.pairs.reduce((a, p) => a + p.source, 0)
      const totalTr = l.pairs.reduce((a, p) => a + p.translated, 0)
      const short = l.pairs.filter((p) => p.source <= 20)
      const long = l.pairs.filter((p) => p.source > 20)
      const avg = (ps: typeof l.pairs) =>
        ps.length ? ps.reduce((a, p) => a + p.translated / Math.max(p.source, 1), 0) / ps.length : null
      return {
        ...l,
        weighted: totalTr / Math.max(totalSrc, 1),
        worst: Math.max(...factors),
        shortFactor: avg(short),
        longFactor: avg(long),
        overBudget: budgetFactor === undefined ? 0 : factors.filter((f) => f > budgetFactor).length,
        count: l.pairs.length,
      }
    })
    .sort((a, b) => b.weighted - a.weighted)
  const max = Math.max(budgetFactor ?? 0, ...rows.map((r) => r.worst))
  const widest = rows[0]
  const shortGap = rows.filter((r) => r.shortFactor !== null && r.longFactor !== null)

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.count} strings · worst ×{r.worst.toFixed(2)}
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div className="absolute inset-y-0 rounded-[2px] bg-foreground/22" style={{ width: `${(r.worst / max) * 100}%` }} title={`worst ×${r.worst.toFixed(2)}`} />
              <div className="absolute inset-y-0 rounded-[2px] bg-foreground" style={{ width: `${(r.weighted / max) * 100}%` }} title={`average ×${r.weighted.toFixed(2)}`} />
              {budgetFactor !== undefined && (
                <span className="absolute inset-y-0 w-0.5 bg-foreground/70" style={{ left: `${(budgetFactor / max) * 100}%` }} title={`budget ×${budgetFactor}`} />
              )}
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              ×{r.weighted.toFixed(2)} overall
              {r.shortFactor !== null ? ` · ×${r.shortFactor.toFixed(2)} on short strings` : ""}
              {r.longFactor !== null ? ` · ×${r.longFactor.toFixed(2)} on long ones` : ""}
              {budgetFactor !== undefined && r.overBudget > 0 ? ` · ${r.overBudget} over budget` : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Solid is the weighted average expansion and pale is the WORST string, which is the one that breaks a layout —
        an average cannot overflow a button · {widest.name} runs ×{widest.weighted.toFixed(2)} overall and ×
        {widest.worst.toFixed(2)} at its worst
        {budgetFactor !== undefined ? `, against a ×${budgetFactor} design budget` : ""} ·{" "}
        {shortGap.length > 0
          ? `short strings expand ×${(shortGap.reduce((a, r) => a + r.shortFactor!, 0) / shortGap.length).toFixed(2)} against ×${(shortGap.reduce((a, r) => a + r.longFactor!, 0) / shortGap.length).toFixed(2)} for long ones, which is why one blanket expansion figure is the wrong tool`
          : "no split between short and long strings is available here"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * TmLeverage — translation memory match bands, with the COST derived.
 * A leverage report is a table of word counts; the number a budget
 * needs is what those bands cost after their discounts.
 * ------------------------------------------------------------------ */
export function TmLeverage({
  bands,
  ratePerWord,
  className = "",
}: {
  /** each match band's words and the share of full rate it is paid at */
  bands: { name: string; words: number; rateShare: number }[]
  ratePerWord: number
  className?: string
}) {
  const rows = bands.map((b) => ({
    ...b,
    cost: b.words * ratePerWord * b.rateShare,
    fullCost: b.words * ratePerWord,
  }))
  const words = rows.reduce((a, r) => a + r.words, 0)
  const cost = rows.reduce((a, r) => a + r.cost, 0)
  const fullCost = rows.reduce((a, r) => a + r.fullCost, 0)
  const leverage = 1 - cost / Math.max(fullCost, 1e-9)
  const effectiveRate = cost / Math.max(words, 1)
  const maxWords = Math.max(...rows.map((r) => r.words))
  const newWords = rows.filter((r) => r.rateShare >= 0.99)
  const newShare = newWords.reduce((a, r) => a + r.cost, 0) / Math.max(cost, 1e-9)

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.words.toLocaleString()} words · paid at {(r.rateShare * 100).toFixed(0)}%
              </span>
            </div>
            {/* words and cost on ONE scale, so the discount is visible as the
                distance between them rather than as a number in a column */}
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div className="absolute inset-y-0 rounded-[2px] bg-foreground/22" style={{ width: `${(r.words / maxWords) * 100}%` }} title={`${r.words.toLocaleString()} words`} />
              <div className="absolute inset-y-0 rounded-[2px] bg-foreground" style={{ width: `${(r.words * r.rateShare / maxWords) * 100}%` }} title={`${money(r.cost)}`} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {money(r.cost)} of {money(r.fullCost)} at full rate · {((r.cost / Math.max(cost, 1e-9)) * 100).toFixed(0)}% of the invoice
            </span>
          </li>
        ))}
      </ul>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Words</dt>
          <dd className="font-medium tabular-nums">{words.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Cost</dt>
          <dd className="font-medium tabular-nums">{money(cost)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Leverage</dt>
          <dd className="font-medium tabular-nums">{(leverage * 100).toFixed(0)}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Effective rate</dt>
          <dd className="font-medium tabular-nums">{effectiveRate.toFixed(3)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Pale is the word count and solid is what it is PAID at, so the gap between them is the discount · the memory
        removes {(leverage * 100).toFixed(0)}% of {money(fullCost)}, which is an effective{" "}
        {effectiveRate.toFixed(3)} a word rather than the {ratePerWord.toFixed(3)} on the rate card ·{" "}
        {(newShare * 100).toFixed(0)}% of the invoice is new words, so a leverage percentage improves fastest by
        writing less source text rather than by negotiating the bands
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * QaTypology — review findings by category, NORMALISED per thousand
 * words. A raw error count ranks the biggest file, which is the one
 * observation this report must not make.
 * ------------------------------------------------------------------ */
export function QaTypology({
  locales,
  categories,
  findings,
  wordCounts,
  threshold,
  className = "",
}: {
  locales: string[]
  categories: string[]
  /** findings[locale][category] */
  findings: number[][]
  /** words reviewed per locale */
  wordCounts: number[]
  /** errors per thousand words above which a locale fails */
  threshold?: number
  className?: string
}) {
  const rates = findings.map((row, i) => row.map((v) => (v / Math.max(wordCounts[i], 1)) * 1000))
  const totals = rates.map((row) => row.reduce((a, v) => a + v, 0))
  const max = Math.max(...rates.flat())
  const failing = threshold === undefined ? [] : totals.map((t, i) => ({ t, i })).filter((x) => x.t > threshold)
  const byCategory = categories.map((_, ci) => rates.reduce((a, row) => a + row[ci], 0))
  const worstCat = byCategory.indexOf(Math.max(...byCategory))
  const rawTotals = findings.map((row) => row.reduce((a, v) => a + v, 0))
  const rawWorst = rawTotals.indexOf(Math.max(...rawTotals))
  const rateWorst = totals.indexOf(Math.max(...totals))

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-[10px] tabular-nums">
          <thead>
            <tr>
              <th className="sticky left-0 bg-background pr-2 text-left font-normal text-muted-foreground">locale</th>
              {categories.map((c) => (
                <th key={c} className="px-1 pb-1 font-normal text-muted-foreground">
                  {c}
                </th>
              ))}
              <th className="pl-2 text-right font-normal text-muted-foreground">per 1k</th>
            </tr>
          </thead>
          <tbody>
            {locales.map((l, li) => (
              <tr key={l}>
                <td className="sticky left-0 bg-background pr-2 whitespace-nowrap">
                  {l}
                  <span className="ml-1 text-muted-foreground">{(wordCounts[li] / 1000).toFixed(0)}k</span>
                </td>
                {categories.map((c, ci) => {
                  const v = rates[li][ci]
                  return (
                    <td key={c} className="p-px">
                      <div
                        className="flex h-6 items-center justify-center rounded-[2px]"
                        style={{ background: `color-mix(in oklch, currentColor ${clamp((v / Math.max(max, 1e-9)) * 82, 3, 82).toFixed(0)}%, transparent)` }}
                        title={`${l} · ${c}: ${findings[li][ci]} findings, ${v.toFixed(2)} per 1k words`}
                      >
                        <span className={v / Math.max(max, 1e-9) > 0.62 ? "text-background" : undefined}>{v.toFixed(1)}</span>
                      </div>
                    </td>
                  )
                })}
                <td
                  className="pl-2 text-right font-medium"
                  style={{ textDecoration: threshold !== undefined && totals[li] > threshold ? "underline" : undefined }}
                >
                  {totals[li].toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Cells are findings per THOUSAND WORDS, never counts — a raw count ranks whichever locale had the most text
        reviewed, which is the one thing this report must not say ·{" "}
        {rawWorst === rateWorst
          ? `${locales[rawWorst]} is worst on both the count and the rate`
          : `${locales[rawWorst]} has the most findings and ${locales[rateWorst]} has the worst rate, and they are different locales`}{" "}
        · {categories[worstCat].toLowerCase()} is the largest category across the set
        {threshold !== undefined
          ? ` · ${failing.length} locale${failing.length === 1 ? "" : "s"} above the ${threshold} per 1k threshold, underlined`
          : ""}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * PluralCoverage — whether a string set can express each locale's
 * plural forms. Languages with more than two forms exist, and a
 * string written with one and other silently reads as nonsense.
 * ------------------------------------------------------------------ */
export function PluralCoverage({
  locales,
  formsProvided,
  className = "",
}: {
  /** each locale and the CLDR plural categories it actually uses */
  locales: { name: string; required: string[] }[]
  /** the categories the string catalogue supplies, per locale */
  formsProvided: Record<string, string[]>
  className?: string
}) {
  const allForms = ["zero", "one", "two", "few", "many", "other"]
  const rows = locales.map((l) => {
    const have = formsProvided[l.name] ?? []
    const missing = l.required.filter((f) => !have.includes(f))
    const extra = have.filter((f) => !l.required.includes(f))
    return { ...l, have, missing, extra, ok: missing.length === 0 }
  })
  const broken = rows.filter((r) => !r.ok)
  const complex = rows.filter((r) => r.required.length > 2)

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-[10px]">
          <thead>
            <tr>
              <th className="sticky left-0 bg-background pr-2 text-left font-normal text-muted-foreground">locale</th>
              {allForms.map((f) => (
                <th key={f} className="px-1 pb-1 font-normal text-muted-foreground">
                  {f}
                </th>
              ))}
              <th className="pl-2 text-right font-normal text-muted-foreground">forms</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td className="sticky left-0 bg-background pr-2 whitespace-nowrap">{r.name}</td>
                {allForms.map((f) => {
                  const needed = r.required.includes(f)
                  const supplied = r.have.includes(f)
                  return (
                    <td key={f} className="p-px">
                      {/* three states, distinguished by GLYPH and fill, never by
                          colour: needed and supplied, needed and missing, and
                          not needed at all */}
                      <div
                        className="flex h-6 items-center justify-center rounded-[2px] tabular-nums"
                        style={{
                          background: !needed
                            ? "transparent"
                            : supplied
                              ? "color-mix(in oklch, currentColor 22%, transparent)"
                              : "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)",
                          outline: needed && !supplied ? "1px solid currentColor" : undefined,
                          outlineOffset: -1,
                        }}
                        title={`${r.name} · ${f}: ${!needed ? "not used" : supplied ? "supplied" : "MISSING"}`}
                      >
                        {!needed ? "·" : supplied ? "✓" : "!"}
                      </div>
                    </td>
                  )
                })}
                <td className="pl-2 text-right tabular-nums">
                  {r.have.length}/{r.required.length}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        A catalogue is complete for a locale only when it supplies every category that locale USES — ✓ supplied, !
        missing, · not used by this language ·{" "}
        {broken.length === 0
          ? "every locale here is covered"
          : `${broken.length} locale${broken.length === 1 ? " is" : "s are"} short: ${broken.map((r) => `${r.name} (${r.missing.join(", ")})`).join("; ")}`}{" "}
        · {complex.length} of {rows.length} need more than two forms, which is the case a string written as one and
        other cannot express — it does not error, it just reads as nonsense to a reader who will not report it
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * LocaleReadiness — how much of the product each locale actually
 * covers, weighted by where the strings are. A percentage over all
 * strings hides a fully translated product with an English checkout.
 * ------------------------------------------------------------------ */
export function LocaleReadiness({
  locales,
  surfaces,
  className = "",
}: {
  /** translated counts per surface, per locale */
  locales: { name: string; translated: number[] }[]
  /** each surface's total strings and how much traffic it carries */
  surfaces: { name: string; strings: number; weight: number }[]
  className?: string
}) {
  const totalStrings = surfaces.reduce((a, s) => a + s.strings, 0)
  const totalWeight = surfaces.reduce((a, s) => a + s.weight, 0)
  const rows = locales
    .map((l) => {
      const done = l.translated.reduce((a, v) => a + v, 0)
      const raw = done / Math.max(totalStrings, 1)
      const weighted = surfaces.reduce(
        (a, s, i) => a + (l.translated[i] / Math.max(s.strings, 1)) * (s.weight / Math.max(totalWeight, 1)),
        0,
      )
      // the weakest surface is the one with the biggest weighted SHORTFALL —
      // ranking on cover×weight picks whichever surface is small rather than
      // whichever is missing, and named a fully translated help centre as the gap
      const worstIdx = surfaces
        .map((s, i) => ({ i, cover: l.translated[i] / Math.max(s.strings, 1), weight: s.weight }))
        .sort((a, b) => (1 - b.cover) * b.weight - (1 - a.cover) * a.weight)[0]
      return { ...l, raw, weighted, worst: surfaces[worstIdx.i], worstCover: worstIdx.cover }
    })
    .sort((a, b) => b.weighted - a.weighted)
  const flattered = rows.filter((r) => r.raw - r.weighted > 0.05)

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {(r.raw * 100).toFixed(0)}% of strings · {(r.weighted * 100).toFixed(0)}% weighted
              </span>
            </div>
            <div className="mt-0.5 flex gap-px">
              {surfaces.map((s, i) => {
                const cover = r.translated[i] / Math.max(s.strings, 1)
                return (
                  <div
                    key={s.name}
                    className="relative h-5 min-w-0 rounded-[1px] bg-muted"
                    style={{ flexGrow: s.weight, flexBasis: 0 }}
                    title={`${s.name}: ${r.translated[i]} of ${s.strings} (${(cover * 100).toFixed(0)}%)`}
                  >
                    <div className="absolute inset-y-0 left-0 rounded-[1px] bg-foreground/65" style={{ width: `${cover * 100}%` }} />
                  </div>
                )
              })}
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              weakest: {r.worst.name} at {(r.worstCover * 100).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
      {/* a legend, not an axis: a label under a slice proportional to traffic is
          truncated on exactly the surfaces whose share is small */}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-muted-foreground tabular-nums">
        {surfaces.map((s) => (
          <span key={s.name}>
            {s.name} · {((s.weight / Math.max(totalWeight, 1)) * 100).toFixed(0)}%
          </span>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Each surface's width is the TRAFFIC it carries, not its string count, so a locale's bar reads as the share of
        the product a customer actually meets ·{" "}
        {flattered.length === 0
          ? "no locale's headline percentage flatters it by more than five points"
          : `${flattered.map((r) => r.name).join(", ")} read higher on a plain string count than on this — ${flattered[0].name} is ${(flattered[0].raw * 100).toFixed(0)}% of strings and ${(flattered[0].weighted * 100).toFixed(0)}% of the journey, because ${flattered[0].worst.name.toLowerCase()} is where the gap is`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * TermConsistency — how many different renderings each source term
 * has acquired, per locale. A glossary says what a term SHOULD be;
 * this is what the memory actually contains.
 * ------------------------------------------------------------------ */
export function TermConsistency({
  terms,
  className = "",
}: {
  /** each term's variant counts by locale, with the approved rendering's share */
  terms: { source: string; locales: { name: string; variants: number; approvedShare: number; uses: number }[] }[]
  className?: string
}) {
  const rows = terms
    .map((t) => {
      const uses = t.locales.reduce((a, l) => a + l.uses, 0)
      const weightedApproved = t.locales.reduce((a, l) => a + l.approvedShare * l.uses, 0) / Math.max(uses, 1)
      const worst = t.locales.reduce((a, l) => (l.approvedShare < a.approvedShare ? l : a), t.locales[0])
      const maxVariants = Math.max(...t.locales.map((l) => l.variants))
      return { ...t, uses, weightedApproved, worst, maxVariants, offGlossary: uses * (1 - weightedApproved) }
    })
    .sort((a, b) => b.offGlossary - a.offGlossary)
  const totalUses = rows.reduce((a, r) => a + r.uses, 0)
  const totalOff = rows.reduce((a, r) => a + r.offGlossary, 0)
  const maxV = Math.max(...rows.flatMap((r) => r.locales.map((l) => l.variants)))

  return (
    <div className={className}>
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.source}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate font-medium">{r.source}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.uses.toLocaleString()} uses · {(r.weightedApproved * 100).toFixed(0)}% on glossary
              </span>
            </div>
            <ul className="mt-0.5 space-y-0.5">
              {r.locales.map((l) => (
                <li key={l.name} className="flex items-center gap-2 text-[9px] tabular-nums">
                  <span className="w-12 shrink-0 truncate text-muted-foreground">{l.name}</span>
                  {/* one mark per distinct rendering, filled for the approved one:
                      a count in a column does not read as "five different words" */}
                  <span className="flex w-20 shrink-0 gap-px">
                    {Array.from({ length: Math.min(l.variants, 8) }, (_, i) => (
                      <span
                        key={i}
                        className="h-2.5 w-2 rounded-[1px]"
                        style={{ background: i === 0 ? "currentColor" : "color-mix(in oklch, currentColor 26%, transparent)" }}
                      />
                    ))}
                    {l.variants > 8 && <span className="text-muted-foreground">+{l.variants - 8}</span>}
                  </span>
                  <div className="h-1.5 flex-1 rounded-[1px] bg-muted">
                    <div className="h-full rounded-[1px] bg-foreground/60" style={{ width: `${l.approvedShare * 100}%` }} />
                  </div>
                  <span className="w-24 shrink-0 text-right text-muted-foreground">
                    {l.variants} renderings · {(l.approvedShare * 100).toFixed(0)}%
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Each mark is a DISTINCT rendering found in the memory, filled for the approved one, and the bar is how often it
        was used — a glossary states what a term should be and this is what the memory contains ·{" "}
        {Math.round(totalOff).toLocaleString()} of {totalUses.toLocaleString()} uses are off-glossary,{" "}
        {((totalOff / Math.max(totalUses, 1)) * 100).toFixed(0)}% · {rows[0].source} is the worst offender, with{" "}
        {rows[0].maxVariants} renderings at its worst in {rows[0].worst.name} · terms drift most where a locale has
        several translators and no query log, and it is invisible in every per-file review
      </p>
    </div>
  )
}
