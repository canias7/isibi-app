/** Training: load, zones, strength and recovery. */

const TONE = "var(--foreground)";

/* ------------------------------------------------------------------ training load */
/**
 * Acute load against chronic, with the RATIO — which is the whole measure.
 *
 * A hard week is only a risk relative to what the body is used to, so the
 * 7-day over 28-day ratio is computed and its sweet spot drawn.
 */
export function TrainingLoad({
  daily, height = 250, label,
}: {
  /** session load per day, oldest first */ daily: number[]; height?: number; label?: string;
}) {
  if (daily.length < 28) return null;
  const mean = (from: number, n: number) => {
    const slice = daily.slice(Math.max(0, from - n + 1), from + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  };
  const rows = daily.map((_, i) => {
    const acute = mean(i, 7), chronic = mean(i, 28);
    return { acute, chronic, ratio: chronic > 0 ? acute / chronic : 0 };
  });
  const maxLoad = Math.max(...rows.map((r) => Math.max(r.acute, r.chronic))) * 1.08;
  const x = (i: number) => (i / (daily.length - 1)) * 100;
  const spikes = rows.filter((r, i) => i >= 28 && r.ratio > 1.5).length;
  const now = rows[rows.length - 1];

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" preserveAspectRatio="none" style={{ height }}
        role="img" aria-label={label ?? `ratio ${now.ratio.toFixed(2)}`}>
        <polyline points={rows.map((r, i) => `${x(i)},${100 - (r.chronic / maxLoad) * 100}`).join(" ")}
          fill="none" stroke={TONE} strokeWidth={2.4} strokeOpacity={0.4} vectorEffect="non-scaling-stroke" />
        <polyline points={rows.map((r, i) => `${x(i)},${100 - (r.acute / maxLoad) * 100}`).join(" ")}
          fill="none" stroke={TONE} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="relative mt-2 h-5 rounded-[2px]" style={{ background: "var(--muted)" }}>
        <div className="absolute top-0 bottom-0 rounded-[2px]" style={{ left: "40%", width: "26.7%", background: TONE, opacity: 0.2 }} />
        <div className="absolute top-[-2px] bottom-[-2px] w-0.5" style={{ left: `${Math.min(98, (now.ratio / 2.5) * 100)}%`, background: TONE }} />
        <span className="absolute top-0.5 left-1 text-[9px] text-muted-foreground">0</span>
        <span className="absolute top-0.5 right-1 text-[9px] text-muted-foreground">2.5</span>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Solid is the 7-day load, pale the 28-day · the shaded band is 1.0–1.5, where adaptation happens ·
        now at {now.ratio.toFixed(2)}{spikes ? ` · ${spikes} days spent above 1.5` : " · never above 1.5"}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- heart rate zones */
/**
 * Time in each zone, with the zones DERIVED from max heart rate rather than
 * taken as fixed numbers — a zone table that ignores the athlete is a table
 * about somebody else.
 */
export function HeartRateZones({
  maxHr, minutesInZone, height = 220, label,
}: {
  maxHr: number; /** five zones, low to high */ minutesInZone: number[]; height?: number; label?: string;
}) {
  if (minutesInZone.length < 5) return null;
  const BOUNDS = [0.5, 0.6, 0.7, 0.8, 0.9, 1];
  const NAMES = ["Recovery", "Endurance", "Tempo", "Threshold", "VO₂ max"];
  const total = minutesInZone.reduce((a, b) => a + b, 0);
  const max = Math.max(...minutesInZone);
  const hard = (minutesInZone[3] + minutesInZone[4]) / total;

  return (
    <div className="w-full" style={{ minHeight: height }}>
      <div className="space-y-1">
        {NAMES.map((n, i) => (
          <div key={n} className="flex items-center gap-2">
            <span className="w-[26%] shrink-0 text-[10px]">{n}</span>
            <span className="w-20 shrink-0 text-[9px] tabular-nums text-muted-foreground">
              {Math.round(maxHr * BOUNDS[i])}–{Math.round(maxHr * BOUNDS[i + 1])}
            </span>
            <span className="h-3.5 rounded-[2px]" style={{
              width: `${(minutesInZone[i] / max) * 52}%`,
              background: TONE, opacity: 0.4 + i * 0.15,
            }} />
            <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground">
              {minutesInZone[i]} min · {Math.round((minutesInZone[i] / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        Zones derived from a max of {maxHr} bpm · {Math.round(total)} minutes total ·
        {Math.round(hard * 100)}% at threshold or above
        {hard > 0.25 ? " — more than a quarter, which is a lot of hard work to recover from" : ""}
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- one rep max */
/**
 * Estimated 1RM from working sets, using Epley.
 *
 * Different rep ranges give different estimates, and the SPREAD between them
 * is the honest uncertainty — a single number pretends there is none.
 */
export function OneRepMax({
  sets, height = 230, label,
}: {
  sets: { date: string; weight: number; reps: number }[]; height?: number; label?: string;
}) {
  if (!sets.length) return null;
  const rows = sets.map((s) => ({ ...s, e1rm: s.weight * (1 + s.reps / 30) }));
  const est = rows.map((r) => r.e1rm);
  const lo = Math.min(...est), hi = Math.max(...est);
  const mean = est.reduce((a, b) => a + b, 0) / est.length;
  const max = hi * 1.08;

  return (
    <div className="w-full">
      {/* items-stretch + h-full: under items-end each column shrinks to its (zero
          height) content, so every absolutely-positioned bar resolved its
          percentage against 0 and the whole plot came out blank. */}
      <div className="relative flex items-stretch gap-2" style={{ height }}>
        {rows.map((r, i) => (
          <div key={i} className="relative h-full flex-1" title={`${r.weight} × ${r.reps} → ${r.e1rm.toFixed(1)}`}>
            <div className="absolute bottom-0 w-full" style={{ height: `${(r.weight / max) * 100}%`, background: TONE, opacity: 0.3 }} />
            <div className="absolute right-0 left-0 h-0.5" style={{ bottom: `${(r.e1rm / max) * 100}%`, background: TONE }} />
          </div>
        ))}
        <div className="pointer-events-none absolute right-0 left-0 border-t border-dashed border-foreground"
          style={{ bottom: `${(mean / max) * 100}%` }} />
      </div>
      <div className="mt-1 flex gap-2">
        {rows.map((r, i) => (
          <span key={i} className="flex-1 text-center text-[9px] text-muted-foreground">{r.weight}×{r.reps}</span>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground" aria-label={label}>
        Pale is the weight lifted, the line above it is the Epley estimate ·
        {mean.toFixed(1)} kg on average, but the estimates run {lo.toFixed(1)} to {hi.toFixed(1)} —
        a {Math.round(((hi - lo) / mean) * 100)}% spread, which a single number hides
      </p>
    </div>
  );
}

/* --------------------------------------------------------------------- pace band */
/**
 * Target splits for a race, with the CUMULATIVE time — which is what a runner
 * actually checks, and what an even-split plan is judged on.
 */
export function PaceBand({
  segments, targetMinutes, label,
}: {
  segments: { km: number; paceSecPerKm: number; note?: string }[]; targetMinutes: number; label?: string;
}) {
  if (!segments.length) return null;
  // `km` is the DISTANCE MARKER the split was taken at, which is how it is
  // labelled ("28 km") — so a segment's own length is the step from the previous
  // marker, and the race distance is the LAST marker. Reading km as a per-row
  // length instead made the elapsed time accumulate the running total (split 2
  // landed at 13:30 rather than 9:00) and put the even pace at 0:12/km.
  let run = 0;
  const rows = segments.map((s, i) => {
    const span = i === 0 ? s.km : s.km - segments[i - 1].km;
    const secs = Math.max(0, span) * s.paceSecPerKm;
    run += secs;
    return { ...s, secs, cumulative: run };
  });
  const totalKm = segments[segments.length - 1].km;
  const evenPace = (targetMinutes * 60) / Math.max(totalKm, 1e-9);
  const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
  const maxPace = Math.max(...rows.map((r) => r.paceSecPerKm), evenPace) * 1.04;
  const minPace = Math.min(...rows.map((r) => r.paceSecPerKm), evenPace) * 0.96;
  const delta = run - targetMinutes * 60;

  return (
    <div className="w-full space-y-1">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-[10px] tabular-nums">{r.km} km</span>
          <div className="relative h-3.5 flex-1 rounded-[2px]" style={{ background: "var(--muted)" }}>
            <span className="absolute top-0 bottom-0 rounded-[2px]" style={{
              left: `${((Math.min(r.paceSecPerKm, evenPace) - minPace) / (maxPace - minPace)) * 100}%`,
              width: `${(Math.abs(r.paceSecPerKm - evenPace) / (maxPace - minPace)) * 100}%`,
              background: TONE,
            }} />
            <span className="absolute top-[-2px] bottom-[-2px] w-px" style={{ left: `${((evenPace - minPace) / (maxPace - minPace)) * 100}%`, background: TONE }} />
          </div>
          <span className="w-32 shrink-0 text-right text-[9px] tabular-nums text-muted-foreground">
            {fmt(r.paceSecPerKm)}/km · through {fmt(r.cumulative)}{r.note ? ` · ${r.note}` : ""}
          </span>
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        The tick is even pace for {targetMinutes} min ({fmt(evenPace)}/km) · bars show how far each segment
        departs from it · this plan finishes {delta >= 0 ? `${fmt(delta)} slow` : `${fmt(-delta)} fast`}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ body composition */
/**
 * Weight split into lean mass and fat, over time.
 *
 * Total weight alone cannot tell a good change from a bad one — losing three
 * kilos of muscle looks identical to losing three of fat — so the split is
 * what is drawn.
 */
export function BodyComposition({
  points, height = 240, label,
}: {
  points: { date: string; leanKg: number; fatKg: number }[]; height?: number; label?: string;
}) {
  if (points.length < 2) return null;
  const max = Math.max(...points.map((p) => p.leanKg + p.fatKg)) * 1.05;
  const first = points[0], last = points[points.length - 1];
  const dLean = last.leanKg - first.leanKg, dFat = last.fatKg - first.fatKg;
  const dTotal = dLean + dFat;

  return (
    <div className="w-full">
      <div className="flex items-end gap-1" style={{ height }}>
        {points.map((p) => (
          <div key={p.date} className="flex h-full flex-1 flex-col justify-end" title={p.date}>
            <span style={{
              height: `${(p.fatKg / max) * 100}%`, background: "var(--background)",
              boxShadow: `inset 0 0 0 1.2px ${TONE}`,
            }} />
            <span style={{ height: `${(p.leanKg / max) * 100}%`, background: TONE }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{first.date}</span><span>{last.date}</span>
      </div>
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        Solid is lean mass, outlined is fat · total {dTotal >= 0 ? "+" : ""}{dTotal.toFixed(1)} kg, made of
        {" "}{dLean >= 0 ? "+" : ""}{dLean.toFixed(1)} lean and {dFat >= 0 ? "+" : ""}{dFat.toFixed(1)} fat —
        which is the distinction the scales cannot make
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- sleep readiness */
/**
 * Sleep, resting heart rate and variability against each person's own
 * BASELINE — absolute numbers say nothing across people, so everything is
 * shown as a departure from that individual's normal.
 */
export function SleepReadiness({
  days, baseline, height = 250, label,
}: {
  days: { date: string; sleepHours: number; restingHr: number; hrvMs: number }[];
  baseline: { sleepHours: number; restingHr: number; hrvMs: number }; height?: number; label?: string;
}) {
  if (!days.length) return null;
  const dev = days.map((d) => ({
    date: d.date,
    sleep: (d.sleepHours - baseline.sleepHours) / baseline.sleepHours,
    hr: -(d.restingHr - baseline.restingHr) / baseline.restingHr,
    hrv: (d.hrvMs - baseline.hrvMs) / baseline.hrvMs,
  }));
  const max = Math.max(...dev.flatMap((d) => [Math.abs(d.sleep), Math.abs(d.hr), Math.abs(d.hrv)])) * 1.1;
  const score = dev.map((d) => (d.sleep + d.hr + d.hrv) / 3);
  const worst = score.indexOf(Math.min(...score));

  const row = (get: (d: (typeof dev)[number]) => number, name: string) => (
    <div className="flex items-center gap-2">
      <span className="w-[22%] shrink-0 text-[10px]">{name}</span>
      <div className="flex flex-1 items-center gap-[2px]" style={{ height: 36 }}>
        {dev.map((d, i) => {
          const v = get(d);
          // A floor, because most days sit close to baseline and a true-to-scale
          // bar for a 2% departure is a hairline — the whole row read as blank.
          const h = Math.max(v === 0 ? 0 : 6, (Math.abs(v) / max) * 50);
          return (
            <div key={i} className="relative h-full flex-1" title={`${d.date}: ${(v * 100).toFixed(1)}%`}>
              <span className="absolute right-0 left-0" style={{
                top: v >= 0 ? `${50 - h}%` : "50%",
                height: `${h}%`,
                background: v >= 0 ? TONE : "var(--background)",
                boxShadow: v >= 0 ? undefined : `inset 0 0 0 1px ${TONE}`,
              }} />
              <span className="absolute right-0 left-0 top-1/2 h-px" style={{ background: "var(--border)" }} />
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="w-full space-y-1" style={{ minHeight: height }}>
      {row((d) => d.sleep, "Sleep")}
      {row((d) => d.hr, "Resting HR")}
      {row((d) => d.hrv, "HRV")}
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        Everything is a departure from this person's own baseline — {baseline.sleepHours} h,
        {" "}{baseline.restingHr} bpm, {baseline.hrvMs} ms · solid is better than normal, outlined worse ·
        the worst day is {days[worst].date}
      </p>
    </div>
  );
}
