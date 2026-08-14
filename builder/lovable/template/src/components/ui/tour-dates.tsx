import { DateFormat } from "@/components/ui/date-format";
import { cn } from "@/lib/utils";
/**
 * Where and when. A tour, a fixture list, a run of workshops.
 *
 * PAST DATES ARE DROPPED BY DEFAULT, which is the one decision this component
 * really makes. A list that opens on last March is the commonest fault in this
 * pattern — the reader has to scroll past history to find out whether anything
 * is coming, and on a phone that is most of a screen of nothing. `showPast`
 * brings them back, dimmed and labelled, for the archive case.
 *
 * SOLD OUT IS STRUCK THROUGH AND SAID IN WORDS, and the row stays. Removing it
 * makes somebody hunt for the date they remember seeing; showing it settled
 * answers them. Cancelled is a different word from sold out and gets its own,
 * because a refund is owed for one and not the other.
 *
 * Each date is a real `<time datetime>` in ISO form beside the human one, so a
 * crawler gets an unambiguous date out of "Sat 12 Apr" without guessing a
 * locale or a century.
 *
 * The whole row is NOT a link. The city is not clickable and the ticket link
 * says "Tickets" — a row-sized click target with three pieces of information in
 * it gives a screen reader one long unreadable link name.
 */
export type TourDate = {
  key: string;
  date: string | number | Date;
  city: string;
  venue?: string;
  country?: string;
  status?: "onsale" | "few" | "soldout" | "cancelled";
  href?: string;
};

const NOTE = { few: "Low availability", soldout: "Sold out", cancelled: "Cancelled" } as const;

export function TourDates({
  dates, showPast, empty = "No dates announced yet.", cta = "Tickets", className,
}: {
  dates: TourDate[];
  /** Include dates that have been and gone, dimmed. */
  showPast?: boolean;
  empty?: string;
  cta?: string;
  className?: string;
}) {
  const now = Date.now();
  const rows = dates
    .map((d) => ({ ...d, at: new Date(d.date).getTime() }))
    .filter((d) => !Number.isNaN(d.at))
    .filter((d) => showPast || d.at >= now)
    .sort((a, b) => a.at - b.at);

  if (!rows.length) return <p className={cn("text-sm text-muted-foreground", className)}>{empty}</p>;

  return (
    <ul className={cn("flex flex-col divide-y divide-border", className)}>
      {rows.map((d) => {
        const past = d.at < now;
        const off = past || d.status === "soldout" || d.status === "cancelled";
        return (
          <li key={d.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className={cn("font-medium", off && "text-muted-foreground")}>
                <DateFormat date={d.at} />
              </p>
              <p className={cn("text-sm text-muted-foreground", d.status === "cancelled" && "line-through")}>
                {d.city}{d.venue ? ` · ${d.venue}` : ""}{d.country ? ` · ${d.country}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              {past ? <span className="text-muted-foreground">Past</span>
                : d.status && d.status !== "onsale" ? (
                  <span className={cn("font-medium", d.status === "soldout" && "line-through")}>
                    {NOTE[d.status]}
                  </span>
                ) : d.href ? (
                  <a href={d.href} target="_blank" rel="noreferrer"
                    className="rounded border border-border px-3 py-1 font-medium hover:bg-muted">
                    {cta}
                    <span className="sr-only"> for {d.city} (opens in a new tab)</span>
                  </a>
                ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
