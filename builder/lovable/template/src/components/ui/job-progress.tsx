import { cn } from "@/lib/utils";
/**
 * How far through, in items rather than in percent.
 *
 * "412 of 5,000" beats "8%" on the one question people actually have, which is
 * how much longer. A percentage hides the scale — 8% of twelve rows and 8% of
 * twelve million feel identical and are not.
 *
 * WITHOUT A TOTAL IT SAYS SO instead of inventing one. Plenty of work genuinely
 * cannot be counted ahead of time, and a bar that creeps toward an end it does
 * not know is a lie people learn to distrust. In that case it counts up and
 * draws no bar at all.
 *
 * `aria-live="polite"` on the count and NOT on the bar: announcing every
 * percentage tick would talk over everything else on the page. The number is
 * announced when the caller re-renders, which for a sane caller is
 * occasionally rather than sixty times a second.
 */
export function JobProgress({ done, total, unit = "items", label, className }: {
  done: number;
  /** Omit when the total genuinely is not known. */
  total?: number;
  unit?: string;
  label?: string;
  className?: string;
}) {
  const pct = total && total > 0 ? Math.round(Math.min(done / total, 1) * 100) : null;
  return (
    <div data-slot="job-progress" className={cn("flex flex-col gap-1.5", className)}>
      {label && <p className="text-sm font-medium">{label}</p>}
      {pct !== null && (
        <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
          aria-label={label ?? "Progress"}
          className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-foreground" style={{ width: `${pct}%` }} />
        </div>
      )}
      <p aria-live="polite" className="text-sm text-muted-foreground tabular-nums">
        {total
          ? `${done.toLocaleString()} of ${total.toLocaleString()} ${unit}`
          : `${done.toLocaleString()} ${unit} so far`}
      </p>
    </div>
  );
}
