import { cn } from "@/lib/utils";
/**
 * A limit that cannot be exceeded, said before somebody plans around it.
 *
 * THE DIFFERENCE FROM `limit-reached` IS THE TENSE. That one explains a refusal
 * that has happened; this warns about one that will. A hard cap discovered
 * mid-import — at row 4,000 of 10,000 — wastes the work and often leaves the
 * data half-loaded.
 *
 * "CANNOT BE RAISED" IS STATED WHEN TRUE, and it is the most useful sentence
 * here. Somebody who believes a cap is negotiable spends a day emailing sales;
 * somebody told it is architectural designs around it in ten minutes.
 *
 * IT SUGGESTS THE SHAPE OF THE WORKAROUND rather than just refusing — splitting
 * into batches, archiving, or a different structure — because a hard limit
 * almost always has one, and the person hitting it does not know the product
 * well enough to find it.
 *
 * `role="status"`, not alert: nothing has failed yet, and this appears while
 * somebody is still planning.
 */
export function HardLimitWarning({ what, limit, unit, current, raisable, workaround, className }: {
  /** What is capped — "rows in one import". */
  what: string;
  limit: number;
  unit?: string;
  /** What they are proposing, if known. */
  current?: number;
  /** True if support can raise it. */
  raisable?: boolean;
  /** The way round it. */
  workaround?: string;
  className?: string;
}) {
  const over = current !== undefined && current > limit;
  return (
    <div role="status"
      className={cn("space-y-1 rounded-md border px-3 py-2 text-sm",
        over ? "border-foreground/40 bg-muted/40" : "border-border", className)}>
      <p>
        <span className={cn(over && "font-medium")}>
          {what} is capped at <span className="tabular-nums">{limit.toLocaleString()}</span>
          {unit && ` ${unit}`}
        </span>
        {over && (
          <span className="block text-xs">
            You have <span className="tabular-nums">{current!.toLocaleString()}</span> — this will not go through as one job.
          </span>
        )}
      </p>
      <p className="text-xs text-muted-foreground">
        {raisable
          ? "Ask us if you need it raised."
          : "This one cannot be raised."}
        {workaround && ` ${workaround}`}
      </p>
    </div>
  );
}
