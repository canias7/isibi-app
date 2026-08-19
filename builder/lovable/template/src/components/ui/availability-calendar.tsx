import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A month of NIGHTS, with the taken ones struck through and the rate on the
 * free ones.
 *
 * NIGHTS, NOT DAYS, AND THIS IS THE BUG ON EVERY SELF-CATERING SITE THERE IS.
 * A let is booked in nights: somebody arriving Friday and leaving Monday has
 * taken the Friday, Saturday and Sunday nights and NOT the Monday. A calendar
 * that shades whole days marks Monday busy, so the next guest cannot see the
 * changeover that is available to them — and it is off by one at the other end
 * too. Each cell here is the night beginning on that date, said in the legend
 * so nobody has to work it out.
 *
 * THE RATE IS ON THE NIGHT, not in a "from £95" line at the top. Rates move
 * with the season, half term and the weekend, and a single headline figure is
 * what makes somebody ring up cross about the quote. Printing it per night
 * costs nothing and removes the whole conversation.
 *
 * MINIMUM STAY IS SHOWN WHERE IT BITES. A three-night minimum in August is
 * invisible on almost every one of these sites until the booking form refuses,
 * which is the most annoying possible moment to find out.
 *
 * TAKEN IS STRUCK THROUGH AND ANNOUNCED, never a colour wash — the same
 * discipline as `tap-list` and `session-table`. Past nights are dimmed and
 * announced too, rather than removed, because a month with holes in it reads
 * as broken.
 */
export type Night = {
  /** The date the night BEGINS: "2026-08-14". */
  date: string;
  taken?: boolean;
  /** Per night, in whole or fractional units of `currency`. */
  rate?: number | null;
  /** Minimum nights if you start here. Shown only when above 1. */
  minNights?: number | null;
};
const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export function AvailabilityCalendar({
  nights, month, onMonth, currency = "GBP", locale = "en-GB", now, priceNote, className,
}: {
  nights: Night[];
  /** "2026-08". Controlled when supplied; otherwise it manages its own. */
  month?: string;
  onMonth?: (m: string) => void;
  currency?: string;
  locale?: string;
  /** Injectable clock, so a test can fix "today". */
  now?: Date;
  /**
   * WHAT THE RATE COVERS. A holiday let prices the whole property; a kennel
   * prices one animal of a given size, a mooring prices a berth. Baked in, the
   * legend states something false on every calendar that is not a let — and a
   * legend that is wrong is worse than none, because it is read as authority.
   */
  priceNote?: string;
  className?: string;
}) {
  const today = now ?? new Date();
  const iso = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}`;
  const [ownMonth, setOwnMonth] = React.useState(iso(today.getFullYear(), today.getMonth()));
  const shown = month ?? ownMonth;
  const setMonth = (m: string) => (onMonth ? onMonth(m) : setOwnMonth(m));
  const [y, m] = shown.split("-").map(Number);
  const year = y || today.getFullYear();
  const mon = (m || 1) - 1;

  const byDate = new Map(nights.map((n) => [n.date, n]));
  const first = new Date(year, mon, 1);
  // Monday-first: getDay() is 0 for Sunday, so Sunday becomes 6.
  const lead = (first.getDay() + 6) % 7;
  const count = new Date(year, mon + 1, 0).getDate();
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

  const money = (n: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  const step = (by: number) => {
    const d = new Date(year, mon + by, 1);
    setMonth(iso(d.getFullYear(), d.getMonth()));
  };
  const title = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(first);

  return (
    <div className={cn("", className)}>
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        <div className="flex gap-2">
          <button type="button" onClick={() => step(-1)} aria-label="Previous month"
            className="rounded-md border border-border px-3 py-1.5 text-sm">←</button>
          <button type="button" onClick={() => step(1)} aria-label="Next month"
            className="rounded-md border border-border px-3 py-1.5 text-sm">→</button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs uppercase tracking-widest text-muted-foreground">
        {WEEK.map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: lead }, (_, i) => <div key={`pad${i}`} aria-hidden="true" />)}
        {Array.from({ length: count }, (_, i) => {
          const day = i + 1;
          const key = `${year}-${String(mon + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const n = byDate.get(key);
          const past = new Date(year, mon, day).getTime() < midnight;
          const taken = !!n?.taken;
          const free = !past && !taken && !!n;
          return (
            <div
              key={key}
              className={cn(
                "min-h-16 rounded-md p-1.5 text-start",
                // A PAST NIGHT RECEDES RATHER THAN LABELS ITSELF. It carries no
                // price and no "Booked", so bordered like the rest it reads as
                // an unexplained empty square — but a fortnight of cells each
                // saying "Past" is noise that buries the ones that matter.
                // Borderless and faded takes it out of the choice on sight.
                past ? "opacity-40" : "border",
                !past && (free ? "border-border" : "border-border/50"),
                taken && "text-muted-foreground",
              )}
            >
              <span className={cn("text-sm tabular-nums", taken && "line-through")}>{day}</span>
              {past ? (
                <span className="sr-only"> — in the past</span>
              ) : taken ? (
                <>
                  <span className="sr-only"> — booked</span>
                  <span aria-hidden="true" className="mt-1 block text-[11px] leading-tight">Booked</span>
                </>
              ) : n ? (
                <>
                  {typeof n.rate === "number" && (
                    <span className="mt-1 block text-[11px] leading-tight tabular-nums">{money(n.rate)}</span>
                  )}
                  {typeof n.minNights === "number" && n.minNights > 1 && (
                    <span className="mt-0.5 block text-[11px] leading-tight text-muted-foreground">
                      min {n.minNights}
                      <span className="sr-only"> nights if you arrive on this date</span>
                    </span>
                  )}
                </>
              ) : (
                <span className="sr-only"> — not listed</span>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Each square is the night beginning on that date, so a Friday-to-Monday stay is the Friday,
        Saturday and Sunday. {priceNote ?? "Prices are per night for the whole property."}
      </p>
    </div>
  );
}
