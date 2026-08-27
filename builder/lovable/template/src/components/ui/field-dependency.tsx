import { cn } from "@/lib/utils";
/**
 * "Fill in the postcode first."
 *
 * A DISABLED FIELD WITH NO EXPLANATION IS INDISTINGUISHABLE FROM A BROKEN ONE,
 * and it is the commonest reason people abandon a form: they click, nothing
 * happens, they try twice more, they leave.
 *
 * IT NAMES THE FIELD THAT UNLOCKS IT, and links to it. Telling somebody a
 * dependency exists without saying which field is half an answer on a form with
 * twenty.
 *
 * `aria-describedby` is the caller's job on the disabled input — this renders
 * the text with a stable id so that wiring is possible, because a visual note
 * beside a disabled field is invisible to the people most affected.
 */
export function FieldDependency({ needs, needsFieldId, id, className }: {
  /** What must be filled first — "Postcode". */
  needs: string;
  /** So it can be linked. */
  needsFieldId?: string;
  /** Point the disabled input's aria-describedby at this. */
  id?: string;
  className?: string;
}) {
  return (
    <p data-slot="field-dependency" id={id} className={cn("text-xs text-muted-foreground", className)}>
      {needsFieldId
        ? <>Fill in <a href={`#${needsFieldId}`} className="underline underline-offset-2">{needs}</a> first.</>
        : <>Fill in {needs} first.</>}
    </p>
  );
}
