import { cn } from "@/lib/utils";
/**
 * The rate the line has to hold to meet demand — against the rate it is holding.
 *
 * TAKT IS SET BY DEMAND AND CYCLE TIME BY THE PROCESS, and confusing the two is
 * the commonest mistake on a production board. Takt is how often a unit must
 * leave; cycle is how often one does. The comparison is the entire message.
 *
 * IT SAYS WHAT THE GAP MEANS IN OUTPUT. "8 seconds over takt" is abstract; "you
 * will finish about 90 units short today" is the number that changes a
 * decision.
 *
 * AVAILABLE TIME EXCLUDES BREAKS AND PLANNED STOPS. Dividing a shift by demand
 * without removing them sets a takt nobody can hit, and the line is then judged
 * against a target that was never real.
 *
 * RUNNING FASTER THAN TAKT IS NOT PRAISED. Over-producing builds stock and hides
 * problems, and a board that rewards it teaches the wrong thing — so ahead is
 * stated plainly, not celebrated.
 */
export function TaktNote({ demand, availableMinutes, cycleSeconds, className }: {
  /** Units wanted in the period. */
  demand: number;
  /** Working minutes, breaks and planned stops already removed. */
  availableMinutes: number;
  /** Seconds the line actually takes per unit. */
  cycleSeconds?: number;
  className?: string;
}) {
  const taktSeconds = demand > 0 ? (availableMinutes * 60) / demand : 0;
  const gap = cycleSeconds !== undefined ? cycleSeconds - taktSeconds : undefined;
  const willMake = cycleSeconds && cycleSeconds > 0 ? Math.floor((availableMinutes * 60) / cycleSeconds) : undefined;
  const fmt = (s: number) => (s < 90 ? `${s.toFixed(0)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`);
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p>
        <span className="tabular-nums">One unit every {fmt(taktSeconds)}</span>
        <span className="block text-xs tabular-nums text-muted-foreground">
          {demand} units in {availableMinutes} working minutes
        </span>
      </p>
      {cycleSeconds !== undefined && (
        <p className={cn("text-xs tabular-nums", gap !== undefined && gap > 0 ? "font-medium" : "text-muted-foreground")}>
          Running one every {fmt(cycleSeconds)}
          {gap !== undefined && gap > 0 && ` — ${fmt(gap)} slower than needed`}
          {gap !== undefined && gap < 0 && ` — ${fmt(-gap)} faster than needed`}
        </p>
      )}
      {willMake !== undefined && willMake < demand && (
        <p className="text-xs font-medium tabular-nums">
          At this rate the shift finishes about {demand - willMake} units short.
        </p>
      )}
      {willMake !== undefined && willMake > demand && (
        <p className="text-xs text-muted-foreground tabular-nums">
          At this rate the shift makes about {willMake - demand} more than wanted — that is stock, not output.
        </p>
      )}
    </div>
  );
}
