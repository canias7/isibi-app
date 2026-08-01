import { cn } from "@/lib/utils";
/**
 * How far a release has spread, and whether it is still moving.
 *
 * "PAUSED" IS THE STATE THAT MATTERS. A rollout stuck at 20% looks identical to
 * one in progress at 20%, and the difference is whether somebody needs to
 * intervene — usually they do, and usually nobody notices for hours.
 *
 * IT REPORTS WHAT WOULD BE ROLLED BACK. Halting is easy; the number of
 * customers already on the new version decides whether rolling back is a
 * non-event or a second incident, and that is the figure somebody wants at the
 * moment they are deciding.
 *
 * A PERCENTAGE AND A COUNT. "40%" of an unknown population is not actionable;
 * 40% of 12 accounts and of 120,000 are entirely different risks.
 *
 * `<progress>` with the state in text, so a paused rollout is not represented
 * solely by a bar that has stopped moving — which is indistinguishable from a
 * slow one.
 */
export function RolloutProgress({ version, percent, affected, total, state, nextStep, className }: {
  version: string;
  percent: number;
  /** How many are on the new version. */
  affected?: number;
  /** The whole population. */
  total?: number;
  state: "rolling" | "paused" | "complete" | "rolled-back";
  /** Free text — "50% in 2 hours". */
  nextStep?: string;
  className?: string;
}) {
  const WORD = {
    rolling: "Rolling out",
    paused: "Paused",
    complete: "Everyone is on it",
    "rolled-back": "Rolled back",
  } as const;
  const stuck = state === "paused" || state === "rolled-back";
  return (
    <div className={cn("space-y-1", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="font-medium">v{version}</span>
        <span className={cn(stuck ? "font-medium" : "text-muted-foreground")}>{WORD[state]}</span>
        <span className="tabular-nums text-muted-foreground">{Math.round(percent)}%</span>
        {affected !== undefined && (
          <span className="tabular-nums text-muted-foreground">
            {affected.toLocaleString()}{total !== undefined ? ` of ${total.toLocaleString()}` : ""}
          </span>
        )}
      </p>
      <progress value={Math.max(0, Math.min(100, percent))} max={100} aria-label={`Rollout of ${version}`}
        className="h-1.5 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-foreground [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-foreground" />
      {state === "rolling" && nextStep && (
        <p className="text-xs text-muted-foreground">Next: {nextStep}</p>
      )}
      {state === "paused" && (
        <p className="text-xs text-muted-foreground">
          It will not go further on its own.
          {affected !== undefined && ` ${affected.toLocaleString()} would go back if you roll this back.`}
        </p>
      )}
    </div>
  );
}
