import { BusyButton } from "@/components/ui/busy-button";
import { Money } from "@/components/ui/money";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Tickets, at several prices, with a quantity each.
 *
 * Not `pricing-table`, which sells a subscription: a plan is one choice of one
 * thing and a ticket order is several quantities at once, each against its own
 * dwindling stock. Different props, different arithmetic, different failure.
 *
 * A SOLD-OUT TIER STAYS VISIBLE, struck through and disabled. Removing it is
 * what makes somebody refresh looking for the row they remember; showing it
 * settled answers the question instead. Struck through AND labelled, never
 * greyed alone — grey is the same as disabled is the same as low contrast, and
 * none of the three survive being printed or being colour-blind.
 *
 * `remaining` is stated as a number the moment it is low. "6 left" converts and
 * is also simply true, and a visitor who finds out at checkout that four of
 * their six were gone is a refund and a complaint.
 *
 * The stepper buttons name their tier — "Add one Early bird". Twelve identical
 * "+" buttons is what a screen reader gets otherwise, in a list where the only
 * thing that differs is which row you are on.
 *
 * The total is computed HERE because it is arithmetic over props already held.
 * Nothing else is: no stock checking, no reservation, no payment.
 */
export type Tier = {
  key: string;
  label: string;
  /** Major units — 12.5 is £12.50. */
  price: number;
  note?: string;
  /** Left in stock. Omit if unlimited. */
  remaining?: number;
  /** Say so even when `remaining` is unknown. */
  soldOut?: boolean;
};

export function TicketTiers({
  tiers, quantities, onQuantity, currency = "GBP", maxPerOrder = 10,
  onCheckout, cta = "Continue", busy, lowAt = 10, className,
}: {
  tiers: Tier[];
  quantities: Record<string, number>;
  onQuantity: (key: string, quantity: number) => void;
  currency?: string;
  maxPerOrder?: number;
  onCheckout?: () => void;
  cta?: string;
  busy?: boolean;
  /** Show the count once stock drops to this. */
  lowAt?: number;
  className?: string;
}) {
  if (!tiers.length) return null;
  const total = tiers.reduce((sum, t) => sum + t.price * (quantities[t.key] ?? 0), 0);
  const count = tiers.reduce((n, t) => n + (quantities[t.key] ?? 0), 0);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
        {tiers.map((t) => {
          const gone = t.soldOut || t.remaining === 0;
          const qty = quantities[t.key] ?? 0;
          const ceiling = Math.min(maxPerOrder, t.remaining ?? maxPerOrder);
          return (
            <li key={t.key} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className={cn("font-medium", gone && "text-muted-foreground line-through")}>{t.label}</p>
                {t.note && <p className="text-sm text-muted-foreground">{t.note}</p>}
                {gone ? (
                  <p className="text-sm font-medium">Sold out</p>
                ) : typeof t.remaining === "number" && t.remaining <= lowAt ? (
                  <p className="text-sm text-muted-foreground tabular-nums">{t.remaining} left</p>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <Money amount={t.price} currency={currency} className="text-sm" />
                {gone ? null : (
                  <div className="flex items-center gap-1">
                    <button type="button" disabled={qty <= 0}
                      onClick={() => onQuantity(t.key, qty - 1)}
                      aria-label={`Remove one ${t.label}`}
                      className="grid size-8 cursor-pointer place-items-center rounded border border-border disabled:cursor-not-allowed disabled:opacity-40">
                      <Minus className="size-3.5" aria-hidden />
                    </button>
                    <span aria-live="polite" className="w-7 text-center text-sm tabular-nums">
                      <span className="sr-only">{t.label}: </span>{qty}
                    </span>
                    <button type="button" disabled={qty >= ceiling}
                      onClick={() => onQuantity(t.key, qty + 1)}
                      aria-label={`Add one ${t.label}`}
                      className="grid size-8 cursor-pointer place-items-center rounded border border-border disabled:cursor-not-allowed disabled:opacity-40">
                      <Plus className="size-3.5" aria-hidden />
                    </button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {count === 0 ? "No tickets selected" : <>{count} {count === 1 ? "ticket" : "tickets"} · <Money amount={total} currency={currency} /></>}
        </p>
        {onCheckout && (
          <BusyButton busy={busy} disabled={count === 0} onClick={onCheckout}>{cta}</BusyButton>
        )}
      </div>
    </div>
  );
}
