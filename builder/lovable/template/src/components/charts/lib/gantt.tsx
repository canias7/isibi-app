/**
 * A schedule: one row per task, bars positioned along a shared time axis.
 *
 * Deliberately NOT a generic timeline component — the thing a small business
 * asks for is "who is on which chair between 9 and 5", and that is a row per
 * resource with non-overlapping bars, plus a today marker.
 *
 * Dates are handled as plain day numbers rather than Date objects: the caller
 * already knows its own calendar, and a component that parses date strings
 * grows a timezone bug the first time somebody is in Lisbon.
 */
export type Task = {
  name: string;
  /** Inclusive start, in whatever unit the axis is labelled with. */
  start: number;
  /** Exclusive end. `end - start` is the bar's length. */
  end: number;
  /** Optional grouping row; tasks sharing a lane stack on one line. */
  lane?: string;
  tone?: "solid" | "muted" | "outline";
  done?: number;
};

export function Gantt({
  tasks,
  ticks,
  min,
  max,
  today,
  rowHeight = 28,
  labelWidth = 96,
  showGrid = true,
  label,
}: {
  tasks: Task[];
  /** Axis labels, evenly spaced across [min, max]. */
  ticks?: string[];
  min?: number;
  max?: number;
  today?: number;
  rowHeight?: number;
  labelWidth?: number;
  showGrid?: boolean;
  label?: string;
}) {
  if (!tasks.length) return null;

  const lo = min ?? Math.min(...tasks.map((t) => t.start));
  const hi = max ?? Math.max(...tasks.map((t) => t.end));
  const span = hi - lo || 1;

  // Lanes let two tasks share a row when they do not overlap, which is how a
  // rota is actually read. Without it a six-appointment day is six rows tall.
  const lanes: string[] = [];
  for (const t of tasks) {
    const key = t.lane ?? t.name;
    if (!lanes.includes(key)) lanes.push(key);
  }

  const w = 100;
  const x = (v: number) => ((v - lo) / span) * w;
  const h = lanes.length * rowHeight;

  const fill = (t: Task) =>
    t.tone === "muted"
      ? "color-mix(in oklch, var(--foreground) 30%, transparent)"
      : t.tone === "outline"
        ? "transparent"
        : "var(--foreground)";

  return (
    <div className="w-full" role="img" aria-label={label ?? `${tasks.length} tasks across ${lanes.length} rows`}>
      <div className="flex">
        <div style={{ width: labelWidth }} className="shrink-0" />
        <div className="relative flex-1">
          {ticks?.length ? (
            <div className="flex justify-between pb-1 text-[10px] text-muted-foreground">
              {ticks.map((t) => <span key={t}>{t}</span>)}
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex">
        <div style={{ width: labelWidth }} className="shrink-0">
          {lanes.map((l) => (
            <div key={l} style={{ height: rowHeight }} className="flex items-center pr-2 text-xs text-muted-foreground">
              <span className="truncate">{l}</span>
            </div>
          ))}
        </div>
        <div className="relative flex-1" style={{ height: h }}>
          {showGrid && ticks?.length
            ? ticks.map((t, i) => (
                <div key={t + i} className="absolute top-0 bottom-0 border-l border-border/60"
                  style={{ left: `${(i / (ticks.length - 1 || 1)) * 100}%` }} />
              ))
            : null}
          {lanes.map((l, i) => (
            <div key={l} className="absolute right-0 left-0 border-b border-border/40"
              style={{ top: (i + 1) * rowHeight - 1, height: 1 }} />
          ))}
          {tasks.map((t, i) => {
            const row = lanes.indexOf(t.lane ?? t.name);
            const left = x(t.start);
            const width = Math.max(0.6, x(t.end) - left);
            return (
              <div key={`${t.name}-${i}`}
                className="absolute rounded-[3px] text-[10px] leading-none"
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  top: row * rowHeight + 5,
                  height: rowHeight - 12,
                  background: fill(t),
                  border: t.tone === "outline" ? "1px solid var(--foreground)" : undefined,
                }}
                title={`${t.name}: ${t.start}–${t.end}`}
              >
                {typeof t.done === "number" ? (
                  <div className="h-full rounded-[3px] bg-foreground"
                    style={{ width: `${Math.max(0, Math.min(100, t.done))}%` }} />
                ) : null}
              </div>
            );
          })}
          {typeof today === "number" ? (
            <div className="absolute top-0 bottom-0 border-l border-dashed border-foreground" style={{ left: `${x(today)}%` }} title="Now" />
          ) : null}
        </div>
      </div>
    </div>
  );
}
