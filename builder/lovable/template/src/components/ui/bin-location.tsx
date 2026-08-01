import { cn } from "@/lib/utils";
/**
 * Where a thing is in the building — read out in the order somebody walks it.
 *
 * THE PARTS ARE SEPARATE, not one string. `A-12-3-B` is unreadable at speed and
 * unsortable; aisle, bay, level, position rendered as parts can be read aloud,
 * checked against a label, and sorted into a walking order by the caller.
 *
 * THE LEVEL IS CALLED OUT WHEN IT NEEDS EQUIPMENT. A pick at ground level and
 * one four metres up are different jobs — the second needs a truck and a second
 * person — and that is invisible in the code.
 *
 * A SECONDARY LOCATION IS SHOWN. Stock splits across bins constantly and a
 * picker sent to the primary finds two units where the system said twelve; the
 * overflow is where the rest is.
 *
 * IT IS NOT A BARCODE AND DOES NOT PRETEND TO BE. Rendering a fake barcode
 * image that no scanner reads is worse than the text, which a person can key.
 */
export function BinLocation({ aisle, bay, level, position, needsEquipment, alsoIn = [], className }: {
  aisle: string;
  bay?: string;
  level?: string;
  position?: string;
  /** True where the level is out of arm's reach. */
  needsEquipment?: boolean;
  /** Other bins holding the same item. */
  alsoIn?: string[];
  className?: string;
}) {
  const parts = [aisle, bay, level, position].filter(Boolean) as string[];
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-1.5 font-mono tabular-nums">
        {parts.map((p, i) => (
          <span key={i}>
            {p}
            {i < parts.length - 1 && <span className="text-muted-foreground"> ·</span>}
          </span>
        ))}
      </p>
      <p className="text-xs text-muted-foreground">
        Aisle {aisle}
        {bay && `, bay ${bay}`}
        {level && `, level ${level}`}
        {position && `, position ${position}`}
      </p>
      {needsEquipment && <p className="text-xs font-medium">Out of reach — a truck is needed.</p>}
      {alsoIn.length > 0 && (
        <p className="text-xs text-muted-foreground">Also held in {alsoIn.join(", ")}.</p>
      )}
    </div>
  );
}
