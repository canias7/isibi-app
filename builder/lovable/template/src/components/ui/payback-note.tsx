import { cn } from "@/lib/utils";
/**
 * How long until it pays for itself.
 *
 * PAYBACK IN TIME, NOT A PERCENTAGE. A return figure needs a period to mean
 * anything and most readers cannot convert one to the other; "pays for itself in
 * 14 months" is the form the decision is actually made in.
 *
 * NEVER PAYS BACK IS SAID PLAINLY. The honest answer to some purchases is that
 * they do not, and a component that renders a very large number instead is
 * technically correct and useless — worse, it looks like a rounding error.
 *
 * The assumption is carried with the figure, because a payback period is only as
 * good as the saving it assumes, and quoting one without the other is how a
 * business case becomes a promise.
 */
export function PaybackNote({ months, cost, savingPer, unitLabel = "", never, className }: {
  /** Months to break even. Omit with `never`. */
  months?: number;
  cost?: number;
  /** The assumption — "£180 a month saved". */
  savingPer?: string;
  unitLabel?: string;
  never?: boolean;
  className?: string;
}) {
  if (never || months === undefined) {
    return (
      <p data-slot="payback-note" className={cn("text-sm", className)}>
        <span className="font-medium">Doesn&apos;t pay for itself</span>
        {savingPer && <span className="text-muted-foreground"> at {savingPer}</span>}
      </p>
    );
  }
  const years = Math.floor(months / 12), rest = Math.round(months % 12);
  const say = years ? `${years} year${years > 1 ? "s" : ""}${rest ? ` ${rest} month${rest > 1 ? "s" : ""}` : ""}` : `${Math.round(months)} months`;
  return (
    <p className={cn("text-sm", className)}>
      <span className="font-medium tabular-nums">Pays for itself in {say}</span>
      <span className="text-muted-foreground">
        {typeof cost === "number" ? ` · ${unitLabel}${cost.toLocaleString()} up front` : ""}
        {savingPer ? ` · assumes ${savingPer}` : ""}
      </span>
    </p>
  );
}
