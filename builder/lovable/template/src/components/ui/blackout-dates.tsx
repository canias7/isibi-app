import { DateFormat } from "@/components/ui/date-format";
import { X } from "lucide-react";
import { cn, toDate } from "@/lib/utils";
/**
 * Days nothing can be booked on — holidays, a deep clean, someone away.
 *
 * Consecutive days are collapsed into a range, so a fortnight off is one line
 * rather than fourteen. A list of fourteen dates is one nobody reads and
 * nobody notices a mistake in.
 *
 * Dates are compared on the LOCAL calendar day, not on the timestamp:
 * two dates hours apart can be the same day, and consecutive-ness is a
 * question about days.
 */
export function BlackoutDates({ dates, onRemove, empty = "No dates blocked.", className }: {
  dates: (string | number | Date)[]; onRemove?: (iso: string) => void;
  empty?: string; className?: string;
}) {
  const days = dates
    .map((d) => toDate(d))
    .filter((d) => !Number.isNaN(d.getTime()))
    .map((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()))
    .sort((a, b) => +a - +b);
  if (!days.length) return <p data-slot="blackout-dates" className={cn("text-sm text-muted-foreground", className)}>{empty}</p>;
  const runs: { from: Date; to: Date }[] = [];
  for (const d of days) {
    const last = runs[runs.length - 1];
    if (last && +d - +last.to === 86_400_000) last.to = d;
    else if (!last || +d !== +last.to) runs.push({ from: d, to: d });
  }
  return (
    <ul className={cn("space-y-1", className)}>
      {runs.map((r) => (
        <li key={r.from.toISOString()} className="flex items-center gap-2 text-sm">
          <span>
            <DateFormat date={r.from} />
            {+r.to !== +r.from && <> – <DateFormat date={r.to} /></>}
          </span>
          {onRemove && (
            <button type="button" onClick={() => onRemove(r.from.toISOString())}
              aria-label="Unblock these dates" className="cursor-pointer rounded p-0.5 hover:bg-muted">
              <X className="size-3.5" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
