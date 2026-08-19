import { cn } from "@/lib/utils";
/**
 * A trial balance — every account, and whether the two sides agree.
 *
 * A BALANCED TRIAL BALANCE PROVES ALMOST NOTHING, and the component says so.
 * It catches one-sided entries and arithmetic; it cannot see a correct amount
 * posted to the wrong account, a transaction omitted entirely, or two errors
 * that cancel. Presenting "balanced" as a clean bill of health is the single
 * most common misreading in bookkeeping.
 *
 * THE DIFFERENCE IS SHOWN AS A FIGURE because its shape is diagnostic: a
 * difference divisible by 9 is a transposition, one that is exactly twice a
 * transaction is a side posted the wrong way, and a round number is usually an
 * omission.
 *
 * TOTALS ARE COMPUTED FROM THE ROWS, never accepted as an input. A footer that
 * can disagree with the column above it is the one thing a trial balance must
 * not have.
 *
 * ROUNDING HAPPENS ONCE, AT THE SUM. Summing binary floats produces a
 * fractional-penny difference that looks exactly like a real error.
 */
export type TrialBalanceLine = { id: string; code?: string; account: string; debit?: number; credit?: number };

export function TrialBalanceRow({ lines, asAt, currency = "GBP", locale = "en-GB", className }: {
  lines: TrialBalanceLine[];
  /** Free text — "31 March 2026". */
  asAt?: string;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = (v: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  const dr = Number(lines.reduce((n, l) => n + (l.debit ?? 0), 0).toFixed(2));
  const cr = Number(lines.reduce((n, l) => n + (l.credit ?? 0), 0).toFixed(2));
  const diff = Number((dr - cr).toFixed(2));
  const pence = Math.round(Math.abs(diff) * 100);
  const transposition = pence > 0 && pence % 9 === 0;
  return (
    <div className={cn("space-y-1", className)}>
      {asAt && <p className="text-xs text-muted-foreground">As at {asAt}</p>}
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        <li className="flex items-baseline gap-3 px-3 py-1.5 text-xs text-muted-foreground">
          <span className="min-w-0 flex-1">Account</span>
          <span className="w-24 shrink-0 text-end">Debit</span>
          <span className="w-24 shrink-0 text-end">Credit</span>
        </li>
        {lines.map((l) => (
          <li key={l.id} className="flex items-baseline gap-3 px-3 py-1.5">
            {l.code && <code className="w-14 shrink-0 font-mono text-xs text-muted-foreground">{l.code}</code>}
            <span className="min-w-0 flex-1">{l.account}</span>
            <span className="w-24 shrink-0 text-end tabular-nums">{l.debit !== undefined ? money(l.debit) : ""}</span>
            <span className="w-24 shrink-0 text-end tabular-nums">{l.credit !== undefined ? money(l.credit) : ""}</span>
          </li>
        ))}
        <li className="flex items-baseline gap-3 px-3 py-1.5 font-medium">
          <span className="min-w-0 flex-1">Totals</span>
          <span className="w-24 shrink-0 text-end tabular-nums">{money(dr)}</span>
          <span className="w-24 shrink-0 text-end tabular-nums">{money(cr)}</span>
        </li>
      </ul>
      {diff === 0 ? (
        <p className="text-xs text-muted-foreground">
          It balances — which only rules out one-sided entries. A right amount in the wrong account balances perfectly.
        </p>
      ) : (
        <p className="text-xs font-medium tabular-nums">
          Out by {money(Math.abs(diff))}.
          {transposition && " That is divisible by 9, which usually means two digits transposed."}
        </p>
      )}
    </div>
  );
}
