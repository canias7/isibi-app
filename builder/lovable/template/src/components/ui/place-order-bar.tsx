import * as React from "react";
import { cn, formatMinor } from "@/lib/utils";
/**
 * The pay button — stuck to the bottom, and unpressable twice.
 *
 * DOUBLE-CHARGING IS THE WORST BUG IN COMMERCE and it is a UI bug: a slow
 * network, a second tap, two orders. The button disables on the first press
 * and STAYS disabled until the caller resolves, which is why `onPlace`
 * returns a promise rather than being fire-and-forget.
 *
 * THE AMOUNT IS ON THE BUTTON. "Place order" alone means somebody can be one
 * tap from a charge whose size is off screen, above the fold, on a phone.
 *
 * IT STATES WHAT PRESSING DOES ("you will be charged now") because
 * "authorised now, taken on dispatch" is a different promise and the
 * difference is a dispute.
 *
 * Safe-area padding, because this sits exactly where the home indicator is.
 */
export function PlaceOrderBar({ totalMinor, onPlace, disabled, note, currency = "GBP", className }: {
  totalMinor: number;
  onPlace: () => Promise<void>;
  disabled?: boolean;
  note?: React.ReactNode;
  currency?: string;
  className?: string;
}) {
  const [busy, setBusy] = React.useState(false);
  const fmt = (m: number) => formatMinor(m, currency);
  return (
    <div data-slot="place-order-bar" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      className={cn("sticky bottom-0 flex flex-col gap-1 border-t border-border bg-background px-4 pt-3", className)}>
      <button type="button" disabled={busy || disabled}
        onClick={async () => {
          if (busy) return;
          setBusy(true);
          // Stays busy until the caller settles - one press, one charge.
          try { await onPlace(); } finally { setBusy(false); }
        }}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60">
        {busy ? "Placing your order…" : <>Place order · <span className="tabular-nums">{fmt(totalMinor)}</span></>}
      </button>
      <p className="text-center text-[11px] text-muted-foreground">{note ?? "You will be charged now."}</p>
    </div>
  );
}
