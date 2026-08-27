import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Task bars on a shared time axis, with the links between them drawn.
 *
 * SPANS, WHICH `timeline-horizontal` HAS NOT GOT. That component places
 * points on a line; a plan is about DURATION and about what cannot start
 * until something else finishes, so a bar has a start and an end and an
 * arrow to its dependents.
 *
 * A LATE TASK IS DRAWN LATE, NOT RECOLOURED. The bar extends past its
 * planned end with a hatched tail and the row says "3d over" — the
 * deadline-bar rule: overdue that clips is a plan that cannot admit it
 * slipped.
 *
 * THE AXIS IS COMPUTED FROM THE TASKS, so a plan cannot render off-screen,
 * and every bar is positioned in PERCENT of that span — no pixel maths, so
 * it reflows with the container instead of needing a re-measure.
 *
 * DEPENDENCIES ARE ONE SVG OVERLAY SHARING EXACTLY THE BARS' OWN BOX, on a
 * 0–100 viewBox with an explicit `width: 100%`. Two things bit here and both
 * are invisible to the compiler. `calc()` is not valid inside a path `d`, so
 * an overlay spanning the label column too draws nothing. And an `<svg>` is a
 * REPLACED element: `left: 0` with `right: 3.5rem` is over-constrained, so the
 * browser ignores `right` and uses the intrinsic viewBox width — measured at
 * 100px against a 718px bar, putting every arrow in the wrong place while
 * looking plausible. Hence the third column for the late labels: it keeps the
 * overlay and the bars in one box with no offset to get wrong.
 */
export type GanttTask = {
  id: string;
  label: string;
  start: Date;
  end: Date;
  actualEnd?: Date;
  dependsOn?: string[];
};

const ROW_H = 32;

export function GanttBars({ tasks, className }: { tasks: GanttTask[]; className?: string }) {
  const { min, span } = React.useMemo(() => {
    const times = tasks.flatMap((t) => [t.start.getTime(), (t.actualEnd ?? t.end).getTime()]);
    const lo = times.length ? Math.min(...times) : 0;
    const hi = times.length ? Math.max(...times) : 1;
    return { min: lo, span: Math.max(1, hi - lo) };
  }, [tasks]);
  const pct = (d: Date) => ((d.getTime() - min) / span) * 100;
  const index = new Map(tasks.map((t, i) => [t.id, i]));

  return (
    <div data-slot="gantt-bars" className={cn("flex text-xs", className)}>
      <div className="flex flex-col">
        {tasks.map((t) => (
          <div key={t.id} className="flex items-center pe-2" style={{ height: ROW_H }}>
            <span className="w-32 truncate">{t.label}</span>
          </div>
        ))}
      </div>

      <div className="relative flex-1">
        {tasks.map((t) => {
          const late = !!t.actualEnd && t.actualEnd > t.end;
          const days = late ? Math.round((t.actualEnd!.getTime() - t.end.getTime()) / 864e5) : 0;
          return (
            <div key={t.id} className="flex items-center" style={{ height: ROW_H }}>
              <span className="relative h-4 w-full rounded bg-muted">
                <span className="absolute inset-y-0 rounded bg-foreground"
                  style={{ left: `${pct(t.start)}%`, width: `${Math.max(1, pct(t.end) - pct(t.start))}%` }} />
                {/* Late runs PAST the planned end, hatched — it never clips. */}
                {late ? (
                  <span className="absolute inset-y-0 rounded-e border border-foreground"
                    style={{
                      left: `${pct(t.end)}%`,
                      width: `${Math.max(1, pct(t.actualEnd!) - pct(t.end))}%`,
                      backgroundImage:
                        "repeating-linear-gradient(45deg, currentColor 0 2px, transparent 2px 5px)",
                    }} />
                ) : null}
              </span>
            </div>
          );
        })}

        <svg aria-hidden viewBox={`0 0 100 ${Math.max(1, tasks.length * ROW_H)}`} preserveAspectRatio="none"
          width="100%" height="100%" className="pointer-events-none absolute inset-0">
          {tasks.flatMap((t) =>
            (t.dependsOn ?? []).map((from) => {
              const fi = index.get(from);
              const ti = index.get(t.id);
              const f = tasks.find((x) => x.id === from);
              if (fi == null || ti == null || !f) return null;
              const x1 = pct(f.end);
              const x2 = pct(t.start);
              const y1 = fi * ROW_H + ROW_H / 2;
              const y2 = ti * ROW_H + ROW_H / 2;
              const mid = Math.max(x1, x2 - 2);
              return (
                <path key={`${from}-${t.id}`} d={`M ${x1} ${y1} H ${mid} V ${y2} H ${x2}`}
                  vectorEffect="non-scaling-stroke" fill="none" stroke="currentColor"
                  strokeWidth="1" strokeDasharray="3 2" opacity="0.55" />
              );
            }).filter(Boolean),
          )}
        </svg>
      </div>

      <div className="flex flex-col">
        {tasks.map((t) => {
          const late = !!t.actualEnd && t.actualEnd > t.end;
          const days = late ? Math.round((t.actualEnd!.getTime() - t.end.getTime()) / 864e5) : 0;
          return (
            <div key={t.id} className="flex items-center ps-2" style={{ height: ROW_H }}>
              <span className="w-14 text-[11px] font-medium tabular-nums">{late ? `${days}d over` : ""}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
