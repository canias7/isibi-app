import { cn } from "@/lib/utils";
/**
 * The label beside an object — the wall text, with its credit.
 *
 * IT IS SHORT BY CONSTRUCTION. Visitors read a label for a few seconds while
 * standing up, and the research shows almost nobody finishes a long one, so the
 * component leads with maker, date and material and treats the interpretation
 * as the thing that can be skipped.
 *
 * "MAKER UNKNOWN" IS WRITTEN, NOT LEFT BLANK. A blank line reads as an omission;
 * a stated unknown is a fact about the object, and for a great many objects it
 * is the honest one — often because the museum's own records lost it.
 *
 * THE ACQUISITION LINE IS PART OF THE LABEL, not a footnote. How an object
 * arrived is increasingly the first thing a visitor wants to know, and burying
 * it is a choice that reads as evasion.
 *
 * THE CULTURE AND THE PLACE ARE NAMED SEPARATELY FROM THE MODERN COUNTRY,
 * because "Benin, Nigeria" collapses a kingdom into a state that did not exist
 * when the object was made.
 */
export function ObjectLabel({ title, maker, culture, place, date, material, accession, acquisition, interpretation, className }: {
  title: string;
  /** Omit rather than guess — the component writes "Maker unknown". */
  maker?: string;
  /** The culture or people, not the modern state. */
  culture?: string;
  place?: string;
  /** Free text — dates here are ranges and circas. */
  date?: string;
  material?: string;
  accession?: string;
  /** How it came to be here. */
  acquisition?: string;
  /** The one or two sentences of interpretation. */
  interpretation?: string;
  className?: string;
}) {
  return (
    <div data-slot="object-label" className={cn("space-y-1 text-sm", className)}>
      <p className="font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">
        {maker ?? "Maker unknown"}
        {culture && ` · ${culture}`}
        {place && ` · ${place}`}
        {date && ` · ${date}`}
      </p>
      {material && <p className="text-xs text-muted-foreground">{material}</p>}
      {interpretation && <p className="text-xs">{interpretation}</p>}
      <p className="text-xs text-muted-foreground">
        {acquisition ?? "How this object was acquired is not recorded here."}
        {/* On its own line: the acquisition line is a SENTENCE, and appending a
            number to it with a middot reads as part of the sentence. */}
        {accession && <span className="block">{accession}</span>}
      </p>
    </div>
  );
}
