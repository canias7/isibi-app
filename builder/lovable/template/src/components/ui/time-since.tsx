import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * "4 minutes ago", kept current.
 *
 * `Intl.RelativeTimeFormat` rather than a hand-written ladder of if-statements,
 * so it is right in every language the browser knows — and languages with more
 * than two plural forms are exactly where a hand-written version produces
 * nonsense.
 *
 * IT RE-RENDERS ON A SCHEDULE MATCHED TO THE UNIT. A timestamp from ten minutes
 * ago does not need a tick every second; one from ten seconds ago does. So the
 * interval is a minute past the first hour and a second below a minute, which
 * is the difference between one timer and sixty on a page full of these.
 *
 * The absolute time is always in a real `<time datetime>` and in the `title`,
 * because "4 minutes ago" is unusable in a screenshot, a printout, or a support
 * conversation — and it is the form somebody needs the moment the relative one
 * matters.
 *
 * Future timestamps read "in 3 minutes" rather than a negative, which
 * RelativeTimeFormat handles natively.
 */
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000_000], ["month", 2_592_000_000], ["week", 604_800_000],
  ["day", 86_400_000], ["hour", 3_600_000], ["minute", 60_000], ["second", 1000],
];

export function TimeSince({ at, className }: {
  at: string | number | Date;
  className?: string;
}) {
  const target = new Date(at).getTime();
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const diff = Math.abs(Date.now() - target);
    // A minute-old stamp does not need a per-second timer.
    const every = diff < 60_000 ? 1000 : diff < 3_600_000 ? 60_000 : 600_000;
    const id = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(id);
  }, [target]);

  if (Number.isNaN(target)) return null;
  const delta = target - now;
  const abs = Math.abs(delta);
  const [unit, ms] = UNITS.find(([, size]) => abs >= size) ?? UNITS[UNITS.length - 1];
  const value = Math.round(delta / ms);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  return (
    <time dateTime={new Date(target).toISOString()} title={new Date(target).toLocaleString()}
      className={cn(className)}>
      {rtf.format(value, unit)}
    </time>
  );
}
