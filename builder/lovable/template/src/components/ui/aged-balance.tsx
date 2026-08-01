import { cn } from "@/lib/utils";
/**
 * What is owed, by how overdue it is.
 *
 * THE BUCKETS ARE FROM THE DUE DATE, NOT THE INVOICE DATE, and the component
 * says which. Ageing from the invoice date makes everything on 60-day terms
 * look a month late, and the two conventions differ enough to change who gets
 * chased.
 *
 * THE OLDEST BUCKET IS THE ONE THAT MATTERS. Recovery falls sharply with age,
 * so a large 90-plus balance is worth more attention than a larger current one
 * — which is the reverse of how a total sorts them.
 *
 * A CREDIT BALANCE IS SHOWN AS ONE, not netted away. An account in credit
 * inside an ageing report means an unallocated payment or a credit note, and
 * netting it against another customer's debt hides both.
 *
 * BARS CARRY THEIR FIGURES IN TEXT, and the gap between rows exceeds the gap
 * inside one — spaced evenly, each bar reads as belonging to the row beneath.
 */
export type AgeBucket = { id: string; label: string; amount: number };

export function AgedBalance({ buckets, customer, ageFrom = "the due date", currency = "GBP", locale = "en-GB", className }: {
  buckets: AgeBucket[];
  customer?: string;
  /** Which date the ageing runs from. */
  ageFrom?: string;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = (v: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
  const total = buckets.reduce((n, b) => n + b.amount, 0);
  const max = Math.max(1, ...buckets.map((b) => Math.abs(b.amount)));
  const oldest = buckets[buckets.length - 1];
  const credits = buckets.filter((b) => b.amount < 0);
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-sm tabular-nums">
        <span className="font-medium">{money(total)}</span>
        {customer && <span className="text-muted-foreground"> · {customer}</span>}
      </p>
      <ul className="space-y-2.5">
        {buckets.map((b) => (
          <li key={b.id} className="space-y-0.5">
            <p className="flex items-baseline gap-3 text-sm">
              <span className="min-w-0 flex-1">{b.label}</span>
              {/* A credit is named, not rendered as "-£220". A leading hyphen in
                  a column of debts reads as a typo or a formatting fault, and
                  the whole reason this bucket is not netted away is that
                  somebody should notice it. */}
              <span className="shrink-0 tabular-nums">
                {b.amount < 0 ? `${money(Math.abs(b.amount))} in credit` : money(b.amount)}
              </span>
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full border border-border" aria-hidden="true">
              <span className="block h-full bg-foreground" style={{ width: `${(Math.abs(b.amount) / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">Aged from {ageFrom}.</p>
      {oldest && oldest.amount > 0 && (
        <p className="text-xs font-medium tabular-nums">
          {money(oldest.amount)} is in {oldest.label.toLowerCase()} — recovery falls sharply past that point.
        </p>
      )}
      {credits.length > 0 && (
        <p className="text-xs">
          There is a credit balance here — usually an unallocated payment or a credit note, and worth clearing before chasing.
        </p>
      )}
    </div>
  );
}
