import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Show prices with or without the tax — the STORED price never moves.
 *
 * THE TOGGLE CHANGES DISPLAY, NOT DATA (the unit-preference contract for
 * money): the price is stored one way (stated by `storedIncludes`), and
 * the switch derives the other. Deriving is integer arithmetic on minor
 * units with one rounding, here — not at every call site.
 *
 * BOTH NUMBERS SHOW at the point of the toggle ("£24.00 inc · £20.00
 * ex"), because the person flipping it is exactly the person comparing;
 * hiding the other number makes them flip twice.
 *
 * THE RATE IS PRINTED. "inc VAT" without the rate is a claim nobody can
 * check against a receipt.
 */
export function taxDerive(minor: number, rate: number, storedIncludes: boolean) {
  const inc = storedIncludes ? minor : Math.round(minor * (1 + rate));
  const ex = storedIncludes ? Math.round(minor / (1 + rate)) : minor;
  return { inc, ex };
}

export function TaxToggle({ minor, rate, storedIncludes = true, currency = "GBP", showIncluding, onChange, className }: {
  minor: number;
  rate: number;
  storedIncludes?: boolean;
  currency?: string;
  showIncluding: boolean;
  onChange: (showIncluding: boolean) => void;
  className?: string;
}) {
  const { inc, ex } = taxDerive(minor, rate, storedIncludes);
  const fmt = (m: number) => new Intl.NumberFormat(undefined, { style: "currency", currency }).format(m / 100);
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={showIncluding} onChange={(e) => onChange(e.target.checked)}
          className="size-3.5 cursor-pointer accent-foreground" />
        Show prices including VAT ({Math.round(rate * 100)}%)
      </label>
      <p className="text-sm tabular-nums">
        <b>{fmt(showIncluding ? inc : ex)}</b>{" "}
        <span className="text-xs text-muted-foreground">
          {showIncluding ? `inc · ${fmt(ex)} ex` : `ex · ${fmt(inc)} inc`} VAT
        </span>
      </p>
    </div>
  );
}
