import { DateFormat } from "@/components/ui/date-format";
import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";
/**
 * When each payment is due, and which have been made.
 *
 * PAID ROWS STAY IN THE LIST, marked. Removing them makes the schedule shorter
 * every month and leaves no way to check what was already taken — which is the
 * first thing anybody queries.
 *
 * THE TOTAL AND THE REMAINING ARE BOTH STATED. A schedule that only shows
 * instalments makes somebody add up eleven rows to answer "how much is left",
 * which is the actual question.
 *
 * State is a word per row — Paid, Due, Overdue — never a colour, so it survives
 * being printed, which schedules routinely are.
 */
export type Instalment = { at: string | number | Date; amount: number; paid?: boolean };

export function PaymentSchedule({ instalments, currency = "GBP", className }: {
  instalments: Instalment[];
  currency?: string;
  className?: string;
}) {
  if (!instalments.length) return null;
  const now = Date.now();
  const total = instalments.reduce((s, i) => s + i.amount, 0);
  const left = instalments.filter((i) => !i.paid).reduce((s, i) => s + i.amount, 0);
  return (
    <div data-slot="payment-schedule" className={cn("flex flex-col gap-2", className)}>
      <ol className="divide-y divide-border rounded-md border border-border text-sm">
        {instalments.map((i, idx) => {
          const t = new Date(i.at).getTime();
          const overdue = !i.paid && t < now;
          return (
            <li key={idx} className="flex items-baseline justify-between gap-3 px-3 py-2">
              <span className={cn("min-w-0", i.paid && "text-muted-foreground")}>
                <DateFormat date={t} />
              </span>
              <span className="flex shrink-0 items-baseline gap-3 tabular-nums">
                <span className={cn(overdue && "font-medium")}>
                  {i.paid ? "Paid" : overdue ? "Overdue" : "Due"}
                </span>
                <Money amount={i.amount} currency={currency} />
              </span>
            </li>
          );
        })}
      </ol>
      <p className="text-sm text-muted-foreground tabular-nums">
        <Money amount={left} currency={currency} /> left of <Money amount={total} currency={currency} />
      </p>
    </div>
  );
}
