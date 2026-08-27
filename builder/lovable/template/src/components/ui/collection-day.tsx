import { cn } from "@/lib/utils";
/**
 * When to put the bins out — and which ones.
 *
 * WHICH BIN IS THE WHOLE QUESTION. Alternating collections are the norm and
 * getting it wrong means a fortnight with a full bin, so a date without the bin
 * type answers nothing. It is the one thing every council website buries.
 *
 * THE PUT-OUT TIME IS THE NIGHT BEFORE, PRACTICALLY. Crews start before dawn
 * and a bin out at 07:00 is a bin missed, so the component states a deadline
 * rather than a collection time.
 *
 * A CHANGED DATE IS THE HEADLINE WHEN THERE IS ONE. Bank holiday shifts are the
 * single largest source of missed collections and are announced in places
 * nobody reads.
 *
 * NO COUNTDOWN IN HOURS. This is a bin. A date, a day name and which container
 * is the entire useful content.
 */
// A sentence-embedded list needs a conjunction, not a comma: "does not
// include rubble, waste burned for energy" reads as a truncated list.
// `Intl.ListFormat` also gets the separator right outside English.
const AND = new Intl.ListFormat("en", { style: "long", type: "conjunction" });

export function CollectionDay({ nextOn, dayName, bins = [], putOutBy, changed, changedFrom, changedReason, className }: {
  /** Free text — "Thursday 14 August". */
  nextOn: string;
  dayName?: string;
  /** Which containers go out this time. */
  bins?: string[];
  /** Free text — "6am, so the night before in practice". */
  putOutBy?: string;
  /** True where this date has moved. */
  changed?: boolean;
  /** What it was. */
  changedFrom?: string;
  changedReason?: string;
  className?: string;
}) {
  return (
    <div data-slot="collection-day" className={cn("space-y-0.5 text-sm", className)}>
      {changed && (
        <p className="font-medium">
          This collection has moved{changedFrom ? ` from ${changedFrom}` : ""}
          {changedReason ? ` — ${changedReason}` : ""}.
        </p>
      )}
      <p>
        <span className="font-medium">{nextOn}</span>
        {dayName && <span className="text-muted-foreground"> · {dayName}</span>}
      </p>
      <p className={cn("text-xs", bins.length > 0 ? "" : "font-medium")}>
        {bins.length > 0
          ? `Put out: ${AND.format(bins)}.`
          : "No bin type listed — which is the only thing anybody needs to know."}
      </p>
      <p className="text-xs text-muted-foreground">
        {putOutBy
          ? `Out by ${putOutBy}.`
          : "Crews start before dawn — put it out the night before."}
      </p>
    </div>
  );
}
