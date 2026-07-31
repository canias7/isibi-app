import * as React from "react";
import { MoonStar } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Quiet hours — no notifications between these times.
 *
 * A WINDOW THAT CROSSES MIDNIGHT IS THE NORMAL CASE, not the edge one. Quiet
 * hours are 22:00 to 07:00 for almost everybody, and the naive `from <= now &&
 * now <= to` test is false for every minute of it — so the setting appears to
 * do nothing. `inQuietHours` handles the wrap, which is the whole reason this
 * is a component rather than two time inputs.
 *
 * IT SAYS WHETHER IT IS ACTIVE RIGHT NOW. A schedule with no current state
 * leaves people testing it by waiting until midnight.
 *
 * THE DAYS ARE SEPARATE from the times, because "quiet at the weekend" and
 * "quiet overnight" are different rules people want at once, and one control
 * for both forces a choice.
 *
 * URGENT THINGS BREAKING THROUGH is offered explicitly. Quiet hours that
 * suppress everything are quiet hours people turn off after one missed
 * emergency — and then get no benefit at all.
 */
export function inQuietHours(now: Date, from: string, to: string, days?: number[]) {
  if (days && days.length && !days.includes(now.getDay())) return false;
  const mins = now.getHours() * 60 + now.getMinutes();
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  const start = fh * 60 + fm, end = th * 60 + tm;
  // The window almost always crosses midnight; a simple range test is false all night.
  return start <= end ? mins >= start && mins < end : mins >= start || mins < end;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function MuteSchedule({ enabled, from, to, days, urgentBreaksThrough, onChange, className }: {
  enabled: boolean;
  from: string;
  to: string;
  days?: number[];
  urgentBreaksThrough?: boolean;
  onChange: (next: { enabled?: boolean; from?: string; to?: string; days?: number[]; urgentBreaksThrough?: boolean }) => void;
  className?: string;
}) {
  const id = React.useId();
  const active = enabled && inQuietHours(new Date(), from, to, days);

  return (
    <div className={cn("flex flex-col gap-3 rounded-lg border border-border p-3", className)}>
      <label className="flex cursor-pointer items-center gap-2.5">
        <input type="checkbox" checked={enabled} onChange={(e) => onChange({ enabled: e.target.checked })}
          className="size-4 cursor-pointer accent-foreground" />
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <MoonStar aria-hidden className="size-3.5" /> Quiet hours
        </span>
        {active ? (
          <span aria-live="polite" className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-medium text-background">
            On now
          </span>
        ) : null}
      </label>

      <div className={cn("flex flex-col gap-3", !enabled && "pointer-events-none opacity-50")}>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label htmlFor={`${id}-f`}>From</label>
          <input id={`${id}-f`} type="time" value={from} onChange={(e) => onChange({ from: e.target.value })}
            className="h-8 rounded border border-border bg-background px-2 tabular-nums outline-none focus-visible:border-ring" />
          <label htmlFor={`${id}-t`}>to</label>
          <input id={`${id}-t`} type="time" value={to} onChange={(e) => onChange({ to: e.target.value })}
            className="h-8 rounded border border-border bg-background px-2 tabular-nums outline-none focus-visible:border-ring" />
          <span className="text-muted-foreground">
            {from > to ? "crosses midnight" : null}
          </span>
        </div>

        <fieldset className="flex flex-wrap items-center gap-1">
          <legend className="sr-only">Days</legend>
          {DAYS.map((d, i) => {
            const on = !days || days.length === 0 || days.includes(i);
            return (
              <button key={d} type="button" aria-pressed={on}
                onClick={() => {
                  const base = days && days.length ? days : [0, 1, 2, 3, 4, 5, 6];
                  onChange({ days: on ? base.filter((x) => x !== i) : [...base, i].sort() });
                }}
                className={cn("cursor-pointer rounded px-1.5 py-0.5 text-[11px]",
                  on ? "bg-foreground font-medium text-background" : "border border-border text-muted-foreground")}>
                {d}
              </button>
            );
          })}
        </fieldset>

        <label className="flex cursor-pointer items-start gap-2 text-xs">
          <input type="checkbox" checked={!!urgentBreaksThrough}
            onChange={(e) => onChange({ urgentBreaksThrough: e.target.checked })}
            className="mt-0.5 size-3.5 cursor-pointer accent-foreground" />
          <span>Let urgent things through anyway. Without this, quiet hours suppress everything.</span>
        </label>
      </div>
    </div>
  );
}
