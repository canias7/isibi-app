import { cn } from "@/lib/utils";
/**
 * Giving up on a debt — with the tax and the recovery both handled.
 *
 * WRITING OFF IS NOT WAIVING. The debt usually still exists in law and can be
 * pursued later; the write-off is an accounting recognition that it probably
 * will not be collected. Conflating them means somebody tells a customer the
 * balance is cleared when it is not, or abandons a genuinely recoverable debt.
 *
 * THE TAX ADJUSTMENT IS PART OF THE ENTRY. On an invoice already declared for
 * sales tax, writing off without reclaiming leaves tax paid on money never
 * received — small on one invoice and material across a year of them.
 *
 * WHAT WAS TRIED IS RECORDED, because most tax authorities require evidence of
 * reasonable recovery effort before relief, and reconstructing it a year later
 * is impossible.
 *
 * APPROVAL IS NAMED AND SEPARATED FROM THE PERSON RAISING IT. A write-off is
 * the cleanest way to conceal a missing receipt, and self-approval is the
 * control that stops it.
 */
export function WriteOffNote({ customer, invoice, amount, taxAmount, reclaimTax, reason, attempts = [], raisedBy, approvedBy, stillPursuable = true, currency = "GBP", locale = "en-GB", className }: {
  customer?: string;
  invoice?: string;
  amount: number;
  /** Sales tax included in the amount. */
  taxAmount?: number;
  /** Whether the tax is being reclaimed. */
  reclaimTax?: boolean;
  reason?: string;
  /** What was tried before giving up. */
  attempts?: string[];
  raisedBy?: string;
  approvedBy?: string;
  stillPursuable?: boolean;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = (v: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  const selfApproved = Boolean(raisedBy && approvedBy && raisedBy === approvedBy);
  return (
    <div data-slot="write-off-note" className={cn("space-y-0.5 text-sm", className)}>
      <p>
        <span className="font-medium tabular-nums">{money(amount)} written off</span>
        {customer && <span className="text-muted-foreground"> · {customer}</span>}
        {invoice && <span className="block font-mono text-xs text-muted-foreground">{invoice}</span>}
      </p>
      {reason && <p className="text-xs">{reason}</p>}
      {taxAmount !== undefined && (
        <p className={cn("text-xs tabular-nums", reclaimTax ? "text-muted-foreground" : "font-medium")}>
          {reclaimTax
            ? `${money(taxAmount)} of sales tax reclaimed with this.`
            : `${money(taxAmount)} of sales tax is not being reclaimed — that is tax paid on money never received.`}
        </p>
      )}
      {attempts.length > 0 ? (
        <p className="text-xs text-muted-foreground">Tried: {attempts.join(", ")}.</p>
      ) : (
        <p className="text-xs font-medium">Nothing is recorded as having been tried — relief usually needs that evidence.</p>
      )}
      <p className="text-xs text-muted-foreground">
        {raisedBy ? `Raised by ${raisedBy}` : "Nobody recorded as raising it"}
        {approvedBy ? ` · approved by ${approvedBy}` : " · not approved"}
      </p>
      {selfApproved && <p className="text-xs font-medium">Approved by the person who raised it.</p>}
      {stillPursuable && (
        <p className="text-xs text-muted-foreground">
          The debt still exists — this is an accounting decision, not a decision to stop asking.
        </p>
      )}
    </div>
  );
}
