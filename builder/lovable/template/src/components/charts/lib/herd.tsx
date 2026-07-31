/**
 * Herd-health primitives — body condition, lactation, fertility, mastitis,
 * mobility and vaccination cover.
 *
 * The condition loss through early lactation, persistency, the calving index
 * and its cost, the bulk-tank cell count each cow contributes, the herd
 * mobility score and the proportion of the herd actually protected are all
 * DERIVED. A herd average hides the individual, which is the whole problem.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/* ------------------------------------------------------------------ *
 * BodyCondition — score against days in milk, with the early-lactation
 * loss computed per cow because that loss is what costs the next
 * pregnancy.
 * ------------------------------------------------------------------ */
export function BodyCondition({
  cows,
  target,
  maxLoss = 0.75,
  height = 210,
  className = "",
}: {
  /** repeated scores through the lactation */
  cows: { id: string; scores: { dim: number; bcs: number }[] }[]
  /** the target curve, as score at each stage */
  target: { dim: number; bcs: number }[]
  /** loss from calving beyond which fertility suffers */
  maxLoss?: number
  height?: number
  className?: string
}) {
  const rows = cows.map((c) => {
    const sorted = [...c.scores].sort((a, b) => a.dim - b.dim)
    const atCalving = sorted[0]?.bcs ?? 0
    const nadir = sorted.reduce((a, s) => (s.bcs < a.bcs ? s : a), sorted[0])
    return { ...c, sorted, atCalving, nadir, loss: atCalving - (nadir?.bcs ?? 0) }
  })
  const excessive = rows.filter((r) => r.loss > maxLoss)
  const maxDim = Math.max(...cows.flatMap((c) => c.scores.map((s) => s.dim)), ...target.map((t) => t.dim))
  const px = (d: number) => (d / maxDim) * 100
  const py = (b: number) => 100 - ((b - 1.5) / 3.5) * 100

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polyline
            points={target.map((t) => `${px(t.dim)},${py(t.bcs)}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.4}
            strokeDasharray="5 3"
            opacity={0.65}
            vectorEffect="non-scaling-stroke"
          />
          {rows.map((r) => (
            <polyline
              key={r.id}
              points={r.sorted.map((s) => `${px(s.dim)},${py(s.bcs)}`).join(" ")}
              fill="none"
              stroke="currentColor"
              strokeWidth={r.loss > maxLoss ? 1.3 : 0.7}
              opacity={r.loss > maxLoss ? 1 : 0.45}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>calving</span>
        <span>{maxDim} days in milk</span>
      </div>
      <ul className="mt-2 space-y-0.5 text-[10px] tabular-nums">
        {rows
          .slice()
          .sort((a, b) => b.loss - a.loss)
          .map((r) => (
            <li key={r.id} className="flex items-center gap-2">
              <span aria-hidden className="w-3">
                {r.loss > maxLoss ? "▲" : "·"}
              </span>
              <span className="w-16 shrink-0 truncate">{r.id}</span>
              <span className="text-muted-foreground">
                {r.atCalving.toFixed(2)} at calving → {r.nadir?.bcs.toFixed(2)} at {r.nadir?.dim} DIM · lost{" "}
                {r.loss.toFixed(2)}
              </span>
            </li>
          ))}
      </ul>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Dashed is the target curve; heavy lines lost more than {maxLoss} of a score ·{" "}
        {excessive.length
          ? `${excessive.length} of ${cows.length} cows mobilised too much body reserve — that loss, not the nadir itself, is what predicts a missed service`
          : "no cow lost more than the threshold"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * MilkYield — the lactation curve with peak, persistency and the
 * 305-day total computed from the test-day records.
 * ------------------------------------------------------------------ */
export function MilkYield({
  records,
  height = 200,
  className = "",
}: {
  records: { dim: number; litres: number }[]
  height?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!records.length) return null

  const sorted = [...records].sort((a, b) => a.dim - b.dim)
  const peak = sorted.reduce((a, r) => (r.litres > a.litres ? r : a), sorted[0])
  // persistency: the fall per 30 days after peak, which is what decides total
  const after = sorted.filter((r) => r.dim > peak.dim)
  const persistency =
    after.length > 1
      ? ((after[after.length - 1].litres - after[0].litres) / Math.max(after[after.length - 1].dim - after[0].dim, 1)) * 30
      : 0
  // 305-day total by trapezoid over the test days, extrapolated at the persistency
  let total = 0
  for (let i = 1; i < sorted.length; i++) total += ((sorted[i].litres + sorted[i - 1].litres) / 2) * (sorted[i].dim - sorted[i - 1].dim)
  const last = sorted[sorted.length - 1]
  if (last.dim < 305) {
    const endLitres = Math.max(0, last.litres + (persistency / 30) * (305 - last.dim))
    total += ((last.litres + endLitres) / 2) * (305 - last.dim)
  }

  const max = Math.max(...sorted.map((r) => r.litres)) * 1.08
  const px = (d: number) => (d / 305) * 100
  const py = (l: number) => 100 - (l / max) * 100

  return (
    <div className={className}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <polygon points={`0,100 ${sorted.map((r) => `${px(r.dim)},${py(r.litres)}`).join(" ")} ${px(last.dim)},100`} fill="currentColor" opacity={0.12} />
          <polyline points={sorted.map((r) => `${px(r.dim)},${py(r.litres)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.3} vectorEffect="non-scaling-stroke" />
          {last.dim < 305 && (
            <polyline
              points={`${px(last.dim)},${py(last.litres)} 100,${py(Math.max(0, last.litres + (persistency / 30) * (305 - last.dim)))}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={1}
              strokeDasharray="3 2"
              opacity={0.6}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        <span
          className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground bg-background"
          style={{ left: `${px(peak.dim)}%`, top: `${py(peak.litres)}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>calving</span>
        <span>305 days</span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Peak</dt>
          <dd className="font-medium tabular-nums">
            {peak.litres.toFixed(1)} L at {peak.dim} d
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Persistency</dt>
          <dd className="font-medium tabular-nums">{persistency.toFixed(2)} L/30 d</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">305-day</dt>
          <dd className="font-medium tabular-nums">{Math.round(total).toLocaleString()} L</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        The dashed tail is extrapolated at the measured persistency, not assumed · every extra litre at peak is worth
        about 200 over the lactation, but a shallow decline is worth more than a high peak — this curve falls{" "}
        {Math.abs(persistency).toFixed(2)} L every thirty days
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * CalvingInterval — each cow's interval against the target, with the
 * cost of the extra days derived.
 * ------------------------------------------------------------------ */
export function CalvingInterval({
  cows,
  targetDays = 365,
  costPerExtraDay,
  className = "",
}: {
  cows: { id: string; intervalDays: number; parity?: number }[]
  targetDays?: number
  costPerExtraDay: number
  className?: string
}) {
  const rows = [...cows].sort((a, b) => b.intervalDays - a.intervalDays).map((c) => ({ ...c, over: c.intervalDays - targetDays }))
  const mean = cows.reduce((a, c) => a + c.intervalDays, 0) / Math.max(cows.length, 1)
  const totalOver = rows.reduce((a, r) => a + Math.max(0, r.over), 0)
  const axis = Math.max(...rows.map((r) => r.intervalDays), targetDays) * 1.04
  // the top decile is usually where most of the cost sits
  const worstTen = rows.slice(0, Math.max(1, Math.ceil(rows.length / 10)))
  const worstShare = worstTen.reduce((a, r) => a + Math.max(0, r.over), 0) / Math.max(totalOver, 1)

  return (
    <div className={className}>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-2">
            <span className="w-16 shrink-0 truncate text-[10px]">{r.id}</span>
            <div className="relative h-3.5 flex-1 rounded-[2px] bg-muted">
              <div className="absolute inset-y-0 rounded-l-[2px] bg-foreground/35" style={{ width: `${(Math.min(r.intervalDays, targetDays) / axis) * 100}%` }} />
              {r.over > 0 && (
                <div
                  className="absolute inset-y-0 border-y border-r border-foreground"
                  style={{ left: `${(targetDays / axis) * 100}%`, width: `${(r.over / axis) * 100}%`, background: "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)" }}
                />
              )}
              <span className="absolute inset-y-0 w-0.5 bg-foreground/70" style={{ left: `${(targetDays / axis) * 100}%` }} />
            </div>
            <span className="w-28 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
              {r.intervalDays} d{r.over > 0 ? ` · +${r.over}` : ""}
            </span>
          </li>
        ))}
      </ul>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Mean interval</dt>
          <dd className="font-medium tabular-nums">{mean.toFixed(0)} d</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Days over</dt>
          <dd className="font-medium tabular-nums">{totalOver}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Cost</dt>
          <dd className="font-medium tabular-nums">${Math.round(totalOver * costPerExtraDay).toLocaleString()}</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Hatched is the extension beyond {targetDays} days · the worst {worstTen.length} cow
        {worstTen.length === 1 ? "" : "s"} carry {(worstShare * 100).toFixed(0)}% of the total cost, which is why the
        herd mean is the wrong number to manage against
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * SomaticCell — each cow's contribution to the bulk tank, computed from
 * her count and her yield. A high-count cow giving five litres matters
 * far less than the arithmetic mean suggests.
 * ------------------------------------------------------------------ */
export function SomaticCell({
  cows,
  bulkLimit,
  height = 200,
  className = "",
}: {
  cows: { id: string; sccThousand: number; litres: number }[]
  /** the penalty threshold for the bulk tank, in thousands */
  bulkLimit: number
  height?: number
  className?: string
}) {
  const totalLitres = cows.reduce((a, c) => a + c.litres, 0)
  const bulk = cows.reduce((a, c) => a + c.sccThousand * c.litres, 0) / Math.max(totalLitres, 1)
  // Share of the TANK's cell load. Dividing by litres alone leaves a
  // concentration, which printed as "7774% of the tank".
  const totalLoad = cows.reduce((a, c) => a + c.sccThousand * c.litres, 0)
  const rows = cows
    .map((c) => ({ ...c, contribution: (c.sccThousand * c.litres) / Math.max(totalLoad, 1e-9) }))
    .sort((a, b) => b.contribution - a.contribution)
  const arithmeticMean = cows.reduce((a, c) => a + c.sccThousand, 0) / Math.max(cows.length, 1)
  // how much the bulk falls if the biggest contributors are taken out
  const withoutTop = (n: number) => {
    const keep = rows.slice(n)
    const l = keep.reduce((a, c) => a + c.litres, 0)
    return keep.reduce((a, c) => a + c.sccThousand * c.litres, 0) / Math.max(l, 1)
  }
  const needed = (() => {
    for (let n = 0; n <= rows.length; n++) if (withoutTop(n) <= bulkLimit) return n
    return rows.length
  })()

  const maxScc = Math.max(...cows.map((c) => c.sccThousand))
  const maxL = Math.max(...cows.map((c) => c.litres))

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height }}>
        <div className="absolute inset-x-0 border-t border-dashed border-foreground" style={{ top: `${100 - (bulkLimit / (maxScc * 1.05)) * 100}%` }} />
        {rows.map((r) => (
          <span
            key={r.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
            style={{
              left: `${(r.litres / (maxL * 1.06)) * 100}%`,
              top: `${100 - (r.sccThousand / (maxScc * 1.05)) * 100}%`,
              width: `${clamp(4 + r.contribution * 90, 4, 18)}px`,
              height: `${clamp(4 + r.contribution * 90, 4, 18)}px`,
              opacity: 0.55 + r.contribution * 3,
            }}
            title={`${r.id}: ${r.sccThousand}k at ${r.litres} L — ${(r.contribution * 100).toFixed(1)}% of the tank`}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>0 L</span>
        <span>{maxL} L/day</span>
      </div>
      <ul className="mt-2 space-y-0.5 text-[10px] tabular-nums">
        {rows.slice(0, 5).map((r) => (
          <li key={r.id} className="flex items-center gap-2">
            <span className="w-16 shrink-0 truncate">{r.id}</span>
            <div className="h-1.5 flex-1 rounded-[1px] bg-muted">
              <div className="h-full rounded-[1px] bg-foreground" style={{ width: `${(r.contribution / Math.max(rows[0].contribution, 1e-9)) * 100}%` }} />
            </div>
            <span className="w-40 shrink-0 text-right text-muted-foreground">
              {r.sccThousand}k at {r.litres} L · {(r.contribution * 100).toFixed(1)}% of the tank
            </span>
          </li>
        ))}
      </ul>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Bulk tank</dt>
          <dd className="font-medium tabular-nums">{Math.round(bulk)}k</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Cow average</dt>
          <dd className="font-medium tabular-nums">{Math.round(arithmeticMean)}k</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Limit</dt>
          <dd className="font-medium tabular-nums">{bulkLimit}k</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Marker size is each cow's share of the tank — the tank is a YIELD-weighted mean ({Math.round(bulk)}k), not the
        cow average ({Math.round(arithmeticMean)}k), so a high-count cow giving little barely moves it ·{" "}
        {bulk <= bulkLimit
          ? `the tank is inside the ${bulkLimit}k limit`
          : `withholding the top ${needed} cow${needed === 1 ? "" : "s"} brings the tank under ${bulkLimit}k`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * LamenessScore — the herd's mobility distribution over time, with the
 * new cases and the chronic tail separated.
 * ------------------------------------------------------------------ */
export function LamenessScore({
  rounds,
  height = 200,
  className = "",
}: {
  /** count at each mobility score, 0 = sound, at each scoring round */
  rounds: { label: string; counts: number[] }[]
  height?: number
  className?: string
}) {
  // Empty data is the ORDINARY case: useRows hands back [] before the query
  // settles and on a site whose owner has added nothing yet. Without this the
  // reduce below seeds undefined and the page dies at the error boundary.
  if (!rounds.length) return null

  const rows = rounds.map((r) => {
    const total = r.counts.reduce((a, v) => a + v, 0)
    const impaired = r.counts.slice(1).reduce((a, v) => a + v, 0)
    const severe = r.counts.slice(2).reduce((a, v) => a + v, 0)
    return { ...r, total, impaired, severe, rate: impaired / Math.max(total, 1), severeRate: severe / Math.max(total, 1) }
  })
  const first = rows[0]
  const last = rows[rows.length - 1]
  const trend = last.rate - first.rate
  const fills = [
    "color-mix(in oklch, currentColor 10%, transparent)",
    "color-mix(in oklch, currentColor 38%, transparent)",
    "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)",
    "currentColor",
  ]
  const labels = ["0 sound", "1 imperfect", "2 impaired", "3 severe"]

  return (
    <div className={className}>
      <div className="flex items-end gap-2" style={{ height }}>
        {rows.map((r) => (
          <div key={r.label} className="flex h-full flex-1 flex-col justify-end">
            {r.counts
              .map((v, i) => ({ v, i }))
              .reverse()
              .map(({ v, i }) => (
                <div
                  key={i}
                  className="w-full border-t border-foreground/25 first:border-t-0"
                  style={{ height: `${(v / Math.max(r.total, 1)) * 100}%`, background: fills[i % fills.length] }}
                  title={`${r.label} · ${labels[i]}: ${v}`}
                />
              ))}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        {rows.map((r) => (
          <span key={r.label} className="flex-1 truncate text-center text-[9px] text-muted-foreground">
            {r.label}
          </span>
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
        {labels.map((l, i) => (
          <li key={l} className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-[2px] border border-foreground/35" style={{ background: fills[i % fills.length] }} aria-hidden />
            {l}
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[10px] text-muted-foreground tabular-nums">
        {(last.rate * 100).toFixed(0)}% of the herd is score 1 or worse, {(last.severeRate * 100).toFixed(0)}% is score 2
        or worse ·{" "}
        {trend < -0.01
          ? `down ${Math.abs(trend * 100).toFixed(0)} points since ${first.label}`
          : trend > 0.01
            ? `up ${(trend * 100).toFixed(0)} points since ${first.label}`
            : `flat since ${first.label}`}{" "}
        — score 2 is where a cow is already losing yield, and it is the band that never resolves on its own
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * VaccinationCover — cover by group against the threshold the disease
 * actually needs, which is derived from R₀ rather than chosen.
 * ------------------------------------------------------------------ */
export function VaccinationCover({
  groups,
  basicReproduction,
  vaccineEfficacy = 0.9,
  className = "",
}: {
  groups: { name: string; animals: number; vaccinated: number }[]
  /** R₀ for the disease being protected against */
  basicReproduction: number
  vaccineEfficacy?: number
  className?: string
}) {
  // herd immunity threshold, adjusted for a vaccine that is not perfect
  const rawThreshold = 1 - 1 / Math.max(basicReproduction, 1.0001)
  const required = clamp(rawThreshold / Math.max(vaccineEfficacy, 1e-9), 0, 1)
  const rows = groups.map((g) => {
    const cover = g.vaccinated / Math.max(g.animals, 1)
    return { ...g, cover, effective: cover * vaccineEfficacy, short: Math.max(0, Math.ceil((required - cover) * g.animals)) }
  })
  const totalAnimals = groups.reduce((a, g) => a + g.animals, 0)
  const totalVax = groups.reduce((a, g) => a + g.vaccinated, 0)
  const herdCover = totalVax / Math.max(totalAnimals, 1)
  const below = rows.filter((r) => r.cover < required)
  const achievable = required <= 1

  return (
    <div className={className}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.vaccinated} of {r.animals}
              </span>
            </div>
            <div className="relative mt-0.5 h-4 rounded-[2px] bg-muted">
              <div
                className="absolute inset-y-0 rounded-[2px]"
                style={{
                  width: `${r.cover * 100}%`,
                  background: r.cover >= required ? "color-mix(in oklch, currentColor 52%, transparent)" : "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)",
                  outline: r.cover >= required ? undefined : "1px solid currentColor",
                  outlineOffset: -1,
                }}
              />
              <span className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: `${clamp(required, 0, 1) * 100}%` }} />
            </div>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              <span aria-hidden>{r.cover >= required ? "✓" : "✗"}</span> {(r.cover * 100).toFixed(0)}% covered
              {r.short > 0 ? ` — ${r.short} more animal${r.short === 1 ? "" : "s"} needed` : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        The threshold is DERIVED: R₀ {basicReproduction} needs {(rawThreshold * 100).toFixed(0)}% immune, and at{" "}
        {(vaccineEfficacy * 100).toFixed(0)}% vaccine efficacy that means {(required * 100).toFixed(0)}% vaccinated ·
        herd cover is {(herdCover * 100).toFixed(0)}% ·{" "}
        {!achievable
          ? "no achievable cover reaches the threshold with this vaccine — that is a vaccine problem, not a compliance one"
          : below.length
            ? `${below.map((r) => r.name).join(", ")} ${below.length === 1 ? "is" : "are"} below it, and one unprotected group keeps the whole herd exposed`
            : "every group clears the threshold"}
      </p>
    </div>
  )
}
