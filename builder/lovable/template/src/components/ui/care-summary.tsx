import { cn } from "@/lib/utils";
/**
 * The short version somebody reads before seeing a patient.
 *
 * IT IS ORDERED BY WHAT CHANGES THE NEXT FIVE MINUTES. Allergies, then the
 * things that would alter immediate treatment, then everything else. A summary
 * ordered chronologically or alphabetically buries the one line that matters
 * among forty that do not, and it is read under time pressure or not at all.
 *
 * IT SAYS HOW OLD IT IS AND WHO WROTE IT. A summary generated a year ago from a
 * system nobody updates is a different document from one written this morning,
 * and they look identical.
 *
 * THE PATIENT'S OWN WORDS GET A PLACE. What somebody wants out of their care, and
 * what they are worried about, are absent from every clinical summary and are
 * frequently the most useful sentence in the room.
 *
 * NO AUTOMATIC SUMMARISING CLAIM. The component renders what it was given; if it
 * was assembled by a machine, the caller says so, because a reader trusts a
 * summary differently depending on that.
 */
export function CareSummary({ allergies = [], changesTreatment = [], background = [], theirWords, writtenBy, writtenOn, monthsOld, assembledAutomatically, className }: {
  /** First, always. */
  allergies?: string[];
  /** Things that alter what happens next. */
  changesTreatment?: string[];
  background?: string[];
  /** Absent from every clinical summary and often the most useful line. */
  theirWords?: string;
  writtenBy?: string;
  writtenOn?: string;
  monthsOld?: number;
  assembledAutomatically?: boolean;
  className?: string;
}) {
  const AND = new Intl.ListFormat("en", { style: "long", type: "conjunction" });
  const stale = monthsOld !== undefined && monthsOld >= 12;
  return (
    <div className={cn("space-y-1.5 text-sm", className)}>
      <p className={cn(allergies.length > 0 ? "font-medium" : "text-muted-foreground")}>
        {allergies.length > 0
          ? `Allergies: ${AND.format(allergies)}.`
          : "No allergies recorded — which is not the same as none."}
      </p>
      {changesTreatment.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground">Changes what you do next</p>
          <ul className="space-y-0.5">
            {changesTreatment.map((c) => (
              <li key={c} className="font-medium">
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
      {background.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground">Background</p>
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {background.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}
      {theirWords && (
        <div>
          <p className="text-xs font-medium text-muted-foreground">In their words</p>
          <p className="italic">"{theirWords}"</p>
        </div>
      )}
      <p className={cn("text-xs", stale ? "font-medium" : "text-muted-foreground")}>
        {[
          writtenBy && `Written by ${writtenBy}`,
          writtenOn,
          monthsOld !== undefined && monthsOld > 0 && `${monthsOld} ${monthsOld === 1 ? "month" : "months"} old`,
          assembledAutomatically && "put together automatically, not written by a person",
        ]
          .filter(Boolean)
          .join(" · ")}
        {stale ? " — old enough that things will have changed." : ""}
      </p>
    </div>
  );
}
