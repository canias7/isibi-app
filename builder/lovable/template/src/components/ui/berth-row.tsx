import { cn } from "@/lib/utils";
/**
 * A berth allocation — with the two things that make it usable.
 *
 * DEPTH AND LENGTH DECIDE WHETHER A VESSEL FITS, and a berth list without them
 * is a list of names. A boat too long for the berth or too deep for the water at
 * low tide cannot use it, and finding out on arrival is expensive.
 *
 * DEPTH IS AT CHART DATUM, WHICH IS NOT WHAT IS THERE NOW. Actual depth is
 * datum plus the tide, and a component reporting a single depth invites a
 * grounding — so it labels the figure and points at the tide.
 *
 * SERVICES ARE PART OF THE BERTH. Shore power, water, and whether it dries out
 * at low water are what somebody is choosing between, and they are never in the
 * berth number.
 *
 * AN OVERSTAY IS SHOWN because berths are allocated in sequence and one vessel
 * staying on cascades into every arrival after it.
 */
export function BerthRow({ berth, vessel, lengthLimitM, depthAtDatumM, vesselLengthM, vesselDraughtM, services = [], driesOut, fromDate, toDate, overstaying, className }: {
  berth: string;
  vessel?: string;
  /** Longest vessel it takes. */
  lengthLimitM?: number;
  /** Charted depth, not the depth right now. */
  depthAtDatumM?: number;
  vesselLengthM?: number;
  vesselDraughtM?: number;
  /** Shore power, water, wifi. */
  services?: string[];
  /** True where the berth is dry at low water. */
  driesOut?: boolean;
  fromDate?: string;
  toDate?: string;
  overstaying?: boolean;
  className?: string;
}) {
  const tooLong = lengthLimitM !== undefined && vesselLengthM !== undefined && vesselLengthM > lengthLimitM;
  const tooDeep = depthAtDatumM !== undefined && vesselDraughtM !== undefined && vesselDraughtM > depthAtDatumM;
  return (
    <li className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1">
          {berth}
          {vessel && <span className="text-muted-foreground"> · {vessel}</span>}
        </span>
        {(fromDate || toDate) && (
          <span className="shrink-0 text-xs text-muted-foreground">
            {[fromDate, toDate].filter(Boolean).join(" to ")}
          </span>
        )}
      </p>
      <p className="text-xs tabular-nums text-muted-foreground">
        {lengthLimitM !== undefined && `Up to ${lengthLimitM} m`}
        {lengthLimitM !== undefined && depthAtDatumM !== undefined ? " · " : ""}
        {depthAtDatumM !== undefined && `${depthAtDatumM} m at chart datum`}
      </p>
      {tooLong && (
        <p className="text-xs font-medium tabular-nums">
          The vessel is {vesselLengthM} m — too long for this berth.
        </p>
      )}
      {tooDeep && (
        <p className="text-xs font-medium tabular-nums">
          Draught {vesselDraughtM} m against {depthAtDatumM} m at datum — it only floats on the tide here.
        </p>
      )}
      {depthAtDatumM !== undefined && (
        <p className="text-xs text-muted-foreground">
          That depth is at chart datum. What is actually there is that plus the tide — check both.
        </p>
      )}
      {driesOut && <p className="text-xs font-medium">This berth dries out at low water.</p>}
      {services.length > 0 && <p className="text-xs text-muted-foreground">{services.join(" · ")}</p>}
      {overstaying && (
        <p className="text-xs font-medium">Overstaying — every arrival after this one has to move.</p>
      )}
    </li>
  );
}
