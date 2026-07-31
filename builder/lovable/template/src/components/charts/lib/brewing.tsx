/**
 * Brewing primitives — mash schedule, fermentation, hop bitterness, water
 * chemistry and beer colour.
 *
 * Everything a brewer would work out on paper is DERIVED: rest durations, ABV
 * and apparent attenuation from the two gravities, IBU from Tinseth utilisation,
 * the sulphate-to-chloride ratio, and SRM from MCU via the Morey equation. None
 * of them are props, so a caller cannot state a figure the numbers contradict.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/* ------------------------------------------------------------------ *
 * MashProfile — the temperature schedule, with each rest's duration and
 * the ramp rate between rests computed from the step times.
 * ------------------------------------------------------------------ */
export function MashProfile({
  steps,
  height = 180,
  className = "",
}: {
  /** in order; minute is when the rest STARTS */
  steps: { name: string; minute: number; celsius: number }[]
  /** total mash length; defaults to the last step plus its own rest */
  height?: number
  className?: string
}) {
  const sorted = [...steps].sort((a, b) => a.minute - b.minute)
  const rests = sorted.map((s, i) => ({
    ...s,
    hold: (sorted[i + 1]?.minute ?? sorted[sorted.length - 1].minute + 15) - s.minute,
    ramp: i === 0 ? null : (s.celsius - sorted[i - 1].celsius) / Math.max(1, s.minute - sorted[i - 1].minute),
  }))
  const total = rests[rests.length - 1].minute + rests[rests.length - 1].hold
  const lo = Math.min(...sorted.map((s) => s.celsius)) - 6
  const hi = Math.max(...sorted.map((s) => s.celsius)) + 4

  const px = (m: number) => (m / total) * 100
  const py = (c: number) => 100 - ((c - lo) / (hi - lo)) * 100

  // a rest is a flat run then a ramp to the next
  const path: string[] = []
  rests.forEach((r, i) => {
    path.push(`${px(r.minute)},${py(r.celsius)}`)
    path.push(`${px(r.minute + r.hold)},${py(r.celsius)}`)
    const next = rests[i + 1]
    if (next) path.push(`${px(next.minute)},${py(next.celsius)}`)
  })

  return (
    <div className={className}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          {rests.map((r) => (
            <rect
              key={r.name}
              x={px(r.minute)}
              y={py(r.celsius)}
              width={px(r.hold)}
              height={100 - py(r.celsius)}
              fill="currentColor"
              opacity={0.09}
            />
          ))}
          <polyline points={path.join(" ")} fill="none" stroke="currentColor" strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
        </svg>
        {rests.map((r) => (
          <span
            key={r.name}
            className="absolute -translate-y-full px-1 text-[9px] whitespace-nowrap text-muted-foreground"
            style={{ left: `${px(r.minute)}%`, top: `${py(r.celsius)}%` }}
          >
            {r.celsius}°
          </span>
        ))}
      </div>
      <ul className="mt-2 space-y-0.5 text-[10px]">
        {rests.map((r) => (
          <li key={r.name} className="flex items-baseline gap-2 tabular-nums">
            <span className="w-24 shrink-0 truncate font-medium">{r.name}</span>
            <span className="text-muted-foreground">
              {r.celsius}°C for {r.hold} min
            </span>
            {r.ramp !== null && (
              <span className="text-muted-foreground">
                · ramped {r.ramp > 0 ? "+" : "−"}
                {Math.abs(r.ramp).toFixed(1)}°/min
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        {total} minutes in the tun · shaded width is how long each rest is actually held, which is what converts the
        starch
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * FermentationCurve — gravity and temperature over the ferment. ABV and
 * apparent attenuation are SOLVED from the first and last readings.
 * ------------------------------------------------------------------ */
export function FermentationCurve({
  readings,
  height = 190,
  className = "",
}: {
  readings: { day: number; gravity: number; celsius?: number }[]
  height?: number
  className?: string
}) {
  const sorted = [...readings].sort((a, b) => a.day - b.day)
  const og = sorted[0]?.gravity ?? 1
  const fg = sorted[sorted.length - 1]?.gravity ?? 1
  const abv = (og - fg) * 131.25
  const attenuation = og > 1 ? ((og - fg) / (og - 1)) * 100 : 0

  // The day gravity stopped moving. NOT "stuck" — a FINISHED ferment is flat too,
  // and the first version called every completed batch stalled. The honest claim
  // is when it went flat; whether that is terminal or a stall is exactly what a
  // hydrometer cannot tell you, which is the point worth making.
  const flatFrom = sorted.findIndex(
    (r, i) => i >= 3 && sorted.slice(i - 3, i + 1).every((x, j, a) => j === 0 || Math.abs(x.gravity - a[j - 1].gravity) < 0.001),
  )
  // it only resumed falling later if some later reading is materially lower
  const roused = flatFrom > 0 && sorted.slice(flatFrom).some((r) => r.gravity < sorted[flatFrom].gravity - 0.003)

  const maxDay = Math.max(1, ...sorted.map((r) => r.day))
  const gLo = Math.min(...sorted.map((r) => r.gravity)) - 0.004
  const gHi = Math.max(...sorted.map((r) => r.gravity)) + 0.002
  const temps = sorted.filter((r) => r.celsius !== undefined)
  const tLo = temps.length ? Math.min(...temps.map((r) => r.celsius as number)) - 3 : 0
  const tHi = temps.length ? Math.max(...temps.map((r) => r.celsius as number)) + 3 : 1

  const px = (d: number) => (d / maxDay) * 100
  const pg = (g: number) => 100 - ((g - gLo) / (gHi - gLo)) * 94 - 3
  const pt = (c: number) => 100 - ((c - tLo) / (tHi - tLo)) * 94 - 3

  return (
    <div className={className}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full" style={{ height }}>
        <polygon
          points={`0,100 ${sorted.map((r) => `${px(r.day)},${pg(r.gravity)}`).join(" ")} 100,100`}
          fill="currentColor"
          opacity={0.11}
        />
        <polyline
          points={sorted.map((r) => `${px(r.day)},${pg(r.gravity)}`).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.3}
          vectorEffect="non-scaling-stroke"
        />
        {temps.length > 1 && (
          <polyline
            points={temps.map((r) => `${px(r.day)},${pt(r.celsius as number)}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
            strokeDasharray="4 2"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>day 0</span>
        <span>day {maxDay}</span>
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">OG</dt>
          <dd className="font-medium tabular-nums">{og.toFixed(3)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">FG</dt>
          <dd className="font-medium tabular-nums">{fg.toFixed(3)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">ABV</dt>
          <dd className="font-medium tabular-nums">{abv.toFixed(1)}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Attenuation</dt>
          <dd className="font-medium tabular-nums">{attenuation.toFixed(0)}%</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Solid is gravity{temps.length > 1 ? ", dashed is temperature" : ""} ·{" "}
        {flatFrom < 0
          ? "gravity was still falling at the last reading, so this is not finished"
          : roused
            ? `flat from day ${sorted[flatFrom - 3].day} and then falling again — that one stalled and was roused`
            : `flat from day ${sorted[flatFrom - 3].day} at ${fg.toFixed(3)} — a hydrometer cannot tell a finished ferment from a stuck one, only the day it stopped`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * HopSchedule — additions along the boil, with each one's IBU
 * contribution computed by Tinseth utilisation.
 * ------------------------------------------------------------------ */
export function HopSchedule({
  additions,
  boilMinutes,
  batchLitres,
  originalGravity,
  className = "",
}: {
  additions: { name: string; grams: number; alphaAcid: number; atMinute: number }[]
  boilMinutes: number
  batchLitres: number
  originalGravity: number
  className?: string
}) {
  // Tinseth: utilisation = bigness × boil-time factor
  const bigness = 1.65 * Math.pow(0.000125, originalGravity - 1)
  const rows = additions
    .map((a) => {
      const boiled = clamp(boilMinutes - a.atMinute, 0, boilMinutes)
      const timeFactor = (1 - Math.exp(-0.04 * boiled)) / 4.15
      const util = bigness * timeFactor
      const ibu = (a.grams * (a.alphaAcid / 100) * util * 1000) / batchLitres
      return { ...a, boiled, util, ibu }
    })
    .sort((a, b) => a.atMinute - b.atMinute)
  const total = rows.reduce((a, r) => a + r.ibu, 0)
  const maxIbu = Math.max(0.01, ...rows.map((r) => r.ibu))

  return (
    <div className={className}>
      <div className="relative h-8 rounded-[2px] bg-muted">
        {rows.map((r) => (
          <span
            key={`${r.name}-${r.atMinute}`}
            className="absolute inset-y-0 w-px bg-foreground"
            style={{ left: `${(r.atMinute / Math.max(1, boilMinutes)) * 100}%` }}
            title={`${r.name} at ${r.atMinute} min`}
          />
        ))}
        <span className="absolute inset-y-0 right-0 w-px bg-foreground/50" />
        <span className="absolute -bottom-4 left-0 text-[9px] text-muted-foreground">0 min (start)</span>
        <span className="absolute -bottom-4 right-0 text-[9px] text-muted-foreground">{boilMinutes} min (out)</span>
      </div>
      <ul className="mt-6 space-y-1.5">
        {rows.map((r) => (
          <li key={`${r.name}-${r.atMinute}`}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span>
                {r.name}{" "}
                <span className="text-muted-foreground tabular-nums">
                  {r.grams} g · {r.alphaAcid}% AA · {r.boiled} min in the boil
                </span>
              </span>
              <span className="font-medium tabular-nums">{r.ibu.toFixed(1)} IBU</span>
            </div>
            <div className="mt-0.5 h-2 rounded-[1px] bg-muted">
              <div className="h-full rounded-[1px] bg-foreground" style={{ width: `${(r.ibu / maxIbu) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground tabular-nums">
        {total.toFixed(0)} IBU total · a late addition gives aroma and almost no bitterness — the{" "}
        {rows[rows.length - 1]?.grams} g at {rows[rows.length - 1]?.atMinute} min contributes{" "}
        {(((rows[rows.length - 1]?.ibu ?? 0) / Math.max(total, 1e-9)) * 100).toFixed(0)}% of it
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * AbvAttenuation — a batch's gravities against the yeast strain's
 * published range, so an under-attenuating ferment is visible.
 * ------------------------------------------------------------------ */
export function AbvAttenuation({
  batches,
  strainRange,
  className = "",
}: {
  batches: { name: string; og: number; fg: number }[]
  /** the yeast maker's apparent-attenuation range, as percentages */
  strainRange: { low: number; high: number }
  className?: string
}) {
  const rows = batches.map((b) => {
    const att = b.og > 1 ? ((b.og - b.fg) / (b.og - 1)) * 100 : 0
    return { ...b, att, abv: (b.og - b.fg) * 131.25, inRange: att >= strainRange.low && att <= strainRange.high }
  })
  const lo = Math.min(strainRange.low, ...rows.map((r) => r.att)) - 4
  const hi = Math.max(strainRange.high, ...rows.map((r) => r.att)) + 4
  const px = (v: number) => ((v - lo) / (hi - lo)) * 100
  const outside = rows.filter((r) => !r.inRange)

  return (
    <div className={className}>
      {/* The header band has to sit in the SAME three-column layout as the rows,
          or it is measured against the whole card while the bars are inset by the
          label and value columns — and the two ranges silently disagree. */}
      <div className="mb-2 flex items-center gap-2">
        <span className="w-24 shrink-0" />
        <div className="relative h-4 flex-1">
          <div
            className="absolute inset-y-0 rounded-[2px] bg-foreground/12"
            style={{ left: `${px(strainRange.low)}%`, width: `${px(strainRange.high) - px(strainRange.low)}%` }}
          />
          <span className="absolute -top-0.5 text-[9px] text-muted-foreground" style={{ left: `${px(strainRange.low)}%` }}>
            {strainRange.low}%
          </span>
          <span className="absolute -top-0.5 -translate-x-full text-[9px] text-muted-foreground" style={{ left: `${px(strainRange.high)}%` }}>
            {strainRange.high}%
          </span>
        </div>
        <span className="w-24 shrink-0" />
      </div>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-2">
            <span className="w-24 shrink-0 truncate text-[11px]">{r.name}</span>
            <div className="relative h-4 flex-1 rounded-[2px] bg-muted">
              <div
                className="absolute inset-y-0 bg-foreground/12"
                style={{ left: `${px(strainRange.low)}%`, width: `${px(strainRange.high) - px(strainRange.low)}%` }}
              />
              <span
                className="absolute top-1/2 h-3 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-[1px]"
                style={{
                  left: `${px(r.att)}%`,
                  background: r.inRange ? "currentColor" : "var(--background)",
                  boxShadow: r.inRange ? undefined : "inset 0 0 0 1.5px currentColor",
                }}
              />
            </div>
            <span className="w-24 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
              {r.att.toFixed(0)}% · {r.abv.toFixed(1)}% ABV
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground">
        Shaded band is the strain's published attenuation · hollow markers fell outside it
        {outside.length ? ` — ${outside.map((r) => r.name).join(", ")}` : " — none did"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * WaterProfile — source water against a target, with the sulphate to
 * chloride ratio derived because that is the number that decides balance.
 * ------------------------------------------------------------------ */
export type WaterIons = {
  calcium: number
  magnesium: number
  sodium: number
  sulphate: number
  chloride: number
  bicarbonate: number
}

const ION_LABELS: [keyof WaterIons, string][] = [
  ["calcium", "Ca²⁺"],
  ["magnesium", "Mg²⁺"],
  ["sodium", "Na⁺"],
  ["sulphate", "SO₄²⁻"],
  ["chloride", "Cl⁻"],
  ["bicarbonate", "HCO₃⁻"],
]

export function WaterProfile({
  source,
  target,
  className = "",
}: {
  source: WaterIons
  target: WaterIons
  className?: string
}) {
  const max = Math.max(...ION_LABELS.map(([k]) => Math.max(source[k], target[k])), 1)
  const ratio = (w: WaterIons) => w.sulphate / Math.max(1, w.chloride)
  const balance = (r: number) => (r > 1.6 ? "hop-forward" : r < 0.7 ? "malt-forward" : "balanced")

  return (
    <div className={className}>
      <ul className="space-y-2">
        {ION_LABELS.map(([k, label]) => {
          const s = source[k]
          const t = target[k]
          return (
            <li key={k}>
              <div className="flex items-baseline justify-between text-[11px]">
                <span>{label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {s} → {t} ppm
                </span>
              </div>
              <div className="relative mt-0.5 h-4">
                <div className="absolute inset-y-0 left-0 rounded-[2px] bg-foreground/25" style={{ width: `${(s / max) * 100}%` }} />
                <span
                  className="absolute inset-y-0 w-0.5 bg-foreground"
                  style={{ left: `${(t / max) * 100}%` }}
                  title={`target ${t}`}
                />
              </div>
            </li>
          )
        })}
      </ul>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Source SO₄:Cl</dt>
          <dd className="font-medium tabular-nums">
            {ratio(source).toFixed(2)} — {balance(ratio(source))}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Target SO₄:Cl</dt>
          <dd className="font-medium tabular-nums">
            {ratio(target).toFixed(2)} — {balance(ratio(target))}
          </dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Bars are what comes out of the tap, ticks are the target · the sulphate-to-chloride ratio is what decides whether
        the beer reads crisp or round, not the totals
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * BeerColour — SRM computed from the grain bill by Morey, shown as a
 * greyscale ramp because this platform is monochrome and a colour swatch
 * would be the one thing here that cannot be printed.
 * ------------------------------------------------------------------ */
export function BeerColour({
  grains,
  batchLitres,
  className = "",
}: {
  grains: { name: string; kilograms: number; lovibond: number }[]
  batchLitres: number
  className?: string
}) {
  const gallons = batchLitres / 3.78541
  const pounds = (kg: number) => kg * 2.20462
  const mcu = grains.reduce((a, g) => a + (pounds(g.kilograms) * g.lovibond) / Math.max(gallons, 1e-9), 0)
  const srm = 1.4922 * Math.pow(mcu, 0.6859)
  const ebc = srm * 1.97

  const style = srm < 4 ? "Pale lager" : srm < 8 ? "Golden ale" : srm < 14 ? "Amber" : srm < 20 ? "Brown" : srm < 30 ? "Dark brown" : "Black"
  const contributions = grains
    .map((g) => ({ ...g, mcu: (pounds(g.kilograms) * g.lovibond) / Math.max(gallons, 1e-9) }))
    .sort((a, b) => b.mcu - a.mcu)
  const totalKg = grains.reduce((a, g) => a + g.kilograms, 0)

  return (
    <div className={className}>
      <div className="flex h-10 overflow-hidden rounded-[3px] border border-foreground/25">
        {Array.from({ length: 40 }, (_, i) => {
          const s = (i / 39) * 40
          return (
            <div
              key={i}
              className="flex-1"
              style={{ background: `color-mix(in oklch, currentColor ${clamp(4 + s * 2.3, 0, 96)}%, transparent)` }}
            />
          )
        })}
      </div>
      <div className="relative mt-0.5 h-4">
        <span
          className="absolute top-0 -translate-x-1/2 text-[10px] font-medium tabular-nums"
          style={{ left: `${clamp((srm / 40) * 100, 3, 97)}%` }}
        >
          ▲ {srm.toFixed(1)}
        </span>
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground tabular-nums">
        <span>0 SRM</span>
        <span>40 SRM</span>
      </div>
      <ul className="mt-2 space-y-1 text-[10px]">
        {contributions.map((g) => (
          <li key={g.name} className="flex items-center gap-2 tabular-nums">
            <span className="w-28 shrink-0 truncate">{g.name}</span>
            <div className="h-1.5 flex-1 rounded-[1px] bg-muted">
              <div
                className="h-full rounded-[1px] bg-foreground"
                style={{ width: `${(g.mcu / Math.max(mcu, 1e-9)) * 100}%` }}
              />
            </div>
            <span className="w-24 shrink-0 text-right text-muted-foreground">
              {g.kilograms} kg · {((g.mcu / Math.max(mcu, 1e-9)) * 100).toFixed(0)}% of colour
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        {srm.toFixed(1)} SRM / {ebc.toFixed(0)} EBC — {style} · {contributions[0]?.name} is{" "}
        {((contributions[0]?.kilograms ?? 0) / Math.max(totalKg, 1e-9) * 100).toFixed(0)}% of the bill by weight and{" "}
        {((contributions[0]?.mcu ?? 0) / Math.max(mcu, 1e-9) * 100).toFixed(0)}% of the colour
      </p>
    </div>
  )
}
