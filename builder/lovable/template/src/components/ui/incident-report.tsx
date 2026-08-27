import { cn } from "@/lib/utils";
/**
 * What happened — recorded once, properly, at the start.
 *
 * WHEN IT WAS DISCOVERED IS SEPARATE FROM WHEN IT HAPPENED. For water damage,
 * theft and subsidence these are often weeks apart, they determine which
 * policy year applies, and a single date field forces the claimant to choose
 * one and be wrong.
 *
 * WHETHER ANYONE ELSE WAS INVOLVED IS ASKED EARLY, because it decides whether
 * there is a recovery against a third party — which changes the claim, the
 * excess and sometimes the no-claims discount.
 *
 * A CRIME REFERENCE IS ITS OWN FIELD FOR THEFT AND MALICIOUS DAMAGE. Most
 * policies require one and most claimants do not know that until they are asked
 * for it a fortnight later, by which time reporting it is harder.
 *
 * IT ASKS WHAT HAS ALREADY BEEN DONE. Emergency repairs are usually permitted
 * and often necessary, and a claimant who thinks they must wait leaves a leak
 * running.
 */
export function IncidentReport({ what, happenedOn, discoveredOn, where, thirdPartyInvolved, thirdPartyNote, crimeReference, needsCrimeReference, emergencyWorkDone, className }: {
  what: string;
  /** Free text — "about 3 July". */
  happenedOn?: string;
  discoveredOn?: string;
  where?: string;
  thirdPartyInvolved?: boolean;
  thirdPartyNote?: string;
  crimeReference?: string;
  /** True for theft and malicious damage. */
  needsCrimeReference?: boolean;
  /** What has been done already. */
  emergencyWorkDone?: string;
  className?: string;
}) {
  return (
    <div data-slot="incident-report" className={cn("space-y-0.5 text-sm", className)}>
      <p>{what}</p>
      <p className="text-xs text-muted-foreground">
        {happenedOn ? `Happened ${happenedOn}` : "Date it happened not recorded"}
        {discoveredOn && ` · found ${discoveredOn}`}
        {where && ` · ${where}`}
      </p>
      {happenedOn && discoveredOn && happenedOn !== discoveredOn && (
        <p className="text-xs text-muted-foreground">
          These being different is normal and is why we ask for both — it decides which policy year applies.
        </p>
      )}
      {thirdPartyInvolved && (
        <p className="text-xs">
          Someone else was involved{thirdPartyNote ? `: ${thirdPartyNote}` : ""}. We may be able to recover from them, which can protect your no-claims discount.
        </p>
      )}
      {needsCrimeReference && (
        <p className={cn("text-xs", crimeReference ? "text-muted-foreground" : "font-medium")}>
          {crimeReference
            ? `Crime reference ${crimeReference}.`
            : "A crime reference number is needed for this kind of claim — report it now rather than later."}
        </p>
      )}
      {/* The caller's note is a SENTENCE and usually ends in a full stop, so
          appending one produces "…plumber.. Keep the invoices." Each sentence
          is its own node instead of a concatenation. */}
      <p className="text-xs text-muted-foreground">
        {emergencyWorkDone ? (
          <>
            <span className="block">Emergency work already done: {emergencyWorkDone}</span>
            <span className="block">Keep the invoices.</span>
          </>
        ) : (
          "Do anything urgent needed to stop it getting worse — that is allowed. Keep the invoices."
        )}
      </p>
    </div>
  );
}
