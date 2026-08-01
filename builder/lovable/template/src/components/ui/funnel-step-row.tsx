import { cn } from "@/lib/utils";
/**
 * One step of a funnel, with the drop from the step before.
 *
 * THE STEP-TO-STEP DROP IS THE NUMBER, not the share of the original. Every
 * funnel shows "12% reached checkout" and buries the fact that the loss is
 * almost all at one step — and that step is the only thing anybody can act on.
 * Both are shown, with the drop first.
 *
 * IT NAMES THE PEOPLE LOST, not just the percentage. "48% dropped" is a
 * statistic; "1,240 people got this far and stopped" is a number somebody
 * argues about in a meeting.
 *
 * A FUNNEL STEP CAN GAIN PEOPLE, and pretending otherwise hides a real problem.
 * Somebody entering mid-funnel from an email link is a genuine path, and a
 * component that clamps to a decreasing series makes that invisible.
 *
 * BARS ARE `aria-hidden` WITH ALL THE NUMBERS IN TEXT — a funnel drawn only as
 * shrinking bars conveys nothing to a screen reader and nothing precise to
 * anyone.
 */
export function FunnelStepRow({ label, count, previous, first, className }: {
  label: string;
  count: number;
  /** Count at the step before. Omit on the first step. */
  previous?: number;
  /** Count at the top of the funnel. */
  first?: number;
  className?: string;
}) {
  const width = first && first > 0 ? Math.min(100, (count / first) * 100) : 100;
  const dropped = previous !== undefined ? previous - count : null;
  const dropPct = previous && previous > 0 && dropped !== null ? (dropped / previous) * 100 : null;
  const ofFirst = first && first > 0 ? (count / first) * 100 : null;
  return (
    <li className={cn("space-y-1 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1">{label}</span>
        <span className="shrink-0 tabular-nums">{count.toLocaleString()}</span>
        {ofFirst !== null && (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{Math.round(ofFirst)}% of all</span>
        )}
      </p>
      <div aria-hidden="true" className="h-1.5 w-full overflow-hidden rounded-full border border-border">
        <span style={{ width: `${width}%` }} className="block h-full bg-foreground" />
      </div>
      {dropped !== null && dropPct !== null && (
        <p className={cn("text-xs", dropPct >= 30 ? "font-medium" : "text-muted-foreground")}>
          {dropped > 0
            ? <>{dropped.toLocaleString()} stopped here · {Math.round(dropPct)}% of the step before</>
            : dropped === 0
              ? "Everyone carried on"
              : <>{Math.abs(dropped).toLocaleString()} joined at this step — some people start here</>}
        </p>
      )}
    </li>
  );
}
