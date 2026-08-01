import { DiffInline, type DiffPart } from "@/components/ui/diff-inline";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Exactly what a generated edit changed.
 *
 * THE SINGLE MOST IMPORTANT SAFEGUARD when a model edits existing text. "Improve
 * this paragraph" routinely alters a figure, a name or a negation along the way,
 * and a rewritten block presented whole makes that invisible — the reader
 * approves the tone and ships the wrong price.
 *
 * IT REUSES `diff-inline`, so additions are underlined and removals struck
 * through rather than green and red — the same rule the rest of the kit follows,
 * and it matters here because these diffs get screenshotted and printed.
 *
 * ACCEPTING IS PER-EDIT, not per-document, where the caller supports it. An
 * all-or-nothing rewrite forces the reader to take the bad change to keep the
 * good one.
 */
export function AiEditDiff({ parts, summary, onAccept, onReject, className }: {
  parts: DiffPart[];
  /** "Shortened, and changed £2,400 to £2,650". */
  summary?: string;
  onAccept?: () => void;
  onReject?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2 rounded-md border border-border p-3", className)}>
      {summary && <p className="text-xs text-muted-foreground">{summary}</p>}
      <DiffInline parts={parts} />
      {(onAccept || onReject) && (
        <div className="flex flex-wrap gap-2">
          {onAccept && <Button size="sm" onClick={onAccept}>Keep the change</Button>}
          {onReject && <Button size="sm" variant="outline" onClick={onReject}>Put it back</Button>}
        </div>
      )}
    </div>
  );
}
