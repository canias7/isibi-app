/** Moving goods: stowage, docks, rounds and how full the box actually is. */

const TONE = "var(--foreground)";

/* --------------------------------------------------------------------- bay plan */
/**
 * Containers in a bay by row and tier, with the STACK WEIGHT checked.
 *
 * A bay plan that looks tidy and puts heavy boxes high is the one that capsizes
 * things, so the centre of gravity per stack is computed rather than eyeballed.
 */
export function BayPlan({
  rows, tiers, /** slots[tier][row], null = empty */ slots, maxStackTonnes, label,
}: {
  rows: string[]; tiers: number[];
  slots: ({ id: string; tonnes: number; reefer?: boolean } | null)[][];
  maxStackTonnes?: number; label?: string;
}) {
  if (!rows.length || !tiers.length) return null;
  const stack = rows.map((_, ri) => slots.reduce((s, t) => s + (t[ri]?.tonnes ?? 0), 0));
  const over = maxStackTonnes ? stack.filter((s) => s > maxStackTonnes).length : 0;
  // Height of the stack's centre of gravity, in tiers.
  const cg = rows.map((_, ri) => {
    let m = 0, mh = 0;
    slots.forEach((t, ti) => { const w = t[ri]?.tonnes ?? 0; m += w; mh += w * (tiers.length - ti); });
    return m ? mh / m : 0;
  });
  const topHeavy = cg.reduce((best, v, i) => (v > cg[best] ? i : best), 0);
  const maxT = Math.max(...slots.flat().map((s) => s?.tonnes ?? 0), 1);

  return (
    <div className="w-full overflow-x-auto">
      <div className="inline-grid gap-px" style={{ gridTemplateColumns: `auto repeat(${rows.length}, minmax(32px, 1fr))` }}>
        {slots.map((tier, ti) => (
          <div key={tiers[ti]} className="contents">
            <span className="self-center pr-1.5 text-[9px] tabular-nums text-muted-foreground">{tiers[ti]}</span>
            {rows.map((r, ri) => {
              const s = tier[ri];
              return (
                <span key={r} className="flex aspect-[4/3] items-center justify-center text-[8px]"
                  style={{
                    background: s ? `color-mix(in oklch, ${TONE} ${Math.round(20 + (s.tonnes / maxT) * 74)}%, transparent)` : "var(--background)",
                    color: s && s.tonnes / maxT > 0.5 ? "var(--background)" : "var(--foreground)",
                    outline: s ? undefined : "1px dashed var(--border)", outlineOffset: -1,
                    boxShadow: s?.reefer ? `inset 0 0 0 1.5px var(--background)` : undefined,
                  }} title={s ? `${s.id} · ${s.tonnes} t${s.reefer ? " · reefer" : ""}` : "empty"}>
                  {s ? s.tonnes : ""}
                </span>
              );
            })}
          </div>
        ))}
        <span className="pt-1 pr-1.5 text-right text-[9px] text-muted-foreground">row</span>
        {rows.map((r) => <span key={r} className="pt-1 text-center text-[9px] font-semibold">{r}</span>)}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        Darker is heavier, inner outline is a reefer ·
        {maxStackTonnes ? `${over} stack${over === 1 ? "" : "s"} over the ${maxStackTonnes} t limit · ` : ""}
        row {rows[topHeavy]} is the most top-heavy, centre of gravity at tier {cg[topHeavy].toFixed(1)}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------- load plan */
/**
 * What goes in the vehicle, against BOTH limits.
 *
 * A load is capped by weight or by volume and almost never by both, so which
 * one binds is computed — filling the other is free capacity people forget.
 */
export function LoadPlan({
  items, maxKg, maxM3, label,
}: {
  items: { name: string; kg: number; m3: number }[]; maxKg: number; maxM3: number; label?: string;
}) {
  if (!items.length) return null;
  const kg = items.reduce((s, i) => s + i.kg, 0);
  const m3 = items.reduce((s, i) => s + i.m3, 0);
  const byWeight = kg / maxKg, byVolume = m3 / maxM3;
  const binding = byWeight >= byVolume ? "weight" : "volume";
  const slack = binding === "weight" ? 1 - byVolume : 1 - byWeight;

  const bar = (label: string, used: number, cap: number, unit: string) => (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-medium">{label}</span>
        <span className="text-[9px] tabular-nums text-muted-foreground">
          {used.toLocaleString(undefined, { maximumFractionDigits: 1 })} of {cap.toLocaleString()} {unit} · {Math.round((used / cap) * 100)}%
        </span>
      </div>
      <div className="mt-0.5 h-4 rounded-[2px]" style={{ background: "var(--muted)" }}>
        <div className="h-full rounded-[2px]" style={{
          width: `${Math.min(100, (used / cap) * 100)}%`,
          background: TONE, opacity: used / cap >= Math.max(byWeight, byVolume) ? 1 : 0.4,
        }} />
      </div>
    </div>
  );

  return (
    <div className="w-full">
      <div className="space-y-2">{bar("Weight", kg, maxKg, "kg")}{bar("Volume", m3, maxM3, "m³")}</div>
      <div className="mt-2 space-y-0.5">
        {[...items].sort((a, b) => b.kg / b.m3 - a.kg / a.m3).map((i) => (
          <div key={i.name} className="flex items-center gap-2 text-[10px]">
            <span className="flex-1 truncate">{i.name}</span>
            <span className="tabular-nums text-muted-foreground">{i.kg} kg · {i.m3} m³ · {(i.kg / i.m3).toFixed(0)} kg/m³</span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        {binding} is the binding limit, so there is {Math.round(slack * 100)}% of the other going spare ·
        listed densest first, which is what to swap to rebalance
      </p>
    </div>
  );
}

/* ----------------------------------------------------------------- dock schedule */
/** Vehicles against doors over a shift, with clashes made visible. */
export function DockSchedule({
  doors, bookings, startHour = 6, endHour = 18, label,
}: {
  doors: string[]; bookings: { door: string; from: number; to: number; ref: string; type?: string }[];
  startHour?: number; endHour?: number; label?: string;
}) {
  if (!doors.length) return null;
  const span = endHour - startHour;
  const pct = (h: number) => ((h - startHour) / span) * 100;
  const clashes = bookings.filter((b, i) =>
    bookings.some((o, j) => j !== i && o.door === b.door && b.from < o.to && o.from < b.to));
  const utilisation = doors.map((d) => {
    const mine = bookings.filter((b) => b.door === d);
    return mine.reduce((s, b) => s + (b.to - b.from), 0) / span;
  });

  return (
    <div className="w-full">
      <div className="mb-1 flex text-[9px] text-muted-foreground" style={{ paddingLeft: "16%" }}>
        {Array.from({ length: Math.floor(span / 2) + 1 }, (_, i) => startHour + i * 2).map((h) => (
          <span key={h} className="flex-1">{String(h).padStart(2, "0")}:00</span>
        ))}
      </div>
      <div className="space-y-1">
        {doors.map((d, di) => (
          <div key={d} className="flex items-center gap-2">
            <span className="w-[16%] shrink-0 truncate text-[10px] font-medium">{d}</span>
            <div className="relative h-6 flex-1 rounded-[2px]" style={{ background: "var(--muted)" }}>
              {bookings.filter((b) => b.door === d).map((b) => {
                const bad = clashes.includes(b);
                return (
                  <div key={b.ref} className="absolute top-0 bottom-0 flex items-center justify-center overflow-hidden rounded-[2px] px-1"
                    style={{
                      left: `${pct(b.from)}%`, width: `${pct(b.to) - pct(b.from)}%`,
                      background: bad ? "var(--background)" : TONE,
                      color: bad ? "var(--foreground)" : "var(--background)",
                      boxShadow: bad ? `inset 0 0 0 2px ${TONE}` : undefined,
                    }} title={`${b.ref} ${b.from}–${b.to}${b.type ? ` · ${b.type}` : ""}`}>
                    <span className="truncate text-[9px] font-medium">{b.ref}</span>
                  </div>
                );
              })}
            </div>
            <span className="w-9 shrink-0 text-right text-[9px] tabular-nums text-muted-foreground">
              {Math.round(utilisation[di] * 100)}%
            </span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        {clashes.length
          ? `${clashes.length / 2} double-booking${clashes.length / 2 === 1 ? "" : "s"} (outlined) — two vehicles on one door`
          : "no double bookings"} · door utilisation on the right
      </p>
    </div>
  );
}

/* --------------------------------------------------------------------- milk run */
/**
 * A fixed round with time windows, showing where it runs EARLY or LATE.
 *
 * Arriving early is a failure too — the dock is not ready — which a plain
 * "on time / late" split hides.
 */
export function MilkRun({
  stops, label,
}: {
  stops: { name: string; windowFrom: number; windowTo: number; arrival: number }[]; label?: string;
}) {
  if (!stops.length) return null;
  const lo = Math.min(...stops.map((s) => Math.min(s.windowFrom, s.arrival))) - 0.3;
  const hi = Math.max(...stops.map((s) => Math.max(s.windowTo, s.arrival))) + 0.3;
  const pct = (h: number) => ((h - lo) / (hi - lo)) * 100;
  const fmt = (h: number) => `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;
  const early = stops.filter((s) => s.arrival < s.windowFrom);
  const late = stops.filter((s) => s.arrival > s.windowTo);

  return (
    <div className="w-full">
      <div className="space-y-1.5">
        {stops.map((s) => {
          const bad = s.arrival < s.windowFrom || s.arrival > s.windowTo;
          return (
            <div key={s.name} className="flex items-center gap-2">
              <span className="w-[26%] shrink-0 truncate text-[10px]">{s.name}</span>
              <div className="relative h-4 flex-1 rounded-[2px]" style={{ background: "var(--muted)" }}>
                <span className="absolute top-0 bottom-0 rounded-[2px]"
                  style={{ left: `${pct(s.windowFrom)}%`, width: `${pct(s.windowTo) - pct(s.windowFrom)}%`, background: TONE, opacity: 0.22 }} />
                <span className="absolute top-[-2px] bottom-[-2px] w-0.5"
                  style={{ left: `${pct(s.arrival)}%`, background: TONE }} />
                {bad ? (
                  <span className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45"
                    style={{ left: `${pct(s.arrival)}%`, background: "var(--background)", boxShadow: `inset 0 0 0 1.5px ${TONE}` }} />
                ) : null}
              </div>
              <span className="w-16 shrink-0 text-right text-[9px] tabular-nums text-muted-foreground">{fmt(s.arrival)}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        Shaded is the booked window, the line is the actual arrival ·
        {early.length} early, {late.length} late — early is a miss too, because the dock is not ready
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- container fill */
/**
 * How full each container went out, by cube and by weight.
 *
 * The cost of a container is fixed, so the number that matters is what share of
 * a PAID box was air — computed here as the shortfall against whichever limit
 * bound it.
 */
export function ContainerFill({
  containers, label,
}: {
  containers: { ref: string; cubeUsed: number; cubeCap: number; kgUsed: number; kgCap: number }[]; label?: string;
}) {
  if (!containers.length) return null;
  const rows = containers.map((c) => {
    const cube = c.cubeUsed / c.cubeCap, wt = c.kgUsed / c.kgCap;
    return { ...c, cube, wt, fill: Math.max(cube, wt) };
  }).sort((a, b) => a.fill - b.fill);
  const meanFill = rows.reduce((s, r) => s + r.fill, 0) / rows.length;
  const wasted = rows.reduce((s, r) => s + (1 - r.fill), 0);

  return (
    <div className="w-full">
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.ref}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate font-mono text-[10px]">{r.ref}</span>
              <span className="text-[9px] tabular-nums text-muted-foreground">
                {Math.round(r.fill * 100)}% full — bound by {r.wt >= r.cube ? "weight" : "cube"}
              </span>
            </div>
            <div className="mt-0.5 flex gap-1">
              <div className="h-3 flex-1 rounded-[2px]" style={{ background: "var(--muted)" }}>
                <div className="h-full rounded-[2px]" style={{ width: `${Math.min(100, r.cube * 100)}%`, background: TONE }} />
              </div>
              <div className="h-3 flex-1 rounded-[2px]" style={{ background: "var(--muted)" }}>
                <div className="h-full rounded-[2px]" style={{
                  width: `${Math.min(100, r.wt * 100)}%`, background: TONE,
                  backgroundImage: "repeating-linear-gradient(45deg, transparent 0 2px, var(--background) 2px 3px)",
                }} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        Left bar is cube, right hatched bar is weight · mean fill {Math.round(meanFill * 100)}% ·
        the shortfall adds up to {wasted.toFixed(1)} containers of paid-for air
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- route density */
/** Drops per square of a delivery area — where the round is worth running. */
export function RouteDensity({
  /** grid[row][col] = drops */ grid, minViable, size = 300, label,
}: {
  grid: number[][]; minViable: number; size?: number; label?: string;
}) {
  if (!grid.length) return null;
  const rows = grid.length, cols = grid[0].length;
  const flat = grid.flat();
  const max = Math.max(...flat, 1);
  const total = flat.reduce((a, b) => a + b, 0);
  const viable = flat.filter((v) => v >= minViable).length;
  const inViable = flat.filter((v) => v >= minViable).reduce((a, b) => a + b, 0);

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `${viable} viable squares`}>
        {grid.flatMap((row, r) => row.map((v, c) => (
          <g key={`${r}-${c}`}>
            <rect x={(c / cols) * 100} y={(r / rows) * 100} width={100 / cols + 0.2} height={100 / rows + 0.2}
              fill={TONE} fillOpacity={(v / max) * 0.92} />
            {v >= minViable ? (
              <rect x={(c / cols) * 100 + 0.7} y={(r / rows) * 100 + 0.7}
                width={100 / cols - 1.4} height={100 / rows - 1.4}
                fill="none" stroke="var(--background)" strokeWidth={0.9} />
            ) : null}
          </g>
        )))}
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Outlined squares clear the {minViable}-drop threshold · {viable} of {rows * cols} squares hold
        {" "}{Math.round((inViable / total) * 100)}% of the {total} drops — the rest is where the round loses money
      </p>
    </div>
  );
}
