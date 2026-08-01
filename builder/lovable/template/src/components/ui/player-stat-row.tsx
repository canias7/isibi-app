import { cn } from "@/lib/utils";
/**
 * A player's season — with minutes, which is what makes totals comparable.
 *
 * APPEARANCES ARE NOT MINUTES. Eight goals in thirty appearances and eight in
 * six hundred minutes are entirely different, and a substitute counted as a
 * full appearance is how a squad player looks worse than they are and a
 * fifteen-minute specialist looks better.
 *
 * PER-90 FIGURES ARE COMPUTED ONLY ABOVE A MINUTES THRESHOLD, and the
 * threshold is stated. Two goals in ninety minutes is not a rate of two per
 * ninety, and publishing it as one is the most common way amateur statistics
 * mislead.
 *
 * STARTS AND SUBSTITUTE APPEARANCES ARE SEPARATE, because the difference is
 * most of what a player wants to know about their season.
 *
 * NO RATING OUT OF TEN. A single composite number for a person invites
 * comparison it cannot support, and every league that publishes one argues
 * about it instead of about football.
 */
export function PlayerStatRow({ player, position, starts = 0, substituteAppearances = 0, minutes = 0, goals = 0, assists, per90Threshold = 450, className }: {
  player: string;
  position?: string;
  starts?: number;
  substituteAppearances?: number;
  minutes?: number;
  goals?: number;
  assists?: number;
  /** Below this, per-90 figures are not shown. */
  per90Threshold?: number;
  className?: string;
}) {
  const apps = starts + substituteAppearances;
  const enough = minutes >= per90Threshold;
  const per90 = enough && minutes > 0 ? (goals / minutes) * 90 : undefined;
  return (
    <li className={cn("space-y-0.5 px-3 py-1.5 text-sm", className)}>
      <p className="flex items-baseline gap-3">
        <span className="min-w-0 flex-1">
          {player}
          {position && <span className="text-xs text-muted-foreground"> · {position}</span>}
        </span>
        <span className="shrink-0 tabular-nums">{goals}</span>
        {assists !== undefined && (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{assists} assists</span>
        )}
      </p>
      <p className="text-xs tabular-nums text-muted-foreground">
        {apps} {apps === 1 ? "appearance" : "appearances"} · {starts} {starts === 1 ? "start" : "starts"} · {minutes} minutes
      </p>
      {per90 !== undefined ? (
        <p className="text-xs tabular-nums text-muted-foreground">
          {per90.toFixed(2)} goals per 90 minutes.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Too few minutes for a per-90 figure to mean anything.
        </p>
      )}
    </li>
  );
}
