import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";
/**
 * Who is up and who is down, after everything is counted.
 *
 * BALANCES, NOT A LEDGER. A list of who paid for what is a record; what people
 * actually want is one number each, and working it out from the transactions is
 * the tedious part this replaces.
 *
 * OWED AND OWING ARE SEPARATE WORDS, never a sign. "−£24" requires the reader to
 * remember the convention; "owes £24" does not, and it cannot be misread on a
 * shared screen.
 *
 * SETTLED PEOPLE ARE STILL LISTED, so nobody has to work out whether they were
 * left off deliberately or by mistake — the commonest source of arguments about
 * a shared bill.
 */
export function WhoOwes({ balances, currency = "GBP", className }: {
  /** Positive is owed TO them, negative is owed BY them. */
  balances: { name: string; amount: number }[];
  currency?: string;
  className?: string;
}) {
  if (!balances.length) return null;
  const sorted = [...balances].sort((a, b) => a.amount - b.amount);
  return (
    <ul className={cn("divide-y divide-border text-sm", className)}>
      {sorted.map((b) => (
        <li key={b.name} className="flex items-baseline justify-between gap-3 py-1.5">
          <span className="min-w-0 truncate">{b.name}</span>
          <span className="shrink-0 tabular-nums">
            {b.amount === 0 ? (
              <span className="text-muted-foreground">settled up</span>
            ) : b.amount < 0 ? (
              <>owes <Money amount={-b.amount} currency={currency} /></>
            ) : (
              <span className="text-muted-foreground">is owed <Money amount={b.amount} currency={currency} /></span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
