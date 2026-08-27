import { cn } from "@/lib/utils";

/**
 * The next departures. For a bus, a ferry, a park-and-ride or a community
 * transport service, this IS the product — everything else on the site is
 * supporting material.
 *
 * AN EXPECTED TIME BEATS THE WORD "DELAYED". A board saying "delayed" tells
 * somebody to keep standing there indefinitely, which is what makes people
 * angry; "14:23" lets them go and buy a coffee. So `expected` is printed
 * whenever it differs from `time`, and the scheduled time stays visible beside
 * it — struck through — because a passenger comparing against a printed
 * timetable needs both.
 *
 * A CANCELLED SERVICE STAYS ON THE BOARD. Removing it is how somebody stands
 * waiting for a bus that was never coming, checking a timetable that still
 * lists it. Real boards keep the row and so does this one, struck through and
 * labelled.
 *
 * NO COLOUR. A departure board is read at a distance, in daylight, sometimes
 * printed and stuck in a bus shelter, and by people who cannot distinguish red
 * from green. State is carried by the word and by the strikethrough.
 *
 * `stand` is optional because a village stop has one and an interchange has
 * twenty — an absent stand renders as nothing rather than as a blank column.
 */
export type Departure = {
  /** Scheduled, as printed on the timetable. "14:15". */
  time: string;
  destination: string;
  /** "via Oughtibridge, Wharncliffe Side". */
  via?: string | null;
  /** Stand, bay or platform. Omitted where there is only one. */
  stand?: string | null;
  status: "on-time" | "expected" | "cancelled";
  /** Required when status is "expected". "14:23". */
  expected?: string | null;
  /** "Wheelchair space taken", "School days only". */
  note?: string | null;
};

const WORD = { "on-time": "On time", expected: "Expected", cancelled: "Cancelled" };

export function DepartureBoard({ departures, from, updatedAt, className }: {
  departures: Departure[];
  /** Where these depart FROM. A board with no origin is a board for nowhere. */
  from: string;
  /** "14:02" — when this was last refreshed. A live board that cannot say is not a live board. */
  updatedAt?: string;
  className?: string;
}) {
  if (!departures.length) {
    return (
      <div data-slot="departure-board" className={cn("rounded-xl border border-border p-6", className)}>
        <p className="font-medium">No more departures today</p>
        <p className="mt-1 text-sm text-muted-foreground">
          From {from}. The first tomorrow is on the timetable.
        </p>
      </div>
    );
  }
  return (
    <div className={cn("rounded-xl border border-border font-mono", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3">
        <p className="text-sm font-medium">{from}</p>
        {updatedAt && <p className="text-xs text-muted-foreground">Updated {updatedAt}</p>}
      </div>
      <ul className="divide-y divide-border">
        {departures.map((d, i) => (
          <li key={`${d.time}-${d.destination}-${i}`} className="px-4 py-3">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span className={cn("tabular-nums", d.status === "cancelled" && "line-through decoration-1")}>
                {d.time}
              </span>
              {d.status === "expected" && d.expected && (
                <span className="font-semibold tabular-nums">{d.expected}</span>
              )}
              <span className={cn("min-w-0 flex-1 font-sans", d.status === "cancelled" && "line-through decoration-1")}>
                {d.destination}
                {d.via && <span className="text-muted-foreground"> {d.via}</span>}
              </span>
              {d.stand && <span className="text-xs text-muted-foreground">Stand {d.stand}</span>}
              <span className={cn("text-xs font-sans", d.status === "on-time" ? "text-muted-foreground" : "font-medium")}>
                {WORD[d.status]}
              </span>
            </div>
            {d.note && <p className="mt-1 font-sans text-xs text-muted-foreground">{d.note}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
