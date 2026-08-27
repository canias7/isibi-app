import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";
/**
 * "£58.33 a month for 12 months" — with the total spelled out.
 *
 * THE TOTAL PAID IS ALWAYS SHOWN, and that is the whole component. A monthly
 * figure quoted alone is how instalment plans mislead: £58.33 sounds smaller
 * than £700, and the reader is entitled to both numbers before choosing.
 *
 * ANY EXTRA COST IS STATED SEPARATELY, so "£700 over 12 months" and "£700 plus
 * £42 interest" are not shown identically. Where there is no extra it says so —
 * "no extra cost" is a genuine selling point and hiding it wastes it.
 *
 * The first payment is called out when it differs, because a larger deposit
 * dressed as an equal instalment is the other way this pattern misleads.
 */
export function InstalmentLine({ per, count, period = "month", total, extra, firstPayment, currency = "GBP", className }: {
  per: number;
  count: number;
  period?: string;
  /** Total paid across the plan. */
  total: number;
  /** Interest or fees on top of the cash price. */
  extra?: number;
  /** Shown when the first payment differs from the rest. */
  firstPayment?: number;
  currency?: string;
  className?: string;
}) {
  return (
    <div data-slot="instalment-line" className={cn("flex flex-col gap-0.5 text-sm", className)}>
      <p className="tabular-nums">
        <span className="font-medium"><Money amount={per} currency={currency} /> a {period}</span>
        <span className="text-muted-foreground"> for {count} {period}s</span>
      </p>
      {typeof firstPayment === "number" && firstPayment !== per && (
        <p className="text-xs text-muted-foreground tabular-nums">
          First payment <Money amount={firstPayment} currency={currency} />
        </p>
      )}
      <p className="text-xs text-muted-foreground tabular-nums">
        <Money amount={total} currency={currency} /> in total
        {typeof extra === "number"
          ? extra > 0
            ? <> — including <Money amount={extra} currency={currency} /> extra</>
            : " — no extra cost"
          : null}
      </p>
    </div>
  );
}
