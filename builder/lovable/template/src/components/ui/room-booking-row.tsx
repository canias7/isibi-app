import { cn } from "@/lib/utils";
/**
 * A room booked — with the setup and clear-down time it really occupies.
 *
 * THE BUFFER IS PART OF THE BOOKING AND IS SHOWN. A room booked 14:00–15:00 is
 * unavailable from about 13:50 to 15:10 in practice, and a schedule that ignores
 * that produces back-to-back bookings which collide in the doorway. Showing the
 * real occupied window is what makes the next slot honest.
 *
 * THE ORGANISER IS NAMED, NOT THE ACCOUNT. Bookings are made by whoever has the
 * login, and a room list showing "Operations Team" tells nobody who to ask when
 * a meeting overruns.
 *
 * CAPACITY IS COMPARED WITH ATTENDEES. Twelve people booked into a room for six
 * is the commonest cause of a meeting moving at the last minute, and both
 * numbers are usually a click apart on separate screens.
 *
 * A RECURRING BOOKING SAYS SO ON EVERY INSTANCE. Cancelling one occurrence and
 * cancelling the series are different actions, and somebody who does not know
 * this is a series will pick the wrong one.
 */
export function RoomBookingRow({ room, from, to, setupMinutes = 0, clearMinutes = 0, organiser, attendees, capacity, recurring, className }: {
  room: string;
  /** "14:00". */
  from: string;
  to: string;
  /** Time before, when the room is really occupied. */
  setupMinutes?: number;
  clearMinutes?: number;
  /** A person, not an account. */
  organiser?: string;
  attendees?: number;
  capacity?: number;
  recurring?: boolean;
  className?: string;
}) {
  const shift = (t: string, mins: number) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
    if (!m) return t;
    const total = ((Number(m[1]) * 60 + Number(m[2]) + mins) % 1440 + 1440) % 1440;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  };
  const realFrom = shift(from, -setupMinutes);
  const realTo = shift(to, clearMinutes);
  const over = attendees !== undefined && capacity !== undefined && attendees > capacity;
  return (
    <li data-slot="room-booking-row" className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 font-medium">{room}</span>
        <span className="shrink-0 tabular-nums">
          {from}–{to}
        </span>
      </p>
      {(setupMinutes > 0 || clearMinutes > 0) && (
        <p className="text-xs tabular-nums text-muted-foreground">
          Really unavailable {realFrom}–{realTo}, with setting up and clearing.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {[
          organiser,
          attendees !== undefined && `${attendees} ${attendees === 1 ? "person" : "people"}`,
          capacity !== undefined && `room takes ${capacity}`,
          recurring && "part of a series",
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {over && (
        <p className="text-xs font-medium tabular-nums">
          {attendees} booked into a room for {capacity}. Somebody will be standing.
        </p>
      )}
      {recurring && (
        <p className="text-xs text-muted-foreground">
          This repeats. Cancelling this one is not the same as cancelling the series.
        </p>
      )}
    </li>
  );
}
