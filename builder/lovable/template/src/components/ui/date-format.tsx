import { toDate } from "@/lib/utils";
/**
 * A date, localised, inside a real <time>.
 *
 * The machine-readable value is always the ISO string, whatever the display
 * format — which is what lets a crawler read an event date it cannot parse from
 * "Tue 3 Aug".
 */
export function DateFormat({ date, style = "medium", withTime, className }: {
  date: string | number | Date; style?: "short" | "medium" | "long"; withTime?: boolean; className?: string;
}) {
  const d = toDate(date);
  if (Number.isNaN(d.getTime())) return null;
  const opts: Intl.DateTimeFormatOptions =
    style === "short" ? { day: "numeric", month: "numeric", year: "2-digit" }
    : style === "long" ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
    : { day: "numeric", month: "short", year: "numeric" };
  if (withTime) { opts.hour = "2-digit"; opts.minute = "2-digit"; }
  return <time dateTime={d.toISOString()} className={className}>{d.toLocaleString(undefined, opts)}</time>;
}
