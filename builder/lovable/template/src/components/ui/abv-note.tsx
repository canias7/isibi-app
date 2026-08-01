import { cn } from "@/lib/utils";
/**
 * Strength, expressed as how much alcohol is actually in the glass.
 *
 * PERCENTAGE ALONE MISLEADS BECAUSE SERVING SIZES DIFFER ENORMOUSLY. A 12% wine
 * in a large glass contains more alcohol than a 5% beer in a half, and a label
 * showing only the percentage invites exactly the wrong comparison. The
 * component computes the alcohol per serve in millilitres, which is the thing
 * being compared.
 *
 * THE SERVING SIZE IS NAMED, because "a glass" is anything from 125 to 250 ml
 * and the difference is the whole answer.
 *
 * NO NATIONAL UNIT SYSTEM. Standard drinks differ by country by nearly a factor
 * of two — grams of ethanol, and how many make a "unit", are local conventions.
 * Pure alcohol per serve is the same number everywhere and needs no footnote.
 *
 * NO GUIDANCE ON HOW MUCH IS TOO MUCH. That is a health question that varies by
 * person and by country, and a component that answered it would be answering it
 * wrongly for most readers.
 */
export function AbvNote({ abvPercent, serveMl, serveName, alcoholFree, className }: {
  abvPercent: number;
  /** Named, because "a glass" is anything from 125 to 250. */
  serveMl?: number;
  serveName?: string;
  /** Below the threshold this producer treats as alcohol-free. */
  alcoholFree?: boolean;
  className?: string;
}) {
  // Pure alcohol in the glass, which is comparable across drinks and across
  // countries. A national "unit" is neither.
  const alcoholMl = serveMl !== undefined ? (serveMl * abvPercent) / 100 : undefined;
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p className="tabular-nums">
        <span className="font-medium">{abvPercent}% alcohol</span>
        {serveName && <span className="text-muted-foreground"> · {serveName}</span>}
        {serveMl !== undefined && <span className="text-muted-foreground"> ({serveMl} ml)</span>}
      </p>
      {alcoholMl !== undefined && (
        <p className="text-xs tabular-nums">
          That is {Math.round(alcoholMl * 10) / 10} ml of pure alcohol in the glass.
        </p>
      )}
      {serveMl !== undefined && (
        <p className="text-xs text-muted-foreground">
          Worth comparing that way rather than by percentage — the size of the serve changes it more than the strength
          does.
        </p>
      )}
      {alcoholFree && (
        <p className="text-xs text-muted-foreground">
          Sold as alcohol-free. What that threshold is differs by country, so it is not always zero.
        </p>
      )}
    </div>
  );
}
