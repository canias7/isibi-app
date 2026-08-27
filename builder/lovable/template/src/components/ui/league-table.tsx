import { cn } from "@/lib/utils";
/**
 * Position, played, points. The club's own row marked by WEIGHT, never a tint.
 *
 * A HIGHLIGHTED ROW IN A TABLE IS THE CLASSIC COLOUR-ONLY FAILURE — a pale
 * yellow band that vanishes in greyscale, in print, and for a good number of
 * readers. Here the row is bold, carries `aria-current="true"` so it is
 * announced, and is the only row with a marker glyph in the position column.
 *
 * GOAL DIFFERENCE IS COMPUTED, not taken. Every league table on the internet
 * that stores GD separately eventually disagrees with its own for and against
 * columns, because somebody corrected one and not the other. One source, one
 * answer.
 *
 * `zone` draws a rule ABOVE a row rather than colouring it: promotion and
 * relegation lines are lines on a printed table, which is what everybody
 * reading a league table already recognises.
 */
export type Row = {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  for: number;
  against: number;
  /** Points, when the league does not simply compute them. */
  points?: number;
  /** The club whose site this is. */
  us?: boolean;
  /** A line drawn above this row: "Promotion", "Relegation". */
  zone?: string | null;
};
export function LeagueTable({ rows, caption, pointsFor = 3, className }: {
  rows: Row[];
  caption?: string;
  /** Points per win — 3 in most codes, 2 in some. */
  pointsFor?: number;
  className?: string;
}) {
  if (!rows.length) return null;
  const pts = (r: Row) => r.points ?? r.won * pointsFor + r.drawn;
  return (
    <div data-slot="league-table" className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse text-sm">
        {caption && <caption className="pb-3 text-start text-xs font-medium uppercase tracking-widest text-muted-foreground">{caption}</caption>}
        <thead>
          <tr className="border-b border-border text-start text-xs uppercase tracking-widest text-muted-foreground">
            <th scope="col" className="py-2 pe-3 font-medium">#</th>
            <th scope="col" className="py-2 pe-4 font-medium">Team</th>
            <th scope="col" className="py-2 pe-3 text-end font-medium">P</th>
            <th scope="col" className="py-2 pe-3 text-end font-medium">W</th>
            <th scope="col" className="py-2 pe-3 text-end font-medium">D</th>
            <th scope="col" className="py-2 pe-3 text-end font-medium">L</th>
            <th scope="col" className="py-2 pe-3 text-end font-medium">GD</th>
            <th scope="col" className="py-2 text-end font-medium">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const gd = r.for - r.against;
            return (
              <tr
                key={r.team}
                {...(r.us ? { "aria-current": "true" as const } : {})}
                className={cn("border-b border-border/60", r.zone && "border-t-2 border-t-foreground",
                  r.us && "font-semibold")}
              >
                <td className="py-2.5 pe-3 tabular-nums text-muted-foreground">
                  {r.us && <span aria-hidden="true" className="me-1">▸</span>}{i + 1}
                </td>
                <th scope="row" className="py-2.5 pe-4 text-start font-[inherit]">
                  {r.team}
                  {r.zone && <span className="ms-2 text-xs font-normal uppercase tracking-widest text-muted-foreground">{r.zone} line</span>}
                </th>
                <td className="py-2.5 pe-3 text-end tabular-nums">{r.played}</td>
                <td className="py-2.5 pe-3 text-end tabular-nums">{r.won}</td>
                <td className="py-2.5 pe-3 text-end tabular-nums">{r.drawn}</td>
                <td className="py-2.5 pe-3 text-end tabular-nums">{r.lost}</td>
                <td className="py-2.5 pe-3 text-end tabular-nums">{gd > 0 ? `+${gd}` : gd}</td>
                <td className="py-2.5 text-end tabular-nums font-semibold">{pts(r)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
