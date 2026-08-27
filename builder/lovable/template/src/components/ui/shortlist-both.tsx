import { cn } from "@/lib/utils";
/**
 * Two shortlists side by side — yours, and where you appear on theirs.
 *
 * IT SHOWS ONLY WHAT IS ALREADY MUTUAL ON THE OTHER SIDE. Whether somebody has
 * shortlisted you is their private state until it is reciprocal, and a panel
 * showing "you are on 4 shortlists" turns a matching tool into a popularity
 * measure that changes how people behave on it.
 *
 * A SHORTLIST HAS A SIZE LIMIT AND IT IS SHOWN. Unlimited shortlists get long
 * and stop being shortlists, and the cap forces the comparison that makes a
 * choice possible.
 *
 * IT SAYS WHICH SIDE IS WAITING. Two-sided systems stall because both sides
 * think they have acted, and the only useful thing a summary can say is whose
 * move it is.
 *
 * REMOVING SOMEBODY IS SILENT. A notification that you have been removed from a
 * shortlist is a rejection nobody needs, and it is the single fastest way to
 * make people stop shortlisting at all.
 */
export type ShortlistEntry = { id: string; name: string; mutual?: boolean; note?: string };

export function ShortlistBoth({ entries, limit, waitingOn, onRemove, className }: {
  entries: ShortlistEntry[];
  /** How many the shortlist holds. */
  limit?: number;
  waitingOn?: "you" | "them" | "both";
  onRemove?: (id: string) => void;
  className?: string;
}) {
  const mutual = entries.filter((e) => e.mutual);
  const room = limit !== undefined ? limit - entries.length : undefined;
  return (
    <div data-slot="shortlist-both" className={cn("space-y-1.5", className)}>
      <p className="text-sm tabular-nums">
        <span className="font-medium">{entries.length} shortlisted</span>
        {limit !== undefined && <span className="text-muted-foreground"> of {limit}</span>}
        {mutual.length > 0 && <span className="text-muted-foreground"> · {mutual.length} mutual</span>}
      </p>
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {entries.map((e) => (
          <li key={e.id} className="flex items-baseline gap-3 px-3 py-1.5">
            <span className="min-w-0 flex-1">
              {e.name}
              {e.note && <span className="block text-xs text-muted-foreground">{e.note}</span>}
            </span>
            {e.mutual && <span className="shrink-0 text-xs font-medium">Mutual</span>}
            {onRemove && (
              <button type="button" onClick={() => onRemove(e.id)} className="shrink-0 text-xs underline underline-offset-2">
                Remove<span className="sr-only"> {e.name}</span>
              </button>
            )}
          </li>
        ))}
      </ul>
      {room !== undefined && room <= 0 && (
        <p className="text-xs font-medium">Your shortlist is full. Take somebody off to add another.</p>
      )}
      {waitingOn && (
        <p className="text-xs">
          {waitingOn === "you"
            ? "They have answered. It is your move."
            : waitingOn === "them"
              ? "You have answered. Nothing to do until they do."
              : "Neither side has answered yet."}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Nobody is told when you remove them, and we only show a shortlist when it goes both ways.
      </p>
    </div>
  );
}
