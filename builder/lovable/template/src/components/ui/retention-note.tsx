import { cn } from "@/lib/utils";
/**
 * How long something is kept, and what happens at the end.
 *
 * "WHAT HAPPENS AFTERWARDS" IS THE HALF EVERYONE OMITS. "Kept for 7 years" does
 * not say whether the record is deleted, anonymised, or archived somewhere it
 * can still be produced — three very different promises, and the difference is
 * the entire content of a retention statement.
 *
 * THE REASON MATTERS AS MUCH AS THE PERIOD. A duration with no cause reads as
 * arbitrary; "7 years, because tax records must be" is a sentence somebody can
 * accept. It also happens to be the thing that has to be written down anyway.
 *
 * "UNTIL YOU DELETE IT" IS A FIRST-CLASS ANSWER, not a missing number. Plenty
 * of data genuinely has no expiry, and dressing that up as a duration is
 * dishonest while leaving it blank looks like an oversight.
 *
 * A single `<p>`, because this belongs beside a field or under a form, not in a
 * panel of its own. A privacy note that needs its own card does not get read.
 */
export function RetentionNote({ period, then = "deleted", reason, className }: {
  /** Pre-formatted — "7 years", "90 days". Omit for "until you delete it". */
  period?: string;
  then?: "deleted" | "anonymised" | "archived";
  /** Why it is kept that long. */
  reason?: string;
  className?: string;
}) {
  const tail = { deleted: "then deleted", anonymised: "then anonymised", archived: "then archived" }[then];
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      {period ? <>Kept for <span className="text-foreground">{period}</span>, {tail}.</> : <>Kept until you delete it.</>}
      {reason && <span> {reason}</span>}
    </p>
  );
}
