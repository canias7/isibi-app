import * as React from "react";
import { cn, formatMinor } from "@/lib/utils";
/**
 * Things moved out of the basket but not given up on.
 *
 * THE MOVE IS REVERSIBLE IN ONE PRESS, both ways. Saving for later is what
 * people do instead of deleting when they are unsure, and a save that cannot
 * come back is a delete with a friendlier word on it.
 *
 * PRICE AND STOCK ARE RE-CHECKED HERE, because saved items sit for weeks:
 * "was £14, now £12" is the reason somebody comes back, and "no longer
 * available" is the thing they must not discover at the till. Both are shown
 * on the row rather than at checkout.
 */
export function SavedForLater({ items, onMoveToCart, onRemove, currency = "GBP", className }: {
  items: { id: string; name: React.ReactNode; priceMinor: number; wasMinor?: number; unavailable?: boolean }[];
  onMoveToCart: (id: string) => void;
  onRemove: (id: string) => void;
  currency?: string;
  className?: string;
}) {
  if (!items.length) return null;
  const fmt = (m: number) => formatMinor(m, currency);
  return (
    <section data-slot="saved-for-later" className={cn("flex flex-col gap-2", className)}>
      <h2 className="text-sm font-semibold">Saved for later <span className="font-normal text-muted-foreground">({items.length})</span></h2>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {items.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
            <span className="min-w-0">
              <span className="block truncate">{i.name}</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {i.unavailable ? "No longer available" : (
                  <>
                    {fmt(i.priceMinor)}
                    {/* The reason people come back. */}
                    {i.wasMinor != null && i.wasMinor > i.priceMinor ? (
                      <span className="ms-1 font-medium text-foreground">
                        down from {fmt(i.wasMinor)}
                      </span>
                    ) : null}
                  </>
                )}
              </span>
            </span>
            <span className="flex shrink-0 gap-2 text-xs">
              <button type="button" disabled={i.unavailable} onClick={() => onMoveToCart(i.id)}
                className="cursor-pointer rounded-md border border-border px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40">
                Move to basket
              </button>
              <button type="button" onClick={() => onRemove(i.id)}
                className="cursor-pointer text-muted-foreground underline underline-offset-2">Remove</button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
