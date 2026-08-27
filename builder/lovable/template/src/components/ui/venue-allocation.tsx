import { cn } from "@/lib/utils";
/**
 * Which pitch, when — with the clashes made obvious.
 *
 * A DOUBLE BOOKING IS THE ONLY THING THIS HAS TO CATCH. Two fixtures on one
 * pitch is discovered on Saturday morning by two squads standing on it, and it
 * is trivially detectable the moment the second is allocated.
 *
 * TURNAROUND TIME IS PART OF THE CLASH TEST. Back-to-back matches on one pitch
 * with no gap means the second starts late every time — a pitch is not free the
 * instant the whistle goes.
 *
 * FLOODLIGHTS AND CHANGING ROOMS ARE ALLOCATED SEPARATELY FROM THE PITCH. A
 * winter fixture on an unlit pitch at four o'clock is abandoned at half time,
 * and the pitch booking alone says nothing about it.
 *
 * THE CLASH IS NAMED WITH BOTH FIXTURES, so somebody can decide which moves
 * rather than being told there is a problem somewhere.
 */
export type Allocation = {
  id: string;
  fixture: string;
  pitch: string;
  /** Free text — "Saturday 15:00". */
  start: string;
  /** Minutes the slot occupies, including turnaround. */
  minutes?: number;
  floodlit?: boolean;
  needsFloodlights?: boolean;
  changingRooms?: string;
};

export function VenueAllocation({ allocations, clashes = [], className }: {
  allocations: Allocation[];
  /** Pairs of allocation ids the caller has found to overlap. */
  clashes?: [string, string][];
  className?: string;
}) {
  const clashed = new Set(clashes.flat());
  const dark = allocations.filter((a) => a.needsFloodlights && !a.floodlit);
  const label = (id: string) => allocations.find((a) => a.id === id)?.fixture ?? id;
  return (
    <div data-slot="venue-allocation" className={cn("space-y-1.5", className)}>
      {clashes.map(([a, b], i) => (
        <p key={i} className="text-sm font-medium">
          {label(a)} and {label(b)} are on the same pitch at the same time — one has to move.
        </p>
      ))}
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {allocations.map((a) => (
          <li key={a.id} className="space-y-0.5 px-3 py-1.5">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className={cn("min-w-0 flex-1", clashed.has(a.id) && "font-medium")}>{a.fixture}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{a.start}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {a.pitch}
              {a.minutes !== undefined && ` · ${a.minutes} minutes including turnaround`}
              {a.changingRooms && ` · ${a.changingRooms}`}
            </p>
            {a.needsFloodlights && !a.floodlit && (
              <p className="text-xs font-medium">No floodlights on this pitch — this will not finish in daylight.</p>
            )}
          </li>
        ))}
      </ul>
      {dark.length === 0 && clashes.length === 0 && (
        <p className="text-xs text-muted-foreground">No clashes and nothing needing lights it does not have.</p>
      )}
    </div>
  );
}
