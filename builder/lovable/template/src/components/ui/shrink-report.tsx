import { cn } from "@/lib/utils";
/**
 * What was lost over a period, split by where it went.
 *
 * SHRINK IS ONLY USEFUL BROKEN DOWN. A single percentage is a number nobody can
 * act on; damage, expiry, theft and picking errors have four different fixes,
 * and the split is the recommendation.
 *
 * IT IS SHOWN AGAINST THROUGHPUT, not as a bare total. £4,000 lost is
 * catastrophic on £60,000 of sales and unremarkable on £4m — the rate is what
 * makes the number mean anything, and it is what a comparison with last period
 * or another site has to use.
 *
 * THE BARS ARE PROPORTION, AND EVERY ROW ALSO CARRIES ITS FIGURE. A chart read
 * only by length is unreadable in greyscale and useless to a screen reader; the
 * numbers are the content and the bar is the aid.
 *
 * THE LARGEST CATEGORY IS NAMED IN WORDS, because that sentence is what gets
 * repeated in the meeting, and leaving it to be inferred from bar lengths is
 * how the second-largest ends up being the one that gets attention.
 */
export type ShrinkLine = { id: string; label: string; value: number };

export function ShrinkReport({ period, lines, throughput, currency = "GBP", locale = "en-GB", className }: {
  /** Free text — "July". */
  period?: string;
  lines: ShrinkLine[];
  /** Sales or stock value moved in the period, for the rate. */
  throughput?: number;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 });
  const total = lines.reduce((n, l) => n + l.value, 0);
  const max = Math.max(1, ...lines.map((l) => l.value));
  const biggest = lines.reduce<ShrinkLine | null>((a, l) => (a && a.value >= l.value ? a : l), null);
  const rate = throughput ? total / throughput : undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-sm">
        <span className="font-medium tabular-nums">{money.format(total)} lost</span>
        {period && <span className="text-muted-foreground"> in {period}</span>}
        {rate !== undefined && (
          <span className="block text-xs tabular-nums text-muted-foreground">
            {new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 }).format(rate)} of throughput
          </span>
        )}
      </p>
      <ul className="space-y-1">
        {lines.map((l) => (
          <li key={l.id} className="space-y-0.5">
            <p className="flex items-baseline gap-3 text-sm">
              <span className="min-w-0 flex-1">{l.label}</span>
              <span className="shrink-0 tabular-nums">{money.format(l.value)}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {total ? Math.round((l.value / total) * 100) : 0}%
              </span>
            </p>
            <div className="h-1 rounded-full bg-muted" aria-hidden="true">
              <div className="h-full rounded-full bg-foreground" style={{ width: `${(l.value / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
      {biggest && total > 0 && (
        <p className="text-xs text-muted-foreground">
          Most of it is {biggest.label.toLowerCase()} — {Math.round((biggest.value / total) * 100)}% of the loss.
        </p>
      )}
    </div>
  );
}
