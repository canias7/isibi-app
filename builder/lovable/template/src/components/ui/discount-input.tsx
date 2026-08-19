import * as React from "react";
import { cn, formatMinor } from "@/lib/utils";
/**
 * A discount — percent or fixed — with the OUTCOME in view.
 *
 * THE RESULT IS SHOWN AS YOU TYPE ("−£5.00 → £23.00"), because the
 * costly mistake is typing 50 with the wrong kind selected: 50% off and
 * £50 off differ by the whole margin, and only the outcome makes the
 * slip visible before it is applied.
 *
 * ONE VALUE, ONE KIND, EMITTED TOGETHER (the aggregate-picker rule) —
 * a kind change re-interprets the number immediately, on the same
 * render, so the pair can never disagree in the caller's state.
 *
 * PERCENT IS CAPPED AT 100 AND FIXED AT THE TOTAL — a discount larger
 * than the price is a refund wearing a coupon, refused with the cap
 * stated. Arithmetic in minor units, one rounding.
 */
export function discountResult(totalMinor: number, kind: "percent" | "fixed", value: number) {
  const off = kind === "percent"
    ? Math.round(totalMinor * Math.min(value, 100) / 100)
    : Math.min(Math.round(value * 100), totalMinor);
  return { off, after: totalMinor - off };
}

export function DiscountInput({ totalMinor, kind, value, onChange, currency = "GBP", className }: {
  totalMinor: number;
  kind: "percent" | "fixed";
  value: number;
  onChange: (v: { kind: "percent" | "fixed"; value: number }) => void;
  currency?: string;
  className?: string;
}) {
  const fmt = (m: number) => formatMinor(m, currency);
  const { off, after } = discountResult(totalMinor, kind, value || 0);
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center gap-1.5">
        <div className="inline-flex overflow-hidden rounded-md border border-border">
          {(["percent", "fixed"] as const).map((k) => (
            <button key={k} type="button" aria-pressed={kind === k}
              onClick={() => onChange({ kind: k, value })}
              className={cn("cursor-pointer border-e border-border px-2.5 py-1 text-xs last:border-e-0",
                kind === k ? "bg-foreground font-medium text-background" : "hover:bg-muted")}>
              {k === "percent" ? "%" : "amount"}
            </button>
          ))}
        </div>
        <input inputMode="decimal" value={value || ""} placeholder="0"
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isNaN(n) && n >= 0) onChange({ kind, value: n });
          }}
          className="h-8 w-20 rounded-md border border-input bg-background px-2 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </div>
      {value > 0 ? (
        <p className="text-xs tabular-nums text-muted-foreground" data-discount-result>
          −{fmt(off)} → <b className="text-foreground">{fmt(after)}</b>
          {kind === "percent" && value > 100 ? " (capped at 100%)" : null}
          {kind === "fixed" && value * 100 > totalMinor ? " (capped at the total)" : null}
        </p>
      ) : null}
    </div>
  );
}
