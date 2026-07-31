import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Pick a delivery slot — full ones stay visible.
 *
 * A FULL SLOT THAT IS HIDDEN makes the day look sparse and hides the pattern
 * (mornings always go first), which is the information that gets somebody to
 * book earlier next time. Disabled and struck, like `variant-matrix`.
 *
 * THE PRICE DIFFERENCE PER SLOT IS SHOWN where there is one — off-peak
 * slots are how carriers smooth demand, and a shopper who cannot see the
 * saving will not shift.
 *
 * SLOTS ARE GROUPED BY DAY with the day named in words, because "Tue 14:00"
 * in a long list of times is read as a time first and a day second.
 */
export function DeliveryWindow({ days, value, onChange, currency = "GBP", className }: {
  days: { day: string; slots: { key: string; from: string; to: string; full?: boolean; priceMinor?: number }[] }[];
  value?: string;
  onChange: (key: string) => void;
  currency?: string;
  className?: string;
}) {
  const fmt = (m: number) => new Intl.NumberFormat(undefined, { style: "currency", currency }).format(m / 100);
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {days.map((d) => (
        <div key={d.day} className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold">{d.day}</p>
          <ul className="flex flex-wrap gap-1.5">
            {d.slots.map((s) => (
              <li key={s.key}>
                <button type="button" disabled={s.full} onClick={() => onChange(s.key)}
                  aria-pressed={value === s.key}
                  aria-label={`${d.day} ${s.from} to ${s.to}${s.full ? ", full" : ""}`}
                  className={cn("flex flex-col rounded-md border px-2.5 py-1 text-xs",
                    s.full ? "cursor-not-allowed border-border text-muted-foreground line-through"
                      : value === s.key ? "cursor-pointer border-foreground bg-foreground text-background"
                      : "cursor-pointer border-border hover:bg-muted")}>
                  <span className="tabular-nums">{s.from}–{s.to}</span>
                  {s.priceMinor != null ? (
                    <span className="tabular-nums opacity-80">{s.priceMinor > 0 ? fmt(s.priceMinor) : "Free"}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
