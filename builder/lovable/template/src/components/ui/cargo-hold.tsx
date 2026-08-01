import { cn } from "@/lib/utils";
/**
 * How a hold is loaded — against weight, volume and the balance limits.
 *
 * WEIGHT AND VOLUME BIND SEPARATELY and a hold can be full on either. Insulation
 * fills a hold at a fraction of its weight limit; steel hits the weight limit
 * with the hold half empty. A single "full" figure is wrong for one of them, and
 * that is the one somebody is loading now.
 *
 * THE CENTRE OF GRAVITY IS THE THIRD LIMIT AND IS THE ONE THAT MATTERS MOST.
 * A load within weight and volume can still be out of trim, which is a
 * different and more serious failure than being heavy. The caller supplies the
 * limits; the component reports the position.
 *
 * SEGREGATION IS CHECKED AS A LIST OF PAIRS. Dangerous goods that must not
 * travel together are a rule about combinations, not about individual items, and
 * an item-by-item check cannot see it.
 *
 * OVER A LIMIT IS SHOWN AS A FIGURE, because "180 kg over" is an instruction and
 * "over capacity" is a shrug.
 */
export function CargoHold({ hold, weightKg, weightLimitKg, volumeM3, volumeLimitM3, cgPosition, cgForwardLimit, cgAftLimit, segregationConflicts = [], className }: {
  hold: string;
  weightKg?: number;
  weightLimitKg?: number;
  volumeM3?: number;
  volumeLimitM3?: number;
  /** Where the centre of gravity sits, in the caller's units. */
  cgPosition?: number;
  cgForwardLimit?: number;
  cgAftLimit?: number;
  /** Pairs that must not travel together. */
  segregationConflicts?: [string, string][];
  className?: string;
}) {
  const overWeight = weightKg !== undefined && weightLimitKg !== undefined && weightKg > weightLimitKg;
  const overVolume = volumeM3 !== undefined && volumeLimitM3 !== undefined && volumeM3 > volumeLimitM3;
  const outOfTrim =
    cgPosition !== undefined &&
    ((cgForwardLimit !== undefined && cgPosition < cgForwardLimit) ||
      (cgAftLimit !== undefined && cgPosition > cgAftLimit));
  const bar = (share: number, over: boolean) => (
    <div aria-hidden="true" className="h-1.5 w-full overflow-hidden rounded-full border border-border">
      <span
        className={cn("block h-full", over
          ? "bg-[repeating-linear-gradient(45deg,var(--color-foreground)_0_3px,transparent_3px_6px)]"
          : "bg-foreground")}
        style={{ width: `${Math.min(100, share * 100)}%` }}
      />
    </div>
  );
  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm font-medium">{hold}</p>
      {weightKg !== undefined && weightLimitKg !== undefined && (
        <div className="space-y-1">
          <p className="flex items-baseline gap-3 text-sm">
            <span className="min-w-0 flex-1 text-muted-foreground">Weight</span>
            <span className={cn("shrink-0 tabular-nums", overWeight && "font-medium")}>
              {weightKg.toLocaleString()} of {weightLimitKg.toLocaleString()} kg
            </span>
          </p>
          {bar(weightKg / weightLimitKg, overWeight)}
        </div>
      )}
      {volumeM3 !== undefined && volumeLimitM3 !== undefined && (
        <div className="space-y-1">
          <p className="flex items-baseline gap-3 text-sm">
            <span className="min-w-0 flex-1 text-muted-foreground">Volume</span>
            <span className={cn("shrink-0 tabular-nums", overVolume && "font-medium")}>
              {volumeM3} of {volumeLimitM3} m³
            </span>
          </p>
          {bar(volumeM3 / volumeLimitM3, overVolume)}
        </div>
      )}
      {overWeight && weightKg !== undefined && weightLimitKg !== undefined && (
        <p className="text-xs font-medium tabular-nums">
          {(weightKg - weightLimitKg).toLocaleString()} kg over the weight limit.
        </p>
      )}
      {overVolume && volumeM3 !== undefined && volumeLimitM3 !== undefined && (
        <p className="text-xs font-medium tabular-nums">
          {Number((volumeM3 - volumeLimitM3).toFixed(2))} m³ more than the hold holds.
        </p>
      )}
      {cgPosition !== undefined && (
        <p className={cn("text-xs tabular-nums", outOfTrim ? "font-medium" : "text-muted-foreground")}>
          Centre of gravity at {cgPosition}
          {cgForwardLimit !== undefined && cgAftLimit !== undefined && ` · limits ${cgForwardLimit} to ${cgAftLimit}`}
          {outOfTrim && " — out of trim. This is not a weight problem and it is worse than one."}
        </p>
      )}
      {segregationConflicts.map(([a, b], i) => (
        <p key={i} className="text-xs font-medium">
          {a} and {b} must not travel in the same hold.
        </p>
      ))}
    </div>
  );
}
