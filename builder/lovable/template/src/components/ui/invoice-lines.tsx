import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";
export type InvoiceLine = {
  description: string; detail?: string;
  quantity?: number; unitPrice?: number; total: number;
};
/**
 * What is being charged for.
 *
 * The line total is PASSED IN rather than computed from quantity × price.
 * Rounding a line here and rounding it again on the server is how an invoice
 * comes to a penny short of what was actually taken, and the document has to
 * agree with the ledger, not with this component's arithmetic.
 */
export function InvoiceLines({ lines, currency = "GBP", className }: {
  lines: InvoiceLine[]; currency?: string; className?: string;
}) {
  const showQty = lines.some((l) => l.quantity != null);
  return (
    <table data-slot="invoice-lines" className={cn("w-full text-sm", className)}>
      <thead>
        <tr className="border-b border-border text-start">
          <th className="py-2 font-medium">Description</th>
          {showQty && <th className="w-16 py-2 text-end font-medium">Qty</th>}
          {showQty && <th className="w-24 py-2 text-end font-medium">Unit</th>}
          <th className="w-24 py-2 text-end font-medium">Amount</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l, i) => (
          <tr key={i} className="border-b border-border align-top last:border-0">
            <td className="py-2.5 pe-4">
              {l.description}
              {l.detail && <span className="block text-xs text-muted-foreground">{l.detail}</span>}
            </td>
            {showQty && <td className="py-2.5 text-end tabular-nums">{l.quantity ?? ""}</td>}
            {showQty && <td className="py-2.5 text-end tabular-nums">
              {l.unitPrice != null ? <Money amount={l.unitPrice} currency={currency} /> : ""}</td>}
            <td className="py-2.5 text-end tabular-nums"><Money amount={l.total} currency={currency} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
