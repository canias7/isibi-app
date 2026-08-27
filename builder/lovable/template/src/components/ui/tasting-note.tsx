import { cn } from "@/lib/utils";
/**
 * What something tasted like, recorded so it can be compared later.
 *
 * THE CONDITIONS ARE RECORDED WITH THE NOTE. Temperature, glass, time of day and
 * what was eaten beforehand change the result more than most differences between
 * samples, and a note without them cannot be compared with anything, including
 * itself a month later.
 *
 * BLIND OR NOT IS THE FIELD THAT DECIDES WHAT THE NOTE IS WORTH. Knowing the
 * producer changes the score reliably and substantially, and a set of notes that
 * does not say which were blind cannot be pooled.
 *
 * THE DESCRIPTORS ARE FREE TEXT, NOT A WHEEL. Fixed vocabularies produce notes
 * where everything tastes of the same twelve things, and the useful part of a
 * tasting note is invariably the phrase that is not on the list.
 *
 * NO SCORE OUT OF A HUNDRED. It compresses everything above into one number,
 * gets averaged across tasters with different scales, and then sold. A rank
 * against the other samples in the same sitting is the honest version.
 */
export function TastingNote({ sample, blind, servedAt, vessel, descriptors = [], wouldBuyAgain, rankInFlight, ofSamples, taster, notes, className }: {
  sample: string;
  /** Decides what the note is worth. */
  blind?: boolean;
  /** "12°C", "room temperature". */
  servedAt?: string;
  vessel?: string;
  /** Free text. A fixed wheel produces identical notes. */
  descriptors?: string[];
  wouldBuyAgain?: boolean;
  /** Honest alternative to a score. */
  rankInFlight?: number;
  ofSamples?: number;
  taster?: string;
  notes?: string;
  className?: string;
}) {
  const AND = new Intl.ListFormat("en", { style: "long", type: "conjunction" });
  return (
    <div data-slot="tasting-note" className={cn("space-y-0.5 text-sm", className)}>
      <p className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 font-medium">{sample}</span>
        {rankInFlight !== undefined && (
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {rankInFlight}
            {ofSamples !== undefined ? ` of ${ofSamples}` : ""}
          </span>
        )}
      </p>
      {/* Labelled rather than sentence-initial: descriptors are caller text and
          "bruised apple, wet stone and a long dry finish." opening a sentence
          reads as a typo, while capitalising it would rewrite what was written. */}
      {descriptors.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground">Tasted of</p>
          <p>{AND.format(descriptors)}</p>
        </div>
      )}
      {notes && <p className="text-xs">{notes}</p>}
      <p className={cn("text-xs", blind ? "text-muted-foreground" : "font-medium")}>
        {blind
          ? "Tasted blind."
          : "Not blind — the taster knew what this was, which moves a score more than most differences between samples."}
      </p>
      <p className="text-xs text-muted-foreground">
        {[servedAt && `Served at ${servedAt}`, vessel, taster].filter(Boolean).join(" · ")}
      </p>
      {wouldBuyAgain !== undefined && (
        <p className="text-xs text-muted-foreground">
          {wouldBuyAgain ? "Would buy it again." : "Would not buy it again."}
        </p>
      )}
    </div>
  );
}
