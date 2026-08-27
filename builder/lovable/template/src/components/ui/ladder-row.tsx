import { cn } from "@/lib/utils";
/**
 * A place on a ladder — with the games behind it.
 *
 * A RANK ON FEW GAMES IS NOISE AND IS MARKED AS SUCH. Somebody top of a ladder
 * on four wins is not the best player, and a table that ranks them identically
 * to a player with two hundred games is measuring luck. The threshold is the
 * caller's; stating it is the honest part.
 *
 * MOVEMENT SINCE LAST PERIOD IS SHOWN IN PLACES AND IN WORDS. An arrow alone
 * fails in greyscale and to a screen reader, and "up 4" is more informative
 * than a triangle.
 *
 * DECAY IS DISCLOSED WHERE IT APPLIES. Ladders that drop inactive players do it
 * silently, and somebody returning after a fortnight to find they have fallen
 * thirty places assumes the system is broken rather than that it is working as
 * designed.
 *
 * NO STREAK BADGES. Streak counters reward playing while ahead and stopping
 * while behind, which is the opposite of what a ladder is for.
 */
export function LadderRow({ rank, player, rating, played, minimumForRanking, placesMoved, decayingIn, className }: {
  rank: number;
  player: string;
  rating?: number;
  played?: number;
  /** Below this, a rank is not meaningful. */
  minimumForRanking?: number;
  /** Since the last period. Positive is up. */
  placesMoved?: number;
  /** Free text — "3 days" until inactivity decay. */
  decayingIn?: string;
  className?: string;
}) {
  const provisional = played !== undefined && minimumForRanking !== undefined && played < minimumForRanking;
  return (
    <li data-slot="ladder-row" className={cn("space-y-0.5 px-3 py-1.5 text-sm", className)}>
      <p className="flex items-baseline gap-3">
        <span className="w-8 shrink-0 text-xs tabular-nums text-muted-foreground">{rank}</span>
        <span className={cn("min-w-0 flex-1", provisional && "text-muted-foreground")}>{player}</span>
        {rating !== undefined && <span className="shrink-0 tabular-nums">{rating}</span>}
        {placesMoved !== undefined && placesMoved !== 0 && (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {placesMoved > 0 ? `up ${placesMoved}` : `down ${-placesMoved}`}
          </span>
        )}
      </p>
      {played !== undefined && (
        <p className={cn("text-xs tabular-nums", provisional ? "font-medium" : "text-muted-foreground")}>
          {played} {played === 1 ? "game" : "games"}
          {provisional && minimumForRanking !== undefined &&
            ` — under ${minimumForRanking}, so this position is mostly luck`}
        </p>
      )}
      {decayingIn && (
        <p className="text-xs text-muted-foreground">Drops for inactivity in {decayingIn}.</p>
      )}
    </li>
  );
}
