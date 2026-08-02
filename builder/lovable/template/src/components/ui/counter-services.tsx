import { cn } from "@/lib/utils";
/**
 * What you can actually DO here — each with its own hours, where they differ.
 *
 * THE POST OFFICE COUNTER SHUTS AT 17:30 WHILE THE SHOP IS OPEN UNTIL 22:00,
 * and no shop in the country publishes that. It is the single most wasted
 * journey in a high street: somebody walks down with a parcel at seven in the
 * evening, the lights are on, the door opens, and the counter has been closed
 * for ninety minutes. One `opening-hours` table cannot say it, because the
 * premise of that component is that the business has one set of hours.
 *
 * `hours` IS OPTIONAL AND ITS ABSENCE MEANS "WHENEVER WE ARE OPEN". That is the
 * common case and spelling it out on every row would bury the two that differ —
 * which are the only rows anybody needs. A service that is always available
 * says so plainly rather than repeating the shop's times back at the reader.
 *
 * A PRICE IS OPTIONAL AND USUALLY ABSENT. Some counter services have one (key
 * cutting, passport photos, dry cleaning), most do not (parcel drop, PayPoint,
 * lottery), and a column of dashes teaches nobody anything. It is printed only
 * where there is one.
 *
 * WHAT IS NOT DONE HERE IS WORTH SAYING, via `stopped`. A shop that took dry
 * cleaning until March and no longer does gets asked every week, and a row
 * saying so out loud saves both sides the conversation — the same reason
 * `amenity-list` shows a broken shower rather than deleting it.
 */
export type CounterService = {
  what: string;
  /** Only where they DIFFER from the shop's. Absent means whenever we are open. */
  hours?: string | null;
  /** Already formatted — these are rarely simple numbers ("from £4", "£8.50 a pair"). */
  price?: string | null;
  detail?: string | null;
  /** No longer offered. Printed struck through and said in words, not removed. */
  stopped?: boolean;
};
export function CounterServices({
  services, heading = "What you can do here", note, className,
}: {
  services: CounterService[];
  heading?: string;
  note?: string;
  className?: string;
}) {
  if (!services.length) return null;
  return (
    <div className={cn("", className)}>
      <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{heading}</h2>
      <ul className="mt-3 divide-y divide-border border-y border-border">
        {services.map((s) => (
          <li key={s.what} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 py-3.5">
            <span className="min-w-0 flex-1">
              <span className={cn("text-base", s.stopped ? "text-muted-foreground line-through" : "font-medium")}>
                {s.what}
              </span>
              {s.stopped && <span className="block text-sm font-medium">We stopped doing this</span>}
              {s.detail && !s.stopped && (
                <span className="block text-sm leading-relaxed text-muted-foreground">{s.detail}</span>
              )}
            </span>
            {!s.stopped && (
              <span className="shrink-0 text-right">
                {/* THE HOURS ONLY WHERE THEY DIFFER. Repeating the shop's times
                    on every row buries the two rows that are the point. */}
                <span className={cn("block text-sm tabular-nums", s.hours ? "font-medium" : "text-muted-foreground")}>
                  {s.hours ?? "Whenever we are open"}
                </span>
                {s.price && <span className="block text-sm text-muted-foreground">{s.price}</span>}
              </span>
            )}
          </li>
        ))}
      </ul>
      {note && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{note}</p>}
    </div>
  );
}
