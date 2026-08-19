import { cn } from "@/lib/utils";
/**
 * When each cast member works — and the days they are paid to do nothing.
 *
 * HOLD DAYS ARE THE OUTPUT. An actor working Monday and Friday is usually paid
 * for the whole week, and the cost of a schedule is decided by how many gaps it
 * leaves. A grid showing only work days conceals the entire expense it exists to
 * manage.
 *
 * START, WORK, HOLD AND FINISH ARE THE FOUR STATES the industry uses, and they
 * are rendered as letters with a written key rather than colour — this is
 * printed and faxed and read on a phone.
 *
 * TOTALS ARE PER PERSON, because the negotiation is per person: "six work days
 * and four holds" is the sentence an agent responds to.
 *
 * THE GRID SCROLLS RATHER THAN WRAPPING. A schedule of thirty days on a phone
 * has to stay a grid to be readable at all, and wrapping it destroys the
 * alignment that makes it legible.
 */
export type CastSchedule = {
  id: string;
  name: string;
  character?: string;
  /** One entry per shooting day, in order. */
  days: ("start" | "work" | "hold" | "finish" | "off")[];
};

const MARK = { start: "S", work: "W", hold: "H", finish: "F", off: "" };

export function DayOutOfDays({ cast, dayLabels = [], className }: {
  cast: CastSchedule[];
  /** Column headings — usually day numbers. */
  dayLabels?: (string | number)[];
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="overflow-x-auto">
        <table className="border-collapse text-xs">
          <caption className="sr-only">
            Cast schedule. S is a start day, W a work day, H a paid hold day, F a finish day. An empty cell is a day off.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="pe-2 text-start font-normal text-muted-foreground">Cast</th>
              {(dayLabels.length > 0 ? dayLabels : cast[0]?.days.map((_, i) => i + 1) ?? []).map((d, i) => (
                <th key={i} scope="col" className="px-1 text-center font-normal tabular-nums text-muted-foreground">{d}</th>
              ))}
              <th scope="col" className="ps-2 text-end font-normal text-muted-foreground">W / H</th>
            </tr>
          </thead>
          <tbody>
            {cast.map((c) => {
              const work = c.days.filter((d) => d === "work" || d === "start" || d === "finish").length;
              const hold = c.days.filter((d) => d === "hold").length;
              return (
                <tr key={c.id}>
                  <th scope="row" className="whitespace-nowrap pe-2 text-start font-normal">
                    {c.name}
                    {c.character && <span className="text-muted-foreground"> · {c.character}</span>}
                  </th>
                  {c.days.map((d, i) => (
                    <td key={i} className="border border-border p-0">
                      <span className="flex h-6 w-6 items-center justify-center font-mono">
                        {MARK[d]}
                        <span className="sr-only">{d === "off" ? "day off" : d}</span>
                      </span>
                    </td>
                  ))}
                  <td className="whitespace-nowrap ps-2 text-end tabular-nums">
                    {work} / <span className={cn(hold > 0 && "font-medium")}>{hold}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        S start · W work · H hold, paid and not working · F finish. Holds are what a schedule costs.
      </p>
    </div>
  );
}
