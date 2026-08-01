import { cn } from "@/lib/utils";
/**
 * One line of a care plan — the need, and what is actually done about it.
 *
 * WHAT MATTERS TO THE PERSON IS A FIELD, ALONGSIDE WHAT IS WRONG WITH THEM.
 * A plan written only in deficits produces care that is technically correct and
 * nothing anybody would want. "Wants to keep making her own tea" is the reason
 * the support is shaped the way it is, and it belongs on the same row.
 *
 * THE PERSON'S OWN WORDS ARE MARKED AS THEIRS. A plan written entirely in the
 * third person has usually been written about somebody rather than with them,
 * and quoting is the cheapest way to make that visible.
 *
 * WHO DOES IT IS NAMED, AND SO IS WHAT THE PERSON DOES THEMSELVES. A plan that
 * assigns every task to staff removes the ability it was meant to protect —
 * independence is lost far faster to help than to decline.
 *
 * NO SEVERITY SCORE. A number invites sorting and comparison between people,
 * which is not what a care plan is for and not something it can support.
 */
export function CarePlanRow({ need, whatMatters, inTheirWords, support, doneBy, doneThemselves, reviewedOn, className }: {
  /** The need, plainly. */
  need: string;
  /** What the person wants out of it. */
  whatMatters?: string;
  /** True where whatMatters is quoted from the person. */
  inTheirWords?: boolean;
  /** What is actually done. */
  support?: string;
  /** Who does it. */
  doneBy?: string;
  /** What the person does for themselves — kept, not absorbed. */
  doneThemselves?: string;
  reviewedOn?: string;
  className?: string;
}) {
  return (
    <li className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="font-medium">{need}</p>
      {whatMatters && (
        <p className={cn("text-sm", inTheirWords && "italic")}>
          {inTheirWords ? `"${whatMatters}"` : whatMatters}
        </p>
      )}
      {support && <p className="text-xs text-muted-foreground">{support}</p>}
      <p className="text-xs text-muted-foreground">
        {[doneBy && `Supported by ${doneBy}`, doneThemselves && `Does themselves: ${doneThemselves}`]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {!doneThemselves && (
        <p className="text-xs">
          Nothing recorded that they do for themselves. Independence goes faster to help than to decline.
        </p>
      )}
      {reviewedOn && <p className="text-xs text-muted-foreground">Last looked at {reviewedOn}.</p>}
    </li>
  );
}
