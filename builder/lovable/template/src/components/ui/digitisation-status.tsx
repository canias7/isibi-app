import { cn } from "@/lib/utils";
/**
 * Whether a thing is online — and whether the online version is enough.
 *
 * "DIGITISED" DOES NOT MEAN "READABLE" AND THIS SAYS WHICH. A scan without
 * transcription cannot be searched; one at thumbnail resolution cannot be read;
 * one photographed from microfilm loses what the original page showed. A single
 * yes/no sends researchers home believing they have seen it.
 *
 * PARTIAL DIGITISATION IS THE COMMON CASE AND IS STATED AS A PROPORTION. Most
 * collections are digitised in samples for exhibitions, and a reader assuming
 * completeness draws conclusions from an unrepresentative fraction.
 *
 * IT SAYS WHETHER THE ORIGINAL CAN STILL BE SEEN. Some institutions withdraw
 * originals once a surrogate exists, which is legitimate preservation and a
 * genuine loss for anyone studying the physical object.
 *
 * REUSE TERMS ARE SHOWN HERE rather than on a separate rights page, because the
 * question "can I put this in my book" is asked at exactly this moment.
 */
export function DigitisationStatus({ state = "none", proportion, searchable, resolutionNote, originalStillAvailable, reuse, requestNote, className }: {
  state?: "none" | "partial" | "full";
  /** 0–1, where part of it is done. */
  proportion?: number;
  /** True where the text has been transcribed and can be searched. */
  searchable?: boolean;
  /** "600 dpi colour", "from microfilm". */
  resolutionNote?: string;
  originalStillAvailable?: boolean;
  /** Plain words — "free for any use, with credit". */
  reuse?: string;
  /** How to ask for something to be digitised. */
  requestNote?: string;
  className?: string;
}) {
  const pct = proportion !== undefined
    ? new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 0 }).format(proportion)
    : undefined;
  return (
    <div data-slot="digitisation-status" className={cn("space-y-0.5 text-sm", className)}>
      <p className={cn(state === "none" && "font-medium")}>
        {state === "full" ? "Digitised in full" : state === "partial" ? `Partly digitised${pct ? ` — about ${pct}` : ""}` : "Not digitised"}
      </p>
      {state !== "none" && (
        <p className="text-xs text-muted-foreground">
          {searchable ? "Transcribed, so the text can be searched." : "Images only — the text cannot be searched."}
          {resolutionNote && ` ${resolutionNote}.`}
        </p>
      )}
      {state === "partial" && (
        <p className="text-xs font-medium">
          What is online is a selection, not a sample — do not treat it as the whole.
        </p>
      )}
      {originalStillAvailable !== undefined && (
        <p className="text-xs">
          {originalStillAvailable
            ? "The original can still be produced."
            : "The original is no longer produced — the copy is what is available."}
        </p>
      )}
      {reuse && <p className="text-xs text-muted-foreground">Reuse: {reuse}</p>}
      {state !== "full" && requestNote && <p className="text-xs">{requestNote}</p>}
    </div>
  );
}
