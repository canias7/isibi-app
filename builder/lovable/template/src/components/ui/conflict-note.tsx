import { Button } from "@/components/ui/button";
import { TimeAgo } from "@/components/ui/time-ago";
import { cn } from "@/lib/utils";
/**
 * "Somebody else changed this while you were editing."
 *
 * It never picks a winner. Both options are offered and neither is the
 * default, because silently keeping one side is how an afternoon's work
 * vanishes with no message at all — which is what "last write wins" looks
 * like from the losing end.
 */
export function ConflictNote({ who, at, onKeepMine, onTakeTheirs, onCompare, className }: {
  who?: string; at?: string | number | Date;
  onKeepMine?: () => void; onTakeTheirs?: () => void; onCompare?: () => void; className?: string;
}) {
  return (
    <div data-slot="conflict-note" role="alert" className={cn("space-y-2 rounded-md border border-warning/40 bg-warning/10 p-3", className)}>
      <p className="text-sm">
        <strong className="font-medium">{who ?? "Someone else"}</strong> changed this
        {at ? <> <TimeAgo date={at} /></> : null} while you were editing.
      </p>
      <p className="text-sm text-muted-foreground">Your changes have not been saved yet.</p>
      <div className="flex flex-wrap gap-2 pt-1">
        {onCompare && <Button size="sm" variant="outline" onClick={onCompare}>See the difference</Button>}
        {onKeepMine && <Button size="sm" variant="outline" onClick={onKeepMine}>Keep mine</Button>}
        {onTakeTheirs && <Button size="sm" variant="outline" onClick={onTakeTheirs}>Use theirs</Button>}
      </div>
    </div>
  );
}
