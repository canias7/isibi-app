import { cn } from "@/lib/utils";
/**
 * Something somebody is experiencing, in their own words first.
 *
 * THE PERSON'S OWN DESCRIPTION LEADS AND IS QUOTED. Translating "it feels like
 * something sitting on my chest" into a clinical term loses the information and
 * keeps the confidence, and the original phrase is frequently what makes the
 * diagnosis. The clinical term, where there is one, sits underneath as a label.
 *
 * HOW LONG AND WHETHER IT IS CHANGING ARE SEPARATE FROM HOW BAD. Three weeks and
 * getting worse is a different thing from three weeks and steady at the same
 * intensity, and a severity score alone cannot express either.
 *
 * WHAT MAKES IT BETTER OR WORSE IS A FIELD. It is one of the most diagnostically
 * useful things anybody can say and it is not on any form, so it comes out only
 * if somebody happens to ask.
 *
 * NO SCORE OUT OF TEN AS THE PRIMARY DISPLAY. It is not comparable between people
 * and barely comparable within one over time; what it is stopping them doing is,
 * and that is the field here.
 */
export function SymptomRow({ theirWords, clinicalTerm, forHowLong, direction, stopsThemDoing, better = [], worse = [], className }: {
  /** Leads, and is quoted. */
  theirWords: string;
  clinicalTerm?: string;
  forHowLong?: string;
  direction?: "worse" | "better" | "same";
  /** More useful than a number out of ten. */
  stopsThemDoing?: string;
  better?: string[];
  worse?: string[];
  className?: string;
}) {
  const AND = new Intl.ListFormat("en", { style: "long", type: "conjunction" });
  return (
    <li data-slot="symptom-row" className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="italic">"{theirWords}"</p>
      {clinicalTerm && <p className="text-xs text-muted-foreground">{clinicalTerm}</p>}
      <p className={cn("text-xs", direction === "worse" ? "font-medium" : "text-muted-foreground")}>
        {[
          forHowLong && `For ${forHowLong}`,
          direction === "worse" ? "getting worse" : direction === "better" ? "getting better" : direction === "same" ? "no change" : "",
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {stopsThemDoing && <p className="text-sm">Stops them {stopsThemDoing}.</p>}
      {(better.length > 0 || worse.length > 0) && (
        <p className="text-xs text-muted-foreground">
          {[
            better.length > 0 && `Better with ${AND.format(better)}`,
            worse.length > 0 && `worse with ${AND.format(worse)}`,
          ]
            .filter(Boolean)
            .join(" · ")}
          .
        </p>
      )}
    </li>
  );
}
