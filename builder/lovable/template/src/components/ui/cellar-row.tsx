import { cn } from "@/lib/utils";
/**
 * Something stored to age — with the drinking window and where it actually is.
 *
 * THE LOCATION IS AS IMPORTANT AS THE ITEM. A cellar list without bin positions
 * is a list of things somebody has to move forty cases to find, and the whole
 * point of a list is not doing that. It is the field every collection app makes
 * optional and every user regrets leaving blank.
 *
 * THE WINDOW HAS TWO ENDS AND THE LATE ONE MATTERS MORE. Everybody records when
 * something will be ready and almost nobody records when it stops improving,
 * which is how a cellar ends up full of things kept past their best by people
 * waiting for an occasion.
 *
 * BOTTLES REMAINING IS SHOWN, because the decision is different for the last one.
 * A case of twelve and a single bottle are not the same object.
 *
 * NO VALUATION. Auction estimates are not what somebody paid and not what they
 * would get, and putting a number beside a bottle changes whether it is ever
 * opened.
 */
export function CellarRow({ what, vintage, location, bottles, readyFrom, bestBefore, yearsUntilReady, yearsPastBest, note, className }: {
  what: string;
  vintage?: string;
  /** The field everybody leaves blank and everybody regrets. */
  location?: string;
  bottles?: number;
  readyFrom?: string;
  /** The end everybody forgets. */
  bestBefore?: string;
  yearsUntilReady?: number;
  /** Positive means it is past its best. */
  yearsPastBest?: number;
  note?: string;
  className?: string;
}) {
  const notReady = yearsUntilReady !== undefined && yearsUntilReady > 0;
  const pastBest = yearsPastBest !== undefined && yearsPastBest > 0;
  const yrs = (n: number) => `${n} ${n === 1 ? "year" : "years"}`;
  return (
    <li className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1">
          <span className="font-medium">{what}</span>
          {vintage && <span className="tabular-nums text-muted-foreground"> {vintage}</span>}
        </span>
        {bottles !== undefined && (
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {bottles} {bottles === 1 ? "bottle" : "bottles"}
          </span>
        )}
      </p>
      <p className={cn("text-xs", location ? "text-muted-foreground" : "font-medium")}>
        {location ?? "No location recorded — you will be moving cases to find this."}
      </p>
      <p className={cn("text-xs tabular-nums", pastBest ? "font-medium" : "text-muted-foreground")}>
        {pastBest
          ? `${yrs(yearsPastBest as number)} past its best. It will not improve from here.`
          : notReady
            ? `Ready in about ${yrs(yearsUntilReady as number)}${readyFrom ? `, from ${readyFrom}` : ""}.`
            : [readyFrom && `Ready since ${readyFrom}`, bestBefore && `drink before ${bestBefore}`]
                .filter(Boolean)
                .join(" · ")}
      </p>
      {bottles === 1 && !pastBest && (
        <p className="text-xs text-muted-foreground">Last one. Different decision from opening one of twelve.</p>
      )}
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </li>
  );
}
