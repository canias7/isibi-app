import { cn } from "@/lib/utils";
/**
 * Why no tax was charged, with the evidence that justifies it.
 *
 * THE REASON IS ON THE DOCUMENT, because an invoice with no tax and no
 * explanation is one an auditor asks about and the business cannot answer years
 * later. Whatever exemption applied has to be recorded at the moment of the
 * sale, and this is where it appears.
 *
 * THE CERTIFICATE OR REGISTRATION NUMBER IS SHOWN WHERE THERE IS ONE. That is
 * the actual evidence; the reason alone is a claim. Printing it also lets the
 * customer check their own number was entered correctly, which is where these
 * go wrong.
 *
 * AN EXPIRED EXEMPTION IS FLAGGED. Certificates lapse, and continuing to
 * zero-rate on a lapsed one is the business's liability, not the customer's —
 * so it is worth catching on screen rather than in a later assessment.
 *
 * NO JURISDICTION IS ASSUMED. The reason text is the caller's, because the
 * grounds for exemption differ everywhere and a fixed list would be wrong
 * outside one country.
 */
export function TaxExemptNote({ reason, reference, expiresAt, expired, taxLabel = "tax", className }: {
  /** Why — "registered charity", "export outside the UK". */
  reason: string;
  /** Certificate or registration number. */
  reference?: string;
  /** Free text — "14 August 2026". */
  expiresAt?: string;
  expired?: boolean;
  taxLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-0.5 text-xs", className)}>
      <p>
        <span className="text-foreground">No {taxLabel} charged</span>
        <span className="text-muted-foreground"> — {reason}</span>
      </p>
      {reference && (
        <p className="text-muted-foreground">
          Reference <code className="font-mono text-foreground">{reference}</code>
        </p>
      )}
      {expiresAt && (
        <p className={cn(expired ? "font-medium" : "text-muted-foreground")}>
          {expired
            ? `This exemption expired on ${expiresAt} — ${taxLabel} may be due.`
            : `Valid until ${expiresAt}.`}
        </p>
      )}
    </div>
  );
}
