import { Money } from "@/components/ui/money";
import { DateFormat } from "@/components/ui/date-format";
import { cn } from "@/lib/utils";
/**
 * Proof something was paid — the thing sent AFTER, not the request for money.
 *
 * The card is shown as brand plus last four and nothing else, because that is
 * all anybody needs to recognise which card they used, and it is the only
 * form that is safe to email, print and leave lying around.
 */
export function Receipt({ number, paidAt, total, currency = "GBP", method, last4, items, business, className }: {
  number: string; paidAt?: string | number | Date; total: number; currency?: string;
  method?: string; last4?: string;
  items?: { label: string; amount: number }[];
  business?: string; className?: string;
}) {
  return (
    <div data-slot="receipt" className={cn("mx-auto max-w-sm space-y-4 rounded-lg border border-border p-5 text-sm", className)}>
      <div className="text-center">
        {business && <p className="font-medium">{business}</p>}
        <p className="text-muted-foreground">Receipt</p>
        <p className="font-mono text-xs text-muted-foreground">{number}</p>
        {paidAt && <p className="mt-1 text-xs text-muted-foreground"><DateFormat date={paidAt} withTime /></p>}
      </div>
      {items?.length ? (
        <dl className="space-y-1 border-y border-dashed border-border py-3">
          {items.map((it) => (
            <div key={it.label} className="flex justify-between gap-4">
              <dt className="min-w-0 truncate">{it.label}</dt>
              <dd className="shrink-0 tabular-nums"><Money amount={it.amount} currency={currency} /></dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="flex justify-between gap-4 text-base font-semibold">
        <span>Paid</span>
        <span className="tabular-nums"><Money amount={total} currency={currency} /></span>
      </div>
      {(method || last4) && (
        <p className="text-center text-xs text-muted-foreground">
          {method}{last4 ? ` ending ${last4}` : ""}
        </p>
      )}
    </div>
  );
}
