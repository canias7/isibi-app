import { cn, toDate } from "@/lib/utils";
/**
 * The calendar-tile date — big day over small month.
 *
 * Extracted so an events list, an agenda and a booking row all show the date
 * the same way. It is the shape a list is scanned down its left edge by, and
 * a spelled-out "Thursday 14 August 2026" cannot be scanned at all.
 *
 * The whole thing is one `<time dateTime>`, so what a machine reads is the
 * ISO date rather than the two fragments a person sees.
 */
export function DateBadge({ date, size = "md", className }: {
  date: string | number | Date; size?: "sm" | "md" | "lg"; className?: string;
}) {
  // `toDate`, not `new Date`: every getter below is a LOCAL one, and a bare
  // `YYYY-MM-DD` parses as UTC midnight, so west of Greenwich this badge showed
  // the previous day — and put that day in `dateTime` too, which is the half a
  // crawler reads.
  const d = toDate(date);
  if (Number.isNaN(d.getTime())) return null;
  const box = { sm: "size-12", md: "size-16", lg: "size-20" }[size];
  const num = { sm: "text-base", md: "text-2xl", lg: "text-3xl" }[size];
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return (
    <time dateTime={iso}
      className={cn("flex flex-col items-center justify-center rounded-md bg-muted leading-none", box, className)}>
      <span className={cn("font-semibold tabular-nums", num)}>{d.getDate()}</span>
      <span className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {d.toLocaleString(undefined, { month: "short" })}
      </span>
    </time>
  );
}
