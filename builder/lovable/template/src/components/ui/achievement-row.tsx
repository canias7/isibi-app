import { cn } from "@/lib/utils";
/**
 * An achievement — with progress that is real, or none at all.
 *
 * A HIDDEN ACHIEVEMENT SHOWS THAT IT IS HIDDEN. A blank row is a bug; "hidden
 * until you get it" is a deliberate design somebody can accept. The difference
 * is one sentence and it stops a support ticket.
 *
 * PROGRESS IS SHOWN ONLY WHERE IT IS TRACKED. A bar at 0% on something binary
 * implies the game is counting when it is not, and that is worse than no bar —
 * people grind towards a number nobody is measuring.
 *
 * A NO-LONGER-OBTAINABLE ACHIEVEMENT SAYS SO. Event achievements expire, the
 * list keeps them, and a player working towards one that closed in 2024 is
 * being wasted by the interface rather than by the game.
 *
 * THE RARITY IS A PLAIN PERCENTAGE, not a tier name. "0.4% of players have
 * this" is information; "Legendary" is marketing that varies by title.
 */
export function AchievementRow({ name, description, earned, earnedOn, progress, progressTarget, hidden, unobtainable, rarityPercent, className }: {
  name: string;
  description?: string;
  earned?: boolean;
  /** Free text — "14 March". */
  earnedOn?: string;
  /** Only where it is genuinely counted. */
  progress?: number;
  progressTarget?: number;
  /** True where details are concealed until earned. */
  hidden?: boolean;
  /** True where it can no longer be obtained. */
  unobtainable?: boolean;
  /** Share of players who have it. */
  rarityPercent?: number;
  className?: string;
}) {
  const tracked = progress !== undefined && progressTarget !== undefined && progressTarget > 0;
  const concealed = hidden && !earned;
  return (
    <li className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className={cn("min-w-0 flex-1", !earned && "text-muted-foreground")}>
          {concealed ? "Hidden achievement" : name}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {earned ? (earnedOn ? `Earned ${earnedOn}` : "Earned") : ""}
        </span>
      </p>
      {concealed ? (
        <p className="text-xs text-muted-foreground">
          Deliberately hidden until you get it — this is not a loading error.
        </p>
      ) : description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
      {!earned && tracked && (
        <p className="text-xs tabular-nums text-muted-foreground">{progress} of {progressTarget}</p>
      )}
      {!earned && !tracked && !concealed && (
        <p className="text-xs text-muted-foreground">Nothing is being counted towards this — it happens or it does not.</p>
      )}
      {unobtainable && !earned && (
        <p className="text-xs font-medium">No longer obtainable — do not spend time on it.</p>
      )}
      {rarityPercent !== undefined && (
        <p className="text-xs tabular-nums text-muted-foreground">{rarityPercent}% of players have this.</p>
      )}
    </li>
  );
}
