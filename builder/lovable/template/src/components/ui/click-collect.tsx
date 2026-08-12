import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Delivery or collection — with what each actually costs in TIME.
 *
 * PRICE IS NOT THE DECIDING FACTOR, availability is. "Free" collection that
 * is ready on Thursday loses to £3.95 delivery tomorrow, and a picker that
 * shows only the money makes people choose wrong and then complain. Both
 * options carry a when.
 *
 * COLLECTION NAMES THE PLACE AND ITS HOURS. "Collect in store" without which
 * store, or with hours that end before the person finishes work, is the
 * complaint this component exists to prevent.
 */
export function ClickCollect({ value, onChange, delivery, collect, currency = "GBP", className }: {
  value: "delivery" | "collect";
  onChange: (v: "delivery" | "collect") => void;
  delivery: { priceMinor: number; when: string };
  collect: { place: string; when: string; hours?: string; priceMinor?: number };
  currency?: string;
  className?: string;
}) {
  // `currency` was declared in the props TYPE and never destructured, so it
  // could not be read even in principle and the formatter named "GBP" outright:
  // a euro shop that set the prop correctly still priced every line in pounds.
  // It is published in the generated signature, so the model sets it and
  // nothing happens — the worst shape of wrong, because it looks handled.
  const fmt = (m: number) => new Intl.NumberFormat(undefined, { style: "currency", currency }).format(m / 100);
  const rows = [
    { key: "delivery" as const, title: "Delivery", price: delivery.priceMinor, when: delivery.when, sub: null as React.ReactNode },
    { key: "collect" as const, title: `Collect from ${collect.place}`, price: collect.priceMinor ?? 0, when: collect.when, sub: collect.hours },
  ];
  return (
    <fieldset className={cn("flex flex-col gap-1.5", className)}>
      <legend className="sr-only">How to get it</legend>
      {rows.map((r) => (
        <label key={r.key}
          className={cn("flex cursor-pointer items-start justify-between gap-3 rounded-lg border p-2.5",
            value === r.key ? "border-foreground" : "border-border")}>
          <span className="flex items-start gap-2">
            <input type="radio" name="fulfilment" checked={value === r.key} onChange={() => onChange(r.key)}
              className="mt-0.5 size-3.5 cursor-pointer accent-foreground" />
            <span>
              <span className="block text-sm font-medium">{r.title}</span>
              {/* The when decides it, not the price. */}
              <span className="block text-xs text-muted-foreground">{r.when}</span>
              {r.sub ? <span className="block text-[11px] text-muted-foreground">Open {r.sub}</span> : null}
            </span>
          </span>
          <span className="shrink-0 text-sm tabular-nums">{r.price > 0 ? fmt(r.price) : "Free"}</span>
        </label>
      ))}
    </fieldset>
  );
}
