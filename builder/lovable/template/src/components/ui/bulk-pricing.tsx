import * as React from "react";
import { cn, formatMinor } from "@/lib/utils";
/**
 * Buy more, pay less per item — with the NEXT tier always in view.
 *
 * THE PERSUASIVE LINE IS "2 MORE AND THEY ARE £3 EACH", and a plain price
 * table never says it. This one computes the gap to the next break from the
 * quantity in the basket, which is the whole reason a shop publishes tiers.
 *
 * THE ACTIVE TIER IS MARKED BY WEIGHT and stated in words, not by a row
 * colour — the monochrome rule, and it survives being read aloud.
 *
 * TIERS ARE SORTED AND VALIDATED HERE: an overlapping or out-of-order tier
 * list silently prices things wrong, so they are sorted by quantity and the
 * applicable one is the last whose minimum is met.
 */
export function BulkPricing({ tiers, quantity, currency = "GBP", className }: {
  tiers: { min: number; priceMinor: number }[];
  quantity: number;
  currency?: string;
  className?: string;
}) {
  const sorted = [...tiers].sort((a, b) => a.min - b.min);
  const fmt = (m: number) => formatMinor(m, currency);
  const activeIdx = sorted.reduce((best, t, i) => (quantity >= t.min ? i : best), -1);
  const next = sorted[activeIdx + 1];

  return (
    <div data-slot="bulk-pricing" className={cn("flex flex-col gap-1", className)}>
      <table className="text-xs">
        <tbody>
          {sorted.map((t, i) => (
            <tr key={t.min} className={cn(i === activeIdx && "font-semibold")}>
              <td className="pe-3 tabular-nums">{t.min}+</td>
              <td className="tabular-nums">{fmt(t.priceMinor)} each</td>
              <td className="ps-2 text-muted-foreground">{i === activeIdx ? "← your price" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* The line that actually sells the next tier. */}
      {next ? (
        <p className="text-xs">
          Add <b className="tabular-nums">{next.min - quantity}</b> more and they are{" "}
          <b className="tabular-nums">{fmt(next.priceMinor)}</b> each.
        </p>
      ) : null}
    </div>
  );
}
