import { cn } from "@/lib/utils";
/**
 * A vaccination given — and whether the course is actually finished.
 *
 * A COURSE PART-COMPLETED IS THE STATE THAT MATTERS AND THE ONE NOBODY SHOWS.
 * One dose of a two-dose course looks like a green tick in most records, and the
 * person believes they are covered. Doses given against doses needed is the whole
 * row.
 *
 * THE SCHEDULE IS THE CALLER'S. Which vaccines, how many doses and at what
 * intervals differ by country and change every few years, and a component with
 * one built in would be confidently wrong for most of its users within a year.
 *
 * A DOSE GIVEN ELSEWHERE COUNTS AND IS MARKED AS UNVERIFIED. People are
 * vaccinated in other countries and at pharmacies, and a record that ignores what
 * it did not administer produces both duplicate doses and false gaps.
 *
 * NO IMMUNITY CLAIM. Doses given is a fact; protection is a clinical judgement
 * involving time, the person and the disease, and a tick implying it is a
 * promise this cannot keep.
 */
export function ImmunisationRow({ vaccine, dosesGiven, dosesNeeded, lastOn, nextDueOn, givenElsewhere, verified, batch, className }: {
  vaccine: string;
  dosesGiven: number;
  /** From the caller's own schedule. */
  dosesNeeded?: number;
  lastOn?: string;
  nextDueOn?: string;
  /** Counts, and is marked. */
  givenElsewhere?: boolean;
  verified?: boolean;
  batch?: string;
  className?: string;
}) {
  const incomplete = dosesNeeded !== undefined && dosesGiven < dosesNeeded;
  return (
    <li className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 font-medium">{vaccine}</span>
        <span className={cn("shrink-0 text-xs tabular-nums", incomplete ? "font-medium" : "text-muted-foreground")}>
          {dosesNeeded !== undefined ? `${dosesGiven} of ${dosesNeeded}` : `${dosesGiven} given`}
        </span>
      </p>
      {incomplete && (
        <p className="text-xs font-medium">
          The course is not finished. One dose of {dosesNeeded} is not the same as being done.
          {nextDueOn ? ` Next one due ${nextDueOn}.` : ""}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {[
          lastOn && `Last ${lastOn}`,
          givenElsewhere && (verified ? "given elsewhere, verified" : "given elsewhere, not verified"),
          batch && `batch ${batch}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </li>
  );
}
