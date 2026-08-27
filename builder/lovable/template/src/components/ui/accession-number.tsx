import { cn } from "@/lib/utils";
/**
 * The permanent number given on acquisition — and what it is not.
 *
 * AN ACCESSION NUMBER IS NOT A SHELFMARK AND CONFUSING THEM IS THE ORDINARY
 * ERROR. One records that an institution owns a thing and never changes; the
 * other says where it currently sits and changes whenever it moves. Showing
 * both, labelled, is the fix.
 *
 * THE STRUCTURE IS EXPLAINED BECAUSE IT ENCODES THE YEAR. Most schemes are
 * year-then-sequence, so `2026.114.3` is the third part of the hundred and
 * fourteenth acquisition of 2026 — and a reader who knows that can spot a
 * transcription error immediately.
 *
 * PART NUMBERS ARE SHOWN AS PARTS. A pair of shoes accessioned as `.1` and `.2`
 * is two records of one object, and treating the suffix as decoration produces
 * a catalogue that has lost one shoe.
 *
 * A NUMBER NOT YET ASSIGNED IS SAID SO. Backlogs are normal, and a blank field
 * reads as an error where "awaiting accession" is a state.
 */
export function AccessionNumber({ number, shelfMark, year, partOf, partCount, awaiting, previousNumbers = [], className }: {
  number?: string;
  /** Where it currently is — deliberately shown as a different thing. */
  shelfMark?: string;
  /** Free text. */
  year?: string;
  /** The parent number, where this is one part. */
  partOf?: string;
  /** How many parts the object has altogether. */
  partCount?: number;
  /** True where the item is in the backlog. */
  awaiting?: boolean;
  /** Numbers it has been known by before. */
  previousNumbers?: string[];
  className?: string;
}) {
  return (
    <div data-slot="accession-number" className={cn("space-y-0.5 text-sm", className)}>
      <p className="text-xs text-muted-foreground">Accession number</p>
      {awaiting || !number ? (
        <p className="text-sm font-medium">Not yet accessioned.</p>
      ) : (
        <p className="font-mono text-base tabular-nums">{number}</p>
      )}
      {year && <p className="text-xs text-muted-foreground">Acquired {year}.</p>}
      {partOf && (
        <p className="text-xs">
          Part of <code className="font-mono">{partOf}</code>
          {partCount !== undefined && ` — one of ${partCount} parts of the same object`}.
        </p>
      )}
      {shelfMark && (
        <p className="text-xs">
          <span className="text-muted-foreground">Currently shelved at </span>
          <code className="font-mono">{shelfMark}</code>
          <span className="block text-muted-foreground">That location can change; the accession number cannot.</span>
        </p>
      )}
      {previousNumbers.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Previously numbered {previousNumbers.join(", ")} — older citations may use those.
        </p>
      )}
    </div>
  );
}
