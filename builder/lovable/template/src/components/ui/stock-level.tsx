import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * How many are left — bucketed, because exact counts are a liability.
 *
 * `stock-badge` IS IN-STOCK OR NOT. This is the middle ground shops actually
 * want: "only 2 left" sells, "1,482 in stock" does not, and publishing an
 * exact figure hands a competitor your inventory and turnover.
 *
 * THE THRESHOLD IS THE CALLER'S, and above it the number is never shown —
 * just "in stock". Below it the exact count IS shown, because that is the
 * one range where precision is the persuasive part.
 *
 * ZERO SAYS WHAT HAPPENS NEXT rather than just "out of stock": back in stock
 * on a date, or the option to be told. A dead end is where a sale is lost.
 */
export function StockLevel({ count, lowAt = 5, backInStock, onNotify, className }: {
  count: number;
  lowAt?: number;
  backInStock?: string;
  onNotify?: () => void;
  className?: string;
}) {
  if (count <= 0) {
    return (
      <p data-slot="stock-level" className={cn("flex flex-wrap items-baseline gap-1.5 text-xs", className)}>
        <span className="font-medium">Out of stock</span>
        {backInStock ? <span className="text-muted-foreground">· back {backInStock}</span> : null}
        {onNotify ? (
          <button type="button" onClick={onNotify} className="cursor-pointer underline underline-offset-2">
            Tell me when it is back
          </button>
        ) : null}
      </p>
    );
  }
  return (
    <p className={cn("text-xs", count <= lowAt ? "font-medium" : "text-muted-foreground", className)}>
      {/* Exact only where scarcity is the point; never the full figure. */}
      {count <= lowAt ? `Only ${count} left` : "In stock"}
    </p>
  );
}
