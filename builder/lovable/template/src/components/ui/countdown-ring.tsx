import * as React from "react";
import { cn, divide } from "@/lib/utils";
/**
 * A ring emptying toward a moment — "starts in 4:32".
 *
 * THE TICK SCALES TO THE DISTANCE (the relative-date rule): per second
 * only inside the final hour, per minute inside a day, and not at all
 * beyond — a countdown to next Tuesday re-rendering every second is
 * 600k wasted renders. The interval re-arms as thresholds cross.
 *
 * AT ZERO IT SAYS "now", FIRES `onDone` ONCE, and stops — a ring that
 * keeps counting into negative time is a deadline-bar concern (overdue
 * is a state, not a countdown). The ring needs a span to empty over:
 * `total` defaults to time-remaining-at-mount, stated.
 *
 * mm:ss inside the hour, words beyond ("in 3 hours") — digits imply a
 * precision nobody watching a Tuesday countdown has.
 */
export function CountdownRing({ to, total, label, onDone, className }: {
  to: Date;
  totalMs?: never;
  total?: number;
  label?: React.ReactNode;
  onDone?: () => void;
  className?: string;
}) {
  const mounted = React.useRef(Date.now());
  const doneFired = React.useRef(false);
  const [, tick] = React.useReducer((n: number) => n + 1, 0);
  const left = Math.max(0, to.getTime() - Date.now());

  React.useEffect(() => {
    if (left <= 0) return;
    const interval = left <= 36e5 ? 1000 : left <= 864e5 ? 60_000 : 36e5;
    const id = setInterval(tick, interval);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left <= 36e5, left <= 864e5, left <= 0]);

  const doneRef = React.useRef(onDone);
  doneRef.current = onDone;
  React.useEffect(() => {
    if (left <= 0 && !doneFired.current) { doneFired.current = true; doneRef.current?.(); }
  }, [left]);

  const span = total ?? Math.max(1, to.getTime() - mounted.current);
  const frac = Math.min(1, Math.max(0, divide(left, span)));
  const r = 15.9, c = 2 * Math.PI * r;
  const words = left <= 0 ? "now"
    : left <= 36e5 ? `${String(Math.floor(left / 6e4)).padStart(2, "0")}:${String(Math.floor((left % 6e4) / 1000)).padStart(2, "0")}`
    : left <= 864e5 ? `in ${Math.round(left / 36e5)}h`
    : `in ${Math.round(left / 864e5)}d`;

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg viewBox="0 0 36 36" className="size-9 -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r={r} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
        <circle cx="18" cy="18" r={r} fill="none" stroke="currentColor" strokeWidth="3"
          strokeDasharray={c} strokeDashoffset={c * (1 - frac)} strokeLinecap="round" />
      </svg>
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-medium tabular-nums">{words}</span>
        {label ? <span className="text-xs text-muted-foreground">{label}</span> : null}
      </span>
    </span>
  );
}
