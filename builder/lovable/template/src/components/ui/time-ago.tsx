import { toDate } from "@/lib/utils";
/**
 * "3 hours ago", in the visitor's own language.
 *
 * Uses Intl.RelativeTimeFormat rather than a date library — no dependency, and it
 * localises for free. The <time> element carries the real timestamp, so the exact
 * moment is available on hover and to a machine reading the page.
 */
export function TimeAgo({ date, className }: { date: string | number | Date; className?: string }) {
  const d = toDate(date);
  if (Number.isNaN(d.getTime())) return null;
  const secs = Math.round((d.getTime() - Date.now()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] =
    [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  let text = rtf.format(secs, "second");
  for (const [unit, size] of units) {
    if (Math.abs(secs) >= size) { text = rtf.format(Math.round(secs / size), unit); break; }
  }
  return <time dateTime={d.toISOString()} title={d.toLocaleString()} className={className}>{text}</time>;
}
