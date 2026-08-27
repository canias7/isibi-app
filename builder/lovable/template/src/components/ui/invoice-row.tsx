import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { DateFormat } from "@/components/ui/date-format";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
/** One line of billing history. Status is written, not only coloured. */
export function InvoiceRow({ number, date, amount, currency, status = "paid", href, className }: {
  number: string; date: string | number | Date; amount: number; currency?: string;
  status?: "paid" | "due" | "failed" | "refunded"; href?: string; className?: string;
}) {
  const variant = { paid: "secondary", due: "outline", failed: "destructive", refunded: "outline" } as const;
  return (
    <div data-slot="invoice-row" className={cn("flex items-center gap-3 border-b border-border py-3 text-sm last:border-0", className)}>
      <span className="w-28 shrink-0 font-mono text-xs">{number}</span>
      <span className="w-28 shrink-0 text-muted-foreground"><DateFormat date={date} /></span>
      <span className="flex-1" />
      <Badge variant={variant[status]} className="capitalize">{status}</Badge>
      <span className="w-20 text-end"><Money amount={amount} currency={currency} /></span>
      {/* The download slot is always there, empty when there is no PDF. A
          conditional button shifts every amount in a list of invoices out of
          line the moment one of them has no file. */}
      <span className="w-8 shrink-0">
        {href && (
          <Button size="icon-sm" variant="ghost" asChild aria-label={`Download invoice ${number}`}>
            <a href={href} download><Download className="size-4" /></a>
          </Button>
        )}
      </span>
    </div>
  );
}
