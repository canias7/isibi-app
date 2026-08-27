import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * "Pre-order — ships 12 March". A promise with a DATE on it.
 *
 * A PRE-ORDER BADGE WITHOUT A SHIP DATE IS THE COMPLAINT ITSELF. The whole
 * risk the buyer takes is time, so the date is required by the type rather
 * than optional — a component that lets you omit it will have it omitted.
 *
 * IT SAYS THE MONEY POSITION TOO, because "charged now" and "charged when it
 * ships" are wildly different offers and the difference is where chargebacks
 * come from.
 */
export function PreorderBadge({ shipsOn, chargeNow = false, className }: {
  shipsOn: string;
  chargeNow?: boolean;
  className?: string;
}) {
  return (
    <span data-slot="preorder-badge" className={cn("inline-flex flex-col gap-0.5", className)}>
      <span className="inline-flex w-fit items-center rounded-full border border-dashed border-foreground px-2 py-0.5 text-[11px] font-medium">
        Pre-order · ships {shipsOn}
      </span>
      <span className="text-[11px] text-muted-foreground">
        {chargeNow ? "Charged today." : "You are charged when it ships."}
      </span>
    </span>
  );
}
