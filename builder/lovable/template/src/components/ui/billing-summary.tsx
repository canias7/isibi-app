import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { DateFormat } from "@/components/ui/date-format";
import { cn } from "@/lib/utils";
/**
 * The plan, the next charge, and the way out.
 *
 * A cancelling subscription says when it ends rather than showing a renewal
 * date it will never reach — the commonest wrong thing on a billing page,
 * and the one that generates support mail.
 */
export function BillingSummary({ plan, amount, currency, interval = "month", renewsAt, cancelAt, onChange, onCancel, className }: {
  plan: string; amount?: number; currency?: string; interval?: "month" | "year";
  renewsAt?: string | number | Date | null; cancelAt?: string | number | Date | null;
  onChange?: () => void; onCancel?: () => void; className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border p-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium">{plan}</h3>
            {cancelAt && <Badge variant="outline">Cancelling</Badge>}
          </div>
          {amount != null && (
            <p className="mt-1 text-sm text-muted-foreground">
              <Money amount={amount} currency={currency} /> per {interval}
            </p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">
            {cancelAt ? <>Access ends <DateFormat date={cancelAt} /></>
              : renewsAt ? <>Renews <DateFormat date={renewsAt} /></> : null}
          </p>
        </div>
        <div className="flex gap-2">
          {onChange && <Button size="sm" variant="outline" onClick={onChange}>Change plan</Button>}
          {onCancel && !cancelAt && <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>}
        </div>
      </div>
    </div>
  );
}
