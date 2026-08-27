import { cn } from "@/lib/utils";
/**
 * The text was read by a machine, and may be wrong.
 *
 * OCR OUTPUT PRESENTED AS FACT IS THE PROBLEM. Scanned text looks identical to
 * typed text, so a misread digit in an invoice total or a date is invisible —
 * and it is exactly the field somebody will act on.
 *
 * CONFIDENCE IS SAID IN WORDS, banded rather than as a raw percentage. "Some
 * words were unclear" is actionable; "87.3% confidence" is a number nobody can
 * turn into a decision, and the precision is spurious anyway.
 *
 * IT POINTS AT THE ORIGINAL. The only real remedy for a suspect scan is the
 * image it came from, and a note that does not link to it leaves the reader
 * unable to check.
 */
export function OcrNote({ confidence, unclearCount, originalHref, className }: {
  /** 0-1. */
  confidence?: number;
  /** How many words the reader should check. */
  unclearCount?: number;
  originalHref?: string;
  className?: string;
}) {
  const band =
    confidence === undefined ? null
    : confidence >= 0.95 ? "read cleanly"
    : confidence >= 0.8 ? "mostly clear"
    : "hard to read";
  return (
    <p data-slot="ocr-note" className={cn("flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground", className)}>
      <span><span className="font-medium text-foreground">Read from a scan</span> — check anything important.</span>
      {band && <span>{band}.</span>}
      {typeof unclearCount === "number" && unclearCount > 0 && (
        <span className="tabular-nums">{unclearCount} unclear {unclearCount === 1 ? "word" : "words"}.</span>
      )}
      {originalHref && (
        <a href={originalHref} className="underline underline-offset-4">See the original</a>
      )}
    </p>
  );
}
