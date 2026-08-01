import { cn } from "@/lib/utils";
/**
 * A site differing from the group standard — with the reason, always.
 *
 * AN OVERRIDE WITH NO REASON IS THE PROBLEM THIS SOLVES. Local variations
 * accumulate, nobody remembers why any of them exist, and the group either
 * enforces uniformity that breaks a good local decision or tolerates drift
 * that has no justification. The reason is the field that makes a review
 * possible.
 *
 * IT SHOWS BOTH VALUES. "Overridden" without the standard beside it means a
 * reviewer has to look it up, so most reviews do not happen.
 *
 * WHO APPROVED IT AND WHEN IT WAS LAST REVIEWED ARE SEPARATE. An override
 * approved three years ago by somebody who has left is not an approved
 * override, and only the review date reveals that.
 *
 * A TEMPORARY OVERRIDE HAS AN END DATE, and one without is marked. "Temporary"
 * with no date is how every permanent exception starts.
 */
export function LocalOverride({ setting, groupValue, siteValue, site, reason, approvedBy, approvedOn, lastReviewedOn, temporary, until, className }: {
  setting: string;
  /** What the group standard says. */
  groupValue?: string;
  /** What this site does instead. */
  siteValue?: string;
  site?: string;
  reason?: string;
  approvedBy?: string;
  approvedOn?: string;
  /** Free text — when it was last looked at. */
  lastReviewedOn?: string;
  temporary?: boolean;
  until?: string;
  className?: string;
}) {
  const openEnded = temporary && !until;
  return (
    <li className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p>
        <span className="font-medium">{setting}</span>
        {site && <span className="text-muted-foreground"> · {site}</span>}
      </p>
      <p className="text-xs">
        <span className="text-muted-foreground">Group: </span>{groupValue ?? "not set"}
        <span className="block">
          <span className="text-muted-foreground">Here: </span>{siteValue ?? "not set"}
        </span>
      </p>
      <p className={cn("text-xs", reason ? "" : "font-medium")}>
        {reason ?? "No reason recorded. In a year nobody will know whether this is deliberate."}
      </p>
      <p className="text-xs text-muted-foreground">
        {approvedBy ? `Approved by ${approvedBy}` : "Nobody recorded as approving it"}
        {approvedOn && ` on ${approvedOn}`}
        {lastReviewedOn ? ` · last reviewed ${lastReviewedOn}` : " · never reviewed since"}
      </p>
      {temporary && (
        <p className={cn("text-xs", openEnded ? "font-medium" : "text-muted-foreground")}>
          {until
            ? `Temporary, until ${until}.`
            : "Marked temporary with no end date — which is how a permanent exception begins."}
        </p>
      )}
    </li>
  );
}
