import { cn } from "@/lib/utils";
/**
 * One criterion scored by one interviewer — with the evidence.
 *
 * A SCORE WITHOUT EVIDENCE IS AN IMPRESSION WITH A NUMBER ON IT. Requiring a
 * written example is the single change that most improves interview
 * reliability, and it is what makes a decision defensible three months later
 * when somebody asks why.
 *
 * SCORES ARE NOT AVERAGED ACROSS INTERVIEWERS BY THIS COMPONENT. Averaging
 * hides disagreement, and two interviewers scoring 2 and 5 is a conversation
 * that must happen rather than a 3.5.
 *
 * "NOT ASSESSED" IS A REAL ANSWER AND IS NOT A LOW SCORE. Criteria get missed
 * when an interview runs short, and recording that as a zero silently penalises
 * the candidate for the interviewer's time-keeping.
 *
 * THE SCALE IS PRINTED WITH THE SCORE, because a 3 means different things out
 * of 4 and out of 10, and scorecards are read by people who did not design them.
 */
export function ScorecardRow({ criterion, score, outOf = 4, notAssessed, evidence, by, scaleNote, className }: {
  criterion: string;
  score?: number;
  outOf?: number;
  /** True where it simply was not covered. */
  notAssessed?: boolean;
  /** What the candidate actually said or did. */
  evidence?: string;
  by?: string;
  /** What the numbers mean. */
  scaleNote?: string;
  className?: string;
}) {
  const missing = notAssessed || score === undefined;
  return (
    <li className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1">{criterion}</span>
        <span className={cn("shrink-0 tabular-nums", missing && "text-muted-foreground")}>
          {missing ? "Not assessed" : `${score} of ${outOf}`}
        </span>
      </p>
      {scaleNote && !missing && <p className="text-xs text-muted-foreground">{scaleNote}</p>}
      {evidence ? (
        <p className="text-xs">{evidence}</p>
      ) : !missing ? (
        <p className="text-xs font-medium">No evidence recorded — this score cannot be defended.</p>
      ) : (
        <p className="text-xs text-muted-foreground">Not covered in the interview. This is not a low score.</p>
      )}
      {by && <p className="text-xs text-muted-foreground">Scored by {by}.</p>}
    </li>
  );
}
