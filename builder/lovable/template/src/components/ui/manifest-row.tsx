import { cn } from "@/lib/utils";
/**
 * A line on a manifest — with the weight and the dangerous-goods status.
 *
 * DANGEROUS GOODS ARE FLAGGED WITH THEIR CLASS AND THEIR PAPERWORK. An
 * undeclared dangerous item is the single worst thing that goes on an aircraft
 * or a ship, and a manifest that treats it as ordinary freight is how it
 * happens.
 *
 * THE WEIGHT AND ITS BASIS ARE BOTH SHOWN. Declared, actual and volumetric
 * weights differ, loading is planned on one of them, and using the wrong one
 * puts a vehicle out of trim.
 *
 * A LINE WITHOUT A CONSIGNEE IS UNDELIVERABLE and is marked. It is a
 * surprisingly common state and is only ever noticed at the destination, which
 * is the most expensive place to notice it.
 *
 * PIECES AND WEIGHT ARE BOTH CARRIED, because a load is constrained by both and
 * one number cannot say which limit is binding.
 */
export function ManifestRow({ reference, description, pieces, weightKg, weightBasis = "actual", consignee, dangerousClass, unNumber, paperworkComplete, className }: {
  reference?: string;
  description: string;
  pieces?: number;
  weightKg?: number;
  /** "declared", "actual", "volumetric". */
  weightBasis?: string;
  /** Undefined means undeliverable. */
  consignee?: string;
  /** The hazard class, where it is dangerous goods. */
  dangerousClass?: string;
  unNumber?: string;
  /** Whether the dangerous-goods declaration is in place. */
  paperworkComplete?: boolean;
  className?: string;
}) {
  const dg = Boolean(dangerousClass || unNumber);
  return (
    <li className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1">
          {description}
          {reference && <span className="block font-mono text-xs text-muted-foreground">{reference}</span>}
        </span>
        <span className="shrink-0 tabular-nums text-muted-foreground">
          {pieces !== undefined && `${pieces} ${pieces === 1 ? "piece" : "pieces"}`}
          {pieces !== undefined && weightKg !== undefined ? " · " : ""}
          {weightKg !== undefined && `${weightKg.toLocaleString()} kg ${weightBasis}`}
        </span>
      </p>
      <p className={cn("text-xs", consignee ? "text-muted-foreground" : "font-medium")}>
        {consignee ? `To ${consignee}` : "No consignee — this cannot be delivered at the far end."}
      </p>
      {dg && (
        <p className={cn("text-xs", paperworkComplete ? "" : "font-medium")}>
          Dangerous goods
          {dangerousClass && ` · class ${dangerousClass}`}
          {unNumber && ` · ${unNumber}`}
          {!paperworkComplete && " — the declaration is not complete. This must not be loaded."}
        </p>
      )}
    </li>
  );
}
