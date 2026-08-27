import { cn } from "@/lib/utils";
/**
 * Hours funded against hours actually delivered.
 *
 * THE SHORTFALL IS THE POINT AND IT IS COMPUTED, NOT SUPPLIED. Care is
 * commissioned in hours per week and delivered in visits that run short; the gap
 * accumulates quietly and is the number that changes what anybody does. A
 * component taking a "delivered" percentage from the caller would let it be
 * rounded before anyone saw it.
 *
 * DELIVERED HOURS COME FROM THE VISITS, so the total cannot disagree with the
 * log it was derived from — which is what happens whenever both are typed in.
 *
 * OVER-DELIVERY IS SHOWN TOO, and is not a good-news story: unfunded hours are
 * hours somebody is working for nothing, and a run of them usually means the
 * assessment is out of date rather than that anyone is being generous.
 *
 * IT SAYS "THIS WEEK" OR WHATEVER THE PERIOD IS, ALWAYS. Hours with no period
 * attached is the one number in care planning that gets read at four different
 * scales by four different people.
 */
export function CareHours({ commissioned, delivered, period = "this week", rate, currency = "GBP", locale = "en-GB", className }: {
  /** Funded hours. */
  commissioned: number;
  /** Actually delivered. Derive from the visit log, do not retype it. */
  delivered: number;
  period?: string;
  /** Optional — what an hour is paid at. */
  rate?: number;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = (v: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
      maximumFractionDigits: Number.isInteger(v) ? 0 : 2,
    }).format(v);
  const gap = commissioned - delivered;
  const hrs = (n: number) => `${Number(n.toFixed(2))} ${Math.abs(n) === 1 ? "hour" : "hours"}`;
  // The track is scaled to whichever is larger and the funded level is marked on
  // it. Clamping the fill at 100% instead would draw 14 of 14 and 12 of 10.5
  // identically — a full black bar either way, which is the one pair of states
  // this component exists to tell apart.
  const scale = Math.max(commissioned, delivered) || 1;
  const fill = (delivered / scale) * 100;
  const mark = (commissioned / scale) * 100;
  return (
    <div data-slot="care-hours" className={cn("space-y-1 text-sm", className)}>
      <p className="tabular-nums">
        <span className="font-medium">{hrs(delivered)}</span>
        <span className="text-muted-foreground"> of {hrs(commissioned)} {period}</span>
      </p>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className="h-full bg-foreground" style={{ width: `${fill}%` }} />
        {mark < 100 && (
          <span
            className="absolute inset-y-0 w-px bg-background"
            style={{ left: `${mark}%` }}
            title="funded level"
          />
        )}
      </div>
      {gap > 0 && (
        <p className="text-xs font-medium tabular-nums">
          {hrs(gap)} short{rate !== undefined ? ` — ${money(gap * rate)} of care that was funded and not given` : ""}.
        </p>
      )}
      {gap < 0 && (
        <p className="text-xs tabular-nums">
          {hrs(-gap)} more than funded. Somebody is working those for nothing — the assessment is probably out of date.
        </p>
      )}
      {gap === 0 && <p className="text-xs text-muted-foreground">Delivered as funded.</p>}
    </div>
  );
}
