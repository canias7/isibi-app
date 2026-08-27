import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";
/**
 * Subtotal, tax, discount, total — and what is still owed.
 *
 * `paid` is separate from `total` and the AMOUNT DUE is what gets the
 * emphasis. An invoice that shows £600 in bold when £500 has already been
 * paid is the one somebody pays twice.
 *
 * Every figure is passed in. See `InvoiceLines` — the document has to agree
 * with the ledger rather than with arithmetic done in the browser.
 */
export function InvoiceTotals({ subtotal, tax, taxLabel = "VAT", discount, total, paid, currency = "GBP", className }: {
  subtotal?: number; tax?: number; taxLabel?: string; discount?: number;
  total: number; paid?: number; currency?: string; className?: string;
}) {
  const due = paid != null ? total - paid : null;
  const Row = ({ label, amount, strong, muted }: { label: string; amount: number; strong?: boolean; muted?: boolean }) => (
    <div className={cn("flex justify-between gap-8 py-1", strong && "border-t border-border pt-2 text-base font-semibold")}>
      <dt className={cn(muted && "text-muted-foreground")}>{label}</dt>
      <dd className="tabular-nums"><Money amount={amount} currency={currency} /></dd>
    </div>
  );
  return (
    <dl data-slot="invoice-totals" className={cn("ms-auto w-full max-w-xs text-sm", className)}>
      {subtotal != null && <Row label="Subtotal" amount={subtotal} muted />}
      {discount != null && discount !== 0 && <Row label="Discount" amount={-Math.abs(discount)} muted />}
      {tax != null && <Row label={taxLabel} amount={tax} muted />}
      <Row label="Total" amount={total} strong={due == null} />
      {due != null && <>
        <Row label="Paid" amount={-Math.abs(paid ?? 0)} muted />
        <Row label={due > 0 ? "Amount due" : "Overpaid"} amount={Math.abs(due)} strong />
      </>}
    </dl>
  );
}
