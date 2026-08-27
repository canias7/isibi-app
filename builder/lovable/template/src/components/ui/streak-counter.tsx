import { cn } from "@/lib/utils";
/**
 * How many in a row — and honest about what breaks it.
 *
 * THE RULE IS STATED. "12 day streak" means nothing without knowing whether a
 * missed Sunday ends it, and a counter that resets without warning is the
 * fastest way to lose the person it was motivating.
 *
 * The best-ever figure sits beside the current one, because a streak of 3 after
 * a best of 40 is a different feeling from a first ever 3, and showing only the
 * current number flattens both into the same flat statement.
 *
 * NO FLAME, NO COLOUR. The number and the word carry it, which also means it
 * reads correctly in a printed report and to a screen reader.
 */
export function StreakCounter({ current, best, unit = "days", rule, className }: {
  current: number; best?: number; unit?: string;
  /** What keeps it alive — "one visit a week keeps it going". */
  rule?: string;
  className?: string;
}) {
  return (
    <div data-slot="streak-counter" className={cn("flex flex-col gap-0.5", className)}>
      <p className="text-sm">
        <span className="text-lg font-semibold tabular-nums">{current.toLocaleString()}</span>
        <span className="text-muted-foreground"> {unit} in a row</span>
        {typeof best === "number" && best > current && (
          <span className="text-muted-foreground tabular-nums"> · best {best.toLocaleString()}</span>
        )}
      </p>
      {rule && <p className="text-xs text-muted-foreground">{rule}</p>}
    </div>
  );
}
