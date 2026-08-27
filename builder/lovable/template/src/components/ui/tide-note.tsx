import { cn } from "@/lib/utils";
/**
 * The tide — with the window it opens rather than a table of numbers.
 *
 * THE USABLE WINDOW IS THE OUTPUT. A list of high and low water times is a
 * table; "you can get over the sill from 09:40 to 14:20" is the answer somebody
 * is actually looking for, and it is computed from a clearance the caller
 * supplies.
 *
 * HEIGHTS ARE ABOVE CHART DATUM AND SAY SO. Datum is not the seabed and not the
 * sounding on the chart, and mixing the two is how a keel finds mud.
 *
 * THE PORT AND THE TIME ZONE ARE NAMED. Tide tables are per-station and
 * routinely published in a different offset from local clock time, and being an
 * hour out is a grounding rather than an inconvenience.
 *
 * IT IS A PREDICTION, NOT A MEASUREMENT, and it says so. Barometric pressure and
 * wind move real water level by a substantial margin, and a component presenting
 * a prediction as fact is the reason people trust it too far.
 */
export type TideEvent = { id: string; kind: "high" | "low"; at: string; heightM: number };

export function TideNote({ port, events, clearanceNeededM, windowNote, zoneNote, className }: {
  port?: string;
  events: TideEvent[];
  /** Depth of water the caller needs, above datum. */
  clearanceNeededM?: number;
  /** Pre-computed by the caller — "09:40 to 14:20". */
  windowNote?: string;
  /** "Times are local, from the Milford Haven station." */
  zoneNote?: string;
  className?: string;
}) {
  const high = events.filter((e) => e.kind === "high");
  const enough = clearanceNeededM !== undefined
    ? high.some((e) => e.heightM >= clearanceNeededM)
    : undefined;
  return (
    <div data-slot="tide-note" className={cn("space-y-0.5 text-sm", className)}>
      {port && <p className="text-xs text-muted-foreground">{port}</p>}
      {windowNote ? (
        <p className="font-medium">You can get in and out {windowNote}.</p>
      ) : clearanceNeededM !== undefined && enough === false ? (
        <p className="font-medium tabular-nums">
          No high water today reaches the {clearanceNeededM} m you need.
        </p>
      ) : null}
      <ul className="text-xs tabular-nums text-muted-foreground">
        {events.map((e) => (
          <li key={e.id}>
            {e.kind === "high" ? "High" : "Low"} water {e.at} · {e.heightM.toFixed(1)} m above datum
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Heights are above chart datum, not depths under your keel.
      </p>
      {zoneNote && <p className="text-xs text-muted-foreground">{zoneNote}</p>}
      <p className="text-xs">
        These are predictions. Pressure and wind move real water level by half a metre or more.
      </p>
    </div>
  );
}
