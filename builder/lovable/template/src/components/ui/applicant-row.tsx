import { cn } from "@/lib/utils";
/**
 * One applicant in a list — with how long they have been waiting.
 *
 * DAYS SINCE THE LAST CONTACT IS THE FIELD THAT CHANGES BEHAVIOUR. Candidates
 * are lost to silence far more than to rejection, and a pipeline that shows
 * stage but not staleness lets somebody sit for three weeks between two
 * interviews without anybody noticing.
 *
 * THE ANONYMISED MODE HIDES THE NAME, NOT JUST THE PHOTO. Name-blind screening
 * only works if the name is genuinely absent — and half-anonymised lists that
 * leave initials or an email address in place do nothing at all.
 *
 * A REFERRAL IS DISCLOSED. It legitimately changes how an application is read,
 * and it is exactly the fact that should be visible rather than operating
 * quietly through a hiring manager's inbox.
 *
 * ADJUSTMENTS REQUESTED ARE SURFACED ON THE ROW, because they need arranging
 * before the next stage is booked, and finding out at the interview is a
 * failure that falls entirely on the candidate.
 */
export function ApplicantRow({ name, reference, stage, appliedOn, daysSinceContact, anonymised, referredBy, adjustmentsRequested, className }: {
  name?: string;
  /** Shown instead of the name when anonymised. */
  reference?: string;
  stage?: string;
  /** Free text — "14 July". */
  appliedOn?: string;
  /** Days since anybody spoke to them. */
  daysSinceContact?: number;
  anonymised?: boolean;
  referredBy?: string;
  /** What they have asked for. */
  adjustmentsRequested?: string;
  className?: string;
}) {
  const stale = daysSinceContact !== undefined && daysSinceContact >= 7;
  return (
    <li data-slot="applicant-row" className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1">
          {anonymised
            ? <code className="font-mono text-xs">{reference ?? "Candidate"}</code>
            : name ?? "Name not recorded"}
          {stage && <span className="text-muted-foreground"> · {stage}</span>}
        </span>
        {daysSinceContact !== undefined && (
          <span className={cn("shrink-0 text-xs tabular-nums", stale ? "font-medium" : "text-muted-foreground")}>
            {daysSinceContact === 0
              ? "Contacted today"
              : `${daysSinceContact} ${daysSinceContact === 1 ? "day" : "days"} since contact`}
          </span>
        )}
      </p>
      {appliedOn && <p className="text-xs text-muted-foreground">Applied {appliedOn}</p>}
      {referredBy && !anonymised && (
        <p className="text-xs text-muted-foreground">Referred by {referredBy}.</p>
      )}
      {adjustmentsRequested && (
        <p className="text-xs font-medium">
          Adjustments asked for: {adjustmentsRequested} — arrange these before booking the next stage.
        </p>
      )}
      {stale && (
        <p className="text-xs text-muted-foreground">Candidates are lost to silence more often than to rejection.</p>
      )}
    </li>
  );
}
