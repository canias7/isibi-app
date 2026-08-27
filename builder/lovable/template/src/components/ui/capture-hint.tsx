import { cn } from "@/lib/utils";
/**
 * How to take a photo that will actually be accepted.
 *
 * IT GOES BEFORE THE CAMERA OPENS, NOT AFTER THE REJECTION. Every one of these
 * rules — fill the frame, avoid glare, get all four corners in — is discovered
 * by having a photo refused two days later. Shown first, they cost five seconds
 * and save a round trip.
 *
 * THE RULES ARE PHRASED AS ACTIONS. "Poor lighting" is a complaint; "take it
 * near a window" is something somebody can do standing where they are.
 *
 * THE COMMONEST REJECTION IS NAMED where the caller knows it, because a general
 * list is skimmed while "most photos are sent back for glare on the screen" is
 * read. That is real information from the business's own queue.
 *
 * NO EXAMPLE IMAGES. A good/bad illustration pair means shipping two more
 * images per document type, they are frequently wrong for the reader's own
 * document, and the sentences carry it.
 */
export function CaptureHint({ rules, commonRejection, className }: {
  rules: string[];
  /** The most frequent reason things get sent back. */
  commonRejection?: string;
  className?: string;
}) {
  if (!rules.length && !commonRejection) return null;
  return (
    <div data-slot="capture-hint" className={cn("space-y-1 rounded-md border border-border bg-muted/30 p-3", className)}>
      {rules.length > 0 && (
        <ul className="space-y-0.5 text-xs">
          {rules.map((r) => (
            <li key={r} className="flex gap-2"><span aria-hidden="true">·</span><span>{r}</span></li>
          ))}
        </ul>
      )}
      {commonRejection && (
        <p className="text-xs text-muted-foreground">
          Most are sent back for <span className="text-foreground">{commonRejection}</span>.
        </p>
      )}
    </div>
  );
}
