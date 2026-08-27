import { cn } from "@/lib/utils";
/**
 * Narrowing which events actually get sent, beyond the type.
 *
 * FILTERING AT THE SOURCE IS THE ONLY THING THAT REDUCES LOAD. Subscribing to
 * every booking event and discarding most of them at the receiving end still
 * costs a request each — and it is why endpoints get auto-disabled under
 * volume. A condition here means the event is never sent.
 *
 * IT SHOWS WHAT PROPORTION THE FILTER LETS THROUGH, from the caller's own
 * recent traffic. A filter is written blind otherwise: nobody knows whether
 * `amount > 500` matches half the events or four a year, and the second is
 * usually a mistake.
 *
 * A FILTER MATCHING NOTHING IS FLAGGED. Silence after adding a filter reads as
 * a broken webhook, and it is the single most common outcome of a typo in a
 * field name.
 *
 * IT COMPOSES `ConditionRow`, so the operator-per-field rule and the value
 * handling live in one place rather than being restated for webhooks.
 */
export function EventFilter({ children, matched, sampleSize, className }: {
  /** The condition rows. */
  children: React.ReactNode;
  /** How many of a recent sample the filter would let through. */
  matched?: number;
  sampleSize?: number;
  className?: string;
}) {
  const share = matched !== undefined && sampleSize
    ? Math.round((matched / sampleSize) * 100)
    : null;
  return (
    <div data-slot="event-filter" className={cn("space-y-2", className)}>
      <div className="space-y-1.5">{children}</div>
      {matched !== undefined && sampleSize !== undefined && (
        <p className="text-sm">
          {matched === 0 ? (
            <>
              <span className="font-medium">Nothing would be sent.</span>
              <span className="text-muted-foreground">
                {" "}None of the last {sampleSize.toLocaleString()} events match — check the field names.
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">
              <span className="tabular-nums text-foreground">{matched.toLocaleString()}</span> of the last{" "}
              <span className="tabular-nums">{sampleSize.toLocaleString()}</span> events would be sent
              {share !== null && <span> · {share}%</span>}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
