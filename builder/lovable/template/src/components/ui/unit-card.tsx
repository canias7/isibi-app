import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * One storage size: what it costs, whether one is free, and what fits in it.
 *
 * THE PRICE IS ON THE CARD. The self-storage trade hides prices behind a form
 * on purpose, because the quote is the sales call — which is exactly why
 * putting the number on the page is the opening for anybody who does not want
 * to run one. If a caller has no price this renders "Ask us" rather than an
 * empty space, because a blank where a number should be reads as a bug.
 *
 * WHAT FITS IS IN FURNITURE, NEVER IN SQUARE FEET. Nobody can picture 50 sq ft.
 * Everybody can picture "a one-bed flat, or a car off the road for the winter",
 * and it is the single question every enquiry starts with. `fits` is therefore
 * a required field: a size with no equivalence is a number nobody can use.
 *
 * FREE OR TAKEN IN WORDS, and "one left" is stated as a number rather than as
 * urgency furniture. `available` undefined is "Ask us" — a site that has not
 * synced its board this morning has not thereby sold out, and rendering unknown
 * as taken turns a stale field into a lost customer. Same rule as
 * `session-table` and `date-enquiry`.
 *
 * `Intl.NumberFormat` for the money, so a currency change is one prop and not
 * a search for pound signs.
 */
export function UnitCard({
  size, dimensions, price, period = "a month", available, fits, features,
  currency = "GBP", locale = "en-GB", onReserve, action, className,
}: {
  /** "50 sq ft", "Small", "Container". Whatever the site calls it. */
  size: string;
  /** "2.3m × 2.0m × 2.4m high". */
  dimensions?: string | null;
  price?: number | null;
  period?: string;
  /** How many are free. Undefined is unknown, which is NOT the same as none. */
  available?: number | null;
  /** What fits, in things people own. Required — a size alone is unusable. */
  fits: string;
  features?: string[];
  currency?: string;
  locale?: string;
  onReserve?: () => void;
  /** Overrides the default button entirely. */
  action?: React.ReactNode;
  className?: string;
}) {
  const known = typeof available === "number";
  const none = available === 0;
  const money = (n: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  return (
    <article className={cn("flex flex-col rounded-xl border border-border p-6", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-2xl font-semibold tracking-tight">{size}</h3>
        <p className="shrink-0 text-end">
          <span className="text-xl font-semibold tabular-nums">
            {typeof price === "number" ? money(price) : "Ask us"}
          </span>
          {typeof price === "number" && <span className="block text-xs text-muted-foreground">{period}</span>}
        </p>
      </div>
      {dimensions && <p className="mt-1 text-sm tabular-nums text-muted-foreground">{dimensions}</p>}

      <p className="mt-4 text-base leading-relaxed">{fits}</p>

      {features && features.length > 0 && (
        <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
          {features.map((f) => <li key={f}>{f}</li>)}
        </ul>
      )}

      <div className="mt-auto pt-5">
        {/* WORDS AND A NUMBER, never a green dot beside a red one. */}
        <p className={cn("text-sm", none ? "font-medium" : known ? "font-medium" : "text-muted-foreground")}>
          {none ? "None free — ask to join the list"
            : known ? `${available} free now`
            : "Ask us what is free"}
        </p>
        {action ?? (
          <Button className="mt-3 w-full" variant={none ? "outline" : "default"} onClick={onReserve}>
            {none ? "Tell me when one comes up" : "Reserve this size"}
          </Button>
        )}
      </div>
    </article>
  );
}
