import { cn } from "@/lib/utils";
/**
 * Dangerous goods on a shipment — the classification and what it forbids.
 *
 * THE RESTRICTIONS ARE THE POINT, not the class number. A class on its own
 * means nothing to the person booking the transport; "cannot go by air" and
 * "cannot be loaded with foodstuffs" are the facts that change what they do,
 * and they are what a driver and a warehouse need.
 *
 * THE PACKING GROUP IS SHOWN because it changes the packaging and the
 * quantity thresholds — the same substance in a different group has different
 * paperwork, and the class alone hides that.
 *
 * LIMITED-QUANTITY EXEMPTIONS ARE FLAGGED. Small packages of many substances
 * travel under a lighter regime, and not knowing that means paying for full
 * dangerous-goods handling on a shipment that does not need it.
 *
 * THE CLASS PROP IS `hazardClass`, NOT `class`. Naming it after the domain term
 * would collide with `className` — one component in this kit is not worth a
 * prop that shadows the styling hook every other one uses.
 *
 * NO PICTOGRAMS. Diamond labels are prescribed artwork with legal meaning, and
 * a hand-drawn approximation on a screen is both wrong and potentially
 * misleading — the words carry it.
 */
export function HazardClass({ unNumber, hazardClass, packingGroup, properName, restrictions = [], limitedQuantity, className }: {
  /** The UN number. */
  unNumber?: string;
  /** The hazard class — "3", "8". */
  hazardClass?: string;
  packingGroup?: string;
  /** The proper shipping name. */
  properName?: string;
  /** What it forbids. */
  restrictions?: string[];
  limitedQuantity?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1 text-sm", className)}>
      <p>
        {properName && <span className="font-medium">{properName}</span>}
        <span className="block text-xs text-muted-foreground">
          {unNumber && <code className="font-mono">UN {unNumber}</code>}
          {unNumber && hazardClass ? " · " : ""}
          {hazardClass && <span>Class {hazardClass}</span>}
          {packingGroup && <span> · packing group {packingGroup}</span>}
        </span>
      </p>
      {restrictions.length > 0 && (
        <ul className="space-y-0.5 text-xs">
          {restrictions.map((r) => (
            <li key={r} className="flex gap-2">
              <span aria-hidden="true" className="text-muted-foreground">·</span>
              <span className="font-medium">{r}</span>
            </li>
          ))}
        </ul>
      )}
      {limitedQuantity && (
        <p className="text-xs text-muted-foreground">
          Travelling as a limited quantity — lighter handling rules apply.
        </p>
      )}
    </div>
  );
}
