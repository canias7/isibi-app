import { cn } from "@/lib/utils";
/**
 * Which areas are free, which are taken, and which are under offer.
 *
 * THE SECOND QUESTION EVERY PROSPECT HAS, and no franchise site answers it
 * before a phone call. Somebody in Doncaster reads the whole proposition,
 * fills in the form, waits three days and is told Doncaster went last year —
 * an outcome both sides could have had in four seconds. Publishing the map
 * costs a franchisor nothing except enquiries that were never convertible.
 *
 * UNDER OFFER IS A THIRD STATE AND COLLAPSING IT IS THE EXPENSIVE MISTAKE.
 * Shown as taken, a deal that falls through — and about a third do — loses the
 * second-best applicant who had already gone elsewhere. Shown as free, somebody
 * builds a business plan around an area that is ninety per cent gone. It is its
 * own state, and it is the state that most rewards ringing up.
 *
 * POPULATION IS THE FIELD THAT MAKES A TERRITORY COMPARABLE. "North Yorkshire"
 * and "Harrogate" are both one territory and one of them is eight times the
 * other; a prospect choosing between two free areas has no other basis, and a
 * franchisor who omits it is usually omitting it about the small ones.
 *
 * NO COLOUR AND NO MAP. Three states in three colours is one state in
 * greyscale, and a tile map needs a provider key, bills per load and drops a
 * third-party tracker onto the page — the same refusal `location-card` makes.
 * The list is sorted so the free ones lead, because that is what the reader
 * came for.
 */
export type Territory = {
  name: string;
  state: "free" | "under-offer" | "taken";
  /** Households or people covered. What makes two territories comparable at all. */
  population?: number | null;
  /** "Includes Ripon and Boroughbridge". What the name does not make obvious. */
  detail?: string | null;
};
const ORDER = { free: 0, "under-offer": 1, taken: 2 } as const;
export function TerritoryList({
  territories, locale = "en-GB", heading = "Where we have room", note, className,
}: {
  territories: Territory[];
  locale?: string;
  heading?: string;
  note?: string;
  className?: string;
}) {
  if (!territories.length) return null;
  // Free first — that is what somebody opened the page for. Stable within a
  // state, so a franchisor's own ordering survives.
  const sorted = [...territories].sort((a, b) => ORDER[a.state] - ORDER[b.state]);
  const free = territories.filter((t) => t.state === "free").length;
  const open = territories.filter((t) => t.state === "under-offer").length;
  return (
    <div data-slot="territory-list" className={cn("", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{heading}</h2>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{free} free</span>
          {open > 0 ? `, ${open} under offer` : ""} of {territories.length}
        </p>
      </div>
      <ul className="mt-3 divide-y divide-border border-y border-border">
        {sorted.map((t) => (
          <li key={t.name} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 py-3.5">
            <span className="min-w-0 flex-1">
              <span className={cn("text-base", t.state === "taken" ? "text-muted-foreground" : "font-medium")}>
                {t.name}
              </span>
              {t.detail && <span className="block text-sm text-muted-foreground">{t.detail}</span>}
            </span>
            <span className="shrink-0 text-end">
              {/* THREE STATES IN WORDS. Under offer is not taken — a third of
                  them fall through, and that is when the runner-up matters. */}
              <span className={cn("block text-sm",
                t.state === "free" ? "font-semibold" : t.state === "under-offer" ? "font-medium" : "text-muted-foreground")}>
                {t.state === "free" ? "Free" : t.state === "under-offer" ? "Under offer" : "Taken"}
              </span>
              {typeof t.population === "number" && (
                <span className="block text-sm tabular-nums text-muted-foreground">
                  {t.population.toLocaleString(locale)} people
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      {open > 0 && (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Under offer means somebody is partway through, not that it has gone. About a third do not
          complete, so it is worth registering an interest rather than crossing it off.
        </p>
      )}
      {note && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{note}</p>}
    </div>
  );
}
