import { DateFormat } from "@/components/ui/date-format";
import { cn, isoAttr } from "@/lib/utils";
/**
 * The next several runs, listed, so a recurrence rule can be checked.
 *
 * `next-occurrence` shows one date; this shows the pattern. It is the only way
 * to catch the mistakes that a single date hides — a rule that lands on the
 * 31st and silently skips February, one that produces two runs in the same
 * week, one that stops after three because the end date is wrong.
 *
 * SKIPPED DATES ARE SHOWN, struck through, with the reason. A rule that quietly
 * drops a month looks identical to one that never included it, and the
 * difference is exactly what somebody is checking for. That is why the list
 * takes an entry per occurrence rather than plain dates.
 *
 * The count is stated as "next 6 of many" or as a real total, because a list
 * that simply stops leaves the reader unsure whether the schedule ends there —
 * which for a fixed-term booking is a completely different thing.
 */
export type Occurrence = { at: string | number | Date; skipped?: string };

export function SchedulePreview({ occurrences, total, className }: {
  occurrences: Occurrence[];
  /** Total runs, when the schedule is finite. */
  total?: number;
  className?: string;
}) {
  if (!occurrences.length) {
    return <p className={cn("text-sm text-muted-foreground", className)}>No runs scheduled.</p>;
  }
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <p className="text-xs text-muted-foreground tabular-nums">
        {typeof total === "number"
          ? `Showing ${occurrences.length} of ${total}`
          : `Next ${occurrences.length}`}
      </p>
      <ol className="flex flex-col gap-1 text-sm">
        {occurrences.map((o, i) => (
          <li key={i} className="flex flex-wrap items-baseline gap-x-2">
            {/* `DateFormat` IS the `<time>`, so wrapping it in one nested a
                time inside a time — and the outer carried its own `dateTime`,
                parsed by `new Date` where the inner uses `toDate`, which
                disagree about a bare `YYYY-MM-DD` by the local UTC offset. The
                className moves onto the element that survives. */}
            <DateFormat date={o.at} withTime
              className={cn("tabular-nums", o.skipped && "text-muted-foreground line-through")} />
            {o.skipped && <span className="text-xs text-muted-foreground">skipped — {o.skipped}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}
