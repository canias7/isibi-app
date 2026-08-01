import { cn } from "@/lib/utils";
/**
 * A field — its official identifier, its area, and what is on it.
 *
 * THE OFFICIAL PARCEL IDENTIFIER IS THE PRIMARY KEY, not the farm name for it.
 * Every subsidy claim, inspection and map reference uses that code, and a
 * system keyed on "Top Field" cannot be reconciled with any of them — while
 * "Top Field" is what everybody actually says. Both are shown.
 *
 * ELIGIBLE AREA DIFFERS FROM TOTAL AREA and the difference is money. Tracks,
 * ponds, scrub and headlands are usually excluded from a claim, and claiming
 * the total is the commonest cause of a penalty.
 *
 * AREA CARRIES ITS UNIT EXPLICITLY. Hectares and acres differ by a factor of
 * 2.47, both are in daily use in the same countries, and a bare number is the
 * arithmetic error that reaches a subsidy form.
 *
 * NO MAP. A tile map needs a provider key and bills per load — the same refusal
 * `location-card` makes — and the parcel code is what an inspector asks for.
 */
export function LandParcel({ code, name, area, eligibleArea, unit = "ha", crop, tenure, className }: {
  /** The official parcel identifier. */
  code: string;
  /** What it is called locally. */
  name?: string;
  area: number;
  /** Area that counts for a claim. */
  eligibleArea?: number;
  unit?: string;
  /** What is growing on it. */
  crop?: string;
  /** "owned", "rented until 2029". */
  tenure?: string;
  className?: string;
}) {
  const excluded = eligibleArea !== undefined ? area - eligibleArea : null;
  return (
    <li className={cn("flex items-start gap-3 px-3 py-2 text-sm", className)}>
      <span className="min-w-0 flex-1">
        <span className="block">
          {name ?? code}
          {name && <code className="ml-1.5 font-mono text-xs text-muted-foreground">{code}</code>}
        </span>
        <span className="block text-xs text-muted-foreground">
          {crop ?? "Nothing recorded"}
          {tenure && ` · ${tenure}`}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block tabular-nums">
          {area.toLocaleString()} <span className="text-xs text-muted-foreground">{unit}</span>
        </span>
        {excluded !== null && excluded > 0 && (
          <span className="block text-xs tabular-nums text-muted-foreground">
            {eligibleArea!.toLocaleString()} eligible
          </span>
        )}
      </span>
    </li>
  );
}
