import { cn } from "@/lib/utils";
/**
 * The account list — grouped by type, because the type decides the behaviour.
 *
 * THE TYPE IS SHOWN ON EVERY ACCOUNT. Whether a balance is a debit or a credit,
 * whether it carries forward at year end or resets, and which statement it lands
 * on all follow from it — and an account created under the wrong type produces
 * a set of accounts that is wrong in a way nobody spots for a year.
 *
 * AN ACCOUNT WITH A BALANCE CANNOT SIMPLY BE DELETED, and the component says so
 * rather than offering a button that will fail. Making it inactive is the real
 * operation, and it is a different thing.
 *
 * INACTIVE ACCOUNTS ARE SHOWN, marked. Hiding them makes a historic report
 * unreadable, because last year's figures sit in accounts nobody uses now.
 *
 * CODES ARE MONOSPACED AND SORTED AS TEXT. Account codes are not numbers — 0100
 * and 100 are different accounts — and formatting them as numbers loses the
 * leading zero that distinguishes them.
 */
export type Account = {
  id: string;
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "income" | "expense";
  balance?: number;
  inactive?: boolean;
};

const TYPE_LABEL: Record<Account["type"], string> = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  income: "Income",
  expense: "Expenses",
};

const ORDER: Account["type"][] = ["asset", "liability", "equity", "income", "expense"];

export function ChartOfAccounts({ accounts, currency = "GBP", locale = "en-GB", className }: {
  accounts: Account[];
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = (v: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  return (
    <div className={cn("space-y-2", className)}>
      {ORDER.map((type) => {
        const rows = accounts.filter((a) => a.type === type);
        if (rows.length === 0) return null;
        return (
          <div key={type} className="space-y-0.5">
            <p className="text-xs font-medium">{TYPE_LABEL[type]}</p>
            <ul className="divide-y divide-border rounded-md border border-border text-sm">
              {rows.map((a) => (
                <li key={a.id} className="flex items-baseline gap-3 px-3 py-1.5">
                  <code className="w-14 shrink-0 font-mono text-xs text-muted-foreground">{a.code}</code>
                  <span className={cn("min-w-0 flex-1", a.inactive && "text-muted-foreground")}>
                    {a.name}
                    {a.inactive && <span className="text-xs"> · inactive</span>}
                  </span>
                  {a.balance !== undefined && (
                    <span className="shrink-0 tabular-nums">{money(a.balance)}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">
        An account holding a balance cannot be deleted — make it inactive instead, or last year's reports stop adding up.
      </p>
    </div>
  );
}
