import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * The amount picker. Presets with what each one buys, one-off beside monthly,
 * and a field for typing your own.
 *
 * MONTHLY IS OFFERED AT EQUAL WEIGHT, never as an upsell after the fact. A
 * charity is funded by regular givers and rescued by one-off ones; burying the
 * standing order behind a checkbox at the end is how a sector that runs on
 * £8-a-month asks for £8 once. Both are the same control here, and switching
 * re-labels the presets rather than hiding them.
 *
 * EVERY PRESET SAYS WHAT IT BUYS. "£25" is a number; "£25 — a week of hot meals
 * for one household" is a decision. A tier with no `buys` renders the number
 * alone rather than inventing a claim, because a made-up equivalence is worse
 * than none.
 *
 * THE FREE FIELD IS NOT HIDDEN. Presets anchor, and somebody who wants to give
 * £7 should not have to feel they are doing it wrong.
 *
 * WHICH CADENCE IT OPENS ON IS THE CHARITY'S CALL, not this component's, so
 * `defaultCadence` exists alongside the controlled pair. Rendered without one,
 * a page whose own heading reads "monthly is what lets us plan" opened on "Just
 * once" — the copy asking for one thing and the control offering another. The
 * default stays "once" because that is the safe answer for an appeal.
 *
 * `Intl.NumberFormat` does the currency, so €1.234,56 and £1,234.56 both come
 * out right — no new dependency.
 */
export type Tier = {
  amount: number;
  /** What this amount does. Omit rather than invent one. */
  buys?: string | null;
  /** The one the charity would like picked. Exactly one, or none. */
  suggested?: boolean;
};
export function DonationTiers({
  oneOff, monthly, currency = "GBP", locale = "en-GB",
  cadence, defaultCadence = "once", onCadence, onGive, className,
}: {
  oneOff: Tier[];
  /** Omit and the monthly switch is not offered at all. */
  monthly?: Tier[];
  currency?: string;
  locale?: string;
  /** Controlled when supplied; otherwise it manages its own. */
  cadence?: "once" | "monthly";
  /** Which one it opens on when uncontrolled. Pass "monthly" if that is the ask. */
  defaultCadence?: "once" | "monthly";
  onCadence?: (c: "once" | "monthly") => void;
  onGive?: (v: { amount: number; cadence: "once" | "monthly" }) => void;
  className?: string;
}) {
  const [ownCadence, setOwnCadence] = React.useState<"once" | "monthly">(defaultCadence);
  const mode = cadence ?? ownCadence;
  const setMode = (c: "once" | "monthly") => { onCadence ? onCadence(c) : setOwnCadence(c); setPicked(null); setOther(""); };
  const tiers = mode === "monthly" && monthly ? monthly : oneOff;
  const [picked, setPicked] = React.useState<number | null>(null);
  const [other, setOther] = React.useState("");
  const id = React.useId();
  const money = (n: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  const typed = Number(other.replace(/[^0-9.]/g, ""));
  const amount = other.trim() ? (Number.isFinite(typed) && typed > 0 ? typed : 0) : picked ?? 0;

  return (
    <div className={cn("space-y-5", className)}>
      {monthly && (
        <div className="inline-flex rounded-lg border border-border p-1" role="group" aria-label="How often">
          {(["monthly", "once"] as const).map((c) => (
            <button
              key={c} type="button" onClick={() => setMode(c)} aria-pressed={mode === c}
              className={cn("rounded-md px-4 py-2 text-sm font-medium",
                mode === c ? "bg-foreground text-background" : "text-muted-foreground")}
            >
              {c === "monthly" ? "Every month" : "Just once"}
            </button>
          ))}
        </div>
      )}

      <fieldset>
        <legend className="sr-only">Amount</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {tiers.map((t) => {
            const on = !other.trim() && picked === t.amount;
            return (
              <label key={t.amount} className={cn(
                "cursor-pointer rounded-lg border p-4",
                on ? "border-foreground ring-1 ring-foreground" : "border-border",
              )}>
                <input type="radio" name={`${id}-amount`} className="sr-only" checked={on}
                  onChange={() => { setPicked(t.amount); setOther(""); }} />
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-xl font-semibold tabular-nums">{money(t.amount)}</span>
                  {/* Weight and a word, never a colour — the kit's rule, and it
                      is the difference between a suggestion and a decoration. */}
                  {t.suggested && <span className="text-xs font-medium uppercase tracking-widest">Most give this</span>}
                </span>
                {t.buys && <span className="mt-1.5 block text-sm leading-snug text-muted-foreground">{t.buys}</span>}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-1.5">
        <label htmlFor={`${id}-other`} className="text-sm font-medium">Another amount</label>
        <input
          id={`${id}-other`} value={other} inputMode="decimal" placeholder="Whatever you can"
          onChange={(e) => { setOther(e.target.value); setPicked(null); }}
          className="h-10 w-40 rounded-md border border-border bg-background px-3 tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <Button size="lg" disabled={!amount} onClick={() => amount && onGive?.({ amount, cadence: mode })}>
        {amount
          ? <>Give {money(amount)}{mode === "monthly" ? " a month" : ""}</>
          : <>Choose an amount</>}
      </Button>
    </div>
  );
}
