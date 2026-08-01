import { cn } from "@/lib/utils";
/**
 * "Open now — closes at 18:00", or when it next opens.
 *
 * CLOSED IS ONLY USEFUL WITH "OPENS AT". Somebody checking at 08:40 needs to
 * know whether to wait twenty minutes or come back tomorrow, and "Closed" alone
 * sends them to look up the hours they were trying to avoid reading.
 *
 * "CLOSING SOON" IS ITS OWN STATE, because arriving at a shop that shuts in
 * four minutes is the trip this component exists to prevent — and technically
 * it is open, so a two-state version cannot warn about it.
 *
 * WORD AND WEIGHT, NEVER GREEN AND RED. This is the single most colour-coded
 * pattern on the web and it is exactly where colour alone fails: it is read at
 * a glance, on a phone, in daylight, often by somebody who cannot tell the two
 * hues apart.
 *
 * THE STATE IS PASSED IN, NOT COMPUTED. Opening hours involve the venue's
 * timezone, public holidays and one-off closures — a component deciding from
 * `new Date()` would confidently contradict the business on the days it matters
 * most.
 */
export function OpeningStatus({ state, until, note, className }: {
  state: "open" | "closing" | "closed";
  /** "18:00" when open or closing; "09:00 tomorrow" when closed. */
  until?: string;
  /** A one-off — "Closed for the bank holiday". */
  note?: string;
  className?: string;
}) {
  const word = state === "open" ? "Open now" : state === "closing" ? "Closing soon" : "Closed";
  const tail = until
    ? state === "closed" ? `Opens ${until}` : `Closes at ${until}`
    : null;
  return (
    <p className={cn("text-sm", className)}>
      <span className={cn(state !== "open" && "font-medium")}>{word}</span>
      {tail && <span className="text-muted-foreground"> · {tail}</span>}
      {note && <span className="block text-xs text-muted-foreground">{note}</span>}
    </p>
  );
}
