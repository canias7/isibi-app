import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The single "you are N away from a cheaper price" line, on its own.
 *
 * SPLIT FROM `bulk-pricing` DELIBERATELY: the table belongs on a product
 * page, this one line belongs in a basket row where there is no space for a
 * table and the nudge is the only thing worth saying.
 *
 * IT RENDERS NOTHING WHEN THERE IS NO NEXT TIER — a basket that keeps
 * showing an unreachable upsell is noise, and silence is the correct state
 * at the top tier.
 */
export function QuantityBreak({ quantity, nextAt, nextPriceMinor, currency = "GBP", onAdd, className }: {
  quantity: number;
  nextAt?: number;
  nextPriceMinor?: number;
  currency?: string;
  onAdd?: (n: number) => void;
  className?: string;
}) {
  if (nextAt == null || nextPriceMinor == null || quantity >= nextAt) return null;
  const need = nextAt - quantity;
  const fmt = (m: number) => new Intl.NumberFormat(undefined, { style: "currency", currency }).format(m / 100);
  return (
    <p className={cn("text-xs", className)}>
      Add <b className="tabular-nums">{need}</b> more for <b className="tabular-nums">{fmt(nextPriceMinor)}</b> each
      {onAdd ? (
        <>
          {" "}
          <button type="button" onClick={() => onAdd(need)} className="cursor-pointer underline underline-offset-2">
            add {need}
          </button>
        </>
      ) : null}
    </p>
  );
}
