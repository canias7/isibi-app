import { cn } from "@/lib/utils";
/**
 * How much has not reached the server yet.
 *
 * The count is the whole point and it is stated as a number, not as a dot. "3
 * changes waiting" tells somebody whether closing the laptop is safe; a dot
 * tells them something is happening and leaves them to guess how much.
 *
 * `role="status"` so the number is announced as it changes, and `tabular-nums`
 * so it does not jiggle while it counts down.
 *
 * Renders NOTHING at zero. A permanent "0 changes waiting" is furniture the
 * reader learns to stop seeing, which means they also stop seeing it say 3.
 */
export function PendingChanges({ count, items, onReview, className }: {
  count: number;
  /** What is waiting, when the caller can say. */
  items?: string[];
  onReview?: () => void;
  className?: string;
}) {
  if (count <= 0) return null;
  return (
    <div data-slot="pending-changes" role="status"
      className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-border px-3 py-2 text-sm", className)}>
      <span className="font-medium tabular-nums">
        {count} {count === 1 ? "change" : "changes"} waiting to save
      </span>
      {items?.length ? (
        <span className="min-w-0 truncate text-muted-foreground">— {items.slice(0, 3).join(", ")}
          {items.length > 3 ? ` and ${items.length - 3} more` : ""}</span>
      ) : null}
      {onReview && (
        <button type="button" onClick={onReview}
          className="cursor-pointer underline underline-offset-4">Review</button>
      )}
    </div>
  );
}
