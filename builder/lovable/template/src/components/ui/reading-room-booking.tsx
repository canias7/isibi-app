import { cn } from "@/lib/utils";
/**
 * A seat booked in a reading room — with what has to be done beforehand.
 *
 * ORDERING MATERIAL IN ADVANCE IS THE PART PEOPLE MISS. Items come from a store
 * on a fixed schedule, and somebody who books a seat and orders on arrival sits
 * for three hours with nothing. The deadline is stated with the booking, not on
 * another page.
 *
 * THE READER'S TICKET REQUIREMENT IS SHOWN. Many archives require registration,
 * with identity documents, before anything can be produced — and a first-time
 * visitor who has booked a seat has not necessarily done it.
 *
 * WHAT MAY BE BROUGHT IN IS STATED. No bags, no pens, laptops yes, cameras
 * sometimes with a permit — these are surprising, non-obvious and enforced at
 * the door, and the whole trip depends on them.
 *
 * IT SHOWS WHAT HAS BEEN ORDERED FOR THE VISIT, since ordering and booking are
 * usually separate systems and nothing else confirms they match.
 */
export function ReadingRoomBooking({ room, when, seat, orderBy, ordered = [], needsReaderTicket, hasReaderTicket, rules = [], className }: {
  room: string;
  /** Free text — "Tuesday 12 August, 10:00 to 16:00". */
  when: string;
  seat?: string;
  /** Free text — "16:00 the day before". */
  orderBy?: string;
  /** What has been ordered for this visit. */
  ordered?: string[];
  needsReaderTicket?: boolean;
  hasReaderTicket?: boolean;
  /** What may and may not be brought in. */
  rules?: string[];
  className?: string;
}) {
  return (
    <div className={cn("space-y-1 text-sm", className)}>
      <p>
        <span className="font-medium">{room}</span>
        <span className="block">{when}</span>
        {seat && <span className="block text-xs text-muted-foreground">Seat {seat}</span>}
      </p>
      {needsReaderTicket && !hasReaderTicket && (
        <p className="text-xs font-medium">
          You need a reader's ticket before anything can be produced — register before you travel.
        </p>
      )}
      {ordered.length === 0 ? (
        <p className="text-xs font-medium">
          Nothing is ordered for this visit{orderBy ? ` — order by ${orderBy}` : ""}.
        </p>
      ) : (
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">Ordered for this visit</p>
          <ul className="text-xs">
            {ordered.map((o, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden="true" className="text-muted-foreground">—</span>
                <span>{o}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {rules.length > 0 && (
        <p className="text-xs text-muted-foreground">{rules.join(" · ")}</p>
      )}
    </div>
  );
}
