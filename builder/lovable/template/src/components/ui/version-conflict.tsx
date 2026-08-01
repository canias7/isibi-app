import { Button } from "@/components/ui/button";
import { DateFormat } from "@/components/ui/date-format";
import { cn } from "@/lib/utils";
/**
 * Somebody else saved while you were editing.
 *
 * THE ORDER OF THE BUTTONS IS THE DESIGN. Compare first, reload second,
 * overwrite last and only if the caller allows it — because overwrite is the
 * one that destroys another person's work, and a destructive action sitting
 * where the eye lands first gets pressed by people who are in a hurry.
 *
 * Overwrite is opt-in via `onOverwrite` rather than always offered. On plenty
 * of records the honest answer is that you cannot overwrite, and rendering a
 * button that then refuses is worse than not offering it.
 *
 * `by` and `at` are what make this actionable. "This record changed" is a
 * problem; "Sam changed it four minutes ago" is a person you can ask.
 */
export function VersionConflict({ by, at, onCompare, onReload, onOverwrite, className }: {
  /** Who saved over you. */
  by?: string;
  at?: string | number | Date;
  onCompare?: () => void;
  onReload: () => void;
  /** Offered only where overwriting is genuinely permitted. */
  onOverwrite?: () => void;
  className?: string;
}) {
  return (
    <section role="alert" aria-label="Version conflict"
      className={cn("flex flex-col gap-3 rounded-md border border-border p-4", className)}>
      <div>
        <p className="text-sm font-medium">This was changed somewhere else</p>
        <p className="text-sm text-muted-foreground">
          {by ? `${by} saved a newer version` : "A newer version was saved"}
          {at ? <> <time dateTime={new Date(at).toISOString()}><DateFormat date={at} withTime /></time></> : null}
          . Saving now would replace it.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {onCompare && <Button size="sm" onClick={onCompare}>Compare</Button>}
        <Button size="sm" variant="outline" onClick={onReload}>Reload theirs</Button>
        {onOverwrite && (
          <Button size="sm" variant="outline" onClick={onOverwrite}>Overwrite with mine</Button>
        )}
      </div>
    </section>
  );
}
