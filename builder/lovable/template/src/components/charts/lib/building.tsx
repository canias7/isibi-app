/**
 * Building-physics and architectural primitives — daylight, solar geometry,
 * fabric build-up, room acoustics, the schedule of accommodation and
 * circulation.
 *
 * The daylight factor at each depth, the sun's altitude through the year, the
 * U-value from the layer resistances, RT60 by Sabine, the area a brief actually
 * needs once circulation is added, and the busiest link in a flow are all
 * DERIVED. A U-value taken as a prop cannot catch the missing insulation layer.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/* ------------------------------------------------------------------ *
 * DaylightFactor — the falloff with depth from the window, with the
 * useful depth and the no-sky line derived.
 * ------------------------------------------------------------------ */
export function DaylightFactor({
  roomDepthM,
  windowHeadM,
  glazingRatio,
  targetPercent = 2,
  height = 190,
  className = "",
}: {
  roomDepthM: number
  /** height of the window head above the working plane */
  windowHeadM: number
  /** glazed area as a fraction of the façade */
  glazingRatio: number
  /** the daylight factor considered adequate */
  targetPercent?: number
  height?: number
  className?: string
}) {
  const samples = 60
  // an inverse-square falloff from the aperture, scaled by the glazing ratio
  const points = Array.from({ length: samples }, (_, i) => {
    const d = ((i + 0.5) / samples) * roomDepthM
    const df = (glazingRatio * 100 * windowHeadM ** 2) / Math.pow(d + windowHeadM, 2) / 2.2
    return { d, df }
  })
  const usefulIdx = points.findIndex((p) => p.df < targetPercent)
  const usefulDepth = usefulIdx <= 0 ? roomDepthM : points[usefulIdx].d
  // the rule of thumb the whole discipline runs on
  const noSkyLine = windowHeadM * 2
  const maxDf = points[0].df

  const px = (d: number) => (d / roomDepthM) * 100
  const py = (v: number) => 100 - (v / (maxDf * 1.05)) * 96 - 2

  return (
    <div className={className}>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <rect x={0} y={0} width={px(usefulDepth)} height={100} fill="currentColor" opacity={0.09} />
          <line x1={0} y1={py(targetPercent)} x2={100} y2={py(targetPercent)} stroke="currentColor" strokeWidth={0.5} strokeDasharray="3 2" opacity={0.6} />
          <polyline points={points.map((p) => `${px(p.d)},${py(p.df)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.3} vectorEffect="non-scaling-stroke" />
          <line x1={px(noSkyLine)} y1={0} x2={px(noSkyLine)} y2={100} stroke="currentColor" strokeWidth={0.5} opacity={0.5} />
        </svg>
        <span className="absolute right-1 -translate-y-full bg-background px-1 text-[9px] text-muted-foreground" style={{ top: `${py(targetPercent)}%` }}>
          {targetPercent}% target
        </span>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>window</span>
        <span>{roomDepthM} m deep</span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">At the glass</dt>
          <dd className="font-medium tabular-nums">{maxDf.toFixed(1)}%</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Useful depth</dt>
          <dd className="font-medium tabular-nums">{usefulDepth.toFixed(1)} m</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Rule of thumb</dt>
          <dd className="font-medium tabular-nums">{noSkyLine.toFixed(1)} m</dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        The shaded band is where the factor clears {targetPercent}% · the plain line is 2× the window head, the rule of
        thumb, and it lands at {noSkyLine.toFixed(1)} m against a computed {usefulDepth.toFixed(1)} m ·{" "}
        {usefulDepth < roomDepthM
          ? `the back ${(roomDepthM - usefulDepth).toFixed(1)} m needs the lights on all day, whatever the window does`
          : "the whole room clears the target"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * SolarPath — the sun's altitude through the day at each of three
 * dates, computed from latitude and declination.
 * ------------------------------------------------------------------ */
export function SolarPath({
  latitude,
  dates,
  obstructionAltitude,
  height = 200,
  className = "",
}: {
  /** degrees north, negative for south */
  latitude: number
  /** day of the year for each curve */
  dates: { name: string; dayOfYear: number }[]
  /** a mask altitude in degrees, e.g. the building opposite */
  obstructionAltitude?: number
  height?: number
  className?: string
}) {
  const rad = Math.PI / 180
  const declination = (n: number) => 23.45 * Math.sin(((360 * (284 + n)) / 365) * rad)
  const curves = dates.map((d) => {
    const dec = declination(d.dayOfYear)
    const points = Array.from({ length: 97 }, (_, i) => {
      const hour = (i / 96) * 24
      const H = (hour - 12) * 15
      const sinAlt = Math.sin(latitude * rad) * Math.sin(dec * rad) + Math.cos(latitude * rad) * Math.cos(dec * rad) * Math.cos(H * rad)
      return { hour, altitude: Math.asin(clamp(sinAlt, -1, 1)) / rad }
    })
    const above = points.filter((p) => p.altitude > 0)
    const usable = obstructionAltitude === undefined ? above : points.filter((p) => p.altitude > obstructionAltitude)
    return {
      ...d,
      dec,
      points,
      peak: Math.max(...points.map((p) => p.altitude)),
      dayLength: (above.length / 96) * 24,
      usableHours: (usable.length / 96) * 24,
    }
  })
  const maxAlt = Math.max(...curves.map((c) => c.peak), obstructionAltitude ?? 0) + 6
  const px = (h: number) => (h / 24) * 100
  const py = (a: number) => 100 - ((a + 10) / (maxAlt + 10)) * 100
  const dashes = ["", "4 2", "1 2", "6 2 1 2"]

  return (
    <div className={className}>
      <div className="relative rounded-[2px] border border-foreground/15" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          {obstructionAltitude !== undefined && (
            <rect x={0} y={py(obstructionAltitude)} width={100} height={100 - py(obstructionAltitude)} fill="currentColor" opacity={0.13} />
          )}
          <line x1={0} y1={py(0)} x2={100} y2={py(0)} stroke="currentColor" strokeWidth={0.6} opacity={0.6} />
          {curves.map((c, ci) => (
            <polyline
              key={c.name}
              points={c.points.map((p) => `${px(p.hour)},${py(p.altitude)}`).join(" ")}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.2}
              strokeDasharray={dashes[ci % dashes.length]}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>00:00</span>
        <span>12:00</span>
        <span>24:00</span>
      </div>
      <ul className="mt-2 space-y-0.5 text-[10px] tabular-nums">
        {curves.map((c, ci) => (
          <li key={c.name} className="flex items-center gap-2">
            <svg width={18} height={6} className="shrink-0" aria-hidden>
              <line x1={0} y1={3} x2={18} y2={3} stroke="currentColor" strokeWidth={1.4} strokeDasharray={dashes[ci % dashes.length]} />
            </svg>
            <span className="w-24 shrink-0 truncate">{c.name}</span>
            <span className="text-muted-foreground">
              peak {c.peak.toFixed(0)}° · {c.dayLength.toFixed(1)} h of daylight
              {obstructionAltitude !== undefined ? ` · ${c.usableHours.toFixed(1)} h clear of the obstruction` : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Computed for latitude {latitude.toFixed(1)}° from the solar declination, not tabulated ·{" "}
        {obstructionAltitude !== undefined
          ? `the shaded band is everything below ${obstructionAltitude}°, which the building opposite takes — in ${curves.reduce((a, c) => (c.usableHours < a.usableHours ? c : a), curves[0]).name} that leaves ${curves.reduce((a, c) => (c.usableHours < a.usableHours ? c : a), curves[0]).usableHours.toFixed(1)} usable hours`
          : "no obstruction mask applied"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * UValueBuildup — the layers of a construction with the U-value summed
 * from their resistances and the condensation risk flagged.
 * ------------------------------------------------------------------ */
export function UValueBuildup({
  layers,
  surfaceResistance = 0.17,
  targetU,
  className = "",
}: {
  /** thickness in mm and conductivity in W/mK; an air gap gives its own R */
  layers: { name: string; mm: number; lambda?: number; resistance?: number }[]
  /** internal plus external surface resistances combined */
  surfaceResistance?: number
  targetU?: number
  className?: string
}) {
  const rows = layers.map((l) => ({
    ...l,
    r: l.resistance ?? (l.lambda ? l.mm / 1000 / l.lambda : 0),
  }))
  const totalR = rows.reduce((a, l) => a + l.r, 0) + surfaceResistance
  const u = 1 / Math.max(totalR, 1e-9)
  const totalMm = rows.reduce((a, l) => a + l.mm, 0)
  const biggest = rows.reduce((a, l) => (l.r > a.r ? l : a), rows[0])
  // What matters is which layers sit OUTBOARD of the insulation, because those
  // are the ones left cold — not where the insulation falls in the count.
  const insulationIdx = rows.indexOf(biggest)
  const cold = rows.slice(insulationIdx + 1).filter((l) => l.mm >= 40 && l.r < 0.5)
  const structuralNames = /block|brick|concrete|timber|steel|masonry|stone/i
  const coldStructure = cold.filter((l) => structuralNames.test(l.name))

  return (
    <div className={className}>
      <div className="flex h-12 w-full overflow-hidden rounded-[3px] border border-foreground/30">
        {rows.map((l, i) => (
          <div
            key={`${l.name}-${i}`}
            className="border-r border-foreground/25 last:border-r-0"
            style={{
              width: `${(l.mm / Math.max(totalMm, 1)) * 100}%`,
              background:
                l.r > 0.5
                  ? "repeating-linear-gradient(45deg, currentColor 0 1.5px, transparent 1.5px 5px)"
                  : `color-mix(in oklch, currentColor ${(12 + clamp(l.r, 0, 0.5) * 90).toFixed(0)}%, transparent)`,
            }}
            title={`${l.name}: ${l.mm} mm, R ${l.r.toFixed(3)}`}
          />
        ))}
      </div>
      <div className="mt-0.5 flex justify-between text-[9px] text-muted-foreground">
        <span>inside</span>
        <span className="tabular-nums">{totalMm} mm</span>
        <span>outside</span>
      </div>
      <ul className="mt-2 space-y-0.5 text-[10px] tabular-nums">
        {rows.map((l, i) => (
          <li key={`${l.name}-row-${i}`} className="flex items-center gap-2">
            <span className="w-32 shrink-0 truncate">{l.name}</span>
            <div className="h-1.5 flex-1 rounded-[1px] bg-muted">
              <div className="h-full rounded-[1px] bg-foreground" style={{ width: `${(l.r / Math.max(totalR, 1e-9)) * 100}%` }} />
            </div>
            <span className="w-32 shrink-0 text-right text-muted-foreground">
              {l.mm} mm · R {l.r.toFixed(3)} ({((l.r / totalR) * 100).toFixed(0)}%)
            </span>
          </li>
        ))}
      </ul>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Total R</dt>
          <dd className="font-medium tabular-nums">{totalR.toFixed(2)} m²K/W</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">U-value</dt>
          <dd className="font-medium tabular-nums">{u.toFixed(3)} W/m²K</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{targetU !== undefined ? "Against target" : "Thickness"}</dt>
          <dd className="font-medium tabular-nums">
            {targetU !== undefined ? (u <= targetU ? `passes ${targetU}` : `FAILS ${targetU}`) : `${totalMm} mm`}
          </dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground">
        The U-value is one over the summed resistances, including {surfaceResistance} m²K/W of surface films · hatched
        layers carry most of the resistance — {biggest.name} alone is{" "}
        {((biggest.r / totalR) * 100).toFixed(0)}% of it, and it sits{" "}
        {cold.length === 0
          ? "outermost, so every other layer is kept warm"
          : coldStructure.length
            ? `inboard of ${coldStructure.map((l) => l.name.toLowerCase()).join(" and ")}, which leaves that structure cold — the dew point falls behind the insulation, and that is where interstitial condensation forms`
            : `with only ${cold.map((l) => l.name.toLowerCase()).join(" and ")} outboard of it, so no structural layer is left cold`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * AcousticRt60 — reverberation time per octave band by Sabine, with
 * the absorption each surface contributes derived.
 * ------------------------------------------------------------------ */
export function AcousticRt60({
  volumeM3,
  surfaces,
  bands,
  targetSeconds,
  height = 200,
  className = "",
}: {
  volumeM3: number
  /** area and the absorption coefficient in each band */
  surfaces: { name: string; areaM2: number; alpha: number[] }[]
  /** octave band centre frequencies */
  bands: number[]
  targetSeconds?: { low: number; high: number }
  height?: number
  className?: string
}) {
  const rt = bands.map((_, bi) => {
    const A = surfaces.reduce((a, s) => a + s.areaM2 * (s.alpha[bi] ?? 0), 0)
    return { A, seconds: (0.161 * volumeM3) / Math.max(A, 1e-9) }
  })
  const max = Math.max(...rt.map((r) => r.seconds), targetSeconds?.high ?? 0) * 1.12
  const worstBand = rt.reduce((a, r, i) => (r.seconds > rt[a].seconds ? i : a), 0)
  const contribution = surfaces
    .map((s) => ({ name: s.name, sabins: s.areaM2 * (s.alpha[worstBand] ?? 0) }))
    .sort((a, b) => b.sabins - a.sabins)
  const totalSabins = rt[worstBand].A
  const outside = targetSeconds ? rt.filter((r) => r.seconds < targetSeconds.low || r.seconds > targetSeconds.high).length : 0

  return (
    <div className={className}>
      <div className="relative flex items-end gap-2" style={{ height }}>
        {targetSeconds && (
          <div
            className="pointer-events-none absolute inset-x-0 bg-foreground/10"
            style={{ bottom: `${(targetSeconds.low / max) * 100}%`, height: `${((targetSeconds.high - targetSeconds.low) / max) * 100}%` }}
          />
        )}
        {rt.map((r, i) => (
          <div key={bands[i]} className="flex h-full flex-1 flex-col justify-end">
            <span className="mb-0.5 text-center text-[9px] tabular-nums text-muted-foreground">{r.seconds.toFixed(2)}</span>
            <div
              className="w-full rounded-t-[2px]"
              style={{
                height: `${(r.seconds / max) * 100}%`,
                background: targetSeconds && (r.seconds < targetSeconds.low || r.seconds > targetSeconds.high)
                  ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)"
                  : "color-mix(in oklch, currentColor 55%, transparent)",
                outline: targetSeconds && (r.seconds < targetSeconds.low || r.seconds > targetSeconds.high) ? "1px solid currentColor" : undefined,
                outlineOffset: -1,
              }}
              title={`${bands[i]} Hz: RT60 ${r.seconds.toFixed(2)} s, ${r.A.toFixed(0)} sabins`}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        {bands.map((b) => (
          <span key={b} className="flex-1 text-center text-[9px] tabular-nums text-muted-foreground">
            {b >= 1000 ? `${b / 1000}k` : b}
          </span>
        ))}
      </div>
      <ul className="mt-2 space-y-0.5 text-[10px] tabular-nums">
        {contribution.map((c) => (
          <li key={c.name} className="flex items-center gap-2">
            <span className="w-28 shrink-0 truncate">{c.name}</span>
            <div className="h-1.5 flex-1 rounded-[1px] bg-muted">
              <div className="h-full rounded-[1px] bg-foreground" style={{ width: `${(c.sabins / Math.max(totalSabins, 1e-9)) * 100}%` }} />
            </div>
            <span className="w-24 shrink-0 text-right text-muted-foreground">
              {c.sabins.toFixed(0)} sabins ({((c.sabins / Math.max(totalSabins, 1e-9)) * 100).toFixed(0)}%)
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Sabine on {volumeM3} m³ · the list is absorption at {bands[worstBand]} Hz, the worst band, because that is where
        the treatment has to go ·{" "}
        {targetSeconds
          ? outside === 0
            ? `every band sits inside ${targetSeconds.low}–${targetSeconds.high} s`
            : `${outside} of ${bands.length} bands fall outside ${targetSeconds.low}–${targetSeconds.high} s`
          : "no target band given"}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * SpaceProgram — the brief's net areas grossed up, so the gross area
 * the site actually has to hold is computed rather than guessed.
 * ------------------------------------------------------------------ */
export function SpaceProgram({
  rooms,
  circulationFactor = 0.35,
  siteGrossM2,
  className = "",
}: {
  rooms: { name: string; count: number; netM2: number; group?: string }[]
  /** circulation, plant and structure as a fraction added to net */
  circulationFactor?: number
  siteGrossM2?: number
  className?: string
}) {
  const rows = rooms.map((r) => ({ ...r, total: r.count * r.netM2 }))
  const net = rows.reduce((a, r) => a + r.total, 0)
  const gross = net * (1 + circulationFactor)
  const groups = new Map<string, number>()
  rows.forEach((r) => groups.set(r.group ?? "Other", (groups.get(r.group ?? "Other") ?? 0) + r.total))
  const grouped = [...groups.entries()].sort((a, b) => b[1] - a[1])
  const max = Math.max(...rows.map((r) => r.total))

  return (
    <div className={className}>
      <div className="mb-2 flex h-6 w-full overflow-hidden rounded-[3px] border border-foreground/30">
        {grouped.map(([g, v], i) => (
          <div
            key={g}
            className="flex items-center justify-center border-r border-foreground/25 text-[9px] last:border-r-0"
            style={{ width: `${(v / Math.max(net, 1)) * 100}%`, background: `color-mix(in oklch, currentColor ${Math.max(6, 48 - i * 11)}%, transparent)` }}
            title={`${g}: ${v.toFixed(0)} m²`}
          >
            {(v / Math.max(net, 1)) * 100 > 12 ? g : ""}
          </div>
        ))}
      </div>
      <ul className="space-y-0.5 text-[10px] tabular-nums">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-2">
            <span className="w-32 shrink-0 truncate">
              {r.count} × {r.name}
            </span>
            <div className="h-2 flex-1 rounded-[1px] bg-muted">
              <div className="h-full rounded-[1px] bg-foreground/55" style={{ width: `${(r.total / max) * 100}%` }} />
            </div>
            <span className="w-24 shrink-0 text-right text-muted-foreground">
              {r.total.toFixed(0)} m² net
            </span>
          </li>
        ))}
      </ul>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Net</dt>
          <dd className="font-medium tabular-nums">{net.toFixed(0)} m²</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Gross</dt>
          <dd className="font-medium tabular-nums">{gross.toFixed(0)} m²</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{siteGrossM2 !== undefined ? "Against capacity" : "Efficiency"}</dt>
          <dd className="font-medium tabular-nums">
            {siteGrossM2 !== undefined
              ? gross <= siteGrossM2
                ? `${(siteGrossM2 - gross).toFixed(0)} m² spare`
                : `${(gross - siteGrossM2).toFixed(0)} m² OVER`
              : `${(100 / (1 + circulationFactor)).toFixed(0)}%`}
          </dd>
        </div>
      </dl>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Gross is net plus {(circulationFactor * 100).toFixed(0)}% for circulation, plant and structure — the number a
        brief leaves out and a site plan cannot ·{" "}
        {siteGrossM2 !== undefined && gross > siteGrossM2
          ? "the brief does not fit, and the honest conversation is which rooms go"
          : `${grouped[0]?.[0]} is the largest group at ${((grouped[0]?.[1] ?? 0) / Math.max(net, 1) * 100).toFixed(0)}% of net`}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * CirculationFlow — people moving between zones, with the busiest link
 * and each zone's throughput derived from the matrix.
 * ------------------------------------------------------------------ */
export function CirculationFlow({
  zones,
  flows,
  corridorCapacityPerMin,
  className = "",
}: {
  zones: string[]
  /** people per minute at the peak */
  flows: { from: string; to: string; perMin: number }[]
  /** what one corridor can carry before it queues */
  corridorCapacityPerMin?: number
  className?: string
}) {
  const rows = [...flows].sort((a, b) => b.perMin - a.perMin)
  const max = Math.max(1, ...rows.map((r) => r.perMin))
  const throughput = zones.map((z) => ({
    zone: z,
    out: flows.filter((f) => f.from === z).reduce((a, f) => a + f.perMin, 0),
    in: flows.filter((f) => f.to === z).reduce((a, f) => a + f.perMin, 0),
  }))
  const busiest = throughput.reduce((a, t) => (t.in + t.out > a.in + a.out ? t : a), throughput[0])
  const over = corridorCapacityPerMin === undefined ? [] : rows.filter((r) => r.perMin > corridorCapacityPerMin)

  return (
    <div className={className}>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={`${r.from}-${r.to}`} className="flex items-center gap-2">
            <span className="w-36 shrink-0 truncate text-[10px]">
              {r.from} <span aria-hidden>→</span> {r.to}
            </span>
            <div className="relative h-4 flex-1 rounded-[2px] bg-muted">
              <div
                className="h-full rounded-[2px]"
                style={{
                  width: `${(r.perMin / max) * 100}%`,
                  background:
                    corridorCapacityPerMin !== undefined && r.perMin > corridorCapacityPerMin
                      ? "repeating-linear-gradient(135deg, currentColor 0 2px, transparent 2px 5px)"
                      : "color-mix(in oklch, currentColor 50%, transparent)",
                  outline: corridorCapacityPerMin !== undefined && r.perMin > corridorCapacityPerMin ? "1px solid currentColor" : undefined,
                  outlineOffset: -1,
                }}
              />
              {corridorCapacityPerMin !== undefined && (
                <span className="absolute inset-y-0 w-0.5 bg-foreground/70" style={{ left: `${(corridorCapacityPerMin / max) * 100}%` }} />
              )}
            </div>
            <span className="w-16 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">{r.perMin}/min</span>
          </li>
        ))}
      </ul>
      <ul className="mt-2 space-y-0.5 text-[10px] tabular-nums">
        {throughput
          .slice()
          .sort((a, b) => b.in + b.out - (a.in + a.out))
          .map((t) => (
            <li key={t.zone} className="flex items-center gap-2 text-muted-foreground">
              <span className="w-28 shrink-0 truncate text-foreground">{t.zone}</span>
              <span>
                {t.in} in, {t.out} out — {t.in + t.out} through
              </span>
            </li>
          ))}
      </ul>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        {busiest.zone} handles {busiest.in + busiest.out} people a minute, which is the zone that sets the corridor
        width ·{" "}
        {corridorCapacityPerMin === undefined
          ? "no capacity given"
          : over.length
            ? `${over.length} link${over.length === 1 ? "" : "s"} exceed ${corridorCapacityPerMin}/min and will queue`
            : `every link stays under ${corridorCapacityPerMin}/min`}
      </p>
    </div>
  )
}
