import { cn, divide } from "@/lib/utils";
/**
 * The limit on an "unlimited" plan, stated as a number.
 *
 * A FAIR-USE POLICY WITH NO NUMBER IN IT IS NOT A POLICY. "Unreasonable use may
 * be restricted" cannot be complied with, cannot be planned around, and cannot be
 * disputed — the component requires a threshold and says so plainly when it does
 * not have one.
 *
 * WHAT HAPPENS AT THE THRESHOLD IS STATED SEPARATELY FROM THE THRESHOLD ITSELF.
 * Slowed for the rest of the month, slowed at busy times only, or contacted by
 * somebody are three quite different consequences that the same sentence usually
 * covers.
 *
 * IT SHOWS HOW CLOSE THE CUSTOMER IS. A policy is abstract until it is measured
 * against actual use, and the only people who ever read one are those about to
 * cross it — after being told nothing.
 *
 * NO SHAMING LANGUAGE. Somebody at 90% of a fair-use threshold is using a
 * product as sold, and the tone here says so.
 */
export function FairUseNote({ thresholdGb, usedGb, consequence = "slowed", busyHours, contactedFirst, periodLabel = "this month", className }: {
  /** Without one this is not a policy, and the component says so. */
  thresholdGb?: number;
  usedGb?: number;
  consequence?: "slowed" | "slowed at busy times" | "contacted";
  /** When the restriction applies, where it is time-limited. */
  busyHours?: string;
  /** True where somebody gets in touch before anything changes. */
  contactedFirst?: boolean;
  periodLabel?: string;
  className?: string;
}) {
  const gb = (n: number) => `${Number(n.toFixed(1))} GB`;
  if (thresholdGb === undefined) {
    return (
      <div data-slot="fair-use-note" className={cn("space-y-0.5 text-sm", className)}>
        <p className="font-medium">This plan has a fair-use policy with no number in it.</p>
        <p className="text-xs text-muted-foreground">
          Nothing here can be complied with or planned around. Worth asking what the actual threshold is.
        </p>
      </div>
    );
  }
  const pct = usedGb !== undefined ? Math.min(100, divide(usedGb, thresholdGb) * 100) : undefined;
  const close = pct !== undefined && pct >= 80;
  return (
    <div className={cn("space-y-1 text-sm", className)}>
      <p className="tabular-nums">
        <span className="font-medium">Unlimited up to {gb(thresholdGb)}</span>
        {usedGb !== undefined && <span className="text-muted-foreground"> · {gb(usedGb)} used {periodLabel}</span>}
      </p>
      {pct !== undefined && (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div className="h-full bg-foreground" style={{ width: `${pct}%` }} />
        </div>
      )}
      <p className={cn("text-xs", close ? "font-medium" : "text-muted-foreground")}>
        {consequence === "contacted"
          ? "Past that, somebody gets in touch. Nothing changes automatically."
          : consequence === "slowed at busy times"
            ? `Past that it slows down${busyHours ? ` between ${busyHours}` : " at busy times"}, and runs normally the rest of the day.`
            : "Past that it slows down for the rest of the period. Nothing extra is charged."}
      </p>
      {contactedFirst && (
        <p className="text-xs text-muted-foreground">Somebody gets in touch before anything changes.</p>
      )}
    </div>
  );
}
