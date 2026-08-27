import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Time left until a deadline, as a bar that cannot lie at the end.
 *
 * OVERDUE DOES NOT CLIP (the tolerance-bar rule for time): past the
 * deadline the bar is full, heavy-bordered, and the words switch to
 * "overdue by 2 days" — a bar pinned at 99% forever is how deadlines
 * quietly stop meaning anything.
 *
 * THE WORDS CARRY THE CLAIM ("3 days left"), the bar carries the feel;
 * proximity is shown by WEIGHT (border thickens inside the final
 * quarter), never by a colour going red.
 *
 * The fraction needs a START, not just an end — time-left alone cannot
 * fill a bar. `from` defaults to when the component first mounted,
 * honest for "you have a week from now" and stated here for everything
 * else.
 */
export function deadlineWords(msLeft: number): string {
  const abs = Math.abs(msLeft);
  const unit = abs >= 864e5 ? [Math.round(abs / 864e5), "day"] as const
    : abs >= 36e5 ? [Math.round(abs / 36e5), "hour"] as const
    : [Math.max(1, Math.round(abs / 6e4)), "minute"] as const;
  const phrase = `${unit[0]} ${unit[1]}${unit[0] === 1 ? "" : "s"}`;
  return msLeft >= 0 ? `${phrase} left` : `overdue by ${phrase}`;
}

export function DeadlineBar({ due, from, label, now, className }: {
  due: Date;
  from?: Date;
  label?: React.ReactNode;
  /** Injectable for tests; defaults to a per-minute wall clock. */
  now?: Date;
  className?: string;
}) {
  const start = React.useRef(from ?? new Date());
  const [, tick] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    if (now) return;
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [now]);

  const t = (now ?? new Date()).getTime();
  const total = Math.max(1, due.getTime() - start.current.getTime());
  const gone = Math.min(1, Math.max(0, (t - start.current.getTime()) / total));
  const left = due.getTime() - t;
  const late = left < 0;
  const closing = !late && gone > 0.75;

  return (
    <div data-slot="deadline-bar" className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        {label ? <span className="min-w-0 truncate">{label}</span> : <span />}
        <span className={cn("shrink-0 text-xs tabular-nums", late ? "font-semibold" : "text-muted-foreground")}>
          {deadlineWords(left)}
        </span>
      </div>
      <div className={cn("h-2 overflow-hidden rounded-full border bg-muted",
        late ? "border-2 border-foreground" : closing ? "border-foreground" : "border-border")}>
        <div className="h-full bg-foreground" style={{ width: `${(late ? 1 : gone) * 100}%` }} />
      </div>
    </div>
  );
}
