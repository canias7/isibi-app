import { cn } from "@/lib/utils";
/**
 * One line of a count — expected against found, and what that is worth.
 *
 * THE VARIANCE IS SHOWN IN UNITS AND IN MONEY. Six missing screws and six
 * missing motherboards are the same number and not the same problem, and the
 * value is what decides whether anybody investigates.
 *
 * THE EXPECTED FIGURE IS HIDDEN UNTIL A COUNT IS ENTERED, optionally, and that
 * is the single most useful thing here: a counter who can see the answer counts
 * to it. `blindUntilCounted` is the honest default for a real stocktake.
 *
 * A RECOUNT IS A STATE, not a second row. A variance over a threshold is
 * normally counted again before anything is adjusted, and showing that this
 * line is awaiting a recount stops the adjustment being posted from the first
 * pass.
 *
 * DIRECTION IS WRITTEN, not implied by a sign. "4 more than expected" and "4
 * fewer" are different investigations — one is a receipt never booked in, the
 * other is loss — and a bare `-4` reads as neither at a glance.
 */
export function CycleCountRow({ item, location, expected, counted, unitValue, currency = "GBP", locale = "en-GB", blindUntilCounted = true, awaitingRecount, className }: {
  item: string;
  location?: string;
  expected: number;
  /** Undefined until somebody counts. */
  counted?: number;
  /** Per-unit value, for the variance figure. */
  unitValue?: number;
  currency?: string;
  locale?: string;
  /** Hide the expected figure until a count is entered. */
  blindUntilCounted?: boolean;
  awaitingRecount?: boolean;
  className?: string;
}) {
  const has = counted !== undefined;
  const diff = has ? counted - expected : 0;
  const money = unitValue !== undefined
    ? new Intl.NumberFormat(locale, { style: "currency", currency }).format(Math.abs(diff) * unitValue)
    : undefined;
  return (
    <li data-slot="cycle-count-row" className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1">
          {item}
          {location && <span className="block font-mono text-xs text-muted-foreground">{location}</span>}
        </span>
        <span className="shrink-0 tabular-nums">
          {has ? counted : "not counted"}
          {(has || !blindUntilCounted) && (
            <span className="text-muted-foreground"> of {expected} expected</span>
          )}
        </span>
      </p>
      {has && diff !== 0 && (
        <p className="text-xs font-medium tabular-nums">
          {Math.abs(diff)} {diff > 0 ? "more" : "fewer"} than expected
          {money && ` · ${money}`}
        </p>
      )}
      {has && diff === 0 && <p className="text-xs text-muted-foreground">Matches.</p>}
      {awaitingRecount && (
        <p className="text-xs font-medium">Count again before anything is adjusted.</p>
      )}
    </li>
  );
}
