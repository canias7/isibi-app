import { cn } from "@/lib/utils";
/**
 * The two or three filters people actually use, as a row above the list.
 *
 * THESE ARE SHORTCUTS INTO THE SAME STATE, not a second filtering system.
 * "Today", "Unpaid", "Mine" are combinations somebody would otherwise build by
 * hand every morning — and the reason the same view gets rebuilt daily is that
 * saving one is more work than rebuilding it.
 *
 * THEY ARE MUTUALLY EXCLUSIVE BY DEFAULT, because that is what a row of
 * shortcuts means to most people, and a set of independently-toggling chips
 * silently produces contradictory combinations ("Today" plus "This month").
 * `multi` opts into the other behaviour when the set genuinely composes.
 *
 * THE COUNT ON EACH CHIP IS WHAT MAKES THE ROW USEFUL — it turns a set of
 * buttons into a summary of the day, so somebody can see there are 4 unpaid
 * without pressing anything.
 *
 * `aria-pressed` on real buttons, so state is announced. A chip row of divs is
 * the standard implementation and none of it reaches the keyboard.
 */
export type QuickFilter = { id: string; label: string; count?: number };

export function QuickFilters({ filters, active, onChange, multi, label = "Quick filters", className }: {
  filters: QuickFilter[];
  active: string[];
  onChange: (ids: string[]) => void;
  multi?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <div data-slot="quick-filters" role="group" aria-label={label} className={cn("flex flex-wrap gap-1.5", className)}>
      {filters.map((f) => {
        const on = active.includes(f.id);
        return (
          <button key={f.id} type="button" aria-pressed={on}
            onClick={() => {
              if (multi) onChange(on ? active.filter((x) => x !== f.id) : [...active, f.id]);
              else onChange(on ? [] : [f.id]);
            }}
            className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm",
              on ? "border-foreground bg-foreground text-background" : "border-border")}>
            {f.label}
            {f.count !== undefined && (
              <span className={cn("text-xs tabular-nums", !on && "text-muted-foreground")}>{f.count.toLocaleString()}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
