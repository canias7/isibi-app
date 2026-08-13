import * as React from "react";
import { cn, formatMinor } from "@/lib/utils";
/**
 * Options that each move the price, with the total live.
 *
 * `checkbox-group` HAS NO MONEY and `order-summary` takes finished lines.
 * The thing in between — toppings, add-ons, extras, "pick any 3 for £20" —
 * is where a customer decides, and it needs the running total beside the
 * choices rather than on the next screen.
 *
 * THE DELTA IS SHOWN PER OPTION AND SIGNED (+£1.50, −£2.00, or "included"),
 * because "Large" without its price is a question, and free options must say
 * they are free rather than say nothing.
 *
 * A FIXED-PRICE BUNDLE IS THE SAME CONTROL with a different total rule, so
 * `bundlePrice` switches it: the deltas stop counting, a "3 of 3 chosen"
 * counter appears, and further options disable rather than silently ignoring
 * the click. That is a prop, not a second component.
 *
 * All arithmetic in integer minor units — the amount-input contract.
 */
export function OptionPricedList({ options, selected, onChange, basePrice = 0, bundlePrice, pick, currency = "GBP", className }: {
  options: { key: string; label: React.ReactNode; delta: number }[];
  selected: string[];
  onChange: (keys: string[]) => void;
  basePrice?: number;
  /** Fixed total for `pick` options, in minor units. */
  bundlePrice?: number;
  pick?: number;
  currency?: string;
  className?: string;
}) {
  const fmt = (m: number) => formatMinor(m, currency);
  const chosen = new Set(selected);
  const isBundle = bundlePrice != null && pick != null;
  const full = isBundle && selected.length >= pick!;
  const total = isBundle
    ? bundlePrice!
    : basePrice + options.filter((o) => chosen.has(o.key)).reduce((s, o) => s + o.delta, 0);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <ul className="flex flex-col gap-1">
        {options.map((o) => {
          const on = chosen.has(o.key);
          const locked = !on && full;
          return (
            <li key={o.key}>
              <label className={cn("flex items-center justify-between gap-3 rounded-md border px-2.5 py-1.5 text-sm",
                on ? "border-foreground" : "border-border",
                locked ? "cursor-not-allowed opacity-50" : "cursor-pointer")}>
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={on} disabled={locked}
                    onChange={() => onChange(on ? selected.filter((k) => k !== o.key) : [...selected, o.key])}
                    className="size-3.5 cursor-pointer accent-foreground disabled:cursor-not-allowed" />
                  {o.label}
                </span>
                {/* Free must SAY free; a blank reads as unpriced. */}
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {isBundle ? "" : o.delta === 0 ? "included" : o.delta > 0 ? `+${fmt(o.delta)}` : `−${fmt(-o.delta)}`}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <p className="flex items-baseline justify-between text-sm">
        <span className="text-xs text-muted-foreground">
          {isBundle ? `${selected.length} of ${pick} chosen` : `${selected.length} selected`}
        </span>
        <span className="font-semibold tabular-nums">{fmt(total)}</span>
      </p>
    </div>
  );
}
