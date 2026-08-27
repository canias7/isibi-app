import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * "Minimum order 6" — with how far off you are.
 *
 * THE GAP IS THE USEFUL PART, exactly as in `bulk-pricing` and
 * `threshold-bar`: "4 more to reach the minimum" is actionable, "minimum 6"
 * is a rule. Once met it says so once, quietly, and stops nagging.
 *
 * MULTIPLES ARE A SEPARATE RULE and often the real one — trade goods sell in
 * cases of 12, so an order of 14 is invalid even though it clears the
 * minimum. Both are checked and the failing one is named.
 */
export function MinOrderNote({ quantity, min = 1, multipleOf, className }: {
  quantity: number;
  min?: number;
  multipleOf?: number;
  className?: string;
}) {
  const shortBy = Math.max(0, min - quantity);
  const offMultiple = multipleOf && quantity % multipleOf !== 0
    ? multipleOf - (quantity % multipleOf)
    : 0;

  if (!shortBy && !offMultiple) {
    return <p data-slot="min-order-note" className={cn("text-[11px] text-muted-foreground", className)}>Order quantity is fine.</p>;
  }
  return (
    <p className={cn("text-xs font-medium", className)}>
      {shortBy
        ? <>Minimum order is {min} — add <span className="tabular-nums">{shortBy}</span> more.</>
        : <>Sold in {multipleOf}s — add <span className="tabular-nums">{offMultiple}</span> more.</>}
    </p>
  );
}
