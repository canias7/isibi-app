import { cn } from "@/lib/utils";
/**
 * Adult, child, concession — and what a family ticket actually SAVES.
 *
 * THE SAVING IS COMPUTED, NEVER CLAIMED. "Family ticket £52 — save up to £15!"
 * is on every attraction's site in the country and almost none of them say
 * against what. Here the same people are priced individually from the rows
 * above and the difference is the number shown, so it cannot flatter itself and
 * it cannot go stale when a single ticket price changes.
 *
 * AND IT CAN COME OUT NEGATIVE, which is the whole reason to compute it. A
 * family of two adults and one child is very often CHEAPER bought separately
 * than as a "family of four" ticket, and this says so — "£4 more than buying
 * separately" — because a visitor who works that out at the gate has been
 * caught, and one who reads it here has been told.
 *
 * A CONCESSION IS DEFINED, not just priced. "Concession £9" with no note is a
 * price for a category nobody knows they are in; who qualifies is the useful
 * half, and carers going free is the thing most sites bury.
 *
 * BOOKING-AHEAD AND ON-THE-DAY ARE TWO COLUMNS where an attraction prices them
 * differently, because that gap is now routinely £3–5 and finding it at the
 * kiosk is the single most common complaint these places get.
 */
export type Admission = {
  /** "Adult", "Child 3–15", "Under 3", "Concession". */
  name: string;
  price: number;
  /** Price if booked ahead, where it differs. */
  advance?: number | null;
  /** Who qualifies. On a concession this is the important half. */
  note?: string | null;
};
export type FamilyTicket = {
  name: string;
  price: number;
  advance?: number | null;
  /** Which rows it is made of, by name and count — used to compute the saving. */
  covers: { name: string; count: number }[];
};
export function AdmissionPrices({
  tickets, family, currency = "GBP", locale = "en-GB", caption, note, className,
}: {
  tickets: Admission[];
  family?: FamilyTicket | null;
  currency?: string;
  locale?: string;
  caption?: string;
  note?: string;
  className?: string;
}) {
  if (!tickets.length) return null;
  const money = (n: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  const anyAdvance = tickets.some((t) => typeof t.advance === "number") || typeof family?.advance === "number";
  // Priced from the rows above, so it cannot flatter itself and cannot go stale.
  const separately = family
    ? family.covers.reduce((sum, c) => {
        const row = tickets.find((t) => t.name === c.name);
        return sum + (row ? row.price * c.count : 0);
      }, 0)
    : 0;
  const saving = family ? separately - family.price : 0;
  const known = !!family && family.covers.every((c) => tickets.some((t) => t.name === c.name));

  return (
    <div data-slot="admission-prices" className={cn("", className)}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          {caption && <caption className="pb-3 text-start text-xs font-medium uppercase tracking-widest text-muted-foreground">{caption}</caption>}
          <thead>
            <tr className="border-b border-border text-start text-xs uppercase tracking-widest text-muted-foreground">
              <th scope="col" className="py-2 pe-4 font-medium">Ticket</th>
              {anyAdvance && <th scope="col" className="py-2 pe-4 text-end font-medium">Booked ahead</th>}
              <th scope="col" className="py-2 text-end font-medium">On the day</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.name} className="border-b border-border/60 align-baseline">
                <th scope="row" className="py-3 pe-4 text-start font-[inherit]">
                  <span className="font-medium">{t.name}</span>
                  {t.note && <span className="block text-xs text-muted-foreground">{t.note}</span>}
                </th>
                {anyAdvance && (
                  <td className="py-3 pe-4 text-end tabular-nums">
                    {typeof t.advance === "number"
                      ? money(t.advance)
                      : <><span aria-hidden="true" className="text-muted-foreground">—</span><span className="sr-only">same either way</span></>}
                  </td>
                )}
                <td className="py-3 text-end tabular-nums">{money(t.price)}</td>
              </tr>
            ))}
            {family && (
              <tr className="border-b border-border/60 align-baseline">
                <th scope="row" className="py-3 pe-4 text-start font-[inherit]">
                  <span className="font-medium">{family.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {family.covers.map((c) => `${c.count} × ${c.name}`).join(" + ")}
                  </span>
                </th>
                {anyAdvance && (
                  <td className="py-3 pe-4 text-end tabular-nums">
                    {typeof family.advance === "number" ? money(family.advance) : "—"}
                  </td>
                )}
                <td className="py-3 text-end tabular-nums">{money(family.price)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {family && known && (
        /* IT CAN COME OUT NEGATIVE, and that is the point. A family of three is
           very often cheaper bought separately, and a visitor who works that
           out at the kiosk has been caught. */
        <p className="mt-3 text-sm">
          {saving > 0 ? (
            <>
              <span className="font-medium">Saves {money(saving)} </span>
              <span className="text-muted-foreground">against buying {family.covers.map((c) => `${c.count} × ${c.name.toLowerCase()}`).join(" + ")} separately.</span>
            </>
          ) : saving < 0 ? (
            <>
              <span className="font-medium">{money(-saving)} more than buying separately. </span>
              <span className="text-muted-foreground">Buy the individual tickets instead — the family ticket only wins with more children.</span>
            </>
          ) : (
            <span className="text-muted-foreground">Exactly the same as buying those tickets separately.</span>
          )}
        </p>
      )}
      {note && <p className="mt-2 text-sm text-muted-foreground">{note}</p>}
    </div>
  );
}
