import { cn } from "@/lib/utils";
/**
 * Use over a run of periods, with the numbers in the markup.
 *
 * EVERY BAR CARRIES ITS FIGURE IN TEXT. A chart read only by height is
 * unreadable in greyscale, in print, and to a screen reader — and this is a
 * component whose entire content is a set of numbers, so the bars are the aid
 * and the text is the substance.
 *
 * IT DOES NOT NORMALISE FOR PERIOD LENGTH AND SAYS SO. February looks like a
 * fall in use and is mostly three fewer days; where the caller can give days
 * the daily average is shown, which is the only comparable figure.
 *
 * A PERIOD BUILT FROM AN ESTIMATE IS MARKED. Estimated bills are corrected
 * later and the correction lands in one period as a spike that never happened —
 * a chart that hides which readings were guessed produces exactly that
 * confusion.
 *
 * THE UNIT IS THE CALLER'S — kWh, cubic metres, litres — and appears on every
 * value rather than in a legend nobody reads.
 *
 * THE GAP BETWEEN ROWS IS LARGER THAN THE GAP INSIDE ONE, and that spacing is
 * load-bearing rather than taste. Rendered evenly, every bar reads as an
 * underline of the row BENEATH it — measured on a real page, the hatched
 * estimated period appeared to belong to the month after it.
 */
export type ConsumptionPeriod = {
  id: string;
  label: string;
  value: number;
  days?: number;
  estimated?: boolean;
};

export function ConsumptionBar({ periods, unit = "kWh", className }: {
  periods: ConsumptionPeriod[];
  unit?: string;
  className?: string;
}) {
  const max = Math.max(1, ...periods.map((p) => p.value));
  const anyEstimated = periods.some((p) => p.estimated);
  return (
    <div className={cn("space-y-1.5", className)}>
      <ul className="space-y-2.5">
        {periods.map((p) => (
          <li key={p.id} className="space-y-0.5">
            <p className="flex items-baseline gap-3 text-sm">
              <span className="min-w-0 flex-1">
                {p.label}
                {p.estimated && <span className="text-muted-foreground"> · estimated</span>}
              </span>
              <span className="shrink-0 tabular-nums">{p.value.toLocaleString()} {unit}</span>
              {p.days ? (
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {(p.value / p.days).toFixed(1)}/day
                </span>
              ) : null}
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full border border-border" aria-hidden="true">
              <span
                className={cn("block h-full", p.estimated
                  ? "bg-[repeating-linear-gradient(45deg,var(--color-foreground)_0_3px,transparent_3px_6px)]"
                  : "bg-foreground")}
                style={{ width: `${(p.value / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      {anyEstimated && (
        <p className="text-xs text-muted-foreground">
          Hatched periods were estimated, not read — they are corrected when a real reading arrives.
        </p>
      )}
    </div>
  );
}
