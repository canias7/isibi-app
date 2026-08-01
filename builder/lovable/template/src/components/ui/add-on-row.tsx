import { cn } from "@/lib/utils";
/**
 * An extra on a plan — with the same weight given to removing it.
 *
 * REMOVING IS AS PROMINENT AS ADDING. Every add-on screen ever built makes
 * subscribing a button and unsubscribing a support conversation, and the
 * asymmetry is deliberate everywhere it appears. Here both are buttons of the
 * same size.
 *
 * WHEN A REMOVAL TAKES EFFECT IS STATED BEFORE IT IS CONFIRMED. "Removed at the
 * end of the billing period" and "removed now, no refund" are both reasonable
 * and completely different, and somebody pressing the button deserves to know
 * which they are getting.
 *
 * A ONE-MONTH TRIAL PRICE SHOWS WHEN IT ENDS AND WHAT IT BECOMES. A free trial
 * that quietly turns into a charge is the most common complaint about this exact
 * component.
 *
 * THE ANNUAL COST IS SHOWN BESIDE THE MONTHLY. Small monthly amounts are how
 * add-ons accumulate unnoticed; the yearly figure is the one that gets them
 * reviewed.
 */
export function AddOnRow({ name, monthlyPrice, active, trialEndsOn, priceAfterTrial, removalTakesEffect = "at the end of this billing period", onAdd, onRemove, currency = "GBP", locale = "en-GB", className }: {
  name: string;
  monthlyPrice: number;
  active?: boolean;
  trialEndsOn?: string;
  priceAfterTrial?: number;
  /** Stated before the button is pressed. */
  removalTakesEffect?: string;
  onAdd?: () => void;
  onRemove?: () => void;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = (v: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
      maximumFractionDigits: Number.isInteger(v) ? 0 : 2,
    }).format(v);
  return (
    <li className={cn("space-y-1 px-3 py-2 text-sm", className)}>
      <p className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 font-medium">{name}</span>
        <span className="shrink-0 tabular-nums">{money(monthlyPrice)}/mo</span>
      </p>
      <p className="text-xs tabular-nums text-muted-foreground">
        {money(monthlyPrice * 12)} a year.
      </p>
      {/* Only a warning when the price actually rises. Announcing that £6 becomes
          £6 "on its own unless you remove it" is a false alarm, and a component
          that cries wolf on the ordinary case is ignored on the real one. */}
      {trialEndsOn && (priceAfterTrial === undefined || priceAfterTrial > monthlyPrice) && (
        <p className="text-xs font-medium tabular-nums">
          Trial price until {trialEndsOn}, then {priceAfterTrial !== undefined ? money(priceAfterTrial) : "the full price"} a
          month. It changes on its own unless you remove it.
        </p>
      )}
      {trialEndsOn && priceAfterTrial !== undefined && priceAfterTrial <= monthlyPrice && (
        <p className="text-xs tabular-nums text-muted-foreground">
          The trial ends {trialEndsOn} and the price stays the same.
        </p>
      )}
      {active ? (
        <>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            Remove it
          </button>
          <p className="text-xs text-muted-foreground">Removing takes effect {removalTakesEffect}.</p>
        </>
      ) : (
        <button
          type="button"
          onClick={onAdd}
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent"
        >
          Add it
        </button>
      )}
    </li>
  );
}
