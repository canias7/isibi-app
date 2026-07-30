import { cn } from "@/lib/utils";
/**
 * The band above a day view for things with no time — holidays, deadlines,
 * someone being away.
 *
 * It renders even when empty, as a thin rule. A band that appears and
 * disappears shoves the whole timetable up and down as you page through days.
 */
export function AllDayRow({ items, className }: {
  items: { id: string | number; label: string; onClick?: () => void }[];
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-8 items-center gap-2 border-b border-border px-2 py-1", className)}>
      <span className="w-14 shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">All day</span>
      <div className="flex min-w-0 flex-1 flex-wrap gap-1">
        {items.map((it) => (
          <button key={it.id} type="button" onClick={it.onClick} disabled={!it.onClick}
            className={cn("truncate rounded bg-muted px-2 py-0.5 text-xs", it.onClick && "cursor-pointer hover:bg-muted/70")}>
            {it.label}
          </button>
        ))}
      </div>
    </div>
  );
}
