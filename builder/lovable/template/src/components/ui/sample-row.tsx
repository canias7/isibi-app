import { cn } from "@/lib/utils";
/**
 * One sample — its identity, its condition, and how much is left.
 *
 * VOLUME REMAINING IS THE FIELD THAT DECIDES EVERYTHING. A sample with 40µL left
 * cannot run the assay somebody just booked it for, and a list without it
 * produces a fully planned experiment that fails at the bench.
 *
 * FREEZE-THAW CYCLES ARE COUNTED. Analyte stability falls with each one, and a
 * sample on its fifth thaw gives a result that is real, plausible and wrong.
 * Nothing else on a sample record predicts that.
 *
 * THE COLLECTION TIME MATTERS AS MUCH AS THE DATE for anything time-sensitive,
 * and a record storing only a date silently merges a morning and an evening
 * draw that are not comparable.
 *
 * A COMPROMISED SAMPLE IS MARKED AND NOT HIDDEN. Haemolysis, a warm courier, a
 * cracked tube — the result may still be usable for some assays and not others,
 * which is the analyst's call and cannot be made on a record that omits it.
 */
export function SampleRow({ id, subject, type, collectedAt, volumeLeft, volumeUnit = "µL", freezeThaws, location, compromised, className }: {
  id: string;
  /** Participant or source. */
  subject?: string;
  /** "Serum", "Plasma EDTA", "Tissue". */
  type?: string;
  /** Free text — "14 July, 08:40". */
  collectedAt?: string;
  volumeLeft?: number;
  volumeUnit?: string;
  /** How many times it has been thawed. */
  freezeThaws?: number;
  location?: string;
  /** What is wrong with it. */
  compromised?: string;
  className?: string;
}) {
  const low = volumeLeft !== undefined && volumeLeft < 100;
  const thawed = freezeThaws !== undefined && freezeThaws >= 3;
  return (
    <li className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1">
          <code className="font-mono text-xs">{id}</code>
          {type && <span className="text-muted-foreground"> · {type}</span>}
          {subject && <span className="block text-xs text-muted-foreground">{subject}</span>}
        </span>
        {volumeLeft !== undefined && (
          <span className={cn("shrink-0 tabular-nums", low && "font-medium")}>
            {volumeLeft} {volumeUnit} left
          </span>
        )}
      </p>
      <p className="text-xs tabular-nums text-muted-foreground">
        {collectedAt && `Collected ${collectedAt}`}
        {collectedAt && location ? " · " : ""}
        {location}
      </p>
      {freezeThaws !== undefined && (
        <p className={cn("text-xs tabular-nums", thawed ? "font-medium" : "text-muted-foreground")}>
          {freezeThaws} freeze-thaw {freezeThaws === 1 ? "cycle" : "cycles"}
          {thawed && " — check the analyte is still stable at this point"}
        </p>
      )}
      {compromised && <p className="text-xs font-medium">{compromised}</p>}
    </li>
  );
}
