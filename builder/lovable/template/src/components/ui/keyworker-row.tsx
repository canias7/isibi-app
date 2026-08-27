import { cn } from "@/lib/utils";
/**
 * The named person — and who covers when they are not there.
 *
 * THE COVER ARRANGEMENT IS THE FIELD THAT MATTERS AND IS ALWAYS THE ONE MISSING.
 * A named keyworker is worth having precisely because somebody knows the person;
 * on their leave that value is zero unless somebody else has been named, and
 * "the team" is not a name.
 *
 * HOW MANY PEOPLE THEY ARE KEYWORKER FOR IS SHOWN. It is the number that decides
 * whether the role is real, and it is never on the screen where the assignment
 * is made — which is how somebody ends up named for thirty people and able to
 * know none of them.
 *
 * A VACANT ROLE IS STATED, NOT LEFT BLANK. An empty field reads as data missing;
 * "nobody at the moment" reads as the thing to fix.
 *
 * NO PHOTOGRAPH. It looks like care and it is a picture of a member of staff
 * shown to people who did not choose to be shown it, on a screen that is often
 * in a shared room.
 */
export function KeyworkerRow({ name, since, caseload, coverName, coverUntil, vacant, contact, className }: {
  name?: string;
  since?: string;
  /** How many people they hold. The number that decides whether this is real. */
  caseload?: number;
  /** "The team" is not a name. */
  coverName?: string;
  coverUntil?: string;
  vacant?: boolean;
  contact?: string;
  className?: string;
}) {
  if (vacant || !name) {
    return (
      <li data-slot="keyworker-row" className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
        <p className="font-medium">No keyworker at the moment.</p>
        <p className="text-xs text-muted-foreground">
          Not a blank field — somebody needs naming, and until then nobody holds this.
        </p>
      </li>
    );
  }
  return (
    <li className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 font-medium">{name}</span>
        {contact && <span className="shrink-0 text-xs text-muted-foreground">{contact}</span>}
      </p>
      <p className="text-xs text-muted-foreground">
        {[since && `Since ${since}`, caseload !== undefined && `${caseload} ${caseload === 1 ? "person" : "people"}`]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {caseload !== undefined && caseload >= 20 && (
        <p className="text-xs">
          {caseload} people is more than one person can know well. The role stops meaning anything somewhere around here.
        </p>
      )}
      <p className={cn("text-xs", coverName ? "text-muted-foreground" : "font-medium")}>
        {coverName
          ? `Covered by ${coverName}${coverUntil ? ` until ${coverUntil}` : ""}.`
          : "Nobody named to cover. On their leave this arrangement is worth nothing."}
      </p>
    </li>
  );
}
