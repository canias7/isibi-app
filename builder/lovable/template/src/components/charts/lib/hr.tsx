/** People: pay, structure, tenure and where the leavers go. */

const TONE = "var(--foreground)";
const money = (n: number, cur = "GBP") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);

/* -------------------------------------------------------------------- nine box */
/**
 * Performance against potential, in nine cells.
 *
 * The DISTRIBUTION is stated, because the failure of this grid is everybody
 * landing in the middle box — which tells you about the raters, not the people.
 */
export function NineBox({
  people, size = 340, label,
}: {
  /** 0-2 on each axis */ people: { name: string; performance: number; potential: number }[];
  size?: number; label?: string;
}) {
  if (!people.length) return null;
  const cell = (p: number, q: number) => people.filter((x) => x.performance === p && x.potential === q);
  const middle = cell(1, 1).length;
  const LABEL = [
    ["Risk", "Inconsistent", "Enigma"],
    ["Solid", "Core", "Growth"],
    ["Specialist", "High performer", "Star"],
  ];

  return (
    <div className="w-full" style={{ maxWidth: size }}>
      <div className="flex">
        <div className="flex flex-col-reverse justify-between pr-1 text-[9px] text-muted-foreground" style={{ writingMode: "vertical-rl" }}>
          <span>low potential</span><span>high</span>
        </div>
        <div className="grid flex-1 grid-cols-3 gap-px">
          {[2, 1, 0].map((q) => [0, 1, 2].map((p) => {
            const c = cell(p, q);
            const heat = c.length / Math.max(1, people.length);
            return (
              <div key={`${p}-${q}`} className="aspect-[4/3] p-1"
                style={{ background: `color-mix(in oklch, ${TONE} ${Math.round(6 + heat * 80)}%, transparent)`, color: heat > 0.4 ? "var(--background)" : "var(--foreground)" }}>
                <div className="text-[8px] leading-tight opacity-75">{LABEL[q][p]}</div>
                <div className="text-[15px] leading-none font-semibold">{c.length}</div>
              </div>
            );
          }))}
        </div>
      </div>
      <div className="mt-0.5 flex justify-between text-[9px] text-muted-foreground" style={{ paddingLeft: "1.1rem" }}>
        <span>low performance</span><span>high</span>
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        {people.length} people · {Math.round((middle / people.length) * 100)}% in the middle box
        {middle / people.length > 0.4 ? " — that is a rating problem, not a talent one" : ""}
      </p>
    </div>
  );
}

/* ----------------------------------------------------------------- compa-ratio */
/**
 * Pay against the midpoint of the band.
 *
 * A compa-ratio under 1 is not automatically wrong — a new joiner should be
 * low — so tenure is drawn alongside, and only long-serving people below the
 * band are flagged.
 */
export function CompaRatio({
  people, height = 260, label,
}: {
  people: { name: string; salary: number; bandMid: number; yearsInRole: number }[]; height?: number; label?: string;
}) {
  if (!people.length) return null;
  const rows = people.map((p) => ({ ...p, ratio: p.salary / p.bandMid }));
  const lo = Math.min(0.75, ...rows.map((r) => r.ratio)) - 0.03;
  const hi = Math.max(1.25, ...rows.map((r) => r.ratio)) + 0.03;
  const maxYears = Math.max(...rows.map((r) => r.yearsInRole));
  const x = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const y = (yr: number) => 100 - (yr / (maxYears * 1.1)) * 100;
  const stuck = rows.filter((r) => r.ratio < 0.9 && r.yearsInRole >= 3);

  return (
    <div className="w-full">
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none">
          <rect x={x(0.9)} y={0} width={x(1.1) - x(0.9)} height={100} fill={TONE} fillOpacity={0.08} />
          <line x1={x(1)} y1={0} x2={x(1)} y2={100} stroke={TONE} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
        </svg>
        {rows.map((r) => {
          const flag = r.ratio < 0.9 && r.yearsInRole >= 3;
          return (
            <span key={r.name} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                left: `${x(r.ratio)}%`, top: `${y(r.yearsInRole)}%`, width: 9, height: 9,
                background: flag ? "var(--background)" : TONE,
                border: flag ? `2px solid ${TONE}` : undefined,
              }} title={`${r.name}: ${money(r.salary)} · ${r.ratio.toFixed(2)}`} />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{lo.toFixed(2)}</span><span>compa-ratio · 1.00 is the midpoint</span><span>{hi.toFixed(2)}</span>
      </div>
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        Height is years in role · below 0.90 is only a problem with tenure behind it —
        {stuck.length ? ` ${stuck.length} outlined: ${stuck.map((s) => s.name).join(", ")}` : " nobody is stuck low"}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ span of control */
/**
 * Direct reports per manager, with the two failure modes named: a span too
 * narrow means a layer that adds nothing, too wide means nobody is managed.
 */
export function SpanOfControl({
  managers, narrow = 3, wide = 9, height = 220, label,
}: {
  managers: { name: string; reports: number; level: number }[]; narrow?: number; wide?: number;
  height?: number; label?: string;
}) {
  if (!managers.length) return null;
  const rows = [...managers].sort((a, b) => a.reports - b.reports);
  const max = Math.max(...rows.map((r) => r.reports), wide) * 1.08;
  const tooNarrow = rows.filter((r) => r.reports <= narrow);
  const tooWide = rows.filter((r) => r.reports >= wide);

  return (
    <div className="w-full">
      <div className="relative space-y-1" style={{ minHeight: height }}>
        {rows.map((r) => {
          const flag = r.reports <= narrow || r.reports >= wide;
          return (
            <div key={r.name} className="flex items-center gap-2">
              <span className="w-[30%] shrink-0 truncate text-[10px]">
                {r.name} <span className="text-muted-foreground">L{r.level}</span>
              </span>
              <div className="relative h-3.5 flex-1">
                <span className="absolute top-0 bottom-0 left-0 rounded-[2px]" style={{
                  width: `${(r.reports / max) * 100}%`,
                  background: flag ? "var(--background)" : TONE,
                  border: flag ? `1.5px solid ${TONE}` : undefined,
                }} />
                <span className="absolute top-[-2px] bottom-[-2px] w-px" style={{ left: `${(narrow / max) * 100}%`, background: TONE, opacity: 0.5 }} />
                <span className="absolute top-[-2px] bottom-[-2px] w-px" style={{ left: `${(wide / max) * 100}%`, background: TONE, opacity: 0.5 }} />
              </div>
              <span className="w-6 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">{r.reports}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        Ticks at {narrow} and {wide} · {tooNarrow.length} too narrow (a layer that adds nothing),
        {" "}{tooWide.length} too wide (nobody is actually managed)
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- attrition curve */
/**
 * Survival by tenure, with the FIRST-YEAR cliff separated.
 *
 * A headline attrition rate mixes people who never settled with people who
 * gave years, and those are different problems with different fixes.
 */
export function AttritionCurve({
  cohorts, height = 240, label,
}: {
  cohorts: { name: string; survival: number[] }[]; height?: number; label?: string;
}) {
  if (!cohorts.length) return null;
  const n = Math.max(...cohorts.map((c) => c.survival.length));
  const x = (i: number) => (i / Math.max(1, n - 1)) * 100;
  const y = (v: number) => 100 - v * 100;
  const dashes = ["", "5 3", "2 2", "7 2 2 2"];
  const firstYear = cohorts.map((c) => ({ name: c.name, drop: (c.survival[0] ?? 1) - (c.survival[1] ?? 1) }));
  const worst = firstYear.reduce((a, b) => (b.drop > a.drop ? b : a));

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" preserveAspectRatio="none" style={{ height }}
        role="img" aria-label={label ?? `${cohorts.length} cohorts`}>
        <line x1={x(1)} y1={0} x2={x(1)} y2={100} stroke={TONE} strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.5} vectorEffect="non-scaling-stroke" />
        {cohorts.map((c, i) => (
          <polyline key={c.name} points={c.survival.map((v, j) => `${x(j)},${y(v)}`).join(" ")}
            fill="none" stroke={TONE} strokeWidth={1.9} strokeDasharray={dashes[i % dashes.length] || undefined} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>join</span><span>year 1</span><span>year {n - 1}</span>
      </div>
      <div className="mt-0.5 flex flex-wrap gap-x-3 text-[10px] text-muted-foreground">
        {cohorts.map((c, i) => (
          <span key={c.name} className="flex items-center gap-1">
            <svg width="16" height="4"><line x1={0} y1={2} x2={16} y2={2} stroke={TONE} strokeWidth={1.9} strokeDasharray={dashes[i % dashes.length] || undefined} /></svg>
            {c.name} {Math.round((c.survival[c.survival.length - 1] ?? 0) * 100)}% left
          </span>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Steepest first year is {worst.name}, losing {Math.round(worst.drop * 100)}% before the first anniversary —
        a hiring or onboarding problem, not a retention one
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ tenure distribution */
/** How long people have been here, with the median and the newcomer share. */
export function TenureDistribution({
  buckets, height = 220, label,
}: {
  buckets: { range: string; count: number; upperYears: number }[]; height?: number; label?: string;
}) {
  if (!buckets.length) return null;
  const total = buckets.reduce((s, b) => s + b.count, 0);
  const max = Math.max(...buckets.map((b) => b.count));
  let run = 0;
  const medianBucket = buckets.find((b) => { run += b.count; return run >= total / 2; }) ?? buckets[0];
  const under2 = buckets.filter((b) => b.upperYears <= 2).reduce((s, b) => s + b.count, 0);

  return (
    <div className="w-full">
      <div className="flex items-end gap-1.5" style={{ height }}>
        {buckets.map((b) => (
          <div key={b.range} className="flex-1" title={`${b.range}: ${b.count}`}
            style={{ height: `${(b.count / max) * 100}%`, background: TONE, opacity: b === medianBucket ? 1 : 0.55 }} />
        ))}
      </div>
      <div className="mt-1 flex gap-1.5">
        {buckets.map((b) => <span key={b.range} className="flex-1 text-center text-[9px] text-muted-foreground">{b.range}</span>)}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground" aria-label={label}>
        {total} people · the median sits in {medianBucket.range} (drawn solid) ·
        {Math.round((under2 / total) * 100)}% have been here two years or less
      </p>
    </div>
  );
}

/* ----------------------------------------------------------------- pay band */
/**
 * Salary bands with the people in them.
 *
 * Anyone OUTSIDE their band is the finding — over the maximum has nowhere to
 * go, under the minimum is a compliance problem — so both are counted.
 */
export function PayBand({
  bands, currency = "GBP", label,
}: {
  bands: { grade: string; min: number; mid: number; max: number; people: number[] }[]; currency?: string; label?: string;
}) {
  if (!bands.length) return null;
  const lo = Math.min(...bands.map((b) => b.min), ...bands.flatMap((b) => b.people)) * 0.95;
  const hi = Math.max(...bands.map((b) => b.max), ...bands.flatMap((b) => b.people)) * 1.05;
  const pos = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const over = bands.reduce((s, b) => s + b.people.filter((p) => p > b.max).length, 0);
  const under = bands.reduce((s, b) => s + b.people.filter((p) => p < b.min).length, 0);

  return (
    <div className="w-full space-y-2">
      {bands.map((b) => (
        <div key={b.grade}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] font-medium">{b.grade}</span>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {money(b.min, currency)} – {money(b.max, currency)} · {b.people.length} people
            </span>
          </div>
          <div className="relative mt-0.5 h-5">
            <span className="absolute top-1.5 bottom-1.5 rounded-[2px]"
              style={{ left: `${pos(b.min)}%`, width: `${pos(b.max) - pos(b.min)}%`, background: TONE, opacity: 0.18 }} />
            <span className="absolute top-0.5 bottom-0.5 w-px" style={{ left: `${pos(b.mid)}%`, background: TONE, opacity: 0.6 }} />
            {b.people.map((p, i) => {
              const out = p > b.max || p < b.min;
              return (
                <span key={i} className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    left: `${pos(p)}%`,
                    background: out ? "var(--background)" : TONE,
                    boxShadow: out ? `inset 0 0 0 1.5px ${TONE}` : undefined,
                  }} title={money(p, currency)} />
              );
            })}
          </div>
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        Shaded is the band, the tick is its midpoint · {over} above the maximum with nowhere to go,
        {" "}{under} below the minimum (both outlined)
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- headcount bridge */
/**
 * How the headcount got from one number to the other.
 *
 * Net change hides everything: 100 to 105 can be five joiners or forty joiners
 * and thirty-five leavers, and those are different companies.
 */
export function HeadcountBridge({
  opening, movements, height = 240, label,
}: {
  opening: number; movements: { label: string; delta: number }[]; height?: number; label?: string;
}) {
  if (!movements.length) return null;
  let run = opening;
  const bars = movements.map((m) => { const from = run; run += m.delta; return { ...m, from, to: run }; });
  const closing = run;
  const lo = Math.min(opening, closing, ...bars.flatMap((b) => [b.from, b.to])) * 0.9;
  const hi = Math.max(opening, closing, ...bars.flatMap((b) => [b.from, b.to])) * 1.04;
  const y = (v: number) => 100 - ((v - lo) / (hi - lo)) * 100;
  const churn = movements.reduce((s, m) => s + Math.abs(m.delta), 0);

  return (
    <div className="w-full">
      <div className="relative flex items-stretch gap-1.5" style={{ height }}>
        <div className="relative flex-1">
          <div className="absolute right-0 left-0" style={{ top: `${y(opening)}%`, bottom: 0, background: TONE }} />
        </div>
        {bars.map((b) => (
          <div key={b.label} className="relative flex-1" title={`${b.label}: ${b.delta > 0 ? "+" : ""}${b.delta}`}>
            <div className="absolute right-0 left-0" style={{
              top: `${y(Math.max(b.from, b.to))}%`, height: `${Math.abs(y(b.to) - y(b.from))}%`,
              background: b.delta >= 0 ? TONE : "var(--background)",
              border: b.delta >= 0 ? undefined : `2px solid ${TONE}`,
            }} />
          </div>
        ))}
        <div className="relative flex-1">
          <div className="absolute right-0 left-0" style={{ top: `${y(closing)}%`, bottom: 0, background: TONE }} />
        </div>
      </div>
      <div className="mt-1 flex gap-1.5 text-center text-[9px] text-muted-foreground">
        <span className="flex-1">opening<br /><span className="text-foreground">{opening}</span></span>
        {bars.map((b) => (
          <span key={b.label} className="flex-1">{b.label}<br /><span className="text-foreground">{b.delta > 0 ? "+" : ""}{b.delta}</span></span>
        ))}
        <span className="flex-1">closing<br /><span className="text-foreground">{closing}</span></span>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground" aria-label={label}>
        Net {closing - opening >= 0 ? "+" : ""}{closing - opening} on {churn} movements — the net number hides
        {" "}{Math.round(churn / Math.max(1, Math.abs(closing - opening)))}× as much actual change
      </p>
    </div>
  );
}
