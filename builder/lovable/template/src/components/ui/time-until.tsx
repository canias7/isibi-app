import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A live count to a moment — "in 2h 14m", ticking.
 *
 * Different from `Countdown`, which is a marketing timer, and from `TimeAgo`,
 * which is static and points backwards. This one keeps updating and is for a
 * booking that is coming up.
 *
 * The tick rate follows the distance: once a second inside a minute, once a
 * minute otherwise. A page with forty of these re-rendering every second is
 * a page that drains a phone.
 *
 * The full date is always in a `<time dateTime>` title, so the exact moment
 * is recoverable from a relative phrase.
 */
export function TimeUntil({ date, past = "now", className }: {
  date: string | number | Date; past?: string; className?: string;
}) {
  const target = new Date(date);
  const valid = !Number.isNaN(target.getTime());
  const [, tick] = React.useState(0);
  const left = valid ? target.getTime() - Date.now() : 0;
  React.useEffect(() => {
    if (!valid || left <= 0) return;
    const every = left < 60_000 ? 1000 : 60_000;
    const t = setInterval(() => tick((n) => n + 1), every);
    return () => clearInterval(t);
  }, [valid, left < 60_000, left <= 0]);
  if (!valid) return null;
  if (left <= 0) return <span className={className}>{past}</span>;
  const s = Math.floor(left / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60), d = Math.floor(h / 24);
  const text = d > 0 ? `${d}d ${h % 24}h` : h > 0 ? `${h}h ${m % 60}m` : m > 0 ? `${m}m` : `${s}s`;
  return (
    <time dateTime={target.toISOString()} title={target.toLocaleString()}
      className={cn("tabular-nums", className)}>in {text}</time>
  );
}
