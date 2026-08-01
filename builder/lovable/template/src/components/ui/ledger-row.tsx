import { cn } from "@/lib/utils";
/**
 * One line in an account — debit and credit in their own columns.
 *
 * DEBIT AND CREDIT ARE TWO COLUMNS, NEVER A SIGNED NUMBER. That is not
 * convention for its own sake: a signed column forces the reader to know
 * whether positive means more or less for THIS account, which reverses between
 * assets and liabilities. Two columns are unambiguous in both.
 *
 * THE RUNNING BALANCE IS SHOWN because reconciling is done by scanning for the
 * point where it stops matching, and a list of movements without it makes that
 * a manual addition down the page.
 *
 * A LOCKED PERIOD IS MARKED ON THE ROW. Editing into a closed period is the
 * error that silently changes a filed return, and the row is where somebody is
 * about to try it.
 *
 * MONEY IS RIGHT-ALIGNED AND TABULAR, always. Columns of figures that do not
 * line up cannot be checked by eye, which is how every ledger is actually
 * checked.
 */
export function LedgerRow({ date, description, reference, debit, credit, balance, locked, currency = "GBP", locale = "en-GB", className }: {
  /** Free text — dates in ledgers are the caller's format. */
  date?: string;
  description: string;
  reference?: string;
  debit?: number;
  credit?: number;
  /** Running balance after this line. */
  balance?: number;
  /** True where the period is closed. */
  locked?: boolean;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = (v: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  return (
    <li className={cn("px-3 py-1.5 text-sm", className)}>
      <p className="flex items-baseline gap-3">
        {date && <span className="w-20 shrink-0 text-xs tabular-nums text-muted-foreground">{date}</span>}
        <span className="min-w-0 flex-1">
          {description}
          {reference && <span className="block font-mono text-xs text-muted-foreground">{reference}</span>}
        </span>
        {/* Each figure names its own column for a screen reader. The row cannot
            render a header — it is one `li` — so without this, three unlabelled
            money columns are read out as three numbers, which is precisely the
            ambiguity the two-column layout exists to remove. The caller renders
            the visible header. */}
        <span className="w-24 shrink-0 text-right tabular-nums">
          {debit !== undefined && <><span className="sr-only">Debit </span>{money(debit)}</>}
        </span>
        <span className="w-24 shrink-0 text-right tabular-nums">
          {credit !== undefined && <><span className="sr-only">Credit </span>{money(credit)}</>}
        </span>
        {balance !== undefined && (
          <span className="w-24 shrink-0 text-right tabular-nums text-muted-foreground">
            <span className="sr-only">Balance </span>{money(balance)}
          </span>
        )}
      </p>
      {locked && <p className="text-xs font-medium">This period is closed — this line cannot be changed.</p>}
    </li>
  );
}
