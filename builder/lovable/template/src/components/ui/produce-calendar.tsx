import { cn } from "@/lib/utils";
/**
 * The year, month by month, so February explains itself without an apology.
 *
 * A FARM SHOP'S HARDEST CONVERSATION IS FEBRUARY. Somebody wants strawberries,
 * there are none, and the choice is to apologise or to explain — and explaining
 * it once, on a page, turns a disappointment into the reason to shop there. So
 * this is not a novelty; it is the single piece of content that does the most
 * work on a seasonal site.
 *
 * IN SEASON, STORED AND GONE ARE THREE STATES, NOT TWO. Apples in March are
 * real, they are British, and they are out of the barn rather than off the tree
 * — a two-state grid calls that a lie in one direction or the other. Stored
 * reads as an outline where in-season is filled, and both are labelled in the
 * key AND in the cell's own screen-reader text.
 *
 * FILL AND OUTLINE, NEVER TWO COLOURS. A green square beside an amber one is
 * one square in greyscale, on a printout pinned in a shop, and to a good number
 * of the people reading it. The same discipline as `status-dot`.
 *
 * THE CURRENT MONTH IS MARKED, and that is most of the value — somebody arrives
 * in February wanting to know about February, not to count columns. Marked by a
 * rule and a label rather than a tint, and `now` is injectable so a test can fix
 * it.
 *
 * TWELVE COLUMNS DO NOT FIT ON A PHONE and pretending otherwise gives 26px
 * cells. It scrolls horizontally inside its own container, with the produce
 * name pinned, which is the honest answer for a table this shape.
 */
export type Produce = {
  name: string;
  /** Month numbers 1–12 when it is picked here. */
  months: number[];
  /** Month numbers when it is ours but out of store, not off the plant. */
  stored?: number[];
  note?: string | null;
};
const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function ProduceCalendar({ items, now, caption, className }: {
  items: Produce[];
  /** Injectable clock, so a test can fix "this month". */
  now?: Date;
  caption?: string;
  className?: string;
}) {
  if (!items.length) return null;
  const thisMonth = (now ?? new Date()).getMonth() + 1;
  return (
    <div data-slot="produce-calendar" className={cn("", className)}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] border-collapse text-sm">
          {caption && <caption className="pb-3 text-start text-xs font-medium uppercase tracking-widest text-muted-foreground">{caption}</caption>}
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="py-2 pe-4 text-start text-xs font-medium uppercase tracking-widest text-muted-foreground">Grown here</th>
              {M.map((label, i) => (
                <th key={label} scope="col"
                  className={cn("px-1 py-2 text-center text-xs font-medium uppercase tracking-widest",
                    i + 1 === thisMonth ? "border-x border-foreground text-foreground" : "text-muted-foreground")}>
                  {label}
                  {i + 1 === thisMonth && <span className="sr-only"> — this month</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.name} className="border-b border-border/60">
                <th scope="row" className="py-2.5 pe-4 text-start font-[inherit]">
                  <span className="font-medium">{p.name}</span>
                  {p.note && <span className="block text-xs text-muted-foreground">{p.note}</span>}
                </th>
                {M.map((label, i) => {
                  const mth = i + 1;
                  const on = p.months?.includes(mth);
                  const stored = !on && p.stored?.includes(mth);
                  return (
                    <td key={label}
                      className={cn("px-1 py-2.5 text-center", mth === thisMonth && "border-x border-foreground")}>
                      <span aria-hidden="true" className={cn(
                        "mx-auto block h-4 w-full max-w-8 rounded-sm",
                        on ? "bg-foreground" : stored ? "border border-foreground/50" : "bg-muted",
                      )} />
                      <span className="sr-only">
                        {label}: {on ? "in season" : stored ? "from store" : "not available"}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
        <li className="flex items-center gap-2"><span aria-hidden="true" className="h-3 w-6 rounded-sm bg-foreground" /> Picked here</li>
        <li className="flex items-center gap-2"><span aria-hidden="true" className="h-3 w-6 rounded-sm border border-foreground/50" /> Ours, out of store</li>
        <li className="flex items-center gap-2"><span aria-hidden="true" className="h-3 w-6 rounded-sm bg-muted" /> Not this month</li>
      </ul>
    </div>
  );
}
