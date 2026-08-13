import * as React from "react";
import { cn, formatMinor } from "@/lib/utils";
/**
 * "Two things changed price while this sat in your basket."
 *
 * BASKETS SURVIVE FOR WEEKS and prices do not. Charging the new price
 * silently is the practice that produces chargebacks; showing the change at
 * the till, itemised, before the pay button, is the practice that does not.
 *
 * BOTH DIRECTIONS ARE SHOWN. A component that only surfaces increases is a
 * legal notice; one that surfaces drops too is a shop being straight with
 * somebody, and the drops are the ones that get read.
 *
 * THE NET EFFECT IS STATED once at the end, because three small rises and
 * one big fall is a basket that got cheaper, and nobody sums that in their
 * head while holding a card.
 */
export function PriceChangedNote({ changes, currency = "GBP", onAccept, className }: {
  changes: { id: string; name: React.ReactNode; wasMinor: number; nowMinor: number }[];
  currency?: string;
  onAccept?: () => void;
  className?: string;
}) {
  if (!changes.length) return null;
  const fmt = (m: number) => formatMinor(m, currency);
  const net = changes.reduce((s, c) => s + (c.nowMinor - c.wasMinor), 0);
  return (
    <div role="status" className={cn("flex flex-col gap-1.5 rounded-lg border-2 border-foreground p-3", className)}>
      <p className="text-sm font-semibold">
        {changes.length === 1 ? "One item changed price" : `${changes.length} items changed price`} while this was in your basket
      </p>
      <ul className="flex flex-col gap-0.5 text-xs tabular-nums">
        {changes.map((c) => (
          <li key={c.id} className="flex justify-between gap-3">
            <span className="min-w-0 truncate">{c.name}</span>
            <span>
              {fmt(c.wasMinor)} → <b>{fmt(c.nowMinor)}</b>
              <span className="ml-1 text-muted-foreground">
                {c.nowMinor > c.wasMinor ? `up ${fmt(c.nowMinor - c.wasMinor)}` : `down ${fmt(c.wasMinor - c.nowMinor)}`}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {/* Nobody nets three rises and a fall in their head at the till. */}
      <p className="text-xs tabular-nums">
        {net === 0 ? "Your total is unchanged."
          : net > 0 ? <>Your basket is <b>{fmt(net)} more</b> than when you added these.</>
          : <>Your basket is <b>{fmt(-net)} less</b> than when you added these.</>}
      </p>
      {onAccept ? (
        <button type="button" onClick={onAccept}
          className="cursor-pointer self-start rounded-md border border-border px-2.5 py-1 text-xs font-medium">
          Got it, continue
        </button>
      ) : null}
    </div>
  );
}
