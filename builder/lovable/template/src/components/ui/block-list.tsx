import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Everyone you have blocked, and how to undo it.
 *
 * A BLOCK YOU CANNOT FIND IS A BLOCK YOU CANNOT LIFT. People block in anger and
 * reconsider later, and a list buried three levels into settings means the
 * relationship stays broken by an interface rather than by intent.
 *
 * IT SAYS WHAT BLOCKING ACTUALLY DID. The effects differ per product — can they
 * still see your posts, do they know — and somebody deciding whether to unblock
 * needs to know what they are undoing.
 *
 * WHEN, AND WHY IF THEY SAID. Months later "why did I block this person" is the
 * commonest question, and a note field answers it.
 */
export function BlockList({ blocked, effects, onUnblock, empty = "You haven't blocked anyone.", className }: {
  blocked: { id: string; name: string; at?: string; note?: string }[];
  /** What a block does here. */
  effects?: string[];
  onUnblock: (id: string) => void;
  empty?: string;
  className?: string;
}) {
  if (!blocked.length) {
    return <p className={cn("text-sm text-muted-foreground", className)}>{empty}</p>;
  }
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {effects?.length ? (
        <p className="text-xs text-muted-foreground">Blocking means: {effects.join("; ")}.</p>
      ) : null}
      <ul className="divide-y divide-border">
        {blocked.map((b) => (
          <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
            <span className="min-w-0">
              <span className="block truncate text-sm">{b.name}</span>
              <span className="block text-xs text-muted-foreground">
                {[b.at && `Blocked ${b.at}`, b.note].filter(Boolean).join(" · ")}
              </span>
            </span>
            <Button size="sm" variant="outline" onClick={() => onUnblock(b.id)}>
              Unblock<span className="sr-only"> {b.name}</span>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
