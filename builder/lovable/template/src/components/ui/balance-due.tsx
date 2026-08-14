import { DateFormat } from "@/components/ui/date-format";
import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";
/**
 * What is still owed, and by when.
 *
 * ZERO IS "SETTLED", NOT "£0.00". A bill showing nothing outstanding should say
 * so in words — a zero in a currency field reads as a rendering fault or an
 * unloaded value, and people ring to check.
 *
 * A CREDIT IS ITS OWN SENTENCE. A negative balance means the business owes the
 * customer, and printing "−£40.00 due" is both confusing and slightly insulting;
 * "£40.00 in credit" is what it means.
 *
 * OVERDUE IS A WORD, with the date. Weight rather than colour, so it survives
 * printing — which is what happens to most invoices.
 */
export function BalanceDue({ amount, due, currency = "GBP", className }: {
  /** Positive is owed, negative is credit. */
  amount: number;
  due?: string | number | Date;
  currency?: string;
  className?: string;
}) {
  const overdue = amount > 0 && due != null && new Date(due).getTime() < Date.now();
  if (amount === 0) {
    return <p className={cn("text-sm font-medium", className)}>Settled — nothing outstanding.</p>;
  }
  if (amount < 0) {
    return (
      <p className={cn("text-sm", className)}>
        <span className="font-medium tabular-nums"><Money amount={-amount} currency={currency} /> in credit</span>
      </p>
    );
  }
  return (
    <p className={cn("text-sm", className)}>
      <span className="font-medium tabular-nums"><Money amount={amount} currency={currency} /> due</span>
      {due && (
        <span className={cn("text-muted-foreground", overdue && "font-medium text-foreground")}>
          {" "}{overdue ? "— overdue since " : "by "}
          <DateFormat date={due} />
        </span>
      )}
    </p>
  );
}
