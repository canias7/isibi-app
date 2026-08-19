import { cn } from "@/lib/utils";
/**
 * How big is big enough, expressed in furniture rather than in square feet.
 *
 * NOBODY CAN PICTURE 50 SQUARE FEET. They can picture a garden shed, a
 * one-bedroom flat, or a garage with a car in it — and every self-storage
 * enquiry in the world begins with somebody guessing wrong in one direction or
 * the other. Getting it wrong costs the customer a second trip or a year of
 * paying for air, so the equivalence IS the product information and the number
 * is the footnote.
 *
 * THE BAR IS DRAWN FROM THE AREA, so the sizes are comparable at a glance
 * without anybody reading a figure. It is a proportion of the largest row,
 * computed here rather than passed, because a hand-set width and a stated area
 * drift apart the moment somebody adds a size — the `league-table` rule again.
 * It is decoration over the words, not instead of them: the row reads correctly
 * with the bar removed entirely.
 *
 * `alsoFits` IS A SECOND, MESSIER LIST on purpose — "a 3-seat sofa, a double
 * bed and about 30 boxes" is what somebody checks their own pile against, and
 * it is what the single-sentence version cannot carry.
 */
export type Size = {
  name: string;
  /** Square feet, metres, whatever the site quotes. Used for the bar. */
  area: number;
  areaLabel: string;
  /** The one-line equivalence: "A large garden shed". */
  like: string;
  /** The messier list people check their own pile against. */
  alsoFits?: string[];
  /** "£58 a month" — already formatted, since this is a guide not a price list. */
  price?: string | null;
};
export function SizeGuide({ sizes, caption, className }: {
  sizes: Size[];
  caption?: string;
  className?: string;
}) {
  if (!sizes.length) return null;
  const biggest = Math.max(...sizes.map((s) => s.area || 0), 1);
  return (
    <div className={cn("", className)}>
      {caption && <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{caption}</p>}
      <ul className={cn("divide-y divide-border border-y border-border", caption && "mt-3")}>
        {sizes.map((s) => (
          <li key={s.name} className="py-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="text-lg font-medium">{s.name}</h3>
              <p className="text-sm tabular-nums text-muted-foreground">
                {s.areaLabel}
                {s.price && <span className="ms-3 font-medium text-foreground">{s.price}</span>}
              </p>
            </div>
            {/* Decoration over the words, never instead of them — remove this
                div and every row still says everything it needs to. */}
            <div aria-hidden="true" className="mt-2 h-1.5 rounded-full bg-muted">
              <div className="h-full rounded-full bg-foreground/70"
                style={{ width: `${Math.max(4, Math.round((s.area / biggest) * 100))}%` }} />
            </div>
            <p className="mt-3 text-base">{s.like}</p>
            {s.alsoFits && s.alsoFits.length > 0 && (
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Or: {s.alsoFits.join(" · ")}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
