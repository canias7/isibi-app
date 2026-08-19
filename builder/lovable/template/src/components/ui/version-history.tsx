import { AvatarName } from "@/components/ui/avatar-name";
import { TimeAgo } from "@/components/ui/time-ago";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Earlier versions of a document, newest first.
 *
 * "Restore" writes a NEW version rather than rolling back to an old one —
 * that is what makes the action safe, because restoring is itself undoable
 * and nothing between the two points is lost. Labelling it "revert" invites
 * the destructive reading.
 *
 * The current version is marked and cannot be restored onto itself.
 */
export function VersionHistory({ versions, currentId, onView, onRestore, className }: {
  versions: { id: string | number; at: string | number | Date; by?: string; note?: string }[];
  currentId?: string | number; onView?: (id: string | number) => void;
  onRestore?: (id: string | number) => void; className?: string;
}) {
  return (
    <ul className={cn("divide-y divide-border", className)}>
      {versions.map((v) => {
        const current = v.id === currentId;
        return (
          <li key={v.id} className="flex flex-wrap items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <TimeAgo date={v.at} />
                {current && <span className="ms-2 rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide">Current</span>}
              </p>
              {v.by && <div className="mt-0.5"><AvatarName name={v.by} size="sm" avatarOnly /></div>}
              {v.note && <p className="mt-0.5 text-xs text-muted-foreground">{v.note}</p>}
            </div>
            {onView && <Button size="sm" variant="ghost" onClick={() => onView(v.id)}>View</Button>}
            {onRestore && !current && (
              <Button size="sm" variant="outline" onClick={() => onRestore(v.id)}>Restore</Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
