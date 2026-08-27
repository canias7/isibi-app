import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * "This is a gift" — and the one thing that actually matters.
 *
 * HIDING THE PRICES IS THE POINT, not the wrapping. Every other gift feature
 * is optional decoration; a receipt with the price on it arriving at the
 * recipient is the failure people are trying to avoid, so it is the first
 * checkbox and it is on by default once gifting is on.
 *
 * IT SAYS WHERE THE RECEIPT GOES INSTEAD — the buyer still needs one, and
 * "emailed to you" is the sentence that lets somebody relax.
 */
export function GiftToggle({ isGift, hidePrices, onChange, children, className }: {
  isGift: boolean;
  hidePrices: boolean;
  onChange: (v: { isGift: boolean; hidePrices: boolean }) => void;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="gift-toggle" className={cn("flex flex-col gap-1.5", className)}>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={isGift}
          onChange={(e) => onChange({ isGift: e.target.checked, hidePrices: e.target.checked })}
          className="size-3.5 cursor-pointer accent-foreground" />
        This is a gift
      </label>
      {isGift ? (
        <div className="flex flex-col gap-1.5 ps-6">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={hidePrices}
              onChange={(e) => onChange({ isGift, hidePrices: e.target.checked })}
              className="size-3.5 cursor-pointer accent-foreground" />
            Leave prices off the delivery note
          </label>
          <p className="text-[11px] text-muted-foreground">Your full receipt is emailed to you either way.</p>
          {children}
        </div>
      ) : null}
    </div>
  );
}
