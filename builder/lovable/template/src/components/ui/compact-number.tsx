import { cn } from "@/lib/utils";
/**
 * 12,400 as "12.4k" — short, with the real number still available.
 *
 * `Intl.NumberFormat` WITH `notation: "compact"`, which is why this adds no
 * dependency and is correct in every language. Hand-rolled k/M/B suffixes are
 * English-only: German writes "12,4 Tsd." and Japanese groups by ten thousand,
 * so a manual divide-by-1000 produces confidently wrong numbers abroad.
 *
 * THE EXACT VALUE IS ALWAYS REACHABLE — `title` for a mouse and `sr-only` text
 * for a screen reader. Compact notation is a lie by design, and a metric
 * somebody needs to act on ("12.4k" could be 12,350 or 12,449) must not be the
 * only thing on the page.
 *
 * SMALL NUMBERS ARE LEFT ALONE. "847" compacted is still "847", and a threshold
 * stops the component pretending to do something below the point where it
 * helps.
 *
 * `tabular-nums`, since these usually sit in a column of figures where
 * proportional digits stop the eye lining them up.
 */
export function CompactNumber({ value, from = 1000, locale, className }: {
  value: number;
  /** Below this the full number is printed. */
  from?: number;
  locale?: string;
  className?: string;
}) {
  if (!Number.isFinite(value)) return null;
  const full = new Intl.NumberFormat(locale).format(value);
  if (Math.abs(value) < from) {
    return <span className={cn("tabular-nums", className)}>{full}</span>;
  }
  const short = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value);
  return (
    <span className={cn("tabular-nums", className)} title={full}>
      <span aria-hidden="true">{short}</span>
      <span className="sr-only">{full}</span>
    </span>
  );
}
