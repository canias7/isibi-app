import * as React from "react";
import { cn, toDate } from "@/lib/utils";
/**
 * "3 minutes ago" — that stops being relative when relative stops helping.
 *
 * PAST A WEEK IT SHOWS THE DATE. "3 months ago" answers a question nobody
 * asked while hiding the one they did (which month?); relative wording is
 * for the range where people think relatively — the threshold is a prop,
 * a week by default.
 *
 * IT UPDATES ITSELF ONLY AT MINUTE GRANULARITY. A "2 minutes ago" that
 * still says so at half past is stale on its face, so sub-hour values
 * re-render on a 30s tick; anything older changes too slowly for a timer
 * to earn its wakeups (the media-agent scaling lesson, in miniature).
 *
 * The full timestamp always rides in `title` and a real `<time
 * datetime>` — the date-format rule; the relative words are for people,
 * the ISO is for everything else.
 */
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31536e6], ["month", 2592e6], ["week", 6048e5], ["day", 864e5], ["hour", 36e5], ["minute", 6e4],
];

export function relativeLabel(then: Date, now: Date, thresholdMs = 6048e5): string | null {
  const diff = then.getTime() - now.getTime();
  const abs = Math.abs(diff);
  if (abs >= thresholdMs) return null; // past the threshold: show the date
  if (abs < 6e4) return "just now";
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  for (const [unit, ms] of UNITS) {
    if (abs >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return "just now";
}

export function RelativeDate({ date, thresholdDays = 7, className }: {
  date: Date | string | number;
  thresholdDays?: number;
  className?: string;
}) {
  const d = React.useMemo(() => toDate(date), [date]);
  const [, tick] = React.useReducer((n: number) => n + 1, 0);

  React.useEffect(() => {
    // Only sub-hour values change fast enough to watch.
    if (Math.abs(Date.now() - d.getTime()) >= 36e5) return;
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [d]);

  const label = relativeLabel(d, new Date(), thresholdDays * 864e5);
  const iso = isNaN(d.getTime()) ? undefined : d.toISOString();
  const absolute = isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  return (
    <time dateTime={iso} title={isNaN(d.getTime()) ? undefined : d.toLocaleString()}
      className={cn("tabular-nums", className)}>
      {label ?? absolute}
    </time>
  );
}
