import { cn } from "@/lib/utils";
export type Appointment = { at: string; title: string; meta?: string | null };
/** One day, down the page. What an owner opens in the morning. */
export function DaySchedule({ date, items, empty = "Nothing booked", onSelect, className }: {
  date?: string; items: Appointment[]; empty?: string;
  onSelect?: (a: Appointment) => void; className?: string;
}) {
  return (
    <div className={className}>
      {date && <div className="mb-2 text-sm font-medium">{date}</div>}
      {items.length === 0
        ? <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>
        : (
          <ol className="flex flex-col">
            {items.map((a, i) => (
              <li key={i}>
                <button type="button" disabled={!onSelect} onClick={() => onSelect?.(a)}
                  className={cn("flex w-full items-baseline gap-4 border-b border-border py-3 text-start last:border-0",
                    onSelect && "cursor-pointer hover:bg-muted/50")}>
                  <span className="w-14 shrink-0 text-sm tabular-nums text-muted-foreground">{a.at}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{a.title}</span>
                    {a.meta && <span className="block truncate text-xs text-muted-foreground">{a.meta}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
    </div>
  );
}
