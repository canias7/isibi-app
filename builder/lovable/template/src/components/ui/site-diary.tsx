import { cn, toDate } from "@/lib/utils";
/**
 * A day on site — weather, who was there, what happened.
 *
 * THE WEATHER IS A CONTRACTUAL FACT, not small talk. Delay claims turn on
 * whether conditions stopped work, and a diary without it cannot support one
 * months later — which is the whole reason site diaries are kept.
 *
 * WHO WAS ON SITE IS RECORDED AS NUMBERS PER TRADE. "Six on site" cannot be
 * checked against an invoice for eight bricklayers; the breakdown can, and that
 * reconciliation is the second reason these exist.
 *
 * DELAYS ARE THEIR OWN FIELD, separate from the narrative. A delay buried in a
 * paragraph is one nobody finds when assembling a claim, and the cause matters
 * more than the fact.
 *
 * THE ENTRY IS DATED AND SIGNED. An unsigned diary is worth very little in a
 * dispute, and the author is usually recorded nowhere else.
 */
export type TradeCount = { trade: string; people: number };

export function SiteDiary({ date, weather, temperature, trades = [], work, delays = [], visitors = [], by, className }: {
  /** ISO date. */
  date: string;
  /** Free text — "heavy rain from 11am". */
  weather?: string;
  /** Free text — "4–9°C". */
  temperature?: string;
  trades?: TradeCount[];
  /** What was done. */
  work?: string;
  /** Each with its cause. */
  delays?: string[];
  visitors?: string[];
  by?: string;
  className?: string;
}) {
  const d = toDate(date);
  const ok = !Number.isNaN(d.getTime());
  const total = trades.reduce((n, t) => n + t.people, 0);
  return (
    <article data-slot="site-diary" className={cn("space-y-2 rounded-md border border-border p-3 text-sm", className)}>
      <p className="font-medium">
        {ok
          ? <time dateTime={date}>{d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</time>
          : date}
      </p>
      {(weather || temperature) && (
        <p className="text-xs text-muted-foreground">
          {weather}
          {weather && temperature ? " · " : ""}
          {temperature}
        </p>
      )}
      {trades.length > 0 && (
        <p className="text-xs">
          <span className="text-muted-foreground">On site: </span>
          <span className="tabular-nums">{total}</span>
          <span className="text-muted-foreground">
            {" — "}
            {trades.map((t) => `${t.people} ${t.trade}`).join(", ")}
          </span>
        </p>
      )}
      {work && <p>{work}</p>}
      {delays.length > 0 && (
        <div>
          <p className="text-xs font-medium">Delays</p>
          <ul className="space-y-0.5 text-xs">
            {delays.map((x) => (
              <li key={x} className="flex gap-2"><span aria-hidden="true">·</span><span>{x}</span></li>
            ))}
          </ul>
        </div>
      )}
      {visitors.length > 0 && (
        <p className="text-xs text-muted-foreground">Visitors: {visitors.join(", ")}</p>
      )}
      <p className="border-t border-border pt-1.5 text-xs text-muted-foreground">
        {by ? `Recorded by ${by}` : "Not signed — a diary nobody signed is worth little in a dispute"}
      </p>
    </article>
  );
}
