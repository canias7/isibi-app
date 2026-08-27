import { cn } from "@/lib/utils";
/**
 * "These numbers only cover people who agreed to be measured."
 *
 * ANALYTICS WITH CONSENT GATING UNDERCOUNTS AND NOBODY IS TOLD. A dashboard
 * showing 4,000 visits when 10,000 people came is not wrong — it is measuring
 * the consenting subset — but it gets quoted as total traffic, and decisions
 * get made on a number that is off by a factor of two.
 *
 * THE CONSENT RATE IS THE CORRECTION FACTOR. Knowing 38% agreed is what lets
 * somebody reason about the real figure; the caption alone leaves them
 * uncertain in an unbounded way, which is nearly as bad as not knowing.
 *
 * IT WARNS THAT THE SUBSET IS NOT REPRESENTATIVE. People who accept tracking
 * differ systematically from those who decline — by device, by browser, by
 * technical confidence — so scaling up by the consent rate is itself wrong, and
 * saying so prevents a confident bad correction.
 *
 * `role="note"`, sitting with the figures rather than in a footer, because a
 * caveat somewhere else is one that does not travel with the screenshot.
 */
export function ConsentGatedNote({ consentRate, covers, className }: {
  /** Percentage who agreed. */
  consentRate?: number;
  /** What is being counted — "visits". */
  covers?: string;
  className?: string;
}) {
  return (
    <p data-slot="consent-gated-note" role="note" className={cn("text-xs text-muted-foreground", className)}>
      <span className="text-foreground">
        These {covers ?? "figures"} only count people who agreed to be measured.
      </span>
      {consentRate !== undefined && (
        <span> About <span className="tabular-nums text-foreground">{Math.round(consentRate)}%</span> agree.</span>
      )}
      <span className="block">
        Do not scale them up — people who decline differ from those who accept, so the real pattern is not the same
        shape.
      </span>
    </p>
  );
}
