import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * One reported thing, waiting on a decision.
 *
 * THE REPORTED CONTENT IS BEHIND A REVEAL, not shown by default. A moderator
 * scrolling a queue should not be shown graphic material they have not chosen to
 * look at — and the reason for the report is usually enough to decide without
 * ever opening it.
 *
 * WHY IT WAS REPORTED AND BY HOW MANY, since one report and fourteen are
 * different situations, and the count is the only signal of coordinated
 * reporting.
 *
 * APPROVE COMES FIRST. Most reported content is fine, and putting the
 * destructive action where the eye lands makes an overwhelmed moderator remove
 * things they meant to keep.
 */
export function ModerationQueueItem({ reason, reportCount, content, reportedAgo, onApprove, onRemove, onEscalate, className }: {
  reason: string;
  reportCount?: number;
  /** Revealed on request. */
  content: React.ReactNode;
  reportedAgo?: string;
  onApprove: () => void;
  onRemove: () => void;
  onEscalate?: () => void;
  className?: string;
}) {
  return (
    <article data-slot="moderation-queue-item" className={cn("flex flex-col gap-2 rounded-md border border-border p-3", className)}>
      <p className="text-sm">
        <span className="font-medium">{reason}</span>
        <span className="text-muted-foreground tabular-nums">
          {typeof reportCount === "number" ? ` · ${reportCount} ${reportCount === 1 ? "report" : "reports"}` : ""}
          {reportedAgo ? ` · ${reportedAgo}` : ""}
        </span>
      </p>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground underline underline-offset-4">
          Show what was reported
        </summary>
        <div className="mt-2 rounded border border-border bg-muted/40 p-2">{content}</div>
      </details>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onApprove}>Leave it up</Button>
        <Button size="sm" variant="outline" onClick={onRemove}>Take it down</Button>
        {onEscalate && <Button size="sm" variant="outline" onClick={onEscalate}>Pass it on</Button>}
      </div>
    </article>
  );
}
