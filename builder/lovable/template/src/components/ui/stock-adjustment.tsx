import { cn } from "@/lib/utils";
/**
 * A correction to the book figure — with the reason it happened.
 *
 * THE REASON IS MANDATORY AND CATEGORISED, and that is the entire point. An
 * adjustment log full of "correction" answers nothing; one that separates
 * damage, theft, expiry, mis-pick and a found item tells an owner where the
 * money is going and which of the five they can actually fix.
 *
 * IT SHOWS BOTH FIGURES, NOT JUST THE DELTA. "-6" is unauditable; "18 → 12"
 * lets somebody reading it a month later see whether the starting point was
 * already wrong.
 *
 * THE VALUE IS SHOWN because an adjustment is a write-off, and the person
 * approving it is approving money — a units-only view hides that a routine-
 * looking correction is the largest one this month.
 *
 * WHO MADE IT IS NAMED. Self-approved adjustments are the classic shrinkage
 * route, and an unattributed one cannot be questioned at all.
 */
export type AdjustmentReason = "damage" | "theft" | "expiry" | "mispick" | "found" | "recount" | "other";

const WORDS: Record<AdjustmentReason, string> = {
  damage: "Damaged",
  theft: "Believed stolen",
  expiry: "Past its date",
  mispick: "Picked in error",
  found: "Found — was not on the book",
  recount: "Recount",
  other: "Other",
};

export function StockAdjustment({ item, from, to, reason, note, by, approvedBy, unitValue, currency = "GBP", locale = "en-GB", className }: {
  item: string;
  /** Book figure before. */
  from: number;
  /** Book figure after. */
  to: number;
  reason: AdjustmentReason;
  note?: string;
  by?: string;
  /** Undefined where nobody has approved it. */
  approvedBy?: string;
  unitValue?: number;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const diff = to - from;
  const money = unitValue !== undefined
    ? new Intl.NumberFormat(locale, { style: "currency", currency }).format(Math.abs(diff) * unitValue)
    : undefined;
  const selfApproved = Boolean(by && approvedBy && by === approvedBy);
  return (
    <li className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1">{item}</span>
        <span className="shrink-0 tabular-nums">
          {from} → {to}
          <span className="font-medium"> ({diff > 0 ? "+" : "−"}{Math.abs(diff)})</span>
        </span>
      </p>
      <p className="text-xs">
        {WORDS[reason]}
        {money && <span className="text-muted-foreground tabular-nums"> · {money}</span>}
      </p>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      <p className="text-xs text-muted-foreground">
        {by ? `Adjusted by ${by}` : "Nobody recorded"}
        {approvedBy ? ` · approved by ${approvedBy}` : " · not approved"}
      </p>
      {selfApproved && <p className="text-xs font-medium">Approved by the person who made it.</p>}
    </li>
  );
}
