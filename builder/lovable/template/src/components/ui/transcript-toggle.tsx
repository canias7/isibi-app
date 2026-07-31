import * as React from "react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * "Show the transcript" under a video or a recording.
 *
 * THE TRANSCRIPT IS IN THE DOM WHEN OPEN — real text, findable with the
 * browser's own find, copyable, indexable. A transcript in a virtualised
 * or lazy panel defeats the three ways people actually use one (search it,
 * quote it, skim it), and search-ability is most of why a transcript beats
 * captions for anyone deaf or in a hurry.
 *
 * THE TOGGLE STATES THE LENGTH — "transcript, about 4 min of reading" —
 * because opening an unknown wall of text is a commitment some readers avoid;
 * the estimate is cheap (words / 200).
 *
 * It is a disclosure (`aria-expanded` + `aria-controls`), not a dialog: a
 * transcript is page content to read alongside the player, not an
 * interruption.
 */
export function TranscriptToggle({ text, children, className }: {
  text?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const id = React.useId();
  const words = text ? text.trim().split(/\s+/).length : 0;
  const mins = Math.max(1, Math.round(words / 200));

  return (
    <div className={className}>
      <button type="button" onClick={() => setOpen((v) => !v)}
        aria-expanded={open} aria-controls={id}
        className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
        <FileText aria-hidden className="size-3.5" />
        {open ? "Hide the transcript" : `Show the transcript${words ? ` — about ${mins} min of reading` : ""}`}
      </button>
      {open ? (
        <div id={id} className="mt-2 max-h-80 overflow-y-auto rounded-md border border-border p-3 text-sm leading-relaxed whitespace-pre-wrap">
          {children ?? text}
        </div>
      ) : null}
    </div>
  );
}
