import { cn } from "@/lib/utils";
/**
 * Where in the cold chain something physically is.
 *
 * THE PARTS ARE SEPARATE AND ORDERED AS SOMEBODY WALKS THEM — freezer, shelf,
 * rack, box, position. A single string like `F3-2-A-14-C6` is unreadable
 * through a frosted door with cold hands, which is the only condition under
 * which it is ever read.
 *
 * THE TEMPERATURE IS SHOWN because it decides what may be stored there, and
 * because a sample found in a −20 when the record says −80 has an unknown
 * history and probably an unusable analyte.
 *
 * A DOOR-OPEN TIME LIMIT IS STATED WHERE ONE APPLIES. Retrieval from a −80 is
 * a race — everything in the rack warms while somebody searches — and knowing
 * the position before opening is the entire technique.
 *
 * A FAILED OR ALARMING FREEZER IS SURFACED HERE and not on a separate
 * facilities page. The person about to walk down and open it is the person who
 * needs to know it is at −40 and rising.
 */
export function FreezerLocation({ freezer, shelf, rack, box, position, temperature, alarm, retrievalNote, className }: {
  freezer: string;
  shelf?: string;
  rack?: string;
  box?: string;
  position?: string;
  /** "−80°C". */
  temperature?: string;
  /** What is wrong with the unit right now. */
  alarm?: string;
  /** "Do not hold the door open more than 60 seconds." */
  retrievalNote?: string;
  className?: string;
}) {
  const parts: [string, string | undefined][] = [
    ["Freezer", freezer], ["Shelf", shelf], ["Rack", rack], ["Box", box], ["Position", position],
  ];
  return (
    <div data-slot="freezer-location" className={cn("space-y-0.5 text-sm", className)}>
      <p className="flex flex-wrap gap-x-3 font-mono tabular-nums">
        {parts.filter(([, v]) => v).map(([k, v]) => (
          <span key={k}>
            <span className="font-sans text-xs text-muted-foreground">{k} </span>{v}
          </span>
        ))}
      </p>
      {temperature && <p className="text-xs text-muted-foreground">Stored at {temperature}.</p>}
      {alarm && <p className="text-xs font-medium">{alarm}</p>}
      {retrievalNote && <p className="text-xs">{retrievalNote}</p>}
    </div>
  );
}
