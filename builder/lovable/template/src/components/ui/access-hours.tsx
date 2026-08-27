import { cn } from "@/lib/utils";
/**
 * When somebody can actually get in — which is not the opening hours.
 *
 * BUILDING ACCESS AND STAFFED HOURS ARE DIFFERENT AND BOTH ARE SHOWN. A member
 * with a fob can be in the building at six in the morning with nobody there to
 * let them into a locked meeting room, sign for a parcel or fix the door. Listing
 * one set of hours answers whichever question the reader did not have.
 *
 * IT SAYS WHAT IS UNAVAILABLE OUT OF HOURS rather than implying full access.
 * Reception, the post room and the good coffee machine being shut is exactly what
 * somebody planning an early start needs to know.
 *
 * RIGHT NOW IS ANSWERED FIRST. Anybody reading this is usually standing outside
 * a door, and the schedule below is the reference; the sentence at the top is
 * the answer.
 *
 * NO TIME-ZONE GUESSING. The hours are the building's, stated in the building's
 * own terms, because a coworking space is a physical place and its clock is the
 * one on the wall.
 */
export type AccessDay = { id: string; day: string; access?: string; staffed?: string };

export function AccessHours({ days, openNow, staffedNow, unavailableOutOfHours = [], className }: {
  days: AccessDay[];
  openNow?: boolean;
  /** Different question from whether the door opens. */
  staffedNow?: boolean;
  unavailableOutOfHours?: string[];
  className?: string;
}) {
  const AND = new Intl.ListFormat("en", { style: "long", type: "conjunction" });
  return (
    <div data-slot="access-hours" className={cn("space-y-1.5 text-sm", className)}>
      <p className="font-medium">
        {openNow === false
          ? "The building is locked right now."
          : staffedNow === false
            ? "You can get in, but there is nobody on reception."
            : "Open, and there is somebody on reception."}
      </p>
      {openNow !== false && staffedNow === false && unavailableOutOfHours.length > 0 && (
        <p className="text-xs">Not available until reception opens: {AND.format(unavailableOutOfHours)}.</p>
      )}
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {days.map((d) => (
          <li key={d.id} className="flex items-baseline gap-3 px-3 py-1.5">
            <span className="min-w-0 flex-1">{d.day}</span>
            {/* `??` is not enough: an empty string is the natural way to say "no
                access that day", and it is not nullish, so the row rendered
                blank — which reads as data missing rather than as closed. */}
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {d.access?.trim() ? d.access : "closed"}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Those are the hours your pass works. Reception is staffed for a shorter window —
        {days.some((d) => d.staffed) ? ` ${days.filter((d) => d.staffed).map((d) => `${d.day} ${d.staffed}`).join(", ")}.` : " ask if you need somebody there."}
      </p>
    </div>
  );
}
