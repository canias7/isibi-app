import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Putting a theme back to the default, with what will be lost listed.
 *
 * IT NAMES WHAT CHANGES BACK. "Reset theme" could mean colours, or colours and
 * fonts, or the logo as well — and somebody who has spent an afternoon on a
 * palette needs to know before pressing it whether their logo survives.
 *
 * IT COUNTS THE CUSTOMISATIONS, because a theme with two changes and one with
 * forty are different amounts of work to lose, and the count is what decides
 * whether to export first.
 *
 * IT OFFERS TO EXPORT FIRST WHERE THE CALLER CAN. That turns an irreversible
 * action into a reversible one for the cost of one more button, which is the
 * best trade available on any destructive control.
 *
 * NOTHING-TO-RESET RENDERS A SENTENCE, not a disabled button. A greyed-out
 * control is a puzzle; "everything is already at the default" is an answer.
 */
export function ThemeReset({ changedCount, affects = [], onReset, onExport, busy, className }: {
  changedCount: number;
  /** What goes back — "colours", "fonts", "the logo". */
  affects?: string[];
  onReset: () => void;
  onExport?: () => void;
  busy?: boolean;
  className?: string;
}) {
  if (changedCount <= 0) {
    return <p className={cn("text-sm text-muted-foreground", className)}>Everything is already at the default.</p>;
  }
  const list = affects.length === 0 ? "everything you have changed"
    : affects.length === 1 ? affects[0]
    : `${affects.slice(0, -1).join(", ")} and ${affects[affects.length - 1]}`;
  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm">
        <span className="font-medium tabular-nums">{changedCount}</span>{" "}
        {changedCount === 1 ? "thing has" : "things have"} been changed from the default.
        <span className="block text-xs text-muted-foreground">Resetting puts back {list}.</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {onExport && (
          <Button type="button" size="sm" variant="outline" onClick={onExport} disabled={busy}>
            Save a copy first
          </Button>
        )}
        <Button type="button" size="sm" disabled={busy}
          onClick={() => { if (window.confirm(`Put ${list} back to the default? This cannot be undone.`)) onReset(); }}>
          Reset to the default
        </Button>
      </div>
    </div>
  );
}
