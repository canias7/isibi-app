import { cn } from "@/lib/utils";
/**
 * "You account for the tax on this" — the note a cross-border invoice needs.
 *
 * IT TELLS THE CUSTOMER THEY OWE SOMETHING. A reverse-charge invoice shows no
 * tax, which reads as tax-free — and the customer's own bookkeeper has to
 * declare it. Without the sentence they simply do not, and it is discovered at
 * an audit.
 *
 * BOTH REGISTRATION NUMBERS APPEAR, because that is what makes the treatment
 * valid: the supplier's and the customer's. An invoice missing the customer's
 * number is one the treatment does not apply to, and it is the commonest
 * defect in these.
 *
 * THE WORDING IS THE CALLER'S. Different regimes require specific phrases on
 * the document, and a component inventing its own would produce an invoice that
 * fails inspection while looking correct.
 *
 * IT IS PLAIN TEXT AT THE FOOT OF A DOCUMENT — no panel, no icon. This gets
 * printed and emailed, and a styled callout is the first thing lost.
 */
export function ReverseChargeNote({ wording, supplierNumber, customerNumber, supplierLabel = "Our number", customerLabel = "Your number", className }: {
  /** The exact sentence required — the caller supplies it. */
  wording: string;
  supplierNumber?: string;
  customerNumber?: string;
  supplierLabel?: string;
  customerLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-0.5 text-xs text-muted-foreground", className)}>
      <p className="text-foreground">{wording}</p>
      {(supplierNumber || customerNumber) && (
        <p>
          {supplierNumber && <span>{supplierLabel}: <code className="font-mono">{supplierNumber}</code></span>}
          {supplierNumber && customerNumber && " · "}
          {customerNumber
            ? <span>{customerLabel}: <code className="font-mono">{customerNumber}</code></span>
            : <span className="text-foreground">{customerLabel} is missing — this treatment may not apply.</span>}
        </p>
      )}
    </div>
  );
}
