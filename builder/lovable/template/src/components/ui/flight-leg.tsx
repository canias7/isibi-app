import { cn } from "@/lib/utils";
/**
 * One leg of a journey — with the connection risk stated.
 *
 * A CONNECTION SHORTER THAN THE AIRPORT'S MINIMUM IS FLAGGED. It is knowable at
 * booking, it is the single largest cause of a missed onward flight, and an
 * itinerary that merely lists times leaves the passenger to work it out.
 *
 * A CHANGE OF AIRPORT IS NOT A CONNECTION. Arriving at one airport and departing
 * from another in the same city is an hour of ground travel and usually a
 * separate ticket, and rendering it as an ordinary connection is how people miss
 * flights.
 *
 * SEPARATE TICKETS ARE DISCLOSED. On one ticket a missed connection is the
 * airline's problem; on two it is the passenger's, and that distinction is worth
 * more than every other field here.
 *
 * TIMES ARE LOCAL AND SAY SO. An itinerary crossing time zones with unlabelled
 * times is the classic way a day is lost.
 */
export function FlightLeg({ flightNumber, carrier, from, to, departs, arrives, terminalFrom, terminalTo, connectionMinutes, minimumConnectionMinutes, changesAirport, separateTicket, nextDay, className }: {
  flightNumber?: string;
  carrier?: string;
  from: string;
  to: string;
  /** Free text, local time — "08:40". */
  departs?: string;
  arrives?: string;
  terminalFrom?: string;
  terminalTo?: string;
  /** Time until the next leg. */
  connectionMinutes?: number;
  /** The airport's published minimum. */
  minimumConnectionMinutes?: number;
  /** True where the next leg leaves from a different airport. */
  changesAirport?: boolean;
  /** True where this leg is on a different ticket. */
  separateTicket?: boolean;
  /** True where arrival is the following day. */
  nextDay?: boolean;
  className?: string;
}) {
  const tight =
    connectionMinutes !== undefined &&
    minimumConnectionMinutes !== undefined &&
    connectionMinutes < minimumConnectionMinutes;
  return (
    <li data-slot="flight-leg" className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1">
          {from} <span aria-hidden="true">→</span> {to}
          {(carrier || flightNumber) && (
            <span className="block text-xs text-muted-foreground">
              {[carrier, flightNumber].filter(Boolean).join(" ")}
            </span>
          )}
        </span>
        <span className="shrink-0 tabular-nums">
          {departs}
          {departs && arrives ? " – " : ""}
          {arrives}
          {nextDay && <span className="text-xs"> +1</span>}
        </span>
      </p>
      {(terminalFrom || terminalTo) && (
        <p className="text-xs text-muted-foreground">
          {terminalFrom && `Terminal ${terminalFrom}`}
          {terminalFrom && terminalTo ? " to " : ""}
          {terminalTo && `terminal ${terminalTo}`}
        </p>
      )}
      <p className="text-xs text-muted-foreground">All times are local to each airport.</p>
      {connectionMinutes !== undefined && (
        <p className={cn("text-xs tabular-nums", tight || changesAirport ? "font-medium" : "text-muted-foreground")}>
          {Math.floor(connectionMinutes / 60)}h {connectionMinutes % 60}m to the next leg
          {tight && minimumConnectionMinutes !== undefined &&
            ` — under the ${minimumConnectionMinutes}-minute minimum here`}
        </p>
      )}
      {changesAirport && (
        <p className="text-xs font-medium">
          The next leg goes from a different airport. That is a journey, not a connection.
        </p>
      )}
      {separateTicket && (
        <p className="text-xs font-medium">
          On a separate ticket — if you miss it, that is yours to sort out, not the airline's.
        </p>
      )}
    </li>
  );
}
