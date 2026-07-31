/** Planning and organisational diagrams. */

const TONE = "var(--foreground)";

/* --------------------------------------------------------------------- SWOT */
/** The 2×2 of strengths, weaknesses, opportunities, threats. */
export function SwotGrid({
  strengths, weaknesses, opportunities, threats, label,
}: {
  strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[]; label?: string;
}) {
  const quad = (title: string, items: string[], dark: boolean) => (
    <div className="rounded-[4px] p-2.5" style={{ background: dark ? TONE : "var(--muted)", color: dark ? "var(--background)" : "var(--foreground)" }}>
      <div className="text-[10px] font-semibold tracking-wide uppercase opacity-80">{title}</div>
      <ul className="mt-1 space-y-0.5">
        {items.map((it) => <li key={it} className="text-[10px] leading-tight">· {it}</li>)}
      </ul>
    </div>
  );
  return (
    <div role="img" aria-label={label ?? "SWOT grid"}>
      <div className="grid grid-cols-2 gap-2">
        {quad("Strengths", strengths, true)}
        {quad("Weaknesses", weaknesses, false)}
        {quad("Opportunities", opportunities, false)}
        {quad("Threats", threats, true)}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground">Internal on top, external below · helpful on the left</p>
    </div>
  );
}

/* ------------------------------------------------------------------ OKR tree */
/**
 * An objective with its key results, each carrying progress.
 *
 * The objective's own progress is the MEAN of its key results, computed — an
 * objective that reports a different number from its KRs is the standard OKR
 * theatre this layout exists to prevent.
 */
export function OkrTree({
  objective, keyResults, label,
}: {
  objective: string; keyResults: { label: string; progress: number }[]; label?: string;
}) {
  if (!keyResults.length) return null;
  const overall = keyResults.reduce((s, k) => s + k.progress, 0) / keyResults.length;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${Math.round(overall * 100)}% towards ${objective}`}>
      <div className="rounded-[4px] p-2.5" style={{ background: TONE, color: "var(--background)" }}>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] font-medium">{objective}</span>
          <span className="text-[11px] font-semibold tabular-nums">{Math.round(overall * 100)}%</span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full" style={{ background: "color-mix(in oklch, var(--background) 25%, transparent)" }}>
          <div className="h-full rounded-full" style={{ width: `${overall * 100}%`, background: "var(--background)" }} />
        </div>
      </div>
      <div className="mt-2 space-y-1.5 pl-4">
        {keyResults.map((k) => (
          <div key={k.label} className="relative">
            <div className="absolute top-1/2 -left-4 h-px w-3 bg-border" />
            <div className="flex items-center gap-2">
              <span className="w-40 flex-1 truncate text-[10px]">{k.label}</span>
              <div className="h-2 w-28 rounded-full bg-muted">
                <div className="h-full rounded-full" style={{ width: `${k.progress * 100}%`, background: TONE }} />
              </div>
              <span className="w-8 text-right text-[10px] tabular-nums text-muted-foreground">{Math.round(k.progress * 100)}%</span>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground">The objective's number is the mean of its key results, not a separate claim</p>
    </div>
  );
}

/* ---------------------------------------------------------------- metro map */
/** A schematic network: lines through stations, interchanges ringed twice. */
export function MetroMap({
  lines, size = 300, label,
}: {
  lines: { label: string; dash?: string; stops: { x: number; y: number; label?: string; interchange?: boolean }[] }[];
  size?: number; label?: string;
}) {
  if (!lines.length) return null;

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `${lines.length} lines`}>
        {lines.map((l, li) => (
          <polyline key={l.label} points={l.stops.map((s) => `${s.x},${s.y}`).join(" ")}
            fill="none" stroke={TONE} strokeWidth={2.2} strokeOpacity={0.85 - li * 0.22}
            strokeDasharray={l.dash} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {lines.flatMap((l) => l.stops).map((s, i) => (
          <g key={i}>
            {s.interchange ? (
              <circle cx={s.x} cy={s.y} r={2.6} fill="var(--background)" stroke={TONE} strokeWidth={1.4} />
            ) : (
              <circle cx={s.x} cy={s.y} r={1.4} fill="var(--background)" stroke={TONE} strokeWidth={1} />
            )}
            {s.label ? (
              // Right-edge stations anchor end, or the name runs off the canvas
              // — "Hilltop" rendered as "Hillt" until this did.
              <text x={s.x > 70 ? s.x - 3.2 : s.x + 3.2} y={s.y - 2.4} fontSize={4.6}
                textAnchor={s.x > 70 ? "end" : "start"} className="fill-muted-foreground">{s.label}</text>
            ) : null}
          </g>
        ))}
      </svg>
      <div className="mt-1 flex gap-3 text-[10px] text-muted-foreground">
        {lines.map((l, i) => <span key={l.label}>{l.dash ? "┄" : "—"} {l.label}</span>)}
        <span>◎ interchange</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ seating chart */
/** Tables with seats around them, occupied seats filled. */
export function SeatingChart({
  tables, size = 300, label,
}: {
  tables: { label: string; x: number; y: number; seats: boolean[] }[]; size?: number; label?: string;
}) {
  if (!tables.length) return null;
  const total = tables.reduce((s, t) => s + t.seats.length, 0);
  const taken = tables.reduce((s, t) => s + t.seats.filter(Boolean).length, 0);

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `${taken} of ${total} seats taken`}>
        {tables.map((t) => (
          <g key={t.label}>
            <circle cx={t.x} cy={t.y} r={6.4} fill="var(--muted)" stroke="var(--border)" />
            <text x={t.x} y={t.y} textAnchor="middle" dominantBaseline="middle" fontSize={4.4} className="fill-foreground">{t.label}</text>
            {t.seats.map((occupied, si) => {
              const a = (si / t.seats.length) * Math.PI * 2 - Math.PI / 2;
              const sx = t.x + Math.cos(a) * 10, sy = t.y + Math.sin(a) * 10;
              return occupied ? (
                <circle key={si} cx={sx} cy={sy} r={2} fill={TONE} />
              ) : (
                <circle key={si} cx={sx} cy={sy} r={2} fill="var(--background)" stroke={TONE} strokeWidth={0.8} />
              );
            })}
          </g>
        ))}
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Filled seats are taken · {taken} of {total} ({Math.round((taken / total) * 100)}%)
      </p>
    </div>
  );
}

/* ------------------------------------------------------ resource histogram */
/**
 * Workload per person per period, stacked, against a capacity line — the
 * chart that lives UNDER a project plan and says whether the plan is possible.
 * Overload is drawn as an outlined block above the line, so it cannot hide
 * inside a taller stack.
 */
export function ResourceHistogram({
  periods, people, hours, capacity, height = 230, label,
}: {
  periods: string[]; people: string[];
  /** hours[period][person] */ hours: number[][]; capacity: number; height?: number; label?: string;
}) {
  if (!periods.length) return null;
  const totals = hours.map((h) => h.reduce((s, v) => s + v, 0));
  const hi = Math.max(capacity, ...totals) * 1.12;
  const slot = 100 / periods.length;
  const over = totals.filter((t) => t > capacity).length;
  const tone = (i: number) => `color-mix(in oklch, var(--foreground) ${Math.round(80 - (i / Math.max(1, people.length - 1)) * 55)}%, transparent)`;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${over} periods over capacity`}>
      <div className="relative" style={{ height }}>
        {periods.map((_, pi) => {
          let acc = 0;
          return people.map((person, hi2) => {
            const v = hours[pi]?.[hi2] ?? 0;
            const bottom = acc; acc += v;
            const under = Math.max(0, Math.min(acc, capacity) - bottom);
            const overPart = v - under;
            return (
              <div key={`${pi}-${hi2}`}>
                {under > 0 ? (
                  <div className="absolute"
                    style={{ left: `${pi * slot + slot * 0.18}%`, width: `${slot * 0.64}%`, bottom: `${(bottom / hi) * 100}%`, height: `${(under / hi) * 100}%`, background: tone(hi2), borderTop: "1px solid var(--background)" }}
                    title={`${periods[pi]} · ${person}: ${v}h`} />
                ) : null}
                {overPart > 0 ? (
                  <div className="absolute border-2"
                    style={{ left: `${pi * slot + slot * 0.18}%`, width: `${slot * 0.64}%`, bottom: `${(Math.max(bottom, capacity) / hi) * 100}%`, height: `${(overPart / hi) * 100}%`, borderColor: TONE, background: "var(--background)" }}
                    title={`${periods[pi]} · ${person}: ${overPart}h over`} />
                ) : null}
              </div>
            );
          });
        })}
        <div className="absolute right-0 left-0 border-t-2 border-dashed border-foreground" style={{ bottom: `${(capacity / hi) * 100}%` }} />
      </div>
      <div className="flex">
        {periods.map((p) => <div key={p} className="text-center text-[9px] text-muted-foreground" style={{ width: `${slot}%` }}>{p}</div>)}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        {people.map((p, i) => (
          <span key={p} className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: tone(i) }} />{p}</span>
        ))}
        <span>· outlined is over the {capacity}h line</span>
      </div>
    </div>
  );
}
