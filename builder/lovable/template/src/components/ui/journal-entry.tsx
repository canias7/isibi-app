import { cn } from "@/lib/utils";
/**
 * A manual double-entry — checked for balance before it can be posted.
 *
 * THE BALANCE CHECK IS THE COMPONENT. Debits must equal credits, an unbalanced
 * journal cannot legitimately post, and the moment to say so is while it is
 * being written rather than on submission — the difference is shown as a
 * figure, because "unbalanced" without the amount means hunting for it.
 *
 * A NARRATIVE IS REQUIRED. A journal with no explanation is the single hardest
 * thing to audit: whoever posted it will not remember, and it is exactly the
 * shape that fraud and honest error both take.
 *
 * A REVERSING JOURNAL SAYS WHEN IT REVERSES. Accruals posted without their
 * reversal are counted twice, and the date belongs on the entry rather than in
 * somebody's diary.
 *
 * FLOATING-POINT SUMS ARE ROUNDED BEFORE COMPARISON. Money summed as binary
 * floats produces a 0.0000000001 imbalance that blocks a perfectly correct
 * journal, which is a very annoying way to be wrong.
 */
export type JournalLine = { id: string; account: string; debit?: number; credit?: number };

export function JournalEntry({ date, narrative, lines, reversesOn, postedBy, currency = "GBP", locale = "en-GB", className }: {
  date?: string;
  /** Why this entry exists. */
  narrative?: string;
  lines: JournalLine[];
  /** Free text — when it reverses out. */
  reversesOn?: string;
  postedBy?: string;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = (v: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  // Rounded before comparison: summed as binary floats, two sides that agree to
  // the penny differ by 1e-10 and a correct journal is refused.
  const dr = Number(lines.reduce((n, l) => n + (l.debit ?? 0), 0).toFixed(2));
  const cr = Number(lines.reduce((n, l) => n + (l.credit ?? 0), 0).toFixed(2));
  const out = Number((dr - cr).toFixed(2));
  return (
    <div className={cn("space-y-1", className)}>
      {date && <p className="text-xs tabular-nums text-muted-foreground">{date}</p>}
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {/* This component owns the whole block, so it owns the header. Two
            unlabelled money columns are the one thing a double entry must not
            have. */}
        <li className="flex items-baseline gap-3 px-3 py-1.5 text-xs text-muted-foreground">
          <span className="min-w-0 flex-1">Account</span>
          <span className="w-24 shrink-0 text-end">Debit</span>
          <span className="w-24 shrink-0 text-end">Credit</span>
        </li>
        {lines.map((l) => (
          <li key={l.id} className="flex items-baseline gap-3 px-3 py-1.5">
            <span className="min-w-0 flex-1">{l.account}</span>
            <span className="w-24 shrink-0 text-end tabular-nums">{l.debit !== undefined ? money(l.debit) : ""}</span>
            <span className="w-24 shrink-0 text-end tabular-nums">{l.credit !== undefined ? money(l.credit) : ""}</span>
          </li>
        ))}
        <li className="flex items-baseline gap-3 px-3 py-1.5 text-sm font-medium">
          <span className="min-w-0 flex-1">Totals</span>
          <span className="w-24 shrink-0 text-end tabular-nums">{money(dr)}</span>
          <span className="w-24 shrink-0 text-end tabular-nums">{money(cr)}</span>
        </li>
      </ul>
      <p className={cn("text-xs tabular-nums", out !== 0 ? "font-medium" : "text-muted-foreground")}>
        {out === 0
          ? "Balanced."
          : `Out by ${money(Math.abs(out))} — this cannot be posted until it balances.`}
      </p>
      <p className={cn("text-xs", narrative ? "text-muted-foreground" : "font-medium")}>
        {narrative ?? "No narrative — nobody, including you, will remember why this was posted."}
      </p>
      {reversesOn && <p className="text-xs">Reverses on {reversesOn}.</p>}
      {postedBy && <p className="text-xs text-muted-foreground">Posted by {postedBy}.</p>}
    </div>
  );
}
