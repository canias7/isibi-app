import { cn } from "@/lib/utils";
/**
 * A soil test result, with the age that decides whether to trust it.
 *
 * SOIL TESTS GO OUT OF DATE AND NOBODY NOTICES. Most advice is written against
 * a test no older than four or five years, and a fertiliser plan built on a
 * nine-year-old sample is guesswork with a decimal point. The age is shown
 * before the numbers.
 *
 * pH IS SEPARATED FROM THE NUTRIENT INDICES because it gates them. Below the
 * target range, nutrients are present and unavailable — so applying more of
 * them is money spent on a problem that lime fixes. That ordering is the
 * agronomic point.
 *
 * INDICES ARE SHOWN WITH THEIR TARGET, since an index means nothing on its own
 * and the target differs by crop and by system. A number with no comparison is
 * a number nobody acts on.
 *
 * NO RECOMMENDATION. What to apply depends on the crop, the rotation, organic
 * manures and the rules in force, and a component producing a rate would be
 * confidently wrong and possibly illegal.
 */
export type SoilIndex = { nutrient: string; index: string; target?: string; low?: boolean };

export function SoilNote({ parcel, ph, phTarget, indices = [], sampledOn, ageYears, staleAfter = 5, className }: {
  parcel?: string;
  ph?: number;
  /** "6.5 to 7.0". */
  phTarget?: string;
  indices?: SoilIndex[];
  /** Free text — "March 2019". */
  sampledOn?: string;
  ageYears?: number;
  staleAfter?: number;
  className?: string;
}) {
  const stale = ageYears !== undefined && ageYears >= staleAfter;
  const phLow = ph !== undefined && phTarget ? ph < Number(phTarget.split(/[^\d.]+/).filter(Boolean)[0] ?? 0) : false;
  return (
    <div data-slot="soil-note" className={cn("space-y-1", className)}>
      <p className="text-sm">
        {parcel && <span className="font-medium">{parcel}</span>}
        {sampledOn && <span className="text-muted-foreground">{parcel ? " · " : ""}sampled {sampledOn}</span>}
      </p>
      {stale && (
        <p className="text-xs font-medium">
          {ageYears} years old — most advice assumes a test no more than {staleAfter} years old.
        </p>
      )}
      {ph !== undefined && (
        <p className="text-sm">
          <span className="text-muted-foreground">pH </span>
          <span className={cn("tabular-nums", phLow && "font-medium")}>{ph}</span>
          {phTarget && <span className="text-xs text-muted-foreground"> · target {phTarget}</span>}
          {phLow && (
            <span className="block text-xs font-medium">
              Below target — nutrients are there and the crop cannot reach them. Lime before adding more.
            </span>
          )}
        </p>
      )}
      {indices.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border text-sm">
          {indices.map((i) => (
            <li key={i.nutrient} className="flex items-baseline justify-between gap-3 px-3 py-1.5">
              <span>{i.nutrient}</span>
              <span className="shrink-0 text-end">
                <span className={cn("tabular-nums", i.low && "font-medium")}>{i.index}</span>
                {i.target && <span className="text-xs text-muted-foreground"> · target {i.target}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
