import { cn } from "@/lib/utils";
/**
 * How much was recycled — with what the figure does and does not count.
 *
 * THE DENOMINATOR IS THE WHOLE ARGUMENT. A rate measured against collected
 * waste and one measured against waste actually reprocessed differ by the
 * rejects, and quoting the first as the second is how a headline rate is
 * technically true and materially wrong.
 *
 * REJECTED TONNAGE IS SUBTRACTED, VISIBLY. Material collected for recycling and
 * then rejected at a sorting plant was not recycled, and a rate that counts it
 * is counting the bin rather than the outcome.
 *
 * WHAT IS EXCLUDED IS NAMED. Rates routinely leave out incineration with energy
 * recovery, exported material or rubble, and each exclusion moves the number by
 * several points.
 *
 * BARS CARRY THEIR FIGURES IN TEXT, and rows are spaced further apart than the
 * gap inside one — evenly spaced, each bar reads as belonging to the row
 * beneath it.
 */
export type WasteStream = { id: string; label: string; tonnes: number; rejectedTonnes?: number };

// A sentence-embedded list needs a conjunction, not a comma: "does not
// include rubble, waste burned for energy" reads as a truncated list.
// `Intl.ListFormat` also gets the separator right outside English.
const AND = new Intl.ListFormat("en", { style: "long", type: "conjunction" });

export function RecyclingRate({ streams, totalTonnes, period, excludes = [], className }: {
  streams: WasteStream[];
  /** All waste collected, the denominator. */
  totalTonnes?: number;
  period?: string;
  /** What the figure leaves out. */
  excludes?: string[];
  className?: string;
}) {
  const collected = streams.reduce((n, s) => n + s.tonnes, 0);
  const rejected = streams.reduce((n, s) => n + (s.rejectedTonnes ?? 0), 0);
  const reallyRecycled = collected - rejected;
  const denom = totalTonnes ?? collected;
  const pct = (v: number) =>
    new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 1 }).format(denom > 0 ? v / denom : 0);
  const max = Math.max(1, ...streams.map((s) => s.tonnes));
  return (
    <div data-slot="recycling-rate" className={cn("space-y-1.5", className)}>
      <p className="text-sm tabular-nums">
        <span className="font-medium">{pct(reallyRecycled)} recycled</span>
        {period && <span className="text-muted-foreground"> · {period}</span>}
      </p>
      <ul className="space-y-2.5">
        {streams.map((s) => (
          <li key={s.id} className="space-y-0.5">
            <p className="flex items-baseline gap-3 text-sm">
              <span className="min-w-0 flex-1">{s.label}</span>
              <span className="shrink-0 tabular-nums">{s.tonnes.toLocaleString()} t</span>
              {s.rejectedTonnes ? (
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {s.rejectedTonnes.toLocaleString()} t rejected
                </span>
              ) : null}
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full border border-border" aria-hidden="true">
              <span className="block h-full bg-foreground" style={{ width: `${(s.tonnes / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs tabular-nums text-muted-foreground">
        {collected.toLocaleString()} t collected for recycling
        {rejected > 0 && `, of which ${rejected.toLocaleString()} t was rejected at the sorting plant and did not get recycled`}
        {totalTonnes !== undefined && `. Measured against ${totalTonnes.toLocaleString()} t of waste altogether`}.
      </p>
      {excludes.length > 0 && (
        <p className="text-xs">This figure does not include {AND.format(excludes)}.</p>
      )}
    </div>
  );
}
