import { Button } from "@/components/ui/button";
import { DateFormat } from "@/components/ui/date-format";
import { cn } from "@/lib/utils";
/**
 * "We kept what you were writing." The offer after a crash, a closed tab or a
 * flat battery.
 *
 * BOTH ANSWERS ARE EQUALLY EASY TO REACH, and neither is destructive by
 * accident: restore is the primary because it is why the panel exists, and
 * discard is an outline button rather than a bare link, because somebody who
 * genuinely wants the blank form should not have to hunt for it.
 *
 * The timestamp is not decoration. Somebody with two drafts in a day needs to
 * know WHICH one this is before they can answer, and "a draft was recovered"
 * with no time is a question they cannot make a decision from.
 *
 * `preview` shows the first line of what was kept, for the same reason. Clipped
 * with `line-clamp` rather than truncated in JS, so a long draft cannot push
 * the two buttons off a small screen.
 */
export function DraftRecovery({ savedAt, preview, onRestore, onDiscard, className }: {
  savedAt: string | number | Date;
  /** The opening of the kept draft, so the reader knows which one it is. */
  preview?: string;
  onRestore: () => void;
  onDiscard: () => void;
  className?: string;
}) {
  return (
    <section aria-label="Recovered draft"
      className={cn("flex flex-col gap-3 rounded-md border border-border p-4", className)}>
      <div>
        <p className="text-sm font-medium">You have an unsaved draft</p>
        <p className="text-sm text-muted-foreground">
          Saved <time dateTime={new Date(savedAt).toISOString()}><DateFormat date={savedAt} withTime /></time>
        </p>
      </div>
      {preview && (
        <p className="line-clamp-3 rounded border border-border bg-muted/40 p-3 text-sm whitespace-pre-wrap text-muted-foreground">
          {preview}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onRestore}>Restore it</Button>
        <Button size="sm" variant="outline" onClick={onDiscard}>Start fresh</Button>
      </div>
    </section>
  );
}
