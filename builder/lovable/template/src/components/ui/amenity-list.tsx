import { cn } from "@/lib/utils";
/**
 * What a space has — with the ones that are out of order shown, not hidden.
 *
 * A BROKEN AMENITY IS LISTED AS BROKEN RATHER THAN REMOVED. Removing it makes
 * the list look complete while the member arrives expecting a shower that has
 * been out for a fortnight. The honest list is the one that keeps somebody from
 * making the journey.
 *
 * WHAT IS SHARED AND WHAT IS BOOKABLE ARE DIFFERENT KINDS OF THING. A phone
 * booth you have to book and one you can walk into are entirely different to
 * plan around, and they sit in the same list everywhere.
 *
 * ACCESSIBILITY FEATURES ARE IN THE SAME LIST, NOT A SEPARATE PANEL. A step-free
 * entrance and an accessible toilet are amenities somebody needs in order to
 * decide, and putting them behind a link makes them harder to find for exactly
 * the people looking.
 *
 * NO ICON-ONLY ROWS. A pictogram of a shower is unreadable to a screen reader
 * and ambiguous to everybody else; the words are shorter than explaining them.
 */
export type Amenity = {
  id: string;
  what: string;
  /** Has to be booked rather than walked into. */
  bookable?: boolean;
  outOfOrder?: boolean;
  /** Back by. */
  backOn?: string;
  note?: string;
};

export function AmenityList({ amenities, className }: { amenities: Amenity[]; className?: string }) {
  const broken = amenities.filter((a) => a.outOfOrder);
  return (
    <div className={cn("space-y-1.5", className)}>
      {broken.length > 0 && (
        <p className="text-sm font-medium">
          Out of order: {broken.map((a) => a.what).join(", ")}.
        </p>
      )}
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {amenities.map((a) => (
          <li key={a.id} className="flex items-baseline gap-3 px-3 py-1.5">
            <span className={cn("min-w-0 flex-1", a.outOfOrder && "text-muted-foreground")}>
              {a.what}
              {(a.note || a.backOn) && (
                <span className="block text-xs text-muted-foreground">
                  {[a.note, a.backOn && `back ${a.backOn}`].filter(Boolean).join(" · ")}
                </span>
              )}
            </span>
            <span className={cn("shrink-0 text-xs", a.outOfOrder ? "font-medium" : "text-muted-foreground")}>
              {a.outOfOrder ? "Out of order" : a.bookable ? "Book it" : "Walk in"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
