/**
 * Nutrition primitives — macronutrient split, nutrient density, glycaemic
 * load, portion scaling, deficiency risk and cost per nutrient.
 *
 * Energy from the macros, density per hundred calories, glycaemic load from
 * index and available carbohydrate, the scaled recipe, the shortfall against a
 * reference intake and the cheapest source of each nutrient are all DERIVED.
 * A macro split stated as percentages that do not match the grams is the
 * commonest error in this whole subject, and computing it makes that visible.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

const KCAL = { protein: 4, carbohydrate: 4, fat: 9, alcohol: 7, fibre: 2 } as const

/* ------------------------------------------------------------------ *
 * MacroSplit — energy from each macronutrient, computed from the grams
 * so the percentages cannot disagree with the food.
 * ------------------------------------------------------------------ */
export function MacroSplit({
  meals,
  targetPercent,
  className = "",
}: {
  meals: { name: string; proteinG: number; carbG: number; fatG: number; fibreG?: number; alcoholG?: number }[]
  /** the split being aimed at, as percentages of energy */
  targetPercent?: { protein: number; carbohydrate: number; fat: number }
  className?: string
}) {
  const rows = meals.map((m) => {
    const kcal = {
      protein: m.proteinG * KCAL.protein,
      carbohydrate: Math.max(0, m.carbG - (m.fibreG ?? 0)) * KCAL.carbohydrate,
      fat: m.fatG * KCAL.fat,
      fibre: (m.fibreG ?? 0) * KCAL.fibre,
      alcohol: (m.alcoholG ?? 0) * KCAL.alcohol,
    }
    const total = Object.values(kcal).reduce((a, v) => a + v, 0)
    return { ...m, kcal, total }
  })
  const dayKcal = rows.reduce((a, r) => a + r.total, 0)
  const dayMacro = {
    protein: rows.reduce((a, r) => a + r.kcal.protein, 0),
    carbohydrate: rows.reduce((a, r) => a + r.kcal.carbohydrate + r.kcal.fibre, 0),
    fat: rows.reduce((a, r) => a + r.kcal.fat, 0),
    alcohol: rows.reduce((a, r) => a + r.kcal.alcohol, 0),
  }
  const pct = (v: number) => (v / Math.max(dayKcal, 1)) * 100
  const fills: [keyof typeof dayMacro, string, string][] = [
    ["protein", "Protein", "currentColor"],
    ["carbohydrate", "Carbohydrate", "color-mix(in oklch, currentColor 38%, transparent)"],
    ["fat", "Fat", "repeating-linear-gradient(45deg, currentColor 0 1.5px, transparent 1.5px 5px)"],
    ["alcohol", "Alcohol", "repeating-linear-gradient(-45deg, currentColor 0 1.5px, transparent 1.5px 4px)"],
  ]

  return (
    <div className={className}>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">{Math.round(r.total)} kcal</span>
            </div>
            <div className="mt-0.5 flex h-4 overflow-hidden rounded-[2px]" style={{ width: `${(r.total / Math.max(...rows.map((x) => x.total))) * 100}%` }}>
              {fills.map(([k, label, bg]) => {
                const v = k === "carbohydrate" ? r.kcal.carbohydrate + r.kcal.fibre : r.kcal[k as keyof typeof r.kcal]
                if (!v) return null
                return <div key={label} style={{ flex: `${v} 0 0`, background: bg }} title={`${label} ${Math.round(v)} kcal`} />
              })}
            </div>
          </li>
        ))}
      </ul>
      <ul className="mt-2 space-y-0.5 text-[10px] tabular-nums">
        {fills.map(([k, label, bg]) => (
          <li key={label} className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-[2px] border border-foreground/35" style={{ background: bg }} aria-hidden />
            <span className="w-24 shrink-0">{label}</span>
            <span className="text-muted-foreground">
              {pct(dayMacro[k]).toFixed(0)}% of energy
              {targetPercent && k !== "alcohol"
                ? ` · target ${targetPercent[k as "protein" | "carbohydrate" | "fat"]}%`
                : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        {Math.round(dayKcal)} kcal computed from the grams at 4/4/9 (and 2 for fibre, 7 for alcohol), so the
        percentages cannot disagree with the food ·{" "}
        {dayMacro.alcohol > 0
          ? `alcohol is ${pct(dayMacro.alcohol).toFixed(0)}% of the energy and belongs in the denominator, which most splits quietly leave out`
          : "no alcohol in this day"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * NutrientDensity — nutrients per hundred calories rather than per
 * hundred grams, which is the comparison that survives portion size.
 * ------------------------------------------------------------------ */
export function NutrientDensity({
  foods,
  nutrients,
  className = "",
}: {
  /** amounts per 100 g, plus the energy in those 100 g */
  foods: { name: string; kcalPer100g: number; per100g: Record<string, number> }[]
  /** each nutrient and the daily reference intake it is scored against */
  nutrients: { key: string; label: string; reference: number; unit: string }[]
  className?: string
}) {
  const rows = foods.map((f) => {
    const perKcal = nutrients.map((n) => {
      const per100g = f.per100g[n.key] ?? 0
      const per100kcal = (per100g * 100) / Math.max(f.kcalPer100g, 1e-9)
      return { ...n, per100g, per100kcal, riPer100kcal: per100kcal / Math.max(n.reference, 1e-9) }
    })
    const score = perKcal.reduce((a, p) => a + clamp(p.riPer100kcal, 0, 0.5), 0) / Math.max(nutrients.length, 1)
    return { ...f, perKcal, score }
  })
  const ordered = [...rows].sort((a, b) => b.score - a.score)
  const byWeight = [...rows].sort(
    (a, b) =>
      nutrients.reduce((acc, n) => acc + (b.per100g[n.key] ?? 0) / Math.max(n.reference, 1e-9), 0) -
      nutrients.reduce((acc, n) => acc + (a.per100g[n.key] ?? 0) / Math.max(n.reference, 1e-9), 0),
  )
  const flipped = byWeight[0]?.name !== ordered[0]?.name
  const maxScore = Math.max(0.001, ...rows.map((r) => r.score))

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-[10px]">
          <thead>
            <tr>
              <th className="pr-1.5 pb-1 text-left font-normal text-muted-foreground">per 100 kcal</th>
              {nutrients.map((n) => (
                <th key={n.key} className="px-0.5 pb-1 font-medium">
                  <span className="block max-w-[3.5rem] truncate">{n.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordered.map((f) => (
              <tr key={f.name}>
                <th className="pr-1.5 text-left font-normal whitespace-nowrap">{f.name}</th>
                {f.perKcal.map((p) => (
                  <td key={p.key} className="p-px">
                    <div
                      className="flex h-6 items-center justify-center rounded-[2px] tabular-nums"
                      style={{
                        background: `color-mix(in oklch, currentColor ${clamp(p.riPer100kcal * 180, 0, 82).toFixed(0)}%, transparent)`,
                      }}
                      title={`${p.per100kcal.toFixed(1)} ${p.unit} per 100 kcal — ${(p.riPer100kcal * 100).toFixed(0)}% of the daily reference`}
                    >
                      {/* colour on the child, or currentColor in the background
                          above resolves to it and the densest row goes blank */}
                      <span style={{ color: p.riPer100kcal > 0.35 ? "var(--background)" : undefined }}>
                        {(p.riPer100kcal * 100).toFixed(0)}
                      </span>
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mt-2 space-y-0.5 text-[10px] tabular-nums">
        {ordered.map((f) => (
          <li key={f.name} className="flex items-center gap-2">
            <span className="w-28 shrink-0 truncate">{f.name}</span>
            <div className="h-1.5 flex-1 rounded-[1px] bg-muted">
              <div className="h-full rounded-[1px] bg-foreground" style={{ width: `${(f.score / maxScore) * 100}%` }} />
            </div>
            <span className="w-20 shrink-0 text-right text-muted-foreground">{f.kcalPer100g} kcal/100 g</span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Cells are the percentage of a daily reference intake carried by 100 kcal of the food, not by 100 g ·{" "}
        {flipped
          ? `${byWeight[0]?.name} wins per hundred grams and ${ordered[0]?.name} wins per calorie — which of those is the right comparison depends entirely on whether the energy is wanted`
          : `${ordered[0]?.name} leads on both measures`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * GlycemicLoad — index times available carbohydrate. The load is what
 * matters and it is derived, because a high index in a small portion is
 * not the same thing at all.
 * ------------------------------------------------------------------ */
export function GlycemicLoad({
  foods,
  className = "",
}: {
  foods: { name: string; glycemicIndex: number; portionG: number; carbPer100g: number; fibrePer100g?: number }[]
  className?: string
}) {
  const rows = foods.map((f) => {
    const available = ((f.carbPer100g - (f.fibrePer100g ?? 0)) * f.portionG) / 100
    return { ...f, available, load: (f.glycemicIndex * available) / 100 }
  })
  const byIndex = [...rows].sort((a, b) => b.glycemicIndex - a.glycemicIndex)
  const byLoad = [...rows].sort((a, b) => b.load - a.load)
  const flipped = byIndex[0]?.name !== byLoad[0]?.name
  const maxIndex = Math.max(...rows.map((r) => r.glycemicIndex))
  const maxLoad = Math.max(...rows.map((r) => r.load))
  const total = rows.reduce((a, r) => a + r.load, 0)

  return (
    <div className={className}>
      <ul className="space-y-2">
        {byLoad.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.portionG} g · {r.available.toFixed(0)} g available carbohydrate
              </span>
            </div>
            <div className="mt-0.5 space-y-px">
              <div className="h-2.5 rounded-[1px] bg-muted">
                <div
                  className="h-full rounded-[1px] border border-foreground/50"
                  style={{ width: `${(r.glycemicIndex / maxIndex) * 100}%`, background: "repeating-linear-gradient(135deg, currentColor 0 1.5px, transparent 1.5px 5px)" }}
                />
              </div>
              <div className="h-2.5 rounded-[1px] bg-muted">
                <div className="h-full rounded-[1px] bg-foreground" style={{ width: `${(r.load / maxLoad) * 100}%` }} />
              </div>
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              GI {r.glycemicIndex} · load {r.load.toFixed(1)} ·{" "}
              {r.load < 10 ? "low load" : r.load < 20 ? "medium load" : "high load"}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Hatched is the glycaemic index, solid is the load actually eaten · total load {total.toFixed(0)} ·{" "}
        {flipped
          ? `${byIndex[0]?.name} has the highest index but ${byLoad[0]?.name} carries the highest load, because the load is index × the carbohydrate actually on the plate`
          : `${byLoad[0]?.name} leads on both, which is unusual`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * PortionScale — a recipe scaled, with the awkward quantities flagged
 * because "0.37 of an egg" is where a scaled recipe stops working.
 * ------------------------------------------------------------------ */
export function PortionScale({
  ingredients,
  baseServings,
  targetServings,
  className = "",
}: {
  ingredients: { name: string; quantity: number; unit: string; indivisible?: boolean }[]
  baseServings: number
  targetServings: number
  className?: string
}) {
  const factor = targetServings / Math.max(baseServings, 1)
  const rows = ingredients.map((i) => {
    const raw = i.quantity * factor
    const rounded = i.indivisible ? Math.round(raw) : Math.round(raw * 10) / 10
    const drift = i.indivisible && raw > 0 ? Math.abs(rounded - raw) / raw : 0
    return { ...i, raw, rounded, drift, awkward: i.indivisible === true && drift > 0.12 }
  })
  const awkward = rows.filter((r) => r.awkward)
  const max = Math.max(...rows.map((r) => Math.max(r.quantity, r.raw)))

  return (
    <div className={className}>
      <div className="mb-2 flex items-baseline justify-between text-[11px]">
        <span className="font-medium">
          {baseServings} → {targetServings} servings
        </span>
        <span className="tabular-nums text-muted-foreground">×{factor.toFixed(2)}</span>
      </div>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-2">
            <span className="w-28 shrink-0 truncate text-[10px]">{r.name}</span>
            <div className="relative h-4 flex-1 rounded-[2px] bg-muted">
              <div className="absolute inset-y-0 rounded-[2px] bg-foreground/22" style={{ width: `${(r.quantity / max) * 100}%` }} />
              <div
                className="absolute inset-y-1 rounded-[1px]"
                style={{
                  width: `${(r.raw / max) * 100}%`,
                  background: r.awkward ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)" : "currentColor",
                  outline: r.awkward ? "1px solid currentColor" : undefined,
                  outlineOffset: -1,
                }}
              />
            </div>
            <span className="w-32 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
              {r.quantity} → {r.rounded} {r.unit}
              {r.awkward ? ` (${r.raw.toFixed(2)})` : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Pale is the original quantity, solid is scaled ·{" "}
        {awkward.length
          ? `${awkward.map((a) => a.name).join(", ")} ${awkward.length === 1 ? "does" : "do"} not divide — rounding ${awkward.map((a) => `${a.name} to ${a.rounded}`).join(", ")} shifts it by up to ${(Math.max(...awkward.map((a) => a.drift)) * 100).toFixed(0)}%, which is what actually changes the result`
          : "every indivisible ingredient scales to a whole number"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * DeficiencyRisk — intake against the reference and the lower threshold,
 * with the probability of inadequacy read off the distribution rather
 * than declared from the mean.
 * ------------------------------------------------------------------ */
export function DeficiencyRisk({
  nutrients,
  className = "",
}: {
  nutrients: {
    label: string
    meanIntake: number
    sdIntake: number
    /** the estimated average requirement, which is what inadequacy is judged against */
    requirement: number
    unit: string
  }[]
  className?: string
}) {
  // P(intake < requirement) under a normal intake distribution
  const normalCdf = (z: number) => {
    const t = 1 / (1 + 0.2316419 * Math.abs(z))
    const d = 0.3989423 * Math.exp((-z * z) / 2)
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
    return z > 0 ? 1 - p : p
  }
  const rows = nutrients.map((n) => {
    const z = (n.requirement - n.meanIntake) / Math.max(n.sdIntake, 1e-9)
    return { ...n, risk: clamp(normalCdf(z), 0, 1), ratio: n.meanIntake / Math.max(n.requirement, 1e-9) }
  })
  const ordered = [...rows].sort((a, b) => b.risk - a.risk)
  const adequateMean = rows.filter((r) => r.ratio >= 1 && r.risk > 0.1)

  return (
    <div className={className}>
      <ul className="space-y-2">
        {ordered.map((r) => (
          <li key={r.label}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span>{r.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.meanIntake} ± {r.sdIntake} {r.unit} against {r.requirement}
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div
                className="h-full rounded-[2px]"
                style={{
                  width: `${r.risk * 100}%`,
                  background: r.risk > 0.1 ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)" : "color-mix(in oklch, currentColor 45%, transparent)",
                  outline: r.risk > 0.1 ? "1px solid currentColor" : undefined,
                  outlineOffset: -1,
                }}
              />
              <span className="absolute inset-y-0 w-0.5 bg-foreground/60" style={{ left: "10%" }} title="10% prevalence" />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              <span aria-hidden>{r.risk > 0.1 ? "✗" : "✓"}</span> {(r.risk * 100).toFixed(0)}% of the group falls below
              requirement · mean is {r.ratio.toFixed(2)}× the requirement
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        Prevalence is computed from the intake distribution, not from the mean ·{" "}
        {adequateMean.length
          ? `${adequateMean.map((a) => a.label).join(", ")} ${adequateMean.length === 1 ? "has" : "have"} a mean intake above the requirement and still leave more than a tenth of the group short — a group mean cannot answer this question`
          : "no nutrient has an adequate mean hiding an inadequate spread"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * CostPerNutrient — the cheapest source of each nutrient, computed
 * rather than reasoned about, which is how food budgets are set.
 * ------------------------------------------------------------------ */
export function CostPerNutrient({
  foods,
  nutrient,
  unit,
  reference,
  className = "",
}: {
  foods: { name: string; pricePerKg: number; amountPer100g: number; kcalPer100g?: number }[]
  nutrient: string
  unit: string
  /** the daily reference intake, so the cost of a day's worth is derivable */
  reference: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!foods.length) return null

  const rows = foods
    .map((f) => {
      const perKg = f.amountPer100g * 10
      const costPerUnit = f.pricePerKg / Math.max(perKg, 1e-9)
      return { ...f, perKg, costPerUnit, costPerDay: costPerUnit * reference, gramsPerDay: (reference / Math.max(f.amountPer100g, 1e-9)) * 100 }
    })
    .sort((a, b) => a.costPerDay - b.costPerDay)
  const max = Math.max(...rows.map((r) => r.costPerDay))
  const cheapest = rows[0]
  // A source is impractical on EITHER axis: nobody eats 500 g of one food a
  // day, and nobody spends 1,300 kcal on a single mineral. A grams-only test
  // at 800 g never fired, which left the caption contradicting the card.
  const kcalPerDay = (r: (typeof rows)[number]) => (r.gramsPerDay * (r.kcalPer100g ?? 0)) / 100
  const impractical = rows.filter((r) => r.gramsPerDay > 450 || kcalPerDay(r) > 1200)

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                ${r.pricePerKg.toFixed(2)}/kg · {r.amountPer100g} {unit}/100 g
              </span>
            </div>
            <div className="mt-0.5 h-4 rounded-[2px] bg-muted">
              <div
                className="h-full rounded-[2px]"
                style={{
                  width: `${(r.costPerDay / max) * 100}%`,
                  background: impractical.includes(r) ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)" : "color-mix(in oklch, currentColor 52%, transparent)",
                  outline: impractical.includes(r) ? "1px solid currentColor" : undefined,
                  outlineOffset: -1,
                }}
              />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              ${r.costPerDay.toFixed(2)} for a day's {nutrient} · which means eating {Math.round(r.gramsPerDay)} g of it
              {r.kcalPer100g ? ` (${Math.round((r.gramsPerDay * r.kcalPer100g) / 100)} kcal)` : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        {cheapest.name} is the cheapest source at ${cheapest.costPerDay.toFixed(2)} a day ·{" "}
        {impractical.length
          ? `${impractical.map((i) => i.name).join(", ")} would need over 450 g or 1,200 kcal a day to reach the reference, which is a price per gram nobody can act on — hatched rows are cheap only on paper`
          : "every source reaches the reference in a portion somebody would actually eat"}
      </p>
    </div>
  )
}
