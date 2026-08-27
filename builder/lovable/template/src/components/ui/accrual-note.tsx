import { cn } from "@/lib/utils";
/**
 * Cost recognised before the invoice arrives — with its reversal.
 *
 * THE REVERSAL DATE IS MANDATORY AND IS THE POINT. An accrual posted without
 * one, followed by the real invoice, counts the same cost twice — and it is
 * invisible until somebody wonders why a cost centre is over. The component
 * treats a missing reversal as an error rather than an omission.
 *
 * IT SAYS WHETHER THE INVOICE HAS ARRIVED. An accrual still standing after its
 * invoice has been posted is the double count, live, right now.
 *
 * THE BASIS OF THE ESTIMATE IS RECORDED. Accruals are guesses, and "a quarter
 * of the annual contract" can be checked by somebody else while "£4,000" cannot.
 *
 * ACCRUAL AND PREPAYMENT ARE THE SAME SHAPE IN OPPOSITE DIRECTIONS, so the
 * component handles both — cost incurred not yet billed, and cost billed not
 * yet incurred — because splitting them into two components duplicates the
 * reversal logic that is the only difficult part.
 */
export function AccrualNote({ kind = "accrual", description, amount, basis, postedFor, reversesOn, invoiceReceived, currency = "GBP", locale = "en-GB", className }: {
  kind?: "accrual" | "prepayment";
  description: string;
  amount: number;
  /** How the estimate was arrived at. */
  basis?: string;
  /** The period it belongs to. */
  postedFor?: string;
  /** Free text — when it reverses. Required in practice. */
  reversesOn?: string;
  /** True once the real invoice is in. */
  invoiceReceived?: boolean;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  const doubleCount = Boolean(invoiceReceived);
  return (
    <div data-slot="accrual-note" className={cn("space-y-0.5 text-sm", className)}>
      <p>
        <span className="font-medium tabular-nums">{money}</span>
        <span className="text-muted-foreground"> · {kind === "accrual" ? "accrued" : "prepaid"}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </p>
      {postedFor && <p className="text-xs text-muted-foreground">For {postedFor}.</p>}
      <p className="text-xs text-muted-foreground">
        {basis ? `Estimated as ${basis}.` : "No basis recorded — nobody else can check this figure."}
      </p>
      <p className={cn("text-xs", reversesOn ? "text-muted-foreground" : "font-medium")}>
        {reversesOn
          ? `Reverses on ${reversesOn}.`
          : kind === "accrual"
            ? "No reversal date — when the invoice arrives this cost will be counted twice."
            : "No reversal date — this cost will never reach the period it belongs to."}
      </p>
      {doubleCount && (
        <p className="text-xs font-medium">
          The invoice has arrived and this is still standing. That is a double count today.
        </p>
      )}
    </div>
  );
}
