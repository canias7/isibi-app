import { cn } from "@/lib/utils";
/**
 * Stock held back — why, by whom, and what has to happen before it moves.
 *
 * THE RELEASE CONDITION IS THE FIELD THAT MATTERS. "Quarantined" with no stated
 * way out is how pallets sit for a year: nobody knows whether it needs a
 * certificate, a test result or one person's signature, so nobody does it.
 *
 * WHO PLACED THE HOLD IS NAMED, because the answer to "can we just ship it?" is
 * a conversation with a specific person, and an unattributed hold gets
 * overridden by whoever is under the most pressure.
 *
 * IT IS EXPLICIT THAT THE STOCK IS STILL COUNTED AND STILL OWNED. Held stock
 * disappears from availability and stays on the balance sheet, and a component
 * that shows it as simply gone loses both the value and the liability.
 *
 * A DISPOSAL DEADLINE IS SHOWN WHERE THERE IS ONE — held goods frequently have
 * a date after which the decision is made for you, and that date arrives
 * silently.
 */
export function QuarantineNote({ item, quantity, reason, placedBy, placedOn, releaseCondition, decideBy, className }: {
  item: string;
  quantity?: number;
  /** Why it is held. */
  reason: string;
  placedBy?: string;
  /** Free text — "14 August". */
  placedOn?: string;
  /** What has to happen before it moves. */
  releaseCondition?: string;
  /** Free text — a date after which it is written off or returned. */
  decideBy?: string;
  className?: string;
}) {
  return (
    <div data-slot="quarantine-note" className={cn("space-y-0.5 text-sm", className)}>
      <p>
        <span className="font-medium">Held: {item}</span>
        {quantity !== undefined && <span className="tabular-nums text-muted-foreground"> · {quantity} {quantity === 1 ? "unit" : "units"}</span>}
      </p>
      <p className="text-xs">{reason}</p>
      <p className="text-xs text-muted-foreground">
        {placedBy ? `Held by ${placedBy}` : "Nobody is recorded as having placed this hold"}
        {placedOn && ` on ${placedOn}`}
      </p>
      <p className="text-xs font-medium">
        {releaseCondition
          ? `Releases when: ${releaseCondition}`
          : "No release condition recorded — this will sit here until somebody asks."}
      </p>
      {decideBy && <p className="text-xs">A decision is needed by {decideBy}.</p>}
      <p className="text-xs text-muted-foreground">Still owned and still counted — not available to pick.</p>
    </div>
  );
}
