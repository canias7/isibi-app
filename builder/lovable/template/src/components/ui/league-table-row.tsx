import { cn } from "@/lib/utils";
/**
 * One line of a table — with games in hand, which changes the meaning of it.
 *
 * GAMES PLAYED IS AS IMPORTANT AS POINTS, and a table sorted on points alone
 * misleads for most of a season. A side three points behind with two matches in
 * hand is ahead in every sense that matters, and that is invisible without the
 * played column.
 *
 * GOAL DIFFERENCE IS COMPUTED FROM FOR AND AGAINST, never taken as an input. Two
 * numbers that can disagree eventually will, and in a table it decides
 * promotion.
 *
 * A POINTS DEDUCTION IS SHOWN AS ONE. Adjusting the total silently makes the
 * arithmetic wrong to everybody checking it, and the deduction is usually the
 * most interesting fact about that row.
 *
 * POSITION IS SUPPLIED BY THE CALLER. Tie-breaks differ between competitions —
 * goal difference, head-to-head, goals scored — and a component inventing an
 * order would rank a league by rules it does not know.
 */
export function LeagueTableRow({ position, team, played, won, drawn, lost, goalsFor, goalsAgainst, pointsDeduction = 0, pointsPerWin = 3, pointsPerDraw = 1, gamesInHand, highlight, className }: {
  position?: number;
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor?: number;
  goalsAgainst?: number;
  /** Shown separately, never folded into the total. */
  pointsDeduction?: number;
  pointsPerWin?: number;
  pointsPerDraw?: number;
  /** Matches fewer than the side above. */
  gamesInHand?: number;
  highlight?: boolean;
  className?: string;
}) {
  const points = won * pointsPerWin + drawn * pointsPerDraw - pointsDeduction;
  const gd = goalsFor !== undefined && goalsAgainst !== undefined ? goalsFor - goalsAgainst : undefined;
  return (
    <li className={cn("px-3 py-1.5 text-sm", className)}>
      <p className="flex items-baseline gap-2 tabular-nums">
        {position !== undefined && <span className="w-6 shrink-0 text-xs text-muted-foreground">{position}</span>}
        <span className={cn("min-w-0 flex-1", highlight && "font-medium")}>{team}</span>
        {/* Each figure names its own column for a screen reader. A row is one
            `li` and cannot render a header, so without this a table is read out
            as six unlabelled numbers. The caller renders the visible header. */}
        <span className="w-8 shrink-0 text-end text-xs text-muted-foreground"><span className="sr-only">Played </span>{played}</span>
        <span className="w-8 shrink-0 text-end text-xs text-muted-foreground"><span className="sr-only">Won </span>{won}</span>
        <span className="w-8 shrink-0 text-end text-xs text-muted-foreground"><span className="sr-only">Drawn </span>{drawn}</span>
        <span className="w-8 shrink-0 text-end text-xs text-muted-foreground"><span className="sr-only">Lost </span>{lost}</span>
        <span className="w-10 shrink-0 text-end text-xs text-muted-foreground">
          {gd !== undefined && <><span className="sr-only">Goal difference </span>{gd > 0 ? `+${gd}` : gd}</>}
        </span>
        <span className="w-10 shrink-0 text-end font-medium"><span className="sr-only">Points </span>{points}</span>
      </p>
      {pointsDeduction > 0 && (
        <p className="text-xs font-medium tabular-nums">
          {pointsDeduction} {pointsDeduction === 1 ? "point" : "points"} deducted.
        </p>
      )}
      {gamesInHand !== undefined && gamesInHand > 0 && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {gamesInHand} {gamesInHand === 1 ? "game" : "games"} in hand.
        </p>
      )}
    </li>
  );
}
