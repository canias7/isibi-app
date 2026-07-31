/** Lean, operations and people diagrams. */

const TONE = "var(--foreground)";
const SHADE = (t: number) => `color-mix(in oklch, var(--foreground) ${Math.round(8 + t * 84)}%, var(--muted))`;

/* ---------------------------------------------------------------- yamazumi */
/**
 * Stacked work content per station against takt time.
 *
 * The takt line is what makes it a yamazumi rather than a stacked bar: the
 * question is not who does most, it is who is over the line, because that is
 * the station setting the pace for everyone.
 */
export function Yamazumi({
  stations, takt, height = 250, format = (n: number) => n + "s", label,
}: {
  stations: { label: string; tasks: { label: string; seconds: number; valueAdd?: boolean }[] }[];
  takt: number; height?: number; format?: (n: number) => string; label?: string;
}) {
  if (!stations.length) return null;
  const totals = stations.map((s) => s.tasks.reduce((a, t) => a + t.seconds, 0));
  const hi = Math.max(takt, ...totals) * 1.1;
  const slot = 100 / stations.length;
  const over = totals.filter((t) => t > takt).length;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${over} stations over takt`}>
      <div className="relative" style={{ height }}>
        {stations.map((s, si) => {
          let acc = 0;
          return s.tasks.map((t, ti) => {
            const bottom = (acc / hi) * 100;
            acc += t.seconds;
            return (
              <div key={`${si}-${ti}`} className="absolute flex items-center justify-center overflow-hidden text-[8px]"
                style={{
                  left: `${si * slot + slot * 0.18}%`, width: `${slot * 0.64}%`,
                  bottom: `${bottom}%`, height: `${(t.seconds / hi) * 100}%`,
                  // Non value-adding work is outlined, so the waste in each
                  // stack is countable without a key.
                  background: t.valueAdd === false ? "transparent" : SHADE(0.3 + ti * 0.18),
                  border: t.valueAdd === false ? `1px solid ${TONE}` : "1px solid var(--background)",
                  color: "var(--foreground)",
                }} title={`${s.label} · ${t.label}: ${format(t.seconds)}${t.valueAdd === false ? " (non value-add)" : ""}`} />
            );
          });
        })}
        <div className="absolute right-0 left-0 border-t-2 border-dashed border-foreground" style={{ bottom: `${(takt / hi) * 100}%` }} />
        <span className="absolute right-0 text-[9px] text-muted-foreground" style={{ bottom: `calc(${(takt / hi) * 100}% + 2px)` }}>
          takt {format(takt)}
        </span>
      </div>
      <div className="flex">
        {stations.map((s, i) => (
          <div key={s.label} className="text-center" style={{ width: `${slot}%` }}>
            <div className="truncate text-[10px] text-muted-foreground">{s.label}</div>
            <div className="text-[9px] tabular-nums" style={{ opacity: totals[i] > takt ? 1 : 0.5 }}>{format(totals[i])}</div>
          </div>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">Outlined blocks are non value-adding work</p>
    </div>
  );
}

/* --------------------------------------------------------------- takt time */
/** Cycle time per unit against the takt the demand implies. */
export function TaktTime({
  cycles, takt, height = 210, format = (n: number) => n + "s", label,
}: {
  cycles: number[]; takt: number; height?: number; format?: (n: number) => string; label?: string;
}) {
  if (!cycles.length) return null;
  const hi = Math.max(takt, ...cycles) * 1.1;
  const over = cycles.filter((c) => c > takt).length;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${over} of ${cycles.length} cycles over takt`}>
      <div className="relative flex items-end gap-[2px]" style={{ height }}>
        {cycles.map((c, i) => (
          <div key={i} className="flex-1 rounded-t-[2px]"
            style={{ height: `${(c / hi) * 100}%`, background: c > takt ? TONE : "transparent", border: c > takt ? undefined : `1px solid ${TONE}`, opacity: c > takt ? 0.9 : 0.55 }}
            title={`Unit ${i + 1}: ${format(c)}`} />
        ))}
        <div className="absolute right-0 left-0 border-t-2 border-dashed border-foreground" style={{ bottom: `${(takt / hi) * 100}%` }} />
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Takt {format(takt)} · {over} of {cycles.length} units ran over · solid bars are the misses
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- fishbone */
/** Cause-and-effect: a spine to the problem, with categorised bones. */
export function Fishbone({
  problem, categories, width = 520, height = 260, label,
}: {
  problem: string; categories: { label: string; causes: string[] }[];
  width?: number; height?: number; label?: string;
}) {
  if (!categories.length) return null;
  const midY = height / 2;
  const spineEnd = width - 118;
  const half = Math.ceil(categories.length / 2);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxWidth: width }}
      role="img" aria-label={label ?? `${categories.length} cause categories for ${problem}`}>
      <line x1={10} y1={midY} x2={spineEnd} y2={midY} stroke={TONE} strokeWidth={2} />
      <polygon points={`${spineEnd},${midY - 7} ${spineEnd + 12},${midY} ${spineEnd},${midY + 7}`} fill={TONE} />
      <rect x={spineEnd + 16} y={midY - 16} width={96} height={32} rx={4} fill={TONE} />
      <text x={spineEnd + 64} y={midY} textAnchor="middle" dominantBaseline="middle" fontSize={10} className="fill-background">{problem}</text>
      {categories.map((c, i) => {
        const up = i < half;
        const idx = up ? i : i - half;
        const slots = up ? half : categories.length - half;
        const x = 60 + (idx / Math.max(1, slots)) * (spineEnd - 110);
        const tipY = up ? midY - 92 : midY + 92;
        const tipX = x + (up ? 52 : 52);
        return (
          <g key={c.label}>
            <line x1={x} y1={midY} x2={tipX} y2={tipY} stroke={TONE} strokeWidth={1.4} />
            <text x={tipX} y={up ? tipY - 6 : tipY + 12} textAnchor="middle" fontSize={10} fontWeight={600} className="fill-foreground">{c.label}</text>
            {c.causes.slice(0, 3).map((cause, k) => {
              const t = 0.28 + k * 0.24;
              const bx = x + (tipX - x) * t;
              const by = midY + (tipY - midY) * t;
              return (
                <g key={cause}>
                  <line x1={bx} y1={by} x2={bx + 26} y2={by} stroke={TONE} strokeOpacity={0.5} strokeWidth={1} />
                  <text x={bx + 29} y={by} dominantBaseline="middle" fontSize={8} className="fill-muted-foreground">{cause}</text>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------ RACI matrix */
/** Who is Responsible, Accountable, Consulted, Informed per task. */
export function RaciMatrix({
  tasks, people, assignments, cell = 40, label,
}: {
  tasks: string[]; people: string[];
  /** assignments[task][person] = "R" | "A" | "C" | "I" | "" */ assignments: string[][];
  cell?: number; label?: string;
}) {
  if (!tasks.length) return null;
  const weight: Record<string, number> = { A: 0.92, R: 0.62, C: 0.3, I: 0.12 };
  // Exactly one Accountable per row is the rule the matrix exists to enforce.
  const badRows = tasks.filter((_, ti) => assignments[ti].filter((a) => a === "A").length !== 1);

  return (
    <div className="w-full overflow-x-auto" role="img" aria-label={label ?? `${tasks.length} tasks across ${people.length} people`}>
      <table className="border-separate" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th />
            {people.map((p) => <th key={p} className="pb-1 text-[9px] font-normal text-muted-foreground" style={{ width: cell }}>{p}</th>)}
          </tr>
        </thead>
        <tbody>
          {tasks.map((t, ti) => (
            <tr key={t}>
              <th className="pr-2 text-right text-[10px] font-normal whitespace-nowrap text-muted-foreground">{t}</th>
              {people.map((p, pi) => {
                const a = assignments[ti]?.[pi] ?? "";
                return (
                  <td key={p} className="p-0">
                    <div className="flex items-center justify-center rounded-[3px] text-[10px] font-medium"
                      style={{
                        width: cell, height: cell,
                        background: a ? SHADE(weight[a] ?? 0.2) : "var(--muted)",
                        color: (weight[a] ?? 0) > 0.5 ? "var(--background)" : "var(--foreground)",
                      }} title={`${t} · ${p}: ${a || "—"}`}>{a}</div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-[10px] text-muted-foreground">
        R responsible · A accountable · C consulted · I informed
        {badRows.length ? ` · ${badRows.length} row${badRows.length > 1 ? "s" : ""} without exactly one A` : " · every task has exactly one A"}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------- skills matrix */
/** Competence per person per skill, as filled quarters. */
export function SkillsMatrix({
  people, skills, levels, cell = 34, label,
}: {
  people: string[]; skills: string[];
  /** levels[person][skill] on 0-4. */ levels: number[][]; cell?: number; label?: string;
}) {
  if (!people.length) return null;
  const gaps = skills.map((_, si) => people.filter((_, pi) => (levels[pi]?.[si] ?? 0) >= 3).length);

  return (
    <div className="w-full overflow-x-auto" role="img" aria-label={label ?? `${people.length} people across ${skills.length} skills`}>
      <table className="border-separate" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th />
            {skills.map((s) => <th key={s} className="pb-1 text-[9px] font-normal text-muted-foreground" style={{ width: cell }}>{s.slice(0, 6)}</th>)}
          </tr>
        </thead>
        <tbody>
          {people.map((p, pi) => (
            <tr key={p}>
              <th className="pr-2 text-right text-[10px] font-normal whitespace-nowrap text-muted-foreground">{p}</th>
              {skills.map((s, si) => {
                const l = levels[pi]?.[si] ?? 0;
                return (
                  <td key={s} className="p-0">
                    {/* A quarter-filled disc rather than a shade: level is
                        ordinal and four steps are countable, where four greys
                        are not. */}
                    <div className="relative mx-auto rounded-full border" style={{ width: cell - 8, height: cell - 8, borderColor: TONE }}
                      title={`${p} · ${s}: ${l} of 4`}>
                      <div className="absolute right-0 bottom-0 left-0 rounded-b-full" style={{ height: `${(l / 4) * 100}%`, background: TONE, borderRadius: l === 4 ? "999px" : undefined }} />
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
          <tr>
            <th className="pr-2 text-right text-[9px] font-normal text-muted-foreground">cover</th>
            {gaps.map((g, i) => (
              <td key={i} className="pt-1 text-center text-[9px] tabular-nums" style={{ color: "var(--foreground)", opacity: g < 2 ? 1 : 0.55, fontWeight: g < 2 ? 600 : 400 }}>{g}</td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="mt-1 text-[10px] text-muted-foreground">Cover counts people at level 3 or above — under two is a risk</p>
    </div>
  );
}

/* ------------------------------------------------------------- rota chart */
/** Who is on, when, across a week. */
export function RotaChart({
  people, days, shifts, rowHeight = 30, dayStart = 8, dayEnd = 20, label,
}: {
  people: string[]; days: string[];
  shifts: { person: string; day: number; from: number; to: number }[];
  rowHeight?: number; dayStart?: number; dayEnd?: number; label?: string;
}) {
  if (!people.length) return null;
  const span = dayEnd - dayStart || 1;
  const dayW = 100 / days.length;

  return (
    <div className="w-full overflow-x-auto" role="img" aria-label={label ?? `${shifts.length} shifts across ${days.length} days`}>
      <div className="min-w-[460px]">
        <div className="flex pl-16">
          {days.map((d) => <div key={d} className="text-center text-[10px] text-muted-foreground" style={{ width: `${dayW}%` }}>{d}</div>)}
        </div>
        {people.map((p) => (
          <div key={p} className="flex items-stretch border-t border-border">
            <div className="flex w-16 shrink-0 items-center pr-2 text-right text-[10px] text-muted-foreground">
              <span className="w-full truncate">{p}</span>
            </div>
            <div className="relative flex-1" style={{ height: rowHeight }}>
              {days.map((_, di) => (
                <div key={di} className="absolute top-0 bottom-0 border-l border-border/50" style={{ left: `${di * dayW}%` }} />
              ))}
              {shifts.filter((s) => s.person === p).map((s, i) => (
                <div key={i} className="absolute rounded-[2px]"
                  style={{
                    left: `${s.day * dayW + ((s.from - dayStart) / span) * dayW}%`,
                    width: `${((s.to - s.from) / span) * dayW}%`,
                    top: 5, height: rowHeight - 10, background: TONE,
                  }} title={`${p} · ${days[s.day]} ${s.from}:00–${s.to}:00`} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------- incident timeline */
/** Incidents on a time axis, height by severity, with MTTR called out. */
export function IncidentTimeline({
  incidents, span, height = 200, label,
}: {
  incidents: { at: number; label: string; severity: 1 | 2 | 3; minutes: number }[];
  span: [number, number]; height?: number; label?: string;
}) {
  if (!incidents.length) return null;
  const [lo, hi] = span;
  const mttr = incidents.reduce((s, i) => s + i.minutes, 0) / incidents.length;

  return (
    <div className="w-full" role="img" aria-label={label ?? `${incidents.length} incidents, mean time to recover ${Math.round(mttr)} minutes`}>
      <div className="relative" style={{ height }}>
        <div className="absolute right-0 bottom-6 left-0 border-t border-border" />
        {incidents.map((inc, i) => {
          const x = ((inc.at - lo) / (hi - lo || 1)) * 100;
          const h = (inc.severity / 3) * (height - 40);
          return (
            <div key={i}>
              <div className="absolute w-[3px] -translate-x-1/2 rounded-t-[2px]"
                style={{ left: `${x}%`, bottom: 24, height: h, background: TONE, opacity: 0.35 + inc.severity * 0.2 }}
                title={`${inc.label} · sev ${inc.severity} · ${inc.minutes}m to recover`} />
              <div className="absolute h-[3px] -translate-x-1/2 rounded-full"
                style={{ left: `${x}%`, bottom: 22, width: `${(inc.minutes / (hi - lo)) * 100}%`, background: TONE, opacity: 0.3 }} />
            </div>
          );
        })}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Bar height is severity · the foot shows how long recovery took · MTTR {Math.round(mttr)}m
      </p>
    </div>
  );
}

/* ------------------------------------------------- defect concentration */
/** Where on the product defects cluster, as a grid over an outline. */
export function DefectConcentration({
  grid, width = 240, aspect = 1.25, regions, label,
}: {
  grid: number[][]; width?: number; aspect?: number;
  regions?: { label: string; row: number; col: number }[]; label?: string;
}) {
  if (!grid.length) return null;
  const rows = grid.length, cols = grid[0].length;
  const hi = Math.max(...grid.flat()) || 1;
  const cw = width / cols, ch = (width * aspect) / rows;
  const total = grid.flat().reduce((s, v) => s + v, 0);

  return (
    <div className="w-full">
      <div className="relative rounded-[4px] border-2 border-border" style={{ width, height: width * aspect }}
        role="img" aria-label={label ?? `${total} defects across ${rows * cols} zones`}>
        {grid.map((r, ri) =>
          r.map((v, ci) => (
            <div key={`${ri}-${ci}`} className="absolute flex items-center justify-center text-[9px] tabular-nums"
              style={{ left: ci * cw, top: ri * ch, width: cw, height: ch, background: SHADE(v / hi), color: v / hi > 0.5 ? "var(--background)" : "var(--muted-foreground)" }}
              title={`${v} defects`}>{v || ""}</div>
          ))
        )}
        {(regions ?? []).map((rg) => (
          <span key={rg.label} className="absolute text-[8px] font-medium text-muted-foreground"
            style={{ left: rg.col * cw + 2, top: rg.row * ch + 2 }}>{rg.label}</span>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">{total} defects · darker zones need attention first</p>
    </div>
  );
}
