import { cn } from "@/lib/utils";
/**
 * Tax deducted before payment — what was earned versus what arrives.
 *
 * THE TWO NUMBERS ARE THE COMPONENT. Somebody expecting £1,000 and receiving
 * £800 needs both figures and the reason on the same line, or the difference
 * reads as an error and generates a support contact every time. Gross, deducted,
 * net.
 *
 * IT SAYS THE DEDUCTION IS RECLAIMABLE where it is. Withheld tax is usually
 * creditable against the recipient's own liability, so it is not lost money —
 * but nobody knows that unless told, and the certificate reference is what
 * makes it claimable.
 *
 * THE RATE AND THE REASON APPEAR TOGETHER. A rate changes with the recipient's
 * status and their country's treaty position, so "20%" alone cannot be checked
 * against what somebody expected.
 *
 * IT NAMES NO SPECIFIC REGIME. Withholding exists in many forms in many places;
 * the labels are the caller's, and the arithmetic is the same everywhere.
 */
export function WithholdingNote({ gross, withheld, net, rate, reason, reclaimable, reference, className }: {
  /** Pre-formatted. */
  gross: string;
  withheld: string;
  net: string;
  /** "20%". */
  rate?: string;
  /** Why — "non-resident contractor". */
  reason?: string;
  /** True when it can be set against the recipient's own tax. */
  reclaimable?: boolean;
  /** Certificate reference for reclaiming. */
  reference?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <dl className="space-y-0.5 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Earned</dt>
          <dd className="tabular-nums">{gross}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="min-w-0 text-muted-foreground">
            Tax deducted{rate ? ` at ${rate}` : ""}
            {reason && <span className="block text-xs">{reason}</span>}
          </dt>
          <dd className="shrink-0 tabular-nums">−{withheld}</dd>
        </div>
        <div className="flex justify-between gap-3 border-t border-border pt-1 font-medium">
          <dt>You receive</dt>
          <dd className="tabular-nums">{net}</dd>
        </div>
      </dl>
      {reclaimable && (
        <p className="text-xs text-muted-foreground">
          This is not lost — you can usually set it against your own tax.
          {reference && <> Quote <code className="font-mono text-foreground">{reference}</code>.</>}
        </p>
      )}
    </div>
  );
}
