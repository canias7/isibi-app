import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * "Leave it if I am out" — consent that moves the risk, and says so.
 *
 * THE SENTENCE THAT MATTERS IS THE LIABILITY ONE. Ticking this transfers
 * the risk of a stolen parcel from the shop to the customer, and a shop
 * that takes that consent without saying it plainly will lose the argument
 * anyway — so it is stated in the label, not in terms three clicks away.
 *
 * A NAMED PLACE IS REQUIRED once it is on. "Leave safe" with nowhere named
 * means the driver decides, which is how parcels end up in bins and behind
 * gates that lock. The free-text place is part of the consent.
 *
 * OFF BY DEFAULT, always. This is a risk transfer; opting in is the only
 * defensible default, exactly like `substitution-pref`.
 */
export function LeaveSafeConsent({ enabled, place, onChange, className }: {
  enabled: boolean;
  place: string;
  onChange: (v: { enabled: boolean; place: string }) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label className="flex cursor-pointer items-start gap-2 text-sm">
        <input type="checkbox" checked={enabled}
          onChange={(e) => onChange({ enabled: e.target.checked, place })}
          className="mt-0.5 size-3.5 cursor-pointer accent-foreground" />
        <span>
          Leave it somewhere safe if I am out
          {/* Said plainly, in the label - not in terms three clicks away. */}
          <span className="block text-xs text-muted-foreground">
            If it goes missing after it is left, that is on you rather than on us.
          </span>
        </span>
      </label>
      {enabled ? (
        <div className="flex flex-col gap-1 pl-6">
          <input value={place} onChange={(e) => onChange({ enabled, place: e.target.value })}
            placeholder="Where exactly? e.g. in the porch, behind the blue bin"
            aria-label="Where to leave it"
            className="h-9 rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          {!place.trim() ? (
            <p className="text-[11px] font-medium">Name the place — otherwise the driver decides.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
