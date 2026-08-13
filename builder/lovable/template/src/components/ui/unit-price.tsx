import * as React from "react";
import { cn, formatMinor } from "@/lib/utils";
/**
 * The price per litre, kilo or item — the only way to compare packs.
 *
 * A 750ml AT £6 AND A 1L AT £7.50 cannot be compared in your head at the
 * shelf, which is exactly why unit pricing is a legal requirement in much of
 * the world. `price-tag` shows what you pay; this shows what it costs.
 *
 * THE UNIT IS NORMALISED to a sensible base (per litre, not per 750ml) and
 * the divisor is stated, because "£8.00/L" with no pack size is unverifiable.
 *
 * ROUNDED TO THE PENNY, UP. Under-rounding a unit price makes a pack look
 * marginally cheaper than it is, which is the one direction that misleads.
 */
export function UnitPrice({ priceMinor, quantity, unit, currency = "GBP", className }: {
  priceMinor: number;
  /** How many `unit` are in the pack, e.g. 0.75 for 750ml when unit is "L". */
  quantity: number;
  unit: string;
  currency?: string;
  className?: string;
}) {
  if (!quantity) return null;
  const per = Math.ceil(priceMinor / quantity);
  const fmt = (m: number) => formatMinor(m, currency);
  return (
    <p className={cn("text-xs tabular-nums text-muted-foreground", className)}>
      {fmt(per)} per {unit}
      <span className="sr-only"> (from {fmt(priceMinor)} for {quantity} {unit})</span>
    </p>
  );
}
