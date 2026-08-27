import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
/**
 * Hide the rows where everything matches.
 *
 * THE SWITCH THAT MAKES A COMPARISON USABLE. Twenty attributes across three
 * options is mostly agreement, and the four rows that differ are the decision —
 * but they are invisible among the sixteen that do not.
 *
 * IT STATES HOW MANY WOULD BE HIDDEN before the press, so the reader knows
 * whether it is worth it and is not surprised by a table that suddenly loses
 * most of itself.
 *
 * `role="status"` on the count, because the number changes as options are added
 * or ruled out, and a stale figure beside a live table is worse than none.
 */
export function DifferenceOnly({ on, onChange, hiddenCount, id, className }: {
  on: boolean;
  onChange: (v: boolean) => void;
  /** Rows that are identical across every option. */
  hiddenCount: number;
  id?: string;
  className?: string;
}) {
  return (
    <span data-slot="difference-only" className={cn("inline-flex items-center gap-2", className)}>
      <Switch id={id} checked={on} onCheckedChange={onChange} aria-label="Show only what differs" />
      <label htmlFor={id} className="text-sm">Only what differs</label>
      <span role="status" className="text-xs text-muted-foreground tabular-nums">
        {hiddenCount > 0
          ? on ? `${hiddenCount} identical hidden` : `${hiddenCount} rows are the same`
          : "everything differs"}
      </span>
    </span>
  );
}
